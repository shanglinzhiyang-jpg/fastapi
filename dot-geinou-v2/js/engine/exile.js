// 独裁崩壊後の亡命と裁判 (R25) — what happens to a fallen ruler the morning after. Until now the end of a dictatorship was one fixed scene; now, when the regime falls
// (蜂起・敗戦・降伏・軍のクーデター・党内の政変 — not a death in office), the player decides what to do before the day breaks: try to get out of the country (亡命), hand themselves over to the
// 暫定の当局 and stand trial (出頭), or stay to the end (the old ending). Every road shows its odds and its weight first.
//   亡命 — up to three friendly countries (the world model's relations) with their own odds; success: years abroad, then the host may protect, hand over, or an international warrant may follow;
//          failure: captured at the border, and the trial is heavier.
//   裁判 — a domestic court of the 暫定政権 (the transition government depends on the cause) or an international tribunal; the player's stance (反省 / 争う / 黙秘) is chosen; the verdict
//          comes from a 責任の重さ (0..100) built from the record of the regime (detained journalists, purges, fear, cult, wars and their casualties, sanctions, press freedom, years in power).
//          Verdicts: 無罪 / 有期の禁錮 / 長期の禁錮 / 終身刑 / 死刑 (domestic only; an international tribunal has none). Told in a word, nothing is drawn.
//   移行期 — who rules next (軍の暫定政権・暫定の文民政権・党の別の幹部・戦勝国との管理) and whether elections come back, in a line or two.
//
// Rules (the same as regime.js): nothing is refused for being bad; abstract and non-graphic (no body, no violence is drawn or described: a verdict is a word and a number); every
// person is fictional and anonymous, the host countries are the world model's (a hypothetical, from the relations), no real person is involved.
//
// API (on Game): g.exileCase() → { cause, score, label, lines: [{ label, pts }], hosts: [{ id, name, relation, odds }], transition: { text, years, returns } } for the ruler who is falling now
//   (or the last one); g.exileVerdict({ venue: 'domestic'|'international', stance: 'repent'|'defend'|'silent', fled?: bool }) → { kind, years, label, score }; g.exileStances().
//   The flow itself is RX.exile(g, rec) (regime.js calls it from the 'downfall' scene; true = it told the whole ending, false = the old ending). window.__exile (tests): setExileRng, caseOf, run, verdictOf.

import { Game } from './game.js';
import { clamp } from './util.js';
import { RX, END_CAUSES, KIKI, downfallText, regimeRecord, showRegimeScene } from './regime.js';

const YEAR = 120;
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
let rng = () => Math.random();
export const setExileRng = (f) => { rng = typeof f === 'function' ? f : () => Math.random(); };
const roll = (p) => rng() < p;
const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));

// ======================================================================== the weight of what was done (責任の重さ 0..100)
export function culpability(g, rec) {
  const u = (g && g.state && g.state.rule) || {};
  const lines = [];
  const add = (label, pts) => { const v = Math.round(clamp(pts, 0, 99) * 10) / 10; if (v > 0) lines.push({ label, pts: v }); };
  add('独裁体制をしいた', 8);
  add('拘束された記者', Math.min(12, Math.sqrt(num(rec.detained)) * 1.5));
  add('摘発・粛清', Math.min(10, (Array.isArray(u.purges) ? u.purges.length : 0) * 2));
  add('恐怖による支配', Math.min(8, num(u.fear) * 0.1));
  add('個人崇拝', Math.min(7, num(u.cult) * 1.5));
  add('戦争での自国民間人の被害', Math.min(14, Math.log10(1 + num(rec.civilians)) * 3));
  add('相手国側の死傷者', Math.min(12, Math.log10(1 + num(rec.enemy)) * 2.5));
  add('戦争の回数', Math.min(6, num(rec.wars) * 2));
  add('報道の自由の抑圧', Math.min(8, Math.max(0, 40 - num(rec.press, 50)) * 0.2));
  add('国際社会の制裁', Math.min(6, num(rec.sanctions) * 2));
  add('政権の長さ', Math.min(8, (num(rec.pmDays) / YEAR) * 0.8));
  const score = Math.round(clamp(lines.reduce((a, l) => a + l.pts, 0), 0, 100));
  return { score, lines, label: score >= 70 ? 'かなり重い' : score >= 50 ? '重い' : score >= 30 ? '中くらい' : '軽い' };
}

