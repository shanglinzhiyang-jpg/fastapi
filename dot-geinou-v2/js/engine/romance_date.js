// 恋愛・結婚・家庭 (R12-L1) — dates, gifts, 告白, the little troubles, 別れ.
// Everything is a choice; nothing is required. Dates are HD scenes (romance_scene.js) with a few lines and one small choice
// that teaches you what the other person likes (the compatibility is never shown as a number: only what you have noticed).
import { PEOPLE } from './life.js';
import { ITEMS } from './state.js';
import { clamp, fmtMoney } from './util.js';
import { COLORS } from './draw.js';
import { ageOf, YEAR_DAYS } from './profile.js';
import * as D from './romance_data.js';
import {
  rom, active, recOf, leadRec, setStage, isCouple, airOf, compatOf, partnerWord, shortName, recLook, pgOf, eraOf, recAge, jobOf, addHist, addAlbum,
  blockReason, careerConflict, romMessage, queueEvent, onRomEvent, onRomTick, announce, affOf, ensureRomance, flat, smallTalk,
} from './romance.js';
import { playScene, sayAs, askAs } from './romance_scene.js';

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const sl = (rec, s, x) => D.sayLine(s, rec, x);
const clockNow = (g) => { try { return typeof g.clock === 'function' ? g.clock() : null; } catch (e) { return null; } };
const dateOf = (g) => { try { return typeof g.gameDate === 'function' ? g.gameDate() : null; } catch (e) { return null; } };
export const eraWord = (era, o) => o[era] ?? o.d ?? '';
// a spot's price: most are fixed; the ドライブ is cheaper in the player's own car (R16: the fuel only)
const priceOf = (g, s) => (typeof s.priceOf === 'function' ? s.priceOf(g) : s.price);

// ---------------------------------------------------------------- what can be done today
export function spotsFor(g, rec) {
  const st = g.state, era = eraOf(g);
  const season = D.seasonOf(dateOf(g));
  const ck = clockNow(g);
  const late = ck && ck.minutes >= 21 * 60 && ck.minutes < 28 * 60 + 0 && !(ck.minutes < 4 * 60);
  const out = [];
  for (const id of D.SPOT_ORDER) {
    const s = D.SPOTS[id];
    let why = null;
    if (s.season && !season.includes(s.season)) why = { hatsumode: 'お正月の時期だけ', sakura: '桜の季節だけ', natsu: '夏の夜だけ', xmas: 'クリスマスの時期だけ' }[s.season] || 'この季節だけ';
    if (!why && s.need) why = s.need(g, { age: ageOf(st), rec });
    if (!why && late) why = 'もう遅い時間だ';
    if (!why && st.money < priceOf(g, s)) why = 'お金が足りない…';
    if (!why && st.stamina < s.sta) why = '体力が足りない…';
    // rain: outdoors is possible, but the day is less fun (shown as a hint, not a block)
    out.push({ id, name: D.spotName(id, era), price: priceOf(g, s), why, hint: spotHint(g, rec, id), season: !!s.season });
  }
  // seasonal ones first when in season
  return out.sort((a, b) => (b.season && !b.why ? 1 : 0) - (a.season && !a.why ? 1 : 0));
}
// "・{name}はこういうのが好きかも" — only from what you have noticed
function spotHint(g, rec, id) {
  const s = D.SPOTS[id];
  const kn = rec.kn || [];
  const m = s.tags.find((t) => kn.includes(t));
  if (m) return `${D.TAGS[m].name}って言ってたな`;
  return '';
}
export function whyNotToday(g, rec) {
  const st = g.state;
  const why = blockReason(g);
  if (why) return why;
  if (rec.ld === st.day) return '今日はもう、会った';
  const ck = clockNow(g);
  if (ck && ck.minutes >= 21 * 60 && ck.minutes < 28 * 60) return 'もう遅い時間だ…。また明日';
  return null;
}
// Would they be free? Strangers sometimes are not; people who love you make time.
function theyAreFree(g, rec) {
  if (isCouple(rec)) return true;
  const R = rom(g);
  const j = D.JOBS[rec.jb] || {};
  const p = rec.st === 'know' ? 0.22 : 0.1;
  return D.rngNext(R) >= p * (j.busy || 1);
}

