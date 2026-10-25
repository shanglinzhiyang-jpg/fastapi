// 賞レースの会場 (owner: D1) — place 'shourace': rooms lobby (受付・掲示板), gakuya (楽屋: 相方とネタ合わせ・出囃子確認・鏡・
// ほかの出場者), sode (舞台袖: 出番待ち・緊張メーター・深呼吸), stage (劇場: 客席とお客さん・センターマイク・予選の審査員席),
// studio (テレビ決勝のセット: センターマイク・審査員席・スコアボード・カメラ), outdoor (屋外特設ステージ: 敗者復活戦など).
// Not on any town map (no building door): reached only through the contests (g.contestGo / 「賞レース」 app). The signage
// (横断幕・LEDビジョン・看板) and colours follow g.contestVenue() (set by contests.js / any contest flow before g.goto);
// without a contest the hall shows a generic 「お笑い賞レース会場」. The exits return the player where they came from
// (contests.js keeps it in state.contests.ret), else home. Every person here is fictional.

import { registerPlace } from '../engine/map.js';
import { LOOKS, charSheetHD, drawSeated } from '../engine/sprites.js';
import { defineTile, tileImageHD, R, P, speckle, disc, line, bevel, outline, shadowEllipse } from '../engine/tiles.js';
import { text } from '../engine/draw.js';
import { makeCanvas, shade, clamp } from '../engine/util.js';
import { PEOPLE } from '../engine/life.js';
import { venue } from '../engine/contests_run.js';
import { internals as I, CONTESTS } from '../engine/contests.js';

const WHT = '#ffffff', INK = '#20232a', GOLD = '#ffd23f';
const G = () => (typeof window !== 'undefined' ? window.__game : null);
const V = (g = G()) => (g && g.state && typeof g.contestVenue === 'function' ? g.contestVenue() : null);
const T0 = (g = G()) => (g && g.state ? venue.today(g) : null);
const active = (g = G()) => !!T0(g);
const vcolor = (g = G()) => { const v = V(g); return active(g) && v && v.color ? v.color : '#b8402a'; };
const vtitle = (g = G()) => { const v = V(g); return active(g) && v && v.title ? v.title : 'お笑い賞レース会場'; };
const vsub = (g = G()) => { const v = V(g); return active(g) && v ? `${v.sub || ''}${v.venueName ? `　${v.venueName}` : ''}` : '本日の催し：なし'; };

// ================================================================ tiles
defineTile('sr_led', {
  solid: true, frames: 3, speed: 22,
  draw(c, r, f) { R(c, 0, 0, 16, 16, '#101028'); for (let y = 1; y < 16; y += 3) for (let x = 1; x < 16; x += 3) P(c, x, y, ['#3a3ae8', '#e83a8a', '#3ae8c8'][(x + y + f) % 3]); },
  hd(c, r, f) {
    R(c, 0, 0, 32, 32, '#0c0c22');
    for (let y = 1; y < 32; y += 3) for (let x = 1; x < 32; x += 3) { const k = (Math.floor(x / 6) + Math.floor(y / 6) + f) % 5; R(c, x, y, 2, 2, ['#20206a', '#2a2a8a', '#3a3ac0', '#6a3ab0', '#2a2a8a'][k]); }
    R(c, 0, 30, 32, 2, '#05050f');
  },
});
defineTile('sr_judge', {
  solid: true, obj: true, talkThrough: true, variants: 3,
  draw(c) { R(c, 0, 4, 16, 4, '#f6f6f8'); R(c, 0, 8, 16, 8, '#2a2a4a'); },
  hd(c, r, f, v) {
    R(c, 0, 8, 32, 8, '#f6f6f8'); R(c, 0, 8, 32, 1, WHT); R(c, 0, 15, 32, 1, '#c3c8d2');
    R(c, 0, 16, 32, 14, '#24244a'); R(c, 0, 16, 32, 2, '#3a3a7a'); R(c, 4, 20, 24, 6, '#14142a'); R(c, 5, 21, 22, 1, GOLD);
    R(c, 0, 30, 32, 2, '#0e0e22');
    if (v === 0) { R(c, 8, 3, 16, 7, WHT); R(c, 9, 5, 14, 1, '#9aa0aa'); R(c, 9, 7, 10, 1, '#9aa0aa'); }
    if (v === 1) { R(c, 6, 2, 5, 8, '#cfe8f5'); R(c, 7, 5, 3, 4, '#8fd2fa'); disc(c, 22, 7, 3, '#d62f2f'); }
    if (v === 2) { line(c, 8, 9, 22, 4, INK); R(c, 22, 3, 2, 2, '#d62f2f'); R(c, 12, 6, 10, 3, '#fbf6ea'); }
    outline(c);
  },
});
defineTile('sr_sky', {
  draw(c) { R(c, 0, 0, 16, 16, '#7ec8f0'); },
  hd(c, r) { R(c, 0, 0, 32, 32, '#86ccf2'); R(c, 0, 24, 32, 8, '#9ad6f6'); if (r() < 0.4) { const x = Math.floor(r() * 20); R(c, x, 6, 10, 3, WHT); R(c, x + 2, 4, 6, 2, WHT); } },
});
defineTile('sr_city', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#9ad6f6'); R(c, 0, 8, 16, 8, '#6a7a9a'); },
  hd(c, r) { R(c, 0, 0, 32, 32, '#9ad6f6'); for (let x = 0; x < 32; x += 5) { const h = 8 + Math.floor(r() * 14); R(c, x, 32 - h, 5, h, r() < 0.5 ? '#6a7a9a' : '#7a8aaa'); for (let y = 34 - h; y < 30; y += 4) P(c, x + 2, y, '#d8e8f8'); } R(c, 0, 30, 32, 2, '#5a6a8a'); },
});
defineTile('sr_truss', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#9ad6f6'); R(c, 0, 2, 16, 3, '#8a8a9a'); },
  hd(c) {
    R(c, 0, 0, 32, 32, '#9ad6f6');
    R(c, 0, 4, 32, 2, '#c3c8d2'); R(c, 0, 12, 32, 2, '#7d8391');
    for (let x = 0; x < 32; x += 8) { line(c, x, 6, x + 8, 12, '#9aa0aa'); line(c, x, 12, x + 8, 6, '#9aa0aa'); }
    R(c, 6, 14, 4, 6, '#2a2d36'); R(c, 22, 14, 4, 6, '#2a2d36'); disc(c, 8, 21, 2, '#fff6c8'); disc(c, 24, 21, 2, '#fff6c8');
    R(c, 0, 26, 32, 6, '#2a2d36');
  },
});
defineTile('sr_board', {
  solid: true, obj: true,
  draw(c) { R(c, 1, 1, 14, 12, '#8a5a2a'); R(c, 2, 2, 12, 10, '#c8a070'); },
  hd(c) {
    shadowEllipse(c, 16, 30, 13, 2);
    bevel(c, 1, 2, 30, 22, '#7a4a20', '#9a6a3a', '#4a2a10');
    R(c, 3, 4, 26, 18, '#c89a68'); speckle(c, () => 0.5, ['#b88a58'], 0);
    for (const [x, y, col] of [[5, 6, WHT], [13, 5, '#fff3c0'], [20, 7, WHT], [7, 13, '#e8f4ff'], [16, 14, WHT]]) { R(c, x, y, 7, 6, col); R(c, x + 1, y + 2, 5, 1, '#9aa0aa'); R(c, x + 3, y, 1, 1, '#d62f2f'); }
    R(c, 14, 24, 4, 6, '#4a2a10');
    outline(c);
  },
});
defineTile('sr_crowd', {
  solid: true, variants: 4,
  draw(c, r, f, v) { R(c, 0, 0, 16, 16, '#4a6a3a'); for (let x = 1; x < 16; x += 5) disc(c, x + 2, 6 + (v % 2), 2, ['#2a2430', '#6b4226', '#e8c45a'][(x + v) % 3]); },
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#5a8a4a');
    for (let k = 0; k < 3; k++) {
      const x = 2 + k * 10 + ((v + k) % 2) * 2, y = 6 + ((v * 3 + k) % 3) * 2;
      const top = ['#d64161', '#3f5fa8', '#ffd23f', '#5ec4a8', '#ff8a3d', '#8a5ac8'][(v * 2 + k) % 6];
      R(c, x, y + 8, 8, 12, top); R(c, x, y + 8, 8, 1, shade(top, 0.25));
      disc(c, x + 4, y + 4, 4, '#f6c9a0'); R(c, x, y, 8, 3, ['#2a2430', '#6b4226', '#e8c45a', '#2a2430'][(v + k) % 4]);
      if ((v + k) % 3 === 0) { R(c, x - 2, y + 2, 2, 6, '#f6c9a0'); R(c, x - 3, y, 3, 2, '#ff7eb6'); }
    }
    R(c, 0, 28, 32, 4, '#4a7a3a');
  },
});

