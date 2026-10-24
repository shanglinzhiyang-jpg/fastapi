// 首相官邸 ('kantei'): the Prime Minister's office building in 永田町 (nagatacho.js).
//
//   hall    3階 正面玄関ホール  受付・警備のゲート・竹の庭の見えるガラス・赤じゅうたんの階段（組閣の記念撮影）・
//                              官邸の記者・表敬訪問（★2000 のタレント）・エレベーター
//   press   1階 記者会見室      青い幕と国旗・演台・記者席・テレビカメラ。総理・閣僚は記者会見（支持に影響）
//   kakugi  4階 閣僚応接室・閣議室  閣議の日（火・金）は閣僚が並ぶ。閣僚は閣議に出る、総理は閣議で
//                              法案の閣議決定・衆議院の解散・内閣改造・総辞職を決める
//   office  5階 総理執務室      総理か閣僚だけ（ほかの人はていねいに断られる）。総理は政務のメニュー
//   crisis  地下 危機管理センター  閣僚だけ。地震・台風・経済危機の間は危機対応（politics の SHOCKS）
//
// Calls only the politics API (g.pol / g.activity / g.proposeBill / g.dissolve / g.reshuffle /
// g.resignPM / g.politicsMenu / g.policyPreview ...). Every minister, secretary, reporter and
// guard is fictional (the ministers are the politics core's generated NPCs).
// Facts (checked 2026-10): 新官邸は2002年4月から（旧官邸 1929年竣工、2005年から公邸）。
//   正面玄関は3階（斜面に建つため）、1階に記者会見室、4階に閣議室、5階に総理執務室、地下に危機管理センター。
//   定例閣議は原則 火曜・金曜（ふだん午前10時、国会の会期中は午前9時）、閣議の前に閣僚は閣僚応接室に集まる。
//   閣議決定は、閣僚が閣議書に署名（花押）し、最後に総理大臣が署名して正式になる。
//   組閣の日は、初閣議のあと官邸の階段で記念撮影をするのが慣例。官房長官の定例記者会見は平日の午前と午後。
//   内閣危機管理監は1998年4月1日に設置。2002年より前（旧官邸）の場面では、階の説明や会見の回数は言わない。
// flags (prefix kantei_): kantei_guest (day of the courtesy call invitation), kantei_visit (day
//   of the last 表敬訪問), kantei_photo_<formed>, kantei_kakugi (day), kantei_press (day),
//   kantei_crisis_<key>, kantei_brief (day), kantei_hall_hello, kantei_mood_day (day the cabinet's
//   mood last moved with a press conference).

import { registerPlace, doorIndexFor } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { defineTile, R, P, disc, outline, speckle, shadowEllipse } from '../engine/tiles.js';
import { text } from '../engine/draw.js';
import { makeCanvas, clamp } from '../engine/util.js';
import { cabinetPosts, postName, POLICIES, POLICY_ORDER, POLICY_AREAS, AREA_ORDER, SHOCKS, fmtCho, onPolitics } from '../engine/politics.js';

const PID = 'kantei';
const T = (k) => `${PID}_${k}`;
let G = null;
const game = () => G || (typeof window !== 'undefined' ? window.__game : null) || null;

// ------------------------------------------------------------------ palette
const WALL = '#efe9dc', WALL2 = '#e2dac8', WOOD = '#9a6e44', WOODD = '#6e4a2c', WOODL = '#c49a6a';
const STONE = '#ddd8cc', INK = '#22202a', RED = '#a8242c', REDD = '#7a1a20', REDL = '#c83a3a';
const NAVY = '#24345a', BLUE = '#3a5a9a', BLUEL = '#5a7ab8', GOLD = '#c8a24a';

// ------------------------------------------------------------------ tiles (all native HD)
function tile(k, def) {
  const hd = def.hd;
  defineTile(T(k), {
    ...def,
    draw: def.draw || ((c, r, f, v) => {
      const [cv, cc] = makeCanvas(32, 32);
      hd(cc, r, f, v);
      c.imageSmoothingEnabled = false;
      c.drawImage(cv, 0, 0, 16, 16);
    }),
  });
}
tile('walltop', { solid: true, hd(c) { R(c, 0, 0, 32, 32, '#2a2a30'); R(c, 0, 30, 32, 2, '#3a3a42'); } });
// washi-like panels in a light wood frame (upper course)
tile('wall_u', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, WALL);
    R(c, 0, 0, 32, 2, WOODD); R(c, 0, 2, 32, 1, WOODL);
    for (const x of [0, 16]) { R(c, x, 3, 1, 29, WOOD); R(c, x + 1, 3, 1, 29, WOODL); }
    for (const y of [12, 22]) R(c, 0, y, 32, 1, WALL2);
  },
});
tile('wall', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, WALL);
    for (const x of [0, 16]) { R(c, x, 0, 1, 18, WOOD); R(c, x + 1, 0, 1, 18, WOODL); }
    R(c, 0, 8, 32, 1, WALL2);
    R(c, 0, 18, 32, 14, WOOD); R(c, 0, 18, 32, 1, WOODL); R(c, 0, 19, 32, 1, '#b48658');
    for (let x = 0; x < 32; x += 4) R(c, x, 20, 1, 10, WOODD);
    R(c, 0, 30, 32, 2, '#4a3220');
  },
});
// pale stone floor with a wide grid
tile('floor', {
  variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, STONE);
    speckle(c, r, ['#d4cfc2', '#e6e2d8', '#cfc9bb'], 50);
    R(c, 0, 0, 32, 1, '#c4beb0'); R(c, 0, 0, 1, 32, '#c4beb0'); R(c, 1, 1, 31, 1, '#ece8e0');
    if (v === 1) { R(c, 20, 6, 6, 1, '#ece8e0'); }
  },
});
// raised access floor (危機管理センター)
tile('raised', {
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#5a6070');
    for (const [x, y] of [[0, 0], [16, 0], [0, 16], [16, 16]]) { R(c, x + 1, y + 1, 14, 14, '#6a7080'); R(c, x + 1, y + 1, 14, 1, '#7a8090'); R(c, x + 1, y + 14, 14, 1, '#4a5060'); }
    speckle(c, r, ['#646a7a', '#70768a'], 18);
  },
});
// glass with the bamboo garden behind (upper / lower)
function bambooGlass(lower) {
  return (c, r) => {
    R(c, 0, 0, 32, 32, '#cfe6d8');
    for (let y = 0; y < 32; y++) if (y % 3 === 0) R(c, 0, y, 32, 1, '#c2dccc');
    const stalks = [3, 10, 15, 22, 27];
    for (const x of stalks) {
      R(c, x, 0, 3, 32, '#6fae4a'); R(c, x, 0, 1, 32, '#9ad06a'); R(c, x + 2, 0, 1, 32, '#4a8a34');
      for (let y = (x * 3) % 7; y < 32; y += 9) R(c, x - 1, y, 5, 1, '#3f7a2a');
    }
    for (let i = 0; i < 16; i++) { const x = Math.floor(r() * 30), y = Math.floor(r() * (lower ? 12 : 30)); R(c, x, y, 3, 1, i % 2 ? '#5fa040' : '#8cc860'); }
    if (lower) { R(c, 0, 24, 32, 8, '#b8b0a0'); R(c, 0, 24, 32, 1, '#e0dad0'); for (let x = 2; x < 32; x += 6) R(c, x, 27, 3, 2, '#c8c0b0'); }
    R(c, 0, 0, 32, 1, '#8a9aa0'); R(c, 15, 0, 2, 32, '#a8b4b8'); R(c, 15, 0, 1, 32, '#d8e4e8');
    for (let k = 0; k < 5; k++) P(c, 5 + k * 2, 4 + k * 3, '#ffffff');
  };
}
tile('bamboo_u', { solid: true, hd: bambooGlass(false) });
tile('bamboo', { solid: true, hd: bambooGlass(true) });
// window with the city view (the Diet's tower in the distance)
function cityGlass(lower) {
  return (c) => {
    R(c, 0, 0, 32, 32, '#9cc8e8');
    if (!lower) {
      R(c, 0, 0, 32, 10, '#b8dcf4');
      R(c, 2, 14, 30, 18, '#c8cdd6'); for (let x = 4; x < 32; x += 6) R(c, x, 16, 3, 3, '#8a9ab0');
    } else {
      R(c, 0, 0, 32, 20, '#c8cdd6'); for (let x = 2; x < 32; x += 5) for (let y = 2; y < 18; y += 5) R(c, x, y, 2, 2, '#8a9ab0');
      R(c, 0, 20, 32, 12, WOOD); R(c, 0, 20, 32, 1, WOODL); R(c, 0, 22, 32, 1, WOODD);
    }
    R(c, 0, 0, 32, 1, '#5a6070'); R(c, 0, 0, 1, 32, '#d8e4ee'); R(c, 31, 0, 1, 32, '#5a6070');
  };
}
tile('city_u', { solid: true, hd: cityGlass(false) });
tile('city', { solid: true, hd: cityGlass(true) });
// red-carpet stairs (the cabinet photo staircase)
tile('redstairs', {
  hd(c) {
    for (let k = 0; k < 4; k++) {
      const y = k * 8;
      R(c, 0, y, 32, 8, '#d8d2c4'); R(c, 0, y, 32, 2, '#eeeae0'); R(c, 0, y + 6, 32, 2, '#aaa496');
      R(c, 5, y, 22, 7, RED); R(c, 5, y, 22, 2, REDL); R(c, 5, y + 6, 22, 1, REDD);
      R(c, 5, y + 7, 22, 1, GOLD);
    }
  },
});
tile('redcarpet', {
  hd(c, r) {
    R(c, 0, 0, 32, 32, RED);
    speckle(c, r, [REDD, REDL, '#b02a30'], 60);
    R(c, 3, 0, 1, 32, GOLD); R(c, 28, 0, 1, 32, GOLD);
  },
});
// security gate (walk-through frame)
tile('gate', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 30, 13, 2);
    R(c, 4, 4, 4, 26, '#b8bec8'); R(c, 24, 4, 4, 26, '#b8bec8'); R(c, 4, 2, 24, 4, '#9aa2ae');
    R(c, 4, 4, 1, 26, '#e0e4ea'); R(c, 24, 4, 1, 26, '#e0e4ea');
    R(c, 6, 3, 3, 2, '#5fd77a');
    outline(c);
  },
});
// blue curtain backdrop (press room)
function curtain(lower) {
  return (c) => {
    R(c, 0, 0, 32, 32, BLUE);
    for (let x = 0; x < 32; x += 4) { R(c, x, 0, 1, 32, NAVY); R(c, x + 2, 0, 1, 32, BLUEL); }
    if (!lower) { R(c, 0, 0, 32, 3, '#1a2440'); R(c, 0, 3, 32, 1, GOLD); }
    else { R(c, 0, 28, 32, 4, '#1a2440'); }
  };
}
tile('curtain_u', { solid: true, hd: curtain(false) });
tile('curtain', { solid: true, hd: curtain(true) });
// podium with a gold emblem
tile('podium', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 30, 11, 2);
    R(c, 7, 10, 18, 20, WOOD); R(c, 7, 10, 2, 20, WOODL); R(c, 23, 10, 2, 20, WOODD);
    R(c, 5, 7, 22, 4, '#7a5432'); R(c, 5, 7, 22, 1, WOODL);
    disc(c, 16, 18, 4, GOLD); disc(c, 16, 18, 2.5, '#e8c870'); R(c, 15, 15, 2, 6, '#a88028');
    R(c, 18, 2, 1, 6, '#3b3f48'); R(c, 17, 1, 3, 2, INK);
    outline(c);
  },
});
// national flag on a floor stand
tile('flagstand', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 30, 7, 2);
    R(c, 12, 27, 8, 3, '#8a8f99'); R(c, 15, 2, 2, 26, GOLD); R(c, 15, 1, 2, 1, '#f0d890');
    R(c, 17, 3, 12, 15, '#ffffff'); R(c, 17, 16, 12, 2, '#e4e6ea');
    for (let y = 3; y < 18; y += 4) R(c, 27, y, 2, 2, '#eef0f4');
    disc(c, 23, 10, 3.2, '#d4202c');
    outline(c, { tint: 0.3 });
  },
});
// press-room chair
tile('chair', {
  solid: true, obj: true,
  hd(c) {
    R(c, 7, 26, 18, 2, 'rgba(0,0,0,0.2)');
    R(c, 8, 8, 16, 10, '#3a4a6a'); R(c, 8, 8, 16, 1, '#5a6a8a');
    R(c, 7, 17, 18, 5, '#4a5a7a'); R(c, 7, 17, 18, 1, '#6a7a9a');
    R(c, 8, 22, 2, 6, '#8a8f99'); R(c, 22, 22, 2, 6, '#8a8f99');
    outline(c);
  },
});
// console with two monitors (危機管理センター)
tile('console', {
  solid: true, obj: true, frames: 2, speed: 40,
  hd(c, r, f) {
    R(c, 1, 27, 30, 3, 'rgba(0,0,0,0.25)');
    R(c, 1, 16, 30, 11, '#4a505c'); R(c, 1, 16, 30, 2, '#6a7080'); R(c, 1, 26, 30, 1, '#2a2e36');
    for (const x of [3, 17]) {
      R(c, x, 3, 12, 11, '#20232a'); R(c, x + 1, 4, 10, 8, f && x === 3 ? '#2f6f5a' : '#2a4a7a');
      R(c, x + 2, 5, 6, 1, '#8fd0ff'); R(c, x + 2, 7, 4, 1, '#5fd77a'); R(c, x + 2, 9, 7, 1, f && x === 17 ? '#ffd23f' : '#8fd0ff');
      R(c, x + 5, 14, 2, 2, '#3b3f48');
    }
    R(c, 6, 19, 12, 3, '#2a2e36'); R(c, 20, 19, 6, 3, '#d8dce4');
    outline(c);
  },
});
// the big monitor wall (upper / lower), animated
function screens(lower) {
  return (c, r, f) => {
    R(c, 0, 0, 32, 32, '#1a1d24');
    const cell = (x, y, w, h, k) => {
      R(c, x, y, w, h, '#0f1830');
      if (k === 0) { R(c, x + 2, y + 2, w - 4, h - 4, '#1f4a6a'); for (let i = 0; i < 5; i++) R(c, x + 3 + ((i * 5 + f * 3) % (w - 6)), y + 3 + (i * 3) % (h - 6), 2, 2, '#5fd77a'); }
      if (k === 1) { for (let i = 0; i < w - 4; i += 2) { const hh = 2 + ((i * 7 + f * 5) % (h - 6)); R(c, x + 2 + i, y + h - 2 - hh, 1, hh, '#ffd23f'); } }
      if (k === 2) { R(c, x + 2, y + 2, w - 4, h - 4, '#3a2a2a'); R(c, x + 3, y + 3, w - 6, 2, f % 2 ? '#ff5d6c' : '#ffd23f'); R(c, x + 3, y + 7, w - 8, 1, '#ffffff'); }
      if (k === 3) { R(c, x + 2, y + 2, w - 4, h - 4, '#2a3a5a'); disc(c, x + w / 2, y + h / 2, 3, '#8fd0ff'); }
    };
    if (!lower) { cell(1, 2, 14, 13, f % 4); cell(17, 2, 14, 13, (f + 1) % 4); cell(1, 17, 14, 13, (f + 2) % 4); cell(17, 17, 14, 13, (f + 3) % 4); }
    else { cell(1, 1, 14, 12, (f + 1) % 4); cell(17, 1, 14, 12, f % 4); R(c, 0, 16, 32, 16, '#3a3f4a'); R(c, 0, 16, 32, 1, '#5a6070'); R(c, 0, 30, 32, 2, '#20232a'); }
  };
}
tile('screen_u', { solid: true, frames: 4, speed: 30, hd: screens(false) });
tile('screen', { solid: true, frames: 4, speed: 30, hd: screens(true) });

