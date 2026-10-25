// 芸の実演 (owner C): the performance model shared by g.perform / g.performSim and the five stage minigames.
//
// A performance is played line by line (the act's real script: B's 台本, or the built-in bank). Every
// 「笑いどころ」 (beat boke / tendon / kaishu / ochi / sage / answer, and a stand-alone tsukkomi) produces a laugh
//
//   laugh = pot(beat) × Qf(台本) × Af(演者の腕) × t(間・実行) × heat(客席の温度) × crowd × voice reach × noise
//     Qf = 0.35 + 0.8·Q/100            Q  = g.netaQuality(neta) (B) — ai.total, 仕上がり, freshness
//     Af = 0.6 + 0.5·skill             skill = the speaker's stats for that beat (A's COMEDY_STATS) blended with
//                                       g.unitPower(kind); a response line (ツッコミ) averages both members,
//                                       so a weak 相方 drags the act
//     t  = timing 0..1.1: the player's input in the minigame (blended 80/20 with the stat-based timing), or the
//          stat-based timing in the simulation (間 ma + 仕上がり − pressure × (1 − 度胸))
//     heat 0.7 + 0.6·h: h = 客席の温度 0..1, starts from the crowd (warm/normal/cold/tough) + キャラ・華 + condition;
//          laughs raise it (笑いの連鎖: consecutive laughs add more), スベり lower it, 3 スベり in a row = 客が引く
//   classes: v < .15 スベり / < .35 クスクス / < .7 ウケ / ≥ .7 爆笑
// Concrete 実力不足 events, rolled per spoken line from the stats that cause them:
//   噛む  (声量・滑舌 voice, 仕上がり, pressure × (1 − 度胸), rushing)   飛ぶ (仕上がり, pressure × (1 − 度胸))
//   走る  (pressure × (1 − 度胸), 間・テンポ)                        声が小さい (voice vs the hall's size)
//   間が悪い (low timing on a 笑いどころ)    客が引く (3 スベり in a row)    尺オーバー (stage clock vs opts.length)
// Score = 100 · (1 − e^(−1.1L)) / (1 − e^(−1.375)) with L = Σlaugh / Σpot, minus 噛み・飛び・走り・客が引く・尺オーバー
// (contests: −1.2/sec past a 3-sec grace, max −35), plus アドリブ. Typical: amateur 10–25, mid 40–55, strong pro 80–92.

import { clamp } from './util.js';
import { rankFor } from './minigame.js';
import { bankNeta } from './perform_bank.js';

export const STAT_KEYS = ['neta', 'boke', 'tsukkomi', 'ma', 'voice', 'act', 'hassou', 'wagei', 'dokyo', 'chara', 'adlib', 'mane'];
export const STAT_LABEL = { neta: 'ネタ作り', boke: 'ボケ', tsukkomi: 'ツッコミ', ma: '間・テンポ', voice: '声量・滑舌', act: '演技力', hassou: '発想力', wagei: '話芸', dokyo: '度胸', chara: 'キャラ・華', adlib: 'アドリブ', mane: 'ものまね' };
export const KIND_LABEL = { manzai: '漫才', conte: 'コント', pin: 'ピンネタ', rakugo: '落語', ogiri: '大喜利', utaneta: '歌ネタ', monomane: 'ものまね', talk: 'すべらない話', any: 'ネタ' };
export const MINIGAME_OF = { manzai: 'manzai', conte: 'conte', rakugo: 'rakugo', ogiri: 'ogiri', pin: 'pinneta', utaneta: 'pinneta', monomane: 'pinneta', talk: 'pinneta' };
export const PIN_STYLES = { flip: 'フリップ芸', solo: '一人コント', mandan: '漫談', utaneta: '歌ネタ', monomane: 'ものまね' };

export const CROWD = {
  warm: { heat: 0.42, mult: 1.1, label: 'あったかい客席' },
  normal: { heat: 0.28, mult: 1.0, label: 'ふつうの客席' },
  cold: { heat: 0.16, mult: 0.9, label: '冷えた客席' },
  tough: { heat: 0.08, mult: 0.8, label: '手強い客席' },
};
export const SIZE = {
  small: { pressure: 10, need: 0, label: '小さな会場' },
  theater: { pressure: 25, need: 0.3, label: '劇場' },
  hall: { pressure: 45, need: 0.55, label: 'ホール' },
  tv: { pressure: 60, need: 0.25, label: 'テレビ' },
};
const PUNCH = new Set(['boke', 'tendon', 'kaishu', 'ochi', 'sage', 'answer']);
const POT = { boke: 1, tendon: 1.1, kaishu: 1.25, ochi: 1.4, sage: 1.4, answer: 1, tsukkomi: 0.6, tsukami: 0.7 };
// which stats deliver a beat, by kind ('b' = the punch itself, 't' = a ツッコミ / response, 'l' = plain lines)
const DELIVERY = {
  manzai: { b: { boke: 0.45, ma: 0.25, voice: 0.15, chara: 0.15 }, t: { tsukkomi: 0.5, ma: 0.3, voice: 0.2 }, l: { wagei: 0.4, ma: 0.3, voice: 0.3 } },
  conte: { b: { act: 0.35, boke: 0.3, ma: 0.2, voice: 0.15 }, t: { tsukkomi: 0.35, act: 0.35, ma: 0.3 }, l: { act: 0.5, ma: 0.25, voice: 0.25 } },
  rakugo: { b: { wagei: 0.4, ma: 0.3, act: 0.15, voice: 0.15 }, t: { wagei: 0.4, ma: 0.3, act: 0.3 }, l: { wagei: 0.5, voice: 0.25, act: 0.25 } },
  ogiri: { b: { hassou: 0.5, adlib: 0.2, boke: 0.15, chara: 0.15 }, t: { adlib: 0.5, hassou: 0.5 }, l: { wagei: 0.5, chara: 0.5 } },
  pin: { b: { boke: 0.3, hassou: 0.25, ma: 0.2, act: 0.15, chara: 0.1 }, t: { ma: 0.5, act: 0.5 }, l: { wagei: 0.4, ma: 0.3, voice: 0.3 } },
  utaneta: { b: { boke: 0.3, voice: 0.3, ma: 0.25, chara: 0.15 }, t: { voice: 0.5, ma: 0.5 }, l: { voice: 0.6, ma: 0.4 } },
  monomane: { b: { mane: 0.5, voice: 0.2, act: 0.2, chara: 0.1 }, t: { mane: 0.6, voice: 0.4 }, l: { mane: 0.5, voice: 0.5 } },
  talk: { b: { wagei: 0.45, ma: 0.25, adlib: 0.15, chara: 0.15 }, t: { wagei: 0.5, adlib: 0.5 }, l: { wagei: 0.6, ma: 0.4 } },
};
const DEFAULT_PARTNER_LOOK = { hair: 'afro', hairColor: 'brown', skin: 'fair', top: '#2f6fd0', bottom: '#24305e', jacket: true, tie: '#ffd23f' };
const COSTAR_LOOK = { hair: 'spiky', hairColor: 'black', skin: 'fair', top: '#5a6f8a', bottom: '#2a2d36' };

