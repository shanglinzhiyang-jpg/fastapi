// 相方募集 (owner: A): the era's boards (雑誌の投稿欄 / パソコン通信 / ネット掲示板 / ケータイ掲示板 / ブログ / SNS / アプリ),
// contacting a poster, your own 募集, replies on the following mornings, the meeting at a 喫茶店 / ファミレス / カフェ
// (a scene), a trial ネタ合わせ, and the decision. Also the NSC 同期 trial / proposal (the same code).
// Installed on Game.prototype; reaches the core through g.__ow (owarai.js) at run time.
//
// st.owarai.net = { contacts: { [pid]: { status: 'sent'|'replied'|'met'|'declined'|'refused'|'formed', sent, replyDay, met,
//   meets, trial, asked: { style, role, motive, quirk }, by: 'me'|'them' } }, post: { text, board, style, role, day, replyDay,
//   done } | null, posts: n }

import { Game } from './game.js';
import { PEOPLE, PEOPLE_UI, isKansai } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { askText } from './textinput.js';
import {
  CANDIDATES, BOARDS, BOARD_ORDER, MEET_SPOTS, STYLES, ROLES, KINDS, MOTIVE_LINES, STYLE_LINES, ROLE_LINES, QUIRK_TELLS, QUIRKS, PERSONAS,
  MOTIVES, boardCandidates, line, num, dateOf, personName, NSC_COHORT,
} from './owarai_data.js';
import { MeetScene } from './owarai_ui.js';

const OWX = (g) => g.__ow;
function net(g) {
  const o = OWX(g).ensure(g);
  const n = o.net;
  if (!n.contacts || typeof n.contacts !== 'object') n.contacts = {};
  if (n.post && typeof n.post !== 'object') n.post = null;
  n.posts = Math.max(0, num(n.posts));
  return n;
}
export function boardsNow(g, year) {
  const y = num(year, dateOf(g).year);
  return BOARD_ORDER.filter((b) => y >= BOARDS[b].years[0] && y <= BOARDS[b].years[1]);
}
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const contactOf = (g, pid) => net(g).contacts[pid] || null;
const STATUS_LABEL = { sent: '返事待ち', replied: '返事が来た', met: '会った', declined: 'ことわった', refused: 'ことわられた', formed: '相方', ex: 'もと相方', none: '' };

// ---------------------------------------------------------------- the list for the screens
function candInfo(g, pid) {
  const c = CANDIDATES[pid];
  const P = PEOPLE[pid];
  const ct = contactOf(g, pid);
  const o = OWX(g).ensure(g);
  const member = !!(o.unit && o.unit.members.some((m) => m.id === pid));
  // a former 相方 (the act was dissolved / re-formed): can be met and asked again (再結成 = a new formation date)
  const status = member ? 'formed' : ct ? (ct.status === 'formed' ? 'ex' : ct.status) : 'none';
  const met = !!(ct && ct.met) || (c.nsc && g.met(pid));
  return {
    id: pid, name: P ? P.name : c.n, short: c.s, handle: c.h || c.s, look: c.look, age: c.age, pref: c.pref, gender: c.g,
    style: c.style, role: c.role, board: c.board || null, nsc: c.nsc || null, post: c.post || '', status, statusLabel: STATUS_LABEL[status] || '',
    met, trial: ct && Number.isFinite(ct.trial) ? ct.trial : null, asked: (ct && ct.asked) || {},
    // what you know: the motive / quirks / persona only once asked at a meeting
    persona: met ? PERSONAS[c.per] : null, motive: ct && ct.asked && ct.asked.motive ? MOTIVES[c.mot] : null,
    quirks: ct && ct.asked && ct.asked.quirk ? c.q.map((q) => QUIRKS[q].name) : null,
    feel: ct && ct.feel ? ct.feel : null, member, canContact: !member && (!ct || (ct.status === 'refused' && g.state.day - num(ct.met || ct.sent) >= 20) || ct.status === 'declined'),
    canMeet: !member && !!ct && ['replied', 'met', 'formed'].includes(ct.status),
    photo: c.board ? ['blog', 'sns', 'app'].includes(c.board) : true,
  };
}
// CONTRACT4 g.partnerCandidates(source) goes through here
function candidates(g, source = 'net') {
  if (source === 'nsc') {
    const o = OWX(g).ensure(g);
    const campus = o.nsc && o.nsc.campus;
    const ids = campus && ['enrolled', 'graduated', 'applied'].includes(o.nsc.status) ? NSC_COHORT[campus] : [];
    return ids.map((id) => candInfo(g, id));
  }
  const out = [];
  for (const b of boardsNow(g)) for (const id of boardCandidates(b)) out.push(candInfo(g, id));
  // candidates you are already in touch with stay listed even after their board closed
  const n = net(g);
  for (const id of Object.keys(n.contacts)) if (CANDIDATES[id] && CANDIDATES[id].board && !out.some((x) => x.id === id)) out.push(candInfo(g, id));
  return out;
}

