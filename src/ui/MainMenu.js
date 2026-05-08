// =============================================================================
// MainMenu — stack-based navigation menu overlay
//
// Aggiungere una nuova pagina:
//   menu.pages.push({ id: 'my-page', title: 'MY PAGE', render(container) { ... } });
//   menu.push('my-page');
// =============================================================================

import { SaveSlotMenu } from './SaveSlotMenu.js';
import { AuthModal } from './AuthModal.js';

export class MainMenu {
  /**
   * @param {{ onStart: () => void, onContinue?: () => void, onLoadSlot?: (slotId: string) => void, saveManager?: import('../systems/SaveManager.js').SaveManager, authManager?: import('../systems/AuthManager.js').AuthManager }} opts
   */
  constructor({ onStart, onContinue, onLoadSlot, saveManager, authManager = null }) {
    this._onStart = onStart;
    this._onContinue = onContinue ?? onStart;
    this._onLoadSlot = onLoadSlot ?? onStart;
    this._saveManager = saveManager ?? null;
    this._authManager = authManager;
    this._el = null;
    this._stack = [];

    // Registro pagine — aggiungere qui per estendere il menu
    this.pages = [
      {
        id: 'root',
        title: null,
        render: (c) => this._renderRoot(c),
      },
      {
        id: 'load-slots',
        title: 'LOAD GAME',
        render: (c) => this._renderLoadSlots(c),
      },
      {
        id: 'options',
        title: 'OPTIONS',
        render: (c) => this._renderOptions(c),
      },
      {
        id: 'credits',
        title: 'CREDITS',
        render: (c) => this._renderCredits(c),
      },
    ];
  }

  // ── API pubblica ─────────────────────────────────────────────────────────────

  /** Mostra il menu a partire da pageId (default: 'root') */
  show(pageId = 'root') {
    const el = document.createElement('div');
    el.id = 'menu-overlay';
    el.innerHTML = `
      <div class="menu-panel">
        <div class="menu-header">
          <button class="menu-back-btn ghost-btn" id="menu-back-btn" style="display:none;">← BACK</button>
          <span class="menu-page-title" id="menu-page-title"></span>
        </div>
        <div class="menu-brand">MOONBASE</div>
        <div class="menu-content" id="menu-content"></div>
        <div class="menu-footer">v0.1 — EARLY ACCESS</div>
      </div>
    `;
    document.body.appendChild(el);
    this._el = el;

    el.querySelector('#menu-back-btn').addEventListener('click', () => this.pop());

    this._stack = [pageId];
    this._renderPage(pageId);

    // Double RAF: il primo frame processa lo stato iniziale (opacity:0),
    // il secondo avvia la transizione dopo che il browser ha dipinto.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('menu-visible')));
  }

  /** Naviga a una nuova pagina (aggiunge al stack) */
  push(pageId) {
    this._stack.push(pageId);
    this._renderPage(pageId);
  }

  /** Torna alla pagina precedente */
  pop() {
    if (this._stack.length <= 1) return;
    this._stack.pop();
    this._renderPage(this._stack[this._stack.length - 1]);
  }

  /** Nasconde il menu con fade-out, poi chiama onDone */
  hide(onDone) {
    if (!this._el) { onDone?.(); return; }
    this._el.classList.remove('menu-visible');
    setTimeout(() => {
      this._el?.remove();
      this._el = null;
      onDone?.();
    }, 320);
  }

  // ── Rendering interno ────────────────────────────────────────────────────────

  _renderPage(pageId) {
    const page = this.pages.find(p => p.id === pageId);
    if (!page || !this._el) return;

    const content = this._el.querySelector('#menu-content');
    const backBtn = this._el.querySelector('#menu-back-btn');
    const pageTitle = this._el.querySelector('#menu-page-title');

    backBtn.style.display = this._stack.length > 1 ? '' : 'none';
    pageTitle.textContent = page.title ?? '';

    // Fade contenuto durante cambio pagina
    content.style.opacity = '0';
    setTimeout(() => {
      content.innerHTML = '';
      page.render(content);
      content.style.opacity = '1';
    }, 150);
  }

