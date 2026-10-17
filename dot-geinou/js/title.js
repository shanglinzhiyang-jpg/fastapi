// Title screen and character creation.

import { W, H } from './engine/util.js';
import { text, panel, cursor, COLORS, measure } from './engine/draw.js';
import { charSheet, drawChar, HAIR, HAIR_STYLES, SKIN } from './engine/sprites.js';
import { audio } from './engine/audio.js';
import { drawLogo } from './engine/logos.js';
import { hasSave } from './engine/state.js';

const LOGO_PARADE = ['yoshimoto', 'shinkigeki', 'bs_yoshimoto', 'shochiku', 'grape', 'nhk', 'toei', 'horipro', 'toho'];

function skyline(ctx, t) {
  for (let y = 0; y < H; y += 4) {
    const k = y / H;
    const r = Math.round(12 + k * 40), gg = Math.round(14 + k * 20), b = Math.round(40 + k * 50);
    ctx.fillStyle = `rgb(${r},${gg},${b})`;
    ctx.fillRect(0, y, W, 4);
  }
  for (let i = 0; i < 50; i++) {
    const x = (i * 137) % W, y = (i * 71) % 110;
    if ((i + Math.floor(t / 20)) % 7 === 0) continue;
    ctx.fillStyle = i % 6 ? '#8a94c8' : '#fff6a8';
    ctx.fillRect(x, y, 1, 1);
  }
  // searchlights
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#fff6a8';
  for (const [bx, sp, ph] of [[70, 0.012, 0], [250, 0.015, 2]]) {
    const a = Math.sin(t * sp + ph) * 0.5 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(bx, 200);
    ctx.lineTo(bx + Math.cos(a - 0.08) * 300, 200 + Math.sin(a - 0.08) * 300);
    ctx.lineTo(bx + Math.cos(a + 0.08) * 300, 200 + Math.sin(a + 0.08) * 300);
    ctx.fill();
  }
  ctx.restore();
  // buildings
  const blds = [[0, 150, 30], [28, 130, 24], [50, 160, 40], [88, 120, 22], [108, 145, 36], [142, 110, 28], [168, 140, 30], [196, 125, 26], [220, 150, 34], [252, 115, 24], [274, 138, 46]];
  for (const [x, y, w] of blds) {
    ctx.fillStyle = '#141833';
    ctx.fillRect(x, y, w, H - y);
    for (let wy = y + 6; wy < H - 10; wy += 8) {
      for (let wx = x + 4; wx < x + w - 4; wx += 6) {
        if (((wx * 7 + wy * 13) >> 3) % 3 === 0) { ctx.fillStyle = '#ffe9a0'; ctx.fillRect(wx, wy, 2, 3); }
      }
    }
  }
}

export class TitleScene {
  constructor(g, resolve) {
    this.g = g;
    this.resolve = resolve;
    this.t = 0;
    this.idx = hasSave() ? 1 : 0;
    this.opaque = true;
    audio.bgm('title'); // only remembered until the first tap/key unlocks audio
  }
  items() { return ['はじめから', 'つづきから']; }
  update(g) {
    this.t++;
    const inp = g.input;
    if (inp.repeat('up') || inp.repeat('down')) { this.idx = 1 - this.idx; audio.sfx('cursor'); }
    if (inp.pressed('a') && this.t > 20) {
      if (this.idx === 1 && !hasSave()) { audio.sfx('buzz'); return; }
      audio.unlock();
      audio.sfx('ok');
      g.pop(this);
      this.resolve(this.idx === 0 ? 'new' : 'continue');
    }
  }
  draw(ctx, g) {
    skyline(ctx, this.t);
    const bob = Math.round(Math.sin(this.t / 20) * 2);
    text(ctx, 'ドット芸能界', W / 2, 34 + bob, { size: 32, align: 'center', color: COLORS.accent, outline: '#3a1030' });
    text(ctx, '〜 めざせ！国民的スター 〜', W / 2, 74, { size: 12, align: 'center', color: '#ffffff', outline: '#20232a' });
    // logo parade
    const n = LOGO_PARADE.length;
    for (let i = 0; i < n; i++) {
      const x = ((i * 44 - this.t * 0.4) % (n * 44) + n * 44) % (n * 44) - 40;
      drawLogo(ctx, LOGO_PARADE[i], Math.round(x), 96, 38, 24, { board: true, pad: 2 });
    }
    const items = this.items();
    panel(ctx, W / 2 - 60, 140, 120, 46);
    items.forEach((it, i) => {
      const dis = i === 1 && !hasSave();
      text(ctx, it, W / 2 - 30, 147 + i * 18, { color: dis ? COLORS.dim : i === this.idx ? COLORS.accent : '#fff' });
      if (i === this.idx) cursor(ctx, W / 2 - 46, 149 + i * 18, this.t);
    });
    ctx.fillStyle = 'rgba(11,13,26,0.85)';
    ctx.fillRect(0, H - 18, W, 15);
    text(ctx, '実在の企業名・ロゴは各社の商標です（非公式ファンゲーム）', W / 2, H - 16, { size: 10, align: 'center', color: '#b8c0e8', shadow: null });
  }
}

