// 賞レースのデータ A (owner: D2a): THE SECOND, ダブルインパクト, THE MANZAI, NHK新人お笑い大賞, NHK新人落語大賞,
// NHK上方漫才コンテスト, 上方漫才大賞, 上方お笑い大賞, ytv漫才新人賞, MBS新世代漫才アワード.
// Registered by contests_data.js (defineContestsA(registerContest)). Every person is fictional; real names are the contests,
// broadcasters and halls only. Facts were checked with web searches on 2026-10-24 (ja.wikipedia itself was not reachable from
// this sandbox; the search engine's index of Wikipedia mirrors / news articles was used) — each def lists what was verified
// and its sources; anything not verified is kept generic and marked （未確認）/「ゲーム上の設定」.

import {
  rngFor, gauss, shuffleR, pickR, clamp, wareki, nendo, deviceOf, mediaOf, ordinal, yearOf, dstate, yearLog, addTitle,
  unitOf, unitName, unitYears, geireki, fame, isKansai, perform, rivals, judges, rivalScore, news, omakase, withBoard, pause,
  boardSpec, nameOf, stdRound, standing, finishRound, flawLines, audienceVotes, sumV, countV, selResult, activityScore,
  pastChampion, editionCounter, checkElig, defaultKind, pickBeats, personName, combiName, rakugoName,
} from './contests_data_lib.js';

const say = (g, t, o) => g.say(t, o);
const MC = (r) => ({ name: `進行役・${personName(r)}` });

// ============================================================== shared formats of this file
// 1対1 タイマン (THE SECOND): both acts do a 6-minute set, 100 audience judges give 1/2/3 points each (300 max).
// Tie → more 3-point votes wins → 抽選 (verified rule, see THE SECOND sources).
async function taiman(g, ctx, b, opp, o = {}) {
  const r = rngFor(g, ctx.id, ctx.round && ctx.round.id, 'taiman', opp.name, o.salt || '');
  const first = r() < 0.5; // 先攻・後攻は抽選
  b.set('match', { a: { name: unitName(g), me: true, score: 0, tag: first ? '先攻' : '後攻' }, b: { name: opp.name, score: 0, tag: first ? '後攻' : '先攻' }, max: 300, reveal: 0, label: o.label || '1対1のタイマン　観客100人×最大3点' });
  await say(g, `${first ? 'こちらが先攻' : `先攻は${opp.name}`}。${o.intro || '6分間、どちらがより面白いか。'}`);
  const skip = await omakase(g, ctx);
  const res = await perform(g, ctx, { kind: 'manzai', length: 360, venue: { name: o.venue || '劇場', size: o.size || 'theater', crowd: 'normal', pressure: o.pressure ?? 70 }, title: o.title || 'THE SECOND', skip });
  const os = rivalScore(g, opp, { kind: 'manzai', length: 360 }, r);
  const va = audienceVotes(res.score, 100, r);
  const vb = audienceVotes(os, 100, r);
  let sa = sumV(va); let sb = sumV(vb);
  b.set('votes', { n: 100, votes: va, who: unitName(g), label: '観客審査員100人の採点（3点＝とても面白かった）' });
  await pause(g, 70);
  let win = sa > sb;
  let tie = '';
  if (sa === sb) {
    const a3 = countV(va, 3); const b3 = countV(vb, 3);
    if (a3 !== b3) { win = a3 > b3; tie = `同点！ 3点をつけた人数（${a3}対${b3}）で決着。`; } else { win = r() < 0.5; tie = '同点、3点の数も同じ——抽選で決着。'; }
  }
  b.set('match', { a: { name: unitName(g), me: true, score: sa, votes: { 3: countV(va, 3), 2: countV(va, 2), 1: countV(va, 1) }, win }, b: { name: opp.name, score: sb, votes: { 3: countV(vb, 3), 2: countV(vb, 2), 1: countV(vb, 1) }, win: !win }, max: 300, label: o.label || '1対1のタイマン' });
  g.sfx(win ? 'applause' : 'buzz');
  await say(g, `${unitName(g)} ${sa}点 − ${sb}点 ${opp.name}。${tie}${win ? '勝ち抜け！' : '敗退…'}`);
  void sa; void sb;
  return { win, score: res.score, res, sa, sb };
}
// several acts score from N judges (each 1..10 or 1..100); returns sorted rows
function panelScores(g, r, acts, nJ, max) {
  return acts.map((a) => {
    const per = [];
    for (let j = 0; j < nJ; j++) per.push(clamp(Math.round(((a.score + gauss(r) * 7) / 100) * max), Math.round(max * 0.3), max));
    return { ...a, per, total: per.reduce((x, y) => x + y, 0) };
  }).sort((x, y) => y.total - x.total || (x.me ? -1 : 1));
}
// each judge votes for one act (the best as they perceive it)
function judgeVotes(r, acts, nJ, noise = 8) {
  const v = acts.map(() => 0);
  for (let j = 0; j < nJ; j++) {
    let best = 0; let bv = -1e9;
    acts.forEach((a, i) => { const p = a.score + gauss(r) * noise; if (p > bv) { bv = p; best = i; } });
    v[best]++;
  }
  return v;
}
async function revealRanking(g, b, rows, head, o = {}) {
  b.set('ranking', { rows: rows.map((x, i) => ({ name: x.name, score: x.total ?? x.score, me: x.me, place: i + 1, tag: x.tag || '' })), passLine: o.passLine, head, note: o.note || '', max: o.max || 100, unit: o.unit || '' });
  await pause(g, 50);
}
function champion(g, ctx, label, o = {}) {
  addTitle(g, ctx.id, label);
  const y = yearOf(g, ctx);
  news(g, ctx, o.news || `【速報】${nameOf(ctx.def, y)}${ctx.revival ? '（復刻開催）' : ''} ${label}は${unitName(g)}！`, 'result');
}
const kindLabel = { manzai: '漫才', conte: 'コント', pin: 'ピン芸', rakugo: '落語' };

// ============================================================== THE SECOND〜漫才トーナメント〜
// VERIFIED: フジテレビ; 第1回2023（選考会 2023年2月 東京2/15-17・大阪2/21-22, 133組 / 開幕戦ノックアウトステージ32→16 3月27-28日 /
//   16→8 4月29-30日 / グランプリファイナル 5月20日 フジテレビ系19時生放送）; 第2回2024, 第3回2025（140組）, 第4回2026（152組,
//   ファイナル5月16日）; 出場資格=結成16年以上のプロの漫才師（アマチュア・即席ユニット不可、全国ネットの漫才賞レース番組で優勝経験の
//   ある組は不可）; ネタ6分; 観客審査員100人が3点（とても面白かった）/2点/1点で採点・300点満点; 同点は3点の人数→抽選; 32組は
//   4組×8ブロックの1対1トーナメント; 優勝賞金1000万円（第1・2回で同額と発表）。参加費は未確認（ゲームでは無料扱い）。
// Sources: oricon.co.jp/news/2269344, /2370530, /2319285, /2366734; news.mynavi.jp/article/20230430-2669388, 20230329-2639049,
//   20260116-3979043; natalie.mu/owarai/news/513348, 672314; toyokeizai.net/articles/-/673438; weblio THE SECOND (ja.wikipedia mirror)
const SECOND = {
  name: 'THE SECOND〜漫才トーナメント〜', short: 'THE2nd', kind: 'manzai', category: 'major', color: '#b8892a',
  organizer: 'フジテレビ', broadcaster: 'フジテレビ系（グランプリファイナル＝全国ネット・ゴールデン生放送）', venue: 'フジテレビ（グランプリファイナル生放送）', region: 'all',
  history: { founded: 2023, ended: null, gaps: [], revived: null, note: '結成16年以上の漫才師による“セカンドチャンス”。審査は観客100人、1対1のタイマン。',
    sources: ['https://www.oricon.co.jp/news/2269344/full/', 'https://news.mynavi.jp/article/20230430-2669388/', 'https://news.mynavi.jp/article/20260116-3979043/', 'https://natalie.mu/owarai/news/672314', 'https://toyokeizai.net/articles/-/673438'] },
  editionOf: editionCounter(2023),
  schedule: { entry: { from: [1, 1], to: [1, 6] }, final: [5, 6] },
  rounds: [
    { id: 'senkou', name: '選考会', when: [[2, 2], [2, 6]], venues: ['東京', '大阪'], length: 360, pass: 32, field: 150, judge: 'staff', scoring: '事務局公認の審査員による選考（6分ネタ）',
      run: stdRound({ kind: 'manzai', length: 360, pass: 32, field: 150, level: 58, set: 'theater', judgeText: '公認審査員が32組を選出',
        beats: [
          '楽屋に並ぶのは、芸歴20年近いベテランばかり。誰かが「同窓会みたいやな」とつぶやいた。',
          '持ち時間は6分。いつもの4分ネタに、もうひと山を足してきた。',
          (g) => `「若い頃に置いてきたもん、取りに来たんや」——${unitName(g)}の楽屋に、小さな笑いが起きた。`,
          '選考会は劇場の小屋。客席には審査員と、少しの関係者だけ。',
        ] }) },
    { id: 'ko32', name: '開幕戦ノックアウトステージ 32→16', when: [3, 6], length: 360, pass: 16, field: 32, judge: 'audience', judges: 100, scoring: '観客100人×1〜3点（300点満点）・1対1',
      run: (g, ctx) => secondKO(g, ctx, 62, '開幕戦ノックアウトステージ') },
    { id: 'ko16', name: 'ノックアウトステージ 16→8', when: [4, 8], length: 360, pass: 8, field: 16, judge: 'audience', judges: 100, scoring: '観客100人×1〜3点（300点満点）・1対1',
      run: (g, ctx) => secondKO(g, ctx, 68, 'ノックアウトステージ16→8') },
    { id: 'final', name: 'グランプリファイナル', when: [5, 6], length: 360, field: 8, judge: 'audience', judges: 100, tv: true, final: true, scoring: '8組のトーナメント（準々決勝・準決勝・決勝）観客100人×1〜3点',
      run: secondFinal },
  ],
  eligibility: (g, unit, year) => {
    const c = checkElig(g, unit, year, { members: [2, null], pro: true, amateur: false, unitYearsMin: 16 });
    const pc = pastChampion(g, ['m1', 'themanzai', 'thesecond'], year);
    if (pc) return { ok: false, why: [c.why, '全国ネットの漫才賞レースで優勝経験がある組は出場できない'].filter(Boolean).join('／') };
    return c;
  },
  eligibilityNote: '結成16年以上のプロの漫才師（アマチュア・即席ユニット不可／全国ネットの漫才賞レース優勝経験者は不可）',
  fee: 0, feeNote: '参加費は未確認（ゲームでは無料扱い）',
  prize: 10000000, prizeText: '優勝賞金1000万円',
  perform: { kind: 'manzai', length: 360 },
  news: [
    (g, c) => `『THE SECOND〜漫才トーナメント〜${c.year}』エントリー締め切り。結成16年以上の漫才師が約150組名乗り`,
    '選考会スタート。持ち時間は6分——「4分では収まらなかった漫才」が東京・大阪の劇場に並ぶ',
    'ノックアウトステージ組み合わせ決定。32組が4組ずつ8ブロック、1対1の“タイマン”へ',
    '審査は観客100人。「とても面白かった3点、面白かった2点、面白くなかった1点」の300点満点',
    (g, c) => `ベテランの“セカンドチャンス”に${mediaOf(c.year)}でも応援の声。「解散を考えていたコンビが勝ち上がった」`,
    'グランプリファイナルは5月、フジテレビ系で生放送。優勝賞金1000万円',
    '同点なら「3点をつけた人数」で決着。それでも並べば抽選——ルールがドラマを生む',
    'ファイナルは最大3試合。ネタを3本そろえられるかが勝負の分かれ目',
  ],
  beats: ['ネタは最大3本必要。準々決勝・準決勝・決勝で同じネタは使えない。', '採点は一般のお客さん。プロの審査員はいない。', '勝敗は2組のネタが終わってから一気に発表される。'],
  catchcopy: (g) => `${pickR(['16年目の逆襲', '遅咲きの本気', '劇場叩き上げ', '二度目の春', '6分の職人', '解散しなかった理由'], rngFor(g, 'second-cc'))}　${unitName(g)}`,
};
async function secondKO(g, ctx, level, label) {
  const opp = rivals(g, ctx, 1, { level, kind: 'manzai', salt: label })[0];
  return withBoard(g, boardSpec(ctx, label, { set: 'theater' }), async (b) => {
    const r = rngFor(g, ctx.id, label, 'beat');
    for (const t of pickBeats(SECOND.beats, r, 1)) await say(g, t);
    await say(g, `対戦相手は${opp.name}（結成${16 + Math.floor(r() * 12)}年）。`);
    const m = await taiman(g, ctx, b, opp, { label: `${label}　観客100人×最大3点`, venue: label });
    if (!m.win) {
      const why = flawLines(g, 'manzai', m.score, r);
      await say(g, `敗因：${why.join('／')}`);
    }
    return { passed: m.win, score: m.score, rank: m.res.rank, place: m.win ? null : (level < 65 ? 17 : 9), field: level < 65 ? 32 : 16, detail: { points: m.sa, opp: opp.name, oppPoints: m.sb } };
  });
}
async function secondFinal(g, ctx) {
  const rvs = rivals(g, ctx, 7, { level: 72, kind: 'manzai', favourites: true });
  const r = rngFor(g, ctx.id, 'final-draw');
  const order = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
  return withBoard(g, boardSpec(ctx, 'グランプリファイナル（生放送）', { set: 'studio' }), async (b) => {
    const mc = MC(r);
    b.set('card', { name: 'THE SECOND', edition: `${ordinal(ctx.edition)}　グランプリファイナル`, catch: `8組のトーナメント。観客100人の採点で勝ち上がり、3試合を勝ち切った組が王者。${SECOND.catchcopy(g)}` });
    await say(g, ['生放送が始まった。', `「ベテラン漫才師たちの、二度目の青春。THE SECOND、グランプリファイナル！」`], mc);
    const rounds = [[], [], []];
    for (let i = 0; i < 8; i += 2) rounds[0].push({ a: order[i].name, b: order[i + 1].name, me: order[i].me || order[i + 1].me, A: order[i], B: order[i + 1] });
    let alive = true; let wins = 0; let lastScore = 0;
    const stageNames = ['準々決勝', '準決勝', '決勝'];
    for (let s = 0; s < 3; s++) {
      if (s > 0) {
        const prev = rounds[s - 1];
        for (let i = 0; i < prev.length; i += 2) { const A = prev[i].W; const B = prev[i + 1].W; rounds[s].push({ a: A.name, b: B.name, me: A.me || B.me, A, B }); }
      }
      for (const m of rounds[s]) {
        if (m.me && alive) {
          const opp = m.A.me ? m.B : m.A;
          b.set('bracket', { rounds: rounds.map((x) => x.map((y) => ({ a: y.a, b: y.b, w: y.W && y.W.name, me: y.me }))), label: `${stageNames[s]}：${unitName(g)} vs ${opp.name}` });
          await say(g, `${stageNames[s]}。${s === 2 ? '最後の6分。' : s === 1 ? '2本目のネタ。同じネタは使えない。' : '1本目。'}`);
          const t = await taiman(g, ctx, b, opp, { label: `${stageNames[s]}　観客100人×最大3点`, size: 'tv', pressure: 80 + s * 6, venue: 'グランプリファイナル', salt: stageNames[s] });
          lastScore = t.score;
          m.W = t.win ? (m.A.me ? m.A : m.B) : opp;
          if (t.win) wins++; else alive = false;
        } else {
          const sa = rivalScore(g, m.A, { kind: 'manzai' }, r); const sb = rivalScore(g, m.B, { kind: 'manzai' }, r);
          m.W = sa >= sb ? m.A : m.B;
        }
      }
    }
    b.set('bracket', { rounds: rounds.map((x) => x.map((y) => ({ a: y.a, b: y.b, w: y.W && y.W.name, me: y.me }))), label: `優勝：${rounds[2][0].W.name}` });
    const champ = alive && wins === 3;
    if (champ) {
      g.sfx('fanfare');
      await say(g, [`THE SECOND ${ordinal(ctx.edition)}王者は——${unitName(g)}！`, '紙吹雪の中、相方と肩を組んだ。結成から十数年、遠回りした道がここにつながっていた。']);
      champion(g, ctx, '優勝');
    } else {
      await say(g, `優勝は${rounds[2][0].W.name}。${unitName(g)}は${['準々決勝', '準決勝', '決勝'][wins]}で敗退した。`);
    }
    return { passed: champ, champion: champ, score: lastScore, place: champ ? 1 : wins === 2 ? 2 : wins === 1 ? 3 : 5, field: 8, award: champ ? '優勝' : null };
  });
}