// ---------------------------------------------------------------- contacting
function contact(g, pid) {
  const c = CANDIDATES[pid];
  if (!c || !c.board) return false;
  const n = net(g);
  const B = BOARDS[c.board];
  const ct = n.contacts[pid] || (n.contacts[pid] = {});
  ct.status = 'sent';
  ct.sent = g.state.day;
  ct.by = 'me';
  ct.replyDay = g.state.day + randInt(B.reply[0], B.reply[1]);
  return true;
}
function replyText(g, pid, mine) {
  const c = CANDIDATES[pid];
  const B = BOARDS[c.board] || BOARDS.sns;
  const k = c.dial === 'kansai';
  const spot = MEET_SPOTS[B.meet].name;
  const greet = mine
    ? (k ? `${B.via}、おおきに！${c.s}です。` : `${B.via}、ありがとうございます！${c.s}です。`)
    : (k ? `募集、見ました！${c.s}いいます。` : `募集を見ました！${c.s}といいます。`);
  const body = k ? `一回、${spot}で会うて話しませんか？\nネタ合わせも、ちょっとやってみたいです。` : `一度、${spot}で会って話しませんか？\nネタ合わせも、少しやってみたいです。`;
  return `${greet}\n${body}\n（「相方募集」から会いに行ける）`;
}

// ---------------------------------------------------------------- the morning: replies arrive
function netMorning(g, o) {
  const n = net(g);
  const day = g.state.day;
  let sent = 0;
  for (const [pid, ct] of Object.entries(n.contacts)) {
    if (!CANDIDATES[pid] || ct.status !== 'sent' || day < num(ct.replyDay, day + 1)) continue;
    if (sent >= 2) { ct.replyDay = day + 1; continue; }
    ct.status = 'replied';
    const P = PEOPLE[pid];
    OWX(g).sendOw(g, o, { force: sent === 0, from: P.name, person: pid, kind: 'chat', text: replyText(g, pid, true) });
    g.meet(pid).contact = true;
    sent++;
  }
  const post = n.post;
  if (post && !post.done && day >= num(post.replyDay, day + 1)) {
    post.done = true;
    // the people on that board who fit what you asked for answer (2–3 of them)
    const list = boardCandidates(post.board).filter((id) => !n.contacts[id] || n.contacts[id].status === 'declined').filter((id) => !(o.unit && o.unit.members.some((m) => m.id === id)));
    const score = (id) => { const c = CANDIDATES[id]; return (post.style && (c.style === post.style || c.style === 'both') ? 2 : 0) + (post.role && c.role !== post.role ? 2 : 0) + Math.random() * 1.5; };
    list.sort((a, b) => score(b) - score(a));
    const got = list.slice(0, Math.min(list.length, randInt(2, 3)));
    for (const pid of got) {
      const ct = n.contacts[pid] = { status: 'replied', sent: day, replyDay: day, by: 'them' };
      g.meet(pid).contact = true;
      if (sent < 3) OWX(g).sendOw(g, o, { force: sent === 0, from: PEOPLE[pid].name, person: pid, kind: 'chat', text: replyText(g, pid, false) });
      sent++;
      void ct;
    }
    if (!got.length) OWX(g).sendOw(g, o, { from: '芸人手帳', kind: 'chat', text: `「${BOARDS[post.board].short}」の募集に、返事は来なかった…。書き方を変えて、もう一度出してみよう。` });
  }
}

