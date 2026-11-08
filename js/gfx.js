'use strict';
// ===== Grafik-Grundbausteine: Sprite-Cache, Materialien, Formen, Effekt-Sprites =====
(function () {
  const U = RTS.util;
  const G = {};
  const cache = new Map();
  G.cache = cache;

  G.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  // Sprite in hoher Auflösung zeichnen und zwischenspeichern. fn zeichnet um den Mittelpunkt (0,0).
  G.sprite = function (key, w, h, fn, scale = 3) {
    let s = cache.get(key);
    if (s) return s;
    const cv = G.canvas(w * scale, h * scale);
    const ctx = cv.getContext('2d');
    ctx.scale(scale, scale); ctx.translate(w / 2, h / 2);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    fn(ctx);
    s = { cv, w, h, scale };
    cache.set(key, s);
    return s;
  };
  // Weicher Schlagschatten aus der Silhouette eines Sprites
  G.shadow = function (key, spr, blur = 2.5, alpha = 0.55) {
    const k = 'sh|' + key;
    let s = cache.get(k);
    if (s) return s;
    const pad = blur * 3, sc = spr.scale;
    const cv = G.canvas((spr.w + pad * 2) * sc, (spr.h + pad * 2) * sc);
    const ctx = cv.getContext('2d');
    try { ctx.filter = `blur(${blur * sc}px)`; } catch (e) { /* ohne Unschärfe */ }
    ctx.drawImage(spr.cv, pad * sc, pad * sc);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fillRect(0, 0, cv.width, cv.height);
    s = { cv, w: spr.w + pad * 2, h: spr.h + pad * 2, scale: sc };
    cache.set(k, s);
    return s;
  };
  G.blit = function (ctx, s, x, y, ang, alpha, sc) {
    sc = sc || 1;
    if (!ang && (alpha == null || alpha === 1)) { ctx.drawImage(s.cv, x - s.w / 2 * sc, y - s.h / 2 * sc, s.w * sc, s.h * sc); return; }
    ctx.save(); ctx.translate(x, y); if (ang) ctx.rotate(ang);
    if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.drawImage(s.cv, -s.w / 2 * sc, -s.h / 2 * sc, s.w * sc, s.h * sc);
    ctx.restore();
  };

  // ---------- Rauschen & Materialien ----------
  G.noise = function (size, freq, seed, oct = 4) {
    const key = 'nz|' + size + '|' + freq + '|' + seed + '|' + oct;
    let c = cache.get(key); if (c) return c;
    const nz = U.makeNoise(seed);
    const cv = G.canvas(size, size), ctx = cv.getContext('2d'), img = ctx.createImageData(size, size);
    // kachelbar durch Periodizität im Rauschraum (4D-Trick vereinfacht: Mischung)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const f = (xx, yy) => nz.fbm(xx * freq / size, yy * freq / size, oct);
      const a = f(x, y), b = f(x - size, y), cc = f(x, y - size), d = f(x - size, y - size);
      const val = U.lerp(U.lerp(a, b, u), U.lerp(cc, d, u), v);
      const n = Math.round(U.clamp((val - 0.5) * 2.2 + 0.5, 0, 1) * 255);
      const o = (y * size + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = n; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    cache.set(key, cv);
    return cv;
  };
  // Materialmuster (kachelbar) in Grundfarbe
  G.material = function (ctx, kind, base) {
    const key = 'mat|' + kind + '|' + base;
    let pat = cache.get(key);
    if (pat) return pat;
    const S = 96, cv = G.canvas(S, S), c = cv.getContext('2d');
    c.fillStyle = base; c.fillRect(0, 0, S, S);
    const rng = U.RNG(kind.length * 977 + base.length);
    if (kind === 'metal') {
      c.globalAlpha = 0.18; c.drawImage(G.noise(96, 6, 11, 3), 0, 0); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.35; c.drawImage(G.noise(96, 24, 12, 2), 0, 0);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.12; c.strokeStyle = '#fff'; c.lineWidth = 0.6;
      for (let i = 0; i < 14; i++) { const x = rng.range(0, S), y = rng.range(0, S), l = rng.range(3, 14), a = rng.range(-0.3, 0.3); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    } else if (kind === 'concrete') {
      c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.5; c.drawImage(G.noise(96, 10, 21, 4), 0, 0);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.25; c.fillStyle = '#000';
      for (let i = 0; i < 60; i++) c.fillRect(rng.range(0, S), rng.range(0, S), 0.8, 0.8);
      c.globalAlpha = 0.15; c.strokeStyle = '#000'; c.lineWidth = 0.7; c.strokeRect(0.5, 0.5, 47, 47); c.strokeRect(48.5, 48.5, 47, 47); c.strokeRect(48.5, 0.5, 47, 47); c.strokeRect(0.5, 48.5, 47, 47);
    } else if (kind === 'chitin') {
      c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.6; c.drawImage(G.noise(96, 5, 31, 4), 0, 0);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.25; c.strokeStyle = '#000'; c.lineWidth = 0.8;
      for (let i = 0; i < 9; i++) { c.beginPath(); const x = rng.range(0, S), y = rng.range(0, S); c.arc(x, y, rng.range(6, 16), rng.range(0, 6), rng.range(0, 6) + 2); c.stroke(); }
    } else if (kind === 'dark') {
      c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.4; c.drawImage(G.noise(96, 16, 41, 3), 0, 0);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.08; c.fillStyle = '#fff';
      for (let y = 0; y < S; y += 3) c.fillRect(0, y, S, 1);
    }
    pat = ctx.createPattern(cv, 'repeat');
    cache.set(key, pat);
    return pat;
  };

  // ---------- Formen ----------
  G.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  G.poly = function (ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
  // Panzerplatte: Grundfläche mit Material, Verlauf, Kantenlicht und Umriss
  G.plate = function (ctx, path, color, opt = {}) {
    ctx.save();
    path(); ctx.fillStyle = color; ctx.fill();
    if (opt.mat) { ctx.save(); path(); ctx.clip(); ctx.globalAlpha = opt.matAlpha || 1; ctx.fillStyle = G.material(ctx, opt.mat, color); ctx.fill(); ctx.restore(); }
    // Wölbung: Mitte hell, Ränder dunkel (drehungsunabhängig)
    if (opt.r) {
      path(); ctx.save(); ctx.clip();
      const g = ctx.createRadialGradient(opt.cx || 0, opt.cy || 0, 0, opt.cx || 0, opt.cy || 0, opt.r);
      g.addColorStop(0, 'rgba(255,255,255,' + (opt.hi != null ? opt.hi : 0.18) + ')'); g.addColorStop(0.65, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (opt.lo != null ? opt.lo : 0.35) + ')');
      ctx.fillStyle = g; ctx.fill(); ctx.restore();
    }
    // Innenkante hell
    if (opt.bevel !== false) { path(); ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = opt.bw || 1.2; ctx.stroke(); ctx.restore(); }
    path(); ctx.strokeStyle = opt.edge || 'rgba(0,0,0,0.75)'; ctx.lineWidth = opt.ew || 0.7; ctx.stroke();
    ctx.restore();
  };
  // Rohr/Lauf entlang +x
  G.barrel = function (ctx, x0, x1, y, r, color) {
    const g = ctx.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, U.shade(color, -0.4)); g.addColorStop(0.35, U.shade(color, 0.45)); g.addColorStop(0.6, color); g.addColorStop(1, U.shade(color, -0.6));
    ctx.fillStyle = g; ctx.fillRect(x0, y - r, x1 - x0, r * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.5; ctx.strokeRect(x0, y - r, x1 - x0, r * 2);
  };
  G.dome = function (ctx, x, y, r, color, ry) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - (ry || r) * 0.4, r * 0.05, x, y, r * 1.05);
    g.addColorStop(0, U.shade(color, 0.6)); g.addColorStop(0.35, U.shade(color, 0.15)); g.addColorStop(0.8, color); g.addColorStop(1, U.shade(color, -0.55));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, ry || r, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
  };
  G.rivets = function (ctx, pts, r = 0.45) {
    for (const [x, y] of pts) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x + 0.2, y + 0.2, r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x - 0.1, y - 0.1, r * 0.7, 0, 7); ctx.fill(); }
  };
  G.lines = function (ctx, segs, color = 'rgba(0,0,0,0.45)', w = 0.45) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
    for (const s of segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
    ctx.stroke();
  };
  G.grille = function (ctx, x, y, w, h, n, vertical) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < n; i++) { if (vertical) ctx.fillRect(x + (i + 0.3) * w / n, y + 0.3, w / n * 0.35, h - 0.6); else ctx.fillRect(x + 0.3, y + (i + 0.3) * h / n, w - 0.6, h / n * 0.35); }
  };
  G.glow = function (ctx, x, y, r, color, a = 1) {
    const [cr, cg, cb] = U.hexToRgb(color);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); g.addColorStop(0.4, `rgba(${cr},${cg},${cb},${a * 0.45})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  };
  G.light = function (ctx, x, y, r, color) { G.glow(ctx, x, y, r * 3, color, 0.5); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.fill(); ctx.fillStyle = color; ctx.globalAlpha *= 0.7; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalAlpha /= 0.7; };
  G.hazard = function (ctx, x, y, w, h, s = 3) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#facc15'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#1c1917';
    for (let i = -h; i < w + h; i += s * 2) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + s, y + h); ctx.lineTo(x + i + s + h, y); ctx.lineTo(x + i + h, y); ctx.fill(); }
    ctx.restore();
  };

  // ---------- Effekt-Sprites ----------
  // Explosionsbilder (Feuerball mit Turbulenz), prozedural erzeugt
  G.explosionFrames = function () {
    if (cache.has('explo')) return cache.get('explo');
    const N = 14, S = 96, frames = [];
    const nz = U.makeNoise(99);
    for (let f = 0; f < N; f++) {
      const t = f / (N - 1);
      const cv = G.canvas(S, S), c = cv.getContext('2d'), img = c.createImageData(S, S);
      const rad = 0.35 + t * 0.6;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), d = Math.hypot(dx, dy);
        const n = nz.fbm(x / 9 + t * 3, y / 9 - t * 2, 4);
        const edge = rad * (0.75 + n * 0.5);
        if (d > edge) continue;
        const k = d / edge; // 0 Mitte, 1 Rand
        const heat = U.clamp((1 - t * 1.25) * (1.15 - k * 0.7) + (n - 0.5) * 0.5, 0, 1);
        let r, g, b, a;
        if (heat > 0.75) { r = 255; g = 245; b = 200; }
        else if (heat > 0.5) { r = 255; g = 190 + (heat - 0.5) * 200; b = 60; }
        else if (heat > 0.25) { r = 230; g = 90 + (heat - 0.25) * 400; b = 20; }
        else { const s = 40 + n * 50; r = s + heat * 300; g = s * 0.9 + heat * 100; b = s * 0.85; }
        a = U.clamp((1 - Math.pow(k, 3)) * (heat > 0.25 ? 1 : 0.85 - t * 0.6), 0, 1);
        const o = (y * S + x) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = a * 255;
      }
      c.putImageData(img, 0, 0);
      frames.push(cv);
    }
    cache.set('explo', frames);
    return frames;
  };
  G.smokePuffs = function () {
    if (cache.has('smoke')) return cache.get('smoke');
    const out = [];
    for (let v = 0; v < 8; v++) {
      const dark = v >= 4;
      const S = 64, cv = G.canvas(S, S), c = cv.getContext('2d'), img = c.createImageData(S, S), nz = U.makeNoise(200 + v);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), d = Math.hypot(dx, dy);
        const n = nz.fbm(x / 8, y / 8, 4);
        const a = U.clamp((1 - d) * 1.6 * (0.4 + n), 0, 1);
        const l = dark ? 35 + n * 55 - dy * 15 : 150 + n * 100 - dy * 30;
        const o = (y * S + x) * 4; img.data[o] = l; img.data[o + 1] = l; img.data[o + 2] = l; img.data[o + 3] = a * 255;
      }
      c.putImageData(img, 0, 0); out.push(cv);
    }
    cache.set('smoke', out);
    return out;
  };
  G.flare = function (color) {
    const key = 'flare|' + color; if (cache.has(key)) return cache.get(key);
    const S = 64, cv = G.canvas(S, S), c = cv.getContext('2d');
    G.glow(c, S / 2, S / 2, S / 2, color, 0.9);
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(S / 2 - Math.cos(a) * S * 0.45, S / 2 - Math.sin(a) * S * 0.45); c.lineTo(S / 2 + Math.cos(a) * S * 0.45, S / 2 + Math.sin(a) * S * 0.45); c.stroke(); }
    G.glow(c, S / 2, S / 2, S * 0.18, '#ffffff', 1);
    cache.set(key, cv);
    return cv;
  };

  RTS.gfx = G;
})();