// ============================================================== ダブルインパクト〜漫才・コント二刀流No.1決定戦〜
// VERIFIED: 日本テレビ・読売テレビ; 2025新設（決勝 2025年7月21日 19:00〜 日本テレビ・読売テレビ系, 2875組, 準決勝21組→決勝7組,
//   初代王者あり）; 2026年 第2回（2896組, 準々決勝 5月, 準決勝 6月16・17日 25組→決勝8組, 決勝 7月20日, 決勝は8組＋上位5組が
//   ファイナルステージ）; 資格=2人以上ならプロアマ・芸歴不問; 決勝=漫才(4分)とコント(4分)の2本・どちらから披露するか選べる;
//   審査員5人・1人100点の500点満点; 優勝賞金1000万円。予選のネタ時間・参加費は未確認（ゲーム上の設定）。
// Sources: natalie.mu/owarai/news/632841, 633062, 676462, 676554; sakigake.jp 20260720OR0128, 20260714OR0070; oricon.co.jp/news/2396567;
//   news.allabout.co.jp/articles/o/95926; l-tike.com/ntvzero/event/double-impact2026.html
const DOUBLE = {
  name: 'ダブルインパクト〜漫才・コント二刀流No.1決定戦〜', short: 'Wインパ', kind: 'double', category: 'major', color: '#d0402a',
  organizer: '日本テレビ・読売テレビ', broadcaster: '日本テレビ・読売テレビ系（決勝＝全国ネット生放送）', venue: '決勝：日本テレビのスタジオ', region: 'all',
  history: { founded: 2025, ended: null, gaps: [], revived: null, note: '漫才とコント、両方で面白い“二刀流”の芸人No.1を決める。',
    sources: ['https://natalie.mu/owarai/news/632841', 'https://natalie.mu/owarai/news/676554', 'https://www.sakigake.jp/news/article/20260720OR0128/', 'https://news.allabout.co.jp/articles/o/95926/'] },
  editionOf: editionCounter(2025),
  schedule: { entry: { from: [3, 1], to: [3, 10] }, final: [7, 8] },
  rounds: [
    { id: 'r1', name: '1回戦', when: [[4, 3], [4, 6]], venues: ['東京', '大阪'], length: 120, pass: 0.3, field: 2900, judge: 'staff', scoring: '漫才1本＋コント1本（各2分・ゲーム上の尺）', run: doubleRound(120, 0.3, 2900, 42) },
    { id: 'r2', name: '2回戦', when: [4, 10], venues: ['東京', '大阪'], length: 180, pass: 0.3, field: 900, judge: 'staff', scoring: '漫才＋コント（各3分・ゲーム上の尺）', run: doubleRound(180, 0.3, 900, 52) },
    { id: 'qf', name: '準々決勝', when: [5, 8], venues: ['東京', '大阪'], length: 240, pass: 25, field: 260, judge: 'staff', scoring: '漫才＋コント', run: doubleRound(240, 25, 260, 60) },
    { id: 'sf', name: '準決勝', when: [6, 5], venues: ['東京'], length: 240, pass: 8, field: 25, judge: 'staff', scoring: '漫才とコントを同日に披露', run: doubleRound(240, 8, 25, 68) },
    { id: 'final', name: '決勝', when: [7, 8], length: 240, field: 8, judge: 'panel', judges: 5, scoring: '漫才4分＋コント4分・審査員5人×100点＝500点満点', tv: true, final: true, run: doubleFinal },
  ],
  eligibility: (g, unit, year) => checkElig(g, unit, year, { members: [2, null], pro: true, amateur: true }),
  eligibilityNote: '2人以上ならプロ・アマ、芸歴を問わない',
  fee: 0, feeNote: '参加費は未確認（ゲームでは無料扱い）',
  prize: 10000000, prizeText: '優勝賞金1000万円',
  perform: { kind: 'double', length: 240 },
  news: [
    (g, c) => `『ダブルインパクト${c.year}』エントリー約2900組。漫才とコント、両方で勝負する“二刀流”の祭典`,
    '「漫才師がコントをやると、コント師が漫才をやると」——予選では両方のネタを1本ずつ',
    '準決勝は漫才とコントを同じ日に披露。着替えの時間も勝負のうち',
    '決勝は漫才4分＆コント4分。どちらを先にやるかは各組が選べる',
    '審査員は5人、1人100点の500点満点。2本の総合で評価',
    (g, c) => (c.year >= 2026 ? '今年から決勝は上位5組が「ファイナルステージ」へ' : '決勝は7組。初代王者の称号と賞金1000万円の行方は'),
    '「漫才の人」「コントの人」という肩書きが、この大会では通用しない',
  ],
  beats: ['楽屋の床に、コント用の衣装と小道具が並んでいる。漫才のスーツはハンガーに。', '漫才が終わるとすぐ着替え。舞台袖は戦場だ。', '「漫才では負けへん。コントで追いつかれへんかだけ」相方がネクタイを締め直す。'],
  catchcopy: (g) => `${pickR(['二刀流の申し子', '両手に爆笑', 'センターマイクと暗転のあいだ', '漫才もコントも'], rngFor(g, 'dbl-cc'))}　${unitName(g)}`,
};
function doubleRound(length, pass, field, level) {
  return async (g, ctx) => withBoard(g, boardSpec(ctx, '', { set: 'theater' }), async (b) => {
    const r = rngFor(g, ctx.id, ctx.round.id, 'dbl');
    for (const t of pickBeats(DOUBLE.beats, r, 1)) await say(g, t);
    b.set('stage', { caption: `${ctx.round.name}　1本目：漫才` });
    const skip = await omakase(g, ctx);
    const a = await perform(g, ctx, { kind: 'manzai', length, title: `${ctx.round.name} 漫才`, skip, venue: { size: 'theater', crowd: 'normal', pressure: 50 + level / 3 } });
    b.set('stage', { caption: `${ctx.round.name}　2本目：コント` });
    await say(g, '漫才が終わるとすぐ着替え。2本目はコントだ。');
    const c = await perform(g, ctx, { kind: 'conte', length, title: `${ctx.round.name} コント`, skip, venue: { size: 'theater', crowd: 'normal', pressure: 50 + level / 3 } });
    const score = Math.round((a.score + c.score) / 2 - Math.abs(a.score - c.score) * 0.1); // a weak side hurts (二刀流)
    await say(g, `漫才 ${a.score}点・コント ${c.score}点 → 二刀流の総合 ${score}点${Math.abs(a.score - c.score) > 20 ? '（片方が弱いと総合が伸びない）' : ''}`);
    const rvs = rivals(g, ctx, 11, { level, kind: 'manzai', amateur: true });
    const st = standing(g, ctx, score, rvs, { kind: 'manzai', pass, field });
    b.set('ranking', { rows: st.rows, passLine: st.passN, head: `${ctx.round.name}　結果（漫才＋コント）` });
    await pause(g, 40);
    return finishRound(g, ctx, { score, rank: a.rank }, st, { kind: a.score < c.score ? 'manzai' : 'conte' });
  });
}
async function doubleFinal(g, ctx) {
  const y = yearOf(g, ctx);
  const n = y <= 2025 ? 7 : 8;
  const rvs = rivals(g, ctx, n - 1, { level: 74, kind: 'manzai', favourites: true });
  const r = rngFor(g, ctx.id, 'dfinal');
  return withBoard(g, boardSpec(ctx, '決勝（生放送）', { set: 'studio' }), async (b) => {
    const js = judges(g, ctx, 5, ['漫才師', 'コント師', '漫才師（芸歴30年）', 'コント師（元王者）', 'ピン芸人']);
    b.set('card', { name: 'ダブルインパクト', edition: `${ordinal(ctx.edition)}　決勝`, catch: `漫才4分とコント4分。審査員5人×100点＝500点満点。${DOUBLE.catchcopy(g)}` });
    await say(g, [`審査員は${js.map((j) => j.name).join('、')}の5人。`, '2本のネタを見て、1人100点で採点する。'], MC(r));
    const ord = await g.ask('どちらから披露する？', ['漫才から', 'コントから'], { cancel: 0 });
    const kinds = ord === 0 ? ['manzai', 'conte'] : ['conte', 'manzai'];
    const skip = await omakase(g, ctx);
    const sc = {};
    for (const k of kinds) {
      b.set('stage', { caption: `決勝　${kindLabel[k]}（4分）` });
      sc[k] = (await perform(g, ctx, { kind: k, length: 240, title: `ダブルインパクト決勝 ${kindLabel[k]}`, skip, venue: { size: 'tv', crowd: 'normal', pressure: 85 } })).score;
    }
    const mine = Math.round((sc.manzai + sc.conte) / 2 - Math.abs(sc.manzai - sc.conte) * 0.1);
    const acts = [{ name: unitName(g), me: true, score: mine }, ...rvs.map((x) => ({ name: x.name, score: rivalScore(g, x, { kind: 'manzai' }, r) }))];
    const rows = panelScores(g, r, acts, 5, 100);
    await revealRanking(g, b, rows, '1st STAGE（500点満点）', { max: 500, passLine: y >= 2026 ? 5 : null, unit: '点' });
    const myPlace = rows.findIndex((x) => x.me) + 1;
    await say(g, `${unitName(g)}は${rows.find((x) => x.me).total}点、${n}組中${myPlace}位。（漫才${sc.manzai}・コント${sc.conte}）`);
    let champ = false; let place = myPlace;
    if (y >= 2026) {
      if (myPlace <= 5) {
        await say(g, 'ファイナルステージへ！ 最後の1本は、漫才かコントか。');
        const k = (await g.ask('ファイナルステージのネタは？', ['漫才', 'コント'], { cancel: 0 })) === 0 ? 'manzai' : 'conte';
        const fs = (await perform(g, ctx, { kind: k, length: 240, title: 'ファイナルステージ', skip, venue: { size: 'tv', crowd: 'normal', pressure: 92 } })).score;
        const top = rows.slice(0, 5).map((x) => (x.me ? { ...x, score: fs } : { ...x, score: clamp(Math.round(x.score + gauss(r) * 6), 0, 100) }));
        const fr = panelScores(g, r, top, 5, 100);
        await revealRanking(g, b, fr, 'FINAL STAGE（500点満点）', { max: 500, unit: '点' });
        place = fr.findIndex((x) => x.me) + 1;
        champ = place === 1;
      }
    } else champ = myPlace === 1;
    if (champ) { g.sfx('fanfare'); await say(g, `二刀流No.1——${unitName(g)}！ 漫才とコント、両方で頂点に立った。`); champion(g, ctx, '優勝'); } else await say(g, `優勝は${(y >= 2026 ? rows[0] : rows[0]).name === unitName(g) ? '…' : rows[0].name}。${unitName(g)}は${place}位。`);
    return { passed: champ, champion: champ, score: mine, place, field: n, award: champ ? '優勝' : null, detail: { manzai: sc.manzai, conte: sc.conte } };
  });
}

