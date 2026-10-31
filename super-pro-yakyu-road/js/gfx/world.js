// スーパープロ野球ロード 3D — the 3D world: the WebGL renderer under the 2D overlay canvas, the scene, the lights (day /
// night), the ballpark, the camera rigs (behind the catcher, the broadcast high home, the follow camera, an orbit for menus),
// the scoreboard, and project() to place 2D overlay graphics on 3D points.
import * as THREE from '../vendor/three.module.min.js';
import { buildStadium, V } from './stadium.js';

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 2000);
    this.t = 0;
    this.mode = 'orbit';
    this.night = false;
    this.build({ night: false });
    this.drawBoard({});
  }
  build(o = {}) {
    if (this.stadium) { this.scene.remove(this.stadium.group); }
    for (const l of this.lights || []) this.scene.remove(l);
    this.night = !!o.night;
    this.stadium = buildStadium(this.scene, { night: this.night, c1: o.c1, c2: o.c2 });
    const hemi = new THREE.HemisphereLight(this.night ? 0x8090c0 : 0xcfe6ff, this.night ? 0x223018 : 0x4a6a32, this.night ? 0.9 : 1.1);
    const sun = new THREE.DirectionalLight(this.night ? 0xfff4e0 : 0xfff2dc, this.night ? 1.6 : 2.2);
    sun.position.set(-40, 80, 30); sun.target.position.set(0, 0, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 80; sc.bottom = -60; sc.near = 10; sc.far = 260;
    sun.shadow.bias = -0.0006;
    this.scene.add(hemi, sun, sun.target);
    this.lights = [hemi, sun, sun.target];
    this.scene.fog = new THREE.Fog(this.night ? 0x0c1430 : 0xbfd8ee, 220, 700);
  }
  resize(wCss, hCss, dpr) {
    this.renderer.setPixelRatio(Math.min(2, dpr || 1));
    this.renderer.setSize(wCss, hCss, false);
    this.camera.aspect = wCss / hCss;
    this.camera.updateProjectionMatrix();
  }
  // camera rigs. setView(name, o): 'catcher' (behind the plate, the batting / pitching view), 'high' (broadcast high home),
  // 'orbit' (menus), 'look' (o.from / o.to in field coords)
  setView(name, o = {}) { this.mode = name; this.fTo = null; this.viewOpt = o; this.applyView(0); }
  applyView(dt) {
    const c = this.camera, o = this.viewOpt || {};
    if (this.mode === 'catcher') { c.fov = 27; c.position.copy(V(0, -7, 2.45)); c.lookAt(V(0, 8, 0.5)); }
    else if (this.mode === 'high') { c.fov = 42; c.position.copy(V(0, -22, 26)); c.lookAt(V(0, 40, 0)); }
    else if (this.mode === 'orbit') { const a = this.t * (o.speed || 0.04) + (o.a || 0); const r = o.r || 62, cx = o.cx || 0, cy = o.cy != null ? o.cy : 40; c.fov = o.fov || 46; c.position.copy(V(cx + Math.sin(a) * r, cy - Math.cos(a) * r, o.h || 24)); c.lookAt(V(cx, cy, o.lookH != null ? o.lookH : 2)); }
    else if (this.mode === 'look') { c.fov = o.fov || 40; c.position.copy(V(...o.from)); c.lookAt(V(...o.to)); }
    c.updateProjectionMatrix();
  }
  // the scoreboard over center field: o = { away, home (short names), line: { away: [], home: [] }, score, inning, top, b, s, o, title }
  drawBoard(o = {}) {
    const sb = this.stadium.scoreboard, x = sb.ctx, W = sb.canvas.width, H = sb.canvas.height;
    x.fillStyle = '#0c1018'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#2a3242'; x.lineWidth = 6; x.strokeRect(6, 6, W - 12, H - 12);
    const F = (sz, w = 'bold') => `${w} ${sz}px "Hiragino Sans", "Meiryo", sans-serif`;
    if (!o.away) {
      x.fillStyle = '#ffd23f'; x.font = F(64, '900'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('スーパープロ野球ロード', W / 2, H / 2 - 30);
      x.fillStyle = '#9fd0ff'; x.font = F(34); x.fillText('SUPER PRO BASEBALL ROAD', W / 2, H / 2 + 40);
    } else {
      const n = Math.max(9, (o.line && o.line.away ? o.line.away.length : 0));
      const cw = 620 / n;
      x.font = F(30); x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < n; i++) { x.fillStyle = '#8aa0c8'; x.fillText(String(i + 1), 230 + i * cw + cw / 2, 60); }
      x.fillStyle = '#ffd23f'; x.fillText('R', 900, 60);
      [['away', 130], ['home', 210]].forEach(([s, y]) => {
        x.fillStyle = '#ffffff'; x.font = F(38); x.textAlign = 'left'; x.fillText(o[s] || '', 30, y);
        x.textAlign = 'center';
        for (let i = 0; i < n; i++) { const v = o.line && o.line[s] ? o.line[s][i] : undefined; x.fillStyle = '#f4f4f4'; x.fillText(v === undefined ? '' : String(v), 230 + i * cw + cw / 2, y); }
        x.fillStyle = '#ffd23f'; x.font = F(48, '900'); x.fillText(String((o.score || {})[s] || 0), 900, y);
        x.font = F(38);
      });
      // the count lights
      const lights = [['B', o.b || 0, 3, '#3ad06a'], ['S', o.s || 0, 2, '#ffcf3a'], ['O', o.o || 0, 2, '#ff4a4a']];
      lights.forEach(([lb, v, mx, col], i) => { x.fillStyle = '#cfd8ee'; x.font = F(30); x.textAlign = 'left'; x.fillText(lb, 40 + i * 240, 310); for (let k = 0; k < mx; k++) { x.beginPath(); x.arc(100 + i * 240 + k * 44, 310, 15, 0, 7); x.fillStyle = k < v ? col : '#232a38'; x.fill(); } });
    }
    sb.tex.needsUpdate = true;
  }
  // a smoothed camera: from / to in field coords, k = how much of the way to move this frame (1 = jump)
  follow(from, to, fov = 40, k = 0.1) {
    this.mode = 'follow';
    const c = this.camera, P = V(from.x, from.y, from.h), T = V(to.x, to.y, to.h);
    if (!this.fTo || k >= 1) { this.fTo = T.clone(); c.position.copy(P); }
    else { c.position.lerp(P, k); this.fTo.lerp(T, k); }
    c.fov = fov; c.lookAt(this.fTo); c.updateProjectionMatrix();
  }
  update(dt) { this.t += dt; if (this.mode === 'orbit') this.applyView(dt); }
  render() { this.renderer.render(this.scene, this.camera); }
  // a field point → overlay coords (960x540); behind the camera → null
  project(x, y, h, W = 960, H = 540) {
    const v = V(x, y, h).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
  }
}
export { THREE, V };
