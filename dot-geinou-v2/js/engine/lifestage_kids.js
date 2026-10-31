// 親キャリア (R30) — the children of 恋愛・結婚・家庭 (romance_kids.js: R.kids) grow through the same stages as the player:
// 赤ちゃん・幼児 → 小学生 → 中学生 → 高校生 → 18歳の巣立ち (大学・専門・就職) → 社会人. Each child has the six life stats, 習いごと /
// 塾 / 保育園, a club, 通知表 every term, school events the parent may attend (運動会・授業参観・発表会), a gentle 反抗期, the 高校 and the
// 進路; the parent earns 親ポイント and a title (新米パパ → 子育て名人). romance_kids.js keeps its own scenes (入学式・七五三・誕生日…);
// this module adds the numbers and the choices, shown in the 生活 screen's 子育て tab. No illness or loss here.
//
// State: g.state.flags.ls.kids[kidId] = { stats, lesson, juku, hoiku, club, reports [], hs (高校の種類), path, plan, after { kind, ind },
//   d (done flags), last { act: day }, joy } ; ls.parent = { pts, log [] }
// API: lifeKids() lifeKidActions(kidId) lifeKidAct(kidId, actId, o) lifeParent()
import { Game } from './game.js';
import { profileOf } from './profile.js';
import { clamp, fmtMoney } from './util.js';
import { rom, kidAge, kidYears, kidLook } from './romance.js';
import * as D from './lifestage_data.js';
import { ensure, gain, addHist, addInbox, onInbox, dateOf, yearNow, lsRand, KID_WEEKLY, KID_TICK, KID_COSTS, toastLater } from './lifestage.js';

const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (g, k) => !!g && typeof g[k] === 'function';
const joinG = (a) => (a.length ? `（${a.join('　')}）` : '');
const STAGE_NAME = { baby: '赤ちゃん・幼児', elem: '小学生', mid: '中学生', high: '高校生', adult: '大人' };

function kidsOf(g) { try { const R = rom(g); return R && Array.isArray(R.kids) ? R.kids : []; } catch (e) { return []; } }
const awayIds = (g) => { try { return (rom(g).home && rom(g).home.kidsAway) || []; } catch (e) { return []; } };
export function kidState(g, k) {
  const L = ensure(g);
  if (!L || !k) return null;
  let K = L.kids[k.id];
  if (!isObj(K)) {
    const a = kidAge(g, k);
    // a child adopted or already grown gets stats fitting the age
    const base = Math.min(40, Math.round(a * 3));
    K = L.kids[k.id] = { stats: { gaku: 6 + base, tai: 12 + base, kan: 8 + base, yu: 8 + base, sei: 3 + Math.round(base / 2), ken: 86 }, lesson: null, juku: false, hoiku: false, club: null, reports: [], hs: null, path: null, plan: null, after: null, d: {}, last: {}, joy: 60 };
  }
  if (!isObj(K.stats)) K.stats = { gaku: 10, tai: 15, kan: 10, yu: 10, sei: 5, ken: 86 };
  for (const s of D.STAT_ORDER) K.stats[s] = clamp(Math.round(num(K.stats[s], 20)), 0, 100);
  if (!Array.isArray(K.reports)) K.reports = [];
  if (!isObj(K.d)) K.d = {};
  if (!isObj(K.last)) K.last = {};
  K.joy = clamp(num(K.joy, 60), 0, 100);
  return K;
}
const kidStage = (g, k) => D.kidStageOf(kidAge(g, k));
const kidWord = (k) => (k.g === 'f' ? 'ちゃん' : 'くん');
const parentAdd = (g, L, n, why) => { L.parent.pts = num(L.parent.pts) + n; if (why) { L.parent.log.push({ d: g.state.day, t: why, n }); if (L.parent.log.length > 30) L.parent.log.shift(); } };

