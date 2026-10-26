// 世論の声の強化 (R9-D): the logic behind the voices screen — voices about the player's own deeds (芸能・お笑い・政治・
// 事件), the season's talk of the town and the real headlines, trending topics (話題・トレンド), the 世論の温度計, the
// player's answers (発信・反論・無視) with the game's existing effects, and campaigns (署名運動・街頭・ネット署名・
// ハッシュタグ). The voices themselves are made by govt.js (VOICES section: addVoiceEvent) so they share one feed.
// Screens: voices_ui.js. API doc: test-output/api_r9d.txt.
//
// Effects used (all existing): politician → p.me.reputation, p.me.media (politics core), the cabinet's approval through
// g.approvalNote('pm' | 'demo', …) (govt.js); entertainer / citizen → g.addFans, g.addFame, state.life.stress; time →
// g.advanceTime (clock.js); money → state.money. Nothing is refused for being "bad": a reply can backfire (炎上), shown
// with its odds before the choice.
// State: g.state.yoron = { v, seen: { key: day } (≤ 120), replies [], daily { day, n }, cool { topic: day }, campaigns [],
//   hist [{ day, heat, me }] (≤ 60), seq } — created on first use; old saves simply lack it.

import { Game } from './game.js';
import { onMorning } from './life.js';
import { addVoiceEvent, registerVoiceKind, voiceFeedOf, AGE_GROUPS, VOICE_AREAS, onGovt } from './govt.js';
import { ERAS } from './profile.js';
import { REAL_NEWS } from './news_data.js';

const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const today = (g) => num(g.state && g.state.day, 1);
let CT = null; // contests.js: the player's unit name, isRealNameLike
import('./contests.js').then((m) => { CT = m; }).catch(() => { CT = null; });
let NC = null; // news_core.js: the game day of a real date
import('./news_core.js').then((m) => { NC = m; }).catch(() => { NC = null; });

