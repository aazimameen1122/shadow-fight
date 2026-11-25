// Canvas VFX: ink splashes, spark bursts, shockwave rings, slash arcs,
// ground dust, floating embers/leaves and drifting mist are spawned here
// and updated every tick. Pure canvas, no assets.

export class VFX {
  constructor() {
    this.parts = [];
    this.rings = [];
    this.arcs = [];
    this.texts = [];
  }

  _push(p) { this.parts.push(p); if (this.parts.length > 420) this.parts.splice(0, this.parts.length - 420); }

  spawnHit(x, y, dir, heavy) {
    const n = heavy ? 16 : 9;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = (heavy ? 5 : 3.5) * (0.4 + Math.random());
      this._push({ type: 'spark', x, y, vx: Math.cos(a) * sp + dir * 2, vy: Math.sin(a) * sp - 1, life: heavy ? 22 : 14, max: 22, size: 2 + Math.random() * 3, color: Math.random() < 0.5 ? '#f4f1ea' : '#ffd34d' });
    }
    for (let i = 0; i < (heavy ? 8 : 4); i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 3;
      this._push({ type: 'ink', x, y, vx: Math.cos(a) * sp + dir * 1.5, vy: Math.sin(a) * sp, life: 26, max: 26, size: 4 + Math.random() * 6, color: '#14141c' });
    }
    if (heavy) this.rings.push({ x, y, r: 6, max: 64, life: 16, maxLife: 16 });
  }

  spawnDust(x, y, n = 6) {
    for (let i = 0; i < n; i += 1) {
      this._push({ type: 'dust', x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 4, vx: (Math.random() - 0.5) * 1.6, vy: -0.4 - Math.random() * 0.8, life: 26, max: 26, size: 4 + Math.random() * 5, color: '#8a8694' });
    }
  }

  spawnSlash(x, y, angle, range, color = '#f4f1ea') {
    this.arcs.push({ x, y, angle, range, life: 8, maxLife: 8, color });
  }

  spawnRing(x, y, max = 90) {
    this.rings.push({ x, y, r: 8, max, life: 20, maxLife: 20 });
  }

  spawnText(x, y, text, color = '#ffd34d') {
    this.texts.push({ x, y, text, color, life: 42, maxLife: 42 });
  }

  spawnEmber(x, y) {
    this._push({ type: 'ember', x, y, vx: (Math.random() - 0.5) * 0.4, vy: -0.3 - Math.random() * 0.5, life: 160, max: 160, size: 1.5 + Math.random() * 2, color: Math.random() < 0.5 ? '#ff9a3d' : '#e8c15a' });
  }

  spawnMist(x, y) {
    this._push({ type: 'mist', x, y, vx: 0.25 + Math.random() * 0.3, vy: 0, life: 220, max: 220, size: 26 + Math.random() * 30, color: '#aab4c8' });
  }

  update() {
    for (const p of this.parts) {
      p.life -= 1;
      p.x += p.vx; p.y += p.vy;
      if (p.type === 'spark') { p.vy += 0.18; p.vx *= 0.96; }
      if (p.type === 'ink') { p.vy += 0.12; p.vx *= 0.94; p.size *= 0.985; }
      if (p.type === 'dust') { p.vy -= 0.01; p.vx *= 0.97; p.size += 0.12; }
      if (p.type === 'ember') { p.x += Math.sin(p.life * 0.05) * 0.3; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const r of this.rings) { r.life -= 1; r.r += (r.max - r.r) * 0.22; }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const a of this.arcs) a.life -= 1;
    this.arcs = this.arcs.filter((a) => a.life > 0);
    for (const t of this.texts) { t.life -= 1; t.y -= 0.7; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  draw(ctx) {
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      if (p.type === 'mist') {
        ctx.globalAlpha = a * 0.1;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size, p.size * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'dust') {
        ctx.globalAlpha = a * 0.4;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'ember') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.maxLife);
      ctx.strokeStyle = `rgba(244,241,234,${a * 0.9})`;
      ctx.lineWidth = 3 * a + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const a of this.arcs) {
      const k = a.life / a.maxLife;
      ctx.strokeStyle = a.color;
      ctx.globalAlpha = k;
      ctx.lineWidth = 5 * k + 1;
      ctx.shadowColor = a.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.range * (1.1 - k * 0.25), a.angle - 0.9, a.angle + 0.9); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    for (const t of this.texts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.fillStyle = t.color;
      ctx.font = '900 22px "Avenir Next", "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    }
  }
}