// ================================================================ signage (baked at 2x, keyed by text + colour)
const baked = new Map();
const fontReady = () => { try { return !document.fonts || document.fonts.check('16px "DotGothic16"'); } catch (e) { return true; } };
function bake(key, w, h, paint) {
  let cv = baked.get(key);
  if (cv) return cv;
  const [c2, c] = makeCanvas(Math.round(w * 2), Math.round(h * 2));
  paint(c, c2.width, c2.height);
  if (fontReady()) { baked.set(key, c2); if (baked.size > 60) baked.delete(baked.keys().next().value); }
  return c2;
}
const bold = (c, s, x, y, o) => { text(c, s, x, y, { ...o, shadow: null }); text(c, s, x + 1, y, { ...o, shadow: null }); };
function fitSize(c, s, maxW, size) { let k = size; while (k > 10) { c.font = `${k}px "DotGothic16", sans-serif`; if (c.measureText(s).width <= maxW) break; k -= 2; } return k; }
// a dynamic sign prop: paint(c, W, H, ctxInfo) is re-baked when the title / colour change
function sign(x, y, w, h, name, paint, extra = {}) {
  return {
    type: 'prop', x, y, w, h, solid: false, z: -400,
    draw(ctx, sx, sy, g) {
      const info = { title: vtitle(g), sub: vsub(g), color: vcolor(g), active: active(g) };
      const key = `${name}|${info.title}|${info.sub}|${info.color}`;
      ctx.drawImage(bake(key, w * 16, h * 16, (c, W, H) => paint(c, W, H, info)), Math.round(sx * 2) / 2, Math.round(sy * 2) / 2, w * 16, h * 16);
    },
    ...extra,
  };
}
const bannerPaint = (c, W, H, info) => {
  const col = info.color;
  R(c, 0, 0, W, H, shade(col, -0.45)); R(c, 2, 2, W - 4, H - 4, col); R(c, 2, 2, W - 4, 3, shade(col, 0.3)); R(c, 2, H - 6, W - 4, 4, shade(col, -0.25));
  for (let k = 6; k < W - 6; k += 12) { P(c, k, 6, GOLD); P(c, k + 6, H - 8, GOLD); }
  const s1 = fitSize(c, info.title, W - 24, 20);
  bold(c, info.title, W / 2, 6, { size: s1, align: 'center', color: WHT });
  const s2 = fitSize(c, info.sub, W - 24, 12);
  text(c, info.sub, W / 2, H - 6 - s2 - 2, { size: s2, align: 'center', color: '#fff6c8', shadow: null });
};
const ledPaint = (c, W, H, info) => {
  R(c, 0, 0, W, H, '#05050f');
  const col = info.color;
  for (let y = 2; y < H - 2; y += 3) for (let x = 2; x < W - 2; x += 3) R(c, x, y, 2, 2, (x + y) % 9 === 0 ? shade(col, -0.3) : '#10102a');
  R(c, 4, 4, W - 8, 3, col); R(c, 4, H - 7, W - 8, 3, col);
  const s1 = fitSize(c, info.title, W - 30, 26);
  bold(c, info.title, W / 2, Math.round(H / 2) - s1 + 2, { size: s1, align: 'center', color: WHT });
  const s2 = fitSize(c, info.sub, W - 30, 14);
  text(c, info.sub, W / 2, Math.round(H / 2) + 6, { size: s2, align: 'center', color: GOLD, shadow: null });
};
const plate = (x, y, label, w = 1.8) => sign(x, y, w, 0.55, `plate_${label}`, (c, W, H) => {
  R(c, 0, 0, W, H, '#20232a'); R(c, 1, 1, W - 2, H - 2, WHT); R(c, 1, H - 3, W - 2, 2, '#c3c8d2');
  text(c, label, W / 2, 1, { size: fitSize(c, label, W - 6, 14), align: 'center', color: INK, shadow: null });
});

