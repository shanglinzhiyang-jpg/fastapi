// 店の中身 kit [R12-S2] — shared pieces for the shop interiors (js/places/shop_*.js).
//
//   registerShop(def)        registerPlace for a 'building' + { hours } (feature-detected clock) + a crime spot
//   shopGate(placeId)        the town building's `enter` hook: opening hours (g.clock), 「開くまで待つ？」, then the door
//   openState(g, hours) / hoursText(hours) / T(h, m)   hours = { spans: [[from, to], ...] (minutes of the day, 25:00 = T(25)),
//                            closed: [weekday index, 6 = 日曜], note }
//   SS(g)                    the shops' save state g.state.flags.shopS (lazy, repaired): daily counters d, 種 seeds, stage rank st, ツケ …
//   dayN / bumpN             per-day counters (reset by the date)
//   orderMenu(g, {...})      eat / drink on the spot (age gate for alcohol, 飲みすぎ, stress relief that fades)
//   goodsOf / shopItems      g.shop lists that skip items that are not registered
//   addSeed / seedMenu       ネタの種: ideas collected in shops, spent in the 台本エディタ (g.writeNeta({ theme }))
//   showName / lineup        fictional acts for the stages (checked with isRealNameLike)
//   box(...) / tile helpers  the shop tiles (HD) and a tiny room builder
// Everything here is fictional. Prices are internal (2026 yen); fmtMoney shows them in the era's prices.

import { registerPlace, PLACES } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { registerItem, ITEMS } from '../engine/state.js';
import { weekdayOf, WEEKDAYS, onMorning } from '../engine/life.js';
import { fmtMoney, YEN_MARK, display, pick, clamp, makeCanvas, shade, hash2 } from '../engine/util.js';
import { ageOf } from '../engine/profile.js';
import { registerSong } from '../engine/audio.js';
import { defineTile, R, P, disc, oval, outline, shadowEllipse, dither, line } from '../engine/tiles.js';
import { isRealNameLike } from '../engine/contests_gen.js';
import { text as drawText } from '../engine/draw.js';
import { GUIDE, GUIDE_JOBS, jobOpen } from './guide.js';

export { LOOKS, fmtMoney, YEN_MARK, pick, clamp, hash2, PLACES, ITEMS, registerItem };

// Optional modules, loaded in the background when this file loads and read synchronously later (MODS.phone …). A dynamic
// import() inside a script would only resolve on a real task, which the headless test harness (microtasks only) never gives.
export const MODS = {};
for (const [k, path] of Object.entries({ phone: '../engine/phone_apps.js', family: './family.js', crime: '../engine/crime.js', people: '../engine/life.js' })) {
  import(path).then((m) => { MODS[k] = m; }).catch(() => {});
}

// ====================================================================== small helpers
export const has = (g, k) => !!g && typeof g[k] === 'function';
export const who = (n) => ({ name: n.name, look: n.look });
export const eraId = (g) => (g && g.state && g.state.profile && g.state.profile.era) || 'reiwa';
export const ERA_YEAR = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
export function dateNow(g) {
  try { if (has(g, 'owaraiDate')) { const d = g.owaraiDate(); if (d && d.year) return d; } } catch (e) { console.error(e); }
  return { year: ERA_YEAR[eraId(g)] || 2026, month: 4, dom: 1 };
}
export const yearNow = (g) => dateNow(g).year;
export const monthNow = (g) => dateNow(g).month;
// pick the text of the game's era (missing eras fall back to the next older one, then 令和)
export function byEra(g, o) {
  const id = eraId(g);
  const order = ['showa', 'heisei_early', 'heisei', 'reiwa'];
  if (o[id] !== undefined) return o[id];
  for (let i = order.indexOf(id) - 1; i >= 0; i--) if (o[order[i]] !== undefined) return o[order[i]];
  return o.reiwa !== undefined ? o.reiwa : o.any;
}
export const adult = (g) => ageOf(g.state) >= 20;
export const ageNow = (g) => ageOf(g.state);
export const money = (g) => g.state.money;
export function passTime(g, min, why = '') {
  try { if (has(g, 'advanceTime')) return g.advanceTime(Math.max(1, Math.round(min)), why); } catch (e) { console.error(e); }
  return null;
}
export function clockOf(g) { try { return has(g, 'clock') ? g.clock() : null; } catch (e) { return null; } }
export const nowTotal = (g) => { const c = clockOf(g); return c && Number.isFinite(c.total) ? c.total : null; };
export const T = (h, m = 0) => h * 60 + m;
export const hm = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
export const isSunday = (g) => weekdayOf(g.state.day) === 6;
export const wdName = (g) => WEEKDAYS[weekdayOf(g.state.day)];

// first-visit lines (once per place): a flag of the shops' own state, so old saves just see them once
export async function firstVisit(g, key, lines, n) {
  const s = SS(g);
  if (s.met[key]) return;
  s.met[key] = 1;
  await g.wait(200);
  await g.say(lines, n ? who(n) : {});
}

// ====================================================================== the shops' state
// g.state.flags.shopS = { v, d: { day, k }, met, seeds [{ t, from }], st { [venue]: { shows, lives, favor, last } },
//   tsuke (¥ owed to a ramen shop), hang (hangover day), wear (costume id), wearDay, read { [book]: 1 }, lost, bank: { … } }
export function SS(g) {
  const f = g.state.flags;
  let s = f.shopS;
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = f.shopS = {};
  if (!s.d || typeof s.d !== 'object' || !s.d.k) s.d = { day: 0, k: {} };
  if (s.d.day !== g.state.day) s.d = { day: g.state.day, k: {} };
  if (!s.met || typeof s.met !== 'object') s.met = {};
  if (!Array.isArray(s.seeds)) s.seeds = [];
  if (!s.st || typeof s.st !== 'object') s.st = {};
  if (!s.read || typeof s.read !== 'object') s.read = {};
  if (!Number.isFinite(s.tsuke)) s.tsuke = 0;
  return s;
}
export const dayN = (g, k) => Number(SS(g).d.k[k]) || 0;
export const bumpN = (g, k) => { const s = SS(g); s.d.k[k] = (Number(s.d.k[k]) || 0) + 1; return s.d.k[k]; };
export function stageRec(g, id) {
  const s = SS(g);
  const r = s.st[id] && typeof s.st[id] === 'object' ? s.st[id] : (s.st[id] = {});
  for (const k of ['shows', 'lives', 'favor', 'last']) if (!Number.isFinite(r[k])) r[k] = 0;
  return r;
}

