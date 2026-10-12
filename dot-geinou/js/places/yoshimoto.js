// よしもと 東京本部（東京エリア）
//
//   lobby   ロビー        受付・売店・モニター・ロゴ看板。初回はようこそイベント。
//   office  事務所フロア   マネージャー（お仕事リスト）・新人発掘担当（オーディション）。
//   keiko   稽古場        レッスン2種・コンビ「ぽんかんズ」のミニ漫才（カットシーン）。
//   theater 小劇場        前説・若手ライブ・大喜利ライブ・冠番組の公開収録・お笑いグランプリ決勝。
//
// ステージ系のお仕事は、どこで引き受けても小劇場の舞台に移動して演じ、終わると元の場所に戻る。

import { registerPlace } from '../engine/map.js';
import { LOOKS, charSheet, drawChar } from '../engine/sprites.js';
import { defineTile, tileImage, R, P } from '../engine/tiles.js';
import { registerItem, AGENCIES } from '../engine/state.js';
import { registerSong } from '../engine/audio.js';
import { text, panel } from '../engine/draw.js';
import { W, H, fmtMoney, pick } from '../engine/util.js';

const PID = 'yoshimoto';

// ------------------------------------------------------------------ palette
const OR = '#e8492a';
const ORD = '#b8381e';
const ORX = '#8a2a14';
const ORL = '#ff7a4a';
const ORP = '#ffb27a';
const CR = '#fbf1e4';
const INK = '#20232a';
const GOLD = '#ffd23f';

function disc(c, cx, cy, rad, col) {
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y <= rad * rad + rad * 0.6) P(c, cx + x, cy + y, col);
    }
  }
}
// rect helper for entity draw() (screen ctx, rounds to whole pixels)
const box = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

// ------------------------------------------------------------------ tiles
defineTile('yoshimoto_walltop', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#5a2c1e'); R(c, 0, 0, 16, 1, '#6e3a28'); R(c, 0, 15, 16, 1, '#c8603a'); },
});
// Upper half of a 2-tile-tall wall: cornice band in the company color.
defineTile('yoshimoto_wall_u', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, CR);
    R(c, 0, 1, 16, 3, OR); R(c, 0, 1, 16, 1, ORL); R(c, 0, 4, 16, 1, ORD);
    R(c, 0, 5, 16, 1, '#f1e0ca');
    R(c, 15, 6, 1, 10, '#f3e6d6');
  },
});
// Lower half (also used as the single wall face): chair rail + orange baseboard.
defineTile('yoshimoto_wall', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, CR);
    R(c, 15, 0, 1, 12, '#f3e6d6');
    R(c, 0, 6, 16, 1, ORP);
    R(c, 0, 12, 16, 4, OR); R(c, 0, 12, 16, 1, ORX); R(c, 0, 15, 16, 1, ORD);
  },
});
// Orange-red feature wall behind the reception (logo backdrop).
defineTile('yoshimoto_feature_u', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, OR);
    R(c, 0, 1, 16, 3, ORD); R(c, 0, 1, 16, 1, ORL);
    for (let x = 1; x < 16; x += 4) R(c, x, 5, 2, 11, '#f05a36');
  },
});
defineTile('yoshimoto_feature', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, OR);
    for (let x = 1; x < 16; x += 4) R(c, x, 0, 2, 12, '#f05a36');
    R(c, 0, 12, 16, 4, ORD); R(c, 0, 12, 16, 1, ORX);
  },
});
defineTile('yoshimoto_floor', {
  variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, v ? '#f6ead9' : '#f1e2cd');
    R(c, 0, 0, 16, 1, '#e3cfb4'); R(c, 0, 0, 1, 16, '#e3cfb4');
    R(c, 3, 3, 2, 1, '#fffaf2'); P(c, 3, 4, '#fffaf2');
  },
});
function runner(side) {
  return (c) => {
    R(c, 0, 0, 16, 16, OR);
    for (let y = 3; y < 16; y += 8) { R(c, 7, y, 2, 1, ORL); R(c, 6, y + 1, 4, 1, ORL); R(c, 7, y + 2, 2, 1, ORL); }
    if (side === 'l') { R(c, 0, 0, 2, 16, GOLD); R(c, 2, 0, 1, 16, ORD); } else { R(c, 14, 0, 2, 16, GOLD); R(c, 13, 0, 1, 16, ORD); }
  };
}
defineTile('yoshimoto_carpet_l', { draw: runner('l') });
defineTile('yoshimoto_carpet_r', { draw: runner('r') });
defineTile('yoshimoto_counter', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 1, 16, 6, '#fffaf2'); R(c, 0, 1, 16, 1, '#ffffff'); R(c, 0, 7, 16, 1, '#d8c8b0');
    R(c, 0, 8, 16, 8, OR); R(c, 0, 8, 16, 1, ORD); R(c, 0, 11, 16, 1, ORL); R(c, 0, 15, 16, 1, ORX);
  },
});
// Wall-mounted monitor that shows a tiny manzai duo (the tsukkomi slaps on odd frames).
defineTile('yoshimoto_tv', {
  solid: true, obj: true, frames: 4, speed: 22,
  draw(c, r, f) {
    R(c, 1, 1, 14, 11, INK);
    R(c, 2, 2, 12, 8, f >= 2 ? '#ffd9a8' : ORP);
    R(c, 2, 8, 12, 2, '#8a5a33');
    R(c, 7, 5, 1, 3, '#c3c8d2'); P(c, 7, 4, '#3b3f48');
    const slap = f % 2 === 1;
    R(c, slap ? 3 : 4, 3, 2, 2, '#f6c9a0'); R(c, 4, 5, 2, 3, GOLD);
    R(c, slap ? 9 : 10, 3, 2, 2, '#f6c9a0'); R(c, slap ? 9 : 10, 5, 2, 3, '#2f6fd0');
    if (slap) { R(c, 6, 4, 3, 1, '#f6c9a0'); P(c, 3, 2, '#ffffff'); P(c, 12, 3, '#ffffff'); }
    R(c, 6, 12, 4, 1, '#4a4e58');
  },
});
defineTile('yoshimoto_poster', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) {
    const bg = [OR, GOLD, '#2f6fd0'][v];
    const fg = ['#ffffff', OR, GOLD][v];
    R(c, 3, 1, 10, 12, INK); R(c, 4, 2, 8, 10, bg);
    disc(c, 8, 5, 2, fg);
    P(c, 7, 4, bg); P(c, 9, 4, bg); R(c, 7, 6, 3, 1, bg);
    R(c, 5, 9, 6, 1, fg); R(c, 6, 11, 4, 1, fg);
  },
});
// Waiting bench seen from behind (people sitting on it face the monitors).
defineTile('yoshimoto_bench', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 14, 14, 2, 'rgba(0,0,0,0.2)');
    R(c, 0, 3, 16, 5, ORL); R(c, 0, 3, 16, 1, '#ffc09a');
    R(c, 0, 7, 16, 6, OR); R(c, 0, 7, 16, 1, '#ff9a6a'); R(c, 0, 12, 16, 1, ORD);
    R(c, 2, 13, 2, 2, '#3b2a20'); R(c, 12, 13, 2, 2, '#3b2a20');
  },
});
defineTile('yoshimoto_goods', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#8a5a33'); R(c, 1, 1, 14, 14, '#fff3e6');
    R(c, 1, 5, 14, 1, '#8a5a33'); R(c, 1, 10, 14, 1, '#8a5a33');
    [OR, GOLD, OR, '#ffffff'].forEach((col, i) => { R(c, 2 + i * 3, 2, 2, 3, col); P(c, 2 + i * 3, 2, '#20232a'); });
    R(c, 2, 6, 5, 4, OR); R(c, 3, 7, 3, 1, '#ffffff'); R(c, 8, 6, 5, 4, GOLD); R(c, 9, 7, 3, 1, OR);
    R(c, 2, 11, 4, 3, '#c48a52'); R(c, 7, 11, 4, 3, '#c48a52'); R(c, 12, 11, 2, 3, OR);
  },
});
defineTile('yoshimoto_elev_u', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, CR);
    R(c, 0, 1, 16, 3, OR); R(c, 0, 1, 16, 1, ORL);
    R(c, 1, 5, 14, 11, '#7d8391'); R(c, 2, 8, 12, 8, '#c3c8d2'); R(c, 7, 8, 2, 8, '#9aa0aa'); R(c, 2, 8, 12, 1, '#e0e4ea');
    R(c, 4, 5, 8, 2, INK); P(c, 5, 5, GOLD); R(c, 4, 6, 3, 1, GOLD); P(c, 10, 6, '#5ee07a'); R(c, 9, 5, 3, 1, '#5ee07a');
  },
});
defineTile('yoshimoto_elev', {
  draw(c) {
    R(c, 0, 0, 16, 16, CR);
    R(c, 1, 0, 14, 16, '#7d8391'); R(c, 2, 0, 12, 15, '#c3c8d2'); R(c, 7, 0, 2, 15, '#9aa0aa');
    R(c, 3, 1, 1, 11, '#e0e4ea'); R(c, 10, 1, 1, 11, '#e0e4ea'); R(c, 2, 15, 12, 1, '#5a5f6b');
  },
});
defineTile('yoshimoto_door_u', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, CR);
    R(c, 0, 1, 16, 3, OR); R(c, 0, 1, 16, 1, ORL);
    R(c, 2, 5, 12, 11, '#6e4428'); R(c, 3, 6, 10, 10, '#c48a52');
    R(c, 4, 8, 8, 5, '#a8dcf5'); R(c, 4, 8, 8, 1, '#e0f4ff'); R(c, 5, 14, 6, 2, '#fff6e0');
  },
});
defineTile('yoshimoto_door', {
  draw(c) {
    R(c, 0, 0, 16, 16, CR);
    R(c, 2, 0, 12, 16, '#6e4428'); R(c, 3, 0, 10, 15, '#c48a52');
    R(c, 4, 2, 8, 4, '#b47a46'); R(c, 4, 8, 8, 5, '#b47a46'); R(c, 11, 6, 2, 2, GOLD); R(c, 2, 15, 12, 1, '#5a3a20');
  },
});
// Red padded theater double doors under a marquee (l = left leaf, r = right leaf).
function tdoor(side, upper) {
  const L = side === 'l';
  return (c) => {
    R(c, 0, 0, 16, 16, CR);
    if (upper) {
      R(c, 0, 1, 16, 5, INK);
      for (let x = L ? 1 : 0; x < 16; x += 3) { P(c, x, 1, '#fff6a8'); P(c, x, 5, '#fff6a8'); }
      R(c, L ? 3 : 0, 3, 13, 1, ORL);
      if (L) { R(c, 1, 8, 15, 8, '#5a1a20'); R(c, 2, 9, 14, 7, '#a51f2c'); } else { R(c, 0, 8, 15, 8, '#5a1a20'); R(c, 0, 9, 14, 7, '#a51f2c'); }
      R(c, L ? 15 : 0, 9, 1, 7, '#3a0f14');
    } else {
      if (L) { R(c, 1, 0, 15, 16, '#5a1a20'); R(c, 2, 0, 14, 15, '#a51f2c'); } else { R(c, 0, 0, 15, 16, '#5a1a20'); R(c, 0, 0, 14, 15, '#a51f2c'); }
      for (let y = 2; y < 15; y += 4) for (let x = L ? 4 : 2; x < (L ? 15 : 13); x += 4) P(c, x, y, '#e8c43a');
      R(c, L ? 12 : 2, 5, 2, 4, '#e8c43a');
      R(c, L ? 15 : 0, 0, 1, 15, '#3a0f14');
      R(c, 0, 15, 16, 1, '#3a0f14');
    }
  };
}
defineTile('yoshimoto_tdoor_ul', { solid: true, draw: tdoor('l', true) });
defineTile('yoshimoto_tdoor_ur', { solid: true, draw: tdoor('r', true) });
defineTile('yoshimoto_tdoor_l', { draw: tdoor('l', false) });
defineTile('yoshimoto_tdoor_r', { draw: tdoor('r', false) });
// Rehearsal-room mirror wall (2 tiles tall, continuous) with a ballet barre.
function mirrorShine(c) {
  for (let i = 0; i < 6; i++) { P(c, 3 + i, 13 - i, '#ffffff'); P(c, 4 + i, 13 - i, '#eaf6ff'); P(c, 10 + i, 9 - i, '#eaf6ff'); }
}
defineTile('yoshimoto_mirror_u', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#9aa0aa'); R(c, 0, 2, 16, 14, '#cfe8f5'); R(c, 0, 2, 16, 1, '#6d7078'); mirrorShine(c); },
});
defineTile('yoshimoto_mirror', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#cfe8f5'); mirrorShine(c);
    R(c, 0, 6, 16, 2, '#c48a52'); R(c, 0, 6, 16, 1, '#e0aa70'); R(c, 7, 8, 1, 2, '#9aa0aa');
    R(c, 0, 12, 16, 4, '#9aa0aa'); R(c, 0, 12, 16, 1, '#6d7078');
  },
});
// Manager desk / audition table: you can talk to the person behind them.
defineTile('yoshimoto_desk', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 1, 14, 14, 1, 'rgba(0,0,0,0.2)');
    R(c, 0, 3, 16, 7, '#c48a52'); R(c, 0, 3, 16, 1, '#dca26a'); R(c, 0, 10, 16, 4, '#8a5a33'); R(c, 0, 10, 16, 1, '#6e4428');
    R(c, 2, 4, 5, 4, '#ffffff'); R(c, 3, 5, 3, 1, '#9aa0aa'); R(c, 3, 6, 2, 1, '#9aa0aa');
    R(c, 10, 4, 3, 3, OR); P(c, 13, 5, OR);
  },
});
defineTile('yoshimoto_jtable', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 3, 16, 6, '#f6f6f8'); R(c, 0, 3, 16, 1, '#ffffff');
    R(c, 0, 9, 16, 6, OR); R(c, 0, 9, 16, 1, ORD); R(c, 0, 14, 16, 1, ORX);
    R(c, 3, 4, 4, 3, '#fff6d0'); R(c, 4, 5, 2, 1, '#9aa0aa'); R(c, 9, 5, 3, 1, INK); R(c, 12, 2, 2, 4, '#8fd0ff');
  },
});
defineTile('yoshimoto_copier', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 3, 14, 12, '#d5d9e0'); R(c, 1, 3, 14, 3, '#f6f6f8'); R(c, 2, 4, 12, 1, '#9aa0aa');
    R(c, 3, 8, 10, 2, '#5a5f6b'); R(c, 10, 11, 3, 2, '#5ee07a'); R(c, 1, 14, 14, 1, '#7d8391'); R(c, 4, 1, 7, 2, '#ffffff');
  },
});
defineTile('yoshimoto_mat', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#7a3a1a'); R(c, 1, 1, 14, 14, '#d0662e');
    for (let y = 3; y < 14; y += 3) R(c, 2, y, 12, 1, '#e8884a');
  },
});
// "Mekuri": the paper stand at the side of the stage that shows the next act's name.
defineTile('yoshimoto_mekuri', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 13, 1, 3, '#6e4428'); R(c, 12, 13, 1, 3, '#6e4428');
    R(c, 2, 1, 12, 13, '#8a5a33'); R(c, 3, 2, 10, 11, '#ffffff'); R(c, 2, 1, 12, 1, '#5a3a20');
    R(c, 7, 3, 2, 2, INK); R(c, 6, 6, 4, 1, INK); R(c, 7, 7, 2, 2, INK); R(c, 6, 10, 3, 1, INK); P(c, 8, 11, INK);
  },
});
defineTile('yoshimoto_standsign', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 11, 1, 5, '#6e4428'); R(c, 12, 11, 1, 5, '#6e4428');
    R(c, 2, 1, 12, 11, INK); R(c, 3, 2, 10, 9, OR);
    R(c, 4, 4, 8, 1, '#ffffff'); R(c, 4, 6, 6, 1, '#ffffff'); R(c, 4, 8, 7, 1, GOLD);
  },
});
defineTile('yoshimoto_carpet_dark', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#4a2232');
    P(c, 3, 3, '#5e2e40'); P(c, 11, 11, '#5e2e40'); P(c, 11, 3, '#3e1c2a'); P(c, 3, 11, '#3e1c2a');
  },
});

