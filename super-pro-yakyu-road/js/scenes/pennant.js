// スーパープロ野球ロード — the menu screens: the title, a new pennant (club, number of games, balance), the pennant hub
// (today's game: play it / skip it / skip a week, standings, players, leaders, results, settings, save) and the end of a season.
import { W, H, clamp, sound, txt, panel, menuList, inRect, roundRect } from '../core.js';
import { TEAMS, LEAGUES, teamOf, BALANCE, BALANCE_ORDER, BAT_ABL, grade, overall, pfull, pname, PITCHES, POS_SHORT } from '../data.js';
import { newLeague, loadLeague, saveLeague, hasSave, advanceDay, myGameToday, standings, leaders, LEADER_KEYS, avg, era, fmt3, ipText, GAME_OPTIONS, teamOfPlayer } from '../league.js';
import { drawChibi, lookOf, badge, pitchChip } from '../draw.js';
import { Match } from './match.js';
import { drawEmblem, logoOf, clearLogo, filePick, openPicker } from '../emblem.js';
import { tvHeader, plate, slant, TV, teamBar, medal, rowStripe } from '../tvgfx.js';
import { frontMenu, showPending, offseason } from './front_ui.js';
import { ensureFront, yen } from '../front.js';
import { Player3D } from '../gfx/player3d.js';
import { MOUND_H } from '../gfx/match3d.js';

// ---------------------------------------------------------------- the 3D stadium behind the menus
// every menu scene gets draw3d(): the camera circles the ballpark (the title: close to home, where a batter takes practice
// swings and a pitcher throws); the 2D menu is drawn over it with a see-through veil so the text stays easy to read
let glOn = false;
const VEIL = { Title: 0.18, Setup: 0.42, Hub: 0.42, SeasonEnd: 0.45 }; // the others (tables) get a darker veil
function menuCast(world) {
  if (!world.menuCast) {
    const bat = new Player3D({ ...lookOf({ num: 7 }, 'baystars'), helmet: true, gear: 'bat' });
    const pit = new Player3D({ ...lookOf({ num: 18 }, 'hawks'), gear: 'glove', away: true });
    bat.setPos(-0.95, 0.05); bat.face(0.5, 0.05);
    pit.setPos(0, 18.44, MOUND_H); pit.face(0, 0);
    world.scene.add(bat.root, pit.root);
    world.menuCast = { bat, pit, set visible(v) { bat.root.visible = v; pit.root.visible = v; } };
  }
  return world.menuCast;
}
function stage3d(scene, world, title) {
  glOn = true;
  const key = title ? 'title' : 'menu';
  if (world.mode !== 'orbit' || world.viewKey !== key) {
    world.setView('orbit', title ? { cx: 0, cy: 9, r: 21, h: 5.5, speed: 0.06, lookH: 1.6, fov: 48, a: -0.5 } : { cx: 0, cy: 44, r: 52, h: 24, speed: 0.03, lookH: 0, fov: 50 });
    world.viewKey = key;
    world.drawBoard({});
  }
  const cast = menuCast(world);
  cast.visible = !!title;
  if (title) { // a practice swing every 3 seconds, a pitch every 4
    const f = scene.f || 0, sw = (f % 180) / 180, pt = (f % 240) / 240;
    if (sw < 0.18) cast.bat.pose('swing', sw / 0.18); else cast.bat.pose('stance', f / 60);
    cast.pit.pose(pt < 0.7 ? 'windup' : 'stand', Math.min(1, pt / 0.7));
  }
}
// a background: a night stadium glow with drifting lights (over the 3D stadium: a see-through veil instead)
function bg(c, f, col = '#1b3c8f', who = '') {
  if (glOn) {
    const a = VEIL[who] != null ? VEIL[who] : 0.72;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(7,16,38,${a})`); g.addColorStop(1, `rgba(15,35,80,${Math.min(0.92, a + 0.15)})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = col; c.globalAlpha = 0.12; c.beginPath(); c.ellipse(W / 2, H + 120, 620, 300, 0, 0, 7); c.fill(); c.globalAlpha = 1;
    return;
  }
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#071026'); g.addColorStop(1, '#0f2350'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = col; c.globalAlpha = 0.18; c.beginPath(); c.ellipse(W / 2, H + 120, 620, 300, 0, 0, 7); c.fill(); c.globalAlpha = 1;
  for (let i = 0; i < 40; i++) { const x = (i * 137 + f * 0.3) % W, y = (i * 71) % (H - 120); c.fillStyle = `rgba(255,255,255,${0.05 + (i % 5) * 0.02})`; c.beginPath(); c.arc(x, y, 1 + (i % 3), 0, 7); c.fill(); }
}
function header(c, title, sub) { tvHeader(c, title, sub); }
// for the 球団運営 screens (front_ui.js)
export const menuBg = (c, f, col) => bg(c, f, col, '');
export const menuStage = (scene, world) => stage3d(scene, world, false);
const keyNav = (inp, n, sel) => { if (inp.rep('up')) { sound.sfx('cursor'); return (sel - 1 + n) % n; } if (inp.rep('down')) { sound.sfx('cursor'); return (sel + 1) % n; } return sel; };

