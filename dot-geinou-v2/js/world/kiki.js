// 危機の場面 (kiki): the HD event scenes of the regime & security core (js/engine/regime.js) and the phone app
// 「危機管理」. regime.js owns the logic and the words; this module draws (KIKI.show / KIKI.downfall / KIKI.record)
// and offers the player's controls (自衛隊・災害対応・報道・体制・戦争) on the phone.
//
// Content rules (see regime.js): fictional disasters, fictional nations; no in-game disclaimer (the fiction
// notice is on the title screen only). Everything here is abstract and non-graphic: a crowd of distant silhouettes, maps, numbers,
// newspapers. The downfall shows the crowd from far away and a headline; the narration says what happened in
// one short sober sentence. No body, no violence is drawn.
//
// API: installs KIKI.show(g, spec), KIKI.downfall(g, record), KIKI.record(g, record) on regime.js's KIKI;
// registers the phone app 'kiki' (name 危機管理, order 62). kikiApp(g) opens it directly (other UIs may call it).
// spec (from regime.js): { art, title, sub, pages[], options?: [{ label, value }], prompt?, alert?: { kind: 'phone'|'tv',
//   text }, headline?, numbers?, bySeg?, front?, home? }

import { SW, SH, clamp, hash2 } from '../engine/util.js';
import { text, measure, panel, wrap, downArrow, COLORS } from '../engine/draw.js';
import { registerPhoneApp } from '../engine/life.js';
import { phoneList, phoneInfo, phoneConfirm, phoneText, PC } from '../engine/phone.js';
import { audio } from '../engine/audio.js';
import {
  KIKI, REGIME_INFO, FICTIONAL_NATIONS, NATION_ORDER, DISPUTED_AREA, FICTION_NOTE, downfallText, recordLines,
} from '../engine/regime.js';

const R = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const n0 = (n) => Math.max(0, Math.round(Number(n) || 0)).toLocaleString('ja-JP');
const ART_H = SH - 100; // the message window covers the bottom 96 px
const SEG_SHORT = { young: '若者', families: '子育て', elderly: '高齢者', employees: '会社員', selfemployed: '自営業', business: '経営者', farmers: '農林漁', unions: '労組', urban: '都市', rural: '地方', floating: '無党派' };

