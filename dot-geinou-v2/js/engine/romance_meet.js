// 恋愛・結婚・家庭 (R12-L1) — 出会い: 合コン / 友だちの紹介 / お見合い / パーティー / 街コン / マッチングアプリ / 職場・共演者 / 相方の友人.
// Era-accurate: the お見合い of 昭和 (仲人, 「あとは若いお二人で」), the パーティー of 平成, the アプリ of 令和. Everything is an offer you may
// decline; nobody is ever pushed. People you meet start as 'know' (a contact), and may become 'close' (気になる人).
import { PEOPLE } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { ageOf, prefecture, YEAR_DAYS, profileOf } from './profile.js';
import { SKILLS } from './state.js';
import * as D from './romance_data.js';
import {
  rom, active, recOf, leadRec, isCouple, shortName, recLook, eraOf, jobOf, addHist, makeCandidate, persistRec, romMessage, queueEvent, onRomEvent,
  onRomTick, blockReason, flat, castCandidates, adoptCast, CAST, recAge,
} from './romance.js';
import { playScene, sayAs, askAs } from './romance_scene.js';
import { topicRound, eraWord } from './romance_date.js';

const pgOf0 = (g) => profileOf(g.state).gender;
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const sl = (rec, s, x) => D.sayLine(s, rec, x);
const clockNow = (g) => { try { return typeof g.clock === 'function' ? g.clock() : null; } catch (e) { return null; } };

const HOBBY = {
  indoor: 'おうちでのんびりする', outdoor: 'あちこち出かける', talk: '友だちとおしゃべりする', quiet: 'しずかに過ごす', warai: 'お笑いを観に行く',
  music: '音楽を聴いたり、歌ったりする', gourmet: 'おいしいお店をさがす', book: '本を読む', sports: '体を動かす', nature: '散歩しながら、写真を撮る',
};
// What the player does (for what strangers say)
export function careerWord(g) {
  const st = g.state;
  const pol = st.politics && st.politics.me && st.politics.me.office;
  if (pol) return '政治のお仕事';
  if (st.fame >= 800) return 'テレビにも出ている芸能のお仕事';
  if (st.fame >= 100) return '芸能のお仕事';
  return '芸人としての修業';
}
const REACT = {
  yasashii: '「素敵なお仕事ですね。…どんなことをされているのか、聞いてみたいな」',
  akarui: '「えっ、すごーい！テレビとか、出たりするんですか？」',
  majime: '「大変なお仕事ですよね。尊敬します」',
  mypace: '「あ、そうなんですね〜。いろんなお仕事があるんですね」',
  shikkari: '「へえ、そうなんだ。…応援したくなりますね」',
  cool: '「…そうですか。おもしろそうですね」',
  genki: '「えっ！本物！？見たい見たい！」',
  ganbariya: '「夢に向かってがんばってるの、かっこいいです」',
};
const polite = (rec) => `${rec.fam}${rec.giv}`;
// A polite self-introduction (and the first thing you learn: a hobby).
export function introLines(g, rec) {
  const era = eraOf(g);
  const tag = rec.tags[0];
  const kn = rec.kn || (rec.kn = []);
  if (!kn.includes(tag)) kn.push(tag);
  return [
    `「はじめまして。${polite(rec)}と申します」`,
    `「${jobOf(g, rec)}をしています。${prefecture(rec.hm).name}の出身です」`,
    `「休みの日は、${HOBBY[tag]}ことが多いです」`,
  ];
}
function nameTag(rec) { return `${rec.fam}${rec.giv}`; }

