// 運転免許の流れ (scenes) — owner: R8-L1. Fills license.js' FLOW: enroll / desk / center, and the pieces the three places use
// (js/places/kyoshujo.js, menkyo.js, gassyuku.js): the lessons, 検定, 仮免学科, 卒業, the 免許センター procedure, 合宿の日々.
//
//   入所（適性検査）→ 第1段階（学科教習・所内技能）→ 修了検定 → 仮免学科試験 → 仮免許（6か月）→ 第2段階（路上教習・応急救護・危険予測）
//   → 卒業検定 → 卒業証明書（1年）→ 免許センター：適性検査 → 学科試験（90%以上）→ 写真・交付時講習 → 免許証の交付
//   失敗：補習 + 再検定（追加料金・翌日以降）、仮免・卒業証明書・教習の期限切れ、学科試験の再受験（1日1回）。
//
// Every menu puts the forward choice first (g.auto.choice = 0 walks the whole flow); each talk does one thing and returns (no loops).

import { PLACES } from './map.js';
import { LOOKS } from './sprites.js';
import { fmtMoney, clamp, shuffle } from './util.js';
import { audio } from './audio.js';
import { weekdayOf, weekOf } from './life.js';
import { ageOf, YEAR_DAYS } from './profile.js';
import {
  FLOW, CLASSES, CLASS_ORDER, SITES, SITE_ORDER, SCHOOL_NAME, CENTER_NAME, EXTRA_FEES, CAMP_DAYS, KARI_DAYS, CERT_DAYS, OPEN_FROM, OPEN_TO, TERM_DAYS,
  lic, note, eligible, schoolFee, prepaidRent, planFor, planOf, allSteps, stepList, hoshuStep, schoolOf, todayCounts, quota, completeStep, failExam, graduate,
  certValid, kariExpired, termExpired, progressText, stageOf, grantLicense, renewLicense, holds, runDriving, hmText, atAllowed, mtOnly, minAgeOf,
  centerClosed, ymNow, dateOfDay, dayText, PASS_LINE, KEN, expired, cardExpiry, eraId, num, has, safe,
} from './license.js';
import { lessonSet, asQuizQuestion } from './license_bank.js';
import { showLicenseCard } from './license_card.js';

