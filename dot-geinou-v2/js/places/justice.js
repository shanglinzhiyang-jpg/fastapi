// 司法の場所（justice places）— 警視庁・検察庁・裁判所・刑務所
//
//   keisatsu 警視庁       lobby 1階ロビー（総合受付・遺失物・自首）／ sodan 相談室（生活安全課：闇金・ストーカー・詐欺）／
//                         torishirabe 取調室 ／ ryuchi 留置場
//   kensatsu 検察庁       lobby 1階ロビー（受付・被害者支援員）／ kenjishitsu 検事室（取調べ・処分の告知）／
//                         tokuso 特捜部のフロア（政治とお金・脱税の独自捜査）
//   saibansho 裁判所      lobby 1階ロビー（開廷表・傍聴の案内・最高裁の見学）／ chisai 地方裁判所 刑事法廷（傍聴できる）／
//                         saibanin 裁判員法廷（2009年5月～）／ kousai 高等裁判所 法廷（控訴審）／ kouryu 勾留質問室／
//                         minji 民事・破産のフロア（破産係の窓口・少額訴訟のラウンドテーブル）／ shinjin 審尋室（破産・個人再生）／
//                         daihotei 最高裁判所 大法廷（見学）／ shohotei 最高裁判所 小法廷（上告審）
//   keimusho 刑務所（町にはない。司法の流れで来る）
//                         mon 正門・面会受付（入所・出所・作業製品の販売）／ kyoshitsu 居室（共同室）／ kojo 工場（刑務作業）／
//                         undojo 運動場 ／ kyoiku 教室（改善指導・教科指導）／ menkai 面会室 ／ shinri 面接室（仮釈放の審理）／
//                         kochi 拘置所の単独室（起訴後の勾留）
//
// How the justice core (js/engine/crime.js) uses these rooms
//   The core's Flow teleports to JUSTICE_PLACES[inst].place / .rooms[stage] when the place exists. Both are
//   getters here, keyed only by the documented state (g.jus(): custody, cases, prison, bankrupt, status), so a
//   flow lands in the right room: a political case's 検察 stage → 特捜部, a trial → 地裁 / 裁判員法廷 / 高裁 /
//   最高裁 小法廷, 勾留質問 → 勾留質問室, a bankruptcy → 審尋室, a parole hearing → 刑務所の面接室, 起訴後の勾留
//   → 拘置所の単独室, a prison event day → 工場 / 運動場 / 教室 / 居室. Stages with no fitting room (少年鑑別所・家庭裁判所・
//   少年院, a detained 上告審, a 交番 elsewhere) return place null and stay HD overlays.
//   Rooms show the right people while a flow is in them (judges, 裁判員, the player's lawyer, family in the gallery,
//   刑務官 escorts …) and room.onEnter adds short place-side scenes that the core does not have: 入所 (称呼番号),
//   刑務作業 (a small skill / stress loop), 改善指導, extra 面会 from friends, 裁判員 / 録音録画 / 上告審 notes.
//   Free visitors can 傍聴 fictional trials (the full order of a criminal trial, compressed), consult the police
//   (闇金・ストーカー・詐欺 with era-aware advice), turn themselves in (自首: an undetected offence → g.arrest), hand in
//   lost property (遺失物法), file for bankruptcy at the 破産係 (g.fileBankruptcy), watch a small claim, and tour the
//   Supreme Court's 大法廷.
//
// Everyone here is fictional (no real judges, prosecutors, police officers, lawyers or cases). Procedures follow the
// law of the game's date (crime.js lawDate): 裁判員 2009-05, 録音・録画 2019-06, 拘禁刑 2025-06, 受刑者の「さん」付け
// 2024-04, 受刑者処遇法 2006-05, 遺失物法 2007-12, ストーカー規制法 2000-11 / 2017-06, 振り込め詐欺救済法 2008-06,
// 消費者ホットライン 2010-01 (188: 2015-07), 少額訴訟 1998-01 (60万円: 2004-04).
// Sources checked (2026-10, WebSearch): bengo4.com n_17216（さん付け 2024年4月）; internet.watch.impress.co.jp 2007/12/10,
//   pref.tottori.lg.jp 69314（遺失物法 3か月・報労金）; npa.go.jp stalker/kaisei（2017年6月14日 警告を経ない禁止命令）;
//   fsa.go.jp kyuusai/furikome（救済法 2008年6月21日）; netshop.impress / pref.gifu（188 2015年7月1日・2010年1月）;
//   npa.go.jp hakusyo r03（録音・録画 2019年6月1日・対象）; city.meguro（裁判員 6人＋3人・強盗致傷など）;
//   courts.go.jp minzi_25_02, kotobank 少額訴訟（1回の期日・ラウンドテーブル・60万円）; moj.go.jp kyousei（作業の種類）;
//   courts.go.jp kyoto 所持品検査（2019年4月）.
// Review pass (2026-10): moj.go.jp minji68-2（少額訴訟は簡易裁判所・60万円以下）; fsa.go.jp yami_leaf / j-fsa 白書 h21
//   （取立ての時間帯・勤務先・第三者への請求の明記はヤミ金融対策法、2004年1月施行）; moj.go.jp 更生保護（仮釈放の審理は
//   委員の面接と保護観察官の調査）; courts.go.jp saibanin（強盗致傷は裁判員裁判の対象、強盗罪だけなら対象外）.
//
// 強盗致傷: the core models every robbery as 強盗（刑法236条）. A robbery in which the victim was hurt (case.injury) is
// 強盗致傷（刑法240条）, the 裁判員裁判 case this module seats in the 裁判員法廷, so while such a case is open its 罪名・
// 罰条・公訴事実 read as 強盗致傷 (installRobberyInjury; nothing changes once the core says so itself).

import { registerPlace, PLACES, doorIndexFor } from '../engine/map.js';
import { defineTile, R, P, Rw, Pw, disc, oval, line, bevel, inset, dither, grain, outline, shadowEllipse, speckle, tileImageHD } from '../engine/tiles.js';
import { LOOKS, charSheetHD, drawChar, drawShadow } from '../engine/sprites.js';
import { text, measure } from '../engine/draw.js';
import { shade, makeCanvas, fmtMoney, clamp, TILE, VIEW_W } from '../engine/util.js';
import { onMorning, PEOPLE } from '../engine/life.js';
import { RELATIONS, sortFamily, familyLook, regionOf, ageOf, fullName } from '../engine/profile.js';
import { registerItem, AGENCIES } from '../engine/state.js';
import { JUSTICE_PLACES, CRIMES, onJustice, lawDate, kokinEra, MONTH_DAYS, isPolitician } from '../engine/crime.js';

export const JUSTICE_PLACE_IDS = { police: 'keisatsu', prosecutor: 'kensatsu', court: 'saibansho', prison: 'keimusho' };
const KEI = 'keisatsu', KEN = 'kensatsu', SAI = 'saibansho', MU = 'keimusho';

// ======================================================================== small helpers
let GAME = null;
const G = () => GAME || (typeof window !== 'undefined' && window.__game) || null;
const jus = (g) => { try { return g && g.state && typeof g.jus === 'function' ? g.jus() : null; } catch (e) { console.error(e); return null; } };
const fl = (g) => { const f = g.state.flags; if (!f.jpl || typeof f.jpl !== 'object') f.jpl = {}; return f.jpl; };
const since = (g, y, m = 1) => { try { return lawDate(g).ym >= y * 100 + m; } catch (e) { return true; } };
const lawYear = (g) => { try { return lawDate(g).year; } catch (e) { return 2026; } };
const era = (g) => (g && g.state && g.state.profile && g.state.profile.era) || 'reiwa';
const kokin = (g) => { try { return kokinEra(g); } catch (e) { return false; } };
const laborWord = (g) => (kokin(g) ? '拘禁刑' : '懲役');
const kansai = (g) => { try { return regionOf(g.state.profile.hometown).dialect === 'kansai'; } catch (e) { return false; } };
const pickBy = (arr, k) => arr[((Math.round(k) % arr.length) + arr.length) % arr.length];
const day = (g) => (g && g.state ? g.state.day : 1);
const crimeName = (id) => (CRIMES[id] ? CRIMES[id].name : id);
const POLITICAL_MONEY = new Set(['slush_fund', 'bribery_take', 'bribery_give', 'assen', 'tax_evasion']);
const POST_INDICT = new Set(['indicted', 'trial', 'verdict_wait', 'appeal_wait', 'final']);
const VICTIM_CRIMES = new Set(['shoplifting', 'robbery', 'assault', 'fraud_courier', 'traffic_injury', 'stolen_goods']);

// The case a flow is about: the one in custody, else the open case furthest along.
const STAGE_RANK = { final: 9, appeal_wait: 8, verdict_wait: 7, trial: 6, indicted: 5, kouryu: 4, police: 3, arrest: 2, zaitaku: 1 };
function curCase(g) {
  const j = jus(g);
  if (!j) return null;
  const open = (j.cases || []).filter((c) => c && !c.closed);
  if (j.custody && j.custody.caseId != null) {
    const c = open.find((x) => x.id === j.custody.caseId);
    if (c) return c;
  }
  if (!open.length) return null;
  return open.slice().sort((a, b) => (STAGE_RANK[b.stage] || 0) - (STAGE_RANK[a.stage] || 0) || (b.opened || 0) - (a.opened || 0))[0];
}
// 裁判員裁判（2009年5月21日～）: 死刑・無期にあたる罪や、故意の犯罪で人を死なせた罪。強盗罪だけなら対象外で、
// けがをさせた強盗（強盗致傷）は対象。A crime def may opt in with `saibanin: true | (g, cs) => bool`.
export function saibaninCase(g, cs) {
  if (!cs || cs.juvenile || !since(g, 2009, 6)) return false;
  const def = CRIMES[cs.crime];
  if (def && def.saibanin != null) { try { return typeof def.saibanin === 'function' ? !!def.saibanin(g, cs) : !!def.saibanin; } catch (e) { return false; } }
  return cs.crime === 'robbery' && !!cs.injury;
}
const tokusoCase = (cs) => !!cs && POLITICAL_MONEY.has(cs.crime);
// 録音・録画（2019年6月～）: 身柄拘束中の裁判員裁判対象事件と、検察の独自捜査事件。
const recordedCase = (g, cs) => !!cs && since(g, 2019, 6) && !!cs.detained && (saibaninCase(g, cs) || tokusoCase(cs));

// The family (alive), closest first — the same order the core uses for visits and the gate.
function family(g) {
  const st = g.state;
  const fam = sortFamily(((st.profile && st.profile.family) || []).filter((m) => m && m.alive !== false && RELATIONS[m.rel]));
  const first = ['mother', 'father', 'grandmother', 'grandfather', 'sister_older', 'brother_older', 'sister_younger', 'brother_younger'];
  return fam.sort((a, b) => first.indexOf(a.rel) - first.indexOf(b.rel));
}
const playerLook = (g) => (g.state && g.state.look) || LOOKS.player;
const famLook = (g, m) => familyLook(m, playerLook(g));
const famCall = (m) => (RELATIONS[m.rel] ? RELATIONS[m.rel].call : '家族');
// Someone close who is not family (partner, the special one, a good friend).
function closeFriend(g, minLevel = 2) {
  const st = g.state;
  const ids = [];
  if (st.partner && PEOPLE[st.partner]) ids.push(st.partner);
  for (const id of Object.keys(st.people || {})) if (PEOPLE[id] && st.people[id].special && !ids.includes(id)) ids.push(id);
  try { for (const id of g.friends(minLevel)) if (!ids.includes(id)) ids.push(id); } catch (e) { /* life not installed */ }
  return ids.filter((id) => PEOPLE[id] && PEOPLE[id].kind !== 'family');
}

// ---------------------------------------------------------------- flow markers
// A getter below runs right before the core's Flow teleports. It remembers which room the flow is going to,
// so that room shows the flow's people (and its onEnter knows it was entered by a flow, not by walking in).
const ACTIVE = { room: null, place: null, stage: null, caseId: null, day: -1, frame: -1, fresh: false, loaded: false, prev: null };
function mark(g, place, room, stage, cs) {
  if (!g || !g.state) return room;
  const here = !!(g.map && g.map.placeId === place && g.map.roomId === room); // no teleport: the room is already up
  // The room the flow is leaving keeps its people until the map really changes (the fade-out comes after this getter).
  const leaving = !here && ACTIVE.room && ACTIVE.loaded && g.map && g.map.placeId === ACTIVE.place && g.map.roomId === ACTIVE.room;
  const prev = leaving ? { place: ACTIVE.place, room: ACTIVE.room } : null;
  Object.assign(ACTIVE, { room, place, stage, caseId: cs ? cs.id : null, day: day(g), frame: g.frame || 0, fresh: !here, loaded: here, prev });
  return room;
}
// The room's entry / start getter: g.goto consults it only for a teleport without a spot (the flow's), so this is
// where a flow's arrival is confirmed (a later walk-in never shows a stale lineup).
function flowEntry(place, room) {
  const ok = ACTIVE.fresh && ACTIVE.place === place && ACTIVE.room === room;
  if (ok) ACTIVE.loaded = true; // (read before the fade-out: the room being left keeps its people through ACTIVE.prev)
  return ok;
}
// A flow is running in this room right now (scripts keep g.busy > 0 for the whole flow).
function flowIn(g, place, room) {
  if (!ACTIVE.room) return false;
  if (!g || g.busy === 0) { ACTIVE.room = null; ACTIVE.loaded = false; ACTIVE.prev = null; return false; }
  if (ACTIVE.loaded && ACTIVE.place === place && ACTIVE.room === room) return true;
  const p = ACTIVE.prev;
  return !!(p && p.place === place && p.room === room && g.map && g.map.placeId === place && g.map.roomId === room);
}
// onEnter: was this entry the flow's teleport? (consumes the mark); a walk-in clears any stale mark.
function enteredByFlow(g, place, room) {
  GAME = g;
  const ok = ACTIVE.fresh && ACTIVE.loaded && ACTIVE.place === place && ACTIVE.room === room && (g.frame || 0) - ACTIVE.frame < 600;
  if (ok) ACTIVE.fresh = false;
  else { ACTIVE.room = null; ACTIVE.fresh = false; ACTIVE.loaded = false; ACTIVE.prev = null; }
  return ok;
}
const activeCase = (g) => { const j = jus(g); return j && ACTIVE.caseId != null ? (j.cases || []).find((c) => c.id === ACTIVE.caseId) || curCase(g) : curCase(g); };

// Juvenile cases: once sent to the prosecutor, the next "cell" is the 少年鑑別所 and the court is the 家庭裁判所
// (no rooms here: the core's overlays).
const JUV_SENT = new Set();
// The last prison term seen (the release gate comes after j.prison is cleared).
let lastPrison = null;
// Prison event days (the core's serveSentence: scenes spread over the term, cycling 作業・面会・トラブル・手紙・内省・訓練・面会).
// 作業 and トラブル (the core's 「同じ工場の受刑者」) are in the factory, so the work loop comes back; 内省 is in the yard;
// 訓練 in the classroom. A term's first 改善指導 comes on the evening of the first factory day (kyoshitsu onEnter).
const PRISON_EVENT_ROOMS = ['kojo', 'kyoshitsu', 'kojo', 'kyoshitsu', 'undojo', 'kyoiku', 'kyoshitsu'];
const PSEEN = { day: -1, n: 0 };
// The core spreads the scenes over the days left when its loop starts: the 入所 day, or the day a term cut off by a
// reload resumes. The first prison show of a term in this session is that day.
const TERM = { start: null, from: null };
function prisonEventIndex(g, pr) {
  const from = TERM.start === pr.start && TERM.from != null ? TERM.from : (pr.start || 0);
  const total = Math.max(0, (pr.until || 0) - from);
  const n = clamp(Math.round(total / (MONTH_DAYS * 3)), 1, 7);
  for (let i = 1; i <= n; i++) if (from + Math.round((total * i) / (n + 1)) === day(g)) return i - 1;
  return -1;
}
function prisonRoom(g) {
  const j = jus(g);
  const pr = j && j.prison;
  if (!pr) return 'kyoshitsu';
  if (pr.kind === 'roueki') return 'kojo';
  if (TERM.start !== pr.start) { TERM.start = pr.start; TERM.from = day(g); }
  ensureInmate(g, pr);
  if (PSEEN.day !== day(g)) { PSEEN.day = day(g); PSEEN.n = 0; }
  PSEEN.n++;
  const k = prisonEventIndex(g, pr);
  if (k < 0 || PSEEN.n > 1) return 'kyoshitsu';
  if ((k === 3 || k === 4) && visitDue(g, pr)) return 'menkai'; // a friend comes on a letter / reflection day
  return PRISON_EVENT_ROOMS[k % PRISON_EVENT_ROOMS.length];
}
// A 交番 of another module (ネオン街): small police matters stay there as an overlay.
function inKoban(g) {
  const m = g && g.map;
  if (!m) return false;
  return m.placeId === 'koban' || /koban|kouban/.test(String(m.roomId || '')) || (m.placeId !== KEI && /koban|kouban/.test(String(m.placeId || '')));
}

// ---------------------------------------------------------------- the routing (JUSTICE_PLACES getters)
function installRouting() {
  const P = JUSTICE_PLACES;
  // 警察: 取調室・留置場・相談室. After indictment the "cell" is the 拘置所; a juvenile sent on goes to the 鑑別所.
  Object.defineProperty(P.police, 'place', {
    configurable: true, enumerable: true,
    get() {
      const g = G(); const j = jus(g);
      if (!j) return KEI;
      const cs = curCase(g);
      if (!j.custody && inKoban(g)) return null;
      if (cs && cs.juvenile && JUV_SENT.has(cs.id)) return null;
      if (cs && cs.detained && POST_INDICT.has(cs.stage)) return MU;
      return KEI;
    },
    set(v) { /* fixed by this module */ },
  });
  P.police.rooms = {
    get torishirabe() { const g = G(); return mark(g, KEI, 'torishirabe', 'torishirabe', curCase(g)); },
    get ryuchi() {
      const g = G(); const cs = curCase(g);
      if (cs && cs.detained && POST_INDICT.has(cs.stage)) return mark(g, MU, 'kochi', 'ryuchi', cs);
      return mark(g, KEI, 'ryuchi', 'ryuchi', cs);
    },
    get kouban() {
      const g = G();
      const here = g && g.map && g.map.placeId === KEI && PLACES[KEI] && PLACES[KEI].rooms[g.map.roomId] ? g.map.roomId : 'sodan';
      return mark(g, KEI, here, 'kouban', curCase(g));
    },
    set torishirabe(v) { /* routed by this module */ }, set ryuchi(v) { /* routed */ }, set kouban(v) { /* routed */ },
  };
  // 検察: 検事室, or the 特捜部 for political money and big tax cases.
  P.prosecutor.rooms = {
    get kensatsu() {
      const g = G(); const cs = curCase(g);
      if (cs && cs.juvenile) JUV_SENT.add(cs.id);
      return mark(g, KEN, tokusoCase(cs) ? 'tokuso' : 'kenjishitsu', 'kensatsu', cs);
    },
    set kensatsu(v) { /* routed by this module */ },
  };
  // 裁判所: trials by court, 勾留質問, 破産・個人再生; a parole hearing is held at the prison.
  Object.defineProperty(P.court, 'place', {
    configurable: true, enumerable: true,
    get() {
      const g = G(); const j = jus(g);
      if (!j) return SAI;
      if (j.prison) return MU;
      const cs = curCase(g);
      if (cs && cs.juvenile) return null; // 家庭裁判所: the core's overlay
      if (cs && /最高/.test(String(cs.court || '')) && cs.detained) return null; // 上告審: the defendant is not called (刑訴法409条)
      return SAI;
    },
    set(v) { /* fixed by this module */ },
  });
  P.court.rooms = {
    get houtei() {
      const g = G(); const cs = curCase(g);
      const court = String((cs && cs.court) || '');
      const room = /最高/.test(court) ? 'shohotei' : /高等/.test(court) ? 'kousai' : saibaninCase(g, cs) ? 'saibanin' : 'chisai';
      return mark(g, SAI, room, 'houtei', cs);
    },
    get hearing() {
      const g = G(); const j = jus(g); const cs = curCase(g);
      if (j && j.prison) return mark(g, MU, 'shinri', 'hearing', null);
      if (j && j.custody && cs && cs.detained) return mark(g, SAI, 'kouryu', 'hearing', cs);
      return mark(g, SAI, 'shinjin', 'hearing', cs);
    },
    get kasai() { return undefined; },
    set houtei(v) { /* routed by this module */ }, set hearing(v) { /* routed */ }, set kasai(v) { /* routed */ },
  };
  // 刑務所: the gate, the cell / the factory / the yard / the classroom by the day of the term.
  Object.defineProperty(P.prison, 'place', {
    configurable: true, enumerable: true,
    get() {
      const g = G(); const j = jus(g);
      if (!j) return MU;
      if (j.prison) lastPrison = { kind: j.prison.kind, start: j.prison.start };
      const kind = j.prison ? j.prison.kind : lastPrison && lastPrison.kind;
      if (kind === 'shonenin') return null; // 少年院: the core's overlay
      return MU;
    },
    set(v) { /* fixed by this module */ },
  });
  P.prison.rooms = {
    get keimusho() { const g = G(); return mark(g, MU, prisonRoom(g), 'keimusho', null); },
    get gate() { const g = G(); return mark(g, MU, 'mon', 'gate', null); },
    set keimusho(v) { /* routed by this module */ }, set gate(v) { /* routed */ }, set menkai(v) { /* the core keeps 面会 as an overlay */ },
  };
}
installRouting();

// 強盗致傷（刑法240条）: see the header. Only while an open case is a robbery in which the victim was hurt, and only
// where the core's own text does not already say 致傷 / 240条. Its 法定刑 is 無期 or 6年以上 (7年以上 before 2005),
// so the prosecutors' starting point is a year heavier than for 強盗.
function installRobberyInjury() {
  const def = CRIMES.robbery;
  if (!def || def.__jplInjury) return;
  Object.defineProperty(def, '__jplInjury', { value: true });
  const hurt = (cs) => !!(cs && cs.crime === 'robbery' && cs.injury);
  const openHurt = () => { try { const g = G(); return !!(g && g.state && hurt(curCase(g))); } catch (e) { return false; } };
  const said = (t) => /致傷|240条/.test(String(t || ''));
  const { law, facts, typical } = def;
  if (typeof law === 'function') {
    const law2 = function (g, ctx = {}) {
      const t = law.call(this, g, ctx);
      if (!((ctx && ctx.injury) || openHurt()) || said(t)) return t;
      return `強盗致傷罪（刑法240条）：無期又は${since(g, 2005, 1) ? 6 : 7}年以上の${laborWord(g)}`;
    };
    for (const k of [Symbol.toPrimitive, 'toString']) if (law[k]) law2[k] = law[k];
    def.law = law2;
  }
  if (typeof facts === 'function') {
    def.facts = function (cs, g) {
      const t = facts.call(this, cs, g);
      return hurt(cs) && !/けが|傷/.test(t) ? `${t.replace(/した$/, 'し')}、その際、店員に全治約2週間のけがを負わせた` : t;
    };
  }
  if (typeof typical === 'function') {
    def.typical = function (g, cs) {
      const r = typical.call(this, g, cs);
      return r && hurt(cs) && !said(law.call(this, g, { injury: true })) ? { ...r, months: (r.months || 0) + 12 } : r;
    };
  }
  const d = Object.getOwnPropertyDescriptor(def, 'short');
  if (d && 'value' in d && d.configurable !== false) {
    let base = d.value;
    Object.defineProperty(def, 'short', { configurable: true, enumerable: true, get() { return openHurt() && !said(base) ? '強盗致傷' : base; }, set(v) { base = v; } });
  }
}
installRobberyInjury();

// ======================================================================== tiles (native 32x32 HD; 16px draw = the same art halved)
function tile(id, def) {
  const hd = def.hd;
  defineTile(id, {
    ...def,
    draw: def.draw || ((c, r, f, v) => {
      const [cv, cc] = makeCanvas(32, 32);
      hd(cc, r, f, v);
      c.imageSmoothingEnabled = false;
      c.drawImage(cv, 0, 0, 16, 16);
    }),
  });
}
const INK = '#22202a';
// ---- palettes
const PB = { // police blue
  top: '#262a34', wall: '#dfe3ea', wallLo: '#cdd3dd', line: '#bfc6d2', navy: '#24407a', navyD: '#182c56', navyL: '#3a5fa8',
  floor: '#aab0b9', floorD: '#9aa0aa', floorL: '#bcc2ca', steel: '#9aa2ae', steelL: '#c4cad4', steelD: '#6e7682',
};
const PK = { // prosecutor cream & walnut
  top: '#2c2824', wall: '#ece6d8', wallLo: '#ddd5c4', line: '#cfc6b3', wood: '#7a5638', woodL: '#9a7250', woodD: '#5a3e26',
  carpet: '#6f7a8c', carpetD: '#636d7e', carpetL: '#7b8698',
};
const PC = { // court wood
  top: '#2a1e16', wall: '#8c6040', wallL: '#a2744e', wallD: '#6e4a30', groove: '#5e3e26', dado: '#5a3a22', dadoL: '#74502e',
  carpet: '#6a3c36', carpetD: '#5c322d', carpetL: '#7a4740', dais: '#7a5232', daisL: '#94683f', daisD: '#5c3c22',
  bench: '#5e3c22', benchL: '#80562f', benchD: '#432a17', leather: '#24201e', leatherL: '#3c3532',
};
const PP = { // prison grey-green
  top: '#30352f', wall: '#cfd5c9', wallLo: '#a9b2a3', line: '#bfc6b8', stripe: '#6e7d68', floor: '#93978e', floorD: '#868a81', floorL: '#a2a69c',
  conc: '#a8aaa2', concD: '#96988f', tat: '#b9b27e', tatD: '#a39c6a', tatL: '#cbc492', tatEdge: '#4a5a3a',
  uniform: '#7d8579', uniformD: '#666d62',
};

// ---- shared painters
function wallPanel(c, base, lo, line2, hi) {
  R(c, 0, 0, 32, 32, base);
  for (const x of [15, 31]) { R(c, x, 0, 1, 32, line2); R(c, (x + 1) % 32, 0, 1, 32, hi); }
  R(c, 0, 26, 32, 6, lo); R(c, 0, 26, 32, 1, shade(lo, -0.15)); R(c, 0, 31, 32, 1, shade(lo, -0.3));
}
function walltop(c, col) { R(c, 0, 0, 32, 32, col); R(c, 0, 30, 32, 2, shade(col, 0.15)); }
function linoleum(c, r, base, dark, light, n = 40) {
  R(c, 0, 0, 32, 32, base); speckle(c, r, [dark, light, base], n);
  R(c, 0, 0, 32, 1, dark); R(c, 0, 0, 1, 32, dark); R(c, 0, 16, 32, 1, shade(base, -0.05)); R(c, 16, 0, 1, 32, shade(base, -0.05));
}
function steelDesk(c, top = PB.steelL, front = PB.steel, dark = PB.steelD) {
  shadowEllipse(c, 16, 29, 14, 2);
  R(c, 0, 8, 32, 6, top); R(c, 0, 8, 32, 1, '#e4e8ee'); R(c, 0, 13, 32, 1, dark);
  R(c, 2, 14, 28, 14, front); R(c, 2, 14, 28, 1, dark);
  R(c, 4, 17, 10, 4, shade(front, 0.08)); R(c, 8, 18, 3, 1, dark); R(c, 4, 22, 10, 4, shade(front, 0.08)); R(c, 8, 23, 3, 1, dark);
  R(c, 2, 27, 2, 3, dark); R(c, 28, 27, 2, 3, dark);
  outline(c);
}
function chairSteel(c, seat = PB.navy, frame = PB.steelD, dir = 'up') {
  shadowEllipse(c, 16, 28, 8, 2);
  if (dir === 'up') { R(c, 9, 6, 14, 9, seat); R(c, 9, 6, 14, 1, shade(seat, 0.25)); R(c, 10, 15, 2, 4, frame); R(c, 20, 15, 2, 4, frame); }
  R(c, 8, 17, 16, 5, seat); R(c, 8, 17, 16, 1, shade(seat, 0.25)); R(c, 8, 21, 16, 1, shade(seat, -0.25));
  R(c, 9, 22, 2, 7, frame); R(c, 21, 22, 2, 7, frame);
  if (dir === 'down') { R(c, 9, 20, 14, 8, seat); R(c, 9, 27, 14, 1, shade(seat, -0.3)); }
  outline(c);
}
function bars(c, col = '#4a505a', hi = '#8a929e') {
  for (let x = 2; x < 32; x += 6) { R(c, x, 0, 3, 32, col); R(c, x, 0, 1, 32, hi); }
  R(c, 0, 4, 32, 3, col); R(c, 0, 4, 32, 1, hi); R(c, 0, 26, 32, 3, col); R(c, 0, 26, 32, 1, hi);
}
function windowBarred(c, frame, sky = '#a9c6dc', skyL = '#c8dcea') {
  R(c, 4, 4, 24, 16, frame); R(c, 6, 6, 20, 12, sky); R(c, 6, 13, 20, 5, skyL);
  for (let x = 9; x < 26; x += 5) R(c, x, 6, 2, 12, '#3a3e46');
  R(c, 4, 20, 24, 2, shade(frame, -0.2));
}
function tatami(c, r, base, dark, light, edge, vertical = false) {
  R(c, 0, 0, 32, 32, base);
  for (let i = 0; i < 32; i += 2) (vertical ? R(c, i, 0, 1, 32, dark) : R(c, 0, i, 32, 1, dark));
  speckle(c, r, [light, dark], 30);
  if (vertical) { R(c, 0, 0, 2, 32, edge); } else { R(c, 0, 0, 32, 2, edge); }
}
function poster(c, bg, band, ink = INK) {
  R(c, 7, 4, 18, 22, '#f4f2ea'); R(c, 7, 4, 18, 1, '#ffffff');
  R(c, 8, 5, 16, 7, bg); R(c, 8, 13, 16, 2, band);
  for (let y = 17; y < 24; y += 2) R(c, 9, y, 14 - (y % 4), 1, '#9a9a9a');
  R(c, 10, 7, 12, 1, '#ffffff'); R(c, 10, 9, 8, 1, '#ffffff');
  R(c, 7, 25, 18, 1, '#b8b6ae'); P(c, 8, 4, ink); P(c, 23, 4, ink);
}

