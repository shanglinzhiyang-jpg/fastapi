// スキャンダルの展開 (R18) — a scandal is not one line of news: it is a story that runs for weeks. This module follows every scandal the politics core reports (the player's
// and any politician's, whichever party they belong to — nothing is held back or softened, the names, the party, the sums and the sources are all printed) through
// 第一報 → 続報と追及 → (捜査 → 起訴 → 公判 → 判決) or (辞職要求) or (沈静化), with a 世論の怒り (heat) that rises and fades, and for the player the answers to give.
//
// Rules: every person is fictional (a real named figure, n.real, never has a scandal: politics.js refuses it); the games's usual line holds — nothing is refused for being
// bad, every answer shows its odds and its price first; a cover-up is a choice like any other, and if it is found out it is a worse scandal of its own.
// The player's criminal side (a prosecution of the player) stays in crime.js (it listens to the same 'scandal' event); this module is the press and the public.
//
// State g.state.scandal (lazy, repaired on read): { v, seq, cases: [CASE], pending: null | { id, kind: 'respond' | 'pressure', day }, lastGen, done }
//   CASE = { id, kind, name, who: 'player' | npcId, whoName, party, partyName, post, amount, sev, day, src, stage: 'scoop' | 'follow' | 'probe' | 'charged' | 'trial' | 'pressure' | 'closed',
//     stageDay, wait, heat (0..100), followed, resp, denied, cover: null | { day }, crime (a criminal case is possible), outcome: null | string, log: [{ day, text }] }
// API (on Game): g.scandals() → { open, pending, cases: [summary] }; g.scandalCase(id); g.scandalOptions(id) → [{ id, name, desc, lines, odds, why }]; g.scandalRespond(id, choice) → { ok, why?, text? };
//   g.scandalNew(kind, who?) → starts a scandal by hand (tests / the debug menu). The phone app 「スクープ」 (id 'scoop', order 66.5) lists the cases and takes the player's answers.

import { Game } from './game.js';
import { onMorning, registerPhoneApp } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { onPolitics, POSTS, postName, PARTY_DEFS, polDate, dateLabel } from './politics.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, bulletText, phoneText as T } from './phone.js';

const COLOR = '#c8782a';
const YEAR = 120;
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const today = (g) => (g.state && g.state.day) || 1;
let rng = () => Math.random();
export const setScandalRng = (f) => { rng = typeof f === 'function' ? f : () => Math.random(); };
const roll = (p) => rng() < p;
const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];