// ================================================================ new kinds of voices
const K = (pro, con, neutral, reasons) => ({ pro, con, neutral, reasons });
const KINDS = {
  p_arrest: K(['ファンとして、待っています', 'やり直す機会はあってほしい'], ['{name}のニュース、ショックすぎる', 'ちゃんと罪をつぐなってほしい', 'テレビで見ていたのに、信じられない', 'そんなことをする人だとは思わなかった'], ['まだ容疑の段階。捜査の結果を待ちたい', '本人の口から説明を聞きたい'],
    { pro: ['待っている', 'やり直し'], con: ['ショック', '責任をとって', '信じられない', '裏切られた'], neutral: ['推定無罪', '説明を'] }),
  p_gaffe: K(['言い方はともかく、本音を言ったのは評価する', '切り取りで騒ぎすぎでは'], ['{name}のあの発言は、さすがにない', '言葉の重みをわかってほしい', '謝って済む話なのか'], ['前後の文脈も見たい'],
    { pro: ['本音', '切り取り'], con: ['失言', '言葉の重み', '謝罪では足りない'], neutral: ['文脈を'] }),
  p_scandal: K(['仕事ぶりとは別の話だと思う'], ['{name}、きちんと説明して', 'またお金の問題か', 'がっかりした'], ['事実がわかるまで待ちたい'],
    { pro: ['仕事は別'], con: ['説明責任', 'お金の問題', '失望'], neutral: ['事実の確認'] }),
  p_pm: K(['{name}総理に期待している', '新しい顔で、政治が変わってほしい', '若い世代の声も聞いてほしい'], ['本当に大丈夫なのか不安', '知名度だけで総理になった気がする'], ['まずはお手並み拝見'],
    { pro: ['期待', '変化', '若い世代'], con: ['不安', '知名度だけ'], neutral: ['様子見'] }),
  p_minister: K(['{name}大臣、がんばってほしい', '現場を知る人に期待'], ['経験不足では', '話題づくりの人事に見える'], ['結果で判断したい'],
    { pro: ['応援', '現場感覚'], con: ['経験不足', '話題づくり'], neutral: ['結果しだい'] }),
  p_elect: K(['{name}さんに一票入れた。約束を守って', '当選おめでとう'], ['知名度だけで当選した気がする', '政策がよくわからない'], ['任期中の仕事を見ていきたい'],
    { pro: ['公約に期待', '祝福'], con: ['知名度だけ', '政策が不明'], neutral: ['仕事ぶりを見る'] }),
  p_lose: K(['また挑戦してほしい'], ['やっぱり甘くなかった', '有権者はよく見ている'], ['次はどうするのか気になる'],
    { pro: ['再挑戦を'], con: ['甘くない', '有権者の判断'], neutral: ['次の一手'] }),
  p_party: K(['筋を通したと思う'], ['党を変えるのは、投票した人への裏切りでは', '数合わせに見える'], ['理由をきちんと説明してほしい'],
    { pro: ['筋を通した'], con: ['有権者への裏切り', '数合わせ'], neutral: ['説明を'] }),
  p_champ: K(['{name}、本当におめでとう！', '涙が出た。最高のネタだった', '前から応援してた。報われてよかった'], ['正直、ほかの組のほうがおもしろかった', '審査に納得いかない'], ['これから売れるかが本当の勝負'],
    { pro: ['祝福', '最高のネタ', '努力が報われた'], con: ['ほかの組のほうが', '審査に不満'], neutral: ['これからが勝負'] }),
  p_final: K(['{name}の決勝、見逃せない', 'ここまで来たのがすごい'], ['ちょっとネタが合わなかった'], ['本番に強いかどうか'],
    { pro: ['期待', '快挙'], con: ['ネタが合わない'], neutral: ['本番しだい'] }),
  p_fame: K(['最近{name}をよく見る。好き', '元気をもらえる', '家族みんなで応援してる'], ['ちょっと出すぎでは', 'どこがおもしろいのかわからない'], ['人気者になったなあ'],
    { pro: ['好き', '元気をもらえる', '家族で応援'], con: ['出すぎ', 'わからない'], neutral: ['人気者に'] }),
  p_news: K(['{name}、応援してる'], ['{name}のニュース、また？'], ['へえ、そうなんだ'], { pro: ['応援'], con: ['またか'], neutral: ['関心'] }),
  p_reply_good: K(['{name}の説明で、納得できた', 'ちゃんと向き合っていて好感がもてる', 'よく言ってくれた'], ['それでも納得できない'], ['言い分はわかった'],
    { pro: ['納得', '誠実', 'よく言った'], con: ['納得できない'], neutral: ['理解はした'] }),
  p_reply_bad: K(['言いたいことはわかる'], ['{name}の反論、火に油を注いでいる', '言い訳にしか聞こえない', '逆ギレはよくない'], ['もう少し落ち着いて話してほしい'],
    { pro: ['気持ちはわかる'], con: ['火に油', '言い訳', '逆ギレ'], neutral: ['冷静に'] }),
  p_post: K(['{name}の発信、共感した', 'いいこと言う'], ['意見を押しつけないで', '{name}がそれを言うのか'], ['いろんな考えがあっていい'],
    { pro: ['共感', '正論'], con: ['押しつけ', '言う資格'], neutral: ['多様な意見'] }),
  campaign: K(['署名した。広がってほしい', '「{title}」、応援してる', '声を集めるのは大事'], ['署名で何が変わるのか', '押しつけがましい'], ['まずは話を聞いてみたい'],
    { pro: ['賛同', '応援', '声を集める'], con: ['効果に疑問', '押しつけ'], neutral: ['話を聞きたい'] }),
  life_prices: K(['セールをうまく使っている', '安い店が近くにあって助かる'], ['{concern}食費がかさむ', '何でも値上がりしている気がする'], null, { pro: ['工夫している', '安い店'], con: ['食費', '値上がり'] }),
  life_work: K(['職場の雰囲気はいい', '残業が少し減った'], ['残業ばかりで休めない', '{concern}将来が不安'], null, { pro: ['職場が良い', '残業減'], con: ['長時間労働', '将来不安'] }),
  life_child: K(['近所の人が子どもを見守ってくれる'], ['保育園に入れるか心配', '子育てのお金がかかりすぎる'], null, { pro: ['地域の見守り'], con: ['保育園', '子育ての費用'] }),
  life_care: K(['地域の集まりが楽しみ'], ['親の介護と仕事の両立がきつい', '年金だけで暮らせるか不安'], null, { pro: ['地域のつながり'], con: ['介護と仕事', '年金の不安'] }),
  life_tv: K(['最近のお笑い番組はおもしろい', 'あのドラマの続きが気になる'], ['同じ人ばかり出ている', 'テレビがつまらなくなった'], null, { pro: ['お笑いが好調', 'ドラマが楽しみ'], con: ['同じ顔ぶれ', 'つまらない'] }),
  real_infra: K(['便利になる。早く行ってみたい', '地元が元気になってほしい'], ['お金をかけすぎでは'], ['一度は見に行ってみたい'], { pro: ['便利', '地域の活性化'], con: ['費用'], neutral: ['行ってみたい'] }),
  real_sports: K(['感動した！', '夜中まで見てしまった', '子どもたちの夢になる'], null, ['次の大会も楽しみ'], { pro: ['感動', '夢中', '子どもの夢'], neutral: ['次も楽しみ'] }),
  real_gengo: K(['新しい元号、いい響き', '新しい時代に期待'], null, ['書類の日付を直すのが大変そう', 'まだなじまないけど、そのうち慣れる'], { pro: ['いい響き', '新時代'], neutral: ['事務が大変', 'なじむまで'] }),
  real_tech: K(['これは便利そう。さっそく使いたい', '新しもの好きにはたまらない'], ['使い方がむずかしそう'], ['様子を見てから考える'], { pro: ['便利', '新しいもの'], con: ['むずかしい'], neutral: ['様子見'] }),
};
for (const [k, d] of Object.entries(KINDS)) registerVoiceKind(k, { pro: d.pro || undefined, con: d.con || undefined, neutral: d.neutral || undefined, reasons: d.reasons });