// ------------------------------------------------------------------ items & music
registerItem('yoshimoto_senbei', { name: '笑顔せんべい', price: 250, desc: '体力が20回復する。にっこり顔のおせんべい。', heal: 20 });
registerItem('yoshimoto_trophy', { name: 'グランプリのトロフィー', price: 0, desc: 'お笑いグランプリ優勝の証。ピカピカに輝いている！' });

// A bouncy "debayashi" (entrance music) for the theater.
registerSong('yoshimoto_debayashi', {
  bpm: 152, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.045, notes: 'G4 . C5 . E5 . G5 . | A5 G5 E5 . C5 . . . | F5 . A5 . G5 . E5 . | D5 E5 D5 . G4 . . . | G4 . C5 . E5 . G5 . | A5 G5 E5 . C6 . A5 . | G5 . E5 . D5 . E5 D5 | C5 - - . . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 . . .' },
    { wave: 'drum', vol: 0.09, notes: 'k . h s k h s . | k . h s k s s s' },
  ],
});

// ------------------------------------------------------------------ people
const WHO = {
  uketsuke: { name: '受付さん', look: { ...LOOKS.receptionist, top: OR, bottom: '#5a2a1a' } },
  madoguchi: { name: 'ファンレター窓口', look: { ...LOOKS.receptionist, hair: 'long', hairColor: 'black', top: OR, bottom: '#5a2a1a' } },
  guard: { name: '警備員さん', look: LOOKS.guard },
  shop: { name: '売店のお姉さん', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#ff8a3d', bottom: '#5a4a3a', skirt: true } },
  fan: { name: 'お笑いファン', look: { ...LOOKS.fan, top: '#ff9a3c' } },
  wakate: { name: '若手芸人', look: LOOKS.comedian },
  kaichou: { name: '商店街の会長', look: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#3a58a8', bottom: '#2a2d36', glasses: true } },
  manager: { name: 'マネージャー 笑川', look: { ...LOOKS.manager, tie: OR } },
  scout: { name: '新人発掘担当', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#f2f2f2', bottom: '#2e3140', jacket: true, glasses: true } },
  jimuin: { name: '事務員さん', look: { hair: 'bob', hairColor: 'black', skin: 'fair', top: '#f6f6f8', bottom: '#5a6f8a', skirt: true } },
  sakka: { name: '構成作家', look: { hair: 'cap', hat: '#2f9a4a', hairColor: 'black', skin: 'fair', top: '#5a6f8a', bottom: '#3b3f48', glasses: true, beard: true } },
  senpai: { name: '先輩芸人', look: LOOKS.comedian2 },
  ponta: { name: 'ぽん太', look: { hair: 'spiky', hairColor: 'black', skin: 'fair', top: '#ff8a3d', bottom: '#ff8a3d', jacket: true, tie: GOLD } },
  kankichi: { name: 'かん吉', look: { hair: 'slick', hairColor: 'brown', skin: 'tan', top: '#ff8a3d', bottom: '#ff8a3d', jacket: true, tie: '#2f9a4a', glasses: true } },
  surudoki: { name: 'ツッコミ講師 鋭木', look: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#3a3a4a', bottom: '#2a2a33', jacket: true, tie: OR, glasses: true } },
  shabetani: { name: 'トーク講師 喋谷', look: { hair: 'bob', hairColor: 'purple', skin: 'light', top: OR, bottom: '#2a3560', skirt: true, jacket: true } },
  kenkyusei: { name: '研究生', look: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#f2f2f2', bottom: '#3b3f48' } },
  butai: { name: '舞台監督', look: { ...LOOKS.staff, top: INK, hat: OR } },
  obaachan: { name: '常連のおばあちゃん', look: LOOKS.oldwoman },
  student: { name: '修学旅行生', look: { ...LOOKS.kid, top: '#2a3560', bottom: '#2a3560' } },
  salaryman: { name: '仕事帰りの会社員', look: LOOKS.salaryman },
  pin: { name: 'ピン芸人', look: { ...LOOKS.comedian, hair: 'afro', hairColor: 'blonde', top: '#ff7eb6' } },
  mc: { name: '司会', look: { ...LOOKS.announcerM, tie: GOLD } },
  ad: { name: 'AD', look: LOOKS.ad },
};
WHO.duo = { name: 'ぽんかんズ', look: WHO.ponta.look };

const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });

// ------------------------------------------------------------------ minigame content
const LINES_LESSON = [
  { boke: 'どうも〜、よろしくお願いします！', punch: false },
  { boke: '最近、犬を飼い始めたんですよ', punch: false },
  { boke: '名前は「ネコ」っていいます', punch: true, tsukkomi: 'ややこしいわ！' },
  { boke: '毎朝いっしょに散歩してます', punch: false },
  { boke: 'ぼくが首輪つけて引っぱられてます', punch: true, tsukkomi: '逆やないか！' },
  { boke: '今日はお天気がいいですね', punch: false },
  { boke: 'なので傘を5本持ってきました', punch: true, tsukkomi: 'なんでやねん！' },
];
const LINES_WAKATE = [
  { boke: 'どうも〜！よろしくお願いします！', punch: false },
  { boke: 'ぼく、将来の夢がありまして', punch: false },
  { boke: '宇宙飛行士になりたいんです', punch: false },
  { boke: 'でも高いところが苦手で', punch: true, tsukkomi: '向いてへんやろ！' },
  { boke: 'あと乗り物酔いもします', punch: true, tsukkomi: 'なおさらや！' },
  { boke: 'せやから、まずは練習で…', punch: false },
  { boke: '毎日ブランコこいでます', punch: true, tsukkomi: '地上すぎるわ！' },
];
const LINES_KANMURI = [
  { boke: 'さあ今週も始まりました！', punch: false },
  { boke: '今日のゲストは、なんと…', punch: false },
  { boke: '近所の八百屋のおっちゃんです', punch: true, tsukkomi: '豪華ちゃうやろ！' },
  { boke: 'では、お料理のコーナー！', punch: false },
  { boke: '本日はゆで卵を作ります', punch: false },
  { boke: 'まずは卵を電子レンジに…', punch: true, tsukkomi: '危ない危ない！' },
  { boke: 'では、CMのあともお楽しみに！', punch: false },
  { boke: 'なお、CMはありません', punch: true, tsukkomi: 'ないんかい！' },
];
const LINES_GP = [
  { boke: 'どうも〜！決勝、がんばります！', punch: false },
  { boke: 'ぼく、こう見えて実は', punch: false },
  { boke: '忍者の子孫なんですよ', punch: false },
  { boke: '得意な術は「分身の術」！', punch: false },
  { boke: '…ほら、二人になったでしょ？', punch: true, tsukkomi: 'それ相方や！' },
  { boke: 'ほな次は「変身の術」！', punch: false },
  { boke: '（メガネをかける）', punch: true, tsukkomi: '地味すぎるわ！' },
  { boke: '最後に「消える術」！', punch: false },
  { boke: 'ほな、さいなら〜', punch: true, tsukkomi: '帰るな！' },
];

const TALK_MAESETSU = {
  topic: '前説：客席をあっためよう！',
  scenes: [
    { prompt: '本番前。お客さんはまだ少し緊張しているみたい…', answers: [{ text: '拍手の練習しましょう！', score: 100 }, { text: '静かにしてくださーい', score: 20 }, { text: '（無言でおじぎ）', score: 40 }] },
    { prompt: '最前列のお客さん「北海道から来ました！」', answers: [{ text: '遠っ！ようこそ〜！', score: 100 }, { text: 'へえ…', score: 10 }, { text: 'ご近所さんですね', score: 50 }] },
    { prompt: 'ADさんから「あと1分です」の合図！', answers: [{ text: '最後に大きな拍手を！', score: 100 }, { text: 'もう帰ります', score: 20 }, { text: '1分って長いな〜', score: 50 }] },
  ],
};
const TALK_MATSURI = {
  topic: 'お祭りの営業：商店街を盛り上げろ！',
  scenes: [
    { prompt: '子どもたちがステージの前に集まってきた！', answers: [{ text: 'みんな〜元気かな？', score: 100 }, { text: '大人の話をしよう', score: 20 }, { text: '（ひたすら手をふる）', score: 50 }] },
    { prompt: '会長さん「うちの名物も紹介してや！」', answers: [{ text: 'コロッケ、絶品です！', score: 100 }, { text: '名物ってなんでしたっけ', score: 30 }, { text: 'ほな、ぼくの話を…', score: 40 }] },
    { prompt: '急に雨がぽつぽつ…お客さんがそわそわ', answers: [{ text: '雨にも負けへんで〜！', score: 100 }, { text: '解散で！', score: 10 }, { text: 'テントに入りましょう', score: 70 }] },
    { prompt: 'ラストに「何かひと言！」', answers: [{ text: '商店街、最高〜！', score: 100 }, { text: '…特にないです', score: 10 }, { text: 'また呼んでな〜！', score: 80 }] },
  ],
};
const TALK_OOGIRI = {
  topic: '大喜利：お題にズバッと答えよう！',
  scenes: [
    { prompt: 'お題：こんなコンビニはイヤだ。どんなコンビニ？', answers: [{ text: '店員が全員忍者', score: 100 }, { text: '24時間営業', score: 10 }, { text: 'レジが1つしかない', score: 50 }] },
    { prompt: 'お題：桃太郎の、4匹目のお供とは？', answers: [{ text: '道に迷った観光客', score: 100 }, { text: 'イヌ', score: 10 }, { text: 'ネコ', score: 40 }] },
    { prompt: 'お題：おばあちゃんがラッパーに。最初のひと言は？', answers: [{ text: '「入れ歯 Yeah!」', score: 100 }, { text: '「こんにちは」', score: 10 }, { text: '「お茶飲む？Yo」', score: 70 }] },
    { prompt: 'お題：ロボットが初めて言った寝言とは？', answers: [{ text: '「充電あと5分…」', score: 100 }, { text: '「ピピピ」', score: 30 }, { text: '「おはよう」', score: 20 }] },
  ],
};
const TALK_LESSON = {
  topic: 'トーク講座：話のキホン',
  scenes: [
    { prompt: '先生「最近あった面白い話をしてみて」', answers: [{ text: '昨日、電車でね…', score: 100 }, { text: '特にないです', score: 10 }, { text: 'えーと、えーと…', score: 30 }] },
    { prompt: '先生「相手の話には、どう返す？」', answers: [{ text: 'うなずいて広げる', score: 100 }, { text: '自分の話にすり替える', score: 20 }, { text: 'スマホを見る', score: 0 }] },
    { prompt: '先生「話のオチ、どこに置く？」', answers: [{ text: '最後にズバッと！', score: 100 }, { text: '最初に言っちゃう', score: 30 }, { text: 'オチはいらない', score: 20 }] },
  ],
};

// ------------------------------------------------------------------ jobs
// venue 'stage' = performed on the small theater's stage, 'matsuri' = shopping-street festival.
const JOBS = [
  {
    key: 'maesetsu', label: '前説', venue: 'stage', mode: 'maesetsu',
    info: '本番前にお客さんをあたためる係。\nだれでもOK／体力-15',
    def: { id: 'yoshimoto_maesetsu', title: '前説（番組の盛り上げ係）', desc: '本番前に客席をあたためる大事な係！', client: '舞台監督', stamina: 15, minigame: 'talk', opts: { difficulty: 1, ...TALK_MAESETSU }, pay: 1000, fame: 5, skill: 'talk', gain: 2 },
  },
  {
    key: 'wakate', label: '若手ライブ出演', venue: 'stage', mode: 'live',
    info: '小劇場の若手ライブで漫才を披露！\nよしもと所属／体力-20',
    def: { id: 'yoshimoto_wakate_live', title: '若手ライブ出演', desc: '劇場の若手ライブで漫才を披露！', client: '舞台監督', stamina: 20, minigame: 'tsukkomi', opts: { difficulty: 2, lines: LINES_WAKATE }, pay: 4000, fame: 15, skill: 'warai', gain: 2, requires: { agency: PID } },
  },
  {
    key: 'matsuri', label: 'お祭りの営業', venue: 'matsuri',
    info: '商店街のお祭りステージでトーク。\n事務所に所属していればOK／体力-25',
    def: { id: 'yoshimoto_matsuri', title: 'お祭りの営業', desc: '商店街のお祭りステージを盛り上げよう！', client: '商店街の会長', stamina: 25, minigame: 'talk', opts: { difficulty: 2, ...TALK_MATSURI }, pay: 5000, fame: 12, skill: 'talk', gain: 2, requires: { agency: true } },
  },
  {
    key: 'oogiri', label: '大喜利ライブ', venue: 'stage', mode: 'live',
    info: 'お題に答える劇場の大喜利ライブ。\n★250〜／体力-20',
    def: { id: 'yoshimoto_oogiri', title: '劇場の大喜利ライブ', desc: 'お題に面白い答えをズバッと返そう！', client: '舞台監督', stamina: 20, minigame: 'talk', opts: { difficulty: 3, ...TALK_OOGIRI }, pay: 10000, fame: 40, skill: 'warai', gain: 3, requires: { fame: 250 } },
  },
  {
    key: 'kanmuri', label: '冠番組の収録', venue: 'stage', mode: 'tv',
    info: '自分の名前がついた番組を公開収録！\n★1000〜／体力-25',
    def: { id: 'yoshimoto_kanmuri', title: '冠番組の収録', desc: '自分の名前がついた番組の公開収録！', client: 'マネージャー', stamina: 25, minigame: 'tsukkomi', opts: { difficulty: 4, lines: LINES_KANMURI }, pay: 30000, fame: 110, skill: 'warai', gain: 3, requires: { fame: 1000 } },
  },
  {
    key: 'gp', label: 'グランプリ決勝', venue: 'stage', mode: 'gp',
    info: '笑いの祭典の決勝！（1日1回）\nよしもと所属・★2000〜／体力-30',
    def: { id: 'yoshimoto_gp_final', title: 'お笑いグランプリ決勝', desc: '年に一度の笑いの祭典、その決勝の舞台！', client: 'マネージャー', stamina: 30, minigame: 'tsukkomi', opts: { difficulty: 5, lines: LINES_GP }, pay: 65000, fame: 220, skill: 'warai', gain: 4, requires: { agency: PID, fame: 2000 } },
  },
];
const job = (key) => JOBS.find((j) => j.key === key);

// Theater state while a show / the grand-prix celebration is staged (controls extra NPCs & props).
let show = null; // null | 'maesetsu' | 'live' | 'tv' | 'gp'
let party = false;

// ------------------------------------------------------------------ helpers
function here(g) {
  const p = g.map.player;
  return { room: g.map.roomId, x: p.x, y: p.y, dir: p.dir };
}
function placePlayer(g, x, y, dir) {
  Object.assign(g.map.player, { x, y, px: x * 16, py: y * 16, dir, moving: false, t: 0 });
}
function resetNpc(g, id, x, y, dir) {
  const e = g.npc(id);
  if (!e) return;
  Object.assign(e, { x, y, px: x * 16, py: y * 16, dir, moving: false, t: 0, path: [], speed: 1, waitT: 0 });
}
function dirTo(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
const member = (g) => g.state.agency === PID;
const today = (g, k) => g.flag(k) === g.state.day;
const gpNo = (g) => (g.flag('yoshimoto_gp_entries') || 0) + 1;

function hintFor(g, byManager = false) {
  const st = g.state;
  if (!st.agency) {
    return [
      byManager ? 'まずはオーディションに合格を！\nこのフロアの新人発掘担当が受け付けていますよ。' : 'まずは事務所のオーディションに合格を！\n2階の事務所フロアにいる新人発掘担当へどうぞ。',
      '劇場の「前説」なら、所属していなくてもOKですよ。',
    ];
  }
  if (st.agency !== PID) return `${AGENCIES[st.agency].name}の方ですね！\nロビーにいる商店街の会長さんが、お祭りの営業を探していましたよ。`;
  if (st.fame < 250) return '劇場の若手ライブとお祭りの営業で場数を踏もう！\n★250になったら大喜利ライブにも出られます。';
  if (st.fame < 1000) return '大喜利ライブで知名度をぐんぐん上げよう！\n★1000になったら、冠番組のお話が来るかも…！';
  if (st.fame < 2000) return '冠番組の収録で、目指せ★2000！\nそうなったら、お笑いグランプリ決勝に挑戦です！';
  if (!g.flag('yoshimoto_gp_champion')) return byManager ? 'いよいよお笑いグランプリ決勝！\n「お仕事」から、いつでもエントリーできますよ！' : 'いよいよお笑いグランプリ決勝！\n事務所フロアのマネージャーに声をかけてください！';
  return 'グランプリ王者、おめでとう！\n国民的スター（★4000）まであと少し。NHKやBSよしもとでも大活躍しよう！';
}

function confirmText(def, title = def.title) {
  return `${def.desc}\n「${title}」\nギャラ ${fmtMoney(def.pay)}〜／体力 -${def.stamina}`;
}

// Short label of what blocks a job right now (null = available).
function lockLabel(g, j) {
  const r = j.def.requires || {};
  const st = g.state;
  if (j.key === 'gp' && today(g, 'yoshimoto_gp_day')) return '本日終了';
  if (r.agency === true && !st.agency) return '要・事務所所属';
  if (typeof r.agency === 'string' && st.agency !== r.agency) return 'よしもと所属';
  if (r.fame && st.fame < r.fame) return `★${r.fame}〜`;
  return null;
}

// ------------------------------------------------------------------ confetti & celebration card
const CONFETTI = [GOLD, OR, '#ff7eb6', '#5fd7ff', '#5ee07a', '#ffffff'];
function drawConfetti(ctx, frame, n = 70) {
  for (let i = 0; i < n; i++) {
    const sp = 0.6 + (i % 5) * 0.22;
    const x = ((i * 53) % (W + 20)) - 10 + Math.sin((frame + i * 17) / 18) * 6;
    const y = ((frame * sp + i * 37) % (H + 20)) - 10;
    ctx.fillStyle = CONFETTI[i % CONFETTI.length];
    ctx.fillRect(Math.round(x), Math.round(y), (Math.floor((frame + i * 7) / 8) % 2) ? 2 : 3, 2);
  }
}

function partyCard(g, title, sub) {
  return new Promise((resolve) => {
    const scene = {
      t: 0,
      update(gg) {
        scene.t++;
        if (gg.auto || scene.t > 260 || (scene.t > 40 && (gg.input.pressed('a') || gg.input.pressed('b')))) { gg.pop(scene); resolve(); }
      },
      draw(ctx, gg) {
        drawConfetti(ctx, gg.frame, 110);
        const k = Math.min(1, scene.t / 14);
        const h = Math.round(74 * k);
        panel(ctx, 36, 84 - h / 2, W - 72, Math.max(8, h), { bg: '#7a1f12', edge: GOLD });
        if (k >= 1) {
          text(ctx, title, W / 2, 56, { size: 24, align: 'center', color: GOLD, outline: '#3a0f08' });
          text(ctx, sub, W / 2, 94, { size: 12, align: 'center', color: '#ffffff', shadow: '#3a0f08' });
        }
      },
    };
    g.push(scene);
  });
}

// Festival backdrop (opaque scene shown while doing the お祭りの営業 job).
function festivalScene(g) {
  const me = charSheet(g.state.look || {});
  const kai = charSheet(WHO.kaichou.look);
  const crowd = [LOOKS.kid, LOOKS.mom, LOOKS.oldman, LOOKS.fan, LOOKS.salaryman, LOOKS.oldwoman, LOOKS.tourist].map((l) => charSheet(l));
  return {
    opaque: true,
    update() {},
    draw(ctx, gg) {
      const t = gg.frame;
      box(ctx, 0, 0, W, H, '#1b2350');
      box(ctx, 0, 64, W, 60, '#26306a');
      for (let i = 0; i < 26; i++) box(ctx, (i * 67) % W, 4 + ((i * 23) % 14), 1, 1, i % 4 ? '#5a6aaa' : '#fff6a8');
      // stalls
      for (let i = 0; i < 5; i++) {
        const x = 6 + i * 64;
        box(ctx, x, 84, 52, 36, '#5a3a20');
        for (let k = 0; k < 6; k++) box(ctx, x - 2 + k * 9, 76, 9, 9, k % 2 ? '#d62f2f' : '#ffffff');
        box(ctx, x + 4, 92, 44, 10, '#ffd9a8');
        box(ctx, x + 8, 94, 6, 6, ['#c0452f', '#ffd23f', '#ff7eb6', '#8a4a20', '#5ee07a'][i]);
      }
      // lantern string
      box(ctx, 0, 30, W, 1, INK);
      for (let i = 0; i < 11; i++) {
        const x = 6 + i * 30 + Math.round(Math.sin(t / 30 + i));
        box(ctx, x - 3, 29, 16, 20, 'rgba(255,170,90,0.18)');
        box(ctx, x, 32, 10, 13, '#d62f2f'); box(ctx, x - 1, 34, 12, 9, '#d62f2f');
        box(ctx, x, 31, 10, 1, INK); box(ctx, x, 45, 10, 1, INK);
        box(ctx, x + 2, 35, 2, 7, '#ff8a6a');
      }
      text(ctx, 'ドット商店街 夏まつり', W / 2, 52, { align: 'center', size: 12, color: '#fff6a8', outline: '#7a1f12' });
      // stage with red/white curtain
      box(ctx, 92, 112, 136, 8, '#c48a52'); box(ctx, 92, 112, 136, 2, '#ddb06e');
      for (let k = 0; k < 17; k++) box(ctx, 92 + k * 8, 120, 8, 22, k % 2 ? '#d62f2f' : '#ffffff');
      drawChar(ctx, me, 'down', 0, 168, 98);
      drawChar(ctx, kai, 'right', 0, 112, 98);
      // crowd
      for (let i = 0; i < 13; i++) {
        const x = 2 + i * 24 + (i % 2) * 6;
        const y = 146 + (i % 3) * 5 + (Math.floor(t / 18 + i) % 2);
        drawChar(ctx, crowd[i % crowd.length], 'up', 0, x, y);
      }
    },
  };
}

// ------------------------------------------------------------------ stage shows
async function crowdReact(g, res) {
  const ids = ['yoshi_kyaku1', 'yoshi_kyaku2', 'yoshi_kyaku3', 'yoshi_aud1', 'yoshi_aud2', 'yoshi_aud3', 'yoshi_aud4', 'yoshi_aud5'];
  if (res.rank === 'S' || res.rank === 'A') {
    g.sfx('laugh');
    await Promise.all(ids.map((id, i) => g.emote(id, i % 2 ? '!' : 'w', 60)));
    g.sfx('applause');
  } else if (res.rank === 'B') {
    g.sfx('applause');
    await Promise.all(ids.map((id) => g.emote(id, '♪', 50)));
  } else {
    await Promise.all(ids.map((id) => g.emote(id, '…', 50)));
  }
}

async function showIntro(g, j) {
  if (j.mode === 'maesetsu') {
    await g.say('本番前の客席は、ちょっとざわざわしている。', {});
    await g.say('前説、よろしく頼むで！\nお客さんの緊張をほぐしてあげてな！', WHO.butai);
  } else if (j.mode === 'live') {
    g.sfx('drum');
    await g.wait(160);
    g.sfx('drum');
    await g.say('♪〜　出囃子が鳴った！\nセンターマイクの前に立つ！', {});
  } else if (j.mode === 'tv') {
    await g.say(['今日は{name}の冠番組『{name}のわははドット！』の公開収録！', '本番いきまーす！　5秒前、4、3…'], WHO.ad);
    g.sfx('chime');
  } else if (j.mode === 'gp') {
    g.sfx('fanfare');
    await g.say([`第${gpNo(g)}回 お笑いグランプリ、決勝！`, '泣いても笑っても、これが最後の出番！\nエントリーナンバー最終組…{name}！'], WHO.mc);
    g.sfx('applause');
  }
}

async function showAfter(g, j, res) {
  const good = res.rank === 'S' || res.rank === 'A';
  const bad = res.rank === 'C' || res.rank === 'D';
  if (j.mode === 'tv') {
    await g.say(good ? 'はいカット！最高の撮れ高です！\n来週の放送が楽しみですね！' : bad ? 'はいカット！…編集でなんとかします！\n次回もよろしくお願いします！' : 'はいカット！おつかれさまでした！\nいい番組になりそうです！', WHO.ad);
  } else if (j.mode !== 'gp') {
    await g.say(good ? 'ドッカンドッカンやったな！\nまた頼むで！' : bad ? 'まあ、こんな日もあるわ。\n稽古場で磨いて、また来てや！' : 'ええ感じやったで！\nおつかれさん！', WHO.butai);
  }
}

const CLIENT = { 舞台監督: WHO.butai, マネージャー: WHO.manager, 商店街の会長: WHO.kaichou };
const clientOf = (def, who) => who || CLIENT[def.client] || { name: def.client };

async function runStageJob(g, j, who) {
  const st = g.state;
  const def = j.def;
  const why = g.checkRequires(def.requires);
  if (why) { await g.say(why); return null; }
  if (j.key === 'gp' && today(g, 'yoshimoto_gp_day')) {
    await g.say('今日の決勝はもう終わりましたよ。\nまた明日、挑戦しましょう！', WHO.manager);
    return null;
  }
  const title = j.key === 'gp' ? `第${gpNo(g)}回 お笑いグランプリ決勝` : def.title;
  const i = await g.ask(confirmText(def, title), ['受ける', 'やめておく'], clientOf(def, who));
  if (i !== 0) return null;
  if (st.stamina < def.stamina) {
    await g.say('体力が足りない…。\n家で休むか、何か食べて回復しよう。');
    return null;
  }
  const origin = here(g);
  let res = null;
  show = j.mode;
  try {
    await g.fadeOut();
    await g.goto(PID, 'theater', 9, 2, 'down', { fade: false });
    await g.fadeIn();
    await showIntro(g, j);
    if (j.key === 'gp') {
      g.setFlag('yoshimoto_gp_day', st.day);
      g.setFlag('yoshimoto_gp_entries', gpNo(g));
    }
    res = await g.job({ ...def, title, confirm: false });
    if (res) {
      await crowdReact(g, res);
      await showAfter(g, j, res);
      if (j.key === 'gp') await gpResult(g, res);
    }
  } catch (e) {
    console.error(e);
  }
  await g.fadeOut();
  show = null;
  party = false;
  await g.goto(PID, origin.room, origin.x, origin.y, origin.dir, { fade: false });
  await g.fadeIn();
  return res;
}

async function runFestival(g, j, who) {
  const st = g.state;
  const def = j.def;
  const why = g.checkRequires(def.requires);
  if (why) { await g.say(why); return null; }
  const i = await g.ask(confirmText(def), ['受ける', 'やめておく'], clientOf(def, who));
  if (i !== 0) return null;
  if (st.stamina < def.stamina) {
    await g.say('体力が足りない…。\n家で休むか、何か食べて回復しよう。');
    return null;
  }
  await g.fadeOut();
  const bd = festivalScene(g);
  g.push(bd);
  await g.fadeIn();
  let res = null;
  try {
    g.sfx('drum');
    await g.say('商店街のお祭り会場にやってきた！\nちょうちんの明かりがきれいだ。');
    await g.say('みなさーん！今日はプロの芸人さんが来てくれましたで〜！', WHO.kaichou);
    res = await g.job({ ...def, confirm: false });
    if (res) {
      const good = res.rank === 'S' || res.rank === 'A';
      if (good) g.sfx('applause');
      await g.say(good ? 'いや〜、最高や！商店街のみんなも大喜びや！\n来年もぜひ頼むで！' : res.rank === 'B' ? 'おおきに！ええお祭りになったわ。\nまた頼むで！' : 'おおきに、おおきに。\n…次はもうちょい盛り上げてな！', WHO.kaichou);
    }
  } catch (e) {
    console.error(e);
  }
  await g.fadeOut();
  g.pop(bd);
  await g.fadeIn();
  return res;
}

const runJob = (g, j, who) => (j.venue === 'matsuri' ? runFestival(g, j, who) : runStageJob(g, j, who));

// ------------------------------------------------------------------ grand prix
async function drumroll(g, n = 8) {
  for (let k = 0; k < n; k++) { g.sfx('snare'); await g.wait(80); }
}

async function gpResult(g, res) {
  const win = res.rank === 'S' || res.rank === 'A';
  await g.say(`結果発表！\n第${g.flag('yoshimoto_gp_entries')}回 お笑いグランプリ、優勝は…`, WHO.mc);
  await drumroll(g);
  if (!win) {
    g.sfx('fail');
    await g.say('…別のコンビでした！\n{name}、惜しくも準優勝！', WHO.mc);
    await g.say('くやしい…！でも、決勝の舞台に立てたのは大きな一歩だ。\nまた明日、挑戦しよう！');
    return;
  }
  const first = !g.flag('yoshimoto_gp_champion');
  const wins = (g.flag('yoshimoto_gp_wins') || 0) + 1;
  g.setFlag('yoshimoto_gp_wins', wins);
  g.sfx('fanfare');
  await g.say('{name}！！！', WHO.mc);
  party = true;
  g.shake(16, 2);
  await partyCard(g, first ? '優勝！！' : `${wins}度目の優勝！`, g.fmt('お笑いグランプリ王者 {name}'));
  g.sfx('applause');
  // friends rush onto the stage
  await Promise.all([
    g.moveNpc('yoshi_p_manager', 'right right right right up right', 2),
    g.moveNpc('yoshi_p_kankichi', 'left left left up face:left', 2),
    g.moveNpc('yoshi_p_ponta', 'left left left up face:left', 2),
  ]);
  await Promise.all([g.emote('yoshi_p_manager', '♥'), g.emote('yoshi_p_ponta', '!'), g.emote('yoshi_p_kankichi', '!'), g.emote('player', '♪')]);
  if (first) {
    await g.say(['{name}さん…！やりましたね！', 'ぼ、ぼく、泣いてません…泣いてませんから…！'], WHO.manager);
    await g.say('ほんまにおめでとう！\n同じ稽古場で練習してた仲間として、誇らしいわ！', WHO.kankichi);
    await g.say('ぼくらも来年こそは…！\n…ところでトロフィー、ちょっと持たせて？', WHO.ponta);
    await g.moveNpc('yoshi_p_kankichi', 'face:right');
    g.sfx('hit');
    g.shake(8, 2);
    await g.emote('yoshi_p_ponta', '💢', 30);
    await g.say('あかんわ！自分で獲りや！', WHO.kankichi);
    g.sfx('laugh');
    await g.say('それでは、優勝賞金とトロフィーの授与です！', WHO.mc);
    g.sfx('coin');
    g.addMoney(100000, true);
    g.giveItem('yoshimoto_trophy', 1, true);
    g.setFlag('yoshimoto_gp_champion', true);
    await g.say(`優勝賞金 ${fmtMoney(100000)} と\nグランプリのトロフィーを手に入れた！`);
    g.sfx('fanfare');
    await g.say('{name}は「お笑いグランプリ王者」になった！\n国民的スターへ、また一歩近づいた！');
  } else {
    await g.say(`${wins}度目の優勝なんて…！\n{name}さん、もう伝説ですよ！`, WHO.manager);
    await g.say('強すぎるわ…！\nぼくらも負けてられへんな、ぽん太！', WHO.kankichi);
    await g.say('せやな！…で、次の決勝っていつ？', WHO.ponta);
  }
}

// ------------------------------------------------------------------ office: manager & audition
async function managerIntro(g) {
  g.setFlag('yoshimoto_mgr_intro');
  const m = g.npc('yoshi_manager');
  if (!m) return;
  await g.emote('yoshi_manager', '!');
  await g.say('おーい！{name}さーん！', WHO.manager);
  await g.moveNpc('yoshi_manager', 'right right down down left', 2);
  const p = g.map.player;
  const e = g.npc('yoshi_manager');
  g.facePlayer(dirTo(p.x, p.y, e.x, e.y));
  e.dir = dirTo(e.x, e.y, p.x, p.y);
  await g.say([
    'はじめまして！今日から{name}さんを担当する、マネージャーの笑川（えみかわ）です！',
    'お仕事の相談は、いつでもぼくのデスクまで来てくださいね。',
    'まずは劇場の「若手ライブ」で場数を踏みましょう！\n小劇場は、1階ロビーの右手の赤い扉です。',
    'それと…これ、ぼくからの入所祝いです！',
  ], WHO.manager);
  g.sfx('good');
  g.giveItem('netacho', 1, true);
  await g.say('ネタ帳をもらった！');
  await g.say('使うと、次のお笑いのお仕事が少しやさしくなりますよ。\nいっしょにてっぺん目指しましょう！', WHO.manager);
  await g.emote('player', '♪');
  await g.moveNpc('yoshi_manager', 'right up up left left face:down', 2);
  resetNpc(g, 'yoshi_manager', 13, 4, 'down');
}

async function jobBoard(g) {
  const items = JOBS.map((j) => {
    const lock = lockLabel(g, j);
    return { label: j.label, right: lock || fmtMoney(j.def.pay) + '〜', disabled: !!lock };
  });
  const k = await g.list({ title: 'お仕事リスト', items, x: 42, y: 30, w: 236, describe: (idx) => JOBS[idx] && JOBS[idx].info });
  if (k < 0 || !JOBS[k]) return;
  await runJob(g, JOBS[k], WHO.manager);
}

async function managerTalk(g) {
  const st = g.state;
  const who = WHO.manager;
  if (member(g) && !g.flag('yoshimoto_mgr_intro')) { await managerIntro(g); return; }
  let greet;
  if (!member(g)) {
    greet = 'ぼくは所属タレントさんのマネージャーです。\n所属していない方には、劇場の前説を紹介していますよ。';
  } else if (g.flag('yoshimoto_gp_champion')) {
    greet = 'グランプリ王者！今日もお仕事が山ほど来てますよ！';
  } else if (st.fame >= 2000) {
    greet = '{name}さん、ついにグランプリ決勝の出場権です！\n準備はいいですか？';
  } else if (st.fame >= 1000) {
    greet = '大変です！{name}さんの冠番組が決まりました！\n…いや、大変じゃなくて、めでたいんです！';
  } else {
    greet = pick(['おはようございます！今日もお仕事がんばろう！', '{name}さん、最近ちょっと顔が売れてきましたね〜！']);
  }
  const i = await g.ask(greet, ['お仕事', '相談する', 'またね'], who);
  if (i === 0) await jobBoard(g);
  else if (i === 1) await g.say(hintFor(g, true), who);
  else await g.say('いってらっしゃい！体には気をつけて！', who);
}

async function scoutTalk(g) {
  const st = g.state;
  const who = WHO.scout;
  if (member(g)) {
    await g.say(['おっ、{name}さん。すっかり、よしもとの顔だね！', '後輩たちのお手本になってあげてね。'], who);
    return;
  }
  if (!g.flag('yoshimoto_scout_met')) {
    g.setFlag('yoshimoto_scout_met');
    await g.say([
      'こんにちは！新人発掘担当です。\nよしもとは、いつでも新しい才能を探しています！',
      'オーディションの内容は、漫才のツッコミ！\n相方のボケを最後まで聞いて、ここや！というところでビシッとね。',
    ], who);
  }
  const other = st.agency ? `\n（合格すると${AGENCIES[st.agency].name}から移籍になります）` : '';
  const i = await g.ask('新人オーディション、受けてみる？' + other, ['受ける！', 'コツを聞く', 'やめておく'], who);
  if (i === 0) {
    const before = st.stats.minigames;
    const ok = await g.audition({ agency: PID, minigame: 'tsukkomi', opts: { difficulty: 2 }, pass: 55 });
    if (ok && member(g)) {
      await g.emote('yoshi_scout', '!');
      g.sfx('applause');
      await g.say(['おめでとう！あなたの笑い、しっかり届いたよ！', 'ようこそ、よしもとへ！'], who);
      await managerIntro(g);
    } else if (!ok && st.stats.minigames > before && !member(g)) {
      await g.say('筋は悪くないよ！\n奥の稽古場でレッスンを受けて、また来てね。', who);
    }
  } else if (i === 1) {
    await g.say([
      'ツッコミは「早すぎず、遅すぎず」。ボケのオチを聞いてから入るのが基本だよ。',
      'ふつうのセリフにツッコんじゃうと減点！落ち着いてね。',
      '1階の稽古場の鋭木先生のレッスンで練習できるし、売店の「ネタ帳」を使うと少しやさしくなるよ。',
    ], who);
  } else {
    await g.say('いつでも待ってるね！', who);
  }
}

// ------------------------------------------------------------------ rehearsal room: manzai & lessons
const NETA = [
  [
    { w: 'p', t: 'どうも〜、ぽんかんズです！\nよろしくお願いしま〜す！' },
    { w: 'p', t: 'いや〜、最近ぼく、健康のために\nジョギング始めたんですよ。' },
    { w: 'k', t: 'おお、ええやん。毎朝走ってんの？' },
    { w: 'p', t: '毎朝タクシーで5キロ！' },
    { w: 'k', hit: true, t: '走ってへんやないか！' },
    { w: 'p', emote: '…', t: 'メーターは、めっちゃ走ってたで。' },
    { w: 'k', t: 'うまいこと言わんでええねん！\nもうええわ！' },
  ],
  [
    { w: 'p', t: 'どうも〜、ぽんかんズです！' },
    { w: 'k', t: '今日はね、ぼくらの自己紹介からいきましょか。' },
    { w: 'p', t: 'はい！ぼくがぽん太、こっちが相方のかん吉。\n二人合わせて…「みかんズ」！' },
    { w: 'k', hit: true, t: '名前まちがえとるやないか！\n柑橘なのは合うてるけども！' },
    { w: 'p', t: 'ほな、今日はこのへんで〜。', move: ['yoshi_ponta', 'left left'] },
    { w: 'k', emote: '!', t: 'どこ行くねん！\nまだ始まったばっかりや！', after: ['yoshi_ponta', 'right right face:down'] },
    { w: 'k', t: 'もうええわ！' },
  ],
  [
    { w: 'k', t: 'ぼく、コンビニの店員やるから、\nお客さんやってくれる？' },
    { w: 'p', t: 'ウィーン。…いらっしゃいませ〜！' },
    { w: 'k', hit: true, t: 'それ店員が言うやつ！' },
    { w: 'p', t: 'すみません、このおにぎり温めてください。' },
    { w: 'k', t: 'かしこまりました。' },
    { w: 'p', t: '…37度くらいで。' },
    { w: 'k', hit: true, t: '体温か！なんでちょうど人肌やねん！\nもうええわ！' },
  ],
];

async function watchManzai(g, invited = false) {
  const i = await g.ask(invited ? 'せっかくやし、見ていってや！' : '新ネタできたんや。見ていく？', ['見る！', 'また今度'], WHO.ponta);
  if (i !== 0) {
    await g.say('残念やな〜。いつでも声かけてや！', WHO.kankichi);
    return;
  }
  await g.fadeOut();
  placePlayer(g, 5, 7, 'up');
  resetNpc(g, 'yoshi_ponta', 4, 4, 'down');
  resetNpc(g, 'yoshi_kankichi', 5, 4, 'down');
  await g.fadeIn();
  g.sfx('drum');
  await g.wait(150);
  g.sfx('drum');
  await g.wait(150);
  for (const s of pick(NETA)) {
    if (s.move) await g.moveNpc(s.move[0], s.move[1]);
    if (s.hit) {
      await g.moveNpc('yoshi_kankichi', 'face:left');
      g.sfx('hit');
      g.shake(8, 2);
      await g.emote('yoshi_ponta', '!', 24);
    }
    if (s.emote) await g.emote(s.w === 'p' ? 'yoshi_ponta' : 'yoshi_kankichi', s.emote, 36);
    await g.say(s.t, s.w === 'p' ? WHO.ponta : WHO.kankichi);
    if (s.after) await g.moveNpc(s.after[0], s.after[1]);
    if (s.hit) await g.moveNpc('yoshi_kankichi', 'face:down');
  }
  await g.say('どうも、ありがとうございました〜！', WHO.duo);
  g.sfx('applause');
  await g.emote('player', 'w');
  resetNpc(g, 'yoshi_ponta', 4, 4, 'down');
  resetNpc(g, 'yoshi_kankichi', 5, 4, 'down');
  if (!today(g, 'yoshimoto_duo_day')) {
    g.setFlag('yoshimoto_duo_day', g.state.day);
    g.addSkill('warai', 1, true);
    g.sfx('good');
    await g.say(`ネタを見て、お笑いのセンスが少し磨かれた！\n（お笑い +1・1日1回まで）`);
  } else {
    await g.say('何度見ても笑ってしまう…！');
  }
  if (member(g)) await g.say('同じよしもとの仲間やな！\nお互い、てっぺん目指してがんばろな！', WHO.kankichi);
  else await g.say('自分も、はよオーディション受けや〜！\n2階の事務所フロアで受けられるで。', WHO.kankichi);
}

async function surudokiTalk(g) {
  const st = g.state;
  const who = WHO.surudoki;
  const disc2 = member(g);
  const i = await g.ask('鋭木（するどき）や。ツッコミを教えとる。\nどのレッスンにする？' + (disc2 ? '\n（よしもと所属は割引価格や）' : ''), ['基礎レッスン', '応用クラス', 'コツを聞く', 'やめる'], who);
  if (i === 0) {
    await g.lesson({ title: '漫才（ツッコミ）レッスン', skill: 'warai', price: disc2 ? 2000 : 3000, stamina: 12, gain: 4, minigame: 'tsukkomi', opts: { difficulty: 1, lines: LINES_LESSON, partner: '鋭木先生', partnerLook: who.look }, teacher: who.name });
  } else if (i === 1) {
    if (st.fame < 250) {
      await g.say('応用クラスは、★250を超えた中堅向けや。\nまずは基礎をみっちりやるで！', who);
      return;
    }
    await g.lesson({ title: '漫才・応用クラス', skill: 'warai', price: disc2 ? 5000 : 6500, stamina: 15, gain: 5, minigame: 'tsukkomi', opts: { difficulty: 3, lines: LINES_WAKATE, partner: '鋭木先生', partnerLook: who.look }, teacher: who.name });
  } else if (i === 2) {
    await g.say([
      'ツッコミは「短く、強く、愛をこめて」や。',
      'ボケのオチまでちゃんと聞く。フリの段階でツッコんだら、お客さんが置いてけぼりになるで。',
      'あと、ぽんかんズのネタも見とき。プロの間（ま）は、見るだけでも勉強になる。',
    ], who);
  } else {
    await g.say('いつでも来なさい。稽古はウソつかへんで。', who);
  }
}

async function shabetaniTalk(g) {
  const who = WHO.shabetani;
  const disc2 = member(g);
  const i = await g.ask('トーク講師の喋谷（しゃべたに）です♪\n話がうまくなると、営業も大喜利もラクになるわよ。', ['トーク講座', 'コツを聞く', 'やめる'], who);
  if (i === 0) {
    await g.lesson({ title: 'トーク講座', skill: 'talk', price: disc2 ? 2000 : 2500, stamina: 10, gain: 3, minigame: 'talk', opts: { difficulty: 1, ...TALK_LESSON }, teacher: who.name });
  } else if (i === 1) {
    await g.say([
      'トークのコツは、相手の言葉をよく聞くこと。\n返しは、場の空気に合わせて選ぶのよ。',
      '前説は「お客さんを主役に」、大喜利は「意外だけど分かる」答えがウケるわ。',
      '話題の雑誌を読んでおくと、次のトークが少しラクになるわよ。',
    ], who);
  } else {
    await g.say('またね♪ 今日もたくさんしゃべってらっしゃい！', who);
  }
}

// ------------------------------------------------------------------ lobby
async function welcome(g) {
  g.setFlag('yoshimoto_welcome');
  await g.wait(250);
  await g.emote('yoshi_guard', '!');
  await g.say(['おっ、見ない顔やな。いらっしゃい！', 'ここは、よしもと東京本部や。\nまずは奥の受付へどうぞ！'], WHO.guard);
  const p = g.map.player;
  if (p.x === 9 && p.y === 11) await g.movePlayer('up up up up up up');
  await g.emote('yoshi_uketsuke', '♪');
  await g.say('いらっしゃいませ！\nよしもと東京本部へようこそ！', WHO.uketsuke);
  g.sfx('chime');
  await g.showLogo('yoshimoto', 'よしもと 東京本部');
  await g.say([
    'よしもとは1912年に大阪で生まれた、お笑いの会社なんですよ。',
    'エレベーターで2階に上がると事務所フロア。新人オーディションもそちらで受けられます。',
    '奥の木の扉は稽古場、右手の赤い扉は小劇場です。\n劇場の舞台監督に声をかければ、前説のお仕事ももらえますよ！',
  ], WHO.uketsuke);
}

const TV_SHOWS = [
  'モニターに、若手コンビの漫才が流れている。\n「もうええわ！」「どうも、ありがとうございました〜！」',
  'モニターでは、ひな壇トーク番組を放送中。\nスタジオが大爆笑に包まれている！',
  'モニターでは、大喜利の番組をやっている。\n「こんなお寿司屋さんはイヤだ」…クスッ。',
  'モニターでは、劇場からの生中継。\nお客さんの笑い声がここまで聞こえてくる！',
];
const FAN_LETTERS = [
  '「いつも元気をもらってます！これからも応援してます！」',
  '「テレビで見て、家族みんなで大笑いしました！」',
  '「受験勉強の合間に、ネタを見て元気出してます！」',
  '「おばあちゃんがファンです。体に気をつけてね」',
];

async function uketsukeTalk(g) {
  const who = WHO.uketsuke;
  const i = await g.ask('よしもと東京本部へようこそ！\nご用件をどうぞ♪', ['館内案内', 'よしもとって？', '次は何を？', 'またね'], who);
  if (i === 0) {
    await g.say([
      'エレベーターで2階へ上がると事務所フロア。\nマネージャーや新人発掘担当がいます。',
      '奥の木の扉は稽古場。ツッコミやトークのレッスンが受けられます。',
      '右手の赤い扉は小劇場。毎日いろんなライブをやっていますよ！',
    ], who);
  } else if (i === 1) {
    await g.say([
      'よしもとは1912年に大阪で生まれた、お笑いの会社です。',
      '漫才にコント、新喜劇…。\nたくさんの笑いを届けてきました。',
      '大阪・なんばには、よしもと新喜劇の劇場もあるんですよ。',
      'おとなりのBSよしもとでは、テレビ番組も作っています。\nのぞいてみてくださいね！',
    ], who);
  } else if (i === 2) {
    await g.say(hintFor(g), who);
  } else {
    await g.say('いってらっしゃいませ！', who);
  }
}

async function madoguchiTalk(g) {
  const who = WHO.madoguchi;
  const st = g.state;
  if (st.fame < 500) {
    await g.say(['こちらは、ファンレターと差し入れの窓口です。', '人気が出てきたら、{name}さん宛てのお手紙も届くようになりますよ。\n★500を超えたら、また来てくださいね！'], who);
    return;
  }
  if (today(g, 'yoshimoto_letter_day')) {
    await g.say('今日のお手紙は、さっきお渡ししたぶんで全部です。\n明日もきっと届きますよ！', who);
    return;
  }
  g.setFlag('yoshimoto_letter_day', st.day);
  await g.say('{name}さん宛てに、ファンレターが届いてますよ！', who);
  g.sfx('good');
  g.heal(10);
  await g.say([`手紙を読んだ。\n${pick(FAN_LETTERS)}`, 'あたたかい言葉に元気が出た！\n体力が10回復した。（1日1回）']);
}

async function guardTalk(g) {
  const who = WHO.guard;
  const st = g.state;
  if (st.fame >= 1000) {
    await g.say(['{name}さん！昨日もテレビで見ましたよ！', '…あ、あとで娘のぶんのサインもお願いできます？'], who);
  } else if (member(g)) {
    await g.say(['おっ、{name}さん。おつかれさまです！', '今日も劇場、がんばってや！\n体力が少ないときは、売店の笑顔せんべいがおすすめやで。'], who);
  } else {
    await g.say(['おつかれさまです！', 'ロビーと劇場は、だれでも入ってええで。\n芸人さんは毎日、奥の稽古場でネタを磨いとるんや。'], who);
  }
}

async function shopTalk(g) {
  await g.say('いらっしゃいませ〜！よしもと売店です。\n笑顔せんべいが人気ですよ！', WHO.shop);
  await g.shop(['yoshimoto_senbei', 'netacho', 'wadai', 'drink'], { title: 'よしもと売店', greeting: 'いらっしゃいませ〜！' });
  await g.say('ありがとうございました〜！\nまたどうぞ♪', WHO.shop);
}

async function fanTalk(g) {
  const who = WHO.fan;
  const st = g.state;
  if (g.flag('yoshimoto_gp_champion')) {
    await g.say('グランプリ優勝おめでとう！！\n決勝の録画、もう100回は見たよ！', who);
  }
  if (st.fame >= 500 && !today(g, 'yoshimoto_fan_day')) {
    await g.emote('yoshi_fan', '♥');
    const i = await g.ask('あっ！{name}さんですよね！？\nサインください！', ['いいよ！', 'ごめんね'], who);
    if (i === 0) {
      g.setFlag('yoshimoto_fan_day', st.day);
      g.sfx('good');
      g.addFame(2);
      await g.say('やったー！一生の宝物にします！\n友だちにも自慢しちゃおっと！', who);
    } else {
      await g.say('あっ、お急ぎですよね…！\nこれからも応援してます！', who);
    }
    return;
  }
  await g.say([
    'ここのモニター、ずっとお笑いが流れてるから一日いられるの！',
    '劇場の若手ライブは毎日やってるんだよ。\n応援してる若手がいるんだ〜。',
    member(g) ? 'あなたも、よしもとの芸人さん？\n舞台、見に行くね！' : 'オーディションに合格したら、あなたも劇場に出られるかもね！',
  ], who);
}

async function wakateTalk(g) {
  const who = WHO.wakate;
  if (member(g)) {
    await g.say([
      'お、同じよしもとやん！よろしくな！',
      '若手ライブは、小劇場の舞台監督さんに声かけたら出られるで。',
      'ネタ帳は売店でも買えるで。使うと次のお笑いの仕事がちょっとだけラクになるんや。',
    ], who);
  } else {
    await g.say([
      'オレもまだまだ駆け出しの若手芸人や。',
      'オーディションはツッコミが命！\nボケを最後まで聞いてから、ビシッと入れるんやで。',
      '早すぎても遅すぎてもアカン。\n…言うのは簡単なんやけどな！',
    ], who);
  }
}

async function kaichouTalk(g) {
  const who = WHO.kaichou;
  await g.say(['商店街の会長です。今日は営業のお願いに来たんや。', 'うちのお祭りで、ネタを披露してくれる芸人さんを探しててな。\nどこかの事務所に所属してる人なら大歓迎や！'], who);
  const i = await g.ask('お祭りの営業、引き受けてくれへん？', ['引き受ける', 'また今度'], who);
  if (i === 0) await runFestival(g, job('matsuri'), who);
  else await g.say('さよか。気が向いたら、いつでも声かけてや！', who);
}

// ------------------------------------------------------------------ theater
async function butaiTalk(g) {
  const who = WHO.butai;
  const st = g.state;
  const line = !st.agency
    ? '前説なら、所属してへん人でも大歓迎やで！\nライブに出たいなら、まずオーディションやな。'
    : st.fame < 250 ? '今日も舞台はあいてるで。\nどれに出る？' : '人気者がきたで〜！\n今日はどれに出る？';
  const i = await g.ask(line, ['前説', '若手ライブ', '大喜利ライブ', 'やめる'], who);
  if (i === 0) await runStageJob(g, job('maesetsu'), who);
  else if (i === 1) await runStageJob(g, job('wakate'), who);
  else if (i === 2) await runStageJob(g, job('oogiri'), who);
  else await g.say('出番がほしくなったら、いつでも言うてや。', who);
}

async function theaterFirst(g) {
  g.setFlag('yoshimoto_theater_first');
  await g.wait(200);
  await g.emote('yoshi_butai', '!');
  await g.say([
    'おっ、お客さん？それとも出演者さんかな？',
    'ここは、よしもと東京本部の小劇場。\n毎日いろんな若手が、この舞台に立っとるんや。',
    '前説のお仕事なら、所属してへん人でも大歓迎やで。\n舞台の右側にいるから、声かけてな！',
  ], WHO.butai);
}

// ------------------------------------------------------------------ props
function trophyCase(x, y) {
  return {
    type: 'prop', x, y, w: 1, h: 1,
    cond: (g) => !!g.flag('yoshimoto_gp_champion'),
    text: ['ガラスケースに、お笑いグランプリのトロフィーが飾られている。', '「祝 優勝 {name}」のプレートがピカピカだ！'],
    draw(ctx, sx, sy, g) {
      box(ctx, sx + 2, sy + 14, 12, 2, 'rgba(0,0,0,0.25)');
      box(ctx, sx + 2, sy + 8, 12, 7, '#8a5a33'); box(ctx, sx + 2, sy + 8, 12, 1, '#c48a52');
      box(ctx, sx + 6, sy + 10, 4, 2, GOLD);
      ctx.fillStyle = 'rgba(200,236,255,0.35)'; ctx.fillRect(sx + 3, sy - 8, 10, 16);
      box(ctx, sx + 3, sy - 8, 10, 1, '#e0f4ff'); box(ctx, sx + 3, sy - 8, 1, 16, '#e0f4ff');
      box(ctx, sx + 5, sy - 5, 6, 4, GOLD); box(ctx, sx + 4, sy - 5, 1, 2, GOLD); box(ctx, sx + 11, sy - 5, 1, 2, GOLD);
      box(ctx, sx + 7, sy - 1, 2, 3, '#e8b82a'); box(ctx, sx + 6, sy + 2, 4, 2, '#c9a227');
      if (Math.floor(g.frame / 20) % 3 === 0) box(ctx, sx + 6, sy - 4, 1, 1, '#ffffff');
    },
  };
}

// Center "sanpachi" mic between the duo in the rehearsal room (2 tiles wide footprint).
const sanpachi = {
  type: 'prop', x: 4, y: 5, w: 2, h: 1,
  talk: (g) => watchManzai(g, false),
  draw(ctx, sx, sy) {
    const cx = sx + 15;
    box(ctx, cx - 4, sy + 13, 10, 2, 'rgba(0,0,0,0.25)');
    box(ctx, cx - 3, sy + 12, 8, 2, '#3b3f48');
    box(ctx, cx, sy - 3, 2, 15, '#9aa0aa'); box(ctx, cx, sy - 3, 1, 15, '#d5d9e0');
    box(ctx, cx - 1, sy - 8, 4, 6, '#3b3f48'); box(ctx, cx - 1, sy - 8, 4, 1, '#7d8391'); box(ctx, cx, sy - 7, 1, 3, '#9aa0aa');
  },
};

// Shoulder camera drawn over a camera operator standing at (x, y) facing the stage.
const shoulderCam = (x, y) => ({
  type: 'prop', x, y, w: 1, h: 1, z: 1, solid: false, cond: () => show === 'tv',
  draw(ctx, sx, sy) {
    box(ctx, sx + 8, sy - 6, 7, 8, '#3b3f48'); box(ctx, sx + 9, sy - 9, 5, 4, INK); box(ctx, sx + 10, sy - 10, 3, 1, '#5fd7ff');
    box(ctx, sx + 14, sy - 4, 1, 1, '#ff2b3a');
  },
});

// Event banner hung across the front of the stage (row 5 = stage edge).
const gpBanner = {
  type: 'prop', x: 3, y: 5, w: 13, h: 1, solid: false, cond: () => show === 'gp' || party,
  draw(ctx, sx, sy) {
    box(ctx, sx, sy + 1, 208, 15, '#7a5a10');
    box(ctx, sx + 1, sy + 2, 206, 13, GOLD);
    box(ctx, sx + 3, sy + 4, 202, 9, ORD);
    text(ctx, '★ お笑いグランプリ 決勝 ★', sx + 104, sy + 3, { size: 10, align: 'center', color: '#fff6a8', shadow: '#3a0f08' });
  },
};

const onAirLamp = {
  type: 'prop', x: 11, y: 1, w: 1, h: 1, solid: false, cond: () => show === 'tv',
  draw(ctx, sx, sy, g) { ctx.drawImage(tileImage('onair', Math.floor(g.frame / 40) % 2), sx, sy); },
};

// ------------------------------------------------------------------ place
const signs = (list) => list.map(([x, y, t]) => ({ type: 'sign', x, y, text: t }));

registerPlace({
  id: PID,
  name: 'よしもと 東京本部',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: 9, y: 11, dir: 'up' },
  rooms: {
    // -------------------------------------------------------------- lobby
    lobby: {
      floor: 'yoshimoto_floor',
      tiles: [
        '####################',
        '#UEEUWWULLLLUUQUTYU#',
        '#pee=vv=llll=pdpty=#',
        '#......P....P.....P#',
        '#......CCCCCC......#',
        '#........[].....GGG#',
        '#.bbbb...[]........#',
        '#........[].....RRR#',
        '#.bbbb...[]........#',
        '#........[]........#',
        '#V.......[]..F....F#',
        '#P.......[].......P#',
        '#########MM#########',
      ],
      legend: {
        '#': 'yoshimoto_walltop', U: 'yoshimoto_wall_u', '=': 'yoshimoto_wall',
        W: 'yoshimoto_wall_u+window', p: 'yoshimoto_wall+yoshimoto_poster', v: 'yoshimoto_wall+yoshimoto_tv',
        L: 'yoshimoto_feature_u', l: 'yoshimoto_feature',
        E: 'yoshimoto_elev_u', e: 'yoshimoto_elev', Q: 'yoshimoto_door_u', d: 'yoshimoto_door',
        T: 'yoshimoto_tdoor_ul', Y: 'yoshimoto_tdoor_ur', t: 'yoshimoto_tdoor_l', y: 'yoshimoto_tdoor_r',
        '[': 'yoshimoto_carpet_l', ']': 'yoshimoto_carpet_r',
        C: 'yoshimoto_counter', P: 'plant', b: 'yoshimoto_bench', G: 'yoshimoto_goods', R: 'register',
        F: 'flower_stand', V: 'vending',
      },
      warps: [
        { x: 9, y: 12, to: 'exit' }, { x: 10, y: 12, to: 'exit' },
        { x: 2, y: 2, room: 'office', tx: 1, ty: 3, dir: 'down', sfx: 'good' },
        { x: 3, y: 2, room: 'office', tx: 2, ty: 3, dir: 'down', sfx: 'good' },
        { x: 14, y: 2, room: 'keiko', tx: 8, ty: 10, dir: 'up' },
        { x: 16, y: 2, room: 'theater', tx: 9, ty: 12, dir: 'up' },
        { x: 17, y: 2, room: 'theater', tx: 9, ty: 12, dir: 'up' },
      ],
      entities: [
        { type: 'logo', x: 8.75, y: 0.5, w: 2.5, h: 2.25, logo: 'yoshimoto', board: true, lights: true },
        npc('yoshi_uketsuke', 9, 3, 'down', WHO.uketsuke, { talk: uketsukeTalk }),
        npc('yoshi_madoguchi', 10, 3, 'down', WHO.madoguchi, { talk: madoguchiTalk }),
        npc('yoshi_guard', 11, 11, 'left', WHO.guard, { talk: guardTalk }),
        npc('yoshi_shop', 17, 6, 'down', WHO.shop, { talk: shopTalk }),
        npc('yoshi_fan', 3, 6, 'up', WHO.fan, { talk: fanTalk }),
        npc('yoshi_wakate', 13, 8, 'down', WHO.wakate, { talk: wakateTalk, wander: 2 }),
        npc('yoshi_kaichou', 6, 9, 'right', WHO.kaichou, { talk: kaichouTalk, wander: 1 }),
        trophyCase(1, 4),
        ...signs([
          [1, 2, '若手ライブのポスターだ。\n「毎日開催！当日券あり　小劇場にて」'],
          [4, 2, 'エレベーター　▲2F 事務所フロア\n（マネージャー・新人オーディション）'],
          [13, 2, '「お笑いグランプリ 出場者募集中！」\n決勝の舞台は、ここ東京本部の劇場だ。'],
          [15, 2, 'コンビ「ぽんかんズ」のポスターだ。\nオレンジのスーツがまぶしい。'],
          [13, 10, 'お祝いのスタンド花。\n「祝 若手ライブ 満員御礼」の札がついている。'],
          [18, 10, 'お祝いのスタンド花。\n「祝 よしもと東京本部」の札がついている。'],
        ]),
      ],
      events: [
        { x: 5, y: 2, w: 2, on: 'action', run: async (g) => { g.sfx('laugh'); await g.say(pick(TV_SHOWS)); } },
      ],
      onEnter: async (g) => {
        if (!g.flag('yoshimoto_welcome')) await welcome(g);
      },
    },

    // -------------------------------------------------------------- office floor (2F)
    office: {
      floor: 'floor_carpet_beige',
      tiles: [
        '##################',
        '#EEUWWUULLUUWWUcU#',
        '#ee=bb==ll==ss===#',
        '#.............TYX#',
        '#...KKK..........#',
        '#...hhh.....DDD..#',
        '#................#',
        '#................#',
        '#..AAA...........#',
        '#.....Z...OO..BBP#',
        '#P...............#',
        '##################',
      ],
      legend: {
        '#': 'yoshimoto_walltop', U: 'yoshimoto_wall_u', '=': 'yoshimoto_wall',
        W: 'yoshimoto_wall_u+window', c: 'yoshimoto_wall_u+clock', b: 'yoshimoto_wall+whiteboard', s: 'yoshimoto_wall+shelf_wall',
        L: 'yoshimoto_feature_u', l: 'yoshimoto_feature',
        E: 'yoshimoto_elev_u', e: 'yoshimoto_elev',
        K: 'desk_pc', h: 'chair', D: 'yoshimoto_desk', A: 'yoshimoto_jtable', Z: 'yoshimoto_standsign',
        T: 'trophy', Y: 'yoshimoto_copier', X: 'water_server', O: 'sofa_beige', B: 'bookshelf', P: 'plant',
      },
      warps: [
        { x: 1, y: 2, room: 'lobby', tx: 2, ty: 3, dir: 'down', sfx: 'good' },
        { x: 2, y: 2, room: 'lobby', tx: 3, ty: 3, dir: 'down', sfx: 'good' },
      ],
      entities: [
        { type: 'logo', x: 8.25, y: 1.125, w: 1.5, h: 1.75, logo: 'yoshimoto', board: true, text: 'よしもとのロゴだ。\n笑顔のマークを見ると、こっちまで笑顔になる。' },
        npc('yoshi_manager', 13, 4, 'down', WHO.manager, { talk: managerTalk }),
        npc('yoshi_scout', 4, 7, 'down', WHO.scout, { talk: scoutTalk }),
        npc('yoshi_jimuin', 5, 5, 'up', WHO.jimuin, {
          talk: async (g) => {
            if (member(g)) await g.say(['{name}さん、おつかれさまです！', 'スケジュール管理はおまかせください。\n…今日も、いい感じに空いてますよ！いい意味で！'], WHO.jimuin);
            else await g.say(['事務所フロアへようこそ。', 'オーディションは、あちらの新人発掘担当へどうぞ。\nお仕事の相談は、奥のマネージャーへ。'], WHO.jimuin);
          },
        }),
        npc('yoshi_sakka', 14, 8, 'up', WHO.sakka, {
          wander: 1,
          text: ['ぼくは構成作家。番組やライブの台本を書いてる。', '大喜利のコツは、「みんなが思いつかない、\nでも分かる」答えだね。', '★250を超えると、劇場の大喜利ライブに\n呼ばれるようになるよ。', 'NHK、BSよしもと、大阪のなんば…。\nいろんな現場で経験を積むと、芸の幅が広がるよ。'],
        }),
        npc('yoshi_senpai', 10, 9, 'down', WHO.senpai, {
          text: ['お、新顔か。オレはこの道20年の先輩芸人や。', '売れるコツ？…体力管理やな。\n寝る、食う、笑う！これが基本や。', 'たまには大阪のなんばにも行ってみ。\n新喜劇の劇場で、ズッコケの勉強ができるで。'],
        }),
      ],
      events: [
        {
          x: 4, y: 2, w: 2, on: 'action',
          run: async (g) => {
            if (member(g)) await g.say('ホワイトボードに今週のスケジュールが書いてある。\n「{name}：若手ライブ／営業／稽古」…自分の名前もある！');
            else await g.say('ホワイトボードに、芸人さんたちのスケジュールがびっしり。\nいつかここに自分の名前を…！');
          },
        },
        { x: 12, y: 2, w: 2, on: 'action', run: async (g) => { await g.say('台本やライブのDVDがずらりと並んでいる。\n笑いの歴史がつまっている…。'); } },
        {
          x: 14, y: 3, on: 'action',
          run: async (g) => {
            await g.say('盾やトロフィーがずらり。\n先輩たちが勝ちとった賞の数々だ。');
            if (g.flag('yoshimoto_gp_champion')) await g.say('…その真ん中に、{name}のグランプリの写真も飾られている！');
          },
        },
        { x: 15, y: 3, on: 'action', run: async (g) => { await g.say('コピー機だ。台本が大量に印刷されている…。\nガガガガ…ピー！'); } },
      ],
      onEnter: async (g) => {
        if (member(g) && !g.flag('yoshimoto_mgr_intro')) {
          await g.wait(200);
          await managerIntro(g);
        }
      },
    },

    // -------------------------------------------------------------- rehearsal room
    keiko: {
      floor: 'floor_wood',
      tiles: [
        '##################',
        '#UUmmmmmmmmmmmmUc#',
        '#=pnnnnnnnnnnnnb=#',
        '#S..............S#',
        '#................#',
        '#................#',
        '#................#',
        '#.........TTT....#',
        '#.........hhh....#',
        '#................#',
        '#X..............P#',
        '########OO########',
      ],
      legend: {
        '#': 'yoshimoto_walltop', U: 'yoshimoto_wall_u', '=': 'yoshimoto_wall',
        c: 'yoshimoto_wall_u+clock', p: 'yoshimoto_wall+yoshimoto_poster', b: 'yoshimoto_wall+whiteboard',
        m: 'yoshimoto_mirror_u', n: 'yoshimoto_mirror',
        S: 'speaker', T: 'table_white', h: 'chair', X: 'water_server', P: 'plant', O: 'yoshimoto_mat',
      },
      warps: [
        { x: 8, y: 11, room: 'lobby', tx: 14, ty: 3, dir: 'down' },
        { x: 9, y: 11, room: 'lobby', tx: 14, ty: 3, dir: 'down' },
      ],
      entities: [
        npc('yoshi_ponta', 4, 4, 'down', WHO.ponta, { talk: (g) => watchManzai(g, false) }),
        npc('yoshi_kankichi', 5, 4, 'down', WHO.kankichi, { talk: (g) => watchManzai(g, false) }),
        sanpachi,
        npc('yoshi_surudoki', 14, 3, 'down', WHO.surudoki, { talk: surudokiTalk }),
        npc('yoshi_shabetani', 11, 6, 'down', WHO.shabetani, { talk: shabetaniTalk }),
        npc('yoshi_kenkyusei', 7, 9, 'up', WHO.kenkyusei, {
          wander: 2,
          text: ['ぼく、養成所を出たばっかりの研究生です！', '毎日ここで先生たちにしごかれてます…。\nでも、レッスンを受けるとスキルがぐんぐん伸びるんです！', '鏡の前で、表情の練習もしてます。ニカッ！'],
        }),
      ],
      events: [
        { x: 3, y: 2, w: 12, on: 'action', run: async (g) => { await g.say('大きな鏡だ。表情の練習にぴったり。\n…ニカッ！いい笑顔！'); } },
        { x: 15, y: 2, on: 'action', run: async (g) => { await g.say('ホワイトボードに今日の課題が書いてある。\n「ツッコミは 短く、強く、愛をこめて」'); } },
        { x: 2, y: 2, on: 'action', run: async (g) => { await g.say('貼り紙だ。\n「笑いは一日にして成らず。今日もネタ合わせ！」'); } },
      ],
      onEnter: async (g) => {
        if (!g.flag('yoshimoto_duo_seen')) {
          g.setFlag('yoshimoto_duo_seen');
          await g.wait(250);
          await g.emote('yoshi_ponta', '!');
          await g.say('お、見学の人？\nちょうど今から、ネタ合わせするとこやねん！', WHO.ponta);
          await watchManzai(g, true);
        }
      },
    },

    // -------------------------------------------------------------- small theater
    theater: {
      floor: 'yoshimoto_carpet_dark',
      bgm: 'yoshimoto_debayashi',
      tiles: [
        '###################',
        '#TTTTTTTTTTTTTTTTT#',
        '#cS,,,,,,,,,,,,,Sc#',
        '#c,,,,,,,Z,,,,,,kc#',
        '#c,,,,,,,,,,,,,,,c#',
        '#E^EEEEEEEEEEEEE^E#',
        '#.................#',
        '#.ssssss...ssssss.#',
        '#.................#',
        '#.ssssss...ssssss.#',
        '#.................#',
        '#.ssssss...ssssss.#',
        '#F...............F#',
        '########OOO########',
      ],
      legend: {
        '#': 'yoshimoto_walltop', T: 'curtain_top', c: 'curtain', ',': 'floor_stage',
        S: 'floor_stage+speaker', Z: 'floor_stage+mic', k: 'floor_stage+yoshimoto_mekuri',
        E: 'stage_edge', '^': 'stairs_up', s: 'seat', F: 'flower_stand', O: 'yoshimoto_mat',
      },
      warps: [
        { x: 8, y: 13, room: 'lobby', tx: 16, ty: 3, dir: 'down' },
        { x: 9, y: 13, room: 'lobby', tx: 16, ty: 3, dir: 'down' },
        { x: 10, y: 13, room: 'lobby', tx: 16, ty: 3, dir: 'down' },
      ],
      entities: [
        { type: 'logo', x: 8.25, y: 0.375, w: 2.5, h: 1.5, logo: 'yoshimoto', board: true, lights: true },
        gpBanner,
        onAirLamp,
        npc('yoshi_butai', 17, 6, 'left', WHO.butai, { talk: butaiTalk }),
        npc('yoshi_pin', 5, 3, 'down', WHO.pin, {
          wander: 1, cond: () => !show,
          text: ['ネタの最終チェック中や…ブツブツ…。', 'センターマイクの前に立つと、景色が変わるで。\nお客さんの顔が、ぜんぶ見えるんや。'],
        }),
        npc('yoshi_kyaku1', 4, 9, 'up', WHO.obaachan, { text: ['あたしゃ、この劇場の常連でね。\n若い子たちの漫才を見るのが生きがいなのよ。', 'あんたも舞台に立つのかい？\n楽しみにしとるよ。'] }),
        npc('yoshi_kyaku2', 13, 7, 'up', WHO.student, { text: ['修学旅行で来ました！\n生でお笑いを見るの、初めてなんです！', 'ねえねえ、もしかして芸人さん？\n帰ったらみんなに自慢しよっと！'] }),
        npc('yoshi_kyaku3', 15, 11, 'up', WHO.salaryman, { text: ['仕事帰りに、ふらっと寄るのが楽しみでね。', '思いっきり笑うと、明日もがんばろうって思えるんだよ。'] }),
        // extra audience while a show is on
        npc('yoshi_aud1', 3, 7, 'up', { name: 'お客さん', look: LOOKS.fan }, { cond: () => !!show || party, text: 'ワクワク…！' }),
        npc('yoshi_aud2', 6, 7, 'up', { name: 'お客さん', look: LOOKS.mom }, { cond: () => !!show || party, text: '楽しみねえ！' }),
        npc('yoshi_aud3', 12, 9, 'up', { name: 'お客さん', look: LOOKS.tourist }, { cond: () => !!show || party, text: 'Funny!' }),
        npc('yoshi_aud4', 16, 9, 'up', { name: 'お客さん', look: LOOKS.oldman }, { cond: () => !!show || party, text: 'ほっほっほ。' }),
        npc('yoshi_aud5', 5, 11, 'up', { name: 'お客さん', look: { ...LOOKS.fan, hairColor: 'brown', top: '#ff9a3c' } }, { cond: () => !!show || party, text: 'がんばって〜！' }),
        npc('yoshi_aud6', 12, 11, 'up', { name: 'お客さん', look: LOOKS.kid }, { cond: () => !!show || party, text: 'わくわく！' }),
        // TV recording crew
        npc('yoshi_cam1', 6, 6, 'up', { name: 'カメラマン', look: LOOKS.cameraman }, { cond: () => show === 'tv', text: '本番中です…！' }),
        npc('yoshi_cam2', 12, 6, 'up', { name: 'カメラマン', look: LOOKS.cameraman }, { cond: () => show === 'tv', text: '本番中です…！' }),
        shoulderCam(6, 6), shoulderCam(12, 6),
        npc('yoshi_ad', 9, 6, 'up', WHO.ad, { cond: () => show === 'tv', text: '巻きでお願いしまーす！' }),
        // grand prix
        npc('yoshi_mc', 4, 3, 'right', WHO.mc, { cond: () => show === 'gp', text: 'さあ、運命の決勝です！' }),
        npc('yoshi_p_manager', 2, 4, 'right', WHO.manager, { cond: () => party, text: 'おめでとうございます！' }),
        npc('yoshi_p_kankichi', 15, 4, 'left', WHO.kankichi, { cond: () => party, text: 'おめでとう！' }),
        npc('yoshi_p_ponta', 16, 4, 'left', WHO.ponta, { cond: () => party, text: 'おめでとう！' }),
        ...signs([
          [16, 3, 'めくりに、次の出番の名前が書いてある。\n「ぽんかんズ」…'],
          [1, 12, 'お祝いのスタンド花。\n「祝 満員御礼」の札がついている。'],
          [17, 12, 'お祝いのスタンド花。\n「祝 若手ライブ」の札がついている。'],
        ]),
      ],
      events: [
        {
          x: 9, y: 3, on: 'action',
          run: async (g) => {
            await g.say('センターマイクだ。\nこの前に立つと、客席が全部見わたせる…！');
            await g.say(member(g) ? '舞台監督に声をかければ、ここで漫才ができる！' : 'いつか、ここで漫才を…！\nまずは前説から始めてみよう。');
          },
        },
      ],
      drawOver: (ctx, g) => { if (party) drawConfetti(ctx, g.frame, 60); },
      onEnter: async (g) => {
        if (!show && !party && !g.flag('yoshimoto_theater_first')) await theaterFirst(g);
      },
    },
  },
});
