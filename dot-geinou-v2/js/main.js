// Boot: load assets & content, then show the title screen.
//
// URL parameters (for development / tests):
//   ?test=1                         skip the title with a fresh save (no intro)
//   ?test=1&place=nhk&room=lobby    start inside a place (x, y, dir optional)
//   ?minigame=quiz&difficulty=3     play one minigame repeatedly
//   ?rich=1                         lots of money / fame / skills (with test=1)
//   ?debug=1                        adds a debug entry to the pause menu

import { Game } from './engine/game.js';
import { loadLogos } from './engine/logos.js';
import { loadAll } from './registry.js';
import { newState, loadGame, hasSave, deleteSave, AGENCIES, SAVE_SLOTS, saveSummary, setSaveSlot, lastSaveSlot } from './engine/state.js';
import { PLACES } from './engine/map.js';
import { MINIGAMES } from './engine/minigame.js';
import { saveIOMenu } from './engine/save_io.js';
import { TitleScene, CreateScene, EraIntroScene, drawTitleBackdrop } from './title.js';
import { onMorning, PEOPLE } from './engine/life.js';
import { rememberSettings, applySettings } from './engine/phone_apps.js'; // 設定 are kept in the save
import { ageOf, eraOf, isBirthday, birthdayFlag, sortFamily, RELATIONS, regionOf, familyLook } from './engine/profile.js';
import { SW, SH, hash2 } from './engine/util.js';
import { text, panel, measure, COLORS } from './engine/draw.js';
import { audio } from './engine/audio.js';
import * as ui from './engine/ui.js';
import { TILES } from './engine/tiles.js';

const params = new URLSearchParams(location.search);

// Plain HD backdrop with an optional message: 'よみこみ中…' at boot (with bouncing
// dots), an empty base under dialogs, or an error ({ error: true, detail }).
// opts.title: the dimmed title backdrop instead of the starfield (title-flow dialogs).
function loadingScene(msg, opts = {}) {
  return {
    opaque: true,
    hd: true,
    t: 0,
    update() { this.t++; },
    draw(ctx) {
      const t = this.t;
      let drawn = false;
      if (opts.title) {
        try { drawTitleBackdrop(ctx, t + 500); drawn = true; } catch (e) { drawn = false; }
      }
      if (!drawn) {
        ctx.fillStyle = '#0b0d1a';
        ctx.fillRect(0, 0, SW, SH);
        for (let i = 0; i < 60; i++) {
          if ((i * 7 + Math.floor(t / 12)) % 17 === 0) continue;
          ctx.fillStyle = i % 5 ? '#2a3366' : '#5a64a8';
          ctx.fillRect(Math.floor(hash2(i, 1, 9) * SW), Math.floor(hash2(i, 2, 9) * SH), 1, 1);
        }
      }
      if (!msg) return;
      if (opts.error) {
        const lines = [msg, opts.detail].filter(Boolean);
        const w = Math.min(SW - 40, 64 + Math.max(...lines.map((l, i) => measure(ctx, l, i ? 13 : 16))));
        const h = 34 + lines.length * 24;
        panel(ctx, Math.round((SW - w) / 2), Math.round((SH - h) / 2), w, h, { bg: '#3a1424' });
        lines.forEach((l, i) => text(ctx, l, SW / 2, (SH - h) / 2 + 17 + i * 24, { size: i ? 13 : 16, align: 'center', color: i ? '#f0c8d0' : COLORS.bad }));
        return;
      }
      text(ctx, msg, SW / 2, SH / 2 - 14, { size: 16, align: 'center', color: '#ffffff' });
      for (let i = 0; i < 3; i++) {
        const hop = Math.floor(t / 8 + 6 - i * 2) % 6 === 0 ? 3 : 0;
        ctx.fillStyle = [COLORS.pink, COLORS.accent, COLORS.cyan][i];
        ctx.fillRect(SW / 2 - 14 + i * 12, SH / 2 + 14 - hop, 4, 4);
      }
    },
  };
}

function showBootError(g, msg, detail) {
  try { if (g) g.setBase(loadingScene(msg, { error: true, detail })); } catch (e) { /* nothing left to show it with */ }
}

