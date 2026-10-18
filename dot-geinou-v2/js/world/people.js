// The cast: people you can befriend (registerPerson, see engine/life.js).
//
// Every person here is linked to an NPC that is always in its place: the NPC entity in
// the place file carries `person: '<id>'`. Talking to such an NPC goes through
// PEOPLE_UI.talk (the menu 話す / プレゼント / さそう in phone.js); this module adds:
//   - 16 people with 4 heart events each (levels 1-4, run on the first talk at that level),
//     gift tastes and lines, phone messages, invitation lines and hangout lines
//   - 相方 (canPartner: the level-3 event asks you to form a combi) and 大切な人
//     (special: the level-4 event), asked again some days later when you said no
//   - a morning hook: friends text you (small talk, invitations for the day,
//     congratulations on a new title or on joining an agency)
//   - the shared gift items (sold in the shopping street)
//
// Fields used besides the documented ones (life.js / phone.js):
//   greets: ['…'] greetings, chats: [line | (g) => line | null] personal small talk:
//     the menu prompt (def.greet) picks one of them (partner / special lines first)
//   short: what others call them ('ジロー'), hello: first phone message (replaces the engine's generic one)
//   cheers: { rank, agency } phone congratulations ({rank}; string | (g) => string)
//   partnerMessages / specialMessages: phone small talk as your 相方 / 大切な人
//   combi: { ask, again, yes, no, taken, keep, already, bye } (canPartner)
//   confess: { ask, again, yes, no, friend, text } (special)
//   polite: true  です・ます generic lines (again, giftDone, hangDone, phone calls)
//   npcTalk: (g, npc, own) => …  replaces the NPC's own talk from ♥1 (no self-introductions
//     to a friend); own is the original. npcTalkFrom: 0 uses it from the first meeting
//     (when the place's own lines do not match the person's voice)
// Talking goes through phone.js's menu; this module only adds PEOPLE_UI.hooks (start: face
// and npcTalk, before: a declined proposal asked again, after: the first phone message) and
// PEOPLE_UI.extras (コンビを組もう / 気持ちを伝える after they asked once, 豚まん at the 大将).

import { registerPerson, PEOPLE, PEOPLE_UI, HANGOUTS, heartIndex, onMorning, isKansai } from '../engine/life.js';
import { registerItem, ITEMS, RANKS, rankIndex } from '../engine/state.js';
import { LOOKS } from '../engine/sprites.js';
import { fmtMoney } from '../engine/util.js';

// ---------------------------------------------------------------- gift items (shared ids)
// Sold in the shopping street (machi). No heal: they are meant for other people.
const GIFTS = {
  hanataba: { name: '花束', price: 2000, desc: '色とりどりの花束。楽屋見舞いの定番。' },
  cake: { name: 'ケーキ', price: 1200, desc: 'いちごののったショートケーキ。箱入り。' },
  okashi: { name: '高級お菓子', price: 3000, desc: '老舗の焼き菓子の詰め合わせ。目上の人にも喜ばれる。' },
  tea: { name: '紅茶セット', price: 1800, desc: '香りのいい茶葉と、クッキーのセット。' },
  manga: { name: 'マンガ', price: 600, desc: '話題の少年マンガの最新刊。' },
  book: { name: '小説', price: 1500, desc: '書店員さんおすすめの長編小説。' },
  cd: { name: '音楽CD', price: 2500, desc: '人気バンドの新しいアルバム。' },
  plushie: { name: 'ぬいぐるみ', price: 2200, desc: 'ふわふわのクマのぬいぐるみ。' },
  accessory: { name: 'アクセサリー', price: 8000, desc: 'きらりと光る、星のペンダント。' },
  butaman: { name: '豚まん', price: 800, desc: '大阪名物の豚まん。おみやげの定番。' },
};
for (const [id, def] of Object.entries(GIFTS)) {
  registerItem(id, { ...def, desc: def.desc + '\n（人に話しかけて「プレゼント」でわたそう）', gift: true });
}

// ---------------------------------------------------------------- helpers for the scenes
const who = (P) => ({ name: P.name, look: P.look });
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// the person speaks (pages that start with '（' are narration) / asks (B = the last choice) / narration
async function T(g, P, pages) {
  let group = [], narr = false;
  for (const s of [].concat(pages).filter((x) => x != null && x !== '')) {
    const isN = /^[（(]/.test(s);
    if (group.length && isN !== narr) { await g.say(group, narr ? {} : who(P)); group = []; }
    narr = isN;
    group.push(s);
  }
  if (group.length) await g.say(group, narr ? {} : who(P));
}
function Q(g, P, text, choices, cancel = choices.length - 1) { return g.ask(text, choices, { ...who(P), cancel }); }
function N(g, pages) { return g.say(pages); }
// an emote over the NPC we are talking to (no-op when it is not in this room)
function E(g, n, kind = '♥', frames = 40) {
  return n && n.id && g.map && g.map.npc(n.id) ? g.emote(n.id, kind, frames) : Promise.resolve();
}
function ME(g, kind = '!', frames = 40) {
  return g.map && g.map.player ? g.emote('player', kind, frames) : Promise.resolve();
}
function ev(level, run) { return { level, run }; }
// phone messages wrap on their own in the chat bubbles
const flat = (s) => String(s).replace(/\n/g, '');
// the first of these items that exists (place items are missing when a module failed)
function giveAny(g, ids, n = 1) {
  const id = ids.find((k) => ITEMS[k]);
  if (id) g.giveItem(id, n);
}
function tire(g, n) { g.state.stamina = Math.max(0, g.state.stamina - n); }
// a short "time passes" cut with a sound (performances)
async function cut(g, sfx = 'applause') {
  await g.fadeOut(12);
  g.sfx(sfx);
  await g.wait(300);
  await g.fadeIn(12);
}

const isPartner = (g, id) => g.state.partner === id;
const isSpecial = (g, id) => !!(g.state.people[id] && g.state.people[id].special);

// ======================================================================== the justice core: how people take it
// An arrest, a conviction, a term inside or a scandal reaches the people close to you (♥ 友だち+,
// the 相方 and the 大切な人 always): each texts once, in their own way, and how they feel changes —
// some stand by you, some worry and are let down, some keep away for a while (away: no small talk).
// Small talk and invitations stop for HUSH_ARREST days after an arrest; after a release the ones who
// stood by you say おかえり. The 相方 puts the combi on hold after the arrest of a known face and,
// after a 実刑 for a grave or violent offence (or with a cool bond), ends it. Chats never lighten the news.
// State: flags.people_jus { arrest, release, scandal, crime, told: { id: stance }, away: { id: untilDay }, combiPause }.
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const HUSH_ARREST = 7, HUSH_RELEASE = 3, AWAY_DAYS = 30, MAX_REACT = 3;
// small talk about watching the player's show (left out while the player is off the air)
const SAW_SHOW = /\{name\}(さん|どの|ちゃん)?の(出てる|出ている)?番組|あんたの(番組|テレビ)/;
// grave / violent offences and ties to 暴力団: most people step back
const HEAVY = new Set(['robbery', 'assault', 'antisocial_ties', 'fraud_courier', 'bribery_take']);
const STANCE = {
  oya: 'support', jiro: 'support', haruto: 'support', chiyo: 'support', tamae: 'support', taisho: 'support', korosuke: 'support',
  mio: 'worry', maruyama: 'worry', kaori: 'worry', emikawa: 'worry', momo: 'worry',
  hinata: 'distance', asagiri: 'distance', yoruno: 'distance', takeru: 'distance',
};
const JUS_LINES = {
  oya: { arrest: '{name}ちゃん、ニュースで見たわよ…。\nお部屋は、そのままにしてあるからね。\nちゃんと、正直に話すのよ。', release: 'おかえりなさい、{name}ちゃん。\nあったかいお茶、いれてあるわよ。\nまずは、ゆっくり眠りなさいね。' },
  jiro: { arrest: 'ニュース見たで…。\nなにしとんねん、ほんまに。\n…ちゃんと話してこい。待っとるから。', release: '出てきたんか。\n…おかえり。\nまた一から、やろうや。' },
  haruto: { arrest: 'ニュースを見ました。\n…正直、まだ信じられません。\nでも、ちゃんと向き合ってください。待っています。', release: 'おかえりなさい。\nまた、お店に寄ってください。\n話なら、いくらでも聞きます。' },
  maruyama: { arrest: 'ニュースを拝見したでござる…。\n罪は罪、きちんと償うでござるよ。\n拙者、それだけは言っておくでござる。', release: 'おかえりでござる。\n一からやり直すのに、遅すぎることはないでござるよ。' },
  mio: { arrest: 'ニュース、見たわ。\n…がっかりした、とだけ言っておく。\n逃げないで、ちゃんと向き合いなさい。', release: '出てきたのね。\n…やり直す気があるなら、見ていてあげる。' },
  hinata: { arrest: 'ニュースを見て、びっくりしました…。\n事務所から、しばらく連絡はひかえるように言われてしまって。\nごめんなさい。' },
  asagiri: { arrest: 'きょうのニュースで、{name}さんの件を読みました。\n原稿に、私情ははさめません。\n…どうか、誠実に。' },
  yoruno: { arrest: '番組のほうは、こちらでなんとかします。\n…しばらく、ご連絡はひかえます。' },
  kaori: { arrest: 'ニュースで知ったよ。\n…なんでなの？\nちゃんと話してくれるの、待ってるからね。', release: 'おかえり。\n…今度、ゆっくり話そう。' },
  emikawa: { arrest: 'ニュースを見ました…。\nぼくの立場では、何も言えないのが悔しいです。\nどうか、正直に。', release: 'おかえりなさい。\nまずは体を休めてください。\nこれからのことは、それからです。' },
  momo: { arrest: 'ニュース見た。\n…笑えないよ、これは。\nちゃんと反省して、ちゃんと戻ってきて。', release: 'おかえり。\n…正直、まだ怒ってる。\nでも、おかえり。' },
  chiyo: { arrest: 'ニュースを聞いたわ。\n…待つのは、慣れているの。\nでも、きちんと償ってちょうだい。', release: 'おかえりなさい。\n…待っていたわ。' },
  tamae: { arrest: 'ニュース見たで！あんた、なにやっとんの！\n…ちゃんと反省するんやで。\nおばちゃんは、見捨てへんからな。', release: 'おかえり！\n…やせたんちゃう？\nおばちゃんとこで、ごはん食べていき！' },
  takeru: { arrest: 'ニュース見ました…。\n正直、ショックです。\nしばらく、連絡はひかえます。' },
  korosuke: { arrest: 'ニュース見ました…。\n座長も、みんなも、心配してます。\nちゃんと戻ってきてくださいね。', release: 'おかえりなさい！\nまた一緒に舞台に立てる日、待ってます！' },
  taisho: { arrest: 'ニュース見たわ。\n…出てきたら、店に来い。\n説教と、たこ焼きや。', release: '…おかえり。\n約束どおり、たこ焼き焼いたるわ。' },
};
// generic lines (people without their own): by stance, then 関西弁 / です・ます / plain
const JUS_GENERIC = {
  arrest: {
    support: { k: 'ニュース見たで…。\nびっくりしたわ。でも、話はちゃんと聞くからな。', p: 'ニュースを見ました…。\n驚きました。でも、お話はちゃんと聞きます。', n: 'ニュース見たよ…。\nびっくりした。でも、話はちゃんと聞くから。' },
    worry: { k: 'ニュース見たで。\n…なんでや。ちゃんと向き合うて、償いや。', p: 'ニュースを見ました。\n…どうして、と思っています。\nきちんと向き合ってください。', n: 'ニュース見た。\n…どうして？\nちゃんと向き合って、ちゃんと償って。' },
    distance: { k: 'ニュース見たで。\n…しばらく、連絡はひかえるわ。', p: 'ニュースを見ました。\n…しばらく、ご連絡はひかえます。', n: 'ニュース見た。\n…しばらく、連絡はひかえるね。' },
  },
  scandal: {
    support: { k: '記事、読んだで。\n…ほんまのとこ、ちゃんと聞かせてや。', p: '記事を読みました。\n…本当のところを、聞かせてください。', n: '記事、読んだよ。\n…本当のところ、ちゃんと聞かせて。' },
    worry: { k: '記事、読んだで。\n…信じたいけど、ちゃんと説明してや。', p: '記事を読みました。\n…信じたいです。でも、きちんと説明してください。', n: '記事、読んだ。\n…信じたいけど、ちゃんと説明して。' },
    distance: { k: '記事、読んだで。\n…悪いけど、しばらく距離おかせてもらうわ。', p: '記事を読みました。\n…しばらく、距離をおかせてください。', n: '記事、読んだ。\n…ごめん、しばらく距離をおかせて。' },
  },
  // not in the news (an unknown face, or a minor: 少年法61条): they hear of it from others
  heard: {
    support: { k: '話、聞いたで…。\nびっくりしたわ。でも、話はちゃんと聞くからな。', p: 'お話、聞きました…。\n驚きました。でも、ちゃんと聞きます。', n: '話、聞いたよ…。\nびっくりした。でも、話はちゃんと聞くから。' },
    worry: { k: '話、聞いたで。\n…なんでや。ちゃんと向き合うて、償いや。', p: 'お話、聞きました。\n…どうして、と思っています。\nきちんと向き合ってください。', n: '話、聞いた。\n…どうして？\nちゃんと向き合って、ちゃんと償って。' },
    distance: { k: '話、聞いたで。\n…しばらく、連絡はひかえるわ。', p: 'お話、聞きました。\n…しばらく、ご連絡はひかえます。', n: '話、聞いた。\n…しばらく、連絡はひかえるね。' },
  },
  release: { k: 'おかえり。\n…また、ゆっくり話そな。', p: 'おかえりなさい。\nまた、ゆっくりお話ししましょう。', n: 'おかえり。\n…また、ゆっくり話そう。' },
};
const voice = (P) => (isKansai(P) ? 'k' : P.polite ? 'p' : 'n');
function jusState(g) {
  const fl = g.state.flags;
  if (!fl.people_jus || typeof fl.people_jus !== 'object') fl.people_jus = {};
  const J = fl.people_jus;
  if (!J.told || typeof J.told !== 'object') J.told = {};
  if (!J.away || typeof J.away !== 'object') J.away = {};
  return J;
}
// The people who hear it first: the 相方, the 大切な人, then friends (♥ 友だち+) by affection.
function closeOnes(g, n = MAX_REACT) {
  const st = g.state;
  const ids = Object.keys(st.people || {}).filter((id) => PEOPLE[id] && PEOPLE[id].kind !== 'family' && st.people[id].contact !== false
    && (st.partner === id || st.people[id].special || g.aff(id) >= 35));
  const rank = (id) => g.aff(id) + (st.partner === id ? 200 : 0) + (st.people[id].special ? 150 : 0);
  return ids.sort((a, b) => rank(b) - rank(a)).slice(0, n);
}
const stanceOf = (g, id, crime) => {
  const s = STANCE[id] || 'worry';
  // grave offences and 暴力団 ties: the worried step back, the loyal still worry; the 相方 / 大切な人 stay
  if (HEAVY.has(crime) && g.state.partner !== id && !(g.state.people[id] && g.state.people[id].special)) return s === 'support' ? 'worry' : 'distance';
  return s;
};
function jusText(g, id, kind, stance) {
  const P = PEOPLE[id];
  const own = JUS_LINES[id] && JUS_LINES[id][kind];
  if (own && !(kind === 'arrest' && stance !== (STANCE[id] || 'worry'))) return own;
  const gen = JUS_GENERIC[kind];
  const t = kind === 'release' ? gen : gen[stance] || gen.worry;
  return t[voice(P)] || t.n;
}
function jusSend(g, id, text) {
  const P = PEOPLE[id];
  const p = g.meet(id);
  if (!P || !p) return;
  p.msgDay = g.state.day;
  g.message({ from: P.name, person: id, kind: 'chat', text: flat(g.fmt(text)) });
}
// arrested / a scandal in the news: everyone close feels it (affection by stance and gravity);
// the closest MAX_REACT text you once each
function jusReact(g, crime, kind) {
  const st = g.state, day = st.day;
  const J = jusState(g);
  const heavy = HEAVY.has(crime);
  const known = st.fame >= 100;
  J.told = {};
  closeOnes(g, 20).forEach((id, n) => {
    const stance = stanceOf(g, id, crime);
    J.told[id] = stance;
    const d = stance === 'support' ? (heavy ? -2 : 0) : stance === 'worry' ? (heavy ? -6 : -2) : (heavy ? -10 : -4);
    if (d) g.addAff(id, d, true);
    if (stance === 'distance') J.away[id] = day + AWAY_DAYS;
    let text = jusText(g, id, kind, stance);
    // the 相方 of a known face: the combi takes a break
    if (st.partner === id && known && kind === 'arrest') {
      J.combiPause = day;
      text = isKansai(PEOPLE[id])
        ? 'ニュース見たで…。\nコンビの活動は、しばらく休止や。\n…ちゃんと向き合うてこい。話は、それからや。'
        : 'ニュース見た…。\nコンビの活動は、しばらく休止にしよう。\n…ちゃんと向き合ってきて。話は、それから。';
    }
    if (n < MAX_REACT) jusSend(g, id, text);
  });
}
// the judgment: a fine, a suspended term or 実刑 (the arrest already counted)
function jusConvicted(g, info) {
  const st = g.state;
  const J = jusState(g);
  const kind = info && info.sentence && info.sentence.kind;
  const crime = info && info.crime;
  const heavy = HEAVY.has(crime);
  const k = kind === 'prison' ? 2 : kind === 'suspended' ? 1.2 : 0.6;
  for (const id of closeOnes(g, 20)) {
    const stance = J.told[id] || stanceOf(g, id, crime);
    const base = stance === 'support' ? 0 : stance === 'worry' ? -3 : -5;
    const d = Math.round(base * k) - (heavy && stance !== 'support' ? 3 : 0);
    if (d) g.addAff(id, d, true);
    if (!J.told[id]) J.told[id] = stance;
  }
  J.convicted = st.day;
}
// a term starts: the 相方 decides about the combi
function jusJailed(g) {
  const st = g.state;
  const J = jusState(g);
  const id = st.partner;
  for (const pid of closeOnes(g, 20)) if (!J.told[pid]) J.told[pid] = stanceOf(g, pid, J.crime);
  if (!id || !PEOPLE[id]) return;
  const heavy = HEAVY.has(J.crime);
  if (heavy || g.aff(id) < 60) {
    const k = isKansai(PEOPLE[id]);
    jusSend(g, id, k
      ? 'ずっと考えとった。\n…コンビは、解散させてくれ。\nお前のこと、嫌いになったわけやない。けど、もう同じ舞台には立たれへん。'
      : 'ずっと考えてた。\n…コンビは、解散させてほしい。\n嫌いになったわけじゃない。でも、もう同じ舞台には立てない。');
    if (typeof g.setPartner === 'function') g.setPartner(null);
    else st.partner = null;
    if (st.people[id]) st.people[id].partner = false;
    delete J.told[id];
    J.combiEnded = st.day;
  }
}
// out again: the ones who stood by you say おかえり (two at most)
function jusReleased(g, info) {
  const st = g.state;
  const J = jusState(g);
  J.release = st.day;
  const ids = Object.keys(J.told).filter((id) => PEOPLE[id] && J.told[id] !== 'distance' && st.people[id]);
  ids.sort((a, b) => (st.partner === b) - (st.partner === a) || g.aff(b) - g.aff(a));
  for (const id of ids.slice(0, 2)) {
    const own = JUS_LINES[id] && JUS_LINES[id].release;
    let text = own || jusText(g, id, 'release', J.told[id]);
    if (st.partner === id && J.combiPause && info && info.prison) {
      text = isKansai(PEOPLE[id]) ? 'おかえり。\nネタ、ノートに書きためといたで。\n…一から、やり直そか。' : 'おかえり。\nネタ、ノートに書きためておいた。\n…一から、やり直そう。';
    }
    jusSend(g, id, text);
  }
  J.told = {};
  if (info && info.prison) J.combiPause = 0;
}
// (the justice core is optional: a guarded dynamic import)
import('../engine/crime.js').then(({ onJustice }) => {
  const safe = (fn) => (g, info) => { try { if (g && g.state && g.state.people && g.state.flags) fn(g, info || {}); } catch (e) { console.error('[people] justice', e); } };
  onJustice('arrested', safe((g, info) => {
    const J = jusState(g);
    J.arrest = g.state.day;
    J.crime = info.crime || null;
    // in the news only as a known face (crime.js knownFigure), never as a minor (少年法61条)
    let juvenile = false;
    try { const cs = g.jus().cases.find((c) => c.id === info.caseId); juvenile = !!(cs && cs.juvenile); } catch (e) { juvenile = false; }
    const pol = g.state.politics && g.state.politics.me && g.state.politics.me.office;
    jusReact(g, info.crime, !juvenile && (g.state.fame >= 100 || pol) ? 'arrest' : 'heard');
  }));
  onJustice('convicted', safe(jusConvicted));
  onJustice('jailed', safe(jusJailed));
  onJustice('released', safe(jusReleased));
  // cleared: the worried ones come back a little, nobody keeps away any more
  const cleared = safe((g) => {
    const J = jusState(g);
    for (const id of Object.keys(J.told)) if (J.told[id] !== 'support') g.addAff(id, 3, true);
    J.away = {};
  });
  onJustice('acquitted', cleared);
  onJustice('not_indicted', cleared);
  // a scandal with no arrest that day (暴力団との交際, a 週刊誌 story …): the same, as an article
  onJustice('scandal', safe((g, info) => {
    const J = jusState(g), day = g.state.day;
    // (a case's own stages — the arrest, the judgment — are answered by the hooks above)
    if (num(info.level) < 3 || info.caseId != null || num(J.arrest, -99) === day || num(J.scandal, -99) === day) return;
    J.scandal = day;
    J.crime = info.crime || null;
    jusReact(g, info.crime, 'scandal');
  }));
}).catch(() => { /* no justice core */ });

function otherSpecial(g, id) {
  return Object.keys(g.state.people).find((k) => k !== id && PEOPLE[k] && g.state.people[k].special) || null;
}

// The 相方: g.setPartner when the engine has it (toast + phone message), else the field.
function makePartner(g, id) {
  const old = g.state.partner;
  if (typeof g.setPartner === 'function') g.setPartner(id);
  else { g.state.partner = id; if (old && g.state.people[old]) g.state.people[old].partner = false; }
  g.meet(id).partner = true;
  if (old && old !== id && PEOPLE[old]) {
    const bye = (PEOPLE[old].combi && PEOPLE[old].combi.bye) || '新しい相方と、がんばってね。\nライバルとして、負けないから！';
    g.message({ from: PEOPLE[old].name, person: old, kind: 'chat', text: flat(g.fmt(bye)) });
  }
}
function makeSpecial(g, id, text) {
  if (typeof g.setSpecial === 'function') g.setSpecial(id, { text: text ? flat(g.fmt(text)) : undefined });
  else {
    for (const k of Object.keys(g.state.people)) if (k !== id) g.state.people[k].special = false;
    g.meet(id).special = true;
  }
}

// Level-3 scene of a canPartner person (again: they bring it up once more later).
async function combi(g, P, n, again = false) {
  const L = P.combi;
  const p = g.meet(P.id);
  const cur = g.state.partner;
  if (cur === P.id) { await T(g, P, L.already); return true; }
  let i;
  if (cur && PEOPLE[cur]) {
    i = await Q(g, P, L.taken.map((s) => s.replaceAll('{partner}', `「${PEOPLE[cur].short || PEOPLE[cur].name}」`)), ['組みかえる', 'いまの相方と続ける']);
  } else {
    i = await Q(g, P, again ? L.again : L.ask, ['組もう！', 'もう少し考えさせて']);
  }
  if (i !== 0) {
    // asked again in a few days, at most twice (not while you have another partner)
    p.combiAsk = g.state.day;
    p.combiTries = (p.combiTries || 0) + 1;
    if (cur && PEOPLE[cur]) p.combiTries = 9;
    await T(g, P, cur && PEOPLE[cur] ? L.keep : L.no);
    return false;
  }
  makePartner(g, P.id);
  g.sfx('fanfare');
  await E(g, n, '♥', 50);
  await T(g, P, L.yes);
  await N(g, `${P.short || P.name}と、コンビを組んだ！\n（相方がいると、お笑いのミニゲームが少しやさしくなる）`);
  return true;
}

// Level-4 scene of a special person (again: they bring it up once more later).
async function confess(g, P, n, again = false) {
  const L = P.confess;
  const p = g.meet(P.id);
  if (otherSpecial(g, P.id)) { await T(g, P, L.friend); return false; }
  const i = await Q(g, P, again ? L.again : L.ask, ['…うん。よろこんで', 'これからも友だちで']);
  if (i !== 0) {
    p.confessAsk = g.state.day;
    p.confessTries = (p.confessTries || 0) + 1;
    await T(g, P, L.no);
    return false;
  }
  makeSpecial(g, P.id, L.text);
  g.sfx('chime');
  await E(g, n, '♥', 60);
  await T(g, P, L.yes);
  return true;
}

// Generic lines for people who speak politely (です・ます), instead of phone.js's casual ones.
const POLITE = {
  again: 'ほかに、何かありますか？',
  giftDone: ['今日はもう、いただきましたから。', 'お気持ちだけで、じゅうぶんうれしいです。'],
  hangDone: '今日はもう、いっしょに過ごしましたから。\nまた今度、さそってくださいね。',
  callShy: ['もしもし？…あ、{name}さん。', 'また今度、ゆっくりお話ししましょうね。'],
  callAgain: ['今日はたくさん遊びましたね！', 'また今度、さそってください。'],
};

// Registers one of the cast (the menu prompt comes from greets / chats).
function person(id, def) {
  // lines that phone.js sends as messages (no manual line breaks in chat bubbles)
  for (const k of ['thanks', 'declined', 'partnerText']) if (typeof def[k] === 'string') def[k] = flat(def[k]);
  if (def.polite) for (const [k, v] of Object.entries(POLITE)) if (def[k] == null) def[k] = v;
  // a phone call answered in their own voice
  if (def.callYes == null && def.inviteYes) def.callYes = ['もしもし？', def.inviteYes];
  registerPerson(id, { ...def, cast: true, greet: (g) => greetFor(g, PEOPLE[id]) });
}

// ================================================================ 東京エリア
// ---------------------------------------------------------------- 大家さん (in front of ドット荘)
person('oya', {
  name: '大家さん', short: '大家さん', look: LOOKS.oldwoman, kind: 'local',
  where: '東京・ドット荘の前', again: 'ほかに何かあるかしら？',
  giftDone: ['今日はもう、いただいたわよ。', '気持ちだけで、じゅうぶんうれしいわ。'], hangDone: '今日はもう、いっしょに出かけたじゃないの。\nまた今度ね。',
  profile: 'ドット荘の大家さん。世話好きで、住人みんなのお母さんがわり。',
  loves: ['okashi', 'tea'], likes: ['hanataba', 'cake', 'book'], dislikes: ['drink', 'cd'],
  giftLines: {
    love: ['まあ、{item}！わたしの大好物よ。\nお茶の時間が楽しみになっちゃう。'],
    like: ['あら、{item}？うれしいわあ。\n{name}ちゃんは気がきくのねえ。'],
    neutral: ['まあまあ、わたしに？\n気をつかわなくていいのに。ありがとうね。'],
    dislike: ['あらら、{item}…。\nわたしにはちょっと、ハイカラすぎるかしら。', '気持ちだけ、ありがたくいただくわね。'],
  },
  greets: ['あら{name}ちゃん、どうしたの？', 'あら、おでかけ？\n気をつけていってらっしゃいね。'],
  chats: [
    'ちゃんとごはん食べてる？\n顔を見れば、大家にはわかるんだからね。',
    'お家賃のことで困ったら、まず相談するのよ。\nうちはね、だれも追い出したりしないんだから。',
    '今朝ね、ドット荘の前をはいてたら\n小学生に「テレビの人の家？」って聞かれちゃった。',
    '夜ふかしはお肌の大敵よ。\n…わたしが言っても、説得力ないかしらね。',
    (g) => (g.state.housing && g.state.housing !== 'dotsou' ? 'お引っ越し先はどう？\nたまには顔を見せに来てちょうだいね。' : null),
  ],
  inviteYes: 'あら、わたしでいいの？\nうれしいわあ。すぐ支度するわね。',
  thanks: '今日はつきあってくれてありがとう。\n若い人と出かけると、元気をもらえるわね。',
  declined: 'いいのよ、いそがしいものね。\nまた今度ね。',
  hello: '大家です。\nスマホのメッセージって、これで合ってるかしら？\n困ったことがあったら、いつでも連絡してね。',
  cheers: {
    rank: '「{rank}」になったんですって？\n商店街のみんなに自慢しちゃった。\nおめでとう、{name}ちゃん！',
    agency: '{agency}に入ったって聞いたわ！\nおめでとう。今夜はお赤飯ね！',
  },
  messages: [
    '{name}ちゃん、今日は冷えるわよ。\n上着、ちゃんと持って出かけてね。',
    '廊下の電球、新しくしておいたわ。\n夜おそく帰っても、もう暗くないわよ。',
    '煮物を作りすぎちゃったの。\nあとでドアノブにかけておくわね。',
    'テレビで若い芸人さんが話してるとね、\nつい{name}ちゃんの顔を探しちゃうの。',
    '今日はゴミの日よ〜。\n…なんて、大家のおせっかいでした。',
    'むかし住んでた子から、はがきが届いたの。\nみんな、それぞれの場所でがんばってるのね。',
  ],
  invites: [
    'お天気がいいから、「{spot}」でもどうかしら？\nたまにはおばあちゃんにつきあってちょうだい。',
    '{name}ちゃん、今日ひま？\n「{spot}」なんて、どう？',
    'たまには息抜きしなきゃだめよ。\n「{spot}」に行きましょうか。',
  ],
  hangout: {
    ramen: ['あら、ラーメンなんて久しぶり！\n…ちょっと、のびる前に食べなきゃ。', '若い人と食べると、なんでもおいしいわねえ。'],
    park: ['この公園の桜、むかしから変わらないの。\nドット荘ができたころから、ずっとよ。', 'ベンチに座ってると、時間を忘れちゃうわね。'],
    cafe: ['まあ、おしゃれなお店！\nカプチーノっていうのを、頼んでみようかしら。', '泡にハートが描いてあるわ！\nもったいなくて飲めないじゃないの。'],
    karaoke: ['わたしが歌えるの、古い歌ばっかりよ？\n…いいの？じゃあ、一曲だけ。', '（大家さんの歌声は、思いのほか力強かった）', 'ふふ、むかしとったきねづかよ。'],
    famires: ['ファミレスって、メニューがいっぱいで\n迷っちゃうのよねえ。', 'ドリンクバー、三杯もおかわりしちゃった。\n元をとらなきゃ、ね？'],
    sento: ['銭湯はいいわねえ。\n肩までつかると、疲れがお湯にとけていくの。', 'お風呂あがりのコーヒー牛乳は、\n腰に手をあてて飲むのが作法よ。'],
    default: ['たまにはこうして出かけるのも、いいものねえ。'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await N(g, '大家さんが、ほうきを動かす手を止めた。');
      const i = await Q(g, P, 'ねえ{name}ちゃん。\nドット荘の暮らしには、もう慣れた？', ['おかげさまで！', 'まだちょっと…']);
      if (i === 0) await T(g, P, 'それはよかった！\n住めば都って言うものねえ。');
      else await T(g, P, 'ふふ、最初はみんなそうよ。\n壁がうすいから、くしゃみをすると\nおとなりから「おだいじに」って聞こえるの。');
      await T(g, P, ['このアパートを始めて、もう四十年。\n芸人さん、役者さん、歌手の卵…\nいろんな子が住んでたのよ。', '売れた子も、夢をあきらめた子もいたけど…\nみんな、わたしの自慢の子なの。']);
      await E(g, n, '♪');
      await T(g, P, 'はい、これ。おむすび作りすぎちゃったの。\nおなかがすいたら食べなさいね。');
      g.giveItem('onigiri', 2);
    }),
    ev(2, async (g, P, n) => {
      await T(g, P, ['{name}ちゃん、ちょっと聞いてくれる？\nわたしね、若いころは劇場の売り子だったの。', '客席を回って、おせんべいやキャラメルを売ってね。\n舞台のすみっこから、毎日\n芸人さんたちを見てたのよ。']);
      const i = await Q(g, P, '舞台の上で笑ってる人たちが、\nまぶしくてねえ…。', ['いつか招待します！', 'もっと聞かせて']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, ['まあ…！\nそれじゃあ、いちばん前の席を\nとっておいてもらわなくちゃね。', 'うんと大きな拍手、練習しておくわ。']);
      } else {
        await T(g, P, ['そこで出会ったのが、亡くなった主人。\nいつも同じ席で、だれよりも大きな声で\n笑う人だったの。', '…さ、思い出話はおしまい！']);
      }
      await T(g, P, 'これ、ローソンののり弁。おいしいのよ。\n体が資本なんだから、しっかり食べてね。');
      g.giveItem('bento');
    }),
    ev(3, async (g, P, n) => {
      await N(g, '大家さんが、重そうな段ボール箱をかかえている。');
      const i = await Q(g, P, 'よいしょ…。あら、{name}ちゃん。\n町内会のバザーに出す品物なの。', ['運びます！', 'がんばって！']);
      if (i === 0) {
        tire(g, 5);
        await N(g, '{name}は段ボール箱を運んだ。\n…けっこう重い！（体力 -5）');
        await E(g, n, '♥');
        await T(g, P, 'まあまあ、助かったわ！\n若い人がいると、ほんとに心強いわねえ。');
      } else {
        await E(g, n, '…');
        await T(g, P, 'ふう、ふう…。\nこう見えて、まだまだ力持ちなのよ。');
      }
      await T(g, P, ['ひと休みしましょ。…はい、温かいお茶。', 'わたしね、ほんとは女優さんになりたかったの。\nでも、こわくてオーディションに行けなかった。', 'だから、夢に向かって走ってる子を見ると、\nつい応援したくなっちゃうのよ。']);
      g.relax({ stress: 10 });
      g.heal(10);
      await N(g, '温かいお茶で、体も心もほっとした。\n（ストレス -10・体力 +10）');
    }),
    ev(4, async (g, P, n) => {
      const away = !!g.state.housing && g.state.housing !== 'dotsou';
      await T(g, P, away
        ? '{name}ちゃん、来てくれたのね！\nお引っ越ししても、こうして顔を見せてくれて…\nほんとにうれしいわ。'
        : '{name}ちゃん、いつもありがとうね。\nあなたが「いってきます」って出かけていくと、\nわたしまで元気になるの。');
      await T(g, P, ['大家と住人なんて、ほんとは他人だけど…\nわたしにとっては、ドット荘の子は\nみんな家族なのよ。', 'どんなにえらくなっても、つまずいても、\nここがあなたの帰る場所。忘れないでね。']);
      await E(g, n, '♥', 60);
      const debt = (g.state.rent && g.state.rent.debt) || 0;
      if (debt > 0 && !away) {
        const off = Math.min(debt, 8000);
        g.state.rent.debt -= off;
        if (!g.state.rent.debt) g.state.rent.late = 0;
        await T(g, P, `それとね…たまってるお家賃、\n${fmtMoney(off)}ぶんは、わたしからのお祝い。\n…みんなには内緒よ？`);
        await N(g, `未払いの家賃が ${fmtMoney(off)} 減った。`);
      } else {
        await T(g, P, 'これ、少ないけど…お祝い。\n好きなものでも食べてちょうだい。\n…返すなんて言ったら、おこるわよ？');
        g.addMoney(3000);
      }
    }),
  ],
});