// ---------------------------------------------------------------- 警視庁 (police blue)
tile('keisatsu_walltop', { solid: true, hd(c) { walltop(c, PB.top); } });
tile('keisatsu_wall', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, PB.wall);
    for (const x of [15, 31]) { R(c, x, 0, 1, 20, PB.line); R(c, (x + 1) % 32, 0, 1, 20, '#eef1f5'); }
    R(c, 0, 18, 32, 3, PB.navy); R(c, 0, 18, 32, 1, PB.navyL); R(c, 0, 20, 32, 1, PB.navyD);
    R(c, 0, 21, 32, 6, PB.wallLo); R(c, 0, 27, 32, 5, '#5c6270'); R(c, 0, 27, 32, 1, '#454a56');
  },
});
tile('keisatsu_floor', { variants: 4, hd(c, r, f, v) { linoleum(c, r, PB.floor, PB.floorD, PB.floorL, 36); if (v === 1) line(c, 20, 26, 27, 20, PB.floorL); } });
tile('keisatsu_cellfloor', { hd(c, r) { tatami(c, r, '#b7b085', '#a59e72', '#c6c09a', '#5a6a8a'); } });
tile('keisatsu_counter', {
  solid: true, obj: true, talkThrough: true, variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 6, 32, 7, '#eef0f4'); R(c, 0, 6, 32, 1, '#ffffff'); R(c, 0, 12, 32, 1, '#c8ced8');
    R(c, 0, 13, 32, 16, PB.navy); R(c, 0, 13, 32, 1, PB.navyD); R(c, 0, 14, 32, 1, PB.navyL);
    R(c, 0, 20, 32, 1, '#e8ecf2'); R(c, 0, 27, 32, 2, PB.navyD);
    if (v === 1) { R(c, 5, 2, 10, 6, '#f4f2ea'); R(c, 6, 3, 8, 1, '#9a9a9a'); R(c, 6, 5, 6, 1, '#9a9a9a'); R(c, 20, 3, 6, 5, '#3a3e48'); R(c, 21, 4, 4, 3, '#6a8ab0'); }
    if (v === 2) { R(c, 8, 3, 3, 5, '#d8d040'); R(c, 13, 4, 8, 4, '#f4f2ea'); R(c, 14, 5, 6, 1, '#7a7a7a'); }
    outline(c);
  },
});
tile('keisatsu_bench', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 28, 15, 2);
    R(c, 0, 8, 32, 8, PB.navy); R(c, 0, 8, 32, 1, PB.navyL); R(c, 0, 15, 32, 1, PB.navyD);
    R(c, 0, 17, 32, 6, PB.navyL); R(c, 0, 17, 32, 1, '#5a7ec4'); R(c, 0, 22, 32, 1, PB.navyD);
    R(c, 3, 23, 2, 6, PB.steelD); R(c, 27, 23, 2, 6, PB.steelD);
    outline(c);
  },
});
tile('keisatsu_desk', { solid: true, obj: true, hd(c) { steelDesk(c); } });
tile('keisatsu_deskpc', {
  solid: true, obj: true,
  hd(c) {
    steelDesk(c);
    R(c, 9, 0, 14, 10, '#2a2e36'); R(c, 10, 1, 12, 7, '#4a6a8a'); R(c, 11, 2, 6, 1, '#8ab0d0'); R(c, 15, 10, 2, 2, '#2a2e36');
    outline(c);
  },
});
tile('keisatsu_chair', { solid: true, obj: true, hd(c) { chairSteel(c, PB.navy, PB.steelD, 'up'); } });
tile('keisatsu_chair_d', { solid: true, obj: true, hd(c) { chairSteel(c, '#5a6270', PB.steelD, 'down'); } });
tile('keisatsu_poster', { obj: true, variants: 3, hd(c, r, f, v) { poster(c, ['#2a5aa8', '#d8a020', '#3a8a5a'][v], ['#d62f2f', '#2a3a6a', '#d8d040'][v]); } });
tile('keisatsu_winbar', { obj: true, hd(c) { windowBarred(c, '#7a828e'); } });
tile('keisatsu_bars', { solid: true, obj: true, hd(c) { bars(c); } });
tile('keisatsu_bardoor', {
  solid: true, obj: true,
  hd(c) { bars(c); R(c, 0, 14, 32, 6, '#4a505a'); R(c, 0, 14, 32, 1, '#8a929e'); R(c, 13, 15, 6, 4, '#2a2e36'); R(c, 15, 16, 2, 2, '#d8c060'); },
});
tile('keisatsu_futon', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 26, 12, 2);
    bevel(c, 5, 16, 22, 9, '#c8ccd8'); bevel(c, 5, 10, 22, 6, '#9aa6c0'); bevel(c, 7, 6, 18, 4, '#e8e8f0');
    outline(c);
  },
});
tile('keisatsu_wc', {
  solid: true, obj: true,
  hd(c) {
    R(c, 2, 4, 28, 26, '#8a909a'); R(c, 2, 4, 28, 2, '#aab0ba'); R(c, 2, 28, 28, 2, '#5e646e');
    R(c, 6, 9, 20, 3, '#6e747e');
    outline(c);
  },
});
tile('keisatsu_camera', {
  obj: true,
  hd(c) {
    R(c, 13, 4, 6, 2, '#2a2e36'); R(c, 15, 6, 2, 6, '#3a3e46');
    bevel(c, 8, 12, 16, 9, '#3a3e46'); disc(c, 12, 16, 3, '#1a1c22'); P(c, 11, 15, '#8ab0d0'); R(c, 20, 13, 2, 2, '#e83a3a');
    outline(c);
  },
});
tile('keisatsu_rack', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 10, 2);
    R(c, 7, 3, 18, 25, PB.steelD); R(c, 8, 4, 16, 23, PB.steelL);
    const cols = ['#d62f2f', '#2a5aa8', '#3a8a5a', '#d8a020', '#8a5ac8', '#e87a2a'];
    for (let i = 0; i < 6; i++) { const x = 9 + (i % 2) * 8, y = 5 + Math.floor(i / 2) * 7; R(c, x, y, 6, 6, '#f4f2ea'); R(c, x, y, 6, 2, cols[i]); }
    outline(c);
  },
});
tile('keisatsu_lostshelf', {
  solid: true, obj: true,
  hd(c) {
    R(c, 2, 4, 28, 25, '#7a828e'); R(c, 3, 5, 26, 23, '#5e646e');
    for (const y of [12, 20]) R(c, 3, y, 26, 2, '#9aa2ae');
    R(c, 5, 7, 4, 5, '#d62f2f'); R(c, 11, 8, 6, 4, '#3a3a3a'); R(c, 19, 6, 3, 6, '#2a5aa8'); R(c, 24, 9, 3, 3, '#d8c060');
    R(c, 5, 15, 8, 5, '#8a6a44'); R(c, 15, 16, 3, 4, '#e8e8e8'); R(c, 21, 14, 2, 6, '#3a8a5a');
    for (let x = 5; x < 27; x += 4) { R(c, x, 22, 1, 6, '#2a2a2a'); R(c, x - 1, 22, 3, 1, ['#d62f2f', '#2a5aa8', '#3a3a3a'][x % 3]); } // umbrellas
    outline(c);
  },
});
tile('keisatsu_partition', {
  solid: true, obj: true,
  hd(c) { R(c, 0, 2, 32, 26, '#c8ced8'); R(c, 0, 2, 32, 2, '#e4e8ee'); R(c, 0, 26, 32, 2, '#8a929e'); for (let x = 3; x < 32; x += 8) R(c, x, 6, 1, 18, '#b4bcc8'); outline(c); },
});
tile('keisatsu_table', {
  solid: true, obj: true, talkThrough: true,
  hd(c) { shadowEllipse(c, 16, 28, 14, 2); R(c, 0, 9, 32, 8, '#e8e6e0'); R(c, 0, 9, 32, 1, '#ffffff'); R(c, 0, 16, 32, 2, '#a8a69e'); R(c, 3, 18, 2, 10, PB.steelD); R(c, 27, 18, 2, 10, PB.steelD); outline(c); },
});
function policeDoor(c) {
  R(c, 0, 0, 32, 32, PB.wall); R(c, 5, 2, 22, 30, '#6e7682'); R(c, 7, 4, 18, 28, '#8a929e'); R(c, 7, 4, 18, 1, '#a8b0bc');
  R(c, 12, 8, 8, 6, '#3a3e46'); R(c, 13, 9, 6, 4, '#6a8aa8'); R(c, 21, 18, 2, 4, '#d8c060');
}
tile('keisatsu_door_lock', { solid: true, hd(c) { policeDoor(c); R(c, 10, 22, 12, 4, '#d62f2f'); R(c, 11, 23, 10, 1, '#ffffff'); } });
tile('keisatsu_door', {
  hd(c) {
    R(c, 0, 0, 32, 32, PB.wall); R(c, 5, 2, 22, 30, '#6e7682'); R(c, 7, 4, 18, 28, '#8a929e'); R(c, 7, 4, 18, 1, '#a8b0bc');
    R(c, 12, 8, 8, 6, '#3a3e46'); R(c, 13, 9, 6, 4, '#6a8aa8'); R(c, 21, 18, 2, 4, '#d8c060');
  },
});
tile('keisatsu_flag', { // the lamp over a police door (a red light, no emblem)
  obj: true,
  hd(c) { R(c, 11, 3, 10, 3, '#3a3e46'); oval(c, 12, 6, 8, 8, '#d62f2f'); R(c, 14, 7, 3, 2, '#ff8a8a'); R(c, 15, 14, 2, 4, '#3a3e46'); outline(c); },
});

// ---------------------------------------------------------------- 検察庁 (cream & walnut)
tile('kensatsu_walltop', { solid: true, hd(c) { walltop(c, PK.top); } });
tile('kensatsu_wall', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, PK.wall);
    for (const x of [15, 31]) { R(c, x, 0, 1, 18, PK.line); R(c, (x + 1) % 32, 0, 1, 18, '#f6f2e8'); }
    R(c, 0, 18, 32, 10, PK.wood); R(c, 0, 18, 32, 1, PK.woodL); R(c, 0, 19, 32, 1, PK.woodD);
    for (const x of [7, 23]) R(c, x, 20, 1, 8, PK.woodD);
    R(c, 0, 28, 32, 4, PK.woodD); R(c, 0, 28, 32, 1, '#3e2a18');
  },
});
tile('kensatsu_floor', { variants: 3, hd(c, r) { R(c, 0, 0, 32, 32, PK.carpet); speckle(c, r, [PK.carpetD, PK.carpetL], 90); } });
tile('kensatsu_stone', { variants: 3, hd(c, r, f, v) { linoleum(c, r, '#d6d2c8', '#c6c2b6', '#e2ded4', 30); if (v === 2) line(c, 5, 25, 12, 20, '#e8e4da'); } });
tile('kensatsu_desk', {
  solid: true, obj: true, talkThrough: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 15, 2);
    R(c, 0, 7, 32, 7, PK.woodL); R(c, 0, 7, 32, 1, '#b48a62'); R(c, 0, 13, 32, 1, PK.woodD);
    R(c, 1, 14, 30, 15, PK.wood); R(c, 1, 14, 30, 1, PK.woodD); R(c, 4, 17, 24, 9, shade(PK.wood, 0.06)); R(c, 4, 17, 24, 1, PK.woodD);
    outline(c);
  },
});
tile('kensatsu_papers', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 15, 2);
    R(c, 0, 7, 32, 7, PK.woodL); R(c, 0, 7, 32, 1, '#b48a62'); R(c, 0, 13, 32, 1, PK.woodD);
    R(c, 1, 14, 30, 15, PK.wood); R(c, 4, 17, 24, 9, shade(PK.wood, 0.06));
    for (let i = 0; i < 4; i++) { R(c, 4 + i * 2, 1 + i, 10, 8 - i, i % 2 ? '#f4f0e4' : '#e8e2d2'); }
    R(c, 18, 2, 9, 7, '#f4f0e4'); R(c, 19, 3, 6, 1, '#9a9a9a'); R(c, 19, 5, 7, 1, '#9a9a9a'); R(c, 24, 0, 2, 8, '#2a5aa8');
    outline(c);
  },
});
tile('kensatsu_pc', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 15, 2);
    R(c, 0, 9, 32, 6, '#d8d4c8'); R(c, 0, 9, 32, 1, '#ece8de'); R(c, 1, 15, 30, 13, '#b8b2a2'); R(c, 1, 15, 30, 1, '#8a8474');
    R(c, 7, 0, 18, 11, '#2a2e36'); R(c, 8, 1, 16, 8, '#e8eef4'); for (let y = 2; y < 8; y += 2) R(c, 9, y, 10 + (y % 3), 1, '#7a8a9a');
    R(c, 15, 11, 3, 2, '#2a2e36'); R(c, 9, 12, 14, 2, '#4a4e58');
    outline(c);
  },
});
tile('kensatsu_shelf', {
  solid: true, obj: true,
  hd(c) {
    R(c, 1, 1, 30, 30, PK.woodD); R(c, 2, 2, 28, 28, '#3e2a18');
    for (let row = 0; row < 3; row++) {
      const y = 3 + row * 9;
      for (let x = 3; x < 29; x += 3) { const col = ['#2a3a6a', '#7a1f2a', '#2a3a6a', '#3a5a3a'][(x + row) % 4]; R(c, x, y, 3, 8, col); R(c, x, y + 2, 3, 1, '#d8c060'); }
      R(c, 2, y + 8, 28, 1, PK.woodL);
    }
    outline(c);
  },
});
tile('kensatsu_boxes', {
  solid: true, obj: true, variants: 3,
  hd(c, r, f, v) {
    shadowEllipse(c, 16, 29, 14, 2);
    const box = (x, y, w, h) => { bevel(c, x, y, w, h, '#c8a06a', '#dcb884', '#9a7648'); R(c, x, y + Math.floor(h / 2), w, 1, '#a88456'); R(c, x + 2, y + 2, w - 4, 3, '#f4f0e4'); };
    box(2, 17, 14, 11); box(16, 17, 14, 11);
    if (v !== 1) box(4, 6, 13, 11);
    if (v === 2) box(17, 7, 12, 10);
    outline(c);
  },
});
tile('kensatsu_blind', {
  obj: true,
  hd(c) { R(c, 3, 3, 26, 20, '#8a8a84'); R(c, 4, 4, 24, 18, '#a8c4dc'); for (let y = 4; y < 22; y += 3) R(c, 4, y, 24, 2, '#eeeae0'); R(c, 3, 23, 26, 2, '#6a6a64'); },
});
tile('kensatsu_board', {
  obj: true,
  hd(c) {
    R(c, 2, 3, 28, 22, '#9aa0a8'); R(c, 3, 4, 26, 20, '#f4f6f8');
    R(c, 6, 7, 6, 4, '#d8dce4'); R(c, 20, 7, 6, 4, '#d8dce4'); R(c, 13, 16, 6, 4, '#d8dce4');
    line(c, 12, 9, 20, 9, '#d62f2f'); line(c, 9, 11, 15, 16, '#2a5aa8'); line(c, 23, 11, 17, 16, '#2a5aa8');
    R(c, 4, 25, 24, 2, '#7a8088');
  },
});
tile('kensatsu_gate', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 9, 2);
    R(c, 2, 2, 5, 27, '#9aa0aa'); R(c, 25, 2, 5, 27, '#9aa0aa'); R(c, 2, 2, 28, 4, '#9aa0aa'); R(c, 3, 3, 26, 2, '#c4cad4');
    R(c, 3, 6, 3, 22, '#c4cad4'); R(c, 26, 6, 3, 22, '#c4cad4'); R(c, 13, 3, 6, 2, '#3cff7a');
    outline(c);
  },
});
tile('kensatsu_sofa', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 28, 15, 2);
    R(c, 0, 8, 32, 9, '#5a5248'); R(c, 0, 8, 32, 1, '#7a7064'); R(c, 0, 17, 32, 6, '#6e6458'); R(c, 0, 17, 32, 1, '#857a6c'); R(c, 0, 22, 32, 1, '#4a4238');
    R(c, 3, 23, 2, 5, '#3a342c'); R(c, 27, 23, 2, 5, '#3a342c'); outline(c);
  },
});

// ---------------------------------------------------------------- 裁判所 (courtroom wood)
tile('saibansho_walltop', { solid: true, hd(c) { walltop(c, PC.top); } });
function courtWall(c, lower) {
  R(c, 0, 0, 32, 32, PC.wall);
  for (let x = 3; x < 32; x += 8) { R(c, x, 0, 1, 32, PC.groove); R(c, x + 1, 0, 1, 32, PC.wallL); }
  if (!lower) { R(c, 0, 0, 32, 2, PC.wallD); R(c, 0, 2, 32, 1, PC.wallL); }
  else { R(c, 0, 20, 32, 12, PC.dado); R(c, 0, 20, 32, 2, PC.dadoL); R(c, 0, 22, 32, 1, PC.top); for (const x of [7, 23]) R(c, x, 23, 1, 9, PC.top); }
}
tile('saibansho_wall_u', { solid: true, hd(c) { courtWall(c, false); } });
tile('saibansho_wall', { solid: true, hd(c) { courtWall(c, true); } });
// the high back of a judge's chair against the wall (the judge sits in front of it)
function chairBack(c, wide) {
  courtWall(c, true);
  const w = wide ? 18 : 14, x = 16 - w / 2;
  R(c, x, 6, w, 26, PC.leather); R(c, x + 1, 7, w - 2, 1, PC.leatherL); R(c, x + 1, 7, 1, 24, PC.leatherL);
  for (let y = 10; y < 30; y += 5) R(c, x + 2, y, w - 4, 1, '#181514');
  R(c, x, 5, w, 2, '#3c3532');
}
tile('saibansho_chairback', { solid: true, hd(c) { chairBack(c, false); } });
tile('saibansho_chairback_c', { solid: true, hd(c) { chairBack(c, true); } });
tile('saibansho_dais', { solid: true, hd(c) { R(c, 0, 0, 32, 32, PC.dais); for (let y = 0; y < 32; y += 8) { R(c, 0, y, 32, 1, PC.daisD); R(c, (y * 3) % 32, y, 1, 8, PC.daisD); } R(c, 0, 1, 32, 1, PC.daisL); } });
tile('saibansho_bench', { // the front of the 法壇
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, PC.bench); R(c, 0, 0, 32, 3, PC.benchL); R(c, 0, 3, 32, 1, PC.benchD);
    for (const x of [1, 17]) { inset(c, x, 7, 14, 19, shade(PC.bench, 0.05), PC.benchL, PC.benchD); }
    R(c, 0, 29, 32, 3, PC.benchD); R(c, 0, 31, 32, 1, '#2a1a0e');
  },
});
tile('saibansho_floor', { variants: 3, hd(c, r) { R(c, 0, 0, 32, 32, PC.carpet); speckle(c, r, [PC.carpetD, PC.carpetL], 80); R(c, 0, 31, 32, 1, PC.carpetD); } });
tile('saibansho_floor_hi', { variants: 3, hd(c, r) { R(c, 0, 0, 32, 32, '#3e4858'); speckle(c, r, ['#363f4e', '#465163'], 80); R(c, 0, 31, 32, 1, '#343c4a'); } });
tile('saibansho_floor_sup', { variants: 3, hd(c, r) { R(c, 0, 0, 32, 32, '#5a2a2c'); speckle(c, r, ['#4e2426', '#683234'], 80); for (let i = 0; i < 32; i += 16) { R(c, i + 7, 7, 2, 2, '#7a4a3a'); R(c, i + 15, 23, 2, 2, '#7a4a3a'); } } });
tile('saibansho_woodfloor', { variants: 2, hd(c, r) { R(c, 0, 0, 32, 32, '#9a7650'); for (let y = 0; y < 32; y += 8) { R(c, 0, y, 32, 1, '#7e5e3e'); R(c, (y * 5 + 7) % 32, y, 1, 8, '#7e5e3e'); } speckle(c, r, ['#a8845c', '#8e6c48'], 30); } });
tile('saibansho_stone', { variants: 3, hd(c, r) { linoleum(c, r, '#cfc9bc', '#bfb9ab', '#ddd7cb', 30); } });
tile('saibansho_table', { // counsel table (stacked vertically along the side)
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 30, 13, 2);
    R(c, 4, 0, 24, 30, PC.benchL); R(c, 4, 0, 24, 1, '#9a6c3e'); R(c, 4, 0, 1, 30, '#9a6c3e'); R(c, 27, 0, 1, 30, PC.benchD);
    R(c, 7, 6, 9, 11, '#f4f0e4'); R(c, 8, 8, 6, 1, '#9a9a9a'); R(c, 8, 10, 7, 1, '#9a9a9a'); R(c, 8, 12, 5, 1, '#9a9a9a');
    R(c, 18, 18, 7, 9, '#2a3a6a'); R(c, 19, 19, 5, 1, '#d8c060');
  },
});
tile('saibansho_table_mon', { // counsel table with an evidence monitor (裁判員法廷)
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 30, 13, 2);
    R(c, 4, 0, 24, 30, PC.benchL); R(c, 4, 0, 24, 1, '#9a6c3e'); R(c, 27, 0, 1, 30, PC.benchD);
    R(c, 9, 4, 14, 10, '#2a2e36'); R(c, 10, 5, 12, 7, '#7a9ab8'); R(c, 11, 6, 5, 1, '#c8dcea'); R(c, 15, 14, 2, 2, '#2a2e36');
    R(c, 8, 18, 10, 8, '#f4f0e4'); R(c, 9, 20, 7, 1, '#9a9a9a');
  },
});
tile('saibansho_witness', { // 証言台: a small lectern with a microphone
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 10, 2);
    R(c, 6, 10, 20, 18, PC.bench); R(c, 6, 10, 20, 3, PC.benchL); R(c, 6, 13, 20, 1, PC.benchD); inset(c, 9, 16, 14, 9, shade(PC.bench, 0.06), PC.benchL, PC.benchD);
    R(c, 15, 2, 2, 9, '#3a3a3a'); R(c, 14, 1, 4, 3, '#1a1a1a'); P(c, 15, 1, '#5a5a5a');
    outline(c);
  },
});
tile('saibansho_dbench', { // the defendant's bench (vertical)
  solid: true, obj: true,
  hd(c) { shadowEllipse(c, 16, 30, 8, 2); R(c, 9, 0, 14, 30, '#3a3e48'); R(c, 9, 0, 14, 1, '#5a5e68'); R(c, 9, 0, 1, 30, '#5a5e68'); R(c, 22, 0, 1, 30, '#262a32'); R(c, 11, 2, 10, 26, '#4a4e58'); },
});
tile('saibansho_bar', { // the bar between the well and the gallery
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 15, 2);
    R(c, 0, 8, 32, 4, PC.benchL); R(c, 0, 8, 32, 1, '#a07448'); R(c, 0, 11, 32, 1, PC.benchD);
    for (let x = 2; x < 32; x += 6) { R(c, x, 12, 3, 14, PC.bench); R(c, x, 12, 1, 14, PC.benchL); }
    R(c, 0, 26, 32, 3, PC.benchD);
  },
});
tile('saibansho_bargate', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 15, 2);
    R(c, 0, 8, 32, 4, PC.benchL); R(c, 0, 8, 32, 1, '#a07448'); R(c, 15, 8, 2, 20, PC.benchD);
    for (const x of [3, 8, 21, 26]) { R(c, x, 12, 3, 14, PC.bench); R(c, x, 12, 1, 14, PC.benchL); }
    R(c, 13, 14, 2, 3, '#d8c060'); R(c, 17, 14, 2, 3, '#d8c060'); R(c, 0, 26, 32, 3, PC.benchD);
  },
});
tile('saibansho_gallery', { // gallery bench seen from behind (backrest at the bottom)
  solid: true, obj: true,
  hd(c) {
    R(c, 0, 6, 32, 9, '#6a4a32'); R(c, 0, 6, 32, 1, '#86603e'); R(c, 0, 14, 32, 1, '#4e3422');
    R(c, 0, 17, 32, 9, PC.bench); R(c, 0, 17, 32, 2, PC.benchL); R(c, 0, 25, 32, 2, PC.benchD);
    R(c, 2, 27, 2, 3, PC.benchD); R(c, 28, 27, 2, 3, PC.benchD);
  },
});
tile('saibansho_press', { // a press seat (white cover)
  solid: true, obj: true,
  hd(c) { R(c, 0, 6, 32, 9, '#6a4a32'); R(c, 0, 17, 32, 9, PC.bench); R(c, 0, 17, 32, 2, PC.benchL); R(c, 4, 7, 24, 7, '#f2f2ee'); R(c, 4, 7, 24, 1, '#ffffff'); R(c, 0, 25, 32, 2, PC.benchD); },
});
tile('saibansho_bigmon', { // wall monitor (裁判員法廷)
  obj: true,
  hd(c) { R(c, 2, 5, 28, 18, '#1a1c22'); R(c, 3, 6, 26, 15, '#3a4a5e'); R(c, 4, 7, 10, 6, '#7a9ab8'); R(c, 16, 8, 11, 1, '#a8c0d4'); R(c, 16, 11, 9, 1, '#a8c0d4'); R(c, 14, 23, 4, 4, '#2a2e36'); },
});
tile('saibansho_clock', { obj: true, hd(c) { disc(c, 16, 14, 8, '#2a1a0e'); disc(c, 16, 14, 7, '#f4f0e4'); R(c, 16, 9, 1, 6, INK); R(c, 16, 14, 4, 1, INK); P(c, 16, 14, '#d62f2f'); } });
tile('saibansho_counter', {
  solid: true, obj: true, talkThrough: true, variants: 2,
  hd(c, r, f, v) {
    R(c, 0, 6, 32, 7, '#e8e2d2'); R(c, 0, 6, 32, 1, '#f8f4ea'); R(c, 0, 12, 32, 1, '#b8b0a0');
    R(c, 0, 13, 32, 16, PC.bench); R(c, 0, 13, 32, 1, PC.benchD); R(c, 0, 14, 32, 1, PC.benchL); R(c, 0, 27, 32, 2, PC.benchD);
    if (v === 1) { R(c, 6, 2, 10, 6, '#f4f0e4'); R(c, 7, 3, 7, 1, '#9a9a9a'); R(c, 7, 5, 5, 1, '#9a9a9a'); R(c, 20, 3, 5, 5, '#d8c060'); }
    outline(c);
  },
});
tile('saibansho_board', { // 開廷表 (today's hearings)
  obj: true,
  hd(c) {
    R(c, 3, 2, 26, 26, '#2a1e16'); R(c, 4, 3, 24, 24, '#f4f0e4'); R(c, 4, 3, 24, 4, '#5e3c22');
    for (let y = 9; y < 26; y += 3) { R(c, 5, y, 7, 1, '#7a7a7a'); R(c, 14, y, 12, 1, '#9a9a9a'); }
  },
});
tile('saibansho_round', { // ラウンドテーブル (small claims)
  solid: true, obj: true,
  hd(c) { shadowEllipse(c, 16, 28, 15, 3); oval(c, 0, 6, 32, 20, PC.benchD); oval(c, 0, 5, 32, 19, PC.benchL); oval(c, 3, 7, 26, 14, '#a07448'); R(c, 8, 10, 7, 5, '#f4f0e4'); R(c, 18, 12, 6, 4, '#f4f0e4'); },
});

