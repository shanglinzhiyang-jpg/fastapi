// 恋愛・結婚・家庭 (R12-L1) — 同棲 → プロポーズ → 親への挨拶 → 婚姻届 → 結婚式 → 新居 → 家計 → 離婚.
// Era-accurate and plain: the facts are in romance_data.js FACTS (婚姻年齢・夫婦同氏・同性カップルの制度・離婚の手続き). A couple of the same sex
// are shown what the law of the era allows (パートナーシップ制度 in 令和) without comment; every parent may say no at first and may be persuaded.
import { PEOPLE } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { ageOf, profileOf, regionOf, YEAR_DAYS, prefecture } from './profile.js';
import * as D from './romance_data.js';
import {
  rom, active, recOf, leadRec, spouseRec, setStage, isCouple, airOf, compatOf, partnerWord, shortName, recLook, pgOf, eraOf, recAge, jobOf, addHist, addAlbum,
  blockReason, romMessage, queueEvent, onRomEvent, onRomTick, announce, affOf, sameSex, dayOfYear, flat,
} from './romance.js';
import { playScene, sayAs, askAs } from './romance_scene.js';
import { eraWord } from './romance_date.js';
import * as HS from '../world/housing.js';

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const sl = (rec, s, x) => D.sayLine(s, rec, x);
const kidWord = (rec) => (rec.g === 'f' ? '娘' : '息子');
const whoOf = (g, rec) => ({ name: (PEOPLE[rec.id] && PEOPLE[rec.id].name) || rec.n, look: recLook(rec, eraOf(g)) });

