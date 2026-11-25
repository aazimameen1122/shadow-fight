// Central tuning values. Every number a designer would tweak lives here so
// a later config.js / tweak panel can expose them without touching logic.

export const VIEW = { W: 960, H: 540, FLOOR: 452 };
export const TICK = 1000 / 60; // 60 Hz fixed logic step
export const ROUND_TIME = 60; // seconds per round
export const ROUNDS_TO_WIN = 2;
export const INPUT_BUFFER_FRAMES = 7;
export const PARRY_WINDOW = 6; // frames after block starts in which a hit parries
export const COMBO_WINDOW = 90; // frames a combo stays alive between hits
export const WAKEUP_INVULN = 20; // invulnerable frames after getting up
export const DODGE_COOLDOWN = 60;
export const DODGE_IFRAMES = 12;
export const THROW_TECH_WINDOW = 6;
export const SPECIAL_COST = 100;

export const PHYSICS = {
  gravity: 0.55,
  jumpVel: -11.5,
  walkAccel: 0.5,
  friction: 0.75,
  airControl: 0.35,
  maxFall: 14,
};

export const HITSTOP = { light: 3, heavy: 6, sweep: 6, parry: 10, special: 10, ko: 14 };

export const STAGES = [
  { id: 'street', name: 'Rooftop Street', desc: 'Midnight skyline, warm windows, chinar tree, drifting embers.' },
  { id: 'lake', name: 'Moonlit Lake', desc: 'Red moon on rippling water, mist, shikara and houseboats.' },
  { id: 'courtyard', name: 'Old Courtyard', desc: 'Haveli arches, lantern light, khatamband ceilings, dust motes.' },
];

export const DIFFS = {
  easy: { label: 'Easy', react: 22, aggro: 0.35, blockCh: 0.1, dmg: 0.75, think: 22 },
  normal: { label: 'Normal', react: 13, aggro: 0.55, blockCh: 0.22, dmg: 1.0, think: 13 },
  hard: { label: 'Hard', react: 7, aggro: 0.78, blockCh: 0.38, dmg: 1.15, think: 7 },
};

export const LADDER = [
  { fighter: 'loop', stage: 'street', diff: 'easy' },
  { fighter: 'mentor', stage: 'courtyard', diff: 'normal' },
  { fighter: 'sprinter', stage: 'lake', diff: 'hard' },
  { fighter: 'eclipse', stage: 'lake', diff: 'hard' },
];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeIn = (t) => t * t;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
