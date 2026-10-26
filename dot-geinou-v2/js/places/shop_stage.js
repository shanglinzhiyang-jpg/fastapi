// 小屋 [R12-S2]: the small theatres, live houses and halls of 芸人通り and the なんば 千日前 — lobby / hall (客席) / 楽屋.
//
//   shop_shogekijo   ドット小劇場 (東京 劇場通り, 12:00〜22:00): 客席60の劇場. 観る (演技・間・構成), 出番 (若手ライブ → g.perform), 端役の仕事 (conte)
//   shop_livehouse   ライブハウス (東京 劇場通り, 17:00〜24:00, 月曜休み): ドリンク代, バンドの夜 / お笑いライブの夜, 歌の仕事 (rhythm)
//   shop_engeijo     ドット演芸場 (東京 劇場通り, 11:00〜21:00): 寄席 (昼席・夜席), 落語・漫才を観る (話芸・間・客席を読む力), 前座の仕事 (rakugo)
//   shop_geki_n      ドット劇場 (なんば 西, 12:00〜21:00): 若手の劇場. NSCを出たばかりの出番, 関西弁
//   shop_sennichimae ドット千日前劇場 (なんば 千日前, 11:00〜20:00): 昼席・夜席, 新喜劇ふうのコント, ちょい役の仕事
//   shop_hall_n      ドット千日前ホール (なんば 千日前, 16:00〜23:00): 若手ネタバトル (毎晩 18時〜, 10組) — 本番で順位, 賞金
//   shop_netabar     お笑いBAR 笑いの穴 (東京 劇場通り, 1996年〜 18:00〜27:00): ワンドリンクの5分ネタ見せ・大喜利ナイト・チップ
// Mechanics (shared): 観る = a ticket for the next show (the clock waits for the curtain; 2 a day, the second teaches less): the acts of the day
// (fictional, deterministic by the day) make it a 当たり / ふつう / はずれ → 芸の力 (g.addComedyStat) + a skill point + a ネタの種. 出番 = g.perform
// (your own 台本) with the venue's size and crowd; amateurs pay the エントリー料, pros are paid; the 楽屋 takes 差し入れ (favor → better pay).
// Everyone on stage is fictional (the names are checked with isRealNameLike).

import {
  registerShop, room, npc, sign, who, SS, dayN, bumpN, stageRec, firstVisit, byEra, eraId, yearNow, has, passTime, T, hm, nowTotal, openState,
  fmtMoney, pick, adult, LOOKS, orderMenu, addSeed, writeWithSeed, rumorTalk, lineup, board, stageLights, clamp, hash2, MODS, diffText, ITEMS,
} from '../world/shopkit.js';

const say = (g, n, t) => g.say(t, who(n));
const KIND_JA = { manzai: '漫才', conte: 'コント', pin: 'ピン芸', rakugo: '落語', ogiri: '大喜利', utaneta: '歌ネタ', monomane: 'ものまね', talk: 'トーク' };
function myKind(g) {
  try { const u = g.unit(); if (u && u.type !== 'pin') return u.style === 'conte' ? 'conte' : 'manzai'; } catch (e) { /* pin */ }
  return 'pin';
}
// is a show on right now (no clock: always)
function slotsOf(V, g) { return typeof V.slots === 'function' ? V.slots(g) : V.slots; }
function inShow(g, V) {
  const t = nowTotal(g);
  if (t == null) return true;
  return slotsOf(V, g).some(([a, b]) => t >= a && t < b);
}
const nextSlot = (g, V) => {
  const t = nowTotal(g);
  const slots = slotsOf(V, g);
  if (t == null) return { i: 0, slot: slots[0], t: null };
  const i = slots.findIndex(([, b]) => t < b - 30);
  return i < 0 ? null : { i, slot: slots[i], t };
};

// ====================================================================== 観る
const FLAVOR = {
  owarai: {
    great: (a) => [`${a}が、客席を爆笑の渦にした！`, '笑いの「間」が、体にしみた。…あのタイミングで、あの一言。'],
    ok: (a) => [`${a}の漫才に、客席がじわじわ笑っていた。`, '派手さはないが、構成がうまい。メモを取った。'],
    bad: () => ['この日は、どの組もスベりぎみ。客席も冷えていた。', '…でも、スベる理由を、じっと見るのも勉強だ。'],
  },
  band: {
    great: (a) => [`${a}のステージで、フロアが総立ちになった！`, '声の出し方、間の取り方…体が熱くなった。'],
    ok: (a) => [`${a}の演奏は、安定していた。`, 'ひとつひとつの音を、ていねいに聴いた。'],
    bad: () => ['この日は、音がこもって聴こえにくかった。', '…それでも、客を巻きこむ方法は、学べた。'],
  },
  yose: {
    great: (a) => [`${a}の高座に、客席がどっと沸いた！`, 'まくらから本題への運び方が、見事だった。'],
    ok: (a) => [`${a}の高座を、じっくり聴いた。`, '間と呼吸が、体にしみてくる。'],
    bad: () => ['この日は、客席が静かで、高座も重たかった。', '…こういう日の乗り切り方を見るのも、勉強だ。'],
  },
  play: {
    great: (a) => [`${a}の舞台に、客席がぐっと引きこまれた！`, '役に入りきる、というのは、こういうことか。'],
    ok: (a) => [`${a}の芝居を、じっと観た。`, 'セリフの間と、目線の使い方をメモした。'],
    bad: () => ['この日は、セリフがかみ合わない場面が多かった。', '…でも、立て直す姿から、学ぶことは多かった。'],
  },
};
async function watchShow(g, V) {
  const o = V.clerk ? who(V.clerk) : {};
  const S = SS(g);
  if (dayN(g, 'shows') >= 2) { await g.say('今日は、もう二本も観た。\n…頭がいっぱいで、これ以上は入らない。'); return; }
  const ns = nextSlot(g, V);
  if (!ns) { await g.say(['本日の公演は、すべて終了しました。', `（${V.name}の営業時間：${V.hoursNote}）`], o); return; }
  const [a, b] = ns.slot;
  const price = V.ticket + (V.drink || 0);
  const late = ns.t != null && ns.t >= a;
  const k = await g.ask([`${late ? '公演の途中ですが、入れます。' : `次の公演は ${hm(a)} 開演です。`}`, `チケット ${fmtMoney(V.ticket)}${V.drink ? `＋ドリンク代 ${fmtMoney(V.drink)}` : ''}。観ますか？`], ['観る', 'やめておく'], { ...o, cancel: 1 });
  if (k !== 0) return;
  if (g.state.money < price) { await g.say('お金が足りない…。', o); return; }
  g.state.money -= price;
  g.sfx('coin');
  if (!late && ns.t != null && has(g, 'advanceTo')) { g.advanceTo(a, '開演待ち'); }
  const nth = bumpN(g, 'shows');
  await g.fadeOut(12);
  g.sfx(V.flavor === 'band' ? 'drum' : 'applause');
  await g.wait(500);
  const mins = ns.t != null ? Math.max(60, b - Math.max(ns.t, a)) : 90;
  passTime(g, mins, `観劇 ${V.name}`);
  await g.fadeIn(12);
  const q = hash2(g.state.day, V.id.length * 13 + ns.i, 5);
  const acts = lineup(g, V.id, ns.i, 4);
  const F = FLAVOR[V.flavor] || FLAVOR.owarai;
  const top = acts[Math.floor(hash2(g.state.day, ns.i, 9) * acts.length)];
  const tone = q >= 0.7 ? 'great' : q >= 0.25 ? 'ok' : 'bad';
  const mult = (0.55 + 0.9 * q) * (nth === 1 ? 1 : 0.6);
  const before = {};
  for (const key of Object.keys(V.stats)) before[key] = has(g, 'comedyStat') ? g.comedyStat(key) : 0;
  for (const [key, v] of Object.entries(V.stats)) { try { g.addComedyStat(key, v * mult, true); } catch (e) { /* optional */ } }
  const names = (has(g, 'comedyStat') ? Object.keys(V.stats).filter((key) => g.comedyStat(key) > before[key]) : []).map((key) => ({ boke: 'ボケ', tsukkomi: 'ツッコミ', ma: '間・テンポ', voice: '声量・滑舌', act: '演技力', hassou: '発想力', wagei: '話芸', dokyo: '度胸', chara: 'キャラ・華', adlib: 'アドリブ', mane: 'ものまね', neta: 'ネタ作り', kosei: '構成力', kankyaku: '客席を読む力' }[key] || key));
  let skillLine = '';
  if (nth === 1 && q >= 0.4 && V.skill) { g.addSkill(V.skill, 1, true); skillLine = `　${{ warai: 'お笑い', engi: '演技', uta: '歌', talk: 'トーク' }[V.skill]} +1`; }
  g.relax({ stress: tone === 'bad' ? 3 : 9 });
  const seed = q >= 0.25 ? addSeed(g, `${V.name}で観た舞台`) : '';
  const rec = stageRec(g, V.id);
  rec.shows += 1;
  await g.say([`本日の出演：${acts.join('／')}`, ...F[tone](top), `（${names.length ? names.join('・') + 'が少し伸びた' : '大きな発見はなかった'}${skillLine}${nth > 1 ? '　※二本目は吸収が少ない' : ''}）`, seed ? `（客席でメモを取った。ネタの種：「${seed}」）` : '（メモは、あまり残らなかった）']);
  await g.say(diffText(g, { st: g.state.stamina, hu: g.state.life.hunger, sr: g.state.life.stress + (tone === 'bad' ? 3 : 9), cl: g.state.life.clean }) || 'いい時間だった。');
}

