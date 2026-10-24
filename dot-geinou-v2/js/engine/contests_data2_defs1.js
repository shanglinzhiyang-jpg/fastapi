// 賞レースのデータ その2 (owner: D2b) — part 1: 上方漫才協会大賞, UNDER 25 OWARAI CHAMPIONSHIP,
// 今宮子供えびすマンザイ新人コンクール, 笑わん会, 武−1グランプリ, ネクストブレイク芸人決定戦よしもとアルコベールグランプリ,
// ものまねグランプリ 次世代ものまね芸人No.1決定戦, 笑ラウドネスGP, Bs-1グランプリ, OKOWAチャンピオンシップ.
//
// Research (2026-10, WebSearch result pages; ja.wikipedia itself could not be fetched from this sandbox, so Wikipedia
// facts come from the search engines' quotes of it). What each def encodes as fact is listed in its `facts.verified`;
// everything else is a plausible generic format, marked in `facts.unverified` and worded 「（詳細非公開）」 in the game.
// Every person in this file is fictional (entrants, judges, 進行役, winners). Real organizers / broadcasters / venues only.

import { registerContest, contestDate } from './contests.js';
import { withBackdrop, showMeter, showBoard, showBracket } from './contests_data2_scenes.js';
import { stageRound, castOf } from './contests_data2_flow.js';
import {
  d2, yearOf, unitOf, unitName, memberCount, geirekiOf, ageOf, playerAgency, isAmateur, hasAnyTitle, powerOf, netaQualityOf,
  rivalsFor, judgesFor, news, stagePerform, judgeField, simScore, rngFor, askSkip, grant, record, roundResult, failReasons,
  edLabel, toScale, yen, deviceOf, styleKind,
} from './contests_data2_kit.js';
import { clamp } from './util.js';

// Eligibility is given in D1's OBJECT form (D1 evaluates it: invitations, notes, the simulated field's filter).
// Conditions the object cannot say (今宮の「受賞歴なし」, バイアスロンの「沖縄で活動」) are checked at the start of round 1.
// elig() (function form) stays available for tests / other callers.
function elig(note, fn, extra = {}) {
  const f = (g, unit, year) => {
    try { return fn(g, unit || unitOf(g), year ?? yearOf(g)); } catch (e) { console.error(e); return { ok: false, why: '出場資格を確かめられなかった' }; }
  };
  return Object.assign(f, { note }, extra);
}
const OK = { ok: true, why: '' };
const no = (why) => ({ ok: false, why });
const famous = (g) => Number(g.state && g.state.fame) || 0;
const fansOf = (g) => Number(g.state && g.state.fans) || 0;

// ================================================================== 上方漫才協会大賞
// Verified: 主催 上方漫才協会（吉本興業の公式ページ yoshimoto.co.jp/kamigatamanzaikyokai/award/）; 第七回 = 2022年1月10日・なんばグランド花月
//   (→ 第1回 2016年、毎年1月の授賞式); 大賞は「1年を通じての舞台、メディアでの活躍や、漫才への貢献」から選ぶ; 新人賞は芸歴8年目以下が対象で、
//   前年の各劇場での成績をもとに選ばれた5組が舞台上でネタバトル; 文芸部門賞（第七回は5組）、特別賞、話題賞; 第十回で特別功労賞を新設.
// Unverified: 賞金、ネタ時間、審査員の構成 → 「非公表」, generic.
const KYOKAI_SRC = [
  'https://www.yoshimoto.co.jp/kamigatamanzaikyokai/award/index.php',
  'https://www.tokyo-sports.co.jp/articles/-/141115',
  'https://www.oricon.co.jp/news/2363776/full/',
  'https://www.oricon.co.jp/news/2220640/full/',
  'https://lp.p.pia.jp/article/news/214973/index.html',
];
function theaterPoints(g) {
  const o = typeof g.owarai === 'function' ? g.owarai() : null;
  const stages = Number(o && o.stages) || d2(g).log.length;
  return clamp(Math.round(powerOf(g, 'manzai') * 0.6 + Math.min(28, stages * 1.4) + Math.min(14, famous(g) / 400)), 0, 100);
}
registerContest('kamigata_kyokai', {
  name: '上方漫才協会大賞', short: '漫協大賞', kind: 'manzai', category: 'agency',
  organizer: '上方漫才協会', broadcaster: null, venue: 'なんばグランド花月', region: 'osaka',
  history: {
    founded: 2016, ended: null,
    note: '第七回（2022年1月10日・NGK）から逆算して第1回は2016年。毎年1月に前年の活躍を表彰。新人賞（芸歴8年目以下）は5組のネタバトルで決定。',
    sources: KYOKAI_SRC,
  },
  editionOf: (y) => (y >= 2016 ? y - 2015 : null),
  schedule: { entry: null, final: [1, 4] },
  eligibility: { pro: true, amateur: false, members: [2, null], agency: ['yoshimoto'], region: 'osaka', invite: { fame: 300 }, repeat: true,
    note: '上方漫才協会の協会員（よしもと所属・関西の劇場に立つ漫才師）。選考制（協会から授賞式に呼ばれる）。新人賞は芸歴8年目以下' },
  fee: 0, prizeText: '大賞・新人賞・文芸部門賞・特別賞・話題賞ほか（賞金は非公表）',
  perform: { kind: 'manzai' },
  facts: {
    verified: ['主催 上方漫才協会', '第七回=2022年1月10日 なんばグランド花月', '新人賞=芸歴8年目以下・5組ネタバトル', '大賞の選考基準', '文芸部門賞・特別賞・話題賞', '第十回で特別功労賞新設'],
    unverified: ['賞金', 'ネタ時間', '審査員の人数・方式', '第1回の年（逆算）'],
  },
  rounds: [
    {
      id: 'nominate', name: '新人賞ノミネート発表（劇場成績）', when: [1, 1], judge: 'staff', pass: 5, field: 40, venues: ['大阪'],
      run: async (g, ctx) => {
        const y = ctx.year;
        const gk = geirekiOf(g, y);
        const s = d2(g);
        const pts = theaterPoints(g);
        return withBackdrop(g, 'ceremony', { title: ctx.def.name, sub: `${edLabel(ctx)} 新人賞ノミネート`, sign: '上方漫才協会', cast: castOf(g) }, async () => {
          if (gk > 8) {
            // 芸歴9年目以上: 新人賞の対象外。大賞の最終候補に残るかどうか（1年の舞台・メディアでの活躍、漫才への貢献）
            const big = powerOf(g, 'manzai') >= 72 && famous(g) >= 4000;
            await g.say([`芸歴${gk}年目。新人賞の対象（8年目以下）からは外れている。`, big ? '協会から連絡――大賞の最終選考に名前が残っている、と。授賞式に呼ばれた。' : '大賞の最終選考には残らなかった。今年の授賞式は客席から見守ることになる。']);
            if (big) s.flags[`kyokai_vet_${y}`] = 1;
            const out = roundResult({ score: pts }, { passed: big, place: big ? 1 : null, field: null, comment: big ? '大賞の最終候補' : '選考外', reasons: big ? [] : ['1年を通じた舞台・メディアでの活躍', '漫才への貢献'] });
            record(g, ctx, 'nominate', out);
            return out;
          }
          const j = judgeField(g, ctx, 'nominate', pts, { field: 40, pass: 5, sample: 16, level: 46, kind: 'manzai' });
          await showBoard(g, {
            title: '前年の劇場成績（若手・芸歴8年目以下）', sub: `${edLabel(ctx)} 新人賞ノミネート選考　上位5組がネタバトルへ`,
            cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 360 }, { key: 'score', label: '劇場成績', w: 160, align: 'right' }],
            rows: j.rows.slice(0, 10).map((x, i) => ({ place: i + 1, name: x.name, score: `${x.score}pt`, me: x.me })),
            note: '劇場成績＝出番の数・ウケ・ネタの完成度（ゲーム内の集計）',
          });
          const out = roundResult({ score: pts }, { passed: j.passed, place: j.place, field: j.field });
          if (j.passed) {
            s.flags[`kyokai_nom_${y}`] = 1;
            await g.say([`${unitName(g)}、上方漫才協会大賞 新人賞にノミネート！`, 'なんばグランド花月の授賞式で、5組によるネタバトルが待っている。']);
            news(g, ctx, `【上方漫才協会大賞】${edLabel(ctx)}の新人賞ノミネート5組が発表。${unitName(g)}も名を連ねた`);
          } else {
            out.reasons = ['劇場の出番の数', 'ネタの完成度', '劇場でのウケ'].slice(0, 2);
            await g.say([`新人賞ノミネートの5組には入れなかった（劇場成績 推定${j.place}位）。`, '今年はもっと劇場の出番を増やして、ウケを積み上げたい。']);
          }
          record(g, ctx, 'nominate', out);
          return out;
        });
      },
    },
    {
      id: 'final', name: '授賞式（新人賞ネタバトル）', when: [1, 4], venues: ['なんばグランド花月'], judge: 'panel', judges: 5, final: true,
      run: async (g, ctx) => {
        const y = ctx.year;
        const s = d2(g);
        const nominee = !!s.flags[`kyokai_nom_${y}`];
        const vet = !!s.flags[`kyokai_vet_${y}`];
        const r = rngFor(g, ctx.id, y, 'awards');
        const rv = rivalsFor(g, ctx, 'final', 12, { level: 70, kind: 'manzai', amateurTag: false });
        return withBackdrop(g, 'theater', { title: ctx.def.name, sub: `${edLabel(ctx)} 授賞式`, sign: 'なんばグランド花月', gold: true, cast: castOf(g) }, async () => {
          await g.say(['なんばグランド花月。協会員がずらりと並ぶ、年に一度の授賞式。', '進行役「それではまず、新人賞のネタバトルから参りましょう！」'], { name: '' });
          let out = roundResult({ score: theaterPoints(g) }, { passed: true });
          let newcomer = rv[0].name;
          if (!nominee && vet) out = roundResult({ score: theaterPoints(g) }, { passed: true, place: 4, field: 5 });
          if (nominee) {
            const skip = await askSkip(g, ctx, 'final');
            const res = await stagePerform(g, ctx, { kind: 'manzai', round: 'final', title: '新人賞ネタバトル', venue: { name: 'なんばグランド花月', size: 'hall', crowd: 'warm', pressure: 70 }, skip });
            const j = judgeField(g, ctx, 'final', res.score, { field: 5, pass: 1, sample: 4, level: 62, kind: 'manzai' });
            out = roundResult(res, { passed: true, place: j.place, field: 5 });
            await showBoard(g, {
              title: '新人賞ネタバトル（5組）', sub: `${edLabel(ctx)}　協会の審査で決定（点数は非公表・ゲーム内の目安）`,
              cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 380 }, { key: 'score', label: '目安', w: 140, align: 'right' }],
              rows: j.rows.map((x, i) => ({ place: i + 1, name: x.name, score: `${x.score}`, me: x.me })),
            });
            if (j.place === 1) {
              newcomer = unitName(g);
              out.champion = true; out.award = '新人賞';
              await g.say([`新人賞は――${unitName(g)}！！`, '協会の重鎮たちから、あたたかい拍手が送られた。']);
            } else {
              newcomer = j.top.name;
              out.reasons = failReasons(g, 'manzai', res);
              await g.say([`新人賞は「${newcomer}」。${unitName(g)}は惜しくも届かなかった。`, `足りなかったもの：${out.reasons.join('、')}`]);
            }
          }
          // the other awards (fictional winners unless the player earned one)
          const neta = netaQualityOf(g, 'manzai');
          const bunsei = neta >= 85 && (nominee || vet) ? unitName(g) : `${rv[1].name}、${rv[2].name}、${rv[3].name}`;
          const bigYear = vet && powerOf(g, 'manzai') >= 72 && famous(g) >= 4000 && r() < 0.6;
          const taisho = bigYear ? unitName(g) : rv[4].name;
          const wadai = !bigYear && vet && famous(g) >= 1500 && r() < 0.35 ? unitName(g) : rv[5].name;
          const lines = [`大賞：${taisho}`, `新人賞：${newcomer}`, `文芸部門賞：${bunsei}`, `特別賞：${rv[6].name}`, `話題賞：${wadai}`];
          if (ctx.edition >= 10) lines.push(`特別功労賞：${rv[7].name}`);
          await showBoard(g, {
            title: `${ctx.def.name}　受賞一覧`, sub: edLabel(ctx), cols: [{ key: 'name', label: '賞と受賞者', w: 600 }],
            rows: lines.map((t) => ({ name: t, me: t.includes(unitName(g)) })), note: '大賞は「1年を通じての舞台、メディアでの活躍や、漫才への貢献」から選ばれる。',
          });
          if (bigYear) { out.champion = true; out.award = '大賞'; out.place = 1; await g.say('大賞……！ 一年間、劇場とテレビを走り抜いた日々が報われた。'); }
          if (bunsei === unitName(g)) { out.award = out.award || '文芸部門賞'; grant(g, ctx, 'bunsei', { fame: 60, fans: 300 }); await g.say('文芸部門賞も受賞！ 書いてきた台本が認められた。'); }
          if (wadai === unitName(g)) { out.award = out.award || '話題賞'; grant(g, ctx, 'wadai', { fame: 50, fans: 500 }); }
          news(g, ctx, `【上方漫才協会大賞】${edLabel(ctx)}の大賞は${taisho}、新人賞は${newcomer}`);
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    'なんばグランド花月で上方漫才協会大賞の授賞式。若手からベテランまで協会員が集結',
    '上方漫才協会大賞 新人賞は芸歴8年目以下。劇場成績の上位5組がネタバトルへ',
    (g, ctx) => `「漫才への貢献」も選考基準――${edLabel(ctx)}上方漫才協会大賞、文芸部門賞にも注目`,
    (g, ctx) => (ctx.year >= 2025 ? '上方漫才協会大賞、特別功労賞を新設（第十回から）' : '上方漫才協会大賞、話題賞は今年いちばん劇場を沸かせた組に'),
    '協会員の若手、正月の劇場は満員。新人賞ノミネートへ出番争いが激化',
    (g, ctx) => `${deviceOf(ctx.year)}で速報チェック。上方漫才協会大賞の受賞者が発表`,
  ],
  catchcopy: (g) => `浪花の劇場が育てた${memberCount(unitOf(g)) > 2 ? '三人' : '二人'}`,
});