// ======================================================================== hosts, odds
const BASE = { uprising: 0.5, defeat: 0.45, surrender: 0.5, coup: 0.3, ousted: 0.7 };
export function hostsOf(g, rec) {
  let rows = [];
  try { rows = (g.world && g.world() ? g.world().countries : []) || []; } catch (e) { rows = []; }
  const u = (g.state && g.state.rule) || {};
  const p = u.pillars || {};
  const guard = (((num(p.army, 50) + num(p.police, 50)) / 2) - 50) / 250;
  const wealth = clamp(Math.log10(Math.max(1, num(g.state && g.state.money))) - 6, 0, 3) * 0.03;
  const out = rows.filter((c) => c && !c.hist && !c.war && !num(c.onJapan) && num(c.relation) > -20)
    .sort((a, b) => (num(b.relation) + (b.ally ? 15 : 0) + (b.ties ? 5 : 0)) - (num(a.relation) + (a.ally ? 15 : 0) + (a.ties ? 5 : 0)))
    .slice(0, 3)
    .map((c) => {
      const odds = clamp(num(BASE[rec.cause], 0.45) + (num(c.relation) / 100) * 0.25 + (c.ally ? 0.05 : 0) + (c.ties ? 0 : -0.05) + guard + wealth, 0.08, 0.92);
      return { id: c.id, name: c.name || c.short || c.id, short: c.short || c.name || c.id, relation: num(c.relation), relLabel: c.relLabel || '', odds: Math.round(odds * 100) };
    });
  return out;
}

// ======================================================================== the next government
export function transitionOf(rec) {
  const T = {
    coup: { text: '軍の暫定政権が発足し、非常事態を宣言した。「秩序が回復したら選挙を行う」と約束している。', yrs: [3, 8], ret: 0.5 },
    uprising: { text: '蜂起した人びとの代表と元の野党による暫定政権が発足した。新しい憲法と選挙の準備が始まった。', yrs: [1, 3], ret: 0.8 },
    ousted: { text: '党の別の幹部が政権を引き継ぎ、前の時代の「行きすぎ」を批判した。改革が始まったが、党の支配は続く。', yrs: [4, 10], ret: 0.4 },
    surrender: { text: '戦勝国との協議のもと、暫定の政府が発足した。賠償と制裁の交渉が始まった。', yrs: [2, 6], ret: 0.7 },
    defeat: { text: '戦勝国との協議のもと、暫定の政府が発足した。賠償と制裁の交渉が始まった。', yrs: [2, 6], ret: 0.7 },
  };
  const t = T[rec.cause] || T.defeat;
  return { text: t.text, years: rint(t.yrs[0], t.yrs[1]), returns: roll(t.ret) };
}
const aftermath = (t) => (t.returns
  ? `${t.years}年後、この国では選挙がふたたび行われ、政権は有権者の手で選ばれるようになった。`
  : `${t.years}年がたっても、約束された選挙は行われず、不安定な時代が続いた。`);
const transitionShort = (cause) => ({ coup: '軍の暫定政権', uprising: '暫定の文民政権', ousted: '党の別の幹部', surrender: '戦勝国と協議の暫定政府', defeat: '戦勝国と協議の暫定政府' })[cause] || '暫定政府';

// ======================================================================== the trial
export const STANCES = {
  repent: { name: '責任を認め、反省を述べる', pts: -8, lines: ['量刑が軽くなる（−8）', '支持者は、あなたから離れていく'] },
  defend: { name: '「国のためだった」と主張する', pts: 0, lines: ['量刑は変わらない', '支持者の一部は、最後まで味方でいる'] },
  silent: { name: '黙秘する', pts: 4, lines: ['量刑が少し重くなる（+4）', '裁判は短く終わる'] },
};
const VENUE = {
  domestic: { name: '国内の裁判（暫定政権の法廷）', pts: { uprising: 8, coup: 6, ousted: -10, surrender: 4, defeat: 4 } },
  international: { name: '国際法廷', pts: { all: -5 } },
};
export function verdictOf(g, rec, o = {}) {
  const venue = o.venue === 'international' ? 'international' : 'domestic';
  const C = culpability(g, rec);
  const mod = (venue === 'international' ? VENUE.international.pts.all : num(VENUE.domestic.pts[rec.cause], 4)) + num((STANCES[o.stance] || STANCES.defend).pts) + (o.fled ? 6 : 0);
  const v = C.score + mod + rint(-10, 10);
  let kind, years = 0, label;
  if (v < 18) { kind = 'acquit'; label = '無罪'; }
  else if (v < 42) { kind = 'prison'; years = Math.round(3 + (v - 18) * 0.5); label = `有期禁錮${years}年`; }
  else if (v < 66) { kind = 'prison'; years = Math.round(15 + (v - 42) * 0.6); label = `有期禁錮${years}年`; }
  else if (v < 84 || venue === 'international') { kind = 'life'; label = '終身刑'; }
  else { kind = 'death'; label = '死刑'; }
  return { kind, years, label, score: C.score, venue, v: Math.round(v) };
}
const verdictPages = (V, venue) => {
  const court = venue === 'international' ? '国際法廷' : '法廷';
  if (V.kind === 'acquit') return [`${court}は、「訴追するだけの証拠がそろわなかった」として、無罪を言い渡した。`, '法廷の外では、喜ぶ人と、怒る人とが、にらみ合っていた。'];
  if (V.kind === 'prison') return [`${court}は、禁錮${V.years}年の判決を言い渡した。`, V.years >= 15 ? '長い年月を、塀の中で過ごすことになる。' : '刑期を終えたあと、普通の暮らしに戻れるかは、わからない。'];
  if (V.kind === 'life') return [`${court}は、終身刑を言い渡した。`, 'もう二度と、外の世界には戻れない。'];
  return [`${court}は、死刑を言い渡した。`, '判決は、国じゅうに伝えられた。その後のことは、ここには記さない。'];
};

