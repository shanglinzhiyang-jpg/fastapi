// スーパープロ野球ロード — the 球団運営 screens (front office) and the off-season, in the broadcast style.
// One list scene (Pick: a title, rows, a side panel) and one question box (Ask) carry every screen.
import { W, H, sound, txt, panel, menuList, inRect, roundRect, clamp } from '../core.js';
import { teamOf, overall, grade, pfull, pname, POS_SHORT } from '../data.js';
import { BALLS } from '../game.js';
import * as F from '../front.js';
import { drawEmblem } from '../emblem.js';
import { tvHeader, plate, TV } from '../tvgfx.js';
import { menuBg, menuStage } from './pennant.js';

const posOf = (p) => (p.pitcher ? (p.role === 'sp' ? '先' : p.role === 'cl' ? '抑' : '中') : POS_SHORT[p.pos] || p.pos);
const tierName = ['', '一軍', '二軍', '三軍'];
const statusOf = (p) => [p.inj > 0 ? `ケガ${p.inj}日` : '', p.susp > 0 ? `停止${p.susp}日` : ''].filter(Boolean).join(' ');
// one row for a player
export const prow = (L, p, right) => ({ label: `${posOf(p)}　${pfull(p)}`, sub: `${p.age}歳　総合${overall(p)}（${grade(overall(p)).g}）　年俸${F.yen(p.sal)}${statusOf(p) ? `　${statusOf(p)}` : ''}`, right: right != null ? right : '', pid: p.id });

// ---------------------------------------------------------------- a list scene
export class Pick {
  // o = { title, sub, items: () => [...], onPick(it, scene), side(c, it, scene), rowH, w, back() }
  constructor(g, L, o) { this.g = g; this.L = L; this.o = o; this.opaque = true; this.sel = o.sel || 0; this.top = 0; this.f = 0; }
  items() { return this.o.items(this) || []; }
  update(g) {
    this.f++;
    const it = this.items(), n = it.length, inp = g.input;
    if (inp.pressed('b')) { sound.sfx('cancel'); if (this.o.back) this.o.back(this); else g.pop(this); return; }
    if (!n) return;
    if (inp.rep('up')) { this.sel = (this.sel - 1 + n) % n; sound.sfx('cursor'); }
    if (inp.rep('down')) { this.sel = (this.sel + 1) % n; sound.sfx('cursor'); }
    this.sel = clamp(this.sel, 0, n - 1);
    if (inp.pressed('a')) this.pick(it[this.sel]);
  }
  pick(it) { if (!it) return; if (it.dim) { sound.sfx('buzz'); return; } sound.sfx('ok'); this.o.onPick && this.o.onPick(it, this); }
  onTap(x, y) { const i = (this.rects || []).findIndex((r) => inRect(x, y, r)); if (i >= 0) { const k = this.rects[i].i + this.top; if (this.sel === k) this.pick(this.items()[k]); else { this.sel = k; sound.sfx('cursor'); } } }
  draw(c) {
    const it = this.items(), rh = this.o.rowH || 50, w = this.o.w || 520, vis = Math.floor(420 / rh);
    menuBg(c, this.f, this.L ? teamOf(this.L.myTeam).c1 : '#1b3c8f');
    tvHeader(c, this.o.title, typeof this.o.sub === 'function' ? this.o.sub(this) : this.o.sub);
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + vis) this.top = this.sel - vis + 1;
    this.top = clamp(this.top, 0, Math.max(0, it.length - vis));
    const shown = it.slice(this.top, this.top + vis);
    this.rects = menuList(c, 24, 72, w, shown, this.sel - this.top, { rowH: rh, size: 17 });
    if (it.length > vis) { txt(c, `${this.top + 1}–${this.top + shown.length} / ${it.length}`, 24 + w, 66, { size: 11, align: 'right', color: TV.dim }); }
    if (!it.length) txt(c, this.o.empty || '（なし）', 24 + w / 2, 200, { size: 16, align: 'center', color: TV.dim });
    if (this.o.side) { panel(c, w + 44, 72, W - w - 64, 420); this.o.side(c, it[this.sel], this, w + 60, 96); }
    txt(c, this.o.help || '↑↓ えらぶ　A 決定　B もどる', W - 24, H - 14, { size: 12, align: 'right', color: TV.dim });
  }
}
Pick.prototype.draw3d = function (world) { menuStage(this, world); };

