// Life apps for the phone: マップ（地図）, お仕事, 出前（デリバリー）, 通販（カタログ）, 銀行（通帳）,
// ニュース（新聞）, カメラ（写真） and 設定. Each one works through a system that already exists
// instead of copying it:
//   マップ     trips to places you have been to (state.flags.visited, set by g.goto): taxi, the
//              town buses (¥210, as at the bus stops), walking, and the 新幹線 of station.js
//              (its fare and ride cutscene) between 東京 and なんば. Costs money and 体力 (the
//              game's "time"); never from a script, a cutscene or custody.
//   お仕事     open offers (life.js inbox), today's shows, the agency auditions and every job
//              open to you now (guide.js GUIDE_JOBS / jobOpen) — each with a way to get there.
//   出前       a meal brought to you (g.eat): at home; in 令和 also out in a town.
//   通販       furniture through housing.js buyFurniture (+ shipping), goods / gifts / groceries
//              that arrive the next morning (into もちもの).
//   銀行       a savings account (普通預金) with era interest (積数 / 年2回) and 1-year time
//              deposits (定期預金), taxed by date (マル優 → 20% from 1988-04 → 20.315% from 2013);
//              cash in the account is safe from 空き巣 (darkside.js takes cash only). Deposits are
//              handed over when a bankruptcy opens (crime.js 'bankrupt').
//   ニュース   one feed of the press stories already sent (inbox kind 'news' from a news outlet,
//              the politics core's news, g.govtNews when that core is there).
//   カメラ     a photo of the map screen (80x45, ≤16 colours, kept in the save) with who is in the
//              frame; the album; a photo can go up on the era's SNS (career.js, the daily post).
//   設定       sound, text speed (wraps g.say / g.ask), the order of the home screen, controls.
//
// The device follows the era (profile.js ERAS[era].deviceShort): a 手帳 in 昭和 (1987-) and
// 平成のはじめ (1996-: 手帳とポケベル), a ケータイ in 平成なかごろ (2004-), a スマホ in 令和 (2026-).
// dev(g) → 'techo' | 'keitai' | 'smart' names, draws and words every app for it (地図 / マップ,
// 出前 / デリバリー, カタログ / 通販, 通帳 / 銀行, 新聞 / ニュース, 写真 (使い捨てカメラ, developed the
// next morning) / カメラ (写メ, instant)). Dates checked (see the notes by each table):
//   写ルンです 1986-07-01; J-SH04 (camera phone) 2000-11; iモード 1999-02-22 (with mobile banking);
//   宅配ピザ in Japan 1985-09-30; 出前館 2000-10; Uber Eats Tokyo 2016-09-29; クール宅急便 1988-07;
//   ネットスーパー (イトーヨーカドー) 2001-03; Tokyo taxi 初乗り ¥500 / 1.096 km, +¥100 / 255 m (2022-11-14).
//
// State: g.state.phone.apps = { bank, album, film, orders, news, stats } (created on first use,
// old saves get defaults; see appState). Settings that belong to the device (text speed) are in
// localStorage like the sound switch (audio.js).
//
// For other modules (all feature-detected by callers; see test-output/api_phone.txt):
//   travelTo(g, placeId)      the trip chooser for one place (from an app or a talk)
//   mapApp(g) / jobsApp(g) / demaeApp(g) / tsuhanApp(g) / bankApp(g) / newsApp(g) / cameraApp(g) / settingsApp(g)
//   bankBalance(g)            money in the account (普通 + 定期), totalAssets(g) = cash + that
//   newsItems(g)              the merged feed [{ day, text, from, cat, read }]
//   devOf(g)                  'techo' | 'keitai' | 'smart'

import { SW, SH, fmtMoney, clamp, shade, mix, makeCanvas, hash2, display } from './util.js';
import { text, wrap, measure, COLORS } from './draw.js';
import { audio } from './audio.js';
import { ITEMS } from './state.js';
import { PLACES, buildRoom } from './map.js';
import { LOOKS, drawFaceHD, charSheetHD } from './sprites.js';
import {
  registerPhoneApp, PEOPLE, REGULARS, FURNITURE, onMorning, WEEKDAYS, OFFER_DAYS, showWords,
} from './life.js';
import { eraOf } from './profile.js';
import { GUIDE, GUIDE_ORDER, AUDITIONS, GUIDE_JOBS, jobOpen } from '../world/guide.js';
import {
  phoneView, phoneList, phoneInfo, phoneConfirm, closePhoneThen, phoneOverMapOnly,
  appTile, rrect, box, phoneText as T, fitText, PC, readMessage, phoneApps, setAppOrder,
  appName, drawAppIcon, appOrder,
} from './phone.js';
import { Game } from './game.js';

// Other content modules this one works through, looked up when used (each may be missing; the
// literal paths let a single-file bundler include them).
const EXT = { station: null, housing: null, career: null };
import('../world/station.js').then((m) => { EXT.station = m; }).catch(() => { /* station.js left out */ });
import('../world/housing.js').then((m) => { EXT.housing = m; }).catch(() => { /* housing.js left out */ });
import('../world/career.js').then((m) => { EXT.career = m; }).catch(() => { /* career.js left out */ });

// ======================================================================== small helpers
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}
function art(c, x, y, rows, pal, s = 1) {
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      const col = pal[rows[j][i]];
      if (col) R(c, x + i * s, y + j * s, s, s, col);
    }
  }
}
const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const pad2 = (n) => String(n).padStart(2, '0');
// fn(g) computed once per game frame (lists read by update, draw, header and badge alike)
function perFrame(fn) {
  let f = -1, v = null, st = null;
  return (g) => { if (f !== g.frame || st !== g.state) { v = fn(g); f = g.frame; st = g.state; } return v; };
}

const ERA_IDS = ['showa', 'heisei_early', 'heisei', 'reiwa'];
export function eraId(g) {
  const e = g && g.state && g.state.profile && g.state.profile.era;
  return ERA_IDS.includes(e) ? e : 'reiwa';
}
// The device: 手帳 (昭和, 平成のはじめ), ケータイ (平成なかごろ), スマホ (令和).
export function devOf(g) {
  const e = eraId(g);
  return e === 'reiwa' ? 'smart' : e === 'heisei' ? 'keitai' : 'techo';
}
const devWord = (g) => eraOf(g && g.state).deviceShort || 'スマホ';

// The game calendar (as crime.js lawDate: 1 year = 120 days, 1 month = 10 days, from April of
// the era's first year), through g.lawDate when the justice core is there.
const ERA_BASE = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
export function gameDate(g, day) {
  try {
    if (typeof g.lawDate === 'function' && day == null) {
      const d = g.lawDate();
      if (d && Number.isFinite(d.year)) return { year: d.year, month: clamp(Math.round(d.month || 1), 1, 12) };
    }
  } catch (e) { /* fall back */ }
  const n = Math.max(0, (day ?? ((g.state && g.state.day) || 1)) - 1);
  const idx = 3 + Math.floor(n / 10);
  return { year: (ERA_BASE[eraId(g)] || 2026) + Math.floor(idx / 12), month: (idx % 12) + 1 };
}
const ym = (g) => { const d = gameDate(g); return d.year * 100 + d.month; };
function wareki(year, month) {
  let s;
  if (year > 2019 || (year === 2019 && month >= 5)) s = `令和${year - 2018 === 1 ? '元' : year - 2018}年`;
  else if (year > 1989 || (year === 1989 && month >= 2)) s = `平成${year - 1988 === 1 ? '元' : year - 1988}年`;
  else s = `昭和${year - 1925}年`;
  return `${s}${month}月`;
}

// Why an app that does something in the world (a trip, an order, the bank, a photo) cannot
// be used now: custody (crime.js), the regime core's refusal if there is one. null = OK.
function lifeBlock(g) {
  try {
    if (typeof g.justiceRefusal === 'function') {
      const why = g.justiceRefusal('phone', {});
      if (why) return [].concat(why).join('\n');
    }
    if (typeof g.jus === 'function') {
      const j = g.jus();
      if (j && (j.custody || j.status === 'detained' || j.status === 'prison')) return '（いまは身柄を拘束されていて、使えない…）';
    }
  } catch (e) { console.error(e); }
  return null;
}

// ======================================================================== state
const ALBUM_MAX = 30;
const LOG_MAX = 40;
const READY = new WeakSet();
// g.state.phone.apps, created / repaired once per state object (loadGame makes a new one).
export function appState(g) {
  const st = g.state;
  if (!isObj(st.phone)) st.phone = { inbox: [], nextId: 1, lastPost: 0, posts: 0 };
  let s = st.phone.apps;
  if (!isObj(s)) s = st.phone.apps = {};
  if (READY.has(s)) return s;
  const day = st.day || 1;
  const b = isObj(s.bank) ? s.bank : {};
  s.bank = {
    opened: Math.max(0, num(b.opened)),
    bal: Math.max(0, Math.floor(num(b.bal))),
    sekisu: Math.max(0, num(b.sekisu)),
    lastDay: Math.max(1, num(b.lastDay, day)),
    nextCredit: Math.max(0, num(b.nextCredit)),
    interest: Math.max(0, num(b.interest)),
    nextId: Math.max(1, num(b.nextId, 1)),
    time: arr(b.time).filter(isObj).map((t) => ({ id: num(t.id), amount: Math.max(0, Math.floor(num(t.amount))), rate: Math.max(0, num(t.rate)), start: num(t.start, day), due: num(t.due, day + 120) })).filter((t) => t.amount > 0),
    log: arr(b.log).filter(isObj).slice(0, LOG_MAX).map((l) => ({ day: num(l.day, day), what: String(l.what || ''), amount: Math.round(num(l.amount)), bal: Math.max(0, Math.round(num(l.bal))) })),
  };
  s.album = arr(s.album).filter((p) => isObj(p) && typeof p.px === 'string' && typeof p.pal === 'string').slice(0, ALBUM_MAX)
    .map((p) => ({ ...p, id: num(p.id), day: num(p.day, day), w: num(p.w, 80), h: num(p.h, 45), who: arr(p.who).map(String).slice(0, 4), name: String(p.name || ''), dev: num(p.dev), seen: p.seen !== false }));
  s.photoId = Math.max(num(s.photoId, 1), ...s.album.map((p) => p.id + 1), 1);
  s.film = clamp(Math.floor(num(s.film)), 0, FILM_SHOTS);
  s.orders = arr(s.orders).filter((o) => isObj(o) && typeof o.item === 'string' && ITEMS[o.item] && num(o.n) > 0).map((o) => ({ item: o.item, n: Math.floor(num(o.n)), day: num(o.day, day), from: String(o.from || '') }));
  s.news = isObj(s.news) ? { seen: num(s.news.seen) } : { seen: 0 };
  const stt = isObj(s.stats) ? s.stats : {};
  s.stats = { trips: num(stt.trips), meals: num(stt.meals), orders: num(stt.orders), photos: num(stt.photos), fares: num(stt.fares) };
  READY.add(s);
  return s;
}

// ======================================================================== shared UI bits
const COL = {
  map: '#2f8a5e', jobs: '#c0632a', demae: '#d6463a', tsuhan: '#b8862a', bank: '#2f5f9a', news: '#4a4f66', camera: '#3a3a4a', settings: '#6a7080',
};
// A list row: chip (a coloured tag) or icon on the left, label (+ sub), right text.
function drawRow(c, it, x, y, w, rh, sel) {
  if (typeof it === 'string') it = { label: it };
  let lx = x + 10;
  if (it.chip) {
    const [s, col] = it.chip;
    const cw = Math.max(34, Math.ceil(measure(c, s, 12)) + 8);
    rrect(c, x + 8, y + Math.round((rh - 16) / 2), cw, 16, 4, it.disabled ? '#b8b2a4' : col);
    T(c, s, x + 8 + cw / 2, y + Math.round((rh - 16) / 2) + 2, 12, '#ffffff', 'center');
    lx = x + 14 + cw;
  } else if (it.icon) {
    try { it.icon(c, x + 8, y + Math.round((rh - 24) / 2)); } catch (e) { console.error(e); }
    lx = x + 40;
  }
  const rw = it.right ? Math.ceil(measure(c, it.right, 12)) + 12 : 0;
  const col = it.disabled ? PC.dim : sel ? '#1a1a28' : PC.text;
  if (it.sub) {
    T(c, fitText(c, it.label, x + w - lx - rw - 6, 14), lx, y + 4, 14, col);
    T(c, fitText(c, it.sub, x + w - lx - 8, 12), lx, y + 21, 12, it.subColor || PC.dim);
  } else T(c, fitText(c, it.label, x + w - lx - rw - 6, 14), lx, y + Math.round((rh - 14) / 2) - 1, 14, col);
  if (it.right) T(c, it.right, x + w - 8, y + (it.sub ? 6 : Math.round((rh - 12) / 2)), 12, it.rightColor || (it.disabled ? PC.bad : PC.dim), 'right');
}
const rowsList = (g, o) => phoneList(g, { drawRow, ...o });

// A screen with a panel on top (map, bank card, tabs) and a list under it.
//   o: { title, color, bg, top (px or (view) => px), drawTop(c, area, view), items(view) → rows,
//        pick(ph, row, index, view), rowH, hint, empty, headerRight, update(ph, inp, view) → true
//        to swallow the input, tapTop(ph, x, y, view) → bool, onMove(index, view) }
function panelView(g, o) {
  return {
    title: o.title, color: o.color, bg: o.bg, cancel: -1, idx: o.index | 0, sy: null, topRow: 0,
    hint: o.hint || 'A:えらぶ　B:もどる',
    headerRight: o.headerRight,
    rows() { try { return o.items(this) || []; } catch (e) { console.error(e); return []; } },
    topH() { return typeof o.top === 'function' ? o.top(this) : o.top || 0; },
    update(ph, inp) {
      if (o.update && o.update(ph, inp, this) === true) return;
      const rows = this.rows(), n = rows.length;
      if (n) {
        this.idx = clamp(this.idx, 0, n - 1);
        const before = this.idx;
        if (inp.repeat('up')) this.idx = (this.idx + n - 1) % n;
        if (inp.repeat('down')) this.idx = (this.idx + 1) % n;
        if (this.idx !== before) { audio.sfx('cursor'); if (o.onMove) o.onMove(this.idx, this); }
        if (inp.pressed('a')) {
          const it = rows[this.idx];
          if (!it || it.disabled) { audio.sfx('buzz'); if (it && it.why) ph.toast(it.why, '#9aa3c7'); } else { audio.sfx('ok'); o.pick(ph, it, this.idx, this); }
          return;
        }
      }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); }
    },
    tap(ph, x, y) {
      const a = this.area;
      if (!a) return false;
      const th = this.topH();
      if (y < a.y + th) return o.tapTop ? !!o.tapTop(ph, x, y, this) : false;
      const L = this.lay;
      if (!L) return false;
      const i = Math.floor((y - L.y + L.sy) / L.rh);
      const rows = this.rows();
      if (i < 0 || i >= rows.length) return false;
      if (i !== this.idx && o.onMove) o.onMove(i, this);
      this.idx = i;
      return true;
    },
    draw(c, ph, a) {
      this.area = a;
      const th = this.topH();
      if (th && o.drawTop) {
        c.save();
        c.beginPath();
        c.rect(a.x, a.y, a.w, th);
        c.clip();
        try { o.drawTop(c, { x: a.x, y: a.y, w: a.w, h: th }, this, ph); } catch (e) { console.error(e); }
        c.restore();
      }
      const rows = this.rows();
      const L0 = { x: a.x, y: a.y + th, w: a.w, h: a.h - th };
      this.lay = null;
      if (!rows.length) {
        const lines = wrap(c, o.empty || '（なし）', a.w - 32, 12);
        lines.forEach((l, i) => T(c, l, a.x + a.w / 2, L0.y + L0.h / 2 - lines.length * 8 + i * 16, 12, PC.dim, 'center'));
        return;
      }
      const rh = o.rowH || 36;
      const vis = Math.max(1, Math.floor(L0.h / rh));
      const idx = clamp(this.idx, 0, rows.length - 1);
      const maxTop = Math.max(0, rows.length - vis);
      let top = this.topRow;
      if (idx < top) top = idx;
      if (idx >= top + vis) top = idx - vis + 1;
      top = clamp(top, 0, maxTop);
      this.topRow = top;
      const target = top * rh;
      this.sy = this.sy == null ? target : Math.abs(target - this.sy) < 1 ? target : this.sy + (target - this.sy) * 0.4;
      this.lay = { y: L0.y, h: L0.h, rh, sy: this.sy };
      c.save();
      c.beginPath();
      c.rect(L0.x, L0.y, L0.w, L0.h);
      c.clip();
      const from = Math.max(0, Math.floor(this.sy / rh)), to = Math.min(rows.length, from + vis + 2);
      for (let i = from; i < to; i++) {
        const y = Math.round(L0.y + i * rh - this.sy);
        const sel = i === idx;
        if (sel) { R(c, L0.x, y, L0.w, rh, PC.sel); R(c, L0.x, y, 3, rh, PC.selEdge); }
        (o.drawRow || drawRow)(c, rows[i], L0.x, y, L0.w, rh, sel, i);
        R(c, L0.x + 6, y + rh - 1, L0.w - 12, 1, PC.line);
      }
      c.restore();
      if (rows.length > vis) {
        const bh = Math.max(12, Math.round((L0.h * vis) / rows.length));
        const by = L0.y + Math.round(((L0.h - bh) * top) / Math.max(1, maxTop));
        R(c, L0.x + L0.w - 3, L0.y, 3, L0.h, '#e4ddcc');
        R(c, L0.x + L0.w - 3, by, 3, bh, '#a8a090');
      }
    },
  };
}

// Amounts the player picks, given in the era's displayed yen (¥1,000 / ¥10,000 … as people of the
// time would think of them) and turned back into the internal amounts (util.js eraPrice).
const toInternal = (shown) => Math.round(shown / (display.priceRate || 1));

