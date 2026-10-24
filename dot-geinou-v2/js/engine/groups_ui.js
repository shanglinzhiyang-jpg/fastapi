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
    T('観光立国推進基本法', 'かんこうりっこくすいしんきほんほう', 'chiho', '観光で国を成り立たせる方針を定めた法律（2007年施行）。', (y) => `観光を国の重要な政策とする基本法。2006年12月に成立し、2007年1月に施行された。${y >= 2008 ? '2008年10月には、国土交通省の外局として観光庁が発足した。' : ''}`, { since: 2007, sinceText: '2007年1月', related: ['地方自治'] });
    T('オーバーツーリズム', 'おーばーつーりずむ', 'kurashi', '観光客が集中しすぎて、住民の暮らしや環境が損なわれること。', '観光客が特定の場所に集中し、混雑・ごみ・騒音・交通の混乱などで、住民の暮らしや自然環境、観光客の満足が損なわれること。予約制・入場制限・宿泊税や入域料などの対策がある。', { since: 2015, sinceText: '2010年代後半から問題に', related: ['観光立国推進基本法'] });
    T('団体規制法', 'だんたいきせいほう', 'kenpo', '無差別大量殺人行為を行った団体を規制する法律（1999年）。', '過去に無差別大量殺人行為を行った団体について、公安調査庁が観察処分を請求し、公安審査委員会が決める仕組み。団体の施設への立入検査や、活動状況の報告が義務づけられる。破壊活動防止法（1952年）とは別の法律。', { since: 1999, sinceText: '1999年12月', related: ['信教の自由', '政教分離'] });
    T('文化庁', 'ぶんかちょう', 'naikaku', '文化の振興と文化財の保護を担う国の機関（1968年発足）。', (y) => `芸術の振興、文化財の保護、国語や著作権の仕事などを担う、文部省（のちに文部科学省）の外局。1968年に発足した。${y >= 2023 ? '2023年には一部の業務が京都で始まった。' : ''}`, { since: 1968, sinceText: '1968年', related: ['表現の自由'] });
    T('スポーツ庁', 'すぽーつちょう', 'naikaku', 'スポーツの振興を担う国の機関（2015年発足）。', '文部科学省の外局として、2015年10月に発足した。スポーツの振興、競技力の向上、スポーツを通じた健康づくり、大会の招致などを進める。', { since: 2015, sinceText: '2015年10月', related: [] });
    T('科学技術基本法', 'かがくぎじゅつきほんほう', 'naikaku', '科学技術の振興を定めた法律（1995年）。', (y) => `1995年に議員立法で全会一致で成立。政府は科学技術基本計画をつくり、研究費を確保する。${y >= 2021 ? '2021年からは「科学技術・イノベーション基本法」になった。' : ''}研究への投資は、すぐには成果が見えにくいが、長い目で成長に効く。`, { since: 1995, sinceText: '1995年', related: [] });
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