// ---------------------------------------------------------------- the date
const TOPIC = {
  talk: 'たくさん おしゃべりする', quiet: 'しずかに のんびり過ごす', warai: 'お笑いの話をする', music: '好きな音楽の話をする', gourmet: 'おいしいものの話をする',
  book: '最近読んだ本の話をする', sports: '体を動かす話をする', nature: '季節や自然の話をする', outdoor: '次に行きたい場所の話をする', indoor: 'おうちで過ごすのが好き、という話をする',
};
const TOPIC_HIT = {
  talk: ['おしゃべりが止まらなくなった。\n気づけば、ずいぶん時間がたっている。', '{name}の話に、目をまるくして笑った。'],
  quiet: ['だまっていても、気まずくない。\nそれが、なんだかうれしかった。', 'しずかな時間が、心地いい。'],
  warai: ['お笑いの話になると、目がきらきらした。\n「それ、{name}のネタで見たい！」', '好きな芸人の話で、おおいに盛り上がった。'],
  music: ['好きな曲の話で、手拍子まで出た。', '「今度、おすすめを聞かせて」と言われた。'],
  gourmet: ['おいしいものの話に、すっかり夢中だ。\n「今度、そのお店行こう！」', 'おなかが鳴って、ふたりで笑った。'],
  book: ['本の話になると、{I}の口もなめらかに。\n「その本、読んでみたい」と言ってくれた。', 'ふたりとも、本の虫だった。'],
  sports: ['体を動かすのが好きらしい。\n「今度いっしょに何かやろう」と盛り上がった。', '運動の話で、すっかり意気投合した。'],
  nature: ['季節の話で、ほっこりした。\n「春は桜、秋は紅葉…」と指を折って数えている。', '空を見上げて、同じことを考えていた。'],
  outdoor: ['「次はどこに行く？」と、地図を広げる勢い。\nおでかけが大好きなようだ。', '行きたい場所の話で、わくわくが止まらない。'],
  indoor: ['「おうちでのんびりが一番」という話で、意気投合。', 'ひとりの時間も、ふたりの時間も大事にしたい人のようだ。'],
};
const TOPIC_MISS = ['ふんふん、と聞いてくれた。', 'やさしく、うなずいてくれた。'];
const TOPIC_OPP = ['あまり、のってこなかった…。\n（ちょっと、好みがちがうのかも）', 'ふうん、と笑ってくれたけれど、少しぎこちない。'];

function pickTopics(g, rec) {
  const R = rom(g);
  const kn = rec.kn || [];
  const unknown = rec.tags.filter((t) => !kn.includes(t));
  const set = [];
  const first = unknown.length ? D.rngPick(R, unknown) : D.rngPick(R, rec.tags);
  set.push(first);
  while (set.length < 3) { const t = D.rngPick(R, D.TAG_ORDER); if (!set.includes(t)) set.push(t); }
  return D.rngShuffle(R, set);
}

// "What shall we talk about?": three topics; a match is a delight (and teaches you something), a mismatch is only quiet.
// Returns the ♥ bonus (3 / 1 / 0).
export async function topicRound(g, rec, who, sc) {
  const R = rom(g);
  const topics = pickTopics(g, rec);
  const i = await g.ask('どんな話をしよう？', topics.map((t) => TOPIC[t]), { cancel: 0 });
  const t = topics[i];
  const known = rec.kn || (rec.kn = []);
  if (rec.tags.includes(t)) {
    if (!known.includes(t)) known.push(t);
    if (sc && sc.burst) sc.burst(5);
    await g.say(rec.st === 'know' ? D.sayLine(D.rngPick(R, TOPIC_HIT[t]), rec) : sl(rec, D.rngPick(R, TOPIC_HIT[t])), who);
    if (!isCouple(rec)) await g.say(`（${D.TAGS[t].name}んだ、と気づいた）`);
    return 3;
  }
  if (D.TAGS[t] && D.TAGS[t].opp && rec.tags.includes(D.TAGS[t].opp)) {
    const opp = D.TAGS[t].opp;
    if (!known.includes(opp)) known.push(opp);
    await g.say(D.rngPick(R, TOPIC_OPP));
    return 0;
  }
  await g.say(sl(rec, D.rngPick(R, TOPIC_MISS)));
  return 1;
}