// ================================================================ state
const READY = new WeakSet();
export function ystate(g) {
  const st = g.state;
  let s = st.yoron;
  if (isObj(s) && READY.has(s)) return s;
  if (!isObj(s)) s = st.yoron = {};
  s.v = 1;
  s.seen = isObj(s.seen) ? Object.fromEntries(Object.entries(s.seen).slice(-120)) : {};
  s.replies = Array.isArray(s.replies) ? s.replies.filter(isObj).slice(0, 40) : [];
  s.daily = isObj(s.daily) ? { day: num(s.daily.day), n: num(s.daily.n), deeds: num(s.daily.deeds) } : { day: 0, n: 0, deeds: 0 };
  s.cool = isObj(s.cool) ? s.cool : {};
  s.campaigns = Array.isArray(s.campaigns) ? s.campaigns.filter(isObj).slice(0, 12) : [];
  s.hist = Array.isArray(s.hist) ? s.hist.filter(isObj).slice(-60) : [];
  s.seq = Math.max(1, num(s.seq, 1));
  s.scanDay = num(s.scanDay, 0);
  READY.add(s);
  return s;
}
function daily(g) { const s = ystate(g); if (s.daily.day !== today(g)) s.daily = { day: today(g), n: 0, deeds: 0 }; return s.daily; }

// ================================================================ who the player is (for the answers' effects)
function pol(g) { try { return g.state && g.state.politics && has(g, 'pol') ? g.pol() : null; } catch (e) { return null; } }
export function playerRole(g) {
  const p = pol(g);
  const me = p && p.me;
  const posts = (me && me.posts) || [];
  if (me && (me.office || posts.length)) return { kind: 'politician', pm: posts.includes('pm'), cabinet: posts.some((x) => x === 'pm' || /^minister|kanbo/.test(x)), label: posts.includes('pm') ? '総理大臣' : me.office ? '政治家' : '党の役職' };
  if (num(g.state.fame) >= 60 || num(g.state.fans) >= 300) return { kind: 'celebrity', label: '芸能人' };
  return { kind: 'citizen', label: 'ひとりの市民' };
}
function names(g) {
  const st = g.state, out = [];
  if (st.name) out.push(String(st.name));
  const pr = st.profile;
  if (pr && pr.familyName && pr.givenName) out.push(`${pr.familyName}${pr.givenName}`, `${pr.familyName} ${pr.givenName}`);
  if (CT && CT.playerUnitName) { const u = safe(() => CT.playerUnitName(g), null); if (u && u !== 'あなた') out.push(String(u)); }
  return [...new Set(out)].filter((x) => x.length >= 2);
}
// the era's medium for the player's own words
export function replyMedium(g) {
  const y = yearOf(g);
  const role = playerRole(g);
  if (y >= 2010) return { id: 'sns', label: `${((ERAS[(g.state && g.state.profile && g.state.profile.era) || 'reiwa'] || ERAS.reiwa || {}).sns) || 'SNS'}に投稿`, short: '投稿' }; // [R13-F] S1-011: the era's own word (ブログ in the 平成 game, ドッター in 令和), like the phone app
  if (y >= 2003) return { id: 'blog', label: 'ブログに書く', short: 'ブログ' };
  if (role.kind !== 'citizen') return { id: 'kaiken', label: y >= 1995 ? 'ワイドショーの取材で話す' : '記者の取材で話す', short: '取材' };
  return { id: 'letter', label: '新聞に投書する', short: '投書' };
}
function yearOf(g) { if (NC) { const n = safe(() => NC.newsDateNum(g), 0); if (n) return Math.floor(n / 10000); } return safe(() => g.gameDate().year, 2026) || 2026; }

// ================================================================ the player's deeds → voices
const DEEDS = [
  { re: /(逮捕|書類送検|起訴|容疑|の疑いで)/, kind: 'p_arrest', st: ['con', 'con', 'neutral', 'pro', 'con'], heat: 9 },
  { re: /(失言|暴言|発言.{0,8}(批判|撤回|波紋)|炎上)/, kind: 'p_gaffe', st: ['con', 'con', 'pro', 'neutral'], heat: 8 },
  { re: /(疑惑|不祥事|不倫|脱税|裏金|献金|政治資金)/, kind: 'p_scandal', st: ['con', 'neutral', 'con', 'pro'], heat: 7 },
  { re: /内閣総理大臣に/, kind: 'p_pm', st: ['pro', 'con', 'pro', 'neutral', 'con'], heat: 8 },
  { re: /(大臣に(就任|任命|起用)|入閣|官房長官に)/, kind: 'p_minister', st: ['pro', 'con', 'neutral', 'pro'], heat: 5 },
  { re: /落選/, kind: 'p_lose', st: ['con', 'pro', 'neutral'], heat: 4 },
  { re: /当選/, kind: 'p_elect', st: ['pro', 'con', 'pro', 'neutral'], heat: 5 },
  { re: /(新党|離党|除名|入党)/, kind: 'p_party', st: ['con', 'pro', 'neutral'], heat: 4 },
  { re: /(優勝|王者|チャンピオン|大賞|頂点)/, kind: 'p_champ', st: ['pro', 'pro', 'con', 'pro', 'neutral'], heat: 8 },
  { re: /(決勝|ファイナリスト|準優勝|準決勝)/, kind: 'p_final', st: ['pro', 'con', 'pro', 'neutral'], heat: 5 },
  { re: /(ファン.{0,10}(突破|人に)|好感度|1位|冠番組|新番組|レギュラー|ブレイク|出演決定)/, kind: 'p_fame', st: ['pro', 'pro', 'con', 'neutral'], heat: 5 },
];
const SEGS_OF = { p_champ: { young: 1, floating: 0.6, urban: 0.5 }, p_final: { young: 1, urban: 0.5 }, p_fame: { young: 1, families: 0.6, floating: 0.4 }, p_arrest: { families: -1, elderly: -0.8, young: 0.3 } };
function deedOf(t) { return DEEDS.find((d) => d.re.test(t)) || null; }
const hashKey = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return 'd' + h.toString(36); };
// Look at the news since the last scan; each story about the player gets a few voices (≤ 3 stories a day).
export function scanDeeds(g) {
  if (!g || !g.state) return 0;
  const s = ystate(g);
  const ns = names(g);
  if (!ns.length) return 0;
  const d = daily(g);
  const cands = [];
  for (const m of (g.state.phone && g.state.phone.inbox) || []) { if (m && m.kind === 'news' && today(g) - num(m.day) <= 2 && m.text) cands.push({ day: num(m.day), text: String(m.text) }); }
  const p = g.state.politics;
  if (p && Array.isArray(p.news)) for (const n of p.news.slice(0, 30)) if (n && n.text && today(g) - num(n.day) <= 2) cands.push({ day: num(n.day), text: String(n.text) });
  const cs = has(g, 'contestState') ? safe(() => g.contestState(), null) : null;
  if (cs && Array.isArray(cs.news)) for (const n of cs.news.slice(0, 30)) if (n && n.text && n.kind !== 'personal' && today(g) - num(n.day) <= 2) cands.push({ day: num(n.day), text: String(n.text) });
  let made = 0;
  for (const c of cands) {
    if (d.deeds >= 3) break;
    if (!ns.some((n) => c.text.includes(n))) continue;
    const key = hashKey(c.text.slice(0, 80));
    if (s.seen[key]) continue;
    s.seen[key] = today(g);
    const dd = deedOf(c.text) || { kind: 'p_news', st: ['pro', 'con', 'neutral'], heat: 3 };
    const head = String(c.text).split('\n')[0].replace(/^【[^】]*】/, '').slice(0, 40);
    addVoiceEvent(g, dd.kind, head, { segs: SEGS_OF[dd.kind] || null, stances: dd.st, n: dd.st.length, target: 'player', topic: head, heat: dd.heat });
    d.deeds++;
    made++;
  }
  const keys = Object.keys(s.seen);
  if (keys.length > 120) for (const k of keys.slice(0, keys.length - 120)) delete s.seen[k];
  return made;
}

