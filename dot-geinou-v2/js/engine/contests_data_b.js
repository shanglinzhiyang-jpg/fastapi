// 賞レースのデータ B (owner: D2a): 歌ネタ王決定戦, オールザッツ漫才, ツギクル芸人グランプリ, MXグランプリ, IPPONグランプリ,
// 人志松本のすべらない話, おもしろ荘, フットンダ王決定戦, AUN〜コンビ大喜利王決定戦〜, UNDER5 AWARD.
// Registered by contests_data.js (defineContestsB(registerContest)). All people fictional: a program title that contains a
// person's name (人志松本のすべらない話) is used only as the title — its host never appears; a fictional 進行役 runs it.
// Verification: web searches on 2026-10-24 (see each def); anything unverified is generic / marked ゲーム上の設定.

import {
  rngFor, gauss, shuffleR, pickR, clamp, nendo, deviceOf, mediaOf, ordinal, yearOf, yearLog, addTitle, dstate,
  unitOf, unitName, unitSize, geireki, fame, stat, power, isKansai, perform, rivals, judges, rivalScore, news, omakase, withBoard, pause,
  boardSpec, nameOf, stdRound, standing, finishRound, flawLines, audienceVotes, sumV, selResult, editionCounter, defaultKind, pickBeats,
  personName, combiName, playMinigame, hasMinigame, talkScenes, partnerLook, rid, rname, normalizeRuns,
} from './contests_data_lib.js';

const say = (g, t, o) => g.say(t, o);
const champion = (g, ctx, label, o = {}) => {
  addTitle(g, ctx.id, label);
  news(g, ctx, o.news || `【速報】${nameOf(ctx.def, yearOf(g, ctx))}${ctx.revival ? '（復刻開催）' : ''} ${label}は${unitName(g)}！`, 'result');
};
function panelRows(r, acts, nJ, max) {
  return acts.map((a) => {
    const per = [];
    for (let j = 0; j < nJ; j++) per.push(clamp(Math.round(max * (0.5 + 0.48 * (a.score + gauss(r) * 7) / 100)), Math.round(max * 0.3), max)); // judges' scale: ~64–98% (a 100点 judge rarely goes below 60)
    return { ...a, per, total: per.reduce((x, y) => x + y, 0) };
  }).sort((x, y) => y.total - x.total || (x.me ? -1 : 1));
}
async function showRows(g, b, rows, head, o = {}) {
  b.set('ranking', { rows: rows.map((x, i) => ({ name: x.name, score: x.total ?? x.score, me: x.me, place: i + 1, tag: x.tag || '' })), passLine: o.passLine, head, note: o.note || '', max: o.max || 100, unit: o.unit || '' });
  await pause(g, 50);
}
// an answer chosen by the player (ask) or, in おまかせ / g.auto, by the stats: answers [{ text, q (0..100) }]
async function chooseAnswer(g, prompt, answers, r, o = {}) {
  const shown = shuffleR(answers, r);
  // tests: g.auto.answerPolicy 'random' | 'best' | 'worst' picks like a player would (else the act's skill decides)
  const pol = g.auto && g.auto.answerPolicy;
  if (pol) { const so = shown.slice().sort((a, b) => b.q - a.q); return pol === 'best' ? so[0] : pol === 'worst' ? so[so.length - 1] : shown[Math.floor(Math.random() * shown.length)]; }
  if (g.auto || o.auto) {
    const skill = clamp((o.skill ?? 50) + gauss(r) * 15, 0, 100);
    const sorted = shown.slice().sort((a, b) => b.q - a.q);
    const idx = skill > 75 ? 0 : skill > 50 ? Math.min(1, sorted.length - 1) : skill > 30 ? Math.min(2, sorted.length - 1) : sorted.length - 1;
    return sorted[idx];
  }
  const i = await g.ask(prompt, shown.map((a) => a.text), { cancel: 0 });
  return shown[clamp(i, 0, shown.length - 1)];
}

// ============================================================== 歌ネタ王決定戦（MBS, 2013〜2021）
// VERIFIED: 毎日放送（MBSテレビ）主催で2013年に開始、第1回決勝 2013年5月18日; 2014年大会の決勝は「3日」MBSで（回文の歌ネタの
//   ピン芸人が優勝）; 2021年の『歌ネタ王決定戦2021 FINAL』（29日決勝）を最後に終了; 2021 FINALは決勝で3分の歌ネタ、審査員の合計
//   得点上位3組が最終ステージ、優勝賞金300万円; 審査員は1人100点（2018年頃、満点100点を付けた審査員の記事）。
//   予選の形式・出場資格（プロアマ）・決勝の組数・審査員数・決勝の月（2013年は5月、のちは夏）は未確認（ゲーム上：予選→準決勝→決勝
//   10組・審査員5人）。MBS漫才アワード終了時（2014年）、MBSの賞レースは歌ネタ王に一本化された。
// REVIVAL: ended 2021 → from 2022 「復刻開催」 (第10回〜).
// Sources: oricon.co.jp/news/2208491, 2284690; tokyo-sports.co.jp/articles/-/68390, -/95035; daily.co.jp/gossip/2018/08/20/0011560028.shtml,
//   daily.co.jp/newsflash/gossip/2014/04/11/0006855438.shtml; natalie.mu/owarai/tag/190
const UTA_ODAI = ['失恋した冷蔵庫の歌', 'ラップで読み上げる町内会のお知らせ', '演歌で歌う「確定申告」', '回文だけでできたラブソング', 'オペラで歌う「レジ袋いりますか」', 'ロックで叫ぶ「門限」'];
const UTANETA = {
  name: '歌ネタ王決定戦', short: '歌ネタ王', kind: 'utaneta', category: 'tv', color: '#d03a8a',
  names: [{ from: 2013, name: '歌ネタ王決定戦' }, { from: 2021, name: '歌ネタ王決定戦 FINAL' }, { from: 2022, name: '歌ネタ王決定戦' }], // D1 adds（復刻開催）
  organizer: '毎日放送（MBS）', broadcaster: 'MBSテレビ', venue: '大阪（MBS）', region: 'all',
  history: { founded: 2013, ended: 2021, gaps: [], revived: null, note: '笑いと音楽の融合を掲げたMBSの賞レース。3分の歌ネタで競う。',
    sources: ['https://www.oricon.co.jp/news/2208491/full/', 'https://www.tokyo-sports.co.jp/articles/-/68390', 'https://www.daily.co.jp/newsflash/gossip/2014/04/11/0006855438.shtml'] },
  // no editionOf: revival continues from 第9回 (2021 FINAL) +1 per held year (D1 counts held years)
  schedule: { entry: { from: [5, 1], to: [5, 10] }, final: [8, 9] },
  rounds: [
    { id: 'yosen', name: '予選', when: [[6, 4], [6, 8]], venues: ['大阪', '東京'], length: 120, pass: 0.25, field: 800, judge: 'staff', scoring: 'MBSの審査',
      run: stdRound({ kind: 'utaneta', length: 120, pass: 0.25, field: 800, level: 46, beats: ['控室でギターのチューニングをする音が、あちこちから聞こえる。', 'カラオケ音源のCD-Rを、音響さんに手渡した。', '歌ネタは“歌がうまい”だけでは勝てない。歌詞のボケが勝負。'] }) },
    { id: 'sf', name: '準決勝', when: [7, 6], venues: ['大阪'], length: 180, pass: 10, field: 60, judge: 'staff', scoring: '3分',
      run: stdRound({ kind: 'utaneta', length: 180, pass: 10, field: 60, level: 58, beats: ['準決勝。客席に音楽関係者らしき人の姿も。', '「サビで畳みかける構成にしよう」相方と最後の確認。'] }) },
    { id: 'final', name: '決勝', when: [8, 9], length: 180, field: 10, judge: 'panel', judges: 5, scoring: 'ファーストステージ3分→合計上位3組が最終ステージ', tv: true, final: true, run: utanetaFinal },
  ],
  eligibility: { members: [1, null], note: '歌ネタで勝負する芸人（人数は問わない）' }, // プロ・アマ: 未確認
  fee: 0, prize: 3000000, prizeText: '優勝賞金300万円（2021 FINAL）', perform: { kind: 'utaneta', length: 180 },
  news: [
    (g, c) => `${c.revival ? '【復刻】' : ''}『歌ネタ王決定戦${c.year}』決勝進出者が決定。笑いと音楽の融合`,
    '歌ネタは3分。サビで笑いを爆発させられるか',
    '審査員は1人100点。満点の100点が飛び出すか',
    '回文、演歌、ラップ、オペラ——ジャンルの幅広さもこの大会の名物',
    (g, c) => (c.year === 2021 ? '「FINAL」と銘打たれた大会。最後の歌ネタ王は誰の手に' : `歌ネタの動画が${mediaOf(c.year)}で拡散中`),
    '最終ステージに進めるのは、ファーストステージの合計点上位3組だけ',
    '優勝賞金は300万円',
  ],
  beats: ['照明が落ち、イントロが流れる。', '観客の手拍子が、ボケの前でぴたりと止まった。', '最後のロングトーン。審査員がペンを置いた。'],
};
async function utanetaFinal(g, ctx) {
  const r = rngFor(g, ctx.id, 'utaf');
  const rvs = rivals(g, ctx, 9, { level: 66, kind: 'utaneta' });
  const acts = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
  const js = judges(g, ctx, 5, ['歌手', 'ピン芸人', 'ミュージシャン', '漫才師', '音楽プロデューサー']);
  return withBoard(g, boardSpec(ctx, '決勝（生放送）', { set: 'live' }), async (b) => {
    b.set('card', { name: '歌ネタ王決定戦', edition: `${ordinal(ctx.edition)}　決勝${ctx.revival ? '（復刻開催）' : ''}`, catch: `ファーストステージは3分の歌ネタ。審査員${js.length}人×100点の合計上位3組が最終ステージへ。` });
    await say(g, [`今夜の審査員：${js.map((j) => j.name).join('、')}。`, `${unitName(g)}の歌ネタは「${pickR(UTA_ODAI, r)}」。`]);
    for (const t of pickBeats(UTANETA.beats, r, 2)) await say(g, t);
    const skip = await omakase(g, ctx);
    let my = 0;
    for (const a of acts) a.score = a.me ? (my = (await perform(g, ctx, { kind: 'utaneta', length: 180, skip, title: '歌ネタ王決定戦 決勝', venue: { size: 'tv', crowd: 'warm', pressure: 80 } })).score) : rivalScore(g, a, { kind: 'utaneta' }, r);
    const rows = panelRows(r, acts, js.length, 100);
    await showRows(g, b, rows, 'ファーストステージ（上位3組が最終ステージ）', { max: js.length * 100, passLine: 3, unit: '点' });
    const top = rows.slice(0, 3);
    if (top.some((x) => x.me)) {
      await say(g, '最終ステージ！ 2曲目の歌ネタ。');
      for (const a of top) a.score = a.me ? (await perform(g, ctx, { kind: 'utaneta', length: 180, skip, title: '歌ネタ王 最終ステージ', venue: { size: 'tv', crowd: 'warm', pressure: 90 } })).score : clamp(Math.round(a.score + gauss(r) * 6), 0, 100);
    }
    const fin = panelRows(r, top, js.length, 100);
    await showRows(g, b, fin, '最終ステージ', { max: js.length * 100, passLine: 1, unit: '点' });
    const champ = fin[0].me;
    if (champ) { g.sfx('fanfare'); await say(g, `${ctx.revival ? '復刻開催の' : ''}歌ネタ王は${unitName(g)}！`); champion(g, ctx, '優勝'); }
    else await say(g, `歌ネタ王は${fin[0].name}。`);
    return { passed: champ, champion: champ, score: my, place: champ ? 1 : top.some((x) => x.me) ? fin.findIndex((x) => x.me) + 1 : rows.findIndex((x) => x.me) + 1, field: 10, award: champ ? '優勝' : null };
  });
}

