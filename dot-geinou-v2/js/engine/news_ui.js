// ニュース (R9-D): the news app's HD screen (640x360), opened from the phone's ニュース / 新聞 app.
// The look follows the era's device: 手帳 → 新聞（朝刊・夕刊、縦の大見出し、網点の写真、テレビ欄、小窓と広告）,
// ケータイ → ニュースサイト（トピックス、アクセスランキング、天気・株価の箱）, スマホ → ニュースアプリ（大きなカード、速報の帯）.
// Sections: トップ・芸能・お笑い・政治・経済・国際・社会・スポーツ・天気・テレビ欄・検索. A 号外 opens first when there is one.
// Keys: ←→ sections, ↓/A into the page, ↑↓ choose, A read (in an article ↑↓ = previous / next story), B back, MENU close.
// Touch: tap a section, a story (tap again to read), the × to close, the article to close it, a search chip.
// Data: news_core.js (the feed), news_data.js, news_art.js (pictures). API doc: test-output/api_r9d.txt.
import { Game } from './game.js';
import { SW, SH, clamp } from './util.js';
import { text, wrap, measure } from './draw.js';
import { audio } from './audio.js';
import { fitText } from './phone.js';
import { REGULARS } from './life.js';
import { SECTIONS, SEC, FORM, ADS, KOMADO } from './news_data.js';
import { newsFeed, newsFront, newsOpened, newsRead, newsGogaiSeen, newsMarket, newsWeather, newsDateNum, nstate, WX_REGIONS } from './news_core.js';
import { drawNewsImage } from './news_art.js';

let PG = null; // programs.js (テレビ欄)
import('../world/programs.js').then((m) => { PG = m; }).catch(() => { PG = null; });
let ASK = null; // textinput.js (検索の自由入力)
import('./textinput.js').then((m) => { ASK = m; }).catch(() => { ASK = null; });

const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio in tests */ } };
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const T = (c, s, x, y, size = 12, col = '#222', align = 'left', maxW = 0) => text(c, maxW > 0 ? fitText(c, String(s), maxW, size) : String(s), x, y, { size, color: col, align, shadow: null });
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
function para(c, s, x, y, w, size, col, lh, maxLines = 99) {
  const all = wrap(c, String(s || ''), w - size, size); // room for a hanging 、。（wrap keeps them on the line）
  const ls = all.slice(0, maxLines);
  if (all.length > maxLines && ls.length) ls[ls.length - 1] = fitText(c, ls[ls.length - 1] + '……', w, size);
  ls.forEach((l, i) => T(c, l, x, y + i * lh, size, col));
  return y + ls.length * lh;
}
function frame(c, x, y, w, h, col) { R(c, x, y, w, 1, col); R(c, x, y + h - 1, w, 1, col); R(c, x, y, 1, h, col); R(c, x + w - 1, y, 1, h, col); }
function devOf(g) { const e = g.state && g.state.profile && g.state.profile.era; return e === 'reiwa' ? 'smart' : e === 'heisei' ? 'keitai' : 'techo'; }
// vertical text (縦書き): one character under the other; marks that turn are replaced by their vertical forms
const VMAP = { 'ー': '｜', '−': '｜', '-': '｜', '「': '﹁', '」': '﹂', '（': '︵', '）': '︶', '、': '︑', '。': '︒', '…': '︙', '〜': '≀', '：': '‥', '『': '﹃', '』': '﹄' };
function vtext(c, s, x, y, size, col, maxN) {
  const ch = Array.from(String(s)).slice(0, maxN);
  ch.forEach((k, i) => T(c, VMAP[k] || k, x, y + i * (size + 1), size, col, 'center'));
  return ch.length;
}
// the head for the vertical headline: up to the first comma, at most n characters
function shortHead(h, n = 12) { const s = String(h).replace(/^【[^】]*】/, ''); const m = /^(.{4,}?)[、，。]/.exec(s); const a = (m ? m[1] : s); return Array.from(a).length <= n ? a : Array.from(a).slice(0, n - 1).join('') + '…'; }
const restHead = (h) => { const s = String(h).replace(/^【[^】]*】/, ''); const i = s.search(/[、，。]/); return i >= 0 ? s.slice(i + 1).replace(/^。/, '') : ''; };
function seedOf(s) { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h % 97; }
function ago(g, day) { const d = num(g.state.day) - num(day); return d <= 0 ? 'きょう' : d === 1 ? 'きのう' : d < 10 ? `${d}日前` : `${Math.floor(d / 10)}か月前`; }
const yen = (v) => `${Math.round(v).toLocaleString('ja-JP')}円`;
const pct = (v) => `${v >= 0 ? '+' : '−'}${(Math.abs(v) * 100).toFixed(2)}%`;
const upCol = (v) => (v > 0 ? '#d8303a' : v < 0 ? '#2a6ac8' : '#777'); // Japanese colours: up red, down blue

// ================================================================ looks by form
const LOOK = {
  paper: { bg: '#f1ebda', ink: '#1e1d22', dim: '#5d5a52', faint: '#9a9484', rule: '#3a372f', sel: '#e3d6b4', head: '#f1ebda', tabOn: '#1e1d22', tabOff: '#f1ebda', mono: true },
  site: { bg: '#f4f6fa', ink: '#1a1e2a', dim: '#5a6274', faint: '#9aa2b4', rule: '#c4cad8', sel: '#fff2b8', head: '#1a4a9a', tabOn: '#ff8a1a', tabOff: '#dfe6f2', link: '#1a3ab0', mono: false },
  app: { bg: '#eef0f4', ink: '#16181e', dim: '#5c6170', faint: '#a0a6b4', rule: '#d6dae2', sel: '#ffe9ec', head: '#ffffff', tabOn: '#e8323c', tabOff: '#ffffff', mono: false },
};
const TABS = [...SECTIONS, { id: 'find', label: '検索', col: '#4a4a5a' }];
const BODY_Y = 56, FOOT_Y = 344;
const FIND_CHIPS = ['あなた', '選挙', '逮捕', '優勝', '地震', '株', '台風', '新幹線', 'M-1', '五輪'];

// ================================================================ the scene
const sceneOf = (g) => g && g.scenes && g.scenes.find((s) => s.isNewsUI && !s.closed);
let tapCanvas = null;
function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const sc = sceneOf(g);
    if (!sc || g.top !== sc) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    sc.tapAt = { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  }, { passive: true });
}

