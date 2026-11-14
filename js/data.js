'use strict';
// ===== Spieldaten: Fraktionen, Einheiten, Gebäude, Forschung =====
(function () {
  const D = {};

  // Schadensart -> Multiplikator je Panzerungsklasse
  D.WARHEADS = {
    bullet:   { inf: 1.0, light: 0.5, heavy: 0.12, air: 0.6, bld: 0.12 },
    cannon:   { inf: 0.5, light: 0.9, heavy: 1.0, air: 0, bld: 0.75 },
    rocket:   { inf: 0.35, light: 1.0, heavy: 1.1, air: 1.1, bld: 0.6 },
    flame:    { inf: 1.5, light: 0.55, heavy: 0.22, air: 0, bld: 0.9 },
    laser:    { inf: 0.8, light: 1.0, heavy: 0.85, air: 0.7, bld: 0.65 },
    acid:     { inf: 0.85, light: 0.95, heavy: 0.8, air: 0.8, bld: 0.45 },
    artillery:{ inf: 0.9, light: 0.85, heavy: 0.6, air: 0, bld: 1.25 },
    claw:     { inf: 1.3, light: 0.55, heavy: 0.28, air: 0, bld: 0.45 },
    flak:     { inf: 0, light: 0, heavy: 0, air: 1.6, bld: 0 },
    super:    { inf: 1, light: 1, heavy: 1, air: 0.5, bld: 1 },
    crush:    { inf: 1, light: 0, heavy: 0, air: 0, bld: 0 },
  };
  D.ARMOR_NAMES = { inf: 'Infanterie', light: 'Leicht', heavy: 'Schwer', air: 'Luft', bld: 'Gebäude' };

  // Waffen: range/minRange in Kacheln, cd in Sekunden
  // proj: tracer | shell | rocket | arc | beam | flame | claw | acid
  D.WEAPONS = {
    rifle:      { dmg: 12, range: 4.5, cd: 0.6, wh: 'bullet', proj: 'tracer', targets: 'both', snd: 'mg' },
    rifle_s:    { dmg: 9, range: 4.5, cd: 0.55, wh: 'bullet', proj: 'tracer', targets: 'ground', snd: 'mg' },
    mg:         { dmg: 7, range: 5, cd: 0.22, wh: 'bullet', proj: 'tracer', targets: 'both', snd: 'mg', turret: true },
    mg_tower:   { dmg: 9, range: 6, cd: 0.2, wh: 'bullet', proj: 'tracer', targets: 'ground', snd: 'mg', turret: true },
    rocket_inf: { dmg: 50, range: 5.5, cd: 2.2, wh: 'rocket', proj: 'rocket', targets: 'both', snd: 'rocket' },
    tank_gun:   { dmg: 42, range: 5.5, cd: 1.6, wh: 'cannon', proj: 'shell', targets: 'ground', snd: 'cannon', turret: true, splash: 0.6 },
    tank_gun_l: { dmg: 32, range: 5.0, cd: 1.3, wh: 'cannon', proj: 'shell', targets: 'ground', snd: 'cannon', turret: true },
    heavy_gun:  { dmg: 75, range: 6.2, cd: 2.0, wh: 'cannon', proj: 'shell', targets: 'ground', snd: 'bigcannon', turret: true, barrels: 2, splash: 0.8 },
    epic_mg:    { dmg: 9, range: 5, cd: 0.25, wh: 'bullet', proj: 'tracer', targets: 'ground', snd: 'mg', turret: true },
    epic_acid:  { dmg: 14, range: 5, cd: 0.5, wh: 'claw', proj: 'acid', targets: 'ground', snd: 'acid', splash: 0.6 },
    epic_aa:    { dmg: 30, range: 7, cd: 1.3, wh: 'rocket', proj: 'rocket', targets: 'air', snd: 'rocket', turret: true },
    howitzer:   { dmg: 90, range: 12, minRange: 3, cd: 4.2, wh: 'artillery', proj: 'arc', targets: 'ground', splash: 1.3, snd: 'bigcannon', turret: true },
    rocket_arty:{ dmg: 32, range: 11, minRange: 3, cd: 4.5, wh: 'artillery', proj: 'arc', targets: 'ground', splash: 1.0, salvo: 4, snd: 'rocket', turret: true },
    spore_arty: { dmg: 70, range: 11, minRange: 3, cd: 3.8, wh: 'acid', proj: 'arc', targets: 'ground', splash: 1.5, snd: 'acid', turret: true },
    gunship:    { dmg: 40, range: 5, cd: 1.4, wh: 'rocket', proj: 'rocket', targets: 'ground', snd: 'rocket', salvo: 2 },
    jet_rockets:{ dmg: 55, range: 4.5, cd: 1.8, wh: 'rocket', proj: 'rocket', targets: 'both', snd: 'rocket' },
    plasma_air: { dmg: 38, range: 5, cd: 1.2, wh: 'laser', proj: 'beam', targets: 'both', snd: 'laser', color: '#c084fc' },
    flame:      { dmg: 14, range: 2.6, cd: 0.25, wh: 'flame', proj: 'flame', targets: 'ground', splash: 0.6, snd: 'flame' },
    laser_l:    { dmg: 33, range: 5.5, cd: 1.1, wh: 'laser', proj: 'beam', targets: 'ground', snd: 'laser', turret: true, color: '#ff4d4d' },
    laser_h:    { dmg: 125, range: 6.5, cd: 2.2, wh: 'laser', proj: 'beam', targets: 'ground', snd: 'biglaser', turret: true, color: '#ff2a2a', width: 4 },
    laser_tower:{ dmg: 90, range: 7, cd: 2.0, wh: 'laser', proj: 'beam', targets: 'ground', snd: 'biglaser', color: '#ff3b3b', width: 4 },
    claw:       { dmg: 11, range: 2.2, cd: 0.55, wh: 'claw', proj: 'claw', targets: 'ground', snd: 'claw' },
    acid:       { dmg: 20, range: 5.5, cd: 0.9, wh: 'acid', proj: 'acid', targets: 'both', snd: 'acid' },
    acid_tower: { dmg: 12, range: 6, cd: 0.3, wh: 'bullet', proj: 'acid', targets: 'ground', snd: 'acid' },
    prism:      { dmg: 34, range: 5.5, cd: 1.3, wh: 'laser', proj: 'beam', targets: 'ground', snd: 'laser', turret: true, color: '#a855f7' },
    prism_glider:{ dmg: 17, range: 4.5, cd: 0.6, wh: 'laser', proj: 'beam', targets: 'both', snd: 'laser', turret: true, color: '#d8b4fe', width: 1.5 },
    prism_epic: { dmg: 120, range: 7, cd: 2.4, wh: 'laser', proj: 'beam', targets: 'ground', snd: 'biglaser', turret: true, color: '#e879f9', width: 5 },
    prism_tower:{ dmg: 70, range: 7, cd: 1.7, wh: 'laser', proj: 'beam', targets: 'ground', snd: 'biglaser', color: '#c026d3', width: 3 },
    tower_gun:  { dmg: 60, range: 7, cd: 1.6, wh: 'cannon', proj: 'shell', targets: 'ground', snd: 'bigcannon', turret: true, barrels: 2 },
    flak_veh:   { dmg: 15, range: 7.5, cd: 0.38, wh: 'flak', proj: 'tracer', targets: 'air', snd: 'flak', turret: true },
    flak:       { dmg: 24, range: 8, cd: 0.45, wh: 'flak', proj: 'tracer', targets: 'air', snd: 'flak', turret: true },
  };

  D.FACTIONS = {
    allianz: {
      id: 'allianz', name: 'Vereinigte Allianz', short: 'Allianz', color: '#3b82f6',
      motto: 'Ordnung durch Stärke.',
      desc: 'Schwer gepanzerte, disziplinierte Streitkräfte. Langsam, aber äußerst widerstandsfähig. Gebäude und Fahrzeuge +15% Struktur.',
      trait: { bldHp: 1.15, vehHp: 1.15 },
      sw: { name: 'Orbitallanze', dmg: 1600, radius: 3.5, fx: 'orbital' },
      style: 'angular', accent: '#cbd5e1',
    },
    schatten: {
      id: 'schatten', name: 'Schattenkollektiv', short: 'Schatten', color: '#dc2626',
      motto: 'Aus der Asche, in die Asche.',
      desc: 'Schnelle, getarnte Guerillatruppen mit Flammen- und Laserwaffen. Alle Einheiten +10% Tempo.',
      trait: { speed: 1.1 },
      sw: { name: 'Ascheregen', dmg: 1400, radius: 4.5, fx: 'missile' },
      style: 'sleek', accent: '#18181b',
    },
    vael: {
      id: 'vael', name: 'Die Vael', short: 'Vael', color: '#a855f7',
      motto: 'Alles wird Kristall.',
      desc: 'Außerirdische Invasoren. Billige Schwärme, Schwebeeinheiten (überqueren Wasser), alle Einheiten regenerieren.',
      trait: { regen: 0.0085 },
      sw: { name: 'Dimensionsriss', dmg: 1200, radius: 5, fx: 'rift' },
      style: 'organic', accent: '#22d3ee',
    },
  };
  D.FACTION_ORDER = ['allianz', 'schatten', 'vael'];

  // ===== Gebäude (rollenbasiert, je Fraktion benannt) =====
  const ROLES = {
    yard:     { w: 3, h: 3, cost: 3500, time: 0, hp: 3500, power: 10, sight: 7, req: [], cat: 'base', buildable: false, desc: 'Errichtet alle Basisgebäude. Wird durch das Bau-Fahrzeug aufgebaut.' },
    power:    { w: 2, h: 2, cost: 600, time: 7, hp: 900, power: 25, sight: 4, req: [], cat: 'base', desc: 'Liefert Energie für die Basis.' },
    refinery: { w: 3, h: 3, cost: 2000, time: 13, hp: 1600, power: -6, sight: 5, req: ['power'], cat: 'base', desc: 'Verarbeitet Kristallit. Inklusive eines Sammlers.' },
    barracks: { w: 2, h: 2, cost: 500, time: 7, hp: 1000, power: -4, sight: 5, req: ['power'], cat: 'base', produces: 'inf', desc: 'Bildet Infanterie aus.' },
    factory:  { w: 3, h: 3, cost: 2000, time: 14, hp: 2200, power: -8, sight: 5, req: ['refinery'], cat: 'base', produces: 'veh', desc: 'Baut Fahrzeuge.' },
    radar:    { w: 2, h: 2, cost: 1500, time: 11, hp: 1000, power: -10, sight: 11, req: ['refinery'], cat: 'base', desc: 'Aktiviert die Radarkarte. Schaltet fortgeschrittene Technik frei.' },
    airfield: { w: 3, h: 3, cost: 1500, time: 12, hp: 1400, power: -6, sight: 5, req: ['radar'], cat: 'base', produces: 'air', desc: 'Produziert Lufteinheiten.' },
    tech:     { w: 3, h: 3, cost: 2500, time: 18, hp: 1600, power: -14, sight: 5, req: ['factory', 'radar'], cat: 'base', desc: 'Ermöglicht Forschung und Elite-Einheiten.' },
    sw:       { w: 3, h: 3, cost: 5000, time: 40, hp: 3000, power: -20, sight: 5, req: ['tech'], cat: 'base', sw: true, desc: 'Superwaffe. Lädt sich über 5 Minuten auf.' },
    tower_mg: { w: 1, h: 1, cost: 500, time: 6, hp: 700, power: -2, sight: 7, req: ['barracks'], cat: 'defense', desc: 'Verteidigung gegen Infanterie.' },
    tower_av: { w: 2, h: 2, cost: 1300, time: 10, hp: 1500, power: -8, sight: 8, req: ['radar'], cat: 'defense', desc: 'Verteidigung gegen Fahrzeuge.' },
    tower_aa: { w: 1, h: 1, cost: 800, time: 7, hp: 700, power: -4, sight: 9, req: ['radar'], cat: 'defense', desc: 'Luftabwehr.' },
  };
  D.ROLES = ROLES;
  D.ROLE_ORDER = ['power', 'refinery', 'barracks', 'factory', 'radar', 'airfield', 'tech', 'sw', 'tower_mg', 'tower_av', 'tower_aa', 'yard'];

  const BNAMES = {
    allianz: { yard: 'Kommandozentrale', power: 'Fusionskraftwerk', refinery: 'Raffinerie', barracks: 'Kaserne', factory: 'Waffenfabrik', radar: 'Kommandoposten', airfield: 'Luftwaffenbasis', tech: 'Forschungslabor', sw: 'Orbitallanze-Uplink', tower_mg: 'Wachbunker', tower_av: 'Kanonenturm', tower_aa: 'Flakstellung' },
    schatten: { yard: 'Zitadelle', power: 'Glutreaktor', refinery: 'Schmelzwerk', barracks: 'Rekrutierungshalle', factory: 'Kriegsschmiede', radar: 'Spähnetz', airfield: 'Schattenhangar', tech: 'Geheimarchiv', sw: 'Ascheregen-Silo', tower_mg: 'Kugelnest', tower_av: 'Glutlanze', tower_aa: 'Sturmflak' },
    vael: { yard: 'Nexus', power: 'Energieknoten', refinery: 'Absorber', barracks: 'Brutstätte', factory: 'Formungskammer', radar: 'Wahrnehmer', airfield: 'Schwebeportal', tech: 'Denkknoten', sw: 'Rissgenerator', tower_mg: 'Dornenstock', tower_av: 'Prismenspitze', tower_aa: 'Sporenturm' },
  };
  const TOWER_WEAPONS = {
    allianz: { tower_mg: ['mg_tower'], tower_av: ['tower_gun'], tower_aa: ['flak'] },
    schatten: { tower_mg: ['mg_tower'], tower_av: ['laser_tower'], tower_aa: ['flak'] },
    vael: { tower_mg: ['acid_tower'], tower_av: ['prism_tower'], tower_aa: ['flak'] },
  };

  D.BUILDINGS = {};
  for (const f of D.FACTION_ORDER) {
    for (const role of D.ROLE_ORDER) {
      const r = ROLES[role];
      const id = f + '_' + role;
      D.BUILDINGS[id] = Object.assign({}, r, {
        id, role, faction: f, name: BNAMES[f][role], kind: 'building',
        weapons: (TOWER_WEAPONS[f][role] || []).map(w => D.WEAPONS[w]),
      });
    }
  }

  // ===== Neutrale, eroberbare Gebäude =====
  const NEUTRAL = [
    { id: 'n_derrick', role: 'derrick', name: 'Kristallbohrer', w: 2, h: 2, hp: 1300, sight: 5, cost: 1500, income: 20, bonus: 500, desc: 'Fördert Kristallit aus der Tiefe: 500 Credits bei Eroberung, danach laufende Einnahmen. Mit einem Ingenieur erobern.' },
    { id: 'n_outpost', role: 'outpost', name: 'Beobachtungsposten', w: 2, h: 2, hp: 1300, sight: 14, cost: 1500, desc: 'Deckt ein großes Gebiet auf und erlaubt den Bau von Gebäuden in seiner Nähe. Mit einem Ingenieur erobern.' },
  ];
  for (const n of NEUTRAL) D.BUILDINGS[n.id] = Object.assign({ faction: 'neutral', kind: 'building', cat: 'neutral', time: 0, power: 0, req: [], weapons: [], buildable: false, neutral: true }, n);
  D.NEUTRAL = NEUTRAL;

  // ===== Spezialfähigkeiten =====
  D.POWERS = {
    scan: { id: 'scan', name: 'Radarscan', req: 'radar', cost: 300, cd: 75, radius: 8, dur: 15, key: 'F', color: '#7dd3fc', desc: 'Deckt ein Gebiet 15 Sekunden lang auf und enttarnt dort Einheiten.' },
    drop: { id: 'drop', faction: 'allianz', name: 'Luftlandung', req: 'tech', cost: 1400, cd: 210, radius: 2.5, key: 'G', color: '#93c5fd', units: [['a_rifle', 3], ['a_rocket', 2]], desc: 'Setzt 3 Schützentrupps und 2 Raketentrupps (erfahren) im sichtbaren Zielgebiet ab.' },
    emp: { id: 'emp', faction: 'schatten', name: 'EMP-Schlag', req: 'tech', cost: 900, cd: 180, radius: 5, dur: 15, dmg: 120, key: 'G', color: '#fca5a5', desc: 'Legt feindliche Fahrzeuge, Flugzeuge und Gebäude im Zielgebiet 15 Sekunden lang lahm und beschädigt sie leicht.' },
    heal: { id: 'heal', faction: 'vael', name: 'Symbiosewelle', req: 'tech', cost: 1000, cd: 180, radius: 6, key: 'G', color: '#86efac', desc: 'Heilt eigene Einheiten im Zielgebiet um 60 % und Gebäude um 25 %.' },
  };
  D.powersFor = (faction) => Object.values(D.POWERS).filter(p => !p.faction || p.faction === faction);

  // ===== Einheiten =====
  // cat: inf | veh | air ; armor: inf | light | heavy | air ; speed in Kacheln/s ; size = Radius in px
  const UNITS = [
    // --- Allianz ---
    { id: 'a_rifle', faction: 'allianz', name: 'Schützentrupp', cat: 'inf', cost: 200, time: 5, hp: 110, armor: 'inf', speed: 1.6, sight: 6, weapons: ['rifle'], size: 9, draw: { t: 'squad', n: 3 }, desc: 'Standard-Infanterie. Stark gegen Infanterie.' },
    { id: 'a_rocket', faction: 'allianz', name: 'Raketentrupp', cat: 'inf', cost: 280, time: 7, hp: 95, armor: 'inf', speed: 1.45, sight: 6, weapons: ['rocket_inf'], size: 9, draw: { t: 'squad', n: 2, gun: 'rocket' }, desc: 'Panzerabwehr & Flugabwehr.' },
    { id: 'a_eng', faction: 'allianz', name: 'Ingenieur', cat: 'inf', cost: 500, time: 8, hp: 75, armor: 'inf', speed: 1.5, sight: 5, weapons: [], size: 7, draw: { t: 'squad', n: 1, gun: 'tool' }, engineer: true, desc: 'Erobert neutrale Gebäude sofort, feindliche Gebäude ab unter 50 % Struktur. Repariert eigene Gebäude vollständig.' },
    { id: 'a_jeep', faction: 'allianz', name: 'Wolf-Späher', cat: 'veh', cost: 500, time: 8, hp: 260, armor: 'light', speed: 3.6, sight: 9, weapons: ['mg'], size: 11, turn: 6, draw: { t: 'jeep' }, desc: 'Schneller Aufklärer mit MG.' },
    { id: 'a_tank', faction: 'allianz', name: 'Bastion-Kampfpanzer', cat: 'veh', cost: 850, time: 11, hp: 520, armor: 'heavy', speed: 2.0, sight: 7, weapons: ['tank_gun'], size: 14, turn: 2.5, draw: { t: 'tank' }, tags: ['tank'], desc: 'Robuster Hauptkampfpanzer.' },
    { id: 'a_flak', faction: 'allianz', name: 'Wächter-Flakpanzer', cat: 'veh', cost: 700, time: 9, hp: 360, armor: 'light', speed: 2.4, sight: 8, weapons: ['flak_veh'], size: 13, turn: 3, draw: { t: 'tank', aa: true }, desc: 'Mobile Flugabwehr. Kann keine Bodenziele angreifen.' },
    { id: 'a_arty', faction: 'allianz', name: 'Donner-Haubitze', cat: 'veh', cost: 1100, time: 14, hp: 260, armor: 'light', speed: 1.6, sight: 8, weapons: ['howitzer'], size: 14, turn: 2, draw: { t: 'arty' }, req: ['radar'], desc: 'Weitreichende Artillerie. Mindestreichweite.' },
    { id: 'a_epic', faction: 'allianz', name: 'Koloss', cat: 'veh', cost: 2600, time: 28, hp: 1800, armor: 'heavy', speed: 1.05, sight: 8, weapons: ['heavy_gun', 'epic_aa', 'epic_mg'], size: 21, turn: 1.4, draw: { t: 'walker' }, tags: ['tank'], req: ['tech'], desc: 'Gigantischer Kampfläufer. Zwillingskanonen und Flugabwehr.' },
    { id: 'a_air', faction: 'allianz', name: 'Falke-VTOL', cat: 'air', cost: 1200, time: 13, hp: 280, armor: 'air', speed: 4.5, sight: 8, weapons: ['gunship'], size: 13, turn: 4, draw: { t: 'vtol' }, desc: 'Kampfflugzeug gegen Bodenziele.' },
    { id: 'a_harv', faction: 'allianz', name: 'Sammler', cat: 'veh', cost: 1400, time: 14, hp: 900, armor: 'heavy', speed: 1.6, sight: 5, weapons: [], size: 15, turn: 2.2, draw: { t: 'harvester' }, harvester: true, desc: 'Sammelt Kristallit.' },
    { id: 'a_mcv', faction: 'allianz', name: 'Bau-Fahrzeug', cat: 'veh', cost: 3000, time: 30, hp: 1200, armor: 'heavy', speed: 1.3, sight: 6, weapons: [], size: 18, turn: 1.6, draw: { t: 'mcv' }, mcv: true, req: ['radar'], desc: 'Baut eine neue Kommandozentrale auf (Taste D).' },
    // --- Schattenkollektiv ---
    { id: 's_militia', faction: 'schatten', name: 'Eiferer', cat: 'inf', cost: 150, time: 4, hp: 85, armor: 'inf', speed: 1.75, sight: 6, weapons: ['rifle_s'], size: 9, draw: { t: 'squad', n: 4 }, desc: 'Billige, schnelle Infanterie.' },
    { id: 's_flamer', faction: 'schatten', name: 'Glutwerfer', cat: 'inf', cost: 300, time: 6, hp: 120, armor: 'inf', speed: 1.55, sight: 5, weapons: ['flame'], size: 9, draw: { t: 'squad', n: 2, gun: 'flame' }, desc: 'Flammenwerfer. Verheerend gegen Infanterie und Gebäude.' },
    { id: 's_rocket', faction: 'schatten', name: 'Stachel-Trupp', cat: 'inf', cost: 300, time: 7, hp: 90, armor: 'inf', speed: 1.5, sight: 6, weapons: ['rocket_inf'], size: 9, draw: { t: 'squad', n: 2, gun: 'rocket' }, desc: 'Panzerabwehr & Flugabwehr.' },
    { id: 's_eng', faction: 'schatten', name: 'Saboteur', cat: 'inf', cost: 500, time: 8, hp: 70, armor: 'inf', speed: 1.7, sight: 5, weapons: [], size: 7, draw: { t: 'squad', n: 1, gun: 'tool' }, engineer: true, desc: 'Erobert neutrale Gebäude sofort, feindliche Gebäude ab unter 50 % Struktur. Repariert eigene Gebäude vollständig.' },
    { id: 's_buggy', faction: 'schatten', name: 'Raider-Buggy', cat: 'veh', cost: 400, time: 6, hp: 170, armor: 'light', speed: 4.4, sight: 8, weapons: ['mg'], size: 10, turn: 7, draw: { t: 'buggy' }, desc: 'Extrem schneller Angreifer.' },
    { id: 's_tank', faction: 'schatten', name: 'Phantom-Panzer', cat: 'veh', cost: 780, time: 10, hp: 440, armor: 'light', speed: 2.8, sight: 7, weapons: ['laser_l'], size: 13, turn: 3.5, draw: { t: 'tank', sleek: true }, stealth: true, tags: ['tank'], desc: 'Getarnter Laserpanzer. Unsichtbar, solange er nicht feuert.' },
    { id: 's_flak', faction: 'schatten', name: 'Sturmfalke-Flak', cat: 'veh', cost: 600, time: 8, hp: 260, armor: 'light', speed: 3.4, sight: 8, weapons: ['flak_veh'], size: 11, turn: 5, draw: { t: 'buggy', aa: true }, desc: 'Schnelle mobile Flugabwehr. Kann keine Bodenziele angreifen.' },
    { id: 's_arty', faction: 'schatten', name: 'Hydra-Werfer', cat: 'veh', cost: 1000, time: 13, hp: 240, armor: 'light', speed: 2.1, sight: 8, weapons: ['rocket_arty'], size: 13, turn: 2.5, draw: { t: 'rocketarty' }, req: ['radar'], desc: 'Raketenartillerie mit Salven.' },
    { id: 's_epic', faction: 'schatten', name: 'Nachtmahr', cat: 'veh', cost: 2200, time: 26, hp: 1500, armor: 'heavy', speed: 1.5, sight: 8, weapons: ['laser_h', 'epic_mg'], size: 19, turn: 1.8, draw: { t: 'spider' }, tags: ['tank'], req: ['tech'], desc: 'Schwerer Läufer mit verheerendem Laser.' },
    { id: 's_air', faction: 'schatten', name: 'Schwinge', cat: 'air', cost: 1100, time: 12, hp: 220, armor: 'air', speed: 6.0, sight: 8, weapons: ['jet_rockets'], size: 13, turn: 3, draw: { t: 'jet' }, desc: 'Schneller Jäger. Greift Luft- und Bodenziele an.' },
    { id: 's_harv', faction: 'schatten', name: 'Sammler', cat: 'veh', cost: 1400, time: 14, hp: 800, armor: 'heavy', speed: 1.8, sight: 5, weapons: [], size: 15, turn: 2.4, draw: { t: 'harvester' }, harvester: true, desc: 'Sammelt Kristallit.' },
    { id: 's_mcv', faction: 'schatten', name: 'Bau-Fahrzeug', cat: 'veh', cost: 3000, time: 30, hp: 1100, armor: 'heavy', speed: 1.4, sight: 6, weapons: [], size: 18, turn: 1.6, draw: { t: 'mcv' }, mcv: true, req: ['radar'], desc: 'Baut eine neue Zitadelle auf (Taste D).' },
    // --- Vael ---
    { id: 'v_drone', faction: 'vael', name: 'Drohnling-Schwarm', cat: 'inf', cost: 130, time: 3, hp: 100, armor: 'inf', speed: 2.3, sight: 5, weapons: ['claw'], size: 9, draw: { t: 'swarm', n: 5 }, desc: 'Billiger Schwarm. Springt Ziele auf kurze Distanz an – stark gegen Infanterie.' },
    { id: 'v_spitter', faction: 'vael', name: 'Säurespucker', cat: 'inf', cost: 240, time: 6, hp: 150, armor: 'inf', speed: 1.5, sight: 6, weapons: ['acid'], size: 9, draw: { t: 'swarm', n: 2, big: true }, desc: 'Säure-Infanterie gegen Fahrzeuge. Trifft auch Luftziele.' },
    { id: 'v_eng', faction: 'vael', name: 'Assimilator', cat: 'inf', cost: 500, time: 8, hp: 80, armor: 'inf', speed: 1.6, sight: 5, weapons: [], size: 7, draw: { t: 'swarm', n: 1, big: true, eng: true }, engineer: true, desc: 'Assimiliert neutrale Gebäude sofort, feindliche Gebäude ab unter 50 % Struktur. Heilt eigene Gebäude vollständig.' },
    { id: 'v_glider', faction: 'vael', name: 'Gleiter', cat: 'veh', cost: 450, time: 7, hp: 220, armor: 'light', speed: 4.0, sight: 8, weapons: ['prism_glider'], size: 11, turn: 6, draw: { t: 'hover' }, hover: true, desc: 'Schnelle Schwebeeinheit. Überquert Wasser.' },
    { id: 'v_prism', faction: 'vael', name: 'Prismenläufer', cat: 'veh', cost: 920, time: 12, hp: 560, armor: 'heavy', speed: 1.9, sight: 7, weapons: ['prism'], size: 14, turn: 3, draw: { t: 'tripod', small: true }, tags: ['tank'], desc: 'Kampfläufer mit Prismenstrahl.' },
    { id: 'v_flak', faction: 'vael', name: 'Himmelsdorn', cat: 'veh', cost: 650, time: 8, hp: 290, armor: 'light', speed: 3.0, sight: 8, weapons: ['flak_veh'], size: 12, turn: 5, draw: { t: 'hover', aa: true }, hover: true, desc: 'Schwebende Flugabwehr. Kann keine Bodenziele angreifen.' },
    { id: 'v_spore', faction: 'vael', name: 'Sporenwerfer', cat: 'veh', cost: 1100, time: 13, hp: 260, armor: 'light', speed: 1.8, sight: 8, weapons: ['spore_arty'], size: 13, turn: 2.5, draw: { t: 'hover', arty: true }, hover: true, req: ['radar'], desc: 'Schwebende Säure-Artillerie.' },
    { id: 'v_epic', faction: 'vael', name: 'Weltenbrecher', cat: 'veh', cost: 2800, time: 30, hp: 1850, armor: 'heavy', speed: 1.0, sight: 9, weapons: ['prism_epic', 'epic_aa', 'epic_acid'], size: 22, turn: 1.3, draw: { t: 'tripod' }, tags: ['tank'], req: ['tech'], desc: 'Gigantischer Dreibeiner. Zerstört alles am Boden.' },
    { id: 'v_air', faction: 'vael', name: 'Schwarmträger', cat: 'air', cost: 1300, time: 13, hp: 300, armor: 'air', speed: 4.2, sight: 8, weapons: ['plasma_air'], size: 14, turn: 3.5, draw: { t: 'saucer' }, desc: 'Schwebendes Plasmaschiff gegen Luft und Boden.' },
    { id: 'v_harv', faction: 'vael', name: 'Sammler', cat: 'veh', cost: 1400, time: 14, hp: 850, armor: 'heavy', speed: 1.7, sight: 5, weapons: [], size: 15, turn: 2.4, draw: { t: 'harvester', hover: true }, harvester: true, hover: true, desc: 'Sammelt Kristallit. Schwebt über Wasser.' },
    { id: 'v_mcv', faction: 'vael', name: 'Saatkapsel', cat: 'veh', cost: 3000, time: 30, hp: 1100, armor: 'heavy', speed: 1.3, sight: 6, weapons: [], size: 18, turn: 1.6, draw: { t: 'mcv' }, mcv: true, req: ['radar'], desc: 'Wächst zu einem neuen Nexus heran (Taste D).' },
  ];
  D.UNITS = {};
  for (const u of UNITS) {
    u.kind = 'unit';
    u.weapons = u.weapons.map(w => D.WEAPONS[w]);
    u.req = u.req || [];
    u.tags = u.tags || [];
    u.turn = u.turn || 10;
    u.producer = { inf: 'barracks', veh: 'factory', air: 'airfield' }[u.cat];
    D.UNITS[u.id] = u;
  }

  // ===== Forschung =====
  const RESEARCH = [
    { id: 'r_armor', name: 'Verbundpanzerung', cost: 2000, time: 45, req: ['tech'], mods: { hp: { light: 1.2, heavy: 1.2 } }, desc: '+20% Struktur für alle Fahrzeuge.' },
    { id: 'r_dmg', name: 'Präzisionsmunition', cost: 2500, time: 50, req: ['tech'], mods: { dmg: 1.15 }, desc: '+15% Schaden für alle Einheiten.' },
    { id: 'r_harv', name: 'Erweiterte Sammelbehälter', cost: 1500, time: 35, req: ['radar'], mods: { harvCap: 1.35 }, desc: '+35% Ladekapazität der Sammler.' },
    { id: 'r_inf', name: 'Gefechtsausbildung', cost: 1500, time: 35, req: ['tech'], mods: { hp: { inf: 1.25 }, speed: { inf: 1.1 } }, desc: 'Infanterie: +25% Leben, +10% Tempo.' },
    { id: 'r_rail', faction: 'allianz', name: 'Railgun-Bewaffnung', cost: 3000, time: 60, req: ['tech'], mods: { tagDmg: { tank: 1.35 } }, desc: 'Panzer und Koloss: +35% Schaden.' },
    { id: 'r_plating', faction: 'allianz', name: 'Bunker-Verstärkung', cost: 1500, time: 35, req: ['radar'], mods: { bldHp: 1.25 }, desc: 'Gebäude: +25% Struktur.' },
    { id: 'r_stealth', faction: 'schatten', name: 'Tarnfeld-Generatoren', cost: 3000, time: 60, req: ['tech'], mods: { stealthVeh: true }, desc: 'Alle Fahrzeuge werden im Stillstand getarnt.' },
    { id: 'r_nitro', faction: 'schatten', name: 'Nitro-Einspritzung', cost: 1500, time: 35, req: ['radar'], mods: { speed: { light: 1.25, heavy: 1.15 } }, desc: 'Fahrzeuge: deutlich schneller.' },
    { id: 'r_regen', faction: 'vael', name: 'Symbiose', cost: 2000, time: 45, req: ['tech'], mods: { regen: 2.5 }, desc: 'Regeneration aller Einheiten stark erhöht.' },
    { id: 'r_shield', faction: 'vael', name: 'Phasenpanzer', cost: 2500, time: 50, req: ['tech'], mods: { hp: { inf: 1.15, light: 1.15, heavy: 1.15, air: 1.15 } }, desc: 'Alle Einheiten: +15% Struktur.' },
  ];
  D.RESEARCH = {};
  for (const r of RESEARCH) { r.kind = 'research'; D.RESEARCH[r.id] = r; }

  // Liefert alle baubaren Dinge einer Fraktion je Sidebar-Kategorie
  D.TABS = [
    { id: 'base', name: 'Basis', icon: '▣' },
    { id: 'defense', name: 'Verteidigung', icon: '⛨' },
    { id: 'inf', name: 'Infanterie', icon: '☗' },
    { id: 'veh', name: 'Fahrzeuge', icon: '⛟' },
    { id: 'air', name: 'Luft', icon: '✈' },
    { id: 'research', name: 'Forschung', icon: '⚛' },
  ];
  D.itemsFor = function (faction, tab) {
    if (tab === 'base' || tab === 'defense') {
      return D.ROLE_ORDER.map(r => D.BUILDINGS[faction + '_' + r]).filter(b => b.cat === tab && b.buildable !== false);
    }
    if (tab === 'research') return RESEARCH.filter(r => !r.faction || r.faction === faction);
    return UNITS.filter(u => u.faction === faction && u.cat === tab);
  };
  D.def = function (id) { return D.UNITS[id] || D.BUILDINGS[id] || D.RESEARCH[id]; };

  D.PLAYER_COLORS = [
    { id: 'blau', name: 'Blau', hex: '#3b82f6' },
    { id: 'rot', name: 'Rot', hex: '#ef4444' },
    { id: 'gruen', name: 'Grün', hex: '#22c55e' },
    { id: 'gelb', name: 'Gelb', hex: '#eab308' },
    { id: 'lila', name: 'Lila', hex: '#a855f7' },
    { id: 'orange', name: 'Orange', hex: '#f97316' },
    { id: 'tuerkis', name: 'Türkis', hex: '#14b8a6' },
    { id: 'weiss', name: 'Weiß', hex: '#e5e7eb' },
  ];

  D.DIFFICULTY = {
    easy:   { name: 'Leicht', income: 0.75, think: 2.4, buildSpeed: 0.75, wave0: 6, waveGrow: 2, firstAttack: 360, defenses: 1, research: false, sw: false },
    normal: { name: 'Normal', income: 1.0, think: 1.5, buildSpeed: 1.0, wave0: 8, waveGrow: 3, firstAttack: 270, defenses: 3, research: true, sw: true },
    hard:   { name: 'Schwer', income: 1.3, think: 1.0, buildSpeed: 1.2, wave0: 10, waveGrow: 4, firstAttack: 210, defenses: 5, research: true, sw: true },
    brutal: { name: 'Brutal', income: 1.7, think: 0.7, buildSpeed: 1.45, wave0: 12, waveGrow: 5, firstAttack: 170, defenses: 7, research: true, sw: true },
  };

  RTS.data = D;
})();