// ============================================================== オールザッツ漫才（MBS, 1990〜）
// VERIFIED: 毎日放送が1990年から放送する年末深夜の特別番組（第1回は12月8日＝7日深夜、以後は毎年12月29日深夜〜30日早朝）;
//   初期はネタバトルなし、1996年頃から若手がトーナメントでネタ対決; 過去の形式は1回戦26組→準決勝6組→決勝3組、1・2回戦は1分・
//   決勝は2分ネタ、得点はお客さん票175点＋芸人票25点＝200点満点; 2023年版は35組が1分ネタのトーナメント、観覧者と芸人のスイッチ
//   投票にX（旧Twitter）の投票を合算; 2025年は12月28・29日深夜に放送、決勝進出12組。賞金は未確認。
// Sources: dic.pixiv.net/a/オールザッツ漫才; weblio/wikiwand オールザッツ漫才 (ja.wikipedia mirror); ameblo.jp/korokoro17/entry-11437894981;
//   mbsp.co.jp/art/allthatscg; oricon.co.jp/news/2428042; natalie.mu/owarai/news/559001, 605439
const ALLTHATS = {
  name: 'オールザッツ漫才', short: 'ザッツ', kind: 'any', category: 'tv', color: '#e0a020',
  organizer: '毎日放送（MBS）', broadcaster: 'MBSテレビ（年末深夜の生放送）', venue: 'MBSのスタジオ（大阪）', region: 'osaka',
  history: { founded: 1990, ended: null, gaps: [], revived: null, note: '年末深夜、関西の若手が総出演する大型ネタ番組。',
    sources: ['https://dic.pixiv.net/a/%E3%82%AA%E3%83%BC%E3%83%AB%E3%82%B6%E3%83%83%E3%83%84%E6%BC%AB%E6%89%8D', 'https://www.wikiwand.com/ja/articles/%E3%82%AA%E3%83%BC%E3%83%AB%E3%82%B6%E3%83%83%E3%83%84%E6%BC%AB%E6%89%8D', 'https://www.oricon.co.jp/news/2428042/full/'] },
  editionOf: editionCounter(1990),
  labelStyle: 'year',
  schedule: { entry: null, final: [12, 9] },
  rounds: [
    // 出演オファー = D1's invitation (招待制, ~20 days before); the show itself is one round
    { id: 'live', name: '年末深夜の生放送', when: [12, 9], length: 60, field: 30, judge: 'vote', scoring: '1分ネタのトーナメント・お客さん票＋芸人票（2023年〜はネット投票も）', tv: true, final: true, run: allthatsLive },
  ],
  eligibility: { members: [1, null], region: 'osaka', invite: { fame: 60 }, repeat: true, note: '関西の若手中心（番組からのオファー）' },
  fee: 0, prize: 0, prizeText: '', perform: { kind: 'any', length: 60 },
  news: [
    (g, c) => `年末恒例『オールザッツ漫才${c.year}』出演者発表。関西の若手が深夜に大集合`,
    (g, c) => (c.year < 1996 ? '深夜の生放送、若手が次々とネタを披露。朝まで笑いっぱなし' : 'ネタバトルは1分ネタのトーナメント。勝ち上がれば決勝は2分'),
    (g, c) => (c.year >= 2023 ? '得点はお客さんと芸人のスイッチ投票に、ネット投票も合算' : '得点はお客さん票175点＋芸人票25点の200点満点'),
    '12月29日深夜、MBSのスタジオに芸人が入りきらない',
    (g, c) => `「ザッツで爆発した若手は年明けに売れる」——${mediaOf(c.year)}でも話題`,
    '番組の合間の企画コーナーも名物。スベった芸人の“駆け込み寺”も',
  ],
  beats: ['深夜0時を回った。スタジオの床にまで芸人が座り込んでいる。', '1分は短い。ツカミが即オチになるくらいがちょうどいい。', '先輩芸人がスイッチを握って、こっちを見てニヤニヤしている。'],
};
async function allthatsLive(g, ctx) {
  const y = yearOf(g, ctx);
  const r = rngFor(g, ctx.id, 'live');
  const kind = defaultKind(g);
  return withBoard(g, boardSpec(ctx, '年末深夜の生放送', { set: 'live' }), async (b) => {
    b.set('card', { name: 'オールザッツ漫才', edition: `${y}　12月29日深夜`, catch: y < 1996 ? '関西の若手が朝まで次々とネタを披露する年末の大型ネタ番組。' : '1分ネタのトーナメント「ネタバトル」。お客さん票と芸人票で勝ち上がる。' });
    for (const t of pickBeats(ALLTHATS.beats, r, 2)) await say(g, t);
    const skip = await omakase(g, ctx);
    if (y < 1996) {
      const res = await perform(g, ctx, { kind, length: 120, skip, title: 'オールザッツ漫才', venue: { size: 'tv', crowd: 'warm', pressure: 60 } });
      await say(g, res.score >= 60 ? '深夜のスタジオが沸いた。年明け、劇場の出番が増えそうだ。' : 'ちょっと空回り。でも、年末のお祭りに出られただけで一歩前進。');
      return { passed: true, score: res.score, place: null, field: 30, note: 'ネタ披露（ネタバトル導入前）' };
    }
    // 1回戦: 6組ずつのブロック（見本）→準決勝6組→決勝3組（ゲーム上の見せ方）
    const score200 = (s) => { const a = clamp(Math.round((s + gauss(r) * 8) * 1.75), 0, 175); const c = clamp(Math.round((s + gauss(r) * 12) / 4), 0, 25); return { a, c, total: a + c }; };
    const res1 = await perform(g, ctx, { kind, length: 60, skip, title: 'ネタバトル 1回戦（1分）', venue: { size: 'tv', crowd: 'warm', pressure: 65 } });
    const blk = rivals(g, ctx, 5, { level: 55, kind });
    const rows1 = [{ name: unitName(g), me: true, ...score200(res1.score) }, ...blk.map((x) => ({ name: x.name, ...score200(rivalScore(g, x, { kind }, r)) }))].sort((p, q) => q.total - p.total);
    await showRows(g, b, rows1.map((x) => ({ ...x, tag: `客${x.a}＋芸人${x.c}` })), `ネタバトル1回戦（200点満点${y >= 2023 ? '＋ネット投票' : ''}）`, { max: 200, passLine: 1, unit: '点' });
    if (!rows1[0].me) {
      await say(g, [`1回戦敗退。勝ち上がったのは${rows1[0].name}。`, `敗因：${flawLines(g, kind, res1.score, r)[0]}`]);
      return { passed: false, score: res1.score, place: 7 + Math.floor(r() * 20), field: 30, note: 'ネタバトル1回戦敗退' };
    }
    await say(g, '1回戦突破！ 準決勝へ。');
    const res2 = await perform(g, ctx, { kind, length: 60, skip, title: 'ネタバトル 準決勝（1分）', venue: { size: 'tv', crowd: 'warm', pressure: 75 } });
    const sf = rivals(g, ctx, 5, { level: 64, kind, salt: 'sf' });
    const rows2 = [{ name: unitName(g), me: true, ...score200(res2.score) }, ...sf.map((x) => ({ name: x.name, ...score200(rivalScore(g, x, { kind }, r)) }))].sort((p, q) => q.total - p.total);
    await showRows(g, b, rows2, '準決勝（上位3組が決勝）', { max: 200, passLine: 3, unit: '点' });
    const p2 = rows2.findIndex((x) => x.me) + 1;
    if (p2 > 3) { await say(g, `準決勝${p2}位で敗退。それでも、深夜のテレビで2本ネタができた。`); return { passed: false, score: res2.score, place: 4 + p2, field: 30, note: '準決勝敗退' }; }
    await say(g, '決勝進出！ 決勝は2分ネタ。');
    const res3 = await perform(g, ctx, { kind, length: 120, skip, title: 'ネタバトル 決勝（2分）', venue: { size: 'tv', crowd: 'warm', pressure: 85 } });
    const fin = rows2.slice(0, 3).map((x) => (x.me ? { name: x.name, me: true, ...score200(res3.score) } : { name: x.name, ...score200(clamp(Math.round(x.total / 2 + gauss(r) * 6), 0, 100)) })).sort((p, q) => q.total - p.total);
    await showRows(g, b, fin, '決勝', { max: 200, passLine: 1, unit: '点' });
    const champ = fin[0].me;
    if (champ) { g.sfx('fanfare'); await say(g, `${y}年のオールザッツ、ネタバトル優勝は${unitName(g)}！ 外はもう明るくなりかけていた。`); champion(g, ctx, 'ネタバトル優勝'); }
    else await say(g, `ネタバトル優勝は${fin[0].name}。`);
    return { passed: champ, champion: champ, score: res3.score, place: fin.findIndex((x) => x.me) + 1, field: 30, award: champ ? 'ネタバトル優勝' : null };
  });
}

// ============================================================== ツギクル芸人グランプリ（フジテレビ×日本音楽事業者協会）
// VERIFIED: 日本音楽事業者協会（音事協）とフジテレビが組んで年1回開催、音事協加盟プロダクションの芸人が対象; 条件「地上波の
//   ゴールデン・プライム帯の番組レギュラーを持っていない芸人」; 第1回2019年（王者はプロダクション人力舎所属のコンビ）、2024年は5代目、
//   2026年は7回目（→ 2020年は開催なし）; 2026年は5月の予選会90組→準決勝30組→決勝15組、決勝はブロック戦→勝ち抜いた3組の決勝
//   （2026年8月1日「ENGEI8 笑いの夏祭り」の生放送で開幕）; 2021年は決勝投票の半数を民放キー5局のバラエティ担当スタッフ、
//   ファーストステージ3分・ファイナルステージ4分; 審査は審査員長＋民放5局の現役クリエイター5人; 賞金200万円と民放5局の人気10番組
//   への出演権（2024・2026年）。参加費は未確認。
// Sources: news.mynavi.jp/article/20210917-tsugikuru, 20230617-tsugikuru, 20260705-4663618, 20260730-4754946; natalie.mu/owarai/news/531485,
//   445031; daily.co.jp/gossip/2024/06/30/0017827807.shtml; oricon.co.jp/news/2471470; excite.co.jp SportsHochi_20260801
const TSUGIKURU = {
  name: 'ツギクル芸人グランプリ', short: 'ツギクル', kind: 'any', category: 'tv', color: '#2aa08a',
  organizer: 'フジテレビ・日本音楽事業者協会', broadcaster: 'フジテレビ', venue: 'フジテレビ（決勝生放送）', region: 'all',
  history: { founded: 2019, ended: null, gaps: [[2020, 2020]], revived: null, note: '音事協とフジテレビの“次に来る芸人”発掘大会。民放5局のクリエイターが審査し、優勝者は5局の番組に出演する。',
    sources: ['https://news.mynavi.jp/article/20210917-tsugikuru', 'https://natalie.mu/owarai/news/531485', 'https://www.daily.co.jp/gossip/2024/06/30/0017827807.shtml', 'https://www.oricon.co.jp/news/2471470/full/'] },
  editionOf: editionCounter(2019, null, [[2020, 2020]]),
  schedule: { entry: { from: [4, 1], to: [4, 8] }, final: [7, 8] },
  rounds: [
    { id: 'yosen', name: '予選会', when: [5, 5], venues: ['東京'], length: 180, pass: 30, field: 90, judge: 'staff', scoring: '90組→30組',
      run: (g, ctx) => tsugikuruGate(g, ctx) },
    { id: 'sf', name: '準決勝', when: [6, 5], length: 180, pass: 15, field: 30, judge: 'panel', scoring: '30組→15組（決勝）',
      run: stdRound({ kind: 'any', length: 180, pass: 15, field: 30, level: 60, beats: ['客席の最後列に、他局のプロデューサーらしき人が座っている。', '「ここで決勝に残れば、5局のスタッフにネタを見てもらえる」'] }) },
    { id: 'final', name: '決勝（生放送）', when: [7, 8], length: 180, field: 15, judge: 'panel', judges: 6, scoring: 'ブロック戦（3分）→3組のファイナルステージ（4分）・審査員長＋民放5局のクリエイター', tv: true, final: true, run: tsugikuruFinal },
  ],
  eligibility: { members: [1, null], pro: true, amateur: false, note: '音事協加盟プロダクション所属／地上波ゴールデン・プライム帯のレギュラー番組がない芸人' },
  fee: 0, prize: 2000000, prizeText: '賞金200万円＋民放5局の人気10番組への出演権', perform: { kind: 'any', length: 180 },
  news: [
    (g, c) => `『ツギクル芸人グランプリ${c.year}』予選会に約90組。“次に来る芸人”は誰だ`,
    '出場条件は「ゴールデン・プライム帯のレギュラーがないこと」。売れる直前の芸人たちの大会',
    '審査は民放5局のバラエティ制作者。優勝すれば5局の人気番組に出演できる',
    '決勝はブロック戦。勝ち抜いた3組がファイナルステージで4分ネタ',
    (g, c) => `優勝賞金200万円。${mediaOf(c.year)}では「来年のテレビの顔ぶれが決まる」の声`,
    '審査員長は芸歴の長いベテラン漫才師。各局の代表と並んで審査',
  ],
  beats: ['決勝の審査員席には、日テレ・テレ朝・TBS・テレ東・フジの名札が並ぶ。', '「テレビで使いやすいか」も見られている——マネージャーの言葉。', '楽屋のモニターに、ほかのブロックの点数が映る。'],
};
async function tsugikuruGate(g, ctx) {
  // 条件：ゴールデン・プライム帯のレギュラーがない（life.js の regulars を見て判定。なければ知名度で代用）
  const st = g.state || {};
  const regs = Array.isArray(st.regulars) ? st.regulars : st.regulars && typeof st.regulars === 'object' ? Object.keys(st.regulars) : [];
  if (regs.length >= 2 || fame(g) >= 7000) {
    await say(g, ['受付で書類を確認された。', '「ゴールデン・プライム帯のレギュラーをお持ちの方は、出場できない規定です」——もう“次に来る”側ではないらしい。']);
    return { passed: false, score: 0, place: null, field: 90, note: '出場資格なし（レギュラーあり）' };
  }
  return stdRound({ kind: 'any', length: 180, pass: 30, field: 90, level: 52, beats: ['予選会は90組。全員が事務所の名前を背負っている。', 'エントリーシートの「テレビ出演歴」欄に、少しだけ書けることが増えた。'] })(g, ctx);
}
async function tsugikuruFinal(g, ctx) {
  const r = rngFor(g, ctx.id, 'tf');
  const kind = defaultKind(g);
  const rvs = rivals(g, ctx, 14, { level: 66, kind });
  const acts = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
  const js = [{ name: personName(r), title: '審査員長（漫才師）' }, ...['日本テレビ', 'テレビ朝日', 'TBS', 'テレビ東京', 'フジテレビ'].map((k) => ({ name: personName(r), title: `${k} バラエティ制作` }))];
  return withBoard(g, boardSpec(ctx, '決勝（生放送）', { set: 'studio' }), async (b) => {
    b.set('card', { name: 'ツギクル芸人グランプリ', edition: `${ordinal(ctx.edition)}　決勝`, catch: `15組が3ブロックで対決。審査は${js[0].name}（審査員長）と民放5局のクリエイター。` });
    await say(g, js.slice(1).map((j) => `${j.title}・${j.name}`).join('／'));
    const blocks = [acts.slice(0, 5), acts.slice(5, 10), acts.slice(10, 15)];
    const skip = await omakase(g, ctx);
    let my = 0; const winners = [];
    for (let i = 0; i < 3; i++) {
      for (const a of blocks[i]) a.score = a.me ? (my = (await perform(g, ctx, { kind, length: 180, skip, title: `ツギクル 決勝 ${'ABC'[i]}ブロック`, venue: { size: 'tv', crowd: 'normal', pressure: 80 } })).score) : rivalScore(g, a, { kind }, r);
      const rows = panelRows(r, blocks[i], 6, 10);
      winners.push(rows[0]);
      await showRows(g, b, rows, `${'ABC'[i]}ブロック（審査員6人×10点）`, { max: 60, passLine: 1, unit: '点' });
    }
    const inFinal = winners.some((x) => x.me);
    if (inFinal) await say(g, 'ブロック1位！ ファイナルステージは4分ネタ。');
    for (const a of winners) a.score = a.me ? (await perform(g, ctx, { kind, length: 240, skip, title: 'ツギクル ファイナルステージ', venue: { size: 'tv', crowd: 'normal', pressure: 88 } })).score : clamp(Math.round(a.score + gauss(r) * 6), 0, 100);
    const fin = panelRows(r, winners, 6, 10);
    await showRows(g, b, fin, 'ファイナルステージ', { max: 60, passLine: 1, unit: '点' });
    const champ = fin[0].me;
    if (champ) {
      g.sfx('fanfare');
      await say(g, [`ツギクル芸人グランプリ優勝は${unitName(g)}！`, '賞金200万円と、民放5局の人気番組への出演権。マネージャーの電話が鳴りやまない。']);
      champion(g, ctx, '優勝');
      news(g, ctx, `ツギクル王者・${unitName(g)}、民放5局の番組に続々出演へ`);
    } else await say(g, `優勝は${fin[0].name}。`);
    return { passed: champ, champion: champ, score: my, place: champ ? 1 : inFinal ? 2 : 4, field: 15, award: champ ? '優勝' : null };
  });
}

