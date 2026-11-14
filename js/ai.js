'use strict';
// ===== Computergegner (Bot) =====
(function () {
  const U = RTS.util, D = RTS.data, T = U.TILE;

  const UNIT_WEIGHTS = {
    a_rifle: 3, a_rocket: 2.2, a_jeep: 1.5, a_tank: 4, a_arty: 1.2, a_epic: 1.4, a_air: 1,
    s_militia: 3, s_flamer: 2, s_rocket: 2.2, s_buggy: 2, s_tank: 4, s_arty: 1.3, s_epic: 1.3, s_air: 1,
    v_drone: 2.5, v_spitter: 3.2, v_glider: 2, v_prism: 4.2, v_spore: 1.2, v_epic: 1.4, v_air: 1,
    // Ingenieure und Flak werden gezielt nach Bedarf gebaut
    a_eng: 0, s_eng: 0, v_eng: 0, a_flak: 0, s_flak: 0, v_flak: 0,
  };

  class AI {
    constructor(game, player, level) {
      this.g = game; this.p = player; this.level = level; this.lv = D.DIFFICULTY[level] || D.DIFFICULTY.normal;
      player.incomeMult *= this.lv.income; player.buildSpeed *= this.lv.buildSpeed;
      this.t = Math.random(); this.rng = U.RNG(Math.floor(Math.random() * 1e9));
      this.waveSize = this.lv.wave0; this.waveN = 0;
      this.nextAttack = this.lv.firstAttack * (0.85 + Math.random() * 0.3);
      this.attackGroup = []; this.placeFails = 0; this.lastDefend = -99;
      this.opts = player.aiOpts || {};
      this.focus = null;
      game.on('aiAttacked', (t, src) => { if (t.owner === player) this.onAttacked(t, src); });
    }
    get base() {
      const yard = this.g.buildings.find(b => !b.dead && b.owner === this.p && b.def.role === 'yard');
      if (yard) return yard;
      return this.g.buildings.find(b => !b.dead && b.owner === this.p) || null;
    }
    bdef(role) { return D.BUILDINGS[this.p.faction + '_' + role]; }
    update(dt) {
      if (this.p.defeated) return;
      this.t += dt;
      if (this.t < this.lv.think) return;
      this.t = 0;
      try { this.think(); } catch (e) { console.error('KI-Fehler', e); }
    }
    think() {
      const g = this.g, p = this.p;
      const myUnits = g.units.filter(u => !u.dead && u.owner === p);
      // Bau-Fahrzeug aufbauen
      for (const u of myUnits) if (u.def.mcv && u.order.type !== 'deploy') {
        const spot = this.findSpotNear(this.bdef('yard'), Math.floor(u.x / T), Math.floor(u.y / T), 8, true);
        if (spot) { u.order = { type: 'deploy' }; u.moveTo((spot.tx + 1.5) * T, (spot.ty + 1.5) * T); }
      }
      if (!this.opts.noBuild) {
        this.manageRecovery(myUnits);
        this.manageConstruction();
        this.manageDefense();
      }
      if (!this.opts.noProduce) this.manageProduction(myUnits);
      this.manageResearch();
      this.manageRepair();
      this.manageArmy(myUnits);
      this.manageEngineers(myUnits);
      this.managePowers(myUnits);
      p.reserve = this.saveFor || 0;
      this.manageSuperweapon();
    }

    // ---- Bauen ----
    chooseBuilding() {
      const p = this.p, c = (r) => p.count(r), time = this.g.time, hard = this.level === 'hard' || this.level === 'brutal';
      const wants = [
        ['power', c('power') < 1],
        ['refinery', c('refinery') < 1 || this.noHarvesters],
        ['barracks', c('barracks') < 1],
        ['factory', c('factory') < 1],
        ['refinery', c('refinery') < 2],
        ['radar', c('radar') < 1],
        ['airfield', c('airfield') < 1 && this.level !== 'easy' && time > 200],
        ['tech', c('tech') < 1 && time > (hard ? 300 : 420) && this.level !== 'easy'],
        ['refinery', c('refinery') < 3 && hard && time > 360],
        ['barracks', c('barracks') < 2 && p.credits > 2500 && time > 400],
        ['factory', c('factory') < 2 && p.credits > 3500 && time > 500],
        ['sw', c('sw') < 1 && this.lv.sw && time > (hard ? 600 : 780) && p.credits > 800 && this.g.cfg.superweapons !== false],
      ];
      const margin = p.power.prod - p.power.use;
      for (const [role, cond] of wants) {
        if (!cond) continue;
        const d = this.bdef(role); if (!p.reqMet(d)) continue;
        if (d.power < 0 && margin + d.power < 4) return 'power';
        return role;
      }
      if (margin < 12 && c('power') < 10) return 'power';
      return null;
    }
    manageConstruction() {
      const g = this.g, p = this.p, q = p.queues.base;
      if (!p.has('yard')) return;
      if (q.length && q[0].ready) {
        const spot = this.findSpot(q[0].def);
        if (spot && g.tryPlaceFromQueue(p, 'base', spot.tx, spot.ty)) this.placeFails = 0;
        else if (++this.placeFails > 5) { p.credits += q[0].spent; q.shift(); this.placeFails = 0; }
        return;
      }
      if (!q.length) {
        const role = this.chooseBuilding();
        if (role) p.enqueue(this.bdef(role).id);
      }
    }
    manageDefense() {
      const g = this.g, p = this.p, q = p.queues.defense;
      if (!p.has('yard')) return;
      if (q.length && q[0].ready) {
        const spot = this.findSpot(q[0].def);
        if (!spot || !g.tryPlaceFromQueue(p, 'defense', spot.tx, spot.ty)) { p.credits += q[0].spent; q.shift(); }
        return;
      }
      if (q.length || p.credits < 1200 || g.time < 150) return;
      const towers = g.buildings.filter(b => !b.dead && b.owner === p && b.def.cat === 'defense');
      const limit = this.lv.defenses + Math.floor(g.time / 400);
      if (towers.length >= limit) return;
      const nAA = towers.filter(b => b.def.role === 'tower_aa').length, nAV = towers.filter(b => b.def.role === 'tower_av').length;
      const enemyAir = g.units.some(u => !u.dead && u.isAir && g.hostile(u.owner, p));
      let role = 'tower_mg';
      if (enemyAir && nAA < 2) role = 'tower_aa';
      else if (p.has('radar') && nAV <= towers.length / 2) role = 'tower_av';
      const d = this.bdef(role);
      if (p.reqMet(d) && (p.power.prod - p.power.use + d.power) >= 0) p.enqueue(d.id);
    }
    enemyDir() {
      const b = this.base; if (!b) return { x: 0, y: 0 };
      const e = this.g.players.filter(o => this.g.hostile(o, this.p) && !o.defeated && o.start);
      if (!e.length) return { x: 0, y: 0 };
      let bx = 0, by = 0; for (const o of e) { bx += o.start.tx; by += o.start.ty; }
      bx /= e.length; by /= e.length;
      const dx = bx - b.x / T, dy = by - b.y / T, d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
    findSpot(def) {
      const b = this.base; if (!b) return null;
      return this.findSpotNear(def, Math.floor(b.x / T), Math.floor(b.y / T), 16, false);
    }
    findSpotNear(def, cx, cy, R, noRadius) {
      const g = this.g, m = g.map, p = this.p;
      const dir = this.enemyDir();
      let best = null, bs = 1e9;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const tx = cx + dx - Math.floor(def.w / 2), ty = cy + dy - Math.floor(def.h / 2);
        if (!g.canPlace(p, def, tx, ty, { ignoreUnit: true, noRadius })) continue;
        // Rand frei lassen, damit Wege offen bleiben
        let ok = true;
        if (def.cat !== 'defense') {
          for (let y = ty - 1; y <= ty + def.h && ok; y++) for (let x = tx - 1; x <= tx + def.w; x++) {
            if (y >= ty && y < ty + def.h && x >= tx && x < tx + def.w) continue;
            if (!m.inBounds(x, y) || m.bld[m.idx(x, y)]) { ok = false; break; }
          }
          // Ausgang unten frei
          if (ok) for (let x = tx; x < tx + def.w; x++) if (!m.passable(x, ty + def.h, 0) || !m.passable(x, ty + def.h + 1, 0)) { ok = false; break; }
        }
        if (!ok) continue;
        const d = Math.hypot(dx, dy);
        let s = d + this.rng.next() * 1.5;
        if (def.role === 'refinery') {
          let od = 1e9; for (const f of m.oreCenters) { if (m.ore[m.idx(U.clamp(f.tx, 0, m.w - 1), U.clamp(f.ty, 0, m.h - 1))] === 0 && !m.blossoms.some(bl => bl.tx === f.tx && bl.ty === f.ty)) continue; od = Math.min(od, Math.hypot(f.tx - (tx + 1), f.ty - (ty + 1))); }
          s = od * 2 + d * 0.3;
        } else if (def.cat === 'defense') {
          const want = 7 + (this.rng.next() * 3);
          const ex = cx + dir.x * want, ey = cy + dir.y * want;
          s = Math.hypot(tx - ex, ty - ey) * 1.5 + this.rng.next() * 4;
        } else if (def.role === 'power') s = d * 0.8 - (dir.x * dx + dir.y * dy) * 0.6; // Kraftwerke nach hinten
        if (s < bs) { bs = s; best = { tx, ty }; }
      }
      if (best && !g.canPlace(p, def, best.tx, best.ty, { noRadius })) return null;
      return best;
    }

    // ---- Produktion ----
    pickUnit(cat) {
      const p = this.p; const items = D.itemsFor(p.faction, cat).filter(u => !u.harvester && !u.mcv && p.reqMet(u) && UNIT_WEIGHTS[u.id] !== 0);
      if (!items.length) return null;
      let tot = 0; const ws = items.map(u => { let w = UNIT_WEIGHTS[u.id] != null ? UNIT_WEIGHTS[u.id] : 1; if (this.g.time < 300 && u.cost > 1500) w *= 0.3; tot += w; return w; });
      let r = this.rng.next() * tot;
      for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    }
    manageProduction(myUnits) {
      const p = this.p, f = p.faction[0];
      const harvs = myUnits.filter(u => u.def.harvester).length;
      const refs = p.count('refinery');
      const wantH = Math.min(7, refs + Math.min(refs, this.level === 'easy' ? 0 : 2));
      const vq = p.queues.veh;
      if (p.has('factory') && harvs + vq.filter(i => i.def.harvester).length < wantH && vq.length < 3) p.enqueue(f + '_harv');
      if (!p.has('yard') && p.has('factory') && p.credits > 3500 && !myUnits.some(u => u.def.mcv) && !vq.some(i => i.def.mcv)) p.enqueue(f + '_mcv');
      // Mobile Flugabwehr nach Bedarf
      const enemyAir = this.g.units.reduce((n, u) => n + (!u.dead && u.isAir && this.g.hostile(u.owner, p) ? 1 : 0), 0);
      if (enemyAir && p.has('factory') && vq.length < 3) {
        const isFlak = (d) => d.id === f + '_flak';
        const flaks = myUnits.filter(u => isFlak(u.def)).length + vq.filter(i => isFlak(i.def)).length;
        if (flaks < Math.min(4, 1 + Math.floor(enemyAir / 2))) p.enqueue(f + '_flak');
      }
      if (this.saveFor && p.credits < this.saveFor) return; // für Spezialfähigkeit sparen
      const army = myUnits.filter(u => u.def.weapons.length).length;
      const cap = this.opts.armyCap || (this.level === 'easy' ? 25 : 60);
      if (army >= cap) return;
      const reserve = p.queues.base.length ? 0 : 0;
      if (p.has('barracks') && p.queues.inf.length < 2 && p.credits > 300 + reserve) { const u = this.pickUnit('inf'); if (u) p.enqueue(u.id); }
      if (p.has('factory') && vq.length < 2 && p.credits > 800 + reserve) { const u = this.pickUnit('veh'); if (u) p.enqueue(u.id); }
      if (p.has('airfield') && p.queues.air.length < 1 && p.credits > 1600 && this.rng.chance(0.4)) { const u = this.pickUnit('air'); if (u) p.enqueue(u.id); }
    }
    manageResearch() {
      const p = this.p;
      if (!this.lv.research || p.queues.research.length || p.credits < 200 || this.g.time < 360 || this.saveFor) return;
      const opts = D.itemsFor(p.faction, 'research').filter(r => !p.researched.has(r.id) && p.reqMet(r));
      if (opts.length) p.enqueue(this.rng.pick(opts).id);
    }
    manageRepair() {
      const p = this.p; if (p.credits < 400) return;
      for (const b of this.g.buildings) if (!b.dead && b.owner === p && b.built >= 1 && !b.repairing && b.hp < b.maxHp * 0.65 && this.g.time - b.lastHit > 3) b.repairing = true;
    }

    // ---- Armee ----
    onAttacked(t, src) {
      const g = this.g;
      if (!src || src.dead || g.time - this.lastDefend < 4) return;
      if (!(t.isBuilding || t.def.harvester)) return;
      this.lastDefend = g.time;
      const b = this.base; if (!b) return;
      const defenders = g.units.filter(u => !u.dead && u.owner === this.p && u.def.weapons.length && !this.attackGroup.includes(u) && U.dist(u.x, u.y, b.x, b.y) < 30 * T);
      if (defenders.length) g.cmdMove(defenders, src.x, src.y, true);
    }
    pickTarget(fromX, fromY) {
      const g = this.g, p = this.p;
      const enemies = g.players.filter(o => g.hostile(o, p) && !o.defeated);
      if (!enemies.length) return null;
      if (!this.focus || this.focus.defeated || !enemies.includes(this.focus)) {
        // bevorzugt menschliche Spieler leicht, sonst nächster Gegner
        const b = this.base;
        let best = null, bs = 1e9;
        for (const e of enemies) {
          const s = e.start ? U.dist(b ? b.x : fromX, b ? b.y : fromY, (e.start.tx) * T, (e.start.ty) * T) : 0;
          const score = s * (e.isHuman ? 0.8 : 1) * (0.8 + this.rng.next() * 0.5);
          if (score < bs) { bs = score; best = e; }
        }
        this.focus = best;
      }
      const tgts = g.buildings.filter(b => !b.dead && b.owner === this.focus);
      const pool = tgts.length ? tgts : g.units.filter(u => !u.dead && u.owner === this.focus);
      let best = null, bd = 1e18;
      for (const e of pool) { const d = U.dist2(fromX, fromY, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      return best;
    }
    manageArmy(myUnits) {
      const g = this.g, p = this.p;
      this.attackGroup = this.attackGroup.filter(u => !u.dead);
      const army = myUnits.filter(u => u.def.weapons.length && !u.def.harvester && !this.attackGroup.includes(u));
      const b = this.base;
      // Angriffswelle
      const overdue = g.time >= this.nextAttack + 150 && army.length >= Math.min(this.waveSize, 8);
      if (!this.opts.noAttack && g.time >= this.nextAttack && (army.length >= this.waveSize || overdue)) {
        const cx = army.reduce((a, u) => a + u.x, 0) / army.length, cy = army.reduce((a, u) => a + u.y, 0) / army.length;
        const tgt = this.pickTarget(cx, cy);
        if (tgt) {
          // Auf niedrigen Stufen bleibt ein Teil der Armee als Verteidigung zurück
          const capF = { easy: 1, normal: 1.6, hard: 3 }[this.level];
          let wave = army;
          if (capF && army.length > this.waveSize * capF) {
            wave = army.slice().sort((a, b2) => U.dist2(a.x, a.y, tgt.x, tgt.y) - U.dist2(b2.x, b2.y, tgt.x, tgt.y)).slice(0, Math.ceil(this.waveSize * capF));
          }
          g.cmdMove(wave, tgt.x, tgt.y, true);
          this.attackGroup.push(...wave);
          this.waveN++; this.waveSize = Math.min(26, this.waveSize + this.lv.waveGrow);
          this.nextAttack = g.time + (this.level === 'easy' ? 160 : this.level === 'normal' ? 120 : 90) * (0.8 + this.rng.next() * 0.4);
        }
      }
      // Angreifer ohne Ziel weiterschicken
      for (const u of this.attackGroup) {
        if (u.order.type === 'idle' && !u.target) {
          const tgt = this.pickTarget(u.x, u.y);
          if (tgt) g.cmdMove([u], tgt.x + (this.rng.next() - 0.5) * 3 * T, tgt.y + (this.rng.next() - 0.5) * 3 * T, true);
        }
      }
      // Restarmee sammeln
      if (b) {
        const dir = this.enemyDir();
        const rx = b.x + dir.x * 7 * T, ry = b.y + dir.y * 7 * T;
        const idle = army.filter(u => u.order.type === 'idle' && !u.target && U.dist(u.x, u.y, rx, ry) > 6 * T && !u.isAir);
        if (idle.length) g.cmdMove(idle, rx, ry, true);
      }
    }
    // Notlage: ohne Raffinerie/Sammler und ohne Geld Gebäude verkaufen, um die Wirtschaft neu aufzubauen
    manageRecovery(myUnits) {
      const g = this.g, p = this.p;
      const harv = myUnits.some(u => u.def.harvester) || p.queues.veh.some(i => i.def.harvester);
      const refs = p.count('refinery');
      // Raffinerie ohne Sammler und ohne Fabrik: eine neue Raffinerie bringt einen Sammler mit
      this.noHarvesters = !harv && refs > 0 && !p.has('factory') && refs < 3;
      if (!p.has('yard')) return;
      let need = 0;
      if (refs === 0 || this.noHarvesters) need = this.bdef('refinery').cost;
      else if (!harv) need = D.UNITS[p.faction[0] + '_harv'].cost;
      if (!need || p.credits >= need) return;
      if (g.buildings.some(b => !b.dead && b.owner === p && b.def.income)) return; // Bohrer liefern noch Einnahmen
      const order = ['tower_mg', 'tower_aa', 'tower_av', 'airfield', 'sw', 'tech', 'radar', 'barracks', 'factory'];
      for (const role of order) {
        const b = g.buildings.find(x => !x.dead && x.owner === p && x.def.role === role && x.built >= 1);
        if (b) { g.sell(b); return; }
      }
    }
    // Ingenieure erobern neutrale Gebäude in Reichweite der Basis
    manageEngineers(myUnits) {
      const g = this.g, p = this.p, base = this.base;
      if (!base || this.opts.noProduce) return;
      const neutrals = g.buildings.filter(b => !b.dead && b.owner.neutral);
      if (!neutrals.length) return;
      const engs = myUnits.filter(u => u.def.engineer);
      const taken = new Set(engs.filter(u => u.order.type === 'capture').map(u => u.order.target));
      const cands = neutrals.filter(b => !taken.has(b) && U.dist(b.x, b.y, base.x, base.y) < 48 * T)
        .sort((a, b) => U.dist2(a.x, a.y, base.x, base.y) - U.dist2(b.x, b.y, base.x, base.y));
      for (const e of engs) if (e.order.type !== 'capture') { const t = cands.shift(); if (t) g.cmdCapture([e], t); }
      const easy = this.level === 'easy', q = p.queues.inf;
      const have = engs.length + q.filter(i => i.def.engineer).length;
      if (cands.length && g.time > (easy ? 300 : 110) && p.has('barracks') && have < Math.min(easy ? 1 : 2, cands.length) && p.credits > 600 && q.length < 3) p.enqueue(p.faction[0] + '_eng');
    }
    // Spezialfähigkeit der Fraktion (ab Stufe Normal). Bei Bedarf wird kurz dafür gespart.
    managePowers(myUnits) {
      this.saveFor = 0;
      if (!this.lv.sw) return;
      const g = this.g, p = this.p, m = g.map;
      const id = { allianz: 'drop', schatten: 'emp', vael: 'heal' }[p.faction];
      const st = g.powerState(p, id);
      if (!st.available || !st.ready) return;
      const cost = st.power.cost;
      const use = (x, y) => { if (p.credits >= cost) g.usePower(p, id, x, y); else this.saveFor = cost + 50; };
      if (id === 'heal') {
        const hurt = myUnits.filter(u => u.def.weapons.length && u.hp < u.maxHp * 0.7);
        if (hurt.length < 4) return;
        const R = st.power.radius * T; let best = null, bn = 0;
        for (const u of hurt) { let n = 0; for (const o of hurt) if (U.dist(u.x, u.y, o.x, o.y) < R) n++; if (n > bn) { bn = n; best = u; } }
        if (bn >= 3) use(best.x, best.y);
        return;
      }
      const grp = this.attackGroup;
      const dropAt = (x, y) => { const t = m.nearestPassable(Math.floor(x / T), Math.floor(y / T), 0, 8); if (t) use((t.tx + 0.5) * T, (t.ty + 0.5) * T); };
      if (grp.length >= 5) {
        const cx = grp.reduce((a, u) => a + u.x, 0) / grp.length, cy = grp.reduce((a, u) => a + u.y, 0) / grp.length;
        // EMP erst kurz vor dem Kontakt zünden, sonst verpufft er vor der Ankunft
        let tgt = null, bd = (id === 'emp' ? 9 : 16) * T;
        for (const b of g.buildings) {
          if (b.dead || !g.hostile(p, b.owner)) continue;
          let d = U.dist(cx, cy, b.x, b.y); if (id === 'emp' && b.def.weapons.length) d -= 3 * T;
          if (d < bd) { bd = d; tgt = b; }
        }
        if (tgt) {
          if (id === 'emp') use(tgt.x, tgt.y);
          else { const a = Math.atan2(cy - tgt.y, cx - tgt.x); dropAt(tgt.x + Math.cos(a) * 4 * T, tgt.y + Math.sin(a) * 4 * T); }
          return;
        }
      }
      // Luftlandung zur Verteidigung der Basis
      if (id === 'drop' && g.time - this.lastDefend < 4 && this.base) dropAt(this.base.x, this.base.y + 3 * T);
    }
    manageSuperweapon() {
      const g = this.g, p = this.p;
      for (const b of g.buildings) {
        if (b.dead || b.owner !== p || !b.def.sw || b.charge < g.swTime) continue;
        let best = null, bs = -1;
        for (const e of g.buildings) {
          if (e.dead || !g.hostile(p, e.owner)) continue;
          let s = 0; for (const o of g.buildings) if (!o.dead && o.owner === e.owner && U.dist(o.x, o.y, e.x, e.y) < 4 * T) s += o.def.cost;
          if (s > bs) { bs = s; best = e; }
        }
        if (best) g.fireSuperweapon(b, best.x, best.y);
      }
    }
  }
  AI.UNIT_WEIGHTS = UNIT_WEIGHTS;
  RTS.AI = AI;
})();
