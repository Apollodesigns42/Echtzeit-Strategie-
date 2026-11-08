'use strict';
// ===== Kampagne: Operation Morgenröte =====
(function () {
  const U = RTS.util, D = RTS.data, T = U.TILE;
  const LEVELS = ['easy', 'normal', 'hard', 'brutal'];
  const shiftLv = (lv, d) => LEVELS[U.clamp(LEVELS.indexOf(lv) + d, 0, LEVELS.length - 1)];

  // Gebäude automatisch nahe (cx,cy) platzieren
  function autoPlace(g, p, role, cx, cy, opts = {}) {
    const def = D.BUILDINGS[p.faction + '_' + role]; const m = g.map;
    for (let r = 0; r < 18; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx - Math.floor(def.w / 2), ty = cy + dy - Math.floor(def.h / 2);
        let ok = true;
        for (let y = ty - 1; y <= ty + def.h && ok; y++) for (let x = tx - 1; x <= tx + def.w; x++) {
          const inner = x >= tx && x < tx + def.w && y >= ty && y < ty + def.h;
          if (!m.inBounds(x, y)) { ok = false; break; }
          if (inner && !m.buildable(x, y)) { ok = false; break; }
          if (!inner && m.bld[m.idx(x, y)]) { ok = false; break; }
        }
        if (ok) return g.placeBuilding(def.id, p, tx, ty, Object.assign({ instant: true }, opts));
      }
    }
    return null;
  }
  function base(g, p, roles, cx, cy) { const out = {}; for (const r of roles) { const b = autoPlace(g, p, r, cx, cy); if (b) out[r] = b; } return out; }
  function squad(g, p, list, x, y) {
    const out = [];
    list.forEach(([id, n]) => { for (let i = 0; i < n; i++) { const u = g.spawnUnitNear(id, p, (x + U.clamp(i - n / 2, -3, 3) * 1.2) * T, (y + (out.length % 3)) * T); if (u) out.push(u); } });
    return out;
  }
  const hasBuildings = (g, p) => g.buildings.some(b => !b.dead && b.owner === p);
  const hasUnits = (g, p) => g.units.some(u => !u.dead && u.owner === p && u.def.weapons.length);
  const say = (g, txt) => g.message(txt, 'mission');

  const MISSIONS = [
    {
      id: 'm1', title: 'Erstkontakt', sub: 'Zerstöre den feindlichen Außenposten',
      briefing: 'Jahr 2071. Seit dem Einschlag des Meteoriten "Kalyx" breitet sich das Kristallit über die Kontinente aus – eine Energiequelle von unermesslichem Wert.\n\nDas Schattenkollektiv, eine fanatische Untergrundbewegung, hat nahe der Grenze einen Außenposten errichtet und überfällt unsere Konvois.\n\nCommander, führen Sie Ihren Kampfverband nach Nordosten und vernichten Sie den Außenposten. Verstärkung ist unterwegs.\n\nTipp: Linksklick wählt aus, Rechtsklick bewegt bzw. greift an. Mit gedrückter linker Maustaste ziehen Sie einen Auswahlrahmen.',
      map: { size: 64, biome: 'temperate', seed: 1101, water: 0.26, rock: 0.72, forest: 0.62 },
      mapOpts: { starts: [[9, 54], [52, 11]] },
      players: [{ faction: 'allianz', human: true, color: '#3b82f6', credits: 0, name: 'Allianz' }, { faction: 'schatten', ai: 'D', color: '#ef4444', aiOpts: { noBuild: true, noProduce: true, noAttack: true }, credits: 0, name: 'Schattenkollektiv' }],
      radar: true,
      setup(g) {
        const [h, e] = g.players;
        squad(g, h, [['a_rifle', 4], ['a_rocket', 2], ['a_tank', 2], ['a_jeep', 1]], 10, 51);
        base(g, e, ['power', 'barracks', 'refinery', 'power'], 52, 11);
        autoPlace(g, e, 'tower_mg', 46, 16); autoPlace(g, e, 'tower_mg', 50, 19);
        squad(g, e, [['s_militia', 5], ['s_flamer', 2], ['s_buggy', 2]], 47, 15);
        squad(g, e, [['s_militia', 3], ['s_rocket', 1]], 31, 32);
        g.missionState.t = 0;
        setTimeout(() => say(g, 'Ziel: Zerstören Sie alle Gebäude des Außenpostens im Nordosten.'), 800);
      },
      update(g, dt) {
        const s = g.missionState, h = g.players[0];
        if (!s.reinf && (g.time > 100 || g.units.some(u => !u.dead && u.owner === h && U.dist(u.x, u.y, 52 * T, 11 * T) < 22 * T))) {
          s.reinf = true; squad(g, h, [['a_tank', 2], ['a_rocket', 2]], 6, 58); say(g, 'Verstärkung im Südwesten eingetroffen.');
        }
      },
      objectives(g) { return [{ text: 'Zerstöre alle Gebäude des Außenpostens', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) { if (!hasBuildings(g, g.players[1])) return 'win'; if (!hasUnits(g, g.players[0])) return 'lose'; return null; },
    },
    {
      id: 'm2', title: 'Brückenkopf', sub: 'Errichte eine Basis und vernichte den Feind',
      briefing: 'Der Außenposten ist gefallen, doch das Schattenkollektiv hat in der Region eine Basis aufgebaut.\n\nSie erhalten ein Bau-Fahrzeug. Bauen Sie es auf (Taste D), errichten Sie eine Basis und sichern Sie die Kristallitfelder.\n\nBauen Sie Kraftwerke für Energie, eine Raffinerie für Einnahmen, und anschließend Kaserne und Waffenfabrik.\n\nVernichten Sie danach die feindliche Basis im Nordosten.',
      map: { size: 80, biome: 'temperate', seed: 2202, water: 0.28, rock: 0.70, forest: 0.64 },
      mapOpts: { starts: [[12, 67], [67, 12]] },
      players: [{ faction: 'allianz', human: true, color: '#3b82f6', credits: 7000, name: 'Allianz' }, { faction: 'schatten', ai: 'D-1', color: '#ef4444', aiOpts: { armyCap: 14 }, credits: 4000, name: 'Schattenkollektiv' }],
      techLimit: { allianz_tech: false, allianz_airfield: false, allianz_sw: false },
      setup(g) {
        const [h, e] = g.players;
        squad(g, h, [['a_mcv', 1]], 12, 67); squad(g, h, [['a_rifle', 3], ['a_jeep', 1], ['a_tank', 1]], 14, 63);
        base(g, e, ['yard', 'power', 'barracks', 'refinery'], 67, 12);
        autoPlace(g, e, 'tower_mg', 61, 18);
        squad(g, e, [['s_militia', 4], ['s_buggy', 1]], 62, 16);
        setTimeout(() => say(g, 'Wählen Sie das Bau-Fahrzeug und drücken Sie D zum Aufbauen.'), 800);
      },
      update(g) {
        const s = g.missionState, h = g.players[0];
        if (!s.yard && h.has('yard')) { s.yard = true; say(g, 'Basis errichtet. Bauen Sie ein Kraftwerk und dann eine Raffinerie.'); }
        if (s.yard && !s.ref && h.has('refinery')) { s.ref = true; say(g, 'Gut. Bauen Sie nun eine Kaserne und eine Waffenfabrik.'); }
      },
      objectives(g) { return [{ text: 'Bau-Fahrzeug aufbauen', done: !!g.missionState.yard }, { text: 'Feindliche Basis vernichten', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) { if (!hasBuildings(g, g.players[1])) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
    {
      id: 'm3', title: 'Belagerung', sub: 'Halte die Stellung 10 Minuten',
      briefing: 'Unsere Forschungsstation im Frostbruch ist umzingelt. Das Schattenkollektiv will die dortigen Kristallitproben um jeden Preis.\n\nHalten Sie die Basis 10 Minuten lang, bis der Evakuierungskonvoi eintrifft. Feindliche Angriffswellen werden aus allen Richtungen kommen.\n\nTipp: Verteidigungstürme im Reiter "Verteidigung". Halten Sie die Energieversorgung aufrecht – ohne Energie fallen die Türme aus!',
      map: { size: 80, biome: 'winter', seed: 3303, water: 0.27, rock: 0.68, forest: 0.62 },
      mapOpts: { starts: [[40, 42], [70, 9]], flatten: [[40, 42, 13]] },
      players: [{ faction: 'allianz', human: true, color: '#3b82f6', credits: 5000, name: 'Allianz' }, { faction: 'schatten', ai: 'D', color: '#ef4444', aiOpts: { noAttack: true, armyCap: 16 }, credits: 6000, name: 'Schattenkollektiv' }],
      techLimit: { allianz_sw: false },
      setup(g) {
        const [h, e] = g.players;
        base(g, h, ['yard', 'power', 'power', 'refinery', 'barracks', 'factory', 'power'], 40, 42);
        autoPlace(g, h, 'tower_mg', 40, 33); autoPlace(g, h, 'tower_mg', 33, 46); autoPlace(g, h, 'tower_av', 47, 47);
        squad(g, h, [['a_rifle', 4], ['a_rocket', 2], ['a_tank', 3]], 40, 49);
        base(g, e, ['yard', 'power', 'power', 'barracks', 'refinery', 'factory'], 70, 9);
        autoPlace(g, e, 'tower_av', 64, 14);
        g.missionState.wave = 0; g.missionState.next = 75; g.missionState.dur = 600;
        setTimeout(() => say(g, 'Halten Sie 10 Minuten durch! Erste Welle in Kürze.'), 800);
      },
      update(g) {
        const s = g.missionState, [h, e] = g.players;
        if (g.time >= s.next && g.time < s.dur) {
          s.wave++; s.next = g.time + Math.max(40, 70 - s.wave * 3);
          const edges = [[2, 40], [78, 44], [40, 78], [6, 6], [76, 76], [40, 2]];
          const ed = edges[s.wave % edges.length];
          const n = 3 + s.wave;
          const pool = s.wave < 3 ? ['s_militia', 's_militia', 's_buggy'] : s.wave < 6 ? ['s_militia', 's_flamer', 's_buggy', 's_tank', 's_rocket'] : ['s_flamer', 's_tank', 's_tank', 's_arty', 's_rocket', 's_buggy'];
          const units = [];
          for (let i = 0; i < n; i++) { const u = g.spawnUnitNear(pool[i % pool.length], e, (ed[0] + (i % 4)) * T, (ed[1] + Math.floor(i / 4)) * T); if (u) units.push(u); }
          if (s.wave >= 7 && s.wave % 2) { const a = g.spawnUnit('s_air', e, ed[0] * T, ed[1] * T); if (a) units.push(a); }
          const yard = g.buildings.find(b => !b.dead && b.owner === h) || { x: 40 * T, y: 42 * T };
          g.cmdMove(units, yard.x, yard.y, true);
          say(g, 'Angriffswelle ' + s.wave + ' nähert sich!');
        }
        if (!s.half && g.time > 300) { s.half = true; say(g, 'Noch 5 Minuten. Halten Sie durch!'); }
      },
      objectives(g) { const left = Math.max(0, g.missionState.dur - g.time); return [{ text: 'Überlebe bis zur Evakuierung (' + U.fmtTime(left) + ')', done: left <= 0 }, { text: 'Optional: Feindliche Basis zerstören', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) { if (g.players[0].defeated || !hasBuildings(g, g.players[0])) return 'lose'; if (g.time >= g.missionState.dur || !hasBuildings(g, g.players[1])) return 'win'; return null; },
    },
    {
      id: 'm4', title: 'Kopfgeld', sub: 'Zerstöre das Geheimarchiv',
      briefing: 'Geheimdienstberichte bestätigen: Das Schattenkollektiv lagert im Geheimarchiv seiner Wüstenbasis Pläne für eine neue Waffe – den "Ascheregen".\n\nDas Archiv muss vernichtet werden, bevor die Waffe fertiggestellt ist. Der Feind ist gut verschanzt.\n\nIhre Basis ist bereits teilweise errichtet. Sammeln Sie Kristallit, bauen Sie eine schlagkräftige Armee auf und schlagen Sie zu.',
      map: { size: 96, biome: 'desert', seed: 4404, water: 0.22, rock: 0.67, forest: 0.74 },
      mapOpts: { starts: [[14, 81], [81, 14]] },
      players: [{ faction: 'allianz', human: true, color: '#3b82f6', credits: 6000, name: 'Allianz' }, { faction: 'schatten', ai: 'D', color: '#ef4444', credits: 8000, name: 'Schattenkollektiv' }],
      techLimit: { allianz_sw: false },
      setup(g) {
        const [h, e] = g.players;
        base(g, h, ['yard', 'power', 'refinery', 'barracks'], 14, 81);
        squad(g, h, [['a_rifle', 3], ['a_rocket', 2], ['a_tank', 2]], 18, 76);
        const b = base(g, e, ['yard', 'power', 'power', 'refinery', 'barracks', 'factory', 'radar', 'power', 'tech', 'refinery'], 81, 14);
        autoPlace(g, e, 'tower_av', 73, 20); autoPlace(g, e, 'tower_mg', 76, 23); autoPlace(g, e, 'tower_mg', 70, 15); autoPlace(g, e, 'tower_aa', 78, 20);
        squad(g, e, [['s_militia', 4], ['s_tank', 2], ['s_rocket', 2]], 74, 18);
        g.missionState.target = b.tech; if (b.tech) b.tech.seen = true;
        setTimeout(() => say(g, 'Das Geheimarchiv wurde auf der Karte markiert.'), 800);
      },
      update(g) {
        const t = g.missionState.target;
        if (t && !t.dead && g.time % 20 < 1 / 30) g.alerts.push({ x: t.x, y: t.y, t: g.time });
      },
      objectives(g) { const t = g.missionState.target; return [{ text: 'Zerstöre das Geheimarchiv', done: !t || t.dead }, { text: 'Optional: Feindliche Basis vernichten', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) { const t = g.missionState.target; if (!t || t.dead) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
    {
      id: 'm5', title: 'Ankunft', sub: 'Vernichte die Vael-Invasoren',
      briefing: 'Etwas Unvorstellbares ist geschehen: Aus dem Kristallit heraus haben sich Portale geöffnet. Eine außerirdische Spezies – von unseren Wissenschaftlern "Vael" genannt – ist in das Ödland eingefallen.\n\nDie Vael errichten einen Rissgenerator: eine Superwaffe, die ganze Basen auslöschen kann. Das Schattenkollektiv operiert ebenfalls in der Gegend und kämpft gegen alle.\n\nErrichten Sie Ihre Basis und vernichten Sie die Vael, bevor sie sich ausbreiten. Schwebende Vael-Einheiten können Lava überqueren!',
      map: { size: 96, biome: 'wasteland', seed: 5505, water: 0.27, rock: 0.70, forest: 0.70 },
      mapOpts: { starts: [[14, 14], [81, 81], [81, 14]] },
      players: [{ faction: 'allianz', human: true, color: '#3b82f6', credits: 8000, name: 'Allianz' }, { faction: 'vael', ai: 'D', color: '#a855f7', credits: 6000, name: 'Vael' }, { faction: 'schatten', ai: 'D-1', color: '#ef4444', credits: 5000, name: 'Schattenkollektiv' }],
      swTime: 480,
      setup(g) {
        const [h, v, s] = g.players;
        squad(g, h, [['a_mcv', 1]], 14, 14); squad(g, h, [['a_rifle', 4], ['a_rocket', 2], ['a_tank', 3], ['a_jeep', 1]], 18, 18);
        const vb = base(g, v, ['yard', 'power', 'power', 'refinery', 'barracks', 'factory', 'radar', 'power', 'tech', 'sw'], 81, 81);
        autoPlace(g, v, 'tower_av', 74, 74); autoPlace(g, v, 'tower_mg', 78, 72);
        squad(g, v, [['v_drone', 4], ['v_prism', 2], ['v_glider', 2]], 74, 76);
        base(g, s, ['yard', 'power', 'barracks', 'refinery'], 81, 14);
        squad(g, s, [['s_militia', 3], ['s_buggy', 2]], 76, 18);
        g.missionState.sw = vb.sw; if (vb.sw) vb.sw.seen = true;
        setTimeout(() => say(g, 'Der Rissgenerator der Vael lädt sich auf! Zerstören Sie ihn!'), 1000);
      },
      objectives(g) { const s = g.missionState.sw; return [{ text: 'Zerstöre den Rissgenerator', done: !s || s.dead }, { text: 'Vernichte alle Vael-Gebäude', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) { if (!hasBuildings(g, g.players[1])) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
    {
      id: 'm6', title: 'Kristallherz', sub: 'Die Entscheidungsschlacht',
      briefing: 'Das Schattenkollektiv hat sich mit den Vael verbündet – Verrat an der gesamten Menschheit. Gemeinsam bewachen sie das "Kristallherz", die Quelle der Portale.\n\nDies ist die letzte Schlacht, Commander. Sämtliche Technologie der Allianz steht Ihnen zur Verfügung, einschließlich der Orbitallanze.\n\nVernichten Sie beide Feinde. Für die Zukunft der Erde.',
      map: { size: 112, biome: 'temperate', seed: 6606, water: 0.33, rock: 0.70, forest: 0.64 },
      mapOpts: { starts: [[16, 95], [95, 16], [95, 95]] },
      players: [{ faction: 'allianz', human: true, color: '#3b82f6', credits: 12000, name: 'Allianz' }, { faction: 'vael', ai: 'D+1', team: 2, color: '#a855f7', credits: 10000, name: 'Vael' }, { faction: 'schatten', ai: 'D', team: 2, color: '#ef4444', credits: 10000, name: 'Schattenkollektiv' }],
      setup(g) {
        const [h, v, s] = g.players;
        base(g, h, ['yard', 'power', 'refinery', 'barracks', 'power', 'factory'], 16, 95);
        squad(g, h, [['a_rifle', 4], ['a_rocket', 3], ['a_tank', 4], ['a_arty', 1]], 22, 90);
        base(g, v, ['yard', 'power', 'refinery', 'barracks'], 95, 16);
        squad(g, v, [['v_drone', 4], ['v_glider', 2]], 90, 20);
        base(g, s, ['yard', 'power', 'refinery', 'barracks'], 95, 95);
        squad(g, s, [['s_militia', 4], ['s_buggy', 2]], 90, 90);
      },
      objectives(g) { return [{ text: 'Vernichte die Vael', done: g.players[1].defeated }, { text: 'Vernichte das Schattenkollektiv', done: g.players[2].defeated }]; },
      check(g) { if (g.players[1].defeated && g.players[2].defeated) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
  ];

  // Erzeugt die Spielkonfiguration für eine Mission
  function buildConfig(m, diff) {
    const players = m.players.map((p, i) => {
      const c = Object.assign({}, p);
      if (c.ai) { const d = c.ai === 'D' ? 0 : parseInt(c.ai.slice(1), 10); c.ai = shiftLv(diff, d); }
      if (!c.team) c.team = c.human ? 1 : 100 + i;
      c.start = i;
      return c;
    });
    if (players[0].human) players[0].team = 1;
    return {
      map: Object.assign({}, m.map), mapOpts: m.mapOpts, players,
      mission: m, techLimit: m.techLimit || null, swTime: m.swTime || 300, superweapons: true,
      gameSpeed: 1, startCredits: 0,
    };
  }

  const CAMPAIGNS = [
    { id: 'allianz', faction: 'allianz', title: 'Operation Morgenröte', sub: 'Kampagne der Vereinigten Allianz', missions: MISSIONS },
  ];
  RTS.campaign = { MISSIONS, CAMPAIGNS, buildConfig, LEVELS, helpers: { autoPlace, base, squad, hasBuildings, hasUnits, say, shiftLv } };
})();
