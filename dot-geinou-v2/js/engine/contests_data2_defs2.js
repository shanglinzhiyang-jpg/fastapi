// 賞レースのデータ その2 (owner: D2b) — part 2: T-1グランプリ, 山-1グランプリ, お笑いホープ大賞, お笑いハーベスト大賞, 花月大賞,
// お笑い成人式, お笑いバイアスロン, 100×100, 30-1 グランプリ.
// Same rules as part 1: verified facts in `facts.verified` (sources in history.sources), the rest generic and worded
// 「（詳細非公開）」; every person fictional; real organizers / broadcasters / venues only; a program title with a real
// person's name in it is not used (山-1 is run by a fictional 審査役).

import { registerContest } from './contests.js';
import { withBackdrop, showMeter, showBoard, showBracket } from './contests_data2_scenes.js';
import { stageRound, castOf } from './contests_data2_flow.js';
import { tellKaidan } from './contests_data2_defs1.js';
import {
  d2, yearOf, unitOf, unitName, memberCount, geirekiOf, playerAgency, isAmateur, powerOf, netaQualityOf,
  rivalsFor, judgesFor, news, stagePerform, judgeField, simScore, rngFor, askSkip, grant, record, roundResult, failReasons,
  edLabel, yen, deviceOf, styleKind, panelPoints, fictionalPerson, prizeLine,
} from './contests_data2_kit.js';
import { clamp } from './util.js';

function elig(note, fn, extra = {}) {
  const f = (g, unit, year) => {
    try { return fn(g, unit || unitOf(g), year ?? yearOf(g)); } catch (e) { console.error(e); return { ok: false, why: '出場資格を確かめられなかった' }; }
  };
  return Object.assign(f, { note }, extra);
}
const OK = { ok: true, why: '' };
const no = (why) => ({ ok: false, why });
const famous = (g) => Number(g.state && g.state.fame) || 0;

