// =============================================================================
// MOONBASE — main.js
// Mappa 40x40, Fog of War, Rover con A* Pathfinding, Risorse nascoste
// =============================================================================

// ---------------------------------------------------------------------------
// COSTANTI DI CONFIGURAZIONE
// ---------------------------------------------------------------------------

const GRID_SIZE = 40;
const TILE_W = 64;
const TILE_H = 32;

const TILE_FILL_COLOR = 0x2a2a2a;
const TILE_STROKE_COLOR = 0x4a4a4a;
const TILE_STROKE_WIDTH = 1;
const TERRAIN_VARIANTS = 3;

const CAM_SPEED = 8;
const CAMERA_ZOOM = 1.5;
const CAMERA_ZOOM_MIN = 0.5;
const CAMERA_ZOOM_MAX = 2.5;
const CAMERA_ZOOM_SENSITIVITY = 0.0015;

// Tipi di terreno
const TERRAIN_NORMAL = 'normal';
const TERRAIN_ICE = 'ice';       // Ghiaccio — ciano tenue
const TERRAIN_REGOLITE = 'regolite';  // Regolite — grigio scuro

// Colori terreno (palette realistica)
const TERRAIN_COLORS = {
  normal: 0x5a5a5a,   // Luna Base: Grigio medio/chiaro
  ice: 0x7aa5b8,   // Ghiaccio: Azzurro polvere desaturato
  regolite: 0x222222    // Regolite: Grigio molto scuro
};

// Raggio di esplorazione del Rover (in tile)
const ROVER_EXPLORE_RADIUS = 2;

// Dimensione zona inizialmente esplorata (5x5 al centro)
const INITIAL_EXPLORED_SIZE = 5;

const BUILDINGS_INFO = {
  solar: { name: 'Pannello Solare', cost: 50, color: 0xffa500, height: 10, energyGenDay: 50, energyGenNight: 0, energyCons: 0 },
  hab: { name: 'Modulo Abitativo', cost: 100, color: 0x4da6ff, height: 30, energyGenDay: 0, energyGenNight: 0, energyCons: 30 },
  rtg: { name: 'RTG', cost: 150, color: 0x800080, height: 15, energyGenDay: 20, energyGenNight: 20, energyCons: 0 },
  isru: { name: 'Impianto ISRU O2', cost: 75, color: 0x00ffff, height: 20, energyGenDay: 0, energyGenNight: 0, energyCons: 20 },
  reactor: { name: 'SR-1 Freedom', cost: 1000, color: 0x00ffcc, height: 80, energyGenDay: 1000, energyGenNight: 1000, energyCons: 0 },
  regolite_ext: { name: 'Estrattore Regolite', cost: 100, color: 0xc97520, height: 18, energyGenDay: 0, energyGenNight: 0, energyCons: 10, regoliteGen: 5, terrain: 'regolite' },
  ice_ext: { name: 'Estrattore Ghiaccio', cost: 150, color: 0x00aacc, height: 18, energyGenDay: 0, energyGenNight: 0, energyCons: 15, ghiaccioGen: 5, terrain: 'ice' }
};

// Costo Rover
const ROVER_COST = 150;

// ---------------------------------------------------------------------------
// FUNZIONI DI CONVERSIONE COORDINATE
// ---------------------------------------------------------------------------

function cartesianToIsometric(col, row) {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

function isometricToCartesian(isoX, isoY) {
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const col = (isoX / halfW + isoY / halfH) / 2;
  const row = (isoY / halfH - isoX / halfW) / 2;
  return {
    col: Math.round(col),
    row: Math.round(row),
  };
}

// =============================================================================
// ALGORITMO A* PER PATHFINDING SU GRIGLIA 2D
// =============================================================================

/**
 * Implementazione di A* per griglie 2D.
 * Trova il percorso più breve da (startCol, startRow) a (endCol, endRow),
 * evitando le tile occupate da edifici.
 *
 * @param {boolean[][]} occupiedGrid - Griglia GRID_SIZE x GRID_SIZE, true = ostacolo
 * @param {number} startCol - Colonna di partenza
 * @param {number} startRow - Riga di partenza
 * @param {number} endCol - Colonna di arrivo
 * @param {number} endRow - Riga di arrivo
 * @returns {Array<{col: number, row: number}>|null} - Array di passi dal primo
 *   al nodo finale (incluso), oppure null se non esiste percorso.
 */
function aStarPathfind(occupiedGrid, startCol, startRow, endCol, endRow) {
  // --- Validazione dei confini ---
  if (
    startCol < 0 || startCol >= GRID_SIZE ||
    startRow < 0 || startRow >= GRID_SIZE ||
    endCol < 0 || endCol >= GRID_SIZE ||
    endRow < 0 || endRow >= GRID_SIZE
  ) {
    return null;
  }

  // Se la destinazione è occupata da un edificio, non possiamo arrivarci
  if (occupiedGrid[endRow][endCol]) return null;

  // --- Euristica: distanza di Manhattan (adatta a griglie senza diagonali) ---
  function heuristic(colA, rowA, colB, rowB) {
    return Math.abs(colA - colB) + Math.abs(rowA - rowB);
  }

  // --- Struttura nodo ---
  // Ogni nodo contiene: col, row, g (costo reale), f (g + h), parent
  const openSet = [];   // Min-heap semplificata come array
  const closedSet = new Set(); // Chiavi "col,row" già valutate

  // Mappa per accesso rapido ai nodi nell'openSet
  const gScores = {};

  function key(col, row) { return `${col},${row}`; }

  // Nodo iniziale
  const startKey = key(startCol, startRow);
  const h0 = heuristic(startCol, startRow, endCol, endRow);
  openSet.push({ col: startCol, row: startRow, g: 0, f: h0, parent: null });
  gScores[startKey] = 0;

  // Direzioni: su, giù, sinistra, destra (4 direzioni, no diagonali)
  const DIRS = [
    { dc: 0, dr: -1 }, // Su
    { dc: 0, dr: 1 },  // Giù
    { dc: -1, dr: 0 }, // Sinistra
    { dc: 1, dr: 0 }   // Destra
  ];

  while (openSet.length > 0) {
    // --- Trova il nodo con il valore f più basso (min-heap semplificata) ---
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIdx].f) lowestIdx = i;
    }
    const current = openSet.splice(lowestIdx, 1)[0];

    // --- Se abbiamo raggiunto la destinazione, ricostruisci il percorso ---
    if (current.col === endCol && current.row === endRow) {
      const path = [];
      let node = current;
      while (node) {
        path.unshift({ col: node.col, row: node.row });
        node = node.parent;
      }
      // Rimuovi il punto di partenza (il rover è già lì)
      path.shift();
      return path;
    }

    closedSet.add(key(current.col, current.row));

    // --- Esplora i vicini ---
    for (const dir of DIRS) {
      const nc = current.col + dir.dc;
      const nr = current.row + dir.dr;

      // Fuori dalla griglia?
      if (nc < 0 || nc >= GRID_SIZE || nr < 0 || nr >= GRID_SIZE) continue;

      // Già valutato?
      if (closedSet.has(key(nc, nr))) continue;

      // Occupato da un edificio?
      if (occupiedGrid[nr][nc]) continue;

      const tentativeG = current.g + 1; // Costo uniforme = 1 per passo
      const nk = key(nc, nr);

      // Se abbiamo già un percorso migliore per questo nodo, salta
      if (gScores[nk] !== undefined && tentativeG >= gScores[nk]) continue;

      // Aggiorna o aggiungi il nodo
      gScores[nk] = tentativeG;
      const h = heuristic(nc, nr, endCol, endRow);
      openSet.push({
        col: nc,
        row: nr,
        g: tentativeG,
        f: tentativeG + h,
        parent: current
      });
    }
  }

  // Nessun percorso trovato
  return null;
}

// ---------------------------------------------------------------------------
// SCENA PRINCIPALE: MoonbaseScene
// ---------------------------------------------------------------------------

class MoonbaseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MoonbaseScene' });
  }

  preload() {
    this.load.on('loaderror', (fileObj) => { console.error('Errore Caricamento Asset:', fileObj.key, fileObj.src); });
    this.load.image('rover-NE', './graphics/rover-NE.png');
    this.load.image('rover-NW', './graphics/rover-NW.png');
    this.load.image('rover-SE', './graphics/rover-SE.png');
    this.load.image('rover-SW', './graphics/rover-SW.png');
    this.load.image('solar-panel', './graphics/solar-panel.png');
    this.load.image('regolith-extractor', './graphics/regolith-extractor.png');
  }

  init() {
    this.regolite = 500;
    this.ghiaccio = 100;
    this.ossigeno = 100;
    this.fase = 1;
    this.lastEconomyTime = 0;
    this.isGamePaused = false; // Original
    this.isPaused = false; // Pausa Tattica
    this.emergencyTimer = 0; // seconds without oxygen
    this.deadlockTimer = 0; // seconds deadlocked
    this.selectedBuilding = null;
    this.occupiedTiles = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    this.buildings = [];

    // --- Terreno procedurale ---
    // Genera il tipo di terreno per ogni tile
    this.terrainGrid = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => {
        const rand = Math.random();
        if (rand < 0.08) return TERRAIN_ICE;        // ~8% Ghiaccio
        if (rand < 0.16) return TERRAIN_REGOLITE;    // ~8% Regolite
        return TERRAIN_NORMAL;
      })
    );

    // --- Fog of War ---
    // true = esplorata (visibile), false = coperta dalla nebbia
    this.exploredTiles = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));

    // Scopri zona iniziale 5x5 al centro
    const centerCol = Math.floor(GRID_SIZE / 2);
    const centerRow = Math.floor(GRID_SIZE / 2);
    const halfExplored = Math.floor(INITIAL_EXPLORED_SIZE / 2);
    for (let r = centerRow - halfExplored; r <= centerRow + halfExplored; r++) {
      for (let c = centerCol - halfExplored; c <= centerCol + halfExplored; c++) {
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
          this.exploredTiles[r][c] = true;
        }
      }
    }

    // --- Rover ---
    this.rovers = [];             // Array di oggetti rover
    this.selectedRover = null;    // Rover attualmente selezionato

    // Variabili per il sistema di energia, equipaggio e ciclo giorno/notte
    this.isDay = true;
    this.energiaProdotta = 0;
    this.energiaConsumata = 0;
    this.equipaggioTotale = 0;
    this.equipaggioImpiegato = 0;

    // --- Delta tracking (cambiamento netto per tick/secondo) ---
    this.prevRegolite = this.regolite;
    this.prevGhiaccio = this.ghiaccio;
    this.prevOssigeno = this.ossigeno;
    this.deltaReg = 0;
    this.deltaIce = 0;
    this.deltaO2 = 0;
    this.deltaEnergy = 0;
  }

  create() {
    // --- Genera texture procedurali in memoria ---
    this._generateProceduralTextures();
    this._generateTileShadowTexture();

    // --- Disegna la griglia isometrica (terreno) ---
    this.tileGraphics = [];  // Matrice per accesso diretto alle immagini tile
    this.tileShadowGraphics = []; // Matrice ombre tile (overlay piccoli)
    this._drawGrid();
    this.gridOverlay = this.add.graphics();
    this.gridOverlay.setDepth(0);
    this._drawGridIntersections();

    // --- Layer Fog of War ---
    this.fogGraphics = [];   // Matrice grafici nebbia per tile
    this._drawFogOfWar();

    // --- Gruppo per gli edifici (per profondità) ---
    this.buildingLayer = this.add.container();

    // --- Highlighter (fantasma costruzione) --------------------------------
    this.highlighter = this.add.graphics();
    this.highlighter.setDepth(10000);
    this.roverSelectionGraphics = this.add.graphics();
    this.roverSelectionGraphics.setDepth(0);

    // --- Configura i controlli ---------------------------------------------
    this._setupKeyboard();
    this._setupMousePan();
    this._setupDOMListeners();
    this._setupGlobalGridPicking();

    // --- Disabilita il context menu sul canvas di Phaser ---
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Overlay Oscurità per la Notte -------------------------------------
    const cam = this.cameras.main;
    cam.setZoom(CAMERA_ZOOM);

    // Zoom mappa con rotella mouse (fluido e limitato).
    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      const nextZoom = Phaser.Math.Clamp(
        cam.zoom - (deltaY * CAMERA_ZOOM_SENSITIVITY),
        CAMERA_ZOOM_MIN,
        CAMERA_ZOOM_MAX
      );
      cam.setZoom(nextZoom);
    });

    this.darknessOverlay = this.add.rectangle(0, 0, cam.width, cam.height, 0x000000)
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(9999);

    this.scale.on('resize', (gameSize) => {
      this.darknessOverlay.setSize(gameSize.width, gameSize.height);
    });

    // --- Avvia il Ciclo Giorno / Notte -------------------------------------
    this._startDayTimer();

    // --- Centra la telecamera ----------------------------------------------
    this._centerCameraOnGrid();

    // --- HUD interna Phaser ------------------------------------------------
    this._createHUD();
  }

  update(time, delta) {
    if (this.isGamePaused) return;

    this._handleCameraKeyboard();
    this._updateHighlighter();
    this._drawSelectedRoverBrackets();

    if (!this.isPaused) {
      this._handleEconomy(time);
    }

    this._checkPhaseProgression();
  }

  // =========================================================================
  // GESTIONE RACCOLTA MATERIALI E FASI
  // =========================================================================

  _showFloatingText(x, y, text, color) {
    const txt = this.add.text(x, y, text, {
      fontSize: '16px',
      fontFamily: 'monospace',
      fill: color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(y + 200);

    this.tweens.add({
      targets: txt,
      y: y - 50,
      alpha: 0,
      duration: 1500,
      onComplete: () => txt.destroy()
    });
  }

  _handleEconomy(time) {
    if (time - this.lastEconomyTime >= 10000) {
      this.lastEconomyTime = time;

      // Snapshot prima del tick per calcolo delta
      this.prevRegolite = this.regolite;
      this.prevGhiaccio = this.ghiaccio;
      this.prevOssigeno = this.ossigeno;
      const prevEnergiaProdotta = this.energiaProdotta;
      const prevEnergiaConsumata = this.energiaConsumata;

      // 1. Generatori: pannelli solari, RTG, reattore
      this.energiaProdotta = 0;
      for (let b of this.buildings) {
        if (b.type === 'solar' || b.type === 'rtg' || b.type === 'reactor') {
          let active = false;
          if (b.type === 'solar') {
            if (this.regolite >= 1) {
              this.regolite -= 1;
              active = true;
              if (this.isDay) this.energiaProdotta += BUILDINGS_INFO.solar.energyGenDay;
            }
          } else if (b.type === 'rtg') {
            if (this.regolite >= 2) {
              this.regolite -= 2;
              active = true;
              this.energiaProdotta += BUILDINGS_INFO.rtg.energyGenDay;
            }
          } else if (b.type === 'reactor') {
            active = true;
            this.energiaProdotta += BUILDINGS_INFO.reactor.energyGenDay;
          }
          b.gfx.setAlpha(active ? 1 : 0.4);
        }
      }

      // 2. Moduli Abitativi (Consumo Energia/O2 -> +5 Equipaggio Totale)
      this.energiaConsumata = 0;
      this.equipaggioTotale = 2; // I 2 comandanti di emergenza ci sono sempre
      let energyAvailable = this.energiaProdotta;

      let totalHabCrew = 0;
      const habs = this.buildings.filter(b => b.type === 'hab');
      for (let b of habs) {
        let active = false;
        if (energyAvailable >= 30) {
          energyAvailable -= 30;
          this.energiaConsumata += 30;
          if (this.ossigeno >= 5) {
            this.ossigeno -= 5;
          } else {
            this.ossigeno = 0;
          }
          active = true;
          totalHabCrew += 5;
        }
        b.gfx.setAlpha(active ? 1 : 0.4);
      }

      // Calculate crew based on LAST turn's emergency Timer
      let crewPenalty = Math.floor(this.emergencyTimer / 5);
      totalHabCrew = Math.max(0, totalHabCrew - crewPenalty);
      this.equipaggioTotale += totalHabCrew;

      // 3. Assegnazione Equipaggio & Energia agli impianti industriali
      let hasActiveRegExtractor = false;
      this.equipaggioImpiegato = 0;
      let crewAvailable = this.equipaggioTotale;

      const PRIORITY = { isru: 0, regolite_ext: 1, ice_ext: 2 };
      const consumers = this.buildings
        .filter(b => b.type in PRIORITY)
        .sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);

      for (let b of consumers) {
        let active = false;
        let crewNeeded = (b.type === 'isru') ? 2 : 1; // ISRU vuole 2, estrattori 1

        if (b.type === 'isru') {
          if (energyAvailable >= 20 && this.ghiaccio >= 2 && crewAvailable >= crewNeeded) {
            energyAvailable -= 20;
            this.energiaConsumata += 20;
            crewAvailable -= crewNeeded;
            this.equipaggioImpiegato += crewNeeded;
            this.ghiaccio -= 2;
            this.ossigeno += 10;
            active = true;
          }
        } else if (b.type === 'regolite_ext') {
          if (energyAvailable >= 10 && crewAvailable >= crewNeeded) {
            energyAvailable -= 10;
            this.energiaConsumata += 10;
            crewAvailable -= crewNeeded;
            this.equipaggioImpiegato += crewNeeded;
            this.regolite += 5;
            active = true;
            hasActiveRegExtractor = true;
          }
        } else if (b.type === 'ice_ext') {
          if (energyAvailable >= 15 && crewAvailable >= crewNeeded) {
            energyAvailable -= 15;
            this.energiaConsumata += 15;
            crewAvailable -= crewNeeded;
            this.equipaggioImpiegato += crewNeeded;
            this.ghiaccio += 5;
            active = true;
          }
        }
        b.gfx.setAlpha(active ? 1 : 0.4);
      }

      // 4. Assegnazione Equipaggio ai Rover
      for (let r of this.rovers) {
        if (crewAvailable >= 1) {
          crewAvailable -= 1;
          this.equipaggioImpiegato += 1;
          r.hasCrew = true;
          r.sprite.setAlpha(r.selected ? 1 : 0.9);
          if (r.tween && r.tween.isPaused() && !this.isPaused) r.tween.resume();
        } else {
          r.hasCrew = false;
          r.sprite.setAlpha(0.4);
          if (r.tween && r.tween.isPlaying()) r.tween.pause();
        }
      }

      // ---- Calcolo Delta (netto/ciclo) ----
      this.deltaReg = this.regolite - this.prevRegolite;
      this.deltaIce = this.ghiaccio - this.prevGhiaccio;
      this.deltaO2 = this.ossigeno - this.prevOssigeno;
      this.deltaEnergy = this.energiaProdotta - this.energiaConsumata; // surplus/deficit corrente

      // Check Oxygen and Deadlock for penalties or game over
      if (this.ossigeno <= 0) {
        this.emergencyTimer += 10;
        const evacTime = 180 - this.emergencyTimer;
        if (this.emergencyTimer >= 180) {
          this._triggerGameOver('Perdita Supporto Vitale');
          return;
        }
        const elO2Warn = document.getElementById('o2-emergency-warning');
        const elCountdown = document.getElementById('evac-countdown');
        if (elO2Warn) elO2Warn.style.display = 'block';
        if (elCountdown) elCountdown.innerText = `${evacTime}s`;
        // Alert the chip
        const chipO2 = document.getElementById('chip-o2');
        if (chipO2) chipO2.classList.add('alert-pulse');
      } else {
        this.emergencyTimer = 0;
        const elO2Warn = document.getElementById('o2-emergency-warning');
        if (elO2Warn) elO2Warn.style.display = 'none';
        const chipO2 = document.getElementById('chip-o2');
        if (chipO2) chipO2.classList.remove('alert-pulse');
      }

      // Check Deadlock
      if (this.regolite === 0 && !hasActiveRegExtractor && this.rovers.length === 0) {
        this.deadlockTimer += 10;
        if (this.deadlockTimer >= 180) {
          this._triggerGameOver('Esaurimento Risorse Critiche');
          return;
        }
      } else {
        this.deadlockTimer = 0;
      }

      this._updateHUD();
    }
  }

  _triggerGameOver(reason) {
    this.isGamePaused = true;
    const gameOverScreen = document.getElementById('game-over-screen');
    const gameOverReason = document.getElementById('game-over-reason');

    if (gameOverScreen && gameOverReason) {
      gameOverReason.innerText = reason;
      gameOverScreen.style.display = 'flex';
    }

    // Pause any rover tweens
    this.rovers.forEach(r => { if (r.tween && r.tween.isPlaying()) r.tween.pause(); });
  }

  _updateHUD() {
    // Helper: aggiorna valore + delta con colore
    const setChip = (valId, deltaId, value, delta) => {
      const valEl = document.getElementById(valId);
      const deltaEl = document.getElementById(deltaId);
      if (valEl) valEl.innerText = Math.round(value);
      if (deltaEl) {
        const sign = delta > 0 ? '+' : '';
        deltaEl.innerText = `(${sign}${Math.round(delta)})`;
        deltaEl.className = 'res-delta ' + (delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'zero');
      }
    };

    setChip('res-reg-val', 'res-reg-delta', this.regolite, this.deltaReg);
    setChip('res-ice-val', 'res-ice-delta', this.ghiaccio, this.deltaIce);
    setChip('res-o2-val', 'res-o2-delta', this.ossigeno, this.deltaO2);

    // Energia: mostra prodotta/consumata + delta surplus
    const nrgValEl = document.getElementById('res-nrg-val');
    const nrgDeltaEl = document.getElementById('res-nrg-delta');
    if (nrgValEl) nrgValEl.innerText = `${this.energiaProdotta} / ${this.energiaConsumata}`;
    if (nrgDeltaEl) {
      const surplus = this.energiaProdotta - this.energiaConsumata;
      const sign = surplus > 0 ? '+' : '';
      nrgDeltaEl.innerText = `(${sign}${surplus})`;
      nrgDeltaEl.className = 'res-delta ' + (surplus > 0 ? 'positive' : surplus < 0 ? 'negative' : 'zero');
    }

    // Blackout coloring on NRG chip
    const chipNrg = document.getElementById('chip-nrg');
    const blackoutEl = document.getElementById('blackout-warning');
    if (this.energiaConsumata > this.energiaProdotta) {
      if (chipNrg) chipNrg.classList.add('alert-pulse');
      if (blackoutEl) blackoutEl.style.display = 'block';
    } else {
      if (chipNrg) chipNrg.classList.remove('alert-pulse');
      if (blackoutEl) blackoutEl.style.display = 'none';
    }

    // Equipaggio
    const crewValEl = document.getElementById('res-crew-val');
    if (crewValEl) crewValEl.innerText = `${this.equipaggioImpiegato} / ${this.equipaggioTotale}`;

    // Crew chip alert
    const chipCrew = document.getElementById('chip-crew');
    const crewWarnEl = document.getElementById('crew-warning');
    const crewShort = this.equipaggioImpiegato >= this.equipaggioTotale && this.equipaggioTotale > 0;
    if (chipCrew) chipCrew.classList.toggle('alert-pulse', crewShort);
    if (crewWarnEl) crewWarnEl.style.display = crewShort ? 'block' : 'none';

    this._updateEnergyUI();
  }

  _checkPhaseProgression() {
    const habs = this.buildings.filter(b => b.type === 'hab').length;
    const solars = this.buildings.filter(b => b.type === 'solar').length;
    const reg500 = this.regolite >= 500;

    // --- Update mission tab objectives live ---
    const setObj = (id, done) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('done', done);
      const icon = el.querySelector('.oi-icon');
      if (icon) icon.innerText = done ? '✅' : '⬜';
    };
    setObj('obj-habs', habs >= 2);
    setObj('obj-solars', solars >= 3);
    setObj('obj-reg', reg500);

    // Progress percentage (out of 3 objectives)
    const done = (habs >= 2 ? 1 : 0) + (solars >= 3 ? 1 : 0) + (reg500 ? 1 : 0);
    const pct = Math.round((done / 3) * 100);
    const pctEl = document.getElementById('progress-pct');
    const fillEl = document.getElementById('progress-fill');
    if (pctEl) pctEl.innerText = `${pct}%`;
    if (fillEl) fillEl.style.width = `${pct}%`;

    // Phase badge
    const phaseBadge = document.getElementById('phase-badge');
    if (phaseBadge) phaseBadge.innerText = `FASE 0${this.fase}`;

    if (this.fase === 1) {
      if (reg500 && habs >= 2 && solars >= 3) {
        this.fase = 2;

        // Update mission phase title
        const titleEl = document.getElementById('mission-phase-title');
        if (titleEl) titleEl.innerText = 'FASE 02 — Espansione Energetica';

        // Show Phase 2 info box
        const p2info = document.getElementById('phase2-info');
        if (p2info) p2info.style.display = 'block';

        // Update phase badge
        if (phaseBadge) phaseBadge.innerText = 'FASE 02';

        // Show & enable reactor button
        const btnReactor = document.getElementById('btn-reactor');
        if (btnReactor) {
          btnReactor.disabled = false;
          const lockText = document.getElementById('reactor-lock-text');
          if (lockText) lockText.innerText = '🔓 Disponibile — Fase 02 raggiunta';
        }

        // Notification overlay
        const msgOverlay = document.getElementById('phase-msg');
        if (msgOverlay) {
          msgOverlay.style.display = 'block';
          setTimeout(() => { msgOverlay.style.display = 'none'; }, 5000);
        }
      }
    }
  }

  // =========================================================================
  // GENERAZIONE GRIGLIA CON TERRENO E RISORSE
  // =========================================================================

  /**
   * Genera in memoria le texture procedurali per il terreno.
   * Divide il singolo rombo in una sub-grid 10x10 applicando "noise" visivo.
   */
  _generateProceduralTextures() {
    const tempGfx = this.make.graphics({ x: 0, y: 0, add: false });
    const noiseAmount = 25; // ±10% su un massimo di 255 per variazione di luminosità
    const SUBDIVISIONS = 10;

    // Dimensione dei sotto-rombi (griglia 10x10)
    const subW = TILE_W / SUBDIVISIONS;
    const subH = TILE_H / SUBDIVISIONS;

    // Converte coordinate (u,v) della sub-grid locale [0..SUBDIVISIONS] in offset rispetto al top (TILE_W/2, 0)
    function localIso(col, row) {
      return {
        x: TILE_W / 2 + (col - row) * (subW / 2),
        y: (col + row) * (subH / 2)
      };
    }

    const types = [
      { key: TERRAIN_NORMAL, color: TERRAIN_COLORS[TERRAIN_NORMAL] },
      { key: TERRAIN_ICE, color: TERRAIN_COLORS[TERRAIN_ICE] },
      { key: TERRAIN_REGOLITE, color: TERRAIN_COLORS[TERRAIN_REGOLITE] }
    ];

    for (const t of types) {
      for (let variant = 0; variant < TERRAIN_VARIANTS; variant++) {
        tempGfx.clear();

        // Ciclo per i 100 sub-rombi
        for (let u = 0; u < SUBDIVISIONS; u++) {
          for (let v = 0; v < SUBDIVISIONS; v++) {
            const top = localIso(u, v);
            const right = localIso(u + 1, v);
            const bottom = localIso(u + 1, v + 1);
            const left = localIso(u, v + 1);

            // Effetto di dispersione/venature del materiale (40% risorsa, 60% luna)
            let baseColor = TERRAIN_COLORS[TERRAIN_NORMAL];
            if (t.key === TERRAIN_ICE || t.key === TERRAIN_REGOLITE) {
              if (Math.random() < 0.40) {
                baseColor = t.color;
              }
            } else {
              baseColor = t.color;
            }

            // Estrai i canali RGB dal colore scelto
            let r = (baseColor >> 16) & 0xff;
            let g = (baseColor >> 8) & 0xff;
            let b = baseColor & 0xff;

            const noise = Math.floor(Math.random() * (noiseAmount * 2 + 1)) - noiseAmount;

            r = Math.max(0, Math.min(255, r + noise));
            g = Math.max(0, Math.min(255, g + noise));
            b = Math.max(0, Math.min(255, b + noise));

            const subColor = (r << 16) | (g << 8) | b;

            tempGfx.fillStyle(subColor, 1);
            tempGfx.beginPath();
            tempGfx.moveTo(top.x, top.y);
            tempGfx.lineTo(right.x, right.y);
            tempGfx.lineTo(bottom.x, bottom.y);
            tempGfx.lineTo(left.x, left.y);
            tempGfx.closePath();
            tempGfx.fillPath();
          }
        }

        // Traccia il bordo principale intorno al rombo 1x1 per marcare chiaramente i confini della tile
        tempGfx.lineStyle(TILE_STROKE_WIDTH, TILE_STROKE_COLOR, 1);
        const topEdge = localIso(0, 0);
        const rightEdge = localIso(SUBDIVISIONS, 0);
        const bottomEdge = localIso(SUBDIVISIONS, SUBDIVISIONS);
        const leftEdge = localIso(0, SUBDIVISIONS);

        tempGfx.beginPath();
        tempGfx.moveTo(topEdge.x, topEdge.y);
        tempGfx.lineTo(rightEdge.x, rightEdge.y);
        tempGfx.lineTo(bottomEdge.x, bottomEdge.y);
        tempGfx.lineTo(leftEdge.x, leftEdge.y);
        tempGfx.closePath();
        tempGfx.strokePath();

        // Genera 3 varianti per ogni tipo di terreno: tex_<tipo>_0..2
        tempGfx.generateTexture(`tex_${t.key}_${variant}`, TILE_W, TILE_H);
      }
    }

    // Pulisci l'oggetto temporaneo
    tempGfx.destroy();
  }

  _drawGridIntersections() {
    if (!this.gridOverlay) return;

    this.gridOverlay.clear();
    this.gridOverlay.lineStyle(1, 0xd0d6de, 0.5);

    const armLength = 5;
    const isoDirX = { x: TILE_W / 2, y: TILE_H / 2 };
    const isoDirY = { x: -TILE_W / 2, y: TILE_H / 2 };
    const lenX = Math.hypot(isoDirX.x, isoDirX.y);
    const lenY = Math.hypot(isoDirY.x, isoDirY.y);
    const dirX = { x: isoDirX.x / lenX, y: isoDirX.y / lenX };
    const dirY = { x: isoDirY.x / lenY, y: isoDirY.y / lenY };

    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        // I vertici della griglia isometrica sono traslati di mezzo tile in alto
        // rispetto ai centri tile generati da cartesianToIsometric(col, row).
        const { x, y } = cartesianToIsometric(col, row);
        const vx = x;
        const vy = y - TILE_H / 2;

        this.gridOverlay.lineBetween(
          vx - dirX.x * armLength,
          vy - dirX.y * armLength,
          vx + dirX.x * armLength,
          vy + dirX.y * armLength
        );

        this.gridOverlay.lineBetween(
          vx - dirY.x * armLength,
          vy - dirY.y * armLength,
          vx + dirY.x * armLength,
          vy + dirY.y * armLength
        );
      }
    }
  }

  _drawGrid() {
    for (let row = 0; row < GRID_SIZE; row++) {
      this.tileGraphics[row] = [];
      this.tileShadowGraphics[row] = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        const { x: cx, y: cy } = cartesianToIsometric(col, row);

        const terrain = this.terrainGrid[row][col];

        // Refactoring: Usiamo un'immagine anziché un nuovo GameObjects.Graphics per ogni cella!
        // Le Image in Phaser sono molto più leggere dei Graphics puri ripetuti 1600 volte.
        // Origine standard di this.add.image() è (0.5, 0.5), si allinea naturalmente come volevamo.
        const variant = Phaser.Math.Between(0, TERRAIN_VARIANTS - 1);
        const img = this.add.image(cx, cy, `tex_${terrain}_${variant}`);

        // Profondità basata sulla struttura isometrica e z-index per non ostruire rover/foW
        img.setDepth(-1);

        this.tileGraphics[row][col] = img;

        // Ombra piccola centrata sulla tile (inizialmente invisibile)
        const shadow = this.add.image(cx, cy, 'tex_tile_shadow');
        shadow.setDepth(-0.5);
        shadow.setVisible(false);
        this.tileShadowGraphics[row][col] = shadow;
      }
    }
  }

  _setTileShadow(col, row, isShadowed) {
    // Verifica coordinate e presenza dell'overlay ombra
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return;
    if (!this.tileShadowGraphics[row] || !this.tileShadowGraphics[row][col]) return;

    this.tileShadowGraphics[row][col].setVisible(isShadowed);
  }

  _generateTileShadowTexture() {
    const tempGfx = this.make.graphics({ x: 0, y: 0, add: false });

    // Ombra più chiara e più piccola della tile: rombo al 70% con alpha morbida
    const w2 = (TILE_W * 0.70) / 2;
    const h2 = (TILE_H * 0.70) / 2;

    tempGfx.fillStyle(0x000000, 0.30);
    tempGfx.beginPath();
    tempGfx.moveTo(TILE_W / 2, (TILE_H / 2) - h2);
    tempGfx.lineTo((TILE_W / 2) + w2, TILE_H / 2);
    tempGfx.lineTo(TILE_W / 2, (TILE_H / 2) + h2);
    tempGfx.lineTo((TILE_W / 2) - w2, TILE_H / 2);
    tempGfx.closePath();
    tempGfx.fillPath();

    tempGfx.generateTexture('tex_tile_shadow', TILE_W, TILE_H);
    tempGfx.destroy();
  }

  // =========================================================================
  // FOG OF WAR
  // =========================================================================

  _drawFogOfWar() {
    for (let row = 0; row < GRID_SIZE; row++) {
      this.fogGraphics[row] = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        const { x: cx, y: cy } = cartesianToIsometric(col, row);
        const w2 = TILE_W / 2;
        const h2 = TILE_H / 2;

        const fogGfx = this.add.graphics();
        fogGfx.setPosition(cx, cy);

        // Se la tile NON è esplorata, coprila di nero
        if (!this.exploredTiles[row][col]) {
          fogGfx.fillStyle(0x000000, 1);
          fogGfx.beginPath();
          fogGfx.moveTo(0, -h2);
          fogGfx.lineTo(w2, 0);
          fogGfx.lineTo(0, h2);
          fogGfx.lineTo(-w2, 0);
          fogGfx.closePath();
          fogGfx.fillPath();
        }

        // La nebbia deve stare sopra il terreno ma sotto edifici e UI
        this._updateSpriteDepth(fogGfx);

        this.fogGraphics[row][col] = fogGfx;
      }
    }
  }

  /**
   * Solleva la nebbia intorno a una posizione (col, row) nel raggio specificato.
   * Rivela permanentemente le tile sottostanti.
   */
  _revealFog(centerCol, centerRow, radius) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const r = centerRow + dr;
        const c = centerCol + dc;
        if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
        if (this.exploredTiles[r][c]) continue; // Già esplorata

        // Segna come esplorata
        this.exploredTiles[r][c] = true;

        // Rimuovi il grafico della nebbia
        if (this.fogGraphics[r][c]) {
          this.fogGraphics[r][c].clear();
        }
      }
    }
  }

  // =========================================================================
  // LOGICA DI COSTRUZIONE
  // =========================================================================

  _setupDOMListeners() {
    const btnSolar = document.getElementById('btn-solar');
    const btnHab = document.getElementById('btn-hab');
    const btnRtg = document.getElementById('btn-rtg');
    const btnIsru = document.getElementById('btn-isru');
    const btnReactor = document.getElementById('btn-reactor');
    const btnRover = document.getElementById('btn-rover');
    const btnRegoliteExt = document.getElementById('btn-regolite-ext');
    const btnIceExt = document.getElementById('btn-ice-ext');

    btnSolar.onclick = () => this._selectBuilding('solar', btnSolar);
    btnHab.onclick = () => this._selectBuilding('hab', btnHab);
    if (btnRtg) btnRtg.onclick = () => this._selectBuilding('rtg', btnRtg);
    if (btnIsru) btnIsru.onclick = () => this._selectBuilding('isru', btnIsru);
    if (btnReactor) btnReactor.onclick = () => this._selectBuilding('reactor', btnReactor);
    if (btnRegoliteExt) btnRegoliteExt.onclick = () => this._selectBuilding('regolite_ext', btnRegoliteExt);
    if (btnIceExt) btnIceExt.onclick = () => this._selectBuilding('ice_ext', btnIceExt);

    // Bottone Rover
    if (btnRover) {
      btnRover.onclick = () => this._buildRover();
    }

    // Bottone Pausa
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.onclick = () => {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
          btnPause.innerText = '▶ PLAY (PAUSA ATTIVA)';
          btnPause.style.backgroundColor = '#1a5928';
          btnPause.style.borderColor = '#32a852';
          this.rovers.forEach(r => { if (r.tween && r.tween.isPlaying()) r.tween.pause(); });
        } else {
          btnPause.innerText = '▎▎ PAUSA TATTICA';
          btnPause.style.backgroundColor = '#444';
          btnPause.style.borderColor = '#555';
          this.rovers.forEach(r => { if (r.tween && r.tween.isPaused() && r.hasCrew) r.tween.resume(); });
        }
      };
    }

  }

  _setupGlobalGridPicking() {
    this.input.on('pointerdown', (pointer, currentlyOver) => {
      const pickedTile = this._pickGridTileFromPointer(pointer, currentlyOver);
      if (!pickedTile) return;

      const { col, row } = pickedTile;

      // Click destro: muovi rover selezionato
      if (pointer.rightButtonDown()) {
        if (!this.selectedRover) return;
        this._moveRoverTo(this.selectedRover, col, row);
        return;
      }

      // Click sinistro: piazza edificio o deseleziona rover
      if (this.selectedBuilding) {
        this._tryPlaceBuilding(col, row);
        return;
      }

      if (this.selectedRover) {
        this._deselectRover();
      }
    });
  }

  _pickGridTileFromPointer(pointer, currentlyOver = []) {
    // Se stiamo trascinando, non agiamo
    if (this._drag.active && (Math.abs(pointer.x - this._drag.startX) > 5 || Math.abs(pointer.y - this._drag.startY) > 5)) {
      return null;
    }

    // Ignora click su oggetti interattivi (UI in-canvas, rover, ecc.)
    if (currentlyOver.length > 0) return null;

    // Conversione globale unificata iso -> griglia
    const { col, row } = isometricToCartesian(pointer.worldX, pointer.worldY);

    // Verifica limiti mappa
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;

    return { col, row };
  }

  _selectBuilding(type, element) {
    // Se selezioniamo un edificio, deseleziona il rover
    this._deselectRover();

    if (this.selectedBuilding === type) {
      this.selectedBuilding = null;
      element.classList.remove('selected');
    } else {
      this.selectedBuilding = type;
      document.querySelectorAll('.btn-building').forEach(btn => btn.classList.remove('selected'));
      element.classList.add('selected');
    }
  }

  _updateHighlighter() {
    this.highlighter.clear();
    if (!this.selectedBuilding) return;

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    const cart = isometricToCartesian(worldPoint.x, worldPoint.y);
    const col = cart.col;
    const row = cart.row;

    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return;

    // Può costruire solo su tile esplorate
    if (!this.exploredTiles[row][col]) return;

    const { x, y } = cartesianToIsometric(col, row);

    // Verifica occupazione (Edifici + Rover)
    const isOccupiedByBuilding = this.occupiedTiles[row][col];
    const isOccupiedByRover = this._isRoverOnTile(col, row);
    const isOccupied = isOccupiedByBuilding || isOccupiedByRover;

    const info = BUILDINGS_INFO[this.selectedBuilding];
    const canAfford = this.regolite >= info.cost;

    // Verifica terreno per gli estrattori
    let terrainOk = true;
    if (this.selectedBuilding === 'regolite_ext') {
      terrainOk = this.terrainGrid[row][col] === TERRAIN_REGOLITE;
    } else if (this.selectedBuilding === 'ice_ext') {
      terrainOk = this.terrainGrid[row][col] === TERRAIN_ICE;
    }

    const canBuild = !isOccupied && canAfford && terrainOk;
    const color = canBuild ? 0x00ff00 : 0xff0000;

    this.highlighter.lineStyle(2, color, 1);
    this.highlighter.strokePoints([
      { x: x, y: y - TILE_H / 2 },
      { x: x + TILE_W / 2, y: y },
      { x: x, y: y + TILE_H / 2 },
      { x: x - TILE_W / 2, y: y }
    ], true);
  }

  /**
   * Verifica se un rover occupa la tile (col, row).
   * Se il rover è in movimento, considera occupate sia la tile di partenza che quella di arrivo.
   */
  _isRoverOnTile(col, row) {
    return this.rovers.some(r => {
      // Posizione attuale (per rover fermi o target attuale per rover in moto)
      if (r.col === col && r.row === row) return true;
      // Posizione di provenienza (se in movimento)
      if (r.moving && r.fromCol === col && r.fromRow === row) return true;
      return false;
    });
  }

  _tryPlaceBuilding(targetCol, targetRow) {
    if (!this.selectedBuilding) return;

    let col = targetCol;
    let row = targetRow;

    if (col === undefined || row === undefined) {
      const pointer = this.input.activePointer;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cart = isometricToCartesian(worldPoint.x, worldPoint.y);
      col = cart.col;
      row = cart.row;
    }

    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return;
    if (!this.exploredTiles[row][col]) return; // Solo su zone esplorate

    // Non si può costruire sopra edifici o ROVER
    if (this.occupiedTiles[row][col] || this._isRoverOnTile(col, row)) {
      console.warn('Spazio occupato!');
      return;
    }

    // Vincoli di terreno per gli estrattori
    if (this.selectedBuilding === 'regolite_ext' && this.terrainGrid[row][col] !== TERRAIN_REGOLITE) {
      console.warn('Estrattore Regolite: tile non è Regolite!'); return;
    }
    if (this.selectedBuilding === 'ice_ext' && this.terrainGrid[row][col] !== TERRAIN_ICE) {
      console.warn('Estrattore Ghiaccio: tile non è Ghiaccio!'); return;
    }

    const info = BUILDINGS_INFO[this.selectedBuilding];
    if (this.regolite < info.cost) {
      console.warn('Regolite insufficiente!'); return;
    }

    // Procedi con il piazzamento
    this.regolite -= info.cost;
    this._updateHUD();

    this.occupiedTiles[row][col] = true;
    this._placeBuildingGraphics(col, row, this.selectedBuilding);
    this._setTileShadow(col, row, true);

    // AUTO-DESELEZIONE (Single-build mode)
    this.selectedBuilding = null;
    document.querySelectorAll('.btn-building').forEach(btn => btn.classList.remove('selected'));
    this.highlighter.clear();
  }

  _placeBuildingGraphics(col, row, type) {
    const { x, y } = cartesianToIsometric(col, row);
    const info = BUILDINGS_INFO[type];
    let gfx;
    if (type === 'solar') {
      const sprite = this.add.sprite(0, 0, 'solar-panel');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
    } else if (type === 'regolite_ext') {
      const sprite = this.add.sprite(0, 0, 'regolith-extractor');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
    } else {
      gfx = this.add.graphics();
      if (type === 'reactor') {
        this._drawReactorGraphics(gfx, x, y, info.color, info.height);
        this.isGamePaused = true;
        document.getElementById('victory-screen').style.display = 'flex';
        this.fase = 3;
      } else if (type === 'isru') {
        this._drawIsruGraphics(gfx, x, y, info.color, info.height);
      } else if (type === 'ice_ext') {
        // Ciano/Blu scuro — trivella per Ghiaccio
        this._drawExtractorGraphics(gfx, x, y, 0x005f80, 0x00e5ff, info.height);
      } else {
        this._draw3DBlock(gfx, x, y, info.color, info.height);
      }
      // Ordinamento isometrico coerente: profondità basata sulla Y di base.
      gfx.setDepth(y);
    }

    this.buildings.push({ col, row, type, gfx });
  }

  _drawIsruGraphics(gfx, x, y, color, height) {
    this._draw3DBlock(gfx, x, y, color, height);

    const topY = y - height;
    gfx.fillStyle(0xffffff, 0.9);
    gfx.lineStyle(2, 0x000000, 0.5);
    gfx.beginPath();
    gfx.ellipse(x, topY, TILE_W * 0.3, TILE_H * 0.3);
    gfx.closePath();
    gfx.fillPath();
    gfx.strokePath();

    gfx.fillStyle(0x00ccff, 1);
    gfx.beginPath();
    gfx.ellipse(x, topY, TILE_W * 0.15, TILE_H * 0.15);
    gfx.closePath();
    gfx.fillPath();
  }

  /**
   * Disegna un Estrattore (Trivella) isometrico.
   * Blocco 3D + torre di perforazione verticale con cappuccio a rombo.
   * @param {number} baseColor  Colore del corpo principale
   * @param {number} accentColor Colore della torre/trivella
   */
  _drawExtractorGraphics(gfx, x, y, baseColor, accentColor, height) {
    // Corpo principale (prisma isometrico)
    this._draw3DBlock(gfx, x, y, baseColor, height);

    const topY = y - height;

    // Anello di supporto alla base del fusto
    const ringW = 14, ringH = 4;
    gfx.fillStyle(accentColor, 0.8);
    gfx.fillRect(x - ringW / 2, topY - ringH, ringW, ringH);

    // Fusto verticale della trivella
    const shaftW = 4, shaftH = 16;
    gfx.fillStyle(accentColor, 1);
    gfx.fillRect(x - shaftW / 2, topY - ringH - shaftH, shaftW, shaftH);

    // Punta della trivella (triangolo bianco)
    gfx.fillStyle(0xffffff, 0.95);
    const tipBase = topY - ringH - shaftH;
    gfx.fillTriangle(
      x - 5, tipBase,
      x + 5, tipBase,
      x, tipBase - 7
    );

    // Dettaglio: piccolo riquadro luminoso sul corpo
    gfx.fillStyle(accentColor, 0.5);
    gfx.fillRect(x - 5, topY - 10, 10, 6);
  }

  _drawReactorGraphics(gfx, x, y, color, height) {
    const w2 = TILE_W / 2;
    const h2 = TILE_H / 2;

    this._draw3DBlock(gfx, x, y, 0x444444, height);

    gfx.lineStyle(3, color, 1);

    const colorInt = Phaser.Display.Color.IntegerToColor(color).color;
    gfx.fillStyle(colorInt, 0.8);

    const hOffset1 = height * 0.3;
    const hOffset2 = height * 0.7;

    gfx.beginPath();
    gfx.moveTo(x - w2, y - hOffset1);
    gfx.lineTo(x, y + h2 - hOffset1);
    gfx.lineTo(x + w2, y - hOffset1);
    gfx.lineTo(x, y - h2 - hOffset1);
    gfx.closePath();
    gfx.strokePath();

    gfx.beginPath();
    gfx.moveTo(x - w2, y - hOffset2);
    gfx.lineTo(x, y + h2 - hOffset2);
    gfx.lineTo(x + w2, y - hOffset2);
    gfx.lineTo(x, y - h2 - hOffset2);
    gfx.closePath();
    gfx.strokePath();

    gfx.beginPath();
    gfx.moveTo(x, y - h2 - height);
    gfx.lineTo(x + w2, y - height);
    gfx.lineTo(x, y + h2 - height);
    gfx.lineTo(x - w2, y - height);
    gfx.closePath();
    gfx.fillPath();
  }

  /**
   * Disegna un prisma isometrico (finto 3D)
   */
  _draw3DBlock(gfx, x, y, color, height) {
    const w2 = TILE_W / 2;
    const h2 = TILE_H / 2;

    const bT = { x: x, y: y - h2 };
    const bR = { x: x + w2, y: y };
    const bB = { x: x, y: y + h2 };
    const bL = { x: x - w2, y: y };

    const tT = { x: bT.x, y: bT.y - height };
    const tR = { x: bR.x, y: bR.y - height };
    const tB = { x: bB.x, y: bB.y - height };
    const tL = { x: bL.x, y: bL.y - height };

    const colorTop = color;
    const colorRight = Phaser.Display.Color.IntegerToColor(color).darken(20).color;
    const colorLeft = Phaser.Display.Color.IntegerToColor(color).darken(40).color;

    // Faccia Sinistra
    gfx.fillStyle(colorLeft, 1);
    gfx.beginPath();
    gfx.moveTo(bL.x, bL.y);
    gfx.lineTo(bB.x, bB.y);
    gfx.lineTo(tB.x, tB.y);
    gfx.lineTo(tL.x, tL.y);
    gfx.closePath();
    gfx.fillPath();

    // Faccia Destra
    gfx.fillStyle(colorRight, 1);
    gfx.beginPath();
    gfx.moveTo(bR.x, bR.y);
    gfx.lineTo(bB.x, bB.y);
    gfx.lineTo(tB.x, tB.y);
    gfx.lineTo(tR.x, tR.y);
    gfx.closePath();
    gfx.fillPath();

    // Faccia Superiore
    gfx.fillStyle(colorTop, 1);
    gfx.beginPath();
    gfx.moveTo(tT.x, tT.y);
    gfx.lineTo(tR.x, tR.y);
    gfx.lineTo(tB.x, tB.y);
    gfx.lineTo(tL.x, tL.y);
    gfx.closePath();
    gfx.fillPath();

    // Bordi
    gfx.lineStyle(1, 0x000000, 0.3);
    gfx.strokePath();
  }

  // =========================================================================
  // ROVER: COSTRUZIONE, SELEZIONE, MOVIMENTO
  // =========================================================================

  /**
   * Costruisce un nuovo Rover posizionandolo in una tile libera vicino al centro.
   */
  _buildRover() {
    if (this.regolite < ROVER_COST) {
      console.warn("Regolite insufficiente per il Rover!");
      return;
    }

    // Trova una tile libera esplorata vicino al centro
    const center = Math.floor(GRID_SIZE / 2);
    let placed = false;

    // Cerca a spirale dal centro
    for (let radius = 0; radius < GRID_SIZE && !placed; radius++) {
      for (let dr = -radius; dr <= radius && !placed; dr++) {
        for (let dc = -radius; dc <= radius && !placed; dc++) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue; // Solo bordo
          const r = center + dr;
          const c = center + dc;
          if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
          if (this.occupiedTiles[r][c]) continue;
          if (!this.exploredTiles[r][c]) continue;
          if (this._getRoverAt(c, r)) continue; // Evita sovrapposizione rover

          // Piazza il Rover qui
          this.regolite -= ROVER_COST;
          this._updateHUD();
          this._createRover(c, r);
          placed = true;
        }
      }
    }

    if (!placed) {
      console.warn("Nessuna tile libera per il Rover!");
    }
  }

  /**
   * Crea un oggetto Rover sulla tile specificata e ne disegna la grafica.
   */
  _createRover(col, row) {
    const { x, y } = cartesianToIsometric(col, row);
    const sprite = this.add.sprite(x, y, 'rover-SE');
    this._alignSpriteToTile(sprite, col, row);
    sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });

    const rover = {
      col,
      row,
      sprite,
      selected: false,
      moving: false,
      hasCrew: true,
      tween: null,
      path: [],
      visualYOffset: 0,
      engineTween: null
    };

    // Tremolio motore: offset visivo continuo, separato dalle coordinate logiche.
    rover.engineTween = this.tweens.add({
      targets: rover,
      visualYOffset: -0.5,
      duration: Phaser.Math.Between(90, 130),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        // Quando è fermo, riallinea lo sprite con il solo offset visivo.
        if (!rover.moving) {
          const { x: idleX, y: idleY } = cartesianToIsometric(rover.col, rover.row);
          rover.sprite.setPosition(idleX, idleY + (TILE_H / 2) + rover.visualYOffset);
          this._updateSpriteDepth(rover.sprite);
        }
      }
    });

    this.rovers.push(rover);
    sprite.on('pointerdown', () => this._selectRover(rover));

    // Il Rover esplora immediatamente il suo intorno
    this._revealFog(col, row, ROVER_EXPLORE_RADIUS);
    this._setTileShadow(col, row, true);

    return rover;
  }

  _updateSpriteDepth(sprite) {
    // La Y determina la profondità principale.
    // Sottraiamo una micro-frazione di X per il tie-breaker diagonale SW-NE.
    sprite.setDepth(sprite.y - (sprite.x * 0.001));
  }

  /**
   * Allinea uno sprite alla tile isometrica:
   * - bottom-center dello sprite sul vertice inferiore del rombo
   * - larghezza sprite = larghezza tile
   * - profondità basata sulla y finale
   */
  _alignSpriteToTile(sprite, col, row) {
    const { x: centerX, y: centerY } = cartesianToIsometric(col, row);
    sprite.setOrigin(0.5, 1);
    sprite.setPosition(centerX, centerY + (TILE_H / 2));
    sprite.displayWidth = TILE_W;
    sprite.scaleY = sprite.scaleX;
    this._updateSpriteDepth(sprite);
  }

  /**
   * Restituisce il rover in una specifica tile, oppure null.
   */
  _getRoverAt(col, row) {
    return this.rovers.find(r =>
      (r.col === col && r.row === row) ||
      (r.moving && r.fromCol === col && r.fromRow === row)
    ) || null;
  }

  /**
   * Seleziona un rover (LMB click).
   */
  _selectRover(rover) {
    // Deseleziona il precedente
    this._deselectRover();

    rover.selected = true;
    this.selectedRover = rover;

    // Deseleziona qualsiasi edificio nella UI
    this.selectedBuilding = null;
    document.querySelectorAll('.btn-building').forEach(btn => btn.classList.remove('selected'));

    this._drawSelectedRoverBrackets();
  }

  /**
   * Deseleziona il rover corrente.
   */
  _deselectRover() {
    if (!this.selectedRover) return;

    this.selectedRover.selected = false;
    this.selectedRover = null;
    if (this.roverSelectionGraphics) this.roverSelectionGraphics.clear();
  }

  _drawSelectedRoverBrackets() {
    if (!this.roverSelectionGraphics) return;
    this.roverSelectionGraphics.clear();
    if (!this.selectedRover) return;
    this.roverSelectionGraphics.setDepth(this.selectedRover.sprite.depth - 1);
    this._drawRoverSelection(this.selectedRover.col, this.selectedRover.row);
  }

  _drawRoverSelection(col, row) {
    if (!this.roverSelectionGraphics) return;

    const gfx = this.roverSelectionGraphics;
    const { x, y } = cartesianToIsometric(col, row);
    const w2 = TILE_W / 2;
    const h2 = TILE_H / 2;

    const corners = [
      { x: x, y: y - h2 }, // top
      { x: x + w2, y: y }, // right
      { x: x, y: y + h2 }, // bottom
      { x: x - w2, y: y }  // left
    ];

    const center = { x, y };
    const inset = 3;
    const bracketLen = 8;

    const edgeUnit = (from, to) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const mag = Math.hypot(dx, dy);
      return { x: dx / mag, y: dy / mag };
    };

    const edges = [
      edgeUnit(corners[0], corners[1]),
      edgeUnit(corners[1], corners[2]),
      edgeUnit(corners[2], corners[3]),
      edgeUnit(corners[3], corners[0])
    ];

    gfx.lineStyle(2, 0xffffff, 1);

    for (let i = 0; i < 4; i++) {
      const corner = corners[i];
      const toCenter = { x: center.x - corner.x, y: center.y - corner.y };
      const toCenterMag = Math.hypot(toCenter.x, toCenter.y);
      const insetPoint = {
        x: corner.x + (toCenter.x / toCenterMag) * inset,
        y: corner.y + (toCenter.y / toCenterMag) * inset
      };

      const edgeA = {
        x: -edges[(i + 3) % 4].x,
        y: -edges[(i + 3) % 4].y
      };
      const edgeB = edges[i];

      gfx.lineBetween(
        insetPoint.x,
        insetPoint.y,
        insetPoint.x + edgeA.x * bracketLen,
        insetPoint.y + edgeA.y * bracketLen
      );
      gfx.lineBetween(
        insetPoint.x,
        insetPoint.y,
        insetPoint.x + edgeB.x * bracketLen,
        insetPoint.y + edgeB.y * bracketLen
      );
    }
  }

  /**
   * Avvia il movimento del rover verso la destinazione usando A*.
   */
  _moveRoverTo(rover, destCol, destRow) {
    // Non muovere se il rover è già in movimento
    if (rover.moving) return;

    // Non muovere verso se stessi
    if (rover.col === destCol && rover.row === destRow) return;

    const deltaCol = destCol - rover.col;
    const deltaRow = destRow - rover.row;
    const manhattanDistance = Math.abs(deltaCol) + Math.abs(deltaRow);

    // Limita sempre il comando a un singolo passo verso la destinazione selezionata.
    // Se il target è più lontano di 1 tile, calcoliamo una tile adiacente nella direzione del click.
    if (manhattanDistance > 1) {
      if (Math.abs(deltaCol) >= Math.abs(deltaRow)) {
        destCol = rover.col + Math.sign(deltaCol);
        destRow = rover.row;
      } else {
        destCol = rover.col;
        destRow = rover.row + Math.sign(deltaRow);
      }
    }

    // Calcola il percorso con A*
    const path = aStarPathfind(this.occupiedTiles, rover.col, rover.row, destCol, destRow);

    if (!path || path.length === 0) {
      console.warn("Percorso non trovato!");
      return;
    }

    rover.moving = true;
    rover.path = path;

    // Avvia l'animazione di movimento passo per passo
    this._animateRoverStep(rover);
  }

  /**
   * Anima il rover di un passo lungo il percorso.
   * Richiama se stessa ricorsivamente fino alla fine del percorso.
   */
  // [FIX BUG 2] Consumo energia per tile: 5 energia per casella percorsa.
  // Se l'energia non basta, il rover si mette in pausa e riprova al tick successivo.
  _animateRoverStep(rover) {
    if (rover.path.length === 0) {
      rover.moving = false;
      return;
    }

    // Controlla prima la Pausa Tattica
    if (this.isPaused) {
      this.time.delayedCall(200, () => {
        this._animateRoverStep(rover);
      });
      return;
    }

    // Controlla se c'è abbastanza energia o se manca equipaggio PRIMA di fare il passo
    const energiaDisponibile = this.energiaProdotta - this.energiaConsumata;
    const costoPerTile = 5;

    if (energiaDisponibile < costoPerTile || !rover.hasCrew) {
      // Energia insufficiente o personale mancante: pausa il rover, NON svuotare il path.
      // Riprova dopo un breve delay (200ms)
      this.time.delayedCall(200, () => {
        this._animateRoverStep(rover);
      });
      return;
    }

    // [FIX BUG 2] Consuma 5 energia per questa casella
    this.energiaConsumata += costoPerTile;

    const nextStep = rover.path.shift();
    const prevCol = rover.col;
    const prevRow = rover.row;

    // Ombra dinamica: libera la tile precedente e ombreggia la prossima
    this._setTileShadow(prevCol, prevRow, false);
    this._setTileShadow(nextStep.col, nextStep.row, true);

    // Aggiorna le coordinate logiche del rover
    // Teniamo traccia della cella di provenienza per bloccare la costruzione durante il tween
    rover.fromCol = prevCol;
    rover.fromRow = prevRow;
    rover.col = nextStep.col;
    rover.row = nextStep.row;

    const dCol = nextStep.col - prevCol;
    const dRow = nextStep.row - prevRow;

    // Ruota il rover in base al passo sulla griglia prima di avviare il tween.
    if (dCol === 1 && dRow === 0) {
      rover.sprite.setTexture('rover-SE');
    } else if (dCol === -1 && dRow === 0) {
      rover.sprite.setTexture('rover-NW');
    } else if (dCol === 0 && dRow === 1) {
      rover.sprite.setTexture('rover-SW');
    } else if (dCol === 0 && dRow === -1) {
      rover.sprite.setTexture('rover-NE');
    }

    // Calcola la nuova posizione isometrica
    const { x: newCenterX, y: newCenterY } = cartesianToIsometric(nextStep.col, nextStep.row);
    const newX = newCenterX;
    const newY = newCenterY + (TILE_H / 2);

    // Calcola la posizione corrente per il tween
    const { x: oldCenterX, y: oldCenterY } = cartesianToIsometric(prevCol, prevRow);
    const oldX = oldCenterX;
    const oldY = oldCenterY + (TILE_H / 2);

    // Usiamo un oggetto temporaneo per il tween del movimento
    const tweenTarget = { x: oldX, y: oldY };

    rover.tween = this.tweens.add({
      targets: tweenTarget,
      x: newX,
      y: newY,
      duration: 600, // movimento più lento e pesante
      ease: 'Linear',
      onUpdate: () => {
        rover.sprite.setPosition(tweenTarget.x, tweenTarget.y + rover.visualYOffset);
        this._updateSpriteDepth(rover.sprite);
      },
      onComplete: () => {
        rover.tween = null; // svuota il riferimento
        // Rilascia la tile di provenienza
        rover.fromCol = null;
        rover.fromRow = null;

        rover.sprite.setPosition(newX, newY + rover.visualYOffset);
        this._updateSpriteDepth(rover.sprite);

        // Esplora le tile intorno alla nuova posizione
        this._revealFog(nextStep.col, nextStep.row, ROVER_EXPLORE_RADIUS);

        // Prossimo passo (controllerà di nuovo l'energia)
        this._animateRoverStep(rover);
      }
    });
  }

  // =========================================================================
  // CICLO GIORNO/NOTTE E GESTIONE ENERGIA
  // =========================================================================

  _startDayTimer() {
    this.isDay = true;
    this._recalculateEnergy();

    this.tweens.add({
      targets: this.darknessOverlay,
      alpha: 0,
      duration: 5000
    });

    this.time.delayedCall(120000, this._startNightTimer, [], this);
  }

  _startNightTimer() {
    this.isDay = false;
    this._recalculateEnergy();

    this.tweens.add({
      targets: this.darknessOverlay,
      alpha: 0.6,
      duration: 5000
    });

    this.time.delayedCall(60000, this._startDayTimer, [], this);
  }

  _recalculateEnergy() {
    this._updateEnergyUI();
  }

  _updateEnergyUI() {
    // Update day/night badge in top-bar
    const timeEl = document.getElementById('time-display-top');
    if (timeEl) {
      timeEl.innerText = this.isDay ? 'GIORNO' : 'NOTTE 🌑';
      timeEl.style.color = this.isDay ? '#d29922' : '#8b949e';
      timeEl.style.borderColor = this.isDay ? '#463a1c' : '#30363d';
      timeEl.style.background = this.isDay ? '#1a1608' : '#0d1117';
    }
  }

  // =========================================================================
  // METODI INFRASTRUTTURA
  // =========================================================================

  _centerCameraOnGrid() {
    const { x: cx, y: cy } = cartesianToIsometric(GRID_SIZE / 2, GRID_SIZE / 2);
    this.cameras.main.centerOn(cx, cy);
  }

  _setupKeyboard() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard.addKey('W'),
      down: this.input.keyboard.addKey('S'),
      left: this.input.keyboard.addKey('A'),
      right: this.input.keyboard.addKey('D'),
    };
  }

  _handleCameraKeyboard() {
    const cam = this.cameras.main;
    if (this.cursors.up.isDown || this.wasd.up.isDown) cam.scrollY -= CAM_SPEED;
    if (this.cursors.down.isDown || this.wasd.down.isDown) cam.scrollY += CAM_SPEED;
    if (this.cursors.left.isDown || this.wasd.left.isDown) cam.scrollX -= CAM_SPEED;
    if (this.cursors.right.isDown || this.wasd.right.isDown) cam.scrollX += CAM_SPEED;
  }

  _setupMousePan() {
    this._drag = { active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 };
    this.input.on('pointerdown', (p) => {
      if (p.rightButtonDown()) return; // Non trascinare con tasto destro
      this._drag.active = true;
      this._drag.startX = p.x;
      this._drag.startY = p.y;
      this._drag.camStartX = this.cameras.main.scrollX;
      this._drag.camStartY = this.cameras.main.scrollY;
    });
    this.input.on('pointermove', (p) => {
      if (!this._drag.active) return;
      this.cameras.main.scrollX = this._drag.camStartX - (p.x - this._drag.startX);
      this.cameras.main.scrollY = this._drag.camStartY - (p.y - this._drag.startY);
    });
    this.input.on('pointerup', () => this._drag.active = false);
  }

  _createHUD() {
    // HUD testo interno Phaser rimosso: tutto gestito dalla Top Bar HTML.
  }
}

// ---------------------------------------------------------------------------
// CONFIGURAZIONE PHASER
// ---------------------------------------------------------------------------

const SIDEBAR_W = 280;  // Deve corrispondere a --sidebar-w in CSS
const TOP_BAR_H = 48;   // Deve corrispondere a --top-bar-h in CSS

function getGameSize() {
  return {
    w: window.innerWidth - SIDEBAR_W,
    h: window.innerHeight - TOP_BAR_H
  };
}

const { w: initW, h: initH } = getGameSize();

const config = {
  type: Phaser.AUTO,
  width: initW,
  height: initH,
  backgroundColor: '#0a0a0a',
  parent: 'phaser-game',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  input: {
    mouse: {
      target: null,   // Usa il canvas come target
      capture: true   // Cattura per gestire RMB
    }
  },
  scene: [MoonbaseScene],
};

const game = new Phaser.Game(config);

// Gestione Resize Finestra
window.addEventListener('resize', () => {
  const { w, h } = getGameSize();
  game.scale.resize(w, h);
});