// ================================================================ people
const STAFF = {
  uketsuke: { name: '受付スタッフ', look: { ...LOOKS.receptionist } },
  annai: { name: '案内係', look: { ...LOOKS.receptionist, hair: 'short', hairColor: 'black', skirt: false, top: '#2a3560' } },
  guard: { name: '警備員', look: { ...LOOKS.guard } },
  onkyo: { name: '音響スタッフ', look: { ...LOOKS.staff, hat: '#2f6fd0', top: '#2a2d36' } },
  kantoku: { name: '舞台監督', look: { ...LOOKS.staff, hat: '#d62f2f', top: '#1e1e26' } },
  ad: { name: 'AD', look: { ...LOOKS.ad } },
  mc: { name: '進行役', look: { ...LOOKS.announcerM, tie: '#d62f2f' } },
  mc2: { name: '進行アシスタント', look: { ...LOOKS.announcer } },
  cam: { name: 'カメラマン', look: { ...LOOKS.cameraman } },
  make: { name: 'メイクさん', look: { ...LOOKS.makeup } },
};
const say = (g, who, t) => g.say(t, { name: who.name, look: who.look });
const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });
const posted = (dir, fn) => async (g, e) => { await fn(g, e); if (e) e.dir = dir; };
function seated(ctx, x, y, g, e) {
  const seat = g.map.seatOf(e.x, e.y) || (e.seatTile ? { img: tileImageHD(e.seatTile), top: 5.5 } : null);
  drawSeated(ctx, e.sheet || charSheetHD(e.look || {}), 'up', x, y, seat);
}
const rivalAt = (k, g = G()) => { const t = T0(g); return t && Array.isArray(t.rivals) ? t.rivals[k] || null : null; };
const partner = (g = G()) => { const id = g && g.state && g.state.partner; return id && PEOPLE[id] ? PEOPLE[id] : null; };
const judgesNow = (g = G()) => {
  const v = V(g);
  if (!g || !g.state || !v || !v.contest || !CONTESTS[v.contest] || typeof g.contestJudges !== 'function') return [];
  try { return g.contestJudges(v.contest, v.year) || []; } catch (e) { return []; }
};
const TAG_LINES = {
  前年王者: '去年獲ったからって、気は抜かへんよ。追われる側はしんどいわ。', ラストイヤー: '今年で最後なんです。…最後くらい、笑って終わりたい。',
  アマチュア: '仕事終わりに来ました。明日も朝から会社です！', 初出場: '初めての賞レースで、手の震えが止まらないです…！', 準決勝常連: '毎年ここまでは来るんやけどな。今年こそ、その先や。',
  決勝経験者: 'あの舞台の景色、もう一回見たいんですよ。', 大学お笑い出身: '大学のお笑いサークルでやってました。プロの人たち、目がちがう…。', 敗者復活から: '一回死んだ身や。怖いもんはない。',
  NSC出身: '養成所の同期も今日来てます。負けたくないなあ。', 芸歴1年目: 'まだ1年目なんで、全部が勉強です！', 優勝候補: '…（集中していて、話しかけられる空気じゃない）',
  社会人: '会社には内緒で来てます。有給、使いました。', 小学生: 'ぼくら、学校のお楽しみ会でいちばんウケたんやで！', 中学生: '部活休んで来た。絶対ウケる自信ある！',
};
async function rivalTalk(g, k, e) {
  const r = rivalAt(k, g);
  if (!r) { await g.say('出場者が、ネタ帳を見ながらぶつぶつ言っている。'); return; }
  const tag = (r.tags || [])[0];
  const lines = [`${r.name}${r.agency ? `（${r.agency}）` : ''}です。${r.tags && r.tags.length ? `\n［${r.tags.join('・')}］` : ''}`, TAG_LINES[tag] || 'お互い、がんばりましょう。'];
  await g.say(lines, { name: r.name, look: e && e.look });
  const lvl = r.power >= 70 ? 'かなりの実力者だ…。' : r.power >= 50 ? 'なかなか手ごわそうだ。' : r.power >= 30 ? '同じくらいか、少し下かもしれない。' : 'まだ荒けずりな感じだ。';
  await g.say(`（${lvl}）`);
}

