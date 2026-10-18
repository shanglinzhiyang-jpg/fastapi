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
  // life simulation (people, housing, the shopping street, career)
  './world/cooking.js',
  './world/people.js',
  './world/family.js',
  './world/housing.js',
  './world/machi.js',
  './world/career.js',
  './world/programs.js',
  './world/minato.js',
  './engine/politics_ui.js',
  './engine/ideology.js', // ideology core (思想): encyclopedia, player ideology, 思想診断, classifyRegime
  './world/nagatacho.js',
  './world/kanraku.js',
  './world/darkside.js',
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
  './places/ntv.js',
  './places/tbs.js',
  './places/tvasahi.js',
  './places/fujitv.js',
  './places/tvtokyo.js',
  './places/osaka_tv.js',
  './places/kokkai.js',
  './places/kantei.js',
  './places/parties.js',
  './places/kuyakusho.js',
  './places/justice.js',
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