// ---------------------------------------------------------------- parents (looks and voices)
export function theirParent(g, rec, which = 'mother') {
  const base = recLook(rec, eraOf(g));
  const skin = base.skin || 'fair';
  if (which === 'father') return { name: `${rec.giv}のお父さん`, look: { hair: 'short', hairColor: 'black', skin, top: '#5a6a7a', bottom: '#3b3f48', jacket: true, tie: '#7a3a3a', glasses: (rec.ls % 3) === 0 } };
  return { name: `${rec.giv}のお母さん`, look: { hair: 'bob', hairColor: 'brown', skin, top: '#c89ab0', bottom: '#5a4a6a', skirt: true } };
}
// the player's family who is alive: [{ name, look, rel, dia }]
export function myParents(g) {
  const pf = profileOf(g.state);
  const dia = regionOf(pf.hometown).dialect || 'standard';
  const fam = (pf.family || []).filter((m) => m && m.alive !== false);
  const pick = (rel) => fam.find((m) => m.rel === rel);
  const who = pick('mother') || pick('father') || pick('grandmother') || pick('grandfather');
  return { dia, list: fam.filter((m) => ['mother', 'father'].includes(m.rel)), any: who };
}
const lookOfRel = (rel, g) => {
  const L = { mother: { hair: 'bob', hairColor: 'brown', skin: 'fair', top: '#e08a9a', bottom: '#5a4a6a', skirt: true }, father: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#5a6a8a', bottom: '#3a3a4a', jacket: true, tie: '#c0452f' }, grandmother: { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#9273bd', bottom: '#5a4a6a', skirt: true }, grandfather: { hair: 'bald', hairColor: 'white', skin: 'fair', top: '#8a6a4a', bottom: '#5a4a3a', glasses: true } };
  return L[rel] || L.mother;
};

// ---------------------------------------------------------------- 同棲
export function canCohab(g, rec) {
  if (rec.st !== 'dating') return rec.st === 'cohab' ? 'もう、いっしょに暮らしている' : '';
  if (g.state.day - rec.since < 30) return '付き合って、もう少したってから…（3か月くらい）';
  if (g.aff(rec.id) < 70) return 'もう少し、ふたりの距離が近づいてから';
  if (rec.mo < 50) return 'ふたりの空気が、いまひとつ…';
  return null;
}
export async function cohabFlow(g, rec) {
  const st = g.state, era = eraOf(g);
  const why = canCohab(g, rec);
  if (why !== null) { if (why) await g.say(`（${why}）`); return false; }
  const who = whoOf(g, rec);
  const k = await g.ask([`${shortName(rec)}に、いっしょに暮らそうと話してみる？`, '（家賃や生活費をわけあえるし、いつも会える。\nでも、いいことばかりでは、ないかもしれない）'], ['話してみる', 'まだやめておく'], { cancel: 1 });
  if (k !== 0) return false;
  let ok = false;
  await playScene(g, { art: 'home', title: 'ふたりの時間', you: who.look, bgm: 'rom_date', phase: 'night' }, async (sc) => {
    await g.say('（ソファに並んで、お茶を飲みながら、切り出した）');
    await g.say('「…いっしょに、暮らさない？」');
    const air = rec.mo + g.aff(rec.id) * 0.5;
    if (air >= 85 || (air >= 70 && D.rngNext(rom(g)) < 0.7)) {
      ok = true; sc.burst(7);
      await sayAs(g, who, sl(rec, ['…うん。{I}も、同じこと考えてた{yo}。', '朝おきて、{name}がいるの、いいな。']));
    } else {
      await sayAs(g, who, sl(rec, ['…うれしい。でも、ちょっとだけ、時間をちょうだい。\n気持ちの準備が、まだなんだ{ne}。']));
      rec.mo = clamp(rec.mo - 2, 0, 100);
    }
  });
  if (!ok) return false;
  setStage(g, rec, 'cohab');
  addHist(g, `${shortName(rec)}と、いっしょに暮らしはじめた`);
  addAlbum(g, 'cohab', `${shortName(rec)}と、ふたり暮らし`);
  await g.say([`${shortName(rec)}と、いっしょに暮らすことになった。`, `（${eraWord(era, { showa: '電話は、家の電話を、ふたりで使うことになる', d: '家賃と生活費は、ふたりで分けあう' })}。\nいまの部屋が狭いなら、引っ越しもできる）`]);
  const j = await g.ask('部屋を、新しくさがす？', ['不動産で部屋を見る', 'いまの部屋で暮らす'], { cancel: 1 });
  if (j === 0) await newHomeFlow(g, rec);
  return true;
}
export async function newHomeFlow(g, rec) {
  const ids = (HS.HOME_ORDER || []).filter((id) => HS.HOUSING && HS.HOUSING[id]);
  if (!ids.length) return false;
  const items = ids.map((id) => {
    const h = HS.HOUSING[id];
    const lv = g.state.housing === id;
    return { label: `${h.name}${lv ? '（いまの部屋）' : ''}`, right: `${fmtMoney(h.rent)}／週` };
  });
  const i = await g.list({ title: 'ふたりの部屋をさがす', items: [...items, { label: 'やめておく' }], x: 24, y: 52, w: 420, px: true, cancel: ids.length, describe: (k) => (ids[k] ? `${HS.HOUSING[ids[k]].plan || ''}\n${(HS.HOUSING[ids[k]].perks || []).slice(0, 2).join('・')}` : '') });
  if (i < 0 || i >= ids.length) return false;
  const ok = await HS.moveTo(g, ids[i]);
  if (ok) addHist(g, `ふたりの部屋に引っ越した（${HS.HOUSING[ids[i]].name}）`);
  return ok;
}

// ---------------------------------------------------------------- プロポーズ
export function canPropose(g, rec) {
  if (rec.st !== 'dating' && rec.st !== 'cohab') return rec.st === 'engaged' ? 'もう、婚約している' : rec.st === 'married' ? '' : '';
  if (ageOf(g.state) < 18 || recAge(g, rec) < 18) return '';
  if (g.state.day - rec.since < (rec.st === 'cohab' ? 20 : 50)) return 'もう少し、ふたりの時間を重ねてから…';
  if (g.aff(rec.id) < 85) return 'もう少し、ふたりの距離が近づいてから';
  if (rec.mo < 60) return 'ふたりの空気が、いまひとつ…';
  if (rec.propDay && g.state.day - rec.propDay < 15) return 'この前のお返事から、まだ日が浅い';
  return null;
}
const RING = [
  { id: 'none', label: '指輪なし（手紙を書く）', price: 0 },
  { id: 'small', label: 'ささやかな指輪', price: 60000 },
  { id: 'big', label: 'ちょっと奮発した指輪', price: 200000 },
];
export async function proposeFlow(g, rec) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const why = canPropose(g, rec);
  if (why !== null) { if (why) await g.say(`（${why}）`); return false; }
  const bw = blockReason(g);
  if (bw) { await g.say(`（${bw}）`); return false; }
  const k = await g.ask([`${shortName(rec)}に、プロポーズする？`, '（結婚は、ふたりの人生が、ひとつになること。\nゆっくり、考えてからでもいい）'], ['プロポーズする', 'まだ早い'], { cancel: 1 });
  if (k !== 0) return false;
  const ring = await g.list({
    title: '指輪は？', items: RING.map((r) => ({ label: r.label, right: r.price ? fmtMoney(r.price) : '無料', disabled: st.money < r.price })), x: 24, y: 52, w: 420, px: true, cancel: -1,
    describe: () => eraWord(era, { showa: '昭和には「給料の3か月分」という宣伝文句があった。', d: '値段より、気持ちがだいじ。' }),
  });
  if (ring < 0) return false;
  const R0 = RING[ring];
  if (R0.price && !g.spend(R0.price)) { await g.say('（お金が足りない…）'); return false; }
  const place = await g.ask('どこで伝える？', ['夜景のきれいな場所', 'ふたりの思い出の公園', 'おうちで、手料理で'], { cancel: 1 });
  const who = whoOf(g, rec);
  let accepted = false;
  const art = place === 0 ? 'yakei' : place === 1 ? 'park' : 'home';
  await playScene(g, { art, title: place === 0 ? '夜景の展望台' : place === 1 ? 'ふたりの公園' : 'ふたりの部屋', you: who.look, bgm: 'rom_night', phase: place === 2 ? 'night' : place === 1 ? 'dusk' : 'night', hearts: true }, async (sc) => {
    await g.say(['（ポケットの中で、手が汗ばんでいる）', '（ゆっくり息をすって、口をひらいた）']);
    await g.say(['「ずっと、考えていたんだ」', '「…結婚してください」']);
    await g.wait(700);
    const roll = D.rngNext(R);
    const bonus = (place === 0 ? 0.04 : 0.02) + (R0.id === 'big' ? 0.03 : R0.id === 'small' ? 0.02 : 0.01);
    accepted = rec.mo >= 70 || roll < 0.6 + bonus;
    if (accepted) {
      sc.burst(10); sc.flash = 16; g.sfx('fanfare');
      await sayAs(g, who, sl(rec, ['…はい。\n{I}でよければ、よろこんで。', '…ありがとう。うれしくて、言葉が出ない{yo}。'], {}));
      if (R0.id !== 'none') await g.say(`（${R0.label}を、そっと左手の薬指にはめた）`);
      else await g.say(`（手紙を読んだ${shortName(rec)}は、目をうるませて、何度もうなずいた）`);
    } else {
      await sayAs(g, who, sl(rec, ['…ごめんね、すごくうれしい。でも、もう少しだけ、時間をちょうだい。\n{name}のこと、大好きな気持ちは、変わらない{yo}。']));
      await g.say('（ふたりで、夜道をゆっくり歩いて帰った）');
    }
  });
  rec.propDay = st.day;
  if (!accepted) { rec.mo = clamp(rec.mo - 4, 0, 100); return false; }
  setStage(g, rec, 'engaged');
  rec.ring = R0.id;
  rec.par = rec.par || { their: null, mine: null, tries: { their: 0, mine: 0 } };
  if (R0.id !== 'none') g.giveItem('rom_ring', 1, true);
  addHist(g, `${shortName(rec)}と、婚約した`);
  addAlbum(g, 'engaged', `${shortName(rec)}と、婚約`);
  await g.say([`${shortName(rec)}と、婚約した！`, '（つぎは、ご両親へのあいさつ。「恋のはなし」→婚約中 から、すすめよう）']);
  return true;
}