// ======================================================================== the kinds of scandal
// pc: the chance that a criminal case is opened (the prosecutors' side); follow: the lines of the follow-up reports ({n}: the name); crimeName: what the charge is called
export const KINDS = {
  slush_fund: { label: '政治資金の不記載（裏金）', pc: 0.55, crimeName: '政治資金規正法違反（不記載）', src: ['市民団体の告発', '元秘書の内部告発', '新聞の調査報道', '週刊誌「週刊ドット」の報道'],
    follow: ['{n}の事務所は、収支報告書に載らなかった資金の使いみちについて、記者の質問に答えていない。', '元秘書が「会計の処理は議員に報告していた」と話していることがわかった。', '野党は、真相の解明に向けて関係者の証人喚問を求めている。'] },
  bribery: { label: '収賄の疑い', pc: 0.8, crimeName: '収賄', src: ['新聞の調査報道', '業者の内部告発', '週刊誌「週刊ドット」の報道'],
    follow: ['{n}が、問題の業者と会食を重ねていたと報じられた。', '現金を受け取ったとされる時期の、面会の記録が見つかったという。', '野党が「疑惑を放置したまま国会を続けるな」と迫った。'] },
  vote_buying: { label: '選挙違反（買収）の疑い', pc: 0.8, crimeName: '公職選挙法違反（買収）', src: ['地元の支持者の通報', '新聞の調査報道', '対立陣営の告発'],
    follow: ['{n}の陣営の関係者が、現金を渡したと話していることがわかった。', '陣営の運動員が、警察の事情聴取を受けたと報じられた。', '地元では「選挙のやり直しを」という声が上がっている。'] },
  expense: { label: '政治資金の私的な流用', pc: 0.4, crimeName: '政治資金の私的流用', src: ['週刊誌「週刊ドット」の報道', '元秘書の内部告発', '新聞の調査報道'],
    follow: ['政治資金で支払われた飲食や買い物の領収書が、次々に示された。', '家族名義の口座への支払いがあったとも報じられた。', '野党は「返金と説明」を求めている。'] },
  antisocial: { label: '反社会的勢力との交際', pc: 0.1, crimeName: '', src: ['週刊誌「週刊ドット」の報道', 'ネット上の投稿の拡散'],
    follow: ['{n}と、反社会的勢力の関係者が一緒に写る写真が出回った。', '事務所は「面識はあるが、交際はない」と説明した。', '警察が事実関係の確認を始めたという。'] },
  private: { label: '私生活のスキャンダル', pc: 0, crimeName: '', src: ['週刊誌「週刊ドット」の報道', 'ネット上の投稿の拡散'],
    follow: ['{n}の事務所は、報道について「私的なことで、お答えしない」とした。', '相手とされる人物の話が、続報として出た。', '地元の支持者のあいだに、戸惑いが広がっている。'] },
  affair: { label: '不倫の報道', pc: 0, crimeName: '', src: ['週刊誌「週刊ドット」の報道'],
    follow: ['{n}が、相手の自宅に出入りする写真が掲載された。', '家族の話も報じられ、ネット上では批判と中傷が入り交じっている。', '「政治家としての説明責任」を問う声が、党の内外から出ている。'] },
  harassment: { label: '秘書へのパワーハラスメント', pc: 0, crimeName: '', src: ['元秘書の内部告発', '週刊誌「週刊ドット」の報道'],
    follow: ['{n}が秘書を叱責する音声が、報道各社に提供された。', '元秘書が「人格を否定する言葉を、毎日のように浴びた」と話した。', '党の幹部が「事実なら看過できない」と述べた。'] },
  nepotism: { label: '親族企業への便宜（口利き）', pc: 0.5, crimeName: 'あっせん利得処罰法違反', src: ['新聞の調査報道', '会計検査での指摘', '週刊誌「週刊ドット」の報道'],
    follow: ['親族の会社が、行政の発注を受けていたことがわかった。', '{n}が担当の部局に「口をきいた」とされる面会の記録が報じられた。', '野党は、発注の経緯の資料を出すよう求めている。'] },
  doc: { label: '公文書の改ざん・廃棄', pc: 0.4, crimeName: '公文書毀棄', src: ['新聞の調査報道', '職員の内部告発'],
    follow: ['問題の文書の、改ざん前と後の写しが明らかになった。', '担当の職員が「上の指示だった」と周囲に話していたという。', '野党は「公文書の信頼が崩れる」と、調査委員会を求めた。'] },
  resume: { label: '経歴の詐称', pc: 0, crimeName: '', src: ['週刊誌「週刊ドット」の報道', 'ネット上の投稿の拡散'],
    follow: ['公表している学歴の一部に、事実と異なる記載があると報じられた。', '出身校は「在籍の記録がない」と回答したという。', '選挙公報の記載をめぐって、有権者への説明を求める声が出ている。'] },
  tax: { label: '所得の申告漏れ', pc: 0.6, crimeName: '所得税法違反', src: ['新聞の調査報道', '週刊誌「週刊ドット」の報道'],
    follow: ['収入の一部が、申告されていなかったと報じられた。', '税務当局の調査が入ったという。', '事務所は「修正申告に応じる」としたが、批判は止まらない。'] },
  carusage: { label: '公用車・出張の私的利用', pc: 0, crimeName: '', src: ['新聞の調査報道', '週刊誌「週刊ドット」の報道', 'ネット上の投稿の拡散'],
    follow: ['公用車が、私的な外出にくり返し使われていたと報じられた。', '出張費の精算に、不自然な点が見つかった。', '事務所は「確認のうえ、返還する」と述べた。'] },
  foreign: { label: '外国企業に関係する団体からの献金', pc: 0.5, crimeName: '政治資金規正法違反（外国人からの寄附）', src: ['新聞の調査報道', '市民団体の告発'],
    follow: ['寄附をした団体が、外国の企業と資本関係にあることがわかった。', '{n}の事務所は「確認していなかった」と説明している。', '野党は、受け取った経緯の資料を求めている。'] },
  gerrymander: { label: '区割りの恣意的な操作（ゲリマンダー）', pc: 0, crimeName: '', src: ['新聞の調査報道', '審議会の委員の証言', '市民団体の指摘'],
    follow: ['線引きの経過を示す資料が、与党に有利な形で引かれていたことを裏づけたと報じられた。', '野党は「選挙の公正を損なう」として、区割りの見直しを求めている。', '専門家は「違憲の判断が出る可能性がある」と指摘している。'] },
  coverup: { label: '証拠隠滅・隠蔽の疑い', pc: 0.5, crimeName: '証拠隠滅', src: ['内部の関係者の証言', '新聞の調査報道'],
    follow: ['資料の廃棄を指示したとされる記録が、報じられた。', '関係者が「口裏合わせを求められた」と話している。', '「最初の問題より、隠そうとしたことが問題だ」という声が広がった。'] },
};
const GENERIC = { label: 'スキャンダル', pc: 0, crimeName: '', src: ['週刊誌「週刊ドット」の報道', '新聞の調査報道'], follow: ['{n}の事務所は、報道について説明を求められている。', '続報が相次ぎ、野党が追及の構えを見せている。', '世論の批判がおさまる気配はない。'] };
const kindOf = (k) => KINDS[k] || GENERIC;
// which of the new kinds can fall on a politician out of the blue (kind → weight), and which need a cabinet seat
const NEW_KINDS = { affair: 3, harassment: 2, nepotism: 2, resume: 1, tax: 1.5, carusage: 2.5, foreign: 1.5 };
const SEV = { affair: 2, harassment: 2, nepotism: 3, resume: 2, tax: 3, carusage: 2, foreign: 3, doc: 4, coverup: 4, gerrymander: 3 };
export const STAGE_NAMES = { scoop: '第一報', follow: '続報と追及', probe: '捜査', charged: '起訴', trial: '公判', pressure: '辞職要求', closed: '決着' };

