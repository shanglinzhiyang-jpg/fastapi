// ドット区役所 — 暮らしの手続きと、地方自治・選挙の窓口
//
//   lobby    1階 総合窓口     住民課（住民票の写し・転入届／転居届・マイナンバー）、税務課（住民税）と
//                              確定申告の相談窓口（2月16日〜3月15日は税務署の臨時窓口）、番号札の発券機、
//                              区のお知らせの掲示板、エレベーター
//   senkan   2階 選挙管理委員会  選挙の予定・被選挙権と供託金の説明・立候補の届出（g.declareCandidacy）・
//                              取り下げ・選挙運動のきまり。となりは期日前投票所（2003年12月から。それより前の
//                              時代は不在者投票）。投票日には当日の投票所にもなる（g.castVote）
//   soudan   3階 区民相談室    生活相談：多重債務（消費者金融と闇金のちがい、任意整理・自己破産 → 裁判所）、
//                              闇金の被害（警察・弁護士へ）、生活が苦しいとき（生活保護は権利）
//   gikai    5階 区議会        ドット区議会の議場（定数40）。定例会（2・6・9・11月）の会期中は本会議。
//                              区議は一般質問と議案の採決、区長は予算の説明、区民は傍聴
//
// 選挙・政治は js/engine/politics.js（upcomingElections / eligible / depositInternal / requestNomination /
// declareCandidacy / withdrawCandidacy / castVote / activity）、税と借金は js/engine/crime.js（commitCrime
// ('tax_evasion') / fine / consultLawyer / debtRelief / fileBankruptcy / policeConsult / rateLawText）を呼ぶ。
// 職員・区長・議員はすべて架空。所得税は「その年の税率表でざっくり計算した目安」として示す。
//
// 確かめた事実（2026-10 WebSearch）：
// - 立候補の届出：告示（公示）日の午前8時30分〜午後5時に、文書で選挙長へ。その前に書類の事前審査。
//   供託金は法務局（供託所）に供託し、供託証明書を添える。金額・没収点は politics.js（depositFor）
// - 選挙権・被選挙権：地方選挙の選挙権は、その市区町村に引き続き3か月以上住所のある18歳（2016年まで20歳）
//   以上。区議の被選挙権はその選挙権のある25歳以上。区長・知事・国会議員に住所の要件はない
// - 期日前投票：2003年6月の公選法改正で創設、12月1日施行。公示・告示日の翌日から投票日の前日まで、
//   宣誓書を書いて投票箱に直接入れる。それまでは不在者投票（封筒に入れて保管）
// - 住民票の写し：1通300円が多い（区の条例で決まる）。転入・転居の届出は14日以内（住民基本台帳法）
// - 所得税の最高税率：1999年37%、2007年40%、2015年45%。確定申告は2月16日〜3月15日。期限後は無申告加算税
// - 消費者金融の上限金利・総量規制・闇金の扱いは crime.js（rateLawText / LENDERS）の時代ごとの説明を使う

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { defineTile, R, P, Rw, oval, line, bevel, inset, grain, outline, shadowEllipse, speckle, dither } from '../engine/tiles.js';
import { text } from '../engine/draw.js';
import { makeCanvas, shade, mix, fmtMoney, clamp, hash2 } from '../engine/util.js';
import { registerSong } from '../engine/audio.js';
import { registerItem } from '../engine/state.js';
import { onMorning } from '../engine/life.js';
import { YEAR_DAYS } from '../engine/profile.js';
import * as POL from '../engine/politics.js';
import * as JUS from '../engine/crime.js';
import { VoteScene, seatKey, paintSeat, ZL, schematicLayout, seatParties, chairColor, memberLooks, exchange, Q_ROUNDS, actText } from './kokkai.js';

const PID = 'kuyakusho';
const T = (k) => `${PID}_${k}`;
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const GG = () => (typeof window !== 'undefined' && window.__game) || null;

// ------------------------------------------------------------------ palette
const WALL = '#e4e6dc', WALLL = '#f2f3ec', WALLD = '#c4c8bc', DADO = '#9aa49a';
const FLO = '#c9d0d4', FLOD = '#b6bec4', FLOL = '#d8dee2';
const DESK = '#d8d2c4', DESKD = '#a8a294', NAVY = '#2a3a5a';
const WOOD = '#a8784a', WOODL = '#c8986a', WOODD = '#7a5434';
const BLUE = '#3a6fb8', BLUED = '#2a5088';

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

