// Player progress, constants for the economy, items and save data.

import { fmtMoney } from './util.js';
import { newLifeState } from './life.js';
import { defaultProfile, normalizeProfile, PERSONALITIES } from './profile.js';

export const SKILLS = { warai: 'お笑い', engi: '演技', uta: '歌', talk: 'トーク' };
export const SKILL_MAX = 100;

// Fame thresholds -> title shown in the HUD / status. ★4000 (FINALE_FAME) is the big
// milestone (the NHK year-end show), not the end: the titles above it keep the career
// going. Top-tier jobs bring about ★200-350 each, so a busy day is ★300-1000; the gaps
// grow so each title after the finale takes a few more weeks than the last.
export const RANKS = [
  [0, '無名'],
  [30, '駆け出し'],
  [100, '若手'],
  [250, '注目株'],
  [500, '人気者'],
  [1000, '売れっ子'],
  [2000, 'スター'],
  [4000, '国民的スター'],
  [7000, '大スター'],
  [12000, '大御所'],
  [20000, 'レジェンド'],
  [35000, '芸能界の宝'],
  [60000, '永遠のスター'],
];
export const FINALE_FAME = 4000;

// The next title above fame ([min, name]), or null at the top.
export const nextRank = (fame) => RANKS[rankIndex(fame) + 1] || null;

// Hooks content modules fill in for the engine's screens (they load after the engine):
// CAREER.goals(g) -> [{ label, value, goal, note, done }] for the notebook's もくひょう.
export const CAREER = {};

export function rankIndex(fame) {
  let idx = 0;
  RANKS.forEach(([min], i) => { if (fame >= min) idx = i; });
  return idx;
}
export const rankName = (fame) => RANKS[rankIndex(fame)][1];

// Agencies the player can belong to (one at a time).
// short: compact label for the HUD.
export const AGENCIES = {
  yoshimoto: { name: 'よしもと', short: 'よしもと', skill: 'warai' },
  shochiku: { name: '松竹芸能', short: '松竹芸能', skill: 'warai' },
  grape: { name: 'グレープカンパニー', short: 'グレープ', skill: 'warai' },
  horipro: { name: 'ホリプロ', short: 'ホリプロ', skill: 'engi' },
};

// Job pay depends on the result rank (see RANK_MULT in game.js), so the base
// pay is shown as an estimate. Use this everywhere a job's pay is advertised.
export const payText = (pay) => `ギャラ 目安${fmtMoney(pay)}（出来で変動）`;

// Items. heal = stamina recovered. buff = skill that gets a bonus in the next minigame.
// Places may add their own with registerItem().
export const ITEMS = {
  onigiri: { name: 'おにぎり', price: 150, desc: '体力が15回復する。', heal: 15 },
  bento: { name: 'のり弁当', price: 500, desc: '体力が40回復する。', heal: 40 },
  drink: { name: 'エナジードリンク', price: 300, desc: '体力が30回復する。', heal: 30 },
  takoyaki: { name: 'たこ焼き', price: 400, desc: '体力が35回復する。大阪の味！', heal: 35 },
  nodoame: { name: 'のどあめ', price: 200, desc: '次の「歌」のミニゲームが少しやさしくなる。', buff: 'uta' },
  netacho: { name: 'ネタ帳', price: 250, desc: '次の「お笑い」のミニゲームが少しやさしくなる。', buff: 'warai' },
  daihon: { name: '台本メモ', price: 250, desc: '次の「演技」のミニゲームが少しやさしくなる。', buff: 'engi' },
  wadai: { name: '話題の雑誌', price: 250, desc: '次の「トーク」のミニゲームが少しやさしくなる。', buff: 'talk' },
};
export function registerItem(id, def) { ITEMS[id] = def; }

export const MAX_STAMINA = 100;

// profile: from the character creator (see profile.js). Given, its personality's starting
// skills are added; without one the state gets defaultProfile (tests, old saves).
export function newState(name = 'ドット', look = null, profile = null) {
  const st = {
    version: 2,
    name,
    look,
    money: 3000,
    fame: 0,
    stamina: MAX_STAMINA,
    maxStamina: MAX_STAMINA,
    skills: { warai: 0, engi: 0, uta: 0, talk: 0 },
    day: 1,
    agency: null,
    items: { onigiri: 2 },
    buffs: {},
    flags: {},
    jobs: {}, // job id -> times done
    stats: { jobs: 0, minigames: 0, bestRanks: {} },
    playMinutes: 0,
    ...newLifeState(),
  };
  st.profile = profile ? normalizeProfile(profile, st) : defaultProfile(st);
  if (profile) {
    const bonus = (PERSONALITIES[st.profile.personality] || {}).skills || {};
    for (const [k, v] of Object.entries(bonus)) if (k in st.skills) st.skills[k] += v;
  }
  return st;
}

