// =============================================================================
// MOONBASE — Sistema: EconomyManager
// Gestisce tutte le variabili economiche (risorse, energia, equipaggio,
// ciclo Giorno/Notte, emergenze) e comunica tramite EventEmitter.
//
// EVENTI EMESSI:
//   'resources-updated'  { regolith, ice, oxygen, components,
//                          energyProduced, energyConsumed,
//                          crewTotal, crewEmployed,
//                          deltaReg, deltaIce, deltaO2, deltaEnergy, deltaComp }
//   'o2-emergency'       { active, evacTime }
//   'game-over'          { reason }
//   'day-night-changed'  { isDay }
// =============================================================================

import { BUILDINGS_INFO, DAY_DURATION_MS, NIGHT_DURATION_MS, GRACE_PERIOD_DAYS, ROVER_MAX_CHARGE } from '../constants.js';

export class EconomyManager {
  /**
   * @param {Phaser.Events.EventEmitter} emitter  Emitter condiviso con UIManager e Scene
   * @param {Phaser.Scene} scene  Necessario solo per il timer giorno/notte (tweens/time)
   */
  constructor(emitter, scene) {
    this.emitter = emitter;
    this._scene = scene;

    // --- Risorse ---
    this.regolith = 600; // Alzato da 500
    this.ice = 100;
    this.oxygen = 200;
    this.components = 150; // Alzato da 100

    // --- Energia ---
    this.energyProduced = 0;
    this.energyConsumed = 0;
    this.energyRequired = 0; // domanda potenziale totale (per rilevare deficit)
    this.energyStored = 0;
    this.maxEnergy = 0;

    // --- Equipaggio ---
    this.crewTotal = 0;
    this.crewEmployed = 0;
    this.maxOxygen = 200;
    this.maxRovers = 1; // FIX: Base 1 per non restare bloccati


    // --- Stato di gioco ---
    this.isDay = true;
    this.isPaused = false; // Pausa Tattica

    // --- Timers emergenza ---
    this.emergencyTimer = 0; // secondi senza O2
    this.deadlockTimer = 0; // secondi in deadlock

    // --- Tick tracking ---
    this._lastEconomyTime = 0;

    // --- Delta risorse (netto per ciclo) ---
    this._prevRegolith = this.regolith;
    this._prevIce = this.ice;
    this._prevOxygen = this.oxygen;
    this._prevComponents = this.components;
    this.deltaReg = 0;
    this.deltaIce = 0;
    this.deltaO2 = 0;
    this.deltaEnergy = 0;
    this.deltaComp = 0;

    // Array condivisi con la scena (assegnati via init)
    this.buildings = null;
    this.rovers = null;

    this._dayNightTimer = null;
    this._dayNightTween = null;
    this._economyEvent = null;

    // --- Sprint 3: Stats & Hazards ---
    this.stats = {
      totalDaysElapsed: 0,
      o2EmergencyTicks: 0,
      blackoutTicksCount: 0,
      hazardEvents: 0,
      buildingsConstructed: 0,
      buildingsDemolished: 0,
    };
    this._extendedEclipseMultiplier = 1;
    this._solarFlareTicksRemaining = 0;
  }

  /**
   * Inizializza i riferimenti agli array condivisi con la scena.
   * @param {Array} buildings
   * @param {Array} rovers
   */
  init(buildings, rovers) {
    this.buildings = buildings;
    this.rovers = rovers;
  }

  // ===========================================================================
  // CICLO GIORNO / NOTTE
  // ===========================================================================

  startDayTimer() {
    this.isDay = true;
    this.stats.totalDaysElapsed++;
    this.emitter.emit('day-night-changed', { isDay: true });

    // FIX: Controlla se il tween esiste ed è ancora in riproduzione prima di fermarlo
    if (this._dayNightTween && this._dayNightTween.isPlaying()) {
      this._dayNightTween.stop();
    }

    this._dayNightTween = this._scene.tweens.add({
      targets: this._scene.darknessOverlay,
      alpha: 0,
      duration: 3000,
    });

    // FIX: Lascia che Phaser pulisca il timer da solo, riassegnalo semplicemente
    this._dayNightTimer = this._scene.time.delayedCall(DAY_DURATION_MS, () => this.startNightTimer());
  }