// ------------------------------------------------------------------ character creation
const NAMES = ['ドット', 'ピクセル', 'ハナコ', 'タロウ', 'ミライ', 'ゲイノー'];
const TOPS = ['#d64161', '#2f6fd0', '#2f9a4a', '#ffd23f', '#ff8a3d', '#8a5ac8', '#f2f2f2', '#2a2d36', '#ff7eb6', '#5fd7ff'];
const BOTTOMS = ['#3a4a7a', '#2a2d36', '#5a4a3a', '#f2f2f2', '#c0452f', '#2f9a4a', '#8a5ac8', '#e0c48a'];
const STYLES = HAIR_STYLES.filter((s) => !['helmet', 'mage'].includes(s));
const HAIRC = Object.keys(HAIR);
const SKINS = Object.keys(SKIN).filter((s) => s !== 'green');
const STYLE_NAMES = { short: 'ショート', long: 'ロング', bob: 'ボブ', spiky: 'ツンツン', twin: 'ツインテール', slick: 'オールバック', afro: 'アフロ', cap: 'キャップ', bald: 'スキンヘッド' };
const HAIRC_NAMES = { black: 'くろ', brown: 'ちゃいろ', blonde: 'きんいろ', red: 'あか', silver: 'ぎんいろ', pink: 'ピンク', blue: 'あお', green: 'みどり', purple: 'むらさき', orange: 'オレンジ', white: 'しろ' };
const SKIN_NAMES = { light: 'しろめ', fair: 'ふつう', tan: 'こむぎ', brown: 'ちゃいろ', dark: 'こいめ' };
const GLASSES = [false, true, 'sun'];
const GLASSES_NAMES = ['なし', 'メガネ', 'サングラス'];