// ================================================================== UNDER 25 OWARAI CHAMPIONSHIP
// Verified: 主催 ニッポン放送・SLUSH-PILE.; 2023年創設（第1回）。資格は年齢＝決勝当日に満25歳以下（芸歴不問、養成所生・学生・アマチュア可）。
//   2023: 4月エントリー開始 → 6月1次予選 → 7月2次予選 → 8月準決勝 → 9月16日決勝（東京・草月ホール、10組）、エントリー1,004組、審査員＋観客投票。
//   2024: 6/1〜6/30エントリー、1次予選は動画審査、7月2次予選、8月準決勝（8/19・20 シアターマーキュリー新宿）、9月22日決勝（同劇場）、
//   準決勝・決勝の審査に25歳以下の出場者も参加。賞金25万円＋ニッポン放送の冠ポッドキャスト番組パーソナリティ権（期間限定）。
// Unverified: 参加費、各予選の通過数・ネタ時間 → generic.
const U25_SRC = [
  'https://natalie.mu/owarai/news/519268', 'https://natalie.mu/owarai/news/541417', 'https://natalie.mu/owarai/news/573850',
  'https://magazine.fany.lol/101694/', 'https://news.radiko.jp/article/station/LFR/95227/', 'https://note.com/under25owarai',
];
const u25Venue = (y) => (y <= 2023 ? '草月ホール' : 'シアターマーキュリー新宿');
async function peerVote(g, ctx, roundId) {
  if (ctx.year < 2024) return null;
  const rv = rivalsFor(g, ctx, roundId + '_peer', 3, { level: 60 });
  const i = await g.ask(['この大会では、25歳以下の出場者も審査に加わる。', 'いちばん面白かったのは？（自分には投票できない）'], rv.map((x) => x.name), { cancel: 0 });
  return rv[i] ? rv[i].name : null;
}
registerContest('under25', {
  name: 'UNDER 25 OWARAI CHAMPIONSHIP', short: 'U25', kind: 'any', category: 'newcomer',
  organizer: 'ニッポン放送・SLUSH-PILE.', broadcaster: 'ニッポン放送（配信）', venue: 'シアターマーキュリー新宿', region: 'tokyo',
  history: { founded: 2023, ended: null, note: '25歳以下限定。2023年 第1回（決勝 草月ホール、エントリー1,004組）、2024年から準決勝・決勝の審査に出場者も参加。', sources: U25_SRC },
  schedule: { entry: { from: [6, 1], to: [6, 10] }, final: [9, 6] },
  eligibility: { ageMax: 25, pro: true, amateur: true, note: '決勝当日に満25歳以下（芸歴・プロアマ不問。養成所生・学生・アマチュアも可）' },
  prize: 250000, prizeText: '賞金25万円＋ニッポン放送のポッドキャスト番組パーソナリティ権（期間限定）',
  perform: { kind: 'any' },
  facts: {
    verified: ['主催ニッポン放送・SLUSH-PILE.', '2023年創設', '決勝当日満25歳以下（芸歴不問・アマ可）', '2023: 4月エントリー/6月1次/7月2次/8月準決勝/9月16日決勝 草月ホール/1,004組', '2024: 6月エントリー/1次は動画審査/9月22日決勝 シアターマーキュリー新宿', '2024〜 出場者も審査', '決勝10組', '賞金25万円＋ポッドキャスト権'],
    unverified: ['参加費', '予選の通過数・ネタ時間'],
  },
  rounds: [
    {
      id: 'r1', name: '1次予選（動画審査）', when: [7, 1], judge: 'staff', field: 1000, pass: 0.3,
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'r1');
        return withBackdrop(g, 'video', { title: ctx.def.name, sub: `${edLabel(ctx)} 1次予選（動画審査）`, sign: 'ネタ動画 撮影中', cast: castOf(g) }, async () => {
          if (!skip) await g.say([`1次予選は動画審査。${deviceOf(ctx.year)}を三脚に立てて、ネタを撮る。`, '撮り直しは何回でもできる。でも体力と時間は減っていく。']);
          let takes = 1;
          if (!skip) takes = 1 + (await g.ask('何テイク撮る？', ['一発撮り（1テイク）', '2テイク撮っていい方を出す', '納得いくまで（3テイク）'], { cancel: 0 }));
          let best = null;
          for (let i = 0; i < takes; i++) {
            const res = await stagePerform(g, ctx, { kind: 'any', round: `r1_take${i}`, title: `ネタ動画 テイク${i + 1}`, venue: { name: '自宅（撮影）', size: 'small', crowd: 'cold', pressure: 20 }, skip: skip || i > 0 });
            if (!best || res.score > best.score) best = res;
            if (i > 0 && typeof g.useStamina === 'function') g.useStamina(6);
          }
          const j = judgeField(g, ctx, 'r1', best.score, { field: 1000, pass: 0.3, sample: 30, level: 38 });
          const out = roundResult(best, { passed: j.passed, place: j.place, field: j.field });
          if (j.passed) await g.say(`動画審査、通過！（推定${j.place}位／約${j.field}組）`);
          else { out.reasons = failReasons(g, styleKind(g), best); await g.say([`動画審査で落ちた……（推定${j.place}位／約${j.field}組）`, `足りなかったもの：${out.reasons.join('、')}`]); }
          record(g, ctx, 'r1', out);
          return out;
        });
      },
    },
    { id: 'r2', name: '2次予選', when: [7, 8], judge: 'staff', field: 300, pass: 0.35, run: (g, ctx) => stageRound(g, ctx, { round: 'r2', name: '2次予選', scene: 'theater', sign: 'UNDER 25 2次予選', field: 300, pass: 0.35, level: 46, intro: ['2次予選。客席には同世代のお笑いファンが多い。', '25歳以下だけの舞台。ここで差をつけたい。'] }) },
    {
      id: 'semi', name: '準決勝', when: [8, 6], judge: 'panel', field: 60, pass: 10, venues: ['シアターマーキュリー新宿'],
      run: (g, ctx) => stageRound(g, ctx, {
        round: 'semi', name: '準決勝', scene: 'theater', sign: u25Venue(ctx.year), field: 60, pass: 10, level: 56,
        intro: (gg, c) => [`準決勝。会場は${u25Venue(c.year)}。決勝に進めるのは10組。`, c.year >= 2024 ? '今年から、準決勝と決勝の審査には25歳以下の出場者も加わる。' : '審査員の目は厳しい。'],
        after: async (gg, c) => { const v = await peerVote(gg, c, 'semi'); if (v) await gg.say(`${v}に一票を投じた。`); },
      }),
    },
    {
      id: 'final', name: '決勝', when: [9, 6], judge: 'panel', field: 10, final: true, tv: true, venues: ['草月ホール（2023）', 'シアターマーキュリー新宿（2024〜）'],
      run: (g, ctx) => stageRound(g, ctx, {
        round: 'final', name: '決勝', scene: 'theater', sign: u25Venue(ctx.year), field: 10, pass: 1, sample: 9, level: 64, final: true,
        judgesN: 6, judgeTitles: ['ラジオプロデューサー', '放送作家', '漫画家', 'ミュージシャン', '劇作家', '構成作家'],
        judgeText: '審査：審査員＋観客投票（2024年からは出場者も審査に参加）',
        intro: (gg, c) => [`決勝、${u25Venue(c.year)}。25歳以下の頂点を決める10組。`, '優勝すれば賞金とラジオ（ポッドキャスト）の冠番組。'],
        awards: [{ place: 1, name: '優勝', prize: 250000, fame: 180, fans: 1500 }],
        after: async (gg, c, out) => {
          const v = await peerVote(gg, c, 'final');
          if (v) await gg.say(`決勝でも出場者として${v}に一票。`);
          if (out.champion) {
            gg.message && gg.message({ from: 'ニッポン放送', kind: 'news', text: `UNDER 25 OWARAI CHAMPIONSHIP 優勝おめでとうございます。副賞の冠ポッドキャスト番組（期間限定）の収録についてご連絡します。` });
            await gg.say('副賞は冠ポッドキャスト番組。ラジオの世界への扉が開いた！');
          }
        },
      }),
    },
  ],
  news: [
    '25歳以下限定の賞レース「UNDER 25 OWARAI CHAMPIONSHIP」エントリー受付スタート。養成所生や学生も出場可',
    (g, ctx) => `UNDER 25、1次予選は動画審査。${deviceOf(ctx.year)}で撮ったネタ動画が続々と届く`,
    '「芸歴じゃなく年齢で区切る」――UNDER 25、芸歴1年目が決勝に残るケースも',
    (g, ctx) => (ctx.year >= 2024 ? 'UNDER 25、今年は準決勝・決勝の審査に25歳以下の出場者も参加' : 'UNDER 25 決勝は東京・草月ホール。審査員と観客投票で王者決定'),
    'UNDER 25 王者には賞金25万円とニッポン放送のポッドキャスト番組',
    (g, ctx) => `UNDER 25 決勝の会場は${u25Venue(ctx.year)}。配信チケットも販売`,
  ],
  catchcopy: (g, ctx) => `${ageOf(g, ctx.year)}歳、まだ何者でもない`,
});