const SPOT_LINES = {
  cafe: (rec, era) => [
    eraWord(era, { showa: '（昔ながらの喫茶店。窓ぎわの席に座って、メニューをのぞきこんだ）', heisei_early: '（窓ぎわの席に座って、メニューをのぞきこんだ）', d: '（おしゃれなカフェの窓ぎわで、メニューをのぞきこんだ）' }),
    sl(rec, '「ミルクティーにしようかな。{name}は？」'),
    '（運ばれてきたカップから、あたたかい湯気がのぼる）',
    sl(rec, '「こうやってゆっくり話せるの、いいね{ne}」'),
  ],
  eiga: (rec, era) => [
    '（暗くなった劇場で、ならんで座った）',
    '（スクリーンの光が、となりの横顔をぼんやり照らしている）',
    sl(rec, '「…おもしろかった{ne}。帰りに、感想を言いあおう{yo}」'),
  ],
  live: (rec) => [
    '（小さな劇場は、満員の笑い声に包まれている）',
    sl(rec, '「プロの人って、すごい{ne}…！{name}は、どう思った{no}？」'),
    '（芸人どうしならではの目線で、ネタの感想を言いあった）',
  ],
  sanpo: (rec) => [
    '（公園の木もれ日の中を、ならんで歩いた）',
    sl(rec, '「風が気持ちいい{ne}。たまには、こうして歩くのもいい{yo}」'),
  ],
  gohan: (rec) => [
    '（ならんだ料理から、いいにおいがする）',
    sl(rec, '「いただきます！…ん、おいしい！{name}も食べて{ne}」'),
    '（おなかも、心も、ふくらんでいく）',
  ],
  izakaya: (rec) => [
    '（赤ちょうちんの下で、ジョッキをかかげた。「かんぱい！」）',
    sl(rec, '「はあ、おいしい…。仕事の話、聞いてくれる{no}？」'),
    '（ほろ酔いの笑い声が、にぎやかな店にとけていく）',
  ],
  karaoke: (rec, era) => [
    eraWord(era, { showa: '（スナックのカラオケ。画面は、白い文字が色づいていくタイプだ）', heisei_early: '（カラオケボックスの小さな部屋。リモコンの分厚い本をめくった）', heisei: '（カラオケボックスの小さな部屋。デンモクの画面をのぞきこんだ）', reiwa: '（カラオケの部屋。採点モードで勝負することになった）' }),
    sl(rec, '「{name}の歌、聞かせて{yo}！…{I}はこれ、歌う{ne}」'),
    '（歌って、笑って、タンバリンをたたいた）',
  ],
  suizokukan: (rec) => [
    '（青い水槽の前で、足が止まった）',
    sl(rec, '「見て、あの魚…{totemo}きれい{ne}」'),
    '（ゆらゆら泳ぐ魚を、ふたりでずっと眺めていた）',
  ],
  kanransha: (rec) => [
    '（観覧車「ドット・ベイホイール」に乗りこんだ）',
    '（ゴンドラが、ゆっくりと空へのぼっていく）',
    sl(rec, '「見て、海も…テレビ局も、ぜんぶ見える{yo}」'),
    '（てっぺんで、ふたりとも、しばらく黙っていた）',
  ],
  yakei: (rec) => [
    '（電波塔の展望台。街の灯りが、足もとに広がっている）',
    sl(rec, '「きれい…。この中に、みんなの暮らしがあるんだ{ne}」'),
    '（ガラスにうつる、ふたりの姿がならんでいた）',
  ],
  drive: (rec, era) => [
    eraWord(era, { showa: '（カーステレオから、カセットテープの音楽が流れる）', heisei_early: '（カーステレオから、お気に入りのCDが流れる）', heisei: '（カーナビに目的地を入れて、走り出した）', reiwa: '（スマホのプレイリストを流しながら、走り出した）' }),
    sl(rec, '「運転する{name}、ちょっとかっこいい{ne}」'),
    '（窓の外を、海と山がゆっくり流れていく）',
  ],
  home: (rec) => [
    '（部屋でのんびり。テレビの音が、小さく流れている）',
    sl(rec, '「こうしてるのが、いちばん落ち着く{ne}」'),
    '（ふたりで入れたお茶が、あたたかい）',
  ],
  hatsumode: (rec) => [
    '（神社は、おおぜいの人でにぎわっている）',
    '（ならんで手を合わせて、おみくじを引いた）',
    sl(rec, '「今年も、いい一年になりますように…って、お願いした{yo}」'),
  ],
  hanami: (rec) => [
    '（満開の桜の下に、レジャーシートを広げた）',
    sl(rec, '「花びら、{name}のかみについてる{yo}」'),
    '（お弁当を食べながら、ひらひら舞う花びらを見上げた）',
  ],
  hanabi: (rec) => [
    '（ドーン、と大きな音。夜空に大輪の花がひらいた）',
    sl(rec, '「わあ…！」'),
    '（ならんで見上げた横顔が、花火の色にそまっている）',
  ],
  xmas: (rec, era) => [
    eraWord(era, { showa: '（クリスマスイブの街は、恋人たちであふれている）', heisei_early: '（クリスマスイブの街は、恋人たちであふれている）', d: '（イルミネーションの光が、冬の夜を照らしている）' }),
    sl(rec, '「きれい…。{name}と見られて、よかった{yo}」'),
    '（白い息が、ふたりのあいだで、ふわっと混ざった）',
  ],
};