// ------------------------------------------------------------------ tiles
tile('walltop', { solid: true, hd(c) { R(c, 0, 0, 32, 32, '#3a3f44'); R(c, 0, 30, 32, 2, '#2a2e32'); R(c, 0, 0, 32, 1, '#4a5056'); } });
tile('wall', {
  solid: true,
  hd(c, r) {
    R(c, 0, 0, 32, 32, WALL); speckle(c, r, [WALLL, WALLD], 14);
    R(c, 0, 0, 32, 2, WALLD); R(c, 0, 2, 32, 1, WALLL);
    R(c, 0, 19, 32, 2, DADO); R(c, 0, 19, 32, 1, '#b4bcb2');
    R(c, 0, 21, 32, 8, '#cfd4c8'); R(c, 0, 28, 32, 1, WALLD);
    R(c, 0, 29, 32, 3, '#8a9088'); R(c, 0, 29, 32, 1, '#a4aaa2');
  },
});
tile('window', {
  solid: true, obj: true,
  hd(c) {
    R(c, 5, 4, 22, 14, '#bfdcef'); R(c, 5, 4, 22, 1, '#9aa4aa'); R(c, 5, 4, 1, 14, '#9aa4aa'); R(c, 26, 4, 1, 14, '#9aa4aa');
    R(c, 15, 4, 2, 14, '#dfe4e8'); line(c, 7, 15, 12, 6, '#e8f4fb'); line(c, 19, 15, 24, 6, '#e8f4fb');
    R(c, 4, 17, 24, 2, '#f0f2f0'); R(c, 4, 18, 24, 1, '#c4c8c4');
  },
});
// cork notice board with notices (on a wall)
tile('board', {
  solid: true, obj: true,
  hd(c) {
    R(c, 3, 4, 26, 16, '#8a6a44'); R(c, 4, 5, 24, 14, '#c8a070'); dither(c, 4, 5, 24, 14, '#b88f62');
    for (const [x, y, w, h, col] of [[6, 7, 7, 9, '#ffffff'], [15, 6, 6, 6, '#ffe8a0'], [22, 8, 5, 8, '#cfe8ff'], [15, 13, 6, 5, '#ffd0d8']]) {
      R(c, x, y, w, h, col); R(c, x + 1, y + 2, w - 2, 1, '#9a9aa6'); R(c, x + 1, y + 4, w - 3, 1, '#9a9aa6'); P(c, x + Math.floor(w / 2), y, '#d63a3a');
    }
  },
});
tile('floor', {
  variants: 2,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, FLO); speckle(c, r, [FLOD, FLOL, '#c2c9ce'], 50);
    R(c, 0, 0, 32, 1, FLOD); R(c, 0, 0, 1, 32, FLOD); R(c, 0, 16, 32, 1, '#bfc6cb'); R(c, 16, 0, 1, 32, '#bfc6cb');
    if (v) { R(c, 2, 2, 13, 13, '#cdd4d8'); }
  },
});
tile('carpet', {
  hd(c, r) { R(c, 0, 0, 32, 32, '#3f6a7a'); speckle(c, r, ['#355e6e', '#4a7686', '#3a6474'], 60); },
});
tile('seat', { solid: true, hd(c, r) { R(c, 0, 0, 32, 32, '#355e6e'); speckle(c, r, ['#2e5464', '#3f6a7a'], 50); } });
tile('gwall', {
  solid: true,
  hd(c, r) {
    R(c, 0, 0, 32, 32, WOODL); grain(c, r, 0, 0, 32, 28, WOOD, 6, 6); grain(c, r, 0, 0, 32, 28, '#d8a878', 4, 5);
    for (const x of [0, 16]) R(c, x, 0, 1, 28, WOOD);
    R(c, 0, 28, 32, 4, WOODD); R(c, 0, 28, 32, 1, WOOD);
  },
});
// the fictional ward emblem (a big dot in a ring) on the assembly's front wall
tile('emblem', {
  solid: true,
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#d8c8a8'); grain(c, r, 0, 0, 32, 28, '#c8b490', 4, 6);
    for (let y = 6; y < 24; y++) for (let x = 7; x < 25; x++) { const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 15); if (d <= 8.5 && d >= 6.5) P(c, x, y, '#2a6a8a'); if (d <= 3.5) P(c, x, y, '#c83a3a'); }
    R(c, 0, 28, 32, 4, WOODD);
  },
});
// service counter with a number plate and a little bell (talk across it)
tile('counter', {
  solid: true, obj: true, talkThrough: true, variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 8, 32, 5, '#f4f4f0'); R(c, 0, 8, 32, 1, '#ffffff'); R(c, 0, 12, 32, 1, '#c8cac4');
    R(c, 0, 13, 32, 16, DESK); R(c, 0, 13, 32, 1, '#e8e4d8'); R(c, 0, 28, 32, 2, DESKD);
    R(c, 0, 20, 32, 2, BLUE); R(c, 0, 20, 32, 1, '#5a8ad0');
    if (v === 0) { R(c, 10, 2, 12, 7, NAVY); R(c, 11, 3, 10, 5, '#10182a'); R(c, 13, 4, 2, 3, '#ffd23f'); R(c, 17, 4, 2, 3, '#ffd23f'); R(c, 15, 9, 2, 2, '#6a6a6a'); }
    if (v === 1) { R(c, 6, 5, 9, 4, '#ffffff'); R(c, 7, 6, 7, 1, '#9a9aa6'); oval(c, 22, 5, 5, 4, '#d8b040'); P(c, 24, 4, '#f0d070'); }
    if (v === 2) { R(c, 8, 4, 4, 5, '#4a7a4a'); R(c, 18, 6, 8, 3, '#e8e0d0'); }
  },
});
// a row of waiting chairs
tile('chairs', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 28, 15, 2);
    R(c, 1, 22, 30, 2, '#6a6e74'); R(c, 4, 24, 2, 4, '#5a5e64'); R(c, 26, 24, 2, 4, '#5a5e64');
    for (let i = 0; i < 3; i++) {
      const x = 1 + i * 10;
      R(c, x + 1, 8, 8, 8, BLUE); R(c, x + 1, 8, 8, 1, '#6a9ae0'); R(c, x + 1, 15, 8, 1, BLUED);
      R(c, x, 15, 10, 6, BLUE); R(c, x, 15, 10, 1, '#5a8ad0'); R(c, x, 20, 10, 1, BLUED);
    }
    outline(c);
  },
});
// the queue ticket machine
tile('ticket', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 9, 2);
    bevel(c, 9, 4, 14, 24, '#e8eaee', '#ffffff', '#a8acb4');
    R(c, 11, 7, 10, 6, '#1a2a3a'); R(c, 12, 8, 3, 4, '#5ee07a'); R(c, 16, 8, 4, 2, '#ffd23f');
    R(c, 11, 16, 10, 3, '#d63a3a'); R(c, 11, 16, 10, 1, '#f06a6a');
    R(c, 12, 22, 8, 2, '#3a3e44'); R(c, 14, 24, 4, 2, '#ffffff');
    outline(c);
  },
});
// the writing booth (記載台) and the ballot box (投票箱)
tile('booth', {
  solid: true, obj: true, talkThrough: true,
  hd(c) {
    R(c, 0, 14, 32, 4, '#f0f0ec'); R(c, 0, 14, 32, 1, '#ffffff'); R(c, 0, 18, 32, 10, '#c8ccc8'); R(c, 0, 27, 32, 1, '#8a8e8a');
    for (const x of [0, 15, 30]) { R(c, x, 3, 2, 15, '#e8e8e4'); R(c, x, 3, 2, 1, '#ffffff'); R(c, x + 1, 4, 1, 14, '#b8bcb8'); }
    R(c, 5, 11, 6, 3, '#ffffff'); R(c, 20, 11, 6, 3, '#ffffff'); R(c, 8, 9, 1, 3, '#3a3a3a'); R(c, 23, 9, 1, 3, '#3a3a3a');
  },
});
tile('box', {
  solid: true, obj: true, talkThrough: true,
  hd(c) {
    shadowEllipse(c, 16, 28, 11, 2);
    R(c, 5, 16, 22, 11, '#7a7e86'); R(c, 6, 6, 20, 20, '#c0c4cc'); R(c, 6, 6, 20, 1, '#e8eaee'); R(c, 6, 6, 1, 20, '#dde0e6'); R(c, 25, 6, 1, 20, '#8a8e96');
    R(c, 10, 8, 12, 2, '#2a2e34'); R(c, 14, 15, 4, 4, '#d8b040'); P(c, 15, 16, '#5a4a20');
    R(c, 8, 21, 16, 3, '#ffffff'); R(c, 9, 22, 14, 1, '#d63a3a');
    outline(c);
  },
});
// consultation table with a low partition (talk across it)
tile('table', {
  solid: true, obj: true, talkThrough: true,
  hd(c) {
    R(c, 0, 2, 32, 9, '#d8dcd8'); R(c, 0, 2, 32, 1, '#f0f2f0'); R(c, 0, 10, 32, 1, '#a8aca8');
    R(c, 0, 12, 32, 5, '#e8e0d0'); R(c, 0, 12, 32, 1, '#fff8e8');
    R(c, 0, 17, 32, 10, WOOD); R(c, 0, 17, 32, 1, WOODL); R(c, 0, 26, 32, 1, WOODD);
    R(c, 6, 13, 8, 3, '#ffffff'); R(c, 20, 13, 6, 3, '#cfe8ff');
  },
});
// assembly furniture
tile('mdesk', {
  solid: true, obj: true, talkThrough: true,
  hd(c, r) {
    R(c, 0, 9, 32, 5, '#e8e0cc'); R(c, 0, 9, 32, 1, '#fff8e4');
    R(c, 0, 14, 32, 14, WOOD); grain(c, r, 0, 15, 32, 12, WOODD, 3, 5); R(c, 0, 14, 32, 1, WOODL); R(c, 0, 27, 32, 2, WOODD);
    R(c, 8, 6, 6, 4, '#ffffff'); R(c, 22, 5, 2, 5, '#2a2a2a');
  },
});
function daisPaint(part) {
  return (c, r) => {
    R(c, 0, 6, 32, 23, WOOD); grain(c, r, 0, 8, 32, 19, WOODD, 3, 6); R(c, 0, 6, 32, 2, WOODL);
    inset(c, 3, 11, 26, 14, WOOD, WOODL, WOODD);
    if (part === 'l') R(c, 0, 6, 2, 23, WOODD);
    if (part === 'r') R(c, 30, 6, 2, 23, WOODD);
    if (part === 'm') { R(c, 13, 15, 6, 6, '#c83a3a'); R(c, 14, 16, 4, 4, '#e86060'); }
    R(c, 0, 28, 32, 2, '#5a3a20');
  };
}
tile('dais_l', { solid: true, obj: true, talkThrough: true, hd: daisPaint('l') });
tile('dais_m', { solid: true, obj: true, talkThrough: true, hd: daisPaint('m') });
tile('dais_r', { solid: true, obj: true, talkThrough: true, hd: daisPaint('r') });
function rostrum(side) {
  return (c, r) => {
    shadowEllipse(c, side === 'l' ? 30 : 2, 28, 13, 3);
    const x0 = side === 'l' ? 8 : 0, w = 24;
    R(c, x0, 10, w, 18, WOOD); grain(c, r, x0, 12, w, 14, WOODD, 3, 5); R(c, x0, 8, w, 4, WOODL);
    if (side === 'l') { R(c, x0, 8, 1, 20, WOODD); R(c, 26, 2, 1, 7, '#2a2a2a'); oval(c, 24, 0, 5, 4, '#3a3a3a'); }
    else R(c, 31, 8, 1, 20, WOODD);
    outline(c);
  };
}
tile('rostrum_l', { solid: true, obj: true, hd: rostrum('l') });
tile('rostrum_r', { solid: true, obj: true, hd: rostrum('r') });
tile('bench', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 28, 14, 2);
    R(c, 1, 9, 30, 5, '#5a6a7a'); R(c, 1, 9, 30, 1, '#7a8a9a');
    R(c, 0, 15, 32, 7, '#6a7a8a'); R(c, 0, 15, 32, 1, '#8a9aaa'); R(c, 0, 21, 32, 1, '#4a5a6a');
    R(c, 3, 22, 2, 6, '#3a4250'); R(c, 27, 22, 2, 6, '#3a4250');
    outline(c);
  },
});
// a doorway in the bottom wall (to the elevator hall)
tile('door', {
  hd(c) {
    R(c, 0, 0, 32, 32, '#3a3f44');
    R(c, 3, 0, 26, 32, '#b8c0c6'); R(c, 3, 0, 26, 2, '#d8dee2'); R(c, 15, 0, 2, 32, '#8a9298');
    R(c, 3, 0, 2, 32, '#9aa2a8'); R(c, 27, 0, 2, 32, '#9aa2a8');
  },
});

// ------------------------------------------------------------------ items & music
registerItem('kuyakusho_juminhyo', { name: '住民票の写し', price: 0, desc: 'ドット区役所でとった住民票の写し。\n住所と名前が、きちんと記されている。' });
registerItem('kuyakusho_tohyo', { name: '投票済証', price: 0, desc: '投票所でもらった投票済証。\n小さな紙だけど、一票を投じたあかし。' });
registerSong('kuyakusho', {
  bpm: 96, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.07, notes: 'E5 - G5 - C6 - G5 - | A5 - - - G5 - E5 - | F5 - A5 - C6 - A5 - | G5 - - - - - . . | E5 - G5 - C6 - E6 - | D6 - - - C6 - A5 - | G5 - F5 - E5 - D5 - | C5 - - - - - . .' },
    { wave: 'triangle', vol: 0.06, notes: 'C3 G3 C3 G3 A2 E3 A2 E3 | F2 C3 F2 C3 G2 D3 G2 D3 | C3 G3 C3 G3 A2 E3 A2 E3 | F2 C3 G2 D3 C3 G3 C3 . ' },
  ],
});