// ---------------------------------------------------------------- what a parent can do (per child, once a day each)
const KACTS = [
  { id: 'read', name: '絵本を読み聞かせる', st: ['baby'], cost: 4, min: 30, gain: { kan: 2, yu: 1 }, pts: 2, text: (k) => `${k.n}に絵本を読んだ。同じページを、何度も「もういっかい」。` },
  { id: 'play', name: 'いっしょに遊ぶ', st: ['baby', 'elem'], cost: 5, min: 60, gain: { tai: 2, yu: 1 }, pts: 2, stress: 8, text: (k, a) => (a < 6 ? `${k.n}と公園で、すべり台とブランコ。笑い声が、ずっとひびいていた。` : `${k.n}とキャッチボール。いつのまにか、ボールが強くなった。`) },
  { id: 'homework', name: '宿題を見てあげる', st: ['elem'], cost: 4, min: 45, gain: { gaku: 2 }, pts: 2, text: (k) => `${k.n}の宿題を、となりで見た。「わかった！」の顔が、うれしい。` },
  { id: 'chores', name: 'お手伝いを教える', st: ['elem', 'mid'], cost: 3, min: 40, gain: { sei: 2, yu: 1 }, pts: 2, text: (k) => `${k.n}と、いっしょにカレーを作った。にんじんの形は、ばらばらだ。` },
  { id: 'study', name: '勉強をみる', st: ['mid', 'high'], cost: 5, min: 60, gain: { gaku: 2 }, pts: 2, text: (k) => `${k.n}の勉強を見た。…正直、もう教えられない問題もある。` },
  { id: 'talk', name: 'ゆっくり話を聞く', st: ['mid', 'high'], cost: 3, min: 45, gain: { yu: 1, ken: 1 }, pts: 3, joy: 6, text: (k) => `${k.n}と、晩ごはんのあとに話した。学校のこと、友だちのこと。少しだけ、本音が聞けた。` },
  { id: 'cheer', name: '部活の試合を応援に行く', st: ['mid', 'high'], cost: 8, min: 180, gain: { tai: 1, yu: 1 }, pts: 4, joy: 8, weekend: true, needClub: true, text: (k, a, K) => `${k.n}の${D.CLUBS[K.club] ? D.CLUBS[K.club].name : '部活'}の${D.CLUBS[K.club] && D.CLUBS[K.club].sport ? '試合' : '発表'}を見に行った。こっちに気づいて、小さく手をふってくれた。` },
  { id: 'callkid', name: '電話する', st: ['adult'], cost: 1, min: 20, gain: { yu: 1 }, pts: 1, joy: 4, text: (k, a, K) => `${k.n}に電話した。${K.after && K.after.kind === 'uni' ? '「レポートが大変で〜」' : K.after && K.after.kind === 'work' ? '「仕事、なんとかやってるよ」' : '「元気だよ」'}。声が聞けて、ほっとした。` },
];
const KSETS = [
  { id: 'hoiku', st: ['baby'], name: (K) => (K.hoiku ? '保育園をやめる' : '保育園・幼稚園に預ける'), sub: (K) => (K.hoiku ? `いま預けている（週 ${fmtMoney(D.KID_FEES.hoiku)}）` : `週 ${fmtMoney(D.KID_FEES.hoiku)}・友情が育つ・夜泣きのストレスが少し減る`) },
  { id: 'lesson', st: ['elem', 'mid'], name: (K) => (K.lesson ? `習いごと：${D.LESSONS[K.lesson].name}` : '習いごとを始める'), sub: (K) => (K.lesson ? `週 ${fmtMoney(D.LESSONS[K.lesson].fee)}・えらびなおす／やめる` : 'ピアノ・スイミング・そろばん…（週の月謝）'), pick: true },
  { id: 'juku', st: ['mid', 'high'], name: (K) => (K.juku ? '塾をやめる' : '塾に通わせる'), sub: (K) => (K.juku ? `いま通っている（週 ${fmtMoney(D.KID_FEES.juku)}）` : `週 ${fmtMoney(D.KID_FEES.juku)}・学力が伸びやすい`) },
  { id: 'allow', st: ['adult'], name: () => '仕送りする', sub: (K) => (K.after && K.after.kind === 'uni' ? `${fmtMoney(10000)}・大学生活を応援` : `${fmtMoney(10000)}・ひとり暮らしを応援`) },
];

