// Shadow Fight v2 — main orchestrator.
// Modes: Arcade Ladder, Versus CPU, Local 2-Player, Training Dojo.
// Owns the game state machine, rounds, camera, hitstop / slow-mo, the
// fixed-timestep loop, and turns combat events into sound, VFX and HUD.

import './styles/main.css';
import { VIEW, ROUND_TIME, ROUNDS_TO_WIN, LADDER, STAGES, DIFFS } from './config/config.js';
import { FIGHTERS, fighterById } from './fighters/fighters.js';
import { createLoop } from './engine/loop.js';
import { Controller, Keyboard } from './engine/input.js';
import { createFighter, resetFighter, updateFighter, hurtbox, attackHitbox } from './combat/combat.js';
import { AIController, DummyController } from './ai/ai.js';
import { drawStage } from './stages/stages.js';
import { drawFighter, updateCloth } from './animation/rig.js';
import { VFX } from './vfx/vfx.js';
import { AudioEngine } from './audio/audio.js';
import { UI } from './ui/ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const NO_INPUT = new Controller();

const audio = new AudioEngine();
const vfx = new VFX();
const game = {
  mode: null,
  phase: 'menu', // menu | intro | fight | roundEnd | matchEnd
  phaseT: 0,
  frame: 0,
  stage: 'street',
  diff: 'normal',
  p1def: FIGHTERS[0], p2def: FIGHTERS[1],
  p1: null, p2: null, c1: null, c2: null,
  round: 1, timerFrames: ROUND_TIME * 60,
  hitstop: 0, flash: 0, slowmo: 0, shake: 0,
  cam: { x: VIEW.W / 2, zoom: 1 },
  paused: false,
  selectStage: 'p1',
  arcadeIndex: 0, arcadeRoundsLost: 0,
  training: { dummy: 'stand', showHitboxes: false },
  showHitboxes: false,
  demo: null,
  lastHist: {},
};

// Persistent human controllers (keyboard + touch drive these)
const p1ctrl = new Controller();
const p2ctrl = new Controller();
const keyboard = new Keyboard(p1ctrl, p2ctrl,
  () => togglePause(),
  () => { if (game.mode === 'training') { game.showHitboxes = !game.showHitboxes; ui.toast(game.showHitboxes ? 'Hitbox overlay ON' : 'Hitbox overlay OFF'); } });

// Demo fighters idling behind the title screen
function makeDemo() {
  const a = createFighter(FIGHTERS[0], 0); a.x = 330; a.state = 'idle';
  const b = createFighter(FIGHTERS[1], 1); b.x = 630; b.state = 'idle';
  return { a, b };
}
game.demo = makeDemo();

// --- UI wiring ---------------------------------------------------------------
const ui = new UI({
  onPlay: () => { audio.ensure(); audio.uiClick(); ui.show('screen-mode'); },
  onMode: (mode) => {
    audio.ensure(); audio.uiClick();
    game.mode = mode;
    game.selectStage = 'p1';
    $('fighterTitle').textContent = 'CHOOSE YOUR FIGHTER';
    $('fighterSub').textContent = mode === 'local' ? 'Player 1 — pick a fighter' : 'Pick your fighter';
    ui.buildFighterCards(FIGHTERS, null, onFighterPick);
    ui.show('screen-fighter');
  },
  onFighterBack: () => ui.show('screen-mode'),
  onStageBack: () => {
    if (game.mode === 'arcade') ui.show('screen-fighter');
    else ui.show('screen-fighter');
  },
  onDiff: (d) => { game.diff = d; },
  onDummy: (d) => { game.training.dummy = d; },
  onStartFight: () => { audio.ensure(); startMatch(); },
  onTrainingStart: () => { audio.ensure(); startMatch(); },
  onTrainingBack: () => ui.show('screen-fighter'),
  onArcadeNext: () => { audio.ensure(); startArcadeFight(); },
  onRematch: () => { audio.ensure(); startMatch(); },
  onChangeFighter: () => {
    game.phase = 'menu';
    game.demo = makeDemo();
    ui.show('screen-mode');
  },
  onResume: () => togglePause(),
  onQuit: () => {
    game.paused = false;
    game.phase = 'menu';
    game.demo = makeDemo();
    ui.setInFight(false);
    ui.show('screen-title');
  },
});
ui.bindTouch(p1ctrl);

