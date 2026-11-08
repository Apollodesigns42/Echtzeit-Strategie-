'use strict';
// ===== Spieloberfläche: Seitenleiste, Eingabe, Auswahl, Minikarte =====
(function () {
  const U = RTS.util, D = RTS.data, T = U.TILE;
  const $ = (id) => document.getElementById(id);

  class HUD {
    constructor(game, renderer, app) {
      this.g = game; this.r = renderer; this.app = app; this.p = game.human;
      this.selection = []; this.groups = {}; this.lastGroupKey = null; this.lastGroupT = 0;
      this.mode = null; this.placing = null; this.swBuilding = null;
      this.mouse = { x: -1, y: -1, inView: false, moved: false }; this.mouseWorld = { x: 0, y: 0 };
      this.drag = null; this.rdrag = null; this.keys = {}; this.hover = null;
      this.tab = 'base'; this.lastClick = { t: 0, id: null };
      this.settings = app.settings;
      this.view = $('view'); this.mm = $('minimap'); this.mmCtx = this.mm.getContext('2d');
      this.mmT = 0; this.sbT = 0; this.msgEls = [];
      const accent = { allianz: '#f5b301', schatten: '#ef4444', vael: '#c084fc' }[this.p.faction];
      document.documentElement.style.setProperty('--accent', accent);
      this.bindInput();
      this.buildTabs();
      this.buildItems();
      game.on('message', (txt, type, key) => this.onMessage(txt, type, key));
      game.on('sound', (n, x, y) => this.onSound(n, x, y));
      game.on('unitProduced', () => {});
      this.updateSidebar(true);
    }
    destroy() {
      for (const [el, ev, fn, o] of this.handlers) el.removeEventListener(ev, fn, o);
      $('msgs').innerHTML = ''; $('swpanel').innerHTML = ''; $('build').innerHTML = ''; $('tabs').innerHTML = ''; $('selinfo').innerHTML = '';
      $('tooltip').classList.add('hidden'); $('objectives').classList.add('hidden');
    }
    on(el, ev, fn, o) { el.addEventListener(ev, fn, o); this.handlers.push([el, ev, fn, o]); }

    // ---------- Meldungen & Sound ----------
    onMessage(txt, type, key) {
      const el = document.createElement('div'); el.className = 'msg ' + (type || ''); el.textContent = txt;
      const box = $('msgs'); box.appendChild(el);
      while (box.children.length > 5) box.removeChild(box.firstChild);
      setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 700); }, type === 'mission' ? 9000 : 4500);
      if (key && RTS.audio) {
        if (type === 'alert') RTS.audio.play('alert');
        const speak = { ready: 'Konstruktion abgeschlossen', unit: 'Einheit bereit', research: 'Forschung abgeschlossen', lowpower: 'Niedriger Energiestand', baseattack: 'Unsere Basis wird angegriffen', harvattack: 'Sammler wird angegriffen', unitattack: 'Einheiten unter Beschuss', bldlost: 'Gebäude verloren', harvlost: 'Sammler verloren', swready: 'Superwaffe bereit', swenemy: 'Feindliche Superwaffe entdeckt', swincoming: 'Warnung. Feindliche Superwaffe abgefeuert', swfire: 'Superwaffe abgefeuert', nocash: 'Unzureichende Mittel', deploy: 'Aufbau', cantplace: 'Platzierung nicht möglich' }[key];
        if (speak) RTS.audio.say(speak);
      } else if (type === 'mission' && RTS.audio) RTS.audio.play('alert');
    }
    onSound(name, x, y) {
      if (!RTS.audio) return;
      let v = 1;
      if (x != null) {
        const s = this.r.toScreen(x, y), cx = this.r.vw / 2, cy = this.r.vh / 2;
        const d = Math.hypot(s.x - cx, s.y - cy) / Math.max(this.r.vw, this.r.vh);
        v = U.clamp(1.2 - d * 1.4, 0, 1); if (v <= 0.05) return;
      }
      RTS.audio.play(name, v);
    }

    // ---------- Eingabe ----------
    bindInput() {
      this.handlers = [];
      const v = this.view;
      this.on(v, 'contextmenu', e => e.preventDefault());
      this.on(this.mm, 'contextmenu', e => e.preventDefault());
      this.on(v, 'mousedown', e => this.onDown(e));
      this.on(window, 'mousemove', e => this.onMove(e));
      this.on(window, 'mouseup', e => this.onUp(e));
      this.on(v, 'wheel', e => { e.preventDefault(); const rc = v.getBoundingClientRect(); this.r.setZoom(this.r.cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX - rc.left, e.clientY - rc.top); }, { passive: false });
      this.on(v, 'mouseleave', () => { this.mouse.inView = false; });
      this.on(v, 'mouseenter', (e) => { const s = this.viewPos(e); this.mouse.x = s.x; this.mouse.y = s.y; this.mouse.inView = true; });
      this.on(window, 'keydown', e => this.onKey(e, true));
      this.on(window, 'keyup', e => this.onKey(e, false));
      this.on(window, 'blur', () => { this.keys = {}; });
      const mmHandler = (e) => {
        e.preventDefault();
        if (!this.radarOn()) return;
        const rc = this.mm.getBoundingClientRect(); const m = this.g.map;
        const sc = Math.min(rc.width / m.w, rc.height / m.h), ox = (rc.width - m.w * sc) / 2, oy = (rc.height - m.h * sc) / 2;
        const wx = (e.clientX - rc.left - ox) / sc * T, wy = (e.clientY - rc.top - oy) / sc * T;
        if (e.button === 2 || (e.button === 0 && this.settings.classic && this.ownUnits().length && e.type === 'mousedown' && false)) { this.commandAt(wx, wy, e.ctrlKey); return; }
        if (e.buttons & 1 || e.button === 0) this.r.centerOn(wx, wy);
      };
      this.on(this.mm, 'mousedown', mmHandler);
      this.on(this.mm, 'mousemove', e => { if (e.buttons & 1) mmHandler(e); });
      this.on($('tool-repair'), 'click', () => this.setMode(this.mode === 'repair' ? null : 'repair'));
      this.on($('tool-sell'), 'click', () => this.setMode(this.mode === 'sell' ? null : 'sell'));
      this.on($('tool-menu'), 'click', () => this.app.pause(true));
      this.on($('tool-obj'), 'click', () => $('objectives').classList.toggle('hidden'));
      this.on(window, 'resize', () => this.r.resize());
    }
    radarOn() {
      const g = this.g;
      if (g.mission && g.mission.radar) return true;
      return g.buildings.some(b => !b.dead && b.owner === this.p && b.def.role === 'radar' && b.built >= 1 && b.powered);
    }
    setMode(m) {
      this.mode = m; if (m !== 'place') this.placing = null;
      $('tool-repair').classList.toggle('on', m === 'repair'); $('tool-sell').classList.toggle('on', m === 'sell');
    }
    viewPos(e) { const rc = this.view.getBoundingClientRect(); return { x: e.clientX - rc.left, y: e.clientY - rc.top }; }
    ownUnits() { return this.selection.filter(e => e.isUnit && e.owner === this.p && !e.dead); }
    entityAt(wx, wy) {
      const g = this.g; let best = null, bd = 1e9;
      for (const u of g.units) {
        if (u.dead) continue;
        if (!g.allied(this.p, u.owner) && !g.canSee(this.p, u)) continue;
        const uy = u.y - (u.alt || 0);
        const d = U.dist(wx, wy, u.x, uy); const r = Math.max(12, u.radius + 3);
        if (d < r && d < bd) { bd = d; best = u; }
      }
      if (best) return best;
      const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
      if (!g.map.inBounds(tx, ty)) return null;
      const id = g.map.bld[g.map.idx(tx, ty)];
      if (id) { const b = g.buildings.find(b => b.id === id && !b.dead); if (b && (g.allied(this.p, b.owner) || b.seen)) return b; }
      return null;
    }
    onDown(e) {
      if (this.app.paused) return;
      const s = this.viewPos(e); this.mouse.x = s.x; this.mouse.y = s.y;
      const w = this.r.toWorld(s.x, s.y); this.mouseWorld = w;
      if (RTS.audio) { RTS.audio.init(); if (this.settings.music) RTS.audio.startMusic(); }
      const classic = this.settings.classic;
      if (e.button === 1) { this.rdrag = { x: s.x, y: s.y, cx: this.r.cam.x, cy: this.r.cam.y, moved: true, btn: 1 }; e.preventDefault(); return; }
      if (e.button === 2) {
        if (this.mode && this.mode !== 'amove') { this.setMode(null); return; }
        if (this.mode === 'amove') { this.setMode(null); return; }
        this.rdrag = { x: s.x, y: s.y, cx: this.r.cam.x, cy: this.r.cam.y, moved: false, btn: 2 };
        return;
      }
      if (e.button !== 0) return;
      if (this.mode === 'place' && this.placing) {
        const tab = this.placing.tab;
        if (this.g.tryPlaceFromQueue(this.p, tab, this.placeTx, this.placeTy)) { this.setMode(null); this.updateSidebar(true); }
        else { this.g.announce('cantplace', 'Platzierung nicht möglich', 'warn', 1); RTS.audio && RTS.audio.play('error'); }
        return;
      }
      if (this.mode === 'sw' && this.swBuilding) {
        if (this.g.fireSuperweapon(this.swBuilding, w.x, w.y)) { this.setMode(null); this.swBuilding = null; }
        return;
      }
      if (this.mode === 'sell' || this.mode === 'repair') {
        const ent = this.entityAt(w.x, w.y);
        if (ent && ent.isBuilding && ent.owner === this.p) {
          if (this.mode === 'sell') this.g.sell(ent);
          else { ent.repairing = !ent.repairing && ent.hp < ent.maxHp; RTS.audio && RTS.audio.play('click'); }
        }
        if (!e.shiftKey) this.setMode(null);
        return;
      }
      if (this.mode === 'amove') {
        const ent = this.entityAt(w.x, w.y);
        const units = this.ownUnits();
        if (ent && this.g.hostile(this.p, ent.owner)) this.g.cmdAttack(units, ent);
        else this.g.cmdMove(units, w.x, w.y, true);
        this.r.addMarker(w.x, w.y, '#f87171'); RTS.audio && RTS.audio.play('order');
        if (!e.shiftKey) this.setMode(null);
        return;
      }
      this.drag = { x: s.x, y: s.y, x2: s.x, y2: s.y, shift: e.shiftKey, ctrl: e.ctrlKey, classic };
    }
    onMove(e) {
      const s = this.viewPos(e); this.mouse.x = s.x; this.mouse.y = s.y; this.mouse.moved = true;
      this.mouse.inView = s.x >= 0 && s.y >= 0 && s.x < this.r.vw && s.y < this.r.vh;
      this.mouseWorld = this.r.toWorld(s.x, s.y);
      if (this.rdrag) {
        const dx = s.x - this.rdrag.x, dy = s.y - this.rdrag.y;
        if (Math.hypot(dx, dy) > 6) this.rdrag.moved = true;
        if (this.rdrag.moved) { this.r.cam.x = this.rdrag.cx - dx / this.r.cam.zoom; this.r.cam.y = this.rdrag.cy - dy / this.r.cam.zoom; this.r.clampCam(); }
      }
      if (this.drag) {
        this.drag.x2 = s.x; this.drag.y2 = s.y;
        const box = $('selbox');
        if (Math.abs(this.drag.x2 - this.drag.x) > 5 || Math.abs(this.drag.y2 - this.drag.y) > 5) {
          box.classList.remove('hidden');
          box.style.left = Math.min(this.drag.x, this.drag.x2) + 'px'; box.style.top = Math.min(this.drag.y, this.drag.y2) + 'px';
          box.style.width = Math.abs(this.drag.x2 - this.drag.x) + 'px'; box.style.height = Math.abs(this.drag.y2 - this.drag.y) + 'px';
        }
      }
    }
    onUp(e) {
      if (e.button === 1 || e.button === 2) {
        const rd = this.rdrag; this.rdrag = null;
        if (rd && rd.btn === 2 && !rd.moved && !this.app.paused) {
          const w = this.r.toWorld(this.mouse.x, this.mouse.y);
          if (this.settings.classic) this.select([]);
          else this.commandAt(w.x, w.y, e.ctrlKey);
        }
        return;
      }
      if (e.button !== 0 || !this.drag) return;
      const d = this.drag; this.drag = null; $('selbox').classList.add('hidden');
      const big = Math.abs(d.x2 - d.x) > 5 || Math.abs(d.y2 - d.y) > 5;
      if (big) {
        const a = this.r.toWorld(Math.min(d.x, d.x2), Math.min(d.y, d.y2)), b = this.r.toWorld(Math.max(d.x, d.x2), Math.max(d.y, d.y2));
        const sel = this.g.units.filter(u => !u.dead && u.owner === this.p && u.x >= a.x && u.x <= b.x && u.y - (u.alt || 0) >= a.y && u.y - (u.alt || 0) <= b.y);
        const combat = sel.filter(u => u.def.weapons.length);
        const pick = combat.length ? combat : sel;
        this.select(d.shift ? Array.from(new Set(this.selection.concat(pick))) : pick);
        return;
      }
      const w = this.r.toWorld(d.x, d.y);
      const ent = this.entityAt(w.x, w.y);
      const now = performance.now();
      if (d.classic && this.ownUnits().length && (!ent || this.g.hostile(this.p, ent.owner) || (ent.isBuilding && ent.def.role === 'refinery'))) { this.commandAt(w.x, w.y, d.ctrl); return; }
      if (d.classic && this.selection.length === 1 && this.selection[0].isBuilding && this.selection[0].owner === this.p && !ent && this.selection[0].def.produces) { this.commandAt(w.x, w.y, false); return; }
      if (!ent) { if (!d.shift) this.select([]); return; }
      if (ent.isUnit && ent.owner === this.p && this.lastClick.id === ent.def.id && now - this.lastClick.t < 350) {
        this.selectSameTypeOnScreen(ent.def.id); this.lastClick.t = 0; return;
      }
      this.lastClick = { t: now, id: ent.isUnit ? ent.def.id : null };
      if (d.shift && ent.isUnit && ent.owner === this.p) {
        const i = this.selection.indexOf(ent);
        if (i >= 0) this.select(this.selection.filter(x => x !== ent)); else this.select(this.selection.filter(x => x.isUnit && x.owner === this.p).concat([ent]));
      } else this.select([ent]);
    }
    commandAt(wx, wy, forceAttack) {
      const g = this.g;
      const units = this.ownUnits();
      if (!units.length) {
        const b = this.selection.length === 1 && this.selection[0].isBuilding && this.selection[0].owner === this.p ? this.selection[0] : null;
        if (b && (b.def.produces)) { b.rally = { x: wx, y: wy }; this.r.addMarker(wx, wy, '#86efac'); RTS.audio && RTS.audio.play('click'); }
        return;
      }
      const ent = this.entityAt(wx, wy);
      RTS.audio && RTS.audio.play('order');
      if (ent && g.hostile(this.p, ent.owner)) { g.cmdAttack(units, ent); this.r.addMarker(ent.x, ent.y, '#f87171'); return; }
      const harv = units.filter(u => u.def.harvester), rest = units.filter(u => !u.def.harvester);
      const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
      if (harv.length) {
        if (ent && ent.isBuilding && ent.owner === this.p && ent.def.role === 'refinery') g.cmdDock(harv, ent);
        else if (g.map.inBounds(tx, ty) && g.map.ore[g.map.idx(tx, ty)] > 0) g.cmdHarvest(harv, tx, ty);
        else g.cmdMove(harv, wx, wy, false);
      }
      if (rest.length) g.cmdMove(rest, wx, wy, forceAttack);
      this.r.addMarker(wx, wy, forceAttack ? '#f87171' : '#86efac');
    }
    select(list) {
      for (const e of this.selection) e.selected = false;
      this.selection = list.filter(e => !e.dead);
      for (const e of this.selection) e.selected = true;
      if (this.selection.length && this.selection[0].owner === this.p && RTS.audio) RTS.audio.play('select');
      this.updateSelInfo();
    }
    selectSameTypeOnScreen(defId) {
      const a = this.r.toWorld(0, 0), b = this.r.toWorld(this.r.vw, this.r.vh);
      this.select(this.g.units.filter(u => !u.dead && u.owner === this.p && u.def.id === defId && u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y));
    }
    onKey(e, down) {
      if (!this.app.inGame) return;
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) { this.keys[k] = down; e.preventDefault(); return; }
      if (!down) return;
      if (k === 'Escape') {
        if (this.mode) { this.setMode(null); return; }
        this.app.pause(!this.app.paused); return;
      }
      if (this.app.paused) return;
      if (k === 'Tab') { e.preventDefault(); const tabs = D.TABS.map(t => t.id); this.setTab(tabs[(tabs.indexOf(this.tab) + 1) % tabs.length]); return; }
      const code = e.code;
      if (/^Digit[1-9]$/.test(code)) {
        const n = code.slice(5);
        if (e.ctrlKey) {
          e.preventDefault();
          const units = this.ownUnits();
          for (const u of this.g.units) if (u.group === n) u.group = null;
          for (const u of units) u.group = n;
          this.groups[n] = units.slice();
          this.g.message('Gruppe ' + n + ' gespeichert (' + units.length + ')');
        } else {
          const grp = (this.groups[n] || []).filter(u => !u.dead);
          this.groups[n] = grp;
          if (!grp.length) return;
          const now = performance.now();
          if (this.lastGroupKey === n && now - this.lastGroupT < 400) {
            const cx = grp.reduce((a, u) => a + u.x, 0) / grp.length, cy = grp.reduce((a, u) => a + u.y, 0) / grp.length;
            this.r.centerOn(cx, cy);
          }
          this.lastGroupKey = n; this.lastGroupT = now;
          this.select(e.shiftKey ? Array.from(new Set(this.selection.concat(grp))) : grp);
        }
        return;
      }
      switch (k.toLowerCase()) {
        case 'a': if (this.ownUnits().some(u => u.def.weapons.length)) this.setMode('amove'); break;
        case 's': this.g.cmdStop(this.ownUnits()); break;
        case 'd': this.g.cmdDeploy(this.ownUnits()); break;
        case 'q': this.select(this.g.units.filter(u => !u.dead && u.owner === this.p && u.def.weapons.length)); break;
        case 'w': { const u = this.ownUnits()[0]; if (u) this.selectSameTypeOnScreen(u.def.id); break; }
        case 'h': { const b = this.g.buildings.find(b => !b.dead && b.owner === this.p && b.def.role === 'yard') || this.g.buildings.find(b => !b.dead && b.owner === this.p) || this.g.units.find(u => !u.dead && u.owner === this.p); if (b) this.r.centerOn(b.x, b.y); break; }
        case ' ': e.preventDefault(); if (this.g.lastAlert) this.r.centerOn(this.g.lastAlert.x, this.g.lastAlert.y); break;
        case 'r': this.setMode(this.mode === 'repair' ? null : 'repair'); break;
        case 'x': this.setMode(this.mode === 'sell' ? null : 'sell'); break;
        case '+': this.app.changeSpeed(1); break;
        case '-': this.app.changeSpeed(-1); break;
        case 'delete': { const b = this.selection[0]; if (b && b.isBuilding && b.owner === this.p) this.g.sell(b); break; }
      }
    }

    // ---------- Pro Frame ----------
    update(dt) {
      const r = this.r, cam = r.cam;
      const sp = this.settings.scrollSpeed / cam.zoom * dt;
      let dx = 0, dy = 0;
      if (this.keys.ArrowLeft) dx -= sp; if (this.keys.ArrowRight) dx += sp;
      if (this.keys.ArrowUp) dy -= sp; if (this.keys.ArrowDown) dy += sp;
      if (this.settings.edgeScroll && this.mouse.inView && this.mouse.moved && !this.rdrag && !this.app.paused && document.hasFocus()) {
        const m = 6, mx = this.mouse.x, my = this.mouse.y;
        if (mx < m) dx -= sp; if (mx > r.vw - m) dx += sp; if (my < m) dy -= sp; if (my > r.vh - m) dy += sp;
      }
      if (dx || dy) { cam.x += dx; cam.y += dy; r.clampCam(); }
      this.mouseWorld = r.toWorld(this.mouse.x, this.mouse.y);
      // Auswahl bereinigen
      if (this.selection.some(e => e.dead)) this.select(this.selection.filter(e => !e.dead));
      // Hover & Cursor
      this.hover = this.mouse.inView ? this.entityAt(this.mouseWorld.x, this.mouseWorld.y) : null;
      let c = '';
      if (this.mode === 'place') c = 'c-place';
      else if (this.mode === 'sw' || this.mode === 'amove') c = 'c-sw';
      else if (this.mode === 'sell') c = 'c-sell';
      else if (this.mode === 'repair') c = 'c-repair';
      else if (this.rdrag && this.rdrag.moved) c = 'c-pan';
      else if (this.hover && this.g.hostile(this.p, this.hover.owner) && this.ownUnits().length) c = 'c-attack';
      else if (this.hover) c = 'c-move';
      if (this.view.className !== c) this.view.className = c;
      // Seitenleiste
      this.sbT -= dt; if (this.sbT <= 0) { this.sbT = 0.12; this.updateSidebar(false); }
      this.mmT -= dt; if (this.mmT <= 0) { this.mmT = 0.2; this.drawMinimap(); }
      $('clock').textContent = U.fmtTime(this.g.time);
    }

    // ---------- Seitenleiste ----------
    buildTabs() {
      const box = $('tabs'); box.innerHTML = '';
      this.tabEls = {};
      for (const t of D.TABS) {
        const b = document.createElement('button'); b.className = 'tab'; b.textContent = t.icon; b.title = t.name;
        const q = document.createElement('span'); q.className = 'tq'; b.appendChild(q);
        this.on(b, 'click', () => this.setTab(t.id));
        box.appendChild(b); this.tabEls[t.id] = b;
      }
      this.tabEls[this.tab].classList.add('on');
    }
    setTab(id) {
      this.tab = id;
      for (const k in this.tabEls) this.tabEls[k].classList.toggle('on', k === id);
      this.buildItems();
      RTS.audio && RTS.audio.play('click');
    }
    buildItems() {
      const box = $('build'); box.innerHTML = ''; this.itemEls = [];
      const items = D.itemsFor(this.p.faction, this.tab).filter(d => !(this.g.techLimit && this.g.techLimit[d.id] === false) && !(d.sw && this.g.cfg.superweapons === false));
      for (const def of items) {
        const el = document.createElement('div'); el.className = 'bi';
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
        cv.getContext('2d').drawImage(RTS.draw.cameo(def, this.p.color), 0, 0);
        el.appendChild(cv);
        const prog = document.createElement('div'); prog.className = 'bp'; prog.style.display = 'none'; el.appendChild(prog);
        const nm = document.createElement('div'); nm.className = 'bn'; nm.textContent = def.name; el.appendChild(nm);
        const cost = document.createElement('div'); cost.className = 'bc'; cost.textContent = '$' + def.cost; el.appendChild(cost);
        const q = document.createElement('div'); q.className = 'bq'; el.appendChild(q);
        const st = document.createElement('div'); st.className = 'bs'; el.appendChild(st);
        this.on(el, 'mousedown', (e) => { e.preventDefault(); this.clickItem(def, e); });
        this.on(el, 'contextmenu', (e) => e.preventDefault());
        this.on(el, 'mouseenter', (e) => this.showTip(def, el));
        this.on(el, 'mouseleave', () => $('tooltip').classList.add('hidden'));
        box.appendChild(el);
        this.itemEls.push({ def, el, prog, q, st });
      }
      this.updateSidebar(true);
    }
    clickItem(def, e) {
      const p = this.p, tab = p.tabFor(def), q = p.queues[tab];
      if (RTS.audio) RTS.audio.init();
      if (e.button === 2) { const r = p.cancel(def.id); if (r) RTS.audio && RTS.audio.play('click'); this.updateSidebar(true); return; }
      if (e.button !== 0) return;
      const head = q[0];
      if (head && head.def === def && head.ready && def.kind === 'building') { this.placing = { def, tab }; this.setMode('place'); this.placing = { def, tab }; return; }
      if (head && head.def === def && head.paused) { head.paused = false; this.updateSidebar(true); return; }
      if (!p.reqMet(def)) { RTS.audio && RTS.audio.play('error'); return; }
      const n = e.shiftKey && def.kind === 'unit' ? 5 : 1;
      let ok = false; for (let i = 0; i < n; i++) ok = p.enqueue(def.id) || ok;
      if (ok) { RTS.audio && RTS.audio.play('click'); if (p.credits < 1) this.g.announce('nocash', 'Unzureichende Mittel', 'warn', 6); }
      else RTS.audio && RTS.audio.play('error');
      this.updateSidebar(true);
    }
    showTip(def, el) {
      const tip = $('tooltip'), p = this.p;
      let h = `<b>${def.name}</b> <span class="tc">$${def.cost}</span><br>`;
      if (def.time) h += `<span class="td">Bauzeit: ${def.time}s</span><br>`;
      h += `<span class="td">${def.desc || ''}</span>`;
      if (def.kind === 'unit') {
        h += `<br>Struktur: ${def.hp} · Panzerung: ${D.ARMOR_NAMES[def.armor]} · Tempo: ${def.speed}`;
        if (def.weapons.length) h += '<br>Ziele: ' + Array.from(new Set(def.weapons.map(w => w.targets === 'both' ? 'Boden & Luft' : w.targets === 'air' ? 'Luft' : 'Boden'))).join(', ');
      } else if (def.kind === 'building') {
        h += `<br>Struktur: ${def.hp} · Energie: ${def.power > 0 ? '+' : ''}${def.power}`;
      }
      const miss = [];
      const roleName = (r) => (D.BUILDINGS[p.faction + '_' + r] || {}).name || r;
      if (def.kind === 'building' && !p.has('yard')) miss.push(roleName('yard'));
      if (def.kind === 'unit' && !p.has(def.producer)) miss.push(roleName(def.producer));
      for (const r of def.req) if (!p.has(r)) miss.push(roleName(r));
      if (miss.length) h += `<br><span class="tr">Benötigt: ${miss.join(', ')}</span>`;
      if (def.kind === 'research' && p.researched.has(def.id)) h += '<br><span style="color:#4ade80">Erforscht</span>';
      tip.innerHTML = h; tip.classList.remove('hidden');
      const rc = el.getBoundingClientRect();
      tip.style.left = Math.max(4, rc.left - 270) + 'px'; tip.style.top = Math.min(window.innerHeight - 160, rc.top) + 'px';
    }
    updateSidebar(force) {
      const p = this.p, g = this.g;
      $('credits').textContent = '$ ' + Math.floor(p.credits).toLocaleString('de-DE');
      const pw = p.power, maxP = Math.max(pw.prod, pw.use, 1) * 1.15;
      $('power-fill').style.width = (pw.prod / maxP * 100) + '%';
      $('power-use').style.left = (pw.use / maxP * 100) + '%';
      $('power-txt').textContent = `Energie ${pw.use} / ${pw.prod}`;
      $('powerbar').classList.toggle('low', p.lowPower);
      $('mm-off').style.display = this.radarOn() ? 'none' : 'flex';
      // Tabs
      for (const t of D.TABS) {
        const el = this.tabEls[t.id]; const q = p.queues[t.id];
        el.classList.toggle('dis', !p.producerCount(t.id));
        el.classList.toggle('ready', !!(q[0] && q[0].ready));
        el.querySelector('.tq').textContent = q.length ? q.length : '';
      }
      // Items
      for (const it of this.itemEls) {
        const def = it.def, tab = p.tabFor(def), q = p.queues[tab];
        const count = q.filter(x => x.def === def).length;
        const head = q[0] && q[0].def === def ? q[0] : null;
        const locked = !p.reqMet(def);
        const done = def.kind === 'research' && p.researched.has(def.id);
        it.el.classList.toggle('locked', locked && !done);
        it.el.classList.toggle('done', done);
        it.el.classList.toggle('ready', !!(head && head.ready));
        it.el.classList.toggle('paused', !!(head && head.paused));
        it.q.textContent = count > 1 ? count : '';
        if (head && !head.ready) { it.prog.style.display = 'block'; it.prog.style.transform = `scaleX(${1 - head.spent / def.cost})`; }
        else if (count && !head) { it.prog.style.display = 'block'; it.prog.style.transform = 'scaleX(1)'; }
        else it.prog.style.display = 'none';
        it.st.textContent = done ? '✓' : head && head.ready ? 'BEREIT' : head && head.paused ? 'PAUSE' : (head && !locked && g.time > 0 && p.credits < 1 ? '$?' : '');
      }
      // Superwaffen
      this.updateSwPanel();
      if (force || this.selection.length) this.updateSelInfo();
      this.updateObjectives();
    }
    updateSwPanel() {
      const g = this.g, box = $('swpanel');
      const sws = g.buildings.filter(b => !b.dead && b.def.sw && b.built >= 1 && (b.owner === this.p || b.seen || g.allied(this.p, b.owner) || true));
      const key = sws.map(b => b.id).join(',');
      if (this.swKey !== key) {
        this.swKey = key; box.innerHTML = ''; this.swEls = [];
        for (const b of sws) {
          const el = document.createElement('div'); const mine = b.owner === this.p;
          el.className = 'swi ' + (mine ? 'mine' : g.allied(this.p, b.owner) ? '' : 'enemy');
          el.innerHTML = `<div class="nm"></div><div class="bar"><div></div></div>`;
          if (mine) this.on(el, 'click', () => { if (b.charge >= g.swTime) { this.swBuilding = b; this.setMode('sw'); } });
          box.appendChild(el); this.swEls.push({ b, el });
        }
      }
      for (const { b, el } of this.swEls) {
        const f = b.charge / g.swTime, rem = g.swTime - b.charge;
        el.querySelector('.nm').textContent = (b.owner === this.p ? '' : b.owner.name + ': ') + b.owner.fdef.sw.name + ' – ' + (f >= 1 ? (b.owner === this.p ? 'BEREIT (klicken)' : 'BEREIT') : U.fmtTime(rem));
        el.querySelector('.bar div').style.width = (f * 100) + '%';
        el.classList.toggle('ready', f >= 1);
      }
    }
    updateObjectives() {
      const g = this.g, el = $('objectives');
      if (!g.mission || !g.mission.objectives) { if (!this.objInit) { this.objInit = true; el.classList.add('hidden'); } return; }
      const objs = g.mission.objectives(g);
      const html = '<h4>Missionsziele</h4>' + objs.map(o => `<div class="obj ${o.done ? 'done' : ''}">${o.done ? '✔' : '▸'} ${o.text}</div>`).join('');
      if (el.innerHTML !== html) el.innerHTML = html;
      if (!this.objInit) { this.objInit = true; el.classList.remove('hidden'); }
    }
    updateSelInfo() {
      const box = $('selinfo'), sel = this.selection, g = this.g;
      const key = sel.map(e => e.id).join(',') + '|' + sel.map(e => Math.round(e.hp / e.maxHp * 30)).join(',') + '|' + (sel[0] && sel[0].isBuilding ? (sel[0].repairing ? 1 : 0) + ':' + (this.p.primary[sel[0].def.role] === sel[0].id ? 1 : 0) : '') + this.mode;
      if (key === this.selKey) {
        if (sel.length === 1 && this.selDyn) this.selDyn();
        return;
      }
      this.selKey = key; this.selDyn = null;
      box.innerHTML = '';
      if (!sel.length) { box.innerHTML = '<div class="small">Keine Auswahl</div>'; return; }
      const mine = sel[0].owner === this.p;
      if (sel.length === 1) {
        const e = sel[0];
        const head = document.createElement('div'); head.style.display = 'flex'; head.style.gap = '6px';
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; cv.style.width = '64px'; cv.style.height = '48px'; cv.style.border = '1px solid #3a4550';
        cv.getContext('2d').drawImage(RTS.draw.cameo(e.def, e.owner.color), 0, 0);
        head.appendChild(cv);
        const info = document.createElement('div'); info.style.flex = '1';
        info.innerHTML = `<div class="sname">${e.def.name}${e.rank ? ' <span style="color:#facc15">' + '★'.repeat(e.rank) + '</span>' : ''}</div><div class="small" style="color:${e.owner.color}">${e.owner.name}</div><div class="shp"><div></div></div><div class="small dyn"></div>`;
        head.appendChild(info); box.appendChild(head);
        const bar = info.querySelector('.shp div'), dyn = info.querySelector('.dyn');
        this.selDyn = () => {
          const f = e.hp / e.maxHp;
          bar.style.width = (f * 100) + '%'; bar.style.background = f > 0.6 ? '#22c55e' : f > 0.3 ? '#eab308' : '#ef4444';
          let t = Math.ceil(e.hp) + ' / ' + Math.ceil(e.maxHp);
          if (e.isUnit && e.def.harvester) t += ' · Ladung: ' + Math.round(e.cargo);
          if (e.isBuilding && e.def.power) t += ' · Energie: ' + (e.def.power > 0 ? '+' : '') + e.def.power;
          if (e.isBuilding && e.def.sw) t += ' · ' + Math.floor(e.charge / g.swTime * 100) + '%';
          if (e.isUnit && e.cloaked) t += ' · getarnt';
          dyn.textContent = t;
        };
        this.selDyn();
      } else {
        const counts = new Map(); for (const e of sel) counts.set(e.def, (counts.get(e.def) || 0) + 1);
        const grid = document.createElement('div'); grid.className = 'sgrid';
        for (const [def, n] of counts) {
          const c = document.createElement('div'); c.className = 'sg'; c.title = def.name;
          const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; cv.getContext('2d').drawImage(RTS.draw.cameo(def, this.p.color), 0, 0);
          c.appendChild(cv); const s = document.createElement('span'); s.textContent = n; c.appendChild(s);
          this.on(c, 'click', (ev) => { if (ev.shiftKey) this.select(this.selection.filter(x => x.def !== def)); else this.select(this.selection.filter(x => x.def === def)); });
          grid.appendChild(c);
        }
        const hdr = document.createElement('div'); hdr.className = 'sname'; hdr.textContent = sel.length + ' Einheiten'; box.appendChild(hdr);
        box.appendChild(grid);
      }
      if (!mine) return;
      const cmds = document.createElement('div'); cmds.className = 'cmds';
      const btn = (label, fn, on) => { const b = document.createElement('button'); b.textContent = label; if (on) b.classList.add('on'); this.on(b, 'click', fn); cmds.appendChild(b); };
      const units = this.ownUnits();
      if (units.length) {
        if (units.some(u => u.def.weapons.length)) btn('Angriff (A)', () => this.setMode('amove'), this.mode === 'amove');
        btn('Stopp (S)', () => this.g.cmdStop(this.ownUnits()));
        if (units.some(u => u.def.mcv)) btn('Aufbauen (D)', () => this.g.cmdDeploy(this.ownUnits()));
      } else if (sel.length === 1 && sel[0].isBuilding) {
        const b = sel[0];
        btn(b.repairing ? 'Rep. stoppen' : 'Reparieren', () => { b.repairing = !b.repairing && b.hp < b.maxHp; this.selKey = null; this.updateSelInfo(); }, b.repairing);
        btn('Verkaufen', () => this.g.sell(b));
        if (b.def.produces) btn(this.p.primary[b.def.role] === b.id ? 'Primär ✓' : 'Primär', () => { this.p.primary[b.def.role] = b.id; this.selKey = null; this.updateSelInfo(); });
        if (b.def.sw) btn('Feuern', () => { if (b.charge >= g.swTime) { this.swBuilding = b; this.setMode('sw'); } });
      }
      box.appendChild(cmds);
    }

    // ---------- Minikarte ----------
    drawMinimap() {
      const g = this.g, m = g.map, ctx = this.mmCtx, W = this.mm.width, H = this.mm.height;
      if (!this.radarOn()) return;
      const sc = Math.min(W / m.w, H / m.h), ox = (W - m.w * sc) / 2, oy = (H - m.h * sc) / 2;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(m.minimapBase, ox, oy, m.w * sc, m.h * sc);
      // Kristallit
      ctx.fillStyle = '#22d3ee';
      for (let y = 0; y < m.h; y += 1) for (let x = 0; x < m.w; x += 1) { const i = y * m.w + x; if (m.ore[i] > 0 && g.explored[i]) ctx.fillRect(ox + x * sc, oy + y * sc, sc, sc); }
      for (const b of g.buildings) {
        if (b.dead || !(g.allied(this.p, b.owner) || b.seen)) continue;
        ctx.fillStyle = b.owner.color; ctx.fillRect(ox + b.tx * sc, oy + b.ty * sc, b.w * sc, b.h * sc);
      }
      for (const u of g.units) {
        if (u.dead || !g.canSee(this.p, u)) continue;
        ctx.fillStyle = u.owner.color; const s = Math.max(2, sc * 1.2);
        ctx.fillRect(ox + u.x / T * sc - s / 2, oy + u.y / T * sc - s / 2, s, s);
      }
      // Nebel
      if (!g.cfg.reveal) { ctx.imageSmoothingEnabled = true; ctx.drawImage(this.r.fogCv, ox, oy, m.w * sc, m.h * sc); }
      // Alarme
      for (const a of g.alerts) { const age = g.time - a.t; if (age > 4) continue; ctx.strokeStyle = 'rgba(248,113,113,' + (1 - age / 4) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + a.x / T * sc, oy + a.y / T * sc, 4 + (age % 1) * 12, 0, 7); ctx.stroke(); }
      g.alerts = g.alerts.filter(a => g.time - a.t < 4);
      // Kamera
      const cam = this.r.cam;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.strokeRect(ox + cam.x / T * sc, oy + cam.y / T * sc, this.r.vw / cam.zoom / T * sc, this.r.vh / cam.zoom / T * sc);
    }
  }
  RTS.HUD = HUD;
})();