export function kidActions(g, kidId) {
  const L = ensure(g), k = kidsOf(g).find((x) => x.id === kidId);
  if (!L || !k) return [];
  const K = kidState(g, k), stg = kidStage(g, k), away = awayIds(g).includes(k.id), day = g.state.day, wd = ((day - 1) % 7 + 7) % 7;
  const out = [];
  for (const a of KACTS) {
    if (!a.st.includes(stg)) continue;
    let why = '';
    if (away && a.id !== 'callkid') why = 'いまは離れて暮らしている';
    else if (K.last[a.id] === day) why = '今日は、もうした';
    else if (a.weekend && wd < 5) why = '試合は週末（土・日）';
    else if (a.needClub && (!K.club || D.CLUBS[K.club].none)) why = '部活に入っていない';
    else if (g.state.stamina < a.cost) why = `体力が足りない（${a.cost}必要）`;
    out.push({ id: a.id, name: a.name, sub: `${a.min >= 60 ? `${a.min / 60}時間` : `${a.min}分`}・体力 -${a.cost}・${Object.entries(a.gain).map(([s, v]) => `${D.STATS[s].name}+${v}`).join(' ')}`, why });
  }
  for (const s of KSETS) {
    if (!s.st.includes(stg)) continue;
    const why = away ? 'いまは離れて暮らしている' : s.id === 'allow' && K.last.allow && day - K.last.allow < 14 ? '2週間に1回まで' : s.id === 'allow' && g.state.money < 10000 ? 'お金が足りない' : '';
    out.push({ id: s.id, name: s.name(K), sub: s.sub(K), why, pick: s.pick ? lessonPick(g, K) : null, set: true });
  }
  return out;
}
function lessonPick(g, K) {
  const ids = D.lessonsFor(yearNow(g));
  return { title: '習いごと（週の月謝）', items: [...ids.map((id) => ({ label: D.LESSONS[id].name, sub: `週 ${fmtMoney(D.LESSONS[id].fee)}・${Object.entries(D.LESSONS[id].g).map(([s, v]) => `${D.STATS[s].name}+`).join('')}`, id })), { label: K.lesson ? 'やめる' : '今はやめておく', sub: '', id: null }] };
}
export function kidAct(g, kidId, actId, o = {}) {
  const L = ensure(g), k = kidsOf(g).find((x) => x.id === kidId);
  if (!L || !k) return { ok: false, text: 'その子は、いないようだ。' };
  const row = kidActions(g, kidId).find((x) => x.id === actId);
  if (!row) return { ok: false, text: 'いまは、それはできない。' };
  if (row.why) return { ok: false, text: row.why };
  const K = kidState(g, k), a = KACTS.find((x) => x.id === actId), age = kidAge(g, k), day = g.state.day;
  if (a) {
    g.state.stamina = Math.max(0, g.state.stamina - a.cost);
    try { if (has(g, 'advanceTime')) g.advanceTime(a.min, 'kid'); } catch (e) { /* tests */ }
    K.last[a.id] = day;
    if (a.id === 'play') k.pd = day; // romance's own 「遊ぶ」 counts the same day
    const gs = gain(K, a.gain);
    K.joy = clamp(K.joy + num(a.joy, 4), 0, 100);
    parentAdd(g, L, a.pts, a.name);
    try { g.relax({ stress: num(a.stress, 4) }); } catch (e) { /* tests */ }
    return { ok: true, text: `${a.text(k, age, K)}${joinG(gs)}　親ポイント+${a.pts}` };
  }
  if (actId === 'hoiku') { K.hoiku = !K.hoiku; if (K.hoiku) addHist(g, `${k.n}を保育園に預けはじめた`, 'family'); return { ok: true, text: K.hoiku ? `${k.n}を保育園に預けることにした。（月曜に週の保育料）` : '保育園をやめた。' }; }
  if (actId === 'juku') { K.juku = !K.juku; return { ok: true, text: K.juku ? `${k.n}を塾に通わせることにした。` : '塾をやめた。' }; }
  if (actId === 'lesson') {
    const P = lessonPick(g, K);
    if (!Number.isFinite(Number(o.pick))) return { ok: false, text: 'えらんでください。', needPick: true, pick: P };
    const it = P.items[clamp(num(o.pick), 0, P.items.length - 1)];
    const before = K.lesson;
    K.lesson = it.id || null;
    if (K.lesson && K.lesson !== before) { addHist(g, `${k.n}が${D.LESSONS[K.lesson].name}を習いはじめた`, 'family'); parentAdd(g, L, 2, '習いごと'); return { ok: true, text: `${k.n}は、${D.LESSONS[K.lesson].name}を習うことになった！（週 ${fmtMoney(D.LESSONS[K.lesson].fee)}）` }; }
    return { ok: true, text: K.lesson ? '習いごとは、そのまま続ける。' : '習いごとは、やめておく。' };
  }
  if (actId === 'allow') { if (!g.spend(10000)) return { ok: false, text: 'お金が足りない。' }; K.last.allow = day; K.joy = clamp(K.joy + 6, 0, 100); parentAdd(g, L, 2, '仕送り'); return { ok: true, text: `${k.n}に ${fmtMoney(10000)} を送った。「ありがとう、助かる！」と連絡がきた。` }; }
  return { ok: false, text: 'いまは、それはできない。' };
}