// ====================================================================== 出番
async function standUp(g, V, opts = {}) {
  if (V.battle) return V.battle(g, V);
  const o = V.clerk ? who(V.clerk) : {};
  const why = has(g, 'lifeRefusal') ? g.lifeRefusal() : null;
  if (why) { await g.say(why); return null; }
  if (dayN(g, 'live') >= 1) { await g.say('今日は、もう一本舞台に立った。\n（ライブは1日1回まで）', o); return null; }
  if (g.state.stamina < 15) { await g.say('体力が足りない…。\n何か食べて、少し休んでからにしよう。'); return null; }
  const rec = stageRec(g, V.id);
  const pro = !!g.state.agency || g.state.fame >= 100;
  const fee = pro ? 0 : V.fee;
  const kind = opts.kind || myKind(g);
  const u = has(g, 'unit') ? g.unit() : null;
  const k = await g.ask([`${V.perf.name}の出番。\n${u && u.type !== 'pin' ? `「${u.name}」で${KIND_JA[kind]}` : `ピンで${KIND_JA[kind]}`}をやる？（体力 -15）`, fee ? `エントリー料 ${fmtMoney(fee)}（ノルマ）` : `出演料の目安 ${fmtMoney(V.pay)}`], ['出る', 'やめておく'], { ...o, cancel: 1 });
  if (k !== 0) return null;
  if (fee && g.state.money < fee) { await g.say('エントリー料が足りない…。', o); return null; }
  if (fee) { g.state.money -= fee; g.sfx('coin'); }
  g.state.stamina -= 15;
  bumpN(g, 'live');
  g.lifeTick && g.lifeTick({ stress: 6, hunger: -8, clean: -6 });
  let res = null;
  if (has(g, 'perform')) { try { res = await g.perform({ kind, venue: V.perf, title: V.perf.name }); } catch (e) { console.error(e); res = null; } }
  if (!res || !Number.isFinite(Number(res.score))) res = { score: 40 + Math.floor(Math.random() * 30), rank: 'C' };
  const score = Number(res.score);
  const fans = Math.max(0, Math.round((score - 30) / 6));
  if (fans) g.addFans(fans, true);
  const pay = pro ? Math.round((V.pay * (0.4 + 0.8 * score / 100) * (1 + 0.08 * Math.min(5, rec.favor))) / 10) * 10 : 0;
  if (pay) g.addMoney(pay, true);
  if (pro && score >= 50) g.addFame(1 + Math.floor(score / 40), true);
  rec.lives += 1;
  if (score >= 60) rec.favor = Math.min(9, rec.favor + 1);
  const L = score >= 80 ? '爆笑！ 客席がうねるように笑った！' : score >= 60 ? 'しっかりウケた！' : score >= 40 ? 'ぱらぱらと笑いが起きた。' : 'シーン…。スベった。';
  await g.say([`${L}（${score}点）`, `ファン +${fans}${pay ? `　出演料 ${fmtMoney(pay)}` : ''}${fee ? `　（エントリー料 ${fmtMoney(fee)}）` : ''}`, score >= 60 ? '（小屋の人に、顔を覚えてもらえた。\n楽屋で話しかけてみよう）' : '（舞台は、場数だ。\n次は、もっとウケる）'], o);
  return res;
}
async function stageJob(g, V, def) {
  const rec = stageRec(g, V.id);
  const res = await g.job({ confirm: true, client: V.clerk ? V.clerk.name : undefined, clientLook: V.clerk ? V.clerk.look : undefined, ...def, pay: Math.round(def.pay * (1 + 0.08 * Math.min(5, rec.favor)) / 10) * 10 });
  if (res) { rec.lives += 1; if ('SA'.includes(res.rank)) rec.favor = Math.min(9, rec.favor + 1); }
  return res;
}
// the lobby clerk's menu
async function clerkMenu(g, V, n) {
  const o = who(n);
  for (let guard = 0; guard < 8; guard++) {
    const rows = [
      { id: 'watch', label: `公演を観る（${fmtMoney(V.ticket + (V.drink || 0))}）` },
      { id: 'live', label: V.battle ? '若手ネタバトルにエントリーする' : '舞台に立つ（出番をもらう）' },
      ...V.jobs.map((j, i) => ({ id: 'job' + i, label: j.label })),
      { id: 'talk', label: '小屋の話を聞く' },
      { id: 'end', label: 'なんでもない' },
    ];
    const k = await g.ask(V.greet, rows.map((r) => r.label), { ...o, cancel: rows.length - 1 });
    const id = rows[k] ? rows[k].id : 'end';
    if (id === 'end') { await g.say(V.bye, o); return; }
    if (id === 'watch') await watchShow(g, V);
    else if (id === 'live') await standUp(g, V);
    else if (id.startsWith('job')) await stageJob(g, V, V.jobs[Number(id.slice(3))].def);
    else if (id === 'talk') { if (!(await rumorTalk(g, V.id, o, V.talkOpen))) await g.say(V.talkAgain, o); }
    if (id !== 'talk') return;
  }
}

// ====================================================================== the 楽屋
async function sashiire(g, V, n) {
  const o = who(n);
  const foods = Object.keys(g.state.items || {}).filter((id) => g.state.items[id] > 0 && ITEMS[id] && (ITEMS[id].heal > 0 || /菓|団子|もなか|あん|大福|饅頭|ようかん|おにぎり|弁当/.test(ITEMS[id].name)));
  if (!foods.length) { await g.say('差し入れに持っていけるものが、ない。\n（おにぎりやお菓子を持ってくると、よろこばれる）', o); return; }
  const i = await g.list({ title: '差し入れ：なにを渡す？', cancel: foods.length, items: [...foods.map((id) => ({ label: ITEMS[id].name, right: `×${g.state.items[id]}` })), { label: 'やめる' }], x: 12, y: 44, w: 360, px: true });
  if (i < 0 || i >= foods.length) return;
  const rec = stageRec(g, V.id);
  if (dayN(g, 'sashiire_' + V.id) >= 1) { await g.say('今日はもう、差し入れをした。\n（毎日だと、気をつかわせてしまう）', o); return; }
  bumpN(g, 'sashiire_' + V.id);
  g.takeItem(foods[i]);
  rec.favor = Math.min(9, rec.favor + 1);
  g.sfx('good');
  await g.say(V.sashiireLine || ['おっ、差し入れ？ ありがとう！', 'おまえ、気がきくな。\n出番のこと、小屋に言っとくよ。']);
  await g.say(`（小屋の人との関係が深まった。出演料が少し上がる：いま ${rec.favor}/9）`);
}