// ================================================================== 今宮子供えびすマンザイ新人コンクール
// Verified (ja.wikipedia via search quotes; 今宮戎神社・TVランドの募集要項): 1980年から毎年夏、今宮戎神社の「今宮こどもえびす」の中で開催。
//   名前は「こども」でも子どもの大会ではない（祭りの名前）。プロを目指す、受賞歴のないコンビ・グループが対象、漫才だけでなくコントも可。
//   新人漫才福笑い大賞＝賞金20万円と楯、奨励賞＝10万円。開催事務局はTVランド（芸能事務所）。2019=第40回、2020〜2022は新型コロナで中止、
//   2023=第41回で復活、2024=第42回（7月23日）、2025=第43回（境内の末社乙姫稲荷神社前）。2026・2027年は本殿屋根葺替工事で休止。
//   → このゲームは史実どおり休止にする（2028年に第44回として再開する扱い。再開年は「休止明け」としての推定）。
// Unverified: 参加費、予選の方式、決勝の組数、ネタ時間 → generic.
const IMAMIYA_SRC = [
  'https://www.imamiya-ebisu.jp/archives/4251', 'https://www.imamiya-ebisu.jp/ebisuwp/wp-content/uploads/2024/05/42kai.manzaisinzin.pdf',
  'http://www.tvland.co.jp/top/manzai_2023/', 'http://www.tvland.co.jp/top/manzai_2024/', 'https://koubo.jp/contest/102980',
  'https://magazine.fany.lol/178275/', 'https://ja.wikipedia.org/wiki/今宮子供えびすマンザイ新人コンクール',
];
const IMAMIYA_GAPS = [[2020, 2022], [2026, 2027]];
function imamiyaEdition(y) {
  if (y < 1980) return null;
  for (const [a, b] of IMAMIYA_GAPS) if (y >= a && y <= b) return null;
  let n = 0;
  for (let k = 1980; k <= y; k++) if (!IMAMIYA_GAPS.some(([a, b]) => k >= a && k <= b)) n++;
  return n;
}
registerContest('imamiya', {
  name: '今宮子供えびすマンザイ新人コンクール', short: '今宮戎', kind: 'manzai', category: 'amateur',
  organizer: '今宮戎神社（今宮こどもえびす）／開催事務局 TVランド', broadcaster: null, venue: '今宮戎神社 境内（特設舞台）', region: 'osaka',
  history: {
    founded: 1980, ended: null, gaps: IMAMIYA_GAPS,
    note: '夏の「今宮こどもえびす」の中で開催（子どもの大会ではない）。2020〜2022 新型コロナで中止、2023 第41回で復活。2026・2027 本殿屋根葺替工事で休止（史実どおり）。',
    sources: IMAMIYA_SRC,
  },
  editionOf: imamiyaEdition,
  schedule: { entry: { from: [5, 1], to: [6, 5] }, final: [7, 8] },
  eligibility: { pro: true, amateur: true, members: [2, null], region: 'osaka', note: 'プロを目指す、受賞歴のないコンビ・グループ（漫才・コント可、プロ・アマ問わず）。受賞歴は予選の受付で確認' },
  prize: 200000, prizeText: '新人漫才福笑い大賞 賞金20万円と楯／奨励賞 10万円',
  perform: { kind: 'manzai' },
  facts: {
    verified: ['1980年創設・毎年夏・今宮こどもえびす', '受賞歴のないコンビ・グループ（プロを目指す）', '漫才・コント可', '福笑い大賞20万円＋楯、奨励賞10万円', '2019=第40回、2020-22中止、2023=第41回、2024=第42回（7/23）、2025=第43回', '2026-27 休止（屋根葺替）', '事務局TVランド'],
    unverified: ['参加費', '予選方式', '本選の組数', 'ネタ時間', '2028年再開（推定）'],
  },
  rounds: [
    {
      id: 'r1', name: '予選（ネタ審査・詳細非公開）', when: [6, 8], judge: 'staff', field: 40, pass: 10,
      run: async (g, ctx) => {
        if (hasAnyTitle(g)) {
          await g.say(['受付「すみません、こちらは受賞歴のないコンビ・グループのコンクールでして……」', '過去の受賞歴があるため、出場できなかった。']);
          const out = roundResult({ score: 0 }, { passed: false, reasons: ['受賞歴のない組が対象（要項）'] });
          record(g, ctx, 'r1', out);
          return out;
        }
        return stageRound(g, ctx, { round: 'r1', name: '予選（ネタ審査）', scene: 'theater', sign: 'マンザイ新人コンクール 予選', field: 40, pass: 10, level: 34, intro: ['今宮戎のマンザイ新人コンクール、予選。', '「受賞歴なし」の組だけが集まる。ここからが始まりだ。'] });
      },
    },
    {
      id: 'final', name: '本選（境内特設舞台）', when: [7, 8], judge: 'panel', field: 10, final: true, venues: ['今宮戎神社 境内'],
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'final');
        return withBackdrop(g, 'shrine', { title: ctx.def.name, sub: `${edLabel(ctx)} 本選`, sign: '今宮こどもえびす　マンザイ新人コンクール', cast: castOf(g) }, async () => {
          if (!skip) await g.say(['夏の夕方。境内には提灯がともり、屋台のソースの匂いが流れてくる。', 'こどもえびすの日。客席は家族連れと子どもたち、それに常連の漫才ファン。']);
          let mod = 0;
          if (!skip) {
            const i = await g.ask('どのネタでいく？', ['子どもにも分かる、明るいネタ', 'いつもの劇場向けの攻めたネタ', '地元・大阪ネタで境内をつかむ'], { cancel: 0 });
            const q = netaQualityOf(g, 'manzai');
            mod = i === 0 ? 5 : i === 1 ? (q >= 70 ? 6 : -6) : 3;
          }
          const res = await stagePerform(g, ctx, { kind: 'manzai', round: 'final', title: '本選（境内特設舞台）', venue: { name: '今宮戎神社 境内', size: 'small', crowd: 'warm', pressure: 45 }, skip });
          res.score = clamp(res.score + mod, 0, 100);
          const j = judgeField(g, ctx, 'final', res.score, { field: 10, pass: 1, sample: 9, level: 45, kind: 'manzai' });
          const out = roundResult(res, { passed: true, place: j.place, field: 10 });
          await showBoard(g, {
            title: 'マンザイ新人コンクール 本選', sub: `${edLabel(ctx)}　審査委員長と審査員による審査（点数はゲーム内の目安）`,
            cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 360 }, { key: 'score', label: '目安', w: 160, align: 'right' }],
            rows: j.rows.map((x, i) => ({ place: i + 1, name: x.name, score: i === 0 ? '福笑い大賞' : i === 1 ? '奨励賞' : `${x.score}`, me: x.me })),
          });
          if (j.place === 1) {
            out.champion = true; out.award = '新人漫才福笑い大賞'; // 賞金20万円（def.prize）は D1 が支払う
            await g.say([`新人漫才福笑い大賞は――${unitName(g)}！`, '賞金20万円と楯。境内の子どもたちが手をたたいて跳ねている。']);
            news(g, ctx, `【今宮戎】${edLabel(ctx)}マンザイ新人コンクール、福笑い大賞は${unitName(g)}`);
          } else if (j.place === 2) {
            out.award = '奨励賞';
            grant(g, ctx, 'shoreisho', { money: 100000 });
            await g.say(['奨励賞！ 賞金10万円。', `福笑い大賞は「${j.top.name}」。来年は……もう「受賞歴あり」だ。`]);
          } else {
            out.reasons = failReasons(g, 'manzai', res);
            await g.say([`入賞ならず（${j.place}位）。福笑い大賞は「${j.top.name}」。`, `足りなかったもの：${out.reasons.join('、')}`]);
          }
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    '今宮戎神社の夏の「こどもえびす」でマンザイ新人コンクール。境内に特設舞台',
    '今宮戎マンザイ新人コンクール、対象は「受賞歴のないコンビ・グループ」。コントでの出場もOK',
    '福笑い大賞は賞金20万円と楯。奨励賞は10万円',
    (g, ctx) => (ctx.year === 2023 ? '今宮戎マンザイ新人コンクール、コロナ禍の中止を経て4年ぶりに復活' : '今宮戎のコンクール、審査は審査委員長と審査員。境内の客席の反応も熱い'),
    '「こども」は祭りの名前――1980年から続く今宮戎の新人コンクール、今年も若手が境内へ',
    (g, ctx) => (ctx.year >= 2025 ? '今宮戎、本殿の屋根葺替工事に伴い2026・2027年のこどもえびすとコンクールは休止へ' : '今宮戎のコンクール出身者が劇場の看板に。「最初の賞」の重み'),
  ],
  catchcopy: () => '境内から始まる、最初の福笑い',
});