// ---------------------------------------------------------------- trial ネタ合わせ (meeting / NSC)
// Resolves with { score, feel, power } — a short check through g.perform({ practice: true, skip }) when perform.js has it.
async function trial(g, pid, opts = {}) {
  const o = OWX(g).ensure(g);
  const c = CANDIDATES[pid];
  const style = (c && c.style === 'conte') ? 'conte' : 'manzai';
  const harmony = OWX(g).startHarmony(g, pid);
  g._owTrial = { pid, style, harmony };
  let res = null;
  let power = 0;
  try {
    power = g.unitPower(style);
    if (typeof g.perform === 'function') {
      res = await g.perform({ kind: style, practice: true, skip: opts.skip !== false, title: `${personName(pid)}とおためしネタ合わせ`, venue: { name: opts.venue || 'ファミレス', size: 'small', crowd: 'normal', pressure: 5 } });
    }
  } catch (e) { console.error(e); res = null; } finally { g._owTrial = null; }
  if (!res || !Number.isFinite(Number(res.score))) { g._owTrial = { pid, style, harmony }; try { res = OWX(g).simPerform(g, o, style, { pressure: 0 }); } finally { g._owTrial = null; } }
  const compat = num(c ? c.compat : 55, 55);
  const score = clamp(Math.round(num(res.score) * 0.7 + compat * 0.3), 0, 100);
  const feel = score >= 70 ? '息がぴったり合った' : score >= 55 ? '悪くない手ごたえ' : score >= 40 ? '少しぎこちない' : 'まったくかみ合わない';
  const n = net(g);
  const ct = n.contacts[pid] || (n.contacts[pid] = { status: 'met', by: 'nsc' });
  ct.trial = score;
  ct.feel = feel;
  ct.met = ct.met || g.state.day;
  if (ct.status !== 'formed') ct.status = 'met';
  return { score, feel, power };
}
// ask them to form a combi: they may turn you down (実力不足 / 相性). Resolves with true when the combi is formed.
async function propose(g, pid, opts = {}) {
  const c = CANDIDATES[pid];
  const P = PEOPLE[pid];
  if (!P) return false;
  const k = isKansai(P);
  const who = { name: P.name, look: (opts.npc && opts.npc.look) || P.look };
  const n = net(g);
  const ct = n.contacts[pid] || (n.contacts[pid] = { status: 'met', by: 'nsc', met: g.state.day });
  const style = c && c.style === 'conte' ? 'conte' : 'manzai';
  // the level they want from a partner
  if (c && c.bar) {
    g._owTrial = { pid, style };
    let pw = 0;
    try { pw = g.unitPower(style); } finally { g._owTrial = null; }
    if (pw < c.bar) {
      const sf = g.shortfall(style, c.bar);
      ct.status = 'refused';
      ct.refusedAt = g.state.day;
      await g.say(k ? ['……悪いけど。', `今の自分とは、組まれへん。\n${sf.gaps.slice(0, 2).map((x) => x.label).join('も') || '実力'}が、まだ足りてへんわ。`] : ['……ごめん。', `今のあなたとは、組めない。\n${sf.gaps.slice(0, 2).map((x) => x.label).join('も') || '実力'}が、まだ足りないと思う。`], who);
      await g.say(`（実力不足：${sf.text || '実力が足りない'}\nあと${Math.max(1, c.bar - pw)}ほど実力をつけてから、もう一度声をかけよう）`);
      return false;
    }
  }
  const t = num(ct.trial, 50);
  const chance = clamp(0.25 + num(c ? c.compat : 55, 55) / 140 + (t - 50) / 120 + g.aff(pid) / 300, 0.1, 0.97);
  if (!g.auto && Math.random() > chance) {
    ct.status = 'refused';
    ct.refusedAt = g.state.day;
    await g.say(k ? ['…ありがとう。けど、ごめん。', 'なんか、ちゃうねん。\nもうちょっと、ひとりで考えさせて。'] : ['…ありがとう。でも、ごめん。', 'なにかが、ちがう気がするの。\nもう少し、ひとりで考えさせて。'], who);
    return false;
  }
  await g.say(k ? ['…ほんまに？', 'よっしゃ！組もう！\nオレら、ぜったい売れるで！'] : ['…本当に？', 'うん、組もう！\nわたしたち、きっと売れるよ！'], who);
  ct.status = 'formed';
  const u = await g.formUnit(pid, { source: c && c.nsc ? 'nsc' : 'net', harmony: OWX(g).startHarmony(g, pid) + (t - 50) * 0.15 });
  return !!u;
}