// ================================================================ exits
function exitWarp(x, y) {
  const w = { x, y };
  w.check = async (g) => {
    const t = T0(g);
    if (t && !t.done) {
      const k = await g.ask(['まだ出番が終わっていない。', '帰ると棄権になる。帰る？'], ['会場に残る', '棄権して帰る'], { cancel: 0 });
      if (k !== 1) return false;
      venue.withdrawToday(g);
    }
    const c = I.cstate(g);
    const ret = c.ret && g.PLACES && g.PLACES[c.ret.place] ? c.ret : null;
    c.ret = null;
    let dest = ret;
    if (!dest) { let h = null; try { h = g.housing(); } catch (e) { h = null; } const pl = h && g.PLACES && g.PLACES[h.place] ? h.place : 'home'; dest = { place: pl }; }
    Object.assign(w, { place: dest.place, room: dest.room, tx: dest.x, ty: dest.y, dir: dest.dir || 'down' });
    return true;
  };
  return w;
}

// ================================================================ LOBBY
const lobby = {
  floor: 'floor_marble', wall: 'navy', bgm: 'office', topPad: 18,
  tiles: [
    '####################',
    '#==================#',
    '#=d=pp========pp=c=#',
    '#P................P#',
    '#......KKKKKK......#',
    '#..................#',
    '#.FFF.........BB...#',
    '#.nnn..............#',
    '#..................#',
    '#P......V.....Y...P#',
    '#..................#',
    '#########MM#########',
  ],
  legend: { K: 'counter', F: 'sofa_blue', n: 'table_low', B: 'sr_board', V: 'vending', Y: 'flower_stand', P: 'plant' },
  entry: { x: 9, y: 10, dir: 'up' },
  warps: [exitWarp(9, 11), exitWarp(10, 11), { x: 2, y: 2, room: 'gakuya', tx: 6, ty: 7, dir: 'up' }],
  entities: [
    sign(5, 0.6, 10, 1.5, 'lobby_banner', bannerPaint),
    plate(1.6, 1.4, '楽屋'),
    plate(15.7, 1.4, '関係者以外', 2.6),
    npc('sr_uketsuke', 9, 3, 'down', STAFF.uketsuke, { talk: posted('down', (g) => venue.reception(g)) }),
    npc('sr_annai', 10, 3, 'down', STAFF.annai, { talk: posted('down', annaiTalk) }),
    npc('sr_guard', 17, 9, 'left', STAFF.guard, { talk: posted('left', guardTalk) }),
    npc('sr_wait0', 3, 8, 'up', { name: '出場者', look: LOOKS.comedian }, { get name() { const r = rivalAt(4); return r ? r.name : '出場者'; }, get look() { const r = rivalAt(4); return (r && r.look) || LOOKS.comedian; }, cond: (g) => !!rivalAt(4, g), talk: posted('up', (g, e) => rivalTalk(g, 4, e)) }),
    npc('sr_wait1', 12, 8, 'left', { name: '出場者', look: LOOKS.comedian2 }, { get name() { const r = rivalAt(5); return r ? r.name : '出場者'; }, get look() { const r = rivalAt(5); return (r && r.look) || LOOKS.comedian2; }, cond: (g) => !!rivalAt(5, g), talk: posted('left', (g, e) => rivalTalk(g, 5, e)) }),
  ],
  events: [
    { x: 14, y: 6, w: 2, on: 'action', run: boardRead },
    { x: 4, y: 2, w: 2, on: 'action', run: async (g) => g.say(active(g) ? `「${vtitle(g)}」のポスターだ。\n${I.prizeOf(CONTESTS[V(g).contest], V(g).year).text || '出場者の名前がずらりと並んでいる。'}` : '過去の大会のポスターが貼ってある。\n歴代王者の写真が、まぶしく笑っている。') },
    { x: 14, y: 2, w: 2, on: 'action', run: async (g) => g.say('「携帯電話の電源はお切りください」\n「客席での撮影・録音は禁止です」と書いてある。') },
    { x: 2, y: 6, w: 3, on: 'action', run: async (g) => g.say('待合のソファだ。\n出番を待つ出場者が、台本を何度も読み返している。') },
    { x: 2, y: 7, w: 3, on: 'action', run: async (g) => g.say('テーブルに、大会のパンフレットが置いてある。\n審査のルールと、これまでの王者が載っている。') },
    { x: 18, y: 2, on: 'action', run: async (g) => g.say('「関係者以外立入禁止」の扉だ。\n出場者は楽屋から舞台袖へ行く。') },
  ],
  async onEnter(g) {
    g.showBanner(active(g) ? vtitle(g) : '賞レース会場');
    const t = T0(g);
    if (!t || t.phase !== 'arrived' || t.mode !== 'full') return;
    const c = I.cstate(g);
    if (c.seen.venueFull) return;
    c.seen.venueFull = true;
    await g.wait(200);
    await g.emote('sr_annai', '!');
    await say(g, STAFF.annai, ['出場者の方ですね。ようこそ！', 'まずは正面の受付で、エントリーナンバーを伝えてください。', '受付がすんだら、左の楽屋で待機。\n楽屋の奥のドアが舞台袖です。出番は舞台監督が呼びます。']);
  },
};
async function annaiTalk(g) {
  if (!active(g)) { await say(g, STAFF.annai, ['本日は大会の開催はありません。', 'エントリーした大会の日に、「賞レース」アプリから\n会場へ来てくださいね。']); return; }
  const t = T0(g);
  const steps = [t.phase === 'arrived' ? '→ まず正面の受付へ。' : '受付はおすみです。', '楽屋（左のドア）で準備。相方とネタ合わせ、鏡で身だしなみ。', '楽屋の奥が舞台袖。舞台監督に声をかけたら本番です。'];
  await say(g, STAFF.annai, steps);
}
async function guardTalk(g) {
  await say(g, STAFF.guard, active(g) ? ['おはようございます。出場者の方は胸の番号札を見えるところに。', '本番前はみんな顔が真っ白でね。\n深呼吸、深呼吸。'] : ['今日は催しはないですよ。', 'ここは賞レースのときだけ開く会場でね。\n普段は静かなもんです。']);
}
async function boardRead(g) {
  const t = T0(g);
  if (!t) {
    const news = I.cstate(g).news.slice(0, 2).map((n) => String(n.text).split('\n')[0]);
    await g.say(['掲示板だ。', news.length ? `最近のお知らせ：\n${news.join('\n')}` : '何も貼られていない。']);
    return;
  }
  const e = I.entryOf(g, t.id, t.year);
  const rv = (t.rivals || []).slice(0, 4);
  const lines = [];
  const me = e ? e.unitName : 'あなた';
  const start = Math.max(1, t.order - 2);
  let k = 0;
  for (let n = start; n < start + 5 && n <= t.of; n++) lines.push(n === t.order ? `${n}番　${me}　←あなた` : `${n}番　${(rv[k++] || { name: '（出場者）' }).name}`);
  await g.say([`本日の出番表${t.block ? `（${t.block}ブロック）` : ''}：${vsub(g)}`, lines.slice(0, 3).join('\n'), lines.slice(3).join('\n') || '（以下つづく）'].filter(Boolean));
}

