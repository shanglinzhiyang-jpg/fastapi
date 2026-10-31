// スーパープロ野球ロード — the engine core: the canvas (960x540 logical, scaled to fit, crisp on retina), the main loop
// (60 steps a second), a stack of scenes, input (keyboard, the on-screen pad, taps), tiny synthesized sounds, a seeded RNG
// and math helpers. No game rules here.
//
// Scene contract: { update(g) , draw(c, g), opaque?: bool (scenes below are not drawn), onTap?(x, y) }
// g.push(scene) / g.pop(scene) / g.replace(scene); g.input.pressed(k) (this frame) / g.input.held(k); k in up down left right a b start.
export const W = 960, H = 540;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = { out: (t) => 1 - (1 - t) * (1 - t), inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2), back: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2 };

// a small seeded RNG (mulberry32); rng() → [0,1)
export function makeRng(seed) {
  let a = seed >>> 0 || 1;
  const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.state = () => a;
  f.set = (v) => { a = v >>> 0; };
  return f;
}
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
export const randInt = (a, b, r = Math.random) => a + Math.floor(r() * (b - a + 1));
// a normal-ish random number (mean 0, sd ~1)
export const gauss = (r = Math.random) => (r() + r() + r() + r() - 2) * 1.7;

// ---------------------------------------------------------------- input
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', KeyZ: 'a', Space: 'a', Enter: 'a', KeyX: 'b', ShiftLeft: 'b', ShiftRight: 'b', Escape: 'start', KeyC: 'start' };
export class Input {
  constructor() { this.down = new Set(); this.prev = new Set(); this.queue = []; this.repeat = {}; }
  press(k, src = 'k') { this.queue.push([k, true, src]); }
  release(k, src = 'k') { this.queue.push([k, false, src]); }
  step() {
    this.prev = new Set(this.down);
    for (const [k, on] of this.queue) { if (on) this.down.add(k); else this.down.delete(k); }
    this.queue.length = 0;
    for (const k of ['up', 'down', 'left', 'right']) this.repeat[k] = this.down.has(k) ? (this.repeat[k] || 0) + 1 : 0;
  }
  held(k) { return this.down.has(k); }
  pressed(k) { return this.down.has(k) && !this.prev.has(k); }
  // a direction that repeats while held (menus)
  rep(k) { const n = this.repeat[k] || 0; return n === 1 || (n > 18 && n % 5 === 0); }
  consume() { this.prev = new Set(this.down); }
}

// ---------------------------------------------------------------- sound (WebAudio blips, no files)
export const sound = {
  ctx: null, muted: false,
  unlock() { try { if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) this.ctx = new C(); } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { /* no audio */ } },
  tone(freq, dur = 0.08, type = 'square', vol = 0.06, slide = 0) {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime, o = this.ctx.createOscillator(), gn = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  },
  noise(dur = 0.12, vol = 0.12) {
    if (this.muted || !this.ctx) return;
    try {
      const n = Math.floor(this.ctx.sampleRate * dur), b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = this.ctx.createBufferSource(), gn = this.ctx.createGain(); s.buffer = b; gn.gain.value = vol; s.connect(gn); gn.connect(this.ctx.destination); s.start();
    } catch (e) { /* ignore */ }
  },
  sfx(k) {
    const T = (f, d, ty, v, s) => this.tone(f, d, ty, v, s);
    switch (k) {
      case 'cursor': T(880, 0.04, 'square', 0.03); break;
      case 'ok': T(660, 0.06, 'square', 0.05); setTimeout(() => T(990, 0.08, 'square', 0.05), 50); break;
      case 'cancel': T(440, 0.08, 'square', 0.04, -200); break;
      case 'buzz': T(150, 0.15, 'sawtooth', 0.05); break;
      case 'hit': this.noise(0.08, 0.25); T(1200, 0.06, 'triangle', 0.08, -600); break;
      case 'bighit': this.noise(0.14, 0.35); T(1500, 0.18, 'triangle', 0.1, -900); break;
      case 'mitt': this.noise(0.05, 0.2); T(220, 0.05, 'square', 0.06); break;
      case 'swing': T(300, 0.12, 'sawtooth', 0.03, 500); break;
      case 'cheer': for (let i = 0; i < 6; i++) setTimeout(() => this.noise(0.25, 0.05), i * 60); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => T(f, 0.16, 'square', 0.05), i * 110)); break;
      case 'out': T(392, 0.12, 'square', 0.04); setTimeout(() => T(294, 0.16, 'square', 0.04), 90); break;
      default: break;
    }
  },
};

