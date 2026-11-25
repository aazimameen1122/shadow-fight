// Multi-layer parallax arenas. Each stage draws a far layer, a mid layer and
// a near layer in world coordinates; the camera (midpoint + zoom, owned by
// main.js) provides the parallax through the canvas transform. Decorative
// elements are generated once with a seeded RNG so the stage is stable.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sky(ctx, top, mid, bot) {
  const g = ctx.createLinearGradient(0, -220, 0, 540);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(-700, -260, 2400, 820);
}

function moon(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 3.2);
  g.addColorStop(0, 'rgba(235,60,50,0.5)');
  g.addColorStop(0.4, 'rgba(235,60,50,0.14)');
  g.addColorStop(1, 'rgba(235,60,50,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9382b';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(120,20,16,0.55)';
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.13, 0, Math.PI * 2); ctx.fill();
}

function stars(ctx, rng, n, yMax) {
  ctx.fillStyle = 'rgba(244,241,234,0.8)';
  for (let i = 0; i < n; i += 1) {
    const x = -600 + rng() * 2200, y = -220 + rng() * yMax, r = 0.6 + rng() * 1.3;
    ctx.globalAlpha = 0.25 + rng() * 0.55;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Rooftop Street: layered midnight skyline, lit windows, chinar tree, embers.
const streetBuildingsFar = [];
const streetBuildingsMid = [];
{
  const rng = mulberry32(11);
  let x = -600;
  while (x < 1700) { const w = 50 + rng() * 90, h = 120 + rng() * 190; streetBuildingsFar.push({ x, w, h }); x += w + 8 + rng() * 30; }
  x = -600;
  while (x < 1700) { const w = 60 + rng() * 80, h = 70 + rng() * 130; streetBuildingsMid.push({ x, w, h, lit: Array.from({ length: 12 }, () => rng() < 0.4) }); x += w + 14 + rng() * 40; }
}

function drawStreet(ctx, t) {
  sky(ctx, '#07070f', '#160d1d', '#241019');
  stars(ctx, mulberry32(7), 70, 200);
  moon(ctx, 690, 30, 52);
  // far skyline
  ctx.fillStyle = '#0d0a18';
  for (const b of streetBuildingsFar) ctx.fillRect(b.x, 452 - b.h, b.w, b.h);
  // mid skyline with lit windows
  for (const b of streetBuildingsMid) {
    ctx.fillStyle = '#120e20';
    ctx.fillRect(b.x, 452 - b.h, b.w, b.h);
    b.lit.forEach((on, i) => {
      if (!on) return;
      ctx.fillStyle = 'rgba(255,196,90,0.75)';
      ctx.fillRect(b.x + 8 + (i % 3) * 18, 452 - b.h + 14 + Math.floor(i / 3) * 24, 8, 10);
    });
  }
  // chinar tree silhouette (right)
  ctx.strokeStyle = '#08060f';
  ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(880, 452); ctx.quadraticCurveTo(860, 330, 900, 250); ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(885, 320); ctx.quadraticCurveTo(830, 280, 800, 240); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(890, 300); ctx.quadraticCurveTo(940, 260, 970, 220); ctx.stroke();
  ctx.fillStyle = '#0a0714';
  for (const [lx, ly, lr] of [[820, 235, 34], [860, 210, 40], [905, 225, 36], [950, 215, 30], [880, 190, 34]]) {
    ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
  }
  // rooftop floor + warm edge light
  ctx.fillStyle = '#0e0c16';
  ctx.fillRect(-700, 452, 2400, 90);
  ctx.fillStyle = 'rgba(255,170,80,0.16)';
  ctx.fillRect(-700, 452, 2400, 3);
  void t;
}

// Moonlit Lake: mountains, red moon reflection, water ripples, shikara.
function drawLake(ctx, t) {
  sky(ctx, '#06060f', '#120a1c', '#1c0f22');
  stars(ctx, mulberry32(21), 80, 190);
  moon(ctx, 480, 10, 58);
  // mountains
  ctx.fillStyle = '#0c0916';
  ctx.beginPath(); ctx.moveTo(-700, 452); ctx.lineTo(-400, 200); ctx.lineTo(-100, 452); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-200, 452); ctx.lineTo(150, 150); ctx.lineTo(520, 452); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#100b1e';
  ctx.beginPath(); ctx.moveTo(300, 452); ctx.lineTo(700, 230); ctx.lineTo(1100, 452); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(900, 452); ctx.lineTo(1250, 180); ctx.lineTo(1700, 452); ctx.closePath(); ctx.fill();
  // water
  const g = ctx.createLinearGradient(0, 452, 0, 540);
  g.addColorStop(0, '#160d24'); g.addColorStop(1, '#05060c');
  ctx.fillStyle = g;
  ctx.fillRect(-700, 452, 2400, 90);
  // moon reflection shimmer
  for (let i = 0; i < 7; i += 1) {
    const w = 60 + i * 26 + Math.sin(t * 0.05 + i) * 8;
    ctx.fillStyle = `rgba(217,56,43,${0.20 - i * 0.02})`;
    ctx.fillRect(480 - w / 2, 458 + i * 10, w, 4);
  }
  // ripples
  ctx.strokeStyle = 'rgba(160,180,220,0.16)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i += 1) {
    const y = 470 + i * 13;
    ctx.beginPath();
    for (let x = -600; x <= 1600; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 0.04 + i) * 2.5);
    ctx.stroke();
  }
  // shikara + houseboat silhouettes
  ctx.fillStyle = '#08060f';
  ctx.beginPath(); ctx.moveTo(150, 470); ctx.lineTo(260, 470); ctx.lineTo(235, 486); ctx.lineTo(175, 486); ctx.closePath(); ctx.fill();
  ctx.fillRect(196, 446, 4, 26); ctx.beginPath(); ctx.moveTo(200, 446); ctx.lineTo(228, 462); ctx.lineTo(200, 462); ctx.closePath(); ctx.fill();
  ctx.fillRect(700, 462, 150, 18);
  ctx.beginPath(); ctx.moveTo(700, 462); ctx.lineTo(715, 438); ctx.lineTo(835, 438); ctx.lineTo(850, 462); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,196,90,0.7)';
  for (const wx of [730, 760, 790, 820]) ctx.fillRect(wx, 446, 7, 9);
  // overhanging chinar branches (top corners)
  ctx.strokeStyle = '#08060f'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-20, -30); ctx.quadraticCurveTo(120, 30, 210, 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(980, -30); ctx.quadraticCurveTo(860, 40, 760, 14); ctx.stroke();
  ctx.fillStyle = '#0a0714';
  for (const [lx, ly, lr] of [[120, 26, 30], [180, 12, 26], [860, 30, 30], [800, 16, 26]]) {
    ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
  }
}

