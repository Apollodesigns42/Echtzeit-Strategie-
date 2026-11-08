# Kristallfront – Echtzeit-Strategie

Ein Echtzeit-Strategiespiel im Stil klassischer Basisbau-RTS (Seitenleiste, Rohstoffernte, Energie, Technologiebaum, Superwaffen).
Es läuft komplett im Browser – ohne Installation, ohne Build-Schritt und ohne externe Grafiken (alles wird prozedural gezeichnet).

## Starten

1. Repository herunterladen bzw. klonen.
2. `index.html` in einem aktuellen Browser öffnen (Chrome, Edge, Firefox).

Alternativ über einen lokalen Webserver, z. B. `python -m http.server` im Projektordner und dann `http://localhost:8000` aufrufen.
Optimiert für den PC mit Maus und Tastatur (empfohlen: mind. 1280×720).

## Spielmodi

- **Drei Kampagnen mit je 6 Missionen** – Briefings, Missionsziele und Skript-Ereignissen; Fortschritt wird im Browser gespeichert, drei Schwierigkeitsgrade:
  - *Operation Morgenröte* (Allianz): Außenposten, Basisaufbau, Belagerung, Präzisionsschlag, Vael-Invasion, Entscheidungsschlacht.
  - *Aus der Asche* (Schattenkollektiv): Tarnüberfall, Untergrundbasis, Konvoi-Hinterhalt, Gefangenenbefreiung, Bündnis mit den Vael, Verrat in der letzten Schlacht.
  - *Der Ruf des Kristalls* (Vael): Erwachen am Riss, Nexus-Aufbau, Kristallit-Sammelziel unter Beschuss, Schutz des Rissgenerators, verteilte Horchposten auf der Seenplatte, Kampf gegen beide Menschenfraktionen.
- **Gefecht gegen Bots** – du gegen 1 bis 3 Bots (Leicht / Normal / Schwer / Brutal), frei wählbare Fraktion, Farbe, Teams und Startposition,
  6 Karten (inkl. Zufallskarte) in 4 Klimazonen, Optionen für Startkapital, Spieltempo, Superwaffen und aufgedeckte Karte.

## Fraktionen

| Fraktion | Stil | Besonderheit | Superwaffe |
|---|---|---|---|
| **Vereinigte Allianz** | schwer gepanzert, diszipliniert | +15 % Gebäude- und Fahrzeugstruktur, Railgun-Forschung | Orbitallanze |
| **Schattenkollektiv** | schnell, getarnt, Flammen & Laser | +10 % Tempo, getarnte Phantom-Panzer, Tarnfeld-Forschung | Ascheregen |
| **Die Vael** (Aliens) | Schwärme, Schwebeeinheiten | Regeneration aller Einheiten, Schweber überqueren Wasser/Lava | Dimensionsriss |

Jede Fraktion hat 12 Gebäude (Basis + Verteidigung), 9 Einheiten (Infanterie, Fahrzeuge, Artillerie, Elite-Einheit, Luft, Sammler, Bau-Fahrzeug)
und 6 Forschungen. Schadensarten (MG, Kanone, Rakete, Flamme, Laser, Säure, Artillerie, Flak) wirken unterschiedlich gegen
Infanterie, leichte/schwere Fahrzeuge, Luft und Gebäude. Einheiten sammeln Erfahrung (bis zu 3 ★).
Schwere Fahrzeuge überrollen feindliche Infanterie; Gruppen mit Angriffsbefehl bewegen sich im Tempo der langsamsten Einheit.

## Balancing

Das Balancing wurde automatisiert geprüft:

- **Einheitenduelle:** alle Bodeneinheiten paarweise mit gleichem Budget gegeneinander.
- **Gemischte Armeen:** typische KI-Zusammensetzungen je Fraktion im offenen Feld.
- **Komplette Partien:** KI gegen KI (Schwer und Normal), alle Fraktionspaarungen, beide Startpositionen, drei Karten.

Ergebnisse und Werte stehen in `js/data.js`; Siegquoten der Fraktionen liegen jeweils grob zwischen 40 und 60 %.

## Steuerung

| Eingabe | Aktion |
|---|---|
| Linksklick / Rahmen ziehen | Auswählen |
| Doppelklick / **W** | Alle sichtbaren Einheiten dieses Typs |
| Rechtsklick | Bewegen, Angreifen, Ernten, Sammelpunkt setzen |
| Rechte/mittlere Maustaste ziehen, Pfeiltasten, Bildschirmrand | Kamera |
| Mausrad | Zoom |
| **A** / Strg + Rechtsklick | Angriffsbewegung |
| **S** | Stopp |
| **D** | Bau-Fahrzeug aufbauen |
| **Q** | Alle Kampfeinheiten |
| Strg + 1–9 / 1–9 | Gruppe speichern / wählen (2× = Kamera) |
| **H** / Leertaste | Zur Basis / zur letzten Meldung |
| **R** / **X** | Reparieren / Verkaufen |
| Tab | Nächste Bauleiste |
| + / − | Spieltempo |
| Esc | Pause bzw. Modus abbrechen |

In den Einstellungen gibt es zusätzlich eine „klassische“ Steuerung (Linksklick = Befehl).

## Technik

Reines HTML5-Canvas + JavaScript (keine Abhängigkeiten):

- `js/data.js` – Fraktionen, Einheiten, Gebäude, Waffen, Forschung (Balancing hier anpassen)
- `js/map.js` – prozedurale Kartengenerierung und Geländedarstellung
- `js/path.js` – A*-Wegfindung mit Wegglättung
- `js/entities.js` – Einheiten-/Gebäudelogik (Bewegung, Kampf, Sammler)
- `js/game.js` – Simulation, Produktion, Energie, Nebel des Krieges, Superwaffen
- `js/ai.js` – Bot-KI (Basisbau, Wirtschaft, Forschung, Angriffswellen, Verteidigung)
- `js/gfx.js` – Grafik-Grundbausteine (Sprite-Cache, Materialien, weiche Schatten, Explosions- und Rauch-Sprites)
- `js/draw.js`, `js/render.js` – detaillierte prozedurale Einheiten-/Gebäudegrafik (in 2–4-facher Auflösung vorgerendert), Gelände, animiertes Wasser/Lava, Effekte
- `js/hud.js` – Seitenleiste, Minikarte, Eingabe
- `js/campaign.js`, `js/campaign2.js` – Kampagnen (Allianz bzw. Schattenkollektiv und Vael)
- `js/audio.js` – synthetisierte Soundeffekte, Musik und Sprachansagen (Web Audio / Sprachausgabe des Browsers)

Testmodus: `index.html?autostart&bots=3&level=hard&autoplay&reveal` startet direkt ein Gefecht, bei dem auch die eigene Seite von der KI gespielt wird.