// ---------------------------------------------------------------- a question box over the current screen
export class Ask {
  // o = { title, lines: [...], choices: [labels], onPick(i), color }
  constructor(g, o) { this.g = g; this.o = o; this.sel = 0; this.f = 0; }
  update(g) {
    this.f++;
    const n = this.o.choices.length, inp = g.input;
    if (inp.rep('up') || inp.rep('left')) { this.sel = (this.sel - 1 + n) % n; sound.sfx('cursor'); }
    if (inp.rep('down') || inp.rep('right')) { this.sel = (this.sel + 1) % n; sound.sfx('cursor'); }
    if (inp.pressed('a') && this.f > 6) this.choose(this.sel);
    if (inp.pressed('b') && this.o.cancel != null) this.choose(this.o.cancel);
  }
  choose(i) { sound.sfx('ok'); this.g.pop(this); if (this.o.onPick) this.o.onPick(i); }
  onTap(x, y) { const i = (this.rects || []).findIndex((r) => inRect(x, y, r)); if (i >= 0) this.choose(this.rects[i].i); }
  draw(c) {
    const o = this.o, lines = o.lines || [], h = 120 + lines.length * 24 + o.choices.length * 48;
    c.fillStyle = 'rgba(2,6,18,0.62)'; c.fillRect(0, 0, W, H);
    const y = Math.max(20, (H - h) / 2);
    panel(c, 150, y, 660, h, { band: o.color || TV.gold });
    plate(c, 150, y - 4, 420, 40, { k: 16, stripe: o.color || TV.red });
    txt(c, o.title, 176, y + 16, { size: 19, color: '#ffffff', max: 380 });
    lines.forEach((l, i) => txt(c, l, 180, y + 64 + i * 24, { size: 15, color: TV.ink, bold: false, max: 600 }));
    this.rects = menuList(c, 190, y + 70 + lines.length * 24, 580, o.choices.map((label) => ({ label })), this.sel, { rowH: 48, size: 17 });
  }
}
const say = (g, title, lines, color) => g.push(new Ask(g, { title, lines: Array.isArray(lines) ? lines : [lines], choices: ['OK'], color }));

// ---------------------------------------------------------------- the front-office menu
export function frontMenu(g, L) {
  const Fr = F.ensureFront(L);
  const T = L.teams[L.myTeam];
  return new Pick(g, L, {
    title: '球団運営', sub: () => `資金 ${F.yen(Fr.money)}　年俸総額 ${F.yen(F.payroll(L))}`,
    w: 470, rowH: 40,
    items: () => [
      { id: 'money', label: '資金・スポンサー', right: `${Fr.sponsors.length}/3社` },
      { id: 'trade', label: 'トレード', sub: '交換・金銭・無償・獲得' },
      { id: 'tier', label: '一軍・二軍・三軍', right: `${T.roster.length}/${T.farm2.length}/${T.farm3.length}` },
      { id: 'rw', label: '紅白戦', right: L.day - Fr.lastRW >= 7 ? 'できる' : `あと${7 - (L.day - Fr.lastRW)}日`, dim: L.day - Fr.lastRW < 7 },
      { id: 'waiver', label: 'ウェイバー・自由契約', right: `${Fr.waivers.filter((w) => w.from !== L.myTeam).length}人` },
      { id: 'cond', label: '選手の状態（素行・身体・ケガ）' },
      { id: 'mgr', label: '監督（休養・兼任監督）', right: { normal: '', rest: '代行中', player: '兼任' }[Fr.mgr.mode] },
      { id: 'ball', label: '使用球の設定', right: BALLS[Fr.ball].name },
      { id: 'dark', label: '裏の手段', right: Object.values(Fr.cheats).some(Boolean) ? '使用中' : '', sub: '興奮剤・薬物・ステロイド・コルクバット・松ヤニ・粘着物質' },
      { id: 'union', label: '選手会', right: `機嫌 ${Math.round(Fr.union)}` },
      { id: 'news', label: '球団ニュース', right: `${Fr.news.length}件` },
    ],
    side: (c, it, s, x, y) => {
      const m = Fr.mgr;
      txt(c, '球団の状態', x, y, { size: 15, color: TV.gold2 });
      const rows = [['資金', F.yen(Fr.money)], ['年俸総額', F.yen(F.payroll(L))], ['ファンの人気', `${Math.round(Fr.fans)}`], ['チームの士気', `${Math.round(Fr.morale)}`], ['選手会の機嫌', `${Math.round(Fr.union)}`],
        ['監督', m.mode === 'rest' ? `${m.interim.name}（代行）` : m.name], ['采配', `${m.mode === 'rest' ? m.interim.skill : m.skill}`], ['使用球', BALLS[Fr.ball].name]];
      rows.forEach(([a, b], i) => { txt(c, a, x, y + 34 + i * 30, { size: 13, color: TV.dim, bold: false }); txt(c, b, x + 360, y + 34 + i * 30, { size: 15, align: 'right', color: '#ffffff', max: 230 }); });
      const hurt = F.allOf(T).map((id) => L.P[id]).filter((p) => p.inj > 0 || p.susp > 0);
      txt(c, `ケガ・出場停止 ${hurt.length}人`, x, y + 300, { size: 13, color: hurt.length ? '#ff9a8a' : TV.dim });
      hurt.slice(0, 3).forEach((p, i) => txt(c, `${pname(p)}　${statusOf(p)}`, x + 10, y + 326 + i * 22, { size: 12, color: TV.ink, bold: false }));
    },
    onPick: (it) => {
      if (it.id === 'money') g.push(moneyScreen(g, L));
      if (it.id === 'trade') g.push(tradeMenu(g, L));
      if (it.id === 'tier') g.push(tierScreen(g, L));
      if (it.id === 'rw') { const r = F.redWhite(L); say(g, '紅白戦の結果', [`紅組（一軍） ${r.GS.score.home} − ${r.GS.score.away} 白組（二軍・三軍）`, r.mvp ? `MVP：${pfull(r.mvp)}` : '', r.grew.length ? `成長：${r.grew.map(pname).join('・')}` : 'チームの士気が少し上がった']); }
      if (it.id === 'waiver') g.push(waiverScreen(g, L));
      if (it.id === 'cond') g.push(condScreen(g, L));
      if (it.id === 'mgr') g.push(mgrScreen(g, L));
      if (it.id === 'ball') g.push(ballScreen(g, L));
      if (it.id === 'dark') g.push(darkScreen(g, L));
      if (it.id === 'union') say(g, '選手会', [`いまの機嫌：${Math.round(Fr.union)}（35を下回ると団体交渉を求めてきます）`, '下がる：ウェイバー公示、調停、直訴の慰留、不正の発覚', '上がる：要求の受け入れ、満額での更改、直訴を認める']);
      if (it.id === 'news') g.push(new Pick(g, L, { title: '球団ニュース', w: 900, rowH: 38, items: () => Fr.news.map((n) => ({ label: n.text, right: `${n.year}年 ${n.day + 1}日目` })), empty: 'ニュースはまだありません' }));
    },
  });
}