// ======================================================================== Japanese line breaking (numbers kept whole)
// A number keeps its unit and is never split across lines (「5,260人」「1.2兆円」「48／100」「M7.2」), a closing mark or a
// small kana never starts a line (the last character goes down with it), an opening bracket never ends one. Every
// line fits the width, so the game's own wrap (draw.js, character by character) never has to break it again.
// (The same rules as assist.js wrapJ; kept here so kiki.js works without assist.js.)
const MSG_W = SW - 64; // the message window's text width (ui.js: BOX.w - 40), 16 px
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％'.split(''));
const NO_END = new Set('（「『【〔〈《‘“([{'.split(''));
const SOFT = new Set('・、　 '.split(''));
const TOKEN = /⁠?[−\-]?[0-9０-９]+(?:[.,][0-9]+)*(?:[／/][0-9]+)?(?:分の[0-9]+|[%％年月日歳人分万億兆円倍回本条号割棟件隻機台]+)?|[A-Za-z0-9.,:%/+\-#'’]+|\s+|./gu;
export function jwrap(c, str, w, size = 12) {
  measure(c, '', size); // sets the font
  const W = (s0) => c.measureText(s0).width;
  const out = [];
  for (const par of String(str ?? '').split('\n')) {
    const toks = par.match(TOKEN) || [];
    let line = '';
    const hardSplit = (s0) => { for (const ch of Array.from(s0)) { if (line && W(line + ch) > w) { out.push(line); line = ''; } line += ch; } };
    for (const t of toks) {
      if (!line && /^\s+$/.test(t) && out.length) continue;
      if (W(line + t) <= w) { line += t; continue; }
      if (!line) { hardSplit(t); continue; }
      let carry = '';
      if (Array.from(t).length === 1 && NO_START.has(t)) {
        const a0 = Array.from(line);
        let k = a0.length - 1;
        while (k > 0 && NO_START.has(a0[k])) k--;
        if (k > 0) { carry = a0.slice(k).join(''); line = a0.slice(0, k).join(''); } else { line += t; continue; }
      } else {
        // a soft break after 「・」「、」 or a space a few characters back: a short label stays with its number
        // (「けが人5,260人」, 「住宅被害52,143棟」 rather than 「けが｜人5,260人」)
        const a0 = Array.from(line);
        for (let k = a0.length - 2; k >= Math.max(1, a0.length - 7); k--) {
          if (!SOFT.has(a0[k])) continue;
          const rest = a0.slice(k + 1).join('');
          if (W(rest + t) <= w && !NO_START.has(a0[k + 1])) { carry = rest; line = a0.slice(0, k + 1).join(''); }
          break;
        }
      }
      while (line.length > 1 && NO_END.has(line[line.length - 1])) { carry = line[line.length - 1] + carry; line = line.slice(0, -1); }
      out.push(line.replace(/\s+$/, ''));
      line = '';
      const rest = carry + (/^\s+$/.test(t) ? '' : t);
      if (W(rest) > w) hardSplit(rest); else line = rest;
    }
    out.push(line);
  }
  return out;
}
// A page of the message window, line-broken as above ({name} and the era's money already applied: g.fmt is idempotent).
function wrapPage(g, s) {
  if (s == null || !g || !g.ctx) return s;
  try { return jwrap(g.ctx, typeof g.fmt === 'function' ? g.fmt(s) : String(s), MSG_W, 16).join('\n'); } catch (e) { console.error(e); return s; }
}
const sayJ = (g, pages) => g.say([].concat(pages).filter((p) => p != null).map((p) => wrapPage(g, p)));

// ======================================================================== drawing kit
function sky(ctx, top, bottom, h = ART_H, steps = 12) {
  const parse = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = parse(top), b = parse(bottom);
  for (let i = 0; i < steps; i++) {
    const k = i / (steps - 1);
    const c = a.map((v, j) => Math.round(v + (b[j] - v) * k));
    R(ctx, 0, Math.floor((h * i) / steps), SW, Math.ceil(h / steps) + 1, `rgb(${c[0]},${c[1]},${c[2]})`);
  }
}
function skyline(ctx, base, col, seed = 1, minH = 20, maxH = 90, step = 18) {
  for (let x = 0; x < SW; x += step) {
    const w = step - 2 + Math.floor(hash2(x, seed, 3) * 6);
    const h = minH + Math.floor(hash2(x, seed, 7) * (maxH - minH));
    R(ctx, x, base - h, w, h, col);
  }
}
function windows(ctx, base, seed, col, t = 0) {
  for (let x = 4; x < SW; x += 18) {
    const h = 20 + Math.floor(hash2(x - 4, seed, 7) * 70);
    for (let y = base - h + 6; y < base - 4; y += 8) if (hash2(x, y, seed + Math.floor(t / 90)) > 0.6) R(ctx, x + 3, y, 2, 3, col);
  }
}
// a person seen from far away (from behind): head, shoulders, legs. s ≈ 0.6 (far) .. 3 (near); y = the feet.
function figure(ctx, x, y, s, col, arm = 0) {
  const legH = Math.max(2, Math.round(4.5 * s)), torsoH = Math.max(3, Math.round(6 * s)), headW = Math.max(2, Math.round(3 * s));
  const torsoW = Math.max(3, Math.round(5 * s)), legW = Math.max(1, Math.round(1.7 * s)), gap = s >= 1.5 ? Math.max(1, Math.round(0.8 * s)) : 0;
  const top = y - legH - torsoH;
  R(ctx, x - legW - gap / 2, y - legH, legW, legH, col);
  R(ctx, x + gap / 2, y - legH, legW, legH, col);
  R(ctx, x - torsoW / 2, top + 1, torsoW, torsoH - 1, col);
  R(ctx, x - torsoW / 2 + 1, top, torsoW - 2, 1, col);
  const neck = s >= 1.5 ? 1 : 0;
  R(ctx, x - headW / 2, top - headW - neck, headW, headW, col);
  if (s >= 2) R(ctx, x - headW / 2 + 1, top - headW - neck - 1, headW - 2, 1, col);
  if (arm) R(ctx, x + torsoW / 2 - 1, top - Math.round(4 * s), Math.max(1, Math.round(1.2 * s)), Math.round(5 * s), col);
}
function crowd(ctx, x0, x1, yTop, yBot, seed, t = 0, cols = ['#1a1a26', '#22222e', '#2a2a36'], arms = 0.08) {
  const rows = Math.max(1, Math.floor((yBot - yTop) / 5));
  for (let r = 0; r < rows; r++) {
    const y = yTop + r * 5;
    const s = 0.6 + (r / rows) * 1.2;
    const gap = Math.max(4, Math.round(7 * s));
    for (let x = x0 + (r % 2) * 3; x < x1; x += gap) {
      const h = hash2(x, r, seed);
      const bob = (Math.floor(t / 20) + Math.floor(h * 7)) % 9 === 0 ? 1 : 0;
      figure(ctx, x + Math.round(h * 3), y + bob, s, cols[Math.floor(h * cols.length) % cols.length], h < arms ? 1 : 0);
    }
  }
}
function placard(ctx, x, y, label, t) {
  const bob = Math.floor(t / 15 + x) % 4 === 0 ? 1 : 0;
  const w = Math.max(40, measure(ctx, label, 10) + 10);
  R(ctx, x - 1, y + 14 - bob, 2, 14, '#3a2a1a');
  R(ctx, x - w / 2, y - bob, w, 16, '#f2ecdc');
  R(ctx, x - w / 2, y + 15 - bob, w, 1, '#a89c84');
  if (label) text(ctx, label, x, y + 2 - bob, { size: 10, align: 'center', color: '#3a2020', shadow: null });
}
function dateBox(ctx, g) {
  try {
    const d = typeof g.gameDate === 'function' ? g.gameDate() : null;
    const label = d ? `${d.year}年${d.month}月　${g.dayLabel()}` : g.dayLabel();
    const w = measure(ctx, label, 12) + 20;
    panel(ctx, SW - w - 8, 8, w, 26, { bg: '#1a1f38' });
    text(ctx, label, SW - w + 2, 14, { size: 12, color: '#d8dcf0' });
  } catch (e) { /* no date */ }
}
function titleBox(ctx, title, sub) {
  if (!title) return;
  const w = Math.min(SW - 200, Math.max(measure(ctx, title, 16), measure(ctx, sub || '', 12)) + 28);
  panel(ctx, 8, 8, w, sub ? 50 : 32, { bg: '#1a1f38' });
  text(ctx, title, 22, 15, { size: 16, color: COLORS.accent });
  if (sub) text(ctx, sub, 22, 36, { size: 12, color: '#d8dcf0' });
}
function numbersBox(ctx, nums, x = SW - 196, y = 44) {
  if (!nums || nums.dead == null) return;
  const rows = [['死者', nums.dead], ['行方不明', nums.missing], ['けが人', nums.injured], ['避難', nums.evac]];
  panel(ctx, x, y, 188, 22 + rows.length * 18, { bg: '#20162a' });
  rows.forEach(([k, v], i) => {
    text(ctx, k, x + 12, y + 10 + i * 18, { size: 12, color: '#d8dcf0' });
    text(ctx, `${n0(v)}人`, x + 176, y + 10 + i * 18, { size: 12, color: '#ffffff', align: 'right' });
  });
}

// ======================================================================== the arts (each: (ctx, t, spec, g))
const ARTS = {
  quake(ctx, t, s) {
    sky(ctx, '#7aa6d6', '#cfe0ef');
    skyline(ctx, ART_H - 40, '#6a7488', 11, 30, 120, 22);
    skyline(ctx, ART_H - 20, '#4a5266', 12, 20, 80, 16);
    R(ctx, 0, ART_H - 20, SW, 20, '#3a3e4a');
    // cracks in the road and a few fallen signs (no people hurt)
    for (let i = 0; i < 6; i++) { const x = 60 + i * 95; R(ctx, x, ART_H - 14, 18, 2, '#1e2028'); R(ctx, x + 16, ART_H - 12, 2, 6, '#1e2028'); }
    if (s.alert) alertOverlay(ctx, t, s.alert);
  },
  tsunami(ctx, t, s) {
    sky(ctx, '#55657a', '#9aa6b6');
    R(ctx, 0, ART_H - 70, SW, 70, '#2a4a6a');
    const crest = ART_H - 110 + Math.sin(t / 30) * 3;
    for (let x = 0; x < SW; x += 4) R(ctx, x, crest + Math.sin((x + t) / 24) * 6, 4, ART_H - 60 - crest, '#3a6a92');
    for (let x = 0; x < SW; x += 6) R(ctx, x, crest + Math.sin((x + t) / 24) * 6, 4, 3, '#e8f0f6');
    skyline(ctx, ART_H - 40, '#2a2e3a', 21, 10, 40, 20);
    R(ctx, 0, ART_H - 12, SW, 12, '#1a1e26');
    if (s.alert) alertOverlay(ctx, t, s.alert);
  },
  storm(ctx, t, s) {
    sky(ctx, '#2a2e3a', '#4a5262');
    for (let i = 0; i < 14; i++) R(ctx, ((i * 53 + t * 0.2) % (SW + 80)) - 80, 20 + (i % 4) * 22, 90, 18, '#3a404e');
    skyline(ctx, ART_H - 46, '#1e2230', 31, 10, 60, 20);
    R(ctx, 0, ART_H - 46, SW, 46, '#5a5038');
    for (let x = 0; x < SW; x += 8) R(ctx, x, ART_H - 46 + Math.sin((x + t * 2) / 20) * 2, 6, 2, '#8a7a58');
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 120; i++) { const x = (i * 37 + t * 6) % SW, y = (i * 53 + t * 9) % ART_H; R(ctx, x, y, 1, 8, '#a8b8d0'); }
    ctx.globalAlpha = 1;
    if (s.alert) alertOverlay(ctx, t, s.alert);
  },
  volcano(ctx, t, s) {
    sky(ctx, '#6a6a72', '#b8a898');
    // the mountain and the plume (grey ash, rising)
    for (let y = 0; y < 150; y++) { const w = 40 + y * 2.2; R(ctx, 320 - w / 2, ART_H - 160 + y, w, 1, y < 4 ? '#3a3036' : '#4a4048'); }
    for (let i = 0; i < 18; i++) {
      const k = (t / 4 + i * 14) % 160;
      const r = 12 + k * 0.4;
      ctx.globalAlpha = Math.max(0, 0.7 - k / 220);
      R(ctx, 320 - r + Math.sin(i) * 10, ART_H - 165 - k, r * 2, r * 1.2, '#7a7276');
    }
    ctx.globalAlpha = 1;
    skyline(ctx, ART_H - 6, '#2a262a', 41, 6, 26, 14);
    if (s.alert) alertOverlay(ctx, t, s.alert);
  },
  kantei(ctx, t) {
    R(ctx, 0, 0, SW, ART_H, '#14182a');
    // big screens with maps and numbers, a long desk, officials (silhouettes)
    for (let i = 0; i < 3; i++) {
      const x = 70 + i * 170;
      R(ctx, x, 30, 150, 86, '#0a0e1a');
      R(ctx, x + 4, 34, 142, 78, i === 1 ? '#1a3a5a' : '#1a2a3a');
      if (i === 1) { R(ctx, x + 40, 50, 60, 40, '#3a6a3a'); R(ctx, x + 70, 60, 6, 6, (t >> 4) % 2 ? '#ff5d6c' : '#ffd23f'); }
      else for (let k = 0; k < 6; k++) R(ctx, x + 12, 42 + k * 11, 40 + ((k * 37 + i * 11) % 80), 4, '#5fd7ff');
    }
    R(ctx, 40, ART_H - 70, SW - 80, 16, '#3a3036');
    R(ctx, 40, ART_H - 54, SW - 80, 4, '#2a2228');
    for (let i = 0; i < 9; i++) figure(ctx, 80 + i * 60, ART_H - 72, 2.2, '#0a0a12');
  },
  shelter(ctx, t) {
    R(ctx, 0, 0, SW, ART_H, '#c8b48a');
    R(ctx, 0, 0, SW, 40, '#8a7a5a');
    for (let x = 0; x < SW; x += 40) R(ctx, x, 0, 2, 40, '#6a5a3a');
    R(ctx, 290, 46, 60, 40, '#f0f0f0'); R(ctx, 312, 86, 16, 6, '#d06030');
    R(ctx, 0, 140, SW, ART_H - 140, '#b89a64');
    for (let x = 0; x < SW; x += 32) R(ctx, x, 140, 1, ART_H - 140, '#a08452');
    // cardboard partitions, blankets
    for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) {
      const x = 30 + c * 86 + (r % 2) * 20, y = 150 + r * 34;
      R(ctx, x, y, 60, 4, '#8a6a3a'); R(ctx, x, y, 4, 22, '#8a6a3a');
      R(ctx, x + 8, y + 10, 40, 10, ['#5a7aa8', '#a85a5a', '#6a9a6a', '#a89a5a'][(r + c) % 4]);
    }
    for (let i = 0; i < 5; i++) figure(ctx, 70 + i * 120 + (Math.floor(t / 60) % 2) * 4, 150 + (i % 3) * 34, 2.2, '#3a3040');
  },
  volunteer(ctx, t) {
    sky(ctx, '#9ac4e8', '#e8f0f4');
    skyline(ctx, ART_H - 60, '#8a8a90', 51, 20, 50, 30);
    R(ctx, 0, ART_H - 60, SW, 60, '#7a6648');
    for (let i = 0; i < 9; i++) R(ctx, 30 + i * 70, ART_H - 40 + (i % 2) * 8, 40, 10, '#5a4a32');
    for (let i = 0; i < 6; i++) { const x = 60 + i * 95; figure(ctx, x, ART_H - 30, 2.4, '#2a4a7a'); R(ctx, x + 6, ART_H - 46 + (Math.floor(t / 20 + i) % 2) * 3, 2, 18, '#8a6a3a'); }
  },
  charity(ctx, t) {
    R(ctx, 0, 0, SW, ART_H, '#1a1430');
    for (let i = 0; i < 12; i++) R(ctx, i * 56, 0, 30, ART_H, i % 2 ? '#22183a' : '#1e1634');
    R(ctx, 120, 40, 400, 40, '#ffd23f');
    text(ctx, 'チャリティ', 320, 50, { size: 20, align: 'center', color: '#3a2a10', shadow: null });
    R(ctx, 60, ART_H - 70, SW - 120, 30, '#3a3050');
    for (let i = 0; i < 10; i++) { figure(ctx, 90 + i * 50, ART_H - 70, 2, '#0e0a18'); R(ctx, 84 + i * 50, ART_H - 62, 12, 6, (t >> 3) % 10 === i ? '#5ee07a' : '#d8dcf0'); }
  },
  cabinet(ctx) {
    R(ctx, 0, 0, SW, ART_H, '#2a2018');
    R(ctx, 0, 0, SW, 60, '#3a2c20');
    R(ctx, 60, 130, SW - 120, 40, '#5a3a22');
    R(ctx, 60, 126, SW - 120, 6, '#7a5a3a');
    for (let i = 0; i < 10; i++) { figure(ctx, 90 + i * 52, 128, 2.2, '#0e0a08'); figure(ctx, 90 + i * 52, 200, 2.4, '#0e0a08'); }
  },
  fukko(ctx, t) {
    sky(ctx, '#f6c890', '#9ad0f0');
    R(ctx, 0, ART_H - 60, SW, 60, '#6a8a5a');
    for (let i = 0; i < 8; i++) { const x = 30 + i * 76; R(ctx, x, ART_H - 96, 50, 40, '#e8e0d0'); R(ctx, x - 4, ART_H - 104, 58, 10, '#a85a3a'); R(ctx, x + 20, ART_H - 80, 10, 24, '#7a5a3a'); }
    R(ctx, 520, 40, 4, 120, '#d0a020'); R(ctx, 460, 40, 120, 4, '#d0a020'); R(ctx, 470 + (t / 3) % 90, 44, 2, 30, '#4a4a4a');
  },
  pko(ctx, t) {
    sky(ctx, '#e8c890', '#f4e8c8');
    R(ctx, 0, ART_H - 70, SW, 70, '#c8a868');
    for (let i = 0; i < 4; i++) { const x = 60 + i * 140 + ((t / 2) % 20); R(ctx, x, ART_H - 60, 70, 26, '#f0f0f0'); R(ctx, x + 50, ART_H - 72, 20, 14, '#f0f0f0'); R(ctx, x + 6, ART_H - 36, 12, 12, '#2a2a2a'); R(ctx, x + 50, ART_H - 36, 12, 12, '#2a2a2a'); }
    text(ctx, 'PKO', 120, 30, { size: 14, color: '#3a3a3a', shadow: null });
  },
  sea(ctx, t) {
    sky(ctx, '#8ab0d0', '#d0e0ec');
    R(ctx, 0, 120, SW, ART_H - 120, '#2a5a8a');
    for (let x = 0; x < SW; x += 10) R(ctx, x, 124 + Math.sin((x + t) / 18) * 2, 6, 2, '#6a9ac0');
    // the patrol ship and a small ship far away
    const px = 120 + Math.sin(t / 80) * 6;
    R(ctx, px, 140, 160, 18, '#f0f0f0'); R(ctx, px + 40, 120, 60, 20, '#f0f0f0'); R(ctx, px, 152, 160, 4, '#2a4a8a');
    R(ctx, 470, 150, 50, 10, '#3a3a3a'); R(ctx, 485, 140, 16, 10, '#3a3a3a');
  },
  referendum(ctx, t, s) {
    R(ctx, 0, 0, SW, ART_H, '#1e2436');
    // the count: a yes / no bar and the segments
    const yes = Number(s.numbers && s.numbers.yes) || 0;
    const k = Math.min(1, t / 90);
    panel(ctx, 60, 70, SW - 120, 58, { bg: '#121a2e' });
    const w = SW - 160;
    R(ctx, 80, 94, w, 16, '#7a4a52');
    R(ctx, 80, 94, Math.round((w * yes * k) / 100), 16, '#5fd7ff');
    R(ctx, 80 + w / 2 - 1, 90, 2, 24, '#ffd23f');
    text(ctx, `賛成 ${(Math.round(yes * k * 10) / 10).toFixed(1)}%`, 80, 77, { size: 12, color: '#5fd7ff' });
    text(ctx, `反対 ${(Math.round((100 - yes) * k * 10) / 10).toFixed(1)}%`, 80 + w, 77, { size: 12, color: '#ff9aa6', align: 'right' });
    text(ctx, '過半数', 80 + w / 2, 77, { size: 10, color: '#ffd23f', align: 'center' });
    const seg = s.bySeg || {};
    const ids = Object.keys(seg);
    const x0 = Math.round((SW - ids.length * 52) / 2);
    text(ctx, '層ごとの賛成', x0, 138, { size: 10, color: '#d8dcf0' });
    ids.forEach((id, i) => {
      const x = x0 + i * 52 + 10, h = Math.round(((seg[id] || 0) / 100) * 80 * k);
      R(ctx, x, 154, 30, 80 - h, '#3a3a4a');
      R(ctx, x, 234 - h, 30, h, '#5fd7ff');
      R(ctx, x - 2, 154 + 40, 34, 1, '#ffd23f');
      text(ctx, SEG_SHORT[id] || id, x + 15, 238, { size: 10, align: 'center', color: '#d8dcf0' });
    });
  },
  emergency(ctx, t) {
    R(ctx, 0, 0, SW, ART_H, '#0e101a');
    skyline(ctx, ART_H, '#1a1c28', 61, 40, 160, 24);
    windows(ctx, ART_H, 61, '#5a5a3a', t);
    // a row of TV screens showing the same podium
    for (let i = 0; i < 4; i++) {
      const x = 50 + i * 140;
      R(ctx, x, 60, 120, 80, '#2a2a2a');
      R(ctx, x + 6, 66, 108, 66, '#3a4a6a');
      R(ctx, x + 50, 96, 20, 30, '#6a5a3a');
      figure(ctx, x + 60, 96, 2.2, '#101018');
      R(ctx, x + 6, 120, 108, 12, '#c0302a');
      text(ctx, '緊急事態宣言', x + 60, 120, { size: 10, align: 'center', color: '#ffffff', shadow: null });
    }
  },
  diet_closed(ctx, t) {
    sky(ctx, '#3a3a48', '#6a6a78');
    // a large public building with a central tower (generic), a closed gate
    R(ctx, 120, 120, 400, 90, '#9a968a');
    R(ctx, 270, 60, 100, 60, '#a8a498');
    R(ctx, 295, 30, 50, 30, '#b0aca0');
    R(ctx, 312, 16, 16, 14, '#b8b4a8');
    for (let i = 0; i < 14; i++) R(ctx, 132 + i * 28, 136, 6, 60, '#7a766a');
    R(ctx, 0, 210, SW, ART_H - 210, '#4a4a50');
    for (let x = 100; x < 540; x += 10) R(ctx, x, 196, 3, 40, '#2a2a30');
    R(ctx, 100, 196, 440, 3, '#2a2a30');
    R(ctx, 150, 178, 64, 16, '#e8e0c8');
    text(ctx, '閉鎖', 182, 179, { size: 12, align: 'center', color: '#8a2020', shadow: null });
  },
  court(ctx) {
    R(ctx, 0, 0, SW, ART_H, '#2a1e16');
    R(ctx, 0, 0, SW, 70, '#3a2a1e');
    R(ctx, 80, 90, SW - 160, 50, '#5a3a22');
    R(ctx, 80, 86, SW - 160, 6, '#7a5a36');
    for (let i = 0; i < 15; i++) figure(ctx, 110 + i * 30, 90, 2, '#0a0806');
    for (let i = 0; i < 8; i++) figure(ctx, 100 + i * 60, 230, 2.6, '#14100c');
  },
  army(ctx) {
    sky(ctx, '#5a6070', '#8a909a');
    R(ctx, 0, 180, SW, ART_H - 180, '#5a5a4a');
    R(ctx, 200, 120, 12, 80, '#3a3a36'); R(ctx, 428, 120, 12, 80, '#3a3a36');
    R(ctx, 200, 110, 240, 20, '#2a2a28');
    R(ctx, 236, 113, 168, 14, '#e8e4d8');
    text(ctx, '国軍　駐屯地', 320, 113, { size: 10, align: 'center', color: '#2a2a28', shadow: null });
    for (let i = 0; i < 7; i++) figure(ctx, 60 + i * 80, 220, 2.4, '#2a3020');
  },
  war(ctx, t, s, g) {
    R(ctx, 0, 0, SW, ART_H, '#1a2a3a');
    for (let y = 0; y < ART_H; y += 16) R(ctx, 0, y, SW, 1, '#1e3044');
    for (let x = 0; x < SW; x += 16) R(ctx, x, 0, 1, ART_H, '#1e3044');
    // abstract map: our coast (left), the enemy's coast (right), the contested area in the middle
    for (let y = 30; y < ART_H; y += 4) { const w = 120 + Math.sin(y / 18) * 20; R(ctx, 0, y, w, 4, '#4a5a3a'); }
    for (let y = 20; y < ART_H; y += 4) { const w = 130 + Math.cos(y / 22) * 22; R(ctx, SW - w, y, w, 4, '#5a4a3a'); }
    for (let i = 0; i < 5; i++) R(ctx, 290 + (i % 3) * 22, 110 + i * 14, 14, 8, '#6a6a4a');
    const w = (g && g.war && g.war()) || null;
    const enemy = w ? w.enemyShort || (FICTIONAL_NATIONS[w.enemy] || {}).short : null;
    text(ctx, w ? w.area : DISPUTED_AREA.name, 320, 190, { size: 12, align: 'center', color: '#d8dcf0' });
    text(ctx, '日本', 40, 140, { size: 12, color: '#f2eee2' });
    if (enemy) text(ctx, enemy, SW - 60, 140, { size: 12, color: '#f2eee2', align: 'center' });
    if (w && w.allies && w.allies.length) text(ctx, `味方：${w.allies.map((a) => a.name).join('・')}`.slice(0, 18), 12, 26, { size: 10, color: '#9ad0ff' });
    if (w && w.foes && w.foes.length) text(ctx, `相手側：${w.foes.map((a) => a.name).join('・')}`.slice(0, 18), SW - 12, 26, { size: 10, color: '#ffb0a0', align: 'right' });
    // the front: a gauge (劣勢 ← → 優勢), no people
    const f = w ? w.front : Number(s.front) || 0;
    panel(ctx, 170, 212, 300, 40, { bg: '#121a2e' });
    R(ctx, 186, 234, 268, 6, '#3a3a4a');
    R(ctx, 186 + 134, 230, 2, 14, '#9aa3c7');
    R(ctx, 186 + 134 + Math.round((clamp(f, -100, 100) / 100) * 132) - 3, 230, 6, 14, f >= 0 ? '#5fd7ff' : '#ff5d6c');
    text(ctx, '劣勢', 186, 218, { size: 10, color: '#ff5d6c' });
    text(ctx, '戦況', 320, 218, { size: 10, color: '#d8dcf0', align: 'center' });
    text(ctx, '優勢', 454, 218, { size: 10, color: '#5fd7ff', align: 'right' });
    if (w) {
      panel(ctx, SW - 210, 44, 200, 76, { bg: '#20162a' });
      text(ctx, `兵士の死傷 ${n0(w.cas.soldiers.dead + w.cas.soldiers.wounded)}人`, SW - 198, 54, { size: 12, color: '#ffffff' });
      text(ctx, `民間人の死傷 ${n0(w.cas.civilians.dead + w.cas.civilians.wounded)}人`, SW - 198, 72, { size: 12, color: '#ffffff' });
      text(ctx, `相手国側 ${n0(w.cas.enemySoldiers + w.cas.enemyCivilians)}人`, SW - 198, 90, { size: 12, color: '#d8dcf0' });
    }
  },
  // a battle at a front: the abstract map with the arrow of the attack, no people
  battle(ctx, t, s) {
    R(ctx, 0, 0, SW, ART_H, '#16222e');
    for (let y = 0; y < ART_H; y += 16) R(ctx, 0, y, SW, 1, '#1a2a38');
    for (let x = 0; x < SW; x += 16) R(ctx, x, 0, 1, ART_H, '#1a2a38');
    const b = s.battle || {};
    // the line of the front moves with the result
    const k = Math.min(1, t / 60);
    const fx = 320 + Math.round(((Number(s.front) || 0) / 100) * 200 * k);
    for (let y = 30; y < ART_H - 20; y += 6) R(ctx, fx + (Math.floor(y / 6) % 2) * 2, y, 3, 4, b.win ? '#5fd7ff' : '#ff5d6c');
    // arrows (our side → / their side ←)
    const ax = 120 + ((t * 2) % 160);
    for (let i = 0; i < 3; i++) { const y = 70 + i * 50; R(ctx, ax - 40, y, 40, 4, '#5fd7ff'); for (let j = 0; j < 6; j++) R(ctx, ax + j, y - 6 + j, 2, 16 - j * 2, '#5fd7ff'); }
    const bx = SW - 120 - ((t * 2) % 160);
    for (let i = 0; i < 2; i++) { const y = 95 + i * 50; R(ctx, bx, y, 40, 4, '#ff7a6a'); for (let j = 0; j < 6; j++) R(ctx, bx - j, y - 6 + j, 2, 16 - j * 2, '#ff7a6a'); }
    // smoke puffs far away
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 10; i++) { const x = (i * 71 + t) % SW, y = 40 + (i * 37) % 150; R(ctx, x, y, 18, 10, '#5a5a62'); }
    ctx.globalAlpha = 1;
    if (b.name) {
      panel(ctx, 170, ART_H - 70, 300, 56, { bg: '#121a2e' });
      text(ctx, `${b.name}：${b.win ? '前進' : '後退'}（見込み${b.odds}%）`, 320, ART_H - 62, { size: 12, align: 'center', color: b.win ? '#5fd7ff' : '#ff9aa6' });
      text(ctx, `死者 自国${n0(b.sd)}人・相手側${n0(b.ed)}人`, 320, ART_H - 42, { size: 12, align: 'center', color: '#ffffff' });
    }
  },
  // the player's front: dusk, a trench line far away, silhouettes from behind, smoke (no violence drawn)
  front(ctx, t) {
    sky(ctx, '#2a2a3a', '#7a5a4a');
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 12; i++) { const x = (i * 57 + t * 0.3) % (SW + 60) - 30; R(ctx, x, 60 + (i % 4) * 18, 50, 14, '#3a3236'); }
    ctx.globalAlpha = 1;
    R(ctx, 0, 170, SW, ART_H - 170, '#3a3226');
    for (let x = 0; x < SW; x += 12) R(ctx, x, 168 + Math.round(Math.sin(x / 30) * 3), 10, 6, '#2a241c');
    for (let x = 20; x < SW; x += 70) { R(ctx, x, 150, 2, 22, '#2a2420'); R(ctx, x + 2, 152, 26, 2, '#2a2420'); }
    for (let i = 0; i < 6; i++) figure(ctx, 70 + i * 95, 200, 2.2, '#141210');
    if (Math.floor(t / 40) % 5 === 0) { ctx.globalAlpha = 0.25; R(ctx, 0, 0, SW, ART_H, '#ffb070'); ctx.globalAlpha = 1; }
  },
  // a telegram / a letter: the notice of a death (no detail)
  telegram(ctx) {
    R(ctx, 0, 0, SW, ART_H, '#2a2622');
    R(ctx, 170, 40, 300, 180, '#efe6d0');
    R(ctx, 170, 40, 300, 22, '#a8a090');
    text(ctx, '通知', 320, 44, { size: 12, align: 'center', color: '#2a2a2a', shadow: null });
    for (let y = 80; y < 200; y += 16) R(ctx, 190, y, 260, 1, '#cfc4a8');
    R(ctx, 380, 170, 40, 40, '#b03a30'); R(ctx, 384, 174, 32, 32, '#efe6d0'); R(ctx, 388, 178, 24, 24, '#b03a30');
  },
  // the call-up paper
  conscript(ctx) {
    R(ctx, 0, 0, SW, ART_H, '#24202a');
    R(ctx, 200, 36, 240, 190, '#e8b8a8');
    R(ctx, 200, 36, 240, 26, '#c06858');
    text(ctx, '召集令状', 320, 41, { size: 16, align: 'center', color: '#3a1a14', shadow: null });
    for (let y = 80; y < 210; y += 14) R(ctx, 220, y, 180 + (y % 3) * 10, 2, '#a07060');
  },
  // a new party's press conference (a banner and a table; silhouettes)
  breakaway(ctx, t) {
    R(ctx, 0, 0, SW, ART_H, '#1a2030');
    R(ctx, 120, 40, 400, 46, '#e8e0c8');
    text(ctx, '新党結成', 320, 52, { size: 20, align: 'center', color: '#3a2a4a', shadow: null });
    R(ctx, 100, 150, 440, 30, '#5a3a2a');
    for (let i = 0; i < 7; i++) figure(ctx, 150 + i * 58, 150, 2.4, '#0c0e16');
    for (let i = 0; i < 12; i++) { const fl = (Math.floor(t / 8) + i * 3) % 17 === 0; if (fl) R(ctx, 40 + i * 50, 210 + (i % 3) * 8, 8, 6, '#ffffff'); figure(ctx, 44 + i * 50, 240, 2, '#1c1e28'); }
  },
  // a summit: a long round table, flags omitted (name boards), silhouettes
  summit(ctx, t) {
    R(ctx, 0, 0, SW, ART_H, '#1c2638');
    R(ctx, 0, 0, SW, 70, '#26324a');
    for (let i = 0; i < 8; i++) R(ctx, 40 + i * 76, 20, 50, 30, '#34425e');
    // the table (an ellipse of boxes)
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; R(ctx, 320 + Math.cos(a) * 200 - 8, 160 + Math.sin(a) * 60 - 4, 16, 8, '#6a4a2a'); }
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.3; figure(ctx, 320 + Math.cos(a) * 225, 160 + Math.sin(a) * 75 + 10, 2.2, '#0c0e16'); R(ctx, 320 + Math.cos(a) * 185 - 8, 160 + Math.sin(a) * 50 - 4, 16, 6, '#e8e8e8'); }
    if (Math.floor(t / 30) % 3 === 0) R(ctx, 300, 150, 40, 3, '#ffd23f');
  },
  // the signing of a treaty
  treaty(ctx) {
    R(ctx, 0, 0, SW, ART_H, '#2a2218');
    R(ctx, 0, 0, SW, 60, '#3a2e20');
    R(ctx, 140, 130, 360, 40, '#6a4a2a'); R(ctx, 140, 126, 360, 6, '#8a6a3a');
    R(ctx, 250, 118, 60, 10, '#f2eee2'); R(ctx, 330, 118, 60, 10, '#f2eee2');
    figure(ctx, 270, 128, 2.6, '#0e0a08'); figure(ctx, 370, 128, 2.6, '#0e0a08');
    for (let i = 0; i < 9; i++) figure(ctx, 90 + i * 60, 230, 2.2, '#16120e');
  },
  // the UN General Assembly hall (rows of desks, the rostrum)
  un(ctx) {
    R(ctx, 0, 0, SW, ART_H, '#1a2a3a');
    R(ctx, 230, 20, 180, 70, '#c8a868'); R(ctx, 250, 30, 140, 50, '#d8bc80');
    for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) R(ctx, 40 + c * 42 + (r % 2) * 10, 120 + r * 26, 30, 8, '#4a5a6a');
    for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) figure(ctx, 55 + c * 42 + (r % 2) * 10, 120 + r * 26, 1.2, '#0e1622');
  },
  demo(ctx, t) {
    sky(ctx, '#3a3048', '#7a6070');
    skyline(ctx, 150, '#2a2434', 71, 30, 110, 20);
    R(ctx, 0, 150, SW, ART_H - 150, '#3a3438');
    crowd(ctx, 10, SW - 10, 160, ART_H - 6, 7, t, ['#141018', '#1c1822', '#24202a'], 0.12);
    const words = ['選挙を返せ', '報道の自由', '戦争反対', '国会を開け', '言論の自由', '独裁反対'];
    for (let i = 0; i < words.length; i++) placard(ctx, 64 + i * 102, 146 + (i % 2) * 16, words[i], t);
  },
  newspaper(ctx, t, s) {
    R(ctx, 0, 0, SW, ART_H, '#2a2a30');
    paperArt(ctx, s.headline || '', s.sub2 || '');
  },
  letter(ctx) {
    R(ctx, 0, 0, SW, ART_H, '#3a3028');
    R(ctx, 160, 30, 320, 200, '#f4ecd8');
    for (let y = 50; y < 220; y += 16) R(ctx, 176, y, 288, 1, '#d8ccb0');
  },
};
function paperArt(ctx, headline, sub) {
  // a newspaper of the fictional ドット新聞, the headline in large type
  const x0 = 150, y0 = 44, w = 380, h = 210, cx = x0 + w / 2;
  R(ctx, x0 + 4, y0 + 4, w, h, '#0a0a0e');
  R(ctx, x0, y0, w, h, '#f2eee2');
  text(ctx, 'ドット新聞', cx, y0 + 6, { size: 16, align: 'center', color: '#2a2a2a', shadow: null });
  R(ctx, x0 + 12, y0 + 28, w - 24, 2, '#2a2a2a');
  const lines = wrap(ctx, headline, w - 40, 24);
  lines.slice(0, 2).forEach((l, i) => text(ctx, l, cx, y0 + 38 + i * 30, { size: 24, align: 'center', color: '#8a1a1a', shadow: null }));
  if (sub) text(ctx, sub, cx, y0 + 100, { size: 12, align: 'center', color: '#2a2a2a', shadow: null });
  for (let y = y0 + 122; y < y0 + h - 8; y += 8) R(ctx, x0 + 16, y, 160 + (y % 3) * 10, 2, '#a8a294');
  // the photo: a crowd far away, grey newsprint
  const px = x0 + w - 176, py = y0 + 120;
  R(ctx, px, py, 160, 80, '#b8b2a4');
  R(ctx, px, py, 160, 28, '#cac4b6');
  for (let x = px + 4; x < px + 156; x += 9) R(ctx, x, py + 18 - Math.floor(hash2(x, 3, 5) * 14), 7, 14 + Math.floor(hash2(x, 3, 5) * 14), '#8a857a');
  crowd(ctx, px + 4, px + 156, py + 40, py + 78, 21, 0, ['#4a463e', '#5a554c', '#3e3a34'], 0.12);
}
function alertOverlay(ctx, t, alert) {
  const blink = Math.floor(t / 12) % 2 === 0;
  if (alert.kind === 'phone') {
    // a phone in front with the red alert banner
    const x = 460, y = 30;
    R(ctx, x, y, 120, 210, '#14161e');
    R(ctx, x + 6, y + 14, 108, 182, '#e8ecf0');
    R(ctx, x + 6, y + 40, 108, 46, blink ? '#d02a2a' : '#a01a1a');
    const lines = wrap(ctx, alert.text, 100, 12);
    lines.slice(0, 3).forEach((l, i) => text(ctx, l, x + 60, y + 44 + i * 14, { size: 12, align: 'center', color: '#ffffff', shadow: null }));
    for (let i = 0; i < 5; i++) R(ctx, x + 14, y + 100 + i * 12, 70 + (i % 2) * 20, 4, '#9aa0aa');
  } else {
    // a TV with a red テロップ
    const x = 430, y = 40;
    R(ctx, x, y, 180, 130, '#1a1a1a');
    R(ctx, x + 8, y + 8, 164, 104, '#3a4a6a');
    R(ctx, x + 8, y + 78, 164, 24, blink ? '#d02a2a' : '#a01a1a');
    text(ctx, alert.text, x + 90, y + 84, { size: 12, align: 'center', color: '#ffffff', shadow: null });
    R(ctx, x + 60, y + 130, 60, 8, '#1a1a1a');
  }
}