// ---------------------------------------------------------------- 刑務所 (grey-green)
tile('keimusho_walltop', { solid: true, hd(c) { walltop(c, PP.top); } });
tile('keimusho_wall', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, PP.wall);
    for (const x of [15, 31]) { R(c, x, 0, 1, 16, PP.line); R(c, (x + 1) % 32, 0, 1, 16, '#dde2d8'); }
    R(c, 0, 16, 32, 12, PP.wallLo); R(c, 0, 16, 32, 2, PP.stripe); R(c, 0, 16, 32, 1, '#86947f');
    R(c, 0, 28, 32, 4, '#545c50'); R(c, 0, 28, 32, 1, '#40463d');
  },
});
tile('keimusho_floor', { variants: 4, hd(c, r, f, v) { linoleum(c, r, PP.floor, PP.floorD, PP.floorL, 34); if (v === 3) line(c, 4, 26, 10, 22, PP.floorL); } });
tile('keimusho_conc', { variants: 3, hd(c, r) { R(c, 0, 0, 32, 32, PP.conc); speckle(c, r, [PP.concD, '#b4b6ae', '#9c9e96'], 70); R(c, 0, 0, 32, 1, PP.concD); R(c, 0, 0, 1, 32, PP.concD); } });
tile('keimusho_tatami', { hd(c, r) { tatami(c, r, PP.tat, PP.tatD, PP.tatL, PP.tatEdge); } });
tile('keimusho_tatami_v', { hd(c, r) { tatami(c, r, PP.tat, PP.tatD, PP.tatL, PP.tatEdge, true); } });
tile('keimusho_futon', {
  solid: true, obj: true,
  hd(c) { shadowEllipse(c, 16, 26, 12, 2); bevel(c, 5, 17, 22, 8, '#b8beb0'); bevel(c, 5, 11, 22, 6, '#8e9a86'); bevel(c, 7, 7, 18, 4, '#e2e4dc'); outline(c); },
});
tile('keimusho_table', { // a low 座卓
  solid: true, obj: true,
  hd(c) { shadowEllipse(c, 16, 26, 13, 2); R(c, 3, 13, 26, 7, '#9a7a52'); R(c, 3, 13, 26, 1, '#b8946a'); R(c, 3, 19, 26, 1, '#6e5436'); R(c, 5, 20, 2, 5, '#6e5436'); R(c, 25, 20, 2, 5, '#6e5436'); R(c, 8, 14, 7, 4, '#f4f0e4'); outline(c); },
});
tile('keimusho_shelf', {
  solid: true, obj: true,
  hd(c) {
    R(c, 2, 4, 28, 24, '#8a7a5a'); R(c, 3, 5, 26, 22, '#6e6046');
    R(c, 3, 15, 26, 2, '#a8946c');
    R(c, 5, 8, 6, 7, '#e8e8e0'); R(c, 13, 9, 4, 6, '#2a5aa8'); R(c, 18, 7, 3, 8, '#7a3a2a'); R(c, 22, 10, 5, 5, '#d8d0b0');
    R(c, 5, 19, 9, 7, '#c8c4b4'); R(c, 16, 20, 4, 6, '#5a7a5a'); R(c, 22, 18, 5, 8, '#e8e8e0');
    outline(c);
  },
});
tile('keimusho_wc', { solid: true, obj: true, hd(c) { R(c, 2, 3, 28, 27, '#9aa096'); R(c, 2, 3, 28, 2, '#b4bab0'); R(c, 2, 28, 28, 2, '#6e746a'); R(c, 6, 8, 20, 2, '#7e847a'); outline(c); } });
tile('keimusho_sink', { solid: true, obj: true, hd(c) { R(c, 6, 10, 20, 12, '#c8ccd0'); R(c, 6, 10, 20, 2, '#e4e8ec'); oval(c, 10, 13, 12, 6, '#8a929a'); R(c, 15, 6, 2, 6, '#9aa2aa'); R(c, 13, 6, 6, 2, '#b4bcc4'); R(c, 9, 22, 14, 6, '#9aa096'); outline(c); } });
tile('keimusho_window', { obj: true, hd(c) { windowBarred(c, '#7a8474', '#b8cad8', '#d4e0e8'); } });
tile('keimusho_tv', { solid: true, obj: true, hd(c) { R(c, 4, 22, 24, 6, '#8a7a5a'); R(c, 6, 8, 20, 14, '#2a2e36'); R(c, 8, 10, 16, 10, '#4a6a5a'); R(c, 9, 11, 6, 2, '#8ab0a0'); outline(c); } });
tile('keimusho_celldoor', { // a heavy cell door in the wall, with a small window and a food slot
  hd(c) {
    R(c, 0, 0, 32, 32, PP.wall); R(c, 0, 16, 32, 12, PP.wallLo);
    R(c, 6, 1, 20, 31, '#5e6a5a'); R(c, 8, 3, 16, 29, '#7a8874'); R(c, 8, 3, 16, 1, '#93a08c');
    R(c, 12, 6, 8, 6, '#2a2e2a'); R(c, 13, 7, 6, 4, '#6a7a8a'); R(c, 11, 18, 10, 3, '#4a564a'); R(c, 21, 14, 2, 5, '#c8b860');
  },
});
tile('keimusho_bench', { // 木工の作業台
  solid: true, obj: true, variants: 3,
  hd(c, r, f, v) {
    shadowEllipse(c, 16, 29, 15, 2);
    R(c, 0, 9, 32, 7, '#b88a58'); R(c, 0, 9, 32, 1, '#d4a674'); R(c, 0, 15, 32, 1, '#8a643c');
    grain(c, r, 0, 10, 32, 5, '#a47a4a', 6);
    R(c, 2, 16, 3, 12, '#7a5634'); R(c, 27, 16, 3, 12, '#7a5634'); R(c, 2, 22, 28, 2, '#7a5634');
    if (v === 0) { R(c, 6, 5, 14, 4, '#e0c08a'); R(c, 6, 5, 14, 1, '#f0d8a8'); } // plank
    if (v === 1) { R(c, 8, 6, 9, 3, '#7a7a7a'); R(c, 17, 5, 5, 4, '#8a5a2a'); } // plane
    if (v === 2) { R(c, 5, 6, 3, 3, '#c8a06a'); R(c, 10, 4, 8, 5, '#d8b07a'); R(c, 21, 6, 6, 3, '#e0c08a'); }
    outline(c);
  },
});
tile('keimusho_press', { // 印刷機
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 15, 2);
    bevel(c, 2, 8, 28, 20, '#6e7a86'); R(c, 4, 11, 24, 6, '#3a4250'); disc(c, 9, 14, 3, '#2a2e36'); disc(c, 23, 14, 3, '#2a2e36');
    R(c, 6, 4, 20, 5, '#f4f2ea'); R(c, 6, 4, 20, 1, '#ffffff'); R(c, 4, 20, 24, 5, '#5a6672'); R(c, 24, 21, 3, 2, '#3cff7a');
    outline(c);
  },
});
tile('keimusho_sewing', { // ミシン台
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 15, 2);
    R(c, 0, 12, 32, 6, '#c8c0a8'); R(c, 0, 12, 32, 1, '#e0d8c0'); R(c, 0, 17, 32, 1, '#9a927a'); R(c, 3, 18, 3, 10, '#6e6a5e'); R(c, 26, 18, 3, 10, '#6e6a5e');
    R(c, 10, 4, 14, 3, '#e8e8e4'); R(c, 20, 4, 4, 9, '#e8e8e4'); R(c, 10, 7, 3, 6, '#e8e8e4'); R(c, 11, 4, 12, 1, '#ffffff'); P(c, 12, 12, '#3a3a3a');
    R(c, 4, 10, 6, 3, '#4a6a9a');
    outline(c);
  },
});
tile('keimusho_tandai', { // the officer's raised desk (担当台)
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 30, 15, 2);
    R(c, 1, 6, 30, 7, '#8a7a5a'); R(c, 1, 6, 30, 1, '#a8946c'); R(c, 2, 13, 28, 16, '#6e6046'); R(c, 2, 13, 28, 1, '#4e4432');
    R(c, 6, 2, 10, 5, '#f4f0e4'); R(c, 7, 3, 7, 1, '#9a9a9a'); R(c, 20, 3, 6, 4, '#2a2e36');
    for (let y = 16; y < 28; y += 4) R(c, 4, y, 24, 1, '#5e5440');
    outline(c);
  },
});
tile('keimusho_lumber', { solid: true, obj: true, hd(c) { shadowEllipse(c, 16, 29, 14, 2); for (let i = 0; i < 5; i++) { R(c, 2, 8 + i * 4, 28, 4, i % 2 ? '#c8a06a' : '#d8b07a'); R(c, 2, 8 + i * 4, 28, 1, '#e8c890'); disc(c, 4, 10 + i * 4, 1, '#9a7648'); } outline(c); } });
tile('keimusho_ground', { variants: 4, hd(c, r) { R(c, 0, 0, 32, 32, '#b39a78'); speckle(c, r, ['#a68d6a', '#c0a886', '#9a825f', '#c8b090'], 110); } });
tile('keimusho_lane', { variants: 2, hd(c, r) { R(c, 0, 0, 32, 32, '#b39a78'); speckle(c, r, ['#a68d6a', '#c0a886'], 80); R(c, 0, 14, 32, 3, '#ece8dc'); dither(c, 0, 13, 32, 1, '#d8d2c2'); } });
tile('keimusho_fence', {
  solid: true, obj: true,
  hd(c) {
    R(c, 0, 0, 32, 3, '#6a6e66'); R(c, 0, 0, 32, 1, '#8a8e86'); R(c, 0, 0, 2, 32, '#6a6e66');
    for (let y = 3; y < 32; y++) for (let x = 2; x < 32; x++) if (((x + y) % 6 === 0) || ((x - y + 60) % 6 === 0)) P(c, x, y, '#8a8e86');
    R(c, 0, 29, 32, 3, '#5a5e56');
  },
});
tile('keimusho_wallout_top', { solid: true, hd(c) { R(c, 0, 0, 32, 32, '#7a7c74'); R(c, 0, 24, 32, 8, '#8e9088'); R(c, 0, 24, 32, 1, '#a4a69e'); for (let x = 0; x < 32; x += 8) R(c, x, 0, 1, 24, '#6e7068'); } });
tile('keimusho_wallout', {
  solid: true,
  hd(c, r) { R(c, 0, 0, 32, 32, '#b6b4aa'); speckle(c, r, ['#aaa89e', '#c0beb4'], 60); R(c, 0, 0, 32, 2, '#d0cec4'); for (const y of [10, 21]) R(c, 0, y, 32, 1, '#9e9c92'); R(c, 15, 0, 1, 32, '#a4a298'); R(c, 0, 30, 32, 2, '#8a887e'); },
});
tile('keimusho_gate', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, '#4e5660'); R(c, 0, 0, 32, 3, '#6a7480');
    for (let x = 2; x < 32; x += 6) { R(c, x, 3, 3, 27, '#5e6874'); R(c, x, 3, 1, 27, '#7a8490'); }
    R(c, 0, 14, 32, 3, '#3a4048'); R(c, 0, 29, 32, 3, '#2e343c');
  },
});
tile('keimusho_guardbox', { solid: true, obj: true, hd(c) { shadowEllipse(c, 16, 29, 13, 2); bevel(c, 4, 6, 24, 23, '#d8d8d0'); R(c, 7, 9, 18, 9, '#8ab0c8'); R(c, 7, 9, 18, 2, '#c8dcea'); R(c, 4, 3, 24, 4, '#4e5660'); outline(c); } });
tile('keimusho_desk', { // a student desk (教室)
  solid: true, obj: true,
  hd(c) { shadowEllipse(c, 16, 28, 11, 2); R(c, 5, 10, 22, 7, '#c8a878'); R(c, 5, 10, 22, 1, '#e0c49a'); R(c, 5, 16, 22, 1, '#9a7a4a'); R(c, 7, 17, 2, 10, '#7a7e86'); R(c, 23, 17, 2, 10, '#7a7e86'); R(c, 10, 11, 8, 4, '#f4f0e4'); outline(c); },
});
tile('keimusho_blackboard', { obj: true, hd(c) { R(c, 1, 3, 30, 22, '#6a5a3a'); R(c, 2, 4, 28, 20, '#2f4a3a'); R(c, 5, 8, 12, 1, '#e8e8e0'); R(c, 5, 12, 18, 1, '#e8e8e0'); R(c, 5, 16, 9, 1, '#e8e8e0'); R(c, 2, 24, 28, 2, '#8a7a5a'); R(c, 20, 23, 3, 1, '#f4f4f4'); } });
tile('keimusho_acrylic', { // the 面会室 partition: a counter with an acrylic board and speaking holes
  solid: true, obj: true, talkThrough: true,
  hd(c) {
    R(c, 0, 18, 32, 11, '#8a8070'); R(c, 0, 18, 32, 2, '#b0a890'); R(c, 0, 28, 32, 1, '#5e5648');
    c.fillStyle = 'rgba(200,230,255,0.45)'; c.fillRect(1, 0, 30, 18);
    R(c, 1, 0, 30, 1, '#e4f2fa'); R(c, 1, 0, 1, 18, '#e4f2fa');
    for (let i = 0; i < 6; i++) P(c, 12 + (i % 3) * 4, 8 + Math.floor(i / 3) * 3, '#7a8a9a');
  },
});
tile('keimusho_stool', { solid: true, obj: true, hd(c) { shadowEllipse(c, 16, 27, 7, 2); oval(c, 9, 14, 14, 7, '#5a6a7a'); R(c, 15, 20, 2, 7, '#3a3e46'); R(c, 11, 26, 10, 2, '#3a3e46'); outline(c); } });
tile('keimusho_kiosk', { // the 作業製品 sales counter
  solid: true, obj: true, talkThrough: true,
  hd(c) {
    R(c, 0, 8, 32, 6, '#e8e2d2'); R(c, 0, 8, 32, 1, '#f8f4ea'); R(c, 0, 14, 32, 15, '#7a6046'); R(c, 0, 14, 32, 1, '#5a4430'); R(c, 0, 27, 32, 2, '#5a4430');
    R(c, 3, 3, 8, 6, '#c8a06a'); R(c, 3, 3, 8, 1, '#e0c08a'); R(c, 13, 4, 6, 5, '#f4f4f0'); R(c, 13, 4, 6, 1, '#b8d0e0'); R(c, 21, 2, 8, 7, '#5a7aa8'); R(c, 22, 3, 6, 1, '#8aaad0');
    outline(c);
  },
});
tile('keimusho_planter', { solid: true, obj: true, hd(c) { shadowEllipse(c, 16, 29, 12, 2); R(c, 4, 18, 24, 10, '#9a9a92'); R(c, 4, 18, 24, 2, '#b4b4ac'); for (const [x, y] of [[8, 12], [14, 9], [20, 12], [11, 15], [18, 15]]) disc(c, x, y, 4, '#5a8a4a'); for (const [x, y] of [[8, 11], [14, 8], [20, 11]]) P(c, x, y, '#e8d84a'); outline(c); } });

// ======================================================================== people (all fictional)
const LK = {
  police: { hair: 'cap', hat: '#1e2a50', hairColor: 'black', skin: 'fair', top: '#2a3a6a', bottom: '#1e2a50', tie: '#14182a' },
  policeW: { hair: 'cap', hat: '#1e2a50', hairColor: 'brown', skin: 'light', top: '#2a3a6a', bottom: '#1e2a50', skirt: true, lashes: true },
  shirt: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#c8d4e8', bottom: '#2a3560', tie: '#2a3560' },
  shirtW: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#c8d4e8', bottom: '#2a3560', tie: '#2a3560', skirt: true },
  keiji: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#4a4a52', bottom: '#3a3a40', jacket: true, tie: '#7a2f2f' },
  keiji2: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#5a5248', bottom: '#3a3630', jacket: true, tie: '#2f4a7a', glasses: true },
  hojo: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#5a5e68', bottom: '#3a3e48', jacket: true, tie: '#2a3a6a' },
  kenji: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2a2c38', bottom: '#2a2c38', jacket: true, tie: '#5a5f6b', glasses: true },
  kenjiW: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#2a2c38', bottom: '#2a2c38', jacket: true, skirt: true, glasses: true },
  tokuso: { hair: 'short', hairColor: 'silver', skin: 'fair', top: '#24262e', bottom: '#24262e', jacket: true, tie: '#3a1a1a', glasses: true },
  jimukan: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#3a3e4a', bottom: '#2a2c38', jacket: true, skirt: true },
  jimukanM: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3a3e4a', bottom: '#2a2c38', jacket: true, tie: '#3a3e4a' },
  shien: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#e8dcc8', bottom: '#5a4a3a', jacket: true, skirt: true },
  judge: { hair: 'short', hairColor: 'silver', skin: 'fair', top: '#151518', bottom: '#151518', jacket: true, glasses: true },
  judge2: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#151518', bottom: '#151518', jacket: true },
  judge3: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#151518', bottom: '#151518', jacket: true },
  judge4: { hair: 'slick', hairColor: 'silver', skin: 'tan', top: '#151518', bottom: '#151518', jacket: true },
  judge5: { hair: 'long', hairColor: 'black', skin: 'light', top: '#151518', bottom: '#151518', jacket: true, glasses: true },
  clerk: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#3a3e4a', bottom: '#2a2c38', jacket: true, skirt: true },
  clerkM: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3a3e4a', bottom: '#2a2c38', jacket: true, tie: '#5a5f6b' },
  kokusen: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#3a4a7a', bottom: '#2a3560', jacket: true, skirt: true },
  shisen: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#c9a227' },
  yameken: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#8a1a2c', glasses: true },
  bengo: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3a3a44', bottom: '#2a2a32', jacket: true, tie: '#7a6a2a' },
  defendant: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#5a5e66', bottom: '#3a3e46' },
  defendant2: { hair: 'spiky', hairColor: 'brown', skin: 'tan', top: '#3a4a3a', bottom: '#2a2e2a' },
  keimukan: { hair: 'cap', hat: '#1e2a4a', hairColor: 'black', skin: 'fair', top: '#2a3a5a', bottom: '#1e2a4a', tie: '#20232a' },
  keimukanW: { hair: 'cap', hat: '#1e2a4a', hairColor: 'black', skin: 'light', top: '#2a3a5a', bottom: '#1e2a4a', skirt: true, lashes: true },
  inmate: { hair: 'short', hairColor: 'black', skin: 'fair', top: PP.uniform, bottom: PP.uniformD },
  inmate2: { hair: 'bald', hairColor: 'black', skin: 'tan', top: PP.uniform, bottom: PP.uniformD },
  inmate3: { hair: 'short', hairColor: 'silver', skin: 'fair', top: PP.uniform, bottom: PP.uniformD, glasses: true },
  inmate4: { hair: 'spiky', hairColor: 'black', skin: 'brown', top: PP.uniform, bottom: PP.uniformD },
  inmate5: { hair: 'short', hairColor: 'brown', skin: 'light', top: PP.uniform, bottom: PP.uniformD },
  kyouiku: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#6a7a5a', bottom: '#3a3e36', jacket: true },
  iin: { hair: 'bald', hairColor: 'white', skin: 'tan', top: '#6a5a4a', bottom: '#4a4038', jacket: true, glasses: true },
  iin2: { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#5a5a6a', bottom: '#3a3a4a', jacket: true, skirt: true },
  guard: LOOKS.guard,
  annai: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#5a6a8a', bottom: '#2a3560', jacket: true, skirt: true },
  kisha: { hair: 'cap', hat: '#5a4a3a', hairColor: 'brown', skin: 'tan', top: '#8a7a5a', bottom: '#4a4038' },
  kisha2: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#4a5a6a', bottom: '#2a3040', jacket: true },
  citizens: [
    { hair: 'short', hairColor: 'black', skin: 'fair', top: '#5a7a9a', bottom: '#3a3e48' },
    { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#c87a8a', bottom: '#4a4a5a', skirt: true },
    { hair: 'bald', hairColor: 'white', skin: 'tan', top: '#8a6a4a', bottom: '#5a4a3a', glasses: true },
    { hair: 'long', hairColor: 'black', skin: 'light', top: '#7a9a6a', bottom: '#3a3a44', skirt: true },
    { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#3b3f48', bottom: '#3b3f48', jacket: true, tie: '#9a3a3a' },
    { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#9273bd', bottom: '#5a4a6a', skirt: true },
    { hair: 'spiky', hairColor: 'black', skin: 'tan', top: '#d8a040', bottom: '#3a4a7a' },
    { hair: 'short', hairColor: 'brown', skin: 'light', top: '#e8e4d8', bottom: '#5a6a7a', glasses: true },
  ],
};
const WHO = {
  uketsuke: { name: '総合受付の警察官', look: LK.policeW },
  uketsuke2: { name: '受付の警察官', look: LK.police },
  soudanUke: { name: '相談受付', look: LK.shirtW },
  ishitsu: { name: '遺失物係', look: LK.shirt },
  seian: { name: '生活安全課の警察官', look: LK.shirtW },
  seian2: { name: '生活安全課の警察官', look: LK.shirt },
  keiji: { name: '刑事', look: LK.keiji },
  keiji2: { name: '刑事', look: LK.keiji2 },
  hojo: { name: '取調べ補助の警察官', look: LK.hojo },
  ryuchi: { name: '留置係', look: LK.police },
  kenji: { name: '検察官', look: LK.kenji },
  kenjiW: { name: '検察官', look: LK.kenjiW },
  tokuso: { name: '特捜部の検事', look: LK.tokuso },
  jimukan: { name: '検察事務官', look: LK.jimukan },
  jimukanM: { name: '検察事務官', look: LK.jimukanM },
  shien: { name: '被害者支援員', look: LK.shien },
  kenUke: { name: '検察庁の受付', look: LK.annai },
  guard: { name: '警備員', look: LK.guard },
  chief: { name: '裁判長', look: LK.judge },
  judge: { name: '裁判官', look: LK.judge },
  clerk: { name: '裁判所書記官', look: LK.clerk },
  clerkM: { name: '裁判所書記官', look: LK.clerkM },
  saiAnnai: { name: '裁判所の案内係', look: LK.annai },
  hasanClerk: { name: '破産係の書記官', look: LK.clerk },
  minjiClerk: { name: '簡裁の民事受付', look: LK.clerkM },
  tour: { name: '見学の案内係', look: LK.annai },
  prosecutor: { name: '検察官', look: LK.kenjiW },
  bengo: { name: '弁護人', look: LK.bengo },
  keimukan: { name: '刑務官', look: LK.keimukan },
  keimukanW: { name: '刑務官', look: LK.keimukanW },
  kyouiku: { name: '教育専門官', look: LK.kyouiku },
  iin: { name: '委員', look: LK.iin },
  menkaiUke: { name: '面会受付の職員', look: LK.keimukanW },
  shop: { name: '作業製品の販売係', look: { ...LK.annai, top: '#6a7a5a' } },
};
const S = (who) => (who ? { name: who.name, look: who.look } : {});
const say = (g, who, pages) => g.say(pages, S(who));
const ask = (g, who, pages, choices, opts = {}) => g.ask(pages, choices, { ...S(who), ...opts });
const narrate = (g, pages) => g.say(pages);
const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });
// An NPC whose name / look are read when the room loads (the map copies them at instantiate).
function dyn(id, x, y, dir, whoFn, extra = {}) {
  const e = { type: 'npc', id, x, y, dir, ...extra };
  Object.defineProperty(e, 'look', { enumerable: true, get() { const g = G(); try { return (g && whoFn(g).look) || LOOKS.salaryman; } catch (err) { return LOOKS.salaryman; } } });
  Object.defineProperty(e, 'name', { enumerable: true, get() { const g = G(); try { return (g && whoFn(g).name) || ''; } catch (err) { return ''; } } });
  return e;
}
// turn a seated NPC back to its post after talking
const posted = (dir, fn) => async (g, e) => { await fn(g, e); if (e) e.dir = dir; };
const lines = (who, list) => (g) => say(g, who, list);

// ---------------------------------------------------------------- props
const B = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
// A desk / bench someone sits behind: solid on its row and drawn after the people on that row, so their legs
// are hidden and they look seated. lip = how much of the tile (units, from the bottom) the top covers.
function deskProp(x, y, w, style = 'wood', opts = {}) {
  const pal = {
    wood: ['#9a7250', '#b48a62', '#7a5638', '#5a3e26'],
    bench: [PC.benchL, '#a07448', PC.bench, PC.benchD],
    steel: [PB.steelL, '#e4e8ee', PB.steel, PB.steelD],
    light: ['#c8a878', '#e0c49a', '#a8885a', '#7a5a3a'],
    grey: ['#8a7a5a', '#a8946c', '#6e6046', '#4e4432'],
  }[style] || style;
  const lip = opts.lip ?? 8;
  const drop = opts.drop ?? 6;
  return {
    type: 'prop', x, y, w, h: 1, z: 3, solid: opts.solid !== false,
    draw(ctx, sx, sy, g) {
      const W = w * 16;
      const top = sy + 16 - lip;
      const H = lip + drop;
      B(ctx, sx + 1, top + H, W - 2, 1.5, 'rgba(0,0,0,0.22)');
      B(ctx, sx, top, W, 3, pal[0]); B(ctx, sx, top, W, 0.5, pal[1]); B(ctx, sx, top + 3, W, 0.5, pal[3]);
      B(ctx, sx + 0.5, top + 3.5, W - 1, H - 3.5, pal[2]);
      B(ctx, sx + 0.5, top + 3.5, W - 1, 0.5, shade(pal[2], -0.25));
      if (W > 20 && !opts.closed) for (let i = 0; i < w; i++) { B(ctx, sx + i * 16 + 3, top + 6, 10, H - 9, shade(pal[2], 0.07)); B(ctx, sx + i * 16 + 3, top + 6, 10, 0.5, shade(pal[2], -0.2)); }
      B(ctx, sx + 0.5, top + H - 0.5, W - 1, 0.5, pal[3]);
      if (opts.papers) for (const k of opts.papers) { B(ctx, sx + k * 16 + 4, top + 0.5, 6, 2, '#f4f0e4'); B(ctx, sx + k * 16 + 5, top + 1, 4, 0.5, '#9a9a9a'); }
      const mons = typeof opts.mons === 'function' ? opts.mons(g) : opts.mons;
      if (mons) for (const k of mons) { B(ctx, sx + k * 16 + 3.5, top - 2.5, 9, 3, '#2a2e36'); B(ctx, sx + k * 16 + 4, top - 2, 8, 2, '#7a9ab8'); B(ctx, sx + k * 16 + 4.5, top - 2, 3, 0.5, '#c8dcea'); }
      if (opts.plates) for (const k of opts.plates) { B(ctx, sx + k * 16 + 5, top + 4.5, 6, 2, '#d8c060'); }
      if (opts.mic) for (const k of opts.mic) { B(ctx, sx + k * 16 + 11, top - 4, 0.5, 4, '#3a3a3a'); B(ctx, sx + k * 16 + 10.5, top - 5, 1.5, 1.5, '#1a1a1a'); }
      outlineRect(ctx, sx, top, W, H);
    },
    ...(opts.text ? { text: opts.text } : {}),
    ...(opts.talk ? { talk: opts.talk } : {}),
  };
}
function outlineRect(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(34,32,42,0.75)';
  ctx.fillRect(x - 0.5, y - 0.5, w + 1, 0.5); ctx.fillRect(x - 0.5, y + h, w + 1, 0.5);
  ctx.fillRect(x - 0.5, y, 0.5, h); ctx.fillRect(x + w, y, 0.5, h);
}
// The backrest of a gallery bench, drawn over the people sitting on it (they face the bench, backs to us).
function backrestProp(x, y, w) {
  return {
    type: 'prop', x, y, w, h: 1, z: 3, solid: false,
    draw(ctx, sx, sy) {
      const W = w * 16;
      B(ctx, sx, sy + 9.5, W, 4.5, PC.bench); B(ctx, sx, sy + 9.5, W, 1, PC.benchL); B(ctx, sx, sy + 13.5, W, 1, PC.benchD);
      for (let i = 0; i < w; i++) B(ctx, sx + i * 16 + 1, sy + 14.5, 1, 1.5, PC.benchD);
    },
  };
}
// A name plate on the wall.
function plate(x, y, label, w = 2, bg = '#2a3560', fg = '#ffffff') {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy) {
      const lab = typeof label === 'function' ? label(G()) : label;
      const tw = Math.ceil(measure(ctx, lab, 8)) + 8;
      const px = Math.round(sx + (w * 16 - tw) / 2), py = Math.round(sy + 3);
      B(ctx, px, py, tw, 11, shade(bg, -0.35));
      B(ctx, px + 0.5, py + 0.5, tw - 1, 10, bg);
      text(ctx, lab, px + tw / 2, py + 1.5, { size: 8, align: 'center', color: fg, shadow: null });
    },
  };
}
// The 護送車 (a prisoner transport bus) parked in the prison yard.
function busProp(x, y, cond) {
  return {
    type: 'prop', x, y, w: 4, h: 2, solid: true, cond,
    draw(ctx, sx, sy) {
      B(ctx, sx + 2, sy + 28, 60, 3, 'rgba(0,0,0,0.25)');
      B(ctx, sx, sy + 4, 64, 24, '#2a3a5a'); B(ctx, sx, sy + 4, 64, 1.5, '#4a5a7a'); B(ctx, sx, sy + 26.5, 64, 1.5, '#1a2236');
      for (let i = 0; i < 6; i++) { B(ctx, sx + 4 + i * 10, sy + 8, 8, 6, '#5a6a7a'); for (let k = 0; k < 4; k++) B(ctx, sx + 5 + i * 10 + k * 2, sy + 8, 0.5, 6, '#2a3040'); }
      B(ctx, sx + 1, sy + 17, 62, 2, '#e8e8e0');
      for (const wx of [10, 50]) { B(ctx, sx + wx - 4, sy + 25, 8, 6, '#1a1a1a'); B(ctx, sx + wx - 2, sy + 27, 4, 2, '#5a5a5a'); }
      outlineRect(ctx, sx, sy + 4, 64, 24);
    },
  };
}
// A camera on the 取調室 wall (録音・録画 equipment).
function camProp(x, y, cond) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: false, cond,
    draw(ctx, sx, sy, g) {
      B(ctx, sx + 6.5, sy + 2, 3, 1, '#2a2e36'); B(ctx, sx + 7.5, sy + 3, 1, 3, '#3a3e46');
      B(ctx, sx + 4, sy + 6, 8, 4.5, '#3a3e46'); B(ctx, sx + 4, sy + 6, 8, 0.5, '#5a5e66');
      B(ctx, sx + 5, sy + 7, 2.5, 2.5, '#1a1c22'); B(ctx, sx + 5.5, sy + 7.5, 1, 1, '#8ab0d0');
      if (Math.floor((g.frame || 0) / 30) % 2) B(ctx, sx + 10, sy + 6.5, 1, 1, '#ff3a3a');
    },
  };
}

// ---------------------------------------------------------------- exits
// Out to the street: the building's door in the town when the town has one, else the town / Tokyo.
function streetSpot() {
  if (PLACES.nagatacho) return { town: 'nagatacho' };
  return { town: 'tokyo' };
}
function exitWarps(pid, xs, y) {
  const out = [];
  for (const x of xs) {
    out.push({ x, y, to: 'exit', cond: () => !!doorIndexFor(pid) });
    out.push({ x, y, dir: 'down', cond: () => !doorIndexFor(pid), get place() { return streetSpot().town; } });
  }
  return out;
}
// A door out of a custody room: refused while held.
const heldCheck = (msg) => async (g) => {
  const j = jus(g);
  if (j && (j.status === 'detained' || j.status === 'prison')) { await narrate(g, msg || '（勝手に出ることはできない…）'); return false; }
  return true;
};