// ============================================================== MXグランプリ（TOKYO MX）
// VERIFIED: TOKYO MX の賞レース; 芸人やマネージャーが推薦する“型破り”な芸人が尖ったネタと個性で競う; 第1回2025年（当初『MX-1グランプリ』
//   と報じられた、低予算ぶり＝ステージ下にゴミ・審査員が野ざらし…が話題、2025年4月の記事）; 決勝5組（敗者復活の「勝ち上がり
//   ステージ」からの組を含む）、ネタ順をイス取りゲームで決めた; 第2回『MXグランプリ2026〜異端芸人決定戦〜』準決勝Bブロック8月2日放送、
//   決勝9月6日生放送。賞金額は審査員のコメントでの言及のみ（公式規定は未確認）なので表示しない。
// Sources: daily.co.jp/gossip/2025/04/28/0018923768.shtml; natalie.mu/owarai/news/676412; zaikei.co.jp/releases/3529194;
//   prtimes.jp (TOKYO MX releases 000000198/180/212.000122205); bunshun.jp/articles/-/80471
const MXGP = {
  name: 'MXグランプリ', short: 'MXGP', kind: 'any', category: 'tv', color: '#7a3ad0',
  names: [{ from: 2025, name: 'MXグランプリ' }, { from: 2026, name: 'MXグランプリ〜異端芸人決定戦〜' }],
  organizer: 'TOKYO MX', broadcaster: 'TOKYO MX', venue: 'TOKYO MX の特設ステージ', region: 'tokyo',
  history: { founded: 2025, ended: null, gaps: [], revived: null, note: '推薦された“異端”芸人の賞レース。ネタ順はイス取りゲーム、低予算も名物。',
    sources: ['https://www.daily.co.jp/gossip/2025/04/28/0018923768.shtml', 'https://natalie.mu/owarai/news/676412', 'https://zaikei.co.jp/releases/3529194/'] },
  editionOf: editionCounter(2025),
  labelStyle: 'year',
  schedule: { entry: null, final: [9, 6] },
  rounds: [
    // 推薦（芸人・マネージャー）= D1's invitation; the 異端度 (キャラ＋発想) weighs in the judging
    { id: 'sf', name: '準決勝（A・Bブロック）', when: [8, 2], length: 180, pass: 4, field: 16, judge: 'panel', scoring: 'A・Bブロックごとの審査', run: mxSemi },
    { id: 'final', name: '決勝（生放送）', when: [9, 6], length: 180, field: 5, judge: 'panel', judges: 5, scoring: 'イス取りゲームでネタ順→5組（勝ち上がりステージの1組を含む）', tv: true, final: true, kachiagari: true, run: mxFinal },
  ],
  eligibility: { members: [1, null], invite: { fame: 30 }, note: '芸人・マネージャーの推薦制（“型破り”“異端”な芸人）' },
  fee: 0, prize: 0, prizeText: '', // 賞金額: a judge's remark only → not shown perform: { kind: 'any', length: 180 },
  news: [
    (g, c) => `『${nameOf(MXGP, c.year)}${c.year}』出場者発表。推薦された“異端”芸人がずらり`,
    '「ステージ下にゴミ」「審査員が野ざらし」——第1回の低予算ぶりが逆に話題に',
    'ネタ順はイス取りゲームで決定。座れなかった芸人から出番が回ってくる',
    '準決勝はA・Bブロック。尖りすぎたネタに審査員も困惑',
    '敗者復活の「勝ち上がりステージ」から1組が決勝へ',
    (g, c) => `決勝は生放送。${mediaOf(c.year)}では「地上波でいいのか」の声も`,
  ],
  beats: ['ベニヤ板のステージ。照明は、どう見ても工事現場のライトだ。', '審査員席はパイプ椅子。屋根がない。', '「普通のネタはいらない」とスタッフに念を押された。'],
};
const ishin = (g) => Math.round((stat(g, 'chara') + stat(g, 'hassou')) / 2); // 異端度（キャラ・華＋発想力）
async function mxSemi(g, ctx) {
  const log = yearLog(g, ctx.id, yearOf(g, ctx));
  const run = stdRound({ kind: 'any', length: 180, pass: 4, field: 16, level: 58, set: 'cheap', head: '準決勝（上位が決勝へ）', beats: MXGP.beats,
    failText: () => '準決勝敗退……だが「勝ち上がりステージ」が決勝当日にある！' });
  const res = await run(g, ctx);
  log.semi = !!res.passed;
  // 敗退しても決勝当日の「勝ち上がりステージ」（敗者復活）に回れる
  return { ...res, passed: true, qualified: !!res.passed, note: res.passed ? '決勝進出' : '勝ち上がりステージへ' };
}
async function mxFinal(g, ctx) {
  const y = yearOf(g, ctx);
  const log = yearLog(g, ctx.id, y);
  const r = rngFor(g, ctx.id, 'mxf');
  const kind = defaultKind(g);
  return withBoard(g, boardSpec(ctx, '決勝（生放送）', { set: 'cheap' }), async (b) => {
    if (log.semi === false) {
      b.set('stage', { caption: '勝ち上がりステージ（敗者復活）' });
      await say(g, '決勝の前に「勝ち上がりステージ」。準決勝の敗者から1組だけ決勝へ。');
      const res = await perform(g, ctx, { kind, length: 120, skip: false, title: '勝ち上がりステージ', venue: { size: 'small', crowd: 'tough', pressure: 70 } });
      const rv = rivals(g, ctx, 5, { level: 58, kind, salt: 'kachi' });
      const st = standing(g, ctx, res.score, rv, { kind, pass: 1, field: 6 });
      b.set('ranking', { rows: st.rows, passLine: 1, head: '勝ち上がりステージ（1組のみ）' });
      await pause(g, 40);
      if (!st.passed) { await say(g, `勝ち上がったのは${st.rows[0].name}。今年のMXグランプリはここまで。`); return { passed: false, score: res.score, place: null, field: 5, note: '勝ち上がりステージ敗退' }; }
      await say(g, '勝ち上がりステージ突破！ 決勝へ！');
    }
    const rvs = rivals(g, ctx, 4, { level: 64, kind });
    const ppl = shuffleR([{ name: unitName(g), me: true }, ...rvs.map((x) => ({ name: x.name }))], r);
    // イス取りゲーム：5人に4脚。座れなかった人から順にネタ（ゲーム上の解釈：座った順に後ろの出番を取れる）
    b.set('chairs', { chairs: 4, people: ppl.map((p) => ({ name: p.name, me: p.me })), music: true, label: 'ネタ順はイス取りゲームで決める！ 音楽が止まったら座れ！' });
    await say(g, ['司会「ネタ順は……イス取りゲームで決めます！」', '音楽が流れる。イスは4脚、芸人は5組。']);
    await pause(g, 60);
    let speed;
    if (g.auto) speed = clamp(stat(g, 'adlib') + gauss(r) * 20, 0, 100);
    else {
      const i = await g.ask('音楽が止まった！', ['すぐ座る！', '様子を見る', 'あえて座らない（トップバッターでいく）'], { cancel: 0 });
      speed = i === 0 ? clamp(60 + gauss(r) * 25, 0, 100) : i === 1 ? clamp(40 + gauss(r) * 20, 0, 100) : -1;
    }
    const others = ppl.filter((p) => !p.me).map((p) => ({ p, v: 50 + gauss(r) * 25 }));
    const all = [...others, { p: ppl.find((p) => p.me), v: speed }].sort((a, c) => c.v - a.v);
    all.forEach((x, i) => { x.p.seat = i < 4 ? i : null; });
    const order = all.slice().reverse().map((x) => x.p); // 座れなかった人がトップ、最初に座った人がトリ
    b.set('chairs', { chairs: 4, people: ppl.map((p) => ({ name: p.name, me: p.me, seat: p.seat })), music: false, label: `ネタ順：${order.map((p, i) => `${i + 1}.${p.name}`).join(' ')}` });
    const myOrder = order.findIndex((p) => p.me) + 1;
    await say(g, myOrder === 1 ? '座れなかった……トップバッターだ。' : `${myOrder}番目の出番。${myOrder === 5 ? 'トリだ！' : ''}`);
    for (const t of pickBeats(MXGP.beats, r, 1)) await say(g, t);
    const skip = await omakase(g, ctx);
    let my = 0;
    const acts = order.map((p) => ({ name: p.name, me: p.me }));
    for (const [i, a] of acts.entries()) {
      const s = a.me ? (my = (await perform(g, ctx, { kind, length: 180, skip, title: 'MXグランプリ 決勝', venue: { size: 'tv', crowd: 'tough', pressure: 80 } })).score) : rivalScore(g, rvs.find((x) => x.name === a.name) || { power: 62 }, { kind }, r);
      a.score = clamp(s + (i === 0 ? -3 : i === 4 ? 2 : 0), 0, 100); // 出番順の有利不利
    }
    // 異端の大会：尖り（異端度）も評価
    acts.forEach((a) => { if (a.me) a.score = Math.round(a.score * 0.85 + ishin(g) * 0.15); });
    const rows = panelRows(r, acts, 5, 10);
    await showRows(g, b, rows, '決勝　審査員5人×10点', { max: 50, passLine: 1, unit: '点' });
    const champ = rows[0].me;
    if (champ) { g.sfx('fanfare'); await say(g, `${y}年のMXグランプリ王者は${unitName(g)}！ トロフィーは……段ボール製だった。`); champion(g, ctx, '優勝'); }
    else await say(g, `優勝は${rows[0].name}。`);
    return { passed: champ, champion: champ, score: my, place: rows.findIndex((x) => x.me) + 1, field: 5, award: champ ? '優勝' : null };
  });
}

