// 台本エディタの時代ごとの見た目 (owner: R10-A). 昭和 = 原稿用紙 / 平成のはじめ = ワープロ専用機（青い画面）/ 平成 = パソコンのワープロソフト /
// 令和 = ノートアプリ. A skin is a palette plus the few drawing helpers that differ (chips, buttons, panels, row backgrounds).
// Pure canvas drawing; imports only the kit's tiny helpers.

import { R, RR, T, hexA, mix, ROLE_COL, BEAT_COL } from './neta_ui_kit.js';

const base = {
  good: '#5ee07a', bad: '#ff5d6c', warn: '#ffb547', info: '#5fd7ff', pink: '#ff7eb6', dark: true,
};

export const SKINS = {
  showa: {
    ...base, id: 'showa', kind: 'genko', name: '原稿用紙', dark: false, pdark: false, chip: 'stamp', btn: 'wood', box: 'paper',
    bg: '#2a1c12', head: '#3b2616', headText: '#f0d9a8', headDim: '#b9966a', headEdge: '#6b4426', strip: '#e6d8ac', stripText: '#2b1d14', stripDim: '#7a6648', stripChip: '#d3bf8a',
    paper: '#f6ecc9', paper2: '#f3e7c1', grid: '#e0b283', text: '#2a1b12', dim: '#7a6648', faint: '#a99876', num: '#c0504a', rule: '#dcc9a0',
    sel: '#ffeea0', selBar: '#d8412f', selText: '#2a1b12', range: '#ffd9a0', find: '#ffd24a', blank: '#ffb090',
    panel: '#efe3bf', panelEdge: '#8a6a44', panelHead: '#6b4426', panelHeadText: '#f6ecc9', panelText: '#2a1b12', panelDim: '#7a6648', track: '#d6c597',
    tool: '#5a3d27', toolText: '#f6ecc9', toolOn: '#d8412f', toolOnText: '#ffffff', toolSave: '#7a4a20', toolEdge: '#2a1c12', accent: '#d8412f', hint: '#c8aa78', detail: '#efe3bf', dText: '#2a1b12', dDim: '#7a6648', headOk: '#c8f0b8', headWarn: '#ffd24a',
    good: '#2f8a3f', bad: '#c03030', warn: '#b86a08', info: '#2a6aa0', pink: '#c0506a',
    role: { boke: '#d9541f', tsukkomi: '#2f5fb3', a: '#b04870', b: '#2f8a78', c: '#9a7a20', narr: '#6f6a60', pin: '#a07818', sage: '#a04820' }, beatMix: ['#000000', 0.18],
  },
  heisei_early: {
    ...base, id: 'heisei_early', kind: 'wp', name: 'ワープロ専用機', pdark: false, chip: 'block', btn: 'bevel', box: 'dialog',
    bg: '#06104a', head: '#c0c0c0', headText: '#000000', headDim: '#404040', headEdge: '#ffffff', strip: '#16248c', stripText: '#ffffff', stripDim: '#a8c0ff', stripChip: '#2c3cb0',
    paper: '#0b1a8c', paper2: '#0d1f9c', grid: null, text: '#ffffff', dim: '#a8c0ff', faint: '#6a80d0', num: '#00e0ff', rule: '#2a3cb0',
    sel: '#ffffff', selBar: '#ffe000', selText: '#0b1a8c', range: '#3a58e0', find: '#ffe000', blank: '#ff8030',
    panel: '#c0c0c0', panelEdge: '#000000', panelHead: '#000080', panelHeadText: '#ffffff', panelText: '#000000', panelDim: '#404040', track: '#808080',
    tool: '#c0c0c0', toolText: '#000000', toolOn: '#000080', toolOnText: '#ffffff', toolSave: '#a8a8a8', toolEdge: '#000000', accent: '#ffe000', hint: '#a8c0ff', detail: '#16248c', dText: '#ffffff', dDim: '#a8c0ff', headOk: '#006000', headWarn: '#b05000',
    good: '#007000', bad: '#c00000', warn: '#8a5a00', info: '#0040c0', pink: '#c0006a',
    role: { boke: '#ffb000', tsukkomi: '#00d0ff', a: '#ff80c0', b: '#40e0b0', c: '#e0e040', narr: '#c0c0c0', pin: '#ffd060', sage: '#ff9060' }, beatMix: null,
  },
  heisei: {
    ...base, id: 'heisei', kind: 'wp', name: 'ワープロソフト', dark: false, pdark: false, chip: 'tag', btn: 'bevel', box: 'xp',
    bg: '#5a7ec0', head: '#245edb', headText: '#ffffff', headDim: '#c0d4ff', headEdge: '#0a3aa0', strip: '#ece9d8', stripText: '#101010', stripDim: '#606060', stripChip: '#ffffff',
    paper: '#ffffff', paper2: '#f4f7ff', grid: null, text: '#101010', dim: '#606878', faint: '#9098a8', num: '#808890', rule: '#dde2ee',
    sel: '#316ac5', selBar: '#ffcc00', selText: '#ffffff', range: '#c4d8f4', find: '#ffe680', blank: '#ffb070',
    panel: '#ece9d8', panelEdge: '#808080', panelHead: '#245edb', panelHeadText: '#ffffff', panelText: '#101010', panelDim: '#606060', track: '#c0bcae',
    tool: '#ece9d8', toolText: '#101010', toolOn: '#316ac5', toolOnText: '#ffffff', toolSave: '#d8e4f8', toolEdge: '#606060', accent: '#316ac5', hint: '#e0eaff', detail: '#ece9d8', dText: '#101010', dDim: '#606060', headOk: '#c8f0b8', headWarn: '#ffe680',
    good: '#1a7a2a', bad: '#c02020', warn: '#a86000', info: '#1a50b0', pink: '#c03070',
    role: { boke: '#e07010', tsukkomi: '#1c64d0', a: '#c03080', b: '#1c9078', c: '#a08010', narr: '#707078', pin: '#b08010', sage: '#b04820' }, beatMix: ['#000000', 0.1],
  },
  reiwa: {
    ...base, id: 'reiwa', kind: 'note', name: 'ノート', pdark: true, chip: 'pill', btn: 'pill', box: 'card',
    bg: '#100e16', head: '#191622', headText: '#f4eef8', headDim: '#a99fc0', headEdge: '#2a2538', strip: '#15131c', stripText: '#f4eef8', stripDim: '#a99fc0', stripChip: '#241f33',
    paper: '#171420', paper2: '#1b1826', grid: null, text: '#f2eef8', dim: '#a99fc0', faint: '#6c6384', num: '#6c6384', rule: '#262236',
    sel: '#2e2748', selBar: '#a98bff', selText: '#ffffff', range: '#27365a', find: '#6a5a1a', blank: '#7a4a1a',
    panel: '#1a1724', panelEdge: '#2e2840', panelHead: '#241f33', panelHeadText: '#ffcf4a', panelText: '#f2eef8', panelDim: '#a99fc0', track: '#2a2538',
    tool: '#252035', toolText: '#f2eef8', toolOn: '#a98bff', toolOnText: '#15131c', toolSave: '#3a2a18', toolEdge: '#100e16', accent: '#a98bff', hint: '#6c6384', detail: '#1a1724', dText: '#f2eef8', dDim: '#a99fc0', headOk: '#5ee07a', headWarn: '#ffb547',
    role: {}, beatMix: null,
  },
};
export const skinFor = (era) => SKINS[era] || SKINS.reiwa;
export const roleColor = (S, role) => (S.role && S.role[role]) || ROLE_COL[role] || '#888';
export const beatColor = (S, beat) => { const c = BEAT_COL[beat] || '#888'; return S.beatMix ? mix(c, S.beatMix[0], S.beatMix[1]) : c; };