const safe = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
const fn = (g, k) => g && typeof g[k] === 'function';
export function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export const isPunch = (beat) => PUNCH.has(beat);

// 'any' and unknown kinds → what the act does
export function normKind(kind, unit) {
  if (kind && KIND_LABEL[kind] && kind !== 'any') return kind;
  if (unit && unit.type && unit.type !== 'pin') return unit.style === 'conte' ? 'conte' : 'manzai';
  return 'pin';
}
export function pinStyle(kind, opts = {}) {
  if (kind === 'utaneta' || kind === 'monomane') return kind;
  if (kind === 'talk') return 'mandan';
  return PIN_STYLES[opts.style] ? opts.style : 'flip';
}
// The kind a ネタ帳 entry is filed under for this performance
export const listKind = (kind) => (kind === 'utaneta' || kind === 'monomane' || kind === 'talk' ? kind : kind);

export function normVenue(v, opts = {}) {
  const src = v && typeof v === 'object' ? v : {};
  const size = SIZE[src.size] ? src.size : opts.contest ? 'hall' : 'theater';
  const crowd = CROWD[src.crowd] ? src.crowd : 'normal';
  let pressure = Number(src.pressure);
  if (!Number.isFinite(pressure)) pressure = SIZE[size].pressure + (opts.contest ? 20 : 0);
  return { name: src.name || '', size, crowd, pressure: clamp(pressure, 0, 100) };
}

// ------------------------------------------------------------------ the act's members
function fallbackStat(g, k) {
  const sk = (g && g.state && g.state.skills) || {};
  const src = { boke: 'warai', tsukkomi: 'warai', ma: 'warai', neta: 'warai', hassou: 'warai', adlib: 'talk', wagei: 'talk', voice: 'talk', act: 'engi', chara: 'engi', dokyo: 'warai', mane: 'uta' }[k] || 'warai';
  return (Number(sk[src]) || 0) * 0.6;
}
function statsOf(g, m) {
  const out = {};
  for (const k of STAT_KEYS) {
    let v = null;
    if (m.id === 'player' && fn(g, 'comedyStat')) v = Number(safe(() => g.comedyStat(k), null));
    if (!Number.isFinite(v) && m.stats && Number.isFinite(Number(m.stats[k]))) v = Number(m.stats[k]);
    if (!Number.isFinite(v) && m.id && m.id !== 'player' && fn(g, 'comedyStat')) v = Number(safe(() => g.comedyStat(k, m.id), null));
    if (!Number.isFinite(v)) v = fallbackStat(g, k);
    out[k] = clamp(v, 0, 100) / 100;
  }
  return out;
}
const flat = (v) => { const o = {}; for (const k of STAT_KEYS) o[k] = v; return o; };
function synthStats(power, rng) {
  const p = clamp(power, 0, 100) / 100;
  const o = {};
  for (const k of STAT_KEYS) o[k] = clamp(p + (rng() - 0.5) * 0.3 * (1 - p * 0.5), 0.02, 0.99);
  return o;
}

