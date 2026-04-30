// =============================================================================
// MOONBASE — main.js (Entry Point)
// Flusso: SplashScreen → MainMenu → MoonbaseScene
// =============================================================================

import { MoonbaseScene } from './scenes/MoonbaseScene.js';
import { SplashScreen } from './ui/SplashScreen.js';
import { MainMenu } from './ui/MainMenu.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { SIDEBAR_W, TOP_BAR_H } from './constants.js';
import { LocalStorageAdapter } from './systems/StorageAdapter.js';
import { SaveManager } from './systems/SaveManager.js';

function getGameSize() {
  return {
    w: window.innerWidth - SIDEBAR_W,
    h: window.innerHeight - TOP_BAR_H,
  };
}

// Nasconde top-bar e main-area finché il gioco non parte
document.body.classList.add('pre-game');

const { w: initW, h: initH } = getGameSize();

const config = {
  type: Phaser.AUTO,
  width: initW,
  height: initH,
  backgroundColor: '#0a0a0a',
  parent: 'phaser-game',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  input: {
    mouse: {
      target: null,
      capture: true,
    },
  },
  scene: [], // MoonbaseScene viene aggiunta e avviata solo dopo il menu
};

const game = new Phaser.Game(config);
window.__phaserGame = game;

// Registra la scena senza avviarla
game.events.once('ready', () => {
  game.scene.add('MoonbaseScene', MoonbaseScene, false);
});

// ── Flusso splash → menu → gioco ─────────────────────────────────────────────

const adapter = new LocalStorageAdapter();
const saveManager = new SaveManager(adapter);
// Migra eventuale salvataggio legacy (moonbase_save → slot_1) una tantum
adapter.importLegacySave();

function startGame(loadSlot = null) {
  const loading = new LoadingScreen();
  loading.show(() => {
    document.body.classList.remove('pre-game');
  });

  requestAnimationFrame(() => {
    const { w, h } = getGameSize();
    game.scale.resize(w, h);
    game.scene.start('MoonbaseScene', loadSlot ? { loadSlot } : {});

    requestAnimationFrame(() => {
      const scene = game.scene.getScene('MoonbaseScene');
      loading.trackLoader(scene?.load ?? null);
    });
  });
}

const splash = new SplashScreen();
const menu = new MainMenu({
  saveManager,
  onStart() {
    menu.hide(() => startGame(null));
  },
  onContinue() {
    menu.hide(() => startGame('autosave'));
  },
  onLoadSlot(slotId) {
    menu.hide(() => startGame(slotId));
  },
});

splash.show(() => menu.show());

// ── Resize ───────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  const { w, h } = getGameSize();
  game.scale.resize(w, h);
});