// ---- chips (speaker / beat labels): stamp (朱肉の判子) / block (反転表示) / tag (小さなラベル) / pill (丸いチップ)
export function drawChip(c, S, x, y, w, h, label, col, opt = {}) {
  const size = opt.size || 10;
  const dim = !!opt.dim;
  if (S.chip === 'pill') {
    RR(c, x, y, w, h, h / 2, dim ? hexA(col, 0.16) : hexA(col, 0.30));
    T(c, label, x + w / 2, y + Math.round((h - size) / 2), size, dim ? S.dim : mix(col, '#ffffff', 0.55), 'center', w - 2);
    return;
  }
  if (S.chip === 'stamp') {
    if (dim) { R(c, x, y, w, h, hexA(col, 0.14)); R(c, x, y, w, 1, hexA(col, 0.5)); R(c, x, y + h - 1, w, 1, hexA(col, 0.5)); R(c, x, y, 1, h, hexA(col, 0.5)); R(c, x + w - 1, y, 1, h, hexA(col, 0.5)); T(c, label, x + w / 2, y + Math.round((h - size) / 2), size, S.dim, 'center', w - 2); return; }
    R(c, x, y, w, h, col); R(c, x + 1, y + 1, w - 2, 1, hexA('#ffffff', 0.25)); R(c, x + 1, y + h - 2, w - 2, 1, hexA('#000000', 0.2));
    T(c, label, x + w / 2, y + Math.round((h - size) / 2), size, '#fff7e6', 'center', w - 2);
    return;
  }
  if (S.chip === 'tag') {
    R(c, x, y, w, h, dim ? '#eef0f6' : col); R(c, x, y, w, 1, dim ? '#c8ccd8' : mix(col, '#ffffff', 0.4)); R(c, x, y + h - 1, w, 1, dim ? '#c8ccd8' : mix(col, '#000000', 0.35));
    T(c, label, x + w / 2, y + Math.round((h - size) / 2), size, dim ? '#707888' : '#ffffff', 'center', w - 2);
    return;
  }
  // block
  R(c, x, y, w, h, dim ? '#20309c' : col); if (!dim) { R(c, x, y, w, 1, '#ffffff'); R(c, x, y + h - 1, w, 1, '#000000'); }
  T(c, label, x + w / 2, y + Math.round((h - size) / 2), size, dim ? S.dim : '#000000', 'center', w - 2);
}