// ================================================================ title
export class Title {
  constructor(g) { this.g = g; this.opaque = true; this.sel = 0; this.f = 0; }
  items() { return [{ id: 'new', label: 'ペナント（新しく始める）' }, { id: 'cont', label: 'ペナント（つづきから）', dim: !hasSave() }, { id: 'help', label: 'あそびかた' }]; }
  update(g) {
    this.f++;
    const it = this.items();
    this.sel = keyNav(g.input, it.length, this.sel);
    if (g.input.pressed('a')) this.pick(it[this.sel]);
  }
  pick(it) {
    const g = this.g;
    if (it.id === 'new') { sound.sfx('ok'); g.push(new Setup(g)); }
    if (it.id === 'cont') { const L = loadLeague(); if (!L) { sound.sfx('buzz'); g.toast('セーブデータがありません', '#ff8a8a'); return; } sound.sfx('ok'); g.replace(new Hub(g, L)); }
    if (it.id === 'help') { sound.sfx('ok'); g.push(new Help(g)); }
  }
  onTap(x, y) { const i = (this.rects || []).findIndex((r) => inRect(x, y, r)); if (i >= 0) { this.sel = i; this.pick(this.items()[i]); } }
  draw(c) {
    bg(c, this.f, '#1b3c8f', 'Title');
    // the title card, broadcast style: a red band, a navy plate, the gold title sliding in
    const f = this.f, k = Math.min(1, f / 24), e = 1 - Math.pow(1 - k, 3);
    c.save(); c.translate((1 - e) * -W, 0);
    c.fillStyle = TV.red; slant(c, 150, 62, 660, 132, 50); c.fill();
    plate(c, 176, 70, 640, 116, { k: 46 });
    c.restore();
    c.save(); c.translate((1 - e) * W * 0.6, 0);
    c.fillStyle = TV.red; slant(c, 214, 54, 150, 30, 10); c.fill();
    txt(c, 'SUPER', 289, 70, { size: 20, align: 'center', color: '#ffffff' });
    const sh = 1 + Math.sin(f / 50) * 0.01;
    c.save(); c.translate(W / 2 + 10, 128); c.scale(sh, sh);
    txt(c, 'プロ野球ロード', 0, 0, { size: 64, align: 'center', color: TV.gold2, stroke: '#1a0f00', strokeW: 9 });
    c.restore();
    txt(c, 'SUPER PRO BASEBALL ROAD', W / 2 + 10, 172, { size: 14, align: 'center', color: '#cfe0ff' });
    c.restore();
    // a light sweep across the title
    const sx = ((f * 9) % 1600) - 300;
    c.save(); slant(c, 176, 70, 640, 116, 46); c.clip();
    const sg = c.createLinearGradient(sx, 0, sx + 120, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.22)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sg; c.fillRect(sx, 70, 120, 116); c.restore();
    // the twelve clubs running along the bottom
    const ids = TEAMS.map((t) => t.id), cw = 92, total = cw * ids.length;
    plate(c, -20, H - 108, W + 40, 76, { k: 0, edge: 'rgba(245,197,66,0.6)' });
    for (let n = 0; n < ids.length * 2; n++) {
      const x = ((n * cw - f * 0.8) % (total * 2) + total * 2) % (total * 2) - cw;
      if (x < -cw || x > W) continue;
      c.fillStyle = 'rgba(255,255,255,0.94)'; roundRect(c, x + 8, H - 102, cw - 16, 64, 8); c.fill();
      drawEmblem(c, x + cw / 2, H - 70, 58, ids[n % ids.length]);
    }
    if (!glOn) {
      drawChibi(c, 180, 470, 2.2, lookOf({ num: 18 }, 'baystars'), 'ready', this.f / 60, {});
      drawChibi(c, 790, 470, 2.2, lookOf({ num: 11 }, 'hawks'), 'pitch', (this.f % 120) / 120, { flip: true, glove: true });
    }
    this.rects = menuList(c, 250, 212, 460, this.items(), this.sel, { rowH: 50 });
    txt(c, '球団名は実在の名称、選手はすべて架空です', W / 2, H - 14, { size: 11, align: 'center', color: 'rgba(220,230,250,0.75)', bold: false });
  }
}
class Help {
  constructor(g) { this.g = g; this.opaque = true; }
  update(g) { if (g.input.pressed('a') || g.input.pressed('b')) { sound.sfx('cancel'); g.pop(this); } }
  onTap() { this.g.pop(this); }
  draw(c) {
    bg(c, 0); header(c, 'あそびかた');
    const lines = [
      '【ペナント】球団をえらんで、シーズンを戦います。毎日1試合。自分で試合をするか、結果だけ見て飛ばせます。',
      '【攻撃】十字キーでミートカーソルを動かし、ボールが来たら A でミート打ち、B で強振（カーソルは小さいが強い打球）。',
      '　カーソルの中心よりボールが下ならゴロ、上ならフライになりやすい。早く振れば引っぱり、遅ければ流し打ち。',
      '【守備】↑↓で球種、A で決定。十字キーでコースを決めて A で投げる。コントロールが低いと、ねらいがずれます。',
      '　ストライクゾーンのすみは打たれにくいが、外れるとボール。変化球は最後に曲がります。',
      '【START】オート（この回／試合終了まで）、投手交代。',
      '【バランス】投高・標準・打高・超打高。ペナント開始時と、拠点の「設定」で変えられます。',
    ];
    lines.forEach((l, i) => txt(c, l, 40, 100 + i * 50, { size: 16, color: '#eef3ff', bold: false, max: 880 }));
    txt(c, 'A / B でもどる', W / 2, H - 30, { size: 14, align: 'center', color: '#9fb6e8' });
  }
}