// ---------------------------------------------------------------- ジロー (the park stage)
person('jiro', {
  name: 'ストリート芸人 ジロー', short: 'ジロー', look: LOOKS.comedian, kind: 'comedian', dialect: 'kansai', canPartner: true,
  where: '東京の公園ステージ',
  profile: '大阪から来た芸人。相方が引退し、公園でひとり漫才を続ける。',
  loves: ['takoyaki', 'butaman'], likes: ['netacho', 'manga', 'bento', 'onigiri'], dislikes: ['tea', 'accessory'],
  giftLines: {
    love: ['うおっ、{item}やんけ！\nふるさとの味や…泣いてまうわ、ほんま。'],
    like: ['{item}！？ええの？\nおおきに！めっちゃうれしいわ。'],
    neutral: ['お、オレに？\nおおきに。…なんか照れるな。'],
    dislike: ['{item}…！？\nオレの部屋にはシャレすぎて、浮いてまうわ…。', 'ま、気持ちはもろとくで。おおきに。'],
  },
  greets: ['おっ、{name}やん！どないしたん？', 'よう来たな！今日の客、第一号や！'],
  greetPartner: ['相方！今日もネタ合わせしよか！\n…いや、その前に腹ごしらえや。', '相方、来たか！\n今日のオレ、なんかキレてる気がするで！'],
  chats: [
    'きのうの客、三人やったけど…\n三人とも笑てくれたから、満員御礼や！',
    'ネタ思いついたで！…あかん、言う前に忘れた。',
    '東京のツッコミは「なんでだよ」やろ？\nオレ、まだ慣れへんねん。',
    'ハトにだけは毎日ウケとるんや。\nパンくず持ってるからやけどな！',
  ],
  inviteYes: 'お、ええやん！\n行こ行こ、ネタの話もしようや！',
  thanks: '今日はおおきに！\nめっちゃ楽しかったわ。ネタ、ひとつ浮かんだで！',
  declined: 'さよか！ほな、また今度な！',
  hello: 'ジローや！登録したで。\nおもろいこと思いついたら、夜中でも送ってええからな！',
  partnerText: '相方、改めてよろしゅうな！\nコンビ名は…まあ、ゆっくり考えよ！',
  cheers: {
    rank: '「{rank}」やて！？やるやんけ！\nオレも負けてられへん。\n今日はひとりで祝杯や！…ラムネやけど。',
    agency: '{agency}に入ったんやて？\nすごいやん！おめでとうさん！\nオレのことも忘れんといてや〜。',
  },
  messages: [
    '今日の公園、風強すぎて\nオレの声、ぜんぶハトに持っていかれたわ。',
    '新ネタのタイトル決めたで。\n「ジローの冷蔵庫」。…中身はまだない！',
    'コンビニのおにぎり、具を当てる遊びしてたら\n店員さんに見られとった。はずかし。',
    'おかんから荷物届いた。\n中身ぜんぶ、ソースやった。なんでやねん。',
    'きのうの夜、ステージで練習してたら\n犬の散歩の人が拍手してくれた。犬も。',
    '{name}、ちゃんと寝とるか？\n寝不足のボケは、ツッコまれへんで。',
  ],
  partnerMessages: [
    '相方！新ネタ書けたで。\n今度のネタ合わせで見てくれ！',
    'オレらのコンビ名、まだ悩んでんねん。\n「ジローと{name}」…そのまんまやな。',
    '相方がおるって、ええな。\n朝起きて、今日もがんばろって思えるわ。',
  ],
  invites: [
    'なあ、今日ひまか？\n「{spot}」行かへん？ネタの話もしたいねん。',
    '{name}！「{spot}」行こや！\nたまには息抜きも芸のうちや！',
    '今日の営業おわり！\n「{spot}」でパーッといかへん？',
  ],
  hangout: {
    ramen: ['東京のラーメン、しょうゆ味がしみるわ…。\nこれはこれで、ええもんやな。', 'ネタのアイデア？\n…麺がのびるのといっしょに、全部消えたわ！'],
    park: ['いつもの公園ステージでは、毎日しゃべってんねん。\n客がおらん日も、木が聞いてくれとる。', '…なんてな！こっちの公園は静かでええな。\nたまには、ゆっくり歩くのもええわ。'],
    cafe: ['カフェって、なんで呪文みたいなメニューなん？\n「トール」て何や、背か？', 'このケーキ、うまっ！\n…これ、ネタにしてもええ？'],
    karaoke: ['よっしゃ、一曲目は大阪の歌や！\n…音程？そんなもん気持ちや！', 'お前、歌うまいな！\nオレのハモり、聞いてくれたか？'],
    famires: ['ハンバーグの鉄板、ジュージュー言うとる！\n…拍手みたいで、うらやましいわ。', 'ファミレスはな、芸人のネタ作り場なんや。\n何時間おっても怒られへん。'],
    sento: ['でっかい風呂は、ええなあ…。\n大阪の実家の近くの銭湯、思い出すわ。', '番台のおっちゃん、オレのネタで\nいっつも笑てくれてな。…最初の客や。'],
    default: ['たまには外でしゃべるのも、ええもんやな！'],
  },
  combi: {
    ask: ['{name}。…オレと、コンビ組まへんか？'],
    again: ['…なあ、{name}。この前の話、考えてくれた？', 'オレと、コンビ組まへんか？'],
    yes: ['ほ、ほんまか！？\nよっしゃあああ！！', 'ほな今日から、オレらは相方や！\nいつか、でっかい舞台に立とうな！'],
    no: ['…そっか。せやな、急すぎたわ。\nけど、オレはいつでも待っとるで！'],
    taken: ['…せや、お前には、もう{partner}って\n相方がおるんやったな。\nそれでも…オレと組んでくれへんか？'],
    keep: ['…せやな。相方は大事にせなあかん。\nほな、ライバルとしてよろしくな！'],
    already: 'これからもよろしゅうな、相方！',
    bye: '新しい相方と、がんばりや。\n…けど、ライバルとしては負けへんで！',
  },
  events: [
    ev(1, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['お！いつもステージの前で\n笑てくれとる人やろ？うれしかったで。', 'オレはジロー。\n大阪から出てきて、もう三年になるわ。']);
      await T(g, P, ['ほんまはな、相方とふたりで上京してん。\nけど去年、あいつは大阪に帰ってもうた。', 'それからは、ここでひとり漫才や。\n…ひとりやと、ツッコミがおらんのが痛いけどな！']);
      const i = await Q(g, P, 'せや、新しいボケ、聞いてくれへん？\n「オレの特技は早起きです。\n…夕方の五時に起きます！」', ['なんでやねん！', '（真顔で見つめる）']);
      if (i === 0) {
        g.sfx('hit');
        await E(g, n, '♥');
        await T(g, P, 'それや、それ！\nええツッコミ持ってるやん！\nまた聞きに来てや！');
        g.addSkill('warai', 1);
      } else {
        await E(g, n, '…');
        await T(g, P, '…真顔がいちばんこたえるわ。\nよっしゃ、もっとおもろいの考えてくる！');
      }
    }),
    ev(2, async (g, P, n) => {
      await T(g, P, ['見てくれ、これ。オレのネタ帳。\nもう十二冊目や。', '相方がおらんようになってから、\nひとりでもできるネタ、ずっと考えとるんや。']);
      const i = await Q(g, P, 'なあ、これどう思う？\n「東京は人が多すぎて、オレの存在感がゼロや。\n…改札が開かへんねん」', ['それは残高や！', '存在感のせいかも', 'ちょっとわかる']);
      if (i === 0) {
        g.sfx('hit');
        await E(g, n, '♥');
        await T(g, P, ['そう、それ！\nそのツッコミがほしかったんや！', '…やっぱり漫才は、ふたりのもんやな。']);
      } else if (i === 1) {
        await E(g, n, 'w');
        await T(g, P, 'ボケにボケで返すんかい！\n…いや、それはそれでおもろいな。');
      } else {
        await E(g, n, '…');
        await T(g, P, 'わかったらあかん！\nそこはツッコんでくれな、漫才にならへん！');
      }
      await T(g, P, 'これ、おすそわけや。\n新しいネタ帳、一冊あげるわ。\nおもろいこと思いついたら、書いとき！');
      g.giveItem('netacho');
    }),
    ev(3, async (g, P, n) => {
      await N(g, 'ジローが、ステージのはしにひとりで座っている。');
      await T(g, P, ['…お、{name}か。\nきのう、元の相方から電話があってな。', '「お前は東京で続けろ。\nええ相方、見つけろよ」…やって。']);
      await E(g, n, '…');
      await T(g, P, ['ひとりでしゃべるのも、悪ないけど…\nやっぱり、となりにだれかおってほしいねん。', 'ボケたら、ちゃんとツッコんでくれて。\nスベったら、いっしょに笑ってくれる…\nそんなやつが。']);
      await combi(g, P, n);
    }),
    ev(4, async (g, P, n) => {
      if (isPartner(g, P.id)) {
        await T(g, P, '相方！今日はふたりでステージや。\n行くで！');
        await cut(g);
        await N(g, ['ふたりの漫才に、公園の人たちが足を止めた。\n笑い声が、どんどん大きくなっていく…！', '最後のツッコミが決まると、\n大きな拍手がわき起こった！']);
        await E(g, n, '♥', 60);
        await T(g, P, ['…聞いたか、今の拍手。\nひとりのときは、こんなん聞いたことなかった。', 'お前と組んで、ほんまによかった。\nいつか、でっかい劇場でこの景色を見ような。\n約束やで、相方！']);
        g.addSkill('warai', 3);
        g.addFame(8);
        g.addMoney(1500);
        await N(g, '投げ銭は、ふたりで山分けした。');
      } else {
        await T(g, P, ['{name}、聞いてくれ！\nひとりで新ネタやったら、\n今日は客が二十人も集まってん！', 'お前がネタを聞いて、\nツッコんでくれたおかげや。']);
        await E(g, n, '♥', 60);
        await T(g, P, ['相方やなくても、お前はオレの…\nいちばんの「笑い仲間」や。', 'これからも、よろしゅう頼むで！']);
        g.addSkill('warai', 2);
        g.addFame(3);
      }
    }),
  ],
});

