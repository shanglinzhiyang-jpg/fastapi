// Player progress, constants for the economy, items and save data.

import { fmtMoney } from './util.js';
import { newLifeState } from './life.js';

export const SKILLS = { warai: 'お笑い', engi: '演技', uta: '歌', talk: 'トーク' };
export const SKILL_MAX = 100;

// Fame thresholds -> title shown in the HUD / status.
export const RANKS = [
  [0, '無名'],
  [30, '駆け出し'],
  [100, '若手'],
  [250, '注目株'],
  [500, '人気者'],
  [1000, '売れっ子'],
  [2000, 'スター'],
  [4000, '国民的スター'],
];
export const FINALE_FAME = 4000;

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

export function newState(name = 'ドット', look = null) {
  return {
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
}

const SAVE_KEY = 'dotgeinou_save_v2';

export function saveGame(state, location) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state, location, savedAt: Date.now() }));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
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
    if (!Array.isArray(st.phone.inbox)) st.phone.inbox = [];
    data.state = st;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
