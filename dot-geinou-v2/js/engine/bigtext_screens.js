// 縦画面の「大きな文字」: the screens that use the lower screen (R12-U1). Each adapter reads the scene on top and says what to show for the
// SELECTED item (bigtext.js registerBigtext: match / key / spec). Nothing here changes a scene; a screen without an adapter simply has
// no lower screen. Taps on the lower screen call the scene's own methods or press the same virtual button as the pad (padPress).
// Adapters here: 会話 (MessageScene: g.say / g.ask) · リスト (ListScene) · お店 (ShopScene) · ステータス · スマホ (a zoomed live copy of the phone's screen).
// The HD information screens are in bigtext_info.js (ニュース · 世論の声 · 審査員名鑑), bigtext_pages.js (てちょう · 賞レース · 相方募集 / 芸人手帳 · 台本エディタ) and bigtext_polai.js (政治家の動向).
import { registerBigtext, portraitPanelOf, padPress } from './bigtext.js';
import './bigtext_info.js'; // ニュース · 世論の声 · 審査員名鑑
import './bigtext_polai.js'; // 政治家の動向 (the hub view of politics_ai_ui.js offers the hooks)
import './bigtext_polui.js'; // [R13-F] 政治画面 (every other view) · 政府中枢 / 各界
import './bigtext_pages.js'; // てちょう · 賞レース · 相方募集 / 芸人手帳 · 台本エディタ
import { MessageScene, StatusScene, ListScene, ShopScene } from './ui.js';
import { SCREEN } from './phone.js';
import { fmtMoney, yenText } from './util.js';
import { measure } from './draw.js';
import { SKILLS, SKILL_MAX, AGENCIES, ITEMS, rankName, RANKS, rankIndex } from './state.js';
import { eraOf, fullName, ageOf, prefecture, GENDERS, PERSONALITIES } from './profile.js';


// ---------------------------------------------------------------- 会話 (g.say / g.ask)
registerBigtext({
  id: 'say',
  match: (s) => s instanceof MessageScene,
  key: (s) => `${s.page}|${Math.floor(s.shown)}|${s.choice ? s.choice.idx : -1}|${s.opts.name || ''}`,
  spec(s, g) {
    const total = Array.from(s.pageText).length;
    // the page's lines joined; a line clearly shorter than the message box was ended by a \n of the script (keep that break)
    const lines = s.pages[s.page] || [];
    let full = '';
    lines.forEach((l, i) => { full += l; if (i < lines.length - 1 && measure(g.ctx, l, 16) < 540) full += '\n'; });
    let vis = '', n = 0;
    for (const ch of Array.from(full)) { if (ch === '\n') { if (n < Math.floor(s.shown)) vis += ch; continue; } if (n >= Math.floor(s.shown)) break; vis += ch; n++; }
    const done = s.shown >= total;
    const o = s.opts || {};
    const spec = {
      sid: `say:${s.pages.length}:${s.page}:${o.name || ''}`,
      color: o.nameColor || '#ffd23f',
      title: o.name || '',
      hint: s.pages.length > 1 ? `${s.page + 1}／${s.pages.length}` : '',
      blocks: [{ t: vis || '…', s: 21, c: o.color || '#ffffff' }],
      onTap: () => padPress(g, 'a'),
    };
    if (s.choice && done) {
      const ch = s.choice;
      spec.list = { items: ch.choices.map((t) => ({ label: t })), index: ch.idx, rows: Math.min(5, ch.choices.length), bodyMin: 96, noStepper: true, onPick: (i) => { ch.idx = i; padPress(g, 'a'); } };
      spec.hint = '';
      spec.onTap = () => {}; // a stray tap on the text must not pick the highlighted choice
    } else if (done && !s.choice) spec.hint = (spec.hint ? spec.hint + '　' : '') + '▼ タップでつぎへ';
    return spec;
  },
});


