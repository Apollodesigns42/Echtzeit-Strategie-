'use strict';
// ===== Weltdarstellung =====
(function () {
  const U = RTS.util, T = U.TILE, DR = RTS.draw;

  class Renderer {
    constructor(canvas, game) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.g = game; this.cam = { x: 0, y: 0, zoom: 1 };
      this.shake = 0;
      this.fogCv = document.createElement('canvas'); this.fogCv.width = game.map.w; this.fogCv.height = game.map.h;
      this.fogCtx = this.fogCv.getContext('2d'); this.fogImg = this.fogCtx.createImageData(game.map.w, game.map.h);
      this.markers = [];
      game.on('shake', (s) => { this.shake = Math.max(this.shake, s); });
      this.resize();
    }
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = this.cv.clientWidth, h = this.cv.clientHeight;
      this.dpr = dpr; this.vw = w; this.vh = h;
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.clampCam();
    }
    clampCam() {
      const m = this.g.map, z = this.cam.zoom;
      const maxX = m.w * T - this.vw / z, maxY = m.h * T - this.vh / z;
      this.cam.x = maxX < 0 ? maxX / 2 : U.clamp(this.cam.x, 0, maxX);
      this.cam.y = maxY < 0 ? maxY / 2 : U.clamp(this.cam.y, 0, maxY);
    }
    centerOn(x, y) { this.cam.x = x - this.vw / this.cam.zoom / 2; this.cam.y = y - this.vh / this.cam.zoom / 2; this.clampCam(); }
    setZoom(z, sx, sy) {
      const before = this.toWorld(sx, sy);
      this.cam.zoom = U.clamp(z, 0.5, 1.6);
      const after = this.toWorld(sx, sy);
      this.cam.x += before.x - after.x; this.cam.y += before.y - after.y; this.clampCam();
    }
    toWorld(sx, sy) { return { x: this.cam.x + sx / this.cam.zoom, y: this.cam.y + sy / this.cam.zoom }; }
    toScreen(x, y) { return { x: (x - this.cam.x) * this.cam.zoom, y: (y - this.cam.y) * this.cam.zoom }; }
    addMarker(x, y, c) { this.markers.push({ x, y, c, t: 0 }); }

    updateFogTexture() {
      const g = this.g, d = this.fogImg.data, vis = g.vis, exp = g.explored, n = vis.length;
      for (let i = 0; i < n; i++) { d[i * 4 + 3] = vis[i] ? 0 : exp[i] ? 135 : 255; }
      this.fogCtx.putImageData(this.fogImg, 0, 0);
    }

    draw(alpha, ui, realDt) {
      const g = this.g, ctx = this.ctx, m = g.map, cam = this.cam, z = cam.zoom, dpr = this.dpr;
      const t = g.time;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      let sx = 0, sy = 0;
      if (this.shake > 0.1) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake *= Math.pow(0.02, realDt); }
      ctx.setTransform(z * dpr, 0, 0, z * dpr, (-cam.x * z + sx) * dpr, (-cam.y * z + sy) * dpr);
      const vx0 = cam.x, vy0 = cam.y, vx1 = cam.x + this.vw / z, vy1 = cam.y + this.vh / z;
      // Gelände
      const ix = Math.max(0, Math.floor(vx0)), iy = Math.max(0, Math.floor(vy0));
      const iw = Math.min(m.w * T, Math.ceil(vx1)) - ix, ih = Math.min(m.h * T, Math.ceil(vy1)) - iy;
      if (iw > 0 && ih > 0) {
        // Wasser nur im Bereich sichtbarer Wasserfelder (plus Uferrand)
        let wx0 = 1e9, wy0 = 1e9, wx1 = -1, wy1 = -1;
        const ttx0 = Math.max(0, Math.floor(ix / T) - 1), tty0 = Math.max(0, Math.floor(iy / T) - 1);
        const ttx1 = Math.min(m.w - 1, Math.floor((ix + iw) / T) + 1), tty1 = Math.min(m.h - 1, Math.floor((iy + ih) / T) + 1);
        for (let y = tty0; y <= tty1; y++) { const row = y * m.w; for (let x = ttx0; x <= ttx1; x++) if (m.type[row + x] === 2) { if (x < wx0) wx0 = x; if (x > wx1) wx1 = x; if (y < wy0) wy0 = y; if (y > wy1) wy1 = y; } }
        if (wx1 >= 0) {
          const ax = Math.max(ix, (wx0 - 1) * T), ay = Math.max(iy, (wy0 - 1) * T), bx = Math.min(ix + iw, (wx1 + 2) * T), by = Math.min(iy + ih, (wy1 + 2) * T);
          this.drawWater(ctx, ax, ay, bx - ax, by - ay, t);
        }
        ctx.drawImage(m.terrainCanvas, ix, iy, iw, ih, ix, iy, iw, ih);
      }
      const tx0 = Math.max(0, Math.floor(vx0 / T) - 1), ty0 = Math.max(0, Math.floor(vy0 / T) - 1);
      const tx1 = Math.min(m.w - 1, Math.ceil(vx1 / T) + 1), ty1 = Math.min(m.h - 1, Math.ceil(vy1 / T) + 2);
      const exp = g.explored, vis = g.vis;
      // Kristallit
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        const i = y * m.w + x;
        if (!exp[i]) continue;
        if (m.ore[i] > 0) DR.drawCrystals(ctx, x * T, y * T, m.ore[i], i * 7 + 13, t);
      }
      for (const b of m.blossoms) if (b.tx >= tx0 && b.tx <= tx1 && b.ty >= ty0 && b.ty <= ty1 && exp[b.ty * m.w + b.tx]) DR.drawBlossom(ctx, (b.tx + 0.5) * T, (b.ty + 0.7) * T, t);

      const inView = (x, y, r) => x + r > vx0 && x - r < vx1 && y + r > vy0 && y - r < vy1 + 40;
      const human = g.human;
      // Gebäude
      const blds = g.buildings.filter(b => !b.dead && inView(b.x, b.y, b.w * T) && (!human || g.allied(human, b.owner) || b.seen));
      blds.sort((a, b) => a.y - b.y);
      for (const b of blds) this.drawBuildingEnt(ctx, b, ui);
      // Bodeneinheiten
      const visUnit = (u) => {
        if (u.dead || !inView(u.x, u.y - (u.alt || 0), 40)) return false;
        if (!human) return true;
        if (g.allied(human, u.owner)) return true;
        if (u.cloaked) return false;
        const tx = Math.floor(u.x / T), ty = Math.floor(u.y / T);
        return !!vis[ty * m.w + tx];
      };
      const ground = [], air = [];
      for (const u of g.units) if (visUnit(u)) (u.isAir ? air : ground).push(u);
      ground.sort((a, b) => a.y - b.y);
      for (const u of ground) if (u.selected) this.drawSelection(ctx, u, alpha);
      for (const u of ground) this.drawUnitEnt(ctx, u, alpha);
      // Projektile
      for (const p of g.projectiles) {
        if (p.t < 0 || !inView(p.x, p.y, 20)) continue;
        if (p.kind === 'arc') {
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 7); ctx.fill();
          ctx.fillStyle = p.w.wh === 'acid' ? '#a3e635' : '#fde68a'; ctx.beginPath(); ctx.arc(p.x, p.y - p.h, 3.2, 0, 7); ctx.fill();
        } else if (p.kind === 'rocket') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
          ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-4, -1.2, 7, 2.4);
          ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(-5, 0, 2 + Math.random(), 0, 7); ctx.fill();
          ctx.restore();
        } else if (p.kind === 'acid') {
          ctx.fillStyle = '#a3e635'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill();
        } else {
          ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill();
        }
      }
      // Effekte
      this.drawEffects(ctx, inView);
      // Lufteinheiten
      for (const u of air) { if (u.selected) this.drawSelection(ctx, u, alpha); this.drawUnitEnt(ctx, u, alpha); }
      // Superwaffen-Anflug
      for (const s of g.pendingStrikes) {
        const f = 1 - s.t / s.max, R = s.sw.radius * T;
        ctx.strokeStyle = `rgba(255,${Math.round(80 + 100 * Math.sin(t * 10))},60,0.8)`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x, s.y, R * (1 - f * 0.4), 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s.x - R, s.y); ctx.lineTo(s.x + R, s.y); ctx.moveTo(s.x, s.y - R); ctx.lineTo(s.x, s.y + R); ctx.stroke();
        if (s.sw.fx === 'orbital') { ctx.fillStyle = `rgba(200,230,255,${f * 0.5})`; ctx.fillRect(s.x - 4 * f, s.y - 900, 8 * f, 900); }
      }
      // Lebensbalken
      const hov = ui && ui.hover;
      for (const b of blds) if (b.selected || b === hov || (t - b.lastHit < 2.5)) this.drawHealth(ctx, b.x, b.ty * T - 4, b.w * T * 0.8, b.hp / b.maxHp, b);
      for (const u of ground.concat(air)) if (u.selected || u === hov || (t - u.lastHit < 2.5 && u.owner === human)) this.drawHealth(ctx, U.lerp(u.px, u.x, alpha), U.lerp(u.py, u.y, alpha) - u.radius - 6 - (u.alt || 0), Math.max(18, u.radius * 1.8), u.hp / u.maxHp, u);
      // Nebel
      if (human && !g.cfg.reveal) {
        if (this.fogV !== g.fogVersion) { this.fogV = g.fogVersion; this.updateFogTexture(); }
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.fogCv, 0, 0, m.w * T, m.h * T);
      }
      // UI in Weltkoordinaten
      if (ui) this.drawWorldUI(ctx, ui, realDt);
      // Vignette & leichte Farbkorrektur
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!this.vig || this.vig.w !== this.cv.width || this.vig.h !== this.cv.height) {
        const vc = document.createElement('canvas'); vc.width = this.cv.width; vc.height = this.cv.height; const v = vc.getContext('2d');
        const gr = v.createRadialGradient(vc.width / 2, vc.height / 2, Math.min(vc.width, vc.height) * 0.35, vc.width / 2, vc.height / 2, Math.max(vc.width, vc.height) * 0.75);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.42)'); v.fillStyle = gr; v.fillRect(0, 0, vc.width, vc.height);
        this.vig = { cv: vc, w: vc.width, h: vc.height };
      }
      ctx.drawImage(this.vig.cv, 0, 0);
    }
    drawWater(ctx, x, y, w, h, t) {
      const m = this.g.map, B = m.biome;
      if (!this.waterPat) {
        this.waterPat = ctx.createPattern(m.waterTex, 'repeat');
      }
      ctx.fillStyle = B.water; ctx.fillRect(x, y, w, h);
      // Tiefenverlauf
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      const lava = !!B.lava;
      for (let layer = 0; layer < 2; layer++) {
        const ox = (layer ? -t * 9 : t * 6) % 256, oy = (layer ? t * 4 : t * 7) % 256;
        ctx.save();
        ctx.translate(ox, oy);
        if (layer) { ctx.globalCompositeOperation = lava ? 'lighter' : 'source-over'; ctx.globalAlpha = lava ? 0.55 : 0.5; }
        else { ctx.globalAlpha = lava ? 0.8 : 0.7; if (lava) ctx.globalCompositeOperation = 'lighter'; }
        ctx.fillStyle = this.waterPat; ctx.fillRect(x - ox, y - oy, w, h);
        ctx.restore();
      }
      if (lava) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12 + 0.06 * Math.sin(t * 1.3); ctx.fillStyle = '#ff7a1a'; ctx.fillRect(x, y, w, h); ctx.restore(); }
    }
    drawEffects(ctx, inView) {
      const g = this.g, GX = RTS.gfx;
      const EX = GX.explosionFrames(), SM = GX.smokePuffs();
      for (const e of g.effects) {
        if (e.x != null && !inView(e.x, e.y, 60)) continue;
        const f = e.life / e.max;
        switch (e.k) {
          case 'p': {
            const s = e.size + (e.grow || 0) * (1 - f);
            if (e.smoke) {
              ctx.globalAlpha = Math.min(1, f * 1.4) * 0.75;
              if (e.v == null) { const m = /rgba?\((\d+)/.exec(e.c || ''); e.v = Math.floor(Math.random() * 4) + (m && +m[1] < 100 ? 4 : 0); }
              const spr = SM[e.v];
              ctx.save(); ctx.translate(e.x, e.y); ctx.rotate((e.rot = (e.rot || Math.random() * 6) + 0.004));
              ctx.drawImage(spr, -s * 1.3, -s * 1.3, s * 2.6, s * 2.6);
              ctx.restore();
              // dunkle Tönung
              ctx.globalAlpha = 1;
            } else if (e.add) {
              ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = f;
              ctx.drawImage(GX.flare(e.c), e.x - s * 2.2, e.y - s * 2.2, s * 4.4, s * 4.4);
              ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            } else {
              ctx.globalAlpha = Math.min(1, f * 1.5);
              ctx.fillStyle = e.c; ctx.beginPath(); ctx.arc(e.x, e.y, s, 0, 7); ctx.fill();
              ctx.globalAlpha = 1;
            }
            break;
          }
          case 'explo': {
            const fi = Math.min(EX.length - 1, Math.floor((1 - f) * EX.length));
            const r = e.r * 2.1;
            if (e.kind === 'acid') { ctx.save(); ctx.filter = 'hue-rotate(80deg) saturate(1.3)'; }
            ctx.drawImage(EX[fi], e.x - r, e.y - r, r * 2, r * 2);
            if (e.kind === 'acid') ctx.restore();
            // Lichtschein am Boden
            if (f > 0.5) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (f - 0.5) * 1.2; ctx.drawImage(GX.flare(e.kind === 'acid' ? '#a3e635' : '#fb923c'), e.x - r * 1.6, e.y - r * 1.6, r * 3.2, r * 3.2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
            break;
          }
          case 'flash': {
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = f;
            const r = e.r * (0.7 + f * 0.6);
            ctx.drawImage(GX.flare(e.c || '#ffd27a'), e.x - r * 1.5, e.y - r * 1.5, r * 3, r * 3);
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'tracer': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = e.c; ctx.globalAlpha = f; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
            const mx = U.lerp(e.x1, e.x2, 0.35), my = U.lerp(e.y1, e.y2, 0.35);
            ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(e.x2, e.y2); ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.stroke();
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
            break;
          }
          case 'beam': {
            ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
            ctx.strokeStyle = e.c; ctx.globalAlpha = f * 0.35; ctx.lineWidth = e.w * 5;
            ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
            ctx.globalAlpha = f; ctx.lineWidth = e.w * 1.8; ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = e.w * 0.6; ctx.stroke();
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
            break;
          }
          case 'text': {
            ctx.globalAlpha = Math.min(1, f * 2); ctx.fillStyle = e.c; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
            ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(e.txt, e.x, e.y); ctx.fillText(e.txt, e.x, e.y); ctx.globalAlpha = 1;
            break;
          }
          case 'swblast': {
            const r = e.r * (1.3 - f * 0.5);
            ctx.globalCompositeOperation = 'lighter';
            const c = e.fx === 'rift' ? [200, 90, 255] : e.fx === 'orbital' ? [180, 220, 255] : [255, 140, 50];
            const gr = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
            gr.addColorStop(0, `rgba(255,255,255,${f})`); gr.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},${f * 0.8})`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 7); ctx.fill();
            if (e.fx === 'orbital') { const bg = ctx.createLinearGradient(e.x - 20 * f, 0, e.x + 20 * f, 0); bg.addColorStop(0, 'rgba(150,200,255,0)'); bg.addColorStop(0.5, `rgba(240,250,255,${f})`); bg.addColorStop(1, 'rgba(150,200,255,0)'); ctx.fillStyle = bg; ctx.fillRect(e.x - 22 * f, e.y - 1200, 44 * f, 1200); }
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = `rgba(255,255,255,${f * 0.6})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (2 - f), 0, 7); ctx.stroke();
            break;
          }
        }
      }
    }
    drawBuildingEnt(ctx, b, ui) {
      const x = b.tx * T, y = b.ty * T;
      ctx.save(); ctx.translate(x, y);
      if (b.built < 1) {
        ctx.globalAlpha = 0.35 + 0.65 * b.built;
        const SP = RTS.draw.SP, tot = b.h * T + SP;
        ctx.beginPath(); ctx.rect(-4, -SP + tot * (1 - b.built), b.w * T + 24, tot + 24); ctx.clip();
      }
      DR.drawBuilding(ctx, b.def, { color: b.owner.color, anim: b.anim, turret: b.turret, charge: b.def.sw ? b.charge / this.g.swTime : 0 });
      ctx.restore();
      if (b.built < 1) {
        ctx.strokeStyle = 'rgba(250,204,21,0.8)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.strokeRect(x + 2, y + 2, b.w * T - 4, b.h * T - 4); ctx.setLineDash([]);
      }
      if (!b.powered && b.def.power < 0 && Math.sin(this.g.time * 6) > 0) {
        ctx.fillStyle = '#facc15'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚡', b.x, b.y);
      }
      if (b.repairing) { ctx.fillStyle = '#fde047'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔧', b.x, b.y - 4 + Math.sin(this.g.time * 4) * 2); }
      if (b.selected) {
        const w = b.w * T, h = b.h * T, c = 8;
        ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { ctx.moveTo(cx + dx * c, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * c); }
        ctx.stroke();
        if (b.rally && b.owner === this.g.human) {
          ctx.strokeStyle = 'rgba(134,239,172,0.7)'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.rally.x, b.rally.y); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = '#86efac'; ctx.beginPath(); ctx.moveTo(b.rally.x, b.rally.y); ctx.lineTo(b.rally.x, b.rally.y - 14); ctx.lineTo(b.rally.x + 9, b.rally.y - 10); ctx.lineTo(b.rally.x, b.rally.y - 6); ctx.fill();
        }
        if (b.def.weapons.length) {
          let r = 0; for (const w of b.def.weapons) r = Math.max(r, w.range);
          ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(b.x, b.y, r * T, 0, 7); ctx.stroke();
        }
      }
    }
    drawSelection(ctx, u, alpha) {
      const x = U.lerp(u.px, u.x, alpha), y = U.lerp(u.py, u.y, alpha);
      ctx.strokeStyle = u.owner === this.g.human ? 'rgba(134,239,172,0.9)' : 'rgba(252,165,165,0.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y + 2, u.radius + 3, (u.radius + 3) * 0.6, 0, 0, 7); ctx.stroke();
    }
    drawUnitEnt(ctx, u, alpha) {
      const x = U.lerp(u.px, u.x, alpha), y = U.lerp(u.py, u.y, alpha);
      ctx.save(); ctx.translate(x, y);
      if (u.cloaked) ctx.globalAlpha = 0.35;
      DR.drawUnit(ctx, u.def, { color: u.owner.color, angle: u.angle, turret: u.turret, anim: u.anim, moving: u.moving, alt: u.alt, cargo: u.cargo / u.owner.mods.harvCap, recoil: U.clamp(1 - (this.g.time - u.lastFired) / 0.25, 0, 1) });
      ctx.restore();
    }
    drawHealth(ctx, x, y, w, f, e) {
      const h = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = f > 0.6 ? '#22c55e' : f > 0.3 ? '#eab308' : '#ef4444';
      ctx.fillRect(x - w / 2, y, w * U.clamp(f, 0, 1), h);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 1; i < 5; i++) ctx.fillRect(x - w / 2 + w * i / 5, y, 1, h);
      if (e.isUnit && e.rank > 0) { ctx.fillStyle = '#facc15'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('★'.repeat(e.rank), x + w / 2 + 2, y + 5); }
      if (e.isUnit && e.def.harvester && e.selected) { ctx.fillStyle = '#0e7490'; ctx.fillRect(x - w / 2, y + h + 1, w, 2); ctx.fillStyle = '#22d3ee'; ctx.fillRect(x - w / 2, y + h + 1, w * e.cargo / (500 * e.owner.mods.harvCap), 2); }
      if (e.isUnit && e.owner === this.g.human && e.group != null && e.selected) { ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(e.group, x - w / 2 - 2, y + 5); }
    }
    drawWorldUI(ctx, ui, realDt) {
      const g = this.g, m = g.map;
      // Platzierungsvorschau
      if (ui.placing) {
        const def = ui.placing.def, w = ui.mouseWorld;
        const tx = Math.floor(w.x / T - def.w / 2 + 0.5), ty = Math.floor(w.y / T - def.h / 2 + 0.5);
        ui.placeTx = tx; ui.placeTy = ty;
        const ok = g.canPlace(g.human, def, tx, ty);
        ctx.save(); ctx.translate(tx * T, ty * T); ctx.globalAlpha = 0.55;
        DR.drawBuilding(ctx, def, { color: g.human.color, anim: g.time, turret: 1.57 });
        ctx.restore();
        for (let y = ty; y < ty + def.h; y++) for (let x = tx; x < tx + def.w; x++) {
          ctx.fillStyle = m.buildable(x, y) && ok ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.45)';
          ctx.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
        }
        // Bauradius andeuten
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
        const R = (g.cfg.buildRadius || 6);
        for (const b of g.buildings) if (!b.dead && b.owner === g.human && !(b.def.cat === 'defense' && b.def.w === 1)) ctx.strokeRect((b.tx - R) * T, (b.ty - R) * T, (b.w + 2 * R) * T, (b.h + 2 * R) * T);
      }
      // Markierungen für Befehle
      for (const mk of this.markers) {
        mk.t += realDt; const f = mk.t / 0.6;
        ctx.strokeStyle = mk.c; ctx.globalAlpha = 1 - f; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(mk.x, mk.y, 14 * (1 - f * 0.6), 8 * (1 - f * 0.6), 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      }
      this.markers = this.markers.filter(mk => mk.t < 0.6);
      // Zielmodus Superwaffe
      if (ui.mode === 'sw' && ui.swBuilding) {
        const R = g.human.fdef.sw.radius * T, w = ui.mouseWorld;
        ctx.strokeStyle = 'rgba(255,80,60,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(w.x, w.y, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
      // Zielwegpunkte ausgewählter Einheiten
      if (ui.selection.length && ui.selection.length < 40 && ui.selection[0].owner === g.human) {
        ctx.strokeStyle = 'rgba(134,239,172,0.25)'; ctx.lineWidth = 1;
        for (const u of ui.selection) if (u.isUnit && u.path) {
          ctx.beginPath(); ctx.moveTo(u.x, u.y); for (let i = u.pathI; i < u.path.length; i++) ctx.lineTo(u.path[i].x, u.path[i].y); ctx.stroke();
        }
      }
    }
  }
  RTS.Renderer = Renderer;
})();
