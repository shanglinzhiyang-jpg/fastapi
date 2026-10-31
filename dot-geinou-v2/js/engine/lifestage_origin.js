// 生い立ち (R30) — the player's own 赤ちゃん・幼児 / 小学生 / 中学生 careers, played turn by turn in the 生活 screen (年表 tab):
// what kind of baby you were, what you loved at 保育園, one focus for every school year (勉強・外遊び・工作・友だち・お手伝い・習いごと),
// the school events of the year you were that age (the play of that era, no brand names), a club, and the 高校受験. The result is your
// background: the six life stats, a few points of the game skills (at most +8 in all), the high school (when you are 15-17 now) and
// the first pages of the 年表. It can be played once per save.
//
// runOrigin(g, io): io = { page(title, lines[], o) → Promise, pick(title, items [{ label, sub }], o) → Promise<index> } — the 生活
// screen gives its own modals; a fallback with g.say / g.ask is used without it (tests).
import { Game } from './game.js';
import { ageOf, profileOf, prefecture } from './profile.js';
import { clamp } from './util.js';
import * as D from './lifestage_data.js';
import { ensure, addHist, yearNow, lsRand } from './lifestage.js';

const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const SK = { warai: 'お笑い', engi: '演技', uta: '歌', talk: 'トーク' };
const pickR = (a) => a[Math.floor(lsRand() * a.length)];
const statLine = (gs) => Object.entries(gs).filter(([, v]) => v).map(([k, v]) => `${D.STATS[k] ? D.STATS[k].name : SK[k]}${v > 0 ? '+' : ''}${v}`).join('　');