// ======================================================================== 警視庁
// ---------------------------------------------------------------- 相談（生活安全課）
const lawyerPlace = (g) => (since(g, 2006, 10) ? '法テラス（日本司法支援センター）や弁護士会' : '弁護士会の法律相談センター');
function soudanNumber(g) {
  if (since(g, 2009, 1)) return '緊急のときは110番。相談だけなら、\n警察の相談専用電話「#9110」でも受け付けています。';
  return '緊急のときは、ためらわずに110番を。\n相談は、警察署の窓口でいつでも受け付けています。';
}
async function consultYamikin(g, who) {
  const j = jus(g);
  const yami = ((j && j.loans) || []).filter((l) => l && l.lender === 'yamikin' && l.status !== 'void' && l.status !== 'paid');
  if (yami.length && typeof g.policeConsult === 'function') {
    await g.policeConsult('yamikin');
    await say(g, who, [`それから、${lawyerPlace(g)}にも相談してください。\n業者に「受任通知」を送れば、取り立ては止まります。`, '脅しの電話やメッセージは、消さずに残しておいて。\n証拠になりますからね。']);
    return;
  }
  const pages = [];
  if (since(g, 2008, 6)) pages.push('登録のない業者や、法律の上限をこえる利息で貸す\n「闇金」は犯罪です。年109.5%をこえる契約は無効で、\n最高裁は、元本も返さなくてよいとしています。');
  else pages.push('登録のない業者や、出資法の上限をこえる利息で\n貸すのは犯罪です。そういう契約の利息は、\n払う必要がありません。');
  pages.push(since(g, 2004, 1) ? '貸金業者でも、夜9時から朝8時までの取り立てや、\n職場への押しかけ、家族に返済を迫ることは\n法律で禁止されています。' : since(g, 1983, 11) ? '貸金業者でも、脅したり、夜中に押しかけたりして\n取り立てることは、法律で禁止されています。' : '取り立てで脅したり、家族や職場に押しかけるのは\n許されません。');
  pages.push('「口座を売れば借金をチャラに」という話は、\nあなたが犯罪者にされる罠です。絶対に応じないで。');
  pages.push(soudanNumber(g));
  await say(g, who, pages);
}
async function consultStalker(g, who) {
  const pages = [];
  if (!since(g, 2000, 11)) {
    pages.push('つきまといを直接取り締まる法律は、まだありません。\nでも、脅迫や住居侵入、迷惑行為にあたれば\n警察は動けます。');
  } else {
    pages.push('ストーカー規制法では、つきまといや待ち伏せ、\nしつこい電話やメッセージなどが規制されています。');
    pages.push(since(g, 2017, 6) ? '警察が「警告」をしたり、公安委員会が「禁止命令」を\n出したりできます。危険なときは、警告をしなくても\nすぐに禁止命令を出せるようになりました。' : '警察から相手に「警告」をし、それでもやめなければ\n公安委員会が「禁止命令」を出します。\n命令に違反すれば、罰則があります。');
  }
  pages.push('いつ・どこで・何をされたか、メモに残してください。\nメッセージや着信の記録は、消さずに保存を。');
  if (g.state.fame >= 250) pages.push('有名な方は、ファンを名乗る人に狙われることもあります。\n事務所とも情報を共有して、ひとりで帰らない工夫を。');
  pages.push(soudanNumber(g));
  const k = await ask(g, who, pages, ['防犯の指導を受ける', '話を聞いてもらえた']);
  if (k === 0) {
    await say(g, who, ['帰り道を毎日変える、防犯ブザーを持つ、\n家の前で鍵を探さないように準備しておく…。', 'パトロールも強化しておきます。\nいつでも、また来てくださいね。']);
    g.addNeed('stress', -6);
  } else g.addNeed('stress', -3);
  fl(g).stalkerConsult = day(g);
}
async function consultFraud(g, who) {
  const pages = [];
  if (!since(g, 1996, 1)) {
    pages.push('「絶対にもうかる」という話や、高額な商品を\n売りつける訪問販売には、気をつけてください。\n契約してしまったら、まず消費生活センターに。');
    pages.push('訪問販売などは、決められた期間なら\n「クーリング・オフ」で契約を取り消せることもあります。');
  } else if (!since(g, 2004, 12)) {
    pages.push('身に覚えのない請求のハガキや電話は、\n払わない・連絡しないのがいちばんです。\n「架空請求」という手口です。');
  } else {
    pages.push(since(g, 2011, 1) ? 'オレオレ詐欺や還付金詐欺など、電話で人をだまして\nお金をとる「特殊詐欺」が、あとをたちません。' : '家族を名乗ってお金をだましとる「振り込め詐欺」が\n急増しています。');
    pages.push('家族の声でも、いったん電話を切って、\n本人のいつもの番号にかけなおしてください。');
    if (since(g, 2023, 1)) pages.push('最近は、警察官を名乗る電話やビデオ通話で\n「あなたの口座が犯罪に使われている」と\n言う手口も多いんです。');
    pages.push('警察官や銀行の人が、キャッシュカードや暗証番号を\n預かることは、絶対にありません。');
    if (since(g, 2008, 6)) pages.push('お金を振り込んでしまったら、すぐに振込先の銀行へ。\n口座を止めてもらえれば、法律にもとづいて\n残っているお金が被害者に分配されることがあります。');
  }
  pages.push(since(g, 2015, 7) ? 'お金のトラブル全般は、消費者ホットライン「188」へ。\n近くの消費生活センターにつながります。' : since(g, 2010, 1) ? 'お金のトラブル全般は、消費者ホットラインへ。\n近くの消費生活センターにつながります。' : 'お金のトラブル全般は、消費生活センターへ。');
  await say(g, who, pages);
  g.addNeed('stress', -3);
}
async function consultMenu(g, who) {
  for (;;) {
    const k = await ask(g, who, 'どんなご相談ですか？\n（話した内容の秘密は守ります）', ['闇金の被害', 'ストーカー', '詐欺の電話', '自首したい', 'やめる'], { cancel: 4 });
    if (k === 0) await consultYamikin(g, who);
    else if (k === 1) await consultStalker(g, who);
    else if (k === 2) await consultFraud(g, who);
    else if (k === 3) { await jishu(g, who); return; }
    else { await say(g, who, 'ひとりで抱えこまないでくださいね。\nお気をつけて。'); return; }
    const again = await ask(g, who, 'ほかに、ご相談はありますか？', ['もうひとつ相談する', 'これで大丈夫です'], { cancel: 1 });
    if (again !== 0) { await say(g, who, 'いつでも来てください。\nお気をつけて。'); return; }
  }
}

// ---------------------------------------------------------------- 自首
// 刑法42条: 捜査機関に発覚する前に自首したときは、刑を減軽することができる。An undetected offence (heat) is reported
// in person; the core's arrest() then runs the procedure (small cases end as 書類送検), and the 'arrested' hook below
// counts the surrender in the case (反省).
let JISHU = null;
onJustice('arrested', (g, info) => {
  try {
    if (!JISHU || !info || info.crime !== JISHU.id || day(g) - JISHU.day > 1) return;
    const j = jus(g);
    const cs = (j.cases || []).find((c) => c.id === info.caseId);
    if (cs) { cs.remorse = Math.max(cs.remorse || 0, JISHU.legal ? 1.5 : 1); cs.jishu = JISHU.legal ? 'jishu' : 'shuto'; cs.plea = 'admit'; }
    JISHU = null;
  } catch (e) { console.error(e); }
});
async function jishu(g, who) {
  const j = jus(g);
  if (!j || typeof g.arrest !== 'function') { await say(g, who, 'ご用件は、受付でうかがいます。'); return; }
  if (j.status === 'detained' || j.status === 'prison') return;
  const ids = Object.keys(j.heat || {}).filter((id) => CRIMES[id] && CRIMES[id].kind === 'crime' && !(j.cases || []).some((c) => !c.closed && c.crime === id));
  if (!ids.length) { await say(g, who, ['自首、ですか…？', 'お話を聞くかぎり、事件にあたることは\nなさそうですね。困りごとなら、相談窓口へどうぞ。']); return; }
  const items = ids.map((id) => crimeName(id)).concat(['やっぱりやめる']);
  const k = await ask(g, null, '（どのことを話そう…）', items, { cancel: items.length - 1 });
  if (k < 0 || k >= ids.length) { await narrate(g, '（言い出せなかった…）'); return; }
  const id = ids[k];
  if (id === 'tax_evasion') {
    await say(g, who, ['税金の申告のことでしたら、まず税務署へ。\n自分から修正申告をすれば、扱いが軽くなることも\nあります。']);
    return;
  }
  const h = j.heat[id];
  const known = !!(h && h.queued) || (j.queue || []).some((e) => e.crime === id);
  const pages = [`${crimeName(id)}の件、ですね。`];
  pages.push(known ? '…この件は、もう捜査が始まっているようです。\nそれでも、自分から来たことは、ちゃんと記録します。' : '捜査機関に知られる前に、自分から申し出ることを\n「自首」といいます。刑が軽くなることがあります。（刑法42条）');
  pages.push('担当の刑事が話を聞きます。\n…本当に、いいですね？');
  const c = await ask(g, who, pages, ['すべて話す', 'やっぱりやめる'], { cancel: 1 });
  if (c !== 0) { await say(g, who, '…わかりました。\n気持ちが決まったら、いつでも来てください。'); return; }
  if (h) h.queued = true; // do not let it "surface" again while this case runs
  j.queue = (j.queue || []).filter((e) => !(e.crime === id && ['arrest', 'summons', 'weekly'].includes(e.type)));
  JISHU = { id, day: day(g), legal: !known };
  await narrate(g, '（刑事課の刑事が下りてきた。\n奥の取調室に案内された…）');
  fl(g).jishu = (fl(g).jishu || 0) + 1;
  const sev = CRIMES[id].severity || 2;
  await g.arrest(id, { via: 'warrant', evidence: 0.92, amount: h ? h.amount : 0, injury: h ? h.injury : false, request: h ? h.request : undefined, plea: 'admit', askPlea: false, skipArrestScene: true, zaitaku: sev <= 2, source: '自首' });
  JISHU = null;
}

// ---------------------------------------------------------------- 遺失物
// 遺失物法: 拾った物は警察へ。落とし主が見つかれば報労金（価格の5〜20%）。保管期間は3か月（2007年12月から。前は6か月）、
// 過ぎれば拾った人のものに（カードなど個人情報の入った物は除く）。
const keepPeriod = (g) => (since(g, 2007, 12) ? '3か月' : '6か月');
const lostState = (g) => { const f = fl(g); if (!f.lost || typeof f.lost !== 'object') f.lost = {}; return f.lost; };
async function ishitsuTalk(g, npcE) {
  const L = lostState(g);
  const who = WHO.ishitsu;
  const items = [];
  if (L.holding) items.push('拾った財布を届ける');
  items.push('落とし物をさがす', '遺失物のきまり', 'やめる');
  const k = await ask(g, who, '遺失物の窓口です。\n落とし物の届け出と、お問い合わせはこちらへ。', items, { cancel: items.length - 1 });
  const pick = items[k];
  if (pick === '拾った財布を届ける') {
    await say(g, who, ['届けてくださって、ありがとうございます。\n拾った場所と時間を、この用紙に書いてください。', `中身は現金${fmtMoney(L.value || 8000)}と、カードが数枚ですね。\n「拾得物件預り書」をお渡しします。`]);
    const c = await ask(g, who, ['落とし主が見つかったら、お礼（報労金）を\n受け取る権利があります。価格の5〜20%です。', 'あなたの連絡先を、落とし主に伝えてもいいですか？'], ['権利を残す', '権利を放棄する']);
    L.holding = false;
    L.handed = day(g);
    L.keep = c === 0;
    L.owner = (L.seed || 1) % 5 !== 0; // most owners are found
    L.due = day(g) + (L.owner ? 3 + ((L.seed || 0) % 4) : (since(g, 2007, 12) ? 40 : 60));
    L.done = false;
    g.addNeed('stress', -4);
    await say(g, who, L.keep ? `落とし主が見つかったら、ご連絡します。\n見つからなければ、${keepPeriod(g)}たったあとに\n現金はあなたが受け取れます。` : 'わかりました。\n落とし主さんも、きっと助かりますよ。');
    return;
  }
  if (pick === '落とし物をさがす') {
    const i = await ask(g, who, '何をなくしましたか？', [era(g) === 'reiwa' ? 'スマホ' : era(g) === 'heisei' ? 'ケータイ' : '手帳', '財布', '傘', 'やめる'], { cancel: 3 });
    if (i === 3) return;
    await say(g, who, ['「遺失届」を受け付けました。\n届いていれば、こちらから連絡します。', since(g, 2007, 12) ? '警察に届いた落とし物は、ホームページでも\n探せますよ。駅やお店に問い合わせるのも忘れずに。' : '駅やお店にも、問い合わせてみてくださいね。']);
    return;
  }
  if (pick === '遺失物のきまり') {
    await say(g, who, ['拾った物は、すぐに警察か、拾った場所の\n施設（駅・お店）に届けてください。', `落とし主が見つかれば、拾った人は価格の5〜20%の\nお礼を受け取れます。保管期間は${keepPeriod(g)}です。`, '自分のものにしてしまうと、遺失物等横領罪という\n犯罪になります。…正直がいちばんですね。']);
  }
}
// The owner thanks you (or the item is yours after the keeping period).
onMorning((g) => {
  try {
    if (!g.state) return;
    const f = g.state.flags.jpl;
    const L = f && f.lost;
    if (L && L.handed && !L.done && day(g) >= L.due) {
      L.done = true;
      if (!L.keep) return;
      const cash = L.value || 8000;
      if (L.owner) {
        const reward = Math.round((cash * (0.1 + ((L.seed || 0) % 3) * 0.05)) / 100) * 100;
        g.addMoney(reward, true);
        g.message({ from: '警視庁 遺失物係', kind: 'chat', text: `先日届けていただいた財布の落とし主が見つかりました。\n「本当に助かりました」とのことです。\nお礼（報労金）${fmtMoney(reward)}をお預かりしています。` });
      } else {
        g.addMoney(cash, true);
        g.message({ from: '警視庁 遺失物係', kind: 'chat', text: `届けていただいた財布は、保管期間がすぎても\n落とし主が見つかりませんでした。現金${fmtMoney(cash)}はあなたのものになります。\n（カード類は、法律により持ち主側で処分されます）` });
      }
    }
  } catch (e) { console.error(e); }
});
async function foundWallet(g) {
  const L = lostState(g);
  await narrate(g, 'ベンチの上に、黒い財布が置き忘れられている…。');
  const k = await ask(g, null, '（どうしよう）', ['遺失物係に届ける', 'さわらずにおく']);
  if (k !== 0) { await narrate(g, '（だれかが気づいてくれるだろう…）'); L.skipped = day(g); return; }
  L.holding = true;
  L.found = day(g);
  L.seed = (day(g) * 7 + 3) % 97;
  L.value = 5000 + (L.seed % 6) * 3000;
  await narrate(g, '（財布を拾った。すぐそこの遺失物係に届けよう）');
}
const walletHere = (g) => { const L = g.state && g.state.flags.jpl && g.state.flags.jpl.lost; return !(L && (L.holding || (L.found && day(g) - L.found < 12) || L.skipped === day(g))) && day(g) % 3 === 1; };

// ---------------------------------------------------------------- lobby people
async function uketsukeTalk(g) {
  const who = WHO.uketsuke;
  const k = await ask(g, who, `${PLACES[KEI].name}の総合受付です。\nご用件をどうぞ。`, ['相談がある', '自首したい', 'ここについて', 'やめる'], { cancel: 3 });
  if (k === 0) {
    await say(g, who, '生活安全課の相談ですね。\n奥の相談室で、担当の者がお話をうかがいます。');
    await g.goto(KEI, 'sodan', 6, 4, 'up');
    await consultMenu(g, WHO.seian);
  } else if (k === 1) await jishu(g, who);
  else if (k === 2) await say(g, who, ['警視庁は、東京都の警察です。この本部庁舎のほかに、\n都内に100をこえる警察署と、たくさんの交番があります。', '事件や事故は110番。困りごとの相談は、\nこの窓口か、近くの警察署・交番へどうぞ。']);
  else await say(g, who, 'お気をつけて。');
}
async function soudanUkeTalk(g) {
  await say(g, WHO.soudanUke, ['相談の受付です。\n闇金やストーカー、詐欺の被害など…\nどんなことでも、まずはお話を聞かせてください。']);
  await g.goto(KEI, 'sodan', 6, 4, 'up');
  await consultMenu(g, WHO.seian);
}
function oldLadyLines(g) {
  if (!since(g, 1996, 1)) return ['訪問販売で、高い羽毛布団を買わされてね…。\n断りきれなかったのよ。', '受付の人が「クーリング・オフ」というのを\n教えてくれたの。まだ間に合うかしら。'];
  if (!since(g, 2004, 1)) return ['身に覚えのない請求のハガキが届いてね。\n「至急連絡を」なんて書いてあるのよ。', '警察の人に「連絡しちゃだめ」って言われて、\nほっとしたわ。'];
  if (!since(g, 2023, 1)) return ['孫を名乗る電話で「会社のお金をなくした」って…。\n銀行に行く前に、娘に電話してよかったわ。', '声がそっくりだったのよ。\n…ほんとうに、こわいわねえ。'];
  return ['警察官を名乗る人から電話でね。\n「あなたの口座が犯罪に使われている」って。', 'ビデオ通話で、逮捕状まで見せられたのよ。\n本物の警察の人に聞いたら「全部うそ」ですって。'];
}

// ---------------------------------------------------------------- free-visit texts in the custody rooms
async function torishirabeFree(g) {
  await say(g, WHO.keiji2, ['ここは取調室だ。事件の関係者に、話を聞く部屋だよ。', '取調べの前には、かならず伝えることがある。\n「言いたくないことは、言わなくていい」――\n黙秘権（供述拒否権）だ。', '話したことは「供述調書」にまとめて、読み聞かせる。\n間違いがあれば直せるし、納得できなければ\n署名を断ることもできる。']);
  await say(g, WHO.keiji2, since(g, 2019, 6)
    ? ['裁判員裁判の対象になる事件などは、\n取調べの最初から最後まで、録音・録画する決まりだ。', '…まあ、ここに用ができないのがいちばんだな。']
    : since(g, 2009, 4) ? ['夜遅くの取調べや、一日に長時間の取調べには、\n上の者の承認がいる決まりになった。', '…まあ、ここに用ができないのがいちばんだな。'] : ['…まあ、ここに用ができないのがいちばんだな。']);
}
async function ryuchiFree(g) {
  await say(g, WHO.ryuchi, ['ここは留置場です。逮捕された人が、\n取調べや検察庁への送致のあいだ、ここで過ごします。', '朝は早く起きて布団を片づけ、点呼。\n決まった時間に運動や入浴があります。', '弁護士との面会（接見）は、いつでもできます。\n家族の面会は、平日の昼間に短い時間だけ。\n警察官が立ち会います。']);
  await say(g, WHO.ryuchi, '関係者以外は入れない場所です。\n…ロビーまでお送りしますね。');
  await g.goto(KEI, 'lobby', 13, 2, 'down');
}
// 留置場では私服（ひものない服や、貸与のスウェット）のまま
const KEI_CELLMATES = [
  [3, 4, { hair: 'short', hairColor: 'brown', skin: 'light', top: '#5a6070', bottom: '#3a3e48' }],
  [10, 4, LK.defendant2],
  [11, 3, { hair: 'short', hairColor: 'silver', skin: 'fair', top: '#7a6a5a', bottom: '#4a4a52', glasses: true }],
];
const ryuchiNo = (g) => { const cs = activeCase(g); return 10 + (((cs && Number(cs.id)) || 7) * 7) % 40; };
const inCustody = (g) => { const j = jus(g); return !!(j && (j.custody || j.status === 'detained')); };

registerPlace({
  id: KEI,
  name: '警視庁',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: 9, y: 8, dir: 'up' },
  legend: { '#': 'keisatsu_walltop', '=': 'keisatsu_wall', M: 'exit_mat' },
  floor: 'keisatsu_floor',
  rooms: {
    // -------------------------------------------------------------- 1階ロビー
    lobby: {
      floor: 'keisatsu_floor',
      tiles: [
        '####################',
        '#====aDb====wXcw===#',
        '#....|.|....|.|....#',
        '#CCCC...KKKK...LLLL#',
        '#..................#',
        '#..................#',
        '#.qqq..........qqq.#',
        '#..................#',
        '#R................P#',
        '#########MM#########',
      ],
      legend: {
        a: 'keisatsu_wall+keisatsu_poster', b: 'keisatsu_wall+keisatsu_poster', c: 'keisatsu_wall+keisatsu_poster',
        w: 'keisatsu_wall+window', D: 'keisatsu_door', X: 'keisatsu_door_lock', '|': 'keisatsu_partition',
        C: 'keisatsu_counter', K: 'keisatsu_counter', L: 'keisatsu_counter', q: 'keisatsu_bench', R: 'keisatsu_rack', P: 'plant',
      },
      warps: [
        ...exitWarps(KEI, [9, 10], 9),
        { x: 6, y: 1, room: 'sodan', tx: 6, ty: 7, dir: 'up' },
      ],
      entities: [
        plate(1, 1, '相談受付', 4),
        plate(8, 1, '総合受付', 4),
        plate(15, 1, '遺失物', 4),
        npc('kei_soudan', 2, 2, 'down', WHO.soudanUke, { talk: posted('down', soudanUkeTalk) }),
        npc('kei_uketsuke', 9, 2, 'down', WHO.uketsuke, { talk: posted('down', uketsukeTalk) }),
        npc('kei_uketsuke2', 10, 2, 'down', WHO.uketsuke2, {
          talk: posted('down', lines(WHO.uketsuke2, ['事件・事故はもちろん、困りごとの相談もどうぞ。', '「こんなことで」と思わなくていいんです。\n早めの相談が、事件を防ぎます。'])),
        }),
        npc('kei_ishitsu', 16, 2, 'down', WHO.ishitsu, { talk: posted('down', ishitsuTalk) }),
        npc('kei_tachiban', 12, 7, 'down', { name: '立番の警察官', look: LK.police }, {
          talk: posted('down', lines({ name: '立番の警察官', look: LK.police }, ['ご用件は、正面の総合受付へどうぞ。', '奥の扉から先は、関係者以外は立ち入りできません。'])),
        }),
        npc('kei_oldlady', 4, 7, 'up', { name: '相談に来たおばあさん', look: LOOKS.oldwoman }, {
          talk: async (g) => { await say(g, { name: '相談に来たおばあさん', look: LOOKS.oldwoman }, oldLadyLines(g)); },
        }),
        npc('kei_bike', 15, 5, 'left', { name: '被害届を出しに来た人', look: LK.citizens[6] }, {
          wander: 1,
          text: ['自転車を盗まれちゃって。被害届を出しに来たんです。', '防犯登録の番号を控えておいて、助かりました。\n見つかったら連絡をくれるそうです。'],
        }),
        npc('kei_kid', 13, 4, 'up', { name: '男の子', look: LOOKS.kid }, {
          talk: async (g) => {
            await say(g, { name: '男の子', look: LOOKS.kid }, ['道で100円玉ひろったから、届けにきたの！', '…おまわりさん、「えらいね」って\n用紙に名前を書かせてくれたんだ！']);
            await g.emote('kei_ishitsu', '♪');
          },
        }),
        {
          type: 'sign', x: 18, y: 8,
          talk: async (g) => {
            const t = since(g, 2004, 12) ? (since(g, 2011, 1) ? '観葉植物の横に、ポスターが貼ってある。\n「その電話、詐欺かも！一度切って家族に確認」' : '観葉植物の横に、ポスターが貼ってある。\n「振り込め詐欺に注意！振り込む前に、まず相談」') : '観葉植物の横に、ポスターが貼ってある。\n「悪質な訪問販売に注意」「自転車には鍵を」';
            await narrate(g, t);
          },
        },
        { type: 'sign', x: 13, y: 1, text: '扉に「関係者以外立入禁止」の札。\nこの奥に、取調室や留置場があるらしい。' },
        { // a wallet left on the bench (the 遺失物 event below)
          type: 'prop', x: 16, y: 6, w: 1, h: 1, z: 4, solid: false, cond: walletHere,
          draw(ctx, sx, sy) { B(ctx, sx + 4, sy + 5, 8, 5, '#26242c'); B(ctx, sx + 4, sy + 5, 8, 1, '#4a4652'); B(ctx, sx + 10, sy + 7, 2, 1.5, '#c9a227'); outlineRect(ctx, sx + 4, sy + 5, 8, 5); },
        },
        { type: 'sign', x: 1, y: 8, talk: async (g) => { await narrate(g, since(g, 2009, 1) ? 'パンフレットが並んでいる。\n「警察相談専用電話 #9110」「闇金融に注意」\n「ストーカー被害の相談」…' : 'パンフレットが並んでいる。\n「悪質商法に注意」「街金・サラ金の相談」…'); } },
      ],
      events: [
        { x: 15, y: 6, w: 3, on: 'action', cond: walletHere, run: foundWallet },
        { x: 2, y: 6, w: 3, on: 'action', run: async (g) => { await narrate(g, '待合のベンチだ。\n書類を書きながら、順番を待っている人がいる。'); } },
      ],
      onEnter: (g) => { enteredByFlow(g, KEI, 'lobby'); },
    },

    // -------------------------------------------------------------- 相談室（生活安全課）
    sodan: {
      floor: 'keisatsu_floor',
      tiles: [
        '##############',
        '#==w===c===w=#',
        '#...|....|...#',
        '#.T.|.T..|.T.#',
        '#...|....|...#',
        '#...|....|...#',
        '#R..........P#',
        '#............#',
        '######MM######',
      ],
      legend: { w: 'keisatsu_wall+window', c: 'keisatsu_wall+clock', '|': 'keisatsu_partition', T: 'keisatsu_table', R: 'keisatsu_rack', P: 'plant' },
      get entry() { return flowEntry(KEI, 'sodan') ? { x: 6, y: 4, dir: 'up' } : { x: 6, y: 7, dir: 'up' }; },
      warps: [
        { x: 6, y: 8, room: 'lobby', tx: 6, ty: 2, dir: 'down' },
        { x: 7, y: 8, room: 'lobby', tx: 6, ty: 2, dir: 'down' },
      ],
      entities: [
        plate(4.5, 1, '相談室', 2, '#24407a'),
        npc('kei_seian', 6, 2, 'down', WHO.seian, { talk: posted('down', (g) => consultMenu(g, WHO.seian)) }),
        npc('kei_seian2', 2, 2, 'down', WHO.seian2, {
          talk: posted('down', lines(WHO.seian2, ['生活安全課です。悪質商法や闇金、ストーカー、\n子どもや高齢者の安全などを担当しています。', '相談の内容によっては、刑事課や交通課、\n市役所や弁護士にもおつなぎします。'])),
        }),
        npc('kei_soudansha', 11, 4, 'up', { name: '相談中の人', look: LK.citizens[1] }, {
          cond: (g) => !flowIn(g, KEI, 'sodan'),
          text: ['（小声で）…元交際相手から、毎日メッセージが\n何十通も来るんです。', '警察の人が「記録を全部残して」って。\n…相談してよかった。'],
        }),
        npc('kei_soudan3', 11, 2, 'down', WHO.seian, { cond: (g) => !flowIn(g, KEI, 'sodan'), text: '（相談中です。…お静かに）' }),
        { type: 'sign', x: 1, y: 6, talk: async (g) => { await narrate(g, `パンフレットだ。\n「闇金は犯罪です」「ストーカー被害の相談を」\n「${since(g, 2015, 7) ? '消費者ホットライン 188' : '消費生活センターへ'}」`); } },
      ],
      onEnter: (g) => { enteredByFlow(g, KEI, 'sodan'); },
    },

    // -------------------------------------------------------------- 取調室
    torishirabe: {
      floor: 'keisatsu_floor',
      tiles: [
        '##########',
        '#=w==c===#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '####M#####',
      ],
      legend: { w: 'keisatsu_wall+keisatsu_winbar', c: 'keisatsu_wall+clock' },
      get entry() { return flowEntry(KEI, 'torishirabe') ? { x: 4, y: 4, dir: 'up' } : { x: 4, y: 6, dir: 'up' }; },
      warps: [{ x: 4, y: 7, room: 'lobby', tx: 13, ty: 2, dir: 'down', check: heldCheck('（取調べの途中だ。席を立つことはできない…）') }],
      entities: [
        npc('kei_keiji', 4, 2, 'down', WHO.keiji, { talk: posted('down', (g) => (inCustody(g) ? say(g, WHO.keiji, '…座れ。話の続きだ。') : torishirabeFree(g))) }),
        deskProp(3, 2, 3, 'steel', { papers: [0], lip: 7 }),
        npc('kei_hojo', 8, 3, 'left', WHO.hojo, { talk: posted('left', lines(WHO.hojo, ['取調べの補助です。\nやりとりを記録しています。'])) }),
        deskProp(8, 3, 1, 'steel', { lip: 7 }),
        camProp(7, 1, (g) => since(g, 2016, 6)),
        { type: 'sign', x: 7, y: 1, talk: async (g) => { await narrate(g, since(g, 2019, 6) ? '録音・録画の機材だ。\n裁判員裁判の対象事件などは、取調べの全過程を\n記録する決まりになっている。' : since(g, 2016, 6) ? '録音・録画の機材だ。\n取調べの一部を記録する試みが進められている。' : '壁の時計の針の音だけが、やけに大きく聞こえる。'); } },
        { type: 'sign', x: 2, y: 1, text: '鉄格子のはまった小さな窓。\n外の光が、細く差しこんでいる。' },
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, KEI, 'torishirabe')) return;
        const cs = activeCase(g);
        const f = fl(g);
        if (cs && recordedCase(g, cs) && f.recTold !== cs.id) {
          f.recTold = cs.id;
          await narrate(g, '（部屋の隅のカメラの赤いランプがついた。\nこの事件の取調べは、最初から最後まで録音・録画される）');
        }
      },
    },

    // -------------------------------------------------------------- 留置場
    ryuchi: {
      floor: 'keisatsu_floor',
      tiles: [
        '################',
        '#=w=#=w=#=w=#==#',
        '#ttW#ttW#ttW#..#',
        '#ttt#ttt#ttt#..#',
        '#fft#ttt#ftt#d.#',
        '#BDB#BDB#BDB#..#',
        '#..............#',
        '#..............#',
        '#######M########',
      ],
      legend: {
        w: 'keisatsu_wall+keisatsu_winbar', t: 'keisatsu_cellfloor', W: 'keisatsu_cellfloor+keisatsu_wc', f: 'keisatsu_cellfloor+keisatsu_futon',
        B: 'keisatsu_cellfloor+keisatsu_bars', D: 'keisatsu_cellfloor+keisatsu_bardoor', d: 'keisatsu_deskpc',
      },
      get entry() { return flowEntry(KEI, 'ryuchi') ? { x: 6, y: 3, dir: 'down' } : { x: 7, y: 7, dir: 'up' }; },
      warps: [{ x: 7, y: 8, room: 'lobby', tx: 13, ty: 2, dir: 'down', check: heldCheck('（留置場の扉は、外からしか開かない…）') }],
      entities: [
        npc('kei_ryuchi', 14, 5, 'left', WHO.ryuchi, { talk: posted('left', (g) => (inCustody(g) ? say(g, WHO.ryuchi, [`${ryuchiNo(g)}番、静かにしなさい。`, '…消灯は夜9時だ。体を休めておけ。']) : ryuchiFree(g))) }),
        ...KEI_CELLMATES.map(([x, y, look], i) => npc(`kei_cellmate${i}`, x, y, i === 0 ? 'right' : 'down', { name: '同じ留置場の人', look }, {
          cond: (g) => inCustody(g) || flowIn(g, KEI, 'ryuchi'),
          text: pickBy([['…あんたも、初めてか。', '朝が早いぞ。点呼に遅れんようにな。'], ['（壁にもたれて、じっと目を閉じている）'], ['…弁護士さん、いつ来てくれるんだろうな。']], i),
        })),
        { type: 'sign', x: 13, y: 4, text: '留置係の机。\n留置人の出し入れや、差し入れの記録をつけている。' },
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, KEI, 'ryuchi')) return;
        const cs = activeCase(g);
        const f = fl(g);
        if (cs && f.ryuchiTold !== cs.id && (cs.custodyDays || 0) >= 1) {
          f.ryuchiTold = cs.id;
          await narrate(g, ['（留置場の一日は、朝の点呼から始まる。\n布団をたたみ、決まった時間に食事と運動…）', '（ベルトやひものついた服は、預けたままだ。\n時計もない。時間の感覚が、だんだんうすれていく）']);
        }
      },
    },
  },
});

