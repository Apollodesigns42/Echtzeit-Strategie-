'use strict';
// ===== Spielkern: Spieler, Produktion, Simulation =====
(function () {
  const U = RTS.util, D = RTS.data, T = U.TILE;
  const CELL = 128;

  class Player {
    constructor(game, i, cfg) {
      this.game = game; this.id = i; this.name = cfg.name || ('Spieler ' + (i + 1));
      this.faction = cfg.faction; this.fdef = D.FACTIONS[cfg.faction];
      this.color = cfg.color; this.team = cfg.team ? cfg.team : 100 + i;
      this.credits = cfg.credits != null ? cfg.credits : 10000;
      this.isHuman = !!cfg.human; this.aiLevel = cfg.ai || null;
      this.power = { prod: 0, use: 0 };
      this.researched = new Set();
      this.queues = { base: [], defense: [], inf: [], veh: [], air: [], research: [] };
      const tr = this.fdef.trait;
      this.mods = {
        hp: { inf: 1, light: tr.vehHp || 1, heavy: tr.vehHp || 1, air: 1 },
        bldHp: tr.bldHp || 1, dmg: 1, tagDmg: {}, speed: { inf: 1, light: 1, heavy: 1, air: 1, all: tr.speed || 1 },
        harvCap: 1, regen: tr.regen || 0, stealthVeh: false,
      };
      this.incomeMult = cfg.incomeMult || 1; this.buildSpeed = cfg.buildSpeed || 1;
      this.roleCount = {};
      this.primary = {};
      this.stats = { unitsBuilt: 0, unitsLost: 0, kills: 0, bldBuilt: 0, bldLost: 0, bldKilled: 0, harvested: 0, spent: 0 };
      this.defeated = false;
      this.start = null;
      this.lastAttackAlert = -99;
      this.cfgStart = cfg.start;
      this.neutral = !!cfg.neutral;
      this.powerReady = {};
      this.aiOpts = cfg.aiOpts || {};
    }
    get lowPower() { return this.power.use > this.power.prod; }
    has(role) { return (this.roleCount[role] || 0) > 0; }
    count(role) { return this.roleCount[role] || 0; }
    addIncome(amt) { const v = amt * this.incomeMult; this.credits += v; this.stats.harvested += v; }
    reqMet(def) {
      if (def.kind === 'building') { if (!this.has('yard')) return false; }
      else if (def.kind === 'unit') { if (!this.has(def.producer)) return false; }
      for (const r of def.req) if (!this.has(r)) return false;
      if (this.game.techLimit && this.game.techLimit[def.id] === false) return false;
      if (def.kind === 'building' && def.sw && this.game.cfg.superweapons === false) return false;
      return true;
    }
    tabFor(def) { return def.kind === 'building' ? def.cat : def.kind === 'research' ? 'research' : def.cat; }
    canQueue(def) {
      if (!this.reqMet(def)) return false;
      const q = this.queues[this.tabFor(def)];
      if (def.kind === 'building') return q.length === 0;
      if (def.kind === 'research') return !this.researched.has(def.id) && q.length === 0;
      return q.length < 12;
    }
    enqueue(defId) {
      const def = D.def(defId); if (!def || !this.canQueue(def)) return false;
      this.queues[this.tabFor(def)].push({ def, spent: 0, ready: false, paused: false });
      return true;
    }
    cancel(defId) {
      const def = D.def(defId); const q = this.queues[this.tabFor(def)];
      for (let i = q.length - 1; i >= 0; i--) if (q[i].def === def) {
        if (i === 0 && !q[i].paused && !q[i].ready && q[i].spent > 0) { q[i].paused = true; return 'paused'; }
        this.credits += q[i].spent; q.splice(i, 1); return 'cancelled';
      }
      return null;
    }
    producerCount(tab) {
      if (tab === 'base' || tab === 'defense') return this.count('yard');
      if (tab === 'inf') return this.count('barracks');
      if (tab === 'veh') return this.count('factory');
      if (tab === 'air') return this.count('airfield');
      if (tab === 'research') return this.has('tech') || this.has('radar') ? 1 : 0;
      return 0;
    }
    updateProduction(dt) {
      const g = this.game;
      for (const tab in this.queues) {
        const q = this.queues[tab]; if (!q.length) continue;
        const it = q[0]; if (it.ready || it.paused) continue;
        if (!this.reqMet(it.def) && it.def.kind !== 'research') continue;
        const n = this.producerCount(tab); if (!n) continue;
        const speed = Math.min(2.5, 1 + 0.5 * (n - 1)) * (this.lowPower ? 0.5 : 1) * this.buildSpeed * (g.cfg.buildSpeed || 1);
        const cost = it.def.cost, time = it.def.time || 1;
        let spend = Math.min(cost / time * speed * dt, cost - it.spent, this.credits - (this.reserve || 0)); // Reserve: von der KI zurückgelegtes Geld
        if (spend < 0) spend = 0;
        this.credits -= spend; it.spent += spend; this.stats.spent += spend;
        if (it.spent >= cost - 0.001) this.completeItem(tab, it);
      }
    }
    completeItem(tab, it) {
      const g = this.game, def = it.def;
      if (def.kind === 'building') { it.ready = true; if (this.isHuman) g.announce('ready', 'Konstruktion abgeschlossen'); }
      else if (def.kind === 'research') { this.queues[tab].shift(); this.applyResearch(def); if (this.isHuman) g.announce('research', 'Forschung abgeschlossen: ' + def.name); }
      else {
        const u = g.produceUnit(this, def);
        if (u) { this.queues[tab].shift(); this.stats.unitsBuilt++; if (this.isHuman) g.announce('unit', 'Einheit bereit'); }
        else it.spent = def.cost - 0.01;
      }
    }
    applyResearch(def) {
      this.researched.add(def.id);
      const m = def.mods, M = this.mods;
      if (m.hp) for (const k in m.hp) M.hp[k] *= m.hp[k];
      if (m.speed) for (const k in m.speed) M.speed[k] *= m.speed[k];
      if (m.dmg) M.dmg *= m.dmg;
      if (m.tagDmg) for (const k in m.tagDmg) M.tagDmg[k] = (M.tagDmg[k] || 1) * m.tagDmg[k];
      if (m.harvCap) M.harvCap *= m.harvCap;
      if (m.regen) M.regen = (M.regen || 0.004) * m.regen;
      if (m.bldHp) M.bldHp *= m.bldHp;
      if (m.stealthVeh) M.stealthVeh = true;
      for (const u of this.game.units) if (u.owner === this) u.refreshHp();
      for (const b of this.game.buildings) if (b.owner === this) b.refreshHp();
    }
    recalcPower() {
      let prod = 0, use = 0;
      for (const b of this.game.buildings) if (b.owner === this && !b.dead) {
        if (b.def.power > 0) prod += b.def.power * (0.5 + 0.5 * b.hp / b.maxHp); else use -= b.def.power;
      }
      const wasLow = this.lowPower;
      this.power.prod = Math.round(prod); this.power.use = use;
      if (!wasLow && this.lowPower && this.isHuman && this.game.time > 1) this.game.announce('lowpower', 'Niedriger Energiestand', 'warn');
    }
    recountRoles() {
      this.roleCount = {};
      for (const b of this.game.buildings) if (b.owner === this && !b.dead) this.roleCount[b.def.role] = (this.roleCount[b.def.role] || 0) + 1;
    }
  }

  class Game {
    constructor(cfg) {
      this.cfg = cfg;
      this.time = 0; this.tickN = 0; this.nextId = 1; this.speed = cfg.gameSpeed || 1;
      this.rng = U.RNG(cfg.seed || 12345);
      this.swTime = cfg.swTime || 300;
      this.techLimit = cfg.techLimit || null;
      this.map = new RTS.GameMap(cfg.map);
      this.map.generate(cfg.numStarts || cfg.players.length, Object.assign({ neutrals: !!cfg.neutrals && !cfg.mission }, cfg.mapOpts || {}));
      this.pf = new RTS.Pathfinder(this.map);
      this.players = cfg.players.map((p, i) => new Player(this, i, p));
      this.human = this.players.find(p => p.isHuman) || null;
      // Neutraler Besitzer eroberbarer Gebäude (nimmt nicht am Spiel teil)
      this.neutral = new Player(this, -1, { name: 'Neutral', faction: 'allianz', color: '#9aa3ad', team: -1, credits: 0, neutral: true });
      this.units = []; this.buildings = []; this.projectiles = []; this.effects = []; this.pathQueue = [];
      this.hashW = Math.ceil(this.map.w * T / CELL); this.hashH = Math.ceil(this.map.h * T / CELL);
      this.hash = new Array(this.hashW * this.hashH); for (let i = 0; i < this.hash.length; i++) this.hash[i] = [];
      const n = this.map.w * this.map.h;
      this.vis = new Uint8Array(n); this.explored = new Uint8Array(n);
      if (cfg.reveal || !this.human) this.explored.fill(1);
      this.listeners = {}; this.over = false; this.result = null;
      this.announceT = {}; this.alerts = []; this.lastAlert = null;
      this.timers = { fog: 0, ore: 0, check: 0, power: 0 };
      this.mission = cfg.mission || null;
      this.missionState = {};
      this.ais = [];
      this.pendingStrikes = [];
      this.crates = []; this.crateT = 25; this.cratePickT = 0;
      this.scans = []; this.pendingDrops = [];
    }
    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    emit(ev, ...a) { (this.listeners[ev] || []).forEach(f => f(...a)); }

    init() {
      this.assignStarts();
      if (this.mission && this.mission.setup) this.mission.setup(this);
      else {
        for (const p of this.players) this.setupStart(p, this.cfg.startUnits || 'standard');
        for (const n of this.map.neutralSpots || []) this.placeBuilding(n.id, this.neutral, n.tx, n.ty, { instant: true });
      }
      this.finishInit();
    }
    assignStarts() {
      this.players.forEach((p, i) => {
        p.start = this.map.starts[p.cfgStart != null ? p.cfgStart : i] || this.map.starts[i % this.map.starts.length];
      });
    }
    finishInit() {
      for (const p of this.players) { p.recountRoles(); p.recalcPower(); }
      for (const p of this.players) if (p.aiLevel) this.ais.push(new RTS.AI(this, p, p.aiLevel));
      this.updateFog();
    }
    setupStart(p, mode) {
      const s = p.start, f = p.faction[0];
      if (mode === 'mcv') { this.spawnUnit(f + '_mcv', p, (s.tx + 0.5) * T, (s.ty + 0.5) * T); }
      else this.placeBuilding(p.faction + '_yard', p, s.tx - 1, s.ty - 1, { instant: true });
      const extra = { allianz: ['a_rifle', 'a_rifle', 'a_jeep'], schatten: ['s_militia', 's_militia', 's_buggy'], vael: ['v_drone', 'v_drone', 'v_glider'] }[p.faction];
      extra.forEach((id, k) => this.spawnUnitNear(id, p, (s.tx + 0.5 + (k - 1) * 1.5) * T, (s.ty + 3.5) * T));
    }

    // ---- Hilfsfunktionen ----
    hostile(a, b) { return a !== b && a.team !== b.team && !a.neutral && !b.neutral; }
    allied(a, b) { return a === b || a.team === b.team; }
    canSee(p, e) {
      if (this.allied(p, e.owner)) return true;
      if (e.cloaked) return false;
      if (p.isHuman) {
        const tx = Math.floor(e.x / T), ty = Math.floor(e.y / T);
        if (e.isBuilding) return e.seen;
        return !!this.vis[ty * this.map.w + tx];
      }
      return true;
    }
    rebuildHash() {
      const H = this.hash; for (let i = 0; i < H.length; i++) H[i].length = 0;
      const ins = (e) => {
        const cx = U.clamp(Math.floor(e.x / CELL), 0, this.hashW - 1), cy = U.clamp(Math.floor(e.y / CELL), 0, this.hashH - 1);
        H[cy * this.hashW + cx].push(e);
      };
      for (const u of this.units) if (!u.dead) ins(u);
      for (const b of this.buildings) if (!b.dead) ins(b);
    }
    queryRadius(x, y, r, cb) {
      const R = r + 96; // Gebäude werden nur am Mittelpunkt eingetragen
      const x0 = U.clamp(Math.floor((x - R) / CELL), 0, this.hashW - 1), x1 = U.clamp(Math.floor((x + R) / CELL), 0, this.hashW - 1);
      const y0 = U.clamp(Math.floor((y - R) / CELL), 0, this.hashH - 1), y1 = U.clamp(Math.floor((y + R) / CELL), 0, this.hashH - 1);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const c = this.hash[cy * this.hashW + cx];
        for (let i = 0; i < c.length; i++) { const e = c[i]; if (U.dist2(x, y, e.x, e.y) <= (r + e.radius) * (r + e.radius)) cb(e); }
      }
    }
    fx(e) { if (this.effects.length < 2500) this.effects.push(e); }
    sound(name, x, y) {
      if (!RTS.audio || !this.human) return;
      if (x != null) {
        const tx = Math.floor(x / T), ty = Math.floor(y / T);
        if (this.map.inBounds(tx, ty) && !this.vis[ty * this.map.w + tx]) return;
        this.emit('sound', name, x, y);
      } else this.emit('sound', name);
    }
    announce(key, text, type = 'info', cooldown = 0) {
      const last = this.announceT[key] || -99;
      if (this.time - last < (cooldown || 2)) return;
      this.announceT[key] = this.time;
      this.emit('message', text, type, key);
    }
    message(text, type = 'info') { this.emit('message', text, type, null); }

    // ---- Erzeugung ----
    spawnUnit(defId, owner, x, y) {
      const def = D.UNITS[defId]; if (!def) { console.warn('unknown unit', defId); return null; }
      const u = new RTS.Unit(this, def, owner, x, y);
      this.units.push(u); return u;
    }
    spawnUnitNear(defId, owner, x, y) {
      const def = D.UNITS[defId]; if (!def) return null;
      if (def.cat === 'air') return this.spawnUnit(defId, owner, x, y);
      const p = this.map.nearestPassable(Math.floor(x / T), Math.floor(y / T), def.hover ? 1 : 0, 10);
      if (!p) return null;
      const occupied = (tx, ty) => this.units.some(u => !u.dead && !u.isAir && Math.floor(u.x / T) === tx && Math.floor(u.y / T) === ty);
      let best = p;
      if (occupied(p.tx, p.ty)) {
        outer: for (let r = 1; r < 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const tx = p.tx + dx, ty = p.ty + dy;
          if (this.map.passable(tx, ty, def.hover ? 1 : 0) && !occupied(tx, ty)) { best = { tx, ty }; break outer; }
        }
      }
      return this.spawnUnit(defId, owner, (best.tx + 0.5) * T, (best.ty + 0.5) * T);
    }
    produceUnit(p, def) {
      const role = def.producer;
      let prod = this.buildings.find(b => b.id === p.primary[role] && !b.dead && b.owner === p && b.built >= 1);
      if (!prod) prod = this.buildings.find(b => !b.dead && b.owner === p && b.def.role === role && b.built >= 1);
      if (!prod) return null;
      let u;
      if (def.cat === 'air') u = this.spawnUnit(def.id, p, prod.x, prod.y);
      else { const ex = prod.exitPos(); u = this.spawnUnitNear(def.id, p, ex.x, ex.y); }
      if (!u) return null;
      u.angle = Math.PI / 2; u.turret = u.angle;
      if (def.harvester) { u.hstate = 'seek'; return u; }
      const rp = prod.rally || { x: prod.x + (prod.tx % 2 ? 1 : -1) * T, y: (prod.ty + prod.h + 2.5) * T };
      if (prod.rally) { u.order = { type: 'amove', x: rp.x, y: rp.y }; u.moveTo(rp.x, rp.y); }
      else { u.moveTo(rp.x, rp.y); u.order = { type: 'move' }; }
      this.emit('unitProduced', u);
      return u;
    }
    canPlace(p, def, tx, ty, opts = {}) {
      const m = this.map;
      for (let y = ty; y < ty + def.h; y++) for (let x = tx; x < tx + def.w; x++) {
        if (!m.buildable(x, y)) return false;
        if (opts.ignoreUnit == null) {
          // feindliche Einheiten blockieren
          for (const u of this.units) if (!u.dead && !u.isAir && u.owner !== p && Math.floor(u.x / T) === x && Math.floor(u.y / T) === y) return false;
        }
      }
      if (opts.noRadius) return true;
      const R = this.cfg.buildRadius || 6;
      for (const b of this.buildings) {
        if (b.dead || b.owner !== p) continue;
        if (b.def.cat === 'defense' && b.def.w === 1) continue;
        const dx = Math.max(b.tx - (tx + def.w - 1), tx - (b.tx + b.w - 1), 0);
        const dy = Math.max(b.ty - (ty + def.h - 1), ty - (b.ty + b.h - 1), 0);
        if (Math.max(dx, dy) <= R) return true;
      }
      return false;
    }
    placeBuilding(defId, p, tx, ty, opts = {}) {
      const def = D.BUILDINGS[defId]; if (!def) { console.warn('unknown building', defId); return null; }
      const b = new RTS.Building(this, def, p, tx, ty);
      if (opts.instant) b.built = 1;
      for (let y = ty; y < ty + def.h; y++) for (let x = tx; x < tx + def.w; x++) if (this.map.inBounds(x, y)) { this.map.bld[this.map.idx(x, y)] = b.id; this.map.ore[this.map.idx(x, y)] = 0; }
      this.buildings.push(b);
      if (def.role === 'refinery' && opts.harvester !== false) { b.spawnHarvester = true; if (opts.instant) b.onComplete(); }
      else if (opts.instant && def.sw) b.onComplete();
      p.recountRoles(); p.recalcPower();
      if (!opts.instant) { p.stats.bldBuilt++; this.sound('place', b.x, b.y); }
      // Eigene Einheiten herausschieben
      for (const u of this.units) {
        if (u.dead || u.isAir) continue;
        const ux = Math.floor(u.x / T), uy = Math.floor(u.y / T);
        if (ux >= tx && ux < tx + def.w && uy >= ty && uy < ty + def.h) {
          const np = this.map.nearestPassable(ux, uy, u.mode, 8);
          if (np) { u.x = u.px = (np.tx + 0.5) * T; u.y = u.py = (np.ty + 0.5) * T; }
        }
      }
      this.map.oreVersion++;
      return b;
    }
    tryPlaceFromQueue(p, tab, tx, ty) {
      const q = p.queues[tab]; const it = q[0];
      if (!it || !it.ready) return false;
      if (!this.canPlace(p, it.def, tx, ty)) return false;
      q.shift();
      this.placeBuilding(it.def.id, p, tx, ty);
      return true;
    }
    deployMcv(u) {
      const p = u.owner, def = D.BUILDINGS[p.faction + '_yard'];
      const tx = Math.floor(u.x / T) - 1, ty = Math.floor(u.y / T) - 1;
      // Einheit selbst blockiert nicht
      for (let y = ty; y < ty + 3; y++) for (let x = tx; x < tx + 3; x++) if (!this.map.buildable(x, y)) {
        if (p.isHuman) this.announce('nodeploy', 'Aufbau hier nicht möglich', 'warn');
        u.becomeIdle(); return false;
      }
      u.dead = true; u.removed = true;
      this.placeBuilding(def.id, p, tx, ty);
      if (p.isHuman) this.announce('deploy', def.name + ' wird errichtet');
      return true;
    }
    sell(b) {
      if (b.dead || b.built < 1 || b.def.neutral) return;
      const refund = b.def.cost * 0.5 * (b.hp / b.maxHp);
      b.owner.credits += refund;
      this.fx({ k: 'text', x: b.x, y: b.y - 20, txt: '+' + Math.round(refund) + ' $', c: '#86efac', life: 1.5, max: 1.5 });
      this.removeBuilding(b, true);
      // Ein paar Infanteristen kommen heraus
      const inf = D.itemsFor(b.owner.faction, 'inf')[0];
      if (inf && b.def.role !== 'yard' && Math.random() < 0.7) this.spawnUnitNear(inf.id, b.owner, b.x, b.y + b.h * T / 2 + 10);
      this.sound('sell', b.x, b.y);
    }
    removeBuilding(b, sold) {
      b.dead = true;
      for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) if (this.map.inBounds(x, y) && this.map.bld[this.map.idx(x, y)] === b.id) this.map.bld[this.map.idx(x, y)] = 0;
      b.owner.recountRoles(); b.owner.recalcPower();
      if (!sold) this.explode(b.x, b.y, Math.max(b.w, b.h) * T * 0.7, true);
      else this.fx({ k: 'p', x: b.x, y: b.y, vx: 0, vy: -10, life: 1.2, max: 1.2, size: b.w * 12, grow: 20, c: 'rgba(120,120,120,0.4)', smoke: true });
      this.map.oreVersion++;
      // Bauliste leeren, falls kein Bauhof mehr
      if (!b.owner.has('yard')) for (const tab of ['base', 'defense']) { const q = b.owner.queues[tab]; for (const it of q) b.owner.credits += it.spent; q.length = 0; }
    }

    // ---- Kommandos ----
    formationSpots(units, x, y) {
      const m = this.map; const spots = [];
      const ground = units.filter(u => !u.isAir), air = units.filter(u => u.isAir);
      const tx0 = Math.floor(x / T), ty0 = Math.floor(y / T);
      const used = new Set();
      const mode = ground.length && ground.every(u => u.mode === 1) ? 1 : 0;
      for (let r = 0; spots.length < ground.length && r < 15; r++) {
        const ring = [];
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = tx0 + dx, ty = ty0 + dy;
          if (!m.passable(tx, ty, mode)) continue;
          ring.push({ tx, ty, d: dx * dx + dy * dy });
        }
        ring.sort((a, b) => a.d - b.d);
        for (const s of ring) { const k = s.tx + ',' + s.ty; if (!used.has(k)) { used.add(k); spots.push(s); } if (spots.length >= ground.length) break; }
      }
      const res = new Map();
      // Zuordnung: nächste Einheit zu nächstem Platz
      const gx = ground.reduce((a, u) => a + u.x, 0) / (ground.length || 1), gy = ground.reduce((a, u) => a + u.y, 0) / (ground.length || 1);
      const sorted = ground.slice().sort((a, b) => U.dist2(a.x, a.y, x, y) - U.dist2(b.x, b.y, x, y));
      sorted.forEach((u, i) => {
        const s = spots[i];
        if (!s) { res.set(u, { x, y }); return; }
        res.set(u, i === 0 && ground.length === 1 ? { x, y } : { x: (s.tx + 0.5) * T, y: (s.ty + 0.5) * T });
      });
      air.forEach((u, i) => { const a = i * 2.4, r = i === 0 ? 0 : 20 + i * 6; res.set(u, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r }); });
      void gx; void gy;
      return res;
    }
    cmdMove(units, x, y, amove) {
      units = units.filter(u => u.isUnit && !u.dead);
      const spots = this.formationSpots(units, x, y);
      const ground = units.filter(u => !u.isAir && u.def.weapons.length);
      const gs = amove && ground.length > 1 ? Math.min(...ground.map(u => u.baseSpeed)) : 0;
      for (const u of units) {
        u.groupSpeed = u.isAir ? 0 : gs;
        const s = spots.get(u);
        if (u.def.harvester) { u.order = { type: 'move' }; u.hstate = null; if (u.dockRef && u.dockRef.dockUser === u) u.dockRef.dockUser = null; }
        else if (amove && u.def.weapons.length) u.order = { type: 'amove', x: s.x, y: s.y };
        else u.order = { type: 'move' };
        u.target = null; u.moveTo(s.x, s.y);
      }
    }
    cmdAttack(units, target) {
      for (const u of units) {
        if (!u.isUnit || u.dead || !RTS.combat.canAttack(u, target)) continue;
        u.order = { type: 'attack', target }; u.target = target; u.stopMove();
        if (!u.inRange(target)) u.chase(target);
      }
    }
    cmdStop(units) { for (const u of units) if (u.isUnit) { u.becomeIdle(); u.target = null; if (u.def.harvester) u.hstate = null; } }
    cmdHarvest(units, tx, ty) {
      for (const u of units) if (u.isUnit && u.def.harvester) { u.order = { type: 'idle' }; u.oreT = { tx, ty }; u.hstate = 'toOre'; u.tries = 0; u.moveTo((tx + 0.5) * T, (ty + 0.5) * T); }
    }
    cmdDock(units, ref) {
      for (const u of units) if (u.isUnit && u.def.harvester) { u.order = { type: 'idle' }; u.dockRef = ref; u.hstate = 'return'; }
    }
    cmdCapture(units, b) {
      for (const u of units) if (u.isUnit && u.def.engineer && !u.dead) { u.order = { type: 'capture', target: b, tries: 0 }; u.moveTo(b.x, b.y); }
    }
    cmdDeploy(units) {
      for (const u of units) if (u.isUnit && u.def.mcv) { u.order = { type: 'deploy' }; u.stopMove(); }
    }

    // ---- Kampf ----
    fireWeapon(src, w, t) {
      const tagMult = src.def.tags ? src.def.tags.reduce((a, tg) => a * (src.owner.mods.tagDmg[tg] || 1), 1) : 1;
      const dmg = w.dmg * src.owner.mods.dmg * tagMult * (src.isUnit ? src.dmgMult() : 1);
      const ang = src.isBuilding || w.turret ? src.turret : src.angle;
      const off = src.isBuilding ? 14 : (src.radius * 0.8);
      let mx = src.x + Math.cos(ang) * off, my = src.y + Math.sin(ang) * off - (src.alt || 0) - (src.isBuilding ? 10 : 0);
      const tx = t.x, ty = t.y - (t.alt || 0);
      const salvo = w.salvo || 1;
      this.sound(w.snd, src.x, src.y);
      for (let s = 0; s < salvo; s++) {
        const delay = s * 0.15;
        const P = { src, owner: src.owner, w, dmg, target: t, x: mx, y: my, sx: mx, sy: my, tx: tx + (salvo > 1 ? (Math.random() - 0.5) * 30 : 0), ty: ty + (salvo > 1 ? (Math.random() - 0.5) * 30 : 0), t: -delay, kind: w.proj };
        if (w.barrels === 2 && s === 0) {
          const px = Math.cos(ang + Math.PI / 2) * 5, py = Math.sin(ang + Math.PI / 2) * 5;
          this.fx({ k: 'flash', x: mx + px, y: my + py, life: 0.08, max: 0.08, r: 9 });
          this.fx({ k: 'flash', x: mx - px, y: my - py, life: 0.08, max: 0.08, r: 9 });
        }
        switch (w.proj) {
          case 'tracer':
            this.fx({ k: 'tracer', x1: mx, y1: my, x2: tx + (Math.random() - 0.5) * 8, y2: ty + (Math.random() - 0.5) * 8, life: 0.07, max: 0.07, c: w.wh === 'flak' ? '#fde68a' : '#fef08a' });
            if (w.wh === 'flak') this.fx({ k: 'p', x: tx + (Math.random() - 0.5) * 16, y: ty + (Math.random() - 0.5) * 16, vx: 0, vy: 0, life: 0.35, max: 0.35, size: 5, grow: 6, c: 'rgba(60,60,60,0.7)', smoke: true });
            this.damage(t, dmg, w.wh, src); break;
          case 'beam':
            this.fx({ k: 'beam', x1: mx, y1: my, x2: tx, y2: ty, life: 0.18, max: 0.18, c: w.color || '#f87171', w: w.width || 2 });
            this.fx({ k: 'flash', x: tx, y: ty, life: 0.15, max: 0.15, r: 8 + (w.width || 2) * 2, c: w.color });
            this.damage(t, dmg, w.wh, src); break;
          case 'flame':
            for (let k = 0; k < 3; k++) {
              const a = Math.atan2(ty - my, tx - mx) + (Math.random() - 0.5) * 0.35, sp = 90 + Math.random() * 50;
              this.fx({ k: 'p', x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55, max: 0.55, size: 4, grow: 10, c: '#fb923c', add: true });
            }
            this.damage(t, dmg, w.wh, src);
            if (w.splash) this.splash(tx, ty, w.splash * T, dmg * 0.4, w.wh, src, t);
            break;
          case 'claw':
            this.fx({ k: 'p', x: tx, y: ty, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 6, c: '#f0abfc', add: true });
            this.damage(t, dmg, w.wh, src); break;
          default:
            this.fx({ k: 'flash', x: mx, y: my, life: 0.08, max: 0.08, r: w.proj === 'arc' ? 12 : 8 });
            P.speed = { shell: 15, rocket: 9, arc: 7, acid: 8 }[w.proj] * T || 12 * T;
            if (w.proj === 'arc') { P.dur = Math.max(0.6, U.dist(mx, my, P.tx, P.ty) / P.speed); }
            if (w.proj === 'rocket') P.ang = ang + (Math.random() - 0.5) * 0.6;
            this.projectiles.push(P);
        }
      }
      if (src.isUnit) src.cloaked = false;
    }
    updateProjectiles(dt) {
      for (const p of this.projectiles) {
        p.t += dt; if (p.t < 0) continue;
        if (p.kind === 'arc') {
          const f = Math.min(1, p.t / p.dur);
          p.x = U.lerp(p.sx, p.tx, f); p.y = U.lerp(p.sy, p.ty, f); p.h = Math.sin(f * Math.PI) * Math.min(160, p.dur * 90);
          if (Math.random() < 0.6) this.fx({ k: 'p', x: p.x, y: p.y - p.h, vx: 0, vy: 0, life: 0.4, max: 0.4, size: 2.5, grow: 4, c: p.w.wh === 'acid' ? 'rgba(160,240,120,0.5)' : 'rgba(180,180,180,0.4)', smoke: true });
          if (f >= 1) { p.done = true; this.impact(p); }
          continue;
        }
        let tx = p.tx, ty = p.ty;
        if (p.target && !p.target.dead) { tx = p.target.x; ty = p.target.y - (p.target.alt || 0); p.tx = tx; p.ty = ty; }
        if (p.kind === 'rocket') {
          const want = Math.atan2(ty - p.y, tx - p.x);
          p.ang = U.rotateTowards(p.ang, want, 7 * dt);
          p.x += Math.cos(p.ang) * p.speed * dt; p.y += Math.sin(p.ang) * p.speed * dt;
          if (Math.random() < 0.8) this.fx({ k: 'p', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 2, grow: 5, c: 'rgba(200,200,200,0.45)', smoke: true });
          if (U.dist(p.x, p.y, tx, ty) < 10 || p.t > 3) { p.done = true; this.impact(p); }
        } else {
          const d = U.dist(p.x, p.y, tx, ty), step = p.speed * dt;
          if (d <= step) { p.x = tx; p.y = ty; p.done = true; this.impact(p); }
          else { p.x += (tx - p.x) / d * step; p.y += (ty - p.y) / d * step; }
        }
      }
      this.projectiles = this.projectiles.filter(p => !p.done);
    }
    impact(p) {
      const w = p.w;
      if (w.proj === 'arc') {
        this.splash(p.tx, p.ty, (w.splash || 1) * T, p.dmg, w.wh, p.src, null);
        this.explode(p.tx, p.ty, w.wh === 'acid' ? 14 : 18, false, w.wh === 'acid' ? 'acid' : null);
        this.sound('explode_s', p.tx, p.ty);
        return;
      }
      if (p.target && !p.target.dead) this.damage(p.target, p.dmg, w.wh, p.src);
      if (w.splash) this.splash(p.tx, p.ty, w.splash * T, p.dmg * 0.5, w.wh, p.src, p.target);
      if (w.proj === 'acid') this.fx({ k: 'p', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: 6, grow: 6, c: '#a3e635', add: true });
      else this.fx({ k: 'explo', x: p.x, y: p.y, r: w.proj === 'shell' ? 9 : 11, life: 0.35, max: 0.35 });
    }
    splash(x, y, r, dmg, wh, src, except) {
      this.queryRadius(x, y, r, (e) => {
        if (e === except || e.dead || e.isAir) return;
        if (src && !this.hostile(src.owner, e.owner)) return;
        const d = U.dist(x, y, e.x, e.y); const f = U.clamp(1 - d / (r + e.radius), 0.25, 1);
        this.damage(e, dmg * f, wh, src);
      });
    }
    damage(t, amount, wh, src) {
      if (t.dead || t.owner.neutral) return;
      const arm = t.isBuilding ? 'bld' : t.def.armor;
      const mult = (D.WARHEADS[wh] || D.WARHEADS.bullet)[arm];
      if (!mult) return;
      const dmg = amount * mult;
      t.hp -= dmg; t.lastHit = this.time;
      if (src && !src.dead) t.lastAttacker = src;
      if (t.owner.isHuman && src && this.hostile(src.owner, t.owner)) this.alertAttack(t);
      if (t.owner.aiLevel && src) this.emit('aiAttacked', t, src);
      if (t.isUnit && !t.target && src && !src.dead && t.order.type === 'idle' && RTS.combat.canAttack(t, src) && this.hostile(t.owner, src.owner)) t.target = src;
      if (t.hp <= 0) this.kill(t, src);
    }
    alertAttack(t) {
      const p = t.owner;
      if (this.time - p.lastAttackAlert < 15) return;
      p.lastAttackAlert = this.time;
      this.lastAlert = { x: t.x, y: t.y, t: this.time };
      this.alerts.push({ x: t.x, y: t.y, t: this.time });
      if (t.isBuilding) this.announce('baseattack', 'Unsere Basis wird angegriffen!', 'alert', 15);
      else if (t.def.harvester) this.announce('harvattack', 'Unser Sammler wird angegriffen!', 'alert', 15);
      else this.announce('unitattack', 'Einheiten unter Beschuss', 'alert', 15);
    }
    kill(e, src) {
      if (e.dead) return;
      const killer = src && !src.dead ? src : null;
      if (killer && killer.isUnit && this.hostile(killer.owner, e.owner)) killer.addXp(e.def.cost);
      if (src) { const ko = src.owner; if (this.hostile(ko, e.owner)) { if (e.isBuilding) ko.stats.bldKilled++; else ko.stats.kills++; } }
      if (e.isBuilding) {
        e.owner.stats.bldLost++;
        this.removeBuilding(e, false);
        this.sound('explode_b', e.x, e.y);
        for (let i = 0; i < e.w * e.h; i++) this.map.addScorch(e.tx * T + Math.random() * e.w * T, e.ty * T + Math.random() * e.h * T, 20);
        if (e.owner.isHuman) this.announce('bldlost', 'Gebäude verloren', 'warn', 4);
      } else {
        e.dead = true; e.owner.stats.unitsLost++;
        if (e.dockRef && e.dockRef.dockUser === e) e.dockRef.dockUser = null;
        if (e.def.cat === 'inf') {
          for (let i = 0; i < 6; i++) this.fx({ k: 'p', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50, life: 0.6, max: 0.6, size: 2, c: e.owner.faction === 'vael' ? '#a3e635' : '#7f1d1d' });
          this.sound('die', e.x, e.y);
        } else {
          this.explode(e.x, e.y - (e.alt || 0), e.radius * 1.4, e.radius > 16);
          if (!e.isAir) this.map.addScorch(e.x, e.y, e.radius * 1.4);
          this.sound(e.radius > 16 ? 'explode_b' : 'explode', e.x, e.y);
        }
        if (e.owner.isHuman && e.def.harvester) this.announce('harvlost', 'Sammler verloren', 'warn', 5);
      }
      this.emit('killed', e, src);
    }
    explode(x, y, r, big, kind) {
      this.fx({ k: 'explo', x, y, r, life: big ? 0.9 : 0.55, max: big ? 0.9 : 0.55, kind });
      const n = big ? 18 : 7;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, sp = (big ? 80 : 50) * Math.random() + 20;
        this.fx({ k: 'p', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.5 + Math.random() * 0.5, max: 1, size: big ? 4 : 3, c: kind === 'acid' ? '#bef264' : '#fdba74', add: true, grav: 60 });
      }
      for (let i = 0; i < (big ? 8 : 3); i++) this.fx({ k: 'p', x: x + (Math.random() - 0.5) * r, y: y + (Math.random() - 0.5) * r, vx: (Math.random() - 0.5) * 15, vy: -15 - Math.random() * 15, life: 1.6 + Math.random(), max: 2.6, size: r * 0.4, grow: r * 0.8, c: 'rgba(50,45,40,0.5)', smoke: true });
      if (big) this.emit('shake', Math.min(10, r / 6));
    }

    // ---- Ingenieure & Eroberung ----
    canCapture(u, b) {
      if (!b || !b.isBuilding || b.dead || b.built < 1) return false;
      if (b.owner.neutral) return true;
      if (b.owner === u.owner) return b.hp < b.maxHp - 1;
      return this.hostile(u.owner, b.owner) && b.hp < b.maxHp * 0.5;
    }
    engineerEnter(u, b) {
      if (!this.canCapture(u, b)) return false;
      u.dead = true; u.removed = true;
      if (b.owner === u.owner) {
        b.hp = b.maxHp;
        this.fx({ k: 'text', x: b.x, y: b.y - 24, txt: 'Repariert', c: '#86efac', life: 1.6, max: 1.6 });
        this.sound('sell', b.x, b.y);
      } else this.capture(b, u.owner);
      return true;
    }
    capture(b, p) {
      const old = b.owner;
      b.owner = p; b.target = null; b.repairing = false; b.rally = null; b.dockUser = null; b.empUntil = 0;
      b.refreshHp();
      if (b.hp < b.maxHp * 0.5) b.hp = b.maxHp * 0.5;
      for (const k in old.primary) if (old.primary[k] === b.id) delete old.primary[k];
      old.recountRoles(); old.recalcPower(); p.recountRoles(); p.recalcPower();
      if (!old.neutral) {
        old.stats.bldLost++;
        if (!old.has('yard')) for (const tab of ['base', 'defense']) { const q = old.queues[tab]; for (const it of q) old.credits += it.spent; q.length = 0; }
      }
      p.stats.captured = (p.stats.captured || 0) + 1;
      if (b.def.bonus && !b.bonusGiven) { b.bonusGiven = true; p.credits += b.def.bonus; this.fx({ k: 'text', x: b.x, y: b.y - 40, txt: '+' + b.def.bonus + ' $', c: '#86efac', life: 2, max: 2 }); }
      this.fx({ k: 'text', x: b.x, y: b.y - 24, txt: 'Erobert!', c: '#fde047', life: 2, max: 2 });
      this.fx({ k: 'ring', x: b.x, y: b.y, r: b.radius * 2, c: p.color, life: 0.8, max: 0.8 });
      this.sound('capture', b.x, b.y);
      if (p.isHuman) { b.seen = true; this.announce('captured', b.def.name + ' erobert', 'good', 1); }
      else if (old.isHuman) { this.lastAlert = { x: b.x, y: b.y, t: this.time }; this.alerts.push({ x: b.x, y: b.y, t: this.time }); this.announce('capturedlost', 'Unser Gebäude wurde erobert: ' + b.def.name, 'alert', 1); }
      this.map.oreVersion++;
      this.emit('captured', b, old);
    }

    // ---- Spezialfähigkeiten ----
    powerState(p, id) {
      const pw = D.POWERS[id];
      if (!pw || (pw.faction && pw.faction !== p.faction) || !p.has(pw.req)) return { available: false, ready: false, left: 0 };
      const left = Math.max(0, (p.powerReady[id] || 0) - this.time);
      return { available: true, ready: left <= 0, left, power: pw };
    }
    usePower(p, id, x, y) {
      const st = this.powerState(p, id), pw = D.POWERS[id];
      if (!st.available || !st.ready) return false;
      const m = this.map, tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (!m.inBounds(tx, ty)) return false;
      if (p.credits < pw.cost) { if (p.isHuman) this.announce('nocash', 'Unzureichende Mittel', 'warn', 2); return false; }
      if (id === 'drop') {
        const visOk = !p.isHuman || this.cfg.reveal || this.vis[ty * m.w + tx];
        if (!visOk || !m.passable(tx, ty, 0)) { if (p.isHuman) this.announce('badtarget', 'Ziel muss sichtbar und begehbar sein', 'warn', 1); return false; }
        this.pendingDrops.push({ x, y, t: 1.8, max: 1.8, owner: p, units: pw.units });
      } else if (id === 'scan') {
        this.scans.push({ x, y, r: pw.radius, until: this.time + pw.dur, team: p.team });
        this.updateFog();
      } else if (id === 'emp') {
        const R = pw.radius * T;
        this.queryRadius(x, y, R, (e) => {
          if (e.dead || !this.hostile(p, e.owner)) return;
          if (e.isUnit && e.def.cat === 'inf') return;
          e.empUntil = this.time + pw.dur;
          if (e.isUnit) { e.stopMove(); e.target = null; }
          if (pw.dmg) { e.hp = Math.max(1, e.hp - pw.dmg * (e.isBuilding ? 2 : 1)); e.lastHit = this.time; }
        });
        this.fx({ k: 'ring', x, y, r: R, c: '#93c5fd', life: 0.9, max: 0.9, fill: true });
        this.emit('shake', 6);
      } else if (id === 'heal') {
        const R = pw.radius * T;
        this.queryRadius(x, y, R, (e) => {
          if (e.dead || !this.allied(p, e.owner)) return;
          const add = e.maxHp * (e.isBuilding ? 0.25 : 0.6);
          if (e.hp < e.maxHp) { e.hp = Math.min(e.maxHp, e.hp + add); this.fx({ k: 'p', x: e.x, y: e.y - (e.alt || 0), vx: 0, vy: -22, life: 0.9, max: 0.9, size: 5, c: '#86efac', add: true }); }
        });
        this.fx({ k: 'ring', x, y, r: R, c: '#86efac', life: 1.1, max: 1.1, fill: true });
      }
      p.credits -= pw.cost; p.stats.spent += pw.cost;
      p.powerReady[id] = this.time + pw.cd;
      this.fx({ k: 'ring', x, y, r: pw.radius * T, c: pw.color, life: 0.7, max: 0.7 });
      this.sound('power', x, y);
      for (const o of this.players) if (o.isHuman && o !== p && this.hostile(o, p) && id !== 'scan' && (this.cfg.reveal || this.vis[ty * m.w + tx])) this.announce('enemypower', 'Feind setzt ' + pw.name + ' ein!', 'alert', 3);
      this.emit('power', p, id, x, y);
      return true;
    }
    updatePowers(dt) {
      for (const d of this.pendingDrops) {
        d.t -= dt;
        if (d.t <= 0 && !d.done) {
          d.done = true; let k = 0;
          for (const [uid, n] of d.units) for (let i = 0; i < n; i++) {
            const a = k * 1.3, r = (0.6 + (k % 3) * 0.7) * T; k++;
            const u = this.spawnUnitNear(uid, d.owner, d.x + Math.cos(a) * r, d.y + Math.sin(a) * r);
            if (u) { u.rank = 1; u.xp = u.def.cost; u.refreshHp(); u.hp = u.maxHp; this.fx({ k: 'p', x: u.x, y: u.y, vx: 0, vy: -8, life: 0.8, max: 0.8, size: 5, grow: 8, c: 'rgba(210,210,210,0.5)', smoke: true }); }
          }
          this.sound('place', d.x, d.y);
        }
      }
      if (this.pendingDrops.length) this.pendingDrops = this.pendingDrops.filter(d => !d.done);
      if (this.scans.length) this.scans = this.scans.filter(sc => sc.until > this.time);
    }

    // ---- Bonuskisten ----
    spawnCrate() {
      const m = this.map;
      for (let k = 0; k < 30; k++) {
        const tx = this.rng.int(3, m.w - 4), ty = this.rng.int(3, m.h - 4);
        if (!m.passable(tx, ty, 0) || m.ore[m.idx(tx, ty)]) continue;
        if (this.players.some(p => p.start && Math.hypot(p.start.tx - tx, p.start.ty - ty) < 10)) continue;
        const x = (tx + 0.5) * T, y = (ty + 0.5) * T;
        if (this.crates.some(c => U.dist(c.x, c.y, x, y) < 8 * T)) continue;
        this.crates.push({ x, y, born: this.time });
        return true;
      }
      return false;
    }
    updateCrates(dt) {
      if (!this.cfg.crates || this.mission) return;
      this.crateT -= dt;
      if (this.crateT <= 0) { this.crateT = 30 + this.rng.next() * 25; if (this.crates.length < 6) this.spawnCrate(); }
      this.cratePickT -= dt;
      if (this.cratePickT > 0 || !this.crates.length) return;
      this.cratePickT = 0.25;
      for (const c of this.crates) {
        let picker = null;
        this.queryRadius(c.x, c.y, 6, (e) => { if (!picker && e.isUnit && !e.isAir && !e.dead && !e.owner.neutral && !e.owner.defeated) picker = e; });
        if (picker) { c.taken = true; this.openCrate(c, picker); }
      }
      this.crates = this.crates.filter(c => !c.taken);
    }
    openCrate(c, u) {
      const p = u.owner, r = this.rng.next();
      let txt;
      const credits = () => { const v = 500 + Math.floor(this.rng.next() * 6) * 200; p.credits += v; return '+' + v + ' Credits'; };
      if (r < 0.45) txt = credits();
      else if (r < 0.63) {
        this.queryRadius(c.x, c.y, 6 * T, (e) => { if (e.isUnit && !e.dead && e.owner === p) e.hp = e.maxHp; });
        this.fx({ k: 'ring', x: c.x, y: c.y, r: 6 * T, c: '#86efac', life: 0.9, max: 0.9, fill: true });
        txt = 'Einheiten in der Nähe geheilt';
      } else if (r < 0.79) {
        if (u.def.weapons.length && u.rank < 3) { u.xp = Math.max(u.xp, u.def.cost * [1, 2.5, 5][u.rank]); u.addXp(0.01); txt = 'Beförderung!'; }
        else txt = credits();
      } else if (r < 0.91) {
        const id = { allianz: 'a_tank', schatten: 's_tank', vael: 'v_prism' }[p.faction];
        const n = this.spawnUnitNear(id, p, c.x, c.y);
        txt = n ? 'Verstärkung: ' + n.def.name : credits();
      } else if (p.isHuman && !this.cfg.reveal) {
        this.scans.push({ x: c.x, y: c.y, r: 16, until: this.time + 25, team: p.team });
        txt = 'Aufklärungsdaten: Gebiet aufgedeckt';
      } else txt = credits();
      this.fx({ k: 'text', x: c.x, y: c.y - 14, txt, c: '#fde047', life: 2.2, max: 2.2 });
      this.fx({ k: 'flash', x: c.x, y: c.y, r: 16, life: 0.3, max: 0.3, c: '#fde047' });
      this.sound('crate', c.x, c.y);
      if (p.isHuman) this.message('Bonuskiste: ' + txt, 'good');
      this.emit('crate', c, u, txt);
    }

    // ---- Superwaffen ----
    onSuperweaponBuilt(b) {
      for (const p of this.players) if (p.isHuman) {
        if (p === b.owner) this.announce('swbuilt', b.def.name + ' online. Ladevorgang gestartet.');
        else if (this.hostile(p, b.owner)) this.announce('swenemy', 'Feindliche Superwaffe entdeckt!', 'alert', 5);
      }
    }
    onSuperweaponReady(b) {
      if (b.owner.isHuman) this.announce('swready', b.owner.fdef.sw.name + ' bereit!', 'good');
      this.emit('swReady', b);
    }
    fireSuperweapon(b, x, y) {
      if (b.dead || b.charge < this.swTime) return false;
      b.charge = 0;
      const sw = b.owner.fdef.sw;
      this.pendingStrikes.push({ x, y, t: 4, sw, owner: b.owner, max: 4 });
      for (const p of this.players) if (p.isHuman) {
        if (p === b.owner) this.announce('swfire', sw.name + ' abgefeuert', 'good');
        else this.announce('swincoming', 'Warnung: Feindliche ' + sw.name + ' abgefeuert!', 'alert');
      }
      this.sound('swlaunch');
      return true;
    }
    updateStrikes(dt) {
      for (const s of this.pendingStrikes) {
        s.t -= dt;
        if (s.t <= 0 && !s.done) {
          s.done = true;
          const R = s.sw.radius * T;
          this.queryRadius(s.x, s.y, R, (e) => {
            if (e.dead) return;
            const d = U.dist(s.x, s.y, e.x, e.y); const f = U.clamp(1.15 - d / (R + e.radius), 0.2, 1);
            this.damage(e, s.sw.dmg * f, 'super', null);
          });
          for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = Math.random() * R; this.explode(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 30, true, s.sw.fx === 'rift' ? 'acid' : null); }
          for (let i = 0; i < 10; i++) this.map.addScorch(s.x + (Math.random() - 0.5) * R * 1.4, s.y + (Math.random() - 0.5) * R * 1.4, 40);
          this.fx({ k: 'swblast', x: s.x, y: s.y, r: R, fx: s.sw.fx, life: 1.6, max: 1.6 });
          this.emit('shake', 18);
          this.sound('swhit');
        }
      }
      this.pendingStrikes = this.pendingStrikes.filter(s => !s.done);
    }

    // ---- Nebel des Krieges ----
    updateFog() {
      if (!this.human) return;
      const m = this.map, w = m.w, h = m.h, vis = this.vis, exp = this.explored;
      vis.fill(0); this.fogVersion = (this.fogVersion || 0) + 1;
      const team = this.human.team;
      const mark = (x, y, r) => {
        const tx = Math.floor(x / T), ty = Math.floor(y / T), R = Math.ceil(r), r2 = r * r;
        for (let dy = -R; dy <= R; dy++) {
          const yy = ty + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = tx + dx; if (xx < 0 || xx >= w) continue;
            if (dx * dx + dy * dy <= r2) { const i = yy * w + xx; vis[i] = 1; exp[i] = 1; }
          }
        }
      };
      for (const u of this.units) if (!u.dead && u.owner.team === team) mark(u.x, u.y, u.def.sight);
      for (const b of this.buildings) if (!b.dead && b.owner.team === team) mark(b.x, b.y, b.def.sight + Math.max(b.w, b.h) / 2);
      for (const sc of this.scans) if (sc.team === team && sc.until > this.time) mark(sc.x, sc.y, sc.r);
      for (const b of this.buildings) if (!b.dead && !b.seen) {
        for (let y = b.ty; y < b.ty + b.h && !b.seen; y++) for (let x = b.tx; x < b.tx + b.w; x++) if (vis[y * w + x]) { b.seen = true; break; }
      }
      if (this.cfg.reveal) { for (const b of this.buildings) b.seen = true; }
    }
    updateCloak() {
      for (const u of this.units) {
        if (u.dead) continue;
        if (!u.isStealthy()) { u.cloaked = false; continue; }
        let det = false;
        this.queryRadius(u.x, u.y, 3.5 * T, (o) => { if (!det && !o.dead && this.hostile(o.owner, u.owner) && (o.isBuilding ? o.def.weapons.length || o.def.role === 'radar' : true)) det = true; });
        if (!det) for (const sc of this.scans) if (sc.team !== u.owner.team && U.dist(u.x, u.y, sc.x, sc.y) < sc.r * T) { det = true; break; }
        u.cloaked = !det;
      }
    }

    // ---- Hauptschleife ----
    update(dt) {
      if (this.over && this.result !== 'pending') { /* weiter animieren */ }
      this.time += dt; this.tickN++;
      this.rebuildHash();
      // Pfadsuchen begrenzen
      let budget = 10;
      while (this.pathQueue.length && budget-- > 0) this.pathQueue.shift().computePath();
      for (const p of this.players) if (!p.defeated) p.updateProduction(dt);
      for (const ai of this.ais) ai.update(dt);
      for (const u of this.units) if (!u.dead) u.update(dt);
      for (const b of this.buildings) if (!b.dead) b.update(dt);
      this.updateProjectiles(dt);
      this.updateStrikes(dt);
      this.updatePowers(dt);
      this.updateCrates(dt);
      // Effekte
      for (const e of this.effects) {
        e.life -= dt;
        if (e.k === 'p') { e.x += e.vx * dt; e.y += e.vy * dt; if (e.grav) e.vy += e.grav * dt; }
        else if (e.k === 'text') e.y -= 18 * dt;
      }
      this.effects = this.effects.filter(e => e.life > 0);
      if (this.tickN % 60 === 0) { this.units = this.units.filter(u => !u.dead); this.buildings = this.buildings.filter(b => !b.dead); }
      const tm = this.timers;
      tm.fog += dt; if (tm.fog >= 0.2) { tm.fog = 0; this.updateFog(); this.updateCloak(); }
      tm.ore += dt; if (tm.ore >= 2.5) { tm.ore = 0; this.map.growOre(this.rng); }
      tm.power += dt; if (tm.power >= 1) { tm.power = 0; for (const p of this.players) p.recalcPower(); }
      tm.check += dt; if (tm.check >= 1) { tm.check = 0; this.checkEnd(); }
      if (this.mission && this.mission.update) this.mission.update(this, dt);
    }
    playerAlive(p) {
      for (const b of this.buildings) if (!b.dead && b.owner === p) return true;
      for (const u of this.units) if (!u.dead && u.owner === p && (u.def.weapons.length || u.def.mcv)) return true;
      return false;
    }
    checkEnd() {
      if (this.over) return;
      for (const p of this.players) if (!p.defeated && !this.playerAlive(p)) {
        p.defeated = true;
        for (const u of this.units) if (u.owner === p && !u.dead) this.kill(u, null);
        if (!p.isHuman && this.human) this.message(p.name + ' wurde besiegt.', 'good');
      }
      if (this.mission && this.mission.check) {
        const r = this.mission.check(this);
        if (r) this.finish(r);
        return;
      }
      if (!this.human) {
        const teams = new Set(this.players.filter(p => !p.defeated).map(p => p.team));
        if (teams.size <= 1) this.finish('spectate');
        return;
      }
      if (this.human.defeated) return this.finish('lose');
      const enemies = this.players.filter(p => this.hostile(p, this.human) && !p.defeated);
      if (!enemies.length) this.finish('win');
    }
    finish(result) {
      if (this.over) return;
      this.over = true; this.result = result;
      this.emit('gameOver', result);
    }
  }

  RTS.Player = Player;
  RTS.Game = Game;
})();