// ================================================================ GAKUYA (楽屋)
const gakuya = {
  floor: 'floor_carpet_beige', wall: 'cream', bgm: 'office',
  tiles: [
    '##############',
    '#=MMMM=c==d==#',
    '#.VVVV.......#',
    '#............#',
    '#.TTTT..LLLR.#',
    '#.TttT.......#',
    '#.TTTT..SSS..#',
    '#P..........P#',
    '######OO######',
  ],
  legend: { M: 'wall_cream+mirror', c: 'wall_cream+clock', V: 'makeup', T: 'floor_tatami', t: 'floor_tatami+table_low', L: 'locker', R: 'clothes_rack', S: 'sofa', P: 'plant', O: 'exit_mat' },
  entry: { x: 6, y: 7, dir: 'up' },
  warps: [
    { x: 6, y: 8, room: 'lobby', tx: 2, ty: 3, dir: 'down' }, { x: 7, y: 8, room: 'lobby', tx: 2, ty: 3, dir: 'down' },
    { x: 10, y: 1, room: 'sode', tx: 2, ty: 6, dir: 'right' },
  ],
  entities: [
    plate(9.6, 0.5, '舞台袖へ', 1.8),
    npc('sr_onkyo', 12, 3, 'left', STAFF.onkyo, { talk: posted('left', (g) => venue.debayashi(g)) }),
    npc('sr_make', 6, 2, 'left', STAFF.make, { talk: posted('left', makeTalk) }),
    npc('sr_partner', 3, 3, 'down', { name: '相方', look: LOOKS.comedian }, {
      get name() { const p = partner(); return p ? p.name : '相方'; }, get look() { const p = partner(); return (p && p.look) || LOOKS.comedian; }, get person() { return undefined; },
      cond: (g) => active(g) && !!partner(g), talk: posted('down', async (g) => { const p = partner(g); const k = await g.ask(`${p ? p.name : '相方'}「ネタ合わせ、最後にもう一回やっとく？」`, ['ネタ合わせする', 'だいじょうぶ'], { name: p ? p.name : '相方', look: p ? p.look : undefined, cancel: 1 }); if (k === 0) await venue.practice(g, p ? { name: p.name } : null); }),
    }),
    ...[0, 1, 2, 3].map((k) => npc(`sr_rival${k}`, [9, 11, 2, 5][k], [6, 5, 6, 6][k], ['up', 'left', 'right', 'left'][k], { name: '出場者', look: LOOKS.comedian }, {
      get name() { const r = rivalAt(k); return r ? r.name : '出場者'; },
      get look() { const r = rivalAt(k); return (r && r.look) || LOOKS.comedian; },
      cond: (g) => !!rivalAt(k, g), talk: posted(['up', 'left', 'right', 'left'][k], (g, e) => rivalTalk(g, k, e)),
    })),
  ],
  events: [
    { x: 2, y: 1, w: 4, on: 'action', run: (g) => venue.mirror(g) },
    { x: 2, y: 2, w: 4, on: 'action', run: (g) => venue.mirror(g) },
    { x: 7, y: 1, on: 'action', run: async (g) => g.say(active(g) ? '楽屋の時計だ。\n出番の時間が、刻一刻と近づいてくる。' : '楽屋の時計だ。') },
    { x: 8, y: 4, w: 3, on: 'action', run: async (g) => g.say('出場者用のロッカーだ。\n「貴重品は各自で管理を」と貼り紙がある。') },
    { x: 11, y: 4, on: 'action', run: async (g) => g.say('衣装がかかっている。\n本番用のスーツに、なぜか着ぐるみまで。') },
    { x: 8, y: 6, w: 3, on: 'action', run: async (g) => g.say('ソファに座ると、モニターから\n舞台の笑い声がかすかに聞こえてくる。') },
    { x: 3, y: 5, w: 2, on: 'action', run: async (g) => { if (active(g) && !partner(g)) await venue.practice(g, null); else await g.say('畳の上のちゃぶ台。\nだれかの書きかけの台本が置いてある。'); } },
  ],
  onEnter: async (g) => { g.showBanner(active(g) ? '楽屋' : '楽屋（今日は使われていない）'); },
};
async function makeTalk(g) {
  const cl = g.need ? g.need('clean') : 80;
  await say(g, STAFF.make, cl < 40 ? ['あら、ちょっと髪が乱れてる！', '鏡の前で整えていって。照明の下だと目立つから。'] : ['いい感じ！ライトに映えるわよ。', '本番前は、口角を上げて深呼吸ね。']);
}

