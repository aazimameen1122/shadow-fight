// 2D articulated silhouette rig. Fighters are drawn as tapered capsules and
// polygons (calves, thighs, torso, arms, head) — never stick lines — with
// warm-white rim light, glowing pill eyes and a per-fighter accent.
// Poses are computed per state from joint angles and interpolated with
// easing (anticipation on wind-up, ease-out on strikes, follow-through on
// recovery). Cloth (headband, cardigan hem, sash, scarf) is Verlet/spring
// points trailing the body.

import { easeOut, easeIn, easeInOut, lerp, clamp } from '../config/config.js';

const SKIN = '#0a0a0e'; // pitch-black silhouette
const SKIN_BACK = '#050508';
const RIM = '#f4f1ea';

function limb(ctx, x1, y1, x2, y2, w1, w2, color) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
  ctx.lineTo(x2 - nx * w2, y2 - ny * w2);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.arc(x1, y1, w1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x2, y2, w2, 0, Math.PI * 2); ctx.fill();
}

function rimStroke(ctx, pts, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

// Pose: joint angles in radians. Positive = forward (toward the foe).
// Arms: angle from straight-down. Legs: hip angle from straight-down,
// knee bends the shin backwards.
function poseFor(f, time) {
  const t = f.stateT;
  const p = { hipH: 78, lean: 0.08, head: 0, shF: 0.5, elF: 0.9, shB: -0.4, elB: 1.1, hipF: 0.22, kneeF: 0.25, hipB: -0.28, kneeB: 0.45, weapon: 0.4, crouch: 0 };
  const breathe = Math.sin(time * 0.06 + f.phase) * 0.03;
  const st = f.state;

  if (st === 'idle' || st === 'intro') {
    p.hipH = 78 + Math.sin(time * 0.06 + f.phase) * 2;
    p.lean = 0.08 + breathe;
    p.shF = 0.55 + breathe; p.elF = 0.95; p.shB = -0.35; p.elB = 1.05;
    p.hipF = 0.22; p.kneeF = 0.22; p.hipB = -0.28; p.kneeB = 0.5;
  } else if (st === 'walk') {
    const ph = f.walkPhase;
    p.hipF = 0.45 * Math.sin(ph); p.kneeF = Math.max(0.1, 0.5 * Math.max(0, Math.sin(ph + 1.2)));
    p.hipB = 0.45 * Math.sin(ph + Math.PI); p.kneeB = Math.max(0.1, 0.5 * Math.max(0, Math.sin(ph + Math.PI + 1.2)));
    p.shF = 0.5 + 0.25 * Math.sin(ph + Math.PI); p.shB = -0.35 + 0.25 * Math.sin(ph);
    p.lean = 0.14; p.hipH = 77 + Math.abs(Math.sin(ph)) * 1.5;
  } else if (st === 'dash' || st === 'backstep') {
    const dir = st === 'dash' ? 1 : -1;
    p.lean = 0.5 * dir; p.hipH = 72;
    p.hipF = 0.7 * dir; p.kneeF = 0.5; p.hipB = -0.5 * dir; p.kneeB = 0.9;
    p.shF = 0.9 * dir; p.elF = 0.5; p.shB = -0.6 * dir; p.elB = 0.7;
  } else if (st === 'jump') {
    p.hipH = 78; p.lean = f.vy < 0 ? 0.22 : 0.05;
    p.hipF = -0.85; p.kneeF = 1.7; p.hipB = -0.4; p.kneeB = 1.9;
    p.shF = -0.5; p.elF = 0.7; p.shB = 0.4; p.elB = 0.9;
  } else if (st === 'crouch' || st === 'block') {
    p.hipH = 54; p.lean = 0.32; p.crouch = 1;
    p.hipF = 0.9; p.kneeF = 1.5; p.hipB = -0.7; p.kneeB = 1.7;
    if (st === 'block') { p.shF = 1.15; p.elF = 1.5; p.shB = 0.7; p.elB = 1.6; p.lean = 0.18; }
    else { p.shF = 0.7; p.elF = 1.0; p.shB = -0.2; p.elB = 1.2; }
  } else if (st === 'parry') {
    p.hipH = 74; p.lean = 0.12;
    p.shF = 1.5; p.elF = 0.15; p.shB = -0.5; p.elB = 1.2; // front arm extended
    p.hipF = 0.3; p.kneeF = 0.4; p.hipB = -0.3; p.kneeB = 0.6;
  } else if (st === 'attack' && f.attack) {
    poseAttack(p, f);
  } else if (st === 'special' && f.attack) {
    poseSpecial(p, f);
  } else if (st === 'hitstun' || st === 'blockstun') {
    const shake = st === 'blockstun' ? Math.sin(t * 1.4) * 0.06 : 0;
    p.lean = -0.38 + shake; p.hipH = 76;
    p.shF = -0.9; p.elF = 0.5; p.shB = -1.1; p.elB = 0.6; p.head = -0.25;
    p.hipF = 0.1; p.kneeF = 0.35; p.hipB = -0.35; p.kneeB = 0.6;
  } else if (st === 'knockdown' || st === 'ko') {
    p.hipH = 13; p.lean = 1.35; p.head = 0.2;
    p.shF = 0.4; p.elF = 0.3; p.shB = -0.5; p.elB = 0.4;
    p.hipF = 1.15; p.kneeF = 0.25; p.hipB = 1.3; p.kneeB = 0.45;
  } else if (st === 'wakeup') {
    const k = clamp(t / 18, 0, 1);
    p.hipH = lerp(14, 56, easeOut(k)); p.lean = lerp(1.3, 0.3, easeOut(k));
    p.hipF = lerp(1.1, 0.85, k); p.kneeF = lerp(0.3, 1.4, k);
    p.hipB = lerp(1.25, -0.6, k); p.kneeB = lerp(0.4, 1.6, k);
  } else if (st === 'throw') {
    p.lean = 0.3; p.hipH = 74;
    p.shF = 1.35; p.elF = 0.1; p.shB = 1.1; p.elB = 0.25;
    p.hipF = 0.5; p.kneeF = 0.5; p.hipB = -0.4; p.kneeB = 0.7;
  } else if (st === 'dodge') {
    p.hipH = 30; p.lean = 1.0;
    p.hipF = 1.3; p.kneeF = 2.0; p.hipB = 1.1; p.kneeB = 2.0;
    p.shF = 0.9; p.elF = 1.8; p.shB = 0.7; p.elB = 1.8;
  } else if (st === 'victory') {
    const b = Math.sin(time * 0.08) * 0.08;
    p.lean = -0.12 + b; p.hipH = 78;
    p.shF = -2.4; p.elF = 0.15; p.shB = -0.5; p.elB = 0.9; // front arm raised
    p.hipF = 0.2; p.kneeF = 0.2; p.hipB = -0.25; p.kneeB = 0.45;
  }
  return p;
}

function poseAttack(p, f) {
  const a = f.attack;
  const key = a.key;
  const prog = a.phase === 'startup' ? a.t / a.move.startup : a.phase === 'active' ? 0.5 + (a.t / a.move.active) * 0.5 : 0.5 + (a.t / a.move.recovery) * 0.5;
  const wind = a.phase === 'startup' ? easeIn(clamp(a.t / a.move.startup, 0, 1)) : 1;
  const rec = a.phase === 'recovery' ? easeOut(clamp(a.t / a.move.recovery, 0, 1)) : 0;
  const ext = a.phase === 'active' ? 1 : a.phase === 'startup' ? 0.25 * wind : 1 - 0.7 * rec;
  void prog;

  if (key === 'light' || key === 'light2' || key === 'light3') {
    // fast straight punch / chop: arm snaps forward
    p.lean = 0.16 + 0.18 * ext; p.hipH = 76;
    p.shF = lerp(-0.6, 1.45, ext); p.elF = lerp(1.4, 0.12, ext);
    p.shB = -0.5; p.elB = 1.3;
    p.hipF = 0.35; p.kneeF = 0.35; p.hipB = -0.35; p.kneeB = 0.6;
    p.weapon = ext;
  } else if (key === 'heavy') {
    // big weapon slash: raise high, sweep down across
    p.lean = lerp(-0.15, 0.35, ext); p.hipH = 76;
    p.shF = lerp(-2.2, 1.2, ext); p.elF = lerp(0.4, 0.25, ext);
    p.shB = lerp(-1.6, 0.6, ext); p.elB = lerp(0.6, 0.4, ext);
    p.hipF = 0.4; p.kneeF = 0.4; p.hipB = -0.4; p.kneeB = 0.7;
    p.weapon = ext;
  } else if (key === 'low') {
    p.hipH = 56; p.lean = 0.3; p.crouch = 1;
    p.hipF = lerp(0.2, 1.25, ext); p.kneeF = lerp(1.2, 0.25, ext);
    p.hipB = -0.7; p.kneeB = 1.7;
    p.shF = 0.7; p.elF = 1.0; p.shB = -0.2; p.elB = 1.2;
  } else if (key === 'sweep') {
    p.hipH = 50; p.lean = 0.42; p.crouch = 1;
    p.hipF = lerp(-0.4, 1.5, ext); p.kneeF = lerp(1.6, 0.1, ext);
    p.hipB = -0.8; p.kneeB = 1.8;
    p.shF = -0.8; p.elF = 0.6; p.shB = 0.6; p.elB = 1.0;
  } else if (key === 'antiAir') {
    p.lean = lerp(0.35, -0.3, ext); p.hipH = lerp(56, 82, ext);
    p.shF = lerp(0.4, -2.3, ext); p.elF = lerp(1.2, 0.2, ext);
    p.shB = lerp(0.2, -1.4, ext); p.elB = lerp(1.0, 0.4, ext);
    p.hipF = 0.5; p.kneeF = 0.8; p.hipB = -0.5; p.kneeB = 1.0;
    p.weapon = ext;
  } else if (key === 'lunge') {
    p.lean = lerp(-0.1, 0.55, ext); p.hipH = 74;
    p.shF = lerp(-0.8, 1.5, ext); p.elF = lerp(1.3, 0.1, ext);
    p.hipF = lerp(0.2, 0.9, ext); p.kneeF = lerp(0.3, 0.4, ext);
    p.hipB = lerp(-0.3, -0.9, ext); p.kneeB = lerp(0.5, 1.1, ext);
    p.weapon = ext;
  } else if (key === 'airLight' || key === 'airHeavy') {
    p.hipH = 78; p.lean = 0.35;
    p.hipF = lerp(0.2, 1.3, ext); p.kneeF = lerp(0.5, 0.3, ext);
    p.hipB = -0.6; p.kneeB = 1.9;
    p.shF = lerp(-0.4, 1.4, ext); p.elF = lerp(1.0, 0.15, ext);
    p.weapon = ext;
  } else if (key === 'throw') {
    p.lean = 0.3; p.hipH = 74;
    p.shF = 1.35; p.elF = 0.1; p.shB = 1.1; p.elB = 0.25;
  }
}

function poseSpecial(p, f) {
  const a = f.attack;
  const id = f.def.id;
  const ph = a.phase;
  const k = ph === 'startup' ? clamp(a.t / a.move.startup, 0, 1) : ph === 'active' ? 1 : 1 - clamp(a.t / a.move.recovery, 0, 1);
  if (id === 'loop') {
    p.lean = lerp(-0.25, 0.4, k); p.hipH = 76;
    p.shF = lerp(-2.4, 1.3, easeOut(k)); p.elF = 0.2;
    p.shB = lerp(-1.8, 0.8, easeOut(k)); p.elB = 0.3;
  } else if (id === 'mentor') {
    p.lean = lerp(-0.2, 0.5, k); p.hipH = lerp(78, 60, k);
    p.shF = lerp(-2.5, 1.6, easeOut(k)); p.elF = 0.2;
    p.shB = lerp(-2.0, 1.2, easeOut(k)); p.elB = 0.3;
    p.hipF = 0.7; p.kneeF = 1.2; p.hipB = -0.6; p.kneeB = 1.5;
  } else if (id === 'sprinter') {
    p.lean = 0.3; p.hipH = 76;
    p.shF = lerp(-1.0, 1.6, k); p.elF = 0.15;
    p.shB = lerp(-0.8, 1.4, k); p.elB = 0.2;
    p.hipF = 0.6; p.kneeF = 0.5; p.hipB = -0.6; p.kneeB = 0.9;
  } else {
    p.lean = lerp(0.1, -0.35, k); p.hipH = 78;
    p.shF = lerp(0.3, -2.2, easeOut(k)); p.elF = 0.25;
    p.shB = lerp(-0.3, -2.0, easeOut(k)); p.elB = 0.25;
  }
  p.weapon = k;
}

// --- Cloth: simple Verlet ribbon anchored at the body -----------------------
export function initCloth(f) {
  const n = 7;
  f.cloth = [];
  for (let i = 0; i < n; i += 1) f.cloth.push({ x: f.x, y: f.y - 60, px: f.x, py: f.y - 60 });
}

export function updateCloth(f) {
  if (!f.cloth) initCloth(f);
  const anchor = clothAnchor(f);
  const pts = f.cloth;
  pts[0].x = anchor.x; pts[0].y = anchor.y; pts[0].px = anchor.x; pts[0].py = anchor.y;
  for (let i = 1; i < pts.length; i += 1) {
    const p = pts[i];
    const vx = (p.x - p.px) * 0.92, vy = (p.y - p.py) * 0.92;
    p.px = p.x; p.py = p.y;
    p.x += vx + (-f.face * 0.6) + (f.vx || 0) * -0.12;
    p.y += vy + 0.55;
  }
  for (let k = 0; k < 2; k += 1) {
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const diff = (d - 9) / d;
      if (i > 0) { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; }
      b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5;
    }
  }
}

