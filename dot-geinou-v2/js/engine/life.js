// Life simulation core: daily needs, the week and rent, housing, people
// (affinity / hearts), fans, regular shows and phone messages.
//
// Registries (content modules fill them on import):
//   registerHousing(id, def)   where you live: rent per week, the place with your bed, perks
//   registerPerson(id, def)    someone you can befriend (NPCs link to it with `person: id`)
//   registerHangout(id, def)   a spot you can invite a friend to
//   registerRegular(id, def)   a weekly TV / radio / stage show you can be offered
//   registerFurniture(id, def) furniture you can buy for your home (perks while owned)
//   registerPhoneApp(id, def)  an extra app on the phone
//
// installLife(Game.prototype) adds the g.* methods documented below. All state lives
// in g.state (see newState in state.js), so saves carry it automatically.

import { clamp, fmtMoney } from './util.js';
import { COLORS } from './draw.js';
import { audio } from './audio.js';
import { ITEMS } from './state.js'; // runtime use only (state.js imports this module too)
import { personalityMult, ERAS, deviceText } from './profile.js';

// ---------------------------------------------------------------- calendar
export const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
export const weekdayOf = (day) => (((day - 1) % 7) + 7) % 7; // day 1 = 月曜
export const weekOf = (day) => Math.floor((day - 1) / 7) + 1;
export const weekdayName = (day) => WEEKDAYS[weekdayOf(day)];

// ---------------------------------------------------------------- needs
// hunger: 満腹度 (100 = full, 0 = starving). stress: 0 = relaxed, 100 = burnt out.
// clean: 身だしなみ (100 = spotless).
export const NEEDS = {
  hunger: { name: '満腹', good: 'high' },
  stress: { name: 'ストレス', good: 'low' },
  clean: { name: '身だしなみ', good: 'high' },
};
export const FULL = 90; // at or above this you cannot eat
export const HUNGRY = 20; // below: minigame penalty, poor sleep
export const STRESSED = 70; // at or above: minigame penalty
export const BURNOUT = 100; // at: no jobs / lessons / auditions until you unwind
export const SCRUFFY = 30; // below: less fame from jobs, less affinity
export const MORNING_SHOWER = 35; // 身だしなみ from the morning shower at a home with a bath
export const REST_DAY_STRESS = 20; // stress removed the morning after a day without work
const AWAY_SLEEP_STRESS = 12; // a night away from home (hotel, a back room)
const AWAY_SHOWER = { hotel: 40 }; // placeId -> morning shower when sleeping there

// What each activity costs. Content may call g.lifeTick(kind) or g.lifeTick({ hunger, stress, clean }).
export const ACTIVITY = {
  job: { hunger: -10, stress: 8, clean: -10 },
  lesson: { hunger: -8, stress: 5, clean: -6 },
  audition: { hunger: -8, stress: 10, clean: -6 },
  walk: { hunger: -1, clean: -1 }, // every WALK_STEPS steps
  night: { hunger: -30, clean: -20 },
};
export const WALK_STEPS = 150;
export const GIFT_REPEAT_DAYS = 7; // the same gift again within this many days: only +1

// What the player is told when a need crosses a penalty line (toast once a day, the tip
// the first time ever). Tips are one message page (3 lines of ~36 characters).
const NEED_WARN = {
  hunger: {
    toast: 'おなかがペコペコ…（ミニゲーム -20%・よく眠れない）',
    tip: '（おなかがペコペコだ…。満腹が20を切ると、\nミニゲームが難しくなり、夜もよく眠れない。\nコンビニや商店街、家のキッチンで何か食べよう）',
  },
  stress: {
    toast: 'ストレスがたまってきた（ミニゲーム -15%）',
    tip: '（ストレスがたまってきた…。70をこえると\nミニゲームが難しくなる。ジョギングやお風呂、\nカフェ、友だちと遊んで息抜きしよう）',
  },
  burnout: {
    toast: 'ストレスが限界！お仕事はお休みして気分転換を',
    tip: '（ストレスが限界だ！このままでは、お仕事も\nレッスンもできない。公園でジョギング（無料）や\n家でテレビ、カラオケで気分転換。休むのもいい）',
  },
  clean: {
    toast: '身だしなみが乱れてきた（知名度・好感度が上がりにくい）',
    tip: '（身だしなみが乱れてきた…。30を切ると、\nお仕事の評価や人の好感度が上がりにくくなる。\n家のお風呂や銭湯で、さっぱりしよう）',
  },
};
const ITEM_HEALS = (k) => !!(ITEMS[k] && ITEMS[k].heal > 0);

// ---------------------------------------------------------------- registries
// [R13-F] the morning's message budget and the repeat collapse (see message())
export const MORNING_MSG_CAP = 7;
const MSG_DUP_DAYS = 30;
const msgKey = (m) => `${m.from}|${String(m.text).replace(/[0-9０-９,.\u2060¥￥]+/g, '#').replace(/\s+/g, '').replace(/（\d+回目）$/, '').slice(0, 90)}`;
export const HOUSING = {};
// def: { name, place, room?, rent (per week), sleepStress (stress removed per night),
//   kitchen: bool, bath: bool (morning shower: 身だしなみ +MORNING_SHOWER), requires: { fame }, moveCost, desc,
//   slots (furniture) }
export function registerHousing(id, def) {
  HOUSING[id] = { id, rent: 0, sleepStress: 15, kitchen: false, bath: false, slots: 4, moveCost: 0, ...def };
}
registerHousing('dotsou', {
  name: 'ドット荘', place: 'home', rent: 8000, sleepStress: 15, kitchen: true, bath: true, slots: 4,
  desc: '大家さんがやさしい、木造2階建てのアパート。小さなユニットバスつき。',
});

