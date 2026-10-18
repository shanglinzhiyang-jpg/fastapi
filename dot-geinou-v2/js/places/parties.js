// 政党の本部 (永田町, nagatacho.js): 'jimin_hq' 自由民主党本部, 'minshu_hq' 民主党本部 (only while the
// party exists; otherwise the building is another company's office), 'yato_hq' (the largest
// fictional opposition party of the moment), 'myparty_hq' (the player's own party: テナント募集
// until the player founds one here or from the phone).
//
// Every headquarters has the same five rooms (built from one template):
//   lobby   1階 受付        受付（党の案内・入党・離党）・寄付の窓口・党のロゴ（実在の党）か党章（架空の党）
//   press   1階 記者会見室  党の幕と演台。議員・党首は記者会見（kantei.js の pressConference）
//   sentai  2階 選挙対策本部  公認の申請（g.requestNomination）→ 立候補の届出（g.declareCandidacy）・情勢
//                          必勝だるま、当選者の名札にバラ、電話作戦の机、選挙区の地図
//   seicho  3階 政務調査会（民主党・架空の党は 政策調査会） 公約を見る・政策の提言・議員立法・勉強会
//   kanbu   4階 幹部室（自分の党は 党首室）  党内の評価・派閥／グループ・党役員の打診・党首選・離党。
//                          自分の党: 党の状況・議員の勧誘・党役員の任命・党の資金・公約の見直し・連立の方針
//
// Real parties (自由民主党 / 民主党) are described only with the neutral facts in politics.js
// (PARTY_DEFS: 結党の日と経緯、党首の呼び名). Every person here is fictional: the party officers
// are the politics core's generated NPCs, the staff are made up. No real slogan is quoted.
// Facts (checked 2026-10): 政治資金規正法 — 個人が政党・政治資金団体にする寄附は年2,000万円まで、
//   年5万円をこえる寄附は寄附した人の氏名などが収支報告書で公開される（いまの基準。1994年の政治改革より
//   前の基準額は確かめられなかったので、その時代は金額を言わない）。政党交付金（政党助成法）は1995年から。
//   自民党の一般党員の党費は年4,000円。都知事・区長の選挙では、政党は「公認」ではなく「推薦」が多い。
//   必勝だるま: 願をかけて片目を入れ、当選したらもう片方の目を入れる。
// flags (prefix parties_): parties_don_<party>_<year> (nominal yen given that year),
//   parties_don_bonus_<party>_<year>, parties_teigen (day of the last proposal), parties_press (day),
//   parties_welcome_<hq>.

import { registerPlace, doorIndexFor, PLACES } from '../engine/map.js';
import { askText } from '../engine/textinput.js';
import { LOOKS } from '../engine/sprites.js';
import { defineTile, R, disc, oval, outline, speckle, shadowEllipse } from '../engine/tiles.js';
import { text } from '../engine/draw.js';
import { drawLogo } from '../engine/logos.js';
import { makeCanvas, clamp, fmtMoney, display } from '../engine/util.js';
import { eraOf } from '../engine/profile.js';
import { PARTY_DEFS, POLICIES, POLICY_ORDER, POLICY_AREAS, AREA_ORDER, SEGMENTS, POSTS, PARTY_POST_ORDER, OFFICES, postName, fmtCho, shugiRules, subsidyExists } from '../engine/politics.js';

let G = null;
const game = () => G || (typeof window !== 'undefined' ? window.__game : null) || null;

// ------------------------------------------------------------------ politics helpers
function pol(g) {
  if (!g || !g.state || typeof g.pol !== 'function') return null;
  try { return g.pol(); } catch (e) { console.error(e); return null; }
}
const yearOf = (g) => { try { return g.polDate().year; } catch (e) { return 2026; } };
const fyOf = (g) => { try { return g.polDate().fy; } catch (e) { return 2026.3; } };
function myPartyOf(g) {
  const p = pol(g);
  if (!p) return null;
  const all = Object.values(p.parties || {});
  return all.find((pt) => pt.isPlayers && pt.leader === 'player') || all.filter((pt) => /^my\d+$/.test(pt.id)).sort((a, b) => (b.founded || 0) - (a.founded || 0))[0] || null;
}
function yatoPartyOf(g) {
  const p = pol(g);
  if (!p) return null;
  const ruling = new Set(p.cabinet.partyIds || []);
  const seats = (id) => (Number(p.diet.shugi.seats[id]) || 0) + (Number(p.diet.sangi.seats[id]) || 0);
  const fict = Object.values(p.parties || {}).filter((pt) => !pt.real && !/^my\d+$/.test(pt.id));
  const opp = fict.filter((pt) => !ruling.has(pt.id));
  const list = (opp.length ? opp : fict).slice().sort((a, b) => seats(b.id) - seats(a.id) || String(a.id).localeCompare(String(b.id)));
  return list[0] || null;
}
// Each headquarters -> the party it houses right now (or null: closed / vacant).
const HQS = {
  jimin_hq: { name: '自由民主党本部', party: (g) => { const p = pol(g); return p && p.parties.jimin ? p.parties.jimin : null; }, closed: '党本部' },
  minshu_hq: { name: '民主党本部', party: (g) => { const p = pol(g); return p && p.parties.minshu ? p.parties.minshu : null; }, closed: '永田町ビル' },
  yato_hq: { name: '党本部', party: (g) => yatoPartyOf(g), closed: '党本部' },
  myparty_hq: { name: '貸しオフィス', party: (g) => myPartyOf(g), closed: '貸しオフィス', mine: true },
};
const partyOf = (hq, g) => { try { return HQS[hq].party(g || game()); } catch (e) { return null; } };
const isMember = (g, pt) => { const p = pol(g); return !!(p && pt && p.me.party === pt.id); };
const isLeader = (g, pt) => !!(pt && pt.leader === 'player');
const isNational = (g) => { const p = pol(g); return !!(p && (p.me.office === 'shugi' || p.me.office === 'sangi')); };
const npcOf = (g, id) => { const p = pol(g); return p && p.npcs ? p.npcs[id] : null; };
const surname = (n) => (n && n.name ? n.name.split(' ')[0] : '');
const seatsOf = (g, pt) => { const p = pol(g); return p && pt ? { shugi: Number(p.diet.shugi.seats[pt.id]) || 0, sangi: Number(p.diet.sangi.seats[pt.id]) || 0 } : { shugi: 0, sangi: 0 }; };
const leaderTitle = (pt) => (pt && (pt.leaderTitle || (PARTY_DEFS[pt.id] && PARTY_DEFS[pt.id].leaderTitle))) || '代表';
const seichoName = (g, pt) => (pt && pt.id === 'jimin' ? '政務調査会' : '政策調査会');
const kanbuName = (pt) => (pt && pt.isPlayers ? '党首室' : '幹部室');
const today = (g, k) => g.flag(k) === g.state.day;
const rate = () => display.priceRate || 1;
const device = (g) => { try { return eraOf(g.state).deviceShort || 'スマホ'; } catch (e) { return 'スマホ'; } };

// Split a long text into pages of up to 3 lines of about 34 characters.
function paged(str, width = 34) {
  const lines = [];
  for (const sent of String(str || '').split(/(?<=。)/)) {
    let s = sent.trim();
    while (s.length > width) { lines.push(s.slice(0, width)); s = s.slice(width); }
    if (s) lines.push(s);
  }
  const pages = [];
  for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3).join('\n'));
  return pages;
}

// The effect part of an activity result ('委員会で質問をした。評判 +2・…' -> '（評判 +2・…）').
const effects = (r) => { const [first, ...rest] = String((r && r.text) || '').split('\n'); const t = first.replace(/^[^。]*をした。/, '').trim(); return (t ? `（${t}）` : '') + (rest.length ? `\n${rest.join('\n')}` : ''); };