// ======================================================================== the scene
// The scenes animate with g.frame: the message window is the top scene, so this one is not updated.
class KikiScene {
  constructor(g, spec) { Object.assign(this, { g, spec, f0: g.frame, hd: true, opaque: true, hidesHud: true }); }
  get t() { return this.g.frame - this.f0; }
  update() { /* animated by g.frame */ }
  draw(ctx, g) {
    const s = this.spec;
    const fn = ARTS[s.art] || ARTS.newspaper;
    try { fn(ctx, this.t, s, g); } catch (e) { console.error(e); R(ctx, 0, 0, SW, SH, '#101018'); }
    R(ctx, 0, ART_H, SW, SH - ART_H, '#0a0c14');
    if (s.headline && s.art !== 'newspaper') {
      const w = Math.min(SW - 40, measure(ctx, s.headline, 16) + 30);
      panel(ctx, (SW - w) / 2, ART_H - 44, w, 34, { bg: '#f2eee2', edge: '#2a2a2a' });
      text(ctx, s.headline, SW / 2, ART_H - 35, { size: 16, align: 'center', color: '#8a1a1a', shadow: null });
    }
    if (s.numbers && s.numbers.dead != null) numbersBox(ctx, s.numbers, s.alert ? 8 : SW - 196, s.alert ? 66 : 44);
    titleBox(ctx, s.title, s.sub);
    dateBox(ctx, g);
  }
}
async function showSpec(g, spec) {
  const sc = new KikiScene(g, spec);
  g.push(sc);
  if (['quake', 'tsunami'].includes(spec.art) && spec.home && typeof g.shake === 'function') g.shake(50, 3);
  if (spec.alert) { try { audio.sfx('buzz'); } catch (e) { /* no audio */ } }
  try {
    if (spec.pages && spec.pages.length) await sayJ(g, spec.pages);
    let v = null;
    if (spec.options && spec.options.length) {
      const i = await g.ask(wrapPage(g, spec.prompt || 'どうする？'), spec.options.map((o) => o.label), { cancel: spec.options.length - 1 });
      v = spec.options[i] ? spec.options[i].value : null;
    }
    // the outcome of the choice is told while the scene is still up
    if (typeof spec.then === 'function') await spec.then(v);
    return v;
  } finally {
    g.pop(sc);
  }
}