// ======================================================================== 検察庁
async function kenUketsukeTalk(g) {
  const who = WHO.kenUke;
  const k = await ask(g, who, '検察庁の受付です。ご用件をどうぞ。', ['呼び出しを受けた', '検察のしくみ', '不起訴に納得できない', 'やめる'], { cancel: 3 });
  if (k === 0) {
    const cs = curCase(g);
    if (cs && cs.stage === 'zaitaku') await say(g, who, ['担当の検察官から、日時を決めて呼び出しの連絡がいきます。\nその日に、ここへ来てください。', '（処分が決まるまで、もう少しかかるようだ…）']);
    else await say(g, who, 'お名前では、本日の呼び出しは確認できませんね…。\n呼出状をお持ちでしたら、もう一度ご確認ください。');
  } else if (k === 1) {
    await say(g, who, ['警察が調べた事件は、検察庁に送られてきます（送致）。\n検察官は自分でも捜査をして、裁判にかけるか――\n「起訴」するかどうかを決めます。', '起訴しない「不起訴」には、証拠が足りない\n「嫌疑不十分」や、反省や示談などを考えて見送る\n「起訴猶予」などがあります。', '罰金ですむ事件では、法廷を開かずに書面で審理する\n「略式起訴」もあります。被疑者の同意が必要です。']);
  } else if (k === 2) {
    await say(g, who, ['事件の被害者などは、検察官の不起訴に納得できなければ、\n「検察審査会」に審査を申し立てることができます。', '検察審査会は、くじで選ばれた市民11人が\n不起訴がよかったかどうかを審査するしくみです。\n地方裁判所の建物の中にあります。', since(g, 2009, 6) ? '「起訴すべき」と2度議決されれば、\n裁判所が指定した弁護士が起訴します（強制起訴）。' : '審査の結果は、検察官に伝えられます。\n検察官はそれをふまえて、もう一度判断します。']);
  } else await say(g, who, 'お気をつけて。');
}
async function shienTalk(g) {
  const who = WHO.shien;
  if (!since(g, 1999, 10)) {
    await say(g, { name: '検察庁の職員', look: LK.shien }, ['事件の被害にあわれた方には、\n事件の処分の結果などをお知らせしています。', '不安なことがあれば、担当の検察官に\n遠慮なく聞いてくださいね。']);
    return;
  }
  await say(g, who, ['被害者支援員です。事件の被害にあわれた方や\nご家族の相談にのっています。', '裁判を傍聴するときに付き添ったり、\n事件の記録の見方を説明したり…\n処分の結果も、希望があればお知らせします。', since(g, 2008, 12) ? '重い事件では、被害者が裁判に参加して、\n被告人に質問したり意見を述べたりできる\n「被害者参加制度」もあります。' : '被害者の方の気持ちを、裁判で述べる\n機会もあるんですよ。']);
}
async function kenjiFree(g) {
  await say(g, WHO.kenji, ['検察官です。ここは検事室――\n被疑者や参考人から、話を聞く部屋です。', '検察官は、警察とは別に、自分でも取調べをします。\nそのうえで、起訴するかどうかを決めるのは\n検察官だけの仕事です。', '日本では、起訴された事件の有罪率がとても高い。\nだからこそ、起訴するかどうかの判断は重いんです。']);
}
async function tokusoFree(g) {
  const who = WHO.tokuso;
  const pages = ['特別捜査部――「特捜部」です。\n政治家の汚職や大きな脱税、企業の不正などを、\n警察からの送致を待たずに、自分たちで捜査します。', '押収した帳簿や通帳、メールを、\n何か月もかけて一枚ずつ読みこむ。\n地道な仕事ですよ。'];
  const p = (() => { try { return typeof g.pol === 'function' ? g.pol() : null; } catch (e) { return null; } })();
  const j = jus(g);
  const secret = (p && p.me && Number(p.me.secret)) || 0;
  if (secret > 0 || (j && j.heat && (j.heat.slush_fund || j.heat.bribery_take))) pages.push('…政治資金の収支報告書は、1円単位まで正確に。\n書いていないお金があるなら、訂正するのは\n早いほうがいいですよ。（じっとこちらを見ている）');
  else if (isPolitician(g)) pages.push('政治とお金の流れは、収支報告書で\nだれでも確かめられるようになっています。\n…先生も、どうか正確に。');
  await say(g, who, pages);
}
const kenElevatorCheck = async (g) => {
  const k = await ask(g, WHO.guard, 'ここから先は、呼び出しを受けた方と\n案内のある見学の方だけです。', ['見学させてもらう', 'やめておく'], { cancel: 1 });
  if (k !== 0) return false;
  await narrate(g, '（広報の職員が付き添ってくれることになった）');
  return true;
};
const kenEscort = (g, room) => { const j = jus(g); const cs = curCase(g); return !!(j && j.custody && cs && cs.detained && flowIn(g, KEN, room)); };

registerPlace({
  id: KEN,
  name: '検察庁',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: 8, y: 7, dir: 'up' },
  legend: { '#': 'kensatsu_walltop', '=': 'kensatsu_wall', M: 'exit_mat' },
  rooms: {
    // -------------------------------------------------------------- 1階ロビー
    lobby: {
      floor: 'kensatsu_stone',
      tiles: [
        '##################',
        '#==w=e===e=b==w==#',
        '#P...............#',
        '#.KKKK......d....#',
        '#................#',
        '#.ss.........ss..#',
        '#................#',
        '#P..............P#',
        '########MM########',
      ],
      legend: { w: 'kensatsu_wall+kensatsu_blind', e: 'elevator', b: 'kensatsu_wall+kensatsu_board', K: 'counter_white', d: 'kensatsu_desk', s: 'kensatsu_sofa', P: 'plant' },
      warps: [
        ...exitWarps(KEN, [8, 9], 8),
        { x: 5, y: 1, room: 'kenjishitsu', tx: 5, ty: 7, dir: 'up', check: kenElevatorCheck },
        { x: 9, y: 1, room: 'tokuso', tx: 9, ty: 9, dir: 'up', check: kenElevatorCheck },
      ],
      entities: [
        plate(4.5, 1, '検事室', 2, '#5a3e26'),
        plate(8.5, 1, '特捜部', 2, '#5a3e26'),
        npc('ken_uke', 3, 2, 'down', WHO.kenUke, { talk: posted('down', kenUketsukeTalk) }),
        npc('ken_uke2', 4, 2, 'down', { name: '受付', look: LK.jimukanM }, { talk: posted('down', lines({ name: '受付', look: LK.jimukanM }, ['呼び出しを受けた方は、呼出状を見せてください。\n担当の検事室にご案内します。'])) }),
        npc('ken_shien', 12, 2, 'down', WHO.shien, { talk: posted('down', shienTalk) }),
        npc('ken_guard', 10, 4, 'down', WHO.guard, { talk: posted('down', lines(WHO.guard, ['エレベーターの先は、関係者以外は立ち入りできません。', '見学の方は、職員が付き添います。'])) }),
        npc('ken_sankounin', 3, 6, 'up', { name: '参考人の会社員', look: LK.citizens[4] }, {
          text: ['取引先の事件で、「参考人」として呼ばれたんです。\n自分が疑われてるわけじゃないんですけどね…。', '検事さんの前で話すのは、やっぱり緊張しますよ。'],
        }),
        npc('ken_bengo', 14, 6, 'left', { name: '接見帰りの弁護士', look: LK.bengo }, {
          text: ['弁護士です。担当の検察官に、示談の状況を\n伝えに来ました。', '被害者の方への謝罪と弁償は、処分を決めるうえで\nとても大切に見られるんですよ。'],
        }),
        { type: 'sign', x: 11, y: 1, talk: async (g) => { await narrate(g, ['フロアの案内板だ。', '「地方検察庁　刑事部・公判部・特別捜査部」\n「高等検察庁」「最高検察庁」…\n同じ建物に、いくつもの検察庁が入っている。']); } },
      ],
      onEnter: (g) => { enteredByFlow(g, KEN, 'lobby'); },
    },

    // -------------------------------------------------------------- 検事室
    kenjishitsu: {
      floor: 'kensatsu_floor',
      tiles: [
        '############',
        '#==w==w==w=#',
        '#HH.......H#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#ss........#',
        '#..........#',
        '#####MM#####',
      ],
      legend: { w: 'kensatsu_wall+kensatsu_blind', H: 'kensatsu_shelf', s: 'kensatsu_sofa' },
      get entry() { return flowEntry(KEN, 'kenjishitsu') ? { x: 5, y: 4, dir: 'up' } : { x: 5, y: 7, dir: 'up' }; },
      warps: [
        { x: 5, y: 8, room: 'lobby', tx: 5, ty: 2, dir: 'down', check: heldCheck('（取調べの途中だ…）') },
        { x: 6, y: 8, room: 'lobby', tx: 5, ty: 2, dir: 'down', check: heldCheck('（取調べの途中だ…）') },
      ],
      entities: [
        plate(4.5, 1, '検事室', 2, '#5a3e26'),
        npc('ken_kenji', 5, 2, 'down', WHO.kenji, { talk: posted('down', (g) => (curCase(g) && curCase(g).detained ? say(g, WHO.kenji, '…話を続けましょう。') : kenjiFree(g))) }),
        deskProp(4, 2, 3, 'wood', { papers: [0, 2], lip: 7 }),
        npc('ken_jimukan', 9, 3, 'down', WHO.jimukan, {
          talk: posted('down', lines(WHO.jimukan, ['検察事務官です。取調べに立ち会って、\n供述を記録します。', '検察官が決める処分は、大きく分けて3つ。\n公判請求（正式な裁判）、略式起訴（罰金）、不起訴です。'])),
        }),
        deskProp(8, 3, 2, 'wood', { mons: [1], lip: 7 }),
        npc('ken_escort1', 4, 5, 'up', { name: '護送の警察官', look: LK.police }, { cond: (g) => kenEscort(g, 'kenjishitsu'), text: '（無言で、うしろに控えている）' }),
        npc('ken_escort2', 6, 5, 'up', { name: '護送の警察官', look: LK.police }, { cond: (g) => kenEscort(g, 'kenjishitsu'), text: '（無言で、うしろに控えている）' }),
        { type: 'sign', x: 1, y: 2, text: '法律書がぎっしり。\n六法、判例集、注釈書…背表紙だけで目がまわりそうだ。' },
        { type: 'sign', x: 1, y: 6, text: '応接のソファ。\n参考人が、呼ばれるのを待っている。' },
      ],
      // (no narration here: the core's own line about the 護送 and the waiting room comes right after the arrival;
      // the escorts stand behind the player while the case is in custody)
      onEnter: (g) => { enteredByFlow(g, KEN, 'kenjishitsu'); },
    },

    // -------------------------------------------------------------- 特別捜査部
    tokuso: {
      floor: 'kensatsu_floor',
      topPad: 16,
      tiles: [
        '####################',
        '#=w=b=b=w====w==w==#',
        '#xx.......xx|......#',
        '#..PP..PP...|......#',
        '#...........|......#',
        '#..PP..PP...+......#',
        '#...........|......#',
        '#xx.........|......#',
        '#..................#',
        '#p................p#',
        '#########MM#########',
      ],
      legend: { w: 'kensatsu_wall+kensatsu_blind', b: 'kensatsu_wall+kensatsu_board', x: 'kensatsu_boxes', P: 'kensatsu_papers', '|': 'keisatsu_partition', '+': 'kensatsu_floor', p: 'plant' },
      get entry() { return flowEntry(KEN, 'tokuso') ? { x: 15, y: 5, dir: 'up' } : { x: 9, y: 9, dir: 'up' }; },
      warps: [
        { x: 9, y: 10, room: 'lobby', tx: 9, ty: 2, dir: 'down', check: heldCheck('（取調べの途中だ…）') },
        { x: 10, y: 10, room: 'lobby', tx: 9, ty: 2, dir: 'down', check: heldCheck('（取調べの途中だ…）') },
      ],
      entities: [
        plate(13.5, 1, '特別捜査部', 3, '#3a2a1a'),
        npc('ken_tokuso', 15, 3, 'down', WHO.tokuso, { talk: posted('down', (g) => (curCase(g) && curCase(g).detained ? say(g, WHO.tokuso, '…帳簿の、この入金の説明を聞かせてください。') : tokusoFree(g))) }),
        deskProp(14, 3, 3, 'wood', { papers: [0, 1, 2], lip: 7 }),
        npc('ken_tjimu', 18, 4, 'left', WHO.jimukanM, { talk: posted('left', lines(WHO.jimukanM, ['特捜部の事務官です。\n押収した資料の分析と、取調べの記録が仕事です。'])) }),
        deskProp(18, 4, 1, 'wood', { lip: 7 }),
        npc('ken_t1', 3, 4, 'up', { name: '事務官', look: LK.jimukan }, { text: '（帳簿のコピーに、黄色い付箋を貼り続けている）' }),
        npc('ken_t2', 7, 4, 'up', { name: '事務官', look: LK.jimukanM }, { text: '（通帳の入出金を、表計算ソフトに打ちこんでいる）' }),
        npc('ken_t3', 4, 6, 'up', { name: '検察官', look: LK.kenjiW }, { text: ['…この金の流れ、裏づけが足りない。', '関係者全員の話を、もう一度聞き直そう。'] }),
        npc('ken_t4', 8, 6, 'up', { name: '事務官', look: LK.jimukan }, { text: '（段ボールの中身を、番号順に並べている）' }),
        npc('ken_tescort', 15, 7, 'up', { name: '護送の警察官', look: LK.police }, { cond: (g) => kenEscort(g, 'tokuso'), text: '（無言で、うしろに控えている）' }),
        { type: 'sign', x: 4, y: 1, text: 'ホワイトボードに、人の名前のかわりに\nアルファベットと矢印が書きこまれている。\n…お金の流れを整理した図らしい。' },
        { type: 'sign', x: 6, y: 1, text: '「押収品目録」の紙が貼ってある。\n帳簿、通帳、手帳、パソコン…\n番号がどこまでも続いている。' },
        { type: 'sign', x: 1, y: 2, text: '押収した資料の段ボール箱が、天井近くまで\n積み上がっている。' },
      ],
      events: [
        { x: 3, y: 3, w: 2, on: 'action', run: async (g) => { await narrate(g, '机の上は、帳簿のコピーの山だ。\n赤ペンで、日付と金額に丸がつけてある。'); } },
        { x: 7, y: 3, w: 2, on: 'action', run: async (g) => { await narrate(g, '机の上に、政治団体の収支報告書の写しが\n何年分も積まれている。'); } },
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, KEN, 'tokuso')) return;
        const cs = activeCase(g);
        const f = fl(g);
        if (cs && f.tokusoTold !== cs.id) {
          f.tokusoTold = cs.id;
          const pages = ['（地方検察庁 特別捜査部――「特捜部」。\n政治とお金の事件を、検察みずから捜査する部署だ）'];
          if (recordedCase(g, cs)) pages.push('（検察が独自に捜査する事件の取調べは、\nすべて録音・録画される）');
          await narrate(g, pages);
        }
      },
    },
  },
});

// ======================================================================== 裁判所
// ---------------------------------------------------------------- 傍聴（fictional trials, the real order of a trial）
// Steps: { cap } shows the stage of the trial; { who, text } a line; { stand: id } / { sit: id } moves a person to /
// from the 証言台; { note } is a short explanation for the viewer; { pause: '…' } a time card.
const SPK = {
  chief: WHO.chief, judge: { name: '裁判官', look: LK.judge2 }, pros: WHO.prosecutor, bengo: WHO.bengo,
  def: { name: '被告人', look: LK.defendant }, def2: { name: '被告人', look: LK.defendant2 }, defOld: { name: '被告人', look: LOOKS.oldman },
  daughter: { name: '情状証人（長女）', look: LK.citizens[3] }, mother: { name: '情状証人（母）', look: LK.citizens[5] },
  saibanin: { name: '裁判員（3番）', look: LK.citizens[7] }, victim: { name: '被害者参加人', look: LK.citizens[4] }, vbengo: { name: '被害者参加弁護士', look: LK.kokusen },
};
function trialCases(g) {
  const w = laborWord(g);
  const y = lawYear(g);
  const cases = {
    elder: {
      title: '窃盗被告事件', judges: 1, defendant: 'defOld', witness: 'daughter', note: '高齢の被告人の万引き事件',
      steps: [
        { cap: '開廷' }, { who: 'chief', text: '開廷します。被告人は、証言台の前に立ってください。' }, { stand: 'def' },
        { cap: '人定質問' }, { who: 'chief', text: '名前と生年月日、住所、職業を言ってください。' },
        { who: 'def', text: '…川端しげるです。74歳です。\n年金で暮らしていて、仕事はしていません。' },
        { cap: '起訴状朗読' }, { who: 'pros', text: ['公訴事実。被告人は、ドット区内のスーパーマーケットで、\n弁当など7点、販売価格合計2,380円を窃取したものである。', '罪名及び罰条。窃盗、刑法第235条。'] },
        { cap: '黙秘権の告知' }, { who: 'chief', text: '被告人には黙秘権があります。答えたくない質問には、\n答えなくてかまいません。話したことは、有利にも\n不利にも証拠になります。' },
        { cap: '罪状認否' }, { who: 'chief', text: '今、検察官が読んだ事実に、違うところはありますか。' }, { who: 'def', text: '…ありません。まちがいありません。' },
        { who: 'bengo', text: '弁護人も、被告人と同じ意見です。' }, { sit: 'def' },
        { cap: '冒頭陳述' }, { who: 'pros', text: ['被告人は、5年前に妻を亡くして以来、一人暮らし。\n同じような万引きで、これまでに罰金の前科が2回あります。', '財布には、商品を買えるだけの現金が入っていました。'] },
        { cap: '証拠調べ' }, { who: 'pros', text: '被害届、防犯カメラの映像の報告書、\n被告人の供述調書などを請求します。' }, { who: 'bengo', text: 'すべて同意します。' },
        { who: 'chief', text: '採用して、取り調べます。' }, { note: '（検察官が、証拠の内容を要約して読み上げていく。\n弁護人が同意した書類は、そのまま証拠になる）' },
        { who: 'bengo', text: '情状証人として、被告人の長女を請求します。' }, { stand: 'wit' },
        { who: 'daughter', text: ['母が亡くなってから、父はひとりで食事もとらず、\n家にこもりがちでした。気づいてやれなかった…。', 'これからは毎週、父の家に通います。\n地域包括支援センターにも、相談に行きました。'] }, { sit: 'wit' },
        { cap: '被告人質問' }, { stand: 'def' }, { who: 'bengo', text: 'お金はあったのに、なぜ盗んだんですか。' },
        { who: 'def', text: '…自分でも、わからないんです。\n気がつくと、かばんに入れていて…。' },
        { who: 'pros', text: '前の裁判でも「もうしない」と誓いましたね。' }, { who: 'def', text: '…はい。申し訳ありません。' },
        { who: 'chief', text: 'これからは、どうやって暮らしていきますか。' }, { who: 'def', text: '娘の家の近くに越して、病院にも通います。\n…もう、店には一人で行きません。' }, { sit: 'def' },
        { cap: '論告・求刑' }, { who: 'pros', text: `同じ種類の前科がありながら、再び犯行に及んでおり、\n常習性は明らかです。被告人を${w}1年に処するのが\n相当と考えます。` },
        { cap: '最終弁論' }, { who: 'bengo', text: ['被害は弁償し、お店も厳しい処罰は望んでいません。\n長女が監督を約束し、医療にもつながりました。', '刑務所ではなく、社会の中での立ち直りこそ必要です。\n執行猶予つきの判決を求めます。'] },
        { cap: '最終陳述' }, { stand: 'def' }, { who: 'chief', text: '最後に、何か言っておきたいことはありますか。' }, { who: 'def', text: 'お店の方に、本当に申し訳ないことをしました。\n…娘にも。もう、二度としません。' },
        { who: 'chief', text: '判決は、このあと言い渡します。しばらく休廷します。' }, { pause: '― 20分後 ―' },
        { cap: '判決' }, { who: 'chief', text: [`主文。被告人を${w}1年に処する。\nこの裁判が確定した日から3年間、\nその刑の執行を猶予する。`, '同じ罪を重ねたことは軽くないが、被害は回復され、\n家族の監督と医療の支えが期待できることを考えた。', '…今日、娘さんがここに来てくれたことを、\n忘れないでください。'] }, { sit: 'def' },
        { note: y >= 2005 ? '（高齢者の万引きでは、孤立や認知機能の衰えが\n背景にあることも少なくない。刑罰だけでなく、\n福祉や医療につなぐ取り組みが広がっている）' : '（判決のあと、被告人は娘に支えられて法廷を出ていった）' },
      ],
    },
    dui: {
      title: '道路交通法違反被告事件', judges: 1, defendant: 'def', witness: null, note: '酒気帯び運転の事件',
      steps: [
        { cap: '開廷・人定質問' }, { stand: 'def' }, { who: 'chief', text: '被告人は前へ。名前と、職業を言ってください。' }, { who: 'def', text: '大島健一です。運送会社の、…元社員です。' },
        { cap: '起訴状朗読' }, { who: 'pros', text: ['公訴事実。被告人は、酒気を帯びた状態で、\nドット区内の道路で普通乗用自動車を運転したものである。', '罪名及び罰条。道路交通法違反。'] },
        { cap: '黙秘権の告知・罪状認否' }, { who: 'chief', text: '黙秘権があります。…起訴状の事実は、どうですか。' }, { who: 'def', text: 'まちがいありません。' }, { sit: 'def' },
        { cap: '冒頭陳述・証拠調べ' }, { who: 'pros', text: ['被告人は4年前にも酒気帯び運転で罰金刑を受けています。\n事件の夜は居酒屋で飲酒し、自分で運転して帰宅しようとした。', '呼気検査の結果、基準を大きくこえるアルコールが\n検出されました。'] },
        { note: '（1回目の飲酒運転は、略式手続の罰金ですむことが多い。\nくり返すと、こうして正式な裁判にかけられる）' },
        { cap: '被告人質問' }, { stand: 'def' }, { who: 'bengo', text: 'なぜ、また運転したんですか。' }, { who: 'def', text: '「近いから大丈夫だ」と…。\n言い訳になりません。' },
        { who: 'pros', text: 'もし子どもが飛び出してきていたら、\nどうなっていたと思いますか。' }, { who: 'def', text: '……。（うつむいたまま、答えられない）' }, { sit: 'def' },
        { cap: '論告・求刑' }, { who: 'pros', text: `同種前科がありながら、安易に飲酒運転をくり返した。\n${w}6月を求刑します。` },
        { cap: '最終弁論・最終陳述' }, { who: 'bengo', text: '被告人は車を手放し、断酒の会に通い始めています。\n寛大な判決を求めます。' }, { stand: 'def' }, { who: 'def', text: '二度と、ハンドルは握りません。' },
        { pause: '― 休廷のあと ―' }, { cap: '判決' },
        { who: 'chief', text: [`主文。被告人を${w}4月に処する。\nこの裁判が確定した日から3年間、\nその刑の執行を猶予する。`, '…お酒を飲んだら、絶対に運転しないこと。\n次は、刑務所に行くことになりますよ。'] }, { sit: 'def' },
        { note: y >= 2007 ? '（痛ましい事故が続いたことを受けて、\n2007年、飲酒運転の罰則は大きく引き上げられた）' : '（飲酒運転は、多くの悲しい事故を生んできた。\n「飲んだら乗るな」は、昔もいまも変わらない）' },
      ],
    },
    ukeko: {
      title: '詐欺被告事件', judges: 1, defendant: 'def2', witness: 'mother', note: '特殊詐欺の「受け子」の事件',
      steps: [
        { cap: '開廷・人定質問' }, { stand: 'def' }, { who: 'chief', text: '被告人は前へ。名前と年齢、職業を言ってください。' }, { who: 'def2', text: '…森田翔太、21歳です。\nアルバイトを…していました。' },
        { cap: '起訴状朗読' }, { who: 'pros', text: ['公訴事実。被告人は、氏名不詳者らと共謀のうえ、\n被害者の長男を装って電話をかけ、現金を\nだまし取ろうと企てた。', '被害者から、現金300万円の交付を受けて\nこれをだまし取ったものである。\n罪名及び罰条。詐欺、刑法第246条第1項。'] },
        { cap: '黙秘権の告知・罪状認否' }, { who: 'chief', text: '黙秘権があります。…事実に、違うところは。' }, { who: 'def2', text: 'ありません。' }, { sit: 'def' },
        { cap: '冒頭陳述' }, { who: 'pros', text: [y >= 2023 ? '被告人はSNSで「即日高収入」の募集――いわゆる\n「闇バイト」に応募。運転免許証の画像を送らされ、\n指示役の言うままに動いていました。' : '被告人は「高収入のアルバイト」に応募し、\n身分証の写しを送らされたうえで、\n指示役の言うままに動いていました。', '被告人の役割は、被害者の家で現金を受け取る\n「受け子」です。'] },
        { cap: '証拠調べ' }, { who: 'pros', text: '防犯カメラの映像、指示役とのやりとりの記録、\n被害者の供述調書などを請求します。' }, { who: 'bengo', text: '同意します。' },
        { who: 'bengo', text: '情状証人として、被告人の母を請求します。' }, { stand: 'wit' },
        { who: 'mother', text: '…息子がこんなことを。被害にあわれた方に、\nどうおわびしたらいいのか…。\nこれからは、家族で息子を見張ります。' }, { sit: 'wit' },
        { cap: '被告人質問' }, { stand: 'def' }, { who: 'bengo', text: 'なぜ、途中でやめなかったのですか。' },
        { who: 'def2', text: '住所も家族のことも知られていて…\n「逃げたら家に行く」と言われて、こわくて。' },
        { who: 'pros', text: '被害者の方は、老後のために少しずつためた\nお金を失いました。そのことを、どう思いますか。' }, { who: 'def2', text: '…取り返しのつかないことを、しました。' }, { sit: 'def' },
        { cap: '論告・求刑' }, { who: 'pros', text: `組織的な特殊詐欺の重要な役割を担った。\n被害は大きく、回復されていない。${w}3年を求刑します。` },
        { cap: '最終弁論・最終陳述' }, { who: 'bengo', text: '被告人は若く、指示役に脅されて従った立場です。\n少しずつでも弁償すると約束しています。' }, { stand: 'def' }, { who: 'def2', text: '本当に、申し訳ありませんでした。' }, { sit: 'def' },
        { who: 'chief', text: '判決は、2週間後に言い渡します。\nこれで閉廷します。' },
        { note: y >= 2023 ? '（「闇バイト」の実行役は、捕まれば使い捨てにされる。\n応募した時点で、もう抜け出せなくなる――\n警察は「すぐに相談を」と呼びかけている）' : '（電話でお金をだまし取る詐欺は、受け取り役の\n若者が捕まっても、指示役までたどりつくのは難しい）' },
      ],
    },
    saibanin: {
      title: '強盗致傷被告事件', judges: 3, defendant: 'def', witness: null, saibanin: true, note: '裁判員裁判（強盗致傷）',
      steps: [
        { cap: '開廷・人定質問' }, { note: '（法壇には、裁判官3人と、くじで選ばれた裁判員6人。\n市民と裁判官が、いっしょに判決を決める）' }, { stand: 'def' },
        { who: 'chief', text: '開廷します。被告人は、証言台の前へ。\n名前と年齢、職業を言ってください。' }, { who: 'def', text: '…石井直人、34歳、無職です。' },
        { cap: '起訴状朗読' }, { who: 'pros', text: ['公訴事実。被告人は、コンビニエンスストアで、\n店員に刃物を示して脅し、現金約8万円を奪い、\nその際、店員の腕に全治3週間のけがを負わせた。', '罪名及び罰条。強盗致傷、刑法第240条。'] },
        { cap: '黙秘権の告知・罪状認否' }, { who: 'chief', text: '黙秘権があります。…起訴状の事実は、どうですか。' }, { who: 'def', text: '…まちがいありません。' }, { sit: 'def' },
        { cap: '冒頭陳述' }, { who: 'pros', text: '（大型モニターに、事件の流れが図で映し出される）\n被告人は借金の返済に困り、深夜の店を狙いました。' },
        { who: 'bengo', text: '弁護人も冒頭陳述をします。\n被告人は職を失い、追いつめられていました。\n争うのは、刑の重さです。' },
        { cap: '証拠調べ' }, { note: '（防犯カメラの映像や、けがの写真が、モニターに映る。\n裁判員の何人かが、じっと画面を見つめている）' },
        ...(y * 100 >= 200812 ? [{ who: 'vbengo', text: '被害者参加弁護士です。被害者の方は、\n事件のあと夜の勤務ができなくなり、\nいまも通院を続けています。' }] : []),
        { cap: '被告人質問' }, { stand: 'def' }, { who: 'bengo', text: 'なぜ、刃物を持って行ったのですか。' }, { who: 'def', text: '脅すだけのつもりでした。…でも、相手がもみ合いに\nなって。言い訳にもなりません。' },
        { who: 'chief', text: '裁判員の方から、質問はありますか。' },
        { who: 'saibanin', text: '…けがをした店員さんに、いま、\nどんな言葉をかけたいですか。' }, { who: 'def', text: '……。（長い沈黙のあと）\n…毎晩、あの人の顔が浮かびます。\n本当に、すみませんでした。' }, { sit: 'def' },
        { cap: '論告・求刑' }, { who: 'pros', text: `刃物を使った危険な犯行で、結果も重い。\n${w}8年を求刑します。` },
        ...(y * 100 >= 200812 ? [{ who: 'victim', text: 'あの夜から、レジに立つのがこわいんです。\n…でも、二度と同じことをしないでほしい。\nそれだけです。' }] : []),
        { cap: '最終弁論・最終陳述' }, { who: 'bengo', text: '被告人は深く反省し、少しずつでも弁償すると\n約束しています。寛大な判決を求めます。' },
        { stand: 'def' }, { who: 'def', text: '…刑務所で、自分のしたことと向き合います。' }, { sit: 'def' },
        { who: 'chief', text: '審理を終えます。判決は、評議のうえ、\n3日後に言い渡します。' },
        { note: '（裁判員と裁判官は、別室で「評議」をして、\n有罪か無罪か、刑の重さを話し合って決める。\n評議の中身を外で話すことは、禁じられている）' },
        { pause: '― 3日後、判決の日 ―' }, { cap: '判決' }, { stand: 'def' },
        { who: 'chief', text: [`主文。被告人を${w}6年に処する。`, '刃物を示して脅し、けがを負わせた責任は重い。\n反省の態度などを考えても、この刑はやむをえない。'] }, { sit: 'def' },
        { note: '（裁判員は、選挙権のある人の中から、くじで選ばれる。\nだれでも、いつか法壇に座るかもしれない）' },
      ],
    },
    koso: {
      title: '窃盗被告事件（控訴審）', judges: 3, defendant: 'def2', witness: null, note: '控訴審',
      steps: [
        { cap: '控訴審の開廷' }, { who: 'chief', text: '開廷します。被告人は、前の席に。' }, { stand: 'def' },
        { who: 'chief', text: '1審と同じく、名前と住所を確認します。\n…はい、けっこうです。' }, { sit: 'def' },
        { cap: '控訴趣意書' }, { who: 'bengo', text: '控訴の趣意は、控訴趣意書に書いたとおりです。\n1審の実刑判決は、重すぎて不当です。' }, { who: 'pros', text: '控訴には理由がなく、棄却すべきです。' },
        { cap: '事実の取調べ' }, { who: 'bengo', text: '1審のあと、被害者との示談が成立しました。\nその書面を、証拠として請求します。' }, { who: 'chief', text: '採用して、取り調べます。' },
        { note: '（控訴審は、1審の判決にまちがいがないかを\n見直す裁判。新しい事情があれば、それも調べる）' },
        { pause: '― 判決の日 ―' }, { cap: '判決' }, { stand: 'def' },
        { who: 'chief', text: ['主文。本件控訴を棄却する。', '示談の成立は考えるべき事情ではあるが、\n同種の前科をくり返していることなどからすると、\n1審の刑が重すぎて不当とまではいえない。'] }, { sit: 'def' },
        { note: '（控訴しても、判決が変わるのは一部にとどまる。\nさらに不服なら、最高裁判所に上告できる――\nただし、理由は憲法違反や判例違反などに限られる）' },
      ],
    },
  };
  return cases;
}
// Which trial is on today in a room (none on 土日).
function trialToday(g, room) {
  if (!g.state) return null;
  const wd = typeof g.weekday === 'number' ? g.weekday : ((day(g) - 1) % 7);
  if (wd >= 5) return null;
  const C = trialCases(g);
  if (room === 'chisai') {
    const list = ['elder', 'dui', ...(since(g, 2011, 1) ? ['ukeko'] : [])];
    return C[list[day(g) % list.length]];
  }
  if (room === 'saibanin') return since(g, 2009, 8) && day(g) % 2 === 0 ? C.saibanin : null;
  if (room === 'kousai') return day(g) % 2 === 1 ? C.koso : null;
  return null;
}
// The court's own people sit in their places; the defendant / witness walk to the 証言台 (9,6) and back.
const SEATS = { def: [14, 5, 'left'], wit: [12, 10, 'up'] };
const seatOf = (room, who) => (who === 'def' && room === 'saibanin' ? [15, 5, 'left'] : SEATS[who]);
const SAI_SPOTS = { def: [9, 6, 'up'], wit: [9, 6, 'up'] };
async function walkTo(g, id, x, y, dir) {
  const e = g.npc(id);
  if (!e) return;
  await g.walkNpcTo(id, x, y, 1.6);
  if (e.x !== x || e.y !== y) g.placeNpc(id, x, y, dir);
  e.dir = dir;
}
async function watchTrial(g, room) {
  const tc = trialToday(g, room);
  if (!tc) {
    await narrate(g, ((typeof g.weekday === 'number' ? g.weekday : 0) >= 5) ? '（土日は、裁判は開かれていない）' : '（この法廷では、今日の審理はもう終わったようだ。\n入口の開廷表で、ほかの法廷をさがしてみよう）');
    return;
  }
  const k = await ask(g, null, [`（${tc.title}――${tc.note}の審理が開かれている）`, '（傍聴席では、静かに。録音・撮影は禁止。\n出入りは自由だ）'], ['傍聴する', 'やめておく'], { cancel: 1 });
  if (k !== 0) return;
  const p = g.map.player;
  const back = { x: p.x, y: p.y, dir: p.dir };
  WATCH.room = room;
  WATCH.witness = !!tc.witness;
  g.placePlayer(7, 10, 'up');
  // the camera stays on the well of the court (the bench, both counsel and the 証言台), not on the gallery seat
  const mw = g.map.room.w * TILE;
  g.map.camOverride = { x: mw <= VIEW_W ? -Math.round((VIEW_W - mw) / 2) : Math.round((mw - VIEW_W) / 2), y: 14 };
  const defId = `sai_${room}_def`, witId = `sai_${room}_wit`;
  try {
    for (const st of tc.steps) {
      if (st.cap) { g.showBanner(`【${st.cap}】`); continue; }
      if (st.stand) { const id = st.stand === 'def' ? defId : witId; const [x, y, d] = SAI_SPOTS[st.stand]; await walkTo(g, id, x + (st.stand === 'wit' ? 1 : 0), y, d); continue; }
      if (st.sit) { const id = st.sit === 'def' ? defId : witId; const [x, y, d] = seatOf(room, st.sit); await walkTo(g, id, x, y, d); continue; }
      if (st.pause) { await g.fadeOut(10); await g.wait(250); g.showBanner(st.pause); await g.fadeIn(10); continue; }
      if (st.note) { await narrate(g, st.note); continue; }
      const who = SPK[st.who] || null;
      const spk = who && tc.judges === 1 && st.who === 'chief' ? WHO.judge : who;
      await say(g, spk, st.text);
    }
    await g.fadeOut(10);
  } finally {
    WATCH.room = null;
    WATCH.witness = false;
    g.map.camOverride = null;
  }
  g.placePlayer(back.x, back.y, back.dir);
  const ds = seatOf(room, 'def');
  const e = g.npc(defId); if (e) g.placeNpc(defId, ds[0], ds[1], ds[2]);
  const w = g.npc(witId); if (w) g.placeNpc(witId, SEATS.wit[0], SEATS.wit[1], SEATS.wit[2]);
  await g.fadeIn(10);
  const f = fl(g);
  f.watched = f.watched || {};
  f.watched[room] = (f.watched[room] || 0) + 1;
  g.addNeed('stress', -3);
  await narrate(g, '（審理が終わった。張りつめていた傍聴席の空気が、\nふっとゆるんだ。…いろいろなことを考えさせられた）');
}

