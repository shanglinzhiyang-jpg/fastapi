// 求人 (手帳: 求人誌 / ケータイ: 求人サイト / スマホ: バイトアプリ) and 動画・配信.
//
// 求人: one shift a day of a part-time job (日払い・単発) to get by while the stage pays little: the
// day's listings (5 from the pool, fixed for the day), each with its 日給, 体力 and ストレス; some are
// weekends only, outdoor ones stop in bad weather (g.weather), some teach a little (a comedy stat or a
// skill, now and then) and some leave you an episode — a ネタの種 note in the メモ app. The NSC's own
// student job counts as the day's shift. Pay ≈ ¥100 per 体力 (like the game's other part-time jobs).
// Era jobs: レンタルビデオ店 (to 2015), ネットカフェ (2000〜), フードデリバリー (2016-09〜, Uber Eats Tokyo),
// スキマバイト (2018-08〜, the first app of the kind).
//
// 動画・配信: 手帳の時代 = 投稿ビデオ (a home-video tape mailed to a TV program's 投稿コーナー, one a
// week; the result comes by mail 5–9 days later: 採用 → 謝礼, a little fame and fans). From 2006 (動画
// 共有サイト: YouTube 2005-12, ニコニコ動画 2006-12): post a video once a day (ネタ動画 with your
// script — g.netaQuality, or played through g.perform —, 歌ってみた, 日常, 体を張った企画, ものまね,
// スマホ: ショート動画); views come in over three mornings; a few become 登録者 and fans; sometimes a
// video goes viral (ドッター / the era's SNS) or 炎上 (fans and fame lost, stress). Live streams from
// 2007-12 (ニコニコ生放送), 投げ銭 from 2017-01. Ad revenue from 1,000 登録者 (2008〜). Daily caps: one
// video, one stream.

import { fmtMoney, clamp, shade } from './util.js';
import { SKILLS, SKILL_MAX } from './state.js';
import { audio } from './audio.js';
import { weekdayOf, WEEKDAYS, PHONE_APPS } from './life.js';
import { eraOf } from './profile.js';
import { phoneView, phoneList, phoneInfo, phoneConfirm, closePhoneThen, phoneOverMapOnly } from './phone.js';
import { panelView, rowsList, lifeBlock } from './phone_apps.js';
import {
  num, isObj, arr, str, has, safe, R, disc, art, devOf, dateOf, ymOf, part, definePart, rnd, gaussR, commas, pct, hm,
  weatherNow, badWeather, clockNow, passMinutes, addMemo, chip, bar, buttons, hit, T, fitText, PC, box, rrect, para,
} from './phone_apps3_kit.js';

export const JOB_COLOR = '#d07a1a';
export const VIDEO_COLOR = '#d0304a';
export const kyujinTitle = (g) => ({ techo: '求人誌', keitai: '求人', smart: 'バイト' })[devOf(g)];