// ================================================================ the talk of the town (every morning) and real headlines
const LIFE = [['life_prices', '物価と家計', { families: -0.6, floating: -0.4, elderly: 0.2 }], ['life_work', '働きかた', { employees: -0.6, unions: -0.6, young: 0.3 }], ['life_child', '子育て', { families: -0.8, young: 0.2 }], ['life_care', '介護と老後', { elderly: -0.6, employees: 0.2 }], ['life_tv', 'テレビとお笑い', { young: 0.6, floating: 0.3, elderly: -0.4 }]];
function realKind(r) {
  const o = r[4] || {};
  if (o.img === 'gengo') return 'real_gengo';
  if (/quake|tsunami/.test(o.img || '')) return 'disaster';
  if (r[1] === 'sports') return 'real_sports';
  if (/pc|keitai|tv/.test(o.img || '')) return 'real_tech';
  if (r[1] === 'eco') return 'economy';
  return 'real_infra';
}
export function morningVoices(g) {
  if (!g || !g.state || !has(g, 'voices')) return;
  const s = ystate(g);
  if (s.scanDay === today(g)) return;
  s.scanDay = today(g);
  // the real headlines that came out today (news_core: the game day of a real date)
  if (NC) {
    const nowN = safe(() => NC.newsDateNum(g), 0);
    for (const r of REAL_NEWS) {
      if (r[0] > nowN) continue;
      const d = safe(() => NC.newsDayOf(g, r[0]), -1);
      if (d !== today(g)) continue;
      const k = realKind(r);
      addVoiceEvent(g, k, String(r[2]).split(/[、。]/)[0].slice(0, 30), { n: k === 'real_sports' ? 3 : 4, stances: k === 'real_sports' ? ['pro', 'pro', 'neutral'] : k === 'real_gengo' ? ['pro', 'neutral', 'pro', 'neutral'] : k === 'disaster' ? ['pro', 'con', 'pro', 'con'] : null, heat: 6 });
    }
  }
  // one topic of daily life (two now and then)
  const n = Math.random() < 0.35 ? 2 : 1;
  for (let i = 0; i < n; i++) { const [k, label, segs] = pick(LIFE); addVoiceEvent(g, k, label, { segs, n: 2, heat: 2 }); }
}