function buildMembers(g, unit, opts, kind, rng) {
  const st = (g && g.state) || {};
  if (Array.isArray(opts.members) && opts.members.length) {
    return opts.members.map((m, i) => ({ id: m.id || 'm' + i, name: m.name || '芸人', short: m.short || m.name || '芸人', role: m.role || (i ? 'boke' : 'tsukkomi'), look: m.look || (i ? DEFAULT_PARTNER_LOOK : LOOK_PLAYER(st)), isPlayer: m.id === 'player', s: m.s || (m.stats ? statsOf(g, m) : synthStats(opts.power ?? 40, rng)) }));
  }
  const duo = kind === 'manzai' || kind === 'conte';
  if (opts.power != null) {
    // a rival / NPC act from its power alone
    const n = duo ? 2 : 1;
    const out = [];
    for (let i = 0; i < n; i++) out.push({ id: 'npc' + i, name: opts.name || 'ライバル', short: opts.name || 'ライバル', role: n === 1 ? 'pin' : i ? 'boke' : 'tsukkomi', look: null, isPlayer: false, s: synthStats(opts.power, rng) });
    return out;
  }
  const me = { id: 'player', name: st.name || 'あなた', short: st.name || 'あなた', role: 'pin', look: LOOK_PLAYER(st), isPlayer: true };
  let mem = [];
  if (unit && Array.isArray(unit.members) && unit.members.length) {
    mem = unit.members.map((m) => ({ id: m.id, name: m.name || '相方', short: m.short || m.name || '相方', role: m.role || 'boke', look: m.look || (m.id === 'player' ? LOOK_PLAYER(st) : DEFAULT_PARTNER_LOOK), isPlayer: m.id === 'player', stats: m.stats }));
    if (!mem.some((m) => m.isPlayer)) mem.unshift(me);
  } else mem = [me];
  if (!duo) mem = mem.filter((m) => m.isPlayer);
  for (const m of mem) m.s = statsOf(g, m);
  const player = mem.find((m) => m.isPlayer);
  // a lesson's teacher (or a job's named partner when the act has none) plays the other part
  const guest = opts.partner && (opts.lesson || mem.length < 2);
  if (duo && guest) {
    mem = [player, { id: 'guest', name: opts.partner, short: opts.partner, role: 'boke', look: opts.partnerLook || DEFAULT_PARTNER_LOOK, isPlayer: false, s: flat(clamp(Number(opts.partnerSkill ?? (opts.lesson ? 72 : 55)), 0, 100) / 100) }];
  } else if (duo && mem.length < 2) {
    const name = kind === 'conte' ? '共演の後輩' : '相方';
    mem.push({ id: 'guest', name, short: name, role: 'boke', look: opts.partnerLook || (kind === 'conte' ? COSTAR_LOOK : DEFAULT_PARTNER_LOOK), isPlayer: false, s: flat(0.42) });
  }
  if (duo && mem.length >= 2) {
    // roles: exactly one ボケ and one ツッコミ among the first two (player role 'both' / 'pin' → ツッコミ)
    const want = opts.role === 'boke' || opts.role === 'tsukkomi' ? opts.role : (player.role === 'boke' ? 'boke' : 'tsukkomi');
    player.role = want;
    for (const m of mem) if (!m.isPlayer) m.role = want === 'boke' ? 'tsukkomi' : 'boke';
  } else player.role = 'pin';
  return mem;
}
function LOOK_PLAYER(st) { return st.look || { hair: 'short', hairColor: 'black', skin: 'fair', top: '#d64161', bottom: '#3a4a7a' }; }

// ------------------------------------------------------------------ the script
// Legacy tsukkomi-minigame lines [{ boke, punch, tsukkomi }] → a Neta (keeps every text).
export function legacyNeta(lines, opts = {}) {
  const out = [];
  const std = opts.dialect === 'std';
  const DEF_T = std ? ['なんでだよ！', 'そんなわけないだろ！', 'おかしいだろ！'] : ['なんでやねん！', 'そんなわけあるかい！', 'おかしいやろ！'];
  const first = lines[0] && String(lines[0].boke || '');
  if (!/どうも|よろしく/.test(first)) out.push({ role: 'boke', text: 'はいどうもー！よろしくお願いしますー！', beat: 'tsukami' });
  let k = 0;
  for (const l of lines) {
    if (!l || !l.boke) continue;
    if (l.punch) {
      out.push({ role: 'boke', text: String(l.boke), beat: 'boke' });
      out.push({ role: 'tsukkomi', text: String(l.tsukkomi || DEF_T[k++ % DEF_T.length]), beat: 'tsukkomi' });
    } else out.push({ role: 'boke', text: String(l.boke), beat: /どうも|よろしく/.test(l.boke) && !out.length ? 'tsukami' : 'setup' });
  }
  out.push({ role: 'tsukkomi', text: std ? 'いいかげんにしろ！どうも、ありがとうございましたー！' : 'もうええわ！どうも、ありがとうございましたー！', beat: 'ochi', closer: true });
  return { id: 'house', kind: 'manzai', title: opts.title || '劇場用の台本', theme: '', setting: '', length: 0, lines: out, house: true };
}

