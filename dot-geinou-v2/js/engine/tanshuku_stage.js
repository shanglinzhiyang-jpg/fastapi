// 「短縮鉄道の夜」 (owner C / R7-E): the portrait TV presentation, the voices, the beat-synced music and the art.
//   TvLayer      a full-viewport DOM layer with its own canvas: on a portrait phone the 9:16 frame fills the screen
//                (requestFullscreen + screen.orientation.lock('portrait') on the first tap, both optional); on a
//                landscape screen a centred 9:16 frame between TV-style side panels. Pointer taps map to frame coords.
//   renderTV     draws side panels + the 9:16 frame into any canvas (the layer, or the game's 640x360 canvas as fallback)
//   Voice        speechSynthesis (ja-JP) with pitch/rate per speaker; toggle (localStorage 'dotgeinou_tts'); no-op fallback
//   Ears         SpeechRecognition / webkitSpeechRecognition (ja-JP), optional answering by voice (toggle, default off)
//   Train        the original 'night train' chiptune (registered with registerSong) played step by step on the game's
//                own beat clock so the answer beat and the music never drift; tempo is set per leg
//   sfx          call chime, claps, 正解, ブッブー, 冷却ガス, station chime
//   drawSet …    the train car, scenery, straps, performers, telops, station-sign word card
// The real corner's BGM (Blondie「Atomic」, ゴダイゴ「銀河鉄道999」) is named in api_tanshuku.txt only — never used.

import { audio, registerSong, noteFreq } from './audio.js';
import { text, rect, measure, wrap } from './draw.js';
import { clamp, makeCanvas, shade, mulberry32 } from './util.js';
import { charSheetHD } from './sprites.js';

export const FW = 360, FH = 640, K = 2;
export const INK = '#1a1a26';

// ------------------------------------------------------------------ music
export const SONG = {
  bpm: 112, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.034, notes: 'A4 . E5 . D5 E5 C5 . | B4 . G4 . A4 B4 C5 . | D5 . F5 . E5 D5 C5 . | B4 . E5 . E5 - . . | A4 . E5 . D5 E5 C5 . | B4 . G4 . A4 B4 C5 . | D5 . F5 . E5 D5 B4 . | A4 - - . . . . .' },
    { wave: 'triangle', vol: 0.11, notes: 'A2 . A3 . A2 . A3 . | G2 . G3 . G2 . G3 . | F2 . F3 . F2 . F3 . | E2 . E3 . E2 . G#2 . | A2 . A3 . A2 . A3 . | G2 . G3 . G2 . G3 . | F2 . F3 . E2 . E3 . | A2 . E2 . A2 . . .' },
    { wave: 'square', vol: 0.014, notes: 'A5 . . . E6 . . . | G5 . . . D6 . . . | F5 . . . C6 . . . | E5 . . . B5 . . .' },
    { wave: 'drum', vol: 0.07, notes: 'k h h s k h h s' },
  ],
};
registerSong('tanshuku_night_train', SONG);
registerSong('tanshuku_title', { bpm: 96, step: 0.5, tracks: [SONG.tracks[0], SONG.tracks[1], { wave: 'drum', vol: 0.05, notes: 'k . h . s . h .' }] });