// ============================================================== THE MANZAI
// VERIFIED: フジテレビ（大会事務局・吉本興業と）; 年間最強漫才師決定トーナメントとして2011〜2014年に開催し2014年で終了（2015年からは
//   M-1グランプリが再開）; 結成年数の制限なし・プロのみ・ピン芸人同士の即席コンビ不可; 2011年は1516組参加, 認定漫才師50組が本戦
//   サーキット（順位に応じたポイント）, 決勝は12月（2011年12月17日は16組→最終決戦4組、2013年12月15日は最終決戦3組）;
//   2014年はポイント上位11組＋ワイルドカード決定戦（12月13日）の1組＝12組が12月14日の決勝へ; 審査員9人の票＋視聴者（ワラテン）
//   1票の計10票; 現金の賞金はなく、フジテレビの番組出演権やスポンサーの副賞; 1980年4月1日『火曜ワイドスペシャル THE MANZAI』
//   から1982年頃まで漫才ブームの番組（賞レースではない）; 2015年以降は年末の『THE MANZAI マスターズ』（非競技の特番、12月初旬）。
//   ポイント表・ネタ時間・決勝の組分け名は未確認（ゲーム上の設定）。
// REVIVAL: the contest ended in 2014 → from 2015 it is held as 「復刻開催」, edition numbers continuing (第5回 = 2015).
// Sources: j-cast.com/2011/12/18116768.html, /2012/12/17158544.html; natalie.mu/owarai/news/130816, 131991; oricon.co.jp/news/89823,
//   2045257; news.livedoor.com/article/detail/8360226; dic.pixiv.net/a/THE_MANZAI; news.mynavi.jp/article/20221127-2522894, 20251206-3767443
const MANZAI = {
  name: 'THE MANZAI', short: 'MANZAI', kind: 'manzai', category: 'major', color: '#1f5fc8',
  names: [{ from: 2011, to: 2014, name: 'THE MANZAI' }, { from: 2015, name: 'THE MANZAI（復刻開催）' }],
  organizer: 'フジテレビ・吉本興業（THE MANZAI大会事務局）', broadcaster: 'フジテレビ系', venue: '決勝：フジテレビ（生放送）', region: 'all',
  history: { founded: 2011, ended: 2014, gaps: [], revived: null,
    note: '1980年4月〜の漫才ブーム番組『THE MANZAI』の名を継ぎ、2011〜2014年に年間最強漫才師決定トーナメントとして開催。2015年以降の本家は非競技の『マスターズ』。ゲームでは2015年以降も賞レースとして復刻開催。',
    sources: ['https://www.j-cast.com/2011/12/18116768.html', 'https://www.j-cast.com/2012/12/17158544.html', 'https://natalie.mu/owarai/news/130816', 'https://www.oricon.co.jp/news/2045257/full/', 'https://dic.pixiv.net/a/THE_MANZAI'] },
  editionOf: editionCounter(2011),
  schedule: { entry: { from: [6, 1], to: [7, 10] }, final: [12, 5] },
  rounds: [
    { id: 'r1', name: '1回戦', when: [[8, 3], [8, 7]], venues: ['東京', '大阪'], length: 180, pass: 0.3, field: 1700, judge: 'staff', scoring: '大会事務局の審査',
      run: stdRound({ kind: 'manzai', length: 180, pass: 0.3, field: 1700, level: 44, beats: ['会場の受付に「THE MANZAI」のロゴ。年末の決勝まで、長い道のりが始まる。', '結成年数は問われない。若手もベテランも同じ1回戦。', '「即席コンビは不可」——受付の張り紙を相方が指さした。'] }) },
    { id: 'r2', name: '2回戦（認定漫才師50組の選考）', when: [9, 5], venues: ['東京', '大阪'], length: 240, pass: 50, field: 500, judge: 'staff', scoring: '上位50組が「認定漫才師」',
      run: stdRound({ kind: 'manzai', length: 240, pass: 50, field: 500, level: 56, head: '2回戦　結果（上位50組＝認定漫才師）', passText: (g) => `「THE MANZAI認定漫才師」50組に選ばれた！ 次は本戦サーキット。`, beats: ['ここを抜ければ「認定漫才師」。年末までの本戦サーキットを回れる。', 'テレビ局のスタッフが客席の端でメモを取っている。'] }) },
    { id: 'circuit', name: '本戦サーキット', when: [[10, 3], [10, 8], [11, 3], [11, 8]], length: 240, pass: 11, field: 50, judge: 'audience', scoring: '各公演の順位に応じたポイント（ゲーム上の配点）→上位11組が決勝', run: manzaiCircuit },
    { id: 'wild', name: 'ワイルドカード決定戦', when: [12, 4], length: 240, pass: 1, field: 39, judge: 'vote', scoring: 'サーキット12位以下から1組', tv: true, revival: true, run: manzaiWildcard },
    { id: 'final', name: '決勝', when: [12, 5], length: 240, field: 12, judge: 'vote', judges: 9, scoring: '審査員9票＋視聴者1票。グループ1位が最終決戦', tv: true, final: true, run: manzaiFinal },
  ],
  eligibility: (g, unit, year) => checkElig(g, unit, year, { members: [2, null], pro: true, amateur: false }),
  eligibilityNote: '結成年数不問・プロの漫才師（ピン同士の即席コンビは不可）',
  fee: 0, feeNote: '参加費は未確認（ゲームでは無料扱い）',
  prize: 0, prizeText: '現金の賞金なし（フジテレビの番組出演権・スポンサー副賞）',
  perform: { kind: 'manzai', length: 240 },
  news: [
    (g, c) => (c.year < 2011 ? `漫才ブームを起こしたフジテレビ『THE MANZAI』（1980年〜）。あの熱狂から${c.year - 1980}年` : `『THE MANZAI ${c.year}』開催決定。結成年数は不問、年間最強漫才師を決める`),
    '本戦サーキット、今日の1位は認定漫才師の中堅コンビ。ポイントランキングが動いた',
    (g, c) => `ワイルドカード決定戦は決勝前日。サーキット12位以下の${c.year >= 2012 ? '1組' : '組'}が最後の切符を争う`,
    '決勝はグループごとに審査員9人＋視聴者1票。グループ1位だけが最終決戦へ',
    '「賞金はない。その代わり、年明けからテレビに出られる」——優勝特典に注目',
    (g, c) => (c.revival ? '本家は2015年から年末の“マスターズ”特番に。今年は賞レースとして復刻開催' : `${mediaOf(c.year)}で“ワラテン”投票の仕組みが話題`),
    '認定漫才師50組のプロフィール写真が公式サイトに並ぶ',
  ],
  beats: ['サーキットの客席は、毎回ちがうお客さん。昨日ウケたネタが今日ウケるとは限らない。', '「ポイントは順位で決まる。1位を取らんと上に行かれへん」', 'センターマイクの前に立つと、フジテレビのカメラが寄ってきた。'],
  catchcopy: (g) => `${pickR(['年間最強の候補', '劇場が育てたしゃべくり', '東西激突', '認定漫才師の意地'], rngFor(g, 'tm-cc'))}　${unitName(g)}`,
};
const CIRCUIT_PTS = [10, 7, 5, 3, 2, 1, 0, 0, 0, 0]; // ゲーム上の配点（実際のポイント表は未確認）
async function manzaiCircuit(g, ctx) {
  const log = yearLog(g, 'themanzai', ctx.year);
  const r = rngFor(g, ctx.id, 'circuit');
  return withBoard(g, boardSpec(ctx, '本戦サーキット', { set: 'theater' }), async (b) => {
    await say(g, ['本戦サーキット。認定漫才師50組が、劇場公演を回って順位ポイントを稼ぐ。', '公演ごとの順位でポイント——上位11組が決勝、12位以下はワイルドカード決定戦へ。']);
    let pts = 0; let last = 0;
    const sessions = 4;
    for (let s = 0; s < sessions; s++) {
      b.set('stage', { caption: `本戦サーキット　第${s + 1}公演` });
      const skip = s > 0 ? true : await omakase(g, ctx);
      const res = await perform(g, ctx, { kind: 'manzai', length: 240, skip, title: `本戦サーキット 第${s + 1}公演`, venue: { size: 'theater', crowd: pickR(['warm', 'normal', 'cold'], r), pressure: 60 } });
      last = res.score;
      const rvs = rivals(g, ctx, 9, { level: 62, kind: 'manzai', salt: 's' + s });
      const st = standing(g, ctx, res.score, rvs, { kind: 'manzai', pass: 3, field: 10 });
      const p = CIRCUIT_PTS[st.place - 1] || 0;
      pts += p;
      b.set('ranking', { rows: st.rows.map((x, i) => ({ ...x, tag: `+${CIRCUIT_PTS[i] || 0}pt` })), head: `第${s + 1}公演の順位`, note: `あなたの累計 ${pts}pt` });
      await pause(g, 40);
      await say(g, `第${s + 1}公演：${st.rows.length}組中${st.place}位（+${p}pt、累計${pts}pt）${s > 0 ? '' : '　※以降の公演は結果だけ表示'}`);
    }
    // the other 49 認定漫才師
    const field = [];
    for (let i = 0; i < 49; i++) field.push({ name: combiName(r), total: Math.max(0, Math.round(10 + gauss(r) * 9 + (i < 8 ? 6 : 0))) });
    field.push({ name: unitName(g), total: pts, me: true });
    field.sort((a, b2) => b2.total - a.total || (a.me ? -1 : 1));
    const place = field.findIndex((x) => x.me) + 1;
    log.circuitPts = pts; log.circuitPlace = place;
    b.set('ranking', { rows: field.slice(0, 10).map((x, i) => ({ name: x.name, score: x.total, me: x.me, place: i + 1 })).concat(place > 10 ? [{ name: unitName(g), score: pts, me: true, place }] : []), passLine: 11, head: 'サーキット最終ポイント', unit: 'pt', max: Math.max(40, field[0].total) });
    await pause(g, 50);
    const top = place <= 11;
    await say(g, top ? `最終${place}位！ 決勝進出が決まった！` : `最終${place}位。決勝前日のワイルドカード決定戦に回る。`);
    // サーキットはここで終わり：上位11組でなくてもワイルドカードへ進める
    return { passed: true, score: last, place, field: 50, qualified: top, note: top ? '決勝進出（上位11組）' : 'ワイルドカード決定戦へ', detail: { points: pts } };
  });
}
async function manzaiWildcard(g, ctx) {
  const log = yearLog(g, 'themanzai', ctx.year);
  if (log.circuitPlace && log.circuitPlace <= 11) {
    await say(g, `サーキット${log.circuitPlace}位で決勝進出は決まっている。ワイルドカード決定戦は楽屋のモニターで見守った。`);
    return { passed: true, score: 0, place: null, field: 39, note: 'シード（サーキット上位11組）', skipped: true };
  }
  return withBoard(g, boardSpec(ctx, 'ワイルドカード決定戦', { set: 'studio' }), async (b) => {
    const r = rngFor(g, ctx.id, 'wild');
    await say(g, ['ワイルドカード決定戦。サーキット12位以下から、決勝への最後の1枠を争う。', '放送は決勝の前日。勝てば明日、また同じスタジオに立てる。']);
    const skip = await omakase(g, ctx);
    const res = await perform(g, ctx, { kind: 'manzai', length: 240, skip, title: 'ワイルドカード決定戦', venue: { size: 'tv', crowd: 'normal', pressure: 75 } });
    const rvs = rivals(g, ctx, 11, { level: 66, kind: 'manzai' });
    const st = standing(g, ctx, res.score, rvs, { kind: 'manzai', pass: 1, field: 12 });
    b.set('ranking', { rows: st.rows, passLine: 1, head: 'ワイルドカード（1組のみ）' });
    await pause(g, 40);
    void r;
    return finishRound(g, ctx, res, st, { kind: 'manzai', passText: () => 'ワイルドカード獲得！ 明日の決勝へ！' });
  });
}
async function manzaiFinal(g, ctx) {
  const y = yearOf(g, ctx);
  const nG = y === 2011 ? 4 : 3; // 2011: 16組・4グループ／2012〜: 12組・3グループ
  const r = rngFor(g, ctx.id, 'mfinal');
  const rvs = rivals(g, ctx, nG * 4 - 1, { level: 72, kind: 'manzai', favourites: true });
  const acts = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
  const js = judges(g, ctx, 9, ['漫才師', '漫才師（大御所）', '放送作家', '演出家', 'コント師']);
  return withBoard(g, boardSpec(ctx, '決勝（生放送）', { set: 'studio' }), async (b) => {
    b.set('card', { name: 'THE MANZAI', edition: `${ordinal(ctx.edition)}　決勝${ctx.revival ? '（復刻開催）' : ''}`, catch: `${nG * 4}組が${nG}グループに分かれて対決。審査員9人の票と視聴者1票、グループ1位だけが最終決戦へ。` });
    await say(g, [`審査員は${js.slice(0, 3).map((j) => j.name).join('、')}ほか全9人。`, '最後の1票は、視聴者の投票で決まる「視聴者票」。'], MC(r));
    const groups = [];
    for (let i = 0; i < nG; i++) groups.push({ label: `グループ${'ABCD'[i]}`, acts: acts.slice(i * 4, i * 4 + 4) });
    let myScore = 0; let inFinal = false;
    const skip = await omakase(g, ctx);
    for (const gr of groups) {
      for (const a of gr.acts) {
        if (a.me) {
          b.set('stage', { caption: `${gr.label}　${unitName(g)}` });
          a.score = (await perform(g, ctx, { kind: 'manzai', length: 240, skip, title: `THE MANZAI 決勝 ${gr.label}`, venue: { size: 'tv', crowd: 'normal', pressure: 85 } })).score;
          myScore = a.score;
        } else a.score = rivalScore(g, a, { kind: 'manzai' }, r);
      }
      const v = judgeVotes(r, gr.acts, 9);
      const vv = judgeVotes(r, gr.acts, 1, 14); // 視聴者票
      gr.acts.forEach((a, i) => { a.votes = v[i] + vv[i]; });
      const w = gr.acts.slice().sort((p, q) => q.votes - p.votes || q.score - p.score)[0];
      w.win = true;
      b.set('groups', { groups: groups.map((x) => ({ label: x.label, acts: x.acts.map((a) => ({ name: a.name, votes: a.votes, me: a.me, win: a.win })) })), label: `${gr.label}の1位：${w.name}` });
      await pause(g, 40);
      await say(g, `${gr.label}は${w.name}が${w.votes}票で1位通過。`);
      if (w.me) inFinal = true;
    }
    const finalists = groups.map((x) => x.acts.find((a) => a.win));
    let champ = false;
    if (inFinal) {
      await say(g, '最終決戦！ もう1本、ネタをやる。');
      for (const a of finalists) a.score = a.me ? (await perform(g, ctx, { kind: 'manzai', length: 240, skip, title: 'THE MANZAI 最終決戦', venue: { size: 'tv', crowd: 'normal', pressure: 92 } })).score : rivalScore(g, a, { kind: 'manzai' }, r);
    } else finalists.forEach((a) => { a.score = rivalScore(g, a, { kind: 'manzai' }, r); });
    const v = judgeVotes(r, finalists, 9);
    const vv = judgeVotes(r, finalists, 1, 14);
    finalists.forEach((a, i) => { a.votes = v[i] + vv[i]; a.win = false; });
    const W = finalists.slice().sort((p, q) => q.votes - p.votes || q.score - p.score)[0];
    W.win = true;
    b.set('groups', { groups: [{ label: '最終決戦', acts: finalists.map((a) => ({ name: a.name, votes: a.votes, me: a.me, win: a.win })) }], label: `優勝：${W.name}` });
    await pause(g, 50);
    champ = !!W.me;
    if (champ) { g.sfx('fanfare'); await say(g, [`${ctx.revival ? '復刻開催の' : ''}THE MANZAI、年間最強漫才師は——${unitName(g)}！`, '賞金はない。その代わり、年明けからフジテレビの番組に呼ばれる。']); champion(g, ctx, '優勝'); }
    else await say(g, `優勝は${W.name}（${W.votes}票）。`);
    return { passed: champ, champion: champ, score: myScore, place: champ ? 1 : inFinal ? 2 : 5, field: nG * 4, award: champ ? '優勝' : null };
  });
}

