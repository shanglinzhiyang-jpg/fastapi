// 各界 (groups_ui): the screens of the stakeholder-groups system (groups.js): the tab 「各界」 of the 政府中枢 console
// (HD 640x360, built with the console's own drawing kit — govt_ui.js passes it in) and the phone app 「各界」.
// Agent R5-B. API doc: test-output/api_groups.txt.
//
// The tab has six views: 一覧 (the matrix: domain × support / influence / anger / demands), 団体 (a domain's groups with
// their leaders, grievances and the actions — every action shows its cost, its odds and the pro / con voices before it
// runs), 要望・案件 (demands with deadlines, offers, strikes, scandals: answer them), 観光地 (a map and list of tourist
// sites: designate, develop, promote, relax rules, crowd control, 世界遺産), 有識者会議 (panels: convene, read the
// report, adopt or shelve), 年表 (the groups' news, the support history of each domain, the institutions by date).
// Role-aware: the PM controls most; a minister controls their own domains; a governor / mayor, a member and a citizen
// (the entertainer) see everything but act within what their role allows — a locked control always says why.
//
// Entry points: g.groupsScreen(sub?, opts?) opens the console on the tab; openGroups(g, opts) is the same.
// The phone app 'groups' (name 各界, order 66). Tips: g.assistTip('groups_open', { text }) (the texts are here).

import { Game } from './game.js';
import { registerPhoneApp } from './life.js';
import { appTile, phoneList, phoneInfo, phoneConfirm, PC } from './phone.js';
import { clamp, fmtMoney } from './util.js';
import * as POL from './politics.js';
import * as GR from './groups.js';

const { DOMAIN_ORDER, DOMAINS, SITE_KINDS, THEMES, BID_TYPES } = GR;
const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const has = (g, k) => !!g && typeof g[k] === 'function';
const r0 = (v) => Math.round(num(v));
const safe = (fn, d = null) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { console.error(e); return d; } };
const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±');
const dayLabel = (g, day) => safe(() => POL.dateLabel(g, day), '');
const SUBS = [{ id: 'overview', label: '一覧', tip: '分野ごとの関係の一覧（支持・影響力・不満・要望）' }, { id: 'groups', label: '団体', tip: '分野の団体と、できること（費用・見込み・賛否の声つき）' }, { id: 'cases', label: '要望・案件', tip: '期限のある要望・申し出・ストライキ・不祥事への対応' }, { id: 'tourism', label: '観光地', tip: '観光地の地図と一覧。指定・整備・宣伝・規制緩和・混雑対策・世界遺産' }, { id: 'panels', label: '有識者会議', tip: '有識者会議を開き、報告書の採否を決める' }, { id: 'timeline', label: '年表', tip: '各界のニュース・分野ごとの支持の推移・制度の年表' }];
export const SUB_IDS = SUBS.map((s) => s.id);
const DOM_ABBR = { tourism: '観光地', kyokai: '協会', rengo: '連合', sports: 'スポーツ', business: 'ビジネス', sect: 'セクト', yushikisha: '有識者', artist: 'アーティスト', bunka: '文化', kenkyu: '研究', seifu: '政府' };
const KIND_COLOR = { soft: '#4fd2e8', gov: '#ffb547', dark: '#ff6470', pol: '#a78bfa', self: '#57d98a' };
const FIT = () => (typeof window !== 'undefined' && window.__govtui ? window.__govtui.FITLOG : null);

