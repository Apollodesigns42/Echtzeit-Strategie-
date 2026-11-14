'use strict';
// ===== Kompendium: Nachschlagewerk für Einheiten, Gebäude, Forschung und Fähigkeiten =====
(function () {
  const D = RTS.data;
  const $ = (id) => document.getElementById(id);
  const ARMORS = ['inf', 'light', 'heavy', 'air', 'bld'];
  const ARMOR_SHORT = { inf: 'Infanterie', light: 'Leicht', heavy: 'Schwer', air: 'Luft', bld: 'Gebäude' };
  const TARGETS = { both: 'Boden & Luft', air: 'nur Luft', ground: 'nur Boden' };

  // Schaden pro Sekunde gegen jede Panzerungsklasse
  function dps(weapons) {
    const out = {};
    for (const a of ARMORS) {
      let s = 0;
      for (const w of weapons) {
        if (a === 'air' ? w.targets === 'ground' : w.targets === 'air') continue;
        s += w.dmg * (w.salvo || 1) / w.cd * ((D.WARHEADS[w.wh] || {})[a] || 0);
      }
      out[a] = s;
    }
    return out;
  }
  function dpsRow(weapons) {
    if (!weapons.length) return '';
    const d = dps(weapons), max = Math.max(...Object.values(d), 1);
    const range = Math.max(...weapons.map(w => w.range));
    const minR = weapons.every(w => w.minRange) ? Math.min(...weapons.map(w => w.minRange)) : 0;
    const gr = weapons.some(w => w.targets !== 'air'), ai = weapons.some(w => w.targets !== 'ground');
    const tg = TARGETS[gr && ai ? 'both' : ai ? 'air' : 'ground'];
    return `<div class="cst">Reichweite ${range}${minR ? ' (mind. ' + minR + ')' : ''} · Ziele: ${tg}</div>` +
      '<div class="dps">' + ARMORS.map(a => `<div><b style="opacity:${0.35 + 0.65 * d[a] / max}">${d[a] ? Math.round(d[a]) : '–'}</b>${ARMOR_SHORT[a]}</div>`).join('') + '</div>';
  }
  function reqText(def, faction) {
    const roles = [];
    if (def.kind === 'unit') roles.push(def.producer);
    for (const r of def.req || []) roles.push(r);
    const names = roles.map(r => (D.BUILDINGS[faction + '_' + r] || {}).name || r);
    return names.length ? `<div class="cst creq">Benötigt: ${Array.from(new Set(names)).join(', ')}</div>` : '';
  }
  function card(def, color, body) {
    const el = document.createElement('div'); el.className = 'ccard';
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
    cv.getContext('2d').drawImage(RTS.draw.cameo(def, color), 0, 0);
    el.appendChild(cv);
    const tx = document.createElement('div'); tx.className = 'ctext'; tx.innerHTML = body; el.appendChild(tx);
    return el;
  }
  function textCard(color, symbol, body) {
    const el = document.createElement('div'); el.className = 'ccard';
    el.innerHTML = `<div class="cicon" style="color:${color};border-color:${color}">${symbol}</div><div class="ctext">${body}</div>`;
    return el;
  }
  function section(box, title, cards) {
    if (!cards.length) return;
    const h = document.createElement('h3'); h.textContent = title; box.appendChild(h);
    const g = document.createElement('div'); g.className = 'cgrid'; cards.forEach(c => g.appendChild(c)); box.appendChild(g);
  }
  const unitCard = (u, color) => card(u, color,
    `<div class="cn">${u.name} <span class="cc">$${u.cost}</span></div>` +
    `<div class="cst">Struktur ${u.hp} · ${D.ARMOR_NAMES[u.armor]} · Tempo ${u.speed} · Sicht ${u.sight} · Bauzeit ${u.time}s</div>` +
    `<div class="cd">${u.desc}</div>${dpsRow(u.weapons)}${reqText(u, u.faction)}`);
  const bldCard = (b, color, faction) => card(b, color,
    `<div class="cn">${b.name}${b.cost && b.buildable !== false ? ` <span class="cc">$${b.cost}</span>` : ''}</div>` +
    `<div class="cst">Struktur ${Math.round(b.hp * 1.4)}${b.power ? ' · Energie ' + (b.power > 0 ? '+' : '') + b.power : ''} · ${b.w}×${b.h} Felder${b.time ? ' · Bauzeit ' + b.time + 's' : ''}</div>` +
    `<div class="cd">${b.desc}</div>${dpsRow(b.weapons)}${faction ? reqText(b, faction) : ''}`);

  function renderFaction(box, f) {
    const F = D.FACTIONS[f], col = F.color;
    const intro = document.createElement('div'); intro.className = 'cintro'; intro.style.borderLeftColor = col;
    intro.innerHTML = `<b style="color:${col}">${F.name}</b> – <i>„${F.motto}“</i><br>${F.desc}`;
    box.appendChild(intro);
    for (const [tab, title] of [['inf', 'Infanterie'], ['veh', 'Fahrzeuge'], ['air', 'Lufteinheiten']]) section(box, title, D.itemsFor(f, tab).map(u => unitCard(u, col)));
    section(box, 'Basisgebäude', D.ROLE_ORDER.map(r => D.BUILDINGS[f + '_' + r]).filter(b => b.cat === 'base').map(b => bldCard(b, col, f)));
    section(box, 'Verteidigung', D.itemsFor(f, 'defense').map(b => bldCard(b, col, f)));
    section(box, 'Forschung', D.itemsFor(f, 'research').map(r => card(r, col,
      `<div class="cn">${r.name} <span class="cc">$${r.cost}</span></div><div class="cst">Dauer ${r.time}s</div><div class="cd">${r.desc}</div>${reqText(r, f)}`)));
    const pw = D.powersFor(f).map(p => textCard(p.color, '✦',
      `<div class="cn">${p.name} <span class="cc">$${p.cost}</span></div><div class="cst">Taste ${p.key} · Abklingzeit ${p.cd}s · Radius ${p.radius} Felder</div><div class="cd">${p.desc}</div><div class="cst creq">Benötigt: ${D.BUILDINGS[f + '_' + p.req].name}</div>`));
    pw.push(textCard('#f87171', '☢', `<div class="cn">${F.sw.name}</div><div class="cst">Superwaffe · Ladezeit 5:00 · Radius ${F.sw.radius} Felder · Schaden ${F.sw.dmg}</div><div class="cd">Verheerender Flächenangriff auf ein beliebiges Ziel. Alle Spieler sehen den Countdown.</div><div class="cst creq">Benötigt: ${D.BUILDINGS[f + '_sw'].name}</div>`));
    section(box, 'Spezialfähigkeiten & Superwaffe', pw);
  }
  function renderGeneral(box) {
    section(box, 'Neutrale Gebäude (mit Ingenieur erobern)', D.NEUTRAL.map(n => bldCard(D.BUILDINGS[n.id], '#9aa3ad', null)));
    section(box, 'Bonuskisten', [textCard('#facc15', '?', '<div class="cn">Bonuskiste</div><div class="cd">Erscheint im Gefecht zufällig auf der Karte. Die erste Bodeneinheit, die sie erreicht, erhält einen Bonus: Credits, Heilung aller Einheiten in der Nähe, eine Beförderung, eine kostenlose Verstärkung oder Aufklärungsdaten.</div>')]);
    const h = document.createElement('h3'); h.textContent = 'Schadenstabelle (Wirkung in Prozent)'; box.appendChild(h);
    const names = { bullet: 'MG / Gewehr', cannon: 'Kanone', rocket: 'Rakete', flame: 'Flammen', laser: 'Laser / Prisma', acid: 'Säure', artillery: 'Artillerie', claw: 'Klauen', flak: 'Flak' };
    let t = '<table class="stats ctable"><tr><th>Waffe</th>' + ARMORS.map(a => `<th>${ARMOR_SHORT[a]}</th>`).join('') + '</tr>';
    for (const k in names) t += `<tr><td>${names[k]}</td>` + ARMORS.map(a => { const v = Math.round(D.WARHEADS[k][a] * 100); return `<td style="color:${v >= 100 ? '#4ade80' : v >= 60 ? '#d7dee5' : v > 0 ? '#f87171' : '#55606b'}">${v || '–'}</td>`; }).join('') + '</tr>';
    const tb = document.createElement('div'); tb.innerHTML = t + '</table>'; box.appendChild(tb);
    const tips = document.createElement('div'); tips.className = 'cintro';
    tips.innerHTML = '<b>Tipps</b><br>• Ingenieure erobern feindliche Gebäude erst, wenn deren Struktur unter 50 % liegt – und reparieren eigene Gebäude sofort vollständig.<br>' +
      '• Eroberte Bohrer und Beobachtungsposten erweitern den Baubereich: So entstehen vorgeschobene Basen.<br>' +
      '• Artillerie hat eine Mindestreichweite und braucht Begleitschutz.<br>• Schwere Fahrzeuge überrollen Infanterie; Raketentrupps und Säurespucker kontern Fahrzeuge.<br>' +
      '• Getarnte Einheiten werden von Verteidigungsanlagen, Einheiten in der Nähe und dem Radarscan enttarnt.<br>• Ohne Energie fallen Verteidigung und Radar aus und die Produktion halbiert sich.';
    box.appendChild(tips);
  }

  RTS.codex = {
    tab: 'allianz',
    init() { this.render(); },
    render() {
      const tabs = $('codex-tabs'), body = $('codex-body');
      if (!tabs) return;
      tabs.innerHTML = '';
      const entries = D.FACTION_ORDER.map(f => [f, D.FACTIONS[f].name, D.FACTIONS[f].color]).concat([['general', 'Allgemein', '#f5b301']]);
      for (const [id, name, col] of entries) {
        const b = document.createElement('button'); b.className = 'ctab' + (id === this.tab ? ' sel' : ''); b.style.borderTopColor = col;
        b.innerHTML = `<b style="color:${col}">${name}</b>`;
        b.onclick = () => { this.tab = id; if (RTS.audio) { RTS.audio.init(); RTS.audio.play('click'); } this.render(); };
        tabs.appendChild(b);
      }
      body.innerHTML = ''; body.scrollTop = 0;
      if (this.tab === 'general') renderGeneral(body); else renderFaction(body, this.tab);
    },
  };
})();
