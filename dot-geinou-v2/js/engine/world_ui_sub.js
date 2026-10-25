// 世界情勢の「下の画面」(R9-E): on a portrait phone (body.touch, taller than wide) the 640x360 game screen is only about
// 412x232 CSS px, while the spare room between it and the touch pad stays empty. While the 世界情勢 screen is open, a
// second canvas fills that room and shows the selected row's detail page in large type (like a two-screen handheld):
// the top screen keeps the map / the list (big-text layout), the bottom one the country, the crisis, the chart… A tap on
// the bottom screen = A (act on the selected row). It hides itself when another scene covers the world screen, and is
// removed when the screen closes. No game state.
export function subScreenWanted() {
  try { return typeof window !== 'undefined' && typeof document !== 'undefined' && document.body && document.body.classList.contains('touch') && window.innerHeight > window.innerWidth * 1.2; } catch (e) { return false; }
}
export class SubScreen {
  constructor(scene) {
    this.scene = scene;
    this.el = document.createElement('canvas');
    this.el.id = 'world-sub';
    Object.assign(this.el.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', zIndex: '40', display: 'none', background: '#07101c', borderTop: '2px solid #21405e', touchAction: 'none' });
    this.el.addEventListener('pointerdown', (e) => { e.preventDefault(); try { this.scene.subTap(); } catch (err) { console.error(err); } });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.appendChild(this.el);
    this.ctx = this.el.getContext('2d');
    this.box = null;
    this.lastDraw = 0;
    this.iv = setInterval(() => this.check(), 250);
  }
  // the free room between the game screen and the pad (CSS px), or null when there is none
  place() {
    const gc = document.getElementById('game');
    if (!gc) return null;
    const g = gc.getBoundingClientRect();
    const pad = document.getElementById('pad');
    const pt = pad ? pad.getBoundingClientRect().top : window.innerHeight;
    const top = Math.round(g.bottom + 4);
    const h = Math.round(pt - top - 4);
    if (h < 140 || g.width < 200) return null;
    return { x: Math.round(g.left), y: top, w: Math.round(g.width), h };
  }
  check() {
    const sc = this.scene;
    const visible = !sc.closed && sc.g && sc.g.top === sc && Date.now() - this.lastDraw < 1000 && subScreenWanted();
    if (!visible) this.el.style.display = 'none';
  }
  // drawFn(ctx, { w, h, dpr }) draws in CSS px (the transform is set by the caller of each part)
  render(drawFn) {
    const b = this.place();
    if (!b) { this.el.style.display = 'none'; return; }
    const st = this.el.style;
    if (!this.box || this.box.x !== b.x || this.box.y !== b.y || this.box.w !== b.w || this.box.h !== b.h) {
      Object.assign(st, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
      this.box = b;
    }
    st.display = 'block';
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(b.w * dpr), H = Math.round(b.h * dpr);
    if (this.el.width !== W || this.el.height !== H) { this.el.width = W; this.el.height = H; }
    this.lastDraw = Date.now();
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    drawFn(c, { w: b.w, h: b.h, dpr });
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  destroy() {
    clearInterval(this.iv);
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