// ---------------------------------------------------------------- the months and the weeks
function reportKid(g, k, K, prev) {
  const s = K.stats, subs = kidStage(g, k) === 'elem' ? D.ELEM_SUBJECTS : D.SUBJECTS;
  const rows = subs.map(([name, w]) => { let v = 0; for (const [st, x] of Object.entries(w)) v += s[st] * x; v = v + (lsRand() - 0.5) * 14; return [name, D.mark5(v + (kidStage(g, k) === 'elem' ? 18 : 0))]; });
  const avg = Math.round((rows.reduce((a, r) => a + r[1], 0) / rows.length) * 10) / 10;
  const ks = D.STAT_ORDER.filter((x) => x !== 'ken');
  const best = ks.reduce((a, x) => (s[x] > s[a] ? x : a), ks[0]);
  const term = prev === 7 ? 1 : prev === 12 ? 2 : 3;
  K.reports.push({ d: g.state.day, label: `${STAGE_NAME[kidStage(g, k)]}・${term}学期`, rows, avg, comment: D.TEACHER[best] });
  if (K.reports.length > 6) K.reports.shift();
  return avg;
}
function kidMonth(g, L, d, prev, notes) {
  const kids = kidsOf(g), away = awayIds(g);
  for (const k of kids) {
    const K = kidState(g, k), a = kidAge(g, k), stg = D.kidStageOf(a), yrs = kidYears(g, k);
    if (away.includes(k.id) && stg !== 'adult') continue;
    // report cards at the end of each term (小・中・高)
    const termEnd = (prev === 7 && d.month === 8) || (prev === 12 && d.month === 1) || (prev === 3 && d.month === 4);
    if (termEnd && (stg === 'elem' || stg === 'mid' || stg === 'high')) { const avg = reportKid(g, k, K, prev); notes.push(`（${k.n}が通知表をもらってきた。平均 ${avg}。生活画面の子育てで見られる）`); }
    // clubs: a 中学生 picks one by what they are good at
    if (stg === 'mid' && !K.club && d.month === 4) {
      const best = ['tai', 'kan', 'gaku', 'yu'].reduce((x, y) => (K.stats[y] > K.stats[x] ? y : x), 'tai');
      const pool = best === 'tai' ? ['soccer', 'yakyu', 'basket', 'rikujo', 'tennis'] : best === 'kan' ? ['suisou', 'bijutsu', 'engeki', 'keion'] : best === 'gaku' ? ['housou', 'bijutsu'] : ['suisou', 'tennis', 'basket'];
      K.club = pool[Math.floor(lsRand() * pool.length)];
      addHist(g, `${k.n}が${D.CLUBS[K.club].name}に入った`, 'family');
      notes.push(`（${k.n}、${D.CLUBS[K.club].name}に入ったらしい。「見に来なくていいからね」）`);
    }
    // events the parent may come to
    if (stg === 'elem' && d.month === (k.ls % 2 ? 5 : 10) && K.d.undo !== `${d.year}`) { K.d.undo = `${d.year}`; addInbox(g, { kind: 'kid_event', key: `undo_${k.id}_${d.year}`, title: `${k.n}の運動会`, text: `${k.n}の小学校の運動会。かけっこに出るらしい。`, choices: ['見に行く（体力 -10）', '仕事で行けない…'], def: 1, days: 6, data: { kid: k.id, ev: 'undo' } }); }
    if (stg === 'elem' && d.month === 6 && K.d.sankan !== `${d.year}`) { K.d.sankan = `${d.year}`; addInbox(g, { kind: 'kid_event', key: `sankan_${k.id}_${d.year}`, title: `${k.n}の授業参観`, text: `授業参観のお知らせ。作文を発表するらしい。`, choices: ['見に行く（体力 -6）', '行けない'], def: 1, days: 6, data: { kid: k.id, ev: 'sankan' } }); }
    if (K.lesson && (stg === 'elem' || stg === 'mid') && (d.month === 2 || d.month === 9) && K.d.show !== `${d.year}_${d.month}`) { K.d.show = `${d.year}_${d.month}`; addInbox(g, { kind: 'kid_event', key: `show_${k.id}_${d.year}_${d.month}`, title: `${k.n}の${D.LESSONS[K.lesson].show}`, text: `${D.LESSONS[K.lesson].name}の${D.LESSONS[K.lesson].show}がある。`, choices: ['見に行く（体力 -6）', '行けない'], def: 1, days: 6, data: { kid: k.id, ev: 'show' } }); }
    if (stg === 'mid' && yrs >= 13 && !K.d.hanko && lsRand() < 0.25) { K.d.hanko = 1; addInbox(g, { kind: 'kid_hanko', key: `hanko_${k.id}`, title: `${k.n}の反抗期？`, text: `このごろ${k.n}が、あまり口をきいてくれない。部屋にこもりがちだ。`, choices: ['そっと見守る', 'ちゃんと向きあって話す', '強く注意する'], def: 0, days: 10, data: { kid: k.id } }); }
    // 高校: decided at 15 (romance asks the path; the result comes here)
    if (stg === 'high' && !K.hs) {
      const p = k.path || K.path;
      K.hs = p === 'special' ? 'geino' : K.stats.gaku >= 58 ? 'shingaku' : K.stats.sei >= 40 && lsRand() < 0.4 ? 'jitsugyo' : 'futsu';
      const name = K.hs === 'geino' ? '芸術・専門のコースがある高校' : D.HIGH_TYPES[K.hs].name;
      addHist(g, `${k.n}が高校（${name}）に進学した`, 'family');
      notes.push(`（${k.n}、高校に合格！ ${name}に通う。おめでとう！）`);
      parentAdd(g, L, 6, '高校合格');
    }
    // 進路 at 17 (10月)
    if (stg === 'high' && yrs >= 17 && d.month === 10 && !K.plan) addInbox(g, { kind: 'kid_plan', key: `plan_${k.id}`, title: `${k.n}の進路相談`, text: `${k.n}が、卒業後のことを相談してきた。（学力 ${K.stats.gaku}・感性 ${K.stats.kan}・生活力 ${K.stats.sei}）`, choices: ['大学に行きたいなら、応援する（学費を出す）', '奨学金で大学に（本人が返す）', '専門学校で手に職を', '本人の決めた就職を応援する'], def: 3, days: 15, data: { kid: k.id } });
    // 18: after the 巣立ち (romance's scene), the path happens
    if (stg === 'adult' && !K.after) {
      const plan = K.plan || (K.stats.gaku >= 50 ? 'uniSelf' : 'work');
      if (plan === 'uni' || plan === 'uniSelf') {
        const pass = lsRand() < clamp(0.35 + (K.stats.gaku - 40) / 60, 0.15, 0.95);
        K.after = pass ? { kind: 'uni', pay: plan === 'uni', since: g.state.day } : { kind: 'work', ind: pickInd(K), since: g.state.day, ronin: true };
        notes.push(pass ? `（${k.n}、大学に合格！ 春から大学生だ）` : `（${k.n}は第一志望に届かず…。「働きながら、考える」と前を向いた）`);
        addHist(g, pass ? `${k.n}が大学に進学した` : `${k.n}が社会に出た`, 'family');
      } else if (plan === 'senmon') { K.after = { kind: 'senmon', since: g.state.day }; notes.push(`（${k.n}、専門学校に入学。好きなことを仕事にするんだ、と張りきっている）`); addHist(g, `${k.n}が専門学校に入った`, 'family'); }
      else { K.after = { kind: 'work', ind: pickInd(K), since: g.state.day }; notes.push(`（${k.n}、${D.INDUSTRIES[K.after.ind].name}に就職！ 初任給で、何か買ってくれるらしい）`); addHist(g, `${k.n}が${D.INDUSTRIES[K.after.ind].name}に就職した`, 'family'); }
      parentAdd(g, L, 8, '巣立ち');
    }
    // the college years: tuition twice a year when the parent pays; a job at 22
    if (stg === 'adult' && K.after && K.after.kind === 'uni' && K.after.pay && (d.month === 4 || d.month === 10) && K.d.fee !== `${d.year}_${d.month}`) {
      K.d.fee = `${d.year}_${d.month}`;
      const fee = D.KID_FEES.uniSemester;
      if (g.spend(fee)) notes.push(`（${k.n}の大学の学費 ${fmtMoney(fee)} をはらった）`); else { K.after.pay = false; notes.push(`（${k.n}の学費が払えず、奨学金に切りかえた）`); }
    }
    if (stg === 'adult' && K.after && (K.after.kind === 'uni' || K.after.kind === 'senmon') && yrs >= (K.after.kind === 'uni' ? 22 : 20) && !K.after.done) {
      K.after.done = true;
      const ind = pickInd(K);
      K.after.job = ind;
      notes.push(`（${k.n}が卒業して、${D.INDUSTRIES[ind].name}に就職した。スーツ姿が、まぶしい）`);
      addHist(g, `${k.n}が卒業し、${D.INDUSTRIES[ind].name}に就職した`, 'family');
      parentAdd(g, L, 10, '子どもの就職');
    }
  }
}
function pickInd(K) {
  const ids = D.INDUSTRY_ORDER.filter((id) => id !== 'it' || lsRand() < 0.8);
  ids.sort((a, b) => K.stats[D.INDUSTRIES[b].stat] - K.stats[D.INDUSTRIES[a].stat] + (lsRand() - 0.5) * 30);
  return ids[0];
}
// every morning: a child grows a little by themselves; 習いごと and clubs add a little more
function kidDaily(g, L) {
  const away = awayIds(g);
  for (const k of kidsOf(g)) {
    const K = kidState(g, k), a = kidAge(g, k), stg = D.kidStageOf(a);
    if (stg === 'adult') continue;
    if (away.includes(k.id)) continue;
    const r = lsRand();
    if (r < 0.12) gain(K, { [['gaku', 'tai', 'kan', 'yu', 'sei'][Math.floor(lsRand() * 5)]]: 1 });
    if (K.lesson && lsRand() < 0.14) gain(K, D.LESSONS[K.lesson].g);
    if (K.club && !D.CLUBS[K.club].none && lsRand() < 0.1) gain(K, D.CLUBS[K.club].g);
    if (K.juku && lsRand() < 0.12) gain(K, { gaku: 1 });
    if (K.hoiku && lsRand() < 0.08) gain(K, { yu: 1 });
    K.joy = clamp(K.joy + (K.joy < 55 ? 1 : K.joy > 70 ? -1 : 0), 0, 100);
  }
}
KID_TICK.push((g, L, d, monthChanged, prev, notes) => {
  if (!kidsOf(g).length) return;
  kidDaily(g, L);
  if (monthChanged) kidMonth(g, L, d, prev, notes);
  if (monthChanged && d.month === 6) grandkids(g, L, d, notes);
});
// [R31] 孫: a grown child (27+) may have a baby of their own, at most two each
function grandkids(g, L, d, notes) {
  L.grand = Array.isArray(L.grand) ? L.grand : [];
  for (const k of kidsOf(g)) {
    const K = kidState(g, k);
    if (!K.after || kidYears(g, k) < 27) continue;
    if (L.grand.filter((x) => x.of === k.id).length >= 2 || K.d.grand === d.year) continue;
    if (lsRand() > 0.22) continue;
    K.d.grand = d.year;
    const gg = lsRand() < 0.5 ? 'm' : 'f';
    const pool = D.GRAND_NAMES[gg];
    const n = pool[Math.floor(lsRand() * pool.length)];
    L.grand.push({ n, g: gg, b: g.state.day, of: k.id });
    notes.push(`（${k.n}から電話。「生まれたよ！」…孫の${n}が生まれた。あなたは、${profileOf(g.state).gender === 'f' ? 'おばあちゃん' : profileOf(g.state).gender === 'm' ? 'おじいちゃん' : 'おじいちゃん・おばあちゃん'}になった）`);
    addHist(g, `孫の${n}が生まれた（${k.n}の子）`, 'family');
    parentAdd(g, L, 6, '孫の誕生');
  }
}
KID_WEEKLY.push((g, L, ledgerAdd) => {
  const out = [];
  const away = awayIds(g);
  for (const k of kidsOf(g)) {
    const K = kidState(g, k), stg = kidStage(g, k);
    if (away.includes(k.id) || stg === 'adult') continue;
    const pay = (label, fee, off) => { if (g.spend(fee)) { out.push(`${k.n}の${label} -${fmtMoney(fee)}`); ledgerAdd(g, L, [`${k.n}の${label}`, -fee]); } else { off(); toastLater(L, `${k.n}の${label}が払えず、お休みにした`); } };
    if (K.hoiku && stg === 'baby') pay('保育料', D.KID_FEES.hoiku, () => { K.hoiku = false; });
    if (K.lesson) pay(D.LESSONS[K.lesson].name, D.LESSONS[K.lesson].fee, () => { K.lesson = null; });
    if (K.juku && (stg === 'mid' || stg === 'high')) pay('塾', D.KID_FEES.juku, () => { K.juku = false; });
    if (K.hoiku && stg !== 'baby') K.hoiku = false;
  }
  return out;
});
KID_COSTS.push((g, L) => {
  const out = [];
  const away = awayIds(g);
  for (const k of kidsOf(g)) {
    const K = kidState(g, k), stg = kidStage(g, k);
    if (away.includes(k.id)) continue;
    if (K.hoiku && stg === 'baby') out.push([`${k.n}の保育料`, -D.KID_FEES.hoiku]);
    if (K.lesson && stg !== 'adult') out.push([`${k.n}の${D.LESSONS[K.lesson].name}`, -D.LESSONS[K.lesson].fee]);
    if (K.juku && (stg === 'mid' || stg === 'high')) out.push([`${k.n}の塾`, -D.KID_FEES.juku]);
  }
  return out;
});