// ---------------------------------------------------------------- people drawn as props
// People who sit where visitors cannot go (the well of a courtroom, behind cell bars, at a workbench during a tour)
// are drawn as props: they look like everyone else but are not walked up to and talked to.
const SHEETS = new WeakMap();
function sheetOf(look) {
  if (!look || typeof look !== 'object') return charSheetHD({});
  let s = SHEETS.get(look);
  if (!s) { s = charSheetHD(look); SHEETS.set(look, s); }
  return s;
}
function person(x, y, dir, look, cond, opts = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1, z: opts.z || 0, solid: opts.solid !== false, cond,
    ...(opts.id ? { id: opts.id } : {}),
    draw(ctx, sx, sy, g) {
      const lk = typeof look === 'function' ? look(g) : look;
      if (!lk) return;
      const d = typeof dir === 'function' ? dir(g) : dir;
      drawShadow(ctx, sx, sy);
      drawChar(ctx, sheetOf(lk), d, opts.frame ? Math.floor((g.frame || 0) / 20) % 3 : 0, sx, sy);
    },
  };
}
const lawyerLook = (cs) => (!cs || !cs.lawyer ? null : cs.lawyer === 'shisen' ? LK.shisen : cs.lawyer === 'yameken' ? LK.yameken : LK.kokusen);
const caseSev = (cs) => (cs && CRIMES[cs.crime] ? CRIMES[cs.crime].severity : 1);
const famous = (g) => g.state.fame >= 100 || isPolitician(g);

// ---------------------------------------------------------------- courtroom builder
const WATCH = { room: null };
const courtActive = (g, room) => flowIn(g, SAI, room) || (room !== 'shohotei' && room !== 'daihotei' && !!trialToday(g, room));
const flowCase = (g, room) => (flowIn(g, SAI, room) ? activeCase(g) : null);
const JUDGE_LOOKS = [LK.judge3, LK.judge, LK.judge2, LK.judge4, LK.judge5];
const GALLERY_BASE = [[3, 10], [5, 11], [13, 11], [16, 10]];
const GALLERY_FULL = [[2, 10], [4, 10], [6, 10], [2, 11], [4, 11], [6, 11], [14, 10], [15, 10], [11, 11], [12, 11], [14, 11], [16, 11], [7, 11], [15, 11], [3, 11]];
// cfg: { room, seats: [x...], chief, judges(g) → [x...] who sit, saibanin: [x...], gallery: true, label }
function courtroom(cfg) {
  const { room } = cfg;
  const W = 19;
  const row1 = Array.from({ length: W }, (_, x) => (x === 0 || x === W - 1 ? '#' : cfg.seats.includes(x) ? (x === cfg.chief ? 'J' : 'j') : (cfg.mons || []).includes(x) ? 'm' : x === 16 && !cfg.mons ? 'k' : '=')).join('');
  const tiles = [
    '###################',
    row1,
    '#ddddddddddddddddd#',
    '#bbbbbbbbbbbbbbbbb#',
    '#.................#',
    cfg.saibanin ? '#.t......W......t.#' : cfg.noDock ? '#.T.............T.#' : '#.T......W....D.T.#',
    cfg.saibanin ? '#.t.............t.#' : cfg.noDock ? '#.T.............T.#' : '#.T...........D.T.#',
    '#.................#',
    '#.................#',
    '#rrrrrrrrGrrrrrrrr#',
    '#.gggggg...gggggg.#',
    '#.gggggg...gggggg.#',
    '#########M#########',
  ];
  const ents = [];
  const active = (g) => courtActive(g, room);
  const inFlow = (g) => flowIn(g, SAI, room);
  // the bench: judges (and 裁判員) behind the 法壇
  cfg.seats.forEach((x, i) => {
    const isJ = (g) => {
      if (!active(g)) return false;
      if (cfg.saibaninSeats && cfg.saibaninSeats.includes(x)) return true;
      const sit = cfg.judges(g);
      return sit.includes(x);
    };
    const look = cfg.saibaninSeats && cfg.saibaninSeats.includes(x) ? LK.citizens[(i * 3) % LK.citizens.length] : x === cfg.chief ? LK.judge : JUDGE_LOOKS[i % JUDGE_LOOKS.length];
    ents.push(person(x, 2, 'down', look, isJ));
  });
  ents.push(deskProp(1, 2, 17, 'bench', { lip: 7, drop: 0, closed: true, solid: false, mons: cfg.saibanin ? (g) => (since(g, 2009, 5) ? cfg.seats.map((x) => x - 1) : null) : null }));
  // the clerk below the bench
  ents.push(person(9, 4, 'down', (g) => (inFlow(g) ? LK.clerk : LK.clerkM), active));
  ents.push(deskProp(7, 4, 5, 'bench', { lip: 7, drop: 5, papers: [1, 3] }));
  // prosecutor and defence, the defendant's seat, escorts
  ents.push(person(1, 5, 'right', (g) => (inFlow(g) ? LK.kenji : LK.kenjiW), active));
  ents.push(person(1, 6, 'right', LK.kenji, (g) => active(g) && (cfg.saibanin || (inFlow(g) && caseSev(flowCase(g, room)) >= 4))));
  ents.push(person(17, 5, 'left', (g) => (inFlow(g) ? lawyerLook(flowCase(g, room)) : LK.bengo), (g) => active(g) && (!inFlow(g) || !!lawyerLook(flowCase(g, room)))));
  const defX = cfg.saibanin ? 15 : 14;
  ents.push(person(defX, 5, 'left', (g) => { const tc = trialToday(g, room); return tc ? SPK[tc.defendant].look : LK.defendant; }, (g) => !inFlow(g) && !!trialToday(g, room) && WATCH.room !== room));
  ents.push(dyn(`sai_${room}_def`, defX, 5, 'left', (g) => { const tc = trialToday(g, room); return tc ? SPK[tc.defendant] : SPK.def; }, { cond: () => WATCH.room === room, text: '（審理中だ）' }));
  ents.push(dyn(`sai_${room}_wit`, 12, 10, 'up', (g) => { const tc = trialToday(g, room); return tc && tc.witness ? SPK[tc.witness] : SPK.daughter; }, { cond: () => WATCH.room === room && !!WATCH.witness, text: '（審理中だ）' }));
  ents.push(person(12, 10, 'up', (g) => { const tc = trialToday(g, room); return tc && tc.witness ? SPK[tc.witness].look : null; }, (g) => !inFlow(g) && WATCH.room !== room && !!(trialToday(g, room) || {}).witness));
  for (const [x, y] of (cfg.saibanin ? [[14, 5], [14, 6]] : [[15, 5], [15, 6]])) {
    ents.push(person(x, y, 'left', LK.keimukan, (g) => { const cs = flowCase(g, room); return !!(cs && cs.detained); }));
  }
  if (cfg.saibanin) {
    ents.push(person(1, 7, 'right', LK.citizens[4], (g) => !inFlow(g) && !!trialToday(g, room) && since(g, 2008, 12)));
    ents.push(person(2, 7, 'up', LK.kokusen, (g) => !inFlow(g) && !!trialToday(g, room) && since(g, 2008, 12)));
  }
  // the gallery
  GALLERY_BASE.forEach(([x, y], i) => ents.push(person(x, y, 'up', LK.citizens[(i * 2 + 1) % LK.citizens.length], active)));
  GALLERY_FULL.forEach(([x, y], i) => ents.push(person(x, y, 'up', i % 4 === 0 ? (i % 8 ? LK.kisha2 : LK.kisha) : LK.citizens[(i * 5) % LK.citizens.length], (g) => inFlow(g) && famous(g))));
  ents.push(person(11, 10, 'up', (g) => { const m = family(g)[0]; return m ? famLook(g, m) : null; }, (g) => inFlow(g) && family(g).length > 0 && (!flowCase(g, room) || flowCase(g, room).plea !== 'deny')));
  ents.push(backrestProp(2, 10, 6), backrestProp(11, 10, 6), backrestProp(2, 11, 6), backrestProp(11, 11, 6));
  // the attendant (廷吏) at the aisle: rules, and today's hearing
  ents.push(npc(`sai_${room}_teiri`, 10, 10, 'down', { name: '廷吏', look: LK.clerkM }, {
    talk: posted('down', async (g) => {
      const tc = trialToday(g, room);
      await say(g, { name: '廷吏', look: LK.clerkM }, tc ? [`いま、この法廷では${tc.title}の審理中です。\n傍聴席は自由に使えます。`, '私語や、録音・撮影は禁止です。\n帽子もとってくださいね。'] : ['この法廷の今日の審理は、終わりました。', 'ロビーの開廷表で、ほかの法廷の予定を\n確かめてみてください。']);
    }),
  }));
  // the big wall monitors of a 裁判員法廷 (the room is a plain 刑事大法廷 before 2009)
  for (const x of cfg.mons || []) {
    ents.push({ type: 'prop', x, y: 1, w: 1, h: 1, solid: false, cond: (g) => since(g, 2009, 5), draw(ctx, sx, sy) { ctx.drawImage(tileImageHD('saibansho_bigmon'), sx, sy, TILE, TILE); } });
  }
  ents.push(...(cfg.extra || []));
  const legend = {
    j: 'saibansho_chairback', J: 'saibansho_chairback_c', m: 'saibansho_wall', k: 'saibansho_wall+saibansho_clock',
    d: 'saibansho_dais', b: 'saibansho_bench', T: 'saibansho_table', t: 'saibansho_table_mon', W: 'saibansho_witness', D: 'saibansho_dbench',
    r: 'saibansho_bar', G: 'saibansho_bargate', g: 'saibansho_gallery',
  };
  return {
    floor: cfg.floor || 'saibansho_floor',
    tiles,
    legend,
    get entry() { return flowEntry(SAI, room) ? (cfg.gallerySeat ? { x: 9, y: 10, dir: 'up' } : { x: 9, y: 6, dir: 'up' }) : { x: 9, y: 11, dir: 'up' }; },
    warps: cfg.warps,
    entities: ents,
    events: [
      { x: 2, y: 10, w: 6, h: 2, on: 'action', run: (g) => watchTrial(g, room) },
      { x: 11, y: 10, w: 6, h: 2, on: 'action', run: (g) => watchTrial(g, room) },
    ],
    onEnter: async (g) => {
      if (!enteredByFlow(g, SAI, room)) return;
      await courtArrival(g, room, cfg);
    },
  };
}
// Place-side notes when the player's own case comes to this courtroom (once per case and room).
async function courtArrival(g, room, cfg) {
  const cs = activeCase(g);
  if (!cs) return;
  const f = fl(g);
  const key = `${room}:${cs.id}`;
  f.courtSeen = f.courtSeen || {};
  if (f.courtSeen[key]) return;
  f.courtSeen[key] = day(g);
  const pages = [];
  if (room === 'shohotei') {
    pages.push('（最高裁判所の小法廷。上告審は書面での審理が中心で、\n被告人が法廷に呼ばれることはない）', '（判決の言い渡しを、傍聴席から聞くことにした）');
    await narrate(g, pages);
    return;
  }
  if (cs.detained) pages.push('（裁判官が入ってくる前に、手錠と腰縄がはずされた。\n公判廷では、被告人の体を拘束してはいけない決まりだ）');
  if (room === 'saibanin') pages.push('（法壇には、裁判官3人と、くじで選ばれた市民の\n裁判員6人が並んでいる。この事件は「裁判員裁判」だ）', '（裁判員は、有罪か無罪か、刑の重さを、\n裁判官と同じ一票で話し合って決める）');
  if (room === 'kousai') pages.push('（高等裁判所の法廷。控訴審では、3人の裁判官が\n1審の判決にまちがいがなかったかを審理する）');
  if (famous(g)) pages.push('（傍聴席は満席だった。傍聴券の抽選に、\n長い列ができたらしい。記者席ではペンが走っている）');
  else pages.push('（傍聴席には、数人の人がいるだけだった）');
  const m = family(g)[0];
  if (m && cs.plea !== 'deny') pages.push(`（傍聴席の前の列に、${famCall(m)}の姿があった…）`);
  await narrate(g, pages);
}

// ---------------------------------------------------------------- 1階ロビー: 案内・開廷表・最高裁の見学
async function saiAnnaiTalk(g) {
  const who = WHO.saiAnnai;
  const items = ['裁判を傍聴したい', '開廷表を見る', '最高裁判所の見学', '民事・破産の窓口', since(g, 2006, 10) ? '法律の相談先' : '検察審査会', 'やめる'];
  const k = await ask(g, who, '裁判所の案内です。ご用件をどうぞ。', items, { cancel: items.length - 1 });
  const pick = items[k];
  if (pick === '裁判を傍聴したい') {
    await say(g, who, ['裁判は、だれでも傍聴できます。手続きはいりません。\n開廷中の法廷に、静かに入って座ってください。', '注目される裁判では、傍聴券の抽選になることも\nあります。録音・撮影は禁止です。', '左の扉から、地方裁判所の刑事法廷、' + (since(g, 2009, 6) ? '裁判員法廷、' : '') + '\n高等裁判所の法廷、民事のフロアの順です。']);
  } else if (pick === '開廷表を見る') await kaiteihyo(g);
  else if (pick === '最高裁判所の見学') await supremeTour(g);
  else if (pick === '民事・破産の窓口') await say(g, who, ['自己破産や個人再生の申立て（地方裁判所）と、\n敷金などの少額のもめごと（簡易裁判所）は、\n右手の「民事・破産」の扉の先です。']);
  else if (pick === '法律の相談先') await say(g, who, ['裁判所では、個別の法律相談には答えられないんです。', '「法テラス（日本司法支援センター）」に問い合わせれば、\n相談できる窓口や、無料の法律相談を案内してくれます。\n収入が少ない方は、弁護士費用の立て替えも。']);
  else if (pick === '検察審査会') await say(g, who, ['検察官が起訴しなかった事件について、\n不服がある被害者などは、検察審査会に申し立てられます。', 'くじで選ばれた市民11人が審査します。\n事務局は、この建物の中にあります。']);
  else await say(g, who, 'お気をつけて。');
}
async function kaiteihyo(g) {
  const wd = typeof g.weekday === 'number' ? g.weekday : 0;
  if (wd >= 5) { await narrate(g, '開廷表だ。\n…今日は土日なので、裁判は開かれていない。'); return; }
  const rows = [];
  const a = trialToday(g, 'chisai');
  if (a) rows.push(`地裁 刑事法廷　${a.title}（${a.note}）`);
  const b = trialToday(g, 'saibanin');
  rows.push(b ? `裁判員法廷　${b.title}（裁判員裁判・連日開廷）` : (since(g, 2009, 6) ? '裁判員法廷　本日の開廷なし' : '刑事大法廷　本日の開廷なし'));
  const c = trialToday(g, 'kousai');
  rows.push(c ? `高裁 法廷　${c.title}` : '高裁 法廷　本日の開廷なし');
  rows.push(since(g, 1998, 1) ? '民事　少額訴訟・ラウンドテーブル法廷' : '民事　調停');
  await narrate(g, ['開廷表だ。今日の予定が並んでいる。', rows.slice(0, 2).join('\n'), rows.slice(2).join('\n')]);
}
async function supremeTour(g) {
  const k = await ask(g, WHO.tour, ['最高裁判所は、ここから少し離れた隼町にあります。\n平日は、庁舎の見学ツアーがありますよ。', '大法廷や小法廷を、案内つきで見られます。'], ['見学に行く', 'やめておく'], { cancel: 1 });
  if (k !== 0) return;
  await narrate(g, '（見学ツアーに申しこんで、最高裁判所へ向かった）');
  await g.goto(SAI, 'daihotei', 10, 11, 'up');
  await say(g, WHO.tour, ['ここが大法廷です。正面の法壇には、\n最高裁判所の裁判官15人全員が座ります。', '大法廷が開かれるのは、法律などが憲法に合っているかを\n新しく判断するときや、これまでの判例を変えるときなど、\nかぎられた場合だけです。']);
}
async function tourGuideTalk(g) {
  const who = WHO.tour;
  const k = await ask(g, who, '見学の案内です。', ['大法廷について', '小法廷を見る', '上告ってなに？', '見学を終える'], { cancel: 3 });
  if (k === 0) await say(g, who, ['最高裁判所には、15人の裁判官がいます。\nふだんは5人ずつ、3つの小法廷に分かれて審理します。', '大法廷は15人全員で開かれます。\n法律が憲法に違反すると判断できるのは、\nこの大法廷だけなんです。']);
  else if (k === 1) { await g.goto(SAI, 'shohotei', 9, 10, 'up'); await say(g, who, ['こちらが小法廷です。\n上告された事件のほとんどは、ここで審理されます。', '上告審は書面での審理が中心で、\n多くの事件は法廷を開かずに結論が出ます。']); }
  else if (k === 2) await say(g, who, ['高等裁判所の判決に不服があるとき、\n最高裁判所に申し立てるのが「上告」です。', 'ただし、刑事事件で上告できる理由は、\n憲法違反や判例違反などに限られています。\n「刑が重すぎる」だけでは、上告の理由になりません。']);
  else { await narrate(g, '（見学を終えて、霞が関の裁判所に戻った）'); await g.goto(SAI, 'lobby', 9, 8, 'up'); }
}