// ================================================================ the console tab 「各界」 (the kit is the console's own: govt_ui.js passes it)
const CASE_KIND_LABEL = { demand: '要望', offer_don: '献金の申し出', offer_endorse: '推薦の申し出', offer_amb: '依頼', strike: 'ストライキ', scandal: '不祥事', incident: '事件', fraud: '研究不正', protest: '抗議' };
const CASE_RES = { accept: '応えた', partial: '一部応えた', bill: '法案で応えた', delay: '先送り', refuse: '断った', expired: '期限切れ', decline: '辞退', mediate: '調停', concede: '条件改善を後押し', hard: '強硬策', emergency: '緊急調整', watch: '静観', investigate: '第三者調査', defend: '擁護', distance: '距離を置いた', ignore: '無視', order: '取り締まり', talk: '対話', statement: '声明', probe: '調査', leave: '任せた', cut: '研究費停止', listen: '対話', firm: '突っぱねた', ended: '解決' };
const ACT_KIND_LABEL = { soft: '穏やか', gov: '予算・制度', dark: '強引', pol: '政治活動', self: '自分の力' };
function stOf(ui) {
  const st = ui.tabState();
  if (!SUB_IDS.includes(st.sub)) st.sub = 'overview';
  if (!DOMAINS[st.dom]) st.dom = 'tourism';
  return st;
}
export function tabAlert(ui) {
  const g = ui.g;
  const role = safe(() => g.groupsRole(), null);
  if (!role || role.kind === 'citizen') return 0;
  const sm = safe(() => g.groups(), null);
  return sm && sm.due > 0 ? 1 : 0;
}
export function tabLoad(ui, kit) {
  const g = ui.g, st = stOf(ui);
  const d = { sum: g.groups(), role: g.groupsRole(), sub: st.sub };
  switch (st.sub) {
    case 'groups': {
      d.list = g.groupList(st.dom);
      const gi = clamp(num(st.grow), 0, Math.max(0, d.list.length - 1));
      d.cur = d.list[gi] || null;
      d.acts = d.cur ? g.groupActions(d.cur.id) : [];
      d.special = g.groupsSpecial(st.dom);
      d.dom = d.sum.domains.find((x) => x.id === st.dom);
      break;
    }
    case 'cases': d.cases = g.groupCases(); d.log = (g.state.groups && g.state.groups.caseLog) || []; break;
    case 'tourism': d.tour = g.tourism(); d.sites = st.tmode === 'cand' ? d.tour.candList : d.tour.siteList; break;
    case 'panels': d.panels = g.panels(); d.backing = g.panelBacking(); break;
    case 'timeline': d.news = g.groupNews(60); d.inst = g.groupsInstitutions(st.dom); break;
    default: break;
  }
  if (!st.tipT) { st.tipT = ui.t; }
  return d;
}
function chipsLayout(ui, kit, y) {
  const c = ui.g.ctx;
  const out = [];
  let x = 4;
  for (const id of DOMAIN_ORDER) {
    const label = DOM_ABBR[id];
    const w = Math.round(c ? kit.measure(c, label, 11) : label.length * 11) + 10;
    out.push({ kind: 'seg', id: `dom_${id}`, x, y, w, h: 17, label, why: null, tip: `${DOMAINS[id].full}：${DOMAINS[id].desc}`, a: (u) => { const s = u.tabState(); s.dom = id; s.grow = 0; s.arow = 0; u.dirty(); } });
    x += w + 2;
  }
  return out;
}
function specialSpec(ui, d, kit) {
  const g = ui.g, sp = d.special || {}, dom = ui.tabState().dom;
  const S = { title: DOMAINS[dom].full, bars: [], lines: [], buttons: [] };
  const f = kit.fmtN;
  switch (dom) {
    case 'tourism':
      S.title = `観光立国（${sp.agency}）`;
      S.lines = [`訪日客 年${f(sp.inboundMan)}万人（目安）・指定${sp.sites}か所（自分${sp.mine}）`, `入込の収入 月${sp.income}億円・混雑${sp.over}か所・満足度${sp.avgSat}`, sp.law || sp.resort || sp.overNote || ''];
      S.buttons = [{ id: 'sp1', label: '観光地の画面へ', tip: '観光地の指定・整備・宣伝・混雑対策', a: (u) => { u.tabState().sub = 'tourism'; u.dirty(); } }];
      break;
    case 'rengo': {
      const sh = sp.shunto || {};
      S.title = `${sp.center || '労働'}・春闘と最低賃金`;
      S.lines = [`組織率 ${sp.rate}%・最低賃金（全国平均の目安）${f(sp.minWageValue)}円`, `春闘：${sh.label || '—'}${sh.dem ? `　要求${sh.dem}` : ''}${sh.settled ? `→回答${sh.settled}%` : ''}（目安${sh.trend}）`, sp.activeStrike ? `ストライキ中：${sp.activeStrike.name}（${sp.activeStrike.days}日）` : sp.results && sp.results[0] ? `前回の春闘：要求${sp.results[0].dem}%→回答${sp.results[0].settled}%` : sp.note];
      const mw = sp.minWage || { options: [] };
      const why = mw.options.length && mw.options.every((o) => o.why && !/先に/.test(o.why)) ? mw.options[0].why : null;
      S.buttons = [{ id: 'sp1', label: '最低賃金を上げる', why, tip: '中央最低賃金審議会の答申を受けて、政令で決める', a: (u) => minWageFlow(u) }];
      break;
    }
    case 'sports':
      S.title = `大会の誘致（${sp.agency}）`;
      S.lines = [...(sp.active || []).slice(0, 2).map((b) => `${b.name}：${b.statusLabel}${b.status === 'declared' ? `（決定まであと${b.leftDecide}日・見込み${Math.round(b.odds * 100)}%）` : `（開幕まであと${b.leftEvent}日）`}`), (sp.active || []).length ? '' : '誘致・準備中の大会はない', sp.past && sp.past.length ? `これまで：${sp.past.slice(-2).map((x) => x.replace('年 ', ' ')).join('・')}` : ''].filter(Boolean);
      S.buttons = [{ id: 'sp1', label: '大会の誘致・準備', tip: '五輪・万博・W杯・アジア大会・国スポの誘致と準備', a: (u) => bidFlow(u) }];
      break;
    case 'business':
      S.title = '経済界との関係';
      S.bars = [['癒着の疑い', num(sp.corr), num(sp.corr) >= 55 ? kit.K.bad : kit.K.warn]];
      S.lines = [sp.law, `これまでの献金 ${fmtMoney(num(sp.donations))}${sp.petition ? `・要望書の季節` : ''}`];
      break;
    case 'kyokai':
      S.title = '業界団体との関係';
      S.bars = [['癒着の疑い', num(sp.corr), num(sp.corr) >= 55 ? kit.K.bad : kit.K.warn]];
      S.lines = [sp.law, '補助金・規制・献金が重なると癒着を疑われる'];
      break;
    case 'sect':
      S.title = '公安の監視・団体規制';
      S.lines = [...(sp.watch || []).map((w) => `${w.name}：過激化 ${w.known ? `${w.radical}／100` : '不明（調査すると分かる）'}`), sp.law];
      break;
    case 'yushikisha': {
      const n = (sp.panels || []).length, rep = (sp.panels || []).filter((p) => p.status === 'reported').length, mt = (sp.panels || []).filter((p) => p.status === 'meeting').length;
      S.title = '有識者会議（私的諮問機関）';
      S.lines = [`会議 ${n}件（審議中${mt}・採否待ち${rep}）`, (sp.backing || []).length ? `政策の後ろ盾：${sp.backing.map((b) => `${b.name}（あと${b.left}日）`).slice(0, 2).join('・')}` : '政策の後ろ盾になっている報告書はない', sp.shelved ? `棚上げした報告書 ${sp.shelved}件` : ''].filter(Boolean);
      S.buttons = [{ id: 'sp1', label: '有識者会議へ', tip: '会議を開く・報告書の採否を決める', a: (u) => { u.tabState().sub = 'panels'; u.dirty(); } }];
      break;
    }
    case 'artist':
      S.title = '表現の自由と文化の現場';
      S.bars = [['表現の自由度', num(sp.freedom), sp.freedom < 50 ? kit.K.bad : kit.K.good]];
      S.lines = [`抗議・論争 ${sp.protests}件`, sp.note || ''].filter(Boolean);
      break;
    case 'bunka':
      S.title = `文化（${sp.agency}）`;
      S.lines = [`指定文化財 ${sp.heritage}件・傷み ${sp.damage}`, sp.cool || 'コンテンツ産業の育成は、文化と経済の施策で進められる'];
      break;
    case 'kenkyu':
      S.title = '研究と科学技術';
      S.bars = [['研究水準', num(sp.level), kit.K.cyan], ['研究公正', num(sp.integrity), kit.K.good]];
      S.lines = [`若手の安定 ${sp.young}・ノーベル賞 ${sp.nobel}人${sp.laureates && sp.laureates[0] ? `（直近 ${sp.laureates[0].year}年）` : ''}`, `${sp.law}`];
      break;
    case 'seifu':
      S.title = '官庁・自治体との関係';
      S.bars = [['官庁の協力度', num(sp.trust), num(sp.trust) >= 50 ? kit.K.good : kit.K.warn]];
      S.lines = [sp.jinji, sp.local, sp.amakudari ? `天下りへの世論の関心 ${sp.amakudari.heat}` : ''].filter(Boolean);
      S.buttons = [{ id: 'sp1', label: '行政タブへ', tip: '行政タブで、省庁・大臣・審議会を見る', a: (u) => { u.setTab(kit.tabIndex('admin')); u.focus = 'body'; } }];
      break;
    default: break;
  }
  return S;
}
export function tabLayout(ui, d, kit) {
  const g = ui.g, st = stOf(ui);
  const out = kit.segCtls(ui, SUBS, 4, 44);
  const { listCtl, btn } = kit;
  switch (st.sub) {
    case 'overview': {
      out.push(listCtl(ui, 'dom', { id: 'dom', x: 4, y: 64, w: 424, h: 272, y0: 36, rowH: 20, n: DOMAIN_ORDER.length, tip: (u) => { const x = d.sum.domains[u.tabState().dom | 0]; return x ? `${x.full}：${x.desc}（A：この分野の団体を見る）` : ''; }, a: (u) => { const x = d.sum.domains[u.tabState().dom | 0]; if (!x) return; const s = u.tabState(); s.dom = x.id; s.grow = 0; s.arow = 0; s.sub = 'groups'; u.dirty(); } }));
      break;
    }
    case 'groups': {
      out.push(...chipsLayout(ui, kit, 64));
      const n = d.list ? d.list.length : 0;
      out.push(listCtl(ui, 'grow', { id: 'grow', x: 4, y: 84, w: 164, h: 252, y0: 18, rowH: 30, n, tip: (u) => { const x = d.list[u.tabState().grow | 0]; return x ? `${x.name}：${x.kind}` : ''; }, a: null, onMove: (u) => { u.tabState().arow = 0; } }));
      const k = ui.tabState();
      out.push(listCtl(ui, 'arow', { id: 'arow', x: 438, y: 84, w: 198, h: 170, y0: 18, rowH: 14, n: d.acts.length, why: (u) => { const a = d.acts[u.tabState().arow | 0]; return a ? a.why : null; }, tip: (u) => { const a = d.acts[u.tabState().arow | 0]; return a ? `${a.name}：${a.desc}` : ''; }, a: (u) => { const a = d.acts[u.tabState().arow | 0]; if (a && d.cur) return actionFlow(u, d.cur.id, a.id); return null; } }));
      void k;
      const spec = specialSpec(ui, d, kit);
      spec.buttons.forEach((b, i) => out.push(btn({ id: b.id, x: 178 + i * 128, y: 314, w: 124, h: 18, label: b.label, why: b.why || null, tip: b.tip, a: b.a })));
      break;
    }
    case 'cases': {
      const cs = d.cases;
      out.push(listCtl(ui, 'crow', { id: 'crow', x: 4, y: 64, w: 250, h: 200, y0: 18, rowH: 26, n: cs.length, tip: (u) => { const c = cs[u.tabState().crow | 0]; return c ? `${c.title}（期限${c.left <= 0 ? '今日' : `あと${c.left}日`}）　A：答え方を選ぶ` : '案件はない'; }, a: (u) => { if (cs.length) u.cur[u.tab.id] = 'orow'; }, onMove: (u) => { u.tabState().orow = 0; } }));
      const c = cs[clamp(num(ui.tabState().crow), 0, Math.max(0, cs.length - 1))];
      const opts = c ? c.options : [];
      out.push(listCtl(ui, 'orow', { id: 'orow', x: 258, y: 190, w: 378, h: 146, y0: 18, rowH: 25, n: opts.length, why: (u) => { const o = opts[u.tabState().orow | 0]; return o ? o.why : null; }, tip: (u) => { const o = opts[u.tabState().orow | 0]; return o ? `${o.label}：${o.desc || ''}` : ''; }, a: (u) => { const o = opts[u.tabState().orow | 0]; if (c && o) return caseFlow(u, c, o.key); return null; } }));
      break;
    }
    case 'tourism': {
      const t = d.tour;
      out.push({ kind: 'seg', id: 'tm_have', x: 304, y: 64, w: 100, h: 17, label: `指定済み ${t.siteList.length}`, why: null, tip: '指定した観光地（整備・宣伝などができる）', a: (u) => { u.tabState().tmode = 'have'; u.tabState().trow = 0; u.dirty(); } });
      out.push({ kind: 'seg', id: 'tm_cand', x: 406, y: 64, w: 100, h: 17, label: `候補地 ${t.candList.length}`, why: null, tip: '指定の候補（自治体や観光協会が提案してくる）', a: (u) => { u.tabState().tmode = 'cand'; u.tabState().trow = 0; u.dirty(); } });
      out.push(listCtl(ui, 'trow', { id: 'trow', x: 304, y: 84, w: 332, h: 112, y0: 14, rowH: 16, n: d.sites.length, tip: (u) => { const s = d.sites[u.tabState().trow | 0]; return s ? `${s.name}（${s.kindName}）：A でできること` : '観光地がない'; }, a: (u) => { const s = d.sites[u.tabState().trow | 0]; if (s) return siteFlow(u, s); return null; } }));
      break;
    }
    case 'panels': {
      out.push(listCtl(ui, 'prow', { id: 'prow', x: 4, y: 64, w: 250, h: 170, y0: 18, rowH: 26, n: d.panels.length, tip: (u) => { const p = d.panels[u.tabState().prow | 0]; return p ? `${p.title}：${p.statusLabel}` : '会議はまだ開いていない'; }, a: (u) => { const p = d.panels[u.tabState().prow | 0]; if (p && p.status === 'reported') return panelAnswerFlow(u, p); return null; } }));
      out.push(btn({ id: 'pconv', x: 258, y: 314, w: 186, h: 20, label: '有識者会議を開く', color: '#7aa8ff', why: null, tip: 'テーマ・座長・人選を決めて会議を開く（総理・官房長官・担当の大臣・首長）', a: (u) => panelConveneFlow(u) }));
      const p = d.panels[clamp(num(ui.tabState().prow), 0, Math.max(0, d.panels.length - 1))];
      out.push(btn({ id: 'pans', x: 450, y: 314, w: 186, h: 20, label: '報告書の採否を決める', color: '#ffb547', why: p && p.status === 'reported' ? null : '採否を決められる報告書がない（会議が終わるまで待つ）', tip: '採用・一部採用・公表のみ・棚上げ', a: (u) => (p ? panelAnswerFlow(u, p) : null) }));
      break;
    }
    case 'timeline': {
      out.push(listCtl(ui, 'nrow', { id: 'nrow', x: 4, y: 64, w: 380, h: 272, y0: 18, rowH: 16, n: d.news.length, tip: (u) => { const n = d.news[u.tabState().nrow | 0]; return n ? n.text : ''; }, a: (u) => { const n = d.news[u.tabState().nrow | 0]; if (n) return u.info('各界のニュース', [dayLabel(g, n.day), n.text, n.domain ? `分野：${DOMAINS[n.domain] ? DOMAINS[n.domain].full : n.domain}` : ''].filter(Boolean)); return null; } }));
      out.push(listCtl(ui, 'hrow', { id: 'hrow', x: 388, y: 64, w: 248, h: 196, y0: 18, rowH: 16, n: DOMAIN_ORDER.length, tip: (u) => { const x = d.sum.domains[u.tabState().hrow | 0]; return x ? `${x.full}の支持の推移（A：この分野の制度を下に表示）` : ''; }, a: (u) => { const x = d.sum.domains[u.tabState().hrow | 0]; if (x) { u.tabState().dom = x.id; u.dirty(); } return null; } }));
      out.push(btn({ id: 'terms', x: 388, y: 316, w: 248, h: 18, label: '各界の用語メモ', tip: '春闘・有識者会議・オーバーツーリズム・組織票・癒着の疑い', a: (u) => termsFlow(u) }));
      break;
    }
    default: break;
  }
  return out;
}