// ======================================================================== the downfall (abstract, non-graphic)
class DownfallScene {
  constructor(g, rec, stage) { Object.assign(this, { g, rec, stage, f0: g.frame, hd: true, opaque: true, hidesHud: true }); }
  get t() { return this.g.frame - this.f0; }
  update() { /* animated by g.frame */ }
  draw(ctx) {
    const t = this.t;
    if (this.stage === 'square') {
      // dusk; a city far away; a great crowd seen from behind, filling a square. Nothing else is shown.
      sky(ctx, '#2a1e3a', '#b0603a', ART_H, 16);
      for (let i = 0; i < 3; i++) { const x = 80 + i * 220; ctx.globalAlpha = 0.35; for (let k = 0; k < 14; k++) R(ctx, x + Math.sin((t + k * 20) / 40) * 6 - k, 40 + k * 6, 10 + k, 6, '#4a3a40'); ctx.globalAlpha = 1; }
      skyline(ctx, 150, '#1a1420', 81, 30, 100, 22);
      windows(ctx, 150, 81, '#6a4a2a', t);
      R(ctx, 0, 150, SW, ART_H - 150, '#2a2024');
      crowd(ctx, 0, SW, 152, ART_H - 4, 13, t, ['#0c0a10', '#141018', '#1a1620'], 0.1);
      text(ctx, '首都の広場', 20, 16, { size: 12, color: '#d8c8b8' });
    } else if (this.stage === 'paper') {
      R(ctx, 0, 0, SW, ART_H, '#1a1a20');
      paperArt(ctx, '独裁体制が崩壊', `「${this.rec.label}」体制、${this.rec.cause === 'uprising' ? '民衆の蜂起で' : '敗戦で'}終わる`);
    } else {
      R(ctx, 0, 0, SW, ART_H, '#050508');
    }
    R(ctx, 0, ART_H, SW, SH - ART_H, '#050508');
  }
}
async function downfall(g, rec) {
  const lines = downfallText(g, rec);
  try { audio.bgm(null); } catch (e) { /* no audio */ }
  const sq = new DownfallScene(g, rec, 'square');
  g.push(sq);
  try {
    await sayJ(g, [lines[0], lines[1]]);
  } finally { g.pop(sq); }
  const pp = new DownfallScene(g, rec, 'paper');
  g.push(pp);
  try {
    await sayJ(g, lines[2]);
  } finally { g.pop(pp); }
  const bk = new DownfallScene(g, rec, 'black');
  g.push(bk);
  try {
    await sayJ(g, lines[3]);
  } finally { g.pop(bk); }
}

