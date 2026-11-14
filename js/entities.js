'use strict';
// ===== Einheiten und Gebäude =====
(function () {
  const U = RTS.util, D = RTS.data, T = U.TILE;
  const RANK_DMG = [1, 1.15, 1.3, 1.5], RANK_HP = [1, 1.1, 1.2, 1.3];

  // Gemeinsame Kampflogik
  function weaponCanHit(w, t) { return t.isAir ? (w.targets !== 'ground') : (w.targets !== 'air'); }
  function canAttack(e, t) { for (const w of e.def.weapons) if (weaponCanHit(w, t)) return true; return false; }
  function maxRangeVs(e, t) { let r = 0; for (const w of e.def.weapons) if (weaponCanHit(w, t)) r = Math.max(r, w.range); return r * T; }
  function targetDist(e, t) { return Math.max(0, U.dist(e.x, e.y, t.x, t.y) - t.radius * 0.8); }

  function acquireTarget(e, range) {
    const g = e.game; let best = null, bs = 1e9;
    g.queryRadius(e.x, e.y, range + 64, (o) => {
      if (o.dead || o === e || !g.hostile(e.owner, o.owner)) return;
      if (!canAttack(e, o) || !g.canSee(e.owner, o)) return;
      const d = targetDist(e, o); if (d > range) return;
      let s = d;
      const arm = o.isBuilding ? 'bld' : o.def.armor;
      let eff = 0; for (const w of e.def.weapons) if (weaponCanHit(w, o)) eff = Math.max(eff, D.WARHEADS[w.wh][arm] || 0);
      if (eff <= 0.01) return;
      s = s / (0.35 + eff);
      if (o.isBuilding) s += o.def.weapons.length ? 2 * T : 6 * T;
      else if (o.def.weapons.length === 0) s += 2.5 * T;
      if (e.minRangePx && d < e.minRangePx) s += 30 * T;
      if (s < bs) { bs = s; best = o; }
    });
    return best;
  }

  function aimAndFire(e, dt, t) {
    const g = e.game; let fired = false;
    const desired = Math.atan2(t.y - e.y, t.x - e.x);
    const d = targetDist(e, t);
    for (let i = 0; i < e.def.weapons.length; i++) {
      const w = e.def.weapons[i];
      if (!weaponCanHit(w, t)) continue;
      if (d > w.range * T || (w.minRange && d < w.minRange * T)) continue;
      let aligned;
      if (e.isBuilding) {
        if (w.turret) { e.turret = U.rotateTowards(e.turret, desired, 4 * dt); aligned = Math.abs(U.angDiff(e.turret, desired)) < 0.15; }
        else aligned = true;
      } else if (w.turret && e.def.cat === 'veh') {
        e.turret = U.rotateTowards(e.turret, desired, 4.5 * dt); aligned = Math.abs(U.angDiff(e.turret, desired)) < 0.15;
      } else if (e.def.cat === 'inf') {
        e.angle = desired; e.turret = desired; aligned = true;
      } else {
        // Flugzeuge / Fahrzeuge ohne Turm drehen den Rumpf
        if (!e.path) e.angle = U.rotateTowards(e.angle, desired, e.def.turn * dt);
        e.turret = e.angle; aligned = Math.abs(U.angDiff(e.angle, desired)) < 0.5;
      }
      if (aligned && e.cds[i] <= 0) {
        e.cds[i] = w.cd * (0.9 + Math.random() * 0.2);
        e.lastFired = g.time;
        g.fireWeapon(e, w, t);
        fired = true;
      }
    }
    return fired;
  }

  // ================= Einheit =================
  class Unit {
    constructor(game, def, owner, x, y) {
      this.game = game; this.id = game.nextId++; this.def = def; this.owner = owner;
      this.x = x; this.y = y; this.px = x; this.py = y;
      this.isUnit = true; this.isAir = def.cat === 'air'; this.mode = def.hover ? 1 : 0;
      this.angle = Math.PI / 2; this.turret = this.angle;
      this.rank = 0; this.xp = 0;
      this.maxHp = def.hp * this.hpMult(); this.hp = this.maxHp;
      this.radius = def.size;
      this.order = { type: 'idle' }; this.guardX = x; this.guardY = y;
      this.path = null; this.pathI = 0; this.goalX = x; this.goalY = y; this.pathPending = false;
      this.target = null; this.cds = def.weapons.map(() => Math.random() * 0.5);
      this.thinkT = Math.random() * 0.3; this.lastFired = -99; this.lastHit = -99; this.lastAttacker = null;
      this.stuckT = 0; this.stuckX = x; this.stuckY = y; this.stuckN = 0;
      this.cargo = 0; this.hstate = def.harvester ? 'seek' : null; this.oreT = null; this.dockRef = null; this.harvT = 0;
      this.anim = Math.random() * 10; this.cloaked = false; this.moving = false;
      this.alt = this.isAir ? 34 : 0;
      this.dead = false; this.selected = false;
      this.minRangePx = def.weapons.length && def.weapons.every(w => w.minRange) ? Math.min(...def.weapons.map(w => w.minRange)) * T : 0;
    }
    hpMult() { const m = this.owner.mods; return (m.hp[this.def.armor] || 1) * RANK_HP[this.rank]; }
    get baseSpeed() { const m = this.owner.mods; return this.def.speed * T * (m.speed[this.def.armor] || 1) * (m.speed.all || 1) * (this.speedMult || 1); }
    get speed() {
      const s = this.baseSpeed;
      // Formationsbewegung: Gruppe hält das Tempo der langsamsten Einheit, bis gekämpft wird
      if (this.groupSpeed && this.order.type === 'amove' && !this.target) return Math.min(s, this.groupSpeed);
      return s;
    }
    get value() { return this.def.cost; }
    refreshHp() { const r = this.hp / this.maxHp; this.maxHp = this.def.hp * this.hpMult(); this.hp = this.maxHp * r; }
    addXp(v) {
      if (this.def.harvester || this.def.mcv || this.rank >= 3) return;
      this.xp += v; const c = this.def.cost;
      const nr = this.xp >= c * 5 ? 3 : this.xp >= c * 2.5 ? 2 : this.xp >= c ? 1 : 0;
      if (nr > this.rank) { this.rank = nr; this.refreshHp(); this.game.fx({ k: 'text', x: this.x, y: this.y - 20, txt: '★'.repeat(nr), c: '#facc15', life: 1.5, max: 1.5 }); if (this.owner.isHuman) this.game.sound('rankup', this.x, this.y); }
    }
    dmgMult() { return RANK_DMG[this.rank]; }
    isStealthy() {
      if (this.def.stealth) return this.game.time - this.lastFired > 3;
      if (this.owner.mods.stealthVeh && this.def.cat === 'veh' && !this.def.harvester) return this.game.time - this.lastFired > 3 && !this.moving;
      return false;
    }

    // ---- Bewegung ----
    moveTo(x, y) {
      this.goalX = x; this.goalY = y; this.stuckN = 0;
      if (this.isAir) { this.path = [{ x, y }]; this.pathI = 0; this.pathPending = false; return; }
      const pf = this.game.pf;
      if (U.dist(this.x, this.y, x, y) < T * 10 && this.game.map.passablePx(x, y, this.mode) && pf.lineClear(this.x, this.y, x, y, this.mode)) {
        this.path = [{ x, y }]; this.pathI = 0; this.pathPending = false; return;
      }
      if (!this.pathPending) { this.pathPending = true; this.game.pathQueue.push(this); }
    }
    computePath() {
      this.pathPending = false; if (this.dead) return;
      const p = this.game.pf.find(this.x, this.y, this.goalX, this.goalY, this.mode);
      if (p && p.length) { this.path = p; this.pathI = 0; } else this.path = null;
    }
    stopMove() { this.path = null; this.pathPending = false; this.moving = false; }
    becomeIdle() { this.order = { type: 'idle' }; this.guardX = this.x; this.guardY = this.y; this.stopMove(); }

    update(dt) {
      this.px = this.x; this.py = this.y; this.anim += dt;
      const g = this.game;
      if (this.empUntil > g.time) { this.moving = false; if (this.isAir) this.anim -= dt * 0.8; return; } // lahmgelegt
      let regen = this.owner.mods.regen + (this.rank >= 3 ? 0.015 : 0);
      if (regen > 0 && this.hp < this.maxHp && g.time - this.lastHit > 2.5) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * regen * dt);
      for (let i = 0; i < this.cds.length; i++) this.cds[i] -= dt;
      this.thinkT -= dt;
      if (this.thinkT <= 0) { this.thinkT = 0.25; this.think(); }
      if (this.target && !this.target.dead && this.def.weapons.length) aimAndFire(this, dt, this.target);
      else if (this.def.cat === 'veh') this.turret = U.rotateTowards(this.turret, this.angle, 2 * dt);
      this.move(dt);
    }

    think() {
      const g = this.game;
      if (this.def.harvester) return this.harvThink();
      if (this.def.mcv && this.order.type === 'deploy') { if (!this.path && !this.pathPending) { g.deployMcv(this); } return; }
      const o = this.order;
      if (this.def.engineer && o.type === 'capture') {
        const t = o.target;
        if (!g.canCapture(this, t)) { this.becomeIdle(); return; }
        const d = targetDist(this, t);
        if (d < T * 0.95) { g.engineerEnter(this, t); return; }
        if (!this.path && !this.pathPending) {
          if (d < T * 2.4 || ++o.tries > 5) { if (d < T * 2.4) g.engineerEnter(this, t); else this.becomeIdle(); }
          else this.moveTo(t.x, t.y);
        }
        return;
      }
      if (this.target && (this.target.dead || !g.canSee(this.owner, this.target))) this.target = null;
      if (!this.def.weapons.length) { if (o.type === 'move' && !this.path && !this.pathPending) this.becomeIdle(); return; }
      const sight = this.def.sight * T;
      switch (o.type) {
        case 'idle': {
          if (!this.target) this.target = acquireTarget(this, sight);
          const t = this.target;
          if (t) {
            if (!canAttack(this, t)) { this.target = null; break; }
            const leash = sight + 4 * T;
            if (this.inRange(t)) this.stopMove();
            else if (U.dist(this.guardX, this.guardY, t.x, t.y) < leash) this.chase(t);
            else { this.target = null; this.moveTo(this.guardX, this.guardY); }
          } else if (!this.path && !this.pathPending && U.dist(this.x, this.y, this.guardX, this.guardY) > 3 * T) {
            this.moveTo(this.guardX, this.guardY);
          }
          break;
        }
        case 'move': {
          if (!this.path && !this.pathPending) { this.becomeIdle(); break; }
          // feuern während der Fahrt, wenn möglich
          if (this.def.weapons.some(w => w.turret) || this.isAir) {
            if (!this.target || !this.inRange(this.target)) this.target = acquireTarget(this, maxRangeAny(this));
          } else this.target = null;
          break;
        }
        case 'amove': {
          if (this.target && U.dist(this.x, this.y, this.target.x, this.target.y) > sight + 3 * T) this.target = null;
          if (!this.target) this.target = acquireTarget(this, sight);
          const t = this.target;
          if (t) { if (this.inRange(t)) this.stopMove(); else this.chase(t); }
          else {
            const atGoal = this.goalX === o.x && this.goalY === o.y;
            if (!atGoal) this.moveTo(o.x, o.y);
            else if (!this.path && !this.pathPending) {
              o.tries = (o.tries || 0) + 1;
              if (U.dist(this.x, this.y, o.x, o.y) > T * 1.5 && o.tries < 4) this.moveTo(o.x, o.y);
              else this.becomeIdle();
            }
          }
          break;
        }
        case 'attack': {
          const t = o.target;
          if (!t || t.dead || !g.canSee(this.owner, t) || !canAttack(this, t)) { this.becomeIdle(); break; }
          this.target = t;
          if (this.inRange(t)) this.stopMove(); else this.chase(t);
          break;
        }
        default: this.becomeIdle();
      }
    }
    inRange(t) {
      const d = targetDist(this, t);
      for (const w of this.def.weapons) if (weaponCanHit(w, t) && d <= w.range * T && !(w.minRange && d < w.minRange * T)) return true;
      return false;
    }
    // Ziel liegt innerhalb der Mindestreichweite aller passenden Waffen (Artillerie)
    tooClose(t) {
      const d = targetDist(this, t); let any = false;
      for (const w of this.def.weapons) if (weaponCanHit(w, t)) { if (!(w.minRange && d < w.minRange * T)) return false; any = true; }
      return any;
    }
    chase(t) {
      if (this.pathPending) return;
      if (this.tooClose(t)) {
        // Abstand gewinnen statt in den Gegner hineinzufahren
        if (!this.path) {
          let mr = 0; for (const w of this.def.weapons) mr = Math.max(mr, w.minRange || 0);
          const a = Math.atan2(this.y - t.y, this.x - t.x), r = (mr + 1.5) * T + t.radius;
          const x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r;
          if (this.game.map.passablePx(x, y, this.mode)) this.moveTo(x, y);
        }
        return;
      }
      if (!this.path || U.dist(this.goalX, this.goalY, t.x, t.y) > T * 1.5) {
        if (this.isAir) {
          // Flugzeuge nähern sich bis auf Reichweite
          const a = Math.atan2(this.y - t.y, this.x - t.x), r = maxRangeVs(this, t) * 0.75;
          this.moveTo(t.x + Math.cos(a) * r, t.y + Math.sin(a) * r);
        } else this.moveTo(t.x, t.y);
      }
    }

    move(dt) {
      const g = this.game, m = g.map;
      if (this.isAir) {
        let vx = 0, vy = 0;
        if (this.path) {
          const wp = this.path[this.pathI]; const dx = wp.x - this.x, dy = wp.y - this.y, d = Math.hypot(dx, dy);
          if (d < 6) { this.path = null; this.moving = false; }
          else {
            const desired = Math.atan2(dy, dx); this.angle = U.rotateTowards(this.angle, desired, this.def.turn * dt);
            const f = Math.max(0.25, Math.cos(U.angDiff(this.angle, desired)));
            const sp = Math.min(this.speed * f, d / dt);
            vx = Math.cos(this.angle) * sp; vy = Math.sin(this.angle) * sp; this.moving = true;
          }
        } else this.moving = false;
        // Abstand zu anderen Flugzeugen
        g.queryRadius(this.x, this.y, 40, (o) => {
          if (o === this || !o.isAir) return;
          const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy) || 1, min = this.radius + o.radius;
          if (d < min) { vx += dx / d * 40; vy += dy / d * 40; }
        });
        this.x = U.clamp(this.x + vx * dt, 8, m.w * T - 8); this.y = U.clamp(this.y + vy * dt, 8, m.h * T - 8);
        return;
      }
      let vx = 0, vy = 0;
      if (this.path) {
        const wp = this.path[this.pathI];
        const dx = wp.x - this.x, dy = wp.y - this.y, d = Math.hypot(dx, dy);
        const last = this.pathI === this.path.length - 1;
        if (d < (last ? 4 : 14)) {
          this.pathI++;
          if (this.pathI >= this.path.length) { this.path = null; this.moving = false; }
        } else {
          const desired = Math.atan2(dy, dx);
          let sp = this.speed;
          if (this.def.cat === 'veh') {
            this.angle = U.rotateTowards(this.angle, desired, this.def.turn * dt);
            const f = Math.cos(U.angDiff(this.angle, desired));
            sp *= f < 0.6 ? 0.12 : f;
            vx = Math.cos(this.angle) * sp; vy = Math.sin(this.angle) * sp;
          } else { this.angle = desired; vx = Math.cos(desired) * sp; vy = Math.sin(desired) * sp; }
          if (last) { const lim = d / dt; const s = Math.hypot(vx, vy); if (s > lim) { vx *= lim / s; vy *= lim / s; } }
          this.moving = true;
        }
      } else this.moving = false;
      // Separation
      let sx = 0, sy = 0;
      g.queryRadius(this.x, this.y, this.radius + 26, (o) => {
        if (o === this || o.isAir || o.isBuilding) return;
        const dx = this.x - o.x, dy = this.y - o.y; let d = Math.hypot(dx, dy);
        const min = (this.radius + o.radius) * 0.8;
        if (d < min) {
          if (d < 0.01) { d = 0.01; sx += Math.random() - 0.5; }
          const push = (min - d) / min;
          const w = (this.moving && !o.moving) ? 0.35 : 1; // fahrende Einheiten drängeln weniger
          sx += dx / d * push * 70 * w; sy += dy / d * push * 70 * w;
        }
      });
      vx += sx; vy += sy;
      // Fahrzeuge überrollen feindliche Infanterie
      if (this.moving && this.def.cat === 'veh' && this.def.armor === 'heavy' && !this.def.hover) {
        g.queryRadius(this.x, this.y, this.radius * 0.6, (o) => {
          if (o.dead || !o.isUnit || o.def.cat !== 'inf' || !g.hostile(this.owner, o.owner)) return;
          g.damage(o, 260 * dt, 'crush', this);
        });
      }
      if (vx || vy) {
        const nx = this.x + vx * dt, ny = this.y + vy * dt;
        const mode = this.mode;
        if (m.passablePx(nx, ny, mode)) { this.x = nx; this.y = ny; }
        else if (m.passablePx(nx, this.y, mode)) this.x = nx;
        else if (m.passablePx(this.x, ny, mode)) this.y = ny;
        else if (!m.passablePx(this.x, this.y, mode)) {
          // Steckt fest (z.B. Gebäude darauf gebaut): herausschieben
          const p = m.nearestPassable(Math.floor(this.x / T), Math.floor(this.y / T), mode, 6);
          if (p) { this.x = (p.tx + 0.5) * T; this.y = (p.ty + 0.5) * T; }
        }
      }
      // Festsitzen erkennen
      if (this.path) {
        this.stuckT += dt;
        if (this.stuckT > 1.2) {
          const moved = U.dist(this.x, this.y, this.stuckX, this.stuckY);
          this.stuckT = 0; this.stuckX = this.x; this.stuckY = this.y;
          if (moved < 6) {
            this.stuckN++;
            const dg = U.dist(this.x, this.y, this.goalX, this.goalY);
            if (this.stuckN >= 3 || dg < T * 1.8) { this.path = null; this.moving = false; }
            else { const gx = this.goalX, gy = this.goalY; this.path = null; this.moveTo(gx, gy); this.stuckN = Math.max(this.stuckN, 1); }
          }
        }
      } else { this.stuckT = 0; this.stuckX = this.x; this.stuckY = this.y; }
    }

    // ---- Sammler ----
    harvThink() {
      const g = this.game, m = g.map;
      const cap = 500 * this.owner.mods.harvCap;
      if (this.order.type === 'move') { if (!this.path && !this.pathPending) { this.order = { type: 'idle' }; this.hstate = null; } return; }
      switch (this.hstate) {
        case null: case undefined: return;
        case 'wait': this.harvT -= 0.25; if (this.harvT <= 0) this.hstate = this.cargo >= cap * 0.5 ? 'return' : 'seek'; return;
        case 'seek': {
          const sx = this.oreT ? this.oreT.tx : Math.floor(this.x / T), sy = this.oreT ? this.oreT.ty : Math.floor(this.y / T);
          const t = m.findOreNear(sx, sy, 40);
          if (!t) { if (this.cargo > 0) this.hstate = 'return'; else { this.hstate = 'wait'; this.harvT = 4; } return; }
          this.oreT = t; this.moveTo((t.tx + 0.5) * T, (t.ty + 0.5) * T); this.hstate = 'toOre'; this.tries = 0; return;
        }
        case 'toOre': {
          const t = this.oreT; if (!t || m.ore[m.idx(t.tx, t.ty)] === 0) { this.hstate = 'seek'; return; }
          const d = U.dist(this.x, this.y, (t.tx + 0.5) * T, (t.ty + 0.5) * T);
          if (d < T * 0.8) { this.stopMove(); this.hstate = 'harvest'; this.harvT = 0; return; }
          if (!this.path && !this.pathPending) {
            if (d < T * 1.7) { this.hstate = 'harvest'; this.harvT = 0; }
            else if (++this.tries > 3) { this.oreT = null; this.hstate = 'wait'; this.harvT = 2; }
            else this.moveTo((t.tx + 0.5) * T, (t.ty + 0.5) * T);
          }
          return;
        }
        case 'harvest': {
          const t = this.oreT; const i = m.idx(t.tx, t.ty);
          this.harvT += 0.25;
          if (this.harvT >= 0.5) {
            this.harvT = 0;
            const take = Math.min(m.ore[i], 40, cap - this.cargo);
            m.ore[i] -= take; this.cargo += take; m.oreVersion++;
            if (take > 0 && Math.random() < 0.5) g.fx({ k: 'p', x: this.x + Math.cos(this.angle) * 14, y: this.y + Math.sin(this.angle) * 14, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, life: 0.6, max: 0.6, size: 2, c: '#67e8f9', add: true });
          }
          if (this.cargo >= cap - 1) { this.hstate = 'return'; return; }
          if (m.ore[i] === 0) {
            const n = m.findOreNear(t.tx, t.ty, 4);
            if (n) { this.oreT = n; this.moveTo((n.tx + 0.5) * T, (n.ty + 0.5) * T); this.hstate = 'toOre'; this.tries = 0; }
            else this.hstate = this.cargo > cap * 0.3 ? 'return' : 'seek';
          }
          return;
        }
        case 'return': {
          let ref = (this.dockRef && !this.dockRef.dead && this.dockRef.owner === this.owner) ? this.dockRef : null;
          if (!ref) {
            let bd = 1e18;
            for (const b of g.buildings) if (!b.dead && b.owner === this.owner && b.def.role === 'refinery' && b.built >= 1) {
              const d = U.dist2(this.x, this.y, b.x, b.y); if (d < bd) { bd = d; ref = b; }
            }
          }
          if (!ref) { this.hstate = 'wait'; this.harvT = 3; return; }
          this.dockRef = ref; const dp = ref.dockPos(this.x, this.y); this.dockPt = dp;
          this.moveTo(dp.x, dp.y); this.hstate = 'toDock'; this.tries = 0; return;
        }
        case 'toDock': {
          const ref = this.dockRef; if (!ref || ref.dead || ref.owner !== this.owner) { this.dockRef = null; this.hstate = 'return'; return; }
          const dp = this.dockPt || ref.dockPos(); const d = U.dist(this.x, this.y, dp.x, dp.y);
          const close = d < T * 0.7 || (!this.path && !this.pathPending && d < T * 1.8);
          if (close) {
            const u = ref.dockUser;
            if (u && u !== this && !u.dead && u.hstate === 'unload') { this.stopMove(); return; }
            ref.dockUser = this; this.hstate = 'unload'; this.stopMove(); return;
          }
          if (!this.path && !this.pathPending) { if (++this.tries > 4) { this.dockRef = null; this.hstate = 'return'; } else this.moveTo(dp.x, dp.y); }
          return;
        }
        case 'unload': {
          const ref = this.dockRef; if (!ref || ref.dead || ref.owner !== this.owner) { this.hstate = 'return'; this.dockRef = null; return; }
          this.angle = U.rotateTowards(this.angle, -Math.PI / 2, 0.6);
          const amt = Math.min(this.cargo, 70); this.cargo -= amt;
          this.owner.addIncome(amt);
          if (this.cargo <= 0.5) { this.cargo = 0; ref.dockUser = null; this.hstate = 'seek'; this.dockRef = null; }
          return;
        }
      }
    }
  }
  function maxRangeAny(e) { let r = 0; for (const w of e.def.weapons) r = Math.max(r, w.range); return r * T; }

  // ================= Gebäude =================
  class Building {
    constructor(game, def, owner, tx, ty) {
      this.game = game; this.id = game.nextId++; this.def = def; this.owner = owner; this.origOwner = owner;
      this.tx = tx; this.ty = ty; this.w = def.w; this.h = def.h;
      this.x = (tx + def.w / 2) * T; this.y = (ty + def.h / 2) * T; this.px = this.x; this.py = this.y;
      this.isBuilding = true; this.isAir = false;
      this.maxHp = def.hp * 1.4 * owner.mods.bldHp; this.hp = this.maxHp;
      this.radius = Math.max(def.w, def.h) * T * 0.5;
      this.built = 0; this.repairing = false; this.rally = null;
      this.turret = Math.PI / 2; this.cds = def.weapons.map(() => 0); this.target = null;
      this.charge = 0; this.thinkT = Math.random() * 0.3; this.lastHit = -99; this.lastFired = -99;
      this.dead = false; this.selected = false; this.seen = false; this.anim = Math.random() * 10;
      this.dockUser = null; this.spawnHarvester = false;
    }
    refreshHp() { const r = this.hp / this.maxHp; this.maxHp = this.def.hp * 1.4 * this.owner.mods.bldHp; this.hp = this.maxHp * r; }
    get powered() { return !(this.def.power < 0 && this.owner.lowPower) && !(this.empUntil > this.game.time); }
    dockPos(fx, fy) {
      const def = { x: (this.tx + this.w / 2) * T, y: (this.ty + this.h + 0.55) * T };
      if (fx == null) return def;
      // nächstgelegene freie Seite der Raffinerie
      const m = this.game.map, cx = this.tx + this.w / 2, cy = this.ty + this.h / 2;
      const cands = [def, { x: cx * T, y: (this.ty - 0.55) * T }, { x: (this.tx - 0.55) * T, y: cy * T }, { x: (this.tx + this.w + 0.55) * T, y: cy * T }];
      let best = def, bd = 1e18;
      for (const c of cands) { if (!m.passablePx(c.x, c.y, 0)) continue; const d = U.dist2(fx, fy, c.x, c.y); if (d < bd) { bd = d; best = c; } }
      return best;
    }
    exitPos() { return { x: (this.tx + this.w / 2) * T, y: (this.ty + this.h + 0.5) * T }; }
    update(dt) {
      const g = this.game; this.anim += dt;
      if (this.built < 1) {
        this.built = Math.min(1, this.built + dt / 2.2);
        if (this.built >= 1) this.onComplete();
        return;
      }
      if (this.repairing) {
        if (this.hp >= this.maxHp) this.repairing = false;
        else {
          const frac = 0.045 * dt, cost = this.def.cost * 0.3 * frac;
          if (this.owner.credits >= cost) { this.owner.credits -= cost; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * frac); if (Math.random() < dt * 3) g.fx({ k: 'p', x: this.x + (Math.random() - 0.5) * this.w * T * 0.6, y: this.y - 10, vx: 0, vy: -25, life: 0.8, max: 0.8, size: 3, c: '#fde047', add: true, kind: 'wrench' }); }
          else this.repairing = false;
        }
      }
      if (this.def.income && !this.owner.neutral) {
        this.incT = (this.incT || 0) + dt;
        if (this.incT >= 2) {
          this.incT -= 2; this.owner.credits += this.def.income; this.owner.stats.harvested += this.def.income;
          this.incN = (this.incN || 0) + 1;
          if (this.incN % 5 === 0) g.fx({ k: 'text', x: this.x, y: this.y - 26, txt: '+' + this.def.income * 5 + ' $', c: '#67e8f9', life: 1.2, max: 1.2 });
        }
      }
      for (let i = 0; i < this.cds.length; i++) this.cds[i] -= dt;
      if (this.def.weapons.length && this.powered) {
        this.thinkT -= dt;
        if (this.thinkT <= 0) {
          this.thinkT = 0.3;
          if (this.target && (this.target.dead || targetDist(this, this.target) > maxRangeVs(this, this.target) || !g.canSee(this.owner, this.target))) this.target = null;
          if (!this.target) this.target = acquireTarget(this, maxRangeAny(this));
        }
        if (this.target) aimAndFire(this, dt, this.target);
      }
      if (this.def.sw && g.cfg.superweapons !== false) {
        const SWT = g.swTime;
        if (this.charge < SWT) {
          if (this.powered) this.charge += dt;
          if (this.charge >= SWT) { this.charge = SWT; g.onSuperweaponReady(this); }
        }
      }
      // Schadensrauch
      const hr = this.hp / this.maxHp;
      if (hr < 0.5 && Math.random() < dt * (hr < 0.25 ? 6 : 2.5)) {
        g.fx({ k: 'p', x: this.x + (Math.random() - 0.5) * this.w * T * 0.7, y: this.y + (Math.random() - 0.5) * this.h * T * 0.5 - 8, vx: 4 + Math.random() * 6, vy: -18 - Math.random() * 10, life: 2.2, max: 2.2, size: 5, grow: 8, c: 'rgba(40,40,40,0.5)', smoke: true });
        if (hr < 0.25 && Math.random() < 0.4) g.fx({ k: 'p', x: this.x + (Math.random() - 0.5) * this.w * T * 0.5, y: this.y + (Math.random() - 0.5) * this.h * T * 0.4 - 6, vx: 0, vy: -20, life: 0.5, max: 0.5, size: 4, c: '#fb923c', add: true });
      }
    }
    onComplete() {
      const g = this.game;
      if (this.def.role === 'refinery' && this.spawnHarvester) {
        const dp = this.dockPos();
        const hdef = D.UNITS[this.owner.faction[0] + '_harv'];
        const u = g.spawnUnitNear(hdef.id, this.owner, dp.x, dp.y);
        if (u) u.hstate = 'seek';
      }
      if (this.def.sw) g.onSuperweaponBuilt(this);
    }
  }

  RTS.Unit = Unit; RTS.Building = Building;
  RTS.combat = { weaponCanHit, canAttack, acquireTarget, targetDist, maxRangeVs };
})();