// ---------------------------------------------------------------- 春斗 (the ローソン clerk) 大切な人
person('haruto', {
  name: '店員の春斗さん', short: '春斗さん', look: LOOKS.clerk, kind: 'local', special: true, polite: true,
  where: 'ローソンのレジ', talkLabel: '買い物する',
  profile: 'ローソンで働く美大生。夜のレジで絵本の絵を描いている。',
  loves: ['manga', 'cd'], likes: ['book', 'cake', 'okashi'], dislikes: ['onigiri'],
  giftLines: {
    love: ['えっ、{item}…！？\nずっとほしかったんです。\n…どうして、わかったんですか？'],
    like: ['{item}、いいんですか？\nうれしいです。大事にします。'],
    neutral: ['ぼくに、ですか？\nあ、ありがとうございます…！'],
    dislike: ['あ…{item}。\n毎日、棚にならべてるやつですね…。', 'あ、いえ！うれしいです！…たぶん。'],
  },
  greets: ['いらっしゃいませ。…あ、{name}さん。', 'あ、{name}さん。こんにちは。'],
  greetSpecial: ['あ…{name}さん。\n今日も来てくれて、うれしいです。', '{name}さん。\n…シフト、いまからがんばれそうです。'],
  chats: [
    'きょうの新商品、メロンパンの中に\nプリンが入ってるらしいです。…攻めてますよね。',
    '深夜のシフトって、ちょっとさみしいけど…\n星がきれいに見えるんです。',
    'このあいだ、レジで{name}さんのうわさを\nしてるお客さんがいました。\n…ちょっとうれしかったです。',
    'スケッチブック、もう五冊目なんです。\nお客さんのいない時間に、少しだけ。',
  ],
  inviteYes: 'えっ、ぼくとですか？\n…はい！バイト、ちょうど終わるところです！',
  thanks: '今日はありがとうございました。\n帰ってから、今日の景色を描いてみます。',
  declined: 'はい、また今度…。\nお仕事、がんばってくださいね。',
  hello: '春斗です。\nあの、ほんとに登録してよかったんでしょうか…。\nよろしくお願いします。',
  cheers: {
    rank: 'お店のお客さんが、{name}さんが\n「{rank}」になったって話してました。\nおめでとうございます…！',
    agency: '{agency}に入ったんですね。\nおめでとうございます！\nレジから、ずっと応援してます。',
  },
  messages: [
    'おはようございます。夜勤あけです。\n帰り道の空がきれいで、つい送ってしまいました。',
    '新しい絵本のラフができました。\nクマがコンビニで働く話です。\n…ぼくのことじゃないです。',
    'エナジードリンクの棚、補充しておきました。\n…あんまり飲みすぎないでくださいね。',
    '美大の課題で「大切な風景」を描くことになって。\nローソンの前の道にしました。',
    '{name}さんの番組、休けい室のテレビで見ました。\n…店長より笑ってたかもしれません。',
    'おでん、はじめました。\n大根がいちばん人気です。…報告でした。',
  ],
  specialMessages: [
    'おはようございます。\n今日も一日、{name}さんにとって\nいい日になりますように。',
    '描きかけの絵本、主人公の顔が\nだんだん{name}さんに似てきちゃって…。\nこまってます。',
    'バイトの帰り道、{name}さんの好きそうな\nお店を見つけました。今度、行きませんか。',
  ],
  invites: [
    'バイト、休みなんです。\nよかったら「{spot}」に行きませんか？',
    'あの…「{spot}」に、いっしょに\n行ってもらえませんか。絵本のネタ探しもしたくて。',
    '今日、ひまでしたら…\n「{spot}」、どうですか？',
  ],
  hangout: {
    ramen: ['ラーメン、久しぶりです。\nいつもまかないのおにぎりなので…。', '湯気のむこうの{name}さん、\n…あ、いえ、なんでもないです。'],
    park: ['公園の木、スケッチしてもいいですか？\n…{name}さんも、少しだけ入れて。', 'できました。\n…はずかしいので、完成したら見せますね。'],
    cafe: ['このカフェ、窓ぎわの席が好きなんです。\n光がやわらかくて。', 'ラテアートって、絵の具とちがって\n一発勝負なんですよね。すごいなあ。'],
    karaoke: ['カ、カラオケ…。\nぼく、歌はほんとに自信なくて…。', '{name}さんの歌、すごかったです。\nぼく、ずっと拍手してました。'],
    famires: ['ファミレスのキッズメニューの絵、\nだれが描いてるんでしょうね。気になります。', 'ドリンクバーで、いちばんきれいな色の\nジュースを作ってみました。'],
    sento: ['銭湯の富士山の絵、いつか描いてみたいんです。\nペンキで、あんなに大きく。', 'ほかほかですね。\n…なんだか、ねむくなってきました。'],
    default: ['いっしょに出かけると、\nいつもの町が、ちがって見えますね。'],
  },
  confess: {
    ask: ['…{name}さん。\nこれからも、いちばん近くで\n応援させてもらえませんか。'],
    again: ['あの、{name}さん。', 'ぼく、やっぱり…\n{name}さんの、大切な人になりたいです。'],
    yes: ['…ほんとですか。\nよかった…ぼく、手がふるえてます。', '（春斗さんが、そっと手をにぎった。\nあたたかくて、少しふるえていた）', 'これからも、よろしくお願いします。\n…ぼくの、大切な人。'],
    no: ['…はい。\n友だちでいてくれるだけで、じゅうぶんです。\nこれからも、お店に来てくださいね。'],
    friend: ['…でも、{name}さんには\nもう大切な人がいるんですよね。', 'だから、ぼくは…\nいちばんのファンでいさせてください。\nこの絵本の、最初の読者になってくれますか。'],
    text: '今日のこと、夢じゃないですよね。\nおやすみなさい、{name}さん。',
  },
  events: [
    ev(1, async (g, P, n) => {
      await T(g, P, ['あの…いつも来てくださって、\nありがとうございます。', '名札、見えますか？\n「はると」です。春の、北斗七星の斗で、春斗。']);
      const i = await Q(g, P, 'よくエナジードリンクを買っていきますよね。\n…体、大丈夫ですか？', ['大丈夫！', '実はヘトヘト…']);
      if (i === 0) await T(g, P, 'それなら、いいんですけど…。\nむりは、しないでくださいね。');
      else {
        await E(g, n, '!');
        await T(g, P, 'やっぱり…。\nちゃんと寝て、ちゃんと食べてください。');
      }
      await T(g, P, 'これ、ぼくからです。\n…あ、ちゃんと自分で買ったやつですよ！');
      g.giveItem('bento');
    }),
    ev(2, async (g, P, n) => {
      await N(g, '春斗さんがレジの下から、スケッチブックをとり出した。');
      await T(g, P, ['あの、見てほしいものがあって…。\n公園のステージで、パフォーマンスしてる人の\n絵なんですけど。', '…{name}さんです。\n勝手に描いて、ごめんなさい。']);
      const i = await Q(g, P, '…へ、へんじゃないですか？', ['すごく上手！', 'ちょっとはずかしい']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, 'ほんとですか…！\nぼく、人に絵をほめられたの、\nひさしぶりです。');
      } else {
        await E(g, n, '…');
        await T(g, P, 'で、ですよね…！\nでも、楽しそうな顔だったから\nどうしても描きたくて。');
      }
      await T(g, P, 'ぼく、絵本作家になりたいんです。\nだれかの「がんばろう」になる絵を、\n描けるようになりたくて。');
      g.relax({ stress: 10 });
      await N(g, 'なんだか、胸のあたりがあたたかくなった。\n（ストレス -10）');
    }),
    ev(3, async (g, P, n) => {
      await N(g, '春斗さんが、元気なくレジに立っている。');
      await T(g, P, ['あ…{name}さん。\n絵本のコンクール、だめでした。', '一次審査で落ちちゃって。\nぼく、才能ないのかな…って。']);
      const i = await Q(g, P, '…すみません、こんな話。', ['あきらめないで', '自分も落ちてばかり']);
      if (i === 0) await T(g, P, 'あきらめないで…ですか。\n…そう言ってもらえるのを、\nずっと待ってた気がします。');
      else {
        await E(g, n, '!');
        await T(g, P, ['{name}さんも…？', 'そっか。テレビで見る{name}さんも、\nたくさん落ちて、ここまで来たんですね。']);
      }
      await E(g, n, '♥');
      await T(g, P, ['ぼく、もう一回描いてみます。\n次の絵本ができたら…\nいちばん最初に、読んでもらえますか？', 'これ、エナジードリンクです。\n…今日だけは、特別です。']);
      g.giveItem('drink');
    }),
    ev(4, async (g, P, n) => {
      await N(g, '夜のローソン。\nシフトを終えた春斗さんが、エプロンをはずした。');
      await T(g, P, ['{name}さん、待っててくれたんですか。', 'あの…絵本、できたんです。\nタイトルは『よぞらのレジ』。', '夜のコンビニに、毎日がんばってる人が来て…\nレジの店員が、その人から\n元気をもらう話です。']);
      await E(g, n, '…');
      await T(g, P, '…ぼくのことです。\n{name}さんがお店に来ると、\nその日一日、がんばれるんです。');
      await confess(g, P, n);
      g.relax({ stress: 20 });
    }),
  ],
});

// ---------------------------------------------------------------- 丸山さん (the extra in front of 東映)
person('maruyama', {
  name: 'エキストラの丸山さん', short: '丸山さん', look: { ...LOOKS.samurai, top: '#8a5a33' }, kind: 'local',
  where: '東映 撮影所の前', again: 'ほかに何かござるか？',
  giftDone: ['本日はもう、いただいたでござる！', 'お気持ちだけで、かたじけないでござる。'], hangDone: '本日はもう、たっぷり遊んだでござる！\nまたの機会に！',
  callShy: ['もしもし、丸山でござる。', 'また今度、ゆっくり話すでござる！'], callAgain: ['本日は、よく遊んだでござるな！', 'また今度でござる！'],
  profile: '平日は会社員、休日は時代劇のエキストラ。心は少年のおじさん。',
  loves: ['plushie', 'toei_sofubi', 'manga'], likes: ['takoyaki', 'toei_dango', 'cake', 'drink'], dislikes: ['book'],
  giftLines: {
    love: ['こ、これは…{item}！？\n拙者、感激でござる！\n家宝にするでござるよ！'],
    like: ['おお、{item}でござるか！\nかたじけない！'],
    neutral: ['拙者に？\nかたじけない。ありがたくいただくでござる。'],
    dislike: ['{item}…でござるか。\n拙者、字がぎっしりの本は\nすぐ眠くなってしまうでござる…。', '…いや、ありがたく枕元に置くでござる。\nかたじけない！'],
  },
  greets: ['{name}どの！本日もよき日和でござるな！', 'おお、{name}どの！\n…なんてね、こんにちは！'],
  chats: [
    '平日は経理の仕事、休日はエキストラ。\n二刀流でござる！',
    'きのうの撮影、斬られ役で三回も倒れたでござる。\n腰が…腰が…。',
    '子どものころの夢？ヒーローでござるよ。\n…いや、今もでござる！',
    '撮影所の茶屋の団子、食べたでござるか？\nあれは、拙者のエネルギー源でござる。',
  ],
  inviteYes: 'おお、お供つかまつる！\n…なんてね。行こう行こう！',
  thanks: '本日は、まことに楽しゅうござった！\nまた行こうでござる！',
  declined: '承知したでござる！\nまたの機会に！',
  hello: '丸山でござる。\n…メッセージだと、ござるが目立つでござるな。\nよろしくでござる！',
  cheers: {
    rank: '「{rank}」とな！？\nおめでとうでござる！\n拙者、会社の昼休みに小躍りしたでござる。',
    agency: '{agency}に入ったと聞いたでござる！\nめでたい！撮影所の仲間と、\n小道具の刀をかかげて祝ったでござる！',
  },
  messages: [
    '本日の撮影、町人Aでござった。\n三秒映るでござる。見のがし厳禁！',
    '会社でハンコを押すとき、\nつい「御免！」と言ってしまったでござる。',
    'ピクセリオンの新しい変身ポーズ、\n鏡の前で百回練習したでござる。',
    '娘に「パパの話は長い」と言われたでござる。\n…短くするでござる。以上でござる。',
    'きょうは雨でござるな。\n傘を刀のように持って歩くのは、\n危ないのでやめたでござる。',
    '{name}どのの出ている番組、録画したでござる。\n三回見たでござる！',
  ],
  invites: [
    '{name}どの！\n「{spot}」に、参らぬか？',
    '本日は撮影がない日でござる。\n「{spot}」など、いかがでござる？',
    '拙者、腹が減ったでござる…\nではなく、「{spot}」に行かないでござるか？',
  ],
  hangout: {
    ramen: ['ラーメンは、拙者の第二のエネルギー源でござる！\n…第一は団子でござる。', 'ふーふー…。\nメガネがくもって、なにも見えぬでござる！'],
    park: ['この公園で、娘とキャッチボールをしたでござる。\nもう、遠い昔でござるなあ。', 'ヒーローの決めポーズ、ここでやってよいでござるか？\n…とうっ！'],
    cafe: ['カフェとは…横文字の多い茶屋でござるな。', 'ふむ、このパンケーキ、なかなかの腕前でござる。'],
    karaoke: ['ヒーローの主題歌、歌うでござる！\n変身のかけ声もいっしょに！', 'はぁ、はぁ…\n全力で歌うと、変身したくなるでござる。'],
    famires: ['ハンバーグに旗が立っているでござる！\n…お子さまランチを頼んだでござる。', 'デザートは別腹でござる。\nこれは、武士の常識でござる。'],
    sento: ['風呂あがりの一杯は、フルーツ牛乳に限るでござる！', 'ふう…いいお湯でござった。\n極楽、極楽。'],
    default: ['いやあ、よき一日でござった！'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await T(g, P, ['おお、{name}どの。\nいつも声をかけてくれて、かたじけない。', 'じつは拙者、本名は丸山。\n平日は会社で経理をしているでござる。', 'この格好？撮影がない日も、\nつい着てしまうのでござる。\n…家族には不評でござる。']);
      const i = await Q(g, P, 'そうだ！ヒーローの決めポーズ、\nいっしょにやってみないでござるか？', ['やる！とうっ！', 'はずかしいので…']);
      if (i === 0) {
        g.sfx('whistle');
        await ME(g, '!');
        await E(g, n, '♥');
        await T(g, P, 'おお、見事なポーズ！\n{name}どのは、ヒーローの素質ありでござる！');
        g.addSkill('engi', 1);
      } else {
        await E(g, n, 'w');
        await T(g, P, 'はっはっは！\nはずかしがるのも、修行のうちでござる。');
      }
    }),
    ev(2, async (g, P, n) => {
      await E(g, n, '…');
      await T(g, P, ['…{name}どの。聞いてくれるでござるか。', 'きのう、中学生の娘に\n「パパのエキストラ、地味」と\n言われてしまったでござる…。']);
      const i = await Q(g, P, '主役じゃない役者は、\nやっぱり地味でござろうか…。', ['エキストラもかっこいい', '娘さんを撮影所に']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, ['…{name}どの。\nその言葉、胸にしみたでござる。', '画面のすみっこで、全力で生きる。\nそれが拙者の、ヒーロー道でござる！']);
      } else {
        await E(g, n, '!');
        await T(g, P, ['娘を撮影所に…！\nそれは名案でござる！', '撮影の熱気を見れば、\nきっとわかってくれるはずでござる！']);
      }
      await T(g, P, 'これはお礼でござる。\n撮影所で使っている台本メモでござるよ。');
      g.giveItem('daihon');
    }),
    ev(3, async (g, P, n) => {
      await T(g, P, ['じつは拙者、二十年前に\nヒーローの主役オーディションを\n受けたことがあるでござる。', '結果は…落選。\nあの日は、一晩じゅう泣いたでござる。']);
      await T(g, P, ['でも、エキストラで撮影所に通ううちに、\n気づいたでござる。', '主役が光るのは、\nうしろで全力で逃げる町人がいるから。\n…拙者は、その町人でござる！']);
      await E(g, n, '♥');
      await T(g, P, '{name}どのに、拙者の秘伝を伝授するでござる。\n「斬られたら、一拍おいて倒れる」！\nこれで画面が引きしまるでござる。');
      g.addSkill('engi', 2);
    }),
    ev(4, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['{name}どの！聞いてくだされ！\n娘が、撮影を見に来てくれたでござる！', 'そして帰り道に…\n「パパ、かっこよかった」と…！']);
      await E(g, n, '♥', 60);
      await T(g, P, ['{name}どのが、背中を押してくれたおかげでござる。\nほんとうに、かたじけない。', 'これは、拙者のコレクションの中から…\nいちばん大事なぬいぐるみでござる。\n受けとってほしいでござる。']);
      g.giveItem('plushie');
      await T(g, P, '拙者と{name}どのは、\n年の差をこえた親友でござる！');
    }),
  ],
});

// ================================================================ 東京の事務所・局・劇場
// ---------------------------------------------------------------- 虹谷ミオ (ホリプロ lobby)
person('mio', {
  name: '先輩女優 虹谷ミオ', short: '虹谷さん', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#ffffff', bottom: '#6b2f8e', skirt: true, jacket: true }, kind: 'actor',
  where: 'ホリプロ 1階ロビー',
  giftDone: ['今日はもう、もらったわよ。', '…気持ちだけ、受けとっておくわ。'],
  profile: 'ホリプロの実力派女優。気が強くて、まっすぐな努力家。',
  loves: ['hanataba', 'tea'], likes: ['book', 'okashi', 'accessory'], dislikes: ['drink'],
  giftLines: {
    love: ['{item}…！\nわたしの好きなもの、よくわかってるじゃない。', '…ありがとう。ほんとにうれしいわ。'],
    like: ['あら、{item}？\nセンスいいわね。もらっておくわ。'],
    neutral: ['わたしに？\n…ふうん。ありがと。'],
    dislike: ['{item}…。\nのどに悪いから、控えてるのよね。\n気持ちだけ、受けとっておくわ。'],
  },
  greets: ['あら、{name}。何か用？', 'ちょうどよかった。ひまなの、つきあって。'],
  chats: [
    '台本はね、最低三回は読むの。\n一回目は観客として、二回目は役として。',
    '今朝のロケ、雨で三時間待ち。\n…待つのも、女優の仕事よ。',
    '最近、いい顔するようになったじゃない。\n…べつに、ほめてないわよ？',
    '楽屋に届く花束って、\n見るだけで元気が出るのよね。',
  ],
  inviteYes: 'いいわよ。\nちょうど台本読みに疲れてたところ。',
  thanks: '今日は…まあ、楽しかったわ。\nまた付き合ってあげてもいいわよ。',
  declined: 'あら、そう。\n…べつに、残念じゃないわよ？',
  hello: '虹谷よ。\n言っておくけど、返信はおそいわよ。\nでも、ちゃんと読むから。',
  cheers: {
    rank: '「{rank}」ですって？\n…まあ、当然ね。わたしが見こんだんだもの。\nおめでとう。',
    agency: '{agency}に入ったのね。\nおめでとう。これで同じ土俵ね。\n…手かげんはしないわよ？',
  },
  messages: [
    '今日の撮影、NGゼロ。\n…たまには自慢させてよね。',
    'ドラマの役作りで、料理を習いはじめたの。\n包丁さばきは、殺陣より難しいわ。',
    '{name}、ちゃんと台本に線引いてる？\nわたしは三色ボールペン派よ。',
    '共演者の差し入れのケーキ、\nひとつ多く食べちゃった。…内緒よ。',
    'ゆうべは月がきれいだったわね。\n…ドラマのセリフじゃないわよ。',
    'オーディションに落ちた子がロビーで泣いてたの。\nむかしのわたしを見てるみたいだった。',
  ],
  invites: [
    '撮影がばらしになったの。\n「{spot}」、つきあいなさいよ。',
    '{name}、今日あいてる？\n「{spot}」に行きたい気分なの。',
    'たまには息抜きも必要よ。\n「{spot}」でどう？',
  ],
  hangout: {
    ramen: ['ラーメン屋さんのカウンター、好きなの。\n役の研究にもなるし。', '…ちょっと、スープまで飲むの見てた？\n女優だっておなかはすくのよ。'],
    park: ['台本を読むなら、公園のベンチがいちばん。\n風が、セリフを運んでくれる気がするの。', '…今のは、ちょっとクサかったわね。忘れて。'],
    cafe: ['ここの紅茶、香りがいいの。\nわたしのお気に入りの店よ。', '{name}は何を頼んだの？\n…ひと口、ちょうだい。'],
    karaoke: ['歌は専門じゃないけど…\nミュージカルの曲なら、まかせて。', '拍手しすぎよ。\n…でも、ありがと。'],
    famires: ['ファミレスって、ドラマの撮影でよく使うの。\n本物はこんな味なのね。', 'ポテト、シェアしましょう。\n…熱っ！'],
    sento: ['銭湯なんて、子どものころ以来。\n…いいわね、こういうの。', 'お風呂あがりの顔、撮られたら困るわ。\nすっぴんは非公開よ。'],
    default: ['たまには、こういう日も悪くないわね。'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await T(g, P, ['あら、また会ったわね。\n…名前、覚えてるわよ。{name}でしょ。', 'わたしはね、ここに入るまでに\nオーディションに十二回落ちてるの。']);
      const i = await Q(g, P, '落ちた数なら、だれにも負けないわ。\n…笑っていいわよ？', ['すごいです', '自分もたくさん落ちてる']);
      if (i === 0) {
        await E(g, n, '?');
        await T(g, P, 'すごい？\n…ふふ、そんなこと言われたの初めて。\n変な子ね。');
      } else {
        await E(g, n, '!');
        await T(g, P, 'あら、仲間ね。\n落ちるたびに、ちょっとずつ強くなるのよ。\nわたしが保証するわ。');
      }
      await T(g, P, 'これ、わたしの台本メモ。\n役の気持ちの書きこみ方、参考にしなさい。');
      g.giveItem('daihon');
    }),
    ev(2, async (g, P, n) => {
      await T(g, P, ['ちょうどいいところに来たわね。\n今度のドラマの読み合わせ、つきあって。', 'わたしの役は、遠くへ旅立つ人を\n駅で見送る女の子。', '「…行っちゃうんだね。\n　わたし、ここで待ってるから」']);
      const i = await Q(g, P, 'さあ、あなたのセリフよ。', ['「…ずっと、待ってて」', '「おなかすいた」', '（だまって見つめる）']);
      if (i === 0) {
        await E(g, n, '!');
        await T(g, P, 'うん、悪くないわ。\nまっすぐで、あなたらしい。');
      } else if (i === 1) {
        await E(g, n, '💢');
        await T(g, P, ['…ちょっと！\nいいシーンが台なしじゃない！', '…ふふっ、もう。\nでも、おかげで肩の力が抜けたわ。']);
      } else {
        await E(g, n, '♥');
        await T(g, P, ['…今の、すごくよかった。\nセリフがないほうが、伝わることもあるの。', 'あなた、お芝居の才能あるかもね。']);
      }
      g.addSkill('engi', 2);
    }),
    ev(3, async (g, P, n) => {
      await N(g, 'ロビーのソファで、虹谷さんが台本をにぎりしめている。');
      await T(g, P, ['…{name}。ちょっとだけ、いい？', '次の舞台、主役に決まったの。\nわたしの、初めての主演。']);
      await E(g, n, '…');
      await T(g, P, ['うれしいはずなのに…こわいの。\n幕が上がったら、真ん中に立つのは\nわたしひとり。', '失敗したら、全部わたしのせい。\n…こんなこと、だれにも言えなかった。']);
      const i = await Q(g, P, 'ねえ、あなたなら、どうする？', ['いっしょに練習する', '客席から見守る']);
      if (i === 0) await T(g, P, ['…いっしょに？\nふふ、主役の練習相手は高くつくわよ。', 'でも…ありがとう。\n少しだけ、勇気が出た。']);
      else await T(g, P, '客席から…。\nそうね。あなたがいると思えば、\nきっと前を向いていられる。');
      await E(g, n, '♥');
      await T(g, P, 'これ、のどあめ。\n本番前のお守りにしてたの。\nあなたにもあげる。');
      g.giveItem('nodoame');
    }),
    ev(4, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['{name}！聞いて！\n初日の幕、無事におりたわ。', 'カーテンコールで、客席が\n立ち上がって拍手してくれたの。\n…泣いちゃった。']);
      await E(g, n, '♥', 60);
      await T(g, P, ['あの日、あなたに弱音をはけたから。\n…ありがとう。', '今度は、あなたと同じ舞台に立ちたい。\n主役の座は、ゆずらないけどね。', '約束よ、{name}。\n…わたしの、いちばんのライバルさん。']);
      g.addSkill('engi', 3);
      g.addFame(5);
    }),
  ],
});

