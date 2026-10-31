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
    const box = this.canvas.parentElement.getBoundingClientRect();
    const k = Math.max(0.2, Math.min(box.width / W, box.height / H));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.style.width = `${Math.floor(W * k)}px`;
    this.canvas.style.height = `${Math.floor(H * k)}px`;
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
    for (const t of this.toastQ) t.t++;
    this.toastQ = this.toastQ.filter((t) => t.t < 150);
  }
  render() {
    const c = this.c;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.imageSmoothingEnabled = true;
    let from = this.scenes.length - 1;
    while (from > 0 && !this.scenes[from].opaque) from--;
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
export function panel(c, x, y, w, h, o = {}) {
  c.save();
  if (o.shadow !== false) { c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 16; c.shadowOffsetY = 6; }
  const gr = c.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, o.top || 'rgba(26,44,86,0.96)'); gr.addColorStop(1, o.bottom || 'rgba(12,24,52,0.96)');
  c.fillStyle = gr; roundRect(c, x, y, w, h, o.r || 14); c.fill();
  c.restore();
  c.lineWidth = o.lw || 2; c.strokeStyle = o.edge || 'rgba(140,180,255,0.35)'; roundRect(c, x + 1, y + 1, w - 2, h - 2, (o.r || 14) - 1); c.stroke();
}
// a menu list with a highlight; items: [{ label, sub?, right?, dim? }] → draws and returns hit rects
export function menuList(c, x, y, w, items, sel, o = {}) {
  const rh = o.rowH || 46, rects = [];
  items.forEach((it, i) => {
    const ry = y + i * rh, on = i === sel;
    if (on) {
      const gr = c.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, o.hi || '#ffb020'); gr.addColorStop(1, o.hi2 || '#ff6a3d');
      c.fillStyle = gr; roundRect(c, x, ry + 3, w, rh - 6, 10); c.fill();
    } else { c.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(c, x, ry + 3, w, rh - 6, 10); c.fill(); }
    txt(c, it.label, x + 18, ry + (it.sub ? rh / 2 - 7 : rh / 2), { size: o.size || 19, color: it.dim ? 'rgba(255,255,255,0.4)' : on ? '#1a1206' : '#eef3ff', max: w - 120 });
    if (it.sub) txt(c, it.sub, x + 18, ry + rh / 2 + 11, { size: 12, color: on ? 'rgba(26,18,6,0.8)' : 'rgba(220,230,255,0.6)', bold: false, max: w - 40 });
    if (it.right) txt(c, it.right, x + w - 16, ry + rh / 2, { size: 15, align: 'right', color: on ? '#1a1206' : '#ffd36a' });
    rects.push({ x, y: ry, w, h: rh, i });
  });
  return rects;
}
export const inRect = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