// Normalised lines: { i, who (member index, -1 = ト書き/地), role, text, beat, punch, resp, respIdx, sec, side, char, gesture, prop, twist }
export function normLines(neta, ctx) {
  const src = (neta && Array.isArray(neta.lines) && neta.lines.length ? neta : bankNeta(ctx.kind, { style: ctx.style, dialect: ctx.dialect, rng: ctx.rng, title: ctx.opts.houseTitle }));
  const mem = ctx.members;
  const idx = (pred) => mem.findIndex(pred);
  const bokeI = Math.max(0, idx((m) => m.role === 'boke'));
  const tsukI = idx((m) => m.role === 'tsukkomi');
  const playerI = Math.max(0, idx((m) => m.isPlayer));
  const solo = mem.length < 2;
  const unitName = ctx.unitName || '';
  const charMap = src.chars || {};
  const out = [];
  src.lines.forEach((l, n) => {
    if (!l || l.text == null) return;
    const role = l.role || 'pin';
    let who;
    if (role === 'narr') who = -1;
    else if (solo || role === 'pin' || role === 'sage') who = playerI;
    else if (role === 'boke' || role === 'a') who = bokeI;
    else if (role === 'tsukkomi' || role === 'b') who = tsukI >= 0 ? tsukI : playerI;
    else if (role === 'c') who = mem.length > 2 ? 2 : bokeI;
    else who = playerI;
    if (ctx.kind === 'rakugo') who = role === 'narr' ? -1 : playerI;
    const text = String(l.text).replace(/\{unit\}/g, unitName).replace(/\{name\}/g, (mem[playerI] && mem[playerI].name) || '');
    const beat = l.beat || (role === 'sage' ? 'sage' : 'setup');
    const side = ctx.kind === 'rakugo' ? (l.side || (role === 'a' || role === 'c' ? 'kami' : role === 'b' ? 'shimo' : null)) : null;
    out.push({ i: out.length, who, role, text, beat, punch: PUNCH.has(beat), resp: false, respIdx: null, side, char: l.char || charMap[role] || null, gesture: l.gesture || null, prop: l.prop || null, twist: !!l.twist, cue: l.cue || null, fukusen: !!l.fukusen, kaishu: !!l.kaishu || beat === 'kaishu', q: Number.isFinite(l.q) ? l.q : null, subject: l.subject || null, closer: !!l.closer, src: n });
  });
  // a ツカミ that gets a ツッコミ is a 笑いどころ too
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i], b = out[i + 1];
    if (a.beat === 'tsukami' && a.who >= 0 && b.who >= 0 && b.who !== a.who && b.beat === 'tsukkomi') a.punch = true;
  }
  // a ツッコミ right after a 笑いどころ by someone else is its response (the laugh resolves on it)
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1], b = out[i];
    if (a.punch && !a.resp && b.who >= 0 && a.who >= 0 && b.who !== a.who && (b.beat === 'tsukkomi' || (b.beat === 'ochi' && b.role === 'tsukkomi') || b.closer)) {
      b.resp = true; b.punch = false; a.respIdx = i;
      if (b.beat === 'ochi') a.ochiResp = true;
    }
  }
  // a stand-alone ツッコミ (not answering anything) can still get a laugh
  for (const l of out) if (!l.punch && !l.resp && l.beat === 'tsukkomi' && l.who >= 0) l.punch = true;
  // stage seconds (manzai ≈ 6.5 chars/sec; 落語 slower), scaled to the ネタ's own estimate
  const cps = ctx.kind === 'rakugo' ? 5.2 : ctx.kind === 'conte' ? 5.6 : 6.4;
  let tot = 0;
  for (const l of out) { l.sec = Math.max(1.2, Array.from(l.text).length / cps) + (l.who < 0 ? 0.6 : 0); tot += l.sec; }
  const want = Number(neta && neta.length) || Number(src.length) || 0;
  // a ネタ with its own lines: trust its estimate within reason; a bank stand-in (B's script had no lines) plays the
  // ネタ's full length (the screen shows an abridged version of it)
  const ownLines = !!(neta && Array.isArray(neta.lines) && neta.lines.length);
  if (want > 20 && tot > 0) { const k = ownLines ? clamp(want / tot, 0.6, 1.8) : clamp(want / tot, 0.4, 8); for (const l of out) l.sec *= k; }
  return { lines: out, title: (neta && neta.title) || src.title || '', theme: (neta && neta.theme) || src.theme || '', setting: (neta && neta.setting) || src.setting || '', house: !!src.house && !(neta && neta.lines && neta.lines.length && !neta.house) };
}

// ------------------------------------------------------------------ context
export function stakesOf(opts = {}, venue = null) {
  if (opts.lesson || opts.practice) return 0;
  if (opts.contest) return 1;
  const p = venue ? venue.pressure : normVenue(opts.venue, opts).pressure;
  return clamp((p - 35) / 40, 0, 1);
}
export function netaQ(g, neta, fallback = 45) {
  if (!neta) return fallback;
  if (neta.house) return Number.isFinite(neta.quality) ? neta.quality : fallback;
  if (fn(g, 'netaQuality')) { const q = Number(safe(() => g.netaQuality(neta), NaN)); if (Number.isFinite(q)) return clamp(q, 0, 100); }
  const ai = neta.ai && Number(neta.ai.total);
  return Number.isFinite(ai) ? clamp(ai * 0.7 + (Number(neta.practice) || 0) * 0.3, 0, 100) : fallback;
}

