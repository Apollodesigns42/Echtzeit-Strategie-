'use strict';
// ===== Karte: Generierung, Gelände, Kristallit, Darstellung des Untergrunds =====
(function () {
  const U = RTS.util, T = U.TILE;
  const TT = { GROUND: 0, SAND: 1, WATER: 2, ROCK: 3, TREE: 4, BLOSSOM: 5 };

  const BIOMES = {
    temperate: { name: 'Gemäßigt', ground: '#4d6b30', ground2: '#5f7d38', dirt: '#6e5b3b', sand: '#b8a372', water: '#1e4466', water2: '#2e6688', rock: '#625d57', rock2: '#857f76', cliff: '#2e2a26', tree: '#2d4a1f', tree2: '#3f6a2a', treeType: 'leaf' },
    desert:    { name: 'Wüste', ground: '#c4a26a', ground2: '#d1b27a', dirt: '#a6824f', sand: '#dcc390', water: '#1f5370', water2: '#2f7894', rock: '#94704c', rock2: '#b38c62', cliff: '#4d3a28', tree: '#5f6b33', tree2: '#7d8a45', treeType: 'cactus' },
    winter:    { name: 'Winter', ground: '#dbe5ec', ground2: '#eef3f6', dirt: '#9ba8b1', sand: '#c6d3dc', water: '#2a5675', water2: '#4a86a8', rock: '#5f6a73', rock2: '#86929b', cliff: '#2f363c', tree: '#2b4a3a', tree2: '#e8f0f4', treeType: 'pine' },
    wasteland: { name: 'Ödland', ground: '#5c4b3b', ground2: '#6b5845', dirt: '#3f342b', sand: '#7c654c', water: '#8a2a0a', water2: '#e0610f', rock: '#4a4038', rock2: '#6c5f53', cliff: '#1d1915', tree: '#2a221c', tree2: '#4a3b30', treeType: 'dead', lava: true },
  };

  // Vordefinierte Karten (Gefecht)
  const MAPS = [
    { id: 'gruene_grenze', name: 'Grüne Grenze', size: 96, biome: 'temperate', seed: 4711, maxPlayers: 4, water: 0.29, rock: 0.70, forest: 0.64, desc: 'Ausgewogene Karte mit Wäldern, Seen und reichen Kristallfeldern.' },
    { id: 'wuestenglut', name: 'Wüstenglut', size: 96, biome: 'desert', seed: 1337, maxPlayers: 4, water: 0.22, rock: 0.66, forest: 0.74, desc: 'Weite Wüste mit Felsplateaus. Viel Platz für Panzerschlachten.' },
    { id: 'frostbruch', name: 'Frostbruch', size: 112, biome: 'winter', seed: 9001, maxPlayers: 4, water: 0.30, rock: 0.64, forest: 0.63, desc: 'Große, zerklüftete Eislandschaft mit engen Pässen.' },
    { id: 'aschefeld', name: 'Aschefeld', size: 80, biome: 'wasteland', seed: 666, maxPlayers: 4, water: 0.27, rock: 0.69, forest: 0.70, desc: 'Kleine, verbrannte Vulkanebene mit Lavaseen. Schnelle Gefechte.' },
    { id: 'inselkette', name: 'Seenplatte', size: 112, biome: 'temperate', seed: 2024, maxPlayers: 4, water: 0.40, rock: 0.74, forest: 0.66, desc: 'Viele Seen und Flüsse. Schwebe- und Lufteinheiten im Vorteil.' },
    { id: 'zufall', name: 'Zufallskarte', size: 96, biome: 'random', seed: 0, maxPlayers: 4, water: 0.28, rock: 0.68, forest: 0.66, desc: 'Bei jedem Spiel eine neue Karte.' },
  ];

  class GameMap {
    constructor(def) {
      this.def = def;
      this.w = def.w || def.size; this.h = def.h || def.size;
      this.seed = def.seed || Math.floor(Math.random() * 1e9);
      let biome = def.biome;
      if (biome === 'random') biome = U.RNG(this.seed).pick(Object.keys(BIOMES));
      this.biomeId = biome; this.biome = BIOMES[biome];
      const n = this.w * this.h;
      this.type = new Uint8Array(n);
      this.elev = new Float32Array(n);
      this.ore = new Uint16Array(n);
      this.bld = new Int32Array(n);
      this.blossoms = [];
      this.starts = [];
      this.oreCenters = [];
      this.oreVersion = 0;
    }
    idx(tx, ty) { return ty * this.w + tx; }
    inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
    tileAt(x, y) { return [Math.floor(x / T), Math.floor(y / T)]; }
    terrainPass(tx, ty, mode) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
      const t = this.type[ty * this.w + tx];
      return t <= 1 || (mode === 1 && t === TT.WATER);
    }
    passable(tx, ty, mode) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
      const i = ty * this.w + tx; const t = this.type[i];
      if (this.bld[i] !== 0) return false;
      return t <= 1 || (mode === 1 && t === TT.WATER);
    }
    passablePx(x, y, mode) { return this.passable(Math.floor(x / T), Math.floor(y / T), mode); }
    buildable(tx, ty) {
      if (!this.inBounds(tx, ty)) return false;
      const i = this.idx(tx, ty);
      return this.type[i] <= 1 && this.bld[i] === 0 && this.ore[i] === 0;
    }

    // ---- Generierung ----
    generate(numPlayers, opts = {}) {
      const w = this.w, h = this.h, rng = U.RNG(this.seed), nz = U.makeNoise(this.seed), nz2 = U.makeNoise(this.seed + 77);
      const def = this.def;
      // Höhenfeld
      const sc = def.scale || 15;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let e = nz.fbm(x / sc, y / sc, 4);
        e = (e - 0.5) * 1.9 + 0.5;
        // Ränder leicht anheben (Felsen am Rand)
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
        if (edge < 3) e += (3 - edge) * 0.05;
        this.elev[y * w + x] = e;
      }
      // Startpositionen
      const inset = opts.inset || 12;
      const corners = [[inset, inset], [w - 1 - inset, h - 1 - inset], [w - 1 - inset, inset], [inset, h - 1 - inset]];
      if (opts.starts) this.starts = opts.starts.map(s => ({ tx: s[0], ty: s[1] }));
      else {
        const n = Math.max(2, numPlayers);
        // Bei 2 Spielern zufällig diagonal tauschen
        let order = [0, 1, 2, 3];
        if (n === 2 && rng.chance(0.5)) order = [2, 3, 0, 1];
        for (let i = 0; i < n; i++) this.starts.push({ tx: corners[order[i]][0], ty: corners[order[i]][1] });
      }
      const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
      // Kristallfelder planen
      const fields = [];
      const allStarts = opts.starts ? this.starts : corners.map(c => ({ tx: c[0], ty: c[1] }));
      const angOff = rng.range(-0.7, 0.7); // gleiche Abweichung für alle Starts -> faire Felder
      for (const s of allStarts) {
        const ang = Math.atan2(cy - s.ty, cx - s.tx) + angOff;
        fields.push({ tx: Math.round(s.tx + Math.cos(ang) * 11), ty: Math.round(s.ty + Math.sin(ang) * 11), r: 4 });
      }
      fields.push({ tx: cx, ty: cy, r: 5 });
      const mids = [[cx, inset], [cx, h - 1 - inset], [inset, cy], [w - 1 - inset, cy]];
      for (const m of mids) fields.push({ tx: m[0] + rng.int(-4, 4), ty: m[1] + rng.int(-3, 3), r: 4 });
      if (opts.extraFields) for (const f of opts.extraFields) fields.push({ tx: f[0], ty: f[1], r: f[2] || 4 });
      this.oreCenters = fields;

      const flatten = (tx, ty, r, str) => {
        for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
          if (!this.inBounds(x, y)) continue;
          const d = Math.hypot(x - tx, y - ty); if (d > r) continue;
          const i = y * w + x; const f = str * (1 - Math.pow(d / r, 3));
          this.elev[i] = U.lerp(this.elev[i], 0.5, U.clamp(f, 0, 1));
        }
      };
      const corridor = (ax, ay, bx, by, r) => {
        const len = Math.hypot(bx - ax, by - ay); const steps = Math.ceil(len);
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          // leicht gekrümmte Pfade
          const wob = Math.sin(t * Math.PI) * 4 * Math.sin(ax + by);
          const px = ax + (bx - ax) * t + (-(by - ay) / len) * wob, py = ay + (by - ay) * t + ((bx - ax) / len) * wob;
          flatten(Math.round(px), Math.round(py), r, 0.85);
        }
      };
      for (const s of this.starts) flatten(s.tx, s.ty, 11, 1);
      for (const f of fields) flatten(f.tx, f.ty, f.r + 2, 0.95);
      for (const s of allStarts) corridor(s.tx, s.ty, cx, cy, 3);
      for (let i = 0; i < allStarts.length; i++) {
        const a = allStarts[i], b = allStarts[(i + 2) % allStarts.length];
        corridor(a.tx, a.ty, b.tx, b.ty, 2);
      }
      for (const f of fields) {
        let best = null, bd = 1e9;
        for (const s of allStarts) { const d = Math.hypot(s.tx - f.tx, s.ty - f.ty); if (d < bd) { bd = d; best = s; } }
        corridor(f.tx, f.ty, best.tx, best.ty, 2);
      }
      if (opts.flatten) for (const f of opts.flatten) flatten(f[0], f[1], f[2], 1);
      if (opts.corridors) for (const c of opts.corridors) corridor(c[0], c[1], c[2], c[3], c[4] || 3);

      // Klassifizieren
      const wT = def.water, rT = def.rock, fT = def.forest;
      this.waterT = wT; this.rockT = rT;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, e = this.elev[i];
        let t = TT.GROUND;
        if (e < wT) t = TT.WATER;
        else if (e > rT) t = TT.ROCK;
        else if (e < wT + 0.035) t = TT.SAND;
        this.type[i] = t;
      }
      // Bäume
      const near = (x, y, r) => { for (const s of this.starts) if (Math.hypot(s.tx - x, s.ty - y) < r) return true; for (const f of fields) if (Math.hypot(f.tx - x, f.ty - y) < f.r + 2.5) return true; return false; };
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (this.type[i] !== TT.GROUND) continue;
        const f = nz2.fbm(x / 7, y / 7, 3);
        if (f > fT && !near(x, y, 9) && rng.chance(0.75)) this.type[i] = TT.TREE;
      }
      // Kristallit
      for (const f of fields) {
        if (!this.inBounds(f.tx, f.ty)) continue;
        const bi = this.idx(f.tx, f.ty);
        this.type[bi] = TT.BLOSSOM; this.blossoms.push({ tx: f.tx, ty: f.ty, r: f.r });
        for (let y = f.ty - f.r; y <= f.ty + f.r; y++) for (let x = f.tx - f.r; x <= f.tx + f.r; x++) {
          if (!this.inBounds(x, y)) continue;
          const d = Math.hypot(x - f.tx, y - f.ty); if (d > f.r + 0.3 || d < 0.5) continue;
          const i = this.idx(x, y); if (this.type[i] > 1) continue;
          if (d > f.r - 1 && rng.chance(0.4)) continue;
          this.ore[i] = Math.round(U.lerp(420, 140, d / f.r) + rng.range(-40, 40));
        }
      }
      this.ensureConnectivity();
    }

    // Unerreichbare Taschen in Felsen umwandeln, damit Wegfindung nicht ins Leere läuft
    ensureConnectivity() {
      const w = this.w, h = this.h, n = w * h;
      const comp = new Int32Array(n).fill(-1);
      const s = this.starts[0]; if (!s) return;
      const stack = [this.idx(s.tx, s.ty)]; comp[stack[0]] = 0;
      while (stack.length) {
        const i = stack.pop(); const x = i % w, y = (i / w) | 0;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of nb) {
          const nx = x + dx, ny = y + dy; if (!this.inBounds(nx, ny)) continue;
          const j = ny * w + nx; if (comp[j] !== -1) continue;
          if (this.type[j] > 1 && this.type[j] !== TT.WATER) continue; // Wasser gilt für Schweber als verbunden
          comp[j] = 0; stack.push(j);
        }
      }
      for (let i = 0; i < n; i++) if (comp[i] === -1 && this.type[i] <= 1) { this.type[i] = TT.TREE; this.ore[i] = 0; }
    }

    // ---- Kristallit ----
    findOreNear(tx, ty, maxR) {
      for (let r = 0; r <= maxR; r++) {
        let best = -1, bd = 1e9;
        for (let y = ty - r; y <= ty + r; y++) {
          if (y < 0 || y >= this.h) continue;
          const step = (y === ty - r || y === ty + r) ? 1 : 2 * r;
          for (let x = tx - r; x <= tx + r; x += (step || 1)) {
            if (x < 0 || x >= this.w) continue;
            const i = y * this.w + x;
            if (this.ore[i] > 0 && this.bld[i] === 0) { const d = (x - tx) * (x - tx) + (y - ty) * (y - ty); if (d < bd) { bd = d; best = i; } }
          }
        }
        if (best >= 0) return { tx: best % this.w, ty: (best / this.w) | 0 };
      }
      return null;
    }
    growOre(rng) {
      for (const b of this.blossoms) {
        for (let k = 0; k < 3; k++) {
          const x = b.tx + rng.int(-b.r, b.r), y = b.ty + rng.int(-b.r, b.r);
          if (!this.inBounds(x, y) || Math.hypot(x - b.tx, y - b.ty) > b.r + 0.5) continue;
          const i = this.idx(x, y); if (this.type[i] > 1 || this.bld[i]) continue;
          if (this.ore[i] < 450) { this.ore[i] = Math.min(450, this.ore[i] + 30); this.oreVersion++; }
        }
      }
    }

    nearestPassable(tx, ty, mode, maxR = 12) {
      if (this.passable(tx, ty, mode)) return { tx, ty };
      for (let r = 1; r <= maxR; r++) {
        let best = null, bd = 1e9;
        for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
          if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
          if (this.passable(x, y, mode)) { const d = (x - tx) ** 2 + (y - ty) ** 2; if (d < bd) { bd = d; best = { tx: x, ty: y }; } }
        }
        if (best) return best;
      }
      return null;
    }

    // ---- Darstellung ----
    renderTerrain() {
      const w = this.w, h = this.h, W = w * T, H = h * T, B = this.biome;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(W, H); const data = img.data;
      // Detailtexturen
      const nz = U.makeNoise(this.seed + 5);
      const TX = 256; const det = new Float32Array(TX * TX), det2 = new Float32Array(TX * TX);
      for (let y = 0; y < TX; y++) for (let x = 0; x < TX; x++) {
        // kachelbares Rauschen durch Mischung
        const f = (xx, yy, s) => nz.fbm(xx / s, yy / s, 3);
        const a = f(x, y, 6), b = f(x - TX, y, 6), c = f(x, y - TX, 6), d = f(x - TX, y - TX, 6);
        const u = x / TX, v = y / TX;
        det[y * TX + x] = U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
        const a2 = f(x, y, 24), b2 = f(x - TX, y, 24), c2 = f(x, y - TX, 24), d2 = f(x - TX, y - TX, 24);
        det2[y * TX + x] = U.lerp(U.lerp(a2, b2, u), U.lerp(c2, d2, u), v);
      }
      const col = {}; for (const k of ['ground', 'ground2', 'dirt', 'sand', 'water', 'water2', 'rock', 'rock2', 'cliff']) col[k] = U.hexToRgb(B[k]);
      const E = this.elev, wT = this.waterT, rT = this.rockT;
      const sampleE = (fx, fy) => {
        let x0 = Math.floor(fx), y0 = Math.floor(fy); const tx = fx - x0, ty = fy - y0;
        const x1 = Math.min(w - 1, Math.max(0, x0 + 1)), y1 = Math.min(h - 1, Math.max(0, y0 + 1));
        x0 = Math.min(w - 1, Math.max(0, x0)); y0 = Math.min(h - 1, Math.max(0, y0));
        const a = E[y0 * w + x0], b = E[y0 * w + x1], c = E[y1 * w + x0], d = E[y1 * w + x1];
        return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      };
      for (let py = 0; py < H; py++) {
        const fy = py / T - 0.5;
        for (let px = 0; px < W; px++) {
          const fx = px / T - 0.5;
          const di = (py & 255) * TX + (px & 255);
          const d1 = det[di], d2 = det2[di];
          const e = sampleE(fx, fy) + (d1 - 0.5) * 0.035;
          let r, g, b;
          if (e < wT) {
            const depth = U.clamp((wT - e) / 0.12, 0, 1);
            const c1 = col.water2, c2 = col.water;
            r = U.lerp(c1[0], c2[0], depth); g = U.lerp(c1[1], c2[1], depth); b = U.lerp(c1[2], c2[2], depth);
            const wave = (d1 - 0.5) * 30; r += wave * 0.5; g += wave; b += wave;
            if (wT - e < 0.008) { r += 40; g += 40; b += 40; }
          } else if (e > rT) {
            const ex = sampleE(fx - 0.25, fy - 0.25), light = U.clamp((e - ex) * 40, -1, 1);
            const hgt = U.clamp((e - rT) / 0.12, 0, 1);
            const c1 = col.rock, c2 = col.rock2;
            r = U.lerp(c1[0], c2[0], hgt * d1); g = U.lerp(c1[1], c2[1], hgt * d1); b = U.lerp(c1[2], c2[2], hgt * d1);
            const lv = light * 45 + (d1 - 0.5) * 36; r += lv; g += lv; b += lv;
            if (e - rT < 0.012) { const cc = col.cliff; r = U.lerp(r, cc[0], 0.7); g = U.lerp(g, cc[1], 0.7); b = U.lerp(b, cc[2], 0.7); }
          } else {
            const sandT = U.clamp(1 - (e - wT) / 0.05, 0, 1);
            const g1 = col.ground, g2 = col.ground2, dd = col.dirt;
            r = U.lerp(g1[0], g2[0], d1); g = U.lerp(g1[1], g2[1], d1); b = U.lerp(g1[2], g2[2], d1);
            const dirtAmt = U.clamp((d2 - 0.55) * 4, 0, 0.85);
            r = U.lerp(r, dd[0], dirtAmt); g = U.lerp(g, dd[1], dirtAmt); b = U.lerp(b, dd[2], dirtAmt);
            if (sandT > 0) { const s = col.sand; r = U.lerp(r, s[0], sandT); g = U.lerp(g, s[1], sandT); b = U.lerp(b, s[2], sandT); }
            // Schatten vor Felsen
            if (e > rT - 0.03) { const k = (e - (rT - 0.03)) / 0.03 * 0.35; r *= 1 - k; g *= 1 - k; b *= 1 - k; }
            const grain = ((px * 7919 + py * 104729) % 13) - 6; r += grain; g += grain; b += grain;
          }
          const o = (py * W + px) * 4;
          data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      // Bäume / Deko
      const rng = U.RNG(this.seed + 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const t = this.type[y * w + x];
        if (t === TT.TREE) this.drawTree(ctx, x * T + T / 2 + rng.range(-5, 5), y * T + T / 2 + rng.range(-5, 5), rng);
        else if (t === TT.GROUND && rng.chance(0.025)) {
          // kleine Steine
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; const sx = x * T + rng.range(4, 28), sy = y * T + rng.range(4, 28);
          ctx.beginPath(); ctx.ellipse(sx + 1, sy + 1, 3, 2, 0, 0, 7); ctx.fill();
          ctx.fillStyle = B.rock2; ctx.beginPath(); ctx.ellipse(sx, sy, 2.5, 1.8, 0, 0, 7); ctx.fill();
        }
      }
      this.terrainCanvas = cv;
      this.renderMinimapBase();
      return cv;
    }
    drawTree(ctx, x, y, rng) {
      const B = this.biome;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(x + 5, y + 6, 12, 8, 0, 0, 7); ctx.fill();
      if (B.treeType === 'leaf') {
        for (let k = 0; k < 3; k++) {
          const ox = rng.range(-6, 6), oy = rng.range(-6, 6), r = rng.range(7, 11);
          const g = ctx.createRadialGradient(x + ox - 3, y + oy - 3, 1, x + ox, y + oy, r);
          g.addColorStop(0, B.tree2); g.addColorStop(1, B.tree);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, 7); ctx.fill();
        }
      } else if (B.treeType === 'pine') {
        for (let k = 0; k < 2; k++) {
          const ox = rng.range(-6, 6), oy = rng.range(-5, 5), r = rng.range(7, 10);
          ctx.fillStyle = B.tree; ctx.beginPath();
          for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2, rr = a % 2 ? r * 0.55 : r; ctx.lineTo(x + ox + Math.cos(ang) * rr, y + oy + Math.sin(ang) * rr); }
          ctx.fill(); ctx.fillStyle = B.tree2; ctx.beginPath(); ctx.arc(x + ox - 1, y + oy - 1, r * 0.35, 0, 7); ctx.fill();
        }
      } else if (B.treeType === 'cactus') {
        ctx.fillStyle = B.tree; ctx.strokeStyle = B.tree2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + 7, y + 3, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#8a7350'; ctx.beginPath(); ctx.ellipse(x - 7, y + 5, 6, 4, 0.3, 0, 7); ctx.fill();
      } else {
        ctx.strokeStyle = B.tree2; ctx.lineWidth = 2.5;
        for (let k = 0; k < 5; k++) { const a = rng.range(0, 6.28); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10); ctx.stroke(); }
        ctx.fillStyle = B.tree; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
      }
    }
    renderMinimapBase() {
      const w = this.w, h = this.h, B = this.biome;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d'); const img = ctx.createImageData(w, h);
      const cols = [U.hexToRgb(B.ground), U.hexToRgb(B.sand), U.hexToRgb(B.water), U.hexToRgb(B.rock), U.hexToRgb(B.tree), [120, 230, 255]];
      for (let i = 0; i < w * h; i++) {
        const c = cols[this.type[i]]; const o = i * 4;
        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      this.minimapBase = cv;
    }
    addScorch(x, y, r) {
      if (!this.terrainCanvas) return;
      const ctx = this.terrainCanvas.getContext('2d');
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(15,10,5,0.55)'); g.addColorStop(0.6, 'rgba(25,18,10,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }

  RTS.TT = TT;
  RTS.BIOMES = BIOMES;
  RTS.MAPS = MAPS;
  RTS.GameMap = GameMap;
})();