// ======================================================================== icons (32x32, on appTile)
function iconMap(c, x, y, g) {
  appTile(c, x, y, COL.map);
  const d = devOf(g);
  // a folded paper map: three panels, roads, a river
  R(c, x + 5, y + 7, 22, 19, '#4a3a20');
  R(c, x + 6, y + 8, 20, 17, '#f6efd6');
  R(c, x + 12, y + 8, 1, 17, '#d8cba4'); R(c, x + 19, y + 8, 1, 17, '#d8cba4');
  R(c, x + 6, y + 16, 20, 2, '#f0b040'); R(c, x + 15, y + 8, 2, 17, '#f0b040');
  R(c, x + 6, y + 21, 7, 2, '#6ab0e8'); R(c, x + 12, y + 22, 6, 2, '#6ab0e8');
  R(c, x + 7, y + 10, 4, 4, '#8ac87a'); R(c, x + 21, y + 19, 4, 4, '#8ac87a');
  if (d === 'techo') {
    // a route drawn in pencil, and the 手帳's ribbon
    for (let i = 0; i < 5; i++) R(c, x + 8 + i * 3, y + 12 - (i % 2), 2, 1, '#c0392b');
    R(c, x + 23, y + 4, 2, 6, '#c0392b');
  } else {
    // the pin
    disc(c, x + 21, y + 11, 4, '#7a0a1a'); disc(c, x + 21, y + 11, 3, '#e8384f');
    R(c, x + 20, y + 10, 2, 2, '#ffffff'); R(c, x + 21, y + 15, 1, 3, '#7a0a1a');
  }
}
function iconJobs(c, x, y) {
  appTile(c, x, y, COL.jobs);
  // a clapperboard
  R(c, x + 5, y + 13, 22, 14, '#1e1e26'); R(c, x + 6, y + 14, 20, 12, '#2e2e3a');
  for (let i = 0; i < 3; i++) R(c, x + 8, y + 17 + i * 3, 16 - i * 4, 1, '#e8e4d8');
  R(c, x + 5, y + 7, 22, 5, '#1e1e26');
  for (let i = 0; i < 4; i++) R(c, x + 7 + i * 5, y + 8, 3, 3, '#ffffff');
  R(c, x + 5, y + 12, 22, 1, '#ffd23f');
}
function iconDemae(c, x, y, g) {
  appTile(c, x, y, COL.demae);
  if (devOf(g) === 'smart') {
    // a take-out paper bag with a burger on it, and speed lines (it is coming to you)
    R(c, x + 9, y + 10, 18, 17, '#6a4a1a'); R(c, x + 10, y + 11, 16, 15, '#e0b878'); R(c, x + 10, y + 11, 16, 2, '#f0d098');
    R(c, x + 13, y + 6, 1, 5, '#6a4a1a'); R(c, x + 22, y + 6, 1, 5, '#6a4a1a'); R(c, x + 13, y + 6, 10, 1, '#6a4a1a');
    R(c, x + 13, y + 15, 10, 3, '#c8782a'); R(c, x + 12, y + 18, 12, 2, '#5ec44a'); R(c, x + 12, y + 20, 12, 2, '#6a3a1a'); R(c, x + 13, y + 22, 10, 2, '#c8782a');
    R(c, x + 3, y + 13, 5, 1, '#ffffff'); R(c, x + 2, y + 17, 6, 1, '#ffffff'); R(c, x + 4, y + 21, 4, 1, '#ffffff');
    return;
  }
  // a 岡持ち (the delivery box) with a steaming bowl on top
  R(c, x + 6, y + 14, 20, 13, '#5a3418'); R(c, x + 7, y + 15, 18, 11, '#c89a5a'); R(c, x + 7, y + 15, 18, 2, '#e0b878');
  R(c, x + 14, y + 10, 4, 5, '#5a3418'); R(c, x + 10, y + 9, 12, 2, '#5a3418');
  R(c, x + 9, y + 19, 14, 1, '#8a5a32');
  for (let i = 0; i < 3; i++) R(c, x + 10 + i * 5, y + 4 + (i % 2), 1, 3, '#ffffff');
}
function iconTsuhan(c, x, y, g) {
  appTile(c, x, y, COL.tsuhan);
  if (devOf(g) === 'techo') {
    // a catalogue (a thick magazine)
    R(c, x + 7, y + 6, 18, 21, '#3a2a10'); R(c, x + 8, y + 7, 16, 19, '#ffffff');
    R(c, x + 8, y + 7, 16, 5, '#e8384f'); R(c, x + 10, y + 14, 12, 7, '#8ac8e8'); R(c, x + 12, y + 17, 6, 4, '#c87a3a');
    R(c, x + 10, y + 23, 9, 1, '#9a9aaa');
    return;
  }
  // a cardboard box with tape
  R(c, x + 5, y + 10, 22, 16, '#6a4a1a'); R(c, x + 6, y + 11, 20, 14, '#d8a860'); R(c, x + 6, y + 11, 20, 3, '#e8c080');
  R(c, x + 14, y + 11, 4, 14, '#c8a050'); R(c, x + 15, y + 11, 2, 14, '#b88a3a');
  R(c, x + 8, y + 7, 16, 4, '#6a4a1a'); R(c, x + 9, y + 8, 14, 3, '#e8c080');
  R(c, x + 8, y + 20, 5, 3, '#ffffff'); R(c, x + 9, y + 21, 3, 1, '#9a9aaa');
}
function iconBank(c, x, y, g) {
  appTile(c, x, y, COL.bank);
  if (devOf(g) === 'techo') {
    // a 通帳 (passbook)
    R(c, x + 6, y + 7, 20, 18, '#0e3a2a'); R(c, x + 7, y + 8, 18, 16, '#3a9a6a'); R(c, x + 7, y + 8, 18, 2, '#5aba8a');
    R(c, x + 9, y + 12, 14, 1, '#d8f0e0'); R(c, x + 9, y + 15, 10, 1, '#d8f0e0');
    R(c, x + 9, y + 19, 6, 3, '#e8c048');
    return;
  }
  // a bank building with ¥
  R(c, x + 6, y + 11, 20, 2, '#e8e4d8'); R(c, x + 8, y + 8, 16, 3, '#e8e4d8'); R(c, x + 11, y + 6, 10, 2, '#e8e4d8');
  for (let i = 0; i < 4; i++) R(c, x + 8 + i * 5, y + 14, 2, 9, '#e8e4d8');
  R(c, x + 6, y + 23, 20, 3, '#e8e4d8');
  art(c, x + 14, y + 15, ['#.#', '.#.', '###', '.#.'], { '#': '#ffd23f' });
}
function iconNews(c, x, y, g) {
  appTile(c, x, y, COL.news);
  // a folded newspaper
  R(c, x + 5, y + 7, 22, 19, '#2a2a34'); R(c, x + 6, y + 8, 20, 17, '#f4f0e4');
  R(c, x + 7, y + 9, 18, 4, devOf(g) === 'techo' ? '#2a2a34' : '#d6304a');
  R(c, x + 7, y + 15, 8, 6, '#9a9aaa');
  for (let i = 0; i < 4; i++) R(c, x + 17, y + 15 + i * 2, 8, 1, '#5a5a6a');
  R(c, x + 7, y + 22, 18, 1, '#5a5a6a');
}
function iconCamera(c, x, y, g) {
  const d = devOf(g);
  if (d === 'techo') {
    // a disposable film camera (a green paper box)
    appTile(c, x, y, '#2f7a4a');
    R(c, x + 4, y + 10, 24, 15, '#1e1e26'); R(c, x + 5, y + 11, 22, 13, '#f0c020'); R(c, x + 5, y + 18, 22, 6, '#2fa05a');
    disc(c, x + 16, y + 17, 5, '#1e1e26'); disc(c, x + 16, y + 17, 3, '#4a5a8a'); R(c, x + 15, y + 15, 2, 1, '#c8d8ff');
    R(c, x + 6, y + 12, 5, 3, '#c8e8ff'); R(c, x + 22, y + 8, 4, 2, '#1e1e26');
    return;
  }
  appTile(c, x, y, COL.camera);
  R(c, x + 5, y + 10, 22, 15, '#c8ccd8'); R(c, x + 6, y + 11, 20, 13, '#5a5f70');
  R(c, x + 10, y + 8, 7, 3, '#c8ccd8');
  disc(c, x + 16, y + 17, 5, '#c8ccd8'); disc(c, x + 16, y + 17, 4, '#1e1e26'); disc(c, x + 16, y + 17, 2, '#4a6ad8'); R(c, x + 15, y + 15, 1, 1, '#ffffff');
  R(c, x + 22, y + 12, 3, 2, d === 'smart' ? '#ffd23f' : '#e8384f');
}
function iconSettings(c, x, y) {
  appTile(c, x, y, COL.settings);
  // a gear
  disc(c, x + 16, y + 16, 9, '#2a2e3a');
  for (const [dx, dy] of [[0, -11], [0, 11], [-11, 0], [11, 0], [-8, -8], [8, -8], [-8, 8], [8, 8]]) R(c, x + 14 + dx * 0.9, y + 14 + dy * 0.9, 5, 5, '#2a2e3a');
  disc(c, x + 16, y + 16, 8, '#d8dce6');
  for (const [dx, dy] of [[0, -10], [0, 10], [-10, 0], [10, 0], [-7, -7], [7, -7], [-7, 7], [7, 7]]) R(c, x + 15 + dx * 0.9, y + 15 + dy * 0.9, 3, 3, '#d8dce6');
  disc(c, x + 16, y + 16, 4, '#2a2e3a'); disc(c, x + 16, y + 16, 2, COL.settings);
}

// Small dish pictures (24x18 at s = 1) for 出前.
function dishArt(c, x, y, kind, s = 1) {
  const P = (dx, dy, w, h, col) => R(c, x + dx * s, y + dy * s, w * s, h * s, col);
  if (kind === 'pizza') {
    for (let dy = -8; dy <= 8; dy++) { const w = Math.round(Math.sqrt(64 - dy * dy) * 1.3); P(12 - w, 9 + dy, w * 2, 1, '#c07a30'); }
    for (let dy = -7; dy <= 7; dy++) { const w = Math.round(Math.sqrt(49 - dy * dy) * 1.3); P(12 - w, 9 + dy, w * 2, 1, '#ffd870'); }
    for (const [px, py] of [[7, 6], [14, 4], [16, 11], [9, 12], [12, 8]]) P(px, py, 2, 2, '#c0392b');
    P(11, 2, 1, 14, '#e0a050'); P(4, 9, 16, 1, '#e0a050');
    return;
  }
  if (kind === 'sushi') {
    P(1, 12, 22, 4, '#8a5a32'); P(1, 12, 22, 1, '#c89a5a'); P(3, 16, 3, 2, '#5a3418'); P(18, 16, 3, 2, '#5a3418');
    const tops = ['#e8384f', '#ff9a5a', '#ffd23f', '#f4f4f8', '#e8384f'];
    tops.forEach((col, i) => { P(2 + i * 4, 8, 4, 4, '#ffffff'); P(2 + i * 4, 6, 4, 3, col); });
    P(20, 8, 2, 4, '#5ec44a');
    return;
  }
  if (kind === 'burger') {
    P(2, 4, 12, 4, '#d88a3a'); P(3, 3, 10, 1, '#e8a858'); P(4, 4, 1, 1, '#fff0c0'); P(9, 5, 1, 1, '#fff0c0');
    P(1, 8, 14, 2, '#5ec44a'); P(2, 10, 12, 3, '#6a3a1a'); P(2, 13, 12, 3, '#d88a3a');
    P(16, 6, 7, 10, '#d6304a'); P(17, 3, 1, 4, '#ffd23f'); P(19, 2, 1, 5, '#ffd23f'); P(21, 4, 1, 3, '#ffd23f');
    return;
  }
  if (kind === 'curry') {
    P(0, 8, 24, 8, '#e8e8f0'); P(1, 9, 22, 6, '#ffffff');
    P(3, 9, 9, 5, '#fffaf0'); P(11, 9, 10, 5, '#c0702a'); P(13, 10, 3, 2, '#e8a050'); P(17, 11, 2, 2, '#f0d060');
    P(0, 16, 24, 1, '#b8b8c8');
    return;
  }
  // bowls: ramen / soba / don
  const bowl = kind === 'soba' ? '#3a2418' : kind === 'don' ? '#2f5fa8' : '#c0392b';
  const top = kind === 'soba' ? '#a8784a' : kind === 'don' ? '#ffd860' : '#e8a858';
  P(2, 6, 20, 1, '#2a1a12');
  P(1, 7, 22, 3, top);
  if (kind === 'ramen') { P(4, 8, 6, 1, '#fff0a0'); P(15, 7, 4, 2, '#ffffff'); P(16, 7, 2, 1, '#ffd23f'); P(11, 7, 3, 1, '#5ec44a'); }
  if (kind === 'soba') { P(5, 5, 9, 3, '#f0a040'); P(5, 5, 9, 1, '#ffd070'); P(13, 4, 2, 2, '#e8384f'); P(16, 7, 3, 1, '#5ec44a'); }
  if (kind === 'don') { P(4, 7, 14, 2, '#a85a2a'); P(6, 7, 1, 2, '#c87a3a'); P(10, 7, 1, 2, '#c87a3a'); P(14, 7, 1, 2, '#c87a3a'); P(17, 7, 3, 1, '#5ec44a'); }
  P(1, 10, 22, 4, bowl); P(3, 14, 18, 1, shade(bowl, -0.2)); P(5, 15, 14, 1, shade(bowl, -0.45));
  for (let k = 0; k < 5; k++) P(3 + k * 4, 11, 2, 1, kind === 'soba' ? '#c0392b' : '#ffffff');
}

// ======================================================================== マップ（地図）: trips
// The districts and how they hang together: four around 東京 (the town buses, ¥210 a ride from
// the bus stops of tokyo.js / machi.js / minato.js …; via 東京駅前 between two of them) and
// なんば (大阪) by 新幹線 (station.js). ox / oy: where a town lies from 東京 in tiles (taxi
// distances); at: where a bus / taxi drops you (the towns' own bus stops); box: the area on the
// app's schematic map (x, y, w, h in the panel).
const AREAS = {
  tokyo: { name: '東京', full: '東京駅・中央公園', ox: 0, oy: 0, at: [53, 31], box: [80, 36, 64, 32], col: '#4a78d8' },
  machi: { name: '商店街', full: 'ドット商店街', ox: -96, oy: 0, at: [38, 20], box: [6, 38, 64, 28], col: '#e07a1f' },
  minato: { name: 'テレビ局', full: 'テレビ局エリア', ox: 96, oy: 0, at: [35, 28], box: [154, 38, 64, 28], col: '#2f9a4a' },
  nagatacho: { name: '永田町', full: '永田町・霞が関', ox: 0, oy: -70, at: [45, 51], box: [80, 4, 64, 26], col: '#6a5aa8' },
  kanraku: { name: 'ネオン街', full: 'ネオン街', ox: 0, oy: 60, at: [35, 9], box: [80, 74, 64, 26], col: '#c03a88' },
  namba: { name: 'なんば', full: 'なんば（大阪）', osaka: true, ox: 0, oy: 0, at: [22, 30], box: [156, 76, 62, 24], col: '#d6304a' },
};
const AREA_ORDER = ['tokyo', 'machi', 'minato', 'nagatacho', 'kanraku', 'namba'];
const HUB = 'tokyo';
const STATION = { kanto: 'station_tokyo', osaka: 'station_namba' };
const NO_TRIP = new Set(['jikka', 'keimusho']); // the 実家 (its own trip home: family.js), the prison
const BUS_FARE = 210; // the town buses (tokyo.js busToMachi …)
const SHINKANSEN_FARE = 3000; // station.js FARE (read from there when it is loaded)

export function placeLabel(id) {
  const P = PLACES[id];
  let n = '';
  try { n = P && P.name; } catch (e) { n = ''; }
  return String(n || (GUIDE[id] && GUIDE[id].name) || id);
}
const placeShort = (id) => (GUIDE[id] && GUIDE[id].short) || placeLabel(id);
const areaOf = (id) => AREAS[id] || { name: placeShort(id), full: placeLabel(id), ox: 0, oy: 0, col: '#5a6a8a', at: null, box: null };
const regionOf = (town) => (areaOf(town).osaka ? 'osaka' : 'kanto');

// building entity of a place in its town (the first whose cond holds), rebuilt when places change
let BLD = null, BLD_N = 0;
function buildingOf(placeId, g) {
  const n = Object.keys(PLACES).length;
  if (!BLD || BLD_N !== n) {
    BLD = {};
    BLD_N = n;
    for (const p of Object.values(PLACES)) {
      if (!p || p.kind !== 'town' || !p.rooms) continue;
      for (const roomId of Object.keys(p.rooms)) {
        let room = null;
        try { room = buildRoom(p, roomId); } catch (e) { continue; }
        for (const e of (room && room.entities) || []) if (e && e.type === 'building' && e.place) (BLD[e.place] || (BLD[e.place] = [])).push({ e, town: p.id, room: roomId });
      }
    }
  }
  return (BLD[placeId] || []).find((b) => { try { return !b.e.cond || b.e.cond(g); } catch (err) { return false; } }) || null;
}
// A place you can take a trip to: { id, name, area (town id), room, x, y, dir, inside, town }.
// A building is entered directly unless its door has its own check (b.enter: 官邸, 警視庁 …):
// then the taxi stops at that door.
function destOf(g, id) {
  const P = PLACES[id];
  if (!P || NO_TRIP.has(id) || P.noTrip || (GUIDE[id] && GUIDE[id].secret)) return null;
  if (P.kind === 'town') {
    const A = AREAS[id];
    const at = A && A.at ? A.at : [P.start.x, P.start.y];
    return { id, name: A ? A.full : placeLabel(id), area: id, room: A ? 'main' : P.start.room, x: at[0], y: at[1], dir: 'down', inside: false, town: true };
  }
  const b = buildingOf(id, g);
  if (!b) return null;
  const e = b.e;
  const dx = e.door ?? Math.floor(e.w / 2);
  return { id, name: placeLabel(id), area: b.town, room: b.room, x: e.x + dx, y: e.y + e.h, dir: 'up', inside: !e.enter && !!P.start, town: false };
}
// Where the player is now (a building: its door), or null (nowhere a trip starts: the 実家 …).
function hereOf(g) {
  const m = g.map;
  if (!m || !m.place) return null;
  if (m.place.kind === 'town') return { id: m.placeId, area: m.placeId, x: m.player.x, y: m.player.y };
  const d = destOf(g, m.placeId);
  return d ? { id: m.placeId, area: d.area, x: d.x, y: d.y } : null;
}
const visitedOf = (g) => { const v = g.state.flags && g.state.flags.visited; return isObj(v) ? v : {}; };
const known = (g, id) => !!visitedOf(g)[id] || (g.map && g.map.placeId === id);
// Every place the player has been to (and their home), in map order.
const destinations = perFrame(destinationsNow);
function destinationsNow(g) {
  const ids = new Set(Object.keys(visitedOf(g)).filter((k) => visitedOf(g)[k]));
  try { ids.add(g.housing().place); } catch (e) { /* no housing */ }
  if (g.map && g.map.placeId) ids.add(g.map.placeId);
  const list = [];
  for (const id of ids) { const d = destOf(g, id); if (d) list.push(d); }
  const key = (d) => [AREA_ORDER.includes(d.area) ? AREA_ORDER.indexOf(d.area) : 99, d.town ? 0 : 1, GUIDE_ORDER.includes(d.id) ? GUIDE_ORDER.indexOf(d.id) : 999];
  return list.sort((a, b) => { const A = key(a), B = key(b); return A[0] - B[0] || A[1] - B[1] || A[2] - B[2] || a.name.localeCompare(b.name, 'ja'); });
}
function tiles(a, b) {
  const A = areaOf(a.area), B = areaOf(b.area);
  return Math.abs(A.ox + a.x - (B.ox + b.x)) + Math.abs(A.oy + a.y - (B.oy + b.y));
}
// Tokyo taxi fares (since 2022-11-14): ¥500 up to 1.096 km, then ¥100 every 255 m. A tile is
// about 50 m here (a town is 3–4 km across). Internal amounts are today's; each era shows its
// own prices (util.js eraPrice).
export function taxiFare(t) { return 500 + 100 * Math.ceil(Math.max(0, t - 22) / 5); }