// ---------------------------------------------------------------- money and sponsors
function moneyScreen(g, L) {
  const Fr = L.front;
  return new Pick(g, L, {
    title: '資金・スポンサー', sub: () => `資金 ${F.yen(Fr.money)}`, w: 470,
    items: () => Fr.offers.map((o, i) => ({ label: `${o.name}`, sub: `契約金 ${F.yen(o.base)}　${o.cond.label}${o.bonus ? `で +${F.yen(o.bonus)}` : ''}`, i, dim: Fr.sponsors.length >= 3 })),
    empty: '新しいスポンサーの話はありません（シーズンが変わると来ます）',
    side: (c, it, s, x, y) => {
      txt(c, '契約中のスポンサー', x, y, { size: 15, color: TV.gold2 });
      if (!Fr.sponsors.length) txt(c, 'なし', x, y + 32, { size: 14, color: TV.dim });
      Fr.sponsors.forEach((sp, i) => { txt(c, sp.name, x, y + 34 + i * 48, { size: 16 }); txt(c, `${F.yen(sp.base)}　${sp.cond.label}${sp.bonus ? ` +${F.yen(sp.bonus)}` : ''}`, x, y + 56 + i * 48, { size: 12, color: TV.dim, bold: false }); });
      txt(c, '収入：ホームゲームの入場料（人気で増える）、スポンサー', x, y + 220, { size: 12, color: TV.ink, bold: false });
      txt(c, '支出：選手の年俸（毎日）、トレードの金銭、罰金', x, y + 244, { size: 12, color: TV.ink, bold: false });
      txt(c, '不祥事が起きると、スポンサーが契約を打ち切ることがあります', x, y + 276, { size: 12, color: '#ff9a8a', bold: false, max: 360 });
    },
    onPick: (it, s) => { if (F.signSponsor(L, it.i)) g.toast(`${it.label}と契約しました`, '#7af0a0'); s.sel = 0; },
  });
}

