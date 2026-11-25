// Combat core: fighter entities, the state machine, hit resolution, guard
// meter, parries, throws, dodge rolls, specials, combos and knockdowns.
// Runs at 60 Hz. All hit/block/parry outcomes are decided here; main.js
// turns the emitted events into sound, VFX, HUD and callouts.

import { VIEW, PHYSICS, HITSTOP, COMBO_WINDOW, WAKEUP_INVULN, DODGE_COOLDOWN, DODGE_IFRAMES, PARRY_WINDOW, THROW_TECH_WINDOW, SPECIAL_COST, clamp } from '../config/config.js';
import { getMove, getSpecial } from '../fighters/fighters.js';
import { initCloth, updateCloth } from '../animation/rig.js';

export function createFighter(def, side) {
  const f = {
    def, side,
    x: side === 0 ? 280 : VIEW.W - 280, y: VIEW.FLOOR, vx: 0, vy: 0,
    face: side === 0 ? 1 : -1,
    hp: def.hp, maxHp: def.hp, meter: 0, guard: 0,
    state: 'idle', stateT: 0, attack: null,
    combo: 0, comboT: 0, bestCombo: 0, dmgDealt: 0, roundsWon: 0,
    invuln: 0, dodgeCd: 0, blockStartedAt: -999, throwAt: -999,
    walkPhase: Math.random() * 6, phase: Math.random() * 6,
    flash: 0, afterimages: null, wins: 0,
    crouch: false, blocking: false, airborne: false,
    guardBroken: false, koBy: null,
  };
  initCloth(f);
  return f;
}

export function resetFighter(f, x, facing) {
  f.x = x; f.y = VIEW.FLOOR; f.vx = 0; f.vy = 0; f.face = facing;
  f.hp = f.maxHp; f.meter = 0; f.guard = 0;
  f.state = 'intro'; f.stateT = 0; f.attack = null;
  f.combo = 0; f.comboT = 0; f.invuln = 0; f.dodgeCd = 0; f.flash = 0; f.afterimages = null;
  f.blocking = false; f.crouch = false; f.airborne = false; f.guardBroken = false; f.koBy = null;
}

export function hurtbox(f) {
  const crouch = f.state === 'crouch' || f.state === 'block' || f.crouch;
  const h = crouch ? 82 : 122;
  return { x: f.x - 17, y: f.y - h, w: 34, h };
}