// a long meeting table (tiles join up left-right)
tile('table', {
  solid: true, obj: true, variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 26, 32, 3, 'rgba(0,0,0,0.18)');
    R(c, 0, 6, 32, 18, '#e8e6e0'); R(c, 0, 6, 32, 2, '#ffffff'); R(c, 0, 22, 32, 2, '#a8a49a'); R(c, 0, 24, 32, 2, '#7a766c');
    if (v === 0) { R(c, 6, 9, 9, 7, '#f8f8f4'); R(c, 7, 11, 7, 1, '#8a8f99'); R(c, 7, 13, 5, 1, '#8a8f99'); }
    if (v === 1) { R(c, 18, 10, 8, 6, '#d8e4f0'); R(c, 18, 10, 8, 1, '#5a6a8a'); disc(c, 22, 13, 1.2, '#d42a3a'); }
    if (v === 2) { R(c, 10, 9, 3, 6, '#3a5a9a'); R(c, 20, 10, 6, 4, '#20232a'); }
  },
});

// ------------------------------------------------------------------ props
const box = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
const baked = new Map();
function bake(key, w, h, paint) {
  let cv = baked.get(key);
  if (!cv) { const [c2, c] = makeCanvas(w * 2, h * 2); try { paint(c); } catch (e) { console.error(e); } cv = c2; baked.set(key, cv); }
  return cv;
}
const blit = (ctx, cv, x, y) => ctx.drawImage(cv, x, y, cv.width / 2, cv.height / 2);
// 閣議室の円卓 (6x3 tiles): an oval wooden ring with the papers of the day
function paintRoundTable(c) {
  const W = 192, H = 96;
  for (let y = 0; y < 14; y++) { const t = (y - 7) / 7; const half = (W / 2 - 8) * Math.sqrt(Math.max(0, 1 - t * t)); R(c, Math.round(W / 2 - half), 74 + y, Math.round(half * 2), 1, 'rgba(0,0,0,0.16)'); }
  for (let y = 0; y < 76; y++) {
    const t = (y - 38) / 38;
    const half = (W / 2 - 6) * Math.sqrt(Math.max(0, 1 - t * t));
    R(c, Math.round(W / 2 - half), y + 4, Math.round(half * 2), 1, y < 6 ? WOODL : y > 68 ? WOODD : WOOD);
  }
  for (let y = 0; y < 50; y++) {
    const t = (y - 25) / 25;
    const half = (W / 2 - 40) * Math.sqrt(Math.max(0, 1 - t * t));
    R(c, Math.round(W / 2 - half), y + 17, Math.round(half * 2), 1, '#c8b890');
  }
  for (const [x, y] of [[50, 10], [80, 8], [112, 8], [140, 12], [36, 40], [150, 40], [60, 64], [128, 64]]) { R(c, x, y, 10, 7, '#ffffff'); R(c, x, y, 10, 1, '#c8ccd4'); R(c, x + 2, y + 3, 6, 1, '#8a8f99'); }
  outline(c, { tint: 0.25 });
}
function roundTable(x, y, talk) {
  return { type: 'prop', x, y, w: 6, h: 3, talk, draw(ctx, sx, sy) { blit(ctx, bake('roundtable', 96, 48, paintRoundTable), sx, sy); } };
}
// 総理の机 (5x1 tiles) with a leather chair behind it
// desk (5x1 tiles) drawn low enough that the person standing behind it shows above it
function paintDesk(c) {
  R(c, 4, 38, 152, 6, 'rgba(0,0,0,0.2)');
  R(c, 0, 8, 160, 30, WOODD); R(c, 0, 8, 160, 6, WOOD); R(c, 0, 8, 160, 2, WOODL);
  R(c, 4, 16, 40, 20, '#5a3a22'); R(c, 116, 16, 40, 20, '#5a3a22');
  for (const x of [8, 120]) for (let y = 20; y < 34; y += 7) R(c, x, y, 32, 1, '#3a2614');
  R(c, 20, 2, 22, 8, '#ffffff'); R(c, 22, 4, 18, 1, '#8a8f99'); R(c, 22, 6, 12, 1, '#8a8f99');
  R(c, 120, 0, 18, 10, '#20232a'); R(c, 122, 2, 14, 6, '#2a4a7a');
  R(c, 90, 3, 8, 7, '#d8dce4'); R(c, 92, 5, 4, 1, '#20232a');
  outline(c, { tint: 0.25 });
}
function pmDesk(x, y, talk) {
  return { type: 'prop', x, y, w: 5, h: 1, talk, draw(ctx, sx, sy) { blit(ctx, bake('pmdesk', 80, 22, paintDesk), sx, sy - 6); } };
}
// name plates on the wall
// label: a string or (g) => string (e.g. by era)
function plate(x, y, label, w = 3) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy, g) {
      const tw = w * 16 - 6;
      const t = typeof label === 'function' ? label(g || game()) : label;
      box(ctx, sx + 3, sy + 4, tw, 10, '#3a2a1a');
      box(ctx, sx + 3.5, sy + 4.5, tw - 1, 9, '#f4ead4');
      text(ctx, t, sx + 3 + tw / 2, sy + 5, { size: 7, align: 'center', color: '#3a2a1a', shadow: null });
    },
  };
}