// ================================================================ a new pennant
class Setup {
  constructor(g) { this.g = g; this.opaque = true; this.step = 0; this.team = 0; this.games = 1; this.bal = 1; this.f = 0; }
  update(g) {
    this.f++;
    const inp = g.input;
    if (inp.pressed('b')) { sound.sfx('cancel'); if (this.step === 0) g.pop(this); else this.step--; return; }
    if (this.step === 0) {
      if (inp.rep('right')) { this.team = (this.team + 1) % 12; sound.sfx('cursor'); }
      if (inp.rep('left')) { this.team = (this.team + 11) % 12; sound.sfx('cursor'); }
      if (inp.rep('down')) { this.team = (this.team + 6) % 12; sound.sfx('cursor'); }
      if (inp.rep('up')) { this.team = (this.team + 6) % 12; sound.sfx('cursor'); }
    } else if (this.step === 1) this.games = keyNav(inp, GAME_OPTIONS.length, this.games);
    else if (this.step === 2) this.bal = keyNav(inp, BALANCE_ORDER.length, this.bal);
    if (inp.pressed('a')) this.next();
  }
  next() {
    sound.sfx('ok');
    if (this.step < 2) { this.step++; return; }
    const L = newLeague({ myTeam: TEAMS[this.team].id, games: GAME_OPTIONS[this.games], balance: BALANCE_ORDER[this.bal] });
    saveLeague(L);
    this.g.replace(new Hub(this.g, L));
    this.g.toast(`${teamOf(L.myTeam).full}でペナント開始！`, '#ffd23f');
  }
  onTap(x, y) {
    if (this.step === 0) { const i = (this.rects || []).findIndex((r) => inRect(x, y, r)); if (i >= 0) { if (this.team === i) this.next(); else { this.team = i; sound.sfx('cursor'); } } return; }
    const i = (this.rects || []).findIndex((r) => inRect(x, y, r));
    if (i >= 0) { if (this.step === 1) this.games = i; else this.bal = i; this.next(); }
  }
  draw(c) {
    const t = TEAMS[this.team];
    bg(c, this.f, t.c1, this instanceof Setup ? 'Setup' : '');
    header(c, ['球団をえらぶ', '試合数をえらぶ', 'リーグのバランス'][this.step], `${this.step + 1} / 3`);
    if (this.step === 0) {
      this.rects = [];
      ['C', 'P'].forEach((lg, li) => {
        txt(c, LEAGUES[lg].name, 40, 84 + li * 196, { size: 16, color: '#9fb6e8' });
        TEAMS.filter((x) => x.league === lg).forEach((x, i) => {
          const idx = TEAMS.indexOf(x), bx = 30 + i * 150, by = 98 + li * 196, on = idx === this.team;
          c.save();
          if (on) { c.shadowColor = '#ffd23f'; c.shadowBlur = 18; }
          c.fillStyle = x.c1; roundRect(c, bx, by, 140, 170, 14); c.fill();
          c.restore();
          if (on) { c.strokeStyle = '#ffd23f'; c.lineWidth = 4; roundRect(c, bx, by, 140, 170, 14); c.stroke(); }
          c.fillStyle = 'rgba(255,255,255,0.92)'; roundRect(c, bx + 8, by + 8, 124, 114, 10); c.fill();
          drawEmblem(c, bx + 70, by + 65, 104, x.id);
          c.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(c, bx + 6, by + 128, 128, 36, 8); c.fill();
          txt(c, x.short, bx + 70, by + 146, { size: 16, align: 'center', color: '#ffffff', max: 124 });
          this.rects[idx] = { x: bx, y: by, w: 140, h: 170 };
        });
      });
      txt(c, `${t.full}`, W / 2, H - 44, { size: 22, align: 'center', color: '#ffffff' });
      txt(c, '←→↑↓ えらぶ　A 決定　B もどる', W / 2, H - 16, { size: 13, align: 'center', color: '#9fb6e8' });
      return;
    }
    if (this.step === 1) {
      const items = GAME_OPTIONS.map((n) => ({ label: `${n}試合`, sub: n === 143 ? '本番と同じ長さのシーズン' : n === 60 ? 'ほどよい長さ' : 'さくっと遊ぶ' }));
      this.rects = menuList(c, 280, 140, 400, items, this.games, { rowH: 70 });
    } else {
      const items = BALANCE_ORDER.map((k) => ({ label: BALANCE[k].name, sub: BALANCE[k].desc }));
      this.rects = menuList(c, 250, 120, 460, items, this.bal, { rowH: 70 });
    }
    txt(c, `${t.full}・${GAME_OPTIONS[this.games]}試合${this.step === 2 ? `・${BALANCE[BALANCE_ORDER[this.bal]].name}` : ''}`, W / 2, H - 44, { size: 18, align: 'center' });
    txt(c, '↑↓ えらぶ　A 決定　B もどる', W / 2, H - 16, { size: 13, align: 'center', color: '#9fb6e8' });
  }
}