// ======================================================================== 求人
// pay (internal yen) / stamina / stress / hunger / clean; perk: [statKey|skill:<id>, chance]; seed: chance of a ネタの種
export const BAITO = {
  hikkoshi: { name: '引越しの手伝い', where: '引越し会社', pay: 3600, hours: 5, stamina: 35, stress: 6, hunger: -14, clean: -14, seed: 0.2, lines: ['冷蔵庫を3階まで運んだ。階段がやけに長い。', '段ボールの中身は全部、まんがだった。'] },
  izakaya: { name: '居酒屋のホール', where: '居酒屋', pay: 2800, hours: 4, stamina: 25, stress: 8, hunger: 18, clean: -8, perk: ['wagei', 0.25], seed: 0.3, night: true, lines: ['「とりあえず生」が20回続いた。まかないのから揚げがうまい。', '団体さんの乾杯の音頭を、なぜか頼まれた。'] },
  kotsu: { name: '交通量調査', where: '大通りの交差点', pay: 2400, hours: 6, stamina: 12, stress: 12, hunger: -8, clean: -4, outdoor: true, seed: 0.25, lines: ['カウンターを押し続けた。車、車、自転車、車…。', '同じ人が3回通った。何をしているんだろう。'] },
  tissue: { name: 'ティッシュ配り', where: '駅前', pay: 1800, hours: 3, stamina: 15, stress: 6, hunger: -6, clean: -4, outdoor: true, perk: ['dokyo', 0.25], seed: 0.2, lines: ['笑顔で差し出すコツが、少しわかった。', '受け取ってくれた人に、心の中で拍手した。'] },
  event: { name: 'イベント設営・撤去', where: 'イベント会場', pay: 3200, hours: 5, stamina: 30, stress: 5, hunger: -12, clean: -10, seed: 0.15, lines: ['ステージを組んで、終わったらばらした。客席からの景色が見えた。', '音響さんの「チェック、ワン、ツー」がかっこよかった。'] },
  shiken: { name: '試験監督', where: '大学の教室', pay: 2000, hours: 4, stamina: 10, stress: 8, hunger: -6, clean: 0, weekend: true, seed: 0.1, lines: ['静かな教室で、時計の音だけが聞こえた。', '「残り10分です」を、いい声で言えた。'] },
  kigurumi: { name: '着ぐるみショー', where: '遊園地', pay: 2800, hours: 3, stamina: 28, stress: 4, hunger: -10, clean: -14, weekend: true, perk: ['chara', 0.25], seed: 0.3, lines: ['中は蒸し風呂。でも子どもたちが手をふってくれた。', '着ぐるみのまま転んだら、いちばんウケた。'] },
  extra: { name: 'エキストラ（ドラマ）', where: '撮影現場', pay: 1800, hours: 5, stamina: 15, stress: 4, hunger: -8, clean: -4, perk: ['skill:engi', 0.3], seed: 0.25, lines: ['通行人Aとして、同じ道を12回歩いた。', '主役の後ろで、自然にコーヒーを飲む演技をした。'] },
  shishoku: { name: '試食販売', where: 'スーパー', pay: 2400, hours: 4, stamina: 18, stress: 6, hunger: 6, clean: -4, perk: ['wagei', 0.3], seed: 0.25, lines: ['ウインナーを焼き続けた。最後は売り切れた！', '「おいしいですよ〜」の言い方を、10種類ためした。'] },
  soko: { name: '倉庫の仕分け', where: '物流倉庫', pay: 3000, hours: 5, stamina: 28, stress: 6, hunger: -12, clean: -8, seed: 0.1, lines: ['段ボールを、地域ごとに仕分けた。腕がパンパン。', '休憩室の自販機が、やけに安かった。'] },
  sarai: { name: '洗い場（皿洗い）', where: 'レストランの厨房', pay: 2400, hours: 4, stamina: 22, stress: 5, hunger: 20, clean: -8, seed: 0.15, lines: ['お皿の山を片づけた。まかないのナポリタンがうまい。', '料理長の怒鳴り声が、なぜかリズミカルだった。'] },
  teleapo: { name: 'テレアポ', where: 'コールセンター', pay: 2600, hours: 4, stamina: 10, stress: 14, hunger: -6, clean: 0, from: 199001, perk: ['voice', 0.2], seed: 0.25, lines: ['100件かけて、話を聞いてくれたのは3件。', '「お忙しいところ…」を、200回は言った。'] },
  konbini: { name: 'コンビニの夜勤', where: 'コンビニ', pay: 3800, hours: 6, stamina: 35, stress: 8, hunger: -10, clean: -10, night: true, seed: 0.3, lines: ['深夜3時、お客さんは常連のおじさんだけ。', '品出しと揚げ物とレジ。夜のコンビニは忙しい。'] },
  video: { name: 'レンタルビデオ店', where: 'ビデオ店', pay: 2200, hours: 4, stamina: 12, stress: 3, hunger: -6, clean: -2, to: 201512, seed: 0.3, lines: ['返却されたテープを、棚に戻し続けた。', 'お客さんのおすすめを聞いて、話がはずんだ。'] },
  netcafe: { name: 'ネットカフェの受付', where: 'ネットカフェ', pay: 2600, hours: 5, stamina: 18, stress: 5, hunger: -8, clean: -4, from: 200001, night: true, seed: 0.2, lines: ['深夜のフリードリンクを補充した。', 'まんがの棚を整頓しながら、つい1冊読んだ。'] },
  delivery: { name: 'フードデリバリーの配達', where: '自転車で街中', pay: 2600, hours: 3, stamina: 25, stress: 6, hunger: -12, clean: -8, from: 201609, outdoor: true, variable: true, seed: 0.25, lines: ['坂道の多いエリアで、脚がぱんぱん。', 'チップの通知が来て、思わずガッツポーズ。'] },
  sukima: { name: 'スキマバイト（倉庫）', where: '物流倉庫', pay: 2400, hours: 3, stamina: 20, stress: 5, hunger: -8, clean: -6, from: 201808, smartOnly: true, seed: 0.1, lines: ['アプリで応募して、その日のうちに働いた。', 'はじめての現場でも、すぐに慣れた。'] },
};
export const BAITO_IDS = Object.keys(BAITO);
definePart('job', (s) => ({
  day: Math.floor(num(s.day)), shifts: Math.max(0, Math.floor(num(s.shifts))), earned: Math.max(0, Math.round(num(s.earned))),
  by: isObj(s.by) ? Object.fromEntries(Object.entries(s.by).filter(([k]) => BAITO[k]).map(([k, v]) => [k, Math.max(0, Math.floor(num(v)))])) : {},
  perkWeek: Math.floor(num(s.perkWeek)), perks: Math.max(0, Math.floor(num(s.perks))),
}));
function baitoOpen(g, id) {
  const J = BAITO[id], ym = ymOf(g);
  if (J.from && ym < J.from) return false;
  if (J.to && ym > J.to) return false;
  if (J.smartOnly && devOf(g) !== 'smart') return false;
  return true;
}
// the day's listings (5, fixed for the day)
export function baitoToday(g) {
  const day = g.state.day;
  const ids = BAITO_IDS.filter((id) => baitoOpen(g, id)).sort((a, b) => rnd(g, 'baito', day, a) - rnd(g, 'baito', day, b));
  return ids.slice(0, 5);
}
// Why the shift `id` cannot be taken now (null = OK)
export function baitoWhy(g, id) {
  const J = BAITO[id];
  const st = g.state;
  const P = part(g, 'job');
  const lb = lifeBlock(g);
  if (lb) return lb;
  if (P.day === st.day) return '今日はもうバイトに入った。';
  const ow = has(g, 'owarai') ? safe(() => g.owarai(), null) : null;
  if (ow && isObj(ow.daily) && ow.daily.day === st.day && num(ow.daily.counts && ow.daily.counts.baito) >= 1) return '今日はもうNSCのバイトに入った。';
  if (J.weekend && weekdayOf(st.day) < 5) return '土日だけの募集。';
  const w = weatherNow(g);
  if (J.outdoor && w && (w.id === 'rain' || badWeather(w))) return `${w.label}のため中止。`;
  const why = has(g, 'lifeRefusal') ? safe(() => g.lifeRefusal(), null) : null;
  if (why) return [].concat(why).join('\n');
  if (st.stamina < J.stamina) return `体力が足りない（体力${J.stamina}）。`;
  return null;
}
// Work one shift (no UI). → { ok, why?, pay, lines, perk, seed }
export function doShift(g, id) {
  const J = BAITO[id];
  if (!J) return { ok: false, why: 'その募集はない。' };
  const why = baitoWhy(g, id);
  if (why) return { ok: false, why };
  const st = g.state, P = part(g, 'job'), day = st.day;
  P.day = day; P.shifts++; P.by[id] = num(P.by[id]) + 1;
  st.stamina -= J.stamina;
  g.lifeTick({ stress: J.stress, hunger: J.hunger, clean: J.clean });
  let pay = J.pay;
  if (J.variable) pay = Math.round((J.pay * (0.6 + 0.8 * rnd(g, 'tip', day))) / 10) * 10; // 歩合
  g.addMoney(pay, true);
  P.earned += pay;
  passMinutes(g, J.hours * 60, `バイト（${J.name}）`);
  const lines = [J.lines[Math.floor(rnd(g, 'line', day) * J.lines.length)]];
  let perk = null;
  const week = Math.floor((day - 1) / 7);
  if (P.perkWeek !== week) { P.perkWeek = week; P.perks = 0; }
  if (J.perk && P.perks < 2 && rnd(g, 'perk', day) < J.perk[1]) {
    const [k] = J.perk;
    if (k.startsWith('skill:')) { const sk = k.slice(6); if (SKILLS[sk]) { g.addSkill(sk, 1, true); perk = `${SKILLS[sk]} +1`; } }
    else if (has(g, 'addComedyStat')) { const before = num(safe(() => g.comedyStat(k), 0)); const after = num(safe(() => g.addComedyStat(k, 1, true), before)); if (after > before) perk = `${({ wagei: '話芸', dokyo: '度胸', chara: 'キャラ・華', voice: '声量・滑舌' })[k] || k} +${Math.round(after - before)}`; }
    if (perk) P.perks++;
  }
  let seed = null;
  if (rnd(g, 'seed', day) < (J.seed || 0)) seed = addMemo(g, { title: `${J.name}でのこと`, text: `${J.name}（${dateOf(g).month}月）\n${lines[0]}\n→ エピソードトークに使えるかも。`, tag: 'seed' });
  return { ok: true, pay, lines, perk, seed };
}
export async function kyujinApp(g) {
  const P = part(g, 'job');
  const dv = devOf(g);
  const items = () => baitoToday(g).map((id) => {
    const J = BAITO[id];
    const why = baitoWhy(g, id);
    const tags = [J.weekend ? '土日' : null, J.outdoor ? '屋外' : null, J.night ? '夜' : null, J.variable ? '歩合' : null].filter(Boolean).join('・');
    return { id, label: J.name, sub: `体力-${J.stamina}・ストレス+${J.stress}${tags ? `・${tags}` : ''}`, right: `${J.variable ? '約' : ''}${fmtMoney(J.pay)}`, disabled: !!why, why, rightColor: why ? PC.dim : JOB_COLOR };
  });
  return phoneView(g, panelView(g, {
    title: kyujinTitle(g), color: JOB_COLOR, top: 40, rowH: 38,
    hint: 'A:応募する　B:もどる',
    items,
    drawTop(c, a) {
      R(c, a.x, a.y, a.w, a.h, dv === 'techo' ? '#f6eccc' : '#fff4e6');
      const head = dv === 'techo' ? '今週のアルバイト情報（日払い・単発）' : dv === 'keitai' ? '今日の単発・日払いバイト' : '今日すぐ働けるバイト';
      T(c, fitText(c, head, a.w - 16, 12), a.x + 8, a.y + 4, 12, PC.text);
      T(c, fitText(c, `${WEEKDAYS[weekdayOf(g.state.day)]}曜・${P.day === g.state.day ? '今日は勤務ずみ' : '1日1回まで'}・これまで${P.shifts}回 ${fmtMoney(P.earned)}`, a.w - 16, 12), a.x + 8, a.y + 20, 12, PC.dim);
      R(c, a.x, a.y + a.h - 1, a.w, 1, '#c8c0ac');
    },
    pick: (ph, it, i, v) => ph.run(v, async () => {
      const J = BAITO[it.id];
      const clk = clockNow(g);
      const k = await phoneConfirm(g, { title: J.name, color: JOB_COLOR, text: `${J.where}\n日給 ${J.variable ? '約' : ''}${fmtMoney(J.pay)}${clk ? `（${J.hours}時間）` : ''}\n体力 -${J.stamina}・ストレス +${J.stress}${J.hunger > 0 ? '・まかない付き' : ''}`, choices: ['働く', 'やめておく'] });
      if (k !== 0) return;
      const r = doShift(g, it.id);
      if (!r.ok) { audio.sfx('buzz'); await phoneInfo(g, { title: J.name, color: JOB_COLOR, text: r.why }); return; }
      audio.sfx('coin');
      await phoneInfo(g, { title: 'おつかれさま！', color: JOB_COLOR, lines: [r.lines[0], '', `日給 ${fmtMoney(r.pay)}（所持金 ${fmtMoney(g.state.money)}）`, r.perk ? `ちょっと成長した：${r.perk}` : null, r.seed ? 'ネタの種をメモした（メモ）' : null].filter((s) => s != null) });
    }),
  }));
}