// ---------------------------------------------------------------- drawing
const LAND = [
  [[62, 6], [70, 3], [80, 7], [89, 14], [85, 21], [76, 23], [70, 28], [62, 24], [58, 15]],
  [[68, 30], [73, 37], [71, 46], [75, 52], [68, 57], [61, 55], [54, 59], [46, 61], [40, 65], [34, 69], [26, 73], [18, 71], [13, 66], [20, 62], [28, 60], [36, 56], [44, 52], [52, 46], [58, 40], [63, 33]],
  [[26, 77], [38, 75], [45, 79], [39, 85], [28, 85]],
  [[6, 77], [16, 75], [19, 83], [14, 93], [8, 93], [4, 85]],
];
function drawMap(c, kit, x, y, w, h, sites, selId, tick) {
  const { K, R } = kit;
  R(c, x, y, w, h, '#071a2a');
  for (let i = 0; i < w; i += 16) R(c, x + i, y, 1, h, '#0a2236');
  for (let j = 0; j < h; j += 16) R(c, x, y + j, w, 1, '#0a2236');
  const mx = x + 8, my = y + 6, mw = w - 16, mh = h - 12;
  c.save();
  for (const poly of LAND) {
    c.beginPath();
    poly.forEach(([px, py], i) => { const X = Math.round(mx + (px / 100) * mw), Y = Math.round(my + (py / 100) * mh); if (i === 0) c.moveTo(X, Y); else c.lineTo(X, Y); });
    c.closePath();
    c.fillStyle = '#1d4a3a'; c.fill();
    c.strokeStyle = '#3f8a6a'; c.lineWidth = 1; c.stroke();
  }
  c.restore();
  const names = { hokkaido: '北海道', tohoku: '東北', kanto: '関東', chubu: '中部', kansai: '近畿', chugoku: '中国', shikoku: '四国', kyushu: '九州' };
  for (const [id, r] of Object.entries(GR.SITE_REGIONS)) kit.T(c, names[id], mx + r.x * mw, my + r.y * mh + 10, 9, '#3f6a5a', 'center');
  for (const s of sites) {
    const X = Math.round(mx + s.x * mw), Y = Math.round(my + s.y * mh);
    const sel = s.id === selId;
    const col = s.status === 'candidate' ? K.cyan : s.crowd >= 75 ? K.bad : s.crowd >= 60 ? K.warn : K.good;
    if (s.status === 'candidate') { kit.frame(c, X - 3, Y - 3, 7, 7, null, col); } else { R(c, X - 3, Y - 3, 7, 7, col); R(c, X - 2, Y - 2, 5, 5, kit.shade(col, -0.25)); }
    if (sel) { const b = Math.floor(tick / 15) % 2 === 0; kit.frame(c, X - 6, Y - 6, 13, 13, null, b ? '#ffffff' : K.selEdge); const lw = Math.round(kit.measure(c, s.name, 10)) + 6; const lx = clamp(X - lw / 2, x + 2, x + w - lw - 2); R(c, lx, Y - 22, lw, 12, '#02101c'); kit.T(c, s.name, lx + 3, Y - 21, 10, K.white); }
  }
}
const supCol = (v, K) => (v >= 30 ? K.good : v >= 10 ? '#9ad06a' : v > -10 ? K.dim : v > -30 ? K.warn : K.bad);
const angCol = (v, K) => (v >= 70 ? K.bad : v >= 45 ? K.warn : v >= 22 ? '#c8c060' : K.faint);
function drawOverview(c, ui, d, kit) {
  const { K, T, panel, chip, cbar, hbar, para, drawList } = kit;
  const sm = d.sum;
  panel(c, 4, 64, 424, 272, '分野ごとの関係（支持・影響力・不満・要望）', { right: `あなた：${d.role.label}` });
  T(c, '分野', 22, 84, 10, K.faint); T(c, '支持（−100〜100）', 130, 84, 10, K.faint); T(c, '影響力', 258, 84, 10, K.faint); T(c, '不満', 320, 84, 10, K.faint); T(c, '要望', 366, 84, 10, K.faint); T(c, '操作', 398, 84, 10, K.faint);
  const k = ui.ctls.find((q) => q.id === 'dom');
  if (!k) return;
  drawList(c, ui, k, (c2, i, x, y, w) => {
    const x0 = sm.domains[i];
    c2.fillStyle = x0.color; c2.fillRect(x + 4, y + 4, 4, 11);
    T(c2, x0.name, x + 13, y + 3, 12, K.text, 'left', 98);
    cbar(c2, x + 118, y + 6, 96, 8, x0.avg / 100, K.good, K.bad);
    T(c2, `${x0.avg > 0 ? '+' : ''}${x0.avg}`, x + 220, y + 4, 10, supCol(x0.avg, K), 'right', 28);
    hbar(c2, x + 254, y + 7, 46, 6, x0.inf / 100, K.violet);
    T(c2, x0.angerLabel, x + 312, y + 4, 10, angCol(x0.anger, K), 'left', 44);
    T(c2, x0.cases ? `${x0.cases}件` : '—', x + 366, y + 4, 10, x0.due ? K.bad : x0.cases ? K.warn : K.faint);
    T(c2, x0.control === 'full' ? '所管' : x0.control === 'part' ? '一部' : '見る', x + 400, y + 4, 10, x0.control === 'full' ? K.amber : K.faint, 'left', 22);
  });
  T(c, 'A：この分野の団体を見る　支持は「あなた（政権）への態度」', 10, 322, 10, K.faint, 'left', 410);
  // right: the effects on the world
  panel(c, 432, 64, 204, 112, '各界の評価のはたらき');
  const ap = sm.ap;
  const isCab = d.role.cabinet;
  T(c, isCab ? '内閣支持率への影響' : d.role.kind === 'member' ? '党内の評価への影響' : d.role.kind === 'local' ? '地元の支持への影響' : '（政治の立場ではない）', 438, 84, 10, K.dim, 'left', 150);
  T(c, `${ap > 0 ? '+' : ap < 0 ? '−' : '±'}${Math.abs(ap)}`, 630, 82, 14, ap >= 0 ? K.good : K.bad, 'right');
  T(c, '癒着の疑い', 438, 104, 10, K.dim); hbar(c, 500, 107, 100, 6, sm.corr / 100, sm.corr >= 55 ? K.bad : K.warn); T(c, `${sm.corr}`, 630, 104, 10, K.dim, 'right');
  T(c, '支出の枠', 438, 120, 10, K.dim); hbar(c, 500, 123, 100, 6, sm.fiscal.spent / Math.max(1, sm.fiscal.frame), sm.fiscal.over ? K.bad : K.teal); T(c, `${Math.round((sm.fiscal.spent / Math.max(1, sm.fiscal.frame)) * 100)}%`, 630, 120, 10, K.dim, 'right');
  para(c, `${sm.fiscal.text}`, 438, 136, 194, 10, K.faint, 11, 2);
  T(c, `献金の累計 ${fmtMoney(sm.donations)}`, 438, 160, 10, K.dim, 'left', 194);
  panel(c, 432, 180, 204, 156, '注意・おすすめ');
  let yy = 200;
  for (const h of sm.hot.slice(0, 3)) { T(c, `⚠ ${h.name}が不満（${h.anger}）`, 438, yy, 10, K.warn, 'left', 194); yy += 12; }
  for (const a of sm.advice.slice(0, 3)) yy = para(c, `・${a}`, 438, yy + 1, 192, 10, K.text, 11, 3);
  if (d.sum.best[0]) T(c, `最も協力的：${d.sum.best[0].name}`, 438, 318, 10, K.good, 'left', 194);
}
function drawGroups(c, ui, d, kit) {
  const { K, T, panel, chip, cbar, hbar, para, drawList, drawBtn, padlock, frame, R } = kit;
  const st = ui.tabState();
  // domain chips
  for (const id of DOMAIN_ORDER) {
    const k = ui.ctls.find((q) => q.id === `dom_${id}`);
    if (!k) continue;
    const on = st.dom === id, focus = ui.focus === 'body' && ui.cur[ui.tab.id] === k.id;
    frame(c, k.x, k.y, k.w, k.h, on ? kit.shade(DOMAINS[id].color, -0.6) : '#0b1621', on ? DOMAINS[id].color : focus ? K.selEdge : K.edge);
    T(c, k.label, k.x + k.w / 2, k.y + 3, 11, on ? K.white : K.dim, 'center', k.w - 4);
    const dm = d.sum.domains.find((x) => x.id === id);
    if (dm && dm.due) R(c, k.x + k.w - 4, k.y + 2, 3, 3, K.bad);
  }
  const dm = d.dom;
  panel(c, 4, 84, 164, 252, `${DOMAINS[st.dom].name}の団体`, { accent: DOMAINS[st.dom].color });
  const gk = ui.ctls.find((q) => q.id === 'grow');
  if (gk) drawList(c, ui, gk, (c2, i, x, y, w) => {
    const gr = d.list[i];
    T(c2, gr.name, x + 6, y + 2, 11, K.text, 'left', w - 10);
    cbar(c2, x + 6, y + 18, 80, 6, gr.support / 100, K.good, K.bad);
    T(c2, `${gr.support > 0 ? '+' : ''}${gr.support}`, x + 90, y + 15, 10, supCol(gr.support, K), 'left', 26);
    T(c2, gr.cases.length ? `要望${gr.cases.length}` : gr.angerLabel, x + w - 6, y + 15, 10, gr.cases.length ? K.warn : angCol(gr.anger, K), 'right', 40);
  }, { empty: 'この時代にはまだない' });
  // detail
  const cur = d.cur;
  panel(c, 172, 84, 262, 166, cur ? cur.name : '団体', { accent: DOMAINS[st.dom].color, right: cur ? (cur.control === 'full' ? '所管' : cur.control === 'part' ? '一部' : '見るだけ') : '', rightColor: K.amber });
  if (cur) {
    T(c, cur.kind, 178, 104, 10, K.dim, 'left', 250);
    const bar = (label, v, y, col, txt) => { T(c, label, 178, y, 10, K.dim); hbar(c, 224, y + 3, 110, 6, v, col); T(c, txt, 340, y, 10, K.text, 'left', 90); };
    T(c, '支持', 178, 118, 10, K.dim); cbar(c, 224, 121, 110, 6, cur.support / 100, K.good, K.bad); T(c, `${cur.support > 0 ? '+' : ''}${cur.support} ${cur.supportLabel}`, 340, 118, 10, supCol(cur.support, K), 'left', 90);
    bar('影響力', cur.influence / 100, 130, K.violet, `${cur.influence} ${cur.influenceLabel}`);
    bar('不満', cur.anger / 100, 142, cur.anger >= 45 ? K.bad : K.warn, `${cur.anger} ${cur.angerLabel}`);
    T(c, `献金・協力の力 ${cur.capacityLabel}　政権への態度 ${cur.govSupport > 0 ? '+' : ''}${cur.govSupport}${cur.cred != null ? `　信頼性 ${cur.cred}` : ''}`, 178, 155, 10, K.dim, 'left', 252);
    cur.leaders.forEach((l, i) => T(c, `${l.title} ${l.name}（${l.personaName}）`, 178, 167 + i * 11, 10, i ? K.dim : K.text, 'left', 252));
    if (cur.radical != null) T(c, `過激化 ${cur.radicalKnown ? `${cur.radical}／100（${cur.radicalLabel}）` : '不明（公安調査で分かる）'}${cur.banned ? '　活動禁止中' : cur.silent ? '　沈静化中' : ''}`, 178, 190, 10, cur.radicalKnown && cur.radical >= 55 ? K.bad : K.warn, 'left', 252);
    else if (cur.link) T(c, `宗教コア：信頼 ${Math.round(num(cur.link.trust))}／関係 ${Math.round(num(cur.link.relation))}　${cur.link.status || ''}`, 178, 190, 10, K.dim, 'left', 252);
    else T(c, cur.coop >= 3 ? '「御用団体」との見方が広がっている' : `献金の累計 ${fmtMoney(cur.don)}　見返りの期待 ${cur.owe}`, 178, 190, 10, cur.coop >= 3 ? K.warn : K.dim, 'left', 252);
    const gv = cur.grievances[0];
    T(c, gv ? `不満：${gv.text}` : '不満の種：いまは目立たない', 178, 201, 10, gv ? K.warn : K.faint, 'left', 252);
    T(c, `賛成：${cur.likesShort.slice(0, 2).join('・') || '—'}`, 178, 214, 10, K.good, 'left', 252);
    T(c, `反対：${cur.dislikesShort.slice(0, 2).join('・') || '—'}`, 178, 225, 10, K.bad, 'left', 252);
    if (cur.cases.length) T(c, `要望 ${cur.cases.length}件（期限 あと${Math.min(...cur.cases.map((x) => x.left))}日）`, 430, 106, 10, K.warn, 'right');
  }
  // special panel
  const spec = specialSpec(ui, d, kit);
  panel(c, 172, 252, 262, 84, spec.title, { accent: DOMAINS[st.dom].color });
  let sy = 272, rows = spec.buttons.length ? 3 : 5;
  for (const [label, v, col] of spec.bars.slice(0, 2)) { if (rows <= 0) break; T(c, label, 178, sy, 10, K.dim); hbar(c, 244, sy + 3, 120, 6, v / 100, col); T(c, `${Math.round(v)}`, 370, sy, 10, K.dim); sy += 11; rows--; }
  for (const l of spec.lines.filter(Boolean)) { if (rows <= 0) break; T(c, l, 178, sy, 10, K.text, 'left', 252); sy += 11; rows--; }
  for (const b of spec.buttons) drawBtn(c, ui, ui.ctls.find((q) => q.id === b.id), { center: true });
  // actions
  panel(c, 438, 84, 198, 170, 'できること', { right: cur ? `${d.acts.filter((a) => !a.why).length}/${d.acts.length}` : '' });
  const ak = ui.ctls.find((q) => q.id === 'arow');
  if (ak) drawList(c, ui, ak, (c2, i, x, y, w, rh, sel) => {
    const a = d.acts[i];
    c2.fillStyle = KIND_COLOR[a.kind] || K.dim; c2.fillRect(x + 4, y + 3, 3, 8);
    if (a.why) padlock(c2, x + 10, y + 3);
    T(c2, a.name, x + (a.why ? 20 : 12), y + 1, 10, a.why ? K.faint : sel ? K.white : K.text, 'left', w - (a.why ? 26 : 56));
    if (!a.why && a.odds != null) T(c2, `${Math.round(a.odds * 100)}%`, x + w - 4, y + 2, 10, a.odds >= 0.6 ? K.good : a.odds >= 0.35 ? K.warn : K.bad, 'right');
  }, { empty: '団体がない' });
  panel(c, 438, 256, 198, 80, '選んだ行動');
  const a = d.acts[clamp(num(st.arow), 0, Math.max(0, d.acts.length - 1))];
  if (a) {
    const cw = chip(c, 444, 276, ACT_KIND_LABEL[a.kind] || '', kit.shade(KIND_COLOR[a.kind] || K.dim, -0.55), KIND_COLOR[a.kind] || K.dim, 9);
    T(c, a.why ? '' : `${a.costText}`, 444 + cw + 4, 277, 9, K.dim, 'left', 188 - cw - 4);
    para(c, a.why ? `🔒 ${a.why}` : a.desc, 444, 290, 188, 9, a.why ? K.lock : K.text, 10, 5);
  }
}
function drawCases(c, ui, d, kit) {
  const { K, T, panel, chip, para, drawList } = kit;
  const st = ui.tabState();
  panel(c, 4, 64, 250, 200, '案件（期限が近い順）', { right: `${d.cases.length}件` });
  const ck = ui.ctls.find((q) => q.id === 'crow');
  if (ck) drawList(c, ui, ck, (c2, i, x, y, w) => {
    const cs = d.cases[i];
    T(c2, cs.title, x + 6, y + 1, 11, K.text, 'left', w - 56);
    T(c2, cs.left <= 0 ? '今日' : `あと${cs.left}日`, x + w - 6, y + 2, 10, cs.left <= 5 ? K.bad : K.dim, 'right');
    T(c2, `${CASE_KIND_LABEL[cs.kind] || ''}・${cs.groupName}`, x + 6, y + 14, 9, K.faint, 'left', w - 12);
  }, { empty: 'いま対応が必要な案件はない' });
  panel(c, 4, 268, 250, 68, '最近の結果');
  let yy = 288;
  for (const e of (d.log || []).slice(0, 4)) { T(c, `${e.status === 'expired' ? '×' : '○'} ${e.title}：${CASE_RES[e.key] || e.key}`, 10, yy, 9, e.status === 'expired' ? K.warn : K.dim, 'left', 240); yy += 11; }
  if (!(d.log || []).length) T(c, 'まだない', 10, yy, 10, K.faint);
  const cs = d.cases[clamp(num(st.crow), 0, Math.max(0, d.cases.length - 1))];
  panel(c, 258, 64, 378, 122, cs ? cs.title : '案件の詳細', { right: cs ? `${CASE_KIND_LABEL[cs.kind] || ''}` : '' });
  if (!cs) { para(c, '期限のある要望や、団体からの申し出・事件がここに届く。団体と会談すると要望が出されることもある。要望に応える・断る・先送りする、いずれも団体の支持や不満に響く。', 264, 86, 366, 11, K.dim, 14, 6); } else {
    para(c, cs.text, 264, 84, 366, 11, K.text, 13, 6);
    T(c, `期限：${cs.left <= 0 ? '今日まで' : `あと${cs.left}日（${dayLabel(ui.g, cs.due)}ごろ）`}${cs.ask ? `　種類：${GR.ASK_KIND_NAME[cs.ask.kind] || ''}` : ''}`, 264, 170, 10, cs.left <= 5 ? K.bad : K.dim, 'left', 366);
  }
  panel(c, 258, 190, 378, 146, '答え方（費用・見込み・変化）');
  const ok = ui.ctls.find((q) => q.id === 'orow');
  const opts = cs ? cs.options : [];
  if (ok) drawList(c, ui, ok, (c2, i, x, y, w, rh, sel) => {
    const o = opts[i];
    if (o.why) kit.padlock(c2, x + 4, y + 3);
    T(c2, o.label, x + (o.why ? 16 : 8), y + 1, 11, o.why ? K.faint : sel ? K.white : K.text, 'left', w - (o.why ? 70 : 62));
    if (o.odds != null && !o.why) T(c2, `${Math.round(o.odds * 100)}%`, x + w - 6, y + 2, 10, o.odds >= 0.6 ? K.good : o.odds >= 0.35 ? K.warn : K.bad, 'right');
    T(c2, o.why ? `🔒 ${o.why}` : `${o.costText}${o.lines && o.lines.length ? `・${o.lines.slice(0, 2).join('・')}` : o.desc ? `・${o.desc}` : ''}`, x + 8, y + 13, 9, o.why ? K.lock : K.dim, 'left', w - 14);
  }, { empty: opts.length ? '' : '答える案件がない' });
}
function drawTourism(c, ui, d, kit) {
  const { K, T, panel, chip, hbar, para, drawList, R } = kit;
  const st = ui.tabState();
  const t = d.tour;
  panel(c, 4, 64, 296, 272, `観光地の地図（${t.agency}）`, { accent: '#4fd2e8' });
  const sel = d.sites[clamp(num(st.trow), 0, Math.max(0, d.sites.length - 1))];
  drawMap(c, kit, 6, 82, 292, 220, [...t.siteList, ...(st.tmode === 'cand' ? t.candList : [])], sel ? sel.id : null, ui.t);
  T(c, `訪日客 年${kit.fmtN(t.inboundMan)}万人（目安）`, 10, 306, 9, K.dim, 'left', 284); T(c, '■緑：余裕　■黄：混雑ぎみ　■赤：混雑　□候補地', 10, 319, 9, K.faint, 'left', 284);
  for (const id of ['tm_have', 'tm_cand']) {
    const k = ui.ctls.find((q) => q.id === id);
    if (!k) continue;
    const on = (id === 'tm_cand') === (st.tmode === 'cand');
    kit.frame(c, k.x, k.y, k.w, k.h, on ? '#1d4a64' : '#0b1621', on ? K.cyan : K.edge);
    T(c, k.label, k.x + k.w / 2, k.y + 3, 11, on ? K.white : K.dim, 'center', k.w - 4);
  }
  T(c, t.law || (t.resort ? 'リゾート法の時代' : ''), 632, 67, 9, K.faint, 'right', 120);
  const lk = ui.ctls.find((q) => q.id === 'trow');
  panel(c, 304, 84, 332, 112, st.tmode === 'cand' ? '指定の候補地' : '指定した観光地');
  if (lk) drawList(c, ui, lk, (c2, i, x, y, w) => {
    const s = d.sites[i];
    c2.fillStyle = s.status === 'candidate' ? K.cyan : s.crowd >= 75 ? K.bad : s.crowd >= 60 ? K.warn : K.good; c2.fillRect(x + 4, y + 4, 6, 6);
    T(c2, s.name, x + 14, y + 2, 10, K.text, 'left', 120);
    T(c2, `${s.kindName}`, x + 138, y + 3, 9, K.dim, 'left', 100);
    T(c2, s.status === 'candidate' ? `魅力${'★'.repeat(s.stars)}` : `${s.vis}千人/月`, x + w - 6, y + 2, 10, K.dim, 'right', 80);
  }, { empty: st.tmode === 'cand' ? '候補はいまない（そのうち提案される）' : '指定した観光地がない（候補地から指定する）' });
  panel(c, 304, 200, 332, 136, sel ? sel.name : '観光地の様子', { accent: '#4fd2e8', right: sel ? `${sel.regionName}・${sel.owner === 'player' ? 'あなたの指定' : sel.status === 'candidate' ? '候補' : '既存'}` : '' });
  if (sel) {
    const row = (label, v, x, y, col, txt) => { T(c, label, x, y, 9, K.dim); hbar(c, x + 40, y + 2, 64, 5, clamp(v / 100, 0, 1), col); T(c, txt, x + 108, y, 9, K.text, 'left', 50); };
    const x1 = 310, x2 = 474;
    if (sel.status === 'candidate') {
      T(c, `魅力 ${'★'.repeat(sel.stars)}${'☆'.repeat(5 - sel.stars)}　地元の賛成 ${sel.local}　指定の費用 ${GR.fmtOku(sel.cost)}`, x1, 220, 10, K.text, 'left', 320);
      para(c, '指定すると、整備・宣伝・規制緩和・混雑対策・世界遺産への申請ができる。地元の住民の反対が強いと見送りになる。A で「指定する」。', x1, 236, 320, 10, K.dim, 12, 4);
    } else {
      row('入込', sel.vis / 120 * 100, x1, 218, K.cyan, `${sel.vis}千人/月`);
      row('外国人', sel.fr * 100, x2, 218, K.violet, `${Math.round(sel.fr * 100)}%`);
      row('収入', sel.inc / 15 * 100, x1, 230, K.good, `${sel.inc}億円/月`);
      row('満足度', sel.sat, x2, 230, sel.sat >= 55 ? K.good : K.warn, `${sel.sat}`);
      row('混雑', sel.crowd, x1, 242, sel.crowd >= 75 ? K.bad : sel.crowd >= 60 ? K.warn : K.good, `${sel.crowd}${sel.over ? ' 過多' : ''}`);
      row('地元支持', sel.local, x2, 242, sel.local >= 40 ? K.good : K.bad, `${sel.local}`);
      row('整備', sel.infra, x1, 254, K.teal, `${sel.infra}`);
      row('宣伝力', sel.promo, x2, 254, K.pink, `${sel.promo}`);
      row('自然環境', sel.env, x1, 266, sel.env >= 50 ? K.good : K.bad, `${sel.env}`);
      row('文化度', sel.culture, x2, 266, K.amber, `${sel.culture}`);
      const extra = [sel.whl.stage === 'inscribed' ? '世界遺産に登録済み' : sel.whl.stage === 'tentative' ? '世界遺産の審査中' : sel.whl.stage === 'rejected' ? '世界遺産は見送り' : '', sel.debt > 0 ? `第三セクターの借金 ${sel.debt}億円` : '', sel.dereg ? `規制緩和${sel.dereg}段階` : '', sel.crowdCtl ? `混雑対策${sel.crowdCtl}段階` : '', ...sel.pend.map((p) => `${p.text}（あと${p.left}日）`)].filter(Boolean);
      para(c, extra.join('　') || (sel.log[0] ? sel.log[0].text : 'A で整備・宣伝などを選ぶ'), x1, 280, 320, 10, K.dim, 12, 3);
      if (sel.log[0] && extra.length) T(c, `直近：${sel.log[0].text}`, x1, 316, 9, K.faint, 'left', 320);
    }
  } else para(c, '指定した観光地を選ぶと、入込・収入・満足度・混雑・住民の支持が見える。', 310, 220, 320, 10, K.dim, 12, 4);
}
function drawPanels(c, ui, d, kit) {
  const { K, T, panel, chip, para, drawList, drawBtn, hbar, cbar } = kit;
  const st = ui.tabState();
  panel(c, 4, 64, 250, 170, '有識者会議', { accent: '#7aa8ff', right: `${d.panels.length}件` });
  const pk = ui.ctls.find((q) => q.id === 'prow');
  if (pk) drawList(c, ui, pk, (c2, i, x, y, w) => {
    const p = d.panels[i];
    T(c2, p.title, x + 6, y + 1, 10, K.text, 'left', w - 12);
    T(c2, p.statusLabel + (p.status === 'meeting' ? `（あと${p.left}日）` : ''), x + 6, y + 13, 9, p.status === 'reported' ? K.amber : p.status === 'meeting' ? K.cyan : K.dim, 'left', w - 12);
  }, { empty: 'まだ会議を開いていない' });
  panel(c, 4, 238, 250, 98, '政策の後ろ盾', { accent: '#7aa8ff' });
  let yy = 258;
  for (const b of d.backing.slice(0, 5)) { T(c, `${b.name}：強さ ${Math.round(b.strength * 100)}%・あと${b.left}日`, 10, yy, 10, K.text, 'left', 240); yy += 12; }
  if (!d.backing.length) para(c, '採用した報告書は、関連分野の規制・予算の行動を通しやすくする（150日）。', 10, yy, 240, 10, K.dim, 12, 4);
  const p = d.panels[clamp(num(st.prow), 0, Math.max(0, d.panels.length - 1))];
  panel(c, 258, 64, 378, 246, p ? p.title : '会議の詳細', { accent: '#7aa8ff', right: p ? p.statusLabel : '' });
  if (!p) {
    para(c, '有識者会議は、総理や大臣が専門家に意見を聞く私的な会議（法律にもとづく審議会とはちがう）。報告書は政策の後ろ盾になる。\n・人選を中立にすると、報告書は信頼される。\n・人選を寄せると思いどおりの報告書になりやすいが、露見すると「御用学者」と批判され、有識者の信頼を失う。\n・報告書を棚上げすると、有識者の不満が高まる。', 264, 86, 366, 11, K.text, 14, 12);
  } else {
    T(c, `座長：${p.chair.name}　${p.chair.side < 0 ? '分配・保護を重視' : p.chair.side > 0 ? '市場・成長を重視' : '中立'}`, 264, 84, 10, K.dim, 'left', 366);
    T(c, `委員：${p.members.map((m) => `${m.name}（${m.aff}）`).slice(0, 3).join('、')} ほか${Math.max(0, p.members.length - 3)}人`, 264, 97, 10, K.dim, 'left', 366);
    T(c, `信頼性 ${p.cred}${p.exposed ? '（人選が批判された）' : p.tilt ? '（人選を寄せた：露見の恐れ）' : ''}`, 264, 110, 10, p.exposed ? K.bad : p.tilt ? K.warn : K.good, 'left', 366);
    if (p.report) {
      T(c, p.axis[0], 264, 126, 9, K.dim); T(c, p.axis[1], 630, 126, 9, K.dim, 'right');
      cbar(c, 264, 138, 366, 7, p.report.lean / 2, K.cyan, K.pink);
      T(c, p.report.headline, 264, 152, 11, K.white, 'left', 366);
      let y2 = 168;
      for (const b of p.report.bullets.slice(0, 3)) { y2 = para(c, `・${b}`, 264, y2, 366, 10, K.text, 12, 2); }
      para(c, `（${p.report.dissent}）`, 264, y2 + 2, 366, 10, K.dim, 12, 2);
      if (p.answered) T(c, `採否：${{ adopt: '採用', partial: '一部採用', publish: '公表のみ', shelve: '棚上げ' }[p.answered.key] || ''}`, 264, 290, 10, K.amber);
    } else {
      para(c, `報告書は あと${p.left}日ほどで出る。出たら「報告書の採否を決める」で、採用・一部採用・公表のみ・棚上げを選ぶ。`, 264, 130, 366, 11, K.dim, 14, 4);
    }
  }
  drawBtn(c, ui, ui.ctls.find((q) => q.id === 'pconv'), { center: true, color: '#7aa8ff' });
  drawBtn(c, ui, ui.ctls.find((q) => q.id === 'pans'), { center: true, color: '#ffb547' });
}
function drawTimeline(c, ui, d, kit) {
  const { K, T, panel, drawList, spark, drawBtn } = kit;
  const st = ui.tabState();
  panel(c, 4, 64, 380, 272, '各界のニュース', { right: '新しい順' });
  const nk = ui.ctls.find((q) => q.id === 'nrow');
  if (nk) drawList(c, ui, nk, (c2, i, x, y, w) => {
    const n = d.news[i];
    const col = n.domain && DOMAINS[n.domain] ? DOMAINS[n.domain].color : K.faint;
    c2.fillStyle = col; c2.fillRect(x + 4, y + 3, 3, 9);
    T(c2, dayLabel(ui.g, n.day).replace(/^\d+年/, ''), x + 11, y + 3, 9, K.faint, 'left', 54);
    T(c2, n.text, x + 66, y + 2, 10, K.text, 'left', w - 72);
  }, { empty: 'まだニュースはない' });
  panel(c, 388, 64, 248, 196, '分野ごとの支持の推移（月ごと）');
  const hk = ui.ctls.find((q) => q.id === 'hrow');
  if (hk) drawList(c, ui, hk, (c2, i, x, y, w) => {
    const dm = d.sum.domains[i];
    c2.fillStyle = dm.color; c2.fillRect(x + 4, y + 4, 3, 9);
    T(c2, dm.name, x + 10, y + 3, 10, st.dom === dm.id ? K.white : K.text, 'left', 68);
    spark(c2, dm.hist.length >= 2 ? dm.hist : [dm.avg, dm.avg], x + 82, y + 2, 100, 12, dm.color, { min: -50, max: 50, ref: 0 });
    T(c2, `${dm.avg > 0 ? '+' : ''}${dm.avg}`, x + w - 6, y + 4, 10, supCol(dm.avg, K), 'right');
  });
  panel(c, 388, 264, 248, 50, `制度：${DOMAINS[st.dom].name}`, {});
  let iy = 282;
  for (const inst of d.inst.slice(-3)) { T(c, `${inst.when} ${inst.text}`, 393, iy, 9, K.dim, 'left', 240); iy += 10; }
  if (!d.inst.length) T(c, '（この分野の制度の記録はまだない）', 393, iy, 9, K.faint, 'left', 240);
  drawBtn(c, ui, ui.ctls.find((q) => q.id === 'terms'), { center: true });
}
export function tabDraw(c, ui, d, kit) {
  const st = stOf(ui);
  kit.drawSegs(c, ui, SUBS);
  kit.T(c, `${d.role.label}・${d.role.short}`, 636, 47, 10, kit.K.dim, 'right', 160);
  if (st.sub === 'overview') drawOverview(c, ui, d, kit);
  else if (st.sub === 'groups') drawGroups(c, ui, d, kit);
  else if (st.sub === 'cases') drawCases(c, ui, d, kit);
  else if (st.sub === 'tourism') drawTourism(c, ui, d, kit);
  else if (st.sub === 'panels') drawPanels(c, ui, d, kit);
  else drawTimeline(c, ui, d, kit);
  // the first tip, once the player stays on the tab
  if (!st.tipSent && ui.t - num(st.tipT, ui.t) > 45 && ui.modals.length === 0) { st.tipSent = true; tip(ui.g, st.sub === 'tourism' ? 'groups_tourism' : st.sub === 'panels' ? 'groups_panels' : 'groups_open'); }
}