// ======================================================================== the scenes
const show = (g, spec) => showRegimeScene(g, spec);
const ART = { uprising: 'demo', defeat: 'front', surrender: 'kantei', coup: 'plot_dawn', ousted: 'kantei' };

async function trial(g, rec, venue, fled, C) {
  const stance = await show(g, {
    art: 'kantei', title: venue === 'international' ? '国際法廷' : '法廷', sub: '被告人',
    pages: [venue === 'international' ? '国際法廷の被告席に、あなたは座っていた。' : '暫定政権の法廷で、裁判が始まった。', `起訴の理由は、${C.lines.slice(1, 4).map((l) => l.label).join('・') || '体制の運営'}などの責任だった。\n（責任の重さの目安：${C.label}）`, '法廷での姿勢を、決めなければならない。'],
    options: [...Object.entries(STANCES).map(([id, s]) => ({ label: s.name, value: id })), { label: '（どれも選ばない＝争う）', value: 'defend' }],
    prompt: `どうする？\n${Object.values(STANCES).map((s) => `・${s.name}：${s.lines[0]}`).join('\n')}`,
  });
  const V = verdictOf(g, rec, { venue, stance: stance || 'defend', fled });
  await show(g, { art: 'newspaper', title: '判決', sub: venue === 'international' ? '国際法廷' : '暫定政権の法廷', headline: `前指導者に${V.label}`, pages: verdictPages(V, venue) });
  return V;
}
const afterOf = (route, host, years, V) => {
  const vt = V ? `${V.label}（${V.venue === 'international' ? '国際法廷' : '国内'}）` : '';
  if (route === 'exile') return `亡命（${host}・${years}年）`;
  if (route === 'exile_hand') return `亡命後に引き渡し・${vt}`;
  if (route === 'caught') return `脱出に失敗・${vt}`;
  if (route === 'surrender') return vt;
  return '体制とともに最期を迎えた';
};