// ======================================================================== the end of a life at the front (戦死)
class KiaScene {
  constructor(g, rec, stage) { Object.assign(this, { g, rec, stage, f0: g.frame, hd: true, opaque: true, hidesHud: true }); }
  get t() { return this.g.frame - this.f0; }
  update() { /* animated by g.frame */ }
  draw(ctx) {
    const t = this.t;
    if (this.stage === 'front') ARTS.front(ctx, t, {}, this.g);
    else if (this.stage === 'paper') { R(ctx, 0, 0, SW, ART_H, '#1a1a20'); paperArt(ctx, `${this.rec.name}、戦死`, `${this.rec.where || '前線'}で（${this.rec.date}）`); }
    else R(ctx, 0, 0, SW, ART_H, '#050508');
    R(ctx, 0, ART_H, SW, SH - ART_H, '#050508');
  }
}
async function kia(g, rec) {
  try { audio.bgm(null); } catch (e) { /* no audio */ }
  const stages = [
    ['front', ['砲声が、すぐそばまで近づいていた。', 'まぶしい光のあと、あたりは静かになった。']],
    ['paper', [`${rec.name}は、${rec.where || '前線'}で戦死した。`, '知らせを受けた家族は、言葉を失った。']],
    ['black', ['こうして、この人生の物語は終わった。']],
  ];
  for (const [stage, pages] of stages) {
    const sc = new KiaScene(g, rec, stage);
    g.push(sc);
    try { await sayJ(g, pages); } finally { g.pop(sc); }
  }
}