// ============================================================== IPPONグランプリ（フジテレビ, 2009〜）
// VERIFIED: フジテレビ、2009年12月28日から不定期放送（第29回＝2024年2月3日）; 大喜利の得意な芸能人10人が2ブロック（5人ずつ）;
//   予選はAブロックの回答をBブロックの出場者が採点（逆も同じ）、審査員1人2点の持ち点で合計10点＝「IPPON」; 各ブロックのお題終了時に
//   IPPONの本数が最も多い者が決勝へ（2017年版は1問7分×4問、現在は5問とする資料も）; 同数はサドンデス（最初にIPPONを取った者が勝ち）;
//   決勝は予選敗退の8人が採点＝16点でIPPON、先にIPPONを取った時点でその問題は終了。決勝の問題数は未確認（ゲーム上は先に2本）。
//   番組の進行役「チェアマン」は本作では架空の人物。
// editionOf: anchors 第1回=2009, 第29回=2024 (verified); between them ≈2 per year (interpolated, ゲーム上).
// Sources: en.wikipedia.org/wiki/IPPON_Grand_Prix; ippongrandprix2017.seesaa.net/article/449187262.html; detail.chiebukuro (rules Q&A);
//   japanlocal358.com/ippon-rule; oricon.co.jp/news/2149850; news.livedoor.com/article/detail/25741602; thetv.jp/program/0000932895
const IPPON_ODAI = [
  ['こんな回転寿司はイヤだ。どんなの？', [['レーンが速すぎて、皿が全部“流れ星”', 100], ['ネタの説明が全部、店長の自分語り', 70], ['ずっと止まっている', 35], ['寿司がない', 8]]],
  ['新しいことわざを作ってください', [['猫に小判、オレに給料', 95], ['石の上にも三年、そろそろ尻が限界', 75], ['二兎を追う者は、だいたい三兎目に気を取られる', 55], ['早起きは三文の徳', 5]]],
  ['ロボットが絶対に言わないセリフ', [['ちょっと今日は、電池のノリが悪いんで', 100], ['充電？ わしゃええわい', 65], ['ピピピ', 20], ['こんにちは', 5]]],
  ['ドラキュラが健康診断で言われたこと', [['血液検査の前に、その血は誰のですか', 100], ['もう少し日に当たりましょう', 70], ['歯が長いですね', 35], ['異常なし', 5]]],
  ['おばあちゃんが急に始めた新しい趣味とは？', [['近所の猫に、年金の仕組みを教えている', 100], ['DJ。かける曲は全部お経', 75], ['ゲートボールの審判', 30], ['編み物', 5]]],
  ['絶対に流行らないゆるキャラの名前', [['確定申告くん', 100], ['ぬるっとさん', 60], ['ゆるキャラ太郎', 25], ['ゆるゆる', 5]]],
  ['こんな卒業式はイヤだ', [['校長の話が、来年の卒業式まで続く', 100], ['卒業証書がポイントカード', 70], ['雨', 15], ['普通の卒業式', 5]]],
  ['宇宙人が地球に来て、まず驚いたこと', [['全員、小さい板を見ながら歩いている', 95], ['お辞儀の角度に正解がある', 85], ['空気がある', 30], ['人間がいる', 5]]],
  ['桃太郎が鬼ヶ島で最初に言ったひと言', [['すみません、犬とサルとキジの通訳の方いますか', 100], ['思ったより、ちゃんと島ですね', 75], ['来たぞ！', 20], ['こんにちは', 5]]],
  ['この会議、絶対にまとまらない。なぜ？', [['議題が「この会議をやるかどうか」', 100], ['全員がホワイトボードの消し係', 70], ['人数が多い', 20], ['まとまる', 5]]],
];
const IPPON = {
  name: 'IPPONグランプリ', short: 'IPPON', kind: 'ogiri', category: 'invitational', color: '#c81e2a',
  organizer: 'フジテレビ', broadcaster: 'フジテレビ系（不定期特番）', venue: 'フジテレビのスタジオ', region: 'all',
  history: { founded: 2009, ended: null, gaps: [], revived: null, note: '大喜利の得意な10人が2ブロックで競う。反対ブロックの5人が1人2点で採点、10点で「IPPON」。',
    sources: ['https://en.wikipedia.org/wiki/IPPON_Grand_Prix', 'http://ippongrandprix2017.seesaa.net/article/449187262.html', 'https://news.livedoor.com/article/detail/25741602/'] },
  editionOf: (y) => (y < 2009 ? null : y === 2009 ? 1 : clamp(Math.round(1 + (y - 2009) * 1.87), 2, 99)), // 2024 → 29 (verified anchor)
  schedule: { entry: null, final: [12, 8] },
  rounds: [
    // 出演オファー = D1's invitation (★2000〜); the recording is one round
    { id: 'honban', name: '本番（収録）', when: [12, 8], field: 10, judge: 'points', judges: 5, scoring: 'ブロック予選：反対ブロック5人×2点＝10点でIPPON／決勝：8人×2点＝16点', tv: true, final: true, run: ipponHonban },
  ],
  eligibility: { members: [1, null], invite: { fame: 2000 }, repeat: true, note: '招待制（大喜利の実力者10人）' },
  fee: 0, prize: 0, prizeText: 'IPPONグランプリ チャンピオン', perform: { kind: 'ogiri' },
  news: [
    (g, c) => `${ordinal(c.edition)}IPPONグランプリ、出場10人が決定。初出場は2人`,
    '審査は対戦相手のブロック。1人2点のボタンで、10点そろえば「IPPON」',
    '1問の制限時間は数分。答えは何度でも出せる——ただし、すべれば空気が凍る',
    'ブロック1位だけが決勝へ。決勝は予選敗退の8人が16点満点で採点',
    (g, c) => `大喜利ブームは${c.year >= 2015 ? `${mediaOf(c.year)}の大喜利アカウントにも` : '深夜番組にも'}広がる`,
    '同点ならサドンデス。最初にIPPONを取った者が勝ち抜け',
    '「IPPONの本数より、IPPONの“質”を見ている」とは常連出場者の弁',
  ],
  beats: ['フリップとペンが配られる。手のひらに汗がにじむ。', '反対ブロックの5人が、ボタンの上に指を置いて待っている。', 'チェアマン役が一礼して、お題がめくられた。'],
};
const ippCount = new WeakMap();
async function ipponOdai(g, ctx, b, odai, judgesList, need, r, skip) {
  const ogSkill = Math.round((stat(g, 'hassou') + stat(g, 'adlib')) / 2);
  const ans = odai[1].map(([text, q]) => ({ text, q }));
  let quality;
  if (hasMinigame('ogiri') && !skip && !g.auto) {
    // C's ogiri: opts.odai [{ q, a: [[text, q0..100]] }], mode 'ippon' (5 lamps = IPPON)
    const res = await playMinigame(g, 'ogiri', { mode: 'ippon', rounds: 1, odai: [{ q: odai[0], a: odai[1] }], title: 'IPPONグランプリ', contest: { id: ctx.id, round: rid(ctx), name: 'IPPONグランプリ' }, noPick: true }, ogSkill);
    quality = res.score;
  } else {
    const pick = await chooseAnswer(g, `お題「${odai[0]}」\n——なんと答える？`, ans, r, { auto: skip, skill: ogSkill });
    quality = clamp(Math.round(pick.q * 0.7 + ogSkill * 0.3 + gauss(r) * 6), 0, 100);
    b.patch({ answer: pick.text });
  }
  // the panel's buttons: each judge 0..2
  const pts = judgesList.map(() => clamp(Math.round((quality + gauss(r) * 18) / 40), 0, 2));
  const total = pts.reduce((a, c) => a + c, 0);
  b.patch({ judges: judgesList.map((j, i) => ({ name: j, pts: pts[i] })), need, ippon: total >= need });
  g.sfx(total >= need ? 'fanfare' : total >= need * 0.6 ? 'laugh' : 'buzz');
  await pause(g, 50);
  return { ippon: total >= need, total, quality };
}
async function ipponHonban(g, ctx) {
  const r = rngFor(g, ctx.id, 'ippon');
  const others = rivals(g, ctx, 9, { level: 70, kind: 'ogiri' }).map((x) => ({ name: x.name.replace(/（.*$/, ''), power: x.power }));
  const all = shuffleR([{ name: g.state.name || unitName(g), me: true, power: 0 }, ...others], r);
  const A = all.slice(0, 5); const B = all.slice(5);
  const myBlock = A.some((x) => x.me) ? A : B; const opBlock = myBlock === A ? B : A;
  const chair = personName(r);
  return withBoard(g, boardSpec(ctx, '本番', { set: 'studio' }), async (b) => {
    b.set('card', { name: 'IPPONグランプリ', edition: ordinal(ctx.edition), catch: `Aブロック：${A.map((x) => x.name).join('・')}／Bブロック：${B.map((x) => x.name).join('・')}` });
    await say(g, [`チェアマン（${chair}）「さあ、大喜利の頂点を決める、IPPONグランプリ」`, `あなたは${myBlock === A ? 'A' : 'B'}ブロック。採点するのは${opBlock === A ? 'A' : 'B'}ブロックの5人。`]);
    for (const t of pickBeats(IPPON.beats, r, 1)) await say(g, t);
    const skip = await omakase(g, ctx, '大喜利');
    const odais = shuffleR(IPPON_ODAI, r);
    const count = new Map(all.map((x) => [x.name, 0]));
    const nQ = 4;
    for (let q = 0; q < nQ; q++) {
      const od = odais[q];
      b.set('ippon', { odai: od[0], judges: opBlock.map((j) => ({ name: j.name, pts: 0 })), need: 10 });
      if (q === 0 || !skip) await say(g, `${myBlock === A ? 'A' : 'B'}ブロック　${q + 1}問目：「${od[0]}」`);
      const tries = skip ? 1 : 2;
      for (let t = 0; t < tries; t++) {
        const res = await ipponOdai(g, ctx, b, od, opBlock.map((j) => j.name), 10, r, skip);
        if (res.ippon) { count.set(myBlock.find((x) => x.me).name, count.get(myBlock.find((x) => x.me).name) + 1); if (!skip || q === 0) await say(g, 'IPPON！'); }
        else if (!skip || q === 0) await say(g, `${res.total}点。IPPONならず。`);
      }
      for (const p of myBlock) if (!p.me) { const k = Math.max(0, Math.round((p.power - 55) / 18 + gauss(r) * 0.8)); count.set(p.name, count.get(p.name) + Math.min(2, k)); }
      for (const p of opBlock) { const k = Math.max(0, Math.round((p.power - 55) / 18 + gauss(r) * 0.8)); count.set(p.name, count.get(p.name) + Math.min(2, k)); }
    }
    const rank = (blk) => blk.map((x) => ({ ...x, n: count.get(x.name) })).sort((p, c2) => c2.n - p.n || (c2.me ? 1 : 0) - (p.me ? 1 : 0));
    const mine = rank(myBlock); const theirs = rank(opBlock);
    b.set('ranking', { rows: mine.map((x, i) => ({ name: x.name, score: x.n, me: x.me, place: i + 1 })), passLine: 1, head: `${myBlock === A ? 'A' : 'B'}ブロック　IPPONの本数`, max: Math.max(4, mine[0].n), unit: '本' });
    await pause(g, 50);
    let winner = mine[0];
    if (mine[0].n === mine[1].n && (mine[0].me || mine[1].me)) {
      await say(g, 'IPPONの本数が並んだ——サドンデス！ 最初にIPPONを取った方が決勝へ。');
      const od = odais[nQ];
      b.set('ippon', { odai: od[0], judges: opBlock.map((j) => ({ name: j.name, pts: 0 })), need: 10 });
      const res = await ipponOdai(g, ctx, b, od, opBlock.map((j) => j.name), 10, r, skip);
      const meFirst = res.ippon && r() < 0.6;
      winner = meFirst ? mine.find((x) => x.me) : mine.find((x) => !x.me && x.n === mine[0].n);
      await say(g, meFirst ? 'サドンデスでIPPON！ 決勝進出！' : `サドンデスは${winner.name}が先にIPPON。`);
    }
    const opWin = theirs[0];
    if (!winner.me) {
      await say(g, `${myBlock === A ? 'A' : 'B'}ブロックは${winner.name}が勝ち抜け。決勝は${winner.name}と${opWin.name}。`);
      const w = r() < 0.5 ? winner : opWin;
      await say(g, `優勝は${w.name}。あなたは${mine.findIndex((x) => x.me) + 1}位（IPPON ${count.get(mine.find((x) => x.me).name)}本）。`);
      return { passed: false, score: Math.min(100, count.get(mine.find((x) => x.me).name) * 22), place: 3, field: 10, detail: { ippons: count.get(mine.find((x) => x.me).name) } };
    }
    // 決勝：予選敗退8人が採点、16点でIPPON。先に2本（ゲーム上）
    await say(g, [`決勝！ 相手は${opWin.name}。`, '採点するのは予選で敗れた8人。1人2点、16点でIPPON。']);
    const losers = all.filter((x) => x.name !== winner.name && x.name !== opWin.name).map((x) => x.name);
    let me = 0; let op = 0; let qn = nQ + 1;
    while (me < 2 && op < 2 && qn < odais.length) {
      const od = odais[qn++];
      b.set('ippon', { odai: od[0], judges: losers.map((n) => ({ name: n, pts: 0 })), need: 16, score: `決勝　あなた ${me} − ${op} ${opWin.name}` });
      const res = await ipponOdai(g, ctx, b, od, losers, 16, r, skip);
      const opP = clamp(opWin.power + gauss(r) * 14, 0, 100);
      const mine2 = res.ippon ? res.quality + 8 : -1; const theirs2 = opP >= 72 ? opP : -1;
      if (mine2 < 0 && theirs2 < 0) { await say(g, 'どちらもIPPONならず。次のお題。'); continue; }
      if (mine2 >= theirs2) { me++; await say(g, `先にIPPON！（${me}−${op}）`); } else { op++; await say(g, `${opWin.name}が先にIPPON。（${me}−${op}）`); }
    }
    const champ = me > op;
    if (champ) { g.sfx('fanfare'); await say(g, `${ordinal(ctx.edition)}IPPONグランプリ、チャンピオンは${g.state.name || unitName(g)}！`); champion(g, ctx, 'チャンピオン'); }
    else await say(g, `チャンピオンは${opWin.name}。決勝で敗れた。`);
    ippCount.set(g.state, (ippCount.get(g.state) || 0) + 1);
    return { passed: champ, champion: champ, score: champ ? 95 : 80, place: champ ? 1 : 2, field: 10, award: champ ? 'チャンピオン' : null };
  });
}