const BABY = [
  { label: 'よく泣く、元気な赤ちゃん', g: { tai: 4, ken: 2 }, line: '夜中じゅう泣いて、家族を寝かせなかったらしい。「声が大きいのは、このころから」と言われる。' },
  { label: 'よく笑う赤ちゃん', g: { yu: 4, kan: 1 }, line: 'だれにでもにこにこ。近所の人に、よく抱っこされていたそうだ。', skill: ['talk', 1] },
  { label: 'じっと見つめる赤ちゃん', g: { kan: 3, gaku: 2 }, line: '天井の模様を、いつまでも見ていたらしい。「この子は何を考えているんだろう」と家族は不思議がった。' },
  { label: 'よく眠る、おだやかな赤ちゃん', g: { ken: 4, sei: 1 }, line: 'ミルクを飲んだら、すぐにすやすや。「手のかからない子だった」と、いまでも言われる。' },
];
const TODDLER = [
  { label: '外で走りまわる', g: { tai: 4 }, line: '砂場とすべり台が大好き。服は、いつも泥だらけだった。' },
  { label: 'お絵かき・ねんど', g: { kan: 4 }, line: 'クレヨンで、家の壁にまで大作をかいてしまった。' },
  { label: '絵本を読んでもらう', g: { gaku: 3, kan: 1 }, line: 'お気に入りの絵本は、ぼろぼろになるまで読んでもらった。' },
  { label: 'ごっこ遊び・おしゃべり', g: { yu: 3 }, line: 'お店やさんごっこでは、いつも店長役。口がよくまわる子だった。', skill: ['talk', 1] },
  { label: 'お歌とおゆうぎ', g: { kan: 3, tai: 1 }, line: '発表会では、いちばん大きな声で歌っていた。', skill: ['uta', 1] },
];
const FOCUS = [
  { id: 'study', label: '勉強をがんばる', g: { gaku: 5 } },
  { id: 'sport', label: '外遊び・スポーツ', g: { tai: 5, ken: 1 } },
  { id: 'art', label: '工作・お絵かき・音楽', g: { kan: 5 } },
  { id: 'friend', label: '友だちと遊ぶ', g: { yu: 5 } },
  { id: 'home', label: '家のお手伝い', g: { sei: 4, yu: 1 } },
  { id: 'lesson', label: '習いごとに打ちこむ', g: {} },
];
// school events by grade (小学校): [title, text(S, ctx), gains, skill?]
const ELEM_FIXED = {
  1: () => ['入学式', 'ぶかぶかのランドセルで、校門の前で写真をとった。', { yu: 1 }],
  2: () => ['九九', '「しちし にじゅうはち」…お風呂で何度も唱えて、ついに全部言えた！', { gaku: 2 }],
  3: () => ['社会科見学', '工場の見学で、できたてのお菓子をもらった。「大人になったら、ここで働く！」', { gaku: 1, sei: 1 }],
  4: (S, c) => (c.year >= 2000 ? ['二分の一成人式', '10歳の記念に、家族への手紙を読んだ。声がふるえた。', { yu: 2, kan: 1 }] : ['クラブ活動', '4年生からクラブ活動。好きなことを、みんなでやる時間ができた。', { yu: 1, kan: 1 }]),
  5: () => ['林間学校', '山の中で、飯ごう炊さんとキャンプファイヤー。カレーは少しこげた。', { sei: 2, yu: 1 }],
  6: (S, c) => ['修学旅行', `${c.year >= 1995 ? pickR(['京都・奈良', '日光', '広島']) : pickR(['日光', '京都・奈良', '伊勢'])}へ。夜、布団の中でずっとおしゃべりしていた。`, { yu: 2 }],
};
const ELEM_RANDOM = [
  (S) => (S.tai >= 35 ? ['運動会のリレー', 'アンカーで、ごぼう抜き！ 帰り道、知らない子にまで「すごかった」と言われた。', { tai: 2, yu: 2 }] : ['運動会', '玉入れで、いちばんたくさん入れた。クラスが優勝！', { yu: 2 }]),
  (S) => (S.kan >= 35 ? ['学芸会で主役', '学芸会の劇で、主役に選ばれた。セリフを一度も忘れなかった。', { kan: 2 }, 'engi'] : ['学芸会', '学芸会では「木の役」。…でも、いちばん堂々とした木だった。', { kan: 1 }]),
  (S) => (S.gaku >= 35 ? ['自由研究で入賞', '夏休みの自由研究「町のセミの数」が、市の展覧会で入賞した！', { gaku: 3 }] : ['自由研究', '自由研究は、夏休み最後の日に家族総出でしあげた…。', { sei: 1 }]),
  () => ['転校生', 'となりの席に、転校生がやってきた。最初に話しかけたのは自分だった。', { yu: 3 }],
  () => ['生き物係', 'クラスで飼っていたメダカの世話を、1年間やりとげた。', { sei: 2 }],
  () => ['けんかと仲直り', '親友と大げんか。次の日、どっちからともなく「ごめん」。', { yu: 2 }],
  (S, c) => ['家で人気の遊び', `このころは「${pickR(c.play)}」に夢中だった。宿題は、あとまわし…。`, { yu: 1, gaku: -1 }],
  () => ['お楽しみ会の司会', 'クラスのお楽しみ会で、司会を任された。みんなを笑わせて大成功。', { yu: 1 }, 'warai'],
  () => ['図書室の常連', '図書室の本を、1年で100冊読んだ。先生に表彰された。', { gaku: 2, kan: 1 }],
  () => ['皆勤賞', '1年間、1日も休まずに学校に通った。', { ken: 2 }],
];
const MID_RANDOM = [
  (S) => (S.gaku >= 45 ? ['定期テストで学年上位', '中間テストで、学年10位以内に入った！ 名前が廊下に貼りだされた。', { gaku: 3 }] : ['定期テスト', '一夜づけで、なんとか乗りきった…。', { gaku: 1 }]),
  () => ['合唱コンクール', 'クラスで合唱コンクールに出た。最初はバラバラだった声が、本番ではひとつになった。', { kan: 2, yu: 1 }, 'uta'],
  (S, c) => (c.year >= 1998 ? ['職場体験', '3日間、近くのお店で職場体験。「いらっしゃいませ」の声が、だんだん出るようになった。', { sei: 2, yu: 1 }] : ['部活の合宿', '夏休みの部活の合宿。厳しかったけど、仲間との絆は深まった。', { tai: 2, yu: 1 }]),
  () => ['体育祭', 'クラス対抗の大縄跳び。全員の声が、校庭にひびいた。', { tai: 1, yu: 2 }],
  () => ['生徒会', '生徒会の選挙に出た。体育館の壇上での演説…足がふるえた。', { yu: 2, gaku: 1 }, 'talk'],
  (S) => ['部活の大会', S.club && D.CLUBS[S.club] && !D.CLUBS[S.club].none ? `${D.CLUBS[S.club].name}の大会。${S.tai + S.kan >= 90 ? '地区大会で入賞した！' : '1回戦で負けて、みんなで泣いた。'}` : '友だちの部活の大会を、応援に行った。', { tai: 1, kan: 1 }],
  () => ['文化祭', '文化祭で、クラスの出し物はお化け屋敷。おどかし役が、思ったより楽しかった。', { kan: 1, yu: 1 }, 'engi'],
];