  startNightTimer() {
    this.isDay = false;
    this.emitter.emit('day-night-changed', { isDay: false });

    // FIX: Stesso controllo di sicurezza per la notte
    if (this._dayNightTween && this._dayNightTween.isPlaying()) {
      this._dayNightTween.stop();
    }

    this._dayNightTween = this._scene.tweens.add({
      targets: this._scene.darknessOverlay,
      alpha: 0.5,
      duration: 3000,
    });

    const duration = NIGHT_DURATION_MS * this._extendedEclipseMultiplier;
    this._extendedEclipseMultiplier = 1; // Reset after use

    // FIX: Riassegnazione pulita senza .remove() forzato
    this._dayNightTimer = this._scene.time.delayedCall(duration, () => this.startDayTimer());
  }

  syncDayNight(isDay) {
    // 1. Ferma tutto ciò che è in corso
    if (this._dayNightTimer) this._dayNightTimer.remove();
    if (this._dayNightTween) this._dayNightTween.stop();

    // 2. Imposta lo stato salvato
    this.isDay = isDay;
    this.emitter.emit('day-night-changed', { isDay: this.isDay });

    // 3. Applica l'oscurità istantaneamente, senza tween
    this._scene.darknessOverlay.setAlpha(this.isDay ? 0 : 0.5);

    // 4. Fai ripartire il countdown della fase corretta
    this._dayNightTimer = this._scene.time.delayedCall(
      this.isDay ? DAY_DURATION_MS : NIGHT_DURATION_MS,
      () => this.isDay ? this.startNightTimer() : this.startDayTimer()
    );
  }

  // ===========================================================================
  // TICK ECONOMIA (chiamato da Scene.update ogni 10 secondi)
  // ===========================================================================

  startEconomyLoop() {
    if (this._economyEvent) this._economyEvent.remove();
    this._economyEvent = this._scene.time.addEvent({
      delay: 20000,
      callback: () => {
        this.processEconomyTick();
        this.emitter.emit('economy-tick-complete');
      },
      loop: true
    });
  }