// ---------------------------------------------------------------- 研修生ひなた (ホリプロ studio)
person('hinata', {
  name: '研修生ひなた', short: 'ひなた', look: { hair: 'twin', hairColor: 'brown', skin: 'light', top: '#ffffff', bottom: '#ec8cae' }, kind: 'idol',
  where: 'ホリプロ 1階 レッスンスタジオ', talkLabel: '通し稽古を見る', polite: true,
  profile: 'ホリプロのアイドル研修生。元気いっぱいで、ちょっとドジ。',
  loves: ['accessory', 'cake'], likes: ['plushie', 'cd', 'nodoame'], dislikes: ['tea'],
  giftLines: {
    love: ['きゃーっ！{item}！？\nうれしすぎて、ターン三回しちゃいます！'],
    like: ['わあ、{item}！\nありがとうございますっ！'],
    neutral: ['わたしにですか？\nえへへ、ありがとうございます！'],
    dislike: ['{item}…！\nわたし、苦いのがちょっと苦手で…。\nで、でも、気持ちはうれしいです！'],
  },
  greets: ['あっ、{name}さん！おつかれさまですっ！', '{name}さん！今日も元気ですかっ？'],
  chats: [
    '今日のターン、三回に一回は成功しました！\n…あとの二回は、内緒です！',
    'ボイトレの音羽先生に「声が前に出てきた」って\n言われたんです！やったー！',
    '研修生のみんなで、デビューしたら\n何色の衣装にするか、毎日会議してます！',
    'ファンレターって、どうやったらもらえるんですか？\n{name}さん、コツ教えてください！',
  ],
  inviteYes: 'えっ、いいんですか！？\nレッスン終わったら、すぐ行きます！',
  thanks: '今日はありがとうございました！\n楽しすぎて、帰り道スキップしちゃいました！',
  declined: 'りょうかいですっ！\nまたさそいますね〜！',
  hello: 'ひなたです！登録しました〜！\nスタンプ、いっぱい送っちゃうかもです！',
  cheers: {
    rank: '{name}さん、「{rank}」おめでとうございます！！\n研修生のみんなで、拍手しました！',
    agency: '{agency}所属、おめでとうございますっ！\nわたしも早くデビューして、追いつきます！',
  },
  messages: [
    '今日のレッスン、先生に初めて\n「いいね」って言われました！記念日です！',
    'ソウくんとくるみちゃんと、\nデビュー曲のふりつけを妄想してました！',
    '朝のランニング、三日続きました！\n…四日目は、寝坊しました。',
    'ボイトレで高い音が出たんです！\nそしたら窓ガラスがビリビリって…うそです！',
    '{name}さん、今度のお休みに、\nおすすめのダンス動画、教えてください！',
    'ダンスシューズに名前を書いたら、\nまちがえて「ひなな」になってました…。',
  ],
  invites: [
    'レッスンお休みなんです！\n「{spot}」に行きませんか？',
    '{name}さん、「{spot}」行きましょう！\nわたし、行ってみたかったんです！',
    'ごほうびデーです！\nいっしょに「{spot}」、どうですか？',
  ],
  hangout: {
    ramen: ['ラーメン、ひさしぶりです！\nレッスンのあとだと、体じゅうにしみます〜！', '替え玉…してもいいですか？\nえへへ、成長期なので！'],
    park: ['ここでダンスの自主練してもいいですか？\nワン、ツー…わっ、つまずいた！', '{name}さんも、いっしょに踊りましょ！\nたのしい〜！'],
    cafe: ['このパフェ、写真とってもいいですか？\nかわいすぎます！', '研修生のみんなにも、教えてあげよっと！'],
    karaoke: ['まずはデビュー曲（予定）から歌います！\n…まだないので、即興です！', '{name}さんの歌、プロみたい！\n…あ、プロでしたっ！'],
    famires: ['ファミレスって、わくわくしますよね！\nメニュー、ぜんぶ食べたいです！', 'ドリンクバーのメロンソーダ、\nわたしの元気の源です！'],
    sento: ['おっきいお風呂！\n泳いじゃだめですよね？…ですよね！', 'ぽかぽかで、ほっぺたがまっかです〜。'],
    default: ['{name}さんとおでかけ、\n楽しいです！また来ましょうね！'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['あっ、{name}さん！\nいつも見学に来てくれる方ですよね？', '研修生のひなたです！\nいつか、ここのみんなでデビューするのが夢です！']);
      const i = await Q(g, P, 'あの、人前で緊張しない方法って\nありますか？', ['手に「人」と書く', '客をカボチャだと思う', '楽しむこと！']);
      if (i === 0) await T(g, P, '手のひらに「人」…\n…あっ、「入」って書いちゃった！\nもう一回！');
      else if (i === 1) await T(g, P, 'カボチャ…！\nじゃあ、拍手はカボチャのダンス…？\nなんか楽しくなってきました！');
      else {
        await E(g, n, '♥');
        await T(g, P, '楽しむこと…！\nそれ、ダンスのリズ先生も言ってました！\nよーし、メモメモ！');
      }
      await T(g, P, 'お礼に、これどうぞ！\nボイトレの先生おすすめの、のどあめです！');
      g.giveItem('nodoame');
    }),
    ev(2, async (g, P, n) => {
      await N(g, 'レッスン室に、ひなたがひとり残って踊っている。');
      await T(g, P, ['あ、{name}さん…。\nみんなはもう帰っちゃいました。', 'わたし、ふりつけを覚えるのが\nいちばんおそくて…。\nだから、居残り練習なんです。']);
      const i = await Q(g, P, 'カウント、とってもらえませんか？', ['いっしょに踊る', '手拍子でカウント']);
      if (i === 0 && g.state.stamina >= 10) {
        tire(g, 10);
        await N(g, '{name}もいっしょに踊った！（体力 -10）');
        await E(g, n, '♥');
        await T(g, P, 'すごい！{name}さんと踊ったら、\nステップがすっと入ってきました！');
        g.addSkill('uta', 2);
      } else {
        if (i === 0) await T(g, P, 'あっ、{name}さん、ヘトヘトじゃないですか！\nじゃあ、手拍子でお願いします！');
        g.sfx('snare');
        await T(g, P, '5、6、7、8！…できた！\n最後まで、まちがえずに踊れました！');
        g.addSkill('uta', 1);
      }
      await T(g, P, 'わたし、あきらめません！\nだって、ダンスが大好きだから！');
    }),
    ev(3, async (g, P, n) => {
      await E(g, n, '…');
      await T(g, P, ['{name}さん…。\nデビューメンバーの発表、ありました。', '…わたしの名前、なかったんです。', 'ソウくんも、くるみちゃんも、まだで…\nほかの研修生が、選ばれて。\n…その子、ほんとにがんばってたから。']);
      const i = await Q(g, P, 'わたし、まだ…ここにいていいのかな。', ['ひなたなら大丈夫', 'くやしいって言っていい']);
      if (i === 0) {
        await E(g, n, '!');
        await T(g, P, '…大丈夫、ですか。\n{name}さんが言うと、\nほんとにそんな気がしてきます。');
      } else {
        await E(g, n, '…');
        await T(g, P, '…はい。\nくやしい！くやしいです！\n…ふう。言ったら、すっきりしました。');
      }
      await E(g, n, '♥');
      await T(g, P, 'これ、研修生のみんなで録った\nデモのCDです。\nいつか、本物を渡しますね！');
      g.giveItem('cd');
    }),
    ev(4, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['{name}さん！！\nききき、聞いてください！', 'わたしと、ソウくんと、くるみちゃん…\n三人でユニットデビューが決まりました！']);
      g.sfx('fanfare');
      await E(g, n, '♥', 60);
      await T(g, P, ['研修生になって、何回も泣いたけど…\n{name}さんがいつも話を聞いてくれたから、\nここまで来られました。', '{name}さんは、わたしの\nいちばん最初のファンで…\nいちばんのライバルです！', 'いつか、同じステージで歌いましょうね！\n約束ですっ！']);
      g.addSkill('uta', 3);
      g.addFame(5);
    }),
  ],
});

// ---------------------------------------------------------------- 朝霧さん (NHK news studio)
person('asagiri', {
  name: 'アナウンサー 朝霧さん', short: '朝霧さん', look: { ...LOOKS.announcer, top: '#ffffff', bottom: '#3a58a8' }, kind: 'staff',
  where: 'NHKニューススタジオ', polite: true,
  profile: 'NHKの若手アナウンサー。努力家で読書好き。すごい猫舌。',
  loves: ['book', 'tea'], likes: ['hanataba', 'okashi', 'wadai'], dislikes: ['takoyaki'],
  giftLines: {
    love: ['{item}…！\nうれしいです。休みの日の楽しみが\nひとつ増えました。'],
    like: ['{item}、ありがとうございます。\n大切にいただきますね。'],
    neutral: ['わたしに、ですか？\nお気づかい、ありがとうございます。'],
    dislike: ['た、{item}…！\nわたし、すごい猫舌で…。\n冷めるまで待ってから、いただきますね。'],
  },
  greets: ['こんにちは、{name}さん。今日はどうされました？', '{name}さん。本番前なので、少しだけなら。'],
  chats: [
    '今日の早口ことば、聞いてもらえますか？\n「東京特許許可局」…よし、言えました！',
    '本番前は、いつも「あめんぼ あかいな」から。\n声のウォーミングアップなんです。',
    'ニュースの原稿に知らない地名が出てきて…\n辞書を三冊ひきました。',
    '休みの日は、図書館にこもるのが好きなんです。\n静かで、落ちつくので。',
  ],
  inviteYes: 'いいですね。\n本番の反省会は、あしたにします！',
  thanks: '本日はありがとうございました。\nとても楽しい時間でした。',
  declined: '承知しました。\nまたの機会に、ぜひ。',
  hello: '朝霧です。\nメッセージでも、つい敬語になってしまいます。\nこれからも、よろしくお願いいたします。',
  cheers: {
    rank: '「{rank}」になられたと聞きました。\nおめでとうございます！\n明るい声で読みたいニュースです。',
    agency: '{agency}へのご所属、おめでとうございます。\nいつか番組でごいっしょできたら、\nうれしいです。',
  },
  messages: [
    '本日のニュース、かまずに読めました。\n小さくガッツポーズしました。',
    '「月極駐車場」を「げっきょく」と読む人、\n多いんですよ。正しくは「つきぎめ」です。',
    '図書館で、{name}さんの好きそうな本を\n見つけました。今度お貸ししますね。',
    'お天気コーナーの先輩に、\n指し棒の持ち方まで教わりました。奥が深いです。',
    '早朝ニュースの日は、三時起きです。\nおやすみなさい…ではなく、おはようございます。',
    'たこ焼きを、冷めるまで三十分待ちました。\n…ちょうどよかったです。',
  ],
  invites: [
    'お休みがとれました。\n「{spot}」に、ごいっしょしませんか？',
    '{name}さん、本日のご予定は？\nもしよければ、「{spot}」へ。',
    '反省会という名目で…\n「{spot}」、いかがでしょう？',
  ],
  hangout: {
    ramen: ['ふー、ふー…。\nすみません、わたし猫舌で…。', '…{name}さんが食べ終わるころ、\nやっと一口目です。'],
    park: ['散歩しながら、発声練習してもいいですか？\nあ、え、い、う、え、お、あ、お…。', '鳥の声と、風の音。\n自然の音は、いちばんのお手本です。'],
    cafe: ['ここ、本の持ちこみができるんです。\n…今日は、おしゃべりしましょうね。', 'アイスティーなら、猫舌でも安心です。'],
    karaoke: ['カラオケの歌詞、つい\n正しく読めているか確認してしまいます。', '…職業病ですね。\n{name}さん、もう一曲どうぞ！'],
    famires: ['メニューの「本日のおすすめ」、\nアナウンサー風に読みますね。', '…以上、ハンバーグのニュースでした。'],
    sento: ['大きなお風呂で声を出すと、\nよく響いて気持ちいいですね。', 'あ、いえ、歌ってはいません。\n…発声練習です。'],
    default: ['たまには、マイクのない場所で\nおしゃべりするのもいいですね。'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await T(g, P, ['{name}さん、ですよね。\nアナウンサーの朝霧です。入局三年目です。', 'じつは、きのうの放送で\n読みに迷ってしまって…。\n少し、落ちこんでいるんです。']);
      const i = await Q(g, P, '「重複」って、どう読みますか？', ['ちょうふく', 'じゅうふく', 'どっちも？']);
      if (i === 0) await T(g, P, 'はい、もともとは「ちょうふく」です。\nわたし、本番で一瞬迷ってしまって。');
      else if (i === 1) await T(g, P, '「じゅうふく」も、今ではよく使われます。\nでも、もともとの読みは「ちょうふく」なんです。');
      else {
        await E(g, n, '!');
        await T(g, P, 'そうなんです！\n「じゅうふく」も広く使われていて…\nだからこそ、本番で迷ったんです。');
      }
      await T(g, P, ['ことばって、生きものなんですね。\n…{name}さんと話したら、元気が出ました。', 'またスタジオに来てくださいね。']);
      g.addSkill('talk', 1);
    }),
    ev(2, async (g, P, n) => {
      await T(g, P, ['{name}さん、ちょうどよかった。\n原稿読みの練習、聞いてもらえますか？', '「本日、ドット商店街で\nコロッケの早食い大会が開かれました」']);
      const i = await Q(g, P, 'では、つづきを{name}さんも\n読んでみてください。', ['はっきり、ゆっくり', '早口で一気に', '感情をこめて']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, 'すばらしいです！\nニュースは「伝える」もの。\n聞く人のペースが、いちばん大事なんです。');
      } else if (i === 1) {
        await E(g, n, '…');
        await T(g, P, 'は、はやいです！\nコロッケより先に、ニュースが\n食べおわっちゃいました。');
      } else {
        await E(g, n, 'w');
        await T(g, P, 'ふふっ、コロッケへの熱い思いが\n伝わってきました。\nバラエティなら、満点です！');
      }
      await T(g, P, 'これ、わたしが毎朝読んでいる雑誌です。\n話題を集めるのに、役に立ちますよ。');
      g.giveItem('wadai');
    }),
    ev(3, async (g, P, n) => {
      await E(g, n, '…');
      await T(g, P, ['{name}さん…。\nこんど、バラエティ番組の\nアシスタントを担当することになって。', 'でも、わたし…アドリブが苦手で。\n台本がないと、頭が真っ白になるんです。']);
      const i = await Q(g, P, '{name}さんなら、どうしますか？', ['まず自分が楽しむ', '相手の話をよく聞く']);
      if (i === 0) await T(g, P, '楽しむ…。\nわたし、ずっと「まちがえないこと」\nばかり考えていました。');
      else await T(g, P, 'よく聞く…。\nそうですね。ニュースも、\n聞く人のことを考えて読むんですもんね。');
      await E(g, n, '♥');
      await T(g, P, ['ありがとうございます。\nなんだか、こわくなくなってきました。', '…ふふっ。今、自然に笑えました。\nこれが、アドリブの第一歩ですね！']);
      g.addSkill('talk', 2);
    }),
    ev(4, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['{name}さん！\nバラエティの収録、終わりました！', '台本にないところで、思わず笑ってしまって…\nそれが「よかった」って言われたんです。']);
      await E(g, n, '♥', 60);
      await T(g, P, ['ことばは、人と人をつなぐ橋なんですね。\n正しく読むだけじゃなくて、\n心をこめて渡すもの。', '{name}さんが、それを教えてくれました。', 'これ、わたしの大好きな小説です。\n読み終わったら、感想を聞かせてくださいね。']);
      g.giveItem('book');
      g.addSkill('talk', 2);
    }),
  ],
});