// ---------------------------------------------------------------- trades
function tradeMenu(g, L) {
  return new Pick(g, L, {
    title: 'トレード', w: 520,
    items: () => [
      { id: 'swap', label: '交換トレード', sub: '相手の選手と自分の選手を交換（釣り合えば成立）' },
      { id: 'buy', label: '金銭トレードで獲得', sub: 'お金で相手の選手を買う' },
      { id: 'sell', label: '金銭トレードで放出', sub: '自分の選手を売ってお金にする' },
      { id: 'freeout', label: '無償トレードで放出', sub: '出場機会のない選手を移籍させてあげる' },
      { id: 'freein', label: '無償トレードで獲得', sub: '相手が手放してもいい選手をもらう' },
    ],
    side: (c, it, s, x, y) => { txt(c, '相手の球団はコンピュータ監督です', x, y, { size: 13, color: TV.dim, bold: false }); txt(c, '若くて能力が高いほど価値が高く、', x, y + 30, { size: 13, color: TV.ink, bold: false }); txt(c, '主力は簡単には出してくれません。', x, y + 54, { size: 13, color: TV.ink, bold: false }); },
    onPick: (it) => {
      const mine = (title, act) => g.push(playerPick(g, L, L.myTeam, title, (p) => act(p)));
      const theirs = (title, act) => g.push(teamPick(g, L, (tid) => g.push(playerPick(g, L, tid, title, (p) => act(p)))));
      const done = (r) => { say(g, r.ok ? 'トレード成立' : '不成立', r.text, r.ok ? TV.gold : TV.red); };
      if (it.id === 'swap') theirs('ほしい選手', (pt) => mine(`${pname(pt)}と交換に出す選手`, (pm) => g.push(new Ask(g, { title: '交換トレードを申し込む', lines: [`獲得：${pfull(pt)}（価値 ${F.yen(F.valueOf(pt))}）`, `放出：${pfull(pm)}（価値 ${F.yen(F.valueOf(pm))}）`], choices: ['申し込む', 'やめる'], cancel: 1, onPick: (i) => { if (i === 0) done(F.tradeSwap(L, pm.id, pt.id)); } }))));
      if (it.id === 'buy') theirs('買う選手', (pt) => g.push(new Ask(g, { title: '金銭トレード（獲得）', lines: [`${pfull(pt)}　提示額 ${F.yen(F.askPrice(pt))}`, `資金 ${F.yen(L.front.money)}`], choices: ['買う', 'やめる'], cancel: 1, onPick: (i) => { if (i === 0) done(F.tradeBuy(L, pt.id)); } })));
      if (it.id === 'sell') mine('売る選手', (pm) => g.push(new Ask(g, { title: '金銭トレード（放出）', lines: [`${pfull(pm)}　見込み額 ${F.yen(F.bidPrice(pm))}`], choices: ['売る', 'やめる'], cancel: 1, onPick: (i) => { if (i === 0) done(F.tradeSell(L, pm.id)); } })));
      if (it.id === 'freeout') mine('移籍させる選手', (pm) => g.push(new Ask(g, { title: '無償トレード（放出）', lines: [`${pfull(pm)}を無償で移籍させます`], choices: ['移籍させる', 'やめる'], cancel: 1, onPick: (i) => { if (i === 0) done(F.tradeFreeOut(L, pm.id)); } })));
      if (it.id === 'freein') theirs('もらいたい選手', (pt) => g.push(new Ask(g, { title: '無償トレード（獲得）', lines: [`${pfull(pt)}を無償で譲ってほしいと頼みます`], choices: ['頼む', 'やめる'], cancel: 1, onPick: (i) => { if (i === 0) done(F.tradeFreeIn(L, pt.id)); } })));
    },
  });
}
function teamPick(g, L, then) {
  const ids = Object.keys(L.teams).filter((id) => id !== L.myTeam);
  return new Pick(g, L, {
    title: '相手の球団', w: 420, rowH: 38,
    items: () => ids.map((id) => ({ label: teamOf(id).full, right: `${L.teams[id].w}勝${L.teams[id].l}敗`, id })),
    side: (c, it, s, x, y) => { if (!it) return; c.fillStyle = 'rgba(255,255,255,0.94)'; roundRect(c, x + 90, y + 20, 200, 200, 14); c.fill(); drawEmblem(c, x + 190, y + 120, 180, it.id); },
    onPick: (it, s) => { g.pop(s); then(it.id); },
  });
}
function playerPick(g, L, teamId, title, then) {
  const T = L.teams[teamId];
  return new Pick(g, L, {
    title: `${title}（${teamOf(teamId).short}）`, w: 560, rowH: 44,
    items: () => F.allOf(T).map((id) => L.P[id]).sort((a, b) => F.tierOf(L, a.id)[1] - F.tierOf(L, b.id)[1] || overall(b) - overall(a)).map((p) => prow(L, p, tierName[F.tierOf(L, p.id)[1]])),
    side: (c, it, s, x, y) => playerCard(c, L, it && L.P[it.pid], x, y),
    onPick: (it, s) => { g.pop(s); then(L.P[it.pid]); },
  });
}
export function playerCard(c, L, p, x, y) {
  if (!p) return;
  txt(c, pfull(p), x, y, { size: 20, max: 320 });
  txt(c, `${p.pitcher ? '投手' : POS_SHORT[p.pos] || p.pos}　${p.age}歳　プロ${p.years}年目　背番号${p.num}`, x, y + 28, { size: 12, color: TV.dim, bold: false });
  const ab = p.pitcher ? [['球速', `${p.velo}km/h`], ['コントロール', grade(p.control).g], ['スタミナ', grade(p.stamina).g], ['変化球', p.pitches.map((q) => q.lv).join('・')]] : [['ミート', grade(p.meet).g], ['パワー', grade(p.power).g], ['走力', grade(p.speed).g], ['守備', grade(p.field).g]];
  ab.forEach(([a, b], i) => { txt(c, a, x, y + 62 + i * 26, { size: 13, color: TV.dim, bold: false }); txt(c, b, x + 92, y + 62 + i * 26, { size: 14, max: 86 }); });
  const rows = [['総合', `${overall(p)}（伸びしろ ${p.pot}）`], ['年俸', F.yen(p.sal)], ['価値', F.yen(F.valueOf(p))], ['素行', `${Math.round(p.conduct)}`], ['身体', `${Math.round(p.body)}`]];
  rows.forEach(([a, b], i) => { txt(c, a, x + 190, y + 62 + i * 26, { size: 13, color: TV.dim, bold: false }); txt(c, b, x + 232, y + 62 + i * 26, { size: 13, max: 150 }); });
  const s = p.s || {};
  txt(c, p.pitcher ? `今季 ${s.w || 0}勝${s.l || 0}敗${s.sv ? ` ${s.sv}S` : ''}　防御率${s.outs ? ((s.er * 27) / s.outs).toFixed(2) : '−'}` : `今季 打率${s.ab ? (s.h / s.ab).toFixed(3).replace(/^0/, '') : '−'}　${s.hr || 0}本　${s.rbi || 0}打点`, x, y + 200, { size: 13, color: TV.ink, bold: false });
  if (statusOf(p)) txt(c, statusOf(p), x, y + 226, { size: 13, color: '#ff9a8a' });
}