// ================================================================ the pennant hub
export class Hub {
  constructor(g, L) { this.g = g; this.L = L; this.opaque = true; this.sel = 0; this.f = 0; ensureFront(L); }
  items() {
    const L = this.L, over = L.over;
    return [
      { id: 'play', label: '試合をする', dim: over || !myGameToday(L), sub: over ? 'シーズンは終わった' : '' },
      { id: 'skip', label: '試合を飛ばす（結果だけ）', dim: over },
      { id: 'week', label: '7日まとめて進める', dim: over },
      ...(over ? [{ id: 'off', label: 'オフシーズンへ', sub: '契約更改・FA・トライアウト → 次のシーズン', right: '★' }] : []),
      { id: 'front', label: '球団運営', right: L.front && L.front.pending.length ? '！' : '' },
      { id: 'stand', label: '順位表' },
      { id: 'roster', label: '選手一覧・能力' },
      { id: 'lead', label: '成績ランキング' },
      { id: 'res', label: '最近の試合結果' },
      { id: 'set', label: '設定（バランス・球団マーク）', right: BALANCE[L.balance].name },
      { id: 'save', label: 'セーブ' },
      { id: 'title', label: 'タイトルへ' },
    ];
  }
  update(g) {
    this.f++;
    const it = this.items();
    this.sel = keyNav(g.input, it.length, this.sel);
    if (g.input.pressed('a')) this.pick(it[this.sel]);
  }
  pick(it) {
    const g = this.g, L = this.L;
    if (it.dim) { sound.sfx('buzz'); return; }
    sound.sfx('ok');
    if (it.id === 'play') {
      const m = myGameToday(L);
      g.push(new Match(g, L, { home: m.h, away: m.a, done: (GS) => { advanceDay(L, GS); saveLeague(L); this.after(); } }));
    } else if (it.id === 'skip' || it.id === 'week') {
      const n = it.id === 'week' ? 7 : 1;
      let last = null;
      for (let i = 0; i < n && !L.over; i++) last = advanceDay(L, null, true);
      saveLeague(L);
      const mine = last && last.find((x) => x.mine);
      if (mine) { const my = mine.h === L.myTeam ? mine.hs : mine.as, op = mine.h === L.myTeam ? mine.as : mine.hs; g.toast(`${n > 1 ? '7日後　' : ''}${my > op ? '勝ち' : my < op ? '負け' : '引き分け'} ${my}-${op}（対${teamOf(mine.h === L.myTeam ? mine.a : mine.h).short}）`, my > op ? '#ffd23f' : '#cfd8ee'); }
      this.after();
    } else if (it.id === 'front') g.push(frontMenu(g, L));
    else if (it.id === 'off') g.push(offseason(g, L, () => { saveLeague(L); this.sel = 0; g.toast(`${L.year}年シーズン開幕！`, '#ffd23f'); }));
    else if (it.id === 'stand') g.push(new Standings(g, L));
    else if (it.id === 'roster') g.push(new Roster(g, L));
    else if (it.id === 'lead') g.push(new Leaders(g, L));
    else if (it.id === 'res') g.push(new Results(g, L));
    else if (it.id === 'set') g.push(new Settings(g, L));
    else if (it.id === 'save') { g.toast(saveLeague(L) ? 'セーブしました' : 'このブラウザでは保存できません（この画面のあいだだけ残ります）', '#7af0a0'); }
    else if (it.id === 'title') g.replace(new Title(g));
  }
  after() { showPending(this.g, this.L, () => { if (this.L.over && !this.L.endShown) { this.L.endShown = true; this.g.push(new SeasonEnd(this.g, this.L)); } }); }
  onTap(x, y) { const i = (this.rects || []).findIndex((r) => inRect(x, y, r)); if (i >= 0) { if (this.sel === i) this.pick(this.items()[i]); else { this.sel = i; sound.sfx('cursor'); } } }
  draw(c) {
    const L = this.L, me = teamOf(L.myTeam), T = L.teams[L.myTeam];
    bg(c, this.f, me.c1, 'Hub');
    header(c, 'ペナント', `${L.year}年　${BALANCE[L.balance].name}　第${Math.min(L.day + 1, L.games)}戦 / 全${L.games}試合`);
    // my club
    panel(c, 24, 76, 420, 196, { top: me.c1, bottom: '#0b1a33' });
    c.fillStyle = 'rgba(255,255,255,0.92)'; roundRect(c, 34, 104, 118, 132, 12); c.fill();
    drawEmblem(c, 93, 170, 108, L.myTeam);
    txt(c, me.full, 160, 104, { size: 22, max: 270 });
    const rows = standings(L, me.league), rank = rows.findIndex((r) => r.id === L.myTeam) + 1;
    txt(c, `${LEAGUES[me.league].short}　${rank}位`, 160, 138, { size: 18, color: '#ffd23f' });
    txt(c, `${T.w}勝 ${T.l}敗 ${T.d}分　勝率${fmt3(T.w + T.l ? T.w / (T.w + T.l) : 0)}`, 160, 166, { size: 16, bold: false });
    txt(c, `得点${T.rs}　失点${T.ra}　${T.streak > 0 ? `${T.streak}連勝中` : T.streak < 0 ? `${-T.streak}連敗中` : ''}`, 160, 192, { size: 14, color: '#cfd8ee', bold: false });
    txt(c, `最近10試合：${T.last.map((x) => (x === 'W' ? '○' : x === 'L' ? '●' : '△')).join('')}`, 160, 220, { size: 14, color: '#cfd8ee', bold: false });
    // today
    panel(c, 24, 284, 420, 168);
    const m = myGameToday(L);
    if (L.over) { txt(c, 'ペナントレース終了', 234, 340, { size: 24, align: 'center', color: '#ffd23f' }); const champ = ['C', 'P'].map((lg) => `${LEAGUES[lg].short}：${teamOf(standings(L, lg)[0].id).short}`).join('　'); txt(c, `優勝　${champ}`, 234, 384, { size: 16, align: 'center' }); }
    else if (m) {
      txt(c, '今日の試合', 44, 306, { size: 14, color: '#9fb6e8' });
      const a = teamOf(m.a), h = teamOf(m.h);
      [[a, 110], [h, 358]].forEach(([t, x]) => { c.fillStyle = t.c1; roundRect(c, x - 80, 324, 160, 54, 12); c.fill(); txt(c, t.short, x, 351, { size: 20, align: 'center', max: 150 }); });
      txt(c, 'VS', 234, 351, { size: 22, align: 'center', color: '#ffd23f' });
      const sp = (id) => { const t2 = L.teams[id]; return L.P[t2.rotation[t2.rot % t2.rotation.length]]; };
      txt(c, `先発 ${pname(sp(m.a))}`, 110, 398, { size: 13, align: 'center', color: '#cfd8ee', bold: false });
      txt(c, `先発 ${pname(sp(m.h))}`, 358, 398, { size: 13, align: 'center', color: '#cfd8ee', bold: false });
      txt(c, `${m.h === L.myTeam ? 'ホーム' : 'ビジター'}`, 234, 430, { size: 13, align: 'center', color: '#9fb6e8' });
    }
    const its = this.items();
    this.rects = menuList(c, 468, 76, 468, its, this.sel, { rowH: Math.min(44, Math.floor(436 / its.length)), size: 16 });
    // the club's money and mood
    const Fr = L.front;
    if (Fr) { plate(c, 24, 462, 420, 50, { k: 14 }); txt(c, `資金 ${yen(Fr.money)}`, 44, 478, { size: 14, color: '#ffffff' }); txt(c, `人気 ${Math.round(Fr.fans)}　士気 ${Math.round(Fr.morale)}　選手会 ${Math.round(Fr.union)}`, 44, 498, { size: 12, color: TV.dim, bold: false }); txt(c, Fr.mgr.mode === 'rest' ? '監督代行' : Fr.mgr.mode === 'player' ? '兼任監督' : `監督 ${Fr.mgr.name}`, 428, 488, { size: 12, align: 'right', color: TV.gold2, max: 150 }); }
    txt(c, '↑↓ えらぶ　A 決定', W - 24, H - 16, { size: 12, align: 'right', color: '#9fb6e8' });
  }
}