// ================================================================ SODE (舞台袖)
const sode = {
  floor: 'floor_black', wall: 'black', bgm: null,
  tiles: [
    '############',
    '#==========#',
    '#.......ccC#',
    '#........cC#',
    '#.mm.....cC#',
    '#........cC#',
    '#.......ccC#',
    '#######O####',
  ],
  legend: { c: 'floor_black', C: 'curtain', m: 'monitor', O: 'exit_mat' },
  entry: { x: 2, y: 6, dir: 'right' },
  warps: [
    { x: 7, y: 7, room: 'gakuya', tx: 10, ty: 2, dir: 'down' },
    stageWarp(10, 4),
  ],
  entities: [
    npc('sr_kantoku', 9, 2, 'left', STAFF.kantoku, { talk: posted('left', (g) => venue.stageCall(g)) }),
    npc('sr_ad', 4, 6, 'up', STAFF.ad, { talk: posted('up', adTalk) }),
    npc('sr_next', 8, 5, 'right', { name: '次の出場者', look: LOOKS.comedian2 }, { get name() { const r = rivalAt(0); return r ? r.name : '次の出場者'; }, get look() { const r = rivalAt(0); return (r && r.look) || LOOKS.comedian2; }, cond: (g) => !!rivalAt(0, g) && !T0(g).done, talk: posted('right', async (g, e) => { const r = rivalAt(0, g); await g.say('（目を閉じて、口だけでネタを最後までさらっている）', { name: r ? r.name : '出場者', look: e && e.look }); }) }),
    sign(1.2, 0.6, 5, 0.9, 'sode_plate', (c, W, H, info) => { R(c, 0, 0, W, H, '#101014'); R(c, 1, 1, W - 2, H - 2, '#1e1e26'); const s = info.active ? `本番中　${info.sub}` : '舞台袖'; text(c, s, W / 2, 4, { size: fitSize(c, s, W - 8, 14), align: 'center', color: info.active ? '#ff5d6c' : '#9aa0aa', shadow: null }); }),
  ],
  events: [
    { x: 2, y: 4, w: 2, on: 'action', run: async (g) => g.say(active(g) ? '舞台のモニターだ。\n前の組のネタに、客席がどっと沸いている…！' : '舞台のモニターだ。何も映っていない。') },
    { x: 5, y: 3, w: 2, on: 'action', run: (g) => venue.breathe(g) },
  ],
  drawOver(ctx, g) {
    const t = T0(g);
    if (!t || t.done) return;
    const v = clamp(t.tension, 0, 100);
    const x0 = 110, y0 = 26, w = 100;
    ctx.fillStyle = 'rgba(10,10,16,0.85)'; ctx.fillRect(x0 - 4, y0 - 2, w + 8, 14);
    ctx.fillStyle = '#2a2a38'; ctx.fillRect(x0, y0 + 6, w, 4);
    const col = v >= 70 ? '#ff5468' : v >= 45 ? '#ffcc4d' : '#57d98a';
    ctx.fillStyle = col; ctx.fillRect(x0, y0 + 6, Math.round((w * v) / 100), 4);
    text(ctx, `緊張 ${Math.round(v)}`, x0, y0 - 2, { size: 6, color: '#ffffff', shadow: null });
    text(ctx, v >= 70 ? 'ガチガチ' : v >= 45 ? 'ドキドキ' : '落ち着いている', x0 + w, y0 - 2, { size: 6, color: col, align: 'right', shadow: null });
  },
  onEnter: async (g) => {
    g.showBanner('舞台袖');
    const t = T0(g);
    const c = g.state ? I.cstate(g) : null;
    if (!t || t.done || !c || c.seen.sode) return;
    c.seen.sode = true;
    await g.wait(150);
    await say(g, STAFF.kantoku, ['ここが舞台袖。出番が近づいたら、ここで待機ね。', '緊張してる？上のメーターがあなたの緊張度。\n高いと本番で噛んだり飛んだりしやすい。', '深呼吸（壁ぎわ）、ネタ合わせ、出囃子の確認で下がるよ。\n準備ができたら、わたしに声をかけて。']);
  },
};
async function adTalk(g) {
  const t = T0(g);
  if (!t) { await say(g, STAFF.ad, '今日は本番はないっすよ。'); return; }
  if (t.done) { await say(g, STAFF.ad, 'おつかれさまでした！'); return; }
  await say(g, STAFF.ad, [`いま${Math.max(1, t.order - 2)}番の組がネタ中です！`, '持ち時間を超えると減点なので、\nランプが点いたらまとめに入ってください！']);
}
// the opening onto the stage: during a contest only through the 舞台監督; otherwise you can step out onto the empty stage
function stageWarp(x, y) {
  const w = { x, y, room: 'stage', tx: 9, ty: 4, dir: 'down' };
  w.check = async (g) => {
    const t = T0(g);
    if (t && !t.done) { await say(g, STAFF.kantoku, 'ちょっと待って！勝手に出ないで。\n出番になったら呼ぶから。'); return false; }
    const room = (V(g) && V(g).stage) || 'stage';
    const to = room === 'studio' ? { room: 'studio', tx: 9, ty: 5 } : room === 'outdoor' ? { room: 'outdoor', tx: 9, ty: 5 } : { room: 'stage', tx: 9, ty: 4 };
    Object.assign(w, to);
    return true;
  };
  return w;
}