class NewsScene {
  constructor(g, opts, resolve) {
    Object.assign(this, { g, resolve, hd: true, opaque: true, hidesHud: true, isNewsUI: true, t: 0, tapAt: null, closed: false, focus: 'body', tab: 0, sel: {}, top: {}, hits: [], toast: null, article: null, gogai: null, q: '' });
    this.dev = devOf(g);
    this.form = FORM[this.dev].kind;
    this.L = LOOK[this.form];
    bindTap(g);
    newsOpened(g);
    this.q = nstate(g).q || '';
    const ti = opts && opts.tab ? TABS.findIndex((t) => t.id === opts.tab) : 0;
    this.tab = ti >= 0 ? ti : 0;
    this.refresh(true);
    if (this.front && this.front.gogai && !(opts && opts.noGogai)) { this.gogai = this.front.gogai; sfx('good'); }
  }
  get tabId() { return TABS[this.tab].id; }
  refresh(force = false) {
    if (!force && this.t - (this.dataT || -999) < 60) return;
    this.dataT = this.t;
    const g = this.g;
    this.front = safe(() => newsFront(g), { top: null, subs: [], list: [], counts: {}, gogai: null });
    const id = this.tabId;
    if (id === 'top') this.rows = [this.front.top, ...this.front.subs, ...this.front.list.slice(0, 40)].filter(Boolean);
    else if (id === 'find') this.rows = this.q ? (this.q === 'あなた' ? newsFeed(g, { mine: true, limit: 80 }) : newsFeed(g, { q: this.q, limit: 80 })) : [];
    else if (id === 'tv' || id === 'weather') this.rows = id === 'weather' ? newsFeed(g, { cat: 'weather', limit: 30 }) : [];
    else this.rows = newsFeed(g, { cat: id, limit: 80 });
    this.market = id === 'eco' || id === 'top' ? newsMarket(g) : null;
    this.wx = id === 'weather' || id === 'top' ? newsWeather(g) : null;
    const s = this.sel[id] | 0;
    if (s >= this.rows.length) this.sel[id] = Math.max(0, this.rows.length - 1);
  }
  setTab(i) { this.tab = (i + TABS.length) % TABS.length; this.refresh(true); sfx('cursor'); }
  cur() { return this.rows[this.sel[this.tabId] | 0] || null; }
  open(it) {
    if (!it) return;
    newsRead(this.g, it);
    this.article = it;
    this.artScroll = 0;
    sfx('ok');
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.g.pop(this);
    this.resolve(null);
  }
  // ---------------------------------------------------------------- update
  update(g) {
    this.t++;
    if (this.toast) { this.toast.t++; if (this.toast.t > 120) this.toast = null; }
    const inp = g.input;
    const tap = this.tapAt;
    this.tapAt = null;
    if (this.t < 3 || this.busy) return;
    this.refresh();
    if (tap && this.handleTap(tap, inp)) return;
    if (inp.pressed('menu')) { sfx('cancel'); this.close(); return; }
    if (this.gogai) { if (inp.pressed('a') || inp.pressed('b')) { newsGogaiSeen(g, this.gogai); this.gogai = null; sfx('ok'); this.refresh(true); } return; }
    if (this.article) {
      if (inp.pressed('a') || inp.pressed('b')) { this.article = null; sfx('cancel'); this.refresh(true); return; }
      for (const dir of ['up', 'down']) {
        if (!inp.repeat(dir)) continue;
        const id = this.tabId;
        const i = clamp((this.sel[id] | 0) + (dir === 'up' ? -1 : 1), 0, Math.max(0, this.rows.length - 1));
        if (i !== (this.sel[id] | 0)) { this.sel[id] = i; this.open(this.rows[i]); }
      }
      return;
    }
    if (this.focus === 'tabs') {
      if (inp.repeat('left')) this.setTab(this.tab - 1);
      else if (inp.repeat('right')) this.setTab(this.tab + 1);
      else if (inp.pressed('down') || inp.pressed('a')) { this.focus = 'body'; sfx('cursor'); }
      else if (inp.pressed('b')) { sfx('cancel'); this.close(); }
      return;
    }
    if (inp.pressed('b')) { this.focus = 'tabs'; sfx('cancel'); return; }
    const id = this.tabId;
    if (id === 'find' && (!this.rows.length || this.findFocus)) {
      // the chips row: ←→ choose a chip, A search, ↓ the results
      const nC = FIND_CHIPS.length + 1;
      if (inp.repeat('left')) { this.chipIdx = ((this.chipIdx | 0) + nC - 1) % nC; sfx('cursor'); return; }
      if (inp.repeat('right')) { this.chipIdx = ((this.chipIdx | 0) + 1) % nC; sfx('cursor'); return; }
      if (inp.repeat('up')) { this.focus = 'tabs'; sfx('cursor'); return; }
      if (inp.repeat('down') && this.rows.length) { this.findFocus = false; sfx('cursor'); return; }
      if (inp.pressed('a')) { this.findChip(this.chipIdx | 0); return; }
      return;
    }
    if (inp.repeat('left')) { this.setTab(this.tab - 1); return; }
    if (inp.repeat('right')) { this.setTab(this.tab + 1); return; }
    if (id === 'tv' || (id === 'weather' && !this.rows.length)) { if (inp.repeat('up')) { this.focus = 'tabs'; sfx('cursor'); } return; }
    const n = this.rows.length;
    if (inp.repeat('up')) { if ((this.sel[id] | 0) > 0) { this.sel[id]--; sfx('cursor'); } else { if (id === 'find') this.findFocus = true; else this.focus = 'tabs'; sfx('cursor'); } return; }
    if (inp.repeat('down')) { if ((this.sel[id] | 0) < n - 1) { this.sel[id]++; sfx('cursor'); } return; }
    if (inp.pressed('a')) this.open(this.cur());
  }
  async findChip(i) {
    const lab = FIND_CHIPS[i];
    if (lab == null) {
      // free text
      if (!ASK) return;
      this.busy = true;
      const s = await safe(() => ASK.askText(this.g, { title: 'ニュースを検索', value: this.q || '', max: 12, placeholder: 'ことば' }), null);
      this.busy = false;
      if (s == null) return;
      this.q = String(s).trim();
    } else this.q = lab;
    nstate(this.g).q = this.q;
    this.sel.find = 0;
    this.findFocus = false;
    this.refresh(true);
    sfx('ok');
    this.toast = { text: this.rows.length ? `「${this.q}」${this.rows.length}件` : `「${this.q}」の記事はない`, t: 0 };
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    const { x, y } = tap;
    for (const h of this.hits.slice().reverse()) {
      if (!inR(x, y, h)) continue;
      now.a = false;
      h.fn();
      return true;
    }
    return false;
  }
  hit(x, y, w, h, fn) { this.hits.push({ x, y, w, h, fn }); }
  // ---------------------------------------------------------------- draw
  draw(c) {
    const L = this.L;
    this.hits = [];
    R(c, 0, 0, SW, SH, L.bg);
    try {
      this.drawHead(c);
      this.drawTabs(c);
      const id = this.tabId;
      if (id === 'top') this.drawFront(c);
      else if (id === 'tv') this.drawTV(c);
      else if (id === 'weather') this.drawWeather(c);
      else if (id === 'find') this.drawFind(c);
      else this.drawSection(c);
      this.drawFoot(c);
      if (this.article) this.drawArticle(c, this.article);
      if (this.gogai) this.drawGogai(c, this.gogai);
    } catch (e) { console.error(e); }
    if (this.toast) { const w = Math.min(SW - 40, measure(c, this.toast.text, 12) + 24); R(c, (SW - w) / 2, 300, w, 22, 'rgba(0,0,0,0.82)'); T(c, this.toast.text, SW / 2, 305, 12, '#ffffff', 'center', w - 10); }
    // the close ×
    const cx = SW - 20;
    R(c, cx, 2, 18, 18, this.form === 'paper' ? '#1e1d22' : this.form === 'site' ? '#0e2a6a' : '#e8323c');
    T(c, '×', cx + 9, 4, 12, '#ffffff', 'center');
    this.hit(cx - 4, 0, 24, 22, () => { sfx('cancel'); if (this.article) this.article = null; else if (this.gogai) { newsGogaiSeen(this.g, this.gogai); this.gogai = null; } else this.close(); });
  }
  dateLine() {
    const g = this.g;
    const full = has(g, 'dateFull') ? safe(() => g.dateFull(), '') : '';
    if (full) return full;
    const n = newsDateNum(g);
    return `${Math.floor(n / 10000)}年${Math.floor(n / 100) % 100}月${n % 100}日`;
  }
  clockLabel() { const c = has(this.g, 'clock') ? safe(() => this.g.clock(), null) : null; return c && Number.isFinite(c.hour) ? { h: c.hour, label: `${c.hour}:${String(c.minute | 0).padStart(2, '0')}` } : null; }
  drawHead(c) {
    const L = this.L, g = this.g;
    const wx = has(g, 'weather') ? safe(() => g.weather(), null) : null;
    if (this.form === 'paper') {
      // the masthead: name, date, 朝刊/夕刊, the weather
      R(c, 4, 3, 168, 30, '#1e1d22');
      T(c, 'ドット新聞', 88, 6, 20, '#f1ebda', 'center');
      const ck = this.clockLabel();
      T(c, `${this.dateLine()}`, 180, 5, 12, L.ink, 'left', 300);
      T(c, `${ck && ck.h >= 15 ? '夕刊' : '朝刊'}　第${(num(g.state.day) + 31000).toLocaleString('ja-JP')}号`, 180, 20, 10, L.dim, 'left', 200);
      if (wx) { R(c, 470, 4, 146, 28, '#e6dcc4'); frame(c, 470, 4, 146, 28, L.rule); safe(() => g.drawWeatherIcon(c, wx.kind, 474, 8, 20, false)); T(c, `${wx.regionName || ''} ${wx.label}`, 498, 6, 12, L.ink, 'left', 110); T(c, `${wx.high}℃／${wx.low}℃　${wx.pop}%`, 498, 19, 10, L.dim, 'left', 110); }
      R(c, 4, 35, 612, 2, L.rule);
    } else if (this.form === 'site') {
      for (let y = 0; y < 36; y++) R(c, 0, y, SW, 1, y < 18 ? '#2a5ab4' : '#1a4a9a');
      T(c, 'ドットニュース', 10, 7, 18, '#ffffff');
      R(c, 160, 9, 200, 18, '#ffffff'); frame(c, 160, 9, 200, 18, '#0e2a6a'); T(c, this.q ? `${this.q}` : 'ニュースを検索', 166, 12, 12, this.q ? '#1a1e2a' : '#9aa2b4', 'left', 150); R(c, 362, 9, 40, 18, '#ff8a1a'); T(c, '検索', 382, 12, 12, '#ffffff', 'center');
      this.hit(160, 9, 242, 18, () => { this.tab = TABS.length - 1; this.focus = 'body'; this.findFocus = true; this.refresh(true); });
      T(c, this.dateLine().replace(/（.*?年）/, ''), 600, 6, 10, '#d8e4fc', 'right', 190);
      if (wx) T(c, `${wx.regionName || ''} ${wx.label} ${wx.high}℃`, 600, 20, 10, '#ffffff', 'right', 190);
    } else {
      R(c, 0, 0, SW, 36, '#ffffff'); R(c, 0, 36, SW, 1, L.rule);
      R(c, 8, 7, 22, 22, '#e8323c'); T(c, 'N', 19, 10, 14, '#ffffff', 'center');
      T(c, 'ドットニュース', 36, 9, 16, L.ink);
      const ck = this.clockLabel();
      T(c, `${ck ? ck.label + ' 更新' : ''}`, 200, 12, 10, L.dim);
      if (wx) { safe(() => g.drawWeatherIcon(c, wx.kind, 470, 8, 18, false)); T(c, `${wx.temp ?? wx.high}℃`, 492, 11, 12, L.ink); }
      R(c, 540, 8, 70, 20, '#f0f1f5'); T(c, '🔍 検索', 575, 11, 12, L.dim, 'center');
      this.hit(540, 8, 70, 20, () => { this.tab = TABS.length - 1; this.focus = 'body'; this.findFocus = true; this.refresh(true); });
    }
  }
  drawTabs(c) {
    const L = this.L, n = TABS.length, y = 38, w = (SW - 8) / n;
    TABS.forEach((t, i) => {
      const x = Math.round(4 + i * w), on = i === this.tab, ww = Math.round(w) - 2;
      const dot = t.id !== 'top' && this.front && this.front.counts && this.front.counts[t.id] > 0;
      if (this.form === 'paper') {
        R(c, x, y, ww, 16, on ? L.tabOn : L.tabOff); frame(c, x, y, ww, 16, L.rule);
        T(c, t.id === 'top' ? '一面' : t.label, x + ww / 2, y + 2, 12, on ? '#f1ebda' : L.ink, 'center', ww - 4);
      } else if (this.form === 'site') {
        R(c, x, y, ww, 16, on ? L.tabOn : L.tabOff);
        T(c, t.label, x + ww / 2, y + 2, 12, on ? '#ffffff' : L.link, 'center', ww - 4);
      } else {
        if (on) { R(c, x + 2, y, ww - 4, 16, t.col); }
        T(c, t.label, x + ww / 2, y + 2, 12, on ? '#ffffff' : L.dim, 'center', ww - 4);
      }
      if (dot) R(c, x + ww - 6, y + 2, 4, 4, '#e8323c');
      if (on && this.focus === 'tabs') { R(c, x, y + 16, ww, 2, '#ffb547'); }
      this.hit(x, y, ww, 16, () => { this.focus = 'body'; if (i !== this.tab) this.setTab(i); });
    });
  }
  drawFoot(c) {
    const L = this.L;
    R(c, 0, FOOT_Y, SW, SH - FOOT_Y, this.form === 'paper' ? '#e2d8c0' : this.form === 'site' ? '#dfe6f2' : '#ffffff');
    R(c, 0, FOOT_Y, SW, 1, L.rule);
    const hint = this.gogai ? 'A：一面へ' : this.article ? 'A/B：もどる　↑↓：前後の記事' : this.focus === 'tabs' ? '←→：面をえらぶ　↓：記事へ　B：とじる' : '↑↓：記事　A：よむ　←→：面　B：面のえらび直し　MENU：とじる';
    T(c, hint, 8, FOOT_Y + 3, 10, L.dim, 'left', 460);
    const n = this.rows ? this.rows.length : 0;
    if (!this.article && !this.gogai && n && !['tv'].includes(this.tabId)) T(c, `${(this.sel[this.tabId] | 0) + 1}／${n}件`, SW - 8, FOOT_Y + 3, 10, L.dim, 'right');
  }
  // a picture
  pic(c, it, x, y, w, h) {
    drawNewsImage(c, it ? it.img : 'city', x, y, w, h, { mono: this.L.mono, seed: seedOf(it ? it.key : ''), gengo: it && it.gengo, night: it && /夜|深夜/.test(it.head) });
    if (this.form === 'paper') frame(c, x, y, w, h, this.L.rule);
  }
  chip(c, it, x, y) {
    const s = SEC[it.cat] || SEC.soc;
    const w = Math.ceil(measure(c, s.label, 10)) + 8;
    if (this.form === 'paper') { frame(c, x, y, w, 13, this.L.rule); T(c, s.label, x + w / 2, y + 1, 10, this.L.ink, 'center'); }
    else { R(c, x, y, w, 13, s.col); T(c, s.label, x + w / 2, y + 1, 10, '#ffffff', 'center'); }
    return w;
  }
  badges(c, it, x, y) {
    let bx = x;
    if (it.gogai) { R(c, bx, y, 26, 13, '#c8102e'); T(c, '号外', bx + 13, y + 1, 10, '#ffffff', 'center'); bx += 29; }
    if (it.mine) { R(c, bx, y, 34, 13, '#f0a020'); T(c, 'あなた', bx + 17, y + 1, 10, '#ffffff', 'center'); bx += 37; }
    if (it.isNew) { T(c, 'NEW', bx, y + 1, 10, '#e8323c'); bx += 26; }
    return bx;
  }
  selectable(c, i, x, y, w, h) {
    const id = this.tabId;
    const on = (this.sel[id] | 0) === i && this.focus === 'body' && !(id === 'find' && this.findFocus);
    if (on) { R(c, x, y, w, h, this.L.sel); frame(c, x, y, w, h, this.form === 'app' ? '#e8323c' : this.form === 'site' ? '#ff8a1a' : this.L.rule); }
    this.hit(x, y, w, h, () => { this.focus = 'body'; this.findFocus = false; if ((this.sel[id] | 0) === i) this.open(this.rows[i]); else { this.sel[id] = i; sfx('cursor'); } });
    return on;
  }
  // ---------------------------------------------------------------- front pages
  drawFront(c) {
    const f = this.front;
    if (!f || !f.top) { T(c, 'まだニュースはない。', SW / 2, 160, 14, this.L.dim, 'center'); return; }
    if (this.form === 'paper') this.frontPaper(c, f);
    else if (this.form === 'site') this.frontSite(c, f);
    else this.frontApp(c, f);
  }
  frontPaper(c, f) {
    const L = this.L, g = this.g;
    const top = f.top;
    // the top story (right): a vertical headline in a black band, the photo, the lead
    const bx = 250, by = BODY_Y + 2;
    this.selectable(c, 0, bx - 2, by - 2, 390, 236);
    R(c, 600, by, 34, 228, '#1e1d22');
    const sh = shortHead(top.head, 11);
    vtext(c, sh, 617, by + 6, 19, '#f1ebda', 11);
    const rest = restHead(top.head) || (top.body || '').split(/[。\n]/)[0];
    vtext(c, rest, 585, by + 4, 14, L.ink, 15);
    this.pic(c, top, bx + 2, by + 2, 312, 150);
    this.badges(c, top, bx + 4, by + 156);
    T(c, `${top.from}　${top.real ? top.dateText : ago(g, top.day)}`, bx + 316, by + 156, 10, L.dim, 'right', 200);
    para(c, top.body || top.head, bx + 2, by + 172, 312, 12, L.ink, 15, 4);
    // the sub stories (left column)
    let y = BODY_Y + 2;
    f.subs.forEach((it, k) => {
      const i = k + 1, h = 58;
      this.selectable(c, i, 2, y - 1, 242, h);
      this.pic(c, it, 6, y + 2, 64, 40);
      T(c, (SEC[it.cat] || SEC.soc).label, 76, y + 1, 10, L.dim);
      this.badges(c, it, 106, y);
      para(c, it.head.replace(/^【[^】]*】/, ''), 76, y + 14, 164, 12, L.ink, 14, 2);
      T(c, ago(g, it.day), 240, y + 44, 10, L.faint, 'right');
      R(c, 4, y + h, 238, 1, L.rule);
      y += h + 2;
    });
    // bottom: 小窓 (a small column), the market and an ad
    const yb = 296;
    R(c, 4, yb, 632, 1, L.rule);
    const m = newsDateNum(g) % 10000;
    T(c, '小窓', 8, yb + 4, 12, '#f1ebda'); R(c, 6, yb + 3, 28, 15, '#1e1d22'); T(c, '小窓', 20, yb + 4, 12, '#f1ebda', 'center');
    para(c, KOMADO[Math.floor(m / 100)] || '', 38, yb + 4, 250, 10, L.ink, 12, 3);
    const mk = this.market;
    if (mk) { frame(c, 294, yb + 3, 150, 40, L.rule); T(c, '日経平均', 300, yb + 6, 10, L.dim); T(c, yen(mk.price), 300, yb + 19, 14, L.ink); T(c, pct(mk.change), 438, yb + 6, 10, L.ink, 'right'); }
    const ad = ADS.techo[Math.floor(num(g.state.day) / 3) % ADS.techo.length];
    R(c, 450, yb + 3, 184, 40, '#1e1d22'); T(c, ad[0], 542, yb + 6, 12, '#f1ebda', 'center', 176); T(c, ad[1], 542, yb + 24, 10, '#e6dcc4', 'center', 176);
  }
  frontSite(c, f) {
    const L = this.L, g = this.g, top = f.top;
    // centre: the top story
    const cx = 204, cy = BODY_Y + 2;
    this.selectable(c, 0, cx - 2, cy - 2, 270, 238);
    this.pic(c, top, cx, cy, 266, 140);
    let bx = this.chip(c, top, cx, cy + 144) + cx + 4;
    bx = this.badges(c, top, bx, cy + 144);
    T(c, ago(g, top.day), cx + 266, cy + 144, 10, L.dim, 'right');
    const yy = para(c, top.head.replace(/^【[^】]*】/, ''), cx, cy + 160, 266, 14, L.link, 17, 2);
    R(c, cx, yy, Math.min(266, measure(c, wrap(c, top.head, 266, 14)[0] || '', 14)), 1, L.link);
    para(c, top.body || '', cx, yy + 4, 266, 12, L.ink, 14, 3);
    T(c, '→続きを読む', cx + 266, cy + 222, 10, L.link, 'right');
    // left: トピックス
    R(c, 4, BODY_Y, 194, 18, '#1a4a9a'); T(c, 'トピックス', 10, BODY_Y + 2, 12, '#ffffff');
    const tops = [...f.subs, ...f.list].slice(0, 8);
    tops.forEach((it, k) => {
      const i = k + 1, y = BODY_Y + 20 + k * 26;
      this.selectable(c, i, 4, y, 194, 25);
      T(c, `[${(SEC[it.cat] || SEC.soc).label}]`, 8, y + 2, 10, (SEC[it.cat] || SEC.soc).col);
      if (it.isNew) T(c, 'NEW', 194, y + 2, 10, '#e8323c', 'right');
      T(c, it.head.replace(/^【[^】]*】/, ''), 8, y + 12, 12, L.link, 'left', 186);
    });
    this.rows = [top, ...tops];
    // right: weather, market, ranking
    const rx = 478, rw = 158;
    const wx = this.wx && this.wx.today;
    frame(c, rx, BODY_Y, rw, 58, L.rule); R(c, rx, BODY_Y, rw, 14, '#3a9ad0'); T(c, 'きょうの天気', rx + 4, BODY_Y + 1, 10, '#ffffff');
    if (wx) { safe(() => g.drawWeatherIcon(c, wx.kind, rx + 6, BODY_Y + 20, 24, false)); T(c, `${wx.regionName || ''} ${wx.label}`, rx + 36, BODY_Y + 18, 12, L.ink, 'left', rw - 40); T(c, `${wx.high}℃`, rx + 36, BODY_Y + 34, 12, '#d8303a'); T(c, `${wx.low}℃`, rx + 76, BODY_Y + 34, 12, '#2a6ac8'); T(c, `${wx.pop}%`, rx + rw - 6, BODY_Y + 34, 12, L.dim, 'right'); }
    const mk = this.market;
    const my = BODY_Y + 62;
    frame(c, rx, my, rw, 58, L.rule); R(c, rx, my, rw, 14, '#1f8a5a'); T(c, '株価', rx + 4, my + 1, 10, '#ffffff');
    if (mk) { T(c, '日経平均', rx + 4, my + 18, 10, L.dim); T(c, yen(mk.price), rx + 4, my + 30, 14, L.ink); T(c, pct(mk.change), rx + rw - 4, my + 18, 10, upCol(mk.change), 'right'); spark(c, mk.series, rx + 96, my + 32, 56, 18, upCol(mk.change)); }
    else T(c, '—', rx + 6, my + 24, 12, L.dim);
    const ry = my + 62;
    frame(c, rx, ry, rw, 164, L.rule); R(c, rx, ry, rw, 14, '#ff8a1a'); T(c, 'アクセスランキング', rx + 4, ry + 1, 10, '#ffffff');
    const rank = [top, ...tops].slice().sort((a, b) => b.prio - a.prio).slice(0, 6);
    rank.forEach((it, k) => { T(c, `${k + 1}`, rx + 6, ry + 18 + k * 24, 14, k < 3 ? '#ff8a1a' : L.dim); para(c, it.head.replace(/^【[^】]*】/, ''), rx + 22, ry + 18 + k * 24, rw - 26, 10, L.link, 11, 2); });
    const ad = ADS.keitai[Math.floor(num(g.state.day) / 3) % ADS.keitai.length];
    R(c, 204, 300, 270, 40, '#fff8e0'); frame(c, 204, 300, 270, 40, '#e8c060'); T(c, 'PR', 210, 304, 10, '#b08a20'); T(c, ad[0], 230, 304, 12, L.ink); T(c, ad[1], 230, 320, 12, L.dim, 'left', 240);
    R(c, 4, 300, 194, 40, '#eef2f8'); T(c, `ニュース ${f.total}件`, 10, 306, 12, L.ink); T(c, 'ケータイでもチェック', 10, 322, 10, L.dim);
  }
  frontApp(c, f) {
    const L = this.L, g = this.g, top = f.top;
    // the hero card
    const hx = 6, hy = BODY_Y + 2, hw = 412, hh = 200;
    this.selectable(c, 0, hx - 2, hy - 2, hw + 4, hh + 4);
    this.pic(c, top, hx, hy, hw, hh);
    for (let i = 0; i < 70; i++) R(c, hx, hy + hh - 70 + i, hw, 1, `rgba(0,0,0,${(i / 70) * 0.72})`);
    let bx = this.chip(c, top, hx + 10, hy + hh - 64) + hx + 14;
    this.badges(c, top, bx, hy + hh - 64);
    para(c, top.head.replace(/^【[^】]*】/, ''), hx + 10, hy + hh - 46, hw - 20, 16, '#ffffff', 19, 2);
    T(c, `${top.from}・${top.real ? top.dateText : ago(g, top.day)}`, hx + hw - 8, hy + hh - 64, 10, '#e8e8f0', 'right', 160);
    // the side cards
    const sx = 424, sw = 212;
    const brk = f.list.concat(f.subs).filter((n) => n.key !== top.key && n.day >= num(g.state.day) - 1 && !n.season && !n.market).sort((a, b) => (b.gogai - a.gogai) || b.day - a.day)[0] || null;
    let y = BODY_Y + 2;
    if (brk) { R(c, sx, y, sw, 20, brk.gogai ? '#e8323c' : '#3a3e4a'); T(c, brk.gogai ? '速報' : 'NEW', sx + 6, y + 3, 12, '#ffffff'); T(c, brk.head.replace(/^【[^】]*】/, ''), sx + 44, y + 3, 12, '#ffffff', 'left', sw - 50); this.hit(sx, y, sw, 20, () => this.open(brk)); y += 24; }
    const side = f.subs.slice(0, brk ? 3 : 4);
    side.forEach((it, k) => {
      const i = k + 1;
      R(c, sx, y, sw, 44, '#ffffff');
      this.selectable(c, i, sx, y, sw, 44);
      this.pic(c, it, sx + 4, y + 4, 58, 36);
      para(c, it.head.replace(/^【[^】]*】/, ''), sx + 68, y + 3, sw - 84, 12, L.ink, 14, 2);
      T(c, `${(SEC[it.cat] || SEC.soc).label}・${ago(g, it.day)}`, sx + 68, y + 31, 10, L.dim, 'left', 90);
      this.badges(c, { ...it, gogai: false }, sx + 150, y + 31);
      y += 48;
    });
    this.rows = [top, ...side, ...f.list.slice(0, 3)];
    // bottom: weather / market / more stories
    const yb = 262;
    const wx = this.wx && this.wx.today;
    R(c, 6, yb, 136, 78, '#ffffff');
    T(c, '天気', 12, yb + 4, 10, L.dim);
    if (wx) { safe(() => g.drawWeatherIcon(c, wx.kind, 12, yb + 20, 28, false)); T(c, `${wx.label}`, 48, yb + 18, 14, L.ink, 'left', 90); T(c, `${wx.high}℃ / ${wx.low}℃`, 48, yb + 36, 12, L.dim); T(c, `降水 ${wx.pop}%`, 48, yb + 52, 10, L.dim); }
    const mk = this.market;
    R(c, 146, yb, 136, 78, '#ffffff');
    T(c, 'マーケット', 152, yb + 4, 10, L.dim);
    if (mk) { T(c, '日経平均', 152, yb + 18, 10, L.ink); T(c, yen(mk.price), 152, yb + 30, 14, L.ink); T(c, pct(mk.change), 276, yb + 4, 10, upCol(mk.change), 'right'); spark(c, mk.series, 152, yb + 50, 124, 22, upCol(mk.change)); }
    f.list.slice(0, 3).forEach((it, k) => {
      const i = side.length + 1 + k, x = 286 + k * 117, w = 113;
      R(c, x, yb, w, 78, '#ffffff');
      this.selectable(c, i, x, yb, w, 78);
      this.pic(c, it, x + 4, yb + 4, w - 8, 36);
      para(c, it.head.replace(/^【[^】]*】/, ''), x + 4, yb + 44, w - 8, 10, L.ink, 12, 2);
      T(c, ago(g, it.day), x + w - 4, yb + 68, 10, L.faint, 'right');
    });
  }
  // ---------------------------------------------------------------- section pages
  drawSection(c, opts = {}) {
    const L = this.L, g = this.g, id = this.tabId;
    const rows = this.rows;
    let y0 = BODY_Y + 2;
    const lw = 392;
    if (id === 'eco' && this.market) { this.marketBox(c, 4, y0, lw - 4, 56); y0 += 60; }
    if (!rows.length) { T(c, opts.empty || 'この面の記事は、まだない。', lw / 2, y0 + 60, 14, L.dim, 'center'); return; }
    const rh = 46;
    const vis = Math.floor((FOOT_Y - 4 - y0) / rh);
    const s = this.sel[id] | 0;
    let top = this.top[id] | 0;
    if (s < top) top = s; if (s >= top + vis) top = s - vis + 1;
    this.top[id] = top;
    for (let i = top; i < Math.min(rows.length, top + vis); i++) {
      const it = rows[i], y = y0 + (i - top) * rh;
      if (this.form === 'app') R(c, 4, y + 1, lw - 4, rh - 3, '#ffffff');
      this.selectable(c, i, 4, y, lw - 4, rh - 2);
      this.pic(c, it, 8, y + 4, 60, 37);
      let bx = 74;
      if (id === 'find') bx += this.chip(c, it, 74, y + 3) + 4;
      bx = this.badges(c, it, bx, y + 3);
      T(c, `${it.from}・${it.real ? it.dateText : ago(g, it.day)}`, lw - 6, y + 4, 10, L.faint, 'right', Math.max(60, lw - 10 - bx));
      para(c, it.head.replace(/^【[^】]*】/, ''), 74, y + 17, lw - 84, 12, this.form === 'site' ? L.link : L.ink, 14, 2);
      if (this.form !== 'app') R(c, 6, y + rh - 2, lw - 8, 1, L.rule);
    }
    if (rows.length > vis) { const sbh = FOOT_Y - 4 - y0; R(c, lw + 1, y0, 2, sbh, L.rule); R(c, lw + 1, y0 + (sbh * top) / rows.length, 2, Math.max(8, (sbh * vis) / rows.length), L.ink); }
    // the preview of the chosen story
    const it = rows[s];
    if (it) this.preview(c, it, 398, BODY_Y + 2, 238, FOOT_Y - BODY_Y - 6);
  }
  preview(c, it, x, y, w, h) {
    const L = this.L, g = this.g;
    if (this.form === 'app') R(c, x, y, w, h, '#ffffff'); else frame(c, x, y, w, h, L.rule);
    this.pic(c, it, x + 4, y + 4, w - 8, Math.round((w - 8) * 0.56));
    let yy = y + 8 + Math.round((w - 8) * 0.56);
    let bx = this.chip(c, it, x + 6, yy) + x + 10;
    this.badges(c, it, bx, yy);
    yy += 16;
    yy = para(c, it.head.replace(/^【[^】]*】/, ''), x + 6, yy, w - 12, 14, this.form === 'site' ? L.link : L.ink, 17, 3) + 4;
    T(c, `${it.from}・${it.real ? it.dateText : ago(g, it.day)}`, x + 6, yy, 10, L.dim, 'left', w - 12); yy += 14;
    para(c, it.body || '', x + 6, yy, w - 12, 12, L.ink, 15, Math.max(1, Math.floor((y + h - 22 - yy) / 15)));
    T(c, 'A：記事を読む', x + w - 6, y + h - 14, 10, L.faint, 'right');
  }
  marketBox(c, x, y, w, h) {
    const L = this.L, mk = this.market;
    if (this.form === 'app') R(c, x, y, w, h, '#ffffff'); else frame(c, x, y, w, h, L.rule);
    T(c, '日経平均株価', x + 6, y + 4, 10, L.dim);
    T(c, yen(mk.price), x + 6, y + 18, 18, L.ink);
    T(c, pct(mk.change), x + 6, y + 40, 12, upCol(mk.change));
    spark(c, mk.series, x + 128, y + 6, 96, h - 12, upCol(mk.change));
    mk.stocks.forEach((s, k) => { T(c, s.name, x + 232, y + 4 + k * 16, 10, L.ink, 'left', 74); T(c, `${Math.round(s.price).toLocaleString('ja-JP')}`, x + w - 38, y + 4 + k * 16, 10, L.ink, 'right'); T(c, pct(s.change).replace(/\.\d+%/, '%'), x + w - 4, y + 4 + k * 16, 10, upCol(s.change), 'right'); });
  }
  // ---------------------------------------------------------------- 天気
  drawWeather(c) {
    const L = this.L, g = this.g, W = this.wx;
    if (!W) { this.drawSection(c, { empty: '天気の情報がない。' }); return; }
    // the map of Japan with each region's weather
    const mx = 4, my = BODY_Y + 2, mw = 300, mh = 284;
    R(c, mx, my, mw, mh, this.form === 'paper' ? '#e6dcc4' : '#cfe6f6');
    if (this.form === 'paper') frame(c, mx, my, mw, mh, L.rule);
    T(c, 'きょうの全国の天気', mx + 6, my + 4, 12, L.ink);
    const land = this.form === 'paper' ? '#cbbf9f' : '#9ccc7c', edge = this.form === 'paper' ? '#5d5a52' : '#5a8a4a';
    const P = (pts) => { c.fillStyle = land; c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(mx + a, my + b + 10) : c.moveTo(mx + a, my + b + 10))); c.closePath(); c.fill(); c.strokeStyle = edge; c.lineWidth = 1; c.stroke(); };
    P([[215, 15], [252, 8], [288, 26], [272, 56], [240, 64], [222, 48]]);
    P([[220, 72], [242, 74], [240, 112], [230, 142], [214, 160], [190, 163], [165, 170], [140, 178], [110, 188], [90, 186], [98, 172], [128, 162], [158, 150], [184, 137], [200, 117], [212, 92]]);
    P([[118, 192], [160, 186], [166, 199], [126, 204]]);
    P([[66, 184], [94, 188], [100, 210], [88, 234], [70, 230], [62, 205]]);
    frame(c, mx + 8, my + 214, 62, 52, edge); P([[22, 230], [34, 226], [40, 240], [28, 246]]);
    // city dots (map coordinates as the outlines) and their label boxes, spread so they never overlap
    const POS = { hokkaido: [246, 46, 234, 18], tohoku: [234, 112, 248, 92], tokyo: [216, 158, 244, 142], chubu: [182, 168, 196, 196], osaka: [150, 180, 142, 222], chugoku: [114, 184, 98, 122], shikoku: [142, 204, 88, 234], kyushu: [80, 206, 12, 150], okinawa: [30, 240, 12, 252] };
    for (const r of W.regions) {
      const [cx0, cy0, lx, ly] = POS[r.id] || [0, 0, 0, 0];
      const x = mx + lx, y = my + ly, bw = 52, bh = 30;
      const cx = mx + cx0, cy = my + cy0;
      const ax = clamp(cx, x, x + bw), ay = clamp(cy, y, y + bh);
      const n = Math.max(1, Math.ceil(Math.hypot(ax - cx, ay - cy)));
      for (let k = 0; k <= n; k += 2) R(c, cx + ((ax - cx) * k) / n, cy + ((ay - cy) * k) / n, 1, 1, edge);
      R(c, cx - 1, cy - 1, 3, 3, '#c8102e');
      R(c, x, y, bw, bh, this.form === 'paper' ? 'rgba(241,235,218,0.94)' : 'rgba(255,255,255,0.92)');
      frame(c, x, y, bw, bh, edge);
      safe(() => g.drawWeatherIcon(c, r.kind, x + 2, y + 2, 16, false));
      T(c, r.city, x + 20, y + 2, 10, L.ink, 'left', 31);
      T(c, `${r.high}`, x + 20, y + 15, 10, '#d8303a'); T(c, `/${r.low}`, x + 33, y + 15, 10, '#2a6ac8');
    }
    // today's box + the week (Tokyo and Osaka)
    const rx = 310, rw = 326;
    const t = W.today;
    if (this.form === 'app') R(c, rx, my, rw, 70, '#ffffff'); else frame(c, rx, my, rw, 70, L.rule);
    safe(() => g.drawWeatherIcon(c, t.kind, rx + 8, my + 10, 40, false));
    T(c, `${t.regionName || ''}　${t.label}`, rx + 58, my + 6, 16, L.ink, 'left', rw - 64);
    T(c, `最高 ${t.high}℃`, rx + 58, my + 28, 12, '#d8303a'); T(c, `最低 ${t.low}℃`, rx + 140, my + 28, 12, '#2a6ac8'); T(c, `いま ${t.temp ?? '—'}℃`, rx + 222, my + 28, 12, L.ink);
    const warns = (t.warnings || []).map((x) => (typeof x === 'string' ? x : x && (x.label || x.name))).filter(Boolean);
    T(c, warns.length ? `⚠ ${warns.join('・')}` : (t.pops ? `降水確率 ${t.pops.map((p) => `${p}%`).join(' / ')}` : `降水確率 ${t.pop}%`), rx + 58, my + 46, 12, warns.length ? '#d8303a' : L.dim, 'left', rw - 64);
    const week = (wk, y, title) => {
      T(c, title, rx + 4, y, 12, L.ink);
      wk.slice(0, 7).forEach((d, k) => {
        const x = rx + 4 + k * 46;
        const wd = String(d.weekday || '');
        T(c, `${d.month}/${d.date}`, x + 20, y + 16, 10, /土/.test(wd) ? '#2a6ac8' : /日/.test(wd) ? '#d8303a' : L.dim, 'center');
        safe(() => g.drawWeatherIcon(c, d.kind, x + 12, y + 29, 16, false));
        T(c, `${d.high}/${d.low}`, x + 20, y + 47, 10, L.ink, 'center');
        T(c, `${d.pop}%`, x + 20, y + 59, 10, d.pop >= 50 ? '#2a6ac8' : L.faint, 'center');
      });
    };
    if (W.week.length) week(W.week, my + 76, `週間予報（${W.week[0].regionName || '東京'}）`);
    if (W.osakaWeek.length) week(W.osakaWeek, my + 152, '週間予報（大阪）');
    // the weather news
    const yn = my + 228;
    R(c, rx, yn - 2, rw, 1, L.rule);
    const rows = this.rows.slice(0, 3);
    if (!rows.length) T(c, '気象のニュースはない。', rx + 4, yn + 6, 12, L.dim);
    rows.forEach((it, i) => { const y = yn + i * 19; this.selectable(c, i, rx, y, rw, 18); T(c, `・${it.head}`, rx + 4, y + 3, 12, L.ink, 'left', rw - 50); T(c, ago(g, it.day), rx + rw - 4, y + 4, 10, L.faint, 'right'); });
  }
  // ---------------------------------------------------------------- テレビ欄
  drawTV(c) {
    const L = this.L, g = this.g;
    const year = Math.floor(newsDateNum(g) / 10000);
    const cols = [['nhk', 'NHK'], ['ntv', '日本テレビ'], ['tbs', 'TBS'], ['fujitv', 'フジテレビ'], ['tvasahi', 'テレビ朝日'], ['tvtokyo', 'テレビ東京']];
    const slots = ['19', '20', '21', '22', '23'];
    const x0 = 34, y0 = BODY_Y + 18, cw = (SW - x0 - 6) / cols.length, rh = 52;
    const wd = num(g.weekday, num(g.state.day) % 7);
    const wdName = ['月', '火', '水', '木', '金', '土', '日'][((wd % 7) + 7) % 7];
    R(c, 2, BODY_Y + 2, x0 - 4, 14, '#c8102e'); T(c, `${wdName}`, 16, BODY_Y + 3, 10, '#ffffff', 'center');
    R(c, 0, y0 - 1, SW, 1, L.rule);
    const live = (p) => (p.years || []).some(([a, b]) => a <= year && (b == null || b >= year));
    const GEN = ['ニュース', 'ドラマ', '映画', '歌番組', 'スポーツ中継', 'ドキュメンタリー', 'クイズ番組', '旅番組'];
    const mine = [];
    for (const [id, r] of Object.entries(g.state.regulars || {})) { const def = REGULARS[id]; if (!def || !r || r.dropped || r.since == null || def.medium === 'event') continue; const title = typeof def.title === 'function' ? safe(() => def.title(), '') : def.title; mine.push({ id, title, place: typeof def.place === 'function' ? safe(() => def.place(), '') : def.place, weekday: def.weekday }); }
    cols.forEach(([sid, name], ci) => {
      const x = x0 + ci * cw;
      R(c, x, BODY_Y + 2, cw - 2, 14, this.form === 'paper' ? '#1e1d22' : this.form === 'site' ? '#1a4a9a' : '#3a3e4a');
      T(c, name, x + cw / 2 - 1, BODY_Y + 3, 10, '#ffffff', 'center', cw - 6);
      const progs = PG && PG.PROGRAM_LIST ? PG.PROGRAM_LIST.filter((p) => p.station === sid && live(p) && !p.special) : [];
      const pick = progs.slice().sort((a, b) => ((seedOf(a.id + num(g.state.day)) % 13) - (seedOf(b.id + num(g.state.day)) % 13)));
      slots.forEach((s, ri) => {
        const y = y0 + ri * rh;
        if (ci === 0) { R(c, 2, y, x0 - 4, rh - 2, this.form === 'paper' ? '#e2d8c0' : '#dfe6f2'); T(c, s, 16, y + 4, 14, L.ink, 'center'); T(c, '時', 16, y + 22, 10, L.dim, 'center'); }
        const me = mine.find((m) => m.place === sid && m.weekday === wd) && ri === 2 ? mine.find((m) => m.place === sid && m.weekday === wd) : null;
        const p = pick[ri];
        const title = me ? me.title : p ? p.title : GEN[(seedOf(sid + s + num(g.state.day)) + ri) % GEN.length];
        const sub = me ? '★あなたが出演' : p ? p.genre : '';
        if (me) R(c, x, y, cw - 2, rh - 2, '#ffe7a0');
        frame(c, x, y, cw - 2, rh - 2, L.rule);
        para(c, title, x + 3, y + 3, cw - 8, 10, me ? '#7a3a00' : L.ink, 12, sub ? 2 : 3);
        if (sub) T(c, sub, x + 3, y + rh - 15, 10, me ? '#c03a00' : L.dim, 'left', cw - 8);
      });
    });
    const held = mine.filter((m) => !(cols.some(([sid]) => sid === m.place) && m.weekday === wd));
    if (held.length) T(c, `あなたの番組：${held.slice(0, 3).map((m) => `『${m.title}』`).join('')}`, 6, FOOT_Y - 13, 10, L.dim, 'left', 620);
  }
  // ---------------------------------------------------------------- 検索
  drawFind(c) {
    const L = this.L;
    const y = BODY_Y + 2;
    T(c, 'さがす：', 6, y + 3, 12, L.ink);
    let x = 56;
    const chips = [...FIND_CHIPS, null];
    chips.forEach((lab, i) => {
      const s = lab == null ? '✎ ことばで' : lab;
      const w = Math.ceil(measure(c, s, 12)) + 14;
      const on = this.q === lab || (lab == null && this.q && !FIND_CHIPS.includes(this.q));
      const cur = (this.chipIdx | 0) === i && this.focus === 'body' && (this.findFocus || !this.rows.length);
      R(c, x, y, w, 18, on ? '#4a4a5a' : this.form === 'paper' ? '#e6dcc4' : '#ffffff');
      frame(c, x, y, w, 18, cur ? '#ffb547' : L.rule);
      if (cur) frame(c, x - 1, y - 1, w + 2, 20, '#ffb547');
      T(c, s, x + w / 2, y + 3, 12, on ? '#ffffff' : L.ink, 'center');
      this.hit(x, y, w, 18, () => { this.chipIdx = i; this.findChip(i); });
      x += w + 4;
    });
    this.drawResults(c, y + 24);
  }
  drawResults(c, y0) {
    const L = this.L, g = this.g;
    if (!this.q) { para(c, '話題のことばを選ぶか、「ことばで」から自由に入力して、これまでのニュースをさがせる。「あなた」で、あなたが出た記事だけを集める。', 20, y0 + 30, 600, 12, L.dim, 16, 4); return; }
    if (!this.rows.length) { T(c, `「${this.q}」の記事は見つからなかった。`, SW / 2, y0 + 40, 14, L.dim, 'center'); return; }
    const rows = this.rows, rh = 46, lw = 392;
    const vis = Math.floor((FOOT_Y - 4 - y0) / rh);
    const s = this.sel.find | 0;
    let top = this.top.find | 0;
    if (s < top) top = s; if (s >= top + vis) top = s - vis + 1;
    this.top.find = top;
    for (let i = top; i < Math.min(rows.length, top + vis); i++) {
      const it = rows[i], y = y0 + (i - top) * rh;
      if (this.form === 'app') R(c, 4, y + 1, lw - 4, rh - 3, '#ffffff');
      this.selectable(c, i, 4, y, lw - 4, rh - 2);
      this.pic(c, it, 8, y + 4, 60, 37);
      let bx = 74 + this.chip(c, it, 74, y + 3) + 4;
      this.badges(c, it, bx, y + 3);
      T(c, `${it.real ? it.dateText : ago(g, it.day)}`, lw - 6, y + 4, 10, L.faint, 'right');
      para(c, it.head.replace(/^【[^】]*】/, ''), 74, y + 17, lw - 84, 12, L.ink, 14, 2);
      if (this.form !== 'app') R(c, 6, y + rh - 2, lw - 8, 1, L.rule);
    }
    const it = rows[s];
    if (it) this.preview(c, it, 398, y0, 238, FOOT_Y - y0 - 4);
  }
  // ---------------------------------------------------------------- the article and the 号外
  drawArticle(c, it) {
    const L = this.L, g = this.g;
    const x = 20, y = BODY_Y - 2, w = 600, h = FOOT_Y - y - 6;
    R(c, 0, BODY_Y - 4, SW, FOOT_Y - BODY_Y + 4, 'rgba(0,0,0,0.35)');
    R(c, x, y, w, h, this.form === 'paper' ? '#f6f0e0' : '#ffffff');
    frame(c, x, y, w, h, this.form === 'paper' ? L.rule : this.form === 'site' ? '#1a4a9a' : '#e8323c');
    this.hit(x, y, w, h, () => { this.article = null; sfx('cancel'); this.refresh(true); });
    this.pic(c, it, x + 10, y + 10, 256, 160);
    T(c, `写真：${(SEC[it.cat] || SEC.soc).label}`, x + 10, y + 174, 10, L.faint);
    let bx = this.chip(c, it, x + 276, y + 10) + x + 280;
    bx = this.badges(c, it, bx, y + 10);
    T(c, it.real ? it.dateText : (has(g, 'dateFull') ? safe(() => g.dateFull(it.day), '') : `${it.day}日目`) || `${it.day}日目`, x + w - 10, y + 10, 10, L.dim, 'right', 200);
    let yy = para(c, it.head.replace(/^【[^】]*】/, ''), x + 276, y + 28, w - 286, 18, L.ink, 22, 4) + 4;
    T(c, it.from, x + 276, yy, 10, L.dim, 'left', w - 286); yy += 16;
    R(c, x + 276, yy, w - 286, 1, L.rule); yy += 6;
    const body = it.body && it.body.replace(/\s/g, '') !== it.head.replace(/\s/g, '') ? it.body : `${it.head}\n\n${it.real ? '' : '続報が入りしだい、お伝えします。'}`;
    para(c, body, x + 276, yy, w - 286, 12, L.ink, 16, Math.max(2, Math.floor((y + h - 30 - yy) / 16)));
    if (it.mine) { R(c, x + 10, y + h - 46, 256, 20, '#fff2c8'); T(c, 'あなたのことが記事になっている', x + 16, y + h - 42, 12, '#8a5a00', 'left', 244); }
    T(c, `${(this.sel[this.tabId] | 0) + 1}／${this.rows.length}`, x + w - 10, y + h - 16, 10, L.faint, 'right');
  }
  drawGogai(c, it) {
    const x = 40, y = 30, w = 560, h = 300;
    R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.55)');
    const t = this.t;
    const k = Math.min(1, t / 14);
    const dy = Math.round((1 - k) * 60);
    R(c, x, y + dy, w, h, '#f8f4e8');
    for (let i = 0; i < 4; i++) frame(c, x + i, y + dy + i, w - i * 2, h - i * 2, '#c8102e');
    R(c, x + w - 72, y + dy + 10, 60, 120, '#c8102e');
    vtext(c, '号外', x + w - 42, y + dy + 22, 34, '#ffffff', 2);
    T(c, `ドット新聞　${this.dateLine()}`, x + 14, y + dy + 12, 12, '#3a3a3a', 'left', 400);
    const head = it.head.replace(/^【[^】]*】/, '');
    para(c, head, x + 14, y + dy + 32, w - 100, 26, '#111111', 32, 3);
    drawNewsImage(c, it.img, x + 14, y + dy + 140, 240, 146, { mono: this.form === 'paper', seed: seedOf(it.key), gengo: it.gengo });
    para(c, it.body || '', x + 266, y + dy + 144, w - 280, 12, '#222222', 16, 7);
    if (t % 60 < 40) T(c, 'A：一面へ', x + w - 14, y + dy + h - 22, 12, '#c8102e', 'right');
    this.hit(x, y, w, h, () => { newsGogaiSeen(this.g, this.gogai); this.gogai = null; sfx('ok'); this.refresh(true); });
  }
}
function spark(c, s, x, y, w, h, col) {
  const v = (s || []).filter(Number.isFinite);
  if (v.length < 2) return;
  const mn = Math.min(...v), mx = Math.max(...v), rg = Math.max(1e-6, mx - mn);
  let prev = null;
  v.forEach((p, i) => {
    const px = x + (i * (w - 1)) / (v.length - 1), py = y + h - 1 - ((p - mn) / rg) * (h - 1);
    if (prev) { const n = Math.max(1, Math.ceil(Math.abs(px - prev[0]) + Math.abs(py - prev[1]))); for (let k = 0; k <= n; k++) R(c, prev[0] + ((px - prev[0]) * k) / n, prev[1] + ((py - prev[1]) * k) / n, 1, 1, col); }
    prev = [px, py];
  });
}

// ================================================================ open
export async function openNewsScreen(g, opts = {}) {
  if (!g || !g.state) return null;
  if (g.auto && !g.auto.newsui) return null;
  const open = sceneOf(g);
  if (open) return null;
  sfx('ok');
  return new Promise((resolve) => { const sc = new NewsScene(g, opts, resolve); g.push(sc); });
}
Game.prototype.newsScreen = function newsScreen(tab, opts = {}) { return openNewsScreen(this, { ...opts, tab }); };
if (typeof window !== 'undefined') window.__newsui = { scene: () => sceneOf(window.__game), open: openNewsScreen, TABS, WX_REGIONS };