// ---------------------------------------------------------------- 親への挨拶 (and the cases where they say no, and being persuaded)
const THEIR_LINES = {
  warm: ['まあまあ、よく来てくださいました。\n{kid}から、話はよく聞いていますよ。', '{kid}を、どうぞよろしくお願いします。'],
  worry: ['…{name}さんね。お仕事は、芸能の世界だと聞いていますが…。\n正直、生活が心配でね。', '安定した仕事でなければ、結婚させられない、とまでは言いません。\n…ただ、{kid}が苦労するのは、見ていられなくてね。'],
  strict: ['結婚は、まだ早いんじゃないかね。\n{kid}は、まだ、ひとり立ちして間もないんだ。', '…この件は、すぐには返事ができない。'],
};
const THEIR_SAME = {
  old: ['…正直、どう受けとめたらいいのか、わからなくて。\n世間の目も、気になってしまうの。', '…ただ、{kid}が、あなたといるときの顔は、見たことのないくらい、やさしかった。'],
  new: ['…驚いたけれど、{kid}が選んだ人だもの。\nまず、あなたのことを、もっと知りたいわ。', '制度のことは、よくわからないけど…ふたりが幸せなら、それがいちばんだと思う。'],
};
const MINE_LINES = (dia) => ({
  warm: ['{you}が、結婚したいと思える人に出会えたのね。\nほんとうに、よかった{yo}。', 'ふつつかな子だけど、どうかよろしくお願いします{ne}。'],
  worry: ['…{you}の仕事のこと、{me}は応援してるけど。\n結婚して、生活は、だいじょうぶ{no}？', 'いいえ、反対じゃない{yo}。ただ、心配なの。'],
  strict: ['結婚か…。{you}、本気{no}か？\n{me}は、まだ、すぐには賛成できない{yo}。', 'もう少し、ちゃんと話をさせてほしい{nda}。'],
});
function attFor(g, rec, side) {
  const st = g.state;
  let a = side === 'their' ? rec.att : (D.rngNext(rom(g)) < 0.62 ? 'warm' : D.rngNext(rom(g)) < 0.8 ? 'worry' : 'strict');
  // a stable life (fame, money) lets worried parents be easy
  if (a === 'worry' && (st.fame >= 400 || st.money >= 500000)) a = 'warm';
  if (a === 'strict' && st.fame >= 1200) a = 'worry';
  return a;
}
export async function greetFlow(g, rec, side) {
  const st = g.state, R = rom(g), era = eraOf(g);
  if (rec.st !== 'engaged' && rec.st !== 'married') { await g.say('（婚約してから、ご挨拶に行こう）'); return false; }
  rec.par = rec.par || { their: null, mine: null, tries: { their: 0, mine: 0 } };
  const P = rec.par;
  if (P[side] === 'ok') { await g.say('（こちらのご挨拶は、すんでいる）'); return true; }
  const bw = blockReason(g);
  if (bw) { await g.say(`（${bw}）`); return false; }
  if (st.stamina < 6) { await g.say('（体力が足りない…。元気なときに行こう）'); return false; }
  if (side === 'mine') {
    const my = myParents(g);
    if (!my.any) {
      await playScene(g, { art: 'home', title: '実家', you: whoOf(g, rec).look, bgm: 'rom_night', phase: 'dusk' }, async () => {
        await g.say(['（実家の仏壇に、ふたりで手を合わせた）', '（「結婚します」…静かに、そう報告した）', '（やさしい風が、すっと部屋を通りぬけた気がした）']);
      });
      P.mine = 'ok';
      await g.say(`（${shortName(rec)}も、手を合わせてくれた。だれも反対する人はいない）`);
      return true;
    }
  }
  const mine = side === 'mine';
  const att = P[side] && P[side] !== 'ok' ? P[side] : attFor(g, rec, side);
  const worryPersuaded = P.tries[side] >= (att === 'strict' ? 3 : 2);
  const pg = pgOf(g);
  const same = sameSex(g, rec);
  const myP = myParents(g);
  const D1 = DIAS(mine ? myP.dia : rec.dia);
  let ok = false;
  const looks = mine ? { name: `${(myP.any && (myP.any.rel === 'father' ? 'お父さん' : myP.any.rel === 'mother' ? 'お母さん' : myP.any.rel === 'grandmother' ? 'おばあちゃん' : 'おじいちゃん'))}`, look: lookOfRel(myP.any ? myP.any.rel : 'mother', g) } : theirParent(g, rec, 'mother');
  st.stamina -= 6;
  await playScene(g, { art: 'omiai', title: mine ? 'ふるさとの実家' : `${rec.giv}の実家`, you: whoOf(g, rec).look, bgm: 'rom_date', extra: { nakodo: looks.look } }, async (sc) => {
    await g.say(mine ? ['（久しぶりの実家。ふたりで、玄関に立った）', '（心臓が、どきどきしている）'] : [`（${shortName(rec)}の実家。手みやげの包みを持つ手が、かたい）`, `（${shortName(rec)}のご両親が、座敷で待っていた）`]);
    const lines = mine ? MINE_LINES()[att].map((s) => fillMine(s, g, D1)) : THEIR_LINES[att].map((s) => s.replaceAll('{kid}', kidWord(rec)));
    if (att === 'warm' || worryPersuaded) {
      await sayAs(g, looks, (att === 'warm' ? lines : (mine ? MINE_LINES()['warm'].map((s) => fillMine(s, g, D1)) : THEIR_LINES.warm.map((s) => s.replaceAll('{kid}', kidWord(rec))))));
      ok = true; sc.burst(6);
      await g.say('（ほっとして、肩の力がぬけた）');
    } else {
      await sayAs(g, looks, lines);
      if (!mine && same) await sayAs(g, looks, (era === 'reiwa' ? THEIR_SAME.new : THEIR_SAME.old).map((s) => s.replaceAll('{kid}', kidWord(rec))));
    }
  });
  if (ok) { P[side] = 'ok'; g.addAff(rec.id, 2, true); st.life.stress = clamp(st.life.stress - 6, 0, 100); await g.say(mine ? '（実家のみんなに、祝福してもらえた！）' : `（${shortName(rec)}のご両親にも、認めてもらえた！）`); return true; }
  P[side] = att;
  await g.say(`（すぐには、よい返事はもらえなかった。\n時間をかけて、わかってもらおう。「恋のはなし」から、また会いに行ける）`);
  const pers = await g.ask('どうする？', ['日をあらためて、手みやげを持って話に行く', '仕事ぶりや暮らしを、ちゃんと見てもらう', 'ふたりで、話し合う（時間をかける）', 'このままの気持ちで、結婚する'], { cancel: 3 });
  return persuade(g, rec, side, pers);
}
const DIAS = (k) => D.DIA[k] || D.DIA.standard;
function fillMine(s, g, Dm) {
  const pf = profileOf(g.state);
  const given = pf.givenName || 'ドット';
  return s.replace(/\{(\w+)\}/g, (m, k) => ({ you: given, me: 'お母さん', yo: Dm.yo, ne: Dm.ne, no: Dm.no, nda: Dm.nda, da: Dm.da }[k] ?? m));
}
// 説得: three ways (each makes them warmer), or going ahead without their blessing (the family comes round when a baby is born)
export async function persuade(g, rec, side, how) {
  const st = g.state;
  rec.par = rec.par || { their: null, mine: null, tries: { their: 0, mine: 0 } };
  const P = rec.par;
  if (how === 3) {
    P[side] = 'ok';
    P.noBless = (P.noBless || []).concat(side);
    await g.say(['（どちらからも、反対されたままだけれど…\nふたりで、決めたことだ）', '（いつかわかってもらえる日が来ると、信じよう）']);
    return true;
  }
  if (st.stamina < 6) { await g.say('（体力が足りない…）'); return false; }
  st.stamina -= 6;
  let gain = 1;
  if (how === 0) {
    if (g.spend(3000)) { await g.say('（老舗のお菓子を手みやげに、もういちど足を運んだ）'); gain = 1; } else { await g.say('（手みやげを買うお金が足りない…）'); return false; }
  } else if (how === 1) {
    if (st.fame >= 300 || st.money >= 300000) { await g.say('（お仕事の活躍や、暮らしぶりを、ていねいに話した。\n「ちゃんとやっている」と、わかってもらえた）'); gain = 2; }
    else { await g.say('（まだ、見せられるほどの実績がない…。\nそれでも、ひたむきさは伝わったようだ）'); gain = 1; }
  } else {
    await g.say('（何度も、ふたりで、ゆっくり話し合った。\n時間はかかったけれど、少しずつ、気持ちがほぐれていく）');
    gain = 1;
  }
  P.tries[side] += gain;
  const need = P[side] === 'strict' ? 3 : 2;
  if (P.tries[side] >= need) {
    P[side] = 'ok';
    g.sfx('chime');
    await g.say(side === 'mine' ? '（「…{name}が決めたことなら。しっかりやりなさい」\nやっと、実家の了解がもらえた！）' : '（「…わかりました。{kid}を、よろしく」\nやっと、ご両親にも認めてもらえた！）'.replace('{kid}', kidWord(rec)));
    g.addAff(rec.id, 2, true);
    return true;
  }
  await g.say('（あと少し、というところまで来た。\nもう一度、お願いに行こう）');
  return false;
}

