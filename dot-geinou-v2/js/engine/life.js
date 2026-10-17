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

// What each activity costs. Content may call g.lifeTick(kind) or g.lifeTick({ hunger, stress, clean }).
export const ACTIVITY = {
  job: { hunger: -10, stress: 8, clean: -8 },
  lesson: { hunger: -8, stress: 5, clean: -6 },
  audition: { hunger: -8, stress: 10, clean: -6 },
  walk: { hunger: -1, clean: -1 }, // every WALK_STEPS steps
  night: { hunger: -30, clean: -15 },
};
export const WALK_STEPS = 150;

// ---------------------------------------------------------------- registries
export const HOUSING = {};
// def: { name, place, room?, rent (per week), sleepStress (stress removed per night),
//   kitchen: bool, bath: bool (morning shower: 身だしなみ +50), requires: { fame }, moveCost, desc,
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
//                               greeting that opens the menu (♥1+)
//   talkLabel: '買い物する'      label of 話す (e.g. shop NPCs)
//   chats: ['…' | (g) => '…']   one personal line on the first talk of a day (♥1+)
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
export function registerHangout(id, def) {
  HANGOUTS[id] = { id, price: 1000, stress: 15, aff: 5, stamina: 5, ...def };
}
registerHangout('ramen', { name: 'ラーメン屋', price: 900, stress: 12, aff: 5, fill: 45, lines: ['ズルズル…。仕事の話、くだらない話。', 'スープまで飲み干した。'] });
registerHangout('park', { name: '公園で散歩', price: 0, stress: 10, aff: 4, lines: ['ベンチに座って、とりとめのない話をした。', '気持ちのいい風がふいている。'] });