// ================================================================ STAGE (劇場)
const AUD = [[3, 8], [6, 8], [13, 8], [16, 8], [4, 9], [8, 9], [12, 9], [15, 9], [5, 10], [14, 10]];
const AUD_LOOKS = [LOOKS.fan, LOOKS.salaryman, LOOKS.mom, LOOKS.oldman, { ...LOOKS.fan, hairColor: 'brown', top: '#ff7eb6' }, LOOKS.tourist, LOOKS.kid, LOOKS.oldwoman, { ...LOOKS.salaryman, top: '#5a4a6a' }, { ...LOOKS.fan, top: '#ffd23f', hairColor: 'black' }];
const AUD_LINES = ['今日はどの組がウケるやろ。', '予選はタダで見られる回もあるんだよ。', '毎年見に来てるの。予選のほうが荒々しくて好き。', 'わしは昔、漫才ブームを生で見たんじゃ。', '推しのコンビが出るの！', '観光ついでに来ました！', 'おもしろい人、出てくるかな？', 'あら、あなたも出るの？がんばってね。', '会社帰りに寄りました。', '笑う準備はできてる！'];
const stage = {
  floor: 'floor_carpet_red', wall: 'red', bgm: 'theater', topPad: 30,
  tiles: [
    '####################',
    '#XXXXXXXXXXXXXXXXXX#',
    '#xxxxxxxxxxxxxxxxxx#',
    '#,,,,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,m,,,,,,,,#',
    '#eeeeeeeeeeeeeeeeee#',
    '#..................#',
    '#.....JJJJJJJJ.....#',
    '#..ssss.....ssss...#',
    '#..ssss.....ssss...#',
    '#..ssss.....ssss...#',
    '#..................#',
    '#########OO#########',
  ],
  legend: { X: 'curtain_top', x: 'curtain', ',': 'floor_stage', m: 'floor_stage+mic', e: 'stage_edge', J: 'floor_carpet_red+sr_judge', s: 'floor_carpet_red+seat', O: 'exit_mat' },
  mic: [10, 3],
  entry: { x: 10, y: 11, dir: 'up' },
  warps: [{ x: 10, y: 12, room: 'lobby', tx: 9, ty: 9, dir: 'down' }, { x: 9, y: 12, room: 'lobby', tx: 9, ty: 9, dir: 'down' }, { x: 1, y: 3, room: 'sode', tx: 9, ty: 4, dir: 'left' }],
  entities: [
    sign(4, 0.2, 12, 1.6, 'stage_banner', bannerPaint),
    npc('sr_judge_a', 8, 8, 'up', { name: '予選審査員', look: { ...LOOKS.director } }, { cond: (g) => active(g), fixedDir: true, text: '（黙々と採点表に書きこんでいる）' }),
    npc('sr_judge_b', 11, 8, 'up', { name: '予選審査員', look: { ...LOOKS.manager } }, { cond: (g) => active(g), fixedDir: true, text: '（ペンを止めて、じっと舞台を見ている）' }),
    ...AUD.map(([x, y], i) => npc(`sr_aud${i}`, x, y, 'up', { name: 'お客さん', look: AUD_LOOKS[i] }, { sprite: seated, seatTile: 'seat', fixedDir: true, cond: i < 4 ? undefined : (g) => active(g), talk: async (g, e) => { await g.say(AUD_LINES[i], { name: 'お客さん', look: AUD_LOOKS[i] }); e.dir = 'up'; } })),
  ],
  events: [
    { x: 6, y: 7, w: 8, on: 'action', run: async (g) => g.say(active(g) ? '予選の審査員席だ。\n採点表には、細かい字がびっしり書きこまれている。' : '審査員席だ。いまは空いている。') },
  ],
  onEnter: async (g) => { g.showBanner(active(g) ? `${vtitle(g)}　会場` : '劇場（今日は催しなし）'); },
};