// ---------------------------------------------------------------- 民事・破産のフロア
async function hasanTalk(g) {
  const who = WHO.hasanClerk;
  const j = jus(g);
  const debts = (typeof g.loanTotal === 'function' ? g.loanTotal() : 0) + ((g.state.rent && g.state.rent.debt) || 0);
  const b = j && j.bankrupt;
  if (b && !b.discharged && !b.closed) {
    await say(g, who, ['破産手続は、いま進んでいます。', '免責審尋の日には、かならず出頭してください。\n…呼出状がとどきますからね。']);
    return;
  }
  const k = await ask(g, who, '破産係です。自己破産や個人再生の申立ては\nこちらで受け付けています。', ['自己破産の流れ', '申し立てたい', 'やめる'], { cancel: 2 });
  if (k === 0) {
    await say(g, who, ['①申立て：申立書と、借金や財産の一覧を出します。\n弁護士に頼むのが一般的です。', '②破産手続開始の決定：財産がなければ、その場で手続を\n終える「同時廃止」。財産があれば、破産管財人が\nお金に換えて債権者に分けます。', '③免責審尋：裁判官が、借金の理由などを聞きます。\n④免責許可の決定：借金の支払い義務がなくなります。', '税金や罰金は免責されません。ギャンブルや浪費が\n原因でも、反省していれば裁量で免責されることが\n多いですね。手続き中は一部の仕事に就けません。']);
    return;
  }
  if (k !== 1) return;
  if (debts <= 0) { await say(g, who, '…借入れはないようですね。\n破産の申立ては、借金を返せなくなった人のための手続きです。'); return; }
  await say(g, who, ['申立書の書き方や、財産の調べ方には、\n専門的な知識がいります。', since(g, 2006, 10) ? 'まず法テラスか弁護士に相談しましょう。\n手続きの準備を手伝ってもらえます。' : 'まず弁護士会の法律相談に行きましょう。\n手続きの準備を手伝ってもらえます。']);
  if (typeof g.fileBankruptcy === 'function') await g.fileBankruptcy();
}
async function minjiUkeTalk(g) {
  const who = WHO.minjiClerk;
  const k = await ask(g, who, '簡易裁判所の民事受付です。\n身近なお金のもめごとの手続きを受け付けています。', [since(g, 1998, 1) ? '少額訴訟とは' : '民事調停とは', '支払督促とは', 'やめる'], { cancel: 2 });
  if (k === 0 && since(g, 1998, 1)) await say(g, who, [`${since(g, 2004, 4) ? '60万円' : '30万円'}以下のお金の請求なら、簡易裁判所の\n「少額訴訟」が使えます。原則として1回の期日で\n審理を終えて、その日のうちに判決が出ます。`, '裁判官と当事者が、丸いテーブルを囲んで話します。\n貸したお金や敷金、未払いの給料など、\n身近なもめごとが多いですよ。']);
  else if (k === 0) await say(g, who, ['「民事調停」は、裁判官と、市民から選ばれた\n調停委員が間に入って、話し合いで解決する手続きです。', '費用も安く、非公開なので、\nご近所や家族のもめごとにも使われます。']);
  else if (k === 1) await say(g, who, ['「支払督促」は、簡易裁判所の書記官が書類だけで\n支払いを命じる手続きです。相手が2週間以内に異議を\n出さなければ、差押えなどができるようになります。', '借金を延滞すると、貸金業者がこの手続きを\nとることもあります。届いたら、放っておかないで。']);
}
async function smallClaim(g) {
  if (!since(g, 1998, 1)) {
    await narrate(g, ['（調停室では、隣どうしの騒音のもめごとを、\n調停委員が間に入って話し合っている）', '（「おたがい、これからもご近所ですから」\n…少しずつ、歩み寄りが見えてきた）']);
    return;
  }
  const k = await ask(g, null, '（ラウンドテーブル法廷で、少額訴訟が開かれている。\n傍聴する？）', ['傍聴する', 'やめておく'], { cancel: 1 });
  if (k !== 0) return;
  const judge = { name: '裁判官', look: LK.judge2 }, iin = { name: '司法委員', look: LK.citizens[2] };
  const p = { name: '原告（元の借り主）', look: LK.citizens[3] }, d = { name: '被告（大家）', look: LK.citizens[4] };
  await say(g, judge, '原告は、アパートの敷金18万円の返還を求めています。\n被告は、修繕費がかかったので返せない、と。');
  await say(g, p, '壁の汚れは、ふつうに暮らしていてついたものです。\n入居したときの写真も、ここにあります。');
  await say(g, d, '…でも、ゆかの傷は借り主のせいでしょう。');
  await say(g, iin, ['ふつうに使って古くなった分の修繕費は、\n原則として貸す側の負担です。', 'ただ、ゆかの傷の分は、借り主の負担になりうる。\n…12万円を返す、ということでどうでしょう。']);
  await say(g, d, '…まあ、それなら。');
  await say(g, judge, 'では、和解が成立しました。\n被告は原告に、12万円を支払ってください。');
  await narrate(g, '（簡易裁判所の少額訴訟では、こうして話し合いで\n解決する「和解」も多い。司法委員は、市民から\n選ばれて、裁判官を手伝う人だ）');
  g.addNeed('stress', -2);
}
function roundTableProp(x, y) {
  return {
    type: 'prop', x, y, w: 3, h: 2, z: 2, solid: true,
    draw(ctx, sx, sy) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(sx + 24, sy + 27, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PC.benchD; ctx.beginPath(); ctx.ellipse(sx + 24, sy + 18, 23, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PC.benchL; ctx.beginPath(); ctx.ellipse(sx + 24, sy + 16, 23, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a07448'; ctx.beginPath(); ctx.ellipse(sx + 24, sy + 16, 19, 8, 0, 0, Math.PI * 2); ctx.fill();
      B(ctx, sx + 14, sy + 12, 6, 4, '#f4f0e4'); B(ctx, sx + 28, sy + 14, 5, 4, '#f4f0e4'); B(ctx, sx + 21, sy + 9, 5, 3, '#f4f0e4');
    },
  };
}
const caseLawyer = (g) => { const cs = curCase(g); return lawyerLook(cs) || LK.shisen; };
const bankruptFlow = (g) => flowIn(g, SAI, 'shinjin');

const courtExit = (tx) => [{ x: 9, y: 12, room: 'lobby', tx, ty: 2, dir: 'down', check: heldCheck('（審理の途中だ。勝手に法廷を出ることはできない…）') }];
registerPlace({
  id: SAI,
  name: '裁判所',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: 9, y: 8, dir: 'up' },
  legend: { '#': 'saibansho_walltop', '=': 'saibansho_wall', U: 'saibansho_wall_u', M: 'exit_mat' },
  rooms: {
    // -------------------------------------------------------------- 1階ロビー
    lobby: {
      floor: 'saibansho_stone',
      tiles: [
        '####################',
        '#==D==D==D==D==k=w=#',
        '#..................#',
        '#..................#',
        '#.qqq.........KKK..#',
        '#..................#',
        '#..................#',
        '#P................P#',
        '#..................#',
        '#########MM#########',
      ],
      legend: { D: 'door_wood', k: 'saibansho_wall+saibansho_board', w: 'saibansho_wall+window', q: 'keisatsu_bench', K: 'saibansho_counter', P: 'plant' },
      warps: [
        ...exitWarps(SAI, [9, 10], 9),
        { x: 3, y: 1, room: 'chisai', tx: 9, ty: 11, dir: 'up' },
        { x: 6, y: 1, room: 'saibanin', tx: 9, ty: 11, dir: 'up' },
        { x: 9, y: 1, room: 'kousai', tx: 9, ty: 11, dir: 'up' },
        { x: 12, y: 1, room: 'minji', tx: 9, ty: 9, dir: 'up' },
      ],
      entities: [
        plate(2, 1, '地裁 刑事', 3, '#4e3420'),
        plate(5, 1, (g) => (g && since(g, 2009, 6) ? '裁判員法廷' : '刑事大法廷'), 3, '#4e3420'),
        plate(8, 1, '高裁', 3, '#4e3420'),
        plate(11, 1, '民事・破産', 3, '#4e3420'),
        npc('sai_annai', 15, 3, 'down', WHO.saiAnnai, { talk: posted('down', saiAnnaiTalk) }),
        npc('sai_tour', 17, 4, 'left', WHO.tour, { talk: posted('left', supremeTour) }),
        npc('sai_mania', 3, 5, 'up', { name: '傍聴が趣味の人', look: LK.citizens[2] }, {
          text: ['裁判の傍聴は、だれでも、ただでできるんですよ。\nわたしはもう、10年も通っています。', 'ドラマより、ずっと静かで地味。\nでも、人の人生がそのまま出てくるんです。'],
        }),
        npc('sai_student', 6, 6, 'left', { name: '法学部の学生', look: LK.citizens[7] }, {
          wander: 1,
          text: ['ゼミの課題で、傍聴に来ました。', '刑事裁判の流れは、人定質問、起訴状朗読、\n黙秘権の告知、罪状認否、冒頭陳述、証拠調べ…\n最後が判決。教科書どおりでした！'],
        }),
        npc('sai_kisha', 13, 6, 'up', { name: '司法記者', look: LK.kisha2 }, {
          cond: (g) => lawYear(g) >= 1990,
          text: ['司法記者クラブの記者です。\n注目の裁判は、判決の日に傍聴券の抽選があって、\n何百人も並ぶことがあります。'],
        }),
        npc('sai_guard', 11, 7, 'left', WHO.guard, { cond: (g) => since(g, 2019, 4), talk: posted('left', lines(WHO.guard, ['入口で、手荷物検査にご協力をお願いしています。', '危ない物を持ちこまれないようにするためです。'])) }),
        { type: 'prop', x: 9, y: 7, w: 2, h: 1, solid: false, cond: (g) => since(g, 2019, 4), draw(ctx, sx, sy) { for (const dx of [0, 16]) { B(ctx, sx + dx + 1, sy - 8, 2, 22, '#9aa0aa'); B(ctx, sx + dx + 13, sy - 8, 2, 22, '#9aa0aa'); B(ctx, sx + dx + 1, sy - 9, 14, 2, '#c4cad4'); B(ctx, sx + dx + 6, sy - 9, 4, 1, '#3cff7a'); } } },
        { type: 'sign', x: 15, y: 1, talk: kaiteihyo },
      ],
      events: [
        { x: 9, y: 7, w: 2, on: 'step', cond: (g) => since(g, 2019, 4) && fl(g).gate !== day(g), run: async (g) => { fl(g).gate = day(g); await narrate(g, '（入口で、手荷物のX線検査と金属探知機の\nゲートをくぐった）'); } },
        { x: 2, y: 4, w: 3, on: 'action', run: async (g) => { await narrate(g, '待合のベンチ。\n法廷の開くのを待つ人たちが座っている。'); } },
      ],
      onEnter: (g) => { enteredByFlow(g, SAI, 'lobby'); },
    },

    // -------------------------------------------------------------- 法廷
    chisai: courtroom({
      room: 'chisai', seats: [8, 9, 10], chief: 9,
      judges: (g) => { const cs = flowCase(g, 'chisai'); return cs && caseSev(cs) >= 5 ? [8, 9, 10] : [9]; },
      warps: courtExit(3),
    }),
    saibanin: courtroom({
      room: 'saibanin', seats: [5, 6, 7, 8, 9, 10, 11, 12, 13], chief: 9, saibanin: true, saibaninSeats: [5, 6, 7, 11, 12, 13], mons: [2, 3, 15, 16],
      judges: () => [8, 9, 10],
      warps: courtExit(6),
    }),
    kousai: courtroom({
      room: 'kousai', seats: [8, 9, 10], chief: 9, floor: 'saibansho_floor_hi',
      judges: () => [8, 9, 10],
      warps: courtExit(9),
    }),
    shohotei: courtroom({
      room: 'shohotei', seats: [7, 8, 9, 10, 11], chief: 9, gallerySeat: true, noDock: true, floor: 'saibansho_floor_sup',
      judges: () => [7, 8, 9, 10, 11],
      warps: [{ x: 9, y: 12, room: 'daihotei', tx: 10, ty: 11, dir: 'up' }],
    }),

    // -------------------------------------------------------------- 勾留質問室
    kouryu: {
      floor: 'saibansho_floor',
      tiles: [
        '##########',
        '#==k=====#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '####M#####',
      ],
      legend: { k: 'saibansho_wall+saibansho_clock' },
      get entry() { return flowEntry(SAI, 'kouryu') ? { x: 4, y: 4, dir: 'up' } : { x: 4, y: 6, dir: 'up' }; },
      warps: [{ x: 4, y: 7, room: 'lobby', tx: 3, ty: 2, dir: 'down', check: heldCheck('（勾留質問の途中だ…）') }],
      entities: [
        plate(4.5, 1, '勾留質問室', 3, '#4e3420'),
        person(4, 2, 'down', LK.judge, (g) => flowIn(g, SAI, 'kouryu')),
        deskProp(3, 2, 3, 'light', { lip: 7, papers: [1] }),
        npc('sai_kouryu_clerk', 7, 2, 'down', WHO.clerk, {
          talk: posted('down', lines(WHO.clerk, ['勾留質問室です。検察官が勾留を請求すると、\n裁判官がここで被疑者から直接話を聞きます。', '逃げたり、証拠を隠したりするおそれがあると\n認められれば、まず10日間の勾留が決まります。\nさらに10日まで延長されることがあります。'])),
        }),
        deskProp(7, 2, 1, 'light', { lip: 7 }),
        person(3, 5, 'up', LK.police, (g) => flowIn(g, SAI, 'kouryu')),
        person(5, 5, 'up', LK.police, (g) => flowIn(g, SAI, 'kouryu')),
      ],
      onEnter: (g) => { enteredByFlow(g, SAI, 'kouryu'); },
    },

    // -------------------------------------------------------------- 民事・破産のフロア
    minji: {
      floor: 'saibansho_stone',
      tiles: [
        '####################',
        '#===w====dw========#',
        '#..................#',
        '#KKK..KKK..........#',
        '#..................#',
        '#..........,,,,,,,.#',
        '#.qq.qq....,,,,,,,.#',
        '#..........,,,,,,,.#',
        '#..........,,,,,,,.#',
        '#P........,,,,,,,,P#',
        '#########MM#########',
      ],
      legend: { w: 'saibansho_wall+window', d: 'saibansho_wall+door_wood', K: 'saibansho_counter', q: 'keisatsu_bench', ',': 'saibansho_woodfloor', P: 'plant' },
      warps: [
        { x: 9, y: 10, room: 'lobby', tx: 12, ty: 2, dir: 'down' },
        { x: 10, y: 10, room: 'lobby', tx: 12, ty: 2, dir: 'down' },
      ],
      entities: [
        plate(1, 1, '破産係', 3, '#4e3420'),
        plate(6, 1, '民事受付', 3, '#4e3420'),
        plate(12.5, 1, (g) => (g && since(g, 1998, 1) ? '簡裁 ラウンドテーブル法廷' : '簡裁 調停室'), 5, '#4e3420'),
        npc('sai_hasan', 2, 2, 'down', WHO.hasanClerk, { talk: posted('down', hasanTalk) }),
        npc('sai_minji', 7, 2, 'down', WHO.minjiClerk, { talk: posted('down', minjiUkeTalk) }),
        roundTableProp(13, 6),
        person(14, 5, 'down', LK.judge2, null),
        person(12, 6, 'right', LK.citizens[2], null),
        person(16, 6, 'left', LK.clerk, null),
        person(13, 8, 'up', LK.citizens[3], null),
        person(15, 8, 'up', LK.citizens[4], null),
        npc('sai_saimusha', 3, 7, 'up', { name: '申立ての相談に来た人', look: LK.citizens[0] }, {
          text: ['カードローンを、5社から借りてしまって…。\n弁護士さんに付き添ってもらって、\n破産の申立てに来たんです。', '恥ずかしいけど、やり直すための手続きだって\n言われて。少し、気が楽になりました。'],
        }),
        { type: 'sign', x: 9, y: 1, text: '扉に「審尋室」の札。\n破産や個人再生の申立てをした人から、\n裁判官が事情を聞く部屋だ。' },
      ],
      events: [
        { x: 13, y: 6, w: 3, h: 2, on: 'action', run: smallClaim },
        { x: 14, y: 8, on: 'action', run: smallClaim },
      ],
      onEnter: (g) => { enteredByFlow(g, SAI, 'minji'); },
    },

    // -------------------------------------------------------------- 審尋室（破産・個人再生）
    shinjin: {
      floor: 'saibansho_floor',
      tiles: [
        '###########',
        '#=w==k==w=#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#####M#####',
      ],
      legend: { w: 'saibansho_wall+window', k: 'saibansho_wall+saibansho_clock' },
      get entry() { return flowEntry(SAI, 'shinjin') ? { x: 5, y: 4, dir: 'up' } : { x: 5, y: 6, dir: 'up' }; },
      warps: [{ x: 5, y: 7, room: 'minji', tx: 9, ty: 2, dir: 'down' }],
      entities: [
        plate(4, 1, '審尋室', 3, '#4e3420'),
        person(5, 2, 'down', LK.judge3, bankruptFlow),
        deskProp(3, 2, 5, 'light', { lip: 7, papers: [0, 2, 4] }),
        npc('sai_shinjin_clerk', 8, 2, 'down', WHO.clerk, {
          talk: posted('down', lines(WHO.clerk, ['審尋室です。破産の申立てをした人に、\n裁判官が借金のいきさつや、いまの暮らしを聞きます。', '正直に話して、生活を立て直す気持ちを伝えることが\nいちばん大切です。'])),
        }),
        person(7, 4, 'up', caseLawyer, bankruptFlow),
        person(3, 4, 'up', LK.shisen, (g) => bankruptFlow(g) && !!(jus(g) && jus(g).bankrupt && jus(g).bankrupt.kind === 'kanzai')),
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, SAI, 'shinjin')) return;
        const j = jus(g);
        const f = fl(g);
        const stage = j && j.bankrupt ? `${j.bankrupt.filed}:${j.bankrupt.stage}` : 'none';
        if (f.shinjinSeen === stage) return;
        f.shinjinSeen = stage;
        const again = !!(j && j.bankrupt && j.bankrupt.stage === 'opened' && !j.bankrupt.discharged); // the 免責審尋
        await narrate(g, again ? '（また審尋室に呼ばれた。今日は免責審尋の日だ。\n…借りはじめたころは、こんな日が来るとは思わなかった）' : '（審尋室。小さな部屋で、裁判官と机をはさんで座った）');
      },
    },

    // -------------------------------------------------------------- 最高裁判所 大法廷（見学）
    daihotei: {
      floor: 'saibansho_floor_sup',
      topPad: 16,
      tiles: [
        '#####################',
        '#UU=jjjjjjjJjjjjjjj=#',
        '#ddddddddddddddddddd#',
        '#bbbbbbbbbbbbbbbbbbb#',
        '#...................#',
        '#.T.......W.......T.#',
        '#.T...............T.#',
        '#...................#',
        '#rrrrrrrrrGrrrrrrrrr#',
        '#.ggggggg...ggggggg.#',
        '#.ggggggg...ggggggg.#',
        '#.ggggggg...ggggggg.#',
        '##########M##########',
      ],
      legend: {
        j: 'saibansho_chairback', J: 'saibansho_chairback_c', d: 'saibansho_dais', b: 'saibansho_bench', T: 'saibansho_table', W: 'saibansho_witness',
        r: 'saibansho_bar', G: 'saibansho_bargate', g: 'saibansho_gallery',
      },
      entry: { x: 10, y: 11, dir: 'up' },
      warps: [{ x: 10, y: 12, room: 'lobby', tx: 9, ty: 8, dir: 'up', check: async (g) => { await narrate(g, '（見学を終えて、霞が関の裁判所に戻った）'); return true; } }],
      entities: [
        plate(7.5, 0.6, '最高裁判所 大法廷', 6, '#2a1e16', '#e8d8a8'),
        deskProp(1, 2, 19, 'bench', { lip: 7, drop: 0, closed: true, solid: false }),
        npc('sai_tourguide', 11, 9, 'down', WHO.tour, { talk: posted('down', tourGuideTalk) }),
        npc('sai_tourist1', 9, 10, 'up', { name: '見学の高校生', look: LOOKS.kid }, { text: ['うわ、天井が高い…！', '15人の裁判官が並ぶところ、見てみたいな。'] }),
        backrestProp(2, 9, 7), backrestProp(12, 9, 7), backrestProp(2, 10, 7), backrestProp(12, 10, 7), backrestProp(2, 11, 7), backrestProp(12, 11, 7),
      ],
      events: [
        { x: 2, y: 9, w: 7, h: 3, on: 'action', run: async (g) => { await narrate(g, '傍聴席だ。大法廷の判決の日には、\nここが記者と傍聴人でいっぱいになるという。'); } },
        { x: 12, y: 9, w: 7, h: 3, on: 'action', run: async (g) => { await narrate(g, '傍聴席だ。正面の法壇が、はるか遠くに見える。'); } },
      ],
      onEnter: (g) => { enteredByFlow(g, SAI, 'daihotei'); },
    },
  },
});

// ======================================================================== 刑務所
const serving = (g) => { const j = jus(g); return !!(j && j.prison); };
const servingKind = (g) => { const j = jus(g); return j && j.prison ? j.prison.kind : null; };
const prisonName = () => (PLACES[MU] && PLACES[MU].name) || '刑務所';
// The prison uniform (受刑者の衣類), worn from 入所 to 出所. The player's own look is kept and put back at the gate.
function wearUniform(g) {
  const f = fl(g);
  if (f.lookSaved) return;
  const lk = g.state.look || LOOKS.player;
  f.lookSaved = JSON.parse(JSON.stringify(lk));
  const u = { ...lk, top: PP.uniform, bottom: PP.uniformD };
  for (const k of ['jacket', 'tie', 'skirt', 'apron', 'kimono', 'ribbon', 'hat']) delete u[k];
  if (u.hair === 'cap' || u.hair === 'helmet') u.hair = 'short';
  if (u.glasses === 'sun') u.glasses = true;
  g.state.look = u;
}
function ownClothes(g) {
  const f = g.state && g.state.flags && g.state.flags.jpl;
  if (!f || !f.lookSaved) return false;
  g.state.look = f.lookSaved;
  delete f.lookSaved;
  return true;
}
onMorning((g) => { try { if (g.state && !serving(g)) ownClothes(g); } catch (e) { console.error(e); } });
// Any day of a term, also one resumed from an old save that never saw the 入所 scene: the inmate's clothes, this
// term's visit counter, and the days worked so far (the factory rank grows with them).
function ensureInmate(g, pr) {
  if (!g || !g.state || !pr || pr.kind === 'roueki' || pr.kind === 'shonenin') return;
  const f = fl(g);
  if (f.visitStart !== pr.start) { f.visitStart = pr.start; f.visits = 0; f.visited = []; }
  wearUniform(g);
  if (f.work && f.work.start === pr.start) f.work.days = Math.max(f.work.days || 0, Number(pr.work) || 0);
}
const inmateNo = (g, pr) => 1000 + ((((pr.start || 1) * 37 + (pr.caseId || 3) * 101) % 8999) + 8999) % 8999;
const callName = (g) => (since(g, 2024, 4) ? `${(g.state.profile && g.state.profile.familyName) || g.state.name}さん` : null);

// ---------------------------------------------------------------- 入所 / 出所 (the gate)
async function nyusho(g, pr) {
  const f = fl(g);
  if (f.nyusho === pr.start) return;
  f.nyusho = pr.start;
  f.visitStart = pr.start; f.visits = 0; f.visited = [];
  if (pr.kind === 'roueki') return;
  wearUniform(g);
  const no = inmateNo(g, pr);
  await narrate(g, ['（護送車を降りると、そこは高い塀の内側だった）', '（所持品をすべて預け、身体検査を受けた。\n私物は出所の日まで、ここで保管される）']);
  const cn = callName(g);
  await say(g, WHO.keimukan, cn
    ? [`あなたの称呼番号は${no}番です。\n点呼や書類では、この番号を使います。`, `ただ、ふだんは名前に「さん」をつけて呼びます。\n${cn}、ここでの規則を、しっかり覚えてください。`]
    : [`今日から、おまえの称呼番号は${no}番だ。\nここでは、この番号で呼ばれる。`, '規則を守って、まじめに務めること。']);
  await narrate(g, since(g, 2006, 5)
    ? '（はじめの2週間ほどは、生活の決まりや作業のしかたを\n学ぶ「刑執行開始時の指導」を受ける）'
    : '（はじめのしばらくは「考査」の期間。\n規則と作業のしかたをたたきこまれる）');
}
async function shusho(g) {
  const f = fl(g);
  const wore = ownClothes(g);
  const w = f.work;
  const pages = [];
  if (wore) pages.push('（預けていた私服に着替えた。\n袖を通すと、少しだけ大きく感じた）');
  if (w && w.xp > 0 && WORK[w.line] && w.start === (lastPrison && lastPrison.start)) pages.push(`（工場で覚えた${WORK[w.line].name}の腕前は「${workRank(workSkill(w))}」。\n…この手で、もう一度やり直そう）`);
  if (pages.length) await narrate(g, pages);
}
onJustice('released', (g, info) => {
  try {
    if (!info || !info.prison) return;
    ownClothes(g);
    if (family(g).length) return;
    const id = closeFriend(g, 2)[0];
    const def = id && PEOPLE[id];
    if (!def) return;
    const k = def.dialect === 'kansai';
    g.message({ from: def.name, person: id, kind: 'chat', text: k ? '出てきたって聞いたで。…おかえり。\n落ち着いたら、ごはん行こ。いつでも連絡してな。' : '出所したって聞いた。…おかえり。\n落ち着いたら、ごはん行こう。いつでも連絡して。' });
  } catch (e) { console.error(e); }
});

// ---------------------------------------------------------------- 刑務作業 (a small skill / stress loop)
const WORK = {
  mokko: {
    name: '木工', spot: [3, 5],
    steps: [
      ['かんなで板を削る作業だ。', ['木目にそって、ていねいに', '力まかせに早く']],
      ['椅子の脚を組む「ほぞ組み」だ。', ['寸法を何度も測る', '目分量で切る']],
      ['仕上げの塗装だ。', ['うすく何度も重ねる', '一度で厚く塗る']],
    ],
    made: ['折りたたみ椅子', 'ひのきのまな板', '小さな本棚'],
  },
  insatsu: {
    name: '印刷', spot: [9, 5],
    steps: [
      ['版の位置合わせだ。', ['見本と1枚ずつ見くらべる', 'だいたいで刷り始める']],
      ['インクの量の調整だ。', ['少しずつ足していく', 'まとめてたっぷり入れる']],
      ['刷り上がりの検品だ。', ['1枚ずつ光にかざす', 'ぱらぱらめくって終える']],
    ],
    made: ['役所の伝票', '封筒', '来年のカレンダー'],
  },
  yosai: {
    name: '洋裁', spot: [15, 5],
    steps: [
      ['ミシンの直線縫いだ。', ['布を手でまっすぐ送る', 'スピードを上げる']],
      ['ボタンつけだ。', ['糸を3回通して固める', '1回でとめる']],
      ['仕上げのアイロンだ。', ['縫い目にそって押さえる', 'ざっとかける']],
    ],
    made: ['作業着', 'エプロン', '帆布のトートバッグ'],
  },
};
const WORK_RANKS = [[0, '見習い'], [3, '一人前'], [7, '熟練'], [12, '班のまとめ役']];
const workRank = (xp) => WORK_RANKS.reduce((a, [n, name]) => (xp >= n ? name : a), '見習い');
// The skill is the care taken in the factory scenes plus the months of work (about one step per half a year worked).
const workSkill = (w) => (w ? (w.xp || 0) + Math.floor(Math.max(0, (w.days || 0) - (w.days0 || 0)) / (MONTH_DAYS * 6)) : 0);
const myWorkSpot = (g) => { const w = fl(g).work; return w && serving(g) && WORK[w.line] ? WORK[w.line].spot : null; };
async function factoryWork(g, pr) {
  const f = fl(g);
  if (pr.kind === 'roueki') {
    await narrate(g, '（労役場の作業は、紙袋の組み立てだった。\n1日に何百枚も、同じ形に折っていく…）');
    return;
  }
  if (pr.kind === 'kinko' && !pr.petition && !(f.work && f.work.start === pr.start)) return; // 禁錮: work only on request (the core asks)
  if (!f.work || f.work.start !== pr.start) {
    const ks = Object.keys(WORK);
    // (the core's own line follows: 「今日から、この工場で作業をしてもらう」)
    const k = await ask(g, WHO.keimukan, kokin(g)
      ? ['工場の担当だ。拘禁刑では、作業も\n立ち直りのための大事な時間になる。', '本人の希望と向き不向きも考えて決める。\nやってみたい作業はあるか？']
      : ['工場の担当だ。', '空いている作業の中から、希望を聞いておく。'], ks.map((x) => WORK[x].name));
    f.work = { line: ks[clamp(k, 0, ks.length - 1)], xp: 0, start: pr.start, made: 0, days: Number(pr.work) || 0, days0: Number(pr.work) || 0 };
    const sp = WORK[f.work.line].spot;
    if (g.map.placeId === MU && g.map.roomId === 'kojo') g.placePlayer(sp[0], sp[1], 'up');
    await narrate(g, `（${WORK[f.work.line].name}の班に入った。\n先輩の受刑者が、だまって道具の使い方を見せてくれた）`);
  }
  const w = f.work;
  const L = WORK[w.line];
  const [what, opts] = L.steps[w.made % L.steps.length];
  const before = workRank(workSkill(w));
  const c = await ask(g, null, `（${what}）`, opts);
  if (c === 0) { w.xp += 2; g.addNeed('stress', -4); await narrate(g, '（手を動かしているあいだは、よけいなことを考えずにすむ。\n仕上がりを見て、担当の刑務官が小さくうなずいた）'); }
  else { w.xp += 1; g.addNeed('stress', 2); await narrate(g, '（検品で、やり直しを命じられた。\n…あせっても、いいことはひとつもない）'); }
  w.made += 1;
  const after = workRank(workSkill(w));
  if (after !== before) await narrate(g, `（${L.name}の腕前が「${after}」になった。\nこの工場で作った${L.made[w.made % L.made.length]}は、刑務所作業製品として\n一般の人に売られるらしい）`);
}

// ---------------------------------------------------------------- 改善指導・教科指導 (the classroom)
// The term's first program: the evening of the first factory day, in the classroom, then back to the cell.
async function firstProgram(g, pr) {
  const f = fl(g);
  f.progStart = pr.start;
  await narrate(g, since(g, 2006, 5)
    ? '（夕方、教室に呼ばれた。作業のあいまに、\n立ち直りのための「改善指導」を受けることになる）'
    : '（夕方、教室に呼ばれた。週に何度か、\n教育の時間があるという）');
  await g.goto(MU, 'kyoiku', 7, 4, 'up');
  await classProgram(g, pr);
  await g.goto(MU, 'kyoshitsu', 5, 5, 'down');
}
async function classProgram(g, pr) {
  const f = fl(g);
  f.progStart = pr.start;
  const cs = (jus(g).record || []).slice().reverse().find((r) => r.outcome === 'prison') || {};
  const crime = cs.crime || '';
  if (!since(g, 2006, 5)) {
    const k = await ask(g, WHO.kyouiku, '今日は、どの時間に出る？', ['教誨（宗教家との面談）', '読み書きの勉強', '何もしない']);
    if (k === 0) await narrate(g, '（ボランティアの宗教家が、静かに話を聞いてくれた。\n「あなたは、やり直せる」――その言葉が、残った）');
    else if (k === 1) await narrate(g, '（漢字の書き取りと、手紙の書き方を習った。\n家族に出す手紙が、少しうまく書けた）');
    if (k !== 2) g.addNeed('stress', -5);
    return;
  }
  const items = [];
  if (VICTIM_CRIMES.has(crime)) items.push(['被害者の視点を取り入れた教育', 'victim']);
  if (['drunk_driving', 'traffic_injury'].includes(crime)) items.push(['交通安全指導', 'traffic']);
  items.push(['就労支援指導', 'job'], ['一般改善指導', 'general']);
  const k = await ask(g, WHO.kyouiku, kokin(g)
    ? ['教育専門官です。拘禁刑では、一人ひとりに合わせて\n作業と指導を組み合わせます。', '今日のプログラムを選んでください。']
    : '教育専門官です。今日のプログラムを選んでください。', items.map((x) => x[0]));
  const kind = (items[k] || items[items.length - 1])[1];
  if (kind === 'victim') await narrate(g, ['（被害にあった人や遺族の手記を読み、\nグループで話し合った）', '（「あの日から、夜道が歩けなくなった」――\n自分のしたことの重さが、少しずつ見えてくる）']);
  else if (kind === 'traffic') await narrate(g, ['（交通事故の被害者の話を聞き、飲酒運転の\nおそろしさを数字と映像で学んだ）', '（ハンドルを握る資格が、自分にあったのか…）']);
  else if (kind === 'job') await narrate(g, ['（履歴書の書き方、面接の受け答えを練習した。\n「前科のことを、どう話すか」も）', '（出所したら、ハローワークや保護観察所が\n仕事さがしを手伝ってくれるという）']);
  else await narrate(g, ['（お金の使い方、怒りとのつきあい方、人に頼ること…。\nグループで、自分の考え方のくせを見つめ直した）', '（「困ったときに、だれに相談できるか」――\n紙に書けた名前は、思ったより少なかった）']);
  f.programs = (f.programs || 0) + 1;
  g.addNeed('stress', -6);
}