// Mute + volume controls (created here so they persist with the audio engine)
(function addSoundControls() {
  const title = document.getElementById('screen-title');
  const row = document.createElement('div');
  row.className = 'row';
  const muteBtn = document.createElement('button');
  muteBtn.className = 'ghost'; muteBtn.type = 'button';
  const syncMute = () => { muteBtn.textContent = audio.muted ? 'Sound: OFF' : 'Sound: ON'; };
  muteBtn.onclick = () => { audio.ensure(); audio.setMuted(!audio.muted); syncMute(); };
  const vol = document.createElement('input');
  vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.05; vol.value = String(audio.volume);
  vol.style.cssText = 'width:120px;align-self:center;';
  vol.title = 'Volume';
  vol.oninput = () => { audio.ensure(); audio.setVolume(parseFloat(vol.value)); };
  row.append(muteBtn, vol);
  title.appendChild(row);
})();

function onFighterPick(id) {
  audio.uiClick();
  const def = fighterById(id);
  if (game.selectStage === 'p1') {
    game.p1def = def;
    if (game.mode === 'versus' || game.mode === 'local') {
      game.selectStage = 'p2';
      $('fighterTitle').textContent = game.mode === 'local' ? 'PLAYER 2 — CHOOSE YOUR FIGHTER' : 'CHOOSE THE CPU FIGHTER';
      $('fighterSub').textContent = game.mode === 'local' ? 'Player 2 — pick a fighter' : 'The CPU will play this fighter';
      ui.buildFighterCards(FIGHTERS, null, onFighterPick);
      ui.showFighterDetail(def);
      return;
    }
    if (game.mode === 'arcade') {
      game.arcadeIndex = 0;
      game.arcadeRoundsLost = 0;
      ui.showLadder(LADDER, 0, [], 'ARCADE LADDER');
      return;
    }
    if (game.mode === 'training') {
      ui.show('screen-training');
      return;
    }
  } else {
    game.p2def = def;
    game.selectStage = 'p1';
    // Stage + difficulty select
    $('diffTitle').style.display = game.mode === 'local' ? 'none' : '';
    $('diffSeg').style.display = game.mode === 'local' ? 'none' : '';
    ui.buildStageSeg(STAGES, game.stage, (s) => { game.stage = s; });
    ui.show('screen-stage');
  }
}

function startArcadeFight() {
  const step = LADDER[game.arcadeIndex];
  game.p2def = fighterById(step.fighter);
  game.stage = step.stage;
  game.diff = step.diff;
  startMatch();
}

function startMatch() {
  game.p1 = createFighter(game.p1def, 0);
  game.p2 = createFighter(game.p2def, 1);
  game.c1 = p1ctrl;
  if (game.mode === 'local') game.c2 = p2ctrl;
  else if (game.mode === 'training') game.c2 = new DummyController(game.training.dummy);
  else game.c2 = new AIController(DIFFS[game.diff], game.p2def.id);
  game.p1.dmgScale = 1;
  game.p2.dmgScale = game.mode === 'local' ? 1 : DIFFS[game.diff].dmg;
  game.round = 1;
  game.hitstop = 0; game.flash = 0; game.slowmo = 0; game.shake = 0;
  game.paused = false;
  ui.setInFight(true);
  ui.setTrainingHud(game.mode === 'training');
  audio.startAmbience();
  startRound(1);
}

function startRound(n) {
  game.round = n;
  resetFighter(game.p1, 280, 1);
  resetFighter(game.p2, VIEW.W - 280, -1);
  game.timerFrames = ROUND_TIME * 60;
  game.phase = 'intro';
  game.phaseT = 0;
  ui.show(null);
  ui.setHudVisible(true);
  ui.setHUD(game.p1, game.p2, ROUND_TIME, `ROUND ${n}`);
  ui.banner(`ROUND ${n}`, 800);
}