// ================================================================ STUDIO (テレビ決勝)
const studio = {
  floor: 'floor_studio', wall: 'black', bgm: 'studio', topPad: 30,
  tiles: [
    '####################',
    '#LLLLLLLLLLLLLLLLLL#',
    '#LLLLLLLLLLLLLLLLLL#',
    '#,,,,,,,,,,,,,,,,,,#',
    '#q,,,,,,,,m,,,,,,,q#',
    '#,,,,,,,,,,,,,,,,,,#',
    '#eeeeeeeeeeeeeeeeee#',
    '#..K....JJJJJ....K.#',
    '#..................#',
    '#..ssss.....ssss...#',
    '#..ssss.....ssss...#',
    '#..................#',
    '#########OO#########',
  ],
  legend: { L: 'sr_led', ',': 'floor_stage', m: 'floor_stage+mic', q: 'floor_stage+spotlight', e: 'stage_edge', K: 'floor_studio+camera', J: 'floor_studio+sr_judge', s: 'floor_studio+seat', O: 'exit_mat' },
  mic: [10, 4],
  entry: { x: 10, y: 11, dir: 'up' },
  warps: [{ x: 10, y: 12, room: 'lobby', tx: 9, ty: 9, dir: 'down' }, { x: 9, y: 12, room: 'lobby', tx: 9, ty: 9, dir: 'down' }, { x: 1, y: 3, room: 'sode', tx: 9, ty: 4, dir: 'left' }],
  entities: [
    sign(2, 0.2, 16, 2.3, 'studio_led', ledPaint),
    {
      // the scoreboard on the right of the set
      type: 'prop', x: 15.2, y: 3.1, w: 3.4, h: 1.6, solid: false, z: 10,
      draw(ctx, sx, sy, g) {
        const res = active(g) && V(g) && g.state ? I.resultsOf(g, V(g).contest, V(g).year) : null;
        const tot = res && res.final ? res.final.total : null;
        ctx.fillStyle = '#05050f'; ctx.fillRect(sx, sy, 54, 25);
        ctx.fillStyle = vcolor(g); ctx.fillRect(sx, sy, 54, 2);
        text(ctx, 'SCORE', sx + 27, sy + 3, { size: 6, align: 'center', color: '#9aa0aa', shadow: null });
        text(ctx, tot != null ? String(tot) : '---', sx + 27, sy + 11, { size: 10, align: 'center', color: GOLD, shadow: null });
      },
      text: 'スコアボードだ。審査員の合計点がここに出る。',
    },
    npc('sr_mc', 4, 4, 'down', STAFF.mc, { cond: (g) => active(g), talk: posted('down', async (g) => say(g, STAFF.mc, active(g) ? ['いよいよ本番です。', '画面の向こうでは、全国のみなさんが見ていますよ！'] : '今日は収録はありません。')) }),
    npc('sr_mc2', 15, 5, 'down', STAFF.mc2, { cond: (g) => active(g), text: '本番まで、もう少しです！' }),
    ...[0, 1, 2, 3, 4].map((k) => npc(`sr_jd${k}`, 8 + k, 8, 'up', { name: '審査員', look: LOOKS.director }, {
      get name() { const j = judgesNow()[k]; return j ? j.name : '審査員'; }, get look() { const j = judgesNow()[k]; return (j && j.look) || LOOKS.director; },
      fixedDir: true, cond: (g) => active(g) && !!judgesNow(g)[k],
      talk: async (g, e) => { const j = judgesNow(g)[k]; await g.say(j ? [`${j.name}です。${j.title}`, `わたしは「${j.taste}」で見ます。`] : '（審査員席）', { name: j ? j.name : '審査員', look: e && e.look }); e.dir = 'up'; },
    })),
    npc('sr_cam', 3, 8, 'up', STAFF.cam, { cond: (g) => active(g), text: 'カメラ、回ってます。赤いランプが点いたら本番！' }),
    ...[[3, 9], [6, 9], [13, 10], [16, 9]].map(([x, y], i) => npc(`sr_saud${i}`, x, y, 'up', { name: '観覧のお客さん', look: AUD_LOOKS[i + 3] }, { sprite: seated, seatTile: 'seat', fixedDir: true, cond: (g) => active(g), text: '生放送の観覧、当たったの！' })),
  ],
  events: [
    { x: 7, y: 7, w: 6, on: 'action', run: async (g) => g.say(active(g) ? `審査員席だ。${judgesNow(g).length}人の審査員が並んでいる。` : '審査員席だ。名札はまだ置かれていない。') },
  ],
  drawOver(ctx, g, cam) {
    if (!active(g)) return;
    ctx.fillStyle = 'rgba(255,248,220,0.07)';
    for (const cx of [5, 10, 15]) {
      const x0 = cx * 16 - cam.x, y0 = 40 - cam.y;
      ctx.beginPath(); ctx.moveTo(x0 - 5, y0); ctx.lineTo(x0 + 5, y0); ctx.lineTo(x0 + 26, y0 + 56); ctx.lineTo(x0 - 26, y0 + 56); ctx.closePath(); ctx.fill();
    }
  },
  onEnter: async (g) => { g.showBanner(active(g) ? `${vtitle(g)}　決勝スタジオ` : 'スタジオ（今日は収録なし）'); },
};

// ================================================================ OUTDOOR (屋外特設ステージ)
const outdoor = {
  floor: 'floor_concrete', bgm: 'town', topPad: 0, hideHud: false,
  tiles: [
    'CCCCCCCCCCCCCCCCCCCC',
    'kkkkkTTTTTTTTTTkkkkk',
    'kkkkk,,,,,,,,,,kkkkk',
    'kkkkk,,,,m,,,,,kkkkk',
    'bbbbbeeeeeeeeeebbbbb',
    '....................',
    '..wwwwwwwwwwwwwwww..',
    '..wwwwwwwwwwwwwwww..',
    '..wwwwwwwwwwwwwwww..',
    'N..................N',
    '....................',
    'ttt......OO......ttt',
  ],
  legend: { C: 'sr_city', k: 'sr_sky', T: 'sr_truss', ',': 'floor_stage', m: 'floor_stage+mic', e: 'stage_edge', b: 'fence', w: 'sr_crowd', N: 'floor_concrete+nobori', t: 'tree', O: 'exit_mat' },
  mic: [9, 2],
  entry: { x: 9, y: 10, dir: 'up' },
  warps: [{ x: 9, y: 11, room: 'lobby', tx: 9, ty: 9, dir: 'down' }, { x: 10, y: 11, room: 'lobby', tx: 9, ty: 9, dir: 'down' }],
  entities: [
    sign(5, 0.15, 10, 1.3, 'outdoor_banner', bannerPaint),
    npc('sr_omc', 6, 3, 'right', STAFF.mc2, { cond: (g) => active(g), talk: posted('right', async (g) => say(g, STAFF.mc2, active(g) ? ['屋外特設ステージへようこそ！', 'ここでは、お客さんと視聴者の投票で勝ち上がりが決まります！'] : '今日はイベントはありません。')) }),
  ],
  events: [
    { x: 0, y: 9, on: 'action', run: async (g) => g.say('のぼりがはためいている。') },
    { x: 19, y: 9, on: 'action', run: async (g) => g.say('のぼりがはためいている。') },
    { x: 2, y: 6, w: 16, h: 3, on: 'action', run: async (g) => g.say(active(g) ? '屋外ステージ前は、お客さんでぎっしりだ！\n寒空の下、みんな笑う準備をしている。' : 'ステージ前の広場だ。') },
  ],
  onEnter: async (g) => { g.showBanner(active(g) ? `${vtitle(g)}　屋外特設ステージ` : '屋外特設ステージ'); },
};

registerPlace({
  id: 'shourace', name: '賞レース会場', kind: 'building', bgm: 'office', wall: 'navy', noTrip: true,
  start: { room: 'lobby', x: 9, y: 10, dir: 'up' },
  rooms: { lobby, gakuya, sode, stage, studio, outdoor },
});