// ======================================================================== 動画・配信
export const videoOpen = (g) => devOf(g) === 'techo' || ymOf(g) >= 200601;
export const liveOpen = (g) => devOf(g) !== 'techo' && ymOf(g) >= 200712;
const tipsOpen = (g) => ymOf(g) >= 201701;
const adsOpen = (g) => ymOf(g) >= 200801;
export const videoTitle = (g) => (devOf(g) === 'techo' ? '投稿ビデオ' : devOf(g) === 'keitai' ? '動画' : '動画配信');
const TAPE_SHOW = '『びっくり！投稿ビデオ大賞』';
definePart('video', (s, day) => ({
  subs: Math.max(0, Math.floor(num(s.subs))), views: Math.max(0, Math.floor(num(s.views))), earned: Math.max(0, Math.round(num(s.earned))), tips: Math.max(0, Math.round(num(s.tips))),
  posts: arr(s.posts).filter(isObj).slice(0, 20).map((p) => ({
    id: Math.floor(num(p.id)), day: Math.floor(num(p.day, day)), kind: str(p.kind, 12), title: str(p.title, 30), q: clamp(Math.round(num(p.q)), 0, 100),
    total: Math.max(0, Math.round(num(p.total))), got: Math.max(0, Math.round(num(p.got))), step: clamp(Math.floor(num(p.step)), 0, 3),
    subs: Math.max(0, Math.round(num(p.subs))), fans: Math.round(num(p.fans)), fansAll: Math.round(num(p.fansAll)), subsAll: Math.max(0, Math.round(num(p.subsAll))), money: Math.max(0, Math.round(num(p.money))), buzz: !!p.buzz, flame: !!p.flame, live: !!p.live,
  })),
  nextId: Math.max(1, Math.floor(num(s.nextId, 1))), lastPost: Math.floor(num(s.lastPost)), lastLive: Math.floor(num(s.lastLive)),
  tapes: arr(s.tapes).filter(isObj).slice(0, 6).map((t) => ({ id: Math.floor(num(t.id)), day: Math.floor(num(t.day, day)), due: Math.floor(num(t.due, day + 7)), q: clamp(Math.round(num(t.q)), 0, 100), title: str(t.title, 30), kind: str(t.kind, 12) })),
  lastTape: Math.floor(num(s.lastTape, -99)), aired: Math.max(0, Math.floor(num(s.aired))),
  flameUntil: Math.floor(num(s.flameUntil)), flames: Math.max(0, Math.floor(num(s.flames))), buzzes: Math.max(0, Math.floor(num(s.buzzes))),
}));
const stat = (g, k) => (has(g, 'comedyStat') ? num(safe(() => g.comedyStat(k), 0)) : 0);
const skill = (g, k) => (num(g.state.skills && g.state.skills[k]) / SKILL_MAX) * 100;
// the kinds of video: q(g, o) → base quality; stamina; risk (炎上)
export const VIDEO_KINDS = {
  neta: { name: 'ネタ動画', stamina: 15, risk: 0.004, q: (g, o) => (o.score != null ? o.score : o.neta && has(g, 'netaQuality') ? num(safe(() => g.netaQuality(o.neta), 40)) : 35), cond: (g) => (has(g, 'netaList') ? (safe(() => g.netaList(), []) || []).length > 0 : false), why: 'ネタ帳に台本がない（ネタ帳で書こう）' },
  uta: { name: '歌ってみた', stamina: 12, risk: 0.004, q: (g) => 15 + skill(g, 'uta') * 0.75, from: 200701 },
  vlog: { name: (g) => (devOf(g) === 'smart' ? '日常Vlog' : '日常の動画'), stamina: 10, risk: 0.006, q: (g) => 18 + skill(g, 'talk') * 0.45 + num(g.state.life && g.state.life.clean) * 0.15 },
  kikaku: { name: '体を張った企画', stamina: 25, risk: 0.05, q: (g) => 30 + stat(g, 'dokyo') * 0.35 + skill(g, 'warai') * 0.25 },
  mane: { name: 'ものまね', stamina: 12, risk: 0.012, q: (g) => 15 + stat(g, 'mane') * 0.7 },
  short: { name: 'ショート動画', stamina: 6, risk: 0.01, q: (g) => 22 + stat(g, 'hassou') * 0.35 + skill(g, 'warai') * 0.2, smart: true, short: true },
};
const kindName = (g, k) => { const K = VIDEO_KINDS[k]; return typeof K.name === 'function' ? K.name(g) : K.name; };
const audience = (g) => { const ym = ymOf(g); return ym < 201001 ? 0.4 : ym < 201601 ? 0.7 : 1; };
const flaming = (g) => part(g, 'video').flameUntil >= g.state.day;
// the expected views of a plain video (before quality and luck): fans, fame, 登録者 (square roots: no runaway)
export function viewBase(g) {
  const st = g.state, V = part(g, 'video');
  return (40 + 15 * Math.sqrt(V.subs) + num(st.fans) * 0.25 + num(st.fame) * 0.8) * audience(g);
}
function snsName(g) { const e = eraOf(g.state); return e.snsShort || e.sns || 'SNS'; }
// Why a video cannot be posted now
export function videoWhy(g, kind) {
  const V = part(g, 'video'), st = g.state, K = VIDEO_KINDS[kind];
  const lb = lifeBlock(g);
  if (lb) return lb;
  if (!K) return 'その動画はつくれない。';
  if (devOf(g) === 'techo') return 'この時代は、ビデオテープを番組に送る（投稿ビデオ）。';
  if (ymOf(g) < 200601) return 'まだ動画を投稿できるサイトがない。';
  if (K.smart && devOf(g) !== 'smart') return 'スマホの時代の動画。';
  if (K.from && ymOf(g) < K.from) return 'まだそういう動画はない。';
  if (K.cond && !K.cond(g)) return K.why;
  if (V.lastPost === st.day) return '今日はもう投稿した（1日1本）。';
  if (num(st.life && st.life.stress) >= 100) return 'ストレスが限界で、撮る気力がない…';
  if (st.stamina < K.stamina) return `体力が足りない（体力${K.stamina}）。`;
  return null;
}
// Post a video (no UI). o: { neta, score (a performance's score), title } → { ok, post, first (views today) }
export function postVideo(g, kind, o = {}) {
  const why = videoWhy(g, kind);
  if (why) return { ok: false, why };
  const st = g.state, V = part(g, 'video'), K = VIDEO_KINDS[kind], day = st.day;
  st.stamina -= K.stamina;
  g.lifeTick({ stress: 3, hunger: -5 });
  V.lastPost = day;
  passMinutes(g, K.short ? 40 : 120, '動画の撮影と編集');
  const id = V.nextId++;
  const q = clamp(Math.round(K.q(g, o) + 8 * gaussR(g, 'vq', id)), 0, 100);
  const base = viewBase(g);
  const luck = Math.exp(0.6 * gaussR(g, 'vluck', id));
  const buzzP = 0.01 + q / 2500;
  const buzz = rnd(g, 'vbuzz', id) < buzzP;
  let total = base * (0.25 + (q / 55) ** 2) * luck * (buzz ? 6 + 9 * rnd(g, 'vbuzzx', id) : 1) * (K.short ? 2.2 : 1) * (flaming(g) ? 0.6 : 1);
  total = Math.max(3, Math.round(total));
  const flame = rnd(g, 'vflame', id) < K.risk * (flaming(g) ? 0.5 : 1);
  const title = str(o.title || (o.neta && o.neta.title) || kindName(g, kind), 30);
  // fans and 登録者 grow with the square root of the views (no runaway): ≈ a daily SNS post for a good video
  const fanCap = (60 + Math.sqrt(Math.max(0, num(st.fans))) * 4) * (buzz ? 2 : 1);
  const fansAll = Math.min(Math.round(fanCap), Math.round(2 * Math.sqrt(total) * (0.4 + q / 80) * (K.short ? 0.6 : 1)));
  const subsAll = Math.round(total * (0.01 + q / 4000) * (K.short ? 0.5 : 1));
  const P = { id, day, kind, title, q, total, got: 0, step: 0, subs: 0, fans: 0, money: 0, buzz, flame, live: false, fansAll, subsAll };
  V.posts.unshift(P);
  if (V.posts.length > 20) V.posts.length = 20;
  const first = deliver(g, P);
  if (buzz) {
    V.buzzes++;
    const fame = Math.min(30, Math.round(5 + total / 5000));
    g.addFame(fame, true);
    g.message({ from: `${snsName(g)}の話題`, kind: 'fan', text: `「${title}」の動画が${snsName(g)}で話題になっている！（再生${commas(total)}回の見こみ・知名度+${fame}）` });
  }
  if (flame) flameOn(g, title);
  return { ok: true, post: P, first };
}
// views arrive over three mornings: 50% / 30% / 20%; subscribers, fans and ad money with them
function deliver(g, P) {
  const share = [0.5, 0.3, 0.2][P.step];
  if (share == null) return 0;
  const V = part(g, 'video'), st = g.state;
  const views = P.step === 2 ? P.total - P.got : Math.round(P.total * share);
  P.got += views; P.step++;
  V.views += views;
  const last = P.step === 3;
  const subs = last ? num(P.subsAll) - P.subs : Math.round(num(P.subsAll) * share);
  V.subs += subs; P.subs += subs;
  const fans = last ? num(P.fansAll) - P.fans : Math.round(num(P.fansAll) * share);
  if (fans) { g.addFans(fans, true); P.fans += fans; }
  if (adsOpen(g) && V.subs >= 1000) { const yen = Math.round(views * 0.15); if (yen) { g.addMoney(yen, true); P.money += yen; V.earned += yen; } }
  return views;
}
function flameOn(g, title) {
  const V = part(g, 'video'), st = g.state;
  V.flameUntil = st.day + 3; V.flames++;
  const lost = Math.round(num(st.fans) * (0.02 + 0.03 * rnd(g, 'flamefans', st.day)));
  const fame = Math.min(40, Math.round(num(st.fame) * 0.03));
  g.addFans(-lost, true);
  if (fame) g.addFame(-fame, true);
  g.addNeed('stress', 20);
  V.subs = Math.max(0, V.subs - Math.round(V.subs * 0.03));
  g.message({ from: 'ドットネットニュース', kind: 'news', text: `芸人の${st.name}さんの「${title}」に批判が集まり、いわゆる“炎上”状態に。コメント欄には厳しい声が並んでいる。（ファン−${commas(lost)}人${fame ? `・知名度−${fame}` : ''}）` });
  return { lost, fame };
}
// ライブ配信 (no UI) → { ok, viewers, tips, fans, stress, flame, comments }
export const LIVE_KINDS = {
  zatsudan: { name: '雑談配信', stat: 'adlib', skill: 'talk' },
  neta: { name: 'ネタ披露', stat: 'boke', skill: 'warai' },
  uta: { name: '歌配信', stat: 'voice', skill: 'uta' },
  game: { name: 'ゲーム実況', stat: 'adlib', skill: 'talk', from: 200801 },
};
export function liveWhy(g) {
  const V = part(g, 'video'), st = g.state;
  const lb = lifeBlock(g);
  if (lb) return lb;
  if (!liveOpen(g)) return 'まだライブ配信はない（2007年12月から）。';
  if (V.lastLive === st.day) return '今日はもう配信した（1日1回）。';
  if (num(st.life && st.life.stress) >= 100) return 'ストレスが限界…';
  if (st.stamina < 15) return '体力が足りない（体力15）。';
  return null;
}
export function goLive(g, kind = 'zatsudan') {
  const why = liveWhy(g);
  if (why) return { ok: false, why };
  const st = g.state, V = part(g, 'video'), L = LIVE_KINDS[kind] || LIVE_KINDS.zatsudan, day = st.day;
  st.stamina -= 15;
  V.lastLive = day;
  passMinutes(g, 60, 'ライブ配信');
  const w = weatherNow(g);
  const viewers = Math.max(1, Math.round((15 + 2 * Math.sqrt(V.subs) + 1.5 * Math.sqrt(Math.max(0, num(st.fans))) + num(st.fame) * 0.05) * audience(g) * Math.exp(0.4 * gaussR(g, 'lv', day)) * (w && w.id !== 'sunny' && w.id !== 'cloudy' ? 1.15 : 1) * (flaming(g) ? 1.3 : 1)));
  const skillV = (stat(g, L.stat) + skill(g, L.skill)) / 2;
  const tips = tipsOpen(g) ? Math.round(viewers * (2 + 18 * rnd(g, 'tips', day)) * (0.6 + skillV / 100)) : 0;
  const fans = Math.min(30 + Math.round(Math.sqrt(Math.max(0, num(st.fans))) * 2), Math.round(1.2 * Math.sqrt(viewers) * (0.5 + skillV / 100)));
  const troll = rnd(g, 'troll', day) < 0.25;
  const flame = rnd(g, 'lflame', day) < Math.max(0, 0.025 - stat(g, 'adlib') / 2000) + (flaming(g) ? 0.03 : 0);
  if (tips) { g.addMoney(tips, true); V.tips += tips; }
  if (fans) g.addFans(fans, true);
  const stress = troll ? 10 : -8;
  g.addNeed('stress', stress);
  g.lifeTick({ hunger: -6 });
  V.subs += Math.round(viewers * 0.03);
  const P = { id: V.nextId++, day, kind: 'live', title: L.name, q: Math.round(skillV), total: viewers, got: viewers, step: 3, subs: Math.round(viewers * 0.03), fans, money: tips, buzz: false, flame, live: true };
  V.posts.unshift(P);
  if (V.posts.length > 20) V.posts.length = 20;
  let fl = null;
  if (flame) fl = flameOn(g, `${L.name}での発言`);
  return { ok: true, viewers, tips, fans, stress, troll, flame, flameLost: fl, comments: liveComments(g, kind, troll, flame) };
}
function liveComments(g, kind, troll, flame) {
  const old = ymOf(g) < 201501;
  const pool = old ? ['わこつ', 'wwww', '8888888', 'こんばんは〜', 'おもろいwww', 'もう一回！', '声いいね', 'うぽつ'] : ['初見です', '草', 'こんばんは〜', '声すき', '神回', '切り抜きから来ました', 'もう一回やって', '8888'];
  if (kind === 'uta') pool.push(old ? 'うまいwww' : '歌うますぎ', 'アンコール！');
  if (kind === 'game') pool.push('そこ右！', 'うまっ');
  const out = [];
  for (let i = 0; i < 8; i++) out.push(pool[Math.floor(rnd(g, 'cm', g.state.day, i) * pool.length)]);
  if (troll) out.splice(4, 0, 'つまらん', '声ちいさい');
  if (flame) out.push('それはさすがにアウト', '切り抜かれるぞ…');
  return out;
}
// 投稿ビデオ (the 手帳 eras): mail a tape; the program answers 5–9 days later
const TAPE_COST = 1500;
export function tapeWhy(g) {
  const V = part(g, 'video'), st = g.state;
  const lb = lifeBlock(g);
  if (lb) return lb;
  if (st.day - V.lastTape < 7) return `テープを送るのは週に1本まで（あと${7 - (st.day - V.lastTape)}日）。`;
  if (st.money < TAPE_COST) return `お金が足りない（テープ代・送料 ${fmtMoney(TAPE_COST)}）。`;
  if (st.stamina < 15) return '体力が足りない（体力15）。';
  return null;
}
export function sendTape(g, kind, o = {}) {
  const why = tapeWhy(g);
  if (why) return { ok: false, why };
  const st = g.state, V = part(g, 'video');
  const K = VIDEO_KINDS[kind] || VIDEO_KINDS.vlog;
  g.spend(TAPE_COST);
  st.stamina -= 15;
  g.lifeTick({ stress: 2, hunger: -4 });
  V.lastTape = st.day;
  passMinutes(g, 90, 'ビデオの撮影');
  const id = V.nextId++;
  const q = clamp(Math.round(K.q(g, o) + 8 * gaussR(g, 'tq', id)), 0, 100);
  const t = { id, day: st.day, due: st.day + 5 + Math.floor(rnd(g, 'tdue', id) * 5), q, title: str(o.title || (o.neta && o.neta.title) || kindName(g, kind), 30), kind };
  V.tapes.push(t);
  return { ok: true, tape: t };
}
export function videoMorning(g) {
  const V = part(g, 'video'), st = g.state;
  for (const P of V.posts) if (!P.live && P.step < 3 && P.day < st.day) deliver(g, P);
  for (const t of V.tapes.slice()) {
    if (t.due > st.day) continue;
    V.tapes.splice(V.tapes.indexOf(t), 1);
    const p = 0.1 + t.q / 250;
    if (rnd(g, 'tape', t.id) < p) {
      const grand = rnd(g, 'grand', t.id) < 0.05 + t.q / 1000;
      const pay = grand ? 50000 : 10000, fame = grand ? 30 : 6 + Math.round(t.q / 12), fans = grand ? 600 : 80 + t.q * 2;
      g.addMoney(pay, true); g.addFame(fame, true); g.addFans(fans, true);
      V.aired++; V.earned += pay;
      g.message({ from: `${TAPE_SHOW}係`, kind: 'fan', text: `お送りいただいたビデオ「${t.title}」が${grand ? '今月の大賞に選ばれました！' : '番組で紹介されました！'}\n謝礼${fmtMoney(pay)}をお送りします。（知名度+${fame}・ファン+${fans}）` });
    } else g.message({ from: `${TAPE_SHOW}係`, kind: 'chat', text: `ビデオ「${t.title}」をお送りいただき、ありがとうございました。今回は残念ながら不採用でした。またのご応募をお待ちしています。` });
  }
}