export const PEOPLE = {};
// def: { name, look, kind: 'comedian'|'idol'|'actor'|'singer'|'staff'|'local',
//   where: 'よしもと 東京本部のロビー' (where to find them, shown in contacts),
//   profile, likes: [itemId], loves: [itemId], dislikes: [itemId],
//   events: [{ level, run: async (g, person) => {} }]   heart events, run once on the
//                                                       first talk at that heart level
//   messages: ['…'] phone small talk, invites: ['…'] phone invitation lines,
//   hangout: { [spotId]: ['…'] } lines during a hangout (default: generic lines),
//   canPartner: bool (can become your 相方), special: bool (can become 大切な人) }
// Optional, used by the talk menu / phone / hangouts (phone.js), each falls back to a
// generic line (standard Japanese, or Kansai-ben when isKansai(def)):
//   dialect: 'kansai'           Kansai generic lines (also when `where` mentions なんば / 大阪)
//   greet: '…' | ['…', '…'] (one picked at random) | { 1: '…', 2: '…', default } | (g, level, def) => …
//                               greeting that opens the menu (from the second talk)
//   talkLabel: '買い物する'      label of 話す (e.g. shop NPCs)
//   chats: ['…' | (g) => '…']   one personal line on the first talk of a day (♥1+; before
//                               that, what a known NPC without its own talk says)
//   chat: ['…']                 what 話す says when the NPC entity has no talk / text
//   yes / inviteYes             reply when you invite them face to face
//   giftLines: { love, like, neutral, dislike, [itemId]: … }   reactions ({item} = item name)
//   hangout[spotId] / hangout.default: lines; strings that start with '（' are narration,
//                               { text, name, look } picks another speaker
//   inviteYes, callYes, callShy, callAgain, thanks, declined, hangBye, giftDone,
//   hangDone, again (menu prompt after an action), partnerText
//                               other single lines (string | string[] | (g, def) => …)
//   short: 'ジロー'              shorter name, used where the full name does not fit (phone)
export function registerPerson(id, def) {
  PEOPLE[id] = { id, likes: [], loves: [], dislikes: [], events: [], messages: [], invites: [], hangout: {}, ...def };
}
// Whether a person speaks Kansai-ben in the generic lines.
export function isKansai(def) {
  return !!def && (def.dialect === 'kansai' || def.kansai === true || (!def.dialect && /なんば|大阪|新喜劇|松竹/.test(def.where || '')));
}
export const HEARTS = [[0, '知り合い'], [15, '顔見知り'], [35, '友だち'], [60, '仲良し'], [85, '親友']];
export function heartIndex(aff) {
  let i = 0;
  HEARTS.forEach(([min], k) => { if (aff >= min) i = k; });
  return i;
}

export const HANGOUTS = {};
// def: { name, price, stress (removed), aff (gained), stamina (cost, default 5), fill (hunger), clean,
//   place (placeId shown in text), lines: ['…'] generic narration }
// Optional: go: '公園へおさんぽ' (the hangout's title card: 「ジローと 公園へおさんぽ」; default
//   「ジローと ラーメン屋へ」), heal (stamina back; a meal spot with fill heals fill / 3 by default).
export function registerHangout(id, def) {
  HANGOUTS[id] = { id, price: 1000, stress: 15, aff: 5, stamina: 5, ...def };
}
registerHangout('ramen', { name: 'ラーメン屋', price: 900, stress: 12, aff: 5, fill: 45, lines: ['ズルズル…。仕事の話、くだらない話。', 'スープまで飲み干した。'] });
registerHangout('park', { name: '公園で散歩', go: '公園へおさんぽ', price: 0, stress: 10, aff: 4, lines: ['ベンチに座って、とりとめのない話をした。', '気持ちのいい風がふいている。'] });

export const REGULARS = {};
// def: { title, place, weekday (0=月), medium: 'tv'|'radio'|'stage'|'event' (door prompt wording),
//   requires (g.checkRequires format), pay, fame, fans,
//   skill, minigame, opts, stamina (default 15), host, hostLook, desc, offer (offer message) }
export function registerRegular(id, def) {
  REGULARS[id] = { id, stamina: 15, pay: 10000, fame: 15, fans: 60, ...def };
}
// How a show is talked about, by REGULARS[id].medium: the door prompt (day / where / go),
// the phone and the notebook (act: 'きょうは収録' / 'きょうは本番', done: after the show).
// 'event' is a one-day event (not a weekly show: the 家計 app leaves it out of the weekly pay).
export const SHOW_WORDS = {
  tv: { day: '収録日', where: 'スタジオ', go: '収録へ行く', act: '収録', done: '収録ずみ' },
  radio: { day: '収録日', where: 'ブース', go: '収録へ行く', act: '収録', done: '収録ずみ' },
  stage: { day: '本番の日', where: '楽屋', go: '本番へ行く', act: '本番', done: '出演ずみ' },
  event: { day: 'イベントの日', where: '会場', go: '会場へ行く', act: 'イベント', done: '出演ずみ' },
};
export const showWords = (r) => SHOW_WORDS[r && r.medium] || SHOW_WORDS.tv;
// An offer (kind 'offer') can be accepted for this many days; then it expires (the morning
// marks it answered: 'expired'), so an old offer never brings a show past the 4-show limit.
export const OFFER_DAYS = 14;
const INBOX_MAX = 60;
const BILL_KEEP_DAYS = 30; // an unread bill stays at least this long when the inbox is full

export const FURNITURE = {};
// def: { name, price, desc, sleepStress (extra stress removed per night), stamina (max stamina +),
//   clean (身だしなみ each morning +), stress (stress removed each morning), kitchen, housing: [ids] or null }
export function registerFurniture(id, def) {
  FURNITURE[id] = { id, price: 10000, ...def };
}

export const PHONE_APPS = {};
// def: { name, icon: (ctx, x, y) => {} (24x24 px), color, order, badge: (g) => n, open: async (g) => {} }
export function registerPhoneApp(id, def) {
  PHONE_APPS[id] = { id, order: 50, color: '#5a6fd8', ...def };
}