// ------------------------------------------------------------------ tiles (native HD)
function tile(k, def) {
  const hd = def.hd;
  defineTile(`parties_${k}`, {
    ...def,
    draw: def.draw || ((c, r, f, v) => { const [cv, cc] = makeCanvas(32, 32); hd(cc, r, f, v); c.imageSmoothingEnabled = false; c.drawImage(cv, 0, 0, 16, 16); }),
  });
}
const WALL = '#eceae4', WALL2 = '#dcd9d0', BAND = '#5a6a8a', BANDD = '#3a4a6a', WOOD = '#8a6440', WOODD = '#5a3e26', WOODL = '#b8875a', INK = '#22202a';
tile('walltop', { solid: true, hd(c) { R(c, 0, 0, 32, 32, '#2c2e36'); R(c, 0, 30, 32, 2, '#3c3e48'); } });
tile('wall_u', { solid: true, hd(c) { R(c, 0, 0, 32, 32, WALL); R(c, 0, 0, 32, 1, '#c8c4ba'); R(c, 0, 1, 32, 1, '#ffffff'); for (const x of [15, 31]) R(c, x, 4, 1, 28, WALL2); } });
tile('wall', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, WALL); for (const x of [15, 31]) R(c, x, 0, 1, 20, WALL2);
    R(c, 0, 20, 32, 3, BAND); R(c, 0, 20, 32, 1, '#7a8aaa'); R(c, 0, 23, 32, 1, BANDD);
    R(c, 0, 24, 32, 8, '#c8c4ba'); R(c, 0, 30, 32, 2, '#8a867c');
  },
});
tile('carpet', {
  variants: 4,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#7a8494');
    for (const [x, y, k] of [[0, 0, 0], [16, 0, 1], [0, 16, 1], [16, 16, 0]]) {
      const col = (k + v) % 2 ? '#808a9a' : '#76808f';
      R(c, x, y, 16, 16, col);
      for (let i = 0; i < 16; i += 2) R(c, x + ((k + v) % 2 ? i : 0), y + ((k + v) % 2 ? 0 : i), (k + v) % 2 ? 1 : 16, (k + v) % 2 ? 16 : 1, '#727c8b');
    }
    speckle(c, r, ['#6a7484', '#8a94a4'], 20);
  },
});
tile('lobbyfloor', {
  variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#e4e0d8');
    speckle(c, r, ['#d8d4cc', '#eeebe4', '#dcd8d0'], 50);
    R(c, 0, 0, 32, 1, '#cdc8be'); R(c, 0, 0, 1, 32, '#cdc8be');
    if (v === 2) R(c, 14, 14, 4, 4, '#d4d0c6');
  },
});
// dark wood panel behind the party board / backdrop (the prop is drawn on top)
tile('panel_u', { solid: true, hd(c) { R(c, 0, 0, 32, 32, WOODD); R(c, 0, 0, 32, 2, '#3a2814'); for (let x = 0; x < 32; x += 8) R(c, x, 2, 1, 30, '#4a3220'); } });
tile('panel', { solid: true, hd(c) { R(c, 0, 0, 32, 32, WOODD); for (let x = 0; x < 32; x += 8) R(c, x, 0, 1, 26, '#4a3220'); R(c, 0, 26, 32, 6, '#3a2814'); } });
// 当選者の名札にバラ（選挙の夜、当選した候補者の名前にバラの花をつける）
function roseBoard(lower) {
  return (c, r) => {
    R(c, 0, 0, 32, 32, WALL);
    R(c, 1, lower ? 0 : 3, 30, lower ? 22 : 29, '#f8f6f0'); R(c, 1, lower ? 0 : 3, 30, 1, '#c8c4ba');
    for (let k = 0; k < 3; k++) {
      const x = 3 + k * 10;
      R(c, x, lower ? 2 : 6, 7, lower ? 18 : 24, '#ffffff'); R(c, x, lower ? 2 : 6, 7, 1, '#c8c4ba');
      for (let y = (lower ? 4 : 9); y < (lower ? 18 : 28); y += 3) R(c, x + 2, y, 3, 1, '#3a3f4a');
      if (!lower && (k + Math.floor(r() * 3)) % 2 === 0) { disc(c, x + 3.5, 6, 2.6, '#d42a3a'); disc(c, x + 3, 5.5, 1.2, '#ff6a7a'); R(c, x + 3, 8, 1, 3, '#2f8f4e'); }
    }
    if (lower) { R(c, 0, 22, 32, 10, '#c8c4ba'); R(c, 0, 30, 32, 2, '#8a867c'); }
  };
}
tile('rose_u', { solid: true, hd: roseBoard(false) });
tile('rose', { solid: true, hd: roseBoard(true) });
// 選挙区の地図のホワイトボード
function mapBoard(lower) {
  return (c) => {
    R(c, 0, 0, 32, 32, WALL);
    R(c, 1, lower ? 0 : 3, 30, lower ? 22 : 29, '#f4f6f8'); R(c, 1, lower ? 0 : 3, 30, 1, '#9aa0aa');
    if (!lower) { R(c, 4, 8, 12, 9, '#cfe0c0'); R(c, 16, 6, 10, 12, '#e8d8b8'); R(c, 6, 18, 18, 10, '#c8d8e8'); for (const [x, y] of [[8, 11], [20, 10], [12, 22]]) disc(c, x, y, 1.5, '#d42a3a'); }
    else { R(c, 4, 2, 22, 8, '#d8e4c8'); R(c, 6, 12, 8, 1, '#2a3560'); R(c, 6, 15, 12, 1, '#2a3560'); R(c, 0, 22, 32, 10, '#c8c4ba'); R(c, 2, 22, 28, 2, '#9aa0aa'); R(c, 6, 21, 4, 1, '#d42a3a'); R(c, 12, 21, 4, 1, '#2a6fd0'); }
  };
}
tile('map_u', { solid: true, hd: mapBoard(false) });
tile('map', { solid: true, hd: mapBoard(true) });
// 必勝だるま on a shelf (wall)
tile('daruma', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, WALL); R(c, 0, 20, 32, 3, BAND); R(c, 0, 24, 32, 8, '#c8c4ba');
    R(c, 3, 18, 26, 3, WOODL); R(c, 3, 20, 26, 1, WOODD);
    oval(c, 8, 2, 16, 17, '#d42a3a'); oval(c, 11, 5, 10, 8, '#f8eee0');
    disc(c, 13.5, 8.5, 1.6, INK); R(c, 17, 7, 3, 3, '#f8eee0');
    R(c, 12, 14, 8, 3, '#e8c060'); R(c, 13, 15, 6, 1, INK);
    outline(c, { tint: 0.3 });
  },
});
// phone bank desk (電話作戦)
tile('phonedesk', {
  solid: true, obj: true,
  hd(c) {
    R(c, 1, 27, 30, 3, 'rgba(0,0,0,0.2)');
    R(c, 1, 12, 30, 15, '#d8d4cc'); R(c, 1, 12, 30, 3, '#f0ece4'); R(c, 1, 26, 30, 1, '#9a968c');
    R(c, 3, 6, 9, 7, '#3a3f4a'); R(c, 4, 7, 7, 3, '#5a606c'); R(c, 4, 4, 7, 3, '#20232a');
    R(c, 16, 8, 12, 6, '#ffffff'); for (let y = 9; y < 14; y += 2) R(c, 17, y, 10, 1, '#8a8f99');
    R(c, 3, 15, 2, 12, '#9a968c'); R(c, 27, 15, 2, 12, '#9a968c');
    outline(c);
  },
});
tile('podium', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 30, 11, 2);
    R(c, 7, 10, 18, 20, '#f4f2ec'); R(c, 7, 10, 2, 20, '#ffffff'); R(c, 23, 10, 2, 20, '#c8c4ba');
    R(c, 5, 7, 22, 4, '#3a3f4a'); R(c, 5, 7, 22, 1, '#5a606c');
    R(c, 18, 2, 1, 6, '#3b3f48'); R(c, 17, 1, 3, 2, INK); R(c, 12, 2, 1, 6, '#3b3f48'); R(c, 11, 1, 3, 2, INK);
    outline(c);
  },
});
tile('chair', {
  solid: true, obj: true,
  hd(c) {
    R(c, 7, 26, 18, 2, 'rgba(0,0,0,0.2)');
    R(c, 8, 8, 16, 10, '#5a5f6a'); R(c, 8, 8, 16, 1, '#7a808a');
    R(c, 7, 17, 18, 5, '#6a707a'); R(c, 7, 17, 18, 1, '#8a909a');
    R(c, 8, 22, 2, 6, '#9a9fa8'); R(c, 22, 22, 2, 6, '#9a9fa8');
    outline(c);
  },
});
// a table piled with policy papers
tile('docs', {
  solid: true, obj: true,
  hd(c) {
    R(c, 0, 26, 32, 3, 'rgba(0,0,0,0.18)');
    R(c, 0, 8, 32, 18, '#f0eee8'); R(c, 0, 8, 32, 2, '#ffffff'); R(c, 0, 25, 32, 1, '#a8a49a');
    for (const [x, y, n] of [[3, 5, 4], [14, 7, 2], [22, 4, 5]]) for (let k = 0; k < n; k++) { R(c, x, y + 8 - k * 2, 8, 2, k % 2 ? '#ffffff' : '#e8e6e0'); R(c, x, y + 9 - k * 2, 8, 1, '#c8c4ba'); }
    R(c, 13, 18, 6, 4, '#3a5a9a');
    outline(c, { tint: 0.25 });
  },
});
// a stack of moving boxes (the vacant office)
tile('boxes', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 12, 2);
    R(c, 4, 14, 14, 14, '#c8965a'); R(c, 4, 14, 14, 2, '#e0b07a'); R(c, 10, 14, 2, 14, '#a87a48');
    R(c, 16, 18, 13, 10, '#b88a50'); R(c, 16, 18, 13, 2, '#d8a870'); R(c, 21, 18, 2, 10, '#987040');
    R(c, 7, 4, 12, 10, '#d0a068'); R(c, 7, 4, 12, 2, '#e8c088'); R(c, 12, 4, 2, 10, '#a87a48');
    outline(c);
  },
});

// a long meeting table (tiles join up left-right)
tile('table', {
  solid: true, obj: true, variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 26, 32, 3, 'rgba(0,0,0,0.18)');
    R(c, 0, 6, 32, 18, '#d8c8a8'); R(c, 0, 6, 32, 2, '#ecdcbc'); R(c, 0, 22, 32, 2, '#a8946c'); R(c, 0, 24, 32, 2, WOODD);
    if (v === 0) { R(c, 6, 9, 9, 7, '#f8f8f4'); R(c, 7, 11, 7, 1, '#8a8f99'); R(c, 7, 13, 5, 1, '#8a8f99'); }
    if (v === 1) { R(c, 19, 9, 6, 8, '#ffffff'); R(c, 20, 11, 4, 1, '#8a8f99'); R(c, 8, 12, 3, 5, '#e8e8e8'); }
    if (v === 2) { R(c, 12, 10, 8, 6, '#3a5a9a'); R(c, 13, 11, 6, 1, '#8fa4c8'); }
  },
});