// ---------------------------------------------------------------- the game shell
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d');
    this.input = new Input();
    this.scenes = [];
    this.frame = 0;
    this.toastQ = [];
    this.bindKeys();
    this.bindPad();
    this.bindTaps();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  get top() { return this.scenes[this.scenes.length - 1] || null; }
  push(s) { this.scenes.push(s); if (s.enter) s.enter(this); return s; }
  pop(s) { const i = s ? this.scenes.lastIndexOf(s) : this.scenes.length - 1; if (i >= 0) { const [x] = this.scenes.splice(i, 1); if (x && x.leave) x.leave(this); } this.input.consume(); }
  replace(s) { while (this.scenes.length) this.pop(); this.push(s); }
  toast(text, col = '#ffffff') { this.toastQ.push({ text, col, t: 0 }); }
  resize() {
    const stage = this.canvas.parentElement, box = stage.parentElement.getBoundingClientRect();
    const k = Math.max(0.2, Math.min(box.width / W, box.height / H));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    stage.style.width = `${Math.floor(W * k)}px`;
    stage.style.height = `${Math.floor(H * k)}px`;
    if (this.world) this.world.resize(Math.floor(W * k), Math.floor(H * k), Math.min(dpr, document.body.classList.contains('touch') ? 1.5 : 2));
    this.canvas.width = Math.floor(W * k * dpr);
    this.canvas.height = Math.floor(H * k * dpr);
    this.scale = (W * k * dpr) / W;
  }
  bindKeys() {
    window.addEventListener('keydown', (e) => { const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); sound.unlock(); if (!e.repeat) this.input.press(k); if (document.body.classList.contains('touch')) document.body.classList.remove('touch'); });
    window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); this.input.release(k); });
  }
  bindPad() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse || /[?&]touch=1/.test(location.search)) document.body.classList.add('touch');
    const els = document.querySelectorAll('#pad [data-k]');
    els.forEach((el) => {
      const k = el.dataset.k;
      const on = (e) => { e.preventDefault(); sound.unlock(); el.classList.add('on'); this.input.press(k, 't'); };
      const off = (e) => { e.preventDefault(); el.classList.remove('on'); this.input.release(k, 't'); };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    });
    window.addEventListener('touchstart', () => { if (!document.body.classList.contains('touch')) { document.body.classList.add('touch'); this.resize(); } }, { passive: true });
  }
  bindTaps() {
    this.canvas.addEventListener('pointerdown', (e) => {
      sound.unlock();
      const r = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) * W) / r.width, y = ((e.clientY - r.top) * H) / r.height;
      const s = this.top;
      if (s && s.onTap) s.onTap(x, y, this);
    });
  }
  step() {
    this.input.step();
    this.frame++;
    const s = this.top;
    if (s && s.update) { try { s.update(this); } catch (e) { console.error(e); } }
    if (this.world) this.world.update(1 / 60);
    for (const t of this.toastQ) t.t++;
    this.toastQ = this.toastQ.filter((t) => t.t < 150);
  }
  render() {
    const c = this.c;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.imageSmoothingEnabled = true;
    let from = this.scenes.length - 1;
    while (from > 0 && !this.scenes[from].opaque) from--;
    // the 3D world under the 2D overlay: shown when the bottom drawn scene has draw3d(world, g)
    if (this.world) {
      const base = this.scenes[Math.max(0, from)];
      const on = !!(base && base.draw3d);
      if (on !== this.glOn) { this.glOn = on; this.world.canvas.style.visibility = on ? 'visible' : 'hidden'; }
      if (on) { try { base.draw3d(this.world, this); this.world.render(); } catch (e) { console.error(e); } }
    }
    for (let i = Math.max(0, from); i < this.scenes.length; i++) { const s = this.scenes[i]; try { s.draw(c, this); } catch (e) { console.error(e); } }
    // toasts
    this.toastQ.slice(-3).forEach((t, i) => {
      const a = t.t < 10 ? t.t / 10 : t.t > 130 ? (150 - t.t) / 20 : 1;
      c.globalAlpha = a;
      c.font = 'bold 18px sans-serif';
      const w = c.measureText(t.text).width + 40;
      c.fillStyle = 'rgba(8,16,36,0.88)'; roundRect(c, (W - w) / 2, 20 + i * 44, w, 36, 18); c.fill();
      c.fillStyle = t.col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t.text, W / 2, 38 + i * 44);
      c.globalAlpha = 1;
    });
  }
  // a fixed-step loop; `__ff(n)` (tests) runs n steps without waiting
  start() {
    let last = performance.now(), acc = 0;
    const tick = (now) => {
      if (!this.paused) {
        acc += Math.min(100, now - last);
        while (acc >= 1000 / 60) { this.step(); acc -= 1000 / 60; }
        this.render();
      }
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// ---------------------------------------------------------------- drawing primitives shared by every screen
export function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y); c.lineTo(x + w - rr, y); c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr); c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h); c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr); c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}
export const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif';
export function txt(c, s, x, y, o = {}) {
  const size = o.size || 18;
  c.font = `${o.bold === false ? '' : 'bold '}${size}px ${FONT}`;
  c.textAlign = o.align || 'left';
  c.textBaseline = o.base || 'middle';
  let str = String(s);
  if (o.max) { while (str.length > 1 && c.measureText(str).width > o.max) str = str.slice(0, -2) + '…'; }
  if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.strokeW || 4; c.strokeStyle = o.stroke; c.strokeText(str, x, y); }
  if (o.shadow) { c.fillStyle = o.shadow; c.fillText(str, x + 2, y + 2); }
  c.fillStyle = o.color || '#ffffff';
  c.fillText(str, x, y);
  return c.measureText(str).width;
}
// a content panel in the broadcast style: dark navy glass, a glossy top, a thin gold edge, a coloured band on top
export function panel(c, x, y, w, h, o = {}) {
  const r = o.r || 10;
  c.save();
  if (o.shadow !== false) { c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 16; c.shadowOffsetY = 5; }
  const gr = c.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, o.top || 'rgba(27,44,94,0.96)'); gr.addColorStop(1, o.bottom || 'rgba(8,16,40,0.96)');
  c.fillStyle = gr; roundRect(c, x, y, w, h, r); c.fill();
  c.restore();
  c.save(); roundRect(c, x, y, w, h, r); c.clip();
  const gl = c.createLinearGradient(0, y, 0, y + Math.min(h, 60)); gl.addColorStop(0, 'rgba(255,255,255,0.16)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl; c.fillRect(x, y, w, Math.min(h, 60));
  c.fillStyle = o.band || 'rgba(245,197,66,0.9)'; c.fillRect(x, y, w, 3);
  c.restore();
  c.lineWidth = 1.5; c.strokeStyle = o.edge || 'rgba(245,197,66,0.55)'; roundRect(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r); c.stroke();
}
const slantPath = (c, x, y, w, h, k) => { c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w, y); c.lineTo(x + w - k, y + h); c.lineTo(x, y + h); c.closePath(); };
// a menu list in the broadcast style (slanted bars; the chosen one gold with a red tab); items: [{ label, sub?, right?, dim? }]
export function menuList(c, x, y, w, items, sel, o = {}) {
  const rh = o.rowH || 46, rects = [], k = 12;
  items.forEach((it, i) => {
    const ry = y + i * rh + 3, hh = rh - 6, on = i === sel;
    c.save();
    if (on) {
      c.shadowColor = 'rgba(245,197,66,0.55)'; c.shadowBlur = 14;
      const gr = c.createLinearGradient(0, ry, 0, ry + hh); gr.addColorStop(0, '#ffe590'); gr.addColorStop(0.5, '#f5c542'); gr.addColorStop(1, '#d99a12');
      c.fillStyle = gr; slantPath(c, x, ry, w, hh, k); c.fill();
      c.shadowBlur = 0; c.fillStyle = '#e0283c'; slantPath(c, x, ry, 14 + k, hh, k); c.fill();
    } else {
      const gr = c.createLinearGradient(0, ry, 0, ry + hh); gr.addColorStop(0, 'rgba(30,48,100,0.92)'); gr.addColorStop(1, 'rgba(10,20,48,0.92)');
      c.fillStyle = gr; slantPath(c, x, ry, w, hh, k); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x + k, ry, w - k, hh * 0.45);
      c.strokeStyle = 'rgba(245,197,66,0.35)'; c.lineWidth = 1; slantPath(c, x + 0.5, ry + 0.5, w - 1, hh - 1, k); c.stroke();
    }
    c.restore();
    txt(c, it.label, x + 30, ry + (it.sub ? hh / 2 - 7 : hh / 2), { size: o.size || 19, color: it.dim ? 'rgba(255,255,255,0.4)' : on ? '#1a1000' : '#eef3ff', max: w - 130 });
    if (it.sub) txt(c, it.sub, x + 30, ry + hh / 2 + 11, { size: 12, color: on ? 'rgba(40,24,0,0.8)' : 'rgba(220,230,255,0.6)', bold: false, max: w - 50 });
    if (it.right) txt(c, it.right, x + w - 24, ry + hh / 2, { size: 15, align: 'right', color: on ? '#1a1000' : '#ffd36a' });
    rects.push({ x, y: ry - 3, w, h: rh, i });
  });
  return rects;
}
export const inRect = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