// ---------------------------------------------------------------- state
// Default life fields (merged into older saves by loadGame).
export function newLifeState() {
  return {
    life: { hunger: 70, stress: 10, clean: 90, steps: 0 },
    housing: 'dotsou',
    rent: { paidWeek: 1, debt: 0, late: 0 },
    furniture: {}, // furnitureId -> true (owned; at most housing().slots pieces)
    people: {}, // personId -> { aff, met, talkDay, giftDay, hangDay, seen: {level: true}, partner, special }
    partner: null,
    fans: 0,
    regulars: {}, // regularId -> { since, doneWeek, missed, count, declined }
    phone: { inbox: [], nextId: 1, lastPost: 0, posts: 0 },
  };
}

// ---------------------------------------------------------------- g.* methods
const methods = {
  // --- calendar
  get weekday() { return weekdayOf(this.state.day); },
  get week() { return weekOf(this.state.day); },
  dayLabel(day = this.state.day) { return `${day}日目（${weekdayName(day)}）`; },

  // --- needs
  need(k) { return this.state.life[k]; },
  // Change a need; returns the actual change. Shows a toast unless silent.
  addNeed(k, n, silent = true) {
    const L = this.state.life;
    if (!(k in NEEDS)) { console.error('addNeed: unknown need', k); return 0; }
    const before = L[k];
    if (k === 'stress' && n > 0) n *= personalityMult(this.state, 'stress'); // personality (profile.js)
    L[k] = clamp(Math.round(before + n), 0, 100);
    const d = L[k] - before;
    if (!silent && d) this.notify(`${NEEDS[k].name} ${d > 0 ? '+' : ''}${d}`, { color: '#fff' });
    if (d) this.needWarn(k, before, L[k]);
    return d;
  },
  // A need crossed a penalty line: a toast (once a day per line) and, the very first
  // time, a short explanation shown when the current script ends (g.pendingTips).
  needWarn(k, a, b) {
    let key = null;
    if (k === 'hunger' && b < HUNGRY && a >= HUNGRY) key = 'hunger';
    else if (k === 'stress' && b >= BURNOUT && a < BURNOUT) key = 'burnout';
    else if (k === 'stress' && b >= STRESSED && a < STRESSED) key = 'stress';
    else if (k === 'clean' && b < SCRUFFY && a >= SCRUFFY) key = 'clean';
    if (!key || !NEED_WARN[key]) return;
    const L = this.state.life;
    const w = L.warned && typeof L.warned === 'object' ? L.warned : (L.warned = {});
    if (w[key] === this.state.day) return;
    w[key] = this.state.day;
    this.notify(NEED_WARN[key].toast, { color: COLORS.bad, life: 200 });
    if (!w['tip_' + key]) {
      w['tip_' + key] = true;
      (this.pendingTips || (this.pendingTips = [])).push(NEED_WARN[key].tip);
    }
  },
  // Apply an activity's need changes: kind = 'job' | 'lesson' | ... or { hunger, stress, clean }.
  // Anything that adds stress counts as work for the day (no rest-day bonus next morning).
  lifeTick(kind) {
    const d = typeof kind === 'string' ? ACTIVITY[kind] : kind;
    if (!d) return;
    if ((d.stress || 0) > 0) this.state.life.workDay = this.state.day;
    for (const k of Object.keys(NEEDS)) if (d[k]) this.addNeed(k, d[k]);
  },
  // Overall condition, used for minigame bonus and status text.
  // 'great' | 'normal' | 'hungry' | 'stressed' | 'scruffy' | 'burnout'
  condition() {
    const L = this.state.life;
    if (L.stress >= BURNOUT) return 'burnout';
    if (L.hunger < HUNGRY) return 'hungry';
    if (L.stress >= STRESSED) return 'stressed';
    if (L.clean < SCRUFFY) return 'scruffy';
    if (L.hunger >= 50 && L.stress <= 30 && L.clean >= 70) return 'great';
    return 'normal';
  },
  // Added to the skill bonus of every minigame (can be negative).
  lifeBonus(skill) { return this.lifeBonusParts(skill).reduce((a, p) => a + p.v, 0); },
  // The same, item by item, for the minigame's intro card: [{ label, v }].
  lifeBonusParts(skill) {
    const L = this.state.life;
    const out = [];
    if (L.hunger < HUNGRY) out.push({ label: 'はらぺこ', v: -0.2 });
    if (L.stress >= STRESSED) out.push({ label: 'ストレス', v: -0.15 });
    if (L.hunger >= 50 && L.stress <= 30 && L.clean >= 70) out.push({ label: '絶好調', v: 0.1 });
    if (skill === 'warai' && this.state.partner) out.push({ label: '相方', v: 0.1 });
    return out;
  },
  // Reason a demanding activity is refused, or null.
  lifeRefusal() {
    const st = this.state;
    if (st.life.stress >= BURNOUT) {
      return ['もう心も体もヘトヘトだ…。\n今日はお仕事どころじゃない。',
        '（ストレスが限界！気分転換しよう。\n商店街の公園でジョギング（無料）、家でテレビ、\nカフェやカラオケ、友だちと遊ぶ。今日は休むのもいい）'];
    }
    // starving: no strength left (unless there is no way to buy food: then work is the way out)
    if (st.life.hunger <= 0 && this.canFeed()) return 'おなかがすきすぎて、力が出ない…。\n（なにか食べてからにしよう）';
    return null;
  },
  // There is a way to eat: money for the cheapest food (¥100) or food in the bag.
  canFeed() {
    const st = this.state;
    return st.money >= 100 || Object.keys(st.items || {}).some((k) => st.items[k] > 0 && ITEM_HEALS(k));
  },

  // Food: heals stamina and fills the stomach. Returns the stamina gained; sets
  // g.ateLast (false when too full to eat). opts: { fill (hunger, default 1.5x), silent }
  canEat() { return this.state.life.hunger < FULL; },
  mealsLeft() { return this.canEat() ? Math.max(1, Math.ceil((FULL - this.state.life.hunger) / 25)) : 0; },
  // The heal scales with the hunger actually absorbed: on a nearly full stomach most of
  // it is wasted (g.lastEatRatio, 0..1, tells how much counted, e.g. for a dish's stress
  // relief). Every food fills at least 3/4 of its heal, so eating can never pay for more
  // work than the hunger that work costs.
  eat(n, opts = {}) {
    const st = this.state;
    this.ateLast = false;
    this.lastEatRatio = 0;
    if (!this.canEat()) {
      if (!opts.silent) this.notify('おなかいっぱいだ…。いまは食べられない。', { color: '#fff' });
      return 0;
    }
    const before = st.stamina;
    const heal = Math.max(0, n || 0);
    let fill = Math.max(0, opts.fill ?? Math.max(8, Math.round(heal * 1.5)));
    if (heal > 0) fill = Math.max(fill, Math.ceil(heal * 0.75));
    const k = fill > 0 ? clamp((100 - st.life.hunger) / fill, 0, 1) : 1;
    this.heal(Math.round(heal * k));
    this.addNeed('hunger', fill);
    this.ateLast = true;
    this.lastEatRatio = k;
    return st.stamina - before;
  },
  // Washing up: shower, bath, salon. Returns the change.
  bathe(n = 100, silent = false) { return this.addNeed('clean', n, silent); },
  // Unwinding: hobbies, TV, a walk. def: { stress, stamina, clean, hunger, silent }
  relax(def = {}) {
    if (def.stress) this.addNeed('stress', -def.stress, def.silent !== false ? true : false);
    if (def.hunger) this.addNeed('hunger', def.hunger);
    if (def.clean) this.addNeed('clean', def.clean);
    if (def.stamina) this.heal(def.stamina);
  },
  // Called by the map every step.
  onWalkStep() {
    const L = this.state && this.state.life;
    if (!L) return;
    L.steps = (L.steps || 0) + 1;
    if (L.steps >= WALK_STEPS) { L.steps = 0; this.lifeTick('walk'); }
  },

  // --- housing & furniture
  housing() { return HOUSING[this.state.housing] || HOUSING.dotsou; },
  furnitureOwned(id) { return !!this.state.furniture[id]; },
  // Summed perks of owned furniture.
  furnitureEffects() {
    const sum = { sleepStress: 0, stamina: 0, clean: 0, stress: 0 };
    for (const id of Object.keys(this.state.furniture)) {
      const f = FURNITURE[id];
      if (!f) continue;
      for (const k of Object.keys(sum)) sum[k] += f[k] || 0;
    }
    return sum;
  },
  rentDue() { return this.housing().rent + (this.state.rent.debt || 0); },
  // Pays this week's rent (+ any debt), as much as the money allows; the rest stays as
  // debt. Returns true when everything is paid. The result is also a morning note.
  chargeRent() {
    const st = this.state;
    const h = this.housing();
    const due = h.rent + (st.rent.debt || 0);
    st.rent.paidWeek = this.week;
    if (due <= 0) return true;
    const paid = Math.min(Math.max(0, st.money), due);
    st.money -= paid;
    const left = due - paid;
    const notes = this.morningNotes || (this.morningNotes = []);
    if (!left) {
      st.rent.debt = 0;
      st.rent.late = 0;
      this.message({ from: h.name, text: `今週の家賃 ${fmtMoney(due)} をお支払いいただきました。いつもありがとうございます。`, kind: 'bill', receipt: true });
      notes.push(`（家賃 ${fmtMoney(due)} を払った。のこり ${fmtMoney(st.money)}）`);
      return true;
    }
    st.rent.debt = left;
    st.rent.late = (st.rent.late || 0) + 1;
    this.addNeed('stress', 10);
    this.message({ from: h.name, text: `${paid ? `家賃の一部 ${fmtMoney(paid)} をお支払いいただきました。` : '今週の家賃が払えていません。'}（未払い ${fmtMoney(left)}）\nお金ができたら、スマホの「家計」から払ってください。`, kind: 'bill' });
    notes.push(`（家賃が${paid ? `全部は` : ''}払えなかった…。未払い ${fmtMoney(left)}\nお金ができたら、スマホの「家計」から払おう）`);
    return false;
  },
  // Pays outstanding rent now (phone / landlord). Returns true when cleared. With
  // partial: true it pays what the money allows (g.lastDebtPaid = the amount paid).
  payDebt(partial = false) {
    const st = this.state;
    const d = st.rent.debt || 0;
    this.lastDebtPaid = 0;
    if (!d) return true;
    const pay = Math.min(Math.max(0, st.money), d);
    if (pay < d && (!partial || pay <= 0)) return false;
    st.money -= pay;
    st.rent.debt = d - pay;
    this.lastDebtPaid = pay;
    audio.sfx('coin');
    if (st.rent.debt > 0) return false;
    st.rent.late = 0;
    return true;
  },
  // Move to another housing (no checks; the real estate agent asks first).
  // Owned furniture moves along (its perks apply wherever you live).
  moveHousing(id) {
    if (!HOUSING[id]) { console.error('moveHousing: unknown housing', id); return false; }
    this.state.housing = id;
    return true;
  },

  // --- people
  person(id) { return this.state.people[id] || null; },
  met(id) { return !!this.state.people[id]; },
  meet(id, silent = true) {
    if (!PEOPLE[id]) { console.error('meet: unknown person', id); return null; }
    let p = this.state.people[id];
    if (!p) {
      p = this.state.people[id] = { aff: 0, met: this.state.day, talkDay: 0, giftDay: 0, hangDay: 0, seen: {} };
      if (!silent) this.notify(`${PEOPLE[id].name}と知り合った`, { color: COLORS.pink });
    }
    return p;
  },
  aff(id) { return (this.state.people[id] && this.state.people[id].aff) || 0; },
  heartLevel(id) { return heartIndex(this.aff(id)); },
  // Change affinity (meets them if needed). Positive gains are halved when scruffy.
  addAff(id, n, silent = false) {
    const p = this.meet(id);
    if (!p) return 0;
    // personality (profile.js aff): the fraction is carried over (a gain is never below +1),
    // so small gains (+2) still add up to ×1.2 / ×0.85 over time
    const am = personalityMult(this.state, 'aff');
    if (n > 0 && am !== 1) { const x = n * am + (Number(p.affCarry) || 0); n = Math.max(1, Math.floor(x)); p.affCarry = Math.round((x - n) * 100) / 100; }
    if (n > 0 && this.state.life.clean < SCRUFFY) n = Math.ceil(n / 2);
    const before = p.aff;
    const lv = heartIndex(before);
    p.aff = clamp(Math.round(before + n), 0, 100);
    const d = p.aff - before;
    const lv2 = heartIndex(p.aff);
    if (!silent && d) this.notify(`${PEOPLE[id].name} ${d > 0 ? '♥+' + d : '♥' + d}`, { color: COLORS.pink });
    if (lv2 > lv) {
      if (!silent) this.notify(`${PEOPLE[id].name}と「${HEARTS[lv2][1]}」になった！`, { color: COLORS.pink });
      if (lv2 >= 1 && !p.contact) {
        p.contact = true;
        this.message({ from: PEOPLE[id].name, person: id, text: `${PEOPLE[id].name}です！連絡先、登録しといてね。`, kind: 'chat' });
      }
    }
    return d;
  },
  // The next heart event due for a person (or null).
  pendingHeartEvent(id) {
    const def = PEOPLE[id], p = this.person(id);
    if (!def || !p) return null;
    const lv = heartIndex(p.aff);
    if (!p.seen) p.seen = {}; // records from older builds
    return def.events.find((ev) => ev.level <= lv && !p.seen[ev.level]) || null;
  },
  // Talk to an NPC linked to a person (entity.person). The map calls this for such
  // NPCs: heart event first, else the NPC's normal talk + a daily affinity bonus,
  // and from the second talk the menu 話す / プレゼント / さそう (♥2) / またね (phone.js). Content adds
  // menu entries and hooks through PEOPLE_UI.extras / PEOPLE_UI.hooks (see below).
  async talkPerson(npc) {
    return PEOPLE_UI.talk(this, npc);
  },
  // A gift: def.loves +6, likes +4, dislikes -3, else +2; the same item again within
  // GIFT_REPEAT_DAYS days only +1. Once a day. Returns the change.
  giveGift(id, itemId) {
    const def = PEOPLE[id];
    const p = this.meet(id);
    if (!def || !p) return 0;
    const repeat = this.giftRepeat(id, itemId);
    if (!this.takeItem(itemId)) return 0;
    p.giftDay = this.state.day;
    p.known = { ...(p.known || {}), [itemId]: this.giftReaction(id, itemId) }; // the phone's contact card lists what they like
    p.gifted = { ...(p.gifted && typeof p.gifted === 'object' ? p.gifted : {}), [itemId]: this.state.day };
    let n = def.loves.includes(itemId) ? 6 : def.likes.includes(itemId) ? 4 : def.dislikes.includes(itemId) ? -3 : 2;
    if (repeat && n > 1) n = 1;
    return this.addAff(id, n);
  },
  // True when this person got the same item in the last GIFT_REPEAT_DAYS days.
  giftRepeat(id, itemId) {
    const p = this.person(id);
    const d = p && p.gifted && p.gifted[itemId];
    return typeof d === 'number' && this.state.day - d < GIFT_REPEAT_DAYS;
  },
  giftReaction(id, itemId) {
    const def = PEOPLE[id];
    if (!def) return 'neutral';
    return def.loves.includes(itemId) ? 'love' : def.likes.includes(itemId) ? 'like' : def.dislikes.includes(itemId) ? 'dislike' : 'neutral';
  },
  // Spend time together at a hangout spot. Returns false if not possible.
  async hangout(id, spotId) {
    return PEOPLE_UI.hangout(this, id, spotId);
  },
  // Friends (family members are not counted: they have their own messages and endings).
  friends(minLevel = 2) {
    return Object.keys(this.state.people).filter((id) => PEOPLE[id] && PEOPLE[id].kind !== 'family' && this.heartLevel(id) >= minLevel);
  },
  // Make someone your 相方 (comedy partner; null = none). Shows a toast and sends a
  // phone message unless opts.silent; opts.text overrides the message.
  setPartner(id, opts = {}) {
    const st = this.state;
    if (id && !PEOPLE[id]) { console.error('setPartner: unknown person', id); return false; }
    const prev = st.partner;
    if (prev && st.people[prev]) st.people[prev].partner = false;
    st.partner = id || null;
    if (!id) return true;
    const p = this.meet(id);
    p.partner = true;
    p.contact = true;
    if (!opts.silent) {
      const def = PEOPLE[id];
      const k = isKansai(def);
      const text = opts.text || def.partnerText || (k ? '今日から正式に相方やな。\nふたりで、てっぺん目指そな！' : '今日から正式に相方だね。\nふたりで、てっぺん目指そう！');
      this.notify(`${def.name}と相方になった！`, { color: COLORS.accent });
      this.message({ from: def.name, person: id, text, kind: 'chat' });
    }
    return true;
  },
  // Mark someone as your 大切な人 (one at a time unless opts.exclusive === false;
  // null clears it). opts: { silent, text (a phone message from them) }.
  setSpecial(id, opts = {}) {
    const st = this.state;
    if (id && !PEOPLE[id]) { console.error('setSpecial: unknown person', id); return false; }
    if (!id || opts.exclusive !== false) {
      for (const k of Object.keys(st.people)) if (k !== id && st.people[k].special) st.people[k].special = false;
    }
    if (!id) return true;
    const p = this.meet(id);
    p.special = true;
    p.contact = true;
    if (!opts.silent) {
      this.notify(`${PEOPLE[id].name}が「大切な人」になった`, { color: COLORS.pink });
      if (opts.text) this.message({ from: PEOPLE[id].name, person: id, text: opts.text, kind: 'chat' });
    }
    return true;
  },
  isPartner(id) { return !!id && this.state.partner === id; },
  isSpecial(id) { return !!(this.state.people[id] && this.state.people[id].special); },

  // --- fans
  addFans(n, silent = false) {
    const before = this.state.fans;
    this.state.fans = Math.max(0, Math.round(before + n));
    const d = this.state.fans - before;
    if (!silent && d) this.notify(`ファン ${d > 0 ? '+' : ''}${d.toLocaleString('ja-JP')}人`, { color: COLORS.pink });
    return d;
  },

  // --- regular shows
  regular(id) { return this.state.regulars[id] || null; },
  // Joined on the show's own weekday, it can be recorded today, but staying away that
  // day does not count as a miss (see morning()).
  joinRegular(id) {
    if (!REGULARS[id]) return;
    this.state.regulars[id] = { since: this.state.day, doneWeek: this.week - (weekdayOf(this.state.day) > REGULARS[id].weekday ? 0 : 1), missed: 0, count: 0 };
  },
  // Regulars recorded today that are not done yet (optionally at one place).
  regularsToday(placeId) {
    return Object.keys(this.state.regulars).filter((id) => {
      const r = REGULARS[id], s = this.state.regulars[id];
      return r && s && !s.dropped && r.weekday === this.weekday && (s.doneWeek || 0) < this.week && (!placeId || r.place === placeId);
    });
  },
  // Record a regular show (like a job, no confirm). Returns the minigame result or null.
  async doRegular(id) {
    const r = REGULARS[id], s = this.state.regulars[id];
    if (!r || !s) return null;
    const why = this.lifeRefusal();
    if (why) { await this.say(why); return null; }
    if (this.state.stamina < r.stamina) { await this.say(`体力が足りない…。\nこのままでは${showWords(r).act}に出られない。何か食べて回復しよう。`); return null; }
    const res = await this.job({
      id: 'regular_' + id, title: r.title, minigame: r.minigame, opts: r.opts, skill: r.skill,
      pay: r.pay, fame: r.fame, fans: r.fans, stamina: r.stamina, confirm: false,
    });
    if (res) { s.doneWeek = this.week; s.count = (s.count || 0) + 1; s.missed = 0; }
    return res;
  },

  // --- phone messages
  // msg: { from, text, kind: 'chat'|'invite'|'offer'|'bill'|'fan'|'news', person, spot, regular, choices }
  message(msg) {
    const ph = this.state.phone;
    const m = { id: ph.nextId++, day: this.state.day, read: false, ...msg };
    // the phone is called what the era calls it (手帳 / ケータイ) in the message text too
    try {
      if (typeof m.text === 'string') m.text = deviceText(m.text, ERAS[(this.state.profile && this.state.profile.era) || 'reiwa']); // [R13-F] profile.js deviceText
    } catch (e) { /* keep the text */ }
    // [R13-F] S1-005 / S1-007: the same words again (a weekly flyer, a loan collector, 仕送り) refresh the message that is already there
    // ("n回目") instead of piling up; and a morning delivers at most MORNING_MSG_CAP messages: the rest of the chatter / news is merged
    // into one 「朝のまとめ」. Bills, legal notices, offers, invitations and messages with choices are never merged or collapsed.
    const day0 = this.state.day;
    const prot = !!((m.kind === 'bill' && !m.receipt) || m.legal || m.kind === 'offer' || m.kind === 'invite' || m.choices || m.protect);
    if (!prot && typeof m.text === 'string') {
      const key = msgKey(m);
      const old = ph.inbox.find((x) => x && x !== m && x.kind === m.kind && x.dupKey === key && day0 - (Number(x.day) || 0) <= MSG_DUP_DAYS);
      if (old) {
        old.dups = (old.dups || 1) + 1;
        old.text = `${m.text}\n（${old.dups}回目）`;
        old.day = day0; old.read = false;
        ph.inbox.splice(ph.inbox.indexOf(old), 1); ph.inbox.unshift(old);
        return old;
      }
      m.dupKey = key;
    }
    const mm = this._mm;
    // [R15] the whole day is capped too (not only the morning window): automated chatter of one day is at most MORNING_MSG_CAP messages in the inbox.
    // The rest of that day's chatter goes into one 「ほかの連絡」 (a digest, which counts as one of them). Bills, legal notices, offers and messages with choices are never held.
    if (!prot && !(mm && mm.open && mm.day === day0) && typeof m.text === 'string') {
      const today = ph.inbox.filter((x) => x && Number(x.day) === day0);
      const dg = today.find((x) => x.digestOf === 'day');
      const line = `・${m.from || '？'}｜${String(m.text).split('\n')[0].replace(/\s+/g, ' ').slice(0, 26)}`;
      if (dg) {
        dg.lines.push(line);
        dg.text = `【ほかの連絡】${dg.lines.length}件\n${dg.lines.slice(0, 9).join('\n')}${dg.lines.length > 9 ? `\nほか${dg.lines.length - 9}件` : ''}`;
        dg.read = false;
        return dg;
      }
      if (today.length >= MORNING_MSG_CAP - 1) {
        const d = { id: ph.nextId++, day: day0, read: false, from: 'ほかの連絡', kind: 'news', digestOf: 'day', protect: true, lines: [line], text: `【ほかの連絡】1件\n${line}` };
        ph.inbox.unshift(d);
        return d;
      }
    }
    if (mm && mm.open && mm.day === day0) {
      const room = MORNING_MSG_CAP - 1; // one slot is kept for the digest
      if (prot) {
        // a bill / legal notice / offer always comes; when the morning is full, the newest chatter of this morning goes into the digest to make room
        if (mm.n >= room && mm.chat.length) { const back = mm.chat.pop(); const i = ph.inbox.indexOf(back.m); if (i >= 0) ph.inbox.splice(i, 1); mm.held.unshift(back.msg); mm.n--; }
        mm.n++;
      } else if (mm.n >= room) { mm.held.push(msg); return m; } // held for the digest (m is returned for callers that touch it; it is not in the inbox)
      else { mm.n++; mm.chat.push({ m, msg }); }
    }
    ph.inbox.unshift(m);
    // full inbox: drop the oldest read message first, then the oldest one that is not
    // protected. Protected (they never vanish unseen): an offer you can still answer, an
    // unread bill younger than BILL_KEEP_DAYS (rent arrears, loan notices, unpaid fines — a
    // debtor gets a loan statement every 10 days per lender, so "the newest bill" is not
    // enough), and an unread legal notice of any age (msg.legal, or one from a court:
    // 支払督促, bail forfeiture). A paid receipt (msg.receipt) is never protected.
    // If everything left is protected, the oldest unread bill that is not a legal notice
    // goes next, and a legal notice only as the very last resort.
    const day = this.state.day;
    const legal = (x) => !!(x && x.kind === 'bill' && !x.read && !x.receipt && (x.legal || /裁判所/.test(String(x.from || ''))));
    const keep = (x) => x === m || this.offerOpen(x) || legal(x)
      || (x && x.kind === 'bill' && !x.read && !x.receipt && day - (Number(x.day) || 0) < BILL_KEEP_DAYS);
    const tiers = [(x) => x.read && !keep(x), (x) => !keep(x), (x) => x !== m && !this.offerOpen(x) && !legal(x), (x) => x !== m];
    while (ph.inbox.length > INBOX_MAX) {
      let i = -1;
      for (const ok of tiers) {
        for (let k = ph.inbox.length - 1; k >= 0 && i < 0; k--) if (ph.inbox[k] && ok(ph.inbox[k])) i = k;
        if (i >= 0) break;
      }
      ph.inbox.splice(i < 0 ? ph.inbox.length - 1 : i, 1);
    }
    return m;
  },
  // An offer that can still be accepted (not answered, younger than OFFER_DAYS days).
  offerOpen(m) {
    return !!(m && m.kind === 'offer' && !m.answered && this.state.day - (Number(m.day) || 0) < OFFER_DAYS);
  },
  unread() { return this.state.phone.inbox.filter((m) => !m.read).length; },

  // --- the morning after g.sleep()
  // hungerAtNight: hunger when going to bed (low = poor sleep).
  // opts.away: slept away from home (hotel, a back room): no home perks (shower,
  // furniture, the home's sleep quality); opts.shower / opts.sleepStress override.
  // Notes worth a line in the morning message (rent, a poor night, a day off) are
  // collected in g.morningNotes (g.sleep shows them); g.lastMorning has the changes.
  async morning(hungerAtNight, opts = {}) {
    const st = this.state;
    const L = st.life;
    const h = this.housing();
    const away = !!opts.away;
    const fx = away ? { sleepStress: 0, stamina: 0, clean: 0, stress: 0 } : this.furnitureEffects();
    this._mm = { day: st.day, open: true, n: 0, held: [], chat: [] }; // [R13-F] the morning's message window (closed after the hooks, below)
    const notes = this.morningNotes = [];
    const before = { hunger: L.hunger, stress: L.stress, clean: L.clean };
    this.lifeTick('night');
    const shower = away ? (opts.shower ?? AWAY_SHOWER[opts.place] ?? 0) : (h.bath ? MORNING_SHOWER : 0);
    if (shower) this.addNeed('clean', shower); // morning shower
    this.addNeed('stress', -((away ? (opts.sleepStress ?? AWAY_SLEEP_STRESS) : h.sleepStress) + fx.sleepStress + fx.stress));
    if (fx.clean) this.addNeed('clean', fx.clean);
    // a day without work (no job, lesson or audition yesterday) clears the head
    const rested = (L.workDay || 0) < st.day - 1 && L.stress > 0;
    if (rested) {
      const d = -this.addNeed('stress', -REST_DAY_STRESS);
      if (d >= 5) notes.push(`（きのうはゆっくり休めた。気持ちが軽い！ストレス -${d}）`);
    }
    if (hungerAtNight < HUNGRY) {
      st.stamina = Math.round(st.maxStamina * 0.75);
      this.addNeed('stress', 5);
      notes.push('（おなかがすいて、よく眠れなかった…。\n体力が回復しきっていない。ストレス +5）');
    }
    if (st.rent.debt && this.weekday !== 0) this.addNeed('stress', Math.min(9, 3 * Math.max(1, st.rent.late || 1)));
    // rent every Monday
    if (this.weekday === 0 && st.rent.paidWeek < this.week) this.chargeRent();
    this.lastMorning = { hunger: L.hunger - before.hunger, stress: L.stress - before.stress, clean: L.clean - before.clean, shower, rested, away };
    // regular shows missed yesterday
    const yesterday = weekdayOf(st.day - 1);
    const yWeek = weekOf(st.day - 1);
    for (const id of Object.keys(st.regulars)) {
      const r = REGULARS[id], s = st.regulars[id];
      if (!r || !s || s.dropped || r.weekday !== yesterday || (s.doneWeek || 0) >= yWeek) continue;
      s.doneWeek = yWeek;
      if (s.since === st.day - 1) continue; // accepted on the show day itself: no miss, it starts next week
      s.missed = (s.missed || 0) + 1;
      this.addNeed('stress', 8);
      this.addFame(-Math.round(r.fame / 2), true);
      if (s.missed >= 2) {
        s.dropped = true;
        this.message({ from: r.host || 'プロデューサー', text: `『${r.title}』の${showWords(r).act}を続けて休んでしまったので、レギュラーは降板ということになりました…。`, kind: 'news' });
      } else {
        this.message({ from: r.host || 'プロデューサー', text: `昨日は『${r.title}』の${showWords(r).day}でしたよ！次は必ず来てくださいね。`, kind: 'news' });
      }
    }
    // offers left unanswered too long expire (the phone shows them as 期限切れ)
    for (const m of st.phone.inbox) if (m && m.kind === 'offer' && !m.answered && st.day - (Number(m.day) || 0) >= OFFER_DAYS) m.answered = 'expired';
    try {
      for (const fn of MORNING_HOOKS) {
        try { await fn(this); } catch (e) { console.error(e); }
      }
    } finally {
      this.flushMorningMessages(); // [R13-F]
    }
  },
  // [R13-F] S1-005: close the morning's message window; what the cap held back becomes one 「朝のまとめ」 (a single one is simply delivered)
  flushMorningMessages() {
    const mm = this._mm;
    this._mm = null;
    if (!mm || !mm.held.length) return;
    if (mm.held.length === 1) { this.message(mm.held[0]); return; }
    const first = (x) => String(x.text || '').split('\n')[0].replace(/\s+/g, ' ').slice(0, 26);
    const lines = mm.held.slice(0, 9).map((x) => `・${x.from || '？'}｜${first(x)}`);
    if (mm.held.length > 9) lines.push(`・ほか${mm.held.length - 9}件`);
    this.message({ from: '朝のまとめ', kind: 'news', digest: true, text: `【今朝のまとめ】ほかに届いた連絡 ${mm.held.length}件\n${lines.join('\n')}` });
  },
};