// The ways to go from `from` to the place `d`: [{ id, label, short, sub, fare, stamina, hunger, ride, why }]
function tripOptions(g, from, d, shinFare) {
  const out = [];
  const t = tiles(from, d);
  const dv = devOf(g);
  const taxiHow = dv === 'smart' ? '配車アプリで呼ぶ' : dv === 'keitai' ? 'ケータイでタクシー会社に電話' : '大通りで流しのタクシーを拾う';
  if (regionOf(from.area) === regionOf(d.area)) {
    if (from.area === d.area) {
      const far = t > 40;
      out.push({ id: 'walk', label: '歩いて行く', short: '徒歩', fare: 0, stamina: far ? 4 : 2, hunger: far ? 3 : 1, ride: 'walk', sub: far ? '少し遠い' : 'すぐそこ', desc: 'お金はかからないが、少しつかれる。' });
    } else {
      const rides = from.area === HUB || d.area === HUB ? 1 : 2;
      out.push({ id: 'bus', label: 'バスで行く', short: 'バス', fare: BUS_FARE * rides, stamina: 3 * rides, ride: 'bus', sub: rides > 1 ? '東京駅前で乗りかえ' : 'バス停から', desc: 'バス停まで歩くけれど、安い。' });
    }
    out.push({ id: 'taxi', label: 'タクシー', short: 'タクシー', fare: taxiFare(t), stamina: 0, ride: 'taxi', sub: taxiHow, desc: '目の前まで。体力を使わない。' });
  } else {
    const s1 = destOf(g, STATION[regionOf(from.area)]), s2 = destOf(g, STATION[regionOf(d.area)]);
    const legs = (s1 && s1.id !== from.id ? taxiFare(tiles(from, s1)) : 0) + (s2 && s2.id !== d.id ? taxiFare(tiles(s2, d)) : 0);
    out.push({ id: 'shinkansen', label: '新幹線', short: '新幹線', fare: shinFare, stamina: 8, ride: 'shinkansen', sub: '駅までは電車と歩き', desc: '駅までは自分で行く。' });
    out.push({ id: 'shinkansen_taxi', label: '新幹線＋タクシー', short: '新幹線', fare: shinFare + legs, stamina: 3, ride: 'shinkansen', sub: '駅の前後はタクシー', desc: '駅の前後もタクシーで楽に。' });
  }
  const stopped = transportStopped(g);
  for (const o of out) o.why = stopped && o.id !== 'walk' ? '災害の影響で、交通機関が止まっている' : g.state.money < o.fare ? 'お金が足りない…' : g.state.stamina < o.stamina ? '体力が足りない…' : null;
  return out;
}
// Why no trip can start now (null: one can).
function tripBlock(g) {
  const lb = lifeBlock(g);
  if (lb) return lb;
  if (!phoneOverMapOnly(g)) return '（いまは移動できない。用事がすんでからにしよう）';
  const P = g.map && g.map.place;
  if (P && (P.noTrip || P.noSave)) return '（ここからは移動できない）';
  return null;
}
// A disaster near home stops the trains and buses for a few days (regime.js:
// g.regimeTravelBlock() gives the reason, or null): then only walking (and no delivery).
function transportStopped(g) {
  if (typeof g.regimeTravelBlock === 'function') { try { return !!g.regimeTravelBlock(); } catch (e) { console.error(e); } }
  const r = g.state && g.state.regime; // regime.js missing or older: cancelUntil is the last cancelled day, inclusive
  return !!(r && typeof r === 'object' && num(r.cancelUntil) >= (g.state.day || 0) && r.disaster);
}
const mapTitle = (g) => (devOf(g) === 'smart' ? 'マップ' : '地図');

// The trip chooser for one place (other modules: travelTo(g, placeId)). Resolves true when a
// trip was started (the phone then goes away and the ride runs as a script).
export async function travelTo(g, placeId) {
  const d = destOf(g, placeId);
  if (!d || !known(g, placeId)) {
    const hint = GUIDE[placeId] && GUIDE[placeId].hint;
    await phoneInfo(g, { title: mapTitle(g), color: COL.map, text: `まだ行ったことのない場所だ。${hint ? `\n（ヒント：${hint}）` : ''}\n一度行けば、${mapTitle(g)}から移動できる。` });
    return false;
  }
  return tripFlow(g, d);
}
async function tripFlow(g, d) {
  const why = tripBlock(g);
  if (why) { audio.sfx('buzz'); await phoneInfo(g, { title: mapTitle(g), color: COL.map, text: why }); return false; }
  const from = hereOf(g);
  if (!from) {
    audio.sfx('buzz');
    const jikka = g.map && g.map.placeId === 'jikka';
    await phoneInfo(g, { title: mapTitle(g), color: COL.map, text: jikka ? '（ふるさとの実家からは、地図では帰れない。\n玄関から「東京に帰る」で帰ろう）' : '（ここからは移動できない。\nまずは町に出よう）' });
    return false;
  }
  if (from.id === d.id) { audio.sfx('buzz'); await phoneInfo(g, { title: d.name, color: COL.map, text: '（いま、ここにいる）' }); return false; }
  const shinFare = num(EXT.station && EXT.station.FARE, SHINKANSEN_FARE);
  const opts = tripOptions(g, from, d, shinFare);
  const k = await rowsList(g, {
    title: d.name, color: COL.map, rowH: 40, hint: 'A:これで行く　B:もどる',
    items: opts.map((o) => ({ label: o.label, sub: `${o.stamina ? `体力-${o.stamina}・` : ''}${o.sub}`, right: o.fare ? fmtMoney(o.fare) : '無料', rightColor: o.why ? PC.bad : PC.text, disabled: !!o.why, why: o.why })),
    describe: (i) => `${opts[i].desc}${opts[i].why ? `（${opts[i].why}）` : ''}`,
  });
  if (k < 0 || !opts[k] || opts[k].why) return false;
  const o = opts[k];
  closePhoneThen(g, (gg) => doTrip(gg, from, d, o));
  return true;
}
async function doTrip(g, from, d, o) {
  const st = g.state;
  if (st.money < o.fare || st.stamina < o.stamina) { await g.say('（お金か体力が、足りなくなっていた…）'); return; }
  if (o.fare) { g.spend(o.fare); audio.sfx('coin'); }
  if (o.stamina) g.useStamina(o.stamina);
  if (o.hunger) g.addNeed('hunger', -o.hunger);
  const S = appState(g);
  S.stats.trips++;
  S.stats.fares += o.fare;
  await g.fadeOut(12);
  let ride = null;
  const m = EXT.station;
  if (o.ride === 'shinkansen' && m && typeof m.travelScene === 'function') {
    try { ride = m.travelScene(g, { to: areaOf(d.area).full, via: o.id === 'shinkansen_taxi' ? '駅までタクシー → 新幹線 → 駅からタクシー' : '新幹線で', vehicle: 'shinkansen', scenery: 'fuji' }); } catch (e) { console.error(e); ride = null; }
  }
  if (!ride) ride = rideScene(g, { mode: o.ride === 'shinkansen' ? 'taxi' : o.ride, to: d.name, era: eraId(g), sign: areaOf(d.area).name });
  await g.fadeIn(10);
  await ride;
  await g.fadeOut(10);
  const P = PLACES[d.id];
  if (d.inside && P && P.start) await g.goto(d.id, P.start.room, P.start.x, P.start.y, P.start.dir || 'up');
  else await g.goto(d.area, d.room, d.x, d.y, d.dir);
  g.notify(`${d.name}に着いた（${o.short}${o.fare ? ' ' + fmtMoney(o.fare) : ''}）`, { color: '#ffffff' });
  g.save(true);
}

// ---------------------------------------------------------------- the ride (HD 640x360)
const wrapX = (x, span) => ((x % span) + span) % span;
function rideScene(g, o) {
  return new Promise((resolve) => {
    const dur = o.mode === 'walk' ? 100 : 150;
    const sc = {
      hd: true, opaque: true, hidesHud: true, t: 0,
      update(gg) {
        sc.t++;
        if (sc.t === 1) audio.sfx(o.mode === 'walk' ? 'cursor' : o.mode === 'bus' ? 'chime' : 'door');
        const done = gg.auto ? sc.t > 3 : sc.t > dur || (sc.t > 30 && gg.input.pressed('a'));
        if (done) { gg.pop(sc); resolve(); }
      },
      draw(c) { try { drawRide(c, sc.t, o, g); } catch (e) { console.error(e); } },
    };
    g.push(sc);
  });
}
function drawRide(c, t, o, g) {
  const era = o.era || 'reiwa';
  const sp = o.mode === 'walk' ? 1.4 : o.mode === 'bus' ? 4 : 6;
  for (let y = 0; y < 250; y += 10) R(c, 0, y, SW, 10, y < 70 ? '#6cb8ec' : y < 150 ? '#8fcbf2' : '#b8e2fb');
  for (let i = 0; i < 5; i++) {
    const x = wrapX(i * 151 - t * 0.3, SW + 120) - 60, y = 40 + (i % 3) * 22;
    R(c, x, y, 64, 10, '#ffffff'); R(c, x + 12, y - 8, 36, 8, '#ffffff'); R(c, x + 6, y + 10, 50, 4, 'rgba(200,220,240,0.8)');
  }
  // far buildings
  for (let i = 0; i < 18; i++) {
    const w = 40 + Math.floor(hash2(i, 1, 7) * 40), h = 60 + Math.floor(hash2(i, 2, 7) * 100);
    const x = wrapX(i * 52 - t * sp * 0.25, SW + 300) - 120;
    R(c, x, 236 - h, w, h, ['#9aa6c0', '#a8b2c8', '#8e9ab6'][i % 3]);
    for (let wy = 236 - h + 8; wy < 226; wy += 12) for (let wx = 6; wx < w - 6; wx += 10) R(c, x + wx, wy, 4, 5, '#dce6f4');
  }
  R(c, 0, 236, SW, 14, '#9aa2b4'); // the back street between the shops
  // near shops
  const awn = ['#d6304a', '#2f6fd0', '#2f9a4a', '#e0a82e'];
  for (let i = 0; i < 9; i++) {
    const x = wrapX(i * 104 - t * sp * 0.6, SW + 300) - 120, h = 70 + (i % 3) * 16;
    R(c, x, 250 - h, 96, h, ['#ece0c8', '#dcd0e4', '#cfe0d4', '#f2e4cc'][i % 4]);
    R(c, x, 250 - h, 96, 2, '#ffffff');
    R(c, x + 8, 250 - h + 8, 72, 12, '#ffffff'); R(c, x + 12, 250 - h + 12, 30 + (i % 3) * 10, 4, shade(awn[i % 4], -0.2));
    R(c, x, 250 - h + 26, 96, 8, awn[i % 4]);
    for (let k = 0; k < 96; k += 16) R(c, x + k, 250 - h + 26, 8, 8, '#ffffff');
    R(c, x + 8, 212, 34, 30, '#5a6a8a'); R(c, x + 10, 214, 30, 4, '#8a9ac0');
    R(c, x + 56, 206, 24, 44, '#4a3a2a'); R(c, x + 74, 226, 2, 4, '#ffd23f');
  }
  // sidewalk, curb, road
  R(c, 0, 250, SW, 24, '#cfc7b6');
  for (let k = 0; k < 24; k++) R(c, wrapX(k * 32 - t * sp, SW + 32) - 16, 250, 1, 24, '#b6ae9e');
  R(c, 0, 274, SW, 5, '#8a8a92'); R(c, 0, 274, SW, 1, '#b8b8c0');
  R(c, 0, 279, SW, 81, '#575a64');
  for (let k = 0; k < 10; k++) R(c, wrapX(k * 90 - t * sp * 1.3, SW + 90) - 45, 320, 46, 4, '#efefef');
  // lamps (fast, in front of the shops)
  for (let k = 0; k < 5; k++) {
    const x = wrapX(k * 170 - t * sp, SW + 170) - 85;
    R(c, x, 192, 4, 64, '#3a3a44'); R(c, x - 9, 188, 22, 5, '#3a3a44'); R(c, x - 5, 193, 14, 2, '#fff6a8');
  }
  if (o.mode === 'taxi') drawTaxi(c, 228, 304, t, era);
  else if (o.mode === 'bus') drawBus(c, 150, 306, t, era, o.sign);
  else drawWalker(c, 288, 186, t, g);
  R(c, 0, 0, SW, 52, 'rgba(10,14,34,0.55)');
  text(c, fitText(c, `${o.to} へ移動中…`, SW - 40, 20), SW / 2, 8, { size: 20, align: 'center', color: '#fff', outline: '#20232a' });
  const via = { taxi: 'タクシーで', bus: 'バスで', walk: '歩いて' }[o.mode] || '';
  if (via) text(c, via, SW / 2, 32, { size: 12, align: 'center', color: '#fff6a8', outline: '#20232a' });
  if (t > 30) text(c, 'A：とばす', SW - 12, SH - 22, { size: 12, align: 'right', color: '#ffffff', outline: '#20232a' });
}
// A taxi: 昭和 yellow sedan, 平成のはじめ green two-tone, 平成 yellow, 令和 a tall dark-blue wagon.
function drawTaxi(c, x, gy, t, era) {
  const bob = Math.round(Math.sin(t / 4) * 0.8);
  const y = gy - 52 + bob;
  const tall = era === 'reiwa';
  const body = { showa: '#f2c230', heisei_early: '#3a8a4a', heisei: '#f2c230', reiwa: '#20305e' }[era] || '#f2c230';
  const stripe = { showa: '#d6304a', heisei_early: '#f4f0e0', heisei: '#2f6fd0', reiwa: '#c8a24a' }[era] || '#d6304a';
  R(c, x + 8, gy - 3, 168, 6, 'rgba(0,0,0,0.25)');
  R(c, x, y + 18, 184, 28, shade(body, -0.55)); R(c, x + 1, y + 19, 182, 26, body); R(c, x + 1, y + 19, 182, 3, shade(body, 0.3));
  R(c, x + 1, y + 34, 182, 3, stripe);
  const cy = tall ? y - 16 : y;
  const ch = tall ? 35 : 19;
  R(c, x + 36, cy, 116, ch, shade(body, -0.55)); R(c, x + 37, cy + 1, 114, ch - 1, body);
  R(c, x + 44, cy + 4, 46, ch - 7, '#9ac8e8'); R(c, x + 96, cy + 4, 48, ch - 7, '#9ac8e8');
  R(c, x + 44, cy + 4, 46, 2, '#d8eefc'); R(c, x + 96, cy + 4, 48, 2, '#d8eefc');
  R(c, x + 92, cy + 2, 3, ch - 2, shade(body, -0.4));
  R(c, x + 130, cy + 6, 10, 6, '#e8384f'); // the 賃走 plate
  // the roof sign (行灯)
  const ry = cy - 9;
  R(c, x + 74, ry, 34, 10, '#2a2a34'); R(c, x + 75, ry + 1, 32, 8, tall ? '#f4f0e0' : '#ffe48a');
  text(c, 'TAXI', x + 91, ry - 1, { size: 10, align: 'center', color: '#2a2a34', shadow: null });
  R(c, x + 176, y + 23, 7, 7, '#fff6a8'); R(c, x + 1, y + 23, 5, 7, '#e8384f');
  for (const wx of [x + 40, x + 146]) {
    disc(c, wx, gy - 12, 12, '#1e1e26'); disc(c, wx, gy - 12, 6, '#a0a6b0');
    const a = t * 0.5;
    R(c, wx - 1 + Math.round(Math.cos(a) * 4), gy - 13 + Math.round(Math.sin(a) * 4), 2, 2, '#1e1e26');
  }
}
function drawBus(c, x, gy, t, era, sign = '') {
  const bob = Math.round(Math.sin(t / 5) * 0.8);
  const y = gy - 92 + bob;
  const band = era === 'showa' || era === 'heisei_early' ? '#2f8a5e' : '#2f6fd0';
  R(c, x + 8, gy - 3, 330, 6, 'rgba(0,0,0,0.25)');
  R(c, x, y, 340, 80, '#3a3a44'); R(c, x + 1, y + 1, 338, 78, '#efe8d4'); R(c, x + 1, y + 1, 338, 4, '#ffffff');
  R(c, x + 1, y + 54, 338, 10, band); R(c, x + 1, y + 66, 338, 3, shade(band, 0.3));
  for (let k = 0; k < 7; k++) R(c, x + 14 + k * 44, y + 12, 36, 28, '#7aa8d0');
  for (let k = 0; k < 7; k++) R(c, x + 14 + k * 44, y + 12, 36, 3, '#c8e0f4');
  R(c, x + 300, y + 10, 34, 58, '#5a6a8a'); R(c, x + 316, y + 10, 2, 58, '#3a3a44');
  R(c, x + 120, y - 2, 100, 9, '#2a2a34');
  text(c, fitText(c, sign ? `${sign} 行` : '回送', 96, 10), x + 170, y - 4, { size: 10, align: 'center', color: '#ffb03a', shadow: null });
  R(c, x + 334, y + 60, 6, 8, '#fff6a8');
  for (const wx of [x + 60, x + 272]) {
    disc(c, wx, gy - 13, 13, '#1e1e26'); disc(c, wx, gy - 13, 6, '#a0a6b0');
    const a = t * 0.35;
    R(c, wx - 1 + Math.round(Math.cos(a) * 4), gy - 14 + Math.round(Math.sin(a) * 4), 2, 2, '#1e1e26');
  }
}
function drawWalker(c, x, y, t, g) {
  let sh = null;
  try { sh = charSheetHD((g.state && g.state.look) || {}); } catch (e) { sh = null; }
  const frames = sh && (sh.right || sh.down);
  if (!frames || !frames.length) return;
  const im = frames[Math.floor(t / 8) % frames.length];
  R(c, x + 12, y + 84, 40, 4, 'rgba(0,0,0,0.2)');
  c.drawImage(im, 0, 0, im.width, im.height, x, y, 64, 80);
}