// A date: pay, go, talk, a choice, the result. o: { silent, bday }
export async function goDate(g, rec, spotId, o = {}) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const spot = D.SPOTS[spotId];
  if (!spot) return { ok: false, why: '？' };
  const why = whyNotToday(g, rec);
  if (why) { await g.say(`（${why}）`); return { ok: false, why }; }
  const sp = spotsFor(g, rec).find((x) => x.id === spotId);
  if (sp && sp.why) { await g.say(`（${sp.why}）`); return { ok: false, why: sp.why }; }
  const cc = careerConflict(g);
  if (cc) {
    const i = await g.ask([`${cc}。`, '約束の日に出かけると、お仕事のほうが大変かもしれない…。それでも会いに行く？'], ['やめておく', 'それでも会う'], { cancel: 0 });
    if (i !== 1) return { ok: false, why: cc };
  }
  if (!theyAreFree(g, rec)) {
    await g.say([`${shortName(rec)}にさそいのメッセージを送った。`, sl(rec, '『ごめん、今日は仕事{dap}って…。また今度{ne}』')]);
    return { ok: false, why: 'busy', busy: true };
  }
  const cost = priceOf(g, spot);
  if (!g.spend(cost)) { await g.say('（お金が足りない…）'); return { ok: false, why: 'money' }; }
  st.stamina -= spot.sta;
  const before = { stress: st.life.stress, hunger: st.life.hunger, stamina: st.stamina + spot.sta, money: st.money + cost };
  // the time of day: evening spots wait for the evening
  let phase;
  if (typeof g.advanceTo === 'function' && spot.night) { const ck = clockNow(g); if (ck && ck.minutes < 17 * 60 + 30) g.advanceTo(18 * 60, `${spot.go}までの時間`); }
  const ck = clockNow(g);
  phase = spot.night ? (spotId === 'kanransha' ? 'dusk' : 'night') : ck ? (ck.phase === 'evening' ? 'dusk' : ['night', 'late'].includes(ck.phase) ? 'night' : 'day') : 'day';
  if (spotId === 'kanransha') phase = ck && ['night', 'late'].includes(ck.phase) ? 'night' : 'dusk';
  const look = recLook(rec, era);
  const who = { name: PEOPLE[rec.id] ? PEOPLE[rec.id].name : rec.n, look };
  const first = rec.dates === 0;
  let gain = spot.aff;
  const wx = (() => { try { return g.weather && g.weather().kind; } catch (e) { return 'sunny'; } })();
  const rainy = spot.out && ['rain', 'heavyrain', 'storm', 'typhoon', 'snow'].includes(wx);
  let res;
  await playScene(g, { art: spot.art, title: D.spotName(spotId, era), you: look, bgm: spotId === 'yakei' || spotId === 'hanabi' || spotId === 'xmas' || spotId === 'kanransha' ? 'rom_night' : 'rom_date', phase, hearts: spotId === 'kanransha' || spotId === 'xmas' }, async (sc) => {
    await sc.intro(`${shortName(rec)}と ${D.spotGo(spotId, era)}`);
    if (rainy) await g.say('（あいにくの空模様…。それでも、ふたりで傘をさして出かけた）');
    const lines = (SPOT_LINES[spotId] ? SPOT_LINES[spotId](rec, era) : ['（ふたりで、のんびり過ごした）']);
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      await (/^[（(]/.test(L) ? g.say(L) : g.say(L, who));
    }
    // the first date: a small shy exchange
    if (first) await g.say(sl(rec, '「…こうして出かけるの、ちょっと照れる{ne}」', {}), who);
    // what shall we talk about?
    gain += await topicRound(g, rec, who, sc);
    // taste: remember what the player picks (the other side of compatibility)
    const tag = spot.tags[0];
    R.taste[tag] = (R.taste[tag] || 0) + 1;
    // the spot suits them?
    const shared = spot.tags.filter((x) => rec.tags.includes(x)).length;
    gain += shared * 2;
    if (rainy) gain -= 2;
    const c = compatOf(g, rec);
    gain = Math.round(gain * (0.8 + c.v * 0.12));
    gain = clamp(gain, 2, 14);
    // a closing moment
    if (isCouple(rec) && gain >= 8) { await g.say('（そっと手をつないで、歩き出した）'); sc.burst(6); }
    // effects
    g.relax({ stress: Math.round(spot.str * (0.7 + c.v * 0.15)) });
    if (spot.fill && g.canEat()) g.eat(Math.round(spot.fill / 3), { fill: spot.fill, silent: true });
    if (typeof g.advanceTime === 'function') g.advanceTime(spot.min, `デート（${D.spotName(spotId, era)}）`);
    g.addAff(rec.id, gain, true);
    rec.dates++;
    if (spotId === 'drive' && typeof g.carDrove === 'function' && g.carOwned() && !g.carDriveBlock()) g.carDrove({ km: 110, free: true }); // [R16] the 走行距離
    rec.ld = st.day;
    rec.lc = st.day;
    if (isCouple(rec)) rec.mo = clamp(rec.mo + 4 + Math.round(gain / 2), 0, 100);
    const stDelta = st.life.stress - before.stress;
    const chips = [];
    if (cost) chips.push(['お金', `-${fmtMoney(cost)}`, null]);
    const dSt = st.stamina - before.stamina;
    if (dSt) chips.push(['体力', `${dSt > 0 ? '+' : ''}${dSt}`, dSt > 0]);
    if (stDelta) chips.push(['ストレス', `${stDelta > 0 ? '+' : ''}${stDelta}`, stDelta < 0]);
    const note = gain >= 11 ? '最高の一日になった！' : gain >= 8 ? 'ふたりの距離が、ぐっと近づいた' : gain >= 5 ? '楽しい時間だった' : 'ちょっとぎこちなかったかも…';
    sc.flash = gain >= 11 ? 10 : 0;
    res = { gain, note, chips };
    await sc.result({ chips, note, name: who.name, look, hearts: isCouple(rec) ? Math.ceil(rec.mo / 20) : Math.max(1, Math.min(5, Math.ceil(affOf(g, rec) / 20))) });
  });
  if (first) addHist(g, `${shortName(rec)}と、はじめてのデート（${D.spotName(spotId, era)}）`);
  if (spotId === 'xmas') addAlbum(g, 'xmas', `${shortName(rec)}と、イルミネーション`);
  if (spotId === 'hatsumode') addAlbum(g, 'hatsumode', `${shortName(rec)}と、初詣`);
  if (spotId === 'hanabi') addAlbum(g, 'hanabi', `${shortName(rec)}と、花火大会`);
  // a bit of 熱愛報道 for those the public knows
  try {
    if (st.fame >= 400 && isCouple(rec) && spot.out && D.rngNext(R) < 0.08) queueEvent(g, 'koi_press', { id: rec.id }, 'koi_press');
  } catch (e) { console.error(e); }
  // a birthday date
  if (o.bday || rec.bdDay === st.day) rec.bdOk = st.day;
  return { ok: true, ...res };
}