// ================================================================== 笑わん会
// Verified (search quotes): 大阪の新人お笑いライブ「笑わんかいライブ」を企画・運営した委員会（関西の芸能各社が参加）で、出演はキャリア原則5年以内の新人。
//   賞レースとしては 2002年=第3回（最優秀賞・優秀賞）、2007年=第8回（最優秀賞）、2010年=第11回（優勝）が確認できる → 第1回は2000年（逆算）。
//   主催は関西の放送作家（実在の人物のため名前は出さない）。
// Unverified: 2011年以降の開催（確認できず → 2010年を最後の確認回として扱い、以降は復刻開催）、会場、予選方式、ネタ時間、賞金.
const WARAWAN_SRC = [
  'https://www.nikkan-gendai.com/articles/view/geino/198387', 'https://www.geireki.net/lists/award/2007',
  'http://aatcap.jp/2021/01/22/diary-51/', 'https://ja.wikipedia.org/wiki/笑い飯', 'https://ja.wikipedia.org/wiki/さらば青春の光_(お笑いコンビ)',
];
registerContest('warawankai', {
  name: '笑わん会', short: '笑わん会', kind: 'any', category: 'kansai',
  organizer: '笑わん会（関西の新人お笑いライブ「笑わんかいライブ」運営委員会）', broadcaster: null, venue: '大阪市内の劇場（詳細非公開）', region: 'osaka',
  history: { founded: 2000, ended: 2010, note: '2002=第3回、2007=第8回、2010=第11回を確認（第1回は逆算で2000年）。2011年以降の開催は確認できず、以降は復刻開催扱い。', sources: WARAWAN_SRC },
  schedule: { entry: { from: [4, 1], to: [4, 10] }, final: [9, 5] },
  eligibility: { pro: true, amateur: false, geirekiMax: 5, region: 'osaka', note: '関西の芸能各社に所属する新人（キャリア原則5年以内）' },
  prizeText: '最優秀賞・優秀賞（賞金は詳細非公開）',
  facts: {
    verified: ['「笑わんかいライブ」運営委員会', '関西の芸能各社の新人・キャリア原則5年以内', '2002=第3回(最優秀賞/優秀賞)', '2007=第8回', '2010=第11回'],
    unverified: ['第1回=2000年（逆算）', '2011年以降', '会場', '予選の方式', 'ネタ時間', '賞金'],
  },
  rounds: [
    { id: 'r1', name: '笑わんかいライブ（予選）', when: [[5, 5], [6, 5], [7, 5]], judge: 'panel', field: 36, pass: 0.3, run: (g, ctx) => stageRound(g, ctx, { round: 'r1', name: '笑わんかいライブ（予選）', scene: 'theater', sign: '笑わんかいライブ', field: 36, pass: 0.3, level: 40, intro: ['関西の各事務所から、芸歴の浅い新人が集まる「笑わんかいライブ」。', '客席の常連が腕を組んでいる。「笑わんかい！」と言わせたら勝ちだ。'] }) },
    { id: 'final', name: '本選（最優秀賞・優秀賞）', when: [9, 5], judge: 'panel', field: 10, final: true, run: (g, ctx) => stageRound(g, ctx, { round: 'final', name: '本選', scene: 'theater', sign: '笑わん会', field: 10, pass: 1, sample: 9, level: 56, final: true, judgesN: 5, judgeTitles: ['放送作家', '劇場プロデューサー', 'ラジオディレクター', '構成作家', '演芸評論家'], judgeText: '審査：放送作家や劇場関係者による審査（詳細非公開）', intro: ['笑わん会、本選。各社の推しの新人がそろった。', '最優秀賞は、関西の若手にとって「最初の勲章」。'], awards: [{ place: 1, name: '最優秀賞', fame: 110, fans: 700 }, { place: 2, name: '優秀賞', fame: 50, fans: 300 }, { place: 3, name: '優秀賞', fame: 40, fans: 250 }] }) },
  ],
  news: [
    '関西の新人だけの「笑わんかいライブ」、今月も満員。各事務所の若手がしのぎを削る',
    '笑わん会の対象はキャリア原則5年以内。関西の若手の登竜門',
    (g, ctx) => `笑わん会 ${edLabel(ctx)}本選、最優秀賞と優秀賞の行方は`,
    (g, ctx) => (ctx.revival ? '笑わん会が復刻開催。「笑わんかい！」の掛け声が劇場に戻ってきた' : '笑わん会の最優秀賞コンビ、劇場の出番が倍増'),
    (g, ctx) => `${deviceOf(ctx.year)}に届いた笑わん会の結果。関西の芸能各社が注目`,
  ],
  catchcopy: () => '腕組みの客席を、ほどけ',
});

// ================================================================== 武−1グランプリ
// Verified: 武田塾が主催した「勉強をテーマとしたお笑いの祭典」。決勝は2018年3月23日にニコニコ生放送で配信。2018年3月に優勝者が決定.
// Unverified: 2回目以降（確認できず → 2018年のみ、以降は復刻開催）、出場資格、予選、ネタ時間、審査方式、賞金.
// Game staging (marked 「ゲーム独自」): 塾講師による「ネタの中の知識の正確さ」チェック（quiz minigame）を2割加点.
const BU1_SRC = ['https://www.takeda.tv/information/news/post-90423/', 'https://www.takeda.tv/toyohashi/blog/post-122321/'];
const STUDY = {
  eigo: { name: '英単語', qs: [
    { q: 'go の過去形は？', choices: ['went', 'goed', 'gone', 'going'], answer: 0 },
    { q: '「図書館」を英語で言うと？', choices: ['library', 'museum', 'station', 'hospital'], answer: 0 },
    { q: 'children の単数形は？', choices: ['child', 'childs', 'childer', 'chil'], answer: 0 },
  ] },
  rekishi: { name: '歴史の年号', qs: [
    { q: '関ヶ原の戦いがあった年は？', choices: ['1600年', '1582年', '1467年', '1868年'], answer: 0 },
    { q: '平安京に都が移された年は？', choices: ['794年', '710年', '1192年', '645年'], answer: 0 },
    { q: '大政奉還が行われた年は？', choices: ['1867年', '1853年', '1889年', '1603年'], answer: 0 },
  ] },
  sugaku: { name: '数学', qs: [
    { q: 'x² − 5x + 6 = 0 の解は？', choices: ['x = 2, 3', 'x = −2, −3', 'x = 1, 6', 'x = 5, 6'], answer: 0 },
    { q: '三角形の内角の和は？', choices: ['180度', '90度', '270度', '360度'], answer: 0 },
    { q: '円周率を小数第2位まで書くと？', choices: ['3.14', '3.41', '3.12', '3.16'], answer: 0 },
  ] },
  rika: { name: '理科', qs: [
    { q: '水の化学式は？', choices: ['H₂O', 'CO₂', 'O₂', 'NaCl'], answer: 0 },
    { q: '1気圧で水が沸騰する温度は？', choices: ['約100℃', '約50℃', '約80℃', '約150℃'], answer: 0 },
    { q: '光合成で植物が取り込む気体は？', choices: ['二酸化炭素', '窒素', '水素', 'ヘリウム'], answer: 0 },
  ] },
};
registerContest('bu1', {
  name: '武−1グランプリ', short: '武-1', kind: 'any', category: 'special',
  organizer: '武田塾', broadcaster: 'ニコニコ生放送（決勝）', venue: '（詳細非公開）', region: 'tokyo',
  history: { founded: 2018, ended: 2018, note: '「勉強をテーマとしたお笑いの祭典」。決勝は2018年3月23日にニコ生で配信。2回目以降は確認できず → 以降は復刻開催。', sources: BU1_SRC },
  schedule: { entry: { from: [1, 1], to: [1, 10] }, final: [3, 8] },
  eligibility: { pro: true, amateur: false, note: 'プロの芸人（出場資格の詳細は非公開）。ネタのテーマは「勉強」' },
  prizeText: '優勝（賞金・副賞は詳細非公開）',
  facts: { verified: ['主催 武田塾', '勉強をテーマとしたお笑いの祭典', '決勝 2018年3月23日 ニコニコ生放送'], unverified: ['2019年以降', '出場資格', '予選', 'ネタ時間', '審査方式', '賞金'] },
  rounds: [
    { id: 'r1', name: '予選（詳細非公開）', when: [2, 5], judge: 'staff', field: 60, pass: 8, run: (g, ctx) => stageRound(g, ctx, { round: 'r1', name: '予選', scene: 'jyuku', sign: '武−1グランプリ', field: 60, pass: 8, level: 48, intro: ['テーマは「勉強」。参考書も黒板も、全部ネタの小道具だ。', '「勉強あるある」で笑わせるか、「知識」で笑わせるか。'] }) },
    {
      id: 'final', name: '決勝（ニコ生配信）', when: [3, 8], judge: 'panel', field: 8, final: true, tv: true,
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'final');
        return withBackdrop(g, 'jyuku', { title: ctx.def.name, sub: `${edLabel(ctx)} 決勝（${ctx.year >= 2018 ? 'ニコ生' : 'ネット'}配信）`, sign: '武−1グランプリ 決勝', cast: castOf(g) }, async () => {
          const keys = Object.keys(STUDY);
          let subj = keys[0];
          if (!skip) {
            await g.say(['決勝。画面の向こうには受験生もたくさん見ている。', 'ネタの題材にする教科を決めよう。']);
            subj = keys[await g.ask('題材の教科は？', keys.map((k) => STUDY[k].name), { cancel: 0 })];
          }
          const res = await stagePerform(g, ctx, { kind: 'any', round: 'final', title: `勉強ネタ「${STUDY[subj].name}」`, theme: `勉強（${STUDY[subj].name}）`, venue: { name: '配信スタジオ', size: 'tv', crowd: 'normal', pressure: 65 }, skip });
          // ゲーム独自: 塾講師の正確さチェック（ネタの中の知識が正しいか）
          let acc = 70;
          if (!skip && !g.auto) {
            await g.say(['塾講師「ネタの中の知識、ちゃんと合ってましたか？ 抜き打ちで確かめます」', '（ゲーム独自の演出：正確さを2割加点）'], { name: '' });
            const q = await g.minigame('quiz', { questions: STUDY[subj].qs, genre: STUDY[subj].name, show: '武−1 正確さチェック', count: 3 });
            acc = Number(q && q.score) || 0;
          }
          const total = clamp(Math.round(res.score * 0.8 + acc * 0.2), 0, 100);
          const j = judgeField(g, ctx, 'final', total, { field: 8, pass: 1, sample: 7, level: 60 });
          const out = roundResult({ ...res, score: total }, { passed: true, place: j.place, field: 8, accuracy: acc });
          await showBoard(g, {
            title: '武−1グランプリ 決勝', sub: `${edLabel(ctx)}　笑い8割＋正確さ2割（ゲーム内の採点）`,
            cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 360 }, { key: 'score', label: '総合', w: 160, align: 'right' }],
            rows: j.rows.map((x, i) => ({ place: i + 1, name: x.name, score: `${x.score}`, me: x.me })),
          });
          if (j.place === 1) {
            out.champion = true; out.award = '優勝';
            await g.say([`武−1グランプリ、優勝は${unitName(g)}！`, '受験生のコメントが画面を埋めつくす。「明日のテスト、これで覚えた」']);
          } else {
            out.reasons = failReasons(g, styleKind(g), res);
            if (acc < 50) out.reasons.unshift('ネタの中の知識があやしかった');
            await g.say([`優勝は「${j.top.name}」。${unitName(g)}は${j.place}位。`, `足りなかったもの：${out.reasons.slice(0, 3).join('、')}`]);
          }
          news(g, ctx, `【武−1】${edLabel(ctx)}、勉強ネタの頂点は${out.champion ? unitName(g) : j.top.name}`);
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    '「勉強をテーマとしたお笑いの祭典」武−1グランプリ、決勝はネット生配信',
    '武−1グランプリ、参考書・黒板・年号……芸人たちの「勉強ネタ」が集結',
    (g, ctx) => `受験シーズンまっただ中の${ctx.year}年3月、武−1グランプリ決勝`,
    (g, ctx) => (ctx.revival ? '武−1グランプリが復刻開催。「笑って覚える」ネタに受験生の反応も' : '武−1の決勝、受験生からのコメントが殺到'),
    '「ネタの年号、合ってる？」武−1グランプリは知識の正確さにも注目',
  ],
  catchcopy: () => '笑って覚えろ、合格まで',
});