// ====================================================================== the builder
// V: { id, name, hours, hoursNote, flavor, ticket, drink, fee, pay, slots(g), stats, skill, perf, clerk, boss, greet, bye, talkOpen, talkAgain, jobs: [{ label, def }],
//   cast (lobby), audience (hall), gakuya (楽屋 cast), theme { wall, floor, hall, ... }, bgm, hallLights }
function venue(V) {
  const T0 = V.theme || {};
  const wall = T0.wall || 'purple';
  // lobby (12 x 8)
  const lob = room(12, 8);
  lob.set(1, 1, 'd').set(3, 1, 'f').set(5, 1, 'f').set(7, 1, 'p').set(8, 1, 'c').set(10, 1, 'd');
  lob.rect(2, 3, 3, 1, 'C').set(1, 6, 'B').set(2, 6, 'B').set(10, 6, 'V').set(10, 3, 'P').set(1, 3, 'P');
  lob.exit(5, 6);
  // hall (14 x 12): 'seats' (theatre), 'floor' (live house: a standing floor and a bar), 'tatami' (寄席: 座布団 and a gold screen)
  const hall = room(14, 12);
  const style = T0.hall || 'seats';
  hall.rect(1, 1, 12, 1, 'T').rect(1, 2, 12, 2, ',').set(1, 2, 'c').set(12, 2, 'c').set(1, 3, 'c').set(12, 3, 'c').set(7, 3, 'Z');
  if (style === 'seats') {
    for (const y of [6, 8, 10]) for (const x of [2, 3, 5, 6, 8, 9, 11, 12]) hall.set(x, y, 's');
    hall.set(1, 5, 'S').set(12, 5, 'S').set(2, 3, 'S').set(11, 3, 'S');
  } else if (style === 'floor') {
    hall.set(2, 3, 'S').set(11, 3, 'S').set(3, 2, 'S').set(10, 2, 'S').set(6, 2, 'D').rect(1, 10, 4, 1, 'C').set(12, 10, 'V').set(12, 6, 'S').set(1, 6, 'S');
  } else {
    hall.rect(1, 4, 12, 7, 'o');
    hall.rect(3, 2, 8, 1, 'b');
    for (const y of [6, 8, 10]) for (const x of [2, 3, 5, 6, 8, 9, 11, 12]) hall.set(x, y, 'z');
    hall.set(7, 3, 'z');
  }
  hall.exit(7);
  // 楽屋 (10 x 7)
  const bk = room(10, 7);
  bk.set(2, 1, 'm').set(4, 1, 'm').set(6, 1, 'm').set(8, 1, 'c').rect(1, 2, 3, 1, 'R').set(8, 3, 'T').set(8, 4, 'T').set(1, 5, 'X').set(8, 5, 'W').set(1, 3, 'P');
  bk.exit(4, 5);
  const showHere = (g) => inShow(g, V);
  const SEATS = style === 'floor' ? [[4, 6], [9, 7], [6, 9], [11, 8], [3, 8]] : [[3, 6], [9, 8], [6, 10], [12, 6], [2, 10]];
  const clerk = V.clerk;
  const boss = V.boss;
  const talk = (g, n) => clerkMenu(g, V, n);
  registerShop({
    id: V.id, name: V.name, bgm: V.bgm || 'shop_live', hours: V.hours,
    start: { room: 'lobby', x: 5, y: 6, dir: 'up' },
    rooms: {
      lobby: {
        floor: T0.lobbyFloor || 'floor_carpet_red', wall,
        tiles: lob.rows(),
        legend: { f: `wall_${wall}+shop_flyers`, p: `wall_${wall}+poster`, c: `wall_${wall}+clock`, d: 'door_wood', C: 'counter', B: 'bench', V: 'vending', P: 'plant' },
        warps: [...lob.warps(5, 6), { x: 10, y: 1, room: 'hall', tx: 7, ty: 10, dir: 'up' }, { x: 1, y: 1, room: 'gakuya', tx: 4, ty: 5, dir: 'up' }],
        entities: [
          npc(V.id + '_clerk', 3, 2, 'down', clerk.look, clerk.name, talk, { fixedDir: true }),
          board(5, 1, 4, (g) => [`${V.name}  本日の出演`, ...lineup(g, V.id, 0, 3)], { text: undefined, talk: async (g) => { await g.say([`${V.name}の出演者表だ。`, `昼・夜の出演者：${lineup(g, V.id, 0, 4).join('／')}`, V.hoursNote]); } }),
          ...V.cast.map((c, i) => npc(`${V.id}_cast${i}`, c.x, c.y, c.dir || 'down', c.look, c.name, c.talk || c.lines, { wander: c.wander ?? 0, ...(c.extra || {}) })),
        ],
        events: [{ x: 2, y: 3, w: 3, on: 'action', run: (g) => clerkMenu(g, V, { name: clerk.name, look: clerk.look }) }],
        onEnter: (g) => firstVisit(g, V.id, V.intro, clerk),
      },
      hall: {
        floor: T0.hallFloor || 'floor_carpet_red', wall: 'dark', bgm: V.bgm || 'shop_live',
        tiles: hall.rows(),
        legend: { T: 'curtain_top', c: 'curtain', ',': 'floor_stage', Z: 'floor_stage+mic', s: 'seat', S: 'speaker', D: 'drum_set', C: 'counter', V: 'vending', o: 'floor_tatami', b: 'ktv_byobu', z: 'jikka_zabuton', M: 'exit_mat', d: 'door_wood' },
        warps: [{ x: 7, y: 11, room: 'lobby', tx: 10, ty: 2, dir: 'down' }],
        entities: [
          npc(V.id + '_boss', 10, 4, 'left', boss.look, boss.name, async (g, n) => {
            const o = who(n);
            const k = await g.ask(boss.greet, ['舞台に立つ', '公演を観る', 'なんでもない'], { ...o, cancel: 2 });
            if (k === 0) await standUp(g, V);
            else if (k === 1) await watchShow(g, V);
          }),
          ...V.audience.map((c, i) => npc(`${V.id}_aud${i}`, SEATS[i % SEATS.length][0], SEATS[i % SEATS.length][1], 'up', c.look, c.name, c.lines, { cond: showHere })),
        ],
        events: [
          { x: 6, y: 3, w: 3, on: 'action', run: async (g) => { await g.say(V.stageLine); await standUp(g, V); } },
          { x: 2, y: 6, w: 11, h: 5, on: 'action', run: async (g) => { await g.say('客席に座った。ここから、舞台を見上げる。'); await watchShow(g, V); } },
        ],
        drawOver: V.hallLights ? stageLights(7, 3.4, 4) : undefined,
        onEnter: async (g) => { if (!SS(g).met[V.id + '_hall']) { SS(g).met[V.id + '_hall'] = 1; g.notify(V.hallNote || '客席だ。センターマイクの前でAボタン → 出番', { color: '#ffd23f', life: 240 }); } },
      },
      gakuya: {
        floor: 'floor_wood_dark', wall: 'wood',
        tiles: bk.rows(),
        legend: { m: 'wall_wood+mirror', c: 'wall_wood+clock', R: 'clothes_rack', T: 'table', X: 'boxes', W: 'water_server', P: 'plant' },
        warps: [{ x: 4, y: 6, room: 'lobby', tx: 1, ty: 2, dir: 'down' }],
        entities: V.gakuya.map((c, i) => npc(`${V.id}_gk${i}`, c.x, c.y, c.dir || 'down', c.look, c.name, c.talk || c.lines, { wander: c.wander ?? 0 })),
        events: [
          { x: 2, y: 2, w: 5, on: 'action', run: async (g) => {
            if (dayN(g, 'mirror') >= 1) { await g.say('鏡の中の自分と目が合った。\nもう、身だしなみはばっちりだ。'); return; }
            bumpN(g, 'mirror');
            const d = g.bathe(18, true);
            await g.say(['楽屋の鏡で、衣装と髪を整えた。', `身だしなみ +${Math.max(0, Math.round(d))}`]);
          } },
          { x: 8, y: 2, w: 1, h: 3, on: 'action', run: async (g) => sashiire(g, V, V.gakuya[0] ? { name: V.gakuya[0].name, look: V.gakuya[0].look } : { name: '楽屋の人' }) },
        ],
      },
    },
    crime: false,
  });
}