export const REGULARS = {};
// def: { title, place, weekday (0=月), medium: 'tv'|'radio'|'stage'|'event' (door prompt wording),
//   requires (g.checkRequires format), pay, fame, fans,
//   skill, minigame, opts, stamina (default 15), host, hostLook, desc, offer (offer message) }
export function registerRegular(id, def) {
  REGULARS[id] = { id, stamina: 15, pay: 10000, fame: 15, fans: 60, ...def };
}

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
    L[k] = clamp(Math.round(before + n), 0, 100);
    const d = L[k] - before;
    if (!silent && d) this.notify(`${NEEDS[k].name} ${d > 0 ? '+' : ''}${d}`, { color: '#fff' });
    return d;
  },
  // Apply an activity's need changes: kind = 'job' | 'lesson' | ... or { hunger, stress, clean }.
  lifeTick(kind) {
    const d = typeof kind === 'string' ? ACTIVITY[kind] : kind;
    if (!d) return;
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
  lifeBonus(skill) {
    const L = this.state.life;
    let b = 0;
    if (L.hunger < HUNGRY) b -= 0.2;
    if (L.stress >= STRESSED) b -= 0.15;
    if (L.hunger >= 50 && L.stress <= 30 && L.clean >= 70) b += 0.1;
    if (skill === 'warai' && this.state.partner) b += 0.1;
    return b;
  },
  // Reason a demanding activity is refused, or null.
  lifeRefusal() {
    if (this.state.life.stress >= BURNOUT) return 'もう心も体もヘトヘトだ…。\n今日はお仕事どころじゃない。\n（ストレスが限界。趣味や友だちと遊んで気分転換しよう）';
    return null;
  },

  // Food: heals stamina and fills the stomach. Returns the stamina gained; sets
  // g.ateLast (false when too full to eat). opts: { fill (hunger, default 1.5x), silent }
  canEat() { return this.state.life.hunger < FULL; },
  mealsLeft() { return this.canEat() ? Math.max(1, Math.ceil((FULL - this.state.life.hunger) / 25)) : 0; },
  eat(n, opts = {}) {
    const st = this.state;
    this.ateLast = false;
    if (!this.canEat()) {
      if (!opts.silent) this.notify('おなかいっぱいだ…。いまは食べられない。', { color: '#fff' });
      return 0;
    }
    const before = st.stamina;
    this.heal(n);
    this.addNeed('hunger', opts.fill ?? Math.max(8, Math.round(n * 1.5)));
    this.ateLast = true;
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
  // Pays this week's rent (+ any debt). Returns true when paid.
  chargeRent() {
    const st = this.state;
    const h = this.housing();
    const due = h.rent + (st.rent.debt || 0);
    st.rent.paidWeek = this.week;
    if (due <= 0) return true;
    if (st.money >= due) {
      st.money -= due;
      st.rent.debt = 0;
      st.rent.late = 0;
      this.message({ from: h.name, text: `今週の家賃 ${fmtMoney(due)} をお支払いいただきました。いつもありがとうございます。`, kind: 'bill' });
      this.notify(`家賃 -${fmtMoney(due)}`, { color: COLORS.accent });
      return true;
    }
    st.rent.debt = due;
    st.rent.late = (st.rent.late || 0) + 1;
    this.addNeed('stress', 10);
    this.message({ from: h.name, text: `今週の家賃が払えていません。（未払い ${fmtMoney(due)}）\nお金ができたら、スマホの「家計」から払ってください。`, kind: 'bill' });
    this.notify('家賃が払えなかった…', { color: COLORS.bad });
    return false;
  },
  // Pays outstanding rent now (phone / landlord). Returns true when cleared.
  payDebt() {
    const st = this.state;
    const d = st.rent.debt || 0;
    if (!d) return true;
    if (st.money < d) return false;
    st.money -= d;
    st.rent.debt = 0;
    st.rent.late = 0;
    audio.sfx('coin');
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
  // and from ♥1 the menu 話す / プレゼント / さそう / またね (phone.js). Content adds
  // menu entries and hooks through PEOPLE_UI.extras / PEOPLE_UI.hooks (see below).
  async talkPerson(npc) {
    return PEOPLE_UI.talk(this, npc);
  },
  // A gift: def.loves +8, likes +5, dislikes -3, else +2. Once a day. Returns the change.
  giveGift(id, itemId) {
    const def = PEOPLE[id];
    const p = this.meet(id);
    if (!def || !p) return 0;
    if (!this.takeItem(itemId)) return 0;
    p.giftDay = this.state.day;
    p.known = { ...(p.known || {}), [itemId]: this.giftReaction(id, itemId) }; // the phone's contact card lists what they like
    const n = def.loves.includes(itemId) ? 8 : def.likes.includes(itemId) ? 5 : def.dislikes.includes(itemId) ? -3 : 2;
    return this.addAff(id, n);
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
  friends(minLevel = 2) {
    return Object.keys(this.state.people).filter((id) => PEOPLE[id] && this.heartLevel(id) >= minLevel);
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
  joinRegular(id) {
    if (!REGULARS[id]) return;
    this.state.regulars[id] = { since: this.state.day, doneWeek: this.week - (weekdayOf(this.state.day) > REGULARS[id].weekday ? 0 : 1), missed: 0, count: 0 };
  },
  // Regulars recorded today that are not done yet (optionally at one place).
  regularsToday(placeId) {
    return Object.keys(this.state.regulars).filter((id) => {
      const r = REGULARS[id], s = this.state.regulars[id];
      return r && !s.dropped && r.weekday === this.weekday && s.doneWeek < this.week && (!placeId || r.place === placeId);
    });
  },
  // Record a regular show (like a job, no confirm). Returns the minigame result or null.
  async doRegular(id) {
    const r = REGULARS[id], s = this.state.regulars[id];
    if (!r || !s) return null;
    const why = this.lifeRefusal();
    if (why) { await this.say(why); return null; }
    if (this.state.stamina < r.stamina) { await this.say('体力が足りない…。\nこのままでは収録に出られない。何か食べて回復しよう。'); return null; }
    const res = await this.job({
      id: 'regular_' + id, title: r.title, minigame: r.minigame, opts: r.opts, skill: r.skill,
      pay: r.pay, fame: r.fame, fans: r.fans, stamina: r.stamina, confirm: false,
    });
    if (res) { s.doneWeek = this.week; s.count++; s.missed = 0; }
    return res;
  },

  // --- phone messages
  // msg: { from, text, kind: 'chat'|'invite'|'offer'|'bill'|'fan'|'news', person, spot, regular, choices }
  message(msg) {
    const ph = this.state.phone;
    const m = { id: ph.nextId++, day: this.state.day, read: false, ...msg };
    ph.inbox.unshift(m);
    if (ph.inbox.length > 60) ph.inbox.length = 60;
    return m;
  },
  unread() { return this.state.phone.inbox.filter((m) => !m.read).length; },

  // --- the morning after g.sleep()
  // hungerAtNight: hunger when going to bed (low = poor sleep).
  async morning(hungerAtNight) {
    const st = this.state;
    const L = st.life;
    const h = this.housing();
    const fx = this.furnitureEffects();
    this.lifeTick('night');
    if (h.bath) this.addNeed('clean', 50); // morning shower at home
    this.addNeed('stress', -(h.sleepStress + fx.sleepStress + fx.stress));
    if (fx.clean) this.addNeed('clean', fx.clean);
    if (hungerAtNight < HUNGRY) {
      st.stamina = Math.round(st.maxStamina * 0.75);
      this.notify('おなかがすいて、よく眠れなかった…', { color: '#fff' });
    }
    if (st.rent.debt && this.weekday !== 0) this.addNeed('stress', 3);
    // rent every Monday
    if (this.weekday === 0 && st.rent.paidWeek < this.week) this.chargeRent();
    // regular shows missed yesterday
    const yesterday = weekdayOf(st.day - 1);
    const yWeek = weekOf(st.day - 1);
    for (const id of Object.keys(st.regulars)) {
      const r = REGULARS[id], s = st.regulars[id];
      if (!r || s.dropped || r.weekday !== yesterday || s.doneWeek >= yWeek) continue;
      s.missed++;
      s.doneWeek = yWeek;
      this.addNeed('stress', 8);
      this.addFame(-Math.round(r.fame / 2), true);
      if (s.missed >= 2) {
        s.dropped = true;
        this.message({ from: r.host || 'プロデューサー', text: `『${r.title}』の収録を続けて休んでしまったので、レギュラーは降板ということになりました…。`, kind: 'news' });
      } else {
        this.message({ from: r.host || 'プロデューサー', text: `昨日は『${r.title}』の収録日でしたよ！次は必ず来てくださいね。`, kind: 'news' });
      }
    }
    for (const fn of MORNING_HOOKS) {
      try { await fn(this); } catch (e) { console.error(e); }
    }
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
//   PEOPLE_UI.extras.push({          an extra entry of the talk menu (♥1+), before またね
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
    if (spot.fill) g.addNeed('hunger', spot.fill);
    g.addAff(id, spot.aff);
    return true;
  },
};

export function installLife(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) {
    Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
  }
}
