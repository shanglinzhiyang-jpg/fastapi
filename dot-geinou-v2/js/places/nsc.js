// NSC（吉本総合芸能学院） (owner: A) — the school where you can meet your 相方, and the 貸し稽古場 where any act rehearses.
//
//   nsc        NSC大阪校 (door in なんば; 1982年開校)        rooms: lobby 受付・ロビー / kyoshitsu 教室 / netami ネタ見せ教室 / keiko 稽古場
//   nsc_tokyo  NSC東京校 (door in the Tokyo town, shown from 1995: 東京校は1995年開校)   the same rooms
//   keikoba    貸し稽古場「ドットスタジオ」(Tokyo; fictional): studio 稽古場 (your 相方 waits here) / live 小さなライブスペース (フリーライブ)
//
// The school year (application, fees, classes, graduation) is state in js/engine/owarai_nsc.js; verified facts and their
// sources are listed there. Teachers and classmates are fictional; the classmates are registered people
// (js/engine/owarai_data.js 'ow_no_*' / 'ow_nt_*'), several of them can become your 相方 (相方探しの会, ネタ見せで組む, 稽古場).
// The 所属審査 after the 卒業公演 goes through the engine's g.audition (agency 'yoshimoto').

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { PEOPLE, isKansai } from '../engine/life.js';
import { fmtMoney, clamp } from '../engine/util.js';
import { CANDIDATES, NSC_COHORT, KINDS, STYLES, ROLES, personName, dateOf, eraKey, num } from '../engine/owarai_data.js';
import { CAMPUS, CLASSES, FEES, monthly } from '../engine/owarai_nsc.js';