// ---------------------------------------------------------------- the app
function townSize(id) {
  const P = PLACES[id];
  if (!P || !P.rooms) return [76, 46];
  try { const r = buildRoom(P, AREAS[id] ? 'main' : P.start.room); return [r.w || 76, r.h || 46]; } catch (e) { return [76, 46]; }
}
function mapPoint(d, px, py) {
  const A = AREAS[d.area];
  if (!A || !A.box) return null;
  const [bx, by, bw, bh] = A.box;
  const [tw, th] = townSize(d.area);
  return [Math.round(px + bx + 4 + clamp(d.x / tw, 0, 1) * (bw - 8)), Math.round(py + by + 13 + clamp(d.y / th, 0, 1) * (bh - 16))];
}
const MAP_H = 106;
function drawMapPanel(c, a, g, dests, sel, here, t) {
  const dv = devOf(g);
  const paper = dv === 'techo';
  const bg = paper ? '#f2ead0' : '#e6eedd';
  R(c, a.x, a.y, a.w, a.h, bg);
  if (paper) for (let y = a.y + 6; y < a.y + a.h; y += 8) R(c, a.x, y, a.w, 1, '#e6dcbc');
  else for (let k = 0; k < 40; k++) R(c, a.x + Math.floor(hash2(k, 3, 9) * a.w), a.y + Math.floor(hash2(k, 4, 9) * a.h), 6, 4, '#d8e6cc');
  const ink = paper ? '#8a5a2a' : '#ffffff';
  const edge = paper ? '#b08850' : '#e0b040';
  const B = (id) => AREAS[id].box;
  const cy = (id) => a.y + B(id)[1] + B(id)[3] / 2;
  const cx = (id) => a.x + B(id)[0] + B(id)[2] / 2;
  // roads to 東京
  R(c, a.x + 70, cy('tokyo') - 2, 10, 5, edge); R(c, a.x + 70, cy('tokyo') - 1, 10, 3, ink);
  R(c, a.x + 144, cy('tokyo') - 2, 10, 5, edge); R(c, a.x + 144, cy('tokyo') - 1, 10, 3, ink);
  R(c, cx('tokyo') - 2, a.y + 30, 5, 6, edge); R(c, cx('tokyo') - 1, a.y + 30, 3, 6, ink);
  R(c, cx('tokyo') - 2, a.y + 68, 5, 6, edge); R(c, cx('tokyo') - 1, a.y + 68, 3, 6, ink);
  // the 新幹線 to なんば (a dashed line)
  for (let k = 0; k < 6; k++) R(c, a.x + 146 + k * 2, a.y + 70 + k * 2, 2, 2, '#4a5aa0');
  const vis = new Set(dests.map((d) => d.area));
  for (const id of AREA_ORDER) {
    const A = AREAS[id];
    const [bx, by, bw, bh] = A.box;
    const on = vis.has(id);
    const fill = on ? mix(A.col, bg, 0.72) : mix('#a8a8b0', bg, 0.7);
    box(c, a.x + bx, a.y + by, bw, bh, 4, fill, on ? shade(A.col, -0.2) : '#a8a8b0');
    T(c, A.name, a.x + bx + 4, a.y + by + 1, 12, on ? shade(A.col, -0.45) : '#8a8a96');
  }
  // places (dots), the selected one (a pin) and where you are (a ring)
  for (const d of dests) {
    const p = mapPoint(d, a.x, a.y);
    if (!p) continue;
    R(c, p[0] - 1, p[1] - 1, 3, 3, shade(areaOf(d.area).col, -0.35));
  }
  if (here) {
    const p = mapPoint(here, a.x, a.y);
    if (p) {
      const r = 3 + (Math.floor(t / 8) % 3);
      c.globalAlpha = 0.6; disc(c, p[0], p[1], r + 1, '#2f6fd0'); c.globalAlpha = 1;
      disc(c, p[0], p[1], 2, '#ffffff'); R(c, p[0] - 1, p[1] - 1, 3, 3, '#2f6fd0');
    }
  }
  if (sel) {
    const p = mapPoint(sel, a.x, a.y);
    if (p) {
      const bob = Math.floor(t / 10) % 2;
      disc(c, p[0], p[1] - 7 - bob, 4, '#7a0a1a'); disc(c, p[0], p[1] - 7 - bob, 3, '#e8384f');
      R(c, p[0] - 1, p[1] - 8 - bob, 2, 2, '#ffffff'); R(c, p[0], p[1] - 3 - bob, 1, 3, '#7a0a1a');
    }
  }
  R(c, a.x, a.y + a.h - 1, a.w, 1, '#b8b0a0');
}
export async function mapApp(g, opts = {}) {
  const view = panelView(g, {
    title: mapTitle(g), color: COL.map, bg: '#f8f6ee', top: MAP_H, rowH: 34,
    hint: 'A:ここへ行く　B:もどる',
    headerRight: () => `${destinations(g).length}か所`,
    empty: 'まだどこにも行っていない。',
    items() {
      const ds = destinations(g);
      const here = hereOf(g);
      const today = new Set(g.regularsToday().map((id) => REGULARS[id] && REGULARS[id].place));
      let home = null;
      try { home = g.housing().place; } catch (e) { home = null; }
      return ds.map((d) => {
        const A = areaOf(d.area);
        const now = here && here.id === d.id;
        const fare = here && !now && regionOf(here.area) === regionOf(d.area) ? taxiFare(tiles(here, d)) : 0;
        const sub = now ? 'いまいる場所' : today.has(d.id) ? `今日の収録！・${A.name}` : here && regionOf(here.area) !== regionOf(d.area) ? `${A.full}・新幹線で` : `${A.name}・タクシー ${fmtMoney(fare)}`;
        return { d, chip: d.id === home ? ['自宅', '#c0703a'] : [A.name, A.col], label: d.name, sub, subColor: today.has(d.id) ? PC.bad : PC.dim, disabled: now, why: now ? 'いま、ここにいる' : null };
      });
    },
    drawTop(c, area, v, ph) {
      const rows = v.rows();
      const sel = rows[clamp(v.idx, 0, Math.max(0, rows.length - 1))];
      drawMapPanel(c, area, g, rows.map((r) => r.d), sel && sel.d, hereOf(g), ph.t);
    },
    // a tap on the map picks the nearest place
    tapTop(ph, x, y, v) {
      const rows = v.rows();
      let best = -1, bd = 14 * 14;
      rows.forEach((r, i) => {
        const p = mapPoint(r.d, v.area.x, v.area.y);
        if (!p) return;
        const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0 && best !== v.idx) { v.idx = best; audio.sfx('cursor'); }
      return false;
    },
    pick(ph, it, i, v) { ph.run(v, () => tripFlow(g, it.d)); },
  });
  // start on a place: the one asked for, else the first one that is not here
  const rows = view.rows();
  const want = opts.place ? rows.findIndex((r) => r.d.id === opts.place) : rows.findIndex((r) => !r.disabled);
  view.idx = Math.max(0, want);
  return phoneView(g, view);
}

// ======================================================================== お仕事
// Offers waiting for an answer, today's shows, the agency auditions (no agency yet) and every job
// open to you now (guide.js), best first. A job shows where it is and takes you there (マップ).
const SKILL_NAME = { warai: 'お笑い', engi: '演技', uta: '歌', talk: 'トーク' };
const TIER_CHIP = [['だれでも', '#5a9a5a'], ['★30', '#3a8ac0'], ['★250', '#8a5ac8'], ['★1000', '#d07a2a'], ['★2000', '#c0304a']];
function refusalText(v) { return v ? [].concat(v).join('\n') : null; }
function jobBlock(g, j) {
  const def = { id: (j.ids && j.ids[0]) || j.label };
  try {
    if (typeof g.lifeRefusal === 'function') { const w = refusalText(g.lifeRefusal()); if (w) return w; }
    if (typeof g.justiceRefusal === 'function') { const w = refusalText(g.justiceRefusal('job', def)); if (w) return w; }
    if (typeof g.politicsRefusal === 'function') { const w = refusalText(g.politicsRefusal('job', def)); if (w) return w; }
  } catch (e) { console.error(e); }
  return null;
}
const jobRows = perFrame(jobRowsNow);
function jobRowsNow(g) {
  const st = g.state, rows = [];
  for (const m of st.phone.inbox) {
    if (!m || !g.offerOpen(m) || !m.regular || !REGULARS[m.regular]) continue;
    const r = REGULARS[m.regular];
    const left = Math.max(1, OFFER_DAYS - (st.day - num(m.day)));
    const wd = r.weekday >= 0 && r.weekday < 7 ? `毎週${WEEKDAYS[r.weekday]}曜・` : '';
    rows.push({ kind: 'offer', m, chip: ['オファー', '#e07a1f'], label: `『${r.title}』`, sub: `${wd}ギャラ${fmtMoney(r.pay)}・返事まで${left}日`, place: r.place });
  }
  for (const id of g.regularsToday()) {
    const r = REGULARS[id];
    if (!r) continue;
    rows.push({ kind: 'show', id, chip: ['今日', '#d6304a'], label: `『${r.title}』`, sub: `今日は${showWords(r).act}・${placeShort(r.place)}へ`, place: r.place });
  }
  if (!st.agency) {
    for (const au of AUDITIONS) rows.push({ kind: 'aud', au, chip: ['所属', '#2f6fd0'], label: `${placeShort(au.place)}のオーディション`, sub: `${au.how}で受ける・合格で所属`, place: au.place });
  }
  const open = GUIDE_JOBS.filter((j) => { try { return jobOpen(st, j); } catch (e) { return false; } });
  open.sort((a, b) => b.tier - a.tier || GUIDE_ORDER.indexOf(a.place) - GUIDE_ORDER.indexOf(b.place));
  for (const j of open) {
    const why = jobBlock(g, j);
    rows.push({ kind: 'job', j, chip: TIER_CHIP[j.tier] || TIER_CHIP[0], label: j.label, sub: `${placeShort(j.place)}・${SKILL_NAME[j.skill] || ''}${why ? '・いまは無理' : known(g, j.place) ? '' : '・未訪問'}`, subColor: why ? PC.bad : PC.dim, place: j.place, why });
  }
  return rows;
}
async function jobDetail(g, row) {
  const id = row.place;
  const G = GUIDE[id] || {};
  const where = placeLabel(id);
  const lines = [];
  if (row.kind === 'show') { const r = REGULARS[row.id]; lines.push(`今日は『${r.title}』の${showWords(r).day}。`, `${where}へ行こう。（体力 -${r.stamina}）`); }
  else if (row.kind === 'aud') lines.push(`${where}のオーディション（${row.au.how}）。`, '合格すると、その事務所に所属できる。');
  else lines.push(`「${row.j.label}」`, `場所：${where}`, `つかう力：${SKILL_NAME[row.j.skill] || '―'}`);
  if (row.why) lines.push(`（いまは受けられない：${String(row.why).replace(/\n/g, '')}）`);
  const go = known(g, id);
  if (!go && G.hint) lines.push(`（まだ行ったことがない。ヒント：${G.hint}）`);
  const choices = go ? ['ここへ行く', 'もどる'] : ['もどる'];
  const k = await phoneConfirm(g, { title: placeShort(id), color: COL.jobs, text: lines.join('\n'), choices });
  if (go && k === 0) return travelTo(g, id);
  return false;
}
export async function jobsApp(g) {
  return phoneView(g, panelView(g, {
    title: 'お仕事', color: COL.jobs, rowH: 38, top: 0,
    hint: 'A:くわしく　B:もどる',
    headerRight: () => { const n = jobRows(g).filter((r) => r.kind === 'offer').length; return n ? `オファー${n}` : ''; },
    empty: 'いま受けられるお仕事は、見つからなかった。',
    items: () => jobRows(g),
    pick(ph, it, i, v) {
      ph.run(v, async () => {
        if (it.kind === 'offer') { await readMessage(g, it.m); return; }
        await jobDetail(g, it);
      });
    },
  }));
}

// ======================================================================== 出前（デリバリー）
// A meal brought to you: g.eat (stamina + 満腹) and a little stress relief, like a dish at home
// (cooking.js). Dearer than a konbini bento or cooking (it is the convenience you pay for).
// Where: 昭和〜平成 the order goes by phone to the shop and comes to your home; in 令和 a delivery
// app also brings it to you out in a town (not into a building). Delivery apps (Uber Eats Tokyo
// 2016-09, 出前館 2000-10) charge a fee; the old 出前 did not. 宅配ピザ: Japan since 1985-09-30.
const MENU = [
  { id: 'ramen', name: 'ラーメン', shop: '中華そば屋', price: 1000, heal: 32, fill: 50, stress: 3, art: 'ramen' },
  { id: 'tensoba', name: '天ぷらそば', shop: 'そば処', price: 1100, heal: 30, fill: 45, stress: 4, art: 'soba' },
  { id: 'katsudon', name: 'かつ丼', shop: 'そば処', price: 1200, heal: 42, fill: 60, stress: 3, art: 'don' },
  { id: 'pizza', name: '宅配ピザ（M）', shop: 'ピザ屋', price: 2800, heal: 45, fill: 70, stress: 6, art: 'pizza' },
  { id: 'sushi', name: '特上にぎり', shop: '寿司屋', price: 3500, heal: 50, fill: 55, stress: 12, art: 'sushi' },
  { id: 'burger', name: 'ハンバーガーセット', shop: 'バーガー店', price: 1300, heal: 38, fill: 55, stress: 4, art: 'burger', smart: true },
  { id: 'curry', name: 'バターチキンカレー', shop: 'カレー店', price: 1500, heal: 44, fill: 62, stress: 5, art: 'curry', smart: true },
];
const DELIVERY_FEE = 350; // 令和: a delivery app's 配達手数料 (+ service fee), one per order
const demaeTitle = (g) => (devOf(g) === 'smart' ? 'デリバリー' : '出前');
// Where a meal can come to you now: 'home' | 'town' | null.
function deliveryWhere(g) {
  const m = g.map;
  if (!m || !m.place) return null;
  let home = null;
  try { home = g.housing().place; } catch (e) { home = null; }
  if (m.placeId === home) return 'home';
  if (devOf(g) === 'smart' && m.place.kind === 'town') return 'town';
  return null;
}
function deliveryWhy(g) {
  const lb = lifeBlock(g);
  if (lb) return lb;
  if (transportStopped(g)) return '災害の影響で、いまは配達を休んでいる…。';
  if (deliveryWhere(g)) return null;
  const dv = devOf(g);
  if (dv === 'techo') return '出前は、家の電話でお店にたのんで、\n家まで届けてもらうもの。\n（家にいるときに、たのもう）';
  if (dv === 'keitai') return '出前は、家まで届けてもらうもの。\n（家にいるときに、たのもう）';
  return 'デリバリーは、家か、街なか（建物の外）で\n受け取れる。（建物の中では受け取れない）';
}
const courierOf = (g, it) => {
  if (devOf(g) === 'smart') return { name: '配達員', look: { hair: 'cap', hat: '#1e1e26', hairColor: 'black', skin: 'tan', top: '#2a7a6a', bottom: '#2a2d36' } };
  if (it.art === 'pizza') return { name: 'ピザ屋さん', look: { hair: 'cap', hat: '#d62f2f', hairColor: 'brown', skin: 'fair', top: '#d62f2f', bottom: '#2a2d36' } };
  if (it.art === 'sushi') return { name: '寿司屋さん', look: { ...LOOKS.chef } };
  return { name: `${it.shop}さん`, look: { hair: 'cap', hat: '#f2f2f2', hairColor: 'black', skin: 'fair', top: '#f2f2f2', bottom: '#3b3f48' } };
};
export async function demaeApp(g) {
  const dv = devOf(g);
  for (;;) {
    const items = MENU.filter((it) => !it.smart || dv === 'smart');
    const fee = dv === 'smart' ? DELIVERY_FEE : 0;
    const where = deliveryWhere(g);
    const full = !g.canEat();
    const k = await rowsList(g, {
      title: demaeTitle(g), color: COL.demae, rowH: 38,
      hint: 'A:注文する　B:もどる',
      headerRight: () => (fee ? `配達料${fmtMoney(fee)}` : ''),
      items: items.map((it) => {
        const cost = it.price + fee;
        const why = full ? 'おなかいっぱいだ…' : g.state.money < cost ? 'お金が足りない…' : null;
        return { label: it.name, sub: `${it.shop}・体力+${it.heal}・満腹+${it.fill}`, right: fmtMoney(it.price), rightColor: g.state.money < cost ? PC.bad : PC.text, icon: (c, x, y) => dishArt(c, x, y + 3, it.art, 1), disabled: !!why, why };
      }),
      describe: (i) => `${items[i] ? `ストレス-${items[i].stress}。` : ''}${deliveryWhy(g) ? (dv === 'smart' ? '（ここでは受け取れない。家か、建物の外で）' : '（出前は、家にいるときにたのめる）')
        : where === 'town' ? '（いる場所まで届けてもらえる）' : dv === 'techo' ? '（家の電話で、お店にたのむ）' : dv === 'keitai' ? '（ケータイからお店に電話。家に届く）' : '（アプリで注文。家に届く）'}`,
    });
    if (k < 0) return;
    const it = items[k];
    const why = deliveryWhy(g);
    if (why) { audio.sfx('buzz'); await phoneInfo(g, { title: demaeTitle(g), color: COL.demae, text: why }); continue; }
    if (!g.canEat()) { audio.sfx('buzz'); continue; }
    const cost = it.price + fee;
    if (!g.spend(cost)) { audio.sfx('buzz'); continue; }
    audio.sfx('coin');
    await phoneView(g, deliveryView(g, it, where));
    eatDelivery(g, it);
    return;
  }
}
function eatDelivery(g, it) {
  const st = g.state, L = st.life;
  const b = { stamina: st.stamina, hunger: L.hunger, stress: L.stress };
  g.eat(it.heal, { fill: it.fill, silent: true });
  if (g.ateLast) g.relax({ stress: Math.max(1, Math.round(it.stress * (g.lastEatRatio || 1))) });
  appState(g).stats.meals++;
  const parts = [];
  if (st.stamina - b.stamina) parts.push(`体力+${st.stamina - b.stamina}`);
  if (L.hunger - b.hunger) parts.push(`満腹+${L.hunger - b.hunger}`);
  if (L.stress - b.stress) parts.push(`ストレス${L.stress - b.stress}`);
  g.notify(`${it.name}を食べた！${parts.length ? '　' + parts.join(' ') : ''}`, { color: COL.demae, life: 160 });
}
// Ordering, the wait, the door: an animation inside the phone; any key after it has arrived.
function deliveryView(g, it, where) {
  const dv = devOf(g);
  const who = courierOf(g, it);
  const ARRIVE = 110;
  const line = dv === 'smart'
    ? (where === 'town' ? `${it.name}、お届けにあがりました！` : `（玄関の前に置いて、写真を撮っていった。\n置き配だ）`)
    : `毎度ありがとうございます！\n${it.shop}です。お待たせしました！`;
  const steps = dv === 'smart' ? ['注文', '調理中', '配達中', 'お届け'] : ['電話', '調理中', '出前中', 'ピンポン'];
  return {
    title: demaeTitle(g), color: COL.demae, bg: '#fbf4ea', cancel: true,
    hint() { return this.t >= ARRIVE ? 'A:受け取って食べる' : `${dv === 'techo' ? '待っている' : '配達を待っている'}…`; },
    update(ph, inp) {
      if (this.t === 1) audio.sfx(dv === 'smart' ? 'ok' : 'chime');
      if (this.t === ARRIVE) audio.sfx('chime');
      if (this.t >= ARRIVE && (inp.pressed('a') || inp.pressed('b'))) { audio.sfx('ok'); ph.back(true); }
    },
    draw(c, ph, a) {
      const t = this.t;
      const stage = t < 30 ? 0 : t < 60 ? 1 : t < ARRIVE ? 2 : 3;
      // the order card
      box(c, a.x + 8, a.y + 8, a.w - 16, 40, 5, '#ffffff', '#c8b8a0');
      dishArt(c, a.x + 16, a.y + 14, it.art, 1);
      T(c, fitText(c, it.name, a.w - 70, 14), a.x + 48, a.y + 12, 14, PC.text);
      T(c, fitText(c, `${it.shop}${where === 'town' ? '・いる場所まで' : '・家まで'}`, a.w - 70, 12), a.x + 48, a.y + 30, 12, PC.dim);
      // progress
      const sy = a.y + 60;
      const sw = (a.w - 32) / (steps.length - 1);
      R(c, a.x + 16, sy + 5, a.w - 32, 3, '#e0d4c0');
      const fillW = stage >= 3 ? a.w - 32 : sw * stage + (stage === 2 ? sw * clamp((t - 60) / (ARRIVE - 60), 0, 1) : 0);
      R(c, a.x + 16, sy + 5, Math.round(fillW), 3, COL.demae);
      steps.forEach((s, i) => {
        const x = a.x + 16 + i * sw;
        disc(c, x, sy + 6, 5, i <= stage ? COL.demae : '#d8ccb8');
        disc(c, x, sy + 6, 2, '#ffffff');
        const hw = measure(c, s, 12) / 2;
        T(c, s, clamp(x, a.x + 4 + hw, a.x + a.w - 4 - hw), sy + 16, 12, i === stage ? COL.demae : PC.dim, 'center');
      });
      // the street: a scooter (or a bicycle in 令和) on its way, the door at the end
      const ry = a.y + 116;
      R(c, a.x + 8, ry + 22, a.w - 16, 2, '#b8b0a0');
      if (where === 'town') {
        // out in a town: it comes to you
        let sh = null;
        try { sh = charSheetHD((g.state && g.state.look) || {}); } catch (e) { sh = null; }
        const im = sh && (sh.left || sh.down) && (sh.left || sh.down)[0];
        if (im) c.drawImage(im, 0, 0, im.width, im.height, a.x + a.w - 44, ry - 18, 32, 40);
      } else { R(c, a.x + a.w - 40, ry - 14, 26, 36, '#8a5a32'); R(c, a.x + a.w - 38, ry - 12, 22, 34, '#c89a5a'); R(c, a.x + a.w - 22, ry + 4, 2, 3, '#ffd23f'); }
      const prog = stage < 2 ? 0 : stage === 2 ? (t - 60) / (ARRIVE - 60) : 1;
      const vx = Math.round(a.x + 12 + prog * (a.w - 112));
      if (stage >= 2) {
        const bob = Math.floor(t / 4) % 2;
        if (dv === 'smart') {
          disc(c, vx + 4, ry + 17, 4, '#2a2a34'); disc(c, vx + 22, ry + 17, 4, '#2a2a34');
          R(c, vx + 4, ry + 12, 18, 2, '#5a5f70'); R(c, vx + 10, ry + 4 + bob, 8, 9, '#2a7a6a'); R(c, vx + 6, ry - 4 + bob, 10, 9, '#3fb07a');
          R(c, vx + 14, ry - 1 + bob, 6, 6, '#f0c8a0');
        } else {
          disc(c, vx + 5, ry + 17, 4, '#2a2a34'); disc(c, vx + 23, ry + 17, 4, '#2a2a34');
          R(c, vx + 2, ry + 9, 26, 6, it.art === 'pizza' ? '#d62f2f' : '#e8e4d8'); R(c, vx + 2, ry + 1 + bob, 10, 8, '#8a5a32');
          R(c, vx + 14, ry - 2 + bob, 8, 10, it.art === 'pizza' ? '#d62f2f' : '#f2f2f2'); R(c, vx + 15, ry - 7 + bob, 6, 6, '#f0c8a0');
        }
      } else {
        // the shop's kitchen: a pot on the stove (or the phone ringing at the shop)
        R(c, a.x + 18, ry + 10, 24, 12, '#3a3a44'); R(c, a.x + 20, ry + 4, 20, 8, '#8a929a'); R(c, a.x + 20, ry + 4, 20, 2, '#c8d0d8');
        if (stage === 1) R(c, a.x + 22, ry + 20, 16, 2, t % 8 < 4 ? '#ff7a3a' : '#ffb03a');
        for (let i = 0; i < 3; i++) { const ph2 = (t * 0.4 + i * 6) % 14; c.globalAlpha = Math.max(0, 0.8 - ph2 / 16); R(c, a.x + 24 + i * 6, ry - ph2, 1, 3, '#a89a88'); c.globalAlpha = 1; }
        T(c, stage === 0 ? (dv === 'techo' ? '（ジーコ、ジーコ…）' : '（注文中…）') : '（いま作っています…）', a.x + 50, ry + 4, 12, PC.dim);
      }
      if (stage === 3) {
        // the meal at the door, the courier's words
        dishArt(c, a.x + a.w - 66, ry + 4, it.art, 1);
        const by = ry + 34, bh = a.y + a.h - 6 - by;
        box(c, a.x + 8, by, a.w - 16, bh, 5, '#ffffff', '#c8b8a0');
        box(c, a.x + 14, by + 6, 34, 26, 3, '#ffffff', '#3a3a4a');
        drawFaceHD(c, who.look, a.x + 15, by + 7, 1);
        T(c, who.name, a.x + 54, by + 5, 12, COL.demae);
        wrap(c, line, a.w - 70, 12).slice(0, Math.max(1, Math.floor((bh - 22) / 14))).forEach((l, i) => T(c, l, a.x + 54, by + 21 + i * 14, 12, PC.text));
      }
    },
  };
}

// ======================================================================== 通販（カタログ）
// Furniture through housing.js buyFurniture (the same rules: slots, the bed taken back, the
// delivery note at home) plus shipping; goods, gifts and groceries arrive the next morning.
// 昭和・平成のはじめ: カタログ通販 by phone / postcard, groceries from the local shops (米屋・八百屋の
// 配達); 平成: 通販 and ネットスーパー (from 2001-03); 令和: ネット通販 / ネットスーパー.
// Chilled goods (cake, 豚まん) go by 冷蔵便, which exists from 1988-07.
const SHIP_FURNITURE = 3000;
const SHIP_SMALL = 500;
const SHIP_FOOD = 300;
const tsuhanTitle = (g) => (devOf(g) === 'techo' ? 'カタログ' : '通販');
const CHILLED = new Set(['cake', 'butaman']);
function catalog(g) {
  const dv = devOf(g);
  const cats = [
    { id: 'furniture', label: '家具', sub: `大型の配送・送料${fmtMoney(SHIP_FURNITURE)}`, ship: SHIP_FURNITURE },
    { id: 'goods', label: '本・文具', sub: `ネタ帳や雑誌・送料${fmtMoney(SHIP_SMALL)}`, ship: SHIP_SMALL, items: ['netacho', 'daihon', 'wadai', 'nodoame'] },
    { id: 'gift', label: 'ギフト', sub: `プレゼント用・送料${fmtMoney(SHIP_SMALL)}`, ship: SHIP_SMALL, items: Object.keys(ITEMS).filter((k) => ITEMS[k] && ITEMS[k].gift) },
    { id: 'food', label: dv === 'techo' ? '米屋・八百屋の配達' : 'ネットスーパー', sub: `料理の食材・配達料${fmtMoney(SHIP_FOOD)}`, ship: SHIP_FOOD, items: Object.keys(ITEMS).filter((k) => ITEMS[k] && ITEMS[k].ingredient) },
  ];
  // no 冷蔵便 before 1988-07
  const chill = ym(g) >= 198807;
  for (const c of cats) if (c.items) c.items = c.items.filter((k) => ITEMS[k] && ITEMS[k].price > 0 && (chill || !CHILLED.has(k)));
  return cats.filter((c) => !c.items || c.items.length);
}
export async function tsuhanApp(g) {
  let ci = 0;
  for (;;) {
    const cats = catalog(g);
    const S = appState(g);
    const pending = S.orders.reduce((n, o) => n + o.n, 0);
    const k = await rowsList(g, {
      title: tsuhanTitle(g), color: COL.tsuhan, rowH: 38, index: ci,
      headerRight: () => (pending ? `配達待ち${pending}` : ''),
      items: cats.map((c) => ({ label: c.label, sub: c.sub, chip: [c.id === 'furniture' ? '大型' : c.id === 'food' ? '食材' : c.id === 'gift' ? '贈り物' : '小物', COL.tsuhan] })),
      describe: () => (pending ? `明日の朝に届く：${S.orders.slice(0, 3).map((o) => `${ITEMS[o.item] ? ITEMS[o.item].name : o.item}×${o.n}`).join('、')}${S.orders.length > 3 ? ' ほか' : ''}` : devOf(g) === 'techo' ? '（電話で注文。家具はすぐ、ほかの品物は明日の朝、家に届く）' : '（家具はすぐ、ほかの品物は明日の朝、家に届く）'),
    });
    if (k < 0) return;
    ci = k;
    const lb = lifeBlock(g);
    if (lb) { audio.sfx('buzz'); await phoneInfo(g, { title: tsuhanTitle(g), color: COL.tsuhan, text: lb }); continue; }
    const cat = cats[k];
    if (cat.id === 'furniture') await furnitureShop(g, cat);
    else await goodsShop(g, cat);
  }
}
async function furnitureShop(g, cat) {
  const mod = EXT.housing;
  if (!mod || typeof mod.buyFurniture !== 'function') { await phoneInfo(g, { title: '家具', color: COL.tsuhan, text: '（いまは家具のカタログがない）' }); return; }
  let idx = 0;
  for (;;) {
    const ids = (Array.isArray(mod.FURNITURE_ORDER) ? mod.FURNITURE_ORDER : Object.keys(FURNITURE)).filter((id) => FURNITURE[id]);
    const h = g.housing();
    const owned = Object.keys(g.state.furniture || {}).filter((id) => g.state.furniture[id] && FURNITURE[id]).length;
    const k = await rowsList(g, {
      title: `家具（${owned}/${h.slots}）`, color: COL.tsuhan, rowH: 38, index: idx,
      hint: 'A:注文する　B:もどる',
      items: ids.map((id) => {
        const f = FURNITURE[id];
        const have = g.furnitureOwned(id);
        const cost = f.price + cat.ship;
        return { label: f.name, sub: f.perk || f.desc || '', right: have ? '持っている' : fmtMoney(f.price), rightColor: have ? PC.good : g.state.money < cost ? PC.bad : PC.text, disabled: have, why: have ? 'もう持っている' : null };
      }),
      describe: (i) => `${FURNITURE[ids[i]].desc || ''}（送料${fmtMoney(cat.ship)}）`,
    });
    if (k < 0) return;
    idx = k;
    const id = ids[k], f = FURNITURE[id];
    if (g.state.money < f.price + cat.ship) { audio.sfx('buzz'); await phoneInfo(g, { title: f.name, color: COL.tsuhan, text: `お金が足りない…。\n（${fmtMoney(f.price)}＋送料${fmtMoney(cat.ship)}）` }); continue; }
    const clerk = { name: devOf(g) === 'techo' ? '家具カタログの電話受付' : 'ドット家具 通販係', look: LOOKS.receptionist };
    let ok = false;
    try { ok = await mod.buyFurniture(g, id, clerk); } catch (e) { console.error(e); }
    if (ok) {
      g.addMoney(-Math.min(cat.ship, g.state.money), true);
      appState(g).stats.orders++;
      g.notify(`送料 -${fmtMoney(cat.ship)}`, { color: COL.tsuhan });
    }
  }
}
async function goodsShop(g, cat) {
  let idx = 0;
  for (;;) {
    const ids = cat.items;
    const k = await rowsList(g, {
      title: cat.label, color: COL.tsuhan, rowH: 38, index: idx,
      hint: 'A:注文する　B:もどる',
      items: ids.map((id) => ({ label: ITEMS[id].name, sub: `持っている：${g.state.items[id] || 0}`, right: fmtMoney(ITEMS[id].price), rightColor: g.state.money < ITEMS[id].price + cat.ship ? PC.bad : PC.text })),
      describe: (i) => String(ITEMS[ids[i]].desc || '').split('\n')[0],
    });
    if (k < 0) return;
    idx = k;
    const id = ids[k], it = ITEMS[id];
    const ns = [1, 3, 5].filter((n) => g.state.money >= it.price * n + cat.ship);
    if (!ns.length) { audio.sfx('buzz'); await phoneInfo(g, { title: it.name, color: COL.tsuhan, text: `お金が足りない…。\n（${fmtMoney(it.price)}＋送料${fmtMoney(cat.ship)}）` }); continue; }
    const c = await phoneConfirm(g, {
      title: it.name, color: COL.tsuhan,
      text: `「${it.name}」1つ ${fmtMoney(it.price)}\n送料 ${fmtMoney(cat.ship)}（1回の注文につき）\n明日の朝、家に届く。`,
      choices: [...ns.map((n) => `${n}つ（${fmtMoney(it.price * n + cat.ship)}）`), 'やめる'],
    });
    if (c < 0 || c >= ns.length) continue;
    const n = ns[c];
    if (!g.spend(it.price * n + cat.ship)) { audio.sfx('buzz'); continue; }
    audio.sfx('coin');
    const S = appState(g);
    const same = S.orders.find((o) => o.item === id);
    if (same) same.n += n; else S.orders.push({ item: id, n, day: g.state.day, from: cat.label });
    S.stats.orders++;
    g.notify(`「${it.name}」×${n}を注文した（明日の朝に届く）`, { color: COL.tsuhan });
  }
}
// Morning: yesterday's orders arrive.
function deliverOrders(g) {
  const S = appState(g);
  const due = S.orders.filter((o) => o.day < g.state.day);
  if (!due.length) return;
  S.orders = S.orders.filter((o) => o.day >= g.state.day);
  const names = [];
  for (const o of due) {
    if (!ITEMS[o.item]) continue;
    g.giveItem(o.item, o.n, true);
    names.push(`「${ITEMS[o.item].name}」×${o.n}`);
  }
  if (!names.length) return;
  const dv = devOf(g);
  (g.morningNotes || (g.morningNotes = [])).push(`（${dv === 'techo' ? '注文していた品物' : '通販の荷物'}が届いた：${names.join('、')}）`);
  g.message({ from: dv === 'techo' ? 'カタログ通販' : 'ドット通販', kind: 'bill', receipt: true, read: true, text: `${names.join('、')}をお届けしました。` });
}

// ======================================================================== 銀行（通帳）
// Interest (年率 %, the large banks' posted rates for under ¥3,000,000, [year, month, rate] from that
// month on). Checked: 1年定期 3.39% (1988), 4.10% (1989), 5.57% → 6.08% (end of 1990), 5.78% (1991),
// about 3% (1993), near zero for the following decade, 0.091% → 0.141% (2006, after the zero-rate
// policy ended), 0.4% (2026-02); 普通預金 0.26% (1987–88), 0.5% (1989), 2.08% (1990), 1.5% (1991),
// liberalised 1994-10, 0.001% before 2006 → 0.1% (2006-07), 0.02% (2024-03), 0.2% (2025-02), 0.3%
// (2026-02-02), 0.4% (2026-08-03), 0.5% (2026-11-02: the three megabanks, announced after the 2026-09
// rate rise; Impress Watch / bk.mufg.jp). The other points between them are rounded estimates.
const TEIKI_RATES = [[1987, 1, 3.39], [1989, 6, 4.10], [1990, 3, 5.57], [1990, 10, 6.08], [1991, 7, 5.78], [1992, 1, 4.4], [1993, 1, 3.0], [1994, 1, 2.0], [1995, 4, 1.0], [1995, 10, 0.4], [1997, 1, 0.35], [1998, 1, 0.3], [1999, 3, 0.15], [2001, 3, 0.05], [2002, 1, 0.03], [2006, 8, 0.14], [2007, 3, 0.35], [2009, 1, 0.1], [2010, 1, 0.03], [2016, 4, 0.002], [2024, 4, 0.025], [2024, 9, 0.125], [2025, 3, 0.275], [2026, 2, 0.4]];
const FUTSU_RATES = [[1987, 1, 0.26], [1989, 6, 0.5], [1990, 3, 2.08], [1991, 7, 1.5], [1992, 1, 0.7], [1993, 1, 0.38], [1994, 1, 0.22], [1995, 10, 0.1], [1999, 3, 0.05], [2001, 3, 0.02], [2002, 1, 0.001], [2006, 8, 0.1], [2007, 3, 0.2], [2009, 1, 0.04], [2010, 1, 0.02], [2016, 4, 0.001], [2024, 4, 0.02], [2024, 9, 0.1], [2025, 3, 0.2], [2026, 2, 0.3], [2026, 8, 0.4], [2026, 11, 0.5]];
function rateAt(table, g) {
  const now = ym(g);
  let r = table[0][2];
  for (const [y, m, v] of table) if (y * 100 + m <= now) r = v;
  return r;
}
export const teikiRate = (g) => rateAt(TEIKI_RATES, g);
export const futsuRate = (g) => rateAt(FUTSU_RATES, g);
const pct = (v) => `${v >= 1 ? v.toFixed(2) : v >= 0.01 ? String(+v.toFixed(3)) : String(+v.toFixed(3))}%`;
// Tax on interest: before 1988-04 small savings were tax-free (マル優, up to ¥3,000,000 of
// principal — today's money below: shown in each era's prices); from 1988-04-01 a flat 20%
// (源泉分離課税); from 2013-01-01 20.315% (復興特別所得税, until 2037).
const MARUYU = 5000000; // ¥3,000,000 in 1987 money (昭和 prices are shown ×0.6)
function interestTax(g, gross, principal) {
  const now = ym(g);
  if (now < 198804) return principal <= MARUYU ? 0 : Math.floor(gross * 0.2);
  if (now < 201301) return Math.floor(gross * 0.2);
  if (now < 203801) return Math.floor(gross * 0.20315);
  return Math.floor(gross * 0.2);
}
const taxWords = (g) => { const now = ym(g); return now < 198804 ? '少額なら非課税（マル優）' : now < 201301 ? '利息の20%' : now < 203801 ? '利息の20.315%' : '利息の20%'; };
// The history lines of the bank help, only up to the game's month (no later events in earlier eras).
function taxHistory(g) {
  const now = ym(g);
  const steps = [[198804, '1988年3月までは少額貯蓄の非課税制度「マル優」、1988年4月から一律20%'], [201301, '2013年からは復興特別所得税を加えて20.315%'], [203801, '2038年からはまた20%']];
  const past = steps.filter(([t]) => t <= now).map((x) => x[1]);
  return past.length ? `（${past.join('、')}）` : '';
}
function rateHistory(g) {
  const now = ym(g);
  const steps = [[199001, '1年定期は1990年ごろ6%前後'], [199301, '1993年ごろ3%前後'], [199901, now >= 202404 ? 'その後は長くほぼ0%が続き' : 'その後は長くほぼ0%が続いている'], [202404, '2024年からまた上がりはじめた']];
  const past = steps.filter(([t]) => t <= now).map((x) => x[1]);
  return past.length ? `${past.join('、')}。` : '景気や日本銀行の政策で上がったり下がったりする。';
}
const TERM = 120; // a 1-year deposit: one game year
const CREDIT_EVERY = 60; // 普通預金 interest twice a year
const TEIKI_MIN = 10000;
// The ATM / the counter: 令和 a convenience-store ATM (¥110), 平成 the same (then ¥105:
// shown as about that in 平成 prices), 昭和・平成のはじめ the bank's own counter (no fee, a walk).
function atmOf(g) {
  const dv = devOf(g);
  if (dv === 'smart') return { fee: 110, stamina: 0, where: 'コンビニのATM' };
  if (dv === 'keitai') return { fee: 125, stamina: 0, where: 'コンビニのATM' };
  return { fee: 0, stamina: 3, where: '銀行の窓口・ATM' };
}
const bankTitle = (g) => (devOf(g) === 'techo' ? '通帳' : '銀行');
const BANK = 'ドット銀行';
export function bankBalance(g) {
  const B = appState(g).bank;
  return B.bal + B.time.reduce((s, t) => s + t.amount, 0);
}
export const totalAssets = (g) => Math.max(0, num(g.state.money)) + bankBalance(g);
function bankLog(g, what, amount) {
  const B = appState(g).bank;
  B.log.unshift({ day: g.state.day, what, amount: Math.round(amount), bal: B.bal });
  if (B.log.length > LOG_MAX) B.log.length = LOG_MAX;
}
// Add the days since the last count to the 積数 (sum of the daily balances).
function bankTally(g) {
  const B = appState(g).bank;
  const d = g.state.day;
  if (d > B.lastDay) B.sekisu += B.bal * (d - B.lastDay);
  B.lastDay = d;
}
// Every morning (onMorning below; exported so a test can run the bank's days alone).
export function bankMorning(g) {
  const B = appState(g).bank;
  if (!B.opened) return;
  bankTally(g);
  const d = g.state.day;
  const notes = g.morningNotes || (g.morningNotes = []);
  if (!B.nextCredit) B.nextCredit = d + CREDIT_EVERY;
  if (d >= B.nextCredit) {
    const gross = Math.floor((B.sekisu * futsuRate(g)) / 100 / TERM);
    if (gross > 0) {
      const net = gross - interestTax(g, gross, B.bal);
      B.bal += net;
      B.interest += net;
      bankLog(g, '普通預金の利息', net);
    }
    B.sekisu = 0;
    B.nextCredit = d + CREDIT_EVERY;
  }
  for (const t of B.time.slice()) {
    if (d < t.due) continue;
    const gross = Math.floor((t.amount * t.rate) / 100 * Math.min(1, (t.due - t.start) / TERM));
    const net = gross - interestTax(g, gross, t.amount);
    B.time = B.time.filter((x) => x !== t);
    B.bal += t.amount + net;
    B.interest += net;
    bankLog(g, `定期預金の満期（利息${fmtMoney(net)}）`, t.amount + net);
    notes.push(`（定期預金が満期になった。利息 ${fmtMoney(net)}（税引後）が、普通預金に入った）`);
  }
}
// A bankruptcy opens (crime.js 'bankrupt'): the account is part of the estate (破産財団). The money
// comes out to the hand, where the court's rules (the free cash, the 管財人) apply to it.
function bankBankrupt(g) {
  try {
    const B = appState(g).bank;
    const all = bankBalance(g);
    if (all <= 0) return;
    bankTally(g);
    B.bal = 0;
    B.time = [];
    g.state.money = Math.max(0, num(g.state.money)) + all;
    bankLog(g, '破産手続き（預金は財産として扱われる）', -all);
    (g.morningNotes || (g.morningNotes = [])).push(`（破産手続きが始まり、預金 ${fmtMoney(all)} も財産として扱われることになった）`);
  } catch (e) { console.error(e); }
}
import('./crime.js').then((m) => { if (m && typeof m.onJustice === 'function') m.onJustice('bankrupt', (g) => bankBankrupt(g)); }).catch(() => { /* justice left out */ });

// Amount presets, in the era's shown yen.
const AMOUNTS = [1000, 5000, 10000, 30000, 50000, 100000, 300000, 500000, 1000000, 3000000, 10000000];
async function pickAmount(g, title, max, min = 1, sub = '') {
  const list = AMOUNTS.map(toInternal).filter((n) => n >= min && n <= max);
  const items = list.map((n) => ({ label: fmtMoney(n), sub }));
  if (max >= min && !list.includes(max)) items.push({ label: `全額（${fmtMoney(max)}）`, sub });
  const all = [...list, max];
  if (!items.length) return 0;
  const k = await rowsList(g, { title, color: COL.bank, items, hint: 'A:この金額　B:もどる' });
  return k < 0 ? 0 : all[k];
}
function bankRows(g) {
  const B = appState(g).bank;
  const atm = atmOf(g);
  const cost = atm.fee ? `手数料${fmtMoney(atm.fee)}` : `体力-${atm.stamina}`;
  return [
    { id: 'in', label: '預け入れる', sub: `${atm.where}・${cost}`, chip: ['入金', '#2f9a4a'] },
    { id: 'out', label: '引き出す', sub: `${atm.where}・${cost}`, chip: ['出金', '#d07a2a'], disabled: !B.opened || B.bal <= atm.fee, why: '普通預金にお金がない' },
    { id: 'teiki', label: '定期預金をつくる', sub: `1年・年${pct(teikiRate(g))}・${fmtMoney(TEIKI_MIN)}から`, chip: ['定期', '#2f5f9a'], disabled: !B.opened || B.bal < TEIKI_MIN, why: `普通預金に${fmtMoney(TEIKI_MIN)}以上あればつくれる` },
    { id: 'list', label: `定期預金（${B.time.length}口）`, sub: B.time.length ? `合計${fmtMoney(B.time.reduce((s, t) => s + t.amount, 0))}・解約もできる` : 'まだない', chip: ['一覧', '#5a6a8a'], disabled: !B.time.length, why: '定期預金はまだない' },
    { id: 'log', label: '明細', sub: B.log.length ? `${B.log.length}件` : 'まだ取引はない', chip: ['明細', '#7a7a8a'], disabled: !B.log.length, why: 'まだ取引はない' },
    { id: 'help', label: '金利と税金のこと', sub: '時代でちがう金利と、利息の税金', chip: ['説明', '#9a8a5a'] },
  ];
}
function drawBankCard(c, a, g) {
  const B = appState(g).bank;
  const st = g.state;
  const techo = devOf(g) === 'techo';
  const x = a.x + 8, y = a.y + 6, w = a.w - 16, h = a.h - 12;
  if (techo) {
    // a passbook page: pale green, ruled lines
    box(c, x, y, w, h, 3, '#e8f4e8', '#3a7a5a', { lo: '#c8e0cc' });
    for (let ly = y + 22; ly < y + h - 4; ly += 14) R(c, x + 4, ly, w - 8, 1, '#b8d8c0');
    T(c, `${BANK}　普通預金通帳`, x + 8, y + 4, 12, '#1e5a3a');
  } else {
    box(c, x, y, w, h, 6, '#244a7a', '#0c1e3a', { hi: '#4a76aa', lo: '#163256' });
    T(c, BANK, x + 10, y + 5, 12, '#c8dcf8');
    R(c, x + w - 34, y + 7, 22, 15, '#e0b040'); R(c, x + w - 33, y + 11, 20, 1, '#a07818'); R(c, x + w - 24, y + 8, 1, 13, '#a07818');
  }
  const ink = techo ? '#1e3a2a' : '#ffffff', dim = techo ? '#4a6a5a' : '#a8c0e0';
  T(c, '普通預金', x + 10, y + 24, 12, dim);
  text(c, fmtMoney(B.bal), x + w - 10, y + 22, { size: 16, align: 'right', color: techo ? '#1e3a2a' : '#ffd23f', shadow: techo ? null : '#000' });
  const tsum = B.time.reduce((s, t) => s + t.amount, 0);
  T(c, `定期 ${fmtMoney(tsum)}`, x + 10, y + 44, 12, ink);
  T(c, `所持金 ${fmtMoney(st.money)}`, x + w - 10, y + 44, 12, ink, 'right');
  T(c, fitText(c, `金利 普通${pct(futsuRate(g))}・1年定期${pct(teikiRate(g))}`, w - 20, 12), x + 10, y + 60, 12, dim);
}
export async function bankApp(g) {
  const view = panelView(g, {
    title: bankTitle(g), color: COL.bank, bg: '#f2f4f8', top: 90, rowH: 36,
    hint: 'A:えらぶ　B:もどる',
    items: () => bankRows(g),
    drawTop(c, a) { drawBankCard(c, a, g); },
    pick(ph, it, i, v) { ph.run(v, () => bankAction(g, it.id)); },
  });
  return phoneView(g, view);
}
async function bankAction(g, id) {
  const B = appState(g).bank;
  const st = g.state;
  const atm = atmOf(g);
  if (id === 'help') { await phoneInfo(g, { title: '金利と税金のこと', color: COL.bank, lines: bankHelp(g) }); return; }
  if (id === 'log') {
    await rowsList(g, { title: '明細', color: COL.bank, rowH: 38, items: B.log.map((l) => ({ label: l.what, sub: `${l.day}日目・残高${fmtMoney(l.bal)}`, right: `${l.amount >= 0 ? '+' : '-'}${fmtMoney(Math.abs(l.amount))}`, rightColor: l.amount >= 0 ? PC.good : PC.bad })), hint: 'B:もどる' });
    return;
  }
  if (id === 'list') {
    for (;;) {
      if (!B.time.length) return;
      const k = await rowsList(g, {
        title: '定期預金', color: COL.bank, rowH: 38,
        items: B.time.map((t) => ({ label: `${fmtMoney(t.amount)}（年${pct(t.rate)}）`, sub: `満期 ${t.due}日目（あと${Math.max(0, t.due - st.day)}日）`, right: '解約', rightColor: PC.dim })),
        hint: 'A:解約する　B:もどる',
        describe: (i) => { const t = B.time[i]; const gross = Math.floor((t.amount * t.rate) / 100); return `満期の利息：約${fmtMoney(gross)}（税引前）。途中で解約すると、普通預金なみの金利になる。`; },
      });
      if (k < 0) return;
      const t = B.time[k];
      const lb = lifeBlock(g);
      if (lb) { await phoneInfo(g, { title: bankTitle(g), color: COL.bank, text: lb }); return; }
      const days = Math.max(0, st.day - t.start);
      const gross = Math.floor((t.amount * futsuRate(g)) / 100 * (days / TERM));
      const net = gross - interestTax(g, gross, t.amount);
      const c = await phoneConfirm(g, { title: '中途解約', color: COL.bank, text: `${fmtMoney(t.amount)}の定期預金を解約する？\n満期まであと${Math.max(0, t.due - st.day)}日。\n途中の解約は、普通預金なみの金利（年${pct(futsuRate(g))}）：利息 ${fmtMoney(net)}`, choices: ['解約する', 'やめる'] });
      if (c !== 0) continue;
      bankTally(g);
      B.time = B.time.filter((x) => x !== t);
      B.bal += t.amount + net;
      B.interest += net;
      bankLog(g, '定期預金の中途解約', t.amount + net);
      audio.sfx('coin');
      g.notify(`定期預金を解約した（普通預金 +${fmtMoney(t.amount + net)}）`, { color: COL.bank });
    }
  }
  const lb = lifeBlock(g);
  if (lb) { audio.sfx('buzz'); await phoneInfo(g, { title: bankTitle(g), color: COL.bank, text: lb }); return; }
  if (atm.stamina && st.stamina < atm.stamina) { audio.sfx('buzz'); await phoneInfo(g, { title: bankTitle(g), color: COL.bank, text: '体力が足りない…。\n（銀行まで行く元気がない）' }); return; }
  if (id === 'in') {
    const max = Math.max(0, st.money - 0);
    if (max <= atm.fee) { audio.sfx('buzz'); await phoneInfo(g, { title: '預け入れ', color: COL.bank, text: '預けられるお金がない…。' }); return; }
    const n = await pickAmount(g, '預け入れる金額', max, Math.max(1, atm.fee + 1), atm.fee ? `手数料${fmtMoney(atm.fee)}は口座から` : '');
    if (!n) return;
    if (!g.spend(n)) return;
    if (atm.stamina) g.useStamina(atm.stamina);
    bankTally(g);
    if (!B.opened) { B.opened = st.day; B.nextCredit = st.day + CREDIT_EVERY; }
    B.bal += n - atm.fee;
    bankLog(g, atm.fee ? `預け入れ（${atm.where}・手数料${fmtMoney(atm.fee)}）` : `預け入れ（${atm.where}）`, n - atm.fee);
    audio.sfx('coin');
    g.notify(`普通預金に ${fmtMoney(n - atm.fee)} 預けた`, { color: COL.bank });
    return;
  }
  if (id === 'out') {
    const max = Math.max(0, B.bal - atm.fee);
    if (max <= 0) return;
    const n = await pickAmount(g, '引き出す金額', max, 1, atm.fee ? `手数料${fmtMoney(atm.fee)}` : '');
    if (!n || n + atm.fee > B.bal) return;
    if (atm.stamina) g.useStamina(atm.stamina);
    bankTally(g);
    B.bal -= n + atm.fee;
    st.money += n;
    bankLog(g, atm.fee ? `引き出し（手数料${fmtMoney(atm.fee)}）` : `引き出し（${atm.where}）`, -(n + atm.fee));
    audio.sfx('coin');
    g.notify(`${fmtMoney(n)} 引き出した`, { color: COL.bank });
    return;
  }
  if (id === 'teiki') {
    if (B.bal < TEIKI_MIN) return;
    const rate = teikiRate(g);
    const n = await pickAmount(g, '定期預金にする金額', B.bal, TEIKI_MIN, `1年・年${pct(rate)}`);
    if (!n || n > B.bal) return;
    const gross = Math.floor((n * rate) / 100);
    const c = await phoneConfirm(g, { title: '定期預金', color: COL.bank, text: `${fmtMoney(n)}を1年の定期預金に。\n年${pct(rate)}：満期（${st.day + TERM}日目）の利息は約${fmtMoney(gross)}\n（税金：${taxWords(g)}）`, choices: ['つくる', 'やめる'] });
    if (c !== 0) return;
    if (atm.stamina) g.useStamina(atm.stamina);
    bankTally(g);
    B.bal -= n;
    B.time.push({ id: B.nextId++, amount: n, rate, start: st.day, due: st.day + TERM });
    bankLog(g, `定期預金へ（年${pct(rate)}）`, -n);
    audio.sfx('coin');
    g.notify(`定期預金をつくった（${fmtMoney(n)}・年${pct(rate)}）`, { color: COL.bank });
  }
}
function bankHelp(g) {
  const atm = atmOf(g);
  const dv = devOf(g);
  return [
    `いまの金利（${gameDate(g).year}年・大手銀行の目安）`,
    `　普通預金 年${pct(futsuRate(g))}／1年定期 年${pct(teikiRate(g))}`,
    '',
    '・普通預金の利息は、毎日の残高をもとに、半年ごと（このゲームでは60日ごと）につく。',
    '・定期預金は1年（120日）預けたまま。満期に利息がついて普通預金にもどる。途中で解約すると、普通預金なみの金利になる。',
    `・利息の税金：${taxWords(g)}。${taxHistory(g)}`,
    `・金利は時代で大きく変わる。${rateHistory(g)}`,
    `・お金の出し入れは${atm.where}で${atm.fee ? `（手数料${fmtMoney(atm.fee)}）` : `（${dv === 'techo' ? '銀行まで行く：体力 -' + atm.stamina : ''}）`}。${dv === 'smart' ? '残高の確認や定期預金はアプリでできる。' : dv === 'keitai' ? '残高の確認はケータイでもできる（モバイルバンキングは1999年から）。' : ''}`,
    '・手元の現金は、空き巣などで失うことがある。預金なら安心。',
  ];
}

// ======================================================================== ニュース（新聞）
// One feed of the stories the game already sends: press messages in the inbox (senders that are
// news outlets: ドット芸能ニュース, ニュース, ドット新聞 …; personal notices stay in メッセージ),
// the politics core's news (state.politics.news) and g.govtNews when that core is there.
const PRESS = /ニュース|新聞|週刊|速報|報道|通信/;
const CAT = { ent: ['芸能', '#e0457a'], soc: ['社会', '#3a7ac0'], pol: ['政治', '#5a5aa8'] };
const NEWS_TABS = [['all', 'すべて'], ['ent', '芸能'], ['soc', '社会'], ['pol', '政治']];
const newsTitle = (g) => (devOf(g) === 'techo' ? '新聞' : 'ニュース');
function catOf(from, txt) {
  from = String(from || ''); txt = String(txt || '');
  if (/政治|経済|選挙|国会|内閣|官邸/.test(from)) return 'pol';
  if (/芸能|週刊/.test(from)) return 'ent';
  if (/選挙|国会|内閣|首相|議員|政党|法案|知事|官房|税|予算|政府/.test(txt)) return 'pol';
  if (/番組|視聴率|ファン|ドラマ|ライブ|芸能|タレント|ランキング|収録|映画/.test(txt)) return 'ent';
  return 'soc';
}
export function newsItems(g, opts = {}) {
  const st = g.state, out = [], seen = new Set();
  const S = appState(g);
  const key = (s) => String(s).replace(/\s+/g, '').slice(0, 60);
  const add = (n) => { const k = key(n.text); if (!n.text || seen.has(k)) return; seen.add(k); out.push(n); };
  for (const m of st.phone.inbox) {
    if (!m || m.kind !== 'news' || !PRESS.test(String(m.from || ''))) continue;
    add({ day: num(m.day), text: String(m.text || ''), from: String(m.from), cat: catOf(m.from, m.text), read: !!m.read, msg: m });
  }
  const p = st.politics;
  if (p && Array.isArray(p.news)) {
    for (const n of p.news) if (n && n.text) add({ day: num(n.day), text: String(n.text), from: 'ドット新聞 政治部', cat: 'pol', read: num(n.day) <= S.news.seen });
  }
  if (opts.govt !== false && typeof g.govtNews === 'function') {
    try {
      for (const n of [].concat(g.govtNews(30) || [])) {
        const t = typeof n === 'string' ? n : n && (n.text || n.title);
        if (!t) continue;
        const day = typeof n === 'object' && n ? num(n.day, st.day) : st.day;
        add({ day, text: String(t), from: (n && n.from) || 'ドット新聞 政治部', cat: 'pol', read: day <= S.news.seen });
      }
    } catch (e) { console.error(e); }
  }
  return out.sort((a, b) => b.day - a.day).slice(0, 80);
}
const newsUnread = (g) => newsItems(g, { govt: false }).filter((n) => !n.read).length;
const headline = (s) => String(s).split('\n')[0];
// A news row: the genre chip, day and source on top, the headline on two lines under them.
function drawNewsRow(c, it, x, y, w, rh, sel) {
  const [cn, col] = it.chip;
  rrect(c, x + 8, y + 4, 34, 15, 4, col);
  T(c, cn, x + 25, y + 5, 12, '#ffffff', 'center');
  T(c, fitText(c, it.sub, w - 58 - (it.right ? 34 : 0), 12), x + 48, y + 5, 12, PC.dim);
  if (it.right) T(c, it.right, x + w - 8, y + 5, 12, it.rightColor || PC.bad, 'right');
  const all = wrap(c, it.label, w - 22, 12);
  const lines = all.slice(0, 2);
  if (all.length > 2) lines[1] = fitText(c, lines[1] + '…', w - 22, 12);
  lines.forEach((l, i) => T(c, l, x + 10, y + 22 + i * 14, 12, sel ? '#1a1a28' : PC.text));
}
async function readArticle(g, n) {
  if (n.msg) n.msg.read = true;
  const [cn] = CAT[n.cat] || CAT.soc;
  const d = gameDate(g, n.day);
  await phoneInfo(g, { title: newsTitle(g), color: COL.news, lines: [`【${cn}】${n.from}`, `${n.day}日目（${wareki(d.year, d.month)}）`, '', n.text] });
}
export async function newsApp(g) {
  const S = appState(g);
  const last = S.news.seen;
  S.news.seen = g.state.day;
  const techo = devOf(g) === 'techo';
  const tabY = techo ? 30 : 2;
  const view = panelView(g, {
    title: newsTitle(g), color: COL.news, bg: techo ? '#f4efe0' : '#f6f6f8', top: tabY + 24, rowH: 54, drawRow: drawNewsRow,
    hint: 'A:よむ　←→:ジャンル　B:もどる',
    empty: 'まだニュースはない。',
    items(v) {
      const tab = NEWS_TABS[v.tab || 0][0];
      return newsItems(g).filter((n) => tab === 'all' || n.cat === tab).map((n) => ({
        n, chip: CAT[n.cat] || CAT.soc, label: headline(n.text), sub: `${n.day}日目・${n.from}`,
        right: (n.msg ? !n.read : n.day > last) ? 'NEW' : '', rightColor: PC.bad,
      }));
    },
    update(ph, inp, v) {
      if (inp.repeat('left') || inp.repeat('right')) {
        v.tab = ((v.tab || 0) + (inp.repeat('left') ? 3 : 1)) % 4;
        v.idx = 0; v.sy = null; v.topRow = 0;
        audio.sfx('cursor');
        return true;
      }
      return false;
    },
    tapTop(ph, x, y, v) {
      const a = v.area;
      if (y < a.y + tabY) return false;
      const i = clamp(Math.floor((x - a.x - 4) / ((a.w - 8) / 4)), 0, 3);
      if (i !== (v.tab || 0)) { v.tab = i; v.idx = 0; v.sy = null; v.topRow = 0; audio.sfx('cursor'); }
      return false;
    },
    drawTop(c, a, v) {
      if (techo) {
        // the masthead of the morning paper
        R(c, a.x, a.y, a.w, tabY, '#f4efe0');
        text(c, 'ドット新聞', a.x + 8, a.y + 3, { size: 16, color: '#1e1e26', shadow: null });
        const d = gameDate(g);
        T(c, fitText(c, `${wareki(d.year, d.month)}　朝刊`, a.w - 104, 12), a.x + a.w - 8, a.y + 8, 12, '#4a4a5a', 'right');
        R(c, a.x + 4, a.y + tabY - 3, a.w - 8, 2, '#1e1e26');
      }
      const tw = (a.w - 8) / 4;
      NEWS_TABS.forEach(([id, label], i) => {
        const on = i === (v.tab || 0);
        const x = Math.round(a.x + 4 + i * tw);
        const col = id === 'all' ? COL.news : CAT[id][1];
        box(c, x + 1, a.y + tabY + 2, Math.round(tw) - 2, 20, 4, on ? col : '#ffffff', on ? shade(col, -0.4) : '#c8c4bc');
        T(c, label, x + tw / 2, a.y + tabY + 6, 12, on ? '#ffffff' : PC.text, 'center');
      });
    },
    pick(ph, it, i, v) { ph.run(v, () => readArticle(g, it.n)); },
  });
  view.tab = 0;
  return phoneView(g, view);
}

// ======================================================================== カメラ（写真）
// 昭和・平成のはじめ: a disposable film camera (写ルンです, 1986-07-01: about ¥1,380 then), 27 shots,
// the prints come back the next morning; 平成: a camera phone (写メ, since J-SH04 in 2000-11);
// 令和: the smartphone camera. A photo is the map screen inside the viewfinder, 80x45 pixels with
// at most 16 colours (a palette + 4-bit pixels, about 2.5 KB in the save), plus where and who.
const FILM_SHOTS = 27;
const FILM_PRICE = 2300; // shown ¥1,380 in 昭和 prices (×0.6)
const PHOTO_W = 80, PHOTO_H = 45;
const FRAME = { x: 160, y: 90, w: 320, h: 180 }; // the viewfinder (16:9, the middle of the screen: ×4 → 80x45)
const camTitle = (g) => (devOf(g) === 'techo' ? '写真' : 'カメラ');
const hex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
function medianCut(px, n) {
  let boxes = [px.slice()];
  while (boxes.length < n) {
    let bi = -1, best = 0, ch = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let k = 0; k < 3; k++) {
        let lo = 255, hi = 0;
        for (const p of b) { if (p[k] < lo) lo = p[k]; if (p[k] > hi) hi = p[k]; }
        if (hi - lo > best) { best = hi - lo; bi = i; ch = k; }
      }
    });
    if (bi < 0 || best < 4) break;
    const b = boxes[bi].sort((p, q) => p[ch] - q[ch]);
    const mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  return boxes.map((b) => {
    const s = [0, 0, 0];
    for (const p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return s.map((v) => Math.round(v / Math.max(1, b.length)));
  });
}
function nearest(pal, p) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const q = pal[i];
    const d = (q[0] - p[0]) ** 2 * 3 + (q[1] - p[1]) ** 2 * 4 + (q[2] - p[2]) ** 2 * 2;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}