// ---------------------------------------------------------------- the inbox
onInbox('kid_event', (g, it, i) => {
  const L = ensure(g), k = kidsOf(g).find((x) => x.id === it.data.kid);
  if (!k) return '';
  const K = kidState(g, k), ev = it.data.ev;
  if (i !== 0) { K.joy = clamp(K.joy - 4, 0, 100); return ev === 'undo' ? `${k.n}は「来なくても平気」と言ったけど、少しさみしそうだった。` : `行けなかった。あとで、${k.n}に様子を聞こう。`; }
  const cost = ev === 'undo' ? 10 : 6;
  g.state.stamina = Math.max(0, g.state.stamina - cost);
  K.joy = clamp(K.joy + 10, 0, 100);
  parentAdd(g, L, 5, it.title);
  const gs = gain(K, ev === 'undo' ? { tai: 1, yu: 2 } : ev === 'sankan' ? { gaku: 1, yu: 1 } : { kan: 1, yu: 1 });
  addHist(g, `${it.title}を見に行った`, 'family');
  const place = ev === 'undo' ? (K.stats.tai >= 45 ? `かけっこで、${K.stats.tai >= 60 ? '1等' : '2等'}！ 大きく手をふってくれた。` : '最後まで、いっしょうけんめい走った。大きな拍手を送った。') : ev === 'sankan' ? `作文の題は「わたしの${profileOf(g.state).gender === 'm' ? 'お父さん' : profileOf(g.state).gender === 'f' ? 'お母さん' : '家族'}」。…ちょっと、泣きそうになった。` : `${k.n}の番。少し緊張していたけど、最後までやりきった！`;
  return `${place}${joinG(gs)}　親ポイント+5`;
});
onInbox('kid_hanko', (g, it, i) => {
  const L = ensure(g), k = kidsOf(g).find((x) => x.id === it.data.kid);
  if (!k) return '';
  const K = kidState(g, k);
  if (i === 0) { parentAdd(g, L, 4, '反抗期を見守る'); gain(K, { sei: 1 }); return `口出しはせず、ごはんだけは、いつも通りに用意した。しばらくして、${k.n}のほうから「ねえ」と話しかけてきた。`; }
  if (i === 1) { parentAdd(g, L, 5, '反抗期に向きあう'); K.joy = clamp(K.joy + 6, 0, 100); gain(K, { yu: 1 }); return `時間をかけて、話を聞いた。言葉は少なかったけれど、最後に「…ありがと」と小さな声。`; }
  K.joy = clamp(K.joy - 10, 0, 100); parentAdd(g, L, 1, '反抗期'); return `強く言ったら、ドアをばたんと閉められた…。時間をおいて、あやまろう。`;
});
onInbox('kid_plan', (g, it, i, quiet) => {
  const L = ensure(g), k = kidsOf(g).find((x) => x.id === it.data.kid);
  if (!k) return '';
  if (quiet) return `ゆっくり話す時間がとれなかった。${k.n}は、自分で考えて決めるようだ。`;
  const K = kidState(g, k);
  K.plan = ['uni', 'uniSelf', 'senmon', 'work'][i];
  parentAdd(g, L, 4, '進路相談');
  addHist(g, `${k.n}の進路を話しあった`, 'family');
  return ['「ありがとう。ぜったい合格する！」', '「奨学金、自分でちゃんと返すから」', '「手に職をつけたい。がんばる」', '「自分で決めたこと、応援してくれてうれしい」'][i];
});

