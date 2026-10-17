// Reusable multi-tile props for maps. Each returns an entity definition.
//   { type: 'prop', x, y, w, h, draw(ctx, sx, sy, g, e) }

const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

export function fountain(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 3, h: 2,
    text: '噴水だ。水しぶきがキラキラしている。',
    draw(ctx, sx, sy, g) {
      R(ctx, sx + 2, sy + 6, 44, 24, '#8e929c');
      R(ctx, sx + 4, sy + 8, 40, 20, '#3d7fd1');
      R(ctx, sx + 2, sy + 6, 44, 2, '#c9ccd4');
      for (let i = 0; i < 6; i++) {
        const k = (g.frame / 6 + i * 3) % 18;
        R(ctx, sx + 8 + i * 6, sy + 12 + (k % 6), 2, 1, '#bfe6ff');
      }
      R(ctx, sx + 21, sy - 2, 6, 14, '#c9ccd4');
      const h = 4 + Math.round(Math.sin(g.frame / 8) * 2);
      R(ctx, sx + 23, sy - 4 - h, 2, h + 2, '#bfe6ff');
      R(ctx, sx + 19, sy - 4 - h, 2, 2, '#bfe6ff');
      R(ctx, sx + 27, sy - 4 - h, 2, 2, '#bfe6ff');
    },
    ...extra,
  };
}

export function train(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 10, h: 2,
    text: '新幹線がホームに停まっている。駅から乗れるぞ。',
    draw(ctx, sx, sy) {
      const W = 160;
      R(ctx, sx + 2, sy + 4, W - 4, 22, '#f4f6fa');
      R(ctx, sx + 2, sy + 18, W - 4, 3, '#2f5fd0');
      R(ctx, sx + 2, sy + 22, W - 4, 4, '#c3c8d2');
      // nose
      for (let i = 0; i < 10; i++) R(ctx, sx + W - 2 + i, sy + 8 + i, 1, 18 - i, '#f4f6fa');
      R(ctx, sx + W + 2, sy + 9, 5, 4, '#20232a');
      for (let wx = sx + 8; wx < sx + W - 10; wx += 10) R(ctx, wx, sy + 9, 7, 5, '#3b4a6a');
      for (let d = sx + 30; d < sx + W - 10; d += 50) R(ctx, d, sy + 8, 6, 12, '#d5d9e0');
      R(ctx, sx + 2, sy + 26, W - 4, 2, '#20232a');
    },
    ...extra,
  };
}

// Two-car commuter train (silver body, orange stripe, flat front) for local stations.
export function commuterTrain(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 10, h: 2,
    text: '電車がホームに停まっている。駅から乗れるぞ。',
    draw(ctx, sx, sy) {
      for (const [x0, len] of [[2, 77], [82, 76]]) {
        const x1 = sx + x0;
        R(ctx, x1, sy + 3, len, 23, '#9aa0aa');
        R(ctx, x1 + 1, sy + 4, len - 2, 21, '#e8eaee');
        R(ctx, x1 + 1, sy + 4, len - 2, 1, '#ffffff');
        R(ctx, x1 + 1, sy + 16, len - 2, 3, '#ff8a3d');
        R(ctx, x1 + 1, sy + 19, len - 2, 1, '#d62f2f');
        R(ctx, x1 + 1, sy + 22, len - 2, 3, '#c3c8d2');
        for (let d = 8; d < len - 8; d += 22) {
          R(ctx, x1 + d, sy + 6, 8, 18, '#b8bcc6');
          R(ctx, x1 + d + 1, sy + 8, 2, 6, '#3b4a6a'); R(ctx, x1 + d + 5, sy + 8, 2, 6, '#3b4a6a');
          R(ctx, x1 + d + 4, sy + 6, 1, 18, '#8e929c');
          if (d + 20 < len - 6) R(ctx, x1 + d + 11, sy + 8, 8, 6, '#3b4a6a');
        }
        R(ctx, x1 + 1, sy + 26, len - 2, 2, '#20232a');
        R(ctx, x1 + 8, sy + 26, 8, 2, '#4a4e58'); R(ctx, x1 + len - 16, sy + 26, 8, 2, '#4a4e58');
      }
      // gangway between the cars
      R(ctx, sx + 79, sy + 7, 3, 16, '#4a4e58');
      // flat front with headlights and a destination sign
      R(ctx, sx + 156, sy + 3, 3, 23, '#9aa0aa');
      R(ctx, sx + 150, sy + 6, 6, 3, '#20232a'); R(ctx, sx + 151, sy + 7, 4, 1, '#ffb03a');
      R(ctx, sx + 154, sy + 20, 2, 2, '#fff6a8');
    },
    ...extra,
  };
}

