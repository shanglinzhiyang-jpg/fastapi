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
  // comedy reform (芸能改革): お笑いの土台 (stats, コンビ/トリオ/ピン, 相方 from the net or NSC, 芸歴, 実力不足), 台本 + AI審査員,
  // 芸の実演 (g.perform), the 賞レース framework + every contest, M-1 / KOC / R-1 / ABC in full (api: test-output/api_owarai.txt …)
  './engine/owarai.js',
  './engine/neta.js',
  './engine/perform.js',
  './engine/contests.js',
  './engine/contests_data.js',
  './engine/contests_data2.js',
  './engine/contest_m1.js',
  './engine/contest_koc.js',
  './engine/contest_r1.js',
  './engine/contest_abc.js',
  './engine/contest_ui.js',
  './engine/judges_ai_game.js', // [R11-J] 審査員AI: the judges are agents (taste drift, memory, careers) + the 審査員名鑑 (api: test-output/api_judges.txt)
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
  './engine/clock.js', // 日付・時計・時間帯・天気・朝昼夜 (api: test-output/api_clock.txt)
  './engine/quiz_app.js', // クイズ対策アプリ（ヘキサゴンII・ネプリーグ・短縮鉄道） (api: test-output/api_quiz.txt)
  './engine/phone_apps3.js', // 有能アプリ その3 (api: test-output/api_apps3.txt)
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
  './places/nsc.js', // NSC（吉本総合芸能学院）: classes, classmates, the 相方 you meet there
  './places/shourace.js', // 賞レースの会場 (受付・楽屋・舞台袖・ステージ・決勝スタジオ・屋外ステージ)
  './places/kokkai.js',
  './places/kantei.js',
  './places/parties.js',
  './places/kuyakusho.js',
  './places/justice.js',
  // 自動車免許取得システム [R8-L1]: 教習所（通学・合宿）→ 免許センター → 免許証 (api: test-output/api_license.txt)
  './engine/license.js',
  './engine/license_exam.js',
  './engine/license_card.js',
  './engine/license_flow.js',
  './engine/license_app.js',
  './places/kyoshujo.js',
  './places/menkyo.js',
  './places/gassyuku.js',
  // [R12-S2] 店の中身: the shop interiors of the towns (カラオケ・居酒屋・喫茶・小劇場・ライブハウス・古着・本屋・薬局・銀行・郵便局・交番 …) (api: test-output/api_r12s2.txt)
  './world/shopkit.js',
  './places/shop_civic.js',
  './places/shop_eat.js',
  './places/shop_stage.js',
  './places/shop_cafe.js',
  './places/shop_store.js',
  // [R9-B1] 鉄道ネットワーク: 駅構内 'eki' (券売機・改札・ホーム・路線図・乗車), 駅前の街 (東京 8・大阪 2), 教習所は調布・
  // 免許センターは府中へ (after clock.js: eki.js wraps g.goto for the walk in and out of a station) (api: test-output/api_eki.txt)
  './world/eki.js',
  './world/ekimae_tokyo.js',
  './world/ekimae_osaka.js',
  // regime & security core (体制・自衛隊・震災対応・報道の自由・戦争) and its scenes + phone app 危機管理
  './engine/regime.js',
  './world/kiki.js',
  // 政府中枢 (government console, HD) + political phone apps 世論の声・国会中継・政府中枢 (api: test-output/api_govt_ui.txt)
  './engine/govt_ui.js',
  // world affairs (世界情勢: real countries, blocs, alliances, treaties, summits, sanctions, world events, diplomacy,
  // the routes into a war) + its HD screen and the phone app 世界 (api: test-output/api_world.txt)
  './engine/world.js',
  './engine/world_ui.js',
  // 各界 (stakeholder groups: 観光地・協会・連合・スポーツ・ビジネス・セクト・有識者・アーティスト・文化・研究・政府): the core, then its screens
  // (the 「各界」 tab of the 政府中枢 console) and the phone app 各界 (api: test-output/api_groups.txt)
  './engine/groups.js',
  './engine/groups_ui.js',
  // the advisor mascots 独裁くん (the road to dictatorship and its upkeep) and イクサくん (war coach): phone apps, tips, g.advisor* (api: test-output/api_advisors.txt)
  './engine/advisors.js',
  './engine/bigtext_screens.js', // [R12-U1] 縦画面の「大きな文字」: the lower screen under the game on a portrait phone (engine/bigtext.js; api: test-output/api_r12u1.txt)
  // [R12-L1] 恋愛・結婚・家庭: the phone app 「恋のはなし」 (手帳の「ひとことメモ」): 出会い・デート・告白・同棲・プロポーズ・結婚・子ども・家族アルバム
  // (never mandatory: the player opts in in the app; api: test-output/api_romance.txt). romance_ui.js imports the rest.
  './engine/romance.js',
  './engine/romance_date.js',
  './engine/romance_meet.js',
  './engine/romance_wed.js',
  './engine/romance_kids.js',
  './engine/romance_ui.js',
  // minigames
  './minigames/tsukkomi.js',
  './minigames/zukko.js',
  './minigames/rhythm.js',
  './minigames/command.js',
  './minigames/quiz.js',
  './minigames/announce.js',
  './minigames/talk.js',
  './minigames/manzai.js',
  './minigames/conte.js',
  './minigames/rakugo.js',
  './minigames/ogiri.js',
  './minigames/pinneta.js',
  './minigames/tanshuku.js',
  './minigames/driving.js', // [R8-L2] 運転免許の技能 minigame (api: test-output/api_driving.txt)
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