// ---------------------------------------------------------------- the one thing every meeting ends with: a contact
export function exchange(g, rec, a0, via, sc) {
  const st = g.state;
  rec.via = via;
  const saved = persistRec(g, rec, a0);
  if (rec.kn) saved.kn = rec.kn.slice();
  g.sfx('chime');
  g.notify(`${saved.n}と 連絡先を交換した`, { color: '#ff7eb6' });
  addHist(g, `${({ goukon: '合コン', shokai: '友だちの紹介', omiai: 'お見合い', party: 'パーティー', konkatsu: '婚活パーティー', machikon: '街コン', app: 'アプリ', shokuba: '仕事', aibou: '相方の友人' })[via] || '出会い'}で、${saved.n}さんと知り合った`);
  return saved;
}
const costOf = (g, kind) => D.MEET[kind] ? D.MEET[kind].price : 0;
function payFor(g, kind) {
  const price = costOf(g, kind);
  if (price && !g.spend(price)) return false;
  return true;
}
function eveningOf(g) {
  if (typeof g.advanceTo === 'function') { const ck = clockNow(g); if (ck && ck.minutes < 17 * 60 + 30) g.advanceTo(18 * 60, '会食'); }
  const ck = clockNow(g);
  return ck && ['night', 'late'].includes(ck.phase) ? 'night' : 'dusk';
}

// ---------------------------------------------------------------- 合コン
// 4–5 strangers around a long table. You talk with two of them; at the end you may swap contacts with one (or two).
export async function goukonFlow(g, o = {}) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const bw = blockReason(g);
  if (bw) { await g.say(`（${bw}）`); return null; }
  if (st.money < costOf(g, 'goukon') || st.stamina < 6) { await g.say('（お金か体力が足りない…）'); return null; }
  const friend = o.friend && PEOPLE[o.friend] ? PEOPLE[o.friend] : null;
  const crowd = [];
  const n = 4;
  for (let i = 0; i < n; i++) crowd.push(makeCandidate(g, { temp: true, via: 'goukon', ageMin: ageOf(st) - 3, ageMax: ageOf(st) + 6 }));
  if (!g.spend(costOf(g, 'goukon'))) return null;
  st.stamina -= 6;
  const phase = eveningOf(g);
  const picked = [];
  let saved = null;
  await playScene(g, {
    art: 'goukon', title: eraWord(era, { reiwa: '合コン', d: '合コン' }), phase, bgm: 'rom_date',
    extra: { crowd: crowd.map((r) => recLook(r, era)), names: crowd.map((r) => `${r.fam}さん`), friend: friend ? friend.look : undefined },
  }, async (sc) => {
    await sc.intro('合コン');
    if (friend) await sayAs(g, friend, ['今日は来てくれて、ありがとう！', 'みんな、いい人たちだから、楽しんでいってね。']);
    else await g.say('（友だちに誘われて、にぎやかな食事会に参加した）');
    await g.say(['「それじゃ、かんぱーい！」', '（まずは順番に、自己紹介だ）']);
    for (const r of crowd) {
      const who = { name: `${r.fam} ${r.giv}`, look: recLook(r, era) };
      await g.say(`（${r.fam}さん／${recAge(g, r)}歳・${jobOf(g, r)}）`.replace('／', '　'));
    }
    // two conversations
    for (let round = 0; round < 2; round++) {
      const avail = crowd.filter((r) => !picked.includes(r));
      const i = await g.ask(round === 0 ? 'だれと話してみる？' : 'もうひとり、話してみる？', avail.map((r) => `${r.fam}さん（${jobOf(g, r)}）`), { cancel: avail.length - 1 });
      const r = avail[i];
      picked.push(r);
      const who = { name: `${r.fam} ${r.giv}`, look: recLook(r, era) };
      await sayAs(g, who, introLines(g, r));
      await sayAs(g, who, `「{name}さんは、${careerWord(g)}をされているんですよね」`);
      await g.say(g.fmt(REACT[r.per] || REACT.yasashii), who);
      r.a0 = 14 + (await topicRound(g, r, who, sc)) * 2;
    }
    await g.say('（楽しい時間は、あっという間にすぎていく…）');
    const names = picked.map((r) => `${r.fam}さんと交換する`);
    const k = await g.ask('連絡先を交換しようか？', [...names, 'だれとも、しない'], { cancel: names.length });
    if (k < picked.length) {
      const r = picked[k];
      const who = { name: `${r.fam} ${r.giv}`, look: recLook(r, era) };
      await sayAs(g, who, '「じゃあ…連絡先、交換しませんか？」');
      saved = exchange(g, r, r.a0 || 16, 'goukon', sc);
      sc.burst(5);
    }
  });
  return saved;
}