// ------------------------------------------------------------------ politics helpers
function pol(g) {
  if (!g || !g.state || typeof g.pol !== 'function') return null;
  try { return g.pol(); } catch (e) { console.error(e); return null; }
}
const fyOf = (g) => { try { return g.polDate().fy; } catch (e) { return 2026.3; } };
const yearOf = (g) => { try { return g.polDate().year; } catch (e) { return 2026; } };
const isPM = (g) => { const p = pol(g); return !!(p && p.cabinet.pm === 'player'); };
const isMinister = (g) => { const p = pol(g); return !!(p && (p.cabinet.pm === 'player' || Object.values(p.cabinet.ministers || {}).includes('player'))); };
const myCabinetPost = (g) => { const p = pol(g); if (!p) return null; if (p.cabinet.pm === 'player') return 'pm'; return Object.keys(p.cabinet.ministers || {}).find((k) => p.cabinet.ministers[k] === 'player') || null; };
const isPolitician = (g) => { const p = pol(g); return !!(p && (p.me.office || (p.me.posts && p.me.posts.length))); };
const postLabel = (g, post) => { try { return post === 'pm' ? '内閣総理大臣' : postName(post, fyOf(g)); } catch (e) { return post; } };
const pmName = (g) => { const p = pol(g); if (!p) return ''; return p.cabinet.pm === 'player' ? g.state.name : String(g.npcName(p.cabinet.pm) || '').replace(/\s+/g, ''); };
const pmSurname = (g) => { const p = pol(g); if (!p) return ''; return p.cabinet.pm === 'player' ? g.state.name : String(g.npcName(p.cabinet.pm) || '').split(' ')[0]; };
const kakugiDay = (g) => [1, 4].includes(g.weekday); // 火・金
// The cabinet in seating order (post, who = npc id | 'player').
function cabinetList(g) {
  const p = pol(g);
  if (!p) return [];
  let posts = [];
  try { posts = cabinetPosts(fyOf(g), p.flags || {}); } catch (e) { posts = []; }
  return posts.map((post) => ({ post, who: p.cabinet.ministers[post] })).filter((m) => m.who);
}
function npcOf(g, id) { const p = pol(g); return p && p.npcs ? p.npcs[id] : null; }
// Small, guarded nudges of the cabinet's mood (approval drifts toward it every week) and of
// the player's reputation. The politics core clamps both.
function nudge(g, { mood = 0, rep = 0 } = {}) {
  const p = pol(g);
  if (!p) return;
  if (mood && p.cabinet && typeof p.cabinet.mood === 'number') p.cabinet.mood = clamp(p.cabinet.mood + mood, -20, 20);
  if (rep && p.me && typeof p.me.reputation === 'number') p.me.reputation = clamp(p.me.reputation + rep, -100, 100);
}
// Shocks that are not crises (a stock boom needs no 危機管理センター).
const NOT_CRISIS = new Set(['boom']);
// Crisis names as nouns (「〜について」「〜への対応」)
const CRISIS_NAMES = { quake: '大地震', storm: '台風・豪雨の被害', recession: '世界的な景気後退', boom: '株価の急上昇', yen_high: '急激な円高', yen_low: '急激な円安', energy: '資源価格の高騰' };
const shortTitle = (s) => { const t = String(s || '').replace(/（[^）]*）/g, '').trim(); return Array.from(t).length > 14 ? Array.from(t).slice(0, 13).join('') + '…' : t; };
// The crisis of the moment: an active shock (disasters first) -> { key, name, disaster, kind } | null
export function activeCrisis(g) {
  const p = pol(g);
  if (!p || !p.economy || !Array.isArray(p.economy.shocks)) return null;
  const abs = g.state.day - 1 + (((p.cal && p.cal.month) || 4) - 1) * 10;
  const live = p.economy.shocks.filter((s) => s && SHOCKS[s.kind] && !NOT_CRISIS.has(s.kind) && abs < s.until && abs >= s.until - s.len && abs - (s.until - s.len) <= 30);
  live.sort((a, b) => (SHOCKS[b.kind].disaster ? 1 : 0) - (SHOCKS[a.kind].disaster ? 1 : 0) || b.until - a.until);
  const s = live[0];
  return s ? { key: `${s.kind}_${s.until}`, name: CRISIS_NAMES[s.kind] || String(s.name || SHOCKS[s.kind].name).replace(/が発生$/, ''), disaster: !!SHOCKS[s.kind].disaster, kind: s.kind } : null;
}

