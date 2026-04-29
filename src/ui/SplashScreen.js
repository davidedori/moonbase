export class SplashScreen {
  constructor() {
    this._el = null;
  }

  // onDone() viene chiamato dopo che lo splash è uscito di scena
  show(onDone) {
    const el = document.createElement('div');
    el.id = 'splash-overlay';
    el.innerHTML = `
      <div class="splash-title">MOONBASE</div>
      <div class="splash-tagline">Lunar Colony Simulator</div>
    `;
    document.body.appendChild(el);
    this._el = el;

    // Aspetta che Space Mono sia pronto (evita FOUT), poi double RAF
    // per garantire che il browser abbia dipinto opacity:0 prima del fade-in.
    const startFade = () =>
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('splash-visible')));

    if (document.fonts?.ready) {
      document.fonts.ready.then(startFade);
    } else {
      startFade();
    }

    // Dopo 4.8 s avvia il fade-out, poi chiama onDone
    setTimeout(() => {
      el.classList.add('splash-out');
      setTimeout(() => {
        el.remove();
        this._el = null;
        onDone?.();
      }, 1250);
    }, 4800);
  }
}