// ---------------------------------------------------------------- 友だちの紹介 (the friend brings someone; then leaves you two)
export async function shokaiFlow(g, o = {}) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const bw = blockReason(g);
  if (bw) { await g.say(`（${bw}）`); return null; }
  const friend = o.friend && PEOPLE[o.friend] ? PEOPLE[o.friend] : null;
  if (st.money < costOf(g, 'shokai') || st.stamina < 4) { await g.say('（お金か体力が足りない…）'); return null; }
  const r = makeCandidate(g, { temp: true, via: 'shokai' });
  if (!g.spend(costOf(g, 'shokai'))) return null;
  st.stamina -= 4;
  let saved = null;
  const look = recLook(r, era);
  const who = { name: r.n, look };
  await playScene(g, { art: 'cafe', title: eraWord(era, { showa: '喫茶店', heisei_early: '喫茶店', d: 'カフェ' }), you: look, phase: 'day', bgm: 'rom_date' }, async (sc) => {
    await sc.intro('友だちの紹介');
    if (friend) await sayAs(g, friend, [`こちら、${nameTag(r)}さん。前に話した、いい人だよ。`, '{name}も、きっと気が合うと思う。']);
    else await g.say(`（友だちが、${nameTag(r)}さんを紹介してくれた）`);
    await sayAs(g, who, introLines(g, r));
    if (friend) await sayAs(g, friend, ['あっ、ちょっと用事を思い出した！', 'あとは、ふたりでごゆっくり〜。']);
    await g.say(g.fmt(REACT[r.per] || REACT.yasashii), who);
    const bonus = await topicRound(g, r, who, sc);
    await g.say('（ふたりきりでも、気まずくない。\nなんだか、話しやすい人だ）');
    await sayAs(g, who, '「…よかったら、連絡先、教えてもらえますか？」');
    saved = exchange(g, r, 18 + bonus * 2, 'shokai', sc);
    sc.burst(4);
  });
  if (friend && saved && o.friend) g.addAff(o.friend, 2, true);
  return saved;
}

