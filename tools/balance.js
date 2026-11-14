'use strict';
// Balancing-Analyse.
//   node tools/balance.js duell [einheit]   – kostengleiche Duelle aller Bodeneinheiten
//   node tools/balance.js armee             – typische gemischte Armeen im offenen Feld
//   node tools/balance.js partien [stufe] [läufe] – komplette Partien KI gegen KI (parallel)
const H = require('./headless');
const { fork } = require('child_process');
const mode = process.argv[2] || 'duell';
const T = 32;

function arena(RTS) {
  const cfg = { map: { size: 48, biome: 'temperate', seed: 7, water: -1, rock: 2, forest: 2 }, mapOpts: { starts: [[8, 24], [40, 24]] }, numStarts: 2, players: [
    { name: 'A', faction: 'allianz', color: '#00f', team: 1, start: 0, credits: 0 }, { name: 'B', faction: 'schatten', color: '#f00', team: 2, start: 1, credits: 0 }],
    mission: { setup() {}, check() { return null; } } };
  const g = new RTS.Game(cfg); g.init();
  g.map.ore.fill(0); g.map.blossoms.length = 0;
  return g;
}
function setFaction(RTS, p, f) {
  p.faction = f; p.fdef = RTS.data.FACTIONS[f]; const tr = p.fdef.trait;
  p.mods.hp.light = p.mods.hp.heavy = tr.vehHp || 1; p.mods.bldHp = tr.bldHp || 1; p.mods.speed.all = tr.speed || 1; p.mods.regen = tr.regen || 0;
}
function fightUnits(RTS, idA, idB, budget) {
  const D = RTS.data, g = arena(RTS), [pa, pb] = g.players;
  setFaction(RTS, pa, D.UNITS[idA].faction); setFaction(RTS, pb, D.UNITS[idB].faction);
  const spawn = (id, p, x) => { const n = Math.max(1, Math.round(budget / D.UNITS[id].cost)); const out = []; for (let i = 0; i < n; i++) out.push(g.spawnUnit(id, p, (x + (i % 4) * 1.2) * T, (18 + Math.floor(i / 4) * 1.2) * T)); return out; };
  const A = spawn(idA, pa, 10), B = spawn(idB, pb, 34);
  const va = A.length * D.UNITS[idA].cost, vb = B.length * D.UNITS[idB].cost;
  g.cmdMove(A, 36 * T, 20 * T, true); g.cmdMove(B, 8 * T, 20 * T, true);
  for (let i = 0; i < 30 * 120; i++) { g.update(1 / 30); if (A.every(u => u.dead) || B.every(u => u.dead)) break; }
  const rest = (U, id) => U.filter(u => !u.dead).reduce((s, u) => s + u.hp / u.maxHp, 0) * D.UNITS[id].cost;
  return rest(A, idA) / va - rest(B, idB) / vb;
}

if (mode === 'duell') {
  const RTS = H.load(), D = RTS.data, only = process.argv[3];
  const ids = Object.keys(D.UNITS).filter(id => { const u = D.UNITS[id]; return u.weapons.length && u.cat !== 'air' && !/arty|spore|flak/.test(id) && u.weapons.some(w => w.targets !== 'air'); });
  const score = {}; ids.forEach(a => { score[a] = 0; });
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    if (D.UNITS[ids[i]].faction === D.UNITS[ids[j]].faction) continue;
    const r = (fightUnits(RTS, ids[i], ids[j], 3000) - fightUnits(RTS, ids[j], ids[i], 3000)) / 2;
    score[ids[i]] += r; score[ids[j]] -= r;
    if (only && (ids[i] === only || ids[j] === only)) console.log(ids[i], ids[j], r.toFixed(2));
  }
  const byFac = {}; for (const id of ids) { const f = D.UNITS[id].faction; byFac[f] = +((byFac[f] || 0) + score[id]).toFixed(2); }
  console.log('Einheiten-Wertung (Summe kostengleicher Duelle, >0 = stärker):');
  Object.entries(score).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k.padEnd(11) + v.toFixed(2)));
  console.log('Fraktionen:', JSON.stringify(byFac));
}