// ---------------------------------------------------------------- the meeting
async function meet(g, pid, opts = {}) {
  const st = g.state;
  const c = CANDIDATES[pid];
  const P = PEOPLE[pid];
  if (!c || !P) return null;
  const n = net(g);
  const ct = n.contacts[pid];
  const o0 = OWX(g).ensure(g);
  if (o0.unit && o0.unit.members.some((m) => m.id === pid)) { await g.say(`（${c.s}は、いまの相方だ）`); return null; }
  if (!ct || !['replied', 'met', 'formed'].includes(ct.status)) { await g.say('（まだ会う約束をしていない）'); return null; }
  const B = BOARDS[c.board] || BOARDS.sns;
  const spot = MEET_SPOTS[B.meet];
  const why = g.lifeRefusal();
  if (why) { await g.say(why); return null; }
  if (st.stamina < 4) { await g.say('体力が足りない…。今日は会うのをやめておこう。'); return null; }
  if (st.money < spot.price) { await g.say(`お金が足りない…。（${spot.name}の${spot.drink}代 ${fmtMoney(spot.price)}）`); return null; }
  st.money -= spot.price;
  st.stamina -= 4;
  g.meet(pid).contact = true;
  const k = isKansai(P);
  const who = { name: P.name, look: P.look };
  const scene = new MeetScene(g, { pid, spot: B.meet, board: c.board, title: `${spot.name}で待ち合わせ` });
  await g.fadeOut(12);
  g.push(scene);
  await g.fadeIn(12);
  let out = null;
  try {
    const again = !!ct.met;
    ct.meets = num(ct.meets) + 1;
    if (!again) {
      if (c.q.includes('chikoku')) { scene.mode = 'wait'; await g.say(`（約束の時間をすぎても、${c.s}は来ない…。${spot.drink}がぬるくなっていく）`); }
      scene.mode = 'both';
      await g.say(c.say || (k ? `${c.s}です。よろしく！` : `${c.s}です。よろしく！`), who);
      if (!c.nsc) await g.say(`（${B.short}の「${c.h}」さんは、${c.age}歳・${c.g === 'f' ? '女性' : c.g === 'm' ? '男性' : '性別はないしょ'}。${['zasshi', 'pasotsu', 'webbbs', 'keitai'].includes(c.board) ? '顔を見るのは、今日が初めてだ' : '写真のとおりの人だ'}）`);
    } else {
      scene.mode = 'both';
      await g.say(k ? 'また会えてうれしいわ。\nこの前の話の続き、しよか。' : 'また会えてうれしい。\nこの前の話の続きをしよう。', who);
    }
    ct.met = ct.met || st.day;
    ct.status = 'met';
    ct.asked = ct.asked || {};
    // questions (each once per meeting; what you learn stays on the card)
    const asked = new Set();
    for (let turn = 0; turn < 8; turn++) {
      const qs = [];
      if (!asked.has('style')) qs.push(['どんな笑いがやりたい？', 'style']);
      if (!asked.has('motive')) qs.push(['お笑いをやる理由は？', 'motive']);
      if (!asked.has('quirk')) qs.push(['ふだんは何してるの？', 'quirk']);
      qs.push(['ちょっとネタ合わせしてみる？', 'trial']);
      qs.push(['今日はこのへんで', 'bye']);
      const i = await g.ask(turn === 0 ? '何を話そう？' : '（ほかに聞きたいことは？）', qs.map((q) => q[0]), { cancel: qs.length - 1 });
      const key = (qs[i] || qs[qs.length - 1])[1];
      if (key === 'bye') break;
      asked.add(key);
      if (key === 'style') { ct.asked.style = true; await g.say([line(c, STYLE_LINES, c.style), line(c, ROLE_LINES, c.role)], who); }
      else if (key === 'motive') { ct.asked.motive = true; await g.say(line(c, MOTIVE_LINES, c.mot), who); }
      else if (key === 'quirk') {
        ct.asked.quirk = true;
        const tell = c.q.map((q) => QUIRK_TELLS[q]).filter(Boolean);
        await g.say(k ? ['バイトして、帰ってネタ書いて…\nそんな毎日やな。'] : ['バイトして、帰ってネタを書いて…\nそんな毎日かな。'], who);
        if (tell.length) await g.say(tell.slice(0, 2));
      } else if (key === 'trial') {
        scene.mode = 'trial';
        await g.say(k ? 'ほな、ちょっとだけ。\n店の迷惑にならんように、小声でな。' : 'じゃあ、少しだけ。\nお店の迷惑にならないように、小さい声でね。', who);
        const r = await trial(g, pid, { venue: spot.name, skip: true });
        scene.mode = 'both';
        scene.trial = r;
        scene.trialT = scene.t; // [R9-C] the 手ごたえ meter / stamp start here
        g.sfx(r.score >= 55 ? 'good' : 'cancel');
        await g.say(`（おためしのネタ合わせ：${r.feel}。手ごたえ ${r.score}／100）`);
        await g.say(r.score >= 55 ? (k ? 'いまの、ええ感じやったな！' : 'いまの、いい感じだったね！') : (k ? '…うーん、まだ噛み合わへんな。' : '…うーん、まだ噛み合わないね。'), who);
        const j = await g.ask(`${c.s}と、コンビを組む？`, ['組もう！と言う', 'もう少し考える', '今回はやめておく'], { cancel: 1 });
        if (j === 0) { out = (await propose(g, pid, { npc: null })) ? 'formed' : 'refused'; break; }
        if (j === 2) { ct.status = 'declined'; out = 'declined'; await g.say(k ? 'そっか。…会えてよかったわ。おたがい、がんばろな。' : 'そっか。…会えてよかった。おたがい、がんばろうね。', who); break; }
        await g.say(k ? 'ほな、また連絡してや。' : 'じゃあ、また連絡してね。', who);
        out = 'later';
        break;
      }
    }
    if (!out) { await g.say(k ? '今日はおおきに。\nまた会おな。' : '今日はありがとう。\nまた会おうね。', who); out = 'later'; }
    g.addAff(pid, 3, true);
  } catch (e) { console.error(e); } finally {
    await g.fadeOut(12);
    g.pop(scene);
    await g.fadeIn(12);
  }
  return out;
}

