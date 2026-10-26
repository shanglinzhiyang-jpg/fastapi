// 恋愛・結婚・家庭 (R12-L1) — 子どもを授かる・迎える、出産、育児と仕事、子どもの成長と進路、不妊・養子・里親・子どもを持たない選択。
// Tasteful and plain: no medical detail, no moralizing. Everything is the couple's choice. A game year is 120 days, so a child grows a
// year every 120 days (the events scale with that). Illness and loss are never shown here (the family module's 思い出 covers them).
import { PEOPLE } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { ageOf, profileOf, regionOf, YEAR_DAYS } from './profile.js';
import { LOOKS } from './sprites.js';
import * as D from './romance_data.js';
import {
  rom, active, recOf, leadRec, spouseRec, isCouple, partnerWord, shortName, recLook, pgOf, eraOf, addHist, addAlbum, blockReason, romMessage, queueEvent,
  onRomEvent, onRomTick, announce, sameSex, flat, kidAge, kidYears, kidLook, kidScale, kidsForScene,
} from './romance.js';
import { playScene, sayAs, askAs } from './romance_scene.js';
import { eraWord } from './romance_date.js';
import { askText } from './textinput.js';

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const sl = (rec, s, x) => D.sayLine(s, rec, x);
const GAP = YEAR_DAYS;
const PREG_DAYS = 93, TRY_CHECK = 10;

// (kidAge / kidYears / kidLook / kidScale / kidsForScene live in romance.js)
const hn = (g) => rom(g).home.hn || pgOf(g).familyName;

// who carries the baby: 'player' | 'spouse' | null
export function carrier(g, rec) {
  const pg = pgOf(g);
  if (!rec) return null;
  if (pg.gender === 'f' && rec.g === 'm') return 'player';
  if (pg.gender === 'm' && rec.g === 'f') return 'spouse';
  if (pg.gender === 'x') return rec.g === 'f' ? 'spouse' : 'player';
  return null;
}

// ---------------------------------------------------------------- 子どものことを話す
const NAMES = {
  showa: { m: ['翔太', '大輔', '健太', '拓也', '直樹', '和也'], f: ['愛', '彩', '麻衣', '由美', '彩香', '美穂'] },
  heisei_early: { m: ['翔太', '拓哉', '大樹', '健太', '翼', '駿'], f: ['美咲', '愛美', '彩', '菜摘', '里奈', '麻衣'] },
  heisei: { m: ['翔太', '大輝', '蓮', '陸', '悠斗', '颯太'], f: ['美咲', '陽菜', '萌', '結衣', '花', '葵'] },
  reiwa: { m: ['蓮', '湊', '陽翔', '朝陽', '樹', '凪'], f: ['陽葵', '凛', '紬', '芽依', '咲良', '澪'] },
};
export function fertilityState(g) { const R = rom(g); R.fert = R.fert || { trying: false, since: 0, courses: 0, nokids: false, last: 0 }; return R.fert; }
export function canPlan(g, rec) {
  if (!rec || rec.st !== 'married') return '';
  const R = rom(g);
  if (R.preg) return 'いま、授かっている';
  if (R.kids.length >= 4) return '';
  return null;
}
export async function planFlow(g, rec) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const why = canPlan(g, rec);
  if (why !== null) { if (why) await g.say(`（${why}）`); return false; }
  const F = fertilityState(g);
  const who = { name: rec.n, look: recLook(rec, era) };
  const same = sameSex(g, rec);
  const car = carrier(g, rec);
  await g.say([`（${partnerWord(g, rec)}と、これからの家族のことを、ゆっくり話してみよう）`, '（子どもを持つか、持たないか。授かりかたも、迎えかたも、ふたりで決めること）']);
  if (!car) {
    // two of the same sex: the ways open to them (by era)
    await g.say(['（ふたりで子どもを育てたい、という気持ちは、あるだろうか）', era === 'reiwa' ? '（いまの制度では、里親として、子どもを迎えるという道がある。児童相談所の面談と研修をへて、里子を預かる）' : '（いまの制度のもとでは、同性のカップルが子どもを迎えるのは、むずかしい。ふたりの暮らしを大切にする、という道もある）']);
    const c = era === 'reiwa' ? await g.ask('どうする？', ['里親について、くわしく話を聞く', 'ふたりの暮らしを、大切にする'], { cancel: 1 }) : 1;
    if (c === 0) return adoptFlow(g, rec, 'satooya');
    F.nokids = true;
    await sayAs(g, who, sl(rec, ['うん。ふたりで、いろんなところに行って、笑って暮らそう{ne}。']));
    addHist(g, 'ふたりの暮らしを、大切にすることにした');
    return true;
  }
  const i = await g.ask('子どものことを、どう考える？', ['授かれたら、うれしい', 'もう少し、ふたりで過ごしてから', 'ふたりの暮らしを、大切にしたい'], { cancel: 1 });
  if (i === 2) {
    F.nokids = true; F.trying = false;
    await sayAs(g, who, rec.val.k === 2 ? sl(rec, ['そっか。…{I}は、子どもがほしい気持ちもあったけど。\n{name}との暮らしが、いちばん大事{da}。ふたりで、決めたことだ{ne}。']) : sl(rec, ['うん、{I}もそう思ってた。\nふたりで、のんびり、いろんなところに行こう{ne}。']));
    if (rec.val.k === 2) rec.mo = clamp(rec.mo - 3, 0, 100);
    addHist(g, 'ふたりの暮らしを、大切にすることにした（子どもは持たない選択）');
    return true;
  }
  if (i === 1) { F.trying = false; await sayAs(g, who, sl(rec, ['うん、そうしよう。\n焦らなくていい{yo}。ふたりのタイミングで{ne}。'])); return true; }
  // rec who does not want children
  if (rec.val.k === 0) {
    await sayAs(g, who, sl(rec, ['…正直に言うね。{I}は、子どもは持たないつもりだった{nda}。', '{name}の気持ちは、うれしい。でも…すこし、考える時間がほしい。']));
    const j = await g.ask('どうする？', ['待つ（また、あらためて話そう）', 'ふたりの暮らしを大切にする'], { cancel: 0 });
    if (j === 1) { F.nokids = true; addHist(g, 'ふたりの暮らしを、大切にすることにした'); await g.say('（ふたりで決めたことだ。それも、ひとつの家族のかたち）'); }
    else { rec.mo = clamp(rec.mo - 2, 0, 100); rec.kChanged = (rec.kChanged || 0) + 1; if (rec.kChanged >= 2 && rec.mo >= 70) { rec.val.k = 1; await g.say('（後日…「やっぱり、{name}となら」と、{who}が言ってくれた）'.replace('{who}', shortName(rec))); } }
    return true;
  }
  F.trying = true; F.since = st.day; F.nokids = false;
  await sayAs(g, who, sl(rec, ['うん。授かれたら、うれしい{ne}。\n{I}たちのペースで、ゆっくり待とう{yo}。']));
  await g.say(['（もし授かったら、産休・育休や、保育園のことも考えなければ）', D.FACTS.shussan(era)]);
  addHist(g, '子どもを授かれたらと、ふたりで話した');
  return true;
}

