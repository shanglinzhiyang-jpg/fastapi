// Text entry with a real <input> over the game (names etc.). Replaces window.prompt,
// which freezes the game loop and can leave touch / key state stuck on phones.
//
//   const s = await askText(g, { title: 'なまえ', value: 'ドット', max: 8 });  // null = cancelled
//
// Options added for the script editor (all optional, the defaults behave as before):
//   multiline: true   a <textarea> (rows: 4); Enter is a new line, Ctrl/⌘+Enter or けってい submits; the text keeps its
//                     line breaks (trimmed at both ends)
//   type: 'password'  a masked field (API keys); never pre-selected, no autocomplete / spellcheck
//   note: '…'         a short help line under the field (shown before the counter)
// In g.auto mode (tests) askText resolves at once: g.auto.text (a string, or (opts) => string|null) when set,
// else the given value (or null).
//
// While it is open the game ignores the keyboard (input.js skips events from form fields)
// and every held key / touch is released when it closes.

let open = null;

// ---- caret movement for the on-screen ◀▲▼▶ keys and the touch d-pad (a real keyboard moves the caret natively;
// the touch pad would otherwise do nothing while a box is open: the page's own d-pad is not a keyboard).
// ↑↓ move by visual line (a hidden mirror of the field measures where every character sits); in a one-line field
// ↑ = the start and ↓ = the end.
function layoutOf(el) {
  const cs = getComputedStyle(el);
  const m = document.createElement('div');
  const st = m.style;
  for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'tabSize']) st[k] = cs[k];
  Object.assign(st, { position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0', boxSizing: 'border-box', width: el.clientWidth + 'px', whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word', border: '0' });
  const text = el.value;
  const spans = [];
  let i = 0;
  for (const ch of text) { const sp = document.createElement('span'); sp.textContent = ch; m.appendChild(sp); spans.push({ i, sp }); i += ch.length; }
  const end = document.createElement('span'); end.textContent = '​'; m.appendChild(end); spans.push({ i: text.length, sp: end });
  document.body.appendChild(m);
  const pts = spans.map(({ i: idx, sp }) => ({ i: idx, x: sp.offsetLeft, y: sp.offsetTop, h: sp.offsetHeight || 20 }));
  m.remove();
  return { pts, pad: { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 } };
}
export function moveCaret(el, dir) {
  if (!el) return;
  const len = el.value.length;
  let pos = el.selectionEnd == null ? len : el.selectionEnd;
  if (el.tagName !== 'TEXTAREA') {
    if (dir === 'up') pos = 0; else if (dir === 'down') pos = len;
    else if (dir === 'left') pos = Math.max(0, pos - 1); else if (dir === 'right') pos = Math.min(len, pos + 1);
    el.setSelectionRange(pos, pos);
    return;
  }
  if (dir === 'left' || dir === 'right') {
    const step = (p, d) => { const q = p + d; if (d < 0 && q > 0 && /[\udc00-\udfff]/.test(el.value[q]) && /[\ud800-\udbff]/.test(el.value[q - 1])) return q - 1; if (d > 0 && q < len && /[\udc00-\udfff]/.test(el.value[q]) && /[\ud800-\udbff]/.test(el.value[q - 1])) return q + 1; return q; };
    pos = Math.max(0, Math.min(len, step(pos, dir === 'left' ? -1 : 1)));
    el.setSelectionRange(pos, pos);
  } else {
    const { pts, pad } = layoutOf(el);
    let cur = pts.findIndex((p) => p.i >= pos);
    if (cur < 0) cur = pts.length - 1;
    const c = pts[cur];
    const ys = [...new Set(pts.map((p) => p.y))].sort((a, b) => a - b);
    const yi = ys.indexOf(c.y) + (dir === 'down' ? 1 : -1);
    let tgt;
    if (yi < 0) tgt = pts[0];
    else if (yi >= ys.length) tgt = pts[pts.length - 1];
    else { let best = null; for (const p of pts) if (p.y === ys[yi] && (best === null || Math.abs(p.x - c.x) < Math.abs(best.x - c.x))) best = p; tgt = best; }
    pos = tgt.i;
    el.setSelectionRange(pos, pos);
    // keep the caret line inside the visible part of the field
    if (tgt.y - pad.top < el.scrollTop) el.scrollTop = Math.max(0, tgt.y - pad.top);
    else if (tgt.y + tgt.h > el.scrollTop + el.clientHeight - pad.bottom) el.scrollTop = tgt.y + tgt.h - el.clientHeight + pad.bottom;
  }
}