// ================================================================ trends and the thermometer
const TREND_WORD = (y) => (y >= 2010 ? 'トレンド' : y >= 2000 ? '掲示板の勢い' : y >= 1995 ? 'ワイドショーの話題' : '投書の多い話題');
export function voiceTrends(g, n = 8, opts = {}) {
  if (!g || !g.state) return [];
  const s = ystate(g);
  const feed = voiceFeedOf(g);
  const t = today(g);
  const M = new Map();
  for (const v of feed) {
    const age = t - num(v.day, t);
    if (age > (opts.days || 20)) continue;
    const k = v.topic || v.event || '世の中';
    let r = M.get(k);
    if (!r) { r = { topic: k, kind: v.kind, n: 0, pro: 0, con: 0, neutral: 0, heat: 0, last: 0, mine: false, eng: 0 }; M.set(k, r); }
    r.n++;
    r[v.stance] = (r[v.stance] || 0) + 1;
    const eng = num(v.likes) / 400 + num(v.res) / 40 + num(v.comments) / 10;
    r.eng += eng;
    r.heat += (1 + eng) / (1 + age / 4) * (v.target === 'player' ? 1.4 : 1);
    r.last = Math.max(r.last, num(v.day));
    if (v.target === 'player') r.mine = true;
  }
  const y = yearOf(g);
  const list = [...M.values()].map((r) => {
    const cool = s.cool[r.topic] && t - s.cool[r.topic] <= 6 ? 0.6 : 1;
    const heat = Math.round(r.heat * 10 * cool);
    const tot = Math.max(1, r.pro + r.con + r.neutral);
    return { ...r, heat, proPct: Math.round((r.pro / tot) * 100), conPct: Math.round((r.con / tot) * 100), tag: y >= 2010 ? `#${String(r.topic).replace(/[\s「」、。・（）()]/g, '').slice(0, 14)}` : '' };
  }).sort((a, b) => b.heat - a.heat).slice(0, n);
  list.forEach((r, i) => { r.rank = i + 1; });
  list.word = TREND_WORD(y);
  return list;
}
const LEVELS = [[80, '沸騰', '#ff3b30'], [62, '過熱', '#ff7a1a'], [44, 'ざわつき', '#f0c030'], [25, 'おだやか', '#4fc08a'], [0, '平穏', '#4aa0e0']];
const ME_LEVELS = [[75, '好感', '#ff6aa0'], [55, '好意的', '#f0a040'], [42, '賛否両論', '#c0a060'], [25, '逆風', '#6a8ac8'], [0, '炎上', '#ff3b30']];
export function voiceThermo(g) {
  if (!g || !g.state) return null;
  const s = ystate(g);
  const feed = voiceFeedOf(g);
  const t = today(g);
  const recent = feed.filter((v) => t - num(v.day, t) <= 20 && v.target !== 'player').slice(0, 60);
  const tot = Math.max(1, recent.length);
  const con = recent.filter((v) => v.stance === 'con').length / tot, pro = recent.filter((v) => v.stance === 'pro').length / tot;
  const ab = has(g, 'approvalBreakdown') ? safe(() => g.approvalBreakdown(), null) : null;
  const approval = ab ? num(ab.approval, 40) : 40;
  const demos = has(g, 'demos') ? safe(() => g.demos({ active: true }), []) || [] : [];
  const scandal = recent.filter((v) => /scandal|p_arrest|p_gaffe|dictatorship|press|war/.test(v.kind)).length;
  const heat = Math.round(clamp(18 + con * 52 - pro * 18 + (42 - approval) * 0.55 + Math.min(4, demos.length) * 6 + Math.min(6, scandal) * 2.5, 0, 100));
  const lv = LEVELS.find((l) => heat >= l[0]);
  // by age group, region and job
  const by = (key, order) => {
    const m = {};
    for (const v of feed.filter((x) => t - num(x.day, t) <= 40)) { const k = v[key]; if (!k) continue; const r = m[k] || (m[k] = { key: k, pro: 0, con: 0, neutral: 0, n: 0 }); r.n++; r[v.stance] = (r[v.stance] || 0) + 1; }
    const rows = Object.values(m);
    if (order) rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)); else rows.sort((a, b) => b.n - a.n);
    return rows.map((r) => ({ ...r, mood: r.n ? Math.round(((r.pro - r.con) / r.n) * 100) : 0 }));
  };
  // the player
  const mine = feed.filter((v) => v.target === 'player' && t - num(v.day, t) <= 60);
  const mp = mine.filter((v) => v.stance === 'pro').length, mc = mine.filter((v) => v.stance === 'con').length;
  const favor = mine.length ? Math.round(((mp + 0.5 * (mine.length - mp - mc)) / mine.length) * 100) : null;
  const ml = favor == null ? null : ME_LEVELS.find((l) => favor >= l[0]);
  return {
    heat, level: lv[1], color: lv[2], approval, con: Math.round(con * 100), pro: Math.round(pro * 100), demos: demos.length,
    ages: by('ageGroup', AGE_GROUPS), regions: by('region', VOICE_AREAS.map((a) => a[0])), jobs: by('job').slice(0, 8),
    me: { n: mine.length, pro: mp, con: mc, favor, level: ml ? ml[1] : 'まだ話題になっていない', color: ml ? ml[2] : '#8a8a8a' },
    hist: s.hist.slice(-30),
  };
}
function snapshot(g) {
  const s = ystate(g);
  const th = voiceThermo(g);
  if (!th) return;
  if (s.hist.length && s.hist[s.hist.length - 1].day === today(g)) s.hist.pop();
  s.hist.push({ day: today(g), heat: th.heat, me: th.me.favor });
  if (s.hist.length > 60) s.hist.splice(0, s.hist.length - 60);
}