// ======================================================================== state
function ensure(g) {
  const st = g.state;
  if (!isObj(st.scandal)) st.scandal = { v: 1, seq: 0, cases: [], pending: null, lastGen: 0, done: 0 };
  const s = st.scandal;
  s.seq = num(s.seq); s.lastGen = num(s.lastGen); s.done = num(s.done);
  if (!Array.isArray(s.cases)) s.cases = [];
  s.cases = s.cases.filter((c) => isObj(c) && c.id);
  for (const c of s.cases) {
    c.heat = clamp(num(c.heat), 0, 100); c.sev = clamp(num(c.sev, 2), 1, 5); c.stageDay = num(c.stageDay); c.day = num(c.day); c.wait = num(c.wait, 2);
    if (!Array.isArray(c.log)) c.log = [];
    if (!STAGE_NAMES[c.stage]) c.stage = 'closed';
  }
  if (!isObj(s.pending) || !s.cases.some((c) => c.id === s.pending.id && c.stage !== 'closed')) s.pending = null;
  return s;
}
const pol = (g) => (typeof g.pol === 'function' ? g.pol() : null);
const caseById = (g, id) => ensure(g).cases.find((c) => c.id === id) || null;
const fyOf = (g) => { try { return polDate(g).fy; } catch (e) { return 2026; } };

