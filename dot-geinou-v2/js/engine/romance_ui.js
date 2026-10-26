// 恋愛・結婚・家庭 (R12-L1) — the phone app 「恋のはなし」 (昭和・平成のはじめは手帳の「ひとことメモ」), the 家族アルバム, the talk-menu hooks.
// (てちょう きろく row: g.romanceRows() in romance.js; the finale / credits: g.romanceSummary().)
// The app: 恋人・配偶者 / 気になる人 / お誘いとお返事 / 出会いをさがす / 家族アルバム / ふたりの記録 / 設定. Nothing starts until the player says whom
// they have in mind; 「いまは考えない」 keeps everything off (a family you already have stays).
import { registerPhoneApp, PEOPLE, PEOPLE_UI } from './life.js';
import { phoneList, phoneInfo, phoneConfirm, phoneView, appTile, rrect, phoneText as T, fitText, drawHeart, PC, box } from './phone.js';
import { audio } from './audio.js';
import { wrap, measure } from './draw.js';
import { clamp, fmtMoney, makeCanvas } from './util.js';
import { ageOf, YEAR_DAYS, prefecture } from './profile.js';
import { ITEMS } from './state.js';
import * as D from './romance_data.js';
import {
  rom, active, hasLife, ensureRomance, syncLegacy, leadRec, spouseRec, recOf, isCouple, partnerWord, shortName, recLook, pgOf, eraOf, recAge, jobOf, airOf, compatOf,
  moodHearts, addHist, castCandidates, adoptCast, CAST, dropRec, kidAge, kidYears, kidLook, kidScale, kidsForScene, affOf, blockReason, flat, setStage,
} from './romance.js';
import { chatFlow, goDate, giftFlow, giftsInBag, confessFlow, canConfess, breakUp, spotsFor, whyNotToday } from './romance_date.js';
import { meetOptions, runMeet, appProfiles, appLike, answerInvite, careerWord } from './romance_meet.js';
import { cohabFlow, canCohab, proposeFlow, canPropose, greetFlow, nyusekiFlow, shikiFlow, canShiki, newHomeFlow, divorceFlow, weeklyBalance, WORK } from './romance_wed.js';
import { planFlow, canPlan, workStyleFlow, leaveBack, fertilityState, playWithKid } from './romance_kids.js';
import { playScene, sayAs } from './romance_scene.js';
import { ALL } from './romance_art2.js';
import { FAMILY_ROWS } from '../world/family.js';
import './romance_home.js';
import { AW, AH } from './romance_art.js';

const COLOR = '#e2569a';
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const hearts = (n) => '♥'.repeat(n) + '♡'.repeat(Math.max(0, 5 - n));
export const appTitle = (g) => (['showa', 'heisei_early'].includes(eraOf(g)) ? 'ひとことメモ' : '恋のはなし');

// ---------------------------------------------------------------- the icon (three devices)
function rectc(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function heartPx(c, x, y, col, s = 1) {
  rectc(c, x + s, y, 2 * s, s, col); rectc(c, x + 4 * s, y, 2 * s, s, col);
  rectc(c, x, y + s, 7 * s, 2 * s, col); rectc(c, x + s, y + 3 * s, 5 * s, s, col); rectc(c, x + 2 * s, y + 4 * s, 3 * s, s, col); rectc(c, x + 3 * s, y + 5 * s, s, s, col);
}
function iconHD(c, x, y, g) {
  appTile(c, x, y, COLOR);
  const era = eraOf(g);
  if (era === 'showa' || era === 'heisei_early') {
    // a 手帳 page with a ribbon and a heart written in pencil
    rectc(c, x + 6, y + 5, 20, 23, '#5a2a3a'); rectc(c, x + 7, y + 6, 18, 21, '#fff6e8');
    for (let i = 0; i < 4; i++) rectc(c, x + 9, y + 10 + i * 4, 14, 1, '#e0c8b0');
    heartPx(c, x + 12, y + 8, '#ff5d8f', 1); rectc(c, x + 23, y + 3, 2, 8, '#c0392b');
  } else if (era === 'heisei') {
    // a flip phone with a heart on the screen
    rectc(c, x + 9, y + 4, 14, 24, '#2a2e3a'); rectc(c, x + 10, y + 5, 12, 22, '#c8ccd8'); rectc(c, x + 11, y + 7, 10, 9, '#d8f0e8'); heartPx(c, x + 12, y + 8, '#ff5d8f', 1);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) rectc(c, x + 12 + i * 3, y + 18 + j * 3, 2, 2, '#5a5f70');
  } else {
    // a speech bubble with a heart
    rectc(c, x + 5, y + 7, 22, 15, '#ffffff'); rectc(c, x + 6, y + 6, 20, 17, '#ffffff'); rectc(c, x + 7, y + 22, 3, 4, '#ffffff'); rectc(c, x + 7, y + 25, 2, 1, '#ffffff');
    heartPx(c, x + 12, y + 10, '#ff3d7a', 1);
    rectc(c, x + 22, y + 9, 3, 1, '#ffd0e0'); rectc(c, x + 22, y + 12, 3, 1, '#ffd0e0');
  }
}