const has = (g, k) => !!g && typeof g[k] === 'function';
const WHO = {
  jimu: { name: '事務局の人', look: { ...LOOKS.receptionist, top: '#e8492a' } },
  teacherOsaka: { name: '構成作家 白峰先生', look: { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#2e3140', bottom: '#2e3140', jacket: true, glasses: true } },
  teacherTokyo: { name: '構成作家 黒岩先生', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#3a3a4a', bottom: '#2a2a36', jacket: true, glasses: true } },
  kyoshi: { name: '講師', look: { hair: 'short', hairColor: 'brown', skin: 'tan', top: '#2f6fd0', bottom: '#2a2d36' } },
  senpai: { name: '研究生の先輩', look: { ...LOOKS.comedian2, top: '#8a5ac8' } },
  staff: { name: 'スタジオの受付', look: { hair: 'cap', hat: '#2a2d36', hairColor: 'brown', skin: 'fair', top: '#5a6f8a', bottom: '#2a2d36' } },
  mc: { name: 'ライブの主催者', look: { hair: 'spiky', hairColor: 'blonde', skin: 'fair', top: '#ff8a3d', bottom: '#2a2d36', glasses: 'sun' } },
};
const teacherOf = (campus) => (campus === 'tokyo' ? WHO.teacherTokyo : WHO.teacherOsaka);
const campusOf = (g) => (g.map && g.map.placeId === 'nsc_tokyo' ? 'tokyo' : 'osaka');
const S = (g) => (has(g, 'nsc') ? g.nsc() : null);
const enrolledHere = (g, campus) => { const s = S(g); return !!s && s.status === 'enrolled' && s.campus === campus; };
const studentHere = (g, campus) => { const s = S(g); return !!s && ['enrolled', 'graduated'].includes(s.status) && s.campus === campus; };
const isMember = (g, id) => { const u = has(g, 'unit') ? g.unit() : null; return !!(u && u.members.some((m) => m.id === id)); };
const kansaiCampus = (c) => c === 'osaka';
const yen = (n) => fmtMoney(n);

// ---------------------------------------------------------------- 相方 slots (any net / NSC 相方 waits in the 稽古場)
// The map copies an entity with { ...def } when a room loads (map.js instantiate), so these getters are read once per visit.
function slotPid(g, idx) {
  if (!g || !has(g, 'unit')) return null;
  const u = g.unit();
  if (!u || u.type === 'pin') return null;
  const list = u.members.filter((m) => m.id !== 'player' && CANDIDATES[m.id]).map((m) => m.id);
  return list[idx] || null;
}
function partnerSlot(id, idx, x, y, dir = 'down') {
  const e = { type: 'npc', id, x, y, dir, wander: 1 };
  const G = () => (typeof window !== 'undefined' ? window.__game : null);
  Object.defineProperty(e, 'person', { enumerable: true, get() { return slotPid(G(), idx) || 'ow_zs_ken'; } });
  Object.defineProperty(e, 'look', { enumerable: true, get() { const p = PEOPLE[slotPid(G(), idx)]; return p ? p.look : LOOKS.comedian; } });
  Object.defineProperty(e, 'name', { enumerable: true, get() { const p = PEOPLE[slotPid(G(), idx)]; return p ? p.name : '相方'; } });
  e.cond = (g) => { const pid = slotPid(g, idx); return !!pid && (this0(e).person === pid); };
  e.text = ['ネタ合わせ、しよか。'];
  return e;
}
// the live entity (a plain copy) or the def
const this0 = (e) => e;

// classmates on the map (cohort of this campus, not your current members)
function mate(id, x, y, dir, extra = {}) {
  const P = PEOPLE[id];
  const c = CANDIDATES[id];
  return {
    type: 'npc', id: `npcm_${id}`, x, y, dir, person: id, look: P ? P.look : LOOKS.comedian, name: P ? P.name : id, wander: extra.wander ?? 0,
    cond: (g) => studentHere(g, c.nsc) && !isMember(g, id),
    text: [c.say || 'よろしく！'],
  };
}

// ---------------------------------------------------------------- the 受付 (application / fees / info)
function factLines(g, campus) {
  const C = CAMPUS[campus];
  const reiwa = eraKey(g) === 'reiwa';
  const k = kansaiCampus(campus);
  return [
    `ここは${C.name}。NSCは、吉本興業がつくった\n芸人の養成所です。${campus === 'osaka' ? '大阪校は1982年4月に開校しました。' : '東京校は1995年に開校しました。'}`,
    '1年制で、入学は4月。4月は入学式とクラス分け、\nそれに「相方探しの会」。5月からネタ見せが始まります。',
    '授業はネタ見せが中心（全体の4割ほど）。\nほかに発声、演技、ダンス、発想法（大喜利）、\nコント、新喜劇、落語、即興などがあります。',
    reiwa ? `学費は、入学諸経費${yen(FEES.entry)}、\n年間の授業料${yen(FEES.tuition)}、施設使用料${yen(FEES.facility)}（税込）。`
      : `学費は、入学金と一年分の授業料などで\nあわせて${yen(FEES.entry + FEES.tuition + FEES.facility)}ほど（目安）。`,
    `入学のときに${reiwa ? '入学諸経費' : '入学金'}（${yen(FEES.entry)}${reiwa ? '' : '・目安'}）、\n残りは毎月${yen(monthly())}ずつの分納で受けつけます。\n（未納が続くと除籍になります）`,
    k ? '卒業公演と一年の成績で、所属審査があるで。\n…ほな、がんばってや！' : '卒業公演と一年の成績で、所属審査があります。\nがんばってください！',
  ];
}
async function familyHelp(g) {
  const fam = (g.state.profile && g.state.profile.family) || [];
  const alive = fam.filter((m) => m && m.alive !== false && ['father', 'mother', 'grandfather', 'grandmother'].includes(m.rel));
  if (!alive.length || g.flag('ow_nsc_family')) return false;
  const who = alive[0];
  const i = await g.ask(`入学金が足りない…。\n実家の${who.name}に相談してみる？（一度だけ）`, ['電話する', 'やめておく'], { cancel: 1 });
  if (i !== 0) return false;
  g.setFlag('ow_nsc_family', true);
  g.sfx('chime');
  await g.say(['プルルル…', `「…NSC？芸人の学校？\n…あんたが本気なら、入学金だけは出したるわ。\nそのかわり、一年、ちゃんと通いなさいよ」`], { name: who.name });
  return true;
}
async function apply(g, campus) {
  const st = g.state;
  const C = CAMPUS[campus];
  const who = WHO.jimu;
  const date = dateOf(g);
  if (!has(g, 'nscCommitApply')) return;
  if (st.money < FEES.entry) {
    const ok = await familyHelp(g);
    if (!ok) { await g.say(`入学には、まず${eraKey(g) === 'reiwa' ? '入学諸経費' : '入学金'}（${yen(FEES.entry)}）が必要です。\nお金がたまったら、また来てくださいね。`, who); return; }
    await g.say(`（${C.name}の入学金を、実家が出してくれた）`);
  }
  const when = date.month === 4 ? '今月（すぐに入学）' : `${date.month >= 4 ? date.year + 1 : date.year}年4月`;
  const k = await g.ask(`${C.name}に入学を申しこみますか？\n入学：${when}・${st.money >= FEES.entry || g.flag('ow_nsc_family') ? '' : ''}入学金 ${yen(FEES.entry)}`, ['申しこむ', 'やめておく'], { ...who, cancel: 1 });
  if (k !== 0) return;
  // 面接
  await g.say(['それでは、面接をします。', 'リラックスして、答えてくださいね。'], who);
  const a = await g.ask('どうして、芸人になりたいんですか？', ['人を笑わせるのが好きだから', 'テレビに出たいから', '自分を変えたいから'], { ...who, cancel: 0 });
  await g.say(['なるほど。', a === 0 ? '笑いが好き、いちばん大事なことですね。' : a === 1 ? '目標がはっきりしているのは、いいことです。' : 'ここで変われるかどうかは、あなたしだいですよ。'], who);
  const b = await g.ask('得意なことを、ひとつ見せてください。', ['ボケてみせる', 'ものまねをする', '一発ギャグ'], { ...who, cancel: 0 });
  g.sfx(b === 0 ? 'laugh' : 'good');
  if (has(g, 'addComedyStat')) g.addComedyStat(['boke', 'mane', 'chara'][b] || 'boke', 1, true);
  await g.say('はい、ありがとうございました。\n…面接は、合格です。', who);
  if (st.money >= FEES.entry && !(g.flag('ow_nsc_family') && st.money < FEES.entry * 2 && g.flag('ow_nsc_family_used') !== true && !g.flag('ow_nsc_paid_once'))) { st.money -= FEES.entry; g.sfx('coin'); g.setFlag('ow_nsc_paid_once', true); }
  else g.setFlag('ow_nsc_family_used', true);
  const s = g.nscCommitApply(campus, { familyPaid: !!g.flag('ow_nsc_family_used') });
  if (s.status === 'enrolled') {
    g.sfx('fanfare');
    await g.say([`入学おめでとうございます！\nあなたは${C.name}の${s.ki}期生です。`, '授業は月曜〜土曜。時間割はロビーの掲示板に。\n今月は「相方探しの会」もありますよ。'], who);
  } else await g.say([`入学の手続きができました。\n${s.year}年4月から、${C.name}の${s.ki}期生です。`, 'それまで、体と心の準備をしておいてくださいね。'], who);
}
async function deskTalk(g) {
  const campus = campusOf(g);
  const C = CAMPUS[campus];
  const who = WHO.jimu;
  const s = S(g);
  if (!s) { await g.say('NSCの事務局です。', who); return; }
  if (s.status === 'enrolled' && s.campus === campus) {
    const items = ['今日の授業', '成績を見る'];
    if (s.unpaid) items.push(`学費を払う（未納${yen(s.unpaid)}）`);
    items.push('退学する', 'やめる');
    const i = await g.ask(`${C.name} ${s.ki}期の{name}さん、おつかれさまです。`, items, { ...who, cancel: items.length - 1 });
    const it = items[i];
    if (it === '今日の授業') { const c = s.classToday; await g.say(c ? `今日の授業は「${c.label}」です。${c.id === 'netami' ? 'ネタ見せ教室へどうぞ。' : '教室へどうぞ。'}` : '今日（日曜）は休講です。', who); }
    else if (it === '成績を見る') await g.say([`出席 ${s.attend}日／授業日 ${s.classDays}日（出席率 ${Math.round(s.attendRate * 100)}%）`, `ネタ見せ ${s.netamiCount}回・平均 ${s.netamiAvg}点・最高 ${s.netamiBest}点`, `学費 支払いずみ ${yen(s.paid)}${s.unpaid ? `・未納 ${yen(s.unpaid)}` : ''}`], who);
    else if (it && it.startsWith('学費')) { const p = g.nscPay(); g.sfx(p ? 'coin' : 'buzz'); await g.say(p ? `${yen(p)}、お支払いいただきました。` : 'お金が足りないようです…。', who); }
    else if (it === '退学する') { const k = await g.ask('本当に退学しますか？（払った学費は戻りません）', ['やめておく', '退学する'], { ...who, cancel: 0 }); if (k === 1) { g.nscQuit(); await g.say('…わかりました。またいつか、舞台で会いましょう。', who); } }
    return;
  }
  if (s.status === 'applied' && s.campus === campus) { await g.say(`入学は${s.year}年4月です。\nお待ちしていますね。`, who); return; }
  if (s.status === 'graduated' && s.campus === campus) {
    await g.say([`${C.name} ${s.ki}期卒業の{name}さん！\n舞台での活躍、楽しみにしています。`, s.grad && s.grad.shinsa === 'passed' ? '所属のみなさんには、劇場の出番もあります。' : '所属は、事務所のオーディションでも目指せますよ。'], who);
    return;
  }
  if ((s.status === 'enrolled' || s.status === 'applied') && s.campus !== campus) { await g.say(`{name}さんは${CAMPUS[s.campus].name}の生徒さんですね。\nここは${C.name}です。`, who); return; }
  const i = await g.ask(`${C.name}へようこそ。\n入学の相談ですか？`, ['入学の説明を聞く', '入学を申しこむ', 'ほかの養成所のこと', 'やめる'], { ...who, cancel: 3 });
  if (i === 0) await g.say(factLines(g, campus), who);
  else if (i === 1) await apply(g, campus);
  else if (i === 2) await g.say(['芸人の養成所は、ほかの事務所にもあります。', 'でも、同期の数と劇場の多さは、うちの自慢です。', '（ほかの養成所は、このゲームでは名前だけの存在だ）'], who);
}

// ---------------------------------------------------------------- classes (教室)
async function classTalk(g) {
  const campus = campusOf(g);
  const s = S(g);
  const c = s && s.classToday;
  const who = { name: c ? c.teacher : '講師', look: WHO.kyoshi.look };
  if (!enrolledHere(g, campus)) { await g.say(['授業は在校生のためのものです。', '見学は自由ですよ。入学の相談はロビーの受付へ。'], who); return; }
  if (!c) { await g.say('今日（日曜）は休講です。\nゆっくり休むのも、芸のうち。', who); return; }
  if (c.id === 'netami') { await g.say('今日はネタ見せの日です。\nネタ見せ教室へ行きなさい。', who); return; }
  if (s.attendedToday) { await g.say('今日の授業は終わり。\n明日もちゃんと来るように。', who); await aikataKai(g, campus); return; }
  const why = g.lifeRefusal();
  if (why) { await g.say(why); return; }
  if (g.state.stamina < 10) { await g.say('体力が足りない…。\n何か食べてから授業を受けよう。'); return; }
  const k = await g.ask(`今日の授業は「${c.label}」。\n受けますか？（体力 -10・ストレス +5）`, ['受ける', 'やめておく'], { ...who, cancel: 1 });
  if (k !== 0) return;
  g.state.stamina -= 10;
  g.lifeTick({ stress: 5, hunger: -8, clean: -6 });
  await g.fadeOut(10);
  g.sfx('drum');
  await g.wait(300);
  await g.fadeIn(10);
  const r = g.nscAttend();
  await g.say(c.lines[Math.floor(Math.random() * c.lines.length)] || `「${c.label}」の授業を受けた。`, who);
  await g.say(r && r.ups.length ? `（${r.ups.join('・')}）` : `（${Object.keys(c.gains).map((x) => x).length ? '' : ''}力が少しずつたまってきた）`);
  await aikataKai(g, campus);
}
// 相方探しの会 (April, enrolled, no act yet): try ネタ合わせ with classmates, maybe form a combi
async function aikataKai(g, campus) {
  const s = S(g);
  const date = dateOf(g);
  const u = g.unit();
  if (!s || s.status !== 'enrolled' || date.month !== 4 || (u && u.type !== 'pin') || g.nscRecord().aikataKai) return;
  const rec = g.nscRecord();
  rec.aikataKai = g.state.day;
  const who = teacherOf(campus);
  g.sfx('chime');
  await g.say(['はい、注目！', '今日は授業のあとに「相方探しの会」をやります。\n相方がまだおらん人は、同期とどんどんネタ合わせしてみなさい。'], who);
  const pool = NSC_COHORT[campus].filter((id) => !isMember(g, id));
  for (let round = 0; round < 3; round++) {
    const items = pool.map((id) => { const c = CANDIDATES[id]; const ct = g.netStatus(id); return `${personName(id)}（${STYLES[c.style].replace('中心', '')}・${ROLES[c.role]}）${ct && Number.isFinite(ct.trial) ? ` ${ct.trial}` : ''}`; });
    const i = await g.list({ title: `相方探しの会（${round + 1}／3人目）`, items: [...items, 'もう十分'], x: 12, y: 56, w: 380, px: true, describe: (j) => (pool[j] ? `${CANDIDATES[pool[j]].say.split('\n')[0]}` : '会を終わる') });
    if (i < 0 || i >= pool.length) break;
    const pid = pool[i];
    g.meet(pid);
    const P = PEOPLE[pid];
    await g.say(CANDIDATES[pid].say, { name: P.name, look: P.look });
    const r = await g.owaraiTrial(pid, { venue: 'NSCの教室', skip: true });
    g.sfx(r.score >= 55 ? 'good' : 'cancel');
    await g.say(`（${P.short}とのおためしネタ合わせ：${r.feel}。手ごたえ ${r.score}／100）`);
    const j = await g.ask(`${P.short}と組む？`, ['組もうと言う', 'ほかの人とも試す'], { cancel: 1 });
    if (j === 0) { const ok = await g.owaraiPropose(pid, {}); if (ok) return; }
  }
  await g.say('相方は、あせらんでええ。\nネタ見せや稽古場で、ゆっくり探しなさい。', who);
}

// ---------------------------------------------------------------- ネタ見せ (and the 卒業公演)
function critique(g, res, kind, campus) {
  const k = kansaiCampus(campus);
  const sc = num(res && res.score);
  const out = [];
  out.push(sc >= 80 ? (k ? 'ええやないか。今日いちばんや。' : 'いいね。今日いちばんだ。') : sc >= 60 ? (k ? 'まあまあや。ちゃんと笑いは起きとった。' : 'まあまあだね。ちゃんと笑いは起きていた。') : sc >= 40 ? (k ? '…正直、まだまだやな。' : '…正直、まだまだだね。') : (k ? '…ひとつも笑われへんかったな。' : '…ひとつも笑えなかった。'));
  if (res) {
    if (num(res.overtime) > 0) out.push(k ? `尺オーバーや。${Math.round(num(res.overtime))}秒も長い。ネタ見せは時間厳守やで。` : `尺オーバーだ。${Math.round(num(res.overtime))}秒も長い。時間は厳守。`);
    if (num(res.flubs) >= 2) out.push(k ? `噛みすぎや（${res.flubs}回）。滑舌から鍛えなおし。` : `噛みすぎだ（${res.flubs}回）。滑舌を鍛えなおそう。`);
    if (num(res.blanks) >= 1) out.push(k ? 'セリフが飛んだな。ネタ合わせが足りてへん証拠や。' : 'セリフが飛んだね。ネタ合わせが足りていない証拠だ。');
  }
  const sf = g.shortfall(kind, clamp(sc + 15, 45, 85));
  for (const gp of sf.gaps.slice(0, 2)) out.push(`${gp.label}：${gp.reason.split('：')[1] || gp.reason}`);
  return out.map((s) => s.replace(/(.{24})/g, '$1\n').replace(/\n$/, ''));
}
async function performHere(g, kind, opts) {
  let res = null;
  if (has(g, 'perform')) {
    try {
      let neta = null;
      if (has(g, 'pickNeta') && !opts.skip && !g.auto) neta = await g.pickNeta({ kind, length: opts.length });
      res = await g.perform({ kind, neta: neta || undefined, practice: !!opts.practice, title: opts.title, venue: opts.venue, skip: !!opts.skip, length: opts.length });
    } catch (e) { console.error(e); res = null; }
  }
  if (!res || !Number.isFinite(Number(res.score))) res = g.__ow.simPerform(g, g.owarai(), kind, opts.venue || {});
  return res;
}
async function netamiTalk(g) {
  const campus = campusOf(g);
  const s = S(g);
  const who = teacherOf(campus);
  const k = kansaiCampus(campus);
  if (!enrolledHere(g, campus)) { await g.say(k ? ['ネタ見せは、在校生の授業や。', '入りたいんやったら、ロビーの受付で相談しい。'] : ['ネタ見せは在校生の授業だよ。', '入学したいなら、ロビーの受付で相談して。'], who); return; }
  const date = dateOf(g);
  // 卒業公演 (March of the next year)
  if (s.gradOpen && !s.grad) {
    const i = await g.ask(k ? 'いよいよ卒業公演や。\n出番、いけるか？' : 'いよいよ卒業公演だ。\n出番、いけるか？', ['出る', 'まだ準備する'], { ...who, cancel: 1 });
    if (i === 0) { await graduationShow(g, campus); return; }
  }
  const c = s.classToday;
  if (!c || c.id !== 'netami') {
    const sf = g.shortfall(unitKind(g), 55);
    await g.say([k ? 'ネタ見せは水曜と土曜や。' : 'ネタ見せは水曜と土曜だよ。', ...(date.month === 4 ? [k ? '4月は「芸人の基本」の座学。ネタ見せは5月からや。' : '4月は「芸人の基本」の座学。ネタ見せは5月から。'] : []), `${k ? 'いまの課題' : 'いまの課題'}：${sf.gaps.slice(0, 2).map((x) => x.label).join('・') || '特になし'}`], who);
    return;
  }
  if (s.attendedToday) { await g.say(k ? '今日のネタ見せは終わりや。\nまた次、仕上げてこい。' : '今日のネタ見せは終わり。\nまた次、仕上げておいで。', who); return; }
  const why = g.lifeRefusal();
  if (why) { await g.say(why); return; }
  if (g.state.stamina < 10) { await g.say('体力が足りない…。'); return; }
  let kind = unitKind(g);
  let tryPid = null;
  const u = g.unit();
  if (!u || u.type === 'pin') {
    const i = await g.ask(k ? '相方おらんのやったら、ピンでやるか、\n同期と即席で組んでみるか。どうする？' : '相方がいないなら、ピンでやるか、\n同期と即席で組んでみるか。どうする？', ['ピンでやる', '同期と即席で組む', 'やめておく'], { ...who, cancel: 2 });
    if (i === 2 || i < 0) return;
    if (i === 1) {
      const pool = NSC_COHORT[campus].filter((id) => !isMember(g, id));
      const j = await g.list({ title: 'だれと組む？', items: pool.map((id) => `${personName(id)}（${ROLES[CANDIDATES[id].role]}）`), x: 12, y: 56, w: 320, px: true });
      if (j < 0) return;
      tryPid = pool[j];
      kind = CANDIDATES[tryPid].style === 'conte' ? 'conte' : 'manzai';
      g.meet(tryPid);
    } else kind = 'pin';
  }
  g.state.stamina -= 10;
  g.lifeTick({ stress: 6, hunger: -8, clean: -6 });
  const first = !g.flag('ow_netami_done');
  const skip = first || g.auto ? false : (await g.ask('ネタを演じる？', ['自分で演じる', 'おまかせで進める'], { cancel: 1 })) === 1;
  if (tryPid) g._owTrial = { pid: tryPid, style: kind };
  let res;
  try { res = await performHere(g, kind, { practice: true, title: 'ネタ見せ', venue: { name: `${CAMPUS[campus].name} ネタ見せ教室`, size: 'small', crowd: 'tough', pressure: 40 }, skip: skip || g.auto }); } finally { g._owTrial = null; }
  g.setFlag('ow_netami_done', true);
  const r = g.nscAttend({ cls: 'netami', score: res.score, kind });
  await g.say(critique(g, res, kind, campus), who);
  if (r && r.ups.length) await g.say(`（ネタ見せ ${Math.round(num(res.score))}点　${r.ups.join('・')}）`);
  if (tryPid) {
    const st = g.netStatus(tryPid) || {};
    st.trial = clamp(Math.round(num(res.score) * 0.7 + num(CANDIDATES[tryPid].compat) * 0.3), 0, 100);
    st.status = st.status === 'formed' ? 'formed' : 'met';
    st.met = st.met || g.state.day;
    st.feel = st.trial >= 70 ? '息がぴったり合った' : st.trial >= 55 ? '悪くない手ごたえ' : st.trial >= 40 ? '少しぎこちない' : 'まったくかみ合わない';
    const o = g.owarai();
    o.net.contacts[tryPid] = st;
    const P = PEOPLE[tryPid];
    await g.say(isKansai(P) ? (st.trial >= 55 ? '…いまの、けっこうよかったんちゃう？' : '…まあ、即席やしな。') : (st.trial >= 55 ? '…いまの、けっこうよかったよね？' : '…まあ、即席だしね。'), { name: P.name, look: P.look });
    const j = await g.ask(`${P.short}と、正式に組む？`, ['組もうと言う', 'いまはやめておく'], { cancel: 1 });
    if (j === 0) await g.owaraiPropose(tryPid, {});
  }
}
const unitKind = (g) => { const u = g.unit(); return u && u.type !== 'pin' ? (u.style === 'conte' ? 'conte' : 'manzai') : 'pin'; };
async function graduationShow(g, campus) {
  const C = CAMPUS[campus];
  const s = S(g);
  const kind = unitKind(g);
  const who = teacherOf(campus);
  await g.fadeOut(14);
  g.sfx('drum');
  await g.wait(400);
  await g.fadeIn(14);
  await g.say(`${C.name} ${s.ki}期 卒業公演。\n客席には、家族や友だち、事務所の人たちの顔も見える。`);
  const skip = g.auto ? true : (await g.ask('ネタを演じる？', ['自分で演じる', 'おまかせで進める'], { cancel: 0 })) === 1;
  const res = await performHere(g, kind, { practice: false, title: `${C.name} 卒業公演`, venue: { name: `${C.name} 卒業公演`, size: 'theater', crowd: 'normal', pressure: 60 }, skip });
  g.addStageExp(kind, 1, res);
  g.sfx(num(res.score) >= 60 ? 'applause' : 'cancel');
  await g.say(num(res.score) >= 60 ? '大きな拍手！ 一年間の稽古が、舞台で笑いになった。' : '笑いはまばらだった…。それでも、最後まで舞台に立ちきった。');
  const grad = g.nscGraduate({ show: res.score });
  const st = g.state;
  await g.say([`卒業おめでとう。${C.name} ${s.ki}期、修了や。`, `卒業公演 ${Math.round(num(res.score))}点・ネタ見せ平均 ${s.netamiAvg}点・出席率 ${Math.round(s.attendRate * 100)}%\n→ 一年の成績 ${grad.score}点`], who);
  if (st.agency === 'yoshimoto') { grad.shinsa = 'passed'; await g.say('（もうよしもとに所属している）'); return; }
  const ok = await g.audition({
    agency: 'yoshimoto', title: `${C.name} ${s.ki}期 所属審査`, minigame: 'ow_shinsa', stamina: 0, pass: 45, client: WHO.jimu.name, clientLook: WHO.jimu.look,
    opts: { score: grad.score, head: `${C.name} ${s.ki}期 所属審査`, parts: [`卒業公演 ${Math.round(num(res.score))}点`, `ネタ見せ平均 ${s.netamiAvg}点（${s.netamiCount}回）`, `出席率 ${Math.round(s.attendRate * 100)}%`] },
  });
  grad.shinsa = ok ? 'passed' : g.lastAudition === 'failed' ? 'failed' : 'skipped';
  if (ok) await g.say(['所属、おめでとう。', 'ここからが本当のスタートや。劇場で待っとるで。'], who);
  else if (grad.shinsa === 'failed') await g.say(['…今回は、所属審査に通らへんかった。', 'けど、芸人をやめなあかんわけやない。\nライブで場数ふんで、オーディションでまた挑戦しい。'], who);
}

// ---------------------------------------------------------------- 稽古場 (NSC and the 貸し稽古場)
async function practiceMenu(g, where) {
  const list = (has(g, 'practiceList') ? g.practiceList() : []).filter((p) => !p.why);
  if (!list.length) { await g.say('（ここでできる練習はない）'); return; }
  const i = await g.list({ title: `${where}で練習`, items: list.map((p) => ({ label: p.label, right: `体力${p.stamina}${p.count ? `×${p.mult}` : ''}` })), x: 12, y: 56, w: 340, px: true, describe: (j) => (list[j] ? `伸びる：${list[j].gains.join('・')}　ストレス${list[j].stress > 0 ? '+' : ''}${list[j].stress}` : '') });
  if (i < 0 || !list[i]) return;
  await g.owaraiPractice(list[i].id);
}
async function staffTalk(g) {
  const who = WHO.staff;
  const u = g.unit();
  const first = !g.flag('ow_keikoba_met');
  g.setFlag('ow_keikoba_met', true);
  if (first) await g.say(['いらっしゃい！貸し稽古場「ドットスタジオ」へようこそ。', 'ここは、アマチュアもプロも使える稽古場。\nネタ合わせ、発声、落語の稽古…なんでもどうぞ。', '奥のライブスペースでは、毎日フリーライブもやってますよ。'], who);
  const i = await g.ask(u && u.type !== 'pin' ? `「${u.name}」さん、今日も稽古ですか？` : '今日はどうします？', ['練習する', '芸人手帳を見る', 'やめておく'], { ...who, cancel: 2 });
  if (i === 0) await practiceMenu(g, '稽古場');
  else if (i === 1 && has(g, 'openOwarai')) await g.openOwarai('practice');
}
async function mcTalk(g) {
  const who = WHO.mc;
  if (!g.flag('ow_live_met')) {
    g.setFlag('ow_live_met', true);
    await g.say(['おっ、出演希望？', 'うちのフリーライブは、だれでもエントリーOK。\nエントリー料をはらえば、ネタを一本やれるよ。', 'お客さんは少ないけど…\nここでウケたら、本物だよ。'], who);
  }
  const i = await g.ask('今日のフリーライブ、出る？', ['出る', 'やめておく'], { ...who, cancel: 1 });
  if (i === 0 && has(g, 'owaraiLive')) await g.owaraiLive({});
}

// ---------------------------------------------------------------- rooms
const signs = (list) => list.map(([x, y, t]) => ({ type: 'sign', x, y, text: t }));
function nscRooms(campus) {
  const C = CAMPUS[campus];
  const P = campus === 'osaka' ? 'nsc' : 'nsc_tokyo';
  const ids = NSC_COHORT[campus];
  const pre = campus === 'osaka' ? 'no' : 'nt';
  const tLook = teacherOf(campus);
  return {
    lobby: {
      wall: 'orange', floor: 'floor_tile',
      tiles: [
        '################',
        '#=d=p=c=b=p=d=d#',
        '#..............#',
        '#.KKKK.......P.#',
        '#..............#',
        '#.SS...........#',
        '#..............#',
        '#.SS.......VV..#',
        '#..............#',
        '#P............P#',
        '#######MM#######',
      ],
      legend: { b: 'wall_orange+whiteboard', K: 'counter', S: 'bench', V: 'vending', P: 'plant' },
      warps: [
        { x: 7, y: 10, to: 'exit' }, { x: 8, y: 10, to: 'exit' },
        { x: 2, y: 1, room: 'kyoshitsu', tx: 6, ty: 8, dir: 'up' },
        { x: 12, y: 1, room: 'netami', tx: 6, ty: 9, dir: 'up' },
        { x: 14, y: 1, room: 'keiko', tx: 6, ty: 7, dir: 'up' },
      ],
      entities: [
        { type: 'npc', id: `${pre}_jimu`, x: 3, y: 2, dir: 'down', look: WHO.jimu.look, name: WHO.jimu.name, talk: deskTalk },
        { type: 'npc', id: `${pre}_senpai`, x: 10, y: 6, dir: 'left', look: WHO.senpai.look, name: WHO.senpai.name, wander: 2, text: campus === 'osaka' ? ['卒業してからも、ここの稽古場にはよう来んねん。', 'ネタ見せは、恥かいてなんぼや。\nスベった数だけ、強なるで。', '相方は、ネタ見せで組んでみるのが一番わかるわ。'] : ['卒業してからも、ここの稽古場にはよく来るんだ。', 'ネタ見せは、恥をかいてなんぼ。\nスベった数だけ強くなる。', '相方は、ネタ見せで一回組んでみるのが一番わかるよ。'] },
        { type: 'npc', id: `${pre}_visitor`, x: 12, y: 8, dir: 'up', look: { ...LOOKS.fan, top: '#5fd7ff' }, name: '見学の人', cond: (g) => !studentHere(g, campus), text: ['入学の説明会に来たんです。', '1年でプロの芸人に…なれるのかな。'] },
        mate(ids[0], 2, 6, 'right'), mate(ids[1], 3, 4, 'down'), mate(ids[2], 9, 8, 'up', { wander: 1 }),
        ...signs([
          [4, 1, campus === 'osaka' ? '「NSC大阪校　1982年開校」のプレートだ。' : '「NSC東京校　1995年開校」のプレートだ。'],
          [10, 1, 'ライブのポスター。\n「NSC生 自主ライブ　出演者募集中」'],
          [6, 1, '時計だ。授業は時間厳守。'],
        ]),
      ],
      events: [
        { x: 8, y: 1, on: 'action', run: async (g) => { const s = S(g); const c = has(g, 'nscClassToday') ? g.nscClassToday() : null; await g.say(['掲示板だ。時間割が貼ってある。', '月：発声・滑舌　火：ダンス／落語（週がわり）\n水：ネタ見せ　木：演技（コント・新喜劇）\n金：発想法（大喜利・即興）　土：ネタ見せ　日：休講', `${dateOf(g).month === 4 ? '（4月の水・土は「芸人の基本」の座学。ネタ見せは5月から）\n' : ''}今日：${c ? c.label : '休講'}${s && s.status === 'enrolled' && s.campus === campus ? `　あなたは${s.ki}期生` : ''}`]); } },
      ],
      onEnter: async (g) => {
        if (!g.flag(`ow_${P}_first`)) {
          g.setFlag(`ow_${P}_first`, true);
          await g.say([`${C.name}だ。`, '吉本興業の養成所――ここから、何人もの芸人が\n舞台へ巣立っていった。（同期も講師も、このゲームの架空の人物）'], {});
        }
      },
    },
    kyoshitsu: {
      wall: 'white', floor: 'floor_wood',
      tiles: [
        '##############',
        '#=w=WWWWWW=w=#',
        '#............#',
        '#............#',
        '#.hh.hh.hh.hh#',
        '#............#',
        '#.hh.hh.hh.hh#',
        '#............#',
        '#P..........P#',
        '######MM######',
      ],
      legend: { W: 'wall_white+whiteboard', h: 'chair', P: 'plant' },
      warps: [{ x: 6, y: 9, room: 'lobby', tx: 2, ty: 2, dir: 'down' }, { x: 7, y: 9, room: 'lobby', tx: 2, ty: 2, dir: 'down' }],
      entities: [
        { type: 'npc', id: `${pre}_kyoshi`, x: 6, y: 2, dir: 'down', look: WHO.kyoshi.look, name: '講師', talk: classTalk },
        mate(ids[3], 2, 5, 'up'), mate(ids[4], 8, 5, 'up'), mate(ids[5], 11, 7, 'up'),
      ],
      events: [{ x: 4, y: 1, w: 6, on: 'action', run: async (g) => { const c = has(g, 'nscClassToday') ? g.nscClassToday() : null; await g.say(c ? `ホワイトボードに「本日：${c.label}」と書いてある。\n担当：${c.teacher}` : 'ホワイトボードに「本日休講」と書いてある。'); } }],
    },
    netami: {
      wall: 'dark', floor: 'floor_wood_dark',
      tiles: [
        '##############',
        '#=p==cc====p=#',
        '#,,,,,,,,,,,,#',
        '#,,,,,Z,,,,,,#',
        '#,,,,,,,,,,,,#',
        '#............#',
        '#...DDDD.....#',
        '#............#',
        '#.hhh....hhh.#',
        '#P..........P#',
        '######MM######',
      ],
      legend: { ',': 'floor_stage', Z: 'floor_stage+mic', D: 'desk', h: 'chair', P: 'plant', c: 'wall_dark+clock' },
      warps: [{ x: 6, y: 10, room: 'lobby', tx: 12, ty: 2, dir: 'down' }, { x: 7, y: 10, room: 'lobby', tx: 12, ty: 2, dir: 'down' }],
      entities: [
        { type: 'npc', id: `${pre}_koshi`, x: 5, y: 7, dir: 'up', look: tLook.look, name: tLook.name, talk: netamiTalk },
        mate(ids[6], 2, 9, 'up'), mate(ids[7], 10, 9, 'up'),
      ],
      events: [{ x: 6, y: 3, on: 'action', run: async (g) => { await g.say(['センターマイクだ。', 'ネタ見せでは、ここに立って講師の前でネタをやる。\n（講師に声をかけよう）']); } }],
    },
    keiko: {
      wall: 'wood', floor: 'floor_wood',
      tiles: [
        '##############',
        '#=nnnnnnnnnn=#',
        '#S..........S#',
        '#............#',
        '#............#',
        '#............#',
        '#X..........P#',
        '######MM######',
      ],
      legend: { n: 'wall_wood+mirror', S: 'speaker', X: 'water_server', P: 'plant' },
      warps: [{ x: 6, y: 7, room: 'lobby', tx: 14, ty: 2, dir: 'down' }, { x: 7, y: 7, room: 'lobby', tx: 14, ty: 2, dir: 'down' }],
      entities: [
        partnerSlot(`${pre}_slot0`, 0, 5, 3, 'down'), partnerSlot(`${pre}_slot1`, 1, 8, 3, 'down'),
        mate(ids[1 + 0], 2, 4, 'right', { wander: 0 }), mate(ids[5], 11, 4, 'left'),
      ],
      events: [{ x: 2, y: 1, w: 10, on: 'action', run: async (g) => { await g.say('大きな鏡だ。ここで自主練ができる。'); if (has(g, 'practiceList')) await practiceMenu(g, 'NSCの稽古場'); } }],
    },
  };
}
// the cohort NPC ids must be unique per room: classmates appear in one room each (lobby / 教室 / ネタ見せ教室); the 稽古場 shows two of them again
// under other entity ids (npcm_ + id is the same person, but each entity id is per room, which the map allows)
for (const campus of ['osaka', 'tokyo']) {
  const C = CAMPUS[campus];
  registerPlace({
    id: C.place, name: C.name, kind: 'building', bgm: 'office',
    start: { room: 'lobby', x: 7, y: 9, dir: 'up' },
    rooms: nscRooms(campus),
  });
}

registerPlace({
  id: 'keikoba', name: '貸し稽古場「ドットスタジオ」', kind: 'building', bgm: 'office',
  start: { room: 'studio', x: 6, y: 8, dir: 'up' },
  rooms: {
    studio: {
      wall: 'wood', floor: 'floor_wood',
      tiles: [
        '##############',
        '#=nnnnnn=d=c=#',
        '#............#',
        '#.KK.........#',
        '#............#',
        '#............#',
        '#............#',
        '#X..........P#',
        '#P...........#',
        '######MM######',
      ],
      legend: { n: 'wall_wood+mirror', K: 'counter', X: 'water_server', P: 'plant', c: 'wall_wood+clock' },
      warps: [{ x: 6, y: 9, to: 'exit' }, { x: 7, y: 9, to: 'exit' }, { x: 9, y: 1, room: 'live', tx: 6, ty: 9, dir: 'up' }],
      entities: [
        { type: 'npc', id: 'kb_staff', x: 2, y: 2, dir: 'down', look: WHO.staff.look, name: WHO.staff.name, talk: staffTalk },
        partnerSlot('kb_slot0', 0, 6, 4, 'down'), partnerSlot('kb_slot1', 1, 9, 4, 'down'),
        { type: 'npc', id: 'kb_duo1', x: 10, y: 6, dir: 'left', look: { hair: 'afro', hairColor: 'brown', skin: 'tan', top: '#2f9a4a', bottom: '#3b3f48' }, name: 'アマチュア芸人', text: ['オレら、結成3か月のコンビ。', 'この稽古場、一時間いくらで借りられるから\n毎日ネタ合わせしてんねん。…バイト代、全部消えるけどな！'] },
        { type: 'npc', id: 'kb_duo2', x: 11, y: 6, dir: 'left', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#ffd23f', bottom: '#2a3560', glasses: true }, name: 'アマチュア芸人', text: ['相方がネタを書いて、ぼくが直す。', '…で、毎回ケンカになるんです。\nでも、ケンカした日のネタがいちばんウケるんですよね。'] },
        ...signs([[3, 1, '大きな鏡だ。ネタ合わせのとき、自分たちの姿を確かめられる。'], [9, 0, '「ライブスペース →」']]),
      ],
      events: [{ x: 2, y: 1, w: 6, on: 'action', run: async (g) => { await practiceMenu(g, '稽古場'); } }],
      onEnter: async (g) => {
        if (!g.flag('ow_keikoba_first')) { g.setFlag('ow_keikoba_first', true); await g.say(['貸し稽古場「ドットスタジオ」だ。', '相方とネタ合わせをしたり、ひとりで発声練習をしたり。\n（受付の人に声をかけよう）']); }
      },
    },
    live: {
      wall: 'black', floor: 'floor_black',
      tiles: [
        '##############',
        '#TTTTTTTTTTTT#',
        '#c,,,,Z,,,,,c#',
        '#c,,,,,,,,,,c#',
        '#............#',
        '#.ssss..ssss.#',
        '#............#',
        '#.ssss..ssss.#',
        '#............#',
        '#P..........P#',
        '######MM######',
      ],
      legend: { T: 'curtain_top', c: 'curtain', ',': 'floor_stage', Z: 'floor_stage+mic', s: 'seat', P: 'plant' },
      warps: [{ x: 6, y: 10, room: 'studio', tx: 9, ty: 2, dir: 'down' }, { x: 7, y: 10, room: 'studio', tx: 9, ty: 2, dir: 'down' }],
      entities: [
        { type: 'npc', id: 'kb_mc', x: 11, y: 4, dir: 'left', look: WHO.mc.look, name: WHO.mc.name, talk: mcTalk },
        { type: 'npc', id: 'kb_aud1', x: 3, y: 6, dir: 'up', look: { ...LOOKS.fan, top: '#ff9a3c' }, name: 'お客さん', text: ['地下ライブ、好きなんです。', '売れる前の芸人さんを見つけるのが、楽しみで。'] },
        { type: 'npc', id: 'kb_aud2', x: 9, y: 8, dir: 'up', look: LOOKS.salaryman, name: 'お客さん', text: ['仕事帰りに、ふらっと。', 'ここでスベってた子が、テレビに出てたことがあってね。'] },
      ],
      events: [{ x: 6, y: 2, on: 'action', run: async (g) => { await g.say('センターマイクだ。\n（主催者に声をかけると、フリーライブに出られる）'); } }],
    },
  },
});