  // ── Pagine built-in ─────────────────────────────────────────────────────────

  _renderRoot(container) {
    const isLoggedIn = this._authManager?.isLoggedIn ?? false;
    const email = this._authManager?.user?.email ?? '';
    const hasAutosave = isLoggedIn
      ? (this._authManager._supabaseAdapter?.hasAutosaveSync() ?? (this._saveManager?.hasAutosaveSync() ?? false))
      : (this._saveManager?.hasAutosaveSync() ?? false);

    const userStrip = isLoggedIn
      ? `<div class="menu-user-strip">
           <span class="menu-user-email">${this._escapeHtml(email)}</span>
           <button class="ghost-btn menu-user-btn" id="menu-btn-logout">LOGOUT</button>
         </div>`
      : `<div class="menu-user-strip">
           <span class="menu-user-guest">GUEST</span>
           <button class="ghost-btn menu-user-btn" id="menu-btn-login">LOG IN / REGISTER</button>
         </div>`;

    let html = userStrip + '<div class="menu-nav-btns">';
    if (hasAutosave) {
      html += `<button class="menu-nav-btn menu-nav-btn--primary" id="menu-btn-continue">CONTINUE</button>`;
    }
    html += `
      <button class="menu-nav-btn" id="menu-btn-newgame">NEW GAME</button>
      <button class="menu-nav-btn${isLoggedIn ? '' : ' menu-nav-btn--disabled'}" id="menu-btn-load" ${isLoggedIn ? '' : 'disabled title="Log in to load a game"'}>LOAD GAME</button>
      <button class="menu-nav-btn" id="menu-btn-options">OPTIONS</button>
      <button class="menu-nav-btn" id="menu-btn-credits">CREDITS</button>
    </div>`;
    container.innerHTML = html;

    if (isLoggedIn) {
      container.querySelector('#menu-btn-logout').addEventListener('click', () => {
        this._authManager.logout();
      });
    } else {
      container.querySelector('#menu-btn-login').addEventListener('click', () => {
        const modal = new AuthModal({
          authManager: this._authManager,
          onSuccess: () => this._rerenderRoot(),
          onClose: () => {},
        });
        modal.show();
      });
    }

    if (hasAutosave) {
      container.querySelector('#menu-btn-continue').addEventListener('click', () => this._onContinue());
    }
    container.querySelector('#menu-btn-newgame').addEventListener('click', () => this._onStart());
    container.querySelector('#menu-btn-load').addEventListener('click', () => this.push('load-slots'));
    container.querySelector('#menu-btn-options').addEventListener('click', () => this.push('options'));
    container.querySelector('#menu-btn-credits').addEventListener('click', () => this.push('credits'));
  }

  _rerenderRoot() {
    if (!this._el || this._stack[this._stack.length - 1] !== 'root') return;
    this._renderPage('root');
  }

  _escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  _renderLoadSlots(container) {
    if (!this._saveManager) {
      container.innerHTML = `<p class="menu-placeholder">— NO SAVE SYSTEM —</p>`;
      return;
    }
    const slotMenu = new SaveSlotMenu({
      saveManager: this._saveManager,
      mode: 'load',
      onClose: () => this.pop(),
      onAction: (slotId) => this._onLoadSlot(slotId),
      authManager: this._authManager,
    });
    slotMenu.renderInline(container);
  }

  _renderOptions(container) {
    container.innerHTML = `<p class="menu-placeholder">— COMING SOON —</p>`;
  }

  _renderCredits(container) {
    container.innerHTML = `
      <p class="menu-placeholder">
        Developed by <a href="https://davidedorigatti.com" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;text-underline-offset:3px;">Davide Dorigatti</a>
      </p>
    `;
  }
}