// ---------------------------------------------------------------- small helpers
const stageSub = (g, rec) => {
  const st = g.state;
  const days = st.day - rec.since;
  const months = Math.floor(days / 10);
  if (rec.st === 'dating') return `交際${months < 1 ? 'はじめ' : months + 'か月'}・${hearts(moodHearts(rec))}`;
  if (rec.st === 'cohab') return `同棲${months < 1 ? 'はじめ' : months + 'か月'}・${hearts(moodHearts(rec))}`;
  if (rec.st === 'engaged') return `婚約中・${hearts(moodHearts(rec))}`;
  if (rec.st === 'married') { const y = Math.floor((st.day - num(rec.wedDay, rec.since)) / YEAR_DAYS); return `${y < 1 ? '新婚' : `結婚${y}年目`}・${hearts(moodHearts(rec))}`; }
  return D.STAGES[rec.st] ? D.STAGES[rec.st].name : '';
};
function candidates(g) {
  const R = rom(g);
  const out = Object.values(R.c).filter((r) => (r.st === 'know' || r.st === 'close' || r.st === 'ex') && R.lead !== r.id);
  // friends of the cast who could be loved (not yet in the track)
  for (const pid of castCandidates(g)) if (!R.c[pid]) out.push({ id: pid, cast: 1, castCand: true, g: CAST[pid].g, st: 'friend' });
  return out;
}
function compatLine(g, rec) {
  const kn = rec.kn || [];
  if (!kn.length && !isCouple(rec)) return 'まだ、よくわからない';
  const c = compatOf(g, rec);
  return c.word;
}
function showInfo(g, rec) {
  const st = g.state;
  const c = compatOf(g, rec);
  const kn = (rec.kn || []).filter((t) => D.TAGS[t]);
  const lines = [];
  lines.push(`${rec.n}（${recAge(g, rec)}歳）`);
  lines.push(`${jobOf(g, rec)}・${prefecture(rec.hm).name}出身`);
  lines.push(`印象：${D.PERS[rec.per].first}`);
  lines.push('');
  if (!kn.length && !isCouple(rec)) lines.push('ふたりの相性：まだ、よくわからない。\n（いっしょに過ごして、少しずつ知っていこう）');
  else {
    lines.push(`ふたりの相性：${c.word}`);
    const shown = c.reasons.filter((r, i) => !r.includes('同じ') || kn.length);
    for (const r of shown.slice(0, 3)) lines.push(`・${r}`);
  }
  if (kn.length) lines.push(`気づいたこと：${kn.map((t) => D.TAGS[t].name).join('、')}`);
  const p = st.people[rec.id];
  const liked = p && p.known ? Object.keys(p.known).filter((k) => p.known[k] === 'love' || p.known[k] === 'like').map((k) => ITEMS[k] && ITEMS[k].name).filter(Boolean) : [];
  if (liked.length) lines.push(`よろこんだプレゼント：${liked.join('、')}`);
  if (!isCouple(rec) && rec.st !== 'ex') lines.push(`ふたりの空気：${D.AIR_WORDS[airOf(g, rec)]}`);
  if (isCouple(rec)) {
    lines.push(`ふたりの空気：${hearts(moodHearts(rec))}`);
    const doy = ((st.day - 1) % YEAR_DAYS) + 1;
    const left = (rec.bd - doy + YEAR_DAYS) % YEAR_DAYS;
    lines.push(`誕生日まで：あと${left}日`);
    lines.push(`デート：${rec.dates}回`);
    if (rec.st === 'married') {
      const b = weeklyBalance(g);
      lines.push(`今週の家計：${b.net >= 0 ? '+' : '-'}${fmtMoney(Math.abs(b.net))}（収入 ${fmtMoney(b.income)}・生活費 ${fmtMoney(b.cost)}）`);
    }
  }
  return phoneInfo(g, { title: shortName(rec), color: COLOR, text: lines.join('\n') });
}