// ---------------------------------------------------------------- the app
function drawVideoTop(c, a, g) {
  const V = part(g, 'video');
  const dv = devOf(g);
  R(c, a.x, a.y, a.w, a.h, dv === 'techo' ? '#f2ead0' : '#1e1e28');
  if (dv === 'techo') {
    // a VHS tape
    R(c, a.x + 8, a.y + 6, 44, 26, '#20202a'); R(c, a.x + 12, a.y + 10, 36, 10, '#f0f0e8'); disc(c, a.x + 20, a.y + 26, 3, '#5a5a66'); disc(c, a.x + 40, a.y + 26, 3, '#5a5a66');
    T(c, fitText(c, `${TAPE_SHOW}に応募`, a.w - 70, 12), a.x + 60, a.y + 6, 12, PC.text);
    T(c, `紹介${V.aired}回・審査待ち${V.tapes.length}本`, a.x + 60, a.y + 22, 12, PC.dim);
  } else {
    const fl = flaming(g);
    T(c, `登録者 ${commas(V.subs)}人`, a.x + 8, a.y + 4, 12, '#ffffff');
    T(c, `総再生 ${commas(V.views)}回`, a.x + a.w - 8, a.y + 4, 12, '#c8c8d8', 'right');
    const money = adsOpen(g) ? (V.subs >= 1000 ? `広告収入 ${fmtMoney(V.earned)}${V.tips ? `・投げ銭 ${fmtMoney(V.tips)}` : ''}` : `収益化まで 登録者${commas(1000 - V.subs)}人`) : '';
    T(c, fitText(c, fl ? `炎上中（あと${V.flameUntil - g.state.day + 1}日）` : money || 'まずは1本アップしよう', a.w - 16, 12), a.x + 8, a.y + 20, 12, fl ? '#ff8a8a' : '#f0d878');
  }
  R(c, a.x, a.y + a.h - 1, a.w, 1, '#c8c0ac');
}
export async function videoApp(g) {
  const V = part(g, 'video');
  const techo = devOf(g) === 'techo';
  const items = () => {
    const rows = [];
    if (techo) {
      const why = tapeWhy(g);
      rows.push({ id: 'tape', label: 'ビデオを撮って送る', sub: why || `テープ代・送料 ${fmtMoney(TAPE_COST)}・体力-15`, chip: ['応募', VIDEO_COLOR], disabled: !!why, why });
      for (const t of V.tapes) rows.push({ id: 'info', label: t.title, sub: `${t.day}日目に送った・審査中`, right: '…' });
    } else {
      const why = lifeBlock(g) || (V.lastPost === g.state.day ? '今日はもう投稿した（1日1本）。' : null);
      rows.push({ id: 'post', label: '動画を撮ってアップ', sub: why || '1日1本', chip: ['投稿', VIDEO_COLOR], disabled: !!why, why });
      if (liveOpen(g)) { const lw = liveWhy(g); rows.push({ id: 'live', label: 'ライブ配信する', sub: lw || `体力-15${tipsOpen(g) ? '・投げ銭あり' : ''}`, chip: ['LIVE', '#c02060'], disabled: !!lw, why: lw }); }
    }
    for (const P of V.posts.slice(0, 10)) rows.push({ id: 'info', P, label: `${P.live ? '【配信】' : ''}${P.title}`, sub: `${P.day}日目・${P.live ? `同接${commas(P.total)}人` : `再生${commas(P.got)}回${P.step < 3 ? '（のびている）' : ''}`}${P.fans ? `・ファン+${commas(P.fans)}` : ''}`, right: P.buzz ? '話題' : P.flame ? '炎上' : `${P.q}点`, rightColor: P.flame ? PC.bad : P.buzz ? '#d07a1a' : PC.dim });
    rows.push({ id: 'help', label: 'しくみ' });
    return rows;
  };
  return phoneView(g, panelView(g, {
    title: videoTitle(g), color: VIDEO_COLOR, top: 38, rowH: 38,
    items, drawTop: (c, a) => drawVideoTop(c, a, g),
    pick: (ph, it, i, v) => ph.run(v, async () => {
      if (it.id === 'tape') await tapeFlow(g);
      else if (it.id === 'post') { const done = await postFlow(g); if (done === 'left') ph.back(-1); }
      else if (it.id === 'live') await liveFlow(g);
      else if (it.id === 'help') await phoneInfo(g, { title: 'しくみ', color: VIDEO_COLOR, lines: videoHelp(g) });
      else if (it.P) await phoneInfo(g, { title: it.P.title, color: VIDEO_COLOR, lines: [`${it.P.day}日目`, it.P.live ? `同時接続 ${commas(it.P.total)}人` : `再生 ${commas(it.P.got)}回（見こみ ${commas(it.P.total)}回）`, `できばえ ${it.P.q}点`, `登録者 +${commas(it.P.subs)}・ファン +${commas(it.P.fans)}`, it.P.money ? `収益 ${fmtMoney(it.P.money)}` : null, it.P.buzz ? `${snsName(g)}で話題になった。` : null, it.P.flame ? '炎上してしまった…' : null].filter(Boolean) });
    }),
  }));
}
function videoHelp(g) {
  if (devOf(g) === 'techo') return [
    'ホームビデオで撮ったテープを、テレビ番組の投稿コーナーに送る。',
    '採用されると番組で紹介されて、謝礼が届く。大賞なら、もっと。',
    'テープは週に1本まで。結果は1週間ほどで郵便で届く。',
    'ネタの仕上がりや、芸の力が高いほど採用されやすい。',
  ];
  return [
    '動画は1日1本。再生は3日かけてのびる。',
    'できばえ（ネタの仕上がり・歌・トーク・度胸など）が高いほど再生がのび、登録者やファンがふえる。',
    `たまに${snsName(g)}で話題になる（知名度アップ）。`,
    '体を張った企画は再生がのびやすいが、炎上しやすい。炎上するとファンと知名度がへり、ストレスがたまる。',
    adsOpen(g) ? '登録者1,000人から広告収入が入る。' : '',
    liveOpen(g) ? `ライブ配信は1日1回。${tipsOpen(g) ? '投げ銭がもらえることも。' : ''}アドリブ力が低いと失言しやすい。` : '',
  ].filter(Boolean);
}
async function chooseKind(g, title) {
  const kinds = Object.keys(VIDEO_KINDS).filter((k) => !(VIDEO_KINDS[k].smart && devOf(g) !== 'smart') && !(VIDEO_KINDS[k].from && ymOf(g) < VIDEO_KINDS[k].from));
  const why = (k) => (devOf(g) === 'techo' ? (VIDEO_KINDS[k].cond && !VIDEO_KINDS[k].cond(g) ? VIDEO_KINDS[k].why : null) : videoWhy(g, k));
  const k = await rowsList(g, { title, color: VIDEO_COLOR, items: kinds.map((id) => ({ label: kindName(g, id), sub: why(id) || `体力-${devOf(g) === 'techo' ? 15 : VIDEO_KINDS[id].stamina}${VIDEO_KINDS[id].risk >= 0.03 ? '・炎上注意' : ''}`, disabled: !!why(id), why: why(id) })) });
  return k < 0 ? null : kinds[k];
}
async function pickScript(g) {
  const list = has(g, 'netaList') ? safe(() => g.netaList(), []) || [] : [];
  if (!list.length) return null;
  const k = await rowsList(g, { title: 'どのネタ？', color: VIDEO_COLOR, items: list.slice(0, 20).map((n) => ({ label: n.title || '無題', sub: `仕上がり${num(n.practice)}${has(g, 'netaQuality') ? `・できばえ目安${num(safe(() => g.netaQuality(n), 0))}` : ''}` })) });
  return k < 0 ? null : list[k];
}
async function tapeFlow(g) {
  const kind = await chooseKind(g, '何を撮る？');
  if (!kind) return;
  const neta = kind === 'neta' ? await pickScript(g) : null;
  if (kind === 'neta' && !neta) return;
  const r = sendTape(g, kind, { neta });
  if (!r.ok) { audio.sfx('buzz'); await phoneInfo(g, { title: '投稿ビデオ', color: VIDEO_COLOR, text: r.why }); return; }
  audio.sfx('ok');
  await phoneInfo(g, { title: '送った！', color: VIDEO_COLOR, lines: [`「${r.tape.title}」を撮って、${TAPE_SHOW}あてに郵便で送った。`, '結果は1週間ほどで届く。'] });
}
// → 'left' when the phone was put away (a performance in front of the camera)
async function postFlow(g) {
  const kind = await chooseKind(g, 'どんな動画？');
  if (!kind) return null;
  let neta = null;
  if (kind === 'neta') {
    neta = await pickScript(g);
    if (!neta) return null;
    if (has(g, 'perform') && phoneOverMapOnly(g)) {
      const how = await phoneConfirm(g, { title: '撮影', color: VIDEO_COLOR, text: `「${neta.title || '無題'}」を撮る。\nカメラの前で実際にやる？`, choices: ['ちゃんと撮る（実演）', 'いつもどおり撮る', 'やめる'] });
      if (how === 2 || how < 0) return null;
      if (how === 0) {
        const pre = videoWhy(g, kind);
        if (pre) { await phoneInfo(g, { title: '動画', color: VIDEO_COLOR, text: pre }); return null; }
        closePhoneThen(g, async (gg) => {
          const res = await safe(() => gg.perform({ kind: neta.kind, neta, practice: true, title: '動画の撮影', venue: { name: '自宅（撮影）', size: 'small', crowd: 'normal', pressure: 15 } }), null);
          const score = res && Number.isFinite(Number(res.score)) ? Number(res.score) : null;
          const r = postVideo(gg, 'neta', { neta, score: score != null ? Math.round(0.5 * score + 0.5 * num(safe(() => gg.netaQuality(neta), 40))) : null });
          if (!r.ok) { await gg.say(r.why); return; }
          await gg.say([`撮った動画をアップした。「${r.post.title}」`, `できばえ ${r.post.q}点・今日の再生 ${commas(r.first)}回${r.post.buzz ? `\n${snsName(gg)}で話題になりはじめた！` : ''}${r.post.flame ? '\n…コメント欄が荒れている。' : ''}`]);
        });
        return 'left';
      }
    }
  }
  const r = postVideo(g, kind, { neta });
  if (!r.ok) { audio.sfx('buzz'); await phoneInfo(g, { title: '動画', color: VIDEO_COLOR, text: r.why }); return null; }
  await uploadView(g, r);
  return 'posted';
}
// an upload bar, then the first day's numbers
function uploadView(g, r) {
  return phoneView(g, {
    title: 'アップロード', color: VIDEO_COLOR, cancel: true, bg: '#1e1e28',
    hint: 'A/B:とじる',
    update(ph, inp) { if (this.t > 50 && (inp.pressed('a') || inp.pressed('b'))) { audio.sfx('cancel'); ph.back(true); } if (this.t === 50) audio.sfx(r.post.buzz ? 'fanfare' : r.post.flame ? 'buzz' : 'good'); },
    draw(c, ph, a) {
      const k = clamp(this.t / 50, 0, 1);
      R(c, a.x + 12, a.y + 14, a.w - 24, 110, '#000000');
      disc(c, a.x + a.w / 2, a.y + 68, 16, '#ffffff');
      for (let i = 0; i < 12; i++) R(c, a.x + a.w / 2 - 5 + i, a.y + 62 + i / 2, 1, 12 - i, VIDEO_COLOR);
      T(c, fitText(c, r.post.title, a.w - 24, 14), a.x + 12, a.y + 130, 14, '#ffffff');
      bar(c, a.x + 12, a.y + 152, a.w - 24, 6, k, VIDEO_COLOR, '#3a3a48');
      if (k < 1) { T(c, 'アップロード中…', a.x + 12, a.y + 164, 12, '#c8c8d8'); return; }
      const lines = [`できばえ ${r.post.q}点`, `今日の再生 ${commas(r.first)}回（あと2日のびる）`, r.post.buzz ? `${snsName(g)}で話題に！` : null, r.post.flame ? 'コメント欄が荒れている…（炎上）' : null].filter(Boolean);
      lines.forEach((l, i) => T(c, l, a.x + 12, a.y + 164 + i * 16, 12, i === 2 && r.post.buzz ? '#f0d878' : l.includes('炎上') ? '#ff8a8a' : '#ffffff'));
    },
  });
}
async function liveFlow(g) {
  const ids = Object.keys(LIVE_KINDS).filter((k) => !(LIVE_KINDS[k].from && ymOf(g) < LIVE_KINDS[k].from));
  const k = await rowsList(g, { title: '何を配信する？', color: VIDEO_COLOR, items: ids.map((id) => ({ label: LIVE_KINDS[id].name })) });
  if (k < 0) return;
  const r = goLive(g, ids[k]);
  if (!r.ok) { audio.sfx('buzz'); await phoneInfo(g, { title: 'ライブ配信', color: VIDEO_COLOR, text: r.why }); return; }
  await phoneView(g, {
    title: LIVE_KINDS[ids[k]].name, color: '#c02060', cancel: true, bg: '#14141c',
    hint: 'A/B:配信をおえる',
    update(ph, inp) { if (this.t > 30 && (inp.pressed('a') || inp.pressed('b'))) { audio.sfx('cancel'); ph.back(true); } },
    draw(c, ph, a) {
      const t = this.t;
      R(c, a.x + 8, a.y + 6, a.w - 16, 96, '#000000');
      chip(c, 'LIVE', a.x + 14, a.y + 10, '#e0203a');
      const shown = Math.round(r.viewers * clamp(t / 90, 0, 1));
      T(c, `${commas(shown)}人が視聴中`, a.x + a.w - 14, a.y + 12, 12, '#ffffff', 'right');
      disc(c, a.x + a.w / 2, a.y + 60, 18, '#f2c8a0'); R(c, a.x + a.w / 2 - 18, a.y + 40, 36, 10, '#3a2a20');
      if (Math.floor(t / 10) % 2) R(c, a.x + a.w / 2 - 6, a.y + 70, 12, 3, '#a03030');
      const n = Math.min(r.comments.length, Math.floor(t / 14));
      const vis = r.comments.slice(Math.max(0, n - 6), n);
      vis.forEach((s, i) => T(c, fitText(c, s, a.w - 24, 12), a.x + 12, a.y + 108 + i * 15, 12, /アウト|つまらん|ちいさい|切り抜かれる/.test(s) ? '#ff9a9a' : '#e8e8f0'));
      if (t > 100) {
        const lines = [`最大 ${commas(r.viewers)}人`, r.tips ? `投げ銭 ${fmtMoney(r.tips)}` : null, `ファン +${commas(r.fans)}・ストレス ${r.stress > 0 ? '+' : ''}${r.stress}`, r.flame ? '発言が切り抜かれて炎上…' : null].filter(Boolean);
        R(c, a.x + 8, a.y + a.h - 6 - lines.length * 15, a.w - 16, lines.length * 15 + 4, '#2a2a3a');
        lines.forEach((l, i) => T(c, l, a.x + 14, a.y + a.h - 4 - lines.length * 15 + i * 15, 12, l.includes('炎上') ? '#ff8a8a' : '#f0d878'));
      }
    },
  });
}
