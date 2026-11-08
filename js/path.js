'use strict';
// ===== A*-Wegfindung auf dem Kachelraster =====
(function () {
  const U = RTS.util, T = U.TILE;
  const SQ2 = Math.SQRT2;
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];

  class Pathfinder {
    constructor(map) {
      this.map = map; const n = map.w * map.h;
      this.g = new Float32Array(n); this.from = new Int32Array(n);
      this.open = new Uint32Array(n); this.closed = new Uint32Array(n); this.gen = 1;
      this.heap = new U.Heap();
    }
    // Sichtlinie auf Kachelbasis (für Wegglättung)
    lineClear(x0, y0, x1, y1, mode) {
      const m = this.map; const d = Math.hypot(x1 - x0, y1 - y0); if (d < 1) return true; const steps = Math.ceil(d / (T * 0.25));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        if (!m.passable(Math.floor(x / T), Math.floor(y / T), mode)) return false;
        // Breite berücksichtigen
        const ox = (y1 - y0) / d * 7, oy = -(x1 - x0) / d * 7;
        if (!m.passable(Math.floor((x + ox) / T), Math.floor((y + oy) / T), mode)) return false;
        if (!m.passable(Math.floor((x - ox) / T), Math.floor((y - oy) / T), mode)) return false;
      }
      return true;
    }
    find(sx, sy, gx, gy, mode, maxNodes = 14000) {
      const m = this.map, w = m.w;
      let st = m.nearestPassable(Math.floor(sx / T), Math.floor(sy / T), mode, 4);
      let gt = m.nearestPassable(Math.floor(gx / T), Math.floor(gy / T), mode, 14);
      if (!st || !gt) return null;
      const exactGoal = (gt.tx === Math.floor(gx / T) && gt.ty === Math.floor(gy / T));
      const start = st.ty * w + st.tx, goal = gt.ty * w + gt.tx;
      if (start === goal) return [{ x: exactGoal ? gx : (gt.tx + 0.5) * T, y: exactGoal ? gy : (gt.ty + 0.5) * T }];
      this.gen++; if (this.gen > 4e9) { this.gen = 1; this.open.fill(0); this.closed.fill(0); }
      const gen = this.gen, g = this.g, from = this.from, open = this.open, closed = this.closed, heap = this.heap;
      heap.clear();
      const gxT = gt.tx, gyT = gt.ty;
      const hfn = (x, y) => { const dx = Math.abs(x - gxT), dy = Math.abs(y - gyT); return dx + dy + (SQ2 - 2) * Math.min(dx, dy); };
      g[start] = 0; from[start] = -1; open[start] = gen; heap.push(hfn(st.tx, st.ty), start);
      let best = start, bestH = hfn(st.tx, st.ty), expanded = 0, found = false;
      while (heap.size) {
        const cur = heap.pop();
        if (closed[cur] === gen) continue;
        closed[cur] = gen;
        if (cur === goal) { found = true; break; }
        if (++expanded > maxNodes) break;
        const cx = cur % w, cy = (cur / w) | 0;
        const hc = hfn(cx, cy); if (hc < bestH) { bestH = hc; best = cur; }
        for (let k = 0; k < 8; k++) {
          const d = DIRS[k]; const nx = cx + d[0], ny = cy + d[1];
          if (!m.passable(nx, ny, mode)) continue;
          if (k >= 4 && (!m.passable(cx + d[0], cy, mode) || !m.passable(cx, cy + d[1], mode))) continue;
          const ni = ny * w + nx; if (closed[ni] === gen) continue;
          const ng = g[cur] + d[2];
          if (open[ni] !== gen || ng < g[ni]) { open[ni] = gen; g[ni] = ng; from[ni] = cur; heap.push(ng + hfn(nx, ny) * 1.001, ni); }
        }
      }
      const end = found ? goal : best;
      const tiles = [];
      for (let c = end; c !== -1; c = from[c]) tiles.push(c);
      tiles.reverse();
      const pts = tiles.map(i => ({ x: (i % w + 0.5) * T, y: (((i / w) | 0) + 0.5) * T }));
      if (found && exactGoal) pts[pts.length - 1] = { x: gx, y: gy };
      // Glätten
      const out = []; let ax = sx, ay = sy, i = 0;
      while (i < pts.length) {
        let j = pts.length - 1;
        while (j > i && !this.lineClear(ax, ay, pts[j].x, pts[j].y, mode)) j--;
        out.push(pts[j]); ax = pts[j].x; ay = pts[j].y; i = j + 1;
      }
      return out;
    }
  }
  RTS.Pathfinder = Pathfinder;
})();