// ---------------------------------------------------------------- お見合い (a 仲人 sits between; 「あとは若いお二人で」)
// 縁談 (arranged meetings) came between a man and a woman until the 令和 era's more open families; the family arranges what it knows.
function omiaiGender(g) {
  const era = eraOf(g), R = rom(g), pg = profileOf(g.state);
  if (era === 'reiwa') return undefined;
  if (pg.gender === 'm') return 'f';
  if (pg.gender === 'f') return 'm';
  return R.pref === 'm' ? 'm' : R.pref === 'f' ? 'f' : undefined;
}
export async function omiaiFlow(g, o = {}) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const bw = blockReason(g);
  if (bw) { await g.say(`（${bw}）`); return null; }
  if (st.stamina < 8) { await g.say('（体力が足りない…。きちんとした場だから、元気なときに）'); return null; }
  const r = makeCandidate(g, { temp: true, via: 'omiai', g: omiaiGender(g), ageMin: ageOf(st) - 2, ageMax: ageOf(st) + 5 });
  st.stamina -= 8;
  const look = recLook(r, era);
  const who = { name: r.n, look };
  const nakodoLook = { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#8a3a5a', bottom: '#5a4a6a', skirt: true };
  const nakodo = { name: '仲人さん', look: nakodoLook };
  let saved = null;
  const place = eraWord(era, { showa: 'ホテルの日本料理店の個室', heisei_early: 'ホテルのラウンジ', d: '料亭の座敷' });
  await playScene(g, { art: 'omiai', title: 'お見合い', you: look, phase: 'day', bgm: 'rom_date', extra: { nakodo: nakodoLook } }, async (sc) => {
    await sc.intro('お見合い');
    await g.say([`（${place}。まっすぐ背筋をのばして、席についた）`, '（こういう場は、やっぱり緊張する…）']);
    await sayAs(g, nakodo, ['今日は、よくいらっしゃいました。\nこちら、釣書にありました通り、まじめで気立てのいい方ですよ。', 'こちらも、{name}さんの評判は、よく聞いております。']);
    await sayAs(g, who, introLines(g, r));
    await g.say(g.fmt(REACT[r.per] || REACT.yasashii), who);
    await sayAs(g, nakodo, ['…では、あとは若いお二人で。\nお庭でも、ご案内しましょうか。']);
    sc.setArt('park', { title: 'お庭を散歩', phase: 'day' });
    await g.say('（仲人さんが席をはずし、ふたりで庭を歩くことになった）');
    const bonus = await topicRound(g, r, who, sc);
    await sayAs(g, who, '「…不思議ですね。初めてお会いしたのに、あまり緊張しません」');
    const i = await g.ask('お返事は、どうしよう？', ['交際を前提に、お付き合いしたい', 'ご縁がなかったことに…'], { cancel: 1 });
    if (i === 0) {
      await sayAs(g, nakodo, ['まあ、それはよかった！\nでは、あとは連絡先を…。']);
      saved = exchange(g, r, 28 + bonus * 2, 'omiai', sc);
      sc.burst(5);
    } else {
      await sayAs(g, nakodo, ['そうですか…。\nこういうのは、ご縁ですものね。また、いいお話があれば。']);
    }
  });
  return saved;
}

// ---------------------------------------------------------------- パーティー (お見合いパーティー / 婚活パーティー / 街コン)
// A hall, name tags, short talks with three people, then the card.
export async function partyFlow(g, kind = 'party') {
  const st = g.state, R = rom(g), era = eraOf(g);
  const bw = blockReason(g);
  if (bw) { await g.say(`（${bw}）`); return null; }
  const M = D.MEET[kind];
  if (!M || !M.eras.includes(era)) { await g.say('（この時代には、まだない）'); return null; }
  if (st.money < M.price || st.stamina < 8) { await g.say('（お金か体力が足りない…）'); return null; }
  if (!g.spend(M.price)) return null;
  st.stamina -= 8;
  const crowd = [];
  for (let i = 0; i < 5; i++) crowd.push(makeCandidate(g, { temp: true, via: kind, ageMin: ageOf(st) - 3, ageMax: ageOf(st) + 7 }));
  const phase = kind === 'machikon' ? 'dusk' : 'day';
  let saved = null;
  const banner = kind === 'party' ? 'お見合いパーティー' : kind === 'konkatsu' ? '婚活パーティー' : '街コン';
  const talked = [];
  await playScene(g, { art: 'party', title: M.name, phase, bgm: 'rom_date', extra: { crowd: crowd.map((r) => recLook(r, era)), banner } }, async (sc) => {
    await sc.intro(M.name);
    await g.say([eraWord(era, { showa: '（会場には、番号札と、プロフィールカードが用意されていた）', heisei_early: '（受付で、名前の札とプロフィールカードを受け取った）', heisei: '（受付で、名前の札と、自己紹介のシートをもらった）', reiwa: '（受付で、名札とプロフィールカードを受け取った。人数は、思ったよりも多い）' }), '（時間ごとに席がかわって、少しずつおしゃべりしていくしくみだ）']);
    for (let round = 0; round < 3; round++) {
      const r = crowd[round];
      const who = { name: `${r.fam} ${r.giv}`, look: recLook(r, era) };
      await g.say(`（第${round + 1}ラウンド。席にすわったのは、${recAge(g, r)}歳の${jobOf(g, r)}、${r.fam}さんだ）`);
      await sayAs(g, who, introLines(g, r).slice(0, 2).concat(['「よろしくお願いします」']));
      await g.say(g.fmt(REACT[r.per] || REACT.yasashii), who);
      r.a0 = 12 + (await topicRound(g, r, who, sc)) * 2;
      talked.push(r);
    }
    await g.say('（さいごに、気になった人の番号を、カードに書く時間だ）');
    const k = await g.ask('だれの番号を書く？', [...talked.map((r) => `${r.fam}さん（${jobOf(g, r)}）`), '書かない'], { cancel: talked.length });
    if (k < talked.length) {
      const r = talked[k];
      // they pick you too when the air was good (a hit topic = a high a0), or by chance
      const hit = (r.a0 || 12) >= 17 || D.rngNext(R) < 0.3;
      if (hit) {
        await g.say('（集計の結果…カップル成立！）');
        saved = exchange(g, r, (r.a0 || 14) + 2, kind, sc);
        sc.burst(8);
      } else await g.say('（集計の結果…残念ながら、今回は成立しなかった。\nそういうこともある）');
    }
  });
  return saved;
}

