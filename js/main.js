'use strict';
// ===== Anwendung: Menüs, Spielstart, Hauptschleife =====
(function () {
  const U = RTS.util, D = RTS.data, T = U.TILE;
  const $ = (id) => document.getElementById(id);
  const STEP = 1 / 30;
  const SPEEDS = [0.5, 0.75, 1, 1.35, 1.7, 2.5];

  const App = {
    settings: Object.assign({ volume: 0.5, voice: true, music: true, edgeScroll: true, scrollSpeed: 900, classic: false }, U.store.get('kf_settings', {})),
    progress: U.store.get('kf_progress', { done: [] }),
    screen: 'menu', prevScreen: 'menu', inGame: false, paused: false,
    game: null, renderer: null, hud: null, lastCfg: null, lastMeta: null,

    init() {
      document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
        const go = b.dataset.go; RTS.audio.init(); RTS.audio.play('click');
        this.show(go === 'back' ? this.prevScreen : go);
      }));
      RTS.audio.setVolume(this.settings.volume); RTS.audio.voiceOn = this.settings.voice; RTS.audio.musicOn = this.settings.music;
      this.initSettings(); this.initSkirmish(); this.initCampaign(); this.initMenuBg();
      $('pz-resume').onclick = () => this.pause(false);
      $('pz-restart').onclick = () => { this.pause(false); this.startGame(this.lastCfg, this.lastMeta); };
      $('pz-quit').onclick = () => { this.pause(false); this.stopGame(); this.show(this.lastMeta && this.lastMeta.mission ? 'campaign' : 'menu'); };
      $('pz-vol').oninput = (e) => { this.settings.volume = +e.target.value; RTS.audio.setVolume(this.settings.volume); this.saveSettings(); };
      window.addEventListener('beforeunload', () => this.saveSettings());
      // Debug/Test-Schnittstelle
      window.KF = this;
      const q = new URLSearchParams(location.search);
      if (q.has('autostart')) this.quickSkirmish(q);
    },
    saveSettings() { U.store.set('kf_settings', this.settings); },
    show(name) {
      if (name !== 'settings') this.prevScreen = this.screen === 'settings' ? this.prevScreen : this.screen;
      if (name === 'settings') this.prevScreen = this.inGame ? 'game' : this.screen;
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      $('scr-' + name).classList.add('active');
      if (name !== 'game') document.documentElement.style.setProperty('--accent', '#f5b301');
      this.screen = name;
      if (name === 'campaign') this.renderMissionList();
      if (name === 'skirmish') this.updatePreview();
    },

    // ---------- Einstellungen ----------
    initSettings() {
      const s = this.settings;
      const bind = (id, key, isBool, after) => {
        const el = $(id); if (isBool) el.checked = s[key]; else el.value = s[key];
        el.addEventListener(isBool ? 'change' : 'input', () => { s[key] = isBool ? el.checked : +el.value; if (after) after(); this.saveSettings(); });
      };
      bind('set-vol', 'volume', false, () => RTS.audio.setVolume(s.volume));
      bind('set-voice', 'voice', true, () => { RTS.audio.voiceOn = s.voice; });
      bind('set-music', 'music', true, () => { RTS.audio.musicOn = s.music; if (!s.music) RTS.audio.stopMusic(); });
      bind('set-edge', 'edgeScroll', true);
      bind('set-scroll', 'scrollSpeed', false);
      bind('set-classic', 'classic', true);
    },

    // ---------- Gefecht ----------
    initSkirmish() {
      const ms = $('sk-map');
      RTS.MAPS.forEach((m, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${m.name} (${m.size}×${m.size}, ${m.maxPlayers} Spieler)`; ms.appendChild(o); });
      ms.onchange = () => this.updatePreview();
      const body = $('sk-slots');
      const facOpts = '<option value="random">Zufällig</option>' + D.FACTION_ORDER.map(f => `<option value="${f}">${D.FACTIONS[f].name}</option>`).join('');
      const colOpts = D.PLAYER_COLORS.map((c, i) => `<option value="${c.hex}" style="color:${c.hex}">■ ${c.name}</option>`).join('');
      const teamOpts = '<option value="0">–</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>';
      const startOpts = '<option value="-1">Zufall</option><option value="0">Nordwest</option><option value="1">Südost</option><option value="2">Nordost</option><option value="3">Südwest</option>';
      const defaults = [
        { type: 'human', fac: 'allianz', col: 0 }, { type: 'normal', fac: 'schatten', col: 1 }, { type: 'closed', fac: 'vael', col: 4 }, { type: 'closed', fac: 'random', col: 2 },
      ];
      defaults.forEach((d, i) => {
        const tr = document.createElement('tr');
        const typeCell = i === 0 ? `<input type="text" id="sl-name" value="Commander" maxlength="16" style="width:120px">` :
          `<select class="sl-type"><option value="closed">Geschlossen</option><option value="easy">Bot – Leicht</option><option value="normal">Bot – Normal</option><option value="hard">Bot – Schwer</option><option value="brutal">Bot – Brutal</option></select>`;
        tr.innerHTML = `<td>${i + 1}</td><td>${typeCell}</td><td><select class="sl-fac">${facOpts}</select></td><td><select class="sl-col">${colOpts}</select></td><td><select class="sl-team">${teamOpts}</select></td><td><select class="sl-start">${startOpts}</select></td>`;
        body.appendChild(tr);
        tr.querySelector('.sl-fac').value = d.fac;
        tr.querySelector('.sl-col').value = D.PLAYER_COLORS[d.col].hex;
        if (i > 0) tr.querySelector('.sl-type').value = d.type;
        tr.querySelectorAll('select').forEach(s => s.addEventListener('change', () => this.updatePreview()));
      });
      // Fraktionskarten
      const fc = $('faction-cards');
      for (const f of D.FACTION_ORDER) {
        const F = D.FACTIONS[f];
        const el = document.createElement('div'); el.className = 'fcard'; el.style.borderTopColor = F.color;
        el.innerHTML = `<b style="color:${F.color}">${F.name}</b><i>„${F.motto}“</i><p>${F.desc}</p><p class="small">Superwaffe: ${F.sw.name}</p>`;
        fc.appendChild(el);
      }
      $('btn-sk-start').onclick = () => this.startSkirmish();
    },
    readSlots() {
      const rows = Array.from($('sk-slots').children);
      const out = [];
      rows.forEach((tr, i) => {
        const type = i === 0 ? 'human' : tr.querySelector('.sl-type').value;
        if (type === 'closed') return;
        out.push({ type, faction: tr.querySelector('.sl-fac').value, color: tr.querySelector('.sl-col').value, team: +tr.querySelector('.sl-team').value, start: +tr.querySelector('.sl-start').value, name: i === 0 ? ($('sl-name').value || 'Commander') : null });
      });
      return out;
    },
    updatePreview() {
      const mi = +$('sk-map').value, md = RTS.MAPS[mi];
      $('sk-mapdesc').textContent = md.desc;
      const cv = $('sk-preview'), ctx = cv.getContext('2d');
      const def = Object.assign({}, md); if (md.seed === 0) def.seed = 777;
      const m = new RTS.GameMap(def); m.generate(4);
      m.renderMinimapBase();
      ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 220, 220);
      ctx.drawImage(m.minimapBase, 0, 0, 220, 220);
      const sc = 220 / m.w;
      ctx.fillStyle = '#22d3ee'; for (let i = 0; i < m.ore.length; i++) if (m.ore[i]) ctx.fillRect((i % m.w) * sc, Math.floor(i / m.w) * sc, sc, sc);
      ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const names = ['NW', 'SO', 'NO', 'SW'];
      m.starts.forEach((s, i) => { ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.arc(s.tx * sc, s.ty * sc, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(names[i], s.tx * sc, s.ty * sc); });
      if (md.seed === 0) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 95, 220, 30); ctx.fillStyle = '#fff'; ctx.fillText('Zufällig generiert', 110, 110); }
    },
    startSkirmish() {
      const slots = this.readSlots();
      if (slots.length < 2) { alert('Bitte mindestens einen Bot hinzufügen.'); return; }
      const md = RTS.MAPS[+$('sk-map').value];
      const map = Object.assign({}, md); if (md.seed === 0) map.seed = Math.floor(Math.random() * 1e9);
      // Startpositionen zuteilen
      const taken = new Set(slots.filter(s => s.start >= 0).map(s => s.start));
      let free = [0, 1, 2, 3].filter(i => !taken.has(i));
      // bei 2 Spielern möglichst diagonal
      if (slots.length === 2 && slots.every(s => s.start < 0)) free = Math.random() < 0.5 ? [0, 1] : [2, 3];
      else free.sort(() => Math.random() - 0.5);
      const usedNames = new Set();
      const botNames = ['General Varga', 'Oberst Kessler', 'Kommandant Rhee', 'Marschall Dorn', 'Archon Sel', 'Präfekt Ilko', 'Hexarch Vy', 'Major Brandt'];
      const players = slots.map((s, i) => {
        let fac = s.faction === 'random' ? D.FACTION_ORDER[Math.floor(Math.random() * 3)] : s.faction;
        let start = s.start >= 0 ? s.start : free.shift();
        let name = s.name; if (!name) { do { name = botNames[Math.floor(Math.random() * botNames.length)]; } while (usedNames.has(name)); usedNames.add(name); }
        return { name, faction: fac, color: s.color, team: s.team ? s.team : 0, start, human: s.type === 'human', ai: s.type === 'human' ? null : s.type, credits: +$('sk-credits').value };
      });
      players.forEach((p, i) => { if (!p.team) p.team = 100 + i; });
      const cfg = { map, players, numStarts: 4, gameSpeed: +$('sk-speed').value, superweapons: $('sk-sw').checked, reveal: $('sk-reveal').checked, startUnits: $('sk-start').value };
      this.startGame(cfg, { mode: 'skirmish' });
    },
    quickSkirmish(q) {
      const n = +(q.get('bots') || 1);
      const facs = ['allianz', 'schatten', 'vael', 'schatten'];
      const players = [{ name: 'Commander', faction: q.get('faction') || 'allianz', color: '#3b82f6', team: 1, start: 0, human: true, credits: 10000 }];
      for (let i = 0; i < n; i++) players.push({ name: 'Bot ' + (i + 1), faction: facs[i + 1], color: D.PLAYER_COLORS[i + 1].hex, team: 100 + i, start: i + 1, ai: q.get('level') || 'normal', credits: 10000 });
      if (q.has('autoplay')) players[0].ai = q.get('level') || 'normal';
      const md = RTS.MAPS[+(q.get('map') || 0)];
      this.startGame({ map: Object.assign({}, md, { seed: md.seed || 99 }), players, numStarts: 4, gameSpeed: 1, superweapons: true, reveal: q.has('reveal'), startUnits: 'standard' }, { mode: 'skirmish' });
    },

    // ---------- Kampagne ----------
    initCampaign() {
      this.selMission = 0; this.selCamp = 0;
      $('btn-mission-start').onclick = () => {
        const m = this.missions()[this.selMission];
        if (!this.missionUnlocked(this.selMission)) return;
        const cfg = RTS.campaign.buildConfig(m, $('camp-diff').value);
        this.startGame(cfg, { mode: 'campaign', camp: this.selCamp, mission: this.selMission });
      };
    },
    missions(ci) { return RTS.campaign.CAMPAIGNS[ci == null ? this.selCamp : ci].missions; },
    missionUnlocked(i) { return i === 0 || this.progress.done.includes(this.missions()[i - 1].id); },
    renderMissionList() {
      const camps = RTS.campaign.CAMPAIGNS, cur = camps[this.selCamp];
      const tabs = $('camp-tabs'); tabs.innerHTML = '';
      camps.forEach((c, ci) => {
        const F = D.FACTIONS[c.faction];
        const done = c.missions.filter(m => this.progress.done.includes(m.id)).length;
        const el = document.createElement('button'); el.className = 'ctab' + (ci === this.selCamp ? ' sel' : ''); el.style.borderTopColor = F.color;
        el.innerHTML = `<b style="color:${F.color}">${c.title}</b><span>${F.name} · ${done}/${c.missions.length} Missionen</span>`;
        el.onclick = () => { this.selCamp = ci; this.selMission = 0; RTS.audio.init(); RTS.audio.play('click'); this.renderMissionList(); };
        tabs.appendChild(el);
      });
      $('camp-title').textContent = 'Kampagne: ' + cur.title;
      document.documentElement.style.setProperty('--accent', { allianz: '#f5b301', schatten: '#ef4444', vael: '#c084fc' }[cur.faction]);
      const box = $('mission-list'); box.innerHTML = '';
      this.missions().forEach((m, i) => {
        const el = document.createElement('div');
        const unlocked = this.missionUnlocked(i), done = this.progress.done.includes(m.id);
        el.className = 'mission' + (i === this.selMission ? ' sel' : '') + (unlocked ? '' : ' locked');
        el.innerHTML = `<div class="mn">${i + 1}. ${m.title}${done ? '<span class="done">✔</span>' : ''}</div><div class="ms">${unlocked ? m.sub : 'Gesperrt'}</div>`;
        el.onclick = () => { if (!unlocked) return; this.selMission = i; RTS.audio.init(); RTS.audio.play('click'); this.renderMissionList(); };
        box.appendChild(el);
      });
      const m = this.missions()[this.selMission];
      $('brief-title').textContent = `Mission ${this.selMission + 1}: ${m.title}`;
      const enemies = m.players.filter(p => !p.human).map(p => D.FACTIONS[p.faction].name);
      $('brief-meta').textContent = `Fraktion: ${D.FACTIONS[m.players[0].faction].name} · Gegner: ${enemies.join(', ')} · Gebiet: ${RTS.BIOMES[m.map.biome].name}`;
      $('brief-text').textContent = m.briefing;
    },

    // ---------- Spielablauf ----------
    startGame(cfg, meta) {
      this.stopGame();
      this.lastCfg = cfg; this.lastMeta = meta;
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      $('scr-game').classList.add('active'); this.screen = 'game';
      $('ov-end').classList.add('hidden');
      // Mission-Objekt frisch halten (missionState ist im Spiel)
      const game = new RTS.Game(cfg);
      game.init();
      game.map.renderTerrain();
      const renderer = new RTS.Renderer($('view'), game);
      const hud = new RTS.HUD(game, renderer, this);
      this.game = game; this.renderer = renderer; this.hud = hud;
      this.inGame = true; this.paused = false; this.speed = cfg.gameSpeed || 1; this.updateSpeedInd();
      const hp = game.human || game.players[0];
      const s = hp.start || game.map.starts[0];
      const first = game.buildings.find(b => b.owner === hp) || game.units.find(u => u.owner === hp);
      if (first) renderer.centerOn(first.x, first.y); else renderer.centerOn((s.tx + 0.5) * T, (s.ty + 0.5) * T);
      game.on('gameOver', (r) => setTimeout(() => this.showEnd(r), 2200));
      RTS.audio.init(); if (this.settings.music) RTS.audio.startMusic();
      this.acc = 0; this.last = performance.now();
      const loop = (now) => {
        if (this.game !== game) return;
        const dt = Math.min(0.25, (now - this.last) / 1000); this.last = now;
        if (!this.paused) {
          this.acc += dt * this.speed;
          let n = 0;
          while (this.acc >= STEP && n < 10) { game.update(STEP); this.acc -= STEP; n++; }
          if (n >= 10) this.acc = 0;
        }
        hud.update(dt);
        renderer.draw(Math.min(1, this.acc / STEP), hud, dt);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    },
    stopGame() {
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.hud) this.hud.destroy();
      this.game = null; this.hud = null; this.renderer = null; this.inGame = false;
      RTS.audio.stopMusic();
      if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { /* */ }
    },
    pause(on) {
      if (!this.inGame) return;
      if (this.game && this.game.over && on) return;
      this.paused = on;
      $('ov-pause').classList.toggle('hidden', !on);
      $('pz-vol').value = this.settings.volume;
    },
    changeSpeed(d) {
      let i = SPEEDS.indexOf(this.speed); if (i < 0) i = 2;
      this.speed = SPEEDS[U.clamp(i + d, 0, SPEEDS.length - 1)]; this.updateSpeedInd();
    },
    updateSpeedInd() { $('speedind').textContent = this.speed === 1 ? '' : '×' + this.speed; },
    showEnd(result) {
      const g = this.game; if (!g) return;
      this.paused = true;
      const win = result === 'win';
      const t = $('end-title'); t.textContent = win ? 'Sieg!' : result === 'spectate' ? 'Spiel beendet' : 'Niederlage';
      t.className = win ? 'win' : 'lose';
      const meta = this.lastMeta;
      let sub = 'Spielzeit: ' + U.fmtTime(g.time);
      if (meta.mode === 'campaign') {
        const ms = this.missions(meta.camp), m = ms[meta.mission];
        sub = `Mission ${meta.mission + 1}: ${m.title} – ` + (win ? 'Mission erfüllt.' : 'Mission gescheitert.') + ' ' + sub;
        if (win && !this.progress.done.includes(m.id)) { this.progress.done.push(m.id); U.store.set('kf_progress', this.progress); }
      }
      $('end-sub').textContent = sub;
      RTS.audio.say(win ? 'Mission erfüllt' : 'Mission gescheitert');
      const rows = g.players.map(p => `<tr><td style="color:${p.color}">${p.name} (${p.fdef.short})${p.isHuman ? ' – Sie' : ''}${p.defeated ? ' ✖' : ''}</td><td>${p.stats.unitsBuilt}</td><td>${p.stats.unitsLost}</td><td>${p.stats.kills}</td><td>${p.stats.bldBuilt}</td><td>${p.stats.bldLost}</td><td>${p.stats.bldKilled}</td><td>${Math.round(p.stats.harvested).toLocaleString('de-DE')}</td></tr>`).join('');
      $('end-stats').innerHTML = `<tr><th>Spieler</th><th>Einheiten gebaut</th><th>verloren</th><th>Abschüsse</th><th>Gebäude gebaut</th><th>verloren</th><th>zerstört</th><th>Kristallit</th></tr>` + rows;
      const bb = $('end-buttons'); bb.innerHTML = '';
      const btn = (label, fn, primary) => { const b = document.createElement('button'); b.className = 'btn' + (primary ? ' primary' : ''); b.textContent = label; b.onclick = fn; bb.appendChild(b); };
      btn('Hauptmenü', () => { this.stopGame(); this.show('menu'); });
      btn('Weiterspielen', () => { $('ov-end').classList.add('hidden'); this.paused = false; });
      btn('Erneut spielen', () => this.startGame(this.lastCfg, meta));
      if (meta.mode === 'campaign' && win && meta.mission + 1 < this.missions(meta.camp).length) btn('Nächste Mission', () => { this.stopGame(); this.selCamp = meta.camp; this.selMission = meta.mission + 1; this.show('campaign'); }, true);
      $('ov-end').classList.remove('hidden');
    },

    // ---------- Menühintergrund ----------
    initMenuBg() {
      const cv = $('menu-bg'), ctx = cv.getContext('2d');
      const shards = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: 4 + Math.random() * 18, v: 0.004 + Math.random() * 0.01, a: Math.random() * 6 }));
      const draw = (now) => {
        if (this.screen === 'game') { requestAnimationFrame(draw); return; }
        const w = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight;
        const g = ctx.createRadialGradient(w / 2, h * 0.6, 50, w / 2, h / 2, Math.max(w, h) * 0.8);
        g.addColorStop(0, '#13232b'); g.addColorStop(1, '#050608');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(103,232,249,0.05)'; ctx.lineWidth = 1;
        const off = (now / 60) % 40;
        for (let x = -40 + off; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = -40 + off; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        for (const s of shards) {
          s.y -= s.v * 0.2; if (s.y < -0.05) { s.y = 1.05; s.x = Math.random(); }
          const x = s.x * w, y = s.y * h, gl = 0.4 + 0.3 * Math.sin(now / 700 + s.a);
          ctx.fillStyle = `rgba(34,211,238,${gl * 0.5})`;
          ctx.beginPath(); ctx.moveTo(x, y - s.s); ctx.lineTo(x + s.s * 0.35, y); ctx.lineTo(x, y + s.s * 0.2); ctx.lineTo(x - s.s * 0.35, y); ctx.fill();
        }
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    },
  };

  window.addEventListener('DOMContentLoaded', () => App.init());
  RTS.App = App;
})();