// ---------------------------------------------------------------- the app
async function introFlow(g) {
  const R = rom(g);
  if (ageOf(g.state) < 18) {
    await phoneInfo(g, { title: appTitle(g), color: COLOR, text: '恋愛や結婚のことは、18歳になってから。\n\nいまは、友だちや家族、夢のことを大切に。' });
    return false;
  }
  const era = eraOf(g);
  const i = await phoneConfirm(g, {
    title: appTitle(g), color: COLOR,
    text: `恋愛や結婚、家族のこと。\nいま、どんな人が気になる？\n（いつでも変えられる）`,
    choices: ['男性が気になる', '女性が気になる', 'どちらでも', 'いまは考えない'],
  });
  R.pref = ['m', 'f', 'any', 'off'][i] || 'off';
  return R.pref !== 'off';
}
async function chooseSpot(g, rec) {
  const why = whyNotToday(g, rec);
  if (why) { await phoneInfo(g, { title: 'デート', color: COLOR, text: why }); return null; }
  const spots = spotsFor(g, rec);
  const era = eraOf(g);
  const i = await phoneList(g, {
    title: `${shortName(rec)}と、どこへ？`, color: COLOR, hint: 'A:さそう　B:もどる',
    items: spots.map((s) => ({ label: s.name, sub: s.hint || (s.season ? '今の季節だけ' : ''), right: s.price ? fmtMoney(s.price) : '無料', disabled: !!s.why, why: s.why })),
    describe: (k) => (spots[k] && spots[k].why ? `（${spots[k].why}）` : (D.spotGo(spots[k].id, era) + '。\n' + (spots[k].hint ? `（${spots[k].hint}）` : ''))),
  });
  return i >= 0 ? spots[i].id : null;
}
async function dateFlow(g, rec) {
  const id = await chooseSpot(g, rec);
  if (!id) return false;
  const kids = rec.st === 'married' ? kidsForScene(g) : null;
  const r = await goDate(g, rec, id, { kids });
  if (r && r.ok && rec.st === 'close') {
    const why = canConfess(g, rec);
    if (why === null && airOf(g, rec) >= 2) {
      const k = await g.ask(`（${shortName(rec)}との帰り道。\nいま、気持ちを伝えてみる？）`, ['伝える', 'まだ、このまま'], { cancel: 1 });
      if (k === 0) await confessFlow(g, rec);
    }
  }
  return !!(r && r.ok);
}
async function giftMenu(g, rec) {
  const ids = giftsInBag(g);
  if (!ids.length) { await phoneInfo(g, { title: 'プレゼント', color: COLOR, text: 'バッグに、プレゼントになるものがない。\n\n商店街のお店で、ケーキや本、花束などを買ってこよう。' }); return; }
  const i = await phoneList(g, { title: 'プレゼントは？', color: COLOR, items: ids.map((id) => ({ label: ITEMS[id].name, right: `×${g.state.items[id]}` })), describe: (k) => ITEMS[ids[k]].desc.split('\n')[0] });
  if (i >= 0) await giftFlow(g, recOf(g, rec.id) || rec, ids[i]);
}
async function personMenu(g, rec0) {
  for (let guard = 0; guard < 40; guard++) {
    let rec = rec0.castCand ? (recOf(g, rec0.id) || null) : recOf(g, rec0.id);
    const R = rom(g);
    if (rec0.castCand && !rec) rec = adoptCast(g, rec0.id); // a friend becomes someone you may love
    if (!rec) return;
    if (!PEOPLE[rec.id] && !rec.cast) return;
    const lead = leadRec(g);
    const rows = [];
    rows.push({ key: 'chat', label: 'メッセージを送る', sub: '1日1回 ♥+1' });
    rows.push({ key: 'date', label: 'デートにさそう', sub: rec.ld === g.state.day ? '今日はもう会った' : rec.st === 'know' ? 'お茶でも、どうですか？' : 'どこへ行こう？', disabled: !!whyNotToday(g, rec) });
    rows.push({ key: 'gift', label: 'プレゼントをわたす', sub: '一日一回' });
    const cwhy = canConfess(g, rec);
    if ((rec.st === 'close' || rec.st === 'know' || rec.st === 'friend') && !lead) rows.push({ key: 'confess', label: '気持ちを伝える', sub: cwhy === null ? `空気：${D.AIR_WORDS[airOf(g, rec)]}` : cwhy, disabled: cwhy !== null, why: cwhy || '' });
    rows.push({ key: 'info', label: 'この人のこと', sub: compatLine(g, rec) });
    if (rec.st === 'know' && !rec.cast) rows.push({ key: 'drop', label: '連絡を、おしまいにする', sub: '連絡先を消す' });
    const i = await phoneList(g, { title: `${shortName(rec)}（${jobOf(g, rec)}）`, color: COLOR, items: rows, hint: 'A:えらぶ　B:もどる', describe: () => `${D.PERS[rec.per].first}\n${D.STAGES[rec.st] ? D.STAGES[rec.st].name : ''}` });
    if (i < 0) return;
    const k = rows[i].key;
    if (k === 'chat') await chatFlow(g, rec);
    else if (k === 'date') await dateFlow(g, rec);
    else if (k === 'gift') await giftMenu(g, rec);
    else if (k === 'confess') { const r = await confessFlow(g, rec); if (r) return; }
    else if (k === 'info') await showInfo(g, rec);
    else if (k === 'drop') { const j = await phoneConfirm(g, { title: '連絡先', color: COLOR, text: `${shortName(rec)}の連絡先を、消す？`, choices: ['消す', 'やめておく'] }); if (j === 0) { dropRec(g, rec); return; } }
  }
}
async function leadMenu(g) {
  for (let guard = 0; guard < 60; guard++) {
    const rec = leadRec(g);
    if (!rec) return;
    const R = rom(g);
    const rows = [];
    const era = eraOf(g);
    rows.push({ key: 'chat', label: 'メッセージを送る', sub: '1日1回 ♥+1' });
    rows.push({ key: 'date', label: rec.st === 'married' ? '夫婦でお出かけ' : 'デートにさそう', sub: rec.ld === g.state.day ? '今日はもう会った' : 'どこへ行こう？', disabled: !!whyNotToday(g, rec) });
    rows.push({ key: 'gift', label: 'プレゼントをわたす', sub: '一日一回' });
    if (rec.st === 'dating') {
      const w = canCohab(g, rec);
      rows.push({ key: 'cohab', label: 'いっしょに暮らそうと話す', sub: w === null ? '同棲（3か月〜）' : w, disabled: w !== null, why: w || '' });
    }
    if (rec.st === 'dating' || rec.st === 'cohab') {
      const w = canPropose(g, rec);
      rows.push({ key: 'propose', label: 'プロポーズする', sub: w === null ? '結婚を申しこむ' : (w || '婚約をしている'), disabled: w !== null, why: w || '' });
    }
    if (rec.st === 'engaged') {
      rows.push({ key: 'greet_their', label: `${shortName(rec)}のご両親に挨拶`, sub: rec.par && rec.par.their === 'ok' ? '認めてもらえた' : 'ご実家へ' , disabled: false });
      rows.push({ key: 'greet_mine', label: '自分の実家に報告', sub: rec.par && rec.par.mine === 'ok' ? '祝福してもらえた' : '実家へ' });
      rows.push({ key: 'nyuseki', label: '婚姻届を出す（入籍）', sub: '区役所の窓口へ' });
      rows.push({ key: 'shiki', label: '結婚式を挙げる', sub: canShiki(g, rec) === null ? '式・披露宴・新婚旅行' : 'もう挙げた', disabled: canShiki(g, rec) !== null });
    }
    if (rec.st === 'cohab' || rec.st === 'engaged' || rec.st === 'married') rows.push({ key: 'home', label: 'ふたりの部屋をさがす', sub: '不動産へ（引っ越し）' });
    if (rec.st === 'married') {
      rows.push({ key: 'family', label: '家族のこと', sub: R.kids.length ? `子ども ${R.kids.length}人` : '子ども・働きかた・お休み' });
      if (!rec.shiki) rows.push({ key: 'shiki', label: '結婚式を挙げる', sub: '式・披露宴・新婚旅行' });
    }
    rows.push({ key: 'info', label: 'ふたりのこと', sub: compatLine(g, rec) });
    rows.push({ key: 'end', label: rec.st === 'married' ? (rec.legal === false ? '暮らしを終える' : '離婚を考える') : rec.st === 'engaged' ? '婚約をやめる' : '別れ話をする', sub: 'いちばん、重い決断' });
    const i = await phoneList(g, { title: `${shortName(rec)}（${partnerWord(g, rec)}）`, color: COLOR, items: rows, hint: 'A:えらぶ　B:もどる', describe: () => `${rec.n}\n${stageSub(g, rec)}` });
    if (i < 0) return;
    const k = rows[i].key;
    if (k === 'chat') await chatFlow(g, rec);
    else if (k === 'date') await dateFlow(g, rec);
    else if (k === 'gift') await giftMenu(g, rec);
    else if (k === 'cohab') await cohabFlow(g, rec);
    else if (k === 'propose') await proposeFlow(g, rec);
    else if (k === 'greet_their') await greetFlow(g, rec, 'their');
    else if (k === 'greet_mine') await greetFlow(g, rec, 'mine');
    else if (k === 'nyuseki') await nyusekiFlow(g, rec);
    else if (k === 'shiki') await shikiFlow(g, rec);
    else if (k === 'home') await newHomeFlow(g, rec);
    else if (k === 'family') await familyMenu(g, rec);
    else if (k === 'info') await showInfo(g, rec);
    else if (k === 'end') { const r = rec.st === 'married' ? await divorceFlow(g, rec) : await breakUp(g, rec); if (r) return; }
  }
}
async function familyMenu(g, rec) {
  for (let guard = 0; guard < 40; guard++) {
    const R = rom(g);
    const rows = [];
    const F = fertilityState(g);
    const pw = canPlan(g, rec);
    if (!R.preg && R.kids.length < 4) rows.push({ key: 'plan', label: '子どものことを、話しあう', sub: F.nokids ? 'ふたりの暮らしを大切に（いつでも話せる）' : F.trying ? '授かるのを、待っている' : '授かりかたも、ふたりで決める' });
    if (R.preg) rows.push({ key: 'preg', label: 'おなかの赤ちゃん', sub: `予定日まで あと${Math.max(0, R.preg.due - g.state.day)}日` });
    if (R.kids.length) rows.push({ key: 'kids', label: '子どもたち', sub: R.kids.map((k) => `${k.n}（${kidYears(g, k)}歳）`).join('・') });
    rows.push({ key: 'work', label: '働きかたを、見直す', sub: `${shortName(rec)}：${(WORK[R.home.work] || WORK.dual).label}` });
    if (R.leave) rows.push({ key: 'back', label: 'お仕事に、もどる', sub: `${R.leave.kind === 'ikukyu' ? '育休' : '産休'}中（あと${Math.max(0, R.leave.until - g.state.day)}日）` });
    const b = weeklyBalance(g);
    rows.push({ key: 'money', label: '今週の家計', sub: `${b.net >= 0 ? '+' : '-'}${fmtMoney(Math.abs(b.net))}（収入 ${fmtMoney(b.income)}・生活費 ${fmtMoney(b.cost)}）` });
    const i = await phoneList(g, { title: '家族のこと', color: COLOR, items: rows, hint: 'A:えらぶ　B:もどる' });
    if (i < 0) return;
    const k = rows[i].key;
    if (k === 'plan') await planFlow(g, rec);
    else if (k === 'kids') await kidsMenu(g);
    else if (k === 'work') await workStyleFlow(g, rec);
    else if (k === 'back') await leaveBack(g);
    else if (k === 'preg') await phoneInfo(g, { title: '赤ちゃん', color: COLOR, text: `予定日まで、あと${Math.max(0, R.preg.due - g.state.day)}日。\n\nつわりや、産休・育休のこと。ひとつずつ、ふたりで話しあっていこう。` });
    else if (k === 'money') await phoneInfo(g, { title: '今週の家計', color: COLOR, text: `配偶者の収入：${fmtMoney(b.income)}\n児童手当など：${fmtMoney(b.benefit)}\n生活費：${fmtMoney(b.cost)}\n\n毎週月曜の朝に、差し引きが入る。足りないときは、がまん…。` });
  }
}
async function kidsMenu(g) {
  const R = rom(g);
  for (let guard = 0; guard < 20; guard++) {
    const kids = R.kids;
    if (!kids.length) return;
    const rows = kids.map((k) => ({ label: `${k.n}`, sub: `${kidYears(g, k)}歳・${k.g === 'f' ? '女の子' : '男の子'}${k.by === 'adopt' ? '・迎えた子' : ''}${(R.home.kidsAway || []).includes(k.id) ? '・別々に暮らしている' : ''}`, look: kidLook(g, k) }));
    const i = await phoneList(g, { title: '子どもたち', color: COLOR, items: rows, hint: 'A:えらぶ　B:もどる' });
    if (i < 0) return;
    const k = kids[i];
    const j = await phoneList(g, { title: k.n, color: COLOR, items: [{ label: 'いっしょに遊ぶ', sub: k.pd === g.state.day ? '今日は、遊んだ' : '体力 -5・ストレス -10', disabled: k.pd === g.state.day }, { label: 'ようすを見る', sub: 'いまの成長' }] });
    if (j === 0) await playWithKid(g, k);
    else if (j === 1) await phoneInfo(g, { title: k.n, color: COLOR, text: `${k.n}（${kidYears(g, k)}歳${Math.floor((kidAge(g, k) % 1) * 12)}か月）\n\n${kidStage(g, k)}` });
  }
}
function kidStage(g, k) {
  const a = kidAge(g, k);
  if (a < 0.3) return 'ねんね、おっぱい、うんち。\n夜も昼も、ずっと目がはなせない。';
  if (a < 1) return 'つかまり立ちに、はいはい。\nなんでも口に入れたがる。';
  if (a < 3) return 'ことばが、どんどん増えてきた。\n「イヤ！」も、「だいすき」も、全力。';
  if (a < 6) return '友だちと遊ぶのが、いちばん楽しい。\nおままごとと、ヒーローごっこ。';
  if (a < 12) return '学校の話を、毎日たくさんしてくれる。\n宿題は、なかなか進まない。';
  if (a < 18) return '少しずつ、口数が減ってきた。\nでも、見えないところで、ちゃんと成長している。';
  return 'すっかり大人。\nこれからは、ひとりの友人として。';
}

