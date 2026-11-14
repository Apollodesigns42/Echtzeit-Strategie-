'use strict';
// ===== Speichern und Laden von Spielständen =====
(function () {
  const U = RTS.util, D = RTS.data;
  const KEY = 'kf_save', VERSION = 2;

  const isEnt = (v) => v && (v.isUnit || v.isBuilding);
  const ref = (e) => (e ? (e.dead ? { __dead: 1, removed: !!e.removed } : { __ent: e.id }) : null);
  // Beliebige Daten (Missionszustand) speicherbar machen: Einheiten/Gebäude/Spieler werden zu Verweisen
  function pack(v) {
    if (isEnt(v)) return ref(v);
    if (v instanceof RTS.Player) return { __player: v.id };
    if (Array.isArray(v)) return v.map(pack);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) { if (typeof v[k] !== 'function') o[k] = pack(v[k]); } return o; }
    return v;
  }
  function unpack(v, ents, g) {
    if (Array.isArray(v)) return v.map(x => unpack(x, ents, g));
    if (v && typeof v === 'object') {
      if (v.__ent != null) return ents.get(v.__ent) || { dead: true, removed: false };
      if (v.__dead) return { dead: true, removed: !!v.removed };
      if (v.__player != null) return v.__player < 0 ? g.neutral : g.players[v.__player];
      const o = {}; for (const k in v) o[k] = unpack(v[k], ents, g); return o;
    }
    return v;
  }
  const pid = (p) => (p ? p.id : null);

  function serialize(g, meta) {
    const cfg = meta.mode === 'campaign' ? null : JSON.parse(JSON.stringify(Object.assign({}, g.cfg, { mission: undefined })));
    return {
      v: VERSION, saved: Date.now(), meta, cfg,
      time: g.time, tickN: g.tickN, nextId: g.nextId,
      ore: Array.from(g.map.ore), explored: Array.from(g.explored).join(''),
      players: g.players.map(p => ({
        credits: p.credits, team: p.team, defeated: p.defeated, researched: Array.from(p.researched),
        queues: Object.fromEntries(Object.entries(p.queues).map(([k, q]) => [k, q.map(it => ({ id: it.def.id, spent: it.spent, ready: it.ready, paused: it.paused }))])),
        stats: Object.assign({}, p.stats), primary: Object.assign({}, p.primary), powerReady: Object.assign({}, p.powerReady),
      })),
      buildings: g.buildings.filter(b => !b.dead).map(b => ({
        id: b.id, def: b.def.id, owner: b.owner.id, orig: b.origOwner.id, tx: b.tx, ty: b.ty, hp: b.hp, built: b.built, repairing: b.repairing, rally: b.rally,
        charge: b.charge, seen: b.seen, spawnHarvester: b.spawnHarvester, bonusGiven: !!b.bonusGiven, empUntil: b.empUntil || 0, turret: b.turret,
      })),
      units: g.units.filter(u => !u.dead).map(u => ({
        id: u.id, def: u.def.id, owner: u.owner.id, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, rank: u.rank, xp: u.xp, angle: u.angle, turret: u.turret,
        order: pack(u.order), target: ref(u.target), goalX: u.goalX, goalY: u.goalY, moving: !!(u.path || u.pathPending), guardX: u.guardX, guardY: u.guardY,
        cargo: u.cargo, hstate: u.hstate, oreT: u.oreT, dockRef: ref(u.dockRef), dockPt: u.dockPt || null,
        group: u.group != null ? u.group : null, speedMult: u.speedMult || null, convoy: !!u.convoy, groupSpeed: u.groupSpeed || 0,
        empUntil: u.empUntil || 0, lastFired: u.lastFired,
      })),
      strikes: g.pendingStrikes.map(s => ({ x: s.x, y: s.y, t: s.t, max: s.max, owner: pid(s.owner) })),
      drops: g.pendingDrops.map(d => ({ x: d.x, y: d.y, t: d.t, max: d.max, owner: pid(d.owner) })),
      scans: g.scans.map(s => Object.assign({}, s)), crates: g.crates.map(c => ({ x: c.x, y: c.y, born: c.born })), crateT: g.crateT,
      missionState: pack(g.missionState),
      ais: g.ais.map(a => ({ player: a.p.id, waveSize: a.waveSize, waveN: a.waveN, nextAttack: a.nextAttack, lastDefend: a.lastDefend, focus: pid(a.focus), attackGroup: a.attackGroup.filter(u => !u.dead).map(u => u.id) })),
    };
  }

  function configFor(data) {
    if (data.meta.mode === 'campaign') {
      const m = RTS.campaign.CAMPAIGNS[data.meta.camp].missions[data.meta.mission];
      return RTS.campaign.buildConfig(m, data.meta.diff || 'normal');
    }
    return data.cfg;
  }

  function restore(data) {
    if (!data || data.v !== VERSION) throw new Error('Spielstand ist nicht kompatibel');
    const cfg = configFor(data);
    const g = new RTS.Game(cfg);
    g.assignStarts();
    g.time = data.time; g.tickN = data.tickN;
    g.map.ore.set(data.ore); g.map.oreVersion++;
    const owner = (i) => (i < 0 ? g.neutral : g.players[i]);
    // Spieler
    data.players.forEach((sp, i) => {
      const p = g.players[i];
      p.credits = sp.credits; p.team = sp.team; p.defeated = sp.defeated;
      for (const id of sp.researched) if (D.RESEARCH[id]) p.applyResearch(D.RESEARCH[id]);
      for (const tab in sp.queues) p.queues[tab] = sp.queues[tab].filter(it => D.def(it.id)).map(it => ({ def: D.def(it.id), spent: it.spent, ready: it.ready, paused: it.paused }));
      Object.assign(p.stats, sp.stats); Object.assign(p.powerReady, sp.powerReady);
    });
    // Gebäude und Einheiten
    const ents = new Map();
    for (const sb of data.buildings) {
      if (!D.BUILDINGS[sb.def]) continue;
      const b = g.placeBuilding(sb.def, owner(sb.owner), sb.tx, sb.ty, { instant: true, harvester: false });
      if (sb.orig != null) b.origOwner = owner(sb.orig);
      b.built = sb.built; b.hp = sb.hp; b.repairing = sb.repairing; b.rally = sb.rally; b.charge = sb.charge; b.seen = sb.seen;
      b.spawnHarvester = sb.spawnHarvester && sb.built < 1; b.bonusGiven = sb.bonusGiven; b.empUntil = sb.empUntil; b.turret = sb.turret;
      ents.set(sb.id, b);
    }
    for (const su of data.units) {
      if (!D.UNITS[su.def]) continue;
      const u = g.spawnUnit(su.def, owner(su.owner), su.x, su.y);
      u.rank = su.rank; u.xp = su.xp; u.maxHp = u.def.hp * u.hpMult();
      if (Math.abs(su.maxHp - u.maxHp) > 1 && su.speedMult) u.maxHp = su.maxHp; // Sonderwerte (z. B. Konvoi-Transporter)
      u.hp = Math.min(su.hp, u.maxHp);
      u.angle = su.angle; u.turret = su.turret; u.guardX = su.guardX; u.guardY = su.guardY; u.goalX = su.goalX; u.goalY = su.goalY;
      u.cargo = su.cargo; u.hstate = su.hstate; u.oreT = su.oreT; u.dockPt = su.dockPt; u.group = su.group; u.speedMult = su.speedMult || undefined;
      u.convoy = su.convoy; u.groupSpeed = su.groupSpeed; u.empUntil = su.empUntil; u.lastFired = su.lastFired; u.px = u.x; u.py = u.y;
      ents.set(su.id, u);
    }
    // Verweise auflösen
    for (const su of data.units) {
      const u = ents.get(su.id); if (!u) continue;
      u.order = unpack(su.order, ents, g) || { type: 'idle' };
      if (u.order.target && u.order.target.dead) u.order = { type: 'idle' };
      const t = unpack(su.target, ents, g); u.target = t && !t.dead ? t : null;
      const dr = unpack(su.dockRef, ents, g); u.dockRef = dr && !dr.dead ? dr : null;
      if (u.hstate === 'unload' && u.dockRef) u.dockRef.dockUser = u;
      if (su.moving) u.moveTo(su.goalX, su.goalY);
    }
    data.players.forEach((sp, i) => { for (const role in sp.primary) { const b = ents.get(sp.primary[role]); if (b) g.players[i].primary[role] = b.id; } });
    g.nextId = Math.max(g.nextId, data.nextId);
    for (let i = 0; i < g.explored.length; i++) g.explored[i] = data.explored.charCodeAt(i) === 49 ? 1 : 0;
    if (cfg.reveal) g.explored.fill(1);
    g.pendingStrikes = data.strikes.map(s => { const o = owner(s.owner); return { x: s.x, y: s.y, t: s.t, max: s.max, owner: o, sw: o.fdef.sw }; });
    g.pendingDrops = data.drops.map(d => ({ x: d.x, y: d.y, t: d.t, max: d.max, owner: owner(d.owner), units: D.POWERS.drop.units }));
    g.scans = data.scans; g.crates = data.crates; g.crateT = data.crateT;
    g.missionState = unpack(data.missionState, ents, g) || {};
    g.finishInit();
    for (const sa of data.ais) {
      const a = g.ais.find(x => x.p.id === sa.player); if (!a) continue;
      a.waveSize = sa.waveSize; a.waveN = sa.waveN; a.nextAttack = sa.nextAttack; a.lastDefend = sa.lastDefend;
      a.focus = sa.focus != null ? g.players[sa.focus] : null;
      a.attackGroup = sa.attackGroup.map(id => ents.get(id)).filter(Boolean);
    }
    return g;
  }

  function describe(data) {
    const m = data.meta;
    let what = 'Gefecht';
    if (m.mode === 'campaign') { const c = RTS.campaign.CAMPAIGNS[m.camp]; what = c.title + ' – Mission ' + (m.mission + 1) + ': ' + c.missions[m.mission].title; }
    else if (data.cfg && data.cfg.map) what = 'Gefecht – ' + data.cfg.map.name;
    const d = new Date(data.saved);
    const pad = (n) => String(n).padStart(2, '0');
    return what + ' · Spielzeit ' + U.fmtTime(data.time) + ' · gespeichert ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '. ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function write(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } }
  function read() { try { const s = localStorage.getItem(KEY); if (!s) return null; const d = JSON.parse(s); return d && d.v === VERSION ? d : null; } catch (e) { return null; } }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignorieren */ } }

  RTS.save = { serialize, restore, describe, write, read, clear, configFor };
})();
