// Tiny chiptune audio: synthesized sound effects + a step sequencer for BGM.
//
//   audio.sfx('ok')            – play a sound effect (see SFX below)
//   audio.bgm('town')          – loop a song (no-op if already playing)
//   audio.stopBgm()
//   registerSong('name', def)  – add a song (format documented at SONGS)

const NOTE_INDEX = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

export function noteFreq(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  let n = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) - 4) * 12;
  return 440 * Math.pow(2, n / 12);
}

// Song format:
// { bpm, step: beats per token (0.5 = 8th notes), tracks: [{ wave, vol, notes }] }
// notes: space separated tokens. "C4" note, "." rest, "-" hold previous, "|" ignored.
// wave 'drum' tokens: k = kick, s = snare, h = hat, . = rest.
// Every track loops on its own length.
export const SONGS = {
  title: {
    bpm: 140, step: 0.5,
    tracks: [
      { wave: 'square', vol: 0.05, notes: 'E5 . G5 . C6 . B5 C6 | A5 . E5 . C5 . E5 A5 | F5 . A5 . C6 . A5 F5 | G5 . B5 . D6 - - . | E5 G5 C6 E6 D6 C6 B5 C6 | A5 - - . E5 . A5 . | F5 A5 C6 F6 E6 D6 C6 A5 | B5 - D6 - G5 - - .' },
      { wave: 'triangle', vol: 0.12, notes: 'C3 . C4 . C3 . C4 . | A2 . A3 . A2 . A3 . | F2 . F3 . F2 . F3 . | G2 . G3 . G2 . G3 .' },
      { wave: 'drum', vol: 0.12, notes: 'k . h . s . h k | k . h . s . h h' },
    ],
  },
  town: {
    bpm: 118, step: 0.5,
    tracks: [
      { wave: 'square', vol: 0.045, notes: 'G4 . C5 . E5 . D5 C5 | D5 . B4 . G4 . A4 B4 | C5 . A4 . E5 . D5 C5 | B4 - - . G4 . . . | A4 . C5 . F5 . E5 D5 | E5 . C5 . G4 . C5 . | A4 . C5 . F5 . A5 . | G5 - F5 - E5 - D5 .' },
      { wave: 'triangle', vol: 0.12, notes: 'C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | E2 . B2 . E2 . B2 . | F2 . C3 . F2 . C3 . | C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 .' },
      { wave: 'drum', vol: 0.08, notes: 'k . h . s . h . | k . h k s . h .' },
    ],
  },
  osaka: {
    bpm: 132, step: 0.5,
    tracks: [
      { wave: 'square', vol: 0.045, notes: 'C5 . Eb5 E5 G5 . A5 G5 | Bb5 - A5 G5 E5 . C5 . | F5 . A5 . C6 . A5 F5 | Eb5 E5 G5 . F5 . . . | C5 . Eb5 E5 G5 . A5 G5 | Bb5 - A5 G5 E5 . C5 . | D5 . F5 . B5 . G5 F5 | E5 - C5 - - . . .' },
      { wave: 'triangle', vol: 0.12, notes: 'C3 . E3 . G3 . A3 . | Bb3 . A3 . G3 . E3 . | F2 . A2 . C3 . D3 . | Eb3 . D3 . C3 . A2 . | C3 . E3 . G3 . A3 . | Bb3 . A3 . G3 . E3 . | G2 . B2 . D3 . F3 . | C3 . G2 . C3 . . .' },
      { wave: 'drum', vol: 0.09, notes: 'k . h k s . h . | k h h k s . h h' },
    ],
  },
  office: {
    bpm: 96, step: 0.5,
    tracks: [
      { wave: 'triangle', vol: 0.09, notes: 'A4 . C5 . E5 - - . | G4 . B4 . D5 - - . | F4 . A4 . C5 - - . | E4 . G4 . B4 - C5 . | A4 . C5 . F5 - E5 . | D5 . C5 . B4 - - . | C5 . A4 . F4 - G4 . | E4 - - - . . . .' },
      { wave: 'square', vol: 0.025, notes: 'F3 A3 C4 E4 F3 A3 C4 E4 | E3 G3 B3 D4 E3 G3 B3 D4 | D3 F3 A3 C4 D3 F3 A3 C4 | C3 E3 G3 B3 C3 E3 G3 B3' },
      { wave: 'triangle', vol: 0.1, notes: 'F2 - - - F2 - - - | E2 - - - E2 - - - | D2 - - - D2 - - - | C2 - - - G2 - - -' },
    ],
  },
  studio: {
    bpm: 124, step: 0.5,
    tracks: [
      { wave: 'square', vol: 0.04, notes: 'A4 . . C5 . D5 . E5 | . . G5 . E5 . D5 . | A4 . . C5 . D5 . E5 | D5 . C5 . A4 . . . | F5 . . E5 . D5 . C5 | . . D5 . E5 . G5 . | A5 . G5 . E5 . D5 . | E5 - - - . . . .' },
      { wave: 'triangle', vol: 0.13, notes: 'A2 . A3 . A2 A2 G2 . | D3 . D3 . D3 F3 E3 . | A2 . A3 . A2 A2 G2 . | D3 . D3 . E3 . E2 . | F2 . F3 . F2 F2 E2 . | D2 . D3 . D3 F3 G3 . | A2 . A3 . G2 . G3 . | E2 . E3 . E2 . G2 .' },
      { wave: 'drum', vol: 0.1, notes: 'k . h k s . h . | k . h . s h k h' },
    ],
  },
  theater: {
    bpm: 150, step: 0.5,
    tracks: [
      { wave: 'square', vol: 0.045, notes: 'C5 . E5 . G5 . E5 . | F5 . D5 . B4 . G4 . | C5 . E5 . G5 . C6 . | B5 . G5 . C6 - - . | A5 . F5 . C5 . F5 . | G5 . E5 . C5 . E5 . | D5 . F5 . B5 . D6 . | C6 . G5 . C5 - - .' },
      { wave: 'triangle', vol: 0.12, notes: 'C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | C3 . G3 . C3 . G3 . | G2 . D3 . C3 . G2 . | F2 . C3 . F2 . C3 . | C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | C3 . G2 . C3 . . .' },
      { wave: 'drum', vol: 0.09, notes: 'k . s . k . s . | k . s . k s s .' },
    ],
  },
  minigame: {
    bpm: 150, step: 0.5,
    tracks: [
      { wave: 'square', vol: 0.04, notes: 'A4 C5 E5 A5 G5 E5 C5 E5 | F4 A4 C5 F5 E5 C5 A4 C5 | G4 B4 D5 G5 F5 D5 B4 D5 | E5 . G#4 . B4 . E5 .' },
      { wave: 'triangle', vol: 0.12, notes: 'A2 A2 A3 A2 A2 A2 A3 A2 | F2 F2 F3 F2 F2 F2 F3 F2 | G2 G2 G3 G2 G2 G2 G3 G2 | E2 E2 E3 E2 E2 E2 G#2 B2' },
      { wave: 'drum', vol: 0.1, notes: 'k h s h k k s h' },
    ],
  },
  night: {
    bpm: 80, step: 0.5,
    tracks: [
      { wave: 'triangle', vol: 0.09, notes: 'E5 - - - D5 - C5 - | D5 - - - . . . . | C5 - - - A4 - G4 - | A4 - - - . . . . | F4 - A4 - C5 - E5 - | D5 - - - C5 - B4 - | C5 - - - - - - - | . . . . . . . .' },
      { wave: 'triangle', vol: 0.07, notes: 'C3 G3 C4 G3 C3 G3 C4 G3 | G2 D3 G3 D3 G2 D3 G3 D3 | A2 E3 A3 E3 A2 E3 A3 E3 | E2 B2 E3 B2 E2 B2 E3 B2 | F2 C3 F3 C3 F2 C3 F3 C3 | G2 D3 G3 D3 G2 D3 G3 D3 | C3 G3 C4 G3 C3 G3 C4 G3 | C3 G3 C4 G3 C3 G3 C4 G3' },
    ],
  },
  ending: {
    bpm: 92, step: 0.5,
    tracks: [
      { wave: 'square', vol: 0.045, notes: 'E5 - - - G5 - E5 - | D5 - - - B4 - - - | C5 - - - E5 - A5 - | G5 - - - - - - - | F5 - - - A5 - F5 - | E5 - - - C5 - E5 - | D5 - - - G5 - B5 - | C6 - - - - - - -' },
      { wave: 'triangle', vol: 0.12, notes: 'C3 . G3 . E3 . G3 . | G2 . D3 . B2 . D3 . | A2 . E3 . C3 . E3 . | E2 . B2 . G2 . B2 . | F2 . C3 . A2 . C3 . | C3 . G3 . E3 . G3 . | G2 . D3 . B2 . D3 . | C3 . G3 . C4 . . .' },
      { wave: 'drum', vol: 0.07, notes: 'k . h . s . h . | k . h . s . h h' },
    ],
  },
};