// opts (all optional): { look, name, closet }
//   new game: new CreateScene(g, resolve)  -> resolve({ name, look })
//   closet:   new CreateScene(g, resolve, { look, name, closet: true })
//             starts from the given look, the name row is hidden (the name stays),
//             B or 「やめる」 cancels -> resolve(null), otherwise resolve({ name, look }).
export class CreateScene {
  constructor(g, resolve, opts = {}) {
    this.g = g;
    this.resolve = resolve;
    this.t = 0;
    this.row = 0;
    this.opaque = true;
    this.closet = !!opts.closet;
    this.name = opts.name || NAMES[0];
    this.base = opts.look ? { ...opts.look } : null;
    // per-scene option lists: a look the editor cannot make (special colour etc.) is kept as an extra first entry
    this.lists = { style: STYLES.slice(), hairc: HAIRC.slice(), skin: SKINS.slice(), top: TOPS.slice(), bottom: BOTTOMS.slice(), glasses: GLASSES.slice() };
    this.v = { style: 0, hairc: 0, skin: 1, top: 0, bottom: 0, skirt: 0, glasses: 0 };
    if (this.base) this.fromLook(this.base);
    this.naming = null;
  }
  fromLook(look) {
    const at = (key, val) => {
      const list = this.lists[key];
      let i = list.indexOf(val);
      if (i < 0) { list.unshift(val); i = 0; }
      return i;
    };
    // defaults match the sprite palette (sprites.js) so an incomplete look keeps its appearance
    this.v.style = at('style', look.hair || 'short');
    this.v.hairc = at('hairc', look.hairColor || 'black');
    this.v.skin = at('skin', look.skin || 'fair');
    this.v.top = at('top', look.top || '#d64161');
    this.v.bottom = at('bottom', look.bottom || '#3a4a7a');
    this.v.skirt = look.skirt ? 1 : 0;
    this.v.glasses = at('glasses', look.glasses || false);
    this.top0 = this.v.top; // the hat keeps its colour until the top changes
  }
  look() {
    const v = this.v;
    const L = this.lists;
    const look = {
      hair: L.style[v.style], hairColor: L.hairc[v.hairc], skin: L.skin[v.skin], top: L.top[v.top], bottom: L.bottom[v.bottom],
      skirt: v.skirt === 1, glasses: L.glasses[v.glasses],
      // closet: the hat keeps its colour (or the sprite default when the look had none) until the top changes
      hat: this.base && v.top === this.top0 ? this.base.hat : L.top[(v.top + 3) % L.top.length],
    };
    if (look.hat === undefined) delete look.hat;
    return this.base ? { ...this.base, ...look } : look;
  }
  // [label, value, key]; key = what ◀▶ changes ('name' / a key of this.v / 'done' / 'cancel')
  rows() {
    const v = this.v;
    const L = this.lists;
    const rows = [];
    if (!this.closet) rows.push(['なまえ', this.name, 'name']);
    rows.push(
      ['かみがた', STYLE_NAMES[L.style[v.style]] || 'いまの髪型', 'style'],
      ['かみのいろ', HAIRC_NAMES[L.hairc[v.hairc]] || 'いまの色', 'hairc'],
      ['はだのいろ', SKIN_NAMES[L.skin[v.skin]] || 'いまの色', 'skin'],
      ['トップス', '■', 'top'],
      ['ボトムス', '■', 'bottom'],
      ['スカート', v.skirt ? 'あり' : 'なし', 'skirt'],
      ['めがね', GLASSES_NAMES[GLASSES.indexOf(L.glasses[v.glasses])] || 'いまのメガネ', 'glasses'],
    );
    if (this.closet) rows.push(['これでOK！', '', 'done'], ['やめる', '', 'cancel']);
    else rows.push(['これでけってい！', '', 'done']);
    return rows;
  }
  change(d) {
    const v = this.v;
    const k = this.rows()[this.row][2];
    if (k === 'name') {
      const i = NAMES.indexOf(this.name);
      this.name = NAMES[((i < 0 ? 0 : i) + d + NAMES.length) % NAMES.length];
      audio.sfx('cursor');
      return;
    }
    if (!(k in v)) return;
    const len = k === 'skirt' ? 2 : this.lists[k].length;
    v[k] = (v[k] + d + len) % len;
    audio.sfx('cursor');
  }
  finish(result) {
    this.g.pop(this);
    this.resolve(result);
  }
  update(g) {
    this.t++;
    const inp = g.input;
    // headless autoplay (tests): the closet closes without changing anything
    if (this.closet && g.auto) { this.finish(null); return; }
    const rows = this.rows();
    const n = rows.length;
    if (inp.repeat('up')) { this.row = (this.row + n - 1) % n; audio.sfx('cursor'); }
    if (inp.repeat('down')) { this.row = (this.row + 1) % n; audio.sfx('cursor'); }
    if (inp.repeat('left')) this.change(-1);
    if (inp.repeat('right')) this.change(1);
    if (this.closet && inp.pressed('b') && this.t > 10) { audio.sfx('cancel'); this.finish(null); return; }
    if (inp.pressed('a') && this.t > 10) {
      const k = rows[this.row][2];
      if (k === 'name') {
        audio.sfx('ok');
        let name = null;
        try { name = window.prompt('なまえを入力してください（8文字まで）', this.name); } catch (e) { name = null; }
        g.input.releaseAll();
        if (name && name.trim()) this.name = Array.from(name.trim()).slice(0, 8).join('');
      } else if (k === 'done') {
        audio.sfx('ok');
        this.finish({ name: this.name, look: this.look() });
      } else if (k === 'cancel') {
        audio.sfx('cancel');
        this.finish(null);
      } else this.change(1);
    }
  }
  draw(ctx, g) {
    if (this.closet) closetBg(ctx, this.t);
    else skyline(ctx, this.t + 500);
    panel(ctx, 8, 8, W - 16, H - 16, this.closet ? { bg: '#2a1f30' } : {});
    text(ctx, this.closet ? 'クローゼットで着がえよう' : 'キャラクターをつくろう', W / 2, 16, { size: 12, align: 'center', color: COLORS.accent });
    const sheet = charSheet(this.look());
    const dirs = ['down', 'left', 'up', 'right'];
    const dir = dirs[Math.floor(this.t / 50) % 4];
    const frame = [1, 0, 2, 0][Math.floor(this.t / 10) % 4];
    if (this.closet) {
      // a full-length mirror behind the preview
      ctx.fillStyle = '#c9a227'; ctx.fillRect(30, 40, 76, 104);
      ctx.fillStyle = '#8fb8d8'; ctx.fillRect(33, 43, 70, 98);
      ctx.fillStyle = '#b8daf0'; ctx.fillRect(37, 47, 6, 30); ctx.fillRect(45, 47, 3, 18);
    }
    ctx.save();
    ctx.translate(36, 52);
    ctx.scale(4, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(3, 15, 10, 2);
    drawChar(ctx, sheet, dir, frame, 0, 4);
    ctx.restore();
    text(ctx, this.name, 68, 150, { align: 'center', color: COLORS.accent });
    const rows = this.rows();
    rows.forEach(([label, value, key], i) => {
      const y = 38 + i * 19;
      const sel = i === this.row;
      text(ctx, label, 140, y, { color: sel ? COLORS.accent : '#fff' });
      if (key === 'top' || key === 'bottom') {
        const col = this.lists[key][this.v[key]];
        ctx.fillStyle = '#000'; ctx.fillRect(239, y + 1, 30, 11);
        ctx.fillStyle = col; ctx.fillRect(240, y + 2, 28, 9);
      } else if (value) text(ctx, value, 254, y, { align: 'center', color: sel ? COLORS.accent : COLORS.cyan });
      if (sel) {
        cursor(ctx, 128, y + 2, this.t);
        if (key in this.v) {
          // long values (ツインテール…) push the arrows out so they never touch the text
          const half = value && value !== '■' ? measure(ctx, value, 12) / 2 : 0;
          text(ctx, '◀', Math.min(214, 254 - half - 12), y, { size: 10, color: COLORS.dim });
          text(ctx, '▶', Math.max(288, 254 + half + 4), y, { size: 10, color: COLORS.dim });
        }
      }
    });
    const k = rows[this.row][2];
    let help;
    if (this.closet) help = k === 'done' ? 'Aで着がえる' : k === 'cancel' ? 'Aでやめる（もとのまま）' : '◀▶で変更　▲▼で項目えらび　Bでやめる';
    else help = k === 'name' ? 'A：なまえを入力　◀▶：候補から選ぶ' : k === 'done' ? 'Aでゲームスタート！' : '◀▶で変更　▲▼で項目えらび';
    text(ctx, help, W / 2, H - 28, { size: 10, align: 'center', color: COLORS.dim });
  }
}

// Closet backdrop: a wooden wardrobe with clothes on a rail.
function closetBg(ctx, t) {
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#6e4428';
  for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 14, H);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, 3, W, 2);
  for (let i = 0; i < 20; i++) {
    const x = i * 17 + 2 + Math.round(Math.sin(t / 30 + i) * 1);
    ctx.fillStyle = TOPS[i % TOPS.length];
    ctx.fillRect(x, 5, 12, 3);
  }
}
