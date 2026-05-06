// =============================================================================
// SupabaseAdapter — implementa la stessa interfaccia di LocalStorageAdapter
// ma persiste i salvataggi nel DB Supabase.
//
// Schema atteso (tabella public.saves):
//   id, user_id, slot_id, save_name, saved_at, lunar_day,
//   building_count, rover_count, payload (jsonb)
// =============================================================================

export class SupabaseAdapter {
  constructor(supabaseClient) {
    this._client = supabaseClient;
    // Cache usata da hasAutosaveSync() (valorizzata dopo listSlots)
    this._hasAutosaveCache = false;
  }

  // ── API pubblica ─────────────────────────────────────────────────────────────

  /** @returns {Promise<import('./StorageAdapter.js').SlotMeta[]>} */
  async listSlots() {
    const { data, error } = await this._client
      .from('saves')
      .select('slot_id, save_name, saved_at, lunar_day, building_count, rover_count')
      .order('saved_at', { ascending: false });

    if (error) {
      console.error('[SupabaseAdapter] listSlots error:', error.message);
      return [];
    }

    const slots = (data ?? []).map((row) => ({
      slotId: row.slot_id,
      saveName: row.save_name,
      savedAt: row.saved_at,
      lunarDay: row.lunar_day,
      buildingCount: row.building_count,
      roverCount: row.rover_count,
    }));

    this._hasAutosaveCache = slots.some((s) => s.slotId === 'autosave');
    return slots;
  }

  /** @returns {Promise<object|null>} */
  async readSlot(slotId) {
    const { data, error } = await this._client
      .from('saves')
      .select('payload')
      .eq('slot_id', slotId)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseAdapter] readSlot error:', error.message);
      return null;
    }
    return data?.payload ?? null;
  }

  /** @param {string} slotId @param {object} saveData */
  async writeSlot(slotId, saveData) {
    const { data: { user } } = await this._client.auth.getUser();
    const row = {
      user_id: user.id,
      slot_id: slotId,
      save_name: saveData.meta?.saveName ?? slotId,
      saved_at: saveData.savedAt ?? new Date().toISOString(),
      lunar_day: saveData.meta?.lunarDay ?? 0,
      building_count: saveData.meta?.buildingCount ?? 0,
      rover_count: saveData.meta?.roverCount ?? 0,
      payload: saveData,
    };

    const { error } = await this._client
      .from('saves')
      .upsert(row, { onConflict: 'user_id,slot_id' });

    if (error) {
      console.error('[SupabaseAdapter] writeSlot error:', error.message);
      throw error;
    }

    if (slotId === 'autosave') this._hasAutosaveCache = true;
  }

  /** @param {string} slotId */
  async deleteSlot(slotId) {
    const { error } = await this._client
      .from('saves')
      .delete()
      .eq('slot_id', slotId);

    if (error) {
      console.error('[SupabaseAdapter] deleteSlot error:', error.message);
      throw error;
    }

    if (slotId === 'autosave') this._hasAutosaveCache = false;
  }

  /** @returns {Promise<boolean>} */
  async hasAutosave() {
    const { count, error } = await this._client
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', 'autosave');

    if (error) return false;
    this._hasAutosaveCache = (count ?? 0) > 0;
    return this._hasAutosaveCache;
  }

  /** Versione sincrona — usa la cache aggiornata da listSlots/hasAutosave */
  hasAutosaveSync() {
    return this._hasAutosaveCache;
  }
}