// ---------------------------------------------------------------- the morning checks
onRomTick((g, R, ctx) => {
  const sp = leadRec(g);
  if (!sp || sp.st !== 'married') return;
  const st = g.state, era = eraOf(g);
  const F = R.fert;
  // conception: every TRY_CHECK days while trying
  if (F && F.trying && !R.preg && !F.nokids && st.day - (F.last || 0) >= TRY_CHECK && R.kids.length < 4) {
    F.last = st.day;
    const car = carrier(g, sp);
    const age = car === 'player' ? ageOf(st) : sp.age + Math.floor((st.day - sp.met) / YEAR_DAYS);
    let p = age < 30 ? 0.4 : age < 35 ? 0.33 : age < 40 ? 0.2 : 0.1;
    if (F.courses) p += 0.1 * Math.min(3, F.courses);
    if (D.rngNext(R) < p) startPregnancy(g, sp, car);
    else if (st.day - F.since >= 80 && !F.funinDone) { F.funinDone = st.day; queueEvent(g, 'funin', { id: sp.id }, 'funin'); }
  }
  // the pregnancy timeline
  if (R.preg) {
    const P = R.preg, n = st.day - P.start;
    P.ev = P.ev || {};
    const fire = (k, kind) => { if (!P.ev[k]) { P.ev[k] = 1; queueEvent(g, kind, { id: sp.id }, `${kind}`); } };
    if (n >= 4) fire('news', 'preg_news');
    if (n >= 22) fire('tsuwari', 'preg_tsuwari');
    if (n >= PREG_DAYS - 20 && P.by === 'player') fire('leave', 'preg_leave');
    if (n >= PREG_DAYS - 20 && P.by === 'spouse') fire('leave', 'preg_leave');
    if (st.day >= P.due) fire('birth', 'birth');
    // a little less energy for the one who carries
    if (P.by === 'player' && n > 10 && !(R.leave && st.day < R.leave.until)) st.stamina = Math.max(1, Math.round(st.stamina * (n > 60 ? 0.85 : 0.92)));
    if (n > 12 && n < 35) g.addNeed('stress', 1);
  }
  // babies: sleepless nights (less when the other parent is home)
  const babies = R.kids.filter((k) => kidAge(g, k) < 1 && !(R.home.kidsAway || []).includes(k.id));
  if (babies.length) g.addNeed('stress', R.home.work === 'home' ? 1 : 2);
  // growth events
  for (const k of R.kids) {
    if ((R.home.kidsAway || []).includes(k.id)) continue;
    const a = kidAge(g, k);
    k.d = k.d || {};
    const date = ctx.date;
    const due = (key, cond, kind) => { if (!k.d[key] && cond) { k.d[key] = 1; queueEvent(g, kind, { kid: k.id, key }, `${kind}${k.id}`); } };
    due('miya', a >= 0.083, 'kid_miyamairi');
    due('okui', a >= 0.28, 'kid_okuizome');
    due('b1', a >= 1, 'kid_age1');
    due('y2', a >= 2, 'kid_age2');
    due('y3', a >= 3, 'kid_age3');
    if (date && date.month === 11) {
      const y = kidYears(g, k);
      if ((y === 3 || (y === 5 && k.g === 'm') || (y === 7 && k.g === 'f')) && !k.d[`s${y}`]) { k.d[`s${y}`] = 1; queueEvent(g, 'kid_shichigosan', { kid: k.id, key: `s${y}` }, `kid_shichigosan${k.id}`); }
    }
    due('y6', a >= 6, 'kid_school');
    due('y12', a >= 12, 'kid_junior');
    due('y15', a >= 15, 'kid_exam');
    due('y18', a >= 18, 'kid_adult');
    // a fever now and then while the child is small (in 保育園)
    if (a >= 0.5 && a < 7 && st.day - (R.last.fever || -99) > 40 && D.rngNext(R) < 0.04) { R.last.fever = st.day; queueEvent(g, 'kid_fever', { kid: k.id }, 'kid_fever'); }
    // a child's birthday
    const doy = ((st.day - k.b) % GAP + GAP) % GAP;
    if (doy === 0 && st.day > k.b) { ctx.notes.push(`（今日は、${k.n}の誕生日！${kidYears(g, k)}歳になった）`); queueEvent(g, 'kid_bday', { kid: k.id }, `kid_bday${k.id}`); }
  }
  // leave is over
  if (R.leave && st.day >= R.leave.until) { R.leave = null; ctx.notes.push('（お休みはおわった。お仕事に、もどれる）'); }
});

