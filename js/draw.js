'use strict';
// ===== Detaillierte prozedurale Grafiken für Einheiten und Gebäude (Sprite-basiert) =====
(function () {
  const U = RTS.util, T = U.TILE, G = RTS.gfx;
  const PI = Math.PI;

  // ---------- Farbpaletten ----------
  function pal(faction, color) {
    if (faction === 'allianz') return { hull: U.mix('#7c8794', color, 0.16), dark: '#3b434d', light: '#b9c3cc', team: color, mat: 'metal', glass: '#7dd3fc', glow: '#93c5fd', metal: '#9aa3ad' };
    if (faction === 'schatten') return { hull: U.mix('#33333b', color, 0.1), dark: '#17171b', light: '#5d5d68', team: color, mat: 'dark', glass: '#fca5a5', glow: U.mix(color, '#ff3b3b', 0.4), metal: '#55555f' };
    return { hull: U.mix('#55306f', color, 0.28), dark: '#2a1238', light: '#a77bc9', team: color, mat: 'chitin', glass: '#a5f3fc', glow: '#5eead4', metal: '#7a5a92' };
  }
  function hullColor(color, style) { return pal(style === 'angular' ? 'allianz' : style === 'sleek' ? 'schatten' : 'vael', color).hull; }

  // ---------- Bauteile ----------
  function tracks(ctx, L, W, tw, frame) {
    for (const s of [-1, 1]) {
      const y = s * (W / 2 - tw / 2);
      G.rr(ctx, -L / 2, y - tw / 2, L, tw, tw * 0.45); ctx.fillStyle = '#1b1b1d'; ctx.fill();
      ctx.save(); G.rr(ctx, -L / 2, y - tw / 2, L, tw, tw * 0.45); ctx.clip();
      const off = (frame || 0) * 1.25;
      for (let x = -L / 2 - 3 + off; x < L / 2 + 2; x += 2.5) { ctx.fillStyle = '#3a3a3e'; ctx.fillRect(x, y - tw / 2, 1.2, tw); }
      const g = ctx.createLinearGradient(0, y - tw / 2, 0, y + tw / 2); g.addColorStop(0, 'rgba(255,255,255,0.15)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g; ctx.fillRect(-L / 2, y - tw / 2, L, tw);
      ctx.restore();
      G.rr(ctx, -L / 2, y - tw / 2, L, tw, tw * 0.45); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.6; ctx.stroke();
    }
  }
  function tire(ctx, x, y, w, h) {
    G.rr(ctx, x - w / 2, y - h / 2, w, h, h * 0.4); ctx.fillStyle = '#18181a'; ctx.fill();
    ctx.fillStyle = '#34343a'; for (let i = -w / 2 + 0.6; i < w / 2; i += 1.2) ctx.fillRect(x + i, y - h / 2 + 0.3, 0.5, h - 0.6);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 0.4; G.rr(ctx, x - w / 2, y - h / 2, w, h, h * 0.4); ctx.stroke();
  }
  function stripe(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, w, h * 0.3); }

  // ---------- Infanterie (Einzelsoldat / Käfer) ----------
  function soldier(ctx, P, gun, frame, faction) {
    const step = [0, 1, 0, -1][frame % 4];
    // Beine
    ctx.fillStyle = faction === 'allianz' ? '#2f3a2c' : '#121214';
    ctx.beginPath(); ctx.ellipse(-0.5 + step * 1.2, -1.3, 1.3, 0.75, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-0.5 - step * 1.2, 1.3, 1.3, 0.75, 0, 0, 7); ctx.fill();
    // Rucksack / Tank
    if (gun === 'flame') { G.dome(ctx, -2.6, -0.9, 1.1, '#c2410c'); G.dome(ctx, -2.6, 0.9, 1.1, '#c2410c'); }
    else { G.rr(ctx, -3.4, -1.6, 2, 3.2, 0.6); ctx.fillStyle = faction === 'allianz' ? '#4b5545' : '#26262b'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.3; ctx.stroke(); }
    // Körper
    const body = faction === 'allianz' ? U.mix('#56634f', P.team, 0.25) : U.mix('#2a2a30', P.team, 0.2);
    G.plate(ctx, () => { ctx.beginPath(); ctx.ellipse(0, 0, 1.9, 2.7, 0, 0, 7); }, body, { r: 3, bevel: false, ew: 0.35 });
    ctx.fillStyle = P.team; ctx.fillRect(-0.6, -2.2, 1.2, 0.8);
    // Arme + Waffe
    const skin = faction === 'allianz' ? '#c9a27e' : '#1a1a1a';
    if (gun === 'tool') {
      // Ingenieur: Warnweste, Werkzeugkoffer, Schraubenschlüssel
      ctx.fillStyle = '#facc15'; ctx.fillRect(-1.4, -2.3, 0.8, 4.6); ctx.fillRect(0.5, -2.3, 0.8, 4.6);
      ctx.strokeStyle = body; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, -1.6); ctx.lineTo(2.4, -1.8); ctx.moveTo(0, 1.6); ctx.lineTo(2.2, 1.9); ctx.stroke();
      G.plate(ctx, () => G.rr(ctx, 1.6, -3.4, 3, 2.2, 0.4), '#b91c1c', { bevel: false, ew: 0.3 }); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(2.6, -2.6, 1, 0.5);
      ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(2.2, 1.9); ctx.lineTo(4.6, 2.3); ctx.stroke();
      ctx.fillStyle = '#d1d5db'; ctx.beginPath(); ctx.arc(4.8, 2.3, 0.7, 0, 7); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(2.4, -1.8, 0.45, 0, 7); ctx.arc(2.2, 1.9, 0.45, 0, 7); ctx.fill();
    } else if (gun === 'rocket') {
      G.barrel(ctx, -2.5, 5.5, -1.6, 0.9, '#556b2f'); ctx.fillStyle = '#222'; ctx.fillRect(5.2, -2.5, 0.6, 1.8);
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(1.6, -0.9, 0.6, 0, 7); ctx.fill();
    } else {
      ctx.strokeStyle = body; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, -1.6); ctx.lineTo(2.2, -0.2); ctx.moveTo(0, 1.6); ctx.lineTo(2.4, 0.4); ctx.stroke();
      ctx.fillStyle = '#121212'; ctx.fillRect(0.6, -0.35, gun === 'flame' ? 4.5 : 5.2, 0.7);
      ctx.fillStyle = '#4b4b4b'; ctx.fillRect(1.2, -0.35, 1.6, 0.3);
      if (gun === 'flame') { ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(5.2, 0, 0.55, 0, 7); ctx.fill(); }
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(2.3, -0.1, 0.45, 0, 7); ctx.arc(2.6, 0.4, 0.45, 0, 7); ctx.fill();
    }
    // Helm
    const helm = gun === 'tool' ? '#eab308' : faction === 'allianz' ? U.mix('#5a6650', P.team, 0.15) : '#1c1c20';
    G.dome(ctx, 0.2, 0, 1.45, helm);
    if (faction === 'schatten') { ctx.fillStyle = P.team; ctx.fillRect(0.9, -0.8, 0.5, 1.6); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(1.1, -0.9, 0.35, 1.8); }
  }
  function bug(ctx, P, big, frame, eng) {
    const s = big ? 1.35 : 1;
    ctx.save(); ctx.scale(s, s);
    const ph = frame * PI / 2;
    ctx.strokeStyle = '#1e0b2b'; ctx.lineWidth = 0.55;
    for (let i = -1; i <= 1; i++) for (const sd of [-1, 1]) {
      const sw = Math.sin(ph + i * 2 + (sd > 0 ? PI : 0)) * 0.9;
      ctx.beginPath(); ctx.moveTo(i * 1.2, sd * 0.8); ctx.lineTo(i * 1.4 + sw, sd * 2.6); ctx.lineTo(i * 1.6 + sw * 1.4, sd * 3.8); ctx.stroke();
    }
    G.plate(ctx, () => { ctx.beginPath(); ctx.ellipse(-1.8, 0, 2.2, 1.7, 0, 0, 7); }, U.mix(P.hull, '#000', 0.1), { r: 2.4, mat: 'chitin', ew: 0.35, bevel: false });
    G.plate(ctx, () => { ctx.beginPath(); ctx.ellipse(0.6, 0, 1.4, 1.3, 0, 0, 7); }, P.hull, { r: 1.6, ew: 0.35, bevel: false });
    G.dome(ctx, 2.2, 0, 0.95, U.shade(P.hull, 0.15));
    ctx.strokeStyle = '#e9d5ff'; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(2.9, -0.5); ctx.lineTo(3.8, -0.9); ctx.moveTo(2.9, 0.5); ctx.lineTo(3.8, 0.9); ctx.stroke();
    if (eng) { G.glow(ctx, -1.9, 0, 2.6, '#22d3ee', 0.9); G.dome(ctx, -1.9, 0, 1.2, '#06b6d4'); ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(2.9, -0.6); ctx.quadraticCurveTo(5, -2.2, 5.2, -0.4); ctx.moveTo(2.9, 0.6); ctx.quadraticCurveTo(5, 2.2, 5.2, 0.4); ctx.stroke(); }
    else if (big) { G.glow(ctx, -1.9, 0, 2, '#a3e635', 0.8); G.dome(ctx, -1.9, 0, 1.1, '#84cc16'); }
    else { ctx.fillStyle = P.team; ctx.beginPath(); ctx.arc(-1.9, 0, 0.6, 0, 7); ctx.fill(); }
    ctx.fillStyle = P.glow; ctx.beginPath(); ctx.arc(2.5, -0.4, 0.3, 0, 7); ctx.arc(2.5, 0.4, 0.3, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------- Fahrzeuge: Rumpf & Turm-Zeichner ----------
  // Jeder Eintrag: { w, h, frames, body(ctx,P,frame), turret?(ctx,P), tx (Turmversatz), tw,th, live?(ctx,o,P) }
  const ART = {
    jeep: (def) => ({
      w: 30, h: 22, frames: 3,
      body(ctx, P, f) {
        const L = 24, W = 14;
        for (const [x, y] of [[7, -6.2], [7, 6.2], [-7, -6.2], [-7, 6.2]]) { ctx.save(); ctx.translate(x, y); ctx.translate(0, 0); tire(ctx, 0, 0, 5.4 + (f % 2) * 0.01, 2.8); ctx.restore(); }
        G.plate(ctx, () => G.poly(ctx, [[L / 2, -4.6], [L / 2 - 1, -W / 2 + 1], [-L / 2 + 1, -W / 2 + 1], [-L / 2, -4.5], [-L / 2, 4.5], [-L / 2 + 1, W / 2 - 1], [L / 2 - 1, W / 2 - 1], [L / 2, 4.6]]), P.hull, { mat: P.mat, r: 14, hi: 0.22 });
        G.plate(ctx, () => G.rr(ctx, 3, -5, 8, 10, 1.5), U.shade(P.hull, 0.06), { r: 7, bevel: true });
        G.lines(ctx, [[5, -5, 5, 5], [8, -5, 8, 5]]);
        G.grille(ctx, 10.6, -3, 1.2, 6, 5);
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(11.3, -4.8, 0.8, 1.4); ctx.fillRect(11.3, 3.4, 0.8, 1.4);
        // Windschutzscheibe
        const g = ctx.createLinearGradient(1, -5, 3, 5); g.addColorStop(0, '#e0f2fe'); g.addColorStop(0.5, P.glass); g.addColorStop(1, '#1e3a5f');
        ctx.fillStyle = g; ctx.fillRect(1.2, -5, 1.6, 10);
        // Sitze & Ladefläche
        ctx.fillStyle = '#222'; G.rr(ctx, -3.5, -4.6, 3.5, 3.6, 0.8); ctx.fill(); G.rr(ctx, -3.5, 1, 3.5, 3.6, 0.8); ctx.fill();
        ctx.strokeStyle = U.shade(P.hull, -0.5); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-0.5, -6.2); ctx.lineTo(-0.5, 6.2); ctx.stroke();
        G.dome(ctx, -10.2, 0, 2.2, '#1d1d1f');
        stripe(ctx, -11.5, -6.4, 9, 1.2, P.team); stripe(ctx, -11.5, 5.2, 9, 1.2, P.team);
        G.rivets(ctx, [[-11, -3], [-11, 3], [10, -5.5], [10, 5.5]]);
      },
      tx: -4, tw: 16, th: 10,
      turret(ctx, P) {
        G.dome(ctx, 0, 0, 2.8, U.shade(P.hull, -0.2));
        G.barrel(ctx, 1, 9, 0, 0.7, '#2a2a2a'); ctx.fillStyle = '#111'; ctx.fillRect(8.5, -1, 1.2, 2);
        G.rr(ctx, -0.5, -2.2, 3.5, 1.3, 0.3); ctx.fillStyle = '#3f3f3f'; ctx.fill();
      },
    }),
    buggy: (def) => ({
      w: 30, h: 22, frames: 3,
      body(ctx, P, f) {
        tire(ctx, -7, -7, 7, 3.6); tire(ctx, -7, 7, 7, 3.6); tire(ctx, 7.5, -5.5, 5, 2.6); tire(ctx, 7.5, 5.5, 5, 2.6);
        G.plate(ctx, () => G.poly(ctx, [[12, 0], [9, -3.5], [-9, -4.5], [-11, -2.5], [-11, 2.5], [-9, 4.5], [9, 3.5]]), P.hull, { mat: P.mat, r: 12 });
        ctx.strokeStyle = '#0e0e10'; ctx.lineWidth = 1.1;
        G.rr(ctx, -6, -5, 8, 10, 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(2, 5); ctx.moveTo(-6, 5); ctx.lineTo(2, -5); ctx.stroke();
        ctx.strokeStyle = P.team; ctx.lineWidth = 0.6; G.rr(ctx, -6, -5, 8, 10, 2); ctx.stroke();
        G.barrel(ctx, -13, -9, -2.2, 0.7, '#6b6b70'); G.barrel(ctx, -13, -9, 2.2, 0.7, '#6b6b70');
        ctx.fillStyle = P.team; G.poly(ctx, [[12, 0], [9, -1.2], [5, -1.2], [5, 1.2], [9, 1.2]]); ctx.fill();
        ctx.fillStyle = '#fca5a5'; ctx.fillRect(10.5, -2.6, 0.8, 1); ctx.fillRect(10.5, 1.6, 0.8, 1);
      },
      tx: -2, tw: 14, th: 8,
      turret(ctx, P) {
        if (def.draw.aa) {
          for (const y of [-2.4, -0.8, 0.8, 2.4]) G.barrel(ctx, 0.5, 9.5, y, 0.45, '#2a2a2e');
          G.plate(ctx, () => G.rr(ctx, -3.5, -3.4, 6, 6.8, 1), '#2e2e34', { r: 5 });
          ctx.fillStyle = P.team; ctx.fillRect(-3, -0.5, 2, 1); G.light(ctx, -1.5, -2.4, 0.5, '#ef4444');
          return;
        }
        G.dome(ctx, 0, 0, 2.3, '#262629'); G.barrel(ctx, 0.5, 8.5, -0.8, 0.55, '#202020'); G.barrel(ctx, 0.5, 8.5, 0.8, 0.55, '#202020');
      },
    }),
    tank: (def) => {
      const sleek = def.draw.sleek;
      return {
        w: 36, h: 28, frames: 3,
        body(ctx, P, f) {
          const L = 28, W = 21;
          tracks(ctx, L, W, 5.6, f);
          if (sleek) {
            G.plate(ctx, () => G.poly(ctx, [[15, 0], [9, -7.6], [-13, -7.4], [-14.5, -4], [-14.5, 4], [-13, 7.4], [9, 7.6]]), P.hull, { mat: P.mat, r: 16, hi: 0.12 });
            G.lines(ctx, [[9, -7.6, 3, 0], [9, 7.6, 3, 0], [3, 0, -13, 0]], 'rgba(255,255,255,0.12)', 0.5);
            ctx.strokeStyle = P.team; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.moveTo(12, -2.5); ctx.lineTo(8, -6.6); ctx.lineTo(-12, -6.5); ctx.moveTo(12, 2.5); ctx.lineTo(8, 6.6); ctx.lineTo(-12, 6.5); ctx.stroke(); ctx.globalAlpha = 1;
            G.grille(ctx, -12.5, -3.5, 4, 7, 5, true);
          } else {
            G.plate(ctx, () => G.poly(ctx, [[14.5, -5.8], [12, -7.8], [-13.5, -7.8], [-14.5, -6.5], [-14.5, 6.5], [-13.5, 7.8], [12, 7.8], [14.5, 5.8]]), P.hull, { mat: P.mat, r: 16 });
            G.plate(ctx, () => G.poly(ctx, [[14.5, -5.8], [10, -5.2], [10, 5.2], [14.5, 5.8]]), U.shade(P.hull, 0.12), { bevel: false, ew: 0.4 });
            G.grille(ctx, -13, -5, 5, 10, 6, true);
            G.plate(ctx, () => G.rr(ctx, -8, -7.6, 6, 2.2, 0.4), U.shade(P.hull, -0.15), { bevel: false, ew: 0.3 });
            G.plate(ctx, () => G.rr(ctx, 1, 5.4, 7, 2.2, 0.4), U.shade(P.hull, -0.15), { bevel: false, ew: 0.3 });
            ctx.fillStyle = '#fef9c3'; ctx.fillRect(13.6, -5, 0.8, 1.4); ctx.fillRect(13.6, 3.6, 0.8, 1.4);
            G.rivets(ctx, [[12, -6.8], [12, 6.8], [-12, -6.8], [-12, 6.8], [0, -7], [0, 7]]);
            stripe(ctx, -14.4, -1.2, 1.4, 2.4, P.team);
          }
        },
        tx: -1, tw: 34, th: 20,
        turret(ctx, P) {
          if (def.draw.aa) {
            // Zwillingsflak mit Radarschüssel
            for (const y of [-3.4, 3.4]) { G.barrel(ctx, 2, 14, y, 0.8, '#4b5563'); G.barrel(ctx, 2, 14, y + (y < 0 ? 1.5 : -1.5), 0.8, '#4b5563'); ctx.fillStyle = '#111'; ctx.fillRect(13.4, y - 1.2, 1.2, 2.4 + 0); }
            G.plate(ctx, () => G.poly(ctx, [[5, -5.6], [-6, -5.6], [-7.5, -3], [-7.5, 3], [-6, 5.6], [5, 5.6]]), P.hull, { mat: P.mat, r: 8 });
            G.dome(ctx, -3.5, 0, 2.8, '#d1d5db', 2.2); ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(-1.2, 0); ctx.stroke();
            stripe(ctx, 1, -5.4, 3, 10.8, P.team);
            return;
          }
          if (sleek) {
            G.barrel(ctx, 3, 15, 0, 1.3, '#2a2a30');
            for (let i = 0; i < 3; i++) { ctx.fillStyle = '#3f3f46'; ctx.fillRect(6 + i * 2.6, -1.8, 1, 3.6); }
            G.plate(ctx, () => G.poly(ctx, [[6, 0], [2, -5], [-6, -5.2], [-7.5, 0], [-6, 5.2], [2, 5]]), U.shade(P.hull, 0.05), { mat: P.mat, r: 8 });
            G.glow(ctx, 15.5, 0, 3.2, P.glow, 0.9); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(15.3, 0, 0.9, 0, 7); ctx.fill();
            ctx.strokeStyle = P.team; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(-5.5, -4.2); ctx.moveTo(2, 4); ctx.lineTo(-5.5, 4.2); ctx.stroke();
          } else {
            G.barrel(ctx, 4, 17, 0, 1.05, '#4b5563');
            G.barrel(ctx, 9, 11.5, 0, 1.45, '#3f4652');
            ctx.fillStyle = '#1f2937'; ctx.fillRect(16.4, -1.7, 1.8, 3.4); ctx.fillStyle = '#000'; ctx.fillRect(17.2, -0.5, 1, 1);
            G.plate(ctx, () => G.poly(ctx, [[6.5, -3.8], [4, -6.2], [-6.5, -6.2], [-8, -4], [-8, 4], [-6.5, 6.2], [4, 6.2], [6.5, 3.8]]), P.hull, { mat: P.mat, r: 9 });
            G.plate(ctx, () => G.rr(ctx, 4, -3, 3.2, 6, 0.6), U.shade(P.hull, -0.2), { bevel: false, ew: 0.4 });
            G.dome(ctx, -2.5, -2.5, 1.9, U.shade(P.hull, 0.05)); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-2.9, -3.5, 1.6, 0.4);
            ctx.strokeStyle = '#111'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(-6, 3.5); ctx.lineTo(-11, 3.8); ctx.stroke();
            G.plate(ctx, () => G.rr(ctx, -7.5, -1.5, 3, 4.6, 0.5), '#4b5240', { bevel: false, ew: 0.3 });
            stripe(ctx, -6.4, -6, 8, 1.1, P.team);
            G.rivets(ctx, [[5, -4.5], [5, 4.5], [-6.5, -5], [-6.5, 5]], 0.35);
          }
        },
      };
    },
    arty: () => ({
      w: 36, h: 26, frames: 3,
      body(ctx, P, f) {
        tracks(ctx, 26, 19, 5, f);
        G.plate(ctx, () => G.poly(ctx, [[13, -5.5], [11, -7], [-13, -7], [-13, 7], [11, 7], [13, 5.5]]), P.hull, { mat: P.mat, r: 15 });
        G.plate(ctx, () => G.rr(ctx, 5, -5.5, 7, 11, 1), U.shade(P.hull, 0.1), { r: 6 });
        const g = ctx.createLinearGradient(10, 0, 12, 0); g.addColorStop(0, P.glass); g.addColorStop(1, '#0c4a6e'); ctx.fillStyle = g; ctx.fillRect(10.5, -4.5, 1.3, 9);
        G.hazard(ctx, -13, -6.6, 2, 13.2, 1.5);
        stripe(ctx, 5, -7, 7, 1, P.team);
      },
      tx: -4, tw: 44, th: 18,
      turret(ctx, P) {
        G.barrel(ctx, 2, 21, 0, 1.15, '#4b5563'); ctx.fillStyle = '#1f2937'; ctx.fillRect(20, -1.7, 2.2, 3.4);
        G.barrel(ctx, 2, 9, -2.2, 0.55, '#6b7280'); G.barrel(ctx, 2, 9, 2.2, 0.55, '#6b7280');
        G.plate(ctx, () => G.rr(ctx, -7, -6, 10, 12, 2), P.hull, { mat: P.mat, r: 8 });
        G.grille(ctx, -6, -4, 3, 8, 4, true); stripe(ctx, -1, -6, 3, 12, P.team);
      },
    }),
    rocketarty: () => ({
      w: 34, h: 24, frames: 3,
      body(ctx, P, f) {
        for (const x of [-9, -3, 8]) { tire(ctx, x, -7, 4.6, 2.6); tire(ctx, x, 7, 4.6, 2.6); }
        G.plate(ctx, () => G.rr(ctx, -13, -6.5, 26, 13, 1.5), P.hull, { mat: P.mat, r: 14 });
        G.plate(ctx, () => G.rr(ctx, 6, -5.5, 7, 11, 1.8), U.shade(P.hull, 0.08), { r: 6 });
        const g = ctx.createLinearGradient(11, 0, 13, 0); g.addColorStop(0, P.glass); g.addColorStop(1, '#3f0d0d'); ctx.fillStyle = g; ctx.fillRect(11.5, -4.4, 1.2, 8.8);
        stripe(ctx, 6, -1, 7, 2, P.team);
      },
      tx: -4, tw: 20, th: 16, tpiv: 0,
      turret(ctx, P) {
        G.plate(ctx, () => G.rr(ctx, -7, -6, 14, 12, 1.2), U.shade(P.hull, -0.05), { mat: P.mat, r: 9 });
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const y = -4 + r * 4, x = 6.2; ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.ellipse(x, y + (c - 1.5) * 0 , 0.6, 1.2, 0, 0, 7); ctx.fill(); }
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(3 + c * -3.2, -3.8 + r * 3.8, 1.2, 0, 7); ctx.fill(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(3 + c * -3.2, -3.8 + r * 3.8, 0.5, 0, 7); ctx.fill(); }
        ctx.strokeStyle = P.team; ctx.lineWidth = 0.6; G.rr(ctx, -7, -6, 14, 12, 1.2); ctx.stroke();
      },
    }),
    walker: () => ({
      w: 58, h: 52, frames: 4, fps: 5,
      body(ctx, P, f) {
        const sw = [0, 1, 0, -1][f] * 5;
        for (const s of [-1, 1]) {
          const fx = sw * s;
          // Oberschenkel & Fuß
          ctx.strokeStyle = U.shade(P.hull, -0.45); ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(0, s * 9); ctx.lineTo(fx * 0.5, s * 15); ctx.stroke();
          ctx.lineWidth = 3.2; ctx.strokeStyle = U.shade(P.hull, -0.25); ctx.beginPath(); ctx.moveTo(fx * 0.5, s * 15); ctx.lineTo(fx, s * 19); ctx.stroke();
          G.plate(ctx, () => G.rr(ctx, fx - 5, s * 19 - 3, 10, 6, 1.5), U.shade(P.hull, -0.3), { r: 6 });
          G.dome(ctx, fx * 0.5, s * 15, 2.2, P.metal);
        }
        G.plate(ctx, () => G.poly(ctx, [[15, -10], [11, -14], [-13, -14], [-17, -9], [-17, 9], [-13, 14], [11, 14], [15, 10]]), P.hull, { mat: P.mat, r: 22 });
        G.lines(ctx, [[-13, -14, -13, 14], [7, -14, 7, 14]]);
        G.grille(ctx, -16, -6, 3, 12, 6, true);
        for (const s of [-1, 1]) { G.plate(ctx, () => G.rr(ctx, -10, s * 11 - 2.5, 14, 5, 1), U.shade(P.hull, -0.1), { r: 7 }); stripe(ctx, -9, s * 11 - 0.6, 12, 1.2, P.team); }
        G.rivets(ctx, [[13, -9], [13, 9], [-15, -11], [-15, 11], [9, -13], [9, 13]], 0.5);
      },
      tx: 0, tw: 50, th: 32,
      turret(ctx, P) {
        for (const y of [-4.2, 4.2]) { G.barrel(ctx, 6, 23, y, 1.5, '#4b5563'); G.barrel(ctx, 14, 17, y, 2, '#374151'); ctx.fillStyle = '#111'; ctx.fillRect(22.5, y - 2, 2, 4); }
        G.plate(ctx, () => G.poly(ctx, [[10, -8], [6, -11], [-10, -11], [-12, -7], [-12, 7], [-10, 11], [6, 11], [10, 8]]), U.shade(P.hull, 0.06), { mat: P.mat, r: 14 });
        for (const s of [-1, 1]) {
          G.plate(ctx, () => G.rr(ctx, -6, s * 12.5 - 3, 9, 6, 1), '#3f4652', { r: 5 });
          for (let i = 0; i < 3; i++) { ctx.fillStyle = '#0b0b0b'; ctx.beginPath(); ctx.arc(2.2, s * 12.5 - 1.6 + i * 1.6, 0.6, 0, 7); ctx.fill(); }
        }
        G.dome(ctx, -4, 0, 3.4, U.shade(P.hull, 0.1)); ctx.fillStyle = P.glass; ctx.fillRect(-2.2, -1.6, 1, 3.2);
        stripe(ctx, -11, -1.2, 5, 2.4, P.team);
        G.rivets(ctx, [[8, -7], [8, 7], [-10, -9], [-10, 9]], 0.45);
      },
    }),
    spider: () => ({
      w: 54, h: 54, frames: 4, fps: 6,
      body(ctx, P, f) {
        const legs = [[0.6, 1], [-0.6, 1], [0, 1], [0.6, -1], [-0.6, -1], [0, -1]];
        legs.forEach(([lx, s], i) => {
          const sw = Math.sin(f * PI / 2 + i * 2) * 3;
          const ax = lx * 9, ay = s * 6, kx = lx * 15 + sw, ky = s * 15, fx = lx * 19 + sw * 1.5, fy = s * 21;
          ctx.strokeStyle = '#0f0f12'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
          ctx.strokeStyle = U.shade(P.hull, 0.2); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
          G.dome(ctx, kx, ky, 1.6, P.metal); ctx.fillStyle = P.team; ctx.beginPath(); ctx.arc(fx, fy, 0.9, 0, 7); ctx.fill();
        });
        G.plate(ctx, () => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 11); } ctx.closePath(); }, P.hull, { mat: P.mat, r: 16 });
        G.lines(ctx, [[-14, 0, 14, 0], [-7, -9.5, 7, 9.5], [-7, 9.5, 7, -9.5]], 'rgba(255,255,255,0.08)', 0.5);
        ctx.strokeStyle = P.team; ctx.lineWidth = 0.7; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 8.5); } ctx.closePath(); ctx.stroke();
        G.grille(ctx, -11, -3, 4, 6, 4, true);
      },
      tx: 2, tw: 44, th: 22,
      turret(ctx, P) {
        G.barrel(ctx, 2, 19, 0, 2, '#26262c');
        for (let i = 0; i < 4; i++) { G.barrel(ctx, 7 + i * 2.8, 8.4 + i * 2.8, 0, 2.8, U.shade(P.team, -0.3)); }
        G.glow(ctx, 19.5, 0, 4, P.glow, 0.95); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(19.2, 0, 1.1, 0, 7); ctx.fill();
        G.plate(ctx, () => { ctx.beginPath(); ctx.ellipse(-1, 0, 7.5, 6, 0, 0, 7); }, U.shade(P.hull, 0.08), { mat: P.mat, r: 8 });
        G.dome(ctx, -2.5, 0, 2.4, '#111'); G.glow(ctx, -2.5, 0, 2, P.glow, 0.7);
      },
    }),
    hover: (def) => {
      const arty = def.draw.arty;
      return {
        w: 34, h: 30, frames: 1, hoverBob: true,
        body(ctx, P) {
          G.glow(ctx, -6, 0, 9, P.glow, 0.45);
          G.plate(ctx, () => { ctx.beginPath(); ctx.moveTo(14, 0); ctx.bezierCurveTo(6, -13, -8, -12, -12, -6); ctx.lineTo(-9, 0); ctx.lineTo(-12, 6); ctx.bezierCurveTo(-8, 12, 6, 13, 14, 0); ctx.closePath(); }, P.hull, { mat: P.mat, r: 15 });
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5;
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-2 + i * 3, 0, 1.2, 8 - i * 1.5, 0, -PI / 2, PI / 2); ctx.stroke(); }
          ctx.strokeStyle = P.team; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(12, -1.5); ctx.bezierCurveTo(5, -10, -6, -10, -10, -5.5); ctx.moveTo(12, 1.5); ctx.bezierCurveTo(5, 10, -6, 10, -10, 5.5); ctx.stroke();
          for (const y of [-5, 5]) { G.glow(ctx, -11, y, 3.5, P.glow, 0.9); ctx.fillStyle = '#ecfeff'; ctx.beginPath(); ctx.arc(-11, y, 0.9, 0, 7); ctx.fill(); }
        },
        tx: 1, tw: 22, th: 14,
        turret(ctx, P) {
          if (def.draw.aa) {
            G.glow(ctx, 0, 0, 6, '#22d3ee', 0.5);
            for (const [x, y, h] of [[3, -2.2, 7], [3, 2.2, 7], [5.5, 0, 9]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2); crystal(ctx, 0, 0, h, '#22d3ee'); ctx.restore(); }
            G.dome(ctx, -1, 0, 2.6, U.shade(P.hull, 0.2));
            return;
          }
          if (arty) { G.glow(ctx, 0, 0, 7, '#a3e635', 0.5); G.dome(ctx, 0, 0, 4.6, '#65a30d'); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(-1.4, -1.6, 1.2, 0, 7); ctx.fill(); G.barrel(ctx, 3, 9, 0, 1.2, P.metal); }
          else {
            G.plate(ctx, () => G.poly(ctx, [[9, 0], [2, -2.6], [-3, -2], [-3, 2], [2, 2.6]]), '#c4b5fd', { r: 8, hi: 0.4 });
            G.glow(ctx, 8.5, 0, 2.6, P.glow, 0.9);
          }
        },
      };
    },
    tripod: (def) => {
      const small = def.draw.small, R = small ? 15 : 24;
      return {
        w: R * 2.8, h: R * 2.8, frames: 4, fps: small ? 5 : 3.5,
        body(ctx, P, f) {
          for (let i = 0; i < 3; i++) {
            const a = i / 3 * PI * 2 + PI / 3 + Math.sin(f * PI / 2 + i * 2.1) * 0.22;
            const kx = Math.cos(a) * R * 0.75, ky = Math.sin(a) * R * 0.75, fx = Math.cos(a) * R * 1.25, fy = Math.sin(a) * R * 1.25;
            ctx.strokeStyle = '#140820'; ctx.lineWidth = small ? 3 : 4.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(kx * 1.1, ky * 1.1 - 4, fx, fy); ctx.stroke();
            ctx.strokeStyle = U.shade(P.hull, 0.15); ctx.lineWidth = small ? 1.4 : 2.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(kx * 1.1, ky * 1.1 - 4, fx, fy); ctx.stroke();
            G.dome(ctx, kx, ky - 1, small ? 1.6 : 2.4, P.metal);
            ctx.fillStyle = P.glow; ctx.beginPath(); ctx.arc(fx, fy, small ? 1 : 1.5, 0, 7); ctx.fill();
          }
        },
        tx: 0, tw: R * 2.4, th: R * 1.8, tpiv: 0, lift: small ? 3 : 6,
        turret(ctx, P) {
          const r = R * 0.7;
          G.plate(ctx, () => { ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.82, 0, 0, 7); }, P.hull, { mat: P.mat, r: r * 1.1, hi: 0.3 });
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.6;
          for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-r * 0.15 * i, 0, r * (1 - i * 0.2), r * 0.82 * (1 - i * 0.2), 0, PI * 0.6, PI * 1.4); ctx.stroke(); }
          ctx.strokeStyle = P.team; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.74, 0, -0.9, 0.9); ctx.stroke();
          // Prisma
          G.glow(ctx, r * 0.55, 0, r * 0.6, '#f0abfc', 0.7);
          G.plate(ctx, () => G.poly(ctx, [[r * 1.05, 0], [r * 0.45, -r * 0.3], [r * 0.2, 0], [r * 0.45, r * 0.3]]), '#f5d0fe', { r: r * 0.6, hi: 0.5, lo: 0.1 });
          if (!small) { for (const y of [-r * 0.55, r * 0.55]) { G.dome(ctx, -r * 0.3, y, r * 0.18, '#5b2a7a'); G.glow(ctx, -r * 0.3, y, r * 0.15, '#22d3ee', 0.8); } }
        },
      };
    },
    harvester: (def) => {
      const hov = def.draw.hover;
      return {
        w: 40, h: 30, frames: 3,
        body(ctx, P, f) {
          const L = 30, W = 20;
          if (hov) { G.glow(ctx, 0, 0, 17, P.glow, 0.35); }
          else tracks(ctx, L - 4, W, 5, f);
          G.plate(ctx, () => G.rr(ctx, -15, -8, 25, 16, 2.2), P.hull, { mat: P.mat, r: 18 });
          // Ladebehälter (Inhalt wird live gezeichnet)
          G.plate(ctx, () => G.rr(ctx, -13.5, -6.2, 15, 12.4, 1.2), '#1e2530', { bevel: false, ew: 0.5 });
          G.lines(ctx, [[-13.5, -2, 1.5, -2], [-13.5, 2, 1.5, 2]], 'rgba(255,255,255,0.08)');
          // Kabine
          G.plate(ctx, () => G.rr(ctx, 3, -7.5, 6.5, 6, 1), U.shade(P.hull, 0.1), { r: 5 });
          const g = ctx.createLinearGradient(8, -7, 9.5, -2); g.addColorStop(0, '#e0f2fe'); g.addColorStop(1, P.glass); ctx.fillStyle = g; ctx.fillRect(8.4, -7, 1, 5);
          G.hazard(ctx, 3, 1.5, 6.5, 2, 1.2);
          stripe(ctx, 3, 4.6, 6.5, 1.4, P.team);
          // Erntetrommel
          G.plate(ctx, () => G.rr(ctx, 10.5, -10, 5, 20, 1.5), '#52525b', { r: 8 });
          ctx.fillStyle = '#a1a1aa'; for (let y = -9 + (f % 3); y < 10; y += 3) ctx.fillRect(14.6, y, 1.6, 1.2);
          G.light(ctx, 10, -8.6, 0.8, '#fbbf24');
        },
        live(ctx, o, P) {
          const fill = U.clamp((o.cargo || 0) / 500, 0, 1);
          if (fill <= 0) return;
          ctx.save(); ctx.rotate(o.angle);
          const w = 15 * fill; G.glow(ctx, -6, 0, 9 * fill + 2, '#22d3ee', 0.25);
          ctx.fillStyle = '#0891b2'; ctx.fillRect(-13.3, -6, w, 12);
          ctx.fillStyle = '#67e8f9'; for (let i = 0; i < w - 1; i += 2.4) { ctx.beginPath(); ctx.moveTo(-13 + i, 5); ctx.lineTo(-12 + i, -4); ctx.lineTo(-11 + i, 5); ctx.fill(); }
          ctx.restore();
        },
      };
    },
    mcv: () => ({
      w: 46, h: 30, frames: 3,
      body(ctx, P, f) {
        tracks(ctx, 38, 22, 5.4, f);
        G.plate(ctx, () => G.rr(ctx, -19, -8.5, 38, 17, 2), P.hull, { mat: P.mat, r: 22 });
        G.plate(ctx, () => G.rr(ctx, 9, -7, 9, 14, 1.8), U.shade(P.hull, 0.1), { r: 7 });
        const g = ctx.createLinearGradient(16, 0, 18, 0); g.addColorStop(0, P.glass); g.addColorStop(1, '#082f49'); ctx.fillStyle = g; ctx.fillRect(16.4, -5.8, 1.4, 11.6);
        // gefalteter Kran und Container
        G.plate(ctx, () => G.rr(ctx, -17, -7, 12, 14, 1), U.shade(P.hull, -0.15), { r: 8 });
        G.lines(ctx, [[-17, -3.5, -5, -3.5], [-17, 0, -5, 0], [-17, 3.5, -5, 3.5]]);
        G.plate(ctx, () => G.rr(ctx, -4, -6.5, 12, 13, 1), '#5b6470', { r: 8 });
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(7, 0); ctx.stroke();
        ctx.strokeStyle = '#a16207'; ctx.lineWidth = 0.5; for (let x = -14; x < 7; x += 2) { ctx.beginPath(); ctx.moveTo(x, -0.8); ctx.lineTo(x + 1, 0.8); ctx.stroke(); }
        G.dome(ctx, 7, 0, 2, '#facc15');
        G.hazard(ctx, -19, -8.5, 2, 17, 1.4);
        stripe(ctx, 9, -8.5, 9, 1.4, P.team); stripe(ctx, 9, 7.1, 9, 1.4, P.team);
        G.light(ctx, -3, -7.5, 0.8, '#f59e0b'); G.light(ctx, -3, 7.5, 0.8, '#f59e0b');
      },
    }),
    vtol: () => ({
      w: 40, h: 40, frames: 3, air: true,
      body(ctx, P, f) {
        G.plate(ctx, () => G.poly(ctx, [[4, -16], [7, -16], [3, 16], [0, 16]]), U.shade(P.hull, -0.1), { mat: P.mat, r: 16 });
        G.plate(ctx, () => G.poly(ctx, [[16, 0], [12, -3.2], [-12, -2.6], [-15, -5], [-16, -5], [-14, 0], [-16, 5], [-15, 5], [-12, 2.6], [12, 3.2]]), P.hull, { mat: P.mat, r: 16 });
        const g = ctx.createLinearGradient(8, -2, 14, 2); g.addColorStop(0, '#f0f9ff'); g.addColorStop(0.5, P.glass); g.addColorStop(1, '#0c4a6e');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(10, 0, 3.6, 1.9, 0, 0, 7); ctx.fill();
        for (const s of [-1, 1]) {
          ctx.save(); ctx.translate(2, s * 13);
          G.dome(ctx, 0, 0, 5.2, U.shade(P.hull, -0.25)); ctx.fillStyle = '#0d0d0f'; ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(200,200,210,0.55)'; ctx.lineWidth = 1.1;
          for (let i = 0; i < 3; i++) { const a = f * 0.7 + i * PI * 2 / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 4, Math.sin(a) * 4); ctx.stroke(); }
          G.dome(ctx, 0, 0, 1.1, '#6b7280'); ctx.restore();
          G.plate(ctx, () => G.rr(ctx, 4, s * 8 - 1.2, 6, 2.4, 0.8), '#3f3f46', { bevel: false, ew: 0.3 });
        }
        stripe(ctx, -10, -0.7, 6, 1.4, P.team);
        G.light(ctx, -15, -4.8, 0.6, '#ef4444'); G.light(ctx, -15, 4.8, 0.6, '#22c55e');
      },
    }),
    jet: () => ({
      w: 38, h: 36, frames: 1, air: true,
      body(ctx, P) {
        G.plate(ctx, () => G.poly(ctx, [[17, 0], [5, -3], [-6, -15], [-11, -15], [-8, -3], [-14, -3.5], [-15, 0], [-14, 3.5], [-8, 3], [-11, 15], [-6, 15], [5, 3]]), P.hull, { mat: P.mat, r: 18 });
        G.lines(ctx, [[5, -3, -6, -12], [5, 3, -6, 12], [-8, -3, -8, 3]], 'rgba(255,255,255,0.1)');
        ctx.strokeStyle = P.team; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-6, -14.5); ctx.lineTo(-10.5, -14.5); ctx.moveTo(-6, 14.5); ctx.lineTo(-10.5, 14.5); ctx.stroke();
        ctx.fillStyle = P.team; G.poly(ctx, [[-9, -1], [-14, -1], [-14, 1], [-9, 1]]); ctx.fill();
        const g = ctx.createLinearGradient(6, -1.5, 11, 1.5); g.addColorStop(0, '#fff1f2'); g.addColorStop(0.5, P.glass); g.addColorStop(1, '#450a0a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(8, 0, 4, 1.6, 0, 0, 7); ctx.fill();
        for (const y of [-9, 9]) { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-4, y - 0.6, 6, 1.2); ctx.fillStyle = '#ef4444'; ctx.fillRect(1.6, y - 0.6, 0.8, 1.2); }
      },
      live(ctx, o) { ctx.save(); ctx.rotate(o.angle); ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, -16, 0, 4 + Math.random() * 2, '#fb923c', 0.9); ctx.restore(); },
    }),
    saucer: () => ({
      w: 38, h: 38, frames: 1, air: true,
      body(ctx, P) {
        G.plate(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); }, P.hull, { mat: P.mat, r: 16, hi: 0.3 });
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.6;
        for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * 14.5, Math.sin(a) * 14.5); ctx.stroke(); }
        ctx.strokeStyle = P.team; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.stroke();
        G.dome(ctx, 0, 0, 6, '#c4b5fd'); G.glow(ctx, 0, 0, 5, '#e9d5ff', 0.6);
        G.plate(ctx, () => G.poly(ctx, [[17, 0], [12, -2], [12, 2]]), '#f5d0fe', { bevel: false });
      },
      live(ctx, o, P) {
        const a0 = (o.anim || 0) * 2;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) { const a = a0 + i / 6 * PI * 2; G.glow(ctx, Math.cos(a) * 13, Math.sin(a) * 13, 2.6, i % 2 ? '#22d3ee' : '#f0abfc', 0.9); }
        ctx.restore();
      },
    }),
  };

  // ---------- Einheiten-Zeichnung (öffentlich) ----------
  const artCache = new Map();
  function artFor(def) {
    let a = artCache.get(def.id); if (a) return a;
    const t = def.draw.t;
    const mk = ART[t === 'buggy' ? 'buggy' : t];
    a = mk ? mk(def) : null;
    artCache.set(def.id, a);
    return a;
  }
  function bodySprite(def, color, frame) {
    const A = artFor(def), P = pal(def.faction, color);
    return G.sprite(def.id + '|' + color + '|b' + frame, A.w, A.h, (c) => A.body(c, P, frame), 3);
  }
  function turretSprite(def, color) {
    const A = artFor(def), P = pal(def.faction, color);
    const pv = A.tpiv != null ? A.tpiv : 0.25;
    return G.sprite(def.id + '|' + color + '|t', A.tw, A.th, (c) => { c.translate(-A.tw * pv, 0); A.turret(c, P); }, 3);
  }
  // o: { color, angle, turret, anim, moving, alt, cargo, recoil, shadowOnly }
  function drawUnit(ctx, def, o) {
    const t = def.draw.t;
    if (t === 'squad' || t === 'swarm') return drawSquad(ctx, def, o);
    const A = artFor(def), P = pal(def.faction, o.color);
    const frame = A.frames > 1 && (o.moving || A.air) ? Math.floor((o.anim || 0) * (A.fps || 10)) % A.frames : 0;
    const body = bodySprite(def, o.color, frame);
    const sh = G.shadow(def.id + '|' + o.color + '|b' + frame, body, 2.2, A.air ? 0.35 : 0.5);
    const alt = A.air ? (o.alt != null ? o.alt : 34) : 0;
    const bob = A.air || A.hoverBob ? Math.sin((o.anim || 0) * 2.5) * 1.2 : 0;
    const lift = (A.lift || 0) + (A.hoverBob ? 3 : 0);
    if (A.air) G.blit(ctx, sh, alt * 0.35 + 2, alt * 0.85 + 3, o.angle, 0.9, 0.85);
    else G.blit(ctx, sh, 2.5 + lift * 0.4, 3.5 + lift * 0.6, o.angle);
    G.blit(ctx, body, 0, -alt + bob - (A.hoverBob ? 2 : 0), o.angle);
    if (A.turret) {
      const ts = turretSprite(def, o.color);
      const tsh = G.shadow(def.id + '|' + o.color + '|t', ts, 1.6, 0.45);
      const px = Math.cos(o.angle) * A.tx, py = Math.sin(o.angle) * A.tx;
      const rc = (o.recoil || 0) * 2.2;
      const pv = A.tpiv != null ? A.tpiv : 0.25;
      const ox = px + Math.cos(o.turret) * (A.tw * pv - rc), oy = py + Math.sin(o.turret) * (A.tw * pv - rc) - (A.lift || 0) + bob - (A.hoverBob ? 2 : 0);
      G.blit(ctx, tsh, ox + 2, oy + 3, o.turret);
      G.blit(ctx, ts, ox, oy, o.turret);
    }
    if (A.live) { ctx.save(); ctx.translate(0, -alt + bob); A.live(ctx, o, P); ctx.restore(); }
  }
  const SQUAD_LAYOUT = { 1: [[0, 0]], 2: [[-1, -4], [-1, 4]], 3: [[3, 0], [-3, -5], [-3, 5]], 4: [[3, -3.5], [3, 3.5], [-4, -3.5], [-4, 3.5]], 5: [[4, 0], [0, -5], [0, 5], [-5, -2.5], [-5, 2.5]] };
  function drawSquad(ctx, def, o) {
    const d = def.draw, n = d.n, lay = SQUAD_LAYOUT[n] || SQUAD_LAYOUT[3];
    const cs = Math.cos(o.angle), sn = Math.sin(o.angle);
    const swarm = d.t === 'swarm';
    for (let i = 0; i < n; i++) {
      const [lx, ly] = lay[i];
      const x = lx * cs - ly * sn, y = lx * sn + ly * cs;
      const frame = o.moving ? (Math.floor((o.anim || 0) * 8 + i * 1.3) % 4) : 0;
      const key = def.id + '|' + o.color + '|s' + frame;
      const spr = G.sprite(key, swarm ? 14 : 14, swarm ? 14 : 12, (c) => { const P = pal(def.faction, o.color); c.scale(1.15, 1.15); if (swarm) bug(c, P, d.big, frame, d.eng); else soldier(c, P, d.gun, frame, def.faction); }, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 1.2, y + 1.6, swarm ? 4 : 3.2, swarm ? 2.8 : 2.4, o.angle, 0, 7); ctx.fill();
      G.blit(ctx, spr, x, y, swarm ? o.angle : o.turret);
    }
  }

  // ================= Gebäude =================
  // Schräge 2,5D-Projektion: Dach um h nach oben versetzt, Südwand sichtbar
  const SP = 16; // zusätzlicher Rand oben im Sprite für Höhe
  function bstyle(f) { return f === 'allianz' ? 'angular' : f === 'schatten' ? 'sleek' : 'organic'; }
  function bpal(faction, color) {
    if (faction === 'allianz') return { wall: '#7f8a94', wallD: '#4f5862', roof: '#a3adb6', roofD: '#8a949e', mat: 'concrete', team: color, glass: '#7dd3fc', win: '#bae6fd', metal: '#6b7480', accent: '#facc15' };
    if (faction === 'schatten') return { wall: '#3a3a42', wallD: '#1f1f25', roof: '#4a4a54', roofD: '#33333b', mat: 'dark', team: color, glass: '#fca5a5', win: '#fecaca', metal: '#55555f', accent: U.mix(color, '#ff2d2d', 0.5) };
    return { wall: U.mix('#5a3478', color, 0.2), wallD: '#2b1240', roof: U.mix('#7a4c9c', color, 0.2), roofD: '#4a2766', mat: 'chitin', team: color, glass: '#a5f3fc', win: '#67e8f9', metal: '#7a5a92', accent: '#5eead4' };
  }
  // Quader: Grundfläche (x,y,w,d), Höhe h
  function block(ctx, B, x, y, w, d, h, opt = {}) {
    const roof = opt.roof || B.roof;
    // Südwand
    const g = ctx.createLinearGradient(0, y + d - h, 0, y + d);
    g.addColorStop(0, opt.wall || B.wall); g.addColorStop(1, opt.wallD || B.wallD);
    ctx.fillStyle = g; ctx.fillRect(x, y + d - h, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y + d - h, w, h); ctx.clip();
    ctx.globalAlpha = 0.35; ctx.fillStyle = G.material(ctx, B.mat, opt.wall || B.wall); ctx.fillRect(x, y + d - h, w, h); ctx.restore();
    // Fenster
    if (opt.windows) {
      const n = Math.max(1, Math.floor(w / 6)), wy = y + d - h + h * 0.25, wh = Math.max(1.2, h * 0.28);
      for (let i = 0; i < n; i++) { const wx = x + 2 + i * (w - 4) / n; ctx.fillStyle = '#0b1220'; ctx.fillRect(wx, wy, (w - 4) / n - 1.6, wh); ctx.fillStyle = opt.windows === true ? B.win : opt.windows; ctx.globalAlpha = 0.85; ctx.fillRect(wx + 0.3, wy + 0.3, (w - 4) / n - 2.2, wh * 0.5); ctx.globalAlpha = 1; }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.5; ctx.strokeRect(x, y + d - h, w, h);
    // Dach
    G.plate(ctx, () => G.rr(ctx, x, y - h, w, d, opt.round || 0.6), roof, { mat: opt.mat || B.mat, matAlpha: 0.7, r: Math.max(w, d) * 0.8, cx: x + w * 0.35, cy: y - h + d * 0.3, hi: 0.15, lo: 0.25 });
    // Dachkante
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x + 0.5, y - h + d - 0.5); ctx.lineTo(x + 0.5, y - h + 0.5); ctx.lineTo(x + w - 0.5, y - h + 0.5); ctx.stroke();
    return { rx: x, ry: y - h, rw: w, rd: d };
  }
  function cylinder(ctx, B, cx, cy, r, h, color, opt = {}) {
    const top = cy - h;
    const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, U.shade(color, -0.45)); g.addColorStop(0.3, U.shade(color, 0.25)); g.addColorStop(0.55, color); g.addColorStop(1, U.shade(color, -0.6));
    ctx.fillStyle = g; ctx.fillRect(cx - r, top, r * 2, h);
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.45, 0, 0, PI); ctx.fill();
    if (opt.rings) { ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.6; for (let i = 1; i < opt.rings; i++) { const yy = top + h * i / opt.rings; ctx.beginPath(); ctx.ellipse(cx, yy, r, r * 0.45, 0, 0, PI); ctx.stroke(); } }
    ctx.fillStyle = opt.top || U.shade(color, 0.2); ctx.beginPath(); ctx.ellipse(cx, top, r, r * 0.45, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.6; ctx.stroke();
  }
  function shadowRect(ctx, x, y, w, d, h) {
    const o = h * 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    G.poly(ctx, [[x + w, y - h + 2], [x + w + o, y - h + 2 + o * 0.6], [x + w + o, y + d + o * 0.6], [x + o * 0.4, y + d + o * 0.6], [x, y + d]]); ctx.fill();
  }
  function pipe(ctx, x1, y1, x2, y2, r, color) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = r * 2 + 0.8; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = r * 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = r * 0.6; ctx.beginPath(); ctx.moveTo(x1, y1 - r * 0.4); ctx.lineTo(x2, y2 - r * 0.4); ctx.stroke();
  }
  function vent(ctx, x, y, w, h) { G.plate(ctx, () => G.rr(ctx, x, y, w, h, 0.5), '#5c636c', { bevel: true, ew: 0.4 }); G.grille(ctx, x + 0.8, y + 0.8, w - 1.6, h - 1.6, Math.max(2, Math.floor(w / 1.6)), true); }
  function antenna(ctx, x, y, h) { ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x, y - h, 0.7, 0, 7); ctx.fill(); }
  function pad(ctx, B, x, y, w, d) {
    G.plate(ctx, () => G.rr(ctx, x, y, w, d, 1.5), '#45464a', { mat: 'concrete', matAlpha: 0.8, bevel: true, ew: 0.5 });
  }
  function crystal(ctx, x, y, h, c) {
    const g = ctx.createLinearGradient(x - h * 0.3, 0, x + h * 0.3, 0); g.addColorStop(0, U.shade(c, 0.5)); g.addColorStop(0.5, c); g.addColorStop(1, U.shade(c, -0.5));
    ctx.fillStyle = g; G.poly(ctx, [[x, y - h], [x + h * 0.28, y - h * 0.2], [x, y + h * 0.12], [x - h * 0.28, y - h * 0.2]]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; G.poly(ctx, [[x, y - h], [x + h * 0.28, y - h * 0.2], [x, y - h * 0.3]]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.4; G.poly(ctx, [[x, y - h], [x + h * 0.28, y - h * 0.2], [x, y + h * 0.12], [x - h * 0.28, y - h * 0.2]]); ctx.stroke();
  }
  function chitinDome(ctx, B, x, y, rx, ry, h, color) {
    // organische Kuppel mit Rippen
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + h * 0.4, y + ry * 0.3, rx, ry, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(x - rx * 0.35, y - h - ry * 0.3, 1, x, y - h * 0.5, Math.max(rx, ry + h));
    g.addColorStop(0, U.shade(color, 0.5)); g.addColorStop(0.45, color); g.addColorStop(1, U.shade(color, -0.6));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, rx, ry + h * 0.5, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, rx, ry + h * 0.5, 0, 0, 7); ctx.clip();
    ctx.globalAlpha = 0.5; ctx.fillStyle = G.material(ctx, 'chitin', color); ctx.fillRect(x - rx, y - h - ry, rx * 2, ry * 2 + h); ctx.globalAlpha = 1;
    // Panzersegmente (Querbänder)
    const H2 = ry + h * 0.5;
    for (let i = 1; i <= 3; i++) {
      const yy = y - h * 0.5 - H2 + (H2 * 2) * i / 4;
      ctx.strokeStyle = 'rgba(15,0,25,0.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(x, yy - H2 * 0.25, rx * 1.02, H2 * 0.35, 0, 0.15, PI - 0.15); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(x, yy - H2 * 0.25 + 1, rx * 1.0, H2 * 0.35, 0, 0.3, PI - 0.3); ctx.stroke();
    }
    // leuchtende Adern & Poren
    ctx.strokeStyle = 'rgba(94,234,212,0.55)'; ctx.lineWidth = 0.5;
    const rs = U.RNG(Math.round(rx * 13 + h));
    for (let i = 0; i < 3; i++) { const sx = x + rs.range(-rx * 0.6, rx * 0.6); ctx.beginPath(); ctx.moveTo(sx, y + ry * 0.6); ctx.quadraticCurveTo(sx + rs.range(-6, 6), y - h * 0.5, sx + rs.range(-4, 4), y - h - ry * 0.4); ctx.stroke(); }
    for (let i = 0; i < 5; i++) { const px = x + rs.range(-rx * 0.7, rx * 0.7), py = y - h * 0.5 + rs.range(-H2 * 0.6, H2 * 0.6); G.glow(ctx, px, py, 1.8, '#5eead4', 0.8); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, rx, ry + h * 0.5, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = B.team; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, rx * 0.92, ry + h * 0.45, 0, 0.2, PI - 0.2); ctx.stroke();
  }

  // Neutrale, eroberbare Gebäude
  function neutralStatic(ctx, def, B, W, H) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(3, 4, W - 1, H - 1);
    G.plate(ctx, () => G.rr(ctx, 0.8, 0.8, W - 1.6, H - 1.6, 1.5), '#56524a', { mat: 'concrete', matAlpha: 0.9, ew: 0.6 });
    G.hazard(ctx, 2, H - 4.5, W - 4, 2.5, 2);
    if (def.role === 'derrick') {
      shadowRect(ctx, 5, 34, 24, 20, 9);
      const b = block(ctx, B, 5, 34, 24, 20, 9, { windows: false, roof: '#8d8676', wall: '#6f695c', wallD: '#3d392f' });
      vent(ctx, b.rx + 3, b.ry + 3, 8, 6); ctx.fillStyle = B.team; ctx.fillRect(b.rx + 1, b.ry + 16, 22, 1.6);
      cylinder(ctx, B, 15, 30, 5, 10, '#7a7466', { rings: 3, top: '#2a2722' });
      // Bohrschacht mit Kristallglühen
      ctx.fillStyle = '#12100d'; ctx.beginPath(); ctx.ellipse(44, 46, 11, 6, 0, 0, 7); ctx.fill();
      G.glow(ctx, 44, 46, 10, '#22d3ee', 0.55);
      // Gitterturm
      const bx = 44, by = 48, top = 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; G.poly(ctx, [[bx + 8, by], [bx + 34, by - 14], [bx + 30, by - 20], [bx + 4, by - 2]]); ctx.fill();
      ctx.strokeStyle = '#1c1a16'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(bx - 10, by); ctx.lineTo(bx - 2, top); ctx.moveTo(bx + 10, by); ctx.lineTo(bx + 2, top); ctx.stroke();
      ctx.strokeStyle = '#a39b86'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = '#6b6555'; ctx.lineWidth = 0.9;
      for (let i = 0; i < 5; i++) { const t0 = i / 5, t1 = (i + 1) / 5, y0 = by - (by - top) * t0, y1 = by - (by - top) * t1, w0 = 10 - 8 * t0, w1 = 10 - 8 * t1; ctx.beginPath(); ctx.moveTo(bx - w0, y0); ctx.lineTo(bx + w1, y1); ctx.moveTo(bx + w0, y0); ctx.lineTo(bx - w1, y1); ctx.moveTo(bx - w1, y1); ctx.lineTo(bx + w1, y1); ctx.stroke(); }
      G.plate(ctx, () => G.rr(ctx, bx - 4, top - 3, 8, 4, 0.8), '#8d8676', { bevel: true, ew: 0.4 });
      pipe(ctx, 29, 46, 36, 46, 1.4, '#6b6555');
    } else {
      shadowRect(ctx, 6, 34, 52, 22, 9);
      const b = block(ctx, B, 6, 34, 52, 22, 9, { windows: true, roof: '#8d8676', wall: '#6f695c', wallD: '#3d392f' });
      vent(ctx, b.rx + 3, b.ry + 4, 9, 6); for (let i = 0; i < 5; i++) G.dome(ctx, 10 + i * 4.2, 58, 2.2, '#a8916a', 1.4);
      shadowRect(ctx, 24, 16, 20, 18, 30);
      const t = block(ctx, B, 24, 16, 20, 18, 30, { windows: '#fde68a', roof: '#9a927f', wall: '#7b7566', wallD: '#3d392f' });
      ctx.fillStyle = B.team; ctx.fillRect(t.rx, t.ry + 15.5, 20, 2); ctx.fillRect(b.rx + 1, b.ry + 18, 50, 1.6);
      antenna(ctx, t.rx + 16, t.ry + 4, 12);
    }
  }
  function neutralLive(ctx, def, o, B, W, H) {
    const an = o.anim || 0;
    if (def.role === 'derrick') {
      const y = 14 + (Math.sin(an * 2.2) * 0.5 + 0.5) * 26;
      ctx.fillStyle = '#2a2722'; ctx.fillRect(43, y, 2, 48 - y - 2);
      G.plate(ctx, () => G.rr(ctx, 40.5, y - 2, 7, 4, 0.8), '#facc15', { bevel: true, ew: 0.4 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, 44, 46, 8 + Math.sin(an * 2.2) * 3, '#22d3ee', 0.4); ctx.restore();
      if (Math.sin(an * 3) > 0) G.light(ctx, 44, 0, 1, B.team);
    } else {
      ctx.save(); ctx.translate(31, -10); const s2 = Math.cos(an * 1.5);
      const g = ctx.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, '#9ca3af'); g.addColorStop(0.5 + s2 * 0.3, '#f9fafb'); g.addColorStop(1, '#6b7280');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 6 * Math.abs(s2) + 1.2, 5.5, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.restore();
      if (Math.sin(an * 3) > 0.2) G.light(ctx, 40, -22, 0.9, B.team);
    }
  }
  // Statischer Teil eines Gebäudes (wird zwischengespeichert)
  function buildingStatic(ctx, def, B, W, H) {
    if (def.neutral) return neutralStatic(ctx, def, B, W, H);
    const st = bstyle(def.faction), role = def.role;
    // Fundament
    if (st === 'organic') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(W / 2 + 3, H / 2 + 4, W / 2, H / 2, 0, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, W * 0.6); g.addColorStop(0, '#3b1b4f'); g.addColorStop(1, 'rgba(30,10,40,0.2)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(W / 2, H / 2, W / 2 - 1, H / 2 - 1, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(94,234,212,0.35)'; ctx.lineWidth = 0.6;
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.4; ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.quadraticCurveTo(W / 2 + Math.cos(a + 0.4) * W * 0.25, H / 2 + Math.sin(a + 0.4) * H * 0.25, W / 2 + Math.cos(a) * W * 0.47, H / 2 + Math.sin(a) * H * 0.47); ctx.stroke(); }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(3, 4, W - 1, H - 1);
      G.plate(ctx, () => G.rr(ctx, 0.8, 0.8, W - 1.6, H - 1.6, 1.5), st === 'sleek' ? '#2f2f33' : '#5f6062', { mat: 'concrete', matAlpha: 0.8, ew: 0.6 });
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.4; ctx.strokeRect(3, 3, W - 6, H - 6);
    }
    if (role.startsWith('tower')) return towerBase(ctx, def, B, W, H, st);
    if (st === 'organic') return organicBuilding(ctx, def, B, W, H);
    const sleek = st === 'sleek';
    const roofTeam = (x, y, w) => { ctx.fillStyle = B.team; ctx.fillRect(x, y, w, 1.4); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x, y, w, 0.4); };
    const neon = (x1, y1, x2, y2) => { if (!sleek) return; ctx.strokeStyle = B.accent; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; };
    switch (role) {
      case 'yard': {
        shadowRect(ctx, 6, 22, 52, 40, 14);
        pad(ctx, B, 10, 68, 76, 24);
        G.hazard(ctx, 10, 68, 76, 2, 2); ctx.strokeStyle = '#facc15'; ctx.setLineDash([4, 3]); ctx.lineWidth = 0.8; ctx.strokeRect(14, 73, 68, 15); ctx.setLineDash([]);
        const r = block(ctx, B, 6, 22, 52, 40, 14, { windows: true });
        vent(ctx, r.rx + 4, r.ry + 4, 9, 6); vent(ctx, r.rx + 4, r.ry + 13, 9, 6);
        G.plate(ctx, () => G.rr(ctx, r.rx + 17, r.ry + 5, 22, 18, 1.5), U.shade(B.roof, -0.1), { r: 16 });
        roofTeam(r.rx + 2, r.ry + 32, 48);
        // Kommandoturm
        shadowRect(ctx, 62, 18, 24, 26, 26);
        const t = block(ctx, B, 62, 18, 24, 26, 26, { windows: B.win });
        G.dome(ctx, t.rx + 12, t.ry + 10, 5.5, B.metal); antenna(ctx, t.rx + 20, t.ry + 4, 10); antenna(ctx, t.rx + 4, t.ry + 3, 6);
        neon(6, 61, 58, 61); neon(62, 43, 86, 43);
        cylinder(ctx, B, 76, 64, 5, 8, B.metal, { rings: 2 });
        break;
      }
      case 'power': {
        shadowRect(ctx, 4, 34, 56, 24, 8);
        const b = block(ctx, B, 4, 34, 56, 24, 8, { windows: false });
        G.grille(ctx, b.rx + 4, b.ry + 6, 18, 6, 8, true);
        roofTeam(b.rx + 2, b.ry + 20, 52);
        if (sleek) {
          cylinder(ctx, B, 32, 36, 13, 18, '#2b2b31', { rings: 3, top: '#111' });
          G.glow(ctx, 32, 18, 10, '#ef4444', 0.7);
        } else {
          for (const cx of [18, 46]) { cylinder(ctx, B, cx, 34, 10, 20, '#b8bec5', { rings: 4, top: '#4b5563' }); ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.ellipse(cx, 14, 7.5, 3.3, 0, 0, 7); ctx.fill(); }
        }
        pipe(ctx, 6, 50, 58, 50, 1.2, B.metal);
        break;
      }
      case 'refinery': {
        shadowRect(ctx, 6, 18, 50, 40, 16);
        pad(ctx, B, 22, 66, 52, 28);
        G.hazard(ctx, 22, 66, 52, 2.2, 2); G.hazard(ctx, 22, 91.5, 52, 2.2, 2);
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1; ctx.strokeRect(30, 71, 36, 17);
        const b = block(ctx, B, 6, 18, 50, 40, 16, { windows: true });
        vent(ctx, b.rx + 4, b.ry + 4, 12, 7); G.grille(ctx, b.rx + 20, b.ry + 5, 24, 4, 10, true);
        roofTeam(b.rx + 2, b.ry + 33, 46);
        cylinder(ctx, B, 76, 52, 13, 34, sleek ? '#3a3a42' : '#9aa3ad', { rings: 5, top: '#1e293b' });
        pipe(ctx, 56, 30, 64, 30, 1.6, B.metal); pipe(ctx, 56, 38, 64, 38, 1.6, B.metal);
        pipe(ctx, 40, 60, 40, 70, 2, '#6b7280');
        neon(6, 57, 56, 57);
        break;
      }
      case 'barracks': {
        shadowRect(ctx, 5, 18, 54, 34, 14);
        // Rundbogendach
        const x = 5, y = 18, w = 54, d = 34, h = 14;
        const g = ctx.createLinearGradient(0, y + d - h, 0, y + d); g.addColorStop(0, B.wall); g.addColorStop(1, B.wallD);
        ctx.fillStyle = g; ctx.fillRect(x, y + d - h, w, h);
        const rg = ctx.createLinearGradient(0, y - h, 0, y - h + d); rg.addColorStop(0, U.shade(B.roof, -0.25)); rg.addColorStop(0.35, U.shade(B.roof, 0.3)); rg.addColorStop(1, U.shade(B.roof, -0.35));
        ctx.fillStyle = rg; G.rr(ctx, x, y - h, w, d, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6; for (let i = x + 5; i < x + w; i += 5) { ctx.beginPath(); ctx.moveTo(i, y - h + 1); ctx.lineTo(i, y - h + d - 1); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; G.rr(ctx, x, y - h, w, d, 8); ctx.stroke();
        G.plate(ctx, () => G.rr(ctx, 25, y + d - 11, 14, 11, 0.5), '#1f2937', { bevel: false, ew: 0.5 }); G.lines(ctx, [[32, y + d - 11, 32, y + d]], 'rgba(255,255,255,0.15)');
        ctx.fillStyle = B.team; ctx.fillRect(x, y + d - h, w, 1.5);
        // Sandsäcke
        for (let i = 0; i < 6; i++) { G.dome(ctx, 8 + i * 4.5, 58, 2.4, '#a8916a', 1.5); }
        neon(5, 51, 59, 51);
        break;
      }
      case 'factory': {
        shadowRect(ctx, 4, 20, 88, 50, 22);
        const x = 4, y = 20, w = 88, d = 50, h = 22;
        const r = block(ctx, B, x, y, w, d, h, { windows: false });
        // Sägezahndach mit Oberlichtern
        for (let i = 0; i < 5; i++) {
          const sx = r.rx + 3 + i * 16.5;
          G.plate(ctx, () => G.rr(ctx, sx, r.ry + 4, 14, d - 14, 0.5), U.shade(B.roof, -0.08), { bevel: true, ew: 0.4 });
          const gg = ctx.createLinearGradient(sx, 0, sx + 5, 0); gg.addColorStop(0, B.glass); gg.addColorStop(1, '#0c4a6e'); ctx.fillStyle = gg; ctx.globalAlpha = 0.85; ctx.fillRect(sx + 1, r.ry + 5, 4, d - 16); ctx.globalAlpha = 1;
        }
        roofTeam(r.rx + 2, r.ry + d - 7, w - 4);
        // Tor
        G.plate(ctx, () => G.rr(ctx, 26, y + d - h + 3, 44, h - 3, 0.4), '#3a3f46', { bevel: false, ew: 0.6 });
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; for (let yy = y + d - h + 5; yy < y + d; yy += 2.5) { ctx.beginPath(); ctx.moveTo(26, yy); ctx.lineTo(70, yy); ctx.stroke(); }
        G.hazard(ctx, 24, y + d - h + 1, 2, h - 1, 1.5); G.hazard(ctx, 70, y + d - h + 1, 2, h - 1, 1.5);
        cylinder(ctx, B, 84, 26, 3.5, 16, '#5b616b', { rings: 3, top: '#111' });
        neon(4, 69, 92, 69);
        break;
      }
      case 'radar': {
        shadowRect(ctx, 10, 26, 44, 30, 12);
        const b = block(ctx, B, 10, 26, 44, 30, 12, { windows: true });
        vent(ctx, b.rx + 3, b.ry + 3, 8, 6); roofTeam(b.rx + 2, b.ry + 25, 40);
        cylinder(ctx, B, 32, 30, 4, 10, B.metal, { rings: 2 });
        neon(10, 55, 54, 55);
        break;
      }
      case 'airfield': {
        pad(ctx, B, 4, 4, 88, 88);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(48, 52, 28, 0, 7); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 48, 53);
        G.hazard(ctx, 4, 4, 88, 2.5, 2.5); G.hazard(ctx, 4, 89.5, 88, 2.5, 2.5);
        shadowRect(ctx, 6, 10, 18, 16, 24);
        const t = block(ctx, B, 6, 10, 18, 16, 24, { windows: B.win });
        G.dome(ctx, t.rx + 9, t.ry + 8, 4, B.glass); antenna(ctx, t.rx + 15, t.ry + 3, 8);
        ctx.fillStyle = B.team; ctx.fillRect(t.rx, t.ry + 14, 18, 1.5);
        break;
      }
      case 'tech': {
        shadowRect(ctx, 6, 26, 84, 40, 14);
        const b = block(ctx, B, 6, 26, 84, 40, 14, { windows: true });
        vent(ctx, b.rx + 4, b.ry + 4, 10, 7); vent(ctx, b.rx + 70, b.ry + 4, 10, 7);
        roofTeam(b.rx + 2, b.ry + 34, 80);
        // Glaskuppel
        const cx = 48, cy = b.ry + 18, r = 18;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx + 4, cy + 4, r, r * 0.8, 0, 0, 7); ctx.fill();
        const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.5, 2, cx, cy, r);
        g.addColorStop(0, '#f0f9ff'); g.addColorStop(0.3, sleek ? '#fca5a5' : '#7dd3fc'); g.addColorStop(1, sleek ? '#450a0a' : '#0c4a6e');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.5;
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(i) * r / 3.5 + 0.5, r * 0.8, 0, 0, 7); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.3, 0, 0, 7); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, 7); ctx.stroke();
        antenna(ctx, 82, b.ry + 6, 12); antenna(ctx, 86, b.ry + 10, 8);
        neon(6, 65, 90, 65);
        break;
      }
      case 'sw': {
        shadowRect(ctx, 6, 30, 84, 44, 12);
        const b = block(ctx, B, 6, 30, 84, 44, 12, { windows: true });
        roofTeam(b.rx + 2, b.ry + 39, 80);
        G.hazard(ctx, b.rx + 2, b.ry + 2, 80, 2, 2);
        if (sleek) {
          G.plate(ctx, () => G.rr(ctx, 24, b.ry + 6, 48, 30, 2), '#18181b', { bevel: true });
        } else {
          for (const [x, y] of [[16, b.ry + 8], [80, b.ry + 8], [16, b.ry + 32], [80, b.ry + 32]]) cylinder(ctx, B, x, y + 4, 3, 6, B.metal, {});
        }
        neon(6, 73, 90, 73);
        break;
      }
    }
  }
  function towerBase(ctx, def, B, W, H, st) {
    const role = def.role, cx = W / 2, cy = H / 2 + 4;
    if (st === 'organic') {
      chitinDome(ctx, B, cx, cy + 2, W * 0.38, H * 0.22, 6, B.wall);
      if (role === 'tower_av') { crystal(ctx, cx, cy - 2, H * 0.85, U.mix('#e879f9', B.team, 0.25)); }
      else if (role === 'tower_aa') { for (let i = -1; i <= 1; i++) crystal(ctx, cx + i * W * 0.17, cy, H * 0.5, '#22d3ee'); }
      else { for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; crystal(ctx, cx + Math.cos(a) * W * 0.18, cy + Math.sin(a) * H * 0.1, H * 0.38, '#a3e635'); } }
      return;
    }
    const sleek = st === 'sleek';
    if (role === 'tower_av') {
      shadowRect(ctx, 6, 18, W - 12, H - 24, 10);
      const b = block(ctx, B, 6, 18, W - 12, H - 24, 10, { windows: false });
      G.hazard(ctx, b.rx, b.ry + b.rd - 2, b.rw, 2, 1.5);
      if (sleek) {
        // Gitterturm mit Emitter
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(cx - 9, b.ry + 22); ctx.lineTo(cx, b.ry - 18); ctx.lineTo(cx + 9, b.ry + 22); ctx.stroke();
        ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { const yy = b.ry + 18 - i * 7, ww = 8 - i * 1.5; ctx.beginPath(); ctx.moveTo(cx - ww, yy); ctx.lineTo(cx + ww, yy - 5); ctx.moveTo(cx + ww, yy); ctx.lineTo(cx - ww, yy - 5); ctx.stroke(); }
        G.dome(ctx, cx, b.ry - 18, 4, '#3f3f46');
      }
      return;
    }
    // Bunker
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx + 4, cy + 4, W * 0.42, H * 0.36, 0, 0, 7); ctx.fill();
    cylinder(ctx, B, cx, cy + 5, W * 0.4, 7, sleek ? '#3a3a42' : '#8a929b', { rings: 2, top: sleek ? '#2a2a30' : '#a3abb3' });
    ctx.fillStyle = '#0b0b0b'; ctx.fillRect(cx - W * 0.25, cy + 1, W * 0.5, 1.6);
    ctx.fillStyle = B.team; ctx.beginPath(); ctx.ellipse(cx, cy - 2, W * 0.4, W * 0.18, 0, 0.3, PI - 0.3); ctx.lineWidth = 1; ctx.strokeStyle = B.team; ctx.stroke();
  }
  function organicBuilding(ctx, def, B, W, H) {
    const role = def.role, cx = W / 2, cy = H / 2 + 6;
    const main = B.wall;
    switch (role) {
      case 'yard': chitinDome(ctx, B, cx, cy, W * 0.36, H * 0.24, 22, main); for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + 0.3; crystal(ctx, cx + Math.cos(a) * W * 0.36, cy + Math.sin(a) * H * 0.26, 16, '#c084fc'); } crystal(ctx, cx, cy - 18, 26, '#22d3ee'); break;
      case 'power': chitinDome(ctx, B, cx, cy, W * 0.3, H * 0.2, 10, main); crystal(ctx, cx, cy - 6, 30, '#38bdf8'); break;
      case 'refinery': chitinDome(ctx, B, cx - 12, cy - 6, W * 0.26, H * 0.18, 16, main); chitinDome(ctx, B, cx + 18, cy - 10, W * 0.15, H * 0.12, 26, U.mix(main, '#0e7490', 0.4)); crystal(ctx, cx + 18, cy - 30, 14, '#22d3ee');
        ctx.fillStyle = '#1e0b33'; G.rr(ctx, cx - 26, H - 26, 52, 22, 6); ctx.fill(); ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 0.8; G.rr(ctx, cx - 22, H - 22, 44, 14, 4); ctx.stroke(); break;
      case 'barracks': for (let i = -1; i <= 1; i++) chitinDome(ctx, B, cx + i * 18, cy, 9, 7, 10 + (i === 0 ? 6 : 0), main); break;
      case 'factory': chitinDome(ctx, B, cx, cy - 6, W * 0.38, H * 0.24, 22, main); ctx.fillStyle = '#12051c'; ctx.beginPath(); ctx.ellipse(cx, H - 18, 18, 8, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 0.8; ctx.stroke(); break;
      case 'radar': chitinDome(ctx, B, cx, cy, W * 0.32, H * 0.22, 10, main); break;
      case 'airfield': ctx.strokeStyle = 'rgba(232,121,249,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.36, H * 0.3, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.22, H * 0.18, 0, 0, 7); ctx.stroke();
        chitinDome(ctx, B, 16, 20, 9, 7, 14, main); break;
      case 'tech': chitinDome(ctx, B, cx, cy, W * 0.36, H * 0.24, 16, main); chitinDome(ctx, B, cx, cy - 16, W * 0.18, H * 0.12, 8, '#d8b4fe'); break;
      case 'sw': chitinDome(ctx, B, cx, cy + 10, W * 0.42, H * 0.18, 8, main); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; crystal(ctx, cx + Math.cos(a) * W * 0.36, cy + 10 + Math.sin(a) * H * 0.2, 22, '#c084fc'); } break;
    }
  }
  // Animierte Teile (live)
  function buildingLive(ctx, def, o, B, W, H) {
    if (def.neutral) return neutralLive(ctx, def, o, B, W, H);
    const st = bstyle(def.faction), role = def.role, an = o.anim || 0, sleek = st === 'sleek';
    const blink = (x, y, c, ph) => { if (Math.sin(an * 3 + (ph || 0)) > 0.3) G.light(ctx, x, y, 0.9, c); };
    if (st === 'organic') {
      const pulse = 0.5 + 0.5 * Math.sin(an * 2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (role === 'power') G.glow(ctx, W / 2, H / 2 - 20, 14 + pulse * 6, '#38bdf8', 0.5);
      else if (role === 'yard' || role === 'tech') G.glow(ctx, W / 2, H / 2 - 14, 12 + pulse * 4, '#22d3ee', 0.35);
      else if (role === 'refinery') G.glow(ctx, W / 2 + 18, H / 2 - 26, 10 + pulse * 4, '#22d3ee', 0.5);
      else if (role === 'radar') { ctx.strokeStyle = `rgba(34,211,238,${1 - (an % 1)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(W / 2, H / 2 + 2, (an % 1) * W * 0.5 + 4, (an % 1) * H * 0.3 + 3, 0, 0, 7); ctx.stroke(); }
      else if (role === 'airfield') G.glow(ctx, W / 2, H / 2 + 6, 10 + pulse * 6, '#e879f9', 0.4);
      else if (role === 'sw') { const ch = U.clamp(o.charge || 0, 0, 1); ctx.translate(W / 2, H / 2 + 6); ctx.rotate(an * (0.5 + ch * 2)); for (let i = 0; i < 3; i++) { ctx.rotate(2.09); ctx.strokeStyle = `rgba(232,121,249,${0.35 + ch * 0.6})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, W * 0.24, 0, 1.6); ctx.stroke(); } G.glow(ctx, 0, 0, 8 + ch * 10, '#a855f7', 0.4 + ch * 0.5); }
      else if (role === 'tower_av') G.glow(ctx, W / 2, H / 2 + 4 - H * 0.82, 6 + pulse * 3, '#f0abfc', 0.7);
      else if (role === 'factory' || role === 'barracks') G.glow(ctx, W / 2, H - 18, 8 + pulse * 3, '#5eead4', 0.35);
      ctx.restore();
      return;
    }
    switch (role) {
      case 'yard': {
        // Kran
        ctx.save(); ctx.translate(30, 30); ctx.rotate(Math.sin(an * 0.25) * 1.1 - 0.4);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(3, 4, 40, 4);
        ctx.fillStyle = '#eab308'; ctx.fillRect(0, -1.6, 40, 3.2); ctx.strokeStyle = '#a16207'; ctx.lineWidth = 0.5;
        for (let x = 0; x < 40; x += 3) { ctx.beginPath(); ctx.moveTo(x, -1.6); ctx.lineTo(x + 1.5, 1.6); ctx.stroke(); }
        ctx.fillStyle = '#1f2937'; ctx.fillRect(-7, -3, 7, 6);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(34, 9); ctx.stroke(); ctx.fillStyle = '#6b7280'; ctx.fillRect(32.5, 9, 3, 2);
        ctx.restore();
        G.dome(ctx, 30, 30, 3, '#ca8a04');
        blink(74, 6, '#ef4444'); blink(86, 30, '#22c55e', 1.5);
        break;
      }
      case 'power':
        if (sleek) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, 32, 18, 9 + Math.sin(an * 3) * 3, '#ff4d4d', 0.6); ctx.restore(); }
        else for (const cx of [18, 46]) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, cx, 14, 5, '#38bdf8', 0.25 + 0.15 * Math.sin(an * 2 + cx)); ctx.restore(); }
        blink(58, 34, '#ef4444');
        break;
      case 'refinery': { ctx.save(); ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, 76, 18, 9 + Math.sin(an * 2) * 2, '#22d3ee', 0.5); ctx.restore(); blink(24, 66, '#fbbf24'); blink(72, 66, '#fbbf24', 1.6); break; }
      case 'barracks': {
        const fx = 54, fy = 2;
        ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(fx, fy + 22); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.fillStyle = B.team; ctx.beginPath(); ctx.moveTo(fx, fy); for (let i = 0; i <= 6; i++) ctx.lineTo(fx + i * 1.7, fy + 0.6 + Math.sin(an * 6 + i * 0.8) * 0.8); for (let i = 6; i >= 0; i--) ctx.lineTo(fx + i * 1.7, fy + 5.6 + Math.sin(an * 6 + i * 0.8) * 0.8); ctx.fill();
        break;
      }
      case 'factory': blink(26, 50, '#f59e0b'); blink(70, 50, '#f59e0b', 3); break;
      case 'radar': {
        ctx.save(); ctx.translate(32, 12); const s = Math.cos(an * 1.2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(5, 16, 13 * Math.abs(s) + 3, 7, 0, 0, 7); ctx.fill();
        const g = ctx.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, '#9ca3af'); g.addColorStop(0.5 + s * 0.3, '#f9fafb'); g.addColorStop(1, '#6b7280');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 14 * Math.abs(s) + 2, 12, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.4; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, 0, (14 * Math.abs(s) + 2) * i / 4, 12 * i / 4, 0, 0, 7); ctx.stroke(); }
        ctx.strokeStyle = '#374151'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 8, -2); ctx.stroke(); G.light(ctx, s * 8, -2, 0.8, sleek ? '#ef4444' : '#38bdf8');
        ctx.restore();
        break;
      }
      case 'airfield': for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; if (Math.floor(an * 4) % 6 === i) G.light(ctx, 48 + Math.cos(a) * 34, 52 + Math.sin(a) * 34, 1.2, B.team); else { ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(48 + Math.cos(a) * 34, 52 + Math.sin(a) * 34, 1, 0, 7); ctx.fill(); } } break;
      case 'tech': { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = 18; ctx.strokeStyle = sleek ? 'rgba(255,90,90,0.5)' : 'rgba(125,211,252,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(48, 30, r, r * 0.8, 0, an % 6.28, an % 6.28 + 1.4); ctx.stroke(); ctx.restore(); blink(82, 2, '#ef4444'); break; }
      case 'sw': {
        const ch = U.clamp(o.charge || 0, 0, 1), cx = 48, cy = 38;
        if (sleek) {
          const open = ch >= 1 ? 0.6 + 0.4 * Math.sin(an * 2) : ch * 0.1;
          ctx.fillStyle = '#060606'; ctx.fillRect(28, 26, 40, 22);
          if (open > 0.15) { ctx.fillStyle = '#d4d4d8'; G.rr(ctx, cx - 4, 28, 8, 18, 3); ctx.fill(); ctx.fillStyle = B.team; ctx.fillRect(cx - 4, 30, 8, 2); }
          G.plate(ctx, () => G.rr(ctx, 26 - open * 12, 24, 22, 26, 1), '#3f3f46', { mat: 'dark', r: 14 });
          G.plate(ctx, () => G.rr(ctx, 48 + open * 12, 24, 22, 26, 1), '#3f3f46', { mat: 'dark', r: 14 });
          G.hazard(ctx, 26 - open * 12, 24, 22, 2, 1.5); G.hazard(ctx, 48 + open * 12, 24, 22, 2, 1.5);
          ctx.fillStyle = '#ef4444'; ctx.fillRect(28, 52, 40 * ch, 1.6);
        } else {
          ctx.save(); ctx.translate(cx, cy - 4); ctx.rotate(-0.4 + Math.sin(an * 0.3) * 0.15);
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(6, 12, 24, 15, 0, 0, 7); ctx.fill();
          const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 24); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#cbd5e1'); g.addColorStop(1, '#64748b');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 24, 17, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.stroke();
          ctx.strokeStyle = 'rgba(71,85,105,0.5)'; ctx.lineWidth = 0.5; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 24 * i / 4, 17 * i / 4, 0, 0, 7); ctx.stroke(); }
          for (let i = 0; i < 3; i++) { const a = i * 2.09; ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 14); ctx.lineTo(0, -10); ctx.stroke(); }
          ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, 0, -10, 5 + ch * 14, '#93c5fd', 0.3 + ch * 0.7);
          ctx.restore();
        }
        break;
      }
      case 'tower_av': if (sleek) { const W2 = W / 2; ctx.save(); ctx.globalCompositeOperation = 'lighter'; G.glow(ctx, W2, 18 - 10 - 18 + 4, 6 + Math.sin(an * 3) * 2, '#ff3b3b', 0.9); ctx.restore(); } break;
    }
  }
  // Türme der Verteidigungsanlagen (drehbar)
  function towerTurretSprite(def, color) {
    const B = bpal(def.faction, color), role = def.role;
    const sz = role === 'tower_av' ? 34 : 22;
    return G.sprite(def.id + '|' + color + '|tt', sz, sz, (ctx) => {
      if (role === 'tower_av') {
        for (const y of [-3.5, 3.5]) { G.barrel(ctx, 4, 16, y, 1.3, '#4b5563'); ctx.fillStyle = '#111'; ctx.fillRect(15.5, y - 1.7, 1.6, 3.4); }
        G.plate(ctx, () => G.poly(ctx, [[7, -6], [4, -9], [-8, -9], [-10, -6], [-10, 6], [-8, 9], [4, 9], [7, 6]]), U.mix('#8b949d', color, 0.12), { mat: 'metal', r: 12 });
        G.dome(ctx, -3, 0, 2.6, '#a3abb3'); ctx.fillStyle = color; ctx.fillRect(-9, -1, 4, 2);
      } else if (role === 'tower_aa') {
        for (const y of [-2.2, 2.2]) G.barrel(ctx, 1, 10, y, 0.8, '#3f3f46');
        G.dome(ctx, 0, 0, 4.5, def.faction === 'schatten' ? '#3f3f46' : '#9aa3ad'); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, 7); ctx.fill();
      } else {
        G.barrel(ctx, 1, 9, 0, 0.7, '#27272a'); ctx.fillStyle = '#111'; ctx.fillRect(8.5, -1, 1.2, 2);
        G.dome(ctx, 0, 0, 4, def.faction === 'schatten' ? '#3f3f46' : '#9aa3ad'); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(1.5, -1.6, 2, 3.2); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-1.2, 0, 1.2, 0, 7); ctx.fill();
      }
    }, 3);
  }
  function hasTurret(def) { if (def.neutral) return false; const st = bstyle(def.faction); if (st === 'organic' || !def.role.startsWith('tower')) return false; return !(st === 'sleek' && def.role === 'tower_av'); }
  // ctx steht in der linken oberen Ecke der Grundfläche
  function drawBuilding(ctx, def, o) {
    const W = def.w * T, H = def.h * T, B = bpal(def.neutral ? 'allianz' : def.faction, o.color);
    const M = 18;
    const spr = G.sprite(def.id + '|' + o.color + '|B', W + M, H + SP + M, (c) => { c.translate(-(W + M) / 2, -(H + SP + M) / 2 + SP); buildingStatic(c, def, B, W, H); }, 2);
    ctx.drawImage(spr.cv, 0, -SP, W + M, H + SP + M);
    buildingLive(ctx, def, o, B, W, H);
    if (hasTurret(def)) {
      const ts = towerTurretSprite(def, o.color);
      const cx = W / 2, cy = def.role === 'tower_av' ? H / 2 - 8 : H / 2 - 4;
      G.blit(ctx, G.shadow(def.id + '|' + o.color + '|tt', ts, 1.5, 0.45), cx + 3, cy + 4, o.turret);
      G.blit(ctx, ts, cx, cy, o.turret);
    }
  }

  // ---------- Kristallit ----------
  function crystalSprite(level, variant) {
    return G.sprite('cr|' + level + '|' + variant, 34, 34, (ctx) => {
      const rng = U.RNG(level * 31 + variant * 7 + 3);
      const n = 1 + level;
      const shards = [];
      for (let i = 0; i < n + 2; i++) shards.push([rng.range(-11, 11), rng.range(-6, 11), (4 + rng.range(0, 6)) * (0.55 + level * 0.18), rng.range(-0.45, 0.45)]);
      shards.sort((a, b) => a[1] - b[1]);
      for (const [x, y, h, tilt] of shards) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
        ctx.fillStyle = 'rgba(0,30,40,0.3)'; ctx.beginPath(); ctx.ellipse(h * 0.25, 0.4, h * 0.3, h * 0.1, 0, 0, 7); ctx.fill();
        const w = h * 0.32;
        const g = ctx.createLinearGradient(-w, 0, w, 0); g.addColorStop(0, '#a5f3fc'); g.addColorStop(0.45, '#22d3ee'); g.addColorStop(1, '#0e7490');
        ctx.fillStyle = g; G.poly(ctx, [[0, -h], [w, -h * 0.55], [w * 0.8, 0], [-w * 0.8, 0], [-w, -h * 0.55]]); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; G.poly(ctx, [[0, -h], [-w, -h * 0.55], [-w * 0.2, -h * 0.4]]); ctx.fill();
        ctx.fillStyle = 'rgba(8,47,73,0.35)'; G.poly(ctx, [[0, -h], [w, -h * 0.55], [w * 0.8, 0], [w * 0.1, -h * 0.35]]); ctx.fill();
        ctx.strokeStyle = 'rgba(6,40,50,0.7)'; ctx.lineWidth = 0.4; G.poly(ctx, [[0, -h], [w, -h * 0.55], [w * 0.8, 0], [-w * 0.8, 0], [-w, -h * 0.55]]); ctx.stroke();
        ctx.restore();
      }
    }, 2);
  }
  function drawCrystals(ctx, x, y, amt, seed, t) {
    const level = amt > 320 ? 3 : amt > 180 ? 2 : amt > 70 ? 1 : 0;
    const spr = crystalSprite(level, seed % 6);
    ctx.drawImage(spr.cv, x - 1, y - 1, 34, 34);
    const glow = 0.05 + 0.04 * Math.sin(t * 2 + seed);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = glow * (level + 1) / 2; ctx.drawImage(G.flare('#22d3ee'), x + 8, y + 10, 16, 16); ctx.restore();
  }
  function drawBlossom(ctx, x, y, t) {
    const spr = G.sprite('blossom', 60, 70, (c) => {
      c.translate(0, 18);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(8, 6, 20, 9, 0, 0, 7); c.fill();
      const sp = [[-12, 14, 5], [12, 16, 5], [-6, 22, 5.5], [7, 24, 6], [0, 36, 8], [-3, 18, 4]];
      for (const [ox, h, w] of sp) {
        const g = c.createLinearGradient(ox - w, 0, ox + w, 0); g.addColorStop(0, '#cffafe'); g.addColorStop(0.45, '#22d3ee'); g.addColorStop(1, '#155e75');
        c.fillStyle = g; G.poly(c, [[ox, -h], [ox + w, -h * 0.35], [ox + w * 0.7, 3], [ox - w * 0.7, 3], [ox - w, -h * 0.35]]); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)'; G.poly(c, [[ox, -h], [ox - w, -h * 0.35], [ox - w * 0.2, -h * 0.25]]); c.fill();
        c.strokeStyle = 'rgba(8,51,68,0.7)'; c.lineWidth = 0.5; G.poly(c, [[ox, -h], [ox + w, -h * 0.35], [ox + w * 0.7, 3], [ox - w * 0.7, 3], [ox - w, -h * 0.35]]); c.stroke();
      }
    }, 2);
    ctx.drawImage(spr.cv, x - 30, y - 53, 60, 70);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 1.5);
    ctx.drawImage(G.flare('#67e8f9'), x - 30, y - 50, 60, 60); ctx.restore();
  }

  function drawCrate(ctx, x, y, t) {
    const spr = G.sprite('crate', 22, 22, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(-6, -3, 14, 12);
      const g = c.createLinearGradient(0, 0, 0, 7); g.addColorStop(0, '#7c5a2e'); g.addColorStop(1, '#4a3418'); c.fillStyle = g; c.fillRect(-7, 0, 14, 7);
      G.plate(c, () => G.rr(c, -7, -9, 14, 10, 0.8), '#b08442', { mat: 'concrete', matAlpha: 0.5, r: 12 });
      c.strokeStyle = '#5b4220'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-7, -4); c.lineTo(7, -4); c.moveTo(0, -9); c.lineTo(0, 1); c.stroke();
      c.strokeStyle = '#facc15'; c.lineWidth = 1.2; c.strokeRect(-6.4, -8.4, 12.8, 8.8);
      c.fillStyle = '#facc15'; c.font = 'bold 6px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, -4);
    }, 3);
    const bob = Math.sin(t * 3 + x) * 1.2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 4 + x); ctx.drawImage(G.flare('#facc15'), x - 16, y - 16, 32, 32); ctx.restore();
    ctx.drawImage(spr.cv, x - 11, y - 11 + bob, 22, 22);
  }

  // ---------- Symbolbilder (Seitenleiste) ----------
  const cameoCache = new Map();
  function cameo(def, color) {
    const key = def.id + color;
    if (cameoCache.has(key)) return cameoCache.get(key);
    const cv = G.canvas(128, 96), ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, '#34404b'); g.addColorStop(1, '#0b0e11');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 96);
    const rg = ctx.createRadialGradient(64, 55, 5, 64, 55, 70); rg.addColorStop(0, 'rgba(255,255,255,0.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, 128, 96);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 128; i += 8) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 96); ctx.stroke(); }
    if (def.kind === 'unit') {
      ctx.save(); ctx.translate(64, def.cat === 'air' ? 74 : 54);
      const big = Math.max(def.size * 2.4, 14);
      const sc = def.cat === 'inf' ? 3.4 : Math.min(3.2, 66 / big);
      ctx.scale(sc, sc);
      drawUnit(ctx, def, { color, angle: -0.55, turret: -0.75, anim: 0.4, moving: false, alt: 7, cargo: 350 });
      ctx.restore();
    } else if (def.kind === 'building') {
      const s = Math.min(112 / (def.w * T + 10), 80 / (def.h * T + SP + 6));
      ctx.save(); ctx.translate(64 - def.w * T * s / 2, 52 - def.h * T * s / 2 + SP * s * 0.5); ctx.scale(s, s);
      drawBuilding(ctx, def, { color, anim: 1, turret: -0.6, charge: 1 });
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(64, 48);
      G.glow(ctx, 0, 0, 40, '#38bdf8', 0.35);
      ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * PI / 3); ctx.beginPath(); ctx.ellipse(0, 0, 34, 12, 0, 0, 7); ctx.stroke(); ctx.restore(); }
      G.dome(ctx, 0, 0, 9, color);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(64, 48, 40, 64, 48, 90); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, 128, 96);
    cameoCache.set(key, cv);
    return cv;
  }

  RTS.draw = { drawUnit, drawBuilding, drawCrystals, drawBlossom, drawCrate, cameo, hullColor, SP, pal };
})();