export function askText(g, opts = {}) {
  const { title = 'なまえを入力', value = '', max = 8, placeholder = '', multiline = false, rows = 4, type = 'text', note: help = '' } = opts;
  if (open) open.close(null);
  if (g.auto) {
    const a = g.auto.text;
    if (typeof a === 'function') { let v = null; try { v = a({ title, value, max, multiline, type }); } catch (e) { v = null; } return Promise.resolve(v == null ? null : Array.from(String(v)).slice(0, max).join('')); }
    if (typeof a === 'string') return Promise.resolve(Array.from(a).slice(0, max).join('') || null);
    return Promise.resolve(value || null);
  }
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'textask';
    wrap.innerHTML = `<form class="textask-box" autocomplete="off">
      <label class="textask-title"></label>
      ${multiline ? `<textarea class="textask-input" rows="${Math.max(2, Math.min(14, rows | 0))}" spellcheck="false"></textarea>` : `<input class="textask-input" type="${type === 'password' ? 'password' : 'text'}" enterkeyhint="done" spellcheck="false"${type === 'password' ? ' autocomplete="off" autocapitalize="off"' : ''}>`}
      <div class="textask-keys" aria-label="カーソルの移動"><button type="button" data-d="left">◀</button><button type="button" data-d="up">▲</button><button type="button" data-d="down">▼</button><button type="button" data-d="right">▶</button></div>
      <div class="textask-help"></div>
      <div class="textask-note"></div>
      <div class="textask-btns"><button type="button" class="textask-cancel">キャンセル</button><button type="submit" class="textask-ok">けってい</button></div>
    </form>`;
    const form = wrap.querySelector('form');
    const input = wrap.querySelector('.textask-input');
    wrap.querySelector('label').textContent = title;
    const helpEl = wrap.querySelector('.textask-help');
    if (help) { helpEl.textContent = help; helpEl.style.cssText = 'color:#9aa3c7;font-size:13px;white-space:pre-line;'; } else helpEl.remove();
    if (multiline) input.style.cssText = 'resize:vertical;min-height:4.5em;max-height:55vh;line-height:1.35;font-size:18px;';
    const note = wrap.querySelector('.textask-note');
    input.value = value;
    input.placeholder = placeholder;
    const clip = () => Array.from(multiline ? input.value.replace(/\r\n?/g, '\n').trim() : input.value.trim()).slice(0, max).join('');
    // The limit holds while typing (no silent cut on けってい). During an IME composition
    // (かな → 漢字) the text may run up to max * 2 so a conversion is not broken halfway;
    // when it is committed, the field is cut to max. A live counter shows the length.
    let composing = false;
    const count = () => {
      const n = Array.from(input.value).length;
      note.textContent = `${n}/${max}文字`;
      note.classList.toggle('over', n > max);
    };
    const enforce = () => {
      const ch = Array.from(input.value);
      if (ch.length > max) input.value = ch.slice(0, max).join('');
    };
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; enforce(); count(); });
    input.addEventListener('input', (e) => {
      if (composing || e.isComposing) {
        if (input.value.length > max * 2) input.value = Array.from(input.value).slice(0, max * 2).join('');
      } else enforce();
      count();
    });
    count();
    // caret keys: on-screen buttons (kept above the phone keyboard) and the touch d-pad; held = repeats
    let rep1 = null, rep2 = null;
    const stopRepeat = () => { clearTimeout(rep1); clearInterval(rep2); rep1 = rep2 = null; };
    const caretStep = (d) => { try { moveCaret(input, d); } catch (e) { /* ignore */ } if (document.activeElement !== input) { try { input.focus({ preventScroll: true }); } catch (e2) { /* ignore */ } } };
    const startRepeat = (d) => { stopRepeat(); caretStep(d); rep1 = setTimeout(() => { rep2 = setInterval(() => caretStep(d), 90); }, 380); };
    for (const b of wrap.querySelectorAll('.textask-keys button')) {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); startRepeat(b.dataset.d); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stopRepeat);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    const close = (result) => {
      if (!open) return;
      open = null;
      stopRepeat();
      g.input.textHook = null;
      document.body.classList.remove('asking-text');
      wrap.remove();
      g.input.releaseAll();
      g.input.consume();
      resolve(result);
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); const v = clip(); close(v || null); });
    wrap.querySelector('.textask-cancel').addEventListener('click', () => close(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(null); }
      else if (multiline && e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) { e.preventDefault(); const v = clip(); close(v || null); }
    });
    // keep the game's touch handlers from swallowing taps inside the box
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) wrap.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(wrap);
    open = { close };
    g.input.releaseAll();
    g.input.textHook = (k, st) => { if (st === 'down') startRepeat(k); else stopRepeat(); }; // the page's touch d-pad moves the caret
    document.body.classList.add('asking-text');
    // focus right away (desktop); on phones a tap on the field opens the keyboard
    setTimeout(() => { try { input.focus(); if (type !== 'password' && !multiline) input.select(); } catch (e) { /* ignore */ } }, 30);
  });
}

export function isAskingText() { return !!open; }
