// 国会議事堂（永田町）— 衆議院・参議院の本会議場、委員会室、議員会館、中央広間、国会見学と傍聴
//
//   lobby    参観ロビー・面会所  国会見学（参観）の受付と案内、本会議の傍聴人受付・手荷物ロッカー、
//                                歴史のパネル、「今日の国会」の掲示。議員は衛視の前を通って院内へ、
//                                通用口から議員会館へ。選挙のあとの初登院は中央玄関から
//   hall     中央広間           先人の銅像3体と空いたままの台座（人物は特定しない）、四季の壁画、
//                                ステンドグラスの天井、中央玄関（あかずの扉）。左が衆議院、右が参議院
//   shugi    衆議院本会議場      半円形の議席（会派の色は政治の状態から）、議長席・演壇・国務大臣席。
//                                会期中は議員が着席。採決：起立・異議なし・記名投票（白票／青票）
//   sangi    参議院本会議場      同じ造りに天皇陛下の御席（開会式の会場）。押しボタン式投票（1998年〜）
//   bocho_s / bocho_n 傍聴席    衆議院・参議院の本会議を上の傍聴席から見る（傍聴券が必要）
//   iinkai   委員会室           委員長席・答弁席・質疑席・テレビカメラ。議員は大臣に質疑、大臣は答弁
//   kaikan   議員会館（事務所）  秘書・陳情・政治資金の帳簿（収支報告書／裏金）・パーティー・献金・
//                                打診への返事。ときどき「お願い」を持ってくる業者も…（収賄＝犯罪）
//
// 入れる人：参観ロビーと傍聴席はだれでも（傍聴券）。中央広間は議員と見学の一行だけ、議場はその院の
// 議員だけ、委員会室と議員会館は国会議員だけ（衛視が止める）。
//
// 政治の中身はすべて js/engine/politics.js（g.pol / attendDiet / vote / advanceBills / noConfidence /
// activity / reportFunds / holdFundraiser / collectDonations / hireStaff / respondOffer …）と
// js/engine/crime.js（commitCrime / crimeLaw）を呼ぶだけ。ここでは見せ方と手続きの流れを担当する。
// 本会議の採決：その院の議事日程（本会議の段階の法案）は、議員が着席するか傍聴人が見ている日に、
// その場で politics の advanceBills() にかけ、結果（b.votes）をそのまま起立・記名投票・押しボタンで見せる。
//
// 登場する政治家・職員はすべて架空（議長・大臣の名前は politics.js が作る架空の人物）。実在の政党は
// 自由民主党・民主党だけが政治の状態にあり、ここでは会派の色と名前を中立に出すだけ。
// 銅像は「議会政治の基礎を築いた先人」とだけ書き、人物は描き分けない・名前を出さない。
//
// 確かめた事実（2026-10 WebSearch）：
// - 議事堂：1920年（大正9年）着工、1936年（昭和11年）11月完成（17年）。中央塔の高さ 65.45m、部屋は約400
//   （sangiin.go.jp 議事堂のあらまし、shugiin.go.jp 施設の案内）
// - 中央広間：3体の銅像と、空いたままの4つ目の台座（理由は諸説「政治に完成はない」など）。四隅の上に
//   春・夏・秋・冬の壁画、天井と窓にステンドグラス（ステンドグラス・ドアノブ・郵便投函筒は外国製）
// - 中央玄関：天皇陛下をお迎えするとき、総選挙・通常選挙のあとの初登院、国賓の来訪のときだけ開く
//   「あかずの扉」。ブロンズ製で扉1枚 1.1トン（sangiin.go.jp）
// - 参院本会議の表決：起立・異議の有無・記名投票・押しボタン式投票。押しボタンは1998年1月召集の第142回
//   国会から。記名投票は賛成＝白、反対＝青の木札を演壇に持参（議員の氏名入り）。総予算などは野党の要求で
//   記名投票になることが多い。衆院は押しボタンを導入していない（起立・異議なし・記名投票）
//   （sangiin.go.jp 本会議・押しボタン式投票、kotobank 青票）
// - 議席は演壇を中心に半円形、会派ごとにまとまって座る。衆院の議席には氏名標（黒い四角柱）
// - 参観：衛視などの職員の案内で決まったコース（本会議場・御休所・中央広間・前庭）約1時間。本会議の日は
//   開会1時間前から散会まで休止。前庭には1970年の議会開設80年を記念した都道府県の木
// - 傍聴：一般傍聴券は本会議の開会前に面会所で先着順。拍手・発言・撮影・録音は禁止（議会傍聴の通則）
// - 委員会の質疑：質問の趣旨は原則として前々日の正午までに通告（1999年の申し合わせ）。質問時間は会派の
//   人数比で割り当て
// - 公設秘書は3人（政策担当秘書（1993年の国会法改正で創設）・第一・第二）、私設秘書は私費
// - 政治資金収支報告書：翌年3月末まで（国会議員関係政治団体は5月末）に選管・総務大臣へ
// - 国会の種類：常会は毎年1月召集・会期150日、特別会は総選挙から30日以内（憲法54条）。法律案は衆院の
//   出席議員の3分の2で再可決（59条）、予算は参院が30日以内に議決しないと衆院の議決が国会の議決（60条）、
//   内閣不信任の可決→10日以内に解散か総辞職（69条）。いずれも politics.js の実装に合わせて説明する

import { registerPlace } from '../engine/map.js';
import { LOOKS, charSheetHD } from '../engine/sprites.js';
import { defineTile, R, P, Rw, disc, oval, line, bevel, inset, grain, outline, shadowEllipse, speckle, dither } from '../engine/tiles.js';
import { text, panel, measure, COLORS } from '../engine/draw.js';
import { SW, SH, makeCanvas, shade, mix, fmtMoney, clamp, hash2 } from '../engine/util.js';
import { registerSong } from '../engine/audio.js';
import { registerItem } from '../engine/state.js';
import * as POL from '../engine/politics.js';
import * as JUS from '../engine/crime.js';

const PID = 'kokkai';
const T = (k) => `${PID}_${k}`;
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const GG = () => (typeof window !== 'undefined' && window.__game) || null;

// ------------------------------------------------------------------ palette
const WD = '#5a3a24', WDL = '#7a5234', WDK = '#3e2818', WDX = '#2a1a10';
const PLA = '#e9dfc6', PLAL = '#f6efdc', PLAD = '#cfc2a2';
const GOLD = '#d6b04a', GOLDD = '#9a7a2a', GOLDL = '#f2d98a';
const MAR = '#ece6d6', MARD = '#cfc6b0', MARL = '#faf6ec';
const RED = '#8e2c2c', REDD = '#6e2020', REDL = '#a8403a';
const BRZ = '#7a6440', BRZD = '#4e3f26', BRZL = '#a08a5a', PAT = '#5f7a62';
const INK = '#22202a';
const GRAN = '#8d8a84', GRAND = '#6b6862', GRANL = '#b3b0a8';

// ------------------------------------------------------------------ tile helpers
// Every tile here is painted natively at 32x32 (hd); the 16px draw() is the same art halved.
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
// one picture cut into tiles (cols x rows)
function bigTiles(prefix, cols, rows, paint, extra = {}) {
  let img = null;
  const get = () => { if (!img) { const [cv, c] = makeCanvas(cols * 32, rows * 32); paint(c); img = cv; } return img; };
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    tile(prefix + i, { solid: true, ...extra, hd(c) { c.drawImage(get(), -col * 32, -row * 32); } });
  }
}

// ------------------------------------------------------------------ walls
tile('walltop', { solid: true, hd(c) { R(c, 0, 0, 32, 32, '#2b231d'); R(c, 0, 30, 32, 2, '#1c1612'); R(c, 0, 0, 32, 1, '#3a3028'); } });
// plaster upper wall with a gilded cornice, walnut wainscot below (lobby, office)
function plasterWall(c, r) {
  R(c, 0, 0, 32, 32, PLA);
  R(c, 0, 0, 32, 2, PLAD); R(c, 0, 2, 32, 1, GOLDD); R(c, 0, 3, 32, 1, GOLD); R(c, 0, 4, 32, 1, PLAL);
  inset(c, 4, 7, 24, 10, PLA, PLAL, PLAD);
  R(c, 0, 19, 32, 1, GOLDD); R(c, 0, 20, 32, 1, GOLDL);
  R(c, 0, 21, 32, 8, WD);
  grain(c, r, 0, 22, 32, 6, WDL, 4, 5); grain(c, r, 0, 22, 32, 6, WDK, 4, 4);
  for (const x of [1, 17]) inset(c, x, 22, 14, 6, WD, WDL, WDK);
  R(c, 0, 29, 32, 3, WDK); R(c, 0, 29, 32, 1, WDL);
}
tile('wall', { solid: true, hd: plasterWall });
// chamber wall: dark walnut, carved pilaster with gilded capitals
function chamberWall(c, r) {
  R(c, 0, 0, 32, 32, WD);
  grain(c, r, 0, 0, 32, 28, WDL, 6, 6); grain(c, r, 0, 0, 32, 28, WDK, 6, 5);
  inset(c, 2, 5, 9, 18, WD, WDL, WDX); inset(c, 21, 5, 9, 18, WD, WDL, WDX);
  R(c, 13, 0, 6, 28, WDL); R(c, 13, 0, 1, 28, '#9a6a44'); R(c, 18, 0, 1, 28, WDK);
  R(c, 12, 2, 8, 2, GOLD); R(c, 12, 2, 8, 1, GOLDL); R(c, 12, 24, 8, 2, GOLDD);
  R(c, 0, 28, 32, 4, WDX); R(c, 0, 28, 32, 1, WDK);
}
tile('cwall', { solid: true, hd: chamberWall });
// the panelled wall behind the 議長席 with a gilded rosette (no emblem)
tile('xwall', {
  solid: true,
  hd(c, r) {
    R(c, 0, 0, 32, 32, WDK);
    grain(c, r, 0, 0, 32, 28, WD, 6, 6);
    R(c, 0, 3, 32, 1, GOLDD); R(c, 0, 25, 32, 1, GOLDD);
    ring(c, 16, 14, 5, 8, GOLD); disc(c, 16, 14, 3, GOLDL); P(c, 15, 13, '#fff6d0');
    for (const [x, y] of [[16, 4], [16, 23], [6, 14], [26, 14]]) R(c, x - 1, y - 1, 2, 2, GOLDD);
    R(c, 0, 28, 32, 4, WDX);
  },
});
function ring(c, cx, cy, r0, r1, col) {
  for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d >= r0 && d <= r1) P(c, x, y, col);
  }
}
// marble wall with a pilaster (中央広間)
tile('hwall', {
  solid: true,
  hd(c, r) {
    R(c, 0, 0, 32, 32, MAR); speckle(c, r, [MARD, MARL, '#e0d8c4'], 40);
    R(c, 0, 0, 32, 2, MARD); R(c, 0, 3, 32, 1, GOLDD);
    R(c, 12, 4, 8, 22, MARL); R(c, 12, 4, 1, 22, '#fffaf0'); R(c, 19, 4, 1, 22, MARD);
    R(c, 11, 4, 10, 2, '#d8cdb2'); R(c, 11, 24, 10, 2, '#d8cdb2');
    R(c, 0, 26, 32, 6, '#b9ab90'); R(c, 0, 26, 32, 1, MARL); R(c, 0, 31, 32, 1, '#8f8370');
  },
});
tile('window', {
  solid: true, obj: true,
  hd(c) {
    R(c, 6, 4, 20, 16, '#cfe2ee'); R(c, 6, 4, 20, 1, WDK);
    R(c, 6, 4, 1, 16, WDK); R(c, 25, 4, 1, 16, WDK); R(c, 15, 4, 2, 16, WDL);
    R(c, 6, 11, 20, 1, WDL); line(c, 8, 18, 13, 6, '#eef6fb'); line(c, 18, 18, 23, 6, '#eef6fb');
    R(c, 4, 19, 24, 2, PLAL); R(c, 4, 20, 24, 1, PLAD);
  },
});
// heavy double door in a wall (walkable: a warp)
tile('door', {
  hd(c) {
    R(c, 0, 0, 32, 32, PLA); R(c, 0, 2, 32, 1, GOLDD);
    R(c, 3, 3, 26, 29, WDX);
    R(c, 5, 5, 22, 27, WD); R(c, 5, 5, 22, 1, WDL);
    R(c, 15, 5, 2, 27, WDX);
    inset(c, 7, 8, 7, 9, WD, WDL, WDK); inset(c, 18, 8, 7, 9, WD, WDL, WDK);
    inset(c, 7, 20, 7, 10, WD, WDL, WDK); inset(c, 18, 20, 7, 10, WD, WDL, WDK);
    R(c, 13, 18, 1, 3, GOLD); R(c, 18, 18, 1, 3, GOLD);
  },
});
// a doorway in the bottom wall (threshold with a red runner)
tile('mat', {
  hd(c) {
    R(c, 0, 0, 32, 32, '#3a2a20'); R(c, 0, 0, 32, 2, '#5a4030');
    R(c, 4, 0, 24, 32, RED); R(c, 4, 0, 24, 2, REDL); R(c, 4, 0, 2, 32, GOLDD); R(c, 26, 0, 2, 32, GOLDD);
    dither(c, 8, 6, 16, 22, REDD);
  },
});

// ------------------------------------------------------------------ floors
tile('floor', {
  variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#cbc5b6'); speckle(c, r, ['#c2bcad', '#d4cebf', '#bdb6a6'], 70);
    R(c, 0, 0, 32, 1, '#a9a293'); R(c, 0, 0, 1, 32, '#a9a293'); R(c, 0, 16, 32, 1, '#b3ac9d'); R(c, 16, 0, 1, 32, '#b3ac9d');
    if (v === 1) line(c, 4, 26, 11, 20, '#bfb8a8');
    if (v === 2) line(c, 20, 12, 27, 6, '#bfb8a8');
  },
});
// coloured-marble mosaic (中央広間)
tile('mosaic', {
  variants: 2,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, MAR); speckle(c, r, [MARD, MARL], 30);
    for (let y = 10; y <= 22; y++) { const h = 6 - Math.abs(y - 16); if (h > 0) R(c, 16 - h, y, h * 2, 1, '#d4ad9e'); }
    for (let y = 13; y <= 19; y++) { const h = 3 - Math.abs(y - 16); if (h > 0) R(c, 16 - h, y, h * 2, 1, v ? '#9ab0a0' : '#b0a898'); }
    R(c, 0, 16, 32, 1, '#e2d9c4'); R(c, 16, 0, 1, 32, '#e2d9c4');
    Rw(c, -2, -2, 4, 4, '#8a8478'); P(c, 0, 0, '#a59e90');
    R(c, 0, 0, 32, 1, MARD); R(c, 0, 0, 1, 32, MARD);
  },
});
function carpet(c, r, base, dark, light) {
  R(c, 0, 0, 32, 32, base);
  speckle(c, r, [dark, light, shade(base, -0.08)], 60);
  for (const [x, y] of [[8, 8], [24, 24]]) { P(c, x, y - 1, light); P(c, x - 1, y, light); P(c, x + 1, y, light); P(c, x, y + 1, light); P(c, x, y, shade(light, 0.2)); }
}
tile('carpet', { hd: (c, r) => carpet(c, r, RED, REDD, REDL) });
tile('scarpet', { hd: (c, r) => carpet(c, r, '#7c2630', '#5e1a24', '#963a40') });
// seat cells of the hemicycle: carpet you cannot walk on (the seats are painted on top)
tile('seat', { solid: true, hd: (c, r) => carpet(c, r, REDD, '#561818', RED) });
tile('sseat', { solid: true, hd: (c, r) => carpet(c, r, '#5e1a24', '#46121a', '#7c2630') });
tile('gcarpet', { hd: (c, r) => carpet(c, r, '#2f5a4e', '#23463c', '#3f6e60') });
tile('ocarpet', { hd: (c, r) => carpet(c, r, '#6f7a86', '#5e6874', '#808b97') });
// the dark void of the gallery view (the chamber is painted over it)
tile('view', { solid: true, hd(c) { R(c, 0, 0, 32, 32, '#1a1210'); } });