// ---------------------------------------------------------------- the invitations and the ways of meeting
async function inviteMenu(g) {
  const R = rom(g);
  for (let guard = 0; guard < 10; guard++) {
    const inv = R.inv.filter((x) => g.state.day <= x.until);
    if (!inv.length) { await phoneInfo(g, { title: 'お誘いとお返事', color: COLOR, text: 'いまは、お返事を待っているお誘いは、ない。\n\n友だちや家族から、紹介の話が来ることがある。' }); return; }
    const label = { goukon: '合コンのお誘い', shokai: '紹介したい人がいる', omiai: 'お見合いのお話', aibou: '相方が友だちを紹介したい', shokuba: '現場で声をかけられた' };
    const rows = inv.map((x) => ({ label: label[x.k] || 'お誘い', sub: `${x.from && PEOPLE[x.from] ? PEOPLE[x.from].name + 'から・' : ''}あと${Math.max(0, x.until - g.state.day)}日`, look: x.from && PEOPLE[x.from] ? PEOPLE[x.from].look : undefined }));
    const i = await phoneList(g, { title: 'お誘いとお返事', color: COLOR, items: rows, hint: 'A:お返事　B:もどる' });
    if (i < 0) return;
    const j = await phoneConfirm(g, { title: label[inv[i].k] || 'お誘い', color: COLOR, text: '行ってみる？\n（断っても、だいじょうぶ）', choices: ['行ってみる', 'ことわる', 'あとで'] });
    if (j === 2 || j < 0) continue;
    await answerInvite(g, inv[i], j === 0);
    if (j === 0) return;
  }
}
async function meetMenu(g) {
  const era = eraOf(g);
  for (let guard = 0; guard < 10; guard++) {
    const opts = meetOptions(g);
    const rows = opts.map((o) => ({ label: o.name, sub: o.desc, right: o.price ? fmtMoney(o.price) : '無料', disabled: !!o.why, why: o.why }));
    const i = await phoneList(g, { title: '出会いをさがす', color: COLOR, items: rows, hint: 'A:えらぶ　B:もどる', describe: (k) => opts[k] ? (opts[k].why ? `（${opts[k].why}）` : opts[k].desc) : '' });
    if (i < 0) return;
    const o = opts[i];
    if (o.kind === 'app') { await appMenu(g); continue; }
    if (!(await phoneConfirm(g, { title: o.name, color: COLOR, text: `${o.desc}\n\n${o.price ? '参加費：' + fmtMoney(o.price) + '\n' : ''}体力を少し使う。\n（気が向かなければ、やめてもいい）`, choices: ['参加する', 'やめておく'] }) === 0)) continue;
    const r = await runMeet(g, o.kind);
    if (r) return;
  }
}
async function appMenu(g) {
  const R = rom(g);
  for (let guard = 0; guard < 6; guard++) {
    const list = appProfiles(g);
    const rows = list.map((p) => ({ label: `${p.giv}（${recAge(g, p)}歳）`, sub: `${jobOf(g, p)}・${prefecture(p.hm).name}・休日は${p.hobby}`, look: recLook(p, eraOf(g)), disabled: !!p.liked, why: 'もう「いいね」を送った', right: p.liked ? '送信ずみ' : '' }));
    const i = await phoneList(g, { title: 'マッチングアプリ', color: COLOR, items: rows, hint: 'A:プロフィール　B:もどる', describe: (k) => (list[k] ? `「${list[k].line}」` : '') });
    if (i < 0) return;
    const p = list[i];
    const j = await phoneConfirm(g, { title: `${p.giv}さん`, color: COLOR, text: `${recAge(g, p)}歳・${jobOf(g, p)}\n${prefecture(p.hm).name}出身\n休日は、${p.hobby}。\n\n「${p.line}」`, choices: ['いいね！を送る', 'パスする'] });
    if (j === 0) { const r = await appLike(g, p); p.liked = true; if (r) return; }
  }
}