// Extra morning hooks (content: friend messages, offers, fan mail). fn(g), may be async.
export const MORNING_HOOKS = [];
export function onMorning(fn) { MORNING_HOOKS.push(fn); }

// People interaction UI. phone.js installs the rich versions on load (talk menu
// 話す / プレゼント / さそう / またね, the HD hangout vignette); these plain ones are
// the fallbacks. Content should NOT replace talk / hangout: extend the menu with
// `extras` and `hooks` instead (both are read by phone.js's talk menu):
//
//   PEOPLE_UI.extras.push({          an extra entry of the talk menu, before またね
//     id: 'combi',                   optional, unique (default: the label)
//     label: 'コンビを組もう',        ≤ 14 chars, or (g, id, npc) => label
//     cond: (g, id, npc) => bool,    optional: shown only when true
//     run: async (g, id, npc) => …,  return 'end' to close the menu afterwards
//     repeat: false,                 true: stays in the menu after it was used
//     order: 50 })                   optional sort key among the extras
//   PEOPLE_UI.hooks.start.push((g, id, npc) => {})        sync, first thing on every talk
//   PEOPLE_UI.hooks.before.push(async (g, id, npc) => bool)
//                                    after heart events (they come first): return true to
//                                    take over this talk (no menu), e.g. a proposal asked again
//   PEOPLE_UI.hooks.greet.push((g, id, npc) => string | null)
//                                    the line that opens the menu; the first non-empty one
//                                    wins, then def.greet, then a generic greeting
//   PEOPLE_UI.hooks.after.push(async (g, id, npc) => {})  after every talk (event, takeover, menu)
// (id = the person id, npc = the map entity; PEOPLE[id] is the definition.) A hook or
// entry that throws is logged and skipped.
export const PEOPLE_UI = {
  extras: [],
  hooks: { start: [], before: [], greet: [], after: [] },
  async talk(g, npc) {
    const id = npc.person;
    const def = PEOPLE[id];
    if (!def) { await (npc.talk ? npc.talk(g, npc) : g.say(npc.text, { name: npc.name, look: npc.look })); return; }
    g.meet(id);
    const ev = g.pendingHeartEvent(id);
    if (ev) {
      g.person(id).seen[ev.level] = true;
      await ev.run(g, def, npc);
      return;
    }
    if (npc.talk) await npc.talk(g, npc);
    else await g.say(npc.text, { name: npc.name, look: npc.look });
    const p = g.person(id);
    if (p.talkDay !== g.state.day) {
      p.talkDay = g.state.day;
      g.addAff(id, 2, true);
      if (npc.id) g.emote(npc.id, '♥', 40);
    }
  },
  async hangout(g, id, spotId) {
    const def = PEOPLE[id], spot = HANGOUTS[spotId];
    if (!def || !spot) return false;
    const p = g.meet(id);
    if (g.state.money < spot.price) { await g.say(`お金が足りない…。（${spot.name}：${fmtMoney(spot.price)}）`); return false; }
    if (g.state.stamina < spot.stamina) { await g.say('体力が足りない…。今日はやめておこう。'); return false; }
    g.state.money -= spot.price;
    g.state.stamina -= spot.stamina;
    p.hangDay = g.state.day;
    await g.fadeOut(12);
    await g.wait(300);
    await g.fadeIn(12);
    const lines = def.hangout[spotId] || spot.lines;
    await g.say(lines.map((l) => g.fmt(l)), { name: def.name, look: def.look });
    g.relax({ stress: spot.stress });
    hangoutMeal(g, spot);
    g.addAff(id, spot.aff);
    return true;
  },
};

// A hangout's meal (spot.fill): eaten like any food (nothing when you are already full),
// healing spot.heal or fill / 3 stamina. A spot without fill may still heal.
export function hangoutMeal(g, spot) {
  if (spot.fill) { if (g.canEat()) g.eat(spot.heal ?? Math.round(spot.fill / 3), { fill: spot.fill, silent: true }); } else if (spot.heal) g.heal(spot.heal);
}

export function installLife(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) {
    Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
  }
}
