// =============================================================================
// MOONBASE — Scena Principale: MoonbaseScene
// Responsabilità:
//   1. Preload degli asset
//   2. Setup iniziale (mappa, griglia, fog, camera)
//   3. Rendering e Input (mouse pointer, camera pan/zoom, keyboard)
//   4. Inizializzare EconomyManager, UIManager e Rover
//
// NON contiene: logica economica, aggiornamento DOM diretto, A*.
// =============================================================================

import { cartesianToIsometric, isometricToCartesian } from '../utils/isometric.js';
import { aStarPathfind } from '../utils/pathfinding.js';
import { Rover } from '../entities/Rover.js';
import { Building } from '../entities/Building.js';
import { EconomyManager } from '../systems/EconomyManager.js';
import { UIManager } from '../ui/UIManager.js';
import { MissionControl } from '../ui/MissionControl.js';
import {
  GRID_SIZE,
  TILE_W,
  TILE_H,
  TERRAIN_VARIANTS,
  TERRAIN_COLORS,
  TERRAIN_NORMAL,
  TERRAIN_ICE,
  TERRAIN_REGOLITH,
  CAM_SPEED,
  CAMERA_ZOOM,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_SENSITIVITY,
  ROVER_COST,
  ROVER_COST_TYPE,
  ROVER_EXPLORE_RADIUS,
  ROVER_MAX_CHARGE,
  INITIAL_EXPLORED_SIZE,
  BUILDINGS_INFO,
  TILE_STROKE_COLOR,
  TILE_STROKE_WIDTH,
  GIACIMENTO_MINOR_SIZE,
  GIACIMENTO_MINOR_MIN_TILES,
  GIACIMENTO_MINOR_MAX_TILES,
  GIACIMENTO_MINOR_COUNT_ICE,
  GIACIMENTO_MINOR_COUNT_REG,
  GIACIMENTO_MAJOR_SIZE,
  GIACIMENTO_MAJOR_MIN_TILES,
  GIACIMENTO_MAJOR_MAX_TILES,
  GIACIMENTO_MAJOR_COUNT_ICE,
  GIACIMENTO_MAJOR_COUNT_REG,
  GIACIMENTO_CMD_SAFE_RADIUS,
  GIACIMENTO_MAX_ATTEMPTS,
  DISTRICT_TYPES,
  DISTRICT_SLOT_OFFSETS,
} from '../constants.js';
import {
  SUPPLY_DROP_INTERVAL_MS,
  SUPPLY_DROP_COMPONENTS,
  ARTEMIS_WRECK_REGOLITH,
  INITIAL_WRECK_COUNT,
  DEMOLISH_REFUND_DURING,
  DEMOLISH_REFUND_AFTER,
  ROVER_WRECK_RECYCLE_COMP,
  DISTRICT_MODULE_NEIGHBOR_GAP,
  DEPOSIT_MIN_CAPACITY,
  DEPOSIT_MAX_CAPACITY,
  DEPOSIT_RICH_DIST,
  DEPOSIT_POOR_DIST,
  DEPOSIT_NOISE_RANGE,
} from '../balance.js';

