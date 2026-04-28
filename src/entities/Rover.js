// =============================================================================
// MOONBASE — Entità: Rover
// Gestisce: allineamento isometrico, tween di movimento (A*), selezione,
// sistema di carica autonoma (pannelli solari propri, 10 caselle di autonomia,
// ricarica 1 casella/ciclo quando fermo) e charge bar visuale.
// =============================================================================

import { cartesianToIsometric } from '../utils/isometric.js';
import { aStarPathfind } from '../utils/pathfinding.js';
import {
  TILE_W,
  TILE_H,
  ROVER_EXPLORE_RADIUS,
  ROVER_MAX_CHARGE,
  ROVER_MAX_DURABILITY,
} from '../constants.js';
import { ROVER_RECHARGE_INTERVAL_MS } from '../balance.js';

export class Rover extends Phaser.GameObjects.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} col
   * @param {number} row
   * @param {import('../systems/EconomyManager.js').EconomyManager} economy
   */
  constructor(scene, col, row, economy) {
    const { x: cx, y: cy } = cartesianToIsometric(col, row);
    super(scene, cx, cy + TILE_H / 2, 'rover-SE');

    this.id = 'rover_' + Phaser.Math.RND.uuid(); // FIX: Serve per l'icona OFF
    scene.add.existing(this);

    // Ombra: stessa texture, schiacciata sull'asse Y, segue il rover
    this._shadow = scene.add.image(cx + TILE_W * -0.2, cy + TILE_H / 2 + TILE_H * 0.05, 'rover-SE');
    this._shadow.setOrigin(0.5, 1);
    this._shadow.displayWidth = TILE_W;
    this._shadow.scaleY = this._shadow.scaleX;
    this._shadow.setTint(0x000000);
    this._shadow.setAlpha(0.8);


    // --- Proprietà logiche ---
    this.col = col;
    this.row = row;
    this.fromCol = null;
    this.fromRow = null;
    this.selected = false;
    this.moving = false;
    this.hasCrew = true;
    this._path = [];

    // Offset visivo (tremolio motore)
    this.visualYOffset = 0;

    // Riferimento all'EconomyManager (solo per isPaused)
    this._economy = economy;

    // Tween di movimento e vibrazione motore
    this._moveTween = null;
    this._engineTween = null;

    // --- Sistema di carica autonoma ---
    this.charge = ROVER_MAX_CHARGE;
    this._movedThisTick = false; // true se ha mosso almeno 1 casella nel ciclo corrente
    this._rechargeCounter = 0;     // conta i tick fermi; ogni ROVER_TICKS_PER_CHARGE aggiunge 1

    // --- Durability & Wreck (SPRINT 1) ---
    this.durability = ROVER_MAX_DURABILITY;
    this.isWreck = false;

    // --- Stato accensione ---
    this.isPowered = true;
    this._lastPoweredState = null;  // cache per _applyVisuals
    this._wasAlreadyPoweredOff = false; // true solo se era spento già al tick precedente
    this._lastDustTime = 0;

    // --- Allineamento iniziale ---
    this.setOrigin(0.5, 1);
    this.displayWidth = TILE_W;
    this.scaleY = this.scaleX;
    this.setInteractive({ pixelPerfect: true, alphaTolerance: 1 });
    this._updateDepth();

    // --- Charge bar + Condition bar (Graphics separati, seguono il rover) ---
    this._chargeBar = scene.add.graphics();
    this._conditionBar = scene.add.graphics();
    this._updateChargeBar();

    // --- Tremolio motore continuo ---
    this._engineTween = scene.tweens.add({
      targets: this,
      visualYOffset: -0.2,
      duration: Phaser.Math.Between(90, 130),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (!this.moving) {
          const { x: idleX, y: idleY } = cartesianToIsometric(this.col, this.row);
          const offset = this.isPowered ? this.visualYOffset : 0;
          this.setPosition(idleX, idleY + TILE_H / 2 + offset);
          this._updateDepth();
          this._updateChargeBar();
        }
      },
    });

    // Timer indipendente: +1 carica ogni ROVER_RECHARGE_INTERVAL_MS (fermo + giorno)
    this._rechargeTimer = scene.time.addEvent({
      delay: ROVER_RECHARGE_INTERVAL_MS,
      loop: true,
      callback: () => {
        if (!this.isWreck && !this.moving && this._economy.isDay) {
          this.charge = Math.min(ROVER_MAX_CHARGE, this.charge + 1);
          this._updateChargeBar();
          if (this.scene.selectedEntity?.ref === this) this.scene._updateContextPanel();
        }
      },
    });

  }

  // ---------------------------------------------------------------------------
  // Z-SORTING
  // ---------------------------------------------------------------------------

  _updateDepth() {
    // RIMOSSO il +35000. Ora il rover usa la sua profondità isometrica pura
    const baseDepth = (this.y - this.x * 0.001);
    this.setDepth(baseDepth);

    if (this._shadow) {
      const stableY = this.isPowered ? this.y - this.visualYOffset : this.y;
      const sx = this.x + TILE_W * -0.02;
      const sy = stableY + TILE_H * 0.04;
      this._shadow.setPosition(sx, sy);
      this._shadow.setDepth(baseDepth - 1);
    }

    // L'UI del rover (barra carica) sta sempre leggermente sopra il rover stesso
    // Assicurati che la barra di carica segua la nuova profondità
    if (this._chargeBar) {
      this._chargeBar.setDepth(baseDepth + 10);
      this._conditionBar?.setDepth(baseDepth + 10);
    }
  }

  _updateShadowTexture() {
    if (!this._shadow) return;
    this._shadow.setTexture(this.texture.key);
    this._shadow.displayWidth = this.displayWidth;
    this._shadow.scaleY = this._shadow.scaleX;
  }

  setAlpha(value) {
    super.setAlpha(value);
    if (this._shadow) this._shadow.setAlpha(value * 0.8);
    return this;
  }

  // ---------------------------------------------------------------------------
  // CHARGE BAR
  // ---------------------------------------------------------------------------

  _updateChargeBar() {
    const g = this._chargeBar;
    const BW = 22;
    const BH = 1.5;
    const R = 1;
    const stableY = this.isPowered ? this.y - this.visualYOffset : this.y;

    const midY = stableY - this.displayHeight * 0.55;
    const by = midY - BH / 2;
    const bx = this.x - BW / 2;

    g.clear();

    // Bordo nero
    g.fillStyle(0x000000, 1);
    g.fillRoundedRect(bx - 0.5, by - 0.5, BW + 1, BH + 1, R);

    // Track quasi-nero
    g.fillStyle(0x000000, 0.75);
    g.fillRoundedRect(bx, by, BW, BH, R);

    // Fill carica — palette CSS (--green / --yellow / --red)
    const pct = this.charge / ROVER_MAX_CHARGE;
    const color = pct > 0.6 ? 0x3fc864 : pct > 0.3 ? 0xd2a532 : 0xf85149;
    const fillW = Math.max(0, BW * pct);
    g.fillStyle(color, 1);
    g.fillRoundedRect(bx, by, fillW, BH, R);

    g.setDepth(this.depth + 10);

    // --- Barra integrità (sotto) ---
    const gc = this._conditionBar;
    const GAP = 2;
    const cby = by + BH + GAP;
    gc.clear();

    // Bordo nero
    gc.fillStyle(0x000000, 1);
    gc.fillRoundedRect(bx - 0.5, cby - 0.5, BW + 1, BH + 1, R);

    // Track quasi-nero
    gc.fillStyle(0x000000, 0.75);
    gc.fillRoundedRect(bx, cby, BW, BH, R);

    // Fill integrità — CSS --col-o2
    const condPct = (this.durability ?? 100) / 100;
    const condFillW = Math.max(0, BW * condPct);
    gc.fillStyle(0x58a6ff, 1);
    gc.fillRoundedRect(bx, cby, condFillW, BH, R);
    gc.setDepth(this.depth + 10);

    // Aggiorna stato visivo (postFX + dot, con cache)
    this._applyVisuals();
  }

  _applyVisuals() {
    const state = this.isPowered ? 'on' : 'off';
    if (state === this._lastPoweredState) return;
    this._lastPoweredState = state;

    // postFX: desatura e scurisci se spento
    if (this.postFX) {
      this.postFX.clear();
      if (!this.isPowered) {
        this.postFX.addColorMatrix().brightness(0.5).grayscale(1, true);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // SELEZIONE
  // ---------------------------------------------------------------------------

  select() { this.selected = true; }
  deselect() { this.selected = false; }

  // ---------------------------------------------------------------------------
  // MOVIMENTO CON A*
  // ---------------------------------------------------------------------------

  // Aggiungi precalculatedPath come ultimo parametro
  moveTo(destCol, destRow, occupiedGrid, terrainGrid, revealFogFn, setTileShadowFn, precalculatedPath = null) {
    if (this.moving) return false;
    if (!this.isPowered || this.isWreck || this.charge <= 0 || !this.hasCrew) return false;
    if (this.col === destCol && this.row === destRow) return false;

    // Usa il percorso precalcolato se esiste, altrimenti calcolalo da zero
    const path = precalculatedPath || aStarPathfind(occupiedGrid, terrainGrid, this.col, this.row, destCol, destRow);

    if (!path || path.length === 0) {
      return false;
    }

    this.moving = true;
    this._path = path;
    this._pendingMove = { revealFogFn, setTileShadowFn };
    this._animateStep(revealFogFn, setTileShadowFn);

    return true;
  }

  _animateStep(revealFogFn, setTileShadowFn) {
    // FIX: Se non c'è percorso O se il rover è stato appena spento, abortisce subito
    if (this._path.length === 0 || !this.isPowered) {
      this.moving = false;
      this._pendingMove = null;
      return;
    }

    // Pausa Tattica: riprova tra 200ms
    if (this._economy.isPaused) {
      this.scene.time.delayedCall(200, () => this._animateStep(revealFogFn, setTileShadowFn));
      return;
    }
    // Crew mancante: annulla il movimento (non deve loopare all'infinito)
    if (!this.hasCrew) {
      this.moving = false;
      this._pendingMove = null;
      return;
    }

    // NUOVO: Logica Durabilità (SPRINT 1)
    if (!this.isWreck) {
      this.durability -= 1;
      if (this.durability <= 0) {
        this.breakDown();
        return;
      }
    }

    // Carica esaurita: stop netto, path cancellato (l'utente dovrà ricomandare)
    if (this.charge <= 0) {
      this.moving = false;
      this._path = [];
      return;
    }

    // Consuma 1 unità di carica per questa casella
    this.charge--;
    this._movedThisTick = true;
    this._updateChargeBar();
    if (this.scene.selectedEntity?.ref === this) this.scene._updateContextPanel();

    const nextStep = this._path.shift();
    const prevCol = this.col;
    const prevRow = this.row;

    setTileShadowFn(prevCol, prevRow, false);
    setTileShadowFn(nextStep.col, nextStep.row, true);

    this.fromCol = prevCol;
    this.fromRow = prevRow;
    this.col = nextStep.col;
    this.row = nextStep.row;

    const dCol = nextStep.col - prevCol;
    const dRow = nextStep.row - prevRow;
    if (dCol === 1 && dRow === 0) this.setTexture('rover-SE');
    else if (dCol === -1 && dRow === 0) this.setTexture('rover-NW');
    else if (dCol === 0 && dRow === 1) this.setTexture('rover-SW');
    else if (dCol === 0 && dRow === -1) this.setTexture('rover-NE');
    else if (dCol === 1 && dRow === 1) this.setTexture('rover-S');
    else if (dCol === -1 && dRow === -1) this.setTexture('rover-N');
    else if (dCol === 1 && dRow === -1) this.setTexture('rover-E');
    else if (dCol === -1 && dRow === 1) this.setTexture('rover-W');
    this._updateShadowTexture();

    const { x: newCX, y: newCY } = cartesianToIsometric(nextStep.col, nextStep.row);
    const { x: oldCX, y: oldCY } = cartesianToIsometric(prevCol, prevRow);
    const newX = newCX;
    const newY = newCY + TILE_H / 2;
    const tweenTarget = { x: oldCX, y: oldCY + TILE_H / 2 };

    this._moveTween = this.scene.tweens.add({
      targets: tweenTarget,
      x: newX,
      y: newY,
      duration: 600,
      ease: 'Linear',
      onUpdate: () => {
        this.setPosition(tweenTarget.x, tweenTarget.y + this.visualYOffset);
        this._updateDepth();
        this._updateChargeBar();

        // Sprint 3: Dust Particles
        const now = this.scene.time.now;
        if (now - this._lastDustTime > 120 / this.scene.time.timeScale) {
          this._lastDustTime = now;
          this._spawnDust();
        }
      },
      onComplete: () => {
        this._moveTween = null;
        this.fromCol = null;
        this.fromRow = null;
        this.setPosition(newX, newY + this.visualYOffset);
        this._updateDepth();
        this._updateChargeBar();
        revealFogFn(nextStep.col, nextStep.row, ROVER_EXPLORE_RADIUS);
        this._animateStep(revealFogFn, setTileShadowFn);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // PAUSA TATTICA
  // ---------------------------------------------------------------------------

  pauseMovement() {
    if (this._moveTween && this._moveTween.isPlaying()) this._moveTween.pause();
  }

  resumeMovement() {
    if (this._moveTween && this._moveTween.isPaused() && this.hasCrew && !this.isWreck) this._moveTween.resume();
  }

  // ---------------------------------------------------------------------------
  // RICICLO / BREAKDOWN (SPRINT 1)
  // ---------------------------------------------------------------------------

  breakDown() {
    this.isWreck = true;
    this.isPowered = false;
    this.hasCrew = false;
    this.moving = false;
    // Snap sprite alla tile logica prima di stoppare il tween
    const { x: cx, y: cy } = cartesianToIsometric(this.col, this.row);
    this.setPosition(cx, cy + TILE_H / 2 + this.visualYOffset);
    if (this._moveTween) { this._moveTween.stop(); this._moveTween = null; }
    if (this._engineTween) this._engineTween.stop();
    this.setTint(0x8b4513);
    this.setAlpha(0.9);
    this._chargeBar.setVisible(false);
    this._conditionBar?.setVisible(false);

    // Rendi la casella "occupata" come ostacolo duro
    this.scene.occupiedTiles[this.row][this.col] = true;
  }

  // ---------------------------------------------------------------------------
  // RISVEGLIO (Ibernazione terminata)
  // ---------------------------------------------------------------------------

  wakeUp() {
    this.isWreck = false;
    this.isPowered = true;
    this.hasCrew = true; // Torna disponibile

    // Rimuove la tinta ruggine
    this.clearTint();
    this.setAlpha(1);

    // Ripristina l'UI
    if (this._chargeBar) this._chargeBar.setVisible(true);
    this._conditionBar?.setVisible(true);

    // Libera la casella della mappa (non è più un ostacolo duro)
    this.scene.occupiedTiles[this.row][this.col] = false;

    // Forza un aggiornamento visivo immediato
    this._lastPoweredState = null;
    this._applyVisuals();
  }

  // ---------------------------------------------------------------------------
  // DISTRUZIONE
  // ---------------------------------------------------------------------------

  destroy(fromScene) {
    this._rechargeTimer?.remove(false);
    this._shadow?.destroy();
    this._shadow = null;
    this._chargeBar?.destroy();
    this._conditionBar?.destroy();

    super.destroy(fromScene);
  }

  _spawnDust() {
    // Generiamo più particelle per ogni richiamo (da 2 a 3 alla volta)
    const count = Phaser.Math.Between(5, 9);

    for (let i = 0; i < count; i++) {
      // Area di spawn leggermente più larga
      const rx = this.x + Phaser.Math.Between(-10, 10);
      const ry = this.y - Phaser.Math.Between(8, 14);

      // Raggio microscopico (FloatBetween permette valori come 0.8)
      const dust = this.scene.add.circle(rx, ry, Phaser.Math.FloatBetween(0.5, 2), 0xcccccc, 0.5);
      dust.setDepth(this.depth - 2);

      this.scene.tweens.add({
        targets: dust,
        alpha: 0,
        y: ry - Phaser.Math.Between(15, 25), // Salita variabile
        x: rx + Phaser.Math.Between(-5, 5),  // Leggera deriva laterale
        scale: Phaser.Math.FloatBetween(1.1, 2), // Espansione minima
        duration: Phaser.Math.Between(500, 1500), // Durata variabile
        ease: 'Power1',
        onComplete: () => dust.destroy()
      });
    }
  }
}
