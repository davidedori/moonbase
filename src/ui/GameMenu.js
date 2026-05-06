// =============================================================================
// GameMenu — menu in-game (pausa).
//
// Contiene: info account, salva partita, carica partita, login/logout.
// Segue il pattern overlay di SaveSlotMenu (double-RAF fade, glass panel).
// =============================================================================

import { SaveSlotMenu } from './SaveSlotMenu.js';
import { AuthModal } from './AuthModal.js';

export class GameMenu {
  /**
   * @param {{
   *   saveManager: import('../systems/SaveManager.js').SaveManager,
   *   authManager: import('../systems/AuthManager.js').AuthManager,
   *   onClose: () => void,
   *   onSaveAction: (slotId: string, saveName?: string) => void,
   *   onLoadAction: (slotId: string) => void,
   * }} opts
   */
  constructor({ saveManager, authManager, onClose, onSaveAction, onLoadAction }) {
    this._saveManager = saveManager;
    this._auth = authManager;
    this._onClose = onClose;
    this._onSaveAction = onSaveAction;
    this._onLoadAction = onLoadAction;
    this._el = null;
  }

  // ── API pubblica ─────────────────────────────────────────────────────────────

  show() {
    if (this._el) return;
    const el = document.createElement('div');
    el.id = 'game-menu-overlay';
    document.body.appendChild(el);
    this._el = el;

    el.addEventListener('click', (e) => { if (e.target === el) this._close(); });
    this._render();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('game-menu-visible')));
  }

  hide(cb) {
    if (!this._el) { cb?.(); return; }
    this._el.classList.remove('game-menu-visible');
    this._el.addEventListener('transitionend', () => {
      this._el?.remove();
      this._el = null;
      cb?.();
    }, { once: true });
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  _render() {
    const isLoggedIn = this._auth?.isLoggedIn ?? false;
    const email = this._auth?.user?.email ?? '';

    const userSection = isLoggedIn
      ? `<div class="gm-user-row">
           <div class="gm-user-icon"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
           <span class="gm-user-email">${this._escape(email)}</span>
         </div>`
      : `<div class="gm-user-row gm-user-row--guest">
           <div class="gm-user-icon"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
           <span class="gm-user-guest">OSPITE — salvataggio non disponibile</span>
         </div>`;

    this._el.innerHTML = `
      <div class="game-menu-panel">
        <div class="game-menu-header">
          <button class="ghost-btn gm-close-btn" id="gm-close">✕</button>
          <span class="game-menu-title">MENU</span>
        </div>

        <div class="gm-section">
          ${userSection}
        </div>

        <div class="gm-divider"></div>

        <div class="gm-section gm-actions">
          <button class="gm-btn" id="gm-save">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            SALVA PARTITA
          </button>
          <button class="gm-btn${isLoggedIn ? '' : ' gm-btn--disabled'}" id="gm-load" ${isLoggedIn ? '' : 'disabled'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CARICA PARTITA
          </button>
        </div>

        <div class="gm-divider"></div>

        <div class="gm-section gm-actions">
          ${isLoggedIn
            ? `<button class="gm-btn gm-btn--danger" id="gm-logout">
                 <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                 LOGOUT
               </button>`
            : `<button class="gm-btn gm-btn--accent" id="gm-login">
                 <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                 ACCEDI / REGISTRATI
               </button>`
          }
        </div>
      </div>
    `;

    this._el.querySelector('#gm-close').addEventListener('click', () => this._close());

    this._el.querySelector('#gm-save').addEventListener('click', () => this._openSave());
    this._el.querySelector('#gm-load').addEventListener('click', () => { if (isLoggedIn) this._openLoad(); });

    if (isLoggedIn) {
      this._el.querySelector('#gm-logout').addEventListener('click', () => {
        this._auth.logout();
        this._close();
      });
    } else {
      this._el.querySelector('#gm-login').addEventListener('click', () => {
        const modal = new AuthModal({
          authManager: this._auth,
          onSuccess: () => this._render(), // re-render con stato loggato
          onClose: () => {},
        });
        modal.show();
      });
    }
  }

  // ── Azioni ───────────────────────────────────────────────────────────────────

  _openSave() {
    this.hide(() => {
      const slotMenu = new SaveSlotMenu({
        saveManager: this._saveManager,
        authManager: this._auth,
        mode: 'save',
        onClose: () => { slotMenu.hide(() => this._onClose()); },
        onAction: (slotId, saveName) => {
          this._onSaveAction(slotId, saveName);
          slotMenu.hide(() => this._onClose());
        },
      });
      slotMenu.show();
    });
  }

  _openLoad() {
    this.hide(() => {
      const slotMenu = new SaveSlotMenu({
        saveManager: this._saveManager,
        authManager: this._auth,
        mode: 'load',
        onClose: () => { slotMenu.hide(() => this._onClose()); },
        onAction: (slotId) => {
          slotMenu.hide(() => this._onLoadAction(slotId));
        },
      });
      slotMenu.show();
    });
  }

  _close() {
    this.hide(() => this._onClose());
  }

  _escape(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// ── Stili inline ─────────────────────────────────────────────────────────────

(function injectStyles() {
  if (document.getElementById('game-menu-styles')) return;
  const style = document.createElement('style');
  style.id = 'game-menu-styles';
  style.textContent = `
    #game-menu-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.72);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
    }
    #game-menu-overlay.game-menu-visible {
      opacity: 1;
      pointer-events: auto;
    }

    .game-menu-panel {
      background: rgba(10,12,16,0.97);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(240,240,250,0.12);
      border-radius: 4px;
      padding: 24px 28px 28px;
      width: 90vw;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .game-menu-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
    }
    .gm-close-btn {
      font-size: 0.72rem !important;
      padding: 3px 8px !important;
    }
    .game-menu-title {
      font-family: 'Space Mono', monospace;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--white, #f0f0fa);
    }

    .gm-divider {
      height: 1px;
      background: rgba(240,240,250,0.07);
      margin: 10px 0;
    }

    .gm-section {
      padding: 4px 0;
    }

    .gm-user-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }
    .gm-user-icon {
      color: rgba(240,240,250,0.40);
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .gm-user-email {
      font-family: 'Space Mono', monospace;
      font-size: 0.60rem;
      color: rgba(240,240,250,0.55);
      letter-spacing: 0.04em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .gm-user-row--guest .gm-user-icon {
      color: rgba(240,240,250,0.20);
    }
    .gm-user-guest {
      font-family: 'Space Mono', monospace;
      font-size: 0.58rem;
      letter-spacing: 0.06em;
      color: rgba(240,240,250,0.25);
    }

    .gm-actions {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .gm-btn {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 100%;
      background: none;
      border: none;
      font-family: 'Space Mono', monospace;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      color: rgba(240,240,250,0.70);
      padding: 10px 8px;
      border-radius: 3px;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
      text-align: left;
    }
    .gm-btn svg { flex-shrink: 0; }
    .gm-btn:hover {
      background: rgba(240,240,250,0.06);
      color: var(--white, #f0f0fa);
    }
    .gm-btn--disabled {
      opacity: 0.25;
      cursor: not-allowed;
    }
    .gm-btn--danger {
      color: rgba(220,100,100,0.75);
    }
    .gm-btn--danger:hover {
      background: rgba(220,60,60,0.08);
      color: rgb(230,110,110);
    }
    .gm-btn--accent {
      color: rgba(140,200,255,0.80);
    }
    .gm-btn--accent:hover {
      background: rgba(100,160,255,0.07);
      color: rgb(160,210,255);
    }
  `;
  document.head.appendChild(style);
})();
