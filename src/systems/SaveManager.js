// =============================================================================
// SaveManager — orchestratore centrale del sistema di salvataggio.
//
// Serializzazione, slot CRUD, autosave.
// Dipende da un StorageAdapter (LocalStorageAdapter ora, SupabaseAdapter dopo).
// =============================================================================

import { BUILDINGS_INFO, TILE_W, TILE_H } from '../constants.js';

export class SaveManager {
  static SLOT_IDS = ['autosave', 'slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5'];
  static SAVE_VERSION = 1;
  static AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000; // 3 minuti

  constructor(adapter) {
    this._adapter = adapter;
    this._autosaveTimer = null;
  }

  // ── Serializzazione ──────────────────────────────────────────────────────────

  /**
   * Costruisce l'oggetto SaveData completo leggendo lo stato dalla scena.
   * @param {import('../scenes/MoonbaseScene.js').MoonbaseScene} scene
   * @param {string} [saveName]
   * @returns {object} SaveData
   */
  buildSaveData(scene, saveName = null) {
    const eco = scene.economy;
    const GRID_SIZE = scene.terrainGrid.length;

    // Terrain compresso: solo tile non-NORMAL
    const terrain = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const t = scene.terrainGrid[r][c];
        if (t !== 'normal') terrain.push({ r, c, t });
      }
    }

    // Explored: array piatto di coordinate
    const explored = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (scene.exploredTiles[r][c]) explored.push({ col: c, row: r });
      }
    }

    return {
      version: SaveManager.SAVE_VERSION,
      savedAt: new Date().toISOString(),
      meta: {
        saveName: saveName ?? `Partita — Giorno ${eco.stats?.totalDaysElapsed ?? 0}`,
        lunarDay: eco.stats?.totalDaysElapsed ?? 0,
        buildingCount: scene.buildings.length,
        roverCount: scene.rovers.length,
        missionStep: scene.missionControl?.step ?? 0,
      },
      economy: {
        regolith: eco.regolith,
        ice: eco.ice,
        oxygen: eco.oxygen,
        components: eco.components,
        energyStored: eco.energyStored,
        isDay: eco.isDay,
        emergencyTimer: eco.emergencyTimer,
        deadlockTimer: eco.deadlockTimer,
        _solarFlareTicksRemaining: eco._solarFlareTicksRemaining ?? 0,
        _extendedEclipseMultiplier: eco._extendedEclipseMultiplier ?? 1,
        stats: { ...(eco.stats ?? {}) },
      },
      buildings: scene.buildings.map((b) => ({
        type: b.type,
        col: b.col,
        row: b.row,
        isPowered: b.isPowered ?? true,
        isConstructing: b.isConstructing ?? false,
        buildProgress: b.buildProgress ?? 0,
        isDamaged: b.isDamaged ?? false,
        connected: b.connected ?? true,
      })),
      rovers: scene.rovers.map((r) => ({
        col: r.col,
        row: r.row,
        charge: r.charge,
        durability: r.durability ?? 100,
        isWreck: r.isWreck ?? false,
        isPowered: r.isPowered ?? true,
      })),
      missionStep: scene.missionControl?.step ?? 0,
      terrain,
      explored,
      capacityGrid: scene.capacityGrid,
      // Nomi delle formazioni geografiche (ridge, crater, regolith) — salvati sparse
      terrainNames: (() => {
        const out = [];
        const grid = scene.terrainNamesGrid;
        if (!grid) return out;
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c]) out.push({ r, c, name: grid[r][c] });
          }
        }
        return out;
      })(),
      // Crateri quadrati con nome (serve a _drawNaturalTerrainElements)
      squareCraters: (scene.squareCraters ?? []).map((cr) => ({
        row: cr.row, col: cr.col, size: cr.size, name: cr.name ?? '',
      })),
    };
  }

  /**
   * Ripristina lo stato della scena da un SaveData.
   * Rifattorizzazione di MoonbaseScene.loadGameState() senza logica localStorage.
   * @param {import('../scenes/MoonbaseScene.js').MoonbaseScene} scene
   * @param {object} saveData
   */
  applyLoadData(scene, saveData) {
    const data = this._migrate(saveData);
    const GRID_SIZE = scene.terrainGrid.length;

    // --- 1. Distruggi edifici esistenti ---
    scene.buildings.forEach((b) => {
      if (b._armSprites) {
        Object.values(b._armSprites).forEach((s) => s?.destroy());
        Object.values(b._armShadows ?? {}).forEach((s) => s?.destroy());
      }
      b.gfx?.destroy();
      b._shadow?.destroy();
    });
    scene.buildings.length = 0;

    // --- 2. Distruggi rover esistenti ---
    scene._deselectRover?.();
    scene.rovers.forEach((r) => {
      r._moveTween?.stop();
      r._engineTween?.stop();
      r._chargeBar?.destroy();
      r.destroy();
    });
    scene.rovers.length = 0;

    // --- 3. Reset griglie, shadow e fog ---
    scene.isGamePaused = false;
    scene.districts.length = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        scene.occupiedTiles[r][c] = false;
        scene.exploredTiles[r][c] = false;
        scene.districtGrid[r][c] = null;
        scene._setTileShadow(c, r, false);

        const prevMask = scene.fogEdgeMasks?.[r]?.[c];
        if (prevMask) { prevMask.destroy(); scene.fogEdgeMasks[r][c] = null; }

        const fogGfx = scene.fogGraphics[r]?.[c];
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

    // --- 3b. Ripristina esplorazione (PRIMA del terreno, così _drawNaturalTerrainElements vede exploredTiles corretti) ---
    for (const { col, row } of (data.explored ?? [])) {
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        scene.exploredTiles[row][col] = true;
        scene.fogGraphics[row]?.[col]?.clear();
      }
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        scene._refreshFogEdgeAt?.(r, c);
      }
    }

    // --- 3c. Ripristina terreno ---
    if (data.terrain) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) scene.terrainGrid[r][c] = 'normal';
      }
      for (const { r, c, t } of data.terrain) {
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) scene.terrainGrid[r][c] = t;
      }

      // Ripristina terrainNamesGrid (nomi formazioni geografiche)
      scene.terrainNamesGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
      for (const { r, c, name } of (data.terrainNames ?? [])) {
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) scene.terrainNamesGrid[r][c] = name;
      }

      // Ripristina squareCraters con nomi (salvati) oppure derivali dal terreno (fallback)
      if (data.squareCraters?.length) {
        scene.squareCraters = data.squareCraters.map((cr) => ({ ...cr }));
      } else {
        // Fallback per save vecchi senza squareCraters: deriva dalla griglia (senza nomi)
        scene.squareCraters = [];
        const visited = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (scene.terrainGrid[r][c] === 'crater' && !visited[r][c]) {
              let size = 0;
              while (c + size < GRID_SIZE && scene.terrainGrid[r][c + size] === 'crater' && !visited[r][c + size]) size++;
              for (let dr = 0; dr < size; dr++) {
                for (let dc = 0; dc < size; dc++) {
                  if (r + dr < GRID_SIZE && c + dc < GRID_SIZE) visited[r + dr][c + dc] = true;
                }
              }
              scene.squareCraters.push({ row: r, col: c, size, name: '' });
            }
          }
        }
      }

      scene._deriveDepositGroupsFromTerrain?.();

      // Ricrea decal risorse (ice/regolith)
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (scene.tileResourceGraphics[r]?.[c]) {
            scene.tileResourceGraphics[r][c].destroy();
            scene.tileResourceGraphics[r][c] = null;
          }
        }
      }
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const terrain = scene.terrainGrid[r][c];
          if (terrain === 'ice' || terrain === 'regolith') {
            scene.tileResourceGraphics[r][c] = scene._createResourceDecal(c, r, terrain);
          }
        }
      }

      // Distruggi vecchi terrainProps e ridisegna tutto (rocce, crateri small, ridge, crater-big)
      if (scene.terrainProps) scene.terrainProps.forEach((p) => p.destroy());
      scene.terrainProps = [];
      scene._spawnRocks?.();
      scene._spawnCraters?.();
      scene._drawNaturalTerrainElements?.(); // ridge sprites, crater-big, etichette
    }

    // --- 4. Ripristina economia ---
    const eco = data.economy;
    scene.economy.regolith = eco.regolith;
    scene.economy.ice = eco.ice;
    scene.economy.oxygen = eco.oxygen;
    scene.economy.components = eco.components ?? 40;
    scene.economy.syncDayNight(eco.isDay);
    scene.economy.emergencyTimer = eco.emergencyTimer ?? 0;
    scene.economy.deadlockTimer = eco.deadlockTimer ?? 0;
    if (eco.energyStored !== undefined) scene.economy.energyStored = eco.energyStored;
    if (eco._solarFlareTicksRemaining !== undefined) {
      scene.economy._solarFlareTicksRemaining = eco._solarFlareTicksRemaining;
    }
    if (eco._extendedEclipseMultiplier !== undefined) {
      scene.economy._extendedEclipseMultiplier = eco._extendedEclipseMultiplier;
    }
    if (eco.stats) {
      Object.assign(scene.economy.stats, eco.stats);
    }

    // --- 5. Ripristina edifici (piazzamento silente) ---
    scene._silentLoad = true;
    for (const b of (data.buildings ?? [])) {
      const info = BUILDINGS_INFO[b.type] ?? {};
      scene._placeBuildingGraphics(b.col, b.row, b.type);
      const placed = scene.buildings[scene.buildings.length - 1];
      placed.isPowered = b.isPowered ?? true;
      placed.isConstructing = b.isConstructing ?? false;
      placed.buildProgress = b.buildProgress ?? 0;
      placed.isDamaged = b.isDamaged ?? false;
      placed.connected = b.connected ?? true;
      if (!info?.isPassable) scene.occupiedTiles[b.row][b.col] = true;
      scene._setTileShadow(b.col, b.row, true);
    }
    scene._silentLoad = false;

    // --- 5b. Riavvia tween costruzione per edifici in-progress ---
    for (const b of scene.buildings) {
      if (!b.isConstructing) continue;
      const progress = b.buildProgress ?? 0;
      const remaining = Math.max((1 - progress) * 80000, 100);
      b.buildTween = scene.tweens.add({
        targets: b,
        buildProgress: 1,
        duration: remaining,
        onComplete: () => {
          b.isConstructing = false;
          scene._updateNetworkConnectivity?.();
          scene.economy.updateProjections?.();
        },
      });
    }

    // --- 6. Ricostruisci distretti e condotti ---
    scene._reconstructDistricts();
    for (const b of scene.buildings) {
      if (b.type === 'conduit') {
        scene._redrawConduitAt?.(b.col, b.row);
        scene._updateAdjacentConduitsGraphics?.(b.col, b.row);
      }
    }

    // --- 7. Connettività rete e capacityGrid ---
    scene._updateNetworkConnectivity();
    if (data.capacityGrid) scene.capacityGrid = data.capacityGrid;

    // --- 8. Ripristina rover ---
    for (const rv of (data.rovers ?? [])) {
      const rover = scene._createRover(rv.col, rv.row);
      rover.charge = rv.charge;
      rover.durability = rv.durability ?? 100;
      if (rv.isWreck) {
        rover.breakDown();
      } else {
        rover.isPowered = rv.isPowered ?? true;
        rover._lastPoweredState = null;
        rover._applyVisuals?.();
      }
      rover._updateChargeBar?.();
    }

    // --- 9. MissionControl step ---
    if (scene.missionControl && data.missionStep !== undefined) {
      scene.missionControl.step = data.missionStep;
    }

    // --- 11. Aggiorna UI ---
    scene.economy.updateProjections();
    scene._centerCameraOnGrid();
  }

  // ── CRUD slot ────────────────────────────────────────────────────────────────

  /**
   * @param {string} slotId
   * @param {import('../scenes/MoonbaseScene.js').MoonbaseScene} scene
   * @param {string} [saveName]
   */
  async saveToSlot(slotId, scene, saveName = null) {
    const data = this.buildSaveData(scene, saveName);
    await this._adapter.writeSlot(slotId, data);
    console.info(`[SaveManager] Salvato in ${slotId}`);
  }

  /**
   * @param {string} slotId
   * @param {import('../scenes/MoonbaseScene.js').MoonbaseScene} scene
   */
  async loadFromSlot(slotId, scene) {
    const data = await this._adapter.readSlot(slotId);
    if (!data) {
      console.warn(`[SaveManager] Slot ${slotId} vuoto o non trovato`);
      return;
    }
    this.applyLoadData(scene, data);
    console.info(`[SaveManager] Caricato da ${slotId}`);
  }

  /** @param {string} slotId */
  async deleteSlot(slotId) {
    await this._adapter.deleteSlot(slotId);
  }

  /** @returns {Promise<import('../systems/StorageAdapter.js').SlotMeta[]>} */
  async listSlots() {
    return this._adapter.listSlots();
  }

  /** Versione sincrona per il render del MainMenu */
  hasAutosaveSync() {
    return this._adapter.hasAutosaveSync?.() ?? false;
  }

  // ── Autosave ─────────────────────────────────────────────────────────────────

  /**
   * Avvia il timer di autosave.
   * @param {import('../scenes/MoonbaseScene.js').MoonbaseScene} scene
   */
  startAutosave(scene) {
    this.stopAutosave();
    this._autosaveTimer = setInterval(async () => {
      if (scene.isGameOver || scene.isGamePaused) return;
      await this.saveToSlot('autosave', scene);
      // Notifica silenziosa nell'UI se disponibile
      scene.ui?.showToast?.('Partita salvata automaticamente');
    }, SaveManager.AUTOSAVE_INTERVAL_MS);
  }

  stopAutosave() {
    if (this._autosaveTimer) {
      clearInterval(this._autosaveTimer);
      this._autosaveTimer = null;
    }
  }

  // ── Migrazione formato ───────────────────────────────────────────────────────

  /**
   * Dispatcher versioni. v1 → noop. Future versioni: transform.
   * @param {object} rawData
   * @returns {object} SaveData normalizzato
   */
  _migrate(rawData) {
    if (!rawData.version || rawData.version === 1) return rawData;
    // Future: if (rawData.version === 2) return migrateV2toV1(rawData);
    console.warn(`[SaveManager] Versione save sconosciuta: ${rawData.version}`);
    return rawData;
  }
}