// ---------------------------------------------------------------- messages from you (a quick chat)
export async function chatFlow(g, rec) {
  const st = g.state, R = rom(g);
  const era = eraOf(g);
  const look = recLook(rec, era);
  const who = { name: PEOPLE[rec.id] ? PEOPLE[rec.id].name : rec.n, look };
  const dev = D.DEVICE[era];
  const first = rec.lc !== st.day;
  const lines = {
    showa: `（公衆電話から、${shortName(rec)}の家に電話をかけた）`,
    heisei_early: `（公衆電話から、${shortName(rec)}のポケベルを鳴らした）`,
    heisei: `（${shortName(rec)}に、ケータイでメールを送った）`,
    reiwa: `（${shortName(rec)}に、メッセージを送った）`,
  }[era];
  await g.say(lines);
  await g.say(g.fmt(isCouple(rec) || rec.st === 'close' ? sl(rec, smallTalk(g, rec, R, era)) : smallTalk(g, rec, R, era)), who);
  if (first) { g.addAff(rec.id, 1, true); if (isCouple(rec)) rec.mo = clamp(rec.mo + 2 + (rec.busyAsk === st.day ? 4 : 0), 0, 100); }
  rec.lc = st.day;
  return true;
}

// ---------------------------------------------------------------- gifts
export function giftsInBag(g) {
  return Object.keys(g.state.items || {}).filter((id) => g.state.items[id] > 0 && ITEMS[id] && ITEMS[id].gift);
}
export async function giftFlow(g, rec, itemId) {
  const st = g.state;
  const def = PEOPLE[rec.id];
  if (!def) return false;
  const p = g.meet(rec.id);
  if (p.giftDay === st.day) { await g.say([`（今日は、もうプレゼントをわたした）`]); return false; }
  const look = recLook(rec, eraOf(g));
  const who = { name: def.name, look };
  const reaction = g.giftReaction(rec.id, itemId);
  const d = g.giveGift(rec.id, itemId);
  const nm = ITEMS[itemId] ? ITEMS[itemId].name : 'プレゼント';
  const key = { love: 'love', like: 'like', neutral: 'neutral', dislike: 'dislike' }[reaction] || 'neutral';
  const L = def.giftLines && def.giftLines[key];
  await g.say(`（${nm}をわたした）`);
  if (L && L.length) await g.say(String(L[0]).replaceAll('{item}', nm), who);
  if (isCouple(rec)) rec.mo = clamp(rec.mo + (reaction === 'love' ? 8 : reaction === 'like' ? 5 : reaction === 'dislike' ? 0 : 3), 0, 100);
  rec.lc = st.day;
  if (reaction === 'love' || reaction === 'like') {
    const T = rec.kn || (rec.kn = []);
    // what they like becomes known (as in people.js p.known)
  }
  if (rec.bdDay === st.day) rec.bdOk = st.day;
  return d;
}

// ---------------------------------------------------------------- 告白
const YES = {
  yasashii: ['…うれしい。{I}も、{name}のこと、ずっと気になってた{yo}。', 'はい。よろしくお願いします。'],
  akarui: ['え〜うれしい！！ほんとに？{I}でいい{no}？', 'もちろん！これからよろしく{ne}！'],
  majime: ['…まじめに、お付き合いしてください。\n{I}も、同じ気持ち{da}。', 'ありがとう。大切にする{ne}。'],
  mypace: ['ふふ、いいよ。のんびり、行こう{ne}。', '…うれしいな。ゆっくり、ふたりのペースで。'],
  shikkari: ['待ってた{yo}、その言葉。\nこちらこそ、よろしく{ne}。', '{name}のこと、ちゃんと支える{kara}。'],
  cool: ['…{I}でよければ。\n{name}となら、悪くない。', '…ありがとう。ちゃんと、伝わった{yo}。'],
  genki: ['ほんと！？やった〜！！', '今日から、よろしく{ne}！めいっぱい、楽しもう{ne}！'],
  ganbariya: ['{name}の夢、いちばん近くで応援させて。\n{I}も、がんばる{kara}。', 'よろしくお願いします。…ふたりで、前に進もう{ne}。'],
};
const NO = ['ごめんね。{name}のことは、大切な友だち…。\nこれからも、友だちでいてほしい。', 'ありがとう、うれしい。…でも、まだ、気持ちが追いつかなくて。\nもう少し、時間をもらえる？', 'ごめん…。{name}のこと、嫌いじゃないよ。\nでも、いまは、そういう気持ちになれない{no}。'];
export function canConfess(g, rec) {
  if (!active(g) || leadRec(g)) return '今は、もうひとりの大切な人がいる';
  if (ageOf(g.state) < 18) return '';
  if (rec.st !== 'close' && rec.st !== 'know') return '';
  if (g.aff(rec.id) < 30) return 'もう少し、仲よくなってから…';
  if (rec.conf && rec.conf.day && g.state.day - rec.conf.day < 8) return 'この前のことが、まだ新しい。少し待とう';
  return null;
}
export async function confessFlow(g, rec) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const why = canConfess(g, rec);
  if (why) { await g.say(`（${why}）`); return false; }
  const bw = blockReason(g);
  if (bw) { await g.say(`（${bw}）`); return false; }
  const air = airOf(g, rec);
  const ck = clockNow(g);
  const night = ck && ['night', 'late', 'evening'].includes(ck.phase);
  const look = recLook(rec, era);
  const who = { name: PEOPLE[rec.id] ? PEOPLE[rec.id].name : rec.n, look };
  const k = await g.ask(`${shortName(rec)}に、気持ちを伝える？\n（今の空気：${D.AIR_WORDS[air]}）`, ['伝える', 'まだやめておく'], { cancel: 1 });
  if (k !== 0) return false;
  // chance by the air (the words the player saw): 3 always, 2 mostly, 1 sometimes, 0 rarely
  const roll = D.rngNext(R);
  const ok = air >= 3 || (air === 2 && roll < 0.85) || (air === 1 && roll < 0.4) || (air === 0 && roll < 0.08);
  let result = false;
  await playScene(g, { art: night ? 'yakei' : 'park', title: night ? '夜の展望台' : '公園', you: look, bgm: 'rom_night', phase: night ? 'night' : (ck && ck.phase === 'evening' ? 'dusk' : 'day') }, async (sc) => {
    await g.say('（言葉を選びながら、思いきって気持ちを伝えた）');
    await g.say(['「ずっと、気になっていました」', '「よかったら…付き合ってください」']);
    await g.wait(500);
    if (ok) {
      sc.burst(8); sc.flash = 14;
      g.sfx('fanfare');
      await sayAs(g, who, sl(rec, D.rngPick(R, YES[rec.per] || YES.yasashii)));
      setStage(g, rec, 'dating');
      g.addAff(rec.id, 6, true);
      rec.mo = 80;
      rec.dates = Math.max(1, rec.dates);
      addHist(g, `${shortName(rec)}に告白して、恋人どうしになった`);
      addAlbum(g, 'kokuhaku', `${shortName(rec)}と、恋人どうしに`);
      result = true;
      await g.say([`${shortName(rec)}と、恋人どうしになった！`, '（ふたりのことは、スマホの「恋のはなし」から）']);
    } else {
      rec.conf = { n: (rec.conf ? rec.conf.n : 0) + 1, day: st.day };
      g.addAff(rec.id, -2, true);
      await sayAs(g, who, sl(rec, D.rngPick(R, NO)));
      await g.say('（友だちのままでも、大切な人にはかわりない。\nまた、少しずつ…）');
      st.life.stress = clamp(st.life.stress + 6, 0, 100);
    }
  });
  return result;
}