// ====================================================================== opening hours
// hours = { spans: [[from, to], ...], closed: [6], note: '日曜定休' }; the game's clock is 0..1799 (25:00 = 1500).
// hours may be a function of g (era-dependent hours): resolved here
export const hoursOf = (g, h) => { try { return typeof h === 'function' ? h(g) : h; } catch (e) { console.error(e); return null; } };
export function hoursText(h) {
  if (!h) return '';
  const sp = (h.spans || []).map(([a, b]) => `${hm(a)}〜${hm(b)}`).join('・');
  return `営業時間 ${sp}${h.note ? '　' + h.note : ''}`;
}
export function openState(g, h0) {
  const h = hoursOf(g, h0);
  if (!h) return { open: true };
  if (h.closed && h.closed.includes(weekdayOf(g.state.day))) return { open: false, reason: 'day', next: null };
  const t = nowTotal(g);
  if (t == null) return { open: true };
  const spans = (h.byDay && h.byDay[weekdayOf(g.state.day)]) || h.spans || [];
  for (const [a, b] of spans) if (t >= a && t < b) return { open: true, left: b - t };
  const next = spans.find(([a]) => a > t);
  return { open: false, reason: next ? 'early' : 'late', next: next ? next[0] : null, t };
}
// the town building's enter(g): closed → a notice (and 「開くまで待つ？」 when it opens later today)
export const shopGate = (placeId) => async (g) => {
  const back = async () => { if (has(g, 'movePlayer')) await g.movePlayer(['down']); };
  const P0 = PLACES[placeId];
  if (!P0) { g.sfx('cursor'); await g.say('（まだ準備中のようだ…）'); await back(); return; }
  const st = openState(g, P0.hours);
  if (st.open) { await g.enterPlace(placeId); return; }
  g.sfx('cursor');
  const name = P0.name || 'お店';
  const note = hoursText(hoursOf(g, P0.hours));
  if (st.reason === 'day') { await g.say([`「${name}」は、きょうは定休日のようだ。`, `ドアの札に「${note}」とある。`]); await back(); return; }
  if (st.reason === 'early' && st.next != null && st.next - st.t <= 360) {
    const wait = st.next - st.t;
    const k = await g.ask([`「${name}」は、まだ準備中のようだ。`, `ドアの札に「${note}」とある。\n（開店まであと${wait >= 60 ? Math.floor(wait / 60) + '時間' : ''}${wait % 60 ? (wait % 60) + '分' : ''}）`], ['開くまで待つ', 'あとにする'], { cancel: 1 });
    if (k === 0) {
      if (has(g, 'advanceTo')) g.advanceTo(st.next, '開店待ち'); else passTime(g, wait, '開店待ち');
      await g.say('時間をつぶしているうちに、ドアが開いた。');
      await g.enterPlace(placeId);
      return;
    }
    await back();
    return;
  }
  await g.say([`「${name}」は、もう閉まっている。`, `ドアの札に「${note}」とある。`]);
  await back();
};

// the fields a town building needs to open onto a shop: ...shopDoor('shop_x')  (place + the hours gate)
export const shopDoor = (id) => ({ place: id, enter: shopGate(id) });

// ====================================================================== places
const SHOPS = {};
export function registerShop(def) {
  const place = { kind: 'building', bgm: 'office', ...def };
  registerPlace(place);
  SHOPS[def.id] = place;
  // shoplifting odds / cameras (crime.js is optional)
  if (def.crime) {
    import('../engine/crime.js').then((m) => { if (typeof m.registerCrimeSpot === 'function') m.registerCrimeSpot(def.id, def.crime); }).catch(() => {});
  }
  return place;
}
export const SHOP_IDS = () => Object.keys(SHOPS);

// A room from rows of text built in code: walls, a window row and the exit mat at the bottom.
//   const r = room(12, 9, { wall: 'wood', floor: 'floor_wood_dark' });  r.set(3, 4, 'C'); r.rect(1, 2, 4, 1, 'K'); r.rows()
export function room(w, h, o = {}) {
  const a = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (y === 0 || y === h - 1 || x === 0 || x === w - 1 ? '#' : y === 1 ? '=' : '.')));
  const api = {
    w, h,
    set(x, y, ch) { if (x >= 0 && y >= 0 && x < w && y < h) a[y][x] = ch; return api; },
    rect(x, y, ww, hh, ch) { for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) api.set(xx, yy, ch); return api; },
    row(y, str, x0 = 1) { for (let i = 0; i < str.length; i++) if (str[i] !== ' ') api.set(x0 + i, y, str[i]); return api; },
    exit(...xs) { for (const x of xs) api.set(x, h - 1, 'M'); return api; },
    rows() { return a.map((r) => r.join('')); },
    warps(...xs) { return xs.map((x) => ({ x, y: h - 1, to: 'exit' })); },
  };
  return api;
}
// an NPC shorthand
export const npc = (id, x, y, dir, look, name, lines, extra = {}) => ({
  type: 'npc', id, x, y, dir, look, name,
  ...(typeof lines === 'function' ? { talk: lines } : { text: lines }), ...extra,
});
export const sign = (x, y, lines, extra = {}) => ({ type: 'sign', x, y, text: lines, ...extra });
export const look = (base, over = {}) => ({ ...(typeof base === 'string' ? LOOKS[base] : base), ...over });