// ---------------------------------------------------------------- マッチングアプリ (令和): three profiles a day
const PROFILE_LINES = {
  yasashii: ['おだやかな人と、ゆっくり仲良くなりたいです', 'お話を聞くのが好きです'],
  akarui: ['よく笑う人と出会いたい！', '友だちからよく「元気だね」と言われます'],
  majime: ['まじめに結婚を考えています', '誠実さを大切にしています'],
  mypace: ['のんびりした休日が好きです', 'ゆるっと仲良くなれたら'],
  shikkari: ['お互いを支えあえる関係に憧れます', '家事は得意なほうです'],
  cool: ['口数は少ないほうですが、話は聞きます', '静かな時間が好きです'],
  genki: ['週末はアクティブに動いています', 'ノリのいい人だとうれしいです'],
  ganbariya: ['夢に向かってがんばっている人を応援したい', '仕事に前向きな人と話したい'],
};
// today's three (a stranger is seeded by the day: the same list all day)
export function appProfiles(g) {
  const st = g.state, R = rom(g);
  const key = `app${st.day}`;
  if (R.last.appKey === key && Array.isArray(R.last.appList)) return R.last.appList;
  const list = [];
  for (let i = 0; i < 3; i++) {
    const r = makeCandidate(g, { temp: true, via: 'app' });
    list.push({ ...r, line: PROFILE_LINES[r.per] ? D.rngPick(R, PROFILE_LINES[r.per]) : '', hobby: HOBBY[r.tags[0]] });
  }
  R.last.appKey = key;
  R.last.appList = list;
  return list;
}
export async function appLike(g, prof) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const c = D.compat(profileOf(st).personality, prof, R.taste);
  // likes are answered by compatibility (the player cannot see it; they see a hobby)
  const match = c.v >= 2 || D.rngNext(R) < 0.3;
  if (!match) { await g.say(`（${prof.giv}さんに「いいね」を送った。…返事は、まだ来ない）`); prof.liked = true; return null; }
  const look = recLook(prof, era);
  const who = { name: prof.n, look };
  await g.say(`（マッチングしました！${prof.giv}さんからメッセージが届いた）`);
  await sayAs(g, who, [`「はじめまして。${prof.giv}です。プロフィール見て、お話ししてみたいなと思いました」`, `「${careerWord(g)}って、すごいですね。ぜひ、会ってお話ししませんか？」`]);
  const i = await g.ask(`${prof.giv}さんと、会ってみる？（カフェ・${fmtMoney(D.MEET.app.price + 1400)}ほど）`, ['会ってみる', 'メッセージだけにする'], { cancel: 1 });
  if (i !== 0) return null;
  if (!g.spend(1400)) { await g.say('（お金が足りない…）'); return null; }
  if (st.stamina < 4) { await g.say('（体力が足りない…）'); return null; }
  st.stamina -= 4;
  let saved = null;
  await playScene(g, { art: 'cafe', title: 'カフェ', you: look, bgm: 'rom_date' }, async (sc) => {
    await sc.intro('はじめて会う日');
    await g.say('（待ち合わせは、駅前のカフェ。プロフィールの写真と同じ人が、手をふった）');
    await sayAs(g, who, introLines(g, prof));
    await g.say(g.fmt(REACT[prof.per] || REACT.yasashii), who);
    const bonus = await topicRound(g, prof, who, sc);
    await sayAs(g, who, '「今日は楽しかったです。また、会ってもらえますか？」');
    saved = exchange(g, prof, 16 + bonus * 2, 'app', sc);
    sc.burst(4);
  });
  return saved;
}

