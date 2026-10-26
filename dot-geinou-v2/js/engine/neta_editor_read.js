// 台本を読み上げプレビュー (owner: R10-A): plays the script line by line with the estimated timing (the same per-line seconds as the
// editor's 推定 — neta_editor_core.lineTimes), shows the running time against the 目安の尺 and the contests' limits, and (optionally)
// reads the lines aloud with speechSynthesis. A modal of the editor: A skips to the next line, ←→ line by line, ↑↓ speed, B closes.
// Taps: the buttons, or the stage to pause. Never needed for scoring; nothing is saved.

import { SW, SH, clamp } from './util.js';
import { mmss } from './neta_ai.js';
import { measure } from './draw.js';
import { R, RR, T, hexA, jwrap, mix, K, ROLE_SHORT, BEAT_SHORT, sfx, isTouch, inR, scoreCol } from './neta_ui_kit.js';
import { lineTimes } from './neta_editor_core.js';
import { roleColor, beatColor } from './neta_editor_skin.js';
import { icon, limitMarks } from './neta_editor_view.js';

const VKEY = 'dotgeinou_neta_read_voice';
const PITCH = { boke: 1.3, tsukkomi: 0.85, a: 1.2, b: 0.9, c: 1.05, narr: 1.0, pin: 1.1, sage: 0.95 };
const SPEEDS = [0.5, 1, 1.5, 2, 3, 4];
const voiceSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
const loadVoice = () => { if (!voiceSupported()) return false; try { return localStorage.getItem(VKEY) !== '0'; } catch (e) { return true; } };
const saveVoice = (v) => { try { localStorage.setItem(VKEY, v ? '1' : '0'); } catch (e) { /* storage blocked */ } };
function speak(text, role, speed) {
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new window.SpeechSynthesisUtterance(String(text));
    u.lang = 'ja-JP'; u.pitch = PITCH[role] || 1; u.rate = clamp(0.9 + speed * 0.3, 0.8, 2.4);
    s.speak(u);
  } catch (e) { /* no speech */ }
}
const stopSpeech = () => { try { if (voiceSupported()) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } };

export function readModal(ed, from = 0) {
  const n = ed.n, S = ed.skin;
  const T0 = lineTimes(n);
  const idx = n.lines.map((l, i) => i).filter((i) => String(n.lines[i].text || '').trim());
  if (!idx.length) return null;
  const dur = (i) => Math.max(0.8, T0.sec[i] || 0);
  const total = T0.total;
  const ai = ed.liveAi();
  const strength = (i) => { const l = ai && ai.lines && ai.lines.find((x) => x.i === i); return l ? l.s : 50; };
  const marks = limitMarks(ed);
  const m = {
    kind: 'read', n, t: 0, k: Math.max(0, idx.indexOf(from)), lt: 0, speed: 2, playing: true, done: false, voice: loadVoice(), spoken: -1, pop: null, popped: -1, btns: [], laughs: 0,
    cur() { return idx[m.k]; },
    elapsed() { const i = m.cur(); return (T0.start[i] || 0) + Math.min(m.lt, dur(i)); },
    go(k) { stopSpeech(); m.k = clamp(k, 0, idx.length - 1); m.lt = 0; m.spoken = -1; m.popped = -1; m.pop = null; m.done = false; },
    next(ui) { if (m.k >= idx.length - 1) { m.finish(); return; } m.go(m.k + 1); },
    finish() { stopSpeech(); m.done = true; m.playing = false; sfx(total <= n.target * 1.05 ? 'success' : 'fail'); },
    setSpeed(d) { const i = clamp(SPEEDS.indexOf(m.speed) + d, 0, SPEEDS.length - 1); m.speed = SPEEDS[i]; sfx('cursor'); },
    toggleVoice() { if (!voiceSupported()) { sfx('buzz'); return; } m.voice = !m.voice; saveVoice(m.voice); if (!m.voice) stopSpeech(); else m.spoken = -1; sfx('cursor'); },
    wheel(dy) { m.go(m.k + (dy > 0 ? 1 : -1)); },
    update(ui, inp) {
      m.t++;
      if (m.t < 4) return;
      if (inp.pressed('b') || inp.pressed('menu')) { stopSpeech(); sfx('cancel'); ui.closeModal(m, null); return; }
      if (inp.pressed('a')) { if (m.done) { sfx('cancel'); ui.closeModal(m, null); return; } sfx('cursor'); m.next(ui); return; }
      if (inp.repeat('left')) m.go(m.k - 1);
      if (inp.repeat('right')) { if (m.k < idx.length - 1) m.go(m.k + 1); }
      if (inp.repeat('up')) m.setSpeed(1);
      if (inp.repeat('down')) m.setSpeed(-1);
      if (!m.playing || m.done) return;
      const i = m.cur(), l = n.lines[i];
      if (m.spoken !== m.k) { m.spoken = m.k; if (m.voice) speak(l.text, l.role, m.speed); else sfx('talk'); }
      m.lt += m.speed / 60;
      const d = dur(i);
      if (m.popped !== m.k && T0.punch[i] && m.lt >= d * 0.72) { m.popped = m.k; const s = strength(i); m.pop = { t: 0, s }; if (s >= 55) { sfx('laugh'); m.laughs++; } else if (s >= 35) sfx('good'); }
      if (m.pop) m.pop.t++;
      if (m.lt >= d) m.next(ui);
    },
    tap(ui, tap, inp) {
      const now = inp.pressedNow || {};
      now.a = false;
      for (const b of m.btns) {
        if (!inR(tap.x, tap.y, b.r)) continue;
        sfx('ok');
        if (b.id === 'prev') m.go(m.k - 1); else if (b.id === 'next') m.next(ui);
        else if (b.id === 'play') { if (m.done) m.go(0); else m.playing = !m.playing; if (!m.playing) stopSpeech(); else m.spoken = -1; }
        else if (b.id === 'speed') m.setSpeed(1 + (m.speed >= 4 ? -SPEEDS.length : 0));
        else if (b.id === 'voice') m.toggleVoice();
        else if (b.id === 'close') { stopSpeech(); ui.closeModal(m, null); }
        return;
      }
      if (m.line && inR(tap.x, tap.y, m.line)) { m.playing = !m.playing; if (!m.playing) stopSpeech(); else m.spoken = -1; sfx('cursor'); }
    },
    draw(ui, c) {
      const touch = isTouch();
      R(c, 0, 0, SW, SH, '#0b0812');
      const g = c.createRadialGradient(SW / 2, 30, 10, SW / 2, 140, 360);
      g.addColorStop(0, 'rgba(255,214,140,0.20)'); g.addColorStop(1, 'rgba(11,8,18,0)');
      c.fillStyle = g; c.fillRect(0, 0, SW, SH);
      const i = m.cur(), l = n.lines[i];
      const rc = roleColor(S, l.role);
      // top strip
      R(c, 0, 0, SW, 24, 'rgba(255,255,255,0.06)');
      T(c, '読み上げプレビュー', 10, 6, 12, K.gold);
      T(c, `『${n.title || '無題'}』`, 130, 7, 10, K.dim, 'left', 300);
      T(c, `${m.k + 1} / ${idx.length} 行目　×${m.speed}`, SW - 10, 7, 10, K.dim, 'right');
      if (m.done) return drawEnd(m, c, ui, touch);
      // the previous line (dim), the current line (big), the next line (dim)
      const prev = idx[m.k - 1], next = idx[m.k + 1];
      if (prev != null) T(c, `${ROLE_SHORT[n.lines[prev].role] || ''}　${n.lines[prev].text}`, 40, 42, 11, 'rgba(255,255,255,0.35)', 'left', SW - 80);
      const d = dur(i);
      const chars = Array.from(l.text);
      const shown = Math.min(chars.length, Math.ceil(chars.length * clamp(m.lt / (d * 0.7), 0, 1)));
      const body = chars.slice(0, shown).join('');
      const bx = 40, bw = SW - 80;
      const ls = jwrap(c, l.text, bw - 24, 16);
      const bh = Math.max(56, 40 + ls.length * 22);
      const by = 66;
      m.line = { x: bx, y: by, w: bw, h: bh };
      RR(c, bx, by, bw, bh, 8, hexA(rc, 0.16)); R(c, bx, by + 6, 4, bh - 12, rc);
      const rl = ed.roleLabel(l.role), rw = Math.min(150, Math.ceil(measure(c, rl, 11)) + 16);
      RR(c, bx + 14, by + 8, rw, 16, 8, rc); T(c, rl, bx + 14 + rw / 2, by + 10, 11, '#10101a', 'center', rw - 4);
      const b = l.twist ? 'uragiri' : l.beat || T0.beats[i];
      if (b && b !== 'boke' && b !== 'tsukkomi') { RR(c, bx + 20 + rw, by + 8, 44, 16, 8, hexA(beatColor(S, b), 0.9)); T(c, BEAT_SHORT[b] || b, bx + 42 + rw, by + 10, 11, '#10101a', 'center'); }
      T(c, `${(T0.sec[i] || 0).toFixed(1)}秒`, bx + bw - 12, by + 10, 10, K.dim, 'right');
      const shownLines = jwrap(c, body, bw - 24, 16);
      shownLines.forEach((s, k) => T(c, s, bx + 14, by + 32 + k * 22, 16, '#ffffff'));
      if (m.pop) { const a = clamp(1 - m.pop.t / 60, 0, 1); c.globalAlpha = a; T(c, m.pop.s >= 55 ? '（どっ！）' : m.pop.s >= 35 ? '（くすっ）' : '（シーン…）', bx + bw - 20, by - 14 - m.pop.t * 0.3, 14, m.pop.s >= 55 ? K.gold : K.dim, 'right'); c.globalAlpha = 1; }
      if (next != null) T(c, `${ROLE_SHORT[n.lines[next].role] || ''}　${n.lines[next].text}`, 40, by + bh + 10, 11, 'rgba(255,255,255,0.35)', 'left', SW - 80);
      drawStage(c, l, rc, n.kind, by + bh + 34, m.t);
      drawTimeline(m, c, idx, T0, n, S, marks, touch);
      drawButtons(m, c, touch);
    },
  };
  return m;
}