function endRound(winner, reason) {
  const loser = winner === game.p1 ? game.p2 : game.p1;
  winner.roundsWon += 1;
  winner.state = 'victory'; winner.stateT = 0; winner.attack = null; winner.vx = 0;
  if (loser.state !== 'ko') { loser.state = 'knockdown'; loser.stateT = 0; loser.stunT = 90; loser.attack = null; }
  game.phase = 'roundEnd';
  game.phaseT = 0;
  if (reason === 'ko') ui.banner('K.O.!', 1200);
  else ui.banner('TIME UP', 1200);
  ui.setHUD(game.p1, game.p2, Math.ceil(game.timerFrames / 60), `ROUND ${game.round}`);
}

function endMatch() {
  game.phase = 'matchEnd';
  game.phaseT = 0;
  const playerWon = game.p1.roundsWon >= ROUNDS_TO_WIN;
  ui.setInFight(false);
  if (game.mode === 'arcade') {
    if (playerWon) {
      if (game.arcadeIndex >= LADDER.length - 1) {
        const rank = game.arcadeRoundsLost === 0 ? 'S' : game.arcadeRoundsLost === 1 ? 'A' : game.arcadeRoundsLost <= 3 ? 'B' : 'C';
        ui.showResult({
          title: 'ECLIPSE DEFEATED', sub: 'Arcade ladder complete. You are the Shadow Champion.',
          rounds: `${game.arcadeIndex + 1} fights`, combo: game.p1.bestCombo, dmg: game.p1.dmgDealt, rank,
        });
        return;
      }
      game.arcadeIndex += 1;
      ui.showLadder(LADDER, game.arcadeIndex, ['✓'], 'ARCADE LADDER');
      return;
    }
    game.arcadeRoundsLost += 1;
    ui.showResult({
      title: 'YOU LOSE', sub: `${game.p2def.name} takes this one. Rematch to climb again.`,
      rounds: `${game.round}`, combo: game.p1.bestCombo, dmg: game.p1.dmgDealt, rank: '—',
    });
    return;
  }
  const title = game.mode === 'training' ? 'SESSION OVER' : playerWon ? 'YOU WIN' : 'YOU LOSE';
  const sub = game.mode === 'local'
    ? (playerWon ? 'Player 1 takes the match.' : 'Player 2 takes the match.')
    : game.mode === 'training' ? 'Back to the dojo?' : playerWon ? `${game.p1def.name} defeats ${game.p2def.name}.` : `${game.p2def.name} defeats ${game.p1def.name}.`;
  ui.showResult({
    title, sub,
    rounds: `${game.round}`, combo: game.p1.bestCombo, dmg: game.p1.dmgDealt, rank: '—',
  });
}

function togglePause() {
  if (!['intro', 'fight', 'roundEnd'].includes(game.phase)) return;
  game.paused = !game.paused;
  if (game.paused) {
    ui.showMoveList(game.p1def);
    ui.show('screen-pause');
  } else {
    ui.show(null);
    ui.setHudVisible(true);
  }
}

// --- Events ------------------------------------------------------------------
function drainEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'sound':
        if (ev.name === 'impactLight') audio.impact('light');
        else if (ev.name === 'impactHeavy') audio.impact('heavy');
        else if (ev.name === 'whoosh') audio.whoosh();
        else if (ev.name === 'swingHeavy') audio.swingHeavy();
        else if (ev.name === 'block') audio.block();
        else if (ev.name === 'clash') audio.clash();
        else if (ev.name === 'parry') audio.parry();
        else if (ev.name === 'ko') audio.ko();
        else if (ev.name === 'special') audio.special();
        else if (ev.name === 'jump') audio.jump();
        else if (ev.name === 'dash') audio.whoosh(0.7);
        break;
      case 'hit':
        vfx.spawnHit(ev.x, ev.y, ev.dir, ev.heavy);
        game.shake = Math.max(game.shake, ev.heavy ? 6 : 2);
        break;
      case 'slash':
        vfx.spawnSlash(ev.x, ev.y, ev.angle, ev.range, ev.color);
        break;
      case 'ring':
        vfx.spawnRing(ev.x, ev.y, ev.max || 90);
        break;
      case 'dust':
        vfx.spawnDust(ev.x, ev.y, ev.n || 6);
        break;
      case 'hitstop':
        game.hitstop = Math.max(game.hitstop, ev.frames);
        break;
      case 'slowmo':
        game.slowmo = Math.max(game.slowmo, ev.frames);
        break;
      case 'flash':
        game.flash = Math.max(game.flash, ev.dur);
        break;
      case 'callout':
        ui.callout(ev.text, ev.color);
        break;
      case 'combo':
        ui.setCombo(ev.who, ev.count);
        break;
      default:
        break;
    }
  }
  events.length = 0;
}