// Old Courtyard: haveli arches, lanterns, khatamband border, stone floor.
function drawCourtyard(ctx, t) {
  sky(ctx, '#07070f', '#150d1c', '#221019');
  stars(ctx, mulberry32(33), 50, 160);
  moon(ctx, 480, -10, 46);
  // haveli wall + arches
  ctx.fillStyle = '#100b18';
  ctx.fillRect(-700, 60, 2400, 392);
  for (const ax of [-500, -200, 100, 400, 700, 1000, 1300]) {
    ctx.fillStyle = '#0a0712';
    ctx.beginPath();
    ctx.moveTo(ax, 452); ctx.lineTo(ax, 200); ctx.quadraticCurveTo(ax + 70, 90, ax + 140, 200); ctx.lineTo(ax + 140, 452);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,196,90,0.35)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax + 8, 452); ctx.lineTo(ax + 8, 204); ctx.quadraticCurveTo(ax + 70, 102, ax + 132, 204); ctx.lineTo(ax + 132, 452);
    ctx.stroke();
  }
  // khatamband geometric border
  ctx.fillStyle = '#171022';
  ctx.fillRect(-700, 60, 2400, 34);
  ctx.strokeStyle = 'rgba(232,193,90,0.5)'; ctx.lineWidth = 1.5;
  for (let x = -700; x < 1700; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x + 14, 64); ctx.lineTo(x + 24, 77); ctx.lineTo(x + 14, 90); ctx.lineTo(x + 4, 77);
    ctx.closePath(); ctx.stroke();
  }
  // hanging lanterns (sway gently)
  for (const [lx, len] of [[-260, 70], [60, 90], [420, 64], [760, 88], [1080, 70]]) {
    const sway = Math.sin(t * 0.02 + lx) * 4;
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, 94); ctx.lineTo(lx + sway, 94 + len); ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.shadowColor = '#ff9a3d'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.ellipse(lx + sway, 94 + len + 10, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  // stone floor with moon reflection
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(-700, 452, 2400, 90);
  ctx.fillStyle = 'rgba(217,56,43,0.10)';
  ctx.fillRect(420, 452, 120, 88);
  ctx.strokeStyle = 'rgba(244,241,234,0.07)';
  ctx.lineWidth = 1;
  for (let x = -700; x < 1700; x += 90) { ctx.beginPath(); ctx.moveTo(x, 452); ctx.lineTo(x - 30, 540); ctx.stroke(); }
  void t;
}

export const STAGE_DRAW = { street: drawStreet, lake: drawLake, courtyard: drawCourtyard };

export function drawStage(ctx, stageId, t) {
  const fn = STAGE_DRAW[stageId] || drawStreet;
  fn(ctx, t);
}
