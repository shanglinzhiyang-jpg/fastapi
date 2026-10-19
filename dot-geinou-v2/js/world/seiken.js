// 政権交代・総辞職の場面 (agent A1, with js/engine/govt.js).
// When a cabinet resigns (総辞職) or a new PM is named (首班指名 → 官邸の引き継ぎ → 組閣 → 記者会見), a short, neutral
// scene plays after the night (the player is involved: full scene; otherwise a short TV news version). Everyone shown
// is fictional (the politics core's generated NPCs); real parties appear only by name, with no judgement.
// Also a short demo scene (g.demoScene) for a demo the player joins or watches.
//
// API (Game.prototype): g.seikenScene(id?) -> Promise (replay one record of g.seikenLog(); default: the newest),
//   g.seikenFlush() -> Promise (play the queued records now), g.demoScene(demoId, role?) -> Promise.
// Queue: g.state.govt.seiken.queue (ids, filled by govt.js on 'resign' / 'cabinet'); settings.scenes 'auto'|'all'|'off'.
// Facts: the 首相官邸 in use since 2002 (kantei.js; the old building from 1929 before that); 内閣総理大臣は国会議員の中から
// 国会の議決で指名（憲法67条）; 総辞職した内閣は新しい総理が任命されるまで職務を行う（71条）; 親任式・認証式は皇居で行われる
// (not depicted). The 衆議院本会議場 seats in a semicircle facing the 議長席.

import { Game } from '../engine/game.js';
import { SW, SH } from '../engine/util.js';
import { text, measure, panel, COLORS } from '../engine/draw.js';
import { charSheetHD, LOOKS } from '../engine/sprites.js';

const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function fig(c, look, x, y, dir = 'down', s = 2) {
  try {
    const sh = charSheetHD(look || {});
    const img = (sh[dir] && sh[dir][0]) || sh.down[0];
    c.drawImage(img, Math.round(x), Math.round(y), 32 * s, 40 * s);
  } catch (e) { /* sprites optional */ }
}
const polOf = (g) => (g && g.state && g.state.politics) || null;
function lookOf(g, id) {
  if (id === 'player') return (g.state && g.state.look) || LOOKS.player;
  const p = polOf(g);
  const n = p && p.npcs && p.npcs[id];
  return (n && n.look) || LOOKS.salaryman;
}
function yearOf(g) { try { return typeof g.polDate === 'function' ? g.polDate().year : 2026; } catch (e) { return 2026; } }
function partyLong(g, id) { try { return typeof g.partyName === 'function' ? g.partyName(id, false) : id; } catch (e) { return id || ''; } }
const SUITS = [{ ...LOOKS.salaryman, top: '#2a2f45' }, { ...LOOKS.salaryman, top: '#3a3f55', hair: 'slick' }, { ...LOOKS.salaryman, top: '#4a4a52', hairColor: 'gray' }, { ...(LOOKS.announcer || LOOKS.salaryman) }];

