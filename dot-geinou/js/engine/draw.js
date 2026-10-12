// Drawing helpers that every scene / minigame can use.
// All coordinates are logical pixels on the 320x240 screen.

export const FONT_FAMILY = '"DotGothic16", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", monospace';

export const COLORS = {
  panel: '#121a3a',
  panelEdge: '#ffffff',
  panelShadow: '#060914',
  text: '#ffffff',
  dim: '#9aa3c7',
  accent: '#ffd23f',
  good: '#5ee07a',
  bad: '#ff5d6c',
  pink: '#ff7eb6',
  cyan: '#5fd7ff',
};

export function setFont(ctx, size = 12) {
  ctx.font = `${size}px ${FONT_FAMILY}`;
}

// text: string. opt: { size, color, align: left|center|right, shadow: color|null, outline: color|null }
// y is the TOP of the text line.
export function text(ctx, str, x, y, opt = {}) {
  const size = opt.size || 12;
  setFont(ctx, size);
  ctx.textAlign = opt.align || 'left';
  ctx.textBaseline = 'top';
  const s = String(str);
  if (opt.outline) {
    ctx.fillStyle = opt.outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.fillText(s, x + dx, y + dy);
    }
  } else if (opt.shadow !== null) {
    ctx.fillStyle = opt.shadow || 'rgba(0,0,0,0.6)';
    ctx.fillText(s, x + 1, y + 1);
  }
  ctx.fillStyle = opt.color || COLORS.text;
  ctx.fillText(s, x, y);
}

export function measure(ctx, str, size = 12) {
  setFont(ctx, size);
  return ctx.measureText(String(str)).width;
}

// Characters that must not start a line (Japanese kinsoku shori, simplified).
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}'.split(''));

// Wrap text into lines no wider than maxW. Respects explicit "\n".
export function wrap(ctx, str, maxW, size = 12) {
  setFont(ctx, size);
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const ch of Array.from(para)) {
      const next = line + ch;
      if (line && ctx.measureText(next).width > maxW) {
        if (NO_START.has(ch)) {
          // keep punctuation on the current line (hanging)
          out.push(next);
          line = '';
          continue;
        }
        // try to break at the last space for latin text
        const sp = line.lastIndexOf(' ');
        if (sp > 0 && /[A-Za-z0-9]$/.test(line) && /[A-Za-z0-9]/.test(ch)) {
          out.push(line.slice(0, sp));
          line = line.slice(sp + 1) + ch;
        } else {
          out.push(line);
          line = ch;
        }
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

// Classic RPG window: dark panel with a double white border.
export function panel(ctx, x, y, w, h, opt = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const bg = opt.bg || COLORS.panel;
  const edge = opt.edge || COLORS.panelEdge;
  ctx.fillStyle = COLORS.panelShadow;
  ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = edge;
  ctx.fillRect(x + 2, y + 2, w - 4, 1);
  ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
  ctx.fillRect(x + 2, y + 2, 1, h - 4);
  ctx.fillRect(x + w - 3, y + 2, 1, h - 4);
  ctx.fillStyle = bg;
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function strokeRect(ctx, x, y, w, h, color) {
  rect(ctx, x, y, w, 1, color);
  rect(ctx, x, y + h - 1, w, 1, color);
  rect(ctx, x, y, 1, h, color);
  rect(ctx, x + w - 1, y, 1, h, color);
}

// Horizontal bar (0..1 filled).
export function bar(ctx, x, y, w, h, frac, color, back = '#2a2f55') {
  rect(ctx, x, y, w, h, '#000');
  rect(ctx, x + 1, y + 1, w - 2, h - 2, back);
  const fw = Math.max(0, Math.min(1, frac)) * (w - 2);
  if (fw > 0) rect(ctx, x + 1, y + 1, fw, h - 2, color);
}

// Blinking selection cursor (small right-pointing triangle).
export function cursor(ctx, x, y, t = 0, color = COLORS.accent) {
  const o = Math.floor(t / 8) % 2;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + o + i, y + i, 1, 7 - i * 2);
}

// Small "next page" arrow.
export function downArrow(ctx, x, y, t = 0, color = '#fff') {
  const o = Math.floor(t / 10) % 2;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + i, y + o + i, 7 - i * 2, 1);
}

// Starburst / sparkle used for celebrations.
export function sparkle(ctx, x, y, r, color = '#fff') {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - r), Math.round(y), r * 2 + 1, 1);
  ctx.fillRect(Math.round(x), Math.round(y - r), 1, r * 2 + 1);
  if (r > 2) {
    ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 3);
  }
}