// ---------------------------------------------------------------- 別れ
const BYE_THEM = [
  'そっか…。話してくれて、ありがとう。\nこれまで、楽しかった{yo}。',
  '…うん、わかった。\nいろいろ、ありがとう。元気でね。',
  '{name}がそう決めたなら…。\nさよならじゃなくて、「またね」って言わせて。',
];
export async function breakUp(g, rec, o = {}) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const word = partnerWord(g, rec);
  const days = st.day - rec.since;
  const extra = rec.st === 'engaged' ? '（婚約を解消すると、式場のキャンセル料や、指輪のことで、ばたばたする）\n' : rec.st === 'cohab' ? '（いっしょに住んでいる部屋は、どちらかが出ていくことになる）\n' : '';
  const i = o.theirs ? 0 : await g.ask([`${shortName(rec)}との関係を、終わりにする？`, `${extra}（${Math.floor(days / 10)}か月ほど、いっしょにいた）`], ['別れ話をする', 'やめておく'], { cancel: 1 });
  if (i !== 0) return false;
  const look = recLook(rec, era);
  const who = { name: PEOPLE[rec.id] ? PEOPLE[rec.id].name : rec.n, look };
  await playScene(g, { art: 'park', title: 'ふたりの話し合い', you: look, phase: 'dusk', bgm: 'rom_night' }, async (sc) => {
    if (o.theirs) await g.say('（切り出されたのは、そのひと言だった）');
    else await g.say('（ゆっくり、ことばを選びながら、気持ちを話した）');
    await sayAs(g, who, sl(rec, D.rngPick(R, BYE_THEM)));
    await g.say(['（ふたりの間を、風が通りぬけていった）']);
  });
  const wasEngaged = rec.st === 'engaged';
  setStage(g, rec, 'ex');
  g.addAff(rec.id, -Math.round(g.aff(rec.id) * 0.55), true);
  rec.mo = 30;
  const cost = wasEngaged ? 50000 : 0;
  if (cost) { const pay = Math.min(st.money, cost); st.money -= pay; }
  st.life.stress = clamp(st.life.stress + (wasEngaged ? 25 : 18), 0, 100);
  addHist(g, `${shortName(rec)}と、別れた`);
  R.last.breakDay = st.day;
  await g.say([`${shortName(rec)}と、別れた。`, `（ストレス +${wasEngaged ? 25 : 18}${cost ? `・キャンセル料などで ${fmtMoney(Math.min(cost, st.money + cost))}` : ''}。\n時間がたてば、また友だちとして会える日もくる）`]);
  return true;
}
// They end it (the mood stayed at the bottom): a chance to talk.
onRomTick((g, R, ctx) => {
  const lead = leadRec(g);
  if (!lead || (lead.st !== 'dating' && lead.st !== 'cohab')) return;
  const st = g.state;
  if (lead.mo <= 8 && st.day - lead.lc >= 25) queueEvent(g, 'wakare_they', { id: lead.id }, 'wakare_they');
});
onRomEvent('wakare_they', async (g, d) => {
  const rec = recOf(g, d.id);
  if (!rec || rec.st === 'ex' || rec.st === 'married') return;
  const era = eraOf(g);
  const look = recLook(rec, era);
  const who = { name: PEOPLE[rec.id] ? PEOPLE[rec.id].name : rec.n, look };
  await g.say(`（${D.DEVICE[era] === '電話' ? '電話' : 'メッセージ'}が届いた。${shortName(rec)}からだ）`);
  await sayAs(g, who, sl(rec, ['…話したいことがあるの。\n最近、ずっと考えてた{nda}。', '{name}にとって、{I}って何なんだろう、って。']));
  const i = await askAs(g, who, '…どうする？', ['「待って、話をさせて」', '「…わかった」'], 1);
  if (i === 0 && g.state.stamina >= 6) {
    g.state.stamina -= 6;
    await sayAs(g, who, sl(rec, ['…ちゃんと聞く{yo}。\nだから、これからは、ちゃんと話して{ne}。']));
    rec.mo = 45; rec.lc = g.state.day;
    g.addAff(rec.id, 3, true);
    await g.say('（その夜は、遅くまで話しこんだ。…まだ、やり直せそうだ）');
  } else {
    await breakUp(g, rec, { theirs: true });
  }
});

