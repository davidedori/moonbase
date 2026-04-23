// =============================================================================
// MOONBASE — Entità Building
// Gestisce la creazione grafica degli edifici che usano sprite PNG.
// Attualmente copre: hab, command.
// Tutti gli altri tipi continuano ad essere disegnati proceduralmente
// direttamente in MoonbaseScene._placeBuildingGraphics().
// =============================================================================

import { cartesianToIsometric } from '../utils/isometric.js';
import { TILE_W, TILE_H }       from '../constants.js';

export class Building {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} col
   * @param {number} row
   * @param {'hab_module'|'command'} type
   * @returns {Phaser.GameObjects.Container} container con sprite
   */
  static create(scene, col, row, type) {
    const { x: cx, y: cy } = cartesianToIsometric(col, row);

    // Punto di ancoraggio isometrico: centro-basso del rombo
    const anchorX = cx;
    const anchorY = cy + TILE_H / 2;

    // --- Sprite principale ---
    const textureKey = type === 'command' ? 'command' : 'hab-module';
    const sprite = scene.add.sprite(0, 0, textureKey);
    sprite.setOrigin(0.5, 1);           // origine in basso al centro
    sprite.setPosition(0, 0);           // relativo al container
    sprite.displayWidth = TILE_W;
    sprite.scaleY       = sprite.scaleX;
    sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });

    const children = [sprite];

    // Container posizionato nell'ancoraggio isometrico
    const container = scene.add.container(anchorX, anchorY, children);

    // Depth basato su anchorY (z-sort isometrico standard)
    container.setDepth(anchorY);

    return container;
  }
}