// ======================================================================== people (all fictional)
const WHO = {
  uketsuke: { name: '受付の水野さん', look: { ...LOOKS.receptionist, top: '#2f9a8a' } },
  kyokan: { name: '岩城 教官', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#e8e8ee', bottom: '#2a3a5a', hat: '#2a3a5a', jacket: true } },
  kyokanF: { name: '千葉 教官', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#e8e8ee', bottom: '#2a3a5a', jacket: true } },
  gaku: { name: '桐生 教官', look: { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#3a4a6a', bottom: '#2a2a36', glasses: true, jacket: true } },
  kentei: { name: '榊原 検定員', look: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#1f3a6a', bottom: '#1f3a6a', hat: '#1f3a6a', glasses: 'sun', jacket: true } },
  c_uketsuke: { name: '総合受付の小松さん', look: { ...LOOKS.receptionist, top: '#3a6fb8' } },
  c_kakari: { name: '適性検査の係員', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#e8e8ee', bottom: '#4a5a6a', jacket: true } },
  c_shiken: { name: '試験官', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2a2f3a', bottom: '#2a2f3a', glasses: true, jacket: true } },
  c_koufu: { name: '交付窓口の浜田さん', look: { ...LOOKS.receptionist, top: '#6a4aa8', hairColor: 'black' } },
  ryobo: { name: '寮母のひろ子さん', look: { ...LOOKS.oldwoman, top: '#e8a0a0' } },
};
export { WHO };
const say = (g, t, who) => g.say(t, who ? { name: who.name, look: who.look } : {});
const ask = (g, t, ch, who, o = {}) => g.ask(t, ch, { ...(who ? { name: who.name, look: who.look } : {}), ...o });
const yen = (n) => fmtMoney(n);
const className = (s) => `${CLASSES[s.cls].name}${s.cls === 'futsu' || s.cls === 'futsu2' ? (s.mt ? '（MT）' : '（AT限定）') : ''}`;

// ======================================================================== small helpers
export const schoolPlace = (s) => (s && s.kind === 'gassyuku' ? 'gassyuku' : 'kyoshujo');
const nowMin = (g) => safe(() => g.clock().minutes, 600) ?? 600;
const waitTo = (g, min, why) => { if (has(g, 'advanceTo')) safe(() => g.advanceTo(min, why)); };
const passMin = (g, min, why) => { if (has(g, 'advanceTime') && min > 0) safe(() => g.advanceTime(min, why)); };
const SPOT = {
  lobby: { x: 8, y: 8, dir: 'up' }, kyoshitsu: { x: 6, y: 7, dir: 'up' }, course: { x: 4, y: 9, dir: 'right' }, simu: { x: 5, y: 6, dir: 'up' },
  tekisei: { x: 5, y: 6, dir: 'up' }, shiken: { x: 7, y: 6, dir: 'up' }, koufu: { x: 7, y: 7, dir: 'up' },
};
async function moveTo(g, place, room) {
  const sp = SPOT[room] || { x: undefined, y: undefined, dir: 'down' };
  if (g.map && g.map.placeId === place && g.map.roomId === room) return;
  await g.goto(place, room, sp.x, sp.y, sp.dir);
}
// a lesson's start: the school is open 9:00 – 19:00 (the last lesson starts by 18:00)
async function openCheck(g, who) {
  const m = nowMin(g);
  if (m >= OPEN_TO - 60) {
    await say(g, ['もう本日の受付は終わりです。', `教習は ${hmText(OPEN_FROM)} から ${hmText(OPEN_TO)} まで。あした、また来てくださいね。`], who);
    return false;
  }
  if (m < OPEN_FROM) { await say(g, `${hmText(OPEN_FROM)}から受付です。時間まで待ちましょう。`, who); waitTo(g, OPEN_FROM, '開館待ち'); }
  return true;
}
function record(g, text) { note(g, text); }
const stepOf = (g, id) => (id === 'hoshu' ? hoshuStep(g, schoolOf(g) && schoolOf(g).kari ? 2 : 1) : allSteps(g).find((x) => x.id === id));

// ======================================================================== 適性検査 (入所 and the 免許センター)
async function aptitude(g, who, label = '適性検査') {
  const look = g.state.look || {};
  const h = (() => { let x = 2166136261; for (const ch of String(g.state.name || '')) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619); } return x >>> 0; })();
  const wearing = !!look.glasses && look.glasses !== 'sun';
  const need = wearing || h % 4 === 0;
  await say(g, [`${label}をします。`, '視力、色の見分け、耳の聞こえ、体の動き。\n順番に進めますね。'], who);
  let out = {};
  let res = await g.minigame('license_check', { out, needGlasses: need, glasses: wearing, minutes: 15, title: label });
  let cond = need && wearing ? ['眼鏡等'] : [];
  if (!out.ok && out.vision < 0.7 && out.color && out.hearing && out.motor && need && !wearing) {
    await say(g, ['視力が基準に届きませんでした。', '眼鏡かコンタクトを使えば大丈夫ですよ。もう一度、やってみましょう。'], who);
    out = {};
    res = await g.minigame('license_check', { out, needGlasses: true, glasses: true, minutes: 10, title: `${label}（眼鏡等）` });
    cond = ['眼鏡等'];
  } else if (!out.ok) {
    const j = await ask(g, '基準に届かない検査がありました。\nもう一度、受けてみますか？', ['もう一度受ける', 'やめておく'], who, { cancel: 1 });
    if (j === 0) { out = {}; res = await g.minigame('license_check', { out, needGlasses: need, glasses: wearing, minutes: 10, title: label }); }
  }
  if (!out.ok) {
    await say(g, ['…すみません。今回は基準を満たせませんでした。', 'もう一度、日をあらためて受けてください。'], who);
    return { ok: false };
  }
  g.sfx('good');
  await say(g, `${label}は、すべて基準クリアです。${cond.length ? '\n免許の条件に「眼鏡等」がつきます。' : ''}`, who);
  return { ok: true, cond };
}

// ======================================================================== 入所
async function pickClass(g, auto) {
  const items = [];
  for (const id of CLASS_ORDER) {
    if (id === 'gentsuki') continue; // the 原付 has no school: 免許センターへ
    const e = eligible(g, id);
    items.push({ id, e, label: `${CLASSES[id].name}${e.ok ? '' : '（×）'}` });
  }
  if (auto) return auto;
  const lines = items.map((x) => `${CLASSES[x.id].name}：${x.e.ok ? `通学${yen(schoolFee(x.id, 'tsugaku', true))}〜` : x.e.why}`).join('\n');
  const ok = items.filter((x) => x.e.ok);
  if (!ok.length) { await say(g, ['いまの年齢や免許では、受けられるコースがありません。', lines], WHO.uketsuke); return null; }
  const i = await ask(g, `どの免許をとりますか？\n${lines}`, [...ok.map((x) => CLASSES[x.id].name), 'やめておく'], WHO.uketsuke, { cancel: ok.length });
  if (i < 0 || i >= ok.length) return null;
  return ok[i].id;
}
async function enroll(g, opts = {}) {
  const L = lic(g);
  const st = g.state;
  if (L.school) { await say(g, `いま${className(L.school)}の教習中です。\nまずはそちらを卒業しましょう。`, WHO.uketsuke); return { ok: false, reason: 'enrolled' }; }
  const why = safe(() => g.lifeRefusal(), null);
  if (why) { await say(g, why); return { ok: false, reason: 'tired' }; }
  const cls = await pickClass(g, opts.cls);
  if (!cls) return { ok: false, reason: 'cancel' };
  if (!CLASSES[cls] || !CLASSES[cls].school) { await say(g, ['原付免許は、教習所では教えていないんです。', '免許センターで、学科試験と原付講習（3時間）を受けると取れますよ。'], WHO.uketsuke); return { ok: false, reason: 'noschool' }; }
  const el = eligible(g, cls);
  if (!el.ok) { await say(g, el.why, WHO.uketsuke); return { ok: false, reason: 'age' }; }
  const ym = ymNow(g);
  // AT / MT
  let mt = true;
  if (cls === 'futsu' || cls === 'futsu2') {
    if (atAllowed(ym)) {
      if (opts.mt != null) mt = !!opts.mt;
      else {
        const i = await ask(g, 'AT限定か、MT（マニュアル）か。\nAT限定は取得が早く、安い。ただしMT車には乗れません。', ['AT限定', 'MT（マニュアル）'], WHO.uketsuke, { cancel: 0 });
        mt = i === 1;
      }
    } else mt = true;
  }
  // 通学 / 合宿
  let kind = opts.kind;
  if (!kind) {
    const camp = schoolFee(cls, 'gassyuku', mt, 'zao');
    const days = mt ? CAMP_DAYS.mt : CAMP_DAYS.at;
    const i = await ask(g, [`通学：${yen(schoolFee(cls, 'tsugaku', mt))}（予約して通う。1〜3か月かかる）`, `合宿：${yen(camp)}〜（宿泊・食事つき。最短${mt ? 16 : 14}日間＝${days}日）`].join('\n'), ['通学', '合宿', 'やめておく'], WHO.uketsuke, { cancel: 2 });
    if (i === 2 || i < 0) return { ok: false, reason: 'cancel' };
    kind = i === 1 ? 'gassyuku' : 'tsugaku';
  }
  let site = null;
  if (kind === 'gassyuku') {
    site = opts.site;
    if (!site) {
      const i = await ask(g, SITE_ORDER.map((id) => `${SITES[id].name}：${SITES[id].desc}`).join('\n'), SITE_ORDER.map((id) => `${SITES[id].short}（+${yen(SITES[id].extra)}）`), WHO.uketsuke, { cancel: 0 });
      site = SITE_ORDER[clamp(i, 0, SITE_ORDER.length - 1)];
    }
  }
  const fee = schoolFee(cls, kind, mt, site);
  const days = kind === 'gassyuku' ? (mt ? CAMP_DAYS.mt : CAMP_DAYS.at) : 0;
  const rent = kind === 'gassyuku' ? prepaidRent(g, days + 2) : { amount: 0, weeks: 0, week: weekOf(st.day) };
  const fare = kind === 'gassyuku' ? SITES[site].fare : 0;
  const total = fee + rent.amount + fare;
  const lines = [`${CLASSES[cls].long}${cls === 'futsu' || cls === 'futsu2' ? (mt ? '（MT）' : '（AT限定）') : ''}`, `${kind === 'gassyuku' ? `合宿（${SITES[site].name}）` : '通学'}　教習料金 ${yen(fee)}`];
  if (kind === 'gassyuku') lines.push(`交通費 ${yen(fare)}${rent.amount ? `　家賃の前払い ${yen(rent.amount)}（${rent.weeks}週分）` : ''}`, '※留守のあいだ、レギュラーは休みあつかい。ペナルティはありません。');
  if (el.special) lines.push('※普通第二種の受験資格特例教習（追加）を受けます。');
  lines.push(`合計 ${yen(total)}　所持金 ${yen(st.money)}`);
  if (st.money < total) { await say(g, [lines.join('\n'), `お金が足りません。${kind === 'gassyuku' ? '合宿は一括でのお支払いです。' : ''}\nそろってから、また来てください。`], WHO.uketsuke); return { ok: false, reason: 'money' }; }
  const go = opts.confirm === false ? 0 : await ask(g, lines.join('\n'), ['この内容で申し込む', 'やめておく'], WHO.uketsuke, { cancel: 1 });
  if (go !== 0) return { ok: false, reason: 'cancel' };
  if (kind === 'gassyuku') {
    const bad = (has(g, 'justiceRefusal') && g.justiceRefusal('job', { id: 'license_camp' })) || (has(g, 'politicsRefusal') && g.politicsRefusal('job', { id: 'license_camp' })) || (has(g, 'contestToday') && [].concat(g.contestToday() || []).length ? '今日は賞レースの本番があります。' : null);
    if (bad) { await say(g, [].concat(bad).join('\n') + '\n（合宿に出かけられる状態ではないようだ）'); return { ok: false, reason: 'busy' }; }
  }
  // 入所手続き + 適性検査
  await say(g, ['入所の手続きをします。', '申込書と、本人確認の書類を。…はい、確かに。', '最初に、適性検査を受けてもらいますね。'], WHO.uketsuke);
  await g.fadeOut(10); await g.wait(250); await g.fadeIn(10);
  const apt = await aptitude(g, WHO.c_kakari ? { name: '適性検査の先生', look: WHO.c_kakari.look } : WHO.uketsuke, '適性検査');
  if (!apt.ok) return { ok: false, reason: 'aptitude' };
  if (!g.spend(fee)) return { ok: false, reason: 'money' };
  g.sfx('coin');
  L.school = null;
  const s = {
    cls, mt, kind, site, enrolled: st.day, fee, done: {}, ken1: 0, kari: 0, ken2: 0, cert: 0, fails: { ken1: 0, kari: 0, ken2: 0 }, need: { hoshu: 0 },
    t: { day: 0, gi: 0, gaku: 0, ken: 0 }, lastLesson: 0, cond: apt.cond, special: !!el.special, booking: null, camp: null, score: { gaku: 0, n: 0 }, gradDay: 0,
  };
  if (kind === 'gassyuku') s.camp = { start: st.day, planned: days, extra: 0, day: 1, arrived: false, end: 0, prepaid: rent.amount };
  L.school = s;
  lic(g); // (re-repair)
  record(g, `${SCHOOL_NAME}に入所した（${CLASSES[cls].name}・${kind === 'gassyuku' ? '合宿' : '通学'}）。`);
  g.sfx('fanfare');
  if (kind === 'tsugaku') {
    await say(g, [`入所おめでとうございます！　${className(s)}の${yen(fee)}、お預かりしました。`, '教習は予約制です。受付か、スマホの「教習予約」から、学科と技能を予約してください。', `仮免許を取ったら第2段階。教習の有効期間は入所から9か月です。\n${atAllowed(ymNow(g)) ? '' : ''}`.trim()], WHO.uketsuke);
    return { ok: true, school: s };
  }
  // 合宿: pay the rent in advance, leave for the camp
  if (rent.amount) { st.money = Math.max(0, st.money - rent.amount); st.rent.paidWeek = Math.max(st.rent.paidWeek, rent.week); }
  st.money = Math.max(0, st.money - fare);
  await say(g, [`それでは${SITES[site].name}へ。お気をつけて！`, `合宿は ${days} 日間（約${mt ? 16 : 14}日）。宿泊と食事がついています。`, '途中で検定に落ちると、延泊になります。'], WHO.uketsuke);
  await goCamp(g);
  return { ok: true, school: s };
}

// ======================================================================== 合宿
async function goCamp(g) {
  const s = schoolOf(g);
  const site = SITES[s.site] || SITES.zao;
  await g.fadeOut(16);
  g.sfx('door');
  passMin(g, 240, '新幹線とバスで移動');
  await g.wait(900);
  s.camp.arrived = true;
  s.camp.start = g.state.day;
  s.camp.day = 1;
  await g.goto('gassyuku', 'yard', undefined, undefined, 'up');
  await g.say([`${site.name}に着いた。`, site.desc, '入校式のあと、寮の部屋に案内される。', '（本館の受付で「今日のカリキュラム」を。夜は寮の部屋で寝ると、次の日になる）']);
  g.save(true);
}
// one night in the dorm: the next camp day
async function campSleep(g) {
  const s = schoolOf(g);
  if (!s || !s.camp || !s.camp.arrived) { await g.say('（ここでは眠れない）'); return false; }
  const i = await g.ask(`${s.camp.day}日目も終わりだ。\n寝て、次の日にする？`, ['寝る', 'まだ起きている'], { cancel: 1 });
  if (i !== 0) return false;
  await g.fadeOut(20);
  g.sfx('sleep');
  await g.wait(900);
  const st = g.state;
  st.day++;
  const Lf = st.life;
  Lf.hunger = clamp(Math.max(Lf.hunger, 55), 0, 80);
  Lf.clean = clamp(Lf.clean + 20, 0, 100);
  Lf.stress = clamp(Lf.stress - 8, 0, 100);
  Lf.workDay = st.day;
  st.stamina = st.maxStamina;
  const warned = Lf.warned && typeof Lf.warned === 'object' ? Lf.warned : (Lf.warned = {});
  warned.stress = warned.burnout = st.day;
  // ((rent was paid in advance; the regular shows and the morning hooks wait; no penalty)
  if (((st.day - 1) % 7) === 0 && st.rent.paidWeek < weekOf(st.day) && s.camp.prepaid) st.rent.paidWeek = weekOf(st.day);
  s.camp.day++;
  s.camp.meals = 0;
  s.camp.vignette = 0;
  const over = s.camp.day - s.camp.planned - s.camp.extra;
  if (over > 0 && !s.cert) { s.camp.extra += over; st.money = Math.max(0, st.money - EXTRA_FEES.extendDay * over); }
  await g.wait(300);
  await g.goto('gassyuku', 'room', 4, 4, 'down');
  await g.fadeIn(20);
  const dayN = s.camp.day;
  g.notify(`合宿 ${dayN}日目の朝　7:00`, { color: '#fff' });
  await g.say([`合宿 ${dayN}日目の朝。`, over > 0 && !s.cert ? `予定の日数をこえて、延泊になった。（1日 ${yen(EXTRA_FEES.extendDay)}）` : (s.cert ? '卒業検定には合格した。きょうが帰る日だ。' : 'さあ、今日もカリキュラムをこなそう。')]);
  g.save(true);
  return true;
}
async function campGate(g) {
  const s = schoolOf(g);
  if (!s || !s.camp || !s.camp.arrived) return;
  if (s.cert) {
    const i = await ask(g, '卒業おめでとうございます。\n荷物をまとめて、帰りますか？', ['帰る', 'もう少しいる'], WHO.ryobo, { cancel: 1 });
    if (i !== 0) return;
    await leaveCamp(g, true);
    return;
  }
  const i = await ask(g, 'まだ卒業していませんが、帰りますか？', ['やめておく', '通学に切りかえて帰る', '退所して帰る（返金なし）'], WHO.ryobo, { cancel: 0 });
  if (i === 1) {
    const fee = EXTRA_FEES.switchToTsugaku;
    if (g.state.money < fee) { await say(g, `切りかえには ${yen(fee)} かかります。お金が足りません。`, WHO.ryobo); return; }
    g.spend(fee);
    s.kind = 'tsugaku';
    s.camp = null;
    s.t = { day: 0, gi: 0, gaku: 0, ken: 0 };
    record(g, '合宿を途中でやめ、通学に切りかえた。');
    await say(g, ['通学に切りかえますね。ここまでの教習はそのまま引き継ぎます。', '東京のドット自動車教習所で、続きを予約してください。'], WHO.ryobo);
    await leaveCamp(g, false);
  } else if (i === 2) {
    const j = await ask(g, '退所すると、ここまでの教習は無効になります。\n本当に？', ['やっぱりやめる', '退所する'], WHO.ryobo, { cancel: 0 });
    if (j !== 1) return;
    lic(g).school = null;
    record(g, '合宿を途中でやめた。');
    await leaveCamp(g, false);
  }
}
async function leaveCamp(g, graduated) {
  const s = schoolOf(g);
  await g.fadeOut(16);
  g.sfx('door');
  passMin(g, 240, '新幹線とバスで移動');
  await g.wait(900);
  if (s && s.camp) { s.camp.arrived = false; s.camp.end = g.state.day; }
  // the dorm's days are over: the needs settle
  g.state.life.hunger = clamp(g.state.life.hunger, 30, 90);
  const doorTown = PLACES.tokyo ? 'tokyo' : null;
  if (PLACES.kyoshujo) await g.goto('kyoshujo', 'lobby', SPOT.lobby.x, SPOT.lobby.y, 'up');
  else if (doorTown) await g.goto('tokyo', 'main');
  await g.say(graduated ? ['東京に帰ってきた。', '免許センターで学科試験（本免）を受けると、いよいよ免許証だ。'] : '東京に帰ってきた。');
  g.save(true);
}
// camp evenings: small scenes in the 談話室 (fictional classmates)
const MATES = [
  { id: 'yuta', name: 'ユウタ', look: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#2f6fd0', bottom: '#2a2d36' } },
  { id: 'sakura', name: 'サクラ', look: { hair: 'twin', hairColor: 'black', skin: 'light', top: '#ff9ab8', bottom: '#3a4a7a', skirt: true } },
  { id: 'tetsu', name: 'テツ', look: { hair: 'cap', hat: '#2a3a2a', hairColor: 'black', skin: 'tan', top: '#8a7a3a', bottom: '#2a2d36' } },
  { id: 'riko', name: 'リコ', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#7a4ab8', bottom: '#2a2d36' } },
];
export { MATES };
const VIGNETTES = [
  (s) => [['ユウタ', '教習のあとの食堂のカレー、やたらおいしくない？', 'わかる。ご飯のおかわり自由なのがずるい。'], '夜の談話室。ジュースをのみながら、今日の教習のことを話した。'],
  (s) => [['サクラ', 'クランクで脱輪しちゃったの…。教官に「落ち着いて」って言われた。', 'だいじょうぶ、ゆっくり行けば入るよ。'], 'お互いの失敗談で、すこし気が楽になった。'],
  (s) => [['テツ', '明日の検定、緊張して眠れそうにない…。', '持ち点は100点。ひとつずつ、確認すればいけるって。'], '窓の外に、星がきれいに見えた。'],
  (s) => [['リコ', 'ここに来て2日で、免許を取った気分になってるんだけど。', '気がゆるむのがいちばん危ない、って教官も言ってたよ。'], 'ほかの教習生と、トランプで盛り上がった。'],
  (s) => [['ユウタ', 'みんなで卒業できたらいいね。', '合宿の友だちって、ふしぎと長く続くらしいよ。'], 'この数日で、顔なじみがたくさんできた。'],
  (s) => [['寮母のひろ子さん', '夜ふかししすぎないでね。あしたも早いんだから。', 'おやすみなさい。あったかいお茶、置いておくわね。'], '寮の廊下の灯りが、ひとつずつ消えていった。'],
];
async function campVignette(g) {
  const s = schoolOf(g);
  if (!s || !s.camp) return;
  if (s.camp.vignette) { await g.say('もう消灯の時間が近い。部屋に戻ろう。'); return; }
  s.camp.vignette = 1;
  const v = VIGNETTES[(s.camp.day - 1 + (s.cls.length)) % VIGNETTES.length](s);
  const mate = MATES.find((m) => m.name === v[0][0]) || { name: v[0][0], look: WHO.ryobo.look };
  await g.say(v[0][1], { name: mate.name, look: mate.look });
  await g.say(v[0][2], { name: g.state.name });
  g.relax({ stress: 8 });
  await g.say(v[1]);
}
async function campMeal(g) {
  const s = schoolOf(g);
  if (!s || !s.camp) return;
  const m = nowMin(g);
  const slot = m < 600 ? 0 : m < 960 ? 1 : 2;
  const names = ['朝ごはん', '昼ごはん', '夕ごはん'];
  if (s.camp.slotsDay !== g.state.day) { s.camp.slots = []; s.camp.slotsDay = g.state.day; }
  if (s.camp.slots.includes(slot)) { await say(g, `今日の${names[slot]}は、もう食べたでしょう？`, WHO.ryobo); return; }
  if (!g.canEat()) { await say(g, 'おなかがいっぱいみたいね。あとで来てね。', WHO.ryobo); return; }
  s.camp.slots.push(slot);
  g.sfx('eat');
  await g.say(['食堂の定食だ。ご飯のおかわりは自由！', slot === 2 ? '夕食は、ほかの教習生もそろってにぎやかだ。' : '']);
  g.eat(32, { silent: true });
  passMin(g, 25, '食事');
  g.relax({ stress: 3 });
}

// ======================================================================== a lesson / a test
const GI_TEXT = {
  'lesson1/basic': ['今日は、発進と停止、ハンドル操作の基本です。', 'シート、ミラー、シートベルトを合わせて。\n発進は「安全確認、合図、発進」の順番で。', 'まず場内を、ゆっくり一周しましょう。'],
  'lesson1/clutch': ['MT車は、クラッチ操作がかなめです。', 'クラッチペダルを踏んで、ギアを入れて、ゆっくり足を戻す。\n半クラッチの位置を、足で覚えて。', 'エンストしても気にしない。何度でもやりましょう。'],
  'lesson1/second': ['お客さまを乗せるつもりで運転しましょう。', '発進も停止も、ふんわり。急ブレーキは禁物です。', '二種の検定は、一種より厳しく見ますよ。'],
  'crank/crank': ['クランクとS字は、車の幅と内輪差の感覚をつかむ練習です。', '曲がり角の手前で十分に減速して、タイヤの位置を意識して。\n脱輪しそうなら、いったん止まってやり直して構いません。'],
  'crank/second': ['クランクを、お客さまが揺れないように通りましょう。', '速度は一定に。ハンドルは大きく、でもなめらかに。'],
  'park/park': ['方向変換と縦列駐車です。', 'ミラーと目視で、後ろの安全を確かめながら。\n焦らず、ハンドルを切るタイミングを覚えましょう。'],
  'hill/hill': ['坂道発進と、踏切の通過の練習です。', '坂道では、ずり下がらないようにブレーキとアクセルを合わせて。\n踏切は、一時停止して、窓を開けて音を確かめて。'],
  'hill/second': ['坂道と踏切です。お客さまが乗っているので、発進は特にやさしく。'],
  'road/city': ['いよいよ路上に出ます。', '標識と信号をよく見て、歩行者や自転車に気を配って。\n仮免許の練習中の標識を、車につけましたね？'],
  'road/crossing': ['今日は交差点を中心に走ります。', '右折、左折、一時停止。\n「合図、確認、ハンドル」を、忘れないで。'],
  'second/city': ['営業走行を想定した路上教習です。', '客待ち、乗降、行き先の確認。\n安全第一で、お客さまに不安を感じさせない運転を。'],
  'second/passenger': ['お客さまの乗り降りの練習です。', '停める位置、ドアの開閉の合図、後方の安全確認。\n全部、声に出すつもりで。'],
  'moto/basic': ['二輪の基本は、車体を起こす・支える・押して歩く、です。', 'ヘルメットのあごひもを締めて。まずは、ゆっくり発進と停止から。'],
  'moto/ippon': ['一本橋です。', 'ふらつかないように視線を遠く。クラッチとアクセルで、ゆっくりバランスを取って。'],
  'moto/slalom': ['スラロームです。', 'ハンドルでなく、体重移動で曲がるイメージで。'],
  'moto/ouyou': ['応用走行です。急制動とコース走行をやります。', '前後のブレーキを同時に、まっすぐ止まって。'],
};
function giLines(drv) {
  return GI_TEXT[`${drv.stage}/${drv.course}`] || GI_TEXT[`${drv.stage}/${drv.stage}`] || ['車の運転の練習です。安全第一で、一緒にやりましょう。'];
}
function dedText(d) {
  if (!d || !d.length) return '';
  return d.slice(0, 4).map((x) => `${x.what}（${x.pts <= -100 || x.pts >= 100 ? '−100' : `−${Math.abs(x.pts)}`}）`).join('　');
}
function feeFor(g, id) {
  const s = schoolOf(g);
  if (!s) return 0;
  if (id === 'ken1' && s.fails.ken1) return EXTRA_FEES.ken1;
  if (id === 'ken2' && s.fails.ken2) return EXTRA_FEES.ken2;
  if (id === 'kari' && s.fails.kari) return EXTRA_FEES.kari;
  return 0;
}
async function attend(g, step) {
  const s = schoolOf(g);
  const place = schoolPlace(s);
  const rows = stepList(g);
  const mine = rows.find((r) => r.step.id === step.id);
  if (!mine || mine.state !== 'open') { await say(g, mine && mine.why ? mine.why : 'それは、いまは受けられません。', WHO.uketsuke); return { ok: false }; }
  if (!(await openCheck(g, WHO.uketsuke))) return { ok: false };
  const fee = feeFor(g, step.id);
  if (fee) {
    const i = await ask(g, `再受験です。料金は ${yen(fee)}。\nお支払いして受けますか？`, ['受ける', 'やめておく'], WHO.uketsuke, { cancel: 1 });
    if (i !== 0) return { ok: false };
    if (!g.spend(fee)) { await say(g, 'お金が足りません。', WHO.uketsuke); return { ok: false }; }
    g.sfx('coin');
  }
  // the school's tired-check: nothing demanding at the limit
  const why = safe(() => g.lifeRefusal(), null);
  if (why) { await say(g, why); return { ok: false }; }
  if (step.type === 'gaku') return attendGaku(g, step, place);
  if (step.type === 'gi') return attendGi(g, step, place);
  if (step.id === 'kari') return attendKari(g, step, place);
  return attendKen(g, step, place);
}
async function attendGaku(g, step, place) {
  const s = schoolOf(g);
  await moveTo(g, place, 'kyoshitsu');
  const ym = ymNow(g);
  const qs = lessonSet(step.cats, ym, 4);
  await say(g, [`学科教習「${step.label}」を始めます。`, ...qs.slice(0, 2).map((q) => `【ポイント】${q.why}`), '最後に、確認問題を解いてみましょう。○か×で答えてください。'], WHO.gaku);
  const res = await g.minigame('quiz', { questions: qs.map(asQuizQuestion), count: qs.length, shuffle: false, time: 12, hints: 0, show: `学科教習　${step.label}`, genre: '学科', minutes: step.minutes, difficulty: 1, title: `学科教習　${step.label}`, format: 'classic' });
  const sc = num(res && res.score, 60);
  s.score.gaku += sc; s.score.n++;
  completeStep(g, step);
  g.lifeTick({ stress: 2, hunger: -3 });
  g.sfx('good');
  await say(g, sc >= 70 ? ['よくできました。', 'このあたりは、仮免の試験にも出ますよ。'] : ['お疲れさま。まちがえたところは、復習しておいてくださいね。', '試験に出る問題は、スマホの「クイズ」アプリでも練習できますよ。'], WHO.gaku);
  record(g, `学科教習「${step.label}」を受けた。`);
  return { ok: true, done: true };
}
async function attendGi(g, step, place) {
  const s = schoolOf(g);
  await moveTo(g, place, 'course');
  const who = s.cls === 'futsu2' ? WHO.kyokan : (g.state.day % 2 ? WHO.kyokan : WHO.kyokanF);
  await say(g, [`技能教習「${step.label}」です。`, ...giLines(step.drv)], who);
  const r = await runDriving(g, { ...step.drv, practice: true, difficulty: s.cls === 'futsu2' ? 2 : 1, mt: s.mt || step.drv.mt, second: s.cls === 'futsu2', title: `技能教習　${step.label}`, minutes: step.minutes });
  const ok = r.points >= 50;
  g.lifeTick({ stress: 4, hunger: -5 });
  if (ok) {
    completeStep(g, step);
    g.sfx('good');
    await say(g, [r.points >= 90 ? 'いい運転でした。文句なしです。' : r.points >= 70 ? 'よくできました。この調子で。' : 'ぎりぎりですが、合格点。次はもう少し丁寧にいきましょう。', r.deductions.length ? `気になった点：${dedText(r.deductions)}` : ''].filter(Boolean), who);
    record(g, `技能教習「${step.label}」を受けた（${r.points}点）。`);
    return { ok: true, done: true, points: r.points };
  }
  todayCounts(s, g.state.day).gi++;
  s.lastLesson = g.state.day;
  await say(g, ['うーん、今日は危ない場面が多かったですね。', r.deductions.length ? `気になった点：${dedText(r.deductions)}` : '', 'もう一度、同じ項目をやりましょう。'].filter(Boolean), who);
  return { ok: true, done: false, points: r.points };
}
async function attendKen(g, step, place) {
  const s = schoolOf(g);
  const first = step.id === 'ken1';
  await moveTo(g, place, 'course');
  const line = PASS_LINE(s.cls);
  await say(g, [`${step.label}を始めます。`, `持ち点は100点からの減点方式。${line}点以上で合格です。`, first ? '所内コースを、指示どおりに走ってください。' : '路上コースです。交通ルールを守って、安全に。', '一時停止や信号無視は、その場で検定中止になりますよ。'], WHO.kentei);
  const drv = first
    ? (CLASSES[s.cls].vehicle === 'moto' ? { stage: 'moto', course: 'kentei1' } : { stage: 'kentei1', course: 'kentei1' })
    : (CLASSES[s.cls].vehicle === 'moto' ? { stage: 'moto', course: 'kentei2' } : { stage: s.cls === 'futsu2' ? 'second' : 'kentei2', course: 'kentei2' });
  const r = await runDriving(g, { ...drv, practice: false, exam: true, difficulty: first ? 2 : 3, mt: s.mt, second: s.cls === 'futsu2', passLine: line, title: step.label, minutes: step.minutes });
  g.lifeTick({ stress: 8, hunger: -6 });
  const stats = lic(g).stats;
  stats.exams++;
  await say(g, `${step.label}の結果です。…${r.points}点。`, WHO.kentei);
  if (r.passed && r.points >= line) {
    stats.passes++;
    completeStep(g, step);
    g.sfx('fanfare');
    if (r.deductions.length) await say(g, `減点：${dedText(r.deductions)}`, WHO.kentei);
    if (first) {
      await say(g, ['合格です。おめでとう。', '続けて、仮免許の学科試験を受けられますよ。（今日でも、次の機会でも）'], WHO.kentei);
      record(g, `修了検定に合格（${r.points}点）。`);
    } else {
      await say(g, ['合格です。卒業検定、おめでとう。', '路上でも、落ち着いた運転でした。'], WHO.kentei);
      graduate(g);
      await graduationScene(g, place);
    }
    return { ok: true, done: true, points: r.points, passed: true };
  }
  failExam(g, step.id);
  g.sfx('fail');
  await say(g, [r.deductions.length ? `減点：${dedText(r.deductions)}` : '', `残念ながら、不合格です。（${line}点以上が合格）`, `補習（技能教習）を受けてから、また検定を受けましょう。\n再検定の料金は ${yen(step.id === 'ken1' ? EXTRA_FEES.ken1 : EXTRA_FEES.ken2)}。`].filter(Boolean), WHO.kentei);
  record(g, `${step.label}は不合格（${r.points}点）。`);
  return { ok: true, done: false, points: r.points, passed: false };
}
async function attendKari(g, step, place) {
  const s = schoolOf(g);
  await moveTo(g, place, 'kyoshitsu');
  const kind = CLASSES[s.cls].vehicle === 'moto' ? 'nirin' : s.cls === 'futsu2' ? 'second' : 'kari';
  await say(g, ['仮免許の学科試験です。', '50問。○か×で答えます。90%以上で合格です。', 'それでは、始めてください。'], WHO.gaku);
  const out = {};
  const res = await g.minigame('license_exam', { kind, count: 50, out, minutes: 30, title: '仮免許 学科試験' });
  g.lifeTick({ stress: 6, hunger: -4 });
  const stats = lic(g).stats;
  stats.exams++;
  const pass = res.success && out.pass !== false;
  await say(g, `結果：${out.total}問中${out.correct}問正解。`, WHO.gaku);
  if (pass) {
    stats.passes++;
    completeStep(g, step);
    g.sfx('fanfare');
    await say(g, ['合格です。おめでとう。', `仮免許証をお渡しします。有効期間は6か月（${dayText(g, g.state.day + KARI_DAYS)}まで）。`, '路上では、「仮免許練習中」の標識を忘れずに。第2段階では、路上教習と応急救護などの学科を受けます。'], WHO.gaku);
    record(g, '仮免許を取得した。');
    return { ok: true, done: true, passed: true };
  }
  failExam(g, 'kari');
  g.sfx('fail');
  await reviewWrong(g, out);
  await say(g, ['残念ながら、不合格です。', `また日をあらためて受けましょう。（再受験料 ${yen(EXTRA_FEES.kari)}）`], WHO.gaku);
  record(g, '仮免学科試験は不合格。');
  return { ok: true, done: false, passed: false };
}
async function reviewWrong(g, out) {
  const w = (out && out.wrong ? out.wrong : []).filter((x) => x.yours !== null).slice(0, 3);
  if (!w.length) return;
  const pages = w.map((x) => `まちがえた問題：\n${x.q}\n正解は「${x.a ? '○' : '×'}」。${x.why}`);
  await say(g, ['まちがえた問題を、いくつか見ておきましょう。', ...pages], WHO.gaku || undefined);
}
async function graduationScene(g, place) {
  const s = schoolOf(g);
  g.sfx('fanfare');
  await g.say(['卒業証明書を受け取った。', `${className(s)}の卒業。有効期間は1年（${dayText(g, g.state.day + CERT_DAYS)}まで）。`, '次は、免許センターで学科試験（本免）に合格すれば、免許証がもらえる。']);
  if (s.kind === 'gassyuku') await g.say('合宿の仲間と、写真を撮った。あしたの朝、帰ることになる。');
}

// ======================================================================== bookings (通学)
function slotsToday(g) {
  const m = nowMin(g);
  return [600, 780, 960, 1080].filter((x) => x > m - 30 && x <= OPEN_TO - 60);
}
export function bookStep(g, stepId, dayOffset, min) {
  const s = schoolOf(g);
  if (!s || s.kind !== 'tsugaku') return { ok: false, why: '通学の予約ではありません。' };
  if (s.booking) return { ok: false, why: `すでに予約があります（${s.booking.day === g.state.day ? '今日' : dayText(g, s.booking.day)} ${hmText(s.booking.min)}）。` };
  const step = stepOf(g, stepId);
  if (!step) return { ok: false, why: 'そのコマはありません。' };
  const day = g.state.day + dayOffset;
  s.booking = { step: stepId, day, min };
  return { ok: true, day, min };
}
export function cancelBooking(g) {
  const s = schoolOf(g);
  if (!s || !s.booking) return false;
  s.booking = null;
  return true;
}
async function checkBooking(g) {
  const s = schoolOf(g);
  if (!s || !s.booking) return null;
  const b = s.booking;
  const day = g.state.day;
  const step = stepOf(g, b.step);
  const label = step ? step.label : '教習';
  if (b.day < day || (b.day === day && nowMin(g) > b.min + 45)) {
    s.booking = null;
    const fee = EXTRA_FEES.cancel;
    g.state.money = Math.max(0, g.state.money - fee);
    await say(g, [`「${label}」のご予約、${b.day === day ? '時間を過ぎてしまいました' : '来られませんでしたね'}。`, `無断キャンセルの料金 ${yen(fee)} をいただきます。次は、連絡をお願いしますね。`], WHO.uketsuke);
    return { missed: true };
  }
  if (b.day === day) return { today: true, step, min: b.min };
  return { future: true, step, day: b.day, min: b.min };
}

// ======================================================================== the desk
function stepChoiceLabel(r) {
  const x = r.step;
  const kind = x.type === 'gaku' ? '学科' : x.type === 'gi' ? '技能' : '検定';
  return `${kind}　${x.label}`;
}
async function pickStep(g, onlyType) {
  const rows = stepList(g).filter((r) => r.state === 'open' && (!onlyType || onlyType.includes(r.step.type)));
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0].step;
  const i = await ask(g, 'どれを受けますか？', [...rows.map(stepChoiceLabel), 'やめる'], WHO.uketsuke, { cancel: rows.length });
  if (i < 0 || i >= rows.length) return null;
  return rows[i].step;
}
function whyNone(g) {
  const rows = stepList(g).filter((r) => r.state !== 'done');
  const w = rows.find((r) => r.state === 'quota' || r.state === 'wait') || rows[0];
  return w && w.why ? w.why : '今日受けられる教習は、もうありません。';
}
async function takeLesson(g, type, who) {
  const s = schoolOf(g);
  const step = await pickStep(g, type);
  if (!step) { await say(g, [whyNone(g), s.kind === 'tsugaku' ? '予約は、またあした以降にも入れられますよ。' : ''].filter(Boolean), who || WHO.uketsuke); return { ok: false }; }
  if (s.kind === 'tsugaku' && step.type !== 'hoshu' && !s.booking && !g.auto) {
    const sl = slotsToday(g);
    const opts = [];
    if (sl.length) opts.push('今日、いますぐ受ける');
    opts.push('あした以降に予約する');
    opts.push('やめる');
    const i = await ask(g, `「${stepChoiceLabel({ step })}」ですね。`, opts, who || WHO.uketsuke, { cancel: opts.length - 1 });
    if (i < 0 || i === opts.length - 1) return { ok: false };
    if (opts[i].startsWith('あした')) return bookingMenu(g, step, who);
  }
  return attend(g, step);
}
async function bookingMenu(g, step, who) {
  const d = await ask(g, '何日後にしますか？', ['あした', 'あさって', '3日後', '次の週末', 'やめる'], who || WHO.uketsuke, { cancel: 4 });
  if (d < 0 || d > 3) return { ok: false };
  let off = [1, 2, 3][d];
  if (d === 3) { off = 1; while (weekdayOf(g.state.day + off) < 5 && off < 8) off++; }
  const t = await ask(g, '時間は？', ['10:00', '13:00', '16:00', '18:00'], who || WHO.uketsuke, { cancel: 0 });
  const min = [600, 780, 960, 1080][clamp(t, 0, 3)];
  const r = bookStep(g, step.id, off, min);
  if (!r.ok) { await say(g, r.why, who || WHO.uketsuke); return { ok: false }; }
  g.sfx('chime');
  await say(g, [`ご予約を承りました。\n${dayText(g, r.day)}（${'月火水木金土日'[weekdayOf(r.day)]}） ${hmText(min)}　${stepChoiceLabel({ step })}`, '時間に遅れると、無断キャンセルになります。'], who || WHO.uketsuke);
  return { ok: true, booked: true };
}
async function schoolDesk(g) {
  const L = lic(g);
  const s = L.school;
  const w = WHO.uketsuke;
  if (!s) {
    const i = await ask(g, `ようこそ、${SCHOOL_NAME}へ。\nご用件は？`, ['入所の申し込み', 'コースと料金の説明', '免許の取り方を聞く', 'やめる'], w, { cancel: 3 });
    if (i === 0) return enroll(g, {});
    if (i === 1) return courseInfo(g);
    if (i === 2) return flowInfo(g);
    return { ok: false };
  }
  if (s.kind === 'gassyuku' && s.camp && s.camp.arrived && g.map.placeId !== 'gassyuku') { await say(g, '合宿に出かけている最中ですね。…あれ？', w); return { ok: false }; }
  // expiries
  if (kariExpired(g)) return renewKari(g);
  if (termExpired(g)) return renewTerm(g);
  const b = await checkBooking(g);
  if (b && b.today) {
    const m = nowMin(g);
    const i = await ask(g, `今日は「${stepChoiceLabel({ step: b.step })}」のご予約ですね。（${hmText(b.min)}）\n${m < b.min ? `時間まで待ちますか？` : 'ちょうどお時間です。'}`, ['受ける', 'あとにする'], w, { cancel: 1 });
    if (i === 0) {
      if (m < b.min) waitTo(g, b.min, '教習の予約時間まで待つ');
      s.booking = null;
      return attend(g, b.step);
    }
    return { ok: false };
  }
  if (s.cert) {
    if (!certValid(g)) return renewCert(g);
    await say(g, ['ご卒業おめでとうございます。', `卒業証明書の有効期間は${dayText(g, s.cert + CERT_DAYS)}まで。\n免許センターで学科試験（本免）を受けてくださいね。`], w);
    return { ok: true };
  }
  const opts = ['教習・検定を受ける', '予約する・予約の確認', '進み具合を見る', 'お金・手続き', 'やめる'];
  const i = await ask(g, `${className(s)}　${progressText(g)}\nご用件は？`, opts, w, { cancel: 4 });
  if (i === 0) return takeLesson(g, null);
  if (i === 1) {
    if (s.kind === 'gassyuku') { await say(g, '合宿は予約不要。本館で、毎日のカリキュラムを受けてください。', w); return { ok: false }; }
    if (s.booking) {
      const j = await ask(g, `ご予約：${dayText(g, s.booking.day)} ${hmText(s.booking.min)}　${stepChoiceLabel({ step: stepOf(g, s.booking.step) || { type: 'gi', label: '教習' } })}`, ['このまま', '取り消す'], w, { cancel: 0 });
      if (j === 1) { cancelBooking(g); await say(g, '取り消しました。', w); }
      return { ok: true };
    }
    const step = await pickStep(g, null);
    if (!step) { await say(g, whyNone(g), w); return { ok: false }; }
    return bookingMenu(g, step, w);
  }
  if (i === 2) return progressView(g);
  if (i === 3) return paperwork(g);
  return { ok: false };
}
async function progressView(g) {
  const s = schoolOf(g);
  const rows = stepList(g);
  const mark = { done: '済', open: '○', locked: '・', quota: '△', wait: '△' };
  const line = (r) => `${mark[r.state] || '・'} ${r.step.label}`;
  const p = planOf(g);
  const part = (list) => list.map((x) => line(rows.find((r) => r.step.id === x.id) || { state: 'locked', step: x })).join('\n');
  await say(g, [`${className(s)}　${s.kind === 'gassyuku' ? '合宿' : '通学'}\n${progressText(g)}`, `【第1段階】\n${part(p.s1)}\n${line(rows.find((r) => r.step.id === 'ken1'))}\n${line(rows.find((r) => r.step.id === 'kari'))}`, `【第2段階】\n${part(p.s2)}\n${line(rows.find((r) => r.step.id === 'ken2'))}`, [`済＝終了　○＝受けられる　△＝今日は上限／あした`, s.kari && !s.ken2 ? `仮免許は${dayText(g, s.kari + KARI_DAYS)}まで。` : '', s.need.hoshu ? `補習があと${s.need.hoshu}回必要です。` : ''].filter(Boolean).join('\n')], WHO.uketsuke);
  return { ok: true };
}
async function paperwork(g) {
  const s = schoolOf(g);
  const opts = ['退所する（返金なし）', 'やめる'];
  if (s.kind === 'tsugaku') opts.unshift('教習の有効期間をたしかめる');
  const i = await ask(g, 'お金や手続きのことですね。', opts, WHO.uketsuke, { cancel: opts.length - 1 });
  const lab = opts[i];
  if (lab === '教習の有効期間をたしかめる') {
    await say(g, [`教習の有効期間は、入所から9か月（${dayText(g, s.enrolled + TERM_DAYS + num(s.extended))}まで）。`, `仮免許は交付から6か月、卒業証明書は1年です。\n期限が切れると、${yen(EXTRA_FEES.extendTerm)}の延長か、やり直しになります。`], WHO.uketsuke);
  } else if (lab === '退所する（返金なし）') {
    const j = await ask(g, '退所すると、ここまでの教習は無効になり、料金は返ってきません。\n本当に退所しますか？', ['やめておく', '退所する'], WHO.uketsuke, { cancel: 0 });
    if (j === 1) { lic(g).school = null; record(g, '教習所を退所した。'); await say(g, 'わかりました。…また気が向いたら、いつでもどうぞ。', WHO.uketsuke); }
  }
  return { ok: true };
}
async function courseInfo(g) {
  const ym = ymNow(g);
  const lines = ['【普通（MT／AT限定）】18歳から。第1段階（学科・所内技能）→ 修了検定 → 仮免学科 → 第2段階（路上・応急救護）→ 卒業検定。', `通学 ${yen(schoolFee('futsu', 'tsugaku', true))}（MT）〜 ／ 合宿 ${yen(schoolFee('futsu', 'gassyuku', true, 'zao'))}〜（宿泊・食事つき）`, '【普通二輪】16歳から。一本橋やスラロームの練習があります。', ym >= 201703 ? '【準中型】18歳から。2トントラックなどを運転できる免許です（2017年3月〜）。' : '', '【原付】16歳から。教習所では教えていません。免許センターで学科試験と原付講習を受けます。', '【普通第二種】タクシーやバスなどで、お客さんを乗せる免許。年齢と免許の経験年数の条件があります。'].filter(Boolean);
  for (const l of lines) await say(g, l, WHO.uketsuke);
  return { ok: true };
}
async function flowInfo(g) {
  await say(g, ['免許を取る流れをご説明しますね。', '入所：適性検査（視力・色の見分け・聴力・運動能力）。\n第1段階：学科教習と、所内での技能教習。そして修了検定。', '修了検定に合格すると、仮免許の学科試験。90%以上で合格すると「仮免許」が交付されます。（有効期間6か月）', '第2段階：路上での技能教習と、応急救護などの学科。そして卒業検定に合格すれば卒業です。', '最後に、運転免許試験場（免許センター）で、適性検査と学科試験を受けます。合格すれば、免許証の交付です。', '通学は予約制で1〜3か月。合宿は宿泊しながら、最短で2週間ほどです。'], WHO.uketsuke);
  return { ok: true };
}
async function renewKari(g) {
  const s = schoolOf(g);
  await say(g, ['仮免許の有効期間（6か月）が切れてしまっています。', '仮免許の学科試験と、修了検定からやり直しになります。'], WHO.uketsuke);
  const i = await ask(g, `やり直しますか？（追加料金 ${yen(EXTRA_FEES.ken1 + EXTRA_FEES.kari)}）`, ['やり直す', 'あとにする'], WHO.uketsuke, { cancel: 1 });
  if (i !== 0) return { ok: false };
  if (!g.spend(EXTRA_FEES.ken1 + EXTRA_FEES.kari)) { await say(g, 'お金が足りません。', WHO.uketsuke); return { ok: false }; }
  s.ken1 = 0; s.kari = 0; s.fails.ken1 = 0; s.fails.kari = 0; s.need.hoshu = 1; s.lastLesson = g.state.day;
  record(g, '仮免許の期限が切れて、検定からやり直すことになった。');
  await say(g, '手続きしました。まず補習を1回、それから修了検定を受けましょう。', WHO.uketsuke);
  return { ok: true };
}
async function renewTerm(g) {
  const s = schoolOf(g);
  await say(g, ['入所から9か月たっていて、教習の有効期間が切れています。'], WHO.uketsuke);
  const i = await ask(g, `延長しますか？（${yen(EXTRA_FEES.extendTerm)}・さらに2か月）`, ['延長する', '退所する'], WHO.uketsuke, { cancel: 1 });
  if (i === 0 && g.spend(EXTRA_FEES.extendTerm)) { s.extended = num(s.extended) + 20; record(g, '教習の有効期間を延長した。'); await say(g, '延長しました。今度は期限内にね。', WHO.uketsuke); return { ok: true }; }
  lic(g).school = null; record(g, '教習の期限が切れて、退所になった。');
  await say(g, i === 0 ? 'お金が足りないようです…。いったん退所になります。' : '退所の手続きをしました。', WHO.uketsuke);
  return { ok: false };
}
async function renewCert(g) {
  const s = schoolOf(g);
  await say(g, ['卒業証明書の有効期間（1年）が切れてしまっています。', '卒業検定を、もう一度受けてもらうことになります。'], WHO.uketsuke);
  const i = await ask(g, `受け直しますか？（補習1回＋再検定 ${yen(EXTRA_FEES.ken2)}）`, ['受け直す', 'あとにする'], WHO.uketsuke, { cancel: 1 });
  if (i !== 0) return { ok: false };
  s.cert = 0; s.ken2 = 0; s.gradDay = 0; s.fails.ken2 = Math.max(1, s.fails.ken2); s.need.hoshu = 1; s.lastLesson = g.state.day;
  record(g, '卒業証明書の期限が切れ、卒業検定を受け直すことになった。');
  await say(g, '手続きしました。補習を1回、それから卒業検定を。', WHO.uketsuke);
  return { ok: true };
}

// ======================================================================== room NPCs of the school (kyoshitsu / course / camp honkan)
async function classNpc(g) {
  const s = schoolOf(g);
  if (!s) { await say(g, ['ここは学科教室。教習生が学科教習を受けています。', '入所したい人は、受付で申し込みを。'], WHO.gaku); return; }
  if (s.cert) { await say(g, 'ご卒業おめでとう。免許センターでの学科試験、がんばって。', WHO.gaku); return; }
  const rows = stepList(g).filter((r) => r.state === 'open' && (r.step.type === 'gaku' || r.step.id === 'kari'));
  if (!rows.length) { await say(g, [whyNone(g)], WHO.gaku); return; }
  const i = await ask(g, '学科の教習・試験を受けますか？', [...rows.map(stepChoiceLabel), 'やめる'], WHO.gaku, { cancel: rows.length });
  if (i < 0 || i >= rows.length) return;
  if (s.kind === 'tsugaku') {
    const b = await checkBooking(g);
    if (b && b.today && b.step.id === rows[i].step.id) { if (nowMin(g) < b.min) waitTo(g, b.min, '教習の予約時間まで待つ'); s.booking = null; }
  }
  await attend(g, rows[i].step);
}
async function courseNpc(g) {
  const s = schoolOf(g);
  if (!s) { await say(g, ['ここは教習コース。技能教習は、入所した人が受けられます。', 'ようこそ、免許の世界へ。'], WHO.kyokan); return; }
  if (s.cert) { await say(g, '卒業おめでとう。安全運転で。', WHO.kyokan); return; }
  const rows = stepList(g).filter((r) => r.state === 'open' && (r.step.type === 'gi' || r.step.type === 'ken'));
  if (!rows.length) { await say(g, whyNone(g), WHO.kyokan); return; }
  const i = await ask(g, '技能の教習・検定を受けますか？', [...rows.map(stepChoiceLabel), 'やめる'], WHO.kyokan, { cancel: rows.length });
  if (i < 0 || i >= rows.length) return;
  if (s.kind === 'tsugaku') {
    const b = await checkBooking(g);
    if (b && b.today && b.step.id === rows[i].step.id) { if (nowMin(g) < b.min) waitTo(g, b.min, '教習の予約時間まで待つ'); s.booking = null; }
  }
  await attend(g, rows[i].step);
}
// 合宿: the day's whole programme at once (or one by one at the desk)
async function campDesk(g) {
  const s = schoolOf(g);
  const w = WHO.uketsuke;
  if (!s || !s.camp || !s.camp.arrived) { await say(g, ['こちらは合宿の本館です。', '（入所している人の受付です）'], w); return { ok: false }; }
  if (s.cert) { await say(g, ['卒業おめでとうございます。', 'あとは荷物をまとめて、お帰りください。門のところで手続きをしますよ。'], w); return { ok: true }; }
  if (kariExpired(g)) return renewKari(g);
  const rows = stepList(g).filter((r) => r.state === 'open');
  const cnt = todayCounts(s, g.state.day);
  const q = quota(s);
  const hoshu = s.need.hoshu > 0;
  await say(g, [`${s.camp.day}日目（予定${s.camp.planned + s.camp.extra}日）　${progressText(g)}`, `今日は 学科 ${cnt.gaku}/${q.gaku}・技能 ${cnt.gi}/${q.gi}・検定 ${cnt.ken}/${q.ken}`], w);
  if (!rows.length && !hoshu) { await say(g, [whyNone(g), '今日はもう、ゆっくり休んで。寮の部屋で寝ると次の日です。'], w); return { ok: false }; }
  const i = await ask(g, '今日のカリキュラムを受けますか？', ['おまかせで全部受ける', '項目を選んで受ける', 'やめる'], w, { cancel: 2 });
  if (i === 1) return takeLesson(g, null);
  if (i !== 0) return { ok: false };
  let n = 0;
  for (let guard = 0; guard < 10; guard++) {
    const open = stepList(g).filter((r) => r.state === 'open').map((r) => r.step);
    // gaku first, then gi, then tests
    const next = open.find((x) => x.type === 'gaku') || open.find((x) => x.type === 'gi') || open.find((x) => x.id === 'kari') || open.find((x) => x.type === 'ken');
    if (!next) break;
    if (nowMin(g) >= OPEN_TO - 60) { await say(g, '今日の受付はここまで。続きはあしたに。', w); break; }
    const r = await attend(g, next);
    if (!r.ok) break;
    n++;
    if (s.cert) break;
    if (r.done === false && next.type === 'ken') break; // a failed 検定 ends the day's run
    if (r.done === false && next.type === 'gi') break;
  }
  if (n > 0) {
    await moveTo(g, 'gassyuku', 'lobby');
    await g.say(['今日の教習は、ここまで。', `${progressText(g)}`]);
  }
  return { ok: true };
}

// ======================================================================== 免許センター
async function centerClosedCheck(g) {
  if (centerClosed(g)) {
    await say(g, ['本日は土曜・日曜のため、学科試験と免許の交付はお休みです。', '平日（月〜金）の午前9時から午後4時までの受付です。'], WHO.c_uketsuke);
    return true;
  }
  const m = nowMin(g);
  if (m >= 960) { await say(g, ['受付時間は午後4時までです。', 'また明日、お越しください。'], WHO.c_uketsuke); return true; }
  if (m < OPEN_FROM) { await say(g, `受付は${hmText(OPEN_FROM)}からです。少し待ちましょう。`, WHO.c_uketsuke); waitTo(g, OPEN_FROM, '開庁待ち'); }
  return false;
}
function centerKind(cls) { return cls === 'gentsuki' ? 'gentsuki' : cls === 'nirin' ? 'nirin' : cls === 'futsu2' ? 'second' : 'hon'; }
function centerExamName(cls) { return cls === 'gentsuki' ? '原付免許 学科試験' : cls === 'futsu2' ? '第二種 学科試験' : '本免許 学科試験'; }
// which procedure the player can start now: [{ cls, label }]
function centerOptions(g) {
  const L = lic(g);
  const out = [];
  const s = L.school;
  if (s && s.cert) {
    if (certValid(g)) out.push({ cls: s.cls, label: `${CLASSES[s.cls].name}免許　学科試験（本免）`, school: true });
  }
  if (L.center.pending && !(s && s.cert && L.center.pending.cls === s.cls)) {
    const c = L.center.pending.cls;
    if (!out.some((o) => o.cls === c)) out.push({ cls: c, label: `${CLASSES[c].name}免許　手続きのつづき`, school: !!L.center.pending.school });
  }
  if (!holds(g, 'gentsuki') && eligible(g, 'gentsuki').ok && !out.some((o) => o.cls === 'gentsuki')) out.push({ cls: 'gentsuki', label: '原付免許（学科試験と原付講習）', school: false });
  return out;
}
async function centerDesk(g) {
  const w = WHO.c_uketsuke;
  const L = lic(g);
  const opts = centerOptions(g);
  const rn = L.classes && Object.keys(L.classes).length && (g.state.day >= cardExpiry(g) - 20);
  const menu = [];
  for (const o of opts) menu.push({ t: 'proc', o, label: o.label });
  if (Object.keys(L.classes).length) {
    if (rn) menu.push({ t: 'renew', label: '免許証の更新' });
    menu.push({ t: 'card', label: '自分の免許証を見る' });
  }
  menu.push({ t: 'info', label: '免許の手続きを聞く' });
  menu.push({ t: 'quit', label: 'やめる' });
  const i = await ask(g, `ようこそ、${CENTER_NAME}へ。\nご用件は？`, menu.map((m) => m.label), w, { cancel: menu.length - 1 });
  const m = menu[clamp(i, 0, menu.length - 1)];
  if (!m || m.t === 'quit') return { ok: false };
  if (m.t === 'info') return centerInfo(g);
  if (m.t === 'card') return showLicenseCard(g, { title: '運転免許証' });
  if (m.t === 'renew') return renewFlow(g);
  return procedure(g, m.o.cls);
}
async function centerInfo(g) {
  await say(g, ['ここは運転免許試験場（免許センター）です。', '教習所を卒業した人は、ここで適性検査と学科試験を受けます。合格すれば、その日のうちに免許証がもらえます。', '学科試験は、仮免が50問、本免は文章と、イラストの危険予測問題。どちらも90%以上で合格です。', '原付免許は教習所に通わず、ここで学科試験と、3時間の原付講習を受ければ取れます。', '受付は平日の午前9時から午後4時まで。土日はお休みです。（更新は日曜に受けつける所もあります）'], WHO.c_uketsuke);
  return { ok: true };
}
async function procedure(g, cls) {
  const L = lic(g);
  const st = g.state;
  const C = CLASSES[cls];
  const s = L.school && L.school.cls === cls ? L.school : null;
  if (await centerClosedCheck(g)) return { ok: false };
  if (C.school) {
    if (!s || !s.cert) { await say(g, `${C.name}免許は、教習所を卒業してから、ここで試験を受けます。`, WHO.c_uketsuke); return { ok: false }; }
    if (!certValid(g)) { await say(g, ['卒業証明書の有効期間（1年）が切れています。', '教習所で、卒業検定を受け直してください。'], WHO.c_uketsuke); const r = await renewCertAt(g); return r; }
  } else {
    const el = eligible(g, cls);
    if (!el.ok) { await say(g, el.why, WHO.c_uketsuke); return { ok: false }; }
  }
  const why = safe(() => g.lifeRefusal(), null);
  if (why) { await say(g, why); return { ok: false }; }
  let p = L.center.pending && L.center.pending.cls === cls ? L.center.pending : null;
  if (!p) {
    const fee = EXTRA_FEES.centerGakka;
    await say(g, [`${centerExamName(cls)}の受付ですね。`, `試験の手数料は ${yen(fee)}。合格したら、写真代 ${yen(EXTRA_FEES.photo)} と交付手数料 ${yen(EXTRA_FEES.centerIssue)}${cls === 'gentsuki' ? `、原付講習の料金 ${yen(EXTRA_FEES.koshu)}` : ''} がかかります。`], WHO.c_uketsuke);
    p = L.center.pending = { cls, mt: s ? s.mt : true, school: !!s, tekisei: 0, gakka: 0, paid: 0, koshu: 0, cond: s ? s.cond : [] };
  }
  // 1. 適性検査
  if (!p.tekisei) {
    await g.goto('menkyo', 'tekisei', SPOT.tekisei.x, SPOT.tekisei.y, 'up');
    const apt = await aptitude(g, WHO.c_kakari, '適性検査');
    if (!apt.ok) return { ok: false };
    p.tekisei = st.day;
    for (const x of apt.cond) if (!p.cond.includes(x)) p.cond.push(x);
    L.center.tekisei = st.day;
  }
  // 2. 学科試験 (1日1回)
  if (!p.gakka) {
    if (L.center.lastTry === st.day) { await say(g, ['学科試験は、おひとり1日1回までです。', 'また、日をあらためて来てください。'], WHO.c_uketsuke); return { ok: false }; }
    if (!g.spend(EXTRA_FEES.centerGakka)) { await say(g, `試験の手数料 ${yen(EXTRA_FEES.centerGakka)} が足りません。`, WHO.c_uketsuke); return { ok: false }; }
    g.sfx('coin');
    await g.goto('menkyo', 'shiken', SPOT.shiken.x, SPOT.shiken.y, 'up');
    await say(g, [`それでは、${centerExamName(cls)}を始めます。`, '時間は30分。○か×で答えてください。\n90%以上で合格です。'], WHO.c_shiken);
    const out = {};
    const res = await g.minigame('license_exam', { kind: centerKind(cls), count: 50, out, minutes: 40, title: centerExamName(cls) });
    L.center.lastTry = st.day;
    L.center.attempts[cls] = (L.center.attempts[cls] || 0) + 1;
    L.stats.exams++;
    g.lifeTick({ stress: 6, hunger: -5 });
    await say(g, `結果：${out.total}問中${out.correct}問正解（${out.pts}／${out.max}点）。`, WHO.c_shiken);
    const pass = res.success && out.pass !== false;
    if (!pass) {
      L.stats.fails++;
      g.sfx('fail');
      await reviewWrong(g, out);
      await say(g, [`残念ながら、不合格です。（${out.need || 45}点以上が合格）`, 'また日をあらためて、受け直してください。'], WHO.c_shiken);
      record(g, `${centerExamName(cls)}は不合格。`);
      return { ok: false, passed: false };
    }
    L.stats.passes++;
    g.sfx('fanfare');
    p.gakka = st.day;
    await say(g, ['合格です！　おめでとうございます。', cls === 'gentsuki' ? '次は、原付講習です。3時間の実技と、学科の講習があります。' : '写真の撮影と、交付の手続きに進んでください。'], WHO.c_shiken);
    record(g, `${centerExamName(cls)}に合格。`);
  }
  // 原付講習
  if (cls === 'gentsuki' && !p.koshu) {
    if (!g.spend(EXTRA_FEES.koshu)) { await say(g, `原付講習の料金 ${yen(EXTRA_FEES.koshu)} が足りません。お金ができたら、受付へ。`, WHO.c_uketsuke); return { ok: false }; }
    g.sfx('coin');
    await g.goto('menkyo', 'koufu', SPOT.koufu.x, SPOT.koufu.y, 'up');
    await say(g, ['原付講習です。', '安全な乗り方の話を聞いて、そのあと実技。\nヘルメットのあごひもは、しっかり締めて。'], WHO.c_koufu);
    const r = await runDriving(g, { stage: 'moto', course: 'koshu', practice: true, difficulty: 1, title: '原付講習', minutes: 180 });
    p.koshu = st.day;
    await say(g, r.points >= 50 ? ['はい、よくできました。講習は修了です。'] : ['ふらつきもありましたが、講習は修了です。安全運転でね。'], WHO.c_koufu);
  }
  // 3. 写真・講習・交付
  const fee = EXTRA_FEES.photo + EXTRA_FEES.centerIssue;
  if (st.money < fee) { await say(g, `写真代と交付手数料で ${yen(fee)} かかります。お金ができたら、もう一度受付へ。（試験の合格は有効です）`, WHO.c_uketsuke); return { ok: false }; }
  await g.goto('menkyo', 'koufu', SPOT.koufu.x, SPOT.koufu.y, 'up');
  g.spend(fee); g.sfx('coin');
  await say(g, ['お疲れさまでした。写真を撮ります。', 'はい、こちらを見て。…撮れました。'], WHO.c_koufu);
  g.sfx('camera');
  await g.fadeOut(8); await g.wait(200); await g.fadeIn(8);
  await say(g, ['つづいて、交付時講習です。', '交通事故の実例のビデオを見て、免許を取ったばかりの人が気をつけることのお話。\n約30分、席でお待ちください。'], WHO.c_koufu);
  passMin(g, 40, '交付時講習');
  await g.fadeOut(10); await g.wait(500); await g.fadeIn(10);
  g.lifeTick({ stress: 2 });
  await say(g, ['…お待たせしました。免許証ができました。', `${g.state.profile ? '' : ''}${g.state.name}さん、${C.name}免許の交付です。`], WHO.c_koufu);
  const via = p.school ? 'school' : 'center';
  grantLicense(g, cls, { mt: C.vehicle === 'car' ? (s ? s.mt : true) : null, via, school: p.school ? SCHOOL_NAME : '', cond: p.cond, special: s ? s.special : false });
  if (s) L.school = null;
  L.center.pending = null;
  await showLicenseCard(g, { title: `${C.name}免許　交付`, fanfare: true });
  const card = g.licenseCard();
  await say(g, [`有効期限は ${card.expires} です。`, '免許を取って1年のあいだは、初心運転者標識（若葉マーク）を車につけてください。', cls === 'gentsuki' ? '原付の運転、気をつけてね。' : '安全運転で。ご免許取得、おめでとうございます！'], WHO.c_koufu);
  g.addFame(1, true);
  g.save(true);
  return { ok: true, granted: cls };
}
async function renewCertAt(g) {
  const s = schoolOf(g);
  if (!s) return { ok: false };
  s.cert = 0; s.ken2 = 0; s.gradDay = 0; s.fails.ken2 = Math.max(1, s.fails.ken2); s.need.hoshu = 1; s.lastLesson = g.state.day;
  record(g, '卒業証明書の期限が切れ、卒業検定を受け直すことになった。');
  return { ok: false };
}
async function renewFlow(g) {
  if (await centerClosedCheck(g)) return { ok: false };
  const L = lic(g);
  const fee = EXTRA_FEES.renew;
  const i = await ask(g, `免許証の更新です。手数料と講習で ${yen(fee)}。\n適性検査（視力）のあと、30分の講習があります。`, ['更新する', 'やめる'], WHO.c_uketsuke, { cancel: 1 });
  if (i !== 0) return { ok: false };
  if (!g.spend(fee)) { await say(g, 'お金が足りません。', WHO.c_uketsuke); return { ok: false }; }
  g.sfx('coin');
  await g.goto('menkyo', 'tekisei', SPOT.tekisei.x, SPOT.tekisei.y, 'up');
  const apt = await aptitude(g, WHO.c_kakari, '適性検査（更新）');
  if (!apt.ok) { g.addMoney(fee, true); return { ok: false }; }
  await g.goto('menkyo', 'koufu', SPOT.koufu.x, SPOT.koufu.y, 'up');
  await say(g, '更新時講習です。最近の交通事故の傾向と、高齢者の運転、あおり運転の話を聞きます。', WHO.c_koufu);
  passMin(g, 40, '更新時講習');
  renewLicense(g);
  await showLicenseCard(g, { title: '運転免許証　更新', fanfare: true });
  g.save(true);
  return { ok: true };
}

// 学科の練習（成績に入らない10問。スマホの「教習予約」と教習所の問題集の棚）
async function practiceExam(g, kind) {
  const why = safe(() => g.lifeRefusal(), null);
  if (why) { await g.say(why); return { ok: false }; }
  const s = schoolOf(g);
  const k = kind || (s ? (CLASSES[s.cls].vehicle === 'moto' ? 'nirin' : s.cls === 'futsu2' ? 'second' : 'kari') : 'kari');
  const out = {};
  const res = await g.minigame('license_exam', { kind: k, count: 10, out, minutes: 15, title: '学科の練習（10問）' });
  g.lifeTick({ stress: 1 });
  await g.say(`練習の結果：${out.total}問中${out.correct}問正解。\n${res.success ? 'この調子なら、本番も大丈夫そうだ。' : '本番は90%以上が合格ライン。もう少し練習しよう。'}`);
  const w = (out.wrong || []).filter((x) => x.yours !== null).slice(0, 3);
  for (const x of w) await g.say([`まちがえた問題：\n${x.q}`, `正解は「${x.a ? '○' : '×'}」。${x.why}`]);
  return { ok: true, correct: out.correct, total: out.total };
}

// ======================================================================== exports into FLOW
Object.assign(FLOW, {
  enroll,
  desk: async (g, o = {}) => {
    const where = o.where || (g.map && g.map.placeId);
    if (where === 'menkyo') return centerDesk(g);
    if (where === 'gassyuku') return campDesk(g);
    return schoolDesk(g);
  },
  center: (g) => centerDesk(g),
  attend: (g, step) => attend(g, step),
  classNpc, courseNpc, campDesk, campSleep, campGate, campVignette, campMeal, goCamp, leaveCamp, schoolDesk, centerDesk, procedure, renewFlow,
  bookStep: (g, id, off, min) => bookStep(g, id, off, min), cancelBooking, checkBooking, progressView, aptitude, practiceExam,
});
export { renewFlow, practiceExam, enroll, schoolDesk, centerDesk, campDesk, classNpc, courseNpc, campSleep, campGate, campVignette, campMeal, procedure, attend, goCamp, leaveCamp, checkBooking, progressView, bookingMenu };
