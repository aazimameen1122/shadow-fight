// Fighter roster and move tables. Frame data is in 60 Hz frames.
// Damage and range scale by each fighter's power / reach; startup is the
// character's personality (fast rushdown, slow heavy).

export const FIGHTERS = [
  {
    id: 'loop', name: 'LOOP', style: 'Balanced', weapon: 'blade',
    accent: '#f4f1ea', shoe: '#5c768d',
    desc: 'The everyday fighter. Crisp fundamentals, even speed, even power — wins by never quitting.',
    hp: 100, speed: 3.4, power: 1.0, reach: 1.0,
    stats: { PWR: 6, SPD: 6, HP: 6 },
    cloth: 'headband',
    special: { key: 'slash', name: 'Shadow Slash', desc: 'Lunging 3-hit blade flurry.', startup: 12, active: 9, recovery: 18, dmg: 7, hits: 3, range: 150, lunge: 7 },
  },
  {
    id: 'mentor', name: 'MENTOR', style: 'Heavy', weapon: 'staff',
    accent: '#9b8aa6', shoe: '#e5dec9',
    desc: 'Lilac cardigan, cream sunhat, heavy hands. Slow feet, devastating hits, armor on the heavy strike.',
    hp: 124, speed: 2.7, power: 1.3, reach: 1.05,
    stats: { PWR: 9, SPD: 4, HP: 9 },
    cloth: 'cardigan',
    special: { key: 'slam', name: 'Seismic Slam', desc: 'Armored ground slam. Shockwave.', startup: 18, active: 6, recovery: 24, dmg: 26, hits: 1, range: 110, lunge: 0, armor: true },
  },
  {
    id: 'sprinter', name: 'SPRINTER', style: 'Speed', weapon: 'sai',
    accent: '#eb3c32', shoe: '#f4f1ea',
    desc: 'Crimson sash, always in a hurry. Blinding dash speed, double-hit chains, dive-kick.',
    hp: 84, speed: 4.3, power: 0.82, reach: 0.95,
    stats: { PWR: 5, SPD: 10, HP: 4 },
    cloth: 'sash',
    special: { key: 'flurry', name: 'Teleport Flurry', desc: 'Vanish behind the foe. Five rapid cuts.', startup: 8, active: 12, recovery: 16, dmg: 4, hits: 5, range: 90, lunge: 0, teleport: true },
  },
  {
    id: 'eclipse', name: 'ECLIPSE', style: 'Shadow Boss', weapon: 'phantom',
    accent: '#b48cff', shoe: '#3a2b5c',
    desc: 'Dual-wielding phantom stance, tattered scarf, telegraphed boss specials. Defeat it to take the crown.',
    hp: 140, speed: 3.8, power: 1.15, reach: 1.1,
    stats: { PWR: 8, SPD: 8, HP: 8 },
    cloth: 'scarf',
    special: { key: 'eclipse', name: 'Phantom Eclipse', desc: 'Four sweeping phantom cuts.', startup: 14, active: 12, recovery: 20, dmg: 7, hits: 4, range: 130, lunge: 4 },
    boss: true,
  },
];

export function fighterById(id) {
  return FIGHTERS.find((f) => f.id === id) || FIGHTERS[0];
}

// Generic move table. Height: 'high' (beats crouch block), 'mid', 'low'
// (beats standing block). `chain` names the move a light chain may cancel to.
export const MOVES = {
  light:    { startup: 5,  active: 3,  recovery: 8,  dmg: 5,  range: 64, height: 'mid',  push: 2.5, hitstop: 3, meter: 7, chain: 'light' },
  light2:   { startup: 5,  active: 3,  recovery: 8,  dmg: 5,  range: 64, height: 'mid',  push: 2.5, hitstop: 3, meter: 7, chain: 'light3' },
  light3:   { startup: 6,  active: 4,  recovery: 12, dmg: 7,  range: 70, height: 'mid',  push: 4,   hitstop: 4, meter: 9, chain: 'heavy' },
  heavy:    { startup: 11, active: 4,  recovery: 16, dmg: 11, range: 78, height: 'mid',  push: 5,   hitstop: 6, meter: 10 },
  low:      { startup: 7,  active: 3,  recovery: 11, dmg: 6,  range: 60, height: 'low',  push: 3,   hitstop: 3, meter: 7 },
  sweep:    { startup: 13, active: 4,  recovery: 20, dmg: 9,  range: 72, height: 'low',  push: 5,   hitstop: 6, meter: 9, knockdown: true },
  antiAir:  { startup: 9,  active: 5,  recovery: 18, dmg: 10, range: 66, height: 'high', push: 4,   hitstop: 5, meter: 9, launch: true },
  lunge:    { startup: 10, active: 4,  recovery: 14, dmg: 10, range: 95, height: 'mid',  push: 5,   hitstop: 5, meter: 9, dash: 6 },
  airLight: { startup: 5,  active: 6,  recovery: 0,  dmg: 6,  range: 62, height: 'mid',  push: 3,   hitstop: 3, meter: 7 },
  airHeavy: { startup: 10, active: 6,  recovery: 0,  dmg: 12, range: 70, height: 'high', push: 5,   hitstop: 6, meter: 10 },
  throw:    { startup: 6,  active: 2,  recovery: 14, dmg: 12, range: 48, height: 'throw', push: 0,  hitstop: 6, meter: 8 },
};

// Resolve a move for a fighter: scale damage by power, range by reach.
// Mentor's heavy has armor during startup.
export function getMove(def, key) {
  const base = MOVES[key];
  if (!base) return null;
  const m = { ...base, key };
  m.dmg = Math.round(m.dmg * def.power);
  m.range = Math.round(m.range * def.reach);
  if (key === 'heavy' && def.id === 'mentor') m.armor = true;
  if (key === 'heavy' && def.id === 'sprinter') { m.startup = 9; m.dmg = Math.round(9 * def.power); }
  if (key === 'light' && def.id === 'sprinter') { m.startup = 4; }
  if (key === 'light' && def.id === 'mentor') { m.startup = 7; }
  return m;
}

export function getSpecial(def) {
  const s = def.special;
  return {
    key: 'special', name: s.name,
    startup: s.startup, active: s.active, recovery: s.recovery,
    dmg: Math.round(s.dmg * def.power), hits: s.hits, range: Math.round(s.range * def.reach),
    height: 'mid', push: 6, hitstop: 10, meter: 0,
    lunge: s.lunge || 0, armor: !!s.armor, teleport: !!s.teleport, specialKey: s.key,
  };
}
