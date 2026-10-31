// スーパープロ野球ロード 3D — the player model: an original chibi design built from simple shapes (a big round head with a cap
// or a helmet, round eyes, a short body in the club's uniform with the number on the back, jointed arms and legs, a bat or a
// glove), toon-shaded with an outline. Poses are set procedurally on the joints:
//   stand, idle, stance (batting), swing (t), windup (t), run (t), ready (fielder), catch, throw (t), crouch (catcher), slide
// The model faces its local +z; place it with setPos(x, y) (field metres) and face(x, y) / yaw.
import * as THREE from '../vendor/three.module.min.js';
import { V } from './stadium.js';
import { markTexture, jerseyTexture } from './textures.js';

const grad = (() => { const d = new Uint8Array([90, 170, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...o });
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1a1620, side: THREE.BackSide });
const cache = new Map();
const matCache = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
function outlined(geo, mat, k = 1.06) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m);
  const o = new THREE.Mesh(geo, OUTLINE); o.scale.setScalar(k); g.add(o);
  return g;
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const SKINS = [0xf6d2b0, 0xf1c39d, 0xe8b48a, 0xf8dcc0];

export class Player3D {
  // look = { c1, c2, mark, num, away, skin?, hair?, helmet?, lefty?, catcher?, ump? }
  constructor(look = {}) {
    this.look = look;
    const L = look, c1 = new THREE.Color(L.c1 || '#1b3c8f'), c2 = new THREE.Color(L.c2 || '#ffffff');
    const skin = L.skin != null ? L.skin : SKINS[(L.num || 0) % SKINS.length];
    const uniCol = L.ump ? 0x2a2e3a : L.away ? 0xc8cdd8 : 0xf6f6fa;
    const M = {
      skin: matCache(`s${skin}`, () => toon(skin)),
      uni: matCache(`u${uniCol}`, () => toon(uniCol)),
      c1: matCache(`c${L.c1}`, () => toon(c1)),
      c2: matCache(`c2${L.c2}`, () => toon(c2)),
      dark: matCache('dark', () => toon(0x24222c)),
      eye: matCache('eye', () => new THREE.MeshBasicMaterial({ color: 0x18161e })),
      white: matCache('white', () => new THREE.MeshBasicMaterial({ color: 0xffffff })),
      glove: matCache('glove', () => toon(0x9a5a26)),
      bat: matCache('bat', () => toon(0xd2a466)),
      hair: matCache(`h${L.hair || 0x2a1e18}`, () => toon(L.hair || 0x2a1e18)),
      helmet: matCache(`hm${L.c1}`, () => new THREE.MeshPhongMaterial({ color: c1, shininess: 80, specular: 0x666666 })),
    };
    this.M = M;
    const root = this.root = new THREE.Group();
    const body = this.body = new THREE.Group(); // pelvis: everything above the hips
    body.position.y = 0.6;
    root.add(body);
    // legs
    const mkLeg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.1, 0, 0); body.add(hip);
      const thigh = outlined(new THREE.CylinderGeometry(0.085, 0.075, 0.3, 10), L.ump ? M.dark : M.uni, 1.08); thigh.position.y = -0.15; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.3; hip.add(knee);
      const shin = outlined(new THREE.CylinderGeometry(0.072, 0.064, 0.24, 10), L.ump ? M.dark : M.c1, 1.08); shin.position.y = -0.12; knee.add(shin);
      const shoe = outlined(new THREE.BoxGeometry(0.13, 0.08, 0.22), M.dark, 1.08); shoe.position.set(0, -0.27, 0.04); knee.add(shoe);
      return { hip, knee };
    };
    this.legL = mkLeg(-1); this.legR = mkLeg(1);
    // torso
    const torso = this.torso = new THREE.Group(); body.add(torso);
    const jt = matCache(`j${L.num}${L.c1}${L.away}${L.mark}`, () => toon(L.ump ? 0x2a2e3a : 0xffffff, { map: L.ump ? null : jerseyTexture(L.num || 0, L.c1 || '#1b3c8f', L.away, L.mark || '') }));
    const chestGeo = new THREE.CylinderGeometry(0.19, 0.22, 0.46, 16, 1);
    const chest = outlined(chestGeo, jt, 1.05); chest.position.y = 0.25; chest.rotation.y = Math.PI / 2; torso.add(chest);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.222, 0.222, 0.05, 16), M.c1); belt.position.y = 0.03; torso.add(belt);
    // head
    const neck = this.neck = new THREE.Group(); neck.position.y = 0.5; torso.add(neck);
    const head = this.head = new THREE.Group(); head.position.y = 0.3; neck.add(head);
    head.add(outlined(new THREE.SphereGeometry(0.33, 24, 18), M.skin, 1.04));
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.335, 20, 14, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4), M.hair); back.rotation.y = Math.PI; back.position.z = -0.01; head.add(back);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), M.eye); eye.scale.set(0.8, 1.25, 0.45); eye.position.set(sx * 0.12, 0.0, 0.3); head.add(eye);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), M.white); hl.position.set(sx * 0.12 + 0.015, 0.03, 0.325); head.add(hl);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M.skin); ear.position.set(sx * 0.32, -0.02, 0); head.add(ear);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), matCache('blush', () => new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.45 }))); blush.position.set(sx * 0.2, -0.09, 0.282); blush.rotation.y = sx * 0.5; head.add(blush);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), M.eye); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.11, 0.315); head.add(mouth);
    // cap / helmet
    this.cap = new THREE.Group(); head.add(this.cap);
    this.helmetG = new THREE.Group(); head.add(this.helmetG);
    {
      const dome = outlined(new THREE.SphereGeometry(0.345, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), M.c1, 1.03); dome.position.y = 0.04; this.cap.add(dome);
      const brim = outlined(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), M.c1, 1.06); brim.position.set(0, 0.05, 0.3); brim.scale.set(1.2, 1, 1); this.cap.add(brim);
      const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), matCache(`mk${L.mark}${L.c2}`, () => new THREE.MeshBasicMaterial({ map: markTexture(L.mark || '', L.c2 || '#ffffff'), transparent: true }))); mk.position.set(0, 0.2, 0.3); mk.rotation.x = -0.45; this.cap.add(mk);
      const hel = new THREE.Mesh(new THREE.SphereGeometry(0.37, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), M.helmet); hel.position.y = 0.02; this.helmetG.add(hel);
      const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16, 1, false, -Math.PI / 2, Math.PI), M.helmet); hb.position.set(0, 0.0, 0.32); this.helmetG.add(hb);
      const flap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), M.helmet); flap.scale.set(0.5, 1, 1); flap.position.set(L.lefty ? 0.33 : -0.33, -0.06, 0.02); this.helmetG.add(flap);
      const hmk = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), matCache(`mk${L.mark}${L.c2}`, () => null) || new THREE.MeshBasicMaterial({ map: markTexture(L.mark || '', L.c2 || '#ffffff'), transparent: true })); hmk.position.set(0, 0.22, 0.31); hmk.rotation.x = -0.5; this.helmetG.add(hmk);
    }
    this.setHelmet(!!L.helmet);
    // arms: shoulder → elbow → hand
    const mkArm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.24, 0.42, 0); torso.add(sh);
      const up = outlined(new THREE.CylinderGeometry(0.06, 0.055, 0.22, 8), L.ump ? M.dark : M.uni, 1.1); up.position.y = -0.11; sh.add(up);
      const el = new THREE.Group(); el.position.y = -0.22; sh.add(el);
      const fo = outlined(new THREE.CylinderGeometry(0.052, 0.048, 0.2, 8), M.skin, 1.1); fo.position.y = -0.1; el.add(fo);
      const hand = new THREE.Group(); hand.position.y = -0.22; el.add(hand);
      hand.add(new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), M.skin));
      return { sh, el, hand };
    };
    this.armL = mkArm(-1); this.armR = mkArm(1);
    // the glove (on the non-throwing hand) and the bat
    this.glove = outlined(new THREE.SphereGeometry(0.11, 12, 10), M.glove, 1.06); this.glove.scale.set(1, 1.15, 0.6);
    this.bat = new THREE.Group();
    const bt = outlined(new THREE.CylinderGeometry(0.034, 0.016, 0.86, 10), M.bat, 1.08); bt.position.y = 0.36; this.bat.add(bt);
    this.setGear(L.gear || 'glove');
    this.yaw = 0;
    this.pose('stand', 0);
  }
  setHelmet(on) { this.cap.visible = !on; this.helmetG.visible = !!on; }
  // gear: 'glove' | 'bat' | 'none'; a lefty wears the glove on the right
  setGear(g) {
    this.glove.removeFromParent(); this.bat.removeFromParent();
    const lefty = !!this.look.lefty;
    if (g === 'glove') (lefty ? this.armR : this.armL).hand.add(this.glove);
    if (g === 'bat') (lefty ? this.armL : this.armR).hand.add(this.bat);
    this.gear = g;
  }
  setPos(x, y, h = 0) { this.root.position.copy(V(x, y, h)); }
  face(x, y) { const p = this.root.position, t = V(x, y, 0); this.yaw = Math.atan2(t.x - p.x, t.z - p.z); this.root.rotation.y = this.yaw; }
  setYaw(a) { this.yaw = a; this.root.rotation.y = a; }
  // ---------------------------------------------------------------- poses
  reset() {
    for (const j of [this.body, this.torso, this.neck, this.head, this.legL.hip, this.legL.knee, this.legR.hip, this.legR.knee, this.armL.sh, this.armL.el, this.armR.sh, this.armR.el, this.armL.hand, this.armR.hand]) j.rotation.set(0, 0, 0);
    this.body.position.set(0, 0.6, 0);
    this.bat.rotation.set(0, 0, 0); this.bat.position.set(0, 0, 0);
  }
  pose(name, t = 0) {
    this.reset();
    const P = this, s = this.look.lefty ? -1 : 1; // mirror for the left-handed
    const A = (arm, shx, shz, elx = 0) => { arm.sh.rotation.x = shx; arm.sh.rotation.z = shz; arm.el.rotation.x = elx; };
    switch (name) {
      case 'idle': { const b = Math.sin(t * 2.5) * 0.02; P.torso.rotation.x = b; A(P.armL, 0.1, -0.15, -0.2); A(P.armR, 0.1, 0.15, -0.2); break; }
      case 'stand': A(P.armL, 0.05, -0.12, -0.15); A(P.armR, 0.05, 0.12, -0.15); break;
      case 'stance': {
        // feet apart, knees bent, the bat up behind the back shoulder
        P.body.position.y = 0.55;
        P.legL.hip.rotation.z = 0.28; P.legR.hip.rotation.z = -0.28; P.legL.knee.rotation.x = 0.3; P.legR.knee.rotation.x = 0.3; P.legL.hip.rotation.x = -0.25; P.legR.hip.rotation.x = -0.25;
        P.torso.rotation.y = -0.5 * s; P.torso.rotation.x = 0.12;
        P.head.rotation.y = 0.95 * s; // looking at the pitcher
        const wig = Math.sin(t * 3) * 0.06;
        A(P.armR, -2.0 - wig, 0.5 * s, -1.3); A(P.armL, -1.7 - wig, -0.2 * s, -1.2);
        P.bat.rotation.set(-0.6, 0, 0.5 * s);
        break;
      }
      case 'swing': {
        const k = clamp(t, 0, 1), e = ease(k);
        P.body.position.y = 0.55;
        P.legL.hip.rotation.z = lerp(0.28, 0.42, e); P.legR.hip.rotation.z = -0.28; P.legL.knee.rotation.x = 0.25; P.legR.knee.rotation.x = lerp(0.3, 0.6, e);
        P.torso.rotation.y = lerp(-0.5, 1.6, e) * s; P.torso.rotation.x = 0.15;
        P.head.rotation.y = lerp(0.95, -0.4, e) * s;
        A(P.armR, lerp(-2.0, -1.4, e), lerp(0.5, 1.2, e) * s, lerp(-1.3, -0.2, e));
        A(P.armL, lerp(-1.7, -1.5, e), lerp(-0.2, 0.9, e) * s, lerp(-1.2, -0.1, e));
        P.bat.rotation.set(lerp(-0.6, -1.5, e), 0, lerp(0.5, 1.4, e) * s);
        break;
      }
      case 'windup': {
        // set → leg lift → stride and release → follow through (the throwing arm is the right for a right-hander)
        const k = clamp(t, 0, 1);
        const T = s === 1 ? P.armR : P.armL, G = s === 1 ? P.armL : P.armR, lift = s === 1 ? P.legL : P.legR, plant = s === 1 ? P.legR : P.legL;
        if (k < 0.4) { const q = ease(k / 0.4); lift.hip.rotation.x = -1.5 * q; lift.knee.rotation.x = 1.6 * q; P.torso.rotation.y = 0.9 * q * s; A(T, -0.5 * q, 0.3 * q * s, -1.0 * q); A(G, -1.2 * q, -0.3 * q * s, -1.0 * q); }
        else if (k < 0.7) { const q = ease((k - 0.4) / 0.3); lift.hip.rotation.x = lerp(-1.5, -0.5, q); lift.knee.rotation.x = lerp(1.6, 0.4, q); plant.knee.rotation.x = 0.4 * q; P.torso.rotation.y = lerp(0.9, 0.2, q) * s; A(T, lerp(-0.5, -2.8, q), lerp(0.3, 0.9, q) * s, lerp(-1, -1.6, q)); A(G, lerp(-1.2, -1.6, q), -0.5 * s, -0.8); P.body.position.y = 0.6 - 0.08 * q; }
        else { const q = ease((k - 0.7) / 0.3); lift.hip.rotation.x = lerp(-0.5, -0.9, q); lift.knee.rotation.x = 0.5; plant.hip.rotation.x = lerp(0, 0.6, q); plant.knee.rotation.x = lerp(0.4, 1.0, q); P.torso.rotation.y = lerp(0.2, -0.6, q) * s; P.torso.rotation.x = lerp(0, 0.6, q); A(T, lerp(-2.8, -0.2, q), lerp(0.9, -0.2, q) * s, lerp(-1.6, -0.1, q)); A(G, -0.6, -0.4 * s, -1.2); P.body.position.y = 0.52; }
        break;
      }
      case 'run': {
        const ph = t * Math.PI * 2, a = Math.sin(ph);
        P.legL.hip.rotation.x = a * 0.9; P.legR.hip.rotation.x = -a * 0.9;
        P.legL.knee.rotation.x = Math.max(0, -a) * 1.3 + 0.2; P.legR.knee.rotation.x = Math.max(0, a) * 1.3 + 0.2;
        A(P.armL, -a * 0.9, -0.15, -1.3); A(P.armR, a * 0.9, 0.15, -1.3);
        P.torso.rotation.x = 0.25; P.body.position.y = 0.6 + Math.abs(Math.cos(ph)) * 0.05;
        break;
      }
      case 'ready': {
        P.body.position.y = 0.48; P.legL.hip.rotation.set(-0.5, 0, 0.25); P.legR.hip.rotation.set(-0.5, 0, -0.25); P.legL.knee.rotation.x = 0.8; P.legR.knee.rotation.x = 0.8;
        P.torso.rotation.x = 0.45; P.head.rotation.x = -0.4;
        A(P.armL, -0.9, -0.2, -0.4); A(P.armR, -0.9, 0.2, -0.4);
        break;
      }
      case 'catch': { A(s === 1 ? P.armL : P.armR, -2.6, -0.2 * s, -0.2); A(s === 1 ? P.armR : P.armL, -1.2, 0.2 * s, -0.8); P.head.rotation.x = -0.5; break; }
      case 'throw': {
        const k = clamp(t, 0, 1), e = ease(k);
        const T = s === 1 ? P.armR : P.armL, G = s === 1 ? P.armL : P.armR;
        P.torso.rotation.y = lerp(0.8, -0.5, e) * s; P.torso.rotation.x = lerp(0, 0.4, e);
        A(T, lerp(-2.6, -0.3, e), lerp(0.8, 0, e) * s, lerp(-1.4, -0.1, e)); A(G, -1.0, -0.4 * s, -0.8);
        (s === 1 ? P.legL : P.legR).hip.rotation.x = lerp(-0.5, -0.2, e);
        break;
      }
      case 'crouch': {
        P.body.position.y = 0.32; P.legL.hip.rotation.set(-1.4, 0, 0.45); P.legR.hip.rotation.set(-1.4, 0, -0.45); P.legL.knee.rotation.x = 2.1; P.legR.knee.rotation.x = 2.1;
        P.torso.rotation.x = 0.25; A(P.armL, -1.3, -0.3, -0.5); A(P.armR, -0.3, 0.3, -1.2);
        break;
      }
      case 'slide': { P.body.position.y = 0.25; P.body.rotation.x = -1.1; P.legL.hip.rotation.x = -1.2; P.legR.hip.rotation.x = -0.6; P.legR.knee.rotation.x = 1.0; A(P.armL, -2.6, -0.4, 0); A(P.armR, -2.6, 0.4, 0); break; }
      case 'cheer': { const b = Math.abs(Math.sin(t * 8)) * 0.1; P.body.position.y = 0.6 + b; A(P.armL, -2.9, -0.3, -0.2); A(P.armR, -2.9, 0.3, -0.2); break; }
      default: break;
    }
    this.cur = name;
  }
}
// the hand that holds the ball / the bat tip in world space (for attaching the ball)
export function handWorld(p, right = true) { const v = new THREE.Vector3(); (right ? p.armR : p.armL).hand.getWorldPosition(v); return v; }