// ================================================================ the player's answers: 発信・反論・無視
const DAY_REPLIES = 3;
function talk(g) { return clamp(num(g.state.skills && g.state.skills.talk), 0, 100); }
// the odds of a good reception, shown before the choice
export function replyOdds(g, v, how) {
  const role = playerRole(g);
  const heat = num(v && (v.likes || v.res * 10 || v.comments * 20), 30);
  const fame = Math.log10(1 + num(g.state.fame)) / 4;
  let p = how === 'rebut' ? 0.42 + talk(g) / 220 + fame * 0.12 - Math.min(0.15, heat / 4000) : 0.62 + talk(g) / 300 + fame * 0.06;
  if (v && v.stance === 'con' && how === 'agree') p += 0.08; // 認める
  if (role.kind === 'politician' && role.pm) p -= 0.05; // more eyes on a PM
  const p2 = pol(g);
  if (role.kind === 'politician' && p2 && num(p2.me.media) <= -30) p -= 0.08;
  return Math.round(clamp(p, 0.12, 0.92) * 100);
}
function effectsText(g, ok, how) {
  const role = playerRole(g);
  if (role.kind === 'politician') return ok ? `評判 +${how === 'rebut' ? 2 : 1}・メディアの目 +2${role.cabinet ? '・内閣支持 少し上向く' : ''}` : `評判 −3・メディアの目 −4${role.cabinet ? '・内閣支持 少し下がる' : ''}（炎上）`;
  if (role.kind === 'celebrity') return ok ? 'ファン 少し増える・知名度 +2・ストレス −3' : 'ファン 少し減る・知名度 +3（悪目立ち）・ストレス +6（炎上）';
  return ok ? 'ストレス −3（声が届いた）' : 'ストレス +5（言い返されて落ちこむ）';
}
// what the player can do with a voice → [{ id, label, desc, odds, good, bad, why }]
export function replyOptions(g, vid) {
  const v = voiceFeedOf(g).find((x) => x.id === vid);
  if (!v) return [];
  const s = ystate(g);
  const d = daily(g);
  const md = replyMedium(g);
  const done = s.replies.some((r) => r.topic === (v.topic || v.event) && r.day === today(g));
  const why = d.n >= DAY_REPLIES ? `きょうはもう${DAY_REPLIES}回、声に答えた（あすまた）` : done ? 'この話題には、きょうもう答えた' : num(g.state.stamina, 50) < 3 ? 'つかれていて、言葉が出てこない' : null;
  const out = [];
  if (v.stance === 'con') out.push({ id: 'rebut', label: `反論する（${md.short}）`, desc: '批判に、自分の考えで言い返す', odds: replyOdds(g, v, 'rebut'), why });
  out.push({ id: v.stance === 'con' ? 'agree' : 'post', label: v.stance === 'con' ? `受けとめて説明する（${md.short}）` : `発信する（${md.short}）`, desc: v.stance === 'con' ? '批判を認め、ていねいに説明する' : 'この話題について、自分の考えを発信する', odds: replyOdds(g, v, v.stance === 'con' ? 'agree' : 'post'), why });
  out.push({ id: 'ignore', label: '無視する（静観）', desc: 'なにも言わない。話題が冷めるのを待つ', odds: null, why: null });
  for (const o of out) if (o.odds != null) { o.good = effectsText(g, true, o.id); o.bad = effectsText(g, false, o.id); }
  return out;
}
function applyEffects(g, ok, how) {
  const role = playerRole(g);
  const st = g.state;
  const life = st.life;
  const fx = [];
  if (role.kind === 'politician') {
    const p = pol(g);
    if (p && p.me) {
      const dr = ok ? (how === 'rebut' ? 2 : 1) : -3, dm = ok ? 2 : -4;
      p.me.reputation = clamp(num(p.me.reputation) + dr, -100, 100);
      p.me.media = clamp(num(p.me.media) + dm, -100, 100);
      fx.push(`評判 ${dr > 0 ? '+' : '−'}${Math.abs(dr)}`, `メディアの目 ${dm > 0 ? '+' : '−'}${Math.abs(dm)}`);
      if (role.cabinet && has(g, 'approvalNote')) { safe(() => g.approvalNote('pm', ok ? 0.5 : -1.2, ok ? '総理・閣僚の発信が好感された' : '総理・閣僚の発信が炎上した')); fx.push(ok ? '内閣支持 +0.5' : '内閣支持 −1.2'); }
    }
  } else if (role.kind === 'celebrity') {
    const n = Math.max(5, Math.round(num(st.fans) * (ok ? 0.004 : 0.008)));
    if (has(g, 'addFans')) g.addFans(ok ? n : -n, true);
    if (has(g, 'addFame')) g.addFame(ok ? 2 : 3, true);
    fx.push(`ファン ${ok ? '+' : '−'}${n.toLocaleString('ja-JP')}人`, `知名度 +${ok ? 2 : 3}`);
  }
  if (life && Number.isFinite(Number(life.stress))) { const ds = ok ? -3 : role.kind === 'citizen' ? 5 : 6; if (has(g, 'addNeed')) g.addNeed('stress', ds); else life.stress = clamp(num(life.stress) + ds, 0, 100); fx.push(`ストレス ${ds > 0 ? '+' : '−'}${Math.abs(ds)}`); }
  return fx;
}
// how: 'rebut' | 'agree' | 'post' | 'ignore'. opts.text: the player's own words (optional, shown in the log).
export function voiceRespond(g, vid, how, opts = {}) {
  const feed = voiceFeedOf(g);
  const v = feed.find((x) => x.id === vid);
  if (!v) return { ok: false, why: 'その声は見つからない' };
  const s = ystate(g);
  const topic = v.topic || v.event || '世の中';
  if (how === 'ignore') {
    v.ignored = true;
    s.cool[topic] = today(g);
    s.replies.unshift({ day: today(g), vid, topic, how, ok: true, text: '何も言わずに静観した' });
    if (s.replies.length > 40) s.replies.length = 40;
    return { ok: true, success: true, text: `「${topic}」の声には答えず、静観することにした。\n話題が冷めるのを待つ。`, effects: [] };
  }
  const opt = replyOptions(g, vid).find((o) => o.id === how);
  if (!opt) return { ok: false, why: 'その答えかたはできない' };
  if (opt.why) return { ok: false, why: opt.why };
  const d = daily(g);
  d.n++;
  const success = Math.random() * 100 < opt.odds;
  const fx = applyEffects(g, success, how);
  if (has(g, 'advanceTime')) safe(() => g.advanceTime(20, '世論への発信'));
  if (has(g, 'useStamina')) safe(() => g.useStamina(2)); else if (Number.isFinite(Number(g.state.stamina))) g.state.stamina = Math.max(0, num(g.state.stamina) - 2);
  const md = replyMedium(g);
  addVoiceEvent(g, success ? 'p_reply_good' : 'p_reply_bad', topic, { target: 'player', topic, n: 3, stances: success ? ['pro', 'neutral', 'pro'] : ['con', 'con', 'pro'], heat: success ? 4 : 8 });
  v.answered = how;
  const words = opts.text ? `「${String(opts.text).slice(0, 60)}」` : '';
  const text = `${md.label}${words ? '：' + words : '。'}\n${success ? '受けとめられた。好意的な声が広がっている。' : '反発を招いた。批判の声がさらに増えている（炎上）。'}`;
  s.replies.unshift({ day: today(g), vid, topic, how, ok: success, text: `${md.short}：${opt.label}${words}`, fx });
  if (s.replies.length > 40) s.replies.length = 40;
  snapshot(g);
  return { ok: true, success, text, effects: fx, odds: opt.odds };
}
// the player speaks up on a topic without a voice to answer (発信)
export function voicePost(g, topic, stance = 'pro', opts = {}) {
  const v0 = voiceFeedOf(g).find((v) => (v.topic || v.event) === topic) || null;
  if (v0) return voiceRespond(g, v0.id, 'post', opts);
  return { ok: false, why: 'その話題の声がない' };
}