// ---------------------------------------------------------------- the pregnancy
export function startPregnancy(g, rec, by) {
  const R = rom(g), st = g.state;
  if (R.preg) return false;
  R.preg = { by, start: st.day, due: st.day + PREG_DAYS, ev: {} };
  const F = fertilityState(g);
  F.trying = false;
  return true;
}
const SPOUSE = (g, rec) => partnerWord(g, rec);
onRomEvent('preg_news', async (g, d) => {
  const rec = recOf(g, d.id), R = rom(g);
  if (!rec || !R.preg) return;
  const era = eraOf(g);
  const who = { name: rec.n, look: recLook(rec, era) };
  const P = R.preg;
  await playScene(g, { art: 'home', title: 'ふたりの部屋', you: who.look, bgm: 'rom_lullaby', phase: 'night', hearts: true }, async (sc) => {
    if (P.by === 'spouse') {
      await sayAs(g, who, sl(rec, ['…あのね、{name}。\n病院に行ってきた{nda}。', '赤ちゃん、できたって。']));
      await g.say('（一瞬、頭が真っ白になった。それから、じわじわと、うれしさがこみあげてきた）');
    } else {
      await g.say(['（病院で、赤ちゃんがいると言われた。母子手帳を、ぎゅっとにぎりしめた）']);
      await sayAs(g, who, sl(rec, ['ほんと！？…やった、やったあ！\n{name}、ありがとう{ne}。']));
    }
    sc.burst(10); sc.flash = 12;
    await sayAs(g, who, sl(rec, ['これから、いろいろたいへんだけど…\nふたりで、がんばろう{ne}。']));
  });
  addHist(g, '赤ちゃんを授かった');
  addAlbum(g, 'preg', P.by === 'spouse' ? 'おなかの赤ちゃん' : 'おなかの赤ちゃん（母子手帳）');
  g.sfx('fanfare');
  // the family hears
  try {
    const fam = Object.keys(PEOPLE).filter((id) => PEOPLE[id] && PEOPLE[id].kind === 'family' && g.state.people && g.state.people[id] && /^fam_(mother|father|grand)/.test(id));
    if (fam.length && R.last.msg !== g.state.day) { const id = fam[0]; R.last.msg = g.state.day; g.message({ from: PEOPLE[id].name, person: id, kind: 'chat', rom: 1, text: flat(g.fmt('{name}、赤ちゃんができたって本当！？おめでとう！体を大事にね。ほんとうに、うれしい！')) }); }
  } catch (e) { console.error(e); }
  await g.say(['（赤ちゃんが、生まれるのは、あと3か月ほど先だ）', D.FACTS.shussan(era)]);
});
onRomEvent('preg_tsuwari', async (g, d) => {
  const rec = recOf(g, d.id), R = rom(g);
  if (!rec || !R.preg) return;
  const who = { name: rec.n, look: recLook(rec, eraOf(g)) };
  const P = R.preg;
  if (P.by === 'spouse') {
    await sayAs(g, who, sl(rec, ['ごめん、最近、においがだめで…ごはんが作れない{nda}。']));
    const i = await g.ask('どうする？', ['家事をかわる（体力 -8）', 'お惣菜を買って帰る（¥1,500）', 'ようすを見る'], { cancel: 2 });
    if (i === 0) { g.state.stamina = Math.max(1, g.state.stamina - 8); rec.mo = clamp(rec.mo + 6, 0, 100); await sayAs(g, who, sl(rec, ['…ありがとう。助かる{yo}。'])); }
    else if (i === 1 && g.spend(1500)) { rec.mo = clamp(rec.mo + 3, 0, 100); await sayAs(g, who, sl(rec, ['食べられそうなもの、選んでくれたんだ。うれしい{ne}。'])); }
    else rec.mo = clamp(rec.mo - 2, 0, 100);
  } else {
    await g.say('（朝から、むかむかして、食べ物のにおいがきつい…。つわりの時期だ）');
    const i = await g.ask('どうする？', ['無理せず、休む', 'いつも通り、がんばる'], { cancel: 0 });
    if (i === 0) { g.relax({ stress: 10 }); g.heal(20); await g.say('（横になって、ゆっくり休んだ。体が、すこし楽になった）'); }
    else { g.addNeed('stress', 8); await g.say('（がんばってみたけれど、やっぱり体にひびいた…。ストレス +8）'); }
  }
});
onRomEvent('preg_leave', async (g, d) => {
  const rec = recOf(g, d.id), R = rom(g), st = g.state, era = eraOf(g);
  if (!rec || !R.preg) return;
  const P = R.preg;
  const who = { name: rec.n, look: recLook(rec, era) };
  if (P.by === 'player') {
    await g.say(['（出産の予定日が、近づいてきた）', '（産前6週・産後8週の産休は、法律で決まっている。お仕事は、どうする？）']);
    const i = await g.ask('産休は？', ['産休に入る（お仕事を休む）', '直前まで働く'], { cancel: 0 });
    if (i === 0) { R.leave = { kind: 'sanq', until: P.due + 19 }; await g.say(['（お仕事を休んで、産休に入った。\n出産と、そのあとの体の回復に、専念できる）', '（もどりたくなったら、「恋のはなし」→家族 から、お仕事にもどれる）']); }
    else { await g.say('（無理のない範囲で、舞台と収録をつづけることにした）'); g.addNeed('stress', 4); }
  } else {
    await g.say(`（出産の予定日が、近づいてきた。\n${shortName(rec)}の仕事は、もうお休みに入っている）`);
    R.home.spLeave = P.due + 40;
    const ikukyu = eraWord(era, { showa: '男性が育休を取る制度は、まだない。', heisei_early: '育児休業はあるけれど、男性が取る人は、ほとんどいない。', heisei: '男性が育休を取る人は、まだ、ほんの少しだけ。', reiwa: '男性の育休も、少しずつ増えてきた。' });
    await g.say(`（${ikukyu}）`);
    const i = await g.ask('産後のサポートは？', ['出産後の1か月は、お仕事をおさえて、育児を手伝う', 'いつも通り、仕事を優先する'], { cancel: 0 });
    if (i === 0) { R.leave = { kind: 'ikukyu', until: P.due + 10 }; await g.say('（産後の1か月は、お仕事をおやすみして、家のことに専念することにした）'); rec.mo = clamp(rec.mo + 6, 0, 100); }
    else { await g.say(`（${shortName(rec)}は、「ひとりで大変だけど、がんばるね」と笑った。…少し、心が痛んだ）`); rec.mo = clamp(rec.mo - 3, 0, 100); }
  }
});
onRomEvent('birth', async (g, d) => {
  const rec = recOf(g, d.id), R = rom(g), st = g.state, era = eraOf(g);
  if (!rec || !R.preg) return;
  const P = R.preg;
  const who = { name: rec.n, look: recLook(rec, era) };
  const gender = D.rngNext(R) < 0.5 ? 'm' : 'f';
  const hospital = P.by === 'player' ? 'me' : 'you';
  let kid = null;
  await playScene(g, { art: 'sanin', title: '産院', you: who.look, bgm: 'rom_lullaby', phase: 'day', extra: { mother: hospital } }, async (sc) => {
    await g.say('（その日は、とつぜんやってきた。\n家じゅうが、あわただしくなる…）');
    if (P.by === 'spouse') {
      const i = await g.ask('出産に、立ち会う？', ['立ち会う', '外でまっている'], { cancel: 1 });
      await g.say(i === 0 ? '（手をにぎって、ずっと声をかけつづけた。長い、長い時間…）' : '（待合室で、ただ時計を見つめていた。長い、長い時間…）');
    } else await g.say('（長い、長い時間…。そして――）');
    await g.wait(600);
    g.sfx('chime');
    await g.say('（赤ちゃんの、元気な産声が、ひびいた！）');
    sc.burst(12); sc.flash = 16;
    await g.say(`（${gender === 'f' ? '女の子' : '男の子'}だ。ちいさな手が、ぎゅっと、指をつかんだ）`);
    await sayAs(g, who, P.by === 'spouse' ? sl(rec, ['…{name}。ありがとう。\nこの子に、会えた{ne}。']) : sl(rec, ['…{name}、ありがとう。\nこの子、{name}にそっくり{da}。']));
    // the name
    const list = NAMES[era][gender];
    const pick = D.rngShuffle(R, list).slice(0, 3);
    const nameItems = [...pick.map((n) => `${n}（${hn(g)} ${n}）`), '自分たちで、考える'];
    let nm = null;
    const c = await g.ask(['名前は、どうしよう？', '（ふたりで考えた、いくつかの候補から）'], nameItems, { cancel: 0 });
    if (c < 3) nm = pick[c];
    else {
      try { const s = await askText(g, { title: '赤ちゃんの名前', value: pick[0], max: 6 }); nm = (s || '').trim() || pick[0]; } catch (e) { nm = pick[0]; }
    }
    kid = { id: `k${R.kids.length + 1}${st.day}`, n: nm, g: gender, b: st.day, ls: Math.floor(D.rngNext(R) * 1e6), by: 'born', d: {}, who: P.by };
    await g.say(`${hn(g)} ${nm}。\nちいさな命の、はじまりだ。`);
    sc.setArt('sanin', {});
    await sayAs(g, who, sl(rec, [`${nm}、これから、よろしくね。`]));
  });
  R.kids.push(kid);
  R.preg = null;
  rec.mo = 100;
  g.addAff(rec.id, 6, true);
  addHist(g, `${kid.n}が生まれた`);
  addAlbum(g, 'birth', `${kid.n}、誕生`, { kid: kid.id });
  st.life.stress = clamp(st.life.stress - 10, 0, 100);
  // the family, the fans, the press
  try {
    const fam = Object.keys(PEOPLE).filter((id) => PEOPLE[id] && PEOPLE[id].kind === 'family' && st.people && st.people[id] && /^fam_/.test(id));
    for (const id of rom(g).last.msg !== st.day ? fam.slice(0, 1) : []) { rom(g).last.msg = st.day; g.message({ from: PEOPLE[id].name, person: id, kind: 'chat', rom: 1, text: flat(g.fmt(`{name}、${kid.n}ちゃんの誕生、おめでとう！写真、また見せてね。ほんとうにうれしいわ。`)) }); }
    announce(g, 'baby', `{fullname}に第${R.kids.length}子が誕生。「家族が増えて、もっとがんばれる」`, { label: '出産' });
  } catch (e) { console.error(e); }
  // the leave (a player who gave birth is on 産休 by now: it goes on a while)
  if (P.by === 'player' && R.leave) R.leave.until = Math.max(R.leave.until, st.day + 19);
  await g.say([`${kid.n}が、わが家にやってきた！`, `（${D.FACTS.jidoteate(era)}）`]);
  R.home.work = R.home.work || 'dual';
  if (R.home.work === 'dual' && P.by === 'spouse') {
    await g.say(['（これから、赤ちゃんを育てながらの暮らしが始まる。\n働きかたは、「恋のはなし」→家族 から、いつでも見直せる）']);
  }
});