// ---------------------------------------------------------------- 婚姻届 (入籍) and the household's name
export async function nyusekiFlow(g, rec) {
  const st = g.state, R = rom(g), era = eraOf(g);
  if (rec.st !== 'engaged') { await g.say('（婚約してから、手続きにいこう）'); return false; }
  const P = rec.par || {};
  const bw = blockReason(g);
  if (bw) { await g.say(`（${bw}）`); return false; }
  const same = sameSex(g, rec);
  let year = D.ERA_YEAR[era];
  try { const d = g.gameDate(); if (d && d.year) year = d.year; } catch (e) { /* the era's first year */ }
  if (!P.their && !P.mine) {
    const i = await g.ask('ご両親への挨拶が、まだだけど、先に届けを出す？', ['先に挨拶に行く', '先に届けを出す'], { cancel: 0 });
    if (i === 0) return false;
  }
  await g.say(['（区役所の窓口で、婚姻届を出すことにした）', D.FACTS.marryAge(year)]);
  let legal = !same || false;
  let hn = pgOf(g).familyName, maiden = '';
  const who = whoOf(g, rec);
  if (same) {
    if (era === 'reiwa') {
      await g.say(['（同性どうしは、婚姻届を出せない。\nかわりに、自治体のパートナーシップ制度に、ふたりで申請できる）', D.FACTS.samesex(era)]);
      const i = await g.ask('申請する？', ['パートナーシップの宣誓をする', 'もう少し考える'], { cancel: 1 });
      if (i !== 0) return false;
      legal = 'partnership';
    } else {
      await g.say(['（同性どうしの婚姻届は、出せない。\n窓口では、受け取ってもらえなかった）', D.FACTS.samesex(era)]);
      const i = await g.ask('それでも、ふたりで夫婦のように暮らしていく？', ['暮らしていく', 'もう少し考える'], { cancel: 1 });
      if (i !== 0) return false;
      legal = false;
    }
  } else {
    await g.say(D.FACTS.surname);
    const i = await g.ask('名字は、どうする？', [`${pgOf(g).familyName}（自分の名字）`, `${rec.fam || shortName(rec)}（相手の名字）`, 'ふたりで、相談して決める'], { cancel: 0 });
    if (i === 1 && !rec.cast) { hn = rec.fam; maiden = pgOf(g).familyName; }
    else if (i === 1 && rec.cast) { hn = pgOf(g).familyName; }
    else if (i === 2) { const j = D.rngNext(R) < 0.5; if (j && !rec.cast) { hn = rec.fam; maiden = pgOf(g).familyName; } }
  }
  await playScene(g, { art: 'yakusho', title: '区役所の窓口', you: who.look, bgm: 'rom_date', extra: { clerk: undefined } }, async (sc) => {
    await g.say(same && legal === false ? '（証人欄の代わりに、ふたりで、手を重ねた）' : '（証人になってくれた友だちに、署名とハンコをもらった。婚姻届は、ふたりの字でうまっている）');
    await sayAs(g, { name: '窓口の職員', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#3f5fa8', bottom: '#2a3560', skirt: true, jacket: true } }, same && legal !== 'partnership' ? ['申し訳ありません。こちらは、お受けできないんです…。'] : same ? ['パートナーシップ宣誓ですね。お二人のご関係を、証明書でお渡しします。'] : ['はい、確かにお預かりしました。\nご結婚、おめでとうございます。']);
    if (legal) { sc.burst(8); g.sfx('fanfare'); }
  });
  setStage(g, rec, 'married');
  rec.wedDay = st.day;
  rec.legal = legal;
  const H = R.home;
  H.hn = hn;
  H.maiden = maiden;
  H.work = H.work || (rec.val.w === 0 ? 'home' : rec.val.w === 1 ? 'dual' : 'dual');
  if (rec.cast) H.work = H.work || 'dual';
  H.since = st.day;
  addHist(g, same ? `${shortName(rec)}と、ふたりの家族になった` : `${shortName(rec)}と、結婚した（入籍）`);
  addAlbum(g, 'nyuseki', same ? 'ふたりの家族に' : '入籍', { legal: !!legal });
  const word = partnerWord(g, rec);
  await g.say([`${shortName(rec)}と、${same && !legal ? 'ふたりの家族になった' : same ? 'パートナーになった' : '夫婦になった'}！`, hn && maiden ? `（わが家の名字は「${hn}」。仕事では、これまで通り「${maiden}」を通称として使える）` : (hn ? `（わが家の名字は「${hn}」）` : '')].filter(Boolean));
  try { announce(g, 'marry', `{fullname}、${rec.cast ? shortName(rec) : jobOf(g, rec) + 'の' + rec.giv + 'さん'}と${same ? 'パートナーシップを結ぶ' : '結婚'}。「温かい家庭を築きたい」`, { label: '結婚' }); } catch (e) { console.error(e); }
  // 相方と友だちは、よろこぶ
  try { if (st.partner && PEOPLE[st.partner]) g.addAff(st.partner, 3, true); } catch (e) { /* none */ }
  return true;
}

// ---------------------------------------------------------------- 結婚式・披露宴
const SHIKI = [
  { id: 'photo', label: (era) => (era === 'reiwa' ? 'フォトウェディング（写真だけ）' : '写真だけの記念撮影'), price: 60000, guests: 0, back: 0, art: 'chapel' },
  { id: 'kaishoku', label: () => '親しい人だけの会食', price: 250000, guests: 12, back: 0.3, art: 'hiroen' },
  { id: 'std', label: (era) => (era === 'showa' ? '神前式とホテルの披露宴' : era === 'reiwa' ? '挙式と披露宴（ゲストハウス）' : '教会風のチャペルと披露宴'), price: 1500000, guests: 60, back: 0.6, art: 'chapel' },
  { id: 'big', label: () => '盛大な披露宴（芸能界の仲間もたくさん）', price: 4500000, guests: 150, back: 0.7, art: 'hiroen', fame: 1000 },
];
export function canShiki(g, rec) {
  if (rec.st !== 'married' && rec.st !== 'engaged') return '';
  if (rec.shiki) return 'もう、式をあげた';
  return null;
}
export async function shikiFlow(g, rec) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const why = canShiki(g, rec);
  if (why !== null) { if (why) await g.say(`（${why}）`); return false; }
  const bw = blockReason(g);
  if (bw) { await g.say(`（${bw}）`); return false; }
  const ids = SHIKI.filter((s) => !s.fame || st.fame >= s.fame);
  const i = await g.list({
    title: '結婚式は、どうする？', items: ids.map((s) => ({ label: s.label(era), right: fmtMoney(s.price), disabled: st.money < s.price })), x: 16, y: 44, w: 440, px: true, cancel: -1,
    describe: (k) => (ids[k] ? (ids[k].guests ? `招待客 ${ids[k].guests}人ほど。ご祝儀で、費用の${Math.round(ids[k].back * 100)}%ほどがもどってくる。` : '招待客はなし。ふたりだけの、思い出の一日。') : ''),
  });
  if (i < 0) return false;
  const S = ids[i];
  if (!g.spend(S.price)) { await g.say('（お金が足りない…）'); return false; }
  // the clothes
  const dress = await g.ask('あなたの装いは？', ['ウェディングドレス', 'タキシード', '白無垢・紋付袴（和装）'], { cancel: 1 });
  const pg = pgOf(g);
  const skin = (st.look && st.look.skin) || 'fair';
  const mineLook = [
    { ...(st.look || {}), top: '#ffffff', bottom: '#ffffff', skirt: true },
    { ...(st.look || {}), top: '#2a2a32', bottom: '#2a2a32', jacket: true, tie: '#f2f2f2', skirt: false },
    { ...(st.look || {}), top: '#1e1e26', bottom: '#8a8a96', skirt: true },
  ][dress];
  const theirsDefault = rec.g === 'f' ? { ...recLook(rec, era), top: '#ffffff', bottom: '#ffffff', skirt: true } : { ...recLook(rec, era), top: '#2a2a32', bottom: '#2a2a32', jacket: true, tie: '#f2f2f2', skirt: false };
  const theirs = dress === 2 && rec.g === 'f' ? { ...theirsDefault, top: '#ffffff' } : theirsDefault;
  const who = whoOf(g, rec);
  const shinzen = S.id === 'std' && (era === 'showa' || dress === 2);
  const partner = st.partner && PEOPLE[st.partner] ? PEOPLE[st.partner] : null;
  await playScene(g, { art: shinzen ? 'shinzen' : 'chapel', title: shinzen ? '神前式' : 'チャペル', you: theirs, bgm: 'rom_wedding', phase: 'day', extra: { leftLook: mineLook, rightLook: theirs, era } }, async (sc) => {
    await sc.intro('結婚式');
    if (S.guests === 0) {
      await g.say(['（ふたりだけで、静かに誓いのことばを交わした）', '（カメラマンが、シャッターを切る音が、やさしくひびく）']);
    } else {
      await g.say(shinzen
        ? ['（神前式。白無垢の姿で、神主さんの前にならんだ）', '（三々九度の盃を、ふたりでかたむけた）']
        : ['（バージンロードを、ゆっくり歩く）', '（祝福の拍手が、チャペルにひびいた）']);
      await g.say('「健やかなるときも、病めるときも…」\n（誓いのことばを、ふたりで、しっかり言いきった）');
    }
    sc.burst(10); sc.flash = 14;
    await sayAs(g, who, sl(rec, ['これからも、ずっといっしょ{da}ね。', '{name}と結婚できて、{I}、ほんとうに幸せ{da}。']));
    if (S.guests > 0) {
      sc.setArt('hiroen', { title: '披露宴', extra: { leftLook: mineLook, rightLook: theirs, era } });
      await g.say(['（披露宴。ケーキ入刀に、お色直し。大きな拍手と、ひやかしの声がとびかう）']);
      if (partner) {
        await sayAs(g, partner, partner.dialect === 'kansai' ? ['{name}との出会いは、ぼくが舞台でスベっとったときで…', '…いや、これ、結婚式のスピーチで言うことちゃうな。\nとにかく、おめでとう！幸せになれよ！'] : ['{name}と初めて会ったのは、売れない舞台の裏でした。', '…今日は、ネタじゃなくて、本気で言います。おめでとう。幸せに！']);
        g.addAff(st.partner, 4, true);
      }
      await g.say(['（友人代表のスピーチ、サプライズのビデオ、そして…両親への手紙）', '（会場じゅうが、あたたかい涙と笑いにつつまれた）']);
      if (S.guests >= 60) await g.say(`（${S.guests}人ほどが来てくれた。ご祝儀は ${fmtMoney(Math.round(S.price * S.back))} ほど）`);
    }
  });
  const back = Math.round(S.price * S.back);
  if (back) g.addMoney(back, true);
  rec.shiki = S.id;
  rec.mo = 100;
  g.addAff(rec.id, 5, true);
  st.life.stress = clamp(st.life.stress - 30, 0, 100);
  addHist(g, `結婚式をあげた（${S.label(era)}）`);
  addAlbum(g, 'wedding', S.id === 'photo' ? '結婚の記念撮影' : '結婚式', { style: S.id, shinzen: shinzen ? 1 : 0 });
  if (S.guests >= 60) { g.addFame(Math.round(10 * Math.min(2, st.fame / 800 + 0.5)), true); g.addFans(60, true); }
  await g.say(['お式は、無事に終わった。', S.price ? `（費用 ${fmtMoney(S.price)}${back ? `・ご祝儀 ${fmtMoney(back)}` : ''}。ストレス -30）` : '']);
  // the honeymoon
  const h = await g.ask('新婚旅行に行く？', [eraWord(era, { showa: 'ハワイへ（昭和の新婚旅行の定番）', d: '旅行に行く（¥200,000）' }), '行かない'], { cancel: 1 });
  if (h === 0 && g.spend(200000)) {
    await playScene(g, { art: 'tabi', title: '新婚旅行', you: who.look, bgm: 'rom_night', phase: 'dusk' }, async (sc) => {
      await g.say(['（見知らぬ街の夕やけを、ふたりでずっと眺めた）', sl(rec, '「…来てよかった{ne}。この景色、一生わすれない{yo}」')]);
      sc.burst(6);
    });
    st.life.stress = clamp(st.life.stress - 25, 0, 100);
    st.stamina = st.maxStamina;
    rec.mo = 100;
    addAlbum(g, 'honeymoon', '新婚旅行');
    await g.say('（ストレス -25・体力が回復した）');
  } else if (h === 0) await g.say('（お金が足りない…。また、いつか行こう）');
  return true;
}

// ---------------------------------------------------------------- the household (every Monday: money; every day: small things)
const COUPLE_COST = 4500, KID_COST = 2500, KID_SCHOOL = 1500;
const BENEFIT = { showa: 0, heisei_early: 300, heisei: 700, reiwa: 900 };
export const WORK = {
  dual: { label: '共働き', f: 1.0 }, part: { label: '時短・パートで働く', f: 0.45 }, home: { label: '専業（家のことを中心に）', f: 0 },
};
export function weeklyBalance(g) {
  const R = rom(g), st = g.state, era = eraOf(g);
  const sp = spouseRec(g);
  const lead = leadRec(g);
  const out = { income: 0, cost: 0, benefit: 0, net: 0, label: '' };
  if (!lead || (lead.st !== 'married' && lead.st !== 'cohab')) return out;
  const j = D.JOBS[lead.jb] || D.JOBS.kaisha;
  if (lead.st === 'cohab') {
    out.income = Math.round(j.inc * 0.35);
    out.cost = 1500;
  } else {
    const wk = WORK[R.home.work] || WORK.dual;
    let f = wk.f;
    const lv = R.leave;
    const spLeave = R.preg && R.preg.by === 'spouse' || (R.kids.length && R.home.spLeave && st.day < R.home.spLeave);
    if (spLeave) f *= 0.5;
    out.income = Math.round(j.inc * f);
    out.cost = COUPLE_COST;
    for (const k of R.kids) {
      const age = Math.floor((st.day - k.b) / YEAR_DAYS);
      if (age < 0) continue;
      out.cost += KID_COST + (age >= 6 ? KID_SCHOOL : 0);
      if (age < 18) out.benefit += BENEFIT[era];
      if (R.home.care === 'hoikuen' && age >= 1 && age < 6) out.cost += era === 'reiwa' && age >= 3 ? 0 : 2000; // 保育園 (3〜5歳は2019年10月から無償)
    }
    if (R.home.support) out.cost += R.home.support; // 養育費 (after a divorce) is handled on its own
  }
  out.net = out.income + out.benefit - out.cost;
  return out;
}
onRomTick((g, R, ctx) => {
  const lead = leadRec(g);
  if (!lead || (lead.st !== 'married' && lead.st !== 'cohab')) return;
  const st = g.state;
  if (g.weekday !== 0 || R.last.week === g.week) return;
  R.last.week = g.week;
  const b = weeklyBalance(g);
  const have = st.money;
  if (b.net >= 0) st.money += b.net;
  else {
    const pay = Math.min(have, -b.net);
    st.money -= pay;
    if (pay < -b.net) { st.life.stress = clamp(st.life.stress + 3, 0, 100); }
  }
  R.stat.household = (R.stat.household || 0) + b.net;
  const sign = (n) => (n >= 0 ? '+' : '-') + fmtMoney(Math.abs(n));
  ctx.notes.push(`（今週の家計：${lead.st === 'married' ? partnerWord(g, lead) : '同居'}の収入 ${fmtMoney(b.income)}${b.benefit ? `・手当 ${fmtMoney(b.benefit)}` : ''}、生活費 ${fmtMoney(b.cost)}　→　${sign(b.net)}${have + b.net < 0 || (b.net < 0 && have < -b.net) ? '（足りない分は、がまん…）' : ''}）`);
});
// the quiet daily warmth of a good marriage (small, so it never decides anything)
onRomTick((g, R) => {
  const lead = leadRec(g);
  if (!lead || (lead.st !== 'married' && lead.st !== 'cohab')) return;
  const st = g.state;
  if (lead.mo >= 60 && st.day % 4 === 0) { g.addNeed('stress', -2); }
  if (lead.mo < 25 && st.day % 3 === 0) { g.addNeed('stress', 2); }
});

// ---------------------------------------------------------------- 離婚
export async function divorceFlow(g, rec) {
  const st = g.state, R = rom(g), era = eraOf(g);
  if (rec.st !== 'married') return false;
  const same = sameSex(g, rec);
  const legal = rec.legal !== false;
  const kids = R.kids.slice();
  await g.say(['（ふたりの関係を、終わりにするかどうか…）', same && !legal ? 'ふたりの暮らしを解消する' : D.FACTS.rikon].filter(Boolean));
  const i = await g.ask(`${shortName(rec)}と、${same && !legal ? '別々に暮らす' : '離婚する'}ことを、考える？`, ['話し合いをする', 'やめておく'], { cancel: 1 });
  if (i !== 0) return false;
  const who = whoOf(g, rec);
  let how = 0;
  if (legal) {
    how = await g.ask(['話し合いは、どう進める？', '（協議離婚は、役所に離婚届を出せばよい。調停は、家庭裁判所を通すので、時間も費用もかかる）'], ['話し合いで決める（協議離婚）', '家庭裁判所の調停にする（費用 ¥50,000）', 'もう少し考える'], { cancel: 2 });
    if (how === 2) return false;
    if (how === 1 && !g.spend(50000)) { await g.say('（調停の費用が足りない…）'); return false; }
  }
  let custody = null;
  if (kids.length) {
    const c = await g.ask(['子どもは、どちらが育てる？', `（${kids.length}人。離婚後の親権は、${era === 'reiwa' ? '2026年から「共同親権」も選べる制度ができたが、ここでは、どちらが主に育てるかを決める' : 'どちらか一方が持つ'}）`], ['自分が育てる', `${shortName(rec)}が育てる（面会は続けられる）`], { cancel: 0 });
    custody = c === 0 ? 'me' : 'them';
  }
  await playScene(g, { art: 'park', title: 'ふたりの話し合い', you: who.look, phase: 'dusk', bgm: 'rom_night' }, async () => {
    await g.say(['（言葉をえらびながら、ふたりで、これからのことを話しあった）']);
    await sayAs(g, who, sl(rec, ['どちらが悪い、って話じゃない{yo}。\n…ただ、ふたりの進む方向が、ずれてしまった{nda}。', '{name}と過ごした時間は、{I}にとって宝物{da}。それは、ほんとう。']));
    await g.say('（風が、ふたりの間を通りぬけていった）');
  });
  // the money (財産分与: the half of what was built together — here a third of today's money) and the children
  const share = legal ? Math.min(st.money, Math.round(st.money * 0.3)) : 0;
  st.money -= share;
  setStage(g, rec, 'ex');
  g.addAff(rec.id, -Math.round(g.aff(rec.id) * 0.5), true);
  rec.mo = 30;
  const H = R.home;
  H.maiden = H.maiden || '';
  if (H.maiden) { H.hn = H.maiden; }
  H.hn = '';
  H.maiden = '';
  R.leave = null;
  if (custody === 'me') { H.support = 0; }
  else if (custody === 'them') { H.support = 3000 * kids.length; H.visit = rec.id; }
  H.custody = custody;
  if (custody === 'them') { H.kidsAway = kids.map((k) => k.id); }
  st.life.stress = clamp(st.life.stress + (how === 1 ? 35 : 28), 0, 100);
  addHist(g, same && !legal ? `${shortName(rec)}との暮らしを、終えた` : `${shortName(rec)}と、離婚した`);
  addAlbum(g, 'rikon', same && !legal ? 'ふたりの暮らしの終わり' : '離婚');
  await g.say([same && !legal ? `${shortName(rec)}との暮らしを、終えた。` : `${shortName(rec)}と、離婚した。`, `（ストレス +${how === 1 ? 35 : 28}${share ? `・財産分与 ${fmtMoney(share)}` : ''}${custody === 'them' ? `・養育費 ${fmtMoney(3000 * kids.length)}／週` : ''}）`, legal ? '（名字は、もとの名字にもどった。仕事の名前は、そのまま）' : '']);
  try { announce(g, 'rikon', `{fullname}、${shortName(rec)}さんと離婚。「今後も、お互いの人生を応援する」`, { label: '離婚' }); } catch (e) { console.error(e); }
  return true;
}
// 養育費 after a divorce (kids live with the other parent): paid on Mondays until they are 18
onRomTick((g, R) => {
  if (!R.home.support || g.weekday !== 0 || R.last.support === g.week) return;
  R.last.support = g.week;
  const st = g.state;
  const left = R.kids.filter((k) => (R.home.kidsAway || []).includes(k.id) && Math.floor((st.day - k.b) / YEAR_DAYS) < 18);
  if (!left.length) { R.home.support = 0; return; }
  const pay = Math.min(st.money, R.home.support);
  st.money -= pay;
});

// ---------------------------------------------------------------- 結婚記念日
onRomTick((g, R, ctx) => {
  const lead = leadRec(g);
  if (!lead || lead.st !== 'married') return;
  const st = g.state;
  const n = st.day - num(lead.wedDay, lead.since);
  if (n > 0 && n % YEAR_DAYS === 0 && R.last.annivWed !== st.day) {
    R.last.annivWed = st.day;
    ctx.msgs.push({ pri: 9, rec: lead, text: `今日は、結婚して${n / YEAR_DAYS}年{da}。\nいつも、ありがとう{ne}。` });
    queueEvent(g, 'anniv_wed', { id: lead.id, years: n / YEAR_DAYS }, 'anniv_wed');
  }
});
onRomEvent('anniv_wed', async (g, d) => {
  const rec = recOf(g, d.id); if (!rec || rec.st !== 'married') return;
  const st = g.state, era = eraOf(g);
  const who = whoOf(g, rec);
  await g.say(`（今日は、結婚して${d.years}年の記念日だ）`);
  const i = await g.ask('どう過ごす？', ['レストランで、ふたりでディナー（¥8,000）', 'おうちで、手料理でお祝い', 'いそがしくて、何もできなかった'], { cancel: 2 });
  if (i === 0 && g.spend(8000)) {
    await playScene(g, { art: 'gohan', title: '記念日のディナー', you: who.look, bgm: 'rom_date', phase: 'night' }, async (sc) => {
      await sayAs(g, who, sl(rec, ['{name}、{n}年間、ありがとう。\nこれからも、よろしく{ne}。'.replace('{n}', String(d.years))]));
      sc.burst(6);
    });
    rec.mo = clamp(rec.mo + 10, 0, 100); g.relax({ stress: 14 });
  } else if (i === 1 || (i === 0)) {
    await g.say('（おうちで、ささやかなごちそうと、ケーキ。\nそれだけで、十分しあわせな夜だ）');
    rec.mo = clamp(rec.mo + 6, 0, 100); g.relax({ stress: 10 });
  } else {
    await sayAs(g, who, sl(rec, ['…ううん、いいの。お仕事だもんね。\nでも、来年は、ふたりで過ごそう{ne}。']));
    rec.mo = clamp(rec.mo - 5, 0, 100);
  }
  addHist(g, `結婚${d.years}年の記念日`);
  addAlbum(g, 'anniv', `結婚${d.years}年の記念日`);
});