// ---------------------------------------------------------------- the 家族アルバム
const ALBUM_ART = { wedding: 'chapel', nyuseki: 'yakusho', kokuhaku: 'yakei', cohab: 'home', engaged: 'yakei', honeymoon: 'tabi', birth: 'sanin', preg: 'home', miya: 'jinja', okuizome: 'home', age1: 'home', enter: 'hoikuen', school: 'hanami', junior: 'hanami', adult: 'home', xmas: 'illumi', hatsumode: 'jinja', hanabi: 'hanabi', rikon: 'park', adopt: 'home', shichigosan: 'jinja', anniv: 'gohan', bday: 'home' };
const ALBUM_NOTE = {
  anniv: '今年も、ふたりでこの日を迎えられた。', bday: 'ろうそくを、ふーっと吹き消した。',
  kokuhaku: 'はじめて気持ちを伝えた日。\nドキドキして、手がふるえていた。', cohab: 'ふたりの部屋、ふたりの時間。\n歯ブラシが2本ならんだ。', engaged: '「結婚してください」。\nうれしくて、少し泣いた。',
  nyuseki: '婚姻届を出した日。\n紙一枚で、でも大きな一歩。', wedding: 'たくさんの人に祝ってもらった日。', honeymoon: 'ふたりきりの旅。\n見た景色を、ずっと忘れない。', preg: 'おなかの中の、小さな命。',
  birth: 'はじめまして。\n生まれてきてくれて、ありがとう。', miya: '元気に育ちますように。', okuizome: '一生、食べものに困りませんように。', age1: '一升餅を背負って、ころん。', enter: 'はじめての、ひとりのお出かけ。',
  school: '新しいランドセルが、ぶかぶか。', junior: '制服が、ちょっと大きい。', adult: '大きくなったね。', xmas: '白い息が、ふたりの間で混ざった。', hatsumode: '今年も、いい一年になりますように。', hanabi: '夜空に、大輪の花。', shichigosan: '千歳飴を、ぎゅっとにぎって。', adopt: '血のつながりより、いっしょの時間。', rikon: 'いろいろあった。それでも、ありがとう。',
};
function albumX(g, e) {
  const R = rom(g), era = eraOf(g);
  const sp = spouseRec(g) || leadRec(g) || Object.values(R.c)[0];
  const you = sp ? recLook(sp, era) : {};
  const X = { me: g.state.look || {}, you, kids: null, phase: ['kokuhaku', 'engaged', 'xmas', 'hanabi'].includes(e.k) ? 'night' : 'day', wx: 'sunny', extra: { era }, hearts: ['xmas', 'engaged'].includes(e.k), banner: e.k === 'school' ? '入学式' : e.k === 'junior' ? '入学式' : undefined };
  if (['birth', 'miya', 'okuizome', 'age1', 'enter', 'school', 'junior', 'adult', 'shichigosan', 'adopt', 'bday'].includes(e.k)) {
    const k = R.kids.find((x) => x.id === e.kid) || R.kids[0];
    if (k) X.kids = [{ look: kidLook(g, k), k: kidScale(g, k) || 0.55, baby: kidAge(g, k) < 1 }];
  }
  if (e.k === 'wedding') {
    const groom = { ...(g.state.look || {}), top: '#2a2a32', bottom: '#2a2a32', jacket: true, tie: '#f2f2f2' };
    const bride = { ...(you || {}), top: '#ffffff', bottom: '#ffffff', skirt: true };
    X.extra = { era, leftLook: groom, rightLook: bride };
  }
  return X;
}
function albumView(g) {
  const R = rom(g);
  const pages = R.album.slice().reverse();
  const [cv, cx] = makeCanvas(AW, AH);
  return {
    title: '家族アルバム', color: COLOR, bg: '#f4ecdf', cancel: -1, i: 0, hint: '←→:ページ　B:もどる',
    update(ph, inp) {
      if (inp.repeat('left') || inp.repeat('up')) { this.i = Math.max(0, this.i - 1); audio.sfx('cursor'); }
      if (inp.repeat('right') || inp.repeat('down')) { this.i = Math.min(pages.length - 1, this.i + 1); audio.sfx('cursor'); }
      if (inp.pressed('b') || inp.pressed('a')) { audio.sfx('cancel'); ph.back(-1); }
    },
    tap(ph, x, y) {
      const a = this.area;
      if (!a) return false;
      if (x < a.x + a.w / 2) this.i = Math.max(0, this.i - 1); else this.i = Math.min(pages.length - 1, this.i + 1);
      return false;
    },
    draw(c, ph, a) {
      this.area = a;
      if (!pages.length) { T(c, 'まだ、アルバムに写真がない。', a.x + a.w / 2, a.y + a.h / 2 - 8, 12, PC.dim, 'center'); return; }
      const e = pages[Math.min(this.i, pages.length - 1)];
      const art = ALBUM_ART[e.k] || 'home';
      cx.clearRect(0, 0, AW, AH);
      try { (ALL[art] || ALL.home)(cx, 40 + (ph.t >> 2), albumX(g, e)); } catch (err) { console.error(err); }
      // a polaroid
      const pw = a.w - 16, ph0 = Math.round((pw - 16) * 112 / 224);
      box(c, a.x + 8, a.y + 6, pw, ph0 + 40, 3, '#ffffff', '#c8bca8', { lo: '#e8e0d0' });
      c.imageSmoothingEnabled = true;
      c.drawImage(cv, 48, 0, 224, 112, a.x + 16, a.y + 14, pw - 16, ph0);
      c.imageSmoothingEnabled = false;
      T(c, fitText(c, e.cap, pw - 20, 14), a.x + 8 + pw / 2, a.y + 14 + ph0 + 6, 14, PC.text, 'center');
      let when = `${e.d}日目`;
      try { const d = g.gameDate(e.d); if (d && d.year) when = `${d.year}年${d.month}月`; } catch (err) { /* keep */ }
      T(c, when, a.x + 8 + pw / 2, a.y + 14 + ph0 + 24, 12, PC.dim, 'center');
      const note = ALBUM_NOTE[e.k];
      if (note) wrap(c, note, a.w - 40, 12).slice(0, 3).forEach((l, j) => T(c, l, a.x + a.w / 2, a.y + 14 + ph0 + 56 + j * 16, 12, PC.text, 'center'));
      T(c, `${this.i + 1} / ${pages.length}`, a.x + a.w / 2, a.y + a.h - 18, 12, PC.dim, 'center');
      if (this.i > 0) T(c, '◀', a.x + 6, a.y + a.h / 2 + 30, 14, PC.dim);
      if (this.i < pages.length - 1) T(c, '▶', a.x + a.w - 20, a.y + a.h / 2 + 30, 14, PC.dim);
    },
  };
}
async function historyView(g) {
  const R = rom(g);
  const lines = R.hist.slice().reverse().map((h) => {
    let when = `${h.d}日目`;
    try { const d = g.gameDate(h.d); if (d && d.year) when = `${d.year}年${d.month}月`; } catch (e) { /* keep */ }
    return `${when}　${h.t}`;
  });
  await phoneInfo(g, { title: 'ふたりの記録', color: COLOR, text: lines.length ? lines.join('\n') : 'まだ、記録はない。\n\nこれからのできごとが、ここに残っていく。' });
}

