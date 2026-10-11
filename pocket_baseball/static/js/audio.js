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

  function noise(dur, filterType, freq, q, gain, when, sweepTo) {
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
    g.connect(master);
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
  A.chime = function () {
    if (!ok()) return;
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35, "triangle", 0.15, i * 0.11));
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
  A.chant = function (on) {
    if (chantTimer) {
      clearTimeout(chantTimer);
      chantTimer = null;
    }
    if (!on) return;
    const play = () => {
      if (!ok() || !A.bgm) {
        chantTimer = setTimeout(play, 3000);
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
    chantTimer = setTimeout(play, 900);
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
  A.say = function (text, rate) {
    if (!A.voice || !A.enabled) return;
    try {
      const ss = window.speechSynthesis;
      if (!ss) return;
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = rate || 1.15;
      u.pitch = 1.05;
      ss.speak(u);
    } catch (e) {
      /* 音声合成非対応 */
    }
  };

  A.vibrate = function (ms) {
    try {
      if (A.enabled && navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {
      /* 非対応 */
    }
  };

  PB.Audio = A;
})((window.PB = window.PB || {}));
