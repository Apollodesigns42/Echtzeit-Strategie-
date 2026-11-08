'use strict';
// ===== Prozedurale Grafiken für Einheiten und Gebäude =====
(function () {
  const U = RTS.util, T = U.TILE;
  const PI = Math.PI;

  function hullColor(color, style) {
    if (style === 'angular') return U.mix(color, '#8b95a3', 0.45);
    if (style === 'sleek') return U.mix(color, '#1c1c22', 0.45);
    return U.mix(color, '#3b1d5e', 0.35);
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function shadow(ctx, r, ox = 3, oy = 4, sx = 1, sy = 0.75) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(ox, oy, r * sx, r * sy, 0, 0, 7); ctx.fill(); }

  // ---------- Einheiten ----------
  // ctx steht im Mittelpunkt der Einheit
  function drawUnit(ctx, def, o) {
    const style = RTS.data.FACTIONS[def.faction].style;
    const col = o.color, hull = hullColor(col, style), dark = U.shade(hull, -0.35), light = U.shade(hull, 0.25);
    const r = def.size, a = o.angle, ta = o.turret, an = o.anim || 0, mv = o.moving;
    const d = def.draw;
    switch (d.t) {
      case 'squad': case 'swarm': {
        const n = d.n; const offs = [[0, 0], [-6, 5], [6, 5], [-6, -5], [6, -5]];
        const lay = n === 2 ? [[-4, 0], [4, 0]] : n === 3 ? [[0, -5], [-5, 4], [5, 4]] : n === 4 ? [[-5, -4], [5, -4], [-5, 4], [5, 4]] : offs;
        for (let i = 0; i < n; i++) {
          const [lx, ly] = lay[i];
          const cs = Math.cos(a), sn = Math.sin(a);
          const x = lx * cs - ly * sn * 0.8, y = lx * sn + ly * cs * 0.8;
          const bob = mv ? Math.sin(an * 12 + i * 1.7) * 1.2 : 0;
          ctx.save(); ctx.translate(x * 1.2, y * 1.2 + bob); ctx.scale(1.25, 1.25);
          if (d.t === 'swarm') drawBug(ctx, col, a, an + i, d.big, mv);
          else drawSoldier(ctx, col, style, ta, d.gun, an + i);
          ctx.restore();
        }
        return;
      }
      case 'jeep': case 'buggy': {
        shadow(ctx, r);
        ctx.save(); ctx.rotate(a);
        const L = r * 1.9, W = r * 1.15;
        ctx.fillStyle = '#1a1a1a';
        for (const [wx, wy] of [[L * 0.3, W * 0.5], [L * 0.3, -W * 0.5], [-L * 0.3, W * 0.5], [-L * 0.3, -W * 0.5]]) { rr(ctx, wx - 3.5, wy - 2.2, 7, 4.4, 1.5); ctx.fill(); }
        ctx.fillStyle = hull; rr(ctx, -L / 2, -W / 2 + 1, L, W - 2, 3); ctx.fill();
        ctx.fillStyle = col; ctx.fillRect(-L / 2 + 2, -1.5, L * 0.35, 3);
        ctx.fillStyle = '#7dd3fc'; ctx.globalAlpha = 0.7; ctx.fillRect(L * 0.12, -W / 2 + 3, 3, W - 6); ctx.globalAlpha = 1;
        if (d.t === 'buggy') { ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.strokeRect(-L * 0.25, -W / 2 + 2, L * 0.4, W - 4); }
        ctx.restore();
        ctx.save(); ctx.rotate(ta); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(-2, 0, 3.5, 0, 7); ctx.fill();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(9, 0); ctx.stroke(); ctx.restore();
        return;
      }
      case 'tank': case 'arty': case 'rocketarty': {
        shadow(ctx, r * 1.05);
        ctx.save(); ctx.rotate(a);
        const L = r * 2, W = r * 1.45;
        // Ketten
        ctx.fillStyle = '#1c1c1c'; ctx.fillRect(-L / 2, -W / 2, L, W * 0.27); ctx.fillRect(-L / 2, W / 2 - W * 0.27, L, W * 0.27);
        ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1;
        const off = mv ? (an * 30) % 5 : 0;
        for (let x = -L / 2 + off; x < L / 2; x += 5) { ctx.beginPath(); ctx.moveTo(x, -W / 2); ctx.lineTo(x, -W / 2 + W * 0.27); ctx.moveTo(x, W / 2); ctx.lineTo(x, W / 2 - W * 0.27); ctx.stroke(); }
        // Wanne
        ctx.fillStyle = hull;
        if (d.sleek) { ctx.beginPath(); ctx.moveTo(L / 2 + 2, 0); ctx.lineTo(L / 4, -W * 0.38); ctx.lineTo(-L / 2, -W * 0.36); ctx.lineTo(-L / 2, W * 0.36); ctx.lineTo(L / 4, W * 0.38); ctx.closePath(); ctx.fill(); }
        else { rr(ctx, -L / 2 + 1, -W * 0.36, L - 2, W * 0.72, 2); ctx.fill(); }
        ctx.fillStyle = light; ctx.fillRect(-L / 2 + 3, -W * 0.36, L - 6, 2);
        ctx.fillStyle = col; ctx.fillRect(-L / 2 + 2, -W * 0.12, 4, W * 0.24);
        ctx.restore();
        ctx.save(); ctx.rotate(ta);
        if (d.t === 'tank') {
          ctx.fillStyle = '#222'; ctx.fillRect(0, -1.8, r * 1.25, 3.6);
          ctx.fillStyle = dark; ctx.fillRect(r * 1.1, -2.4, 3, 4.8);
          ctx.fillStyle = hull; ctx.beginPath(); if (d.sleek) { ctx.ellipse(-1, 0, r * 0.55, r * 0.42, 0, 0, 7); } else rr(ctx, -r * 0.55, -r * 0.45, r * 1.05, r * 0.9, 3); ctx.fill();
          ctx.fillStyle = light; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.12, r * 0.18, 0, 7); ctx.fill();
          ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
          if (d.sleek) { ctx.fillStyle = '#ff5555'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(an * 4); ctx.beginPath(); ctx.arc(r * 0.35, 0, 1.8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        } else if (d.t === 'arty') {
          ctx.fillStyle = '#222'; ctx.fillRect(-2, -2, r * 1.7, 4);
          ctx.fillStyle = hull; rr(ctx, -r * 0.7, -r * 0.5, r * 1.0, r * 1.0, 2); ctx.fill();
          ctx.fillStyle = dark; ctx.fillRect(-r * 0.6, -r * 0.4, r * 0.4, r * 0.8);
        } else {
          ctx.fillStyle = hull; rr(ctx, -r * 0.7, -r * 0.6, r * 1.3, r * 1.2, 2); ctx.fill();
          ctx.fillStyle = '#111'; for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.35 + j * r * 0.35, 2, 0, 7); ctx.fill(); }
          ctx.fillStyle = col; ctx.fillRect(-r * 0.6, -1.5, r * 0.6, 3);
        }
        ctx.restore();
        return;
      }
      case 'walker': case 'spider': {
        shadow(ctx, r * 1.1);
        ctx.save(); ctx.rotate(a);
        const legs = d.t === 'walker' ? [[0.5, 0.75], [-0.5, 0.75], [0.5, -0.75], [-0.5, -0.75]] : [[0.7, 0.9], [-0.7, 0.9], [0.7, -0.9], [-0.7, -0.9], [0, 1.1], [0, -1.1]];
        ctx.strokeStyle = U.shade(hull, -0.5); ctx.lineWidth = d.t === 'walker' ? 6 : 3; ctx.lineCap = 'round';
        legs.forEach(([lx, ly], i) => {
          const sw = mv ? Math.sin(an * 5 + i * PI) * 0.35 : 0;
          ctx.beginPath(); ctx.moveTo(lx * r * 0.4, ly * r * 0.4); ctx.lineTo((lx + sw) * r, ly * r); ctx.stroke();
        });
        ctx.lineCap = 'butt';
        ctx.fillStyle = hull;
        if (d.t === 'walker') { rr(ctx, -r * 0.75, -r * 0.65, r * 1.5, r * 1.3, 4); ctx.fill(); ctx.fillStyle = light; ctx.fillRect(-r * 0.65, -r * 0.6, r * 1.3, 2.5); }
        else { ctx.beginPath(); for (let i = 0; i < 6; i++) { const ang = i / 6 * PI * 2; ctx.lineTo(Math.cos(ang) * r * 0.7, Math.sin(ang) * r * 0.6); } ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.save(); ctx.rotate(ta);
        if (d.t === 'walker') {
          ctx.fillStyle = '#1f1f1f'; ctx.fillRect(0, -6, r * 1.15, 3.5); ctx.fillRect(0, 2.5, r * 1.15, 3.5);
          ctx.fillStyle = U.shade(hull, 0.1); rr(ctx, -r * 0.5, -r * 0.5, r * 0.95, r, 3); ctx.fill();
          ctx.fillStyle = col; ctx.fillRect(-r * 0.45, -r * 0.5, 3, r);
          ctx.fillStyle = '#333'; ctx.fillRect(-r * 0.3, -r * 0.75, r * 0.5, 4); ctx.fillRect(-r * 0.3, r * 0.55, r * 0.5, 4);
        } else {
          ctx.fillStyle = '#222'; ctx.fillRect(0, -2.5, r * 1.15, 5);
          ctx.fillStyle = U.shade(hull, 0.15); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * 0.42, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#ff3b3b'; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(an * 3); ctx.beginPath(); ctx.arc(r * 1.12, 0, 2.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-r * 0.15, 0, r * 0.18, 0, 7); ctx.fill();
        }
        ctx.restore();
        return;
      }
      case 'hover': {
        const bob = Math.sin(an * 3) * 1.5;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(4, 7, r, r * 0.6, 0, 0, 7); ctx.fill();
        const glow = ctx.createRadialGradient(0, 3, 1, 0, 3, r * 1.2); glow.addColorStop(0, 'rgba(34,211,238,0.55)'); glow.addColorStop(1, 'rgba(34,211,238,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 3, r * 1.2, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(0, bob - 2); ctx.rotate(a);
        ctx.fillStyle = hull; ctx.beginPath(); ctx.moveTo(r * 1.1, 0); ctx.quadraticCurveTo(0, -r * 0.95, -r * 0.9, -r * 0.45); ctx.lineTo(-r * 0.9, r * 0.45); ctx.quadraticCurveTo(0, r * 0.95, r * 1.1, 0); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.translate(0, bob - 2); ctx.rotate(ta);
        if (d.arty) { ctx.fillStyle = '#84cc16'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(-1, 0, r * 0.42, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = dark; ctx.fillRect(0, -2, r * 0.9, 4); }
        else { ctx.fillStyle = '#e9d5ff'; ctx.beginPath(); ctx.moveTo(r * 0.8, 0); ctx.lineTo(-2, -3.5); ctx.lineTo(-2, 3.5); ctx.fill(); }
        ctx.restore();
        return;
      }
      case 'tripod': {
        const s = d.small ? 1 : 1;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(5, 8, r * 1.1, r * 0.75, 0, 0, 7); ctx.fill();
        ctx.save(); ctx.rotate(a);
        ctx.strokeStyle = U.shade(hull, -0.4); ctx.lineWidth = d.small ? 3 : 5; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const la = i / 3 * PI * 2 + (mv ? Math.sin(an * 4 + i * 2) * 0.25 : 0);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(la) * r * 0.9, Math.sin(la) * r * 0.9 - 8, Math.cos(la) * r * 1.25 * s, Math.sin(la) * r * 1.25 * s); ctx.stroke();
        }
        ctx.lineCap = 'butt';
        ctx.restore();
        ctx.save(); ctx.translate(0, -5); ctx.rotate(ta);
        const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, r * 0.75); g.addColorStop(0, light); g.addColorStop(1, hull);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r * 0.6, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#f0abfc'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(an * 3); ctx.beginPath(); ctx.arc(r * 0.45, 0, d.small ? 2.5 : 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        ctx.restore();
        return;
      }
      case 'harvester': {
        if (d.hover) { const glow = ctx.createRadialGradient(0, 3, 1, 0, 3, r * 1.2); glow.addColorStop(0, 'rgba(34,211,238,0.4)'); glow.addColorStop(1, 'rgba(34,211,238,0)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 3, r * 1.2, 0, 7); ctx.fill(); }
        shadow(ctx, r);
        ctx.save(); ctx.rotate(a);
        const L = r * 2, W = r * 1.3;
        if (!d.hover) { ctx.fillStyle = '#1c1c1c'; ctx.fillRect(-L / 2, -W / 2, L * 0.9, W * 0.22); ctx.fillRect(-L / 2, W / 2 - W * 0.22, L * 0.9, W * 0.22); }
        ctx.fillStyle = hull; rr(ctx, -L / 2, -W * 0.4, L * 0.85, W * 0.8, 3); ctx.fill();
        // Ladung
        const f = U.clamp((o.cargo || 0) / 500, 0, 1);
        ctx.fillStyle = '#1e293b'; ctx.fillRect(-L / 2 + 3, -W * 0.3, L * 0.5, W * 0.6);
        if (f > 0) { ctx.fillStyle = '#22d3ee'; ctx.globalAlpha = 0.85; ctx.fillRect(-L / 2 + 3, -W * 0.3, L * 0.5 * f, W * 0.6); ctx.globalAlpha = 1; }
        ctx.fillStyle = col; ctx.fillRect(L * 0.1, -W * 0.4, 3, W * 0.8);
        // Schaufel
        ctx.fillStyle = '#4b5563'; ctx.fillRect(L * 0.35, -W * 0.5, L * 0.18, W);
        ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1;
        const ro = (an * 20) % 4;
        for (let y = -W * 0.5 + ro; y < W * 0.5; y += 4) { ctx.beginPath(); ctx.moveTo(L * 0.35, y); ctx.lineTo(L * 0.53, y); ctx.stroke(); }
        ctx.restore();
        return;
      }
      case 'mcv': {
        shadow(ctx, r * 1.05);
        ctx.save(); ctx.rotate(a);
        const L = r * 2.1, W = r * 1.2;
        ctx.fillStyle = '#1c1c1c'; ctx.fillRect(-L / 2, -W / 2, L, W * 0.24); ctx.fillRect(-L / 2, W / 2 - W * 0.24, L, W * 0.24);
        ctx.fillStyle = hull; rr(ctx, -L / 2 + 1, -W * 0.4, L - 2, W * 0.8, 3); ctx.fill();
        ctx.fillStyle = light; ctx.fillRect(L * 0.22, -W * 0.36, L * 0.22, W * 0.72);
        ctx.fillStyle = '#7dd3fc'; ctx.fillRect(L * 0.42, -W * 0.3, 2.5, W * 0.6);
        ctx.fillStyle = dark; rr(ctx, -L * 0.42, -W * 0.3, L * 0.55, W * 0.6, 2); ctx.fill();
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-L * 0.4, 0); ctx.lineTo(L * 0.15, 0); ctx.stroke();
        ctx.fillStyle = col; ctx.fillRect(-L * 0.5 + 2, -W * 0.38, 4, W * 0.76);
        ctx.restore();
        return;
      }
      case 'vtol': case 'jet': case 'saucer': {
        const alt = o.alt != null ? o.alt : 34;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.save(); ctx.translate(alt * 0.35, alt * 0.9); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.6, 0, 0, 7); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(0, -alt + Math.sin(an * 2.5) * 1.5); ctx.rotate(a);
        if (d.t === 'vtol') {
          ctx.fillStyle = hull; ctx.fillRect(-r * 0.4, -r * 0.95, r * 0.5, r * 1.9);
          ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.3, 0, 0, 7); ctx.fill();
          ctx.fillStyle = col; ctx.fillRect(-r * 0.9, -2, 5, 4);
          ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.ellipse(r * 0.5, 0, 4, 2.5, 0, 0, 7); ctx.fill();
          for (const s of [-1, 1]) {
            ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(-r * 0.15, s * r * 0.95, r * 0.33, 0, 7); ctx.fill();
            ctx.strokeStyle = 'rgba(220,220,220,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
            const ra = an * 25; ctx.moveTo(-r * 0.15 + Math.cos(ra) * r * 0.4, s * r * 0.95 + Math.sin(ra) * r * 0.4); ctx.lineTo(-r * 0.15 - Math.cos(ra) * r * 0.4, s * r * 0.95 - Math.sin(ra) * r * 0.4); ctx.stroke();
          }
        } else if (d.t === 'jet') {
          ctx.fillStyle = hull; ctx.beginPath(); ctx.moveTo(r * 1.1, 0); ctx.lineTo(-r * 0.8, -r * 0.9); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r * 0.8, r * 0.9); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#fca5a5'; ctx.beginPath(); ctx.ellipse(r * 0.3, 0, 4, 2, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(251,146,60,0.8)'; ctx.beginPath(); ctx.arc(-r * 0.6, 0, 2.5 + Math.random() * 1.5, 0, 7); ctx.fill();
        } else {
          const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, r); g.addColorStop(0, light); g.addColorStop(1, hull);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
          for (let i = 0; i < 6; i++) { const la = i / 6 * PI * 2 + an * 2; ctx.fillStyle = i % 2 ? '#22d3ee' : '#f0abfc'; ctx.beginPath(); ctx.arc(Math.cos(la) * r * 0.7, Math.sin(la) * r * 0.7, 1.8, 0, 7); ctx.fill(); }
          ctx.fillStyle = '#e9d5ff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 7); ctx.fill();
        }
        ctx.restore();
        return;
      }
    }
  }
  function drawSoldier(ctx, col, style, a, gun, ph) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(1.5, 2, 3.5, 2.2, 0, 0, 7); ctx.fill();
    const body = style === 'angular' ? U.mix(col, '#556070', 0.35) : style === 'sleek' ? U.mix(col, '#222', 0.45) : col;
    ctx.save(); ctx.rotate(a);
    ctx.strokeStyle = '#111'; ctx.lineWidth = gun === 'rocket' ? 2.6 : 1.4;
    ctx.beginPath(); ctx.moveTo(0, 1.5); ctx.lineTo(gun === 'rocket' ? 6 : 7, 1.5); ctx.stroke();
    if (gun === 'flame') { ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(6.5, 1.5, 1.2, 0, 7); ctx.fill(); ctx.fillStyle = '#444'; ctx.fillRect(-4.5, -2, 2.5, 4); }
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 3.4, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = style === 'sleek' ? '#1f1f1f' : U.shade(body, -0.3); ctx.beginPath(); ctx.arc(0, 0, 1.9, 0, 7); ctx.fill();
  }
  function drawBug(ctx, col, a, ph, big, mv) {
    const s = big ? 1.4 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(1.5, 2, 3.5 * s, 2.2 * s, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.rotate(a); ctx.scale(s, s);
    ctx.strokeStyle = U.shade(col, -0.5); ctx.lineWidth = 0.9;
    for (let i = -1; i <= 1; i++) for (const sd of [-1, 1]) { const w = mv ? Math.sin(ph * 14 + i) * 1.2 : 0; ctx.beginPath(); ctx.moveTo(i * 1.5, 0); ctx.lineTo(i * 1.8 + w, sd * 4); ctx.stroke(); }
    ctx.fillStyle = U.mix(col, '#4c1d95', 0.3); ctx.beginPath(); ctx.ellipse(-0.5, 0, 3.4, 2.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = big ? '#a3e635' : '#f0abfc'; ctx.beginPath(); ctx.arc(2.6, 0, 1.3, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------- Gebäude ----------
  // ctx steht in der linken oberen Ecke der Grundfläche
  function box(ctx, x, y, w, h, H, top, side) {
    ctx.fillStyle = side; ctx.fillRect(x, y + h - H, w, H);
    ctx.fillStyle = top; ctx.fillRect(x, y - H, w, h);
  }
  function drawBuilding(ctx, def, o) {
    const fac = RTS.data.FACTIONS[def.faction]; const style = fac.style;
    const W = def.w * T, Hh = def.h * T, col = o.color, an = o.anim || 0;
    const base = style === 'angular' ? '#8a929c' : style === 'sleek' ? '#3a3a42' : '#5b3b7a';
    const top = U.mix(base, col, 0.18), topL = U.shade(top, 0.18), side = U.shade(base, -0.4);
    const org = style === 'organic';
    // Fundament
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(4, 6, W - 2, Hh - 2);
    ctx.fillStyle = org ? '#2a1b3a' : '#4a4a48'; ctx.fillRect(1, 1, W - 2, Hh - 2);
    ctx.strokeStyle = org ? '#7e22ce' : '#2c2c2a'; ctx.lineWidth = 1; ctx.strokeRect(1.5, 1.5, W - 3, Hh - 3);
    const role = def.role;
    const H = Math.min(14, 6 + def.w * 3);
    const px = 4, py = 4;
    if (org) return drawOrganic(ctx, def, o, W, Hh, col, an);
    switch (role) {
      case 'yard': {
        box(ctx, px, py + H, W - 8, Hh - 8 - H - 10, H, top, side);
        ctx.fillStyle = topL; ctx.fillRect(px + 4, py + 4, W * 0.35, Hh * 0.3);
        ctx.fillStyle = col; ctx.fillRect(px, py, W - 8, 3);
        // Kran
        ctx.save(); ctx.translate(W * 0.7, Hh * 0.35); ctx.rotate(Math.sin(an * 0.3) * 1.2);
        ctx.fillStyle = '#facc15'; ctx.fillRect(-2, -2, W * 0.45, 4); ctx.fillStyle = '#333'; ctx.fillRect(W * 0.4, -1, 1, 10);
        ctx.restore();
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(W * 0.7, Hh * 0.35, 4, 0, 7); ctx.fill();
        // Landefeld unten
        ctx.fillStyle = '#3f3f3d'; ctx.fillRect(px + 6, Hh - 16, W - 20, 11);
        ctx.strokeStyle = '#facc15'; ctx.setLineDash([4, 3]); ctx.strokeRect(px + 6, Hh - 16, W - 20, 11); ctx.setLineDash([]);
        emblem(ctx, W * 0.28, Hh * 0.38, col, style);
        break;
      }
      case 'power': {
        ctx.fillStyle = side; ctx.fillRect(px, Hh * 0.55, W - 8, Hh * 0.35);
        ctx.fillStyle = top; ctx.fillRect(px, Hh * 0.45, W - 8, Hh * 0.2);
        const towers = style === 'sleek' ? 1 : 2;
        for (let i = 0; i < towers; i++) {
          const cx = towers === 1 ? W / 2 : W * (0.3 + i * 0.4), cy = Hh * 0.4, r = towers === 1 ? W * 0.28 : W * 0.18;
          const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
          g.addColorStop(0, topL); g.addColorStop(1, side);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
          const glow = style === 'sleek' ? '#ef4444' : '#38bdf8';
          ctx.fillStyle = glow; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(an * 3 + i); ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        }
        ctx.fillStyle = col; ctx.fillRect(px, Hh - 8, W - 8, 3);
        break;
      }
      case 'refinery': {
        box(ctx, px, py + H + 2, W * 0.55, Hh * 0.55 - H, H, top, side);
        // Silo
        const cx = W * 0.78, cy = Hh * 0.32, r = W * 0.17;
        ctx.fillStyle = side; ctx.fillRect(cx - r, cy, r * 2, r * 1.2);
        ctx.fillStyle = topL; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#22d3ee'; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(an * 2); ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.55, r * 0.38, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        // Rohre
        ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * 0.55, Hh * 0.35); ctx.lineTo(cx - r, cy + 4); ctx.stroke();
        // Andockplatz
        ctx.fillStyle = '#353533'; ctx.fillRect(W * 0.25, Hh * 0.68, W * 0.5, Hh * 0.3);
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
        for (let x = W * 0.27; x < W * 0.73; x += 8) { ctx.beginPath(); ctx.moveTo(x, Hh - 4); ctx.lineTo(x + 5, Hh * 0.7); ctx.stroke(); }
        ctx.fillStyle = col; ctx.fillRect(px, py, W * 0.55, 3);
        break;
      }
      case 'barracks': {
        box(ctx, px, py + H, W - 8, Hh - 10 - H, H, top, side);
        ctx.fillStyle = topL; ctx.fillRect(px + 3, py + 3, W - 14, 4);
        ctx.fillStyle = '#1f1f1f'; ctx.fillRect(W / 2 - 6, Hh - 12 - 4, 12, 10);
        // Fahne
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(W - 10, py); ctx.lineTo(W - 10, py + 16); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(W - 10, py); ctx.lineTo(W - 10 + 9 + Math.sin(an * 5) * 1.5, py + 3); ctx.lineTo(W - 10, py + 6); ctx.fill();
        break;
      }
      case 'factory': {
        box(ctx, px, py + H, W - 8, Hh - 10 - H, H, top, side);
        ctx.fillStyle = topL; for (let i = 0; i < 3; i++) ctx.fillRect(px + 5 + i * (W - 18) / 3, py + 5, (W - 18) / 3 - 4, Hh * 0.35);
        // Tor
        ctx.fillStyle = '#2b2b2b'; ctx.fillRect(W * 0.28, Hh - 10 - H + 2, W * 0.44, H - 2);
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; for (let x = W * 0.28; x < W * 0.72; x += 6) { ctx.beginPath(); ctx.moveTo(x, Hh - 10); ctx.lineTo(x + 3, Hh - 10 - H + 2); ctx.stroke(); }
        ctx.fillStyle = '#555'; ctx.fillRect(W - 16, py - 2, 7, 12);
        ctx.fillStyle = col; ctx.fillRect(px, py, W - 8, 3);
        break;
      }
      case 'radar': {
        box(ctx, px + 2, py + H, W - 12, Hh - 12 - H, H, top, side);
        ctx.save(); ctx.translate(W / 2, Hh * 0.38);
        const s = Math.cos(an * 1.2);
        ctx.fillStyle = '#d1d5db'; ctx.beginPath(); ctx.ellipse(0, 0, W * 0.32 * Math.abs(s) + 3, W * 0.3, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
        ctx.restore();
        break;
      }
      case 'airfield': {
        ctx.fillStyle = '#3a3a38'; ctx.fillRect(px, py, W - 8, Hh - 8);
        ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, Hh / 2, W * 0.3, 0, 7); ctx.stroke();
        ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', W / 2, Hh / 2 + 1);
        for (let i = 0; i < 4; i++) { const la = i * PI / 2 + PI / 4; ctx.fillStyle = Math.sin(an * 4 + i) > 0 ? col : '#555'; ctx.beginPath(); ctx.arc(W / 2 + Math.cos(la) * W * 0.4, Hh / 2 + Math.sin(la) * Hh * 0.4, 3, 0, 7); ctx.fill(); }
        box(ctx, px, py + 10, 14, 10, 10, top, side);
        break;
      }
      case 'tech': {
        box(ctx, px, py + H, W - 8, Hh - 10 - H, H, top, side);
        const g = ctx.createRadialGradient(W / 2 - 6, Hh * 0.35 - 6, 2, W / 2, Hh * 0.38, W * 0.28);
        g.addColorStop(0, '#e0f2fe'); g.addColorStop(1, style === 'sleek' ? '#7f1d1d' : '#0369a1');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, Hh * 0.38, W * 0.26, 0, 7); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, Hh * 0.38, W * 0.26 + 2, an % 6.28, an % 6.28 + 2); ctx.stroke();
        break;
      }
      case 'sw': {
        const ch = U.clamp(o.charge || 0, 0, 1);
        box(ctx, px, py + H, W - 8, Hh - 10 - H, H, top, side);
        if (style === 'angular') {
          ctx.save(); ctx.translate(W / 2, Hh * 0.38);
          ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.ellipse(0, 0, W * 0.33, W * 0.24, -0.3, 0, 7); ctx.fill();
          ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = U.mix('#1e3a8a', '#93c5fd', ch); ctx.globalAlpha = 0.5 + ch * 0.5; ctx.beginPath(); ctx.arc(0, 0, 6 + ch * 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
          ctx.restore();
        } else {
          ctx.fillStyle = '#222'; ctx.fillRect(W * 0.25, Hh * 0.2, W * 0.5, Hh * 0.4);
          const open = ch >= 1 ? 0.5 + 0.5 * Math.sin(an * 2) : 0;
          ctx.fillStyle = '#525252'; ctx.fillRect(W * 0.25 - open * 8, Hh * 0.2, W * 0.25, Hh * 0.4); ctx.fillRect(W * 0.5 + open * 8, Hh * 0.2, W * 0.25, Hh * 0.4);
          ctx.fillStyle = '#ef4444'; ctx.fillRect(W * 0.25, Hh * 0.6, W * 0.5 * ch, 3);
        }
        break;
      }
      case 'tower_mg': case 'tower_aa': {
        ctx.fillStyle = side; ctx.beginPath(); ctx.arc(W / 2, Hh / 2 + 2, W * 0.42, 0, 7); ctx.fill();
        ctx.fillStyle = top; ctx.beginPath(); ctx.arc(W / 2, Hh / 2 - 1, W * 0.38, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(W / 2, Hh / 2 - 2); ctx.rotate(o.turret);
        ctx.fillStyle = '#1f1f1f';
        if (role === 'tower_aa') { ctx.fillRect(0, -4, 13, 2.5); ctx.fillRect(0, 1.5, 13, 2.5); } else ctx.fillRect(0, -1.2, 12, 2.4);
        ctx.fillStyle = U.shade(top, 0.1); ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 7); ctx.fill();
        ctx.restore();
        break;
      }
      case 'tower_av': {
        ctx.fillStyle = side; ctx.fillRect(px + 2, py + 6, W - 12, Hh - 12);
        ctx.fillStyle = top; ctx.fillRect(px + 2, py + 2, W - 12, Hh - 14);
        if (style === 'sleek') {
          // Laserspitze
          ctx.fillStyle = '#18181b'; ctx.beginPath(); ctx.moveTo(W / 2, py - 4); ctx.lineTo(W / 2 + 12, Hh / 2 + 4); ctx.lineTo(W / 2 - 12, Hh / 2 + 4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ef4444'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(an * 3); ctx.beginPath(); ctx.arc(W / 2, py + 4, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        } else {
          ctx.save(); ctx.translate(W / 2, Hh / 2 - 3); ctx.rotate(o.turret);
          ctx.fillStyle = '#1f1f1f'; ctx.fillRect(2, -6, 22, 4); ctx.fillRect(2, 2, 22, 4);
          ctx.fillStyle = U.shade(top, 0.1); rr(ctx, -10, -10, 20, 20, 4); ctx.fill();
          ctx.fillStyle = col; ctx.fillRect(-8, -2, 6, 4);
          ctx.restore();
        }
        break;
      }
    }
  }
  function drawOrganic(ctx, def, o, W, H, col, an) {
    const role = def.role, cx = W / 2, cy = H / 2;
    const purple = '#6b21a8', pl = '#a855f7';
    const pulse = 0.5 + 0.5 * Math.sin(an * 2);
    const blob = (x, y, rx, ry, c1, c2) => { const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, Math.max(rx, ry)); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); };
    const crystal = (x, y, h, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + h * 0.3, y); ctx.lineTo(x, y + h * 0.15); ctx.lineTo(x - h * 0.3, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + h * 0.3, y); ctx.lineTo(x, y); ctx.fill(); };
    if (role.startsWith('tower')) {
      blob(cx, cy + 2, W * 0.4, H * 0.32, pl, purple);
      if (role === 'tower_av') { crystal(cx, cy + 4, H * 0.75, U.mix('#e879f9', col, 0.3)); ctx.fillStyle = '#f5d0fe'; ctx.globalAlpha = pulse; ctx.beginPath(); ctx.arc(cx, cy - H * 0.55, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      else if (role === 'tower_aa') { for (let i = 0; i < 3; i++) crystal(cx + (i - 1) * 6, cy + 3, H * 0.45, '#22d3ee'); }
      else { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + an * 0.2; crystal(cx + Math.cos(a) * 5, cy + Math.sin(a) * 4, H * 0.32, '#a3e635'); } }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy + 6, 2.5, 0, 7); ctx.fill();
      return;
    }
    blob(cx, cy + 3, W * 0.44, H * 0.4, U.mix(pl, col, 0.25), purple);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy + 3, W * 0.44, H * 0.4, 0, 0, 7); ctx.stroke();
    switch (role) {
      case 'yard': for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + an * 0.15; crystal(cx + Math.cos(a) * W * 0.25, cy + Math.sin(a) * H * 0.2, H * 0.35, '#c084fc'); } crystal(cx, cy, H * 0.55, '#22d3ee'); break;
      case 'power': crystal(cx, cy + 4, H * 0.6, '#38bdf8'); ctx.fillStyle = 'rgba(56,189,248,' + (0.3 + pulse * 0.4) + ')'; ctx.beginPath(); ctx.arc(cx, cy - 4, W * 0.18, 0, 7); ctx.fill(); break;
      case 'refinery': blob(cx - W * 0.15, cy - 2, W * 0.2, H * 0.18, '#67e8f9', '#0e7490'); crystal(cx + W * 0.2, cy, H * 0.4, '#22d3ee'); ctx.fillStyle = '#3b0764'; ctx.fillRect(W * 0.3, H * 0.72, W * 0.4, H * 0.24); break;
      case 'barracks': for (let i = 0; i < 3; i++) blob(cx + (i - 1) * W * 0.22, cy, W * 0.13, H * 0.13, '#f0abfc', '#86198f'); break;
      case 'factory': blob(cx, cy - 2, W * 0.28, H * 0.22, '#e9d5ff', '#7e22ce'); ctx.fillStyle = '#1e0b33'; ctx.beginPath(); ctx.ellipse(cx, H * 0.78, W * 0.2, H * 0.1, 0, 0, 7); ctx.fill(); break;
      case 'radar': { ctx.save(); ctx.translate(cx, cy); ctx.rotate(an); crystal(0, 0, H * 0.4, '#22d3ee'); ctx.restore(); ctx.strokeStyle = 'rgba(34,211,238,' + pulse + ')'; ctx.beginPath(); ctx.arc(cx, cy, W * 0.3 * pulse + 4, 0, 7); ctx.stroke(); break; }
      case 'airfield': ctx.strokeStyle = '#e9d5ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, W * 0.28, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, W * 0.15 + pulse * 4, 0, 7); ctx.stroke(); break;
      case 'tech': blob(cx, cy - 4, W * 0.24, H * 0.22, '#fdf4ff', '#a21caf'); break;
      case 'sw': {
        const ch = U.clamp(o.charge || 0, 0, 1);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(an * (0.5 + ch * 2));
        for (let i = 0; i < 3; i++) { ctx.rotate(2.09); ctx.strokeStyle = 'rgba(232,121,249,' + (0.4 + ch * 0.6) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, W * 0.28, 0, 1.6); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = '#1e0b33'; ctx.beginPath(); ctx.arc(cx, cy, W * 0.12, 0, 7); ctx.fill();
        break;
      }
    }
  }
  function emblem(ctx, x, y, col, style) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = col; ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
    if (style === 'angular') { ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, -3); ctx.lineTo(6, 3); ctx.lineTo(0, 7); ctx.lineTo(-6, 3); ctx.lineTo(-6, -3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-1, -4, 2, 8); }
    else { ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 2, 2, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // Kristallit
  function drawCrystals(ctx, x, y, amt, seed, t) {
    const n = amt > 300 ? 4 : amt > 150 ? 3 : amt > 50 ? 2 : 1;
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) {
      const cx = x + 6 + rnd() * 20, cy = y + 8 + rnd() * 18, h = 6 + rnd() * 7 * (amt / 300 + 0.4), w = h * 0.35;
      const glow = 0.75 + 0.25 * Math.sin(t * 2 + seed + i);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx + 2, cy + 1, w * 1.3, w * 0.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(${Math.round(30 * glow)},${Math.round(200 * glow)},${Math.round(235 * glow)},1)`;
      ctx.beginPath(); ctx.moveTo(cx, cy - h); ctx.lineTo(cx + w, cy - h * 0.2); ctx.lineTo(cx, cy + 1); ctx.lineTo(cx - w, cy - h * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(220,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(cx, cy - h); ctx.lineTo(cx + w, cy - h * 0.2); ctx.lineTo(cx, cy - h * 0.25); ctx.fill();
    }
  }
  function drawBlossom(ctx, x, y, t) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 6, y + 8, 16, 8, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(x, y - 10, 2, x, y - 6, 28); g.addColorStop(0, 'rgba(103,232,249,' + (0.35 + 0.15 * Math.sin(t * 1.5)) + ')'); g.addColorStop(1, 'rgba(103,232,249,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 6, 28, 0, 7); ctx.fill();
    const sp = [[0, 26, 7], [-9, 16, 5], [9, 18, 5], [-4, 12, 4], [6, 10, 4]];
    for (const [ox, h, w] of sp) {
      ctx.fillStyle = '#0891b2'; ctx.beginPath(); ctx.moveTo(x + ox, y - h); ctx.lineTo(x + ox + w, y); ctx.lineTo(x + ox, y + 3); ctx.lineTo(x + ox - w, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a5f3fc'; ctx.beginPath(); ctx.moveTo(x + ox, y - h); ctx.lineTo(x + ox + w, y); ctx.lineTo(x + ox, y); ctx.fill();
    }
  }

  // Symbolbild (Cameo) für die Seitenleiste
  const cameoCache = new Map();
  function cameo(def, color) {
    const key = def.id + color;
    if (cameoCache.has(key)) return cameoCache.get(key);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, '#2a3138'); g.addColorStop(1, '#0d1013');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 96);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 128; i += 12) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - 40, 96); ctx.stroke(); }
    if (def.kind === 'unit') {
      ctx.save(); ctx.translate(64, def.cat === 'air' ? 70 : 52);
      const sc = 44 / Math.max(14, def.size * 2.3) * (def.cat === 'inf' ? 1.8 : 1.3);
      ctx.scale(sc, sc);
      drawUnit(ctx, def, { color, angle: -0.6, turret: -0.6, anim: 1, moving: false, alt: 20 / sc * 0 + 20, cargo: 300 });
      ctx.restore();
    } else if (def.kind === 'building') {
      const s = Math.min(110 / (def.w * T), 84 / (def.h * T));
      ctx.save(); ctx.translate(64 - def.w * T * s / 2, 48 - def.h * T * s / 2); ctx.scale(s, s);
      drawBuilding(ctx, def, { color, anim: 1, turret: -0.6, charge: 1 });
      ctx.restore();
    } else {
      // Forschung
      ctx.save(); ctx.translate(64, 48);
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * PI / 3); ctx.beginPath(); ctx.ellipse(0, 0, 34, 12, 0, 0, 7); ctx.stroke(); ctx.restore(); }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
      ctx.restore();
    }
    cameoCache.set(key, cv);
    return cv;
  }

  RTS.draw = { drawUnit, drawBuilding, drawCrystals, drawBlossom, cameo, hullColor };
})();