// ================================================================ standings
class Standings {
  constructor(g, L) { this.g = g; this.L = L; this.opaque = true; }
  update(g) { if (g.input.pressed('b') || g.input.pressed('a')) { sound.sfx('cancel'); g.pop(this); } }
  onTap() { this.g.pop(this); }
  draw(c) {
    const L = this.L;
    bg(c, 0); header(c, '順位表', `${L.day}日目`);
    ['C', 'P'].forEach((lg, li) => {
      const x0 = 24 + li * 468;
      panel(c, x0, 74, 444, 390);
      txt(c, LEAGUES[lg].name, x0 + 18, 98, { size: 17, color: '#ffd23f' });
      const cols = ['', '球団', '勝', '敗', '分', '勝率', '差'];
      const cx = [x0 + 20, x0 + 44, x0 + 214, x0 + 254, x0 + 294, x0 + 344, x0 + 410];
      cols.forEach((h, i) => txt(c, h, cx[i], 128, { size: 12, color: '#9fb6e8', align: i >= 2 ? 'center' : 'left' }));
      standings(L, lg).forEach((r, i) => {
        const y = 160 + i * 50, mine = r.id === L.myTeam;
        rowStripe(c, x0 + 8, y - 22, 428, 44, i, mine);
        medal(c, cx[0] + 4, y, 12, i + 1);
        teamBar(c, cx[1], y - 16, 154, 32, r.id, { size: 15 });
        [r.w, r.l, r.d].forEach((v, k) => txt(c, String(v), cx[2 + k], y, { size: 16, align: 'center' }));
        txt(c, fmt3(r.pct), cx[5], y, { size: 16, align: 'center' });
        txt(c, i === 0 ? '—' : r.gb.toFixed(1), cx[6], y, { size: 15, align: 'center', color: '#cfd8ee' });
      });
    });
    txt(c, 'A / B でもどる', W / 2, H - 22, { size: 13, align: 'center', color: '#9fb6e8' });
  }
}