// ============================================================== NHK新人お笑い大賞（← NHK新人演芸大賞 ← NHK新人演芸コンクール ← NHK新人漫才コンクール）
// VERIFIED: NHK; 前身は1956年開始の『NHK新人漫才コンクール』; 1986年『NHK新人演芸コンクール』に統合, 1991年『NHK新人演芸大賞』
//   （1993年までは演芸・落語の両部門から大賞1組、1994年から部門ごと）; 2014年から演芸部門を改称した『NHK新人お笑い大賞』;
//   対象=結成10年未満（ピンは活動開始10年未満）; 予選は東京・大阪（令和7年度 284組＝東京152・大阪132; 2017年 322組）;
//   本選8組・ブロック分け抽選会（10月9日 NHK大阪）→本選 10月下旬に NHK総合で生放送（令和6年度 10月27日 東京・イイノホール,
//   令和7年度 10月26日）; 本選は大阪と東京で交互; ネタ時間4分（過去の本選）; 決勝で2組が対決した年あり。
//   審査員の人数・点数方式・賞金は未確認（ゲーム上：審査員5人×10点）。回数表記は年度（「令和7年度」）。
// Sources: natalie.mu/owarai/news/643749, 645726, 403072, 596963; oricon.co.jp/news/2098585; news.mynavi.jp/article/20071024-jaljal;
//   dic.pixiv.net/a/NHK新人お笑い大賞; d.hatena.ne.jp/keyword/NHK新人お笑い大賞; kobe-np.co.jp (2021/09)
const NHK_OWARAI = {
  name: 'NHK新人お笑い大賞', short: 'NHK新人', kind: 'any', category: 'newcomer', color: '#2a7a4a',
  names: [{ from: 1956, name: 'NHK新人漫才コンクール' }, { from: 1986, name: 'NHK新人演芸コンクール' }, { from: 1991, name: 'NHK新人演芸大賞（演芸部門）' }, { from: 2014, name: 'NHK新人お笑い大賞' }],
  organizer: 'NHK', broadcaster: 'NHK総合（本選を生放送）', venue: '本選：東京（イイノホール等）と大阪（NHK大阪ホール）で交互', region: 'all',
  history: { founded: 1956, ended: null, gaps: [], revived: null, note: '1956年のNHK新人漫才コンクールから続く若手の登竜門。1986年演芸コンクールに統合、1991年新人演芸大賞、2014年に演芸部門が「新人お笑い大賞」に。',
    sources: ['https://natalie.mu/owarai/news/643749', 'https://natalie.mu/owarai/news/403072', 'https://dic.pixiv.net/a/NHK%E6%96%B0%E4%BA%BA%E3%81%8A%E7%AC%91%E3%81%84%E5%A4%A7%E8%B3%9E', 'https://d.hatena.ne.jp/keyword/NHK%E6%96%B0%E4%BA%BA%E3%81%8A%E7%AC%91%E3%81%84%E5%A4%A7%E8%B3%9E'] },
  editionOf: editionCounter(1956), // 通し回数は未確認（ゲーム内の通算）。表示は年度（editionLabel）
  editionLabel: (y) => nendo(y),
  schedule: { entry: { from: [6, 1], to: [7, 5] }, final: [10, 8] },
  rounds: [
    { id: 'yosen', name: '予選', when: [[8, 4], [8, 8]], venues: ['東京', '大阪'], length: 240, pass: 8, field: 290, judge: 'staff', scoring: 'NHKの審査',
      run: stdRound({ kind: 'any', length: 240, pass: 8, field: 290, level: 56, beats: ['NHKの会議室を仕切った控室。ほかの局より、少しだけ静かだ。', '「NHKなので、商品名や企業名はネタに入れないでくださいね」とディレクター。', '予選会場には東京も大阪も、結成10年未満の若手がぎっしり。'] }) },
    { id: 'honsen', name: '本選（生放送）', when: [10, 8], length: 240, field: 8, judge: 'panel', judges: 5, scoring: '8組を2ブロックに抽選→各ブロック1位が決勝（ゲーム上：審査員5人×10点）', tv: true, final: true, run: nhkHonsen },
  ],
  eligibility: (g, unit, year) => {
    const u = unit || unitOf(g);
    return checkElig(g, u, year, { members: [1, null], pro: true, amateur: false, unitYearsLt: 10 });
  },
  eligibilityNote: '結成10年未満（ピン芸人は活動開始から10年未満）',
  fee: 0, feeNote: '参加費は未確認（ゲームでは無料扱い）',
  prize: 0, prizeText: '大賞（賞金は未確認）',
  perform: { kind: 'any', length: 240 },
  news: [
    (g, c) => `${nendo(c.year)} ${nameOf(NHK_OWARAI, c.year)}、予選に約300組。東京と大阪で開催`,
    (g, c) => (c.year < 1986 ? '新人漫才コンクール、今年も上方と東京の若手が火花' : c.year < 1991 ? '新人演芸コンクール、漫才・コント・落語の若手が一堂に' : c.year < 2014 ? '新人演芸大賞の演芸部門、今年はコント勢の健闘が目立つ' : '新人お笑い大賞、本選8組が決定'),
    '本選8組のブロック分け抽選会。「トップバッターは引きたくない」',
    '本選は大阪と東京で交互に開催。今年の会場は？',
    (g, c) => `本選はNHK総合で生放送。${deviceOf(c.year) === 'スマホ' ? '見逃し配信も' : '家族そろってテレビの前で'}`,
    'NHKのコンクールらしく、ネタに企業名・商品名はNG。言い換えの工夫も見どころ',
    '歴代の大賞には、のちの人気者がずらり。「登竜門」の名に偽りなし',
  ],
  beats: ['ブロック分けは抽選。4組ずつ、AブロックとBブロック。', '舞台袖の時計は秒単位。4分を過ぎると無情にも照明が落ちる。', 'NHKのスタジオは、拍手のタイミングまで丁寧に指示される。'],
  catchcopy: (g) => `${pickR(['公共放送に新星', '10年目までの全力', '登竜門をくぐれ'], rngFor(g, 'nhk-cc'))}　${unitName(g)}`,
};
async function nhkBlocks(g, ctx, o) {
  // o: { kind, length, n: 8, nJ: 5, max: 10, set, title, rakugo }
  const r = rngFor(g, ctx.id, 'blocks');
  const rvs = rivals(g, ctx, o.n - 1, { level: o.level || 66, kind: o.kind, rakugo: o.rakugo });
  const acts = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
  const blocks = [{ label: 'Aブロック', acts: acts.slice(0, o.n / 2) }, { label: 'Bブロック', acts: acts.slice(o.n / 2) }];
  return withBoard(g, boardSpec(ctx, o.title || '本選', { set: o.set || 'hall' }), async (b) => {
    b.set('groups', { groups: blocks.map((x) => ({ label: x.label, acts: x.acts.map((a) => ({ name: a.name, me: a.me })) })), label: 'ブロック分け抽選会' });
    await say(g, [`抽選の結果、${unitName(g)}は${blocks[0].acts.some((a) => a.me) ? 'Aブロック' : 'Bブロック'}。`, ...pickBeats(NHK_OWARAI.beats, r, 1)]);
    const skip = await omakase(g, ctx);
    let myScore = 0; let mine = null;
    for (const bl of blocks) {
      for (const a of bl.acts) {
        if (a.me) { b.set('stage', { caption: `${bl.label}　${unitName(g)}` }); a.score = (await perform(g, ctx, { kind: o.kind, length: o.length, skip, title: o.title, venue: { size: 'hall', crowd: 'warm', pressure: 75 } })).score; myScore = a.score; mine = bl; }
        else a.score = rivalScore(g, a, { kind: o.kind }, r);
      }
      const rows = panelScores(g, r, bl.acts, o.nJ, o.max);
      bl.winner = rows[0];
      await revealRanking(g, b, rows, `${bl.label}　審査員${o.nJ}人×${o.max}点`, { max: o.nJ * o.max, passLine: 1, unit: '点' });
      await say(g, `${bl.label}は${rows[0].name}が1位。`);
    }
    const fin = [blocks[0].winner, blocks[1].winner];
    const inFinal = fin.some((x) => x.me);
    if (inFinal) await say(g, '決勝進出！ 2組で大賞を争う。もう1本。');
    fin.forEach((a) => { a.fscore = a.me ? null : clamp(Math.round(a.score + gauss(r) * 6), 0, 100); });
    if (inFinal) { const me = fin.find((x) => x.me); me.fscore = (await perform(g, ctx, { kind: o.kind, length: o.length, skip, title: `${o.title} 決勝`, venue: { size: 'hall', crowd: 'warm', pressure: 85 } })).score; }
    const v = judgeVotes(r, fin.map((a) => ({ ...a, score: a.fscore })), o.nJ);
    const W = v[0] >= v[1] ? fin[0] : fin[1];
    b.set('match', { a: { name: fin[0].name, me: fin[0].me, score: v[0], win: W === fin[0] }, b: { name: fin[1].name, me: fin[1].me, score: v[1], win: W === fin[1] }, max: o.nJ, label: `決勝　審査員${o.nJ}人の投票` });
    await pause(g, 50);
    const champ = !!W.me;
    if (champ) { g.sfx('fanfare'); await say(g, `${o.award || '大賞'}は——${unitName(g)}！`); champion(g, ctx, o.award || '大賞'); }
    else await say(g, `${o.award || '大賞'}は${W.name}。${inFinal ? '決勝で惜しくも敗れた。' : `${mine ? mine.label : ''}で敗退。`}`);
    return { passed: champ, champion: champ, score: myScore, place: champ ? 1 : inFinal ? 2 : 5, field: o.n, award: champ ? (o.award || '大賞') : null };
  });
}
const nhkHonsen = (g, ctx) => nhkBlocks(g, ctx, { kind: defaultKind(g), length: 240, n: 8, nJ: 5, max: 10, set: 'hall', title: `${nameOf(NHK_OWARAI, ctx.year)} 本選`, award: '大賞', level: 66 });