// The viewfinder area of the screen as it is drawn now → { pal, px } (or null).
function capturePhoto(g, style) {
  const src = g.canvas;
  if (!src || !src.width || typeof btoa !== 'function') return null;
  const S = src.width / SW;
  const [, c] = makeCanvas(PHOTO_W, PHOTO_H);
  c.imageSmoothingEnabled = true;
  try { c.imageSmoothingQuality = 'high'; } catch (e) { /* older browsers */ }
  c.drawImage(src, FRAME.x * S, FRAME.y * S, FRAME.w * S, FRAME.h * S, 0, 0, PHOTO_W, PHOTO_H);
  const d = c.getImageData(0, 0, PHOTO_W, PHOTO_H).data;
  const px = [];
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], gg = d[i + 1], b = d[i + 2];
    if (style === 'film') { r = r * 1.03 + 12; gg = gg * 0.97 + 8; b = b * 0.84 + 6; } // warm prints, lifted blacks
    else if (style === 'keitai') { const l = (r + gg + b) / 3; r = r * 0.8 + l * 0.2 + 4; gg = gg * 0.8 + l * 0.2 + 4; b = b * 0.8 + l * 0.2 + 8; }
    px.push([clamp(Math.round(r), 0, 255), clamp(Math.round(gg), 0, 255), clamp(Math.round(b), 0, 255)]);
  }
  const pal = medianCut(px, style === 'keitai' ? 12 : 16);
  const bytes = new Uint8Array(Math.ceil(px.length / 2));
  px.forEach((p, i) => { const k = nearest(pal, p); if (i & 1) bytes[i >> 1] |= k; else bytes[i >> 1] = k << 4; });
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return { pal: pal.map((q) => hex2(q[0]) + hex2(q[1]) + hex2(q[2])).join(''), px: btoa(bin) };
}
const PHOTO_CACHE = new Map();
function photoCanvas(p) {
  const key = `${p.id}:${p.px.length}:${p.pal}`;
  if (PHOTO_CACHE.has(key)) return PHOTO_CACHE.get(key);
  let cv = null;
  try {
    const [canvas, c] = makeCanvas(p.w, p.h);
    const img = c.createImageData(p.w, p.h);
    const pal = [];
    for (let i = 0; i + 6 <= p.pal.length; i += 6) pal.push([parseInt(p.pal.slice(i, i + 2), 16), parseInt(p.pal.slice(i + 2, i + 4), 16), parseInt(p.pal.slice(i + 4, i + 6), 16)]);
    const bin = atob(p.px);
    for (let i = 0; i < p.w * p.h; i++) {
      const b = bin.charCodeAt(i >> 1) || 0;
      const q = pal[i & 1 ? b & 15 : b >> 4] || [0, 0, 0];
      img.data[i * 4] = q[0]; img.data[i * 4 + 1] = q[1]; img.data[i * 4 + 2] = q[2]; img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    cv = canvas;
  } catch (e) { console.error(e); cv = null; }
  if (PHOTO_CACHE.size > 60) PHOTO_CACHE.clear();
  PHOTO_CACHE.set(key, cv);
  return cv;
}
const developed = (g, p) => !p.dev || p.dev <= g.state.day;
// Who is in the frame: the people (registered persons) whose NPC stands inside it.
function whoInFrame(g) {
  const m = g.map, out = [];
  if (!m || !Array.isArray(m.entities)) return out;
  const U = SW / 320;
  for (const e of m.entities) {
    if (!e || e.type !== 'npc' || !e.person || !PEOPLE[e.person]) continue;
    try { if (typeof m.visible === 'function' && !m.visible(e)) continue; } catch (err) { continue; }
    const sx = (num(e.px) + 8 - m.cam.x) * U, sy = (num(e.py) + 8 - m.cam.y) * U;
    if (sx < FRAME.x || sx > FRAME.x + FRAME.w || sy < FRAME.y || sy > FRAME.y + FRAME.h) continue;
    const def = PEOPLE[e.person];
    const n = def.short || def.name;
    if (n && !out.includes(n)) out.push(n);
  }
  return out.slice(0, 3);
}
function cameraScene(g) {
  const dv = devOf(g);
  const style = dv === 'techo' ? 'film' : dv;
  const map = g.map;
  const base = { x: map.cam.x, y: map.cam.y };
  const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  return new Promise((resolve) => {
    const sc = {
      hd: true, hidesHud: true, t: 0, mode: 'aim', pan: { x: 0, y: 0 }, flash: 0, photo: null, shotT: 0,
      update(gg) {
        sc.t++;
        const inp = gg.input;
        if (sc.mode === 'aim') {
          if (gg.auto) { if (sc.t > 2) sc.shoot(gg); return; }
          const d = inp.dir();
          if (d && DIR[d]) { sc.pan.x = clamp(sc.pan.x + DIR[d][0] * 2, -56, 56); sc.pan.y = clamp(sc.pan.y + DIR[d][1] * 2, -36, 36); }
          map.cam.x = Math.round(base.x + sc.pan.x); map.cam.y = Math.round(base.y + sc.pan.y);
          if (inp.pressed('a') && sc.t > 6) sc.shoot(gg);
          else if (inp.pressed('b') || inp.pressed('menu')) { audio.sfx('cancel'); sc.finish(gg, null); }
        } else if (sc.mode === 'shot') {
          if (sc.flash > 0) sc.flash--;
          if (gg.auto || sc.t - sc.shotT > 46) sc.finish(gg, sc.photo);
        }
      },
      shoot(gg) {
        sc.mode = 'capture';
        sc.stash = { toasts: gg.toasts, banner: gg.banner };
        gg.toasts = [];
        gg.banner = null;
        audio.sfx('shutter');
      },
      finish(gg, photo) {
        map.cam.x = base.x; map.cam.y = base.y;
        gg.pop(sc);
        resolve(photo);
      },
      draw(ctx, gg) {
        if (sc.mode === 'capture') {
          let shot = null;
          try { shot = capturePhoto(gg, style); } catch (e) { console.error(e); }
          sc.photo = shot ? { ...shot, who: whoInFrame(gg) } : null;
          gg.toasts = sc.stash.toasts; gg.banner = sc.stash.banner;
          sc.mode = 'shot'; sc.shotT = sc.t; sc.flash = 10;
        }
        drawViewfinder(ctx, gg, sc, dv);
      },
    };
    g.push(sc);
  });
}
function drawViewfinder(c, g, sc, dv) {
  const F = FRAME;
  const shade0 = dv === 'techo' ? 'rgba(8,6,4,0.92)' : dv === 'keitai' ? 'rgba(40,44,52,0.94)' : 'rgba(0,0,0,0.6)';
  R(c, 0, 0, SW, F.y, shade0); R(c, 0, F.y + F.h, SW, SH - F.y - F.h, shade0);
  R(c, 0, F.y, F.x, F.h, shade0); R(c, F.x + F.w, F.y, SW - F.x - F.w, F.h, shade0);
  const S = appState(g);
  if (dv === 'techo') {
    // looking through a film camera: dark rounded corners, the counter
    for (let i = 0; i < 10; i++) { c.globalAlpha = 0.08; R(c, F.x, F.y, F.w, i * 2, '#000'); R(c, F.x, F.y + F.h - i * 2, F.w, i * 2, '#000'); c.globalAlpha = 1; }
    R(c, F.x - 1, F.y - 1, F.w + 2, 1, '#6a6a6a'); R(c, F.x - 1, F.y + F.h, F.w + 2, 1, '#6a6a6a');
    text(c, `のこり ${pad2(Math.max(0, S.film))}`, SW - 16, 4, { size: 12, align: 'right', color: '#ff9a3c', shadow: null });
    text(c, '使い捨てカメラ', 16, 4, { size: 12, color: '#c8c0a8', shadow: null });
  } else {
    const col = dv === 'keitai' ? '#7ae07a' : '#ffffff';
    const L = 18;
    for (const [x, y, sx, sy] of [[F.x, F.y, 1, 1], [F.x + F.w, F.y, -1, 1], [F.x, F.y + F.h, 1, -1], [F.x + F.w, F.y + F.h, -1, -1]]) {
      R(c, x + (sx < 0 ? -L : 0), y + (sy < 0 ? -2 : 0), L, 2, col);
      R(c, x + (sx < 0 ? -2 : 0), y + (sy < 0 ? -L : 0), 2, L, col);
    }
    const pulse = Math.floor(sc.t / 15) % 2;
    const fx = SW / 2, fy = SH / 2;
    const fc = sc.mode === 'aim' ? (pulse ? '#ffd23f' : '#ffe88a') : '#5ee07a';
    R(c, fx - 30, fy - 20, 10, 2, fc); R(c, fx - 30, fy - 20, 2, 10, fc); R(c, fx + 20, fy - 20, 10, 2, fc); R(c, fx + 28, fy - 20, 2, 10, fc);
    R(c, fx - 30, fy + 18, 10, 2, fc); R(c, fx - 30, fy + 10, 2, 10, fc); R(c, fx + 20, fy + 18, 10, 2, fc); R(c, fx + 28, fy + 10, 2, 10, fc);
    text(c, dv === 'keitai' ? 'カメラ　1.3M' : '写真', 16, 4, { size: 12, color: col, shadow: '#000' });
    if (dv === 'smart') { disc(c, SW - 20, SH / 2, 12, '#ffffff'); disc(c, SW - 20, SH / 2, 9, '#2a2a34'); disc(c, SW - 20, SH / 2, 7, sc.mode === 'aim' ? '#ffffff' : '#e8384f'); }
    else text(c, '[決定]で撮影', SW - 16, 4, { size: 12, align: 'right', color: col, shadow: '#000' });
  }
  const hint = sc.mode === 'aim' ? 'A:撮る　↑↓←→:向きを変える　B:やめる' : dv === 'techo' ? 'パシャ！（現像は明日の朝）' : 'パシャ！';
  text(c, hint, SW / 2, SH - 19, { size: 12, align: 'center', color: '#ffffff', shadow: '#000' });
  if (sc.flash > 0) { c.globalAlpha = sc.flash / 10; R(c, 0, 0, SW, SH, '#ffffff'); c.globalAlpha = 1; }
  if (sc.mode === 'shot' && sc.photo && dv !== 'techo') {
    const cv = photoCanvas({ id: -1, w: PHOTO_W, h: PHOTO_H, ...sc.photo });
    if (cv) { box(c, F.x + 8, F.y + F.h - 64, PHOTO_W + 12, PHOTO_H + 12, 3, '#ffffff', '#2a2a34'); c.drawImage(cv, F.x + 14, F.y + F.h - 58); }
  }
}
function caption(p) {
  return `${p.name}で${p.who && p.who.length ? `${p.who.join('・')}と` : ''}`;
}
async function shootFlow(g) {
  const S = appState(g);
  const why = lifeBlock(g) || (!phoneOverMapOnly(g) ? '（いまは写真を撮れない。用事がすんでからにしよう）' : null);
  if (why) { audio.sfx('buzz'); await phoneInfo(g, { title: camTitle(g), color: COL.camera, text: why }); return; }
  if (S.album.length >= ALBUM_MAX) { audio.sfx('buzz'); await phoneInfo(g, { title: camTitle(g), color: COL.camera, text: `アルバムがいっぱいだ（${ALBUM_MAX}枚）。\nいらない写真を消してから撮ろう。` }); return; }
  const dv = devOf(g);
  if (dv === 'techo' && S.film <= 0) {
    const c = await phoneConfirm(g, { title: '使い捨てカメラ', color: COL.camera, text: `フィルムを使いきっている。\n新しい使い捨てカメラ（${FILM_SHOTS}枚撮り）を買う？\n${fmtMoney(FILM_PRICE)}（現像代こみ）`, choices: ['買う', 'やめる'] });
    if (c !== 0) return;
    if (!g.spend(FILM_PRICE)) { audio.sfx('buzz'); await phoneInfo(g, { title: '使い捨てカメラ', color: COL.camera, text: 'お金が足りない…。' }); return; }
    audio.sfx('coin');
    S.film = FILM_SHOTS;
  }
  closePhoneThen(g, async (gg) => {
    const shot = await cameraScene(gg);
    if (!shot) return;
    const st = gg.state;
    const pid = gg.map && gg.map.placeId;
    const photo = { id: S.photoId++, day: st.day, place: pid, name: placeLabel(pid), who: shot.who || [], w: PHOTO_W, h: PHOTO_H, pal: shot.pal, px: shot.px, dev: dv === 'techo' ? st.day + 1 : 0, seen: dv === 'techo' ? false : true };
    S.album.unshift(photo);
    S.stats.photos++;
    if (dv === 'techo') {
      S.film = Math.max(0, S.film - 1);
      gg.notify(`写真を撮った（のこり${S.film}枚・現像は明日の朝）`, { color: '#ffffff' });
      return;
    }
    await phoneView(gg, photoView(gg, photo));
  });
}
// The album: a "撮る" tile and the photos (newest first), two to a row.
const CELL_W = 104, CELL_H = 72;
function albumView(g) {
  return {
    title: camTitle(g), color: COL.camera, bg: '#2a2a32', idx: 0, topRow: 0, sy: 0, cancel: -1,
    hint: 'A:えらぶ　B:もどる',
    headerRight: () => `${appState(g).album.length}/${ALBUM_MAX}枚`,
    cells() { return [{ shoot: true }, ...appState(g).album]; },
    enter() { for (const p of appState(g).album) if (developed(g, p)) p.seen = true; },
    update(ph, inp) {
      const cells = this.cells(), n = cells.length;
      const before = this.idx;
      if (inp.repeat('left')) this.idx = (this.idx + n - 1) % n;
      if (inp.repeat('right')) this.idx = (this.idx + 1) % n;
      if (inp.repeat('up') && this.idx >= 2) this.idx -= 2;
      if (inp.repeat('down') && this.idx + 2 < n) this.idx += 2;
      if (this.idx !== before) audio.sfx('cursor');
      if (inp.pressed('a')) {
        const cell = cells[this.idx];
        if (!cell) return;
        if (cell.shoot) { audio.sfx('ok'); ph.run(this, () => shootFlow(g)); return; }
        if (!developed(g, cell)) { audio.sfx('buzz'); ph.toast('まだ現像中（明日の朝にあがる）', '#9aa3c7'); return; }
        audio.sfx('ok');
        ph.run(this, () => phoneView(g, photoView(g, cell)));
        return;
      }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); }
    },
    tap(ph, x, y) {
      const a = this.area;
      if (!a) return false;
      const col = Math.floor((x - a.x - 6) / CELL_W), row = Math.floor((y - a.y - 4 + this.sy) / CELL_H);
      const i = row * 2 + clamp(col, 0, 1);
      if (i < 0 || i >= this.cells().length) return false;
      this.idx = i;
      return true;
    },
    draw(c, ph, a) {
      this.area = a;
      const cells = this.cells();
      this.idx = clamp(this.idx, 0, cells.length - 1);
      const vis = Math.max(1, Math.floor((a.h - 4) / CELL_H));
      const row = Math.floor(this.idx / 2);
      if (row < this.topRow) this.topRow = row;
      if (row >= this.topRow + vis) this.topRow = row - vis + 1;
      const target = this.topRow * CELL_H;
      this.sy += (target - this.sy) * 0.4;
      if (Math.abs(target - this.sy) < 1) this.sy = target;
      c.save();
      c.beginPath();
      c.rect(a.x, a.y, a.w, a.h);
      c.clip();
      const dv = devOf(g);
      cells.forEach((cell, i) => {
        const cx = a.x + 6 + (i % 2) * CELL_W, cy = Math.round(a.y + 4 + Math.floor(i / 2) * CELL_H - this.sy);
        if (cy > a.y + a.h || cy + CELL_H < a.y) return;
        const sel = i === this.idx;
        if (sel) {
          const sw = CELL_W - 4, sh = CELL_H - 6;
          R(c, cx - 2, cy - 3, sw + 4, 2, '#ffd23f'); R(c, cx - 2, cy + sh - 1, sw + 4, 2, '#ffd23f');
          R(c, cx - 2, cy - 3, 2, sh + 2, '#ffd23f'); R(c, cx + sw, cy - 3, 2, sh + 2, '#ffd23f');
        }
        if (cell.shoot) {
          box(c, cx + 2, cy, CELL_W - 8, 50, 5, '#3a3a46', '#5a5a6a');
          iconCamera(c, cx + CELL_W / 2 - 20, cy + 9, g);
          T(c, dv === 'techo' ? `撮る（のこり${appState(g).film}）` : '撮る', cx + CELL_W / 2 - 2, cy + 54, 12, '#ffffff', 'center');
          return;
        }
        const ok = developed(g, cell);
        // a print (film) has a white border; a phone photo a thin frame
        const film = dv === 'techo' || cell.dev;
        if (film) R(c, cx + 2, cy, PHOTO_W + 8, PHOTO_H + 8, '#f4f0e6');
        else R(c, cx + 5, cy + 3, PHOTO_W + 2, PHOTO_H + 2, '#5a5a6a');
        if (ok) { const cv = photoCanvas(cell); if (cv) c.drawImage(cv, cx + 6, cy + 4); }
        else {
          R(c, cx + 6, cy + 4, PHOTO_W, PHOTO_H, '#4a4036');
          T(c, '現像中…', cx + 6 + PHOTO_W / 2, cy + 4 + PHOTO_H / 2 - 7, 12, '#e8d8b8', 'center');
        }
        if (ok && !cell.seen) drawNewDot(c, cx + PHOTO_W + 4, cy + 2);
        T(c, fitText(c, `${cell.day}日目 ${cell.name}`, CELL_W - 10, 12), cx + 4, cy + PHOTO_H + 12, 12, '#d8d8e0');
      });
      c.restore();
      if (cells.length === 1) {
        const lines = wrap(c, devOf(g) === 'techo' ? 'まだ写真はない。\n使い捨てカメラで撮った写真は、次の朝に現像があがって、ここに並ぶ。' : 'まだ写真はない。\n撮った写真は、ここに並ぶ。', a.w - 32, 12);
        lines.forEach((l, i) => T(c, l, a.x + a.w / 2, a.y + 96 + i * 16, 12, '#b8b8c8', 'center'));
      }
    },
  };
}
function drawNewDot(c, x, y) { disc(c, x, y, 4, '#7a0a1a'); disc(c, x, y, 3, '#ff3b4f'); }
function photoView(g, photo) {
  return {
    title: camTitle(g), color: COL.camera, bg: '#2a2a32', cancel: -1,
    hint: 'A:メニュー　←→:となり　B:もどる',
    enter() { photo.seen = true; },
    list() { return appState(g).album.filter((p) => developed(g, p)); },
    update(ph, inp) {
      const L = this.list();
      if ((inp.repeat('left') || inp.repeat('right')) && L.length > 1) {
        const i = L.indexOf(photo);
        photo = L[(i + (inp.repeat('left') ? L.length - 1 : 1)) % L.length] || photo;
        photo.seen = true;
        audio.sfx('cursor');
      }
      if (inp.pressed('a')) { audio.sfx('ok'); ph.run(this, async () => { if ((await photoMenu(g, photo)) === 'deleted') ph.back(-1, this); }); return; }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); }
    },
    draw(c, ph, a) {
      const cv = photoCanvas(photo);
      const film = devOf(g) === 'techo' || photo.dev;
      const pw = PHOTO_W * 2, phh = PHOTO_H * 2;
      const px = a.x + Math.round((a.w - pw) / 2), py = a.y + 14;
      if (film) { R(c, px - 8, py - 8, pw + 16, phh + 26, '#f4f0e6'); R(c, px - 8, py + phh + 17, pw + 16, 1, '#d8d0c0'); }
      else { R(c, px - 2, py - 2, pw + 4, phh + 4, '#5a5a6a'); }
      if (cv) c.drawImage(cv, 0, 0, PHOTO_W, PHOTO_H, px, py, pw, phh);
      const d = gameDate(g, photo.day);
      let y = py + phh + (film ? 26 : 10);
      T(c, fitText(c, caption(photo), a.w - 20, 14), a.x + 10, y, 14, '#ffffff'); y += 20;
      T(c, `${photo.day}日目（${wareki(d.year, d.month)}）`, a.x + 10, y, 12, '#b8b8c8'); y += 16;
      if (photo.posted) T(c, `${eraOf(g.state).sns}に載せた写真`, a.x + 10, y, 12, '#ffd23f');
      const L = this.list();
      const i = L.indexOf(photo);
      if (L.length > 1 && i >= 0) T(c, `${i + 1}/${L.length}`, a.x + a.w - 10, a.y + a.h - 18, 12, '#8a8a9a', 'right');
    },
  };
}
const snsVerb = (g) => (devOf(g) === 'smart' ? `${eraOf(g.state).sns}に投稿` : devOf(g) === 'keitai' ? `${eraOf(g.state).sns}に載せる` : '会報に送る');
async function photoMenu(g, photo) {
  const career = EXT.career;
  const can = !!(career && typeof career.canPost === 'function' && typeof career.draftPost === 'function' && typeof career.publishPost === 'function');
  const posted = can && !career.canPost(g);
  const choices = [];
  if (can && !photo.posted) choices.push(posted ? `${snsVerb(g)}（今日はもう投稿した）` : snsVerb(g));
  choices.push('写真を消す', 'もどる');
  const k = await phoneConfirm(g, { title: camTitle(g), color: COL.camera, text: `${caption(photo)}\n${photo.day}日目の写真。`, choices });
  const pickd = choices[k];
  if (!pickd || pickd === 'もどる') return null;
  if (pickd === '写真を消す') {
    const c = await phoneConfirm(g, { title: '写真を消す', color: COL.camera, text: 'この写真を消す？\n（元にはもどせない）', choices: ['消す', 'やめる'] });
    if (c !== 0) return null;
    const S = appState(g);
    S.album = S.album.filter((p) => p !== photo);
    audio.sfx('cancel');
    return 'deleted';
  }
  if (posted || !can) { audio.sfx('buzz'); return null; }
  const work = GUIDE_JOBS.some((j) => j.place === photo.place);
  const food = ['ramen', 'cafe', 'famires', 'takoyaki', 'konbini'].includes(photo.place);
  const topic = photo.who && photo.who.length ? 'off' : work ? 'work' : food ? 'food' : 'off';
  try {
    const draft = career.draftPost(g, topic);
    if (!draft) return null;
    draft.x = `${draft.x}\n（写真：${caption(photo)}）`;
    const res = career.publishPost(g, draft);
    if (!res) return null;
    photo.posted = g.state.day;
    audio.sfx('chime');
    g.notify(`${snsVerb(g)}した！ ファン +${res.gain.toLocaleString('ja-JP')}人`, { color: COLORS.pink });
  } catch (e) { console.error(e); }
  return null;
}
export async function cameraApp(g) { return phoneView(g, albumView(g)); }
const newPhotos = (g) => appState(g).album.filter((p) => developed(g, p) && !p.seen).length;
// Morning: yesterday's film comes back from the shop.
function developFilm(g) {
  const S = appState(g);
  const ready = S.album.filter((p) => p.dev && p.dev <= g.state.day && !p.seen && !p.devNoted);
  if (!ready.length) return;
  for (const p of ready) p.devNoted = true;
  (g.morningNotes || (g.morningNotes = [])).push(`（写真の現像があがった。${ready.length}枚。${camTitle(g)}のアルバムで見られる）`);
}