// ---------------------------------------------------------------- the root
async function romanceApp(g) {
  const R0 = rom(g);
  ensureRomance(g);
  if (R0.pref === null) { const ok = await introFlow(g); if (!ok) { if (R0.pref === null) return; } }
  for (let guard = 0; guard < 200; guard++) {
    const R = rom(g);
    ensureRomance(g);
    syncLegacy(g);
    const era = eraOf(g);
    const rows = [];
    const lead = leadRec(g);
    if (lead) rows.push({ key: 'lead', label: lead.n, sub: `${partnerWord(g, lead)}・${stageSub(g, lead)}`, look: recLook(lead, era), right: '' });
    if (active(g)) {
      const cs = candidates(g);
      rows.push({ key: 'cands', label: lead ? '友だち・知り合い' : '気になる人・知り合い', sub: cs.length ? cs.slice(0, 3).map((r) => (r.castCand ? (PEOPLE[r.id] && (PEOPLE[r.id].short || PEOPLE[r.id].name)) : shortName(r))).join('・') : 'まだ、だれもいない', right: cs.length ? `${cs.length}人` : '' });
      const invN = R.inv.filter((x) => g.state.day <= x.until).length;
      rows.push({ key: 'inv', label: 'お誘いとお返事', sub: invN ? '返事を待っている人がいる' : '友だちや家族からの紹介', right: invN ? `${invN}件` : '', rightColor: '#e2569a' });
      if (!lead || lead.st === 'know') rows.push({ key: 'meet', label: '出会いをさがす', sub: era === 'reiwa' ? '合コン・パーティー・アプリ' : era === 'heisei' ? '合コン・婚活パーティー' : '合コン・お見合い・パーティー' });
    }
    if (R.album.length || R.kids.length) rows.push({ key: 'album', label: '家族アルバム', sub: `${R.album.length}枚の思い出`, right: '' });
    rows.push({ key: 'hist', label: 'ふたりの記録', sub: 'これまでのできごと' });
    rows.push({ key: 'set', label: '設定', sub: `気になる相手：${{ m: '男性', f: '女性', any: 'どちらでも', off: 'いまは考えない' }[R.pref] || '？'}` });
    const i = await phoneList(g, { title: appTitle(g), color: COLOR, items: rows, hint: 'A:えらぶ　B:もどる', describe: (k) => (rows[k] && rows[k].key === 'set' ? '気になる相手は、いつでも変えられる。' : '') });
    if (i < 0) return;
    const k = rows[i].key;
    if (k === 'lead') await leadMenu(g);
    else if (k === 'cands') {
      for (let guard2 = 0; guard2 < 20; guard2++) {
        const cs = candidates(g);
        if (!cs.length) { await phoneInfo(g, { title: '気になる人', color: COLOR, text: 'まだ、だれもいない。\n\n「出会いをさがす」から、あるいは、友だちや家族から、ご縁がめぐってくることもある。' }); break; }
        const crow = cs.map((r) => {
          if (r.castCand) { const P = PEOPLE[r.id]; return { label: P.name, sub: `友だち・${D.PERS[CAST[r.id].per].first}`, look: P.look, right: '' }; }
          return { label: `${r.cast ? PEOPLE[r.id].short : shortName(r)}（${recAge(g, r)}歳）`, sub: `${jobOf(g, r)}・${D.STAGES[r.st].name}${r.kn && r.kn.length ? '・' + compatLine(g, r) : ''}`, look: PEOPLE[r.id] ? PEOPLE[r.id].look : recLook(r, era), right: '' };
        });
        const j = await phoneList(g, { title: lead ? '友だち・知り合い' : '気になる人', color: COLOR, items: crow, hint: 'A:えらぶ　B:もどる' });
        if (j < 0) break;
        await personMenu(g, cs[j]);
        if (leadRec(g)) break;
      }
    } else if (k === 'inv') await inviteMenu(g);
    else if (k === 'meet') await meetMenu(g);
    else if (k === 'album') await phoneView(g, albumView(g));
    else if (k === 'hist') await historyView(g);
    else if (k === 'set') {
      const j = await phoneConfirm(g, { title: '気になる相手', color: COLOR, text: 'いま、どんな人が気になる？\n（これまでの人間関係は、そのまま）', choices: ['男性が気になる', '女性が気になる', 'どちらでも', 'いまは考えない'] });
      R.pref = ['m', 'f', 'any', 'off'][j] || R.pref;
    }
  }
}

