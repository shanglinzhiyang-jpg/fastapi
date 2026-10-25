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
    const close = (result) => {
      if (!open) return;
      open = null;
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
    // focus right away (desktop); on phones a tap on the field opens the keyboard
    setTimeout(() => { try { input.focus(); if (type !== 'password' && !multiline) input.select(); } catch (e) { /* ignore */ } }, 30);
  });
}

export function isAskingText() { return !!open; }