function richState(st) {
  st.money = 999999;
  st.fame = 2500;
  st.skills = { warai: 60, engi: 60, uta: 60, talk: 60 };
  st.items = { drink: 5, bento: 3, nodoame: 2 };
  return st;
}

async function newGame(g) {
  const res = await new Promise((r) => g.push(new CreateScene(g, r)));
  g.state = newState(res.name, res.look, res.profile);
  // a short card about the era and who you are, then the room
  g.setBase(loadingScene('', { title: true }));
  await new Promise((r) => g.push(new EraIntroScene(g, g.state.profile, r)));
  await g.goto('home', 'room', 4, 6, 'up');
}

// Birthdays (profile.js: the age goes up every YEAR_DAYS days). Registered in boot() after
// the two cores and before the content modules load, so it runs after the cores' morning
// hooks (as before) and before the content's: it sets flags['birthday_<age>'] (family.js
// reads it to skip a second birthday message), shows a toast and a morning note (at 20, 25
// and 30 also what the new age opens up), and sends one message from a family member who is alive.
function birthdayHook(g) {
  const st = g.state;
  if (!st || !st.profile || !isBirthday(st)) return;
  const age = ageOf(st);
  const key = birthdayFlag(age);
  if (st.flags[key]) return;
  st.flags[key] = true;
  g.notify(`今日は誕生日！${age}さいになった！`, { color: COLORS.pink, life: 200 });
  const notes = g.morningNotes || (g.morningNotes = []);
  notes.push(`（今日は誕生日！${age}さいになった）`);
  // 被選挙権 (公職選挙法10条): 25 for 区議・区長・都議・衆議院, 30 for 参議院・知事 — the same in every era
  if (age === 20) notes.push('（20さいになった。法律では、お酒とタバコは20さいから）');
  if ((age === 25 || age === 30) && typeof g.pol === 'function') {
    let ban = null;
    try { ban = typeof g.civicBanReason === 'function' ? g.civicBanReason('candidacy') : null; } catch (e) { ban = null; }
    const app = `${eraOf(st).deviceShort || 'スマホ'}の「政治」`;
    if (ban) notes.push(`（${age}さいになった。ただ、いまは立候補できない：${ban}）`);
    else if (age === 25) notes.push(`（25さいになった。区議・区長・都議・衆議院の選挙に立候補できる！${app}→選挙から）`);
    else notes.push(`（30さいになった。参議院と知事の選挙にも立候補できる！${app}→選挙から）`);
  }
  const fam = sortFamily((st.profile.family || []).filter((m) => m && m.alive !== false && RELATIONS[m.rel]));
  const m = fam.find((x) => x.rel === 'mother') || fam.find((x) => x.rel === 'father') || fam[0];
  if (!m) return;
  const kansai = regionOf(st.profile.hometown).dialect === 'kansai';
  const younger = !RELATIONS[m.rel].older;
  const text = younger
    ? (kansai ? `{name}、誕生日おめでとう！もう${age}さいなんや。\nテレビで見るの、いつも楽しみにしてるで！` : `{name}、誕生日おめでとう！もう${age}さいだね。\nテレビで見るの、いつも楽しみにしてるよ！`)
    : (kansai ? `{name}、誕生日おめでとう。もう${age}さいかぁ。\n体に気ぃつけて、お仕事がんばりや。いつでも帰っておいで。` : `{name}、誕生日おめでとう。もう${age}さいなんだね。\n体に気をつけて、お仕事がんばってね。いつでも帰っておいで。`);
  g.message({ from: PEOPLE[m.id] ? PEOPLE[m.id].name : `${RELATIONS[m.rel].call}`, person: PEOPLE[m.id] ? m.id : undefined, family: m.id, look: PEOPLE[m.id] ? PEOPLE[m.id].look : familyLook(m, st.look), kind: 'chat', text: g.fmt(text) });
}