// ---------------------------------------------------------------- 夜野さん (BSよしもと 控室)
person('yoruno', {
  name: 'お疲れのAD 夜野さん', short: '夜野さん', look: { ...LOOKS.ad, hairColor: 'black', top: '#5a6f8a' }, kind: 'staff',
  where: 'BSよしもと 控室', polite: true,
  profile: 'BSよしもとのAD。夜型で、朝はいつもねむそう。夢はディレクター。',
  loves: ['drink', 'bento', 'toei_lokeben'], likes: ['onigiri', 'okashi', 'cake'], dislikes: ['hanataba'],
  giftLines: {
    love: ['{item}！！\nこ、これで今日も一日がんばれます…！\n一生ついていきます！'],
    like: ['{item}、ありがとうございます！\nスタッフ一同…いや、ぼくがいただきます！'],
    neutral: ['ぼくにですか？\nうれしいです…ねむけが三秒とびました！'],
    dislike: ['は、{item}…！\n控室に花びんがなくて…。\nあ、紙コップに生けておきますね！'],
  },
  greets: ['はっ！起きてます！…あ、{name}さんでしたか。', 'おつかれさまです！…ふあぁ。'],
  chats: [
    'きのうの収録、ゲストさんが大ウケで…。\nいい番組ができたんで、ぼくも大満足です！',
    'カンペって、字の大きさが命なんです。\nうしろの席からでも読めるくらいに！',
    'ディレクターの熱田さん、こわいけど\n「いい画だ」って言われると、ぜんぶ報われます。',
    '差し入れのお弁当、どれから食べるか\n選ぶ時間が、一日でいちばん幸せです。',
  ],
  inviteYes: 'えっ、いいんですか！？\n今日は収録がない日なんです！行きます！',
  thanks: '今日はありがとうございました！\nひさしぶりに、のんびりした一日でした…！',
  declined: '了解です！\nぼくは…寝ます！',
  hello: '夜野です！\n返信は夜中になると思います…。\n名前のとおり、夜型なので！',
  cheers: {
    rank: '「{rank}」おめでとうございます！\n局のみんなも話題にしてました！\nキャスティング会議で名前を出しておきます！',
    agency: '{agency}所属、おめでとうございます！\nいつか番組でごいっしょしましょう！\nカンペ、大きく書きます！',
  },
  messages: [
    '本日の収録、巻きで終わりました！\nごほうびに、今日は早寝します！',
    'カンペ用のマジックが、また行方不明です。\nどこで寝てるんでしょうか。ぼくみたいに。',
    '熱田さんに「おまえの企画書、ちょっとおもろい」\nって言われました！ちょっと！',
    'ロケで食べたご当地パン、おいしかったです。\n今度おみやげに持っていきますね。',
    'ばあちゃんから、野菜が段ボールで届きました。\n控室がちょっとした八百屋です。',
    '{name}さん、ちゃんと寝てますか？\nぼくはけさ、寝すぎて遅刻しかけました…。',
  ],
  invites: [
    '収録が巻きで終わりました！\n「{spot}」、行きませんか！？',
    '{name}さん、「{spot}」どうですか？\n…ぼくが寝ないように見張っててください。',
    '本日、お休みをいただきました！\n「{spot}」、ごいっしょしませんか？',
  ],
  hangout: {
    ramen: ['ラーメン…。\n夜食じゃないラーメン、ひさしぶりだなあ…。', 'うまい…。\nあ、だめだ、満腹でねむけが…。'],
    park: ['スタジオの照明より、\nお日さまのほうが、まぶしいですね…。', 'ベンチ、気持ちいいですね…。\n…はっ！寝てません！'],
    cafe: ['コーヒー、三杯目です。\nこれでやっと、目が覚めます。', '企画書、見てもらえますか？\n…あ、よだれのあとが。すみません。'],
    karaoke: ['カラオケの映像って、だれが撮ってるんでしょうね。\n職業病で気になります。', '{name}さんの歌、いい画でした！\nカメラさん、寄って！…いないけど。'],
    famires: ['ファミレスのテーブルは、\nぼくの第二の企画会議室です。', 'ドリンクバーで、気合いの一杯！\n…エナジードリンクはないんですね。'],
    sento: ['お風呂…。\n大きいお風呂、ひさしぶりです…。', 'あったかい…。\nこのまま朝まで…いや、のぼせます。'],
    default: ['外の空気って、おいしいですね…。\nたまには、スタジオの外もいいなあ…。'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await N(g, 'Zzz…むにゃ…カンペ…あと5枚…');
      await E(g, n, '!');
      await T(g, P, ['はっ！寝てません！\n…あ、{name}さん。いつも声をかけてくれて\nありがとうございます。', 'ぼく、ADの夜野です。\n名前のとおり夜型で…\n朝だけは、どうにも弱いんです。']);
      const i = await Q(g, P, 'もし、ぼくがまたうとうとしてたら、\nどうします？', ['起こしてあげる', 'そっと寝かせておく']);
      if (i === 0) {
        await E(g, n, 'w');
        await T(g, P, 'ありがとうございます！\n本番前に寝てたら、熱田さんの\n雷が落ちるところでした。');
      } else {
        await E(g, n, '♥');
        await T(g, P, '…やさしい。\nでも、熱田さんに見つかったら\nふたりそろって怒られますよ？');
      }
      await T(g, P, 'これ、差し入れのおにぎりです。\nよかったら、どうぞ！');
      g.giveItem('onigiri');
    }),
    ev(2, async (g, P, n) => {
      await E(g, n, '…');
      await T(g, P, ['{name}さん、聞いてください…。\nきのう、ぼくがカンペの字をまちがえて、\nゲストさんが読みまちがえちゃったんです。', '放送はうまくごまかせたんですけど…\nぼく、ADに向いてないのかも。']);
      const i = await Q(g, P, 'カンペ、どう書いたら\n読みやすいですかね…？', ['大きく、短く', 'ふりがなをつける', '絵も描く']);
      if (i === 0) await T(g, P, '大きく、短く…！\nそうか、ぼく、ぎっしり書きすぎてました。');
      else if (i === 1) await T(g, P, 'ふりがな…！\nむずかしい漢字は、ぜんぶにふります！');
      else {
        await E(g, n, 'w');
        await T(g, P, '絵！？\n…いや、笑ってもらえたら\nそれはそれでいいのかも…？');
      }
      await E(g, n, '♥');
      await T(g, P, 'なんだか、やる気が出てきました！\n{name}さん、ありがとうございます！');
      g.addSkill('talk', 1);
    }),
    ev(3, async (g, P, n) => {
      await T(g, P, ['{name}さん。\nぼくが、なんでADになったと思います？', 'いなかのばあちゃんが、BSばっかり見てて。\n「テレビは、さみしい夜の友だち」って\n言ってたんです。', 'だから、いつか…ばあちゃんが\n大笑いする番組を作りたいんです。\nそれが、ぼくの夢です。']);
      const i = await Q(g, P, 'その時は、出てもらえませんか？', ['もちろん！', 'ギャラしだいで（笑）']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, 'ほんとですか！？\nよーし、企画書、さっそく書きます！\n…わくわくして、ねむけがとびました！');
      } else {
        await E(g, n, 'w');
        await T(g, P, 'あはは！\nじゃあ、ギャラが払える\nえらいディレクターになります！');
      }
      g.addFame(3);
    }),
    ev(4, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['{name}さん！\nぼく、はじめて番組のワンコーナーを\nまかせてもらえたんです！', 'それで、放送のあと…\nばあちゃんから電話がきて。']);
      await E(g, n, '♥', 60);
      await T(g, P, ['「あんたの番組、おもしろかった」って。\n…ぼく、電話の前で泣いちゃいました。', 'ここまでがんばれたのは、\n{name}さんが話を聞いてくれたからです。', 'いつか、ぼくの番組のメインは\n{name}さんにお願いします。\n…カンペ、大きく書きますね！']);
      g.addSkill('talk', 2);
      g.addFame(5);
    }),
  ],
});

// ---------------------------------------------------------------- 歌織さん (東宝 theater stage)
person('kaori', {
  name: 'アンサンブルの歌織さん', short: '歌織さん', look: { hair: 'long', hairColor: 'blonde', skin: 'light', top: '#ff7eb6', bottom: '#ff7eb6', skirt: true }, kind: 'singer',
  where: '東宝 劇場の舞台',
  profile: 'ミュージカルのアンサンブル。夢はいつか主役で歌うこと。',
  loves: ['cd', 'hanataba'], likes: ['nodoame', 'cake', 'tea'], dislikes: ['plushie'],
  giftLines: {
    love: ['{item}！？\nうれしい…！今日の舞台、\nいつもの倍、声が出そう！'],
    like: ['わあ、{item}！\nありがとう、大事にするね！'],
    neutral: ['わたしに？\nふふ、ありがとう！'],
    dislike: ['{item}…かわいい！\nでも、楽屋がせまくて置き場所が…。\nあ、気持ちはほんとにうれしいの！'],
  },
  greets: ['♪〜…あっ、{name}！聞こえてた？', '{name}！今ちょうど、休けい中なの。'],
  chats: [
    'アンサンブルはね、一回の舞台で\n五回も着がえるの。早着がえは戦争よ！',
    '主役のうしろで踊ってるとき、\n客席の笑顔がいちばんよく見えるの。',
    'きのう劇場の前で「さっきの村人Cの人ですよね」\nって声をかけられちゃった！',
    '発声練習は、毎朝お風呂で。\nとなりの部屋から拍手が聞こえたことがあるわ。',
  ],
  inviteYes: 'いいね、行こう行こう！\n♪〜',
  thanks: '今日はありがとう♪\n楽しかったから、今夜の発声練習は\nいつもより高い声が出そう！',
  declined: 'オッケー♪\nまた今度ね！',
  hello: '歌織です♪\n登録ありがとう！\n今度、舞台も見に来てね！',
  cheers: {
    rank: '「{rank}」だって！？\nおめでとう！楽屋で思わず\nファンファーレ歌っちゃった♪',
    agency: '{agency}に入ったのね！\nおめでとう！\n新しい幕が上がった感じだね♪',
  },
  messages: [
    '今日の舞台、客席に小さな女の子がいてね。\nずっと手拍子してくれてたの。',
    '早着がえで、衣装を前後ろ反対に着ちゃった。\nだれも気づかなかった…と思う！',
    'ボイストレーニングの先生に、\n「声に色が出てきた」って言われたの！',
    '{name}の出てる番組見たよ！\n笑いすぎて、腹筋がきたえられた♪',
    '雨の日は、のどの調子がいいの。\n…{name}は、雨の日すき？',
    'カーテンコールの拍手を浴びるとね、\n疲れなんて、全部ふきとんじゃうの。',
  ],
  invites: [
    '今日は昼公演だけなの！\n「{spot}」に行かない？',
    '{name}、「{spot}」行こうよ！\nおいしいもの食べて、歌って、笑おう♪',
    '休演日なの〜！\n「{spot}」、つきあってくれる？',
  ],
  hangout: {
    ramen: ['ラーメンは、のどにやさしい…\nかどうかはわからないけど、元気が出る！', 'スープの温度、のどにちょうどいいわ♪'],
    park: ['公園で歌うと、鳥が返事してくれるの。\n♪ラ〜ラ〜', '…ほら、今の聞いた？\nハモってくれた！'],
    cafe: ['ハーブティー、のどにいいのよ。\nあなたも飲んでみて！', '次の舞台の歌、こっそり教えてあげる。\n…まだ内緒よ？'],
    karaoke: ['ミュージカルの曲、入ってるかな…\nあった！全力でいくね！', '{name}、ハモって！\n…そう、そう！最高！'],
    famires: ['ファミレスのBGMって、\nつい歌いたくなっちゃうのよね。', 'デザートは、プリンパフェ！\n歌うとおなかがすくの。'],
    sento: ['大きいお風呂は、天然のホールね！\n声がよく響く〜♪', '…あ、ごめんなさい！\nつい歌っちゃった。'],
    default: ['今日のこと、歌にしたいくらい楽しい♪'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await E(g, n, '♪');
      await T(g, P, ['…あっ、{name}！\nもしかして、今の歌、聞こえてた？', 'わたしは歌織。\nこのミュージカルのアンサンブルなの。', 'アンサンブルってね、村人や街の人になって\n歌って踊って、舞台をいろどる役。\n物語の、背景の色ってとこかな。']);
      const i = await Q(g, P, 'ねえ、ちょっとだけ聞いてくれる？\n♪ほし〜ふる〜 まちの〜…', ['拍手する', 'いっしょに歌う']);
      if (i === 0) {
        g.sfx('applause');
        await E(g, n, '♥');
        await T(g, P, 'わあ、ありがとう！\nたったひとりの観客でも、\n拍手はやっぱりうれしいな。');
      } else {
        await E(g, n, '!');
        await T(g, P, 'ハモってくれた！\nあなた、いい声してるじゃない！');
        g.addSkill('uta', 1);
      }
    }),
    ev(2, async (g, P, n) => {
      await T(g, P, ['{name}、聞いて！\nわたし、主役の代役に選ばれたの！', '主役の人に何かあったときだけ、\n代わりに舞台に立つ役。\nだから、全部の歌とセリフを覚えなきゃ。']);
      const i = await Q(g, P, '相手役のセリフ、\n読んでもらってもいい？', ['もちろん！', '歌もいっしょに！']);
      if (i === 0) await T(g, P, '「…きみの歌が、この街に\n　星をふらせたんだ」\n…よし、ここで歌に入る！');
      else {
        await E(g, n, '♪');
        await T(g, P, 'デュエットね！\nあなたが入ると、歌が立体になるの！');
      }
      await E(g, n, '♥');
      await T(g, P, ['ありがとう、すごく練習になった！\n本番が来ないのがいちばんだけど…', '来たら、全力で歌うね。']);
      g.addSkill('uta', 2);
    }),
    ev(3, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['{name}…！たいへん。\n主役の方が、のどをいためちゃって。\n明日だけ、わたしが主役なの。', 'ずっと夢見てたのに…\nいざとなったら、足がふるえて。']);
      const i = await Q(g, P, 'わたしに、できるかな…。', ['できる！ずっと見てた', '深呼吸しよう']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, '…ずっと見てた、か。\nそうだよね。わたし、だれより\nこの舞台の歌を歌ってきたんだもん。');
      } else await T(g, P, 'すー…はー…。\n…うん。歌う前の深呼吸、\n大事なこと忘れてた。');
      await T(g, P, 'これ、アンサンブルのみんながくれたのどあめ。\nあなたにも、おすそわけ。\n明日、客席から念を送ってね！');
      g.giveItem('nodoame');
    }),
    ev(4, async (g, P, n) => {
      await E(g, n, '♪');
      await T(g, P, ['{name}！\n一日だけの主役、やりきったよ！', '幕がおりたあと、袖でアンサンブルのみんなが\n抱きついてきてくれたの。\n…わたし、ずっと支えられてたんだね。']);
      await E(g, n, '♥', 60);
      await T(g, P, ['いちばんうしろの席に、\nあなたがいた気がしたんだ。', 'わたし、またアンサンブルにもどるけど、\nもう前のわたしじゃない。\nいつか、主役をつかみとってみせる！', 'これ、あの日の歌を録音したCD。\nあなたに持っていてほしいの。']);
      g.giveItem('cd');
      g.addSkill('uta', 3);
    }),
  ],
});

// ---------------------------------------------------------------- 笑川さん (よしもと office)
person('emikawa', {
  name: 'マネージャー 笑川', short: '笑川さん', look: { ...LOOKS.manager, tie: '#e8492a' }, kind: 'staff',
  where: 'よしもと 2階 事務所', talkLabel: 'お仕事・相談', polite: true,
  profile: 'よしもと東京本部のマネージャー。タレントの一番近くのファン。',
  loves: ['okashi', 'drink'], likes: ['bento', 'tea', 'book'], dislikes: ['accessory'],
  giftLines: {
    love: ['{item}！？\nうわあ、うれしいなあ！\n事務所のみんなで…いや、これは独り占めします！'],
    like: ['{item}、ありがとうございます！\nいただきます！'],
    neutral: ['ぼくに？\nお気づかい、ありがとうございます！'],
    dislike: ['{item}…！？\nい、いや、うれしいですけど…\nスーツにはちょっと、似合わないかなあ。'],
  },
  greets: ['{name}さん！今日はどうしました？', 'おつかれさまです！何かご用ですか？'],
  chats: [
    'スケジュール帳、もう真っ黒です。\nこれぞマネージャーのよろこびですね！',
    '芸人さんのネタ見せ、毎日見てます。\n笑いすぎて、腹筋がバキバキです。',
    '体調管理も仕事のうちですよ。\n寝る、食べる、笑う！',
    '電話が三台同時に鳴ると、\n逆に冷静になれるんです。ふしぎですよね。',
  ],
  inviteYes: 'いいですね！\n今日の電話番は…後輩にたのみます！',
  thanks: '今日はありがとうございました！\nいいリフレッシュになりました！',
  declined: '了解です！\nお仕事、がんばってくださいね！',
  hello: '笑川です！\nお仕事の相談も、ぐちも、いつでもどうぞ！\n…返信は、移動中の電車からになります！',
  cheers: {
    rank: (g) => (g.state.agency === 'yoshimoto'
      ? '「{rank}」！おめでとうございます！\n担当マネージャーとして、鼻が高いです！'
      : '「{rank}」！おめでとうございます！\n所属はちがっても、うれしいもんですね！'),
    agency: (g) => (g.state.agency === 'yoshimoto'
      ? 'よしもと所属、おめでとうございます！\nこれからは、ぼくが全力でサポートします！'
      : '{agency}に入られたんですね。\nおめでとうございます！\nライバル事務所…でも、応援してます！'),
  },
  messages: [
    '今日は新幹線で三往復しました。\nもはや新幹線に住んでます。',
    '担当の芸人さんが、営業先で大ウケ！\nぼくまで、うれしくて泣きそうです。',
    '{name}さん、ちゃんと食べてますか？\n芸能人は体が資本ですよ！',
    '劇場の楽屋に、差し入れがたくさん届いてました。\nファンのみなさんに、感謝ですね。',
    '手帳、三冊目に突入しました。\n…一冊目、どこいったかな。',
    '新人さんのネタ見せ、今日もおもしろかった！\n笑いの未来は明るいです！',
  ],
  invites: [
    'めずらしく、夜があきました！\n「{spot}」、いかがですか？',
    '{name}さん、「{spot}」行きましょう！\nたまには仕事の話ぬきで！',
    '今日は直帰です！\n「{spot}」で、ひと息つきませんか？',
  ],
  hangout: {
    ramen: ['ラーメン、移動中にかきこむのが定番で…\n座って食べるの、久しぶりです。', 'うまい！\n…あ、ちょっと電話。…はい、笑川です！'],
    park: ['公園のベンチで、台本チェック…\nあ、今日は仕事ぬきでしたね。', 'たまには、空を見上げるのもいいですね。'],
    cafe: ['カフェに来ると、つい\nスケジュールを確認しちゃいます。', '…はい、スマホしまいます！\n今日は{name}さんとの時間です！'],
    karaoke: ['ぼくの十八番、いきます！\n…芸人さんの出囃子メドレーです！', '{name}さんの歌、さすがです！\nこれは仕事、とれますよ！'],
    famires: ['ファミレスは、マネージャーの作戦本部です。\n深夜の会議は、だいたいここです。', 'ハンバーグ、うまい！\n…あ、今日はちゃんと自腹です！'],
    sento: ['銭湯、いいですね。\nスーツをぬぐと、自分にもどれる気がします。', 'ふう〜。\n電話が鳴らない時間、最高です。'],
    default: ['たまには息抜きも、仕事のうちですね！'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await T(g, P, ['{name}さん、いつもおつかれさまです！\nあらためまして、マネージャーの笑川です。', 'マネージャーってね、タレントさんの\n「いちばん近くのファン」なんですよ。']);
      const i = await Q(g, P, '{name}さんは、これから\nどんな道に進みたいですか？', ['お笑い！', 'ドラマや歌', 'まだ迷ってる']);
      if (i === 0) await T(g, P, 'いいですね！\n劇場で場数をふむのが、いちばんの近道です。\nツッコミの間は、毎日の積み重ねですよ。');
      else if (i === 1) await T(g, P, 'なるほど！\nお笑いできたえたトーク力は、\nドラマでもバラエティでも武器になりますよ。');
      else await T(g, P, '迷うのは、可能性がたくさんある証拠です！\nいろんなお仕事を、まずはやってみましょう。');
      await T(g, P, 'これ、事務所に置いてある雑誌です。\nトークのネタ集めに、どうぞ！');
      g.giveItem('wadai');
    }),
    ev(2, async (g, P, n) => {
      await N(g, '笑川さんが、デスクにつっぷしている。');
      await E(g, n, '…');
      await T(g, P, ['あ…{name}さん。\nいやあ、今日はやっちゃいました。', '担当タレントさんのスケジュールを\nダブルブッキングしちゃって…\n先方に頭を下げまくってきました。']);
      const i = await Q(g, P, '…マネージャー失格ですかね。', ['だれにでもある', 'いっしょに休けいしよう']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, 'だれにでも…。\nそうですね。同じミスを\n二度としなければいいんですよね！');
      } else {
        await E(g, n, 'w');
        await T(g, P, 'あはは！ですね。\n…ふう。お茶がおいしい。\nよし、復活です！');
      }
      await T(g, P, ['{name}さんと話したら、元気出ました。\nありがとうございます！', 'お礼に、ひとつコツを。\nトークは「相手の話のあと、ひと呼吸」。\nそれだけで、ぐっと聞きやすくなりますよ。']);
      g.relax({ stress: 10 });
      g.addSkill('talk', 1);
    }),
    ev(3, async (g, P, n) => {
      await T(g, P, ['{name}さん。\nぼく、ほんとは芸人になりたかったんです。', '学生時代、コンビを組んでね。\nでも、舞台に立ったら\nぼくだけ、ぜんぜんウケなくて。', 'それで気づいたんです。\nぼくは、だれかがウケてるのを\n袖から見るのが、いちばん好きなんだって。']);
      const i = await Q(g, P, '{name}さんは、なんで\nこの世界に入ったんですか？', ['人を笑顔にしたい', 'スターになりたい']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, 'いい理由ですね。\nその気持ち、ずっと忘れないでください。');
      } else {
        await E(g, n, '!');
        await T(g, P, 'いいですね！\nその野心、マネージャーとしては\nいちばん心強いです！');
      }
      g.addSkill('talk', 2);
    }),
    ev(4, async (g, P, n) => {
      const mem = g.state.agency === 'yoshimoto';
      await T(g, P, mem
        ? ['{name}さん。\n担当させてもらえて、ほんとに光栄です。', 'ぼく、{name}さんが舞台でウケた日は、\n帰りの電車でこっそりガッツポーズしてるんです。']
        : [g.state.agency ? '{name}さん。\n所属はちがいますけど…\nぼく、勝手に{name}さんのファン第一号です。' : '{name}さん。\nまだ担当じゃないですけど…\nぼく、勝手に{name}さんのファン第一号です。', '{name}さんがテレビに出た日は、\n事務所のテレビのチャンネル、\nだれにも変えさせません。']);
      await E(g, n, '♥', 60);
      await T(g, P, ['これからも、いちばん近くの客席から\n応援させてくださいね！', 'これ、取引先からいただいた高級お菓子。\nぼくの好物なんですけど…\n{name}さんにおすそわけです！']);
      g.giveItem('okashi');
      g.addFame(5);
    }),
  ],
});