  processEconomyTick() {


    // --- Snapshot pre-tick per calcolo delta ---
    this._prevRegolith = this.regolith;
    this._prevIce = this.ice;
    this._prevOxygen = this.oxygen;
    this._prevComponents = this.components;

    let totalO2Produced = 0;
    let totalO2Consumed = 0;

    // --- 1. Generatori ---
    this.energyProduced = 0;
    for (const b of this.buildings) {
      if (b.connected === false || b.isPowered === false || b.isConstructing) continue;
      b._lackingEnergy = false; b._lackingCrew = false;

      // FIX: Rimuove l'icona Standby dai Centri Distretto
      if (BUILDINGS_INFO[b.type]?.isDistrictCenter) b._econActive = true;

      if (b.type === 'solar_array') {
        const solarOutput = this.isDay
          ? BUILDINGS_INFO.solar_array.energyGenDay
          : BUILDINGS_INFO.solar_array.energyGenNight;
        this.energyProduced += solarOutput;
      } else if (b.type === 'rtg') {
        this.energyProduced += BUILDINGS_INFO.rtg.energyGenDay;
      }
    }

    // Sprint 3: Solar Flare effect
    if (this._solarFlareTicksRemaining > 0) {
      this.energyProduced *= 2;
    }

    // -------------------------------------------------------------------------
    // 2. Moduli Abitativi (Consumo Energia/O2 -> +Equipaggio)
    // -------------------------------------------------------------------------
    this.energyRequired = 0;
    for (const b of this.buildings) {
      if (b.connected === false || b.isPowered === false || b.isConstructing) continue;

      if (b.type === 'hab_module') this.energyRequired += BUILDINGS_INFO.hab_module.energyCons;
      else if (b.type === 'isru_plant') this.energyRequired += BUILDINGS_INFO.isru_plant.energyCons;
      else if (b.type === 'regolith_extractor') this.energyRequired += BUILDINGS_INFO.regolith_extractor.energyCons;
      else if (b.type === 'ice_extractor') this.energyRequired += BUILDINGS_INFO.ice_extractor.energyCons;
      else if (b.type === 'component_factory') this.energyRequired += BUILDINGS_INFO.component_factory.energyCons;
      else if (b.type === 'botany_greenhouse') this.energyRequired += BUILDINGS_INFO.botany_greenhouse.energyCons;
      else if (b.type === 'medbay') this.energyRequired += BUILDINGS_INFO.medbay.energyCons;
      else if (b.type === 'deep_drill') this.energyRequired += BUILDINGS_INFO.deep_drill.energyCons;
      else if (b.type === 'rover_workshop') this.energyRequired += BUILDINGS_INFO.rover_workshop.energyCons;
    }

    // --- 3. FIX: STORAGE ENERGETICO SOSTITUITO INTERAMENTE ---
    let energyPool = this.energyProduced + this.energyStored;
    this.energyConsumed = 0;

    // --- Supporto Vitale (Habitat) ---
    this.crewTotal = 0;
    let totalO2HabCons = 0;
    for (const b of this.buildings.filter(b => (b.type === 'hab_module' || b.type === 'command') && b.connected !== false && b.isPowered !== false && !b.isConstructing)) {
      let active = false;
      b._lackingEnergy = false;
      if (b.type === 'command') {
        active = true;
        this.crewTotal += 5;
      } else {
        const energyCost = BUILDINGS_INFO.hab_module.energyCons;
        if (energyPool >= energyCost) {
          energyPool -= energyCost;
          this.energyConsumed += energyCost;
          const o2Cons = BUILDINGS_INFO.hab_module.o2Cons;
          totalO2HabCons += o2Cons;
          totalO2Consumed += o2Cons;
          active = true;
          this.crewTotal += BUILDINGS_INFO.hab_module.crewGen;
        } else {
          b._lackingEnergy = true;
        }
      }
      b._econActive = active;
    }
    this.oxygen -= totalO2HabCons;

    const crewPenalty = Math.floor(this.emergencyTimer / 5);
    this.crewTotal = Math.max(0, this.crewTotal - crewPenalty);

    // --- Impianti industriali ---
    this.crewEmployed = 0;
    let crewPool = this.crewTotal;
    let hasActiveRegExtractor = false;

    const PRIORITY = {
      ice_extractor: 0,      // Priorità 1: Estrazione materia prima vitale
      isru_plant: 1,         // Priorità 2: Supporto vitale primario (O2)
      botany_greenhouse: 2,  // Priorità 3: Supporto vitale secondario (O2)
      regolith_extractor: 3, // Priorità 4: Estrazione minerale
      deep_drill: 4,         // Priorità 5: Estrazione minerale pesante
      component_factory: 5,  // Priorità 6: Fabbricazione
      rover_workshop: 6,     // Priorità 7: Logistica
      medbay: 7              // Priorità 8: Utility
    };

    const consumers = this.buildings
      .filter(b => b.type in PRIORITY && b.connected !== false && b.isPowered !== false && !b.isConstructing)
      .sort((a, b) => {
        if (a.isHighPriority !== b.isHighPriority) return a.isHighPriority ? -1 : 1;
        return PRIORITY[a.type] - PRIORITY[b.type];
      });

    for (const b of consumers) {
      let active = false;
      b._lackingEnergy = false;
      b._lackingCrew = false;

      const info = BUILDINGS_INFO[b.type] ?? {};
      const energyNeeded = info.energyCons ?? 0;
      const crewNeeded = info.crewReq ?? 0;
      const conv = info.conversion;

      if (energyPool < energyNeeded) {
        b._lackingEnergy = true;
      } else if (crewPool < crewNeeded) {
        b._lackingCrew = true;
      } else {
        let inputOk = true;
        if (conv) inputOk = this[conv.inputRes] >= conv.inputCost;

        if (inputOk) {
          energyPool -= energyNeeded;
          this.energyConsumed += energyNeeded;
          crewPool -= crewNeeded;
          this.crewEmployed += crewNeeded;
          if (conv) this[conv.inputRes] -= conv.inputCost;

          // FIX: Sinergie Reali applicate all'output
          let outputAmount = conv ? conv.outputAmount : (info.regolithGen || info.iceGen || 0);

          if (b.district && info.clusterSynergies) {
            const districtModules = b.district.slots.filter(s => s.module !== null).map(s => s.module);
            const synType = Object.keys(info.clusterSynergies)[0];
            const synData = info.clusterSynergies[synType];
            const rawCount = districtModules.filter(m => m.type === synType && m.isPowered !== false && m.connected !== false).length;
            const count = (synType === b.type) ? Math.max(0, rawCount - 1) : rawCount;
            outputAmount += (count * synData.valuePerBuilding);
          }

          if (conv) {
            this[conv.outputRes] += outputAmount;
            if (conv.outputRes === 'oxygen') {
              totalO2Produced += outputAmount;
            }
            active = true;
          } else if (b.type === 'regolith_extractor' || b.type === 'ice_extractor' || b.type === 'deep_drill') {
            // FIX: Rimosso l'auto-refill. Se è vuota, resta a 0.
            const capacity = this._scene.capacityGrid[b.row][b.col] || 0;
            if (capacity > 0) {
              const actualExtract = Math.min(capacity, outputAmount);
              this._scene.capacityGrid[b.row][b.col] -= actualExtract;
              if (b.type === 'regolith_extractor' || b.type === 'deep_drill') {
                this.regolith += actualExtract;
                hasActiveRegExtractor = true;
              } else {
                this.ice += actualExtract;
              }
              if (this._scene.capacityGrid[b.row][b.col] <= 0) {
                this.emitter.emit('resource-depleted', { col: b.col, row: b.row });
              }
              active = true;
            }
          } else {
            active = true;
          }
        }
      }
      b._econActive = active;
    }

    // --- FIX: Ricalcolo Finale Batteria ---
    const energyExcess = Math.max(0, energyPool - this.maxEnergy);
    this.energyOverflow = energyExcess;
    this.energyStored = Math.max(0, Math.min(this.maxEnergy, energyPool));

    // --- Rover ---
    for (const r of this.rovers) {
      // Ricarica: fermo + giorno (acceso o spento), 1 carica per tick
      if (!r.isWreck && !r.moving && this.isDay) {
        r.charge = Math.min(ROVER_MAX_CHARGE, r.charge + 1);
        r._updateChargeBar();
      }

      if (!r.isPowered || this._solarFlareTicksRemaining > 0) {
        r.hasCrew = false;
        if (r._moveTween && r._moveTween.isPlaying()) r.pauseMovement();
        continue;
      }
      if (crewPool >= 1) {
        crewPool -= 1;
        this.crewEmployed += 1;
        r.hasCrew = true;
        r.setAlpha(r.selected ? 1 : 0.9);
        if (r._moveTween && r._moveTween.isPaused() && !this.isPaused) r.resumeMovement();
      } else {
        r.hasCrew = false;
        r.setAlpha(0.4);
        if (r._moveTween && r._moveTween.isPlaying()) r.pauseMovement();
      }
    }



    // --- Ricalcolo Hard Caps (Post-Consumo) ---
    this.maxOxygen = 200;
    this.maxEnergy = 0;
    this.maxRovers = 1; // Base garantita (Comando)

    for (const b of this.buildings) {
      // Contiamo solo edifici attivi e alimentati (non in standby energetico)
      if (b.connected === false || b.isConstructing) continue;

      if (b.type === 'h2o_tank') this.maxOxygen += (BUILDINGS_INFO.h2o_tank.o2CapBonus || 300);
      if (b.type === 'battery_bank') this.maxEnergy += (BUILDINGS_INFO.battery_bank.energyCapBonus || 100);
      // Il Workshop fornisce rover extra SOLO se è alimentato (_econActive)
      if (b.type === 'rover_workshop' && b._econActive) this.maxRovers += 2;
    }

    // --- Gestione Ibernazione/Risveglio Rover (Triage) ---
    const activeRovers = this.rovers.filter(r => !r.isWreck);
    const excess = activeRovers.length - this.maxRovers;

    if (excess > 0) {
      // BLACKOUT: Troppi rover. Mandiamo in breakdown quelli più danneggiati
      // Ordine: dal più danneggiato (durability minore) al più sano
      activeRovers.sort((a, b) => a.durability - b.durability);
      for (let i = 0; i < excess; i++) {
        activeRovers[i].breakDown();
      }
    } else if (excess < 0) {
      // CORRENTE RIPRISTINATA: Slot liberi! Risvegliamo i relitti recuperabili
      const hibernatedRovers = this.rovers.filter(r => r.isWreck && r.durability > 0);

      if (hibernatedRovers.length > 0) {
        // Ordine: dal più sano (durability maggiore) al più danneggiato
        hibernatedRovers.sort((a, b) => b.durability - a.durability);

        // Risveglia fino a saturare gli slot liberi disponibili (Math.abs(excess))
        const toWakeUp = Math.min(Math.abs(excess), hibernatedRovers.length);
        for (let i = 0; i < toWakeUp; i++) {
          hibernatedRovers[i].wakeUp();
        }
      }
    }

    // --- Finalize Tick ---
    // Il delta ora mostra il flusso netto, indipendentemente dal limite del serbatoio
    this.deltaO2 = totalO2Produced - totalO2Consumed;

    // Solo ora applichiamo il clamp per la gestione dello stock
    this.oxygen = Math.max(0, Math.min(this.oxygen, this.maxOxygen));

    this.deltaReg = this.regolith - this._prevRegolith;
    this.deltaIce = this.ice - this._prevIce;
    this.deltaComp = this.components - this._prevComponents;
    this.deltaEnergy = this.energyProduced - this.energyConsumed;

    // Emergenze
    if (this.oxygen <= 0) {
      this.emergencyTimer += 10;
      const evacTime = 180 - this.emergencyTimer;
      this.stats.o2EmergencyTicks++;
      if (this.emergencyTimer >= 180) {
        this.emitter.emit('game-over', { reason: 'Life Support Degraded' });
        return;
      }
      this.emitter.emit('o2-emergency', { active: true, evacTime });
    } else {
      this.emergencyTimer = 0;
      this.emitter.emit('o2-emergency', { active: false, evacTime: 0 });
    }

    if (this.energyRequired > this.energyProduced && this.energyStored <= 0) {
      this.stats.blackoutTicksCount++;
    }

    // FIX: Game Over ignora i relitti
    const activeRoversCount = this.rovers.filter(r => !r.isWreck).length;
    if (this.regolith === 0 && !hasActiveRegExtractor && activeRoversCount === 0) {
      this.deadlockTimer += 10;
      if (this.deadlockTimer >= 180) {
        this.emitter.emit('game-over', { reason: 'Critical Resource Depletion' });
        return;
      }
    } else {
      this.deadlockTimer = 0;
    }

    this.emitter.emit('resources-updated', {
      regolith: this.regolith,
      ice: this.ice,
      oxygen: this.oxygen,
      components: this.components,
      energyProduced: this.energyProduced,
      energyConsumed: this.energyConsumed,
      energyRequired: this.energyRequired,
      energyStored: this.energyStored,
      maxEnergy: this.maxEnergy,
      maxOxygen: this.maxOxygen,
      crewTotal: this.crewTotal,
      crewEmployed: this.crewEmployed,
      deltaReg: this.deltaReg,
      deltaIce: this.deltaIce,
      deltaO2: this.deltaO2,
      deltaComp: this.deltaComp,
      deltaEnergy: this.deltaEnergy,
      deadlockActive: this.deadlockTimer > 0,
      deadlockTime: 180 - this.deadlockTimer,
      stats: this.stats,
    });

    this._triggerRandomEvent();
  }

