// DOM UI: menus, HUD, callouts, touch controls, move list, arcade ladder.
// The game itself renders on canvas; everything the player clicks or reads
// as text lives here. Callbacks are wired by main.js.

import { fighterById } from '../fighters/fighters.js';
import { createFighter } from '../combat/combat.js';
import { drawFighter } from '../animation/rig.js';

const $ = (id) => document.getElementById(id);

const MOVE_ROWS = [
  ['Light chain', 'J → J → J', 'Fast 3-hit string. Chains into Heavy.'],
  ['Heavy slash', 'K', 'High-damage weapon strike.'],
  ['Low kick', 'Down + J', 'Fast low. Beats standing guard.'],
  ['Sweep', 'Down + K', 'Low leg sweep. Hard knockdown.'],
  ['Anti-air', 'Up + K', 'Rising strike. Launches jump-ins.'],
  ['Lunge', 'Forward + K', 'Advancing gap-closer.'],
  ['Air knee', 'Air + J', 'Fast jumping knee.'],
  ['Dive strike', 'Air + K', 'Overhead. Beats crouching guard.'],
  ['Throw', 'U', 'Unblockable grab. Breaks blockers.'],
  ['Dodge roll', 'Space / I', 'Brief invincibility. Costs a short cooldown.'],
  ['Shadow Special', 'L (full meter)', 'Unique cinematic super.'],
  ['Parry', 'Tap Back just before impact', 'Zero damage, stuns the attacker.'],
  ['Block', 'Hold Away / Down+Away', 'Blocks mids & highs / lows. Fills Guard gauge.'],
];

export class UI {
  constructor(cb) {
    this.cb = cb;
    this._bind();
  }