// ====================================================================== seeds (ネタの種)
const SEEDS = {
  any: ['エレベーターで、知らない人と二人きり', '電話の保留音', '傘の忘れ物', '自動ドアが反応しない人', '「あとでかけ直す」と言った人', '財布を忘れたレジの前', 'エスカレーターの右と左', '待ち合わせに遅れる友だち', 'ファミレスのドリンクバーの混ぜすぎ', '終電を逃した夜', '親からの仕送りの段ボール', '実家のタンスの奥', '健康診断の前日', '駅のホームの立ち位置', '引っ越しの荷造りで出てくる昔のもの', 'レストランの「お水のおかわり」', '床屋で「いつもの感じで」'],
  showa: ['公衆電話の十円玉切れ', '喫茶店のゲーム机', 'ブラウン管のテレビを叩く', '留守番電話のメッセージ', '駅の伝言板', 'カセットテープの巻き戻し', 'ビデオの予約録画', '黒電話のダイヤル'],
  heisei_early: ['ポケベルの数字メッセージ', 'プリクラの落書き', 'テレホンカードの残り度数', 'ビデオのレンタル返却日', 'コギャルとおじさんの会話', 'ワープロの変換ミス', 'ミニディスクの編集'],
  heisei: ['ガラケーの絵文字', '着メロの鳴りまちがい', 'ブログの更新が止まる', 'ネットカフェの個室', 'ケータイの電池が切れそう', 'mixiの足あと', 'デジカメのメモリ不足'],
  reiwa: ['サブスクの解約', 'セルフレジの「袋はいりません」', '既読スルー', 'スマホの充電が1%', 'Wi-Fiのパスワードを聞く', 'キャッシュレスの小銭', 'マッチングアプリの自己紹介', 'AIスピーカーの聞きまちがい'],
};
export function seedPool(g) {
  const id = eraId(g);
  const order = ['showa', 'heisei_early', 'heisei', 'reiwa'];
  const i = order.indexOf(id);
  const pool = [...SEEDS.any, ...(SEEDS[id] || [])];
  if (i > 0) pool.push(...(SEEDS[order[i - 1]] || []).filter((_, k) => k % 2 === 0));
  return pool;
}
// a new idea (from: where it came from); returns the text, or '' when the 種 bag is full of the same ones
export function addSeed(g, from, preferred) {
  const s = SS(g);
  const have = new Set(s.seeds.map((x) => x.t));
  const pool = preferred ? [preferred] : seedPool(g).filter((t) => !have.has(t));
  if (!pool.length) return '';
  const t = preferred || pool[Math.floor(Math.random() * pool.length)];
  if (have.has(t)) return '';
  s.seeds.push({ t, from: from || '', day: g.state.day });
  while (s.seeds.length > 10) s.seeds.shift();
  return t;
}
// the 台本エディタ with a seed as the theme; the script is polished a little by the writing (仕上がり)
export async function writeWithSeed(g, opts = {}) {
  if (!has(g, 'writeNeta')) { await g.say('（台本エディタは使えないようだ）'); return null; }
  const s = SS(g);
  let seed = null;
  if (s.seeds.length) {
    const i = await g.list({
      title: 'ネタの種をえらぶ', cancel: s.seeds.length,
      items: [...s.seeds.map((x) => ({ label: x.t, right: x.from ? x.from : '' })), { label: '白紙から書く' }],
      x: 12, y: 44, w: 440, px: true,
    });
    if (i < 0) return null;
    if (i < s.seeds.length) seed = s.seeds[i];
  }
  const n = await g.writeNeta({ kind: opts.kind, theme: seed ? seed.t : opts.theme, title: opts.title });
  if (n && seed) {
    s.seeds = s.seeds.filter((x) => x !== seed);
    try { if (has(g, 'practiceNeta') && n.id) g.practiceNeta(n.id, 4); } catch (e) { console.error(e); }
    g.notify(`ネタの種「${seed.t}」を使った`, { color: '#ffd23f' });
  }
  return n;
}