// ---------------------------------------------------------------- 一軍・二軍・三軍
function tierScreen(g, L) {
  const T = L.teams[L.myTeam];
  return new Pick(g, L, {
    title: '一軍・二軍・三軍', sub: () => `一軍${T.roster.length}人　二軍${T.farm2.length}人　三軍${T.farm3.length}人`, w: 560, rowH: 44,
    help: 'A：入れかえる相手をえらぶ　B もどる',
    items: () => F.allOf(T).map((id) => L.P[id]).sort((a, b) => F.tierOf(L, a.id)[1] - F.tierOf(L, b.id)[1] || Number(b.pitcher) - Number(a.pitcher) || overall(b) - overall(a)).map((p) => prow(L, p, tierName[F.tierOf(L, p.id)[1]])),
    side: (c, it, s, x, y) => { playerCard(c, L, it && L.P[it.pid], x, y); txt(c, '二軍は試合で、三軍は練習で育ちます（若いほど伸びる）', x, y + 270, { size: 12, color: TV.dim, bold: false, max: 360 }); },
    onPick: (it) => {
      const p = L.P[it.pid], t = F.tierOf(L, p.id)[1];
      const others = F.allOf(T).map((id) => L.P[id]).filter((q) => F.tierOf(L, q.id)[1] !== t && (t === 1 || F.tierOf(L, q.id)[1] === 1 ? q.pitcher === p.pitcher : true));
      const extra = t > 1 ? [{ label: t === 2 ? '三軍へ移す' : '二軍へ移す', move: true }] : [];
      g.push(new Pick(g, L, {
        title: `${pname(p)}（${tierName[t]}）と入れかえる選手`, w: 560, rowH: 44,
        items: () => [...extra, ...others.sort((a, b) => F.tierOf(L, a.id)[1] - F.tierOf(L, b.id)[1] || overall(b) - overall(a)).map((q) => prow(L, q, tierName[F.tierOf(L, q.id)[1]]))],
        side: (c2, it2, s2, x, y) => playerCard(c2, L, it2 && it2.pid ? L.P[it2.pid] : p, x, y),
        onPick: (it2, s2) => {
          if (it2.move) { const to = F.moveFarm(L, p.id); g.toast(`${pname(p)}を${tierName[to]}へ`, '#7af0a0'); g.pop(s2); return; }
          F.swapTier(L, p.id, it2.pid); g.toast(`${pname(p)} ⇔ ${pname(L.P[it2.pid])}`, '#7af0a0'); g.pop(s2);
        },
      }));
    },
  });
}

// ---------------------------------------------------------------- waivers
function waiverScreen(g, L) {
  const Fr = L.front, T = L.teams[L.myTeam];
  return new Pick(g, L, {
    title: 'ウェイバー・自由契約', w: 560, rowH: 44,
    items: () => [{ id: 'put', label: '自分の選手をウェイバー公示する', sub: '他球団が獲得しなければ自由契約に（選手会の機嫌が下がる）' },
      ...Fr.waivers.filter((w) => w.from !== L.myTeam).map((w) => ({ ...prow(L, L.P[w.pid], `${teamOf(w.from).short}　あと${w.days}日`), w }))],
    side: (c, it, s, x, y) => { if (it && it.pid) playerCard(c, L, L.P[it.pid], x, y); else txt(c, '他球団が公示した選手を獲得できます（二軍に入ります）', x, y, { size: 13, color: TV.ink, bold: false, max: 360 }); },
    onPick: (it) => {
      if (it.id === 'put') g.push(new Pick(g, L, { title: '公示する選手', w: 560, rowH: 44, items: () => F.allOf(T).map((id) => prow(L, L.P[id], tierName[F.tierOf(L, id)[1]])), side: (c, it2, s, x, y) => playerCard(c, L, it2 && L.P[it2.pid], x, y), onPick: (it2, s2) => { g.pop(s2); if (F.waive(L, it2.pid)) g.toast(`${pname(L.P[it2.pid])}をウェイバー公示`, '#ffd23f'); else g.toast('一軍の人数が足りません', '#ff8a8a'); } }));
      else if (it.w) { F.claim(L, it.w); g.toast(`${pname(L.P[it.pid])}を獲得`, '#7af0a0'); }
    },
  });
}

// ---------------------------------------------------------------- conduct, body, injuries
function condScreen(g, L) {
  const T = L.teams[L.myTeam];
  return new Pick(g, L, {
    title: '選手の状態', sub: '素行が低いと問題を起こし、身体が弱いとケガをしやすい', w: 560, rowH: 44,
    items: () => F.allOf(T).map((id) => L.P[id]).sort((a, b) => (b.inj + b.susp) - (a.inj + a.susp) || a.conduct + a.body - (b.conduct + b.body)).map((p) => ({ ...prow(L, p), right: `素行${Math.round(p.conduct)} 身体${Math.round(p.body)}` })),
    side: (c, it, s, x, y) => playerCard(c, L, it && L.P[it.pid], x, y),
  });
}