// ======================================================================== 設定
// Sound (audio.js), text speed (a default speed for g.say / g.ask when the caller gives none),
// the order of the home screen, the controls, and what the era's device is.
const SPEEDS = [['slow', 'ゆっくり', 0.45], ['normal', 'ふつう', null], ['fast', 'はやい', 1.6], ['instant', 'いっしゅん', 99]];
let SPEED = 'normal';
try { const v = localStorage.getItem('dotgeinou_textspeed'); if (SPEEDS.some((s) => s[0] === v)) SPEED = v; } catch (e) { /* storage blocked */ }
export const textSpeed = () => { const s = SPEEDS.find((x) => x[0] === SPEED); return s ? s[2] : null; };
function setTextSpeed(id) {
  if (!SPEEDS.some((s) => s[0] === id)) return;
  SPEED = id;
  try { localStorage.setItem('dotgeinou_textspeed', id); } catch (e) { /* storage blocked */ }
}
(function installTextSpeed() {
  const P = Game && Game.prototype;
  if (!P) return;
  const say = P.say;
  if (typeof say === 'function' && !say.__textSpeed) {
    const f = function (pages, opts) {
      const sp = textSpeed();
      return say.call(this, pages, sp && !(opts && opts.speed != null) ? { ...(opts || {}), speed: sp } : opts);
    };
    f.__textSpeed = true;
    P.say = f;
  }
  const ask = P.ask;
  if (typeof ask === 'function' && !ask.__textSpeed) {
    const f = function (pages, choices, opts) {
      const sp = textSpeed();
      return ask.call(this, pages, choices, sp && !(opts && opts.speed != null) ? { ...(opts || {}), speed: sp } : opts);
    };
    f.__textSpeed = true;
    P.ask = f;
  }
})();
function settingsRows(g) {
  const sp = SPEEDS.find((s) => s[0] === SPEED) || SPEEDS[1];
  const custom = appOrder(g).length > 0;
  return [
    { id: 'sound', label: '音', sub: 'BGMと効果音（Mキーでも）', right: audio.muted ? 'OFF' : 'ON', rightColor: audio.muted ? PC.bad : PC.good, chip: ['音', '#5a8ad8'] },
    { id: 'speed', label: '文字の速さ', sub: 'メッセージが出る速さ', right: sp[1], rightColor: PC.accent, chip: ['文字', '#8a5ac8'] },
    { id: 'order', label: 'アプリの並べかえ', sub: `${devWord(g)}のホーム画面の順番`, chip: ['並び', '#2f9a4a'] },
    { id: 'reset', label: '並びを元にもどす', sub: custom ? '最初の順番にもどす' : 'いまは最初の順番', chip: ['並び', '#7a8a7a'], disabled: !custom, why: 'いまは最初の順番' },
    { id: 'keys', label: '操作のしかた', sub: 'キーボード・タッチ', chip: ['操作', '#c0703a'] },
    { id: 'about', label: `この${devWord(g)}のこと`, sub: eraOf(g.state).label, chip: ['時代', '#9a8a5a'] },
  ];
}
export async function settingsApp(g) {
  return rowsList(g, {
    title: '設定', color: COL.settings, rowH: 38,
    items: () => settingsRows(g),
    hint: 'A:えらぶ　B:もどる',
    pick(ph, it, i, v) {
      if (it.id === 'sound') { audio.toggleMute(); audio.sfx('ok'); return; }
      if (it.id === 'speed') { const k = SPEEDS.findIndex((s) => s[0] === SPEED); setTextSpeed(SPEEDS[(k + 1) % SPEEDS.length][0]); audio.sfx('cursor'); return; }
      if (it.id === 'reset') { setAppOrder(g, null); ph.toast('アプリの並びを元にもどした', COL.settings); return; }
      if (it.id === 'order') { ph.run(v, () => phoneView(g, reorderView(g))); return; }
      if (it.id === 'keys') { ph.run(v, () => phoneInfo(g, { title: '操作のしかた', color: COL.settings, lines: controlsHelp(g) })); return; }
      if (it.id === 'about') ph.run(v, () => phoneInfo(g, { title: `この${devWord(g)}のこと`, color: COL.settings, lines: deviceAbout(g) }));
    },
  });
}
function controlsHelp(g) {
  const dw = devWord(g);
  return [
    '― キーボード ―',
    '移動・えらぶ：矢印キー／WASD',
    'A（けってい・話す）：Z／Enter／スペース',
    'B（もどる・走る）：X／Shift／Backspace',
    'メニュー：Esc／C／Q　音：M',
    '',
    '― タッチ ―',
    '左下の十字キーで移動、A／B／MENUボタン。画面をタップするとA。',
    `${dw}の中では、アイコンや行をタップして選べる。下の丸いボタンか、左上の「<」でもどる。`,
    '',
    `― ${dw} ―`,
    'ホーム画面は12こずつのページ。←→で次のページへ（下の点をタップしても）。',
    '「設定」の「アプリの並べかえ」で、好きな順番にできる。',
  ];
}
function deviceAbout(g) {
  const e = eraId(g);
  if (e === 'showa') return ['昭和の終わり：手帳と電話の時代。', '予定も地図も、手帳に書きこむ。電話は家の電話か公衆電話。', '出前は家の電話でたのむ。買い物はカタログ通販。', 'お金の出し入れは銀行（窓口かATM）まで行く。', '写真は使い捨てカメラ（1986年発売）。現像は次の日。', '新聞で世の中のことを知る。'];
  if (e === 'heisei_early') return ['平成のはじめ：手帳とポケベルの時代。', 'ポケベルで呼ばれたら、公衆電話へ走る。予定と地図は手帳に。', '出前は家の電話で。買い物はカタログ通販。', 'お金の出し入れは銀行の窓口かATMで。', '写真は使い捨てカメラ。プリントは次の日にあがる。', 'ニュースは新聞とテレビ。'];
  if (e === 'heisei') return ['平成のなかごろ：ケータイの時代。', 'iモード（1999年）などで、ケータイからネットが使える。', 'カメラつきケータイ（2000年〜）で「写メ」。', '出前はケータイで電話。ネット通販やネットスーパー（2001年〜）も。', 'お金の出し入れはコンビニのATMでも。'];
  return ['令和：スマホの時代。', '地図アプリ、配車アプリ、デリバリーアプリ。', '銀行もアプリで、残高の確認や定期預金。', 'カメラで撮って、すぐSNSへ。', 'ニュースもスマホで読む。'];
}
// Reorder the home screen: A picks an app up, ↑↓ moves it, A puts it down.
function reorderView(g) {
  return {
    title: 'アプリの並べかえ', color: COL.settings, idx: 0, held: false, sy: 0, topRow: 0, cancel: -1,
    hint() { return this.held ? '↑↓:動かす　A:ここに置く' : '↑↓:えらぶ　A:つかむ　B:もどる'; },
    move(d) {
      const ids = phoneApps(g).map((a) => a.id);
      const j = this.idx + d;
      if (j < 0 || j >= ids.length) return;
      [ids[this.idx], ids[j]] = [ids[j], ids[this.idx]];
      setAppOrder(g, ids);
      this.idx = j;
      audio.sfx('cursor');
    },
    update(ph, inp) {
      const n = phoneApps(g).length;
      if (!n) { if (inp.pressed('b')) ph.back(-1); return; }
      this.idx = clamp(this.idx, 0, n - 1);
      if (this.held) {
        if (inp.repeat('up')) this.move(-1);
        if (inp.repeat('down')) this.move(1);
        if (inp.pressed('a') || inp.pressed('b')) { this.held = false; audio.sfx('ok'); }
        return;
      }
      const before = this.idx;
      if (inp.repeat('up')) this.idx = (this.idx + n - 1) % n;
      if (inp.repeat('down')) this.idx = (this.idx + 1) % n;
      if (before !== this.idx) audio.sfx('cursor');
      if (inp.pressed('a')) { this.held = true; audio.sfx('ok'); return; }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); }
    },
    tap(ph, x, y) {
      const a = this.area;
      if (!a) return false;
      const i = Math.floor((y - a.y + this.sy) / 36);
      const n = phoneApps(g).length;
      if (i < 0 || i >= n) return false;
      if (this.held) { while (this.idx !== i) this.move(i > this.idx ? 1 : -1); this.held = false; audio.sfx('ok'); } else { this.idx = i; this.held = true; audio.sfx('ok'); }
      return false;
    },
    draw(c, ph, a) {
      this.area = a;
      const apps = phoneApps(g);
      const rh = 36;
      const vis = Math.max(1, Math.floor(a.h / rh));
      if (this.idx < this.topRow) this.topRow = this.idx;
      if (this.idx >= this.topRow + vis) this.topRow = this.idx - vis + 1;
      const target = this.topRow * rh;
      this.sy += (target - this.sy) * 0.4;
      if (Math.abs(target - this.sy) < 1) this.sy = target;
      c.save();
      c.beginPath();
      c.rect(a.x, a.y, a.w, a.h);
      c.clip();
      apps.forEach((app, i) => {
        const y = Math.round(a.y + i * rh - this.sy);
        if (y > a.y + a.h || y + rh < a.y) return;
        const sel = i === this.idx;
        if (sel) { R(c, a.x, y, a.w, rh, this.held ? '#ffe08a' : PC.sel); R(c, a.x, y, 3, rh, this.held ? PC.accent : PC.selEdge); }
        const ox = sel && this.held ? 6 : 0;
        drawAppIcon(c, a.x + 10 + ox, y + 2, app, g);
        T(c, fitText(c, appName(app, g), a.w - 120, 14), a.x + 48 + ox, y + 10, 14, PC.text);
        T(c, `${Math.floor(i / 12) + 1}ページ`, a.x + a.w - 10, y + 12, 12, PC.dim, 'right');
        R(c, a.x + 6, y + rh - 1, a.w - 12, 1, PC.line);
      });
      c.restore();
    },
  };
}