function clothAnchor(f) {
  const p = poseFor(f, 0);
  void p;
  // Anchor at the neck for scarf/headband, at the waist for sash/cardigan.
  const kind = f.def.cloth;
  if (kind === 'sash') return { x: f.x - f.face * 6, y: f.y - 52 };
  if (kind === 'cardigan') return { x: f.x - f.face * 10, y: f.y - 66 };
  return { x: f.x - f.face * 4, y: f.y - 108 };
}

// --- Draw -------------------------------------------------------------------
export function drawFighter(ctx, f, time) {
  const face = f.face;
  const p = poseFor(f, time);
  const X = (lx) => f.x + lx * face;
  const hip = { x: f.x, y: f.y - p.hipH };
  const sh = { x: hip.x + Math.sin(p.lean) * 42 * face, y: hip.y - Math.cos(p.lean) * 42 };
  const head = { x: sh.x + Math.sin(p.lean + p.head) * 15 * face, y: sh.y - Math.cos(p.lean + p.head) * 15 };

  // Afterimages (Sprinter flurry / teleports)
  if (f.afterimages) {
    for (const g of f.afterimages) {
      ctx.globalAlpha = g.a * 0.35;
      ctx.fillStyle = f.def.accent;
      ctx.beginPath(); ctx.ellipse(g.x, f.y - 55, 16, 55, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Cloth ribbon behind the body
  if (f.cloth && f.cloth.length > 1) {
    ctx.strokeStyle = f.def.accent;
    ctx.globalAlpha = 0.85;
    ctx.lineCap = 'round';
    for (let i = 0; i < f.cloth.length - 1; i += 1) {
      ctx.lineWidth = Math.max(1, 7 - i);
      ctx.beginPath();
      ctx.moveTo(f.cloth[i].x, f.cloth[i].y);
      ctx.lineTo(f.cloth[i + 1].x, f.cloth[i + 1].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const seg = (a, len1, bend, len2) => {
    const jx = Math.sin(a) * len1, jy = Math.cos(a) * len1;
    const a2 = a - bend;
    const ex = jx + Math.sin(a2) * len2, ey = jy + Math.cos(a2) * len2;
    return { jx, jy, ex, ey };
  };

  // Back leg / back arm (darker)
  const backLeg = seg(p.hipB, 30, p.kneeB, 28);
  limb(ctx, hip.x, hip.y, hip.x + backLeg.jx * face, hip.y + backLeg.jy, 7, 5.5, SKIN_BACK);
  limb(ctx, hip.x + backLeg.jx * face, hip.y + backLeg.jy, hip.x + backLeg.ex * face, hip.y + backLeg.ey, 5.5, 4, SKIN_BACK);
  const shB = { a: p.lean + p.shB, el: p.elB };
  const bArm = seg(shB.a, 24, shB.el, 22);
  limb(ctx, sh.x, sh.y, sh.x + bArm.jx * face, sh.y + bArm.jy, 5.5, 4.5, SKIN_BACK);
  limb(ctx, sh.x + bArm.jx * face, sh.y + bArm.jy, sh.x + bArm.ex * face, sh.y + bArm.ey, 4.5, 3.5, SKIN_BACK);

  // Torso: tapered polygon hip -> shoulder
  const tw1 = 13, tw2 = 10;
  const nx = Math.cos(p.lean), ny = Math.sin(p.lean);
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.moveTo(hip.x - nx * tw1 * face, hip.y - ny * tw1);
  ctx.lineTo(sh.x - nx * tw2 * face, sh.y - ny * tw2);
  ctx.lineTo(sh.x + nx * tw2 * face, sh.y + ny * tw2);
  ctx.lineTo(hip.x + nx * tw1 * face, hip.y + ny * tw1);
  ctx.closePath(); ctx.fill();

  // Mentor sunhat + cardigan hint
  if (f.def.id === 'mentor') {
    ctx.fillStyle = '#e5dec9';
    ctx.beginPath(); ctx.ellipse(head.x, head.y - 9, 15, 4.5, -0.15 * face, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.ellipse(head.x, head.y - 12, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = f.def.accent;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.ellipse(hip.x, hip.y + 4, 15, 9, 0.3 * face, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Head
  ctx.fillStyle = SKIN;
  ctx.beginPath(); ctx.arc(head.x, head.y, 11, 0, Math.PI * 2); ctx.fill();
  // Rim light on the facing edge of head + torso
  rimStroke(ctx, [[head.x - 4 * face, head.y - 9], [head.x + 9 * face, head.y - 6], [head.x + 10 * face, head.y + 4]], RIM, 1.6);
  rimStroke(ctx, [[hip.x + 12 * face, hip.y + 2], [sh.x + 9 * face, sh.y - 2]], RIM, 1.6);
  // Pill eyes (glowing, face the foe)
  const eyeY = head.y - 1;
  ctx.fillStyle = '#fffbe8';
  ctx.shadowColor = RIM; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.ellipse(head.x + 3 * face, eyeY, 3.4, 4.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(head.x + 8 * face, eyeY, 2.6, 4.0, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Front leg
  const frontLeg = seg(p.hipF, 30, p.kneeF, 28);
  limb(ctx, hip.x, hip.y, hip.x + frontLeg.jx * face, hip.y + frontLeg.jy, 7.5, 6, SKIN);
  limb(ctx, hip.x + frontLeg.jx * face, hip.y + frontLeg.jy, hip.x + frontLeg.ex * face, hip.y + frontLeg.ey, 6, 4.5, SKIN);
  // Foot
  ctx.fillStyle = f.def.shoe;
  ctx.beginPath(); ctx.ellipse(hip.x + frontLeg.ex * face + 3 * face, hip.y + frontLeg.ey + 1, 8, 3.5, 0.08 * face, 0, Math.PI * 2); ctx.fill();

  // Front arm
  const fArm = seg(p.lean + p.shF, 24, p.elF, 22);
  limb(ctx, sh.x, sh.y, sh.x + fArm.jx * face, sh.y + fArm.jy, 6, 5, SKIN);
  limb(ctx, sh.x + fArm.jx * face, sh.y + fArm.jy, sh.x + fArm.ex * face, sh.y + fArm.ey, 5, 4, SKIN);
  const hand = { x: sh.x + fArm.ex * face, y: sh.y + fArm.ey };

  drawWeapon(ctx, f, hand, p, face);

  // Hit flash
  if (f.flash > 0) {
    ctx.globalAlpha = Math.min(0.7, f.flash / 6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(f.x, f.y - 55, 20, 55, p.lean * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawWeapon(ctx, f, hand, p, face) {
  const w = f.def.weapon;
  const ang = p.lean + p.shF + (p.weapon || 0) * 0.9;
  const hx = hand.x, hy = hand.y;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate((ang - 0.5) * face);
  ctx.fillStyle = '#101016';
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 1.4;
  if (w === 'blade') {
    ctx.beginPath();
    ctx.moveTo(0, -3); ctx.lineTo(46, -1.5); ctx.lineTo(52, 0); ctx.lineTo(46, 1.5); ctx.lineTo(0, 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (w === 'staff') {
    ctx.rotate(0.5 * face);
    ctx.fillRect(-34, -3, 84, 6);
    ctx.strokeRect(-34, -3, 84, 6);
    ctx.fillStyle = f.def.accent;
    ctx.fillRect(44, -3, 6, 6);
  } else if (w === 'sai') {
    ctx.beginPath();
    ctx.moveTo(0, -3); ctx.lineTo(26, -1); ctx.lineTo(30, 0); ctx.lineTo(26, 1); ctx.lineTo(0, 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.rotate(Math.PI * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, -2.5); ctx.lineTo(20, -0.8); ctx.lineTo(24, 0); ctx.lineTo(20, 0.8); ctx.lineTo(0, 2.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (w === 'phantom') {
    ctx.shadowColor = f.def.accent; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -3); ctx.quadraticCurveTo(24, -8, 46, 2); ctx.quadraticCurveTo(24, 2, 0, 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.rotate(Math.PI * 0.45);
    ctx.beginPath();
    ctx.moveTo(0, -3); ctx.quadraticCurveTo(22, -7, 42, 2); ctx.quadraticCurveTo(22, 2, 0, 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
