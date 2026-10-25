// 路線図・運賃表 (owner: R9-B1) — the big HD route map (640x360) of the rail network (js/world/eki_net.js).
//
//   openRouteMap(g, { from, mode, title, region }) → Promise<stationId | null>
//     from    the station you are at (fares and routes are counted from it; null = no fares)
//     mode    'buy' (券売機: pick where to go), 'ride' (on the platform), 'browse' (the wall map), 'phone' (乗換案内)
//     region  'tokyo' | 'osaka' (the page shown first; default: the page of `from`)
//   Keys: ←↑→↓ the nearest station that way, A pick (A on the 新幹線 arrow turns the page), B back, MENU the other page.
//   Touch: tap a station (tap it again or the 決定 button to pick), the page tabs, もどる.
//   g.auto (tests): resolves at once with g.auto.ekiPick, else the first station with a 駅前 that is not `from`.

import { SW, SH, fmtMoney, clamp, shade, mix } from '../engine/util.js';
import { text, measure } from '../engine/draw.js';
import { audio } from '../engine/audio.js';
import * as NET from './eki_net.js';

const F = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function disc(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function rrect(c, x, y, w, h, r, col) {
  c.fillStyle = col; c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
  c.closePath(); c.fill();
}
const fit = (c, s, w, size) => { s = String(s); if (measure(c, s, size) <= w) return s; while (s.length > 1 && measure(c, s + '…', size) > w) s = s.slice(0, -1); return s + '…'; };
const T = (c, s, x, y, size, color, align = 'left', o = {}) => text(c, s, x, y, { size, color, align, shadow: null, ...o });

// the 新幹線 arrows (a page turn): one per page
const ARROW = { tokyo: { id: '@osaka', name: '新大阪・大阪へ', mx: 574, my: 148, to: 'osaka', from: 'tokyo' }, osaka: { id: '@tokyo', name: '東京へ', mx: 80, my: 56, to: 'tokyo', from: 'shinosaka' } };
const MAP_Y0 = 40, MAP_Y1 = 290;

let tapCanvas = null;
function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const sc = g.scenes && g.scenes.find((s) => s.isRouteMap && !s.closed);
    if (!sc || g.top !== sc) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    sc.tapAt = { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  }, { passive: true });
}

export function openRouteMap(g, o = {}) {
  const from = o.from && NET.STATIONS[o.from] ? o.from : null;
  if (g.auto) {
    const want = g.auto.ekiPick;
    if (want === null) return Promise.resolve(null);
    if (want && NET.STATIONS[want]) return Promise.resolve(want);
    const reg = from ? NET.STATIONS[from].region : 'tokyo';
    const pick = Object.keys(NET.STATIONS).find((id) => id !== from && NET.enterable(id) && NET.STATIONS[id].region === reg && NET.stationOpen(id, NET.ymOf(g)));
    return Promise.resolve(pick || null);
  }
  bindTap(g);
  return new Promise((resolve) => {
    const sc = new RouteMapScene(g, { ...o, from }, resolve);
    g.push(sc);
  });
}