function drawTimeline(m, c, idx, T0, n, S, marks, touch) {
  const x = 40, w = SW - 80, y = touch ? 236 : 250, h = 12;
  const total = Math.max(1, T0.total);
  const maxS = Math.max(total, n.target) * 1.05;
  R(c, x, y, w, h, 'rgba(255,255,255,0.10)');
  const el = m.elapsed();
  idx.forEach((i) => {
    const x0 = x + (T0.start[i] / maxS) * w, bw = Math.max(1, (T0.sec[i] / maxS) * w - 1);
    const b = n.lines[i].twist ? 'uragiri' : n.lines[i].beat || T0.beats[i];
    const col = b ? beatColor(S, b) : '#888';
    const played = T0.start[i] + T0.sec[i] <= el;
    R(c, x0, y, bw, h, hexA(col, played ? 0.95 : 0.32));
    if (i === m.cur()) R(c, x0, y - 3, bw, 2, '#ffffff');
  });
  const px = x + (el / maxS) * w;
  R(c, px - 1, y - 5, 2, h + 10, '#ffffff');
  // 目安 and the contests' limits
  const tx = x + (n.target / maxS) * w;
  c.fillStyle = K.gold; c.beginPath(); c.moveTo(tx - 4, y + h + 2); c.lineTo(tx + 4, y + h + 2); c.lineTo(tx, y + h - 3); c.closePath(); c.fill();
  T(c, `目安 ${mmss(n.target).replace(/00秒$/, '')}`, tx, y + h + 5, 10, K.gold, 'center');
  const seen = new Set();
  for (const p of marks) { if (seen.has(p.sec) || p.sec > maxS) continue; seen.add(p.sec); const mx = x + (p.sec / maxS) * w; R(c, mx, y - 2, 1, h + 4, 'rgba(255,255,255,0.5)'); if (Math.abs(mx - tx) > 40) T(c, mmss(p.sec).replace(/00秒$/, ''), mx, y - 14, 10, K.dim, 'center'); }
  T(c, mmss(el), x, y - 14, 11, '#ffffff');
  T(c, `全体 ${mmss(total)}`, x + w, y - 14, 11, total > n.target * 1.05 ? K.red : K.dim, 'right');
}
function drawButtons(m, c, touch) {
  const bh = touch ? 46 : 28, y = SH - bh - 8, bw = touch ? 96 : 84;
  const defs = [
    ['prev', '前の行', 'prev'], ['play', m.playing ? '一時停止' : '再生', m.playing ? 'pause' : 'play'], ['next', '次の行', 'next'], ['speed', `速さ ×${m.speed}`, null],
    ['voice', m.voice ? '声 ON' : '声 OFF', null], ['close', 'とじる', null],
  ];
  const total = defs.length * bw + (defs.length - 1) * 6;
  let x = Math.round((SW - total) / 2);
  m.btns = [];
  for (const [id, label, ic] of defs) {
    const on = id === 'voice' && m.voice;
    RR(c, x, y, bw, bh, 6, on ? 'rgba(255,207,74,0.30)' : 'rgba(255,255,255,0.12)');
    if (ic) icon(c, ic, x + 16, y + bh / 2, 14, '#ffffff');
    T(c, label, x + (ic ? bw / 2 + 8 : bw / 2), y + Math.round((bh - 12) / 2), 12, id === 'voice' && !voiceSupported() ? K.faint : '#ffffff', 'center', bw - (ic ? 34 : 8));
    m.btns.push({ id, r: { x, y, w: bw, h: bh } });
    x += bw + 6;
  }
  if (!touch) T(c, '↑↓ 速さ　←→ 行　A つぎへ　B とじる', SW / 2, y - 14, 10, K.faint, 'center');
}
function drawEnd(m, c, ui, touch) {
  const n = m.n || ui.n, T0 = lineTimes(n);
  const total = T0.total, target = n.target;
  const over = total - target;
  const w = 380, x = (SW - w) / 2, y = 56;
  RR(c, x, y, w, 170, 8, 'rgba(255,255,255,0.08)');
  T(c, '読み上げおわり', SW / 2, y + 12, 14, K.gold, 'center');
  T(c, `推定 ${mmss(total)}　／　目安 ${mmss(target)}`, SW / 2, y + 40, 14, '#ffffff', 'center');
  const verdict = over > target * 0.05 ? `${Math.round(over)}秒オーバー。弱い行を削るか、目安の尺を見なおそう。` : over < -target * 0.2 ? `あと${Math.round(-over)}秒ぶん書ける。` : 'ちょうどいい長さ。';
  T(c, verdict, SW / 2, y + 68, 12, over > target * 0.05 ? K.red : K.green, 'center', w - 20);
  const punches = T0.punch.filter(Boolean).length;
  T(c, `笑いどころ ${punches}個${m.laughs ? `（そのうち大きく受けそうなのは ${m.laughs}個）` : ''}`, SW / 2, y + 94, 11, K.dim, 'center', w - 20);
  const min = total / 60;
  T(c, `1分あたり ${min ? (punches / min).toFixed(1) : '0'}個`, SW / 2, y + 114, 11, scoreCol(60), 'center');
  T(c, 'A / B でとじる　「再生」でもう一度', SW / 2, y + 146, 10, K.faint, 'center');
  drawButtons(m, c, touch);
}
void mix;

