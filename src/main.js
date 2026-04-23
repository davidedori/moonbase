// =============================================================================
// MOONBASE — main.js (Entry Point)
// Lancia il gioco importando la scena modulare e le costanti
// =============================================================================

import { MoonbaseScene } from './scenes/MoonbaseScene.js';
import { SIDEBAR_W, TOP_BAR_H } from './constants.js';

function getGameSize() {
  return {
    w: window.innerWidth - SIDEBAR_W,
    h: window.innerHeight - TOP_BAR_H
  };
}

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
      target: null,   // Usa il canvas come target
      capture: true   // Cattura per gestire il click destro
    }
  },
  scene: [MoonbaseScene],
};

const game = new Phaser.Game(config);

// Gestione Resize Finestra
window.addEventListener('resize', () => {
  const { w, h } = getGameSize();
  game.scale.resize(w, h);
});