// ---------------------------------------------------------------- リスト (g.list: the pause menu, item lists, choosers) and the お店 (g.shop)
// Rows become 46 px (70 units) tappable rows. A list that describes the highlighted row (もちもの) selects on the first tap and acts on the second;
// a plain menu acts at once (like tapping a choice of a message).
registerBigtext({
  id: 'list',
  match: (s) => s instanceof ListScene,
  key: (s) => `${s.idx}|${s.items.length}|${s.title || ''}`,
  spec(s, g) {
    const n = s.items.length;
    const desc = typeof s.describe === 'function' && n ? yenText(String(s.describe(s.idx) || '')) : '';
    const items = s.items.map((it) => { const o = typeof it === 'string' ? { label: it } : it; return { label: yenText(String(o.label)), right: o.right == null ? '' : yenText(String(o.right)), dim: !!o.disabled }; });
    const two = typeof s.describe === 'function';
    return {
      sid: `list:${s.title || ''}:${n}`, color: '#5fd7ff', title: s.title || '', hint: 'Bでもどる',
      blocks: desc ? [{ t: desc, s: 19 }] : [], onTap: () => {},
      list: n ? { items, index: s.idx, rows: 7, bodyMin: desc ? 90 : 0, bodyMax: 160, noStepper: true, onPick: (i) => { if (two && s.idx !== i) s.idx = i; else { s.idx = i; padPress(g, 'a'); } } } : null,
      ...(n ? {} : { blocks: [{ t: '（なし）', s: 19 }] }),
    };
  },
});
registerBigtext({
  id: 'shop',
  match: (s) => s instanceof ShopScene,
  key: (s) => `${s.idx}|${s.bought}|${s.msg}|${s.g.state.money}`,
  spec(s, g) {
    const n = s.goods.length;
    const items = s.goods.map((gd) => ({ label: (ITEMS[gd.item] || { name: gd.item }).name, right: fmtMoney(s.price(gd)), rcol: g.state.money < s.price(gd) ? '#ff7a8a' : undefined }));
    items.push({ label: 'やめる' });
    const gd = s.goods[s.idx];
    const desc = gd ? ((ITEMS[gd.item] || {}).desc || '') : 'お店を出る。';
    return {
      sid: `shop:${s.opts.title || ''}`, color: '#ffd23f', title: s.opts.title || 'おみせ', sub: `所持金 ${fmtMoney(g.state.money)}`, hint: 'えらんでもう一度タップ：買う',
      blocks: [{ t: yenText(s.msg), s: 19, c: '#ffd23f' }, { t: yenText(desc), s: 18 }],
      list: { items, index: s.idx, rows: 5, bodyMin: 110, bodyMax: 150, noStepper: true, onPick: (i) => { if (s.idx !== i) s.idx = i; else padPress(g, 'a'); } },
      onTap: () => {}, // buying needs a tap on the row itself
    };
  },
});