async function fallbackIO(g) {
  return {
    page: async (title, lines) => { await g.say(lines.map((l) => `【${title}】\n${l}`)); },
    pick: async (title, items) => { const i = await g.ask(title, items.map((x) => x.label)); return i < 0 ? 0 : i; },
  };
}
export function originDone(g) { const L = ensure(g); return !!(L && L.origin && L.origin.done); }

export async function runOrigin(g, io0) {
  const L = ensure(g);
  if (!L) return null;
  if (L.origin.done) return null;
  const io = io0 || (await fallbackIO(g));
  const st = g.state, nowAge = ageOf(st), yNow = yearNow(g), born = yNow - nowAge;
  const pf = profileOf(st);
  const S = { gaku: 8, tai: 12, kan: 8, yu: 8, sei: 4, ken: 84, club: null, lesson: null };
  const skills = {};
  const hist = [];
  const addSkill = (k, n = 1) => { const tot = Object.values(skills).reduce((a, b) => a + b, 0); if (k && tot < 8) skills[k] = (skills[k] || 0) + Math.min(n, 8 - tot); };
  const apply = (gs) => { for (const [k, v] of Object.entries(gs || {})) if (k in S && typeof S[k] === 'number') S[k] = clamp(S[k] + v, 0, 100); };
  const ctxOf = (age) => ({ year: born + age, play: D.childPlay(born + age) });
  const go = await io.pick('生い立ちを、ふりかえる', [{ label: 'はじめる', sub: `${born}年生まれの、あなたの子ども時代。赤ちゃんから中学卒業まで、選びながら進む（1回だけ）` }, { label: 'またあとで', sub: '' }]);
  if (go !== 0) return null;
  // ---- 赤ちゃん
  await io.page('赤ちゃん（0歳）', [`${born}年、${prefecture(pf.hometown).name}で、あなたは生まれた。${pf.familyName}家の、新しい家族。`, '「どんな赤ちゃんだったの？」と聞くと、家族はいつも、同じ話をする。'], { stage: 'baby', age: 0 });
  const b = BABY[await io.pick('どんな赤ちゃんだった？', BABY.map((x) => ({ label: x.label, sub: statLine(x.g) })), { stage: 'baby' })] || BABY[0];
  apply(b.g); if (b.skill) addSkill(...b.skill);
  await io.page('赤ちゃん', [b.line, `（${statLine(b.g)}）`], { stage: 'baby', age: 1 });
  hist.push([0, `${born}年に生まれた。${b.label.replace('赤ちゃん', '赤ちゃんだった')}`]);
  // ---- 幼児
  const t = TODDLER[await io.pick('保育園・幼稚園で、夢中になったのは？', TODDLER.map((x) => ({ label: x.label, sub: statLine(x.g) })), { stage: 'baby' })] || TODDLER[0];
  apply(t.g); if (t.skill) addSkill(...t.skill);
  await io.page('幼児（3〜5歳）', [t.line, `（${statLine(t.g)}${t.skill ? `　${SK[t.skill[0]]}+1` : ''}）`], { stage: 'baby', age: 4 });
  hist.push([4, `保育園・幼稚園で「${t.label}」に夢中だった`]);
  // ---- 小学生
  for (let gr = 1; gr <= 6; gr++) {
    const age = gr + 5, c = ctxOf(age);
    const items = FOCUS.map((f) => ({ label: f.id === 'lesson' ? (S.lesson ? `習いごと（${D.LESSONS[S.lesson].name}）に打ちこむ` : '習いごとを始める') : f.label, sub: f.id === 'lesson' ? (S.lesson ? statLine(D.LESSONS[S.lesson].g) + '　+少し' : 'ピアノ・スイミング・そろばん…') : statLine(f.g) }));
    const fi = await io.pick(`小学${gr}年生（${c.year}年）。いちばん打ちこんだのは？`, items, { stage: 'elem', age });
    const f = FOCUS[fi] || FOCUS[0];
    let gotLine = '';
    if (f.id === 'lesson') {
      if (!S.lesson) {
        const ids = D.lessonsFor(c.year);
        const li = await io.pick('どの習いごと？', ids.map((id) => ({ label: D.LESSONS[id].name, sub: statLine(D.LESSONS[id].g) })), { stage: 'elem', age });
        S.lesson = ids[li] || ids[0];
        hist.push([age, `${D.LESSONS[S.lesson].name}を習いはじめた`]);
      }
      const gs = Object.fromEntries(Object.entries(D.LESSONS[S.lesson].g).map(([k, v]) => [k, v + 2]));
      apply(gs); gotLine = statLine(gs);
      if (S.lesson === 'piano' || S.lesson === 'ballet' || S.lesson === 'dance') addSkill(S.lesson === 'piano' ? 'uta' : 'engi', 1);
    } else { apply(f.g); gotLine = statLine(f.g); }
    if (S.lesson && f.id !== 'lesson') apply(D.LESSONS[S.lesson].g); // a lesson goes on in the background
    const ev = (gr in ELEM_FIXED && (gr === 1 || gr === 6 || lsRand() < 0.5) ? ELEM_FIXED[gr] : pickR(ELEM_RANDOM))(S, c);
    apply(ev[2]); if (ev[3]) addSkill(ev[3], 1);
    await io.page(`小学${gr}年生：${ev[0]}`, [ev[1], `（${gotLine}${gotLine && statLine(ev[2]) ? '　' : ''}${statLine(ev[2])}${ev[3] ? `　${SK[ev[3]]}+1` : ''}）`], { stage: 'elem', age });
    if (gr === 1 || gr === 6 || ev[3] || /入賞|主役|リレー/.test(ev[0])) hist.push([age, `小学${gr}年：${ev[0]}`]);
  }
  hist.push([12, '小学校を卒業した']);
  // ---- 中学生
  const ci = await io.pick('中学校に入学！ 部活は？', D.CLUB_ORDER.map((id) => ({ label: D.CLUBS[id].name, sub: statLine(D.CLUBS[id].g) || '放課後は自由' })), { stage: 'mid', age: 12 });
  S.club = D.CLUB_ORDER[ci] || 'kitaku';
  hist.push([12, `中学で${D.CLUBS[S.club].name}に${D.CLUBS[S.club].none ? 'なった' : '入った'}`]);
  const MFOCUS = [{ label: '勉強に集中', g: { gaku: 6 } }, { label: '部活に全力', g: D.CLUBS[S.club].none ? { tai: 2, kan: 2 } : Object.fromEntries(Object.entries(D.CLUBS[S.club].g).map(([k, v]) => [k, v * 2 + 1])) }, { label: '友だちとの時間', g: { yu: 6 } }, { label: '趣味をとことん', g: { kan: 5, gaku: 1 } }, { label: '家族を手伝う', g: { sei: 5, yu: 1 } }];
  for (let gr = 1; gr <= 3; gr++) {
    const age = gr + 11, c = ctxOf(age);
    const fi = await io.pick(`中学${gr}年生（${c.year}年）。この1年、力を入れたのは？`, MFOCUS.map((f) => ({ label: f.label, sub: statLine(f.g) })), { stage: 'mid', age });
    const f = MFOCUS[fi] || MFOCUS[0];
    apply(f.g);
    if (f.label === '部活に全力' && D.CLUBS[S.club].skill) addSkill(D.CLUBS[S.club].skill, 1);
    const ev = pickR(MID_RANDOM)(S, c);
    apply(ev[2]); if (ev[3]) addSkill(ev[3], 1);
    await io.page(`中学${gr}年生：${ev[0]}`, [ev[1], `（${statLine(f.g)}　${statLine(ev[2])}${ev[3] ? `　${SK[ev[3]]}+1` : ''}）`], { stage: 'mid', age });
    if (ev[3] || /上位|入賞|生徒会/.test(ev[1] + ev[0])) hist.push([age, `中学${gr}年：${ev[0]}`]);
  }
  // ---- 高校受験
  const opts = [
    { id: 'shingaku', need: 55, label: '進学校を受ける', sub: '学力55以上で合格しやすい。勉強がきびしい' },
    { id: 'futsu', need: 0, label: '普通科の高校', sub: 'ふつうの全日制。部活も行事も' },
    { id: 'jitsugyo', need: 0, label: '商業・工業科の高校', sub: '資格や実習。生活力が伸びる' },
    { id: 'geino', need: 0, label: '芸能コース（通信制）', sub: '芸能の仕事と両立しやすい' },
  ];
  const oi = await io.pick(`高校受験（学力 ${S.gaku}）。どこを受ける？`, opts.map((o) => ({ label: o.label, sub: o.sub })), { stage: 'mid', age: 15 });
  let hs = (opts[oi] || opts[1]).id;
  if (hs === 'shingaku' && S.gaku < 55 && lsRand() > 0.25 + S.gaku / 200) { await io.page('高校受験', ['進学校は、あと少しのところで届かなかった…。', 'すべり止めの普通科の高校に進むことになった。（それも、きっと、いい出会いの場所だ）'], { stage: 'mid', age: 15 }); hs = 'futsu'; }
  else await io.page('高校受験', [`${D.HIGH_TYPES[hs].name}に合格！ 桜の下で、合格の番号を見つけた。`], { stage: 'mid', age: 15 });
  hist.push([15, `${D.HIGH_TYPES[hs].name}に合格した`]);
  // ---- the result
  // what you were good at as a child lifts that stat now; what you never did lowers it a little (an average childhood is about 22)
  for (const k of D.STAT_ORDER) L.stats[k] = clamp(L.stats[k] + Math.round(((k === 'ken' ? S[k] - 84 : S[k] - 22)) * 0.35), 5, 100);
  for (const [k, v] of Object.entries(skills)) { try { g.addSkill(k, v, true); } catch (e) { /* tests */ } }
  if (L.high && !L.high.grad && nowAge <= 17) L.high.type = hs;
  L.origin = { done: true, day: st.day, born, baby: BABY.indexOf(b), club: S.club, lesson: S.lesson, hs, skills, stats: D.STAT_ORDER.reduce((o, k) => ((o[k] = S[k]), o), {}) };
  // 年表: the childhood goes before everything else
  const made = num(L.made, 1);
  const old = L.hist.slice();
  L.hist = hist.map(([a, t]) => ({ d: made, a, t, k: 'origin' })).concat(old);
  addHist(g, '自分の生い立ちを、ふりかえった', 'origin');
  const skl = Object.entries(skills).map(([k, v]) => `${SK[k]}+${v}`).join('　');
  await io.page('生い立ち（おしまい）', [`こうして、いまのあなたがいる。`, `いまの能力：${D.STAT_ORDER.map((k) => `${D.STATS[k].name}${L.stats[k]}`).join('・')}`, skl ? `子どものころの経験で、スキルも少し伸びた（${skl}）` : '年表に、子どものころの思い出が加わった。'], { stage: 'mid', age: 15, done: true });
  return L.origin;
}
Object.defineProperty(Game.prototype, 'lifeOrigin', { value: function lifeOrigin(io) { return runOrigin(this, io); }, writable: true, configurable: true });
if (typeof window !== 'undefined') window.__lsOrigin = { runOrigin, originDone, BABY, TODDLER, FOCUS };