// ---------------------------------------------------------------- extra visits (friends, the partner, the special one)
const VISIT = { look: null, name: '', on: false };
function nextVisitor(g, pr) {
  const f = fl(g);
  if (f.visitStart !== pr.start) return closeFriend(g, 1)[0] || null;
  if ((f.visits || 0) >= 2) return null;
  const done = new Set(f.visited || []);
  return closeFriend(g, 1).find((x) => !done.has(x)) || null;
}
function visitDue(g, pr) { try { return !!g && !!pr && pr.kind !== 'roueki' && pr.kind !== 'shonenin' && !!nextVisitor(g, pr); } catch (e) { return false; } }
async function friendVisit(g, pr) {
  const f = fl(g);
  if (f.visitStart !== pr.start) { f.visitStart = pr.start; f.visits = 0; f.visited = []; }
  if (f.visits >= 2 || VISIT.on) return;
  const id = nextVisitor(g, pr);
  const def = id && PEOPLE[id];
  if (!def) return;
  const aff = typeof g.aff === 'function' ? g.aff(id) : 40;
  const k = def.dialect === 'kansai';
  const partner = g.state.partner === id;
  const special = !!(g.state.people[id] && g.state.people[id].special);
  let pages;
  if (partner) pages = k ? ['…なんや、やせたな。ちゃんと食うとるか。', 'コンビは解散せえへんで。\nネタ、ノートに書きためとるからな。\n出てきたら、いちばんに舞台や。'] : ['…やせたな。ちゃんと食べてるか。', 'コンビは解散しないからな。\nネタ、ノートに書きためてる。\n出てきたら、いちばんに舞台だ。'];
  else if (special) pages = ['…ずっと、来ようか迷ってた。', 'でも、顔を見たら安心した。\n手紙、毎週書くね。…待ってるから。'];
  else if (aff >= 35) pages = k ? ['差し入れ、本とお菓子入れといたで。', 'みんな心配しとる。\n出てきたら、またアホな話しよな。'] : ['差し入れ、本とお菓子を入れておいたよ。', 'みんな心配してる。\n出てきたら、また一緒にごはん行こう。'];
  else pages = ['…正直、まだ気持ちの整理はついてない。\nでも、顔くらいは見ておこうと思って。', 'ちゃんと、ここで向き合ってほしい。\n…それだけ言いに来た。'];
  f.visits += 1;
  (f.visited = f.visited || []).push(id);
  VISIT.on = true; VISIT.look = def.look; VISIT.name = def.name;
  try {
    if (g.map.placeId !== MU || g.map.roomId !== 'menkai') await g.goto(MU, 'menkai', 5, 3, 'down');
    else g.placePlayer(5, 3, 'down');
    await narrate(g, `（面会室に呼ばれた。アクリル板の向こうに、\n${def.name}が座っていた）`);
    await say(g, { name: def.name, look: def.look }, pages);
    await narrate(g, '（面会の時間は、あっというまに終わった。\nそばで聞いていた刑務官が、そっと時計を見た）');
    g.addNeed('stress', aff >= 35 ? -12 : -4);
    if (aff >= 15) g.addAff(id, 2, true);
    await g.goto(MU, 'kyoshitsu', 5, 5, 'down');
  } finally { VISIT.on = false; }
}

// ---------------------------------------------------------------- the tour (刑務所の参観) for visitors
async function tourKeimusho(g) {
  const k = await ask(g, WHO.keimukan, ['刑務所の参観ですね。学生や地域の方の見学を、\n受け付けることがあります。', '受刑者のプライバシーのため、話しかけたり、\nじろじろ見たりしないでください。'], ['参観する', 'やめておく'], { cancel: 1 });
  if (k !== 0) return;
  await g.goto(MU, 'kojo', 18, 2, 'down');
  await say(g, WHO.keimukan, ['ここは工場です。木工、印刷、洋裁…\n作業の時間は、だいたい朝から夕方まで。', '作業の報奨金は、ひと月に数千円ほど。\n出所するときの、生活の元手になります。']);
}
const exitToGate = (g) => g.goto(MU, 'mon', 9, 10, 'up');
function innerExit(x, y) {
  return { x, y, dir: 'down', check: heldCheck('（勝手に出歩くことはできない…）'), place: MU, room: 'mon', tx: 9, ty: 10 };
}
// the street in front of the gate leads home
function homeSpot(g) {
  try { const h = g.housing(); if (h && PLACES[h.place]) return { place: h.place, room: h.room }; } catch (e) { /* no life */ }
  return { place: PLACES.home ? 'home' : 'tokyo', room: undefined };
}
function gateExit(x, y) {
  return {
    x, y, dir: 'down', check: heldCheck('（ここから出ることはできない…）'),
    get place() { const g = G(); return g ? homeSpot(g).place : 'tokyo'; },
    get room() { const g = G(); return g ? homeSpot(g).room : undefined; },
  };
}

// ---------------------------------------------------------------- 作業製品
registerItem('keimusho_soap', {
  name: 'ひのき石けん（刑務所作業製品）', price: 400,
  desc: '刑務所の工場で作られた石けん。使うと身だしなみ +15。',
  use: async (g) => { g.takeItem('keimusho_soap'); g.bathe(15, true); await g.say('ひのきの香りの石けんで、手と顔を洗った。\n身だしなみ +15'); },
});
registerItem('keimusho_board', { name: 'ひのきのまな板（刑務所作業製品）', price: 2500, desc: '受刑者が工場で仕上げた、木工のまな板。しっかりとした作り。' });
registerItem('keimusho_bag', { name: '帆布のトートバッグ（刑務所作業製品）', price: 1800, desc: '洋裁の工場で縫われた、じょうぶなトートバッグ。' });
async function shopTalk(g) {
  await say(g, WHO.shop, ['刑務所作業製品の展示販売です。\n受刑者が工場で作った品物を、どなたでも買えますよ。', '売り上げは国の収入になりますが、作業に打ちこむことは、\n受刑者が社会に戻る力になります。']);
  await g.shop(['keimusho_soap', 'keimusho_board', 'keimusho_bag'], { title: '刑務所作業製品', greeting: 'どれも、ていねいに作られています。' });
}
async function gateGuardTalk(g) {
  const who = WHO.keimukan;
  const k = await ask(g, who, `${prisonName()}の正門です。ご用件は？`, ['面会のきまり', '刑務所のこと', '参観（見学）', 'やめる'], { cancel: 3 });
  if (k === 0) await say(g, who, ['面会できるのは、家族や、仕事・生活の再建に\n必要な用事のある人などです。', '面会は平日の決まった時間に、回数の上限があります。\n刑務官が立ち会い、話の内容も聞いています。', '差し入れは、受付で決められた物だけ。\n手紙は、だれでも出すことができます。']);
  else if (k === 1) await say(g, who, [kokin(g) ? '2025年6月から、懲役と禁錮は「拘禁刑」になりました。\n罰を与えるだけでなく、立ち直りのための作業や指導を\n一人ひとりに合わせて行います。' : '刑務所は、罰を受ける場所であると同時に、\n社会に戻るための準備をする場所でもあります。', '刑期の3分の1をすぎれば、仮釈放の対象になります。\nただ、実際に認められるのは、まじめに過ごし、\n帰る場所や仕事の見通しがある人です。']);
  else if (k === 2) await tourKeimusho(g);
}

// ---------------------------------------------------------------- the rooms of the prison
const flowHere = (g, room) => flowIn(g, MU, room);
const inmateLooks = [LK.inmate, LK.inmate2, LK.inmate3, LK.inmate4, LK.inmate5];
const WORKERS = [];
for (const y of [5, 7, 9]) for (const x of [2, 3, 4, 8, 9, 10, 14, 15, 16]) WORKERS.push([x, y]);
const CELLMATES = [[3, 4, 'right'], [8, 4, 'left'], [3, 6, 'right'], [8, 6, 'left'], [6, 7, 'up']];
const YARD = [[4, 4], [12, 5], [15, 8], [7, 8]];
const STUDENTS = [[3, 4], [4, 4], [6, 4], [9, 4], [10, 4], [3, 6], [6, 6], [7, 6], [10, 6]];
registerPlace({
  id: MU,
  name: 'ドット刑務所',
  kind: 'building',
  bgm: 'office',
  // the gate is also the start room: g.goto reads place.start for it, so the flow's spot is decided here
  get start() {
    if (flowEntry(MU, 'mon')) return serving(G()) ? { room: 'mon', x: 9, y: 3, dir: 'up' } : { room: 'mon', x: 9, y: 6, dir: 'down' };
    return { room: 'mon', x: 9, y: 11, dir: 'up' };
  },
  legend: { '#': 'keimusho_walltop', '=': 'keimusho_wall', M: 'exit_mat' },
  rooms: {
    // -------------------------------------------------------------- 正門（入所・出所・面会受付・作業製品の販売）
    mon: {
      floor: 'sidewalk',
      tiles: [
        '####################',
        '#==w==w==Dw==w==w==#',
        '#cccccccccccccccccc#',
        '#cccccccccccccccccc#',
        'TTTTTTTTTGGTTTTTTTTT',
        'WWWWWWWWWggWWWWWWWWW',
        'h..........B.......h',
        'h.KKK..............h',
        'h..................h',
        'h...pp........pp...h',
        'h..................h',
        'h..................h',
        'hhhhhhhhh..hhhhhhhhh',
      ],
      legend: {
        D: 'keimusho_celldoor', c: 'keimusho_conc', T: 'keimusho_wallout_top', W: 'keimusho_wallout', G: 'keimusho_wallout_top', g: 'keimusho_gate',
        h: 'hedge', B: 'keimusho_guardbox', K: 'keimusho_kiosk', p: 'keimusho_planter', w: 'keimusho_wall+keimusho_window',
      },
      get entry() {
        if (!(flowEntry(MU, 'mon'))) return { x: 9, y: 11, dir: 'up' };
        const g = G();
        return serving(g) ? { x: 9, y: 3, dir: 'up' } : { x: 9, y: 6, dir: 'down' };
      },
      warps: [gateExit(9, 12), gateExit(10, 12)],
      entities: [
        plate(4, 5, prisonName, 4, '#3a4a3a'),
        busProp(13, 2, (g) => serving(g) && flowHere(g, 'mon')),
        person(8, 3, 'right', LK.keimukan, (g) => serving(g) && flowHere(g, 'mon')),
        person(10, 2, 'down', LK.keimukanW, (g) => serving(g) && flowHere(g, 'mon')),
        person(9, 8, 'up', (g) => { const m = family(g)[0]; return m ? famLook(g, m) : null; }, (g) => !serving(g) && flowHere(g, 'mon') && family(g).length > 0),
        npc('mu_gate', 12, 6, 'down', WHO.keimukan, { talk: posted('down', gateGuardTalk) }),
        npc('mu_shop', 3, 6, 'down', WHO.shop, { talk: posted('down', shopTalk) }),
        npc('mu_visitor', 6, 9, 'up', { name: '面会に来た女性', look: LOOKS.oldwoman }, {
          text: ['息子の面会に来たんです。月に一度、電車を乗りついで。', '会えるのは、ほんの少しの時間。\nでも、顔を見ると、来てよかったって思うんです。'],
        }),
        npc('mu_hogo', 15, 10, 'left', { name: '更生保護施設の職員', look: LK.citizens[0] }, {
          text: ['出所する人を迎えに来ました。帰る家のない人が、\nしばらく暮らしながら仕事をさがす施設の者です。', 'まわりに頼れる人がいるかどうかで、\n再犯するかどうかは大きく変わるんですよ。'],
        }),
        { type: 'sign', x: 10, y: 5, text: '高い塀に、鉄の門。\n…中の様子は、まったく見えない。' },
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, MU, 'mon')) { if (!serving(g)) ownClothes(g); return; }
        const j = jus(g);
        if (j && j.prison) await nyusho(g, j.prison);
        else await shusho(g);
      },
    },

    // -------------------------------------------------------------- 居室（共同室）
    kyoshitsu: {
      floor: 'keimusho_tatami',
      tiles: [
        '############',
        '#==ww===D==#',
        '#Stttttttts#',
        '#Ftttttttvt#',
        '#tttttTtttt#',
        '#tttttttttt#',
        '#tttttttttt#',
        '#tttttttttt#',
        '############',
      ],
      legend: { w: 'keimusho_wall+keimusho_window', D: 'keimusho_celldoor', S: 'keimusho_tatami+keimusho_shelf', s: 'keimusho_tatami+keimusho_wc', F: 'keimusho_tatami+keimusho_futon', v: 'keimusho_tatami+keimusho_tv', T: 'keimusho_tatami+keimusho_table', t: 'keimusho_tatami' },
      get entry() { return flowEntry(MU, 'kyoshitsu') ? { x: 5, y: 5, dir: 'down' } : { x: 8, y: 2, dir: 'down' }; },
      warps: [innerExit(8, 1)],
      entities: [
        ...CELLMATES.map(([x, y, d], i) => person(x, y, d, inmateLooks[i % inmateLooks.length], serving)),
        npc('mu_cell_guide', 7, 2, 'down', WHO.keimukanW, {
          cond: (g) => !serving(g),
          talk: posted('down', lines(WHO.keimukanW, ['ここは6人が暮らす共同室です。食事も、ここでとります。', '朝は早く起きて布団をたたみ、点検。\n昼間は工場で作業、夕方に戻って自由時間があり、\n夜9時ごろには消灯です。', 'ひとりになれる時間は、ほとんどありません。\n人との距離のとり方も、ここで学ぶことのひとつです。'])),
        }),
        { type: 'sign', x: 3, y: 1, text: '鉄格子のはまった窓。\n空が、四角く切りとられて見える。' },
        { type: 'sign', x: 1, y: 2, text: '私物を置くたな。\n手紙と本、洗面用具…持てる物は決められている。' },
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, MU, 'kyoshitsu') || VISIT.on) return;
        const j = jus(g);
        const pr = j && j.prison;
        if (!pr) return;
        const f = fl(g);
        if (f.cellIntro !== pr.start) {
          f.cellIntro = pr.start;
          // (a term resumed from an old save is already under way: no first-day scene)
          if (day(g) - pr.start <= 2) await narrate(g, ['（共同室には、ほかに5人の受刑者がいた。\nだれも、こちらの事件のことは聞いてこない）', '（朝は早く起きて布団をたたみ、点検。\n昼は工場、夕方に戻って、夜9時ごろに消灯…）']);
          return;
        }
        // the term's first 改善指導: the evening of the first factory day (a resumed term: a while after the cell)
        if (pr.kind !== 'roueki' && f.progStart !== pr.start && (f.kojoSeen === pr.start || day(g) - pr.start >= MONTH_DAYS * 2)) await firstProgram(g, pr);
      },
    },

    // -------------------------------------------------------------- 工場（刑務作業）
    kojo: {
      floor: 'keimusho_floor',
      tiles: [
        '####################',
        '#==w==w==w==w==w==D#',
        '#LL.............xx.#',
        '#..................#',
        '#.BBB...PPP...SSS..#',
        '#..................#',
        '#.BBB...PPP...SSS..#',
        '#..................#',
        '#.BBB...PPP...SSS..#',
        '#..................#',
        '#p.................#',
        '####################',
      ],
      legend: { w: 'keimusho_wall+keimusho_window', D: 'keimusho_celldoor', L: 'keimusho_lumber', x: 'boxes', B: 'keimusho_bench', P: 'keimusho_press', S: 'keimusho_sewing', p: 'plant' },
      get entry() {
        if (!(flowEntry(MU, 'kojo'))) return { x: 18, y: 2, dir: 'down' };
        const g = G();
        const s = g && myWorkSpot(g);
        return s ? { x: s[0], y: s[1], dir: 'up' } : { x: 3, y: 5, dir: 'up' };
      },
      warps: [innerExit(18, 1)],
      entities: [
        plate(1, 1, '木工', 3, '#3a4a3a'), plate(7, 1, '印刷', 3, '#3a4a3a'), plate(13, 1, '洋裁', 3, '#3a4a3a'),
        person(9, 2, 'down', LK.keimukan, null),
        deskProp(8, 2, 3, 'grey', { lip: 8, papers: [0], drop: 6 }),
        ...WORKERS.map(([x, y], i) => person(x, y, 'up', inmateLooks[(i * 3) % inmateLooks.length], (g) => { const s = myWorkSpot(g); return !(s && s[0] === x && s[1] === y); }, { frame: false })),
        npc('mu_kojo_guide', 17, 3, 'left', WHO.keimukanW, {
          cond: (g) => !serving(g),
          talk: posted('left', async (g) => {
            await say(g, WHO.keimukanW, ['工場では、会話は必要なときだけ。\n担当の刑務官が、あの台から全体を見ています。', '作った製品は、刑務所作業製品として販売されたり、\n役所の備品になったりします。', since(g, 2025, 6) ? '拘禁刑になってから、作業は「義務」から、\n立ち直りのための「指導」の一部になりました。' : '作業を通じて、働く習慣と技術を身につける――\nそれが出所後の暮らしにつながります。']);
            const k = await ask(g, WHO.keimukanW, 'ほかの場所も見ますか？', ['居室', '運動場', '教室', '面会室', '参観を終える'], { cancel: 4 });
            if (k === 0) await g.goto(MU, 'kyoshitsu', 8, 2, 'down');
            else if (k === 1) await g.goto(MU, 'undojo', 9, 2, 'down');
            else if (k === 2) await g.goto(MU, 'kyoiku', 12, 2, 'down');
            else if (k === 3) await g.goto(MU, 'menkai', 5, 6, 'up');
            else await exitToGate(g);
          }),
        }),
        { type: 'sign', x: 1, y: 2, text: '木工用の材木が積まれている。\nひのきの香りがする。' },
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, MU, 'kojo')) return;
        const j = jus(g);
        if (!j || !j.prison) return;
        fl(g).kojoSeen = j.prison.start;
        await factoryWork(g, j.prison);
      },
    },

    // -------------------------------------------------------------- 運動場
    undojo: {
      floor: 'keimusho_ground',
      tiles: [
        '####################',
        '#==w==w==D==w==w===#',
        'f..................f',
        'f.lllllllllllllll..f',
        'f..................f',
        'f..................f',
        'f..................f',
        'f..................f',
        'f.lllllllllllllll..f',
        'f..................f',
        'ffffffffffffffffffff',
      ],
      legend: { w: 'keimusho_wall+keimusho_window', D: 'keimusho_celldoor', f: 'keimusho_fence', l: 'keimusho_lane' },
      get entry() { return flowEntry(MU, 'undojo') ? { x: 9, y: 5, dir: 'down' } : { x: 9, y: 2, dir: 'down' }; },
      warps: [innerExit(9, 1)],
      entities: [
        person(2, 2, 'down', LK.keimukan, null),
        ...YARD.map(([x, y], i) => person(x, y, ['right', 'left', 'up', 'down'][i % 4], inmateLooks[(i + 2) % inmateLooks.length], null)),
        npc('mu_yard_runner', 11, 3, 'right', { name: '走っている受刑者', look: LK.inmate5 }, { wander: 3, cond: (g) => serving(g), text: '（黙々と、線の上を走っている）' }),
        npc('mu_yard_guide', 16, 2, 'down', WHO.keimukan, {
          cond: (g) => !serving(g),
          talk: posted('down', lines(WHO.keimukan, ['運動場です。運動の時間は、1日30分ほど。\n雨の日は、体育館や屋内でします。', '走る人、体操をする人、ただ空を見ている人…\n外の空気を吸える、貴重な時間です。'])),
        }),
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, MU, 'undojo')) return;
        if (serving(g)) await narrate(g, '（運動の時間。高いフェンスの向こうに、\n木々のこずえがかすかに見える。…外の空気だ）');
      },
    },

    // -------------------------------------------------------------- 教室（改善指導・教科指導）
    kyoiku: {
      floor: 'keimusho_floor',
      tiles: [
        '##############',
        '#==w=BBBB=w=D#',
        '#............#',
        '#..dd.dd.dd..#',
        '#............#',
        '#..dd.dd.dd..#',
        '#............#',
        '#............#',
        '##############',
      ],
      legend: { w: 'keimusho_wall+keimusho_window', B: 'keimusho_wall+keimusho_blackboard', D: 'keimusho_celldoor', d: 'keimusho_desk' },
      get entry() { return flowEntry(MU, 'kyoiku') ? { x: 7, y: 4, dir: 'up' } : { x: 12, y: 2, dir: 'down' }; },
      warps: [innerExit(12, 1)],
      entities: [
        npc('mu_kyouiku', 6, 2, 'down', WHO.kyouiku, {
          talk: posted('down', async (g) => {
            if (serving(g)) { await say(g, WHO.kyouiku, '今日のプログラムを、しっかり受けてくださいね。'); return; }
            await say(g, WHO.kyouiku, since(g, 2006, 5)
              ? ['教育専門官です。ここでは「改善指導」をしています。', '被害者の気持ちを考える教育、薬物やアルコールの問題、\n仕事に就くための指導…。\n事件の背景に合わせて、受けるプログラムが決まります。', '中学の勉強をやり直す「教科指導」もあります。\n出所までに、資格をとる人もいるんですよ。']
              : ['教育の担当です。読み書きの勉強や、\n宗教家との面談（教誨）などをしています。']);
          }),
        }),
        ...STUDENTS.map(([x, y], i) => person(x, y, 'up', inmateLooks[(i + 1) % inmateLooks.length], (g) => serving(g) || flowHere(g, 'kyoiku'))),
        { type: 'sign', x: 7, y: 1, talk: async (g) => { await narrate(g, since(g, 2006, 5) ? '黒板に「被害者の手紙を読んで、感じたこと」\nと書いてある。' : '黒板に、漢字の書き取りの問題が書いてある。'); } },
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, MU, 'kyoiku')) return;
        const j = jus(g);
        if (j && j.prison && j.prison.kind !== 'roueki') await classProgram(g, j.prison);
      },
    },

    // -------------------------------------------------------------- 面会室
    menkai: {
      floor: 'keimusho_floor',
      tiles: [
        '############',
        '#====c=====#',
        '#..........#',
        '#...ssss...#',
        '#AAAAAAAAAA#',
        '#...ssss...#',
        '#..........#',
        '#####MM#####',
      ],
      legend: { c: 'keimusho_wall+clock', s: 'keimusho_stool', A: 'keimusho_acrylic' },
      get entry() { return VISIT.on || (flowEntry(MU, 'menkai') && serving(G())) ? { x: 5, y: 3, dir: 'down' } : { x: 5, y: 6, dir: 'up' }; },
      warps: [
        { x: 5, y: 7, place: MU, room: 'mon', tx: 9, ty: 10, dir: 'down', check: heldCheck() },
        { x: 6, y: 7, place: MU, room: 'mon', tx: 9, ty: 10, dir: 'down', check: heldCheck() },
      ],
      entities: [
        person(9, 2, 'down', LK.keimukan, (g) => VISIT.on),
        deskProp(9, 2, 1, 'grey', { lip: 7 }),
        person(5, 5, 'up', () => VISIT.look, () => VISIT.on && !!VISIT.look, { solid: false }),
        npc('mu_menkai_staff', 9, 5, 'left', WHO.menkaiUke, {
          cond: () => !VISIT.on,
          talk: posted('left', lines(WHO.menkaiUke, ['面会室です。受刑者と面会する人は、\nアクリル板ごしに話します。', '刑務官が立ち会い、話の内容を記録します。\n事件のことや、逃げる相談などはできません。', '短い時間ですが、家族の顔を見ることが、\nなによりの支えになる人も多いんです。'])),
        }),
        { type: 'sign', x: 2, y: 4, text: 'アクリル板に、話すための小さな穴が\nいくつも開いている。' },
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, MU, 'menkai') || VISIT.on) return;
        const j = jus(g);
        if (j && j.prison) await friendVisit(g, j.prison);
      },
    },

    // -------------------------------------------------------------- 面接室（仮釈放の審理）
    shinri: {
      floor: 'keimusho_floor',
      tiles: [
        '##########',
        '#=w====w=#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '####M#####',
      ],
      legend: { w: 'keimusho_wall+keimusho_window' },
      get entry() { return flowEntry(MU, 'shinri') ? { x: 4, y: 4, dir: 'up' } : { x: 4, y: 6, dir: 'up' }; },
      warps: [innerExit(4, 7)],
      entities: [
        person(4, 2, 'down', LK.iin, (g) => flowHere(g, 'shinri')),
        person(5, 2, 'down', LK.iin2, (g) => flowHere(g, 'shinri')),
        deskProp(3, 2, 4, 'wood', { lip: 7, papers: [0, 3] }),
        person(7, 4, 'left', LK.keimukan, (g) => flowHere(g, 'shinri')),
        npc('mu_shinri_staff', 7, 3, 'left', WHO.keimukan, {
          cond: (g) => !flowHere(g, 'shinri'),
          talk: posted('left', lines(WHO.keimukan, ['仮釈放の面接に使う部屋です。\n地方更生保護委員会の委員が来て、本人と話します。', '刑務所での生活ぶり、反省の深さ、\n出たあとに帰る場所と、見守ってくれる人…。\nそれを見て、仮釈放を認めるかどうかが決まります。', '仮釈放のあとは、残りの刑期のあいだ保護観察。\n保護司と面接しながら、社会で暮らします。'])),
        }),
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, MU, 'shinri')) return;
        const f = fl(g);
        const j = jus(g);
        const pr = j && j.prison;
        if (pr && f.shinriSeen !== pr.start) {
          f.shinriSeen = pr.start;
          await narrate(g, '（面接室に呼ばれた。机の向こうに、\n地方更生保護委員会の委員と、保護観察官が座っている）');
        }
      },
    },

    // -------------------------------------------------------------- 拘置所の単独室（起訴後の勾留）
    kochi: {
      floor: 'keimusho_tatami',
      tiles: [
        '########',
        '#=ww=D=#',
        '#ttttts#',
        '#ttttta#',
        '#Ftttt.#',
        '#tTtttt#',
        '########',
      ],
      legend: { w: 'keimusho_wall+keimusho_window', D: 'keimusho_celldoor', s: 'keimusho_tatami+keimusho_sink', a: 'keimusho_tatami+keimusho_wc', F: 'keimusho_tatami+keimusho_futon', T: 'keimusho_tatami+keimusho_table', t: 'keimusho_tatami', '.': 'keimusho_tatami' },
      get entry() { return flowEntry(MU, 'kochi') ? { x: 3, y: 3, dir: 'down' } : { x: 5, y: 2, dir: 'down' }; },
      warps: [innerExit(5, 1)],
      entities: [
        npc('mu_kochi_staff', 4, 2, 'down', WHO.keimukanW, {
          cond: (g) => !flowHere(g, 'kochi') && !serving(g) && !inCustody(g),
          talk: posted('down', lines(WHO.keimukanW, ['ここは拘置所の単独室です。起訴されたあと、\n判決が出るまでの「未決」の人が過ごします。', '刑が決まっていないので、作業の義務はありません。\n服も私服でかまいません。', '家族の面会は平日に。弁護士との面会（接見）は、\n職員の立会いなしでできます。'])),
        }),
      ],
      onEnter: async (g) => {
        if (!enteredByFlow(g, MU, 'kochi')) return;
        const cs = activeCase(g);
        const f = fl(g);
        if (cs && f.kochiSeen !== cs.id) {
          f.kochiSeen = cs.id;
          await narrate(g, ['（拘置所の単独室。3畳ほどの部屋に、\n小さな机と洗面台、トイレがある）', '（判決が出るまでは「未決」。作業はなく、\n一日じゅう、自分の事件のことを考えてしまう…）']);
        }
      },
    },
  },
});

// ---------------------------------------------------------------- the HUD steps aside during scenes in the inner rooms
// (tall rooms: the bench / the officer's desk would sit under the HUD while people talk)
const hudOff = () => { const g = G(); return !!(g && g.busy > 0); };
for (const [pid, rooms] of [[KEI, ['sodan', 'torishirabe', 'ryuchi']], [KEN, ['kenjishitsu', 'tokuso']], [SAI, ['chisai', 'saibanin', 'kousai', 'shohotei', 'daihotei', 'kouryu', 'shinjin', 'minji']], [MU, ['mon', 'kyoshitsu', 'kojo', 'undojo', 'kyoiku', 'menkai', 'shinri', 'kochi']]]) {
  for (const r of rooms) { const def = PLACES[pid] && PLACES[pid].rooms[r]; if (def) Object.defineProperty(def, 'hideHud', { configurable: true, enumerable: true, get: hudOff }); }
}