// ---------------------------------------------------------------- your own 募集
async function post(g, opts = {}) {
  const n = net(g);
  const boards = boardsNow(g);
  if (!boards.length) return null;
  let board = opts.board && boards.includes(opts.board) ? opts.board : null;
  if (!board) {
    const i = boards.length === 1 ? 0 : await g.ask('どこに募集を出す？', [...boards.map((b) => BOARDS[b].short), 'やめておく'], { cancel: boards.length });
    if (i < 0 || i >= boards.length) return null;
    board = boards[i];
  }
  const s = await g.ask('どんな相方を探す？（スタイル）', ['漫才', 'コント', 'どちらでも'], { cancel: 2 });
  const r = await g.ask('相方の役割は？', ['ボケ', 'ツッコミ', 'どちらでも'], { cancel: 2 });
  const style = ['manzai', 'conte', null][s] || null;
  const role = ['boke', 'tsukkomi', null][r] || null;
  const def = `${style ? STYLES[style] + 'の' : ''}${role ? ROLES[role] : '相方'}募集！いっしょにてっぺんを目指しましょう。`;
  const text = opts.text || (await askText(g, { title: '募集の文章（40文字まで）', value: def, max: 40 })) || def;
  const B = BOARDS[board];
  n.post = { text, board, style, role, day: g.state.day, replyDay: g.state.day + B.postDelay, done: false };
  n.posts++;
  await g.say(`（${B.short}に募集を出した：「${text}」\n${B.postDelay >= 5 ? `雑誌にのるまで${B.postDelay}日ほどかかる。` : `返事は${B.postDelay}日ほどで来るかもしれない。`}）`);
  return n.post;
}

