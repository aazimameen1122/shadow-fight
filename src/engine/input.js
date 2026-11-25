// Buffered input. Every pressed action is stamped with the current logic
// frame and stays consumable for INPUT_BUFFER_FRAMES frames, so pressing an
// attack a few frames before recovery ends still executes cleanly.
// Both players (human keyboard, touch buttons, AI) speak this one interface:
// held(action) + consume(action).

import { INPUT_BUFFER_FRAMES } from '../config/config.js';

export const ACTIONS = ['left', 'right', 'up', 'down', 'light', 'heavy', 'special', 'throw', 'dodge'];

// Keyboard map: e.code -> { player: 0|1, action }
export const KEYMAP = {
  KeyA: [0, 'left'], KeyD: [0, 'right'], KeyW: [0, 'up'], KeyS: [0, 'down'],
  KeyJ: [0, 'light'], KeyK: [0, 'heavy'], KeyL: [0, 'special'], KeyU: [0, 'throw'],
  Space: [0, 'dodge'], KeyI: [0, 'dodge'],
  ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'], ArrowUp: [1, 'up'], ArrowDown: [1, 'down'],
  Numpad1: [1, 'light'], Numpad2: [1, 'heavy'], Numpad3: [1, 'special'], Numpad0: [1, 'throw'],
  KeyN: [1, 'light'], KeyM: [1, 'heavy'], Comma: [1, 'special'], Period: [1, 'throw'],
  Slash: [1, 'dodge'], ShiftRight: [1, 'dodge'], NumpadEnter: [1, 'dodge'],
};

export class Controller {
  constructor() {
    this.heldSet = new Set();
    this.buffer = []; // [{action, frame}]
    this.frame = 0;
    this.doubleTap = { left: -99, right: -99 }; // last tap frame per direction
    this.dashQueued = null; // 'left' | 'right' when a double-tap fired
  }

  tick() {
    this.frame += 1;
    const cutoff = this.frame - INPUT_BUFFER_FRAMES;
    while (this.buffer.length && this.buffer[0].frame < cutoff) this.buffer.shift();
  }

  press(action) {
    this.buffer.push({ action, frame: this.frame });
    if (this.buffer.length > 24) this.buffer.shift();
  }

  consume(action) {
    for (let i = 0; i < this.buffer.length; i += 1) {
      if (this.buffer[i].action === action) {
        this.buffer.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  peek(action) {
    return this.buffer.some((b) => b.action === action);
  }

  held(action) {
    return this.heldSet.has(action);
  }

  down(action) {
    if (this.heldSet.has(action)) return;
    this.heldSet.add(action);
    this.press(action);
    if (action === 'left' || action === 'right') {
      if (this.frame - this.doubleTap[action] <= 18) this.dashQueued = action;
      this.doubleTap[action] = this.frame;
    }
  }

  up(action) {
    this.heldSet.delete(action);
  }

  takeDash() {
    const d = this.dashQueued;
    this.dashQueued = null;
    return d;
  }

  clear() {
    this.heldSet.clear();
    this.buffer.length = 0;
    this.dashQueued = null;
  }
}

// One shared keyboard feeds two per-player controllers. `onPause` fires on
// Escape / KeyP, `onToggleHitbox` on KeyH (training).
export class Keyboard {
  constructor(p1, p2, onPause, onToggleHitbox) {
    this.p1 = p1;
    this.p2 = p2;
    this.onPause = onPause;
    this.onToggleHitbox = onToggleHitbox;
    this._down = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); if (this.onPause) this.onPause(); return; }
      if (e.code === 'KeyH') { if (this.onToggleHitbox) this.onToggleHitbox(); return; }
      const m = KEYMAP[e.code];
      if (!m) return;
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Slash'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      const c = m[0] === 0 ? this.p1 : this.p2;
      c.down(m[1]);
    };
    this._up = (e) => {
      const m = KEYMAP[e.code];
      if (!m) return;
      const c = m[0] === 0 ? this.p1 : this.p2;
      c.up(m[1]);
    };
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
  }

  destroy() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
  }
}