// ------------------------------------------------------------------ helpers
const pol = (g) => { try { return typeof g.pol === 'function' ? g.pol() : null; } catch (e) { console.error(e); return null; } };
const today = (g) => (g.state && g.state.day) || 1;
const me = (g) => { const p = pol(g); return p ? p.me : null; };
function date(g, day) { try { return g.polDate(day); } catch (e) { return { year: 2026, month: 4, dom: 1, doy: 30, wareki: '', label: '' }; } }
const yearOf = (g) => date(g).year;
const WHO = {
  annai: { name: '総合案内の職員', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#5a8ad0', bottom: '#3b3f48', jacket: true } },
  jumin: { name: '住民課の職員', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#f0f0f0', bottom: '#3b3f48', tie: '#2f6fd0' } },
  jumin2: { name: '住民課の職員', look: { hair: 'long', hairColor: 'black', skin: 'light', top: '#f4e8d8', bottom: '#5a5f6b', skirt: true } },
  zeimu: { name: '税務課の職員', look: { hair: 'short', hairColor: 'gray', skin: 'fair', top: '#e8ecf0', bottom: '#3b3f48', tie: '#7a3a3a', glasses: true } },
  shinkoku: { name: '確定申告の相談員', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2a3a5a', bottom: '#2a3a5a', jacket: true, tie: '#c9a227' } },
  senkan: { name: '選挙管理委員会の職員', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3a4a6a', bottom: '#2a2d36', jacket: true, tie: '#2f8f4e' } },
  kijitsu: { name: '期日前投票所の係員', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#f4f4f0', bottom: '#3b3f48' } },
  tachiai: { name: '投票立会人', look: { ...LOOKS.oldman, top: '#6a7a6a' } },
  soudan: { name: '区民相談室の相談員', look: { hair: 'bob', hairColor: 'gray', skin: 'light', top: '#7a9a8a', bottom: '#3b3f48', glasses: true } },
  fukushi: { name: '福祉事務所のケースワーカー', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#e8d8b0', bottom: '#3b3f48' } },
  jimukyoku: { name: '区議会事務局の職員', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#2f3a4f', bottom: '#2f3a4f', jacket: true, tie: '#5a6a8a' } },
  gicho: { name: '区議会議長', look: { hair: 'bald', hairColor: 'gray', skin: 'tan', top: '#2a2f45', bottom: '#2a2f45', jacket: true, tie: '#7a1f2f', glasses: true } },
  kumin: { name: '順番待ちの区民', look: { ...LOOKS.mom, top: '#c8a8d8' } },
  student: { name: '大学生', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#5fa8a0', bottom: '#3b3f48' } },
};
const say = (w) => ({ name: w.name, look: w.look });
function npc(id, x, y, dir, w, extra = {}) { return { type: 'npc', id, x, y, dir, name: w.name, look: w.look, ...extra }; }
// A hanging sign over a counter (world units), drawn live so its text can change.
function plate(x, y, w, label, colors = ['#2a3a5a', '#ffffff']) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false, z: -40,
    draw(ctx, sx, sy, g) {
      const s = typeof label === 'function' ? label(g) : label;
      if (!s) return;
      const [bg, fg] = colors;
      const W = w * 16;
      R(ctx, sx + W / 2 - 0.5, sy - 2, 1, 3, '#6a6e74');
      R(ctx, sx + 1, sy + 1, W - 2, 11, '#1a1e24');
      R(ctx, sx + 1.5, sy + 1.5, W - 3, 10, bg); R(ctx, sx + 1.5, sy + 1.5, W - 3, 0.5, shade(bg, 0.3));
      text(ctx, s, sx + W / 2, sy + 2.5, { size: 7, align: 'center', color: fg, shadow: null });
    },
  };
}

// ------------------------------------------------------------------ the elevator
const FLOORS = [
  { label: '1階　総合窓口（住民課・税務課）', room: 'lobby', x: 11, y: 2, dir: 'down' },
  { label: '2階　選挙管理委員会・期日前投票所', room: 'senkan', x: 9, y: 7, dir: 'up' },
  { label: '3階　区民相談室（生活相談）', room: 'soudan', x: 7, y: 6, dir: 'up' },
  { label: '5階　区議会（議場・傍聴席）', room: 'gikai', x: 10, y: 11, dir: 'up' },
];
async function elevator(g, here, back = null) {
  const items = FLOORS.map((f) => ({ label: f.label, disabled: f.room === here }));
  const k = await g.list({ title: 'エレベーター', items: [...items, { label: 'やめる' }], x: 140, y: 70, w: 360, px: true });
  const f = FLOORS[k];
  if (!f || f.room === here) { if (back) await g.movePlayer([back]); return; }
  g.sfx('chime');
  await g.goto(PID, f.room, f.x, f.y, f.dir);
}

// ------------------------------------------------------------------ 住民課
async function juminTalk(g) {
  const w = say(WHO.jumin);
  const reg = g.flag('kuya_jumin');
  const year = yearOf(g);
  const first = !reg ? '転入届を出す' : reg.housing !== g.state.housing ? '転居届を出す' : '住民票の写し';
  const items = [first, first === '住民票の写し' ? (year >= 2016 ? 'マイナンバー' : '印鑑登録') : '住民票の写し', 'なんでもない'];
  const k = await g.ask(['住民課です。住民票や戸籍、引っ越しの届出の窓口です。', '番号札をお取りのうえ、お待ちくださいね。'], items, { ...w, cancel: 2 });
  const pick = items[k];
  if (pick === '転入届を出す' || pick === '転居届を出す') {
    const tennyu = pick === '転入届を出す';
    await g.say([tennyu ? 'ほかの市区町村から、ドット区に引っ越してきたんですね。\n転入届は、住み始めてから14日以内が決まりです。' : '区内でのお引っ越しですね。\n転居届は、引っ越しから14日以内にお願いします。', '届出書に、新しい住所と、前の住所を書いてください。'], w);
    g.setFlag('kuya_jumin', { day: today(g), housing: g.state.housing });
    g.sfx('ok');
    await g.say(['はい、受け付けました。これで住民票の住所が\nドット区になりました。', '選挙人名簿にも、引き続き3か月以上住んでいると\n登録されます。区の選挙で投票できるようになりますよ。'], w);
    return;
  }
  if (pick === '住民票の写し') {
    const price = 300;
    const c = await g.ask(`住民票の写しは、1通¥${price}です。\n（手数料は区の条例で決まっています）`, ['1通ください', 'やめておく'], { ...w, cancel: 1 });
    if (c !== 0) return;
    if (!g.spend(price)) { await g.say('（お金が足りない…）'); return; }
    g.sfx('coin');
    g.giveItem('kuyakusho_juminhyo', 1, true);
    await g.say(['お待たせしました。住民票の写しです。', '（「住民票の写し」を受け取った）'], w);
    return;
  }
  if (pick === 'マイナンバー') {
    await g.say(['マイナンバーは、2015年から一人ひとりに通知されている\n12けたの番号です。カードは2016年から交付しています。', 'カードがあれば、コンビニで住民票の写しもとれますよ。\n番号は大切な個人情報です。人に教えないでくださいね。'], w);
    return;
  }
  if (pick === '印鑑登録') {
    await g.say(['印鑑登録をすると、その印鑑が「実印」になります。', '家を借りたり買ったりするとき、\n印鑑登録証明書が必要になることがありますよ。'], w);
    return;
  }
  await g.say('またどうぞ。', w);
}

// ------------------------------------------------------------------ 税務課・確定申告
// Income tax (the 速算表 of the time, simplified: 白色申告, only the basic deduction).
const TAX_TABLES = [
  [1999, [[3300000, 0.10, 0], [9000000, 0.20, 330000], [18000000, 0.30, 1230000], [Infinity, 0.37, 2490000]]],
  [2007, [[1950000, 0.05, 0], [3300000, 0.10, 97500], [6950000, 0.20, 427500], [9000000, 0.23, 636000], [18000000, 0.33, 1536000], [Infinity, 0.40, 2796000]]],
  [2015, [[1950000, 0.05, 0], [3300000, 0.10, 97500], [6950000, 0.20, 427500], [9000000, 0.23, 636000], [18000000, 0.33, 1536000], [40000000, 0.40, 2796000], [Infinity, 0.45, 4796000]]],
];
const OLD_TABLE = [[3000000, 0.10, 0], [6000000, 0.20, 300000], [10000000, 0.30, 900000], [20000000, 0.40, 1900000], [Infinity, 0.50, 3900000]]; // 1989-1998 (1987-88: 目安)
function tableFor(y) {
  let t = OLD_TABLE;
  for (const [from, tb] of TAX_TABLES) if (y >= from) t = tb;
  return t;
}
const basicDeduction = (y) => (y >= 2025 ? 580000 : y >= 2020 ? 480000 : y >= 1995 ? 380000 : y >= 1989 ? 350000 : 330000);
// internal money -> the year's yen and back (tax brackets are in nominal yen of that year)
const rateOf = (g) => { const e = g.state && g.state.profile && g.state.profile.era; return { showa: 0.6, heisei_early: 0.75, heisei: 0.85 }[e] || 1; };
function incomeTax(g, y, income) {
  const r = rateOf(g);
  const nominal = income * r;
  const taxable = Math.max(0, Math.floor((nominal * 0.7 - basicDeduction(y)) / 1000) * 1000);
  const row = tableFor(y).find((t) => taxable <= t[0]);
  let tax = Math.max(0, taxable * row[1] - row[2]);
  if (y >= 2013 && y <= 2037) tax *= 1.021; // 復興特別所得税
  return { taxable: taxable / r, tax: Math.floor(tax / 100) * 100 / r, top: row[1] };
}
// Income recorded by crime.js (g.addMoney) during year y (scaled up when part of the year is missing).
function incomeOf(g, y) {
  let j = null;
  try { j = g.jus(); } catch (e) { j = null; }
  const list = (j && j.income) || [];
  let sum = 0, first = Infinity;
  for (const [d, n] of list) if (date(g, d).year === y) { sum += num(n); first = Math.min(first, d); }
  if (!sum) return 0;
  const startOfYear = today(g) - date(g).doy - YEAR_DAYS; // day 1 of last year (approx.)
  const covered = clamp(startOfYear + YEAR_DAYS - Math.max(first, startOfYear), 20, YEAR_DAYS);
  return Math.round((sum * YEAR_DAYS) / covered);
}
function taxSeason(g) {
  const d = date(g);
  if ((d.month === 2 && d.dom >= 16) || (d.month === 3 && d.dom <= 15)) return 'season';
  if (d.month === 1 || (d.month === 2 && d.dom < 16)) return 'before';
  return 'late';
}
async function shinkokuTalk(g) {
  const w = say(WHO.shinkoku);
  const y = yearOf(g) - 1;
  const done = (g.flag('kuya_tax') || {})[y];
  const season = taxSeason(g);
  await g.say(['ドット税務署の、確定申告の相談窓口です。', '所得税の確定申告は、毎年2月16日から3月15日まで。\n前の年（1月〜12月）の所得と税金を、自分で計算して申告します。'], w);
  if (done) { await g.say(`${y}年分の申告は、${date(g, done.day).short}に済んでいますね。\nおつかれさまでした。`, w); return; }
  if (season === 'before') { await g.say(`${y}年分の申告の受付は、2月16日からです。\n領収書を整理して、お待ちくださいね。`, w); return; }
  const income = incomeOf(g, y);
  const t = incomeTax(g, y, income);
  const late = season === 'late';
  const lines = [`${y}年分の収入は、記録によるとおよそ${fmtMoney(income)}。`, `経費（衣装・交通・レッスン代など）を3割として、\n基礎控除を引くと、所得税はおよそ${fmtMoney(t.tax)}です。`, '（社会保険料などの控除は省いた、ざっくりとした目安です）'];
  if (late) lines.push('もう申告期限（3月15日）を過ぎています。\n期限後申告になるので、無申告加算税と延滞税がかかります。');
  if (t.tax <= 0) {
    await g.say([...lines.slice(0, 1), '所得が控除の範囲に収まるので、所得税はかかりません。\n申告だけしておきましょう。'], w);
    g.setFlag('kuya_tax', { ...(g.flag('kuya_tax') || {}), [y]: { day: today(g), income, tax: 0 } });
    g.sfx('ok');
    return;
  }
  const k = await g.ask(lines, ['正直に申告する', '収入を少なく書く', '今日はやめておく'], { ...w, cancel: 2 });
  if (k === 2) { await g.say(late ? 'お早めに。遅れるほど延滞税がふえますよ。' : '期限は3月15日です。お忘れなく。', w); return; }
  let hidden = 0;
  if (k === 1) {
    const law = typeof g.crimeLaw === 'function' ? g.crimeLaw('tax_evasion', {}) : '所得税法違反（ほ脱）';
    const c = await g.ask(['（収入の一部を書かずに申告すれば、税金は安くなる。\n…でもそれは「脱税」だ）', law, '税務署は、取引先の支払調書や銀行口座とも突き合わせる。'], ['やっぱり正直に書く', '3割少なく書く', '半分しか書かない'], { cancel: 0 });
    hidden = c === 1 ? 0.3 : c === 2 ? 0.5 : 0;
  }
  const rep = incomeTax(g, y, income * (1 - hidden));
  const evaded = Math.max(0, t.tax - rep.tax);
  let due = rep.tax;
  if (late) due = Math.round(due * 1.2);
  await g.say(hidden ? `（申告書には、収入を${fmtMoney(Math.round(income * (1 - hidden)))}と書いた…）` : '（申告書に、すべての収入を書いた）');
  const res = typeof g.fine === 'function'
    ? await g.fine(due, `${y}年分の所得税${late ? '（期限後申告・加算税込み）' : ''}`, { kind: 'tax' })
    : (g.spend(due) ? { paid: due, unpaid: 0 } : { paid: 0, unpaid: due });
  g.setFlag('kuya_tax', { ...(g.flag('kuya_tax') || {}), [y]: { day: today(g), income, tax: due, hidden } });
  if (res && res.unpaid > 0) await g.say(['全額は納められませんでしたね。', '残りは、あとで納めてください。\n滞納が続くと、財産の差押えになることもあります。'], w);
  else await g.say(['受け付けました。納税、ありがとうございました。', '住民税（区民税・都民税）は、この申告をもとに\n区が計算して、6月ごろに通知が届きます。'], w);
  if (hidden && evaded > 0 && typeof g.commitCrime === 'function') await g.commitCrime('tax_evasion', { amount: evaded, where: 'ドット区役所（確定申告）' });
  if (!hidden) g.relax({ stress: 3 });
}
async function zeimuTalk(g) {
  const w = say(WHO.zeimu);
  const k = await g.ask(['税務課です。区民税・都民税（住民税）と、\n軽自動車税などを担当しています。'], ['住民税のこと', '確定申告は？', '払えないとき', 'なんでもない'], { ...w, cancel: 3 });
  if (k === 0) await g.say([yearOf(g) >= 2007 ? '住民税は、前の年の所得にかかる税金です。\n所得の10%（区民税6%・都民税4%）が目安です。' : '住民税は、前の年の所得にかかる税金です。\n区民税と都民税があり、所得が多いほど税率が上がります。', '会社員なら給料から天引き。フリーの方は、\n確定申告の内容をもとに、区から納付書が届きます。'], w);
  else if (k === 1) await g.say(['所得税の確定申告は、税務署の仕事ですが、\n毎年2月16日〜3月15日は、となりに臨時の相談窓口があります。', 'お仕事のギャラは、きちんと申告してくださいね。'], w);
  else if (k === 2) await g.say(['払えないときは、黙っていないで相談してください。\n分割で納める方法もあります。', '何も連絡がないまま滞納が続くと、督促のあと、\n預金や給料の差押えになることがあります。'], w);
  else await g.say('またどうぞ。', w);
}

// ------------------------------------------------------------------ 選挙管理委員会
function electionsOf(g) {
  let list = [];
  try { list = g.upcomingElections(); } catch (e) { console.error(e); }
  return list.filter((e) => !e.newsOnly && e.kind !== 'sosaisen' && e.office);
}
const OFFICE_NOTE = {
  kugi: { age: 25, home: true, where: 'ドット区選挙管理委員会' },
  togi: { age: 25, home: true, where: '東京都選挙管理委員会（選挙長）' },
  shicho: { age: 25, home: false, where: 'ドット区選挙管理委員会' },
  chiji: { age: 30, home: false, where: '東京都選挙管理委員会' },
  shugi: { age: 25, home: false, where: '小選挙区の選挙長（東京都選挙管理委員会）' },
  sangi: { age: 30, home: false, where: '選挙区の選挙長（東京都選挙管理委員会）' },
};
function officeName(off) { return (POL.OFFICES && POL.OFFICES[off] && POL.OFFICES[off].label) || off; }
async function senkanTalk(g) {
  const w = say(WHO.senkan);
  const items = ['選挙の予定', '立候補の届出', '立候補をやめる', '被選挙権と供託金', '選挙運動のきまり', 'なんでもない'];
  const k = await g.list({ title: '選挙管理委員会', items, x: 160, y: 60, w: 300, px: true });
  const pick = items[k];
  if (pick === '選挙の予定') await schedule(g);
  else if (pick === '立候補の届出') await rikkouho(g);
  else if (pick === '立候補をやめる') await withdraw(g);
  else if (pick === '被選挙権と供託金') await eligibilityInfo(g);
  else if (pick === '選挙運動のきまり') await campaignRules(g);
  else await g.say('選挙のことなら、いつでもどうぞ。', w);
}
async function schedule(g) {
  const w = say(WHO.senkan);
  const list = electionsOf(g);
  if (!list.length) { await g.say('いまのところ、予定されている選挙はありません。', w); return; }
  const pages = list.slice(0, 6).map((e) => `${e.label}\n${e.kind === 'shugi' || e.kind === 'sangi' ? '公示' : '告示'}：${e.kojiDate}　投票：${e.date}${e.declared ? '\n（あなたが立候補を届け出ている）' : ''}`);
  await g.say(['選挙の予定です。', ...pages], w);
}
async function rikkouho(g) {
  const w = say(WHO.senkan);
  const list = electionsOf(g).filter((e) => today(g) <= e.koji);
  const mine = electionsOf(g).find((e) => e.declared);
  if (mine) { await g.say([`${mine.label}に、立候補を届け出ていますね。`, `投票日は${mine.date}です。ご健闘を。`], w); return; }
  if (!list.length) { await g.say(['いま届出を受け付けられる選挙はありません。', '（届出は、公示・告示の日まで）'], w); return; }
  await g.say(['立候補の手続きをご案内します。', 'まず立候補予定者説明会に出て、書類の事前審査を受けます。\n届出は告示（公示）の日の、午前8時30分から午後5時まで。', '供託金は法務局（供託所）に納め、その証明書を添えます。\n得票が一定に届かないと、供託金は没収されます。', '（ゲームでは、告示日までにこの窓口で手続きすれば\n届出したことになります。供託金もここで納めます）'], w);
  const items = list.slice(0, 7).map((e) => ({ label: e.label.length > 15 ? e.label.slice(0, 14) + '…' : e.label, right: fmtMoney(typeof g.depositInternal === 'function' ? g.depositInternal(e.office) : 0) }));
  const k = await g.list({ title: 'どの選挙に立候補する？', items: [...items, { label: 'やめる' }], x: 100, y: 56, w: 440, px: true, describe: (i) => (i < list.length ? `${list[i].label}：告示 ${list[i].kojiDate}・投票 ${list[i].date}（供託金は右）` : 'またにする') });
  const e = list[k];
  if (!e) return;
  const note = OFFICE_NOTE[e.office] || { age: 25 };
  const why = g.eligible(e.office);
  if (why) { await g.say([`${officeName(e.office)}の被選挙権は、満${note.age}歳以上です。`, `申し訳ありません。${why}`], w); return; }
  const opts = {};
  const m = me(g);
  // 公認 / 推薦
  if (m && m.party) {
    const pn = g.partyName(m.party);
    const c = await g.ask([`${pn}の党員ですね。`, `党の${e.office === 'shicho' || e.office === 'chiji' ? '推薦' : '公認'}を申請しますか？\n（党の選考に通らなければ、無所属で出ることになります）`], ['申請する', '無所属で出る'], { ...w, cancel: 1 });
    if (c === 0) {
      const r = g.requestNomination(e.id);
      if (r && r.ok) { opts.party = m.party; await g.say(`（${pn}の${r.kind}が決まった！）`); }
      else { opts.party = null; await g.say([`（${(r && r.why) || '党の選考で見送られた'}）`, '（無所属で立候補することにした）']); }
    } else opts.party = null;
  }
  // 衆院・参院: 比例代表の扱い / ふるさと
  if (e.office === 'shugi' && opts.party) {
    const c = await g.ask(['衆議院は、小選挙区と比例代表の並立制です（1996年から）。\n小選挙区で落選しても、比例で復活できる「重複立候補」も。'], ['小選挙区だけ', '重複立候補', '比例代表だけ'], { ...w, cancel: 0 });
    if (c === 1) opts.proportional = true;
    if (c === 2) opts.proportional = 'only';
  } else if (e.office === 'sangi' && opts.party) {
    const c = await g.ask(['参議院は、選挙区と全国比例のどちらかで立候補します。'], ['選挙区', '全国比例'], { ...w, cancel: 0 });
    if (c === 1) opts.proportional = true;
  }
  const home = g.state.profile && g.state.profile.hometown;
  if ((e.office === 'shugi' || e.office === 'sangi') && home && home !== 'tokyo' && opts.proportional !== 'only' && !(e.office === 'sangi' && opts.proportional)) {
    const c = await g.ask('ふるさとの選挙区から立候補することもできます。\n（地元の知名度が生きるかもしれません）', ['東京から出る', 'ふるさとから出る'], { ...w, cancel: 0 });
    if (c === 1) opts.hometown = true;
  }
  const dep = typeof g.depositInternal === 'function' ? g.depositInternal(e.office, { pr: opts.proportional === 'only' }) : 0;
  const c = await g.ask([`${e.label}に立候補します。`, `供託金は${fmtMoney(dep)}。政治資金から、足りなければ所持金から納めます。${note.home ? '\n（この選挙は、その地域に3か月以上住んでいることも条件です）' : ''}`], ['届け出る', 'やめておく'], { ...w, cancel: 1 });
  if (c !== 0) return;
  const r = g.declareCandidacy(e.id, opts);
  if (r) { await g.say(`申し訳ありません。届出を受理できませんでした。\n（${r}）`, w); return; }
  g.sfx('fanfare');
  await g.say(['届出を受理しました。', `${e.kojiDate}の${e.office === 'shugi' || e.office === 'sangi' ? '公示' : '告示'}から、選挙運動ができます。\n投票日は${e.date}です。`, '告示の前に「投票してください」と頼むのは事前運動で、\n禁止されています。いまは、ふだんの政治活動だけです。', 'ポスターは、区が設ける公営の掲示場に。\n戸別訪問や、物やお金を配ることは犯罪です。'], w);
}
async function withdraw(g) {
  const w = say(WHO.senkan);
  const mine = electionsOf(g).find((e) => e.declared);
  if (!mine) { await g.say('立候補の届出は、出ていないようです。', w); return; }
  const after = today(g) >= mine.koji;
  const c = await g.ask([`${mine.label}の立候補をやめますか？`, after ? '告示・公示のあとの辞退なので、供託金は戻りません。' : '告示・公示の前なので、供託金はお返しします。'], ['やめない', '立候補をやめる'], { ...w, cancel: 0 });
  if (c !== 1) return;
  const r = g.withdrawCandidacy(mine.id);
  await g.say(r ? `（${r}）` : '（立候補をとりやめた）', w);
}
async function eligibilityInfo(g) {
  const w = say(WHO.senkan);
  const y = yearOf(g);
  const dep = (off) => (typeof POL.depositFor === 'function' ? `${Math.round(POL.depositFor(off, y) / 10000)}万円` : '');
  await g.say([
    '【被選挙権（立候補できる年齢）】\n区議・区長・都議・衆議院議員：満25歳以上\n知事・参議院議員：満30歳以上',
    `【選挙権】満${y >= 2016 ? 18 : 20}歳以上（2016年から18歳）。\n区議・区長の選挙は、区に引き続き3か月以上住んでいる人。`,
    `【供託金（${y}年）】区議${dep('kugi')}・区長${dep('shicho')}・都議${dep('togi')}\n知事${dep('chiji')}・衆院小選挙区${dep('shugi')}・参院選挙区${dep('sangi')}`,
    '得票が一定に届かないと、供託金は没収されます。\n（区議は有効投票÷定数の10分の1、区長・知事・衆院小選挙区は\n有効投票の10分の1など）',
    '禁錮以上の刑の執行中や、選挙違反などで\n公民権が停止されている間は、立候補も投票もできません。',
  ], w);
}
async function campaignRules(g) {
  const w = say(WHO.senkan);
  const y = yearOf(g);
  await g.say([
    '選挙運動ができるのは、告示（公示）日に届け出てから\n投票日の前日まで。それより前は「事前運動」として禁止です。',
    'できること：街頭演説・選挙カー・公営掲示場のポスター・\n個人演説会・決められた枚数のビラやはがき。',
    y >= 2013 ? 'インターネットでの選挙運動も、2013年から認められています。\n（候補者個人の有料ネット広告は禁止）' : 'インターネットを使った選挙運動は、まだ認められていません。',
    'してはいけないこと：戸別訪問、お金や物を配る買収、\n18歳未満の選挙運動。違反すると罰則と公民権停止。',
  ], w);
}

// ------------------------------------------------------------------ 期日前投票
const kijitsuName = (g) => (yearOf(g) >= 2004 || (yearOf(g) === 2003 && date(g).month === 12) ? '期日前投票' : '不在者投票');
// Elections a resident of ドット区 votes in (a by-election elsewhere is not ours).
const ourElection = (e) => e.kind !== 'hosen' || /東京/.test(`${e.district || ''}${e.label || ''}`);
function votable(g) {
  const d = today(g);
  return electionsOf(g).filter((e) => ourElection(e) && (d === e.day || (d > e.koji && d < e.day)));
}
async function kijitsuTalk(g) {
  const name = kijitsuName(g);
  const w = { name: `${name}の係員`, look: WHO.kijitsu.look };
  const list = votable(g);
  if (!list.length) {
    const next = electionsOf(g).find(ourElection);
    await g.say([`${name}の投票所です。`, next ? `次の選挙は「${next.label}」。\n${name}ができるのは、公示・告示の翌日から投票日の前日までです。` : 'いまは、投票できる選挙はありません。'], w);
    return;
  }
  if (typeof g.civicBanned === 'function' && g.civicBanned()) { await g.say(['申し訳ありません。公民権が停止されている間は、\n投票できません。'], w); return; }
  const e = list[0];
  const onDay = today(g) === e.day;
  await g.say(onDay ? [`今日は「${e.label}」の投票日です。`, 'この区役所も、当日の投票所になっています。\n入場券をお持ちですか？'] : [`「${e.label}」の${name}ですね。`, name === '期日前投票' ? '投票日に仕事や用事で投票所に行けない見込みであることを、\nこの宣誓書に書いてください。' : '投票日に行けない理由を書いて、投票用紙を受け取ります。\n用紙は封筒に入れて、投票日まで保管されます。'], w);
  if (!onDay) {
    const r = await g.ask('（宣誓書の理由は…）', ['仕事', '旅行・用事', 'その他'], { cancel: 0 });
    await g.say(`（宣誓書に「${['仕事', '旅行・用事', 'その他'][r]}」と書いた）`);
  }
  const p = pol(g);
  const parties = p ? Object.keys(p.parties).filter((id) => p.parties[id]) : [];
  const items = parties.map((id) => ({ label: `${g.partyName(id)}${e.office === 'shugi' || e.office === 'sangi' ? '' : 'の候補'}` }));
  const m = me(g);
  if (e.declared) items.unshift({ label: `${g.state.name}（自分）` });
  items.push({ label: '白票（何も書かない）' });
  g.placePlayer(15, 4, 'up');
  const k = await g.list({ title: '投票用紙に書く', items, x: 120, y: 60, w: 400, px: true, describe: () => '記載台で、候補者や政党の名前を書きます。だれに投票したかは秘密です。' });
  if (k < 0) { await g.say('（迷って、書けなかった…。また来よう）'); return; }
  let choice = null;
  if (e.declared && k === 0) choice = 'player';
  else if (k < items.length - 1) choice = parties[k - (e.declared ? 1 : 0)];
  const why = g.castVote(e.id, choice);
  if (why) { await g.say(`（${why}）`); return; }
  g.placePlayer(14, 5, 'right');
  g.sfx('ok');
  if (name === '期日前投票' || onDay) await g.say(['（投票用紙を折って、投票箱に入れた。ストン）', '投票立会人「…はい、確かに」']);
  else await g.say(['（投票用紙を内封筒に入れて封をし、外封筒に入れて係員に渡した）', `${name}の係員「投票日まで、大切に保管します」`]);
  if (!g.hasItem('kuyakusho_tohyo')) g.giveItem('kuyakusho_tohyo', 1, true);
  g.relax({ stress: 4 });
  await g.say(['ご投票ありがとうございました。', '（一票を投じた。小さな一票でも、この国の行き先を\n決める一票だ。なんだか背すじがのびる）'], w);
  if (m && m.office && e.declared) await g.say('（自分の名前を書くのは、ちょっと照れくさい）');
}

// ------------------------------------------------------------------ 区民相談室（生活相談）
async function soudanTalk(g) {
  const w = say(WHO.soudan);
  const items = ['借金の相談', '闇金に困っている', '自己破産のこと', 'お金のしくみ', 'なんでもない'];
  const k = await g.ask(['区民相談室です。暮らしの困りごとは、\nひとりで抱えこまずに相談してください。相談は無料です。'], items, { ...w, cancel: 4 });
  const pick = items[k];
  let loans = 0;
  try { loans = typeof g.loanTotal === 'function' ? g.loanTotal() : 0; } catch (e) { loans = 0; }
  if (pick === '借金の相談') {
    await g.say(['借金が返せなくなる「多重債務」は、\n解決の方法が必ずあります。', loans > 0 ? `いまの借入れは、合計${fmtMoney(loans)}ですね。` : 'いまは借入れはないようですね。予防の話をしましょう。', typeof JUS.rateLawText === 'function' ? `${JUS.rateLawText(g)}。` : ''].filter(Boolean), w);
    if (loans > 0) {
      const c = await g.ask('弁護士の相談窓口を紹介しましょうか？\n（利息のカットや分割払いの交渉、自己破産など）', ['紹介してほしい', 'いまはいい'], { ...w, cancel: 1 });
      if (c === 0 && typeof g.consultLawyer === 'function') await g.consultLawyer('debt');
    }
    return;
  }
  if (pick === '闇金に困っている') {
    await g.say(['登録のない業者が、法律の上限をはるかに超える利息で\n貸すのが「闇金」。トイチ（10日で1割）などは違法です。', '闇金との契約は無効で、元金も含めて返す必要はないとされて\nいます（最高裁 平成20年）。脅しの取り立ても犯罪です。', 'すぐに警察の生活安全課か、弁護士に相談してください。'], w);
    const c = await g.ask('どこに相談しますか？', ['弁護士に相談', '警察に相談', 'いまはいい'], { ...w, cancel: 2 });
    if (c === 0 && typeof g.consultLawyer === 'function') await g.consultLawyer('yamikin');
    else if (c === 1 && typeof g.policeConsult === 'function') await g.policeConsult('yamikin');
    return;
  }
  if (pick === '自己破産のこと') {
    await g.say(['自己破産は、裁判所に「支払えない」と認めてもらい、\n借金の支払いを免除してもらう（免責）手続きです。', '生活に必要な財産は残せます。ただ、税金や罰金は\n免除されず、信用情報に記録が残り、官報にも載ります。', 'ほかに、利息をカットする任意整理、借金を減らして\n3年で返す個人再生（2001年から）もあります。'], w);
    if (loans > 0) {
      const c = await g.ask('裁判所での手続きを、弁護士と進めますか？', ['まだ考える', '手続きを進める'], { ...w, cancel: 0 });
      if (c === 1 && typeof g.fileBankruptcy === 'function') await g.fileBankruptcy();
    }
    return;
  }
  if (pick === 'お金のしくみ') {
    await g.say(['消費者金融は、国に登録した貸金業者。\n金利の上限も、借りられる額の上限も法律で決まっています。', '「審査なし」「ブラックでもOK」とうたうのは闇金です。\n電話一本で貸すと言われても、絶対に借りないで。', '生活がどうしても苦しいときは、生活保護という制度もあります。\n憲法25条が保障する、国民の権利です。'], w);
    return;
  }
  await g.say('いつでもいらしてくださいね。', w);
}
async function fukushiTalk(g) {
  const w = say(WHO.fukushi);
  await g.say(['福祉事務所のケースワーカーです。', '仕事を失った、病気で働けない…そんなときは、\n生活保護や、住まいの給付金などの制度があります。', '「恥ずかしい」と思わずに、まず相談してください。\n生活に困ったときに助け合うための、社会のしくみです。'], w);
}

// ------------------------------------------------------------------ 区議会
const TEIREI = [2, 6, 9, 11];
function teireikai(g) {
  const d = date(g);
  return TEIREI.includes(d.month) && d.dom <= 16 ? { month: d.month, key: `${d.year}_${d.month}` } : null;
}
const isKugi = (g) => { const m = me(g); return !!(m && m.office === 'kugi'); };
const isKucho = (g) => { const m = me(g); return !!(m && m.office === 'shicho'); };
function kuchoName(g) {
  const p = pol(g);
  const id = p && p.local && p.local.kucho && p.local.kucho.holder;
  if (id === 'player') return g.state.name;
  try { return String(g.npcName(id) || '区長').split(' ')[0]; } catch (e) { return '区長'; }
}
function kuchoLook(g) {
  const p = pol(g);
  const id = p && p.local && p.local.kucho && p.local.kucho.holder;
  if (id === 'player') return g.state.look;
  return (p && p.npcs && p.npcs[id] && p.npcs[id].look) || LOOKS.oldman;
}
function localBill(g) {
  const d = date(g);
  const nendo = String(d.wareki || `${d.year}年`).replace('年', '年度');
  if (d.month === 2) return { title: `${nendo}ドット区一般会計予算`, kind: 'budget', sponsor: 'cabinet' };
  if (d.month === 6) return { title: 'ドット区子ども医療費助成条例の一部を改正する条例', kind: 'law', sponsor: 'cabinet' };
  if (d.month === 9) return { title: `ドット区一般会計補正予算（第2号）`, kind: 'budget', sponsor: 'cabinet' };
  return { title: 'ドット区自転車の安全利用に関する条例', kind: 'law', sponsor: 'cabinet' };
}
// 区長与党 (the parties backing the mayor) say yes; the rest by a simple reading.
function localLine(g, pid, b) {
  const p = pol(g);
  const backers = (p && p.local && p.local.kucho && p.local.kucho.backers) || [];
  if (backers.includes(pid)) return 'yes';
  if (pid === 'ind') return 'yes';
  return b.kind === 'budget' ? 'no' : hash2(pid.length, today(g), 3) < 0.6 ? 'yes' : 'no';
}
function localResult(g, b, mine) {
  const p = pol(g);
  const seats = (p && p.local && p.local.kugi && p.local.kugi.seats) || {};
  let yes = 0, no = 0;
  for (const [pid, n] of Object.entries(seats)) { if (localLine(g, pid, b) === 'yes') yes += num(n); else no += num(n); }
  const m = me(g);
  if (mine && m && m.office === 'kugi') {
    const line = localLine(g, m.party || 'ind', b);
    if (line === 'yes') yes--; else no--;
    if (mine === 'yes') yes++; else if (mine === 'no') no++;
  }
  yes = Math.max(0, yes); no = Math.max(0, no);
  return { yes, no, absent: 0, passed: yes > no };
}
const LOCAL_VOTE_SEATS = schematicLayout(320, 110, 92, 214, 4, 0.62, 30);
async function localVote(g, b, mine) {
  const v = localResult(g, b, mine);
  const sc = new VoteScene(g, { seats: LOCAL_VOTE_SEATS, mineAt: [345, 210], house: 'kugi', local: true, title: 'ドット区議会 本会議', bill: b, v, method: 'kiritsu', mine, member: isKugi(g), lineOf: (pid) => localLine(g, pid, b) });
  g.push(sc);
  const gw = say(WHO.gicho);
  await g.say([`${b.title}を議題といたします。`, '本案に賛成の方の起立を求めます。'], gw);
  sc.phase = 'count';
  await g.waitFrames(80);
  sc.prog = 1; sc.phase = 'result';
  await g.waitFrames(20);
  await g.say(v.passed ? '起立多数。よって、本案は原案のとおり可決されました。' : '起立少数。よって、本案は否決されました。', gw);
  g.sfx(v.passed ? 'applause' : 'drum');
  g.pop(sc);
  return v;
}
const LOCAL_TOPICS = ['保育園の待機児童', '商店街のにぎわい', '木造住宅の多い地域の防災', 'ひとり暮らしの高齢者の見守り', '子どもの放課後の居場所', '自転車の交通安全'];
async function ippanShitsumon(g) {
  const t = teireikai(g);
  const done = g.flag('kuya_q');
  if (done === t.key) { await g.say('（この定例会の一般質問は、もう終えた）'); return; }
  const topic = LOCAL_TOPICS[Math.floor(hash2(today(g), 4, 9) * LOCAL_TOPICS.length)];
  const kucho = { name: `${kuchoName(g)}区長`, look: kuchoLook(g) };
  const gw = say(WHO.gicho);
  g.placePlayer(10, 6, 'up');
  await g.say(`一般質問を行います。${(g.state.profile && g.state.profile.familyName) || g.state.name}議員。`, gw);
  const score = await exchange(g, Q_ROUNDS, {
    title: 'ドット区議会　一般質問', sub: `質問：${g.state.name}議員`, topic,
    prompt: ['（最初の質問は…）', '（区長の答弁は、まだ具体的ではない…）', '（残り時間で、どう締める？）'],
    selfSay: { name: g.state.name, look: g.state.look },
    after: [
      async () => { await g.say(`${topic}につきましては、区としても重要な課題と\n認識しており、関係部署と連携してまいります。`, kucho); },
      async (s) => { await g.say(s >= 25 ? '…ご指摘を受け、来年度予算での対応を検討いたします。' : '…ご意見として、承っておきます。', kucho); },
      async () => { await g.say('以上で、一般質問を終わります。', gw); },
    ],
  });
  g.setFlag('kuya_q', t.key);
  const r = g.activity('議会で質問', { score });
  await g.say([actText(r), score >= 75 ? '（区報やケーブルテレビでも紹介されそうだ）' : '（もっと地元の声を集めて、次に生かそう）']);
}
async function seatEvent(g) {
  if (!isKugi(g)) { await g.say('区議会議員の議席だ。木の机に、名札が立っている。'); return; }
  const t = teireikai(g);
  if (!t) { await g.say(['自分の議席だ。', '（定例会は年4回、2月・6月・9月・11月に開かれる。\nいまは会期外だ）']); return; }
  const items = ['一般質問をする', '議案の採決', 'やめる'];
  const k = await g.ask(`ドット区議会　${t.month}月定例会の会期中だ。`, items, { cancel: 2 });
  if (k === 0) await ippanShitsumon(g);
  else if (k === 1) {
    if (g.flag('kuya_vote') === t.key) { await g.say('（この定例会の採決は、もう済んだ）'); return; }
    const b = localBill(g);
    const m = me(g);
    const line = localLine(g, (m && m.party) || 'ind', b);
    const W = { yes: '賛成', no: '反対' };
    const c = await g.ask([`${b.title}（区長提出）`, `${m && m.party ? `${g.partyName(m.party)}の会派の方針は「${W[line]}」。` : '無所属。自分の考えで決める。'}どうする？`], [`${W[line]}する`, line === 'yes' ? '反対する' : '賛成する', '退席する'], { cancel: 0 });
    const mine = c === 2 ? 'abstain' : c === 0 ? line : line === 'yes' ? 'no' : 'yes';
    g.setFlag('kuya_vote', t.key);
    await localVote(g, b, mine);
  }
}
async function kuchoSeat(g) {
  if (!isKucho(g)) {
    await g.say([`区長の${kuchoName(g)}です。`, '執行部の席には、区長・副区長・部長たちが並びます。\n議会の質問に答えるのは、わたしたち執行部の役目です。'], { name: '区長', look: kuchoLook(g) });
    return;
  }
  const t = teireikai(g);
  if (!t) { await g.say('（いまは定例会の会期外だ。区長室で予算の準備を進めよう）'); return; }
  const k = await g.ask(`${t.month}月定例会。区長として、議会に臨む。`, [t.month === 2 ? '予算案を説明する' : '議会に説明する', 'やめる'], { cancel: 1 });
  if (k !== 0) return;
  await g.say(['区長の施政方針と、予算案の説明をいたします。', '子育て、防災、高齢者の暮らし。\n区民の皆さまの声に応える予算を編成しました。'], { name: `${g.state.name}区長`, look: g.state.look });
  const r = g.activity('予算編成', {});
  await g.say(actText(r));
}
async function bochoLocal(g) {
  const t = teireikai(g);
  if (!t) { await g.say(['区議会の傍聴席だ。', '（定例会は年4回。会期中なら、だれでも名前を書くだけで\n傍聴できる）']); return; }
  const topic = LOCAL_TOPICS[Math.floor(hash2(today(g), 4, 9) * LOCAL_TOPICS.length)];
  await g.say([`（${t.month}月定例会の本会議を傍聴した）`, `議員「${topic}について、区の考えを伺います」`, `${kuchoName(g)}区長「区として重要な課題と認識し、\n対策を進めてまいります」`]);
  if (g.flag('kuya_bocho') !== t.key && g.flag('kuya_vote') !== t.key) {
    g.setFlag('kuya_bocho', t.key);
    await localVote(g, localBill(g), null);
  }
  g.relax({ stress: 2 });
  await g.say('（区の予算や条例は、こうして決まっていくのか…）');
}

// The local chamber: 40 seats in a small hemicycle (seat cells solid, seats painted).
const LC = { w: 22, h: 13, cx: 11, cy: 4, el: 0.75 };
function localSeats() {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const Rr = 4 + k;
    for (const [a0, a1] of [[108, 165], [15, 72]]) {
      for (let i = 0; i < 5; i++) {
        const th = ((a0 + ((a1 - a0) * i) / 4) * Math.PI) / 180;
        out.push({ x: LC.cx + Rr * Math.cos(th), y: LC.cy + LC.el * Rr * Math.sin(th), th: (th * 180) / Math.PI, R: Rr });
      }
    }
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}
const LOCAL_SEATS = localSeats();
const MY_LOCAL = (() => { let best = null; for (const s of LOCAL_SEATS) if (s.R === 6 && s.th < 90 && (!best || s.th > best.th)) best = s; return best; })();
function gikaiTiles() {
  const rows = [
    '######################',
    '#========XX==========#',
    '#....................#',
    '#mmmmmmmmCDDFmmmmmmmm#',
    '#....................#',
    '#.........rt.........#',
    '#....................#',
    '#....................#',
    '#....................#',
    '#....................#',
    '#....................#',
    '#.bbbbbbbb..bbbbbbbb.#',
    '##########MM##########',
  ].map((r) => r.split(''));
  for (let y = 4; y < 11; y++) {
    for (let x = 1; x < LC.w - 1; x++) {
      if (rows[y][x] !== '.') continue;
      const dx = x + 0.5 - LC.cx, dys = y + 0.5 - LC.cy;
      if (dys <= 0) continue;
      const dy = dys / LC.el, Rr = Math.hypot(dx, dy), th = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (Rr >= 3.5 && Rr <= 7.5 && th >= 12 && th <= 168 && Math.abs(dx) >= 1.01) rows[y][x] = 'S';
    }
  }
  const mx = Math.floor(MY_LOCAL.x), my = Math.floor(MY_LOCAL.y);
  if (rows[my][mx] === 'S') rows[my][mx] = 'Y';
  return rows.map((r) => r.join(''));
}
const GIKAI_ROWS = gikaiTiles();
const MY_LOCAL_CELL = (() => { for (let y = 0; y < GIKAI_ROWS.length; y++) { const x = GIKAI_ROWS[y].indexOf('Y'); if (x >= 0) return { x, y }; } return { x: 12, y: 8 }; })();
let localCache = null;
function gikaiUnder(ctx, g, cam) {
  const t = teireikai(g);
  const mine = isKugi(g);
  const key = `${t ? 1 : 0}|${mine ? 1 : 0}|${today(g)}|${seatKey(g, 'kugi', true)}`;
  if (!localCache || localCache.key !== key) {
    const { list } = seatParties(g, 'kugi', LOCAL_SEATS.length, true);
    const order = LOCAL_SEATS.map((s, i) => i).sort((a, b) => LOCAL_SEATS[b].th - LOCAL_SEATS[a].th);
    const party = new Array(LOCAL_SEATS.length);
    order.forEach((si, k) => { party[si] = list[k]; });
    const [cv, c] = makeCanvas(LC.w * 32, LC.h * 32);
    LOCAL_SEATS.forEach((s, i) => {
      const isMine = s === MY_LOCAL;
      paintSeat(c, s.x * 32, s.y * 32 + 12, ZL, { color: chairColor(g, party[i]), member: !!t && !isMine && hash2(i, 7, today(g)) < 0.95, ...memberLooks(i + 300), mine: isMine && mine });
    });
    localCache = { key, cv };
  }
  ctx.drawImage(localCache.cv, -cam.x, -cam.y, LC.w * 16, LC.h * 16);
}

// ------------------------------------------------------------------ the 確定申告 reminder (each February)
onMorning((g) => {
  if (!g || !g.state || typeof g.polDate !== 'function') return;
  const d = date(g);
  if (!(d.month === 2 && d.dom >= 16)) return;
  const key = `kuya_tax_note_${d.year}`;
  if (g.flag(key)) return;
  g.setFlag(key, true);
  if (incomeOf(g, d.year - 1) <= 0) return;
  g.message({ from: 'ドット税務署', kind: 'news', text: `【確定申告のお知らせ】${d.year - 1}年分の所得税の確定申告は、\n2月16日から3月15日まで。ドット区役所1階に臨時の相談窓口があります。` });
});

// ------------------------------------------------------------------ the place
const ELEVATOR_STEP = (room, back = 'up') => (g) => elevator(g, room, back);
registerPlace({
  id: PID,
  name: 'ドット区役所',
  kind: 'building',
  bgm: 'kuyakusho',
  start: { room: 'lobby', x: 11, y: 8, dir: 'up' },
  legend: { '#': T('walltop'), '=': T('wall'), w: `${T('wall')}+${T('window')}`, n: `${T('wall')}+${T('board')}`, c: `${T('wall')}+clock`, E: `${T('wall')}+elevator`, p: 'plant' },
  rooms: {
    // -------------------------------------------------------------- 1階 総合窓口
    lobby: {
      floor: T('floor'),
      tiles: [
        '########################',
        '#=======n==EE=cn=======#',
        '#......................#',
        '#KKKKKKK..........KKKKK#',
        '#......................#',
        '#.......t..............#',
        '#.BBB.BBB......BBB.BBB.#',
        '#......................#',
        '#p....................p#',
        '##########MM############',
      ],
      legend: { K: T('counter'), B: T('chairs'), t: T('ticket'), M: 'exit_mat' },
      warps: [{ x: 10, y: 9, to: 'exit' }, { x: 11, y: 9, to: 'exit' }],
      entities: [
        plate(2, 1.25, 5, '住民課', ['#2f6fd0', '#ffffff']),
        plate(17, 1.25, 5, (g) => (taxSeason(g) === 'season' ? '確定申告 相談' : '税務課'), ['#2f8f4e', '#ffffff']),
        npc('kuya_jumin', 3, 2, 'down', WHO.jumin, { talk: juminTalk }),
        npc('kuya_jumin2', 5, 2, 'down', WHO.jumin2, { talk: juminTalk }),
        npc('kuya_zeimu', 19, 2, 'down', WHO.zeimu, { talk: zeimuTalk }),
        npc('kuya_shinkoku', 21, 2, 'down', WHO.shinkoku, { talk: shinkokuTalk }),
        npc('kuya_annai', 13, 4, 'down', WHO.annai, {
          talk: async (g) => {
            await g.say(['ドット区役所へようこそ。', '1階：住民課・税務課（確定申告の相談）\n2階：選挙管理委員会・期日前投票所', '3階：区民相談室（暮らしやお金の相談）\n5階：区議会。エレベーターは正面の奥です。'], say(WHO.annai));
          },
        }),
        npc('kuya_kumin', 6, 7, 'up', WHO.kumin, { text: ['番号札を取って、もう30分待ってるの。', '月曜日と月末は、とっても混むのよ。\n平日の昼すぎがねらい目ね。'] }),
        npc('kuya_student', 16, 7, 'up', WHO.student, { text: ['大学進学で、引っ越してきたんです。転入届を出しに来ました。', '住民票を移しておかないと、\nこっちの選挙で投票できないんですって。'] }),
      ],
      events: [
        { x: 11, y: 1, w: 2, on: 'action', run: (g) => elevator(g, 'lobby') },
        { x: 8, y: 5, on: 'action', run: async (g) => { g.sfx('cursor'); await g.say(`発券機だ。番号札をとった。\n「${100 + Math.floor(hash2(today(g), 1, 1) * 80)}番」…呼ばれるまで、しばらく待とう。`); } },
        { x: 8, y: 1, on: 'action', run: (g) => noticeBoard(g) },
        { x: 15, y: 1, on: 'action', run: (g) => noticeBoard(g) },
      ],
      onEnter: async (g) => {
        if (g.flag('kuya_welcome')) return;
        g.setFlag('kuya_welcome');
        await g.wait(200);
        await g.say(['ドット区役所に入った。', '左が住民課、右が税務課。番号札を取って、呼ばれるのを待つ。\n2階から上へは、正面奥のエレベーターで。']);
      },
    },

    // -------------------------------------------------------------- 2階 選挙管理委員会・期日前投票所
    senkan: {
      floor: T('floor'),
      tiles: [
        '####################',
        '#=====n==c=========#',
        '#..................#',
        '#KKKKK.....K..VVVV.#',
        '#..................#',
        '#..............X...#',
        '#..................#',
        '#q.......MM.......q#',
        '#########DD#########',
      ],
      legend: { K: T('counter'), V: T('booth'), X: T('box'), D: T('door'), q: 'plant', M: T('floor') },
      entities: [
        plate(1, 1.25, 5, '選挙管理委員会', ['#2a3a5a', '#ffffff']),
        plate(11, 1.25, 8, (g) => (votable(g).length ? `${kijitsuName(g)}所` : '投票所（選挙のときだけ）'), ['#c83a3a', '#ffffff']),
        npc('kuya_senkan', 3, 2, 'down', WHO.senkan, { talk: senkanTalk }),
        npc('kuya_kijitsu', 11, 2, 'down', WHO.kijitsu, { talk: kijitsuTalk }),
        npc('kuya_tachiai', 17, 5, 'left', WHO.tachiai, { cond: (g) => votable(g).length > 0, text: ['投票立会人です。投票がきちんと行われるか、\nここで見守っています。', '地域の人が交代でつとめているんですよ。'] }),
      ],
      events: [
        { x: 9, y: 8, w: 2, on: 'step', run: ELEVATOR_STEP('senkan') },
        { x: 14, y: 3, w: 4, on: 'action', run: (g) => g.say(['投票用紙に名前を書く「記載台」だ。', '仕切りがあって、だれに投票したか\nほかの人からは見えないようになっている。']) },
        { x: 15, y: 5, on: 'action', run: (g) => g.say(['投票箱だ。投票が始まる前に、\n空っぽであることを立会人が確かめてから鍵をかける。']) },
        { x: 6, y: 1, on: 'action', run: (g) => g.say(['選挙のポスターだ。', `「あなたの一票が、未来をつくる。」\n「投票日は日曜日。${kijitsuName(g)}もできます」`]) },
      ],
    },

    // -------------------------------------------------------------- 3階 区民相談室
    soudan: {
      floor: T('floor'),
      tiles: [
        '##############',
        '#=====nn=====#',
        '#............#',
        '#.TT......TT.#',
        '#............#',
        '#............#',
        '#q....MM....q#',
        '######DD######',
      ],
      legend: { T: T('table'), D: T('door'), q: 'plant', M: T('floor') },
      entities: [
        plate(1, 1.25, 4, '生活相談', ['#5a8a6a', '#ffffff']),
        plate(9, 1.25, 4, '福祉事務所', ['#c88a3a', '#ffffff']),
        npc('kuya_soudan', 2, 2, 'down', WHO.soudan, { talk: soudanTalk }),
        npc('kuya_fukushi', 10, 2, 'down', WHO.fukushi, { talk: fukushiTalk }),
      ],
      events: [
        { x: 6, y: 7, w: 2, on: 'step', run: ELEVATOR_STEP('soudan') },
        { x: 6, y: 1, on: 'action', run: (g) => g.say(['ポスターが貼ってある。', '「その借金、ひとりで悩まないで。\n　多重債務の相談は、区役所3階へ」', yearOf(g) >= 2015 ? '「困ったときは、消費者ホットライン188（いやや！）」' : '「消費生活のトラブルは、消費生活センターへ」']) },
        { x: 7, y: 1, on: 'action', run: (g) => g.say(['ポスターが貼ってある。', '「ヤミ金融に注意！\n　審査なし・即日融資は違法業者です」', '「困ったら警察・弁護士に相談を」']) },
      ],
    },

    // -------------------------------------------------------------- 5階 区議会
    gikai: {
      floor: T('carpet'),
      topPad: 24,
      tiles: GIKAI_ROWS,
      legend: {
        '=': T('gwall'), X: T('emblem'), m: T('mdesk'), C: T('dais_l'), D: T('dais_m'), F: T('dais_r'),
        S: T('seat'), Y: T('seat'), r: T('rostrum_l'), t: T('rostrum_r'), b: T('bench'), M: T('door'),
      },
      entities: [
        { type: 'npc', id: 'kuya_gicho', x: 10, y: 2, dir: 'down', fixedDir: true, name: WHO.gicho.name, look: WHO.gicho.look,
          cond: (g) => !!teireikai(g),
          text: ['区議会議長です。議会は、区の予算や条例を決める場です。', '定例会は年4回。会期中は、区民の皆さんも\n傍聴席から自由に見られますよ。'] },
        { type: 'npc', id: 'kuya_kucho', x: 6, y: 2, dir: 'down', fixedDir: true,
          get name() { const g = GG(); return g ? `${kuchoName(g)}区長` : '区長'; },
          get look() { const g = GG(); return g ? kuchoLook(g) : LOOKS.oldman; },
          cond: (g) => !!teireikai(g) && !isKucho(g),
          talk: kuchoSeat },
        npc('kuya_bucho', 15, 2, 'down', { name: '総務部長', look: { ...LOOKS.salaryman, hair: 'short', hairColor: 'gray', glasses: true } }, { fixedDir: true, cond: (g) => !!teireikai(g), text: ['総務部長です。議員の質問には、担当の部長が答えることも\nあります。答弁の準備で、毎晩遅いんですよ…。'] }),
        { type: 'sign', x: 9, y: 2, text: ['議長席のうしろの壁に、ドット区の区章がかかっている。', '輪の中の赤い点は、区の名前の「ドット」をかたどったものだ。'] },
        npc('kuya_jimukyoku', 19, 4, 'left', WHO.jimukyoku, {
          talk: async (g) => {
            const t = teireikai(g);
            await g.say(['区議会事務局です。', t ? `いまは${t.month}月定例会の会期中です。\n傍聴席は、うしろのベンチです。どうぞ自由にご覧ください。` : '定例会は2月・6月・9月・11月。\n会期中は、だれでも傍聴できます。', isKugi(g) ? '先生の議席は、中央の通路のすぐ右です。' : '区議会議員の定数は40。4年に1度の選挙で選ばれます。'], say(WHO.jimukyoku));
          },
        }),
      ],
      events: [
        { x: 10, y: 12, w: 2, on: 'step', run: ELEVATOR_STEP('gikai') },
        { x: MY_LOCAL_CELL.x, y: MY_LOCAL_CELL.y, on: 'action', run: seatEvent },
        { x: 2, y: 11, w: 8, on: 'action', run: bochoLocal },
        { x: 12, y: 11, w: 8, on: 'action', run: bochoLocal },
        { x: 3, y: 3, w: 4, on: 'action', run: kuchoSeat },
      ],
      drawUnder: gikaiUnder,
    },
  },
});

// ------------------------------------------------------------------ notices
async function noticeBoard(g) {
  const lines = ['区のお知らせの掲示板だ。'];
  const ups = electionsOf(g).slice(0, 2);
  for (const e of ups) lines.push(`【選挙】${e.label}\n${e.kind === 'shugi' || e.kind === 'sangi' ? '公示' : '告示'} ${e.kojiDate}・投票 ${e.date}`);
  const season = taxSeason(g);
  lines.push(season === 'season' ? '【確定申告】3月15日まで。1階に税務署の臨時相談窓口。' : '【確定申告】毎年2月16日〜3月15日。');
  lines.push('【くらしの相談】借金・消費者トラブルの相談は3階へ。\n秘密は守ります。相談は無料です。');
  await g.say(lines);
}