// ---------------------------------------------------------------- 育児と仕事
export async function leaveBack(g) {
  const R = rom(g);
  if (!R.leave) { await g.say('（いまは、おやすみ中ではない）'); return false; }
  R.leave = null;
  await g.say('（お仕事に、もどることにした。\n「また、がんばるね」と、赤ちゃんに声をかけた）');
  return true;
}
export async function workStyleFlow(g, rec) {
  const R = rom(g), st = g.state;
  const H = R.home;
  const WORK = { dual: '共働き（ふたりで働く）', part: '時短・パートで働く', home: '専業（家のことを中心にする）' };
  const items = Object.keys(WORK).map((k) => ({ label: `${WORK[k]}${H.work === k ? '（いま）' : ''}`, right: k === 'dual' ? '収入◎' : k === 'part' ? '収入○' : '収入なし' }));
  const i = await g.list({ title: `${shortName(rec)}の働きかた`, items, x: 24, y: 52, w: 420, px: true, cancel: -1, describe: () => '「収入」は、毎週の家計に入ってくるお金。働きかたは、ふたりの話し合いで、いつでも見直せる。' });
  if (i < 0) return false;
  const k = Object.keys(WORK)[i];
  H.work = k;
  const who = { name: rec.n, look: recLook(rec, eraOf(g)) };
  if (k === 'home') await sayAs(g, who, sl(rec, [rec.val.w === 2 ? '…うん、{name}が言うなら。\nでも、{I}、ほんとは仕事もがんばりたい{nda}。また、話しあおう{ne}。' : 'うん。家のこと、がんばる{ne}。']));
  else if (k === 'part') await sayAs(g, who, sl(rec, ['時間をうまく使って、無理のない範囲で{ne}。']));
  else await sayAs(g, who, sl(rec, ['いっしょにがんばろう{ne}。家事は、分担{ne}！']));
  if (k === 'home' && rec.val.w === 2) rec.mo = clamp(rec.mo - 4, 0, 100);
  if (k === 'dual' && rec.val.w === 0) rec.mo = clamp(rec.mo - 3, 0, 100);
  addHist(g, `働きかたを、「${WORK[k].replace(/（.*）/, '')}」にした`);
  return true;
}

