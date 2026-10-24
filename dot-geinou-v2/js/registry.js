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
  './engine/assist.js', // 政治ナビ（ことは先生）: phone app, glossary, lessons, quiz UI, tips, g.explain / g.navi
  './world/nagatacho.js',
  './world/kanraku.js',
  './world/darkside.js',
  './world/yami.js', // 現代日本の闇: 過労・貧困・孤独死・DV・誹謗中傷・カルト・闇バイト… (after darkside: shares its slot; api: test-output/api_yami.txt)
  // government core (税率・予算・行政・郵政・宗教・野党・世論の声・デモ・支持率) and its 政権交代・総辞職 scenes (api: test-output/api_govt.txt)
  './engine/govt.js',
  './world/seiken.js',
  './engine/phone_apps.js', // phone life apps: マップ, お仕事, 出前, 通販, 銀行, ニュース, カメラ, 設定 (api: test-output/api_phone.txt)
  './engine/phone_apps2.js', // more phone apps: 家計簿, 健康, レシピ, 占い, 音楽, ゲーム, 図鑑, 実績, 電卓 (same api doc)
  './engine/crime_app.js', // crime mode's 裏アプリ (jobs with odds, 手配度★, contacts, stash, laundering, lie low) + HUD ★ + 職務質問 (api: test-output/api_justice.txt)
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
  // regime & security core (体制・自衛隊・震災対応・報道の自由・戦争) and its scenes + phone app 危機管理
  './engine/regime.js',
  './world/kiki.js',
  // 政府中枢 (government console, HD) + political phone apps 世論の声・国会中継・政府中枢 (api: test-output/api_govt_ui.txt)
  './engine/govt_ui.js',
  // world affairs (世界情勢: real countries, blocs, alliances, treaties, summits, sanctions, world events, diplomacy,
  // the routes into a war) + its HD screen and the phone app 世界 (api: test-output/api_world.txt)
  './engine/world.js',
  './engine/world_ui.js',
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