// ================================================================== T-1グランプリ（怪談）
// Name: 「T-1グランプリ」はいくつもある（筑波大学の学生団体が12月に開く漫才・コント大会＝来場者投票・優勝賞金3万円、各地の食・お茶の大会など）。
//   一覧で OKOWAチャンピオンシップ（怪談）と並び、芸人も優勝している「最恐の怪談師」を決めるT-1グランプリを採用。
// Verified: YouTubeチャンネル「たっくーTVれいでぃお」の大会「T-1グランプリ 〜最恐を極めし者達の戦い〜」。2023年に始まり2025年がラストイヤー
//   （2025年4月4日開催が最終回）。2025年：推薦出場者7名＋一般募集枠を勝ち上がった3名＝10名、ゲスト審査員と視聴者投票で優勝決定。2024年大会は3月.
// Unverified: 一般募集の応募数、持ち時間、ゲスト審査員の人数・配点 → generic. 2026年以降は復刻開催.
const T1_SRC = ['https://www.takkutvradio.jp/T-1_2025/', 'https://www.youtube.com/watch?v=HHjLr5hmSeI', 'https://www.t-act.tsukuba.ac.jp/wp/wp-content/uploads/2018/01/2017ex_04.pdf'];
registerContest('t1', {
  name: 'T-1グランプリ', short: 'T-1', kind: 'talk', category: 'special',
  names: [{ from: 2023, name: 'T-1グランプリ' }],
  organizer: 'YouTubeチャンネル「たっくーTVれいでぃお」', broadcaster: 'YouTube生配信', venue: '配信スタジオ', region: 'tokyo',
  history: { founded: 2023, ended: 2025, note: '最恐の怪談師を決める大会。推薦出場者と一般募集枠の勝者が本戦に並び、ゲスト審査員と視聴者の投票で決まる。', sources: T1_SRC },
  schedule: { entry: { from: [1, 1], to: [2, 5] }, final: [4, 2] },
  eligibility: { pro: true, amateur: true, note: '推薦出場（主催の推薦）または一般募集枠（プロ・アマ・ジャンル不問）' },
  prizeText: '最恐の称号',
  perform: { kind: 'talk' },
  facts: { verified: ['怪談の大会「最恐を極めし者達の戦い」', '2023年開始・2025年ラストイヤー（4/4最終回）', '推薦7名＋一般募集枠3名＝10名', 'ゲスト審査員＋視聴者投票', '2024年大会は3月'], unverified: ['一般募集の応募数', '持ち時間', '審査員の人数・配点'] },
  rounds: [
    {
      id: 'r1', name: '一般募集枠 予選（3枠）', when: [3, 3], judge: 'staff', field: 60, pass: 3,
      run: async (g, ctx) => {
        if (famous(g) >= 1500) {
          await g.say(['主催から連絡が来た。「今年は推薦枠でお願いできませんか」', '推薦出場者7名の一人として、本戦から出場する。']);
          const out = roundResult({ score: 70 }, { passed: true, place: null, field: null, comment: '推薦枠' });
          record(g, ctx, 'r1', out);
          return out;
        }
        const skip = await askSkip(g, ctx, 'r1');
        return withBackdrop(g, 'kaidan', { title: ctx.def.name, sub: `${edLabel(ctx)} 一般募集枠 予選`, sign: '最恐を極めし者達の戦い', cast: castOf(g) }, async () => {
          if (!skip) await g.say(['一般募集枠から本戦に上がれるのは3名だけ。', '残りの7名は推薦。ここで勝たなければ、名前も覚えてもらえない。']);
          const res = await tellKaidan(g, ctx, 'r1', { skip, title: '予選の怪談', show: 'T-1グランプリ 予選' });
          const j = judgeField(g, ctx, 'r1', res.fear, { field: 60, pass: 3, sample: 20, level: 50, kind: 'talk', pinOnly: true });
          const out = roundResult({ ...res, score: res.fear }, { passed: j.passed, place: j.place, field: j.field });
          if (j.passed) await g.say(`一般募集枠、通過！（推定${j.place}位）本戦の10名に入った。`);
          else { out.reasons = failReasons(g, 'talk', res); await g.say([`予選敗退（推定${j.place}位／約${j.field}名・通過3名）。`, `足りなかったもの：${out.reasons.join('、')}`]); }
          record(g, ctx, 'r1', out);
          return out;
        });
      },
    },
    {
      id: 'final', name: '本戦（10名）', when: [4, 2], judge: 'points', field: 10, final: true, tv: true,
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'final');
        return withBackdrop(g, 'kaidan', { title: ctx.def.name, sub: `${edLabel(ctx)} 本戦（生配信）`, sign: 'T-1グランプリ 本戦', cast: castOf(g) }, async () => {
          if (!skip) await g.say(['本戦。推薦7名と一般募集枠3名、計10名。', 'ゲスト審査員の採点と、配信を見ている視聴者の投票で「最恐」が決まる。']);
          const res = await tellKaidan(g, ctx, 'final', { skip, title: '本戦の怪談', show: 'T-1グランプリ', pressure: 80 });
          await showMeter(g, { title: '恐怖メーター', sub: `${edLabel(ctx)}　${unitName(g)}`, label: '恐さ（コメント欄の悲鳴を含む）', unit: '', samples: res.heat, value: res.fear, decimals: 0, theme: 'fear' });
          const judges = judgesFor(g, ctx, 3, ['怪談作家', 'オカルト雑誌編集者', 'ホラー映画監督']);
          const r = rngFor(g, ctx.id, ctx.year, 't1');
          const rv = rivalsFor(g, ctx, 'final', 9, { level: 62, kind: 'talk', pinOnly: true });
          const all = rv.map((x) => ({ name: x.name, fear: clamp(Math.round(simScore(g, 'talk', x.power, x.quality, r) * 0.72 + 20), 0, 100) }));
          all.push({ name: unitName(g), fear: res.fear, me: true });
          const tot = all.reduce((a, x) => a + x.fear ** 2, 0) || 1;
          for (const x of all) {
            x.judge = panelPoints(g, ctx, 'final', x.fear, judges, 10, x.name).total; // 30点満点（ゲーム内の配点）
            x.vote = Math.round((x.fear ** 2 / tot) * 100);
            x.total = x.judge + Math.round(x.vote * 0.3);
          }
          all.sort((a, b) => b.total - a.total || (a.me ? -1 : 1));
          const place = all.findIndex((x) => x.me) + 1;
          await showBoard(g, {
            title: 'T-1グランプリ 本戦 結果', sub: `${edLabel(ctx)}　ゲスト審査員＋視聴者投票`,
            cols: [{ key: 'place', label: '順', w: 44 }, { key: 'name', label: '名前', w: 270 }, { key: 'judge', label: '審査員', w: 90, align: 'right' }, { key: 'vote', label: '視聴者', w: 90, align: 'right' }, { key: 'total', label: '計', w: 90, align: 'right' }],
            rows: all.map((x, i) => ({ place: i + 1, name: x.name, judge: x.judge, vote: `${x.vote}%`, total: x.total, me: x.me })), max: 10,
          });
          const out = roundResult({ ...res, score: res.fear }, { passed: true, place, field: 10 });
          if (place === 1) { out.champion = true; out.award = '最恐'; await g.say([`T-1グランプリ、最恐は――${unitName(g)}。`, 'お笑いとは別の筋肉を使った。心身ともに、ぐったりだ。']); }
          else { out.reasons = failReasons(g, 'talk', res); await g.say([`${place}位。最恐は「${all[0].name}」。`, `足りなかったもの：${out.reasons.join('、')}`]); }
          news(g, ctx, `【T-1グランプリ】${edLabel(ctx)}、最恐の称号は${all[0].name}に`);
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    '最恐の怪談師を決める「T-1グランプリ」。推薦7名と一般募集枠3名が本戦へ',
    'T-1グランプリ、優勝はゲスト審査員と視聴者の投票で決定',
    '「お笑いとは別ジャンル」――芸人が怪談の大会に挑む理由',
    (g, ctx) => (ctx.year === 2025 ? 'T-1グランプリ、今年がラストイヤーに' : ctx.revival ? 'T-1グランプリが復刻開催。最恐の座をめぐる戦いが再び' : 'T-1グランプリ本戦、生配信のコメント欄が悲鳴で埋まる'),
    (g, ctx) => `夜中に見るな――T-1グランプリ ${edLabel(ctx)}の配信、${deviceOf(ctx.year)}で視聴する人が続出`,
  ],
  catchcopy: () => '笑いの間を、恐怖の間に',
});

// ================================================================== 山-1グランプリ
// Verified: 日本テレビ「ダウンタウンのガキの使いやあらへんで！」の新春恒例企画（大新年会）。芸人がネタを披露し、審査役が「独断」で採点
//   （会場でウケても低い点のことがある）。「ブレイク芸人の登竜門」。第17回=2023年1月22日、第19回=2025年1月26日、
//   第20回=2026年1月25日放送（12組出場）。→ 第1回は逆算で2007年。
// Unverified: 点数の満点、持ち時間 → ゲーム内の設定（100点満点の独断点）.
// The real 審査役 is a real person: here the 審査役 is the fictional 「鴫原 山兵衛」 (the title is used only as the title).
const YAMA1_SRC = ['https://natalie.mu/owarai/news/657322', 'https://natalie.mu/owarai/news/658499', 'https://natalie.mu/owarai/news/609111', 'https://natalie.mu/owarai/news/43786', 'https://www.thetvdb.com/series/down-town-gaki-no-tsukai/seasons/official/2023'];
const YAMA_JUDGE = '鴫原 山兵衛'; // fictional (rare surname × old-fashioned given name)
const YAMA_TASTES = [
  { t: '勢い', text: '今年は「勢い」の気分', likes: 1 },
  { t: 'キャラ', text: '今年は「キャラの濃さ」に弱い', likes: 2 },
  { t: '正統派', text: '今年は「ちゃんとしたネタ」を見たい', likes: 0 },
  { t: 'すべり', text: '今年は「すべっても折れない芸人」が好き', likes: 3 },
];
registerContest('yama1', {
  name: '山-1グランプリ', short: '山-1', kind: 'any', category: 'tv',
  organizer: '日本テレビ', broadcaster: '日本テレビ系「ダウンタウンのガキの使いやあらへんで！」（新春企画）', venue: '大新年会の宴会場（収録スタジオ）', region: 'tokyo',
  history: { founded: 2007, ended: null, note: '新春恒例「大新年会」の企画。ブレイク前の芸人がネタを披露し、審査役がすべて独断で採点する。', sources: YAMA1_SRC },
  schedule: { entry: null, final: [1, 8] },
  eligibility: { pro: true, amateur: false, invite: { fame: 150 }, note: 'ブレイク前の芸人（番組が招く「ブレイク芸人の登竜門」・招待制）' },
  fee: 0, prizeText: '優勝の称号',
  facts: { verified: ['日本テレビ「ガキの使い」新春恒例企画（大新年会）', '審査役の独断採点', 'ブレイク芸人の登竜門', '第17回2023/1/22・第19回2025/1/26・第20回2026/1/25（12組）'], unverified: ['第1回=2007年（逆算）', '点数の満点', '持ち時間'] },
  rounds: [
    {
      id: 'final', name: '大新年会 ネタ披露（12組）', when: [1, 8], judge: 'panel', judges: 1, field: 12, final: true, tv: true,
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'final');
        const r = rngFor(g, ctx.id, ctx.year, 'yama');
        const taste = YAMA_TASTES[Math.floor(r() * YAMA_TASTES.length)];
        return withBackdrop(g, 'banquet', { title: ctx.def.name, sub: `${edLabel(ctx)}　大新年会`, sign: '大新年会　山-1グランプリ', cast: castOf(g) }, async () => {
          if (!skip) await g.say(['新年会の宴会場。出演者の先輩芸人たちが、お膳を前にこちらを見ている。', `審査役は${YAMA_JUDGE}。採点は――独断。`, `うわさでは、${taste.text}らしい。`]);
          let style = 0;
          if (!skip) style = await g.ask('どんなネタでいく？', ['正統派のネタ', '勢いの一発ギャグ連発', 'キャラ全開', 'すべっても粘る'], { cancel: 0 });
          const res = await stagePerform(g, ctx, { kind: 'any', round: 'final', title: '山-1グランプリ', venue: { name: '大新年会の宴会場', size: 'tv', crowd: 'tough', pressure: 70 }, skip });
          const dokudan = (score, st, who) => { const rr = rngFor(g, ctx.id, ctx.year, 'dokudan', who); return clamp(Math.round(score * 0.6 + (st === taste.likes ? 22 : 0) + (rr() - 0.5) * 36), 0, 100); };
          const mine = dokudan(res.score, style, 'me');
          const rv = rivalsFor(g, ctx, 'final', 11, { level: 50 });
          const rows = rv.map((x) => { const sc = simScore(g, 'manzai', x.power, x.quality, r); return { name: x.name, uke: sc, pt: dokudan(sc, Math.floor(r() * 4), x.name) }; });
          rows.push({ name: unitName(g), uke: res.score, pt: mine, me: true });
          rows.sort((a, b) => b.pt - a.pt || (a.me ? -1 : 1));
          const place = rows.findIndex((x) => x.me) + 1;
          await showBoard(g, {
            title: `山-1グランプリ　${YAMA_JUDGE}の独断採点`, sub: `${edLabel(ctx)}　会場のウケと点数は一致しない`,
            cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 320 }, { key: 'uke', label: '会場ウケ', w: 110, align: 'right' }, { key: 'pt', label: '独断点', w: 110, align: 'right' }],
            rows: rows.map((x, i) => ({ place: i + 1, name: x.name, uke: x.uke, pt: x.pt, me: x.me })), max: 9, note: `${YAMA_JUDGE}：今年は「${taste.t}」の気分。文句は受け付けません`,
          });
          const out = roundResult(res, { passed: true, place, field: 12, dokudan: mine });
          if (place === 1) { out.champion = true; out.award = '優勝'; await g.say([`山-1グランプリ、優勝は${unitName(g)}！`, '宴会場の先輩たちが「なんでやねん！」と叫びながら拍手している。']); }
          else {
            out.reasons = res.score >= 70 ? ['会場はウケていたが、審査役の「今年の気分」と合わなかった'] : failReasons(g, styleKind(g), res);
            await g.say([`${place}位（独断点${mine}）。優勝は「${rows[0].name}」。`, out.reasons[0]]);
          }
          news(g, ctx, `【山-1】${edLabel(ctx)}は${rows[0].name}が独断採点を制す。「ブレイク芸人の登竜門」`);
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    '新春恒例の大新年会で「山-1グランプリ」。ブレイク前の芸人がネタを披露',
    '山-1グランプリは審査役の独断採点。会場でウケても点が出ないことも',
    (g, ctx) => `「ブレイク芸人の登竜門」山-1グランプリ、${edLabel(ctx)}の出場組が発表`,
    (g, ctx) => `${ctx.year}年1月の夜、${deviceOf(ctx.year)}で山-1の感想があふれる`,
    '山-1グランプリの歴代優勝者、翌年にテレビで見る顔に',
  ],
  catchcopy: () => '点数は、気分しだい',
});

// ================================================================== お笑いホープ大賞
// Verified: 主催「お笑いコンベンション実行委員会」（在京プロダクション38社）。在京プロダクション一押しの若手芸人がジャンルを問わずネタを競い、
//   その年いちばんの「ホープ」を決める。観客の採点が勝ち上がりに大きく影響。第1回2003年〜第6回2008年「お笑いホープ大賞 THE FINAL」
//   （新たな賞レースに生まれ変わるため最後の大会。2008年の大賞は結成8年目のコンビ）。
// Unverified: 予選の段階数・日程（2008年の決勝は5月上旬の記事）、賞金、芸歴の上限 → generic（ゲームでは芸歴10年以内）。2009年以降は復刻開催.
const HOPE_SRC = ['https://news.mynavi.jp/article/20080507-a003/', 'https://scrapbox.io/lololololol/お笑いホープ大賞', 'https://www.weblio.jp/content/お笑いホープ大賞', 'https://www.wikiwand.com/ja/articles/お笑いホープ大賞'];
registerContest('hope', {
  name: 'お笑いホープ大賞', short: 'ホープ大賞', kind: 'any', category: 'newcomer',
  awardType: true, awards: ['お笑いホープ大賞'],
  names: [{ from: 2003, name: 'お笑いホープ大賞' }, { from: 2008, name: 'お笑いホープ大賞 THE FINAL' }, { from: 2009, name: 'お笑いホープ大賞' }],
  organizer: 'お笑いコンベンション実行委員会（在京プロダクション38社）', broadcaster: null, venue: '東京都内のホール', region: 'tokyo',
  history: { founded: 2003, ended: 2008, note: '在京プロダクション各社が一押しの若手を送り込み、ジャンル不問で競う。勝ち上がりは観客の採点で決まる。', sources: HOPE_SRC },
  schedule: { entry: { from: [2, 1], to: [2, 10] }, final: [5, 2] },
  eligibility: { pro: true, amateur: false, geirekiMax: 10, note: '在京プロダクションが推す若手（事務所の推薦・芸歴10年以内）' },
  prizeText: 'お笑いホープ大賞',
  facts: { verified: ['お笑いコンベンション実行委員会（在京38社）', '在京プロ一押しの若手・ジャンル不問', '観客の採点が勝ち上がりに大きく影響', '第1回2003〜第6回2008「THE FINAL」'], unverified: ['予選の段階・日程', '賞金', '芸歴の上限'] },
  rounds: [
    { id: 'r1', name: '予選（観客採点）', when: [3, 5], judge: 'audience', field: 80, pass: 0.3, run: (g, ctx) => stageRound(g, ctx, { round: 'r1', name: '予選（観客採点）', scene: 'theater', sign: 'お笑いホープ大賞', field: 80, pass: 0.3, level: 46, scoreLabel: '票', judgeText: '審査：観客の採点（客席100人の票）', intro: ['在京の事務所が「今年の一押し」を送り込む。', '勝ち上がりを決めるのは、客席の採点だ。'] }) },
    { id: 'semi', name: '準決勝（観客採点）', when: [4, 5], judge: 'audience', field: 24, pass: 8, run: (g, ctx) => stageRound(g, ctx, { round: 'semi', name: '準決勝（観客採点）', scene: 'theater', sign: 'お笑いホープ大賞 準決勝', field: 24, pass: 8, level: 56, scoreLabel: '票', intro: ['準決勝。各社の一押しが24組。'] }) },
    { id: 'final', name: '決勝', when: [5, 2], judge: 'audience', field: 8, final: true, run: (g, ctx) => stageRound(g, ctx, { round: 'final', name: ctx.year === 2008 ? '決勝 THE FINAL' : '決勝', scene: 'theater', sign: ctx.year === 2008 ? 'お笑いホープ大賞 THE FINAL' : 'お笑いホープ大賞 決勝', field: 8, pass: 1, sample: 7, level: 62, final: true, scoreLabel: '票', intro: (gg, c) => [c.year === 2008 ? '最後のホープ大賞、THE FINAL。' : '決勝。', '今年いちばんの「ホープ」が、ここで決まる。'], awards: [{ place: 1, name: 'お笑いホープ大賞', fame: 150, fans: 1400 }] }) },
  ],
  news: [
    '在京プロダクションの一押し若手が集結「お笑いホープ大賞」。ジャンル不問',
    'お笑いホープ大賞、勝ち上がりは観客の採点で決まる',
    (g, ctx) => (ctx.year === 2008 ? 'お笑いホープ大賞、今年の「THE FINAL」で最後に。新たな賞レースへ生まれ変わる' : ctx.revival ? 'お笑いホープ大賞が復刻開催。在京各社が一押しを送り込む' : 'お笑いホープ大賞の歴代大賞、翌年テレビで大ブレイクのジンクス'),
    (g, ctx) => `${deviceOf(ctx.year)}の待ち受けを大賞トロフィーに――ホープ大賞の若手たち`,
    'お笑いホープ大賞、事務所の推薦枠をめぐって若手の社内オーディションが白熱',
  ],
  catchcopy: () => '今年いちばんの「ホープ」',
});

// ================================================================== お笑いハーベスト大賞
// Verified: 主催 一般社団法人日本音楽事業者協会（音事協）。毎月の定例ライブ「JAMEお笑いハーベスト」の年間グランプリ。漫才・コント・ピン芸が同じ舞台で
//   戦う「お笑いの異種格闘技戦」。予選会→準決勝→決勝（5組）。審査は審査委員長らの審査員と観客。第1回2010年〜第9回2018年
//   （2018年は「あなたが選ぶ！お笑いハーベスト大賞2018」、7月に決勝）.
// Unverified: 2019年以降（確認できず → 2018年を最後の確認回として扱い、以降は復刻開催）、賞金、加盟社の範囲（ゲームでは区別しない）.
const HARV_SRC = ['https://natalie.mu/owarai/news/239059', 'https://natalie.mu/owarai/news/293037', 'https://natalie.mu/owarai/news/121122', 'https://natalie.mu/owarai/news/153517', 'https://ja.wikipedia.org/wiki/お笑いハーベスト大賞', 'https://news.yahoo.co.jp/expert/articles/54830f8f5fc0f719baa364cfacabc7507e204234'];
registerContest('harvest', {
  name: 'お笑いハーベスト大賞', short: 'ハーベスト', kind: 'any', category: 'newcomer',
  awardType: true, awards: ['お笑いハーベスト大賞'],
  names: [{ from: 2010, name: 'お笑いハーベスト大賞' }, { from: 2018, name: 'あなたが選ぶ！お笑いハーベスト大賞' }],
  organizer: '一般社団法人日本音楽事業者協会（音事協）', broadcaster: null, venue: '都内の劇場', region: 'tokyo',
  history: { founded: 2010, ended: 2018, note: '音事協の月例ライブ「JAMEお笑いハーベスト」の年間グランプリ。漫才・コント・ピン芸が同じ舞台で戦う「お笑いの異種格闘技戦」。', sources: HARV_SRC },
  schedule: { entry: { from: [3, 1], to: [3, 10] }, final: [7, 9] },
  eligibility: { pro: true, amateur: false, geirekiMax: 10, note: '音事協の加盟プロダクションに所属する若手（芸歴10年以内）' },
  prizeText: 'お笑いハーベスト大賞',
  facts: { verified: ['主催 音事協', '月例ライブ「JAMEお笑いハーベスト」の年間グランプリ', '漫才・コント・ピンの異種格闘技戦', '予選会→準決勝→決勝5組', '審査員＋観客', '第1回2010〜第9回2018', '2018名称「あなたが選ぶ！お笑いハーベスト大賞2018」・7月決勝'], unverified: ['2019年以降', '賞金', '加盟社の範囲', '芸歴の上限'] },
  rounds: [
    { id: 'r1', name: '予選会（月例ライブ）', when: [[4, 5], [5, 5], [6, 5]], judge: 'panel', field: 40, pass: 0.3, run: (g, ctx) => stageRound(g, ctx, { round: 'r1', name: '予選会（月例ライブ）', scene: 'theater', sign: 'JAMEお笑いハーベスト', field: 40, pass: 0.3, level: 44, genreTags: true, board: true, intro: ['毎月の「JAMEお笑いハーベスト」。漫才もコントもピンも、同じ舞台で戦う。', '一年の実りを刈り取るのは、だれだ。'] }) },
    { id: 'semi', name: '準決勝', when: [7, 3], judge: 'panel', field: 20, pass: 5, run: (g, ctx) => stageRound(g, ctx, { round: 'semi', name: '準決勝', scene: 'theater', sign: 'お笑いハーベスト大賞 準決勝', field: 20, pass: 5, level: 54, genreTags: true, intro: ['準決勝。決勝に進めるのは5組。'] }) },
    { id: 'final', name: '決勝（5組）', when: [7, 9], judge: 'panel', field: 5, final: true, run: (g, ctx) => stageRound(g, ctx, { round: 'final', name: '決勝（5組）', scene: 'theater', sign: 'お笑いハーベスト大賞', field: 5, pass: 1, sample: 4, level: 62, final: true, genreTags: true, judgesN: 5, judgeTitles: ['審査委員長', '放送作家', '番組プロデューサー', '劇場支配人', '演芸評論家'], judgeText: '審査：審査委員長らの審査員＋観客', boardNote: '漫才・コント・ピンが同じ舞台で戦う「お笑いの異種格闘技戦」', intro: ['決勝の5組。ジャンルはばらばら。比べようのないものを比べる夜。'], awards: [{ place: 1, name: 'お笑いハーベスト大賞', fame: 140, fans: 1300 }] }) },
  ],
  news: [
    '音事協の「お笑いハーベスト大賞」。漫才・コント・ピンが同じ舞台の「異種格闘技戦」',
    '月例ライブ「JAMEお笑いハーベスト」から年間グランプリへ。決勝は5組',
    'お笑いハーベスト大賞、審査は審査委員長らと観客',
    (g, ctx) => (ctx.year === 2018 ? '「あなたが選ぶ！お笑いハーベスト大賞2018」決勝の5組が決定' : ctx.revival ? 'お笑いハーベスト大賞が復刻開催。若手の“収穫祭”が帰ってきた' : 'ハーベスト大賞の歴代王者、各局のネタ番組で活躍'),
    (g, ctx) => `${ctx.year}年のハーベスト、ピン芸人が決勝に何組残るか`,
  ],
  catchcopy: () => '一年分の実りを、刈り取れ',
});

// ================================================================== 花月大賞
// Verified (Wikipedia via Wikiwand): 吉本興業が1984年・1985年に、所属タレントと吉本と関係の深い人に贈った賞（2回）.
// Unverified: 部門、選考方法、授賞式の時期・会場 → generic（年末、劇場での授賞式）。1986年以降は復刻開催（1987年開始の昭和スタートで第4回）.
// Venue by era: なんば花月 until 1987 / なんばグランド花月 from 1988 (game wording).
const KAGETSU_SRC = ['https://www.wikiwand.com/ja/花月大賞'];
registerContest('kagetsu', {
  name: '花月大賞', short: '花月大賞', kind: 'any', category: 'agency',
  awardType: true, awards: ['花月大賞'], // several 受賞者 a year, no 「優勝」 (DECISIONS6 #10)
  organizer: '吉本興業', broadcaster: null, venue: 'なんばグランド花月', region: 'osaka',
  history: { founded: 1984, ended: 1985, note: '吉本興業が、劇場で活躍した所属タレントと吉本にゆかりの深い人に贈る賞。', sources: KAGETSU_SRC },
  schedule: { entry: null, final: [12, 8] },
  eligibility: { agency: ['yoshimoto'], invite: { fame: 0 }, repeat: true, note: 'よしもと所属のタレント（選考制。会社から授賞式に呼ばれる）' },
  fee: 0, prizeText: '花月大賞',
  facts: { verified: ['吉本興業', '1984年・1985年の2回', '所属タレントと吉本と関係の深い人に贈る'], unverified: ['部門', '選考方法', '時期・会場', '賞金'] },
  rounds: [
    {
      id: 'senkou', name: '選考（一年の劇場と活躍）', when: [12, 3], judge: 'staff', field: 30, pass: 3,
      run: async (g, ctx) => {
        const y = ctx.year;
        const o = typeof g.owarai === 'function' ? g.owarai() : null;
        const stages = Number(o && o.stages) || d2(g).log.filter((x) => x.year === y).length;
        const wins = Object.values(d2(g).wins).filter((a) => Array.isArray(a) && a.includes(y)).length;
        const pts = clamp(Math.round(powerOf(g, styleKind(g)) * 0.55 + Math.min(25, stages) + Math.min(20, famous(g) / 500) + wins * 12), 0, 100);
        return withBackdrop(g, 'ceremony', { title: ctx.def.name, sub: `${edLabel(ctx)}　選考`, sign: '花月大賞', cast: castOf(g) }, async () => {
          const j = judgeField(g, ctx, 'senkou', pts, { field: 30, pass: 3, sample: 12, level: 45 });
          d2(g).flags[`kagetsu_${y}`] = j.rows.slice(0, 3).map((x) => x.name);
          const out = roundResult({ score: pts }, { passed: j.passed, place: j.place, field: j.field });
          if (j.passed) await g.say(['会社から連絡があった。「今年の花月大賞、受賞が決まりました」', '年末の授賞式に呼ばれた！']);
          else { out.reasons = ['劇場の出番の数', '一年のウケと話題']; await g.say(['今年の花月大賞は、受賞ならず。', '来年は、自分があの舞台に呼ばれたい。']); }
          record(g, ctx, 'senkou', out);
          return out;
        });
      },
    },
    {
      id: 'final', name: '授賞式', when: [12, 8], judge: 'staff', final: true,
      run: async (g, ctx) => {
        const y = ctx.year;
        const venue = y <= 1987 ? 'なんば花月' : 'なんばグランド花月';
        return withBackdrop(g, 'ceremony', { title: ctx.def.name, sub: `${edLabel(ctx)}　${venue}`, sign: `花月大賞　${venue}`, cast: castOf(g) }, async () => {
          await g.say([`年の瀬の${venue}。吉本の芸人と、吉本を支えてきた人たちが集まる。`, '花月大賞――この一年、劇場と会社に尽くした者に贈られる賞だ。']);
          const winners = (d2(g).flags[`kagetsu_${y}`] || [unitName(g)]).slice(0, 3);
          if (!winners.includes(unitName(g))) winners[winners.length - 1] = unitName(g);
          await showBoard(g, {
            title: `${ctx.def.name}　受賞者`, sub: `${edLabel(ctx)}　受賞者`, cols: [{ key: 'name', label: '受賞者', w: 600 }],
            rows: [...winners.map((n) => ({ name: n, me: n === unitName(g) })), { name: `劇場を支えた裏方：${fictionalPerson(rngFor(g, ctx.id, y, 'staff'))}さん（劇場スタッフ）` }],
          });
          await g.say(['花月大賞、受賞！', '授賞式のあと、記念にひとネタ披露することになった。']);
          const skip = await askSkip(g, ctx, 'final');
          const res = await stagePerform(g, ctx, { kind: styleKind(g), round: 'kinen', title: '受賞記念のネタ', venue: { name: venue, size: 'hall', crowd: 'warm', pressure: 30 }, skip });
          const out = roundResult(res, { passed: true, place: 1, field: 3, champion: true, award: '花月大賞', awardWinners: { 花月大賞: winners.slice() } });
          news(g, ctx, `【吉本】${edLabel(ctx)}花月大賞、受賞は${winners.join('、')}`);
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    (g, ctx) => `吉本の「花月大賞」、${ctx.year <= 1987 ? 'なんば花月' : 'なんばグランド花月'}で授賞式`,
    '花月大賞、所属タレントだけでなく劇場を支えた人にも',
    (g, ctx) => (ctx.revival ? '花月大賞が復刻。往年の吉本の名物賞がよみがえる' : '花月大賞、今年の受賞者に若手の名前'),
    '劇場の出番を誰よりも多くこなした芸人に、花月大賞の声',
    (g, ctx) => (ctx.year < 1996 ? '花月の楽屋で話題は花月大賞。電話で家族に報告する芸人も' : '花月大賞の受賞者、劇場の看板に名前が並ぶ'),
  ],
  catchcopy: () => '劇場に生き、劇場に愛された',
});

// ================================================================== お笑い成人式
// Verified: BSフジの特番。第1回はBSフジ開局20周年記念特別番組（2020年3月）「お笑い成人式 実力派芸人たちの一夜限りの漫才フェスティバル！！」：
//   芸歴20年以上の中堅漫才師10組（ベテラン漫才師らが推薦する「まだ日の目を見ていないけれど、力のある漫才師」）、無観客、審査委員長と審査員。
//   第2回は2020年11月（有観客、2021年1月1日放送の「お笑い成人式ライブ」第2弾）、2022年1月1日「お笑い成人式ライブ2022」（第3弾、審査員と観客投票）、
//   2024年「お笑い成人式2024」。「成人式」＝芸歴が二十歳（20年）ということ（新成人＝20歳の若者の大会ではない）.
// Unverified: 2023年・2025年以降の開催、賞金、ネタ時間 → ゲームでは毎年1月（正月特番）に開催、回数は通し番号.
const SEIJIN_SRC = ['https://www.bsfuji.tv/seijin/pub/index.html', 'https://www.bsfuji.tv/seijinshikilive/pub/', 'https://www.bsfuji.tv/seijinshiki/pub/index.html', 'https://lp.p.pia.jp/article/news/256948/index.html', 'https://www.shochikugeino.co.jp/topics/news/101289/', 'https://tvguide.myjcom.jp/detail/?eid=3_732485'];
const VOWS = ['「あと20年、センターマイクの前に立ち続けます」', '「売れても売れなくても、相方と漫才をやめません」', '「今夜、日の目を見ます」'];
registerContest('seijinshiki', {
  name: 'お笑い成人式', short: '成人式', kind: 'manzai', category: 'tv',
  names: [{ from: 2020, name: 'お笑い成人式' }, { from: 2021, name: 'お笑い成人式ライブ' }, { from: 2024, name: 'お笑い成人式' }],
  organizer: 'BSフジ', broadcaster: 'BSフジ', venue: 'BSフジ スタジオ（公開収録）', region: 'tokyo',
  history: { founded: 2020, ended: null, note: '芸歴20年を迎えた漫才師の「成人式」。ベテランが推薦する、まだ日の目を見ていない実力派の漫才戦。', sources: SEIJIN_SRC },
  schedule: { entry: null, final: [1, 1] },
  eligibility: { geirekiMin: 20, pro: true, amateur: false, members: [2, null], invite: { fame: 0 }, note: '芸歴20年以上の漫才師（ベテラン漫才師の推薦・招待制）' },
  fee: 0, prizeText: '優勝の称号',
  perform: { kind: 'manzai' },
  facts: { verified: ['BSフジ', '2020年3月 開局20周年記念・芸歴20年以上の漫才師10組・無観客・審査委員長と審査員', 'ベテラン推薦の「まだ日の目を見ていないけれど力のある漫才師」', '2020年11月 第2回（有観客）', '2022年1月1日 第3弾（審査員＋観客投票）', '2024年「お笑い成人式2024」'], unverified: ['2023年・2025年以降', '賞金', 'ネタ時間'] },
  rounds: [
    {
      id: 'final', name: 'ネタ披露（推薦10組）', when: [1, 1], judge: 'points', field: 10, final: true, tv: true,
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'final');
        const r = rngFor(g, ctx.id, ctx.year, 'vet');
        const vet = judgesFor(g, ctx, 1, ['ベテラン漫才師'])[0];
        const noAudience = ctx.year === 2020;
        return withBackdrop(g, 'studio', { title: ctx.def.name, sub: `${edLabel(ctx)}　芸歴20年以上の漫才師たち`, sign: 'お笑い成人式', signColor: '#ff7eb6', cast: castOf(g) }, async () => {
          if (!skip) {
            await g.say([`${deviceOf(ctx.year)}が鳴った。ベテラン漫才師・${vet.name}からだ。`, `「お前らを推薦しといた。芸歴20年、成人式や。まだ日の目を見てへんけど、力はある――そう書いといたで」`]);
            const v = await g.ask('成人式の「誓いの言葉」は？', VOWS, { cancel: 0 });
            await g.say(`${unitName(g)}：${VOWS[v]}`);
          }
          const res = await stagePerform(g, ctx, { kind: 'manzai', round: 'final', title: 'お笑い成人式', venue: { name: 'BSフジ スタジオ', size: 'tv', crowd: noAudience ? 'cold' : 'warm', pressure: 60 }, skip });
          const judges = judgesFor(g, ctx, 4, ['審査委員長（漫才師）', '構成作家', 'タレント', '俳優']);
          const rv = rivalsFor(g, ctx, 'final', 9, { level: 66, kind: 'manzai', amateurTag: false });
          const rows = rv.map((x) => ({ name: x.name, s: simScore(g, 'manzai', x.power, x.quality, r) }));
          rows.push({ name: unitName(g), s: res.score, me: true });
          for (const x of rows) { x.j = panelPoints(g, ctx, 'final', x.s, judges, 100, x.name).total; x.a = noAudience ? 0 : clamp(Math.round(x.s + (r() - 0.5) * 20), 0, 100); x.t = x.j + x.a; }
          rows.sort((a, b) => b.t - a.t || (a.me ? -1 : 1));
          const place = rows.findIndex((x) => x.me) + 1;
          await showBoard(g, {
            title: 'お笑い成人式　結果', sub: `${edLabel(ctx)}　${noAudience ? '無観客（審査員のみ）' : '審査員＋観客投票'}`,
            cols: [{ key: 'place', label: '順', w: 44 }, { key: 'name', label: '名前', w: 300 }, { key: 'j', label: '審査員', w: 90, align: 'right' }, { key: 'a', label: '観客', w: 80, align: 'right' }, { key: 't', label: '計', w: 80, align: 'right' }],
            rows: rows.map((x, i) => ({ place: i + 1, name: x.name, j: x.j, a: noAudience ? '—' : x.a, t: x.t, me: x.me })), max: 10,
          });
          const out = roundResult(res, { passed: true, place, field: 10 });
          if (place === 1) { out.champion = true; out.award = '優勝'; await g.say(['お笑い成人式、優勝！', '芸歴20年目の晴れ着。やっと日の目を見た。']); }
          else { out.reasons = failReasons(g, 'manzai', res); await g.say([`${place}位。優勝は「${rows[0].name}」。`, '同期たちと並んだ「成人式」の写真は、一生の宝物になった。']); }
          news(g, ctx, `【お笑い成人式】芸歴20年超えの漫才戦、${edLabel(ctx)}は${rows[0].name}が優勝`);
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    'BSフジ「お笑い成人式」、芸歴20年以上の実力派漫才師が集結',
    '「まだ日の目を見ていないけれど、力のある漫才師」をベテランが推薦――お笑い成人式',
    (g, ctx) => (ctx.year === 2020 ? 'お笑い成人式、今回は無観客で開催。審査員の採点で優勝決定' : 'お笑い成人式、審査員と観客投票で優勝を決める'),
    '芸歴が二十歳を迎えた漫才師たちの“成人式”',
    (g, ctx) => `正月の${ctx.year}年、お笑い成人式の漫才に「売れてないのがおかしい」の声`,
  ],
  catchcopy: () => '芸歴、二十歳になりました',
});

// ================================================================== お笑いバイアスロン
// Verified: 主催 QAB琉球朝日放送。沖縄の芸人が毎年夏に競う「お笑い総合王者決定戦」で、コントと漫才の総合（合計）得点で争う。2023年が第11回
//   （→ 第1回は逆算で2013年）。2カ月にわたる予選 → 決勝、本番中に選ばれる敗者復活組あり、同点は決戦投票。第11回は前年上位のコンビが一時解体して
//   今大会限りのユニットを組んだ。ピン芸人も決勝に進んでいる.
// Unverified: 配点（コント1位455点の例 → ゲームでは審査員5人×100点＝各500点満点）、予選の通過数、日程（月） → generic.
const BIA_SRC = ['https://natalie.mu/owarai/news/548842', 'https://ryukyushimpo.jp/news/entry-1188248.html', 'https://ryukyushimpo.jp/news/entry-797192.html', 'https://ryukyushimpo.jp/play/entry-1224833.html', 'https://ryukyushimpo.jp/living-style/entry-1626374.html'];
const biaKind = (g, part) => (unitOf(g).type === 'pin' || styleKind(g) === 'pin' ? 'pin' : part);
registerContest('biathlon', {
  name: 'お笑いバイアスロン', short: 'バイアスロン', kind: 'double', category: 'tv',
  organizer: 'QAB琉球朝日放送', broadcaster: 'QAB琉球朝日放送', venue: '沖縄県内の特設ステージ', region: 'okinawa',
  history: { founded: 2013, ended: null, note: '沖縄の芸人の「お笑い総合王者決定戦」。コントと漫才の合計点で争い、本番中に敗者復活組が選ばれる。同点なら決戦投票。', sources: BIA_SRC },
  schedule: { entry: { from: [5, 1], to: [5, 10] }, final: [8, 5] },
  eligibility: { pro: true, amateur: true, region: 'okinawa', note: '沖縄で活動する芸人（沖縄県出身でなければ、予選の受付で沖縄にも拠点を置くか決める）' },
  prizeText: '総合王者の称号',
  facts: { verified: ['主催 QAB琉球朝日放送', '沖縄の芸人の総合王者決定戦・毎年夏', 'コント＋漫才の合計得点', '2023年=第11回', '2カ月の予選→決勝', '本番中に選ばれる敗者復活', '同点は決戦投票', 'ピン芸人も決勝に'], unverified: ['第1回=2013年（逆算）', '配点（ゲームでは各500点満点）', '予選の通過数', '月'] },
  rounds: [
    {
      id: 'r1', name: '予選（コント）', when: [6, 5], judge: 'panel', field: 30, pass: 0.6,
      run: async (g, ctx) => {
        const s = d2(g);
        const p = g.state && g.state.profile;
        if (!(p && p.hometown === 'okinawa') && !s.flags.okinawa) {
          const k = g.auto ? 0 : await g.ask(['受付「お笑いバイアスロンは、沖縄で活動する芸人の大会です」', '沖縄にも拠点を置いて、県内の舞台に立ち続ける？'], ['沖縄にも拠点を置く（以後、沖縄の芸人として出場）', 'やめておく'], { cancel: 1 });
          if (k !== 0) {
            const out = roundResult({ score: 0 }, { passed: false, reasons: ['沖縄で活動する芸人の大会'] });
            record(g, ctx, 'r1', out);
            return out;
          }
          s.flags.okinawa = (g.state && g.state.day) || 1;
          await g.say('沖縄の劇場にも籍を置いた。島の客席に、顔を覚えてもらおう。');
        }
        return stageRound(g, ctx, { round: 'r1', name: '予選（コント）', kind: biaKind(g, 'conte'), scene: 'okinawa', sign: 'お笑いバイアスロン 予選', field: 30, pass: 0.6, level: 42, intro: ['2カ月にわたる予選。まずはコント。', '沖縄の芸人どうし、手の内はお互いよく知っている。'] });
      },
    },
    {
      id: 'r2', name: '予選（漫才）', when: [7, 5], judge: 'panel', field: 18, pass: 8,
      run: (g, ctx) => stageRound(g, ctx, {
        round: 'r2', name: '予選（漫才）', kind: biaKind(g, 'manzai'), scene: 'okinawa', sign: 'お笑いバイアスロン 予選', field: 18, pass: 8, level: 48,
        intro: ['予選の二種目め、漫才。コントとの合計で決勝が決まる。'],
        after: async (gg, c, out) => {
          if (!out.passed && out.place <= out.passCount + 4) {
            d2(gg).flags[`bia_revive_${c.year}`] = 1;
            out.passed = true; out.revivalCandidate = true;
            await gg.say('決勝は逃した……が、敗者復活の候補に残った。本番中の発表を待つ。');
          }
        },
      }),
    },
    {
      // 敗者復活 is part of this run (announced during the broadcast), so the round has no `revival` flag for D1's generic 敗者復活戦
      id: 'final', name: '決勝（コント＋漫才 合計点）', when: [8, 5], judge: 'points', judges: 5, field: 9, final: true, tv: true, revivalInRun: true,
      run: async (g, ctx) => {
        const s = d2(g);
        const skip = await askSkip(g, ctx, 'final');
        const r = rngFor(g, ctx.id, ctx.year, 'bia');
        return withBackdrop(g, 'okinawa', { title: ctx.def.name, sub: `${edLabel(ctx)}　決勝`, sign: 'お笑いバイアスロン 決勝', cast: castOf(g) }, async () => {
          if (s.flags[`bia_revive_${ctx.year}`]) {
            const cand = [unitName(g), ...rivalsFor(g, ctx, 'revive', 3, { level: 48 }).map((x) => x.name)];
            const chosen = r() < 0.25 + powerOf(g, 'manzai') / 250 ? 0 : 1 + Math.floor(r() * 3);
            await g.say(['本番の途中、敗者復活の発表。', `選ばれたのは――「${cand[chosen]}」！`]);
            if (chosen !== 0) {
              const out = roundResult({ score: 0 }, { passed: false, place: null, field: null, reasons: ['敗者復活に選ばれなかった'] });
              record(g, ctx, 'final', out);
              return out;
            }
            await g.say('敗者復活で決勝のステージへ！');
          }
          if (!skip) await g.say(['決勝。コントと漫才、二つの種目の合計点で総合王者が決まる。', '審査員5人が各100点。コント500点＋漫才500点、計1000点満点。']);
          const judges = judgesFor(g, ctx, 5, ['審査委員長', '放送作家', 'QABアナウンサー', '劇場支配人', '沖縄芝居の役者']);
          const c1 = await stagePerform(g, ctx, { kind: biaKind(g, 'conte'), round: 'final_conte', title: '第一種目：コント', venue: { name: '決勝ステージ', size: 'hall', crowd: 'warm', pressure: 70 }, skip });
          const m1 = await stagePerform(g, ctx, { kind: biaKind(g, 'manzai'), round: 'final_manzai', title: '第二種目：漫才', venue: { name: '決勝ステージ', size: 'hall', crowd: 'warm', pressure: 80 }, skip });
          const myC = panelPoints(g, ctx, 'fc', c1.score, judges, 100, 'me').total;
          const myM = panelPoints(g, ctx, 'fm', m1.score, judges, 100, 'me').total;
          const rv = rivalsFor(g, ctx, 'final', 8, { level: 58 });
          const rows = rv.map((x) => { const a = simScore(g, 'conte', x.power, x.quality, r), b = simScore(g, 'manzai', x.power, x.quality, r); const c = panelPoints(g, ctx, 'fc', a, judges, 100, x.name).total, m = panelPoints(g, ctx, 'fm', b, judges, 100, x.name).total; return { name: x.name, c, m, t: c + m }; });
          rows.push({ name: unitName(g), c: myC, m: myM, t: myC + myM, me: true });
          rows.sort((a, b) => b.t - a.t || (a.me ? -1 : 1));
          let tie = rows[0].t === rows[1].t;
          let place = rows.findIndex((x) => x.me) + 1;
          if (tie) {
            const meIn = rows[0].me || rows[1].me;
            const win = r() < 0.5 ? 0 : 1;
            if (win === 1) [rows[0], rows[1]] = [rows[1], rows[0]];
            if (meIn) await g.say(['同点！ 決戦投票へ。', `決戦投票の結果――「${rows[0].name}」！`]);
            place = rows.findIndex((x) => x.me) + 1;
          }
          await showBoard(g, {
            title: 'お笑いバイアスロン　総合得点', sub: `${edLabel(ctx)}　コント500＋漫才500${tie ? '　※同点は決戦投票' : ''}`,
            cols: [{ key: 'place', label: '順', w: 44 }, { key: 'name', label: '名前', w: 290 }, { key: 'c', label: 'コント', w: 90, align: 'right' }, { key: 'm', label: '漫才', w: 90, align: 'right' }, { key: 't', label: '合計', w: 90, align: 'right' }],
            rows: rows.map((x, i) => ({ place: i + 1, name: x.name, c: x.c, m: x.m, t: x.t, me: x.me })), max: 10,
          });
          const out = roundResult({ ...m1, score: Math.round((c1.score + m1.score) / 2) }, { passed: true, place, field: rows.length, conte: myC, manzai: myM });
          if (place === 1) { out.champion = true; out.award = '総合王者'; await g.say([`お笑いバイアスロン、総合王者は${unitName(g)}！`, 'コントも漫才もできる――沖縄でいちばんの二刀流だ。']); }
          else { out.reasons = failReasons(g, myC < myM ? 'conte' : 'manzai', myC < myM ? c1 : m1); out.reasons.unshift(myC < myM ? 'コントの点が伸びなかった' : '漫才の点が伸びなかった'); await g.say([`${place}位。総合王者は「${rows[0].name}」。`, `足りなかったもの：${out.reasons.slice(0, 3).join('、')}`]); }
          news(g, ctx, `【お笑いバイアスロン】${edLabel(ctx)}総合王者は${rows[0].name}（${rows[0].t}点）`);
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    'QAB「お笑いバイアスロン」、沖縄の芸人がコントと漫才の合計点で総合王者を争う',
    'お笑いバイアスロン、2カ月の予選がスタート',
    'お笑いバイアスロン決勝、本番中に敗者復活組を発表',
    (g, ctx) => (ctx.edition === 11 ? 'お笑いバイアスロン第11回、前年上位コンビが一時解体して今大会限りのユニットで参戦' : 'お笑いバイアスロン、同点なら決戦投票'),
    (g, ctx) => `夏の沖縄、${ctx.year}年のバイアスロン。ピン芸人の決勝進出にも注目`,
  ],
  catchcopy: () => 'コントも漫才も、島いちばん',
});

// ================================================================== 100×100
// Verified: 吉本興業の賞レース。吉本芸人限定の「お年玉100万円をかけた新春ネタトーナメント」。1回戦100秒・準決勝200秒・決勝300秒と100秒刻みで
//   ネタ時間が伸びる。元日にYouTube「吉本興業チャンネル」で生配信。第1回は延期を経て開催、予選を勝ち抜いた吉本芸人60組が参戦（2024年）。
//   第2回2025年、第3回2026年1月1日13時〜（優勝は視聴者投票）。過去大会は漫才作家・芸人らの審査員6人.
// Unverified: 予選の応募数、各回戦の通過数（ゲームでは60→12→3→1）、第1回の正確な日付 → generic.
const HYAKU_SRC = ['https://natalie.mu/owarai/news/566485', 'https://natalie.mu/owarai/news/652014', 'https://natalie.mu/owarai/news/565210', 'https://magazine.fany.lol/258636/', 'https://magazine.fany.lol/144114/', 'https://prtimes.jp/main/html/rd/p/000004657.000029501.html', 'https://news.yahoo.co.jp/expert/articles/cbad2b4a3959931493c1dffda65162ce04ab08f5'];
const HYAKU_CHAT = ['あけおめ！', '新春から100×100', '100秒で勝負か', '尺がどんどん伸びる', 'お年玉100万円！', 'がんばれー'];
registerContest('hyaku', {
  name: '100×100', short: '100×100', kind: 'any', category: 'agency',
  organizer: '吉本興業', broadcaster: 'YouTube「吉本興業チャンネル」（元日生配信）', venue: '配信スタジオ', region: 'tokyo',
  history: { founded: 2024, ended: null, note: '吉本芸人限定の新春ネタトーナメント。1回戦100秒・準決勝200秒・決勝300秒とネタ時間が伸びる。お年玉は100万円。', sources: HYAKU_SRC },
  // the 予選 is in December of the previous calendar year (D1: a date after the final's month belongs to year − 1)
  schedule: { entry: { from: [11, 1], to: [11, 10] }, final: [1, 1] },
  eligibility: { agency: ['yoshimoto'], pro: true, amateur: false, note: '吉本興業の所属芸人（年末の予選を勝ち抜いた60組が元日の本戦へ）' },
  prize: 1000000, prizeText: 'お年玉（優勝賞金）100万円',
  facts: { verified: ['吉本興業・吉本芸人限定', 'お年玉100万円の新春ネタトーナメント', '1回戦100秒・準決勝200秒・決勝300秒', '元日にYouTube吉本興業チャンネルで生配信', '第1回 60組（延期を経て）', '第2回2025・第3回2026（視聴者投票）', '過去大会は審査員6人'], unverified: ['予選の応募数', '各回戦の通過数（ゲームでは60→12→3→1）', '第1回の日付'] },
  rounds: [
    { id: 'yosen', name: '予選（年末のネタ審査・100秒）', when: [12, 5], judge: 'staff', field: 300, pass: 60, length: 100, run: (g, ctx) => stageRound(g, ctx, { round: 'yosen', name: '予選（100秒）', scene: 'stream', sign: '100×100 予選', length: 100, field: 300, pass: 60, sample: 30, level: 44, intro: ['元日の本戦に出られるのは、予選を勝ち抜いた60組。', '予選のネタは100秒。年末の劇場で審査される。'] }) },
    {
      id: 'main', name: '新春ネタトーナメント（100秒→200秒→300秒）', when: [1, 1], judge: 'vote', field: 60, final: true, tv: true,
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'main');
        const viewers = ctx.year >= 2026;
        return withBackdrop(g, 'stream', { title: ctx.def.name, sub: `${edLabel(ctx)}　元日生配信`, sign: '100×100', chat: HYAKU_CHAT, cast: castOf(g) }, async () => {
          if (!skip) await g.say(['元日。吉本興業チャンネルで生配信。', '1回戦100秒、準決勝200秒、決勝300秒。勝ち上がるほど、ネタが長くなる。', viewers ? '優勝は視聴者投票で決まる。' : '審査員6人が採点する。']);
          const stages = [{ sec: 100, name: '1回戦（100秒）', field: 60, pass: 12, level: 50 }, { sec: 200, name: '準決勝（200秒）', field: 12, pass: 3, level: 60 }, { sec: 300, name: '決勝（300秒）', field: 3, pass: 1, level: 66 }];
          let last = null;
          let prevSec = 0;
          for (const st of stages) {
            let fitMod = 0, over = 0;
            if (!skip && prevSec) {
              const a = await g.ask(`${st.name}。${prevSec}秒のネタを${st.sec}秒にする方法は？`, [`${st.sec}秒用に作り直す`, '前のネタを引き伸ばす', '勢いで押し切る（尺はなりゆき）'], { cancel: 0 });
              const q = netaQualityOf(g, styleKind(g));
              fitMod = a === 0 ? (q >= 60 ? 4 : 0) : a === 1 ? -6 : 0;
              over = a === 2 ? Math.round((rngFor(g, ctx.id, ctx.year, st.sec)() - 0.4) * 40) : 0;
            }
            const res = await stagePerform(g, ctx, { kind: 'any', round: `s${st.sec}`, length: st.sec, title: `100×100 ${st.name}`, venue: { name: '配信スタジオ', size: 'tv', crowd: 'normal', pressure: 50 + st.sec / 10 }, skip });
            if (over > 0) res.overtime = (res.overtime || 0) + over;
            res.score = clamp(res.score + fitMod - (res.overtime > 0 ? Math.min(15, res.overtime) : 0), 0, 100);
            const j = judgeField(g, ctx, `s${st.sec}`, res.score, { field: st.field, pass: st.pass, sample: Math.min(st.field - 1, 20), level: st.level });
            last = roundResult(res, { passed: j.passed, place: j.place, field: st.field, stage: st.sec });
            await showBoard(g, {
              title: `100×100　${st.name}`, sub: `${edLabel(ctx)}　${viewers ? '視聴者投票' : '審査員6人'}　通過${st.pass}組`,
              cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 380 }, { key: 'score', label: viewers ? '票（%）' : '得点', w: 140, align: 'right' }],
              rows: j.rows.slice(0, 10).map((x, i) => ({ place: i + 1, name: x.name, score: viewers ? `${Math.round(x.score / 3)}` : `${x.score * 6}`, me: x.me })),
              note: res.overtime > 0 ? `尺オーバー ${res.overtime}秒（減点）` : '',
            });
            if (!j.passed) {
              last.reasons = failReasons(g, styleKind(g), res);
              await g.say([`${st.name}で敗退（${j.place}位／${st.field}組）。`, `足りなかったもの：${last.reasons.join('、')}`]);
              last.place = st.sec === 100 ? 30 : st.sec === 200 ? 8 : 3;
              break;
            }
            if (st.pass === 1) {
              last.champion = true; last.award = '優勝（お年玉100万円）'; last.place = 1; // 100万円（def.prize）は D1 が支払う
              await g.say([`100×100、優勝は${unitName(g)}！`, `お年玉は${prizeLine(g, 1000000, '')}。新年いちばんの笑いをとった。`]);
            } else await g.say(`${st.name}突破！ 次は${st.sec + 100}秒。`);
            prevSec = st.sec;
          }
          news(g, ctx, last && last.champion ? `【100×100】${edLabel(ctx)}、新春ネタトーナメントは${unitName(g)}が制しお年玉100万円` : `【100×100】${edLabel(ctx)}の新春ネタトーナメント、元日に生配信`);
          record(g, ctx, 'main', last);
          return last;
        });
      },
    },
  ],
  news: [
    '吉本芸人限定の新春ネタトーナメント「100×100」。お年玉は100万円',
    '100×100、1回戦100秒・準決勝200秒・決勝300秒。勝ち上がるほどネタが長くなる',
    (g, ctx) => (ctx.year >= 2026 ? '100×100、今年は視聴者投票で優勝を決定' : '100×100、審査員6人が採点'),
    '元日の吉本興業チャンネルで100×100を生配信。新年いちばんのネタは',
    (g, ctx) => (ctx.year === 2024 ? '延期されていた「100×100」改めて開催。予選を勝ち抜いた60組が参戦' : '100×100、「面白ければ何でもあり」。ジャンル不問の60組'),
  ],
  catchcopy: () => '100秒で掴み、300秒で決めろ',
});

// ================================================================== 30-1 グランプリ
// Verified: TBS「水曜日のダウンタウン」の企画で2021年から年1回。漫才・コント・ピンネタなど「30秒以内ならなんでもアリ」のノンジャンル賞レース
//   （名前の「30」は30秒。30歳以上・芸歴30年の大会ではない）。2026年は過去最多の931組が応募し、勝ち残った40組が5ブロックに分かれて
//   トーナメント。2024年の審査員は5人。放送は2024年4月、2025年5月、2026年6月ごろ.
// Unverified: 予選の方式、ブロック内の対戦方式（ゲームでは8組の勝ち抜き・審査員5人の多数決）、決勝の方式、賞金、30秒を超えた場合の扱い
//   （ゲームでは強制終了＝減点）.
const T30_SRC = ['https://natalie.mu/owarai/news/569756', 'https://www.daily.co.jp/gossip/2024/04/18/0017555385.shtml', 'https://www.j-cast.com/2025/05/08504111.html', 'https://natalie.mu/owarai/news/520426', 'https://www.daily.co.jp/gossip/2026/06/03/0020433794.shtml'];
registerContest('thirty1', {
  name: '30-1 グランプリ', short: '30-1', kind: 'any', category: 'tv',
  organizer: 'TBS', broadcaster: 'TBS系「水曜日のダウンタウン」', venue: 'TBS スタジオ', region: 'tokyo',
  history: { founded: 2021, ended: null, note: '30秒以内ならなんでもアリのノンジャンル賞レース（「水曜日のダウンタウン」の企画）。本戦は5ブロックのトーナメント。', sources: T30_SRC },
  schedule: { entry: { from: [2, 1], to: [2, 10] }, final: [5, 5] },
  eligibility: { pro: true, amateur: true, note: 'プロ・アマ不問。ネタは30秒以内' },
  prizeText: '優勝の称号',
  facts: { verified: ['TBS「水曜日のダウンタウン」企画', '2021年から年1回', '30秒以内ならなんでもアリ（ノンジャンル）', '2026: 931組応募→40組・5ブロックのトーナメント', '審査員5人（2024）'], unverified: ['予選の方式', 'ブロック内の対戦方式', '決勝の方式', '賞金', '30秒超過の扱い'] },
  rounds: [
    { id: 'r1', name: '予選（応募ネタ審査）', when: [3, 5], judge: 'staff', field: 931, pass: 40, run: (g, ctx) => stageRound(g, ctx, { round: 'r1', name: '予選（応募ネタ審査）', scene: 'timer30', sign: '30秒以内ならなんでもアリ', length: 30, field: ctx.year === 2026 ? 931 : 800, pass: 40, sample: 30, level: 48, intro: (gg, c) => [`30秒以内のネタを送る。${c.year === 2026 ? '今年は過去最多の931組が応募。' : ''}`, '本戦に残れるのは40組。'] }) },
    {
      id: 'final', name: '本戦トーナメント（5ブロック×8組）', when: [5, 5], judge: 'vote', judges: 5, field: 40, final: true, tv: true,
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'final');
        return withBackdrop(g, 'timer30', { title: ctx.def.name, sub: `${edLabel(ctx)}　本戦`, sign: '30秒以内ならなんでもアリ', cast: castOf(g) }, async () => {
          if (!skip) await g.say(['40組が5ブロック、8組ずつのトーナメント。', '1対1で30秒ずつ。審査員5人の多数決で勝ち上がる（30秒を超えたら強制終了）。']);
          const r = rngFor(g, ctx.id, ctx.year, 'blk');
          const rv = rivalsFor(g, ctx, 'final', 7, { level: 58 });
          const slots = [unitName(g), ...rv.map((x) => x.name)];
          const power = [null, ...rv.map((x) => simScore(g, 'manzai', x.power, x.quality, r))];
          const wins = [];
          let alive = [0, 1, 2, 3, 4, 5, 6, 7];
          let out = null;
          const bout = async (a, b, roundName) => {
            const vote = (sa, sb, who) => { const rr = rngFor(g, ctx.id, ctx.year, 'v', who); let va = 0; for (let k = 0; k < 5; k++) if (sa + (rr() - 0.5) * 16 > sb + (rr() - 0.5) * 16) va++; return va; };
            if (a !== 0 && b !== 0) return vote(power[a], power[b], `${a}-${b}`) >= 3 ? a : b;
            const opp = a === 0 ? b : a;
            const res = await stagePerform(g, ctx, { kind: 'any', round: `b${roundName}`, length: 30, title: `30-1 ${roundName}`, venue: { name: 'TBS スタジオ', size: 'tv', crowd: 'normal', pressure: 70 }, skip });
            // 30秒を超えた分は強制終了（ゲームの演出）: the longer over, the bigger the loss (capped)
            const pen = clamp(Math.round((res.overtime || 0) / 3), 0, 12);
            const va = vote(res.score - pen, power[opp], `me-${roundName}`);
            out = roundResult(res, { passed: va >= 3, place: null, field: 40, votes: va });
            await g.say(`${roundName}：${slots[0]} 対 ${slots[opp]}――審査員5人の判定は ${va}対${5 - va}。${pen >= 3 ? '（30秒オーバーで強制終了）' : ''}`);
            return va >= 3 ? 0 : opp;
          };
          const names = ['1回戦', '準決勝', 'ブロック決勝'];
          for (let rr = 0; rr < 3; rr++) {
            const next = [];
            for (let k = 0; k < alive.length; k += 2) next.push(await bout(alive[k], alive[k + 1], names[rr]));
            wins.push(next);
            alive = next;
          }
          await showBracket(g, { title: '30-1 グランプリ　ブロックトーナメント', sub: `${edLabel(ctx)}　8組・1対1・審査員5人の多数決`, slots, wins, me: 0, note: alive[0] === 0 ? 'ブロック優勝！ 決勝へ。' : `ブロックを勝ち上がったのは「${slots[alive[0]]}」。` });
          if (alive[0] !== 0) {
            const lostAt = wins.findIndex((w) => !w.includes(0));
            out = out || roundResult({ score: 0 });
            // overall place among the 40: 1回戦負け ≈ 21〜40位, 準決勝負け ≈ 11〜20位, ブロック決勝負け ≈ 6〜10位
            out.passed = true; out.place = lostAt === 0 ? 30 : lostAt === 1 ? 15 : 8; out.field = 40; out.of = 40;
            out.reasons = failReasons(g, styleKind(g), out.perf);
            await g.say([`${names[lostAt]}で敗退。`, `足りなかったもの：${out.reasons.join('、')}`]);
          } else {
            const fr = rivalsFor(g, ctx, 'fin', 4, { level: 66 });
            const fin = await stagePerform(g, ctx, { kind: 'any', round: 'fin', length: 30, title: '30-1 決勝', venue: { name: 'TBS スタジオ', size: 'tv', crowd: 'normal', pressure: 85 }, skip });
            const fs = [fin.score - clamp(Math.round((fin.overtime || 0) / 3), 0, 12), ...fr.map((x) => simScore(g, 'manzai', x.power, x.quality, r))];
            const votes = new Array(5).fill(0);
            const rr = rngFor(g, ctx.id, ctx.year, 'finv');
            for (let k = 0; k < 5; k++) { let bi = 0, bv = -1; fs.forEach((s, i) => { const x = s + (rr() - 0.5) * 14; if (x > bv) { bv = x; bi = i; } }); votes[bi]++; }
            const fo = [unitName(g), ...fr.map((x) => x.name)].map((n, i) => ({ name: n, v: votes[i], me: i === 0 })).sort((a, b) => b.v - a.v || (a.me ? -1 : 1));
            await showBoard(g, { title: '30-1 グランプリ　決勝（各ブロック王者5組）', sub: `${edLabel(ctx)}　審査員5人の投票`, cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 380 }, { key: 'v', label: '票', w: 140, align: 'right' }], rows: fo.map((x, i) => ({ place: i + 1, name: x.name, v: `${x.v}票`, me: x.me })) });
            out = roundResult(fin, { passed: true, place: fo.findIndex((x) => x.me) + 1, field: 40 });
            if (fo[0].me) { out.champion = true; out.award = '優勝'; await g.say([`30-1 グランプリ、優勝は${unitName(g)}！`, '30秒で日本中を笑わせた。']); }
            else { out.reasons = failReasons(g, styleKind(g), fin); await g.say([`決勝${out.place}位。優勝は「${fo[0].name}」。`, `足りなかったもの：${out.reasons.join('、')}`]); }
          }
          news(g, ctx, `【30-1】${edLabel(ctx)}、30秒の頂点に立ったのは${out.champion ? unitName(g) : 'あのピン芸人'}`);
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    '「30秒以内ならなんでもアリ」。水曜日のダウンタウン「30-1 グランプリ」今年も開催',
    (g, ctx) => (ctx.year === 2026 ? '30-1 グランプリ、応募は過去最多の931組。本戦は40組・5ブロックのトーナメント' : '30-1 グランプリ、本戦は5ブロックのトーナメント'),
    '30-1 グランプリ、審査員5人の多数決で1対1の勝ち抜き',
    '30秒のネタに漫才・コント・ピン芸が混在。ノンジャンルの戦い',
    (g, ctx) => `${deviceOf(ctx.year)}の縦動画で「30秒ネタ」がバズる。30-1の出場者に注目`,
  ],
  catchcopy: () => '30秒で、人生を変えろ',
});