// --- Fixed step ---------------------------------------------------------------
const events = [];

function step() {
  game.frame += 1;
  vfx.update();
  audio.tick();
  if (game.flash > 0) game.flash -= 1;
  if (game.shake > 0) game.shake *= 0.88;

  if (game.phase === 'menu') {
    // Attract mode: two fighters idling under the red moon.
    const d = game.demo;
    d.a.stateT += 1; d.b.stateT += 1;
    d.a.phase += 0.02; d.b.phase += 0.02;
    updateCloth(d.a); updateCloth(d.b);
    if (Math.random() < 0.002) vfx.spawnEmber(120 + Math.random() * 720, 440);
    return;
  }
  if (game.paused) return;
  game.phaseT += 1;

  if (game.phase === 'intro') {
    if (game.phaseT === 1) ui.banner(`ROUND ${game.round}`, 800);
    if (game.phaseT >= 70) {
      game.phase = 'fight';
      game.phaseT = 0;
      ui.banner('FIGHT!', 650);
      audio.roundStart();
    }
    updateFighter(game.p1, game.p2, NO_INPUT, events, game.frame, {});
    updateFighter(game.p2, game.p1, NO_INPUT, events, game.frame, {});
    drainEvents(events);
    return;
  }

  if (game.phase === 'roundEnd') {
    updateFighter(game.p1, game.p2, NO_INPUT, events, game.frame, {});
    updateFighter(game.p2, game.p1, NO_INPUT, events, game.frame, {});
    drainEvents(events);
    if (game.phaseT >= 110) {
      const p1Wins = game.p1.roundsWon >= ROUNDS_TO_WIN;
      const p2Wins = game.p2.roundsWon >= ROUNDS_TO_WIN;
      if (p1Wins || p2Wins) endMatch();
      else startRound(game.round + 1);
    }
    return;
  }

  if (game.phase !== 'fight') return;

  // Hitstop freezes the fighters (but not VFX).
  if (game.hitstop > 0) { game.hitstop -= 1; drainEvents(events); return; }
  // KO slow-mo: run fighter logic every 3rd tick.
  if (game.slowmo > 0) {
    game.slowmo -= 1;
    if (game.frame % 3 !== 0) { drainEvents(events); return; }
  }

  game.c1.tick();
  if (game.c2.tick) game.c2.tick();
  if (game.c2.update) game.c2.update(game.p2, game.p1, game.frame);
  if (game.mode === 'training') trackHistory();

  updateFighter(game.p1, game.p2, game.c1, events, game.frame, {});
  updateFighter(game.p2, game.p1, game.c2, events, game.frame, {});
  drainEvents(events);

  // Training: HP regen, infinite timer.
  if (game.mode === 'training') {
    for (const f of [game.p1, game.p2]) {
      if (f.state !== 'ko' && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + 0.35);
    }
  } else {
    game.timerFrames -= 1;
    if (game.timerFrames <= 0) {
      game.timerFrames = 0;
      const winner = game.p1.hp === game.p2.hp ? (game.p1.meter >= game.p2.meter ? game.p1 : game.p2) : game.p1.hp > game.p2.hp ? game.p1 : game.p2;
      endRound(winner, 'time');
      return;
    }
  }

  // Round end by KO
  if (game.p1.state === 'ko' || game.p2.state === 'ko') {
    const winner = game.p1.state === 'ko' ? game.p2 : game.p1;
    endRound(winner, 'ko');
    return;
  }

  // Camera + audio intensity
  const mid = (game.p1.x + game.p2.x) / 2;
  const dist = Math.abs(game.p1.x - game.p2.x);
  const targetZoom = Math.max(0.88, Math.min(1.12, 1.18 - dist / 1600));
  game.cam.x += (Math.max(240, Math.min(VIEW.W - 240, mid)) - game.cam.x) * 0.06;
  game.cam.zoom += (targetZoom - game.cam.zoom) * 0.06;
  const lowHp = 1 - Math.min(game.p1.hp / game.p1.maxHp, game.p2.hp / game.p2.maxHp);
  audio.intensity = Math.max(lowHp, game.round >= 3 ? 0.5 : 0);

  // HUD
  ui.setHUD(game.p1, game.p2, game.mode === 'training' ? Infinity : Math.ceil(game.timerFrames / 60), `ROUND ${game.round}`);
  if (game.mode === 'training') document.getElementById('timer').textContent = '∞';
  if (game.p1.combo < 2) ui.setCombo(0, 0);
  if (game.p2.combo < 2) ui.setCombo(1, 0);

  // Stage ambience particles
  if (game.stage === 'street' && Math.random() < 0.06) vfx.spawnEmber(100 + Math.random() * 760, 430 + Math.random() * 20);
  if (game.stage === 'lake' && Math.random() < 0.05) vfx.spawnMist(80 + Math.random() * 800, 440 + Math.random() * 40);
  if (game.stage === 'courtyard' && Math.random() < 0.04) vfx.spawnDust(120 + Math.random() * 720, 448, 1);
}