// ---------------------------------------------------------------- looks of the people
const PEOPLEL = {
  moguri: { ...LOOKS.receptionist, top: '#8a5ac8', bottom: '#2a2430' },
  owner: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#3a2a4a', bottom: '#20232a', glasses: true },
  senpai: { ...LOOKS.comedian2, top: '#5a6f8a' },
  fan: { ...LOOKS.fan, top: '#ff9a3c' },
  band: { hair: 'spiky', hairColor: 'red', skin: 'fair', top: '#20232a', bottom: '#3a4a7a' },
};

// ====================================================================== ドット小劇場
const SHOGEKI_CLERK = { name: '小劇場の受付さん', look: { ...PEOPLEL.moguri, top: '#5a2a6a' } };
venue({
  id: 'shop_shogekijo', name: 'ドット小劇場', hours: { spans: [[T(12), T(22)]], note: '' }, hoursNote: '営業 12:00〜22:00（昼公演は土日のみ）', flavor: 'play',
  ticket: 2500, fee: 1000, pay: 2500, stats: { act: 1.4, ma: 1, kosei: 1, kankyaku: 0.6 }, skill: 'engi', bgm: 'shop_live', hallLights: true,
  slots: (g) => (['5', '6'].includes(String(((g.state.day - 1) % 7 + 7) % 7)) ? [[T(14), T(16)], [T(19), T(21)]] : [[T(19), T(21)]]),
  perf: { name: 'ドット小劇場（若手公演）', size: 'small', crowd: 'normal', pressure: 28 },
  theme: { wall: 'purple', lobbyFloor: 'floor_carpet_purple', hallFloor: 'floor_carpet_red' },
  clerk: SHOGEKI_CLERK, boss: { name: '劇場主の志村さん', look: PEOPLEL.owner, greet: '劇場主の志村です。\n小さい劇場だが、客席の熱は本物だよ。' },
  greet: 'いらっしゃいませ。ドット小劇場です。', bye: 'またお越しください。\n劇場は、お客さんがいてこそ、ですから。', talkOpen: ['この劇場は、客席六十。', '舞台と客席の近さが、売りでね。\n役者の息づかいまで、客に届くんだ。'], talkAgain: 'さっき話したとおりです。\n開演まで、ロビーでどうぞ。',
  intro: ['いらっしゃいませ。ここは客席六十の、小さな劇場です。', '観る・出る・手伝う。どれもできますよ。\n（舞台に立つなら、客席のセンターマイクの前で）'],
  jobs: [{ label: '劇団の端役をやる（お仕事）', def: { id: 'shop_shogeki_hayaku', title: '小劇場の端役', desc: '劇団の公演で、ちょい役をもらった。\n台本のないセリフは、ほんの数行。', stamina: 15, minigame: 'conte', opts: { difficulty: 1 }, pay: 1500, fame: 4, skill: 'engi', gain: 2 } }],
  cast: [
    { x: 7, y: 5, dir: 'down', look: PEOPLEL.fan, name: 'チラシを持った観客', lines: ['今夜は、若手のお笑いライブなんです。', '小さな劇場の「次の次」が売れるって、\nよく言うでしょう？ 先物買い、先物買い。'], wander: 1 },
    { x: 9, y: 6, dir: 'up', look: PEOPLEL.senpai, name: '開演待ちの芸人', lines: ['ここの舞台は、床が鳴るんだよ。', 'その音まで、笑いにするのが、うちの先輩たち。'] },
  ],
  audience: [
    { x: 3, y: 5, look: { ...LOOKS.fan, top: '#5fd7ff' }, name: 'お客さん', lines: ['（開演を待っている）', '一列目は、役者の汗まで見えるのよ。'] },
    { x: 9, y: 7, look: LOOKS.salaryman, name: 'お客さん', lines: ['仕事帰りの観劇が、いちばんの息抜きなんだ。'] },
    { x: 6, y: 9, look: { ...LOOKS.oldwoman, top: '#c87a8a' }, name: '常連のおばさま', lines: ['若い人の舞台を観ると、元気がもらえるのよ。'] },
  ],
  stageLine: '舞台の上だ。センターマイクが、客席の真ん中を向いている。',
  gakuya: [
    { x: 3, y: 4, look: PEOPLEL.senpai, name: '楽屋の先輩', lines: ['おう、後輩。差し入れは、楽屋のテーブルに置いといてくれ。', '本番前は、ここで声を出す。壁は薄いから、ほどほどにな。'] },
    { x: 6, y: 3, look: { ...LOOKS.actress, top: '#c87a8a' }, name: '劇団の看板女優', lines: ['舞台って、化粧と同じ。何度やっても、慣れないの。', '慣れちゃったら、お客さんには伝わらないのよね。'] },
  ],
  sashiireLine: ['あら、差し入れ？ ありがとう。', '…ちゃんと見てるのね、あなた。\n舞台の袖から、あなたのこと、小屋の人に話しておくわ。'],
});

// ====================================================================== ライブハウス
const LIVE_CLERK = { name: 'ライブハウスの受付', look: { hair: 'spiky', hairColor: 'blonde', skin: 'fair', top: '#20232a', bottom: '#2a2430', glasses: 'sun' } };
venue({
  id: 'shop_livehouse', name: 'ライブハウス', hours: { spans: [[T(17), T(24)]], closed: [0], note: '月曜休み' }, hoursNote: '営業 17:00〜24:00（月曜休み）', flavor: 'band',
  ticket: 2000, drink: 600, fee: 1500, pay: 1800, stats: { voice: 1.3, dokyo: 1, chara: 0.8, ma: 0.6 }, skill: 'uta', bgm: 'shop_live', hallLights: true,
  slots: () => [[T(18), T(21)]],
  perf: { name: 'ライブハウス（対バン）', size: 'small', crowd: 'warm', pressure: 32 },
  theme: { wall: 'dark', lobbyFloor: 'floor_concrete', hallFloor: 'floor_black', hall: 'floor' },
  clerk: LIVE_CLERK, boss: { name: 'PAのキヨシさん', look: { ...PEOPLEL.band, hairColor: 'black', top: '#2a3a5a' }, greet: 'PAのキヨシ。音のことなら、まかせて。\n出るなら、リハ時間は五分だぜ。' },
  greet: 'いらっしゃい。今日はバンドとお笑いの対バンだよ。', bye: 'またな。ライブは、生の空気だぜ。', talkOpen: ['ここは、地下のライブハウス。', 'バンドの日もあるし、お笑いの日もある。\n客が熱けりゃ、ジャンルは関係ない。'], talkAgain: 'もう話したろ。リハの時間だ。',
  intro: ['いらっしゃい。地下のライブハウスだ。', 'チケットとは別に、ドリンク代がいる。\n（出る気なら、フロアのステージの前で）'],
  jobs: [{ label: '前座のバンドで歌う（お仕事）', def: { id: 'shop_live_uta', title: 'ライブハウスの前座', desc: '対バンの一番手。三曲だけ、歌わせてもらえる。', stamina: 15, minigame: 'rhythm', opts: { difficulty: 2, lanes: 3, song: 'ネオンシティ・ロック', title: 'ライブハウス' }, pay: 1200, fame: 4, skill: 'uta', gain: 2 } }],
  cast: [
    { x: 8, y: 5, dir: 'left', look: PEOPLEL.band, name: 'ギターの青年', lines: ['今夜、対バンなんだ。\nチューニングが、まだ決まらなくて…。', 'お笑いのやつと一緒の日は、客層がまざっておもしろい。'], wander: 1 },
    { x: 3, y: 5, dir: 'up', look: { ...LOOKS.fan, top: '#ff7eb6', hairColor: 'pink' }, name: 'ファンの子', lines: ['推しのバンドを、毎週ここで観てるの！', '最前列で、汗を浴びるのが、最高なんだ。'] },
  ],
  audience: [
    { x: 3, y: 5, look: { ...LOOKS.fan, top: '#5fd7ff' }, name: 'お客さん', lines: ['（開演を待っている）', '音が、床から響いてくるのがいいんだよね。'] },
    { x: 8, y: 7, look: PEOPLEL.band, name: 'お客さん', lines: ['今日のトリのバンド、ずっと追いかけてるんだ。'] },
    { x: 11, y: 9, look: LOOKS.salaryman, name: 'お客さん', lines: ['会社帰りに、ふらっと。ライブは、生の空気だよ。'] },
  ],
  stageLine: 'ステージの上だ。ドラムセットとアンプが、出番を待っている。',
  hallNote: 'フロアだ。ステージの前でAボタン → 出番（歌・お笑い）',
  gakuya: [
    { x: 3, y: 4, look: PEOPLEL.band, name: '出番待ちのバンドマン', lines: ['楽屋は狭いけど、この狭さが、いい。', '本番の五分前の沈黙が、いちばん好きなんだ。'] },
    { x: 6, y: 3, look: { ...LOOKS.idol, top: '#8a5ac8' }, name: 'ボーカルの女の子', lines: ['のどあめを、いつも持ち歩いてるの。', '声は、楽器だからね。大事にしなきゃ。'] },
  ],
  sashiireLine: ['お、差し入れ？ ありがとう！', 'ステージの袖から、おまえのこと見てたぜ。\n次のライブ、PAに言っとくよ。'],
});