  _triggerMicrometeorites() {
    const conduits = this.buildings.filter(b => {
      if (b.type !== 'conduit') return false;
      if (b.isConstructing) return false;
      if (b.isDamaged) return false;
      const hasBuildingOnTop = this.buildings.some(
        b2 => b2 !== b && b2.col === b.col && b2.row === b.row && b2.type !== 'conduit'
      );
      return !hasBuildingOnTop;
    });
    if (conduits.length === 0) return;
    const pool = [...conduits];
    const num = Math.min(pool.length, Phaser.Math.Between(1, 2));
    const targets = [];
    for (let i = 0; i < num; i++) {
      const idx = Phaser.Math.Between(0, pool.length - 1);
      targets.push({ col: pool[idx].col, row: pool[idx].row });
      pool.splice(idx, 1);
    }
    this.stats.hazardEvents++;
    this.emitter.emit('hazard-event', {
      type: 'MICROMETEORITES',
      message: `${ico('layout')} MICROMETEORITE IMPACT — CRITICAL CONDUIT DAMAGE DETECTED.`,
      duration: 0
    });
    this.emitter.emit('hazard-destroy-conduit', { targets });
  }

  _triggerRandomEvent() {
    // Nessun disastro prima del GRACE_PERIOD_DAYS
    if (this.stats.totalDaysElapsed <= 3) return;

    if (Math.random() > 0.02) return; // 2% chance per tick (ridotto per bilanciare il ritmo)

    const roll = Math.random();
    this.stats.hazardEvents++;

    if (roll < 0.33) {
      // SOLAR FLARE
      this._solarFlareTicksRemaining = 3;
      this.emitter.emit('hazard-event', {
        type: 'SOLAR FLARE',
        message: `${ico('sun')} SOLAR FLARE DETECTED — PHOTOVOLTAIC SURGE: 2X OUTPUT. ROVER SYSTEMS OFFLINE FOR 30S.`,
        duration: 30
      });
    } else if (roll < 0.66) {
      // MICROMETEORITES — only target standalone conduits not linked to
      // buildings under construction and not supporting a module on top
      const conduits = this.buildings.filter(b => {
        if (b.type !== 'conduit') return false;
        // Skip conduits under construction themselves
        if (b.isConstructing) return false;
        // Skip conduits that have a non-conduit building on the same tile
        const hasBuildingOnTop = this.buildings.some(
          b2 => b2 !== b && b2.col === b.col && b2.row === b.row && b2.type !== 'conduit'
        );
        if (hasBuildingOnTop) return false;
        // Skip conduits adjacent to any building currently under construction
        const adjToConstruction = this.buildings.some(b2 => {
          if (!b2.isConstructing) return false;
          return Math.abs(b2.col - b.col) <= 1 && Math.abs(b2.row - b.row) <= 1;
        });
        if (adjToConstruction) return false;
        return true;
      });
      if (conduits.length > 0) {
        const targets = [];
        const num = Math.min(conduits.length, Phaser.Math.Between(1, 2));
        for (let i = 0; i < num; i++) {
          const idx = Phaser.Math.Between(0, conduits.length - 1);
          const c = conduits.splice(idx, 1)[0];
          targets.push({ col: c.col, row: c.row });
        }
        this.emitter.emit('hazard-event', {
          type: 'MICROMETEORITES',
          message: `${ico('layout')} MICROMETEORITE IMPACT — CRITICAL CONDUIT DAMAGE DETECTED.`,
          duration: 0
        });
        this.emitter.emit('hazard-destroy-conduit', { targets });
      }
    } else {
      // EXTENDED ECLIPSE
      this._extendedEclipseMultiplier = 2;
      this.emitter.emit('hazard-event', {
        type: 'EXTENDED ECLIPSE',
        message: `${ico('moon')} ORBITAL SHADOW EXTENSION — NEXT NIGHT CYCLE DURATION DOUBLED.`,
        duration: 0
      });
    }
  }