// ======================================================================== the record card (then the title)
class RecordScene {
  constructor(g, rec, resolve) { Object.assign(this, { g, rec, resolve, t: 0, hd: true, opaque: true, hidesHud: true }); }
  update(g) {
    this.t++;
    if (g.auto || (this.t > 40 && (g.input.pressed('a') || g.input.pressed('b')))) { g.pop(this); this.resolve(); }
  }
  draw(ctx) {
    const r = this.rec;
    R(ctx, 0, 0, SW, SH, '#0b0d1a');
    panel(ctx, 70, 20, SW - 140, SH - 40, { bg: '#121a3a' });
    text(ctx, 'この人生の記録', SW / 2, 34, { size: 16, align: 'center', color: COLORS.accent });
    const kia = r.cause === 'kia';
    const rows = [
      ['名前', r.name],
      ['最後の日', `${r.date}（${r.days}日目）`],
      r.pmDays || !kia ? ['総理大臣として', `${r.pmDays}日`] : null,
      ['体制', `${REGIME_INFO[r.maxRegime] ? REGIME_INFO[r.maxRegime].name : r.maxRegime}（${r.label}）`],
      ['終わり方', kia ? `戦死（${r.where || '前線'}）` : r.cause === 'uprising' ? '民衆の蜂起' : r.cause === 'surrender' ? '降伏' : '敗戦'],
      ['戦争', `${r.wars}回・戦費 約${r.cost}兆円`],
      ['死者（自国）', `兵士 ${n0(r.soldiers)}人・民間人 ${n0(r.civilians)}人`],
      ['死傷者（相手国側）', `${n0(r.enemy)}人`],
      ['けが人（自国）', `${n0(r.wounded)}人`],
      r.knownKia ? ['戦死した知り合い', `${n0(r.knownKia)}人`] : null,
      kia ? null : ['拘束された記者', `${n0(r.detained)}人`],
      ['報道の自由度', `${r.press}／100`],
      ['国際社会の制裁', r.sanctions ? `段階${r.sanctions}` : 'なし'],
    ].filter(Boolean);
    rows.forEach(([k, v], i) => {
      text(ctx, k, 96, 62 + i * 19, { size: 12, color: '#9aa3c7' });
      text(ctx, String(v), 250, 62 + i * 19, { size: 12, color: '#ffffff' });
    });
    if (this.t > 40) text(ctx, 'A：タイトルへ（セーブデータはそのまま）', SW / 2, SH - 42, { size: 12, align: 'center', color: Math.floor(this.t / 30) % 2 ? COLORS.cyan : '#ffffff' });
  }
}
function record(g, rec) { return new Promise((resolve) => g.push(new RecordScene(g, rec, resolve))); }