// a small stage under the line: mic stands (two for 漫才 / コント, one otherwise); the speaker's stand is lit
function drawStage(c, l, rc, kind, y, t) {
  const two = kind === 'manzai' || kind === 'conte';
  const sides = two ? [SW / 2 - 100, SW / 2 + 100] : [SW / 2];
  const which = two ? (l.role === 'boke' || l.role === 'a' ? 0 : l.role === 'tsukkomi' || l.role === 'b' ? 1 : -1) : 0;
  const fy = Math.min(y + 40, 222);
  R(c, 60, fy, SW - 120, 1, 'rgba(255,255,255,0.14)');
  sides.forEach((x, k) => {
    const lit = which === k || (which < 0);
    if (lit) { const g = c.createRadialGradient(x, fy, 4, x, fy, 60); g.addColorStop(0, hexA(rc, 0.35)); g.addColorStop(1, hexA(rc, 0)); c.fillStyle = g; c.fillRect(x - 60, fy - 30, 120, 40); }
    const col = lit ? '#e8e2f4' : '#6a6280';
    R(c, x - 1, fy - 26, 2, 26, col); R(c, x - 8, fy - 1, 16, 2, col); R(c, x - 3, fy - 33, 6, 8, col);
    if (lit) R(c, x - 3, fy - 33 - Math.round(Math.abs(Math.sin(t / 8)) * 3), 6, 1, rc);
  });
}