// ---------------------------------------------------------------- 職場・共演者 / 相方の友人 (offered by messages, answered in the app)
export async function shokubaFlow(g, o = {}) {
  const st = g.state, era = eraOf(g);
  const r = makeCandidate(g, { temp: true, via: 'shokuba' });
  const look = recLook(r, era);
  const who = { name: r.n, look };
  let saved = null;
  await playScene(g, { art: 'cafe', title: eraWord(era, { showa: '喫茶店', d: 'カフェ' }), you: look, bgm: 'rom_date' }, async (sc) => {
    await sc.intro('お仕事のあとで');
    await g.say(`（現場で顔を合わせるうちに、${jobOf(g, r)}の${r.fam}さんと、お茶をすることになった）`);
    await sayAs(g, who, introLines(g, r));
    await sayAs(g, who, '「お仕事の話、いろいろ聞かせてください」');
    const bonus = await topicRound(g, r, who, sc);
    await sayAs(g, who, '「…よかったら、連絡先、教えてもらえませんか？」');
    saved = exchange(g, r, 18 + bonus * 2, 'shokuba', sc);
  });
  return saved;
}
export async function aibouFlow(g, o = {}) {
  const st = g.state, era = eraOf(g);
  const pid = st.partner && PEOPLE[st.partner] ? st.partner : null;
  const P = pid ? PEOPLE[pid] : null;
  const r = makeCandidate(g, { temp: true, via: 'aibou' });
  const look = recLook(r, era);
  const who = { name: r.n, look };
  let saved = null;
  await playScene(g, { art: 'gohan', title: 'ごはん', you: look, bgm: 'rom_date' }, async (sc) => {
    await sc.intro('相方の友だち');
    if (P) await sayAs(g, P, P.dialect === 'kansai' ? [`紹介するわ。${nameTag(r)}さん、昔からの友だちや。`, '{name}と話が合いそうやと思てな。'] : [`紹介するね。${nameTag(r)}さん、昔からの友だちなんだ。`, '{name}と話が合いそうだと思って。']);
    await sayAs(g, who, introLines(g, r));
    const bonus = await topicRound(g, r, who, sc);
    saved = exchange(g, r, 20 + bonus * 2, 'aibou', sc);
  });
  return saved;
}

