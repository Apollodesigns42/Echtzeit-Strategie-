'use strict';
// ===== Karte: Generierung, Gelände, Kristallit, Darstellung des Untergrunds =====
(function () {
  const U = RTS.util, T = U.TILE;
  const TT = { GROUND: 0, SAND: 1, WATER: 2, ROCK: 3, TREE: 4, BLOSSOM: 5 };

  const BIOMES = {
    temperate: { name: 'Gemäßigt', ground: '#4d6b30', ground2: '#5f7d38', dirt: '#6e5b3b', sand: '#b8a372', water: '#1e4466', water2: '#2e6688', rock: '#575049', rock2: '#7a7167', cliff: '#2a241f', tree: '#2d4a1f', tree2: '#3f6a2a', treeType: 'leaf' },
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
    { id: 'spiegeltal', name: 'Spiegeltal', size: 96, biome: 'temperate', seed: 3141, maxPlayers: 4, water: 0.28, rock: 0.69, forest: 0.66, symmetric: true, desc: 'Vollständig gespiegelte Turnierkarte: exakt gleiche Bedingungen an jeder Startposition.' },
    { id: 'eiskreuz', name: 'Eiskreuz', size: 104, biome: 'winter', seed: 2718, maxPlayers: 4, water: 0.31, rock: 0.66, forest: 0.64, symmetric: true, desc: 'Gespiegelte Winterkarte mit gefrorenen Seen und engen Felspässen.' },
    { id: 'glutkessel', name: 'Glutkessel', size: 112, biome: 'wasteland', seed: 8128, maxPlayers: 4, water: 0.31, rock: 0.67, forest: 0.72, desc: 'Großes Vulkanbecken mit Lavaströmen. Schweber und Flieger kürzen ab.' },
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
      const sym = !!def.symmetric && !opts.starts;
      if (sym) {
        // nur das linke obere Viertel planen, der Rest entsteht durch Spiegelung
        fields.push({ tx: cx - 3, ty: cy - 3, r: 5 });
        fields.push({ tx: cx - 3, ty: inset, r: 4 }, { tx: inset, ty: cy - 3, r: 4 });
      } else {
        fields.push({ tx: cx, ty: cy, r: 5 });
        const mids = [[cx, inset], [cx, h - 1 - inset], [inset, cy], [w - 1 - inset, cy]];
        for (const m of mids) fields.push({ tx: m[0] + rng.int(-4, 4), ty: m[1] + rng.int(-3, 3), r: 4 });
      }
      if (opts.extraFields) for (const f of opts.extraFields) fields.push({ tx: f[0], ty: f[1], r: f[2] || 4 });
      this.oreCenters = fields;
      // Neutrale, eroberbare Gebäude (punktsymmetrisch verteilt)
      this.neutralSpots = [];
      if (opts.neutrals && !opts.starts) {
        const dx0 = Math.round(inset + (cx - inset) * 0.62) - 1, dy0 = Math.round(inset + (cy - inset) * 0.25) - 1;
        for (const [mx, my] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.neutralSpots.push({ id: 'n_derrick', tx: mx ? w - 2 - dx0 : dx0, ty: my ? h - 2 - dy0 : dy0 });
        const oy0 = Math.round(cy - h * 0.2) - 1;
        this.neutralSpots.push({ id: 'n_outpost', tx: cx - 1, ty: oy0 }, { id: 'n_outpost', tx: cx - 1, ty: h - 2 - oy0 });
      }

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
      for (const n of this.neutralSpots) flatten(n.tx + 1, n.ty + 1, 4, 1);
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
      for (const n of this.neutralSpots) {
        let best = null, bd = 1e9;
        for (const s of allStarts) { const d = Math.hypot(s.tx - n.tx, s.ty - n.ty); if (d < bd) { bd = d; best = s; } }
        corridor(n.tx + 1, n.ty + 1, best.tx, best.ty, 2);
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
      const near = (x, y, r) => { for (const s of this.starts) if (Math.hypot(s.tx - x, s.ty - y) < r) return true; for (const f of fields) if (Math.hypot(f.tx - x, f.ty - y) < f.r + 2.5) return true; for (const n of this.neutralSpots) if (Math.hypot(n.tx + 1 - x, n.ty + 1 - y) < 4) return true; return false; };
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
      if (sym) this.mirrorQuadrants();
      this.ensureConnectivity();
    }
    // Spiegelt das linke obere Viertel auf die ganze Karte (faire, symmetrische Karten)
    mirrorQuadrants() {
      const w = this.w, h = this.h;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = Math.min(x, w - 1 - x), sy = Math.min(y, h - 1 - y);
        if (sx === x && sy === y) continue;
        const i = y * w + x, j = sy * w + sx;
        this.type[i] = this.type[j]; this.ore[i] = this.ore[j]; this.elev[i] = this.elev[j];
      }
      this.blossoms = [];
      for (let i = 0; i < w * h; i++) if (this.type[i] === TT.BLOSSOM) {
        const tx = i % w, ty = (i / w) | 0;
        this.blossoms.push({ tx, ty, r: Math.hypot(tx - w / 2, ty - h / 2) < 8 ? 5 : 4 });
      }
      this.oreCenters = this.blossoms.map(b => ({ tx: b.tx, ty: b.ty, r: b.r }));
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
    // Kristallit wächst rund um die Kristallblüten nach (trägt dauerhaft etwa 3 Sammler pro Feld)
    growOre(rng) {
      for (const b of this.blossoms) {
        for (let k = 0; k < 5; k++) {
          const a = rng.next() * 6.283, d = 0.8 + Math.sqrt(rng.next()) * (b.r - 0.3);
          const x = Math.round(b.tx + Math.cos(a) * d), y = Math.round(b.ty + Math.sin(a) * d);
          if (!this.inBounds(x, y)) continue;
          const i = this.idx(x, y); if (this.type[i] > 1 || this.bld[i]) continue;
          if (this.ore[i] < 450) { this.ore[i] = Math.min(450, this.ore[i] + 38); this.oreVersion++; }
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
      // Kachelbare Detailtexturen (fein, mittel, grob)
      const TX = 256;
      const texOf = (seed, freq, oct) => { const c = RTS.gfx.noise(TX, freq, seed, oct); return c.getContext('2d').getImageData(0, 0, TX, TX).data; };
      const tFine = texOf(this.seed + 5, 48, 3), tMid = texOf(this.seed + 6, 12, 4), tBig = texOf(this.seed + 7, 4, 4), tStr = texOf(this.seed + 8, 24, 2);
      const col = {}; for (const k of ['ground', 'ground2', 'dirt', 'sand', 'water', 'water2', 'rock', 'rock2', 'cliff']) col[k] = U.hexToRgb(B[k]);
      const E = this.elev, wT = this.waterT, rT = this.rockT;
      const sampleE = (fx, fy) => {
        let x0 = Math.floor(fx), y0 = Math.floor(fy); const tx = fx - x0, ty = fy - y0;
        const x1 = Math.min(w - 1, Math.max(0, x0 + 1)), y1 = Math.min(h - 1, Math.max(0, y0 + 1));
        x0 = Math.min(w - 1, Math.max(0, x0)); y0 = Math.min(h - 1, Math.max(0, y0));
        const a = E[y0 * w + x0], b = E[y0 * w + x1], c = E[y1 * w + x0], d = E[y1 * w + x1];
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
      };
      const lava = !!B.lava;
      const CLIFF = 0.42; // Höhe der Felswände in Kacheln
      for (let py = 0; py < H; py++) {
        const fy = py / T - 0.5;
        for (let px = 0; px < W; px++) {
          const fx = px / T - 0.5;
          const ti = ((py & 255) * TX + (px & 255)) * 4;
          const nF = tFine[ti] / 255, nM = tMid[ti] / 255, nB = tBig[(((py >> 2) & 255) * TX + ((px >> 2) & 255)) * 4] / 255;
          const e = sampleE(fx, fy) + (nM - 0.5) * 0.03 + (nF - 0.5) * 0.008;
          // Relief (Licht von Nordwesten)
          const eN = sampleE(fx - 0.3, fy - 0.3);
          const slope = U.clamp((e - eN) * 30, -1, 1);
          let r, g, b, a = 255;
          let cliffK = -1;
          if (e <= rT && e > rT - 0.2) {
            // liegt dieser Bodenpixel optisch in einer Felswand (Fels direkt nördlich)?
            for (let k = 1; k <= 8; k++) { if (sampleE(fx, fy - CLIFF * k / 8) > rT) { cliffK = k / 8; break; } }
          }
          if (cliffK >= 0) {
            // Felswand: vertikale Schichten, unten dunkler
            const strata = tStr[(((py * 3) & 255) * TX + ((px >> 1) & 255)) * 4] / 255;
            const cc = col.cliff, rc = col.rock;
            const t2 = cliffK;
            r = U.lerp(rc[0], cc[0], 0.5 + t2 * 0.4); g = U.lerp(rc[1], cc[1], 0.5 + t2 * 0.4); b = U.lerp(rc[2], cc[2], 0.5 + t2 * 0.4);
            const l = (strata - 0.5) * 50 + (nF - 0.5) * 25 - t2 * 25; r += l; g += l; b += l;
            if (cliffK <= 1 / 8) { r += 30; g += 30; b += 30; } // Abbruchkante
          } else if (e < wT) {
            const depth = U.clamp((wT - e) / 0.06, 0, 1);
            if (lava) { const c1 = col.water2; r = c1[0]; g = c1[1]; b = c1[2]; }
            else { const s = col.sand, c1 = col.water2; r = U.lerp(s[0], c1[0], 0.6); g = U.lerp(s[1], c1[1], 0.6); b = U.lerp(s[2], c1[2], 0.6); }
            a = Math.round(U.clamp(1 - depth * 1.6, 0, 1) * (lava ? 120 : 170));
            if (wT - e < 0.006 && !lava) { r = 235; g = 245; b = 245; a = 200 * (0.6 + nF * 0.4); } // Schaumkante
            if (wT - e < 0.006 && lava) { r = 40; g = 20; b = 10; a = 230; }
          } else if (e > rT) {
            const hgt = U.clamp((e - rT) / 0.15, 0, 1);
            const c1 = col.rock, c2 = col.rock2;
            // zerklüftete Oberfläche aus kontinuierlichem Rauschen (Licht von NW)
            const i0 = ti, i1 = ((((py - 2) & 255) * TX + ((px - 2) & 255)) * 4);
            const h0 = tMid[i0] * 0.6 + tFine[i0] * 0.4, h1 = tMid[i1] * 0.6 + tFine[i1] * 0.4;
            const sh = U.clamp((h0 - h1) / 255 * 7, -1, 1);
            const m = U.clamp(hgt * 0.5 + nB * 0.6 - 0.1, 0, 1);
            r = U.lerp(c1[0], c2[0], m); g = U.lerp(c1[1], c2[1], m); b = U.lerp(c1[2], c2[2], m);
            const crack = Math.abs(tStr[ti] / 255 - 0.5) < 0.01 && nM > 0.5 ? -30 : 0;
            const lv = sh * 60 + (nM - 0.5) * 30 + slope * 18 + crack;
            r += lv; g += lv; b += lv;
            // Rand zum Abgrund aufhellen
            if (e - rT < 0.015) { r += 18; g += 18; b += 18; }
          } else {
            const g1 = col.ground, g2 = col.ground2, dd = col.dirt, sd = col.sand;
            const m = U.clamp(nM * 0.7 + nF * 0.5 - 0.1, 0, 1);
            r = U.lerp(g1[0], g2[0], m); g = U.lerp(g1[1], g2[1], m); b = U.lerp(g1[2], g2[2], m);
            // Erd-/Kiesflecken
            const dirtAmt = U.clamp((nB - 0.58) * 5 + (nM - 0.5) * 0.8, 0, 0.9);
            r = U.lerp(r, dd[0], dirtAmt); g = U.lerp(g, dd[1], dirtAmt); b = U.lerp(b, dd[2], dirtAmt);
            const sandT = U.clamp(1 - (e - wT) / 0.045, 0, 1);
            if (sandT > 0) { const wet = sandT > 0.8 ? 0.8 : 1; r = U.lerp(r, sd[0] * wet, sandT); g = U.lerp(g, sd[1] * wet, sandT); b = U.lerp(b, sd[2] * wet, sandT); }
            // Schatten am Fuß von Felsen (Umgebungsverdeckung)
            if (e > rT - 0.04) { const k = (e - (rT - 0.04)) / 0.04 * 0.35; r *= 1 - k; g *= 1 - k; b *= 1 - k; }
            const lv = slope * 22 + (nF - 0.5) * 22; r += lv; g += lv; b += lv;
          }
          const o = (py * W + px) * 4;
          data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
        }
      }
      ctx.putImageData(img, 0, 0);
      this.decorate(ctx);
      this.terrainCanvas = cv;
      this.renderMinimapBase();
      this.makeWaterTex();
      return cv;
    }
    // Kleindetails: Grasbüschel, Steine, Blumen, Risse
    decorate(ctx) {
      const w = this.w, h = this.h, B = this.biome, rng = U.RNG(this.seed + 3), bt = this.biomeId;
      const tt = (x, y) => this.type[Math.floor(y / T) * w + Math.floor(x / T)];
      const N = w * h * 9;
      for (let i = 0; i < N; i++) {
        const x = rng.range(2, w * T - 2), y = rng.range(2, h * T - 2);
        const t = tt(x, y);
        if (t !== TT.GROUND) continue;
        const r = rng.next();
        if (bt === 'temperate') {
          if (r < 0.75) { // Grasbüschel
            const c = rng.chance(0.5) ? U.shade(B.ground2, 0.25) : U.shade(B.ground, -0.25);
            ctx.strokeStyle = c; ctx.lineWidth = 0.8; ctx.beginPath();
            for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + rng.range(-0.7, 0.7); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * rng.range(2, 4), y + Math.sin(a) * rng.range(2, 4)); }
            ctx.stroke();
          } else if (r < 0.8) { ctx.fillStyle = rng.pick(['#fde047', '#f9fafb', '#c084fc', '#fb7185']); ctx.beginPath(); ctx.arc(x, y, 0.9, 0, 7); ctx.fill(); }
          else if (r < 0.86) this.pebble(ctx, x, y, rng);
        } else if (bt === 'desert') {
          if (r < 0.3) this.pebble(ctx, x, y, rng);
          else if (r < 0.45) { ctx.strokeStyle = 'rgba(120,90,50,0.25)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x, y - 2, x + 5, y); ctx.stroke(); }
          else if (r < 0.48) { ctx.strokeStyle = '#7d6b3a'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = rng.range(0, 6.28); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); } ctx.stroke(); }
        } else if (bt === 'winter') {
          if (r < 0.25) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x, y, 0.8, 0.8); }
          else if (r < 0.32) this.pebble(ctx, x, y, rng);
          else if (r < 0.36) { ctx.strokeStyle = 'rgba(80,100,120,0.25)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 3; k++) ctx.lineTo(x + rng.range(-6, 6), y + rng.range(-3, 3)); ctx.stroke(); }
        } else {
          if (r < 0.3) this.pebble(ctx, x, y, rng);
          else if (r < 0.4) { ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x, y); let cx = x, cy = y; for (let k = 0; k < 4; k++) { cx += rng.range(-5, 5); cy += rng.range(-4, 4); ctx.lineTo(cx, cy); } ctx.stroke(); }
          else if (r < 0.42) { ctx.fillStyle = 'rgba(255,90,20,0.6)'; ctx.fillRect(x, y, 1, 1); }
        }
      }
      // Bäume (von Norden nach Süden für korrekte Überdeckung)
      const trees = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (this.type[y * w + x] === TT.TREE) trees.push([x, y]);
      const pos = trees.map(([x, y]) => [x * T + T / 2 + rng.range(-5, 5), y * T + T / 2 + rng.range(-5, 5)]);
      for (const [x, y] of pos) this.drawTree(ctx, x, y, rng, true);
      for (const [x, y] of pos) this.drawTree(ctx, x, y, rng, false);
    }
    pebble(ctx, x, y, rng) {
      const s = rng.range(1, 2.6);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 0.8, y + 0.8, s, s * 0.7, 0, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(x - s * 0.4, y - s * 0.4, 0.2, x, y, s);
      g.addColorStop(0, U.shade(this.biome.rock2, 0.35)); g.addColorStop(1, this.biome.rock);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.7, rng.range(0, 3), 0, 7); ctx.fill();
    }
    makeWaterTex() {
      const S = 256, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
      const c = cv.getContext('2d'); const img = c.createImageData(S, S);
      const n1 = RTS.gfx.noise(S, 6, this.seed + 70, 4).getContext('2d').getImageData(0, 0, S, S).data;
      const lava = !!this.biome.lava;
      for (let i = 0; i < S * S; i++) {
        const v = n1[i * 4] / 255;
        const ridge = Math.pow(1 - Math.abs(v - 0.5) * 2, lava ? 3 : 5);
        if (lava) { img.data[i * 4] = 255; img.data[i * 4 + 1] = 120 + ridge * 135; img.data[i * 4 + 2] = 30 + ridge * 120; img.data[i * 4 + 3] = ridge * 255; }
        else { img.data[i * 4] = 200; img.data[i * 4 + 1] = 235; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = ridge * 70; }
      }
      c.putImageData(img, 0, 0);
      this.waterTex = cv;
    }
    drawTree(ctx, x, y, rng, shadowPass) {
      const B = this.biome;
      if (shadowPass) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x + 7, y + 7, 13, 8, 0.3, 0, 7); ctx.fill(); return; }
      if (B.treeType === 'leaf') {
        const n = 4 + Math.floor(rng.next() * 3);
        for (let k = 0; k < n; k++) {
          const ox = rng.range(-7, 7), oy = rng.range(-7, 6), r = rng.range(5.5, 9.5);
          const g = ctx.createRadialGradient(x + ox - r * 0.4, y + oy - r * 0.45, r * 0.1, x + ox, y + oy, r);
          g.addColorStop(0, U.shade(B.tree2, 0.3)); g.addColorStop(0.5, B.tree2); g.addColorStop(1, U.shade(B.tree, -0.35));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, 7); ctx.fill();
          // Blattstruktur
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(x + ox + rng.range(-r * 0.6, r * 0.2), y + oy + rng.range(-r * 0.6, r * 0.2), rng.range(1, 2), 0, 7); ctx.fill(); }
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(x + ox + rng.range(0, r * 0.6), y + oy + rng.range(0, r * 0.6), rng.range(1, 2.2), 0, 7); ctx.fill(); }
        }
      } else if (B.treeType === 'pine') {
        for (let k = 0; k < 2; k++) {
          const ox = rng.range(-6, 6), oy = rng.range(-5, 5), r = rng.range(8, 11);
          for (let tier = 0; tier < 3; tier++) {
            const rr = r * (1 - tier * 0.28), cx = x + ox, cy = y + oy - tier * 2.5;
            ctx.fillStyle = U.shade(B.tree, tier * 0.12 - 0.15); ctx.beginPath();
            for (let a = 0; a < 16; a++) { const ang = a / 16 * Math.PI * 2, d = a % 2 ? rr * 0.6 : rr; ctx.lineTo(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d); }
            ctx.fill();
            ctx.fillStyle = 'rgba(240,248,255,0.85)'; ctx.beginPath(); ctx.arc(cx - rr * 0.25, cy - rr * 0.25, rr * 0.35, 0, 7); ctx.fill();
          }
        }
      } else if (B.treeType === 'cactus') {
        ctx.fillStyle = '#7d6a45'; ctx.beginPath(); ctx.ellipse(x - 7, y + 5, 7, 4.5, 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(x - 8, y + 3.5, 4, 2, 0.3, 0, 7); ctx.fill();
        for (const [ox, oy, r] of [[0, 0, 4.8], [6, 3, 3], [-3, -5, 2.6]]) {
          const g = ctx.createRadialGradient(x + ox - r * 0.4, y + oy - r * 0.4, 0.3, x + ox, y + oy, r);
          g.addColorStop(0, '#9fb05a'); g.addColorStop(1, '#3f4f22'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.4; for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + Math.cos(a) * r, y + oy + Math.sin(a) * r); ctx.stroke(); }
        }
      } else {
        ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let k = 0; k < 5; k++) { const a = rng.range(0, 6.28), l = rng.range(6, 12); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
        ctx.strokeStyle = B.tree2; ctx.lineWidth = 1.4;
        for (let k = 0; k < 5; k++) { const a = rng.range(0, 6.28), l = rng.range(6, 12); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
        ctx.fillStyle = '#2a211a'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
        ctx.lineCap = 'butt';
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