// ---------------------------------------------------------------- the little troubles (a jealous remark, a silence)
const JEALOUS_Q = {
  showa: '「きのう、ブラウン管で見たよ。共演の人と、ずいぶん楽しそうだった{ne}」',
  heisei_early: '「テレビ見たよ。共演の人と、ずいぶん楽しそうだった{ne}」',
  heisei: '「テレビ見たよ。共演の人と、ずいぶん楽しそうだった{ne}」',
  reiwa: '「ネットで見たよ。共演の人と、ずいぶん楽しそうだった{ne}」',
};
onRomTick((g, R, ctx) => {
  const lead = leadRec(g);
  if (!lead || (lead.st !== 'dating' && lead.st !== 'cohab' && lead.st !== 'engaged')) return;
  const st = g.state;
  if (st.fame < 150 || st.day - (R.last.trouble || -99) < 24) return;
  if (D.rngNext(R) < 0.05) { R.last.trouble = st.day; queueEvent(g, 'jealous', { id: lead.id }, 'jealous'); }
});
onRomEvent('jealous', async (g, d) => {
  const rec = recOf(g, d.id);
  if (!rec || !isCouple(rec) || rec.st === 'married') return;
  const era = eraOf(g);
  const look = recLook(rec, era);
  const who = { name: PEOPLE[rec.id] ? PEOPLE[rec.id].name : rec.n, look };
  await g.say(`（${shortName(rec)}から、${D.DEVICE[era] === '電話' ? '電話' : 'メッセージ'}があった）`);
  await sayAs(g, who, sl(rec, [JEALOUS_Q[era], '…ううん、わかってる{yo}。仕事だって。\nでも、ちょっとだけ、さびしくなった{nda}。']));
  const i = await askAs(g, who, '…どうする？', ['仕事のことを、ちゃんと話す', '笑ってごまかす', '「ごめん、会いに行く」'], 1);
  if (i === 0) {
    await sayAs(g, who, sl(rec, ['…うん、聞けてよかった。\n{name}のこと、信じてる{yo}。']));
    rec.mo = clamp(rec.mo + 8, 0, 100); g.addAff(rec.id, 2, true);
  } else if (i === 1) {
    await sayAs(g, who, sl(rec, ['…そっか。\nまあ、いいけど。']));
    rec.mo = clamp(rec.mo - 7, 0, 100);
  } else {
    if (g.state.stamina >= 6 && g.state.money >= 1500) {
      g.state.stamina -= 6; g.spend(1500);
      await g.say('（夜の街で、小さな花を一輪、買っていった）');
      await sayAs(g, who, sl(rec, ['…ばか。\n来てくれて、ありがとう。']));
      rec.mo = clamp(rec.mo + 12, 0, 100); g.addAff(rec.id, 3, true); rec.lc = g.state.day;
    } else {
      await sayAs(g, who, sl(rec, ['…気持ちだけで、うれしい{yo}。']));
      rec.mo = clamp(rec.mo + 3, 0, 100);
    }
  }
});

// ---------------------------------------------------------------- 熱愛報道 (celebrities)
onRomEvent('koi_press', async (g, d) => {
  const rec = recOf(g, d.id);
  if (!rec || !isCouple(rec)) return;
  const st = g.state;
  announce(g, 'koi', `{fullname}、${jobOf(g, rec)}の${rec.cast ? shortName(rec) : rec.giv}さんと仲むつまじく…？`, { label: '恋愛' });
  await g.say(['（朝、スマホに通知が届いていた）', `週刊ドットに、${shortName(rec)}といっしょの写真が載ったらしい。`]);
  const i = await g.ask('どうする？', ['認める（堂々と）', 'ノーコメント', 'ただの友だちと言う'], { cancel: 1 });
  const look = recLook(rec, eraOf(g));
  const who = { name: PEOPLE[rec.id] ? PEOPLE[rec.id].name : rec.n, look };
  if (i === 0) {
    g.addFame(6, true); g.addFans(40, true);
    rec.mo = clamp(rec.mo + 8, 0, 100);
    await g.say('（正直に認めると、ネットには祝福の声が多かった。\nファンも、あたたかく見守ってくれている）');
  } else if (i === 1) {
    g.addFame(2, true);
    await g.say('（コメントを控えると、騒ぎは数日で静かになった）');
  } else {
    rec.mo = clamp(rec.mo - 10, 0, 100);
    st.life.stress = clamp(st.life.stress + 6, 0, 100);
    await sayAs(g, who, sl(rec, ['…「ただの友だち」、か。\n仕方ないのはわかってる。でも、ちょっと…ね。']));
  }
});