  // ===========================================================================
  // PROIEZIONE UI (Aggiornamento istantaneo senza avanzare il tempo)
  // ===========================================================================

  updateProjections() {
    let simRegolith = this.regolith;
    let simIce = this.ice;

    let simMaxOxygen = 200;
    let simMaxEnergy = 0;
    let simMaxRovers = 1;

    // 1. Hard Caps Statici
    for (const b of this.buildings) {
      if (b.connected === false || b.isConstructing) continue;
      if (BUILDINGS_INFO[b.type]?.isDistrictCenter) b._econActive = true;

      if (b.type === 'h2o_tank') simMaxOxygen += (BUILDINGS_INFO.h2o_tank.o2CapBonus || 300);
      if (b.type === 'battery_bank') simMaxEnergy += (BUILDINGS_INFO.battery_bank.energyCapBonus || 100);
    }

    // 2. Generatori
    this.energyProduced = 0;
    const flareMult = this._solarFlareTicksRemaining > 0 ? 2 : 1;
    for (const b of this.buildings) {
      if (b.connected === false || b.isPowered === false || b.isConstructing) continue;
      b._lackingEnergy = false; b._lackingCrew = false;

      if (b.type === 'solar_array') {
        this.energyProduced += (this.isDay ? BUILDINGS_INFO.solar_array.energyGenDay : BUILDINGS_INFO.solar_array.energyGenNight) * flareMult;
      } else if (b.type === 'rtg') {
        this.energyProduced += BUILDINGS_INFO.rtg.energyGenDay * flareMult;
      }
    }

    // 3. Fabbisogno Potenziale
    this.energyRequired = 0;
    for (const b of this.buildings) {
      if (b.connected === false || b.isPowered === false || b.isConstructing) continue;
      const info = BUILDINGS_INFO[b.type];
      if (info && info.energyCons) this.energyRequired += info.energyCons;
    }

    // 4. Habitat
    let simEnergyPool = this.energyProduced + this.energyStored;
    this.energyConsumed = 0;
    this.crewTotal = 0;
    let simTotalO2Produced = 0;
    let simTotalO2Consumed = 0;

    for (const b of this.buildings.filter(b => (b.type === 'hab_module' || b.type === 'command') && b.connected !== false && b.isPowered !== false && !b.isConstructing)) {
      let active = false;
      if (b.type === 'command') {
        active = true;
        this.crewTotal += 5;
      } else {
        const cost = BUILDINGS_INFO.hab_module.energyCons;
        if (simEnergyPool >= cost) {
          simEnergyPool -= cost;
          this.energyConsumed += cost;
          simTotalO2Consumed += BUILDINGS_INFO.hab_module.o2Cons;
          this.crewTotal += BUILDINGS_INFO.hab_module.crewGen;
          active = true;
        } else {
          b._lackingEnergy = true;
        }
      }
      b._econActive = active;
    }

    const crewPenalty = Math.floor(this.emergencyTimer / 5);
    this.crewTotal = Math.max(0, this.crewTotal - crewPenalty);

    // 5. Industria
    this.crewEmployed = 0;
    let simCrewPool = this.crewTotal;
    this.deltaReg = 0;
    this.deltaIce = 0;
    this.deltaComp = 0;

    const PRIORITY = { ice_extractor: 0, isru_plant: 1, botany_greenhouse: 2, regolith_extractor: 3, deep_drill: 4, component_factory: 5, rover_workshop: 6, medbay: 7 };
    const consumers = this.buildings
      .filter(b => b.type in PRIORITY && b.connected !== false && b.isPowered !== false && !b.isConstructing)
      .sort((a, b) => {
        if (a.isHighPriority !== b.isHighPriority) return a.isHighPriority ? -1 : 1;
        return PRIORITY[a.type] - PRIORITY[b.type];
      });

    for (const b of consumers) {
      let active = false;
      const info = BUILDINGS_INFO[b.type] ?? {};
      const eCost = info.energyCons ?? 0;
      const cCost = info.crewReq ?? 0;
      const conv = info.conversion;

      if (simEnergyPool < eCost) {
        b._lackingEnergy = true;
      } else if (simCrewPool < cCost) {
        b._lackingCrew = true;
      } else {
        let inputOk = true;
        if (conv) {
          if (conv.inputRes === 'regolith') inputOk = simRegolith >= conv.inputCost;
          else if (conv.inputRes === 'ice') inputOk = simIce >= conv.inputCost;
          else inputOk = this[conv.inputRes] >= conv.inputCost;
        }

        if (inputOk) {
          simEnergyPool -= eCost;
          this.energyConsumed += eCost;
          simCrewPool -= cCost;
          this.crewEmployed += cCost;

          if (conv) {
            if (conv.inputRes === 'regolith') simRegolith -= conv.inputCost;
            if (conv.inputRes === 'ice') simIce -= conv.inputCost;
          }

          let outputAmount = conv ? conv.outputAmount : (info.regolithGen || info.iceGen || 0);

          if (b.district && info.clusterSynergies) {
            const districtModules = b.district.slots.filter(s => s.module !== null).map(s => s.module);
            const synType = Object.keys(info.clusterSynergies)[0];
            const synData = info.clusterSynergies[synType];
            const rawCount = districtModules.filter(m => m.type === synType && m.isPowered !== false && m.connected !== false).length;
            const count = (synType === b.type) ? Math.max(0, rawCount - 1) : rawCount;
            outputAmount += (count * synData.valuePerBuilding);
          }

          if (conv) {
            if (conv.outputRes === 'oxygen') simTotalO2Produced += outputAmount;
            else if (conv.outputRes === 'components') this.deltaComp += outputAmount;
            active = true;
          } else if (b.type === 'regolith_extractor' || b.type === 'deep_drill') {
            const capacity = this._scene.capacityGrid[b.row][b.col] || 0;
            if (capacity > 0) {
              const act = Math.min(capacity, outputAmount);
              this.deltaReg += act;
              simRegolith += act;
              active = true;
            }
          } else if (b.type === 'ice_extractor') {
            const capacity = this._scene.capacityGrid[b.row][b.col] || 0;
            if (capacity > 0) {
              const act = Math.min(capacity, outputAmount);
              this.deltaIce += act;
              simIce += act;
              active = true;
            }
          } else {
            active = true;
          }
        }
      }
      b._econActive = active;
      if (b.type === 'rover_workshop' && active) simMaxRovers += 2;
    }

    for (const r of this.rovers) {
      if (r.isPowered && !r.isWreck && simCrewPool >= 1) {
        simCrewPool -= 1;
        this.crewEmployed += 1;
      }
    }

    this.deltaO2 = simTotalO2Produced - simTotalO2Consumed;
    this.deltaEnergy = this.energyProduced - this.energyConsumed;
    this.maxOxygen = simMaxOxygen;
    this.maxRovers = simMaxRovers;

    // Trigger aggiornamenti visivi immediati!
    this._scene._emitResourcesUpdate();
    this._scene._applyBuildingVisuals();
    this._scene._updateStatusIcons();
  }
}

// Helper for hazards icons
function ico(name) {
  return `<i data-lucide="${name}" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>`;
}
