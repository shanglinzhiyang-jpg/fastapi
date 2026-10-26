// 恋愛・結婚・家庭 (R12-L1) — pixel art, part 2: meetings, the ward office, weddings and the family (see romance_art.js).
import { R, disc, oval, bands, dither, stars, skyOf, cloud, tree, lantern, steam, heart, SP, baby, AW, AH, window_ } from './romance_art.js';
import { text } from './draw.js';
import { shade, hash2 } from './util.js';
import { ART as ART1 } from './romance_art.js';

const tatami = (c, y) => { R(c, 0, y, AW, AH - y, '#cfc47e'); for (let x = 0; x < AW; x += 80) R(c, x, y, 1, AH - y, '#8a7a3a'); for (let yy = y + 4; yy < AH; yy += 14) R(c, 0, yy, AW, 1, '#c2b871'); R(c, 0, y, AW, 3, '#3d5a2a'); };

export const ART = {
  // ---------------------------------------------------------------- お見合い (a ryotei room; the 仲人 sits between)
  omiai(c, t, X) {
    R(c, 0, 0, AW, 62, '#e8dcc0'); tatami(c, 62);
    // the garden through the open shoji
    R(c, 20, 8, 110, 50, '#6b4226'); R(c, 24, 12, 102, 42, '#bfe6f6'); disc(c, 70, 40, 18, '#4a8a4a'); R(c, 68, 40, 4, 14, '#5a3a22'); disc(c, 90, 44, 8, '#2f7a3a'); R(c, 24, 46, 102, 8, '#8aa86a');
    for (let x = 24; x < 126; x += 17) R(c, x, 12, 1, 42, '#6b4226');
    // tokonoma: a scroll and a flower
    R(c, 210, 8, 90, 54, '#5a3a22'); R(c, 214, 12, 82, 50, '#d8c8a0'); R(c, 236, 14, 28, 36, '#f6f1e2'); R(c, 236, 14, 28, 2, '#8a1a2c'); for (let k = 0; k < 4; k++) R(c, 244 + (k % 2) * 4, 22 + k * 7, 8 - (k % 2) * 3, 1, '#2a2a2a');
    R(c, 276, 40, 10, 16, '#3a5a8a'); R(c, 280, 28, 2, 14, '#4a8a4a'); disc(c, 281, 26, 4, '#ff8ab0');
    // the low table and cushions
    R(c, 60, 82, 200, 4, '#7a4a22'); R(c, 60, 82, 200, 1, '#a8703a'); R(c, 70, 86, 4, 16, '#5a3418'); R(c, 246, 86, 4, 16, '#5a3418');
    const old = { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#8a3a5a', bottom: '#5a4a6a', skirt: true };
    SP.seat(c, X.extra && X.extra.nakodo || old, 144, 28, 'down', 38);
    SP.seat(c, X.you, 76, 42, 'right', 38); SP.seat(c, X.me, 212, 42, 'left', 38);
    for (const [cx, col] of [[100, '#ffffff'], [196, '#ffffff']]) { steam(c, cx + 4, 74, t + cx, 2); R(c, cx, 76, 10, 8, col); R(c, cx + 1, 76, 8, 2, '#8ab858'); }
    R(c, 140, 72, 40, 10, '#f6ecd2'); R(c, 144, 70, 8, 5, '#ff8ab0'); R(c, 156, 70, 8, 5, '#f4d03a'); R(c, 168, 70, 8, 5, '#a8d878');
  },
  // ---------------------------------------------------------------- 合コン (a long table)
  goukon(c, t, X) {
    R(c, 0, 0, AW, AH, '#3a2418'); for (let x = 0; x < AW; x += 12) R(c, x, 0, 1, 54, '#2c1a10'); R(c, 0, 0, AW, 6, '#1e120a');
    for (const lx of [60, 130, 200, 270]) { lantern(c, lx, 6, 1); c.globalAlpha = 0.12; disc(c, lx + 5, 20, 20, '#ff9a3a'); c.globalAlpha = 1; }
    const crowd = (X.extra && X.extra.crowd) || [];
    const names = (X.extra && X.extra.names) || [];
    const xs = [34, 90, 146, 202, 252];
    crowd.slice(0, 5).forEach((look, i) => {
      SP.seat(c, look, xs[i], 26, 'down', 32);
      if (names[i]) { R(c, xs[i] + 2, 19, 28, 10, 'rgba(10,6,4,0.72)'); text(c, names[i], xs[i] + 16, 20, { size: 9, color: '#ffe8a8', align: 'center', shadow: null }); }
    });
    R(c, 0, 58, AW, 4, '#7a4a22'); R(c, 0, 62, AW, 50, '#5a3418'); R(c, 0, 58, AW, 1, '#b07a42');
    for (let i = 0; i < 7; i++) { R(c, 14 + i * 44, 50, 9, 11, '#f4e6b0'); R(c, 14 + i * 44, 50, 9, 3, '#ffffff'); R(c, 23 + i * 44, 53, 3, 6, '#e8e8e0'); }
    for (const px of [60, 150, 240]) { R(c, px, 56, 24, 6, '#e8d8b0'); for (let k = 0; k < 3; k++) R(c, px + 2 + k * 7, 52, 1, 8, '#c8a060'); }
    steam(c, 150, 48, t, 2);
    SP.seat(c, X.me, 120, 66, 'up', 36); if (X.extra && X.extra.friend) SP.seat(c, X.extra.friend, 176, 66, 'up', 36);
  },
  // ---------------------------------------------------------------- パーティー会場
  party(c, t, X) {
    R(c, 0, 0, AW, 80, '#f4ecdc'); R(c, 0, 80, AW, 32, '#a8784a'); for (let x = 0; x < AW; x += 20) R(c, x, 80, 1, 32, '#8a5a32');
    R(c, 60, 8, 200, 20, '#8a1a2c'); R(c, 60, 8, 200, 2, '#c8903a'); text(c, (X.extra && X.extra.banner) || 'パーティー', 160, 12, { size: 12, color: '#fff2c0', align: 'center', shadow: null });
    for (const lx of [24, 296]) { R(c, lx, 0, 1, 8, '#3a3a44'); disc(c, lx, 14, 6, '#ffe8a8'); }
    const crowd = (X.extra && X.extra.crowd) || [];
    const spots = [[24, 40], [86, 36], [208, 36], [262, 40], [48, 70], [236, 70]];
    crowd.slice(0, 6).forEach((look, i) => SP.stand(c, look, spots[i][0], spots[i][1], 'down'));
    for (const tx of [60, 210]) { oval(c, tx + 14, 96, 28, 6, '#e8e0d0'); R(c, tx + 12, 96, 4, 14, '#8a8a8a'); R(c, tx + 8, 90, 4, 3, '#ffffff'); R(c, tx + 20, 90, 4, 3, '#ffffff'); }
    SP.stand(c, X.me, 144, 54, 'down');
    R(c, 154, 74, 12, 6, '#ffffff'); // the name tag
  },
  // ---------------------------------------------------------------- 区役所の窓口 (婚姻届)
  yakusho(c, t, X) {
    R(c, 0, 0, AW, 70, '#e8ecef'); R(c, 0, 70, AW, 42, '#b8bcc4'); for (let x = 0; x < AW; x += 24) R(c, x, 70, 1, 42, '#a0a4ac');
    R(c, 0, 62, AW, 8, '#dfe3e8');
    // clock and signs
    disc(c, 160, 16, 11, '#ffffff'); disc(c, 160, 16, 9, '#f6f6ee'); R(c, 160, 9, 1, 8, '#2a2a2a'); R(c, 160, 16, 6, 1, '#2a2a2a');
    R(c, 40, 8, 80, 18, '#2f6a5a'); text(c, '戸籍・住民票', 80, 12, { size: 10, color: '#ffffff', align: 'center', shadow: null }); R(c, 200, 8, 80, 18, '#2f6a5a'); text(c, '届出の窓口', 240, 12, { size: 10, color: '#ffffff', align: 'center', shadow: null });
    // the clerk behind the counter
    SP.seat(c, X.extra && X.extra.clerk || { hair: 'bob', hairColor: 'black', skin: 'light', top: '#3f5fa8', bottom: '#2a3560', skirt: true, jacket: true }, 142, 20, 'down', 34);
    R(c, 90, 60, 140, 6, '#c8a878'); R(c, 90, 66, 140, 46, '#8a6a46'); R(c, 90, 60, 140, 1, '#e8d0a0');
    R(c, 124, 52, 40, 8, '#f6f6ee'); R(c, 124, 52, 40, 1, '#ffffff'); for (let k = 0; k < 3; k++) R(c, 128, 54 + k * 2, 30 - k * 5, 1, '#8a8a9a'); R(c, 150, 50, 8, 3, '#d6304a');
    R(c, 176, 58, 12, 4, '#8a1a2c'); R(c, 178, 54, 8, 4, '#3a2a1a');
    SP.seat(c, X.you, 94, 50, 'up', 40); SP.seat(c, X.me, 198, 50, 'up', 40);
    // paper pinned to the wall
    R(c, 20, 40, 18, 22, '#f6f6ee'); R(c, 22, 44, 14, 1, '#8a8a9a'); R(c, 22, 48, 14, 1, '#8a8a9a'); R(c, 290, 38, 18, 24, '#fff4c8'); R(c, 292, 42, 14, 1, '#c8a850');
  },
  // ---------------------------------------------------------------- 神前式
  shinzen(c, t, X) {
    R(c, 0, 0, AW, AH, '#8a6a42'); for (let x = 0; x < AW; x += 14) R(c, x, 74, 1, 38, '#6a4a2a'); R(c, 0, 74, AW, 38, '#a8844e'); for (let y = 80; y < AH; y += 8) R(c, 0, y, AW, 1, '#8a6a3a');
    R(c, 0, 0, AW, 74, '#e8dcc0'); for (let x = 0; x < AW; x += 40) R(c, x, 0, 3, 74, '#5a3a22'); R(c, 0, 0, AW, 5, '#5a3a22');
    // the altar: white curtain, a straw rope (shimenawa), a mirror
    R(c, 90, 6, 140, 48, '#f6f1e2'); for (let x = 92; x < 230; x += 10) R(c, x, 6, 1, 48, '#d8d0b8');
    R(c, 90, 14, 140, 4, '#b8a070'); for (let k = 0; k < 14; k++) R(c, 94 + k * 10, 18, 2, 5, '#f6f6ee');
    disc(c, 160, 36, 9, '#c8a830'); disc(c, 160, 36, 7, '#e8e4d8'); disc(c, 158, 34, 2, '#ffffff');
    R(c, 110, 50, 100, 10, '#5a3a22'); R(c, 110, 50, 100, 2, '#8a6a42'); for (const x of [120, 192]) { R(c, x, 40, 6, 10, '#e8e0d0'); R(c, x + 2, 34, 2, 6, '#4a8a4a'); }
    // the priest and a shrine maiden, the couple
    SP.seat(c, { hair: 'mage', hairColor: 'black', skin: 'tan', top: '#f2f2f2', bottom: '#6a8ab8', hat: undefined }, 144, 28, 'down', 40);
    SP.stand(c, { hair: 'long', hairColor: 'black', skin: 'light', top: '#f2f2f2', bottom: '#c0303a', skirt: true }, 228, 46, 'down');
    const bride = X.extra && X.extra.brideLook || { hair: 'bob', hairColor: 'black', skin: 'light', top: '#ffffff', bottom: '#ffffff', skirt: true, lashes: true };
    const groom = X.extra && X.extra.groomLook || { hair: 'short', hairColor: 'black', skin: 'fair', top: '#1e1e26', bottom: '#8a8a96', skirt: true };
    SP.stand(c, X.extra && X.extra.leftLook || groom, 114, 50, 'down'); SP.stand(c, X.extra && X.extra.rightLook || bride, 166, 50, 'down');
    // paper tags (hanging 紙垂) swaying
    for (const x of [88, 228]) { const sw = Math.round(Math.sin(t / 30) * 1); R(c, x + sw, 54, 4, 8, '#ffffff'); R(c, x + sw, 62, 4, 6, '#ffffff'); }
  },
  // ---------------------------------------------------------------- チャペル
  chapel(c, t, X) {
    R(c, 0, 0, AW, AH, '#f0ece4');
    // the great window and its light
    R(c, 110, 4, 100, 56, '#dcd6cc'); R(c, 114, 8, 92, 50, '#bfe0f6');
    const pane = ['#ffb8d0', '#ffe28a', '#9ad8ff', '#b8f0b0'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) R(c, 118 + i * 22, 12 + j * 15, 18, 12, pane[(i + j) % 4]);
    c.globalAlpha = 0.16; for (let i = 0; i < 4; i++) { c.fillStyle = pane[i]; for (let y = 60; y < 108; y += 2) { const w = 10 + (y - 60) * 0.5; c.fillRect(120 + i * 22 - (y - 60) * 0.2, y, w, 2); } } c.globalAlpha = 1;
    // pews and the aisle
    R(c, 0, 62, AW, 50, '#d8cfc0'); R(c, 120, 60, 80, 52, '#a8222c'); for (let y = 62; y < 112; y += 6) R(c, 124 - (y - 62) * 0.4, y, 72 + (y - 62) * 0.8, 1, '#c0343e');
    for (const side of [0, 1]) for (let i = 0; i < 4; i++) { const y = 66 + i * 11; const x = side ? 206 + i * 4 : 114 - i * 4 - 76 + 76; R(c, side ? 204 + i * 3 : 8 + i * -3, y, 100, 6, '#7a4a22'); R(c, side ? 204 + i * 3 : 8 - i * 3, y - 4, 100, 4, '#9a6232'); void x; }
    // flowers along the aisle
    for (const x of [100, 214]) for (let k = 0; k < 4; k++) { R(c, x, 62 + k * 12, 2, 8, '#4a8a4a'); disc(c, x + 1, 62 + k * 12, 3, ['#ffffff', '#ffb8d0'][k % 2]); }
    // the altar
    R(c, 128, 44, 64, 6, '#8a6a42'); R(c, 132, 38, 20, 6, '#ff8ab0'); R(c, 152, 38, 20, 6, '#ffffff'); R(c, 172, 38, 16, 6, '#ffd8a8');
    SP.seat(c, X.extra && X.extra.officiant || { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#f2f2f2' }, 144, 8, 'down', 40);
    const bride = X.extra && X.extra.brideLook || { hair: 'long', hairColor: 'black', skin: 'light', top: '#ffffff', bottom: '#ffffff', skirt: true, lashes: true };
    const groom = X.extra && X.extra.groomLook || { hair: 'short', hairColor: 'black', skin: 'fair', top: '#2a2a32', bottom: '#2a2a32', jacket: true, tie: '#f2f2f2' };
    SP.stand(c, X.extra && X.extra.leftLook || groom, 122, 58, 'up'); SP.stand(c, X.extra && X.extra.rightLook || bride, 166, 58, 'up');
    for (let i = 0; i < 24; i++) { const x = (hash2(i, 1, 61) * AW + Math.sin(t / 20 + i) * 3) % AW, y = (hash2(i, 2, 61) * 130 + t * 0.4) % 112; R(c, x, y, 2, 2, ['#ffffff', '#ffd0e0', '#ffe8a0'][i % 3]); }
  },
  // ---------------------------------------------------------------- 披露宴
  hiroen(c, t, X) {
    const showa = X.extra && X.extra.era === 'showa';
    R(c, 0, 0, AW, 78, '#2a1a22'); R(c, 0, 78, AW, 34, '#6a2a3a'); for (let x = 0; x < AW; x += 20) R(c, x, 78, 1, 34, '#5a2030');
    if (showa) { // the gold folding screen
      R(c, 80, 6, 160, 56, '#8a6a1a'); for (let i = 0; i < 4; i++) { R(c, 82 + i * 39.5, 8, 37, 52, '#e8c048'); R(c, 82 + i * 39.5, 8, 37, 2, '#fff0a0'); disc(c, 100 + i * 39.5, 34, 7, i % 2 ? '#d6304a' : '#4a8a4a'); }
    } else { R(c, 90, 6, 140, 56, '#f2ece8'); for (let i = 0; i < 12; i++) disc(c, 100 + i * 11, 10 + (i % 3) * 3, 4, ['#ffb8d0', '#ffffff', '#ffd8a8'][i % 3]); }
    // chandelier & lights
    for (const lx of [50, 160, 270]) { R(c, lx, 0, 1, 8, '#3a3a44'); for (let k = -2; k <= 2; k++) R(c, lx + k * 5, 10 + Math.abs(k), 2, 3, '#fff6c8'); c.globalAlpha = 0.14; disc(c, lx, 14, 18, '#fff0b0'); c.globalAlpha = 1; }
    // the high table & the cake
    R(c, 90, 60, 140, 8, '#f6f1e8'); R(c, 90, 68, 140, 14, '#e8e0d8'); R(c, 90, 60, 140, 1, '#ffffff');
    for (let i = 0; i < 6; i++) { disc(c, 98 + i * 24, 58, 3, ['#ff8ab0', '#ffffff', '#ffd23f'][i % 3]); }
    const L = X.extra && X.extra.leftLook || { hair: 'short', hairColor: 'black', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#f2f2f2' };
    const Rr = X.extra && X.extra.rightLook || { hair: 'long', hairColor: 'black', skin: 'light', top: '#d84a6a', bottom: '#d84a6a', skirt: true, lashes: true };
    SP.seat(c, L, 120, 26, 'down', 36); SP.seat(c, Rr, 168, 26, 'down', 36);
    // the guests: round tables
    for (const [tx, ty] of [[24, 84], [100, 90], [220, 90], [296, 84]]) { oval(c, tx + 8, ty, 26, 7, '#f6f1e8'); R(c, tx + 5, ty, 6, 18, '#8a8a8a'); for (let k = 0; k < 4; k++) { const gx = tx - 12 + k * 14; disc(c, gx + 6, ty - 8, 4, '#2a2230'); R(c, gx + 2, ty - 5, 8, 6, ['#3a4a7a', '#7a3a4a', '#3a6a5a', '#6a5a3a'][(k + tx) % 4]); } }
    // the cake in front
    R(c, 142, 76, 36, 6, '#fff0f4'); R(c, 148, 68, 24, 8, '#ffffff'); R(c, 154, 60, 12, 8, '#fff0f4'); R(c, 159, 56, 2, 4, '#ff5d8f'); R(c, 148, 74, 24, 1, '#ffc0d0'); R(c, 154, 66, 12, 1, '#ffc0d0');
    SP.stand(c, L, 104, 66, 'up', 0.7); SP.stand(c, Rr, 186, 66, 'up', 0.7);
    // confetti / spotlight
    c.globalAlpha = 0.1; for (let y = 6; y < 100; y += 2) { const w = 20 + y * 0.6; c.fillStyle = '#fff6d8'; c.fillRect(160 - w, y, w * 2, 2); } c.globalAlpha = 1;
    for (let i = 0; i < 30; i++) { const x = hash2(i, 1, 71) * AW, y = (hash2(i, 2, 71) * 130 + t * 0.7) % 112; R(c, x, y, 2, 2, ['#ff5d8f', '#ffd23f', '#5fd7ff', '#ffffff'][i % 4]); }
  },
  // ---------------------------------------------------------------- 新婚旅行 (a beach at sunset; or an onsen street by era)
  tabi(c, t, X) {
    skyOf(c, 'dusk', 62);
    disc(c, 220, 56, 16, '#ffe28a'); c.globalAlpha = 0.25; disc(c, 220, 56, 28, '#ffc070'); c.globalAlpha = 1;
    R(c, 0, 62, AW, 22, '#2a6aa8'); for (let i = 0; i < 18; i++) R(c, ((i * 37 + t * 0.4) % 340) - 10, 64 + (i % 5) * 4, 14, 1, '#ffd8a0');
    R(c, 0, 84, AW, 28, '#e8d4a0'); for (let i = 0; i < 50; i++) R(c, Math.floor(hash2(i, 1, 81) * AW), 86 + Math.floor(hash2(i, 2, 81) * 24), 2, 1, '#d0bc88');
    // palm tree
    R(c, 40, 30, 5, 60, '#6a4a2a'); for (const [dx, dy] of [[-18, 2], [-12, -6], [4, -10], [18, -4], [24, 6]]) { R(c, 42 + Math.min(0, dx), 28 + Math.min(0, dy), Math.abs(dx) + 4, 3, '#2f7a3a'); R(c, 42 + dx / 2, 28 + dy / 2, 14, 3, '#3f9a4a'); }
    disc(c, 42, 30, 3, '#4a3a1a');
    SP.seat(c, X.you, 120, 70, 'up', 30); SP.seat(c, X.me, 150, 70, 'up', 30);
    R(c, 100, 94, 90, 3, 'rgba(0,0,0,0.12)');
    for (let i = 0; i < 4; i++) { const px = (t * 0.5 + i * 90) % 340; R(c, px, 18 + (i % 2) * 10, 6, 1, '#f6f6f6'); R(c, px + 2, 17 + (i % 2) * 10, 2, 1, '#f6f6f6'); }
  },
  // ---------------------------------------------------------------- 産院
  sanin(c, t, X) {
    R(c, 0, 0, AW, AH, '#f4f0ea'); R(c, 0, 80, AW, 32, '#d8d0c4'); R(c, 0, 78, AW, 3, '#b8b0a4');
    window_(c, 200, 8, 90, 56, '#d8d0c4', '#cfe8f8'); cloud(c, 214, 18); R(c, 196, 62, 98, 4, '#d8d0c4');
    // the bed
    R(c, 30, 66, 140, 36, '#ffffff'); R(c, 30, 66, 140, 3, '#e8e4dc'); R(c, 30, 90, 140, 12, '#e8eef6'); R(c, 26, 62, 6, 44, '#c8c0b4'); R(c, 168, 70, 4, 36, '#c8c0b4');
    R(c, 36, 58, 36, 12, '#f2f6fa'); R(c, 36, 58, 36, 2, '#ffffff');
    const mom = X.extra && X.extra.mother === 'me' ? X.me : X.you;
    const dad = X.extra && X.extra.mother === 'me' ? X.you : X.me;
    SP.seat(c, mom, 66, 36, 'down', 30); baby(c, 98, 58, '#fff0f4');
    SP.seat(c, dad, 190 - 6, 40, 'left', 40);
    // flowers and a small table
    R(c, 270, 70, 24, 3, '#a87449'); R(c, 272, 73, 3, 24, '#6e4428'); R(c, 290, 73, 3, 24, '#6e4428'); R(c, 276, 58, 12, 12, '#cfe6f2'); for (const [dx, dy, col] of [[0, 0, '#ff8ab0'], [5, -3, '#ffffff'], [9, 1, '#ffd23f']]) disc(c, 278 + dx, 55 + dy, 4, col);
    for (let i = 0; i < 5; i++) { const px = 40 + i * 50 + Math.sin(t / 40 + i) * 3, py = (t * 0.2 + i * 31) % 70; c.globalAlpha = 0.5; R(c, px, py, 2, 2, '#ffd0e0'); c.globalAlpha = 1; }
  },
  // ---------------------------------------------------------------- 夜のおうち (the baby's night)
  yoru(c, t, X) {
    R(c, 0, 0, AW, 80, '#1a2040'); R(c, 0, 80, AW, 32, '#4a3a30'); R(c, 0, 80, AW, 2, '#3a2a22');
    window_(c, 30, 12, 70, 50, '#3a3a50', '#0a0e2a'); stars(c, t, 5, 50); disc(c, 70, 30, 8, '#fff6c8'); disc(c, 73, 28, 7, '#0a0e2a');
    R(c, 26, 62, 78, 4, '#3a3a50');
    // the crib with a mobile
    R(c, 160, 62, 60, 36, '#e8d8b0'); for (let x = 164; x < 218; x += 8) R(c, x, 56, 2, 42, '#c8b080'); R(c, 160, 56, 60, 3, '#c8b080'); R(c, 160, 98, 60, 3, '#a89060');
    baby(c, 176, 76, '#cfe6f8'); R(c, 188, 18, 1, 20, '#8a8a9a'); for (let k = 0; k < 3; k++) { const sw = Math.round(Math.sin(t / 25 + k) * 3); disc(c, 176 + k * 12 + sw, 40 + (k % 2) * 3, 3, ['#ffd23f', '#ff8ab0', '#8ad8ff'][k]); }
    // a night light
    disc(c, 280, 70, 8, '#ffb060'); c.globalAlpha = 0.18; disc(c, 280, 70, 36, '#ffb060'); c.globalAlpha = 1; R(c, 276, 76, 8, 8, '#8a6a3a');
    SP.stand(c, X.me, 118, 54, 'right'); SP.stand(c, X.you, 232, 54, 'left');
    for (let i = 0; i < 3; i++) { const p = (t * 0.4 + i * 14) % 40; c.globalAlpha = Math.max(0, 1 - p / 40); text(c, 'zzz'.slice(0, 1 + (i % 3)), 196 + i * 4, 68 - p * 0.6, { size: 9, color: '#bfd8ff', shadow: null }); c.globalAlpha = 1; }
  },
  // ---------------------------------------------------------------- 保育園・幼稚園の門
  hoikuen(c, t, X) {
    skyOf(c, 'day', 56); cloud(c, ((t * 0.06) % 360) - 40, 8);
    R(c, 0, 56, AW, 56, '#8ad060'); R(c, 0, 92, AW, 20, '#e2cf9a');
    // the building
    R(c, 150, 18, 150, 54, '#fff4d8'); R(c, 150, 18, 150, 6, '#e8584a'); R(c, 150, 24, 150, 2, '#c0392b');
    for (let i = 0; i < 4; i++) { R(c, 160 + i * 34, 34, 24, 20, '#6b4226'); R(c, 162 + i * 34, 36, 20, 16, ['#ffd0e0', '#d0f0ff', '#fff0b0', '#d8f8d0'][i]); }
    R(c, 214, 54, 24, 18, '#8a5a32'); R(c, 216, 56, 20, 16, '#f2c06a');
    // the gate with colorful animals
    R(c, 20, 40, 8, 54, '#f2c06a'); R(c, 112, 40, 8, 54, '#f2c06a'); R(c, 20, 36, 100, 8, '#ffa84a'); for (let i = 0; i < 5; i++) disc(c, 32 + i * 20, 40, 5, ['#ff8ab0', '#8ad8ff', '#fff06a', '#a8e078', '#ffb8d0'][i]);
    text(c, '☆ひまわり☆', 70, 46, { size: 9, color: '#ffffff', align: 'center', shadow: '#c0602a' });
    // a fence with flowers
    for (let x = 0; x < AW; x += 10) { R(c, x, 78, 2, 16, '#ffffff'); } R(c, 0, 82, AW, 2, '#ffffff');
    for (let i = 0; i < 14; i++) disc(c, 6 + i * 24, 96, 3, ['#ff8ab0', '#ffd23f', '#ffffff'][i % 3]);
    const teacher = X.extra && X.extra.teacher || { hair: 'bob', hairColor: 'brown', skin: 'fair', top: '#7ac85a', bottom: '#3a4a7a' };
    SP.stand(c, teacher, 124, 58, 'down'); R(c, 131, 84, 18, 6, '#ffd0e0'); // an apron
    SP.stand(c, X.me, 68, 62, 'right');
    if (X.kids && X.kids[0]) SP.kid(c, X.kids[0].look, 100, 76, 'right');
  },
};

// the painters of the first file that can also carry children (the scene draws them after the painter)
export const KID_SPOTS = {
  home: [[150, 86], [196, 86]], jinja: [[104, 92], [200, 92]], hanami: [[150, 76]], illumi: [[96, 82], [186, 82]], kanransha: [[160, 78]], sanpo: [[130, 80]],
};
export const ALL = { ...ART1, ...ART };
export { ART as ART2 };
