// 時計 / 天気 phone apps (owner: R7-C) — for the three devices: 手帳 (昭和・平成のはじめ: a wristwatch, the newspaper's
// weather column), ケータイ (平成なかごろ: LCD clock, a weather site), スマホ (令和). They read the clock module through
// g.clock() / g.weather() / g.forecast() / g.sleepPlan() / g.setAlarm() (clock.js), so this file never imports it.
//
//   時計   tabs 時計 / アラーム / タイマー / ストップウォッチ (←→): the time and date; the alarm (wake-up time — it sets
//          tomorrow's morning: earlier means more day but less sleep when you go to bed late); a kitchen timer (1–10 min,
//          real seconds); a stopwatch with laps, next to the length of a ネタ from your ネタ帳 (g.netaList) to time it.
//   天気   today where you are (now, high / low, 降水確率 by 6 hours, 注意報・警報, 梅雨 / 台風) and the next 7 days;
//          ←→ shows the other city (東京 ⇔ 大阪).

import { registerPhoneApp } from './life.js';
import { phoneView, appTile, rrect, box, phoneText as T, fitText, PC } from './phone.js';
import { text, measure } from './draw.js';
import { audio } from './audio.js';
import { drawWeatherIcon } from './clock_fx.js';

const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); }
}
function line(c, x0, y0, x1, y1, col, t = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  c.fillStyle = col;
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x0 + ((x1 - x0) * i) / n - (t - 1) / 2), Math.round(y0 + ((y1 - y0) * i) / n - (t - 1) / 2), t, t);
}
const pad2 = (n) => String(n).padStart(2, '0');
const hmS = (m) => { const v = ((Math.round(m) % 1440) + 1440) % 1440; return `${Math.floor(v / 60)}:${pad2(v % 60)}`; };
const durT = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? `${m % 60}分` : ''}` : `${m}分`; };
const mmss = (sec) => { const s = Math.max(0, Math.floor(sec)); return `${Math.floor(s / 60)}:${pad2(s % 60)}`; };
const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const ERA_IDS = ['showa', 'heisei_early', 'heisei', 'reiwa'];
const devOf = (g) => { const e = g && g.state && g.state.profile && g.state.profile.era; const id = ERA_IDS.includes(e) ? e : 'reiwa'; return id === 'reiwa' ? 'smart' : id === 'heisei' ? 'keitai' : 'techo'; };
const COL = { clock: '#3a4670', tenki: '#2f8ad8' };
const ALARMS = [300, 330, 360, 390, 420, 450, 480, 510, 540];
const TIMERS = [1, 3, 4, 5, 10];
const hit = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

// ======================================================================== 時計
const clockName = (g) => (devOf(g) === 'techo' ? '腕時計' : '時計');
const TAB_NAMES = (g) => (devOf(g) === 'techo' ? ['時計', '目覚まし', 'タイマー', 'ストップ'] : ['時計', 'アラーム', 'タイマー', 'ストップ']);
function theme(g) {
  const d = devOf(g);
  if (d === 'smart') return { bg: '#101422', ink: '#ffffff', dim: '#9aa3c7', tab: '#1e2438', tabOn: '#ff9f0a', tabInk: '#ffffff', card: '#1e2438', edge: '#2e3654', accent: '#ff9f0a' };
  if (d === 'keitai') return { bg: '#e8ecf4', ink: '#1e2a3a', dim: '#6a7488', tab: '#c8d0e0', tabOn: '#3a5ab8', tabInk: '#ffffff', card: '#ffffff', edge: '#a8b0c4', accent: '#3a5ab8' };
  return { bg: '#efe6d0', ink: '#2a2014', dim: '#7a6a50', tab: '#d8ccb0', tabOn: '#7a4a1e', tabInk: '#fff6e0', card: '#fbf6ea', edge: '#b8a47e', accent: '#a0501e' };
}
function clockView(g) {
  const th = theme(g);
  const v = {
    title: () => (v.tab === 0 ? clockName(g) : `${clockName(g)}・${['', TAB_NAMES(g)[1], 'タイマー', 'ストップウォッチ'][v.tab]}`),
    color: COL.clock, bg: th.bg, cancel: -1,
    tab: 0, aIdx: 0, tIdx: 2, tLeft: 0, tRun: false, tDone: 0, sw: 0, swRun: false, laps: [], nIdx: 0, rects: {},
    hint: () => ['A／B:もどる　←→:きりかえ', 'A:セット　←→:きりかえ', 'A:開始/停止　↑↓:時間', 'A:開始/停止　↓:ラップ/リセット'][v.tab],
    enter() {
      const al = has(g, 'clock') ? safe(() => g.clock().alarm, null) : null;
      v.aIdx = al == null ? 0 : Math.max(0, ALARMS.indexOf(al) + 1);
    },
    update(ph, inp) {
      // the timers run in real time (60 frames a second) while the app is open
      if (v.tRun) { v.tLeft--; if (v.tLeft <= 0) { v.tLeft = 0; v.tRun = false; v.tDone = 90; audio.sfx('chime'); } }
      if (v.tDone > 0) v.tDone--;
      if (v.swRun) v.sw++;
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); return; }
      if (inp.repeat('left') || inp.repeat('right')) { v.tab = (v.tab + (inp.repeat('left') ? 3 : 1)) % 4; audio.sfx('cursor'); return; }
      if (v.tab === 0) { if (inp.pressed('a')) { audio.sfx('cancel'); ph.back(-1); } return; }
      if (v.tab === 1) {
        const n = ALARMS.length + 1;
        if (inp.repeat('up')) { v.aIdx = (v.aIdx + n - 1) % n; audio.sfx('cursor'); }
        if (inp.repeat('down')) { v.aIdx = (v.aIdx + 1) % n; audio.sfx('cursor'); }
        if (inp.pressed('a')) setAlarm(g, ph, v.aIdx);
        return;
      }
      if (v.tab === 2) {
        if (!v.tRun && (inp.repeat('up') || inp.repeat('down'))) { v.tIdx = (v.tIdx + (inp.repeat('up') ? TIMERS.length - 1 : 1)) % TIMERS.length; v.tLeft = 0; audio.sfx('cursor'); }
        if (inp.pressed('a')) timerAB(v);
        return;
      }
      if (inp.pressed('a')) { v.swRun = !v.swRun; audio.sfx(v.swRun ? 'ok' : 'cursor'); }
      if (inp.repeat('down')) swLapReset(v);
      if (inp.repeat('up')) { const L = netas(g); if (L.length) { v.nIdx = (v.nIdx + 1) % L.length; audio.sfx('cursor'); } }
    },
    tap(ph, x, y) {
      const r = v.rects;
      for (let i = 0; i < 4; i++) if (r['tab' + i] && hit(x, y, r['tab' + i])) { v.tab = i; audio.sfx('cursor'); return false; }
      if (v.tab === 1) for (let i = 0; i <= ALARMS.length; i++) if (r['al' + i] && hit(x, y, r['al' + i])) { v.aIdx = i; setAlarm(g, ph, i); return false; }
      if (v.tab === 2) {
        for (let i = 0; i < TIMERS.length; i++) if (r['tm' + i] && hit(x, y, r['tm' + i]) && !v.tRun) { v.tIdx = i; v.tLeft = 0; audio.sfx('cursor'); return false; }
        if (r.big && hit(x, y, r.big)) { timerAB(v); return false; }
      }
      if (v.tab === 3) {
        if (r.go && hit(x, y, r.go)) { v.swRun = !v.swRun; audio.sfx(v.swRun ? 'ok' : 'cursor'); return false; }
        if (r.lap && hit(x, y, r.lap)) { swLapReset(v); return false; }
        if (r.neta && hit(x, y, r.neta)) { const L = netas(g); if (L.length) { v.nIdx = (v.nIdx + 1) % L.length; audio.sfx('cursor'); } return false; }
      }
      return v.tab === 0;
    },
    draw(c, ph, a) { drawClockApp(c, g, v, a, th, ph); },
  };
  return v;
}
function setAlarm(g, ph, i) {
  const val = i === 0 ? null : ALARMS[i - 1];
  if (has(g, 'setAlarm')) safe(() => g.setAlarm(val));
  audio.sfx('ok');
  ph.toast(val == null ? 'アラームをOFFにした（自然に目覚める）' : `アラームを${hmS(val)}にセットした`, '#ffffff');
}
function timerAB(v) {
  if (v.tRun) { v.tRun = false; audio.sfx('cursor'); return; }
  if (v.tLeft <= 0) v.tLeft = TIMERS[v.tIdx] * 60 * 60;
  v.tRun = true; v.tDone = 0; audio.sfx('ok');
}
function swLapReset(v) {
  if (v.swRun) { v.laps.unshift(v.sw); if (v.laps.length > 4) v.laps.pop(); audio.sfx('cursor'); }
  else if (v.sw) { v.sw = 0; v.laps = []; audio.sfx('cancel'); }
}
const netas = (g) => (has(g, 'netaList') ? safe(() => (g.netaList() || []).filter((n) => n && Number.isFinite(Number(n.length))), []) : []);

function drawTabs(c, g, v, a, th) {
  const names = TAB_NAMES(g);
  const w = a.w / 4;
  R(c, a.x, a.y, a.w, 22, th.tab);
  names.forEach((n, i) => {
    const x = a.x + i * w;
    v.rects['tab' + i] = { x, y: a.y, w, h: 22 };
    if (i === v.tab) { R(c, x + 2, a.y + 2, w - 4, 18, th.tabOn); }
    T(c, fitText(c, n, w - 4, 12), x + w / 2, a.y + 5, 12, i === v.tab ? th.tabInk : th.dim, 'center');
  });
  R(c, a.x, a.y + 22, a.w, 1, th.edge);
}
function drawClockApp(c, g, v, a, th, ph) {
  drawTabs(c, g, v, a, th);
  const y0 = a.y + 26, x = a.x, w = a.w;
  const k = has(g, 'clock') ? safe(() => g.clock(), null) : null;
  if (!k) { T(c, '（時計がない…）', x + w / 2, y0 + 60, 12, th.dim, 'center'); return; }
  const dev = devOf(g);
  if (v.tab === 0) {
    const date = has(g, 'dateFull') ? safe(() => g.dateFull(), '') : '';
    let y = y0 + 4;
    if (dev === 'techo') {
      drawWatch(c, x + w / 2, y0 + 62, 50, k, th);
      y = y0 + 122;
    } else {
      const big = dev === 'smart' ? 40 : 32;
      if (dev === 'keitai') { box(c, x + 16, y0 + 6, w - 32, 58, 4, '#b8c8a0', '#5a6a4a', { lo: '#a0b088' }); }
      text(c, k.label, x + w / 2, y0 + (dev === 'smart' ? 8 : 16), { size: big, align: 'center', color: dev === 'keitai' ? '#1e2a14' : th.ink, shadow: null });
      y = y0 + 70;
    }
    T(c, fitText(c, date, w - 16, 12), x + w / 2, y, 12, th.ink, 'center');
    y += 18;
    const late = k.late;
    T(c, `${k.phaseLabel}${late ? '（もう0時を過ぎている）' : ''}`, x + w / 2, y, 12, late ? '#d6304a' : th.dim, 'center');
    y += 18;
    const wx = has(g, 'weather') ? safe(() => g.weather(), null) : null;
    if (wx) {
      const s = `${wx.regionName}　${wx.label}　${wx.temp}℃`;
      const sw = measure(c, s, 12) + 20;
      drawWeatherIcon(c, wx.kind, x + (w - sw) / 2, y - 2, 16, !!(k.minutes < k.sunrise || k.minutes >= k.sunset + 20));
      T(c, s, x + (w - sw) / 2 + 20, y, 12, th.ink);
      y += 18;
    }
    if (dev !== 'techo') { T(c, `日の出 ${hmS(k.sunrise)}　日の入り ${hmS(k.sunset)}`, x + w / 2, y, 12, th.dim, 'center'); y += 18; }
    const sp = has(g, 'sleepPlan') ? safe(() => g.sleepPlan(), null) : null;
    if (sp && y < a.y + a.h - 30) {
      box(c, x + 8, a.y + a.h - 38, w - 16, 34, 4, th.card, th.edge);
      T(c, fitText(c, `いま寝ると：${hmS(sp.wake)}に起床（${durT(sp.hours * 60)}）`, w - 28, 12), x + 14, a.y + a.h - 34, 12, th.ink);
      T(c, fitText(c, sp.effect && sp.effect.f < 1 ? `寝不足：体力は${Math.round(sp.effect.f * 100)}%まで` : sp.alarm == null ? 'アラームなし（自然に目覚める）' : `アラーム ${hmS(sp.alarm)}`, w - 28, 12), x + 14, a.y + a.h - 19, 12, sp.effect && sp.effect.f < 1 ? '#d6304a' : th.dim);
    }
    return;
  }
  if (v.tab === 1) {
    const sp = has(g, 'sleepPlan') ? safe(() => g.sleepPlan(), null) : null;
    const al = v.aIdx === 0 ? null : ALARMS[v.aIdx - 1];
    // what the chosen alarm would mean tonight (bedtime = now)
    let info = '';
    if (sp) {
      const nat = Math.min(630, Math.max(420, sp.bed + 480 - 1440));
      const wake = Math.max(al == null ? nat : al, sp.bed + 60 - 1440);
      const hrs = (wake + 1440 - sp.bed) / 60;
      info = `いま寝ると ${hmS(wake)} 起床（${durT(hrs * 60)}）`;
    }
    T(c, fitText(c, info, w - 16, 12), x + 8, y0 + 2, 12, th.ink);
    T(c, fitText(c, '早く起きれば1日が長い。夜ふかしだと寝不足に', w - 16, 12), x + 8, y0 + 17, 12, th.dim);
    const rh = 17, top = y0 + 34;
    const cur = k.alarm == null ? 0 : ALARMS.indexOf(k.alarm) + 1;
    for (let i = 0; i <= ALARMS.length; i++) {
      const yy = top + i * rh;
      if (yy + rh > a.y + a.h) break;
      v.rects['al' + i] = { x, y: yy, w, h: rh };
      const sel = i === v.aIdx;
      if (sel) R(c, x + 4, yy, w - 8, rh, dev === 'smart' ? '#2e3654' : PC.sel);
      const lab = i === 0 ? 'OFF（自然に目覚める）' : `${hmS(ALARMS[i - 1])}${ALARMS[i - 1] === 420 ? '（いつもの朝）' : ALARMS[i - 1] < 360 ? '（早起き）' : ''}`;
      T(c, lab, x + 14, yy + 2, 12, sel && dev !== 'smart' ? '#1a1a28' : th.ink);
      if (i === cur) T(c, '●', x + w - 14, yy + 2, 12, th.accent, 'right');
    }
    return;
  }
  if (v.tab === 2) {
    const total = TIMERS[v.tIdx] * 60;
    const left = v.tRun || v.tLeft > 0 ? v.tLeft / 60 : total;
    const flash = v.tDone > 0 && Math.floor(v.tDone / 10) % 2 === 0;
    v.rects.big = { x: x + 16, y: y0 + 6, w: w - 32, h: 64 };
    box(c, x + 16, y0 + 6, w - 32, 64, 6, flash ? '#ffd23f' : th.card, th.edge);
    text(c, v.tDone > 0 ? '時間です！' : mmss(Math.ceil(left)), x + w / 2, y0 + (v.tDone > 0 ? 28 : 18), { size: v.tDone > 0 ? 20 : 36, align: 'center', color: v.tDone > 0 ? '#2a1a0a' : th.ink, shadow: null });
    // progress bar
    R(c, x + 24, y0 + 76, w - 48, 4, th.edge);
    R(c, x + 24, y0 + 76, Math.round((w - 48) * (left / total)), 4, th.accent);
    T(c, v.tRun ? '計測中…（A:とめる）' : v.tLeft > 0 ? '一時停止（A:つづける）' : 'A:スタート', x + w / 2, y0 + 86, 12, th.dim, 'center');
    TIMERS.forEach((m, i) => {
      const bw = (w - 16) / TIMERS.length, bx = x + 8 + i * bw, by = y0 + 108;
      v.rects['tm' + i] = { x: bx, y: by, w: bw - 4, h: 24 };
      const sel = i === v.tIdx;
      box(c, bx, by, bw - 4, 24, 4, sel ? th.accent : th.card, th.edge);
      T(c, `${m}分`, bx + (bw - 4) / 2, by + 6, 12, sel ? '#ffffff' : th.ink, 'center');
    });
    const note = { 1: '1分：一発ギャグや自己紹介に', 3: '3分：ショートネタの目安', 4: '4分：漫才の決勝ネタの持ち時間', 5: '5分：コントや寄席の短いネタに', 10: '10分：落語の小噺から本題まで' }[TIMERS[v.tIdx]];
    T(c, fitText(c, note, w - 16, 12), x + w / 2, y0 + 140, 12, th.dim, 'center');
    T(c, fitText(c, '（ゲームの時間は進まない。本物の秒で計る）', w - 16, 12), x + w / 2, y0 + 158, 12, th.dim, 'center');
    return;
  }
  // ストップウォッチ
  const sec = v.sw / 60;
  const cs = Math.floor((v.sw % 60) * (100 / 60));
  box(c, x + 12, y0 + 4, w - 24, 50, 6, th.card, th.edge);
  text(c, `${mmss(sec)}.${pad2(cs)}`, x + w / 2, y0 + 12, { size: 28, align: 'center', color: v.swRun ? th.accent : th.ink, shadow: null });
  const bw = (w - 32) / 2;
  v.rects.go = { x: x + 12, y: y0 + 60, w: bw, h: 24 };
  v.rects.lap = { x: x + 20 + bw, y: y0 + 60, w: bw, h: 24 };
  box(c, x + 12, y0 + 60, bw, 24, 4, v.swRun ? '#d6304a' : '#2f9a4a', '#1a1a28');
  T(c, v.swRun ? 'ストップ' : v.sw ? 'つづける' : 'スタート', x + 12 + bw / 2, y0 + 66, 12, '#ffffff', 'center');
  box(c, x + 20 + bw, y0 + 60, bw, 24, 4, th.card, th.edge);
  T(c, v.swRun ? 'ラップ' : 'リセット', x + 20 + bw + bw / 2, y0 + 66, 12, th.ink, 'center');
  let y = y0 + 92;
  if (has(g, 'netaList')) {
    const L = netas(g);
    v.rects.neta = { x: x + 8, y, w: w - 16, h: 44 };
    box(c, x + 8, y, w - 16, 44, 4, th.card, th.edge);
    if (!L.length) {
      T(c, fitText(c, 'ネタ帳に台本を書くと、', w - 28, 12), x + 14, y + 6, 12, th.dim);
      T(c, fitText(c, 'ここでネタの尺と見くらべられる', w - 28, 12), x + 14, y + 22, 12, th.dim);
    } else {
      const n = L[v.nIdx % L.length];
      const len = Number(n.length) || 0, tgt = Number(n.target) || 0;
      T(c, fitText(c, `『${n.title || 'ネタ'}』${L.length > 1 ? '（↑:次のネタ）' : ''}`, w - 28, 12), x + 14, y + 5, 12, th.ink);
      const over = sec - len;
      const msg = !v.sw ? `尺の目安 ${mmss(len)}${tgt ? `／目標 ${mmss(tgt)}` : ''}` : over > 0 ? `尺オーバー +${mmss(over)}（目安 ${mmss(len)}）` : `あと ${mmss(-over)}（目安 ${mmss(len)}）`;
      T(c, fitText(c, msg, w - 28, 12), x + 14, y + 23, 12, v.sw && over > 0 ? '#d6304a' : v.sw ? '#2f9a4a' : th.dim);
    }
    y += 50;
  }
  v.laps.slice(0, Math.max(0, Math.floor((a.y + a.h - y) / 16))).forEach((f, i) => {
    T(c, `ラップ${v.laps.length - i}`, x + 16, y + i * 16, 12, th.dim);
    T(c, `${mmss(f / 60)}.${pad2(Math.floor((f % 60) * (100 / 60)))}`, x + w - 16, y + i * 16, 12, th.ink, 'right');
  });
}
// The 手帳 eras' wristwatch: a leather strap, a round case and a face with hands and the date window.
function drawWatch(c, cx, cy, r, k, th) {
  R(c, cx - 22, cy - r - 30, 44, 2 * r + 60, '#6a3e1e');
  for (let y = cy - r - 30; y < cy + r + 30; y += 6) R(c, cx - 20, y, 40, 1, '#5a3218');
  R(c, cx - 22, cy - r - 30, 2, 2 * r + 60, '#8a5a30');
  disc(c, cx, cy, r + 4, '#7a7266');
  disc(c, cx, cy, r + 3, '#d8d0c0');
  disc(c, cx, cy, r, '#fbf6e8');
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    const x1 = cx + Math.sin(t) * (r - 3), y1 = cy - Math.cos(t) * (r - 3);
    const x2 = cx + Math.sin(t) * (r - (i % 3 ? 7 : 10)), y2 = cy - Math.cos(t) * (r - (i % 3 ? 7 : 10));
    line(c, x1, y1, x2, y2, '#2a2014', i % 3 ? 1 : 2);
  }
  // date window at 3 o'clock
  box(c, cx + r - 24, cy - 7, 18, 14, 1, '#ffffff', '#5a5040');
  T(c, String((k && k.date) || ''), cx + r - 15, cy - 6, 12, '#2a2014', 'center');
  const min = k ? k.minutes : 0;
  const ha = ((min / 60) % 12) / 12 * Math.PI * 2, ma = ((min % 60) / 60) * Math.PI * 2;
  line(c, cx, cy, cx + Math.sin(ha) * (r * 0.5), cy - Math.cos(ha) * (r * 0.5), '#1a140c', 3);
  line(c, cx, cy, cx + Math.sin(ma) * (r * 0.78), cy - Math.cos(ma) * (r * 0.78), '#1a140c', 2);
  disc(c, cx, cy, 2, '#a0501e');
  T(c, 'DOT', cx, cy - r + 14, 12, '#7a6a50', 'center');
}

// ======================================================================== 天気
const tenkiTitle = (g) => ({ techo: 'ドット新聞 天気欄', keitai: '天気予報', smart: '天気' })[devOf(g)];
function tenkiTheme(g, wx, night) {
  const d = devOf(g);
  if (d === 'techo') return { bg: '#f4eedc', ink: '#2a2418', dim: '#7a6a50', line: '#c8b890', hi: '#b8301e', lo: '#2a5aa8', card: '#fbf6e8', warn: '#b8301e' };
  if (d === 'keitai') return { bg: '#ffffff', ink: PC.text, dim: PC.dim, line: PC.line, hi: '#d6304a', lo: '#2f6fd0', card: '#eef4fc', warn: '#d6304a' };
  const wet = wx && (wx.wet || wx.kind === 'cloudy');
  return { bg: night ? '#1a2450' : wet ? '#56657e' : '#3a8ad8', ink: '#ffffff', dim: night ? '#a8b4e0' : '#dbe8f8', line: 'rgba(255,255,255,0.25)', hi: '#ffb4a0', lo: '#b8dcff', card: 'rgba(255,255,255,0.14)', warn: '#ffd23f' };
}
function tenkiView(g) {
  const v = {
    title: tenkiTitle(g), color: COL.tenki, cancel: -1, other: false,
    hint: 'A／B:もどる　←→:東京／大阪',
    enter() { const c = g.state && g.state.clock; if (c && c.warn) c.warn.tenkiSeen = g.state.day; },
    update(ph, inp) {
      if (inp.pressed('a') || inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); return; }
      if (inp.repeat('left') || inp.repeat('right')) { v.other = !v.other; audio.sfx('cursor'); }
    },
    tap(ph, x, y) { if (v.swap && hit(x, y, v.swap)) { v.other = !v.other; audio.sfx('cursor'); return false; } return true; },
    draw(c, ph, a) { drawTenki(c, g, v, a, ph); },
  };
  return v;
}
function drawTenki(c, g, v, a) {
  const here = safe(() => g.weather(), null);
  if (!here) { T(c, '（天気がわからない…）', a.x + a.w / 2, a.y + 60, 12, PC.dim, 'center'); return; }
  const otherRegion = here.region === 'osaka' ? 'tokyo' : here.region === 'tokyo' ? 'osaka' : 'tokyo';
  const region = v.other ? otherRegion : here.region;
  const wx = v.other ? safe(() => g.weather(undefined, region), here) : here;
  const k = safe(() => g.clock(), null);
  const night = !!(k && (k.minutes < k.sunrise || k.minutes >= k.sunset + 20));
  const th = tenkiTheme(g, wx, night);
  const dev = devOf(g);
  const { x, w } = a;
  let y = a.y;
  R(c, x, y, w, a.h, th.bg);
  if (dev === 'smart') for (let i = 0; i < 6; i++) R(c, x, y + i * 18, w, 18, `rgba(255,255,255,${0.06 - i * 0.01})`);
  // header line: where, the date, the other city
  const d = safe(() => g.dateShort(), '');
  T(c, fitText(c, `${wx.regionName}　${d}（${safe(() => g.clock().label, '')}）`, w - 70, 12), x + 8, y + 4, 12, th.dim);
  const sw = `${otherName(here, v)} ⇔`;
  const swW = measure(c, sw, 12) + 10;
  v.swap = { x: x + w - swW - 6, y: y + 2, w: swW, h: 16 };
  rrect(c, v.swap.x, v.swap.y, swW, 16, 4, dev === 'smart' ? 'rgba(255,255,255,0.22)' : th.line);
  T(c, sw, v.swap.x + swW / 2, y + 4, 12, th.ink, 'center');
  y += 20;
  // today
  drawWeatherIcon(c, wx.kind, x + 8, y, 32, night && wx.kind === 'sunny');
  text(c, fitText(c, wx.label, 96, 16), x + 46, y, { size: 16, color: th.ink, shadow: null });
  T(c, `いま ${wx.temp}℃`, x + 46, y + 19, 12, th.dim);
  T(c, `最高 ${wx.high}℃`, x + w - 8, y + 1, 12, th.hi, 'right');
  T(c, `最低 ${wx.low}℃`, x + w - 8, y + 18, 12, th.lo, 'right');
  y += 38;
  // 降水確率
  T(c, '降水確率', x + 8, y + 9, 12, th.dim);
  const labels = ['0-6', '6-12', '12-18', '18-24'];
  const cw = (w - 70) / 4;
  (wx.pops || []).forEach((p, i) => {
    const cx = x + 62 + i * cw;
    T(c, labels[i], cx + cw / 2, y, 12, th.dim, 'center');
    T(c, `${p}%`, cx + cw / 2, y + 15, 12, p >= 50 ? (dev === 'smart' ? '#ffd23f' : th.lo) : th.ink, 'center');
  });
  y += 32;
  // 注意報・警報 / 梅雨 / 台風
  const notes = [];
  if (wx.warnings && wx.warnings.length) notes.push(...wx.warnings);
  const wl = notes.length ? notes.join('・') : wx.typhoon ? `台風${wx.typhoon}号が接近中` : wx.tsuyu ? `${wx.area}地方は梅雨のさなか` : '注意報・警報はありません';
  box(c, x + 6, y, w - 12, 18, 3, notes.length ? (dev === 'smart' ? 'rgba(214,48,74,0.55)' : '#fde8ea') : th.card, notes.length ? th.warn : th.line);
  T(c, fitText(c, wl, w - 24, 12), x + 12, y + 3, 12, notes.length ? (dev === 'smart' ? '#ffffff' : th.warn) : th.dim);
  y += 24;
  // the week
  R(c, x + 6, y - 2, w - 12, 1, th.line);
  T(c, dev === 'techo' ? '週間予報' : '週間天気', x + 8, y + 1, 12, th.dim);
  y += 16;
  const fc = safe(() => g.forecast(8, region), []) || [];
  const rh = 18;
  for (const f of fc.slice(1)) {
    if (y + rh > a.y + a.h) break;
    T(c, `${f.month}/${f.date}（${f.weekday}）`, x + 8, y + 2, 12, f.weekday === '日' ? th.hi : f.weekday === '土' ? th.lo : th.ink);
    drawWeatherIcon(c, f.kind, x + 86, y + 1, 16, false);
    T(c, fitText(c, f.kind === 'typhoon' ? '台風' : f.label, 44, 12), x + 105, y + 2, 12, th.ink);
    T(c, `${f.high}/${f.low}`, x + w - 44, y + 2, 12, th.ink, 'right');
    T(c, `${f.pop}%`, x + w - 8, y + 2, 12, f.pop >= 50 ? th.lo : th.dim, 'right');
    y += rh;
  }
}
const otherName = (here, v) => { const o = here.region === 'osaka' ? '東京' : here.region === 'tokyo' ? '大阪' : '東京'; return v.other ? (here.regionName || 'ここ') : o; };

// ======================================================================== icons & registration
function iconClock(c, x, y, g) {
  appTile(c, x, y, COL.clock);
  const d = devOf(g);
  const k = has(g, 'clock') ? safe(() => g.clock(), null) : null;
  const min = k ? k.minutes : 600;
  if (d === 'keitai') {
    box(c, x + 4, y + 9, 24, 14, 2, '#b8c8a0', '#1e2a14');
    T(c, k ? k.label : '10:00', x + 16, y + 10, 12, '#1e2a14', 'center');
    return;
  }
  if (d === 'techo') { R(c, x + 12, y + 2, 8, 28, '#6a3e1e'); R(c, x + 12, y + 2, 1, 28, '#8a5a30'); }
  disc(c, x + 16, y + 16, 10, d === 'smart' ? '#0e0e14' : '#7a7266');
  disc(c, x + 16, y + 16, 9, '#ffffff');
  for (let i = 0; i < 12; i += 3) { const t = (i / 12) * Math.PI * 2; R(c, Math.round(x + 16 + Math.sin(t) * 7), Math.round(y + 16 - Math.cos(t) * 7), 1, 1, '#2a2a3a'); }
  const ha = ((min / 60) % 12) / 12 * Math.PI * 2, ma = ((min % 60) / 60) * Math.PI * 2;
  line(c, x + 16, y + 16, x + 16 + Math.sin(ha) * 4.5, y + 16 - Math.cos(ha) * 4.5, '#1a1a28', 2);
  line(c, x + 16, y + 16, x + 16 + Math.sin(ma) * 7, y + 16 - Math.cos(ma) * 7, d === 'smart' ? '#ff9f0a' : '#1a1a28', 1);
}
function iconTenki(c, x, y, g) {
  appTile(c, x, y, devOf(g) === 'techo' ? '#8a7a5a' : COL.tenki);
  const wx = has(g, 'weather') ? safe(() => g.weather(), null) : null;
  drawWeatherIcon(c, wx ? wx.kind : 'cloudy', x, y + 1, 32, false);
}
const tenkiBadge = (g) => {
  const st = g.state;
  if (!st || !st.clock || !st.clock.warn || st.clock.warn.tenkiSeen === st.day) return 0;
  const wx = has(g, 'weather') ? safe(() => g.weather(), null) : null;
  return wx && wx.warnings && wx.warnings.length ? 1 : 0;
};

let installed = false;
export function installClockApps() {
  if (installed) return;
  installed = true;
  registerPhoneApp('clock', { name: (g) => clockName(g), color: COL.clock, order: 31, iconHD: iconClock, open: (g) => phoneView(g, clockView(g)) });
  registerPhoneApp('tenki', { name: (g) => (devOf(g) === 'techo' ? '天気欄' : '天気'), color: COL.tenki, order: 66, iconHD: iconTenki, badge: tenkiBadge, open: (g) => phoneView(g, tenkiView(g)) });
}
export { clockView, tenkiView };