// ---------------------------------------------------------------- backdrops (640x360 HD)
// fixed pseudo-random spots for crowds and seats (the same every frame)
function spots(n, seed, x0, x1, y0, y1) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: x0 + r() * (x1 - x0), y: y0 + r() * (y1 - y0), k: Math.floor(r() * 6), sign: r() < 0.22 });
  return out.sort((p, q) => p.y - q.y);
}
const CROWD = spots(46, 7, 0, SW - 32, 196, 320);
const CROWD_LOOKS = () => [LOOKS.salaryman, LOOKS.mom || LOOKS.salaryman, LOOKS.tourist || LOOKS.salaryman, LOOKS.fan || LOOKS.salaryman, LOOKS.oldman || LOOKS.salaryman, LOOKS.oldwoman || LOOKS.salaryman];
const MEMBER_LOOKS = () => [{ ...LOOKS.salaryman, top: '#2a2f45' }, { ...LOOKS.salaryman, top: '#3a3f55', hair: 'slick', hairColor: 'gray' }, { ...LOOKS.salaryman, top: '#1f2a3a', hairColor: 'white' }, { ...(LOOKS.mom || LOOKS.salaryman), top: '#5a3a5a' }];
const STAGES = {
  // 衆議院本会議場: the 議長席, the 演壇 and members in a semicircle of seats
  honkaigi(c, t) {
    R(c, 0, 0, SW, SH, '#5a3a24');
    R(c, 0, 0, SW, 70, '#3e2816');
    for (let x = 20; x < SW; x += 60) R(c, x, 0, 4, 70, '#6a4a2c');
    R(c, SW / 2 - 120, 70, 240, 46, '#7a5232'); R(c, SW / 2 - 120, 70, 240, 6, '#a07048');
    fig(c, MEMBER_LOOKS()[2], SW / 2 - 16, 40, 'down', 1);
    R(c, SW / 2 - 50, 116, 100, 26, '#8a6040'); R(c, SW / 2 - 50, 116, 100, 4, '#b08060');
    const L = MEMBER_LOOKS();
    for (let row = 0; row < 4; row++) {
      const y = 170 + row * 46;
      const w = 360 + row * 70;
      R(c, SW / 2 - w / 2, y + 26, w, 14, '#3a2414');
      for (let i = 0, x = SW / 2 - w / 2 + 4; x < SW / 2 + w / 2 - 28; x += 30, i++) fig(c, L[(i + row) % L.length], x, y - 6, 'up', 1);
    }
    if (t % 60 < 30) R(c, SW / 2 - 4, 124, 8, 4, '#ffd23f');
  },
  // 首相官邸 (the building used from 2002; the old one before)
  kantei(c, t, g) {
    const y = yearOf(g);
    R(c, 0, 0, SW, SH, '#9ccbe8');
    R(c, 0, 220, SW, SH - 220, '#8a8a80');
    if (y >= 2002) {
      R(c, 120, 70, 400, 150, '#c8d0d8');
      for (let x = 130; x < 510; x += 24) R(c, x, 80, 16, 130, '#7aa0c0');
      R(c, 100, 60, 440, 12, '#e8ecf0');
      R(c, 290, 160, 60, 60, '#5a6a7a');
    } else {
      R(c, 140, 90, 360, 130, '#c8b490');
      for (let x = 160; x < 480; x += 30) R(c, x, 110, 14, 30, '#6a5a40');
      R(c, 280, 60, 80, 34, '#b8a480'); R(c, 290, 160, 60, 60, '#5a4a3a');
    }
    R(c, 0, 206, SW, 16, '#3a6a3a');
    for (let x = 6; x < SW; x += 24) R(c, x, 200, 16, 8, '#4a7a4a');
    R(c, 0, 230, SW, 4, '#6a6a60');
    for (const [x, d] of [[40, 'right'], [86, 'right'], [520, 'left'], [566, 'left']]) { fig(c, LOOKS.cameraman || LOOKS.salaryman, x, 250, d, 1.5); }
  },
  // 閣議室: the round table and the ministers
  kakugi(c) {
    R(c, 0, 0, SW, SH, '#d8ccb0');
    R(c, 0, 0, SW, 40, '#b8a888');
    for (let x = 40; x < SW; x += 140) { R(c, x, 50, 80, 50, '#e8e0cc'); R(c, x + 4, 54, 72, 42, '#c8d8e0'); }
    const L = MEMBER_LOOKS();
    for (let i = 0; i < 8; i++) fig(c, L[i % L.length], 138 + i * 48, 92, 'down', 1);
    R(c, 120, 140, 400, 120, '#6a4426'); R(c, 120, 140, 400, 8, '#8a5a36');
    for (let i = 0; i < 8; i++) R(c, 150 + i * 48, 150, 18, 10, '#f0ece0');
    for (let i = 0; i < 8; i++) fig(c, L[(i + 2) % L.length], 138 + i * 48, 250, 'up', 1);
  },
  // 記者会見室: the podium, the blue curtain, cameras
  kaiken(c, t) {
    R(c, 0, 0, SW, SH, '#20304a');
    R(c, 160, 20, 320, 200, '#2a4a7a');
    for (let x = 170; x < 470; x += 20) R(c, x, 20, 3, 200, '#24426e');
    R(c, 270, 170, 100, 70, '#6a4a2c'); R(c, 270, 170, 100, 6, '#8a6a44');
    R(c, 300, 160, 40, 6, '#c0c0c0');
    R(c, 0, 250, SW, SH - 250, '#1a1a24');
    const L = MEMBER_LOOKS();
    for (let i = 0; i < 9; i++) fig(c, L[i % L.length], 20 + i * 70, 290, 'up', 1);
    for (let x = 30; x < SW; x += 90) { R(c, x, 262, 50, 30, '#333'); R(c, x + 40, 270, 18, 14, '#555'); }
    if (t % 50 < 3) R(c, 40 + (t * 37) % 520, 262, 30, 30, '#ffffff');
  },
  // the stairs where a new cabinet poses (記念撮影)
  hinadan(c) {
    R(c, 0, 0, SW, SH, '#d8d4c8');
    for (let x = 30; x < SW; x += 120) { R(c, x, 20, 70, 80, '#e8e4d8'); R(c, x + 6, 26, 58, 68, '#bcd0dc'); }
    for (let i = 0; i < 5; i++) { R(c, 60 + i * 20, 120 + i * 40, SW - 120 - i * 40, 40, i % 2 ? '#a02828' : '#b03030'); R(c, 60 + i * 20, 120 + i * 40, SW - 120 - i * 40, 3, '#d05050'); }
    R(c, 0, 320, SW, 40, '#8a8a80');
  },
  // a TV at home (the era's set) with the news
  tv(c, t, g) {
    const y = yearOf(g);
    R(c, 0, 0, SW, SH, '#3a3026');
    R(c, 0, 250, SW, SH - 250, '#5a4a36');
    const crt = y < 2008;
    const x0 = crt ? 190 : 140, y0 = crt ? 66 : 50, w0 = crt ? 220 : 360, h0 = crt ? 170 : 200;
    if (crt) { R(c, 170, 50, 300, 220, '#2a2a2a'); R(c, 420, 80, 30, 120, '#444'); } else R(c, 130, 40, 380, 220, '#111');
    R(c, x0, y0, w0, h0, '#1a3a5a');
    R(c, x0, y0, w0, 40, '#24507a');
    R(c, x0 + w0 - 90, y0 + 40, 80, 50, '#e0dccc'); R(c, x0 + w0 - 62, y0 + 22, 24, 20, '#d8d0bc');
    fig(c, LOOKS.announcer || LOOKS.salaryman, x0 + 26, y0 + 40, 'down', 2);
    R(c, x0, y0 + h0 - 36, w0, 22, '#c03030');
    text(c, 'ニュース速報', x0 + 8, y0 + h0 - 33, { size: 12, color: '#ffffff' });
    if (t % 40 < 20) R(c, x0 + w0 - 16, y0 + h0 - 30, 8, 8, '#ffd23f');
  },
  // a demo (crowd, placards) in front of a building; police keep the traffic moving
  demo(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#a8c8e0');
    const place = o.place || '';
    if (/国会/.test(place)) { R(c, 200, 60, 240, 120, '#e0dccc'); R(c, 280, 26, 80, 40, '#d8d0bc'); R(c, 300, 10, 40, 18, '#ccc4ae'); for (let x = 214; x < 430; x += 24) R(c, x, 100, 10, 60, '#c8c0aa'); }
    else if (/官邸/.test(place)) { R(c, 160, 70, 320, 110, '#c8d0d8'); for (let x = 170; x < 470; x += 22) R(c, x, 80, 14, 90, '#7aa0c0'); }
    else if (/公園/.test(place)) { for (let x = 20; x < SW; x += 70) { R(c, x, 100, 40, 70, '#3a7a3a'); R(c, x + 16, 170, 8, 14, '#5a3a24'); } }
    else { R(c, 140, 70, 360, 110, '#b8b0a0'); R(c, 280, 120, 80, 60, '#5a5a5a'); R(c, 150, 80, 120, 20, '#3a5a8a'); }
    R(c, 0, 180, SW, SH - 180, '#8a8a80');
    const L = CROWD_LOOKS();
    const word = String(o.sign || '').slice(0, 4);
    for (const [i, p] of CROWD.entries()) {
      const bob = Math.round(Math.sin((t + i * 7) / 12) * 2);
      if (p.sign) { R(c, p.x + 2, p.y - 22 + bob, 28, 16, '#f8f4e8'); R(c, p.x + 15, p.y - 6 + bob, 2, 10, '#6a4a2c'); if (word) text(c, word.slice(0, 2), p.x + 4, p.y - 21 + bob, { size: 12, color: '#a02828' }); }
      fig(c, L[p.k % L.length], p.x, p.y + bob, 'up', 1);
    }
    fig(c, LOOKS.guard || LOOKS.salaryman, 10, 300, 'right', 1.2);
    fig(c, LOOKS.guard || LOOKS.salaryman, SW - 50, 300, 'left', 1.2);
  },
};
class SeikenScene {
  constructor(g, kind, opts = {}) { Object.assign(this, { g, kind, opts, t: 0, hd: true, opaque: true, hidesHud: true }); }
  update() { this.t++; }
  draw(ctx, g) {
    try { (STAGES[this.kind] || STAGES.kantei)(ctx, this.t, g, this.opts); } catch (e) { console.error(e); }
    for (const f of this.opts.figs || []) fig(ctx, f.look, f.x, f.y, f.dir || 'down', f.s || 2);
    const title = this.opts.title;
    if (title) {
      const sub = this.opts.sub || '';
      const w = Math.min(SW - 24, Math.max(measure(ctx, title, 16), measure(ctx, sub, 12)) + 28);
      panel(ctx, 8, 8, w, sub ? 50 : 32, { bg: '#1a1f38' });
      text(ctx, title, 22, 15, { size: 16, color: COLORS.accent });
      if (sub) text(ctx, sub, 22, 36, { size: 12, color: '#d8dcf0' });
    }
    const note = 'シミュレーション・登場人物は架空';
    const w2 = measure(ctx, note, 12) + 16;
    panel(ctx, SW - w2 - 8, 8, w2, 24, { bg: '#1a1f38' });
    text(ctx, note, SW - w2, 13, { size: 12, color: '#9aa3c8' });
  }
}
function stage(g) {
  const sc = new SeikenScene(g, 'kantei', {});
  g.push(sc);
  return {
    set(kind, opts = {}) { sc.kind = kind; sc.opts = opts; sc.t = 0; return this; },
    close() { g.pop(sc); },
  };
}
const say = (g, lines, who) => g.say(lines, who ? { name: who } : {});

