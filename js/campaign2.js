'use strict';
// ===== Kampagnen des Schattenkollektivs und der Vael =====
(function () {
  const U = RTS.util, T = U.TILE;
  const { autoPlace, base, squad, hasBuildings, hasUnits, say, out } = RTS.campaign.helpers;
  const alive = (b) => !out(b);
  const nearAny = (g, p, x, y, r) => g.units.some(u => !u.dead && u.owner === p && U.dist(u.x, u.y, x * T, y * T) < r * T);
  const SCH = (o) => Object.assign({ faction: 'schatten', human: true, color: '#ef4444', name: 'Schattenkollektiv' }, o);
  const VAE = (o) => Object.assign({ faction: 'vael', human: true, color: '#a855f7', name: 'Vael' }, o);
  const ALL = (o) => Object.assign({ faction: 'allianz', color: '#3b82f6', name: 'Allianz' }, o);

  // Wellen von Kartenrändern auf die Basis eines Spielers
  function waveSpawner(g, attacker, target, edges, pools, opts = {}) {
    const s = g.missionState;
    if (g.time < s.next || g.time >= (opts.until || 1e9)) return;
    s.wave = (s.wave || 0) + 1; s.next = g.time + Math.max(opts.min || 40, (opts.every || 70) - s.wave * 3);
    const ed = edges[s.wave % edges.length];
    const pool = pools[Math.min(pools.length - 1, Math.floor((s.wave - 1) / 3))];
    const n = (opts.base || 3) + s.wave;
    const units = [];
    for (let i = 0; i < n; i++) { const u = g.spawnUnitNear(pool[i % pool.length], attacker, (ed[0] + (i % 4)) * T, (ed[1] + Math.floor(i / 4)) * T); if (u) units.push(u); }
    const tgt = g.buildings.find(b => !b.dead && b.owner === target) || g.units.find(u => !u.dead && u.owner === target);
    if (tgt) g.cmdMove(units, tgt.x, tgt.y, true);
    say(g, (opts.label || 'Angriffswelle') + ' ' + s.wave + ' im Anmarsch!');
  }

  // ================= Schattenkollektiv: „Aus der Asche“ =================
  const SCHATTEN = [
    {
      id: 's1', title: 'Funke', sub: 'Überfall auf den Allianz-Außenposten',
      briefing: 'Bruder, die Allianz nennt uns Terroristen. Wir nennen uns die Stimme derer, die sie vergessen haben.\n\nEin Außenposten der Allianz beutet das Kristallit im Grenzland aus und vertreibt die Siedler. Wir schlagen zu, bevor sie Verstärkung rufen.\n\nIhr führt einen kleinen Stoßtrupp. Unsere Phantom-Panzer sind unsichtbar, solange sie nicht feuern – nutzt das, um die Verteidigung zu umgehen.\n\nZiel: Zerstört alle Gebäude des Außenpostens.',
      map: { size: 64, biome: 'desert', seed: 7101, water: 0.22, rock: 0.70, forest: 0.72 },
      mapOpts: { starts: [[9, 54], [52, 11]] },
      players: [SCH({ credits: 0 }), ALL({ ai: 'D', aiOpts: { noBuild: true, noProduce: true, noAttack: true }, credits: 0 })],
      radar: true,
      setup(g) {
        const [h, e] = g.players;
        squad(g, h, [['s_militia', 5], ['s_flamer', 3], ['s_rocket', 2], ['s_buggy', 2], ['s_tank', 3]], 10, 51);
        base(g, e, ['power', 'barracks', 'refinery', 'power'], 52, 11);
        autoPlace(g, e, 'tower_mg', 46, 16); autoPlace(g, e, 'tower_mg', 50, 19);
        squad(g, e, [['a_rifle', 4], ['a_rocket', 2]], 47, 15);
        squad(g, e, [['a_rifle', 2], ['a_jeep', 1]], 30, 32);
        setTimeout(() => say(g, 'Tipp: Phantom-Panzer bleiben getarnt, bis sie feuern oder entdeckt werden.'), 800);
      },
      update(g) {
        const s = g.missionState, h = g.players[0];
        if (!s.reinf && g.time > 120) { s.reinf = true; squad(g, h, [['s_buggy', 2], ['s_flamer', 2]], 6, 58); say(g, 'Verstärkung aus dem Untergrund eingetroffen.'); }
      },
      objectives(g) { return [{ text: 'Zerstöre den Allianz-Außenposten', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) { if (!hasBuildings(g, g.players[1])) return 'win'; if (!hasUnits(g, g.players[0])) return 'lose'; return null; },
    },
    {
      id: 's2', title: 'Untergrund', sub: 'Errichte eine geheime Basis',
      briefing: 'Unser Überfall hat die Allianz aufgeschreckt. Sie hat einen Stützpunkt im Tal errichtet, um uns zu jagen.\n\nBaut euer Bau-Fahrzeug auf (Taste D) und errichtet die Zitadelle. Sichert die Kristallfelder – ohne Kristallit keine Revolution.\n\nVernichtet dann den Allianz-Stützpunkt im Nordosten. Unsere Raider-Buggys sind schnell genug, um ihre Sammler zu jagen.',
      map: { size: 80, biome: 'temperate', seed: 7202, water: 0.29, rock: 0.70, forest: 0.62 },
      mapOpts: { starts: [[12, 67], [67, 12]] },
      players: [SCH({ credits: 7000 }), ALL({ ai: 'D-1', aiOpts: { armyCap: 14 }, credits: 4000 })],
      techLimit: { schatten_tech: false, schatten_airfield: false, schatten_sw: false },
      setup(g) {
        const [h, e] = g.players;
        squad(g, h, [['s_mcv', 1]], 12, 67); squad(g, h, [['s_militia', 4], ['s_buggy', 2]], 14, 63);
        base(g, e, ['yard', 'power', 'barracks', 'refinery'], 67, 12);
        autoPlace(g, e, 'tower_mg', 61, 18);
        squad(g, e, [['a_rifle', 4], ['a_jeep', 1]], 62, 16);
        setTimeout(() => say(g, 'Wählen Sie das Bau-Fahrzeug und drücken Sie D.'), 800);
      },
      update(g) { const s = g.missionState, h = g.players[0]; if (!s.yard && h.has('yard')) { s.yard = true; say(g, 'Zitadelle errichtet. Glutreaktor und Schmelzwerk bauen!'); } },
      objectives(g) { return [{ text: 'Bau-Fahrzeug aufbauen', done: !!g.missionState.yard }, { text: 'Allianz-Stützpunkt vernichten', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) { if (!hasBuildings(g, g.players[1])) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
    {
      id: 's3', title: 'Hinterhalt', sub: 'Stoppe die Kristallit-Konvois',
      briefing: 'Die Allianz transportiert das geraubte Kristallit in schwer bewachten Konvois über die Südstraße nach Osten.\n\nJeder Transporter, der durchkommt, finanziert ihre Panzer. Errichtet eine Stellung nahe der Straße und vernichtet die Transporter.\n\nFünf Konvois werden erwartet. Höchstens vier Transporter dürfen entkommen.',
      map: { size: 96, biome: 'desert', seed: 7303, water: 0.2, rock: 0.68, forest: 0.74 },
      mapOpts: { starts: [[46, 50], [86, 10]], corridors: [[3, 74, 92, 74, 3], [46, 50, 46, 72, 3]], flatten: [[46, 50, 12]] },
      players: [SCH({ credits: 5000 }), ALL({ ai: 'D-1', aiOpts: { armyCap: 12, noAttack: true }, credits: 4000 })],
      techLimit: { schatten_sw: false },
      setup(g) {
        const [h, e] = g.players;
        base(g, h, ['yard', 'power', 'refinery', 'barracks', 'power'], 46, 50);
        squad(g, h, [['s_buggy', 3], ['s_tank', 2], ['s_rocket', 3], ['s_militia', 3]], 46, 60);
        base(g, e, ['yard', 'power', 'barracks', 'refinery', 'factory'], 86, 10);
        Object.assign(g.missionState, { next: 150, conv: 0, trucks: [], escaped: 0, killed: 0 });
        setTimeout(() => say(g, 'Erster Konvoi in etwa 2,5 Minuten. Er kommt von Westen über die Südstraße.'), 800);
      },
      update(g) {
        const s = g.missionState, e = g.players[1];
        if (s.conv < 5 && g.time >= s.next) {
          s.conv++; s.next = g.time + 85;
          const trucks = [], esc = [];
          for (let i = 0; i < 2; i++) { const t = g.spawnUnitNear('a_harv', e, (3 + i * 2) * T, 74 * T); if (t) { t.convoy = true; t.speedMult = 0.65; t.maxHp = t.hp = 520; trucks.push(t); } }
          const escorts = [['a_tank', 1 + Math.floor(s.conv / 2)], ['a_rifle', 2], ['a_rocket', s.conv > 2 ? 2 : 1], ['a_jeep', 1]];
          escorts.forEach(([id, n]) => { for (let i = 0; i < n; i++) { const u = g.spawnUnitNear(id, e, (2 + i) * T, (72 + (esc.length % 4)) * T); if (u) { u.convoy = true; esc.push(u); } } });
          g.cmdMove(trucks, 94 * T, 74 * T, false); g.cmdMove(esc, 94 * T, 73 * T, true);
          s.trucks.push(...trucks);
          say(g, 'Konvoi ' + s.conv + ' von 5 auf der Südstraße gesichtet!');
        }
        for (const u of g.units) {
          if (!u.convoy || u.dead) continue;
          if (u.x > 91.5 * T) {
            u.dead = true; u.removed = true;
            if (u.def.harvester) { s.escaped++; say(g, 'Ein Transporter ist entkommen! (' + s.escaped + '/4)'); }
          } else if (u.def.harvester && u.order.type === 'idle' && !u.path && !u.pathPending) g.cmdMove([u], 94 * T, 74 * T, false);
        }
        s.killed = s.trucks.filter(t => t.dead && !t.removed).length;
      },
      objectives(g) { const s = g.missionState; return [{ text: `Transporter zerstören (${s.killed}/10, entkommen: ${s.escaped}/4)`, done: s.conv >= 5 && s.trucks.every(t => t.dead) && s.escaped <= 4 }, { text: 'Optional: Allianz-Basis zerstören', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) {
        const s = g.missionState;
        if (s.escaped > 4 || g.players[0].defeated) return 'lose';
        if (s.conv >= 5 && s.trucks.every(t => t.dead)) return 'win';
        return null;
      },
    },
    {
      id: 's4', title: 'Befreiung', sub: 'Befreie die gefangenen Brüder',
      briefing: 'Die Allianz hält dutzende unserer Kämpfer in einem Gefangenenlager im Südosten fest.\n\nZerstört die Wachtürme des Lagers und führt dann eine Einheit hinein, um die Gefangenen zu befreien. Sie werden sich uns sofort anschließen.\n\nDanach: Vernichtet die Allianz-Basis im Norden, die das Lager versorgt.',
      map: { size: 96, biome: 'temperate', seed: 7404, water: 0.28, rock: 0.70, forest: 0.62 },
      mapOpts: { starts: [[14, 80], [80, 14]], flatten: [[72, 70, 7]] },
      players: [SCH({ credits: 6000 }), ALL({ ai: 'D', credits: 6000 })],
      techLimit: { schatten_sw: false },
      setup(g) {
        const [h, e] = g.players;
        base(g, h, ['yard', 'power', 'refinery', 'barracks'], 14, 80);
        squad(g, h, [['s_militia', 4], ['s_flamer', 2], ['s_tank', 2]], 18, 74);
        base(g, e, ['yard', 'power', 'power', 'refinery', 'barracks', 'factory'], 80, 14);
        autoPlace(g, e, 'tower_av', 74, 20);
        const camp = base(g, e, ['barracks'], 72, 70);
        const towers = [autoPlace(g, e, 'tower_mg', 68, 67), autoPlace(g, e, 'tower_mg', 76, 67), autoPlace(g, e, 'tower_mg', 72, 75), autoPlace(g, e, 'tower_av', 75, 73)];
        squad(g, e, [['a_rifle', 3], ['a_rocket', 1]], 70, 66);
        g.missionState.camp = camp.barracks; g.missionState.towers = towers.filter(Boolean);
        for (const t of g.missionState.towers) t.seen = true; if (camp.barracks) camp.barracks.seen = true;
      },
      update(g) {
        const s = g.missionState, h = g.players[0];
        const towersDown = s.towers.every(out);
        if (!s.freed && towersDown && nearAny(g, h, 72, 70, 4)) {
          s.freed = true; h.credits += 3000;
          squad(g, h, [['s_militia', 6], ['s_flamer', 3], ['s_rocket', 2], ['s_tank', 1]], 72, 71);
          say(g, 'Gefangene befreit! Sie schließen sich uns an. +3000 Credits aus den Lagerbeständen.');
          if (alive(s.camp)) g.kill(s.camp, null);
        }
        if (!s.hint && towersDown && !s.freed) { s.hint = true; say(g, 'Die Wachtürme sind gefallen. Führt eine Einheit ins Lager!'); }
      },
      objectives(g) { const s = g.missionState; return [{ text: 'Zerstöre die Wachtürme des Lagers', done: s.towers.every(out) }, { text: 'Befreie die Gefangenen (Einheit ins Lager)', done: !!s.freed }, { text: 'Vernichte die Allianz-Basis', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) { if (g.missionState.freed && !hasBuildings(g, g.players[1])) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
    {
      id: 's5', title: 'Pakt', sub: 'Gemeinsam mit den Vael gegen die Allianz',
      briefing: 'Die Fremden aus dem Kristall – die Vael – haben Kontakt zu uns aufgenommen. Sie bieten uns ein Bündnis gegen die Allianz an.\n\nDer Rat ist gespalten, doch der Feind meines Feindes ist mein Freund. Vorerst.\n\nEine Vael-Brut kämpft an eurer Seite (lila). Vernichtet gemeinsam die große Allianz-Festung im Osten.',
      map: { size: 112, biome: 'wasteland', seed: 7505, water: 0.27, rock: 0.70, forest: 0.70 },
      mapOpts: { starts: [[14, 20], [96, 56], [14, 92]] },
      players: [SCH({ credits: 9000 }), ALL({ ai: 'D', team: 2, aiOpts: { armyCap: 35 }, credits: 5000 }), { faction: 'vael', ai: 'D', team: 1, color: '#a855f7', credits: 8000, name: 'Vael (Verbündet)' }],
      setup(g) {
        const [h, e, v] = g.players;
        base(g, h, ['yard', 'power', 'refinery', 'barracks', 'factory'], 14, 20);
        squad(g, h, [['s_tank', 3], ['s_rocket', 3], ['s_militia', 4]], 20, 24);
        base(g, e, ['yard', 'power', 'power', 'refinery', 'barracks', 'factory', 'radar'], 96, 56);
        autoPlace(g, e, 'tower_av', 88, 50); autoPlace(g, e, 'tower_av', 88, 62); autoPlace(g, e, 'tower_mg', 86, 56); autoPlace(g, e, 'tower_aa', 92, 56);
        squad(g, e, [['a_tank', 3], ['a_rifle', 4], ['a_rocket', 2]], 88, 56);
        base(g, v, ['yard', 'power', 'refinery', 'barracks'], 14, 92);
        squad(g, v, [['v_drone', 3], ['v_glider', 2]], 20, 88);
        setTimeout(() => say(g, 'Die Vael sind unsere Verbündeten. Ihre Einheiten sind lila markiert.'), 800);
      },
      objectives(g) { return [{ text: 'Vernichte die Allianz-Festung', done: g.players[1].defeated }]; },
      check(g) { if (g.players[1].defeated) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
    {
      id: 's6', title: 'Ascheregen', sub: 'Die letzte Schlacht des Kollektivs',
      briefing: 'Die Allianz hat ihre Orbitallanze auf unsere Hauptstadt gerichtet. Ihr Uplink steht im Norden – er muss fallen.\n\nUnser Ascheregen-Silo ist endlich einsatzbereit. Die Vael kämpfen weiter an unserer Seite.\n\nDoch seid wachsam, Bruder. Das Kristall flüstert, und ich traue diesen Wesen nicht.',
      map: { size: 112, biome: 'winter', seed: 7606, water: 0.30, rock: 0.66, forest: 0.63 },
      mapOpts: { starts: [[16, 95], [56, 14], [96, 95]] },
      players: [SCH({ credits: 12000 }), ALL({ ai: 'D', team: 2, credits: 7000 }), { faction: 'vael', ai: 'D', team: 1, color: '#a855f7', credits: 8000, name: 'Vael' }],
      swTime: 420,
      setup(g) {
        const [h, e, v] = g.players;
        base(g, h, ['yard', 'power', 'power', 'refinery', 'barracks', 'factory', 'radar'], 16, 95);
        squad(g, h, [['s_tank', 3], ['s_rocket', 3], ['s_flamer', 3], ['s_arty', 1]], 22, 90);
        const eb = base(g, e, ['yard', 'power', 'power', 'power', 'refinery', 'barracks', 'factory', 'radar', 'tech', 'sw'], 56, 14);
        autoPlace(g, e, 'tower_av', 50, 22); autoPlace(g, e, 'tower_av', 62, 22); autoPlace(g, e, 'tower_aa', 56, 24);
        squad(g, e, [['a_tank', 3], ['a_rifle', 3], ['a_rocket', 2]], 56, 24);
        base(g, v, ['yard', 'power', 'refinery', 'barracks', 'factory'], 96, 95);
        squad(g, v, [['v_drone', 4], ['v_prism', 2]], 90, 90);
        g.missionState.uplink = eb.sw; if (eb.sw) eb.sw.seen = true;
      },
      update(g) {
        const s = g.missionState, v = g.players[2];
        if (!s.betray && g.time > 480) {
          s.betray = true; v.team = 300;
          for (const ai of g.ais) ai.focus = null;
          for (const u of g.units) if (u.target && !g.hostile(u.owner, u.target.owner)) u.target = null;
          say(g, 'VERRAT! Die Vael haben sich gegen uns gewandt! Vernichtet sie ebenfalls!');
          g.alerts.push({ x: 96 * T, y: 95 * T, t: g.time });
        } else if (!s.warn && g.time > 420) { s.warn = true; say(g, 'Die Vael-Truppen verhalten sich seltsam …'); }
      },
      objectives(g) {
        const s = g.missionState;
        const o = [{ text: 'Zerstöre den Orbitallanze-Uplink', done: !alive(s.uplink) }, { text: 'Vernichte die Allianz', done: g.players[1].defeated }];
        if (s.betray) o.push({ text: 'Vernichte die verräterischen Vael', done: g.players[2].defeated });
        return o;
      },
      check(g) { const s = g.missionState; if (s.betray && g.players[1].defeated && g.players[2].defeated) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
  ];

  // ================= Vael: „Der Ruf des Kristalls“ =================
  const VAEL = [
    {
      id: 'v1', title: 'Erwachen', sub: 'Die ersten Schritte auf der neuen Welt',
      briefing: '[Übertragung des Schwarmbewusstseins]\n\nDer Riss ist offen. Die Welt, die das Kristall uns zeigte, ist bewohnt – von kleinen, lauten Wesen, die unser Kristall verbrennen.\n\nEine Gruppe dieser Wesen – sie nennen sich „Schattenkollektiv“ – gräbt nahe am Riss. Löscht sie aus.\n\nUnsere Einheiten heilen sich selbst, wenn sie nicht kämpfen. Zieht verwundete Einheiten zurück.',
      map: { size: 64, biome: 'wasteland', seed: 8101, water: 0.25, rock: 0.70, forest: 0.70 },
      mapOpts: { starts: [[9, 54], [52, 11]] },
      players: [VAE({ credits: 0 }), { faction: 'schatten', ai: 'D', aiOpts: { noBuild: true, noProduce: true, noAttack: true }, color: '#ef4444', credits: 0, name: 'Schattenkollektiv' }],
      radar: true,
      setup(g) {
        const [h, e] = g.players;
        squad(g, h, [['v_drone', 6], ['v_spitter', 3], ['v_prism', 2], ['v_glider', 2]], 10, 51);
        base(g, e, ['power', 'barracks', 'refinery', 'power'], 52, 11);
        autoPlace(g, e, 'tower_mg', 46, 16); autoPlace(g, e, 'tower_mg', 50, 19);
        squad(g, e, [['s_militia', 5], ['s_flamer', 2], ['s_buggy', 2]], 47, 15);
        squad(g, e, [['s_militia', 3], ['s_rocket', 1]], 31, 32);
      },
      update(g) {
        const s = g.missionState, h = g.players[0];
        if (!s.reinf && g.time > 110) { s.reinf = true; squad(g, h, [['v_drone', 4], ['v_prism', 1]], 6, 58); say(g, 'Der Riss gebiert weitere Krieger.'); }
      },
      objectives(g) { return [{ text: 'Lösche die Grabungsstätte aus', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) { if (!hasBuildings(g, g.players[1])) return 'win'; if (!hasUnits(g, g.players[0])) return 'lose'; return null; },
    },
    {
      id: 'v2', title: 'Nest', sub: 'Lass den Nexus wachsen',
      briefing: '[Übertragung des Schwarmbewusstseins]\n\nEine Saatkapsel hat die Oberfläche erreicht. Pflanzt sie (Taste D), damit der Nexus wachsen kann.\n\nAbsorber verwandeln das Kristall in Kraft. Brutstätten und Formungskammern bringen neue Krieger hervor.\n\nDas Schattenkollektiv hat ein Lager im Nordosten. Es wird vergehen.',
      map: { size: 80, biome: 'wasteland', seed: 8202, water: 0.27, rock: 0.70, forest: 0.68 },
      mapOpts: { starts: [[12, 67], [67, 12]] },
      players: [VAE({ credits: 7000 }), { faction: 'schatten', ai: 'D-1', aiOpts: { armyCap: 14 }, color: '#ef4444', credits: 4000, name: 'Schattenkollektiv' }],
      techLimit: { vael_tech: false, vael_airfield: false, vael_sw: false },
      setup(g) {
        const [h, e] = g.players;
        squad(g, h, [['v_mcv', 1]], 12, 67); squad(g, h, [['v_drone', 4], ['v_glider', 1]], 14, 63);
        base(g, e, ['yard', 'power', 'barracks', 'refinery'], 67, 12);
        autoPlace(g, e, 'tower_mg', 61, 18);
        squad(g, e, [['s_militia', 4], ['s_buggy', 1]], 62, 16);
        setTimeout(() => say(g, 'Wählen Sie die Saatkapsel und drücken Sie D.'), 800);
      },
      update(g) { const s = g.missionState, h = g.players[0]; if (!s.yard && h.has('yard')) { s.yard = true; say(g, 'Der Nexus wächst. Errichtet Energieknoten und einen Absorber.'); } },
      objectives(g) { return [{ text: 'Saatkapsel pflanzen', done: !!g.missionState.yard }, { text: 'Lager des Schattenkollektivs vernichten', done: !hasBuildings(g, g.players[1]) }]; },
      check(g) { if (!hasBuildings(g, g.players[1])) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
    {
      id: 'v3', title: 'Kristallflut', sub: 'Sammle 40.000 Kristallit',
      briefing: '[Übertragung des Schwarmbewusstseins]\n\nDer Riss hungert. Um das große Portal zu öffnen, brauchen wir Kristall – viel Kristall.\n\nSammelt 40.000 Einheiten Kristallit. Die Allianz wird versuchen, unsere Absorber und Sammler zu zerstören.\n\nBaut weitere Sammler und Absorber. Schützt sie.',
      map: { size: 96, biome: 'temperate', seed: 8303, water: 0.30, rock: 0.70, forest: 0.64 },
      mapOpts: { starts: [[48, 48], [86, 10]], flatten: [[48, 48, 13]] },
      players: [VAE({ credits: 3000 }), ALL({ ai: 'D', aiOpts: { noAttack: true, armyCap: 16 }, credits: 6000 })],
      techLimit: { vael_sw: false },
      setup(g) {
        const [h, e] = g.players;
        base(g, h, ['yard', 'power', 'power', 'refinery', 'barracks', 'factory'], 48, 48);
        squad(g, h, [['v_drone', 4], ['v_spitter', 3], ['v_prism', 2]], 48, 55);
        base(g, e, ['yard', 'power', 'power', 'barracks', 'refinery', 'factory'], 86, 10);
        autoPlace(g, e, 'tower_av', 80, 15);
        g.missionState.next = 90;
      },
      update(g) {
        waveSpawner(g, g.players[1], g.players[0], [[2, 48], [94, 50], [48, 94], [4, 6], [90, 90]],
          [['a_rifle', 'a_rifle', 'a_jeep'], ['a_rifle', 'a_rocket', 'a_tank', 'a_jeep'], ['a_tank', 'a_tank', 'a_rocket', 'a_arty', 'a_rifle'], ['a_tank', 'a_epic', 'a_rocket', 'a_air', 'a_arty']],
          { every: 80, min: 50, base: 2, label: 'Allianz-Angriff' });
      },
      objectives(g) { const v = Math.floor(g.players[0].stats.harvested); return [{ text: `Sammle Kristallit (${v.toLocaleString('de-DE')} / 40.000)`, done: v >= 40000 }]; },
      check(g) { if (g.players[0].stats.harvested >= 40000) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
    {
      id: 'v4', title: 'Brücke der Welten', sub: 'Schütze den Rissgenerator',
      briefing: '[Übertragung des Schwarmbewusstseins]\n\nDer Rissgenerator ist gewachsen. In zehn Umläufen dieser Welt (Minuten) wird er stabil sein und der Schwarm kann hindurch.\n\nAllianz UND Schattenkollektiv haben seine Energie gespürt. Beide werden angreifen – sie hassen einander ebenso wie uns.\n\nDer Rissgenerator darf nicht fallen. Er kann bereits als Waffe eingesetzt werden, sobald er geladen ist.',
      map: { size: 96, biome: 'winter', seed: 8404, water: 0.28, rock: 0.68, forest: 0.62 },
      mapOpts: { starts: [[48, 50], [12, 10], [84, 10]], flatten: [[48, 50, 13]] },
      players: [VAE({ credits: 6000 }), ALL({ ai: 'D-1', credits: 5000 }), { faction: 'schatten', ai: 'D-1', color: '#ef4444', credits: 5000, name: 'Schattenkollektiv' }],
      swTime: 240,
      setup(g) {
        const [h, e, s] = g.players;
        const hb = base(g, h, ['yard', 'sw', 'power', 'power', 'power', 'refinery', 'barracks', 'factory', 'radar'], 48, 50);
        autoPlace(g, h, 'tower_av', 42, 44); autoPlace(g, h, 'tower_av', 54, 44); autoPlace(g, h, 'tower_mg', 48, 42);
        squad(g, h, [['v_prism', 3], ['v_spitter', 4], ['v_drone', 4]], 48, 58);
        base(g, e, ['yard', 'power', 'power', 'refinery', 'barracks', 'factory'], 12, 10);
        base(g, s, ['yard', 'power', 'power', 'refinery', 'barracks', 'factory'], 84, 10);
        g.missionState.gen = hb.sw; g.missionState.dur = 600;
      },
      update(g) { const s = g.missionState; if (!s.half && g.time > 300) { s.half = true; say(g, 'Der Riss ist zur Hälfte stabilisiert.'); } },
      objectives(g) { const s = g.missionState, left = Math.max(0, s.dur - g.time); return [{ text: 'Rissgenerator schützen (' + U.fmtTime(left) + ')', done: left <= 0 && alive(s.gen) }]; },
      check(g) { const s = g.missionState; if (!alive(s.gen) || g.players[0].defeated) return 'lose'; if (g.time >= s.dur) return 'win'; return null; },
    },
    {
      id: 'v5', title: 'Stille Wellen', sub: 'Zerstöre die Allianz-Horchposten',
      briefing: '[Übertragung des Schwarmbewusstseins]\n\nDie Allianz beobachtet uns mit drei Horchposten (Kommandoposten), verteilt über die Seenplatte.\n\nBlendet sie. Zerstört alle drei Horchposten.\n\nUnsere Gleiter, Sporenwerfer und Sammler schweben über das Wasser – nutzt die Seen, um die Verteidigung zu umgehen.',
      map: { size: 112, biome: 'temperate', seed: 2024, water: 0.40, rock: 0.74, forest: 0.66 },
      mapOpts: { starts: [[16, 95], [95, 16]], flatten: [[56, 22, 5], [95, 70, 5], [40, 56, 5]] },
      players: [VAE({ credits: 8000 }), ALL({ ai: 'D', aiOpts: { armyCap: 18 }, credits: 6000 })],
      setup(g) {
        const [h, e] = g.players;
        base(g, h, ['yard', 'power', 'refinery', 'barracks', 'factory'], 16, 95);
        squad(g, h, [['v_glider', 4], ['v_spore', 2], ['v_prism', 2], ['v_spitter', 3]], 22, 90);
        base(g, e, ['yard', 'power', 'power', 'refinery', 'barracks', 'factory'], 95, 16);
        const posts = [];
        for (const [x, y] of [[56, 22], [95, 70], [40, 56]]) {
          const r = autoPlace(g, e, 'radar', x, y); if (r) { r.seen = true; posts.push(r); }
          autoPlace(g, e, 'power', x + 3, y); autoPlace(g, e, 'tower_av', x - 3, y + 2); autoPlace(g, e, 'tower_mg', x + 2, y + 3);
        }
        g.missionState.posts = posts;
      },
      update(g) { const s = g.missionState; if (g.time % 25 < 1 / 30) for (const p of s.posts) if (alive(p)) g.alerts.push({ x: p.x, y: p.y, t: g.time }); },
      objectives(g) { const p = g.missionState.posts; return [{ text: `Horchposten zerstören (${p.filter(out).length}/${p.length})`, done: p.every(out) }]; },
      check(g) { if (g.missionState.posts.every(out)) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
    {
      id: 'v6', title: 'Kristallherz', sub: 'Die Welt gehört dem Schwarm',
      briefing: '[Übertragung des Schwarmbewusstseins]\n\nDie kleinen Wesen haben ihren Streit vergessen. Allianz und Schattenkollektiv stehen gemeinsam gegen uns.\n\nDas Kristallherz pulsiert unter dieser Welt. Wenn ihre letzten Festungen fallen, wird alles Kristall.\n\nVernichtet beide Fraktionen.',
      map: { size: 112, biome: 'wasteland', seed: 8606, water: 0.28, rock: 0.70, forest: 0.70 },
      mapOpts: { starts: [[16, 95], [95, 16], [95, 95]] },
      players: [VAE({ credits: 15000 }), ALL({ ai: 'D+1', team: 2, credits: 10000 }), { faction: 'schatten', ai: 'D', team: 2, color: '#ef4444', credits: 10000, name: 'Schattenkollektiv' }],
      setup(g) {
        const [h, a, s] = g.players;
        base(g, h, ['yard', 'power', 'refinery', 'barracks', 'power', 'factory'], 16, 95);
        squad(g, h, [['v_prism', 4], ['v_spitter', 4], ['v_drone', 4], ['v_spore', 1]], 22, 90);
        base(g, a, ['yard', 'power', 'refinery', 'barracks'], 95, 16);
        squad(g, a, [['a_rifle', 4], ['a_jeep', 2]], 90, 20);
        base(g, s, ['yard', 'power', 'refinery', 'barracks'], 95, 95);
        squad(g, s, [['s_militia', 4], ['s_buggy', 2]], 90, 90);
      },
      objectives(g) { return [{ text: 'Vernichte die Allianz', done: g.players[1].defeated }, { text: 'Vernichte das Schattenkollektiv', done: g.players[2].defeated }]; },
      check(g) { if (g.players[1].defeated && g.players[2].defeated) return 'win'; if (g.players[0].defeated) return 'lose'; return null; },
    },
  ];

  RTS.campaign.CAMPAIGNS.push(
    { id: 'schatten', faction: 'schatten', title: 'Aus der Asche', sub: 'Kampagne des Schattenkollektivs', missions: SCHATTEN },
    { id: 'vael', faction: 'vael', title: 'Der Ruf des Kristalls', sub: 'Kampagne der Vael', missions: VAEL },
  );
})();