if (mode === 'armee') {
  const RTS = H.load(), D = RTS.data, facs = D.FACTION_ORDER;
  const W = RTS.AI.UNIT_WEIGHTS;
  const rng = RTS.util.RNG(42);
  const comp = (f, budget) => { const out = [];
    for (const cat of ['inf', 'veh']) { let b = budget / 2; const pool = Object.keys(W).filter(id => D.UNITS[id] && D.UNITS[id].faction === f && D.UNITS[id].cat === cat && W[id] > 0); const tot = pool.reduce((s, i) => s + W[i], 0);
      while (b > 0) { let r = rng.next() * tot, pick = pool[0]; for (const id of pool) { r -= W[id]; if (r <= 0) { pick = id; break; } } out.push(pick); b -= D.UNITS[pick].cost; } }
    return out; };
  const res = {}; facs.forEach(f => { res[f] = 0; });
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) { let sc = 0;
    for (let k = 0; k < 6; k++) {
      const g = arena(RTS), [pa, pb] = g.players, fa = facs[k % 2 ? a : b], fb = facs[k % 2 ? b : a];
      setFaction(RTS, pa, fa); setFaction(RTS, pb, fb);
      const mk = (p, f, x) => comp(f, 10000).map((id, i) => g.spawnUnit(id, p, (x + (i % 5) * 1.2) * T, (16 + Math.floor(i / 5) * 1.2) * T));
      const A = mk(pa, fa, 6), B = mk(pb, fb, 36);
      g.cmdMove(A, 38 * T, 20 * T, true); g.cmdMove(B, 6 * T, 20 * T, true);
      for (let i = 0; i < 30 * 150; i++) { g.update(1 / 30); if (A.every(u => u.dead) || B.every(u => u.dead)) break; }
      const val = (U) => U.filter(u => !u.dead).reduce((s, u) => s + u.def.cost * u.hp / u.maxHp, 0) / 10000;
      const r = val(A) - val(B); sc += fa === facs[a] ? r : -r;
    }
    res[facs[a]] += sc / 6; res[facs[b]] -= sc / 6;
    console.log(`${facs[a]} gegen ${facs[b]}: ${(sc / 6).toFixed(2)}`);
  }
  console.log('Summe:', JSON.stringify(res, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
}

if (mode === 'partien-kind') {
  const RTS = H.load(), facs = RTS.data.FACTION_ORDER, lvl = process.argv[3] || 'hard', out = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { if (a === b) continue; for (const mi of [0, 1, 3]) {
    const md = RTS.MAPS[mi];
    const g = new RTS.Game({ map: Object.assign({}, md, { seed: md.seed || 5 }), numStarts: 4, superweapons: true, neutrals: true, crates: true, players: [
      { name: facs[a], faction: facs[a], color: '#00f', ai: lvl, start: 0, team: 1 }, { name: facs[b], faction: facs[b], color: '#f00', ai: lvl, start: 1, team: 2 }] });
    g.init();
    const over = H.run(g, 22);
    let w;
    if (over) w = g.players.find(p => !p.defeated);
    else { const val = (p) => g.buildings.filter(x => !x.dead && x.owner === p).reduce((s, x) => s + x.def.cost, 0) + g.units.filter(x => !x.dead && x.owner === p).reduce((s, x) => s + x.def.cost, 0); w = val(g.players[0]) > val(g.players[1]) ? g.players[0] : g.players[1]; }
    out.push({ a: facs[a], b: facs[b], w: w.faction, min: Math.round(g.time / 60), errors: RTS.testErrors.length });
  } }
  process.send(out);
}

if (mode === 'partien') {
  const lvl = process.argv[3] || 'hard', runs = +(process.argv[4] || 4);
  const all = []; let done = 0;
  for (let i = 0; i < runs; i++) {
    const c = fork(__filename, ['partien-kind', lvl]);
    c.on('message', (m) => { all.push(...m); });
    c.on('exit', () => {
      if (++done < runs) return;
      const W = {}, P = {}; let err = 0; const dur = [];
      for (const r of all) { W[r.w] = (W[r.w] || 0) + 1; const k = [r.a, r.b].sort().join('-'); P[k] = P[k] || {}; P[k][r.w] = (P[k][r.w] || 0) + 1; err += r.errors; dur.push(r.min); }
      const per = all.length * 2 / 3;
      console.log(`Partien: ${all.length} (Stufe ${lvl}), Fehler: ${err}, mittlere Dauer: ${(dur.reduce((a, b) => a + b, 0) / dur.length).toFixed(1)} min`);
      console.log('Siegquote:', Object.entries(W).map(([f, n]) => `${f} ${Math.round(n / per * 100)} %`).join(', '));
      console.log('Paarungen:', JSON.stringify(P));
    });
  }
}