// ================================================================ players
class Roster {
  constructor(g, L) { this.g = g; this.L = L; this.opaque = true; this.team = TEAMS.findIndex((t) => t.id === L.myTeam); this.tab = 0; this.sel = 0; this.f = 0; }
  list() { const T = this.L.teams[TEAMS[this.team].id]; const ps = T.roster.map((id) => this.L.P[id]); return (this.tab === 0 ? ps.filter((p) => !p.pitcher).sort((a, b) => (T.lineup.indexOf(a.id) + 1 || 99) - (T.lineup.indexOf(b.id) + 1 || 99)) : ps.filter((p) => p.pitcher).sort((a, b) => ['sp', 'rp', 'cl'].indexOf(a.role) - ['sp', 'rp', 'cl'].indexOf(b.role) || overall(b) - overall(a))); }
  update(g) {
    this.f++;
    const inp = g.input, n = this.list().length;
    if (inp.pressed('b')) { sound.sfx('cancel'); g.pop(this); return; }
    if (inp.rep('left')) { this.team = (this.team + 11) % 12; this.sel = 0; sound.sfx('cursor'); }
    if (inp.rep('right')) { this.team = (this.team + 1) % 12; this.sel = 0; sound.sfx('cursor'); }
    if (inp.pressed('a')) { this.tab = 1 - this.tab; this.sel = 0; sound.sfx('ok'); }
    this.sel = keyNav(inp, n, this.sel);
  }
  onTap(x, y) { const i = (this.rects || []).findIndex((r) => inRect(x, y, r)); if (i >= 0) this.sel = i; else if (y < 70) { this.tab = 1 - this.tab; this.sel = 0; } }
  draw(c) {
    const L = this.L, t = TEAMS[this.team], T = L.teams[t.id];
    bg(c, this.f, t.c1, this instanceof Setup ? 'Setup' : '');
    header(c, `${t.full}　${this.tab === 0 ? '野手' : '投手'}`, '←→ 球団　A 野手/投手　B もどる');
    const ps = this.list();
    panel(c, 16, 70, 470, 452);
    this.rects = [];
    const top = clamp(this.sel - 9, 0, Math.max(0, ps.length - 13));
    ps.slice(top, top + 13).forEach((p, j) => {
      const i = top + j, y = 92 + j * 33, on = i === this.sel;
      if (on) { c.fillStyle = 'rgba(255,210,63,0.22)'; roundRect(c, 24, y - 15, 454, 30, 6); c.fill(); }
      const lu = T.lineup.indexOf(p.id);
      txt(c, p.pitcher ? ({ sp: '先', rp: '中', cl: '抑' })[p.role] : lu >= 0 ? `${lu + 1}` : '控', 40, y, { size: 13, align: 'center', color: '#9fb6e8' });
      txt(c, p.pitcher ? '投' : POS_SHORT[(T.pos && T.pos[p.id]) || p.pos], 66, y, { size: 13, align: 'center', color: '#ffd23f' });
      txt(c, pfull(p), 86, y, { size: 15, max: 150 });
      if (p.pitcher) { txt(c, `${p.velo}km`, 260, y, { size: 13, color: '#cfd8ee', bold: false }); txt(c, `防${era(p.s).toFixed(2)} ${p.s.w}勝${p.s.l}敗${p.s.sv ? `${p.s.sv}S` : ''}`, 470, y, { size: 12, align: 'right', color: '#cfd8ee', bold: false }); }
      else { const gs = ['meet', 'power', 'speed'].map((k) => grade(p[k])); gs.forEach((gd, k) => { c.fillStyle = gd.col; roundRect(c, 250 + k * 24, y - 9, 20, 18, 4); c.fill(); txt(c, gd.g, 260 + k * 24, y, { size: 12, align: 'center', color: '#1a1206' }); }); txt(c, `${fmt3(avg(p.s))} ${p.s.hr}本 ${p.s.rbi}点`, 470, y, { size: 12, align: 'right', color: '#cfd8ee', bold: false }); }
      this.rects[i - top] = { x: 24, y: y - 15, w: 454, h: 30 };
    });
    // the detail card
    const p = ps[this.sel];
    if (!p) return;
    panel(c, 500, 70, 444, 452, { top: t.c1, bottom: '#0b1a33' });
    c.fillStyle = 'rgba(255,255,255,0.94)'; roundRect(c, 516, 88, 130, 130, 12); c.fill(); drawEmblem(c, 581, 153, 118, t.id);
    txt(c, `${p.num}`, 660, 100, { size: 30, color: '#ffd23f' });
    txt(c, pfull(p), 660, 136, { size: 22, max: 270 });
    txt(c, `${p.pitcher ? `${p.throws === 'L' ? '左' : '右'}投` : `${p.bats === 'L' ? '左' : '右'}打`}・${p.age}歳・総合${overall(p)}`, 660, 166, { size: 14, color: '#cfd8ee', bold: false });
    if (p.pitcher) {
      txt(c, `球速 ${p.velo}km/h`, 660, 198, { size: 18 });
      badge(c, 660, 214, p.control, 'コントロール', { w: 132 }); badge(c, 800, 214, p.stamina, 'スタミナ', { w: 120 });
      [{ t: 'st', lv: 0 }, ...p.pitches].forEach((x, i) => pitchChip(c, 520 + (i % 2) * 210, 270 + Math.floor(i / 2) * 32, x, { w: 200 }));
      const s = p.s;
      txt(c, `${s.pg}試合 ${s.w}勝${s.l}敗 ${s.sv}S　防御率${era(s).toFixed(2)}`, 520, 420, { size: 15 });
      txt(c, `投球回${ipText(s.outs)}　奪三振${s.pso}　与四球${s.pbb}　被本塁打${s.phr}`, 520, 448, { size: 13, color: '#cfd8ee', bold: false });
    } else {
      txt(c, `弾道 ${'↗'.repeat(p.traj)}`, 660, 198, { size: 16, color: '#ffd23f' });
      BAT_ABL.forEach(([k, lb], i) => badge(c, 520 + (i % 3) * 140, 260 + Math.floor(i / 3) * 34, p[k], lb, { w: 130 }));
      const s = p.s;
      txt(c, `${s.g}試合 打率${fmt3(avg(s))} ${s.hr}本塁打 ${s.rbi}打点`, 520, 380, { size: 15 });
      txt(c, `${s.ab}打数${s.h}安打　二塁打${s.d2}　三塁打${s.d3}　四球${s.bb}　三振${s.so}`, 520, 408, { size: 13, color: '#cfd8ee', bold: false });
    }
  }
}

