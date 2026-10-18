// Text entry with a real <input> over the game (names etc.). Replaces window.prompt,
// which freezes the game loop and can leave touch / key state stuck on phones.
//
//   const s = await askText(g, { title: 'なまえ', value: 'ドット', max: 8 });  // null = cancelled
//
// While it is open the game ignores the keyboard (input.js skips events from form fields)
// and every held key / touch is released when it closes.

let open = null;

export function askText(g, { title = 'なまえを入力', value = '', max = 8, placeholder = '' } = {}) {
  if (open) open.close(null);
  if (g.auto) return Promise.resolve(value || null);
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'textask';
    wrap.innerHTML = `<form class="textask-box" autocomplete="off">
      <label class="textask-title"></label>
      <input class="textask-input" type="text" enterkeyhint="done" spellcheck="false">
      <div class="textask-note"></div>
      <div class="textask-btns"><button type="button" class="textask-cancel">キャンセル</button><button type="submit" class="textask-ok">けってい</button></div>
    </form>`;
    const form = wrap.querySelector('form');
    const input = wrap.querySelector('input');
    wrap.querySelector('label').textContent = title;
    wrap.querySelector('.textask-note').textContent = `${max}文字まで`;
    input.value = value;
    input.placeholder = placeholder;
    const clip = () => Array.from(input.value.trim()).slice(0, max).join('');
    input.addEventListener('input', () => {
      if (input.value.length > max * 2) input.value = Array.from(input.value).slice(0, max * 2).join('');
    });
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
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(null); } });
    // keep the game's touch handlers from swallowing taps inside the box
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) wrap.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(wrap);
    open = { close };
    g.input.releaseAll();
    // focus right away (desktop); on phones a tap on the field opens the keyboard
    setTimeout(() => { try { input.focus(); input.select(); } catch (e) { /* ignore */ } }, 30);
  });
}

export function isAskingText() { return !!open; }