// ====================================================================== fictional acts
const ACT_A = ['どんぐり', 'ぽんぽこ', 'ふわふわ', 'でこぼこ', 'きんぎょ', 'まるごと', 'ひよこ', 'ぷるぷる', 'ぱんだ', 'ころころ', 'すいか', 'ちくわ', 'こたつ', 'せんべい', 'ぞうきん', 'ざぶとん'];
const ACT_B = ['パレード', 'ラボ', 'クラブ', 'ドロップス', 'マンボ', 'スクランブル', 'エクスプレス', 'ファクトリー', 'ステーション', 'アワー', 'ストリート', 'サーカス'];
export function showName(seed) {
  for (let k = 0; k < 40; k++) {
    const a = ACT_A[Math.floor(hash2(seed, k, 11) * ACT_A.length)], b = ACT_B[Math.floor(hash2(seed, k, 29) * ACT_B.length)];
    const n = a + b;
    let bad = false;
    try { bad = !!isRealNameLike(n); } catch (e) { bad = false; }
    if (!bad) return n;
  }
  return 'ふわふわパレード';
}
// today's acts of a venue (deterministic by the day, the venue and the slot)
export function lineup(g, venueId, slot = 0, n = 4) {
  const base = g.state.day * 131 + slot * 17 + [...venueId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const out = [];
  for (let i = 0; out.length < n && i < 60; i++) { const nm = showName(base + i * 7); if (!out.includes(nm)) out.push(nm); }
  return out;
}

// ====================================================================== 噂 (rumours from real state)
// A job the player can take now (guide.js GUIDE_JOBS + jobOpen) that has not been done yet, told as a rumour; else a tip.
const TIPS = [
  'おなかがすいたまま舞台に立つと、客席にも伝わるぞ。食べてから行け。', 'ストレスがたまったら、カラオケでも銭湯でもいい。ためこむな。',
  '身だしなみを整えると、お客さんも仕事の人も、見る目が変わる。', 'ネタは、書いたら人前でやってみないとわからん。小さい舞台でいい。',
  '相方とは、仕事の話だけじゃなく、飯も食え。コンビ仲は、そこで決まる。', '本は裏切らない。古本屋で一冊、ネタの種を拾ってこい。',
];
export function rumor(g, salt = 0) {
  const st = g.state;
  const done = (j) => (st.jobs && j.ids.some((id) => st.jobs[id])) || false;
  let pool = [];
  try { pool = GUIDE_JOBS.filter((j) => jobOpen(st, j) && GUIDE[j.place] && PLACES[j.place] && !done(j)); } catch (e) { pool = []; }
  const r = hash2(st.day, salt + 3, 17);
  if (pool.length && r < 0.75) {
    const j = pool[Math.floor(hash2(st.day, salt + 5, 9) * pool.length)];
    const where = GUIDE[j.place].short || GUIDE[j.place].name;
    const t = [`「${j.label}」の仕事が、${where}で出てるらしいぞ。`, `${where}で「${j.label}」を探してるって聞いたな。`, `${where}の「${j.label}」、やってみたらどうだ？ 場数は大事だ。`];
    return t[Math.floor(hash2(st.day, salt + 7, 5) * t.length)];
  }
  return TIPS[Math.floor(hash2(st.day, salt + 11, 23) * TIPS.length)];
}
// today's overheard rumour from this NPC (once a day per NPC): the line, and sometimes a ネタの種 on top
export async function rumorTalk(g, key, o, opening) {
  if (dayN(g, 'rumor_' + key) >= 1) return false;
  bumpN(g, 'rumor_' + key);
  const lines = [].concat(opening || []);
  lines.push(rumor(g, key.length));
  if (Math.random() < 0.4) { const t = addSeed(g, '小耳にはさんだ話'); if (t) lines.push(`（ネタの種：「${t}」）`); }
  await g.say(lines, o);
  return true;
}

// ====================================================================== 宴会 (a table with your friends)
// Up to three friends (♥2+; the 相方 first): everyone's ♥ goes up (once a day each), stress down, comedians swap ネタ and 発想力.
export async function enkai(g, { where, host, per = 2000, minutes = 150, title = '宴会', toast = '乾杯！' }) {
  const P = (MODS.people && MODS.people.PEOPLE) || {};
  let ids = (has(g, 'friends') ? g.friends(2) : []).filter((id) => P[id] && P[id].kind !== 'family');
  ids.sort((a, b) => (g.state.partner === b ? 1 : 0) - (g.state.partner === a ? 1 : 0) || g.aff(b) - g.aff(a));
  const pals = ids.slice(0, 3);
  if (!pals.length) { await g.say(['仲のいい仲間がいれば、みんなで「宴会」ができる。', '（友だちを作って、♥を上げてから来よう）'], host ? who(host) : {}); return false; }
  const total = per * (pals.length + 1);
  const names = pals.map((id) => P[id].short || P[id].name).join('・');
  const k = await g.ask([`${where}で「${title}」をひらく？`, `メンバー：${names}と自分\n（会計の目安 ${fmtMoney(total)}・${Math.round(minutes / 60 * 10) / 10}時間）`], ['ひらく', 'やめておく'], { ...(host ? who(host) : {}), cancel: 1 });
  if (k !== 0) return false;
  if (dayN(g, 'enkai') >= 1) { await g.say('今日はもう、宴会をひらいた。\n（続けて飲むと、体にこたえる…）', host ? who(host) : {}); return false; }
  if (!g.spend(total)) { await g.say('お金が足りない…。'); return false; }
  bumpN(g, 'enkai');
  g.sfx('coin');
  const a = snap(g);
  await g.fadeOut(10); g.sfx('applause'); await g.wait(500); await g.fadeIn(10);
  const lines = [toast];
  for (const id of pals) {
    const Pd = P[id];
    const rec = g.person(id);
    const fresh = !(rec && rec.hangDay === g.state.day);
    if (rec) rec.hangDay = g.state.day;
    g.addAff(id, fresh ? 3 : 1, true);
    const pool = (Pd.hangout && Pd.hangout.default ? [].concat(Pd.hangout.default) : []).filter((t) => typeof t === 'string' && !t.startsWith('（'));
    lines.push(`${Pd.short || Pd.name}「${(pool.length ? pool[Math.floor(Math.random() * pool.length)] : '今日は飲もう！ 仕事の話は、ほどほどにな。').replace(/\n/g, '')}」`);
    if (Pd.kind === 'comedian') { try { g.addComedyStat('hassou', 1, true); } catch (e) { /* optional */ } }
  }
  if (pals.some((id) => g.state.partner === id) && has(g, 'unitHarmony')) { try { g.unitHarmony(2, '飲み会'); } catch (e) { /* optional */ } }
  if (pals.some((id) => P[id].kind === 'comedian')) { const t = addSeed(g, `${title}で聞いた話`); if (t) lines.push(`（芸人の仲間の話から、ネタの種を拾った：「${t}」）`); }
  const adultDrink = adult(g);
  if (adultDrink) { const n = bumpN(g, 'drinks') + 1; bumpN(g, 'drinks'); if (n >= 4) SS(g).hang = g.state.day; if (has(g, 'drinkAlcohol')) { try { await g.drinkAlcohol({ heavy: n >= 4, where }); } catch (e) { console.error(e); } } }
  g.relax({ stress: adultDrink && dayN(g, 'drinks') >= 4 ? 10 : 24 });
  g.eat(12, { silent: true, fill: 30 });
  passTime(g, minutes, title);
  lines.push(`${diffText(g, a)}${adultDrink && dayN(g, 'drinks') >= 4 ? '\n（飲みすぎた…。明日の朝がこわい）' : ''}`);
  await g.say(lines);
  return true;
}

// ====================================================================== eating and drinking
function snap(g) { const L = g.state.life; return { st: g.state.stamina, hu: L.hunger, sr: L.stress, cl: L.clean }; }
export function diffText(g, a) {
  const L = g.state.life, out = [];
  if (g.state.stamina !== a.st) out.push(`体力${g.state.stamina > a.st ? '+' : ''}${g.state.stamina - a.st}`);
  if (L.hunger !== a.hu) out.push(`満腹${L.hunger > a.hu ? '+' : ''}${L.hunger - a.hu}`);
  if (L.stress !== a.sr) out.push(`ストレス${L.stress > a.sr ? '+' : ''}${L.stress - a.sr}`);
  if (L.clean !== a.cl) out.push(`身だしなみ${L.clean > a.cl ? '+' : ''}${L.clean - a.cl}`);
  return out.join('　');
}
const minorLine = (g) => byEra(g, {
  showa: '悪いけど、お酒は二十歳になってからだよ。\n…ジュースじゃだめかい？',
  heisei_early: '申し訳ないけど、お酒は二十歳になってからなんだ。\nウーロン茶でどうだい？',
  heisei: '恐れ入ります、お酒は二十歳になってからなんです。\n年齢確認も、きびしくなりましたので…。',
  reiwa: '申し訳ありません、お酒は二十歳になってから。\nノンアルコールもありますよ。',
});
// A menu to eat or drink on the spot. entries: [{ name, price, heal, fill, stress, clean, alc, desc, text, food, time, special }].
// Alcohol is for 20+ only (the host says no, nothing is charged). More than three drinks in a day: the next morning is rough (SS.hang).
// Returns the entry, or null.
export async function orderMenu(g, { title, entries, host, thanks, sale = 1, time = 0, where = '', cover = null }) {
  const coverDue = cover && dayN(g, 'cover_' + cover.id) === 0;
  const price = (e) => Math.round((e.price * (e.sale === false ? 1 : sale)) / 10) * 10;
  const effects = (e) => {
    const p = [];
    if (e.heal) p.push(`体力+${e.heal}`);
    if (e.fill) p.push(`満腹+${e.fill}`);
    if (e.stress) p.push(`ストレス-${e.stress}`);
    if (e.clean) p.push(`身だしなみ+${e.clean}`);
    return p.join('　');
  };
  const k = await g.list({
    title: `${title}（所持金 ${fmtMoney(g.state.money)}）${coverDue ? `　${cover.name} ${fmtMoney(cover.price)}` : ''}`,
    items: entries.map((e) => ({ label: e.name + (e.alc ? '（20歳〜）' : ''), right: fmtMoney(price(e)), disabled: g.state.money < price(e) + (coverDue ? cover.price : 0) })),
    x: 12, y: 44, w: 440, px: true,
    describe: (i) => [entries[i].desc, effects(entries[i])].filter(Boolean).join('\n') + (entries[i].fill && !g.canEat() ? '\nいまはおなかいっぱい…' : ''),
  });
  if (k < 0) return null;
  const e = entries[k];
  const p = price(e);
  if (e.alc && !adult(g)) { await g.say(minorLine(g), host ? who(host) : {}); return null; }
  if (g.state.money < p + (coverDue ? cover.price : 0)) { await g.say('お金が足りない…。'); return null; }
  if (e.fill && !g.canEat()) { await g.say('おなかいっぱいで、もう入らない…。\n（おなかが空いたら、また来よう）'); return null; }
  if (e.special) { const r = await e.special(g, e); if (r === false) return null; }
  g.state.money -= p;
  if (coverDue) { g.state.money -= cover.price; bumpN(g, 'cover_' + cover.id); }
  g.sfx('coin');
  const a = snap(g);
  if (e.heal || e.fill) g.eat(e.heal || 0, { silent: true, fill: e.fill || 0 });
  let stress = e.stress || 0, note = '';
  if (e.alc) {
    const n = bumpN(g, 'drinks');
    if (n >= 4) { SS(g).hang = g.state.day; note = '\n（飲みすぎた…。明日の朝がこわい）'; }
    if (has(g, 'drinkAlcohol')) { try { await g.drinkAlcohol({ heavy: n >= 4, where: where || title }); } catch (err) { console.error(err); } }
    if (n >= 3) stress = Math.max(1, Math.round(stress / 3));
  } else if (stress && !e.fill) {
    const n = bumpN(g, 'treat');
    if (n > 2) { stress = Math.max(1, Math.round(stress / 4)); note = '\n（今日はもう何度も気分転換した。効果は小さめ…）'; }
  } else if (stress) stress = Math.round(stress * (g.lastEatRatio ?? 1));
  g.relax({ stress, clean: e.clean || 0 });
  passTime(g, e.time || time || (e.fill ? 30 : 15), title);
  await g.say([e.text || `${e.name}をいただいた。`, (coverDue ? `（${cover.name} ${fmtMoney(cover.price)}も、いっしょに出てきた）\n` : '') + (diffText(g, a) || 'ほっとひと息。') + note]);
  if (thanks && host) await g.say(thanks, who(host));
  return e;
}
// a morning after too many drinks (SS.hang): 体力 and ストレス, as a morning note (never a message)
onMorning((g) => {
  try {
    const s = g.state.flags.shopS;
    if (!s || typeof s !== 'object' || !s.hang) return;
    const was = s.hang;
    s.hang = 0;
    if (g.state.day - was <= 1) s.hangDay = g.state.day;
    if (g.state.day - was > 1) return;
    g.state.stamina = Math.max(1, g.state.stamina - 12);
    g.addNeed('stress', 4);
    (g.morningNotes || (g.morningNotes = [])).push('（昨夜は飲みすぎた…。頭が重い。薬局の胃腸薬か、ひと眠りが効きそうだ）');
  } catch (e) { console.error(e); }
});

// g.shop lists that skip items that are not registered
export function goodsOf(list, sale = 1) {
  return list.filter((x) => ITEMS[typeof x === 'string' ? x : x.item]).map((x) => {
    const id = typeof x === 'string' ? x : x.item;
    const base = typeof x === 'string' ? ITEMS[id].price : x.price;
    return sale === 1 ? { item: id, price: base } : { item: id, price: Math.round((base * sale) / 10) * 10 };
  });
}
// a shelf: shopping, or (when the shared crime api is there) 「万引きする…？」 — the same as the コンビニ and スーパー.
export async function shelf(g, { title, greeting, items, sale = 1, lift }) {
  const api = PLACES.kanraku && PLACES.kanraku.api;
  const list = goodsOf(items, sale);
  if (!list.length) { await g.say('（いまは品切れのようだ…）'); return 0; }
  if (!api || !lift) return g.shop(list, { title, greeting });
  const k = await g.ask(`${title}の棚だ。`, ['買い物する', 'ながめるだけ', '万引きする…？'], { cancel: 1 });
  if (k === 0) return g.shop(list, { title, greeting });
  if (k === 2) await api.shoplift(g, { where: lift.where, items: lift.items.filter((id) => ITEMS[id]) });
  return 0;
}

// ====================================================================== wearing and using (items)
export function useDaily(g, key, limit, over) {
  const n = bumpN(g, key);
  if (n > limit) { return false; }
  return true;
}

// ====================================================================== music (original chiptune)
registerSong('shop_izakaya', {
  bpm: 96, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.034, notes: 'A4 . C5 E5 . D5 C5 . | B4 . D5 F5 . E5 D5 . | C5 . E5 A5 . G5 E5 . | D5 - - . E5 - - . | A4 . C5 E5 . D5 C5 . | G4 . B4 D5 . C5 B4 . | A4 . C5 E5 . D5 B4 . | A4 - - - . . . .' },
    { wave: 'triangle', vol: 0.1, notes: 'A2 . E3 . A2 . E3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | E2 . B2 . E2 . B2 . | A2 . E3 . A2 . E3 . | G2 . D3 . G2 . D3 . | F2 . C3 . E2 . B2 . | A2 . E3 . A2 . . .' },
    { wave: 'drum', vol: 0.05, notes: 'k . h . s . h . | k . h k s . h h' },
  ],
});
registerSong('shop_live', {
  bpm: 148, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'E4 E4 G4 . A4 . G4 E4 | D4 D4 F4 . G4 . F4 D4 | C4 C4 E4 . G4 . E4 C4 | D4 . E4 . G4 - A4 . | E4 E4 G4 . A4 . B4 A4 | G4 G4 B4 . D5 . B4 G4 | A4 A4 C5 . E5 . D5 C5 | B4 - - . A4 - - .' },
    { wave: 'sawtooth', vol: 0.03, notes: 'E3 E3 E3 E3 G3 G3 G3 G3 | D3 D3 D3 D3 F3 F3 F3 F3 | C3 C3 C3 C3 E3 E3 E3 E3 | D3 D3 D3 D3 A3 A3 A3 A3' },
    { wave: 'triangle', vol: 0.12, notes: 'E2 . E2 E2 . E2 G2 . | D2 . D2 D2 . D2 F2 . | C2 . C2 C2 . C2 E2 . | D2 . D2 D2 . A2 A2 .' },
    { wave: 'drum', vol: 0.09, notes: 'k . h s k . h s | k k h s k . h s' },
  ],
});
registerSong('shop_yose', {
  bpm: 100, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.07, notes: 'D5 . F5 . G5 . A5 - | G5 . F5 . D5 - - . | D5 . F5 . A5 . C6 - | A5 . G5 . F5 - - . | D5 . F5 . G5 . A5 - | C6 . A5 . G5 . F5 . | G5 . A5 . F5 . D5 - | D5 - - - . . . .' },
    { wave: 'square', vol: 0.02, notes: 'D4 . A4 . D4 . A4 . | D4 . A4 . D4 . A4 . | C4 . G4 . C4 . G4 . | C4 . G4 . C4 . G4 .' },
    { wave: 'drum', vol: 0.03, notes: 'k . . . h . . . | k . . h . . h .' },
  ],
});
registerSong('shop_quiet', {
  bpm: 76, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.07, notes: 'C5 - E5 - G5 - E5 - | F5 - A5 - C6 - A5 - | G5 - B5 - D6 - B5 - | C6 - - - . . . . | A5 - C6 - E6 - C6 - | F5 - A5 - C6 - A5 - | G5 - F5 - E5 - D5 - | C5 - - - . . . .' },
    { wave: 'triangle', vol: 0.09, notes: 'C3 - - - G2 - - - | F2 - - - C3 - - - | G2 - - - D3 - - - | C3 - - - . . . .' },
  ],
});
registerSong('shop_jazz', {
  bpm: 90, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.075, notes: 'E5 . G5 A5 . B5 . G5 | A5 . C6 B5 . A5 . G5 | F5 . A5 G5 . F5 . E5 | D5 - - . E5 . . . | E5 . G5 A5 . B5 . D6 | C6 . B5 A5 . G5 . A5 | B5 . G5 E5 . D5 . C5 | E5 - - - . . . .' },
    { wave: 'triangle', vol: 0.1, notes: 'C3 . E3 . G3 . E3 . | F2 . A2 . C3 . A2 . | D3 . F3 . A3 . F3 . | G2 . B2 . D3 . B2 . | C3 . E3 . G3 . E3 . | A2 . C3 . E3 . C3 . | D3 . F3 . A3 . F3 . | G2 . B2 . C3 . . .' },
    { wave: 'drum', vol: 0.025, notes: 'h . h . h . h h' },
  ],
});