// ---- storage layer. The browser's localStorage when it works; when it is refused (a file opened from
// a content:// link, a private window, blocked site data: the access throws) or full, the save is kept
// in memory for this page and storageMode() says so, so the game can offer 書き出し (save_io.js).
const mem = new Map();
let lsProbe = null; // the usable Storage, or false once it failed
function ls() {
  if (lsProbe !== null) return lsProbe || null;
  try {
    const s = window.localStorage;
    const k = '__dotgeinou_probe';
    s.setItem(k, '1'); s.removeItem(k);
    lsProbe = s;
  } catch (e) { lsProbe = false; }
  return lsProbe || null;
}
let lastWrite = 'local'; // where the latest write went: 'local' | 'memory'
const kv = {
  get(key) {
    if (mem.has(key)) return mem.get(key);
    const l = ls();
    if (!l) return null;
    try { return l.getItem(key); } catch (e) { return null; }
  },
  set(key, val) { // → 'local' | 'memory'
    const l = ls();
    if (l) {
      try { l.setItem(key, val); mem.delete(key); lastWrite = 'local'; return 'local'; } catch (e) { console.warn('storage write failed', e); }
    }
    mem.set(key, val);
    lastWrite = 'memory';
    return 'memory';
  },
  remove(key) { mem.delete(key); const l = ls(); if (l) { try { l.removeItem(key); } catch (e) { /* ignore */ } } },
};
// 'local' (saves stay in the browser) or 'memory' (they are lost when the page is closed)
export function storageMode() { return ls() && lastWrite === 'local' ? 'local' : 'memory'; }
export const storagePersistent = () => storageMode() === 'local';

const SAVE_KEY = 'dotgeinou_save_v2';
// Three save slots. Slot 1 keeps the old key, so saves from before slots load as slot 1.
// saveGame / loadGame / deleteSave use the current slot (chosen on the title) unless given one.
export const SAVE_SLOTS = 3;
const LAST_SLOT_KEY = 'dotgeinou_lastslot';
const slotKey = (n) => (n === 1 ? SAVE_KEY : `${SAVE_KEY}_s${n}`);
const validSlot = (n) => Number.isInteger(n) && n >= 1 && n <= SAVE_SLOTS;
let currentSlot = 1;
export function saveSlot() { return currentSlot; }
export function setSaveSlot(n) {
  n = Math.floor(Number(n));
  if (!validSlot(n)) return currentSlot;
  currentSlot = n;
  kv.set(LAST_SLOT_KEY, String(n));
  return n;
}
// The slot played last (for the title's つづきから), else the first slot with a save.
export function lastSaveSlot() {
  let n = 0;
  n = Math.floor(Number(kv.get(LAST_SLOT_KEY)));
  if (validSlot(n) && hasSave(n)) return n;
  for (let i = 1; i <= SAVE_SLOTS; i++) if (hasSave(i)) return i;
  return 1;
}
// A short summary of a slot without the full load (title / slot list): null when empty or broken.
export function saveSummary(n = currentSlot) {
  try {
    const raw = kv.get(slotKey(n));
    if (!raw) return null;
    const data = JSON.parse(raw);
    const st = data && data.state;
    if (!st) return null;
    const pr = st.profile || {};
    const name = pr.familyName || pr.givenName ? `${pr.familyName || ''} ${pr.givenName || ''}`.trim() : st.name || '？？？';
    return { slot: n, name, day: Math.max(1, Math.floor(Number(st.day) || 1)), fame: Math.max(0, Math.floor(Number(st.fame) || 0)), era: pr.era || null, savedAt: Number(data.savedAt) || 0 };
  } catch (e) {
    return null;
  }
}