// ------------------------------------------------------------------ props: the party board / backdrop
const box = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
function emblem(ctx, cx, cy, r, pt) {
  const col = (pt && pt.color) || '#5a6a8a';
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.fill();
  const ch = Array.from((pt && pt.short) || '党')[0];
  text(ctx, ch, cx, cy - r * 0.55, { size: Math.max(5, Math.round(r * 1.05)), align: 'center', color: col, shadow: null });
}
// The board behind the reception: logo (real parties) or the party mark + name (fictional).
function partyBoard(hq, x, y, w, h, kind = 'board') {
  return {
    type: 'prop', x, y, w, h, solid: false, z: -400,
    draw(ctx, sx, sy, g) {
      G = g;
      const pt = partyOf(hq, g);
      const W = w * 16, H = h * 16;
      if (!pt) {
        box(ctx, sx + 3, sy + 4, W - 6, H - 8, '#3a3f4a'); box(ctx, sx + 4, sy + 5, W - 8, H - 10, '#f4f4f0');
        text(ctx, HQS[hq].closed, sx + W / 2, sy + H / 2 - 5, { size: 8, align: 'center', color: '#3a3f4a', shadow: null });
        return;
      }
      const col = pt.color || '#5a6a8a';
      if (kind === 'backdrop') {
        box(ctx, sx, sy + 2, W, H - 2, col);
        for (let i = 0; i < W; i += 4) box(ctx, sx + i, sy + 2, 1, H - 2, 'rgba(0,0,0,0.08)');
        box(ctx, sx, sy + 2, W, 1.5, 'rgba(255,255,255,0.35)');
      } else {
        box(ctx, sx + 2, sy + 3, W - 4, H - 6, '#2a2018'); box(ctx, sx + 3, sy + 4, W - 6, H - 8, '#ffffff');
        box(ctx, sx + 3, sy + H - 7, W - 6, 2, col);
      }
      const logo = pt.logo || (PARTY_DEFS[pt.id] && PARTY_DEFS[pt.id].logo);
      if (logo) {
        if (kind === 'backdrop') { box(ctx, sx + W / 2 - 13, sy + 4, 26, H - 6, '#ffffff'); drawLogo(ctx, logo, sx + W / 2 - 12, sy + 5, 24, H - 8, {}); }
        else drawLogo(ctx, logo, sx + W / 2 - 14, sy + 5, 28, H - 12, {});
        if (kind === 'board') {
          text(ctx, pt.name, sx + 8, sy + H / 2 - 4, { size: 6, color: '#2a2d36', shadow: null });
        }
      } else {
        const ex = kind === 'backdrop' ? sx + 14 : sx + 14;
        emblem(ctx, ex, sy + H / 2, Math.min(9, H / 2 - 5), pt);
        text(ctx, pt.name, sx + W / 2 + 6, sy + H / 2 - 4.5, { size: 8, align: 'center', color: kind === 'backdrop' ? '#ffffff' : '#2a2d36', shadow: kind === 'backdrop' ? 'rgba(0,0,0,0.4)' : null });
      }
    },
  };
}
// a small framed party poster (wall): the party colour and mark, no faces, no slogans
function poster(hq, x, y) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: false, z: -400,
    draw(ctx, sx, sy, g) {
      const pt = partyOf(hq, g);
      if (!pt) return;
      box(ctx, sx + 2, sy + 1, 12, 15, '#2a2d36');
      box(ctx, sx + 2.5, sy + 1.5, 11, 14, '#ffffff');
      box(ctx, sx + 2.5, sy + 1.5, 11, 4, pt.color || '#5a6a8a');
      const logo = pt.logo || (PARTY_DEFS[pt.id] && PARTY_DEFS[pt.id].logo);
      if (logo) drawLogo(ctx, logo, sx + 4, sy + 6, 8, 9, {});
      else emblem(ctx, sx + 8, sy + 10.5, 3.5, pt);
    },
  };
}