// ================================================================ tips (g.assistTip with our own texts) and glossary entries
const TIPS = {
  groups_open: { level: 2, text: '各界は、団体との関係を見る画面だよ。支持・影響力・不満が分野ごとに並ぶ。要望には期限があるから、「要望・案件」を見てね。' },
  groups_actions: { level: 2, text: '団体への働きかけは、費用と成功の見込み、賛成・反対の声を見てから決められる。うまくいかないこともあるよ。' },
  groups_tourism: { level: 3, text: '観光地は、指定して整備と宣伝をすると人が来る。来すぎると混雑して、住民の暮らしが苦しくなる（オーバーツーリズム）。' },
  groups_panels: { level: 3, text: '有識者会議は、法律に基づく審議会とちがって、総理や大臣が開く私的な諮問機関。人選を偏らせると、「結論ありき」と批判されるよ。' },
};
function tip(g, key, scope) { const T = TIPS[key]; if (!T || !has(g, 'assistTip')) return; safe(() => g.assistTip(key, { text: T.text, level: T.level, scope: scope === undefined ? 'govt:groups' : scope })); }
// terms for the glossary (政治ナビ): added once, with the date they started
async function addGlossary() {
  try {
    const gl = await import('./glossary.js');
    const G = gl.GLOSSARY;
    if (!G) return;
    const T = (term, kana, cat, short, long, o = {}) => { if (!G[term]) G[term] = { kana, cat, short, long, related: [], ...o }; };
    T('春闘', 'しゅんとう', 'kurashi', '毎年春に、労働組合が賃上げなどを経営側に求める交渉。', '労働組合が毎年春にいっせいに、賃上げなどを経営側に求めて交渉すること（春季生活闘争）。1955年に始まった。大手企業の回答が出る3月中旬の「集中回答日」が山場で、その結果が中小企業や最低賃金にも波及する。', { related: ['最低賃金', '連合'] });
    T('連合', 'れんごう', 'kurashi', '日本最大の労働組合のナショナルセンター（1989年結成）。', '労働組合の全国組織（日本労働組合総連合会）。1989年11月に、総評・同盟などの流れが一つになって結成された。春闘での賃上げ要求や、最低賃金、働き方の制度について政府や経営側と話し合う。', { since: 1989, sinceText: '1989年11月', related: ['春闘', '最低賃金'] });
    T('有識者会議', 'ゆうしきしゃかいぎ', 'naikaku', '総理や大臣が専門家に意見を聞くために開く会議。', '内閣総理大臣や大臣が、専門家の意見を聞くために開く私的な会議（懇談会など）。法律や政令にもとづく「審議会」とはちがい、設置も人選も、開く側の判断が大きい。報告書は政策の後ろ盾になるが、人選の偏りは「結論ありき」「御用学者」と批判される。', { related: ['審議会'] });
    T('観光立国推進基本法', 'かんこうりっこくすいしんきほんほう', 'chiho', '観光で国を成り立たせる方針を定めた法律（2007年施行）。', '観光を国の重要な政策とする基本法。2006年12月に成立し、2007年1月に施行された。2008年10月には、国土交通省の外局として観光庁が発足した。', { since: 2007, sinceText: '2007年1月', related: ['地方自治'] });
    T('オーバーツーリズム', 'おーばーつーりずむ', 'kurashi', '観光客が集中しすぎて、住民の暮らしや環境が損なわれること。', '観光客が特定の場所に集中し、混雑・ごみ・騒音・交通の混乱などで、住民の暮らしや自然環境、観光客の満足が損なわれること。予約制・入場制限・宿泊税や入域料などの対策がある。', { since: 2015, sinceText: '2010年代後半から問題に', related: ['観光立国推進基本法'] });
    T('団体規制法', 'だんたいきせいほう', 'kenpo', '無差別大量殺人行為を行った団体を規制する法律（1999年）。', '過去に無差別大量殺人行為を行った団体について、公安調査庁が観察処分を請求し、公安審査委員会が決める仕組み。団体の施設への立入検査や、活動状況の報告が義務づけられる。破壊活動防止法（1952年）とは別の法律。', { since: 1999, sinceText: '1999年12月', related: ['信教の自由', '政教分離'] });
    T('文化庁', 'ぶんかちょう', 'naikaku', '文化の振興と文化財の保護を担う国の機関（1968年発足）。', '芸術の振興、文化財の保護、国語や著作権の仕事などを担う、文部科学省の外局。1968年に発足した。2023年には一部の業務が京都で始まった。', { since: 1968, sinceText: '1968年', related: ['表現の自由'] });
    T('スポーツ庁', 'すぽーつちょう', 'naikaku', 'スポーツの振興を担う国の機関（2015年発足）。', '文部科学省の外局として、2015年10月に発足した。スポーツ基本法（2011年）のもと、競技力の向上、スポーツを通じた健康づくり、大会の招致などを進める。', { since: 2015, sinceText: '2015年10月', related: [] });
    T('科学技術基本法', 'かがくぎじゅつきほんほう', 'naikaku', '科学技術の振興を定めた法律（1995年）。', '1995年に議員立法で全会一致で成立。政府は科学技術基本計画をつくり、研究費を確保する。2021年からは「科学技術・イノベーション基本法」になった。研究への投資は、すぐには成果が見えにくいが、長い目で成長に効く。', { since: 1995, sinceText: '1995年', related: ['研究開発'] });
    T('内閣人事局', 'ないかくじんじきょく', 'naikaku', '官僚の幹部人事を官邸が一元管理する組織（2014年）。', '各府省の幹部職員の人事を、内閣が一元的に管理するための組織で、2014年5月に発足した。政治主導を強める一方、官僚が「忖度」しやすくなるという懸念もある。', { since: 2014, sinceText: '2014年5月', related: ['官僚', '天下り'] });
  } catch (e) { /* the glossary is optional */ }
}
addGlossary();

