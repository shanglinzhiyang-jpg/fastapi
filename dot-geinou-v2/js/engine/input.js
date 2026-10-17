// Keyboard + touch input mapped to virtual buttons:
// up / down / left / right / a / b / menu
//
//   input.down(k)     – button is held
//   input.pressed(k)  – button went down since the last update step
//   input.repeat(k)   – pressed, then auto-repeats while held (menus)
//   input.dir()       – most recently pressed held direction or null

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', Space: 'a', Enter: 'a', NumpadEnter: 'a', KeyJ: 'a',
  KeyX: 'b', Backspace: 'b', ShiftLeft: 'b', ShiftRight: 'b', KeyK: 'b',
  Escape: 'menu', KeyC: 'menu', KeyQ: 'menu',
};
const DIR_KEYS = ['up', 'down', 'left', 'right'];
const REPEAT_DELAY = 18;
const REPEAT_RATE = 5;

export class Input {
  constructor() {
    this.held = {};
    this.pressedNow = {};
    this.repeatTimer = {};
    this.dirStack = [];
    this.sources = {}; // button -> Set of source ids holding it
    this.onAnyKey = null; // hook used to unlock audio
    this.onMute = null;

    window.addEventListener('keydown', (e) => {
      if (this.onAnyKey) this.onAnyKey();
      // leave browser / OS shortcuts (Ctrl+S, Cmd+D, Alt+...) alone
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyM' && !e.repeat) {
        if (this.onMute) this.onMute();
        return;
      }
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      if (e.repeat) return;
      this.press(k, 'kb:' + e.code);
    });
    window.addEventListener('keyup', (e) => {
      // macOS sends no keyup for keys released while Cmd is held
      if (e.key === 'Meta') { this.releaseAll(); return; }
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      this.release(k, 'kb:' + e.code);
    });
    window.addEventListener('blur', () => this.releaseAll());
    // Audio may only start inside a user activation. A touch pointerdown is not
    // one (pointerup / touchend / click are), so also unlock on those.
    const unlock = () => { if (this.onAnyKey) this.onAnyKey(); };
    for (const ev of ['pointerup', 'touchend', 'click']) document.addEventListener(ev, unlock, { capture: true, passive: true });
  }

  press(k, src) {
    const s = (this.sources[k] ||= new Set());
    const wasHeld = s.size > 0;
    s.add(src);
    if (!wasHeld) {
      this.held[k] = true;
      this.pressedNow[k] = true;
      this.repeatTimer[k] = 0;
      if (DIR_KEYS.includes(k)) {
        this.dirStack = this.dirStack.filter((d) => d !== k);
        this.dirStack.push(k);
      }
    }
  }

  release(k, src) {
    const s = this.sources[k];
    if (!s) return;
    s.delete(src);
    if (s.size === 0) {
      this.held[k] = false;
      if (DIR_KEYS.includes(k)) this.dirStack = this.dirStack.filter((d) => d !== k);
    }
  }

  releaseAll() {
    for (const k in this.sources) this.sources[k].clear();
    this.held = {};
    this.dirStack = [];
  }

  down(k) { return !!this.held[k]; }
  pressed(k) { return !!this.pressedNow[k]; }
  repeat(k) {
    if (this.pressedNow[k]) return true;
    const t = this.repeatTimer[k] || 0;
    return this.held[k] && t >= REPEAT_DELAY && (t - REPEAT_DELAY) % REPEAT_RATE === 0;
  }
  anyPressed() { return Object.values(this.pressedNow).some(Boolean); }
  dir() { return this.dirStack.length ? this.dirStack[this.dirStack.length - 1] : null; }

  // Swallow everything currently pressed (used when switching scenes).
  consume() { this.pressedNow = {}; }

  // Called once at the end of every fixed update step.
  update() {
    this.pressedNow = {};
    for (const k in this.held) if (this.held[k]) this.repeatTimer[k] = (this.repeatTimer[k] || 0) + 1;
  }

  // Touch controls: a circular d-pad, A/B/MENU buttons and tap-on-screen = A.
  bindTouch({ dpad, buttons, screen }) {
    let curDir = null;
    const setDpad = (dir) => {
      curDir = dir;
      for (const d of DIR_KEYS) {
        if (d === dir) this.press(d, 'dpad'); else this.release(d, 'dpad');
        const el = dpad.querySelector('.' + d);
        if (el) el.classList.toggle('on', d === dir);
      }
    };
    const ANGLE = { right: 0, down: 90, left: 180, up: -90 };
    const dirFrom = (e) => {
      const r = dpad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      // hysteresis: a held direction survives a slightly smaller radius and
      // 15 degrees past its 45-degree boundary, so a sliding thumb does not
      // flicker into a neighbouring direction
      if (Math.hypot(dx, dy) < r.width * (curDir ? 0.12 : 0.16)) return null;
      if (curDir) {
        const a = Math.atan2(dy, dx) * 180 / Math.PI;
        const diff = Math.abs(((a - ANGLE[curDir]) % 360 + 540) % 360 - 180);
        if (diff < 60) return curDir;
      }
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    };
    let dpadPointer = null;
    dpad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.onAnyKey) this.onAnyKey();
      dpadPointer = e.pointerId;
      dpad.setPointerCapture(e.pointerId);
      setDpad(dirFrom(e));
    });
    dpad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dpadPointer) return;
      setDpad(dirFrom(e));
    });
    const endDpad = (e) => {
      if (e.pointerId !== dpadPointer) return;
      dpadPointer = null;
      setDpad(null);
    };
    dpad.addEventListener('pointerup', endDpad);
    dpad.addEventListener('pointercancel', endDpad);

    for (const btn of buttons) {
      const k = btn.dataset.k;
      const src = 'btn:' + k;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.onAnyKey) this.onAnyKey();
        btn.setPointerCapture(e.pointerId);
        btn.classList.add('on');
        this.press(k, src);
      });
      const up = () => { btn.classList.remove('on'); this.release(k, src); };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    screen.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.onAnyKey) this.onAnyKey();
      this.press('a', 'tap');
    });
    const tapUp = () => this.release('a', 'tap');
    screen.addEventListener('pointerup', tapUp);
    screen.addEventListener('pointercancel', tapUp);
    screen.addEventListener('pointerleave', tapUp);
    screen.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