// ====================================================================== ドット演芸場
const ENGEI_CLERK = { name: '演芸場の木戸番', look: { ...LOOKS.oldman, top: '#5a4a7a', glasses: true } };
venue({
  id: 'shop_engeijo', name: 'ドット演芸場', hours: { spans: [[T(11), T(21)]], note: '' }, hoursNote: '営業 11:00〜21:00（昼席 12:00／夜席 17:30）', flavor: 'yose',
  ticket: 2500, fee: 800, pay: 2000, stats: { wagei: 1.5, ma: 1.1, kankyaku: 0.9, voice: 0.4 }, skill: 'talk', bgm: 'shop_yose', hallLights: false,
  slots: () => [[T(12), T(16)], [T(17, 30), T(21)]],
  perf: { name: 'ドット演芸場（寄席）', size: 'small', crowd: 'warm', pressure: 26 },
  theme: { wall: 'red', lobbyFloor: 'floor_tatami', hallFloor: 'floor_tatami', hall: 'tatami' },
  clerk: ENGEI_CLERK, boss: { name: '席亭の梅乃家さん', look: { ...LOOKS.oldman, top: '#7a3a3a', glasses: false }, greet: '席亭の梅乃家です。\nうちは、昼から夜まで、毎日だれかが高座に上がってる。' },
  greet: 'いらっしゃい。今日の寄席は、まだ席があるよ。', bye: 'またおいで。笑いは、毎日あるからね。', talkOpen: ['この小屋は、もう四十年になる。', '高座の上の人も、客席の人も、そのうち年をとる。\nでも、笑いだけは、変わらないんだよ。'], talkAgain: 'さっきも話したろう。\n出囃子が鳴ってるよ。',
  intro: ['いらっしゃい。ここは寄席だよ。', '昼席は十二時、夜席は五時半から。\n（高座に上がるなら、客席の前の座布団へ）'],
  jobs: [{ label: '前座をつとめる（お仕事）', def: { id: 'shop_engei_zenza', title: '寄席の前座', desc: '開口一番、前座の出番だ。\n客席は、まだ温まっていない。', stamina: 15, minigame: 'rakugo', opts: { difficulty: 1 }, pay: 1000, fame: 3, skill: 'talk', gain: 2 } }],
  cast: [
    { x: 7, y: 5, dir: 'down', look: { ...LOOKS.oldman, top: '#8a6a4a' }, name: '演芸好きのおじいさん', lines: ['この寄席には、もう四十年かよってるよ。', '若いのが育っていくのを見るのが、いちばんの楽しみでねえ。'], wander: 1 },
    { x: 9, y: 6, dir: 'up', look: { ...LOOKS.manager, top: '#6a5a7a' }, name: '出番待ちの噺家', lines: ['お客さんの顔を見ながら、まくらを変えるんだ。', '同じ噺でも、昼と夜で、ぜんぜん違うものになる。'] },
  ],
  audience: [
    { x: 3, y: 5, look: { ...LOOKS.oldwoman, top: '#8a6a9a' }, name: 'お客さん', lines: ['（開演を待っている）', '落語はね、年をとるほど、おもしろくなるのよ。'] },
    { x: 8, y: 7, look: { ...LOOKS.oldman, top: '#6a7a8a' }, name: 'お客さん', lines: ['弁当を持ちこんで、一日中ここにいるのが、道楽さ。'] },
    { x: 11, y: 9, look: LOOKS.salaryman, name: 'お客さん', lines: ['昼休みに、ちょっとだけ。…と思ったら、夜席までいた。'] },
  ],
  stageLine: '高座の上だ。座布団が一枚、ぽつんと置いてある。',
  hallNote: '客席の座布団。前の高座でAボタン → 出番（漫才・落語）',
  gakuya: [
    { x: 3, y: 4, look: { ...LOOKS.oldman, top: '#7a3a3a' }, name: '楽屋のお茶くみの師匠', lines: ['前座の仕事は、お茶くみから。\nこれが、芸の入り口なんだ。', '師匠の湯のみは、熱めに。\n…これだけで、人の顔が覚えられる。'] },
    { x: 6, y: 3, look: { ...LOOKS.comedian2, top: '#2a3a5a' }, name: '楽屋の漫才師', lines: ['落語家の楽屋の空気は、独特だ。\n…背筋がのびる。', '漫才も、ここで学べることは多いよ。'] },
  ],
  sashiireLine: ['おや、差し入れ。気がきくじゃないか。', '前座は、そういう細かい気づかいから、見られるんだよ。\n席亭に、おまえのことを言っておこう。'],
});