// ------------------------------------------------------------------ people
const STAFF = {
  recep: { name: '受付', look: { ...LOOKS.receptionist, top: '#f2f2f2', bottom: '#2a2d36' } },
  donate: { name: '寄付の窓口', look: { ...LOOKS.salaryman, top: '#4a4f5a', tie: '#8a6a2a', glasses: true } },
  guard: { name: '警備員', look: LOOKS.guard },
  staff: { name: '党の職員', look: { ...LOOKS.salaryman, top: '#3a3f4a', tie: '#5a6a8a' } },
  staff2: { name: '党の職員', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#e8e6e0', bottom: '#3a3f55', jacket: true } },
  volunteer: { name: 'ボランティア', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#f2f2f2', bottom: '#3a4a7a' } },
  kisha: { name: '記者', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#e8e6e0', bottom: '#3a3f55', jacket: true } },
  kisha2: { name: '記者', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#5a6f8a', bottom: '#2a2d36', jacket: true, glasses: true } },
  agent: { name: '不動産会社の人', look: { ...LOOKS.salaryman, top: '#6a5a4a', tie: '#c0452f' } },
  tenant: { name: '受付', look: { ...LOOKS.receptionist, top: '#5a8ac8', bottom: '#2a2d36' } },
  secretary: { name: '党の事務局長', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2a2d3a', bottom: '#2a2d3a', jacket: true, tie: '#e05a8a', glasses: true } },
};
const who = (w) => ({ name: w.name, look: w.look });
const say = (g, lines, w) => g.say(lines, w ? who(w) : {});
const posted = (dir, fn) => async (g, e) => { G = g; await fn(g, e); if (e) e.dir = dir; };
// A party officer NPC (post: 'kanjicho' | 'sentai' | 'seichokai' | 'leader').
function officer(hq, post) {
  const at = () => { const g = game(); const pt = partyOf(hq, g); if (!g || !pt) return null; const id = post === 'leader' ? pt.leader : pt.posts && pt.posts[post]; return id && id !== 'player' ? npcOf(g, id) : null; };
  const title = () => { const g = game(); const pt = partyOf(hq, g); if (!pt) return ''; return post === 'leader' ? leaderTitle(pt) : postName(post, fyOf(g), pt.id); };
  return {
    get name() { const n = at(); return n ? `${title()}・${surname(n)}` : title(); },
    get look() { const n = at(); return (n && n.look) || { ...LOOKS.manager }; },
    present: (g) => { G = g; return !!at(); },
  };
}

// ------------------------------------------------------------------ lobby scripts
async function recepTalk(g, npc, hq) {
  G = g;
  const pt = partyOf(hq, g);
  if (!pt) {
    if (HQS[hq].mine) { await say(g, ['（受付には、だれもいない）'], null); return; }
    await say(g, [`${HQS[hq].closed}の受付です。`, yearOf(g) >= 2016 && hq === 'minshu_hq' ? 'このフロアには以前、民主党の本部がありました。\nいまは、わたしたちの会社のオフィスです。' : 'ここは、いくつかの会社が入るオフィスビルです。\n政党の本部は、通りの向こうですよ。'], STAFF.tenant);
    return;
  }
  for (let guard = 0; guard < 5; guard++) {
    const member = isMember(g, pt);
    const items = ['党について聞く', member ? '離党したい' : '入党したい', 'フロアの案内', 'またね'];
    const i = await g.ask(`${pt.name}本部へようこそ。\nご用件をおうかがいします。`, items, { cancel: items.length - 1, ...who(STAFF.recep) });
    if (i === 0) await partyInfo(g, pt);
    else if (i === 1) { if (member) await leaveParty(g, pt); else await joinParty(g, pt); }
    else if (i === 2) await say(g, ['2階が選挙対策本部、3階が' + seichoName(g, pt) + '、\n4階が' + kanbuName(pt) + 'です。', '1階の奥が記者会見室。\nエレベーターは右手の奥です。'], STAFF.recep);
    else return;
    if (g.auto) return;
  }
}
async function partyInfo(g, pt) {
  const def = PARTY_DEFS[pt.id];
  const s = seatsOf(g, pt);
  let sup = 0;
  try { sup = g.partySupport(pt.id); } catch (e) { sup = 0; }
  const leader = pt.leader === 'player' ? g.state.name : (npcOf(g, pt.leader) || {}).name || '';
  const pages = [];
  if (pt.real && def) pages.push(...paged(def.desc));
  else if (pt.isPlayers || /^my\d+$/.test(pt.id)) pages.push(...paged(`${pt.desc || ''}`));
  else pages.push(...paged(`${def ? def.desc : pt.desc || ''}`));
  pages.push(`${leaderTitle(pt)}は${leader}${pt.leader === 'player' ? '（あなた）' : '氏'}。\n衆議院${s.shugi}人・参議院${s.sangi}人、支持率${sup}%。${pt.real ? '' : '\n（この党は架空の政党です）'}`);
  await g.say(pages, who(STAFF.recep));
}
async function joinParty(g, pt) {
  if (pt.isPlayers || /^my\d+$/.test(pt.id)) { await say(g, 'この党への入党は、党首の承認が必要です。', STAFF.recep); return; }
  const p = pol(g);
  const cur = p && p.me.party ? g.partyName(p.me.party) : null;
  const fee = pt.id === 'jimin' ? `一般党員の党費は年${fmtMoney(Math.round(4000 / rate()))}です。` : pt.real ? '党費は、党の規約で決まっています。' : `党費は年${fmtMoney(Math.round(4000 / rate()))}ほど（目安）です。`;
  const i = await g.ask([`${pt.name}に入党しますか？\n${fee}`, cur ? `（いまの「${cur}」は離党することになります）` : '（党員になると、選挙の公認を申請できます）'], ['入党する', 'やめておく'], { cancel: 1, ...who(STAFF.recep) });
  if (i !== 0) return;
  const w = g.joinParty(pt.id);
  if (w) { await say(g, w, STAFF.recep); return; }
  g.sfx('fanfare');
  await say(g, [`${pt.name}に入党した！`, '党員証を受け取った。\n公認の申請は2階の選挙対策本部へ。'], null);
}
async function leaveParty(g, pt) {
  const lead = isLeader(g, pt);
  const i = await g.ask([`${pt.name}を離党しますか？`, lead ? '（党首が離党すると、党はほかの議員に引き継がれるか、\n　だれもいなければ解散することになります）' : '（党の役職や、閣僚のポストを失うことがあります）'], ['離党する', 'やめておく'], { cancel: 1, ...who(STAFF.recep) });
  if (i !== 0) return;
  const w = g.leaveParty();
  await say(g, w || `${pt.name}を離党した。`, null);
}
// 寄付の窓口: personal money -> the party (年2,000万円まで・年5万円をこえると氏名が公開)
async function donateTalk(g, npc, hq) {
  G = g;
  const pt = partyOf(hq, g);
  if (!pt) { await say(g, '（窓口は閉まっている）', null); return; }
  const yr = yearOf(g);
  const key = `parties_don_${pt.id}_${yr}`;
  const given = Number(g.flag(key) || 0); // nominal yen of that year
  // amounts in that year's yen (1万・5万・10万円); internal money = nominal / the era's price rate
  const noms = [10000, 50000, 100000];
  const amounts = noms.map((n) => Math.round(n / rate()));
  const disclose = yr >= 1995; // 年5万円超の公開基準 (verified for the present rules only)
  const i = await g.ask([`${pt.name}への寄付の窓口です。`, `個人の政党への寄付は、法律で年2,000万円まで。\n${disclose ? '年5万円をこえる寄付は、寄付した人の名前が\n政治資金収支報告書で公開されます。' : '一定の額をこえる寄付は、寄付した人の名前が\n収支報告書で公開されます。'}`], [...amounts.map((a) => fmtMoney(a)), 'やめておく'], { cancel: amounts.length, ...who(STAFF.donate) });
  if (i < 0 || i >= amounts.length) return;
  const amt = amounts[i];
  if (given + noms[i] > 20000000) { await say(g, '今年の寄付は、法律の上限に達してしまいます。\nお気持ちだけ、ありがたく。', STAFF.donate); return; }
  if (!g.spend(amt)) { await say(g, 'お金が足りない…。', null); return; }
  g.sfx('coin');
  g.setFlag(key, given + noms[i]);
  pt.funds = (Number(pt.funds) || 0) + amt;
  const p = pol(g);
  // a member's donation is noticed once a year (money must not buy a nomination)
  const bonusKey = `parties_don_bonus_${pt.id}_${yr}`;
  if (p && isMember(g, pt) && !g.flag(bonusKey)) { g.setFlag(bonusKey, true); p.me.standing = clamp((Number(p.me.standing) || 0) + 1, 0, 100); }
  const crossed = disclose && given <= 50000 && given + noms[i] > 50000;
  await say(g, [`${fmtMoney(amt)}を寄付した。`, `領収書をお渡しします。ありがとうございました。${crossed ? '\n（今年の合計が年5万円をこえたので、名前が公開されます）' : ''}`], STAFF.donate);
}

// ------------------------------------------------------------------ the vacant office / founding
const COLORS = [['さくら色', '#e05a8a'], ['そら色', '#3a9ad9'], ['わかば色', '#4aa84a'], ['こがね色', '#d8a020'], ['ふじ色', '#8a6ac8'], ['あかね色', '#d84a3a'], ['すみ色', '#4a4f5a']];
async function agentTalk(g, npc) {
  G = g;
  const p = pol(g);
  const S = STAFF.agent;
  if (!p) { await say(g, 'このフロア、空いてますよ。', S); return; }
  const cost = Math.round(5000000 / rate());
  const i = await g.ask(['いらっしゃいませ。このビル、まるごと空き物件なんです。', '新しい政党の事務所にぴったりですよ。\n…ひょっとして、党を立ち上げるおつもりで？'], ['新党を立ち上げる', '話を聞く', 'やめておく'], { cancel: 2, ...who(S) });
  if (i === 1) {
    await g.say(subsidyExists(yearOf(g))
      ? [`党をつくるには、事務所や届け出、印刷物などで\n${fmtMoney(cost)}くらいかかります（目安）。`, '法律の上で「政党」と認められるには、\n国会議員5人以上か、国会議員がいて\n選挙の得票率が2%以上あることが条件です。', 'そうなれば、国から政党交付金も出ます。\n…まずは、仲間と支持を集めることですね。']
      : [`党をつくるには、事務所や届け出、印刷物などで\n${fmtMoney(cost)}くらいかかります（目安）。`, 'いまは国から政党にお金が出る制度はありません。\n党の資金は、党費と寄付と事業で集めるんです。', '国会で力を持つには、議員の数がすべて。\n…まずは、仲間と支持を集めることですね。'], who(S));
    return;
  }
  if (i !== 0) return;
  await foundFlow(g, cost);
}
async function askName(g, title, value, max) {
  try { return await askText(g, { title, value, max }); } catch (e) { console.error(e); return value; }
}
async function foundFlow(g, cost) {
  const S = STAFF.agent;
  if (g.state.money + (pol(g) ? pol(g).me.funds : 0) < cost) { await say(g, [`結党には${fmtMoney(cost)}ほど必要です（目安）。`, '資金をためてから、また来てくださいね。'], S); return; }
  const name = await askName(g, '党の名前（12文字まで）', 'ドット未来党', 12);
  if (!name) return;
  const base = Array.from(name.replace(/党$/, ''));
  const short = await askName(g, '略称（4文字まで）', (base.length <= 4 ? base.join('') : base.slice(-2).join('')) || Array.from(name).slice(0, 2).join(''), 4);
  if (!short) return;
  const ci = await g.list({ title: '党のイメージカラー', items: COLORS.map((c) => c[0]), x: 16, y: 56, w: 200, px: true });
  if (ci < 0) return;
  const platform = [];
  for (let k = 0; k < 5; k++) {
    const j = await g.ask(`公約（${platform.length}/5）：\n${platform.map((id) => POLICIES[id].name.replace(/（[^）]*）/g, '')).join('・').slice(0, 60) || 'まだない'}`, ['政策を選ぶ', 'これで決める'], { cancel: 1 });
    if (j !== 0) break;
    const id = await pickPolicy(g, '公約にする分野', { allowBlocked: true });
    if (id && !platform.includes(id)) platform.push(id);
    if (g.auto) break;
  }
  const desc = `${g.state.name}が立ち上げた政党。${platform.length ? `${POLICIES[platform[0]].name.replace(/（[^）]*）/g, '')}などをかかげる。` : ''}`;
  const cur = pol(g) && pol(g).me.party ? g.partyName(pol(g).me.party) : null;
  const ok = await g.ask([`「${name}」（${short}）を結成する？\n費用 ${fmtMoney(cost)}（目安）`, ...(cur ? [`（いまの「${cur}」は離党することになる）`] : [])], ['結成する', 'やめておく'], { cancel: 1 });
  if (ok !== 0) return;
  const id = g.foundParty({ name, short, color: COLORS[ci][1], platform, desc });
  if (!id) { await say(g, g.lastPoliticsError || '結成できなかった。', null); return; }
  g.sfx('fanfare');
  await g.say([`新党「${name}」を結成した！`, 'このビルが、あなたの党の本部になった。\n4階の党首室で、党の運営ができる。', subsidyExists(yearOf(g)) ? '政党要件（国会議員5人以上など）を満たすには、\n選挙で勝つか、議員を仲間に引き入れよう。' : '党を大きくするには、選挙で勝つか、\n議員を仲間に引き入れよう。']);
}

// ------------------------------------------------------------------ policy picker
async function pickPolicy(g, title, opts = {}) {
  const areas = AREA_ORDER.filter((a) => POLICY_ORDER.some((id) => POLICIES[id].area === a));
  const a = await g.list({ title, items: areas.map((x) => POLICY_AREAS[x].name), x: 16, y: 56, w: 240, px: true, describe: (k) => POLICY_AREAS[areas[k]].desc });
  if (a < 0) return null;
  const ids = POLICY_ORDER.filter((id) => POLICIES[id].area === areas[a]);
  const blocks = ids.map((id) => { try { return g.policyBlock(id); } catch (e) { return null; } });
  const k = await g.list({
    title: POLICY_AREAS[areas[a]].name, x: 16, y: 56, w: 420, px: true,
    items: ids.map((id, i) => ({ label: POLICIES[id].name.slice(0, 22), disabled: !opts.allowBlocked && !!blocks[i] })),
    describe: (i) => { const pl = POLICIES[ids[i]]; let pv = null; try { pv = g.policyPreview(ids[i]); } catch (e) { pv = null; } return `${pl.desc}${pv && pv.cost ? `（${pv.cost > 0 ? '費用' : '財政の改善'} 年${fmtCho(Math.abs(pv.cost))}）` : ''}${blocks[i] && !opts.allowBlocked ? `\n※${blocks[i]}` : ''}`; },
  });
  if (k < 0) return null;
  if (blocks[k] && !opts.allowBlocked) { await g.say(blocks[k]); return null; }
  return ids[k];
}
function sidesText(g, id) {
  let pv = null;
  try { pv = g.policyPreview(id); } catch (e) { pv = null; }
  const segs = Object.entries((pv && pv.segments) || {}).filter(([s]) => SEGMENTS[s]);
  const win = segs.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => SEGMENTS[s].name);
  const lose = segs.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([s]) => SEGMENTS[s].name);
  return { win, lose, pv };
}

// ------------------------------------------------------------------ 選挙対策本部
async function sentaiTalk(g, npc, hq) {
  G = g;
  const pt = partyOf(hq, g);
  const S = { name: npc.name, look: npc.look };
  if (!pt) { await g.say('（だれもいない）'); return; }
  if (!isMember(g, pt)) { await g.say(['選挙対策本部です。', `公認の申請は、${pt.name}の党員のかただけ。\nまずは1階の受付で入党の手続きを。`], S); return; }
  const list = (() => { try { return g.upcomingElections().filter((e) => !e.newsOnly && e.kind !== 'sosaisen'); } catch (e) { return []; } })();
  if (!list.length) { await g.say(['いまは、予定されている選挙がありません。', '選挙がないときこそ、地元を回って\n後援会を固めておくことです。'], S); return; }
  await g.say(`${/・/.test(npc.name) ? `${npc.name.replace('・', 'の')}です。` : '選挙対策本部です。'}\nどの選挙の公認を希望しますか？`, S);
  const i = await g.list({ title: '選挙の予定', items: list.map((e) => ({ label: e.label.slice(0, 16), right: e.declared ? '届出ずみ' : e.date.replace(/^(?:19|20)(\d\d)年/, '$1年') })), x: 16, y: 56, w: 420, px: true, describe: (k) => `${list[k].kojiDate}に${['shugi', 'sangi'].includes(list[k].kind) ? '公示' : '告示'}、${list[k].date}投票` });
  if (i < 0) return;
  const e = list[i];
  if (e.declared) {
    let f = null;
    try { f = g.electionForecast(e.id); } catch (err) { f = null; }
    await g.say([`${e.label}、いよいよですね。`, f ? `うちの情勢調査では、当選の見込みは${Math.round(f.chance * 100)}%。\n${f.rank}位前後（定数${f.seats}）です。` : '比例は、党全体の票しだいです。\n全国で党の名前を売りましょう！', `街頭演説、ポスター、握手…\n選挙運動は、${device(g)}の「政治」からもできます。`], S);
    return;
  }
  const p = pol(g);
  // The route comes first: a 比例 nomination is decided separately (and for a famous person it is
  // the easier door: 参院の比例代表, 衆院の比例単独).
  let route = false; // false: 選挙区 / true: 参院の比例代表 / 'only': 衆院の比例単独
  let sys = 'heiritsu';
  if (e.kind === 'shugi') { try { sys = shugiRules(yearOf(g), (p && p.flags) || {}).system; } catch (err) { sys = 'heiritsu'; } }
  if (e.kind === 'sangi') {
    const k = await g.ask(['どちらで公認を申請しますか？', '（比例代表は党の名簿で全国から選ばれる。\n　知名度のある人には、入りやすい入口だ）'], ['選挙区で', '比例代表で', 'やめておく'], { cancel: 2, ...S });
    if (k < 0 || k > 1) return;
    route = k === 1;
  } else if (e.kind === 'shugi' && sys !== 'chusenkyoku') {
    const k = await g.ask(['どちらで公認を申請しますか？', '（小選挙区の候補は、比例代表との重複立候補もできる。\n　比例代表だけで出る「比例単独」の枠は少ない）'], ['小選挙区で', '比例代表だけで', 'やめておく'], { cancel: 2, ...S });
    if (k < 0 || k > 1) return;
    route = k === 1 ? 'only' : false;
  }
  const r = g.requestNomination(e.id, route ? { proportional: route } : {});
  if (!r || !r.ok) {
    // r.eligible === false: the law (被選挙権) bars the player, not the party; no point in "growing" anything
    const tail = r && r.eligible === false ? [] : ['党内の評価、地元の支持、知名度。\nどれかを伸ばしてから、また来てください。'];
    await g.say([`${e.label}の${r && r.kind ? r.kind : '公認'}ですが…`, (r && r.why) || '今回は見送りです。', ...tail], S); return;
  }
  const suisen = r.kind === '推薦';
  g.sfx('success');
  await g.say([`${e.label}、${pt.name}の${r.kind}が決まりました！`, '必勝だるまに、片目を入れておきますね。'], S);
  const why = g.eligible(e.office);
  if (why) { await g.say(['ただ、立候補の届出の前に…', why], S); return; }
  // 公職選挙法90条: an office holder who files for another office loses the present one
  const cur = p && p.me.office && OFFICES[p.me.office] && p.me.office !== e.office ? OFFICES[p.me.office].label : null;
  const j = await g.ask([`このまま、立候補を届け出ますか？\n${route ? '（比例代表の供託金は、党が納めます）' : '（供託金が必要です）'}`, ...(cur ? [`（いまの${cur}の職は、${['shugi', 'sangi'].includes(e.kind) ? '公示' : '告示'}の日に\n　辞めたことになります。公職選挙法90条）`] : [])], ['届け出る', 'あとにする'], { cancel: 1, ...S });
  if (j !== 0) return;
  let proportional = route;
  if (e.kind === 'shugi' && sys !== 'chusenkyoku' && !route) proportional = (await g.ask('比例代表にも重複して立候補しますか？', ['重複する', '小選挙区だけ'], { cancel: 1, ...S })) === 0;
  const w = g.declareCandidacy(e.id, { party: pt.id, proportional });
  if (w) { await g.say(w, S); return; }
  g.sfx('fanfare');
  await g.say([`${e.label}に、${pt.name}の${suisen ? '推薦を受けて' : '公認で'}立候補した！`, `${e.kojiDate}の${['shugi', 'sangi'].includes(e.kind) ? '公示' : '告示'}から、本格的な選挙運動だ。`]);
}
async function phoneBank(g) {
  G = g;
  const p = pol(g);
  const e = p && typeof g.myElection === 'function' ? g.myElection() : null;
  if (!e) { await g.say(['電話作戦の机だ。', '選挙が近づくと、ボランティアがここで\n支援のお願いの電話をかけるらしい。']); return; }
  const i = await g.ask('ボランティアといっしょに、支援を呼びかける？', ['後援会に電話する', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  const r = await g.campaign('後援会', { electionId: e.id });
  await g.say(r && r.ok ? ['ボランティアといっしょに、後援会の名簿に電話をかけた。', `「よろしくお願いします！」…手ごたえはあった。\n${effects(r)}`] : (r && r.why) || 'いまはできない。');
}

// ------------------------------------------------------------------ 政務（政策）調査会
async function seichoTalk(g, npc, hq) {
  G = g;
  const pt = partyOf(hq, g);
  const S = { name: npc.name, look: npc.look };
  if (!pt) { await g.say('（だれもいない）'); return; }
  for (let guard = 0; guard < 4; guard++) {
    const items = ['党の公約を見る', '政策を提言する', '勉強会に出る', 'またね'];
    const i = await g.ask(`${seichoName(g, pt)}です。\n党の政策は、ここで議論して決めます。`, items, { cancel: items.length - 1, ...S });
    if (i === 0) {
      const names = (pt.platform || []).filter((id) => POLICIES[id]).map((id) => `・${POLICIES[id].name.replace(/（[^）]*）/g, '').slice(0, 20)}`);
      const pages = [];
      for (let k = 0; k < names.length; k += 3) pages.push(names.slice(k, k + 3).join('\n'));
      await g.say(pages.length ? [`${pt.name}の主な政策です。`, ...pages, pt.real ? '（シミュレーション上の政策の傾向です）' : ''].filter(Boolean) : '公約は、まだ決まっていません。', S);
    } else if (i === 1) await proposePolicy(g, pt, S);
    else if (i === 2) {
      if (!isMember(g, pt) || !isNational(g)) { await g.say('勉強会は、党所属の国会議員の集まりです。', S); continue; }
      const r = g.activity('勉強会');
      await g.say(r && r.ok ? ['部会の勉強会に出た。', `役所の担当者から説明を聞き、質問もした。\n${effects(r)}`] : (r && r.why) || 'いまは出られない。');
    } else return;
    if (g.auto) return;
  }
}
async function proposePolicy(g, pt, S) {
  if (!isMember(g, pt)) { await g.say('政策の提言は、党員のかたからお受けしています。', S); return; }
  const id = await pickPolicy(g, '提言する政策の分野', { allowBlocked: !isNational(g) });
  if (!id) return;
  const { win, lose, pv } = sidesText(g, id);
  const al = pv && pv.alignment ? pv.alignment[pt.id] : 0.5;
  const fit = al >= 0.65 ? '党の方針にかなり近い' : al >= 0.45 ? '党内でも意見が分かれそうだ' : '党の方針とはかなりちがう';
  await g.say([`「${POLICIES[id].name}」ですね。\n${fit}な。`, `${win.length ? `喜ぶのは${win.join('や')}。` : ''}${lose.length ? `\n負担を感じるのは${lose.join('や')}だろう。` : ''}${pv && pv.cost ? `\n費用は年${fmtCho(Math.abs(pv.cost))}ほど。` : ''}`], S);
  if (isNational(g)) {
    const j = await g.ask('議員立法として、法案にまとめる？', ['法案にする', 'やめておく'], { cancel: 1, ...S });
    if (j !== 0) return;
    const bill = g.proposeBill({ policy: id });
    await g.say(bill ? ['法案の原案をまとめた。', `賛成者が集まれば、国会に提出できる。\n（${device(g)}の「政治」→ 国会 から声をかけよう）`] : (g.lastPoliticsError || 'まとめられなかった。'), S);
    return;
  }
  // a member's proposal is taken up at most once a month (10 days)
  const last = Number(g.flag('parties_teigen'));
  if (Number.isFinite(last) && g.flag('parties_teigen') != null && g.state.day - last < 10) { await g.say(['先日の提言は、いま部会で検討しているところです。', 'またしばらくしたら、聞かせてください。'], S); return; }
  g.setFlag('parties_teigen', g.state.day);
  const p = pol(g);
  if (p) p.me.standing = clamp((Number(p.me.standing) || 0) + 1, 0, 100);
  await g.say(['わかりました。部会で検討してみます。', '（提言が党内で話題になった。党内の評価が少し上がった）'], S);
}

// ------------------------------------------------------------------ 幹部室
async function kanbuTalk(g, npc, hq) {
  G = g;
  const pt = partyOf(hq, g);
  const S = { name: npc.name, look: npc.look };
  if (!pt) { await g.say('（だれもいない）'); return; }
  const p = pol(g);
  if (!isMember(g, pt)) {
    await g.say([`${pt.name}の${npc.name.split('・')[0]}です。`, (g.state.fame || 0) >= 1000 ? 'あなたのような知名度のある人なら、\nうちの党で選挙に出てもらいたいくらいだ。' : '政治に関心があるなら、まずは入党して\n地元の活動から始めることだね。'], S);
    return;
  }
  for (let guard = 0; guard < 5; guard++) {
    const offers = p.me.offers.filter((o) => !o.answered && o.kind === 'partyPost' && o.party === pt.id);
    const sosai = (() => { try { return g.upcomingElections().find((e) => e.kind === 'sosaisen' && e.party === pt.id); } catch (e) { return null; } })();
    const items = ['党内の評価を聞く', '派閥・グループ', offers.length ? `役職の打診（${offers.length}）` : null, sosai ? `${leaderTitle(pt)}選に出る` : null, 'またね'].filter(Boolean);
    const i = await g.ask(`${pt.name}の${kanbuName(pt)}だ。`, items, { cancel: items.length - 1, ...S });
    const pick = items[i];
    if (pick === '党内の評価を聞く') {
      const st = Math.round(Number(p.me.standing) || 0);
      const word = st >= 70 ? '党の中心のひとりだ' : st >= 45 ? '期待されている' : st >= 25 ? 'まだ様子を見られている' : '信頼を取りもどす必要がある';
      await g.say([`党内での君の評価は…${word}。（${st}）`, '国会への出席、勉強会、選挙の勝ち負け。\nそういう積み重ねが、評価になるんだ。'], S);
    } else if (pick === '派閥・グループ') await factionMenu(g, pt, S);
    else if (pick && pick.startsWith('役職の打診')) {
      const o = offers[0];
      const j = await g.ask(`${pt.name}の${postName(o.post, fyOf(g), pt.id)}をお願いしたい。\n引き受けてくれるか？`, ['引き受ける', 'ことわる'], { cancel: 1, ...S });
      const w = g.respondOffer(o.id, j === 0);
      await g.say(w || (j === 0 ? `${postName(o.post, fyOf(g), pt.id)}に就任した！` : 'ことわった。'), S);
    } else if (pick && pick.endsWith('選に出る')) {
      const w = g.declareCandidacy(sosai.id, {});
      await g.say(w || [`${leaderTitle(pt)}選に立候補した！`, `${sosai.date}の投票で決まる。\n議員と党員の票を集めよう。`], S);
    } else return;
    if (g.auto) return;
  }
}
async function factionMenu(g, pt, S) {
  const fs = pt.factions || [];
  const p = pol(g);
  if (!fs.length) { await g.say('うちの党には、派閥やグループはないよ。', S); return; }
  const items = fs.map((f) => ({ label: f.name, right: `${f.size}人${p.me.faction === f.id ? '（所属）' : ''}` }));
  if (p.me.faction) items.push({ label: '派閥・グループを抜ける' });
  const k = await g.list({ title: '派閥・グループ', items, x: 16, y: 56, w: 300, px: true });
  if (k < 0) return;
  if (k >= fs.length) { const w = g.leaveFaction(); await g.say(w || '派閥・グループを抜けた。', S); return; }
  const w = g.joinFaction(fs[k].id);
  await g.say(w || `${fs[k].name}に入った。`, S);
}

// ------------------------------------------------------------------ 党首室 (the player's own party)
function ideologyOf(list) {
  const v = { econ: 0, social: 0, security: 0 };
  let n = 0;
  for (const id of list) { const pl = POLICIES[id]; if (!pl || !pl.ideo) continue; v.econ += Number(pl.ideo.econ) || 0; v.social += Number(pl.ideo.social) || 0; v.security += Number(pl.ideo.security) || 0; n++; }
  if (n) for (const k of Object.keys(v)) v[k] = clamp(v[k] / n * 1.5, -2, 2);
  return v;
}
async function leaderDesk(g, hq) {
  G = g;
  const pt = partyOf(hq, g);
  if (!pt || !isLeader(g, pt)) {
    await g.say(pt ? [`${pt.name}の${leaderTitle(pt)}の机だ。`, '書類がきちんと積まれている。\n…勝手にさわってはいけない。'] : '（空っぽの机だ）');
    return;
  }
  const p = pol(g);
  for (let guard = 0; guard < 8; guard++) {
    // the leader's own re-election (党首選) when one is scheduled
    const sosai = (() => { try { return g.upcomingElections().find((e) => e.kind === 'sosaisen' && e.party === pt.id && !e.declared); } catch (e) { return null; } })();
    const items = ['党の状況', '議員を勧誘する', '党役員を任命', '党の資金', '公約を見直す', '連立の方針', 'もどる'];
    if (sosai) items.splice(6, 0, `${leaderTitle(pt)}選に出る`);
    const i = await g.ask(`${pt.name}の${pt.isPlayers ? '党首室' : `${leaderTitle(pt)}の机`}。\n${leaderTitle(pt)}として、何をする？`, items, { cancel: items.length - 1 });
    if (sosai && i === 6) {
      const w = g.declareCandidacy(sosai.id, {});
      await g.say(w || [`${leaderTitle(pt)}選に立候補した！`, `${sosai.date}の投票で決まる。\n議員と党員の票を集めよう。`]);
      if (g.auto) return;
      continue;
    }
    if (i === items.length - 1) return;
    if (i === 0) {
      const s = g.partyStatus(pt.id);
      await g.say([`衆議院${s.shugi}人・参議院${s.sangi}人・党員${Number(s.members).toLocaleString('ja-JP')}人`, `政党要件：${s.official ? '満たしている' : `まだ（${s.reason}）`}\n政党交付金：${s.subsidy ? `年${fmtMoney(s.subsidy)}` : 'なし'}`, `党の資金 ${fmtMoney(s.funds)}・得票率 ${Math.round((s.voteShare || 0) * 1000) / 10}%`]);
    } else if (i === 1) {
      const offers = [0, 1000000, 5000000].map((n) => Math.round(n / rate())); // 0・100万・500万円 (that year's yen)
      const j = await g.ask(['ほかの党や無所属の議員に、入党を呼びかける。', '活動資金の支援を約束すると、話が早いかもしれない。\n（党の資金・政治資金から出す）'], [...offers.map((o) => (o ? `${fmtMoney(o)}を約束` : '資金なしで')), 'やめておく'], { cancel: offers.length });
      if (j < 0 || j >= offers.length) continue;
      const r = g.recruitMembers({ funds: offers[j] });
      if (!r || !r.ok) { await g.say((r && r.why) || 'いまはできない。'); continue; }
      await g.say(r.joined.length ? [`${r.joined.map((x) => x.name).join('・')}氏が入党した！`, `（衆議院${r.status.shugi}人・参議院${r.status.sangi}人に）`] : ['声をかけて回ったが、色よい返事はなかった…。']);
    } else if (i === 2) await appointMenu(g, pt);
    else if (i === 3) {
      const j = await g.ask([`党の資金は${fmtMoney(pt.funds)}。`, '自分の政治資金に移す？\n（収支報告書に記載が必要）'], ['100万円分を移す', 'やめておく'], { cancel: 1 });
      if (j !== 0) continue;
      const w = g.transferPartyFunds(Math.round(1000000 / rate()));
      await g.say(w || `${fmtMoney(Math.round(1000000 / rate()))}を政治資金に移した。`);
    } else if (i === 4) await platformMenu(g, pt);
    else if (i === 5) {
      if ((p.cabinet.partyIds || [])[0] === pt.id) { await g.say(['あなたの党が、いまの政権の中心だ。', '連立の相手は、総理が組閣や内閣改造のときに決める。']); if (g.auto) return; continue; }
      const ruling = (p.cabinet.partyIds || []).includes(pt.id);
      const j = await g.ask(ruling ? 'いまは連立与党だ。どうする？' : '連立政権について、どうする？', ruling ? ['連立を離脱する', '方針を変えない'] : ['連立に加わる', '連立の誘いを断る', '状況しだい', 'もどる'], { cancel: ruling ? 1 : 3 });
      let w = null;
      if (ruling && j === 0) w = g.leaveCoalition() || '連立から離脱した。';
      else if (!ruling && j === 0) w = g.joinCoalition() || '連立政権に加わった！';
      else if (!ruling && j === 1) w = g.setCoalitionStance('refuse') || '連立の誘いは断る方針にした。';
      else if (!ruling && j === 2) w = g.setCoalitionStance('auto') || '連立は、状況しだいで考えることにした。';
      if (w) await g.say(w);
    } else return;
    if (g.auto) return;
  }
}
async function appointMenu(g, pt) {
  const posts = PARTY_POST_ORDER.filter((x) => !(POSTS[x].parties && !POSTS[x].parties.includes(pt.id)));
  const k = await g.list({ title: '党役員', items: posts.map((x) => ({ label: postName(x, fyOf(g), pt.id), right: pt.posts[x] === 'player' ? 'あなた' : surname(npcOf(g, pt.posts[x])) || '空席' })), x: 16, y: 56, w: 320, px: true });
  if (k < 0) return;
  const post = posts[k];
  const p = pol(g);
  const members = Object.values(p.npcs || {}).filter((n) => n.party === pt.id && n.office).slice(0, 8);
  const items = [{ label: '自分が兼ねる' }, ...members.map((n) => ({ label: n.name, right: n.office === 'shugi' ? '衆' : n.office === 'sangi' ? '参' : '' }))];
  const j = await g.list({ title: postName(post, fyOf(g), pt.id), items, x: 16, y: 56, w: 300, px: true });
  if (j < 0) return;
  const w = g.appointPartyPost(post, j === 0 ? 'player' : members[j - 1].id);
  await g.say(w || `${postName(post, fyOf(g), pt.id)}を任命した。`);
}
async function platformMenu(g, pt) {
  for (let guard = 0; guard < 6; guard++) {
    const list = (pt.platform || []).filter((id) => POLICIES[id]);
    const items = [...list.map((id) => ({ label: `× ${POLICIES[id].name.replace(/（[^）]*）/g, '').slice(0, 18)}` })), { label: '＋ 政策を加える', disabled: list.length >= 10 }, { label: 'もどる' }];
    const k = await g.list({ title: `公約（${list.length}/10）`, items, x: 16, y: 56, w: 400, px: true, describe: (i) => (i < list.length ? 'A：公約から外す' : '') });
    if (k < 0 || k === items.length - 1) return;
    if (k < list.length) pt.platform = list.filter((_, i) => i !== k);
    else if (list.length < 10) { const id = await pickPolicy(g, '公約に加える分野', { allowBlocked: true }); if (id && !list.includes(id)) pt.platform = [...list, id]; }
    pt.ideology = ideologyOf(pt.platform);
    if (g.auto) return;
  }
}

// ------------------------------------------------------------------ press room
async function podiumTalk(g, hq) {
  G = g;
  const pt = partyOf(hq, g);
  const p = pol(g);
  if (!pt || !isMember(g, pt) || !(p.me.office || isLeader(g, pt))) {
    await g.say(['党の記者会見室だ。', pt ? `${pt.name}の幕の前に、演台とマイクが置いてある。\n党首や幹部が、ここで会見を開く。` : '演台とマイクが置いてある。']);
    return;
  }
  if (today(g, 'parties_press')) { await g.say('今日は、もう会見を開いた。'); return; }
  const i = await g.ask(`${pt.name}の${isLeader(g, pt) ? '党首' : '議員'}として、記者会見を開く？`, ['会見を開く', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  g.setFlag('parties_press', g.state.day);
  if (g.map && g.map.roomId === 'press') g.placePlayer(9, 3, 'down');
  // the press conference lives in kantei.js (looked up at run time, so either file can load alone)
  const press = PLACES.kantei && PLACES.kantei.pressConference;
  if (press) { await press(g, { where: 'party', open: ['（党本部の会見室に、記者たちが集まった）', `「${pt.name}の記者会見を始めます」`] }); return; }
  const r = g.activity('記者会見', { score: 60 });
  await g.say(r && r.ok ? `会見を開いた。\n${effects(r)}` : (r && r.why) || '会見を開いた。');
}

// ------------------------------------------------------------------ floors & exits
const ROOM_SPOT = { lobby: [16, 3, 'down'], sentai: [9, 8, 'up'], seicho: [9, 8, 'up'], kanbu: [8, 8, 'up'], press: [8, 8, 'up'] };
function elevatorFor(hq) {
  return async (g) => {
    G = g;
    const pt = partyOf(hq, g);
    if (!pt) {
      await g.say(HQS[hq].mine ? '（上の階も、がらんとした空き部屋だ。\n　党を立ち上げれば、ここが党の本部になる）' : '（上の階は、テナントの会社のフロアだ。\n　関係者以外は入れない）');
      await g.movePlayer('down');
      return;
    }
    const floors = [['sentai', '2階　選挙対策本部'], ['seicho', `3階　${seichoName(g, pt)}`], ['kanbu', `4階　${kanbuName(pt)}`]];
    const i = await g.ask('エレベーターだ。何階へ行く？', [...floors.map((f) => f[1]), 'やめておく'], { cancel: floors.length });
    if (i < 0 || i >= floors.length) { await g.movePlayer('down'); return; }
    g.sfx('door');
    const s = ROOM_SPOT[floors[i][0]];
    await g.goto(hq, floors[i][0], s[0], s[1], s[2]);
  };
}
// doorIndexFor builds every town; a broken town module elsewhere must not trap the player here.
let doorWarned = false;
function doorOf(pid) {
  try { return doorIndexFor(pid); } catch (e) { if (!doorWarned) { doorWarned = true; console.warn('[parties] door index failed', e); } return null; }
}
function streetSpot(hq) {
  const d = doorOf(hq);
  return d || { town: 'tokyo', room: 'main', x: 40, y: 3 };
}
function exitWarps(hq, xs, y) {
  const out = [];
  for (const x of xs) {
    out.push({ x, y, to: 'exit', cond: () => !!doorOf(hq) });
    out.push({ x, y, dir: 'down', cond: () => !doorOf(hq), get place() { return streetSpot(hq).town; }, get room() { return streetSpot(hq).room; }, get tx() { return streetSpot(hq).x; }, get ty() { return streetSpot(hq).y; } });
  }
  return out;
}
const backTo = (hq, xs, y) => xs.map((x) => ({ x, y, room: 'lobby', tx: ROOM_SPOT.lobby[0], ty: ROOM_SPOT.lobby[1], dir: 'down' }));
const backPress = (hq, xs, y) => xs.map((x) => ({ x, y, room: 'lobby', tx: 18, ty: 3, dir: 'down' }));

// ------------------------------------------------------------------ the template
function buildHQ(hq) {
  const H = HQS[hq];
  const open = (g) => { G = g; return !!partyOf(hq, g); };
  const shut = (g) => { G = g; return !partyOf(hq, g); };
  const vacant = (g) => { G = g; return !!H.mine && !partyOf(hq, g); };
  const tenant = (g) => { G = g; return !H.mine && !partyOf(hq, g); };
  const nonLeader = (g) => { G = g; const pt = partyOf(hq, g); return !!pt && !isLeader(g, pt); };
  const OF = { kanjicho: officer(hq, 'kanjicho'), sentai: officer(hq, 'sentai'), seichokai: officer(hq, 'seichokai'), leader: officer(hq, 'leader') };
  const offNpc = (id, o, x, y, dir, talk, extra = {}) => ({
    type: 'npc', id, x, y, dir, fixedDir: true,
    get name() { return o.name; }, get look() { return o.look; },
    cond: (g) => o.present(g) && (!extra.cond || extra.cond(g)),
    talk: posted(dir, (g, e) => talk(g, e, hq)),
  });
  const staffNpc = (id, w, x, y, dir, extra = {}) => ({ type: 'npc', id, x, y, dir, look: w.look, name: w.name, ...extra });
  const legend = { '#': 'parties_walltop', U: 'parties_wall_u', '=': 'parties_wall', P: 'plant', M: 'exit_mat' };
  return {
    id: hq,
    get name() { const g = game(); const pt = partyOf(hq, g); return pt ? `${pt.name}本部` : H.closed; },
    kind: 'building',
    bgm: 'office',
    start: { room: 'lobby', x: 9, y: 9, dir: 'up' },
    legend,
    rooms: {
      // ---------------------------------------------------------- 1階 受付
      lobby: {
        floor: 'parties_lobbyfloor',
        tiles: [
          '####################',
          '#UUUUUULLLLLLUUUUUU#',
          '#==p===llllll=p=e=d#',
          '#................P.#',
          '#.......KKKK.......#',
          '#.SS..........DD...#',
          '#.tt...............#',
          '#..................#',
          '#P.......[]......P.#',
          '#........[]........#',
          '#########MM#########',
        ],
        legend: { L: 'parties_panel_u', l: 'parties_panel', p: 'parties_wall', K: 'counter_white', D: 'counter_white', S: 'sofa_blue', t: 'table_low', e: 'elevator', d: 'door_wood', '[': 'floor_carpet_gray', ']': 'floor_carpet_gray' },
        warps: [
          ...exitWarps(hq, [9, 10], 10),
          // the press room belongs to the party (a tenant / the vacant floor keeps it locked)
          { x: 18, y: 2, room: 'press', tx: 8, ty: 8, dir: 'up', check: async (g) => { G = g; if (partyOf(hq, g)) return true; await g.say(H.mine ? '（奥の会議室は、がらんとしている。\n　党ができたら、ここが記者会見室になりそうだ）' : '（奥は、テナントの会社の会議室だ。\n　関係者以外は入れない）'); return false; } },
        ],
        entities: [
          partyBoard(hq, 7, 1, 6, 2, 'board'),
          poster(hq, 3, 2), poster(hq, 14, 2),
          staffNpc(`${hq}_recep`, STAFF.recep, 9, 3, 'down', { cond: open, talk: posted('down', (g, e) => recepTalk(g, e, hq)) }),
          staffNpc(`${hq}_donate`, STAFF.donate, 14, 4, 'up', { cond: open, talk: posted('up', (g, e) => donateTalk(g, e, hq)) }),
          staffNpc(`${hq}_guard`, STAFF.guard, 12, 8, 'down', { cond: open, text: ['こんにちは。', '党本部には、陳情や取材の人が毎日たくさん来ます。\n不審なものを見かけたら、知らせてくださいね。'] }),
          staffNpc(`${hq}_staff`, STAFF.staff2, 5, 7, 'right', {
            cond: open, wander: 2,
            talk: async (g) => { G = g; const pt = partyOf(hq, g); await g.say([`${pt ? pt.name : '党'}の職員です。`, '選挙が近づくと、本部は夜までにぎやかになります。\nポスターの発送、電話、ボランティアの受付…'], who(STAFF.staff2)); },
          }),
          // another tenant (民主党がない時代) / the vacant office (自分の党ができる前)
          staffNpc(`${hq}_tenant`, STAFF.tenant, 9, 3, 'down', { cond: tenant, talk: posted('down', (g, e) => recepTalk(g, e, hq)) }),
          staffNpc(`${hq}_agent`, STAFF.agent, 9, 5, 'down', { cond: vacant, talk: agentTalk }),
          { type: 'prop', x: 4, y: 6, w: 1, h: 1, cond: vacant, draw: boxesDraw, text: '引っ越しの段ボールが積んである。' },
          { type: 'prop', x: 15, y: 7, w: 1, h: 1, cond: vacant, draw: boxesDraw, text: '前のテナントが残していった段ボールだ。' },
        ],
        // 政治ナビ (js/engine/assist.js): a first-visit tip, shown once the player is free
        onEnter: (g) => { G = g; if (typeof g.assistTip === 'function' && (hq === 'myparty_hq' || partyOf(hq, g))) g.assistTip(hq === 'myparty_hq' ? 'myparty_hq' : 'party_hq'); },
        events: [
          { x: 16, y: 2, on: 'step', run: elevatorFor(hq) },
          {
            x: 9, y: 9, w: 2, on: 'step', cond: (g) => !g.flag(`parties_welcome_${hq}`) && !!partyOf(hq, g),
            run: async (g) => { G = g; g.setFlag(`parties_welcome_${hq}`, true); const pt = partyOf(hq, g); await g.say(pt && pt.real ? `（${pt.name}の本部だ。受付の奥に、党のロゴが掲げられている）` : `（${pt ? pt.name : '党'}の本部だ。受付の奥に、党のマークが掲げられている）`); },
          },
        ],
      },
      // ---------------------------------------------------------- 1階 記者会見室
      press: {
        floor: 'parties_carpet',
        tiles: [
          '##################',
          '#UUUUBBBBBBBBUUUU#',
          '#====bbbbbbbb====#',
          '#................#',
          '#........p.......#',
          '#................#',
          '#.ccc.ccc.ccc.KK.#',
          '#................#',
          '#.ccc......ccc...#',
          '########dd########',
        ],
        legend: { B: 'parties_panel_u', b: 'parties_panel', p: 'parties_podium', c: 'parties_chair', K: 'camera', d: 'stairs_up' },
        warps: backPress(hq, [8, 9], 9),
        entities: [
          partyBoard(hq, 5, 1, 8, 2, 'backdrop'),
          staffNpc(`${hq}_pk1`, STAFF.kisha, 2, 5, 'up', { cond: open, text: ['党の会見は、党首の言葉がそのまま見出しになる。', '…ひと言の重みが、ちがうのよ。'] }),
          staffNpc(`${hq}_pk2`, STAFF.kisha2, 11, 6, 'up', { cond: open, text: ['選挙が近いと、会見の数も増えるんだ。', '公認の発表、公約の発表、連立の話…\nネタには事欠かないね。'] }),
          { type: 'sign', x: 9, y: 4, talk: (g) => podiumTalk(g, hq) },
        ],
      },
      // ---------------------------------------------------------- 2階 選挙対策本部
      sentai: {
        floor: 'parties_carpet',
        tiles: [
          '####################',
          '#UUMMMUURRRRRRUUUUU#',
          '#==mmm==rrrrrr==D==#',
          '#..................#',
          '#.hhh..hhh..hhh....#',
          '#..................#',
          '#.hhh..hhh..hhh....#',
          '#..................#',
          '#P................P#',
          '#########ee#########',
        ],
        legend: { M: 'parties_map_u', m: 'parties_map', R: 'parties_rose_u', r: 'parties_rose', D: 'parties_daruma', h: 'parties_phonedesk', e: 'elevator' },
        warps: backTo(hq, [9, 10], 9),
        entities: [
          offNpc(`${hq}_sentai`, OF.sentai, 17, 3, 'down', sentaiTalk),
          staffNpc(`${hq}_sentai_stand`, STAFF.staff, 17, 3, 'down', { cond: (g) => open(g) && !OF.sentai.present(g), talk: posted('down', (g, e) => sentaiTalk(g, { name: '選挙対策本部の職員', look: STAFF.staff.look }, hq)) }),
          staffNpc(`${hq}_vol1`, STAFF.volunteer, 3, 5, 'up', { cond: open, text: ['電話作戦のボランティアです。', '「〇〇候補をよろしくお願いします」…\n一日に何百本もかけるんですよ。'] }),
          staffNpc(`${hq}_vol2`, STAFF.staff2, 13, 7, 'up', { cond: open, text: ['あの名札のバラ、見えます？', '選挙の夜、当選が決まった候補者の名前に\nひとつずつ、バラの花をつけていくんです。'] }),
          { type: 'sign', x: 16, y: 2, text: ['必勝だるまだ。', '必勝を願って片目を入れ、\n当選したら、もう片方の目を入れるのが習わしだ。'] },
          { type: 'sign', x: 10, y: 2, text: ['候補者の名札が並んだボードだ。', '当選した人の名前には、赤いバラがついている。'] },
          { type: 'sign', x: 4, y: 2, text: ['選挙区の地図だ。', '赤いピンは、重点区。\n候補者の街頭演説の予定が、びっしり書きこまれている。'] },
          ...[[2, 4], [7, 4], [12, 4], [2, 6], [7, 6], [12, 6]].map(([x, y]) => ({ type: 'sign', x, y, talk: phoneBank })),
        ],
      },
      // ---------------------------------------------------------- 3階 政務（政策）調査会
      seicho: {
        floor: 'parties_carpet',
        tiles: [
          '####################',
          '#UUUUUUUUUUUUUUUUUU#',
          '#=========c========#',
          '#bbbb..........bbbb#',
          '#..................#',
          '#....TTxTTTTxTT....#',
          '#....TTTxTTxTTT....#',
          '#..................#',
          '#P................P#',
          '#########ee#########',
        ],
        legend: { c: 'parties_wall+clock', b: 'bookshelf', T: 'parties_table', x: 'parties_docs', e: 'elevator' },
        warps: backTo(hq, [9, 10], 9),
        entities: [
          offNpc(`${hq}_seicho`, OF.seichokai, 9, 4, 'down', seichoTalk),
          staffNpc(`${hq}_seicho_stand`, STAFF.staff, 9, 4, 'down', { cond: (g) => open(g) && !OF.seichokai.present(g), talk: posted('down', (g, e) => seichoTalk(g, { name: '政策担当の職員', look: STAFF.staff.look }, hq)) }),
          staffNpc(`${hq}_seicho_st`, STAFF.staff2, 3, 7, 'up', { cond: open, text: ['部会では、分野ごとに議員が集まって\n法案や予算の要望を議論します。', '国会に出る前に、党の中でしっかり揉むんです。'] }),
          { type: 'sign', x: 7, y: 5, text: ['政策の資料が山積みだ。', '「〇〇法案 修正案（たたき台）」…\n付せんだらけになっている。'] },
        ],
      },
      // ---------------------------------------------------------- 4階 幹部室（自分の党は 党首室）
      kanbu: {
        floor: 'floor_carpet_beige',
        tiles: [
          '##################',
          '#UUUUWWWWWWWWUUUU#',
          '#====wwwwwwww====#',
          '#bb............bb#',
          '#................#',
          '#................#',
          '#..SSS......SSS..#',
          '#..ttt......ttt..#',
          '#P..............P#',
          '########ee########',
        ],
        legend: { W: 'parties_wall_u+window', w: 'parties_wall+window', b: 'bookshelf', S: 'sofa_beige', t: 'table_low', e: 'elevator' },
        warps: backTo(hq, [8, 9], 9),
        entities: [
          { type: 'prop', x: 6, y: 4, w: 5, h: 1, draw: deskDraw, talk: (g) => leaderDesk(g, hq) },
          offNpc(`${hq}_leader`, OF.leader, 8, 3, 'down', kanbuTalk, { cond: nonLeader }),
          offNpc(`${hq}_kanjicho`, OF.kanjicho, 13, 4, 'left', kanbuTalk, { cond: nonLeader }),
          staffNpc(`${hq}_jimu`, STAFF.secretary, 13, 4, 'left', {
            cond: (g) => { G = g; const pt = partyOf(hq, g); return !!pt && isLeader(g, pt); },
            talk: posted('left', async (g) => { const pt = partyOf(hq, g); await g.say([`${leaderTitle(pt)}、お疲れさまです。${pt ? pt.name : '党'}の事務局長です。`, '党の運営は、机のメニューからどうぞ。\n議員の勧誘、役員の任命、公約、連立…なんでも。'], who(STAFF.secretary)); }),
          }),
          { type: 'sign', x: 6, y: 2, text: ['窓の外に、国会議事堂の塔が見える。'] },
        ],
      },
    },
  };
}
const deskBaked = new Map();
function deskDraw(ctx, sx, sy) {
  let cv = deskBaked.get('d');
  if (!cv) {
    const [c2, c] = makeCanvas(160, 44);
    R(c, 4, 38, 152, 6, 'rgba(0,0,0,0.2)');
    R(c, 0, 8, 160, 30, WOODD); R(c, 0, 8, 160, 6, WOOD); R(c, 0, 8, 160, 2, WOODL);
    R(c, 20, 2, 22, 8, '#ffffff'); R(c, 22, 4, 18, 1, '#8a8f99');
    R(c, 120, 0, 18, 10, '#20232a'); R(c, 122, 2, 14, 6, '#2a4a7a');
    outline(c, { tint: 0.25 });
    cv = c2; deskBaked.set('d', cv);
  }
  ctx.drawImage(cv, sx, sy - 6, 80, 22);
}
function boxesDraw(ctx, sx, sy) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(sx + 2, sy + 14, 12, 2);
  box(ctx, sx + 2, sy + 6, 7, 8, '#c8965a'); box(ctx, sx + 2, sy + 6, 7, 1, '#e0b07a'); box(ctx, sx + 5, sy + 6, 1, 8, '#a87a48');
  box(ctx, sx + 8, sy + 8, 6, 6, '#b88a50'); box(ctx, sx + 8, sy + 8, 6, 1, '#d8a870');
  box(ctx, sx + 4, sy + 1, 6, 5, '#d0a068'); box(ctx, sx + 4, sy + 1, 6, 1, '#e8c088');
}

for (const hq of Object.keys(HQS)) registerPlace(buildHQ(hq));