// true when the save is kept (in the browser, or at least in memory: see storageMode()); false when the
// state could not be turned into text at all.
export function saveGame(state, location, n = currentSlot) {
  try {
    kv.set(slotKey(validSlot(n) ? n : currentSlot), JSON.stringify({ state, location, savedAt: Date.now(), slot: n }));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

export function loadGame(n = currentSlot) {
  try {
    const raw = kv.get(slotKey(validSlot(n) ? n : currentSlot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.state) return null;
    // merge nested objects too, so an older / partial save never lacks a field the engine reads
    const def = newState();
    const st = { ...def, ...data.state };
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    st.skills = { ...def.skills, ...obj(data.state.skills) };
    st.stats = { ...def.stats, ...obj(data.state.stats) };
    st.stats.bestRanks = { ...obj(st.stats.bestRanks) };
    for (const k of ['items', 'buffs', 'flags', 'jobs', 'furniture', 'people', 'regulars']) st[k] = { ...obj(k in data.state ? data.state[k] : def[k]) };
    for (const k of ['life', 'rent', 'phone']) st[k] = { ...def[k], ...obj(data.state[k]) };
    normalize(st, def);
    // saves from before the character creator had profiles: the name becomes the given name
    st.profile = data.state.profile ? normalizeProfile(data.state.profile, st) : defaultProfile(st);
    data.state = st;
    return data;
  } catch (e) {
    return null;
  }
}

// Records inside the merged objects (one person, one show, one message) from early
// builds, other versions or hand edits: numbers that are numbers, nothing undefined.
function normalize(st, def) {
  const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  for (const k of ['money', 'fame', 'fans', 'playMinutes']) st[k] = Math.max(0, num(st[k], def[k] || 0));
  st.day = Math.max(1, Math.floor(num(st.day, 1)));
  st.maxStamina = Math.max(1, num(st.maxStamina, def.maxStamina));
  st.stamina = Math.min(st.maxStamina, Math.max(0, num(st.stamina, st.maxStamina)));
  for (const k of Object.keys(def.skills)) st.skills[k] = Math.max(0, num(st.skills[k]));
  for (const k of ['hunger', 'stress', 'clean']) st.life[k] = Math.min(100, Math.max(0, num(st.life[k], def.life[k])));
  st.life.steps = num(st.life.steps);
  for (const k of ['paidWeek', 'debt', 'late']) st.rent[k] = Math.max(0, num(st.rent[k], def.rent[k]));
  for (const id of Object.keys(st.people)) {
    const p = obj(st.people[id]);
    st.people[id] = { ...p, aff: Math.min(100, Math.max(0, num(p.aff))), met: num(p.met, st.day), talkDay: num(p.talkDay), giftDay: num(p.giftDay), hangDay: num(p.hangDay), seen: { ...obj(p.seen) } };
  }
  for (const id of Object.keys(st.regulars)) {
    const r = obj(st.regulars[id]);
    const out = { ...r, doneWeek: num(r.doneWeek), missed: num(r.missed), count: num(r.count) };
    // a show held (not declined / dropped) always has its start day
    if (r.since != null || (!r.dropped && !r.declined)) out.since = num(r.since, st.day);
    st.regulars[id] = out;
  }
  const ph = st.phone;
  const inbox = (Array.isArray(ph.inbox) ? ph.inbox : []).filter((m) => m && typeof m === 'object' && !Array.isArray(m));
  let next = Math.max(1, num(ph.nextId, 1));
  const ids = new Set();
  ph.inbox = inbox.map((m) => {
    let id = num(m.id, -1);
    if (id < 1 || ids.has(id)) id = next++;
    ids.add(id);
    return { ...m, id, day: Math.max(1, num(m.day, st.day)), text: String(m.text ?? ''), from: String(m.from || ''), read: m.read !== false };
  });
  ph.nextId = Math.max(next, ...[...ids].map((i) => i + 1), 1);
  ph.lastPost = num(ph.lastPost);
  ph.posts = num(ph.posts);
}

// hasSave(n): that slot has a save; hasSave(): any slot has one.
export function hasSave(n) {
  try {
    if (n === undefined) { for (let i = 1; i <= SAVE_SLOTS; i++) if (kv.get(slotKey(i))) return true; return false; }
    return validSlot(n) && !!kv.get(slotKey(n));
  } catch (e) { return false; }
}

export function deleteSave(n = currentSlot) {
  if (validSlot(n)) kv.remove(slotKey(n));
}

// ---- 書き出し / 読み込み (save_io.js): a slot as text, and text back into a slot.
export function exportSaveText(n = currentSlot) {
  const raw = kv.get(slotKey(validSlot(n) ? n : currentSlot));
  return raw || null;
}
// Checks the text is a save of this game, then puts it in slot n. → { ok, error?, summary? }
export function importSaveText(text, n = currentSlot) {
  if (!validSlot(n)) return { ok: false, error: 'スロットがちがいます' };
  let data;
  try { data = JSON.parse(String(text).trim()); } catch (e) { return { ok: false, error: 'セーブデータとして読めませんでした' }; }
  if (!data || typeof data !== 'object' || !data.state || typeof data.state !== 'object' || !data.state.profile) return { ok: false, error: 'このゲームのセーブデータではないようです' };
  kv.set(slotKey(n), JSON.stringify({ ...data, slot: n, savedAt: Number(data.savedAt) || Date.now() }));
  const sm = saveSummary(n);
  return sm ? { ok: true, summary: sm } : { ok: false, error: 'セーブデータを読み込めませんでした' };
}