// ---------------------------------------------------------------- the manager
function mgrScreen(g, L) {
  const Fr = L.front;
  return new Pick(g, L, {
    title: '監督', w: 520,
    items: () => {
      const m = Fr.mgr;
      return [
        { id: 'rest', label: '監督を休養させる', sub: 'ヘッドコーチが監督代行に。チームに刺激（士気+）', dim: m.mode !== 'normal' },
        { id: 'back', label: '監督を復帰させる', dim: m.mode !== 'rest' },
        { id: 'fire', label: '監督を解任して、代行を新監督に', dim: m.mode !== 'rest' },
        { id: 'pm', label: '選手兼任監督を置く', sub: '32歳以上のベテランが監督を兼ねる（本人の成績は少し下がる）', dim: m.mode === 'player' || !F.pmCandidates(L).length },
        { id: 'endpm', label: '兼任監督をやめる', dim: m.mode !== 'player' },
      ];
    },
    side: (c, it, s, x, y) => {
      const m = Fr.mgr;
      txt(c, m.mode === 'rest' ? `${m.interim.name}（監督代行）` : m.name, x, y, { size: 20, max: 360 });
      txt(c, `采配 ${m.mode === 'rest' ? m.interim.skill : m.skill}　士気 ${Math.round(Fr.morale)}`, x, y + 32, { size: 15, color: TV.gold2 });
      if (m.mode === 'rest') txt(c, `${m.name}監督は休養中（あと${m.restDays}日）`, x, y + 64, { size: 13, color: TV.ink, bold: false });
      txt(c, '采配と士気が、試合でのチームの力に効きます', x, y + 110, { size: 13, color: TV.dim, bold: false, max: 360 });
    },
    onPick: (it) => {
      if (it.id === 'rest') { F.restManager(L); say(g, '監督休養', `${Fr.mgr.interim.name}が監督代行になりました`); }
      if (it.id === 'back') { F.returnManager(L, false); g.toast('監督が復帰しました', '#7af0a0'); }
      if (it.id === 'fire') { F.returnManager(L, true); g.toast(`${Fr.mgr.name}が新監督に`, '#7af0a0'); }
      if (it.id === 'pm') g.push(new Pick(g, L, { title: '兼任監督にする選手', w: 560, rowH: 44, items: () => F.pmCandidates(L).map((p) => prow(L, p)), side: (c, it2, s, x, y) => playerCard(c, L, it2 && L.P[it2.pid], x, y), onPick: (it2, s2) => { g.pop(s2); F.makePlayerManager(L, it2.pid); say(g, '選手兼任監督', `${pfull(L.P[it2.pid])}が兼任監督に就任（采配 ${Fr.mgr.skill}）`); } }));
      if (it.id === 'endpm') { F.endPlayerManager(L); g.toast('兼任監督をやめました', '#7af0a0'); }
    },
  });
}

// ---------------------------------------------------------------- the ball
function ballScreen(g, L) {
  const Fr = L.front;
  const desc = { fly: 'ホームランが増える。打高のシーズンに', std: 'いつものボール', dead: 'ホームランが減る。投手戦に' };
  return new Pick(g, L, {
    title: '使用球の設定', sub: 'リーグ全体の試合に効きます', w: 520,
    items: () => Object.entries(BALLS).map(([k, b]) => ({ k, label: b.name, sub: `${desc[k]}（本塁打×${b.hr}）`, right: Fr.ball === k ? 'いま' : '' })),
    onPick: (it) => { Fr.ball = it.k; F.news(L, `使用球を「${BALLS[it.k].name}」に変更`, 'info'); g.toast(`使用球：${BALLS[it.k].name}`, '#7af0a0'); },
  });
}

// ---------------------------------------------------------------- the dark side
function darkScreen(g, L) {
  const Fr = L.front;
  return new Pick(g, L, {
    title: '裏の手段', sub: '効果は大きいが、見つかれば出場停止・罰金・人気の急落', w: 560,
    items: () => Object.entries(F.CHEATS).map(([k, ch]) => ({ k, label: `${Fr.cheats[k] ? '■' : '□'} ${ch.name}`, sub: ch.desc, right: Fr.cheats[k] ? '使用中' : '' })),
    side: (c, it, s, x, y) => {
      txt(c, '発覚の記録', x, y, { size: 15, color: '#ff9a8a' });
      if (!Fr.caught.length) txt(c, 'まだ見つかっていません', x, y + 30, { size: 13, color: TV.dim, bold: false });
      Fr.caught.slice(-6).reverse().forEach((cg, i) => txt(c, `${cg.year}年 ${pname(L.P[cg.pid])}：${F.CHEATS[cg.k].name}`, x, y + 32 + i * 24, { size: 13, color: TV.ink, bold: false }));
      txt(c, '薬物はリーグの抜き打ち検査、コルクバットは', x, y + 220, { size: 12, color: TV.dim, bold: false });
      txt(c, 'バットが割れたとき、松ヤニ・粘着物質は審判の', x, y + 242, { size: 12, color: TV.dim, bold: false });
      txt(c, 'チェックで見つかります。ステロイドは体も壊します', x, y + 264, { size: 12, color: TV.dim, bold: false });
    },
    onPick: (it) => {
      const on = !Fr.cheats[it.k];
      if (!on) { F.setCheat(L, it.k, false); g.toast(`${F.CHEATS[it.k].name}をやめました`, '#7af0a0'); return; }
      g.push(new Ask(g, { title: `${F.CHEATS[it.k].name}を使う`, lines: [F.CHEATS[it.k].desc, '見つかると選手が出場停止になり、球団にも制裁が科されます'], choices: ['使う', 'やめておく'], cancel: 1, color: TV.red, onPick: (i) => { if (i === 0) { F.setCheat(L, it.k, true); g.toast(`${F.CHEATS[it.k].name}：使用開始`, '#ff8a8a'); } } }));
    },
  });
}