// ======================================================================== registration
const offersWaiting = (g) => g.state.phone.inbox.filter((m) => m && g.offerOpen(m) && m.regular && REGULARS[m.regular]).length;
registerPhoneApp('map', { name: (g) => mapTitle(g), color: COL.map, order: 32, iconHD: iconMap, open: (g) => mapApp(g) });
registerPhoneApp('jobs', { name: 'お仕事', color: COL.jobs, order: 33, iconHD: iconJobs, badge: (g) => offersWaiting(g), open: (g) => jobsApp(g) });
registerPhoneApp('bank', { name: (g) => bankTitle(g), color: COL.bank, order: 42, iconHD: iconBank, open: (g) => bankApp(g) });
registerPhoneApp('demae', { name: (g) => demaeTitle(g), color: COL.demae, order: 64, iconHD: iconDemae, open: (g) => demaeApp(g) });
registerPhoneApp('tsuhan', { name: (g) => tsuhanTitle(g), color: COL.tsuhan, order: 65, iconHD: iconTsuhan, open: (g) => tsuhanApp(g) });
registerPhoneApp('news', { name: (g) => newsTitle(g), color: COL.news, order: 67, iconHD: iconNews, badge: (g) => newsUnread(g), open: (g) => newsApp(g) });
registerPhoneApp('camera', { name: (g) => camTitle(g), color: COL.camera, order: 68, iconHD: iconCamera, badge: (g) => newPhotos(g), open: (g) => cameraApp(g) });
registerPhoneApp('settings', { name: '設定', color: COL.settings, order: 99, iconHD: iconSettings, open: (g) => settingsApp(g) });

// For phone_apps2.js (and other apps): the list / panel views of these apps, and grocery /
// goods ordering for a given set of items (the 通販 rules: era names, 冷蔵便, the fee).
export { panelView, drawRow, rowsList, lifeBlock };
export async function orderGoods(g, ids) {
  const lb = lifeBlock(g);
  if (lb) { audio.sfx('buzz'); await phoneInfo(g, { title: tsuhanTitle(g), color: COL.tsuhan, text: lb }); return; }
  const cats = catalog(g);
  const want = new Set(ids || []);
  const cat = cats.find((c) => c.items && c.items.some((k) => want.has(k)));
  if (!cat) { await phoneInfo(g, { title: tsuhanTitle(g), color: COL.tsuhan, text: '（いまは配達でたのめる品物がない）' }); return; }
  await goodsShop(g, { ...cat, items: cat.items.filter((k) => want.has(k)) });
}

onMorning((g) => {
  try { bankMorning(g); } catch (e) { console.error(e); }
  try { deliverOrders(g); } catch (e) { console.error(e); }
  try { developFilm(g); } catch (e) { console.error(e); }
});
