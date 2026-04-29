const MIN_DURATION = 3800; // ms di display minimo garantito

export class LoadingScreen {
  constructor() {
    this._el = null;
    this._bar = null;
    this._startTime = 0;
    this._loaderDone = false;
    this._timeDone = false;
    this._onReady = null;
  }

  show(onReady) {
    this._onReady = onReady;
    this._startTime = Date.now();
    this._loaderDone = false;
    this._timeDone = false;

    const el = document.createElement('div');
    el.id = 'loading-overlay';
    el.innerHTML = `
      <div class="loading-logo">MOONBASE</div>
      <div class="loading-bar-wrap">
        <div class="loading-bar-fill" id="loading-bar-fill"></div>
      </div>
      <div class="loading-label">LOADING</div>
    `;
    document.body.appendChild(el);
    this._el = el;
    this._bar = el.querySelector('#loading-bar-fill');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('loading-visible');
      this._animateBar();
    }));

    // Timer minimo: segna il tempo come "scaduto" e prova a completare
    setTimeout(() => {
      this._timeDone = true;
      this._tryComplete();
    }, MIN_DURATION);
  }

  // Aggancia gli eventi di progresso al LoaderPlugin di Phaser.
  trackLoader(loader) {
    if (!loader) {
      this._loaderDone = true;
      this._tryComplete();
      return;
    }
    loader.on('complete', () => {
      this._loaderDone = true;
      this._tryComplete();
    });
  }

  // ── Privati ──────────────────────────────────────────────────────────────────

  // Anima la barra da 0 a 95% nel tempo MIN_DURATION (ease-out)
  _animateBar() {
    const tick = () => {
      if (!this._el) return;
      const t = Math.min((Date.now() - this._startTime) / MIN_DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 2); // ease-out quadratico
      this._setProgress(eased * 0.95);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _setProgress(value) {
    if (this._bar) this._bar.style.width = `${Math.round(value * 100)}%`;
  }

  _tryComplete() {
    if (!this._loaderDone || !this._timeDone) return;
    // Barra a 100%, poi breve pausa, poi fade-out
    this._setProgress(1);
    setTimeout(() => this._hide(), 400);
  }

  _hide() {
    if (!this._el) return;
    this._el.classList.add('loading-out');
    setTimeout(() => {
      this._el?.remove();
      this._el = null;
      this._onReady?.();
    }, 1300);
  }
}