// ---------------------------------------------------------------- ステータス
registerBigtext({
  id: 'status',
  match: (s) => s instanceof StatusScene,
  key: (s) => `${s.g.state.day}|${s.g.state.money}|${s.g.state.fame}|${s.g.state.stamina}`,
  spec(s, g) {
    const st = g.state, pf = st.profile;
    const era = eraOf(st);
    const C = { cyan: '#5fd7ff', pink: '#ff7eb6', acc: '#ffd23f', bad: '#ff5d6c', good: '#5ee07a' };
    const ri = rankIndex(st.fame), next = RANKS[ri + 1];
    const L = st.life;
    const COND = { great: ['絶好調！', C.good], normal: ['ふつう', '#ffffff'], hungry: ['はらぺこ…', C.bad], stressed: ['ストレスぎみ…', C.bad], scruffy: ['身だしなみが乱れている', C.acc], burnout: ['燃え尽きた…', C.bad], edge: ['燃え尽き寸前！', C.bad] };
    let cond = 'normal'; try { cond = g.condition(); } catch (e) { cond = 'normal'; }
    const [cl, cc] = COND[cond === 'stressed' && L.stress >= 90 ? 'edge' : cond] || COND.normal;
    const blocks = [];
    if (pf) blocks.push({ t: `${ageOf(st)}さい・${(GENDERS[pf.gender] || GENDERS.x).name}・${prefecture(pf.hometown).name}出身`, s: 18 });
    if (pf) blocks.push({ t: `性格：${(PERSONALITIES[pf.personality] || {}).name || ''}　時代：${era.label}`, s: 16, c: C.cyan });
    blocks.push({ gap: 4 }, { t: `${rankName(st.fame)}　★${st.fame}`, s: 22, c: C.pink });
    blocks.push({ t: next ? `次の称号「${next[1]}」まで あと★${next[0] - st.fame}` : '頂点に立った！', s: 16, c: '#a4acd0' });
    blocks.push({ gap: 6 }, { kv: ['所属', st.agency ? AGENCIES[st.agency].name : 'フリー（未所属）'] });
    blocks.push({ kv: ['所持金', fmtMoney(st.money), C.acc] }, { kv: ['日数', `${st.day}日目　お仕事 ${st.stats.jobs}回`] });
    blocks.push({ kv: ['ファン', `${st.fans.toLocaleString('ja-JP')}人`, C.pink] });
    try { blocks.push({ kv: ['住まい', g.housing().name] }); } catch (e) { /* no housing */ }
    blocks.push({ h: 'スキル', c: '#ff8a3d' });
    const SC = ['#ff8a3d', '#5fd7ff', '#ff7eb6', '#5ee07a'];
    Object.entries(SKILLS).forEach(([k, name], i) => blocks.push({ bar: [name, st.skills[k] / SKILL_MAX, SC[i % 4], String(st.skills[k])] }));
    blocks.push({ h: 'からだとこころ', c: C.cyan }, { kv: ['調子', cl, cc] }, { bar: ['体力', st.stamina / st.maxStamina, C.good, `${st.stamina}/${st.maxStamina}`] });
    blocks.push({ bar: ['満腹', L.hunger / 100, '#ff9a3c', String(L.hunger)] }, { bar: ['ストレス', L.stress / 100, L.stress >= 70 ? C.bad : '#b48cff', String(L.stress)] }, { bar: ['身だしなみ', L.clean / 100, C.cyan, String(L.clean)] });
    for (const [label, v, col] of s.civic || []) blocks.push({ kv: [label, v, col] });
    return { sid: 'status', color: C.pink, title: pf ? fullName(pf) : st.name, tag: 'ステータス', hint: 'タップ／A：もどる', blocks, onTap: () => padPress(g, 'a') };
  },
});

// ---------------------------------------------------------------- スマホ: a live, zoomed copy of the phone's screen (every app and every view, taps included)
registerBigtext({
  id: 'phone',
  match: (s) => !!s.isPhone && !s.closing && !s.dismissed && !!s.view,
  key: (s) => (s.openT >= 10 ? 'phone' : 'null'),
  spec(ph, g) {
    return {
      sid: 'phone', live: true, color: '#ffd23f',
      mirror: {
        w: SCREEN.w, h: SCREEN.h,
        draw(c) {
          c.fillStyle = '#05060a'; c.fillRect(0, 0, SCREEN.w, SCREEN.h);
          c.translate(-SCREEN.x, -SCREEN.y);
          if (typeof ph.drawViews === 'function') { ph.drawViews(c, g); ph.drawStatus(c, g); ph.drawBanners(c, g); }
        },
        tap(u, v) {
          if (ph.closing || ph.dismissed) return;
          ph.tapAt = { x: SCREEN.x + u, y: SCREEN.y + v };
          padPress(g, 'a');
        },
        // a drag = ↑ / ↓ of the pad (scrolls a long text, moves along a list)
        drag(dir) { if (!ph.closing && !ph.dismissed) padPress(g, dir > 0 ? 'up' : 'down', 2); },
      },
    };
  },
});

// make the panel exist (and reachable as g.portraitPanel) as soon as the game is there
// (the single-file build runs every module before main.js creates the game, so wait for it)
if (typeof window !== 'undefined') {
  if (window.__game) portraitPanelOf(window.__game);
  else { let n = 0; const iv = setInterval(() => { if (window.__game) { clearInterval(iv); portraitPanelOf(window.__game); } else if (++n > 600) clearInterval(iv); }, 100); }
}