// ---------------------------------------------------------------- the offers (messages from friends and family)
const OFFER_LINES = {
  goukon: (P, k) => (k ? '今度の合コン、人数がたりなくて困ってるねん。\n{name}、来てくれへん？' : '今度の合コン、人数がたりなくて困ってるんだ。\n{name}、来てくれない？'),
  shokai: (P, k) => (k ? '会わせたい人がおるねん。ええ人やで。\n今度、ごはんでもどう？' : '会わせたい人がいるんだ。いい人だよ。\n今度、お茶でもどう？'),
  aibou: (P, k) => (k ? '友だちに、ええ人がおるんや。\n紹介しよか？' : '友だちに、いい人がいるんだ。\n紹介しようか？'),
};
const OMIAI_LINES = {
  showa: 'ご近所の{who}さんが、いいお話を持ってきてくださったの。\n{name}、一度、お見合いしてみない？\n（無理にとは言わないけれど…）',
  heisei_early: '知り合いから、いいお話があるのよ。\n{name}、お見合いしてみない？\n（気がのらなければ、断ってもいいから）',
  heisei: '親戚の人から、お見合いのお話があったの。\n{name}、どうかしら？\n（無理にとは言わないわ）',
  reiwa: '親戚のおばさんが、お見合いの話を持ってきたの。\n{name}、どうかしら？\n（もちろん、断ってもいいのよ）',
};
const OFFER_NOTE = { goukon: '合コンのお誘い', shokai: '紹介したい人がいる', omiai: 'お見合いのお話', aibou: '相方が友だちを紹介したいと', shokuba: '現場で声をかけられた' };
export function inviteOf(g, id) { return rom(g).inv.find((x) => x.id === id) || null; }
onRomTick((g, R, ctx) => {
  if (!active(g)) return;
  const st = g.state;
  // old invitations expire
  R.inv = R.inv.filter((x) => st.day <= x.until);
  const lead = leadRec(g);
  if (lead && isCouple(lead)) return;
  if (R.inv.length >= 2) return;
  if (st.day - (R.last.enc || 0) < 24) return;
  if (R.last.msg === st.day || (st.phone.inbox || []).filter((m) => m && m.day === st.day).length >= 3) return;
  if (D.rngNext(R) > 0.16) return;
  const era = eraOf(g);
  const pa = ageOf(st);
  const friends = g.friends(2).filter((id) => PEOPLE[id] && !PEOPLE[id].rom && !PEOPLE[id].family && PEOPLE[id].kind !== 'family');
  const fams = Object.keys(PEOPLE).filter((id) => PEOPLE[id] && PEOPLE[id].kind === 'family' && st.people && st.people[id] && /^fam_(mother|father|grand)/.test(id));
  const opts = [];
  if (friends.length) { opts.push(['goukon', 4], ['shokai', 3]); }
  if (fams.length && pa >= (era === 'showa' ? 22 : 24) && !(era !== 'reiwa' && R.pref !== 'any' && R.pref === profileOf(st).gender)) opts.push(['omiai', { showa: 3, heisei_early: 2, heisei: 1, reiwa: 1 }[era]]);
  if (st.partner && PEOPLE[st.partner]) opts.push(['aibou', 2]);
  if (st.fame >= 30) opts.push(['shokuba', 2]);
  if (!opts.length) return;
  const total = opts.reduce((a, o) => a + o[1], 0);
  let roll = D.rngNext(R) * total, kind = opts[0][0];
  for (const [k, w] of opts) { if ((roll -= w) < 0) { kind = k; break; } }
  let from = null, text = '', rec = null;
  if (kind === 'omiai') {
    from = D.rngPick(R, fams);
    text = OMIAI_LINES[era].replace('{who}', D.rngPick(R, ['田中', '佐々木', '中山', '山下']));
    rec = { id: from };
  } else if (kind === 'goukon' || kind === 'shokai') {
    from = D.rngPick(R, friends);
    const kan = PEOPLE[from].dialect === 'kansai' || /なんば|大阪/.test(PEOPLE[from].where || '');
    text = OFFER_LINES[kind](PEOPLE[from], kan);
  } else if (kind === 'aibou') {
    from = st.partner;
    const kan = PEOPLE[from].dialect === 'kansai';
    text = OFFER_LINES.aibou(PEOPLE[from], kan);
  } else if (kind === 'shokuba') {
    // no message: the invitation just appears in the app (a co-worker wants to talk)
    R.last.enc = st.day;
    R.inv.push({ id: `i${st.day}${R.inv.length}`, k: kind, from: null, day: st.day, until: st.day + 6 });
    ctx.notes.push(`（現場で、話しかけてくれた人がいた。「恋のはなし」を見てみよう）`);
    return;
  }
  R.last.enc = st.day;
  const inv = { id: `i${st.day}${R.inv.length}`, k: kind, from, day: st.day, until: st.day + 6 };
  R.inv.push(inv);
  const dev = { showa: '手帳', heisei_early: '手帳', heisei: 'ケータイ', reiwa: 'スマホ' }[era];
  const app = era === 'reiwa' || era === 'heisei' ? '恋のはなし' : 'ひとことメモ';
  const body = `${text}\n（${dev}の「${app}」から、お返事してね）`;
  // the message comes from the person (not through romMessage's dialect fill: the line is already finished)
  const P = PEOPLE[from];
  g.message({ from: P.name, person: from, kind: 'chat', rom: 1, text: flat(g.fmt(body)) });
  R.last.msg = st.day;
});

