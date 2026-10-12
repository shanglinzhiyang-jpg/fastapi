// Every content module registers itself on import (registerPlace / registerMinigame).
// Modules are imported one by one so a broken module cannot take the whole game down.

export const MODULES = [
  // world (towns & basic places)
  './world/tokyo.js',
  './world/namba.js',
  './world/home.js',
  './world/konbini.js',
  './world/station.js',
  './world/misc.js',
  // companies / venues
  './places/yoshimoto.js',
  './places/shinkigeki.js',
  './places/bs_yoshimoto.js',
  './places/shochiku.js',
  './places/grape.js',
  './places/nhk.js',
  './places/toei.js',
  './places/horipro.js',
  './places/toho.js',
  // minigames
  './minigames/tsukkomi.js',
  './minigames/zukko.js',
  './minigames/rhythm.js',
  './minigames/command.js',
  './minigames/quiz.js',
  './minigames/announce.js',
  './minigames/talk.js',
];

export async function loadAll() {
  const failed = [];
  for (const m of MODULES) {
    try {
      await import(m);
    } catch (e) {
      console.error(`[registry] failed to load ${m}:`, e);
      failed.push(m);
    }
  }
  return failed;
}