// ================================================================ campaigns (署名運動・街頭・ネット署名・ハッシュタグ)
export const CAMPAIGN_KINDS = {
  shomei: { label: '署名運動', unit: '筆', from: 0, goal: 50000, cost: 30000, stamina: 6, desc: '駅前や街頭で署名を集め、国や自治体に届ける' },
  gaito: { label: '街頭キャンペーン（ビラ・演説）', unit: '人', from: 0, goal: 20000, cost: 15000, stamina: 12, desc: 'ビラを配り、マイクで訴える。届いた人の数が力になる' },
  net: { label: 'ネット署名', unit: '筆', from: 2000, goal: 100000, cost: 0, stamina: 2, desc: 'インターネットで賛同を集める' },
  hashtag: { label: 'ハッシュタグ運動', unit: '件', from: 2010, goal: 300000, cost: 0, stamina: 2, desc: 'SNSで合言葉を広め、投稿の数で訴える' },
};
export const CAMPAIGN_CAUSES = [
  { id: 'tax', label: '増税に反対する', protest: true }, { id: 'child', label: '子育て支援の充実を求める', protest: true }, { id: 'care', label: '介護の人手不足の解消を求める', protest: true },
  { id: 'disaster', label: '被災地への支援を求める', protest: false }, { id: 'peace', label: '平和を守ろう', protest: true }, { id: 'speech', label: '表現の自由を守ろう', protest: true },
  { id: 'support', label: 'いまの政府を応援する', protest: false }, { id: 'animal', label: '動物の命を守ろう', protest: false },
];
function campaignPower(g, kind) {
  const st = g.state;
  const role = playerRole(g);
  return 0.55 + Math.log10(1 + num(st.fans)) / 7 + Math.min(0.6, num(st.fame) / 5000) + talk(g) / 400 + (role.kind === 'politician' ? 0.25 : 0) + (kind === 'hashtag' || kind === 'net' ? Math.log10(1 + num(st.fans)) / 10 : 0);
}
export function campaignOptions(g) {
  const y = yearOf(g);
  const s = ystate(g);
  const active = s.campaigns.find((c) => c.status === 'active');
  const money = num(g.state.money);
  return Object.entries(CAMPAIGN_KINDS).map(([id, k]) => {
    const pw = campaignPower(g, id);
    const exp = Math.round(k.goal * 0.12 * pw * 8);
    const odds = Math.round(clamp(1 / (1 + Math.exp(-((exp / k.goal) - 1) * 4)), 0.03, 0.97) * 100);
    const why = y < k.from ? `${k.from}年代からの方法（まだない）` : active ? `「${active.cause}」の${active.label}を続けている` : money < k.cost ? 'お金が足りない' : num(g.state.stamina, 50) < k.stamina ? '体力が足りない' : null;
    return { id, ...k, expected: exp, odds, why };
  });
}
export function campaignStart(g, def = {}) {
  const s = ystate(g);
  const k = CAMPAIGN_KINDS[def.kind];
  const cause = CAMPAIGN_CAUSES.find((c) => c.id === def.cause) || CAMPAIGN_CAUSES[0];
  if (!k) return { ok: false, why: 'その方法はない' };
  const o = campaignOptions(g).find((x) => x.id === def.kind);
  if (o.why) return { ok: false, why: o.why };
  g.state.money = num(g.state.money) - k.cost;
  g.state.stamina = Math.max(0, num(g.state.stamina) - k.stamina);
  if (has(g, 'advanceTime')) safe(() => g.advanceTime(90, '世論への発信（運動）'));
  const c = { id: 'c' + s.seq++, kind: def.kind, label: k.label, unit: k.unit, cause: cause.label, causeId: cause.id, protest: cause.protest, start: today(g), end: today(g) + 8, goal: k.goal, count: 0, status: 'active', log: [] };
  s.campaigns.unshift(c);
  if (s.campaigns.length > 12) s.campaigns.length = 12;
  addVoiceEvent(g, 'campaign', cause.label, { data: { title: cause.label }, n: 4, stances: ['pro', 'con', 'pro', 'neutral'], topic: cause.label, heat: 5 });
  if (playerRole(g).kind === 'celebrity') addVoiceEvent(g, 'demo_celeb', cause.label, { n: 2, topic: cause.label, target: 'player', heat: 6 });
  return { ok: true, campaign: { ...c }, text: `「${cause.label}」の${k.label}を始めた。\n8日間で${k.goal.toLocaleString('ja-JP')}${k.unit}をめざす（届く見込み ${o.odds}%）。` };
}
function campaignTick(g) {
  const s = ystate(g);
  for (const c of s.campaigns) {
    if (c.status !== 'active') continue;
    const k = CAMPAIGN_KINDS[c.kind] || CAMPAIGN_KINDS.shomei;
    const add = Math.round(k.goal * (0.06 + Math.random() * 0.12) * campaignPower(g, c.kind));
    c.count += add;
    c.log.push({ day: today(g), add });
    if (c.log.length > 12) c.log.shift();
    if (today(g) < c.end) continue;
    c.status = c.count >= c.goal ? 'done' : 'short';
    const ok = c.status === 'done';
    const role = playerRole(g);
    const fx = [];
    if (ok) {
      if (role.kind === 'politician') { const p = pol(g); if (p && p.me) { p.me.reputation = clamp(num(p.me.reputation) + 4, -100, 100); fx.push('評判 +4'); } }
      else { if (has(g, 'addFans')) g.addFans(Math.max(20, Math.round(num(g.state.fans) * 0.01)), true); if (has(g, 'addFame')) g.addFame(5, true); fx.push('ファン・知名度 アップ'); }
      if (has(g, 'approvalNote') && !(role.kind === 'politician' && role.cabinet)) safe(() => g.approvalNote('demo', c.protest ? -0.8 : 0.5, `「${c.cause}」の${c.label}が目標に届いた`));
    }
    c.fx = fx;
    addVoiceEvent(g, 'campaign', c.cause, { data: { title: c.cause }, n: 3, stances: ok ? ['pro', 'pro', 'con'] : ['con', 'neutral', 'pro'], topic: c.cause, heat: ok ? 6 : 3 });
    safe(() => g.message({ from: 'ドット新聞', kind: 'news', text: ok ? `【${c.label}】「${c.cause}」の${c.label}に${c.count.toLocaleString('ja-JP')}${c.unit}が集まった。呼びかけた${g.state.name}さんは「みなさんの声を届けます」。` : `【${c.label}】「${c.cause}」の${c.label}は${c.count.toLocaleString('ja-JP')}${c.unit}で終わった。目標の${c.goal.toLocaleString('ja-JP')}${c.unit}には届かなかった。` }));
  }
}