export function registerSong(name, def) {
  SONGS[name] = def;
}

function parseTrack(track) {
  const toks = track.notes.split(/\s+/).filter((t) => t && t !== '|');
  const events = new Array(toks.length).fill(null);
  let last = -1;
  toks.forEach((t, i) => {
    if (t === '-') {
      if (last >= 0) events[last].len += 1;
      return;
    }
    if (t === '.') {
      last = -1;
      return;
    }
    if (track.wave === 'drum') {
      events[i] = { drum: t, len: 1 };
      last = -1;
      return;
    }
    const f = noteFreq(t);
    if (f) {
      events[i] = { freq: f, len: 1 };
      last = i;
    }
  });
  return { ...track, events, length: toks.length };
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('dotgeinou_muted') === '1'; } catch (e) { /* storage blocked */ }
    this.current = null;
    this.wanted = null;
    this.timer = null;
  }

  unlock() {
    if (this.ctx) {
      // also covers iOS 'interrupted' (e.g. after a phone call)
      if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.55;
    this.bgmGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.wanted) {
      const w = this.wanted;
      this.wanted = null;
      this.bgm(w);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('dotgeinou_muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }

  tone(freq, start, dur, { wave = 'square', vol = 0.1, slideTo = null, out = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.005);
    g.gain.setValueAtTime(vol, start + Math.max(0.006, dur - 0.03));
    g.gain.linearRampToValueAtTime(0, start + dur);
    o.connect(g);
    g.connect(out || this.sfxGain);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  noise(start, dur, { vol = 0.1, filter = 'highpass', freq = 1000, out = null } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    s.connect(f);
    f.connect(g);
    g.connect(out || this.sfxGain);
    s.start(start, Math.random() * 0.5);
    s.stop(start + dur + 0.02);
  }

  drum(kind, t, vol, out) {
    if (kind === 'k') {
      this.tone(150, t, 0.12, { wave: 'sine', vol: vol * 2.2, slideTo: 40, out });
    } else if (kind === 's') {
      this.noise(t, 0.12, { vol: vol * 1.2, filter: 'bandpass', freq: 1800, out });
      this.tone(220, t, 0.05, { wave: 'triangle', vol: vol * 0.8, out });
    } else if (kind === 'h') {
      this.noise(t, 0.04, { vol: vol * 0.6, filter: 'highpass', freq: 7000, out });
    }
  }

  sfx(name) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.005;
    const T = (f, s, d, o) => this.tone(f, t + s, d, o);
    switch (name) {
      case 'cursor': T(880, 0, 0.035, { vol: 0.05 }); break;
      case 'ok': T(660, 0, 0.05, { vol: 0.07 }); T(990, 0.05, 0.07, { vol: 0.07 }); break;
      case 'cancel': T(440, 0, 0.05, { vol: 0.06 }); T(330, 0.05, 0.07, { vol: 0.06 }); break;
      case 'talk': T(1100 + Math.random() * 200, 0, 0.025, { vol: 0.025 }); break;
      case 'door': this.noise(t, 0.25, { vol: 0.08, filter: 'lowpass', freq: 900 }); T(196, 0.02, 0.12, { wave: 'triangle', vol: 0.12 }); break;
      case 'coin': T(988, 0, 0.07, { vol: 0.07 }); T(1319, 0.07, 0.25, { vol: 0.07 }); break;
      case 'success': [523, 659, 784, 1047].forEach((f, i) => T(f, i * 0.08, 0.12, { vol: 0.07 })); T(1047, 0.32, 0.35, { vol: 0.06, wave: 'triangle' }); break;
      case 'fanfare': [[523, 0, 0.1], [523, 0.12, 0.1], [523, 0.24, 0.1], [698, 0.36, 0.45], [784, 0.85, 0.15], [698, 1.0, 0.15], [784, 1.15, 0.6]].forEach(([f, s, d]) => { T(f, s, d, { vol: 0.07 }); T(f / 2, s, d, { vol: 0.08, wave: 'triangle' }); }); break;
      case 'fail': [392, 330, 262].forEach((f, i) => T(f, i * 0.14, 0.16, { vol: 0.07, wave: 'sawtooth' })); break;
      case 'buzz': T(110, 0, 0.25, { vol: 0.08, wave: 'square' }); break;
      case 'hit': this.noise(t, 0.08, { vol: 0.12, filter: 'lowpass', freq: 2500 }); T(120, 0, 0.06, { wave: 'square', vol: 0.06 }); break;
      case 'good': T(1047, 0, 0.06, { vol: 0.06 }); T(1568, 0.05, 0.1, { vol: 0.05 }); break;
      case 'laugh':
        for (let i = 0; i < 5; i++) {
          T(330 - i * 12, i * 0.11, 0.08, { wave: 'square', vol: 0.05, slideTo: 260 - i * 12 });
          this.noise(t + i * 0.11, 0.07, { vol: 0.03, filter: 'bandpass', freq: 1200 });
        }
        break;
      case 'applause':
        for (let i = 0; i < 28; i++) this.noise(t + Math.random() * 1.2, 0.05, { vol: 0.05, filter: 'bandpass', freq: 2000 + Math.random() * 2000 });
        break;
      case 'zukko': T(1400, 0, 0.45, { wave: 'sine', vol: 0.1, slideTo: 180 }); this.noise(t + 0.45, 0.2, { vol: 0.12, filter: 'lowpass', freq: 600 }); break;
      case 'whistle': T(600, 0, 0.35, { wave: 'sine', vol: 0.08, slideTo: 1600 }); break;
      case 'drum': this.drum('k', t, 0.08); break;
      case 'snare': this.drum('s', t, 0.08); break;
      case 'shutter': this.noise(t, 0.03, { vol: 0.12, filter: 'highpass', freq: 3000 }); this.noise(t + 0.06, 0.03, { vol: 0.1, filter: 'highpass', freq: 3000 }); break;
      case 'chime': [784, 659, 523, 392].forEach((f, i) => T(f, i * 0.28, 0.5, { wave: 'triangle', vol: 0.09 })); break;
      case 'sword': this.noise(t, 0.15, { vol: 0.1, filter: 'highpass', freq: 4000 }); T(2000, 0, 0.12, { wave: 'sine', vol: 0.04, slideTo: 3000 }); break;
      case 'sleep': [523, 440, 392, 330, 262].forEach((f, i) => T(f, i * 0.25, 0.3, { wave: 'triangle', vol: 0.08 })); break;
      default: T(700, 0, 0.05, { vol: 0.05 });
    }
  }

  bgm(name) {
    if (!name) { this.stopBgm(); return; }
    if (!this.ctx) { this.wanted = name; return; }
    if (this.current && this.current.name === name) return;
    this.stopBgm();
    const def = SONGS[name];
    if (!def) { console.warn('unknown song', name); return; }
    const song = { name, def, tracks: def.tracks.map(parseTrack), step: 0, next: this.ctx.currentTime + 0.08 };
    song.out = this.ctx.createGain();
    song.out.gain.value = 1;
    song.out.connect(this.bgmGain);
    this.current = song;
    const stepDur = (60 / def.bpm) * (def.step || 0.5);
    this.timer = setInterval(() => {
      if (!this.current || this.current !== song) return;
      const now = this.ctx.currentTime;
      if (song.next < now - 0.5) song.next = now + 0.05; // tab was in background
      while (song.next < now + 0.15) {
        for (const tr of song.tracks) {
          const ev = tr.events[song.step % tr.length];
          if (!ev) continue;
          if (ev.drum) this.drum(ev.drum, song.next, tr.vol, song.out);
          else this.tone(ev.freq, song.next, stepDur * ev.len * 0.92, { wave: tr.wave, vol: tr.vol, out: song.out });
        }
        song.step++;
        song.next += stepDur;
      }
    }, 25);
  }

  stopBgm() {
    this.wanted = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.current && this.ctx) {
      const out = this.current.out;
      out.gain.setValueAtTime(out.gain.value, this.ctx.currentTime);
      out.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
      setTimeout(() => out.disconnect(), 400);
    }
    this.current = null;
  }
}

export const audio = new AudioEngine();