function parseTrack(track) {
  const toks = track.notes.split(/\s+/).filter((t) => t && t !== '|');
  const ev = new Array(toks.length).fill(null);
  let last = -1;
  toks.forEach((t, i) => {
    if (t === '-') { if (last >= 0) ev[last].len++; return; }
    if (t === '.') { last = -1; return; }
    if (track.wave === 'drum') { ev[i] = { drum: t, len: 1 }; last = -1; return; }
    const f = noteFreq(t);
    if (f) { ev[i] = { f, len: 1 }; last = i; }
  });
  return { wave: track.wave, vol: track.vol, ev, n: toks.length };
}
export class Train {
  constructor() { this.tracks = SONG.tracks.map(parseTrack); this.step = 0; this.on = false; this.bpm = SONG.bpm; this.vol = 1; }
  // one 8th-note step (called twice per beat by the game's clock)
  tick() {
    if (!this.on || !audio.ctx || audio.muted) { this.step++; return; }
    const t = audio.ctx.currentTime + 0.02;
    const dur = 60 / this.bpm / 2;
    for (const tr of this.tracks) {
      const e = tr.ev[this.step % tr.n];
      if (!e) continue;
      if (e.drum) audio.drum(e.drum, t, tr.vol * this.vol);
      else audio.tone(e.f, t, dur * e.len * 0.9, { wave: tr.wave, vol: tr.vol * this.vol });
    }
    this.step++;
  }
}
export function sfx(kind) {
  if (!audio.ctx || audio.muted) return;
  const a = audio, t = audio.ctx.currentTime + 0.005;
  const T = (f, s, d, o) => a.tone(f, t + s, d, o);
  switch (kind) {
    case 'call': T(1568, 0, 0.07, { wave: 'square', vol: 0.05 }); T(2093, 0.07, 0.09, { wave: 'square', vol: 0.045 }); break;
    case 'clap': a.noise(t, 0.06, { vol: 0.09, filter: 'bandpass', freq: 1500 }); break;
    case 'ok': [1047, 1319, 1568, 2093].forEach((f, i) => T(f, i * 0.05, 0.09, { wave: 'square', vol: 0.05 })); break;
    case 'just': [1319, 1760, 2637].forEach((f, i) => T(f, i * 0.04, 0.12, { wave: 'triangle', vol: 0.08 })); T(3136, 0.14, 0.2, { wave: 'square', vol: 0.03 }); break;
    case 'miss': T(220, 0, 0.18, { wave: 'square', vol: 0.09 }); T(220, 0.24, 0.32, { wave: 'square', vol: 0.09 }); T(110, 0, 0.56, { wave: 'sawtooth', vol: 0.04 }); break;
    case 'gas': a.noise(t, 1.4, { vol: 0.16, filter: 'highpass', freq: 2500 }); a.noise(t + 0.05, 1.2, { vol: 0.07, filter: 'bandpass', freq: 900 }); break;
    case 'station': [1175, 988, 784].forEach((f, i) => T(f, i * 0.22, 0.38, { wave: 'triangle', vol: 0.08 })); break;
    case 'depart': T(587, 0, 0.5, { wave: 'sine', vol: 0.08, slideTo: 1480 }); a.noise(t + 0.1, 0.6, { vol: 0.05, filter: 'lowpass', freq: 500 }); break;
    case 'dogeza': T(196, 0, 0.12, { wave: 'square', vol: 0.06 }); a.noise(t + 0.1, 0.2, { vol: 0.1, filter: 'lowpass', freq: 400 }); break;
    case 'wipe': a.noise(t, 0.25, { vol: 0.06, filter: 'highpass', freq: 3000 }); T(880, 0, 0.2, { wave: 'sine', vol: 0.03, slideTo: 1760 }); break;
    default: T(880, 0, 0.05, { vol: 0.04 });
  }
}

// ------------------------------------------------------------------ voices
const TTS_KEY = 'dotgeinou_tts';
export class Voice {
  constructor() {
    this.ok = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
    let v = '1';
    try { v = localStorage.getItem(TTS_KEY) ?? '1'; } catch (e) { /* storage blocked */ }
    this.enabled = this.ok && v !== '0';
    this.voice = null;
    this.calls = 0;
  }
  toggle() {
    this.enabled = this.ok && !this.enabled;
    try { localStorage.setItem(TTS_KEY, this.enabled ? '1' : '0'); } catch (e) { /* ignore */ }
    if (!this.enabled) this.cancel();
    return this.enabled;
  }
  pickVoice() {
    if (this.voice || !this.ok) return this.voice;
    try {
      const list = window.speechSynthesis.getVoices() || [];
      this.voice = list.find((v) => /^ja/i.test(v.lang)) || null;
    } catch (e) { this.voice = null; }
    return this.voice;
  }
  speak(str, o = {}) {
    if (!this.enabled || !str) return false;
    try {
      const s = window.speechSynthesis;
      if (o.interrupt) s.cancel();
      const u = new window.SpeechSynthesisUtterance(String(str));
      u.lang = 'ja-JP';
      u.pitch = clamp(o.pitch ?? 1, 0, 2);
      u.rate = clamp(o.rate ?? 1.2, 0.5, 2.5);
      u.volume = clamp(o.volume ?? 1, 0, 1);
      const v = this.pickVoice();
      try { if (v && (typeof window.SpeechSynthesisVoice === 'undefined' || v instanceof window.SpeechSynthesisVoice)) u.voice = v; } catch (e) { /* default voice */ }
      s.speak(u);
      this.calls++;
      return true;
    } catch (e) { return false; }
  }
  cancel() { try { if (this.ok) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
}
export class Ears {
  constructor() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    this.SR = SR || null;
    this.ok = !!SR;
    this.enabled = false;
    this.rec = null;
    this.listening = false;
  }
  toggle() { this.enabled = this.ok && !this.enabled; if (!this.enabled) this.stop(); return this.enabled; }
  start(onText) {
    if (!this.enabled || !this.ok || this.listening) return;
    try {
      const r = new this.SR();
      r.lang = 'ja-JP';
      r.interimResults = true;
      r.maxAlternatives = 3;
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) for (let k = 0; k < e.results[i].length; k++) onText(e.results[i][k].transcript);
      };
      r.onend = () => { this.listening = false; };
      r.onerror = () => { this.listening = false; };
      r.start();
      this.rec = r;
      this.listening = true;
    } catch (e) { this.listening = false; }
  }
  stop() { try { if (this.rec) this.rec.stop(); } catch (e) { /* ignore */ } this.rec = null; this.listening = false; }
}