// ---------------------------------------------------------------- もも (グレープカンパニー 稽古場) 相方候補
person('momo', {
  name: '若手ピン芸人 もも', short: 'もも', look: { hair: 'twin', hairColor: 'brown', skin: 'light', top: '#ff7eb6', bottom: '#3a4a7a' }, kind: 'comedian', canPartner: true,
  where: 'グレープ 稽古場',
  profile: 'グレープの若手ピン芸人。変顔とひとりコントが得意。',
  loves: ['netacho', 'manga'], likes: ['cake', 'okashi', 'plushie'], dislikes: ['cd'],
  giftLines: {
    love: ['うそ、{item}！？\nやばい、テンション上がる！\n今日のネタ、三本書けそう！'],
    like: ['{item}じゃん！\nありがと！大事にする〜！'],
    neutral: ['え、うちに？\nありがと！なんか照れる〜。'],
    dislike: ['{item}？\nうち、プレーヤー持ってないんだよね〜。', 'あ、フリスビーに…しないしない！\n気持ちはうれしいよ、ありがと！'],
  },
  greets: ['お、{name}！ちょうどいいとこ来た！', '{name}じゃん！見て見て、新しい変顔！'],
  greetPartner: ['相方！今日のネタ合わせ、何時からにする？\n…うちは今すぐでもいいよ！', '相方〜！新しいオチ考えた！\nあとで聞いて！'],
  chats: [
    '新ネタ「コンビニの店員と宇宙人」！\n…ひとりで二役やると、息が切れるんだよね。',
    '鏡の前で変顔の練習してたら、\n掃除のおばちゃんに悲鳴あげられた。',
    'ピンはね、ウケても滑っても全部自分のせい。\nだから、気楽っちゃ気楽！',
    'ツッコミの練習相手がいないから、\n冷蔵庫にツッコんでる。「冷えすぎ！」って。',
  ],
  inviteYes: 'いくいく！\nネタになりそうなこと、探しに行こ！',
  thanks: '今日はありがと！\nネタ帳、三ページうまった！',
  declined: 'りょ！\nまたさそうね〜！',
  hello: 'ももだよ〜！登録した！\nおもしろい写真、送りつけるから覚悟して！',
  partnerText: '相方、これからよろしくね！\nふたりで、てっぺん取ろ！',
  cheers: {
    rank: '「{rank}」！？やったじゃん！\nうちも負けてらんない！\n…とりあえず変顔で祝っとく！',
    agency: '{agency}入ったの！？おめでと！\nいつか同じライブに出ようね！',
  },
  messages: [
    '今日のライブ、変顔だけでウケた！\n…ネタ、いらなくない？',
    '電車でネタ考えてたら、声に出てたらしくて\nとなりの人に笑われた。',
    '事務所のスタッフさんに\n「ももちゃんは顔がうるさい」って言われた。\nほめ言葉…だよね？',
    'コンビの子たちのネタ合わせ見てると、\nちょっとうらやましくなるんだよね〜。',
    '新しいキャラ考えた！\n「なんでも二度言うおばあちゃん」。\n二度言うおばあちゃん。',
    '{name}、今なにしてる？\nうちは、鏡とにらめっこ中！',
  ],
  partnerMessages: [
    '相方〜！新ネタのオチ思いついた！\n…いや、会ってから話す！もったいない！',
    'コンビ名、「ももと{name}」で仮登録しといたよ。\nもっといいの、いっしょに考えよ！',
    'ひとりのころは、ライブ前こわかったけど、\n今は楽しみしかないんだよね〜。',
  ],
  invites: [
    'ねえねえ、「{spot}」行かない？\nネタの取材ってことで！',
    '{name}〜、ひま？\n「{spot}」いこ！',
    '今日のライブ終わり！\n「{spot}」で反省会しよ！…反省はしない！',
  ],
  hangout: {
    ramen: ['ラーメンすするときの顔、\nネタに使えそう！…ずぞぞぞ！', 'あ、今の顔、写真とった！？\n消して〜！'],
    park: ['公園って、ネタの宝庫なんだよね。\nほら、あのハトの歩き方とか！', '…ハトのモノマネ、どう？\nクルックー！'],
    cafe: ['カフェでネタ書くの、あこがれだったの！\nパソコンないけど！ノートだけど！', 'このパンケーキ、ふわっふわ！\n…はい、変顔でリアクション！'],
    karaoke: ['カラオケはね、モノマネ大会になるのが\nうちの流儀！', '{name}の歌、うますぎ！\n…これはツッコめないじゃん！'],
    famires: ['ファミレスの呼び出しボタン押すとき、\n毎回ちょっと緊張しない？', 'ドリンクバーのジュースで、乾杯コント！\n…はい、カンパーイ！…ウケた？'],
    sento: ['銭湯の富士山の前で、決めポーズ！\n…だれも見てないけど！', 'お風呂あがりの牛乳、一気飲みチャレンジ！\n…ぷはーっ！'],
    default: ['今日のこと、ぜったいネタにする！'],
  },
  combi: {
    ask: ['…ねえ、{name}。\nうちと、コンビ組んでくれない？'],
    again: ['{name}。この前のこと、まだ本気だよ。', 'うちと、コンビ組んでくれない？'],
    yes: ['…ほんとに！？\nやったあああ！！', 'うち、ずっとピンでいいって思ってた。\nでも、{name}となら、もっとおもしろくなれる！\nよろしくね、相方！'],
    no: ['…そっか！\nいいのいいの、急にごめんね！\nうちは、いつでも待ってるから！'],
    taken: ['{name}には、もう{partner}って相方がいるんだよね。\nそれでも…うちと組んでほしいって言ったら、\n困る？'],
    keep: ['…だよね！\n相方は大事にしなきゃ！\nじゃあ、ライバルとしてよろしく！'],
    already: 'これからもよろしくね、相方！',
    bye: '新しい相方と、がんばってね。\n…でも、ライブで当たったら手かげんしないから！',
  },
  events: [
    ev(1, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['あ、見てた？\n今の変顔、新作なんだけど。', 'うちは、もも。\nグレープの若手で、ピン芸人やってるの。']);
      const i = await Q(g, P, 'ひとりコントの新ネタ、\n見ていってくれる？', ['見る見る！', '変顔をもう一回']);
      if (i === 0) {
        g.sfx('laugh');
        await T(g, P, ['「いらっしゃいませ〜！…って、\n　お客さん、宇宙人じゃん！」', '…どう？ひとり二役。\n息切れするけど、楽しいんだ！']);
        g.addSkill('warai', 1);
      } else {
        await E(g, n, 'w');
        await T(g, P, 'リクエスト！？\nしかたないなあ…\nはい、「月曜日の朝の顔」！');
      }
      await E(g, n, '♥');
      await T(g, P, 'あはは、{name}って\nいいリアクションするね！\nまた見に来てよ！');
    }),
    ev(2, async (g, P, n) => {
      await T(g, P, ['{name}、たすけて！\n今度のネタ、どうしてもふたり必要なの。', 'お店のコントなんだけど、\nお客さん役、やってくれない？', '「いらっしゃいませ！\n　ご注文は、うちの笑顔でよろしいですか？」']);
      const i = await Q(g, P, 'はい、{name}のセリフ！', ['「スマイルは0円で」', '「いりません」', '「…持ち帰りで」']);
      if (i === 0) {
        await E(g, n, '♪');
        await T(g, P, 'それそれ！\nベタだけど、テンポ最高！');
      } else if (i === 1) {
        await E(g, n, '💢');
        await T(g, P, ['ひどっ！\n…でも、今の冷たい言い方、めっちゃ笑える！', '採用！']);
      } else {
        await E(g, n, '♥');
        await T(g, P, '持ち帰り！？\n…天才じゃん！\nそれ、今日いちばんウケたやつ！');
      }
      await T(g, P, ['…ふたりでやると、こんなに楽しいんだね。', 'お礼に、うちのネタ帳の予備あげる！']);
      g.giveItem('netacho');
    }),
    ev(3, async (g, P, n) => {
      await N(g, '稽古場の鏡の前で、ももがじっと自分の顔を見ている。');
      await T(g, P, ['…{name}。\nうちね、ずっと「ピンでいい」って思ってたの。', 'ひとりなら、だれにも迷惑かけないし、\nスベっても自分のせいだけで済むから。']);
      await E(g, n, '…');
      await T(g, P, ['でも、{name}とネタやった日、\n帰り道ずっとニヤニヤしてた。', 'ふたりのほうがおもしろいって、\n気づいちゃったんだよね。']);
      await combi(g, P, n);
    }),
    ev(4, async (g, P, n) => {
      if (isPartner(g, P.id)) {
        await T(g, P, '相方！グレープの月例ライブ、\nいよいよ出番だよ！');
        await cut(g);
        await N(g, 'ふたりのコントに、客席が大きくゆれた。\n最後のオチで、笑いと拍手がはじけた！');
        await E(g, n, '♥', 60);
        await T(g, P, ['…ねえ、聞こえた？あの笑い声。', 'ひとりじゃ、ぜったい見られなかった景色だよ。\nありがとね、{name}。', 'よーし、次は単独ライブだ！\nいっしょにてっぺん取ろうね、相方！']);
        g.addSkill('warai', 3);
        g.addFame(8);
      } else {
        await T(g, P, ['{name}！聞いて！\nピン芸人の大会、予選通ったの！', '{name}がネタを見てくれて、\nいっしょに笑ってくれたおかげ！']);
        await E(g, n, '♥', 60);
        await T(g, P, ['相方じゃなくても、{name}は\nうちのいちばんの「お客さん」で、\nいちばんの仲間！', 'いつか同じ舞台で会おうね！']);
        g.addSkill('warai', 2);
        g.addFame(3);
      }
    }),
  ],
});

// ---------------------------------------------------------------- 千代さん (東映 撮影所の茶屋) 大切な人
person('chiyo', {
  name: '茶屋の看板娘 千代', short: '千代さん', look: { hair: 'long', hairColor: 'black', skin: 'light', top: '#e86f8a', bottom: '#b84a62', skirt: true }, kind: 'actor', special: true,
  where: '東映 撮影所の茶屋', talkLabel: '茶屋で一服', again: 'ほかに何かあるかしら？',
  giftDone: ['今日はもう、いただいたわ。', 'お気持ちだけで、じゅうぶんよ。'], hangDone: '今日はもう、いっしょに過ごしたじゃない。\nまた今度、さそってね。',
  // once you know each other, the tea house without the self-introduction
  npcTalk: async (g, npc, own) => {
    const goods = ['toei_dango', 'toei_ocha'].filter((k) => ITEMS[k]);
    if (!goods.length) return own(g, npc);
    const P = PEOPLE.chiyo;
    await T(g, P, isSpecial(g, 'chiyo') ? '…いらっしゃいまし、{name}さん。\nあなたには、いちばんいいお団子をね。' : 'いらっしゃいまし〜！\nお団子、ちょうど焼けたところよ。');
    await g.shop(goods, { title: '茶屋', greeting: 'お団子は撮影用じゃなくて、本物よ！' });
    await T(g, P, 'ひと休みしたら、またがんばってね！');
  },
  profile: '時代劇で茶屋の娘役をつとめる女優。和菓子が大好き。',
  loves: ['okashi', 'hanataba'], likes: ['tea', 'book', 'plushie', 'toei_dango'], dislikes: ['drink'],
  giftLines: {
    love: ['まあ…{item}！\nうれしい。胸がいっぱいで、\nセリフが出てこないわ。'],
    like: ['{item}？\nありがとう。大事にするわね。'],
    neutral: ['わたしに？\nふふ、ありがとう。'],
    dislike: ['{item}…？\nお団子には、ちょっと合わないかも…。\nふふ、でも気持ちはいただくわね。'],
  },
  greets: ['いらっしゃいまし〜。…あら、{name}さん！', '{name}さん。お茶、いれましょうか？'],
  greetSpecial: ['…{name}さん。\nあなたが来ると、「いらっしゃいまし」が\nほんとの気持ちになるの。', '{name}さん！\n…今日は、いちばんいいお団子をとっておいたの。'],
  chats: [
    '茶屋のセットのお団子、本物なのよ。\nNGが出るたびに、ひとつずつ減っていくの。',
    '時代劇の所作って、むずかしいの。\nお茶を出すだけで、三十回練習したわ。',
    'きのう、殺陣のリハを見てたら\nわたしまで息を止めちゃってた。',
    '{name}さんの出てる番組、録画してるの。\n…あ、今のは聞かなかったことにして。',
  ],
  inviteYes: 'まあ、うれしい。\n衣装を着がえてくるから、ちょっと待っててね。',
  thanks: '今日はありがとう。\n撮影所の外で会うのって、なんだか新鮮ね。',
  declined: 'ええ、わかったわ。\nまた今度、さそってね。',
  hello: '千代です。\nこういうの、慣れていなくて…\n文がかたかったら、ごめんなさいね。',
  cheers: {
    rank: '「{rank}」になられたのね。\nおめでとう！\n撮影所のみんなで、お団子でお祝いしたのよ。',
    agency: '{agency}に入ったのね。\nおめでとう！\nいつか、時代劇でも共演できたらいいな。',
  },
  messages: [
    '今日は雨で撮影が中止。\n茶屋のセットで、ひとりお茶会をしたわ。',
    '新しいかんざしをもらったの。\n…次に会うとき、気づいてくれるかしら。',
    'お団子の串を、刀みたいにかまえてしまったの。\n殺陣師さんに笑われちゃった。',
    'セリフが「いらっしゃいまし」だけの日が\n三年続いてるの。…でも、毎日ちがう気持ちよ。',
    '撮影所の猫が、茶屋の縁台でお昼寝してたの。\nいちばんの看板娘は、あの子かも。',
    '{name}さん、ちゃんと休んでる？\nお茶の時間は、心の休けいよ。',
  ],
  specialMessages: [
    'おはよう、{name}さん。\n今日も、あなたの一日が\nおだやかでありますように。',
    '撮影の合間に{name}さんのことを考えてたら、\nお茶をこぼしちゃった。…ふふ、内緒よ。',
    '今度のお休み、いっしょにお団子を\n食べに行きませんか。\n…撮影所の外の、本物のお店に。',
  ],
  invites: [
    '撮影がお休みなの。\nよかったら、「{spot}」へ行かない？',
    '{name}さん、今日あいてる？\n「{spot}」、いっしょにどうかしら。',
    'たまには、茶屋の外でお茶しましょう。\n「{spot}」はどう？',
  ],
  hangout: {
    ramen: ['ラーメン屋さんののれんって、\n茶屋ののれんと似てて、落ちつくの。', 'ふふ、髪をまとめてくればよかった。'],
    park: ['公園の池、時代劇の撮影で使えそうね。\n…なんて、つい考えちゃう。', '風が気持ちいい。\n{name}さんといると、時間がゆっくり流れるわ。'],
    cafe: ['洋菓子も好きなの。\nこのタルト、宝石みたいね。', 'お茶の時間って、\nだれと過ごすかが大事なのよね。'],
    karaoke: ['歌は自信ないけど…\n時代劇の主題歌なら、歌えるかも。', '{name}さんの歌、すてき。\nずっと聞いていたいわ。'],
    famires: ['ファミレスって、はじめてかもしれない。\nメニューが絵巻物みたいね。', 'あんみつがあった！\n…やっぱり和菓子を選んじゃうわ。'],
    sento: ['銭湯の富士山、大きいわね。\n時代劇の背景みたい。', 'お風呂あがりのいちご牛乳、\nほっぺがゆるんじゃう。'],
    default: ['今日は、いい一日になったわ。\nありがとう、{name}さん。'],
  },
  confess: {
    ask: ['…{name}さん。\nわたしの、大切な人になってくれませんか。'],
    again: ['{name}さん…。', 'わたし、やっぱりあなたのことが\nいちばん大切みたい。…だめ、かしら。'],
    yes: ['…ほんとう？\nよかった…。', '（千代さんが、そっと手をとった。\nちょうちんの灯りが、ふたりをてらしている）', 'これからも、よろしくね。\n…わたしの、大切な人。'],
    no: ['…ええ、わかったわ。\nこれからも、茶屋に寄ってね。\nいちばんおいしいお茶を、いれるから。'],
    friend: ['…でも、{name}さんには\nもう大切な人がいるのよね。', 'ふふ、いいの。言えて、すっきりしたわ。\nあなたは、わたしのいちばんの友だちよ。\nこれからも、茶屋に寄ってね。'],
    text: 'まだ、胸がどきどきしてるの。\nおやすみなさい、{name}さん。',
  },
  events: [
    ev(1, async (g, P, n) => {
      await T(g, P, ['あら、いつものお客さん。\n毎日のように来てくれて、ありがとう。', 'ちゃんと名乗ってなかったわね。わたし、千代。\nこの撮影所で、茶屋の娘役をしているの。', 'じつは、もう三年も同じ役なの。\nセリフは、ずっと「いらっしゃいまし」だけ。']);
      const i = await Q(g, P, '…地味だって、思った？', ['すてきな役だね', 'ほかの役もしたい？']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, 'まあ…ありがとう。\nそう言ってもらえたの、はじめて。');
      } else {
        await E(g, n, '…');
        await T(g, P, 'ふふ、するどいのね。\nいつかは、もっと大きな役も…\nって、夢見てはいるの。');
      }
      await T(g, P, 'これ、撮影用じゃない本物のお団子。\nおひとつどうぞ。');
      giveAny(g, ['toei_dango', 'onigiri']);
    }),
    ev(2, async (g, P, n) => {
      await T(g, P, ['{name}さん、お願いがあるの。\nこんど、武家の娘の役の\nオーディションがあって。', 'セリフの練習相手になってくれない？\nあなたは、旅立つお侍さんの役。', '「…どうか、ご無事で。\n　千代は、いつまでもお待ちしております」']);
      const i = await Q(g, P, 'さあ、お侍さんのセリフを。', ['「必ずもどる」', '「団子、もう一本」', '（だまってうなずく）']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, 'まあ、すてき…！\n思わず、本気で見送っちゃった。');
      } else if (i === 1) {
        await E(g, n, 'w');
        await T(g, P, ['ふふっ、あはは！\nだめよ、笑っちゃったじゃない。', '…でも、おかげで緊張がとけたわ。']);
      } else {
        await E(g, n, '!');
        await T(g, P, 'だまってうなずく…。\n時代劇らしい、いい間ね。\nあなた、お芝居の才能あるわ。');
      }
      g.addSkill('engi', 2);
    }),
    ev(3, async (g, P, n) => {
      await N(g, '茶屋の縁台に、千代さんがひとりで座っている。');
      await E(g, n, '…');
      await T(g, P, ['あ…{name}さん。\nこの前のオーディション、だめだったの。', 'ほかの女優さんに決まって…\nやっぱり、わたしは茶屋の娘なのね。']);
      const i = await Q(g, P, '…ごめんなさいね、暗い話して。', ['千代さんのお茶が好き', 'また挑戦しよう']);
      if (i === 0) {
        await E(g, n, '!');
        await T(g, P, ['…わたしの、お茶？', 'そう…そうよね。\nお客さんにお茶を出す。\nそれだけで、物語が始まることもあるもの。']);
      } else await T(g, P, '…ええ。\nあきらめるのは、まだ早いわよね。');
      await E(g, n, '♥');
      await T(g, P, ['ありがとう。\nあなたと話すと、肩の力がぬけるの。', 'はい、お茶。\nいちばんいい茶葉で、いれたのよ。']);
      g.relax({ stress: 15 });
      g.heal(10);
      await N(g, 'ほっとする味だ。\n（ストレス -15・体力 +10）');
    }),
    ev(4, async (g, P, n) => {
      await N(g, '撮影が終わった、夕方のオープンセット。\n茶屋のちょうちんに、灯がともる。');
      await T(g, P, ['{name}さん、来てくれたのね。\n…今日は、茶屋の娘じゃなくて、\nわたしとして話をさせて。', 'あなたが来る日はね、\n「いらっしゃいまし」が、\nほんとの気持ちになるの。']);
      await E(g, n, '♥');
      await confess(g, P, n);
      g.relax({ stress: 20 });
    }),
  ],
});