// ================================================================ the phone app 「各界」
const APP_COLOR = '#2a8a7a';
const eraDev = (g) => { const e = g.state && g.state.profile && g.state.profile.era; return e === 'reiwa' ? 'smart' : e === 'heisei' ? 'keitai' : 'techo'; };
const appTitle = (g) => (eraDev(g) === 'techo' ? '手帳の「各界」ページ' : '各界');
const cut = (s, n) => { const a = Array.from(String(s ?? '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
const pct = (o) => `${Math.round(num(o) * 100)}%`;
async function pInfo(g, title, lines) { await phoneInfo(g, { title, color: APP_COLOR, lines }); }
async function pDetailAndConfirm(g, title, detail, ask = '実行する？', yes = '実行する') {
  await pInfo(g, title, detail);
  const k = await phoneConfirm(g, { title, color: APP_COLOR, text: ask, choices: [yes, 'やめる'] });
  return k === 0;
}
async function pAction(g, id, kind) {
  let pv = g.groupActionPreview(id, kind);
  if (!pv.ok) return;
  let opt = null;
  if (pv.options && pv.options.length) {
    const items = pv.options.map((o) => { const p = g.groupActionPreview(id, kind, o.key); return { label: cut(o.label, 20), sub: p.why ? `🔒 ${cut(p.why, 20)}` : `${p.costText}${p.odds != null ? `・見込み${pct(p.odds)}` : ''}`, disabled: !!p.why }; });
    const j = await phoneList(g, { title: pv.name, color: APP_COLOR, items });
    if (j < 0) return;
    opt = pv.options[j].key;
    pv = g.groupActionPreview(id, kind, opt);
  }
  if (pv.why) { await pInfo(g, pv.name, ['いまはできない：', pv.why]); return; }
  const lines = [pv.desc, '', `費用：${pv.costText}`, pv.odds != null ? `【成功の見込み】${pct(pv.odds)}` : '', pv.win.length ? `成功すると：${pv.win.slice(0, 3).join('・')}` : '', pv.lose.length ? `失敗すると：${pv.lose.slice(0, 3).join('・')}` : '', ...pv.lines.map((l) => `※${l}`), pv.pro[0] ? `賛成の声：${pv.pro[0]}` : '', pv.con[0] ? `反対の声：${pv.con[0]}` : ''].filter((x) => x !== '' || true);
  if (!(await pDetailAndConfirm(g, pv.name, lines))) return;
  const r = await g.groupAct(id, kind, { option: opt });
  await pInfo(g, pv.name, r && r.ok ? String(r.text).split('\n') : ['できなかった：', (r && r.why) || '']);
}
async function pGroup(g, id) {
  let index = 0;
  for (let guard = 0; guard < 30; guard++) {
    const v = g.group(id);
    if (!v) return;
    const acts = g.groupActions(id);
    const items = [{ label: '様子を見る', sub: `支持${v.support}・影響力${v.influence}・不満${v.anger}` }, ...acts.map((a) => ({ label: cut(a.name, 16), sub: a.why ? `🔒 ${cut(a.why, 22)}` : `${cut(a.costText, 14)}${a.odds != null ? `・${pct(a.odds)}` : ''}`, disabled: !!a.why }))];
    const i = await phoneList(g, { title: cut(v.name, 14), color: APP_COLOR, items, index, describe: (k) => (k === 0 ? v.kind : acts[k - 1] ? acts[k - 1].desc : '') });
    if (i < 0) return;
    index = i;
    if (i === 0) {
      await pInfo(g, v.name, [v.kind, '', `支持：${v.support}（${v.supportLabel}）`, `影響力：${v.influence}（${v.influenceLabel}）`, `不満：${v.anger}（${v.angerLabel}）`, `献金・協力の力：${v.capacityLabel}`, `政権への態度：${v.govSupport}`, '', ...v.leaders.map((l) => `${l.title}・${l.name}（${l.personaName}）：${l.personaDesc}`), '', ...v.grievances.slice(0, 3).map((e) => `不満：${e.text}`), v.radical != null ? `過激化：${v.radicalKnown ? `${v.radical}／100` : '不明（公安調査で分かる）'}` : '', '', `賛成の声：${v.pro[0] || '—'}`, `反対の声：${v.con[0] || '—'}`].filter((x) => x !== null));
    } else await pAction(g, id, acts[i - 1].id);
  }
}
async function pCase(g, c0) {
  const c = g.groupCases().find((x) => x.id === c0.id);
  if (!c) return;
  const items = c.options.map((o) => ({ label: cut(o.label, 20), sub: o.why ? `🔒 ${cut(o.why, 20)}` : `${o.costText}${o.odds != null ? `・見込み${pct(o.odds)}` : ''}`, disabled: !!o.why }));
  const i = await phoneList(g, { title: cut(c.title, 14), color: APP_COLOR, items, describe: (k) => (c.options[k] ? c.options[k].desc : '') });
  if (i < 0) return;
  const o = c.options[i];
  if (o.why) { await pInfo(g, c.title, ['いまはできない：', o.why]); return; }
  const lines = [c.text, '', o.label, o.desc || '', `費用：${o.costText}`, o.odds != null ? `【成功の見込み】${pct(o.odds)}` : '', o.lines.length ? `変化の見込み：${o.lines.slice(0, 4).join('・')}` : ''];
  if (!(await pDetailAndConfirm(g, c.title, lines, 'この答えにする？', 'この答えにする'))) return;
  const r = await g.groupCaseAnswer(c.id, o.key);
  await pInfo(g, c.title, r && r.ok ? [r.text, ...(r.lines || [])] : ['できなかった：', (r && r.why) || '']);
}
async function pTourism(g) {
  let index = 0;
  for (let guard = 0; guard < 20; guard++) {
    const t = g.tourism();
    const items = [{ label: '概況', sub: `訪日客 年${t.inboundMan}万人・指定${t.sites}か所` }, ...t.siteList.map((s) => ({ label: cut(s.name, 14), sub: `${s.kindName}・${s.vis}千人/月・混雑${s.crowd}` })), ...t.candList.map((s) => ({ label: `候補：${cut(s.name, 11)}`, sub: `${s.kindName}・魅力${'★'.repeat(s.stars)}` }))];
    const i = await phoneList(g, { title: '観光地', color: APP_COLOR, items, index });
    if (i < 0) return;
    index = i;
    if (i === 0) { await pInfo(g, '観光地の概況', [`${t.agency}（${t.brand}）`, `訪日外国人 年${t.inboundMan}万人（目安）`, `指定観光地 ${t.sites}か所（自分の指定 ${t.mine}）`, `入込の収入 月${t.income}億円・混雑 ${t.over}か所`, t.law || '', t.resort || t.overNote || ''].filter(Boolean)); continue; }
    const s = i - 1 < t.siteList.length ? t.siteList[i - 1] : t.candList[i - 1 - t.siteList.length];
    const acts = g.siteActions(s.id);
    const its = acts.map((a) => ({ label: cut(a.name, 16), sub: a.why ? `🔒 ${cut(a.why, 22)}` : `${a.costText}${a.odds != null ? `・${pct(a.odds)}` : ''}`, disabled: !!a.why }));
    const j = await phoneList(g, { title: cut(s.name, 12), color: APP_COLOR, items: [{ label: '様子を見る', sub: `${s.kindName}・${s.regionName}` }, ...its] });
    if (j < 0) continue;
    if (j === 0) { await pInfo(g, s.name, [`${s.kindName}（${s.regionName}）`, `魅力 ${'★'.repeat(s.stars)}`, s.status === 'candidate' ? `地元の賛成 ${s.local}・指定の費用 ${GR.fmtOku(s.cost)}` : `入込 ${s.vis}千人/月・外国人 ${Math.round(s.fr * 100)}%`, s.status === 'candidate' ? '' : `収入 ${s.inc}億円/月・満足度 ${s.sat}・混雑 ${s.crowd}`, s.status === 'candidate' ? '' : `地元支持 ${s.local}・整備 ${s.infra}・宣伝力 ${s.promo}・環境 ${s.env}`, s.whl.stage === 'inscribed' ? '世界遺産に登録済み' : ''].filter(Boolean)); continue; }
    let pv = acts[j - 1];
    let opt = null;
    if (pv.why) { await pInfo(g, pv.name, ['いまはできない：', pv.why]); continue; }
    if (pv.options && pv.options.length) {
      const o2 = pv.options.map((o) => ({ label: cut(o.label, 22), sub: g.siteActionPreview(s.id, pv.id, o.key).costText }));
      const q = await phoneList(g, { title: pv.name, color: APP_COLOR, items: o2 });
      if (q < 0) continue;
      opt = pv.options[q].key;
      pv = g.siteActionPreview(s.id, pv.id, opt);
    }
    if (!(await pDetailAndConfirm(g, pv.name, [pv.desc, `費用：${pv.costText}`, pv.odds != null ? `【成功の見込み】${pct(pv.odds)}` : '', ...pv.lines.map((l) => `※${l}`), pv.pro[0] ? `賛成の声：${pv.pro[0]}` : '', pv.con[0] ? `反対の声：${pv.con[0]}` : ''].filter(Boolean)))) continue;
    const r = g.siteAct(s.id, pv.id, { option: opt });
    await pInfo(g, pv.name, r && r.ok ? [r.text] : ['できなかった：', (r && r.why) || '']);
  }
}
async function pPanels(g) {
  let index = 0;
  for (let guard = 0; guard < 20; guard++) {
    const ps = g.panels();
    const items = [{ label: '会議を開く', sub: '総理・官房長官・大臣・首長' }, ...ps.map((p) => ({ label: cut(p.title, 16), sub: p.statusLabel }))];
    const i = await phoneList(g, { title: '有識者会議', color: APP_COLOR, items, index });
    if (i < 0) return;
    index = i;
    if (i === 0) {
      const th = g.panelThemes();
      const t = await phoneList(g, { title: 'テーマを選ぶ', color: APP_COLOR, items: th.map((x) => ({ label: x.name, sub: x.why ? `🔒 ${cut(x.why, 22)}` : cut(`${x.axis[0]}⇔${x.axis[1]}`, 24), disabled: !!x.why })) });
      if (t < 0) continue;
      if (th[t].why) { await pInfo(g, '有識者会議', ['いまは開けない：', th[t].why]); continue; }
      const ch = await phoneList(g, { title: '座長を選ぶ', color: APP_COLOR, items: [{ label: '分配・保護を重視' }, { label: '中立' }, { label: '市場・成長を重視' }], index: 1 });
      if (ch < 0) continue;
      const tl = await phoneList(g, { title: '人選', color: APP_COLOR, items: [{ label: '中立にする', sub: '信頼性が高い' }, { label: '少し寄せる', sub: '露見すると批判' }, { label: 'かなり寄せる', sub: '結論ありきと批判されやすい' }] });
      if (tl < 0) continue;
      let want = 0;
      if (tl > 0) { const w = await phoneList(g, { title: 'どちらに寄せる？', color: APP_COLOR, items: [{ label: cut(th[t].axis[0], 18) }, { label: cut(th[t].axis[1], 18) }], index: 1 }); if (w < 0) continue; want = w === 0 ? -1 : 1; }
      const o = { chair: ch - 1, tilt: tl, want };
      const pv = g.panelPreview(th[t].id, o);
      if (!(await pDetailAndConfirm(g, th[t].name, [...pv.lines, `費用：${pv.costText}`, `賛成の声：${pv.pro[0]}`, `反対の声：${pv.con[0]}`], '会議を開く？', '会議を開く'))) continue;
      const r = g.panelConvene(th[t].id, o);
      await pInfo(g, '有識者会議', [r.ok ? r.text : `できなかった：${r.why}`]);
    } else {
      const p = ps[i - 1];
      if (p.status !== 'reported') { await pInfo(g, p.title, [p.statusLabel, `座長：${p.chair.name}`, `信頼性 ${p.cred}`, p.report ? p.report.headline : `報告書はあと${p.left}日ほど`, ...(p.report ? p.report.bullets.map((b) => `・${b}`) : [])]); continue; }
      const pv = g.panelAnswerPreview(p.id);
      const k = await phoneList(g, { title: cut(p.title, 14), color: APP_COLOR, items: pv.options.map((o) => ({ label: o.label, sub: cut(o.desc, 22) })), describe: (j) => (pv.options[j] ? pv.options[j].desc : '') });
      if (k < 0) continue;
      const r = g.panelAnswer(p.id, pv.options[k].key);
      await pInfo(g, '報告書の採否', r && r.ok ? [r.text, ...(r.lines || [])] : [r.why]);
    }
  }
}
async function pBids(g) {
  let index = 0;
  for (let guard = 0; guard < 20; guard++) {
    const sm = g.bids();
    const items = [...sm.active.map((b) => ({ label: cut(b.name, 16), sub: `${b.statusLabel}・${b.status === 'declared' ? `見込み${pct(b.odds)}` : `開幕まで${b.leftEvent}日`}`, bid: b })), ...sm.types.map((t) => { const p = g.bidPreview(t.type); return { label: `誘致：${cut(t.name, 12)}`, sub: p.why ? `🔒 ${cut(p.why, 20)}` : `${p.totalText}・見込み${pct(p.odds)}`, disabled: !!p.why, type: t.type }; })];
    const i = await phoneList(g, { title: '大会の誘致', color: APP_COLOR, items, index, describe: () => `${sm.agency}` });
    if (i < 0) return;
    index = i;
    const it = items[i];
    if (it.type) {
      const pv = g.bidPreview(it.type);
      if (pv.why) { await pInfo(g, pv.name, ['いまはできない：', pv.why]); continue; }
      if (!(await pDetailAndConfirm(g, pv.name, [...pv.lines, `表明の費用：${pv.costText}`, `【誘致の見込み】${pct(pv.odds)}`, `賛成の声：${pv.pro[0]}`, `反対の声：${pv.con[0]}`], '誘致を表明する？', '表明する'))) continue;
      const r = g.bidDeclare(it.type);
      await pInfo(g, pv.name, [r.ok ? r.text : `できなかった：${r.why}`]);
    } else {
      const b = it.bid;
      const q = await phoneList(g, { title: cut(b.name, 14), color: APP_COLOR, items: [...(b.status === 'declared' ? [{ label: '招致活動を進める', sub: g.bidCampaignPreview(b.id).costText }] : []), { label: '取り下げる', sub: '反発を招く' }] });
      if (q < 0) continue;
      const camp = b.status === 'declared' && q === 0;
      const r = camp ? g.bidCampaign(b.id) : g.bidWithdraw(b.id);
      await pInfo(g, b.name, [r.ok ? r.text : `できなかった：${r.why}`]);
    }
  }
}
async function groupsApp(g) {
  let index = 0;
  for (let guard = 0; guard < 80; guard++) {
    const sm = g.groups();
    const cases = g.groupCases();
    const items = [
      { id: 'over', label: '概況', sub: `${sm.date}・${sm.role.label}`, right: '' },
      { id: 'cases', label: '要望・案件', sub: cases.length ? `${cases.length}件（${cases[0] ? cut(cases[0].title, 12) : ''}）` : 'いまはない', right: sm.due ? `●${sm.due}` : '', rightColor: PC.bad },
      { id: 'dom', label: '分野ごとの団体', sub: '会談・補助・規制・圧力・懐柔…' },
      { id: 'tour', label: '観光地', sub: '指定・整備・宣伝・混雑対策' },
      { id: 'panels', label: '有識者会議', sub: '会議を開く・報告書の採否' },
      { id: 'bids', label: '大会の誘致', sub: '五輪・万博・W杯・国スポ' },
      { id: 'news', label: '各界のニュース', sub: sm.news[0] ? cut(sm.news[0].text, 16) : '' },
      { id: 'screen', label: 'くわしい画面を開く', sub: '政府中枢の「各界」タブ' },
    ];
    const i = await phoneList(g, { title: appTitle(g), color: APP_COLOR, items, index, describe: (k) => (items[k].id === 'over' ? sm.advice[0] || '' : '') });
    if (i < 0) return;
    index = i;
    const id = items[i].id;
    if (id === 'over') {
      await pInfo(g, '概況', [`${sm.date}　あなた：${sm.role.label}`, `案件 ${sm.cases}件（期限が近い ${sm.due}件）`, `各界の評価のはたらき ${sm.ap > 0 ? '+' : ''}${sm.ap}`, `癒着の疑い ${sm.corr}／100`, sm.fiscal.text, '', ...sm.domains.map((d) => `${d.name}：${d.avg > 0 ? '+' : ''}${d.avg}（${d.label}）`), '', ...sm.advice.map((a) => `・${a}`)]);
    } else if (id === 'cases') {
      if (!cases.length) { await pInfo(g, '要望・案件', ['いま対応が必要な案件はない。', '団体と会談すると要望が出されることもある。']); continue; }
      const k = await phoneList(g, { title: '要望・案件', color: APP_COLOR, items: cases.map((c) => ({ label: cut(c.title, 16), sub: `${cut(c.groupName, 10)}・${c.left <= 0 ? '今日' : `あと${c.left}日`}`, right: c.left <= 5 ? '!' : '', rightColor: PC.bad })) });
      if (k >= 0) await pCase(g, cases[k]);
    } else if (id === 'dom') {
      let di = 0;
      for (let q = 0; q < 20; q++) {
        const doms = g.groupDomains();
        const d2 = await phoneList(g, { title: '分野', color: APP_COLOR, items: doms.map((d) => ({ label: d.name, sub: `${d.n}団体・${d.label}`, right: d.cases ? `${d.cases}件` : '', rightColor: d.due ? PC.bad : PC.dim })), index: di });
        if (d2 < 0) break;
        di = d2;
        const list = g.groupList(doms[d2].id);
        const g2 = await phoneList(g, { title: doms[d2].name, color: APP_COLOR, items: list.map((x) => ({ label: cut(x.name, 14), sub: `支持${x.support}・影響${x.influence}・不満${x.anger}` })) });
        if (g2 >= 0) await pGroup(g, list[g2].id);
      }
    } else if (id === 'tour') await pTourism(g);
    else if (id === 'panels') await pPanels(g);
    else if (id === 'bids') await pBids(g);
    else if (id === 'news') await pInfo(g, '各界のニュース', sm.news.length ? sm.news.slice(0, 12).map((n) => `・${n.text}`) : ['まだニュースはない。']);
    else if (id === 'screen') { if (g.auto && !g.auto.govtui) continue; await openGroups(g, {}); }
  }
}
function drawIcon(c, x, y) {
  appTile(c, x, y, '#1c5a50');
  const heads = [[16, 11, 4, '#ffffff'], [8, 14, 3, '#bfe8dc'], [24, 14, 3, '#bfe8dc']];
  for (const [hx, hy, r, col] of heads) { c.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); c.fillRect(x + hx - w, y + hy + dy, w * 2 + 1, 1); } }
  c.fillStyle = '#ffffff'; c.fillRect(x + 9, y + 17, 14, 7);
  c.fillStyle = '#bfe8dc'; c.fillRect(x + 3, y + 19, 9, 5); c.fillRect(x + 20, y + 19, 9, 5);
}
registerPhoneApp('groups', {
  name: '各界', color: APP_COLOR, order: 66,
  iconHD(c, x, y) { drawIcon(c, x, y); },
  icon(c, x, y) { c.fillStyle = '#1c5a50'; c.fillRect(x + 1, y + 1, 22, 22); c.fillStyle = '#ffffff'; c.fillRect(x + 9, y + 5, 6, 6); c.fillRect(x + 6, y + 12, 12, 7); },
  badge: (g) => { try { const r = g.groupsRole(); const cs = g.groupCases({ options: false }); if (r.kind === 'citizen') return Math.min(9, cs.filter((c) => c.kind.startsWith('offer')).length); return Math.min(9, cs.filter((c) => c.left <= 7).length); } catch (e) { return 0; } },
  cond: (g) => has(g, 'groups'),
  open: (g) => groupsApp(g),
});
if (typeof window !== 'undefined') window.__groupsui = { SUBS, actionFlow, openGroups, TIPS };