const methods = {
  owaraiBoards() { return boardsNow(this).map((id) => ({ id, ...BOARDS[id] })); },
  owaraiCandidates(source = 'net') { return candidates(this, source); },
  netStatus(pid) { return contactOf(this, pid); },
  netContact(pid) { return contact(this, pid); },
  async netMeet(pid, opts) { return meet(this, pid, opts); },
  async netPost(opts) { return post(this, opts); },
  async owaraiTrial(pid, opts) { return trial(this, pid, opts); },
  async owaraiPropose(pid, opts) { return propose(this, pid, opts); },
  // [R9-C] the reply a candidate sends (mine: they answer your contact; else: they answer your own 募集) — the board screen's thread
  owaraiReplyText(pid, mine = true) { return CANDIDATES[pid] && CANDIDATES[pid].board ? replyText(this, pid, mine) : ''; },
};
for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(Game.prototype, k, Object.getOwnPropertyDescriptor(methods, k));

// talk menu: an NSC 同期 / a met candidate on the map (not yet your 相方)
{
  const memberOf = (g, id) => { const o = OWX(g).ensure(g); return !!(o.unit && o.unit.members.some((m) => m.id === id)); };
  const eligible = (g, id) => {
    const c = CANDIDATES[id];
    if (!c || memberOf(g, id)) return false;
    const o = OWX(g).ensure(g);
    if (c.nsc) return o.nsc && o.nsc.campus === c.nsc && ['enrolled', 'graduated'].includes(o.nsc.status);
    const ct = contactOf(g, id);
    return !!(ct && ct.met);
  };
  PEOPLE_UI.extras.push({
    id: 'ow_try', label: 'ネタ合わせしてみる', order: 18,
    cond: (g, id) => eligible(g, id) && !(contactOf(g, id) && Number.isFinite(contactOf(g, id).trial) && contactOf(g, id).trialDay === g.state.day),
    run: async (g, id, npc) => {
      const P = PEOPLE[id];
      if (g.state.stamina < 6) { await g.say('体力が足りない…。'); return 'end'; }
      g.state.stamina -= 6;
      await g.say(isKansai(P) ? 'ええよ、ちょっとやってみよか。' : 'いいよ、ちょっとやってみよう。', { name: P.name, look: (npc && npc.look) || P.look });
      const r = await trial(g, id, { venue: 'NSCの稽古場', skip: true });
      const ct = contactOf(g, id);
      if (ct) ct.trialDay = g.state.day;
      g.sfx(r.score >= 55 ? 'good' : 'cancel');
      await g.say(`（${P.short || P.name}とのおためしネタ合わせ：${r.feel}。手ごたえ ${r.score}／100）`);
    },
  });
  PEOPLE_UI.extras.push({
    id: 'ow_combi', label: 'コンビを組もう', order: 19,
    cond: (g, id) => {
      if (!eligible(g, id)) return false;
      const ct = contactOf(g, id);
      if (!ct || !Number.isFinite(ct.trial)) return false;
      return ct.status !== 'refused' || g.state.day - num(ct.refusedAt) >= 10;
    },
    run: async (g, id, npc) => {
      const ok = await propose(g, id, { npc });
      return ok ? 'end' : undefined;
    },
  });
}

export { netMorning };
export { candidates as owaraiCandidates, boardsNow as owaraiBoardsNow, trial as owaraiTrialFn, propose as owaraiProposeFn, meet as owaraiMeetFn, KINDS };