// ---------------------------------------------------------------- the scenes
function ministersLines(g, to, max = 3) {
  const list = (to.ministers || []).filter((m) => m.post !== 'pm');
  const mine = list.find((m) => m.who === 'player');
  const pick = [list.find((m) => m.post === 'kanbo'), mine, list.find((m) => m.post === 'minister_finance'), list.find((m) => m.post === 'minister_foreign')].filter((m, i, a) => m && a.indexOf(m) === i).slice(0, max);
  return pick.map((m) => `${m.title}　${m.who === 'player' ? `${g.state.name}（あなた）` : m.name}`);
}
async function playNew(g, rec, full) {
  const to = rec.to || {};
  const from = rec.from || {};
  const kotai = rec.kind === 'kotai';
  const S = stage(g);
  try {
    if (!full) {
      S.set('tv', { title: kotai ? '政権交代' : '新しい総理大臣', sub: rec.date });
      await say(g, [
        `「ニュース速報です。国会で首班指名選挙が行われ、${to.pmName}氏が第${to.pmNo}代の内閣総理大臣に指名されました」`,
        kotai ? `「${partyLong(g, from.core)}を中心とする政権から、${partyLong(g, to.core)}を中心とする政権への政権交代です」` : `「${partyLong(g, to.core)}を中心とする政権が続きます」`,
        '「今夜にも組閣を終え、新しい内閣が発足する見通しです」',
      ], 'アナウンサー');
      return;
    }
    // the player's own 首班指名 is shown by the politics screens (pmCeremony); here the rest of the day
    if (to.pm !== 'player') S.set('honkaigi', { title: '首班指名', sub: rec.date });
    if (to.pm !== 'player') await say(g, [
      '衆議院と参議院の本会議で、内閣総理大臣の指名選挙が行われた（憲法67条）。',
      `${to.pmName}${to.pm === 'player' ? '（あなた）' : '氏'}が、第${to.pmNo}代 内閣総理大臣に指名された。`,
      ...(kotai ? [`${partyLong(g, from.core)}を中心とする政権から、${partyLong(g, to.core)}を中心とする政権へ。「政権交代」だ。`] : []),
    ]);
    if (from.pmName && from.pm !== to.pm) {
      S.set('kantei', { title: '官邸の引き継ぎ', sub: '首相官邸', figs: [{ look: lookOf(g, from.pm), x: SW / 2 - 90, y: 200, dir: 'right' }, { look: lookOf(g, to.pm), x: SW / 2 + 26, y: 200, dir: 'left' }] });
      await say(g, [`${from.pmName}前総理から${to.pmName}${to.pm === 'player' ? '' : '新総理'}へ。官邸で事務の引き継ぎが行われた。`, '危機管理や外交など、止められない仕事も、そのまま新しい内閣へ。']);
    }
    S.set('kakugi', { title: '組閣', sub: '閣僚の名簿の発表' });
    const ml = ministersLines(g, to);
    await say(g, ['新しい官房長官が、閣僚の名簿を読み上げた。', ...(ml.length ? [ml.join('\n')] : []), '皇居での親任式・認証式を経て、新しい内閣が正式に発足した。']);
    const row = (to.ministers || []).filter((m) => m.post !== 'pm').slice(0, 9);
    const top = row.slice(0, 5).map((m, i) => ({ look: lookOf(g, m.who), x: 104 + i * 92, y: 98, s: 1.5 }));
    const low = row.slice(5, 9).map((m, i) => ({ look: lookOf(g, m.who), x: [130, 210, 382, 462][i], y: 172, s: 1.5 }));
    S.set('hinadan', { title: '記念撮影', sub: '官邸の階段', figs: [...top, ...low, { look: lookOf(g, to.pm), x: SW / 2 - 32, y: 166, s: 2 }] });
    await say(g, ['新しい閣僚がそろって、官邸の階段で記念撮影。']);
    S.set('kaiken', { title: '総理大臣 記者会見', sub: '就任会見', figs: [{ look: lookOf(g, to.pm), x: SW / 2 - 32, y: 90 }] });
    if (to.pm === 'player') {
      const i = await g.ask('「就任にあたって、国民の皆さんにひと言お願いします」', ['暮らしの不安に一つずつ応えると語る', '改革をやりとげると語る', '短く「全力で」とだけ言う'], { name: '記者', cancel: 2 });
      await say(g, [['暮らしの不安に一つひとつ応える政治をする、と語った。', 'しがらみをこえて改革をやりとげる、と語った。', '「全力でやります」…会見はあっさり終わった。'][i] || '会見を終えた。']);
      try { const p = polOf(g); if (p && p.me && i < 2) p.me.reputation = Math.min(100, num(p.me.reputation) + 1); } catch (e) { /* */ }
    } else {
      await say(g, [`「国民の皆さまの声に耳を傾け、暮らしの不安に一つひとつ応えてまいります」`, kotai ? '「政権が変わっても、国の仕事は一日も止めません」' : '「前の内閣の取り組みを引き継ぎ、前へ進めます」'], `${to.pmName}総理`);
      if (rec.playerRole === 'minister') await say(g, ['（あなたも新しい内閣の一員だ）']);
    }
  } finally { S.close(); }
}
// The player's own step-down at the end of the もしも emergency / dictatorship (regime.js: 民主化 or a lawful removal; the
// former PM is then barred from office and may face an investigation): { detained, charged } | null.
function regimeExit(g, rec) {
  if (!rec || !rec.from || rec.from.pm !== 'player') return null;
  const r = g.state && g.state.regime;
  const b = r && r.barred;
  const near = b && Math.abs(num(b.day) - num(rec.day)) <= 1;
  if (!near && !/民主化/.test(String(rec.reason || ''))) return null;
  const detained = Math.max(num(r && r.record && r.record.detained), num(r && r.press && r.press.detained));
  return { detained, charged: !!(b && b.charged) };
}
async function playResign(g, rec, full) {
  const from = rec.from || {};
  const S = stage(g);
  try {
    if (!full) {
      S.set('tv', { title: '内閣総辞職', sub: rec.date });
      await say(g, [`「${from.pmName}内閣は、きょうの臨時閣議で総辞職を決めました${rec.reason ? `（${rec.reason}）` : ''}」`, '「国会で新しい総理大臣が指名されるまで、いまの内閣が職務を続けます」'], 'アナウンサー');
      return;
    }
    S.set('kakugi', { title: '臨時閣議', sub: '内閣総辞職' });
    await say(g, [`臨時閣議が開かれ、閣僚全員が辞表を提出した。${from.pmName}${from.pm === 'player' ? '（あなた）' : ''}内閣の総辞職だ${rec.reason ? `（${rec.reason}）` : ''}。`, '新しい総理大臣が任命されるまで、内閣はそのまま職務を続ける（憲法71条）。']);
    const exit = regimeExit(g, rec);
    if (exit) {
      // (2026-10 fix) the step-down after the もしも emergency / dictatorship: no friendly farewell — the questions are
      // about what was done under the emergency, and the investigation to come
      S.set('kaiken', { title: '退陣の記者会見', sub: '緊急事態のあとで（もしも）', figs: [{ look: lookOf(g, from.pm), x: SW / 2 - 32, y: 90 }] });
      await say(g, ['会見場は、張りつめた空気に包まれていた。', exit.detained ? `記者席には、拘束されていた記者の同僚たちも並んでいる（拘束された記者は${exit.detained.toLocaleString('ja-JP')}人にのぼった）。` : '緊急事態のもとで何が行われたのか、説明を求める質問が続いた。']);
      const i = await g.ask('「緊急事態のもとでの行為について、説明してください」', ['謝罪し、捜査に協力すると述べる', '説明を拒む'], { name: '記者', cancel: 1 });
      const p = polOf(g);
      if (i === 0) {
        await say(g, ['「国民の皆さまの自由と権利を損なったことを、深くおわびします。捜査には全面的に協力します」', '深く頭を下げ、しばらく顔を上げなかった。']);
        try { if (p && p.me) p.me.reputation = Math.min(100, num(p.me.reputation) + 2); } catch (e) { /* */ }
      } else {
        await say(g, ['「お答えは差し控えます」', '会見は打ち切られた。記者たちの抗議の声が、背中に響いた。']);
        try { if (p && p.me) p.me.reputation = Math.max(-100, num(p.me.reputation) - 5); } catch (e) { /* */ }
      }
      if (exit.charged) await say(g, ['検察が、緊急事態のもとでの職権の濫用について捜査を始めると伝えられている。']);
    } else S.set('kaiken', { title: '退陣の記者会見', figs: [{ look: lookOf(g, from.pm), x: SW / 2 - 32, y: 90 }] });
    if (exit) { /* done above */ } else if (from.pm === 'player') {
      const i = await g.ask('「退陣にあたって、ひと言お願いします」', ['支えてくれた人に感謝を述べる', '道半ばの課題を次に託すと述べる', '多くは語らない'], { name: '記者', cancel: 2 });
      await say(g, [['支えてくれた国民と仲間たちに、深く頭を下げた。', 'やり残した課題を挙げ、次の内閣に託した。', '「以上です」とだけ述べて、会見場をあとにした。'][i] || '会見を終えた。']);
    } else {
      await say(g, ['「国民の皆さまに、心から感謝申し上げます」', '「残された課題は、次の内閣に託したいと思います」'], `${from.pmName}総理`);
    }
  } finally { S.close(); }
}
function involvedIn(g) {
  const p = polOf(g);
  const me = p && p.me;
  return !!(me && (me.office || me.party || me.formerOffice || (me.posts && me.posts.length)));
}
async function playRecord(g, rec) {
  if (!rec) return;
  const full = rec.playerRole && rec.playerRole !== 'none' ? true : involvedIn(g);
  if (rec.kind === 'resign') await playResign(g, rec, full);
  else if (rec.kind === 'kotai' || rec.kind === 'shuhan' || rec.kind === 'saishimei') await playNew(g, rec, full);
  rec.seen = g.state.day;
}
async function drain(g) {
  if (!g || !g.state || typeof g.govt !== 'function') return;
  const s = g.govt();
  if (!s || !s.seiken || !Array.isArray(s.seiken.queue) || !s.seiken.queue.length) return;
  const skip = (g.auto && !g.auto.seiken) || s.settings.scenes === 'off' || (typeof g.isFree === 'function' && !g.isFree());
  const ids = s.seiken.queue.splice(0);
  if (skip) return;
  for (const id of ids.slice(-2)) {
    const rec = s.seiken.log.find((x) => x.id === id);
    try { await playRecord(g, rec); } catch (e) { console.error(e); }
  }
}
async function playDemo(g, demo, role) {
  if (!demo) return;
  const S = stage(g);
  try {
    S.set('demo', { title: demo.stance === 'rally' ? '集会' : 'デモ', sub: demo.place, place: demo.place, sign: demo.stance === 'rally' ? '応援' : '反対', figs: role ? [{ look: (g.state && g.state.look) || LOOKS.player, x: SW / 2 - 32, y: 168, dir: role === 'speaker' ? 'down' : 'up' }] : [] });
    const lines = [`${demo.place}。${/^「/.test(demo.cause) ? demo.cause : `「${demo.cause}」`}に、約${num(demo.size).toLocaleString('ja-JP')}人が集まっている（主催：${demo.organiser}）。`];
    if (role === 'speaker') lines.push('マイクを握り、自分の言葉で思いを語った。拍手と、静かに見守る人たち。');
    else if (role) lines.push('プラカードを手に、列に加わった。');
    lines.push('警察が交通整理をする中、平和的に行われている（憲法21条：集会・表現の自由）。');
    await say(g, lines);
  } finally { S.close(); }
}

// ---------------------------------------------------------------- hooks and API
{
  const sleep0 = Game.prototype.sleep;
  if (typeof sleep0 === 'function' && !sleep0.__seiken) {
    const w = async function sleepWithSeiken(opts = {}) {
      const r = await sleep0.call(this, opts);
      try { await drain(this); } catch (e) { console.error(e); }
      return r;
    };
    w.__seiken = true;
    Game.prototype.sleep = w;
  }
}
Game.prototype.seikenScene = function seikenScene(id) {
  if (typeof this.govt !== 'function') return Promise.resolve(null);
  const s = this.govt();
  const rec = id ? s.seiken.log.find((x) => x.id === id) : s.seiken.log[0];
  return playRecord(this, rec).then(() => rec || null);
};
Game.prototype.seikenFlush = function seikenFlush() { return drain(this); };
Game.prototype.demoScene = function demoScene(id, role = null) {
  if (typeof this.govt !== 'function') return Promise.resolve(null);
  const d = this.govt().demos.list.find((x) => x.id === id);
  return playDemo(this, d, role).then(() => d || null);
};
export const SEIKEN = { STAGES, Scene: SeikenScene, playRecord, playDemo, drain };
if (typeof window !== 'undefined') window.__seiken = SEIKEN;