// ====================================================================== ドット劇場 (なんば 西)
const GEKIN_CLERK = { name: 'ドット劇場のもぎりさん', look: { ...PEOPLEL.moguri, top: '#2a6ad0' } };
venue({
  id: 'shop_geki_n', name: 'ドット劇場', hours: { spans: [[T(12), T(21)]], note: '' }, hoursNote: '営業 12:00〜21:00（昼公演 13:00／夜公演 18:00）', flavor: 'owarai',
  ticket: 1500, fee: 800, pay: 1800, stats: { boke: 1.1, tsukkomi: 1.1, ma: 1.3, kankyaku: 0.7 }, skill: 'warai', bgm: 'osaka', hallLights: true,
  slots: () => [[T(13), T(15)], [T(18), T(20)]],
  perf: { name: 'ドット劇場（若手公演）', size: 'small', crowd: 'warm', pressure: 25 },
  theme: { wall: 'blue', lobbyFloor: 'floor_carpet_blue', hallFloor: 'floor_carpet_blue' },
  clerk: GEKIN_CLERK, boss: { name: '劇場の支配人', look: { ...PEOPLEL.owner, top: '#2a4a8a', hairColor: 'black' }, greet: '支配人や。ここは、NSC出たての子らの劇場や。\nおもろい子は、すぐ分かるで。' },
  greet: 'いらっしゃい。ドット劇場へようこそ。', bye: 'おおきに。また笑いに来てや。', talkOpen: ['ここの舞台は、若手ばっかりや。', 'NSCを出たばっかりの子が、ネタおろしに使う。\n緊張でカチカチの子ほど、あとで化けるんや。'], talkAgain: 'さっきも言うたやろ。\nええ席、まだ空いてるで。',
  intro: ['いらっしゃい！ ここは若手の劇場や。', '観るも、出るも、手伝うも、自由。\n（出るなら、客席の前のセンターマイクで）'],
  jobs: [{ label: '前説をつとめる（お仕事）', def: { id: 'shop_geki_maesetsu', title: 'ドット劇場の前説', desc: '開演前に、客席をあっためる係。\nお客さんの顔を見ながら、ひとことずつ。', stamina: 15, minigame: 'talk', opts: { difficulty: 1 }, pay: 1000, fame: 4, skill: 'talk', gain: 2 } }],
  cast: [
    { x: 7, y: 5, dir: 'down', look: { ...LOOKS.comedian2, top: '#ff7eb6' }, name: 'ネタ合わせ中の若手', lines: ['いまな、出番前の最終確認や。\nセリフ、とんだら終わりやで。', 'ここの舞台は、床が鳴るんや。\nそこまで笑いに変えたら、プロやな。'], wander: 1 },
    { x: 9, y: 6, dir: 'left', look: { ...LOOKS.fan, top: '#ffa860' }, name: 'お笑いファン', lines: ['まだ売れてへん子を、今のうちから応援するんが、いちばん楽しいんよ。', 'この劇場の若手は、みんな顔なじみや。'] },
  ],
  audience: [
    { x: 3, y: 5, look: { ...LOOKS.fan, top: '#5fd7ff' }, name: 'お客さん', lines: ['（開演を待っている）', '今日のトリ、ほんまにおもろいで。'] },
    { x: 8, y: 7, look: { ...LOOKS.mom, top: '#ffd23f' }, name: 'お客さん', lines: ['孫が出てるんや。見に来たんよ。'] },
    { x: 11, y: 9, look: LOOKS.salaryman, name: 'お客さん', lines: ['仕事終わりに、ここで笑って帰るんが、日課や。'] },
  ],
  stageLine: '舞台の上だ。センターマイクが、客席に向いている。',
  gakuya: [
    { x: 3, y: 4, look: PEOPLEL.senpai, name: '楽屋の先輩', lines: ['よう来たな。差し入れ、楽屋のテーブルにな。', '出番前は、みんなピリピリしてる。\n…でも、ええ緊張や。'] },
    { x: 6, y: 3, look: { ...LOOKS.comedian, top: '#d8101c' }, name: '出番待ちの若手', lines: ['もうすぐ出番や…。手のひらに「人」って、百回書いた。', '緊張せえへん芸人は、おらんで。\n緊張しても、前に出るんが芸人や。'] },
  ],
  sashiireLine: ['おっ、差し入れ！ おおきに！', 'おまえ、気ぃきくなあ。\n支配人に、ええように言うとくわ。'],
});

// ====================================================================== ドット千日前劇場
const SEN_CLERK = { name: '千日前劇場のもぎりさん', look: { ...PEOPLEL.moguri, top: '#2a3a7a' } };
venue({
  id: 'shop_sennichimae', name: 'ドット千日前劇場', hours: { spans: [[T(11), T(20)]], note: '' }, hoursNote: '営業 11:00〜20:00（昼席 12:30／夜席 16:00）', flavor: 'owarai',
  ticket: 2500, fee: 1000, pay: 2200, stats: { ma: 1.4, boke: 0.9, tsukkomi: 0.9, wagei: 0.7, kankyaku: 0.8 }, skill: 'warai', bgm: 'osaka', hallLights: true,
  slots: () => [[T(12, 30), T(14, 30)], [T(16), T(18)]],
  perf: { name: 'ドット千日前劇場（若手公演）', size: 'theater', crowd: 'normal', pressure: 36 },
  theme: { wall: 'navy', lobbyFloor: 'floor_carpet_red', hallFloor: 'floor_carpet_red' },
  clerk: SEN_CLERK, boss: { name: '支配人の宇田川さん', look: { ...PEOPLEL.owner, top: '#2a3a7a' }, greet: '宇田川や。千日前の劇場は、昔からお笑いの登竜門やで。\n客席は、辛口で愛がある。' },
  greet: 'いらっしゃいませ。ドット千日前劇場です。', bye: 'おおきに。また来てな。', talkOpen: ['千日前ゆうたら、昔から芸人の街や。', '劇場の客は、笑うべきところで笑う。\nそれが、いちばん厳しいんや。'], talkAgain: '話したやろ。ほな、開演やで。',
  intro: ['いらっしゃい！ 千日前の劇場へようこそ。', '昼席と夜席の二部制や。\n（舞台に立つなら、客席の前のセンターマイクで）'],
  jobs: [{ label: '新喜劇ふうのコントでちょい役（お仕事）', def: { id: 'shop_sen_chotto', title: '千日前劇場のコント（ちょい役）', desc: '座長のコントに、通行人で出る。\n一言のセリフで、客席を沸かせろ。', stamina: 15, minigame: 'tsukkomi', opts: { difficulty: 2 }, pay: 2000, fame: 6, skill: 'warai', gain: 2 } }],
  cast: [
    { x: 7, y: 5, dir: 'down', look: { ...LOOKS.oldman, top: '#a8683a' }, name: '常連のおじいさん', lines: ['この劇場には、もう半世紀かよっとる。', '新喜劇のズッコケも、ここで覚えたもんや。'], wander: 1 },
    { x: 9, y: 6, dir: 'up', look: { ...LOOKS.tourist, top: '#8fd0ff' }, name: '観光客', lines: ['大阪に来たら、お笑いを見ないと損だって聞いて。', '関西弁、ぜんぜんわからないけど、笑っちゃった！'] },
  ],
  audience: [
    { x: 3, y: 5, look: { ...LOOKS.oldwoman, top: '#d8a050' }, name: 'お客さん', lines: ['（開演を待っている）', '座長のお芝居は、何べん観てもおもろいんや。'] },
    { x: 8, y: 7, look: LOOKS.salaryman, name: 'お客さん', lines: ['出張の帰りに、立ち寄ったんや。'] },
    { x: 11, y: 9, look: { ...LOOKS.fan, top: '#ffa860' }, name: 'お客さん', lines: ['若手が育つのを見るのが、楽しいんよ。'] },
  ],
  stageLine: '舞台の上だ。老舗の舞台の板が、ひんやり鳴った。',
  gakuya: [
    { x: 3, y: 4, look: PEOPLEL.senpai, name: '楽屋の座員', lines: ['よう来たな。差し入れは、テーブルな。', '楽屋の空気は、ここがいちばんや。\n…三十年分の笑い声が、しみついとる。'] },
    { x: 6, y: 3, look: { ...LOOKS.comedian2, top: '#d8101c' }, name: '座長', lines: ['座長や。おまえ、まだ若いな。', '舞台に立ち続けることが、いちばん難しい。\n…それさえできたら、芸人や。'] },
  ],
  sashiireLine: ['おっ、差し入れか。気ぃつかわんでええのに。', 'せやけど、ありがたいわ。\n支配人に、おまえの名前、言うとくで。'],
});