// ================================================================ leaders
class Leaders {
  constructor(g, L) { this.g = g; this.L = L; this.opaque = true; this.k = 0; this.lg = 0; }
  update(g) {
    const inp = g.input;
    if (inp.pressed('b')) { sound.sfx('cancel'); g.pop(this); return; }
    if (inp.rep('left')) { this.k = (this.k + LEADER_KEYS.length - 1) % LEADER_KEYS.length; sound.sfx('cursor'); }
    if (inp.rep('right')) { this.k = (this.k + 1) % LEADER_KEYS.length; sound.sfx('cursor'); }
    if (inp.pressed('a') || inp.rep('up') || inp.rep('down')) { this.lg = 1 - this.lg; sound.sfx('cursor'); }
  }
  onTap(x) { if (x > W / 2) this.k = (this.k + 1) % LEADER_KEYS.length; else this.k = (this.k + LEADER_KEYS.length - 1) % LEADER_KEYS.length; }
  draw(c) {
    const L = this.L, lg = ['C', 'P'][this.lg];
    const b = leaders(L, LEADER_KEYS[this.k], lg, 10);
    bg(c, 0); header(c, `成績ランキング　${b.name}`, `${LEAGUES[lg].short}　←→ 項目　A リーグ　B もどる`);
    panel(c, 180, 74, 600, 420);
    b.rows.forEach((r, i) => {
      const y = 106 + i * 38, mine = r.team === L.myTeam;
      rowStripe(c, 190, y - 17, 580, 34, i, mine);
      medal(c, 214, y, 12, i + 1);
      teamBar(c, 236, y - 13, 112, 26, r.team, { size: 13 });
      txt(c, pfull(r.p), 356, y, { size: 16, max: 240 });
      txt(c, r.v, 750, y, { size: 18, align: 'right', color: '#ffd23f' });
    });
    if (!b.rows.length) txt(c, 'まだ記録がありません（規定に達した選手がいない）', W / 2, 260, { size: 16, align: 'center', color: '#9fb6e8' });
  }
}

// ================================================================ recent results
class Results {
  constructor(g, L) { this.g = g; this.L = L; this.opaque = true; this.d = L.results.length - 1; }
  update(g) { const inp = g.input; if (inp.pressed('b') || inp.pressed('a')) { sound.sfx('cancel'); g.pop(this); return; } if (inp.rep('left')) this.d = Math.max(0, this.d - 1); if (inp.rep('right')) this.d = Math.min(this.L.results.length - 1, this.d + 1); }
  onTap() { this.g.pop(this); }
  draw(c) {
    const L = this.L, day = L.results[this.d];
    bg(c, 0); header(c, '最近の試合結果', `${L.day - (L.results.length - 1 - this.d)}日目　←→ 日付　B もどる`);
    if (!day) { txt(c, 'まだ試合がありません', W / 2, 260, { size: 18, align: 'center', color: '#9fb6e8' }); return; }
    day.forEach((r, i) => {
      const x = 40 + (i % 2) * 450, y = 90 + Math.floor(i / 2) * 120;
      panel(c, x, y, 430, 104, { edge: r.mine ? '#ffd23f' : undefined });
      [[r.a, r.as, 0], [r.h, r.hs, 1]].forEach(([id, sc, k]) => { teamBar(c, x + 16, y + 14 + k * 40, 224, 32, id, { size: 15 }); c.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(c, x + 258, y + 14 + k * 40, 60, 32, 6); c.fill(); txt(c, String(sc), x + 288, y + 31 + k * 40, { size: 22, align: 'center', color: (k ? r.hs > r.as : r.as > r.hs) ? '#ffd23f' : '#ffffff' }); });
      const d = r.dec || {};
      txt(c, [d.win ? `勝 ${pname(L.P[d.win])}` : '', d.lose ? `負 ${pname(L.P[d.lose])}` : '', d.save ? `S ${pname(L.P[d.save])}` : ''].filter(Boolean).join('\n') || '引き分け', x + 330, y + 52, { size: 12, color: '#cfd8ee', bold: false, max: 96 });
    });
  }
}