// every new voice: a name that looks like a real person's (contests.js isRealNameLike) is replaced by a plain one
onGovt('voices', (g, d) => {
  if (!CT || typeof CT.isRealNameLike !== 'function' || !d || !Array.isArray(d.voices)) return;
  for (const v of d.voices) {
    if (!v.name || !safe(() => CT.isRealNameLike(v.name), false)) continue;
    v.name = `${String(v.name).slice(0, 2)}${v.female ? '和子' : '正男'}`;
    if (v.medium === 'letter') v.header = `【投書】${v.job}　${v.name}（${v.age}）　${v.pref}`;
  }
});

// ================================================================ morning and g.*
onMorning((g) => {
  if (!g || !g.state) return;
  try { scanDeeds(g); morningVoices(g); campaignTick(g); snapshot(g); } catch (e) { console.error(e); }
});
const methods = {
  voicesTrends(n = 8, opts = {}) { return voiceTrends(this, n, opts || {}); },
  voicesThermo() { return voiceThermo(this); },
  voicesScan() { const n = scanDeeds(this); return n; },
  voicesReplyOptions(vid) { return replyOptions(this, vid); },
  voicesRespond(vid, how, opts = {}) { return voiceRespond(this, vid, how, opts || {}); },
  voicesReplies(n = 20) { return ystate(this).replies.slice(0, n).map((r) => ({ ...r })); },
  voicesCampaignOptions() { return campaignOptions(this); },
  voicesCampaignStart(def = {}) { return campaignStart(this, def || {}); },
  voicesCampaigns() { return ystate(this).campaigns.map((c) => ({ ...c, log: c.log.slice() })); },
  voicesRole() { return playerRole(this); },
  voicesMedium() { return replyMedium(this); },
};
for (const k of Object.keys(methods)) Object.defineProperty(Game.prototype, k, { value: methods[k], configurable: true, writable: true });