registerPhoneApp('romance', {
  name: (g) => (['showa', 'heisei_early'].includes(eraOf(g)) ? 'ひとこと' : '恋のはなし'), // (≤5 chars on the home screen; the title inside is 「ひとことメモ」) color: COLOR, order: 26, iconHD,
  cond: (g) => !!g && !!g.state && !!g.state.profile && ageOf(g.state) >= 18,
  badge: (g) => { try { ensureRomance(g); const R = rom(g); return R.inv.filter((x) => g.state.day <= x.until).length; } catch (e) { return 0; } },
  open: (g) => romanceApp(g),
});

// ---------------------------------------------------------------- the talk menu of a cast person (when you are looking for someone)
PEOPLE_UI.extras.push({
  id: 'rom_date', label: 'デートにさそう', order: 22,
  cond: (g, id) => { try { return active(g) && !!CAST[id] && g.aff(id) >= 35 && (() => { const R = rom(g); return (R.pref === 'any' || R.pref === CAST[id].g) && !(R.c[id] && R.c[id].st === 'ex'); })(); } catch (e) { return false; } },
  run: async (g, id) => {
    const R = rom(g);
    const rec = recOf(g, id) || adoptCast(g, id);
    if (!rec) return;
    await dateFlow(g, rec);
    return 'end';
  },
});
PEOPLE_UI.extras.push({
  id: 'rom_kokuhaku', label: '付き合ってほしい', order: 23,
  cond: (g, id) => { try { const R = rom(g); if (!active(g) || !CAST[id] || R.lead) return false; if (!(R.pref === 'any' || R.pref === CAST[id].g)) return false; const rec = R.c[id]; return !!rec && (rec.st === 'close' || rec.st === 'know') && rec.dates >= 1 && g.aff(id) >= 40; } catch (e) { return false; } },
  run: async (g, id) => { const rec = recOf(g, id); if (!rec) return; await confessFlow(g, rec); return 'end'; },
});

// the 家族 app (family.js) gets a row for the 家族アルバム once there is a family
FAMILY_ROWS.push((g) => {
  const R = rom(g);
  if (!R || !(R.album.length || R.kids.length) || !hasLife(g)) return null;
  return { label: '家族アルバム', sub: `ふたりと子どもの思い出（${R.album.length}枚）`, run: (g2) => phoneView(g2, albumView(g2)) };
});

export { romanceApp, albumView, inviteMenu, meetMenu, appMenu, kidsMenu, familyMenu, leadMenu, personMenu, historyView, showInfo, introFlow };