// ============================================================== NHK新人落語大賞（← NHK新人演芸大賞 落語部門 ← NHK新人演芸コンクール）
// VERIFIED: 2014年から『NHK新人演芸大賞』の落語部門を改称; 対象＝入門15年未満（2017年報道）; 東京・大阪の予選（計125人の年）を経た
//   5人が本選、持ち時間11分; 審査員5人が1人10点・合計の高い人が大賞（過去の大会）; 2017年は NHK大阪で収録し11月4日NHK総合で放送;
//   2021年度・2022年度も開催（11月）。前身の落語単独コンクールの開始年は未確認のため、ゲームでは1986年（演芸コンクール落語部門）を起点。
// Sources: daily.co.jp/gossip/2017/10/23/0010670477.shtml, /2021/11/23/0014862783.shtml; oricon.co.jp/news/2098585;
//   number.bunshun.jp/articles/-/868052; dic.pixiv.net/a/NHK新人演芸大賞; d.hatena.ne.jp/keyword/NHK新人お笑い大賞
const NHK_RAKUGO = {
  name: 'NHK新人落語大賞', short: 'NHK落語', kind: 'rakugo', category: 'newcomer', color: '#8a2a2a',
  names: [{ from: 1986, name: 'NHK新人演芸コンクール（落語部門）' }, { from: 1991, name: 'NHK新人演芸大賞（落語部門）' }, { from: 2014, name: 'NHK新人落語大賞' }],
  organizer: 'NHK', broadcaster: 'NHK総合', venue: '本選：NHK大阪ホール／東京（年により）', region: 'all',
  history: { founded: 1986, ended: null, gaps: [], revived: null, note: '若手落語家の登竜門。持ち時間11分、5人の高座を審査員5人が10点満点で採点。',
    sources: ['https://www.daily.co.jp/gossip/2017/10/23/0010670477.shtml', 'https://www.daily.co.jp/gossip/2021/11/23/0014862783.shtml', 'https://www.oricon.co.jp/news/2098585/full/', 'https://number.bunshun.jp/articles/-/868052'] },
  editionOf: editionCounter(1986),
  editionLabel: (y) => nendo(y),
  schedule: { entry: { from: [6, 1], to: [7, 5] }, final: [11, 2] },
  rounds: [
    { id: 'yosen', name: '予選', when: [[9, 3], [9, 7]], venues: ['東京', '大阪'], length: 600, pass: 5, field: 125, judge: 'panel', scoring: 'NHKの審査（入門15年未満）',
      run: stdRound({ kind: 'rakugo', length: 600, pass: 5, field: 125, level: 58, set: 'kouza', beats: ['楽屋で着物をたたみ直す。帯をきゅっと締めると、背筋が伸びた。', '出囃子が鳴る。めくりに自分の名前。', '「まくらは短め、本題に時間を」——師匠の声が頭をよぎる。'] }) },
    { id: 'honsen', name: '本選（5人の高座）', when: [11, 2], length: 660, field: 5, judge: 'panel', judges: 5, scoring: '持ち時間11分・審査員5人×10点＝50点満点', tv: true, final: true, run: rakugoHonsen },
  ],
  eligibility: (g, unit, year) => {
    const u = unit || unitOf(g);
    const c = checkElig(g, u, year, { members: [1, 1], geirekiLt: 15 });
    return c.ok ? c : { ok: false, why: c.why + '（入門15年未満の落語家）' };
  },
  eligibilityNote: '入門15年未満の落語家（ピン）',
  fee: 0, prize: 0, prizeText: '大賞（賞金は未確認）', perform: { kind: 'rakugo', length: 660 },
  news: [
    (g, c) => `${nendo(c.year)} ${nameOf(NHK_RAKUGO, c.year)}、本選に進む5人が決定`,
    '持ち時間は11分。長講で知られる噺をどう刈り込むかが勝負',
    '審査員5人が10点満点で採点。満点の50点が出るか',
    (g, c) => `東西の若手が高座に。${c.year < 2014 ? '演芸大賞の落語部門' : '新人落語大賞'}は今年も注目`,
    '「まくら」で客席をつかみ、「サゲ」で鮮やかに締める——古典か新作か、選んだ演目にも注目',
    (g, c) => `本選の模様はNHK総合で放送。${deviceOf(c.year) === '手帳' ? '番組表に赤丸を' : '録画予約を忘れずに'}`,
  ],
  beats: ['出囃子が鳴り、めくりがめくられる。高座へ向かう廊下が長い。', '座布団に座り、扇子を前に置いて一礼。', '羽織を脱ぐのは、まくらが終わって本題に入った合図。', '11分。最後のサゲまで、時計は見ない。'],
  catchcopy: (g) => `${pickR(['高座の新星', '11分の一席', '東西若手の筆頭'], rngFor(g, 'rk-cc'))}　${unitName(g)}`,
};
async function rakugoHonsen(g, ctx) {
  const r = rngFor(g, ctx.id, 'rkh');
  const rvs = rivals(g, ctx, 4, { level: 68, kind: 'rakugo', rakugo: true });
  const order = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
  const js = judges(g, ctx, 5, ['落語家（真打）', '落語家（上方）', '演芸評論家', '放送作家', '講談師']);
  return withBoard(g, boardSpec(ctx, '本選　5人の高座', { set: 'kouza' }), async (b) => {
    b.set('stage', { mekuri: unitName(g) });
    await say(g, [`審査員は${js.map((j) => j.name).join('、')}。1人10点、50点満点。`, `出番は${order.findIndex((x) => x.me) + 1}番目。`]);
    for (const t of pickBeats(NHK_RAKUGO.beats, r, 3)) await say(g, t);
    const skip = await omakase(g, ctx, '高座');
    let my = 0;
    for (const a of order) a.score = a.me ? (my = (await perform(g, ctx, { kind: 'rakugo', length: 660, skip, title: 'NHK新人落語大賞 本選', venue: { size: 'hall', crowd: 'warm', pressure: 80 } })).score) : rivalScore(g, a, { kind: 'rakugo' }, r);
    const rows = panelScores(g, r, order, 5, 10);
    await revealRanking(g, b, rows, '審査員5人×10点', { max: 50, passLine: 1, unit: '点' });
    const champ = rows[0].me;
    const myRow = rows.find((x) => x.me);
    await say(g, `${unitName(g)}：${myRow.per.join('・')}　計${myRow.total}点${myRow.total === 50 ? '（満点！）' : ''}`);
    if (champ) { g.sfx('fanfare'); await say(g, `大賞は${unitName(g)}！ 楽屋で師匠に電話をかけると、「そうか」とだけ言って切れた。少し、声が震えていた。`); champion(g, ctx, '大賞'); }
    else await say(g, `大賞は${rows[0].name}（${rows[0].total}点）。`);
    return { passed: champ, champion: champ, score: my, place: rows.findIndex((x) => x.me) + 1, field: 5, award: champ ? '大賞' : null, detail: { points: myRow.total } };
  });
}

// ============================================================== NHK上方漫才コンテスト
// VERIFIED: NHK大阪放送局が1971年から開催（第54回＝2024年5月24日 NHK総合・関西向け生放送, NHK大阪のスタジオ）; 対象＝結成10年未満
//   （「10年以内」とする記事も）; 本選は8組（第51回 119組・第49回 132組の予選から）; 以前は例年2〜3月開催、近年は5〜6月;
//   2023年（第53回）はコント師が優勝。審査員数・賞金は未確認（ゲーム上：審査員5人）。関西拠点は大会の性格からの設定。
// Sources: natalie.mu/owarai/news/573513; walkerplus.com/article/179534; daily.co.jp/gossip/2023/06/09/0016455744.shtml;
//   tokyo-sports.co.jp/articles/-/78174; oricon.co.jp/news/2235315; ticketjam.jp/tickets/kamigata-contest
const NHK_KAMIGATA = {
  name: 'NHK上方漫才コンテスト', short: '上方漫コン', kind: 'any', category: 'kansai', color: '#2a6a9a',
  organizer: 'NHK大阪放送局', broadcaster: 'NHK総合（関西地域）', venue: 'NHK大阪放送局', region: 'osaka',
  history: { founded: 1971, ended: null, gaps: [], revived: null, note: 'NHK大阪が1971年から続ける関西若手の登竜門。本選8組を生放送。',
    sources: ['https://natalie.mu/owarai/news/573513', 'https://www.walkerplus.com/article/179534', 'https://www.daily.co.jp/gossip/2023/06/09/0016455744.shtml', 'https://www.tokyo-sports.co.jp/articles/-/78174'] },
  editionOf: editionCounter(1971),
  schedule: { entry: { from: [3, 1], to: [3, 10] }, final: [5, 8] },
  rounds: [
    { id: 'yosen', name: '予選', when: [4, 6], venues: ['大阪'], length: 240, pass: 8, field: 125, judge: 'staff', scoring: 'NHK大阪の審査',
      run: stdRound({ kind: 'any', length: 240, pass: 8, field: 125, level: 54, beats: ['NHK大阪のロビーから大阪城が見える。', '控室では、同期の芸人どうしがネタを小声で合わせている。', '「関西の新人の登竜門」——ポスターの文字が誇らしい。'] }) },
    { id: 'honsen', name: '本選（生放送）', when: [5, 8], length: 240, field: 8, judge: 'panel', judges: 5, scoring: '本選8組（ゲーム上：審査員5人×10点、上位が優勝・優秀賞）', tv: true, final: true, run: kamigataHonsen },
  ],
  eligibility: (g, unit, year) => checkElig(g, unit, year, { members: [1, null], unitYearsLt: 10, kansai: true }),
  eligibilityNote: '結成10年未満・関西を拠点に活動',
  fee: 0, prize: 0, prizeText: '優勝（賞金は未確認）', perform: { kind: 'any', length: 240 },
  news: [
    (g, c) => `${ordinal(c.edition)}NHK上方漫才コンテスト、本選8組が決定`,
    (g, c) => (c.year < 2015 ? '今年も年度末の上方漫才コンテスト。春から売れる若手はここから' : '本選はNHK総合・関西地域で生放送'),
    '予選にはおよそ120〜130組。関西の劇場を拠点にする若手が名を連ねる',
    '「漫才」コンテストだが、コント師の優勝例も。形式より“面白さ”',
    (g, c) => `歴代優勝者からは全国区の人気者が多数。${c.year >= 2000 ? '「ここを獲ったら次は全国」' : '「上方の若手は、まずここ」'}`,
    '本選の審査員席には、上方漫才の大ベテランが並ぶ',
  ],
  beats: ['NHK大阪のスタジオ。観覧のお客さんは関西のおばちゃんが多い。', 'リハーサルで照明の位置を確認する。センターマイクは1本。', '生放送の赤ランプが点いた。'],
  catchcopy: (g) => `${pickR(['浪花の新星', '上方の次世代', '関西の劇場育ち'], rngFor(g, 'kmc-cc'))}　${unitName(g)}`,
};
async function kamigataHonsen(g, ctx) {
  const r = rngFor(g, ctx.id, 'kh');
  const rvs = rivals(g, ctx, 7, { level: 64, kind: 'manzai' });
  const order = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
  return withBoard(g, boardSpec(ctx, '本選（生放送）', { set: 'studio' }), async (b) => {
    for (const t of pickBeats(NHK_KAMIGATA.beats, r, 2)) await say(g, t);
    const skip = await omakase(g, ctx);
    let my = 0;
    for (const a of order) a.score = a.me ? (my = (await perform(g, ctx, { kind: defaultKind(g), length: 240, skip, title: 'NHK上方漫才コンテスト 本選', venue: { size: 'tv', crowd: 'warm', pressure: 75 } })).score) : rivalScore(g, a, { kind: 'manzai' }, r);
    const rows = panelScores(g, r, order, 5, 10);
    rows.forEach((x, i) => { x.tag = i === 0 ? '優勝' : i < 3 ? '優秀賞' : ''; });
    await revealRanking(g, b, rows, '本選　審査結果', { max: 50, passLine: 1, unit: '点' });
    const place = rows.findIndex((x) => x.me) + 1;
    const champ = place === 1;
    if (champ) { g.sfx('fanfare'); await say(g, `${ordinal(ctx.edition)}NHK上方漫才コンテスト、優勝は${unitName(g)}！`); champion(g, ctx, '優勝'); }
    else if (place <= 3) { await say(g, `優秀賞！（${place}位）優勝は${rows[0].name}。`); addTitle(g, ctx.id, '優秀賞'); }
    else await say(g, `優勝は${rows[0].name}。${unitName(g)}は${place}位。`);
    return { passed: champ, champion: champ, score: my, place, field: 8, award: champ ? '優勝' : place <= 3 ? '優秀賞' : null };
  });
}