export function buildCtx(g, opts = {}) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const npc = opts.power != null;
  const unit = npc ? null : (opts.unit !== undefined ? opts.unit : (fn(g, 'unit') ? safe(() => g.unit(), null) : null));
  const kind = normKind(opts.kind, unit);
  const style = (kind === 'pin' || kind === 'utaneta' || kind === 'monomane' || kind === 'talk') ? pinStyle(kind, opts) : null;
  const st = (g && g.state) || {};
  const ctx = { kind, style, opts, rng, npc };
  ctx.members = buildMembers(g, unit, opts, kind, rng);
  ctx.unitName = opts.unitName || (unit && unit.name) || (ctx.members[0] && ctx.members[0].name) || '';
  ctx.dialect = opts.dialect === 'std' || opts.dialect === 'kansai' ? opts.dialect : (opts.kamigata ? 'kansai' : 'kansai');
  ctx.venue = normVenue(opts.venue, opts);
  ctx.contest = opts.contest || null;
  ctx.limit = Number(opts.length) > 0 ? Number(opts.length) : null;
  ctx.harmony = unit && Number.isFinite(Number(unit.harmony)) ? clamp(Number(unit.harmony), 0, 100) : 60;
  ctx.era = (st.profile && st.profile.era) || 'reiwa';
  const diff = clamp(Math.round(opts.difficulty ?? 2), 1, 5);
  const neta = opts.neta || null;
  ctx.neta = neta;
  ctx.quality = Number.isFinite(opts.quality) ? clamp(opts.quality, 0, 100) : netaQ(g, neta, 40 + diff * 6);
  const prac = neta && Number.isFinite(Number(neta.practice)) && !neta.auto ? Number(neta.practice) : Number.isFinite(opts.polish) ? opts.polish : neta && neta.auto ? clamp(ctx.quality * 0.9, 0, 100) : (npc ? clamp((opts.power ?? 40) * 0.9 + 8, 0, 100) : 55);
  ctx.practice = clamp(prac, 0, 100);
  const avgPow = ctx.members.reduce((a, m) => a + Object.values(m.s).reduce((x, y) => x + y, 0) / STAT_KEYS.length, 0) / ctx.members.length * 100;
  ctx.power = npc ? clamp(opts.power, 0, 100) : (fn(g, 'unitPower') ? clamp(Number(safe(() => g.unitPower(kind), avgPow)) || avgPow, 0, 100) : avgPow);
  let cond = 0;
  if (!npc && st.life && fn(g, 'lifeBonusParts')) cond = (safe(() => g.lifeBonusParts(opts.skill || 'warai'), []) || []).reduce((a, p) => a + (Number(p.v) || 0), 0);
  ctx.cond = clamp(Number.isFinite(opts.cond) ? opts.cond : cond, -0.4, 0.3);
  // stakes 0..1: routine jobs / lessons / practice (0) are execution-heavy like the old minigames; contests (opts.contest),
  // TV finals and high pressure (1) are decided by the act's stats and script. In between it blends.
  ctx.stakes = Number.isFinite(opts.stakes) ? clamp(opts.stakes, 0, 1) : stakesOf(opts, ctx.venue);
  const n = normLines(neta, ctx);
  Object.assign(ctx, { lines: n.lines, title: n.title, theme: n.theme, setting: n.setting, house: n.house });
  ctx.playerIdx = Math.max(0, ctx.members.findIndex((m) => m.isPlayer));
  return ctx;
}

// ------------------------------------------------------------------ the show
export class Show {
  constructor(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng;
    const cr = CROWD[ctx.venue.crowd] || CROWD.normal;
    const pres = this.avg('chara');
    this.crowdMult = cr.mult + (pres - 0.5) * 0.12;
    this.s = ctx.stakes ?? 1;
    this.r = 1 - this.s; // how routine the stage is
    this.h = clamp(cr.heat + (pres - 0.5) * 0.12 + ctx.cond * 0.25 + 0.1 * this.r, 0.02, 0.85);
    this.samples = [this.h];
    this.time = 0;
    this.c = { laughs: 0, big: 0, kusu: 0, suberi: 0, flubs: 0, flubsCovered: 0, blanks: 0, blanksCovered: 0, adlib: 0, rush: 0, maMiss: 0, recoil: 0, chain: 0, maxChain: 0, streak: 0, tendon: 0 };
    this.potSum = 0;
    this.laughSum = 0;
    this.tSum = 0;
    this.tN = 0;
    this.hl = [];
    this.log = [];
    this.fukusenBroken = false;
    this.who = {}; // per-member event counts
    const need = (SIZE[ctx.venue.size] || SIZE.theater).need * (ctx.kind === 'rakugo' ? 1.15 : 1);
    const voice = this.avg('voice');
    this.voiceMult = 1 - clamp(need - voice, 0, 1) * 0.6 * (0.4 + 0.6 * this.s);
    if (this.voiceMult < 0.9) this.note('koe', `声が後ろの席まで届かなかった（声量・滑舌 ${Math.round(voice * 100)}）`);
    this.pe = ctx.venue.pressure / 100;
    this.lastLaugh = null;
  }
  m(i) { return this.ctx.members[i] || this.ctx.members[0]; }
  avg(k) { const M = this.ctx.members; return M.reduce((a, m) => a + (m.s[k] || 0), 0) / M.length; }
  stat(i, k) { return (this.m(i).s[k]) || 0; }
  note(key, text) { if (!this.hl.some((h) => h.key === key)) this.hl.push({ key, text }); }
  count(i, k) { const w = (this.who[i] ||= {}); w[k] = (w[k] || 0) + 1; return w[k]; }