export function taxi(x, y, color = '#ffd23f', extra = {}) {
  return {
    type: 'prop', x, y, w: 2, h: 1,
    text: 'タクシーが客待ちをしている。',
    draw(ctx, sx, sy) {
      R(ctx, sx + 2, sy + 13, 28, 3, 'rgba(0,0,0,0.25)');
      R(ctx, sx + 2, sy + 4, 28, 9, color);
      R(ctx, sx + 8, sy + 1, 14, 5, color);
      R(ctx, sx + 9, sy + 2, 5, 3, '#8fd0ff'); R(ctx, sx + 16, sy + 2, 5, 3, '#8fd0ff');
      R(ctx, sx + 13, sy - 1, 4, 2, '#ffffff');
      R(ctx, sx + 2, sy + 8, 28, 1, '#20232a');
      R(ctx, sx + 5, sy + 12, 5, 3, '#20232a'); R(ctx, sx + 22, sy + 12, 5, 3, '#20232a');
      R(ctx, sx + 28, sy + 5, 2, 2, '#fff6a8');
    },
    ...extra,
  };
}

export function busStop(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1,
    text: 'バス停だ。時刻表を見ると…次のバスはしばらく来ないみたい。',
    draw(ctx, sx, sy) {
      R(ctx, sx + 7, sy + 2, 2, 13, '#9aa0aa');
      R(ctx, sx + 3, sy - 6, 10, 10, '#2f6fd0');
      R(ctx, sx + 4, sy - 5, 8, 8, '#ffffff');
      R(ctx, sx + 6, sy - 3, 4, 4, '#2f6fd0');
      R(ctx, sx + 5, sy + 14, 6, 2, '#5a5f6b');
    },
    ...extra,
  };
}

// Small outdoor stage (w tiles wide, 2 tall) used for street performances.
export function streetStage(x, y, w = 4, extra = {}) {
  return {
    type: 'prop', x, y, w, h: 2, solid: false,
    draw(ctx, sx, sy, g) {
      R(ctx, sx, sy + 4, w * 16, 26, '#5a3a20');
      R(ctx, sx, sy + 4, w * 16, 20, '#ddb06e');
      for (let i = 0; i < w * 4; i++) R(ctx, sx + i * 4, sy + 4, 1, 20, '#c49a5c');
      R(ctx, sx, sy + 24, w * 16, 2, '#3a2512');
      for (let i = 4; i < w * 16; i += 8) R(ctx, sx + i, sy + 27, 2, 2, Math.floor(g.frame / 20 + i) % 2 ? '#fff6a8' : '#ff9a3c');
    },
    ...extra,
  };
}

// Bronze statue of a smiling figure with both arms raised, on a stone pedestal.
const STATUE = [
  '.bb...hhhh...bb.',
  '.bb..hhbbbb..bb.',
  '..bb.hdbbdb.bb..',
  '..bb.bbbbbb.bb..',
  '..bb.bdbbdb.bb..',
  '...bb.bddb.bb...',
  '...bb..bb..bb...',
  '...bhbbbbbbbb...',
  '....hbbbbbbb....',
  '.....hbbbbb.....',
  '.....hbbbbb.....',
  '.....hbbbbb.....',
  '.....hbbbbb.....',
  '.....hbbbbb.....',
  '.....hb..bb.....',
  '.....hb..bb.....',
  '.....hb..bb.....',
  '.....hb..bb.....',
  '....bbb..bbb....',
];
export function statue(x, y, extra = {}) {
  const COL = { b: '#a8783a', h: '#d2a65a', d: '#5a3c18' };
  return {
    type: 'prop', x, y, w: 1, h: 1,
    draw(ctx, sx, sy) {
      // pedestal
      R(ctx, sx + 1, sy + 15, 14, 1, 'rgba(0,0,0,0.25)');
      R(ctx, sx + 1, sy + 8, 14, 7, '#8e929c');
      R(ctx, sx + 1, sy + 8, 14, 1, '#c9ccd4');
      R(ctx, sx + 4, sy + 11, 8, 2, '#c9ccd4');
      // figure: dark outline first, then the bronze body
      const top = sy + 8 - STATUE.length;
      for (const pass of [0, 1]) {
        STATUE.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '.') continue;
            if (pass === 0) { R(ctx, sx + i - 1, top + j, 3, 1, '#5a3c18'); R(ctx, sx + i, top + j - 1, 1, 3, '#5a3c18'); }
            else R(ctx, sx + i, top + j, 1, 1, COL[ch]);
          }
        });
      }
    },
    ...extra,
  };
}