KIKI.show = showSpec;
KIKI.wrap = wrapPage;
KIKI.downfall = downfall;
KIKI.record = record;
KIKI.kia = kia;

// ======================================================================== the phone app 「危機管理」
const APP_COLOR = '#8a3a4a';
const short = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
// An info page of the app. Drawn here (same look and scrolling as phone.js infoView) so that no number is broken
// across lines (「けが人5,260人」「住宅被害52,143棟」 stay whole).
async function info(g, title, lines) {
  const src = [].concat(lines).filter((l) => l != null).join('\n');
  let cache = null;
  await phoneInfo(g, {
    title, color: APP_COLOR, lines,
    draw(c, a, view) {
      const w = a.w - 20;
      if (!cache || cache.w !== w) cache = { w, ls: jwrap(c, g.fmt(src), w, 12) };
      const ls = cache.ls;
      view.maxScroll = Math.max(0, ls.length * 16 + 16 - a.h);
      view.sy = clamp(view.sy || 0, 0, view.maxScroll);
      c.save();
      c.beginPath();
      c.rect(a.x, a.y, a.w, a.h);
      c.clip();
      ls.forEach((l, i) => { const y = a.y + 8 + i * 16 - view.sy; if (y > a.y - 16 && y < a.y + a.h) phoneText(c, l, a.x + 10, y, 12, PC.text); });
      c.restore();
      if (view.maxScroll > 0 && view.sy < view.maxScroll) downArrow(c, a.x + a.w - 14, a.y + a.h - 10, g.frame || 0, PC.dim);
    },
  });
}
// a list of actions: [{ id, name, desc, why }] → run(id) on a pick (a refused one explains why)
async function actionList(g, title, getList, run, opts = {}) {
  let index = 0;
  for (;;) {
    const list = getList();
    if (!list.length) { await info(g, title, [opts.empty || 'いまできることはない。']); return; }
    const i = await phoneList(g, {
      title, color: APP_COLOR, index,
      items: list.map((a) => ({ label: short(a.name, 13), right: a.why ? '×' : '○', sub: a.why ? 'いまはできない' : 'できる' })),
      describe: (k) => (list[k] ? short(list[k].desc, 34) : ''),
    });
    if (i < 0) return;
    index = i;
    const a = list[i];
    if (a.why) { await info(g, a.name, [a.desc, '', `できない理由：${a.why}`]); continue; }
    const c = await phoneConfirm(g, { title: a.name, color: APP_COLOR, text: `${a.desc}\n\n実行する？`, choices: ['実行する', 'やめる'] });
    if (c !== 0) continue;
    const res = await run(a.id);
    if (res && (res.text || res.why)) await info(g, a.name, [res.text || res.why]);
    if (typeof g.regimeFlush === 'function') await g.regimeFlush();
    if (opts.once) return;
  }
}
function overviewLines(g) {
  const r = g.regime();
  const pf = g.pressFreedom();
  const out = [`体制：${r.name}`, `（${r.label}）`];
  out.push(`報道の自由度：${pf.value}（${pf.label}）`);
  if (r.unrest) out.push(`民衆の不満：${r.unrest}／100`);
  if (r.intl) out.push(`国際社会の懸念：${r.intl}／100${r.sanctions ? `（制裁 段階${r.sanctions}）` : ''}`);
  const d = g.disaster();
  if (d) out.push('', `【災害】${d.name}（${d.tierName}）`, d.summary);
  const w = g.war();
  if (w) out.push('', `【戦争】${w.enemyName}`, `戦況：${w.frontText}`);
  out.push('', ...g.sdf().lines.slice(0, 3));
  return out;
}
function newsLines(g) {
  const list = g.regimeNews(14);
  if (!list.length) return ['まだニュースはない。'];
  return list.map((n) => `・${n.text}`);
}
function pressLines(g) {
  const pf = g.pressFreedom();
  const hist = pf.history.slice(-8).map((h) => `${h.day}日目 ${h.v}${h.why ? `（${h.why}）` : ''}`);
  return [`報道の自由度：${pf.value}／100（${pf.label}）`, '報道への圧力や検閲で下がり、民主制では時間とともに戻る。', '', ...(hist.length ? ['推移：', ...hist] : [])];
}
const isPMg = (g) => { try { const p = g.pol && g.pol(); return !!(p && p.me && (p.me.posts || []).includes('pm')); } catch (e) { return false; } };
export async function kikiApp(g) {
  if (typeof g.regime !== 'function') { await info(g, '危機管理', ['（体制・安全保障の仕組みが読み込まれていない）']); return; }
  let index = 0;
  for (;;) {
    const d = g.disaster();
    const r = g.regime();
    const entries = [
      ['overview', '概況', r.name],
      d ? ['disaster', '災害対応', short(d.name, 12)] : null,
      ['sdf', '自衛隊・防衛', r.steps.army && r.id === 'dictatorship' ? '国軍' : '状況と命令'],
      ['press', '報道の自由', `${g.pressFreedom().value}`],
      ['regime', '体制', r.id === 'democracy' ? '民主制' : r.name],
      r.id === 'dictatorship' || g.war() || isPMg(g) ? ['war', '戦争', g.war() ? g.war().frontText : '開戦前'] : null,
      ['nations', '関係国', 'ヴェルミナ海'],
      ['news', 'ニュース', ''],
      typeof g.advisorOpen === 'function' ? ['dokusai', '独裁くん', r.id === 'democracy' ? '次の一手・リスク' : '権力の維持'] : null,
      typeof g.advisorOpen === 'function' ? ['ikusa', 'イクサくん', g.war() ? '戦況・次の命令' : '開戦の前に'] : null,
    ].filter(Boolean);
    const i = await phoneList(g, { title: '危機管理', color: APP_COLOR, index, items: entries.map(([, label, sub]) => ({ label, sub })) });
    if (i < 0) return;
    index = i;
    const id = entries[i][0];
    if (id === 'overview') await info(g, '概況', overviewLines(g));
    else if (id === 'disaster') {
      const dd = g.disaster();
      if (dd) await info(g, dd.name, [`${dd.tierName}・${dd.where}`, dd.summary, dd.honbuName ? `政府：${dd.honbuName}` : '政府：対策本部はまだない', '', ...dd.log.slice(-6).map((l) => `${l.day}日目 ${l.text}`)]);
      await actionList(g, '災害対応', () => g.disasterActions(), (aid) => g.disasterAction(aid), { empty: 'いまの立場でできる対応はない。' });
    } else if (id === 'sdf') {
      await info(g, '自衛隊・防衛', g.sdf().lines);
      await actionList(g, '自衛隊への命令', () => g.sdfOrders(), (oid) => g.sdfOrder(oid));
    } else if (id === 'press') {
      await info(g, '報道の自由', pressLines(g));
      await actionList(g, '報道', () => g.pressActions(), (pid) => g.pressAction(pid));
    } else if (id === 'regime') {
      const rr = g.regime();
      await info(g, '体制', [`いまの体制：${rr.long}`, `（${rr.label}：${rr.labelWhy}）`, '', '憲法改正は、各院の総議員の3分の2で発議し、国民投票の過半数で決まる（憲法96条）。']);
      await actionList(g, '体制の手続き', () => g.regimeSteps(), (sid) => g.regimeStep(sid));
    } else if (id === 'war') {
      const w = g.war();
      if (w) await info(g, `戦争：${w.enemyName}`, [`${w.modeName}`, `戦域：${w.area}`, `戦況：${w.frontText}`, ...w.fronts.map((f) => `・${f.name}：${f.control >= 0 ? '優勢' : '劣勢'}${Math.abs(f.control)}・兵力約${n0(f.own * 1000)}人・作戦の見込み${f.odds}%`), w.allies.length ? `味方：${w.allies.map((a) => a.name).join('・')}` : null, w.foes.length ? `相手側：${w.foes.map((a) => a.name).join('・')}` : null, `死者 兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人`, `けが人 ${n0(w.cas.soldiers.wounded + w.cas.civilians.wounded)}人`, `相手国側の死傷者 ${n0(w.cas.enemySoldiers + w.cas.enemyCivilians)}人`, `戦費 約${w.cost}兆円・厭戦 ${Math.round(w.weariness)}／100`, ...w.known.map((k) => `${k.rel}の${k.name}（${k.unit}）：${{ front: '前線', called: '召集', wounded: '負傷', kia: '戦死', exempt: '免除', back: '帰還', home: '自宅' }[k.status] || k.status}`)].filter(Boolean));
      else if (typeof g.warPaths === 'function') { const P = g.warPaths(); await info(g, '戦争への道', [P.declare ? P.paths : '宣戦できる（相手国を選ぶ）', P.art9 ? '9条は改正ずみ（国会の承認で宣戦できる）' : null, P.collective ? `集団的自衛権の根拠：${P.collective}` : null, P.attack ? '武力攻撃事態：防衛出動を命じられる（自衛隊・防衛から）' : null].filter(Boolean)); }
      await actionList(g, '戦争', () => g.warOrders(), async (wid) => {
        if (wid === 'declare') {
          const real = typeof g.world === 'function' ? g.world().countries.filter((c) => !c.war) : [];
          const opts = [...real.map((c) => ({ id: c.id, label: c.name, sub: `関係 ${c.relation}・軍事力 ${c.mil}` })), ...NATION_ORDER.map((n) => ({ id: n, label: FICTIONAL_NATIONS[n].name, sub: `国力 ${FICTIONAL_NATIONS[n].power}` }))];
          const k = await phoneList(g, { title: '宣戦の相手', color: APP_COLOR, items: opts.map((o) => ({ label: short(o.label, 13), sub: o.sub })), describe: (x) => (FICTIONAL_NATIONS[opts[x].id] ? short(FICTIONAL_NATIONS[opts[x].id].desc, 34) : opts[x].sub) });
          if (k < 0) return null;
          return g.warOrder('declare', { target: opts[k].id });
        }
        return g.warOrder(wid);
      });
    } else if (id === 'nations') {
      await info(g, '関係国', [...NATION_ORDER.map((n) => `${FICTIONAL_NATIONS[n].name}：${FICTIONAL_NATIONS[n].desc}`), `${DISPUTED_AREA.name}：${DISPUTED_AREA.desc}`]);
    } else if (id === 'news') await info(g, 'ニュース', newsLines(g));
    else if (id === 'dokusai' || id === 'ikusa') await g.advisorOpen(id, 'home');
  }
}

registerPhoneApp('kiki', {
  name: '危機管理', color: APP_COLOR, order: 62,
  icon(ctx, x, y) {
    // a warning triangle with "!" (generic 危機管理 sign). No cross of any kind: a red cross on white is the protected
    // Red Cross emblem (赤十字の標章及び名称等の使用の制限に関する法律), and a cross reads as a religious sign.
    ctx.fillStyle = '#3a1a20';
    for (let i = 0; i < 17; i++) { const hw = 1 + Math.floor(i * 0.62); ctx.fillRect(x + 12 - hw - 1, y + 3 + i, hw * 2 + 2, 1); }
    ctx.fillRect(x + 1, y + 20, 22, 1);
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 16; i++) { const hw = 1 + Math.floor(i * 0.62); ctx.fillRect(x + 12 - hw, y + 4 + i, hw * 2, 1); }
    ctx.fillStyle = '#2a1418';
    ctx.fillRect(x + 11, y + 9, 2, 6);
    ctx.fillRect(x + 11, y + 16, 2, 2);
  },
  badge: (g) => { try { return (g.disaster && g.disaster() ? 1 : 0) + (g.war && g.war() ? 1 : 0); } catch (e) { return 0; } },
  open: (g) => kikiApp(g),
});