// ---------------------------------------------------------------- the child's events
const kidOf = (g, id) => rom(g).kids.find((k) => k.id === id);
function kidWho(g, k) { return { name: k.n, look: kidLook(g, k) }; }
async function kidScene(g, k, art, title, lines, extra = {}) {
  const rec = leadRec(g);
  const you = rec ? recLook(rec, eraOf(g)) : {};
  await playScene(g, { art, title, you, bgm: extra.bgm || 'rom_lullaby', phase: extra.phase || 'day', kids: [{ look: kidLook(g, k), k: kidScale(g, k) || 0.5, baby: kidAge(g, k) < 1 }], banner: extra.banner, hearts: !!extra.hearts }, async (sc) => { await lines(sc); });
}
onRomEvent('kid_miyamairi', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  await kidScene(g, k, 'jinja', 'お宮参り', async (sc) => {
    await g.say([`（${k.n}の、お宮参り。神社で、元気に育ちますようにと、手を合わせた）`, '（祖母に抱かれた赤ちゃんは、ふしぎそうに、空を見上げている）']);
    sc.burst(5);
  });
  addAlbum(g, 'miya', `${k.n}、お宮参り`, { kid: k.id });
});
onRomEvent('kid_okuizome', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  await kidScene(g, k, 'home', 'お食い初め', async (sc) => {
    await g.say([`（${k.n}の、お食い初め。小さな鯛と、赤飯。「一生、食べものに困りませんように」）`, '（食べさせるまねをしただけなのに、みんなが大さわぎだ）']);
    sc.burst(4);
  });
  g.relax({ stress: 8 });
  addAlbum(g, 'okuizome', `${k.n}、お食い初め`, { kid: k.id });
});
onRomEvent('kid_age1', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  const R = rom(g), era = eraOf(g);
  await kidScene(g, k, 'home', '1歳の誕生日', async (sc) => {
    await g.say([`（${k.n}、1歳の誕生日！\n「一升餅」を背負わせたら、ころんと、しりもちをついた）`, '（みんなの笑い声が、ひびく）']);
    sc.burst(6);
  });
  addAlbum(g, 'age1', `${k.n}、1歳`, { kid: k.id });
  if (!R.home.care) {
    await g.say(['（育休がおわる時期だ。\nこれから、どう育てていく？）', D.FACTS.hoikuen(era)]);
    const items = ['保育園に預ける（毎週 ¥2,000）', '家でみる（専業にする）', '実家にたよる'];
    const c = await g.ask('どうする？', items, { cancel: 0 });
    if (c === 0) {
      // 待機児童 in the 2000s–2010s
      if (era === 'heisei' && D.rngNext(R) < 0.45) { await g.say(['（申し込んだけれど…「待機児童」。空きがなく、入れなかった）', '（とりあえず、家でみながら、順番を待つことにした）']); R.home.care = 'home'; g.addNeed('stress', 6); }
      else { R.home.care = 'hoikuen'; await g.say('（認可保育園に、入れることになった！）'); }
    } else if (c === 1) { R.home.care = 'home'; R.home.work = 'home'; await g.say('（家でみることにした。働きかたは、専業になる）'); }
    else { R.home.care = 'jikka'; await g.say('（実家に、おもにたよることにした。「いつでも預かるよ」と、頼もしい返事だ）'); }
  }
});
onRomEvent('kid_age2', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  await kidScene(g, k, 'home', 'イヤイヤ期', async () => {
    await g.say([`（${k.n}は、2歳。なんでも「イヤ！」と言うようになった）`, '（食べない、着替えない、帰らない…。でも、ときどき見せる笑顔に、すべてを許してしまう）']);
  });
  g.addNeed('stress', 4);
});
onRomEvent('kid_age3', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  await kidScene(g, k, 'hoikuen', '入園式', async (sc) => {
    await g.say([`（${k.n}、3歳。保育園・幼稚園の、はじめての日）`, '（ちいさな帽子とかばんをさげて、手をふってくれた）', '（先生に手をひかれていく背中が、ほんの少し、大きくなった気がした）']);
    sc.burst(5);
  });
  addAlbum(g, 'enter', `${k.n}、入園`, { kid: k.id });
});
onRomEvent('kid_shichigosan', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  const y = kidYears(g, k);
  await kidScene(g, k, 'jinja', '七五三', async (sc) => {
    await g.say([`（${k.n}、${y}歳の七五三。晴れ着すがたで、千歳飴をにぎっている）`, '（「大きくなったね」と、みんなで写真をとった）']);
    sc.burst(5);
  });
  addAlbum(g, 'shichigosan', `${k.n}、七五三（${y}歳）`, { kid: k.id });
});
onRomEvent('kid_school', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  await kidScene(g, k, 'hanami', '小学校の入学式', async (sc) => {
    await g.say([`（${k.n}、6歳。新しいランドセルが、ぶかぶかに見える）`, '（桜の下で、校門の看板といっしょに、写真をとった）']);
    sc.burst(6);
  }, { banner: '入学式', hearts: true });
  addAlbum(g, 'school', `${k.n}、小学校入学`, { kid: k.id });
  g.relax({ stress: 6 });
});
onRomEvent('kid_junior', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  await kidScene(g, k, 'hanami', '中学の入学式', async () => {
    await g.say([`（${k.n}、12歳。大きめの制服に、そでを通した）`, '（「もう、ついてこないでよ」と、照れくさそうに言われた）']);
  }, { banner: '入学式' });
  addAlbum(g, 'junior', `${k.n}、中学入学`, { kid: k.id });
});
onRomEvent('kid_exam', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  const who = kidWho(g, k);
  await g.say([`（${k.n}、15歳。進路の相談を、してきた）`]);
  const i = await g.ask(`${k.n}の進路は？`, ['普通科の高校に進んでほしい', '好きなこと（芸・スポーツ・絵）を伸ばせる学校を、応援する', '本人の決めたことを、尊重する'], { cancel: 2 });
  k.path = ['futsu', 'special', 'self'][i];
  await sayAs(g, who, i === 1 ? ['…ほんとうに？ありがとう。ぜったい、がんばる！'] : i === 0 ? ['うん…わかった。まずは、受験、がんばってみる。'] : ['…ありがとう。自分で決めて、ちゃんと責任もつよ。']);
  addHist(g, `${k.n}の進路について、話しあった`);
});
onRomEvent('kid_adult', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  const who = kidWho(g, k);
  await kidScene(g, k, 'home', '巣立ち', async () => {
    await g.say([`（${k.n}、18歳。もう、すっかり、大人の顔だ）`, '（あの小さな手が、この背中になるなんて…）']);
    await sayAs(g, who, ['…ねえ。いままで、ありがとう。\nこれからも、よろしくね。']);
  });
  addAlbum(g, 'adult', `${k.n}、18歳`, { kid: k.id });
});
onRomEvent('kid_fever', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  const rec = leadRec(g);
  await g.say(`（保育園から、電話があった。\n「${k.n}ちゃんが、熱を出しました。お迎えをお願いします」）`.replace('ちゃん', k.g === 'f' ? 'ちゃん' : 'くん'));
  const i = await g.ask('どうする？', ['自分が迎えにいく（体力 -8）', `${rec ? partnerWord(g, rec) : 'パートナー'}にまかせる`], { cancel: 1 });
  if (i === 0) { g.state.stamina = Math.max(1, g.state.stamina - 8); g.addNeed('stress', 4); await g.say('（病院で診てもらって、薬をもらった。家でねむる顔を見たら、ほっとした）'); if (rec) rec.mo = clamp(rec.mo + 3, 0, 100); }
  else if (rec) { rec.mo = clamp(rec.mo - 2, 0, 100); await g.say('（「わかった、行ってくる」…\n夜、もどってきたら、ちゃんと、ねぎらおう）'); }
});