// The effect part of an activity result ('委員会で質問をした。評判 +2・…' -> '（評判 +2・…）').
const effects = (r) => { const [first, ...rest] = String((r && r.text) || '').split('\n'); const t = first.replace(/^[^。]*をした。/, '').trim(); return (t ? `（${t}）` : '') + (rest.length ? `\n${rest.join('\n')}` : ''); };
// ------------------------------------------------------------------ people
const WHO = {
  recep: { name: '官邸の受付', look: { ...LOOKS.receptionist, top: '#3a4a6a', bottom: '#2a2d36' } },
  guard: { name: '警備の警察官', look: { hair: 'cap', hat: '#1f2a4a', hairColor: 'black', skin: 'fair', top: '#2a3560', bottom: '#1f2a4a', tie: '#20232a' } },
  sp: { name: 'SP', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#22252e', bottom: '#22252e', jacket: true, tie: '#5a1f2a' } },
  staff: { name: '官邸の職員', look: { ...LOOKS.salaryman, top: '#3a3f4a', tie: '#3a5a9a', glasses: true } },
  kisha1: { name: '内閣記者会の記者', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#e8e6e0', bottom: '#3a3f55', jacket: true } },
  kisha2: { name: '新聞社の記者', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#5a6f8a', bottom: '#2a2d36', jacket: true, glasses: true } },
  kisha3: { name: 'テレビ局の記者', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#f2f2f2', bottom: '#2a3560', jacket: true } },
  camera: { name: 'カメラマン', look: LOOKS.cameraman },
  koho: { name: '官邸の広報担当', look: { ...LOOKS.salaryman, top: '#2f3442', tie: '#8a3a2a' } },
  partyKoho: { name: '党の広報担当', look: { ...LOOKS.salaryman, top: '#3a3f4a', tie: '#5a6a8a' } },
  hisho: { name: '総理秘書官', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2a2d3a', bottom: '#2a2d3a', jacket: true, tie: '#3a6fd8', glasses: true } },
  fuku: { name: '内閣官房の職員', look: { hair: 'short', hairColor: 'gray', skin: 'fair', top: '#3a3f4a', bottom: '#3a3f4a', jacket: true, tie: '#5a5a2a' } },
  kanshi: { name: '危機管理の担当官', look: { hair: 'short', hairColor: 'silver', skin: 'tan', top: '#2a3040', bottom: '#2a3040', jacket: true, tie: '#7a1a20' } },
  op1: { name: '当番の職員', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#e8eaee', bottom: '#3a3f4a', tie: '#2a3560' } },
  op2: { name: '当番の職員', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#e8eaee', bottom: '#3a3f4a' } },
};
const say = (w) => ({ name: w.name, look: w.look });
const npc = (id, x, y, dir, w, extra = {}) => ({ type: 'npc', id, x, y, dir, look: w.look, name: w.name, ...extra });
const posted = (dir, fn) => async (g, e) => { G = g; await fn(g, e); if (e) e.dir = dir; };
const today = (g, k) => g.flag(k) === g.state.day;

// ------------------------------------------------------------------ access
// The present building (2002-) has the floors below; the old one (1929) is described without them.
const newKantei = (g) => yearOf(g) >= 2002;
const FLOOR = { office: ['5階', '総理執務室'], kakugi: ['4階', '閣議室'], press: ['1階', '記者会見室'], crisis: ['地下', '危機管理センター'] };
const floorLabel = (g, room) => (newKantei(g) ? `${FLOOR[room][0]}　${FLOOR[room][1]}` : room === 'crisis' ? '危機管理の部屋' : FLOOR[room][1]);
const ACCESS = {
  kakugi: { ok: (g) => isMinister(g), no: (g) => [newKantei(g) ? '「4階は閣議室と閣僚応接室です」' : '「この先は閣議室と閣僚応接室です」', '「閣僚のかた以外は、ご案内できないんです。\n　申しわけありません」'] },
  office: { ok: (g) => isMinister(g), no: (g) => [newKantei(g) ? '「5階は総理の執務室です」' : '「この先は総理の執務室です」', '「お約束のないかたは、お通しできません。\n　…ご理解ください」'] },
  crisis: { ok: (g) => isMinister(g), no: (g) => [newKantei(g) ? '「地下は危機管理センターです」' : '「この先は危機管理の部屋です」', '「関係者以外は立入禁止です。\n　ごめんなさいね」'] },
  press: { ok: () => true, no: () => [] },
};
async function allowed(g, room) {
  G = g;
  const A = ACCESS[room];
  if (!A || A.ok(g)) return true;
  await g.say(A.no(g), say(WHO.staff));
  return false;
}
const ROOM_SPOT = { press: [10, 10, 'up'], kakugi: [3, 10, 'up'], office: [8, 9, 'up'], crisis: [10, 10, 'up'], hall: [17, 3, 'down'] };
async function gotoRoom(g, room) {
  const s = ROOM_SPOT[room];
  await g.goto(PID, room, s[0], s[1], s[2]);
}
async function elevator(g) {
  G = g;
  const floors = ['office', 'kakugi', 'press', 'crisis'].map((k) => [k, floorLabel(g, k)]);
  const i = await g.ask(newKantei(g) ? 'エレベーターだ。何階へ行く？' : 'エレベーターだ。どこへ行く？', [...floors.map((f) => f[1]), 'やめておく'], { cancel: floors.length });
  if (i < 0 || i >= floors.length) { await g.movePlayer('down'); return; }
  if (!(await allowed(g, floors[i][0]))) { await g.movePlayer('down'); return; }
  g.sfx('door');
  await gotoRoom(g, floors[i][0]);
}

// ------------------------------------------------------------------ press conference
// Three questions from the context; the answers make a score -> g.activity('記者会見')
// (fame, reputation, a chance of a gaffe) and, for the PM / ministers, the cabinet's mood.
function pressQuestions(g, opts = {}) {
  const p = pol(g);
  const qs = [];
  const E = p && p.economy;
  const crisis = activeCrisis(g);
  const me = p && p.me;
  if (crisis) {
    const gov = isMinister(g);
    qs.push({ topic: crisis.disaster ? 'disaster' : 'economy', q: `${crisis.name}について、${gov ? '政府の対応は？' : '党としての考えは？'}`, a: [[crisis.disaster ? '被害と対応を説明' : '影響と対応を説明', 90, gov ? '把握している状況と、いまやっていることを順に説明した。' : '現地や関係者から聞いた状況と、党としての提案を順に説明した。'], ['全力を尽くすと言う', 60, gov ? '「政府一丸となって、全力で取り組みます」と答えた。' : '「与野党の立場をこえて、全力で取り組みます」と答えた。'], ['情報を精査中と言う', 30, '「詳細は精査中です」…記者たちは物足りなそうだ。']] });
  }
  // round 4: a remark of the player's that is still burning is the first thing the reporters ask about
  const live = typeof g.gaffes === 'function' ? g.gaffes({ who: 'player', active: true })[0] : null;
  if (live) qs.unshift({ topic: 'gaffe', gaffe: live.id, q: `先日の${live.venueName}での発言が問題になっています。撤回しないんですか？`, a: [['謝罪して撤回する', 70, '「不適切な発言でした。撤回し、おわびします」と頭を下げた。'], ['真意を説明する', 45, '「そういう意味ではなかった」と説明した。'], ['撤回しない', 15, '「撤回するつもりはありません」…記者席がどよめいた。']] });
  if (me && !live && (me.secret > 0 || (me.scandalDay && g.state.day - me.scandalDay < 60))) qs.push({ topic: 'scandal', q: '政治資金をめぐる報道について、説明を。', a: [['事実を説明し謝罪', 75, '事実関係を説明し、頭を下げた。…厳しい質問は続いたが、逃げなかった。'], ['コメントを控える', 25, '「捜査や調査に関わることは控えます」…記者席がざわついた。'], ['報道は事実無根だ', 15, '「事実無根です」と言い切った。…本当に、それで大丈夫だろうか。']] });
  const bills = (() => { try { return g.billsList({ pending: true }).filter((b) => b.policy && POLICIES[b.policy]); } catch (e) { return []; } })();
  if (bills.length) {
    const b = bills.find((x) => x.by === 'player') || bills[0];
    qs.push({ topic: 'bill', q: `『${shortTitle(POLICIES[b.policy].name)}』の法案、成立の見通しは？`, a: [['必要性を丁寧に説明', 80, '法案が必要な理由と、反対の声への考えを、丁寧に話した。'], ['国会の審議にゆだねる', 55, '「国会での審議にゆだねます」と答えた。'], ['数の力で通す', 20, '「必ず成立させます」…強い言い方が、少し波紋を呼びそうだ。']] });
  }
  if (E) {
    if (E.inflation > 2) qs.push({ topic: 'economy', q: '物価の上昇が続いています。暮らしへの対策は？', a: [['具体策を示す', 80, '電気代や食料品など、具体的な対策をあげて答えた。'], ['賃上げに期待と言う', 50, '「賃上げの流れを後押しします」と答えた。'], ['様子を見ると言う', 25, '「推移を注視します」…少し他人事に聞こえたかもしれない。']] });
    else if (E.growth < 0.5) qs.push({ topic: 'economy', q: '景気の足取りが重いですが、経済対策は？', a: [['対策の柱を示す', 80, '投資と消費を支える対策の柱を、わかりやすく説明した。'], ['財政とのバランスと言う', 60, '「財政規律とのバランスを見ながら判断します」と答えた。'], ['景気は悪くないと言う', 25, '「景気は緩やかに回復しています」…記者は首をかしげた。']] });
    else qs.push({ topic: 'economy', q: '経済の現状を、どう見ていますか？', a: [['数字を挙げて答える', 75, '成長率や雇用の数字をあげて、落ち着いて答えた。'], ['油断は禁物と言う', 60, '「よい流れですが、油断せずに取り組みます」と答えた。'], ['自分の手柄だと言う', 30, '「わたしの政策の成果です」…少し言い過ぎたかも。']] });
  }
  if (p && p.cabinet && (isPM(g) || myCabinetPost(g) === 'kanbo')) {
    const ap = Math.round(p.cabinet.approval);
    qs.push({ topic: 'approval', q: `最新の世論調査で、内閣支持率は${ap}%ですが？`, a: [['謙虚に受け止める', 75, '「厳しいご意見も含めて、謙虚に受け止めます」と答えた。'], ['結果で示すと言う', 65, '「一喜一憂せず、結果でお応えします」と答えた。'], ['調査に意味はない', 15, '「世論調査は気にしていません」…これは、まずかったかもしれない。']] });
  }
  if ((g.state.fame || 0) >= 1000) qs.push({ topic: 'fame', q: '芸能界出身として、どんな政治をめざしますか？', a: [['わかりやすい政治', 80, '「むずかしい話を、わかりやすく届けたい」と答えた。会場が少しなごんだ。'], ['ギャグで答える', 45, '持ちネタで答えた。…笑いはとれたが、まじめな記者は渋い顔だ。'], ['芸能の話は控える', 50, '「いまは政治家として話します」と答えた。']] });
  qs.push({ topic: 'message', q: '最後に、国民へのメッセージを。', a: [['自分の言葉で語る', 80, '用意した原稿から目を上げて、自分の言葉で語った。'], ['原稿を読み上げる', 55, '用意された原稿を、正確に読み上げた。'], ['手短にすませる', 35, '「以上です」…会見はあっさり終わった。']] });
  return qs.slice(0, 3);
}
export async function pressConference(g, opts = {}) {
  G = g;
  const qs = pressQuestions(g, opts);
  const talk = Number((g.state.skills && g.state.skills.talk) || 0);
  let sum = 0;
  // at a party headquarters the host is the party's press officer and the reporters are not the 官邸's
  const atParty = opts.where === 'party';
  const reporters = atParty ? [{ ...WHO.kisha1, name: '新聞社の記者' }, { ...WHO.kisha2, name: '通信社の記者' }, WHO.kisha3] : [WHO.kisha1, WHO.kisha2, WHO.kisha3];
  g.sfx('shutter');
  await g.say(opts.open || ['（カメラのフラッシュがいっせいに光った）', '「それでは、記者会見を始めます」'], say(atParty ? WHO.partyKoho : WHO.koho));
  // round 4 (politics.js g.speechOptions / g.speak): every answer is an attitude — 丁寧・誠実 / 強気 / 冗談まじり /
  // はぐらかす / 本音 / 逆ギレ (and now and then a 際どい一言) — with its 失言リスク shown; a gaffe is reported at once
  // and the next question is about it. Without the speech API the old fixed answers stay.
  const speech = typeof g.speechOptions === 'function' && typeof g.speak === 'function';
  const me0 = { name: g.state.name, look: g.state.look };
  let gaffed = null;
  for (let k = 0; k < qs.length; k++) {
    const q = qs[k];
    const r = reporters[k % reporters.length];
    // a remark that blew up (earlier, or just now): retract, explain or refuse
    const gid = q.gaffe || (gaffed && k > 0 ? gaffed : null);
    if (gid && speech && typeof g.gaffeRespond === 'function') {
      const opts = g.gaffeOptions(gid).filter((o) => ['tekkai', 'setsumei', 'hirakinaori'].includes(o.id) && !o.why);
      if (opts.length) {
        const qq = q.gaffe ? q.q : 'いまの発言、撤回されますか？';
        const i = await g.ask(`「${qq}」`, opts.map((o) => o.name), { cancel: opts.length - 1, ...say(r) });
        const o = opts[i] || opts[opts.length - 1];
        const res = g.gaffeRespond(gid, o.id, { attitude: 'teinei' });
        sum += o.id === 'tekkai' ? 60 : o.id === 'setsumei' ? 40 : 10;
        await g.say(res && res.ok ? String(res.text || '').split('\n').slice(0, 2).join('\n') : (res && res.why) || '（答えられなかった）');
        gaffed = null;
        if (q.gaffe) continue;
      }
    }
    if (!speech) {
      const i = await g.ask(`「${q.q}」`, q.a.map((a) => a[0]), { cancel: q.a.length - 1, ...say(r) });
      const a = q.a[i] || q.a[q.a.length - 1];
      sum += a[1];
      await g.say(a[2]);
      continue;
    }
    const O = g.speechOptions('kaiken', { topic: q.topic || 'general' });
    const labels = O.options.map((o) => (o.risky ? `${o.name.replace(/^際どい一言：/, '')}（${o.risk}%）` : `${o.name}（失言${o.risk}%）`));
    const i = await g.ask(`「${q.q}」`, labels, { cancel: 0, ...say(r) });
    const o = O.options[i] || O.options[0];
    const res = g.speak('kaiken', { topic: O.topic, attitude: o.id, force: true });
    if (!res || !res.ok) { sum += 50; continue; }
    sum += res.score;
    await g.say(res.line, me0);
    if (res.outcome === 'gaffe') {
      g.sfx('buzz');
      await g.say(['（記者席がざわついた。フラッシュがいっせいに光る）', `${res.reaction}`]);
      gaffed = res.gaffe ? res.gaffe.id : null;
    } else if (res.outcome === 'good') { g.sfx('good'); await g.say(`（${res.reaction}）`); }
    else await g.say(`（${res.reaction}）`);
  }
  const score = clamp(Math.round(sum / Math.max(1, qs.length) * 0.75 + talk * 0.3), 0, 100);
  const r = g.activity('記者会見', { score, speech: speech || undefined });
  const lines = [];
  lines.push(r && r.ok && effects(r) ? `会見を終えた。\n${effects(r)}` : r && !r.ok && r.why === '今日はもうやった' ? '会見を終えた。\n（今日はもう取材に答えているので、評判は動かなかった）' : '会見を終えた。');
  // the cabinet's mood moves once a day at most (官邸・党本部・緊急会見のどこで開いても)
  const moodOk = g.flag('kantei_mood_day') !== g.state.day;
  if (isPM(g) || myCabinetPost(g) === 'kanbo') { if (moodOk) nudge(g, { mood: (score - 55) / 12 }); lines.push(score >= 70 ? '（会見の評判は上々だ。支持率にも追い風になりそうだ）' : score < 45 ? '（会見の評判は、いまひとつだった…）' : '（無難な会見だった）'); }
  else if (isMinister(g) && moodOk) nudge(g, { mood: (score - 55) / 30 });
  if (isMinister(g)) g.setFlag('kantei_mood_day', g.state.day);
  await g.say(lines);
  return score;
}

// ------------------------------------------------------------------ policy picker (閣議決定)
async function pickPolicy(g, title) {
  const areas = AREA_ORDER.filter((a) => POLICY_ORDER.some((id) => POLICIES[id].area === a));
  const a = await g.list({ title, items: areas.map((x) => POLICY_AREAS[x].name), x: 16, y: 56, w: 240, px: true, describe: (k) => POLICY_AREAS[areas[k]].desc });
  if (a < 0) return null;
  const ids = POLICY_ORDER.filter((id) => POLICIES[id].area === areas[a]);
  const blocks = ids.map((id) => { try { return g.policyBlock(id); } catch (e) { return 'エラー'; } });
  const k = await g.list({
    title: POLICY_AREAS[areas[a]].name, x: 16, y: 56, w: 420, px: true,
    items: ids.map((id, i) => ({ label: POLICIES[id].name.slice(0, 22), disabled: !!blocks[i] })),
    describe: (i) => { const pl = POLICIES[ids[i]]; const pv = (() => { try { return g.policyPreview(ids[i]); } catch (e) { return null; } })(); return `${pl.desc}${pv && pv.cost ? `（${pv.cost > 0 ? '費用' : '財政の改善'} 年${fmtCho(Math.abs(pv.cost))}）` : ''}${blocks[i] ? `\n※${blocks[i]}` : ''}`; },
  });
  if (k < 0) return null;
  if (blocks[k]) { await g.say(blocks[k]); return null; }
  return ids[k];
}

// ------------------------------------------------------------------ scripts: hall
async function recepTalk(g, npc) {
  G = g;
  const S = say(WHO.recep);
  const yr = yearOf(g);
  if (isPolitician(g)) {
    const post = myCabinetPost(g);
    const lines = [post ? `${post === 'pm' ? '総理' : postLabel(g, post)}、おはようございます。` : '{familyname}先生、ようこそ官邸へ。'];
    lines.push(kakugiDay(g) ? `本日は定例閣議の日です。\n閣僚のみなさまは、${newKantei(g) ? '4階の' : ''}閣僚応接室へどうぞ。` : '定例閣議は、原則として火曜日と金曜日です。');
    if (newKantei(g)) lines.push('5階が総理の執務室、4階が閣議室。\n1階に記者会見室、地下に危機管理センターがございます。');
    await g.say(lines, S);
    return;
  }
  // a courtesy call (表敬訪問) by a star
  if (g.flag('kantei_guest') === g.state.day && g.flag('kantei_visit') !== g.state.day) {
    const last = Number(g.flag('kantei_visit_day') || -999);
    if (g.state.day - last < 60) { await g.say(['{fullname}さま、先日はありがとうございました。', '本日は、総理の日程がつまっておりまして…\nまたの機会にお願いいたします。'], S); return; }
    await courtesyCall(g);
    return;
  }
  await g.say([yr < 2002 ? 'こちらは総理大臣官邸です。\nこの建物は、1929年（昭和4年）に建てられたんですよ。' : 'こちらは総理大臣官邸です。\n2002年から使われている建物なんですよ。', '見学のツアーは、ありませんの。\nごめんなさいね。'], S);
}
async function courtesyCall(g) {
  const p = pol(g);
  const name = pmName(g);
  const pmNpc = p && npcOf(g, p.cabinet.pm);
  const PM = { name: `${pmSurname(g)}総理`, look: (pmNpc && pmNpc.look) || LOOKS.manager };
  g.setFlag('kantei_visit', g.state.day);
  g.setFlag('kantei_visit_day', g.state.day);
  await g.say(['「表敬訪問ですね。総理がお待ちです」', '（ホールで待っていると、総理が階段を下りてきた）'], say(WHO.recep));
  await g.say(['ようこそ、{fullname}さん。\nいつもテレビで拝見していますよ。', 'あなたの活躍は、たくさんの人を元気にしている。\nこれからも、がんばってください。'], PM);
  g.sfx('shutter');
  await g.say('（記念撮影のフラッシュが光った。\n　この様子は、夕方のニュースで流れるらしい）');
  g.addFame(40);
  if (typeof g.addFans === 'function') g.addFans(500);
  if (typeof g.message === 'function') g.message({ from: 'ドット新聞', kind: 'news', text: `【官邸】${g.state.name}さんが首相官邸を表敬訪問。${name}総理と和やかに懇談した。` });
}
// 記念撮影の階段 (組閣・改造の日の慣例)
async function photoStairs(g) {
  G = g;
  const p = pol(g);
  const post = myCabinetPost(g);
  const formed = p && p.cabinet ? p.cabinet.formed : null;
  if (post && formed != null && g.state.day - formed <= 3 && !g.flag(`kantei_photo_${formed}`)) {
    g.setFlag(`kantei_photo_${formed}`, true);
    await g.say(['新しい内閣の記念撮影だ。', `閣僚たちが赤じゅうたんの階段に並ぶ。\n${postLabel(g, post)}として、${post === 'pm' ? 'まん中の最前列' : '自分の立ち位置'}に立った。`]);
    g.sfx('shutter');
    await g.say('（フラッシュの嵐。この写真は、あしたの朝刊の一面を飾る）');
    g.addFame(post === 'pm' ? 120 : 60);
    return;
  }
  await g.say(['赤じゅうたんの階段だ。', '内閣ができた日には、初閣議のあと\nこの階段で閣僚全員が記念撮影をするのが慣例だ。']);
}

// ------------------------------------------------------------------ scripts: press room
async function podiumTalk(g) {
  G = g;
  if (!isMinister(g)) {
    await g.say(['演台だ。国旗と、青い幕。', `ここで総理や官房長官が会見を開く。${newKantei(g) ? '\n官房長官の定例会見は、平日の午前と午後の2回だ。' : ''}`]);
    return;
  }
  if (today(g, 'kantei_press')) { await g.say('今日はもう会見を開いた。'); return; }
  const post = myCabinetPost(g);
  const i = await g.ask(`${postLabel(g, post)}として、記者会見を開く？`, ['会見を開く', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  g.setFlag('kantei_press', g.state.day);
  if (g.map && g.map.placeId === PID && g.map.roomId === 'press') g.placePlayer(10, 3, 'down');
  await pressConference(g, { where: 'kantei' });
}

// ------------------------------------------------------------------ scripts: 閣議
async function kakugiTable(g) {
  G = g;
  if (!isMinister(g)) { await g.say('閣議室の円卓だ。\n閣議は非公開で、閣僚だけが席につく。'); return; }
  if (!kakugiDay(g) && !isPM(g)) { await g.say(['今日は閣議の日ではない。', '定例閣議は、原則として火曜日と金曜日だ。']); return; }
  if (!isPM(g)) {
    if (today(g, 'kantei_kakugi')) { await g.say('今日の閣議は、もう終わった。'); return; }
    g.setFlag('kantei_kakugi', g.state.day);
    const r = g.activity('閣議に出る');
    await g.say(['閣議が始まった。', `配られた閣議書に、ひとつずつ署名（花押）をしていく。\n閣議は30分ほどで終わった。${r && r.ok ? `\n${effects(r)}` : ''}`]);
    return;
  }
  // the PM chairs the cabinet
  for (let guard = 0; guard < 6; guard++) {
    const items = ['定例閣議を開く', '法案を閣議決定', '衆議院の解散', '内閣改造', '内閣総辞職', 'もどる'];
    const i = await g.ask(`総理として、閣議で何を決める？${kakugiDay(g) ? '' : '\n（今日は定例閣議の日ではない。臨時閣議になる）'}`, items, { cancel: items.length - 1 });
    if (i === 0) {
      if (today(g, 'kantei_kakugi')) { await g.say('今日の閣議は、もう開いた。'); continue; }
      g.setFlag('kantei_kakugi', g.state.day);
      const r = g.activity('閣議に出る');
      await g.say(['閣議を開いた。', `閣僚たちが閣議書に署名（花押）し、\n最後に総理として署名した。これで閣議決定だ。${r && r.ok ? `\n${effects(r)}` : ''}`]);
    } else if (i === 1) {
      const id = await pickPolicy(g, '閣議決定する法案の分野');
      if (!id) continue;
      const bill = g.proposeBill({ policy: id });
      await g.say(bill ? [`「${POLICIES[id].name}」の法案を閣議決定した。`, '内閣提出の法案（閣法）として、国会で審議される。'] : (g.lastPoliticsError || '閣議決定できなかった。'));
    } else if (i === 2) {
      const j = await g.ask(['衆議院を解散する？\n議員はみな職を失い、総選挙になる。', '（解散は内閣が決める。全閣僚が閣議書に署名する）'], ['解散する', 'やめておく'], { cancel: 1 });
      if (j !== 0) continue;
      const k = await g.ask('本当に解散する？', ['解散する！', 'やっぱりやめる'], { cancel: 1 });
      if (k !== 0) continue;
      const e = g.dissolve('総理の判断');
      if (e) { g.sfx('drum'); await g.say(['全閣僚が閣議書に署名した。', '衆議院の本会議で解散詔書が読み上げられ、\n議場に「万歳」の声が響いた。…総選挙だ！']); return; }
      await g.say(g.lastPoliticsError || '解散できなかった。');
    } else if (i === 3) {
      const r = g.reshuffle({});
      await g.say(r && r.ok ? ['内閣を改造した。', '新しい顔ぶれで、もう一度スタートだ。\n（新しい閣僚たちと、階段で記念撮影をしよう）'] : (r && r.why) || '改造できなかった。');
    } else if (i === 4) {
      const j = await g.ask('内閣総辞職を決める？\n総理大臣を辞めることになる。', ['総辞職する', 'やめておく'], { cancel: 1 });
      if (j !== 0) continue;
      const w = g.resignPM('総理の決断');
      await g.say(w || ['内閣総辞職を閣議決定した。', '国会で、次の総理大臣が指名されることになる。']);
      return;
    } else return;
    if (g.auto) return;
  }
}
async function ministerChat(g, npc) {
  G = g;
  const atTable = /^kantei_seat/.test(npc.id || '');
  const lines = !kakugiDay(g) ? ['今日は閣議がない日でね。\n書類を取りに寄っただけさ。']
    : atTable ? ['まもなく閣議だ。\n配られた閣議書に、ひとつずつ花押を書いていくんだ。', '閣議の中身は非公開。\n終わったら、官房長官が記者会見で発表するよ。']
      : ['閣議の前は、ここ閣僚応接室に集まるんだ。\nテレビでよく映る、あのソファの部屋だよ。', '閣議そのものは非公開。\n記者が見られるのは、この部屋までなんだ。'];
  await g.say(lines, { name: npc.name, look: npc.look });
}

// ------------------------------------------------------------------ scripts: 総理執務室
async function pmDeskTalk(g) {
  G = g;
  if (!isPM(g)) {
    await g.say(['総理の机だ。', '書類が山のように積まれている。\n…勝手にさわってはいけない。']);
    return;
  }
  for (let guard = 0; guard < 6; guard++) {
    const console0 = typeof g.govtConsole === 'function';
    // round 4: after a major disaster the PM may appoint a 復興担当大臣 (politics.js g.fukko / the politics UI)
    let F = null;
    try { F = typeof g.fukko === 'function' ? g.fukko() : null; } catch (e) { F = null; }
    const fk = F && F.active && F.canAppoint ? `${F.postName}を${F.ministerName ? '代える' : '任命する'}` : null;
    // round 5 (R5-D): 党内の動き (politics_intra_ui.js): the factions, 倒閣運動, the party's disputes; a mark while a plot against the PM is on
    const intra0 = typeof g.politicsScreen === 'function' && typeof g.intra === 'function' && !g.auto;
    let plot0 = null;
    try { plot0 = intra0 && typeof g.intraPlot === 'function' ? g.intraPlot() : null; } catch (e) { plot0 = null; }
    const intraItem = intra0 ? `党内の動き${plot0 && plot0.mine ? '（倒閣の動き！）' : ''}` : null;
    const items = ['きょうの報告を聞く', '政治のメニュー', '外遊に出る', '危機管理センターへ', ...(console0 ? ['政府中枢（コンソール）'] : []), ...(fk ? [fk] : []), ...(intraItem ? [intraItem] : []), 'もどる'];
    const i = await g.ask('総理の執務机だ。何をする？', items, { cancel: items.length - 1 });
    if (intraItem && items[i] === intraItem) { try { await g.politicsScreen('party', {}); } catch (e) { console.error(e); } continue; }
    if (fk && items[i] === fk) {
      if (g.auto) { await g.say(`（${F.disaster.name}の復興を担う${F.postName}を決めよう）`); return; }
      try { await g.politicsScreen('fukkoAppoint'); } catch (e) { console.error(e); }
      continue;
    }
    if (console0 && i === 4) { try { await g.govtConsole('overview'); } catch (e) { console.error(e); } continue; }
    if (i === 0) await briefing(g);
    else if (i === 1) { try { await g.politicsMenu(); } catch (e) { console.error(e); } }
    else if (i === 2) {
      const r = g.activity('外遊');
      await g.say(r && r.ok ? [`${yearOf(g) >= 1993 ? '政府専用機' : '日本航空の特別機'}で、首脳会談に出かけた。`, `各国の首脳と、握手をかわした。\n${effects(r)}`] : (r && r.why) || '外遊はできない。');
    } else if (i === 3) { await gotoRoom(g, 'crisis'); return; }
    else return;
    if (g.auto) return;
  }
}
async function briefing(g) {
  G = g;
  const p = pol(g);
  if (!p) { await g.say('（報告はない）', say(WHO.hisho)); return; }
  const E = p.economy;
  const s = (() => { try { return g.politicsSummary(); } catch (e) { return null; } })();
  const up = s && s.upcoming ? s.upcoming.filter((e) => !e.newsOnly).slice(0, 1) : [];
  const crisis = activeCrisis(g);
  const lines = [
    `総理、本日のご報告です。\n内閣支持率は${Math.round(p.cabinet.approval)}%。`,
    `成長率 ${Math.round(E.growth * 10) / 10}%、物価 ${Math.round(E.inflation * 10) / 10}%、失業率 ${Math.round(E.unemployment * 10) / 10}%です。`,
    p.diet.session ? `いまは${p.diet.session.kind}の会期中です。\n審議中の法案は${g.billsList({ pending: true }).length}本。` : '国会は閉会中です。',
  ];
  if (up.length) lines.push(`次の選挙は「${up[0].label.slice(0, 16)}」、\n${up[0].date}の予定です。`);
  if (crisis) lines.push(`${crisis.name}の対応が続いています。\n危機管理センターへお願いします。`);
  try {
    const pl = typeof g.intraPlot === 'function' ? g.intraPlot() : null;
    if (pl && pl.mine && pl.stage !== 'failed') lines.push(`総理、党内で退陣を求める動きが出ています。\n${pl.bossName}氏らが動いているようです。（見込み${Math.round(pl.odds)}%）`);
  } catch (e) { /* the politics core is missing */ }
  let F = null;
  try { F = typeof g.fukko === 'function' ? g.fukko() : null; } catch (e) { F = null; }
  if (F && F.active) lines.push(F.ministerName ? `${F.disaster.name}の復興は、${F.ministerName}${F.postName}が担当。\n進み具合は${F.progress}%です。` : `${F.disaster.name}の復興を担う${F.postName}は、\nまだ置いていません。ご判断を。`);
  await g.say(lines, say(WHO.hisho));
}
async function pmNpcTalk(g, npc) {
  G = g;
  const post = myCabinetPost(g);
  if (post && post !== 'pm') {
    const done = today(g, 'kantei_brief');
    if (!done) { g.setFlag('kantei_brief', g.state.day); nudge(g, { rep: 1 }); }
    await g.say([`${postLabel(g, post)}、ご苦労さま。`, done ? '報告はさっき聞いたよ。\n…現場を、よろしく頼む。' : '所管の報告、ありがとう。\n国会の答弁、気を抜かずにいこう。'], { name: npc.name, look: npc.look });
    return;
  }
  await g.say(['ようこそ。', 'この部屋から見える景色は、いつ見ても重たいね。\n…この国のことを、毎日考えている。'], { name: npc.name, look: npc.look });
}

// ------------------------------------------------------------------ scripts: 危機管理センター
// the 政府中枢 console at its 危機管理 tab (govt_ui.js; A2's disaster / press / regime actions); null when it is missing
function crisisConsole(g) { return typeof g.govtConsole === 'function' && !g.auto ? g.govtConsole('crisis') : null; }
// A2's current disaster (regime.js), when there is one
function regimeDisaster(g) { try { return typeof g.disaster === 'function' ? g.disaster() : null; } catch (e) { console.error(e); return null; } }
async function crisisTalk(g, npc) {
  G = g;
  const c = activeCrisis(g);
  const S = { name: yearOf(g) >= 1998 ? '内閣危機管理監' : WHO.kanshi.name, look: WHO.kanshi.look };
  // the PM / a minister may go straight to the console (disaster actions, 自衛隊, 報道, 体制)
  if (isMinister(g) && typeof g.govtConsole === 'function' && !g.auto) {
    const ds = regimeDisaster(g);
    const k = await g.ask(ds ? `${ds.name}の対応中です。どうなさいますか？` : c ? `${c.name}の対応中です。どうなさいますか？` : '危機管理センターです。どうなさいますか？', ['報告を聞く', '危機管理の画面（政府中枢）', 'もどる'], { cancel: 2, ...S });
    if (k === 2) return;
    if (k === 1) { await crisisConsole(g); return; }
    if (!c && ds) { await g.say([`${ds.name}（${ds.tierName}）。${ds.summary}`, '具体的な対応は、危機管理の画面からご指示ください。'], S); return; }
  }
  if (!c) {
    await g.say([`${S.name}です。`, 'ここは24時間、休まず動いています。\n地震、台風、事故…なにかあれば、すぐ情報が集まる。', 'いまは大きな事態はありません。\n…平穏なのが、いちばんです。'], S);
    return;
  }
  if (g.flag(`kantei_crisis_${c.key}`)) { await g.say([`${c.name}への対応を続けています。`, '指示は各省庁に伝わっています。\n引き続き、状況を報告します。'], S); return; }
  if (!isPM(g)) {
    await g.say([`${c.name}への対応中です。`, '大臣、所管の現場の状況を確認してください。'], S);
    const i = await g.ask('どうする？', ['現場を視察する', 'あとにする'], { cancel: 1 });
    if (i !== 0) return;
    g.setFlag(`kantei_crisis_${c.key}`, true);
    const r = g.activity('視察');
    nudge(g, { rep: 2, mood: 0.5 });
    await g.say(r && r.ok ? ['現場に入り、関係者の話を聞いた。', `必要な支援を、すぐ省に持ち帰ることにした。\n${effects(r)}`] : (r && r.why) || '視察には行けなかった。');
    return;
  }
  // the PM leads the response
  await g.say([`総理、${c.name}です。`, c.disaster ? '被害の全体像は、まだつかめていません。\n各省庁の担当者が、ここに集まっています。' : '市場と暮らしへの影響が広がっています。\n関係省庁が集まっています。', 'ご指示をお願いします。'], S);
  g.setFlag(`kantei_crisis_${c.key}`, true);
  const opts = c.disaster
    ? [['人命救助を最優先', '自衛隊の災害派遣と、救助の態勢を最優先にするよう指示した。\n「時間との勝負だ。一人でも多くの命を」', { mood: 3, rep: 3 }],
      ['被災者の生活支援', '避難所への水・食料・毛布の手配と、\n予備費を使った支援を指示した。', { mood: 2, rep: 2 }],
      ['復興の補正予算', 'policy:reconstruction', { mood: 1, rep: 1 }],
      ['情報の集約を待つ', '「まずは情報を集めよう」…慎重な判断だが、\n対応が遅いという声も出そうだ。', { mood: -2, rep: -1 }]]
    : [['緊急の経済対策', 'policy:stimulus', { mood: 1.5, rep: 1 }],
      ['市場に冷静を呼びかけ', '関係閣僚と連携し、冷静な対応を呼びかけた。\n過度な動きには注意していくと伝えた。', { mood: 1, rep: 1 }],
      ['暮らしへの支援を指示', '影響を受ける家庭や中小企業への支援策を\nまとめるよう指示した。', { mood: 2, rep: 2 }],
      ['しばらく様子を見る', '「推移を見守ろう」…静観という判断だ。', { mood: -1, rep: 0 }]];
  const i = await g.ask('総理、ご指示を。', opts.map((o) => o[0]), { cancel: opts.length - 1, ...S });
  const o = opts[i] || opts[opts.length - 1];
  if (String(o[1]).startsWith('policy:')) {
    const id = o[1].slice(7);
    const bill = POLICIES[id] ? g.proposeBill({ policy: id }) : null;
    await g.say(bill ? [`「${POLICIES[id].name}」の法案づくりを指示し、閣議決定した。`, '国会で、補正予算とあわせて審議される。'] : [g.lastPoliticsError || '法案は出せなかった。', '（ほかの手を考えよう）']);
  } else await g.say(o[1]);
  nudge(g, o[2]);
  const j = await g.ask('国民に向けて、緊急の記者会見を開く？', ['会見を開く', 'あとにする'], { cancel: 1 });
  if (j === 0) {
    g.setFlag('kantei_press', g.state.day);
    // to the press room (1階): the podium faces the reporters
    if (g.map && g.map.placeId === PID) { g.sfx('door'); await g.goto(PID, 'press', 10, 3, 'down'); }
    await pressConference(g, { where: 'crisis', open: ['（緊急の記者会見。会見室は記者でいっぱいだ）', '「総理から、国民のみなさまへのご説明です」'] });
  }
}
async function opTalk(g, npc) {
  G = g;
  const c = activeCrisis(g);
  const lines = !c ? ['モニターで、全国の状況を見守っています。', 'なにもない日も、気は抜けません。']
    : c.disaster ? [`${c.name}の情報が、次々に入ってきます！`, '各地の被害、交通、電気、通信…\nすべてこの画面に集まるんです。']
      : [`${c.name}への対応で、各省から報告が入ってきます。`, '市場の動き、企業や家計への影響…\n数字を、一つずつ確かめています。'];
  await g.say(lines, { name: npc.name, look: npc.look });
}

// ------------------------------------------------------------------ dynamic NPCs (cabinet members)
// Seat k shows the k-th minister of the cabinet (NPCs only; getters read the running game).
function ministerSeat(id, k, x, y, dir, when) {
  const at = () => { const g = game(); const list = g ? cabinetList(g).filter((m) => m.who !== 'player') : []; return list[k] || null; };
  return {
    type: 'npc', id, x, y, dir, fixedDir: true,
    get name() { const g = game(); const m = at(); if (!g || !m) return '大臣'; const n = npcOf(g, m.who); return `${postLabel(g, m.post).replace(/^内閣府特命担当大臣$/, '特命担当大臣')}${n ? `・${n.name.split(' ')[0]}` : ''}`; },
    get look() { const g = game(); const m = at(); const n = g && m ? npcOf(g, m.who) : null; return (n && n.look) || LOOKS.manager; },
    cond: (g) => { G = g; return !!at() && when(g); },
    talk: ministerChat,
  };
}

// ------------------------------------------------------------------ exits
// doorIndexFor builds every town; a broken town module elsewhere must not trap the player here.
let doorWarned = false;
function doorOf(pid) {
  try { return doorIndexFor(pid); } catch (e) { if (!doorWarned) { doorWarned = true; console.warn('[kantei] door index failed', e); } return null; }
}
function streetSpot() {
  const d = doorOf(PID);
  if (d) return d;
  return { town: 'tokyo', room: 'main', x: 40, y: 3 };
}
function exitWarps(xs, y) {
  const out = [];
  for (const x of xs) {
    out.push({ x, y, to: 'exit', cond: () => !!doorOf(PID) });
    out.push({
      x, y, dir: 'down', cond: () => !doorOf(PID),
      get place() { return streetSpot().town; }, get room() { return streetSpot().room; },
      get tx() { return streetSpot().x; }, get ty() { return streetSpot().y; },
    });
  }
  return out;
}

// ------------------------------------------------------------------ the place
registerPlace({
  id: PID,
  name: '首相官邸',
  pressConference, // used by the party headquarters (parties.js) through PLACES.kantei
  kind: 'building',
  bgm: 'office',
  start: { room: 'hall', x: 10, y: 10, dir: 'up' },
  legend: { '#': T('walltop'), U: T('wall_u'), '=': T('wall'), P: 'plant', M: 'exit_mat' },
  rooms: {
    // -------------------------------------------------------------- 3F 正面玄関ホール
    hall: {
      floor: T('floor'),
      topPad: 24,
      tiles: [
        '######################',
        '#UUUUUULLLLLLLUUUUUUU#',
        '#=sss==lllllll===e=d=#',
        '#.rrr................#',
        '#.rrr....KKKK....P...#',
        '#....................#',
        '#.SS..........G.G....#',
        '#.tt.................#',
        '#....................#',
        '#P........[]........P#',
        '#.........[].........#',
        '##########MM##########',
      ],
      legend: {
        L: T('bamboo_u'), l: T('bamboo'), s: T('redstairs'), r: T('redcarpet'), '[': T('redcarpet'), ']': T('redcarpet'),
        K: 'counter_white', S: 'sofa_beige', t: 'table_low', G: T('gate'), e: 'elevator', d: 'stairs_down',
      },
      warps: [
        ...exitWarps([10, 11], 11),
        ...[2, 3, 4].map((x) => ({ x, y: 2, room: 'kakugi', tx: 3, ty: 10, dir: 'up', check: (g) => allowed(g, 'kakugi') })),
        { x: 19, y: 2, room: 'press', tx: 10, ty: 10, dir: 'up' },
      ],
      entities: [
        plate(7, 0.9, (g) => (g && !newKantei(g) ? '中庭' : '竹の庭'), 7),
        npc('kantei_recep', 10, 3, 'down', WHO.recep, { talk: posted('down', recepTalk) }),
        npc('kantei_guard', 15, 5, 'down', WHO.guard, { text: ['（警備の警察官が、ゲートの前に立っている）', '「入館証を、見えるところにお付けください」'] }),
        npc('kantei_staff', 7, 7, 'right', WHO.staff, {
          wander: 2,
          talk: async (g) => { G = g; await g.say(['官邸では、総理を支える内閣官房の職員が働いています。', newKantei(g) ? '正面玄関は3階なんです。\n官邸は坂の途中に建っていて、表の通りと同じ高さが\n3階なんですよ。' : 'この官邸は、1929年（昭和4年）に建てられた建物です。\n古いけれど、いまも総理の仕事場なんですよ。'], say(WHO.staff)); },
        }),
        npc('kantei_kisha1', 18, 8, 'left', WHO.kisha1, { text: ['内閣記者会の記者です。', '閣僚が出入りするたびに、\nこのホールで「ひと言」を聞くんです。'] }),
        npc('kantei_kisha2', 18, 9, 'left', WHO.kisha2, {
          talk: async (g, n) => {
            G = g;
            if (isPM(g)) { await g.say(['総理、ひと言お願いします！', `支持率は${g.approval()}%。\n…数字は、毎週の調査で動きますからね。`], say(WHO.kisha2)); return; }
            await g.say([`いまの総理は${pmName(g)}さん。`, `支持率は${g.approval()}%…\n数字は、毎週の調査で動くからね。`], say(WHO.kisha2));
          },
        }),
        { type: 'sign', x: 3, y: 3, talk: photoStairs },
        { type: 'sign', x: 8, y: 2, talk: async (g) => { G = g; await g.say(newKantei(g) ? ['ガラスの向こうに、竹の庭が見える。', '風が吹くたびに、笹の葉がさらさらと揺れている。'] : ['ガラスの向こうに、中庭の植えこみが見える。', '昭和のはじめから、歴代の総理がながめてきた庭だ。']); } },
      ],
      events: [
        { x: 17, y: 2, on: 'step', run: elevator },
        { x: 10, y: 10, w: 2, on: 'step', once: 'kantei_hall_hello', run: async (g) => { G = g; await g.say(isPolitician(g) ? '（警備の警察官が、さっと敬礼した）' : '（ここが、首相官邸…。空気がぴんと張りつめている）'); } },
      ],
    },

    // -------------------------------------------------------------- 1F 記者会見室
    press: {
      floor: 'floor_carpet_gray',
      topPad: 24,
      tiles: [
        '####################',
        '#UUUUUUBBBBBBUUUUUU#',
        '#======bbbbbb======#',
        '#.....F......F.....#',
        '#.........p........#',
        '#..................#',
        '#.cccc.cccc.cccc...#',
        '#..................#',
        '#.cccc.cccc.cccc...#',
        '#.KK...........KK..#',
        '#..................#',
        '#########dd#########',
      ],
      legend: { B: T('curtain_u'), b: T('curtain'), F: T('flagstand'), p: T('podium'), c: T('chair'), K: 'camera', d: 'stairs_up' },
      warps: [9, 10].map((x) => ({ x, y: 11, room: 'hall', tx: 19, ty: 3, dir: 'down' })),
      entities: [
        npc('kantei_koho', 4, 3, 'right', WHO.koho, {
          talk: async (g) => { G = g; await g.say(['内閣広報室です。会見の進行を担当しています。', `会見の様子は、${yearOf(g) >= 2000 ? 'テレビやネット' : 'テレビやラジオ'}で伝えられます。\nひと言ひと言が、全国に届くんですよ。`], say(WHO.koho)); },
        }),
        npc('kantei_pk1', 3, 6, 'up', WHO.kisha1, { text: ['会見の前は、質問をノートにまとめておくの。', '政府の説明を、国民にわかる言葉で伝える。\nそれが記者の仕事だと思ってる。'] }),
        npc('kantei_pk2', 8, 6, 'up', WHO.kisha2, { text: ['今日の質問、だれが当てられるかな…。', '会見の最後に「あと一問だけ」って、\n手を挙げ続けるのも大事なんだ。'] }),
        npc('kantei_pk3', 13, 8, 'up', WHO.kisha3, { text: ['テレビ局の記者です。', '夕方のニュースまでに、\nこの会見をまとめなきゃいけないんです！'] }),
        npc('kantei_pcam', 3, 10, 'up', WHO.camera, { text: '会見中は、ずっとカメラを回しっぱなしさ。\n…腕が、パンパンだよ。' }),
        { type: 'sign', x: 10, y: 4, talk: podiumTalk },
      ],
    },

    // -------------------------------------------------------------- 4F 閣僚応接室・閣議室
    kakugi: {
      floor: 'floor_carpet_beige',
      topPad: 24,
      tiles: [
        '########################',
        '#UUUUUUUUU#UUUUUUUUUUUU#',
        '#===p=====#=====c======#',
        '#SSSS.....#............#',
        '#tttt.....#............#',
        '#.........d............#',
        '#.........#............#',
        '#SSSS.....#............#',
        '#tttt.....#............#',
        '#.........#............#',
        '#P.......P#P..........P#',
        '###ss###################',
      ],
      legend: { p: `${T('wall')}+painting`, c: `${T('wall')}+clock`, S: 'sofa_beige', t: 'table_low', d: 'door_wood', s: 'stairs_down' },
      warps: [3, 4].map((x) => ({ x, y: 11, room: 'hall', tx: 3, ty: 3, dir: 'down' })),
      entities: [
        plate(2, 0.9, '閣僚応接室', 6),
        plate(14, 0.9, '閣議室', 5),
        roundTable(14, 4, kakugiTable),
        npc('kantei_fuku', 21, 9, 'left', WHO.fuku, {
          text: ['閣議の段取りは、内閣官房が整えます。', '閣議の案件は、ふつう前もって各省の間で\n調整されているんですよ。', '国会の会期中は、朝9時から国会議事堂の中の\n閣議室で開くことが多いんです。\nふだんは官邸のここで、朝10時からですね。'],
        }),
        // 閣僚応接室: ministers wait on the sofas before the 閣議 (閣議の日だけ)
        ministerSeat('kantei_wait1', 0, 5, 3, 'left', kakugiDay),
        ministerSeat('kantei_wait2', 1, 5, 7, 'left', kakugiDay),
        ministerSeat('kantei_wait3', 2, 7, 5, 'down', kakugiDay),
        // 閣議室: around the round table
        ministerSeat('kantei_seat1', 3, 15, 3, 'down', kakugiDay),
        ministerSeat('kantei_seat2', 4, 18, 3, 'down', kakugiDay),
        ministerSeat('kantei_seat3', 5, 20, 5, 'left', kakugiDay),
        ministerSeat('kantei_seat4', 6, 18, 7, 'up', kakugiDay),
        ministerSeat('kantei_seat5', 7, 15, 7, 'up', kakugiDay),
        ministerSeat('kantei_seat6', 8, 13, 5, 'right', kakugiDay),
      ],
    },

    // -------------------------------------------------------------- 5F 総理執務室
    office: {
      floor: 'floor_carpet_beige',
      tiles: [
        '##################',
        '#UUUUWWWWWWWWUUUU#',
        '#====wwwwwwww====#',
        '#bb..F......F..bb#',
        '#................#',
        '#................#',
        '#..SSS......SSS..#',
        '#..ttt......ttt..#',
        '#................#',
        '#P..............P#',
        '#######ee#########',
      ],
      legend: { W: T('city_u'), w: T('city'), b: 'bookshelf', F: T('flagstand'), S: 'sofa_blue', t: 'table_low', e: 'elevator' },
      warps: [7, 8].map((x) => ({ x, y: 10, room: 'hall', tx: 17, ty: 3, dir: 'down' })),
      entities: [
        plate(6.5, 0.9, '総理大臣執務室', 5),
        pmDesk(6, 4, pmDeskTalk),
        {
          type: 'npc', id: 'kantei_pm', x: 8, y: 3, dir: 'down', fixedDir: true,
          get name() { const g = game(); return g ? `${pmSurname(g)}総理` : '総理'; },
          get look() { const g = game(); const p = g && pol(g); const n = p ? npcOf(g, p.cabinet.pm) : null; return (n && n.look) || LOOKS.manager; },
          cond: (g) => { G = g; const p = pol(g); return !!(p && p.cabinet.pm && p.cabinet.pm !== 'player'); },
          talk: pmNpcTalk,
        },
        npc('kantei_hisho', 13, 5, 'left', WHO.hisho, {
          talk: async (g) => { G = g; if (isPM(g)) await briefing(g); else await g.say(['総理秘書官です。', '総理の一日は、分きざみの日程なんです。\n…ご用件は、手短にお願いしますね。'], say(WHO.hisho)); },
        }),
        npc('kantei_sp', 2, 8, 'right', WHO.sp, { text: '……（SPが、静かに部屋の入口を見守っている）' }),
        { type: 'sign', x: 10, y: 2, text: ['窓の外に、国会議事堂の塔が見える。', 'この部屋から、毎日あの塔をながめるのか…。'] },
      ],
    },

    // -------------------------------------------------------------- B1 危機管理センター
    crisis: {
      floor: T('raised'),
      topPad: 24,
      tiles: [
        '######################',
        '#VVVVVVVVVVVVVVVVVVVV#',
        '#vvvvvvvvvvvvvvvvvvvv#',
        '#....................#',
        '#.kkkk..kkkk..kkkk...#',
        '#....................#',
        '#.kkkk..TTTTTT..kkkk.#',
        '#.......TTTTTT.......#',
        '#....................#',
        '#.kkkk..........kkkk.#',
        '#P..................P#',
        '##########ee##########',
      ],
      legend: { V: T('screen_u'), v: T('screen'), k: T('console'), T: T('table'), e: 'elevator' },
      warps: [10, 11].map((x) => ({ x, y: 11, room: 'hall', tx: 17, ty: 3, dir: 'down' })),
      entities: [
        npc('kantei_kanshi', 10, 5, 'down', WHO.kanshi, { talk: posted('down', crisisTalk) }),
        npc('kantei_op1', 3, 5, 'up', WHO.op1, { talk: posted('up', opTalk) }),
        npc('kantei_op2', 15, 5, 'up', WHO.op2, { talk: posted('up', opTalk) }),
        npc('kantei_op3', 4, 8, 'down', WHO.op1, { talk: posted('down', opTalk) }),
        npc('kantei_op4', 17, 8, 'down', WHO.op2, { talk: posted('down', opTalk) }),
        // the console terminal: the 政府中枢's 危機管理 tab (govt_ui.js)
        {
          type: 'sign', x: 8, y: 4,
          talk: async (g) => { G = g; const pr = crisisConsole(g); if (pr) { await pr; return; } await g.say(['危機管理システムの端末だ。', '各省庁と自治体の情報が、ここに集まってくる。']); },
        },
        {
          type: 'sign', x: 12, y: 6,
          talk: async (g) => { G = g; const c = activeCrisis(g); await g.say(c ? [`テーブルの地図に、${c.name}の情報が書きこまれている。`, '付せんとマーカーで、びっしりだ。'] : ['大きなテーブルに、地図と連絡先の一覧が置かれている。', '「平時の備えが、有事を救う」と書いた紙が貼ってある。']); },
        },
      ],
    },
  },
});

// A minister / the PM hears about a crisis on the phone (politics 'shock' hook).
onPolitics('shock', (g, s) => {
  try {
    if (!g || !g.state || !isMinister(g) || !s || NOT_CRISIS.has(s.kind)) return;
    if (typeof g.message === 'function') g.message({ from: '内閣官房', kind: 'news', text: `【至急】${s.name}。\n${isPM(g) ? '総理、' : ''}官邸の${newKantei(g) ? '危機管理センター（地下）' : '危機管理の部屋'}で対応にあたってください。` });
  } catch (e) { console.error(e); }
});