// ================================================================ the flows (modals of the console scene)
const lock = (why) => `🔒 ${why}`;
function confirmLines(pv, extra = []) {
  const L = [];
  if (pv.desc) L.push(pv.desc);
  L.push(`費用：${pv.costText}`);
  if (pv.odds != null) L.push(`【成功の見込み】${Math.round(pv.odds * 100)}%`);
  if (pv.win && pv.win.length) L.push(`成功すると：${pv.win.slice(0, 4).join('・')}`);
  if (pv.lose && pv.lose.length) L.push(`失敗すると：${pv.lose.slice(0, 4).join('・')}`);
  for (const l of (pv.lines || []).slice(0, 3)) L.push(`※${l}`);
  if (pv.pro && pv.pro[0]) L.push(`賛成の声：${pv.pro[0]}`);
  if (pv.con && pv.con[0]) L.push(`反対の声：${pv.con[0]}`);
  return [...L, ...extra];
}
async function pickOption(ui, g, id, kind, pv0) {
  const items = pv0.options.map((o) => { const p = g.groupActionPreview(id, kind, o.key); return { label: o.label, sub: `${p.costText}${p.odds != null ? `・成功の見込み${Math.round(p.odds * 100)}%` : ''}`, why: p.why, right: p.odds != null ? `${Math.round(p.odds * 100)}%` : '' }; });
  const i = await ui.pick({ title: pv0.name, lines: ['どのやり方にする？'], items, index: 0, w: 480, color: KIND_COLOR[pv0.kind] || '#ffb547' });
  return i < 0 ? null : pv0.options[i].key;
}
export async function actionFlow(ui, id, kind) {
  const g = ui.g;
  let pv = g.groupActionPreview(id, kind);
  if (!pv.ok) return;
  let opt = null;
  if (pv.options && pv.options.length) {
    opt = await pickOption(ui, g, id, kind, pv);
    if (!opt) return;
    pv = g.groupActionPreview(id, kind, opt);
  }
  if (pv.why) { await ui.info(pv.name, [`いまはできない：${pv.why}`], { color: '#c9a76a' }); return; }
  tip(g, 'groups_actions');
  const name = (g.group(id) || {}).name || '';
  const danger = pv.kind === 'dark';
  const k = await ui.confirm({ title: `${name}：${pv.name}${pv.opt ? `（${pv.opt.label.replace(/（.*$/, '')}）` : ''}`, lines: confirmLines(pv, danger ? ['⚠ 失敗や露見のしっぺ返しは大きい。選ぶ前に費用と見込みを確かめて。'] : []), choices: ['実行する', 'やめる'], cancel: 1, w: 520, danger });
  if (k !== 0) return;
  const r = await g.groupAct(id, kind, { option: opt });
  if (r && r.ok && r.caught) { await ui.info(pv.name, String(r.text).split('\n')); await ui.flush(); return; }
  await ui.result(pv.name, r && r.ok ? { ok: true, text: r.text } : r || { ok: false, why: '失敗' });
}
async function caseFlow(ui, c, optKey) {
  const g = ui.g;
  const o = c.options.find((x) => x.key === optKey);
  if (!o) return;
  if (o.why) { await ui.info(o.label, [`いまはできない：${o.why}`], { color: '#c9a76a' }); return; }
  const lines = [c.text, '', `${o.label}`, o.desc || '', `費用：${o.costText}`];
  if (o.odds != null) lines.push(`【成功の見込み】${Math.round(o.odds * 100)}%`);
  if (o.lines && o.lines.length) lines.push(`変化の見込み：${o.lines.slice(0, 4).join('・')}`);
  const dark = ['emergency', 'hard', 'refuse'].includes(o.key);
  const k = await ui.confirm({ title: c.title, lines: lines.filter((x) => x !== undefined), choices: ['この答えにする', 'やめる'], cancel: 1, w: 520, danger: dark && c.kind !== 'demand' });
  if (k !== 0) return;
  const r = await g.groupCaseAnswer(c.id, o.key);
  await ui.result(c.title, r && r.ok ? { ok: true, text: [r.text, ...(r.lines || [])].join('\n') } : r || { ok: false, why: '失敗' });
}
async function siteFlow(ui, site) {
  const g = ui.g;
  const acts = g.siteActions(site.id);
  const items = acts.map((p) => ({ label: p.name, sub: p.why ? '' : `${p.costText}${p.odds != null ? `・見込み${Math.round(p.odds * 100)}%` : ''}`, why: p.why, right: p.odds != null && !p.why ? `${Math.round(p.odds * 100)}%` : '', detail: p.desc, id: p.id }));
  if (!items.length) { await ui.info(site.name, ['この観光地でできることはない。']); return; }
  const i = await ui.pick({ title: `${site.name}でできること`, lines: [`${site.kindName}・魅力${'★'.repeat(site.stars)}`], items, index: 0, w: 500, color: '#4fd2e8' });
  if (i < 0) return;
  let pv = acts[i];
  let opt = null;
  if (pv.options && pv.options.length) {
    const its = pv.options.map((o) => { const p = g.siteActionPreview(site.id, pv.id, o.key); return { label: o.label, sub: `${p.costText}`, why: p.why }; });
    const j = await ui.pick({ title: pv.name, lines: ['どのくらいの規模にする？'], items: its, index: 0, w: 480, color: '#4fd2e8' });
    if (j < 0) return;
    opt = pv.options[j].key;
    pv = g.siteActionPreview(site.id, pv.id, opt);
  }
  if (pv.why) { await ui.info(pv.name, [`いまはできない：${pv.why}`], { color: '#c9a76a' }); return; }
  const lines = [pv.desc, `費用：${pv.costText}`, pv.odds != null ? `【成功の見込み】${Math.round(pv.odds * 100)}%` : '', ...pv.lines.slice(0, 3).map((x) => `※${x}`), pv.pro[0] ? `賛成の声：${pv.pro[0]}` : '', pv.con[0] ? `反対の声：${pv.con[0]}` : ''].filter(Boolean);
  const k = await ui.confirm({ title: `${site.name}：${pv.name}`, lines, choices: ['実行する', 'やめる'], cancel: 1, w: 520 });
  if (k !== 0) return;
  const r = g.siteAct(site.id, pv.id, { option: opt });
  await ui.result(pv.name, r && r.ok ? { ok: true, text: r.text } : r);
}
async function panelConveneFlow(ui) {
  const g = ui.g;
  const themes = g.panelThemes();
  const items = themes.map((t) => ({ label: t.name, sub: t.why ? '' : `「${t.axis[0]}」⇔「${t.axis[1]}」`, why: t.why, id: t.id, detail: `論点：${t.axis[0]} ⇔ ${t.axis[1]}` }));
  const i = await ui.pick({ title: '有識者会議のテーマ', lines: ['総理や大臣が専門家に意見を聞く私的な会議（審議会とはちがう）。'], items, index: 0, w: 520, color: '#7aa8ff' });
  if (i < 0) return;
  const T = themes[i];
  const chairs = [{ side: -1, label: '分配・保護を重視する座長' }, { side: 0, label: '中立的な座長' }, { side: 1, label: '市場・成長を重視する座長' }];
  const ci = await ui.pick({ title: '座長を選ぶ', lines: [`${T.name}：座長の考え方が報告書の向きに影響する。`], items: chairs.map((c) => ({ label: c.label })), index: 1, w: 460, color: '#7aa8ff' });
  if (ci < 0) return;
  const tilts = [{ tilt: 0, label: '人選は中立にする（専門と立場のバランス）' }, { tilt: 1, label: '人選を少し寄せる（結論に近い人を多めに）' }, { tilt: 2, label: '人選をかなり寄せる（結論ありき）' }];
  const ti = await ui.pick({ title: '人選', lines: ['寄せるほど報告書は思いどおりになるが、露見すると「御用学者」と批判される。'], items: tilts.map((t) => { const p = g.panelPreview(T.id, { chair: chairs[ci].side, tilt: t.tilt, want: 1 }); return { label: t.label, sub: t.tilt ? `信頼性${p.cred}・露見の恐れ ${Math.round(p.expose * 100)}%／月` : `信頼性${p.cred}`, right: t.tilt ? `${Math.round(p.expose * 100)}%` : '' }; }), index: 0, w: 520, color: '#7aa8ff' });
  if (ti < 0) return;
  let want = 0;
  if (tilts[ti].tilt > 0) {
    const w = await ui.pick({ title: 'どちらに寄せる？', items: [{ label: `「${T.axis[0]}」の方向` }, { label: `「${T.axis[1]}」の方向` }], index: 1, w: 480, color: '#7aa8ff' });
    if (w < 0) return;
    want = w === 0 ? -1 : 1;
  }
  const o = { chair: chairs[ci].side, tilt: tilts[ti].tilt, want };
  const pv = g.panelPreview(T.id, o);
  if (pv.why) { await ui.info('有識者会議', [`いまはできない：${pv.why}`], { color: '#c9a76a' }); return; }
  const k = await ui.confirm({ title: `${T.name}の有識者会議`, lines: [...pv.lines, `費用：${pv.costText}`, `賛成の声：${pv.pro[0]}`, `反対の声：${pv.con[0]}`], choices: ['会議を開く', 'やめる'], cancel: 1, w: 540 });
  if (k !== 0) return;
  const r = g.panelConvene(T.id, o);
  await ui.result('有識者会議', r);
}
async function panelAnswerFlow(ui, p) {
  const g = ui.g;
  const pv = g.panelAnswerPreview(p.id);
  if (!pv.ok) { await ui.info('報告書', [pv.why || 'いまは決められない']); return; }
  const i = await ui.pick({ title: `${p.title}：報告書の採否`, lines: [p.report.headline, ...p.report.bullets.slice(0, 2).map((b) => `・${b}`), `信頼性 ${p.cred}${p.exposed ? '（人選が批判された）' : ''}`], items: pv.options.map((o) => ({ label: o.label, sub: o.desc, detail: `${o.desc}\n${(o.lines || []).join(' ')}` })), index: 0, w: 540, color: '#7aa8ff' });
  if (i < 0) return;
  const r = g.panelAnswer(p.id, pv.options[i].key);
  await ui.result('報告書の採否', r && r.ok ? { ok: true, text: [r.text, ...(r.lines || [])].join('\n') } : r);
}
async function bidFlow(ui) {
  const g = ui.g;
  const sm = g.bids();
  const items = [];
  for (const b of sm.active) {
    items.push({ label: `${b.name}（${b.statusLabel}）`, sub: b.status === 'declared' ? `決定まで${b.leftDecide}日・見込み${Math.round(b.odds * 100)}%` : `開幕まで${b.leftEvent}日・費用${b.totalText}`, kind: 'bid', bid: b });
  }
  for (const t of sm.types) { const p = g.bidPreview(t.type); items.push({ label: `誘致する：${t.name}`, sub: p.why ? '' : `${p.totalText}規模・見込み${Math.round(p.odds * 100)}%`, why: p.why, right: p.why ? '' : `${Math.round(p.odds * 100)}%`, kind: 'declare', type: t.type, detail: p.why ? '' : (p.lines || []).join(' ') }); }
  const i = await ui.pick({ title: '大会の誘致・準備', lines: [`${sm.agency}。過去：${sm.past.join('／') || '—'}`], items, index: 0, w: 540, color: '#57d98a' });
  if (i < 0) return;
  const it = items[i];
  if (it.kind === 'declare') {
    const pv = g.bidPreview(it.type);
    const k = await ui.confirm({ title: `${pv.name}の誘致`, lines: [...pv.lines, `表明の費用：${pv.costText}`, `【誘致の見込み】${Math.round(pv.odds * 100)}%（招致活動で上げられる）`, `賛成の声：${pv.pro[0]}`, `反対の声：${pv.con[0]}`], choices: ['誘致を表明する', 'やめる'], cancel: 1, w: 540 });
    if (k !== 0) return;
    const r = g.bidDeclare(it.type);
    await ui.result('大会の誘致', r && r.ok ? { ok: true, text: [r.text, ...(r.lines || [])].join('\n') } : r);
  } else {
    const b = it.bid;
    const opts = [];
    if (b.status === 'declared') { const cp = g.bidCampaignPreview(b.id); opts.push({ label: '招致活動を進める', sub: cp.why ? '' : cp.costText, why: cp.why, k: 'camp' }); }
    opts.push({ label: '取り下げる', sub: '地元と競技団体の反発を招く', k: 'withdraw' });
    const j = await ui.pick({ title: b.name, lines: [`${b.host}・${b.statusLabel}・費用の目安${b.totalText}・支持${b.support}%`], items: opts, index: 0, w: 480, color: '#57d98a' });
    if (j < 0) return;
    if (opts[j].k === 'camp') { const r = g.bidCampaign(b.id); await ui.result('招致活動', r); } else {
      const k = await ui.confirm({ title: `${b.name}を取り下げる`, lines: ['取り下げると、競技団体の支持が下がり、不満が高まる。', b.status === 'prep' ? '準備が進んでいる大会の取り下げは、特に批判が強い。' : ''].filter(Boolean), choices: ['取り下げる', 'やめる'], cancel: 1, danger: true });
      if (k === 0) { const r = g.bidWithdraw(b.id); await ui.result('取り下げ', r); }
    }
  }
}
async function minWageFlow(ui) {
  const g = ui.g;
  const mw = g.minWageActions();
  const items = mw.options.map((o) => ({ label: o.label, sub: o.why ? '' : '審議会の答申を受けて、政令で決める', why: o.why && /先に/.test(o.why) ? null : o.why, detail: o.why || '' }));
  const note = mw.council ? `中央最低賃金審議会：${{ idle: '待機', pending: '審議中', reported: '答申あり' }[mw.council.status] || mw.council.status}` : '審議会の状態は不明';
  const i = await ui.pick({ title: '最低賃金の引き上げ', lines: [note, '答申がなければ、先に審議会に諮問する（答申は5〜12日後）。'], items, index: 0, w: 520, color: '#ff7a7a' });
  if (i < 0) return;
  const k = await ui.confirm({ title: '最低賃金', lines: [mw.options[i].label, '賛成の声：「働く人の暮らしを底上げし、消費を増やす」（労働組合）', '反対の声：「中小企業や商店の経営を圧迫し、雇用が減るおそれ」（中小企業団体）', note], choices: ['進める', 'やめる'], cancel: 1, w: 520 });
  if (k !== 0) return;
  const r = await g.minWageAct(mw.options[i].key);
  await ui.result('最低賃金', r && r.ok ? { ok: true, text: [r.text, ...(r.lines || [])].join('\n') } : r);
}
async function termsFlow(ui) {
  const L = [
    '春闘：毎年春に労働組合が賃上げを求める交渉。3月中旬の集中回答日が山場。',
    '有識者会議：総理や大臣が開く私的な諮問機関。法律にもとづく審議会とはちがう。',
    'オーバーツーリズム：観光客の集中で、住民の暮らしや環境が損なわれること。',
    '組織票：団体が支持する候補にまとめて入れる票。推薦のお返しに政策を求められやすい。',
    '癒着の疑い：献金や便宜が重なると上がるメーター。高いと「癒着」と報じられる。',
    '各界向けの支出の枠：予算を付ける行動を続けると、枠を超えて財政当局が渋い顔をする。',
  ];
  await ui.info('各界の用語メモ', L, { w: 540 });
}
export function openGroups(g, opts = {}) { return has(g, 'govtConsole') ? g.govtConsole('groups', { sub: opts.sub }) : Promise.resolve(null); }
Game.prototype.groupsScreen = function groupsScreen(sub, opts = {}) { return openGroups(this, { ...opts, sub }); };
