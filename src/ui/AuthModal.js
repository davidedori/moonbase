// =============================================================================
// AuthModal — modal di login/registrazione.
//
// Segue esattamente il pattern di SaveSlotMenu:
// overlay full-screen, double-RAF fade, glass panel, ghost-btn, Space Mono.
// Due tab: LOGIN / REGISTRATI. Nessuna navigazione né reload.
// =============================================================================

export class AuthModal {
  /**
   * @param {{ authManager: import('../systems/AuthManager.js').AuthManager, onSuccess?: (user: object) => void, onClose?: () => void }} opts
   */
  constructor({ authManager, onSuccess, onClose }) {
    this._auth = authManager;
    this._onSuccess = onSuccess ?? (() => {});
    this._onClose = onClose ?? (() => {});
    this._el = null;
    this._mode = 'login'; // 'login' | 'register'
  }

  // ── API pubblica ─────────────────────────────────────────────────────────────

  show() {
    if (this._el) return;
    const el = document.createElement('div');
    el.id = 'auth-modal-overlay';
    document.body.appendChild(el);
    this._el = el;

    el.addEventListener('click', (e) => { if (e.target === el) this._close(); });
    this._renderPanel();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('auth-modal-visible')));
  }

  hide(cb) {
    if (!this._el) { cb?.(); return; }
    this._el.classList.remove('auth-modal-visible');
    this._el.addEventListener('transitionend', () => {
      this._el?.remove();
      this._el = null;
      cb?.();
    }, { once: true });
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  _renderPanel() {
    if (!this._el) return;
    this._el.innerHTML = `
      <div class="auth-panel">
        <div class="auth-header">
          <button class="ghost-btn auth-close-btn" id="auth-close">✕</button>
          <span class="auth-title">ACCOUNT</span>
        </div>
        <div class="auth-tabs">
          <button class="auth-tab ${this._mode === 'login' ? 'auth-tab--active' : ''}" data-mode="login">ACCEDI</button>
          <button class="auth-tab ${this._mode === 'register' ? 'auth-tab--active' : ''}" data-mode="register">REGISTRATI</button>
        </div>
        <div class="auth-body" id="auth-body"></div>
        <div class="auth-error" id="auth-error" style="display:none"></div>
      </div>
    `;

    this._el.querySelector('#auth-close').addEventListener('click', () => this._close());
    this._el.querySelectorAll('.auth-tab').forEach((btn) => {
      btn.addEventListener('click', () => this._switchMode(btn.dataset.mode));
    });

    this._renderForm();
  }

  _renderForm() {
    const body = this._el?.querySelector('#auth-body');
    if (!body) return;

    const isRegister = this._mode === 'register';
    body.innerHTML = `
      <form class="auth-form" id="auth-form" autocomplete="on">
        <div class="auth-field">
          <label class="auth-label" for="auth-email">EMAIL</label>
          <input class="auth-input" id="auth-email" type="email" autocomplete="email"
            placeholder="nome@esempio.com" required />
        </div>
        <div class="auth-field">
          <label class="auth-label" for="auth-password">PASSWORD</label>
          <input class="auth-input" id="auth-password" type="password"
            autocomplete="${isRegister ? 'new-password' : 'current-password'}"
            placeholder="${isRegister ? 'Almeno 6 caratteri' : '••••••••'}" required />
        </div>
        <button class="ghost-btn auth-submit-btn" type="submit" id="auth-submit">
          ${isRegister ? 'CREA ACCOUNT' : 'ACCEDI'}
        </button>
      </form>
    `;

    body.querySelector('#auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = body.querySelector('#auth-email').value.trim();
      const password = body.querySelector('#auth-password').value;
      this._handleSubmit(email, password);
    });
  }

  _switchMode(mode) {
    if (this._mode === mode) return;
    this._mode = mode;
    this._renderPanel();
  }

  _close() {
    this.hide(() => this._onClose());
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async _handleSubmit(email, password) {
    this._setLoading(true);
    this._showError(null);

    const { error } = this._mode === 'register'
      ? await this._auth.register(email, password)
      : await this._auth.login(email, password);

    this._setLoading(false);

    if (error) {
      this._showError(this._friendlyError(error));
      return;
    }

    this.hide(() => this._onSuccess(this._auth.user));
  }

  _setLoading(on) {
    const btn = this._el?.querySelector('#auth-submit');
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? '...' : (this._mode === 'register' ? 'CREA ACCOUNT' : 'ACCEDI');
  }

  _showError(msg) {
    const el = this._el?.querySelector('#auth-error');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }

  _friendlyError(error) {
    const msg = error?.message ?? '';
    if (msg.includes('Invalid login credentials')) return 'Email o password errati.';
    if (msg.includes('Email not confirmed')) return 'Controlla la tua email per confermare l\'account.';
    if (msg.includes('User already registered')) return 'Email già registrata — prova ad accedere.';
    if (msg.includes('Password should be at least')) return 'La password deve essere di almeno 6 caratteri.';
    if (msg.includes('Unable to validate email address')) return 'Indirizzo email non valido.';
    return msg || 'Errore di connessione. Riprova.';
  }
}

// ── Stili inline ─────────────────────────────────────────────────────────────

(function injectStyles() {
  if (document.getElementById('auth-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'auth-modal-styles';
  style.textContent = `
    #auth-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.82);
      z-index: 6200;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    #auth-modal-overlay.auth-modal-visible {
      opacity: 1;
      pointer-events: auto;
    }

    .auth-panel {
      background: rgba(12,15,20,0.97);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(240,240,250,0.12);
      border-radius: 4px;
      padding: 28px 36px 32px;
      width: 90vw;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .auth-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .auth-close-btn {
      font-size: 0.75rem !important;
      padding: 4px 8px !important;
    }
    .auth-title {
      font-family: 'Space Mono', monospace;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--white, #f0f0fa);
    }

    .auth-tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid rgba(240,240,250,0.10);
    }
    .auth-tab {
      font-family: 'Space Mono', monospace;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(240,240,250,0.35);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      padding: 6px 14px 10px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -1px;
    }
    .auth-tab:hover {
      color: rgba(240,240,250,0.65);
    }
    .auth-tab--active {
      color: var(--white, #f0f0fa);
      border-bottom-color: var(--white, #f0f0fa);
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .auth-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .auth-label {
      font-family: 'Space Mono', monospace;
      font-size: 0.56rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(240,240,250,0.45);
    }
    .auth-input {
      font-family: 'Space Mono', monospace;
      font-size: 0.72rem;
      color: var(--white, #f0f0fa);
      background: rgba(240,240,250,0.04);
      border: 1px solid rgba(240,240,250,0.14);
      border-radius: 3px;
      padding: 9px 12px;
      outline: none;
      transition: border-color 0.15s;
    }
    .auth-input:focus {
      border-color: rgba(240,240,250,0.40);
    }
    .auth-input::placeholder {
      color: rgba(240,240,250,0.20);
    }

    .auth-submit-btn {
      margin-top: 4px;
      font-size: 0.65rem !important;
      font-weight: 700 !important;
      letter-spacing: 0.12em !important;
      padding: 10px 0 !important;
      width: 100%;
      text-align: center;
      justify-content: center;
    }
    .auth-submit-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .auth-error {
      font-family: 'Space Mono', monospace;
      font-size: 0.62rem;
      color: rgba(220,100,100,0.90);
      letter-spacing: 0.04em;
      line-height: 1.5;
      padding: 8px 10px;
      border: 1px solid rgba(220,60,60,0.25);
      border-radius: 3px;
      background: rgba(220,60,60,0.06);
    }
  `;
  document.head.appendChild(style);
})();