  // delivery skill 0..1 of member i for a beat type ('b' | 't' | 'l')
  skill(i, type = 'b') {
    const D = (DELIVERY[this.ctx.kind] || DELIVERY.manzai)[type] || DELIVERY.manzai.b;
    let s = 0;
    for (const [k, w] of Object.entries(D)) s += (this.stat(i, k)) * w;
    return clamp(s * 0.65 + (this.ctx.power / 100) * 0.35, 0, 1);
  }
  // per-line risks of the concrete failures
  risk(line, o = {}) {
    if (!line || line.who < 0) return { kamu: 0, tobu: 0, rush: 0 };
    const s = this.m(line.who).s;
    const R = this.ctx.practice / 100;
    const pe = clamp(this.pe + (o.pressure || 0), 0, 1.2);
    const len = clamp(Array.from(line.text || '').length / 20, 0.5, 2);
    const tempo = Math.max(0, (o.tempo || 1) - 1);
    const kamu = (0.008 + 0.09 * (1 - s.voice) ** 2 + 0.04 * (1 - R) ** 2 + pe * 0.05 * (1 - s.dokyo) + tempo * 0.14 * (1 - s.voice * 0.7)) * len;
    const tobu = Array.from(line.text || '').length < 6 ? 0 : 0.003 + 0.05 * (1 - R) ** 2 + pe * 0.06 * (1 - s.dokyo) ** 1.5;
    const rush = pe * 0.14 * (1 - s.dokyo) + 0.04 * (1 - s.ma);
    const hm = this.ctx.harmony < 35 ? (35 - this.ctx.harmony) / 400 : 0;
    const soft = 1 - 0.5 * this.r; // routine stages: the same failures, half as often
    return { kamu: clamp((kamu + hm) * soft, 0, 0.6), tobu: clamp(tobu * soft, 0, 0.4), rush: clamp(rush * soft, 0, 0.5) };
  }
  // the stat-based 間 (what the act does on its own)
  simTiming(i) {
    const s = this.m(i).s;
    const R = this.ctx.practice / 100;
    const mu = 0.36 + 0.55 * (0.6 * s.ma + 0.4 * R) + 0.1 * this.skill(i, 'b') - this.pe * 0.2 * (1 - s.dokyo) - (this.ctx.harmony < 35 ? 0.06 : 0);
    const t = clamp(mu + gauss(this.rng) * 0.15, 0.05, 1.08);
    return t + (0.5 + 0.5 * t - t) * 0.3 * this.r;
  }
  speak(line, tempo = 1) {
    if (line) this.time += line.sec / Math.max(0.5, tempo);
    this.h = Math.max(0.05, this.h * 0.992);
    if (line && !line.punch) this.samples.push(this.h);
  }
  // a small bonus for the act's craft beyond laughs (役に入る・小道具・仕草・暗転・お辞儀), capped in finish()
  craft(points, key, note) { this.bonusPts = (this.bonusPts || 0) + points; if (note) this.note(key, note); }
  wait(sec) { this.time += Math.max(0, sec); }

  // A laugh. o: { resp (the response line), q (this line's own quality, 大喜利), mult, waitK (laugh-wait factor) }
  laugh(line, t, o = {}) {
    const ctx = this.ctx;
    let pot = POT[line.beat] || 1;
    if (o.resp && o.resp.beat === 'ochi') pot = Math.max(pot, POT.ochi);
    if (line.beat === 'tendon') pot += 0.1 * Math.min(3, this.c.tendon++);
    if (line.kaishu && this.fukusenBroken) pot *= 0.75;
    const q = Number.isFinite(o.q) ? o.q : Number.isFinite(line.q) ? line.q * 0.6 + ctx.quality * 0.4 : ctx.quality;
    const qn = clamp(q, 0, 100) / 100;
    const Qf = (0.35 + 0.8 * qn) * this.s + (0.8 + 0.3 * qn) * this.r;
    let sk = this.skill(line.who >= 0 ? line.who : ctx.playerIdx, 'b');
    if (o.resp && o.resp.who >= 0) sk = (sk + this.skill(o.resp.who, 't')) / 2;
    const Af = (0.6 + 0.5 * sk) * this.s + (0.86 + 0.28 * sk) * this.r;
    const tt = clamp(t, 0, 1.12);
    const heatM = 0.7 + 0.6 * this.h;
    const noise = 1 + gauss(this.rng) * 0.1;
    const v = clamp(pot * Qf * Af * tt * heatM * this.crowdMult * this.voiceMult * (o.mult ?? 1) * noise, 0, 1.6);
    this.potSum += pot;
    this.laughSum += Math.min(v, pot * 1.15);
    this.tSum += tt;
    this.tN++;
    if (tt < 0.42) { this.c.maMiss++; if (this.c.maMiss === 2) this.note('ma', `間が悪く、笑いを取りこぼした（間・テンポ ${Math.round(this.avg('ma') * 100)}）`); }
    let cls;
    if (v >= 0.7) cls = 'big'; else if (v >= 0.35) cls = 'laugh'; else if (v >= 0.15) cls = 'kusu'; else cls = 'suberi';
    if (cls === 'big' || cls === 'laugh') {
      this.c.laughs++;
      if (cls === 'big') this.c.big++;
      this.c.chain++;
      this.c.maxChain = Math.max(this.c.maxChain, this.c.chain);
      this.c.streak = 0;
      this.h += 0.06 + 0.1 * Math.min(v, 1) + 0.02 * Math.min(this.c.chain, 5);
      if (this.c.chain === 3) this.note('chain', '笑いが笑いを呼ぶ「笑いの連鎖」が起きた');
      if (line.beat === 'tsukami' || (this.tN === 1 && cls === 'big')) this.note('tsukami', 'ツカミでいきなり客席をつかんだ');
    } else if (cls === 'kusu') {
      this.c.kusu++; this.c.chain = 0; this.c.streak = 0; this.h += 0.015;
    } else {
      this.c.suberi++; this.c.chain = 0; this.c.streak++; this.h -= 0.04;
      if (this.c.streak === 3) { this.c.recoil++; this.h -= 0.12; this.note('recoil', 'スベりが続いて、客が引いてしまった'); }
      if (this.c.suberi === 2) this.note('suberi', 'ボケがスベって、会場がシーンとした');
    }
    if ((line.beat === 'ochi' || line.beat === 'sage' || (o.resp && o.resp.beat === 'ochi')) && cls === 'big') this.note('ochi', ctx.kind === 'rakugo' ? 'サゲで大きな笑いと拍手' : 'オチで大爆笑をかっさらった');
    if ((line.beat === 'ochi' || line.beat === 'sage') && cls === 'suberi') this.note('ochiMiss', 'オチがスベってしまった');
    this.h = clamp(this.h, 0.05, 1);
    this.samples.push(this.h);
    const waitK = o.waitK ?? (1.15 - this.avg('ma') * 0.4);
    this.time += (cls === 'big' ? 2.4 : cls === 'laugh' ? 1.1 : cls === 'kusu' ? 0.3 : 0) * waitK;
    this.lastLaugh = { v, cls, pot, line };
    this.log.push({ i: line.i, v: Math.round(v * 100) / 100, cls, t: Math.round(tt * 100) / 100 });
    return { v, cls, pot };
  }
  // 噛み / 飛び. covered: someone saved it (アドリブ) / the performer recovered
  flub(i, covered = false) {
    this.c.flubs++;
    if (covered) this.c.flubsCovered++;
    else this.h = Math.max(0.02, this.h - 0.035);
    this.time += covered ? 0.6 : 1.2;
    const n = this.count(i, 'kamu');
    const m = this.m(i);
    if (n === 1 || n === 3) this.note('kamu' + i, `${m.short}が${n >= 3 ? `${n}回も` : ''}噛んだ（声量・滑舌 ${Math.round(m.s.voice * 100)}${this.ctx.practice < 50 ? '・仕上がり不足' : ''}）`);
  }
  blank(i, covered = false) {
    this.c.blanks++;
    if (covered) this.c.blanksCovered++;
    this.h = Math.max(0.02, this.h - (covered ? 0.03 : 0.09));
    this.time += covered ? 1.5 : 3.5;
    this.fukusenBroken = true;
    const m = this.m(i);
    this.note('tobu' + i, `${m.short}のセリフが飛んだ（${this.pe >= 0.5 ? `緊張・度胸 ${Math.round(m.s.dokyo * 100)}` : `仕上がり ${Math.round(this.ctx.practice)}`}）`);
  }
  rushed(i) {
    this.c.rush++;
    const m = this.m(i);
    this.note('rush' + i, `${this.ctx.members.length > 1 ? m.short + 'の' : ''}テンポが走ってしまった（間・テンポ ${Math.round(m.s.ma * 100)}・度胸 ${Math.round(m.s.dokyo * 100)}）`);
  }
  adlib(ok, i = this.ctx.playerIdx, v = 0.4) {
    if (!ok) { this.h = Math.max(0.02, this.h - 0.02); return null; }
    this.c.adlib++;
    this.h = clamp(this.h + 0.04 + v * 0.06, 0.02, 1);
    this.note('adlib', `${this.m(i).short}のアドリブで、ミスを笑いに変えた`);
    this.samples.push(this.h);
    return { v, cls: v >= 0.7 ? 'big' : v >= 0.35 ? 'laugh' : 'kusu' };
  }
  heat100() { return Math.round(this.h * 100); }