// ---- buttons (toolbar, header): wood (木のボタン) / bevel (凸ボタン) / pill
export function drawButton(c, S, x, y, w, h, label, opt = {}) {
  const on = !!opt.on, off = !!opt.disabled, size = opt.size || 12;
  const fg = off ? S.faint : on ? S.toolOnText : (opt.fg || S.toolText);
  if (S.btn === 'pill') {
    RR(c, x, y, w, h, Math.min(8, h / 2), on ? S.toolOn : (opt.bg || S.tool));
    if (opt.save && !on) RR(c, x, y, w, h, Math.min(8, h / 2), S.toolSave);
  } else if (S.btn === 'bevel') {
    const bg = on ? S.toolOn : (opt.bg || (opt.save ? S.toolSave : S.tool));
    R(c, x, y, w, h, bg);
    if (!on) { R(c, x, y, w, 1, '#ffffff'); R(c, x, y, 1, h, '#ffffff'); R(c, x, y + h - 1, w, 1, '#404040'); R(c, x + w - 1, y, 1, h, '#404040'); R(c, x + 1, y + h - 2, w - 2, 1, '#808080'); R(c, x + w - 2, y + 1, 1, h - 2, '#808080'); }
    else { R(c, x, y, w, 1, '#000000'); R(c, x, y, 1, h, '#000000'); R(c, x + w - 1, y, 1, h, '#ffffff'); R(c, x, y + h - 1, w, 1, '#ffffff'); }
  } else {
    R(c, x, y, w, h, on ? S.toolOn : (opt.save ? S.toolSave : (opt.bg || S.tool)));
    R(c, x, y, w, 1, hexA('#ffffff', on ? 0.3 : 0.14)); R(c, x, y + h - 1, w, 1, hexA('#000000', 0.35));
  }
  if (label) T(c, label, x + w / 2, y + Math.round((h - size) / 2) + (opt.dy || 0), size, fg, 'center', w - 4);
}

// ---- a panel with a title bar (the right-hand ネタの状態 and the detail strip)
export function drawPanel(c, S, x, y, w, h, title, right) {
  const k = S.box;
  if (k === 'card') {
    RR(c, x, y, w, h, 6, S.panelEdge); RR(c, x + 1, y + 1, w - 2, h - 2, 5, S.panel);
    if (title) { T(c, title, x + 9, y + 4, 10, S.panelHeadText, 'left', w - 20); if (right) T(c, right, x + w - 8, y + 4, 10, S.panelDim, 'right'); }
    return;
  }
  R(c, x, y, w, h, S.panel);
  if (k === 'dialog') { R(c, x, y, w, 1, '#ffffff'); R(c, x, y, 1, h, '#ffffff'); R(c, x, y + h - 1, w, 1, '#000000'); R(c, x + w - 1, y, 1, h, '#000000'); R(c, x + 1, y + h - 2, w - 2, 1, '#808080'); R(c, x + w - 2, y + 1, 1, h - 2, '#808080'); }
  else if (k === 'xp') { R(c, x, y, w, 1, S.panelEdge); R(c, x, y + h - 1, w, 1, S.panelEdge); R(c, x, y, 1, h, S.panelEdge); R(c, x + w - 1, y, 1, h, S.panelEdge); }
  else { R(c, x, y, w, 1, S.panelEdge); R(c, x, y + h - 1, w, 1, S.panelEdge); R(c, x, y, 1, h, S.panelEdge); R(c, x + w - 1, y, 1, h, S.panelEdge); }
  if (title) {
    R(c, x + 1, y + 1, w - 2, 14, S.panelHead);
    T(c, title, x + 6, y + 2, 10, S.panelHeadText, 'left', w - 14 - (right ? 60 : 0));
    if (right) T(c, right, x + w - 6, y + 2, 10, S.panelHeadText, 'right');
  }
}

// ---- the 原稿用紙 grid behind a run of text: cells of cw x ch
export function drawGrid(c, S, x, y, cells, rows, cw = 12, ch = 14) {
  if (!S.grid) return;
  for (let r = 0; r < rows; r++) {
    R(c, x, y + r * ch + ch - 1, cells * cw, 1, S.grid);
    for (let k = 0; k <= cells; k++) R(c, x + k * cw - (k === cells ? 1 : 0), y + r * ch, 1, ch, S.grid);
  }
}