  _bind() {
    $('btnPlay').onclick = () => { this.cb.onPlay(); };
    $('btnHow').onclick = () => { this.show('screen-how'); };
    $('btnHowBack').onclick = () => { this.show('screen-title'); };
    $('btnModeBack').onclick = () => { this.show('screen-title'); };
    $('btnFighterBack').onclick = () => { this.cb.onFighterBack(); };
    $('btnStageBack').onclick = () => { this.cb.onStageBack(); };
    $('btnStartFight').onclick = () => { this.cb.onStartFight(); };
    $('btnTrainingStart').onclick = () => { this.cb.onTrainingStart(); };
    $('btnTrainingBack').onclick = () => { this.cb.onTrainingBack(); };
    $('btnArcadeNext').onclick = () => { this.cb.onArcadeNext(); };
    $('btnRematch').onclick = () => { this.cb.onRematch(); };
    $('btnChange').onclick = () => { this.cb.onChangeFighter(); };
    $('btnResume').onclick = () => { this.cb.onResume(); };
    $('btnQuit').onclick = () => { this.cb.onQuit(); };
    document.querySelectorAll('#screen-mode .mode-card').forEach((b) => {
      b.onclick = () => this.cb.onMode(b.dataset.mode);
    });
    document.querySelectorAll('#diffSeg button').forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll('#diffSeg button').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        this.cb.onDiff(b.dataset.diff);
      };
    });
    document.querySelectorAll('#dummySeg button').forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll('#dummySeg button').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        this.cb.onDummy(b.dataset.dummy);
      };
    });
  }

  show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
    if (id) $(id).classList.remove('hidden');
    $('hud').classList.toggle('hidden', id !== null);
  }

  setHudVisible(v) { $('hud').classList.toggle('hidden', !v); }

  buildFighterCards(fighters, lockedIds, onPick) {
    const wrap = $('fighterCards');
    wrap.innerHTML = '';
    for (const def of fighters) {
      const locked = lockedIds && lockedIds.has(def.id);
      const card = document.createElement('button');
      card.className = 'card' + (locked ? ' locked' : '');
      card.type = 'button';
      card.disabled = !!locked;
      const face = document.createElement('div');
      face.className = 'face';
      const cv = document.createElement('canvas');
      cv.width = 120; cv.height = 92;
      face.appendChild(cv);
      const name = document.createElement('b');
      name.textContent = def.name;
      const style = document.createElement('span');
      style.className = 'style';
      style.textContent = `${def.style} · ${def.weapon}`;
      const stats = document.createElement('div');
      stats.className = 'stats';
      for (const [k, v] of Object.entries(def.stats)) {
        const row = document.createElement('div');
        row.className = 'stat';
        row.innerHTML = `<span>${k}</span><span class="track"><i style="width:${v * 10}%"></i></span>`;
        stats.appendChild(row);
      }
      card.append(face, name, style, stats);
      card.onclick = () => onPick(def.id);
      card.onmouseenter = () => this.showFighterDetail(def);
      card.onfocus = () => this.showFighterDetail(def);
      wrap.appendChild(card);
      // Portrait snapshot via the real rig
      const f = createFighter(def, 0);
      f.x = 60; f.y = 92; f.state = 'idle'; f.stateT = 30;
      const ctx = cv.getContext('2d');
      ctx.translate(0, 0);
      drawFighter(ctx, f, 30);
      if (def.id === 'eclipse') {
        const lock = document.createElement('div');
        lock.className = 'boss-tag';
        lock.textContent = 'BOSS';
        face.appendChild(lock);
      }
    }
    this.showFighterDetail(fighters[0]);
  }

  showFighterDetail(def) {
    const el = $('fighterDetail');
    const sp = def.special;
    el.innerHTML = `<b style="color:${def.accent}">${def.name}</b> — ${def.desc} <span class="fine">Special: <b>${sp.name}</b> — ${sp.desc}</span>`;
  }

  buildStageSeg(stages, selected, onPick) {
    const seg = $('stageSeg');
    seg.innerHTML = '';
    for (const s of stages) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.name;
      if (s.id === selected) b.classList.add('sel');
      b.onclick = () => {
        seg.querySelectorAll('button').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        onPick(s.id);
      };
      seg.appendChild(b);
    }
  }

  setHUD(p1, p2, timerSec, roundLabel) {
    $('name1').textContent = p1.def.name;
    $('style1').textContent = p1.def.style;
    $('name2').textContent = p2.def.name;
    $('style2').textContent = p2.def.style;
    $('hp1').style.width = `${Math.max(0, (p1.hp / p1.maxHp) * 100)}%`;
    $('hpDelay1').style.width = `${Math.max(0, (p1.hp / p1.maxHp) * 100)}%`;
    $('hp2').style.width = `${Math.max(0, (p2.hp / p2.maxHp) * 100)}%`;
    $('hpDelay2').style.width = `${Math.max(0, (p2.hp / p2.maxHp) * 100)}%`;
    $('meter1').style.width = `${p1.meter}%`;
    $('meter2').style.width = `${p2.meter}%`;
    $('meter1').parentElement.classList.toggle('full', p1.meter >= 100);
    $('meter2').parentElement.classList.toggle('full', p2.meter >= 100);
    $('guard1').style.width = `${p1.guard}%`;
    $('guard2').style.width = `${p2.guard}%`;
    $('timer').textContent = Math.max(0, timerSec);
    $('timer').classList.toggle('low', timerSec <= 10);
    $('roundLabel').textContent = roundLabel;
    const pips = $('pips');
    pips.innerHTML = '';
    for (let i = 0; i < 2; i += 1) {
      const d = document.createElement('div');
      d.className = 'pip' + (i < p1.roundsWon ? ' won' : '');
      pips.appendChild(d);
    }
    for (let i = 0; i < 2; i += 1) {
      const d = document.createElement('div');
      d.className = 'pip' + (i < p2.roundsWon ? ' won p2' : '');
      pips.appendChild(d);
    }
  }

  setCombo(side, count) {
    const el = side === 0 ? $('comboL') : $('comboR');
    if (count >= 2) {
      el.textContent = `${count} HITS`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  callout(text, color) {
    const el = $('callout');
    el.textContent = text;
    el.style.color = color || '#ffd34d';
    el.classList.remove('hidden', 'pop');
    void el.offsetWidth;
    el.classList.add('pop');
    clearTimeout(this._calloutT);
    this._calloutT = setTimeout(() => el.classList.add('hidden'), 900);
  }

  banner(text, ms = 900) {
    const el = $('banner');
    el.textContent = text;
    el.classList.remove('hidden', 'pop');
    void el.offsetWidth;
    el.classList.add('pop');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => el.classList.add('hidden'), ms);
  }

  toast(msg, ms = 2600) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.add('hidden'), ms);
  }

  showResult({ title, sub, rounds, combo, dmg, rank }) {
    $('resultTitle').textContent = title;
    $('resultSub').textContent = sub;
    $('statRounds').textContent = rounds;
    $('statCombo').textContent = combo;
    $('statDmg').textContent = dmg;
    $('statRank').textContent = rank || '—';
    this.show('screen-result');
  }

  showLadder(ladder, idx, results, title) {
    $('arcadeTitle').textContent = title || 'ARCADE LADDER';
    const list = $('ladderList');
    list.innerHTML = '';
    ladder.forEach((step, i) => {
      const row = document.createElement('div');
      row.className = 'ladder-row' + (i === idx ? ' current' : i < idx ? ' done' : '');
      const foe = fighterById(step.fighter);
      const stageName = { street: 'Rooftop Street', lake: 'Moonlit Lake', courtyard: 'Old Courtyard' }[step.stage];
      row.innerHTML = `<span class="ladder-num">${i + 1}</span><b>${foe.name}</b><span>${stageName} · ${step.diff}</span><span>${i < idx ? (results[i] || '✓') : i === idx ? 'NEXT' : ''}</span>`;
      list.appendChild(row);
    });
    $('btnArcadeNext').textContent = idx === 0 ? 'START LADDER' : 'NEXT FIGHT';
    this.show('screen-arcade');
  }

  showMoveList(def) {
    const el = $('moveList');
    const sp = def.special;
    el.innerHTML = `<h3>${def.name} — ${def.style} · Special: ${sp.name}</h3>` +
      MOVE_ROWS.map(([n, k, d]) => `<div class="mv"><span class="mv-name">${n}</span><kbd>${k}</kbd><span class="mv-desc">${d}</span></div>`).join('');
  }

  setTrainingHud(v) {
    $('inputHistory').classList.toggle('hidden', !v);
  }

  pushHistory(label) {
    const el = $('inputHistory');
    const d = document.createElement('div');
    d.textContent = label;
    el.prepend(d);
    while (el.children.length > 8) el.removeChild(el.lastChild);
  }

  // Touch controls: joystick drives held directions, buttons press actions.
  // Only shown on coarse pointers / narrow screens, during fights.
  bindTouch(controller) {
    const touch = $('touch');
    const show = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
      touch.classList.toggle('hidden', !(coarse && this._inFight));
    };
    this._touchShow = show;
    const joy = $('joy');
    const knob = $('joyKnob');
    let joyId = null;
    const setDir = (dx, dy) => {
      controller.heldSet.delete('left'); controller.heldSet.delete('right');
      controller.heldSet.delete('up'); controller.heldSet.delete('down');
      if (dx < -18) controller.heldSet.add('left');
      if (dx > 18) controller.heldSet.add('right');
      if (dy < -18) controller.down('up');
      if (dy > 22) controller.heldSet.add('down');
      knob.style.transform = `translate(${Math.max(-26, Math.min(26, dx))}px, ${Math.max(-26, Math.min(26, dy))}px)`;
    };
    joy.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId;
      joy.setPointerCapture(joyId);
      const r = joy.getBoundingClientRect();
      setDir(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyId) return;
      const r = joy.getBoundingClientRect();
      setDir(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    });
    const endJoy = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      controller.heldSet.delete('left'); controller.heldSet.delete('right');
      controller.heldSet.delete('up'); controller.heldSet.delete('down');
      knob.style.transform = 'translate(0,0)';
    };
    joy.addEventListener('pointerup', endJoy);
    joy.addEventListener('pointercancel', endJoy);
    document.querySelectorAll('#touchBtns .tbtn').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); controller.down(b.dataset.act); });
      b.addEventListener('pointerup', () => controller.up(b.dataset.act));
      b.addEventListener('pointercancel', () => controller.up(b.dataset.act));
      b.addEventListener('pointerleave', () => controller.up(b.dataset.act));
    });
    show();
    window.addEventListener('resize', show);
  }

  setInFight(v) {
    this._inFight = v;
    if (this._touchShow) this._touchShow();
  }
}
