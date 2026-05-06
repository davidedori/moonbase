// =============================================================================
// StorageAdapter — pattern adapter per lo storage dei salvataggi.
//
// Contratto async identico per tutti i backend.
// Per aggiungere Supabase: crea SupabaseAdapter con la stessa API pubblica.
// =============================================================================

const NS = 'moonbase_v1';
const KEY_INDEX = `${NS}::index`;
const slotKey = (slotId) => `${NS}::${slotId}`;

/**
 * SlotMeta storato nell'index (leggero, per la UI della lista slot).
 * @typedef {{ slotId: string, saveName: string, savedAt: string, lunarDay: number, buildingCount: number, roverCount: number }} SlotMeta
 */

export class LocalStorageAdapter {
  // ── Lettura index ────────────────────────────────────────────────────────────

  _readIndex() {
    try {
      const raw = localStorage.getItem(KEY_INDEX);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _writeIndex(index) {
    localStorage.setItem(KEY_INDEX, JSON.stringify(index));
  }

  // ── API pubblica (async, stessa firma del futuro SupabaseAdapter) ─────────────

  /** @returns {Promise<SlotMeta[]>} */
  async listSlots() {
    return this._readIndex();
  }

  /** @returns {Promise<object|null>} SaveData o null se il slot è vuoto */
  async readSlot(slotId) {
    try {
      const raw = localStorage.getItem(slotKey(slotId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** @param {string} slotId @param {object} saveData */
  async writeSlot(slotId, saveData) {
    localStorage.setItem(slotKey(slotId), JSON.stringify(saveData));

    const meta = {
      slotId,
      saveName: saveData.meta?.saveName ?? slotId,
      savedAt: saveData.savedAt,
      lunarDay: saveData.meta?.lunarDay ?? 0,
      buildingCount: saveData.meta?.buildingCount ?? 0,
      roverCount: saveData.meta?.roverCount ?? 0,
    };

    const index = this._readIndex();
    const existing = index.findIndex((m) => m.slotId === slotId);
    if (existing >= 0) {
      index[existing] = meta;
    } else {
      index.push(meta);
    }
    this._writeIndex(index);
  }

  /** @param {string} slotId */
  async deleteSlot(slotId) {
    localStorage.removeItem(slotKey(slotId));
    const index = this._readIndex().filter((m) => m.slotId !== slotId);
    this._writeIndex(index);
  }

  /** @returns {Promise<boolean>} */
  async hasAutosave() {
    return localStorage.getItem(slotKey('autosave')) !== null;
  }

  /** Versione sincrona per il render del MainMenu (nessuna await disponibile lì) */
  hasAutosaveSync() {
    return localStorage.getItem(slotKey('autosave')) !== null;
  }

  /**
   * Migra il vecchio salvataggio `moonbase_save` nella lista dinamica se non è già stato importato.
   * Da chiamare una volta all'avvio.
   */
  importLegacySave() {
    const legacy = localStorage.getItem('moonbase_save');
    if (!legacy) return;
    const alreadyImported = this._readIndex().some((m) => m.slotId?.startsWith('save_legacy_'));
    if (alreadyImported) return;

    try {
      const old = JSON.parse(legacy);
      const newId = `save_legacy_${Date.now()}`;
      const saveData = {
        version: 1,
        savedAt: new Date().toISOString(),
        meta: {
          saveName: 'Salvataggio importato',
          lunarDay: old.economy?.stats?.totalDaysElapsed ?? 0,
          buildingCount: old.buildings?.length ?? 0,
          roverCount: old.rovers?.length ?? 0,
          missionStep: 0,
        },
        economy: {
          regolith: old.economy?.regolith ?? 0,
          ice: old.economy?.ice ?? 0,
          oxygen: old.economy?.oxygen ?? 0,
          components: old.economy?.components ?? 0,
          energyStored: old.economy?.energyStored ?? 0,
          isDay: old.economy?.isDay ?? true,
          emergencyTimer: old.economy?.emergencyTimer ?? 0,
          deadlockTimer: old.economy?.deadlockTimer ?? 0,
          _solarFlareTicksRemaining: 0,
          _extendedEclipseMultiplier: 1,
          stats: {
            totalDaysElapsed: old.economy?.stats?.totalDaysElapsed ?? 0,
            o2EmergencyTicks: 0,
            blackoutTicksCount: 0,
            hazardEvents: 0,
            buildingsConstructed: old.buildings?.length ?? 0,
            buildingsDemolished: 0,
          },
        },
        buildings: (old.buildings ?? []).map((b) => ({
          type: b.type,
          col: b.col,
          row: b.row,
          isPowered: b.isPowered ?? true,
          isConstructing: false,
          buildProgress: 0,
          isDamaged: false,
          connected: true,
        })),
        rovers: old.rovers ?? [],
        missionStep: 0,
        terrain: old.terrain ?? [],
        explored: old.explored ?? [],
        capacityGrid: old.capacity ?? [],
      };

      this.writeSlot(newId, saveData);
      console.info('[StorageAdapter] Save legacy importato come', newId);
    } catch (e) {
      console.warn('[StorageAdapter] Import legacy fallito:', e);
    }
  }
}