// ============================================================== 人志松本のすべらない話（フジテレビ, 2004〜）
// VERIFIED: 初回2004年12月28日、フジテレビの深夜番組として開始（深夜時代は2008年3月の第13弾まで、その後は特番）; 出演者の名前が
//   書かれたサイコロを振り、出た目の人がとっておきの話をする; 最優秀の話をMVS（Most Valuable すべらない話）として選ぶ; 2004〜2022年
//   に37回、不定期放送。番組名は題名としてのみ使い、本作の進行役は架空の人物（司会者本人は登場しない）。放送月は不定（ゲームでは年末）。
// Sources: news.mynavi.jp/article/tviki-81, 20121214-a167; news.allabout.co.jp/articles/o/65476; ciatr.jp/topics/316358;
//   thetvdb.com/series/415000-; j-cast.com/2012/06/22136768.html
const SUBERANAI = {
  name: '人志松本のすべらない話', short: 'すべらない', kind: 'talk', category: 'invitational', color: '#3a2a1a',
  organizer: 'フジテレビ', broadcaster: 'フジテレビ系（不定期特番）', venue: 'フジテレビのスタジオ（円卓）', region: 'all',
  history: { founded: 2004, ended: null, gaps: [], revived: null, note: '名前の書かれたサイコロで話し手が決まるエピソードトーク。最後にMVS。',
    sources: ['https://news.mynavi.jp/article/tviki-81/', 'https://news.allabout.co.jp/articles/o/65476/', 'https://ciatr.jp/topics/316358'] },
  editionOf: editionCounter(2004),
  labelStyle: 'year',
  editionLabel: (y) => `すべらない話 ${y}`,
  schedule: { entry: null, final: [12, 6] },
  rounds: [
    // 出演オファー = D1's invitation (★1000〜)
    { id: 'honban', name: '収録（サイコロトーク）', when: [12, 6], field: 8, judge: 'vote', scoring: 'すべらなければ「すべらんなぁ」、最後に進行役がMVSを選ぶ', tv: true, final: true, run: suberanaiHonban },
  ],
  eligibility: { members: [1, null], invite: { fame: 1000 }, repeat: true, note: '招待制（話のうまい芸人）' },
  fee: 0, prize: 0, prizeText: 'MVS（Most Valuable すべらない話）', winnerTitle: 'MVS', perform: { kind: 'talk' },
  news: [
    (g, c) => `『すべらない話』${c.year}年版の収録。サイコロに名前が並ぶ8人が決定`,
    '名前の書かれたサイコロを振り、出た目の人が話す。いつ自分の番が来るかわからない',
    'MVS（Most Valuable すべらない話）は誰の手に',
    (g, c) => (c.year < 2008 ? '深夜の円卓トークが話題に。DVDも売れ行き好調' : `放送翌日、${mediaOf(c.year)}は名エピソードの話でもちきり`),
    '「話は実話。盛ってもいいが、すべってはいけない」',
    '常連の話し手が、ついに100話目に到達か',
  ],
  beats: ['円卓。8人の名前が書かれた大きなサイコロが、真ん中に置かれている。', '進行役がサイコロを持ち上げた。全員が目で追う。', '話の途中で笑いが起きると、隣の席から「すべらんなぁ」の声。'],
};
function lifeTopics(g, year = 2026) {
  const dev = year >= 2010 ? 'スマホ' : 'ケータイ'; // era device (すべらない話 exists from 2004)
  const st = g.state || {};
  const u = unitOf(g);
  const pt = (u.members || []).find((m) => m.id !== 'player');
  const out = [];
  if (pt) out.push({ title: `相方の${pt.short || pt.name}の話`, beats: [['ネタ合わせの日、相方が30分遅れてきた。', '「ごめん、迷子の亀を交番に届けてた」と言うんです', '理由を聞いたら「寝坊」でした', '遅刻はよくないですよね'], ['交番のおまわりさんが、亀に向かって「お名前は？」って聞いてて', 'おまわりさんが調書を書き始めた', '亀はそのまま帰りました', '亀って長生きするらしいです'], ['帰り道、相方が「あいつ、ちゃんと家に帰れたかな」って泣いてたんです。亀の話で泣くやつ、初めて見ました', '相方は今でも、その亀に年賀状を出してます', 'それで、ネタ合わせはできませんでした', 'まあ、そんな感じです']] });
  if ((st.money || 0) < 30000) out.push({ title: 'お金がなかった頃の話', beats: [['給料日前、財布に47円しかなかったんです。', 'もやしを3日間、別の料理と言い張って食べてた', '貯金はゼロでした', 'お金がなかったです'], ['大家さんが「家賃、来月でええよ」って言ってくれて', 'コンビニで、もやしを買うときだけレジの人と目を合わせなくなった', 'ATMに行っても増えてない', 'つらかったです'], ['翌月、大家さんの家の前を通ったら、表札が僕の芸名になってたんです。「ファンやねん」って', 'いまでも、もやしを見ると敬語になります', 'なんとか生きてます', '以上です']] });
  out.push({ title: '実家の父の話', beats: [['うちの父、本当に機械に弱くて。', `父が${dev}……いや、テレビのリモコンに話しかけてたんです`, '父は会社員です', '普通の父です'], ['留守電に「もしもし、お父さんです」って入ってるんですけど、自宅の電話なんですよ', '「この中に、誰か入ってるんか」って', '電話がよく鳴ります', '父は元気です'], ['自分あてに留守電を残して、帰ってきて聞いて「おう、俺か」って返事してたんです', '最近は、留守電で母とケンカしてます', '電話は便利ですね', 'そういう父です']] });
  out.push({ title: '初めての営業の話', beats: [['初めての営業は、商店街の福引き会場でした。', '客席は、ガラガラを回す音しか聞こえない', '人はいました', 'お客さんがいました'], ['ネタの途中で「1等、温泉旅行〜！」って鐘が鳴って、全員そっちを向いたんです', '途中で雨が降ってきた', 'マイクが小さかった', 'がんばりました'], ['で、最後の最後に僕らが福引きを回したら、また1等。商店街の人に「空気読めや」って怒られました', '帰りにギャラの代わりに、ティッシュを100個もらいました', '楽しかったです', '終わりです']] });
  return out;
}
async function suberanaiHonban(g, ctx) {
  const r = rngFor(g, ctx.id, 'sube');
  const others = rivals(g, ctx, 7, { level: 68, kind: 'talk' }).map((x) => ({ name: x.name.replace(/（.*$/, ''), power: x.power }));
  const me = { name: g.state.name || unitName(g), me: true };
  const ppl = shuffleR([me, ...others], r);
  const host = `進行役・${personName(r)}`;
  const topics = shuffleR(lifeTopics(g, yearOf(g, ctx)), r);
  const stories = [];
  return withBoard(g, boardSpec(ctx, '収録（サイコロトーク）', { set: 'theater' }), async (b) => {
    b.set('dice', { faces: ppl.map((p) => p.name), face: 0, people: ppl.map((p) => p.name), label: '名前の書かれたサイコロ' });
    await say(g, [`${host}「さあ、始めましょう。すべらない話」`, ...pickBeats(SUBERANAI.beats, r, 1)]);
    const skip = await omakase(g, ctx, 'トーク');
    let told = 0;
    const rolls = 6;
    for (let k = 0; k < rolls; k++) {
      // 2本目までに一度は自分の目が出る（収録の尺の都合、ゲーム上）
      let idx = Math.floor(r() * ppl.length);
      if (k === 2 && told === 0) idx = ppl.indexOf(me);
      if (k === rolls - 1 && told < 2 && r() < 0.5) idx = ppl.indexOf(me);
      b.patch({ rolling: true });
      g.sfx('drum');
      await pause(g, 50);
      b.patch({ rolling: false, face: idx, label: `出た目：${ppl[idx].name}` });
      await say(g, `サイコロの目は——「${ppl[idx].name}」！`);
      if (ppl[idx].me && told < 2 && topics[told]) {
        const tp = topics[told++];
        await say(g, `（話すのは「${tp.title}」）`);
        let q;
        const fb = clamp(stat(g, 'wagei') * 0.7 + 25 + gauss(r) * 8, 0, 100);
        if (!skip && !g.auto && hasMinigame('talk')) {
          const res = await playMinigame(g, 'talk', { topic: 'すべらない話', show: 'すべらない話', mc: host, scenes: talkScenes(tp.beats.map(([p, a, b2, c]) => [p, a, b2, c])), count: tp.beats.length, title: 'すべらない話' }, fb);
          q = res.score;
        } else q = fb;
        q = clamp(Math.round(q * 0.75 + stat(g, 'wagei') * 0.25), 0, 100);
        stories.push({ name: me.name, title: tp.title, q, me: true });
        g.sfx(q >= 55 ? 'laugh' : 'buzz');
        await say(g, q >= 55 ? ['円卓が揺れるほどの笑い。', '「すべらんなぁ〜」'] : ['……微妙な間。', '誰かが小さく「…すべったな」とつぶやいた。']);
      } else {
        const p = ppl[idx];
        const q = clamp(Math.round((p.power || 60) + gauss(r) * 12), 0, 100);
        stories.push({ name: p.name, title: pickR(['タクシーの運転手の話', '後輩の結婚式の話', 'ロケ先の旅館の話', '親戚のおじさんの話', '歯医者の話', '引っ越しの話'], r), q });
        await say(g, `${p.name}の「${stories[stories.length - 1].title}」。${q >= 55 ? '「すべらんなぁ」' : 'ちょっと、すべった。'}`);
      }
    }
    const best = stories.slice().sort((a, c) => c.q - a.q)[0];
    b.set('award', { head: 'MVS（Most Valuable すべらない話）', rows: [{ award: 'MVS', name: `${best.name}「${best.title}」`, me: best.me }], label: `${host}が選ぶ` });
    await pause(g, 40);
    const mvs = !!best.me;
    const mine = stories.filter((s) => s.me);
    if (mvs) { g.sfx('fanfare'); await say(g, [`${host}「今日のMVSは……${me.name}さんの『${best.title}』！」`, 'トロフィーを受け取ると、円卓の全員が拍手をくれた。']); champion(g, ctx, 'MVS', { news: `すべらない話${ctx.year}、MVSは${me.name}の「${best.title}」` }); }
    else await say(g, `MVSは${best.name}の「${best.title}」。${mine.length ? '自分の話は' + (mine.every((s) => s.q >= 55) ? 'すべらなかった。' : '少しすべった。') : '今日は自分の目が出なかった。'}`);
    const sc = mine.length ? Math.round(mine.reduce((a, c) => a + c.q, 0) / mine.length) : 50;
    return { passed: mvs, champion: mvs, score: sc, place: mvs ? 1 : null, field: 8, award: mvs ? 'MVS' : null, detail: { stories: mine.length, suberanai: mine.filter((s) => s.q >= 55).length } };
  });
}