// ---------------------------------------------------------------- the decisions that come up during the season
export function showPending(g, L, after) {
  const Fr = L.front;
  if (!Fr || !Fr.pending.length) { if (after) after(); return; }
  const ev = Fr.pending[0];
  const next = (i) => { const msg = F.resolvePending(L, ev, i); if (msg) g.toast(msg, '#ffd23f'); showPending(g, L, after); };
  if (ev.type === 'demand') { const p = L.P[ev.pid]; g.push(new Ask(g, { title: `直訴：${pfull(p)}`, lines: [`「もっと試合に出られる球団でプレーしたい。トレードに出してください」`, `${posOf(p)}　${p.age}歳　総合${overall(p)}`], choices: ['希望を認めて放出する', '慰留する'], onPick: next })); }
  else if (ev.type === 'union') g.push(new Ask(g, { title: '選手会が団体交渉を求めています', lines: ['「最低年俸の引き上げと待遇の改善を求めます」', `受け入れると ${F.yen(ev.cost)}の負担。拒否するとストライキの恐れ`], choices: ['受け入れる', '拒否する'], onPick: next }));
  else if (ev.type === 'mgr') g.push(new Ask(g, { title: '監督の休養期間が終わりました', lines: [`${Fr.mgr.name}監督を復帰させますか？ 代行の${Fr.mgr.interim ? Fr.mgr.interim.name : ''}を新監督にもできます`], choices: ['監督を復帰させる', '代行を新監督にする'], onPick: next }));
  else if (ev.type === 'caught') { const p = L.P[ev.pid]; g.push(new Ask(g, { title: `【発覚】${F.CHEATS[ev.k].name}`, lines: [`${pfull(p)}の${F.CHEATS[ev.k].name}使用が発覚しました`, `出場停止${ev.days}日、球団に制裁金 ${F.yen(ev.fine)}`, 'ファンの人気が下がり、スポンサーが離れることがあります'], choices: ['謝罪会見を開く'], color: TV.red, onPick: next })); }
  else next(0);
}

