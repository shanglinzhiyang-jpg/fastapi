// 賞レースのデータ その2 (owner: D2b) — the shared round flow used by most of the 19 contests' rounds.
// stageRound(g, ctx, cfg) plays one round on a drawn stage: intro (in full the first time, おまかせ later),
// the performance (C's g.perform, or a talk / quiz / rhythm stand-in), judging against a simulated field
// (rivals from D1's g.contestRivals or fictional fallbacks), 実力不足 reasons on a loss, a results board,
// awards / prize money for the final, news (g.contestNews) and this module's record. Returns the round result.
//
// cfg: { round (id), name, scene (Backdrop kind), sign, intro: [str] | (g, ctx) => [str], host (fictional 進行役),
//   kind, length (sec), venue: { name, size, crowd, pressure }, custom / useC / style / theme (see kit.stagePerform),
//   field, pass, sample, level, spread, pinOnly (judgeField), scoreLabel (e.g. '点'), scale (display max, default 100),
//   final: bool, board: bool, boardTitle, boardNote, genreTags (show each act's genre), judgesN, judgeTitles, judgeText,
//   awards: [{ place, name, prize (real yen, paid here only below 1st: 1st is def.prize, paid by D1) }], after: async (g, ctx, out, j) }
import { withBackdrop, showBoard } from './contests_data2_scenes.js';
import {
  askSkip, stagePerform, judgeField, roundResult, failReasons, record, news, grant, edLabel, unitName, unitOf,
  judgesFor, toScale, yen, KIND_LABEL,
} from './contests_data2_kit.js';
import { LOOKS } from './sprites.js';

export function castOf(g) {
  const u = unitOf(g);
  const looks = (u.members || []).map((m) => (m.id === 'player' ? g.state && g.state.look : m.look)).filter(Boolean);
  return looks.length ? looks.slice(0, 3) : [(g.state && g.state.look) || LOOKS.player];
}
const lines = (x, g, ctx) => (typeof x === 'function' ? x(g, ctx) : x) || [];

export async function stageRound(g, ctx, cfg) {
  const def = ctx.def || {};
  const skip = await askSkip(g, ctx, cfg.round);
  const sub = `${edLabel(ctx)} ${cfg.name || ''}`.trim();
  return withBackdrop(g, cfg.scene || 'theater', { title: def.name, sub, sign: cfg.sign, cast: castOf(g) }, async () => {
    const host = cfg.host ? { name: cfg.host } : {};
    if (!skip) {
      const intro = lines(cfg.intro, g, ctx);
      if (intro.length) await g.say(intro, host);
      if (cfg.judgeText) await g.say(cfg.judgeText);
    } else await g.say(`${cfg.name}。今回はおまかせで進める。`);
    const res = await stagePerform(g, ctx, {
      kind: cfg.kind || def.kind, round: cfg.round, length: cfg.length, venue: cfg.venue, title: `${def.short || def.name} ${cfg.name || ''}`.trim(),
      custom: cfg.custom, useC: cfg.useC, style: cfg.style, theme: cfg.theme, skip,
    });
    const j = judgeField(g, ctx, cfg.round, res.score, { field: cfg.field, pass: cfg.pass, sample: cfg.sample, level: cfg.level, spread: cfg.spread, pinOnly: cfg.pinOnly, kind: cfg.kind || def.kind });
    const out = roundResult(res, { passed: j.passed, place: j.place, field: j.field, passCount: j.passCount });
    const scale = cfg.scale || 100;
    const unit = cfg.scoreLabel || '点';
    const me = unitName(g);
    out.display = `${toScale(res.score, scale)}${unit}`;
    if (cfg.final) {
      out.champion = j.place === 1;
      const aw = (cfg.awards || []).find((a) => a.place === j.place);
      if (aw) out.award = aw.name;
      await g.say(out.champion ? [`結果発表――${def.name}、${edLabel(ctx)}の${(cfg.awards && cfg.awards[0] && cfg.awards[0].name) || '優勝'}は……`, `${me}！！`] : [`結果発表。${me}は ${j.place}位（${j.field}組中）。`, `優勝は「${j.top.name}」。`]);
      // fame / fans / def.prize for the place are paid by D1's runner when it records this result;
      // an award below 1st with its own money (aw.prize) is paid here
      if (aw && aw.prize) {
        if (!out.champion) grant(g, ctx, `award${j.place}`, { money: aw.prize });
        await g.say(`${aw.name}――賞金${yen(aw.prize)}。`);
      } else if (aw && !out.champion) await g.say(`${aw.name}を受賞！`);
      if (!out.champion) out.reasons = failReasons(g, cfg.kind || def.kind, res);
    } else if (j.passed) {
      await g.say(cfg.passLine || `${cfg.name}――通過！（推定${j.place}位／${j.field}組・通過${j.passCount}組）`);
    } else {
      out.reasons = failReasons(g, cfg.kind || def.kind, res);
      await g.say([cfg.failLine || `${cfg.name}で敗退……（推定${j.place}位／${j.field}組・通過${j.passCount}組）`, `足りなかったもの：${out.reasons.join('、')}`]);
    }
    if (cfg.board || cfg.final) {
      const genre = (x) => (x.me ? KIND_LABEL[res.kindPlayed] || '' : x.unit === 'pin' ? 'ピン' : (x.name.length % 2 ? '漫才' : 'コント'));
      const rows = j.rows.slice(0, 12).map((x, i) => ({ place: `${i + 1}`, name: x.name, score: `${toScale(x.score, scale)}${unit}`, me: !!x.me, note: cfg.genreTags ? genre(x) : (x.tags || []).slice(0, 1).join('') }));
      if (cfg.judgesN) {
        const js = judgesFor(g, ctx, cfg.judgesN, cfg.judgeTitles || []);
        out.judges = js;
      }
      await showBoard(g, {
        title: cfg.boardTitle || `${def.name} ${cfg.name || ''}`, sub: `${edLabel(ctx)}　${KIND_LABEL[res.kindPlayed] || ''}　（上位のみ表示）`,
        cols: [{ key: 'place', label: '順', w: 50 }, { key: 'name', label: '名前', w: 300 }, { key: 'note', label: '', w: 120 }, { key: 'score', label: unit === '点' ? '得点' : unit, w: 120, align: 'right' }],
        rows, note: out.reasons && out.reasons.length ? `足りなかったもの：${out.reasons.join('、')}` : cfg.boardNote || '',
      });
    }
    // news (D1 rate-limits)
    if (cfg.final) news(g, ctx, out.champion ? `【${def.short || def.name}】${edLabel(ctx)}は${me}が制す！` : `【${def.short || def.name}】${edLabel(ctx)}は${j.top.name}が優勝。${me}は${j.place}位`);
    if (cfg.after) await cfg.after(g, ctx, out, j);
    record(g, ctx, cfg.round, out);
    return out;
  });
}