// ============================================================== おもしろ荘（日本テレビ『ぐるナイ』の新春特番）
// VERIFIED: 日本テレビ『ぐるぐるナインティナイン』の企画として毎年大晦日〜元日の深夜に放送される若手ネタ番組（2019年版は12月31日24時30分〜）;
//   ブレイク芸人を多数輩出する「元旦の恒例企画」; 最近は1196組がオーディションに参加し、選ばれた13組がネタを披露、観覧100名の投票で
//   優勝が決まる。初回の年は検索で確認できなかった（ゲームでは2007年元日開始の伝聞による、要確認）。司会は本作では登場しない
//   （架空の進行役）。
// Sources: oricon.co.jp/special/55773, 69879; oricon.co.jp/news/2320304, 2219776; crank-in.net/news/159035; bunshun.jp/articles/-/42757;
//   ticket.co.jp/entx/?p=4641; toyokeizai.net/articles/-/214642
const OMOSHIRO = {
  name: 'おもしろ荘', short: 'おもしろ荘', kind: 'any', category: 'tv', color: '#e06a2a',
  organizer: '日本テレビ', broadcaster: '日本テレビ系（大晦日〜元日深夜の特番）', venue: '日本テレビのスタジオ', region: 'all',
  history: { founded: 2007, ended: null, gaps: [], revived: null, note: '新年の深夜、まだテレビに出ていない若手を発掘するネタ見せ番組。オーディションを勝ち抜いた13組が出演し、観覧100名の投票で優勝が決まる。',
    sources: ['https://www.oricon.co.jp/special/69879/', 'https://www.crank-in.net/news/159035/1', 'https://bunshun.jp/articles/-/42757'] },
  editionOf: editionCounter(2007),
  labelStyle: 'year',
  schedule: { entry: { from: [8, 1], to: [9, 5] }, final: [12, 10] },
  rounds: [
    { id: 'audition', name: 'オーディション（ネタ見せ）', when: [[10, 3], [10, 7]], venues: ['東京', '大阪'], length: 120, pass: 13, field: 1200, judge: 'staff', scoring: '番組スタッフのネタ見せ（約1200組→13組）', run: omoAudition },
    { id: 'live', name: '元日深夜の本番', when: [12, 10], length: 120, field: 13, judge: 'audience', judges: 100, scoring: '観覧100名の投票', tv: true, final: true, run: omoLive },
  ],
  eligibility: { members: [1, null], note: 'まだテレビで売れていない若手（オーディション制）' },
  fee: 0, prize: 0, prizeText: '', perform: { kind: 'any', length: 120 },
  news: [
    (g, c) => `新春『おもしろ荘』、オーディションに約1200組。今年の“発見”は誰だ`,
    '出演は13組。「おもしろ荘で優勝すると、その年に売れる」というジンクス',
    '優勝は観覧100名の投票で決まる',
    (g, c) => `元日の深夜、家族そろって新人のネタを見る——${deviceOf(c.year) === 'スマホ' ? '放送中から名前がトレンド入り' : '翌朝、学校や職場で話題に'}`,
    '無名の芸人ほど、ここで化ける',
    '番組の年明け最初の“発掘”に、各局のスタッフも注目',
  ],
  beats: ['オーディション会場は、テレビ局の会議室。長机の向こうにスタッフが3人。', '「テレビで見たことない人を探してます」——スタッフの言葉に、少しだけ救われる。', '新年の深夜、スタジオには門松と鏡餅。'],
};
async function omoAudition(g, ctx) {
  if (fame(g) >= 2000) {
    await say(g, ['スタッフ「すみません、もうテレビでご活躍されている方は……」', 'おもしろ荘は“まだ見ぬ新人”の番組。今年は見送りだ。']);
    return { passed: false, score: 0, place: null, field: 1200, note: '無名の新人枠ではない' };
  }
  return stdRound({ kind: 'any', length: 120, pass: 13, field: 1200, level: 50, set: 'theater', beats: OMOSHIRO.beats, head: 'オーディション（13組が本番へ）',
    passText: () => 'スタッフ「元日の深夜、空けておいてください」——おもしろ荘、出演決定！' })(g, ctx);
}
async function omoLive(g, ctx) {
  const r = rngFor(g, ctx.id, 'omo');
  const kind = defaultKind(g);
  const rvs = rivals(g, ctx, 12, { level: 52, kind });
  const acts = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
  return withBoard(g, boardSpec(ctx, '元日深夜の本番', { set: 'studio' }), async (b) => {
    b.set('card', { name: 'おもしろ荘', edition: `${ctx.year + 1}年 元日深夜`, catch: '大晦日から元日へ。まだテレビで見たことのない13組がネタを披露し、観覧100名の投票で優勝が決まる。' });
    await say(g, ['年が明けた。スタジオに「あけましておめでとうございます」の声。', ...pickBeats(OMOSHIRO.beats, r, 1)]);
    const skip = await omakase(g, ctx);
    let my = 0;
    for (const a of acts) a.score = a.me ? (my = (await perform(g, ctx, { kind, length: 120, skip, title: 'おもしろ荘', venue: { size: 'tv', crowd: 'warm', pressure: 75 } })).score) : rivalScore(g, a, { kind }, r);
    // 観覧100名がそれぞれ1組に投票
    const votes = acts.map(() => 0);
    for (let i = 0; i < 100; i++) { let bi = 0; let bv = -1e9; acts.forEach((a, k) => { const p = a.score + gauss(r) * 14; if (p > bv) { bv = p; bi = k; } }); votes[bi]++; }
    const rows = acts.map((a, i) => ({ ...a, total: votes[i] })).sort((p, q) => q.total - p.total);
    await showRows(g, b, rows, '観覧100名の投票', { max: Math.max(20, rows[0].total), passLine: 1, unit: '票' });
    const champ = rows[0].me;
    if (champ) { g.sfx('fanfare'); await say(g, [`おもしろ荘、優勝は${unitName(g)}！（${rows[0].total}票）`, '朝までに、知らない番号から何件も着信が入っていた。']); champion(g, ctx, '優勝'); news(g, ctx, `おもしろ荘優勝の${unitName(g)}、年明けからテレビ出演が続々`); }
    else await say(g, `優勝は${rows[0].name}。${unitName(g)}は${rows.find((x) => x.me).total}票。それでも、全国の深夜のテレビに映った。`);
    return { passed: champ, champion: champ, score: my, place: rows.findIndex((x) => x.me) + 1, field: 13, award: champ ? '優勝' : null };
  });
}

// ============================================================== フットンダ王決定戦（中京テレビ, 2012〜）
// VERIFIED: 中京テレビが日本テレビ系で毎年大晦日深夜〜元日に生放送するお笑いバトル（2025年1月1日午前2時〜の回あり）; 総勢36名の
//   芸人が“モジる”“イジる”お題（実際にあるモノをモジる）に挑み、面白い回答で布団が吹っ飛ぶ; 多く飛ばした芸人がブロックを勝ち上がり
//   6名が決勝; 2019年大会から放送作家3人が審査し3人全員がボタンを押すと布団が飛ぶ; 本戦最後の1枠は若手16名のワイルドカード
//   予選会; 2019年大会＝8回目、2024年大会＝13回目（→2012年が第1回）。MCは本作では登場しない。
// Sources: natalie.mu/owarai/pp/futtonda10_02, futtonda08_01, futtonda06_01; natalie.mu/owarai/news/604889; atpress.ne.jp/news/173883, 421677;
//   oricon.co.jp/news/2358117, 2219793; thetv.jp/program/0000995616
const FUTON_ODAI = [
  ['ことわざをモジって、サラリーマンの本音', [['早帰りは三文の得', 100], ['部長も歩けば僕に当たる', 85], ['椅子の上にも三年', 60], ['急がば休め', 30], ['ことわざが思いつかない', 5]]],
  ['昔話のタイトルをモジって、令和の新作', [['裏垢太郎', 100], ['既読スルー雀', 75], ['一寸先は闇法師', 45], ['桃次郎', 10]]],
  ['駅名をモジって、月曜の朝の駅', [['しぶしぶ谷', 100], ['目の下ぐろ', 70], ['だる品川', 45], ['駅', 5]]],
  ['四字熟語をモジって、夏休みの小学生', [['三十一日坊主', 100], ['起床転結', 85], ['自由研究自賛', 60], ['夏休み', 5]]],
  ['料理の名前をモジって、ダイエット中の心の声', [['肉じゃ我慢', 100], ['おやつ丼', 80], ['天使の飯', 50], ['サラダ', 5]]],
  ['都道府県をモジって、二日酔いの朝', [['ギブ（岐阜）', 100], ['とやまない頭痛', 85], ['最低ま（埼玉）', 50], ['日本', 5]]],
  ['スポーツの名前をモジって、休日のお父さん', [['ボーっとリング', 100], ['まだ寝ソン', 80], ['テレビス', 55], ['野球', 5]]],
  ['ことわざをモジって、猫の言い分', [['猫も歩けば膝に乗る', 100], ['人の手は借りたくない', 80], ['猫に小言', 60], ['にゃー', 5]]],
];
const FUTTONDA = {
  name: 'フットンダ王決定戦', short: 'フットンダ', kind: 'ogiri', category: 'invitational', color: '#c84a8a',
  organizer: '中京テレビ', broadcaster: '中京テレビ制作・日本テレビ系（大晦日〜元日深夜の生放送）', venue: '中京テレビのスタジオ（名古屋）', region: 'nagoya',
  history: { founded: 2012, ended: null, gaps: [], revived: null, note: '“モジる”“イジる”言葉遊びの大喜利。3人の放送作家が全員ボタンを押すと布団が吹っ飛ぶ。',
    sources: ['https://natalie.mu/owarai/pp/futtonda10_02', 'https://natalie.mu/owarai/news/604889', 'https://www.oricon.co.jp/news/2358117/full/'] },
  editionOf: editionCounter(2012),
  labelStyle: 'year',
  schedule: { entry: { from: [11, 1], to: [11, 10] }, final: [12, 10] },
  rounds: [
    { id: 'wild', name: 'ワイルドカード予選会', when: [12, 4], field: 16, pass: 1, judge: 'points', scoring: '若手16名→本戦の最後の1枠（★1500以上は本戦から）', wildcard: true, run: futtondaWild },
    { id: 'live', name: '本戦（大晦日〜元日 生放送）', when: [12, 10], field: 36, judge: 'points', judges: 3, scoring: '放送作家3人が全員ボタン→布団が吹っ飛ぶ。ブロック勝ち上がり→6名の決勝', tv: true, final: true, run: futtondaLive },
  ],
  eligibility: { members: [1, null], repeat: true, note: '本戦36名はオファー制、若手はワイルドカード予選会から（★1500以上は本戦から）' },
  fee: 0, prize: 0, prizeText: 'フットンダ王', perform: { kind: 'ogiri' },
  news: [
    (g, c) => `『フットンダ王決定戦${c.year}』出場36名が決定。大晦日から元日へ生放送`,
    'お題は“モジる”“イジる”。実在の言葉をひねって、布団を吹っ飛ばせ',
    '判定は放送作家3人。全員がボタンを押した時だけ布団が飛ぶ',
    'ワイルドカード予選会は若手16名。本戦の最後の1枠を争う',
    (g, c) => `年越しの深夜、${c.year >= 2010 ? 'タイムラインに' : '茶の間に'}「うまい！」の声`,
    'ブロックを勝ち抜いた6名だけが決勝へ',
  ],
  beats: ['スタジオの天井近くに、布団を飛ばす装置が見える。', '「モジりは“元の言葉”がわかる範囲で、いちばん遠くへ」——先輩の教え。', '年越しのカウントダウンが、スタジオの外から聞こえる。'],
};
const eraOdai = (ods, y) => ods.map(([q, a]) => [q.replace('令和', y >= 2019 ? '令和' : '平成'), a]);
async function futonAnswer(g, b, od, r, skip, first = false) {
  const sk = Math.round((stat(g, 'hassou') + stat(g, 'neta')) / 2);
  const ans = od[1].map(([text, q]) => ({ text, q }));
  b.set('futon', { odai: od[0], hint: '実在の言葉をモジって答える', writers: [false, false, false] });
  const pick = await chooseAnswer(g, `お題「${od[0]}」\n——どうモジる？`, ans, r, { auto: skip, skill: sk });
  const q = clamp(Math.round(pick.q * 0.75 + sk * 0.25 + gauss(r) * 6), 0, 100);
  const w = [0, 1, 2].map(() => q + gauss(r) * 16 >= 62);
  const fly = w.every(Boolean);
  b.set('futon', { odai: od[0], answer: pick.text, writers: w, fly });
  g.sfx(fly ? 'zukko' : 'buzz');
  await pause(g, fly ? 70 : 40);
  if (!skip || first) await say(g, fly ? '3人全員がボタン！ 布団が吹っ飛んだ！' : `ボタンは${w.filter(Boolean).length}人……布団は飛ばなかった。`);
  return fly;
}
async function futtondaWild(g, ctx) {
  const y = yearOf(g, ctx);
  const log = yearLog(g, ctx.id, y);
  if (fame(g) >= 1500) {
    log.invited = true;
    await say(g, '本戦への出演オファーが来ている。ワイルドカード予選会には出ない。');
    return { passed: true, score: 0, place: null, field: 16, skipped: true, note: '本戦から出場' };
  }
  const r = rngFor(g, ctx.id, 'fw');
  return withBoard(g, boardSpec(ctx, 'ワイルドカード予選会', { set: 'studio' }), async (b) => {
    await say(g, ['ワイルドカード予選会。若手16名で、本戦の最後の1枠を争う。', ...pickBeats(FUTTONDA.beats, r, 1)]);
    const skip = await omakase(g, ctx, '回答');
    const ods = eraOdai(shuffleR(FUTON_ODAI, r), yearOf(g, ctx));
    let n = 0;
    for (let i = 0; i < 3; i++) if (await futonAnswer(g, b, ods[i], r, skip, i === 0)) n++;
    const rv = rivals(g, ctx, 15, { level: 55, kind: 'ogiri' });
    const rows = [{ name: g.state.name || unitName(g), me: true, total: n }, ...rv.map((x) => ({ name: x.name.replace(/（.*$/, ''), total: clamp(Math.round((x.power - 40) / 15 + gauss(r) * 0.8), 0, 3) }))].sort((p, q) => q.total - p.total || (q.me ? 1 : 0) - (p.me ? 1 : 0));
    await showRows(g, b, rows, 'ワイルドカード予選会（布団の数）', { max: 3, passLine: 1, unit: '枚' });
    const ok = rows[0].me;
    log.invited = ok;
    await say(g, ok ? 'ワイルドカード獲得！ 大晦日の本戦へ！' : `本戦の切符は${rows[0].name}へ。布団${n}枚。`);
    return { passed: ok, score: n * 30, place: rows.findIndex((x) => x.me) + 1, field: 16 };
  });
}
async function futtondaLive(g, ctx) {
  const y = yearOf(g, ctx);
  const r = rngFor(g, ctx.id, 'fl');
  const nm = g.state.name || unitName(g);
  return withBoard(g, boardSpec(ctx, '本戦（年越し生放送）', { set: 'live' }), async (b) => {
    b.set('card', { name: 'フットンダ王決定戦', edition: `${y}→${y + 1} 年越し生放送`, catch: '36名が6ブロックで“モジり”対決。布団を多く飛ばした者が勝ち上がり、6名の決勝でフットンダ王が決まる。' });
    await say(g, '36名がブロックに分かれて、モジりのお題に挑む。');
    const skip = await omakase(g, ctx, '回答');
    const ods = eraOdai(shuffleR(FUTON_ODAI, r), yearOf(g, ctx));
    let n = 0;
    for (let i = 0; i < 3; i++) if (await futonAnswer(g, b, ods[i], r, skip, i === 0)) n++;
    const blk = rivals(g, ctx, 5, { level: 66, kind: 'ogiri' }).map((x) => ({ name: x.name.replace(/（.*$/, ''), total: clamp(Math.round((x.power - 45) / 14 + gauss(r) * 0.8), 0, 3) }));
    const rows = [{ name: nm, me: true, total: n }, ...blk].sort((p, q) => q.total - p.total || (q.me ? 1 : 0) - (p.me ? 1 : 0));
    await showRows(g, b, rows, 'ブロック予選（布団の数）', { max: 3, passLine: 1, unit: '枚' });
    if (!rows[0].me) { await say(g, `ブロックを勝ち抜いたのは${rows[0].name}。布団${n}枚で敗退。`); return { passed: false, score: n * 30, place: 7 + Math.floor(r() * 29), field: 36 }; }
    await say(g, 'ブロック突破！ 6名の決勝へ。');
    let m = 0;
    for (let i = 3; i < 6; i++) if (await futonAnswer(g, b, ods[i], r, skip, i === 3)) m++;
    const fin = [{ name: nm, me: true, total: m }, ...rivals(g, ctx, 5, { level: 72, kind: 'ogiri', salt: 'fin' }).map((x) => ({ name: x.name.replace(/（.*$/, ''), total: clamp(Math.round((x.power - 45) / 14 + gauss(r) * 0.9), 0, 3) }))].sort((p, q) => q.total - p.total || (q.me ? 1 : 0) - (p.me ? 1 : 0));
    await showRows(g, b, fin, '決勝（布団の数）', { max: 3, passLine: 1, unit: '枚' });
    const champ = fin[0].me;
    if (champ) { g.sfx('fanfare'); await say(g, [`${y}年のフットンダ王は${nm}！`, '新年最初の朝日が、スタジオの窓から差し込んでいた。']); champion(g, ctx, 'フットンダ王'); }
    else await say(g, `フットンダ王は${fin[0].name}。`);
    return { passed: champ, champion: champ, score: Math.round((n + m) * 18), place: fin.findIndex((x) => x.me) + 1, field: 36, award: champ ? 'フットンダ王' : null };
  });
}

