// Fixed-timestep loop: 60 Hz logic decoupled from the display refresh rate
// via an accumulator. `step` runs in whole ticks; `render` runs every frame.
// The game may set game.timeScale (slow-mo) which stretches tick length.

import { TICK } from '../config/config.js';

export function createLoop(step, render) {
  let acc = 0;
  let last = performance.now();
  let running = false;
  let raf = 0;

  function frame(now) {
    if (!running) return;
    let dt = now - last;
    last = now;
    if (dt > 250) dt = 250; // tab was in the background: don't spiral
    acc += dt;
    let guard = 0;
    while (acc >= TICK && guard < 5) {
      step();
      acc -= TICK;
      guard += 1;
    }
    if (guard >= 5) acc = 0;
    render();
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