// ============================================================== 上方漫才大賞
// VERIFIED: 上方漫才の顕彰を目的に1966年ラジオ大阪が設立（漫才の賞で最も古い）; 1999年から関西テレビが主催に加わる; カンテレと
//   ラジオ大阪で同時生中継; 大賞・奨励賞・新人賞; 新人賞は結成10年目までの漫才師が対象で、その年度の活躍ぶりと当日のネタ披露で選出;
//   事前の審査会でノミネートを決め当日のネタで受賞者を選ぶ; 第52回＝2017年4月6日（カンテレ）, 第53回ノミネート発表 2018年3月;
//   第55回（2020年）はコロナで生放送中止・奨励賞と新人賞の選考も中止; 第60回＝2025年、第61回＝2026年。
//   ノミネート数は未確認（ゲーム上：新人賞5組・奨励賞4組）。
// Sources: tokyo-sports.co.jp/articles/-/340847; oricon.co.jp/news/2322671, 2230795; daily.co.jp/gossip/2017/04/06/0010072378.shtml;
//   natalie.mu/owarai/news/619860; owarai.yrzygs.com/showrace/kamigatamanzai (歴代一覧 第1回1966〜第61回2026)
const KAMIGATA_MANZAI = {
  name: '上方漫才大賞', short: '上方漫才大賞', kind: 'manzai', category: 'kansai', color: '#c83a5a',
  organizer: 'ラジオ大阪・関西テレビ（1999年〜）', broadcaster: 'カンテレ・ラジオ大阪（同時生中継）', venue: '発表会：大阪（カンテレほか）', region: 'osaka',
  history: { founded: 1966, ended: null, gaps: [], revived: null, note: '1966年ラジオ大阪設立、漫才の賞で最も古い。審査会でノミネート→発表会で奨励賞・新人賞の候補がネタを披露。',
    sources: ['https://www.tokyo-sports.co.jp/articles/-/340847', 'https://www.oricon.co.jp/news/2322671/full/', 'https://natalie.mu/owarai/news/619860', 'https://www.owarai.yrzygs.com/showrace/kamigatamanzai/'] },
  editionOf: editionCounter(1966),
  schedule: { entry: null, final: [4, 6] },
  selection: true,
  rounds: [
    { id: 'nominate', name: 'ノミネート（審査会）', when: [3, 5], judge: 'staff', scoring: 'その年度の活躍ぶりで候補を選ぶ', run: kmNominate },
    { id: 'happyou', name: '発表会（生中継）', when: [4, 6], length: 240, judge: 'panel', judges: 5, scoring: '奨励賞・新人賞の候補がネタ披露→審査', tv: true, final: true, run: kmHappyou },
  ],
  eligibility: (g, unit, year) => checkElig(g, unit, year, { members: [2, null] }),
  eligibilityNote: '上方（関西）で活躍する漫才師。新人賞は結成10年目まで。応募ではなく審査会のノミネート',
  fee: 0, prize: 0, prizeText: '大賞・奨励賞・新人賞', perform: { kind: 'manzai', length: 240 },
  news: [
    (g, c) => `${ordinal(c.edition)}上方漫才大賞、ノミネート発表。新人賞は結成10年目までの漫才師から`,
    (g, c) => `上方漫才大賞は${c.year - 1966 + 1}年目。漫才の賞として最も古い歴史`,
    (g, c) => (c.year >= 1999 ? '発表会はカンテレとラジオ大阪で同時生中継' : 'ラジオ大阪の生中継で発表。ラジオの前に耳を寄せる漫才ファン'),
    '奨励賞・新人賞の候補は当日ネタを披露。「その年の活躍」と「その日のネタ」で決まる',
    '大賞は今年もっとも上方漫才を沸かせた一組へ',
    (g, c) => (c.year === 2020 ? '新型コロナの影響で生放送は中止。奨励賞・新人賞の選考も見送りに' : `受賞者の記念ネタに${mediaOf(c.year)}も沸く`),
  ],
  beats: ['ノミネートの知らせはマネージャーから。「今年、上方漫才大賞の新人賞候補に入りました」', '発表会の楽屋には、ベテランから若手まで漫才師がずらり。', '受賞者の名前は、ネタが全部終わってから読み上げられる。'],
};
function kmTier(g, year) {
  const yrs = unitYears(g, year);
  const act = activityScore(g, year, ['m1', 'thesecond', 'themanzai', 'nhk_kamigata', 'ytv_manzai', 'kamigata_manzai', 'abcgp']);
  if (act >= 78 && yrs >= 10) return { tier: 'taisho', act };
  if (act >= 58) return { tier: 'shourei', act };
  if (yrs <= 10 && act >= 38) return { tier: 'shinjin', act };
  return { tier: null, act };
}
async function kmNominate(g, ctx) {
  const y = yearOf(g, ctx);
  const log = yearLog(g, ctx.id, y);
  const t = kmTier(g, y);
  log.tier = t.tier;
  const label = { taisho: '大賞', shourei: '奨励賞', shinjin: '新人賞' }[t.tier];
  return withBoard(g, boardSpec(ctx, 'ノミネート発表', { set: 'studio' }), async (b) => {
    b.set('award', { head: 'ノミネート', rows: [{ award: '大賞', name: '（審査会で選考）' }, { award: '奨励賞', name: '候補 数組' }, { award: '新人賞', name: '結成10年目までの候補' }], label: `今年度の活躍度 ${t.act}／100` });
    if (!t.tier) {
      await say(g, ['上方漫才大賞のノミネートに、名前はなかった。', `今年度の活躍度は${t.act}。関西の劇場、テレビ、賞レースでもっと結果を残したい。`]);
      return selResult(false, t.act, { note: 'ノミネートなし' });
    }
    g.sfx('chime');
    await say(g, [`マネージャー「上方漫才大賞の${label}にノミネートされました！」`, label === '大賞' ? '大賞は審査会の選考。当日は受賞者の発表を待つ。' : '発表会の生中継で、候補はネタを披露する。']);
    news(g, ctx, `${ordinal(ctx.edition)}上方漫才大賞 ${label}候補に${unitName(g)}`);
    return selResult(true, t.act, { note: `${label}ノミネート`, award: `${label}候補` });
  });
}
async function kmHappyou(g, ctx) {
  const y = yearOf(g, ctx);
  const tier = yearLog(g, ctx.id, y).tier || kmTier(g, y).tier;
  const r = rngFor(g, ctx.id, 'kmh');
  return withBoard(g, boardSpec(ctx, '発表会（カンテレ・ラジオ大阪 生中継）', { set: 'studio' }), async (b) => {
    if (y === 2020) {
      await say(g, ['この年は新型コロナの影響で生放送が中止になり、奨励賞・新人賞の選考も見送られた。', '大賞だけが発表された。']);
      return selResult(tier === 'taisho', 50, { note: '2020年：生放送中止', award: tier === 'taisho' ? '大賞' : null, champion: tier === 'taisho' });
    }
    const label = { taisho: '大賞', shourei: '奨励賞', shinjin: '新人賞' }[tier];
    if (tier === 'taisho') {
      b.set('award', { head: `${ordinal(ctx.edition)}上方漫才大賞`, rows: [{ award: '大賞', name: unitName(g), me: true }], label: '大賞' });
      g.sfx('fanfare');
      await say(g, [`「${ordinal(ctx.edition)}上方漫才大賞、大賞は——${unitName(g)}！」`, '受賞記念の漫才。客席の拍手が鳴りやまない。']);
      await perform(g, ctx, { kind: 'manzai', length: 240, skip: true, title: '大賞受賞記念漫才' });
      champion(g, ctx, '大賞');
      return selResult(true, 90, { champion: true, award: '大賞' });
    }
    const n = tier === 'shinjin' ? 5 : 4;
    const rvs = rivals(g, ctx, n - 1, { level: tier === 'shinjin' ? 60 : 70, kind: 'manzai' });
    const acts = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
    await say(g, [`${label}候補${n}組が、生中継でネタを披露する。`, ...pickBeats(KAMIGATA_MANZAI.beats, r, 1)]);
    const skip = await omakase(g, ctx);
    let my = 0;
    for (const a of acts) a.score = a.me ? (my = (await perform(g, ctx, { kind: 'manzai', length: 240, skip, title: `上方漫才大賞 ${label}候補`, venue: { size: 'tv', crowd: 'warm', pressure: 75 } })).score) : rivalScore(g, a, { kind: 'manzai' }, r);
    // その年度の活躍（ノミネート時の評価）も加味
    const act = activityScore(g, y, []);
    acts.forEach((a) => { a.score = Math.round(a.score * 0.8 + (a.me ? act : 50 + gauss(r) * 10) * 0.2); });
    const rows = panelScores(g, r, acts, 5, 10);
    b.set('award', { head: `${ordinal(ctx.edition)}上方漫才大賞`, rows: [{ award: '大賞', name: personName(r).split(' ')[0] + '・' + combiName(r) }, { award: label, name: rows[0].name, me: rows[0].me }], label: `${label}発表` });
    await pause(g, 50);
    const won = rows[0].me;
    if (won) { g.sfx('fanfare'); await say(g, `${label}は——${unitName(g)}！`); champion(g, ctx, label); }
    else await say(g, `${label}は${rows[0].name}。名前は呼ばれなかった。`);
    return selResult(won, my, { champion: won, award: won ? label : null, place: rows.findIndex((x) => x.me) + 1, field: n });
  });
}