// ================================================================ settings: the balance
class Settings {
  constructor(g, L) {
    this.g = g; this.L = L; this.opaque = true; this.sel = BALANCE_ORDER.indexOf(L.balance);
    filePick.onPicked = (id, ok) => { g.toast(ok ? '球団マークの画像を設定しました' : '画像を読みこめませんでした', ok ? '#7af0a0' : '#ff8a8a'); };
  }
  items() {
    return [...BALANCE_ORDER.map((k) => ({ label: BALANCE[k].name, sub: BALANCE[k].desc, right: k === this.L.balance ? 'いま' : '' })),
      { label: '球団マークの画像をえらぶ', sub: '自分の端末の画像を使う（このブラウザにだけ保存）', id: 'logo' },
      { label: '球団マークをもとにもどす', sub: '自分でえらんだ画像をやめる', id: 'unlogo', dim: !logoOf(this.L.myTeam) }];
  }
  leave() { filePick.armed = null; }
  update(g) {
    const inp = g.input, it = this.items();
    if (inp.pressed('b')) { sound.sfx('cancel'); filePick.armed = null; g.pop(this); return; }
    this.sel = keyNav(inp, it.length, this.sel);
    filePick.armed = it[this.sel].id === 'logo' ? this.L.myTeam : null; // the key press itself opens the picker (main.js)
    if (inp.pressed('a')) this.pick(false);
  }
  pick(tap) {
    const it = this.items()[this.sel];
    if (it.id === 'logo') { if (tap) { filePick.armed = this.L.myTeam; openPicker(); } return; }
    if (it.id === 'unlogo') { clearLogo(this.L.myTeam); sound.sfx('ok'); this.g.toast('オリジナルのマークにもどしました', '#7af0a0'); return; }
    this.L.balance = BALANCE_ORDER[this.sel]; saveLeague(this.L); sound.sfx('ok'); this.g.toast(`バランスを「${BALANCE[this.L.balance].name}」にしました`, '#7af0a0'); filePick.armed = null; this.g.pop(this);
  }
  onTap(x, y) { const i = (this.rects || []).findIndex((r) => inRect(x, y, r)); if (i >= 0) { this.sel = i; this.pick(true); } }
  draw(c) {
    bg(c, 0); header(c, '設定', 'A 決定　B もどる');
    this.rects = menuList(c, 170, 76, 470, this.items(), this.sel, { rowH: 66 });
    panel(c, 676, 120, 250, 250);
    txt(c, 'いまの球団マーク', 801, 146, { size: 14, align: 'center', color: '#9fb6e8' });
    c.fillStyle = 'rgba(255,255,255,0.92)'; roundRect(c, 701, 164, 200, 190, 12); c.fill();
    drawEmblem(c, 801, 259, 170, this.L.myTeam);
    txt(c, 'バランス：ヒット・ホームラン・三振の出やすさ（コンピュータの試合にも自分の試合にも）', W / 2, 500, { size: 12, align: 'center', color: '#9fb6e8', bold: false, max: 900 });
  }
}

// ================================================================ the end of a season
class SeasonEnd {
  constructor(g, L) { this.g = g; this.L = L; this.opaque = true; this.f = 0; sound.sfx('fanfare'); }
  update(g) { this.f++; if (this.f > 30 && g.input.pressed('a')) g.pop(this); }
  onTap() { if (this.f > 30) this.g.pop(this); }
  draw(c) {
    const L = this.L;
    bg(c, this.f, teamOf(L.myTeam).c1, 'SeasonEnd');
    header(c, `${L.year}年　ペナントレース終了`);
    ['C', 'P'].forEach((lg, li) => {
      const champ = standings(L, lg)[0], t = teamOf(champ.id);
      const x = 70 + li * 430;
      panel(c, x, 90, 390, 250, { top: t.c1, bottom: '#0b1a33' });
      txt(c, `${LEAGUES[lg].name} 優勝`, x + 195, 120, { size: 18, align: 'center', color: '#ffd23f' });
      c.fillStyle = 'rgba(255,255,255,0.94)'; roundRect(c, x + 135, 206, 120, 120, 12); c.fill(); drawEmblem(c, x + 195, 266, 108, champ.id);
      txt(c, t.full, x + 195, 160, { size: 20, align: 'center', max: 360 });
      txt(c, `${champ.w}勝${champ.l}敗${champ.d}分`, x + 195, 190, { size: 16, align: 'center', bold: false });
    });
    const mine = L.teams[L.myTeam], lg = teamOf(L.myTeam).league, rank = standings(L, lg).findIndex((r) => r.id === L.myTeam) + 1;
    txt(c, `${teamOf(L.myTeam).full}：${rank}位（${mine.w}勝${mine.l}敗${mine.d}分）`, W / 2, 380, { size: 20, align: 'center', color: rank === 1 ? '#ffd23f' : '#ffffff' });
    const k = ['avg', 'hr', 'era'].map((key) => { const b = leaders(L, key, lg, 1); return b.rows[0] ? `${b.name}：${pname(b.rows[0].p)}（${teamOf(b.rows[0].team).short}）${b.rows[0].v}` : ''; }).filter(Boolean);
    txt(c, k.join('　'), W / 2, 420, { size: 14, align: 'center', color: '#cfd8ee', bold: false, max: 900 });
    txt(c, 'A で拠点へ（「オフシーズンへ」から次のシーズン）', W / 2, H - 30, { size: 14, align: 'center', color: '#9fb6e8' });
  }
}

// the 3D stadium behind every menu screen
for (const C of [Title, Help, Setup, Hub, Standings, Roster, Leaders, Results, Settings, SeasonEnd]) C.prototype.draw3d = function (world) { stage3d(this, world, this instanceof Title); };