// ====================================================================== ドット千日前ホール (若手ネタバトル)
const HALL_CLERK = { name: 'ホールのスタッフ', look: { ...LOOKS.staff, top: '#ffd23f', hat: '#20232a' } };
async function battle(g, V) {
  const o = who(V.clerk);
  const t = nowTotal(g);
  if (t != null && t < T(17, 30)) { await g.say(['ネタバトルの受付は、17時半からや。', 'それまで、ロビーで待っとき。'], o); return; }
  if (t != null && t >= T(21)) { await g.say('今夜のネタバトルは、もう終わったで。\n（また明日の18時やな）', o); return; }
  if (dayN(g, 'live') >= 1) { await g.say('今日は、もう舞台に立ったやろ。\n（ライブは1日1回まで）', o); return; }
  const why = has(g, 'lifeRefusal') ? g.lifeRefusal() : null;
  if (why) { await g.say(why); return; }
  if (g.state.stamina < 15) { await g.say('体力が足りない…。\n何か食べて、少し休んでからにしよう。'); return; }
  const fee = 500;
  const k = await g.ask(['今夜の若手ネタバトル、エントリーするか？', `十組で勝負。持ち時間は短いで。\nエントリー料 ${fmtMoney(fee)}／賞金：1位 ${fmtMoney(5000)}・2位 ${fmtMoney(2000)}・3位 ${fmtMoney(1000)}`], ['エントリーする', 'やめておく'], { ...o, cancel: 1 });
  if (k !== 0) return;
  if (!g.spend(fee)) { await g.say('エントリー料が足りない…。', o); return; }
  g.sfx('coin');
  g.state.stamina -= 15;
  bumpN(g, 'live');
  g.lifeTick && g.lifeTick({ stress: 8, hunger: -8, clean: -6 });
  if (t != null && has(g, 'advanceTo')) g.advanceTo(Math.max(t, T(18)), '開演待ち');
  const kind = myKind(g);
  await g.say(['ホールの階段を降りると、地下の客席はぎっしりだった。', '出番は、十組中の六番目。\n舞台袖で、手のひらに「人」と書いた。'], o);
  let res = null;
  if (has(g, 'perform')) { try { res = await g.perform({ kind, venue: V.perf, title: '若手ネタバトル' }); } catch (e) { console.error(e); res = null; } }
  if (!res || !Number.isFinite(Number(res.score))) res = { score: 35 + Math.floor(Math.random() * 40), rank: 'C' };
  const my = Number(res.score);
  // nine rivals: fictional acts, scores around the venue's level (deterministic by the day)
  const rivals = lineup(g, V.id, 5, 9).map((name, i) => {
    let s = null;
    if (has(g, 'performSim')) {
      try { const r = g.performSim({ kind: 'manzai', power: 20 + Math.round(hash2(g.state.day, i, 3) * 40), quality: 35 + Math.round(hash2(g.state.day, i, 8) * 30), rng: () => hash2(g.state.day, i, 14 + Math.floor(Math.random() * 3)) }); s = Number(r.score); } catch (e) { s = null; }
    }
    if (!Number.isFinite(s)) s = 25 + hash2(g.state.day, i, 3) * 45;
    return { name, s };
  });
  const board = [{ name: 'あなた', s: my, me: true }, ...rivals].sort((a, b) => b.s - a.s);
  const place = board.findIndex((x) => x.me) + 1;
  const prize = [5000, 2000, 1000][place - 1] || 0;
  if (prize) g.addMoney(prize, true);
  const fans = Math.max(0, Math.round((my - 30) / 6) + (place <= 3 ? 3 : 0));
  if (fans) g.addFans(fans, true);
  if (g.state.agency || g.state.fame >= 100) g.addFame(place <= 3 ? 3 : 1, true);
  const rec = stageRec(g, V.id);
  rec.lives += 1;
  if (place <= 3) rec.favor = Math.min(9, rec.favor + 1);
  g.sfx(place <= 3 ? 'fanfare' : 'cursor');
  passTime(g, 150, 'ネタバトル');
  await g.say([`全十組の発表。\n${board.slice(0, 3).map((x, i) => `${i + 1}位 ${x.name}（${Math.round(x.s)}点）`).join('\n')}`, place === 1 ? '「優勝は…あなたや！」\nフロアが、どっと沸いた！' : place <= 3 ? `あなたは、${place}位に入った！` : `あなたは、${place}位（${Math.round(my)}点）。`, `ファン +${fans}${prize ? `　賞金 ${fmtMoney(prize)}` : ''}`], o);
}
const HALLV = {
  id: 'shop_hall_n', name: 'ドット千日前ホール', hours: { spans: [[T(16), T(23)]], note: '' }, hoursNote: '営業 16:00〜23:00（ネタバトル 18:00〜）', flavor: 'owarai',
  ticket: 500, fee: 500, pay: 1000, stats: { adlib: 1.2, dokyo: 1.2, boke: 0.8, ma: 0.8 }, skill: 'warai', bgm: 'shop_live', hallLights: true,
  slots: () => [[T(18), T(21)]],
  perf: { name: 'ドット千日前ホール（若手ネタバトル）', size: 'small', crowd: 'tough', pressure: 40 },
  theme: { wall: 'dark', lobbyFloor: 'floor_concrete', hallFloor: 'floor_black', hall: 'floor' },
  clerk: HALL_CLERK, boss: { name: 'MCのゴリさん', look: { hair: 'spiky', hairColor: 'blonde', skin: 'tan', top: '#d8101c', bottom: '#20232a', glasses: 'sun' }, greet: 'MCのゴリや。今夜も、十組でしばきあいや。\n出るんやったら、客席に呑まれるなよ！' },
  greet: 'いらっしゃい。ここは、地下のお笑いホール。', bye: 'おおきに。また、バトルで会おな。', talkOpen: ['ここのバトルはな、客が点つけるんや。', 'ウケへんかったら、容赦ない。\nせやけど、そこで勝てたら、本物やで。'], talkAgain: 'もう話したやろ。出番、近いで。',
  intro: ['いらっしゃい！ 千日前ホールへようこそ。', '毎晩18時から、若手ネタバトルや。\n五百円で観られるし、エントリーすれば出られる。'],
  jobs: [{ label: '「若手ネタバトル」にエントリー（本番）', def: null }],
  cast: [
    { x: 7, y: 5, dir: 'down', look: { ...LOOKS.comedian2, top: '#ff7eb6' }, name: 'チラシを配る芸人', lines: ['今夜のバトル、十組や！ 五百円やで！', 'ウケへんかったら…それも見どころです！'], wander: 1 },
    { x: 9, y: 6, dir: 'up', look: { ...LOOKS.comedian, top: '#2f9a4a' }, name: '出番待ちの芸人', lines: ['今夜、六番目や。…緊張で、胃が痛い。', 'ここで一位とったら、ほんまに売れる子がおるんや。'] },
  ],
  audience: [
    { x: 3, y: 5, look: { ...LOOKS.fan, top: '#ffa860' }, name: 'お客さん', lines: ['（開演を待っている）', '五百円で十組も観られるんは、お得やで。'] },
    { x: 8, y: 7, look: LOOKS.salaryman, name: 'お客さん', lines: ['辛口の客が、ここの名物や。'] },
    { x: 11, y: 9, look: { ...LOOKS.oldman, top: '#8a6a4a' }, name: 'お客さん', lines: ['わしゃ、毎晩来とる。若いのの成長を見るんが、道楽や。'] },
  ],
  stageLine: '地下ホールの舞台だ。客席の近さに、足がすくむ。',
  gakuya: [
    { x: 3, y: 4, look: PEOPLEL.senpai, name: '楽屋の先輩', lines: ['バトルの前は、みんなピリピリしとる。', '一位とれんでも、顔を覚えてもらえたら、勝ちや。'] },
    { x: 6, y: 3, look: { ...LOOKS.comedian, top: '#d8101c' }, name: '出番待ちの若手', lines: ['ここのバトルは、客が点つけるんや。', 'ウケんかったら、シーンとなる。…あれは、こたえる。'] },
  ],
  sashiireLine: ['おっ、差し入れ！ おおきに！', 'おまえ、ええ後輩やな。MCに、言うとくわ。'],
};
HALLV.jobs = [];
HALLV.battle = battle;
venue(HALLV);