// ================================================================ なんば（大阪）
// ---------------------------------------------------------------- タマエちゃん (なんばの通り)
person('tamae', {
  name: '大阪のおばちゃん タマエ', short: 'タマエちゃん', look: { ...LOOKS.oldwoman, top: '#ff7eb6', hairColor: 'purple' }, kind: 'local',
  where: 'なんばの川沿い',
  // her daily candy, without the first-meeting line once you are friends (same once-a-day flag as namba.js)
  npcTalk: async (g, npc) => {
    const P = PEOPLE.tamae;
    const key = 'ame_' + g.state.day;
    if (g.flag(key)) { await T(g, P, ['今日のアメちゃんは、もうあげたで！', 'また明日おいで〜。']); return; }
    g.setFlag(key);
    await T(g, P, pick([['あんた、今日も来てくれたんか！', 'ほれ、今日のアメちゃん。\nのど、大事にしいや！'], ['がんばってる子には、毎日アメちゃんや！', 'ほい、ひとつ。…いや、おまけでもうひとつ…\nあかん、一日一個の決まりやった！']]));
    g.giveItem('nodoame');
    g.sfx('coin');
  },
  profile: 'なんばの名物おばちゃん。ヒョウ柄とアメちゃんがトレードマーク。',
  loves: ['okashi', 'hanataba'], likes: ['butaman', 'takoyaki', 'cake'], dislikes: ['cd'],
  giftLines: {
    love: ['いや〜ん！{item}やんか！\nあんた、ようわかってるなあ！\nおばちゃん、うれしいわ〜！'],
    like: ['{item}！？おおきに〜！\nあんた、ええ子やなあ！'],
    neutral: ['あら、うちに？\nおおきに！アメちゃん、倍返しや！'],
    dislike: ['{item}かいな！\nうち、演歌のカセット派やねん。', '…まあ、孫にあげるわ！おおきに！'],
  },
  greets: ['あら、あんたか！アメちゃんいる？', 'まいど！今日もええ顔してるやん！'],
  chats: [
    '今日のヒョウ柄は新作やで！\nどや、目ぇチカチカするやろ！',
    'あんた、ちゃんと野菜食べてるか？\nアメちゃんは野菜ちゃうで！',
    '道ききたい観光客がおったら、\nうちが目的地まで連れてったるねん。',
    '東京もええけど、たまには大阪帰っておいで。\nここが実家や思とき！',
  ],
  inviteYes: 'ええで、ええで！\nおばちゃん、どこでもついてくで〜！',
  thanks: '今日はおおきに〜！\nおばちゃん、十歳わかがえったわ！',
  declined: 'ほな、また今度な〜！',
  hello: 'タマエです！\nスマホのメッセージ、孫に教えてもろてん！\nこれ、ちゃんと届いてる〜？',
  cheers: {
    rank: '「{rank}」やて！？\nあんた、えらい出世や！\n商店街じゅうに言いふらしといたで！',
    agency: '{agency}に入ったんやて！\nおめでとう！\nアメちゃん、山盛り用意しとくわ！',
  },
  messages: [
    'きょう、たこ焼き屋の大将と値切り合戦したで。\n…たこ焼き一個おまけ、うちの勝ちや！',
    'あんたの番組、近所のみんなで見たで！\nおばちゃん、テレビに向かってツッコんどいたわ！',
    '新しいカバン買うてん。\n前のヒョウ柄とどこがちゃうかって？\nトラ柄や！',
    '孫がな、あんたのファンやて！\nサインもろてきてって、うるさいねん。',
    'アメちゃん、今日は百個配ったで。\n新記録や！',
    '大阪は今日も晴れや！\nあんたのとこは、どないや？',
  ],
  invites: [
    'あんた、ひまか？「{spot}」行こか！\nおばちゃんのおごり…は、ちょっと考えさせて！',
    '{name}ちゃ〜ん！\n「{spot}」行かへん？',
    'たまには、おばちゃんにつきおうて〜！\n「{spot}」や！',
  ],
  hangout: {
    ramen: ['ラーメンもええけど、\nおばちゃん、替え玉より替えアメちゃんや！', '…いや、なんやねん替えアメちゃんて！\n自分でツッコんだわ！'],
    park: ['公園のハトにもアメちゃんあげよか？\n…あかん？せやな。', 'ええ天気や〜！\nあんたといると、わかがえるわ！'],
    cafe: ['おしゃれなカフェやなあ。\n「いつもの」言うたら、通じるかな？', '…通じへんかった！\nまあ、ええわ！パフェにしよ！'],
    karaoke: ['おばちゃんの十八番、演歌いくで！\nこぶし、まわすで〜！', 'あんた、歌うまいなあ！\nおばちゃん、泣いてもうたわ！'],
    famires: ['ファミレスのドリンクバー、\n最強のおトクやで！', '五杯目のおかわり、いってくるわ！\n元はとらな！'],
    sento: ['銭湯はええなあ。\nおばちゃん、毎日来たいくらいや！', 'ふう〜、極楽、極楽。\nアメちゃん、湯船で食べたらあかんで！'],
    default: ['あんたと出かけると、ほんま楽しいわ〜！'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await T(g, P, ['あんた、また来たんか！\nしょっちゅう見る顔やなあ！', 'うちはタマエ。\nこのへんの人は、みんな\n「タマエちゃん」て呼ぶねん。']);
      const i = await Q(g, P, 'あんた、テレビで見たで！\n…あれ、ちゃうかった？\n天気予報の人やったかな？', ['って、ちゃうわ！', 'はい、天気予報です']);
      if (i === 0) {
        g.sfx('hit');
        await E(g, n, 'w');
        await T(g, P, 'それや！\nノリツッコミ、できるやん！\nあんた、大阪向きやで！');
        g.addSkill('warai', 1);
      } else {
        await E(g, n, '!');
        await T(g, P, 'ほんまに！？\n…いや、ボケたんやな！\nあんた、やるなあ！');
      }
      await T(g, P, 'ほな、アメちゃん二個あげるわ。\nがんばってる子には、ボーナスや！');
      g.giveItem('nodoame', 2);
    }),
    ev(2, async (g, P, n) => {
      await T(g, P, ['あんた、ちょっとだけ聞いてくれる？\nうちのお父ちゃん…\nあ、亡くなった旦那な。', '商店街のお祭りでな、毎年ふたりで\n夫婦漫才やっとったんや。\nうちがボケで、お父ちゃんがツッコミ。', 'あの人、本番になったら緊張してなあ。\nツッコむとこで、毎年うちの頭やのうて\n自分の頭、はたいとったわ！']);
      const i = await Q(g, P, 'あんた見てたら、\nなんや思い出してしもたわ。', ['すてきな夫婦ですね', 'いっしょに漫才しよう']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, 'せやろ？\n…いや、自分で言うたらあかんな！');
      } else {
        await E(g, n, '!');
        await T(g, P, ['…ほんまに？\nほな、今年のお祭りは、あんたと出よか！', 'うちのボケは、きびしいで〜！\nお父ちゃんのぶんまで、笑かしたろ！']);
      }
      await T(g, P, 'これ、おみやげの豚まん。\nだれか大事な人にあげ！\nあったかい気持ちも、いっしょにな！');
      g.giveItem('butaman');
    }),
    ev(3, async (g, P, n) => {
      await T(g, P, ['あんた、ええとこ来た！\n商店街のお祭りで、司会がおらへんねん！', 'ちょっとだけでええから、\nマイクで盛り上げてくれへん？']);
      const i = await Q(g, P, '頼むわ〜！', ['まかせて！', 'ちょっとだけなら']);
      if (i === 1) await T(g, P, 'ちょっとでええ、ちょっとで！\nほな、たのんだで！');
      await cut(g);
      await N(g, '{name}の司会で、お祭りは大盛り上がり！\n商店街の人たちが、手をたたいて笑っている。');
      await E(g, n, '♥');
      await T(g, P, ['さすがやな〜！\nあんたがしゃべったら、みんな笑顔になるわ！', 'おばちゃん、鼻が高いわ。\nほんま、おおきにな！']);
      g.addSkill('talk', 2);
      g.addFame(3);
    }),
    ev(4, async (g, P, n) => {
      await T(g, P, ['なあ、あんた。\nおばちゃん、毎日いろんな人に\nアメちゃん配ってるやろ？', 'あれな、お父ちゃんが言うてたんや。\n「アメちゃん一個で、知らん人が\n友だちになる」って。']);
      await E(g, n, '♥', 60);
      await T(g, P, ['あんたは、そのアメちゃんでできた\nいちばんの友だちや。\nうちの自慢の子やで！', 'しんどなったら、いつでも大阪帰っておいで。\nおばちゃん、ここで待ってるからな。', 'ほれ、特別に袋ごとあげるわ！\nのどにええやつやで〜！']);
      g.giveItem('nodoame', 3);
      g.relax({ stress: 10 });
    }),
  ],
});

// ---------------------------------------------------------------- タケル (松竹芸能 lobby) 相方候補
person('takeru', {
  name: '若手芸人 タケル', short: 'タケル', look: { ...LOOKS.comedian, hair: 'short', hairColor: 'black', top: '#d8101c', bottom: '#3a4a7a' }, kind: 'comedian', canPartner: true,
  where: '松竹芸能 ロビー', polite: true,
  giftDone: ['今日はもう、もろてますから！', 'お気持ちだけで、じゅうぶんうれしいです。'], hangDone: '今日はもう、いっしょに遊びましたやん！\nまた今度、さそてください。',
  callShy: ['もしもし？…あ、{name}さん！', 'また今度、ゆっくりしゃべりましょ！'], callAgain: ['今日はめっちゃ遊びましたね！', 'また今度、お願いします！'],
  profile: '松竹芸能の若手ツッコミ。努力家で、夢は自分のラジオ番組。',
  loves: ['takoyaki', 'manga'], likes: ['netacho', 'bento', 'drink', 'wadai'], dislikes: ['accessory'],
  giftLines: {
    love: ['{item}！？\nうわあ、ボクの大好きなやつです！\nほんまにおおきに！'],
    like: ['{item}、ええんですか！？\nおおきにです！'],
    neutral: ['ボクに、ですか？\nおおきにです。うれしいです！'],
    dislike: ['{item}…！？\nボクには似合わへんて！', '…あ、オカンにあげよかな。\nおおきにです。'],
  },
  greets: ['あっ、{name}さん！どないしたんですか？', '{name}さん！ちょうど稽古が終わったとこです！'],
  greetPartner: ['相方！今日もネタ合わせ、よろしゅうお願いします！\n…ボク、もう三回練習してきました！', '相方！劇場の出番表、見ました？\nボクら、今週も出られます！'],
  chats: [
    '今日もしゃべりの稽古、三時間やりました！\n…のど、ガラガラです。',
    'ラジオってええですよね。\n声だけで、だれかの夜に寄りそえるんです。',
    'オカンから「ちゃんと食べてるか」って\n一日三回メールが来るんです。',
    '劇場の出番、今日は二分でした！\n二分でも、ボクには大舞台です！',
  ],
  inviteYes: 'ほんまですか！？\n行きます行きます！',
  thanks: '今日はおおきにでした！\nめっちゃ楽しかったです！\n今夜のネタ帳、はかどりそうです！',
  declined: 'わかりました！\nまた声かけますね！',
  hello: 'タケルです！登録ありがとうございます！\nラジオみたいに、毎日おたより送ります！\n…ウソです！',
  partnerText: '相方、これからよろしゅうお願いします！\nボク、ツッコミ一生けんめい磨きます！',
  cheers: {
    rank: '{name}さん、「{rank}」おめでとうございます！\nボクも、すぐ追いつきますから！',
    agency: (g) => (g.state.agency === 'shochiku'
      ? '{agency}所属、おめでとうございます！\n同じ事務所やなんて、めっちゃうれしいです！'
      : '{agency}所属、おめでとうございます！\nいつか、いっしょの舞台に立ちましょう！'),
  },
  messages: [
    '今日の劇場、お客さん八人でした！\n八人全員、笑かしたりました！',
    'ラジオの深夜番組を聞きながら\nネタ書いてたら、朝でした。',
    'オカンのメール、きょうは五回来ました。\n新記録です。',
    '先輩に「ツッコミがやさしすぎる」って\n言われました。…きびしくツッコむ練習中です。',
    'なんばの川沿い、夜はネオンがきれいですよ。\n{name}さんにも見せたいなあ。',
    '{name}さん、ちゃんと寝てます？\nボクは、ネタ書いてたら寝落ちしてました！',
  ],
  partnerMessages: [
    '相方！今日のネタ、オチを変えてみました。\n聞いてもらえますか？',
    'ボクらのコンビ、劇場の支配人さんに\n「息が合うてきた」って言われました！',
    '相方がいるって、心強いです。\n舞台の袖で待つ時間も、楽しいです！',
  ],
  invites: [
    '{name}さん、今日ひまですか？\n「{spot}」行きません？',
    'ギャラ入りました！\n「{spot}」、行きましょう！',
    'ネタ合わせのあと、\n「{spot}」で反省会しません？',
  ],
  hangout: {
    ramen: ['大阪のラーメンも、うまいでっせ！\n…あ、「でっせ」は、ちょっと盛りました。', 'スープ、最後の一滴まで飲む派です！'],
    park: ['なんばの川沿いで、ひとりでラジオの練習するんです。\n「こんばんは、タケルです」…てれますね。', '{name}さん、ゲストで出てくれません？\n…練習のラジオですけど！'],
    cafe: ['カフェって、緊張しますね…。\n「ホットコーヒーの、ホットで」…。', 'それ、ホット二回言うてますやん！\n…自分でツッコみました。'],
    karaoke: ['ボク、歌はへたなんで、\nずっとタンバリンやります！', 'タンバリンの腕だけは、\n劇場でも評判なんです！'],
    famires: ['ファミレスで、ネタ帳ひらくの好きなんです。\n何時間でもいられるんで。', 'ドリンクバーは、コーラとお茶を\n交互にいく派です！'],
    sento: ['でっかいお風呂、最高ですね！\nしゃべりの声も、よう響きます！', '…あ、すんません！\nつい発声練習してもうた！'],
    default: ['{name}さんとしゃべってると、\n時間があっという間です！'],
  },
  combi: {
    ask: ['{name}さん…ボクと、\nコンビ組んでもらえませんか！'],
    again: ['{name}さん。ボク、あきらめてません！', 'ボクと、コンビ組んでもらえませんか！'],
    yes: ['ほ、ほんまですか！？\nうわあ…夢みたいや！', 'ボク、ツッコミ一生けんめい磨きます！\nよろしゅうお願いします、相方！'],
    no: ['…そ、そうですよね！\n急にすんません！\nでも、ボク、ずっと待ってますから！'],
    taken: ['{name}さんには、もう{partner}っていう\n相方がいてはるんでしたね。\nそれでも…ボクと組んでもらえませんか？'],
    keep: ['…ですよね！\n相方は、宝物ですもんね！\nほな、ライバルとしてよろしくお願いします！'],
    already: 'これからも、よろしゅうお願いします、相方！',
    bye: '新しい相方さんと、がんばってください。\n…ボクも負けへんように、稽古します！',
  },
  events: [
    ev(1, async (g, P, n) => {
      await T(g, P, ['あっ、{name}さん、でしたっけ。\nいつも声かけてもろて、おおきにです。', 'ボク、タケルいいます。\n松竹芸能の若手で、ツッコミやってます。']);
      const i = await Q(g, P, '{name}さんは、東京から\n来はったんですか？', ['そう、東京から', 'じつは大阪もすき']);
      if (i === 0) await T(g, P, 'ええなあ、東京！\nボクも一回、テレビ局を見てみたいです！');
      else {
        await E(g, n, '♥');
        await T(g, P, 'ほんまですか！\nなんばはね、夜のネオンも\nめっちゃきれいなんですよ！');
      }
      await T(g, P, ['ボク、毎日稽古場で\nしゃべりの練習してるんです。', 'いつか、自分のラジオ番組を\n持つのが夢なんです！']);
      g.addSkill('talk', 1);
    }),
    ev(2, async (g, P, n) => {
      await T(g, P, ['{name}さん、ちょっと練習に\nつきおうてもろてもええですか？', 'ラジオのお便りコーナーの練習です。\n{name}さんは、電話をかけてきた\nリスナーさん役で！', '「はい、こちらタケルの夜ふかしラジオ！\n　今夜のお電話は…どちらからですか？」']);
      const i = await Q(g, P, 'はい、{name}さんのセリフ！', ['「東京から！」', '「となりの部屋から」', '「…まちがい電話です」']);
      if (i === 0) {
        await E(g, n, '♪');
        await T(g, P, '東京から！\nうれしいですね〜、電波は県境をこえる！');
      } else if (i === 1) {
        await E(g, n, 'w');
        await T(g, P, 'となりの部屋！？\nほな、直接しゃべりましょうよ！\n…あかん、ラジオの意味ない！');
      } else {
        await E(g, n, '!');
        await T(g, P, 'まちがい電話！？\n…いや、これも何かのご縁です！\n今夜のゲストに決定〜！');
      }
      await E(g, n, '♥');
      await T(g, P, ['おもろい！\n{name}さんとしゃべると、\n言葉がどんどん出てきます！', 'これ、おすすめの雑誌です。\nラジオのネタ集めに、ボクも読んでます。']);
      g.giveItem('wadai');
    }),
    ev(3, async (g, P, n) => {
      await N(g, 'ロビーのすみで、タケルがネタ帳を見つめている。');
      await T(g, P, ['あ、{name}さん…。\nボク、コンビ組んでたんですけど、\n先月、解散したんです。', '相方が、就職するって。\n…しゃあないです。笑って送り出しました。']);
      await E(g, n, '…');
      await T(g, P, ['でも、ツッコミって、\nボケてくれる人がおらんと\nなんもできへんのですよ。', 'ボク、{name}さんのボケ、\nめっちゃ好きなんです。']);
      await combi(g, P, n);
    }),
    ev(4, async (g, P, n) => {
      if (isPartner(g, P.id)) {
        await T(g, P, '相方！\n松竹の若手ライブ、出番もらいました！\n行きましょう！');
        await cut(g);
        await N(g, 'ふたりの漫才に、劇場が笑いでつつまれた。\nタケルのツッコミが、いつもより冴えている！');
        await E(g, n, '♥', 60);
        await T(g, P, ['…聞こえました？あの笑い声。', '解散したとき、もう舞台に立たれへん\nって思ってました。\n{name}さんのおかげです。', 'いつか、ふたりでラジオやりましょうね。\n約束ですよ、相方！']);
        g.addSkill('warai', 3);
        g.addSkill('talk', 1);
        g.addFame(8);
      } else {
        await T(g, P, ['{name}さん！聞いてください！\nボク、地元のラジオで\nミニコーナーもらえたんです！', '五分だけですけど…\nボクの声が、電波に乗るんです！']);
        await E(g, n, '♥', 60);
        await T(g, P, ['{name}さんと練習したお便りコーナー、\nそのまま使います。', '第一回のゲストは…\n{name}さんに決まってますから！']);
        g.addSkill('talk', 2);
        g.addFame(3);
      }
    }),
  ],
});

// ---------------------------------------------------------------- ころ助 (新喜劇 楽屋)
person('korosuke', {
  name: '若手座員 ころ助', short: 'ころ助', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#f2c230', bottom: '#3b3f48' }, kind: 'comedian', dialect: 'kansai',
  where: '新喜劇 劇場の楽屋', polite: true, again: 'ほかに、なんかありますか？',
  giftDone: ['今日はもう、もろたとこですやん！', 'お気持ちだけで、じゅうぶんです！'], hangDone: '今日はもう、いっぱい遊んでもらいました！\nまた今度、さそてください！',
  callShy: ['もしもし、ころ助です！…あ、{name}さん！', 'また今度、楽屋でしゃべりましょ！'], callAgain: ['今日は、めっちゃ遊びましたね！', 'また今度、よろしゅうお願いします！'],
  // his talk in his own (polite Kansai) voice from the first meeting; the self-introduction
  // only that first time (the 座長 line stays the theater's own)
  npcTalkFrom: 0,
  npcTalk: async (g, npc, own) => {
    if (g.flag('shinkigeki_zacho')) return own(g, npc);
    const P = PEOPLE.korosuke;
    const p = g.person('korosuke');
    await T(g, P, [p && p.talkDay ? 'ぼく、今日もここで転ぶ練習ですわ！\n目標は、座長みたいな見事なこけっぷりです！'
      : '若手座員のころ助です！\n毎日、ここで転ぶ練習してますねん！', g.state.agency === 'yoshimoto'
      ? '同じよしもとの仲間ですやん！\nいつか同じ舞台に立ちましょな！'
      : 'エキストラやったら、だれでも舞台に立てますよ。\n舞台監督さんに言うてみてください！']);
  },
  profile: '新喜劇の若手座員。毎日ズッコケの稽古で、おしりは青あざだらけ。',
  loves: ['cake', 'takoyaki'], likes: ['butaman', 'manga', 'plushie'], dislikes: ['book'],
  giftLines: {
    love: ['{item}！？\nうわあ、ぼくの大好物です！\n…うれしすぎて、ズッコケそうです！'],
    like: ['{item}！？\nええんですか、おおきにです！\n大事にします！'],
    neutral: ['ぼくにですか？\nえへへ、照れますわ。おおきにです！'],
    dislike: ['{item}…。\nぼく、本持ったまま転んで、\nいっつもページ折ってまうんです…。', 'あ、でも、頭にのせて\nバランスの練習に使いますわ！'],
  },
  greets: ['あっ、{name}さん！（ズデーン）…あいたた。', '{name}さん！おつかれさんです！'],
  chats: [
    '今日は百回転びましたわ！\nおしりの青あざが、ぼくの勲章です！',
    '座長のギャグ、毎日見てるのに\n毎回笑ってまうんです。プロ失格ですかね…？',
    '楽屋のおばちゃんのお茶、飲みました？\nあれ飲んだら、転んでも痛ないんです！\n…気のせいやろか。',
    'ふるさとの母ちゃんに、新喜劇の\nチケット送りました！来てくれるやろか。',
  ],
  inviteYes: 'えっ、ぼくとですか！？\nよろこんで！今日の稽古、ちょうど終わったとこです！',
  thanks: '今日はほんま、おおきにです！\nぼく、ずっと笑いっぱなしでしたわ！',
  declined: 'わかりました！\nほな、また今度ぜひ！',
  hello: 'ころ助です！\n楽屋のみんなに、スマホの使い方を\n教えてもろたんです！よろしゅうお願いします！',
  cheers: {
    rank: '{name}さん、「{rank}」おめでとうございます！\n楽屋のみんなで、ズッコケてお祝いしましたわ！',
    agency: (g) => (g.state.agency === 'yoshimoto'
      ? '{agency}所属、おめでとうございます！\n同じよしもとの仲間ですやん！\nいつか同じ舞台に立ちましょな！'
      : '{agency}所属、おめでとうございます！\nいつか、同じ舞台に立ちたいですわ！'),
  },
  messages: [
    '今日の舞台、通行人の役で出ました！\n…セリフは「あっ」だけでした！',
    '座長に「ころ助のこけ方、ようなってきた」\nって言われました！…録音しといたらよかった！',
    '母ちゃんから手紙が来ました。\n「ちゃんと転んでるか」って。\n…どういう心配やねん。',
    'おしりにクッション入れて稽古したら、\n師匠にバレてしもて…めっちゃ怒られました。',
    'なんばのたこ焼き、ぼく一日三食いけますわ！',
    '{name}さんの番組、楽屋のテレビで\nみんなで見ました！\n座長がいちばん笑てはりました！',
  ],
  invites: [
    '稽古、休みなんです！\n「{spot}」、行きませんか？',
    '{name}さん、「{spot}」行きませんか！\n今日は転ばんように、気ぃつけて行きます！',
    '今日は舞台、昼の一回だけなんです！\n「{spot}」で、ひと息つきません？',
  ],
  hangout: {
    ramen: ['ラーメン、ずるずるっ！\n…あっ、スープはねてもうた！', 'これも、リアクションの練習です！\n…いうことにしといてください！'],
    park: ['公園の芝生って、\n転ぶ練習にぴったりなんです！', 'それっ、ズデーン！\n…あ、子どもらに拍手されてもうた！'],
    cafe: ['カフェって、ぼく、はじめてかもです！\nいすが、ふかふかや…！', '…ふかふかすぎて、\nいすごとひっくり返りそうですわ！'],
    karaoke: ['新喜劇のテーマ、歌てもええですか？\n…ズッコケつきで！', '{name}さんの歌のオチで、\nぼく、ばっちりこけますわ！'],
    famires: ['ファミレスのハンバーグ、\n母ちゃんの味に、ちょっと似てます。', '…いや、母ちゃんのは焦げてたな。\nこっちのほうが、うまいですわ！'],
    sento: ['でっかいお風呂！\n…足すべって、ズッコケそうや！', '銭湯でほんまに転んだらあぶないんで、\nゆっくり歩きます！'],
    default: ['{name}さんとおでかけ、めっちゃ楽しいです！'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await T(g, P, ['{name}さん！いつも楽屋に来てくれて\nおおきにです！', 'あらためまして、ころ助です！\n新喜劇の、いちばん下っぱです！']);
      const i = await Q(g, P, 'ズッコケの練習、\nいっしょにやってみません？', ['やる！ズデーン！', '見てるだけで']);
      g.sfx('zukko');
      if (i === 0) {
        await ME(g, '!');
        await E(g, n, 'w');
        await T(g, P, 'お見事です！\n{name}さん、才能ありますやん！');
        g.addSkill('warai', 1);
      } else {
        await T(g, P, 'ほな、ぼくがお手本を！\nそれっ…ズデーン！\n…いたた、今日いちばんのこけ方です！');
      }
      await E(g, n, '♥');
      await T(g, P, 'ズッコケはね、こわがらんと\n思いきりいくのがコツなんですわ！');
    }),
    ev(2, async (g, P, n) => {
      await E(g, n, '…');
      await T(g, P, ['{name}さん、ちょっと聞いてください…。\n師匠に「ころ助のこけ方には\n迷いがある」って言われてしもて。', 'ぼく、痛いのがこわいんやろか…。']);
      const i = await Q(g, P, 'どないしたら、迷いなく\nこけられますかね…？', ['セリフをよく聞く', 'こけたあと笑顔']);
      if (i === 0) {
        await E(g, n, '!');
        await T(g, P, ['セリフを、よう聞く…！\n源じいさんも、同じこと言うてはりました！', 'こけることばっかり考えて、\nお芝居を聞いてへんかったんや…！']);
      } else {
        await E(g, n, '♥');
        await T(g, P, 'こけたあと、笑顔…！\nそっか、お客さんに\n「大丈夫やで」って見せるんですね！');
      }
      await T(g, P, 'おおきにです！\n明日の稽古で、さっそくやってみます！');
      g.addSkill('warai', 2);
    }),
    ev(3, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['{name}さん！えらいこっちゃ！\n母ちゃんが、今度の舞台を\n見に来るんです！', 'しかも、ぼく…はじめて\nセリフのある役をもろたんです！', 'セリフは「なんでやねん！」の一言。\nでも、ぼくにとっては大事な一言です。\n…緊張して、夜も寝られへんのです。']);
      const i = await Q(g, P, '{name}さん、練習につきおうてください！', ['ボケるから、ツッコんで', 'いっしょに深呼吸']);
      if (i === 0) {
        await T(g, P, ['（{name}がボケた！）', '…なんでやねん！']);
        g.sfx('hit');
        await E(g, n, 'w');
        await T(g, P, 'あはは！ちゃんと言えた！\n{name}さんのボケ、ツッコみやすいですわ！');
      } else {
        await T(g, P, 'すー、はー…。\nすー、はー…。\n…落ちついてきました！');
      }
      await E(g, n, '♥');
      await T(g, P, 'これ、楽屋の差し入れのたこ焼き。\n{name}さんも、どうぞ！');
      g.giveItem('takoyaki');
    }),
    ev(4, async (g, P, n) => {
      await E(g, n, '!');
      await T(g, P, ['{name}さん！\n舞台、終わりました！', 'ぼくの「なんでやねん！」で、\n客席がドカンとウケたんです！']);
      await E(g, n, '♥', 60);
      await T(g, P, ['母ちゃん、いちばん前の席で\n泣きながら笑ってました。', '終わってから、楽屋に来て…\n「あんた、ようこけたなあ」って。\n…ほめ言葉ですやんね？', '{name}さんが、ずっと応援してくれたから、\nがんばれました！\nほんまに、おおきにです！']);
      g.addSkill('warai', 3);
      g.addFame(3);
    }),
  ],
});