// ============================================================== 上方お笑い大賞（読売テレビ, 1972〜2006）
// VERIFIED: 読売テレビ主催・制作、1972〜2006年度の35回で終了（芸のスタイルが多様化し大賞を1人に絞るのが難しくなったため）;
//   毎年年末; 大賞・金賞（のちに最優秀技能賞）・銀賞・功労賞・秋田實賞・審査員特別賞; 新人部門＝芸歴10年以内、本選で1位が最優秀新人賞・
//   ほかの本選出場5組に優秀新人賞（＝新人部門本選6組）; 2007・2008年度は『笑いの超新星 新人賞』として新人賞のみ継続、2012年に
//   ytv漫才新人賞が新設。
// REVIVAL: ended 2006 → from 2007 held as 「復刻開催」 (第36回〜). The real 2007–08 successor is mentioned in the news lines.
// Sources: weblio 上方お笑い大賞 (ja.wikipedia mirror); dic.pixiv.net/a/上方漫才大賞; owarai.yrzygs.com
const KAMIGATA_OWARAI = {
  name: '上方お笑い大賞', short: '上方お笑い', kind: 'any', category: 'kansai', color: '#d07a1a',
  organizer: '読売テレビ', broadcaster: '読売テレビ（年末特番）', venue: '大阪（読売テレビ）', region: 'osaka',
  history: { founded: 1972, ended: 2006, gaps: [], revived: null, note: '読売テレビが1972〜2006年度に35回開催した上方演芸の賞。2007〜08年度は「笑いの超新星 新人賞」、2012年からytv漫才新人賞。ゲームでは2007年以降も復刻開催。',
    sources: ['https://www.weblio.jp/content/%E4%B8%8A%E6%96%B9%E3%81%8A%E7%AC%91%E3%81%84%E5%A4%A7%E8%B3%9E', 'https://www.weblio.jp/wkpja/content/%E4%B8%8A%E6%96%B9%E3%81%8A%E7%AC%91%E3%81%84%E5%A4%A7%E8%B3%9E_%E4%B8%8A%E6%96%B9%E3%81%8A%E7%AC%91%E3%81%84%E5%A4%A7%E8%B3%9E%E3%81%AE%E6%A6%82%E8%A6%81'] },
  editionOf: editionCounter(1972),
  schedule: { entry: { from: [9, 1], to: [9, 10] }, final: [12, 6] },
  selection: true,
  rounds: [
    { id: 'shinjin_yosen', name: '新人部門 予選／各賞の選考', when: [10, 6], length: 240, pass: 6, field: 60, judge: 'staff', scoring: '芸歴10年以内は新人部門の予選（6組が本選）、それ以上は各賞の選考', run: koNominate },
    { id: 'honsen', name: '本選・発表（年末特番）', when: [12, 6], length: 240, field: 6, judge: 'panel', judges: 7, scoring: '新人部門本選6組→最優秀新人賞1・優秀新人賞5／大賞・金賞・銀賞は選考', tv: true, final: true, run: koHonsen },
  ],
  eligibility: () => ({ ok: true, why: '' }),
  eligibilityNote: '上方の大衆演芸（漫才・コント・落語・新喜劇…）。新人部門は芸歴10年以内',
  fee: 0, prize: 0, prizeText: '大賞・金賞・銀賞・最優秀新人賞ほか', perform: { kind: 'any', length: 240 },
  news: [
    (g, c) => `${c.revival ? '【復刻】' : ''}${ordinal(c.edition)}上方お笑い大賞、新人部門の本選6組が決定`,
    '大賞は“その年いちばん上方を笑わせた人”。漫才、落語、新喜劇から選ばれる',
    (g, c) => (c.year < 1990 ? '年の瀬の上方お笑い大賞。テレビの前で一年の笑いを振り返る' : '金賞・銀賞、そして最優秀新人賞。年末の読売テレビに上方の芸人が集う'),
    '新人部門は芸歴10年以内。本選に出れば全員が「優秀新人賞」、1位だけが最優秀',
    (g, c) => (c.revival ? '本家は2006年度で幕。2007・08年度は「笑いの超新星 新人賞」、2012年からはytv漫才新人賞へ' : '「大賞を1人に絞る」ことの難しさを審査員が語る'),
    '審査員特別賞の行方にも注目',
  ],
  beats: ['年末の読売テレビ。廊下に門松が飾られている。', '新人部門の控室は、緊張でだれも喋らない。', '大御所の楽屋から笑い声が漏れてくる。'],
};
async function koNominate(g, ctx) {
  const y = yearOf(g, ctx);
  const log = yearLog(g, ctx.id, y);
  if (geireki(g, y) <= 10) {
    log.track = 'shinjin';
    return stdRound({ kind: 'any', length: 240, pass: 6, field: 60, level: 56, head: '新人部門 予選　結果（6組が本選）', beats: KAMIGATA_OWARAI.beats })(g, ctx);
  }
  log.track = 'senior';
  const act = activityScore(g, y, ['kamigata_manzai', 'nhk_kamigata', 'm1', 'abcgp']);
  log.act = act;
  const tier = act >= 82 ? '大賞' : act >= 70 ? '金賞' : act >= 58 ? '銀賞' : null;
  log.tier = tier;
  await say(g, tier ? `上方お笑い大賞の選考会で、${unitName(g)}の名前が挙がっているらしい。` : `芸歴${geireki(g, y)}年。新人部門は卒業し、各賞の選考に名前は挙がらなかった。（活躍度${act}）`);
  return selResult(!!tier, act, { note: tier ? `${tier}の選考対象` : '選考外' });
}
async function koHonsen(g, ctx) {
  const y = yearOf(g, ctx);
  const log = yearLog(g, ctx.id, y);
  const r = rngFor(g, ctx.id, 'koh');
  return withBoard(g, boardSpec(ctx, '本選・発表（年末特番）', { set: 'studio' }), async (b) => {
    if (log.track === 'senior') {
      const tier = log.tier;
      b.set('award', { head: `${ordinal(ctx.edition)}上方お笑い大賞`, rows: [{ award: '大賞', name: tier === '大賞' ? unitName(g) : personName(r), me: tier === '大賞' }, { award: '金賞', name: tier === '金賞' ? unitName(g) : combiName(r), me: tier === '金賞' }, { award: '銀賞', name: tier === '銀賞' ? unitName(g) : combiName(r), me: tier === '銀賞' }], label: '各賞の発表' });
      g.sfx(tier ? 'fanfare' : 'chime');
      await say(g, tier ? `${tier}は——${unitName(g)}！ 一年の仕事が報われた。` : '今年の各賞に、名前はなかった。');
      if (tier) champion(g, ctx, tier);
      return selResult(!!tier, log.act || 50, { champion: tier === '大賞', award: tier });
    }
    const rvs = rivals(g, ctx, 5, { level: 62, kind: 'manzai' });
    const acts = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
    await say(g, ['新人部門の本選。6組が出て、1位が最優秀新人賞、ほかの5組には優秀新人賞が贈られる。', ...pickBeats(KAMIGATA_OWARAI.beats, r, 1)]);
    const skip = await omakase(g, ctx);
    let my = 0;
    for (const a of acts) a.score = a.me ? (my = (await perform(g, ctx, { kind: defaultKind(g), length: 240, skip, title: '上方お笑い大賞 新人部門本選', venue: { size: 'tv', crowd: 'warm', pressure: 75 } })).score) : rivalScore(g, a, { kind: 'manzai' }, r);
    const rows = panelScores(g, r, acts, 7, 10);
    rows.forEach((x, i) => { x.tag = i === 0 ? '最優秀新人賞' : '優秀新人賞'; });
    await revealRanking(g, b, rows, '新人部門 本選', { max: 70, passLine: 1, unit: '点' });
    const top = rows[0].me;
    if (top) { g.sfx('fanfare'); await say(g, `最優秀新人賞は${unitName(g)}！`); champion(g, ctx, '最優秀新人賞'); }
    else { await say(g, `最優秀新人賞は${rows[0].name}。${unitName(g)}には優秀新人賞。`); addTitle(g, ctx.id, '優秀新人賞'); }
    return selResult(top, my, { champion: top, award: top ? '最優秀新人賞' : '優秀新人賞', place: rows.findIndex((x) => x.me) + 1, field: 6 });
  });
}

// ============================================================== ytv漫才新人賞（決定戦）
// VERIFIED: 読売テレビ; 上方お笑い大賞の後継として2012年に新設（芸歴10年未満が対象）; 関西で活動し、メンバー全員が芸歴10年目以内
//   の漫才師; 年度内に“選考会”ROUNDが3回、各ROUNDの上位2組＋敗者のなかで最高点の1組（敗者復活枠）の計7組が年度末の“決定戦”へ;
//   ネタ3分、審査員4人の合計400点満点; 第15回決定戦＝2026年3月1日生放送（→ 第1回＝2012年）; 決定戦は2〜3月。
//   ゲームの暦は暦年なので、3回のROUNDは決定戦と同じ年の1〜2月に置く（本来は前年の年度内に分散）。
// Sources: weblio 上方お笑い大賞; natalie.mu/owarai/news/547933, 638050, 639644, 647975; oricon.co.jp/news/2439171, 2367821;
//   daily.co.jp/gossip/2021/02/08/0014064853.shtml
const YTV = {
  name: 'ytv漫才新人賞決定戦', short: 'ytv新人', kind: 'manzai', category: 'kansai', color: '#1a8a8a',
  organizer: '読売テレビ', broadcaster: '読売テレビ（決定戦を生放送）', venue: '読売テレビ（大阪）', region: 'osaka',
  history: { founded: 2012, ended: null, gaps: [], revived: null, note: '上方お笑い大賞の後継として2012年新設。3回の選考会ROUND→上位2組ずつ＋敗者復活1組の7組で決定戦。',
    sources: ['https://natalie.mu/owarai/news/639644', 'https://www.oricon.co.jp/news/2439171/full/', 'https://www.daily.co.jp/gossip/2021/02/08/0014064853.shtml'] },
  editionOf: editionCounter(2012),
  schedule: { entry: { from: [1, 1], to: [1, 3] }, final: [3, 1] },
  rounds: [
    { id: 'round1', name: 'ROUND1（選考会）', when: [1, 5], length: 180, pass: 2, field: 10, judge: 'panel', judges: 4, scoring: '3分・審査員4人×100点。上位2組が決定戦', chance: true, run: (g, ctx) => ytvRound(g, ctx, 1) },
    { id: 'round2', name: 'ROUND2（選考会）', when: [1, 9], length: 180, pass: 2, field: 10, judge: 'panel', judges: 4, scoring: '同上', chance: true, run: (g, ctx) => ytvRound(g, ctx, 2) },
    { id: 'round3', name: 'ROUND3（選考会）', when: [2, 5], length: 180, pass: 2, field: 10, judge: 'panel', judges: 4, scoring: '同上（敗者の最高得点1組は敗者復活）', chance: true, run: (g, ctx) => ytvRound(g, ctx, 3) },
    { id: 'kettei', name: '決定戦（生放送）', when: [3, 1], length: 180, field: 7, judge: 'panel', judges: 4, scoring: '7組・審査員4人×100点→上位3組の最終決戦（ゲーム上）', tv: true, final: true, run: ytvKettei },
  ],
  eligibility: (g, unit, year) => checkElig(g, unit, year, { members: [2, null], geirekiMax: 10, kansai: true }),
  eligibilityNote: '関西で活動する漫才師、メンバー全員が芸歴10年目以内',
  fee: 0, prize: 0, prizeText: '優勝（賞金は未確認）', perform: { kind: 'manzai', length: 180 },
  news: [
    (g, c) => `${ordinal(c.edition)}ytv漫才新人賞、ROUND1の結果発表。上位2組が決定戦へ`,
    '選考会は年に3回。どのROUNDでも上位2組に入れば決定戦',
    '敗者のなかの最高得点1組は「敗者復活枠」。最後まであきらめられない',
    '決定戦は7組、読売テレビで生放送',
    '審査員4人の400点満点。ネタ時間は3分',
    '関西の芸歴10年目以内の漫才師にとって、年度末の大一番',
  ],
  beats: ['読売テレビのロビーに、ROUNDの組み合わせが貼り出されている。', '3分は短い。ツカミで遅れたら取り返せない。', '同じ劇場の先輩が「決定戦で待ってるで」と肩をたたいた。'],
};
async function ytvRound(g, ctx, n) {
  const y = yearOf(g, ctx);
  const log = yearLog(g, ctx.id, y);
  if (log.qualified) {
    await say(g, `ROUND${log.qualified}で決定戦進出を決めている。ROUND${n}は出場しない。`);
    return { passed: true, score: 0, place: null, field: 10, skipped: true, note: '決定戦進出済み' };
  }
  return withBoard(g, boardSpec(ctx, `ROUND${n}（選考会）`, { set: 'studio' }), async (b) => {
    const r = rngFor(g, ctx.id, 'ytv', n);
    for (const t of pickBeats(YTV.beats, r, 1)) await say(g, t);
    const skip = await omakase(g, ctx);
    const res = await perform(g, ctx, { kind: 'manzai', length: 180, skip, title: `ytv漫才新人賞 ROUND${n}`, venue: { size: 'tv', crowd: 'normal', pressure: 65 } });
    const rvs = rivals(g, ctx, 9, { level: 60, kind: 'manzai', salt: 'r' + n });
    const acts = [{ name: unitName(g), me: true, score: res.score }, ...rvs.map((x) => ({ name: x.name, score: rivalScore(g, x, { kind: 'manzai' }, r) }))];
    const rows = panelScores(g, r, acts, 4, 100);
    await revealRanking(g, b, rows, `ROUND${n}　審査員4人×100点`, { max: 400, passLine: 2, unit: '点' });
    const place = rows.findIndex((x) => x.me) + 1;
    const total = rows[place - 1].total;
    log.best = Math.max(log.best || 0, total);
    if (place <= 2) {
      log.qualified = n;
      g.sfx('success');
      await say(g, `ROUND${n} ${place}位！ 決定戦進出！（${total}点）`);
      return { passed: true, score: res.score, place, field: 10, qualified: true };
    }
    await say(g, [`ROUND${n}は${place}位（${total}点）。上位2組に届かなかった。`, n < 3 ? `次のROUND${n + 1}でまた挑戦できる。` : '残るは敗者復活枠——全ROUNDの敗者のなかの最高得点1組。', `課題：${flawLines(g, 'manzai', res.score, r).join('／')}`]);
    // 選考会は3回のチャンス：上位2組でなくても次のROUNDへ進める
    return { passed: true, score: res.score, place, field: 10, qualified: false, note: '決定戦進出ならず（次のROUNDへ）' };
  });
}
async function ytvKettei(g, ctx) {
  const y = yearOf(g, ctx);
  const log = yearLog(g, ctx.id, y);
  const r = rngFor(g, ctx.id, 'kettei');
  if (!log.qualified) {
    // 敗者復活枠：敗者のなかの最高得点
    const bar = 300 + Math.round(gauss(r) * 14);
    if ((log.best || 0) >= bar) { await say(g, `敗者復活枠！ ROUNDでの${log.best}点が敗者の最高得点だった。決定戦へ！`); log.qualified = 'revival'; }
    else { await say(g, `敗者復活枠には届かなかった（${log.best || 0}点）。決定戦はテレビで見ることになった。`); return { passed: false, score: 0, place: null, field: 7, note: '決定戦進出ならず' }; }
  }
  const rvs = rivals(g, ctx, 6, { level: 68, kind: 'manzai' });
  const acts = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
  return withBoard(g, boardSpec(ctx, '決定戦（生放送）', { set: 'studio' }), async (b) => {
    b.set('card', { name: 'ytv漫才新人賞決定戦', edition: ordinal(ctx.edition), catch: '各ROUND上位2組＋敗者復活1組＝7組。審査員4人の400点満点。' });
    await say(g, '決定戦。7組が3分ずつ。');
    const skip = await omakase(g, ctx);
    let my = 0;
    for (const a of acts) a.score = a.me ? (my = (await perform(g, ctx, { kind: 'manzai', length: 180, skip, title: 'ytv漫才新人賞 決定戦', venue: { size: 'tv', crowd: 'normal', pressure: 80 } })).score) : rivalScore(g, a, { kind: 'manzai' }, r);
    const rows = panelScores(g, r, acts, 4, 100);
    await revealRanking(g, b, rows, '決定戦　1st（上位3組が最終決戦）', { max: 400, passLine: 3, unit: '点' });
    const top3 = rows.slice(0, 3);
    let champ = false;
    if (top3.some((x) => x.me)) {
      await say(g, '最終決戦！ 3組がもう1本。審査員の多数決で決まる。');
      for (const a of top3) a.score = a.me ? (await perform(g, ctx, { kind: 'manzai', length: 180, skip, title: 'ytv漫才新人賞 最終決戦', venue: { size: 'tv', crowd: 'normal', pressure: 88 } })).score : rivalScore(g, a, { kind: 'manzai' }, r);
    }
    const v = judgeVotes(r, top3, 4);
    const W = top3[v.indexOf(Math.max(...v))];
    b.set('groups', { groups: [{ label: '最終決戦', acts: top3.map((a, i) => ({ name: a.name, votes: v[i], me: a.me, win: a === W })) }], label: `優勝：${W.name}` });
    await pause(g, 40);
    champ = !!W.me;
    if (champ) { g.sfx('fanfare'); await say(g, `${ordinal(ctx.edition)}ytv漫才新人賞は${unitName(g)}！`); champion(g, ctx, '優勝'); } else await say(g, `優勝は${W.name}。`);
    return { passed: champ, champion: champ, score: my, place: champ ? 1 : rows.findIndex((x) => x.me) + 1, field: 7, award: champ ? '優勝' : null };
  });
}