// ====================================================================== お笑いBAR 笑いの穴 (ネタ見せバー)
const BAR_MASTER = { name: '元芸人のマスター', look: { hair: 'spiky', hairColor: 'black', skin: 'tan', top: '#20232a', bottom: '#20232a', apron: '#8a1a2c', glasses: 'sun' } };
const barMenu = (g) => [
  { name: 'ワンドリンク（ビール）', price: 600, stress: 10, alc: true, desc: '入場のワンドリンク。最初の一杯。', text: 'ぷはーっ。…舞台の前の一杯は、勇気の水だ。' },
  { name: 'ワンドリンク（ウーロン茶）', price: 500, stress: 4, desc: 'お酒が飲めない人も、これで乾杯。', text: 'ごくごく。…のどが潤った。' },
  { name: byEra(g, { heisei_early: 'チューハイ', heisei: '酎ハイ', any: 'レモンサワー' }), price: 600, stress: 9, alc: true, desc: 'さっぱりした一杯。', text: 'しゅわっ。…おいしい。' },
  { name: 'ポテトフライ', price: 500, heal: 12, fill: 20, stress: 3, desc: '熱々のフライドポテト。', text: 'ホクホクのポテト。ケチャップは、お好みで。' },
  { name: 'ナッツの盛り合わせ', price: 400, heal: 6, fill: 10, stress: 2, desc: '軽いおつまみ。', text: 'ぽりぽり…。止まらない。' },
];
async function barAct(g) {
  const o = who(BAR_MASTER);
  const S = SS(g);
  if (!(S.d.k.cover_shop_netabar > 0)) { await g.say(['「ワンドリンク制だから、先に何か頼んでくれ」', 'と、マスターが目で言っている。'], o); return null; }
  const why = has(g, 'lifeRefusal') ? g.lifeRefusal() : null;
  if (why) { await g.say(why); return null; }
  if (dayN(g, 'bar_act') >= 1) { await g.say('今日はもう、ステージに立った。\n（ネタ見せは、1日1回まで）', o); return null; }
  if (g.state.stamina < 10) { await g.say('体力が足りない…。\n何か食べて、少し休んでからにしよう。'); return null; }
  const ogiri = [2, 4].includes(((g.state.day - 1) % 7 + 7) % 7);
  const kind = ogiri ? 'ogiri' : myKind(g);
  const k = await g.ask([`今夜は「${ogiri ? '大喜利ナイト' : 'ネタ見せナイト'}」。`, `${KIND_JA[kind]}を五分。お客さんは、酔っている。\n（体力 -10・チップがもらえるかも）`], ['出る', 'やめておく'], { ...o, cancel: 1 });
  if (k !== 0) return null;
  g.state.stamina -= 10;
  bumpN(g, 'bar_act');
  g.lifeTick && g.lifeTick({ stress: 4, hunger: -4, clean: -3 });
  let res = null;
  if (has(g, 'perform')) { try { res = await g.perform({ kind, venue: { name: 'お笑いBAR 笑いの穴', size: 'small', crowd: 'warm', pressure: 22 }, title: ogiri ? '大喜利ナイト' : 'ネタ見せBAR', ...(ogiri ? { mode: 'zabuton' } : {}) }); } catch (e) { console.error(e); res = null; } }
  if (!res || !Number.isFinite(Number(res.score))) res = { score: 35 + Math.floor(Math.random() * 40), rank: 'C' };
  const score = Number(res.score);
  const tip = Math.max(0, Math.round((score - 35) * 18 / 10) * 10);
  if (tip) g.addMoney(tip, true);
  const fans = Math.max(0, Math.round((score - 30) / 8));
  if (fans) g.addFans(fans, true);
  const lines = [score >= 75 ? 'お客さんが、ジョッキを持ったまま大笑いしている！' : score >= 50 ? 'ほどよく笑いが起きた。拍手もぱらぱら。' : score >= 35 ? '…半分くらいは、スマホを見ていた。' : 'ヤジが飛んだ。「つまんねえぞー！」'];
  if (score < 40) {
    const keep = await g.ask('ヤジが飛んでくる…。どうする？', ['ヤジを拾って返す', 'かまわず続ける', '頭をさげて降りる'], { cancel: 2 });
    if (keep === 0) { try { g.addComedyStat('adlib', 1, true); g.addComedyStat('dokyo', 1, true); } catch (e) { /* optional */ } lines.push('「おーい、そこの人、酔いすぎです！」\nどっと笑いが起きた。…ヤジを拾えた。（アドリブ・度胸 +1）'); }
    else if (keep === 1) { try { g.addComedyStat('dokyo', 1, true); } catch (e) { /* optional */ } lines.push('最後まで、やりきった。\n（度胸 +1）'); }
    else lines.push('頭をさげて、ステージを降りた。\n…悔しいけれど、次がある。');
  }
  lines.push(`ファン +${fans}${tip ? `　チップ ${fmtMoney(tip)}` : ''}`);
  const rec = stageRec(g, 'shop_netabar');
  rec.lives += 1;
  passTime(g, 40, 'ネタ見せBAR');
  await g.say(lines);
  return res;
}
{
  const bar = room(12, 9);
  bar.set(2, 1, 'S').set(3, 1, 'S').set(5, 1, 'p').set(7, 1, 'c').set(9, 1, 'p');
  bar.set(1, 2, 'k').set(2, 2, 'F').set(5, 2, 'F').rect(1, 3, 5, 1, 'C').rect(1, 4, 5, 1, 's');
  bar.rect(7, 2, 4, 2, ',').set(7, 2, 'a').set(10, 2, 'a').set(9, 3, 'Z');
  for (const x of [8, 10]) { bar.set(x, 6, 't'); bar.set(x - 1, 6, 'h'); bar.set(x + 1, 6, 'h'); }
  bar.set(1, 7, 'P').set(10, 7, 'P');
  bar.exit(5, 6);
  const menu = async (g, n) => {
    const o = who(n);
    const k = await g.ask('いらっしゃい。…初めてか？ ワンドリンク制だぜ。', ['ワンドリンクを頼む', 'ステージに立つ（ネタ見せ）', 'マスターの話を聞く', 'やめておく'], { ...o, cancel: 3 });
    if (k === 0) await orderMenu(g, { title: 'お笑いBAR 笑いの穴', entries: barMenu(g), host: n, thanks: pick(['まいど。', '楽しんでけよ。']), where: 'バー', cover: { id: 'shop_netabar', name: '席料', price: 300 } });
    else if (k === 1) await barAct(g);
    else if (k === 2 && !(await rumorTalk(g, 'netabar', o, ['おれは、元芸人だ。…売れなかったけどな。', 'この店は、売れなかった連中の、墓場じゃねえ。\n売れる前のやつらの、練習場だ。']))) await g.say('もう話したろ。ステージが、空いてるぜ。', o);
  };
  registerShop({
    id: 'shop_netabar', name: 'お笑いBAR 笑いの穴', bgm: 'shop_jazz', hours: { spans: [[T(18), T(27)]], note: '' },
    start: { room: 'main', x: 5, y: 7, dir: 'up' },
    rooms: {
      main: {
        floor: 'floor_wood_dark', wall: 'dark', tiles: bar.rows(),
        legend: { S: 'wall_dark+shop_sakeshelf', p: 'wall_dark+poster', c: 'wall_dark+clock', k: 'kitchen', F: 'fridge_drinks', C: 'counter', s: 'machi_stool', ',': 'floor_stage', a: 'speaker', Z: 'floor_stage+mic', t: 'table', h: 'chair', P: 'plant' },
        warps: bar.warps(5, 6),
        entities: [
          npc('nb_master', 3, 2, 'down', BAR_MASTER.look, BAR_MASTER.name, menu, { fixedDir: true }),
          npc('nb_kyaku1', 2, 4, 'up', { ...LOOKS.salaryman, blush: true }, '酔った会社員', ['おれはね、お笑いBARの常連なんだ。\nシロウトのネタを、肴に飲むのが好きでね。', '…でも、たまに、本物が出てくる。\nそういう夜は、帰りたくなくなるんだ。']),
          npc('nb_kyaku2', 4, 4, 'up', { ...LOOKS.fan, top: '#ff7eb6' }, 'お笑い好きの女の子', ['友だちが、ここで初舞台を踏むの。\n応援に来たんだ。', '緊張して、手が冷たくなってた。\n…でも、舞台に立つって、すごいよね。']),
          npc('nb_senpai', 7, 5, 'right', { ...LOOKS.comedian2, top: '#8a5ac8' }, '出番待ちの先輩', async (g, n) => { if (!(await rumorTalk(g, 'netabar_s', who(n), ['酔った客の前でやるのは、いい修行になるぞ。']))) await g.say('おれの出番は、まだだ。\n緊張を、ほぐしてる。', who(n)); }),
        ],
        events: [
          { x: 1, y: 3, w: 5, on: 'action', run: (g) => menu(g, BAR_MASTER) },
          { x: 9, y: 3, on: 'action', run: async (g) => { await g.say('小さなステージだ。センターマイクが、一本。'); await barAct(g); } },
        ],
        drawOver: stageLights(9, 2.6, 2),
        onEnter: (g) => firstVisit(g, 'shop_netabar', ['いらっしゃい。ここは「笑いの穴」。', 'ワンドリンクを頼んだら、ステージに立てる。\n五分、好きにやってくれ。ウケなくても、責めやしないぜ。'], BAR_MASTER),
      },
    },
    crime: false,
  });
}