// ------------------------------------------------------------------ furniture
// reception counter: walnut front, marble top (talk across it)
tile('counter', {
  solid: true, obj: true, talkThrough: true,
  hd(c, r) {
    R(c, 0, 6, 32, 6, MARL); R(c, 0, 6, 32, 1, '#ffffff'); R(c, 0, 11, 32, 1, MARD);
    R(c, 0, 12, 32, 18, WD); grain(c, r, 0, 13, 32, 15, WDL, 4, 5);
    inset(c, 3, 15, 26, 11, WD, WDL, WDK);
    R(c, 0, 29, 32, 2, WDX);
  },
});
tile('bench', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 28, 14, 2);
    R(c, 2, 8, 28, 5, WDK); R(c, 2, 8, 28, 1, WDL);
    R(c, 1, 15, 30, 7, WD); R(c, 1, 15, 30, 1, WDL); R(c, 1, 21, 30, 1, WDX);
    R(c, 3, 22, 3, 6, WDK); R(c, 26, 22, 3, 6, WDK);
    outline(c);
  },
});
// brass stanchion with a red rope
tile('rope', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 28, 6, 2);
    R(c, 14, 8, 4, 19, GOLDD); R(c, 14, 8, 2, 19, GOLD); oval(c, 12, 4, 8, 6, GOLD); P(c, 14, 5, GOLDL);
    oval(c, 10, 25, 12, 4, GOLDD);
    for (let x = 0; x < 32; x++) { const y = 12 + Math.round(3 * Math.sin((x / 32) * Math.PI)); R(c, x, y, 1, 2, '#b8322a'); }
    outline(c);
  },
});
// 議長席: tall walnut front with a gilded band (talk across it to the 議長)
function daisPaint(part) {
  return (c, r) => {
    R(c, 0, 4, 32, 26, WD); grain(c, r, 0, 6, 32, 22, WDL, 4, 6);
    R(c, 0, 4, 32, 3, WDL); R(c, 0, 4, 32, 1, '#9a6a44');
    R(c, 0, 9, 32, 2, GOLD); R(c, 0, 9, 32, 1, GOLDL);
    inset(c, 3, 13, 26, 13, WD, WDL, WDX);
    if (part === 'm') { ring(c, 16, 19, 2, 4, GOLD); }
    if (part === 'l') R(c, 0, 4, 2, 26, WDX);
    if (part === 'r') R(c, 30, 4, 2, 26, WDX);
    R(c, 0, 29, 32, 2, WDX);
  };
}
tile('dais_l', { solid: true, obj: true, talkThrough: true, hd: daisPaint('l') });
tile('dais_m', { solid: true, obj: true, talkThrough: true, hd: daisPaint('m') });
tile('dais_r', { solid: true, obj: true, talkThrough: true, hd: daisPaint('r') });
// 演壇 (speaker's rostrum): two tiles, lectern with a microphone and a water glass
function rostrumPaint(side) {
  return (c, r) => {
    shadowEllipse(c, side === 'l' ? 30 : 2, 28, 14, 3);
    const x0 = side === 'l' ? 6 : 0, w = 26;
    R(c, x0, 10, w, 18, WD); grain(c, r, x0, 12, w, 14, WDL, 3, 5);
    R(c, x0, 8, w, 4, WDL); R(c, x0, 8, w, 1, '#a07048');
    inset(c, x0 + 3, 15, w - 6, 10, WD, WDL, WDX);
    if (side === 'l') { R(c, x0, 8, 1, 20, WDX); R(c, 24, 2, 1, 7, '#2a2a2a'); oval(c, 22, 0, 5, 4, '#3a3a3a'); }
    else { R(c, 31, 8, 1, 20, WDX); R(c, 6, 3, 4, 5, '#d8eef6'); R(c, 6, 3, 4, 1, '#ffffff'); R(c, 4, 7, 8, 1, GOLDD); }
    outline(c);
  };
}
tile('rostrum_l', { solid: true, obj: true, hd: rostrumPaint('l') });
tile('rostrum_r', { solid: true, obj: true, hd: rostrumPaint('r') });
// 国務大臣席 / long desks (talk across them)
tile('mdesk', {
  solid: true, obj: true, talkThrough: true,
  hd(c, r) {
    R(c, 0, 8, 32, 6, '#3f5a4a'); R(c, 0, 8, 32, 1, '#5a7a66');
    R(c, 0, 14, 32, 14, WD); grain(c, r, 0, 15, 32, 12, WDL, 3, 5);
    R(c, 0, 14, 32, 1, WDL); R(c, 0, 27, 32, 2, WDX);
    R(c, 6, 5, 6, 4, '#f4f0e4'); R(c, 6, 5, 6, 1, '#ffffff');
    R(c, 22, 4, 2, 5, '#1a1a1a');
  },
});
tile('jdesk', {
  solid: true, obj: true, talkThrough: true,
  hd(c, r) {
    R(c, 2, 10, 28, 5, WDL); R(c, 2, 10, 28, 1, '#a07048');
    R(c, 2, 15, 28, 13, WD); grain(c, r, 2, 16, 28, 11, WDK, 3, 5); R(c, 2, 27, 28, 2, WDX);
    R(c, 7, 7, 8, 4, '#f4f0e4'); R(c, 20, 6, 4, 5, '#d6b04a');
    outline(c);
  },
});
// committee: long table with green baize, 委員長席 desk, question / answer podium
tile('ctable', {
  solid: true, obj: true, talkThrough: true,
  hd(c, r) {
    shadowEllipse(c, 16, 29, 15, 2);
    R(c, 0, 9, 32, 7, '#3f6e60'); R(c, 0, 9, 32, 1, '#5a8a7a');
    R(c, 0, 16, 32, 11, WD); grain(c, r, 0, 17, 32, 9, WDL, 3, 5); R(c, 0, 26, 32, 1, WDX);
    R(c, 4, 6, 7, 4, '#f4f0e4'); R(c, 20, 5, 2, 5, '#1a1a1a'); oval(c, 19, 3, 4, 3, '#2a2a2a');
  },
});
tile('podium', {
  solid: true, obj: true,
  hd(c, r) {
    shadowEllipse(c, 16, 28, 9, 2);
    R(c, 8, 12, 16, 15, WD); grain(c, r, 8, 13, 16, 13, WDL, 2, 4);
    R(c, 6, 10, 20, 4, WDL); R(c, 6, 10, 20, 1, '#a07048');
    R(c, 15, 2, 2, 9, '#2a2a2a'); oval(c, 13, 0, 6, 4, '#3a3a3a'); P(c, 14, 1, '#6a6a6a');
    R(c, 9, 7, 6, 4, '#f4f0e4');
    outline(c);
  },
});
// gallery railing (brass and walnut) and gallery benches (red cushions)
tile('rail', {
  solid: true,
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#1a1210');
    R(c, 0, 10, 32, 18, WD); grain(c, r, 0, 12, 32, 14, WDL, 3, 6);
    R(c, 0, 8, 32, 3, GOLD); R(c, 0, 8, 32, 1, GOLDL);
    for (const x of [4, 12, 20, 28]) R(c, x, 13, 2, 13, WDX);
    R(c, 0, 28, 32, 4, WDX);
  },
});
tile('gbench', {
  solid: true, obj: true,
  hd(c) {
    R(c, 0, 6, 32, 6, WDK); R(c, 0, 6, 32, 1, WDL);
    R(c, 0, 12, 32, 10, '#9a3030'); R(c, 0, 12, 32, 1, '#c04a40'); R(c, 0, 21, 32, 1, '#6a1a1a');
    for (const x of [10, 21]) R(c, x, 12, 1, 10, '#7a2424');
    R(c, 0, 22, 32, 6, WD); R(c, 0, 27, 32, 1, WDX);
  },
});
// office: the member's big desk (2 tiles), document cabinet with a small safe
function bigDesk(side) {
  return (c, r) => {
    shadowEllipse(c, side === 'l' ? 30 : 2, 29, 15, 2);
    const x0 = side === 'l' ? 2 : 0, w = 30;
    R(c, x0, 8, w, 6, WDL); R(c, x0, 8, w, 1, '#a07048');
    R(c, x0, 14, w, 14, WD); grain(c, r, x0, 15, w, 12, WDK, 3, 5); R(c, x0, 27, w, 2, WDX);
    if (side === 'l') { R(c, 8, 3, 12, 6, '#f4f0e4'); R(c, 9, 4, 8, 1, '#9a9aa6'); R(c, 9, 6, 6, 1, '#9a9aa6'); R(c, x0, 8, 1, 21, WDX); }
    else { R(c, 6, 2, 9, 7, '#2a2d36'); R(c, 7, 3, 7, 4, '#5fa8d8'); R(c, 20, 4, 6, 5, '#e8e0d0'); R(c, 20, 4, 6, 1, GOLD); R(c, 31, 8, 1, 21, WDX); }
    outline(c);
  };
}
tile('bigdesk_l', { solid: true, obj: true, hd: bigDesk('l') });
tile('bigdesk_r', { solid: true, obj: true, hd: bigDesk('r') });
tile('cabinet', {
  solid: true, obj: true,
  hd(c, r) {
    shadowEllipse(c, 16, 29, 13, 2);
    R(c, 3, 2, 26, 26, '#8a8478'); R(c, 3, 2, 26, 1, '#b0a99c'); R(c, 3, 27, 26, 1, '#5e5950');
    for (const y of [6, 13, 20]) { inset(c, 6, y, 20, 5, '#9a9488', '#b0a99c', '#6e695f'); R(c, 14, y + 2, 4, 1, GOLDD); }
    R(c, 18, 2, 1, 26, '#6e695f');
    outline(c);
  },
});

// ------------------------------------------------------------------ the 中央玄関 (bronze, closed)
bigTiles('gate', 4, 1, (c) => {
  R(c, 0, 0, 128, 32, '#2b231d');
  R(c, 6, 0, 116, 30, BRZD); R(c, 8, 0, 112, 28, BRZ);
  for (let i = 0; i < 2; i++) {
    const x = 10 + i * 56;
    for (let j = 0; j < 3; j++) { inset(c, x + 4 + j * 17, 4, 14, 10, BRZ, BRZL, BRZD); inset(c, x + 4 + j * 17, 16, 14, 10, BRZ, BRZL, BRZD); }
    dither(c, x + 2, 2, 50, 24, PAT, i);
  }
  R(c, 63, 0, 2, 28, BRZD); R(c, 60, 12, 2, 4, GOLD); R(c, 66, 12, 2, 4, GOLD);
  R(c, 6, 28, 116, 2, '#3a2e1e');
});

// ------------------------------------------------------------------ the four seasons (壁画)
const SEASONS = [['春', 'spring'], ['夏', 'summer'], ['秋', 'autumn'], ['冬', 'winter']];
function muralPaint(c, season) {
  // marble wall behind, gilded frame, the picture
  R(c, 0, 0, 64, 32, MAR); R(c, 0, 0, 64, 2, MARD); R(c, 0, 3, 64, 1, GOLDD);
  R(c, 0, 26, 64, 6, '#b9ab90'); R(c, 0, 26, 64, 1, MARL);
  R(c, 3, 4, 58, 22, GOLDD); R(c, 4, 5, 56, 20, GOLD); R(c, 4, 5, 56, 1, GOLDL);
  const X = 6, Y = 7, W = 52, H = 16;
  const sky = { spring: '#bfe0f2', summer: '#5fa8e8', autumn: '#e8d8b0', winter: '#c8ccd4' }[season];
  R(c, X, Y, W, H, sky);
  if (season === 'spring') {
    R(c, X, Y + 9, W, 7, '#8cc46a'); oval(c, X - 4, Y + 5, 26, 10, '#a8c8a0'); oval(c, X + 30, Y + 4, 28, 10, '#9abf92');
    for (const [x, y] of [[X + 6, Y + 6], [X + 18, Y + 4], [X + 36, Y + 7], [X + 46, Y + 5]]) { R(c, x + 2, y + 5, 1, 5, '#6a4a30'); oval(c, x - 2, y, 9, 7, '#f2b8c8'); P(c, x + 1, y + 2, '#fbe0e8'); }
  } else if (season === 'summer') {
    R(c, X, Y + 10, W, 6, '#2f6fb8'); R(c, X, Y + 10, W, 1, '#8fc4f0');
    oval(c, X + 8, Y + 1, 16, 7, '#ffffff'); oval(c, X + 16, Y - 1, 12, 7, '#f4f8fc'); oval(c, X + 34, Y + 3, 14, 5, '#ffffff');
    oval(c, X + 38, Y + 7, 18, 6, '#3f8a3a'); oval(c, X - 4, Y + 8, 16, 6, '#3f8a3a');
  } else if (season === 'autumn') {
    R(c, X, Y + 10, W, 6, '#a8803a');
    for (const [x, y, col] of [[X + 4, Y + 3, '#d8482a'], [X + 15, Y + 5, '#e8902a'], [X + 28, Y + 2, '#c83a2a'], [X + 40, Y + 4, '#e8b03a']]) { R(c, x + 4, y + 7, 1, 5, '#5a3a20'); oval(c, x, y, 10, 9, col); P(c, x + 3, y + 2, shade(col, 0.3)); }
  } else {
    oval(c, X + 2, Y + 2, 22, 14, '#8a92a0'); oval(c, X + 6, Y + 2, 12, 5, '#ffffff');
    oval(c, X + 24, Y + 4, 26, 12, '#9aa2ae'); oval(c, X + 30, Y + 4, 12, 4, '#ffffff');
    R(c, X, Y + 11, W, 5, '#f4f6fa');
    for (const x of [X + 10, X + 22, X + 44]) { R(c, x, Y + 7, 2, 6, '#3a3a40'); P(c, x - 1, Y + 8, '#ffffff'); }
  }
  R(c, X, Y, W, 1, 'rgba(255,255,255,0.25)');
}
SEASONS.forEach(([, s], i) => bigTiles(`mural${i}_`, 2, 1, (c) => muralPaint(c, s)));

// ------------------------------------------------------------------ the 御席 (参議院, behind the 議長席)
bigTiles('gyo', 4, 1, (c, r) => {
  for (let i = 0; i < 4; i++) { const [cv, cc] = makeCanvas(32, 32); chamberWall(cc, () => 0.5); c.drawImage(cv, i * 32, 0); }
  R(c, 34, 1, 60, 29, GOLDD); R(c, 36, 2, 56, 27, '#7a1a20');
  for (let x = 38; x < 90; x += 4) R(c, x, 3, 2, 24, '#8e2a30');
  R(c, 36, 2, 56, 3, GOLD); R(c, 36, 2, 56, 1, GOLDL);
  // the chair (seen from the front), gilded frame
  R(c, 56, 8, 16, 14, GOLD); R(c, 58, 10, 12, 10, '#a82a2a'); R(c, 58, 10, 12, 1, '#c84a40');
  R(c, 54, 20, 20, 4, GOLDD); R(c, 55, 24, 2, 4, GOLDD); R(c, 71, 24, 2, 4, GOLDD);
  R(c, 34, 28, 60, 2, WDX);
});

// ------------------------------------------------------------------ history panels on the wall
tile('panel', {
  solid: true, obj: true,
  hd(c) {
    R(c, 5, 5, 22, 17, WDK); R(c, 6, 6, 20, 15, '#f6f0e0');
    R(c, 6, 6, 20, 3, '#2a3a5a');
    for (const [y, w] of [[11, 16], [13, 18], [15, 14], [17, 17], [19, 10]]) R(c, 8, y, w, 1, '#8a8478');
    R(c, 5, 22, 22, 1, '#00000033');
  },
});

// ------------------------------------------------------------------ items & music
registerItem('kokkai_ticket', { name: '本会議の傍聴券', price: 0, desc: '国会の本会議の傍聴券。\n傍聴席では、拍手も発言も撮影もできない。' });
registerItem('kokkai_pamph', { name: '国会見学のしおり', price: 0, desc: '国会見学でもらったしおり。\n議事堂の歴史と、国会のしくみが書いてある。' });
registerSong('kokkai', {
  bpm: 76, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.08, notes: 'C5 - - - E5 - G5 - | F5 - - - E5 - D5 - | E5 - - - G5 - C6 - | B5 - - - - - . . | A5 - - - G5 - F5 - | E5 - - - D5 - C5 - | D5 - - - G4 - B4 - | C5 - - - - - . .' },
    { wave: 'triangle', vol: 0.07, notes: 'C3 G3 E3 G3 C3 G3 E3 G3 | F2 C3 A2 C3 G2 D3 B2 D3 | C3 G3 E3 G3 A2 E3 C3 E3 | G2 D3 B2 D3 G2 D3 B2 D3 | F2 C3 A2 C3 C3 G3 E3 G3 | A2 E3 C3 E3 F2 C3 A2 C3 | G2 D3 B2 D3 G2 D3 F3 D3 | C3 G3 E3 G3 C3 . . .' },
  ],
});

// ------------------------------------------------------------------ politics helpers (all through g.*)
const pol = (g) => { try { return typeof g.pol === 'function' ? g.pol() : null; } catch (e) { console.error(e); return null; } };
const today = (g) => (g.state && g.state.day) || 1;
function me(g) { const p = pol(g); return p ? p.me : null; }
function myHouse(g) { const m = me(g); return m && (m.office === 'shugi' || m.office === 'sangi') ? m.office : null; }
const houseName = (h) => (h === 'sangi' ? '参議院' : '衆議院');
function sessionOf(g) {
  const p = pol(g);
  const S = p && p.diet && p.diet.session;
  const d = today(g);
  return S && d >= S.start && d <= S.end ? S : null;
}
function yearOf(g) { try { return g.polDate().year; } catch (e) { return 2026; } }
function dateText(g) { try { return g.polDate().label; } catch (e) { return ''; } }
function inCabinet(g) {
  const m = me(g);
  const PO = POL.POSTS || {};
  return !!(m && m.posts && m.posts.some((x) => PO[x] && PO[x].kind === 'cabinet'));
}
function partyName(g, id, short = false) { try { return g.partyName(id, short); } catch (e) { return id || '無所属'; } }
function npcName(g, id) { try { return g.npcName(id) || ''; } catch (e) { return ''; } }
function npcLook(g, id) { const p = pol(g); return (p && p.npcs && p.npcs[id] && p.npcs[id].look) || LOOKS.salaryman; }
const surname = (full) => String(full || '').split(' ')[0];
function myFamilyName(g) { return (g.state.profile && g.state.profile.familyName) || g.state.name; }
function speakerId(g, house) { const p = pol(g); return p && p.flags ? p.flags[`speaker_${house}`] : null; }
function ruling(p, id) { return !!(p && p.cabinet && (p.cabinet.partyIds || []).includes(id)); }
// Bills at the plenary stage of a house (the 議事日程).
function plenaryBills(g, house) {
  const p = pol(g);
  if (!p || !p.diet) return [];
  return (p.diet.bills || []).filter((b) => b.house === house && b.stage === house);
}
function billsInCommittee(g, house) {
  const p = pol(g);
  if (!p || !p.diet) return [];
  return (p.diet.bills || []).filter((b) => b.house === house && b.stage === 'committee');
}
function alignOf(g, partyId, b) {
  if (!b.policy || typeof g.policyPreview !== 'function') return 0.5;
  try { const pv = g.policyPreview(b.policy, b.params); return pv && pv.alignment && pv.alignment[partyId] != null ? pv.alignment[partyId] : 0.5; } catch (e) { return 0.5; }
}
// How a party is expected to vote (a reading of politics.js houseVote: the hint and the picture).
function partyLine(g, partyId, b) {
  const p = pol(g);
  const rul = ruling(p, partyId);
  if (!partyId || partyId === 'ind') return b.kind === 'noconfidence' ? 'yes' : 'no';
  if (b.kind === 'budget') return rul ? 'yes' : 'no';
  if (b.kind === 'noconfidence') return rul ? 'no' : 'yes';
  const al = alignOf(g, partyId, b);
  if (b.sponsor === 'cabinet') return rul || al >= 0.62 ? 'yes' : 'no';
  if (b.party === partyId) return 'yes';
  if (b.kind === 'amendment') return al >= 0.6 ? 'yes' : 'no';
  if (rul) return al >= 0.75 ? 'yes' : 'no';
  return al >= 0.55 ? 'yes' : 'no';
}
const billLabel = (b) => (b.kind === 'noconfidence' ? '内閣不信任決議案' : b.title || '法律案');
function sponsorLabel(g, b) {
  if (b.kind === 'budget') return '内閣提出';
  if (b.kind === 'noconfidence') return `${partyName(g, b.party, true)}提出`;
  if (b.sponsor === 'cabinet') return '内閣提出';
  return b.by === 'player' ? 'あなたたちの議員立法' : `${partyName(g, b.party, true)}などの議員立法`;
}
// The minister answering for a policy area (or a bill): { post, id, name, look, label }.
function ministerFor(g, b, area) {
  const p = pol(g);
  if (!p) return null;
  const M = p.cabinet.ministers || {};
  let post = b && b.ministry && M[b.ministry] ? b.ministry : null;
  if (!post && area) post = Object.keys(M).find((k) => POL.POSTS && POL.POSTS[k] && (POL.POSTS[k].areas || []).includes(area) && M[k]);
  if (!post) post = M.kanbo ? 'kanbo' : null;
  const id = post ? M[post] : p.cabinet.pm;
  let label = '';
  try { label = post ? g.postLabel(post) : '内閣総理大臣'; } catch (e) { label = '大臣'; }
  if (id === 'player') return null;
  return { post, id, name: npcName(g, id), look: npcLook(g, id), label };
}
const shortPost = (label) => String(label || '').replace(/^内閣/, '').replace('国家公安委員会委員長', '国家公安委員長');

