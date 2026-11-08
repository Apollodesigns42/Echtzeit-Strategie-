'use strict';
// ===== Grundlegende Hilfsfunktionen =====
window.RTS = window.RTS || {};
(function () {
  const U = {};
  U.TILE = 32;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  U.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  U.rotateTowards = (cur, target, maxStep) => {
    const d = U.angDiff(cur, target);
    if (Math.abs(d) <= maxStep) return target;
    return cur + Math.sign(d) * maxStep;
  };
  U.fmtTime = (s) => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; };

  // Deterministischer Zufallsgenerator (mulberry32)
  U.RNG = function (seed) {
    let a = (seed >>> 0) || 1;
    const next = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return {
      next,
      range: (lo, hi) => lo + next() * (hi - lo),
      int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
    };
  };

  // Value-Noise mit fraktaler Überlagerung
  U.makeNoise = function (seed) {
    const rng = U.RNG(seed);
    const SIZE = 256, perm = new Uint16Array(SIZE * 2), vals = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) { perm[i] = i; vals[i] = rng.next(); }
    for (let i = SIZE - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < SIZE; i++) perm[i + SIZE] = perm[i];
    const v = (x, y) => vals[perm[(perm[x & 255] + y) & 511] & 255];
    const sm = (t) => t * t * (3 - 2 * t);
    const noise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      const u = sm(xf), w = sm(yf);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    };
    const fbm = (x, y, oct = 4) => {
      let s = 0, amp = 1, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) { s += noise(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; }
      return s / norm;
    };
    return { noise, fbm };
  };

  // Binärer Min-Heap für A*
  U.Heap = class {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    clear() { this.k.length = 0; this.v.length = 0; }
    push(key, val) {
      const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
      k[i] = key; v[i] = val;
    }
    pop() {
      const k = this.k, v = this.v; const top = v[0]; const lk = k.pop(), lv = v.pop();
      const n = k.length;
      if (n > 0) {
        let i = 0;
        while (true) {
          let l = 2 * i + 1, r = l + 1, m = i, mk = lk;
          if (l < n && k[l] < mk) { m = l; mk = k[l]; }
          if (r < n && k[r] < mk) { m = r; mk = k[r]; }
          if (m === i) break;
          k[i] = k[m]; v[i] = v[m]; i = m;
        }
        k[i] = lk; v[i] = lv;
      }
      return top;
    }
  };

  U.hexToRgb = (hex) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  U.rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => U.clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
  U.shade = (hex, amt) => { const [r, g, b] = U.hexToRgb(hex); if (amt >= 0) return U.rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt); return U.rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt)); };
  U.rgba = (hex, a) => { const [r, g, b] = U.hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  U.mix = (h1, h2, t) => { const a = U.hexToRgb(h1), b = U.hexToRgb(h2); return U.rgbToHex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)); };

  U.store = {
    get(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignorieren */ } },
  };

  RTS.util = U;
})();