function pname(p, id) { return id ? (p.parties && p.parties[id] && p.parties[id].short) || (PARTY_DEFS[id] && PARTY_DEFS[id].short) || '' : ''; }
function postOf(g, p, who) {
  if (who === 'player') {
    const me = p.me;
    const cab = (me.posts || []).find((x) => POSTS[x] && POSTS[x].kind === 'cabinet');
    if (cab) return cab === 'pm' ? '総理大臣' : postName(cab, fyOf(g));
    return me.office === 'sangi' ? '参議院議員' : me.office === 'shugi' ? '衆議院議員' : me.office ? '議員' : '';
  }
  const n = p.npcs[who];
  if (!n) return '';
  const post = (n.posts || []).find((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && (x === 'pm' ? p.cabinet.pm === who : p.cabinet.ministers[x] === who));
  if (post) return post === 'pm' ? '総理大臣' : postName(post, fyOf(g));
  return n.office === 'sangi' ? '参議院議員' : n.office === 'shugi' ? '衆議院議員' : n.office ? '議員' : '元議員';
}
const isCab = (c) => /大臣|総理/.test(c.post);

// ======================================================================== the log and the news
function say(g, p, c, text, o = {}) {
  const day = today(g);
  c.log.unshift({ day, text });
  if (c.log.length > 24) c.log.length = 24;
  if (o.news !== false && p) { p.news.unshift({ day, text: `【${c.whoName}】${text}`, kind: 'politics' }); if (p.news.length > 80) p.news.length = 80; }
  // the phone: every step of the player's own case, and the big steps of a minister's or a serious one
  if (o.msg || (o.msg === undefined && c.who === 'player')) { try { g.message({ from: 'ドット新聞 政治部', text: `【${STAGE_NAMES[c.stage] || ''}】${c.whoName}氏\n${text}`, kind: 'news' }); } catch (e) { /* no phone */ } }
}
const tpl = (s, c) => s.replace(/\{n\}/g, c.whoName);

// ======================================================================== opening a case (from the politics core's 'scandal' event)
const SKIP = new Set(['gaffe', 'absence', 'stepdown']);
function openCase(g, rec) {
  const p = pol(g);
  if (!p || !rec || SKIP.has(rec.kind)) return null;
  const s = ensure(g);
  const who = rec.who || 'player';
  const n = who === 'player' ? null : p.npcs[who];
  if (who !== 'player' && !n) return null;
  if (s.cases.some((c) => c.stage !== 'closed' && c.who === who && c.kind === rec.kind && today(g) - c.day < 6)) return null; // the same story is one case
  const K = kindOf(rec.kind);
  const sev = clamp(num(rec.severity, SEV[rec.kind] || 2), 1, 5);
  const c = {
    id: `s${++s.seq}`, kind: rec.kind, name: rec.name || K.label, who, whoName: who === 'player' ? `${g.state.name}` : n.name,
    party: who === 'player' ? p.me.party || '' : n.party || '', partyName: '', post: postOf(g, p, who), amount: num(rec.amount), sev, day: today(g),
    src: pick(K.src), stage: 'scoop', stageDay: today(g), wait: 2, heat: 0, followed: 0, resp: null, denied: false, cover: null, crime: K.pc > 0 && sev >= 2, outcome: null, log: [],
  };
  c.partyName = pname(p, c.party);
  c.heat = clamp(sev * 14 + (isCab(c) ? 12 : 0) + (c.post === '総理大臣' ? 10 : 0) + (c.amount >= 10000000 ? 8 : 0) + rint(0, 8), 5, 95);
  s.cases.unshift(c);
  if (s.cases.length > 60) { const keep = s.cases.filter((x) => x.stage !== 'closed'); s.cases = keep.concat(s.cases.filter((x) => x.stage === 'closed').slice(0, Math.max(10, 50 - keep.length))); }
  const who2 = `${c.whoName}${c.post ? `（${c.post}` : ''}${c.partyName ? `${c.post ? '・' : '（'}${c.partyName}` : ''}${c.post || c.partyName ? '）' : ''}`;
  say(g, p, c, `${who2}に${c.name}。${c.src}で明らかになった。${c.amount ? `金額は${fmtMoney(c.amount)}にのぼるという。` : ''}`, { msg: false, news: c.who === 'player' ? false : true });
  if (who === 'player') {
    s.pending = { id: c.id, kind: 'respond', day: today(g) };
    try { g.message({ from: 'ドット新聞 政治部', text: `【スクープ】${c.whoName}氏に${c.name}。${c.src}で明らかになり、各社が説明を求めています。\n（スマホの「スクープ」で、対応を決めてください）`, kind: 'news' }); } catch (e) { /* no phone */ }
  }
  return c;
}
onPolitics('scandal', (g, rec) => { try { if (g && g.state) openCase(g, rec); } catch (e) { console.error(e); } });

// ======================================================================== the stages
function close(g, p, c, outcome, text, o = {}) {
  c.stage = 'closed'; c.stageDay = today(g); c.outcome = outcome;
  const s = ensure(g); s.done++;
  if (s.pending && s.pending.id === c.id) s.pending = null;
  if (text) say(g, p, c, text, o);
}
function setStage(c, g, stage, wait) { c.stage = stage; c.stageDay = today(g); c.wait = wait; }
const leaveSeat = (g, c, why) => { try { return typeof g.aiScandalExit === 'function' && c.who !== 'player' ? g.aiScandalExit(c.who, why) : false; } catch (e) { console.error(e); return false; } };

function followUp(g, p, c) {
  const K = kindOf(c.kind);
  const line = K.follow[Math.min(c.followed, K.follow.length - 1)];
  c.followed++;
  c.heat = clamp(c.heat + (c.followed === 1 ? 6 + c.sev * 2 : 4) + (c.denied ? 6 : 0), 0, 100);
  setStage(c, g, 'follow', 3);
  say(g, p, c, tpl(line, c), { msg: c.who === 'player' });
  if (isCab(c) && p.cabinet) p.cabinet.scandal = num(p.cabinet.scandal) - 0.5 - c.sev * 0.2;
  // a hidden thing may come out on its own
  if (c.cover && !c.cover.out && roll(0.16)) exposeCover(g, p, c);
}
function exposeCover(g, p, c) {
  if (!c.cover || c.cover.out) return;
  c.cover.out = true; c.heat = clamp(c.heat + 30, 0, 100);
  say(g, p, c, `内部の関係者の証言で、問題を隠そうとしていたことが発覚した。「最初の問題より重い」と各紙が書いた。`, { msg: true });
  if (c.who === 'player') { try { g.politicalScandal('coverup', { who: 'player', severity: Math.min(5, c.sev + 1) }); } catch (e) { console.error(e); } }
  else if (p.npcs[c.who]) { try { g.politicalScandal('coverup', { who: c.who, severity: Math.min(5, c.sev + 1) }); } catch (e) { console.error(e); } }
}
function nextAfterFollow(g, p, c) {
  const K = kindOf(c.kind);
  const criminal = c.crime && K.pc > 0;
  if (c.who !== 'player') {
    if (criminal && roll(clamp(K.pc * (c.sev >= 4 ? 1.2 : 1) * clamp(c.heat / 55, 0.5, 1.3), 0, 0.95))) {
      setStage(c, g, 'probe', rint(4, 8)); c.heat = clamp(c.heat + 10, 0, 100);
      say(g, p, c, `地検が、${c.whoName}の関係先の捜索に入った。${K.crimeName ? `${K.crimeName}の疑いで調べている。` : ''}`, { msg: false });
      return;
    }
    if (c.heat >= 68) return pressure(g, p, c);
  } else if (c.heat >= 68) { return pressure(g, p, c); }
  close(g, p, c, 'fade', c.who === 'player' && c.resp === 'apologize' ? '会見での謝罪を受け、批判は少しずつおさまっていった。' : '新しい話題に押され、報道は下火になっていった。', { msg: c.who === 'player' });
}
function pressure(g, p, c) {
  setStage(c, g, 'pressure', 2);
  if (c.who === 'player') {
    ensure(g).pending = { id: c.id, kind: 'pressure', day: today(g) };
    say(g, p, c, `「責任をとって辞めるべきだ」という声が、党の内外から高まっている。（「スクープ」で身の振り方を決めてください）`, { msg: true });
    return;
  }
  const n = p.npcs[c.who];
  const quit = roll(clamp(0.3 + c.heat / 220 + c.sev * 0.04, 0.2, 0.85));
  if (quit && n && !n.real) {
    const post = c.post;
    if (c.post && /大臣/.test(c.post)) { /* the cabinet already replaced a minister when the scandal broke (politics.js) */ }
    const out = leaveSeat(g, c, `${c.name}の責任`);
    close(g, p, c, 'resigned', out ? `${c.whoName}氏が、${c.name}の責任をとって議員を辞職した。補欠選挙が行われる見通し。` : `${c.whoName}氏が、${post || '役職'}を辞任し、「けじめをつけたい」と述べた。`, { msg: false });
  } else {
    close(g, p, c, 'stayed', `${c.whoName}氏は記者団に「責任を果たすことで、信頼を回復したい」と述べ、続投の考えを示した。野党は「居座りだ」と批判している。`);
  }
}
function charge(g, p, c) {
  const K = kindOf(c.kind);
  const small = c.kind === 'slush_fund' && c.amount > 0 && c.amount < 5000000;
  const pCharge = clamp(0.35 + c.sev * 0.1 + c.heat / 300 + (c.denied ? 0.15 : 0), 0.2, 0.92);
  if (!roll(pCharge)) {
    close(g, p, c, 'dropped', `地検は${c.whoName}氏について、嫌疑不十分として不起訴とした。野党は「政治的・道義的な責任は残る」としている。`, { msg: false });
    return;
  }
  if (small && roll(0.5)) {
    close(g, p, c, 'fined', `地検は${c.whoName}氏を、${K.crimeName}で略式起訴。簡易裁判所は罰金${rint(10, 50)}万円の略式命令を出した。禁錮以上ではないが、罰金刑でも公民権が停止されることがある。`, { msg: false });
    leaveSeat(g, c, `${K.crimeName}での略式命令`);
    return;
  }
  setStage(c, g, 'charged', 2); c.heat = clamp(c.heat + 8, 0, 100);
  say(g, p, c, `地検は${c.whoName}氏を、${K.crimeName}の罪で在宅起訴した。`, { msg: false });
  if (roll(0.55)) {
    const out = leaveSeat(g, c, '起訴の責任');
    if (out) say(g, p, c, `${c.whoName}氏は議員を辞職した。「裁判で争う」とコメントしている。`);
  }
}
function verdict(g, p, c) {
  const K = kindOf(c.kind);
  const day = today(g);
  if (!roll(0.92)) {
    close(g, p, c, 'acquitted', `地裁は${c.whoName}氏に無罪を言い渡した。検察は、控訴を検討するという。`, { msg: false });
    return;
  }
  const heavy = c.sev >= 5 && roll(0.4);
  const yrs = heavy ? rint(2, 4) : rint(1, 3);
  const tail = heavy ? `実刑判決で、公民権は刑の執行を終えるまで、さらに5年間停止される。` : `執行猶予の期間中は、公民権が停止される。`;
  const sentence = c.sev <= 3 && roll(0.5) ? `罰金${rint(30, 100)}万円` : heavy ? `懲役${yrs}年` : `懲役${yrs}年・執行猶予${rint(3, 5)}年`;
  leaveSeat(g, c, '有罪判決');
  close(g, p, c, 'guilty', `地裁は${c.whoName}氏に、${K.crimeName}の罪で${sentence}の判決を言い渡した。${/罰金/.test(sentence) ? '' : tail}`, { msg: false });
}
function advance(g, p, c) {
  const day = today(g);
  const el = day - c.stageDay;
  if (c.who !== 'player' && !p.npcs[c.who]) { close(g, p, c, 'gone', '', { news: false }); return; }
  switch (c.stage) {
    case 'scoop': if (el >= c.wait) followUp(g, p, c); break;
    case 'follow':
      if (el < c.wait) break;
      if (c.followed < 2) { followUp(g, p, c); break; }
      nextAfterFollow(g, p, c); break;
    case 'probe': if (el >= c.wait) charge(g, p, c); break;
    case 'charged': if (el >= c.wait) { setStage(c, g, 'trial', rint(12, 26)); say(g, p, c, `${c.whoName}氏の初公判が開かれた。${c.resp === 'apologize' ? '起訴された事実を認めた。' : '起訴された内容を、一部否認した。'}`); } break;
    case 'trial': if (el >= c.wait) verdict(g, p, c); break;
    case 'pressure': if (c.who !== 'player' && el >= 0) pressure(g, p, c); break;
    default: break;
  }
}

// ======================================================================== the morning
function generate(g, p) {
  const s = ensure(g), day = today(g);
  if (s.lastGen >= day) return;
  s.lastGen = day;
  // somebody else: about 2.5 a year on top of the core's own (about 4 a year), a minister more often
  if (roll(2.5 / YEAR)) {
    const pool = Object.values(p.npcs).filter((n) => !n.real && !n.dead && !n.exMp && (n.office || (n.posts || []).length) && !s.cases.some((c) => c.stage !== 'closed' && c.who === n.id));
    if (pool.length) {
      const w = pool.map((n) => ((n.posts || []).some((x) => POSTS[x] && POSTS[x].kind === 'cabinet') ? 3 : 1) + (n.ai ? clamp(num(n.ai.risk, 30) / 40, 0, 2) : 0));
      let r = rng() * w.reduce((a, b) => a + b, 0), i = 0;
      for (; i < pool.length - 1; i++) { r -= w[i]; if (r <= 0) break; }
      const n = pool[i];
      const cab = (n.posts || []).some((x) => POSTS[x] && POSTS[x].kind === 'cabinet');
      const kinds = Object.assign({}, NEW_KINDS, cab ? { doc: 1.5 } : {});
      const kind = weighted(kinds);
      try { g.politicalScandal(kind, { who: n.id, name: kindOf(kind).label, severity: SEV[kind] || 2, amount: ['nepotism', 'foreign', 'tax', 'carusage'].includes(kind) ? rint(1, 40) * 100000 : 0 }); } catch (e) { console.error(e); }
    }
  }
  // the player: only a politician is a target; a fame or an office makes it likelier
  const me = p.me;
  if (me && me.office && !s.cases.some((c) => c.who === 'player' && c.stage !== 'closed')) {
    const rate = (0.8 + Math.min(1.2, Math.log10(1 + num(g.state.fame)) / 4)) / YEAR * (isCab({ post: postOf(g, p, 'player') }) ? 1.5 : 1);
    if (roll(rate)) {
      const kinds = { carusage: 2, tax: 1, resume: 1, nepotism: 1 };
      if (num(me.staff) > 0) kinds.harassment = 2;
      const rom = g.state.flags && g.state.flags.rom && isObj(g.state.flags.rom.c) ? Object.values(g.state.flags.rom.c) : [];
      if (rom.some((r) => r && r.st === 'married')) kinds.affair = 2;
      const kind = weighted(kinds);
      try { g.politicalScandal(kind, { who: 'player', name: kindOf(kind).label, severity: SEV[kind] || 2, amount: ['nepotism', 'tax', 'carusage'].includes(kind) ? rint(1, 30) * 100000 : 0 }); } catch (e) { console.error(e); }
    }
  }
}
function weighted(map) {
  const ks = Object.keys(map);
  let r = rng() * ks.reduce((a, k) => a + map[k], 0);
  for (const k of ks) { r -= map[k]; if (r <= 0) return k; }
  return ks[ks.length - 1];
}
function tick(g) {
  const p = pol(g);
  if (!p || !g.state) return;
  const s = ensure(g), day = today(g);
  // the player's open question: an unanswered one is answered for them (silence)
  if (s.pending && day - num(s.pending.day) >= 2) {
    const c = caseById(g, s.pending.id);
    if (c && s.pending.kind === 'respond') { respond(g, c.id, 'silence', true); }
    else if (c && s.pending.kind === 'pressure') { respond(g, c.id, 'stay', true); }
    else s.pending = null;
  }
  for (const c of s.cases.slice()) {
    if (c.stage === 'closed') continue;
    if (c.stage !== 'scoop') c.heat = clamp(c.heat - 1, 0, 100);
    // the public's anger weighs on the player's name
    if (c.who === 'player' && c.heat >= 55 && p.me) { p.me.localSupport = clamp(num(p.me.localSupport) - 0.15, 0, 100); }
    try { advance(g, p, c); } catch (e) { console.error(e); c.stage = 'closed'; }
  }
  generate(g, p);
  // old closed cases are not kept forever
  const closed = s.cases.filter((c) => c.stage === 'closed');
  if (closed.length > 40) s.cases = s.cases.filter((c) => c.stage !== 'closed').concat(closed.slice(0, 40));
}
onMorning((g) => tick(g));

// ======================================================================== the player's answers
function RESP(g, p, c) {
  const talk = num(g.state.skills && g.state.skills.talk);
  const sev = c.sev;
  const staff = num(p.me && p.me.staff);
  return [
    { id: 'apologize', name: '事実を認めて謝罪する', desc: '記者会見を開き、頭を下げて経緯を説明する。', odds: null,
      lines: ['世論の怒り −22', '「やはり事実だった」と言われることはなくなる', '代償：報じられた事実を認めたことになる'] },
    { id: 'explain', name: '記者会見でていねいに説明する', desc: '資料を示し、質問に一つずつ答える。', odds: clamp(Math.round(68 - sev * 8 + talk / 6), 15, 85),
      lines: ['成功：世論の怒り −18', '失敗：「言い訳だ」と受けとられ、怒り +12・評判 −2'] },
    { id: 'deny', name: '全面的に否認する', desc: '「事実無根だ」と言い切り、法的措置も辞さないと述べる。', odds: clamp(Math.round(48 - sev * 5), 10, 60),
      lines: ['成功：世論の怒り −8', '失敗：証拠が出て、怒り +28・評判 −6・党内の立場 −5（捜査があれば不利に）'] },
    { id: 'silence', name: 'ノーコメントを貫く', desc: '「個別のことにはお答えしない」と繰り返す。', odds: null,
      lines: ['世論の怒り +6（説明がないという批判）', '代償は小さいが、問題は長引く'] },
    ...(staff > 0 ? [{ id: 'blame', name: '「秘書がやった」と説明する', desc: '「私の知らないところで秘書が行った」と話す。', odds: clamp(Math.round(55 - sev * 5), 15, 60),
      lines: ['成功：世論の怒り −14（秘書は辞める）', '失敗：秘書が反論し、怒り +16・評判 −4'] }] : []),
    { id: 'cover', name: '証拠を隠す（隠蔽する）', desc: '資料を処分し、関係者に口止めをする。', odds: clamp(Math.round(55 - sev * 6), 10, 60),
      lines: ['成功：世論の怒り −25（ただし、あとで発覚することがある）', '失敗：隠蔽が発覚し、「証拠隠滅」という別のスキャンダルが加わる（怒り +30）', '隠蔽そのものが罪に問われることがある'] },
  ];
}
const PRESS = [
  { id: 'stay', name: '続投する', desc: '「責任を果たすことで信頼を回復する」と述べる。', odds: null, lines: ['世論の怒りは下がりにくく、党内の立場が下がる'] },
  { id: 'post', name: '役職を辞任する', desc: '大臣・党の役職を辞し、議員は続ける。', odds: null, lines: ['世論の怒り −35'] },
  { id: 'seat', name: '議員を辞職する', desc: '議員を辞め、補欠選挙が行われる。', odds: null, lines: ['世論の怒り −60・ことは決着する', '代償：議席を失う'] },
  { id: 'party', name: '離党する', desc: '党に迷惑をかけたとして、党を離れる。', odds: null, lines: ['世論の怒り −30', '代償：党の支えを失う'] },
];
export function options(g, id) {
  const p = pol(g), c = caseById(g, id), s = ensure(g);
  if (!p || !c || c.who !== 'player') return [];
  const wantKind = s.pending && s.pending.id === id ? s.pending.kind : null;
  const list = wantKind === 'pressure' ? PRESS : wantKind === 'respond' ? RESP(g, p, c) : [];
  return list.map((o) => ({ ...o, why: null }));
}
function respond(g, id, choice, auto = false) {
  const p = pol(g), c = caseById(g, id), s = ensure(g);
  if (!p || !c || c.who !== 'player') return { ok: false, why: 'その件には対応できない' };
  if (!s.pending || s.pending.id !== id) return { ok: false, why: '対応を求められていない' };
  const kind = s.pending.kind;
  const o = options(g, id).find((x) => x.id === choice);
  if (!o) return { ok: false, why: 'その選択肢はない' };
  s.pending = null;
  const me = p.me;
  const win = o.odds == null ? true : roll(o.odds / 100);
  let text = '';
  const rep = (d) => { me.reputation = clamp(num(me.reputation) + d, -100, 100); };
  const stand = (d) => { me.standing = clamp(num(me.standing) + d, 0, 100); };
  const heat = (d) => { c.heat = clamp(c.heat + d, 0, 100); };
  if (kind === 'respond') {
    c.resp = choice;
    switch (choice) {
      case 'apologize': heat(-22); rep(1); text = '記者会見で頭を下げ、経緯を説明した。「認めた以上、逃げずに責任を果たす」と述べた。'; break;
      case 'explain': if (win) { heat(-18); rep(1); text = '資料を示した説明に、「一定の理解はできる」という声が出た。'; } else { heat(12); rep(-2); text = '説明は「質問をはぐらかした」と受けとられ、批判が強まった。'; } break;
      case 'deny': if (win) { heat(-8); text = '「事実無根」と言い切った。決定的な証拠は、いまのところ出ていない。'; } else { c.denied = true; heat(28); rep(-6); stand(-5); text = '否認した直後に、反証する資料が報じられた。「うそをついた」という批判が加わった。'; } break;
      case 'silence': heat(6); text = '「お答えできない」と繰り返し、会見を打ち切った。「説明がない」という批判が出ている。'; break;
      case 'blame': if (win) { heat(-14); try { g.hireStaff(-1); } catch (e) { /* no staff */ } text = '「秘書が私の知らないところでやった」と説明した。秘書は辞めた。'; } else { heat(16); rep(-4); text = '「秘書がやった」という説明に、当の秘書が反論。「責任を押しつけた」と批判された。'; } break;
      case 'cover': if (win) { heat(-25); c.cover = { day: today(g), out: false }; text = '資料を処分し、関係者に口止めをした。報道はいったん静かになった。'; } else { heat(30); c.cover = { day: today(g), out: true }; text = '隠そうとした動きが、すぐに明るみに出た。'; try { g.politicalScandal('coverup', { who: 'player', severity: Math.min(5, c.sev + 1) }); } catch (e) { console.error(e); } } break;
      default: break;
    }
    if (auto) text = '対応が遅れ、「説明がない」と批判された。' ;
    say(g, p, c, text, { news: true, msg: false });
    return { ok: true, text, win, auto };
  }
  // pressure
  c.resp = choice;
  switch (choice) {
    case 'stay': heat(-3); stand(-4); text = '「責任を果たしながら信頼を回復する」と述べ、続投の考えを示した。'; close(g, p, c, 'stayed', text, { msg: false }); break;
    case 'post': { heat(-35); stand(-3); const cab = (me.posts || []).filter((x) => POSTS[x] && (POSTS[x].kind === 'cabinet' || POSTS[x].kind === 'party') && x !== 'pm'); for (const x of cab) { try { g.resignPost(x, c.name); } catch (e) { console.error(e); } } text = cab.length ? '大臣・党の役職を辞任した。議員は続ける。' : '「役職はないが、責任は重く受けとめる」と述べた。'; close(g, p, c, 'post', text, { msg: false }); break; }
    case 'seat': heat(-60); text = '議員辞職を表明した。「けじめをつけたい」と述べた。'; close(g, p, c, 'seat', text, { msg: false }); try { g.resignOffice(`${c.name}の責任`); } catch (e) { console.error(e); } break;
    case 'party': heat(-30); text = '党に迷惑をかけたとして、離党を届け出た。'; close(g, p, c, 'party', text, { msg: false }); try { g.leaveParty({ reason: 'scandal' }); } catch (e) { console.error(e); } break;
    default: break;
  }
  return { ok: true, text, auto };
}

// ======================================================================== the summaries and the Game API
function summary(g, c) {
  return {
    id: c.id, kind: c.kind, name: c.name, who: c.who, whoName: c.whoName, party: c.party, partyName: c.partyName, post: c.post, amount: c.amount, sev: c.sev, day: c.day,
    date: dateLabel(g, c.day), src: c.src, stage: c.stage, stageName: STAGE_NAMES[c.stage], heat: Math.round(c.heat), outcome: c.outcome, mine: c.who === 'player',
    log: c.log.map((l) => ({ day: l.day, date: dateLabel(g, l.day), text: l.text })),
  };
}
const METHODS = {
  scandals() { const s = ensure(this); return { open: s.cases.filter((c) => c.stage !== 'closed').length, pending: s.pending ? { ...s.pending, left: Math.max(0, 2 - (today(this) - num(s.pending.day))) } : null, cases: s.cases.map((c) => summary(this, c)) }; },
  scandalCase(id) { const c = caseById(this, id); return c ? summary(this, c) : null; },
  scandalOptions(id) { return options(this, id); },
  scandalRespond(id, choice) { return respond(this, id, choice); },
  scandalNew(kind, who) { const p = pol(this); if (!p) return null; return this.politicalScandal(kind, { who: who || 'player', name: kindOf(kind).label, severity: SEV[kind] || 2 }); },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });
if (typeof window !== 'undefined') window.__scandal = { setScandalRng, KINDS, tick: (g) => tick(g) };

// ======================================================================== the phone app 「スクープ」
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function icon(c, x, y) {
  appTile(c, x, y, COLOR);
  R(c, x + 7, y + 7, 18, 18, '#f4ecd8'); R(c, x + 9, y + 9, 14, 3, '#7a4a1a'); R(c, x + 9, y + 14, 6, 5, '#c8782a'); R(c, x + 17, y + 14, 6, 1, '#7a4a1a'); R(c, x + 17, y + 17, 6, 1, '#7a4a1a'); R(c, x + 9, y + 21, 14, 1, '#7a4a1a');
}
const heatWord = (h) => (h >= 75 ? '炎上' : h >= 50 ? '強い批判' : h >= 25 ? '批判' : '静か');
async function viewCase(g, id) {
  const c = g.scandalCase(id);
  if (!c) return;
  const head = `${c.whoName}${c.post ? `（${c.post}${c.partyName ? `・${c.partyName}` : ''}）` : c.partyName ? `（${c.partyName}）` : ''}\n${c.name}${c.amount ? `　${fmtMoney(c.amount)}` : ''}\n${c.date}　${c.src}\nいまの段階：${c.stageName}${c.outcome ? '（決着）' : ''}　世論の怒り：${c.heat}（${heatWord(c.heat)}）`;
  const body = c.log.slice().reverse().map((l) => `■${l.date}\n${l.text}`).join('\n\n');
  await phoneInfo(g, { title: c.name.length > 12 ? '事件の経過' : c.name, color: COLOR, text: `${head}\n\n${body}` });
}
async function answer(g, id) {
  const opts = g.scandalOptions(id);
  if (!opts.length) { await phoneInfo(g, { title: '対応', color: COLOR, text: 'いま決めることはない。' }); return; }
  const c = g.scandalCase(id);
  const i = await phoneList(g, { title: g.scandals().pending && g.scandals().pending.kind === 'pressure' ? '身の振り方' : '記者会見・対応', color: COLOR, items: opts.map((o) => ({ label: o.name, sub: o.odds != null ? `見込み${o.odds}%` : '確実' })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
  if (i < 0 || !opts[i]) return;
  const o = opts[i];
  const ok = await phoneConfirm(g, { title: o.name, color: COLOR, text: `${o.desc}\n\n${bulletText(o.lines)}${o.odds != null ? `\n\n成功の見込み ${o.odds}%` : ''}`, choices: ['この方針で行く', 'やめる'] });
  if (ok !== 0) return;
  const r = g.scandalRespond(id, o.id);
  g.sfx(r.ok ? 'ok' : 'buzz');
  await phoneInfo(g, { title: o.name, color: COLOR, text: r.ok ? r.text : r.why });
}
async function openApp(g) {
  for (let guard = 0; guard < 40; guard++) {
    const S = g.scandals();
    const mineOpen = S.cases.filter((c) => c.mine && c.stage !== 'closed');
    const rows = [];
    if (S.pending) { const c = S.cases.find((x) => x.id === S.pending.id); if (c) rows.push({ label: S.pending.kind === 'pressure' ? '★ 身の振り方を決める' : '★ 対応を決める', sub: `${c.name}・あと${S.pending.left}日`, run: () => answer(g, c.id) }); }
    for (const c of mineOpen) rows.push({ label: `自分：${c.name}`, sub: `${c.stageName}・怒り${c.heat}`, run: () => viewCase(g, c.id) });
    for (const c of S.cases.filter((x) => !x.mine && x.stage !== 'closed')) rows.push({ label: `${c.whoName}：${c.name}`, sub: `${c.partyName ? `${c.partyName}・` : ''}${c.stageName}・怒り${c.heat}`, run: () => viewCase(g, c.id) });
    const done = S.cases.filter((x) => x.stage === 'closed');
    if (done.length) rows.push({ label: '事件簿（決着した件）', sub: `${done.length}件`, run: async () => {
      const j = await phoneList(g, { title: '事件簿', color: COLOR, items: done.map((c) => ({ label: `${c.whoName}：${c.name}`, sub: `${c.date}・${OUTCOME[c.outcome] || '決着'}` })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
      if (j >= 0 && done[j]) await viewCase(g, done[j].id);
    } });
    if (!rows.length) rows.push({ label: 'いまは、報じられている件はない', sub: '', run: async () => {} });
    const i = await phoneList(g, { title: 'スクープ', color: COLOR, items: rows.map((x) => ({ label: x.label, sub: x.sub })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
    if (i < 0 || !rows[i]) return;
    await rows[i].run();
  }
}
const OUTCOME = { fade: '沈静化', resigned: '辞職', stayed: '続投', dropped: '不起訴', fined: '罰金', acquitted: '無罪', guilty: '有罪', post: '役職を辞任', seat: '議員辞職', party: '離党', gone: '退任' };
registerPhoneApp('scoop', {
  name: 'スクープ', color: COLOR, order: 66.5,
  iconHD: icon,
  cond: (g) => { try { const p = pol(g); return !!g && !!g.state && !!p && (ensure(g).cases.length > 0 || !!(p.me && p.me.office)); } catch (e) { return false; } },
  open: (g) => openApp(g),
});
export { openApp as openScandalApp, tick as scandalTick };
