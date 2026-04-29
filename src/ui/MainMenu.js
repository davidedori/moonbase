// =============================================================================
// MainMenu — stack-based navigation menu overlay
//
// Aggiungere una nuova pagina:
//   menu.pages.push({ id: 'my-page', title: 'MY PAGE', render(container) { ... } });
//   menu.push('my-page');
// =============================================================================

export class MainMenu {
  /**
   * @param {{ onStart: () => void }} opts
   */
  constructor({ onStart }) {
    this._onStart = onStart;
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
        id: 'options',
        title: 'OPZIONI',
        render: (c) => this._renderOptions(c),
      },
      {
        id: 'credits',
        title: 'CREDITI',
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
    container.innerHTML = `
      <div class="menu-nav-btns">
        <button class="menu-nav-btn" id="menu-btn-newgame">NUOVA PARTITA</button>
        <button class="menu-nav-btn" id="menu-btn-options">OPZIONI</button>
        <button class="menu-nav-btn" id="menu-btn-credits">CREDITI</button>
      </div>
    `;
    container.querySelector('#menu-btn-newgame').addEventListener('click', () => this._onStart());
    container.querySelector('#menu-btn-options').addEventListener('click', () => this.push('options'));
    container.querySelector('#menu-btn-credits').addEventListener('click', () => this.push('credits'));
  }

  _renderOptions(container) {
    container.innerHTML = `<p class="menu-placeholder">— COMING SOON —</p>`;
  }

  _renderCredits(container) {
    container.innerHTML = `
      <p class="menu-placeholder">
        Sviluppato da Davide Dorigatti
      </p>
    `;
  }
}