export async function run(g, rec) {
  if (!g || !rec || rec.cause === 'death' || rec.cause === 'kia') return false;
  const C = culpability(g, rec);
  const hosts = hostsOf(g, rec);
  const lines = downfallText(g, rec);
  const art = (END_CAUSES[rec.cause] && END_CAUSES[rec.cause].art) || ART[rec.cause] || 'demo';
  const best = hosts.reduce((a, h) => Math.max(a, h.odds), 0);
  // the morning: three roads
  const road = await show(g, {
    art, title: '体制の崩壊', sub: '最後の決断',
    pages: [lines[0], '夜が明けるまでに、決めなければならない。',
      `【亡命】国外へ逃れる。${hosts.length ? `見込みは行き先しだい（いちばん高い国で${best}%）。` : 'いまは受け入れてくれる国が見当たらない。'}成功しても、のちに引き渡しや国際法廷の問題が起きることがある。失敗すれば身柄を拘束され、裁判は重くなる。`,
      `【出頭】暫定の当局に身柄を預け、裁判を受ける。責任の重さの目安：${C.label}（${C.score}／100）。`,
      '【留まる】体制とともに、その場で最期を迎える。'],
    options: [...(hosts.length ? [{ label: '亡命を試みる', value: 'exile' }] : []), { label: '最後まで、国に留まる', value: 'stay' }, { label: '出頭して、裁きを受ける', value: 'surrender' }], // the last one is what B (cancel) picks: the middle road
    prompt: 'どうする？',
  });
  const T = transitionOf(rec);
  rec.transition = transitionShort(rec.cause);
  let route = road === 'exile' && hosts.length ? 'exile' : road === 'surrender' ? 'surrender' : 'stay';
  if (route === 'stay') {
    // the old ending, told in full
    rec.after = afterOf('stay');
    if (typeof KIKI.downfall === 'function') await KIKI.downfall(g, rec); else await RX.say(g, downfallText(g, rec));
    return true;
  }
  let V = null, host = null, years = 0;
  if (route === 'exile') {
    // which country
    for (let guard = 0; guard < 6 && !host; guard++) {
      const i = await showRegimeScene(g, {
        art: 'summit', title: '亡命', sub: '行き先', pages: ['受け入れてくれそうな国を、側近がいくつか挙げた。'],
        options: [...hosts.map((h, k) => ({ label: `${h.short}（関係${h.relLabel || h.relation}・見込み${h.odds}%）`, value: k })), { label: 'やめる', value: -1 }],
        prompt: 'どの国へ？\n（見込みは、その国との関係・護衛の忠誠・資産で決まる）',
      });
      if (i == null || i < 0) { route = 'surrender'; break; }
      host = hosts[i];
    }
    if (host) {
      if (roll(host.odds / 100)) {
        years = rint(4, 16);
        await show(g, { art: 'sea', title: '亡命', sub: host.short, pages: ['夜のうちに、少数の側近とともに首都を離れた。', `国境を越え、${host.name}の保護を受けた。\n${host.short}の政府は、受け入れを認めた。`, T.text] });
        // the years abroad
        const handed = roll(clamp(0.2 + (host.relation < 20 ? 0.15 : 0), 0, 0.5));
        const warrant = !handed && C.score >= 55 && roll(0.2);
        if (!handed && !warrant) {
          await show(g, { art: 'sea', title: '亡命の日々', sub: `${years}年`, pages: [`${years}年が過ぎた。亡命先の郊外の小さな家で、あなたは回顧録を書いた。`, '訪ねてくる人は、年ごとに減っていった。', aftermath(T)] });
          rec.after = afterOf('exile', host.short, years);
        } else {
          await show(g, {
            art: 'summit', title: handed ? '引き渡し' : '逮捕状', sub: `${years}年後`,
            pages: [handed
              ? `${years}年が過ぎたころ、新しい政府が身柄の引き渡しを求めてきた。\n${host.short}の政府は、その求めに応じることを決めた。`
              : `${years}年が過ぎたころ、国際法廷が逮捕状を出した。\n${host.short}の政府は、身柄を引き渡すことを決めた。`,
              `${handed ? '国内の裁判' : '国際法廷'}のため、あなたは移送された。`],
          });
          V = await trial(g, rec, handed ? 'domestic' : 'international', false, C);
          rec.after = afterOf('exile_hand', host.short, years, V);
          await show(g, { art: 'newspaper', title: 'その後の国', sub: rec.transition, pages: [aftermath(T)] });
        }
        rec.exile = { host: host.name, years, handed: !!(handed || warrant) };
        await show(g, { art: 'newspaper', title: 'おわり', sub: '', pages: ['こうして、この人生の物語は終わった。'] });
        rec.verdict = V ? V.label : null;
        return true;
      }
      // caught at the border
      await show(g, { art: 'plot_dawn', title: '国境', sub: '夜明け前', pages: ['国境の手前の検問で、あなたの一行は止められた。', '暫定の当局が、あなたの身柄を拘束した。'] });
      route = 'caught';
    }
  }
  if (route === 'surrender' || route === 'caught') {
    if (route === 'surrender') {
      await show(g, { art: ART[rec.cause] || 'kantei', title: '出頭', sub: '夜明け', pages: [rec.cause === 'coup' || rec.cause === 'ousted' ? lines[1] : '混乱が広がる前に、あなたは暫定の当局に身柄を預けた。', T.text] });
    }
    V = await trial(g, rec, 'domestic', route === 'caught', C);
    rec.after = afterOf(route, '', 0, V);
    rec.verdict = V.label;
    await show(g, { art: 'newspaper', title: 'その後の国', sub: rec.transition, pages: [aftermath(T), 'こうして、この人生の物語は終わった。'] });
    return true;
  }
  return false;
}
RX.exile = run;

// ======================================================================== API
const METHODS = {
  exileCase() { const rec = regimeRecord(this); const C = culpability(this, rec); return { cause: rec.cause, score: C.score, label: C.label, lines: C.lines, hosts: hostsOf(this, rec), transition: { ...transitionOf(rec) } }; },
  exileVerdict(o) { return verdictOf(this, regimeRecord(this), o || {}); },
  exileStances() { return Object.entries(STANCES).map(([id, s]) => ({ id, name: s.name, lines: s.lines.slice(), pts: s.pts })); },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });
if (typeof window !== 'undefined') window.__exile = { setExileRng, culpability, hostsOf, transitionOf, verdictOf, run, STANCES };