// ================================================================== ネクストブレイク芸人決定戦 よしもとアルコベールグランプリ
// Verified (大正製薬のプレスリリース 2019年5月13日): 「リポビタン アルコベール」の宣伝部長（前任はCMに起用されていた芸人コンビ）を決める
//   お笑いバトル「アルコベール グランプリ」。よしもとの若手芸人30組が出場。予選はネタ動画を公式Twitterで公開し、リツイート数の上位10組が本戦へ
//   （予選期間 2019年5月13日〜5月22日）。優勝者は宣伝部長に任命され、副賞はアルコベール1年分.
// Unverified: 本戦の日時・形式・審査、2020年以降（確認できず → 2019年のみ、以降は復刻開催）。
// Name: the task's 「ネクストブレイク芸人決定戦よしもとアルコベールグランプリ」 is used as the display name (the release calls it アルコベール グランプリ).
const ALCO_SRC = ['https://kyodonewsprwire.jp/release/201905136308', 'https://kyodonewsprwire.jp/prwfile/release/M104206/201904175541/_prw_PR1fl_AkgL5k08.pdf'];
registerContest('alcoveil', {
  name: 'ネクストブレイク芸人決定戦 よしもとアルコベールグランプリ', short: 'アルコベール', kind: 'any', category: 'agency',
  organizer: '大正製薬（リポビタン アルコベール）・吉本興業', broadcaster: '公式SNS（予選）', venue: '（本戦の会場は詳細非公開）', region: 'tokyo',
  history: { founded: 2019, ended: 2019, note: '2019年5月13日開幕。若手30組、予選はネタ動画のSNS拡散数上位10組が本戦へ。優勝＝宣伝部長＋副賞1年分。2020年以降は確認できず → 以降は復刻開催。', sources: ALCO_SRC },
  schedule: { entry: null, final: [6, 3] },
  eligibility: { pro: true, amateur: false, agency: ['yoshimoto'], invite: { fame: 300 }, note: 'よしもと所属の若手30組（主催側が選出・ネクストブレイク候補。招待制）' },
  fee: 0, prizeText: '優勝者は宣伝部長に任命、副賞アルコベール1年分',
  facts: { verified: ['大正製薬「リポビタン アルコベール」宣伝部長争奪戦', '2019年5月13日開幕', 'よしもと若手30組', '予選＝ネタ動画を公式SNSで公開、拡散（RT）数上位10組が本戦', '予選期間 5/13〜5/22', '優勝＝宣伝部長、副賞1年分'], unverified: ['本戦の日時・形式・審査', '2020年以降'] },
  rounds: [
    {
      id: 'sns', name: 'SNS予選（拡散数の上位10組）', when: [5, 4], judge: 'vote', field: 30, pass: 10,
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'sns');
        return withBackdrop(g, 'video', { title: ctx.def.short, sub: `${edLabel(ctx)} SNS予選（拡散数で上位10組）`, sign: 'ネタ動画 公開中', cast: castOf(g) }, async () => {
          if (!skip) await g.say(['予選はネタ動画。公式アカウントで公開され、拡散（リポスト）の数で本戦の10組が決まる。', `30組のうち、本戦に進めるのは10組。期間は10日間。`]);
          const res = await stagePerform(g, ctx, { kind: 'any', round: 'sns', title: 'ネタ動画（予選）', venue: { name: '撮影スタジオ', size: 'small', crowd: 'cold', pressure: 30 }, skip });
          let push = 0;
          if (!skip) {
            const a = await g.ask('拡散のために何をする？', ['相方と毎日告知を投稿する', '劇場の出番終わりに客席へお願いする', 'ネタの切り抜きを追加で出す', '何もしない（ネタで勝負）'], { cancel: 3 });
            push = [14, 10, 12, 0][a];
            if (a === 1 && typeof g.useStamina === 'function') g.useStamina(8);
          }
          const r = rngFor(g, ctx.id, ctx.year, 'rt');
          const mine = Math.round((res.score * 60 + fansOf(g) * 0.02 + push * 90) * (0.8 + r() * 0.4));
          const rv = rivalsFor(g, ctx, 'sns', 29, { level: 55, kind: 'any' });
          const rows = rv.map((x) => ({ name: x.name, n: Math.round((simScore(g, 'manzai', x.power, x.quality, r) * 60 + x.power * 40) * (0.7 + r() * 0.6)) }));
          rows.push({ name: unitName(g), n: mine, me: true });
          rows.sort((a, b) => b.n - a.n);
          const place = rows.findIndex((x) => x.me) + 1;
          await showBoard(g, {
            title: 'SNS予選 拡散数ランキング', sub: `${edLabel(ctx)}　上位10組が本戦へ（30組）`,
            cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 360 }, { key: 'n', label: '拡散数', w: 160, align: 'right' }],
            rows: rows.map((x, i) => ({ place: i + 1, name: x.name, n: x.n.toLocaleString('ja-JP'), me: x.me })), max: 11,
          });
          const out = roundResult(res, { passed: place <= 10, place, field: 30, shares: mine });
          if (out.passed) await g.say(`拡散数${mine.toLocaleString('ja-JP')}で${place}位、本戦へ！`);
          else { out.reasons = ['拡散数（ファンの数・告知の工夫）', ...failReasons(g, styleKind(g), res).slice(0, 2)]; await g.say([`${place}位。本戦の10組には届かなかった。`, `足りなかったもの：${out.reasons.join('、')}`]); }
          record(g, ctx, 'sns', out);
          return out;
        });
      },
    },
    {
      id: 'final', name: '本戦（宣伝部長決定戦）', when: [6, 3], judge: 'panel', field: 10, final: true,
      run: (g, ctx) => stageRound(g, ctx, {
        round: 'final', name: '本戦（宣伝部長決定戦）', scene: 'studio', sign: 'アルコベール グランプリ', field: 10, pass: 1, sample: 9, level: 60, final: true,
        judgeText: '審査：詳細非公開（ゲームでは審査員の採点）',
        intro: ['本戦。勝てば宣伝部長。ネクストブレイクの看板を背負うことになる。'],
        awards: [{ place: 1, name: '宣伝部長', fame: 150, fans: 1600 }],
        after: async (gg, c, out) => {
          if (out.champion) {
            d2(gg).flags[`alco_bucho_${c.year}`] = 1;
            gg.message && gg.message({ from: '宣伝部（スポンサー）', kind: 'news', text: `宣伝部長就任のお知らせ。副賞「アルコベール1年分」をお送りします。` });
            await gg.say('宣伝部長に任命！ 副賞は1年分。ネクストブレイク、の看板がついた。');
          }
        },
      }),
    },
  ],
  news: [
    'よしもと若手30組が「アルコベール グランプリ」に参戦。勝者は宣伝部長に',
    'アルコベール グランプリ、予選はネタ動画の拡散数勝負。上位10組だけが本戦へ',
    (g, ctx) => `ネクストブレイク芸人決定戦、${ctx.year}年の宣伝部長は誰の手に`,
    '「リポストお願いします！」劇場の出番終わり、若手が客席に頭を下げる',
    (g, ctx) => (ctx.revival ? 'アルコベール グランプリが復刻。ネクストブレイク候補30組が再び集結' : '宣伝部長の副賞は1年分。若手の目の色が変わる'),
  ],
  catchcopy: () => '次にブレイクするのは、拡散された者だ',
});

