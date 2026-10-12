/* 熱闘！ポケットベースボール — 効果音 (Web Audio で合成。音源ファイル不要) */
(function (PB) {
  "use strict";
  const A = {};
  let ctx = null;
  let master = null;
  let crowd = null;
  let noiseBuf = null;
  A.enabled = true;
  A.voice = false;
  A.bgm = true;

  A.unlock = function () {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      ctx = null;
    }
  };

  function ok() {
    return A.enabled && ctx && ctx.state === "running";
  }

  function noise(dur, filterType, freq, q, gain, when, sweepTo, dest) {
    const t = ctx.currentTime + (when || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, type, gain, when, slideTo) {
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // 快音 (strength 0..1)
  A.hit = function (strength) {
    if (!ok()) return;
    const s = Math.max(0.2, Math.min(1, strength));
    noise(0.09 + s * 0.08, "bandpass", 1800 + s * 1400, 1.4, 0.5 + s * 0.6);
    tone(900 + s * 600, 0.05, "square", 0.12 * s);
    noise(0.25, "highpass", 3500, 0.7, 0.12 * s, 0.01);
  };
  A.tip = function () {
    if (!ok()) return;
    noise(0.06, "bandpass", 2500, 2, 0.3);
  };
  A.mitt = function () {
    if (!ok()) return;
    noise(0.09, "lowpass", 420, 1, 0.9);
    tone(120, 0.08, "sine", 0.4);
  };
  A.swing = function () {
    if (!ok()) return;
    noise(0.22, "bandpass", 350, 1.2, 0.25, 0, 1600);
  };
  A.catchBall = function () {
    if (!ok()) return;
    noise(0.05, "lowpass", 700, 1, 0.45);
  };
  A.throwBall = function () {
    if (!ok()) return;
    noise(0.12, "bandpass", 900, 1.5, 0.12, 0, 2200);
  };
  A.whistle = function () {
    if (!ok()) return;
    tone(1900, 0.18, "sine", 0.18);
  };
  A.out = function () {
    if (!ok()) return;
    tone(660, 0.12, "triangle", 0.2);
    tone(440, 0.18, "triangle", 0.2, 0.1);
  };
  // 攻守交代の切り替え音 (中継のスイッチ音風に控えめな 3 音)
  A.chime = function () {
    if (!ok()) return;
    [523, 392, 523].forEach((f, i) => tone(f, i === 2 ? 0.32 : 0.12, "triangle", 0.08, i * 0.13));
  };
  // ニュースのジングル (オリジナルの短いフレーズ)
  A.newsJingle = function () {
    if (!ok()) return;
    const seq = [
      [523, 0.12, 0],
      [659, 0.12, 0.12],
      [784, 0.12, 0.24],
      [1047, 0.42, 0.36],
    ];
    seq.forEach(([f, d, w]) => {
      tone(f, d, "square", 0.07, w);
      tone(f / 2, d, "triangle", 0.12, w);
    });
    [1047, 1319, 1568].forEach((f) => tone(f, 0.6, "triangle", 0.06, 0.36));
  };
  A.click = function () {
    if (!ok()) return;
    tone(1200, 0.04, "square", 0.06);
  };
  A.select = function () {
    if (!ok()) return;
    tone(880, 0.06, "square", 0.07);
    tone(1320, 0.08, "square", 0.06, 0.05);
  };
  A.cheer = function (level, dur) {
    if (!ok()) return;
    const d = dur || 1.6;
    const l = Math.max(0.1, Math.min(1, level));
    noise(d, "bandpass", 900, 0.6, 0.25 * l);
    noise(d * 0.8, "bandpass", 1600, 0.8, 0.18 * l, 0.05);
    noise(d * 0.6, "lowpass", 500, 0.7, 0.2 * l, 0.02);
  };
  A.groan = function () {
    if (!ok()) return;
    noise(1.0, "lowpass", 500, 1, 0.22, 0, 220);
  };
  // ホームランのファンファーレ
  A.fanfare = function () {
    if (!ok()) return;
    const n = [523, 659, 784, 1047, 784, 1047, 1319];
    const tms = [0, 0.12, 0.24, 0.36, 0.6, 0.72, 0.84];
    n.forEach((f, i) => {
      tone(f, i === n.length - 1 ? 0.7 : 0.16, "sawtooth", 0.09, tms[i]);
      tone(f * 2, i === n.length - 1 ? 0.7 : 0.14, "square", 0.03, tms[i]);
    });
    A.cheer(1, 3);
  };
  A.victory = function () {
    if (!ok()) return;
    const n = [392, 523, 659, 784, 659, 784, 1047];
    n.forEach((f, i) => tone(f, i === n.length - 1 ? 0.9 : 0.18, "sawtooth", 0.08, i * 0.16));
  };
  A.lose = function () {
    if (!ok()) return;
    [392, 370, 349, 262].forEach((f, i) => tone(f, 0.35, "triangle", 0.12, i * 0.3));
  };

  // 応援トランペット (攻撃中に流す短いループ)
  const CHANT = [
    [659, 0.2],
    [659, 0.2],
    [784, 0.4],
    [659, 0.2],
    [587, 0.2],
    [523, 0.4],
    [587, 0.2],
    [659, 0.2],
    [784, 0.2],
    [880, 0.2],
    [784, 0.6],
  ];
  let chantTimer = null;
  // on: 応援を流す/止める。o: { team: 球団 id (球団ごとのリフ), vol: 音量 (相手側は小さく), chance: チャンステーマ }
  A.chant = function (on, o) {
    if (chantTimer) {
      clearTimeout(chantTimer);
      chantTimer = null;
    }
    if (!on) return;
    const opt = o || {};
    const play = () => {
      if (!ok() || !A.bgm) {
        chantTimer = setTimeout(play, 3000);
        return;
      }
      if (opt.team) {
        const len = playRiff(opt.team, opt);
        chantTimer = setTimeout(play, (len + 0.5) * 1000);
        return;
      }
      let t = 0;
      for (const [f, d] of CHANT) {
        tone(f, d * 0.9, "sawtooth", 0.035, t);
        tone(f / 2, d * 0.9, "square", 0.012, t);
        t += d;
      }
      // 太鼓
      for (let k = 0; k < 8; k++) noise(0.12, "lowpass", 160, 1, 0.25, k * 0.4);
      chantTimer = setTimeout(play, (t + 2.2) * 1000);
    };
    chantTimer = setTimeout(play, opt.delay != null ? opt.delay : 900);
  };

  /* ---------- 球団ごとの応援リフ (このゲームのためのオリジナル。実在の応援歌は使わない) ---------- */
  const SCALES = { maj: [0, 2, 4, 5, 7, 9, 11], mix: [0, 2, 4, 5, 7, 9, 10], pent: [0, 2, 4, 7, 9] };
  function degMidi(key, scale, d) {
    const s = SCALES[scale] || SCALES.maj;
    const i = d - 1;
    const o = Math.floor(i / s.length);
    return key + o * 12 + s[((i % s.length) + s.length) % s.length];
  }
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // notes: [度数 (1 = 主音), 拍]。2 小節 (8 拍)。drum: "4" 4 分 | "8" 8 分 | "clave" 3-2 の手拍子
  A.RIFFS = {
    g: { key: 70, tempo: 132, scale: "maj", drum: "4", notes: [[1, 0.5], [3, 0.5], [5, 1], [6, 0.5], [5, 0.5], [3, 1], [4, 0.5], [3, 0.5], [2, 0.5], [3, 0.5], [5, 1], [1, 1]] },
    t: { key: 67, tempo: 144, scale: "maj", drum: "clave", notes: [[5, 0.5], [8, 0.5], [7, 0.5], [8, 0.5], [5, 1], [3, 1], [4, 0.5], [5, 0.5], [6, 0.5], [5, 0.5], [2, 1], [1, 1]] },
    d: { key: 69, tempo: 124, scale: "maj", drum: "4", notes: [[1, 1], [2, 0.5], [3, 0.5], [5, 1], [3, 1], [6, 0.5], [5, 0.5], [3, 0.5], [2, 0.5], [1, 2]] },
    s: { key: 72, tempo: 138, scale: "pent", drum: "8", notes: [[1, 0.5], [2, 0.5], [3, 1], [5, 0.5], [4, 0.5], [3, 1], [2, 0.5], [3, 0.5], [4, 0.5], [2, 0.5], [1, 2]] },
    c: { key: 65, tempo: 136, scale: "mix", drum: "4", notes: [[5, 0.5], [4, 0.5], [5, 0.5], [7, 0.5], [8, 1], [5, 1], [4, 0.5], [3, 0.5], [4, 0.5], [2, 0.5], [1, 1], [1, 1]] },
    yb: { key: 71, tempo: 140, scale: "maj", drum: "8", notes: [[3, 0.5], [5, 0.5], [8, 1], [7, 0.5], [6, 0.5], [5, 1], [6, 0.5], [5, 0.5], [4, 0.5], [2, 0.5], [1, 2]] },
    h: { key: 68, tempo: 128, scale: "maj", drum: "clave", notes: [[1, 0.5], [1, 0.5], [5, 1], [4, 0.5], [3, 0.5], [2, 1], [3, 0.5], [4, 0.5], [5, 0.5], [6, 0.5], [5, 1], [1, 1]] },
    l: { key: 66, tempo: 134, scale: "pent", drum: "4", notes: [[5, 1], [4, 0.5], [3, 0.5], [2, 1], [3, 1], [4, 0.5], [5, 0.5], [6, 0.5], [5, 0.5], [4, 1], [1, 1]] },
    f: { key: 69, tempo: 142, scale: "mix", drum: "8", notes: [[8, 0.5], [7, 0.5], [5, 0.5], [4, 0.5], [5, 1], [5, 1], [4, 0.5], [5, 0.5], [7, 0.5], [8, 0.5], [5, 1], [1, 1]] },
    m: { key: 64, tempo: 150, scale: "maj", drum: "8", notes: [[1, 0.25], [1, 0.25], [3, 0.5], [5, 0.5], [3, 0.5], [6, 1], [5, 1], [4, 0.5], [3, 0.5], [2, 0.5], [4, 0.5], [3, 1], [1, 1]] },
    bu: { key: 67, tempo: 130, scale: "mix", drum: "clave", notes: [[5, 0.5], [5, 0.5], [4, 0.5], [5, 0.5], [7, 1], [5, 1], [4, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [1, 2]] },
    bw: { key: 70, tempo: 126, scale: "pent", drum: "4", notes: [[3, 0.5], [4, 0.5], [5, 1], [4, 0.5], [3, 0.5], [1, 1], [2, 0.5], [3, 0.5], [4, 0.5], [3, 0.5], [1, 2]] },
  };
  // 登録のない球団 (自作チームなど) は id から 1 つ選んで調だけ変える
  function riffOf(id) {
    const r = A.RIFFS[id];
    if (r) return r;
    const ks = Object.keys(A.RIFFS);
    let h = 0;
    for (const c of String(id || "x")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const b = A.RIFFS[ks[h % ks.length]];
    return Object.assign({}, b, { key: 64 + (h % 8) });
  }
  // 金管らしい音 (のこぎり波 + 1 オクターブ下の矩形波をローパスで丸め、立ち上がりで少し明るく)
  function brass(freq, dur, gain, when, dest) {
    const t = ctx.currentTime + (when || 0);
    const o1 = ctx.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.setValueAtTime(freq, t);
    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.setValueAtTime(freq / 2, t);
    const g2 = ctx.createGain();
    g2.gain.value = 0.3;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(700, t);
    f.frequency.linearRampToValueAtTime(2800, t + 0.04);
    f.frequency.linearRampToValueAtTime(1700, t + Math.max(0.06, dur * 0.8));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.025);
    g.gain.setValueAtTime(gain * 0.85, t + Math.max(0.03, dur * 0.7));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o1.connect(f);
    o2.connect(g2);
    g2.connect(f);
    f.connect(g);
    g.connect(dest || master);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }
  function clap(when, gain) {
    noise(0.03, "bandpass", 1800, 3, gain, when);
    noise(0.03, "bandpass", 1800, 3, gain * 0.8, when + 0.05);
  }
  function drums(kind, beats, spb, when, gain) {
    const per = kind === "8" ? 2 : 1;
    for (let k = 0; k < beats * per; k++) noise(0.12, "lowpass", 160, 1, gain * (k % (per * 2) === 0 ? 1 : 0.7), when + (k * spb) / per);
    if (kind === "clave") for (let b = 0; b + 7 <= beats; b += 8) for (const x of [0, 1.5, 3, 5, 6]) clap(when + (b + x) * spb, gain * 0.35);
  }
  // 短いフレーズ: seq = [[MIDI 番号 | null (休符), 拍], …]。鳴らした長さ (秒) を返す
  A.motif = function (seq, o) {
    const opt = o || {};
    const spb = 60 / (opt.tempo || 120);
    let t = opt.when || 0;
    const t0 = t;
    for (const [m, b] of seq) {
      const d = b * spb;
      if (m != null && ok()) {
        const gain = opt.gain || 0.06;
        if (opt.wave === "brass") {
          brass(midiHz(m), d * 0.92, gain, t);
          if (opt.oct) brass(midiHz(m + 12), d * 0.9, gain * 0.45, t);
        } else tone(midiHz(m), d * 0.9, opt.wave || "triangle", gain, t);
      }
      t += d;
    }
    return t - t0;
  };
  // 応援リフ 1 回 (リフ 8 拍 + 太鼓とメガホンの 4 拍)。長さ (秒) を返す
  function playRiff(id, o) {
    const r = riffOf(id);
    const vol = o.vol == null ? 1 : o.vol;
    const tempo = r.tempo + (o.chance ? 12 : 0);
    const spb = 60 / tempo;
    const seq = r.notes.map((n) => [degMidi(r.key, r.scale, n[0]), n[1]]);
    const beats = r.notes.reduce((a, n) => a + n[1], 0);
    A.motif(seq, { tempo, wave: "brass", gain: 0.042 * vol, oct: !!o.chance });
    drums(o.chance ? "8" : r.drum, beats + 4, spb, 0, 0.22 * vol);
    for (let k = 0; k < 4; k++) clap((beats + k + 0.5) * spb, 0.07 * vol);
    return (beats + 4) * spb;
  }
  A.riffLen = (id) => {
    const r = riffOf(id);
    return ((r.notes.reduce((a, n) => a + n[1], 0) + 4) * 60) / r.tempo;
  };
  // ラッキー 7 などの応援歌: リフを 2 回、オクターブを重ねて
  A.anthem = function (id) {
    if (!ok() || !A.bgm) return 0;
    const r = riffOf(id);
    const tempo = r.tempo + 6;
    const spb = 60 / tempo;
    const seq = r.notes.map((n) => [degMidi(r.key, r.scale, n[0]), n[1]]);
    const L = A.motif(seq, { tempo, wave: "brass", gain: 0.05, oct: true });
    A.motif(seq, { tempo, wave: "brass", gain: 0.05, oct: true, when: L });
    drums("8", Math.round((2 * L) / spb), spb, 0, 0.24);
    A.roar(0.6, 2 * L, 0, 0.2);
    return 2 * L;
  };
  // 勝利の歌: 球団のリフを長調で速く 2 回 + 終わりの和音
  A.winSong = function (id) {
    if (!ok()) return 0;
    const r = riffOf(id);
    const tempo = r.tempo + 18;
    const spb = 60 / tempo;
    const seq = r.notes.map((n) => [degMidi(r.key, "maj", n[0]), n[1]]);
    const L = A.motif(seq, { tempo, wave: "brass", gain: 0.05, oct: true });
    A.motif(seq, { tempo, wave: "brass", gain: 0.05, oct: true, when: L });
    [0, 4, 7, 12].forEach((i) => brass(midiHz(r.key + i), 1.3, 0.03, 2 * L));
    drums("8", Math.round((2 * L) / spb), spb, 0, 0.22);
    return 2 * L + 1.3;
  };

  /* ---------- 演出の音 ---------- */
  // 木製バットの快音 (カキーン): 打撃の破裂音 + 高い倍音 + 1.1kHz 前後の鳴り。big: 本塁打級は低い芯の音を足す
  A.hit2 = function (strength, big) {
    if (!ok()) return;
    const s = Math.max(0.15, Math.min(1, strength));
    noise(0.08 + s * 0.06, "bandpass", 2000, 1.6, 0.45 + s * 0.6);
    tone(3600, 0.06, "square", 0.025 * s);
    tone(1080 + s * 220, 0.2 + s * 0.14, "sine", 0.09 * s, 0.004);
    tone(2350, 0.12, "sine", 0.03 * s, 0.004);
    noise(0.25, "highpass", 3500, 0.7, 0.1 * s, 0.01);
    if (big) {
      tone(70, 0.14, "sine", 0.55);
      noise(0.12, "lowpass", 140, 1, 0.45);
    }
  };
  // 歓声: 地鳴りの低音 + ざわめき + 少し遅れて甲高い声。pan: -1 (左) 〜 1 (右)
  A.roar = function (level, dur, pan, when) {
    if (!ok()) return;
    const d = dur || 2;
    const l = Math.max(0.1, Math.min(1, level));
    const w = when || 0;
    let dest = master;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(master);
      dest = p;
    }
    noise(d, "lowpass", 120, 0.7, 0.32 * l, w, null, dest);
    noise(d, "bandpass", 900, 0.6, 0.24 * l, w, null, dest);
    noise(d * 0.8, "bandpass", 1600, 0.8, 0.17 * l, w + 0.05, null, dest);
    noise(d * 0.6, "bandpass", 2200, 0.9, 0.12 * l, w + 0.4, null, dest);
  };
  // 三振「ズバッ」(ミットの破裂音 + 低い衝撃) と歓声
  A.k = function (crowd) {
    if (!ok()) return;
    noise(0.07, "bandpass", 1300, 1.2, 0.9);
    noise(0.12, "lowpass", 90, 1, 0.9);
    tone(95, 0.14, "sine", 0.45);
    if (crowd !== 0) A.roar(crowd || 0.7, 1.4, 0, 0.3);
  };
  // 審判の掛け声 (声は使わず、ローパスをかけた短いうなり)
  function grunt(f, dur, gain, when, slideTo) {
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const fl = ctx.createBiquadFilter();
    fl.type = "lowpass";
    fl.frequency.value = 850;
    fl.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.03);
    g.gain.setValueAtTime(gain, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl);
    fl.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  A.umpire = function (call) {
    if (!ok()) return;
    if (call === "strike") grunt(215, 0.34, 0.11, 0, 160);
    else if (call === "out") grunt(190, 0.2, 0.1, 0, 150);
    else if (call === "safe") {
      grunt(240, 0.14, 0.09);
      grunt(205, 0.34, 0.09, 0.13, 185);
    } else if (call === "play") {
      grunt(225, 0.2, 0.1);
      grunt(250, 0.5, 0.1, 0.2, 205);
    }
  };
  // 場内放送のチャイム (オリジナルの 4 音) と放送 (声は「実況ボイス」が ON のときだけ)
  A.paChime = function () {
    if (!ok()) return;
    [1047, 784, 659, 523].forEach((f, i) => {
      tone(f, i === 3 ? 0.55 : 0.2, "triangle", 0.085, i * 0.18);
      tone(f * 2, i === 3 ? 0.35 : 0.1, "sine", 0.015, i * 0.18);
    });
  };
  A.pa = function (text, chime) {
    if (chime !== false) A.paChime();
    if (text) setTimeout(() => A.say(text, 0.95), chime === false ? 0 : 760);
  };
  // ジェット風船 (ラッキー 7): たくさんの「ピューッ」をずらして
  A.balloons = function () {
    if (!ok()) return;
    for (let i = 0; i < 24; i++) noise(1.1 + Math.random() * 0.4, "bandpass", 3000 + Math.random() * 600, 6, 0.035, Math.random() * 0.9, 700 + Math.random() * 300);
    A.roar(0.6, 3, 0, 0.3);
  };

  // 球場のざわめき
  A.ambient = function (on) {
    if (!ctx) return;
    if (crowd) {
      try {
        crowd.src.stop();
      } catch (e) {
        /* 停止済み */
      }
      crowd = null;
    }
    if (!on || !A.enabled) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 700;
    f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.045;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
    crowd = { src, g };
  };

  // 実況ボイス (端末の音声合成。対応していない場合は何もしない)
  // 続けて呼ばれたときは前の発話をすぐには切らず、少し待ってから次を話す
  let sayAt = 0;
  let sayTimer = 0;
  A.say = function (text, rate) {
    if (!A.voice || !A.enabled) return;
    const ss = window.speechSynthesis;
    if (!ss) return;
    clearTimeout(sayTimer);
    const go = () => {
      try {
        ss.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ja-JP";
        u.rate = rate || 1.15;
        u.pitch = 1.05;
        ss.speak(u);
        sayAt = Date.now();
      } catch (e) {
        /* 音声合成非対応 */
      }
    };
    const since = Date.now() - sayAt;
    if (ss.speaking && since < 800) sayTimer = setTimeout(go, Math.max(400, 800 - since));
    else go();
  };

  A.vibrate = function (ms) {
    try {
      if (A.enabled && navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {
      /* 非対応 */
    }
  };
  // 振動のパターン (配列可)。設定の「振動」は呼ぶ側で確かめる
  A.vibe = function (pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {
      /* 非対応 */
    }
  };

  PB.Audio = A;
})((window.PB = window.PB || {}));