// ------------------------------------------------------------------ people (fictional staff)
const WHO = {
  guide: { name: '参観案内の衛視', look: { ...LOOKS.guard, hat: '#1f2a44', top: '#2a3560', bottom: '#1f2a44' } },
  guard: { name: '衛視', look: { ...LOOKS.guard, hat: '#1f2a44', top: '#2a3560', bottom: '#1f2a44', tie: '#14182a' } },
  bocho: { name: '傍聴人受付の係員', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#2a3560', bottom: '#2a3560', jacket: true } },
  jimu: { name: '事務総長', look: { hair: 'slick', hairColor: 'gray', skin: 'fair', top: '#1f2230', bottom: '#1f2230', jacket: true, tie: '#3a3a5a', glasses: true } },
  iinbu: { name: '委員部の職員', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#2f3a4f', bottom: '#2f3a4f', jacket: true, tie: '#5a6a8a' } },
  hisho: { name: '政策担当秘書の白石', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#3a4256', bottom: '#2a2d36', jacket: true, skirt: true, glasses: true } },
  shisetsu: { name: '私設秘書の小野', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3b3f48', bottom: '#2a2d36', jacket: true, tie: '#2f6fd0' } },
  press: { name: '国会記者', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#5a6f8a', bottom: '#3b3f48', jacket: true } },
  visitor: { name: '見学の高校生', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#1f2a44', bottom: '#1f2a44' } },
};
const say = (w) => ({ name: w.name, look: w.look });
function npc(id, x, y, dir, w, extra = {}) { return { type: 'npc', id, x, y, dir, name: w.name, look: w.look, ...extra }; }

// ------------------------------------------------------------------ chamber geometry
// The hemicycle is centred on the 演壇; in the 3/4 view a circle shows as an ellipse (EL).
// Seat cells (solid) are computed from it; the seats themselves are painted (bakeChamber).
const CH_W = 30, CH_H = 17, CX = 15, CY = 4.5, EL = 0.75;
const R_IN = 4.3, R_OUT = 14.2, A_MIN = 12, A_MAX = 168, AISLES = [52, 128];
const MY_SEAT = { x: 13, y: 11 };
function seatCell(x, y) {
  const dx = x + 0.5 - CX, dys = y + 0.5 - CY;
  if (dys <= 0) return false;
  const dy = dys / EL;
  const Rr = Math.hypot(dx, dy);
  const th = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (Rr < R_IN || Rr > R_OUT || th < A_MIN || th > A_MAX) return false;
  if (Math.abs(dx) < 1.01) return false; // centre aisle
  for (const a of AISLES) {
    const ux = Math.cos((a * Math.PI) / 180), uy = EL * Math.sin((a * Math.PI) / 180);
    if (Math.abs(dx * uy - dys * ux) / Math.hypot(ux, uy) < 0.8) return false; // radial aisles
  }
  return true;
}
function chamberTiles(house) {
  const rows = [];
  for (let y = 0; y < CH_H; y++) {
    let s = '';
    for (let x = 0; x < CH_W; x++) s += (y === 0 || y === CH_H - 1 || x === 0 || x === CH_W - 1) ? '#' : seatCell(x, y) ? 'S' : '.';
    rows.push(s);
  }
  const put = (x, y, str) => { rows[y] = rows[y].slice(0, x) + str + rows[y].slice(x + str.length); };
  put(1, 1, '='.repeat(CH_W - 2));
  put(13, 1, house === 'sangi' ? 'OPQR' : 'XXXX');
  put(1, 3, 'm'.repeat(12)); put(13, 3, 'CDDE'); put(17, 3, 'j'); put(18, 3, 'm'.repeat(CH_W - 19));
  put(14, 5, 'rt');
  put(MY_SEAT.x, MY_SEAT.y, 'Y');
  put(14, CH_H - 1, 'MM');
  return rows;
}
const CHAMBER_ROWS = { shugi: chamberTiles('shugi'), sangi: chamberTiles('sangi') };
const isSeatChar = (ch) => ch === 'S' || ch === 'Y';

// Seat positions (tile units) inside the seat cells, sorted back-to-front.
function mapSeatLayout(house) {
  const rows = CHAMBER_ROWS[house];
  const out = [];
  for (let Rr = 4.75; Rr < R_OUT; Rr += 0.92) {
    const n = Math.floor((Math.PI * Rr * ((A_MAX - A_MIN) / 180)) / 0.54);
    for (let i = 0; i <= n; i++) {
      const thd = A_MIN + ((A_MAX - A_MIN) * i) / n;
      const th = (thd * Math.PI) / 180;
      const x = CX + Rr * Math.cos(th), y = CY + EL * Rr * Math.sin(th);
      const ch = (rows[Math.floor(y)] || '')[Math.floor(x)];
      if (!isSeatChar(ch)) continue;
      out.push({ x, y, th: thd, R: Rr, mine: ch === 'Y' });
    }
  }
  // only one "my seat" (the one nearest the aisle)
  let first = true;
  for (const s of out.filter((q) => q.mine).sort((a, b) => b.x - a.x)) { s.mine = first; first = false; }
  out.sort((a, b) => a.y - b.y);
  return out;
}
const MAP_SEATS = { shugi: mapSeatLayout('shugi'), sangi: mapSeatLayout('sangi') };

// Schematic hemicycle (gallery view, vote scene): seats with a radial gap at the aisles.
function schematicLayout(cx, cy, r0, r1, rows, el, spacing) {
  const out = [];
  for (let k = 0; k < rows; k++) {
    const Rr = r0 + ((r1 - r0) * k) / Math.max(1, rows - 1);
    const n = Math.floor((Math.PI * Rr * ((A_MAX - A_MIN) / 180)) / spacing);
    for (let i = 0; i <= n; i++) {
      const thd = A_MIN + ((A_MAX - A_MIN) * i) / n;
      if ([...AISLES, 90].some((a) => Math.abs(thd - a) * (Math.PI / 180) * Rr < spacing * (a === 90 ? 1.1 : 0.8))) continue;
      const th = (thd * Math.PI) / 180;
      out.push({ x: cx + Rr * Math.cos(th), y: cy + el * Rr * Math.sin(th), th: thd, R: Rr, row: k });
    }
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}

// Party colours for N seats: wedges by party (ruling side first), like a seating chart.
function seatParties(g, house, n, local = false) {
  const p = pol(g);
  let table = {};
  if (p && local && p.local && p.local.kugi) table = p.local.kugi.seats || {};
  else if (p && p.diet && p.diet[house]) table = p.diet[house].seats || {};
  const entries = Object.entries(table).filter(([, v]) => num(v) > 0);
  const total = entries.reduce((a, [, v]) => a + num(v), 0) || 1;
  entries.sort((a, b) => (ruling(p, b[0]) - ruling(p, a[0])) || (a[0] === 'ind') - (b[0] === 'ind') || num(b[1]) - num(a[1]));
  const list = [];
  let acc = 0;
  for (const [id, v] of entries) {
    acc += num(v);
    const upto = Math.round((acc / total) * n);
    while (list.length < upto) list.push(id);
  }
  while (list.length < n) list.push('ind');
  return { list, entries, total };
}
function partyColor(g, id) {
  const p = pol(g);
  const pt = p && p.parties && p.parties[id];
  return (pt && pt.color) || '#8a8a96';
}
const HAIRS = ['#1e1a1a', '#262220', '#3a3634', '#6a6a6a', '#9a9a9a', '#d8d8d8', '#3a2a20'];
const SUITS = ['#2a2f45', '#3a3f55', '#1f2a3a', '#4a4a52', '#2f3a4f', '#3a3436', '#5a3a4a', '#6a5a7a'];
const SKINS = ['#f6c9a0', '#e8b890', '#f0c0a0'];

// One seat: desk (toward the 演壇), the member seen from behind, the chair back.
// z: metrics ('L' map scale, 'S' schematic). s: { color, member, hair, suit, skin, stand, lamp, mine }
const ZL = { dw: 16, dh: 4, dy: 16, hs: 6, hy: 13, sw: 10, sh: 4, sy: 8, cw: 10, ch: 7, cy: 6, rise: 6, plate: true };
const ZS = { dw: 9, dh: 2, dy: 9, hs: 4, hy: 8, sw: 6, sh: 3, sy: 5, cw: 6, ch: 4, cy: 3, rise: 4, plate: false };
function paintSeat(c, x0, y0, z, s) {
  const x = Math.round(x0), y = Math.round(y0);
  const hw = (w) => Math.floor(w / 2);
  R(c, x - hw(z.dw), y - z.dy, z.dw, z.dh, WD); R(c, x - hw(z.dw), y - z.dy, z.dw, 1, WDL); R(c, x - hw(z.dw), y - z.dy + z.dh - 1, z.dw, 1, WDX);
  if (z.plate) { R(c, x + hw(z.dw) - 4, y - z.dy - 4, 2, 5, s.mine ? GOLD : '#141414'); if (s.mine) P(c, x + hw(z.dw) - 4, y - z.dy - 4, GOLDL); }
  if (s.lamp) { R(c, x - 2, y - z.dy - 3, 4, 3, s.lamp); R(c, x - 2, y - z.dy - 3, 4, 1, '#ffffff'); }
  if (s.member) {
    const up = s.stand ? z.rise : 0;
    const suit = s.dim ? shade(s.suit, -0.45) : s.suit, hair = s.dim ? shade(s.hair, -0.45) : s.hair;
    R(c, x - hw(z.sw), y - z.sy - up, z.sw, z.sh + up, suit);
    R(c, x - hw(z.sw), y - z.sy - up, z.sw, 1, shade(suit, s.stand ? 0.4 : 0.18));
    if (s.stand) { R(c, x - 1, y - z.sy - up, 2, 1, '#f4f4f4'); R(c, x - hw(z.sw) - 1, y - z.sy - up + 1, 1, z.sh + up - 1, shade(suit, 0.3)); }
    const hx = x - hw(z.hs), hy = y - z.hy - up;
    R(c, hx, hy, z.hs, z.hs, hair);
    R(c, hx + 1, hy, z.hs - 2, 1, shade(s.hair, 0.25));
    if (z.hs >= 6) { P(c, hx - 1, hy + 3, s.skin); P(c, hx + z.hs, hy + 3, s.skin); R(c, hx + 1, hy + z.hs, z.hs - 2, 1, s.skin); }
    else R(c, hx, hy + z.hs, z.hs, 1, s.skin);
    if (s.ballot) { R(c, x + hw(z.sw), y - z.sy - up - 2, 2, z.plate ? 4 : 3, s.ballot); }
  }
  const col = s.color;
  R(c, x - hw(z.cw), y - z.cy, z.cw, z.ch, col);
  R(c, x - hw(z.cw), y - z.cy, z.cw, 1, shade(col, 0.28));
  R(c, x - hw(z.cw), y - z.cy + z.ch - 1, z.cw, 1, shade(col, -0.4));
  if (z.cw >= 10) { R(c, x - hw(z.cw), y - z.cy, 1, z.ch, shade(col, -0.25)); R(c, x + hw(z.cw) - 1, y - z.cy, 1, z.ch, shade(col, -0.25)); }
  if (s.mine && s.markMine) { R(c, x - 1, y - z.cy - z.ch - z.hs - 8, 3, 3, '#ffd23f'); }
}
function chairColor(g, id) { return mix(partyColor(g, id), '#2a1414', 0.32); }
function memberLooks(i) {
  const h = hash2(i, 3, 17), k = hash2(i, 7, 23);
  return { hair: HAIRS[Math.floor(h * HAIRS.length)], suit: SUITS[Math.floor(k * SUITS.length)], skin: SKINS[i % SKINS.length] };
}

// The baked seats of a chamber (map scale: one tile = 32 px), redrawn when the seats change.
const chamberCache = {};
function bakeChamber(g, house) {
  const seats = MAP_SEATS[house];
  const S = sessionOf(g);
  const mineHere = myHouse(g) === house;
  const { list } = seatParties(g, house, seats.length);
  const order = seats.map((s, i) => i).sort((a, b) => seats[b].th - seats[a].th);
  const party = new Array(seats.length);
  order.forEach((si, k) => { party[si] = list[k]; });
  const key = `${house}|${S ? 1 : 0}|${mineHere ? 1 : 0}|${list.join(',')}`;
  const cached = chamberCache[house];
  if (cached && cached.key === key) return cached.cv;
  const [cv, c] = makeCanvas(CH_W * 32, CH_H * 32);
  seats.forEach((s, i) => {
    const lk = memberLooks(i);
    const present = !!S && !s.mine && hash2(i, 11, today(g)) < 0.94;
    paintSeat(c, s.x * 32, s.y * 32 + 8, ZL, { color: chairColor(g, party[i]), member: present, ...lk, mine: s.mine && mineHere, markMine: false });
  });
  chamberCache[house] = { key, cv };
  return cv;
}
function chamberUnder(house) {
  return (ctx, g, cam) => {
    const cv = bakeChamber(g, house);
    ctx.drawImage(cv, -cam.x, -cam.y, cv.width / 2, cv.height / 2);
  };
}

// ------------------------------------------------------------------ schematic painter (gallery & vote scene)
// ctx: any 2D context in pixels. o: { cx, cy, seats (layout), parties (ids per seat), present, votes, prog,
// method, mineIdx, house }
function paintChamberSchematic(ctx, g, o) {
  const { cx, cy } = o;
  const k = o.scale || 1;
  const Q = (x, y, w, h, col) => R(ctx, Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), col);
  // floor & back wall
  Q(o.x0, o.y0, o.w, o.h, '#5e1a1c');
  dither(ctx, o.x0, o.y0, o.w, o.h, '#6a2224', 0);
  Q(o.x0, o.y0, o.w, 26 * k, WD);
  Q(o.x0, o.y0 + 26 * k, o.w, 2, GOLDD);
  for (let x = o.x0 + 8; x < o.x0 + o.w; x += Math.round(40 * k)) Q(x, o.y0, 3, 26 * k, WDL);
  if (o.house === 'sangi') { Q(cx - 12 * k, o.y0 + 2, 24 * k, 20 * k, GOLD); Q(cx - 9 * k, o.y0 + 4, 18 * k, 16 * k, '#7a1a20'); Q(cx - 4 * k, o.y0 + 8, 8 * k, 8 * k, GOLDD); }
  // 国務大臣席 (two rows each side), 議長席 with the 議長, 事務総長, 演壇
  for (const sgn of [-1, 1]) {
    for (let r = 0; r < 2; r++) {
      const w = 112 * k, x = sgn < 0 ? cx - 40 * k - w : cx + 40 * k;
      Q(x, cy - (34 - r * 12) * k, w, 5 * k, r ? WD : '#3f5a4a');
      Q(x, cy - (34 - r * 12) * k, w, 1, r ? WDL : '#5a7a66');
    }
  }
  Q(cx - 34 * k, cy - 30 * k, 68 * k, 15 * k, WDL); Q(cx - 34 * k, cy - 30 * k, 68 * k, 2, GOLD); Q(cx - 34 * k, cy - 16 * k, 68 * k, 1, WDX);
  Q(cx - 3 * k, cy - 38 * k, 6 * k, 6 * k, '#2a2a2a'); Q(cx - 4 * k, cy - 33 * k, 8 * k, 3 * k, '#1f2230');
  Q(cx - 14 * k, cy - 10 * k, 28 * k, 10 * k, WD); Q(cx - 14 * k, cy - 10 * k, 28 * k, 1, '#a07048');
  // seats
  const z = ZS;
  o.seats.forEach((s, i) => {
    const pid = o.parties[i];
    const v = o.votes ? o.votes[i] : null;
    let stand = false, lamp = null, ballot = null;
    if (v && o.method === 'kiritsu') stand = v === 'yes' && o.prog > (hash2(i, 5, 9) * 0.6);
    const dim = !!(o.votes && o.method === 'kiritsu' && o.prog > 0.6 && !stand);
    if (v && o.method === 'button' && o.prog > hash2(i, 5, 9) * 0.8) lamp = v === 'yes' ? '#f4f4f4' : v === 'no' ? '#3a7ad8' : null;
    if (v && o.method === 'kimei' && o.prog > hash2(i, 5, 9) * 0.9) ballot = v === 'yes' ? '#f4f4f4' : v === 'no' ? '#3a7ad8' : null;
    const present = o.present ? o.present(i) : true;
    paintSeat(ctx, s.x, s.y, z, { color: chairColor(g, pid), member: present, ...memberLooks(i), stand, dim, lamp, ballot, mine: i === o.mineIdx, markMine: i === o.mineIdx });
  });
}

// ------------------------------------------------------------------ the vote scene (HD overlay)
// method: 'kiritsu' 起立 | 'igi' 異議なし | 'kimei' 記名投票 | 'button' 押しボタン
function voteMethod(g, house, b, v) {
  const year = yearOf(g);
  if (house === 'sangi' && year >= 1998) return b.kind === 'budget' || b.kind === 'amendment' ? 'kimei' : 'button';
  if (b.kind === 'budget' || b.kind === 'noconfidence' || b.kind === 'amendment' || b.revote) return 'kimei';
  if (v && v.no <= Math.max(2, (v.yes + v.no) * 0.02)) return 'igi';
  return 'kiritsu';
}
const METHOD_NAME = { kiritsu: '起立採決', igi: '異議の有無', kimei: '記名投票', button: '押しボタン式投票' };
const VOTE_GEO = { cx: 320, cy: 74, r0: 56, r1: 254, rows: 11, el: 0.62, spacing: 9.6 };
const VOTE_SEATS = schematicLayout(VOTE_GEO.cx, VOTE_GEO.cy + 16, VOTE_GEO.r0, VOTE_GEO.r1, VOTE_GEO.rows, VOTE_GEO.el, VOTE_GEO.spacing);
class VoteScene {
  constructor(g, o) {
    Object.assign(this, { g, t: 0, hd: true, opaque: true, hidesHud: true, prog: 0, phase: 'intro' }, o);
    const n = VOTE_SEATS.length;
    const { list } = seatParties(g, o.house, n);
    const order = VOTE_SEATS.map((s, i) => i).sort((a, b) => VOTE_SEATS[b].th - VOTE_SEATS[a].th);
    this.parties = new Array(n);
    order.forEach((si, k) => { this.parties[si] = list[k]; });
    // the player's seat: right of the centre aisle, middle rows
    let best = -1, bd = 1e9;
    VOTE_SEATS.forEach((s, i) => { const d = Math.hypot(s.x - 300, s.y - 190); if (d < bd) { bd = d; best = i; } });
    this.mineIdx = o.member ? best : -1;
    // who votes how: scale each party's line to the real totals
    this.votes = new Array(n).fill(null);
    if (o.v) {
      const tot = Math.max(1, o.v.yes + o.v.no + num(o.v.absent));
      const wantYes = Math.round((o.v.yes / tot) * n), wantAbs = Math.round((num(o.v.absent) / tot) * n);
      const idx = VOTE_SEATS.map((s, i) => i).filter((i) => i !== this.mineIdx);
      const lineOf = {};
      for (const pid of new Set(this.parties)) lineOf[pid] = partyLine(g, pid, o.bill);
      idx.sort((a, b) => (lineOf[this.parties[a]] === 'yes' ? 0 : 1) - (lineOf[this.parties[b]] === 'yes' ? 0 : 1) || hash2(a, 2, 3) - hash2(b, 2, 3));
      idx.forEach((i, k) => { this.votes[i] = k < wantYes ? 'yes' : 'no'; });
      idx.slice().sort((a, b) => hash2(a, 9, 1) - hash2(b, 9, 1)).slice(0, wantAbs).forEach((i) => { this.votes[i] = null; this.absent = this.absent || new Set(); this.absent.add(i); });
      if (this.mineIdx >= 0) this.votes[this.mineIdx] = o.mine === 'yes' || o.mine === 'no' ? o.mine : null;
    }
  }
  update() { this.t++; if (this.phase === 'count') this.prog = Math.min(1, this.prog + 1 / 80); }
  draw(ctx) {
    const g = this.g;
    R(ctx, 0, 0, SW, SH, '#1a1210');
    paintChamberSchematic(ctx, g, {
      x0: 0, y0: 0, w: SW, h: SH, cx: VOTE_GEO.cx, cy: VOTE_GEO.cy, house: this.house, seats: VOTE_SEATS, parties: this.parties,
      votes: this.phase === 'intro' ? null : this.votes, prog: this.prog, method: this.method, mineIdx: this.mineIdx,
      present: (i) => !(this.absent && this.absent.has(i)) || this.phase === 'intro',
    });
    if (this.mineIdx >= 0) {
      const s = VOTE_SEATS[this.mineIdx];
      const bob = Math.floor(this.t / 12) % 2;
      text(ctx, '▼あなた', Math.round(s.x) - 2, Math.round(s.y) - 30 - bob, { size: 12, align: 'center', color: COLORS.accent, outline: '#000' });
    }
    // title card
    panel(ctx, 8, 8, 236, 58, { bg: '#1c1a2a' });
    text(ctx, `${houseName(this.house)}本会議`, 20, 14, { size: 16, color: COLORS.accent });
    text(ctx, METHOD_NAME[this.method] || '', 232, 16, { size: 12, align: 'right', color: COLORS.cyan });
    const title = billLabel(this.bill);
    text(ctx, title.length > 17 ? title.slice(0, 16) + '…' : title, 20, 40, { size: 14 });
    // tally board
    if (this.method === 'kimei' || this.method === 'button') {
      const k = this.phase === 'intro' ? 0 : this.prog;
      const yes = Math.round(num(this.v && this.v.yes) * k), no = Math.round(num(this.v && this.v.no) * k);
      panel(ctx, SW - 172, 8, 164, 76, { bg: '#10141c' });
      text(ctx, this.method === 'kimei' ? '白票（賛成）' : '賛成', SW - 160, 16, { size: 14, color: '#f4f4f4' });
      text(ctx, String(yes), SW - 20, 16, { size: 16, align: 'right', color: '#f4f4f4' });
      text(ctx, this.method === 'kimei' ? '青票（反対）' : '反対', SW - 160, 40, { size: 14, color: '#7fb0ff' });
      text(ctx, String(no), SW - 20, 40, { size: 16, align: 'right', color: '#7fb0ff' });
      if (this.phase === 'result') text(ctx, this.v && this.v.passed ? '可決' : '否決', SW - 90, 62, { size: 14, align: 'center', color: this.v && this.v.passed ? COLORS.good : COLORS.bad });
    } else if (this.phase === 'result') {
      panel(ctx, SW - 172, 8, 164, 40, { bg: '#10141c' });
      text(ctx, this.method === 'igi' ? '異議なし' : this.v && this.v.passed ? '起立多数' : '起立少数', SW - 90, 18, { size: 16, align: 'center', color: this.v && this.v.passed ? COLORS.good : COLORS.bad });
    }
    if (this.mine) {
      const w = { yes: '賛成', no: '反対', abstain: '棄権' }[this.mine] || '';
      if (w) { panel(ctx, 8, 70, 120, 30, { bg: '#2a2410' }); text(ctx, `あなた：${w}`, 20, 77, { size: 14, color: COLORS.accent }); }
    }
  }
}

// ------------------------------------------------------------------ plenary: run and show a vote
async function speak(g, house, lines, who = 'speaker') {
  const p = pol(g);
  if (who === 'speaker') {
    const id = speakerId(g, house);
    return g.say(lines, { name: '議長', look: id ? npcLook(g, id) : LOOKS.oldman });
  }
  if (who === 'jimu') return g.say(lines, say(WHO.jimu));
  if (who === 'chair') return g.say(lines, { name: '委員長', look: npcLook(g, p && p.flags && p.flags.chair_budget) });
  return g.say(lines, who);
}
// Choose the player's vote on a bill (party line first, so the autopilot follows it).
async function chooseVote(g, b) {
  const m = me(g);
  const line = m.party ? partyLine(g, m.party, b) : null;
  const W = { yes: '賛成', no: '反対' };
  const choices = line ? [`${W[line]}（党の方針）`, line === 'yes' ? '反対する' : '賛成する', '棄権する'] : ['賛成する', '反対する', '棄権する'];
  const vals = line ? [line, line === 'yes' ? 'no' : 'yes', 'abstain'] : ['yes', 'no', 'abstain'];
  const head = [`${billLabel(b)}（${sponsorLabel(g, b)}）`];
  if (b.kind !== 'noconfidence' && b.kind !== 'budget') head.push(b.committeeNo ? '委員会では否決すべきもの、と決まった法案だ。' : '委員会では可決すべきもの、と決まった法案だ。');
  head.push(line ? `${partyName(g, m.party)}の方針は「${W[line]}」。どうする？` : '無所属なので、自分の考えで決められる。どうする？');
  const k = await g.ask(head, choices, { cancel: 2 });
  let v = vals[k];
  if (line && v !== line && v !== 'abstain') {
    const nc = b.kind === 'noconfidence' && ruling(pol(g), m.party);
    const warn = nc
      ? ['（与党の議員が内閣不信任案に賛成すれば、党を除名されるだろう…）']
      : ['（党議拘束にそむく投票だ。党内での立場は悪くなる…）'];
    const c = await g.ask(warn, ['考え直す', 'それでも投票する'], { cancel: 0 });
    if (c === 0) v = line;
  }
  const why = g.vote(b.id, v);
  if (why) { await g.say(`（${why}）`); return null; }
  return v;
}
// Run the plenary votes of a house now (the agenda of the day). member: the player votes.
async function runPlenary(g, house, { member = false, max = 3 } = {}) {
  const bills = plenaryBills(g, house).slice(0, max);
  if (!bills.length) return 0;
  let shown = 0;
  for (const [n, b] of bills.entries()) {
    const key = house + (b.revote ? '_revote' : '');
    const before = b.votes ? b.votes[key] : null;
    let mine = null;
    if (member) {
      mine = await chooseVote(g, b);
      if (mine == null) continue;
    }
    if (num(b.next) > today(g)) b.next = today(g);
    try { g.advanceBills(); } catch (e) { console.error(e); }
    const v = b.votes ? b.votes[key] : null;
    if (!v || v === before) {
      await g.say(`（「${billLabel(b)}」の採決は、次の本会議に持ち越された）`);
      continue;
    }
    await showVote(g, house, b, v, { mine, member, revote: key.endsWith('_revote'), no: n });
    shown++;
  }
  return shown;
}
async function showVote(g, house, b, v, o = {}) {
  const method = voteMethod(g, house, b, v);
  const sc = new VoteScene(g, { house, bill: b, v, method, mine: o.mine, member: !!o.member });
  g.push(sc);
  const p = pol(g);
  const isNc = b.kind === 'noconfidence';
  const nth = `日程第${'一二三四五'[o.no || 0] || '一'}`;
  const intro = isNc
    ? [`${partyName(g, b.party)}ほか提出、内閣不信任決議案を議題といたします。`, '提出者の趣旨弁明、討論ののち、採決に入ります。']
    : b.kind === 'budget'
      ? [`${nth}、${billLabel(b)}を議題といたします。`, '委員長の報告を求めます。']
      : o.revote
        ? [`${billLabel(b)}は、参議院で否決されました。`, '憲法第59条第2項により、本院の議決を再議に付します。出席議員の3分の2以上の多数が必要です。']
        : [`${nth}、${billLabel(b)}（${sponsorLabel(g, b)}）を議題といたします。`, '委員長の報告を求めます。'];
  await speak(g, house, intro);
  if (!isNc && !o.revote) await g.say(['ただいま議題となりました案件につきまして、\n委員会における審査の経過と結果を報告いたします。', b.committeeNo ? '採決の結果、本案は否決すべきものと決しました。以上、報告いたします。' : '採決の結果、本案は可決すべきものと決しました。以上、報告いたします。'], { name: '委員長', look: npcLook(g, p && p.flags && p.flags.chair_budget) });
  sc.phase = 'vote';
  if (method === 'kiritsu') await speak(g, house, ['これより採決いたします。', '本案に賛成の諸君の起立を求めます。']);
  else if (method === 'igi') await speak(g, house, ['これより採決いたします。', '本案を委員長報告のとおり決するに、御異議ありませんか。']);
  else if (method === 'kimei') await speak(g, house, ['これより記名投票をもって採決いたします。', '本案に賛成の諸君は白票、反対の諸君は青票を持参されることを望みます。', '――議場閉鎖。氏名点呼を命じます。']);
  else await speak(g, house, ['これより採決をいたします。', '本案の賛否について、投票ボタンをお押し願います。']);
  sc.phase = 'count';
  g.sfx(method === 'button' ? 'cursor' : 'talk');
  await g.waitFrames(method === 'igi' ? 30 : 90);
  sc.prog = 1;
  sc.phase = 'result';
  await g.waitFrames(24);
  const passed = !!v.passed;
  if (method === 'kiritsu') await speak(g, house, passed ? '起立多数。よって、本案は可決いたしました。' : '起立少数。よって、本案は否決されました。');
  else if (method === 'igi') { await g.say('「異議なし」（と呼ぶ者あり）'); await speak(g, house, '御異議なしと認めます。よって、本案は可決いたしました。'); }
  else if (method === 'kimei') {
    await speak(g, house, ['投票漏れはありませんか。――投票漏れなしと認めます。', '投票箱閉鎖。開票。――議場開鎖。', '投票の結果を事務総長から報告させます。']);
    await speak(g, house, `投票総数${v.yes + v.no}\n　可とする者（白票）${v.yes}\n　否とする者（青票）${v.no}`, 'jimu');
    await speak(g, house, passed ? '右の結果、本案は可決いたしました。' : '右の結果、本案は否決されました。');
  } else {
    await speak(g, house, ['間もなく投票を終了いたします。――これにて投票を終了いたします。', `投票の結果を報告いたします。\n投票総数${v.yes + v.no}、賛成${v.yes}、反対${v.no}。`, passed ? 'よって、本案は可決されました。' : 'よって、本案は否決されました。']);
  }
  g.sfx(passed ? 'applause' : 'drum');
  g.pop(sc);
  await explainOutcome(g, house, b, passed, o);
}
async function explainOutcome(g, house, b, passed, o = {}) {
  const p = pol(g);
  const lines = [];
  if (b.kind === 'noconfidence') {
    if (passed) {
      lines.push('（内閣不信任決議案が可決された！）');
      lines.push(p && p.diet && p.diet.shugi && p.diet.shugi.dissolved ? '（内閣は衆議院を解散した。総選挙になる…）' : '（憲法69条：内閣は10日以内に衆議院を解散するか、\n総辞職しなければならない）');
    } else lines.push('（不信任案は否決され、内閣は続投する）');
  } else if (b.stage === 'enacted') lines.push(b.kind === 'budget' ? '（予算が成立した）' : `（「${billLabel(b)}」は成立し、法律になった）`);
  else if (b.stage === 'referendum') lines.push('（両院の3分の2で憲法改正が発議された。\n次は国民投票で、過半数の賛成が必要だ）');
  else if (b.revote && b.house === 'shugi' && house === 'sangi') lines.push('（参議院で否決。衆議院で3分の2以上の再可決をめざすことに）');
  else if (b.stage === 'rejected') lines.push(`（「${billLabel(b)}」は${b.result || '否決'}となった）`);
  else if (passed && b.house !== house) lines.push(`（本案は${houseName(b.house)}に送られ、委員会での審査が始まる）`);
  if (o.member && o.mine) {
    const m = me(g);
    const line = m.party ? partyLine(g, m.party, b) : null;
    if (line && o.mine !== line && o.mine !== 'abstain') lines.push('（党の方針と違う票を投じた。党内の目が冷たい…）');
  }
  if (lines.length) await g.say(lines);
}

// ------------------------------------------------------------------ the player's seat (members)
async function seatMenu(g, house) {
  const h = myHouse(g);
  if (h !== house) {
    await g.say(h ? `ここは${houseName(house)}の議席だ。\n（${houseName(h)}議員は、こちらの議場では投票できない）` : '氏名標が立った議席が、半円形にずらりと並んでいる。\n（議席に座れるのは、この院の議員だけだ）');
    return;
  }
  const S = sessionOf(g);
  if (!S) {
    await g.say(['自分の議席だ。黒い氏名標に、自分の名前が書いてある。', '（いまは国会が閉会中。次の国会の召集を待とう）']);
    return;
  }
  const m = me(g);
  const attended = m.attend && m.attend.last === today(g);
  const agenda = plenaryBills(g, house);
  const items = [attended ? '議事日程を見る' : '出席して着席する', agenda.length ? '本会議で採決する' : '本会議はない', 'やめる'];
  if (house === 'shugi' && m.party && !ruling(pol(g), m.party)) items.splice(2, 0, '不信任案を出す');
  const k = await g.ask([`自分の議席だ。（${S.kind}・会期中）`, agenda.length ? `今日の本会議の議事日程は、${agenda.length}件。` : '今日の本会議に、採決の案件はない。'], items, { cancel: items.length - 1 });
  const pick = items[k];
  if (pick === '出席して着席する' || pick === '議事日程を見る') {
    if (!attended) {
      const r = g.attendDiet();
      if (!r.ok) { await g.say(`（${r.why}）`); return; }
      g.sfx('ok');
      await g.say('（議席に着いた。今日の出席が記録された）');
    }
    await showAgenda(g, house);
    return;
  }
  if (pick === '本会議で採決する') {
    if (!attended) { const r = g.attendDiet(); if (!r.ok) { await g.say(`（${r.why}）`); return; } }
    const n = await runPlenary(g, house, { member: true });
    if (n) await speak(g, house, '本日は、これにて散会いたします。');
    return;
  }
  if (pick === '不信任案を出す') { await noConfidenceFlow(g); return; }
}
async function showAgenda(g, house) {
  const plen = plenaryBills(g, house);
  const comm = billsInCommittee(g, house);
  const lines = [];
  if (plen.length) lines.push(`【本会議】\n${plen.slice(0, 3).map((b, i) => `日程第${'一二三'[i]}　${billLabel(b)}`).join('\n')}`);
  else lines.push('【本会議】今日の採決の案件はない。');
  if (comm.length) lines.push(`【委員会で審査中】${comm.length}件\n${comm.slice(0, 2).map((b) => `・${billLabel(b)}`).join('\n')}`);
  await g.say(lines);
}
async function noConfidenceFlow(g) {
  const law = ['内閣不信任決議案は、衆議院だけが出せる。\n可決されると、内閣は10日以内に解散か総辞職（憲法69条）。', '提出には50人以上の賛成者がいる（目安）。\n野党が結束すれば数はそろうが、可決には過半数が必要だ。'];
  const k = await g.ask(law, ['やめておく', '提出する'], { cancel: 0 });
  if (k !== 1) return;
  const r = g.noConfidence({});
  if (!r || !r.ok) { await g.say(`（${(r && r.why) || '提出できなかった'}）`); return; }
  const p = pol(g);
  const b = p.diet.bills.find((x) => x.id === r.billId) || { kind: 'noconfidence', title: '内閣不信任決議案', party: me(g).party };
  await showVote(g, 'shugi', b, { yes: r.yes, no: r.no, absent: 0, passed: r.passed }, { mine: 'yes', member: true });
}

// ------------------------------------------------------------------ 傍聴 (anyone with a ticket)
async function bochoWatch(g, house) {
  const S = sessionOf(g);
  if (!S) { await g.say(['議場は静まりかえっている。', '（いまは国会の閉会中。本会議は開かれていない）']); return; }
  await g.say(['（傍聴席に腰をおろした。下に議場が見える）', '（傍聴席では、拍手・発言・撮影・録音は禁止。\n静かに見守ろう）']);
  const n = await runPlenary(g, house, { member: false, max: 2 });
  if (n) { await speak(g, house, '本日は、これにて散会いたします。'); g.relax({ stress: 2 }); await g.say('（国会で法案が採決される瞬間を、この目で見た…）'); return; }
  const p = pol(g);
  const pmName = surname(npcName(g, p && p.cabinet && p.cabinet.pm));
  if (today(g) - num(S.start) <= 2 && S.kind !== '特別国会') {
    const speech = S.kind === '通常国会' ? '施政方針演説' : '所信表明演説';
    await g.say([`今日は、総理大臣の${speech}の日だ。`, `${pmName}総理「暮らしの安心と、経済の力強さ。その両方を、\n国民の皆さまとともに築いてまいります」`, '（演説のあと、各会派の代表が質問に立つ。\n国会の論戦が、ここから始まる）'], { name: '' });
    return;
  }
  const comm = billsInCommittee(g, house);
  await g.say(['今日は、本会議での採決の案件はないようだ。', comm.length ? `（法案は${comm.length}件が委員会で審査中。\n国会の審議の多くは、委員会で行われる）` : '（委員会での審査が中心の日らしい）']);
}

// ------------------------------------------------------------------ 委員会：質疑（議員）と答弁（大臣）
// A short exchange: three rounds of choices, then politics.js activity() with the score.
class Caption {
  constructor(o) { Object.assign(this, { hd: true, t: 0 }, o); }
  update() { this.t++; }
  draw(ctx) {
    panel(ctx, 8, 52, 300, 46, { bg: '#13233a' });
    text(ctx, this.title, 20, 58, { size: 12, color: COLORS.cyan });
    text(ctx, this.sub, 20, 76, { size: 14 });
    if (this.left != null) {
      const w = 120;
      R(ctx, SW - w - 16, 56, w, 8, '#000'); R(ctx, SW - w - 15, 57, Math.max(0, (w - 2) * this.left), 6, this.left > 0.3 ? '#5ee07a' : '#ff5d6c');
      text(ctx, '持ち時間', SW - w - 16, 66, { size: 12, color: COLORS.dim });
    }
  }
}
const Q_ROUNDS = [
  [['数字を示して聞く', 34, '{t}について伺います。昨年度の実績と今年度の目標を、\n数字でお示しください。'], ['現場の声を伝える', 30, '地元で、{t}について多くの声を聞いてきました。\n現場は、いまも困っています。'], ['大臣の資質を問う', 8, 'そもそも大臣に、この問題を担う資格があるのですか！']],
  [['具体的に、と迫る', 32, '「適切に」では分かりません。いつまでに、何を、\nどれだけやるのか。具体的にお答えください。'], ['資料を示す', 30, 'お手元の資料をご覧ください。\nこの数字を見れば、対策の遅れは明らかです。'], ['ヤジに言い返す', 4, '（与党席のヤジに、大声で言い返した）']],
  [['提案して締める', 34, 'では、こう提案します。対象を広げ、手続きを簡単に。\n前向きにご検討いただけますか。'], ['答弁を確認する', 30, 'いまの「年内をめどに」という答弁、\n議事録に残ります。よろしいですね。'], ['時間いっぱい演説', 10, '（持論を語り続けているうちに、時間が来てしまった…）']],
];
const A_ROUNDS = [
  [['事実を正直に話す', 34, 'ご指摘の点は、事実として受け止めております。\n現状を率直に申し上げます。'], ['データで説明する', 30, 'お配りした資料のとおり、\n件数は前年より改善しております。'], ['答弁を控える', 14, '個別の案件については、お答えを差し控えます。']],
  [['改善策を約束する', 32, '年内をめどに具体策を取りまとめ、\n委員会にも報告いたします。'], ['経緯を説明する', 26, 'これまでの経緯を、順を追って説明いたします。'], ['強い言葉で反論', 4, 'ご質問は的外れです！\n（言いすぎた…議場がざわついている）']],
  [['謝意を述べて締める', 30, '貴重なご提案、ありがとうございます。\nしっかり検討してまいります。'], ['検討を約束する', 28, '前向きに検討いたします。'], ['話をそらす', 8, '…それよりも、別の成果を申し上げたい。']],
];
function topicsFor(g, house) {
  const p = pol(g);
  const out = [];
  for (const b of billsInCommittee(g, house).filter((x) => x.policy)) {
    const pl = POL.POLICIES && POL.POLICIES[b.policy];
    out.push({ label: billLabel(b), t: pl ? pl.name : billLabel(b), area: pl ? pl.area : null, bill: b });
  }
  const issues = (p && p.opinion && p.opinion.issues) || {};
  const areas = Object.keys(POL.POLICY_AREAS || {}).sort((a, b) => num(issues[b]) - num(issues[a]));
  for (const a of areas) { if (out.length >= 4) break; if (!out.some((x) => x.area === a)) out.push({ label: `${POL.POLICY_AREAS[a].name}について`, t: POL.POLICY_AREAS[a].name, area: a }); }
  return out.slice(0, 4);
}
async function exchange(g, rounds, o) {
  const cap = new Caption({ title: o.title, sub: o.sub, left: 1 });
  g.push(cap);
  let score = 0;
  const pickOrder = (r, i) => (hash2(today(g), i, 41) < 0.5 ? r : [r[1], r[0], r[2]]);
  for (let i = 0; i < rounds.length; i++) {
    if (o.before && o.before[i]) await o.before[i]();
    const opts = pickOrder(rounds[i], i);
    const k = await g.ask(o.prompt[i], opts.map((x) => x[0]), { cancel: 2 });
    const c = opts[k] || opts[2];
    score += c[1];
    await g.say(c[2].replaceAll('{t}', o.topic), o.selfSay);
    cap.left = Math.max(0, 1 - (i + 1) / rounds.length);
    if (o.after && o.after[i]) await o.after[i](c[1]);
  }
  g.pop(cap);
  const skill = num(g.state.skills && g.state.skills.talk);
  return clamp(Math.round(score + skill / 12), 0, 100);
}
async function shitsugi(g) {
  const m = me(g);
  const house = myHouse(g);
  if (!house) { await g.say('（委員会で質疑ができるのは、国会議員だけだ）'); return; }
  if (!sessionOf(g)) { await g.say('（国会は閉会中。委員会は開かれていない）'); return; }
  if (m.lastAct && m.lastAct['委員会で質問'] === today(g)) { await g.say('（今日の質疑はもう終えた。持ち時間は会派ごとに割り当てられている）'); return; }
  const topics = topicsFor(g, house);
  if (!topics.length) { await g.say('（今日は質疑の機会がないようだ）'); return; }
  const k = await g.list({ title: '質問の通告（テーマ）', items: [...topics.map((t) => t.label.length > 18 ? t.label.slice(0, 17) + '…' : t.label), 'やめる'], x: 120, y: 60, w: 400, px: true, describe: (i) => (i < topics.length ? '質問の趣旨は、原則として前々日の正午までに通告する決まり（申し合わせ）。' : 'またにしよう。') });
  if (k < 0 || k >= topics.length) return;
  const tp = topics[k];
  const mi = ministerFor(g, tp.bill, tp.area);
  const mname = mi ? `${surname(mi.name)}${shortPost(mi.label)}` : '政府参考人';
  const mwho = { name: mname, look: mi ? mi.look : LOOKS.salaryman };
  const minister = g.npc('kokkai_answer');
  if (minister) { minister.look = mwho.look; minister.sheet = charSheetHD(mwho.look); minister.hidden = false; }
  g.placePlayer(14, 6, 'left');
  const chair = { name: '委員長', look: npcLook(g, pol(g).flags.chair_budget) };
  await g.say(`質疑の申し出があります。順次これを許します。\n${myFamilyName(g)}君。`, chair);
  const score = await exchange(g, Q_ROUNDS, {
    title: `${houseName(house)}　委員会`, sub: `質疑：${g.state.name}（${partyName(g, m.party, true)}）`, topic: tp.t,
    prompt: ['（最初の質問は…）', '（大臣の答弁は、はぐらかしているようだ…）', '（持ち時間が少なくなってきた。どう締める？）'],
    selfSay: { name: g.state.name, look: g.state.look },
    after: [
      async (s) => { await g.say(s >= 25 ? `${tp.t}については、関係省庁と連携し、\n適切に対応してまいります。` : '…ただいまのご質問には、\n事実と異なる前提が含まれております。', mwho); },
      async (s) => { if (s >= 25) { g.emote('kokkai_answer', '…'); await g.say('…検討の状況を申し上げます。\n年内をめどに、具体策を取りまとめます。', mwho); } else await g.say('（委員長が「静粛に」と注意した）', chair); },
      async () => { await g.say('時間が参りました。', chair); },
    ],
  });
  const r = g.activity('委員会で質問', { score });
  if (minister) minister.hidden = true;
  await g.say([r.ok ? r.text : `（${r.why}）`, score >= 75 ? '（鋭い質疑だった。ニュースでも取り上げられそうだ）' : score >= 50 ? '（まずまずの質疑だった）' : '（空回りしてしまった…次は準備をしっかりしよう）']);
}
async function toben(g) {
  const m = me(g);
  if (!inCabinet(g)) { await g.say('（答弁席に立つのは、大臣などの政府の側だ）'); return; }
  if (!sessionOf(g)) { await g.say('（国会は閉会中。委員会は開かれていない）'); return; }
  if (m.lastAct && m.lastAct['国会で答弁'] === today(g)) { await g.say('（今日の答弁はもう終えた）'); return; }
  const p = pol(g);
  const opp = Object.values(p.npcs || {}).find((n) => n && n.party && !ruling(p, n.party) && (n.office === 'shugi' || n.office === 'sangi'));
  const qname = opp ? `${surname(opp.name)}委員（${partyName(g, opp.party, true)}）` : '委員';
  const qwho = { name: qname, look: opp ? opp.look : LOOKS.salaryman };
  const myPost = (m.posts || []).find((x) => POL.POSTS && POL.POSTS[x] && POL.POSTS[x].kind === 'cabinet');
  let label = '大臣';
  try { label = shortPost(g.postLabel(myPost)); } catch (e) { /* keep */ }
  const area = myPost && POL.POSTS[myPost].areas ? POL.POSTS[myPost].areas[0] : null;
  const topic = area && POL.POLICY_AREAS[area] ? POL.POLICY_AREAS[area].name : '政府の方針';
  g.placePlayer(6, 6, 'right');
  const chair = { name: '委員長', look: npcLook(g, p.flags.chair_budget) };
  await g.say(`${surname(qname)}君の質疑に入ります。`, chair);
  const score = await exchange(g, A_ROUNDS, {
    title: '委員会　答弁', sub: `答弁：${g.state.name}${label}`, topic,
    prompt: ['（どう答える…？）', '（追及が厳しい…）', '（最後の答弁だ）'],
    selfSay: { name: `${g.state.name}${label}`, look: g.state.look },
    before: [
      async () => { await g.say(`${topic}の対応について、大臣に伺います。\n国民の不安に、どう応えるのですか。`, qwho); },
      async () => { await g.say('それでは答えになっていません！\nいつまでに、何をするのか。', qwho); },
      async () => { await g.say('最後に、大臣の決意を伺います。', qwho); },
    ],
  });
  const r = g.activity('国会で答弁', { score });
  await g.say([r.ok ? r.text : `（${r.why}）`]);
}

// ------------------------------------------------------------------ 議員会館：秘書・帳簿・陳情
function ledgerPages(g) {
  const m = me(g);
  const y = yearOf(g);
  const L = m.ledger || {};
  const pages = [];
  for (const yy of [y, y - 1]) {
    const l = L[yy];
    if (!l) continue;
    const rep = m.reported && m.reported[yy];
    pages.push(`【${yy}年の帳簿】収入 ${fmtMoney(num(l.income))}（寄付 ${fmtMoney(num(l.donations))}・パーティー${num(l.parties)}回）\n支出 ${fmtMoney(num(l.expense))}${rep ? `\n収支報告書：提出ずみ${rep.auto ? '（会計責任者）' : ''}${rep.secretIncluded ? '・訂正あり' : ''}` : ''}`);
  }
  pages.push(`政治資金の残高：${fmtMoney(num(m.funds))}\n秘書：公設3人（国費）＋私設${num(m.staff)}人`);
  if (num(m.secret) > 0) pages.push(`……帳簿にのっていないお金がある。${fmtMoney(num(m.secret))}。\n収支報告書に書かなければ「裏金」だ。`);
  return pages;
}
async function fundsReport(g) {
  const m = me(g);
  const y = yearOf(g) - 1;
  const rep = m.reported && m.reported[y];
  if (rep && !rep.auto) { await g.say(`${y}年分の収支報告書は、もう提出しました。`, say(WHO.hisho)); return; }
  const lines = [`${y}年分の政治資金収支報告書ですね。\n期限は翌年の3月末、国会議員の政治団体は5月末です。`];
  if (rep && rep.auto) lines.push('（会計責任者が期限までに出した分を、訂正して出し直すこともできる）');
  const secret = num(m.secret);
  if (secret <= 0) {
    lines.push('帳簿どおり、すべての収入と支出を記載します。');
    await g.say(lines, say(WHO.hisho));
    const r = g.reportFunds({ includeSecret: true, year: y });
    await g.say(r && r.ok ? r.text : `（${(r && r.why) || '提出できなかった'}）`);
    return;
  }
  lines.push(`それと、先生…帳簿の外に${fmtMoney(secret)}あります。\nどう記載しましょう。`);
  const k = await g.ask(lines, ['すべて正直に記載', '裏金は書かない'], { ...say(WHO.hisho), cancel: 0 });
  if (k === 0) {
    await g.say(['正直に書き加えます。', '記載もれの訂正として報道されるでしょうが、\nこれで違法な状態は解消されます。'], say(WHO.hisho));
    const r = g.reportFunds({ includeSecret: true, year: y });
    await g.say(r && r.ok ? r.text : `（${(r && r.why) || '提出できなかった'}）`);
    return;
  }
  const law = typeof g.crimeLaw === 'function' ? g.crimeLaw('slush_fund', { amount: secret }) : '政治資金規正法違反（不記載・虚偽記入）';
  const c = await g.ask(['先生…本当にいいんですか。', law, '発覚すれば、議員の職も公民権も失いかねません。'], ['やっぱり正直に書く', 'このまま出す'], { ...say(WHO.hisho), cancel: 0 });
  if (c === 0) { const r = g.reportFunds({ includeSecret: true, year: y }); await g.say(r && r.ok ? r.text : `（${(r && r.why) || '提出できなかった'}）`); return; }
  const r = g.reportFunds({ includeSecret: false, year: y });
  await g.say(r && r.ok ? `${r.text}\n（裏金は書かなかった…）` : `（${(r && r.why) || '提出できなかった'}）`);
  if (typeof g.commitCrime === 'function') await g.commitCrime('slush_fund', { amount: secret, where: '議員会館' });
  g.addNeed('stress', 8);
}
async function fundraiser(g) {
  const thr = typeof POL.partyTicketDisclosure === 'function' ? POL.partyTicketDisclosure(yearOf(g)) : 200000;
  const lines = ['政治資金パーティーですね。会費は1枚2万円くらいが相場です。', `券を1人で${Math.round(thr / 10000)}万円を超えて買った人の名前は、\n収支報告書で公開されます。`];
  const k = await g.ask(lines, ['きちんと開く', '一部を記載しない', 'やめておく'], { ...say(WHO.hisho), cancel: 2 });
  if (k === 2) return;
  let unreported = 0;
  if (k === 1) {
    const law = typeof g.crimeLaw === 'function' ? g.crimeLaw('slush_fund', {}) : '政治資金規正法違反';
    const c = await g.ask(['先生、それは「裏金」です。', law], ['きちんと開く', 'それでもやる'], { ...say(WHO.hisho), cancel: 0 });
    if (c === 1) unreported = 0.3;
  }
  const r = g.holdFundraiser({ unreported });
  await g.say(r && r.ok ? r.text : `（${(r && r.why) || '開けなかった'}）`);
}
async function respondOffers(g) {
  const m = me(g);
  const open = (m.offers || []).filter((o) => !o.answered);
  if (!open.length) return false;
  const o = open[0];
  let post = '';
  try { post = g.postLabel(o.post); } catch (e) { post = String(o.post); }
  const k = await g.ask([`先生、${o.kind === 'post' ? '総理から入閣' : '党首から役職'}の打診が来ています。\n「${post}」です。`, 'お受けしますか？'], ['お受けする', 'お断りする'], { ...say(WHO.hisho), cancel: 1 });
  const why = g.respondOffer(o.id, k === 0);
  await g.say(why ? `（${why}）` : k === 0 ? `（${post}に就任した！）` : '（丁重にお断りした）');
  return true;
}
async function hishoTalk(g) {
  if (!myHouse(g)) { await g.say('こちらは議員の事務所です。\nお約束のある方ですか？', say(WHO.hisho)); return; }
  if (await respondOffers(g)) return;
  const items = ['今日の予定', '帳簿を見せて', '収支報告書を出す', '献金を集める', 'パーティーを開く', '秘書を雇う'];
  const k = await g.list({ title: '秘書に頼む', items: [...items, 'なんでもない'], x: 200, y: 60, w: 260, px: true });
  const pick = items[k];
  if (pick === '今日の予定') await briefing(g);
  else if (pick === '帳簿を見せて') await g.say(ledgerPages(g), say(WHO.hisho));
  else if (pick === '収支報告書を出す') await fundsReport(g);
  else if (pick === '献金を集める') {
    await g.say('支援者に、寄付をお願いしてまわります。\n個人の寄付には上限があり、記載も必要です。', say(WHO.hisho));
    const r = g.collectDonations();
    await g.say(r && r.ok ? r.text : `（${(r && r.why) || 'できなかった'}）`);
  } else if (pick === 'パーティーを開く') await fundraiser(g);
  else if (pick === '秘書を雇う') {
    const m = me(g);
    const c = await g.ask([`私設秘書はいま${num(m.staff)}人。給料は政治資金から月${fmtMoney(num(POL.STAFF_COST) || 250000)}。`, '人が多いと、地元回りや選挙が楽になります。'], ['1人ふやす', '1人へらす', 'このまま'], { ...say(WHO.hisho), cancel: 2 });
    if (c < 2) { const why = g.hireStaff(c === 0 ? 1 : -1); await g.say(why ? `（${why}）` : `（私設秘書は${num(me(g).staff)}人になった）`); }
  } else await g.say('はい。何かあれば、いつでも。', say(WHO.hisho));
}
async function briefing(g) {
  const p = pol(g);
  const m = me(g);
  const S = sessionOf(g);
  const house = myHouse(g);
  const lines = [];
  lines.push(S ? `いまは${S.kind}の会期中です。\n本会議の議事日程は${plenaryBills(g, house).length}件、委員会で審査中が${billsInCommittee(g, house).length}件。` : 'いまは国会の閉会中です。地元を回るなら今のうちですね。');
  if (S && !(m.attend && m.attend.last === today(g))) lines.push('今日はまだ登院されていません。\n欠席が続くと、記者に書かれますよ。');
  const ups = (typeof g.upcomingElections === 'function' ? g.upcomingElections() : []).filter((e) => !e.newsOnly).slice(0, 2);
  if (ups.length) lines.push(`選挙の予定：\n${ups.map((e) => `${e.label}（${e.date}）`).join('\n')}`);
  lines.push(`評判 ${Math.round(num(m.reputation))}・地元の支持 ${Math.round(num(m.localSupport))}・党内の評価 ${Math.round(num(m.standing))}`);
  if (p && p.cabinet) lines.push(`内閣支持率は${Math.round(num(p.cabinet.approval))}%です。`);
  await g.say(lines, say(WHO.hisho));
}
// 陳情 visitors: one a day, from different walks of life (even-handed)
const CHINJO = [
  { name: '商店街連合会の会長', look: { ...LOOKS.oldman, top: '#5a6a4a' }, lines: ['駅前の商店街、空き店舗が増えてねえ。', 'にぎわいを取り戻す支援を、\n国のほうでも考えてもらえませんか。'] },
  { name: '保育園の保護者', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#e8a8b8', bottom: '#3b3f48' }, lines: ['子どもを預ける先が、なかなか見つからなくて…。', '保育の受け皿と、保育士さんの待遇を\nなんとかしてほしいんです。'] },
  { name: '介護事業所の施設長', look: { hair: 'short', hairColor: 'gray', skin: 'fair', top: '#5fa8a0', bottom: '#3b3f48' }, lines: ['介護の現場は、人が足りません。', '働く人の給料が上がらないと、\n続けてもらえないんです。'] },
  { name: '町工場の社長', look: { ...LOOKS.staff, hat: '#2f6fd0', top: '#4a5a6a' }, lines: ['材料も電気代も上がって、\n値上げを取引先に言い出しにくくてね。', '賃上げしたいが、中小企業には余裕がない。\n価格を転嫁できる仕組みがほしい。'] },
  { name: '若手の農家', look: { hair: 'cap', hat: '#d8a03a', hairColor: 'black', skin: 'tan', top: '#6a8a4a', bottom: '#4a4a3a' }, lines: ['肥料も燃料も高くなって、\n作れば作るほど苦しいんです。', 'それでも、この仕事を続けたい。\n若い人が農業を続けられる支えを。'] },
  { name: '被災した町の職員', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#d8d0a0', bottom: '#3b3f48' }, lines: ['大雨の被害から、町はまだ立ち直れていません。', '堤防の工事と、住まいの再建の支援を\nどうかお願いします。'] },
  { name: '大学の研究者', look: { hair: 'short', hairColor: 'gray', skin: 'light', top: '#8a7a6a', bottom: '#3b3f48', glasses: true }, lines: ['研究費が年々減って、\n若い研究者が海外に出ていきます。', '基礎研究は、すぐに役立たなくても\n国の力になるんです。'] },
];
const chinjoToday = (g) => CHINJO[Math.floor(hash2(today(g), 5, 77) * CHINJO.length)];
async function chinjoTalk(g) {
  const v = chinjoToday(g);
  const w = { name: v.name, look: v.look };
  await g.say(['先生、お時間をいただきありがとうございます。', ...v.lines], w);
  const k = await g.ask('（どう応える？）', ['しっかり話を聞く', '検討すると伝える', 'あとにしてもらう'], { cancel: 2 });
  if (k === 2) { await g.say('…そうですか。また参ります。', w); return; }
  const r = g.activity('陳情を受ける', { score: k === 0 ? 80 : 55 });
  await g.say(k === 0 ? 'ありがとうございます！\n先生に話を聞いてもらえて、ほっとしました。' : 'よろしくお願いいたします。', w);
  await g.say(r && r.ok ? r.text : `（${(r && r.why) || '今日はもう陳情を受けた'}）`);
}
// The "favour" visitor: a bribe offer. The lawful answer comes first.
const BRIBER = { name: '建設会社の社長', look: { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#3a3436', bottom: '#2a2d36', jacket: true, tie: '#c9a227' } };
function briberToday(g) {
  const m = me(g);
  if (!m || !myHouse(g)) return false;
  const last = num(g.flag('kokkai_bribe_day'), -999);
  return today(g) - last >= 20 && hash2(today(g), 13, 5) < 0.18;
}
async function briberTalk(g) {
  g.setFlag('kokkai_bribe_day', today(g));
  const amount = 3000000;
  await g.say(['先生、いつもお世話になっております。', '例の地元の工事の件、うちが取れるよう、\nひとつ口添えを…。', `（菓子折りの下に、厚い封筒がのぞいている。\n${fmtMoney(amount)}はありそうだ）`], BRIBER);
  const k = await g.ask('（どうする…？）', ['きっぱり断る', '受け取る'], { cancel: 0 });
  if (k === 0) {
    await g.say(['こういうものは受け取れません。\nお引き取りください。', '（社長は気まずそうに帰っていった）'], { name: g.state.name, look: g.state.look });
    g.relax({ stress: 3 });
    return;
  }
  const law = typeof g.crimeLaw === 'function' ? g.crimeLaw('bribery_take', { request: true, amount }) : '受託収賄罪（刑法197条）';
  const c = await g.ask(['（職務に関して、頼まれごとと一緒にお金を受け取れば…）', law], ['やっぱり断る', 'それでも受け取る'], { cancel: 0 });
  if (c === 0) { await g.say('（封筒を押し返した）'); return; }
  if (typeof g.commitCrime === 'function') await g.commitCrime('bribery_take', { amount, request: true, gain: { money: amount }, where: '議員会館' });
  g.addNeed('stress', 10);
  await g.say('（封筒は、ずしりと重かった。\n…胸の奥も、同じくらい重い）');
}

// ------------------------------------------------------------------ 国会見学（参観）
async function tour(g) {
  const W = say(WHO.guide);
  const S = sessionOf(g);
  const plen = S && (plenaryBills(g, 'shugi').length || plenaryBills(g, 'sangi').length);
  await g.say(['衆議院の参観受付です。国会見学は、どなたでも無料です。', '衛視がご案内します。所要時間は、およそ1時間です。', plen ? '本日は本会議がありますので、\n開会の1時間前から散会までは、ご案内を休止します。' : '本会議場、中央広間、前庭の順にまわります。'], W);
  const k = await g.ask('見学しますか？', ['見学する', 'やめておく'], { ...W, cancel: 1 });
  if (k !== 0) return;
  if (plen) await g.say('（本会議が散会するのを待って、見学が始まった）');
  g.setFlag('kokkai_touring', true);
  try {
    await g.goto(PID, 'bocho_s', 9, 9, 'up');
    await g.say(['こちらは衆議院の本会議場です。傍聴席から見ています。', '議席は、演壇を中心に半円形に並んでいます。\n議員は会派（政党のグループ）ごとにまとまって座ります。', '正面の一段高いところが議長席、その前が演壇。\n議長席の両側が、国務大臣の席です。'], W);
    await g.say(['議席の黒い四角柱は「氏名標」といって、\n議員の名前が書いてあります。', '衆議院の採決は、起立・異議の有無・記名投票の3つ。\n記名投票では、賛成は白、反対は青の札を使います。', '参議院の議場もほぼ同じ造りですが、\n天皇陛下の御席があり、国会の開会式が行われます。'], W);
    await g.goto(PID, 'hall', 11, 9, 'up');
    await g.say(['ここが中央広間。中央塔の真下です。\n天井と窓は、ステンドグラスです。', '四隅の台座のうち3つには、議会政治の基礎を\n築いた先人の銅像が立っています。', '4つ目の台座は、いまも空いたまま。\n「政治に完成はない」という意味だ、など諸説あります。'], W);
    await g.say(['壁の上には、春・夏・秋・冬の壁画。', '正面の中央玄関は、天皇陛下をお迎えするときと、\n選挙のあとの初登院、国賓の来訪のときにだけ開く\n「あかずの扉」。ブロンズ製で、扉1枚が1.1トンです。'], W);
    await g.say(['議事堂は大正9年（1920年）に工事が始まり、\n昭和11年（1936年）に完成しました。17年がかりです。', '中央塔の高さは65.45メートル。\n中には、およそ400の部屋があります。', '最後に前庭へ。全国の都道府県から贈られた\n「都道府県の木」が植えられています。'], W);
  } finally {
    g.setFlag('kokkai_touring', false);
  }
  await g.goto(PID, 'lobby', 4, 4, 'up');
  g.setFlag('kokkai_toured', today(g));
  if (!g.hasItem('kokkai_pamph')) { g.giveItem('kokkai_pamph', 1, true); g.sfx('ok'); }
  g.relax({ stress: 5 });
  await g.say(['以上で見学は終わりです。おつかれさまでした。', '「国会見学のしおり」をどうぞ。\n今度はぜひ、本会議の傍聴にもいらしてください。'], W);
}
async function guideTalk(g) {
  if (g.flag('kokkai_toured') === today(g)) {
    const i = await g.ask('今日の見学はいかがでしたか。', ['もう一度見学する', '国会のしくみ', 'またね'], { ...say(WHO.guide), cancel: 2 });
    if (i === 0) await tour(g);
    else if (i === 1) await g.say(PANELS[1].lines, say(WHO.guide));
    return;
  }
  await tour(g);
}
async function bochoDesk(g) {
  const w = say(WHO.bocho);
  const S = sessionOf(g);
  if (!S) { await g.say(['こちらは本会議の傍聴受付です。', 'ただいま国会は閉会中のため、本会議はありません。\n国会見学（参観）でしたら、左の受付へどうぞ。'], w); return; }
  const k = await g.ask(['本会議の傍聴ですね。一般傍聴券は先着順です。', 'どちらの本会議を傍聴しますか？'], ['衆議院', '参議院', 'やめておく'], { ...w, cancel: 2 });
  if (k === 2) return;
  const house = k === 1 ? 'sangi' : 'shugi';
  g.setFlag('kokkai_ticket', { day: today(g), house });
  if (!g.hasItem('kokkai_ticket')) g.giveItem('kokkai_ticket', 1, true);
  g.sfx('ok');
  await g.say(['傍聴券をどうぞ。手荷物はロッカーに預けてください。', '傍聴席では、拍手や声を出すこと、撮影・録音はできません。\n携帯電話の電源もお切りください。', '右の階段から傍聴席へどうぞ。'], w);
}
async function stairsToGallery(g) {
  const t = g.flag('kokkai_ticket');
  if (!(t && t.day === today(g))) {
    await g.say('（傍聴席への階段だ。傍聴券がないと上がれない）');
    await g.movePlayer(['left']);
    return;
  }
  await g.goto(PID, t.house === 'sangi' ? 'bocho_n' : 'bocho_s', 9, 9, 'up');
}

// ------------------------------------------------------------------ the lobby boards
const PANELS = [
  { title: '国会のあゆみ', lines: ['【国会のあゆみ】', '1890年（明治23年）、第1回帝国議会が開かれた。', '1947年（昭和22年）5月3日、日本国憲法の施行で、\n国会は衆議院と参議院の二院制になった。', '憲法41条：「国会は、国権の最高機関であつて、\n国の唯一の立法機関である」'] },
  { title: '衆議院と参議院', lines: ['【衆議院と参議院】', '衆議院：任期4年。解散がある。\n参議院：任期6年。3年ごとに半数を選ぶ。解散はない。', '法律案・予算・条約・総理大臣の指名では\n衆議院の議決が優先される（衆議院の優越）。', '内閣不信任の決議ができるのは、衆議院だけ。'] },
  { title: '法律ができるまで', lines: ['【法律ができるまで】', '内閣か議員が法律案を出す。議員が出すには\n衆議院で20人以上（予算を伴えば50人）の賛成者。', '委員会で審査・採決 → 本会議で採決 → もう一方の院へ。\n両院で可決すると、法律になる。', '参議院で否決されても、衆議院が出席議員の\n3分の2以上で再び可決すれば、法律になる（憲法59条）。'] },
  { title: '国会の種類', lines: ['【国会の種類】', '常会（通常国会）：毎年1月に召集。会期150日。\n予算を審議する。', '臨時会（臨時国会）：必要なときに召集。\n特別会（特別国会）：総選挙から30日以内に召集し、\n総理大臣を指名する。', '衆議院の解散中に緊急の必要があるときは、\n参議院の緊急集会が開かれる。'] },
];
function todayBoard(g) {
  const p = pol(g);
  if (!p) return ['「今日の国会」の掲示板だ。'];
  const S = sessionOf(g);
  const lines = [`【今日の国会】${dateText(g)}`];
  lines.push(S ? `${S.kind}の会期中。\n衆議院の本会議 ${plenaryBills(g, 'shugi').length}件・参議院の本会議 ${plenaryBills(g, 'sangi').length}件` : '国会は閉会中。');
  try {
    const s = g.politicsSummary();
    const top = (h) => (s.diet[h].seats || []).slice(0, 4).map((x) => `${x.name.length > 6 ? partyName(g, x.id, true) : x.name}${x.n}`).join('・');
    lines.push(`衆議院（定数${s.diet.shugi.total}）\n${top('shugi')}…`);
    lines.push(`参議院（定数${s.diet.sangi.total}）\n${top('sangi')}…`);
    lines.push(`内閣総理大臣：${s.cabinet.pmName || '（空席）'}\n内閣支持率：${s.cabinet.approval}%`);
  } catch (e) { console.error(e); }
  return lines;
}
function boardProp(x, y) {
  return {
    type: 'prop', x, y, w: 1, h: 1,
    draw(ctx, sx, sy) {
      R(ctx, sx + 2, sy + 14.5, 12, 1.5, 'rgba(0,0,0,0.25)');
      R(ctx, sx + 3.5, sy + 8, 1, 7, WDK); R(ctx, sx + 11.5, sy + 8, 1, 7, WDK);
      R(ctx, sx + 1, sy - 4, 14, 13, WDK); R(ctx, sx + 1.5, sy - 3.5, 13, 12, '#f6f0e0');
      R(ctx, sx + 1.5, sy - 3.5, 13, 2.5, '#2a3a5a');
      for (let i = 0; i < 4; i++) R(ctx, sx + 3, sy + 0.5 + i * 2, 9 - (i % 2) * 3, 0.5, '#8a8478');
    },
    talk: async (g) => { await g.say(todayBoard(g)); },
  };
}

// ------------------------------------------------------------------ statues (props): generic figures, no names
function paintStatue(c, kind) {
  // canvas 64 x 128 (2x of 32 x 64 units); the pedestal stands on the 2x2-tile footprint
  const PX = 13, PW = 38, TOP = 70;
  R(c, PX - 5, 116, PW + 10, 10, GRAND); R(c, PX - 5, 116, PW + 10, 2, GRANL);
  R(c, PX, TOP + 4, PW, 44, GRAN); R(c, PX, TOP + 4, 2, 44, GRANL); R(c, PX + PW - 2, TOP + 4, 2, 44, GRAND);
  R(c, PX - 3, TOP, PW + 6, 6, GRANL); R(c, PX - 3, TOP + 5, PW + 6, 1, GRAND);
  inset(c, PX + 7, TOP + 14, PW - 14, 22, GRAN, GRANL, GRAND);
  for (let i = 0; i < 70; i++) P(c, PX + 2 + Math.floor(hash2(i, 1, 3) * (PW - 4)), TOP + 7 + Math.floor(hash2(i, 2, 3) * 40), hash2(i, 3, 3) < 0.5 ? '#9a978f' : '#7f7c76');
  if (kind === 'empty') { R(c, PX + 5, TOP - 4, PW - 10, 5, GRANL); R(c, PX + 5, TOP - 4, PW - 10, 1, '#d8d6d0'); return; }
  const [cv, f] = makeCanvas(64, 72);
  const B = BRZ, BD = BRZD, BL = BRZL;
  const cx = 32;
  // base plate, legs and shoes
  R(f, cx - 12, 66, 24, 4, BD);
  R(f, cx - 7, 46, 5, 20, BD); R(f, cx + 2, 46, 5, 20, B); R(f, cx + 2, 46, 1, 20, BL);
  R(f, cx - 9, 63, 8, 3, BD); R(f, cx + 1, 63, 8, 3, B);
  // frock coat: shoulders to the knees, flared tails
  for (let y = 16; y < 52; y++) {
    const w = y < 20 ? 9 + (y - 16) : y < 40 ? 12 : 12 + Math.floor((y - 40) / 3);
    R(f, cx - w, y, w * 2, 1, B);
    R(f, cx - w, y, 2, 1, BD); R(f, cx + w - 2, y, 2, 1, BL);
  }
  R(f, cx - 1, 20, 2, 32, BD); R(f, cx - 6, 18, 4, 10, BL); R(f, cx + 2, 18, 4, 10, BD);
  for (const y of [26, 31, 36]) P(f, cx - 3, y, BL);
  // arms by pose (generic: no particular person)
  if (kind === 'a') { R(f, cx - 15, 19, 5, 22, B); R(f, cx - 15, 19, 1, 22, BL); R(f, cx + 11, 18, 5, 9, B); R(f, cx + 13, 10, 5, 10, B); oval(f, cx + 12, 6, 7, 6, BL); }
  else if (kind === 'b') { R(f, cx - 15, 19, 5, 20, B); R(f, cx + 11, 19, 5, 16, B); R(f, cx + 8, 33, 12, 4, '#c8b890'); R(f, cx + 8, 33, 12, 1, '#e8dcb8'); R(f, cx + 18, 32, 2, 6, BD); }
  else { R(f, cx - 14, 19, 5, 22, B); R(f, cx + 10, 19, 5, 22, B); R(f, cx - 13, 40, 4, 4, BD); R(f, cx + 10, 40, 4, 4, BD); R(f, cx - 4, 40, 8, 5, BD); }
  // collar, neck, head (hair and a bare outline; no face details)
  R(f, cx - 6, 14, 12, 4, BD); R(f, cx - 3, 12, 6, 3, B);
  oval(f, cx - 6, 1, 12, 13, B); R(f, cx - 5, 2, 10, 4, BD); R(f, cx - 4, 6, 3, 4, BL); P(f, cx + 3, 9, BD);
  // patina
  for (const [x, y, h] of [[cx - 8, 22, 12], [cx + 6, 28, 10], [cx - 2, 3, 4], [cx - 10, 42, 8]]) R(f, x, y, 1, h, PAT);
  for (let y = 30; y < 46; y += 2) for (let x = cx - 10; x < cx + 10; x += 4) if (hash2(x, y, 9) < 0.35) P(f, x, y, PAT);
  outline(f, { tint: 0.2 });
  c.drawImage(cv, 0, TOP - 70);
}
const statueCache = {};
function statueProp(x, y, kind, extra = {}) {
  return {
    type: 'prop', x, y, w: 2, h: 2,
    draw(ctx, sx, sy) {
      let cv = statueCache[kind];
      if (!cv) { const [c2, c] = makeCanvas(64, 128); paintStatue(c, kind); cv = c2; statueCache[kind] = cv; }
      R(ctx, sx + 2, sy + 28, 28, 3, 'rgba(0,0,0,0.25)');
      ctx.drawImage(cv, sx, sy + 32 - 64, 32, 64);
    },
    ...extra,
  };
}
const STATUE_TEXT = ['大きな銅像だ。台座は花こう岩。', '「議会政治の基礎を築いた先人の像」と説明がある。\n（どんな人物かは、見学のしおりを読もう）'];
const EMPTY_TEXT = ['4つ目の台座には、何も立っていない。', '「政治に完成はない」という意味だとも、\nふさわしい人物を将来に託したのだとも言われている。'];

// ------------------------------------------------------------------ hall effects
let hallFx = null;
function paintHallFx(c) {
  // 10 x 7 tiles (320 x 224 px) centred on the middle of the hall: a round marble medallion
  // and the coloured light of the stained-glass ceiling (checker-dithered pools)
  const W = 320, H = 224, cx = W / 2, cy = H / 2;
  const ell = (rx, ry, col, dz = false, ph = 0) => {
    for (let y = -ry; y <= ry; y++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (dz) { c.fillStyle = col; for (let x = -w; x < w; x++) if (((x + y + ph) & 1) === 0) c.fillRect(cx + x, cy + y, 1, 1); }
      else R(c, cx - w, cy + y, w * 2, 1, col);
    }
  };
  ell(78, 52, '#b8a890'); ell(76, 50, '#efe8d8'); ell(70, 46, '#c8988a'); ell(66, 43, '#f2ecdc');
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    for (let t = 8; t < 60; t++) { const x = Math.round(cx + Math.cos(a) * t), y = Math.round(cy + Math.sin(a) * t * 0.66); if (i % 2 === 0 || t < 40) P(c, x, y, i % 4 === 0 ? '#b8786a' : '#c8b49a'); }
  }
  ell(16, 11, '#7f9a88'); ell(13, 9, '#e8d8b0'); ell(6, 4, '#b8786a');
  const pools = [[-50, -24, '#ffd890'], [44, -20, '#a8c8ff'], [-36, 28, '#ffb0c0'], [52, 26, '#b8f0c8']];
  for (const [dx, dy, col] of pools) {
    for (let y = -16; y <= 16; y++) {
      const w = Math.round(30 * Math.sqrt(Math.max(0, 1 - (y * y) / 256)));
      c.fillStyle = col;
      for (let x = -w; x < w; x++) if (((x + y) & 1) === 0 && (x * 7 + y * 3) % 5 !== 0) c.fillRect(cx + dx + x, cy + dy + y, 1, 1);
    }
  }
}
function hallUnder(ctx, g, cam) {
  if (!hallFx) { const [cv, c] = makeCanvas(320, 224); paintHallFx(c); hallFx = cv; }
  const x = 12 * 16 - 80 - cam.x, y = 8 * 16 - 56 - cam.y;
  ctx.globalAlpha = 1;
  ctx.drawImage(hallFx, Math.round(x), Math.round(y), 160, 112);
}

// ------------------------------------------------------------------ gallery view
const GAL_SEATS = schematicLayout(320, 74, 50, 232, 8, 0.48, 10);
const galleryCache = {};
function galleryUnder(house) {
  return (ctx, g, cam) => {
    const S = sessionOf(g);
    const { list } = seatParties(g, house, GAL_SEATS.length);
    const key = `${house}|${S ? 1 : 0}|${list.join(',')}`;
    let c0 = galleryCache[house];
    if (!c0 || c0.key !== key) {
      const [cv, c] = makeCanvas(18 * 32, 6 * 32);
      const order = GAL_SEATS.map((s, i) => i).sort((a, b) => GAL_SEATS[b].th - GAL_SEATS[a].th);
      const parties = new Array(GAL_SEATS.length);
      order.forEach((si, k) => { parties[si] = list[k]; });
      paintChamberSchematic(c, g, { x0: 0, y0: 0, w: 18 * 32, h: 6 * 32, cx: 288, cy: 52, house, seats: GAL_SEATS.map((s) => ({ ...s, x: s.x - 32 })), parties, present: (i) => !!S && hash2(i, 11, today(g)) < 0.94, mineIdx: -1, scale: 0.9 });
      c0 = galleryCache[house] = { key, cv };
    }
    ctx.drawImage(c0.cv, 16 - cam.x, 16 - cam.y, 18 * 16, 6 * 16);
  };
}

// ------------------------------------------------------------------ access rules
async function stopHere(g, lines, who = WHO.guard) {
  await g.say(lines, say(who));
  return false;
}
async function intoHall(g) {
  if (myHouse(g) || g.flag('kokkai_touring')) return true;
  return stopHere(g, ['ここから先は、議員と許可のある方だけです。', '国会見学でしたら、左の参観受付へどうぞ。\n本会議の傍聴は、右の傍聴人受付です。']);
}
function intoChamber(house) {
  return async (g) => {
    const h = myHouse(g);
    if (h === house) return true;
    if (h) return stopHere(g, [`${houseName(house)}の議場です。`, `${houseName(h)}の議員の方は、こちらの議席には入れません。\n傍聴席からご覧ください。`]);
    return stopHere(g, ['議場に入れるのは、議員だけです。', '議場は、傍聴席からご覧いただけます。']);
  };
}
async function intoIinkai(g) {
  if (myHouse(g)) return true;
  return stopHere(g, ['委員会室です。', '委員会の傍聴には、議員の紹介と委員長の許可が必要です。']);
}
async function intoKaikan(g) {
  if (myHouse(g)) return true;
  return stopHere(g, ['議員会館への通用口です。', '会館に入るには、議員との面会の約束と、\n受付での手続きが必要です。']);
}

// ------------------------------------------------------------------ 初登院 (after winning a national seat)
if (typeof POL.onPolitics === 'function') {
  POL.onPolitics('elected', (g, d) => {
    const off = d && d.office;
    if (g && g.state && (off === 'shugi' || off === 'sangi')) g.state.flags.kokkai_firstday = off;
  });
}
async function firstDay(g) {
  const house = g.flag('kokkai_firstday');
  if (!house || myHouse(g) !== house) return;
  g.setFlag('kokkai_firstday', false);
  await g.say(['（今日は初登院の日。', 'ふだんは閉じている中央玄関――「あかずの扉」が、\n新しい議員のために開いている）']);
  await g.goto(PID, 'hall', 11, 14, 'up');
  g.sfx('fanfare');
  g.showBanner('初登院');
  await g.say([`（胸に議員バッジをつけ、${houseName(house)}議員として\nはじめて中央広間に立った…）`, '（ここから、国の法律と予算を決める仕事が始まる）']);
  g.setFlag('kokkai_firsted', today(g));
}

// ------------------------------------------------------------------ rooms
function chamberRoom(house) {
  const left = house === 'shugi';
  return {
    tiles: CHAMBER_ROWS[house],
    floor: T(left ? 'carpet' : 'scarpet'),
    topPad: 24,
    bgm: 'kokkai',
    legend: {
      '#': T('walltop'), '=': T('cwall'), '.': T(left ? 'carpet' : 'scarpet'), S: T(left ? 'seat' : 'sseat'), Y: T(left ? 'seat' : 'sseat'),
      X: T('xwall'), O: T('gyo0'), P: T('gyo1'), Q: T('gyo2'), R: T('gyo3'),
      m: T('mdesk'), C: T('dais_l'), D: T('dais_m'), E: T('dais_r'), j: T('jdesk'), r: T('rostrum_l'), t: T('rostrum_r'), M: T('mat'),
    },
    warps: [14, 15].map((x) => ({ x, y: CH_H - 1, room: 'hall', tx: left ? 1 : 22, ty: x === 14 ? 7 : 8, dir: left ? 'right' : 'left' })),
    entities: [
      {
        type: 'npc', id: `kokkai_speaker_${house}`, x: 15, y: 2, dir: 'down', fixedDir: true,
        get name() { return '議長'; },
        get look() { const g = GG(); return g ? npcLook(g, speakerId(g, house)) : LOOKS.oldman; },
        cond: (g) => !!sessionOf(g),
        talk: async (g) => {
          const nm = npcName(g, speakerId(g, house));
          await g.say([`${houseName(house)}議長の${nm || '議長'}です。`, '議長は会派を離れ、中立の立場で議事を整理します。\n本会議の採決は、ご自分の議席でお願いします。'], { name: '議長', look: npcLook(g, speakerId(g, house)) });
        },
      },
      npc(`kokkai_jimu_${house}`, 17, 2, 'down', WHO.jimu, {
        fixedDir: true, cond: (g) => !!sessionOf(g),
        text: ['事務総長です。議長の議事の進行を補佐しています。', house === 'sangi' ? '参議院では、1998年から押しボタン式投票を\n取り入れています。結果は議場の表示で一目で分かります。' : '衆議院の記名投票では、議員が白票か青票を持って\n演壇の投票箱に入れます。時間がかかるんですよ。'],
      }),
      ...[[9, 'pm'], [8, 'kanbo'], [21, 'minister_finance'], [22, 'minister_foreign']].map(([x, post]) => ({
        type: 'npc', id: `kokkai_min_${house}_${post}`, x, y: 2, dir: 'down', fixedDir: true,
        get name() { const g = GG(); return g ? ministerName(g, post) : '大臣'; },
        get look() { const g = GG(); return g ? npcLook(g, ministerId(g, post)) : LOOKS.salaryman; },
        cond: (g) => !!sessionOf(g) && !!ministerId(g, post) && ministerId(g, post) !== 'player',
        talk: async (g) => { await g.say(['（国務大臣席に座っている）', `${ministerName(g, post)}だ。\n本会議での答弁に備えて、資料に目を通している。`]); },
      })),
      npc(`kokkai_eishi_${house}`, 17, CH_H - 2, 'up', WHO.guard, {
        talk: async (g) => {
          const h = myHouse(g);
          await g.say(h === house ? ['お疲れさまです、先生。', 'ご自分の議席は、中央の通路のすぐ左です。\n（議席の前で、決定ボタン）'] : ['議場ではお静かに願います。'], say(WHO.guard));
        },
      }),
      seatBoard(11, CH_H - 2, house),
    ],
    events: [{ x: MY_SEAT.x, y: MY_SEAT.y, on: 'action', run: (g) => seatMenu(g, house) }],
    drawUnder: chamberUnder(house),
  };
}
function ministerId(g, post) {
  const p = pol(g);
  if (!p || !p.cabinet) return null;
  return post === 'pm' ? p.cabinet.pm : (p.cabinet.ministers || {})[post] || null;
}
function ministerName(g, post) {
  const id = ministerId(g, post);
  if (!id || id === 'player') return '大臣';
  let label = post === 'pm' ? '総理' : '大臣';
  try { if (post !== 'pm') label = shortPost(g.postLabel(post)); } catch (e) { /* keep */ }
  return `${surname(npcName(g, id))}${label}`;
}
function seatBoard(x, y, house) {
  return {
    type: 'prop', x, y, w: 1, h: 1,
    draw(ctx, sx, sy) {
      R(ctx, sx + 7, sy + 5, 2, 10, GOLDD);
      R(ctx, sx + 1, sy - 3, 14, 10, WDK); R(ctx, sx + 1.5, sy - 2.5, 13, 9, '#f6f0e0');
      for (let i = 0; i < 5; i++) R(ctx, sx + 2.5 + i * 2.4, sy + 4.5 - i * 0.8, 1.6, 1 + i * 0.8, ['#2f8f4e', '#e8833a', '#3a9ad9', '#8a3ab9', '#b5932f'][i]);
      R(ctx, sx + 2.5, sy - 1.5, 10, 1, '#2a3a5a');
    },
    talk: async (g) => {
      let lines = ['議席の配置図だ。'];
      try {
        const s = g.politicsSummary();
        const d = s.diet[house];
        const rows = (d.seats || []).map((x) => `${partyName(g, x.id, true)} ${x.n}`);
        lines = [`【${houseName(house)}の会派別議席数】総数${d.total}`];
        for (let i = 0; i < rows.length; i += 4) lines.push(rows.slice(i, i + 4).join('・'));
        lines.push('（議場の椅子の色は、会派ごとの色で示している）');
      } catch (e) { console.error(e); }
      await g.say(lines.slice(0, 1).concat([lines.slice(1).join('\n')]).filter(Boolean));
    },
  };
}
function galleryRoom(house) {
  return {
    floor: T('carpet'),
    bgm: 'kokkai',
    tiles: [
      '####################',
      '#VVVVVVVVVVVVVVVVVV#',
      '#VVVVVVVVVVVVVVVVVV#',
      '#VVVVVVVVVVVVVVVVVV#',
      '#VVVVVVVVVVVVVVVVVV#',
      '#VVVVVVVVVVVVVVVVVV#',
      '#VVVVVVVVVVVVVVVVVV#',
      '#rrrrrrrrrrrrrrrrrr#',
      '#bbbbb.bbbbbb.bbbbb#',
      '#..................#',
      '#bbbbb.bbbbbb.bbbbb#',
      '#########MM#########',
    ],
    legend: { '#': T('walltop'), V: T('view'), r: T('rail'), b: T('gbench'), M: T('mat') },
    warps: [9, 10].map((x) => ({ x, y: 11, room: 'lobby', tx: 19, ty: 7, dir: 'left' })),
    entities: [
      npc(`kokkai_gal_eishi_${house}`, 1, 9, 'right', WHO.guard, {
        text: ['傍聴席では、お静かに願います。', '拍手、発言、撮影、録音は禁止です。\n守られない場合は、退場していただくことがあります。'],
      }),
      npc(`kokkai_gal_visitor_${house}`, 15, 9, 'up', WHO.visitor, {
        cond: (g) => !!sessionOf(g),
        text: ['社会科の授業で、傍聴に来ました。', '教科書で見た議場が、本当に目の前にある…！\n採決って、こんなふうにやるんですね。'],
      }),
      npc(`kokkai_gal_guide_${house}`, 8, 9, 'up', WHO.guide, { cond: (g) => !!g.flag('kokkai_touring'), text: '見学の途中です。足元にお気をつけください。' }),
    ],
    events: [
      { x: 1, y: 8, w: 18, on: 'action', run: (g) => bochoWatch(g, house) },
      { x: 1, y: 10, w: 18, on: 'action', run: (g) => bochoWatch(g, house) },
      { x: 1, y: 7, w: 18, on: 'action', run: (g) => g.say([`手すりの向こうに、${houseName(house)}の本会議場が広がっている。`, house === 'sangi' ? '議長席の奥、金の縁どりの中に御席が見える。\n国会の開会式は、この議場で行われる。' : '正面に議長席と演壇。半円形に並ぶ議席は、\n会派ごとに色分けして見えるようにしてある。']) },
    ],
    drawUnder: galleryUnder(house),
  };
}

registerPlace({
  id: PID,
  name: '国会議事堂',
  kind: 'building',
  bgm: 'kokkai',
  start: { room: 'lobby', x: 10, y: 8, dir: 'up' },
  rooms: {
    // -------------------------------------------------------------- 参観ロビー・面会所
    lobby: {
      floor: T('floor'),
      tiles: [
        '######################',
        '#=w=w=c=w=dd=P=P=P=P=#',
        '#........o..o........#',
        '#.KKKK...o..o........#',
        '#........o..o........#',
        '#....................#',
        '#.BBB...........KKK..#',
        '#...................S#',
        '#p...........LL.....p#',
        '##########MM#####k####',
      ],
      legend: {
        '#': T('walltop'), '=': T('wall'), w: `${T('wall')}+${T('window')}`, c: `${T('wall')}+clock`, d: T('door'), P: `${T('wall')}+${T('panel')}`,
        K: T('counter'), o: T('rope'), B: T('bench'), S: 'stairs_up', L: 'locker', p: 'plant', M: 'exit_mat', k: T('mat'),
      },
      warps: [
        { x: 10, y: 9, to: 'exit' }, { x: 11, y: 9, to: 'exit' },
        { x: 10, y: 1, room: 'hall', tx: 2, ty: 14, dir: 'up', check: intoHall },
        { x: 11, y: 1, room: 'hall', tx: 2, ty: 14, dir: 'up', check: intoHall },
        { x: 17, y: 9, room: 'kaikan', tx: 8, ty: 8, dir: 'up', check: intoKaikan },
      ],
      entities: [
        npc('kokkai_guide', 3, 2, 'down', WHO.guide, { talk: guideTalk }),
        npc('kokkai_lobby_eishi', 13, 2, 'left', WHO.guard, {
          talk: async (g) => {
            if (myHouse(g)) { await g.say(['お疲れさまです、先生。どうぞお通りください。', '議員会館へは、うしろの通用口からどうぞ。'], say(WHO.guard)); return; }
            await g.say(['ここから先は院内です。議員と許可のある方だけが入れます。', '見学は参観受付、本会議の傍聴は傍聴人受付へ。'], say(WHO.guard));
          },
        }),
        npc('kokkai_bocho', 17, 5, 'down', WHO.bocho, { talk: bochoDesk }),
        npc('kokkai_press', 6, 7, 'right', WHO.press, {
          cond: (g) => !!sessionOf(g),
          talk: async (g) => {
            const h = myHouse(g);
            if (h) { await g.say(['先生、ひと言いただけますか！', '…あ、ノーコメントですか。\n（記者会見は、事務所で開くといいだろう）'], say(WHO.press)); return; }
            await g.say(['国会担当の記者です。会期中は毎日ここに詰めてます。', '本会議の採決、委員会の質疑…\n法律が決まるまでの道のりは、意外と長いんですよ。'], say(WHO.press));
          },
        }),
        npc('kokkai_student', 15, 7, 'up', WHO.visitor, {
          wander: 1,
          text: ['修学旅行で国会見学に来ました！', '中央広間の銅像の台座、ひとつだけ空いてるんですって。\nなんでだろう？'],
        }),
        boardProp(6, 5),
      ],
      events: [
        ...PANELS.map((pnl, i) => ({ x: 13 + i * 2, y: 1, on: 'action', run: (g) => g.say(pnl.lines) })),
        { x: 20, y: 7, on: 'step', run: stairsToGallery },
        { x: 13, y: 8, w: 2, on: 'action', run: (g) => g.say('手荷物を預けるロッカーだ。\n傍聴席には、カメラや大きな荷物は持ちこめない。') },
      ],
      onEnter: async (g) => {
        if (g.flag('kokkai_touring')) g.setFlag('kokkai_touring', false);
        if (g.flag('kokkai_firstday') && myHouse(g)) { await firstDay(g); return; }
        if (!g.flag('kokkai_welcome')) {
          g.setFlag('kokkai_welcome');
          await g.say(['国会議事堂の、参観ロビーに入った。', '左は国会見学（参観）の受付、右は本会議の傍聴人受付。\n正面の扉の先が、院内だ。']);
        }
      },
    },

    // -------------------------------------------------------------- 中央広間
    hall: {
      floor: T('mosaic'),
      topPad: 24,
      bgm: 'kokkai',
      tiles: [
        '########################',
        '#=01=23====dd====45=67=#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#......................#',
        '........................',
        '........................',
        '#......................#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#......................#',
        '##m#######GHIJ##########',
      ],
      legend: {
        '#': T('walltop'), '=': T('hwall'), d: T('door'), m: T('mat'),
        0: T('mural0_0'), 1: T('mural0_1'), 2: T('mural1_0'), 3: T('mural1_1'), 4: T('mural2_0'), 5: T('mural2_1'), 6: T('mural3_0'), 7: T('mural3_1'),
        G: T('gate0'), H: T('gate1'), I: T('gate2'), J: T('gate3'),
      },
      warps: [
        { x: 2, y: 15, room: 'lobby', tx: 10, ty: 2, dir: 'down' },
        { x: 0, y: 7, room: 'shugi', tx: 14, ty: CH_H - 2, dir: 'up', check: intoChamber('shugi') },
        { x: 0, y: 8, room: 'shugi', tx: 15, ty: CH_H - 2, dir: 'up', check: intoChamber('shugi') },
        { x: 23, y: 7, room: 'sangi', tx: 14, ty: CH_H - 2, dir: 'up', check: intoChamber('sangi') },
        { x: 23, y: 8, room: 'sangi', tx: 15, ty: CH_H - 2, dir: 'up', check: intoChamber('sangi') },
        { x: 11, y: 1, room: 'iinkai', tx: 10, ty: 11, dir: 'up', check: intoIinkai },
        { x: 12, y: 1, room: 'iinkai', tx: 11, ty: 11, dir: 'up', check: intoIinkai },
      ],
      entities: [
        statueProp(3, 3, 'a', { text: STATUE_TEXT }),
        statueProp(19, 3, 'b', { text: STATUE_TEXT }),
        statueProp(3, 11, 'c', { text: STATUE_TEXT }),
        statueProp(19, 11, 'empty', { text: EMPTY_TEXT }),
        npc('kokkai_hall_guide', 12, 9, 'down', WHO.guide, { cond: (g) => !!g.flag('kokkai_touring'), text: '中央広間です。どうぞ天井をご覧ください。' }),
        npc('kokkai_hall_eishi', 21, 13, 'left', WHO.guard, {
          talk: async (g) => { await g.say(['中央玄関の扉は、ブロンズ製で1枚1.1トンあります。', 'ふだんは閉じていて「あかずの扉」と呼ばれます。\n開くのは、天皇陛下のお出迎え、選挙後の初登院、\n国賓をお迎えするときです。'], say(WHO.guard)); },
        }),
        { type: 'sign', x: 0, y: 6, text: '← 衆議院（本会議場）' },
        { type: 'sign', x: 23, y: 6, text: '参議院（本会議場） →' },
      ],
      events: [
        { x: 10, y: 14, w: 4, on: 'action', run: (g) => g.say(['中央玄関の内側だ。重そうなブロンズの扉が閉じている。', '（この扉が開くのは、特別な日だけだ）']) },
        ...SEASONS.map(([nm], i) => ({ x: [2, 5, 17, 20][i], y: 1, w: 2, on: 'action', run: (g) => g.say(`壁の上の壁画「${nm}」だ。\n日本の${nm}の景色が、やわらかな色で描かれている。`) })),
        { x: 11, y: 7, w: 2, h: 2, on: 'action', run: (g) => g.say(['床の大理石のモザイクに、色とりどりの光が落ちている。', '見上げると、はるか上の天井にステンドグラス。\n中央塔の真下だ。']) },
      ],
      drawUnder: hallUnder,
    },

    shugi: chamberRoom('shugi'),
    sangi: chamberRoom('sangi'),
    bocho_s: galleryRoom('shugi'),
    bocho_n: galleryRoom('sangi'),

    // -------------------------------------------------------------- 委員会室
    iinkai: {
      floor: T('gcarpet'),
      bgm: 'kokkai',
      tiles: [
        '######################',
        '#=w==w==P=XX=P==w==w=#',
        '#....................#',
        '#........CDDE........#',
        '#....................#',
        '#.T..............T...#',
        '#.T....q.....q...T...#',
        '#.T..............T...#',
        '#....................#',
        '#........K..K........#',
        '#.BBBB..........BBBB.#',
        '#....................#',
        '##########MM##########',
      ],
      legend: {
        '#': T('walltop'), '=': T('wall'), w: `${T('wall')}+${T('window')}`, P: `${T('wall')}+painting`, X: T('xwall'),
        C: T('dais_l'), D: T('dais_m'), E: T('dais_r'), T: T('ctable'), q: T('podium'), K: 'camera', B: T('bench'), M: T('mat'),
      },
      warps: [10, 11].map((x) => ({ x, y: 12, room: 'hall', tx: x === 10 ? 11 : 12, ty: 2, dir: 'down' })),
      entities: [
        {
          type: 'npc', id: 'kokkai_chair', x: 10, y: 2, dir: 'down', fixedDir: true,
          get name() { return '委員長'; },
          get look() { const g = GG(); const p = g && pol(g); return p ? npcLook(g, p.flags && p.flags.chair_budget) : LOOKS.oldman; },
          talk: async (g) => {
            const S = sessionOf(g);
            const lines = ['委員長です。委員会では、法案を細かく審査します。', '質疑の時間は、会派の人数の比率で割り当てています。'];
            if (!S) lines.push('いまは閉会中ですので、委員会は開いていません。');
            await g.say(lines, { name: '委員長', look: npcLook(g, pol(g) && pol(g).flags.chair_budget) });
          },
        },
        npc('kokkai_iinbu', 12, 2, 'down', WHO.iinbu, {
          fixedDir: true,
          text: ['委員部の職員です。質問の通告は、原則として\n前々日の正午までにお願いしています。', '通告があると、各省庁が答弁を準備します。\n夜遅くまでかかることも多いんです…。'],
        }),
        ...[[5, 'kanbo'], [6, 'minister_finance'], [7, 'minister_health']].map(([y, post]) => ({
          type: 'npc', id: `kokkai_gov_${post}`, x: 1, y, dir: 'right', fixedDir: true,
          get name() { const g = GG(); return g ? ministerName(g, post) : '大臣'; },
          get look() { const g = GG(); return g ? npcLook(g, ministerId(g, post)) : LOOKS.salaryman; },
          cond: (g) => !!sessionOf(g) && !!ministerId(g, post) && ministerId(g, post) !== 'player',
          talk: async (g) => { await g.say([`（答弁席の${ministerName(g, post)}だ）`, '分厚い答弁資料に、付せんがびっしりついている。']); },
        })),
        ...[5, 6, 7].map((y, i) => ({
          type: 'npc', id: `kokkai_member_${i}`, x: 18, y, dir: 'left', fixedDir: true, name: '委員',
          look: { ...LOOKS.salaryman, hair: ['slick', 'bald', 'short'][i], hairColor: ['black', 'gray', 'white'][i], tie: ['#c0452f', '#2f6fd0', '#2f8f4e'][i], top: '#2a2f45' },
          cond: (g) => !!sessionOf(g),
          text: ['（委員の議員が、配られた資料をめくっている）'],
        })),
        { type: 'npc', id: 'kokkai_answer', x: 6, y: 6, dir: 'right', fixedDir: true, name: '大臣', look: LOOKS.salaryman, hidden: true },
        npc('kokkai_tv', 13, 10, 'up', { name: 'テレビ中継のカメラマン', look: { ...LOOKS.cameraman || LOOKS.staff } }, {
          cond: (g) => !!sessionOf(g),
          text: ['予算委員会の質疑は、テレビで中継されることもあります。', '質問する人も答える人も、\n全国の人に見られていると思ってくださいね。'],
        }),
      ],
      events: [
        { x: 13, y: 6, on: 'action', run: (g) => shitsugi(g) },
        { x: 7, y: 6, on: 'action', run: (g) => toben(g) },
      ],
      onEnter: async (g) => {
        const a = g.npc('kokkai_answer');
        if (a) a.hidden = true;
      },
    },

    // -------------------------------------------------------------- 議員会館（事務所）
    kaikan: {
      floor: T('ocarpet'),
      bgm: 'office',
      tiles: [
        '##################',
        '#=w==w==c==w==p==#',
        '#BBB.........Zz.f#',
        '#................#',
        '#..TT......LL....#',
        '#..SS............#',
        '#................#',
        '#.kk....kk.......#',
        '#q..............q#',
        '########MM########',
      ],
      legend: {
        '#': T('walltop'), '=': T('wall'), w: `${T('wall')}+${T('window')}`, c: `${T('wall')}+clock`, p: `${T('wall')}+painting`, q: 'plant',
        B: 'bookshelf', Z: T('bigdesk_l'), z: T('bigdesk_r'), f: 'plant', T: 'table_low', S: 'sofa_beige', L: T('cabinet'), k: 'desk_pc', M: T('mat'),
      },
      warps: [8, 9].map((x) => ({ x, y: 9, room: 'lobby', tx: 17, ty: 8, dir: 'up' })),
      entities: [
        npc('kokkai_hisho', 3, 6, 'down', WHO.hisho, { talk: hishoTalk }),
        npc('kokkai_shisetsu', 9, 6, 'down', WHO.shisetsu, {
          cond: (g) => num(me(g) && me(g).staff) >= 1,
          text: ['私設秘書の小野です！地元回りの日程、組んでおきます。', '選挙のときは、ぼくら秘書の出番です。\nもちろん、法律の範囲で、ですけどね。'],
        }),
        {
          type: 'npc', id: 'kokkai_chinjo', x: 2, y: 4, dir: 'right',
          get name() { const g = GG(); return g ? chinjoToday(g).name : '陳情の人'; },
          get look() { const g = GG(); return g ? chinjoToday(g).look : LOOKS.oldman; },
          cond: (g) => !!myHouse(g) && !(me(g).lastAct && me(g).lastAct['陳情を受ける'] === today(g)),
          talk: chinjoTalk,
        },
        npc('kokkai_briber', 5, 4, 'left', BRIBER, { cond: (g) => briberToday(g), talk: briberTalk }),
      ],
      events: [
        { x: 13, y: 2, w: 2, on: 'action', run: async (g) => { if (!myHouse(g)) { await g.say('議員の机だ。'); return; } await g.say(['自分の机だ。議員バッジの箱と、\n読みかけの法案の資料が積んである。', ...ledgerPages(g).slice(-2)]); } },
        { x: 11, y: 4, w: 2, on: 'action', run: async (g) => { if (!myHouse(g)) { await g.say('書類棚だ。鍵がかかっている。'); return; } await g.say(['政治資金の帳簿と領収書をしまう棚だ。', '（帳簿の確認や収支報告書の提出は、秘書に頼もう）']); } },
        { x: 1, y: 2, w: 3, on: 'action', run: (g) => g.say('法令集、審議の資料、地元の地図…。\n議員の仕事は、とにかく読むものが多い。') },
      ],
      onEnter: async (g) => {
        if (!myHouse(g) || g.flag('kokkai_kaikan_intro')) return;
        g.setFlag('kokkai_kaikan_intro');
        await g.say([`先生、${houseName(myHouse(g))}議員会館の事務所へようこそ。`, '公設秘書は3人、国費で雇われています。\n政策担当秘書の白石です。よろしくお願いします。', '帳簿、収支報告、献金、陳情…なんでもご相談ください。'], say(WHO.hisho));
      },
    },
  },
});