class RouteMapScene {
  constructor(g, o, resolve) {
    Object.assign(this, { g, o, resolve, hd: true, opaque: true, hidesHud: true, isRouteMap: true, t: 0, tapAt: null, closed: false });
    this.ym = NET.ymOf(g);
    this.region = o.region || (o.from ? NET.STATIONS[o.from].region : 'tokyo');
    this.routes = {};
    const first = this.nodes().find((n) => n.id !== o.from && NET.enterable(n.id)) || this.nodes()[0];
    this.sel = o.sel && NET.STATIONS[o.sel] ? o.sel : first ? first.id : null;
    if (this.sel && NET.STATIONS[this.sel] && NET.STATIONS[this.sel].region !== this.region) this.region = NET.STATIONS[this.sel].region;
    this.btns = {};
  }
  // the selectable points of the page: open stations + the 新幹線 arrow
  nodes() {
    const out = [];
    for (const [id, s] of Object.entries(NET.STATIONS)) if (s.region === this.region && NET.stationOpen(id, this.ym)) out.push({ id, ...s });
    out.push({ ...ARROW[this.region], arrow: true });
    return out;
  }
  routeTo(id) {
    if (!this.o.from || id === this.o.from || !NET.STATIONS[id]) return null;
    if (!(id in this.routes)) { try { this.routes[id] = NET.route(this.g, this.o.from, id); } catch (e) { console.error(e); this.routes[id] = null; } }
    return this.routes[id];
  }
  close(v) {
    if (this.closed) return;
    this.closed = true;
    this.g.pop(this);
    this.resolve(v);
  }
  canPick(id) {
    if (!id || id[0] === '@') return true;
    if (this.o.mode === 'browse') return NET.enterable(id) && id !== this.o.from;
    if (!NET.enterable(id) || id === this.o.from) return false;
    return !this.o.from || !!this.routeTo(id);
  }
  pick() {
    const id = this.sel;
    if (!id) return;
    if (id[0] === '@') { this.turn(ARROW[this.region].to); return; }
    if (!this.canPick(id)) { audio.sfx('buzz'); this.flash = 30; return; }
    audio.sfx('ok');
    this.close(id);
  }
  turn(region) {
    this.region = region;
    const back = ARROW[region === 'tokyo' ? 'osaka' : 'tokyo'];
    // land on the 新幹線 station of the new page
    this.sel = region === 'osaka' ? 'shinosaka' : 'tokyo';
    if (!back) this.sel = this.nodes()[0].id;
    audio.sfx('cursor');
  }
  move(dir) {
    const ns = this.nodes();
    const cur = ns.find((n) => n.id === this.sel) || ns[0];
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    let best = null, bs = Infinity;
    for (const n of ns) {
      if (n.id === cur.id) continue;
      const vx = n.mx - cur.mx, vy = n.my - cur.my;
      const along = vx * dx + vy * dy;
      if (along <= 2) continue;
      const side = Math.abs(vx * dy - vy * dx);
      if (side > along * 1.8) continue;
      const s = along + side * 2.2;
      if (s < bs) { bs = s; best = n; }
    }
    if (best) { this.sel = best.id; audio.sfx('cursor'); }
  }
  update(g) {
    this.t++;
    if (this.flash) this.flash--;
    const tap = this.tapAt;
    this.tapAt = null;
    if (this.t < 3) return;
    const inp = g.input;
    if (tap) { this.onTap(tap); return; }
    if (inp.pressed('b')) { audio.sfx('cancel'); this.close(null); return; }
    if (inp.pressed('menu')) { this.turn(this.region === 'tokyo' ? 'osaka' : 'tokyo'); return; }
    if (inp.pressed('a')) { this.pick(); return; }
    for (const d of ['up', 'down', 'left', 'right']) if (inp.repeat(d)) { this.move(d); return; }
  }
  onTap(p) {
    const inR = (r) => r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    if (inR(this.btns.back)) { audio.sfx('cancel'); this.close(null); return; }
    if (inR(this.btns.go)) { this.pick(); return; }
    if (inR(this.btns.tokyo)) { if (this.region !== 'tokyo') this.turn('tokyo'); return; }
    if (inR(this.btns.osaka)) { if (this.region !== 'osaka') this.turn('osaka'); return; }
    let best = null, bd = 22 * 22;
    for (const n of this.nodes()) {
      const d = (n.mx - p.x) ** 2 + (n.my - p.y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    if (!best) return;
    if (best.id === this.sel) { this.pick(); return; }
    this.sel = best.id;
    audio.sfx('cursor');
  }

  // ------------------------------------------------------------ drawing
  draw(c) {
    const g = this.g;
    const reg = this.region;
    // paper
    F(c, 0, 0, SW, SH, '#eef1f4');
    for (let x = 0; x < SW; x += 20) F(c, x, MAP_Y0, 1, MAP_Y1 - MAP_Y0, '#e4e8ee');
    for (let y = MAP_Y0; y < MAP_Y1; y += 20) F(c, 0, y, SW, 1, '#e4e8ee');
    // water: 東京湾 / 大阪湾 and the rivers, very light
    c.globalAlpha = 0.5;
    if (reg === 'tokyo') { F(c, 520, 250, 120, 40, '#cfe3f4'); for (let i = 0; i < 12; i++) F(c, 548 + i * 4, 90 + i * 12, 6, 14, '#d6e8f6'); }
    else { F(c, 0, 160, 150, 130, '#cfe3f4'); for (let i = 0; i < 20; i++) F(c, 150 + i * 6, 120 + Math.round(Math.sin(i / 3) * 6), 8, 5, '#d6e8f6'); }
    c.globalAlpha = 1;
    this.drawLines(c);
    this.drawStations(c);
    this.drawLegend(c);
    this.drawHeader(c);
    this.drawPanel(c);
  }
  drawHeader(c) {
    const g = this.g;
    F(c, 0, 0, SW, 36, '#1d2a4a'); F(c, 0, 36, SW, 3, '#f0c020');
    const title = this.o.title || (this.o.mode === 'buy' ? 'きっぷうりば　路線図・運賃表' : this.o.mode === 'phone' ? '路線図から駅をえらぶ' : '路線図・運賃表');
    T(c, title, 12, 8, 16, '#ffffff');
    if (this.o.from) T(c, `いま：${NET.stLabel(this.o.from)}`, 12 + measure(c, title, 16) + 14, 11, 12, '#ffe48a');
    // page tabs
    const tabs = [['tokyo', '東京'], ['osaka', '大阪']];
    let x = SW - 132;
    for (const [id, label] of tabs) {
      const on = this.region === id;
      rrect(c, x, 6, 58, 24, 5, on ? '#f0c020' : '#33456e');
      T(c, label, x + 29, 11, 14, on ? '#1d2a4a' : '#c8d2ea', 'center');
      this.btns[id] = { x, y: 4, w: 58, h: 28 };
      x += 64;
    }
  }
  segPts(lineId) {
    const st = NET.stopsOf(lineId, this.ym);
    const pts = st.map(([id]) => ({ id, ...NET.STATIONS[id] })).filter((p) => p.region === this.region);
    if (lineId === 'shinkansen') {
      const A = ARROW[this.region];
      const s = NET.STATIONS[A.from];
      return [{ id: A.from, mx: s.mx, my: s.my }, { id: A.id, mx: A.mx, my: A.my }];
    }
    if (NET.LINES[lineId].loop && pts.length > 2) pts.push(pts[0]);
    return pts;
  }
  drawLines(c) {
    const used = new Map();
    for (const id of NET.LINE_ORDER) {
      const L = NET.LINES[id];
      if (L.region !== this.region && L.region !== 'both') continue;
      if (!NET.lineOpen(id, this.ym)) continue;
      const pts = this.segPts(id);
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        const key = [a.id, b.id].sort().join('-');
        const k = used.get(key) || 0;
        used.set(key, k + 1);
        const len = Math.hypot(b.mx - a.mx, b.my - a.my) || 1;
        const off = k * 7;
        const ox = (-(b.my - a.my) / len) * off, oy = ((b.mx - a.mx) / len) * off;
        c.lineCap = 'round';
        c.strokeStyle = shade(L.color, -0.35); c.lineWidth = 8;
        c.beginPath(); c.moveTo(a.mx + ox, a.my + oy); c.lineTo(b.mx + ox, b.my + oy); c.stroke();
        c.strokeStyle = L.color; c.lineWidth = 6;
        if (id === 'shinkansen') c.setLineDash([10, 6]);
        c.beginPath(); c.moveTo(a.mx + ox, a.my + oy); c.lineTo(b.mx + ox, b.my + oy); c.stroke();
        c.setLineDash([]);
      }
    }
  }
  drawStations(c) {
    const sel = this.sel;
    for (const n of this.nodes()) {
      const on = n.id === sel;
      if (n.arrow) {
        const pulse = on ? 2 + (Math.floor(this.t / 8) % 2) : 0;
        const label = `新幹線 ${n.name}`;
        const w = measure(c, label, 12) + 16;
        const bx = clamp(n.mx - w / 2, 4, SW - w - 4);
        rrect(c, bx - pulse, n.my - 13 - pulse, w + pulse * 2, 26 + pulse * 2, 6, on ? '#f0c020' : '#2a5ad0');
        T(c, label, bx + w / 2, n.my - 7, 12, on ? '#1d2a4a' : '#ffffff', 'center');
        continue;
      }
      const lines = NET.linesAt(n.id, this.ym).filter((l) => l !== 'shinkansen' || true);
      const xfer = lines.length > 1;
      const here = n.id === this.o.from;
      const can = NET.enterable(n.id);
      if (on) { c.globalAlpha = 0.35; disc(c, n.mx, n.my, 14 + (Math.floor(this.t / 6) % 3), '#f0c020'); c.globalAlpha = 1; }
      disc(c, n.mx, n.my, xfer ? 8 : 6, '#20232a');
      disc(c, n.mx, n.my, xfer ? 6 : 4, here ? '#ff5d6c' : can ? '#ffffff' : '#c8ccd4');
      if (xfer) disc(c, n.mx, n.my, 2, '#20232a');
      // name (+ the fare from here, as on a real 運賃表)
      const size = n.big ? 13 : 12;
      const r = this.routeTo(n.id);
      const fare = r ? fmtMoney(r.fare) : '';
      const nameW = measure(c, n.name, size);
      const fareW = fare ? measure(c, fare, 10) + 8 : 0;
      const w = nameW + (fare ? fareW + 3 : 0);
      let x, y;
      if (n.lab === 'l') { x = n.mx - 11 - w; y = n.my - 8; }
      else if (n.lab === 'r') { x = n.mx + 11; y = n.my - 8; }
      else if (n.lab === 't') { x = n.mx - w / 2; y = n.my - 26; }
      else { x = n.mx - w / 2; y = n.my + 10; }
      x = clamp(x, 2, SW - w - 2);
      F(c, x - 2, y - 1, w + 4, size + 4, on ? '#fff3b0' : 'rgba(238,241,244,0.85)');
      T(c, n.name, x, y, size, can ? '#1d2230' : '#6a707c');
      if (fare) {
        const fx = x + nameW + 3;
        F(c, fx, y + 1, fareW, 13, '#20232a');
        T(c, fare, fx + 4, y + 2, 10, '#ffffff');
      }
    }
  }
  drawLegend(c) {
    const ls = NET.LINE_ORDER.filter((id) => (NET.LINES[id].region === this.region) && NET.lineOpen(id, this.ym));
    const x = this.region === 'tokyo' ? 8 : 470, y0 = this.region === 'tokyo' ? 46 : 46;
    const h = 8 + ls.length * 15;
    F(c, x, y0, 156, h, 'rgba(255,255,255,0.92)'); F(c, x, y0, 156, 1, '#c8ccd4'); F(c, x, y0 + h - 1, 156, 1, '#c8ccd4');
    ls.forEach((id, i) => {
      const L = NET.LINES[id];
      F(c, x + 6, y0 + 9 + i * 15, 18, 5, L.color);
      T(c, fit(c, L.name, 124, 11), x + 28, y0 + 4 + i * 15, 11, '#2a2f3a');
    });
  }
  drawPanel(c) {
    const g = this.g;
    const y = MAP_Y1 + 2;
    F(c, 0, y, SW, SH - y, '#1d2a4a'); F(c, 0, y, SW, 2, '#f0c020');
    const id = this.sel;
    const btnW = 96;
    const goLabel = this.o.mode === 'buy' ? 'きっぷを買う' : this.o.mode === 'ride' ? 'この駅へ' : this.o.mode === 'phone' ? '経路を見る' : '行き先にする';
    // buttons (≥ 70 units tall on the phone's scale is not needed here: 64 px high touch areas)
    const by = y + 8;
    this.btns.back = { x: SW - btnW - 8, y: by, w: btnW, h: SH - by - 6 };
    this.btns.go = { x: SW - btnW * 2 - 16, y: by, w: btnW, h: SH - by - 6 };
    const can = this.canPick(id);
    rrect(c, this.btns.back.x, by, btnW, SH - by - 6, 6, '#3a4a6e');
    T(c, 'もどる', this.btns.back.x + btnW / 2, by + (SH - by - 6) / 2 - 7, 14, '#ffffff', 'center');
    const goTxt = id && id[0] === '@' ? 'ページを開く' : goLabel;
    rrect(c, this.btns.go.x, by, btnW, SH - by - 6, 6, can ? (this.flash ? '#ff7a6a' : '#f0c020') : '#5a6478');
    T(c, fit(c, goTxt, btnW - 8, 13), this.btns.go.x + btnW / 2, by + (SH - by - 6) / 2 - 7, 13, can ? '#1d2a4a' : '#aab2c4', 'center');
    const tw = this.btns.go.x - 20;
    if (!id) return;
    if (id[0] === '@') {
      const A = ARROW[this.region];
      T(c, A.name, 14, y + 8, 18, '#ffffff');
      T(c, fit(c, `新幹線で${A.to === 'osaka' ? '新大阪（大阪）' : '東京'}へ。A でそのページを開く（MENU でも切りかえ）`, tw, 12), 14, y + 36, 12, '#c8d2ea');
      return;
    }
    const s = NET.STATIONS[id];
    T(c, s.name + (s.jr ? `（${s.jr}）` : ''), 14, y + 6, 18, '#ffffff');
    // line chips
    let cx = 14 + measure(c, s.name + (s.jr ? `（${s.jr}）` : ''), 18) + 10;
    for (const l of NET.linesAt(id, this.ym)) {
      const L = NET.LINES[l];
      const w = measure(c, L.short, 10) + 10;
      if (cx + w > tw) break;
      rrect(c, cx, y + 10, w, 15, 4, L.color);
      T(c, L.short, cx + 5, y + 11, 10, '#ffffff');
      cx += w + 4;
    }
    let line2 = '', line3 = '';
    let col2 = '#c8d2ea';
    if (!NET.enterable(id)) { line2 = '通過のみ（この駅の駅前は、まだ歩けない）'; col2 = '#9aa6c0'; }
    else if (id === this.o.from) line2 = 'いま、この駅にいる';
    else if (this.o.from) {
      const r = this.routeTo(id);
      if (!r) line2 = 'ここからは行けない';
      else {
        line2 = `${NET.hm(r.min)}・${fmtMoney(r.fare)}${r.transfers ? `・乗換${r.transfers}回` : '・乗換なし'}${r.delay ? `・${r.delayWhy}（+${r.delay}分）` : ''}`;
        line3 = r.text;
        if (!r.service.ok) { line2 = r.service.why; col2 = '#ff9a8a'; }
        col2 = r.service.ok ? '#ffe48a' : '#ff9a8a';
      }
    } else line2 = '駅前を歩ける駅';
    T(c, fit(c, line2, tw, 13), 14, y + 30, 13, col2);
    if (line3) T(c, fit(c, line3, tw, 11), 14, y + 48, 11, '#c8d2ea');
  }
}
