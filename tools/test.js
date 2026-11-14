'use strict';
// Rauchtests: node tools/test.js [schnell]
// Prüft, dass Gefechte und alle Kampagnenmissionen ohne Fehler laufen, keine Einheiten festhängen
// und Speichern/Laden funktioniert.
const H = require('./headless');
const quick = process.argv[2] === 'schnell';
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) failed++; };

function stuckCheck(g) {
  // zählt Bodeneinheiten, die trotz Pfad lange nicht vorankommen
  for (const u of g.units) { if (u.dead || u.isAir) continue; if (u.path && u._lx !== undefined && Math.hypot(u.x - u._lx, u.y - u._ly) < 3) u._st = (u._st || 0) + 1; else u._st = 0; u._lx = u.x; u._ly = u.y; }
  return g.units.filter(u => !u.dead && u._st >= 5).length;
}

console.log('Gefechte (4 KI-Spieler)');
for (const map of quick ? [0] : [0, 2, 4, 6]) {
  const RTS = H.load();
  if (!RTS.MAPS[map]) continue;
  const g = H.skirmish(RTS, { map });
  let maxStuck = 0;
  const over = H.run(g, quick ? 6 : 12, (i) => { if (i % 150 === 0) maxStuck = Math.max(maxStuck, stuckCheck(g)); });
  const harv = g.players.map(p => Math.round(p.stats.harvested));
  ok(RTS.testErrors.length === 0, `${RTS.MAPS[map].name}: keine Fehler (${RTS.testErrors.length})`);
  ok(maxStuck <= 2, `${RTS.MAPS[map].name}: keine festhängenden Einheiten (max ${maxStuck})`);
  ok(harv.every(v => v > 3000), `${RTS.MAPS[map].name}: alle ernten (${harv.join('/')})`);
  ok(g.players.every(p => p.stats.unitsBuilt > 5), `${RTS.MAPS[map].name}: alle produzieren`);
  void over;
}

console.log('Kampagnen');
{
  const RTS = H.load();
  for (const c of RTS.campaign.CAMPAIGNS) for (const m of c.missions) {
    const before = RTS.testErrors.length;
    const cfg = RTS.campaign.buildConfig(m, 'normal'); cfg.players[0].ai = 'normal';
    const g = new RTS.Game(cfg); g.init();
    H.run(g, quick ? 2 : 6);
    const objs = m.objectives(g);
    ok(RTS.testErrors.length === before && objs.length > 0, `${c.id}/${m.id} ${m.title}`);
  }
}

console.log('Speichern/Laden');
{
  const RTS = H.load();
  if (RTS.save) {
    const g = H.skirmish(RTS, { map: 0 });
    H.run(g, 5);
    const data = JSON.parse(JSON.stringify(RTS.save.serialize(g, { mode: 'skirmish' })));
    const g2 = RTS.save.restore(data);
    const sum = (x) => [x.units.filter(u => !u.dead).length, x.buildings.filter(b => !b.dead).length, Math.round(x.players.reduce((s, p) => s + p.credits, 0))].join('/');
    ok(sum(g) === sum(g2), `Zustand identisch nach Laden (${sum(g)} = ${sum(g2)})`);
    H.run(g2, 3);
    ok(RTS.testErrors.length === 0, 'geladenes Spiel läuft fehlerfrei weiter');
    ok(g2.players.some(p => p.stats.unitsBuilt > g.players[g2.players.indexOf(p)].stats.unitsBuilt), 'KI produziert nach dem Laden weiter');
    // Kampagne mit Skriptzustand
    const m = RTS.campaign.CAMPAIGNS[1].missions[2];
    const cfg = RTS.campaign.buildConfig(m, 'normal'); cfg.players[0].ai = 'normal';
    const g3 = new RTS.Game(cfg); g3.init(); H.run(g3, 4);
    const d3 = JSON.parse(JSON.stringify(RTS.save.serialize(g3, { mode: 'campaign', camp: 1, mission: 2 })));
    const g4 = RTS.save.restore(d3); H.run(g4, 2);
    ok(RTS.testErrors.length === 0 && g4.mission.objectives(g4).length > 0, 'Kampagnenmission mit Skriptzustand geladen');
  } else ok(false, 'Speichermodul fehlt');
}

console.log(failed ? `\n${failed} Test(s) fehlgeschlagen` : '\nAlle Tests bestanden');
process.exit(failed ? 1 : 0);