// ---------------------------------------------------------------- the off-season
export function offseason(g, L, onNewSeason) {
  const Fr = F.ensureFront(L);
  const off = F.startOffseason(L);
  return new Pick(g, L, {
    title: `${L.year}年 オフシーズン`, sub: () => `資金 ${F.yen(Fr.money)}`, w: 520,
    items: () => [
      { id: 'talk', label: '契約更改（年俸調停）', right: `残り${off.talks.filter((t) => !t.done).length}人` },
      { id: 'fa', label: 'FA（フリーエージェント）', right: `${off.fa.filter((f) => f.status === 'open').length}人`, sub: 'プロテクト名簿と補償つき' },
      { id: 'protect', label: 'プロテクト名簿（28人）', sub: '他球団のFA選手を取ると、名簿外から補償で選手が移ることがある' },
      { id: 'try', label: '合同トライアウト', sub: '自由契約の選手と契約（3人まで）' },
      { id: 'trade', label: 'トレード' },
      { id: 'next', label: `${L.year + 1}年シーズンへ`, sub: '年齢・成長・引退・ドラフト。新しい日程で開幕' },
    ],
    side: (c, it, s, x, y) => {
      txt(c, 'オフの進め方', x, y, { size: 15, color: TV.gold2 });
      ['1. 契約更改：提示額で合わないと保留→調停', '2. FA：自軍の選手は残留交渉、他球団の選手は入札', '3. トライアウトで掘り出し物を探す', '4. 次のシーズンへ'].forEach((l, i) => txt(c, l, x, y + 34 + i * 26, { size: 13, color: TV.ink, bold: false, max: 360 }));
    },
    onPick: (it, s) => {
      if (it.id === 'talk') g.push(talkScreen(g, L));
      if (it.id === 'fa') g.push(faScreen(g, L));
      if (it.id === 'protect') { if (!off.protect) off.protect = F.autoProtect(L, L.myTeam); g.push(protectScreen(g, L)); }
      if (it.id === 'try') { if (!off.tryout.length) F.makeTryout(L); g.push(tryScreen(g, L)); }
      if (it.id === 'trade') g.push(tradeMenu(g, L));
      if (it.id === 'next') g.push(new Ask(g, { title: '次のシーズンへ', lines: [off.talks.some((t) => !t.done) ? '残りの契約更改は提示額でまとめて済ませます' : '準備はできました', 'FAの残りは他球団へ移ります'], choices: ['開幕する', 'まだ'], cancel: 1, onPick: (i) => {
        if (i) return;
        F.settleAllTalks(L);
        for (const f of off.fa.filter((x) => x.status === 'open')) { if (f.from === L.myTeam) F.faKeep(L, f, false); else f.status = 'other'; }
        F.nextSeason(L); g.pop(s); onNewSeason && onNewSeason();
      } }));
    },
  });
}
function talkScreen(g, L) {
  const off = L.front.off;
  return new Pick(g, L, {
    title: '契約更改', sub: '提示額と要求額の差が大きいと、保留して調停へ', w: 560, rowH: 44,
    items: () => [{ id: 'all', label: '残りをまとめて提示額で更改', dim: !off.talks.some((t) => !t.done) },
      ...off.talks.map((t) => { const p = L.P[t.pid]; return { label: `${posOf(p)}　${pfull(p)}`, sub: `現 ${F.yen(t.old)} → 提示 ${F.yen(t.offer)}　要求 ${F.yen(t.ask)}`, right: t.done === 'signed' ? `更改 ${F.yen(p.sal)}` : t.done === 'arb' ? `調停 ${F.yen(p.sal)}` : '', t, pid: t.pid, dim: !!t.done }; })],
    side: (c, it, s, x, y) => playerCard(c, L, it && it.pid ? L.P[it.pid] : null, x, y),
    onPick: (it) => {
      if (it.id === 'all') { F.settleAllTalks(L); g.toast('まとめて更改しました', '#7af0a0'); return; }
      const t = it.t;
      g.push(new Ask(g, { title: `${pfull(L.P[t.pid])}の契約更改`, lines: [`提示額 ${F.yen(t.offer)}　要求額 ${F.yen(t.ask)}`], choices: ['提示額で交渉する', '要求どおり満額で更改', 'あとで'], cancel: 2, onPick: (i) => { if (i < 2) g.toast(F.settleTalk(L, t, i === 0 ? 'offer' : 'ask'), '#ffd23f'); } }));
    },
  });
}
function faScreen(g, L) {
  const off = L.front.off;
  return new Pick(g, L, {
    title: 'FA（フリーエージェント）', sub: 'ランクA・Bの選手を取ると、元の球団へ補償', w: 560, rowH: 44,
    items: () => off.fa.map((f) => { const p = L.P[f.pid]; return { label: `${f.from === L.myTeam ? '【自軍】' : `【${teamOf(f.from).short}】`} ${posOf(p)} ${pfull(p)}`, sub: `ランク${f.rank}　要求 ${F.yen(f.ask)}　総合${overall(p)}`, right: { open: '', mine: '獲得', lost: '他へ', stay: '残留', gone: '移籍', other: '他へ' }[f.status], f, pid: f.pid, dim: f.status !== 'open' }; }),
    empty: 'FA宣言した選手はいません',
    side: (c, it, s, x, y) => playerCard(c, L, it && L.P[it.pid], x, y),
    onPick: (it) => {
      const f = it.f, p = L.P[f.pid];
      if (f.from === L.myTeam) g.push(new Ask(g, { title: `${pfull(p)}の残留交渉`, lines: [`要求 ${F.yen(f.ask)}（ランク${f.rank}）`, f.rank === 'A' ? '移籍されたら相手の名簿外から人的補償を取れます' : f.rank === 'B' ? '移籍されたら補償金が入ります' : ''], choices: ['要求どおりで残留させる', '引き止めない', 'あとで'], cancel: 2, onPick: (i) => { if (i < 2) say(g, 'FA', F.faKeep(L, f, i === 0)); } }));
      else g.push(new Ask(g, { title: `${pfull(p)}に入札`, lines: [`要求 ${F.yen(f.ask)}　他球団も入札してきます`, f.rank !== 'C' ? `ランク${f.rank}：元の${teamOf(f.from).short}へ補償が必要` : '補償は不要'], choices: [`${F.yen(f.ask)}（要求額）`, `${F.yen(Math.round(f.ask * 1.15 / 10) * 10)}（上乗せ）`, `${F.yen(Math.round(f.ask * 1.35 / 10) * 10)}（大型契約）`, 'やめる'], cancel: 3, onPick: (i) => { if (i < 3) { const r = F.faBid(L, f, Math.round(f.ask * [1, 1.15, 1.35][i] / 10) * 10); say(g, r.ok ? 'FA 獲得' : 'FA', r.text, r.ok ? TV.gold : TV.red); } } }));
    },
  });
}
function protectScreen(g, L) {
  const off = L.front.off, T = L.teams[L.myTeam];
  return new Pick(g, L, {
    title: 'プロテクト名簿', sub: () => `${off.protect.length} / 28人`, w: 560, rowH: 44, help: 'A：名簿に入れる／外す　B もどる',
    items: () => F.allOf(T).map((id) => L.P[id]).sort((a, b) => F.valueOf(b) - F.valueOf(a)).map((p) => ({ ...prow(L, p), right: off.protect.includes(p.id) ? 'プロテクト' : '' })),
    side: (c, it, s, x, y) => playerCard(c, L, it && L.P[it.pid], x, y),
    onPick: (it) => { const i = off.protect.indexOf(it.pid); if (i >= 0) off.protect.splice(i, 1); else if (off.protect.length < 28) off.protect.push(it.pid); else g.toast('28人までです', '#ff8a8a'); },
  });
}
function tryScreen(g, L) {
  const off = L.front.off;
  return new Pick(g, L, {
    title: '合同トライアウト', sub: () => `契約 ${off.signedTry} / 3人`, w: 560, rowH: 44,
    items: () => off.tryout.filter((t) => L.P[t.pid]).map((t) => ({ ...prow(L, L.P[t.pid], t.signed ? '契約' : F.yen(t.sal)), t, dim: t.signed || off.signedTry >= 3 })),
    empty: '参加者はいません',
    side: (c, it, s, x, y) => playerCard(c, L, it && L.P[it.pid], x, y),
    onPick: (it) => { if (F.signTryout(L, it.t)) g.toast(`${pname(L.P[it.pid])}と契約（二軍へ）`, '#7af0a0'); },
  });
}