// ====================================================================== tiles (HD, 32x32)
function tile(id, def, hd) {
  defineTile(id, {
    ...def,
    hd,
    draw(c, r, f, v) {
      const [cv, c2] = makeCanvas(32, 32);
      hd(c2, r, f, v);
      c.drawImage(cv, 0, 0, 16, 16);
    },
  });
}
const CH = { d: '#7d8391', m: '#b8bec8', l: '#dfe3ea', h: '#f6f8fb' };
const WOOD = { d: '#5a3a20', m: '#8a5a33', l: '#b07a48', h: '#d09a62' };

tile('shop_atm', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 11, 1);
  R(c, 5, 2, 22, 27, '#3a4a68'); R(c, 5, 2, 22, 2, '#7a8aa8'); R(c, 5, 2, 2, 27, '#5a6a88'); R(c, 25, 4, 2, 25, '#27324a');
  R(c, 8, 5, 16, 10, '#10202e'); R(c, 9, 6, 14, 8, '#3fa8d8'); R(c, 10, 7, 7, 1, '#e0f6ff'); R(c, 10, 9, 11, 1, '#a8e0f8'); R(c, 10, 11, 6, 1, '#a8e0f8'); R(c, 18, 11, 4, 2, '#ffd23f');
  R(c, 8, 17, 16, 3, '#1c2436'); R(c, 9, 18, 14, 1, '#0a0e14'); R(c, 20, 17, 3, 1, '#3fd07a');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R(c, 9 + i * 4, 22 + j * 2, 3, 1, '#c8ccd4');
  R(c, 21, 22, 3, 5, '#2a3446'); R(c, 22, 23, 1, 3, '#d0d4dc');
  outline(c);
});
function tellerTile(id, band) {
  tile(id, { solid: true, obj: true, talkThrough: true }, (c) => {
    R(c, 0, 14, 32, 18, WOOD.m); R(c, 0, 14, 32, 4, '#e0c8a0'); R(c, 0, 14, 32, 1, '#f6e8cc'); R(c, 0, 18, 32, 1, WOOD.d);
    R(c, 1, 20, 14, 10, WOOD.l); R(c, 17, 20, 14, 10, WOOD.l); R(c, 2, 21, 12, 1, WOOD.h); R(c, 18, 21, 12, 1, WOOD.h);
    R(c, 0, 10, 32, 5, band); R(c, 0, 10, 32, 1, shade(band, 0.35));
    R(c, 2, 0, 28, 10, 'rgba(200,232,255,0.5)'); R(c, 2, 0, 28, 1, '#a8b6c8'); R(c, 2, 0, 1, 10, '#a8b6c8'); R(c, 29, 0, 1, 10, '#8a98ac');
    R(c, 4, 2, 6, 1, 'rgba(255,255,255,0.7)'); R(c, 5, 4, 3, 1, 'rgba(255,255,255,0.5)');
    R(c, 10, 8, 12, 3, '#5a6a7a'); R(c, 11, 9, 10, 1, '#2a3440');
    R(c, 13, 15, 6, 2, '#ffffff'); R(c, 14, 16, 4, 1, band);
    outline(c);
  });
}
tellerTile('shop_teller', '#2a4a8a');
tellerTile('shop_teller_post', '#c8281c');
tile('shop_postbox', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 9, 1);
  R(c, 8, 5, 16, 24, '#c8281c'); R(c, 8, 5, 16, 2, '#f0584a'); R(c, 8, 5, 2, 24, '#e04030'); R(c, 22, 7, 2, 22, '#901a12');
  R(c, 10, 9, 12, 3, '#1c1a1e'); R(c, 11, 10, 10, 1, '#3a3640');
  R(c, 12, 15, 8, 8, '#ffffff'); R(c, 13, 16, 6, 2, '#c8281c'); R(c, 15, 18, 2, 4, '#c8281c');
  R(c, 8, 28, 16, 2, '#6a1810');
  outline(c);
});
function spines(c, r, x, y, w, h, pal) {
  let xx = x;
  while (xx < x + w - 1) {
    const sw = 2 + Math.floor(r() * 3), col = pal[Math.floor(r() * pal.length)], hh = h - Math.floor(r() * 3);
    R(c, xx, y + h - hh, Math.min(sw, x + w - xx), hh, col);
    R(c, xx, y + h - hh, 1, hh, shade(col, 0.22));
    if (r() < 0.5) R(c, xx + 1, y + h - hh + 2, 1, 2, shade(col, 0.5));
    xx += sw;
  }
}
tile('shop_bookrack', { solid: true, obj: true, variants: 3 }, (c, r, f, v) => {
  const pals = [['#d84a3a', '#2f6fd0', '#ffd23f', '#3fae6a', '#8a5ac8', '#f2f2f2', '#ff8a3d'], ['#8a6a4a', '#6a5a3a', '#a8905a', '#4a5a6a', '#7a3a3a', '#c8b88a', '#5a6a4a'], ['#ff6a9a', '#5fd7ff', '#ffe04a', '#9af06a', '#ffffff', '#ff9a3a', '#c8a0ff']];
  const pal = pals[v];
  R(c, 0, 0, 32, 32, WOOD.m); R(c, 1, 1, 30, 30, '#4a3220');
  for (let row = 0; row < 3; row++) {
    const y = 2 + row * 10;
    spines(c, r, 2, y, 28, 8, pal);
    R(c, 1, y + 8, 30, 2, WOOD.l); R(c, 1, y + 8, 30, 1, WOOD.h);
  }
  R(c, 0, 0, 32, 1, WOOD.h);
  outline(c);
});
tile('shop_pharm', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#d8dce4'); R(c, 1, 1, 30, 30, '#f4f6fa');
  const cols = v ? ['#3fae6a', '#ffffff', '#5fb8e8', '#ffd23f'] : ['#ffffff', '#ff9a3a', '#3fae6a', '#8ac8f0'];
  for (let row = 0; row < 3; row++) {
    const y = 2 + row * 10;
    for (let x = 2; x < 29; x += 5) {
      const col = cols[(x + row * 3 + v) % cols.length];
      R(c, x, y + 1, 4, 7, col); R(c, x, y + 1, 4, 1, shade(col, 0.3)); R(c, x + 3, y + 2, 1, 6, shade(col, -0.2));
      R(c, x + 1, y + 3, 2, 1, (x + row) % 2 ? '#d62f2f' : '#2f6fd0');
    }
    R(c, 1, y + 8, 30, 2, '#b8c0cc'); R(c, 1, y + 8, 30, 1, '#e0e6ee');
  }
  R(c, 13, 0, 6, 3, '#d62f2f'); R(c, 15, 0, 2, 3, '#ffffff'); R(c, 14, 1, 4, 1, '#ffffff');
  outline(c);
});
tile('shop_hyaku', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#f0c230'); R(c, 1, 1, 30, 30, '#fff6d8');
  const pal = ['#d62f2f', '#2f6fd0', '#3fae6a', '#ff8a3d', '#8a5ac8', '#ff6aa0', '#ffffff'];
  for (let row = 0; row < 3; row++) {
    const y = 2 + row * 10;
    for (let x = 2; x < 29; x += 6) {
      const col = pal[Math.floor(r() * pal.length)];
      R(c, x, y + 1, 5, 7, col); R(c, x, y + 1, 5, 1, shade(col, 0.35)); R(c, x + 1, y + 3, 3, 2, shade(col, 0.5));
      if ((x + row + v) % 3 === 0) R(c, x + 2, y - 1, 1, 2, '#9aa0aa');
    }
    R(c, 1, y + 8, 30, 2, '#e0a820'); R(c, 1, y + 8, 30, 1, '#ffd860');
  }
  R(c, 10, 0, 12, 4, '#d62f2f'); R(c, 11, 1, 10, 2, '#ffd23f'); R(c, 13, 1, 1, 2, '#d62f2f'); R(c, 16, 1, 1, 2, '#d62f2f'); R(c, 19, 1, 1, 2, '#d62f2f');
  outline(c);
});
tile('shop_wagashi', { solid: true, obj: true, talkThrough: true }, (c) => {
  R(c, 0, 16, 32, 16, WOOD.m); R(c, 0, 16, 32, 3, WOOD.h); R(c, 0, 19, 32, 1, WOOD.d);
  R(c, 2, 21, 28, 9, WOOD.l); R(c, 3, 22, 26, 1, WOOD.h);
  R(c, 0, 2, 32, 14, 'rgba(210,236,250,0.55)'); R(c, 0, 2, 32, 1, '#ffffff'); R(c, 0, 2, 1, 14, '#c8d8e4'); R(c, 31, 2, 1, 14, '#a8bccc');
  R(c, 1, 9, 30, 1, '#b8ccd8');
  for (const [x, y, k] of [[3, 5, 0], [10, 5, 1], [17, 5, 2], [24, 5, 3], [4, 12, 1], [11, 12, 0], [18, 12, 3], [25, 12, 2]]) {
    if (k === 0) { oval(c, x, y, 6, 4, '#ffffff'); R(c, x + 1, y, 3, 1, '#ffffff'); P(c, x + 2, y + 1, '#ffd0e0'); }
    else if (k === 1) { oval(c, x, y, 6, 4, '#b8742a'); R(c, x + 1, y + 1, 4, 1, '#d89a4a'); }
    else if (k === 2) { for (let i = 0; i < 3; i++) disc(c, x + 1 + i * 2, y + 2, 1, ['#ff9ab8', '#ffffff', '#8ad07a'][i]); R(c, x, y + 2, 7, 1, '#8a5a33'); }
    else { R(c, x, y + 1, 6, 3, '#4a2a2a'); R(c, x, y + 1, 6, 1, '#6a3a3a'); }
  }
  outline(c);
});
tile('shop_grill', { solid: true, obj: true, frames: 2, speed: 22 }, (c, r, f) => {
  R(c, 0, 12, 32, 20, '#3a3e48'); R(c, 0, 12, 32, 2, '#6a6e78'); R(c, 0, 30, 32, 2, '#20232a');
  R(c, 2, 15, 28, 8, '#1c1a1e');
  for (let x = 3; x < 29; x += 3) R(c, x, 17, 2, 4, (x + f) % 2 ? '#ff6a2a' : '#ffb02a');
  for (let x = 4; x < 28; x += 6) { R(c, x, 12, 1, 8, '#9a7448'); R(c, x - 1, 13, 4, 2, '#c8742a'); R(c, x - 1, 16, 4, 2, '#b8601a'); }
  R(c, 2, 14, 28, 1, '#8a8e98');
  const s = f ? 1 : 0;
  for (const [x, y] of [[6 + s, 6], [14 - s, 4], [22 + s, 7], [10, 2 + s]]) { R(c, x, y, 2, 2, 'rgba(255,255,255,0.6)'); }
  outline(c);
});
tile('shop_oden', { solid: true, obj: true, frames: 2, speed: 26 }, (c, r, f) => {
  R(c, 0, 14, 32, 18, WOOD.m); R(c, 0, 14, 32, 3, WOOD.h);
  R(c, 3, 6, 26, 12, '#b8bec8'); R(c, 3, 6, 26, 2, '#e4e7ec'); R(c, 4, 8, 24, 8, '#8a6a2a'); R(c, 4, 8, 24, 1, '#c89a4a');
  R(c, 12, 8, 1, 8, '#b8bec8'); R(c, 20, 8, 1, 8, '#b8bec8');
  disc(c, 7, 11, 2, '#f2e6c8'); disc(c, 9, 13, 2, '#fff6dc'); R(c, 15, 10, 4, 4, '#e8d0a0'); disc(c, 24, 11, 2, '#ffffff'); P(c, 24, 11, '#ffd23f'); R(c, 22, 13, 4, 2, '#c8a060');
  const s = f ? 1 : 0;
  for (const [x, y] of [[8 + s, 2], [16 - s, 1], [23 + s, 3]]) R(c, x, y, 2, 2, 'rgba(255,255,255,0.65)');
  R(c, 2, 20, 28, 10, WOOD.l);
  outline(c);
});
tile('shop_teppan', { solid: true, obj: true, frames: 2, speed: 24 }, (c, r, f) => {
  R(c, 0, 12, 32, 20, '#4a3a2a'); R(c, 0, 12, 32, 2, '#6a5a4a');
  R(c, 2, 6, 28, 12, '#2a2e36'); R(c, 2, 6, 28, 2, '#4a4e58'); R(c, 3, 8, 26, 8, '#1a1c22');
  oval(c, 5, 9, 10, 6, '#d8962a'); oval(c, 6, 10, 8, 4, '#f2c860'); R(c, 8, 11, 4, 1, '#8a4a1a'); R(c, 7, 12, 1, 1, '#2f9a4a'); R(c, 11, 12, 1, 1, '#2f9a4a');
  oval(c, 17, 9, 10, 6, '#c88628'); oval(c, 18, 10, 8, 4, '#e8b850'); R(c, 20, 11, 4, 1, '#6a3a1a');
  R(c, 1, 5, 5, 1, '#9aa0aa'); R(c, 26, 5, 5, 1, '#9aa0aa');
  const s = f ? 1 : 0;
  for (const [x, y] of [[8 + s, 3], [20 - s, 2], [14, 1 + s]]) R(c, x, y, 2, 2, 'rgba(255,255,255,0.6)');
  R(c, 2, 20, 28, 10, '#5a4a38');
  outline(c);
});
tile('shop_fryer', { solid: true, obj: true }, (c) => {
  R(c, 0, 14, 32, 18, '#8a8e98'); R(c, 0, 14, 32, 2, '#dfe3ea');
  R(c, 3, 6, 18, 12, '#5a5e68'); R(c, 4, 8, 16, 8, '#c8902a'); R(c, 4, 8, 16, 2, '#f0c050');
  for (let x = 6; x < 18; x += 4) { R(c, x, 5, 1, 6, '#9a7448'); R(c, x - 1, 3, 3, 3, '#d8962a'); }
  R(c, 23, 8, 7, 9, '#3a2a1a'); R(c, 23, 8, 7, 2, '#6a4a2a'); R(c, 24, 11, 5, 4, '#5a3a1a');
  R(c, 2, 22, 28, 8, '#6a6e78'); R(c, 4, 24, 24, 1, '#9aa0aa');
  outline(c);
});
tile('shop_sakeshelf', { obj: true }, (c, r) => {
  R(c, 2, 6, 28, 22, '#3a2a1a'); R(c, 3, 7, 26, 20, '#5a3a22');
  for (const y of [7, 17]) {
    R(c, 3, y + 9, 26, 2, '#8a5a33'); R(c, 3, y + 9, 26, 1, '#b07a48');
    for (let x = 4; x < 27; x += 4) {
      const col = ['#3a7a4a', '#7a4a2a', '#d8e4ea', '#2a4a8a', '#a8582a'][Math.floor(r() * 5)];
      R(c, x, y + 1, 3, 8, col); R(c, x + 1, y - 1, 1, 3, shade(col, -0.2)); R(c, x, y + 1, 1, 8, shade(col, 0.35)); R(c, x, y + 4, 3, 2, '#f4ecd8');
    }
  }
  outline(c);
});
tile('shop_fitting', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  R(c, 2, 0, 28, 32, WOOD.d); R(c, 3, 1, 26, 30, WOOD.m);
  const col = v ? '#7a4a9a' : '#2f6b8a';
  R(c, 4, 3, 24, 27, col);
  for (let x = 4; x < 28; x += 4) { R(c, x, 3, 1, 27, shade(col, -0.25)); R(c, x + 2, 3, 1, 27, shade(col, 0.18)); }
  R(c, 4, 3, 24, 2, shade(col, 0.3)); R(c, 4, 28, 24, 2, shade(col, -0.35));
  R(c, 14, 3, 4, 27, shade(col, -0.35)); // the gap in the middle
  for (let x = 5; x < 27; x += 3) R(c, x, 4, 1, 1, '#ffd23f');
  outline(c);
});
tile('shop_flyers', { obj: true, variants: 2 }, (c, r, f, v) => {
  const pal = ['#ffd23f', '#ff7eb6', '#5fd7ff', '#ffffff', '#9af06a', '#ff9a3a'];
  for (let i = 0; i < 7; i++) {
    const x = 1 + Math.floor(r() * 22), y = 3 + Math.floor(r() * 16), col = pal[Math.floor(r() * pal.length)];
    R(c, x, y, 8, 10, col); R(c, x, y, 8, 1, shade(col, 0.4)); R(c, x + 7, y + 1, 1, 9, shade(col, -0.2));
    R(c, x + 1, y + 2, 6, 1, '#20232a'); R(c, x + 1, y + 4, 5, 1, '#5a5f6b'); R(c, x + 1, y + 6, 4, 1, '#5a5f6b'); P(c, x + 3, y, '#d62f2f');
  }
  outline(c, { tint: 0.15 });
});
tile('shop_zabuton', { obj: true, variants: 3 }, (c, r, f, v) => {
  const col = ['#b8303a', '#2f5a8a', '#7a4a9a'][v];
  R(c, 5, 7, 22, 20, shade(col, -0.35)); R(c, 6, 6, 20, 20, col); R(c, 6, 6, 20, 3, shade(col, 0.3)); R(c, 6, 6, 3, 20, shade(col, 0.15));
  R(c, 12, 14, 8, 8, shade(col, 0.2)); R(c, 15, 6, 2, 20, shade(col, -0.12));
  outline(c);
});
tile('shop_chalk', { obj: true }, (c) => {
  R(c, 1, 3, 30, 25, '#5a3a22'); R(c, 3, 5, 26, 21, '#1f3a2e');
  R(c, 5, 8, 14, 1, '#e8f0e0'); R(c, 5, 12, 18, 1, '#e8f0e0'); R(c, 5, 16, 10, 1, '#e8f0e0'); R(c, 5, 20, 16, 1, '#e8f0e0');
  R(c, 22, 8, 3, 3, '#ff9ab8');
  outline(c);
});