export class MoonbaseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MoonbaseScene' });
  }

  // ===========================================================================
  // PRELOAD
  // ===========================================================================

  preload() {
    this.load.on('loaderror', (fileObj) => {
      console.error('Errore Caricamento Asset:', fileObj.key, fileObj.src);
    });
    this.load.image('rover-N', './graphics/rover-N.png');
    this.load.image('rover-S', './graphics/rover-S.png');
    this.load.image('rover-E', './graphics/rover-E.png');
    this.load.image('rover-W', './graphics/rover-W.png');
    this.load.image('rover-NE', './graphics/rover-NE.png');
    this.load.image('rover-NW', './graphics/rover-NW.png');
    this.load.image('rover-SE', './graphics/rover-SE.png');
    this.load.image('rover-SW', './graphics/rover-SW.png');
    this.load.image('solar-panel', './graphics/solar-panel.png');
    this.load.image('regolith-extractor', './graphics/regolith-extractor.png');
    this.load.image('hab-module', './graphics/hab-module.png');
    this.load.image('ice-extractor', './graphics/ice-extractor.png');
    this.load.image('isru', './graphics/isru.png');
    this.load.image('power-center', './graphics/power-center.png');
    this.load.image('command', './graphics/command.png');
    this.load.image('mining-hub', './graphics/mining-hub.png');
    this.load.image('cryo-hub', './graphics/cryo-hub.png');
    this.load.image('component-factory', './graphics/component-factory.png');
    this.load.image('conduit-node', './graphics/conduit/conduit-node.png');
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].forEach(d =>
      this.load.image(`conduit-${d}`, `./graphics/conduit/conduit-${d}.png`)
    );
    this.load.image('decal-fog', './graphics/fog.png');
    this.load.image('decal-ice', './graphics/ice.png');
    this.load.image('decal-regolith', './graphics/regolith.png');
    this.load.image('decal-sand', './graphics/sand.png');
    this.load.image('decal-sand-light', './graphics/sand-light.png');

    this.load.json('rocks-manifest', './graphics/rocks/manifest.json');
    this.load.on('filecomplete-json-rocks-manifest', (_key, _type, files) => {
      files.forEach((filename, i) => {
        this.load.image(`rock-${i}`, `./graphics/rocks/${filename}`);
      });
    });

    this.load.image('crater', './graphics/crater.png');
    this.load.image('crater-big', './graphics/crater-big.png');
    this.load.image('ridge', './graphics/ridge.png');
    this.load.image('artemis-wreck', './graphics/artemis-wreck.png');
    this.load.image('supply-drop', './graphics/supply-drop.png');

    this.load.audio('bgm', './sound/music.wav');
    this.load.audio('sfx-rover-action', './sound/rover-action.wav');
    this.load.audio('sfx-rover-move', './sound/rover-move.wav');
    this.load.audio('sfx-build-solar', './sound/solar-panel.wav');
    this.load.audio('sfx-build-extractor', './sound/regolith-extractor.wav');
  }

  // ===========================================================================
  // INIT  (stato reset-able)
  // ===========================================================================

  init() {
    this.selectedBuilding = null;
    this.selectedDistrict = null;
    this.selectedRover = null;
    this.selectedEntity = null;   // { type: 'rover'|'building', ref } oppure null
    this.isGamePaused = false;
    this.isGameOver = false;

    this._selectedRoverWasMoving = false;

    this.buildings = [];
    this.rovers = [];
    this.districts = [];
    this.occupiedTiles = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    // districtGrid[row][col] = district object | null — traccia ownership delle tile distretto
    this.districtGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

    this.capacityGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    // Terreno: Giacimenti a cluster 2×2 con buffer e safe zone Comando
    this.terrainGrid = this._generateTerrainGrid();

    // Fog of War
    this.exploredTiles = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    this._isUndoingNetwork = false;
    const centerCol = Math.floor(GRID_SIZE / 2);
    const centerRow = Math.floor(GRID_SIZE / 2);
    const halfExpl = Math.floor(INITIAL_EXPLORED_SIZE / 2);
    for (let r = centerRow - halfExpl; r <= centerRow + halfExpl; r++) {
      for (let c = centerCol - halfExpl; c <= centerCol + halfExpl; c++) {
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
          this.exploredTiles[r][c] = true;
        }
      }
    }
    this.pois = [];
    this.terrainProps = [];
  }

  // ===========================================================================
  // CREATE
  // ===========================================================================

  create() {

    this.cameras.main.setBackgroundColor('#000000');

    // 1. Definiamo le mezze dimensioni basandoci sulle tue costanti
    const halfW = (GRID_SIZE * TILE_W) / 2;
    const halfH = (GRID_SIZE * TILE_H) / 2;

    const bgFloor = this.add.graphics();
    bgFloor.fillStyle(0x767676, 1);

    bgFloor.beginPath();
    // 2. Disegniamo i punti centrati su (0,0)
    bgFloor.moveTo(0, -halfH);       // Nord (Sopra l'origine)
    bgFloor.lineTo(halfW, 0);        // Est  (A destra dell'origine)
    bgFloor.lineTo(0, halfH);        // Sud  (Sotto l'origine)
    bgFloor.lineTo(-halfW, 0);       // Ovest (A sinistra dell'origine)
    bgFloor.closePath();
    bgFloor.fillPath();

    // 1. Chiediamo alla tua funzione dove si trova la tile (0,0)
    const mapOrigin = cartesianToIsometric(0, 0);

    // 2. Calibrazione Finale
    // X: Rimuoviamo l'offset di 1/4 e lo rendiamo neutro o leggermente corretto
    bgFloor.x = mapOrigin.x;

    // Y: Qui sta il segreto. Per allineare la punta del rombo alla punta della tile,
    // dobbiamo compensare l'altezza della singola tile.
    bgFloor.y = mapOrigin.y + halfH - (TILE_H / 2);

    // 3. Profondità
    bgFloor.setDepth(-1000);


    // --- EventEmitter condiviso tra Economy e UI ---
    this._emitter = new Phaser.Events.EventEmitter();

    // --- EconomyManager ---
    this.economy = new EconomyManager(this._emitter, this);
    this.economy.init(this.buildings, this.rovers);

    // --- UIManager ---
    this.ui = new UIManager(this._emitter, {
      onTogglePause: (btn) => this._togglePause(btn),
      onToggleResourceLens: () => this._toggleResourceLens(),
    });

    // --- MissionControl (Sprint 4) ---
    this.missionControl = new MissionControl(this._emitter, this.ui);

    // Ascolta game-over dalla scena (per fermare i rover)
    this._emitter.on('game-over', () => {
      this.isGamePaused = true;
      this.isGameOver = true;
      this.rovers.forEach(r => { if (r._moveTween?.isPlaying()) r.pauseMovement(); });
    });

    // --- Sprint 3: Speed & Hazards ---
    this._emitter.on('change-speed', ({ speed }) => {
      this.time.timeScale = speed;
      this.tweens.timeScale = speed;
    });

    this._emitter.on('hazard-destroy-conduit', ({ targets }) => {
      targets.forEach(t => {
        const b = this.buildings.find(
          b2 => b2.col === t.col && b2.row === t.row && b2.type === 'conduit'
        );
        if (b) {
          this._damageConduit(b);
        }
      });
    });

    this._emitter.on('o2-emergency', ({ active }) => {
      if (active) this.cameras.main.shake(300, 0.003);
    });

    this._emitter.on('hazard-event', ({ type }) => {
      if (type === 'MICROMETEORITES') this.cameras.main.shake(500, 0.01);
    });

    this._generateProceduralTextures();
    this._generateTileShadowTexture();

    // --- SPRINT 1 Events ---
    this._emitter.on('resource-depleted', ({ col, row }) => {
      if (this.tileResourceGraphics[row]?.[col]) {
        this.tileResourceGraphics[row][col].destroy();
        this.tileResourceGraphics[row][col] = null;
      }
      if (this.resourceLensGraphics[row]?.[col]) {
        this.resourceLensGraphics[row][col].destroy();
        this.resourceLensGraphics[row][col] = null;
      }
      this.terrainGrid[row][col] = TERRAIN_NORMAL;
      this._showFloatingText(col, row, "DEPLETED", false);
    });

    // --- Griglia isometrica ---
    this.tileGraphics = [];
    this.tileShadowGraphics = [];
    this.tileResourceGraphics = [];
    this.resourceLensGraphics = [];
    this.showResourceLens = false;
    this._drawGrid();
    this._drawResourceLens();
    this._drawNaturalTerrainElements(); // SPRINT 1
    this._spawnInitialPOIs();           // SPRINT 1
    this._spawnRocks();
    this._spawnCraters();
    this.gridOverlay = this.add.graphics();
    this.gridOverlay.setDepth(0);
    this._drawGridIntersections();

    // --- Fog of War ---
    this.fogGraphics = [];
    this._drawFogOfWar();
    this.mapBorderGraphics = [];
    this.mapEdgeMasks = [];
    this._drawMapBorder();

    // --- Layer edifici ---
    this.buildingLayer = this.add.container();

    // --- Highlighter (fantasma costruzione) ---
    this.highlighter = this.add.graphics();
    this.highlighter.setDepth(45000);
    this.roverSelectionGraphics = this.add.graphics();
    this.roverSelectionGraphics.setDepth(0);
    this.buildingSelectionGraphics = this.add.graphics();
    this.buildingSelectionGraphics.setDepth(9999);

    // --- NUOVO: Path Preview Graphics & Cache ---
    this.pathPreviewGraphics = this.add.graphics();
    this.pathPreviewGraphics.setDepth(45000);
    this._lastHoverCol = null;
    this._lastHoverRow = null;
    this._lastHoverPath = null;

    // --- Indicatore selezione (triangolino statico) ---
    this._selectionIndicatorGfx = this._createSelectionIndicatorGfx();

    // --- Input ---
    this._setupKeyboard();
    this._setupMousePan();
    this._setupGlobalGridPicking();
    this._domAbortController?.abort();
    this._domAbortController = new AbortController();
    const { signal } = this._domAbortController;
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });

    // --- Camera ---
    const cam = this.cameras.main;
    cam.setZoom(CAMERA_ZOOM);

    this.input.on('wheel', (_p, _go, _dx, deltaY) => {
      cam.setZoom(Phaser.Math.Clamp(
        cam.zoom - deltaY * CAMERA_ZOOM_SENSITIVITY,
        CAMERA_ZOOM_MIN,
        CAMERA_ZOOM_MAX
      ));
    });

    this.input.setDefaultCursor("url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\" viewBox=\"0 0 32 32\"><path d=\"M 4 5 L 13 25 L 16 16 L 25 13 Z\" fill=\"%23000000\" opacity=\"0.3\"/><path d=\"M 2 3 L 11 23 L 14 14 L 23 11 Z\" fill=\"%23f0f0fa\" stroke=\"%23333b47\" stroke-width=\"1.5\" stroke-linejoin=\"round\"/></svg>') 2 3, default");

    // --- Overlay oscurità notte ---
    this.darknessOverlay = this.add.rectangle(0, 0, cam.width, cam.height, 0x000000)
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(50000);

    this.scale.on('resize', (gameSize) => {
      this.darknessOverlay.setSize(gameSize.width, gameSize.height);
    });

    // --- Ciclo giorno/notte ---
    this.economy.startDayTimer();

    // --- SPRINT 1: Supply Drops ogni 2 minuti ---
    this._supplyDropEvent?.remove(false);
    this._supplyDropEvent = this.time.addEvent({
      delay: SUPPLY_DROP_INTERVAL_MS,
      callback: () => this._spawnSupplyDrop(),
      loop: true
    });

    // --- Distretto Comando Iniziale ---
    const centerCol = Math.floor(GRID_SIZE / 2);
    const centerRow = Math.floor(GRID_SIZE / 2);
    this._initCommandDistrict(centerCol, centerRow);

    // --- Rover gratuito iniziale (a destra del Comando, nessun costo) ---
    this._createRover(centerCol + 1, centerRow);

    // --- [DEV] Bottone "Rivela Mappa" — rimuovere prima del rilascio ---
    document.getElementById('btn-dev-reveal')
      ?.addEventListener('click', () => this._revealAllMap(), { signal });

    // --- [DEV] Bottone "Trigger Meteoriti" — rimuovere prima del rilascio ---
    document.getElementById('btn-dev-meteor')
      ?.addEventListener('click', () => this.economy._triggerMicrometeorites(), { signal });

    // --- Centra camera ---
    this._centerCameraOnGrid();

    // Forza il primo tick per aggiornare UI e applicare buff iniziali
    this.economy.processEconomyTick();
    this.economy.startEconomyLoop();

    // --- Musica di sottofondo ---
    // Il browser blocca l'audio finché l'utente non interagisce con la pagina.
    // Phaser segnala lo sblocco tramite l'evento 'unlocked' sul SoundManager.
    this.bgm = this.sound.add('bgm', { loop: true, volume: 0.05 });
    if (this.sound.locked) {
      this.sound.once('unlocked', () => this.bgm.play());
    } else {
      this.bgm.play();
    }
  }

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  update(time) {
    // Aggiornamento tracker UI (HTML)
    if (this.economy._dayNightTimer) {
      const timer = this.economy._dayNightTimer;
      const remainingSecs = Math.ceil((timer.delay - timer.getElapsed()) / 1000);

      this.ui.updateTimeTracker(
        this.economy.isDay,
        this.economy.stats.totalDaysElapsed,
        remainingSecs,
        timer.getProgress()
      );
    }

    const pointer = this.input.activePointer;
    const { col, row } = isometricToCartesian(pointer.worldX, pointer.worldY);

    if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE && this.exploredTiles[row][col]) {
      const building = this.buildings.find(b => b.col === col && b.row === row && b.type !== 'conduit');
      const damagedConduit = this.buildings.find(b => b.col === col && b.row === row && b.type === 'conduit' && b.isDamaged);
      const rover = this.rovers.find(r => r.col === col && r.row === row);
      const terrain = this.terrainGrid[row][col];

      // --- NUOVO: Cerca se c'è un POI (Supply o Wreck) sulla tile ---
      const poi = this.pois.find(p => p.col === col && p.row === row);

      let tooltipData = null;

      if (rover) {
        tooltipData = {
          title: "Rover Unit",
          rows: [
            { label: "Charge", val: `${rover.charge}/${ROVER_MAX_CHARGE}` },
            { label: "Hull", val: `${Math.round(rover.durability)}%` }
          ]
        };
      } else if (damagedConduit) {
        tooltipData = {
          title: "DAMAGED CONDUIT",
          rows: [
            { label: "Status", val: "CRITICAL DAMAGE" },
            { label: "Repair cost", val: "5 REGOLITH" },
            { label: "Action", val: "Move Rover here to repair" }
          ]
        };
      } else if (building) {
        const info = BUILDINGS_INFO[building.type];
        tooltipData = {
          title: info.name,
          rows: [
            { label: "Status", val: building.isPowered ? "ONLINE" : "OFFLINE" },
            { label: "Condition", val: building.connected ? "CONNECTED" : "NO NETWORK" }
          ]
        };
      } else if (poi) {
        // --- Tooltip per i Punti di Interesse ---
        const isSupply = poi.type === 'supply';
        tooltipData = {
          title: isSupply ? "SUPPLY POD" : "ARTEMIS WRECK",
          rows: [
            { label: "Type", val: isSupply ? "Resources" : "Salvage" },
            { label: "Content", val: isSupply ? `+${poi.reward} Components` : `+${poi.reward} Regolith` },
            { label: "Action", val: "Move Rover here to collect" }
          ]
        };
      } else if (terrain === 'crater' || terrain === 'ridge') {
        const terrainName = this.terrainNamesGrid[row][col] || "Unnamed Formation";
        tooltipData = {
          title: terrainName,
          rows: [
            { label: "Type", val: terrain.toUpperCase() },
            { label: "Status", val: "IMPASSABLE" }, // Indica che non è passabile
            { label: "Hazard", val: "Extreme Terrain" }
          ]
        };
      } else if (terrain !== TERRAIN_NORMAL) {
        tooltipData = {
          title: terrain.toUpperCase(),
          rows: [
            { label: "Yield", val: `${this.capacityGrid[row][col]} units` }
          ]
        };
      }

      if (tooltipData) {
        this.ui.showTooltip(pointer.x, pointer.y, tooltipData);
      } else {
        this.ui.hideTooltip();
      }
    } else {
      this.ui.hideTooltip();
    }

    // 2. Se in pausa, interrompi il resto della logica di gioco
    if (this.isGamePaused) return;

    this._handleCameraKeyboard();
    this._updateHighlighter();
    this._drawSelectedRoverBrackets();
    this._updateSelectionIndicatorPosition();

    // Ricalcola costruzioni disponibili quando il rover selezionato smette di muoversi
    if (this.selectedRover) {
      const isMoving = this.selectedRover.moving;
      if (this._selectedRoverWasMoving && !isMoving) {
        this._updateContextPanel();
      }
      this._selectedRoverWasMoving = isMoving;
    }

    this.rovers.forEach(r => {
      // SPRINT 1: Check POIs
      this._checkPOIOccupation(r);
    });

    if (!this.economy.isPaused) {
      // Manual tick removed in Sprint 3 in favor of Phaser timers
    }
    this._applyBuildingVisuals();
    this._updateDistrictBadges();
    this._updateStatusIcons();
  }


  // ===========================================================================
  // GENERAZIONE TERRENO — Algoritmo Giacimenti
  // ===========================================================================

  /**
   * Costruisce la griglia del terreno usando l'algoritmo a Giacimenti.
   *
   * Due tipologie di deposito, ciascuna con un singolo tipo di risorsa:
   *
   *  ● Giacimento Minore (Comune, ~80%): bounding box 2×2, 2–4 tile risorsa.
   *  ● Giacimento Maggiore (Raro,  ~20%): bounding box 5×5, 15–25 tile risorsa.
   *
   * Regole condivise:
   *  – Anello buffer vuoto di 1 tile attorno a qualsiasi bounding box
   *    (zona esclusiva = (size+2)×(size+2)). Due Giacimenti non si toccano mai.
   *  – Safe Zone attorno al Modulo Comando: nessun tile risorsa entro
   *    GIACIMENTO_CMD_SAFE_RADIUS caselle (distanza Chebyshev) dal centro.
   *
   * @returns {string[][]} griglia GRID_SIZE × GRID_SIZE con tipi di terreno
   */
  _generateTerrainGrid() {
    const LUNAR_CRATER_NAMES = [
      "Shackleton Crater", "Nobile Crater", "Malapert Crater", "Cabeus Crater", "Shoemaker Crater", "Faustini Crater",
      "Copernicus Crater", "Tycho Crater", "Kepler Crater", "Aristarchus Crater", "Grimaldi Crater", "Langrenus Crater",
      "Clavius Crater", "Plato Crater", "Endymion Crater", "Cassini Crater", "Eratosthenes Crater", "Archimedes Crater"
    ];
    const LUNAR_RIDGE_NAMES = [
      "Montes Apenninus", "Montes Caucasus", "Rupes Recta", "Montes Carpatus",
      "Montes Haemus", "Rupes Altai", "Montes Taurus", "Montes Alpes",
      "Montes Jura", "Montes Pyrenaeus", "Montes Cordillera", "Montes Rook",
      "Montes Riphaeus", "Montes Spitzbergen", "Montes Teneriffe", "Montes Secchi",
      "Rupes Cauchy", "Rupes Liebig", "Rupes Boris"
    ];
    const LUNAR_MARE_NAMES = [
      "Mare Tranquillitatis", "Mare Serenitatis", "Mare Crisium", "Mare Fecunditatis",
      "Mare Imbrium", "Mare Nectaris", "Mare Nubium", "Mare Frigoris",
      "Oceanus Procellarum", "Sinus Iridum", "Lacus Mortis", "Lacus Somniorum",
      "Mare Smythii", "Mare Orientale", "Mare Cognitum"
    ];

    Phaser.Utils.Array.Shuffle(LUNAR_CRATER_NAMES);
    Phaser.Utils.Array.Shuffle(LUNAR_RIDGE_NAMES);
    Phaser.Utils.Array.Shuffle(LUNAR_MARE_NAMES);

    this.terrainNamesGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(TERRAIN_NORMAL));
    this.capacityGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

    const cmdCol = Math.floor(GRID_SIZE / 2);
    const cmdRow = Math.floor(GRID_SIZE / 2);
    const SAFE_R = 1;

    const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    const distBasedCapacity = (dist) => {
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const t       = clamp(dist, DEPOSIT_RICH_DIST, DEPOSIT_POOR_DIST);
      const falloff = 1 - (t - DEPOSIT_RICH_DIST) / (DEPOSIT_POOR_DIST - DEPOSIT_RICH_DIST);
      const base    = DEPOSIT_MIN_CAPACITY + falloff * (DEPOSIT_MAX_CAPACITY - DEPOSIT_MIN_CAPACITY);
      const noise   = (Math.random() * 2 - 1) * DEPOSIT_NOISE_RANGE;
      return Math.round(clamp(base + noise, DEPOSIT_MIN_CAPACITY, DEPOSIT_MAX_CAPACITY));
    };
    const depositAccumulator = [];

    // Arrays SEPARATI per garantire una distribuzione uniforme di ENTRAMBI su tutta la mappa
    const placedCraters = [];
    const placedRidges = [];

    // ─── HELPER: Validazione Base ───────────────────────────────────────────
    const canPlaceBase = (ar, ac, size) => {
      if (ar - 1 < 0 || ar + size > GRID_SIZE - 1) return false;
      if (ac - 1 < 0 || ac + size > GRID_SIZE - 1) return false;
      if (ar <= cmdRow + SAFE_R && ar + size - 1 >= cmdRow - SAFE_R && ac <= cmdCol + SAFE_R && ac + size - 1 >= cmdCol - SAFE_R) return false;
      for (let row = ar - 1; row <= ar + size; row++) {
        for (let col = ac - 1; col <= ac + size; col++) {
          if (grid[row][col] !== TERRAIN_NORMAL) return false;
        }
      }
      return true;
    };

    // ─── 1. FASE 1: CRATERI (Spalmati su tutta la mappa) ─────────────────────
    this.squareCraters = [];
    const craterSpecs = [{ size: 5, count: 2 }, { size: 4, count: 4 }, { size: 3, count: 6 }, { size: 2, count: 8 }];

    let craterMinDist = 8;

    for (const spec of craterSpecs) {
      let placed = 0; let attempts = 0;
      while (placed < spec.count && attempts < 1000) {
        attempts++;
        if (attempts % 50 === 0 && craterMinDist > 3) craterMinDist--;

        const ar = randInt(1, GRID_SIZE - spec.size - 1);
        const ac = randInt(1, GRID_SIZE - spec.size - 1);
        const centerR = ar + (spec.size - 1) / 2;
        const centerC = ac + (spec.size - 1) / 2;

        // Un cratere controlla la distanza SOLO dagli altri crateri
        const tooClose = placedCraters.some(a => Math.hypot(a.r - centerR, a.c - centerC) < craterMinDist);

        if (!tooClose && canPlaceBase(ar, ac, spec.size)) {
          const craterName = LUNAR_CRATER_NAMES.pop() || `CRATER ${randInt(100, 999)}`;
          this.squareCraters.push({ row: ar, col: ac, size: spec.size, name: craterName });
          for (let r = ar; r < ar + spec.size; r++) {
            for (let c = ac; c < ac + spec.size; c++) {
              grid[r][c] = 'crater';
              this.terrainNamesGrid[r][c] = craterName;
            }
          }
          placedCraters.push({ r: centerR, c: centerC });
          placed++;
          craterMinDist = 8;
        }
      }
    }

    // ─── 2. FASE 2: MONTAGNE (Spalmate e con wobble più caotico) ─────────────
    const placeOrganicRidges = (count, minT, maxT) => {
      let placed = 0; let attempts = 0; let ridgeMinDist = 8;

      while (placed < count && attempts < 400) {
        attempts++;
        if (attempts % 40 === 0 && ridgeMinDist > 3) ridgeMinDist--;

        const N = randInt(minT, maxT);
        let seeds = [];
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] === TERRAIN_NORMAL && Math.max(Math.abs(r - cmdRow), Math.abs(c - cmdCol)) > SAFE_R + 1) {
              // La montagna controlla la distanza dalle altre montagne, e assicura solo un minimo distacco (3) dai crateri
              const tooCloseToRidge = placedRidges.some(a => Math.hypot(a.r - r, a.c - c) < ridgeMinDist);
              const tooCloseToCrater = placedCraters.some(a => Math.hypot(a.r - r, a.c - c) < 4);
              if (!tooCloseToRidge && !tooCloseToCrater) seeds.push({ r, c });
            }
          }
        }
        if (seeds.length === 0) continue;
        Phaser.Utils.Array.Shuffle(seeds);

        let success = false;
        for (const seed of seeds) {
          let deposit = [seed];
          let path = [seed];
          grid[seed.r][seed.c] = 'ridge';
          const visited = new Set([`${seed.r},${seed.c}`]);

          let angle = Math.random() * Math.PI * 2;

          while (deposit.length < N && path.length > 0) {
            const current = path[path.length - 1];
            let neighbors = [];

            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const nr = current.r + dr, nc = current.c + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && grid[nr][nc] === TERRAIN_NORMAL && !visited.has(`${nr},${nc}`)) {
                if (Math.max(Math.abs(nr - cmdRow), Math.abs(nc - cmdCol)) > SAFE_R) {
                  let valid = true;
                  for (let ddr = -1; ddr <= 1; ddr++) {
                    for (let ddc = -1; ddc <= 1; ddc++) {
                      const nnr = nr + ddr, nnc = nc + ddc;
                      if (nnr >= 0 && nnr < GRID_SIZE && nnc >= 0 && nnc < GRID_SIZE) {
                        if (grid[nnr][nnc] === 'crater') valid = false;
                        if (grid[nnr][nnc] === 'ridge' && !deposit.some(d => d.r === nnr && d.c === nnc)) valid = false;
                      }
                    }
                  }
                  if (valid) neighbors.push({ r: nr, c: nc });
                }
              }
            }

            if (neighbors.length === 0) {
              path.pop();
              continue;
            }

            // Wobble molto più marcato per evitare le linee rette diagonali
            angle += (Math.random() - 0.5) * 3.5;
            const dx = Math.cos(angle), dy = Math.sin(angle);

            neighbors.sort((a, b) => {
              const alignA = (a.r - current.r) * dy + (a.c - current.c) * dx;
              const alignB = (b.r - current.r) * dy + (b.c - current.c) * dx;
              // Aumentato il peso della casualità per fare montagne più aggrovigliate
              return (alignA + Math.random() * 1.5) - (alignB + Math.random() * 1.5);
            });

            const next = neighbors.pop();
            grid[next.r][next.c] = 'ridge';
            deposit.push(next);
            path.push(next);
            visited.add(`${next.r},${next.c}`);
          }

          if (deposit.length >= N * 0.6) {
            const name = LUNAR_RIDGE_NAMES.pop() || `RIDGE ${randInt(100, 999)}`;
            let sumR = 0, sumC = 0;
            deposit.forEach(cell => {
              this.terrainNamesGrid[cell.r][cell.c] = name;
              sumR += cell.r; sumC += cell.c;
            });
            placedRidges.push({ r: sumR / deposit.length, c: sumC / deposit.length });
            depositAccumulator.push({ type: 'ridge', tiles: deposit.map(d => ({ row: d.r, col: d.c })) });

            placed++; ridgeMinDist = 8; attempts = 0; success = true; break;
          } else {
            deposit.forEach(cell => grid[cell.r][cell.c] = TERRAIN_NORMAL);
          }
        }
        if (!success && attempts > 200) break;
      }
    };

    placeOrganicRidges(12, 5, 8);

    // ─── 3. DISTANCE FIELDS HELPER ───────────────────────────────────────────
    const calcDistField = (target) => {
      const dist = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(Infinity));
      const queue = [];
      for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) if (grid[r][c] === target) { dist[r][c] = 0; queue.push({ r, c }); }
      let head = 0;
      while (head < queue.length) {
        const { r, c } = queue[head++];
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && dist[nr][nc] > dist[r][c] + 1) { dist[nr][nc] = dist[r][c] + 1; queue.push({ r: nr, c: nc }); }
        }
      }
      return dist;
    };

    const distCrater = calcDistField('crater');
    const distRidge = calcDistField('ridge');

    // ─── 4a. FASE 3a: GIACIMENTI MAGGIORI (Attaccati agli ostacoli) ──────────
    const growMajor = (targetType, count, minT, maxT, distField, avoidType, depositNameList) => {
      let placed = 0; let attempts = 0;
      while (placed < count && attempts < 150) {
        attempts++;
        const N = randInt(minT, maxT);
        let seeds = [];
        for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) {
          if (grid[r][c] === TERRAIN_NORMAL && distField[r][c] === 1 && Math.max(Math.abs(r - cmdRow), Math.abs(c - cmdCol)) > SAFE_R) seeds.push({ r, c });
        }
        if (seeds.length === 0) break;
        Phaser.Utils.Array.Shuffle(seeds);
        let success = false;
        for (const seed of seeds) {
          let deposit = []; const frontier = [seed]; const visited = new Set([`${seed.r},${seed.c}`]);
          while (deposit.length < N && frontier.length > 0) {
            frontier.sort((a, b) => (Math.random() * 2 - distField[a.r][a.c]) - (Math.random() * 2 - distField[b.r][b.c]));
            const current = frontier.pop();
            let valid = true;
            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) {
              const nr = current.r + dr, nc = current.c + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
                if (grid[nr][nc] === avoidType) valid = false;
                if ((grid[nr][nc] === TERRAIN_ICE || grid[nr][nc] === TERRAIN_REGOLITH) && !deposit.some(d => d.r === nr && d.c === nc)) valid = false;
              }
            }
            if (!valid) continue;
            grid[current.r][current.c] = targetType;
            deposit.push(current);
            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const nr = current.r + dr, nc = current.c + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && grid[nr][nc] === TERRAIN_NORMAL && !visited.has(`${nr},${nc}`)) {
                if (Math.max(Math.abs(nr - cmdRow), Math.abs(nc - cmdCol)) > SAFE_R) { visited.add(`${nr},${nc}`); frontier.push({ r: nr, c: nc }); }
              }
            }
          }
          if (deposit.length >= N * 0.4) {
            let name = (targetType === TERRAIN_REGOLITH) ? depositNameList.pop() : null;
            deposit.forEach(cell => {
              this.capacityGrid[cell.r][cell.c] = distBasedCapacity(distField[cell.r][cell.c]);
              if (name) this.terrainNamesGrid[cell.r][cell.c] = name;
            });
            depositAccumulator.push({ type: targetType, tiles: deposit.map(d => ({ row: d.r, col: d.c })) });
            placed++; success = true; break;
          } else { deposit.forEach(cell => grid[cell.r][cell.c] = TERRAIN_NORMAL); }
        }
        if (!success && attempts > 50) break;
      }
    };

    growMajor(TERRAIN_ICE, 5, GIACIMENTO_MAJOR_MIN_TILES, GIACIMENTO_MAJOR_MAX_TILES, distCrater, TERRAIN_REGOLITH, []);
    growMajor(TERRAIN_REGOLITH, 8, GIACIMENTO_MAJOR_MIN_TILES, GIACIMENTO_MAJOR_MAX_TILES, distRidge, TERRAIN_ICE, LUNAR_MARE_NAMES);

    const distMajorIce = calcDistField(TERRAIN_ICE);
    const distMajorReg = calcDistField(TERRAIN_REGOLITH);

    // ─── 4b. FASE 3b: GIACIMENTI SATELLITE (Minori) ──────────────────────────
    const growSatellite = (targetType, count, minT, maxT, majorDistField, avoidType, featureDistField) => {
      let placed = 0; let attempts = 0;
      while (placed < count && attempts < 200) {
        attempts++;
        const N = randInt(minT, maxT);
        let seeds = [];
        for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) {
          if (grid[r][c] === TERRAIN_NORMAL &&
            majorDistField[r][c] >= 2 && majorDistField[r][c] <= 5 &&
            distCrater[r][c] > 1 && distRidge[r][c] > 1 &&
            Math.max(Math.abs(r - cmdRow), Math.abs(c - cmdCol)) > SAFE_R) {

            let touchesOther = false;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && (grid[nr][nc] === TERRAIN_ICE || grid[nr][nc] === TERRAIN_REGOLITH)) touchesOther = true;
            }
            if (!touchesOther) seeds.push({ r, c });
          }
        }
        if (seeds.length === 0) break;
        Phaser.Utils.Array.Shuffle(seeds);

        let success = false;
        for (const seed of seeds) {
          let deposit = []; const frontier = [seed]; const visited = new Set([`${seed.r},${seed.c}`]);
          while (deposit.length < N && frontier.length > 0) {
            frontier.sort((a, b) => (Math.random() * 2 - majorDistField[a.r][a.c]) - (Math.random() * 2 - majorDistField[b.r][b.c]));
            const current = frontier.pop();
            let valid = true;
            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) {
              const nr = current.r + dr, nc = current.c + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
                if (grid[nr][nc] === avoidType || grid[nr][nc] === 'crater' || grid[nr][nc] === 'ridge') valid = false;
                if ((grid[nr][nc] === TERRAIN_ICE || grid[nr][nc] === TERRAIN_REGOLITH) && !deposit.some(d => d.r === nr && d.c === nc)) valid = false;
              }
            }
            if (!valid) continue;
            grid[current.r][current.c] = targetType;
            deposit.push(current);
            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const nr = current.r + dr, nc = current.c + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && grid[nr][nc] === TERRAIN_NORMAL && !visited.has(`${nr},${nc}`)) {
                if (Math.max(Math.abs(nr - cmdRow), Math.abs(nc - cmdCol)) > SAFE_R) { visited.add(`${nr},${nc}`); frontier.push({ r: nr, c: nc }); }
              }
            }
          }
          if (deposit.length >= N * 0.4) {
            deposit.forEach(cell => {
              this.capacityGrid[cell.r][cell.c] = distBasedCapacity(featureDistField[cell.r][cell.c]);
            });
            depositAccumulator.push({ type: targetType, tiles: deposit.map(d => ({ row: d.r, col: d.c })) });
            placed++; success = true; break;
          } else { deposit.forEach(cell => grid[cell.r][cell.c] = TERRAIN_NORMAL); }
        }
      }
    };

    growSatellite(TERRAIN_ICE,      18, GIACIMENTO_MINOR_MIN_TILES, GIACIMENTO_MINOR_MAX_TILES, distMajorIce, TERRAIN_REGOLITH, distCrater);
    growSatellite(TERRAIN_REGOLITH, 32, GIACIMENTO_MINOR_MIN_TILES, GIACIMENTO_MINOR_MAX_TILES, distMajorReg, TERRAIN_ICE,      distRidge);

    this.depositGroups = depositAccumulator;
    return grid;
  }

  // ===========================================================================
  // GRIGLIA E TEXTURE
  // ===========================================================================

  _generateProceduralTextures() {
    const tempGfx = this.make.graphics({ x: 0, y: 0, add: false });
    const cx = TILE_W / 2, cy = TILE_H / 2;

    const verts = [
      { x: cx, y: 0 },
      { x: TILE_W, y: cy },
      { x: cx, y: TILE_H },
      { x: 0, y: cy },
    ];

    const drawSolidDiamond = (color) => {
      tempGfx.clear();
      tempGfx.fillStyle(color, 1);
      tempGfx.beginPath();
      tempGfx.moveTo(verts[0].x, verts[0].y);
      for (const v of verts) tempGfx.lineTo(v.x, v.y);
      tempGfx.closePath();
      tempGfx.fillPath();
    };

    drawSolidDiamond(TERRAIN_COLORS[TERRAIN_NORMAL]);
    tempGfx.generateTexture('tex_tile_base', TILE_W, TILE_H);

    tempGfx.destroy();
  }

  _generateTileShadowTexture() {
    const tempGfx = this.make.graphics({ x: 0, y: 0, add: false });
    // Rombo al 70% con alpha morbida — formula invariata
    const w2 = (TILE_W * 0.70) / 2;
    const h2 = (TILE_H * 0.70) / 2;
    tempGfx.fillStyle(0x000000, 0.30);
    tempGfx.beginPath();
    tempGfx.moveTo(TILE_W / 2, TILE_H / 2 - h2);
    tempGfx.lineTo(TILE_W / 2 + w2, TILE_H / 2);
    tempGfx.lineTo(TILE_W / 2, TILE_H / 2 + h2);
    tempGfx.lineTo(TILE_W / 2 - w2, TILE_H / 2);
    tempGfx.closePath();
    tempGfx.fillPath();
    tempGfx.generateTexture('tex_tile_shadow', TILE_W, TILE_H);
    tempGfx.destroy();
  }

  _buildIsoTexture(srcKey, step) {
    const isoKey = `${srcKey}-iso-${step}`;
    const src = this.textures.get(srcKey).getSourceImage();
    const S = src.width;
    // Canvas proporzionale alla sorgente per preservare tutta la risoluzione del PNG
    const TW = S * 2;
    const TH = S;

    if (!this.textures.exists(isoKey)) {
      const canvas = document.createElement('canvas');
      canvas.width = TW;
      canvas.height = TH;
      const ctx = canvas.getContext('2d');

      const a = TW / (2 * S);
      const b = TH / (2 * S);
      const c = -TW / (2 * S);
      const d = TH / (2 * S);

      ctx.setTransform(a, b, c, d, TW / 2, 0);

      // Applica la rotazione step*90° attorno al centro dell'immagine sorgente
      ctx.translate(S / 2, S / 2);
      ctx.rotate(step * Math.PI / 2);
      ctx.translate(-S / 2, -S / 2);

      ctx.drawImage(src, 0, 0);
      this.textures.addCanvas(isoKey, canvas);
    }
    return { key: isoKey, baseScale: TILE_W / TW };
  }

  _applyDecalStyle(decal, terrain) {
    if (terrain === TERRAIN_ICE) {
      decal.setTint(0xffffff);
      decal.setBlendMode(Phaser.BlendModes.NORMAL);
    } else {
      decal.setBlendMode(Phaser.BlendModes.NORMAL);
    }
  }




  _createResourceDecal(col, row, terrain) {
    const { x: cx, y: cy } = cartesianToIsometric(col, row);
    const baseDepth = row + col - GRID_SIZE * 4;

    const srcKey = terrain === TERRAIN_ICE ? 'decal-ice' : 'decal-regolith';
    const step = Phaser.Math.Between(0, 3);
    const size = Phaser.Math.FloatBetween(1.2, 2.4);
    const { key: isoKey, baseScale } = this._buildIsoTexture(srcKey, step);
    const decal = this.add.image(cx, cy, isoKey);
    const alpha = Phaser.Math.FloatBetween(0.5, 1);
    decal.setScale(size * baseScale);
    decal.setAlpha(alpha);
    decal.setDepth(baseDepth + 2);
    this._applyDecalStyle(decal, terrain);
    return decal;
  }

  _createSandDecal(col, row) {
    const { x: cx, y: cy } = cartesianToIsometric(col, row);
    const baseDepth = row + col - GRID_SIZE * 4;

    const step = Phaser.Math.Between(0, 3);
    const size = Phaser.Math.FloatBetween(2, 4);
    const { key: isoKey, baseScale } = this._buildIsoTexture('decal-sand', step);
    const decal = this.add.image(cx, cy, isoKey);
    decal.setScale(size * baseScale);
    decal.setAlpha(0.4);
    decal.setDepth(baseDepth + 2);

    const stepL = Phaser.Math.Between(0, 3);
    const sizeL = Phaser.Math.FloatBetween(1.5, 2);
    const { key: isoKeyL, baseScale: baseScaleL } = this._buildIsoTexture('decal-sand-light', stepL);
    const decalL = this.add.image(cx, cy, isoKeyL);
    decalL.setScale(sizeL * baseScaleL);
    decalL.setAlpha(0.9);
    decalL.setDepth(baseDepth + 2);
  }

  _spawnRocks() {
    const files = this.cache.json.get('rocks-manifest');
    if (!files?.length) return;
    const count = files.length;

    // BFS distance field dai tile di regolith
    const dist = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(Infinity));
    const queue = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.terrainGrid[r][c] === TERRAIN_REGOLITH) {
          dist[r][c] = 0;
          queue.push([r, c]);
        }
      }
    }
    let qi = 0;
    while (qi < queue.length) {
      const [r, c] = queue[qi++];
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && dist[nr][nc] === Infinity) {
          dist[nr][nc] = dist[r][c] + 1;
          queue.push([nr, nc]);
        }
      }
    }

    const spawnLayer = (decay, scaleMin, scaleMax, depth, mul = 1) => {
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          const d = dist[row][col];
          const prob = Math.exp(-d * decay);
          if (Math.random() > prob) continue;

          const { x: cx, y: cy } = cartesianToIsometric(col, row);
          const baseDepth = row + col - GRID_SIZE * 4;
          const extra = Math.round((d === 0 ? Phaser.Math.Between(5, 9)
            : d <= 2 ? Phaser.Math.Between(2, 5)
              : 1) * mul);
          for (let k = 0; k < extra; k++) {
            const idx = Phaser.Math.Between(0, count - 1);
            const rock = this.add.image(
              cx + Phaser.Math.FloatBetween(-TILE_W / 3, TILE_W / 3),
              cy + Phaser.Math.FloatBetween(-TILE_H / 3, TILE_H / 3),
              `rock-${idx}`
            );
            const targetW = Phaser.Math.FloatBetween(scaleMin, scaleMax);
            rock.setDisplaySize(targetW, targetW * rock.height / rock.width);
            rock.setDepth(baseDepth + depth);
            // Link to tile and visibility via Fog of War
            rock.col = col;
            rock.row = row;
            rock.setVisible(this.exploredTiles[rock.row][rock.col]);
            this.terrainProps.push(rock);
          }
        }
      }
    };

    spawnLayer(0.35, TILE_W * 0.08, TILE_W * 0.15, 2);        // layer principale
    spawnLayer(0.01, TILE_W * 0.04, TILE_W * 0.05, 3.5, 6);   // layer fine, molto denso
  }

  _spawnCraters() {
    // BFS distance field dai tile di ice
    const dist = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(Infinity));
    const queue = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.terrainGrid[r][c] === TERRAIN_ICE) {
          dist[r][c] = 0;
          queue.push([r, c]);
        }
      }
    }
    let qi = 0;
    while (qi < queue.length) {
      const [r, c] = queue[qi++];
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && dist[nr][nc] === Infinity) {
          dist[nr][nc] = dist[r][c] + 1;
          queue.push([nr, nc]);
        }
      }
    }

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const d = dist[row][col];
        const prob = Math.exp(-d * 0.3);
        if (Math.random() > prob) continue;

        const { x: cx, y: cy } = cartesianToIsometric(col, row);
        const baseDepth = row + col - GRID_SIZE * 4;
        const count = d === 0 ? Phaser.Math.Between(2, 4) : d <= 2 ? Phaser.Math.Between(1, 2) : 1;
        for (let k = 0; k < count; k++) {
        const crater = this.add.image(
          cx + Phaser.Math.FloatBetween(-TILE_W / 2, TILE_W / 2),
          cy + Phaser.Math.FloatBetween(-TILE_H / 2, TILE_H / 2),
          'crater'
        );
        const targetW = Phaser.Math.FloatBetween(TILE_W * 0.05, TILE_W * 0.3);
        crater.setDisplaySize(targetW, targetW * crater.height / crater.width);
        crater.setDepth(baseDepth + 1);
        // Link to tile and visibility via Fog of War
        crater.col = col;
        crater.row = row;
        crater.setVisible(this.exploredTiles[crater.row][crater.col]);
        this.terrainProps.push(crater);
        }
      }
    }
  }

  _drawNaturalTerrainElements() {
    // Presumiamo che this.fowMask sia già stato creato e configurato altrove.

    // 1. Ostacoli singoli (Creste) - GRAFICA
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (this.terrainGrid[row][col] !== 'ridge') continue;

        const { x: cx, y: cy } = cartesianToIsometric(col, row);
        const sprite = this.add.image(cx, cy, 'ridge');
        sprite.setDisplaySize(TILE_W * 1.1, TILE_W * 1.1 * (sprite.height / sprite.width));
        // Depth isometrico per la cresta
        sprite.setDepth(cy - cx * 0.001);
        // Rimuoviamo mask FoW per prestazioni, gestiamo visibilità manuale
        // sprite.setMask(this.fowMask);
        
        // Agganciamento visibilità in base a Fog of War
        sprite.col = col;
        sprite.row = row;
        sprite.setVisible(this.exploredTiles[row][col]);
        
        this.terrainProps.push(sprite);
      }
    }

    // 1b. Nomi delle Creste e dei Bacini di Regolite (Uniformati)
    if (this.depositGroups) {
      for (const group of this.depositGroups) {
        // Gestiamo sia creste che regolite
        if ((group.type === 'ridge' || group.type === TERRAIN_REGOLITH) && group.tiles.length > 0) {

          const firstTile = group.tiles[0];
          const name = this.terrainNamesGrid[firstTile.row][firstTile.col];

          // Se la zona non ha un nome assegnato, saltiamo
          if (!name) continue;

          let sumCol = 0, sumRow = 0;
          for (const t of group.tiles) {
            sumCol += t.col;
            sumRow += t.row;
          }
          const centerCol = sumCol / group.tiles.length;
          const centerRow = sumRow / group.tiles.length;

          const { x: cx, y: cy } = cartesianToIsometric(centerCol, centerRow);

          let nameUpperCase = name.toUpperCase();
          // Formattazione a capo per i prefissi lunari
          const prefixes = ['MONTES ', 'RUPES ', 'MARE ', 'OCEANUS ', 'LACUS ', 'SINUS '];
          prefixes.forEach(p => {
            if (nameUpperCase.startsWith(p)) nameUpperCase = nameUpperCase.replace(p, p.trim() + '\n');
          });

          const trackedName = nameUpperCase.split('\n').map(line => line.split('').join(' ')).join('\n\n');

          // 1. Creiamo il testo centrato su 0,0 (non lo posizioniamo ancora sulla mappa)
          const label = this.add.text(0, 0, trackedName, {
            fontFamily: '"Space Mono", monospace',
            fontSize: '26px',
            fontWeight: 'normal',
            color: '#ffffff',
            align: 'center',
            resolution: 2
          }).setOrigin(0.5).setAlpha(1);

          // 2. Ruotiamo il testo piatto di 45 o -45 gradi
          // Questo allinea il testo alle diagonali perfette prima della compressione
          const tiltDirection = -45;
          label.setAngle(tiltDirection);

          // 3. Inseriamo il testo in un Container posizionato alle coordinate corrette
          const container = this.add.container(cx, cy - 10, [label]);
          // === AGGIUNTA: Gestione visibilità ===
          container.col = Math.floor(centerCol);
          container.row = Math.floor(centerRow);
          container.setVisible(this.exploredTiles[container.row][container.col]);
          this.terrainProps.push(container);

          // 4. Scaliamo il Container!
          // Moltiplicando la scala Y per 0.5 su un oggetto ruotato di 45°, 
          // Phaser applica automaticamente lo skew isometrico perfetto 2:1.
          const baseScale = 0.25;
          container.setScale(baseScale, baseScale * 0.5);

          // 5. Calcolo profondità per lo z-sorting (applicato al Container)
          let maxFrontalDepth = -10000;
          for (const t of group.tiles) {
            const { y: tileY, x: tileX } = cartesianToIsometric(t.col, t.row);
            const tileDepth = tileY - tileX * 0.001;
            if (tileDepth > maxFrontalDepth) maxFrontalDepth = tileDepth;
          }

          container.setDepth(maxFrontalDepth + 10);
        }
      }
    }

    // 2. Crateri Quadrati (Usa crater-big)
    if (this.squareCraters) {
      for (const cr of this.squareCraters) {
        const centerCol = cr.col + (cr.size - 1) / 2;
        const centerRow = cr.row + (cr.size - 1) / 2;
        const { x, y } = cartesianToIsometric(centerCol, centerRow);

        const sprite = this.add.image(x, y, 'crater-big');
        sprite.displayWidth = cr.size * TILE_W;
        sprite.displayHeight = cr.size * TILE_H;

        const frontRow = cr.row + cr.size - 1;
        const frontCol = cr.col + cr.size - 1;
        const baseDepth = frontRow + frontCol - GRID_SIZE * 4;

        sprite.setDepth(baseDepth + 2);
        sprite.setAlpha(0.9);
        sprite.setTint(0xcccccc);

        // --- AGGIUNTA FOW: Maschera lo sprite del cratere ---
        sprite.setMask(this.fowMask);
        // ----------------------------------------------------

        this.terrainProps.push(sprite);

        // Nome del cratere
        const nameUpperCase = cr.name.toUpperCase().replace(' CRATER', '\nCRATER');
        const trackedCraterName = nameUpperCase.split('\n').map(line => line.split('').join(' ')).join('\n\n');

        // 1. Creiamo il testo centrato su 0,0 
        const textLabel = this.add.text(0, 0, trackedCraterName, {
          fontFamily: '"Space Mono", monospace',
          fontSize: '26px',
          fontWeight: 'normal',
          color: '#ffffff',
          align: 'center',
          resolution: 2
        }).setOrigin(0.5).setAlpha(1);

        // 2. Angolo deterministico per allineare il testo alla griglia prima di schiacciarlo
        const tiltDirection = -45;
        textLabel.setAngle(tiltDirection);

        // 3. Inseriamo il testo nel Container posizionato sopra il cratere
        const container = this.add.container(x, y - 10, [textLabel]);
        // === AGGIUNTA: Gestione visibilità ===
        container.col = Math.floor(centerCol);
        container.row = Math.floor(centerRow);
        container.setVisible(this.exploredTiles[container.row][container.col]);
        this.terrainProps.push(container);

        // 4. Schiacciamento verticale del 50% sul container per creare lo skew isometrico perfetto
        const baseScale = 0.25;
        container.setScale(baseScale, baseScale * 0.5);

        // 5. Z-sorting (Maschera FoW rimosso per performance) e visibilità gestita via setVisible
        container.setDepth(sprite.depth + 0.1);
        // ---------------------------------------------------------------
      }
    }

    this._resolveTerrainLabelOverlaps();
  }

  _resolveTerrainLabelOverlaps() {
    const labels = this.terrainProps.filter(p => p.col !== undefined && p.row !== undefined && p.list?.length > 0);

    // Raggio approssimato di ogni label in screen-space dopo rotazione -45° e scala del container
    const radii = labels.map(container => {
      const text = container.list[0];
      if (!text) return 30;
      const side = (text.width + text.height) / Math.SQRT2;
      return Math.max(side * container.scaleX * 0.5, 20);
    });

    const MAX_ITER = 60;
    for (let iter = 0; iter < MAX_ITER; iter++) {
      let moved = false;
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i], b = labels[j];
          const minDist = radii[i] + radii[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (dist < minDist) {
            const push = (minDist - dist) / 2;
            const nx = dx / dist, ny = dy / dist;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
  }

  _drawGridIntersections() {
    if (!this.gridOverlay) return;
    this.gridOverlay.clear();

    // Stile della linea della griglia
    this.gridOverlay.lineStyle(0.5, 0xd0d6de, 1);

    const armLength = 3;
    const isoDirX = { x: TILE_W / 2, y: TILE_H / 2 };
    const isoDirY = { x: -TILE_W / 2, y: TILE_H / 2 };
    const lenX = Math.hypot(isoDirX.x, isoDirX.y);
    const lenY = Math.hypot(isoDirY.x, isoDirY.y);
    const dirX = { x: isoDirX.x / lenX, y: isoDirX.y / lenX };
    const dirY = { x: isoDirY.x / lenY, y: isoDirY.y / lenY };

    // Ciclo su tutte le intersezioni dei vertici
    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {

        // --- INIZIO MODIFICA: Nascondi la griglia sotto gli ostacoli ---
        // L'intersezione ai punti (col, row) è il vertice che tocca 4 caselle.
        // Controlliamo se una qualsiasi di queste 4 caselle è un ostacolo.
        let touchesImpassable = false;

        for (const [dc, dr] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
          const c = col + dc;
          const r = row + dr;
          // Assicuriamoci di non cercare fuori dalla mappa
          if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
            const terrain = this.terrainGrid[r][c];
            if (terrain === 'crater' || terrain === 'ridge') {
              touchesImpassable = true;
              break; // Basta una casella per nascondere l'incrocio
            }
          }
        }

        // Se l'incrocio tocca un cratere o una cresta, NON disegnarlo!
        if (touchesImpassable) continue;
        // --- FINE MODIFICA ---

        // Disegno effettivo delle crocette
        const { x, y } = cartesianToIsometric(col, row);
        const vx = x;
        const vy = y - TILE_H / 2;

        this.gridOverlay.lineBetween(
          vx - dirX.x * armLength, vy - dirX.y * armLength,
          vx + dirX.x * armLength, vy + dirX.y * armLength
        );
        this.gridOverlay.lineBetween(
          vx - dirY.x * armLength, vy - dirY.y * armLength,
          vx + dirY.x * armLength, vy + dirY.y * armLength
        );
      }
    }
  }

  _drawGrid() {
    for (let row = 0; row < GRID_SIZE; row++) {
      this.tileGraphics[row] = [];
      this.tileShadowGraphics[row] = [];
      this.tileResourceGraphics[row] = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        const { x: cx, y: cy } = cartesianToIsometric(col, row);
        const baseDepth = row + col - GRID_SIZE * 4;

        // Base: grigio luna per tutte le caselle
        const img = this.add.image(cx, cy, 'tex_tile_base');
        img.setDepth(baseDepth);
        this.tileGraphics[row][col] = img;

        // Decal sabbia su tutti i tile (base universale)
        const terrain = this.terrainGrid[row][col];
        this._createSandDecal(col, row);

        // Layer risorsa: decal randomizzato per ice e regolith
        const isRes = terrain === TERRAIN_ICE || terrain === TERRAIN_REGOLITH;
        this.tileResourceGraphics[row][col] = isRes
          ? this._createResourceDecal(col, row, terrain)
          : null;

        const shadow = this.add.image(cx, cy, 'tex_tile_shadow');
        shadow.setDepth(-0.5);
        shadow.setVisible(false);
        this.tileShadowGraphics[row][col] = shadow;
      }
    }
  }

  _setTileShadow(col, row, isShadowed) {
    // shadows disabled
  }

  // ===========================================================================
  // FOG OF WAR
  // ===========================================================================

  _drawFogOfWar() {
    this.fogEdgeMasks = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    for (let row = 0; row < GRID_SIZE; row++) {
      this.fogGraphics[row] = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        const { x: cx, y: cy } = cartesianToIsometric(col, row);
        const w2 = TILE_W / 2;
        const h2 = TILE_H / 2;
        const fogGfx = this.add.graphics();
        fogGfx.setPosition(cx, cy);

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

        fogGfx.setDepth(cy - cx * 0.001 + 0.1); // Appena sopra il pavimento (depth isometrico)
        this.fogGraphics[row][col] = fogGfx;
      }
    }
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        this._refreshFogEdgeAt(row, col);
      }
    }
  }

  _refreshFogEdgeAt(row, col) {
    // 1. Pulizia precedente
    if (this.fogEdgeMasks[row][col]) {
      this.fogEdgeMasks[row][col].destroy();
      this.fogEdgeMasks[row][col] = null;
    }

    if (this.exploredTiles[row][col]) return;

    const touchesExplored = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => {
      const nr = row + dr, nc = col + dc;
      return nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && this.exploredTiles[nr][nc];
    });

    if (!touchesExplored) return;

    const { x: cx, y: cy } = cartesianToIsometric(col, row);

    // Usa 'decal-fog' e uno step random per non avere bordi tutti uguali
    const step = Phaser.Math.Between(0, 3);
    const { key: isoKey, baseScale } = this._buildIsoTexture('decal-fog', step);

    const eraser = this.add.image(cx, cy, isoKey);

    // --- MODIFICA QUI ---
    // Invece di 2 * baseScale, usiamo un valore che puoi controllare
    // Se vuoi che sia più piccola, usa 0.5 o 0.8. Se vuoi che sia grande, usa 1.5 o 2.
    const sizeVariation = Phaser.Math.FloatBetween(1.4, 1.6);
    eraser.setScale(baseScale * sizeVariation);

    // Applichiamo ERASE
    eraser.setBlendMode(Phaser.BlendModes.ERASE);

    // Un'alpha più bassa (es. 0.5) renderà il "buco" nella nebbia semitrasparente
    // Un'alpha alta (0.9) renderà il buco quasi totalmente trasparente
    eraser.setAlpha(1);

    // Depth is isometric-based to align erasers with FoW under terrain
    const fogDepth = cy - cx * 0.001;
    eraser.setDepth(fogDepth + 0.2);

    this.fogEdgeMasks[row][col] = eraser;
  }


  _drawMapBorder() {
    this.mapBorderGraphics = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    this.mapEdgeMasks = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

    const w2 = TILE_W / 2;
    const h2 = TILE_H / 2;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const isEdge = row === 0 || row === GRID_SIZE - 1 || col === 0 || col === GRID_SIZE - 1;
        if (!isEdge) continue;

        const vCol = col === 0 ? col - 1 : col === GRID_SIZE - 1 ? col + 1 : col;
        const vRow = row === 0 ? row - 1 : row === GRID_SIZE - 1 ? row + 1 : row;
        const { x: cx, y: cy } = cartesianToIsometric(vCol, vRow);
        const borderDepth = cy - cx * 0.001;

        const gfx = this.add.graphics();
        gfx.setPosition(cx, cy);
        gfx.fillStyle(0x000000, 1);
        gfx.beginPath();
        gfx.moveTo(0, -h2);
        gfx.lineTo(w2, 0);
        gfx.lineTo(0, h2);
        gfx.lineTo(-w2, 0);
        gfx.closePath();
        gfx.fillPath();
        gfx.setDepth(borderDepth);
        this.mapBorderGraphics[row][col] = gfx;

        const step = Phaser.Math.Between(0, 3);
        const { key: isoKey, baseScale } = this._buildIsoTexture('decal-fog', step);
        const eraser = this.add.image(cx, cy, isoKey);
        eraser.setScale(baseScale * Phaser.Math.FloatBetween(1.4, 1.6));
        eraser.setBlendMode(Phaser.BlendModes.ERASE);
        eraser.setAlpha(1);
        // Depth aligned with isometric terrain + small offset
        const erDepth = cy - cx * 0.001;
        eraser.setDepth(erDepth + 0.2);
        this.mapEdgeMasks[row][col] = eraser;
      }
    }
  }

  _deriveDepositGroupsFromTerrain() {
    const visited = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    const groups = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const type = this.terrainGrid[r][c];
        if (type === TERRAIN_NORMAL || visited[r][c]) continue;
        const tiles = [], queue = [{ row: r, col: c }];
        visited[r][c] = true;
        while (queue.length) {
          const { row, col } = queue.shift();
          tiles.push({ row, col });
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = row + dr, nc = col + dc;
            if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
            if (visited[nr][nc] || this.terrainGrid[nr][nc] !== type) continue;
            visited[nr][nc] = true;
            queue.push({ row: nr, col: nc });
          }
        }
        groups.push({ type, tiles });
      }
    }
    this.depositGroups = groups;
  }

  /** [DEV] Rivela tutta la mappa istantaneamente. Rimuovere prima del rilascio. */
  _revealAllMap() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        // 1. Segna come esplorato
        this.exploredTiles[r][c] = true;

        // 2. Rimuovi la nebbia solida (Graphics)
        if (this.fogGraphics[r]?.[c]) {
          this.fogGraphics[r][c].destroy();
          this.fogGraphics[r][c] = null;
        }

        // 3. Rimuovi le maschere/decalcomanie (gli sprite Erase)
        if (this.fogEdgeMasks[r]?.[c]) {
          this.fogEdgeMasks[r][c].destroy();
          this.fogEdgeMasks[r][c] = null;
        }
      }
    }

    // 4. Rendi visibili tutti i terrainProps (nomi crateri, montagne, rocce…)
    for (const prop of this.terrainProps) {
      prop.setVisible(true);
    }

    // 5. Rendi visibili tutti i POI (supply drop, relitti…)
    for (const poi of this.pois) {
      poi.sprite.setVisible(true);
    }
  }


  _revealFog(centerCol, centerRow, radius) {
    const revealed = [];
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const r = centerRow + dr;
        const c = centerCol + dc;
        if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
        if (this.exploredTiles[r][c]) continue;
        this.exploredTiles[r][c] = true;
        this.fogGraphics[r]?.[c]?.clear();
        revealed.push([r, c]);
        // Se è un tile di un cratere, rivela l'intero cratere
        if (this.terrainGrid[r]?.[c] === 'crater') {
          const crater = this.squareCraters.find(cr =>
            r >= cr.row && r < cr.row + cr.size &&
            c >= cr.col && c < cr.col + cr.size
          );
          if (crater) {
            for (let cr2 = crater.row; cr2 < crater.row + crater.size; cr2++) {
              for (let cc2 = crater.col; cc2 < crater.col + crater.size; cc2++) {
                if (!this.exploredTiles[cr2][cc2]) {
                  this.exploredTiles[cr2][cc2] = true;
                  this.fogGraphics[cr2]?.[cc2]?.clear();
                  revealed.push([cr2, cc2]);
                }
              }
            }
          }
        }
      }
    }
    // Rivela props e POI per tutti i tile scoperti (incluse espansioni cratere)
    for (const [r, c] of revealed) {
      for (const prop of this.terrainProps) {
        if (prop.col === c && prop.row === r) prop.setVisible(true);
      }
      for (const poi of this.pois) {
        if (poi.col === c && poi.row === r) poi.sprite.setVisible(true);
      }
    }
    // Aggiorna bordi: tile rivelati + 2 anelli (serve per dist-2 alpha)
    const toRefresh = new Set();
    for (const [r, c] of revealed) {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
            toRefresh.add(`${nr},${nc}`);
          }
        }
      }
    }
    for (const key of toRefresh) {
      const [r, c] = key.split(',').map(Number);
      this._refreshFogEdgeAt(r, c);
    }
  }

  // ===========================================================================
  // Z-SORTING (formula invariata)
  // ===========================================================================

  _updateSpriteDepth(sprite) {
    sprite.setDepth(sprite.y - sprite.x * 0.001);
  }

  // ===========================================================================
  // LOGICA DI COSTRUZIONE
  // ===========================================================================

  // ===========================================================================
  // HELPER: EMIT RISORSE
  // ===========================================================================

  _emitResourcesUpdate() {
    this._emitter.emit('resources-updated', {
      regolith: this.economy.regolith,
      ice: this.economy.ice,
      oxygen: this.economy.oxygen,
      components: this.economy.components,
      energyProduced: this.economy.energyProduced,
      energyConsumed: this.economy.energyConsumed,
      energyRequired: this.economy.energyRequired,
      energyStored: this.economy.energyStored,
      maxEnergy: this.economy.maxEnergy,
      maxOxygen: this.economy.maxOxygen,
      crewTotal: this.economy.crewTotal,
      crewEmployed: this.economy.crewEmployed,
      deltaReg: this.economy.deltaReg,
      deltaIce: this.economy.deltaIce,
      deltaO2: this.economy.deltaO2,
      deltaComp: this.economy.deltaComp,
      deltaEnergy: this.economy.deltaEnergy,
    });
  }

  // ===========================================================================
  // VALIDAZIONE RETE + COSTRUTTORE
  // ===========================================================================

  /**
   * Verifica che targetCol/Row soddisfi ENTRAMBI i requisiti:
   *   1. Rete:        adiacente (Manhattan=1) a un edificio già esistente
   *   2. Costruttore: conduit → rover esattamente sopra; altri → rover fermo adiacente O Comando adiacente
   */
  /**
   * Verifica che targetCol/Row soddisfi le 3 regole SIMULTANEE:
   *   1. RETE:        adiacente (Manhattan=1) a un edificio esistente.
   *   2. COSTRUTTORE (RIGIDO):
   *        conduit → rover esattamente sulla tile target
   *        altri   → rover fermo a distanza Manhattan === 1 dalla tile target
   *                  (il Comando NON fa più da costruttore)
   *   3. TOPOLOGIA:   supera la simulazione dell'Antro-Muro (solo edifici solidi)
   */
  /**
   * Verifica che il condotto possa essere piazzato (rete + rover sulla tile).
   * Per i moduli distretto usare _tryPlaceModule().
   * Per i centri distretto usare _tryPlaceDistrict().
   */
  isTileValidForBuild(targetCol, targetRow, buildingType, selectedRover) {
    // ── REQUISITO 1: RETE ──────────────────────────────────────────────────
    const adjToNetwork = this.buildings.some(b =>
      Math.abs(b.col - targetCol) + Math.abs(b.row - targetRow) === 1
    );
    if (!adjToNetwork) return false;

    // ── REQUISITO 2: COSTRUTTORE (RAGGIO D'AZIONE) ────────────────────────
    if (!selectedRover) return false;
    if (!this._isWithinRoverRange(selectedRover, targetCol, targetRow)) return false;

    return true;
  }

  /**
   * Restituisce tutti gli oggetti Building che appartengono allo stesso cluster
   * connesso (8 direzioni) dell'edificio solido in (col, row).
   * Usa lo stesso flood fill di _checkClusterLimit ma raccoglie i riferimenti.
   *
   * @param {number} col
   * @param {number} row
   * @returns {Building[]}
   */
  _getClusterMembers(col, row) {
    const visited = new Set();
    const queue = [[col, row]];
    const key = (c, r) => `${c},${r}`;
    visited.add(key(col, row));

    const members = [];
    const self = this.buildings.find(b => b.col === col && b.row === row);
    if (self) members.push(self);

    const dirs = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1],
    ];

    while (queue.length > 0) {
      const [c, r] = queue.shift();
      for (const [dc, dr] of dirs) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= GRID_SIZE || nr < 0 || nr >= GRID_SIZE) continue;
        if (visited.has(key(nc, nr))) continue;
        if (!this.occupiedTiles[nr][nc]) continue;
        visited.add(key(nc, nr));
        const b = this.buildings.find(b => b.col === nc && b.row === nr);
        if (b) members.push(b);
        queue.push([nc, nr]);
      }
    }
    return members;
  }

  // ===========================================================================
  // SISTEMA DISTRETTI
  // ===========================================================================

  /**
   * Crea il distretto Comando iniziale senza costo e senza rover richiesto.
   * Usato solo al create() per il Modulo Comando di partenza.
   */
  _initCommandDistrict(centerCol, centerRow) {
    // Marca tutte e 9 le tile come territorio distretto
    const district = {
      id: 'district_0',
      type: 'command',
      centerCol,
      centerRow,
      mainBuilding: null, // assegnato dopo _placeBuildingGraphics
      slots: DISTRICT_SLOT_OFFSETS.map(({ dc, dr }) => ({
        col: centerCol + dc,
        row: centerRow + dr,
        module: null,
      })),
      connected: true,
    };

    // Registra ownership delle 9 tile
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = centerCol + dc;
        const r = centerRow + dr;
        if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
          this.districtGrid[r][c] = district;
        }
      }
    }

    this.occupiedTiles[centerRow][centerCol] = true;
    this._placeBuildingGraphics(centerCol, centerRow, 'conduit');
    this._placeBuildingGraphics(centerCol, centerRow, 'command');
    this._setTileShadow(centerCol, centerRow, true);

    district.mainBuilding = this.buildings[this.buildings.length - 1];
    district.mainBuilding.district = district;
    this.districts.push(district);
  }

  /**
   * Tenta di piazzare un nuovo distretto di tipo districtType centrato su
   * (centerCol, centerRow). Restituisce true se il piazzamento ha successo.
   *
   * Regole di validazione:
   *  1. Area 3×3 completamente libera (nessun occupiedTile, nessun districtGrid)
   *  2. Nessuna tile di un altro distretto ortogonalmente adiacente a una tile 3×3
   *  3. Terreno corretto per il tipo di distretto
   *  4. Risorse sufficienti per l'edificio centrale
   */
  _tryPlaceDistrict(centerBuildingType, centerCol, centerRow) {
    if (centerCol < 1 || centerCol >= GRID_SIZE - 1 ||
      centerRow < 1 || centerRow >= GRID_SIZE - 1) {
      console.warn('Distretto fuori mappa!'); return false;
    }
    if (!this.exploredTiles[centerRow][centerCol]) {
      console.warn('Tile inesplorata!'); return false;
    }

    const districtTypeDef = Object.values(DISTRICT_TYPES).find(
      dt => dt.centerBuilding === centerBuildingType
    );
    if (!districtTypeDef) { console.warn('Tipo distretto sconosciuto!'); return false; }
    const districtTypeKey = Object.keys(DISTRICT_TYPES).find(
      k => DISTRICT_TYPES[k].centerBuilding === centerBuildingType
    );

    // ── 1. Centro non su terreno impraticabile ────────────────────────────────
    const centerTerrain = this.terrainGrid[centerRow][centerCol];
    if (centerTerrain === 'crater' || centerTerrain === 'ridge') {
      console.warn('Centro su terreno impraticabile!'); return false;
    }

    // ── 2. Verifica spazio 3×3 libero (occupazione e distretto) ──────────────
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = centerCol + dc;
        const r = centerRow + dr;
        if (c < 0 || c >= GRID_SIZE || r < 0 || r >= GRID_SIZE) {
          console.warn('Area 3×3 fuori mappa!'); return false;
        }
        if (this.occupiedTiles[r][c]) {
          console.warn('Spazio non libero!'); return false;
        }
      }
    }

    // ── Gap da building di altri distretti (coerente con DISTRICT_MODULE_NEIGHBOR_GAP) ──
    if (this.buildings.some(b => b.district &&
      Math.max(Math.abs(b.col - centerCol), Math.abs(b.row - centerRow)) <= DISTRICT_MODULE_NEIGHBOR_GAP + 1
    )) {
      console.warn('Troppo vicino a un building di altro distretto!'); return false;
    }

    // ── 3. Verifica terreno ────────────────────────────────────────────────────
    const terrainReq = districtTypeDef.terrainReq;
    if (terrainReq) {
      const needed = terrainReq === 'borders_regolith' ? TERRAIN_REGOLITH : TERRAIN_ICE;
      let found = false;
      outer:
      for (let dr = -1; dr <= 1 && !found; dr++) {
        for (let dc = -1; dc <= 1 && !found; dc++) {
          if (dr === 0 && dc === 0) continue; // <-- AGGIUNGI QUESTA RIGA (ignora il centro)
          const c = centerCol + dc;
          const r = centerRow + dr;
          if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE &&
            this.terrainGrid[r][c] === needed) {
            found = true;
          }
        }
      }
      if (!found) { console.warn('Terreno non adatto!'); return false; }
    }

    // ── 4. Verifica raggio rover ──────────────────────────────────────────────
    if (!this.rovers.some(r => this._isWithinRoverRange(r, centerCol, centerRow))) {
      console.warn('Fuori dal raggio del rover!'); return false;
    }

    // ── 5. Verifica costo ─────────────────────────────────────────────────────
    const info = BUILDINGS_INFO[centerBuildingType];
    if (this.economy.regolith < (info.cost ?? 0)) { console.warn('Regolite insufficiente!'); return false; }
    if (this.economy.components < (info.costComponents ?? 0)) { console.warn('Componenti insufficienti!'); return false; }

    // ── ESECUZIONE ────────────────────────────────────────────────────────────
    const district = {
      id: `district_${this.districts.length}`,
      type: districtTypeKey,
      centerCol,
      centerRow,
      mainBuilding: null,
      slots: DISTRICT_SLOT_OFFSETS.map(({ dc, dr }) => ({
        col: centerCol + dc,
        row: centerRow + dr,
        module: null,
      })),
      connected: false,
    };

    // Registra ownership 3×3
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        this.districtGrid[centerRow + dr][centerCol + dc] = district;
      }
    }

    this.economy.regolith -= (info.cost ?? 0);
    this.economy.components -= (info.costComponents ?? 0);

    this.occupiedTiles[centerRow][centerCol] = true;
    this._lastHoverCol = null; this._lastHoverRow = null; this._lastHoverPath = null;
    // Conduit prima → renderizzato sotto l'edificio centrale
    this._placeBuildingGraphics(centerCol, centerRow, 'conduit');
    this._placeBuildingGraphics(centerCol, centerRow, centerBuildingType);
    this._setTileShadow(centerCol, centerRow, true);

    district.mainBuilding = this.buildings[this.buildings.length - 1];
    district.mainBuilding.district = district;

    // FASE 1: Animazione Costruzione Fluida (80 secondi)
    district.mainBuilding.isConstructing = true;
    district.mainBuilding.buildProgress = 0;
    district.mainBuilding.buildTween = this.tweens.add({
      targets: district.mainBuilding,
      buildProgress: 1,
      duration: 80000,
      onComplete: () => {
        district.mainBuilding.isConstructing = false;
        this._updateNetworkConnectivity();
        this.economy.updateProjections();
      }
    });

    this.districts.push(district);

    // Auto-connette il nuovo distretto alla rete tramite condotte
    this._autoConnectDistrict(district);

    this.sound.play('sfx-rover-action', { volume: 0.6 });
    this._updateNetworkConnectivity();
    this.economy.updateProjections();

    this.selectedBuilding = null;
    this.highlighter.clear();
    this._updateContextPanel();

    return true;
  }

  /**
   * BFS dal centro del distretto verso il nodo di rete più vicino
   * (centro di un altro distretto connesso OPPURE tile condotto connessa).
   * Posa condotti lungo il percorso; addebita 5 Reg × lunghezza percorso.
   *
   * Se non c'è abbastanza Regolite, posa comunque le condotte (costruzione "a debito")
   * e la connettività sarà aggiornata al prossimo tick quando le risorse tornano.
   */
  _autoConnectDistrict(district) {
    const startCol = district.centerCol;
    const startRow = district.centerRow;

    // Insieme di tile "già nella rete": centri distretto connessi + tile condotto connesse
    const isNetworkNode = (c, r) => {
      // Tile del distretto appena piazzato → non è un nodo (è l'origine)
      if (Math.abs(c - startCol) <= 1 && Math.abs(r - startRow) <= 1) return false;
      // Tile di un distretto GIÀ CONNESSO alla rete → nodo raggiungibile
      const existingDistrict = this.districtGrid[r]?.[c];
      if (existingDistrict && existingDistrict !== district && existingDistrict.connected) return true;
      // Condotto già piazzato
      const b = this.buildings.find(b2 => b2.col === c && b2.row === r && b2.type === 'conduit');
      return !!b;
    };

    // A* — costo 10 per mosse ortogonali, 14 per diagonali (≈ √2×10)
    // Euristica octile verso il nodo di rete più vicino guida la ricerca in linea retta
    const COST_ORTHO = 10;
    const COST_DIAG = 14;

    // Pre-trova il nodo di rete più vicino per l'euristica A*
    let hTargetC = -1, hTargetR = -1;
    {
      let best = Infinity;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (isNetworkNode(c, r)) {
            const dx = Math.abs(c - startCol), dy = Math.abs(r - startRow);
            const d = COST_ORTHO * Math.max(dx, dy) + (COST_DIAG - COST_ORTHO) * Math.min(dx, dy);
            if (d < best) { best = d; hTargetC = c; hTargetR = r; }
          }
        }
      }
    }
    const h = (c, r) => {
      if (hTargetC < 0) return 0;
      const dx = Math.abs(c - hTargetC), dy = Math.abs(r - hTargetR);
      return COST_ORTHO * Math.max(dx, dy) + (COST_DIAG - COST_ORTHO) * Math.min(dx, dy);
    };

    const costMap = new Map(); // key → costo g minimo raggiunto
    const parentMap = new Map();
    const key = (c, r) => `${c},${r}`;

    // Min-heap per Dijkstra: [cost, col, row]
    const heap = [];
    const heapPush = (cost, c, r) => {
      heap.push([cost, c, r]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
      }
    };
    const heapPop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        for (; ;) {
          const l = 2 * i + 1, r2 = 2 * i + 2;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r2 < heap.length && heap[r2][0] < heap[m][0]) m = r2;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };

    // Tile del distretto sorgente: costo 0, parent = centroDistretto
    const centerKey = key(startCol, startRow);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const bk = key(startCol + dc, startRow + dr);
        if (!costMap.has(bk)) {
          costMap.set(bk, 0);
          parentMap.set(bk, centerKey);
        }
      }
    }
    costMap.set(centerKey, 0);

    // Punti d'uscita: vicini ortogonali e diagonali di ogni tile del bordo 3×3
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const borderKey = key(startCol + dc, startRow + dr);
        for (const [ndc, ndr, moveCost] of [
          [1, 0, COST_ORTHO], [-1, 0, COST_ORTHO], [0, 1, COST_ORTHO], [0, -1, COST_ORTHO],
          [1, 1, COST_DIAG], [1, -1, COST_DIAG], [-1, 1, COST_DIAG], [-1, -1, COST_DIAG],
        ]) {
          const oc = startCol + dc + ndc;
          const or2 = startRow + dr + ndr;
          if (Math.abs(oc - startCol) <= 1 && Math.abs(or2 - startRow) <= 1) continue;
          if (oc < 0 || oc >= GRID_SIZE || or2 < 0 || or2 >= GRID_SIZE) continue;
          const _exitTerrain = this.terrainGrid[or2]?.[oc];
          if (_exitTerrain === 'crater' || _exitTerrain === 'ridge') continue;
          const ok = key(oc, or2);
          if (!costMap.has(ok) || costMap.get(ok) > moveCost) {
            costMap.set(ok, moveCost);
            parentMap.set(ok, borderKey);
            heapPush(moveCost + h(oc, or2), oc, or2);
          }
        }
      }
    }

    let foundKey = null;

    while (heap.length > 0) {
      const [f, c, r] = heapPop();
      const ck = key(c, r);
      const g = costMap.get(ck);
      if (g + h(c, r) < f) continue; // entry stale: costMap ha già un g migliore

      if (isNetworkNode(c, r)) { foundKey = ck; break; }

      for (const [ndc, ndr, moveCost] of [
        [1, 0, COST_ORTHO], [-1, 0, COST_ORTHO], [0, 1, COST_ORTHO], [0, -1, COST_ORTHO],
        [1, -1, COST_DIAG], [-1, 1, COST_DIAG], [1, 1, COST_DIAG], [-1, -1, COST_DIAG],
      ]) {
        const nc = c + ndc;
        const nr = r + ndr;
        if (nc < 0 || nc >= GRID_SIZE || nr < 0 || nr >= GRID_SIZE) continue;
        const nk = key(nc, nr);

        // Distretti altrui: connessi → nodo target; non connessi → ostacolo
        const otherDistrict = this.districtGrid[nr]?.[nc];
        if (otherDistrict && otherDistrict !== district) {
          if (isNetworkNode(nc, nr)) {
            const nc2 = g + moveCost;
            if (!costMap.has(nk) || costMap.get(nk) > nc2) {
              costMap.set(nk, nc2);
              parentMap.set(nk, ck);
              heapPush(nc2 + h(nc, nr), nc, nr);
            }
          }
          continue;
        }

        // Non attraversare crateri o creste
        const _t = this.terrainGrid[nr]?.[nc];
        if (_t === 'crater' || _t === 'ridge') continue;

        // Non attraversare edifici duri occupati (tranne condotti)
        if (this.occupiedTiles[nr][nc]) {
          const b = this.buildings.find(b2 => b2.col === nc && b2.row === nr && b2.type === 'conduit');
          if (!b) continue;
        }

        const newCost = g + moveCost;
        if (!costMap.has(nk) || costMap.get(nk) > newCost) {
          costMap.set(nk, newCost);
          parentMap.set(nk, ck);
          heapPush(newCost + h(nc, nr), nc, nr);
        }
      }
    }

    if (!foundKey) return; // Nessun nodo di rete raggiungibile (isola)

    // Ricostruisci percorso dal nodo trovato fino al confine del distretto
    const path = [];
    let cur = foundKey;
    while (cur && cur !== centerKey) {
      const [c, r] = cur.split(',').map(Number);
      // Includi solo tile fuori dalla 3×3 del distretto
      if (Math.abs(c - startCol) > 1 || Math.abs(r - startRow) > 1) {
        // Non aggiungere tile già occupate da edifici duri o tile di altri distretti
        if (!this.occupiedTiles[r][c] ||
          this.buildings.some(b => b.col === c && b.row === r && b.type === 'conduit')) {
          path.push([c, r]);
        }
      }
      cur = parentMap.get(cur);
    }

    if (path.length === 0) return;

    // Cattura l'exit point (ultimo tile del percorso BFS, lato sorgente) PRIMA
    // di aggiungere estensioni, altrimenti path[last] punterebbe al posto sbagliato.
    const [exitC, exitR] = path[path.length - 1];

    // Helper: cammina diagonalmente/ortogonalmente da (fromC, fromR) verso (toC, toR),
    // aggiungendo le tile non-occupate (esclusa quella di partenza).
    const extendPathTo = (fromC, fromR, toC, toR) => {
      let cc = fromC, cr = fromR;
      while (cc !== toC || cr !== toR) {
        const stepC = cc < toC ? 1 : cc > toC ? -1 : 0;
        const stepR = cr < toR ? 1 : cr > toR ? -1 : 0;
        cc += stepC;
        cr += stepR;
        const _et = this.terrainGrid[cr]?.[cc];
        if (_et === 'crater' || _et === 'ridge') break;
        if (!this.occupiedTiles[cr][cc]) path.push([cc, cr]);
      }
    };

    // Estendi verso il centro del distretto TARGET (es. Comando):
    // dalla foundKey verso il suo centro, così i condotti arrivano visivamente all'edificio.
    if (foundKey) {
      const [fCol, fRow] = foundKey.split(',').map(Number);
      const targetDistrict = this.districtGrid[fRow]?.[fCol];
      if (targetDistrict && targetDistrict !== district) {
        extendPathTo(fCol, fRow, targetDistrict.centerCol, targetDistrict.centerRow);
      }
    }

    // Estendi verso il centro del distretto SORGENTE (es. ISRU):
    // dall'exit point catturato prima → non influenzato dalle tile target aggiunte sopra.
    extendPathTo(exitC, exitR, startCol, startRow);

    // Addebito 5 Reg × numero di nuovi condotti
    const newConduits = path.filter(([c, r]) =>
      !this.buildings.some(b => b.col === c && b.row === r && b.type === 'conduit')
    );
    const cost = 5 * newConduits.length;
    this.economy.regolith = Math.max(0, this.economy.regolith - cost);
    // FASE 3: Floating Text Costi
    if (cost > 0) this._showFloatingText(startCol, startRow, `-${cost} REG`, false);

    // Memorizza il costo sostenuto per le condotte nel centro distretto per l'Undo
    district.mainBuilding.autoConnectCost = cost;

    // Posa condotti lungo il percorso
    for (const [c, r] of path) {
      if (this.buildings.some(b => b.col === c && b.row === r && b.type === 'conduit')) continue;
      this._placeBuildingGraphics(c, r, 'conduit');
      this._setTileShadow(c, r, true);

      // FASE 1: I condotti sono istantanei
      const conduit = this.buildings[this.buildings.length - 1];
      conduit.isConstructing = false;
    }

    // Aggiorna grafica condotti
    for (const [c, r] of path) {
      this._redrawConduitAt(c, r);
      this._updateAdjacentConduitsGraphics(c, r);
    }
  }

  /**
   * Restituisce il distretto a cui appartiene l'edificio in (col, row), o null.
   */
  _getDistrictForBuilding(col, row) {
    return this.districtGrid[row]?.[col] ?? null;
  }

  /**
   * Piazza un modulo nello slot slotIndex del distretto dato.
   * Gestisce validazione terreno, costo, grafica e aggiornamento economia.
   */
  _tryPlaceModule(district, slotIndex, moduleType) {
    if (district.mainBuilding.isConstructing) {
      console.warn('Impossibile piazzare moduli: centro distretto in costruzione.');
      return false;
    }
    const slot = district?.slots?.[slotIndex];
    if (!slot) return false;
    if (slot.module !== null) { console.warn('Slot già occupato!'); return false; }

    // -- Enforcement Limite Modulo per Distretto --
    const info = BUILDINGS_INFO[moduleType];
    if (!info) return false;

    const maxAllowed = info.maxPerDistrict || Infinity;
    const currentCount = district.slots.filter(s => s.module && s.module.type === moduleType).length;

    if (currentCount >= maxAllowed) {
      this._showFloatingText(slot.col, slot.row, "ERROR: DISTRICT CAPACITY REACHED", false);
      console.warn(`Limit reached: Maximum ${maxAllowed} ${moduleType} allowed per district.`);
      return false;
    }
    // --------------------------------------------

    const terrain = this.terrainGrid[slot.row]?.[slot.col];
    if (terrain === 'crater' || terrain === 'ridge') return false;
    if (moduleType === 'regolith_extractor' && terrain !== TERRAIN_REGOLITH) return false;
    if (moduleType === 'ice_extractor' && terrain !== TERRAIN_ICE) return false;

    // --- NUOVO CONTROLLO: Verifica che non ci sia un rover sulla tile ---
    if (this._isRoverOnTile(slot.col, slot.row)) {
      console.warn('Impossibile costruire: c\'è un rover sulla tile!');
      return false;
    }
    // --------------------------------------------------------------------

    const districtDef = DISTRICT_TYPES[district.type];
    if (!districtDef?.allowedModules.includes(moduleType)) {
      console.warn('Modulo non consentito per questo distretto!'); return false;
    }

    // Verifica costo
    if (this.economy.regolith < (info.cost ?? 0)) { console.warn('Regolite insufficiente!'); return false; }
    if (this.economy.components < (info.costComponents ?? 0)) { console.warn('Componenti insufficienti!'); return false; }

    // ── Adiacenza inter-distretto (raggio = DISTRICT_MODULE_NEIGHBOR_GAP) ─────
    let _adjBlocked = false;
    outer: for (let dr = -DISTRICT_MODULE_NEIGHBOR_GAP; dr <= DISTRICT_MODULE_NEIGHBOR_GAP; dr++) {
      for (let dc = -DISTRICT_MODULE_NEIGHBOR_GAP; dc <= DISTRICT_MODULE_NEIGHBOR_GAP; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nc = slot.col + dc; const nr = slot.row + dr;
        if (nc < 0 || nc >= GRID_SIZE || nr < 0 || nr >= GRID_SIZE) continue;
        if (this.buildings.some(b => b.col === nc && b.row === nr && b.district && b.district !== district)) {
          _adjBlocked = true; break outer;
        }
      }
    }
    if (_adjBlocked) { console.warn('Modulo adiacente a un altro distretto!'); return false; }

    // Esecuzione
    this.economy.regolith -= (info.cost ?? 0);
    this.economy.components -= (info.costComponents ?? 0);

    // --- AGGIUNTA: Pulizia del condotto esistente per evitare duplicati ---
    const existingConduitIdx = this.buildings.findIndex(b => b.col === slot.col && b.row === slot.row && b.type === 'conduit');
    if (existingConduitIdx >= 0) {
      const existingConduit = this.buildings[existingConduitIdx];
      if (existingConduit._armSprites) {
        Object.values(existingConduit._armSprites).forEach(s => s?.destroy());
        Object.values(existingConduit._armShadows ?? {}).forEach(s => s?.destroy());
      }
      existingConduit.gfx.destroy();
      existingConduit._shadow?.destroy();
      this.buildings.splice(existingConduitIdx, 1);
    }

    this.occupiedTiles[slot.row][slot.col] = true;
    this._lastHoverCol = null; this._lastHoverRow = null; this._lastHoverPath = null;
    // Conduit prima → renderizzato sotto il modulo
    this._placeBuildingGraphics(slot.col, slot.row, 'conduit');
    this._placeBuildingGraphics(slot.col, slot.row, moduleType);
    this._setTileShadow(slot.col, slot.row, true);

    const placed = this.buildings[this.buildings.length - 1];
    placed.district = district;
    slot.module = placed;

    // FASE 1: Animazione Costruzione Fluida (40 secondi)
    placed.isConstructing = true;
    placed.buildProgress = 0;
    placed.buildTween = this.tweens.add({
      targets: placed,
      buildProgress: 1,
      duration: 40000,
      onComplete: () => {
        placed.isConstructing = false;
        this._updateNetworkConnectivity();
        this.economy.updateProjections();
      }
    });

    this.sound.play('sfx-rover-action', { volume: 0.6 });
    this._updateAdjacentConduitsGraphics(slot.col, slot.row);
    this._updateNetworkConnectivity();
    this.economy.updateProjections();
    this._updateContextPanel();

    return true;
  }

  /**
   * Rimuove il modulo dallo slot slotIndex del distretto dato.
   */
  _removeModule(district, slotIndex) {
    const slot = district?.slots?.[slotIndex];
    if (!slot || slot.module === null) return;
    this._demolishBuilding(slot.module);
    slot.module = null;
    this._updateContextPanel();
  }

  /**
   * Restituisce tutti i moduli attivi (non null) di un distretto.
   * Usato da EconomyManager in sostituzione di _getClusterMembers (Fase G).
   */
  _getDistrictModules(district) {
    if (!district) return [];
    return district.slots
      .filter(s => s.module !== null)
      .map(s => s.module);
  }

  /**
   * Ricostruisce this.districts e this.districtGrid dopo un load.
   * Scorre i buildings salvati, trova i centri distretto e crea gli oggetti distretto.
   * I moduli negli slot vengono ricollegati cercando building nelle tile slot.
   */
  _reconstructDistricts() {
    this.districts.length = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        this.districtGrid[r][c] = null;
      }
    }

    // Trova tutti i centri distretto tra gli edifici caricati
    for (const b of this.buildings) {
      const info = BUILDINGS_INFO[b.type];
      if (!info?.isDistrictCenter) continue;

      const typeKey = Object.keys(DISTRICT_TYPES).find(
        k => DISTRICT_TYPES[k].centerBuilding === b.type
      );
      if (!typeKey) continue;

      const district = {
        id: `district_${this.districts.length}`,
        type: typeKey,
        centerCol: b.col,
        centerRow: b.row,
        mainBuilding: b,
        slots: DISTRICT_SLOT_OFFSETS.map(({ dc, dr }) => ({
          col: b.col + dc,
          row: b.row + dr,
          module: null,
        })),
        connected: b.connected === true,
      };

      b.district = district;

      // Registra ownership 3×3
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const c2 = b.col + dc;
          const r2 = b.row + dr;
          if (c2 >= 0 && c2 < GRID_SIZE && r2 >= 0 && r2 < GRID_SIZE) {
            this.districtGrid[r2][c2] = district;
          }
        }
      }

      // Collega i moduli esistenti agli slot
      for (const slot of district.slots) {
        const mod = this.buildings.find(mb => mb.col === slot.col && mb.row === slot.row && mb !== b && mb.type !== 'conduit');
        if (mod) {
          slot.module = mod;
          mod.district = district;
        }
      }

      this.districts.push(district);
    }
  }

  // ===========================================================================
  // CONDUIT AUTO-TILING
  // ===========================================================================

  /**
   * Ritorna quali 4 direzioni ortogonali hanno un edificio (qualsiasi tipo).
   * right  = col+1   left  = col-1
   * bottom = row+1   top   = row-1
   */
  _getConduitConnections(col, row) {
    const has = (c, r) => this.buildings.some(b => b.col === c && b.row === r);
    return {
      right: has(col + 1, row),
      left: has(col - 1, row),
      bottom: has(col, row + 1),
      top: has(col, row - 1),
      // Diagonali — appaiono orizzontali/verticali sullo schermo isometrico
      diagTR: has(col + 1, row - 1),  // schermo: →
      diagBL: has(col - 1, row + 1),  // schermo: ←
      diagBR: has(col + 1, row + 1),  // schermo: ↓
      diagTL: has(col - 1, row - 1),  // schermo: ↑
    };
  }

  /**
   * Ridisegna la grafica di un singolo condotto ricalcolando le sue connessioni.
   */
  _redrawConduitAt(col, row) {
    const b = this.buildings.find(b2 => b2.col === col && b2.row === row && b2.type === 'conduit');
    if (!b) return;

    if (b._armSprites) {
      Object.values(b._armSprites).forEach(s => s?.destroy());
      Object.values(b._armShadows ?? {}).forEach(s => s?.destroy());
    }
    b._armSprites = {};
    b._armShadows = {};

    const connections = this._getConduitConnections(col, row);
    const DIR_MAP = {
      diagTL: 'N', top: 'NE', diagTR: 'E', right: 'SE',
      diagBR: 'S', bottom: 'SW', diagBL: 'W', left: 'NW',
    };

    for (const [connKey, screenDir] of Object.entries(DIR_MAP)) {
      if (!connections[connKey]) continue;
      const key = `conduit-${screenDir}`;
      const arm = this.add.image(b.gfx.x, b.gfx.y, key);
      arm.setOrigin(0.5, 1);
      arm.displayWidth = TILE_W;
      arm.scaleY = arm.scaleX;
      arm.setDepth(b.gfx.depth);
      b._armSprites[screenDir] = arm;
      // Salviamo l'ombra in una variabile temporanea per poterne sovrascrivere la profondità
      const shadow = this._createSpriteShadow(key, arm.x, arm.y, arm.displayWidth);
      shadow.setDepth(arm.depth - 0.1); // <-- Forza l'ombra un millimetro sotto il tubo
      b._armShadows[screenDir] = shadow;
    }
  }

  /**
   * BFS dal Comando: marca b.connected = true/false su ogni edificio.
   * Edifici disconnessi → alpha 0.3 e saltati da EconomyManager.
   */
  _updateNetworkConnectivity() {
    const centerCol = Math.floor(GRID_SIZE / 2);
    const centerRow = Math.floor(GRID_SIZE / 2);

    const connected = new Set();
    const visited = new Set();
    const queue = [`${centerCol},${centerRow}`];

    while (queue.length > 0) {
      const key = queue.shift();
      if (visited.has(key)) continue;
      visited.add(key);

      const [col, row] = key.split(',').map(Number);
      const bs = this.buildings.filter(b2 => b2.col === col && b2.row === row);
      if (bs.length === 0) continue;

      for (const b of bs) connected.add(b);

      // Un condotto danneggiato non propaga la rete oltre se stesso
      if (bs.some(b => b.type === 'conduit' && b.isDamaged)) continue;

      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1], [1, 1], [-1, -1]]) {
        const nk = `${col + dc},${row + dr}`;
        if (!visited.has(nk)) queue.push(nk);
      }
    }

    for (const b of this.buildings) {
      const wasConn = b.connected;
      b.connected = connected.has(b);
      // Se il flag connettività è cambiato, invalida la cache visiva
      // così _applyBuildingVisuals() forzerà il re-render al prossimo frame
      if (wasConn !== b.connected) b._lastVisualState = null;
    }

    // Propaga connected al distretto: il distretto è connesso se il suo mainBuilding lo è
    for (const d of this.districts) {
      d.connected = d.mainBuilding?.connected === true;
    }
  }

  /**
   * Dopo ogni piazzamento/demolizione, aggiorna i condotti nelle 8 tile adiacenti.
   */
  _updateAdjacentConduitsGraphics(col, row) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1], [1, 1], [-1, -1]]) {
      this._redrawConduitAt(col + dc, row + dr);
    }
  }

  /**
   * Disegna il condotto con auto-tiling su un oggetto Graphics esistente.
   * Usa coordinate assolute del mondo (x, y = cartesianToIsometric output).
   *
   * Connessioni ortogonali (45° sullo schermo):
   *   right  (col+1)       left   (col-1)
   *   bottom (row+1)       top    (row-1)
   * Connessioni diagonali (orizzontali/verticali sullo schermo):
   *   diagTR (col+1,row-1) → →    diagBL (col-1,row+1) → ←
   *   diagBR (col+1,row+1) → ↓    diagTL (col-1,row-1) → ↑
   */
  _drawConduitAutoTile(gfx, x, y, connections) {
    gfx.clear();

    const w2 = TILE_W / 2;  // 32
    const h2 = TILE_H / 2;  // 16

    // Endpoint = punto medio tra il centro di questa tile e quello della tile adiacente.
    // Ortogonali: distanza schermo = (w2, h2) → endpoint a (w2/2, h2/2)
    // Diagonali:  distanza schermo = (w2*2, 0) oppure (0, h2*2) → endpoint a (w2, 0) / (0, h2)
    const ex = {
      right: { tx: x + w2 / 2, ty: y + h2 / 2 },
      left: { tx: x - w2 / 2, ty: y - h2 / 2 },
      bottom: { tx: x - w2 / 2, ty: y + h2 / 2 },
      top: { tx: x + w2 / 2, ty: y - h2 / 2 },
      diagTR: { tx: x + w2, ty: y },  // orizzontale →
      diagBL: { tx: x - w2, ty: y },  // orizzontale ←
      diagBR: { tx: x, ty: y + h2 },  // verticale   ↓
      diagTL: { tx: x, ty: y - h2 },  // verticale   ↑
    };

    const drawArms = (lw, color, alpha) => {
      gfx.lineStyle(lw, color, alpha ?? 1);
      for (const [dir, on] of Object.entries(connections)) {
        if (on) gfx.lineBetween(x, y, ex[dir].tx, ex[dir].ty);
      }
    };

    drawArms(4, 0x8892a0);          // metallo argento

    // =========================================================================
    // STEP 3 — Hub meccanico centrale (Junction Box)
    // =========================================================================
    const hw = 7;   // half-width (px)
    const hh = 4;   // half-height isometrico (ratio ~2:1)

    // Corpo hub
    gfx.fillStyle(0x333b47, 1);
    gfx.beginPath();
    gfx.moveTo(x, y - hh);
    gfx.lineTo(x + hw, y);
    gfx.lineTo(x, y + hh);
    gfx.lineTo(x - hw, y);
    gfx.closePath();
    gfx.fillPath();

    // Bordo argentato
    gfx.lineStyle(1, 0xaaaaaa, 1);
    gfx.beginPath();
    gfx.moveTo(x, y - hh);
    gfx.lineTo(x + hw, y);
    gfx.lineTo(x, y + hh);
    gfx.lineTo(x - hw, y);
    gfx.closePath();
    gfx.strokePath();

  }

  // ===========================================================================
  // DEMOLIZIONE
  // ===========================================================================

  _demolishBuilding(building, isAutoPruneCall = false) {
    // 1. DISTRUGGI IMMEDIATAMENTE LA BARRA SE ESISTE
    building._loadingBar?.destroy();
    building._loadingBar = null;

    // Ferma il tween di costruzione se in corso
    if (building.buildTween) {
      building.buildTween.stop();
      building.buildTween = null;
    }

    const info = BUILDINGS_INFO[building.type];
    const idx = this.buildings.indexOf(building);
    if (idx < 0) return;

    const { col, row } = building;

    // Pulizia grafica
    if (building._armSprites) {
      Object.values(building._armSprites).forEach(s => s?.destroy());
      Object.values(building._armShadows ?? {}).forEach(s => s?.destroy());
    }
    building.gfx.destroy();
    building._shadow?.destroy();
    // rimosso _statusDot?destroy();
    this.buildings.splice(idx, 1);
    this.sound.play('sfx-rover-action', { volume: 0.6 });

    this.occupiedTiles[row][col] = false;

    this._setTileShadow(col, row, false);

    // =========================================================================
    // 2. FIX DOPPIO RIMBORSO (Double Dipping)
    // =========================================================================
    const refundMultiplier = building.isConstructing ? DEMOLISH_REFUND_DURING : DEMOLISH_REFUND_AFTER;
    let refundReg = Math.floor((info.cost ?? 0) * refundMultiplier);
    let refundComp = Math.floor((info.costComponents ?? 0) * refundMultiplier);

    // Se l'auto-potatura è stata innescata dall'annullamento di un cantiere, 
    // azzeriamo il rimborso del singolo condotto (già rimborsato nel blocco sotto)
    if (isAutoPruneCall && this._isUndoingNetwork) {
      refundReg = 0;
      refundComp = 0;
    }

    this.economy.regolith += refundReg;
    this.economy.components += refundComp;

    // Restituzione in blocco del costo dei condotti (se annullato)
    if (building.isConstructing && building.autoConnectCost) {
      this.economy.regolith += building.autoConnectCost;
      building.autoConnectCost = 0;
    }

    // Pulizia distretto logico
    if (info?.isDistrictCenter && building.district) {
      const district = building.district;
      for (const slot of district.slots) {
        if (slot.module !== null) {
          this._demolishBuilding(slot.module);
          slot.module = null;
        }
      }
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const c = district.centerCol + dc;
          const r = district.centerRow + dr;
          if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
            this.districtGrid[r][c] = null;
          }
        }
      }
      const distIdx = this.districts.indexOf(district);
      if (distIdx >= 0) this.districts.splice(distIdx, 1);
    }

    if (building.district && !info?.isDistrictCenter) {
      const d = building.district;
      for (const slot of d.slots) {
        if (slot.module === building) { slot.module = null; break; }
      }
    }

    this._updateAdjacentConduitsGraphics(col, row);
    this._updateNetworkConnectivity();
    // FIX: Rimosso processEconomyTick() manuale per evitare ricorsioni e salti temporali
    this.economy.updateProjections();

    // =========================================================================
    // 3. AUTO-POTATURA CON FLAG DI SICUREZZA
    // =========================================================================
    if (!isAutoPruneCall) {
      // Alziamo il flag se stiamo annullando una costruzione (rimborso 100%)
      this._isUndoingNetwork = building.isConstructing;

      this._pruneDeadEndConduits();

      // Abbassiamo il flag
      this._isUndoingNetwork = false;

      // Elimina il condotto rimasto sotto il modulo appena demolito, a meno che
      // non sia un ponte di rete (rimuoverlo disconnetterebbe altri edifici).
      if (building.type !== 'conduit') {
        const underConduit = this.buildings.find(
          b => b.type === 'conduit' && b.col === col && b.row === row && !b.isDamaged
        );
        if (underConduit) {
          const prevConnected = new Set(this.buildings.filter(b => b.connected));
          const ucIdx = this.buildings.indexOf(underConduit);
          this.buildings.splice(ucIdx, 1);
          this._updateNetworkConnectivity();
          const isNeeded = [...prevConnected].some(
            b => this.buildings.includes(b) && !b.connected
          );
          // Ripristina sempre il condotto nell'array prima di decidere cosa fare
          this.buildings.splice(ucIdx, 0, underConduit);
          this._updateNetworkConnectivity();
          if (!isNeeded) {
            this._demolishBuilding(underConduit, true);
            this._pruneDeadEndConduits();
          }
        }
      }
    }
  }

  _damageConduit(building) {
    building.isDamaged = true;
    building._lastVisualState = null;
    this._updateAdjacentConduitsGraphics(building.col, building.row);
    this._updateNetworkConnectivity();
    this._applyBuildingVisuals();
    this.economy.updateProjections();
    this.sound.play('sfx-rover-action', { volume: 0.6 });
  }

  _repairConduit(building) {
    const info = BUILDINGS_INFO['conduit'];
    if (this.economy.regolith < (info.cost ?? 0)) {
      console.warn('Regolite insufficiente per riparare!'); return;
    }
    this.economy.regolith -= (info.cost ?? 0);
    building.isDamaged = false;
    building._lastVisualState = null;
    this._updateAdjacentConduitsGraphics(building.col, building.row);
    this._updateNetworkConnectivity();
    this.economy.updateProjections();
    this._applyBuildingVisuals();
    this.sound.play('sfx-rover-action', { volume: 0.6 });
  }

  /**
   * Elimina automaticamente i condotti che non portano a nulla.
   * Continua a eliminare a catena finché tutti i "vicoli ciechi" sono stati rimossi
   * riavvolgendosi fino al primo snodo o edificio valido.
   */
  _pruneDeadEndConduits() {
    let prunedSomething = true;

    // Continuiamo a ciclare finché non ci sono più vicoli ciechi da potare
    while (prunedSomething) {
      prunedSomething = false;

      for (let i = this.buildings.length - 1; i >= 0; i--) {
        const b = this.buildings[i];
        if (b.type !== 'conduit') continue;
        if (b.isDamaged) continue;

        // 1. Verifichiamo che sia un condotto "nudo" (senza edifici solidi o distretti sopra di esso)
        const hasSolidBuilding = this.buildings.some(other => other !== b && other.col === b.col && other.row === b.row);
        if (hasSolidBuilding) continue;

        // 2. Contiamo a quanti altri elementi è collegato
        const conns = this._getConduitConnections(b.col, b.row);
        const activeConnsCount = Object.values(conns).filter(v => v).length;

        // 3. Se ha 0 o 1 sola connessione, è un ramo morto (dead-end)
        if (activeConnsCount <= 1) {
          // FIX: Demoliamo fisicamente il condotto richiamando la logica di auto-potatura.
          // Questo lo rimuove dall'array this.buildings, permettendo al loop di terminare
          // o di passare al prossimo condotto della catena.
          this._demolishBuilding(b, true);

          prunedSomething = true;
          break; // Usciamo dal for e ricominciamo il while per ricalcolare la rete aggiornata
        }
      }
    }
  }

  _selectBuilding(type, buttonEl) {
    // Il conduit richiede un Rover selezionato — non deselezionarlo
    if (type !== 'conduit') {
      this._deselectRover();
    }

    if (this.selectedBuilding === type) {
      this.selectedBuilding = null;
      this.ui.setSelectedBuildingButton(null);
    } else {
      this.selectedBuilding = type;
      this.ui.setSelectedBuildingButton(buttonEl);
    }
  }

  _togglePause(btnEl) {
    this.economy.isPaused = !this.economy.isPaused;
    this.ui.updatePauseButton(this.economy.isPaused);

    // Ferma i Timer (Ciclo Economia, Giorno/Notte)
    this.time.paused = this.economy.isPaused;

    if (this.economy.isPaused) {
      // --- AGGIUNTA: Ferma tutte le animazioni (Barre di costruzione, movimento rover, ombre)
      this.tweens.pauseAll();

      this.rovers.forEach(r => r.pauseMovement());
    } else {
      // --- AGGIUNTA: Ripristina tutte le animazioni
      this.tweens.resumeAll();

      this.rovers.forEach(r => {
        if (r.hasCrew && r.charge > 0) r.resumeMovement();
      });
    }
  }

  _drawResourceLens() {
    this.resourceLensGraphics = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const terrain = this.terrainGrid[row][col];
        if (terrain !== TERRAIN_ICE && terrain !== TERRAIN_REGOLITH) continue;
        const capacity = this.capacityGrid[row][col];
        const { x: cx, y: cy } = cartesianToIsometric(col, row);
        const w2 = TILE_W / 2;
        const h2 = TILE_H / 2;
        const baseDepth = row + col - GRID_SIZE * 4;
        const color = terrain === TERRAIN_ICE ? 0x44aaff : 0xff8833;
        const alpha = 0.15 + 0.65 * (capacity / DEPOSIT_MAX_CAPACITY);
        const gfx = this.add.graphics();
        gfx.setPosition(cx, cy);
        gfx.fillStyle(color, alpha);
        gfx.beginPath();
        gfx.moveTo(0, -h2);
        gfx.lineTo(w2, 0);
        gfx.lineTo(0, h2);
        gfx.lineTo(-w2, 0);
        gfx.closePath();
        gfx.fillPath();
        gfx.setDepth(baseDepth + 3);
        gfx.setVisible(false);
        this.resourceLensGraphics[row][col] = gfx;
      }
    }
  }

  _toggleResourceLens() {
    this.showResourceLens = !this.showResourceLens;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        this.resourceLensGraphics[row]?.[col]?.setVisible(this.showResourceLens);
      }
    }
    this.ui.updateResourceLensButton(this.showResourceLens);
  }

  _syncPreviewGraphic(type) {
    // Se è già lo stesso tipo, non facciamo nulla
    if (this._currentPreviewType === type && this.previewObj) return;

    // Distruggi la vecchia anteprima se esiste
    if (this.previewObj) {
      this.previewObj.destroy();
      this.previewObj = null;
    }

    this._currentPreviewType = type;
    if (!type) return;

    const info = BUILDINGS_INFO[type];

    // Mappa dei nuovi tipi (Sprint 2) alle texture PNG esistenti
    const texMap = {
      'conduit': 'conduit-node',
      'command': 'command',
      'hab_module': 'hab-module',
      'solar_array': 'solar-panel',
      'regolith_extractor': 'regolith-extractor',
      'ice_extractor': 'ice-extractor',
      'isru_plant': 'isru',
      'power_center': 'power-center',
      'mining_hub': 'mining-hub',
      'component_factory': 'component-factory',
      'cryo_hub': 'cryo-hub',
      // Nota: i nuovi moduli come rover_workshop o botany_greenhouse 
      // useranno automaticamente il fallback 3D finché non avrai i PNG.
    };

    const tex = texMap[type];

    if (tex) {
      // Usa lo sprite se esiste la texture
      this.previewObj = this.add.sprite(0, 0, tex);
      this.previewObj.setOrigin(0.5, 1);
      this.previewObj.displayWidth = TILE_W;
      this.previewObj.scaleY = this.previewObj.scaleX;
    } else {
      // Fallback per gli edifici generati proceduralmente (i blocchi 3D)
      this.previewObj = this.add.graphics();
      this._draw3DBlock(this.previewObj, 0, 0, info?.color || 0x8892a0, info?.height || 20);
    }

    // Settiamo l'opacità di base da "ologramma"
    this.previewObj.setAlpha(0.65);
  }

  _updateHighlighter() {
    this.highlighter.clear();
    if (this.pathPreviewGraphics) this.pathPreviewGraphics.clear();

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const hoverPos = isometricToCartesian(worldPoint.x, worldPoint.y);

    // =========================================================================
    // RAMO A: MODALITÀ COSTRUZIONE (Edificio selezionato)
    // =========================================================================
    if (this.selectedBuilding) {
      // --- RIPRISTINO: Sincronizza l'ologramma dello sprite ---
      this._syncPreviewGraphic(this.selectedBuilding);

      let previewTarget = null;
      let previewValid = false;

      // ── HELPER: Brackets Isometriche (Sub-pixel) ──
      const drawPlacementBrackets = (targetCol, targetRow, isValid, isCenter = true) => {
        const { x, y } = cartesianToIsometric(targetCol, targetRow);
        const color = isValid ? 0x33ff66 : 0xff3333;
        const pulse = 0.5 + Math.abs(Math.sin(this.time.now * 0.005)) * 0.5;
        const alpha = isCenter ? pulse : pulse * 0.4;
        const w2 = TILE_W / 2;
        const h2 = TILE_H / 2;
        const mag = Math.hypot(w2, h2);
        const E = [
          { x: w2 / mag, y: h2 / mag }, { x: -w2 / mag, y: h2 / mag },
          { x: -w2 / mag, y: -h2 / mag }, { x: w2 / mag, y: -h2 / mag },
        ];
        const C = [{ x, y: y - h2 }, { x: x + w2, y }, { x, y: y + h2 }, { x: x - w2, y }];
        const ARM = 6;
        const HALF = 0.6;
        const INSET = 2;
        this.highlighter.fillStyle(color, alpha);
        for (let i = 0; i < 4; i++) {
          const c = C[i];
          const toCX = x - c.x, toCY = y - c.y;
          const toCM = Math.hypot(toCX, toCY);
          const px = c.x + toCX / toCM * INSET;
          const py = c.y + toCY / toCM * INSET;
          const dB = E[i];
          const dA = { x: -E[(i + 3) % 4].x, y: -E[(i + 3) % 4].y };
          const v = (a, b) => ({ x: px + a * dA.x + b * dB.x, y: py + a * dA.y + b * dB.y });
          this.highlighter.fillPoints([v(0, -HALF), v(ARM, -HALF), v(ARM, HALF), v(HALF, HALF), v(HALF, ARM), v(-HALF, ARM), v(-HALF, 0)], true);
        }
      };

      // ── LOGICA DISTRETTI / SINGOLA TILE ──
      if (this.selectedDistrict) {
        const { y: centerY } = cartesianToIsometric(this.selectedDistrict.centerCol, this.selectedDistrict.centerRow);
        this.highlighter.setDepth((centerY - 1) + 35000);
        const info = BUILDINGS_INFO[this.selectedBuilding];
        const canAfford = this.economy.regolith >= (info?.cost ?? 0) && this.economy.components >= (info?.costComponents ?? 0);
        for (const slot of this.selectedDistrict.slots) {
          if (slot.module) continue;
          const terrain = this.terrainGrid[slot.row]?.[slot.col];
          let terrainOk = terrain !== 'crater' && terrain !== 'ridge';
          if (terrainOk && this.selectedBuilding === 'regolith_extractor') terrainOk = terrain === TERRAIN_REGOLITH;
          if (terrainOk && this.selectedBuilding === 'ice_extractor') terrainOk = terrain === TERRAIN_ICE;
          const isRoverOnTile = this._isRoverOnTile(slot.col, slot.row);
          let adjacentToOtherDistrict = false;
          outerAdj: for (let dr = -DISTRICT_MODULE_NEIGHBOR_GAP; dr <= DISTRICT_MODULE_NEIGHBOR_GAP; dr++) {
            for (let dc = -DISTRICT_MODULE_NEIGHBOR_GAP; dc <= DISTRICT_MODULE_NEIGHBOR_GAP; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nc = slot.col + dc; const nr = slot.row + dr;
              if (nc < 0 || nc >= GRID_SIZE || nr < 0 || nr >= GRID_SIZE) continue;
              if (this.buildings.some(b => b.col === nc && b.row === nr && b.district && b.district !== this.selectedDistrict)) {
                adjacentToOtherDistrict = true; break outerAdj;
              }
            }
          }
          const isValid = terrainOk && canAfford && !isRoverOnTile && !adjacentToOtherDistrict;
          drawPlacementBrackets(slot.col, slot.row, isValid, true);
          if (slot.col === hoverPos.col && slot.row === hoverPos.row) {
            previewTarget = { col: slot.col, row: slot.row };
            previewValid = isValid;
          }
        }

        // ── Crocette rosse sulle tile esterne bloccate dal modulo hoverate ──
        const _hovSlot = hoverPos && this.selectedDistrict.slots.find(
          s => !s.module && s.col === hoverPos.col && s.row === hoverPos.row
        );
        if (_hovSlot) {
          const _cx = this.selectedDistrict.centerCol;
          const _cy = this.selectedDistrict.centerRow;
          const _armLen = 5;
          const _iX = TILE_W / 2, _iY = TILE_H / 2;
          const _len = Math.hypot(_iX, _iY);
          const _dX = { x: _iX / _len, y: _iY / _len };
          const _dY = { x: -_iX / _len, y: _iY / _len };
          this.highlighter.lineStyle(1.5, 0xff3333, 0.85);
          for (let dr = -DISTRICT_MODULE_NEIGHBOR_GAP; dr <= DISTRICT_MODULE_NEIGHBOR_GAP; dr++) {
            for (let dc = -DISTRICT_MODULE_NEIGHBOR_GAP; dc <= DISTRICT_MODULE_NEIGHBOR_GAP; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nc = _hovSlot.col + dc; const nr = _hovSlot.row + dr;
              if (nc < 0 || nc >= GRID_SIZE || nr < 0 || nr >= GRID_SIZE) continue;
              if (Math.abs(nc - _cx) <= 1 && Math.abs(nr - _cy) <= 1) continue;
              const { x: tx, y: ty } = cartesianToIsometric(nc, nr);
              this.highlighter.lineBetween(tx - _dX.x * _armLen, ty - _dX.y * _armLen, tx + _dX.x * _armLen, ty + _dX.y * _armLen);
              this.highlighter.lineBetween(tx - _dY.x * _armLen, ty - _dY.y * _armLen, tx + _dY.x * _armLen, ty + _dY.y * _armLen);
            }
          }
        }
      } else {
        const isConduit = this.selectedBuilding === 'conduit';
        let targetCol = isConduit && this.selectedRover ? this.selectedRover.col : hoverPos.col;
        let targetRow = isConduit && this.selectedRover ? this.selectedRover.row : hoverPos.row;
        if (targetCol >= 0 && targetCol < GRID_SIZE && targetRow >= 0 && targetRow < GRID_SIZE) {
          const { y: targetY } = cartesianToIsometric(targetCol, targetRow);
          this.highlighter.setDepth((targetY - 1) + 35000);
          const info = BUILDINGS_INFO[this.selectedBuilding];
          const isDistrictCenter = info?.isDistrictCenter === true;
          const canAfford = this.economy.regolith >= (info?.cost ?? 0) && this.economy.components >= (info?.costComponents ?? 0);

          if (isDistrictCenter) {
            let allValid = canAfford;
            // Bounds (3×3 deve stare nella mappa)
            if (targetCol < 1 || targetCol >= GRID_SIZE - 1 || targetRow < 1 || targetRow >= GRID_SIZE - 1) allValid = false;
            // Rover range
            if (allValid && !this.rovers.some(r => this._isWithinRoverRange(r, targetCol, targetRow))) allValid = false;
            // Centro su crater/ridge
            if (allValid) {
              const ct = this.terrainGrid[targetRow]?.[targetCol];
              if (ct === 'crater' || ct === 'ridge') allValid = false;
            }
            // Gap da building di altri distretti
            if (allValid && this.buildings.some(b => b.district &&
              Math.max(Math.abs(b.col - targetCol), Math.abs(b.row - targetRow)) <= DISTRICT_MODULE_NEIGHBOR_GAP + 1
            )) allValid = false;
            // Terreno richiesto dal tipo di distretto (mining → regolith, ice → ice)
            if (allValid) {
              const dtDef = Object.values(DISTRICT_TYPES).find(dt => dt.centerBuilding === this.selectedBuilding);
              if (dtDef?.terrainReq) {
                const needed = dtDef.terrainReq === 'borders_regolith' ? TERRAIN_REGOLITH : TERRAIN_ICE;
                const found = [-1,0,1].some(dr => [-1,0,1].some(dc => {
                  if (dr === 0 && dc === 0) return false;
                  const c = targetCol + dc; const r = targetRow + dr;
                  return c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE && this.terrainGrid[r]?.[c] === needed;
                }));
                if (!found) allValid = false;
              }
            }
            // Per-tile: controlla ogni casella della 3×3 individualmente
            let anyTileBlocked = false;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const c = targetCol + dc; const r = targetRow + dr;
                if (c < 0 || c >= GRID_SIZE || r < 0 || r >= GRID_SIZE) continue;
                const isCenter = (dc === 0 && dr === 0);
                const tileConflict = !!this.occupiedTiles[r]?.[c];
                if (tileConflict) anyTileBlocked = true;
                drawPlacementBrackets(c, r, allValid && !tileConflict, isCenter);
              }
            }
            previewTarget = { col: targetCol, row: targetRow };
            previewValid = allValid && !anyTileBlocked;
          } else {
            const isOccupied = isConduit ? (this.occupiedTiles[targetRow][targetCol] || this.buildings.find(b => b.col === targetCol && b.row === targetRow && b.type === 'conduit')) : (this.occupiedTiles[targetRow][targetCol] || this._isRoverOnTile(targetCol, targetRow));
            let terrainOk = true;
            if (this.selectedBuilding === 'regolith_extractor') terrainOk = this.terrainGrid[targetRow][targetCol] === TERRAIN_REGOLITH;
            if (this.selectedBuilding === 'ice_extractor') terrainOk = this.terrainGrid[targetRow][targetCol] === TERRAIN_ICE;
            if (isConduit) { const _t = this.terrainGrid[targetRow][targetCol]; if (_t === 'crater' || _t === 'ridge') terrainOk = false; }
            const isValid = !isOccupied && canAfford && terrainOk && this.isTileValidForBuild(targetCol, targetRow, this.selectedBuilding, this.selectedRover);
            drawPlacementBrackets(targetCol, targetRow, isValid, true);
            previewTarget = { col: targetCol, row: targetRow }; previewValid = isValid;
          }
        }
      }

      // --- AGGIORNA VISIBILITÀ OLOGRAMMA ---
      if (previewTarget && this.previewObj) {
        const { x, y } = cartesianToIsometric(previewTarget.col, previewTarget.row);
        this.previewObj.setVisible(true);
        if (this.previewObj instanceof Phaser.GameObjects.Sprite) {
          this.previewObj.setPosition(x, y + TILE_H / 2);
          this.previewObj.setTint(previewValid ? 0x88ff88 : 0xff6666);
        } else {
          this.previewObj.setPosition(x, y);
          this.previewObj.setAlpha(previewValid ? 0.7 : 0.2);
        }
        this.previewObj.setDepth(y - 0.5);
      } else if (this.previewObj) {
        this.previewObj.setVisible(false);
      }
    }
    // =========================================================================
    // RAMO B: PATH PREVIEW DEL ROVER (Nessun edificio selezionato)
    // =========================================================================
    else {
      if (this.previewObj) this.previewObj.setVisible(false);
      if (this.selectedRover && !this.selectedRover.moving && this.selectedRover.isPowered) {
        const { col: hc, row: hr } = hoverPos;
        if (hc >= 0 && hc < GRID_SIZE && hr >= 0 && hr < GRID_SIZE) {
          if (hc !== this.selectedRover.col || hr !== this.selectedRover.row) {
            if (this._lastHoverCol !== hc || this._lastHoverRow !== hr) {
              this._lastHoverCol = hc; this._lastHoverRow = hr;
              this._lastHoverPath = aStarPathfind(this.occupiedTiles, this.terrainGrid, this.selectedRover.col, this.selectedRover.row, hc, hr);
            }
            if (this._lastHoverPath && this._lastHoverPath.length > 0) {
              this._drawPathPreview(this.selectedRover.col, this.selectedRover.row, this._lastHoverPath, this.selectedRover.charge);
            }
          }
        } else { this._lastHoverCol = null; this._lastHoverRow = null; this._lastHoverPath = null; }
      } else { this._lastHoverCol = null; this._lastHoverRow = null; this._lastHoverPath = null; }
    }
  }

  _drawPathPreview(startCol, startRow, path, currentCharge) {
    let chargeRemaining = currentCharge;
    const w2 = TILE_W / 2;
    const h2 = TILE_H / 2;
    const mag = Math.hypot(w2, h2);
    const E = [
      { x: w2 / mag, y: h2 / mag }, { x: -w2 / mag, y: h2 / mag },
      { x: -w2 / mag, y: -h2 / mag }, { x: w2 / mag, y: -h2 / mag },
    ];

    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      const { x, y } = cartesianToIsometric(step.col, step.row);

      const hasCharge = chargeRemaining > 0;
      // --- CAMBIO COLORE: Verde per carica ok, Rosso per carica insufficiente ---
      const color = hasCharge ? 0x33ff66 : 0xff3333;
      const alpha = hasCharge ? 0.7 : 0.3;

      if (i === path.length - 1) {
        // Brackets Standard per il target
        this._drawIsoSelectionBrackets(this.pathPreviewGraphics, x, y, color, alpha);
      } else {
        // Mini Brackets per il tragitto
        const scale = 0.3;
        const sw2 = w2 * scale;
        const sh2 = h2 * scale;
        const ARM = 3;
        const HALF = 1;
        const C = [{ x, y: y - sh2 }, { x: x + sw2, y }, { x, y: y + sh2 }, { x: x - sw2, y }];
        this.pathPreviewGraphics.fillStyle(color, alpha);
        for (let j = 0; j < 4; j++) {
          const c = C[j];
          const dB = E[j];
          const dA = { x: -E[(j + 3) % 4].x, y: -E[(j + 3) % 4].y };
          const v = (a, b) => ({ x: c.x + a * dA.x + b * dB.x, y: c.y + a * dA.y + b * dB.y });
          this.pathPreviewGraphics.fillPoints([v(0, -HALF), v(ARM, -HALF), v(ARM, HALF), v(HALF, HALF), v(HALF, ARM), v(-HALF, ARM), v(-HALF, 0)], true);
        }
      }
      chargeRemaining--;
    }
  }

  _isRoverOnTile(col, row) {
    return this.rovers.some(r =>
      (r.col === col && r.row === row) ||
      (r.moving && r.fromCol === col && r.fromRow === row)
    );
  }

  /**
   * Ritorna true se il rover si trova sulla tile target oppure in una delle
   * 4 caselle ortogonalmente adiacenti (distanza di Manhattan ≤ 1).
   *
   * @param {{ col: number, row: number }} rover
   * @param {number} targetCol
   * @param {number} targetRow
   * @returns {boolean}
   */
  _isWithinRoverRange(rover, targetCol, targetRow) {
    return Math.max(Math.abs(rover.col - targetCol), Math.abs(rover.row - targetRow)) <= 1;
  }

  _tryPlaceBuilding(targetCol, targetRow) {
    if (!this.selectedBuilding) return;
    if (this.selectedRover && !this.selectedRover.isPowered) return;

    // Edifici distretto → percorso separato
    const selectedInfo = BUILDINGS_INFO[this.selectedBuilding];
    if (selectedInfo?.isDistrictCenter) {
      let col = targetCol;
      let row = targetRow;
      if (col === undefined || row === undefined) {
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const cart = isometricToCartesian(worldPoint.x, worldPoint.y);
        col = cart.col;
        row = cart.row;
      }
      this._tryPlaceDistrict(this.selectedBuilding, col, row);
      return;
    }

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
    if (!this.exploredTiles[row][col]) return;

    const isConduit = this.selectedBuilding === 'conduit';

    // Trova eventuale condotto passabile sulla tile (non blocca occupiedTiles)
    const existingConduitIdx = this.buildings.findIndex(b =>
      b.col === col && b.row === row && b.type === 'conduit'
    );
    const existingConduit = existingConduitIdx >= 0 ? this.buildings[existingConduitIdx] : null;

    // Controlli occupazione
    if (isConduit) {
      if (this.occupiedTiles[row][col]) { console.warn('Tile già occupata!'); return; }

      const _conduitTerrain = this.terrainGrid[row][col];
      if (_conduitTerrain === 'crater' || _conduitTerrain === 'ridge') { console.warn('Condotto: terreno impraticabile!'); return; }

      // Se c'è un condotto danneggiato, il rover può solo ripararlo
      if (existingConduit?.isDamaged) {
        if (!this.selectedRover || this.selectedRover.col !== col || this.selectedRover.row !== row) {
          console.warn('Rover non in posizione per riparare!'); return;
        }
        this._repairConduit(existingConduit);
        return;
      }

      // Condotto integro già presente → blocca costruzione
      if (existingConduit) { console.warn('Tile già occupata!'); return; }

      // Il Rover deve essere esattamente su questa tile
      if (!this.selectedRover || this.selectedRover.col !== col || this.selectedRover.row !== row) {
        console.warn('Rover non in posizione!'); return;
      }
    } else {
      // Edificio standard: blocca se tile dura occupata
      if (this.occupiedTiles[row][col]) {
        console.warn('Spazio occupato!'); return;
      }
      // Blocca se c'è un Rover E non stiamo sovrascrivendo un condotto
      if (this._isRoverOnTile(col, row) && !existingConduit) {
        console.warn('Rover in posizione!'); return;
      }
    }

    // Controlli terreno
    if (this.selectedBuilding === 'regolith_extractor' && this.terrainGrid[row][col] !== TERRAIN_REGOLITH) {
      console.warn('Estrattore Regolite: tile non è Regolite!'); return;
    }
    if (this.selectedBuilding === 'ice_extractor' && this.terrainGrid[row][col] !== TERRAIN_ICE) {
      console.warn('Estrattore Ghiaccio: tile non è Ghiaccio!'); return;
    }

    // Controllo rete + costruttore
    if (!this.isTileValidForBuild(col, row, this.selectedBuilding, this.selectedRover)) {
      console.warn('Tile non valida: rete o costruttore mancante!'); return;
    }

    const info = BUILDINGS_INFO[this.selectedBuilding];

    // Controllo costo
    if (this.economy.regolith < (info.cost ?? 0)) {
      console.warn('Regolite insufficiente!'); return;
    }
    if (this.economy.components < (info.costComponents ?? 0)) {
      console.warn('Componenti insufficienti!'); return;
    }


    // === ESECUZIONE PIAZZAMENTO ===

    // Sovrascrivi condotto esistente se piazziamo un edificio standard
    if (!isConduit && existingConduit) {
      // Pulizia braccia condotto per evitare glitch grafici
      if (existingConduit._armSprites) {
        Object.values(existingConduit._armSprites).forEach(s => s?.destroy());
        Object.values(existingConduit._armShadows ?? {}).forEach(s => s?.destroy());
      }
      existingConduit.gfx.destroy();
      existingConduit._shadow?.destroy();
      this.buildings.splice(existingConduitIdx, 1);
      this._setTileShadow(col, row, false);
    }

    this.economy.regolith -= (info.cost ?? 0);
    this.economy.components -= (info.costComponents ?? 0);

    if (isConduit) {
      // Condotto passabile: NON blocca occupiedTiles, nessun costo di carica
    } else {
      this.occupiedTiles[row][col] = true;
      this._lastHoverCol = null; this._lastHoverRow = null; this._lastHoverPath = null;
    }

    // Conduit prima → stessa depth dell'edificio, ma creato prima → renderizzato sotto
    if (!isConduit) {
      this._placeBuildingGraphics(col, row, 'conduit');
    }

    this._placeBuildingGraphics(col, row, this.selectedBuilding);

    this._setTileShadow(col, row, true);

    // SFX piazzamento
    switch (this.selectedBuilding) {
      case 'solar_array':
        this.sound.play('sfx-build-solar', { volume: 0.8 });
        break;
      case 'regolith_extractor':
      case 'ice_extractor':
        this.sound.play('sfx-build-extractor', { volume: 0.8 });
        break;
      default:
        // conduit, hab, reactor e qualsiasi altro edificio
        this.sound.play('sfx-rover-action', { volume: 0.6 });
        break;
    }

    // Aggiorna condotti adiacenti (cambiano forma per la nuova connessione)
    this._updateAdjacentConduitsGraphics(col, row);
    this._updateNetworkConnectivity();

    this.economy.updateProjections();

    // Auto-deseleziona (single-build mode)
    this.selectedBuilding = null;
    this.ui.setSelectedBuildingButton(null);
    this.highlighter.clear();

    // Ricalcola le costruzioni disponibili nel pannello del rover (se ancora selezionato)
    this._updateContextPanel();
  }

  _createSpriteShadow(textureKey, x, y, displayWidth) {
    const depth = y - x * 0.001 - 0.5;
    const shadow = this.add.image(x + TILE_W * -0.03, y + TILE_H * 0.05, textureKey);
    shadow.setOrigin(0.5, 1);
    shadow.displayWidth = displayWidth;
    shadow.scaleY = shadow.scaleX;
    shadow.setTint(0x000000);
    shadow.setAlpha(0.8);
    shadow.setDepth(depth);
    return shadow;
  }

  _placeBuildingGraphics(col, row, type) {
    const { x, y } = cartesianToIsometric(col, row);
    const info = BUILDINGS_INFO[type];
    let gfx;
    let shadow = null;

    if (type === 'conduit') {
      const sprite = this.add.sprite(0, 0, 'conduit-node');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setDepth(sprite.depth - 0.5);
      // sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
      shadow = this._createSpriteShadow('conduit-node', sprite.x, sprite.y, sprite.displayWidth);
      shadow.setDepth(sprite.depth - 0.1); // <-- Forza l'ombra del nodo sotto lo sprite
    } else if (type === 'hab_module' || type === 'command') {
      gfx = Building.create(this, col, row, type);
      const textureKey = type === 'command' ? 'command' : 'hab-module';
      shadow = this._createSpriteShadow(textureKey, x, y + TILE_H / 2, TILE_W);
    } else if (type === 'solar_array') {
      const sprite = this.add.sprite(0, 0, 'solar-panel');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
      shadow = this._createSpriteShadow('solar-panel', sprite.x, sprite.y, sprite.displayWidth);
    } else if (type === 'regolith_extractor') {
      const sprite = this.add.sprite(0, 0, 'regolith-extractor');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
      shadow = this._createSpriteShadow('regolith-extractor', sprite.x, sprite.y, sprite.displayWidth);
    } else if (type === 'ice_extractor') {
      const sprite = this.add.sprite(0, 0, 'ice-extractor');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
      shadow = this._createSpriteShadow('ice-extractor', sprite.x, sprite.y, sprite.displayWidth);
    } else if (type === 'isru_plant') {
      const sprite = this.add.sprite(0, 0, 'isru');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
      shadow = this._createSpriteShadow('isru', sprite.x, sprite.y, sprite.displayWidth);
    } else if (type === 'power_center') {
      const sprite = this.add.sprite(0, 0, 'power-center');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
      shadow = this._createSpriteShadow('power-center', sprite.x, sprite.y, sprite.displayWidth);
    } else if (type === 'mining_hub') {
      const sprite = this.add.sprite(0, 0, 'mining-hub');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
      shadow = this._createSpriteShadow('mining-hub', sprite.x, sprite.y, sprite.displayWidth);
    } else if (type === 'cryo_hub') {
      const sprite = this.add.sprite(0, 0, 'cryo-hub');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
      shadow = this._createSpriteShadow('cryo-hub', sprite.x, sprite.y, sprite.displayWidth);
    } else if (type === 'component_factory') {
      const sprite = this.add.sprite(0, 0, 'component-factory');
      this._alignSpriteToTile(sprite, col, row);
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
      gfx = sprite;
      shadow = this._createSpriteShadow('component-factory', sprite.x, sprite.y, sprite.displayWidth);
    } else {
      // Moduli futuri (senza PNG) useranno questo blocco 3D procedurale
      gfx = this.add.graphics();
      this._draw3DBlock(gfx, x, y, info.color, info.height);
      gfx.setDepth(y);
    }

    this._revealFog(col, row, 1);
    this.buildings.push({ col, row, type, gfx, isPowered: true });
    const placed = this.buildings[this.buildings.length - 1];
    placed._shadow = shadow ?? null;

    // Rimuovere offset di depth globale: rover/edifici now hanno depth locali isometrici

    // Attacca handler pixel-perfect sullo sprite (se presente)
    this._attachBuildingPointerdown(placed);

    // Auto-tile immediato del condotto appena aggiunto
    if (type === 'conduit') {
      this._redrawConduitAt(col, row);
    }
  }

  /**
   * Aggiunge un listener 'pointerdown' sullo sprite interattivo dell'edificio.
   * Consente la selezione cliccando sull'intera area non-alpha del PNG,
   * indipendentemente dalla proiezione isometrica della tile.
   */
  _attachBuildingPointerdown(building) {
    // Se è un condotto, ignoralo del tutto
    if (building.type === 'conduit') return;

    const gfx = building.gfx;
    let interactive;

    if (gfx instanceof Phaser.GameObjects.Container) {
      // hab/command: sprite è il primo figlio del container
      interactive = gfx.getAt(0);
    } else if (gfx instanceof Phaser.GameObjects.Sprite) {
      interactive = gfx;
    } else {
      return; // Graphics procedurale (conduit, rtg, reactor) → nessuna azione
    }

    if (!interactive?.input) return;

    interactive.on('pointerdown', (pointer) => {
      if (this.isGameOver) return;
      if (pointer.rightButtonDown()) return;
      if (this.selectedBuilding) return;  // in build mode → non selezionare

      this._deselectRover();
      this.selectedEntity = { type: 'building', ref: building };
      this._updateContextPanel();
    });
  }

  // --- Allineamento sprite isometrico (usato anche per building sprite) ---
  _alignSpriteToTile(sprite, col, row) {
    const { x: centerX, y: centerY } = cartesianToIsometric(col, row);
    sprite.setOrigin(0.5, 1);
    sprite.setPosition(centerX, centerY + TILE_H / 2);
    sprite.displayWidth = TILE_W;
    sprite.scaleY = sprite.scaleX;
    this._updateSpriteDepth(sprite);
  }

  // ===========================================================================
  // DISEGNO EDIFICI (invariato dall'originale)
  // ===========================================================================

  _draw3DBlock(gfx, x, y, color, height) {
    const w2 = TILE_W / 2;
    const h2 = TILE_H / 2;
    const bT = { x, y: y - h2 };
    const bR = { x: x + w2, y };
    const bB = { x, y: y + h2 };
    const bL = { x: x - w2, y };
    const tT = { x: bT.x, y: bT.y - height };
    const tR = { x: bR.x, y: bR.y - height };
    const tB = { x: bB.x, y: bB.y - height };
    const tL = { x: bL.x, y: bL.y - height };

    const colorTop = color;
    const colorRight = Phaser.Display.Color.IntegerToColor(color).darken(20).color;
    const colorLeft = Phaser.Display.Color.IntegerToColor(color).darken(40).color;

    gfx.fillStyle(colorLeft, 1);
    gfx.beginPath();
    gfx.moveTo(bL.x, bL.y); gfx.lineTo(bB.x, bB.y);
    gfx.lineTo(tB.x, tB.y); gfx.lineTo(tL.x, tL.y);
    gfx.closePath(); gfx.fillPath();

    gfx.fillStyle(colorRight, 1);
    gfx.beginPath();
    gfx.moveTo(bR.x, bR.y); gfx.lineTo(bB.x, bB.y);
    gfx.lineTo(tB.x, tB.y); gfx.lineTo(tR.x, tR.y);
    gfx.closePath(); gfx.fillPath();

    gfx.fillStyle(colorTop, 1);
    gfx.beginPath();
    gfx.moveTo(tT.x, tT.y); gfx.lineTo(tR.x, tR.y);
    gfx.lineTo(tB.x, tB.y); gfx.lineTo(tL.x, tL.y);
    gfx.closePath(); gfx.fillPath();

    gfx.lineStyle(1, 0x000000, 0.3);
    gfx.strokePath();
  }

  // ===========================================================================
  // ROVER: COSTRUZIONE, SELEZIONE, MOVIMENTO
  // ===========================================================================

  _buildRover(sourceBuilding = null) {
    const activeRoversCount = this.rovers.filter(r => !r.isWreck).length;
    if (activeRoversCount >= (this.economy.maxRovers ?? 0)) {
      console.warn(`Rover Limit (${this.economy.maxRovers}) reached! Build more Rover Workshops.`);
      const center = Math.floor(GRID_SIZE / 2);
      this._showFloatingText(center, center, "MAX ROVER LIMIT", false);
      return;
    }
    // ------------------------------------

    const hasEnough = ROVER_COST_TYPE === 'components'
      ? this.economy.components >= ROVER_COST
      : this.economy.regolith >= ROVER_COST;
    if (!hasEnough) {
      console.warn(`${ROVER_COST_TYPE === 'components' ? 'Componenti' : 'Regolite'} insufficienti per il Rover!`); return;
    }

    const spawnRow = sourceBuilding?.row ?? this.buildings.find(b => b.type === 'command')?.row ?? Math.floor(GRID_SIZE / 2);
    const spawnCol = sourceBuilding?.col ?? this.buildings.find(b => b.type === 'command')?.col ?? Math.floor(GRID_SIZE / 2);
    let placed = false;

    for (let radius = 0; radius < GRID_SIZE && !placed; radius++) {
      for (let dr = -radius; dr <= radius && !placed; dr++) {
        for (let dc = -radius; dc <= radius && !placed; dc++) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
          const r = spawnRow + dr;
          const c = spawnCol + dc;
          if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
          if (this.occupiedTiles[r][c]) continue;
          if (!this.exploredTiles[r][c]) continue;
          if (this._getRoverAt(c, r)) continue;

          if (ROVER_COST_TYPE === 'components') this.economy.components -= ROVER_COST;
          else this.economy.regolith -= ROVER_COST;
          this._createRover(c, r);
          placed = true;
        }
      }
    }

    if (!placed) console.warn('Nessuna tile libera per il Rover!');
  }

  _createRover(col, row) {
    const rover = new Rover(this, col, row, this.economy);

    rover.on('pointerdown', () => {
      if (this.isGameOver) return;
      // Se è un relitto e hai un rover attivo nelle vicinanze, riciclalo
      if (rover.isWreck && this.selectedRover && !this.selectedRover.moving) {
        this._recycleWreck(this.selectedRover, rover);
      }
      else if (this.selectedBuilding === 'conduit' && this.selectedRover === rover) {
        this._tryPlaceBuilding(rover.col, rover.row);
      }
      else {
        this._selectRover(rover);
      }
    });
    this.rovers.push(rover);

    this._revealFog(col, row, ROVER_EXPLORE_RADIUS);
    this._setTileShadow(col, row, true);

    return rover;
  }

  _getRoverAt(col, row) {
    return this.rovers.find(r =>
      (r.col === col && r.row === row) ||
      (r.moving && r.fromCol === col && r.fromRow === row)
    ) || null;
  }

  _selectRover(rover) {
    this._deselectRover();
    rover.select();
    this.selectedRover = rover;
    this.selectedBuilding = null;
    this.selectedDistrict = null;
    this.selectedEntity = { type: 'rover', ref: rover };
    this.ui.setSelectedBuildingButton(null);
    this._drawSelectedRoverBrackets();
    this._showSelectionIndicator('rover');
    this.sound.play('sfx-rover-action', { volume: 0.6 });
    this._updateContextPanel();
  }

  _deselectRover() {
    if (!this.selectedRover) return;
    this.selectedRover.deselect();
    this.selectedRover = null;
    this._selectedRoverWasMoving = false;
    this.roverSelectionGraphics?.clear();
    this._hideSelectionIndicator();
  }

  /**
   * Aggiorna il pannello contestuale in base a this.selectedEntity.
   * Deve essere chiamato ogni volta che la selezione cambia.
   */
  _updateContextPanel() {
    const entity = this.selectedEntity;

    // Bracket + indicatore: mostra se un edificio è selezionato, altrimenti pulisce
    if (entity?.type === 'building') {
      this._drawBuildingSelectionBrackets(entity.ref);
      this._showSelectionIndicator('building');
    } else {
      this.buildingSelectionGraphics?.clear();
      if (entity?.type !== 'rover') this._hideSelectionIndicator();
    }

    // 1. Verifichiamo se l'entità selezionata è un centro distretto
    const isDistrictCenter = entity?.type === 'building' && BUILDINGS_INFO[entity.ref.type]?.isDistrictCenter;

    // 2. Aggiorniamo la regola di demolizione:
    // - Il Comando non si tocca (hideDemolish).
    // - Se è un Centro Distretto, permettiamo sempre la demolizione (segnale remoto).
    // - Se è un modulo singolo o condotto, serve un rover adiacente (distanza 1).
    const canDemolish = entity?.type === 'building' && entity.ref.type !== 'command'
      ? (isDistrictCenter || this.rovers.some(r => this._isWithinRoverRange(r, entity.ref.col, entity.ref.row)))
      : false;

    const hideDemolish = entity?.ref?.type === 'command';

    // Pre-calcola quali tipi di edificio il rover può piazzare da qui
    // (nessuno se il rover è spento)
    const buildableTypes = entity?.type === 'rover'
      ? (entity.ref.isPowered ? this._getBuildableTypes(entity.ref) : new Set())
      : null;

    // Bonus sinergie distretto
    let clusterBonus = null;
    if (entity?.type === 'building') {
      const b = entity.ref;
      const district = b.district ?? null;
      const mods = district ? this._getDistrictModules(district) : [];

      if (b.type === 'hab_module') {
        const activeHabs = mods.filter(m => m.type === 'hab_module' && m.isPowered !== false && m.connected !== false).length;
        const hasCommandBonus = district?.type === 'command' && district.connected === true;
        clusterBonus = {
          buildingType: 'hab_module',
          habCount: activeHabs,
          habBonus: Math.max(0, activeHabs - 1),
          hasCommandBonus,
        };
      } else {
        const bInfo = BUILDINGS_INFO[b.type];
        if (bInfo?.clusterSynergies) {
          const [synType, synData] = Object.entries(bInfo.clusterSynergies)[0];
          const rawCount = mods.filter(m => m.type === synType && m.isPowered !== false && m.connected !== false).length;
          const isSelfSynergy = synType === b.type;
          const count = isSelfSynergy ? Math.max(0, rawCount - 1) : rawCount;
          clusterBonus = {
            buildingType: b.type,
            synType,
            count,
            bonus: count * synData.valuePerBuilding,
            valuePerBuilding: synData.valuePerBuilding,
          };
        }
      }
    }

    // Info distretto (se l'edificio selezionato è un centro distretto)
    let districtInfo = null;
    if (entity?.type === 'building') {
      const bInfo = BUILDINGS_INFO[entity.ref.type];
      if (bInfo?.isDistrictCenter && entity.ref.district) {
        const district = entity.ref.district;
        const districtDef = DISTRICT_TYPES[district.type];
        districtInfo = {
          district,
          districtDef,
          slots: district.slots.map((slot, i) => ({
            col: slot.col,
            row: slot.row,
            module: slot.module,
            terrain: this.terrainGrid[slot.row]?.[slot.col] ?? TERRAIN_NORMAL,
            index: i,
          })),
        };
      }
    }

    const damagedConduitUnderRover = entity?.type === 'rover'
      ? this.buildings.find(b => b.col === entity.ref.col && b.row === entity.ref.row && b.type === 'conduit' && b.isDamaged)
      : null;

    this.ui.updateContextPanel(entity, {
      regolith: this.economy.regolith,
      components: this.economy.components,
      energyProduced: this.economy.energyProduced,
      energyRequired: this.economy.energyRequired,
      maxRovers: this.economy.maxRovers,
      activeRoversCount: this.rovers.filter(r => !r.isWreck).length,
      capacity: (entity?.type === 'building') ? (this.capacityGrid[entity.ref.row]?.[entity.ref.col] ?? 0) : 0,
      canDemolish,
      hideDemolish,
      buildableTypes,
      clusterBonus,
      districtInfo,
      damagedConduit: damagedConduitUnderRover,
      onRepairConduit: damagedConduitUnderRover ? () => {
        this._repairConduit(damagedConduitUnderRover);
        this._updateContextPanel();
      } : null,
      onDemolish: () => {
        if (entity?.type === 'building') {
          this._demolishBuilding(entity.ref);
          this.selectedEntity = null;
          this._updateContextPanel();
        }
      },
      onBuildRover: () => this._buildRover(entity?.ref),
      onStartBuild: (type) => {
        this.selectedBuilding = type;
        this.selectedDistrict = null;
      },
      onStartBuildModule: (moduleType) => {
        this.selectedBuilding = moduleType;
        this.selectedDistrict = entity.ref.district;
        this.ui.setSelectedBuildingButton(null);
      },
      onPlaceModule: (district, slotIndex, moduleType) => {
        this._tryPlaceModule(district, slotIndex, moduleType);
      },
      onRemoveModule: (district, slotIndex) => {
        this._removeModule(district, slotIndex);
      },
      onTogglePower: (target) => {
        target.isPowered = !target.isPowered;

        if (target instanceof Rover) {
          target._lastPoweredState = null;

          // FIX: Salita/discesa immediata dell'equipaggio senza aspettare i 10 secondi!
          if (target.isPowered && this.economy.crewTotal > this.economy.crewEmployed) {
            target.hasCrew = true;
            this.economy.crewEmployed++;
          } else if (!target.isPowered && target.hasCrew) {
            target.hasCrew = false;
            this.economy.crewEmployed--;
          }
        }

        this.economy.updateProjections();
        this._updateContextPanel();
      },
      onTogglePriority: (building) => {
        building.isHighPriority = !building.isHighPriority;
        this.economy.updateProjections();
        this._updateContextPanel();
      },
    });
  }

  /**
   * Restituisce un Set con i tipi piazzabili dal rover:
   *  – conduit:         rover sulla tile corrente (rete + posizione)
   *  – centri distretto (escluso command): sempre se il rover è acceso
   *    (la validazione della posizione avviene in _tryPlaceDistrict)
   */
  _getBuildableTypes(rover) {
    const buildable = new Set();

    // Centri distretto (escluso command) E Condotti per le riparazioni manuali
    for (const [type, info] of Object.entries(BUILDINGS_INFO)) {
      if ((info.isDistrictCenter && type !== 'command') || type === 'conduit') {
        buildable.add(type);
      }
    }

    return buildable;
  }

  _moveRoverTo(rover, destCol, destRow) {
    // 1. Recuperiamo la rotta già calcolata dall'hover del mouse (clonando l'array)
    let cachedPath = null;
    if (this._lastHoverCol === destCol && this._lastHoverRow === destRow && this._lastHoverPath) {
      cachedPath = [...this._lastHoverPath];
    }

    const commandAccepted = rover.moveTo(
      destCol, destRow,
      this.occupiedTiles,
      this.terrainGrid,
      (col, row, radius) => this._revealFog(col, row, radius),
      (col, row, shadowed) => this._setTileShadow(col, row, shadowed),
      cachedPath // <-- 2. Passiamo il percorso al rover
    );

    if (commandAccepted) {
      this.sound.play('sfx-rover-move', { volume: 0.8 });
    }
  }

  // ===========================================================================
  // SELEZIONE GRAFICA ROVER (brackets)
  // ===========================================================================

  _drawSelectedRoverBrackets() {
    if (!this.roverSelectionGraphics) return;
    this.roverSelectionGraphics.clear();
    if (!this.selectedRover) return;
    this.roverSelectionGraphics.setDepth(this.selectedRover.depth - 1);
    this._drawRoverSelection(this.selectedRover.col, this.selectedRover.row);
  }

  _drawRoverSelection(col, row) {
    const { x, y } = cartesianToIsometric(col, row);
    this._drawIsoSelectionBrackets(this.roverSelectionGraphics, x, y, 0xffffff);
  }

  /**
   * Disegna 4 bracket isometrici riempiti agli angoli del rombo centrato in (x, y).
   *
   * Ogni bracket è un poligono a 7 punti (unione di due strip parallelogrammatici):
   * le facce di estremità di ciascun braccio sono tagliate lungo la direzione
   * isometrica perpendicolare (= il lato adiacente del rombo), così gomiti e
   * punte hanno la forma corretta in proiezione isometrica.
   *
   * Sistema di coordinate locale per angolo i:
   *   dA = direzione verso angolo (i-1)   [perpendicolare isometrica di dB]
   *   dB = direzione verso angolo (i+1)   [perpendicolare isometrica di dA]
   *   v(a, b) = p + a*dA + b*dB
   *
   * Poligono L (7 punti, CCW in screen space):
   *   v(0,   −H)  →  v(L,  −H)  →  v(L,  H)
   *   →  v(H,  H)  →  v(H,  L)  →  v(−H, L)  →  v(−H, 0)
   */
  _drawIsoSelectionBrackets(gfx, x, y, color = 0xffffff, alpha = 1, thickness = 2) {
    const w2 = TILE_W / 2;
    const h2 = TILE_H / 2;
    const mag = Math.hypot(w2, h2); // ≈ 35.78

    // Versori lungo ogni lato: angolo[i] → angolo[(i+1)%4]
    const E = [
      { x: w2 / mag, y: h2 / mag }, // top → right
      { x: -w2 / mag, y: h2 / mag }, // right → bottom
      { x: -w2 / mag, y: -h2 / mag }, // bottom → left
      { x: w2 / mag, y: -h2 / mag }, // left → top
    ];

    // Posizioni dei 4 angoli
    const C = [
      { x, y: y - h2 },
      { x: x + w2, y },
      { x, y: y + h2 },
      { x: x - w2, y },
    ];

    const ARM = 8;   // lunghezza braccio (px screen)
    // HALF: offset isometrico per ottenere ~1.6px di spessore visivo
    // larghezza_visiva = HALF × |dA × dB| = HALF × 0.8
    const HALF = 2;
    const INSET = 2;   // rientranza dal corner verso il centro

    gfx.fillStyle(color, alpha);

    for (let i = 0; i < 4; i++) {
      const c = C[i];

      // Punto di partenza: leggermente rientrato verso il centro tile
      const toCX = x - c.x, toCY = y - c.y;
      const toCM = Math.hypot(toCX, toCY);
      const px = c.x + toCX / toCM * INSET;
      const py = c.y + toCY / toCM * INSET;

      const dB = E[i];                                      // verso angolo i+1
      const dA = { x: -E[(i + 3) % 4].x, y: -E[(i + 3) % 4].y }; // verso angolo i-1

      // v(a, b) = posizione in coordinate isometriche locali
      const v = (a, b) => ({
        x: px + a * dA.x + b * dB.x,
        y: py + a * dA.y + b * dB.y,
      });

      // Poligono L a 7 punti
      gfx.fillPoints([
        v(0, -HALF),  // partenza braccio-A, lato esterno-B
        v(ARM, -HALF),  // punta braccio-A, lato esterno-B
        v(ARM, HALF),  // punta braccio-A, lato interno-B
        v(HALF, HALF),  // gomito interno
        v(HALF, ARM),   // punta braccio-B, lato interno-A
        v(-HALF, ARM),   // punta braccio-B, lato esterno-A
        v(-HALF, 0),     // partenza braccio-B, lato esterno-A
      ], true);
    }
  }

  // ===========================================================================
  // SELEZIONE GRAFICA EDIFICIO (brackets — identici al rover, depth dietro il PNG)
  // ===========================================================================

  /**
   * Disegna i bracket di selezione attorno a un edificio.
   * Riceve l'oggetto building per poter impostare la depth subito dietro il suo sprite.
   * @param {{ col: number, row: number, gfx: Phaser.GameObjects.GameObject }} building
   */
  _drawBuildingSelectionBrackets(building) {
    const gfx = this.buildingSelectionGraphics;
    gfx.clear();
    if (!building) return;

    gfx.setDepth(building.gfx.depth - 1);

    const { x, y } = cartesianToIsometric(building.col, building.row);
    this._drawIsoSelectionBrackets(gfx, x, y, 0xffffff);
  }

  // ===========================================================================
  // SEMAFORO EDIFICI — stati OFF / STANDBY / ACTIVE
  // ===========================================================================

  /**
   * Calcola lo stato visivo di un edificio:
   *   'off'     — spento manualmente (isPowered === false)
   *   'standby' — acceso ma non operativo (disconnesso o risorse insufficienti)
   *   'active'  — funzionante
   */
  _getBuildingState(b) {
    if (b.isDamaged) return 'damaged';
    if (b.isPowered === false) return 'off';
    // Condotti non hanno stato produttivo: sono attivi se connessi, altrimenti standby
    if (b.connected === false) return 'disconnected';
    // Comando è sempre attivo se connesso
    if (b.type === 'command') return 'active';
    if (b._econActive === false) return 'standby';
    return 'active';
  }

  /**
   * Aggiorna FX e dot-semaforo di tutti gli edifici.
   * Usa _lastVisualState come cache per evitare re-render inutili ogni frame.
   */
  _applyBuildingVisuals() {
    for (const b of this.buildings) {
      const gfx = b.gfx;

      // --- FASE 1: VISUALS DI COSTRUZIONE ---
      if (b.isConstructing) {
        // FX Ologramma (Grigio/Trasparente)
        if (gfx.postFX && !b._fxApplied) {
          gfx.postFX.clear();
          gfx.postFX.addColorMatrix().brightness(0.6).grayscale(0.8, true);
          gfx.setAlpha(0.5);
          b._fxApplied = true;
          b._lastVisualState = 'constructing'; // Invalida stato normale
        }

        // --- DISEGNO BARRA (Stile SpaceX: Nero + Bordo Bianco) ---
        if (!b._loadingBar) b._loadingBar = this.add.graphics().setDepth(45000);
        b._loadingBar.clear();

        const bw = TILE_W * 0.5; // Più corta e discreta
        const bh = 1.5;           // Spessore HUD ultra-sottile
        const bx = gfx.x - bw / 2;
        const by = gfx.y - (b.type === 'command' || b.type === 'hab_module' ? 50 : 30);

        // Bordino nero
        const bborder = 0.5;
        b._loadingBar.fillStyle(0x000000, 1);
        b._loadingBar.fillRect(bx - bborder, by - bborder, bw + bborder * 2, bh + bborder * 2);

        // Sfondo nero
        b._loadingBar.fillStyle(0x000000, 1);
        b._loadingBar.fillRect(bx, by, bw, bh);

        // Riempimento: Verde vibrante al 80% di opacità per effetto luce
        const progress = b.buildProgress || 0;
        if (progress > 0) {
          b._loadingBar.fillStyle(0x33ff66, 0.8);
          b._loadingBar.fillRect(bx, by, bw * progress, bh);
        }

        // Salta il resto del processing visuale normale mentre si costruisce
        continue;
      } else {
        // Pulizia post-costruzione
        if (b._loadingBar) {
          b._loadingBar.destroy();
          b._loadingBar = null;
        }
        if (b._fxApplied) {
          gfx.postFX?.clear();
          gfx.setAlpha(1);
          b._fxApplied = false;
          b._lastVisualState = null; // Forza ricalcolo stato normale
        }
      }

      // --- VISUALS NORMALI (Active/Standby/Off) ---
      const state = this._getBuildingState(b);
      if (state === b._lastVisualState) continue;
      b._lastVisualState = state;

      const applyFX = (obj) => {
        if (!obj?.postFX) return;
        obj.postFX.clear();

        // Pulisce eventuali tint applicati in precedenza (solo se l'oggetto lo supporta)
        if (obj.clearTint) obj.clearTint();

        if (state === 'damaged') {
          obj.postFX.addColorMatrix().brightness(1.2);
          if (obj.setTint) obj.setTint(0xff4400);
        } else if (state === 'disconnected') {
          obj.postFX.addColorMatrix().brightness(0.4).grayscale(0.6);
          if (obj.setTint) obj.setTint(0x666666);
        } else if (state !== 'active') {
          obj.postFX.addColorMatrix().brightness(0.5).grayscale(1, true);
        }
      };
      gfx.setAlpha(1);
      applyFX(gfx);
      Object.values(b._armSprites ?? {}).forEach(applyFX);
    }
  }

  // ===========================================================================
  // INDICATORE SELEZIONE (triangolino statico sopra la tile)
  // ===========================================================================

  /**
   * Crea il Graphics del triangolino.
   * Non viene mai ridisegnato dopo la creazione: si sposta tramite setPosition().
   * Il colore viene scelto al momento della visualizzazione tramite _showSelectionIndicator.
   */
  _createSelectionIndicatorGfx() {
    const gfx = this.add.graphics();
    gfx.setDepth(46000);
    gfx.setVisible(false);
    return gfx;
  }

  /**
   * Ridisegna il triangolino con il colore specificato, lo posiziona e lo rende visibile.
   * Chiamato quando l'entità selezionata cambia tipo o colore.
   * @param {number} color  0xffffff per rover, 0x58a6ff per edificio
   */
  _drawIndicatorShape(color) {
    const gfx = this._selectionIndicatorGfx;
    gfx.clear();
    // Triangolo punta in basso: vertice in (0,0), base in alto
    // W = metà larghezza, H = altezza
    const W = 3, H = 5;
    gfx.fillStyle(color, 1);
    gfx.fillTriangle(-W, -H, W, -H, 0, 0);
  }

  /**
   * Mostra il triangolino nella posizione iniziale con il colore corretto.
   * La posizione viene poi aggiornata ogni frame da _updateSelectionIndicatorPosition.
   * @param {'rover'|'building'} entityType
   */
  _showSelectionIndicator(entityType) {
    const color = 0xffffff;
    this._drawIndicatorShape(color);
    this._selectionIndicatorGfx.setVisible(true);
  }

  /** Nasconde il triangolino. */
  _hideSelectionIndicator() {
    this._selectionIndicatorGfx?.setVisible(false);
  }

  /**
   * Riposiziona il triangolino ogni frame in base all'entità selezionata.
   * Per il rover usa la posizione reale dello sprite (incluso visualYOffset)
   * così segue il movimento in modo fluido. Per gli edifici usa le coordinate tile.
   * Un offset sinusoidale produce l'oscillazione verticale.
   */
  _updateSelectionIndicatorPosition() {
    const gfx = this._selectionIndicatorGfx;
    const entity = this.selectedEntity;
    if (!gfx?.visible || !entity) return;

    // Oscillazione: ±3 px, periodo ~2 s
    const bob = Math.sin(this.time.now * 0.006) * 1.5;

    if (entity.type === 'rover') {
      const r = entity.ref;
      gfx.setPosition(r.x, r.y - TILE_H - 18 + bob);
    } else if (entity.type === 'building') {
      const { x, y } = cartesianToIsometric(entity.ref.col, entity.ref.row);
      gfx.setPosition(x, y - TILE_H / 2 - 22 + bob);
    }
  }

  // ===========================================================================
  // INPUT: CAMERA E GRID PICKING
  // ===========================================================================

  _setupKeyboard() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard.addKey('W'),
      down: this.input.keyboard.addKey('S'),
      left: this.input.keyboard.addKey('A'),
      right: this.input.keyboard.addKey('D'),
    };

    // --- Debug: salva (O) / carica (P) ---
    this.input.keyboard.on('keydown-O', () => this.saveGameState());
    this.input.keyboard.on('keydown-P', () => this.loadGameState());

    // --- ESC: annulla modalità costruzione ---
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.selectedBuilding) {
        this.selectedBuilding = null;
        this.ui.setSelectedBuildingButton(null);
        this.highlighter.clear();
      }
    });
  }

  _clampCamera() {
    const cam = this.cameras.main;

    // Rimuoviamo la divisione per cam.zoom. 
    // Vogliamo vincolare il CENTRO della camera agli estremi della mappa.
    const halfCamW = cam.width / 2;
    const halfCamH = cam.height / 2;

    // I limiti fisici della tua griglia a rombo
    const mapMinX = -(GRID_SIZE - 1) * TILE_W / 2;
    const mapMaxX = (GRID_SIZE - 1) * TILE_W / 2;
    const mapMinY = 0;
    const mapMaxY = (GRID_SIZE - 1) * TILE_H;

    // Clamp di scrollX e scrollY (che rappresentano l'angolo in alto a sinistra unscaled)
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, mapMinX - halfCamW, mapMaxX - halfCamW);
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, mapMinY - halfCamH, mapMaxY - halfCamH);
  }

  _handleCameraKeyboard() {
    const cam = this.cameras.main;
    let moved = false;
    if (this.cursors.up.isDown || this.wasd.up.isDown) { cam.scrollY -= CAM_SPEED; moved = true; }
    if (this.cursors.down.isDown || this.wasd.down.isDown) { cam.scrollY += CAM_SPEED; moved = true; }
    if (this.cursors.left.isDown || this.wasd.left.isDown) { cam.scrollX -= CAM_SPEED; moved = true; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { cam.scrollX += CAM_SPEED; moved = true; }
    if (moved) this._clampCamera();
  }

  _setupMousePan() {
    this._drag = { active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 };
    this.input.on('pointerdown', (p) => {
      if (p.rightButtonDown()) return;
      this._drag.active = true;
      this._drag.startX = p.x;
      this._drag.startY = p.y;
      this._drag.camStartX = this.cameras.main.scrollX;
      this._drag.camStartY = this.cameras.main.scrollY;
    });
    this.input.on('pointermove', (p) => {
      if (!this._drag.active) return;
      const zoom = this.cameras.main.zoom;
      this.cameras.main.scrollX = this._drag.camStartX - (p.x - this._drag.startX) / zoom;
      this.cameras.main.scrollY = this._drag.camStartY - (p.y - this._drag.startY) / zoom;
      this._clampCamera();
    });
    this.input.on('pointerup', () => { this._drag.active = false; });
  }

  _setupGlobalGridPicking() {
    this.input.on('pointerdown', (pointer, currentlyOver) => {
      if (this.isGameOver) return;
      const pickedTile = this._pickGridTileFromPointer(pointer, currentlyOver);
      if (!pickedTile) return;
      const { col, row } = pickedTile;

      // ── Tasto Destro ──────────────────────────────────────────────────────
      if (pointer.rightButtonDown()) {
        // Se siamo in modalità costruzione → annullala
        if (this.selectedBuilding) {
          this.selectedBuilding = null;
          this.selectedDistrict = null;
          this.ui.setSelectedBuildingButton(null);
          this.highlighter.clear();
          return;
        }
        // Altrimenti muovi il rover selezionato
        if (!this.selectedRover) return;
        this._moveRoverTo(this.selectedRover, col, row);
        return;
      }


      // ── Modalità costruzione ──────────────────────────────────────────────
      if (this.selectedBuilding) {
        if (this.selectedDistrict) {
          // Module placement: click su uno slot del distretto
          const dist = this.districtGrid[row]?.[col];
          if (dist === this.selectedDistrict) {
            const slotIdx = this.selectedDistrict.slots.findIndex(s => s.col === col && s.row === row);
            if (slotIdx >= 0) {
              this._tryPlaceModule(this.selectedDistrict, slotIdx, this.selectedBuilding);
            }
          }
          this.selectedBuilding = null;
          this.selectedDistrict = null;
          this.highlighter.clear();
          this._updateContextPanel();
          return;
        }
        this._tryPlaceBuilding(col, row);
        return;
      }

      // ── Modalità selezione (UI contestuale) ───────────────────────────────
      // I rover hanno il proprio handler 'pointerdown' e generano currentlyOver,
      // quindi non arriveremo qui per i click sui rover.
      // Per gli edifici, invece, arriviamo qui normalmente.

      // Cerca un edificio sulla tile, ma assicurati che NON sia un condotto
      const building = this.buildings.find(b => b.col === col && b.row === row && b.type !== 'conduit');
      if (building) {
        this._deselectRover();
        this.selectedEntity = { type: 'building', ref: building };
        this._updateContextPanel();
        return;
      }

      // Tile vuota → deseleziona tutto
      this._deselectRover();
      this.selectedEntity = null;
      this._updateContextPanel();
    });
  }

  _pickGridTileFromPointer(pointer, currentlyOver = []) {
    if (this._drag.active &&
      (Math.abs(pointer.x - this._drag.startX) > 5 ||
        Math.abs(pointer.y - this._drag.startY) > 5)) return null;

    // Right-click ignora currentlyOver (il movimento rover deve sempre passare)
    // Left-click: se c'è uno sprite interattivo, lasciamo gestire a lui
    if (!pointer.rightButtonDown() && currentlyOver.length > 0) return null;

    const { col, row } = isometricToCartesian(pointer.worldX, pointer.worldY);
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
    return { col, row };
  }

  _centerCameraOnGrid() {
    const { x: cx, y: cy } = cartesianToIsometric(GRID_SIZE / 2, GRID_SIZE / 2);
    this.cameras.main.centerOn(cx, cy);
  }

  // ===========================================================================
  // SAVE / LOAD  (localStorage, hotkeys O / P)
  // ===========================================================================

  saveGameState() {
    const saveData = {
      economy: {
        regolith: this.economy.regolith,
        ice: this.economy.ice,
        oxygen: this.economy.oxygen,
        components: this.economy.components,
        energyStored: this.economy.energyStored, // <--- AGGIUNGI QUESTA
        isDay: this.economy.isDay,
        emergencyTimer: this.economy.emergencyTimer,
        deadlockTimer: this.economy.deadlockTimer
      },
      capacity: this.capacityGrid,
      explored: [],
      buildings: this.buildings.map(b => ({ type: b.type, col: b.col, row: b.row, isPowered: b.isPowered ?? true })),
      rovers: this.rovers.map(r => ({
        col: r.col, row: r.row,
        charge: r.charge, isPowered: r.isPowered,
        durability: r.durability, isWreck: r.isWreck
      })),
    };

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.exploredTiles[r][c]) saveData.explored.push({ col: c, row: r });
      }
    }

    // Salva solo i tile non-normali (compatto: su 1600 tile la maggior parte è NORMAL)
    saveData.terrain = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const t = this.terrainGrid[r][c];
        if (t !== TERRAIN_NORMAL) saveData.terrain.push({ r, c, t });
      }
    }

    localStorage.setItem('moonbase_save', JSON.stringify(saveData));
  }

  loadGameState() {
    const raw = localStorage.getItem('moonbase_save');
    if (!raw) { console.warn('Nessun salvataggio trovato.'); return; }
    const data = JSON.parse(raw);

    // --- 1. Distruggi edifici esistenti ---
    this.buildings.forEach(b => {
      // Aggiungi pulizia condotti
      if (b._armSprites) {
        Object.values(b._armSprites).forEach(s => s?.destroy());
        Object.values(b._armShadows ?? {}).forEach(s => s?.destroy());
      }
      b.gfx.destroy();
      b._shadow?.destroy();
    });
    this.buildings.length = 0;

    // --- 2. Distruggi rover esistenti ---
    this._deselectRover();
    this.rovers.forEach(r => {
      r._moveTween?.stop();
      r._engineTween?.stop();
      r._chargeBar?.destroy();
      r.destroy();
    });
    this.rovers.length = 0;

    // --- 3. Reset tile shadows, occupancy, districtGrid e fog ---
    this.isGamePaused = false;
    this.districts.length = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        this.occupiedTiles[r][c] = false;
        this.exploredTiles[r][c] = false;
        this.districtGrid[r][c] = null;
        this._setTileShadow(c, r, false);

        const prevMask = this.fogEdgeMasks?.[r]?.[c];
        if (prevMask) { prevMask.destroy(); this.fogEdgeMasks[r][c] = null; }

        const fogGfx = this.fogGraphics[r]?.[c];
        if (fogGfx) {
          fogGfx.clear();
          fogGfx.fillStyle(0x000000, 1);
          fogGfx.beginPath();
          fogGfx.moveTo(0, -TILE_H / 2);
          fogGfx.lineTo(TILE_W / 2, 0);
          fogGfx.lineTo(0, TILE_H / 2);
          fogGfx.lineTo(-TILE_W / 2, 0);
          fogGfx.closePath();
          fogGfx.fillPath();
        }
      }
    }

    // --- 3b. Ripristina terreno (giacimenti) ---
    if (data.terrain) {
      // Azzera tutto a NORMAL, poi applica i tile risorsa salvati
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          this.terrainGrid[r][c] = TERRAIN_NORMAL;
        }
      }
      for (const { r, c, t } of data.terrain) {
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
          this.terrainGrid[r][c] = t;
        }
      }
      this._deriveDepositGroupsFromTerrain();

      // --- 3c. Ricostruisci Array Crateri Quadrati ---
      this.squareCraters = [];
      const visited = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));

      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (this.terrainGrid[r][c] === 'crater' && !visited[r][c]) {
            let size = 0;
            // Controlla quanto è largo il quadrato partendo dal suo angolo in alto a sx
            while (c + size < GRID_SIZE && this.terrainGrid[r][c + size] === 'crater' && !visited[r][c + size]) {
              size++;
            }
            // Segna tutta l'area come visitata per non duplicare i crateri
            for (let dr = 0; dr < size; dr++) {
              for (let dc = 0; dc < size; dc++) {
                if (r + dr < GRID_SIZE && c + dc < GRID_SIZE) visited[r + dr][c + dc] = true;
              }
            }
            this.squareCraters.push({ row: r, col: c, size });
          }
        }
      }

      // 1. Distruggi TUTTI i vecchi decal delle risorse
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (this.tileResourceGraphics[r]?.[c]) {
            this.tileResourceGraphics[r][c].destroy();
            this.tileResourceGraphics[r][c] = null;
          }
        }
      }

      // 2. Ricrea i decal basati SOLO sulla mappa appena caricata
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const terrain = this.terrainGrid[r][c];
          if (terrain === TERRAIN_ICE || terrain === TERRAIN_REGOLITH) {
            this.tileResourceGraphics[r][c] = this._createResourceDecal(c, r, terrain);
          }
        }
      }

      // 3. Pulisci rocce e crateri della vecchia mappa casuale
      if (this.terrainProps) {
        this.terrainProps.forEach(prop => prop.destroy());
      }
      this.terrainProps = [];

      // 4. Rigenera rocce e crateri in modo che combacino con il nuovo terreno
      this._spawnRocks();
      this._spawnCraters();
    }

    // --- 4. Ripristina economia ---
    const eco = data.economy;
    this.economy.regolith = eco.regolith;
    this.economy.ice = eco.ice;
    this.economy.oxygen = eco.oxygen;
    this.economy.components = eco.components ?? 40;
    this.economy.syncDayNight(eco.isDay);
    this.economy.emergencyTimer = eco.emergencyTimer || 0;
    this.economy.deadlockTimer = eco.deadlockTimer || 0;
    // Restore storage energy
    if (eco.energyStored !== undefined) {
      this.economy.energyStored = eco.energyStored;
    }

    // --- 5. Ripristina esplorazione ---
    for (const { col, row } of data.explored) {
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        this.exploredTiles[row][col] = true;
        this.fogGraphics[row]?.[col]?.clear();
      }
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        this._refreshFogEdgeAt(r, c);
      }
    }

    // --- 6. Ripristina edifici (piazzamento silente: nessun costo né popup) ---
    this._silentLoad = true;
    for (const b of data.buildings) {
      const info = BUILDINGS_INFO[b.type];
      this._placeBuildingGraphics(b.col, b.row, b.type);
      const placed = this.buildings[this.buildings.length - 1];
      placed.isPowered = b.isPowered ?? true;
      if (!info?.isPassable) {
        this.occupiedTiles[b.row][b.col] = true;
      }
      this._setTileShadow(b.col, b.row, true);
    }
    this._silentLoad = false;

    // --- 6b. Ricostruisci distretti dai centri salvati ---
    this._reconstructDistricts();

    // --- 7. Fix auto-tiling condotti (ricollegamento grafico) ---
    for (const b of this.buildings) {
      if (b.type === 'conduit') {
        this._redrawConduitAt(b.col, b.row);
        this._updateAdjacentConduitsGraphics(b.col, b.row);
      }
    }

    // --- 8. Ricalcola connettività rete ---
    this._updateNetworkConnectivity();

    // --- 8b. Carica capacityGrid e isDay ---
    if (data.capacity) this.capacityGrid = data.capacity;
    if (data.economy && data.economy.isDay !== undefined) {
      this.economy.syncDayNight(data.economy.isDay);
    }

    // --- 9. Ripristina rover con carica salvata ---
    for (const rv of data.rovers) {
      const rover = this._createRover(rv.col, rv.row);
      rover.charge = rv.charge;
      rover.durability = rv.durability ?? 100;

      // Se era un relitto, forziamo immediatamente la sua rottura
      if (rv.isWreck) {
        rover.breakDown();
      } else {
        rover.isPowered = rv.isPowered ?? true;
        rover._lastPoweredState = null;
        rover._applyVisuals();
      }
      rover._updateChargeBar();
    }

    // --- 10. Aggiorna UI e centra camera ---
    this.economy.updateProjections();
    this._centerCameraOnGrid();
  }

  // ===========================================================================
  // BADGE DISTRETTI (UI su mappa)
  // ===========================================================================
  _updateDistrictBadges() {
    const layer = document.getElementById('district-badges-layer');
    if (!layer) return;

    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const currentIds = new Set();

    const iconMap = {
      habitat: 'home',
      logistics: 'truck',
      mining: 'pickaxe',
      cryo: 'droplets',
      energy: 'zap',
      command: 'landmark'
    };

    for (const district of this.districts) {
      if (!district.mainBuilding) continue;
      currentIds.add(district.id);
      let badgeWrapper = document.getElementById(`badge-${district.id}`);

      if (!badgeWrapper) {
        badgeWrapper = document.createElement('div');
        badgeWrapper.id = `badge-${district.id}`;
        badgeWrapper.className = 'district-badge-wrapper';
        const badge = document.createElement('div');
        badge.className = `district-badge type-${district.type}`;
        const iconName = iconMap[district.type] || 'box';
        badge.innerHTML = `<i data-lucide="${iconName}"></i>`;
        badgeWrapper.appendChild(badge);
        layer.appendChild(badgeWrapper);
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: badgeWrapper });
      }

      // 2. Calcolo Posizione 3D 
      const { x, y } = cartesianToIsometric(district.centerCol, district.centerRow);
      const worldX = x;
      const worldY = y - (TILE_H / 2) - 10; // <-- RIPRISTINATO: -25px reali sopra la casella

      // 3. Proiezione su Schermo
      const screenX = (worldX - cam.scrollX - cx) * cam.zoom + cx;
      const screenY = (worldY - cam.scrollY - cy) * cam.zoom + cy;

      const scale = Math.max(0.7, Math.min(1.2, cam.zoom / 2.5));

      // 4. Posizionamento senza translate per non interferire con la scala
      badgeWrapper.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) scale(${scale})`;
    }

    Array.from(layer.children).forEach(child => {
      const id = child.id.replace('badge-', '');
      if (!currentIds.has(id)) child.remove();
    });
  }
  _updateStatusIcons() {
    const layer = document.getElementById('status-icons-layer');
    if (!layer) return;

    const cam = this.cameras.main;
    const currentIds = new Set();

    // 1. Edifici
    for (const b of this.buildings) {
      if (b.isConstructing) continue;

      let iconType = null;
      let cssClass = '';

      if (b.isPowered === false) {
        iconType = 'power'; cssClass = 'danger';
      } else if (b.connected === false) {
        iconType = 'cable'; cssClass = 'warning';
      } else if (b.type !== 'command' && b.type !== 'conduit') {
        if (b._lackingEnergy) {
          iconType = 'zap-off'; cssClass = 'warning';
        } else if (b._lackingCrew) {
          iconType = 'user-x'; cssClass = 'crew';
        }
      }

      if (!iconType) continue; // Nessun errore, ignora

      const id = `status-${b.col}-${b.row}`;
      currentIds.add(id);

      let iconDiv = document.getElementById(id);
      if (!iconDiv) {
        iconDiv = document.createElement('div');
        iconDiv.id = id;
        iconDiv.dataset.lastIcon = iconType;
        iconDiv.className = `status-icon ${cssClass}`;
        iconDiv.innerHTML = `<i data-lucide="${iconType}" style="width:14px;height:14px;"></i>`;
        layer.appendChild(iconDiv);
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: iconDiv });
      } else {
        iconDiv.className = `status-icon ${cssClass}`;
        if (iconDiv.dataset.lastIcon !== iconType) {
          iconDiv.dataset.lastIcon = iconType;
          iconDiv.innerHTML = `<i data-lucide="${iconType}" style="width:14px;height:14px;"></i>`;
          if (typeof lucide !== 'undefined') lucide.createIcons({ root: iconDiv });
        }
      }

      // Proiezione 3D -> 2D
      const { x, y } = cartesianToIsometric(b.col, b.row);
      const screenX = (x - cam.scrollX - cam.width / 2) * cam.zoom + cam.width / 2;
      const screenY = ((y - TILE_H) - cam.scrollY - cam.height / 2) * cam.zoom + cam.height / 2;

      iconDiv.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) scale(${cam.zoom / 3})`;
    }

    // FIX: Icone OFF per i Rover
    for (const r of this.rovers) {
      if (r.isWreck || r.isPowered) continue;

      const id = `status-rover-${r.id}`;
      currentIds.add(id);

      let iconDiv = document.getElementById(id);
      if (!iconDiv) {
        iconDiv = document.createElement('div');
        iconDiv.id = id;
        iconDiv.dataset.lastIcon = 'power';
        iconDiv.className = `status-icon danger`;
        iconDiv.innerHTML = `<i data-lucide="power" style="width:14px;height:14px;"></i>`;
        layer.appendChild(iconDiv);
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: iconDiv });
      }

      const screenX = (r.x - cam.scrollX - cam.width / 2) * cam.zoom + cam.width / 2;
      const screenY = ((r.y - TILE_H - 10) - cam.scrollY - cam.height / 2) * cam.zoom + cam.height / 2;

      iconDiv.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) scale(${cam.zoom / 3})`;
    }

    // Cleanup vecchie icone (es. edificio tornato attivo o demolito)
    Array.from(layer.children).forEach(child => {
      if (!currentIds.has(child.id)) child.remove();
    });
  }

  _showFloatingText(col, row, text, isPositive = false) {
    const { x, y } = cartesianToIsometric(col, row);
    const offsetX = Phaser.Math.Between(-5, 5);

    const txt = this.add.text(x + offsetX, y - 20, text, {
      fontFamily: '"Space Mono", monospace',
      fontSize: '12px', // Più piccolo
      color: isPositive ? '#f0f0fa' : '#f85149',
      fontStyle: 'bold',
      resolution: 2 // Fondamentale per la nitidezza su schermi HiDPI
    }).setOrigin(0.5).setDepth(46000);

    // Animazione più rapida e "snappy"
    this.tweens.add({
      targets: txt,
      y: y - 40,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => txt.destroy()
    });
  }

  _checkPOIOccupation(rover) {
    for (let i = this.pois.length - 1; i >= 0; i--) {
      const poi = this.pois[i];
      if (poi.col === rover.col && poi.row === rover.row) {
        if (poi.type === 'supply') this.economy.components += poi.reward;
        else if (poi.type === 'wreck') this.economy.regolith += poi.reward;

        this._showFloatingText(rover.col, rover.row, `+${poi.reward} ${poi.type === 'supply' ? 'COMP' : 'REG'}`, true);
        poi.sprite.destroy();
        this.pois.splice(i, 1);
        this.economy.updateProjections();
      }
    }
  }

  _recycleWreck(activeRover, wreckRover) {
    if (activeRover === wreckRover) return; // FIX: Impedisce l'auto-riciclo
    const dist = Math.max(Math.abs(activeRover.col - wreckRover.col), Math.abs(activeRover.row - wreckRover.row));
    if (dist <= 1) {
      this.economy.components += ROVER_WRECK_RECYCLE_COMP;
      this.occupiedTiles[wreckRover.row][wreckRover.col] = false;

      const index = this.rovers.indexOf(wreckRover);
      if (index > -1) this.rovers.splice(index, 1);
      wreckRover.destroy();

      this._showFloatingText(activeRover.col, activeRover.row, "+20 COMP", true);
      this.economy.updateProjections();
    }
  }

  _spawnInitialPOIs() {
    for (let i = 0; i < INITIAL_WRECK_COUNT; i++) {
      const col = Phaser.Math.Between(5, GRID_SIZE - 5);
      const row = Phaser.Math.Between(5, GRID_SIZE - 5);
      if (!this.occupiedTiles[row][col] && this.terrainGrid[row][col] === 'normal') {
        const { x, y } = cartesianToIsometric(col, row);
        const poiImg = this.add.image(x, y, 'artemis-wreck');
        poiImg.setDisplaySize(TILE_W * 0.7, TILE_W * 0.7 * (poiImg.height / poiImg.width));
        poiImg.setDepth(y - x * 0.001);
        // Attach world coordinates for visibility control
        poiImg.col = col; // adattare se necessario al centro
        poiImg.row = row;
        poiImg.setVisible(this.exploredTiles[poiImg.row][poiImg.col]);
        this.pois.push({ type: 'wreck', col, row, sprite: poiImg, reward: ARTEMIS_WRECK_REGOLITH });
      }
    }
  }

  _spawnSupplyDrop() {
    // Non ne arrivano altri finché non hai raccolto il precedente
    if (this.pois.some(p => p.type === 'supply')) return;

    const explored = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const terrain = this.terrainGrid[r][c];
        // Esclude i crateri, le creste e le tile occupate
        if (this.exploredTiles[r][c] && !this.occupiedTiles[r][c] && terrain !== 'crater' && terrain !== 'ridge') {
          explored.push({ c, r });
        }
      }
    }
    if (explored.length === 0) return;

    const target = Phaser.Utils.Array.GetRandom(explored);
    const { x, y } = cartesianToIsometric(target.c, target.r);

    const startY = y - 350;
    const drop = this.add.image(x, startY, 'supply-drop');
    drop.setDisplaySize(TILE_W * 0.5, TILE_W * 0.5 * (drop.height / drop.width));

    // Calcoliamo la depth esatta: 32000 (Sopra la FoW a 30k e Path Rover a 31k)
    const dropDepth = (y - x * 0.001) + 32000;
    drop.setDepth(dropDepth);

    this.tweens.add({
      targets: drop,
      y: y,
      duration: 6000,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        // --- EFFETTO RETRO-PROPULSORI ---
        if (Math.random() > 0.15) {
          const px = drop.x + Phaser.Math.Between(-4, 4);
          const py = drop.y + (drop.displayHeight / 2) - 15;

          const colors = [0x58a6ff, 0x00ffff, 0xffffff];
          const color = Phaser.Utils.Array.GetRandom(colors);

          const particle = this.add.circle(px, py, Phaser.Math.Between(0.5, 1.5), color, 0.8);
          particle.setDepth(dropDepth - 1); // Subito dietro la cassa

          this.tweens.add({
            targets: particle,
            y: py + Phaser.Math.Between(15, 40),
            x: px + Phaser.Math.Between(-10, 10),
            alpha: 0,
            scale: 0.1,
            duration: Phaser.Math.Between(400, 800),
            ease: 'Power1',
            onComplete: () => particle.destroy()
          });
        }
      },
      onComplete: () => {
        drop.setDepth(dropDepth);
        this.pois.push({ type: 'supply', col: target.c, row: target.r, sprite: drop, reward: SUPPLY_DROP_COMPONENTS });

        this._showFloatingText(target.c, target.r, "SUPPLY DROP SECURED", true);

        // --- NUVOLA DI POLVERE SOTTILE ---
        for (let i = 0; i < 15; i++) {
          const dx = drop.x + Phaser.Math.Between(-15, 15);
          // Origine alzata di base
          const dy = drop.y - Phaser.Math.Between(8, 16);
          const dust = this.add.circle(dx, dy, Phaser.Math.Between(1, 2.5), 0xaaaaaa, 0.4);
          dust.setDepth(dropDepth - 1);

          this.tweens.add({
            targets: dust,
            // La polvere fluttua ancora più in alto
            y: dy - Phaser.Math.Between(15, 25),
            x: dx + Phaser.Math.Between(-8, 8),
            alpha: 0,
            scale: 2,
            duration: Phaser.Math.Between(800, 1200),
            ease: 'Power2',
            onComplete: () => dust.destroy()
          });
        }
      }
    });
  }

  shutdown() {
    this._domAbortController?.abort();
    this._emitter?.removeAllListeners();
    this._supplyDropEvent?.remove(false);
  }

}