// ============================================================== AUN〜コンビ大喜利王決定戦〜（クイック・ジャパン×WLUCK のライブ）
// VERIFIED: QJWeb（クイック・ジャパン）とWLUCKのライブイベント; コンビで挑む大喜利のトーナメント（一人ではできないお題にコンビで挑戦）;
//   第1回2020年12月26日、2021年に第2・3回、第7回2024年1月21日（ニッショーホール）; 学生版も開催。即席ユニット・アマチュアの出場可否、
//   出場組数、審査方法は資料で食い違い/未確認（ゲーム上：8組の1対1トーナメント、審査員3人の多数決、1試合3問）。テレビ放送ではない。
// editionOf: 2020→1, 2021→3, 2024→7 (verified anchors); other years interpolated (ゲーム上).
// Sources: qjweb.jp/column/65132, 103777, 104068, 104838; qjweb.jp/feature/83498; wluck-park.com/topics/4345, 18973; wluck-park.com/interview/10130
const AUN_ODAI = [
  ['“息ぴったり”じゃない双子の自己紹介', [['「僕たち双子です！」→「……いや、初対面です」', 95], ['「せーの」→（片方だけ「こんばんは」）', 80], ['「僕が兄で」→「僕も兄です」', 65], ['「双子です」→「はい」', 10]]],
  ['客がひとりもいないレストラン、店員2人の会話', [['「本日のおすすめは？」→「……お客様です」', 95], ['「満席です」→（2人で全部の椅子に座る）', 80], ['「いらっしゃいませ」→「誰に？」', 50], ['「暇だね」→「暇だね」', 10]]],
  ['刑事ドラマの取り調べ、ありえないやり取り', [['「カツ丼、食うか？」→「先にサラダからで」', 90], ['「吐け！」→「まだ食べてません」', 75], ['「お前がやったんだろ」→「はい」', 35], ['「……」→「……」', 5]]],
  ['2人で考えた、最悪のヒーローの決めゼリフ', [['「正義の味方！」→「…の、親戚です」', 95], ['「変身！」→「…は来週からで」', 75], ['「悪を倒す！」→「どの悪？」', 50], ['「ヒーローです」→「です」', 5]]],
  ['結婚式のスピーチ、新郎の友人2人がやらかした', [['「新郎とは小学校からの」→「初めまして」', 95], ['「ここで歌います」→（2人とも違う曲）', 80], ['「おめでとう」→「何が？」', 45], ['「以上です」→「以上です」', 5]]],
  ['引っ越し業者2人の、絶対に聞きたくない会話', [['「この冷蔵庫、どっちが持つ？」→「……冷蔵庫ってどれ？」', 95], ['「せーの」→（片方だけ寝転ぶ）', 75], ['「重いね」→「重いね」', 30], ['「運びます」→「はい」', 5]]],
  ['2人組の占い師、言うことが全然合わない', [['「あなたは大吉」→「あなたは来世から大吉」', 95], ['「恋愛運、最高」→「相手は僕です」', 80], ['「金運は…」→「ないです」', 40], ['「占います」→「占います」', 5]]],
  ['漫才コンビの楽屋で、絶対に交わされない会話', [['「今日のネタどうする？」→「ネタって何？」', 90], ['「お疲れさま」→「誰？」', 70], ['「ウケたね」→「ウケたね」', 25], ['「おはよう」→「おはよう」', 5]]],
  ['2人で考えた、まったく売れない新商品', [['「飲むと眠くなる栄養ドリンク」→「朝専用です」', 95], ['「透明な付箋」→「どこに貼ったか分かりません」', 80], ['「普通の傘」→「普通です」', 30], ['「商品」→「です」', 5]]],
];
const AUN = {
  name: 'AUN〜コンビ大喜利王決定戦〜', short: 'AUN', kind: 'ogiri', category: 'special', color: '#2a8ac8',
  organizer: 'クイック・ジャパン（QJWeb）・WLUCK', broadcaster: '（ライブイベント・配信）', venue: '東京のホール（ニッショーホールなど）', region: 'tokyo',
  history: { founded: 2020, ended: null, gaps: [], revived: null, note: '2人1組で答える大喜利トーナメント。「一人ではできないお題」にコンビで挑む。',
    sources: ['https://qjweb.jp/column/104068/', 'https://wluck-park.com/interview/10130/', 'https://wluck-park.com/topics/18973/'] },
  editionOf: (y) => (y < 2020 ? null : y === 2020 ? 1 : y === 2021 ? 3 : y === 2022 ? 5 : y === 2023 ? 6 : 7 + (y - 2024)),
  schedule: { entry: { from: [10, 1], to: [11, 5] }, final: [12, 6] },
  rounds: [
    { id: 'tour', name: '本戦トーナメント', when: [12, 6], field: 8, judge: 'vote', judges: 3, scoring: '1対1・お題ごとに審査員3人の多数決、先に2問取った組が勝ち', final: true, run: aunTournament },
  ],
  eligibility: { members: [2, 2], note: '2人1組（コンビ）で出場' },
  fee: 0, prize: 0, prizeText: '', perform: { kind: 'ogiri' },
  news: [
    (g, c) => `${ordinal(c.edition)}『AUN〜コンビ大喜利王決定戦〜』出場コンビ発表`,
    '一人ではできないお題に、コンビで挑む大喜利。フリと返しの“あうん”が勝負',
    '会場はホール、配信チケットも販売',
    (g, c) => `大喜利ライブの熱が${mediaOf(c.year)}でも広がる`,
    '「大喜利の強い人が2人いても、勝てるとは限らない」——過去の出場者',
    '答えを出すのは2人でひとつ。片方だけ面白くても勝てない',
  ],
  beats: ['ホワイトボードは1枚、ペンは2本。', '相方と目が合った。言わなくても、次の答えがわかる気がする。', '客席の大喜利ファンは、答えの“型”まで見抜いてくる。'],
};
async function aunTournament(g, ctx) {
  const r = rngFor(g, ctx.id, 'aun');
  // a TV-grade field: D1's world is weak at コンビ大喜利, so the def's level is the floor (and finals get stronger)
  const rvs = rivals(g, ctx, 7, { level: 68, kind: 'ogiri', favourites: true, spread: 8 });
  const order = shuffleR([{ name: unitName(g), me: true }, ...rvs.map((x) => ({ name: x.unit === 'pin' ? combiName(r) : x.name.replace(/（.*$/, ''), power: x.power }))], r);
  const harmony = Number(unitOf(g).harmony) || 50;
  const sk = Math.round((stat(g, 'hassou') + stat(g, 'adlib')) / 2 * 0.8 + harmony * 0.2);
  const ods = shuffleR(AUN_ODAI, r);
  let qi = 0;
  return withBoard(g, boardSpec(ctx, '本戦トーナメント', { set: 'live' }), async (b) => {
    const rounds = [[], [], []];
    for (let i = 0; i < 8; i += 2) rounds[0].push({ A: order[i], B: order[i + 1] });
    const show = (label) => b.set('bracket', { rounds: rounds.map((x) => x.map((m) => ({ a: m.A.name, b: m.B.name, w: m.W && m.W.name, me: m.A.me || m.B.me }))), label });
    show('8組のトーナメント');
    await say(g, ['コンビ大喜利。1人がフリ、もう1人が返す——2人そろって1つの答え。', ...pickBeats(AUN.beats, r, 1)]);
    const skip = await omakase(g, ctx, '回答');
    let alive = true; let wins = 0;
    for (let s = 0; s < 3; s++) {
      if (s > 0) { const p = rounds[s - 1]; for (let i = 0; i < p.length; i += 2) rounds[s].push({ A: p[i].W, B: p[i + 1].W }); }
      for (const m of rounds[s]) {
        if ((m.A.me || m.B.me) && alive) {
          const opp = m.A.me ? m.B : m.A;
          show(`${['1回戦', '準決勝', '決勝'][s]}：${unitName(g)} vs ${opp.name}`);
          let me = 0; let op = 0;
          while (me < 2 && op < 2) {
            const od = ods[qi++ % ods.length];
            b.set('ippon', { odai: `【コンビ大喜利】${od[0]}`, judges: [{ name: '審査員A', pts: 0 }, { name: '審査員B', pts: 0 }, { name: '審査員C', pts: 0 }], need: 3, score: `${unitName(g)} ${me} − ${op} ${opp.name}` });
            const pick = await chooseAnswer(g, `お題「${od[0]}」\n——2人でどう答える？`, od[1].map(([text, q]) => ({ text, q })), r, { auto: skip, skill: sk });
            // the answer you pick and the act's real skill weigh the same; opponents get stronger each round
            const q = clamp(Math.round(pick.q * 0.5 + sk * 0.5 + (harmony - 50) * 0.1 + gauss(r) * 10), 0, 100);
            const oq = clamp(Math.round((opp.power || 66) + s * 3 + gauss(r) * 10), 0, 100);
            const votes = [0, 1, 2].map(() => (q + gauss(r) * 10 >= oq + gauss(r) * 10 ? 1 : 0));
            const v = votes.reduce((a, c) => a + c, 0);
            b.patch({ answer: pick.text, judges: votes.map((x, i) => ({ name: `審査員${'ABC'[i]}`, pts: x ? 2 : 0 })), need: 6, ippon: v >= 2 });
            await pause(g, 40);
            if (v >= 2) me++; else op++;
            await say(g, `${v >= 2 ? '取った！' : `${opp.name}に取られた。`}（${me}−${op}）`);
          }
          m.W = me > op ? (m.A.me ? m.A : m.B) : opp;
          if (me > op) wins++; else alive = false;
        } else m.W = clamp((m.A.power || 60) + gauss(r) * 10, 0, 100) >= clamp((m.B.power || 60) + gauss(r) * 10, 0, 100) ? m.A : m.B;
      }
    }
    const W = rounds[2][0].W;
    show(`優勝：${W.name}`);
    const champ = !!W.me;
    if (champ) { g.sfx('fanfare'); await say(g, `${ordinal(ctx.edition)}AUN、コンビ大喜利王は${unitName(g)}！ 2人で同時に、同じガッツポーズをした。`); champion(g, ctx, 'コンビ大喜利王'); }
    else await say(g, `コンビ大喜利王は${W.name}。`);
    return { passed: champ, champion: champ, score: Math.min(100, 40 + wins * 20), place: champ ? 1 : wins === 2 ? 2 : wins === 1 ? 3 : 5, field: 8, award: champ ? 'コンビ大喜利王' : null };
  });
}