// ====================================================================== props
// a lit stage: sweeping coloured spots over a hall (drawOver for the live rooms)
export function stageLights(cx, cy, w = 4) {
  return (ctx, g, cam) => {
    const t = g.frame;
    const cols = ['rgba(255,126,182,0.20)', 'rgba(95,215,255,0.20)', 'rgba(255,210,63,0.18)'];
    for (let i = 0; i < 3; i++) {
      const a = t / 70 + i * 2.1;
      const x = cx * 16 + Math.cos(a) * w * 14 - cam.x, y = cy * 16 + Math.sin(a * 1.3) * 10 - cam.y;
      ctx.fillStyle = cols[i];
      for (let r = 0; r <= 6; r++) { const ww = Math.round(Math.sqrt(36 - (6 - r) * (6 - r)) * 2); ctx.fillRect(Math.round(x - ww), Math.round(y - 6 + r), ww * 2, 1); if (r < 6) ctx.fillRect(Math.round(x - ww), Math.round(y + 6 - r), ww * 2, 1); }
    }
  };
}
// a chalkboard that prints today's lines (lines: (g) => string[])
export function board(x, y, w, linesFn, extra = {}) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy, g) {
      const lines = linesFn(g).slice(0, 4);
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx + 1, sy + 1, w * 16 - 2, 15);
      ctx.fillStyle = '#1f3a2e'; ctx.fillRect(sx + 2, sy + 2, w * 16 - 4, 13);
      lines.forEach((ln, i) => drawText(ctx, ln, sx + 4, sy + 2.5 + i * 3, { size: 3, color: i === 0 ? '#ffd23f' : '#e8f0e0', shadow: null }));
    },
    ...extra,
  };
}
export { defineTile, R, P, disc, oval, outline, shadowEllipse, dither, line, drawText, tile, onMorning, weekdayOf, WEEKDAYS };