export function attackHitbox(f, move) {
  const reach = move.range;
  const x0 = f.x + f.face * 14;
  const x = f.face === 1 ? x0 : x0 - reach;
  let y, h;
  if (move.height === 'high') { y = f.y - 132; h = 62; }
  else if (move.height === 'low') { y = f.y - 58; h = 52; }
  else { y = f.y - 112; h = 72; }
  if (move.key === 'antiAir') { y = f.y - 150; h = 110; }
  return { x, y, w: reach, h };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function setState(f, state) {
  f.state = state;
  f.stateT = 0;
}

function startAttack(f, move, key) {
  f.attack = { move, key, phase: 'startup', t: 0, hitsLanded: 0, nextHitAt: 0 };
  setState(f, key === 'special' ? 'special' : 'attack');
  f.vx = 0;
  if (move.dash) f.vx = f.face * move.dash;
}

function startThrow(f) {
  const move = getMove(f.def, 'throw');
  f.attack = { move, key: 'throw', phase: 'startup', t: 0, hitsLanded: 0, nextHitAt: move.startup };
  f.throwAt = f.frame || 0;
  setState(f, 'throw');
}

// Direction relative to facing: 'toward' = toward the foe.
function dirOf(f, ctrl, which) {
  if (which === 'toward') return f.face === 1 ? ctrl.held('right') : ctrl.held('left');
  return f.face === 1 ? ctrl.held('left') : ctrl.held('right');
}

export function updateFighter(f, foe, ctrl, events, frame, opts) {
  f.frame = frame;
  f.stateT += 1;
  if (f.flash > 0) f.flash -= 1;
  if (f.invuln > 0) f.invuln -= 1;
  if (f.dodgeCd > 0) f.dodgeCd -= 1;
  if (f.comboT > 0) { f.comboT -= 1; if (f.comboT === 0) f.combo = 0; }
  if (f.afterimages) {
    for (const g of f.afterimages) g.a -= 0.08;
    f.afterimages = f.afterimages.filter((g) => g.a > 0);
    if (!f.afterimages.length) f.afterimages = null;
  }
  updateCloth(f);

  const airborne = f.y < VIEW.FLOOR || f.vy !== 0;
  f.airborne = airborne;

  // Face the foe while neutral
  if (['idle', 'walk', 'crouch', 'block', 'intro'].includes(f.state)) {
    f.face = foe.x >= f.x ? 1 : -1;
  }

  // Blocking: hold away (standing) or away+down (crouch block)
  const awayHeld = dirOf(f, ctrl, 'away');
  const downHeld = ctrl.held('down');
  f.blocking = awayHeld && ['idle', 'walk', 'crouch', 'block'].includes(f.state) && !airborne;
  if (f.blocking && f.state !== 'block') {
    if (f.state === 'idle' || f.state === 'walk' || f.state === 'crouch') {
      f.blockStartedAt = frame;
      setState(f, 'block');
    }
  }
  if (f.state === 'block' && !f.blocking) setState(f, 'idle');
  f.crouch = downHeld && !airborne && ['idle', 'crouch', 'block'].includes(f.state);

  switch (f.state) {
    case 'intro': {
      if (f.stateT > 40) setState(f, 'idle');
      break;
    }
    case 'idle':
    case 'walk':
    case 'crouch':
    case 'block': {
      // Movement
      const toward = dirOf(f, ctrl, 'toward');
      const away = awayHeld;
      if (!f.blocking && !downHeld) {
        if (toward) { f.vx = f.face * f.def.speed; setState(f, 'walk'); }
        else if (away) { f.vx = -f.face * f.def.speed * 0.8; setState(f, 'walk'); }
        else { f.vx = 0; if (f.state === 'walk') setState(f, 'idle'); }
      } else {
        f.vx = 0;
        if (downHeld && f.state !== 'block') setState(f, 'crouch');
        else if (!downHeld && f.state === 'crouch') setState(f, 'idle');
      }
      if (f.state === 'walk') f.walkPhase += 0.22;
      // Dash (double-tap)
      const dash = ctrl.takeDash && ctrl.takeDash();
      if (dash && !f.blocking) {
        const dir = dash === 'right' ? 1 : -1;
        setState(f, dir === f.face ? 'dash' : 'backstep');
        f.vx = dir * f.def.speed * 3.2;
        events.push({ type: 'sound', name: 'dash' });
        events.push({ type: 'dust', x: f.x, y: f.y, n: 5 });
        break;
      }
      // Jump — but not when Heavy is already buffered with Up held (Up+K anti-air)
      if (!downHeld && !ctrl.peek('heavy') && ctrl.consume('up')) {
        f.vy = PHYSICS.jumpVel;
        f.vx = toward ? f.face * f.def.speed : away ? -f.face * f.def.speed * 0.8 : 0;
        setState(f, 'jump');
        events.push({ type: 'sound', name: 'jump' });
        events.push({ type: 'dust', x: f.x, y: f.y, n: 4 });
        break;
      }
      // Dodge roll
      if (ctrl.consume('dodge') && f.dodgeCd <= 0) {
        setState(f, 'dodge');
        f.vx = (away ? -f.face : f.face) * 7;
        f.invuln = DODGE_IFRAMES;
        f.dodgeCd = DODGE_COOLDOWN;
        events.push({ type: 'dust', x: f.x, y: f.y, n: 7 });
        break;
      }
      // Throw
      if (ctrl.consume('throw')) {
        startThrow(f);
        break;
      }
      // Special (cancel-safe: also from neutral)
      if (ctrl.consume('special') && f.meter >= SPECIAL_COST) {
        startSpecial(f, events);
        break;
      }
      // Attacks with directional context
      if (!airborne) {
        if (ctrl.consume('light')) {
          const key = downHeld ? 'low' : 'light';
          startAttack(f, getMove(f.def, key), key);
          events.push({ type: 'sound', name: 'whoosh' });
          break;
        }
        if (ctrl.consume('heavy')) {
          let key = 'heavy';
          if (downHeld) key = 'sweep';
          else if (ctrl.held('up')) key = 'antiAir';
          else if (toward) key = 'lunge';
          startAttack(f, getMove(f.def, key), key);
          events.push({ type: 'sound', name: key === 'heavy' || key === 'lunge' ? 'swingHeavy' : 'whoosh' });
          break;
        }
      } else if (ctrl.consume('light') || ctrl.consume('heavy')) {
        // air attacks are handled in the jump state
      }
      break;
    }
    case 'jump': {
      if (ctrl.held('left')) f.vx = Math.max(f.vx - PHYSICS.airControl, -f.def.speed);
      if (ctrl.held('right')) f.vx = Math.min(f.vx + PHYSICS.airControl, f.def.speed);
      if (ctrl.consume('light')) { startAttack(f, getMove(f.def, 'airLight'), 'airLight'); break; }
      if (ctrl.consume('heavy')) { startAttack(f, getMove(f.def, 'airHeavy'), 'airHeavy'); break; }
      break;
    }
    case 'dash':
    case 'backstep': {
      if (f.stateT > 12) { f.vx = 0; setState(f, 'idle'); }
      break;
    }
    case 'dodge': {
      if (f.stateT > 16) { f.vx = 0; setState(f, 'idle'); }
      break;
    }
    case 'attack':
    case 'special': {
      const a = f.attack;
      if (!a) { setState(f, 'idle'); break; }
      a.t += 1;
      // phase transitions
      if (a.phase === 'startup' && a.t >= a.move.startup) { a.phase = 'active'; a.t = 0; }
      else if (a.phase === 'active' && a.t >= a.move.active) { a.phase = 'recovery'; a.t = 0; }
      else if (a.phase === 'recovery' && a.t >= a.move.recovery) {
        f.attack = null;
        setState(f, airborne ? 'jump' : 'idle');
        break;
      }
      // Lunge / special forward motion during startup+active
      if (a.move.dash && a.phase !== 'recovery') f.vx = f.face * a.move.dash;
      if (a.move.lunge && a.phase !== 'recovery') f.vx = f.face * a.move.lunge;
      // Teleport special: at end of startup, appear behind the foe
      if (a.move.teleport && a.phase === 'startup' && a.t === a.move.startup - 1) {
        f.afterimages = [{ x: f.x, a: 1 }];
        f.x = foe.x - foe.face * 46;
        f.face = foe.x >= f.x ? 1 : -1;
        events.push({ type: 'sound', name: 'whoosh' });
      }
      // Cancel windows: light chain, heavy -> special
      if (a.phase !== 'startup' && a.key !== 'special') {
        if (a.move.chain && ctrl.consume('light')) {
          const next = getMove(f.def, a.move.chain);
          if (next) { startAttack(f, next, a.move.chain); events.push({ type: 'sound', name: 'whoosh' }); break; }
        }
        if (ctrl.consume('special') && f.meter >= SPECIAL_COST) {
          startSpecial(f, events);
          break;
        }
      }
      // Hit application during active frames
      if (a.phase === 'active') {
        if (a.key === 'throw') {
          if (a.t === 1) tryThrow(f, foe, events);
        } else if (a.hitsLanded < (a.move.hits || 1)) {
          const interval = Math.max(1, Math.floor(a.move.active / (a.move.hits || 1)));
          if (a.t >= a.nextHitAt) {
            a.nextHitAt += interval;
            tryHit(f, foe, a.move, events, a.hitsLanded > 0);
          }
        }
      }
      break;
    }
    case 'throw': {
      const a = f.attack;
      if (a) {
        a.t += 1;
        if (a.phase === 'startup' && a.t >= a.move.startup) { a.phase = 'active'; a.t = 0; }
        else if (a.phase === 'active') {
          if (a.t === 1) tryThrow(f, foe, events);
          if (a.t >= a.move.active) { a.phase = 'recovery'; a.t = 0; }
        } else if (a.phase === 'recovery' && a.t >= a.move.recovery) {
          f.attack = null; setState(f, 'idle');
        }
      } else setState(f, 'idle');
      break;
    }
    case 'hitstun':
    case 'blockstun': {
      if (f.stateT >= f.stunT) {
        f.vx = 0;
        setState(f, 'idle');
      }
      break;
    }
    case 'knockdown': {
      if (f.stateT >= f.stunT) { setState(f, 'wakeup'); }
      break;
    }
    case 'wakeup': {
      if (f.stateT >= 18) { f.invuln = WAKEUP_INVULN; setState(f, 'idle'); }
      break;
    }
    case 'parry': {
      if (f.stateT >= 12) setState(f, 'idle');
      break;
    }
    case 'ko':
    case 'victory': {
      f.vx = 0;
      break;
    }
    default: break;
  }

  // Physics
  if (f.y < VIEW.FLOOR || f.vy !== 0) {
    f.vy = Math.min(f.vy + PHYSICS.gravity, PHYSICS.maxFall);
    f.y += f.vy;
    if (f.y >= VIEW.FLOOR) {
      f.y = VIEW.FLOOR;
      const hard = f.vy > 8;
      f.vy = 0;
      if (f.state === 'jump' || (f.state === 'attack' && f.attack && (f.attack.key === 'airLight' || f.attack.key === 'airHeavy'))) {
        f.attack = null;
        setState(f, 'idle');
        events.push({ type: 'dust', x: f.x, y: f.y, n: hard ? 7 : 3 });
      }
    }
  }
  f.x += f.vx;
  if (f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || f.state === 'block') f.vx *= PHYSICS.friction;
  else f.vx *= 0.92;

  // Walls: clamp inside the arena, track wall contact for splats
  f.wall = 0;
  if (f.x < 40) { f.x = 40; f.wall = -1; }
  if (f.x > VIEW.W - 40) { f.x = VIEW.W - 40; f.wall = 1; }
}

function startSpecial(f, events) {
  const move = getSpecial(f.def);
  f.meter = 0;
  f.attack = { move, key: 'special', phase: 'startup', t: 0, hitsLanded: 0, nextHitAt: 0 };
  setState(f, 'special');
  events.push({ type: 'sound', name: 'special' });
  events.push({ type: 'flash', dur: 12 });
  events.push({ type: 'callout', text: `${f.def.name} — ${move.name.toUpperCase()}!`, color: f.def.accent });
}

function tryThrow(f, foe, events) {
  const dist = Math.abs(foe.x - f.x);
  const move = f.attack.move;
  if (dist > move.range + 20 || foe.airborne || foe.invuln > 0) return;
  // Throw tech: foe also throwing right now
  if (foe.state === 'throw' && foe.attack && foe.attack.phase !== 'recovery' && Math.abs((foe.throwAt || 0) - (f.throwAt || 0)) <= THROW_TECH_WINDOW + 10) {
    f.vx = -f.face * 5; foe.vx = -foe.face * 5;
    setState(f, 'idle'); setState(foe, 'idle');
    f.attack = null; foe.attack = null;
    events.push({ type: 'sound', name: 'clash' });
    events.push({ type: 'callout', text: 'THROW TECH!', color: '#9fc6e8' });
    return;
  }
  const dmg = move.dmg;
  foe.hp = Math.max(0, foe.hp - dmg);
  f.dmgDealt += dmg;
  foe.vx = f.face * 6; foe.vy = -6;
  setState(foe, 'knockdown'); foe.stunT = 46; foe.attack = null;
  f.attack.hitsLanded = 1;
  events.push({ type: 'sound', name: 'impactHeavy' });
  events.push({ type: 'hit', x: foe.x, y: foe.y - 80, heavy: true, dir: f.face });
  events.push({ type: 'callout', text: 'THROW!', color: '#e8c15a' });
  if (foe.hp <= 0) doKO(f, foe, events);
}

function tryHit(att, def, move, events, isMultiHit) {
  const hb = attackHitbox(att, move);
  const hurt = hurtbox(def);
  if (!rectsOverlap(hb, hurt)) return;
  if (def.invuln > 0 || def.state === 'ko') return;
  if (def.state === 'dodge') return; // i-frames

  const hx = def.x, hy = def.y - 80;
  const counter = def.state === 'attack' && def.attack && def.attack.phase === 'startup';
  let dmg = move.dmg;
  if (counter) dmg = Math.round(dmg * 1.25);
  // Combo scaling: each subsequent hit deals a little less
  if (att.combo > 0) dmg = Math.max(2, Math.round(dmg * Math.max(0.4, 1 - att.combo * 0.1)));
  dmg = Math.round(dmg * (att.dmgScale || 1));

  // Blocking?
  const isLow = move.height === 'low';
  const isHigh = move.height === 'high';
  const blocksLow = def.blocking && def.crouch;
  const blocksHigh = def.blocking && !def.crouch;
  const blocked = def.blocking && !isMultiHit
    && ((move.height === 'mid') || (isLow && blocksLow) || (isHigh && blocksHigh) || (!isLow && !isHigh && def.blocking));
  const lowBeatsStand = isLow && def.blocking && !def.crouch;
  const highBeatsCrouch = isHigh && def.blocking && def.crouch;

  if (blocked && !lowBeatsStand && !highBeatsCrouch) {
    // Parry: block began within the parry window
    if (att.frame - def.blockStartedAt <= PARRY_WINDOW && def.state === 'block') {
      att.state = 'hitstun'; att.stateT = 0; att.stunT = 30; att.attack = null; att.vx = 0;
      def.meter = Math.min(100, def.meter + 25);
      events.push({ type: 'sound', name: 'parry' });
      events.push({ type: 'hitstop', frames: HITSTOP.parry });
      events.push({ type: 'callout', text: 'PARRY!', color: '#ffffff' });
      events.push({ type: 'ring', x: hx, y: hy });
      events.push({ type: 'flash', dur: 6 });
      return;
    }
    const chip = Math.max(1, Math.round(dmg * 0.1));
    def.hp = Math.max(1, def.hp - chip);
    def.guard += dmg * 1.3;
    def.vx = att.face * move.push * 0.7;
    setState(def, 'blockstun'); def.stunT = 8 + Math.round(move.dmg * 0.4);
    att.meter = Math.min(100, att.meter + move.meter * 0.5);
    events.push({ type: 'sound', name: 'block' });
    events.push({ type: 'hitstop', frames: 2 });
    events.push({ type: 'hit', x: hx, y: hy, heavy: false, dir: att.face, blocked: true });
    if (def.guard >= 100) {
      def.guard = 0;
      setState(def, 'hitstun'); def.stunT = 46; def.vx = att.face * 4;
      events.push({ type: 'sound', name: 'impactHeavy' });
      events.push({ type: 'callout', text: 'GUARD BREAK!', color: '#eb3c32' });
      events.push({ type: 'hitstop', frames: 8 });
    }
    return;
  }

  // Clean hit
  def.hp = Math.max(0, def.hp - dmg);
  att.dmgDealt += dmg;
  att.combo += 1;
  att.comboT = COMBO_WINDOW;
  att.bestCombo = Math.max(att.bestCombo, att.combo);
  att.meter = Math.min(100, att.meter + move.meter);
  def.meter = Math.min(100, def.meter + move.meter * 0.4);
  def.flash = 5;
  const heavy = move.hitstop >= 6;
  events.push({ type: 'sound', name: heavy ? 'impactHeavy' : 'impactLight' });
  events.push({ type: 'hitstop', frames: move.hitstop });
  events.push({ type: 'hit', x: hx, y: hy, heavy, dir: att.face });
  if (move.key === 'special' || move.key === 'heavy' || move.key === 'lunge') {
    events.push({ type: 'slash', x: att.x + att.face * 40, y: att.y - 85, angle: att.face === 1 ? 0.4 : Math.PI - 0.4, range: move.range, color: att.def.accent });
  }
  if (counter) events.push({ type: 'callout', text: 'COUNTER!', color: '#ffd34d' });
  if (att.combo >= 3) events.push({ type: 'combo', who: att.side, count: att.combo });

  const stun = Math.round(12 + dmg * 0.8 + (heavy ? 6 : 0));
  def.vx = att.face * move.push * (heavy ? 1.4 : 1);
  if (move.launch) { def.vy = -7.5; setState(def, 'hitstun'); def.stunT = stun + 10; }
  else if (move.knockdown || def.hp <= 0) {
    def.vy = -5;
    setState(def, 'knockdown'); def.stunT = 52;
    events.push({ type: 'dust', x: def.x, y: def.y, n: 8 });
  } else {
    setState(def, 'hitstun'); def.stunT = stun;
  }
  // Wall splat: heavy hit while pressed against the wall
  if (heavy && def.wall !== 0) {
    def.stunT += 14;
    events.push({ type: 'ring', x: def.x, y: def.y - 80 });
    events.push({ type: 'callout', text: 'WALL SPLAT!', color: '#ff9a3d' });
  }
  if (def.hp <= 0) doKO(att, def, events);
  if (att.attack) att.attack.hitsLanded += 1;
}

function doKO(att, def, events) {
  setState(def, 'ko');
  def.attack = null;
  def.vx = att.face * 3;
  events.push({ type: 'sound', name: 'ko' });
  events.push({ type: 'hitstop', frames: HITSTOP.ko });
  events.push({ type: 'slowmo', frames: 50 });
  events.push({ type: 'ring', x: def.x, y: def.y - 60, max: 130 });
  events.push({ type: 'callout', text: 'K.O.!', color: '#eb3c32' });
  att.koBy = def.side;
}
