// =============================================================================
// AuthManager — gestione auth Supabase (login, register, logout, sessione).
//
// Wrappa supabase.auth con un'interfaccia semplice. La sessione è persistita
// automaticamente dal SDK in localStorage (sb-<ref>-auth-token).
// =============================================================================

export class AuthManager {
  constructor(supabaseClient) {
    this._client = supabaseClient;
    this._user = null;
    this._listeners = [];
    this.cachedHasAutosave = false;
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  async init() {
    const { data: { session } } = await this._client.auth.getSession();
    this._user = session?.user ?? null;

    this._client.auth.onAuthStateChange((_event, session) => {
      this._user = session?.user ?? null;
      this._notifyListeners(this._user);
    });
  }

  // ── API pubblica ─────────────────────────────────────────────────────────────

  get user() { return this._user; }
  get isLoggedIn() { return this._user !== null; }

  /** @returns {Promise<{ error: import('@supabase/supabase-js').AuthError|null }>} */
  async register(email, password) {
    const { error } = await this._client.auth.signUp({ email, password });
    return { error };
  }

  /** @returns {Promise<{ error: import('@supabase/supabase-js').AuthError|null }>} */
  async login(email, password) {
    const { error } = await this._client.auth.signInWithPassword({ email, password });
    return { error };
  }

  async logout() {
    await this._client.auth.signOut();
  }

  /** @param {(user: object|null) => void} cb */
  onAuthChange(cb) {
    this._listeners.push(cb);
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  _notifyListeners(user) {
    for (const cb of this._listeners) cb(user);
  }
}
