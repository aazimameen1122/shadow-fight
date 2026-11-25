// Tactical FSM AI. No input reading: the AI reacts only to what is visible
// (foe state, distance, attack phase) and only after a human reaction buffer
// (Easy ~22f, Normal ~13f, Hard ~7f). Personalities differ per fighter;
// Eclipse adapts to the player's habits (sweep spam -> block low / jump).

import { Controller } from '../engine/input.js';

const PERSONALITY = {
  loop: { dashCh: 0.25, throwCh: 0.15, sweepCh: 0.2, jumpCh: 0.15, pokeCh: 0.5 },
  mentor: { dashCh: 0.1, throwCh: 0.1, sweepCh: 0.3, jumpCh: 0.08, pokeCh: 0.65 },
  sprinter: { dashCh: 0.5, throwCh: 0.3, sweepCh: 0.35, jumpCh: 0.3, pokeCh: 0.35 },
  eclipse: { dashCh: 0.35, throwCh: 0.25, sweepCh: 0.3, jumpCh: 0.25, pokeCh: 0.5 },
};

export class AIController extends Controller {
  constructor(diff, fighterId) {
    super();
    this.diff = diff;
    this.personality = PERSONALITY[fighterId] || PERSONALITY.loop;
    this.fsm = 'NEUTRAL_FOOTSIES';
    this.nextThink = 0;
    this.sweepsSeen = 0;
    this.foeLowStreak = 0;
  }

  _toward(f, foe) { return foe.x >= f.x ? 'right' : 'left'; }
  _away(f, foe) { return foe.x >= f.x ? 'left' : 'right'; }

  _holdDir(dir) {
    this.heldSet.delete('left'); this.heldSet.delete('right');
    if (dir) this.heldSet.add(dir);
  }

  _press(action) { this.press(action); }

  update(f, foe, frame) {
    // Track player habits (Eclipse adaptation): repeated low attacks.
    if (foe.attack && foe.attack.key === 'low') this.foeLowStreak += 1;
    else if (foe.state !== 'attack') this.foeLowStreak = Math.max(0, this.foeLowStreak - 1);

    const inNeutral = ['idle', 'walk', 'crouch', 'block'].includes(f.state);
    if (!inNeutral) return;
    if (frame < this.nextThink) return;
    this.nextThink = frame + this.diff.think + Math.floor(Math.random() * 6);

    const dist = Math.abs(foe.x - f.x);
    const foeAttacking = foe.state === 'attack' || foe.state === 'special';
    const foeRecovering = foe.state === 'attack' && foe.attack && foe.attack.phase === 'recovery';
    const foeAirborne = foe.airborne || foe.state === 'jump';
    const p = this.personality;
    const r = Math.random();

    // --- choose FSM state
    if (foeAirborne && dist < 170 && r < 0.7) this.fsm = 'ANTI_AIR';
    else if (foeAttacking && dist < 130 && r < this.diff.blockCh + 0.35) this.fsm = 'DEFEND_REACTIVE';
    else if (foeRecovering && dist < 130) this.fsm = 'WHIFF_PUNISH';
    else if (dist > 190) this.fsm = Math.random() < this.diff.aggro ? 'APPROACH' : 'NEUTRAL_FOOTSIES';
    else if (dist < 70 && f.hp < 30) this.fsm = 'RETREAT_RESET';
    else if (dist < 110) this.fsm = 'PRESSURE_COMBO';
    else this.fsm = 'NEUTRAL_FOOTSIES';

    // --- act on the state
    switch (this.fsm) {
      case 'ANTI_AIR': {
        this._holdDir(null);
        this.heldSet.add('up');
        this._press('heavy');
        this.heldSet.delete('up');
        break;
      }
      case 'DEFEND_REACTIVE': {
        // Eclipse adapts: if the player spams lows, crouch-block instead.
        const adaptLow = f.def.id === 'eclipse' && this.foeLowStreak >= 2;
        this._holdDir(this._away(f, foe));
        if (adaptLow || r < 0.3) this.heldSet.add('down');
        break;
      }
      case 'WHIFF_PUNISH': {
        this._holdDir(this._toward(f, foe));
        if (r < 0.5) this._press('heavy');
        else this._press('light');
        break;
      }
      case 'APPROACH': {
        this._holdDir(this._toward(f, foe));
        if (r < p.dashCh) this.dashQueued = this._toward(f, foe);
        if (dist < 200 && r < 0.2) { this.heldSet.add('up'); this._press('up'); this.heldSet.delete('up'); }
        break;
      }
      case 'PRESSURE_COMBO': {
        this._holdDir(null);
        if (dist < 55 && r < p.throwCh) { this._press('throw'); break; }
        if (r < p.sweepCh && foe.blocking) { this.heldSet.add('down'); this._press('heavy'); this.heldSet.delete('down'); break; }
        if (f.meter >= 100 && r < 0.6) { this._press('special'); break; }
        if (r < 0.55) this._press('light');
        else if (r < 0.8) this._press('heavy');
        else { this._holdDir(this._away(f, foe)); }
        break;
      }
      case 'RETREAT_RESET': {
        this._holdDir(this._away(f, foe));
        if (r < 0.4) this.dashQueued = this._away(f, foe);
        break;
      }
      default: { // NEUTRAL_FOOTSIES
        if (dist > 150) {
          this._holdDir(r < 0.6 ? this._toward(f, foe) : this._away(f, foe));
        } else if (dist < 90 && r < p.pokeCh) {
          this._holdDir(null);
          this._press('light');
        } else {
          this._holdDir(r < 0.5 ? this._toward(f, foe) : null);
        }
        break;
      }
    }
  }
}

// Training dummy: stands, crouches, blocks or attacks on a loop.
export class DummyController extends Controller {
  constructor(behavior = 'stand') {
    super();
    this.behavior = behavior;
    this._t = 0;
  }

  update(f, foe, frame) {
    this._t += 1;
    this.heldSet.delete('left'); this.heldSet.delete('right'); this.heldSet.delete('down');
    if (this.behavior === 'crouch') this.heldSet.add('down');
    if (this.behavior === 'block') this.heldSet.add(foe.x >= f.x ? 'left' : 'right');
    if (this.behavior === 'attack' && this._t % 50 === 0 && ['idle', 'walk'].includes(f.state)) {
      this.press('light');
    }
    void frame;
  }
}