// answers (from the app)
export async function answerInvite(g, inv, yes) {
  const R = rom(g);
  const i = R.inv.indexOf(inv);
  if (i >= 0) R.inv.splice(i, 1);
  if (!yes) return null;
  const friend = inv.from;
  if (inv.k === 'goukon') return goukonFlow(g, { friend });
  if (inv.k === 'shokai') return shokaiFlow(g, { friend });
  if (inv.k === 'omiai') return omiaiFlow(g, { from: friend });
  if (inv.k === 'aibou') return aibouFlow(g, {});
  if (inv.k === 'shokuba') return shokubaFlow(g, {});
  return null;
}

// ---------------------------------------------------------------- the ways you can look for someone yourself (the 出会い tab)
export function meetOptions(g) {
  const st = g.state, era = eraOf(g);
  const out = [];
  const friends = g.friends(2).filter((id) => PEOPLE[id] && !PEOPLE[id].rom && !PEOPLE[id].family);
  let year = D.ERA_YEAR[era];
  try { const d = g.gameDate(); if (d && d.year) year = d.year; } catch (e) { /* the era's first year */ }
  for (const kind of ['party', 'konkatsu', 'machikon', 'app']) {
    const M = D.MEET[kind];
    if (!M.eras.includes(era)) continue;
    if (kind === 'party' && era === 'heisei' && year >= 2008) continue; // 「婚活」 (2008〜) replaces it
    if (kind === 'konkatsu' && era === 'heisei' && year < 2008) continue;
    out.push({ kind, name: M.name, price: M.price, desc: M.desc, why: kind !== 'app' && st.money < M.price ? 'お金が足りない…' : null });
  }
  const M = D.MEET.goukon;
  out.unshift({ kind: 'goukon', name: '友だちに合コンをたのむ', price: M.price, desc: M.desc, why: !friends.length ? 'たのめる友だちが、まだいない' : st.money < M.price ? 'お金が足りない…' : null });
  const fam = Object.keys(PEOPLE).filter((id) => PEOPLE[id] && PEOPLE[id].kind === 'family' && st.people && st.people[id] && /^fam_(mother|father|grand)/.test(id));
  const R0 = rom(g);
  const sameP = R0.pref !== 'any' && R0.pref === pgOf0(g);
  if (fam.length) out.push({ kind: 'omiai', name: '家族にお見合いをたのむ', price: 0, desc: eraWord(era, { showa: '昭和には、親が縁談を持ってくる家も多かった。', d: '親や親戚に、お見合いの話をお願いする。' }), why: ageOf(st) < 22 ? '少し、早いかも…' : (sameP && era !== 'reiwa') ? 'この時代の縁談は、まだそういう話にならない…' : null });
  return out;
}
export async function runMeet(g, kind, o = {}) {
  if (kind === 'goukon') { const friends = g.friends(2).filter((id) => PEOPLE[id] && !PEOPLE[id].rom && !PEOPLE[id].family); return goukonFlow(g, { friend: friends.length ? D.rngPick(rom(g), friends) : null }); }
  if (kind === 'party' || kind === 'konkatsu' || kind === 'machikon') return partyFlow(g, kind);
  if (kind === 'omiai') return omiaiFlow(g, {});
  if (kind === 'app') return null;
  return null;
}