// The two cores, loaded optionally (game.js does not import them): crime.js (justice, debts;
// it reads politics.js through a guarded import(), so either core may be missing) and politics.js. A core that 404s, fails to parse or throws
// is left out and the game boots without it — every other module reads them guarded
// (notebook, ui, places through registry.js). Installed in this order: politics wraps job()
// over justice's wrapper. Returns the paths that failed (added to g.failedModules).
async function loadCores() {
  const failed = [];
  // literal import() paths, so a bundler can include the cores in a single-file build
  const cores = [
    ['./engine/crime.js', 'installJustice', () => import('./engine/crime.js')],
    ['./engine/politics.js', 'installPolitics', () => import('./engine/politics.js')],
  ];
  for (const [path, fn, load] of cores) {
    try {
      const mod = await load();
      mod[fn](Game.prototype);
    } catch (e) {
      console.error(`[core] failed to load ${path}:`, e);
      failed.push(path);
    }
  }
  return failed;
}

// The three save slots on the title: 'load' picks a slot with a save, 'new' picks where a
// new game is saved (an occupied slot asks before it is overwritten). Returns the slot or 0.
function slotLine(n) {
  const s = saveSummary(n);
  if (!s) return `スロット${n}　（空き）`;
  const d = s.savedAt ? new Date(s.savedAt) : null;
  const when = d ? `　${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  return `スロット${n}　${s.name}・${s.day}日目・★${s.fame}${when}`;
}
async function pickSlot(g, mode) {
  g.setBase(loadingScene('', { title: true }));
  for (;;) {
    const items = [];
    for (let n = 1; n <= SAVE_SLOTS; n++) items.push(slotLine(n));
    if (mode === 'load') items.push('ファイル・テキストから読み込む');
    items.push('もどる');
    const W = 440;
    const back = items.length - 1;
    const i = await g.list({ title: mode === 'load' ? 'どのセーブデータで遊びますか？' : 'どのスロットに記録しますか？', items, x: Math.round((SW - W) / 2), y: 96, w: W, px: true, cancel: back, index: mode === 'load' ? lastSaveSlot() - 1 : 0 });
    if (i < 0 || i === back) return 0;
    if (i >= SAVE_SLOTS) { // 読み込み: a file or pasted text goes into a slot, which then loads
      const n = await saveIOMenu(g, { fromTitle: true });
      if (n) return n;
      continue;
    }
    const n = i + 1;
    if (mode === 'load') {
      if (!hasSave(n)) { await g.say('このスロットには、セーブデータがありません。'); continue; }
      return n;
    }
    if (hasSave(n)) {
      const k = await g.ask(`スロット${n}にはセーブデータがあります。\nはじめから遊ぶと上書きされます。いいですか？`, ['上書きして はじめる', 'えらびなおす'], { cancel: 1 });
      if (k !== 0) continue;
      deleteSave(n);
    }
    return n;
  }
}

async function titleFlow(g) {
  for (;;) {
    g.setBase(new TitleScene(g, () => {}));
    const choice = await new Promise((r) => { g.scenes[0].resolve = r; });
    if (choice === 'continue') {
      const slot = await pickSlot(g, 'load');
      if (!slot) continue;
      setSaveSlot(slot);
      const data = loadGame(slot);
      if (data && data.state) {
        g.state = data.state;
        try { applySettings(g); } catch (e) { /* settings are a convenience */ }
        const L = data.location;
        if (L && PLACES[L.place]) {
          const was = { min: data.state.clock && data.state.clock.min, day: data.state.day };
          g._clkAnim = null;
          await g.goto(L.place, L.room, L.x, L.y, L.dir || 'down');
          // the moment of the save, exactly: the time of day (the weather follows the day, the region and the save's seed), and the spot
          try {
            const c = g.state.clock;
            if (c && was.min != null && g.state.day === was.day) { c.min = was.min; }
            g._clkAnim = null;
          } catch (e) { /* ignore */ }
          g.notify('つづきから再開しました', { color: '#fff' });
          return;
        }
        // the saved place is gone (its module failed to load, or a place was renamed):
        // the state itself is fine, so wake up at home instead of refusing the save
        let h = null;
        try { h = g.housing(); } catch (e) { h = null; }
        const home = h && PLACES[h.place] ? h : null;
        const place = home ? home.place : PLACES.home ? 'home' : PLACES.tokyo ? 'tokyo' : Object.keys(PLACES)[0];
        if (place) {
          await g.goto(place, home ? home.room : undefined);
          g.notify('前にいた場所が読み込めなかったので、家から再開します', { color: '#fff', life: 240 });
          return;
        }
      }
      g.setBase(loadingScene('', { title: true }));
      await g.say('セーブデータを読み込めませんでした。');
      continue;
    }
    const slot = await pickSlot(g, 'new');
    if (!slot) continue;
    setSaveSlot(slot);
    await newGame(g);
    return;
  }
}

async function minigameLab(g, id) {
  g.state = newState('テスト');
  g.setBase(loadingScene(''));
  for (;;) {
    const res = await g.minigame(id, { difficulty: +(params.get('difficulty') || 1), skill: params.get('skill') || undefined });
    window.__lastResult = res;
    await g.say(`結果：${JSON.stringify(res)}\nもう一度あそびます。`);
  }
}

async function debugMenu(g) {
  const ids = Object.keys(PLACES);
  const i = await g.list({ title: 'デバッグ', items: ['場所へワープ', 'お金+10万', '知名度+500', 'スキル+20', '体力全快', '所属を変える', '政治（デバッグ）', '司法・借金（デバッグ）', '政府中枢（デバッグ）'], x: 8, y: 8, w: 160 });
  if (i === 6 && typeof g.pol === 'function') { await politicsDebug(g); return; }
  if (i === 7 && typeof g.jus === 'function') { await justiceDebug(g); return; }
  if (i === 8 && typeof g.pol === 'function') { await govtDebug(g); return; }
  const st = g.state;
  if (i === 0) {
    const j = await g.list({ title: 'ワープ先', items: ids, x: 8, y: 8, w: 200 });
    if (j >= 0) await g.enterPlace(ids[j]);
  } else if (i === 1) g.addMoney(100000);
  else if (i === 2) g.addFame(500);
  else if (i === 3) for (const k of Object.keys(st.skills)) g.addSkill(k, 20);
  else if (i === 4) st.stamina = st.maxStamina;
  else if (i === 5) {
    const ag = [null, ...Object.keys(AGENCIES)];
    const j = await g.list({ title: '所属', items: ag.map((a) => (a ? AGENCIES[a].name : 'フリー')), x: 8, y: 8, w: 200 });
    if (j >= 0) st.agency = ag[j];
  }
}

// Justice debug (js/engine/crime.js): crimes caught on the spot or found out later, loans, debt relief,
// smoking, the status, and nights passing (each night runs the morning and the queued justice events).
async function justiceDebug(g) {
  const acts = [
    ['万引き（捕まる）', () => g.commitCrime('shoplifting', { amount: 800, forceCaught: true })],
    ['強盗（捕まる）', () => g.commitCrime('robbery', { amount: 50000, forceCaught: true })],
    ['暴行（あとで発覚）', async () => { await g.commitCrime('assault', { neverCaught: true }); await g.investigate('assault', { now: true }); }],
    ['収賄（逮捕状）', () => g.arrest('bribery_take', { amount: 10000000, via: 'warrant' })],
    ['脱税（税務調査）', async () => { await g.commitCrime('tax_evasion', { amount: 3000000, neverCaught: true }); await g.investigate('tax_evasion', { now: true }); }],
    ['反社交際（週刊誌）', async () => { await g.commitCrime('antisocial_ties', { neverCaught: true }); await g.investigate('antisocial_ties', { now: true }); }],
    ['消費者金融で借りる', () => g.loanCounter('shohisha')],
    ['闇金で借りる', () => g.loanCounter('yamikin')],
    ['法律相談（借金）', () => g.consultLawyer('debt')],
    ['自己破産', () => g.fileBankruptcy({ force: true })],
    ['タバコを買って吸う', async () => { const r = g.buyCigarettes(1); if (!r.ok) await g.say(r.reason); else await g.smoke(); }],
    ['状態を見る', () => g.say(g.justiceLines().join('\n'))],
    ['10日すすめる（寝る）', async () => { for (let k = 0; k < 10; k++) await g.sleep({ notes: false }); }],
  ];
  const k = await g.list({ title: '司法・借金（デバッグ）', items: acts.map((a) => a[0]), x: 8, y: 8, w: 200 });
  if (k >= 0) await acts[k][1]();
}

// Politics debug (js/engine/politics.js): the text menu, a quick start as a politician,
// fast-forwarding the political calendar, and a few events.
async function politicsDebug(g) {
  const items = ['政治メニュー', '30歳・資金1億円', '衆院議員にする（自民）', '総理大臣にする', '30日すすめる', '衆院を解散', '大地震（ショック）'];
  const i = await g.list({ title: '政治（デバッグ）', items, x: 8, y: 8, w: 180 });
  const st = g.state;
  const p = g.pol();
  if (i === 0) await g.politicsMenu();
  else if (i === 1) { st.profile.age = Math.max(st.profile.age, 30 - Math.floor((st.day - 1) / 120)); g.addMoney(100000000); p.me.funds += 10000000; }
  else if (i === 2) {
    if (p.parties.jimin && p.me.party !== 'jimin') g.joinParty('jimin');
    if (p.me.office !== 'shugi') {
      p.me.office = 'shugi'; p.me.district = '東京ドット区'; p.me.termEnd = st.day + 480; p.me.wins++; p.me.nationalWins += 3; p.me.standing = 80; p.me.prElected = null;
      p.diet.shugi.seats[p.me.party || 'ind'] = (p.diet.shugi.seats[p.me.party || 'ind'] || 0) + 1; p.diet.shugi.total++;
      // the player is now the district's sitting member (現職)
      (p.flags.smdHolders || (p.flags.smdHolders = {})).home = { party: p.me.party || 'ind', npc: 'player', open: false };
      p.flags.homeIncumbent = 'player';
    }
    g.notify('衆議院議員になった（デバッグ）', { color: '#fff' });
  } else if (i === 3) {
    const pt = p.parties[p.me.party];
    // 憲法67条: the PM is a Diet member
    if (pt && (p.me.office === 'shugi' || p.me.office === 'sangi')) { pt.leader = 'player'; p.flags.skipPlayerPM = false; if (!p.me.posts.includes('party_leader')) p.me.posts.push('party_leader'); const r = g.electPM(); g.notify(`首班指名：${r.name}`, { color: '#fff' }); }
    else g.notify('先に「衆院議員にする」（総理は国会議員から）', { color: '#fff' });
  } else if (i === 4) {
    for (let k = 0; k < 30; k++) { st.day++; await g.politicsTick(); }
    g.notify(`${g.polDate().label} になった`, { color: '#fff' });
  } else if (i === 5) {
    const was = p.cabinet.pm;
    p.cabinet.pm = 'player';
    const id = g.dissolve('デバッグ');
    p.cabinet.pm = was;
    g.notify(id ? '衆議院を解散した' : g.lastPoliticsError, { color: '#fff' });
  } else if (i === 6) g.triggerShock('quake');
}

// Government console debug (js/engine/govt_ui.js): jump to test states — the PM in each era, a minister, a session,
// a fictional disaster, the emergency regime and the dictatorship at war (the regime path).
// The era jump starts the political world of that era anew (politics / regime / govt / justice states are rebuilt).
function debugEra(g, era) {
  const st = g.state;
  st.profile.era = era;
  for (const k of ['politics', 'regime', 'govt', 'justice']) delete st[k];
  if (st.flags.polui) st.flags.polui.eco = [];
  if (st.flags.govtui) st.flags.govtui.def = [];
  st.day = 40;
  st.profile.age = Math.max(st.profile.age, 40);
  g.pol();
}
// the player becomes a 衆院議員, the leader of `party` ('own' = a new fictional party) with `share` of both houses, and PM
function debugPM(g, party = 'jimin', share = 0.62) {
  const st = g.state, p = g.pol();
  st.money += 300000000; p.me.funds += 50000000; st.fame = Math.max(st.fame, 2000);
  if (p.me.office !== 'shugi') {
    p.me.office = 'shugi'; p.me.district = '東京ドット区'; p.me.termEnd = st.day + 480; p.me.wins = Math.max(3, p.me.wins); p.me.nationalWins = Math.max(3, p.me.nationalWins); p.me.standing = 90; p.me.prElected = null;
    p.diet.shugi.seats.ind = (p.diet.shugi.seats.ind || 0) + 1; p.diet.shugi.total++;
  }
  let id = party;
  if (party === 'own') {
    id = p.me.party && p.parties[p.me.party] && !p.parties[p.me.party].real && p.parties[p.me.party].leader === 'player' ? p.me.party
      : g.foundParty({ name: 'みらい改革党', short: 'みらい', color: '#3a8a6a', platform: ['defense_up', 'disaster_prep'] });
    if (!id) { g.notify(g.lastPoliticsError || '党をつくれなかった', { color: '#fff' }); return null; }
  } else if (p.me.party !== party && p.parties[party]) { const w = g.joinParty(party); if (w) { g.notify(w, { color: '#fff' }); return null; } }
  if (!p.parties[id]) return null;
  for (const house of ['shugi', 'sangi']) {
    const H = p.diet[house];
    const want = Math.round(H.total * share);
    let have = H.seats[id] || 0;
    for (const k of Object.keys(H.seats).sort((a, b) => H.seats[b] - H.seats[a])) { if (k === id) continue; while (have < want && H.seats[k] > 0) { H.seats[k]--; have++; } }
    H.seats[id] = have;
  }
  p.parties[id].leader = 'player';
  if (!p.me.posts.includes('party_leader')) p.me.posts.push('party_leader');
  p.flags.skipPlayerPM = false;
  g.electPM();
  // (2026-10 fix) the moved seats: ねじれ and the approval's parts recomputed by a poll taken now (testers are not misled
  // by the last poll's numbers); the era jump has no poll yet otherwise (支持なし 0%)
  if (typeof g.politicsPollNow === 'function') g.politicsPollNow();
  else { const n = (H) => (p.cabinet.partyIds || []).reduce((a, q) => a + (H.seats[q] || 0), 0); p.flags.nejire = n(p.diet.shugi) > p.diet.shugi.total / 2 && n(p.diet.sangi) <= p.diet.sangi.total / 2; }
  return id;
}
function debugSession(g) { const p = g.pol(); if (!p.diet.session) p.diet.session = { kind: '臨時国会', start: g.state.day, end: g.state.day + 30 }; }
function debugEmergency(g) {
  if (typeof g.regime !== 'function') return false;
  // already the PM of a fictional party the player leads: keep that cabinet (no new 首班指名 → no cheerful 組閣 scene)
  const p0 = g.pol(), mine = p0.parties[p0.me.party];
  if (!(p0.cabinet.pm === 'player' && mine && !mine.real && mine.leader === 'player')) debugPM(g, 'own', 0.75);
  // the 組閣 scene of the debug's own 首班指名 would play the next night inside the emergency: dropped
  try { const s = typeof g.govt === 'function' ? g.govt() : null; if (s && s.seiken && Array.isArray(s.seiken.queue)) s.seiken.queue.length = 0; } catch (e) { console.error(e); }
  debugSession(g);
  const r = g.state.regime;
  if (r && r.id === 'democracy') { r.steps.clause = true; r.steps.clauseDay = g.state.day; }
  const res = g.regimeStep('declare_emergency');
  if (!res.ok) g.notify(res.why, { color: '#fff' });
  return g.regime().id !== 'democracy';
}
async function govtDebug(g) {
  const items = ['政府中枢を開く', '総理（昭和1987）', '総理（平成初期1996）', '総理（平成2004）', '総理（令和2026）', '新党の総理（いまの時代）', '財務大臣にする', '防衛大臣にする', '国会を開く（30日）', '大地震（東京）', '緊急事態体制', '独裁・戦争'];
  const i = await g.list({ title: '政府中枢（デバッグ）', items, x: 8, y: 8, w: 220 });
  if (i < 0) return;
  const open = (tab) => (typeof g.govtConsole === 'function' ? g.govtConsole(tab) : null);
  if (i === 0) { await open('overview'); return; }
  if (i >= 1 && i <= 4) { debugEra(g, ['showa', 'heisei_early', 'heisei', 'reiwa'][i - 1]); debugPM(g, 'jimin'); debugSession(g); await open('overview'); return; }
  if (i === 5) { debugPM(g, 'own', 0.7); debugSession(g); await open('overview'); return; }
  if (i === 6 || i === 7) {
    const p = g.pol();
    if (p.cabinet.pm === 'player') { g.notify('いまは総理大臣（大臣にするのは、総理でないときだけ）', { color: '#fff' }); return; }
    if (p.me.office !== 'shugi' && p.me.office !== 'sangi') {
      // a 衆院議員 of the ruling core party
      const core = (p.cabinet.partyIds || [])[0];
      if (core && p.me.party !== core) { g.state.money += 100000; g.joinParty(core); }
      p.me.office = 'shugi'; p.me.district = '東京ドット区'; p.me.termEnd = g.state.day + 480; p.me.wins = Math.max(3, p.me.wins); p.me.standing = 80; p.me.prElected = null;
      p.diet.shugi.seats[p.me.party || 'ind'] = (p.diet.shugi.seats[p.me.party || 'ind'] || 0) + 1; p.diet.shugi.total++;
    }
    const post = i === 6 ? 'minister_finance' : 'minister_defense';
    const was = p.cabinet.ministers[post];
    if (was && p.npcs[was]) p.npcs[was].posts = (p.npcs[was].posts || []).filter((x) => x !== post);
    p.cabinet.ministers[post] = 'player';
    if (!p.me.posts.includes(post)) p.me.posts.push(post);
    await open(i === 6 ? 'budget' : 'security');
    return;
  }
  if (i === 8) { debugSession(g); g.notify('臨時国会を開いた（デバッグ）', { color: '#fff' }); return; }
  if (i === 9) { if (typeof g.startDisaster === 'function') g.startDisaster({ kind: 'quake', place: 'dotwan', tier: 3 }); await open('crisis'); return; }
  if (i === 10) { debugEmergency(g); await open('crisis'); return; }
  if (i === 11) {
    if (!debugEmergency(g)) return;
    for (const k of ['suspend_elections', 'suspend_diet', 'national_army']) { const r = g.regimeStep(k); if (!r.ok) g.notify(r.why, { color: '#fff' }); }
    const w = g.warOrder('declare', { target: 'nevalon' });
    if (!w.ok) g.notify(w.why, { color: '#fff' });
    await open('security');
  }
}

// Touch devices: block what CSS (touch-action / user-select) cannot. iOS Safari
// ignores user-scalable=no, so cancel its pinch gestures and multi-finger moves
// (pointer events for the pad still fire), and long-press menus on the pad.
// Desktop (no body.touch) keeps trackpad / browser zoom.
function guardTouch() {
  const touch = () => document.body.classList.contains('touch');
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => { if (touch()) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && e.cancelable && touch()) e.preventDefault(); }, { passive: false });
  document.getElementById('pad').addEventListener('contextmenu', (e) => e.preventDefault());
}

// Small fullscreen toggle on the pad (CSS shows it only with body.fs-ok, and
// the pad itself only on touch devices). Skipped where the API is missing
// (e.g. iPhone Safari).
function setupFullscreen(g) {
  const btn = document.getElementById('fs');
  const root = document.documentElement;
  const canRequest = root.requestFullscreen || root.webkitRequestFullscreen;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!btn || !canRequest || !exit || !(document.fullscreenEnabled || document.webkitFullscreenEnabled)) return;
  const current = () => document.fullscreenElement || document.webkitFullscreenElement;
  const sync = () => {
    const on = !!current();
    document.body.classList.toggle('fullscreen', on);
    btn.setAttribute('aria-label', on ? '全画面を終了' : '全画面');
    btn.setAttribute('aria-pressed', String(on));
  };
  btn.addEventListener('pointerdown', (e) => e.preventDefault()); // no focus, no text selection
  btn.addEventListener('click', () => {
    btn.blur();
    try {
      const p = current() ? exit.call(document)
        : root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* refused: stay as is */ }
  });
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
    document.addEventListener(ev, () => { sync(); g.resize(); setTimeout(() => g.resize(), 250); });
  }
  sync();
  document.body.classList.add('fs-ok');
}

// Portrait phones: a hint to turn the phone (CSS shows it), dismissed by a tap for
// the rest of the session.
function setupRotateHint(g) {
  const el = document.getElementById('rotate');
  if (!el) return;
  let off = false;
  try { off = sessionStorage.getItem('dotgeinou_rotate_off') === '1'; } catch (e) { off = false; }
  const hide = () => {
    document.body.classList.add('rotate-off');
    try { sessionStorage.setItem('dotgeinou_rotate_off', '1'); } catch (e) { /* private mode */ }
    g.resize();
    setTimeout(() => g.resize(), 50);
  };
  if (off) document.body.classList.add('rotate-off');
  el.addEventListener('click', hide);
  // turning the phone counts as having read it
  window.addEventListener('orientationchange', () => setTimeout(() => { if (window.matchMedia('(orientation: landscape)').matches) hide(); }, 300));
}

async function boot() {
  const canvas = document.getElementById('game');
  // On-screen pad: phones/tablets (coarse primary pointer) get it from the start.
  // Touchscreen laptops get it on their first touch and lose it again on a key press.
  const coarse = window.matchMedia('(pointer: coarse)').matches || params.has('touch');
  if (coarse) document.body.classList.add('touch');
  const g = new Game(canvas);
  g.beforeSave = () => rememberSettings(g);
  if (!coarse) {
    const setTouch = (on) => {
      if (document.body.classList.contains('touch') === on) return;
      document.body.classList.toggle('touch', on);
      g.resize();
    };
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') setTouch(true); }, true);
    window.addEventListener('keydown', () => setTouch(false), true);
  }
  window.__game = g;
  g.PLACES = PLACES;
  g.MINIGAMES = MINIGAMES;
  g.TILES = TILES;
  g.newState = newState;
  g.input.bindTouch({
    dpad: document.getElementById('dpad'),
    buttons: Array.from(document.querySelectorAll('#pad button[data-k]')),
    screen: canvas,
  });
  guardTouch();
  setupFullscreen(g);
  setupRotateHint(g);
  g.setBase(loadingScene('よみこみ中…'));
  g.start();
  try {
    await Promise.race([document.fonts.load('12px "DotGothic16"'), new Promise((r) => setTimeout(r, 5000))]);
  } catch (e) { /* font optional */ }
  setTimeout(() => g.resize(), 50);
  await loadLogos();
  const coreFailed = await loadCores();
  onMorning(birthdayHook);
  g.failedModules = [...coreFailed, ...(await loadAll())];

  if (params.has('debug')) {
    const orig = ui.openMenu;
    g.debugMenu = () => debugMenu(g);
  }

  g.ready = true;
  const mg = params.get('minigame');
  if (mg) {
    if (!MINIGAMES[mg]) console.error('unknown minigame', mg);
    minigameLab(g, mg);
    return;
  }
  if (params.has('test')) {
    g.state = newState(params.get('name') || 'テスト', { hair: 'spiky', hairColor: 'brown', top: '#d64161', bottom: '#3a4a7a' });
    if (!params.has('intro')) g.state.flags.intro = true;
    if (params.has('rich')) richState(g.state);
    if (params.get('agency')) g.state.agency = params.get('agency');
    const place = params.get('place') || 'tokyo';
    const p = PLACES[place];
    if (!p) { console.error('unknown place', place); showBootError(g, `場所「${place}」が見つかりません`, 'URLの place= を確かめてください'); return; }
    const room = params.get('room') || p.start.room;
    const x = params.has('x') ? +params.get('x') : (room === p.start.room ? p.start.x : undefined);
    const y = params.has('y') ? +params.get('y') : (room === p.start.room ? p.start.y : undefined);
    await g.goto(place, room, x, y, params.get('dir') || p.start.dir || 'down', { fade: false });
    return;
  }
  await titleFlow(g);
}

boot().catch((e) => {
  console.error(e);
  showBootError(window.__game, 'ゲームを読み込めませんでした…', 'ページを再読み込みしてください');
});