// ---------------------------------------------------------------- anniversaries and birthdays
onRomTick((g, R, ctx) => {
  const lead = leadRec(g);
  if (!lead || !isCouple(lead)) return;
  const st = g.state;
  // the partner's birthday: a hint in the morning (never a demand); a missed one hurts a little
  const doy = ((st.day - 1) % YEAR_DAYS) + 1;
  if (lead.bdDay && lead.bdDay !== st.day && lead.bdDay === st.day - 1 && lead.bdOk !== lead.bdDay) { lead.mo = clamp(lead.mo - 4, 0, 100); }
  if (doy === lead.bd && st.day - lead.since > 3 && lead.bdDay !== st.day) {
    lead.bdDay = st.day;
    ctx.msgs.push({ pri: 7, rec: lead, text: lead.st === 'married' ? '今日は、{I}の誕生日。\n…覚えてて、くれたかな。' : '今日、誕生日なんだ。\nお祝いしてもらえたら、うれしいな。' });
    ctx.notes.push(`（今日は、${shortName(lead)}の誕生日だ。会いに行く？プレゼントをわたす？）`);
  }
  // 3 / 6 / 12 months of being together (10 days = a month)
  if (lead.st === 'dating' || lead.st === 'cohab') {
    const n = st.day - lead.since;
    if ([30, 60, 120, 240].includes(n) && !lead.annDone || (lead.annDone && lead.annDone !== n && [30, 60, 120, 240].includes(n))) {
      lead.annDone = n;
      const label = { 30: '3か月', 60: '半年', 120: '1年', 240: '2年' }[n];
      ctx.msgs.push({ pri: 7, rec: lead, text: `今日で、付き合って${label}{da}。\nいつも、ありがとう{ne}。` });
      lead.mo = clamp(lead.mo + 3, 0, 100);
      addHist(g, `付き合って${label}`);
    }
  }
});

// On a day the career is busy, someone who loves you may ask for a little of your time (a call at night counts).
onRomTick((g, R, ctx) => {
  const lead = leadRec(g);
  if (!lead || (lead.st !== 'dating' && lead.st !== 'cohab')) return;
  const why = careerConflict(g);
  if (why && D.rngNext(R) < 0.12) {
    lead.busyAsk = g.state.day;
    ctx.msgs.push({ pri: 4, rec: lead, text: '今日は、お仕事の日{dap}よね。\n終わったら、ちょっとだけでも、声が聞きたいな。' });
  }
});

// ---------------------------------------------------------------- the justice core (an arrest reaches the one you love)
// (a guarded dynamic import, as people.js: the core is optional). A lover or spouse texts once; a prison term ends a young relationship
// (the person cannot wait) but not a marriage; coming home is welcomed.
const HEAVY = new Set(['robbery', 'assault', 'antisocial_ties', 'fraud_courier', 'bribery_take']);
if (typeof document !== 'undefined') {
  import('./crime.js').then(({ onJustice }) => {
    const safe = (fn) => (g, info) => { try { if (g && g.state && g.state.flags && g.state.flags.rom) fn(g, info || {}); } catch (e) { console.error('[romance] justice', e); } };
    onJustice('arrested', safe((g, info) => {
      const lead = leadRec(g);
      if (!lead || !isCouple(lead)) return;
      const heavy = HEAVY.has(info.crime);
      lead.mo = clamp(lead.mo - (heavy ? 18 : 10), 0, 100);
      romMessage(g, lead, lead.st === 'married' ? 'ニュース、見た…。\nちゃんと話を聞く{kara}。{name}のこと、信じて待ってる{yo}。' : 'ニュース見た…。\nびっくりした。…ほんとうのこと、話してくれる？', { force: true });
    }));
    onJustice('jailed', safe((g) => {
      const lead = leadRec(g);
      if (!lead || (lead.st !== 'dating' && lead.st !== 'cohab' && lead.st !== 'engaged')) return;
      if (lead.mo >= 75 && lead.st !== 'dating') { lead.mo = clamp(lead.mo - 15, 0, 100); romMessage(g, lead, '…待ってる、とは言えない。でも、待ちたい気持ちは、ある{yo}。', { force: true }); return; }
      setStage(g, lead, 'ex');
      g.addAff(lead.id, -Math.round(g.aff(lead.id) * 0.5), true);
      addHist(g, `${shortName(lead)}との関係が、終わった`);
      romMessage(g, lead, '…ごめん。待つことは、できそうにない。\nこれまで、ありがとう。元気で{ne}。', { force: true });
    }));
    onJustice('released', safe((g) => {
      const lead = leadRec(g);
      if (!lead || !isCouple(lead)) return;
      lead.mo = clamp(lead.mo + 10, 0, 100);
      romMessage(g, lead, 'おかえり。…ほんとうに、おかえり。\nゆっくり、休んで{ne}。', { force: true });
    }));
  }).catch(() => { /* no justice core */ });
}