// ============================================================== UNDER5 AWARD（吉本興業, 2023〜）
// VERIFIED: 吉本興業が2023年に創設、芸歴5年目以内（芸歴0〜5年目）の超若手が対象、フリー・アマチュアを含め事務所不問、人数・年齢制限なし;
//   エントリーは大会公式HPで2〜3月（2025年は3月16日まで）; 東京・大阪の1回戦は動画審査、札幌・名古屋・福岡（2023年は沖縄も）は
//   エリア予選; 2回戦〜準決勝は東京・大阪（2023年の東京準決勝は35組）; 決勝は6月、ルミネtheよしもと（2023年6月18日9組、2025年
//   6月22日）; 優勝賞金100万円; エントリー 2023年1797組・2024年2001組・2025年2420組。審査員6人（2023年の発表）。参加費・決勝の
//   採点方式は未確認（ゲーム上：審査員6人×100点）。
// Sources: tokyo-sports.co.jp/articles/-/255477; zaikei.co.jp/releases/2809579, 2912873, 2961014; jprime.jp/articles/-/28554;
//   natalie.mu/owarai/news/575873, 579050; weblio UNDER5 AWARD
const UNDER5 = {
  name: 'UNDER5 AWARD', short: 'UNDER5', kind: 'any', category: 'newcomer', color: '#1aa0d0',
  organizer: '吉本興業', broadcaster: '（決勝は配信など）', venue: '決勝：ルミネtheよしもと', region: 'all',
  history: { founded: 2023, ended: null, gaps: [], revived: null, note: '芸歴5年目以内の超若手No.1決定戦。1回戦は動画審査（東京・大阪）とエリア予選。',
    sources: ['https://www.tokyo-sports.co.jp/articles/-/255477', 'https://www.zaikei.co.jp/releases/2809579/', 'https://natalie.mu/owarai/news/575873', 'https://www.jprime.jp/articles/-/28554'] },
  editionOf: editionCounter(2023),
  labelStyle: 'year',
  schedule: { entry: { from: [2, 5], to: [3, 6] }, final: [6, 6] },
  rounds: [
    { id: 'r1', name: '1回戦（動画審査／エリア予選）', when: [[4, 2], [4, 5]], venues: ['動画審査（東京・大阪）', 'エリア予選（札幌・名古屋・福岡）'], length: 120, pass: 0.35, field: 2400, judge: 'staff', scoring: '東京・大阪は動画審査', run: under5Video },
    { id: 'r2', name: '2回戦', when: [4, 9], venues: ['東京', '大阪'], length: 120, pass: 0.3, field: 850, judge: 'staff', scoring: '劇場審査',
      run: stdRound({ kind: 'any', length: 120, pass: 0.3, field: 850, level: 44, beats: ['芸歴5年目以内だけの楽屋。同期だらけで、修学旅行みたいだ。', '「ここから劇場審査やで」——事務所の先輩が教えてくれた。'] }) },
    { id: 'r3', name: '3回戦', when: [5, 4], venues: ['東京', '大阪'], length: 180, pass: 0.3, field: 250, judge: 'staff', scoring: '劇場審査',
      run: stdRound({ kind: 'any', length: 180, pass: 0.3, field: 250, level: 52, beats: ['3回戦。客席に業界の人らしき姿がちらほら。', 'ネタ時間が少し長くなった。展開をもう一つ。'] }) },
    { id: 'sf', name: '準決勝', when: [5, 9], venues: ['東京', '大阪'], length: 180, pass: 9, field: 70, judge: 'staff', scoring: '東京・大阪の準決勝→決勝9組',
      run: stdRound({ kind: 'any', length: 180, pass: 9, field: 70, level: 58, beats: ['東京の準決勝は35組。楽屋がすごい緊張感だ。', '決勝はルミネtheよしもと。あの舞台に立ちたい。'] }) },
    { id: 'final', name: '決勝', when: [6, 6], length: 240, field: 9, judge: 'panel', judges: 6, scoring: '9組・審査員6人×100点', final: true, run: under5Final },
  ],
  eligibility: { members: [1, null], pro: true, amateur: true, geirekiMax: 5, note: '芸歴5年目以内（フリー・アマチュア可、事務所・人数・年齢は不問）' },
  fee: 0, prize: 1000000, prizeText: '優勝賞金100万円', perform: { kind: 'any', length: 180 },
  news: [
    (g, c) => `『UNDER5 AWARD ${c.year}』エントリー開始。芸歴5年目以内の超若手No.1決定戦`,
    (g, c) => (c.year >= 2026 ? '昨年のエントリーは2420組。年々増え続けている' : c.year === 2025 ? '昨年のエントリーは2001組。今年はさらに増える見込み' : c.year === 2024 ? '昨年の第1回には1797組がエントリー' : '芸歴5年目以内だけの新しい賞レースが始まる'),
    '東京・大阪の1回戦は動画審査。スマホ1台で撮ったネタ動画が勝負',
    '札幌・名古屋・福岡ではエリア予選',
    '決勝はルミネtheよしもと。優勝賞金100万円',
    (g, c) => `「どこよりも早く未来のスターを」——${mediaOf(c.year)}でも芸歴0年の新星が話題`,
  ],
  beats: ['公園の壁を背景に、スマホを三脚に固定した。', 'テイク3。風の音が入った。', '撮った動画を見返すと、相方の声が小さい。'],
};
async function under5Video(g, ctx) {
  const r = rngFor(g, ctx.id, 'video');
  const kind = defaultKind(g);
  // the venue option picked at entry (D1: when/venues), else ask
  const area = ctx.option && ctx.option.venue ? /エリア/.test(ctx.option.venue) : (await g.ask('1回戦はどうする？', ['動画審査（東京・大阪）', 'エリア予選（札幌・名古屋・福岡）'], { cancel: 0 })) === 1;
  if (area) return stdRound({ kind: 'any', length: 120, pass: 0.4, field: 300, level: 40, beats: ['エリア予選の会場は地元の小さなホール。', '地方から全国へ——客席の家族連れが温かい。'] })(g, ctx);
  return withBoard(g, boardSpec(ctx, '1回戦（動画審査）', { set: 'cheap' }), async (b) => {
    b.set('video', { take: 1, label: 'ネタ動画を撮影して提出する' });
    for (const t of pickBeats(UNDER5.beats, r, 2)) await say(g, t);
    const skip = await omakase(g, ctx, '撮影');
    let best = await perform(g, ctx, { kind, length: 120, skip, title: 'UNDER5 AWARD 動画審査（テイク1）', venue: { size: 'small', crowd: 'cold', pressure: 30 } });
    await say(g, `テイク1の出来：${best.score}点。`);
    if (!g.auto && (await g.ask('撮り直す？（体力を使う）', ['撮り直す', 'これで提出する'], { cancel: 1 })) === 0) {
      if (typeof g.useStamina !== 'function' || g.useStamina(10)) {
        b.patch({ take: 2 });
        const t2 = await perform(g, ctx, { kind, length: 120, skip, title: 'UNDER5 AWARD 動画審査（テイク2）', venue: { size: 'small', crowd: 'cold', pressure: 30 } });
        await say(g, `テイク2：${t2.score}点。${t2.score > best.score ? 'こっちを提出しよう。' : 'テイク1のほうが良かった。'}`);
        if (t2.score > best.score) best = t2;
      } else await say(g, '疲れて、撮り直す体力がない。');
    }
    // 動画は「画面映え」と音声が大事：声量が低いと伸びない（ゲーム上の傾向）
    const v = stat(g, 'voice');
    const sc = clamp(Math.round(best.score * 0.85 + v * 0.15), 0, 100);
    const rvs = rivals(g, ctx, 11, { level: 38, kind, amateur: true });
    const st = standing(g, ctx, sc, rvs, { kind, pass: 0.35, field: 2400 });
    b.set('ranking', { rows: st.rows, passLine: st.passN, head: '動画審査　結果' });
    await pause(g, 40);
    return finishRound(g, ctx, { ...best, score: sc }, st, { kind });
  });
}
async function under5Final(g, ctx) {
  const r = rngFor(g, ctx.id, 'u5f');
  const kind = defaultKind(g);
  const rvs = rivals(g, ctx, 8, { level: 64, kind });
  const acts = shuffleR([{ name: unitName(g), me: true }, ...rvs], r);
  const js = judges(g, ctx, 6, ['漫才師', 'コント師', 'ピン芸人', '漫才師（元王者）', 'コント師（劇作家）']);
  return withBoard(g, boardSpec(ctx, '決勝（ルミネtheよしもと）', { set: 'theater' }), async (b) => {
    b.set('card', { name: 'UNDER5 AWARD', edition: `${ctx.year}　決勝`, catch: `芸歴5年目以内、9組の頂上決戦。審査員：${js.map((j) => j.name).join('・')}` });
    await say(g, ['ルミネtheよしもとの客席は満員。', '芸歴5年目以内で、ここまで来た。']);
    const skip = await omakase(g, ctx);
    let my = 0;
    for (const a of acts) a.score = a.me ? (my = (await perform(g, ctx, { kind, length: 240, skip, title: 'UNDER5 AWARD 決勝', venue: { size: 'theater', crowd: 'warm', pressure: 80 } })).score) : rivalScore(g, a, { kind }, r);
    const rows = panelRows(r, acts, 6, 100);
    await showRows(g, b, rows, '決勝　審査員6人×100点', { max: 600, passLine: 1, unit: '点' });
    const champ = rows[0].me;
    if (champ) { g.sfx('fanfare'); await say(g, `UNDER5 AWARD ${ctx.year}、優勝は${unitName(g)}！ 賞金100万円！`); champion(g, ctx, '優勝'); }
    else await say(g, `優勝は${rows[0].name}。${unitName(g)}は${rows.findIndex((x) => x.me) + 1}位。`);
    return { passed: champ, champion: champ, score: my, place: rows.findIndex((x) => x.me) + 1, field: 9, award: champ ? '優勝' : null };
  });
}

export const D2B_DEFS = {
  utaneta: UTANETA, allthats: ALLTHATS, tsugikuru: TSUGIKURU, mxgp: MXGP, ippon: IPPON, suberanai: SUBERANAI,
  omoshirosou: OMOSHIRO, futtonda: FUTTONDA, aun: AUN, under5: UNDER5,
};
// finalist catch copies (D1 shows def.catchcopy(g, ctx))
const CC_B = {
  utaneta: ['歌って笑わす二刀流', 'サビで爆発', '音楽と笑いの申し子'], allthats: ['深夜の爆発力', '1分の暴れん坊', '年末の切り込み隊長'],
  tsugikuru: ['次に来る、の筆頭', '5局が狙う新星', 'ブレイク前夜'], mxgp: ['異端の極み', '地上波ギリギリ', '尖りすぎた才能'],
  ippon: ['大喜利の求道者', 'IPPON製造機', '発想の怪物'], suberanai: ['すべらない語り部', '実話の名手', '円卓の主役'],
  omoshirosou: ['まだ誰も知らない', '新春の大発見', '元日深夜の新星'], futtonda: ['モジりの達人', '布団を飛ばす男', '言葉遊びの職人'],
  aun: ['あうんの呼吸', '二人で一つの答え', 'コンビ大喜利の雄'], under5: ['芸歴5年目以内の怪物', '未来のスター', '超若手の筆頭'],
};
export function defineContestsB(register) {
  for (const [id, def] of Object.entries(D2B_DEFS)) {
    if (!def.catchcopy && CC_B[id]) def.catchcopy = (g, ctx) => `${pickR(CC_B[id], rngFor(g, id, 'cc', ctx && ctx.year))}　${unitName(g)}`;
    register(id, normalizeRuns(def));
  }
}
void nendo; void dstate; void unitSize; void geireki; void power; void partnerLook; void ippCount;
