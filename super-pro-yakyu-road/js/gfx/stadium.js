// スーパープロ野球ロード 3D — the ballpark, in metres. Field coordinates: x to the right (first-base side), y toward center
// field, h up; three.js: (x, h, -y) (the camera behind home looks down −z, so first base is on the right of the screen).
// Home plate (0,0); bases 27.43 m apart; the mound 18.44 m; fences 100 m down the lines and 122 m to center, 4.2 m tall.
import * as THREE from '../vendor/three.module.min.js';
import { grassTexture, dirtTexture, crowdTexture, adsTexture, skyTexture, scoreboardCanvas } from './textures.js';

export const V = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
export const BASES = { home: [0, 0], first: [19.4, 19.4], second: [0, 38.8], third: [-19.4, 19.4] };
export const MOUND = [0, 18.44];
export const FENCE_H = 4.2;
export const fenceR = (deg) => 100 + 22 * Math.cos((Math.max(-45, Math.min(45, deg)) / 45) * (Math.PI / 2));
const rad = (d) => (d * Math.PI) / 180;

// the infield as one painted texture: dirt arc, grass diamond, base paths, circles, lines, boxes (area x −36..36, y −10..62)
function infieldTexture() {
  const S = 2048, X0 = -36, Y0 = -10, M = 72; // metres covered
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const P = (fx, fy) => [((fx - X0) / M) * S, S - ((fy - Y0) / M) * S];
  const m = S / M; // px per metre
  x.clearRect(0, 0, S, S);
  const dirt = x.createPattern((() => { const d = document.createElement('canvas'); d.width = d.height = 128; const dx = d.getContext('2d'); dx.fillStyle = '#c69458'; dx.fillRect(0, 0, 128, 128); for (let i = 0; i < 2600; i++) { dx.fillStyle = Math.random() < 0.5 ? 'rgba(110,70,30,0.16)' : 'rgba(245,205,150,0.14)'; dx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } return d; })(), 'repeat');
  // the dirt: an arc of 29 m around the mound, cut by the foul lines
  x.save();
  x.beginPath(); const [hx, hy] = P(0, 0); x.moveTo(hx, hy);
  const L = P(-36, 36), Rr = P(36, 36); x.lineTo(L[0], L[1]);
  const [mx, my] = P(0, 18.44 - 4.5); x.arc(mx, my, 29 * m, rad(-180 + 0), rad(0), false);
  x.lineTo(Rr[0], Rr[1]); x.closePath(); x.clip();
  x.beginPath(); x.arc(mx, my, 29 * m, 0, Math.PI * 2); x.fillStyle = dirt; x.fill();
  x.restore();
  // the grass inside the diamond
  const g = x.createPattern((() => { const d = document.createElement('canvas'); d.width = d.height = 128; const dx = d.getContext('2d'); dx.fillStyle = '#47a858'; dx.fillRect(0, 0, 128, 64); dx.fillStyle = '#3f9a4e'; dx.fillRect(0, 64, 128, 64); for (let i = 0; i < 1600; i++) { dx.fillStyle = 'rgba(20,60,25,0.12)'; dx.fillRect(Math.random() * 128, Math.random() * 128, 1, 2); } return d; })(), 'repeat');
  const inner = [[0, 3.2], [16.6, 19.4], [0, 36.0], [-16.6, 19.4]].map(([a, b]) => P(a, b));
  x.beginPath(); inner.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath();
  x.fillStyle = g; x.fill();
  // the circles: home, the mound, the base cut-outs
  const circ = (fx, fy, r, fill) => { const [px, py] = P(fx, fy); x.beginPath(); x.arc(px, py, r * m, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); };
  circ(0, 0, 4.0, dirt);
  circ(0, 18.44, 2.75, dirt);
  for (const [bx, by] of [BASES.first, BASES.second, BASES.third]) circ(bx, by, 2.2, dirt);
  // the foul lines and the batter's / catcher's boxes
  x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 0.09 * m; x.lineCap = 'butt';
  const line = (a, b, cc, d) => { const p1 = P(a, b), p2 = P(cc, d); x.beginPath(); x.moveTo(p1[0], p1[1]); x.lineTo(p2[0], p2[1]); x.stroke(); };
  line(0, 0, -36, 36); line(0, 0, 36, 36);
  const box = (cx0, cy0, w, h) => { const [px, py] = P(cx0 - w / 2, cy0 + h / 2); x.strokeRect(px, py, w * m, h * m); };
  box(-0.95, 0, 1.22, 1.83); box(0.95, 0, 1.22, 1.83); box(0, -1.6, 1.1, 1.4);
  // the first-base running lane
  line(13.9 + 0.9, 13.9 - 0.9, 19.4 + 0.9, 19.4 - 0.9);
  // the on-deck circles
  for (const sx of [-1, 1]) { const [px, py] = P(sx * 11, -3); x.beginPath(); x.arc(px, py, 0.8 * m, 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, X0, Y0, M };
}

// a thin white strip on the ground from (x1,y1) to (x2,y2)
function groundStrip(x1, y1, x2, y2, w, color) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({ color }));
  m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2; m.rotation.y = Math.atan2(x2 - x1, y2 - y1) * -1;
  m.position.copy(V((x1 + x2) / 2, (y1 + y2) / 2, 0.026));
  return m;
}
export function buildStadium(scene, o = {}) {
  const G = new THREE.Group();
  scene.add(G);
  const night = !!o.night;
  // ---------------------------------------------------------------- the sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(night), side: THREE.BackSide, depthWrite: false, fog: false }));
  G.add(sky);
  // ---------------------------------------------------------------- the grass (everything inside the stands)
  const grass = new THREE.Mesh(new THREE.CircleGeometry(150, 96), new THREE.MeshLambertMaterial({ map: grassTexture() }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0, -40); grass.receiveShadow = true;
  G.add(grass);
  // the warning track (dirt ring inside the fence)
  {
    const pts = [], idx = [], uv = [];
    for (let i = 0; i <= 90; i++) {
      const d = -45 + i; const r1 = fenceR(d), r0 = r1 - 4.5;
      for (const r of [r0, r1]) { const p = V(Math.sin(rad(d)) * r, Math.cos(rad(d)) * r, 0.012); pts.push(p.x, p.y, p.z); uv.push(i / 9, r === r0 ? 0 : 1); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: dirtTexture(), side: THREE.DoubleSide })); m.receiveShadow = true; G.add(m);
  }
  // ---------------------------------------------------------------- the infield (one painted plane)
  const inf = infieldTexture();
  const ip = new THREE.Mesh(new THREE.PlaneGeometry(inf.M, inf.M), new THREE.MeshLambertMaterial({ map: inf.tex, transparent: true }));
  ip.rotation.x = -Math.PI / 2; ip.position.copy(V(inf.X0 + inf.M / 2, inf.Y0 + inf.M / 2, 0.02)); ip.receiveShadow = true;
  G.add(ip);
  // the foul lines beyond the infield, to the poles
  for (const s of [-1, 1]) G.add(groundStrip(s * 35.5, 35.5, s * 70.6, 70.6, 0.1, 0xffffff));
  // ---------------------------------------------------------------- the mound, the bases, home plate
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.25, 32), new THREE.MeshLambertMaterial({ color: 0xc89660 }));
  mound.position.copy(V(MOUND[0], MOUND[1], 0.12)); mound.receiveShadow = true; G.add(mound);
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(0.61, 0.04, 0.15), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  rubber.position.copy(V(0, 18.44, 0.26)); G.add(rubber);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (const k of ['first', 'second', 'third']) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.38), baseMat); b.position.copy(V(BASES[k][0], BASES[k][1], 0.04)); b.rotation.y = Math.PI / 4; b.castShadow = true; G.add(b); }
  {
    const s = new THREE.Shape(); s.moveTo(-0.216, 0); s.lineTo(0.216, 0); s.lineTo(0.216, -0.216); s.lineTo(0, -0.432); s.lineTo(-0.216, -0.216); s.closePath();
    const hp = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), baseMat);
    hp.rotation.x = -Math.PI / 2; hp.position.copy(V(0, 0.432, 0.03)); hp.rotation.z = Math.PI; G.add(hp);
  }
  // ---------------------------------------------------------------- the fence with the ads, the foul poles
  {
    const pts = [], uv = [], idx = [];
    for (let i = 0; i <= 90; i++) {
      const d = -45 + i, r = fenceR(d);
      for (const h of [0, FENCE_H]) { const p = V(Math.sin(rad(d)) * r, Math.cos(rad(d)) * r, h); pts.push(p.x, p.y, p.z); uv.push(i / 11.25, h ? 1 : 0); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const ads = adsTexture(); ads.wrapS = THREE.RepeatWrapping; ads.repeat.set(1, 1);
    const wall = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ads, side: THREE.DoubleSide, color: night ? 0xd8dcec : 0xffffff }));
    G.add(wall);
    // the padded cap on the fence
    const capPts = [];
    for (let i = 0; i <= 90; i++) { const d = -45 + i, r = fenceR(d); capPts.push(V(Math.sin(rad(d)) * r, Math.cos(rad(d)) * r, FENCE_H + 0.12)); }
    const cap = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(capPts), 90, 0.16, 6, false), new THREE.MeshLambertMaterial({ color: 0xf2c400 }));
    G.add(cap);
    for (const s of [-1, 1]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 26, 10), new THREE.MeshLambertMaterial({ color: 0xffd400, emissive: night ? 0x443300 : 0x000000 })); pole.position.copy(V(s * 70.7, 70.7, 13)); G.add(pole); }
  }
  // ---------------------------------------------------------------- the stands: a bowl from the left-field pole round behind home to the right-field pole
  const standMat = new THREE.MeshLambertMaterial({ map: crowdTexture(o.c1, o.c2, night) });
  {
    const pts = [], uv = [], idx = [];
    const A0 = -150, A1 = 150, NA = 150, NS = 10;
    const inner = (d) => { const a = Math.abs(d); if (a <= 45) return fenceR(d) + 2.5; if (a <= 90) return 100 * Math.cos(rad(a - 45)) * 0 + (100 + 2.5) * (1 - (a - 45) / 45) + 42 * ((a - 45) / 45); return 42 - (a - 90) / 60 * 18; };
    for (let i = 0; i <= NA; i++) {
      const d = A0 + ((A1 - A0) * i) / NA;
      for (let s = 0; s <= NS; s++) {
        const k = s / NS, r = inner(d) + k * 46, h = 2.6 + k * 26 + (d > -45 && d < 45 ? 0 : -2);
        const p = V(Math.sin(rad(d)) * r, Math.cos(rad(d)) * r, h); pts.push(p.x, p.y, p.z); uv.push(i / 12, k);
      }
      if (i) for (let s = 0; s < NS; s++) { const a = (i - 1) * (NS + 1) + s, b = i * (NS + 1) + s; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const stands = new THREE.Mesh(geo, standMat); G.add(stands);
    // the front wall of the stands (green padding), all the way round
    const wallPts = [], wallIdx = [];
    for (let i = 0; i <= NA; i++) { const d = A0 + ((A1 - A0) * i) / NA, r = inner(d); for (const h of [0, 2.7]) { const p = V(Math.sin(rad(d)) * r, Math.cos(rad(d)) * r, h); wallPts.push(p.x, p.y, p.z); } if (i) { const a = (i - 1) * 2; wallIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wallPts, 3)); wg.setIndex(wallIdx); wg.computeVertexNormals();
    G.add(new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: night ? 0x163a26 : 0x1f5a36, side: THREE.DoubleSide })));
    const rimPts = []; for (let i = 0; i <= NA; i++) { const d = A0 + ((A1 - A0) * i) / NA; rimPts.push(V(Math.sin(rad(d)) * (inner(d) + 46), Math.cos(rad(d)) * (inner(d) + 46), 29.4)); }
    G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts), 150, 0.9, 6, false), new THREE.MeshLambertMaterial({ color: 0xdfe4ee })));
  }
  // ---------------------------------------------------------------- the dugouts (dark slots along the lines)
  for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 3), new THREE.MeshLambertMaterial({ color: 0x24303e })); const k = 26; d.position.copy(V(s * (k + 9), k - 9, 1.2)); d.rotation.y = s * Math.PI / 4; G.add(d); }
  // ---------------------------------------------------------------- the scoreboard over center field
  const sb = scoreboardCanvas();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(36, 13.5), new THREE.MeshBasicMaterial({ map: sb.tex }));
  board.position.copy(V(0, 172, 34)); G.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(38, 15.5, 1.2), new THREE.MeshLambertMaterial({ color: 0x1a1e2a })); frame.position.copy(V(0, 172.7, 34)); G.add(frame);
  board.position.z += 0.0; board.renderOrder = 1;
  // ---------------------------------------------------------------- the light towers
  const lamps = [];
  for (const d of [-112, -62, -20, 20, 62, 112]) {
    const r = 168, base = V(Math.sin(rad(d)) * r, Math.cos(rad(d)) * r, 0);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 52, 8), new THREE.MeshLambertMaterial({ color: 0x8a90a0 })); pole.position.set(base.x, 26, base.z); G.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.8), new THREE.MeshBasicMaterial({ color: night ? 0xfff6d0 : 0xd0d4dc })); panel.position.set(base.x, 54, base.z); panel.lookAt(0, 0, -40); G.add(panel);
    lamps.push(panel);
  }
  return { group: G, scoreboard: sb, sky, lamps };
}