// ================================================================== ものまねグランプリ 次世代ものまね芸人No.1決定戦
// Verified: 日本テレビ「ものまねグランプリ」は2009年5月3日〜2023年。2020年5月19日放送のスペシャルで「次世代ものまね芸人No.1決定戦」。
//   シリーズの「ザ・トーナメント」形式（2023年）：25組が5ブロックに分かれ、審査員7人がいちばん良いと思った人に投票、各ブロック1位が決勝へ、
//   決勝も審査員投票（2023）。2021年は決勝が生放送の視聴者投票.
// Unverified: 「次世代…決定戦」そのものの採点方式・出場資格・毎年の開催 → シリーズのザ・トーナメント形式を流用、2020年創設・2023年終了扱い。
// ものまねの対象は全て架空の有名人（実在の人物は出さない）。
const MONO_SRC = [
  'https://www.daily.co.jp/gossip/2020/05/23/0013363673.shtml', 'https://thetv.jp/program/0001006861/1/', 'https://dic.nicovideo.jp/t/a/ものまねグランプリ',
  'https://www.tvlife.jp/variety/439162', 'https://tmbi-joho.com/2023/12/12/mgp23w/',
];
const MONO_TARGETS = ['大御所演歌歌手（架空）', '昭和のアイドル（架空）', '朝ドラの名脇役（架空）', 'ロックバンドのボーカル（架空）', 'ニュースキャスター（架空）', 'アニメの悪役の声（架空）'];
registerContest('monomanegp', {
  name: 'ものまねグランプリ 次世代ものまね芸人No.1決定戦', short: 'ものまねGP', kind: 'monomane', category: 'tv',
  organizer: '日本テレビ', broadcaster: '日本テレビ系「ものまねグランプリ」', venue: '日本テレビ スタジオ', region: 'tokyo',
  history: { founded: 2020, ended: 2023, note: 'シリーズは2009年5月3日〜2023年。「次世代ものまね芸人No.1決定戦」は2020年5月19日放送。形式はシリーズの「ザ・トーナメント」（25組・5ブロック・審査員7人の投票）を流用。', sources: MONO_SRC },
  schedule: { entry: null, final: [5, 6] },
  eligibility: { pro: true, amateur: false, geirekiMax: 10, invite: { fame: 200 }, note: '次世代（若手）のものまね芸人。番組から声がかかる（ゲームでは芸歴10年以内・招待制）' },
  fee: 0, prizeText: '次世代ものまね芸人No.1の称号（賞金は詳細非公開）',
  perform: { kind: 'monomane' },
  facts: { verified: ['日本テレビ「ものまねグランプリ」2009年5月3日〜2023年', '2020年5月19日「次世代ものまね芸人No.1決定戦」', 'ザ・トーナメント: 25組・5ブロック・審査員7人の投票・各ブロック1位が決勝', '2021年決勝は視聴者投票、2023年は審査員投票'], unverified: ['次世代決定戦そのものの採点・資格', '毎年の開催', '賞金'] },
  rounds: [
    { id: 'aud', name: '番組オーディション', when: [4, 5], judge: 'staff', field: 80, pass: 25, run: (g, ctx) => stageRound(g, ctx, { round: 'aud', name: '番組オーディション', scene: 'studio', sign: 'ものまねグランプリ', field: 80, pass: 25, level: 45, kind: 'monomane', useC: 'pinneta', style: 'monomane', custom: { id: 'rhythm', opts: { song: 'ものまねメドレー（架空）', style: 'sing', lanes: 2 } }, intro: ['ディレクター「次世代枠のオーディションです。いちばん自信のあるものまねを」', `持ちネタは「${MONO_TARGETS[0]}」と「${MONO_TARGETS[1]}」。`] }) },
    {
      id: 'final', name: '本番収録（ブロック対決→決勝）', when: [5, 6], judge: 'vote', judges: 7, field: 25, final: true, tv: true,
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'final');
        return withBackdrop(g, 'studio', { title: ctx.def.short, sub: `${edLabel(ctx)} 次世代ものまね芸人No.1決定戦`, sign: '次世代ものまね芸人No.1決定戦', signColor: '#ff7eb6', cast: castOf(g) }, async () => {
          let target = MONO_TARGETS[0];
          if (!skip) {
            await g.say(['25組が5つのブロックに分かれて対決。審査員7人が、ブロックでいちばん良かった1組に投票する。', '各ブロックの1位だけが決勝へ。']);
            target = MONO_TARGETS[await g.ask('ブロック対決で見せるものまねは？', MONO_TARGETS.slice(0, 4), { cancel: 0 })];
          }
          const res = await stagePerform(g, ctx, { kind: 'monomane', round: 'final', title: `ものまね「${target}」`, style: 'monomane', theme: target, useC: 'pinneta', custom: { id: 'rhythm', opts: { song: `${target}メドレー`, style: 'sing', lanes: 2 } }, venue: { name: '日本テレビ スタジオ', size: 'tv', crowd: 'warm', pressure: 70 }, skip });
          const judges = judgesFor(g, ctx, 7, ['歌手', '俳優', 'ものまね芸人（大御所）', 'タレント', '女優', 'お笑い芸人', 'ものまね芸人']);
          const voteFor = (scores, who) => { const r = rngFor(g, ctx.id, ctx.year, 'vote', who); const v = new Array(scores.length).fill(0); for (let k = 0; k < 7; k++) { let bi = 0, bv = -1; scores.forEach((s, i) => { const x = s + (r() - 0.5) * 18; if (x > bv) { bv = x; bi = i; } }); v[bi]++; } return v; };
          const rv = rivalsFor(g, ctx, 'block', 4, { level: 62, kind: 'monomane', pinOnly: true });
          const r = rngFor(g, ctx.id, ctx.year, 'blk');
          const names = [unitName(g), ...rv.map((x) => x.name)];
          const scores = [res.score, ...rv.map((x) => simScore(g, 'monomane', x.power, x.quality, r))];
          const votes = voteFor(scores, 'block');
          const order = names.map((n, i) => ({ name: n, v: votes[i], me: i === 0 })).sort((a, b) => b.v - a.v || (a.me ? -1 : 1));
          await showBoard(g, {
            title: 'ブロック対決（審査員7人の投票）', sub: `${edLabel(ctx)}　ブロック1位が決勝へ`,
            cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 380 }, { key: 'v', label: '票', w: 140, align: 'right' }],
            rows: order.map((x, i) => ({ place: i + 1, name: x.name, v: `${x.v}票`, me: x.me })), note: `審査員：${judges.map((j) => j.title).join('・')}（全員架空）`,
          });
          const blockPos = order.findIndex((x) => x.me) + 1;
          // overall place among 25: the 5 block winners are 1..5, block 2nd ≈ 6..10, 3rd ≈ 11..15 …
          const out = roundResult(res, { passed: true, place: blockPos === 1 ? 1 : 3 + (blockPos - 1) * 5, field: 25, blockPos });
          if (!order[0].me) {
            out.reasons = failReasons(g, 'monomane', res);
            await g.say([`ブロック${blockPos}位。決勝に進んだのは「${order[0].name}」。`, `足りなかったもの：${out.reasons.join('、')}`]);
            record(g, ctx, 'final', out);
            return out;
          }
          await g.say('ブロック1位！ 決勝へ。');
          const fin = await stagePerform(g, ctx, { kind: 'monomane', round: 'final2', title: `決勝「${MONO_TARGETS[4]}」`, style: 'monomane', useC: 'pinneta', custom: { id: 'rhythm', opts: { song: '決勝メドレー', style: 'sing', lanes: 4 } }, venue: { name: '日本テレビ スタジオ', size: 'tv', crowd: 'warm', pressure: 85 }, skip });
          const fr = rivalsFor(g, ctx, 'final2', 4, { level: 70, kind: 'monomane', pinOnly: true, offset: 4 });
          const fs = [fin.score, ...fr.map((x) => simScore(g, 'monomane', x.power, x.quality, r))];
          const viewers = ctx.year === 2021;
          let fv;
          if (viewers) { const tot = fs.reduce((a, b) => a + Math.max(1, b) ** 2, 0); fv = fs.map((s) => Math.round((Math.max(1, s) ** 2 / tot) * 100)); } else fv = voteFor(fs, 'final');
          const fo = [unitName(g), ...fr.map((x) => x.name)].map((n, i) => ({ name: n, v: fv[i], me: i === 0 })).sort((a, b) => b.v - a.v || (a.me ? -1 : 1));
          await showBoard(g, {
            title: viewers ? '決勝（視聴者投票）' : '決勝（審査員7人の投票）', sub: edLabel(ctx),
            cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 380 }, { key: 'v', label: viewers ? '得票率' : '票', w: 140, align: 'right' }],
            rows: fo.map((x, i) => ({ place: i + 1, name: x.name, v: viewers ? `${x.v}%` : `${x.v}票`, me: x.me })),
          });
          const fin1 = roundResult(fin, { passed: true, place: fo.findIndex((x) => x.me) + 1, field: 25 });
          if (fo[0].me) {
            fin1.champion = true; fin1.award = '次世代ものまね芸人No.1';
            await g.say([`次世代ものまね芸人No.1は――${unitName(g)}！`, 'スタジオの大御所たちが立ち上がって拍手している。']);
          } else { fin1.reasons = failReasons(g, 'monomane', fin); await g.say([`決勝は${fin1.place}位。No.1は「${fo[0].name}」。`, `足りなかったもの：${fin1.reasons.join('、')}`]); }
          news(g, ctx, `【ものまねグランプリ】次世代No.1決定戦は${fo[0].name}が制す`);
          record(g, ctx, 'final', fin1);
          return fin1;
        });
      },
    },
  ],
  news: [
    '日本テレビ「ものまねグランプリ」で次世代ものまね芸人No.1決定戦。若手25組が5ブロックで激突',
    'ものまねグランプリ、審査員7人が「ブロックでいちばん良かった1組」に投票する方式',
    (g, ctx) => (ctx.year === 2021 ? 'ものまねグランプリ、決勝は生放送の視聴者投票で決定' : 'ものまねグランプリ決勝は審査員投票。大御所たちの一票の重み'),
    '次世代のものまね芸人、「歌まね」だけでなく「声まね」「形態模写」でも勝負',
    (g, ctx) => (ctx.revival ? 'ものまねグランプリ「次世代」決定戦が復刻。新しい世代の歌まねが集結' : '次世代ものまね芸人No.1、優勝者に番組オファーが殺到'),
  ],
  catchcopy: () => '似ているだけじゃ、No.1にはなれない',
});