  // The Result (CONTRACT4). o: { exec (0..100, the minigame's own execution rating), pass, forced score }
  finish(o = {}) {
    const ctx = this.ctx;
    const c = this.c;
    const L = this.potSum > 0 ? this.laughSum / this.potSum : 0.3;
    let base = 100 * (1 - Math.exp(-1.1 * L)) / (1 - Math.exp(-1.375));
    let pen = ((c.flubs - c.flubsCovered) * 1.6 + c.flubsCovered * 0.5 + (c.blanks - c.blanksCovered) * 5 + c.blanksCovered * 2.5 + c.rush * 1.5 + c.recoil * 4) * (1 - 0.4 * this.r);
    const ot = ctx.limit ? Math.max(0, Math.round(this.time - ctx.limit)) : 0;
    let otPen = 0;
    if (ot > 0) {
      otPen = ctx.contest ? Math.min(35, Math.max(0, ot - 3) * 1.2) : Math.min(8, Math.max(0, ot - 10) * 0.25);
      if (ot >= 4) this.note('ot', `尺オーバー ${Math.floor(ot / 60)}:${String(ot % 60).padStart(2, '0')}${ctx.contest && otPen >= 10 ? '（大きく減点）' : ''}`);
    }
    pen += otPen;
    const bonus = Math.min(8, c.adlib * 2.5) + (c.maxChain >= 4 ? 2 : 0) + clamp(this.bonusPts || 0, -6, 6);
    const avgT0 = this.tN ? this.tSum / this.tN : 0.5;
    // the execution rating: the minigame's own (o.execAcc 0..100, how well the player played) or the act's from the timing
    const execAcc = Number.isFinite(o.execAcc) ? clamp(o.execAcc, 0, 100) : 100 * clamp(0.85 * avgT0, 0, 1);
    const model = base - pen + bonus;
    let score = clamp(Math.round(model * (this.s + 0.35 * this.r) + 0.65 * this.r * execAcc), 0, 100);
    if (Number.isFinite(o.score)) score = clamp(Math.round(o.score), 0, 100);
    const rank = rankFor(score);
    const avgT = this.tN ? this.tSum / this.tN : 0.5;
    const presence = 100 * (0.5 * this.avg('chara') + 0.3 * this.avg('voice') * this.voiceMult + 0.2 * this.avg('dokyo'));
    const exec = Number.isFinite(o.execAcc) ? o.execAcc : Number.isFinite(o.exec) ? o.exec : 100 * clamp(1 - (c.flubs - c.flubsCovered) * 0.07 - (c.blanks - c.blanksCovered) * 0.15 - c.rush * 0.06, 0, 1) * (0.6 + 0.4 * avgT);
    const heatAvg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const parts = { neta: Math.round(ctx.quality), execution: clamp(Math.round(exec), 0, 100), presence: clamp(Math.round(presence), 0, 100), timing: clamp(Math.round(avgT * 92), 0, 100), crowd: clamp(Math.round(heatAvg * 100), 0, 100) };
    const heat = downsample(this.samples.map((h) => Math.round(h * 100)), 24);
    const highlights = this.hl.map((h) => h.text).slice(0, 7);
    const pass = o.pass ?? (ctx.opts.pass ?? 50);
    const res = {
      score, rank, success: score >= pass, laughs: c.laughs, big: c.big, flubs: c.flubs, blanks: c.blanks, overtime: ot, adlib: c.adlib,
      heat, parts, comment: commentFor(score, rank, this, ot, otPen), highlights,
      kind: ctx.kind, style: ctx.style, title: ctx.title, duration: Math.round(this.time), limit: ctx.limit, suberi: c.suberi, rush: c.rush,
      netaId: ctx.neta && ctx.neta.id && !ctx.neta.house && !ctx.neta.auto ? ctx.neta.id : null,
    };
    return res;
  }
}