// ============================================================== MBS新世代漫才アワード → MBS漫才アワード（毎日放送, 2003〜2013）
// VERIFIED: 毎日放送; 第1回 2003年（決勝8月31日）; 第2回までは関西地区の結成10年以下限定、のち芸歴の制限なし（第6回2008年は制限なし）;
//   高校生審査員（お笑いペーパーテストに合格した高校生、2008年の2次予選は200人が1〜3点で採点→決勝12組; 2010年は「高校生1000人が
//   審査」）; 第8回2010年（決勝8月）; 第9回2011年までが「MBS新世代漫才アワード」、第10回から「MBS漫才アワード」;
//   第11回（2013年11月4日）が最後、2014年4月に終了発表（MBSの賞レースは歌ネタ王決定戦に一本化）。
// REVIVAL: ended 2013 → from 2014 「復刻開催」 (第12回〜) under the later name.
// Sources: natalie.mu/owarai/news/36556, 36780; news.mynavi.jp/article/20080813-mbs2, 20100831-a013; oricon.co.jp/news/67039;
//   daily.co.jp/newsflash/gossip/2014/04/11/0006855438.shtml; weblio/wikiwand MBS漫才アワード; dorama.tank.jp/d/sinsedaima.html
const MBS = {
  name: 'MBS新世代漫才アワード', short: 'MBSアワード', kind: 'manzai', category: 'kansai', color: '#3a6ad8',
  names: [{ from: 2003, name: 'MBS新世代漫才アワード' }, { from: 2012, name: 'MBS漫才アワード' }],
  organizer: '毎日放送（MBS）', broadcaster: 'MBSテレビ', venue: '大阪（MBS）', region: 'osaka',
  history: { founded: 2003, ended: 2013, gaps: [], revived: null, note: '審査員は“お笑いペーパーテスト”に合格した高校生。2011年の第9回まで新世代漫才アワード、第10・11回はMBS漫才アワード。',
    sources: ['https://natalie.mu/owarai/news/36556', 'https://news.mynavi.jp/article/20080813-mbs2/', 'https://www.daily.co.jp/newsflash/gossip/2014/04/11/0006855438.shtml', 'https://www.wikiwand.com/ja/MBS%E6%BC%AB%E6%89%8D%E3%82%A2%E3%83%AF%E3%83%BC%E3%83%89'] },
  editionOf: editionCounter(2003),
  schedule: { entry: { from: [5, 1], to: [6, 5] }, final: [8, 9] },
  rounds: [
    { id: 'y1', name: '1次予選', when: [7, 3], venues: ['大阪'], length: 180, pass: 0.3, field: 300, judge: 'staff', scoring: 'MBSの審査',
      run: stdRound({ kind: 'manzai', length: 180, pass: 0.3, field: 300, level: 48, beats: ['MBSの会議室に、出番表が貼られている。', '控室で、高校生審査員の話題になった。「あいつら、ほんまに厳しいで」'] }) },
    { id: 'y2', name: '2次予選（高校生審査員）', when: [8, 2], length: 180, pass: 12, field: 60, judge: 'audience', judges: 200, scoring: '高校生審査員200人×1〜3点', run: (g, ctx) => mbsStudents(g, ctx, false) },
    { id: 'final', name: '決勝（高校生審査員）', when: [8, 9], length: 240, field: 12, judge: 'audience', judges: 300, scoring: '高校生審査員の採点（1〜3点）', tv: true, final: true, run: (g, ctx) => mbsStudents(g, ctx, true) },
  ],
  eligibility: (g, unit, year) => (year <= 2004 ? checkElig(g, unit, year, { members: [2, null], unitYearsMax: 10, kansai: true }) : checkElig(g, unit, year, { members: [2, null] })),
  eligibilityNote: '第1・2回は関西地区・結成10年以下、第3回から芸歴の制限なし',
  fee: 0, prize: 0, prizeText: '優勝（賞金は未確認）', perform: { kind: 'manzai', length: 240 },
  news: [
    (g, c) => `${c.revival ? '【復刻】' : ''}${ordinal(c.edition)}${nameOf(MBS, c.year)}、審査員は高校生`,
    '審査員の高校生は“お笑いペーパーテスト”の合格者。「笑いに厳しい高校生」が1〜3点で採点',
    (g, c) => `高校生審査員の感想が${c.year < 2006 ? '番組ホームページ' : mediaOf(c.year)}でも話題に`,
    '2次予選を勝ち抜いた12組が決勝へ',
    (g, c) => (c.year <= 2004 ? '出場は関西地区の結成10年以下に限定' : '芸歴の制限なし。ベテランも高校生の審査を受ける'),
    (g, c) => (c.revival ? '本家は2013年の第11回で終了し、MBSの賞レースは歌ネタ王決定戦へ。今年は復刻開催' : '「高校生にウケる漫才が、次の時代の漫才」——プロデューサーの言葉'),
  ],
  beats: ['客席の高校生審査員は、手元のボタンをぎゅっと握っている。', '「流行りの言葉を使えばウケる、なんて甘くない」——先輩の忠告。', '制服の客席。笑い声が、劇場のお客さんより少し高い。'],
};
async function mbsStudents(g, ctx, isFinal) {
  const r = rngFor(g, ctx.id, isFinal ? 'mf' : 'm2');
  const nJ = isFinal ? 300 : 200;
  return withBoard(g, boardSpec(ctx, isFinal ? '決勝' : '2次予選', { set: 'studio' }), async (b) => {
    for (const t of pickBeats(MBS.beats, r, 2)) await say(g, t);
    const skip = await omakase(g, ctx);
    const res = await perform(g, ctx, { kind: 'manzai', length: isFinal ? 240 : 180, skip, title: `${nameOf(MBS, ctx.year)} ${isFinal ? '決勝' : '2次予選'}`, venue: { size: isFinal ? 'tv' : 'theater', crowd: 'tough', pressure: isFinal ? 80 : 60 } });
    // 高校生は「新しさ」に厳しい：発想力の高い組が得をする（ゲーム上の傾向）
    const votes = audienceVotes(res.score, nJ, r, 17);
    b.set('votes', { n: 100, votes: votes.slice(0, 100), who: unitName(g), label: `高校生審査員${nJ}人の採点（画面は最初の100人）` });
    await pause(g, 70);
    const my = sumV(votes);
    const nAct = isFinal ? 11 : 11;
    const rvs = rivals(g, ctx, nAct, { level: isFinal ? 68 : 58, kind: 'manzai' });
    const rows = [{ name: unitName(g), me: true, total: my }, ...rvs.map((x) => ({ name: x.name, total: sumV(audienceVotes(rivalScore(g, x, { kind: 'manzai' }, r), nJ, r, 17)) }))].sort((a, c) => c.total - a.total);
    const place = rows.findIndex((x) => x.me) + 1;
    const passN = isFinal ? 1 : 3; // 12組の見本のうち上位3組 ≒ 60組中12組
    await revealRanking(g, b, rows, isFinal ? `決勝　高校生${nJ}人の合計` : `2次予選　高校生${nJ}人の合計`, { max: nJ * 3, passLine: passN, unit: '点' });
    if (isFinal) {
      const champ = place === 1;
      if (champ) { g.sfx('fanfare'); await say(g, `${nameOf(MBS, ctx.year)}、優勝は${unitName(g)}！ 高校生たちが総立ちだ。`); champion(g, ctx, '優勝'); } else await say(g, `優勝は${rows[0].name}。${unitName(g)}は${place}位（${my}点）。`);
      return { passed: champ, champion: champ, score: res.score, place, field: 12, award: champ ? '優勝' : null };
    }
    const st = { passed: place <= passN, rows, place, estPlace: Math.max(1, Math.round(((place - 0.5) / rows.length) * 60)), field: 60 };
    return finishRound(g, ctx, res, st, { kind: 'manzai', passText: () => `高校生審査員の合計${my}点。決勝12組に残った！` });
  });
}

export const D2A_DEFS = {
  thesecond: SECOND, doubleimpact: DOUBLE, themanzai: MANZAI, nhk_owarai: NHK_OWARAI, nhk_rakugo: NHK_RAKUGO,
  nhk_kamigata: NHK_KAMIGATA, kamigata_manzai: KAMIGATA_MANZAI, kamigata_owarai: KAMIGATA_OWARAI, ytv_manzai: YTV, mbs_manzai: MBS,
};
export function defineContestsA(register) {
  for (const [id, def] of Object.entries(D2A_DEFS)) register(id, def);
}
void deviceOf; void wareki; void dstate; void fame; void isKansai; void flawLines; void rakugoName;