// ---------------------------------------------------------------- the API
const METHODS = {
  lifeKids() {
    const L = ensure(this);
    if (!L) return [];
    const away = awayIds(this);
    return kidsOf(this).map((k) => {
      const K = kidState(this, k), a = kidAge(this, k), stg = D.kidStageOf(a);
      return {
        id: k.id, name: k.n, gender: k.g, age: a, years: kidYears(this, k), stage: stg, stageName: STAGE_NAME[stg], word: kidWord(k),
        stats: { ...K.stats }, lesson: K.lesson, juku: K.juku, hoiku: K.hoiku, club: K.club, hs: K.hs, plan: K.plan, after: K.after, joy: K.joy,
        report: K.reports.length ? K.reports[K.reports.length - 1] : null, reports: K.reports.slice(), look: (() => { try { return kidLook(this, k); } catch (e) { return null; } })(), away: away.includes(k.id),
      };
    });
  },
  lifeKidActions(kidId) { return kidActions(this, kidId); },
  lifeKidAct(kidId, actId, o) { return kidAct(this, kidId, actId, o || {}); },
  lifeParent() { const L = ensure(this); if (!L) return null; const pts = num(L.parent.pts); return { pts, ...D.parentRank(pts, profileOf(this.state).gender), log: L.parent.log.slice(-8), active: kidsOf(this).length > 0 }; },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });
if (typeof window !== 'undefined') window.__lsKids = { kidState, kidActions, kidAct, kidMonth: (g, d, prev, notes) => kidMonth(g, ensure(g), d, prev, notes || []) };
