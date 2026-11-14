'use strict';
// Lädt die Spiellogik ohne Browser (für Tests und Balancing-Analysen).
const fs = require('fs'), vm = require('vm'), path = require('path');
const FILES = ['util', 'data', 'map', 'path', 'entities', 'game', 'ai', 'save', 'campaign', 'campaign2'];

exports.load = function () {
  const errors = [];
  const con = { log: console.log, warn: (...a) => { errors.push(a.join(' ')); console.warn(...a); }, error: (...a) => { errors.push(a.map(x => (x && x.stack) || x).join(' ')); console.error(...a); } };
  const store = {};
  const ctx = {
    console: con, Math, JSON, Date,
    setTimeout: (f) => { try { f(); } catch (e) { con.error(e); } }, clearTimeout: () => {},
    performance: { now: () => Date.now() },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of FILES) {
    const p = path.join(__dirname, '..', 'js', f + '.js');
    if (!fs.existsSync(p)) continue;
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f + '.js' });
  }
  ctx.RTS.testErrors = errors;
  return ctx.RTS;
};

// Standard-Gefecht (KI gegen KI)
exports.skirmish = function (RTS, opts = {}) {
  const md = RTS.MAPS[opts.map || 0];
  const facs = opts.factions || ['allianz', 'schatten', 'vael', 'allianz'];
  const cols = ['#3b82f6', '#ef4444', '#a855f7', '#22c55e'];
  const players = facs.map((f, i) => ({ name: f + i, faction: f, color: cols[i], ai: (opts.levels && opts.levels[i]) || opts.level || 'hard', start: i, team: i + 1 }));
  const cfg = Object.assign({ map: Object.assign({}, md, { seed: md.seed || opts.seed || 5 }), numStarts: 4, superweapons: true, players, neutrals: true, crates: true }, opts.cfg || {});
  const g = new RTS.Game(cfg); g.init();
  return g;
};
exports.run = function (g, minutes, onTick) {
  let over = null; g.on('gameOver', (r) => { over = r; });
  const n = Math.round(minutes * 60 * 30);
  for (let i = 1; i <= n && !over; i++) { g.update(1 / 30); if (onTick) onTick(i); }
  return over;
};