function downsample(arr, n) {
  if (arr.length <= n) return arr;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  return out;
}

function commentFor(score, rank, show, ot, otPen) {
  const c = show.c;
  const head = { S: '会場が揺れるほどの大爆笑！文句なしの出来！', A: 'しっかり笑いを取った。手応えあり！', B: 'まずまずウケた。もうひと押しほしい。', C: '笑いはまばら…。', D: 'ほとんどスベってしまった…。' }[rank];
  if (rank === 'S' || rank === 'A') return otPen >= 10 ? head + 'ただ、尺オーバーが痛い。' : head;
  let why = '';
  if (otPen >= 10) why = '尺オーバーが響いた。';
  else if (c.blanks - c.blanksCovered >= 1) why = 'セリフが飛んだのが痛い。';
  else if (c.flubs - c.flubsCovered >= 3) why = '噛みが多すぎた。';
  else if (show.voiceMult < 0.85) why = '声が後ろまで届いていない。';
  else if (show.ctx.quality < 40) why = 'ネタそのものを見直そう。';
  else if (show.tN && show.tSum / show.tN < 0.5) why = '間が合っていない。';
  else if (c.rush) why = '緊張でテンポが走った。';
  else if (show.ctx.practice < 40) why = 'もっとネタ合わせをしよう。';
  return head + why;
}

// ------------------------------------------------------------------ the simulation (no UI)
// Plays the same model line by line with stat-based timing. Deterministic given ctx.rng.
export function simulate(ctx, o = {}) {
  const show = new Show(ctx);
  const rng = ctx.rng;
  const L = ctx.lines;
  const mem = ctx.members;
  const other = (i) => (mem.length > 1 ? mem.findIndex((_, k) => k !== i) : -1);
  if (ctx.kind === 'ogiri') return simulateOgiri(ctx, show, o);
  // a power-only rival performs to the clock: its script is timed to fit (skilled acts leave room for laughs)
  if (ctx.npc && ctx.limit) {
    const tot = L.reduce((a, l) => a + l.sec, 0);
    const want = ctx.limit * (0.92 - 0.14 * show.avg('ma') + rng() * 0.06);
    if (tot > 0) for (const l of L) l.sec *= want / tot;
  }
  for (const ln of L) {
    if (ln.resp) continue;
    lineEvents(show, ln, rng, other);
    show.speak(ln);
    if (!ln.punch) continue;
    const resp = ln.respIdx != null ? L[ln.respIdx] : null;
    if (resp) { lineEvents(show, resp, rng, other); show.speak(resp); }
    const by = resp ? resp.who : ln.who;
    let t = show.simTiming(by >= 0 ? by : ctx.playerIdx);
    const r = show.risk(resp || ln);
    if (rng() < r.rush) { t *= 0.72; show.rushed(by >= 0 ? by : ctx.playerIdx); }
    show.laugh(ln, t, { resp });
  }
  return show.finish(o);
}
function lineEvents(show, ln, rng, other) {
  if (ln.who < 0) return;
  const r = show.risk(ln);
  if (rng() < r.kamu) {
    const j = other(ln.who);
    const ad = j >= 0 ? show.stat(j, 'adlib') : show.stat(ln.who, 'adlib') * 0.7;
    const ok = rng() < 0.12 + 0.55 * ad;
    show.flub(ln.who, ok);
    if (ok) show.adlib(true, j >= 0 ? j : ln.who, 0.25 + ad * 0.4);
  }
  if (rng() < r.tobu) {
    const j = other(ln.who);
    const ok = rng() < 0.2 + 0.5 * (j >= 0 ? show.stat(j, 'adlib') : show.stat(ln.who, 'dokyo'));
    show.blank(ln.who, ok);
  }
}
function simulateOgiri(ctx, show, o) {
  const rng = ctx.rng;
  const pi = ctx.playerIdx;
  const n = clamp(Math.round(o.answers || ctx.opts.answers || 4), 2, 8);
  const own = ctx.lines.filter((l) => l.beat === 'answer');
  const hs = show.stat(pi, 'hassou');
  for (let k = 0; k < n; k++) {
    const base = own.length ? own[k % own.length] : null;
    const q = clamp((base && Number.isFinite(base.q) ? base.q : ctx.quality) * 0.45 + hs * 45 + show.stat(pi, 'adlib') * 10 + gauss(rng) * 14, 0, 100);
    const line = { i: k, who: pi, beat: 'answer', text: base ? base.text : '', q };
    show.speak({ sec: 6 });
    show.laugh(line, show.simTiming(pi), { q });
  }
  return show.finish(o);
}