// ================================================================== 笑ラウドネスGP
// Verified: ABEMAのお笑い賞レース。審査員はおらず、観客の笑い声と拍手を計測して数値化（2022年は「笑量測定型AI賞レース」）。
//   2021年（第1回）：決勝7月18日放送、予選を勝ち抜いた15組、観客80人、総エントリー821組。
//   2022年（第2回）：決勝7月17日放送、エントリー1018組から15組。優勝賞金95万8400円・ABEMAの人気番組への出演権。
//   優勝得点95.84（一覧サイト）→ 賞金＝得点×1万円（95.84点→95万8400円からの推定）。
// Unverified: 2023年以降（確認できず → 2022年を最後の確認回として扱い、以降は復刻開催）、出場資格、予選の方式、ネタ時間.
const LOUD_SRC = [
  'https://times.abema.tv/articles/-/8666260', 'https://thetv.jp/news/detail/1042740/p2/', 'https://times.abema.tv/articles/-/10031984',
  'https://entamenext.com/articles/detail/19072', 'https://thetv.jp/news/detail/1094156/', 'https://natalie.mu/owarai/news/485876',
  'https://owarai-award.com/waraudonessgp-result/', 'https://news.yahoo.co.jp/expert/articles/f1c6f79d33b2b2a2e08dc36f9e2757d0535fc47f',
];
const loudEntries = (y) => (y === 2021 ? 821 : y === 2022 ? 1018 : 1000);
const toLoud = (score, r) => Math.round(clamp(62 + score * 0.34 + (r() - 0.5) * 3, 50, 99.99) * 100) / 100;
registerContest('loudness', {
  name: '笑ラウドネスGP', short: '笑ラウドネス', kind: 'any', category: 'tv',
  names: [{ from: 2021, name: '笑ラウドネスGP' }],
  organizer: 'ABEMA', broadcaster: 'ABEMA', venue: 'ABEMAのスタジオ（観客80人）', region: 'tokyo',
  history: { founded: 2021, ended: 2022, note: '審査員なし・観客の笑い声と拍手を計測して数値化。2021: 821組→決勝15組・観客80人、2022: 1018組→15組・賞金95万8400円。2023年以降は確認できず → 復刻開催扱い。', sources: LOUD_SRC },
  schedule: { entry: { from: [4, 1], to: [5, 1] }, final: [7, 6] },
  eligibility: { pro: true, amateur: true, note: '出場資格の詳細は未確認（ゲームではプロ・アマ不問）' },
  prizeText: '優勝賞金＝笑量の得点×1万円（2022年は95万8400円）＋ABEMAの番組出演権',
  facts: { verified: ['ABEMA', '審査員なし・笑い声と拍手を計測', '2021: 7/18放送・15組・観客80人・821組', '2022: 7/17放送・1018組・15組・賞金95万8400円・番組出演権'], unverified: ['賞金=得点×1万円（推定）', '2023年以降', '出場資格', '予選の方式', 'ネタ時間'] },
  rounds: [
    { id: 'r1', name: '予選（詳細非公開）', when: [5, 6], judge: 'staff', field: 1000, pass: 15, run: (g, ctx) => stageRound(g, ctx, { round: 'r1', name: '予選', scene: 'theater', sign: '笑ラウドネスGP 予選', field: loudEntries(ctx.year), pass: 15, sample: 30, level: 50, intro: (gg, c) => [`エントリーは${loudEntries(c.year)}組。決勝に進めるのは15組。`, '決勝には審査員がいない。測るのは「笑いの大きさ」だけ。'] }) },
    {
      id: 'final', name: '決勝（笑量測定）', when: [7, 6], judge: 'audience', field: 15, final: true, tv: true,
      run: async (g, ctx) => {
        const skip = await askSkip(g, ctx, 'final');
        return withBackdrop(g, 'studio', { title: ctx.def.name, sub: `${edLabel(ctx)} 決勝`, sign: '笑ラウドネスGP', cast: castOf(g) }, async () => {
          if (!skip) await g.say(['決勝。客席には観客80人。審査員席は……ない。', '笑い声と拍手を計測して数値化。言い訳のできない大会だ。']);
          const res = await stagePerform(g, ctx, { kind: 'any', round: 'final', title: '笑量測定', venue: { name: 'ABEMAスタジオ（観客80人）', size: 'tv', crowd: 'normal', pressure: 75 }, skip });
          const r = rngFor(g, ctx.id, ctx.year, 'loud');
          const mine = toLoud(res.score, r);
          await showMeter(g, { title: '笑い声メーター（笑い声＋拍手）', sub: `${edLabel(ctx)}　${unitName(g)}`, label: '笑量（観客80人）', unit: '点', samples: res.heat, value: mine, decimals: 2, theme: 'laugh', note: '審査員はいない。客席の笑い声と拍手を計測して数値化する。' });
          const rv = rivalsFor(g, ctx, 'final', 14, { level: 66 });
          const rows = rv.map((x) => ({ name: x.name, v: toLoud(simScore(g, 'manzai', x.power, x.quality, r), r) }));
          rows.push({ name: unitName(g), v: mine, me: true });
          rows.sort((a, b) => b.v - a.v);
          const place = rows.findIndex((x) => x.me) + 1;
          await showBoard(g, {
            title: '笑ラウドネスGP 決勝 笑量ランキング', sub: `${edLabel(ctx)}　15組`,
            cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 380 }, { key: 'v', label: '笑量', w: 140, align: 'right' }],
            rows: rows.map((x, i) => ({ place: i + 1, name: x.name, v: x.v.toFixed(2), me: x.me })),
          });
          const out = roundResult(res, { passed: true, place, field: 15, loudness: mine });
          if (place === 1) {
            const prize = Math.round(mine * 10000);
            out.champion = true; out.award = '優勝'; out.prize = prize;
            grant(g, ctx, 'prize', { money: prize }); // 得点で変わる賞金は def.prize にできないのでここで支払う（名誉・ファンは D1）
            await g.say([`笑量${mine.toFixed(2)}点で優勝！`, `賞金は得点×1万円＝${yen(prize)}。ABEMAの番組出演権も手に入れた。`]);
          } else {
            out.reasons = failReasons(g, styleKind(g), res);
            await g.say([`笑量${mine.toFixed(2)}点、${place}位。優勝は「${rows[0].name}」（${rows[0].v.toFixed(2)}点）。`, `足りなかったもの：${out.reasons.join('、')}`]);
          }
          news(g, ctx, `【笑ラウドネスGP】${edLabel(ctx)}王者は${rows[0].name}、笑量${rows[0].v.toFixed(2)}点`);
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    '“笑いの大きさ”だけで王者を決める「笑ラウドネスGP」。審査員はゼロ',
    (g, ctx) => `笑ラウドネスGP、エントリーは${loudEntries(ctx.year)}組。決勝は観客の前で笑量を計測`,
    '笑ラウドネスGP、優勝賞金は笑量の得点×1万円。0.01点が1万円を動かす',
    '「言い訳のできない大会」――笑ラウドネスGP決勝、計測されるのは笑い声と拍手',
    (g, ctx) => (ctx.revival ? '笑ラウドネスGPが復刻開催。中堅のセカンドチャンスとしても注目' : '笑ラウドネスGP、中堅芸人の「セカンドチャンス」になるか'),
  ],
  catchcopy: () => '審査員はいない。笑い声がすべて',
});

// ================================================================== Bs-1グランプリ
// Name: 「Bs」はオリックス・バファローズの略称。BSよしもとに同名の賞レースは見つからず（BSよしもとは「営業-1グランプリ」等）、
//   お笑いの「Bs-1グランプリ」はオリックス主催のものだけが確認できたので、これを採用.
// Verified: オリックス・バファローズ主催。「オリックス大好き芸人」が京セラドーム大阪に集結し、試合終了後にネタバトル。
//   第3回=2023年8月20日（「Bs夏の陣2023」期間中）、第4回=2024年8月3日（ロッテ戦の試合終了後）。優勝者には翌シーズンの特別始球式投球権.
// Unverified: 第1回の年（第3回から逆算して2021年）、審査方式、出場組数、ネタ時間 → generic（球場の観客の拍手）.
const BS1_SRC = ['https://www.buffaloes.co.jp/news/detail/202300303460.html', 'https://baseballking.jp/ns/437861/', 'https://baseballking.jp/ns/543619/'];
registerContest('bs1', {
  name: 'Bs-1グランプリ', short: 'Bs-1', kind: 'any', category: 'special',
  organizer: 'オリックス・バファローズ', broadcaster: null, venue: '京セラドーム大阪（試合終了後のグラウンド）', region: 'osaka',
  history: { founded: 2021, ended: null, note: 'オリックス大好き芸人のネタバトル。第3回2023年8月20日、第4回2024年8月3日（いずれも試合終了後）。第1回は逆算で2021年。', sources: BS1_SRC },
  schedule: { entry: null, final: [8, 3] },
  eligibility: { pro: true, amateur: false, invite: { fame: 150 }, note: 'オリックス大好き芸人（球団が招く。プロの芸人・招待制）' },
  fee: 0, prizeText: '翌シーズンの特別始球式投球権',
  facts: { verified: ['オリックス・バファローズ主催', 'オリックス大好き芸人', '京セラドーム大阪・試合終了後', '第3回 2023/8/20、第4回 2024/8/3', '優勝＝翌シーズンの特別始球式投球権'], unverified: ['第1回=2021年（逆算）', '審査方式', '出場組数', 'ネタ時間'] },
  onMorning: (g, ctx) => {
    const s = d2(g);
    const d = (ctx && ctx.date) || contestDate(g);
    const y = (ctx && ctx.year) || d.year;
    if (!y || !d || !s.flags.bs1Pitch || s.flags.bs1Pitch !== y || d.month !== 4 || d.dom !== 2) return;
    s.flags.bs1Pitch = 0;
    const r = rngFor(g, 'bs1', y, 'pitch');
    const nobou = r() < 0.5 + powerOf(g, 'any') / 300;
    if (typeof g.message === 'function') g.message({ from: 'お笑いニュース', kind: 'news', text: `【Bs-1王者】${unitName(g)}が京セラドーム大阪で特別始球式。${nobou ? 'ノーバウンド投球にスタンドが沸いた' : 'ワンバウンドにスタンドから笑いと拍手'}` });
    grant(g, { id: 'bs1', year: y }, 'pitch', { fame: 40, fans: 500 });
  },
  rounds: [
    {
      id: 'final', name: '本番（試合終了後のグラウンド）', when: [8, 3], judge: 'audience', field: 8, final: true,
      run: async (g, ctx) => {
        const s = d2(g);
        if (!s.flags.orixFan && !g.auto) {
          const i = await g.ask('球団の人「Bs-1グランプリは、オリックス大好き芸人の大会です。……オリックス、好きですよね？」', ['もちろん！ 応援歌も歌えます', 'これから好きになります！'], { cancel: 1 });
          s.flags.orixFan = i === 0 ? 2 : 1;
        }
        return withBackdrop(g, 'ballpark', { title: ctx.def.name, sub: `${edLabel(ctx)}　試合終了後`, sign: '京セラドーム大阪', cast: castOf(g) }, async () => {
          const skip = await askSkip(g, ctx, 'final');
          if (!skip) await g.say(['試合終了。帰らずに残ったファンで、スタンドはまだ熱い。', 'グラウンドの特設ステージに立つ。ネタの持ち時間は短め。野球ネタはウケる……はず。']);
          let mod = 0;
          if (!skip) {
            const i = await g.ask('どのネタでいく？', ['オリックス愛たっぷりの野球ネタ', 'いつもの鉄板ネタ', '今日の試合をいじるアドリブ'], { cancel: 1 });
            mod = i === 0 ? (s.flags.orixFan === 2 ? 7 : 3) : i === 2 ? Math.round((powerOf(g, 'any') - 55) / 4) : 0;
          }
          const res = await stagePerform(g, ctx, { kind: 'any', round: 'final', title: 'Bs-1グランプリ', venue: { name: '京セラドーム大阪', size: 'hall', crowd: 'warm', pressure: 60 }, skip });
          res.score = clamp(res.score + mod, 0, 100);
          const j = judgeField(g, ctx, 'final', res.score, { field: 8, pass: 1, sample: 7, level: 55 });
          const out = roundResult(res, { passed: true, place: j.place, field: 8 });
          await showMeter(g, { title: 'スタンドの拍手', sub: `${edLabel(ctx)}　${unitName(g)}`, label: '拍手（ゲーム内の判定・審査方式は非公開）', unit: '', samples: res.heat, value: res.score, decimals: 0, theme: 'cheer' });
          if (j.place === 1) {
            out.champion = true; out.award = '優勝（翌シーズン特別始球式投球権）';
            s.flags.bs1Pitch = ctx.year + 1;
            await g.say([`Bs-1グランプリ、優勝は${unitName(g)}！`, `副賞は来シーズンの特別始球式。${ctx.year + 1}年4月、京セラドーム大阪のマウンドへ。`]);
          } else {
            out.reasons = failReasons(g, styleKind(g), res);
            await g.say([`優勝は「${j.top.name}」。${unitName(g)}は${j.place}位。`, '始球式はおあずけ。来年もオリックス愛をアピールしよう。']);
          }
          news(g, ctx, `【Bs-1グランプリ】${edLabel(ctx)}は${out.champion ? unitName(g) : j.top.name}が制し、来季の始球式へ`);
          record(g, ctx, 'final', out);
          return out;
        });
      },
    },
  ],
  news: [
    'オリックス大好き芸人が京セラドーム大阪に集結。試合終了後に「Bs-1グランプリ」',
    'Bs-1グランプリの優勝賞品は、翌シーズンの特別始球式投球権',
    (g, ctx) => `「Bs夏の陣」期間中の${ctx.year}年8月、試合後のグラウンドでネタバトル`,
    'Bs-1グランプリ、スタンドに残ったファンの拍手が芸人を後押し',
    '始球式はノーバウンドか、それとも……。Bs-1王者のマウンドに注目',
  ],
  catchcopy: () => '試合が終わっても、まだ帰らせない',
});

// ================================================================== OKOWAチャンピオンシップ
// Verified: 「恐い話（怪談）のチャンピオン」を決める大会。有限会社ちゅるんカンパニー（Web番組「おちゅーんLive!」）が2018年に創設。
//   2018年6月6日、大阪・新世界のシアター朝日で初代王者決定トーナメント開幕戦（16人）→7月7日決勝。2019年は8月17日に決勝（ニコ生配信）。
//   2020年大会は9月開幕、2021年初頭に第1ステージ（15人）。ジャンル不問で「いちばん恐い話」をした人が勝ち（怪談師・僧侶・芸人など）.
// Unverified: 判定方式（ゲームでは観客の判定）、持ち時間、2022年以降の開催 → generic.
const OKOWA_SRC = [
  'https://www.atpress.ne.jp/news/157546', 'https://abeno.keizai.biz/headline/2874/', 'https://www.atpress.ne.jp/news/160353',
  'https://www.atpress.ne.jp/news/161520', 'https://blog.nicovideo.jp/niconews/113196.html', 'https://blog.nicovideo.jp/niconews/147946.html',
  'https://ja.wikipedia.org/wiki/OKOWA',
];
// 怪談の組み立て（ゲーム独自）: 舞台・違和感・締め。scores: how much each choice adds to the fear.
export const KAIDAN = {
  stage: [['深夜のコンビニの夜勤', 6], ['古い団地の階段', 8], ['劇場の楽屋（芸人の実体験）', 9], ['田舎の祖母の家の仏間', 7]],
  odd: [['誰もいないはずの足音', 6], ['鏡に映る「もう一人」', 8], ['留守電に残された自分の声', 10], ['名前を呼ぶ声', 7]],
  end: [['静かに、間を置いて終える', 10], ['最後に大声で驚かせる', 3], ['後日談で背筋を冷やす', 8]],
};
export const KAIDAN_SCENES = [
  { prompt: '客席「……それで？」（静まり返っている）', answers: [{ text: '「……その夜、ドアが三回、鳴ったんです」', score: 'best' }, { text: '「えーっと、どこまで話しましたっけ」', score: 'bad' }, { text: '「怖いでしょ？ もっと怖くなりますよ」', score: 'ok' }] },
  { prompt: '照明が一段暗くなった', answers: [{ text: '（声を落として）「振り向いたら……誰もいない」', score: 'best' }, { text: '「ほんで振り向いたらな！」（大声）', score: 'ok' }, { text: '「あ、暗い」', score: 'bad' }] },
  { prompt: '客席の誰かが息をのむ', answers: [{ text: '（間を取る）……「でも、足音は続いていた」', score: 'best' }, { text: '「今、息のんだ人いますね」', score: 'ok' }, { text: '「はい、おしまい！」', score: 'bad' }] },
  { prompt: '締めの一言', answers: [{ text: '「……あの部屋、今も空いてるそうです」', score: 'best' }, { text: '「わっ！！」', score: 'ok' }, { text: '「まあ、気のせいでしょうね」', score: 'bad' }] },
];
// One 怪談: the build (choices) + the telling (C's talk performance, or the talk minigame with 怪談 scenes) → fear 0..100.
export async function tellKaidan(g, ctx, roundId, opts = {}) {
  const skip = opts.skip;
  let build = 18;
  if (!skip && !g.auto) {
    const a = await g.ask('話の舞台は？', KAIDAN.stage.map((x) => x[0]), { cancel: 0 });
    const b = await g.ask('違和感の出し方は？', KAIDAN.odd.map((x) => x[0]), { cancel: 0 });
    const c = await g.ask('締め方は？', KAIDAN.end.map((x) => x[0]), { cancel: 0 });
    build = KAIDAN.stage[a][1] + KAIDAN.odd[b][1] + KAIDAN.end[c][1];
  } else build = 22;
  const res = await stagePerform(g, ctx, { kind: 'kaidan', round: roundId, title: opts.title || '怪談', style: 'kaidan', theme: '怪談', custom: { id: 'talk', opts: { topic: '怪談ライブ', scenes: KAIDAN_SCENES, count: 4, set: 'room', show: opts.show || '怪談', mc: '進行役' } }, venue: { name: opts.venue || '劇場', size: 'small', crowd: 'normal', pressure: opts.pressure ?? 60 }, skip });
  const fear = clamp(Math.round(res.score * 0.72 + build), 0, 100);
  res.fear = fear;
  res.heat = (res.heat || []).map((v) => clamp(Math.round(v * 0.7 + fear * 0.3), 0, 100));
  return res;
}
async function okowaBout(g, ctx, roundId, name, level, isFinal) {
  const skip = await askSkip(g, ctx, roundId);
  return withBackdrop(g, 'kaidan', { title: ctx.def.name, sub: `${edLabel(ctx)} ${name}`, sign: '恐い話 No.1 決定戦', cast: castOf(g) }, async () => {
    const rv = rivalsFor(g, ctx, roundId, 1, { level, kind: 'talk', pinOnly: true })[0];
    if (!skip) await g.say([`${name}。相手は「${rv.name}」。`, '一対一。より恐い話をした方が勝ち上がる。客席の灯りが落ちた。']);
    const res = await tellKaidan(g, ctx, roundId, { skip, title: `${name}の怪談`, show: 'OKOWAチャンピオンシップ', venue: 'シアター朝日（大阪・新世界）', pressure: isFinal ? 85 : 60 });
    await showMeter(g, { title: '恐怖メーター（客席の悲鳴と静寂）', sub: `${edLabel(ctx)} ${name}　${unitName(g)}`, label: '恐さ', unit: '', samples: res.heat, value: res.fear, decimals: 0, theme: 'fear', note: '判定方式は非公開。ゲームでは客席の反応で判定する。' });
    const r = rngFor(g, ctx.id, ctx.year, roundId, 'opp');
    const opp = clamp(Math.round(simScore(g, 'talk', rv.power, rv.quality, r) * 0.72 + 20), 0, 100);
    const win = res.fear > opp || (res.fear === opp && r() < 0.5);
    const out = roundResult({ ...res, score: res.fear }, { passed: win, place: win ? 1 : 2, field: 2, opponent: rv.name, oppScore: opp });
    if (win) {
      await g.say(isFinal ? [`判定――${unitName(g)}！`, 'OKOWAチャンピオンシップ王者。チャンピオンベルトが肩にかけられた。'] : `判定は${unitName(g)}。（恐さ ${res.fear} 対 ${opp}）勝ち上がった。`);
      if (isFinal) { out.champion = true; out.award = 'チャンピオンベルト'; }
    } else {
      out.reasons = failReasons(g, 'talk', res);
      await g.say([`判定は「${rv.name}」。（恐さ ${res.fear} 対 ${opp}）`, `足りなかったもの：${out.reasons.join('、')}`]);
    }
    if (isFinal) news(g, ctx, `【OKOWA】${edLabel(ctx)}の王者は${win ? unitName(g) : rv.name}。恐い話のベルトの行方`);
    record(g, ctx, roundId, out);
    return out;
  });
}
registerContest('okowa', {
  name: 'OKOWAチャンピオンシップ', short: 'OKOWA', kind: 'talk', category: 'special',
  organizer: '有限会社ちゅるんカンパニー（Web番組「おちゅーんLive!」）', broadcaster: 'ニコニコ生放送・YouTube', venue: 'シアター朝日（大阪・新世界）', region: 'osaka',
  history: { founded: 2018, ended: null, note: '恐い話（怪談）No.1決定戦。2018年6月6日開幕戦（16人）→7月7日決勝。2019年決勝8月17日。2020年大会は2021年初頭に第1ステージ（15人）。', sources: OKOWA_SRC },
  schedule: { entry: { from: [4, 1], to: [5, 5] }, final: [7, 3] },
  eligibility: { pro: true, amateur: true, note: 'ジャンル不問。いちばん恐い話ができる人なら誰でも（怪談師・芸人・僧侶など）' },
  prizeText: 'チャンピオンベルト（賞金は詳細非公開）',
  perform: { kind: 'talk' },
  facts: { verified: ['恐い話（怪談）No.1決定戦', 'ちゅるんカンパニー／おちゅーんLive!', '2018年創設', '2018: 6/6開幕戦（新世界シアター朝日・16人）→7/7決勝', '2019決勝8/17（ニコ生）', '2020大会→2021年第1ステージ（15人）', 'トーナメント', 'チャンピオンベルト'], unverified: ['判定方式', '持ち時間', '2022年以降'] },
  rounds: [
    { id: 'r1', name: '開幕戦（1回戦・16人）', when: [6, 2], judge: 'audience', field: 16, pass: 8, venues: ['シアター朝日'], run: (g, ctx) => okowaBout(g, ctx, 'r1', '開幕戦（1回戦）', 48, false) },
    { id: 'r2', name: '2回戦', when: [6, 6], judge: 'audience', field: 8, pass: 4, run: (g, ctx) => okowaBout(g, ctx, 'r2', '2回戦', 56, false) },
    { id: 'semi', name: '準決勝', when: [6, 9], judge: 'audience', field: 4, pass: 2, run: (g, ctx) => okowaBout(g, ctx, 'semi', '準決勝', 62, false) },
    { id: 'final', name: '決勝', when: [7, 3], judge: 'audience', field: 2, final: true, tv: true, run: (g, ctx) => okowaBout(g, ctx, 'final', '決勝', 68, true) },
  ],
  news: [
    '恐い話のチャンピオンベルトを争う「OKOWAチャンピオンシップ」開幕。大阪・新世界で16人がトーナメント',
    'OKOWAチャンピオンシップ、ジャンル不問。怪談師も芸人も僧侶も「いちばん恐い話」で勝負',
    (g, ctx) => `OKOWA ${edLabel(ctx)}、決勝は${ctx.year >= 2018 ? '生配信' : 'ネット配信'}。夏の夜に恐い話の頂点`,
    '芸人の怪談、「笑い」の間が「恐さ」の間に化けると強い',
    (g, ctx) => (ctx.year >= 2020 ? 'OKOWAチャンピオンシップ、第1ステージの模様を配信' : 'OKOWA決勝、客席の悲鳴が新世界に響く'),
  ],
  catchcopy: () => '笑わせるより、背筋を凍らせろ',
});