// ------------------------------------------------------------------ the DOM layer
export class TvLayer {
  constructor(onAct) {
    this.onAct = onAct;
    this.el = document.createElement('div');
    this.el.id = 'tanshuku-tv';
    Object.assign(this.el.style, { position: 'fixed', inset: '0', zIndex: '9000', background: '#05040c', touchAction: 'none', userSelect: 'none' });
    this.cv = document.createElement('canvas');
    Object.assign(this.cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
    this.el.appendChild(this.cv);
    document.body.appendChild(this.el);
    this.ctx = this.cv.getContext('2d');
    this.frame = { x: 0, y: 0, w: FW, h: FH };
    this.hits = [];
    this.fs = false;
    this.cv.addEventListener('pointerdown', (e) => { e.preventDefault(); this.tryFullscreen(); this.tap(e, true); });
    this.cv.addEventListener('pointerup', (e) => { e.preventDefault(); this.tap(e, false); });
    this.cv.addEventListener('pointercancel', () => this.onAct('a-up'));
    this.cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  tryFullscreen() {
    if (this.fs || !document.body.classList.contains('touch')) return;
    this.fs = true;
    try {
      const p = this.el.requestFullscreen ? this.el.requestFullscreen({ navigationUI: 'hide' }) : null;
      if (p && p.then) p.then(() => { try { const o = screen.orientation; if (o && o.lock) o.lock('portrait').catch(() => {}); } catch (e) { /* ignore */ } }).catch(() => {});
    } catch (e) { /* no fullscreen: the layer still fills the viewport */ }
  }
  tap(e, down) {
    const r = this.cv.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const f = this.frame;
    const lx = ((px - f.x) / f.w) * FW, ly = ((py - f.y) / f.h) * FH;
    if (!down) { this.onAct('a-up'); return; }
    for (const h of this.hits) if (lx >= h.x && lx <= h.x + h.w && ly >= h.y && ly <= h.y + h.h) { this.onAct(h.act); return; }
    for (const h of this.sideHits || []) if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) { this.onAct(h.act); return; }
    this.onAct('a-down');
  }
  render(frameCv, info) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(this.cv.clientWidth * dpr), h = Math.round(this.cv.clientHeight * dpr);
    if (!w || !h) return;
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const f = renderTV(c, w, h, frameCv, info);
    this.frame = { x: f.x / dpr, y: f.y / dpr, w: f.w / dpr, h: f.h / dpr };
    this.sideHits = (f.hits || []).map((hh) => ({ x: hh.x / dpr, y: hh.y / dpr, w: hh.w / dpr, h: hh.h / dpr, act: hh.act }));
  }
  destroy() {
    try { if (this.fs && document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
    try { const o = screen.orientation; if (o && o.unlock) o.unlock(); } catch (e) { /* ignore */ }
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}

// Side panels (landscape) + the 9:16 frame. Returns the frame rect (device px) and side buttons.
export function renderTV(c, W, H, frameCv, info = {}) {
  c.imageSmoothingEnabled = true;
  const portrait = W / H < 0.7;
  let fh = H, fw = (H * FW) / FH;
  if (portrait) { fw = W; fh = (W * FH) / FW; if (fh > H) { fh = H; fw = (H * FW) / FH; } }
  else { fh = H * 0.96; fw = (fh * FW) / FH; }
  const fx = Math.round((W - fw) / 2), fy = Math.round((H - fh) / 2);
  // studio backdrop
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0820'); g.addColorStop(0.6, '#140c30'); g.addColorStop(1, '#05040c');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const hits = [];
  if (!portrait) {
    const s = fh / FH; // logical px → device px
    // light bulbs along the frame
    for (let y = fy + 6 * s; y < fy + fh; y += 22 * s) for (const x of [fx - 10 * s, fx + fw + 10 * s]) {
      c.fillStyle = Math.floor((info.t || 0) / 12 + y / 22) % 2 ? '#ffd23f' : '#7a5a10';
      c.beginPath(); c.arc(x, y, 3.2 * s, 0, Math.PI * 2); c.fill();
    }
    const pw = fx - 22 * s;
    if (pw > 60 * s) {
      sidePanel(c, 8 * s, fy, pw - 8 * s, fh, s, info, 'left');
      sidePanel(c, fx + fw + 22 * s, fy, W - (fx + fw + 22 * s) - 8 * s, fh, s, info, 'right', hits);
    }
  }
  c.imageSmoothingEnabled = false;
  if (frameCv) c.drawImage(frameCv, 0, 0, frameCv.width, frameCv.height, fx, fy, Math.round(fw), Math.round(fh));
  c.imageSmoothingEnabled = true;
  if (portrait) portraitBands(c, W, H, fx, fy, fw, fh, info, hits);
  return { x: fx, y: fy, w: fw, h: fh, hits };
}
// Portrait phones: the letterbox above/below the 9:16 frame becomes a miss board, the route and the toggles.
function portraitBands(c, W, H, fx, fy, fw, fh, info, hits) {
  const s = fw / FW;
  const T = (str, tx, ty, size, col, o = {}) => {
    c.font = `${Math.round(size * s)}px "DotGothic16", "Hiragino Kaku Gothic ProN", "Noto Sans JP", monospace`;
    c.textAlign = o.align || 'left';
    c.textBaseline = 'top';
    if (o.outline) { c.lineWidth = 3 * s; c.strokeStyle = o.outline; c.strokeText(str, tx, ty); }
    c.fillStyle = col;
    c.fillText(str, tx, ty);
  };
  const fit = (str, maxW, size) => { let z = size; c.font = `${Math.round(z * s)}px "DotGothic16", monospace`; while (c.measureText(str).width > maxW && z > 7) { z--; c.font = `${Math.round(z * s)}px "DotGothic16", monospace`; } return z; };
  const btn = (label, on, x, y, w, h, act, size = 12) => {
    c.fillStyle = '#1a1a26'; c.fillRect(x - s, y - s, w + 2 * s, h + 2 * s);
    c.fillStyle = on ? '#2f6fd0' : '#2a2f55'; c.fillRect(x, y, w, h);
    T(label, x + w / 2, y + (h - size * s) / 2, fit(label, w - 6 * s, size), '#ffffff', { align: 'center' });
    hits.push({ x, y, w, h, act });
  };
  const top = fy / s, bot = (H - fy - fh) / s;
  if (top >= 30) {
    // miss board, hugging the frame's top edge
    const cast = info.cast || [], cw = W / Math.max(1, cast.length), y = fy - 28 * s;
    cast.forEach((p, i) => {
      const x0 = i * cw, cx = x0 + cw / 2;
      c.fillStyle = p.out ? 'rgba(214,47,47,0.45)' : p.player ? 'rgba(255,210,63,0.22)' : 'rgba(255,255,255,0.07)';
      c.fillRect(x0 + 3 * s, y, cw - 6 * s, 24 * s);
      const tg = String(p.tag).split('｜')[0];
      T(tg, cx + 2 * s, y + 6 * s, fit(tg, cw / 2 - 8 * s, 11), p.player ? '#ffd23f' : '#ffffff', { align: 'right' });
      for (let k = 0; k < 2; k++) { c.fillStyle = k < p.misses ? '#ff5d6c' : '#3a3f6a'; c.beginPath(); c.arc(cx + (11 + k * 12) * s, y + 12 * s, 4.5 * s, 0, Math.PI * 2); c.fill(); }
    });
    if (top >= 62) {
      const y2 = fy - 60 * s;
      T(info.program || 'はねるのトびら', 10 * s, y2 + 8 * s, fit(info.program || 'はねるのトびら', 96 * s, 11), '#ffffff');
      T('短縮鉄道の夜', W / 2, y2 + 2 * s, 20, '#ffd23f', { align: 'center', outline: '#3a1a00' });
      T(info.year ? `${info.year}年` : '', W - 10 * s, y2 + 8 * s, 11, '#9aa3c7', { align: 'right' });
    }
  }
  if (bot >= 56) {
    // route line + toggles under the frame
    const st = info.stations || [], y = fy + fh + 10 * s, x0 = 26 * s, x1 = W - 26 * s;
    const step = (x1 - x0) / Math.max(1, st.length - 1);
    c.fillStyle = '#3a4a9a'; c.fillRect(x0, y + 4 * s, x1 - x0, 3 * s);
    st.forEach((name, i) => {
      const here = i === info.leg, past = i < info.leg, x = x0 + i * step;
      c.fillStyle = here ? '#ffd23f' : past ? '#5ee07a' : '#2a2f55';
      c.beginPath(); c.arc(x, y + 5.5 * s, (here ? 6 : 4.5) * s, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.2 * s; c.stroke();
      if (here) T(name, Math.min(Math.max(x, 40 * s), W - 40 * s), y + 14 * s, 10, '#ffd23f', { align: 'center' });
    });
    const by = y + 30 * s, bw = (W - 30 * s) / 2;
    btn(`ボイス ${info.voice ? 'ON' : 'OFF'}`, info.voice, 10 * s, by, bw, 24 * s, 'voice');
    if (info.micOk) btn(`声で回答 ${info.mic ? 'ON' : 'OFF'}`, info.mic, 20 * s + bw, by, bw, 24 * s, 'mic');
  } else {
    // no room around the frame: two small toggles in the frame's top-right corner
    const y = fy + 6 * s;
    btn('ボイス', info.voice, fx + 246 * s, y, 40 * s, 20 * s, 'voice', 9);
    if (info.micOk) btn('マイク', info.mic, fx + 290 * s, y, 40 * s, 20 * s, 'mic', 9);
  }
}
function sidePanel(c, x, y, w, h, s, info, side, hits) {
  const T = (str, tx, ty, size, col, o = {}) => {
    c.font = `${Math.round(size * s)}px "DotGothic16", "Hiragino Kaku Gothic ProN", "Noto Sans JP", monospace`;
    c.textAlign = o.align || 'left';
    c.textBaseline = 'top';
    if (o.outline) { c.lineWidth = 3 * s; c.strokeStyle = o.outline; c.strokeText(str, tx, ty); }
    c.fillStyle = col;
    c.fillText(str, tx, ty);
  };
  const fit = (str, maxW, size) => { let z = size; c.font = `${Math.round(z * s)}px "DotGothic16", monospace`; while (c.measureText(str).width > maxW && z > 8) { z--; c.font = `${Math.round(z * s)}px "DotGothic16", monospace`; } return z; };
  c.fillStyle = 'rgba(20,16,50,0.85)';
  c.fillRect(x, y, w, h);
  c.strokeStyle = '#ffd23f';
  c.lineWidth = 2 * s;
  c.strokeRect(x + s, y + s, w - 2 * s, h - 2 * s);
  const cx = x + w / 2;
  if (side === 'left') {
    T(info.program || 'はねるのトびら', cx, y + 14 * s, fit(info.program || 'はねるのトびら', w - 16 * s, 16), '#ffffff', { align: 'center', outline: '#2a1a60' });
    T('短縮鉄道の夜', cx, y + 40 * s, fit('短縮鉄道の夜', w - 16 * s, 24), '#ffd23f', { align: 'center', outline: '#3a1a00' });
    T(info.year ? `${info.year}年 放送` : '', cx, y + 74 * s, 11, '#9aa3c7', { align: 'center' });
    // the route map
    const st = info.stations || [];
    const top = y + 100 * s, step = Math.min(44 * s, (h - 130 * s) / Math.max(1, st.length));
    c.fillStyle = '#3a4a9a';
    c.fillRect(cx - 2 * s, top + 6 * s, 4 * s, step * (st.length - 1));
    st.forEach((name, i) => {
      const yy = top + i * step;
      const here = i === info.leg, past = i < info.leg;
      c.fillStyle = here ? '#ffd23f' : past ? '#5ee07a' : '#2a2f55';
      c.beginPath(); c.arc(cx, yy + 6 * s, (here ? 7 : 5) * s, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.5 * s; c.stroke();
      const z = fit(name, w / 2 - 18 * s, 11);
      T(name, i % 2 ? cx + 14 * s : cx - 14 * s, yy, z, here ? '#ffd23f' : past ? '#c8ffd0' : '#c8cce6', { align: i % 2 ? 'left' : 'right' });
    });
  } else {
    T('ミス', x + 12 * s, y + 14 * s, 14, '#ff9aa8');
    (info.cast || []).forEach((p, i) => {
      const yy = y + 38 * s + i * 40 * s;
      const z = fit(p.tag, w - 24 * s, 12);
      T(p.tag, x + 12 * s, yy, z, p.player ? '#ffd23f' : '#ffffff');
      for (let k = 0; k < 2; k++) { c.fillStyle = k < p.misses ? '#ff5d6c' : '#2a2f55'; c.beginPath(); c.arc(x + 20 * s + k * 18 * s, yy + 24 * s, 6 * s, 0, Math.PI * 2); c.fill(); }
      if (p.out) T('アウト', x + 60 * s, yy + 18 * s, 11, '#ff5d6c');
      else if (p.misses === 1) T('リーチ', x + 60 * s, yy + 18 * s, 11, '#ffd23f');
    });
    const by = y + h - 150 * s;
    T(`正解 ${info.correct || 0}`, x + 12 * s, by, 14, '#5ee07a');
    T(`ジャスト ${info.just || 0}`, x + 12 * s, by + 22 * s, 14, '#ffd23f');
    // toggles (voice / mic)
    const btn = (label, on, yy, act) => {
      c.fillStyle = on ? '#2f6fd0' : '#2a2f55';
      c.fillRect(x + 10 * s, yy, w - 20 * s, 26 * s);
      T(label, x + w / 2, yy + 6 * s, fit(label, w - 30 * s, 12), '#ffffff', { align: 'center' });
      hits.push({ x: x + 10 * s, y: yy, w: w - 20 * s, h: 26 * s, act });
    };
    btn(`ボイス ${info.voice ? 'ON' : 'OFF'}`, info.voice, by + 50 * s, 'voice');
    if (info.micOk) btn(`声で回答 ${info.mic ? 'ON' : 'OFF'}`, info.mic, by + 82 * s, 'mic');
    T('↑←→↓ で回答', x + w / 2, y + h - 18 * s, fit('↑←→↓ で回答', w - 16 * s, 10), '#9aa3c7', { align: 'center' });
  }
}

// ------------------------------------------------------------------ art (frame coords, logical 360x640)
export const SET = { top: 0, floor: 382, rail: 250, winTop: 92, winBot: 228 };
const PERF_SCALE = 2.5;
export const PW = 32 * PERF_SCALE, PH = 40 * PERF_SCALE;

export function makeScenery(seed = 7) {
  const r = mulberry32(seed);
  const stars = Array.from({ length: 70 }, () => ({ x: r() * 720, y: SET.winTop + r() * 120, s: r() < 0.15 ? 2 : 1, ph: r() * 6 }));
  const city = [];
  for (let x = 0; x < 720;) { const w = 18 + Math.floor(r() * 30); city.push({ x, w, h: 20 + Math.floor(r() * 60), lit: Array.from({ length: 12 }, () => r() < 0.45) }); x += w + 2 + Math.floor(r() * 6); }
  const hills = Array.from({ length: 12 }, (_, i) => ({ x: i * 64, h: 10 + r() * 18 }));
  return { stars, city, hills };
}
// the view outside the windows: mode 'city' | 'station' | 'space'; scroll in px
export function drawScenery(c, sc, scroll, mode, t, stationName = '') {
  const y0 = SET.winTop, y1 = SET.winBot;
  const g = c.createLinearGradient(0, y0, 0, y1);
  if (mode === 'space') { g.addColorStop(0, '#000010'); g.addColorStop(1, '#1a0a3a'); }
  else { g.addColorStop(0, '#0a1030'); g.addColorStop(0.7, '#2a1850'); g.addColorStop(1, '#4a2a5a'); }
  c.fillStyle = g;
  c.fillRect(0, y0, FW, y1 - y0);
  for (const s of sc.stars) {
    let x = (s.x - scroll * (mode === 'space' ? 2.2 : 0.08)) % 720;
    if (x < 0) x += 720;
    if (x > FW) continue;
    const tw = Math.sin(t / 14 + s.ph) > 0.2;
    if (mode === 'space') rect(c, x, s.y, 6 + s.s * 6, s.s, '#ffffff');
    else if (tw || s.s > 1) rect(c, x, s.y, s.s, s.s, s.s > 1 ? '#fff6c0' : '#c8d0ff');
  }
  if (mode === 'space') {
    c.fillStyle = '#ffcf6a';
    c.beginPath(); c.arc(300 - (scroll * 0.3) % 400, y0 + 40, 14, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5fd7ff';
    c.beginPath(); c.arc(80 + (t * 0.2) % 300, y0 + 90, 8, 0, Math.PI * 2); c.fill();
    return;
  }
  // moon
  c.fillStyle = '#fff6c8';
  c.beginPath(); c.arc(290, y0 + 26, 11, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1a1440';
  c.beginPath(); c.arc(295, y0 + 23, 10, 0, Math.PI * 2); c.fill();
  // hills (slow)
  for (const h of sc.hills) {
    let x = (h.x - scroll * 0.3) % 768; if (x < -64) x += 768;
    c.fillStyle = '#1a1438';
    c.beginPath(); c.moveTo(x, y1); c.lineTo(x + 32, y1 - 34 - h.h); c.lineTo(x + 64, y1); c.fill();
  }
  // city (mid)
  for (const b of sc.city) {
    let x = (b.x - scroll * 0.9) % 720; if (x < -60) x += 720;
    if (x > FW) continue;
    const top = y1 - b.h - 6;
    rect(c, x, top, b.w, b.h + 6, '#120e28');
    for (let k = 0; k < b.lit.length; k++) if (b.lit[k]) rect(c, x + 3 + (k % 3) * Math.floor((b.w - 6) / 3), top + 4 + Math.floor(k / 3) * 9, 3, 4, '#ffd98a');
  }
  if (mode === 'station') {
    rect(c, 0, y1 - 26, FW, 26, '#5a5a6a');
    rect(c, 0, y1 - 26, FW, 3, '#c8c8d0');
    for (let x = -((scroll * 1.6) % 90); x < FW; x += 90) { rect(c, x, y0 + 20, 4, y1 - y0 - 46, '#3a3a48'); rect(c, x - 10, y0 + 18, 24, 4, '#ffffe0'); }
    if (stationName) {
      const sx = 120 - (scroll * 1.6) % 360;
      rect(c, sx, y0 + 50, 120, 34, '#ffffff');
      rect(c, sx, y0 + 76, 120, 8, '#2a4aa0');
      text(c, stationName.slice(0, 7), sx + 60, y0 + 54, { size: 14, align: 'center', color: '#1a1a26', shadow: null });
    }
  } else {
    // poles whizzing by (fast)
    for (let x = -((scroll * 3) % 140); x < FW; x += 140) rect(c, x, y0, 3, y1 - y0, 'rgba(10,8,20,0.8)');
  }
}
// the car around the windows (drawn after the scenery)
export function drawCar(c, t, sway) {
  // ceiling
  rect(c, 0, 0, FW, SET.winTop - 22, '#d8d0b8');
  rect(c, 0, 0, FW, 10, '#b8b098');
  for (let x = 20; x < FW; x += 110) { const on = Math.sin(t * 0.7 + x) > -0.97; rect(c, x, 18, 80, 8, on ? '#fffff0' : '#c8c8b0'); if (on) { c.globalAlpha = 0.15; rect(c, x - 10, 26, 100, 20, '#ffffe0'); c.globalAlpha = 1; } }
  // ad placards (中吊り)
  for (let x = 46; x < FW; x += 136) { rect(c, x, 30, 60, 34, '#ffffff'); rect(c, x, 30, 60, 6, ['#d64161', '#2f9a4a', '#2f6fd0'][(x / 136) | 0] || '#d64161'); rect(c, x + 6, 42, 40, 3, '#c8c8d0'); rect(c, x + 6, 50, 30, 3, '#c8c8d0'); rect(c, x + 29, 26, 2, 4, '#888'); }
  // luggage rack
  rect(c, 0, SET.winTop - 22, FW, 4, '#9aa0ac');
  for (let x = 0; x < FW; x += 6) rect(c, x, SET.winTop - 18, 2, 8, '#7a808c');
  // wall + windows
  rect(c, 0, SET.winTop - 10, FW, 10, '#cfc6aa');
  const wins = [[10, 104], [128, 104], [246, 104]];
  let prev = 0;
  for (const [x, w] of wins) { rect(c, prev, SET.winTop, x - prev, SET.winBot - SET.winTop, '#cfc6aa'); prev = x + w; }
  rect(c, prev, SET.winTop, FW - prev, SET.winBot - SET.winTop, '#cfc6aa');
  for (const [x, w] of wins) {
    c.strokeStyle = '#7a7060'; c.lineWidth = 3; c.strokeRect(x + 1.5, SET.winTop + 1.5, w - 3, SET.winBot - SET.winTop - 3);
    rect(c, x, SET.winTop + 60, w, 3, '#7a7060');
    c.globalAlpha = 0.08; rect(c, x + 6, SET.winTop + 6, 20, 50, '#ffffff'); c.globalAlpha = 1;
  }
  // lower wall + long bench seats
  rect(c, 0, SET.winBot, FW, 70, '#8a9a70');
  rect(c, 0, SET.winBot, FW, 4, '#6a7a50');
  rect(c, 0, SET.winBot + 22, FW, 36, '#3a5aa0');
  rect(c, 0, SET.winBot + 22, FW, 6, '#5a7ac0');
  for (let x = 40; x < FW; x += 80) rect(c, x, SET.winBot + 22, 2, 36, '#2a4a80');
  // floor
  rect(c, 0, SET.winBot + 70, FW, SET.floor + 30 - (SET.winBot + 70), '#6a6058');
  for (let y = SET.winBot + 76; y < SET.floor + 30; y += 9) rect(c, 0, y, FW, 1, '#5a5048');
  rect(c, 0, SET.floor + 24, FW, 6, '#4a4038');
  // strap rail
  rect(c, 0, SET.rail - 3, FW, 5, '#c8ccd8');
  rect(c, 0, SET.rail - 3, FW, 1, '#ffffff');
}
// a hanging strap; ring centre returned
export function drawStrap(c, x, ang, len = 30) {
  const ex = x + Math.sin(ang) * len, ey = SET.rail + Math.cos(ang) * len;
  c.strokeStyle = '#e8e0c8'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, SET.rail); c.lineTo(ex, ey); c.stroke();
  c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.arc(ex, ey + 8, 8, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#b8b0a0'; c.lineWidth = 1; c.beginPath(); c.arc(ex, ey + 8, 6, 0, Math.PI * 2); c.stroke();
  return { x: ex, y: ey + 8 };
}
const scratch = makeCanvas(32, 40);
// a performer holding the strap: o = { sheet, x (centre), feet, ring, talk, frost 0..1, shake, dogeza, sleeve }
export function drawPerformer(c, o) {
  const [cv, cc] = scratch;
  const x = Math.round(o.x - PW / 2 + (o.shake ? Math.sin(o.t * 1.7) * o.shake : 0));
  const top = o.feet - PH;
  if (o.dogeza) {
    // 土下座: kneeling, forehead to the floor (the head from behind, the back, both hands flat in front)
    const fy = o.feet;
    const bob = Math.floor((o.t || 0) / 16) % 2 ? 2 : 0;
    cc.clearRect(0, 0, 32, 40);
    cc.drawImage(o.sheet.up[0], 0, 0);
    rect(c, x - 6, fy - 30 + bob, PW + 12, 30 - bob, '#1a1a26');
    rect(c, x - 4, fy - 28 + bob, PW + 8, 26 - bob, o.sleeve || '#3b3f48');
    c.drawImage(cv, 0, 0, 32, 22, x + PW * 0.2, fy - 44 + bob * 2, PW * 0.6, 34);
    rect(c, x - 14, fy - 8, 14, 7, '#1a1a26'); rect(c, x - 13, fy - 7, 12, 5, '#f6c9a0');
    rect(c, x + PW, fy - 8, 14, 7, '#1a1a26'); rect(c, x + PW + 1, fy - 7, 12, 5, '#f6c9a0');
    for (let k = 0; k < 3; k++) rect(c, x + PW * 0.5 - 18 + k * 18, fy - 60 - bob * 2, 2, 8, '#ffffff');
    return;
  }
  // the raised arm (behind the head on the strap side)
  if (o.ring) {
    // shoulder → elbow (out to the side) → hand on the ring
    const sx = o.x + PW * 0.3, sy = top + PH * 0.66;
    const ex = Math.max(sx + 6, o.ring.x + 4), ey = (sy + o.ring.y) / 2 + 4;
    c.strokeStyle = '#1a1a26'; c.lineWidth = 8; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.lineTo(o.ring.x, o.ring.y + 5); c.stroke();
    c.strokeStyle = o.sleeve || '#3b3f48'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.lineTo(o.ring.x, o.ring.y + 7); c.stroke();
    c.fillStyle = '#1a1a26'; c.fillRect(o.ring.x - 4, o.ring.y - 3, 9, 10);
    c.fillStyle = '#f6c9a0'; c.fillRect(o.ring.x - 3, o.ring.y - 2, 7, 8);
    c.lineCap = 'butt'; c.lineJoin = 'miter';
  }
  cc.clearRect(0, 0, 32, 40);
  cc.drawImage(o.sheet.down[0], 0, 0);
  if (o.talk) { cc.fillStyle = '#4a1420'; cc.fillRect(14, 18, 4, 3); cc.fillStyle = '#e2707a'; cc.fillRect(15, 20, 2, 1); }
  c.drawImage(cv, x, top, PW, PH);
  if (o.frost > 0) {
    c.globalAlpha = 0.6 * o.frost;
    c.fillStyle = '#e8f6ff';
    c.fillRect(x + PW * 0.18, top + PH * 0.08, PW * 0.64, PH * 0.48);
    c.globalAlpha = 1;
    for (let k = 0; k < 8; k++) rect(c, x + PW * 0.2 + ((k * 37) % 44), top + PH * 0.1 + ((k * 23) % 40), 2, 2, '#ffffff');
  }
}
// gas cloud from the nozzle at the left toward (tx, ty)
export function drawGas(c, tx, ty, k, t) {
  const nx = tx - 70, ny = ty + 10;
  rect(c, nx - 30, ny - 4, 30, 8, '#8a909c');
  rect(c, nx - 36, ny - 8, 8, 16, '#5a5f6b');
  for (let i = 0; i < 26; i++) {
    const f = ((i * 0.07 + t * 0.05) % 1);
    const px = nx + f * 80, py = ny + Math.sin(i * 1.7 + t * 0.3) * (6 + f * 18);
    c.globalAlpha = clamp(k * (1 - f * 0.6), 0, 1) * 0.8;
    c.fillStyle = i % 3 ? '#ffffff' : '#d8f0ff';
    c.beginPath(); c.arc(px, py, 4 + f * 12, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}
// station-sign style word card
export function drawSign(c, x, y, w, abbr, sub, prev, next, flip = 0, full = '') {
  rect(c, x - 3, y - 3, w + 6, 82, '#1a1a26');
  rect(c, x, y, w, 76, '#ffffff');
  rect(c, x, y + 52, w, 10, '#24489a');
  rect(c, x, y + 62, w, 14, '#f0f0f4');
  const showFull = flip > 0.5;
  const main = showFull ? full : abbr;
  let size = showFull ? 22 : 34;
  while (measure(c, main, size) > w - 24 && size > 11) size--;
  const sx = 1 - Math.abs(flip - 0.5) * 2; // squash during the flip
  c.save();
  c.translate(x + w / 2, y + 26);
  c.scale(1, Math.max(0.05, 1 - sx));
  text(c, main, 0, -size / 2 - 2, { size, align: 'center', color: showFull ? '#c0182c' : '#1a1a26', shadow: null });
  c.restore();
  if (sub) text(c, sub, x + w / 2, y + 53, { size: 9, align: 'center', color: '#ffffff', shadow: null });
  if (prev) { let s = 10; while (measure(c, '◀ ' + prev, s) > w / 2 - 8 && s > 7) s--; text(c, '◀ ' + prev, x + 6, y + 64, { size: s, color: '#4a4a5a', shadow: null }); }
  if (next) { let s = 10; while (measure(c, next + ' ▶', s) > w / 2 - 8 && s > 7) s--; text(c, next + ' ▶', x + w - 6, y + 64, { size: s, align: 'right', color: '#4a4a5a', shadow: null }); }
}
// telop text with a thick outline
export function telop(c, str, x, y, size, col, out = '#1a1a26', align = 'center') {
  c.font = `${size}px "DotGothic16", "Hiragino Kaku Gothic ProN", "Noto Sans JP", monospace`;
  c.textAlign = align;
  c.textBaseline = 'top';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size / 5);
  c.strokeStyle = out;
  c.strokeText(str, x, y);
  c.fillStyle = col;
  c.fillText(str, x, y);
}
export function fitSize(c, str, maxW, size, min = 9) {
  let s = size;
  while (measure(c, str, s) > maxW && s > min) s--;
  return s;
}
export function sheetOf(look) { return charSheetHD(look || {}); }
export { wrap, measure, text, rect, shade };