// ---------------------------------------------------------------- 大将 (なんばのたこ焼き屋)
person('taisho', {
  name: 'たこ焼き屋の大将', short: '大将', look: { ...LOOKS.chef, hat: '#ffffff', top: '#2a3560', bottom: '#2a3560' }, kind: 'local',
  where: 'なんばのたこ焼き屋', talkLabel: 'お店のメニュー', again: 'ほかに用はあるか？',
  giftDone: ['今日はもう、もろたで。', '気ぃつかわんでええ。'], hangDone: '今日はもう、つきおうたやろ。\nまた今度な。',
  callShy: ['…もしもし。大将や。', '用があったら、店に来い。'], callAgain: ['今日はもう、ようけ遊んだやろ。', 'はよ寝え。'],
  profile: 'なんばで三十五年。口は悪いが、腹ぺこの若手にはやさしい大将。',
  loves: ['cd', 'okashi'], likes: ['tea', 'hanataba', 'book'], dislikes: ['takoyaki'],
  giftLines: {
    love: ['{item}！？\n…あんた、わかっとるやないか。\nおおきに。…目にソースが入っただけや。'],
    like: ['{item}かいな。\nおおきに、ありがたくもろとくわ。'],
    neutral: ['わしに？\nなんや、気ぃつかわんでええのに。おおきに。'],
    dislike: ['よそのたこ焼きやと！？\nええ度胸しとるやないか！', '…ほな、研究させてもらうわ。'],
  },
  greets: ['まいど！…なんや、{name}かいな。', 'おう、{name}！焼きたてやで！'],
  chats: [
    '生地はな、前の晩から寝かせるんや。\n人間も同じや。よう寝なあかんで。',
    '若いころは、演歌歌手になりたかったんや。\n…笑たな？いま笑たやろ！',
    '店の前で芸人の卵が腹すかしとったら、\n一皿サービスすんのが、うちの決まりや。',
    'たこ焼きの丸さはな、まごころの丸さや。',
  ],
  inviteYes: 'しゃあないな。\n店は、バイトにまかせたる！',
  thanks: '今日はおおきに。\n…まあ、たまには悪ないな。',
  declined: 'さよか。ほな、またな。',
  hello: '大将や。\nスマホは老眼にきびしいな…。\n用があったら、店に来い。以上や。',
  cheers: {
    rank: '「{rank}」になったらしいな。\n…ようやった。\n次来たら、一皿サービスしたる。',
    agency: '{agency}に入ったんやてな。\nおめでとうさん。\n腹へったら、いつでも来いや。',
  },
  messages: [
    '今日は鉄板の調子がええ。\n…それだけや。',
    'ソースを新しくしたで。\n味見しに来い。',
    '雨の日は客が少ない。\nこういう日は、ラジオで演歌や。',
    '常連のおばちゃんが、\nまた「おもろいこと言え」言うてくる。\nわしは芸人ちゃうっちゅうねん。',
    'あんたのテレビ、店のテレビで見たで。\n客がみんな見入って、たこ焼きが焦げたわ。',
    '体はだいじょうぶか。\nたこ焼き食うて、寝ろ。',
  ],
  invites: [
    '今日は店休みや。\n「{spot}」でも行くか。',
    '{name}、ひまか。\n「{spot}」行こか。…たまにはな。',
    'たまには、鉄板の前を離れなあかん。\n「{spot}」や。来い。',
  ],
  hangout: {
    ramen: ['ラーメン屋の大将も、ええ仕事しとるな…。\nスープの取り方、聞いてくるわ。', '…いや、ライバル店に聞くのは\nさすがにアカンか。'],
    park: ['公園の空気は、ええな。\n鉄板の前ばっかりやと、季節がわからん。', '…なんや、じっと見て。\nわしかて、たまには散歩するわ。'],
    cafe: ['カフェなんか、何十年ぶりや。\n…このケーキ、丸いな。たこ焼きに勝てるか？', '…うまいやないか。くやしいけど。'],
    karaoke: ['しゃあない、一曲だけや。\n…演歌しかないで。', 'どや、聞いたか。\nこれが三十五年きたえたのどや。'],
    famires: ['ファミレスのメニュー、写真ばっかりやな。\n…わかりやすうてええ。', 'お子さまランチの旗、\n店のたこ焼きにも立てたろか。'],
    sento: ['銭湯はな、毎日の楽しみや。\n仕事終わりの一番風呂が最高やで。', '湯あがりのビン牛乳。\nこれだけは、ゆずられへん。'],
    default: ['…たまには、店の外もええもんやな。'],
  },
  events: [
    ev(1, async (g, P, n) => {
      await T(g, P, ['なんや、また来たんか。\n…まあ、座れ。', 'この店な、もう三十五年や。\nわしが若いころから、\nずっとこの鉄板の前や。', 'ほれ、焼きたて一皿。\n…お代？ええわ、今日はサービスや。']);
      g.giveItem('takoyaki');
      await E(g, n, '♪');
      await T(g, P, '腹すかした若いもんは、ほっとけんのや。\nそれだけや。');
    }),
    ev(2, async (g, P, n) => {
      await T(g, P, ['{name}、ちょっとこっち来い。\nたこ焼きの返し方、教えたる。', '千枚通しをこう持って…\n生地のふちを、くるっと。']);
      const i = await Q(g, P, 'ほれ、やってみい。', ['タン、タン、くるっ！', 'えいっ！（力まかせ）']);
      if (i === 0) {
        g.sfx('good');
        await E(g, n, '♥');
        await T(g, P, '…ほう。リズムがええな。\n芸人は、間がええと\nたこ焼きもうまく焼けるんや。');
      } else {
        g.sfx('buzz');
        await E(g, n, '…');
        await T(g, P, 'あーあー、つぶれとるがな。\n…まあ、最初はそんなもんや。\nわしも最初は、ぜんぶつぶした。');
      }
      await T(g, P, '焼いたぶんは、持って帰り。\nつぶれてても、味はいっしょや。');
      g.giveItem('takoyaki', 2);
    }),
    ev(3, async (g, P, n) => {
      await N(g, '大将が、店の奥から古い写真を持ってきた。');
      await T(g, P, ['見てみ。\nこれは、むかしうちに通っとった\n若い芸人らの写真や。', '金がない、売れへん、腹へった…\nいっつも同じこと言うて、\nたこ焼き一皿で何時間もねばっとった。', 'いまテレビに出とるやつもおる。\nやめて、ふるさとで店やっとるやつもおる。\nどっちも、わしの自慢の常連や。']);
      await E(g, n, '♥');
      await T(g, P, ['{name}。売れても売れんでも、\n腹へったら来い。\nここは、そういう店や。', '…それだけや。はよ帰って寝ろ。']);
      g.relax({ stress: 15 });
      await N(g, 'ぶっきらぼうな言葉が、\nなんだか心にしみた。（ストレス -15）');
    }),
    ev(4, async (g, P, n) => {
      await T(g, P, 'おう、{name}。\nちょうど新しいソースができたとこや。\n味見してくれ。');
      const i = await Q(g, P, '…どうや？', ['最高！', 'ちょっと甘い？']);
      if (i === 0) {
        await E(g, n, '♥');
        await T(g, P, 'せやろ。\n三十五年で、いちばんの出来や。');
      } else {
        await E(g, n, '!');
        await T(g, P, ['…ほう、わかるか。\nあんたの舌、ほんまもんや。', '若い客にも合うように、\nちょっとだけ甘うしたんや。']);
      }
      await T(g, P, ['なあ、{name}。\nあんたがスターになったら、\nうちの店にサイン飾らしてくれ。', 'むかしの常連らのサインの、\nいちばん真ん中にな。…約束やで。']);
      await E(g, n, '♥', 60);
      g.giveItem('takoyaki', 3);
    }),
  ],
});

// ---------------------------------------------------------------- talking: follow-ups
// The menu prompt: a greeting or a bit of personal small talk.
function greetFor(g, P) {
  const p = g.person(P.id) || {};
  const pool = [];
  if (isPartner(g, P.id) && P.greetPartner) return pick([].concat(P.greetPartner));
  if (p.special && P.greetSpecial && Math.random() < 0.6) return pick([].concat(P.greetSpecial));
  for (const c of P.chats || []) { const s = typeof c === 'function' ? c(g) : c; if (s) pool.push(s); }
  if (P.greets && (!pool.length || Math.random() < 0.4)) return g.fmt(pick(P.greets));
  return pool.length ? pick(pool) : null;
}

// The engine sends a generic first message when you exchange contacts; use the person's own.
function tidyInbox(g) {
  const box = g.state.phone && g.state.phone.inbox;
  if (!box) return;
  for (const m of box) {
    const P = m.person && PEOPLE[m.person];
    if (!P || !P.hello || m.read || m.kind !== 'chat' || m.tidy) continue;
    if (m.text === `${P.name}です！連絡先、登録しといてね。`) { m.text = flat(g.fmt(P.hello)); m.tidy = true; }
  }
}

// A declined 相方 / 大切な人 proposal comes up again (5 / 7 days later), instead of the menu.
async function followUp(g, P, npc) {
  const p = g.person(P.id);
  if (!p || g.pendingHeartEvent(P.id)) return false;
  const lv = heartIndex(p.aff), day = g.state.day;
  if (P.canPartner && P.combi && p.seen[3] && lv >= 3 && !isPartner(g, P.id) && p.combiAsk && (p.combiTries || 0) < 3 && day - p.combiAsk >= 5) {
    await combi(g, P, npc, true);
    return true;
  }
  if (P.special && P.confess && p.seen[4] && lv >= 4 && !p.special && !otherSpecial(g, P.id) && p.confessAsk && (p.confessTries || 0) < 2 && day - p.confessAsk >= 7) {
    await confess(g, P, npc, true);
    return true;
  }
  return false;
}

// The talk menu itself is phone.js's (PEOPLE_UI.talk); the cast plugs into its hooks.
const castOf = (id) => (PEOPLE[id] && PEOPLE[id].cast ? PEOPLE[id] : null);
const hooks = PEOPLE_UI.hooks || (PEOPLE_UI.hooks = {});
for (const k of ['start', 'before', 'greet', 'after']) if (!Array.isArray(hooks[k])) hooks[k] = [];
if (!Array.isArray(PEOPLE_UI.extras)) PEOPLE_UI.extras = [];
hooks.start.push((g, id, npc) => {
  const P = castOf(id);
  if (!P || !npc) return;
  if (npc.look) P.look = npc.look; // the face always matches the sprite on the map
  // a friendlier version of the NPC's own talk once you know each other (P.npcTalk)
  if (P.npcTalk && typeof npc.talk === 'function' && !npc.castTalk) {
    const own = npc.talk;
    npc.castTalk = true;
    const from = P.npcTalkFrom ?? 1;
    npc.talk = (g2, n2) => (g2.heartLevel(id) >= from ? P.npcTalk(g2, n2, own) : own(g2, n2));
  }
});
// a declined proposal comes up again some days later (instead of the menu)
hooks.before.push(async (g, id, npc) => {
  const P = castOf(id);
  return !!P && g.met(id) && followUp(g, P, npc);
});
hooks.after.push((g) => tidyInbox(g));

// Menu entries: you bring up the combi / your feelings yourself, after they asked once.
PEOPLE_UI.extras.push({
  id: 'cast_combi', label: 'コンビを組もう', order: 20,
  cond: (g, id) => {
    const P = castOf(id), p = g.person(id);
    return !!(P && P.canPartner && P.combi && p && p.seen && p.seen[3] && g.heartLevel(id) >= 3 && !isPartner(g, id));
  },
  run: async (g, id, npc) => {
    const P = PEOPLE[id];
    const cur = g.state.partner && PEOPLE[g.state.partner] ? g.state.partner : null;
    if (cur) {
      const C = PEOPLE[cur];
      const i = await g.ask(`いまの相方（${C.short || C.name}）とのコンビは解消になる。\n${P.short || P.name}と組みなおす？`, ['組みなおす', 'やめておく'], { cancel: 1 });
      if (i !== 0) return;
    }
    await N(g, `（${P.short || P.name}に、思いきってコンビの話を切り出した）`);
    makePartner(g, id);
    const p = g.meet(id);
    p.combiTries = 0;
    g.sfx('fanfare');
    await E(g, npc, '♥', 50);
    await T(g, P, P.combi.yes);
    await N(g, `${P.short || P.name}と、コンビを組んだ！\n（相方がいると、お笑いのミニゲームが少しやさしくなる）`);
    return 'end';
  },
});
PEOPLE_UI.extras.push({
  id: 'cast_confess', label: '気持ちを伝える', order: 21,
  cond: (g, id) => {
    const P = castOf(id), p = g.person(id);
    return !!(P && P.special && P.confess && p && p.seen && p.seen[4] && g.heartLevel(id) >= 4 && !p.special && !otherSpecial(g, id));
  },
  run: async (g, id, npc) => {
    const P = PEOPLE[id];
    const i = await g.ask(`${P.short || P.name}に、自分の気持ちを伝える？\n（「大切な人」になれるのは、ひとりだけ）`, ['伝える', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    await N(g, `（${P.short || P.name}に、思いきって気持ちを伝えた）`);
    makeSpecial(g, id, P.confess.text);
    g.sfx('chime');
    await E(g, npc, '♥', 60);
    await T(g, P, P.confess.yes);
    return 'end';
  },
});
// The 大将 picks up 豚まん from the shop next door (the only shop that has them).
PEOPLE_UI.extras.push({
  id: 'cast_butaman', label: '豚まんも買う', order: 30, repeat: true,
  cond: (g, id) => id === 'taisho' && !!ITEMS.butaman,
  run: async (g, id, npc) => {
    const P = PEOPLE[id];
    await T(g, P, '豚まんか。となりの店のやつ、\nわしの晩メシのついでに仕入れとるんや。\nおみやげにちょうどええで。');
    await g.shop(['butaman'], { title: 'おみやげの豚まん', greeting: '一個800円や。' });
  },
});

// ---------------------------------------------------------------- the morning: friends text you
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// a different line than last time
function freshLine(p, list) {
  if (!list || !list.length) return null;
  const pool = list.length > 1 ? list.filter((s) => s !== p.lastMsg) : list;
  const s = pick(pool);
  p.lastMsg = s;
  return s;
}
const CHEER = {
  rank: '「{rank}」になったんだって？\nおめでとう！',
  agency: '{agency}に入ったんだって？\nおめでとう！',
};
const MAX_MORNING = 2; // new people messages per morning
// Chance that a free friend texts on a given morning: with ~5 friends, a message on
// most days (about 3 days in 4), never more than MAX_MORNING. 相方 / 大切な人 more often.
const TEXT_CHANCE = 0.27, CLOSE_CHANCE = 0.45;
// The place as it reads in an invitation (「公園」に行かない？, not 「公園で散歩」に…).
const SPOT_WORD = { park: '公園' };
const spotWord = (id) => SPOT_WORD[id] || (HANGOUTS[id] && HANGOUTS[id].name) || id;

onMorning((g) => {
  const st = g.state;
  if (!st || !st.people || !st.phone) return;
  const day = st.day;
  const fl = st.flags;
  const sent = new Set();
  tidyInbox(g);
  // nobody texts two days in a row (nor twice in one morning); after an arrest the usual small talk
  // and invitations stop for a while (justice reactions below), and some people keep away longer
  const J = fl.people_jus && typeof fl.people_jus === 'object' ? fl.people_jus : null;
  const hush = !!J && (day - num(J.arrest, -99) < HUSH_ARREST || day - num(J.release, -99) < HUSH_RELEASE || day - num(J.scandal, -99) < HUSH_RELEASE);
  const away = (id) => !!(J && J.away && num(J.away[id]) > day);
  const free = (id) => { const p = st.people[id]; return !!p && p.msgDay !== day - 1 && p.msgDay !== day && !sent.has(id) && !away(id); };
  const send = (id, msg) => {
    const P = PEOPLE[id];
    const p = g.meet(id);
    p.msgDay = day;
    p.contact = true;
    g.message({ from: P.name, person: id, kind: 'chat', ...msg, text: flat(g.fmt(msg.text)) });
    sent.add(id);
  };
  const bond = (id) => g.aff(id) + (st.partner === id ? 100 : 0) + (isSpecial(g, id) ? 100 : 0);
  const closest = () => Object.keys(st.people).filter((id) => PEOPLE[id] && g.heartLevel(id) >= 1 && free(id)).sort((a, b) => bond(b) - bond(a))[0];
  const cheer = (P, k) => {
    const v = P.cheers && P.cheers[k];
    return (typeof v === 'function' ? v(g) : v) || CHEER[k];
  };

  // reactions to your progress (a new title, joining an agency)
  const rank = rankIndex(st.fame);
  // fl.people_rank is the highest title seen: losing one and winning it back is not news
  if (typeof fl.people_rank !== 'number') fl.people_rank = rank;
  else if (rank > fl.people_rank) {
    fl.people_rank = rank;
    const id = closest();
    if (id) send(id, { text: cheer(PEOPLE[id], 'rank').replaceAll('{rank}', RANKS[rank][1]) });
  }
  const ag = st.agency || '';
  if (typeof fl.people_agency !== 'string') fl.people_agency = ag;
  else if (ag !== fl.people_agency) {
    fl.people_agency = ag;
    const id = ag && sent.size < MAX_MORNING ? closest() : null;
    if (id) send(id, { text: cheer(PEOPLE[id], 'agency') });
  }

  // the combi on hold (arrest of a known face): back together once the player is free, out of
  // 活動自粛 and two weeks have passed (a term inside ends it on release: jusReleased)
  const pid = st.partner;
  if (J && J.combiPause && pid && PEOPLE[pid] && free(pid) && sent.size < MAX_MORNING) {
    let js = null;
    try { js = typeof g.justiceStatus === 'function' ? g.justiceStatus() : null; } catch (e) { js = null; }
    if (day - num(J.combiPause) >= 14 && !(js && (!js.free || js.kinshinUntil))) {
      J.combiPause = 0;
      send(pid, { text: isKansai(PEOPLE[pid]) ? 'そろそろ、コンビ再始動といこか。\n…今度こそ、ちゃんとやろな。' : 'そろそろ、コンビを再始動しよう。\n…今度こそ、ちゃんとやろう。' });
    }
  }
  // friends (♥2+) sometimes text: small talk, or an invitation for today
  if (hush) return;
  // off the air (活動自粛 / a TV ban): no "I saw your show" small talk
  let offAir = false;
  try { const js = typeof g.justiceStatus === 'function' ? g.justiceStatus() : null; offAir = !!(js && (js.kinshinUntil || js.tvBanUntil)); } catch (e) { offAir = false; }
  const onAir = (list) => (offAir && list ? list.filter((t) => typeof t !== 'string' || !SAW_SHOW.test(t)) : list);
  const spots = Object.keys(HANGOUTS);
  for (const id of shuffle(g.friends(2).filter(free))) {
    if (sent.size >= MAX_MORNING) break;
    const P = PEOPLE[id];
    const p = st.people[id];
    const close = st.partner === id || p.special;
    if (Math.random() >= (close ? CLOSE_CHANCE : TEXT_CHANCE)) continue;
    if (spots.length && P.invites.length && p.hangDay !== day && Math.random() < 0.4) {
      const own = spots.filter((s) => P.hangout && P.hangout[s]);
      const spot = pick(own.length ? own : spots);
      send(id, { kind: 'invite', spot, text: freshLine(p, P.invites).replaceAll('{spot}', spotWord(spot)) });
    } else {
      let list = P.messages;
      if (st.partner === id && P.partnerMessages && !(J && J.combiPause) && Math.random() < 0.5) list = P.partnerMessages;
      else if (p.special && P.specialMessages && Math.random() < 0.5) list = P.specialMessages;
      const text = freshLine(p, onAir(list));
      if (text) send(id, { text });
    }
  }
});