function trackHistory() {
  const names = { left: '◀', right: '▶', up: '▲', down: '▼', light: 'J', heavy: 'K', special: 'L', throw: 'U', dodge: 'ROLL' };
  for (const e of game.c1.buffer) {
    if ((game.lastHist[e.action] || -1) < e.frame) {
      game.lastHist[e.action] = e.frame;
      ui.pushHistory(names[e.action] || e.action);
    }
  }
}

// --- Render -------------------------------------------------------------------
function render() {
  ctx.clearRect(0, 0, VIEW.W, VIEW.H);
  const shX = game.shake > 0.5 ? (Math.random() - 0.5) * game.shake : 0;
  const shY = game.shake > 0.5 ? (Math.random() - 0.5) * game.shake : 0;

  ctx.save();
  if (game.phase === 'menu') {
    ctx.translate(0, 0);
    drawStage(ctx, 'street', game.frame);
    drawFighter(ctx, game.demo.a, game.frame);
    drawFighter(ctx, game.demo.b, game.frame);
  } else {
    const z = game.cam.zoom;
    ctx.translate(VIEW.W / 2 + shX, VIEW.H * 0.62 + shY);
    ctx.scale(z, z);
    ctx.translate(-game.cam.x, -VIEW.H * 0.62);
    drawStage(ctx, game.stage, game.frame);
    drawFighter(ctx, game.p1, game.frame);
    drawFighter(ctx, game.p2, game.frame);
    vfx.draw(ctx);
    if (game.showHitboxes && game.mode === 'training') drawHitboxes(ctx);
  }
  if (game.phase === 'menu') vfx.draw(ctx);
  ctx.restore();

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, game.flash / 14)})`;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  }
}

function drawHitboxes(c) {
  for (const f of [game.p1, game.p2]) {
    const hb = hurtbox(f);
    c.strokeStyle = 'rgba(80,255,120,0.9)'; c.lineWidth = 1.5;
    c.strokeRect(hb.x, hb.y, hb.w, hb.h);
    if (f.attack && f.attack.phase === 'active') {
      const ab = attackHitbox(f, f.attack.move);
      c.strokeStyle = 'rgba(255,60,50,0.9)';
      c.strokeRect(ab.x, ab.y, ab.w, ab.h);
    }
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.font = '11px monospace';
    c.fillText(f.state, f.x - 18, f.y - 130);
  }
}

// Boot: title screen over the attract-mode stage.
ui.show('screen-title');
createLoop(step, render).start();