// ---------------------------------------------------------------- 不妊 and the other ways of becoming a family
onRomEvent('funin', async (g, d) => {
  const rec = recOf(g, d.id); if (!rec || rec.st !== 'married') return;
  const R = rom(g), era = eraOf(g);
  const F = fertilityState(g);
  const who = { name: rec.n, look: recLook(rec, era) };
  await g.say(['（なかなか、授からないまま、半年がすぎた）', '（だれのせいでも、ない。ただ、気持ちが、すこし重くなる日もある）']);
  await sayAs(g, who, sl(rec, ['…こういうの、ふたりで話しあえて、よかった{yo}。\nどうするか、いっしょに決めよう{ne}。']));
  await g.say(D.FACTS.funin(era));
  const price = era === 'reiwa' ? 40000 : 90000;
  const items = [`病院で相談・検査をする（${fmtMoney(price)}）`, '自然にまかせて、待つ', '養子縁組や里親について、話を聞く', 'ふたりの暮らしを、大切にする'];
  const i = await g.ask('ふたりで、どうする？', items, { cancel: 1 });
  if (i === 0) {
    if (g.spend(price)) { F.courses = Math.min(3, (F.courses || 0) + 1); F.trying = true; F.last = g.state.day; await g.say('（お医者さんは、やさしく話を聞いてくれた。\n「ひとつずつ、一緒に考えましょう」…少し、気持ちが楽になった）'); }
    else await g.say('（費用が足りない…。もう少ししてから、また考えよう）');
  } else if (i === 1) { await g.say('（焦らず、待つことにした。ふたりの時間を、大切にしながら）'); }
  else if (i === 2) { await adoptFlow(g, rec, era === 'reiwa' && sameSex(g, rec) ? 'satooya' : 'tokubetsu'); }
  else { F.nokids = true; F.trying = false; addHist(g, 'ふたりの暮らしを、大切にすることにした'); await g.say('（ふたりで決めたことだ。それも、ひとつの家族のかたち）'); }
});
export async function adoptFlow(g, rec, kind) {
  const st = g.state, R = rom(g), era = eraOf(g);
  const date = (() => { try { return g.gameDate(); } catch (e) { return null; } })();
  const same = sameSex(g, rec);
  if (kind === 'tokubetsu') {
    if (same || rec.legal === false) { await g.say('（特別養子縁組は、法律上の夫婦であることが、条件になっている）'); return false; }
    if (date && date.year < 1988) { await g.say('（特別養子縁組の制度ができるのは、1988年から。いまは、まだ、ない）'); return false; }
    if (ageOf(st) < 25) { await g.say('（特別養子縁組は、養親が25歳以上であること（夫婦の一方が25歳以上なら、もう一方は20歳以上）が決まりだ…）'); return false; }
  }
  if (kind === 'satooya' && era !== 'reiwa') { await g.say('（いまの制度では、同性のカップルが里親になるのは、むずかしい）'); return false; }
  const name = kind === 'tokubetsu' ? '特別養子縁組' : '里親';
  const i = await g.ask([`${name}について、児童相談所で話を聞いてみる？`, kind === 'tokubetsu' ? '（生みの親が育てられない子どもを、法律上の「わが子」として迎える制度。家庭裁判所の審判を経て、実の親子と同じ関係になる）' : '（さまざまな事情で家で暮らせない子どもを、家庭で預かって育てる制度。研修と登録がある）'], ['話を聞いてみる', 'やめておく'], { cancel: 1 });
  if (i !== 0) return false;
  await playScene(g, { art: 'yakusho', title: '児童相談所', you: recLook(rec, eraOf(g)), bgm: 'rom_date', extra: { clerk: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#7ac85a', bottom: '#3a4a7a', skirt: true } } }, async () => {
    await sayAs(g, { name: '児童相談所の職員', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#7ac85a', bottom: '#3a4a7a', skirt: true } }, ['ご相談、ありがとうございます。\nまず、ご家庭のことや、お気持ちを、ゆっくり聞かせてください。', '研修や面談を重ねて、お子さんとの出会いを、ていねいに待ちます。']);
  });
  R.q.length < 8 && queueEvent(g, 'adopt_meet', { id: rec.id, kind }, 'adopt_meet');
  R.fert = R.fert || {}; R.fert.adopting = st.day;
  addHist(g, `${name}の相談を始めた`);
  await g.say('（面談や研修を重ねて、ご縁を待つことになった。しばらくして、連絡がくるはずだ）');
  return true;
}
onRomTick((g, R) => {
  const F = R.fert;
  if (!F || !F.adopting) return;
  const st = g.state;
  if (st.day - F.adopting >= 45) { F.adopting = 0; queueEvent(g, 'adopt_meet', { id: leadRec(g) ? leadRec(g).id : null, kind: F.kind || 'satooya' }, 'adopt_meet2'); }
});
onRomEvent('adopt_meet', async (g, d) => {
  const rec = recOf(g, d.id); if (!rec) return;
  const R = rom(g), st = g.state, era = eraOf(g);
  const gender = D.rngNext(R) < 0.5 ? 'm' : 'f';
  const who = { name: rec.n, look: recLook(rec, era) };
  const list = NAMES[era][gender];
  const nm = D.rngPick(R, list);
  await g.say(['（児童相談所から、連絡があった。\n「お会いしてもらいたいお子さんがいます」）', '（何度か、会いに通った。はじめは、人見知りしていた小さな子が、3回目に、笑ってくれた）']);
  const kid = { id: `k${R.kids.length + 1}${st.day}`, n: nm, g: gender, b: st.day - 100, ls: Math.floor(D.rngNext(R) * 1e6), by: 'adopt', d: { miya: 1, okui: 1 } };
  R.kids.push(kid);
  await sayAs(g, who, sl(rec, [`${nm}ちゃん、って呼んでいい？\nこれから、よろしく{ne}。`]));
  addHist(g, `${nm}を、家族として迎えた`);
  addAlbum(g, 'adopt', `${nm}、わが家の一員に`, { kid: kid.id });
  g.sfx('fanfare');
  await g.say([`${nm}が、わが家の家族になった！`, '（血のつながりより、いっしょに過ごす時間が、家族をつくっていく）']);
});

// ---------------------------------------------------------------- a little time with a child (the 家族 menu)
export async function playWithKid(g, k) {
  const st = g.state, rec = leadRec(g);
  if (k.pd === st.day) { await g.say('（今日は、もう、いっぱい遊んだ）'); return false; }
  if (st.stamina < 5) { await g.say('（体力が足りない…）'); return false; }
  const bw = blockReason(g);
  if (bw) { await g.say(`（${bw}）`); return false; }
  st.stamina -= 5;
  k.pd = st.day;
  const a = kidAge(g, k);
  await kidScene(g, k, 'park', '公園で遊ぶ', async (sc) => {
    await g.say(a < 1 ? [`（${k.n}を抱っこして、公園をゆっくり歩いた。
小さな手が、ぎゅっと服をつかんでいる）`] : a < 6 ? [`（${k.n}と、すべり台とブランコで遊んだ。
「もういっかい！」の声が、何度もひびく）`] : [`（${k.n}と、キャッチボール。
いつのまにか、ボールが、ずいぶん強くなった）`]);
    sc.burst(5);
  });
  g.relax({ stress: 10 });
  if (typeof g.advanceTime === 'function') g.advanceTime(60, '子どもと遊ぶ');
  if (rec && rec.st === 'married') rec.mo = clamp(rec.mo + 2, 0, 100);
  return true;
}

onRomEvent('kid_bday', async (g, d) => {
  const k = kidOf(g, d.kid); if (!k) return;
  const years = kidYears(g, k);
  if (years < 2) return; // (the first birthday has its own scene)
  const i = await g.ask(`${k.n}、${years}歳の誕生日。どうお祝いする？`, ['ケーキとごちそう（¥3,000）', 'プレゼントも用意する（¥8,000）', 'いつも通り、ささやかに'], { cancel: 2 });
  const cost = i === 0 ? 3000 : i === 1 ? 8000 : 0;
  if (cost && !g.spend(cost)) { await g.say('（お金が足りない…。ささやかに、ろうそくだけ立てた）'); }
  await kidScene(g, k, 'home', `${k.n}の誕生日`, async (sc) => {
    await g.say(i === 1 ? `（${years}本のろうそくを、ふーっと吹き消した。プレゼントの箱を、うれしそうに抱えている）` : `（${years}本のろうそくを、ふーっと吹き消した。みんなで「おめでとう！」）`);
    sc.burst(6);
  }, { hearts: true });
  g.relax({ stress: 8 });
  addAlbum(g, 'bday', `${k.n}、${years}歳の誕生日`, { kid: k.id });
});
