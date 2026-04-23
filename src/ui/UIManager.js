// =============================================================================
// MOONBASE — Sistema: UIManager
// =============================================================================

import { BUILDINGS_INFO, ROVER_COST, ROVER_COST_TYPE, DISTRICT_TYPES } from '../constants.js';

// Lucide icon name per ogni tipo di edificio
const BUILDING_ICONS = {
  habitat_hub: 'home',
  logistics_hub: 'package',
  mining_hub: 'pickaxe',
  cryo_hub: 'droplets',
  power_center: 'zap',
  botany_greenhouse: 'sprout',
  medbay: 'heart-pulse',
  recycling_facility: 'refresh-cw',
  deep_drill: 'drill',
  h2o_tank: 'droplet',
  battery_bank: 'battery-full',
  rover_workshop: 'wrench',
  solar_array: 'sun',
  rtg: 'atom',
  hab_module: 'home',
  regolith_extractor: 'pickaxe',
  ice_extractor: 'snowflake',
  conduit: 'cable',
  command: 'landmark',
  isru_plant: 'flask-conical',
  component_factory: 'factory',
};

// Mappa risorsa-chiave → { icona Lucide, etichetta, variabile CSS colore }
const RES_META = {
  regolith: { icon: 'layers', label: 'REGOLITH', color: 'var(--col-reg)' },
  ice: { icon: 'snowflake', label: 'ICE', color: 'var(--col-ice)' },
  oxygen: { icon: 'wind', label: 'O₂', color: 'var(--col-o2)' },
  components: { icon: 'cpu', label: 'COMP', color: 'var(--col-comp)' },
};

/** Inline `<i data-lucide>` tag — resolved by lucide.createIcons(). */
function ico(name, size = 14) {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;flex-shrink:0;"></i>`;
}

/** Re-process any new data-lucide elements injected into the DOM. */
function refreshIcons() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Genera le righe di dettaglio costi/produzione per il bottone di costruzione.
 */
function _buildCostLines(type, info) {
  const parts = [];

  if (info.cost > 0)
    parts.push(`<span style="color:var(--col-reg)">${ico('layers', 12)} ${info.cost} REG</span>`);
  if (info.costComponents > 0)
    parts.push(`<span style="color:var(--col-comp)">${ico('cpu', 12)} ${info.costComponents} COMP</span>`);

  if (info.energyGenDay > 0) {
    const extra = info.energyGenNight > 0 ? '' : ` ${ico('sun', 12)}`;
    parts.push(`<span style="color:var(--green)">${ico('zap', 12)}${extra} +${info.energyGenDay} E</span>`);
  }
  if (info.regolithGen > 0)
    parts.push(`<span style="color:var(--col-reg)">${ico('layers', 12)} +${info.regolithGen}/TICK</span>`);
  if (info.iceGen > 0)
    parts.push(`<span style="color:var(--col-ice)">${ico('snowflake', 12)} +${info.iceGen}/TICK</span>`);
  if (info.crewGen > 0)
    parts.push(`<span style="color:var(--col-crew)">${ico('users', 12)} +${info.crewGen}</span>`);
  if (info.conversion) {
    const { inputRes, inputCost, outputRes, outputAmount } = info.conversion;
    const inM = RES_META[inputRes] ?? { icon: 'circle', label: inputRes, color: 'inherit' };
    const outM = RES_META[outputRes] ?? { icon: 'circle', label: outputRes, color: 'inherit' };
    parts.push(
      `<span style="color:var(--text-dim)">` +
      `<span style="color:${inM.color}">${ico(inM.icon, 12)} ${inputCost}</span>` +
      ` ${ico('arrow-right', 12)} ` +
      `<span style="color:${outM.color}">${ico(outM.icon, 12)} ${outputAmount}</span>/ciclo` +
      `</span>`
    );
  }

  if (info.energyCons > 0)
    parts.push(`<span style="color:var(--red)">${ico('zap', 12)} −${info.energyCons} E</span>`);
  if (info.o2Cons > 0)
    parts.push(`<span style="color:var(--red)">${ico('wind', 12)} −${info.o2Cons}/TICK</span>`);
  if (info.crewReq > 0)
    parts.push(`<span style="color:var(--text-dim)">${ico('user', 12)} ×${info.crewReq}</span>`);

  if (info.terrain === 'regolith')
    parts.push(`<span style="color:var(--text-dim)">${ico('map-pin', 12)} ONLY REGOLITH</span>`);
  if (info.terrain === 'ice')
    parts.push(`<span style="color:var(--col-ice)">${ico('map-pin', 12)} ONLY ICE</span>`);

  return parts.join(' ');
}

function canBuildAnything(buildableTypes, regolith, components) {
  if (!buildableTypes) return true;
  for (const [type, info] of Object.entries(BUILDINGS_INFO)) {
    // Escludiamo il Comando e i moduli non-distretto
    if (type === 'command' || !info.isDistrictCenter) continue;

    if (!buildableTypes.has(type)) continue;
    const regOk = (info.cost ?? 0) === 0 || regolith >= (info.cost ?? 0);
    const compOk = (info.costComponents ?? 0) === 0 || components >= (info.costComponents ?? 0);
    if (regOk && compOk) return true;
  }
  return false;
}

const BUILDING_PREVIEWS = {
  solar_array: './graphics/solar-panel.png',
  hab_module: './graphics/hab-module.png',
  rtg: null,
  isru_plant: './graphics/isru.png',
  command: './graphics/command.png',
  regolith_extractor: './graphics/regolith-extractor.png',
  ice_extractor: './graphics/ice-extractor.png',
  conduit: null,
  component_factory: './graphics/component-factory.png',
  mining_hub: './graphics/mining-hub.png',
  power_center: './graphics/power-center.png',
  cryo_hub: './graphics/cryo-hub.png',
};

export class UIManager {
  constructor(emitter, callbacks) {
    this.emitter = emitter;
    this._callbacks = callbacks;

    this._setupEventListeners();
    this._setupStaticButtonHandlers();
    this._setupClickPropagation();

    // Terminal Houston State (Sprint 4)
    this._commsQueue = [];
    this._commsBusy = false;
    this._maxCommsLines = 4;
  }

  // ===========================================================================
  // SETUP
  // ===========================================================================

  _setupEventListeners() {
    this.emitter.on('resources-updated', (data) => this._onResourcesUpdated(data));
    this.emitter.on('o2-emergency', (data) => this._onO2Emergency(data));
    this.emitter.on('day-night-changed', (data) => this._onDayNightChanged(data));
    this.emitter.on('game-over', (data) => this._onGameOver(data));
    this.emitter.on('hazard-event', (data) => this._onHazardEvent(data));
  }

  _setupStaticButtonHandlers() {
    const cb = this._callbacks;
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', () => cb.onTogglePause?.(btnPause));

    // Speed Controls
    const speedBtns = document.querySelectorAll('.speed-btn');
    speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseInt(btn.dataset.speed);
        this.emitter.emit('change-speed', { speed });
        this.updateSpeedButtons(speed);
      });
    });
  }

  _setupClickPropagation() {
    for (const id of ['ui-sidebar', 'top-bar', 'time-tracker-ui']) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('mousedown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => e.stopPropagation());
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  // ===========================================================================
  // PANNELLO CONTESTUALE
  // ===========================================================================

  updateContextPanel(entity, opts = {}) {
    this.hideBuildPreview();

    const sidebarEl = document.getElementById('ui-sidebar');
    const nameEl = document.getElementById('ctx-name');
    const previewEl = document.getElementById('ctx-preview');
    const statsEl = document.getElementById('ctx-stats');
    const actionsEl = document.getElementById('ctx-actions');
    const warningsEl = document.getElementById('ctx-warnings');

    if (!nameEl || !sidebarEl) return;

    // 1. SE NIENTE E' SELEZIONATO: Nascondiamo solo il pannello
    // NON puliamo i campi qui, così l'animazione mostrerà il contenuto mentre esce!
    if (!entity) {
      sidebarEl.classList.remove('visible');
      return;
    }

    // 2. SE STIAMO CARICANDO UNA NUOVA SELEZIONE: Puliamo prima di riempire
    statsEl.innerHTML = '';
    actionsEl.innerHTML = '';
    warningsEl.innerHTML = '';
    previewEl.src = '';

    sidebarEl.classList.add('visible');

    const regolith = opts.regolith ?? 0;
    const components = opts.components ?? 0;

    // ── ROVER ─────────────────────────────────────────────────────────────────
    if (entity.type === 'rover') {
      const rover = entity.ref;
      nameEl.innerText = 'Rover';
      previewEl.src = './graphics/rover-NE.png';

      const maxCharge = rover.maxCharge ?? 10;
      statsEl.innerHTML = `
        <div>${ico('bolt')} Condition: ${Math.round(rover.durability ?? 100)}%</div>
        <div>${ico('battery')} Charge: ${rover.charge} / ${maxCharge}</div>
        <div>${ico('map-pin')} Position: (${rover.col}, ${rover.row})</div>
      `;

      const powered = rover.isPowered !== false;
      const btnPower = document.createElement('button');
      btnPower.className = 'ctx-btn';
      btnPower.innerHTML = powered ? `${ico('power-off')} POWER OFF` : `${ico('power')} POWER ON`;
      btnPower.addEventListener('click', () => opts.onTogglePower?.(rover));
      actionsEl.appendChild(btnPower);

      const header = document.createElement('div');
      header.className = 'section-header';
      header.style.marginTop = '8px';
      header.innerText = 'CONSTRUCTION';
      actionsEl.appendChild(header);

      for (const [type, info] of Object.entries(BUILDINGS_INFO)) {
        if (type === 'command' || (!info.isDistrictCenter && type !== 'conduit')) continue;

        const regOk = (info.cost ?? 0) === 0 || regolith >= (info.cost ?? 0);
        const compOk = (info.costComponents ?? 0) === 0 || components >= (info.costComponents ?? 0);
        const canAfford = regOk && compOk;
        const canBuild = !opts.buildableTypes || opts.buildableTypes.has(type);

        const btn = document.createElement('button');
        btn.className = 'ctx-btn';
        btn.disabled = !powered || !canAfford || !canBuild;

        const iconName = BUILDING_ICONS[type] ?? 'box';
        const details = _buildCostLines(type, info);

        let errorMsg = '';
        if (!powered) errorMsg = ' [ROVER OFFLINE - POWER ON TO BUILD]';
        else if (!canAfford) errorMsg = ' [INSUFFICIENT RESOURCES]';
        else if (!canBuild) errorMsg = ' [NO COMPATIBLE TERRAIN]';

        btn.innerHTML = `
          <div class="ctx-btn-title">${ico(iconName)} ${info.name}</div>
          <div class="ctx-btn-details">${details}<span style="color:var(--red); font-weight:bold;">${errorMsg}</span></div>
        `;
        btn.addEventListener('click', () => opts.onStartBuild?.(type));
        btn.addEventListener('mouseenter', (e) => this.showBuildPreview(type, e.target.getBoundingClientRect()));
        btn.addEventListener('mouseleave', () => this.hideBuildPreview());
        actionsEl.appendChild(btn);
      }

      if (!powered) {
        warningsEl.innerHTML = `${ico('alert-circle')} ROVER POWERED OFF — POWER ON TO BUILD.`;
      } else if (!canBuildAnything(opts.buildableTypes, regolith, components)) {
        warningsEl.innerHTML = `${ico('alert-circle')} NO CONSTRUCTION AVAILABLE AT CURRENT POSITION.`;
      }

      refreshIcons();
      return;
    }

    // ── EDIFICIO ──────────────────────────────────────────────────────────────
    if (entity.type === 'building') {
      const building = entity.ref;
      const info = BUILDINGS_INFO[building.type] ?? {};
      const iconName = BUILDING_ICONS[building.type] ?? 'box';

      nameEl.innerHTML = `${ico(iconName, 16)} ${info.name ?? building.type}`;

      const previewSrc = BUILDING_PREVIEWS[building.type];
      if (previewSrc) previewEl.src = previewSrc;

      // 1. Dati Distretto (Se applicabile)
      if (info.isDistrictCenter && opts.districtInfo) {
        const { district, districtDef, slots } = opts.districtInfo;
        const typeLabel = districtDef?.label ?? 'CORE DISTRICT';
        const connIco = district.connected
          ? `<span style="color:var(--green)">${ico('check-circle')} Connected</span>`
          : `<span style="color:var(--red)">${ico('x-circle')} Conduit missing</span>`;

        statsEl.innerHTML = `
          <div style="color:var(--text-dim)">Type: ${typeLabel}</div>
          <div style="margin-top:2px;">${connIco}</div>`;

        // Moduli Occupati
        const occupiedSlots = slots.filter(s => s.module !== null);
        occupiedSlots.forEach(slot => {
          const modInfo = BUILDINGS_INFO[slot.module.type] ?? {};
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--ghost-bg);border:1px solid var(--ghost-border);border-radius:4px;padding:5px 8px;margin-bottom:4px;';
          row.innerHTML = `<span style="font-size:0.72rem;color:var(--white)">${ico(BUILDING_ICONS[slot.module.type] ?? 'box')} ${modInfo.name ?? slot.module.type}</span>`;

          const removeBtn = document.createElement('button');
          removeBtn.style.cssText = 'padding:2px 8px;font-size:0.65rem;font-family:"Space Mono","Courier New",monospace;background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.4);color:var(--red);border-radius:32px;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px;';
          removeBtn.innerHTML = `${ico('x', 11)} REMOVE`;
          removeBtn.addEventListener('click', () => opts.onRemoveModule?.(district, slot.index));

          row.appendChild(removeBtn);
          actionsEl.appendChild(row);
        });

        // Slot Liberi e Bottoni Costruzione Moduli
        const freeSlots = slots.filter(s => s.module === null);
        if (freeSlots.length > 0 && districtDef.allowedModules.length > 0) {
          const buildHeader = document.createElement('div');
          buildHeader.className = 'section-header';
          buildHeader.style.cssText = 'margin-bottom:4px;margin-top:6px;';
          buildHeader.innerText = 'BUILD MODULE';
          actionsEl.appendChild(buildHeader);

          for (const modType of districtDef.allowedModules) {
            const modInfo = BUILDINGS_INFO[modType] ?? {};
            const maxPerDist = modInfo.maxPerDistrict || Infinity;
            const currentInDistrict = district.slots.filter(s => s.module && s.module.type === modType).length;
            const isLimitReached = currentInDistrict >= maxPerDist;
            const regOk = regolith >= (modInfo.cost ?? 0);
            const compOk = components >= (modInfo.costComponents ?? 0);
            const hasCompatibleSlot = freeSlots.some(s => {
              if (modType === 'regolith_extractor' && s.terrain !== 'regolith') return false;
              if (modType === 'ice_extractor' && s.terrain !== 'ice') return false;
              if (modType === 'deep_drill' && s.terrain !== 'regolith') return false;
              return true;
            });
            const isDistrictReady = !district.mainBuilding.isConstructing;
            const canPlace = regOk && compOk && hasCompatibleSlot && isDistrictReady && !isLimitReached;

            const costStr = [
              (modInfo.cost ?? 0) > 0 ? `${ico('layers', 12)} ${modInfo.cost}` : '',
              (modInfo.costComponents ?? 0) > 0 ? `${ico('cpu', 12)} ${modInfo.costComponents}` : '',
            ].filter(Boolean).join(' ') || 'FREE';

            let details = costStr;
            if (isLimitReached) details += ` <span style="color:var(--red)">${ico('alert-triangle', 11)} MAX ${maxPerDist} PER DISTRICT</span>`;
            else if (!hasCompatibleSlot) details += ` <span style="color:var(--red)">${ico('alert-circle', 11)} NO COMPATIBLE SLOT</span>`;
            if (!isDistrictReady) details += ` <span style="color:var(--yellow)">${ico('clock', 11)} CENTER UNDER CONSTRUCTION</span>`;

            const btn = document.createElement('button');
            btn.className = 'ctx-btn';
            btn.disabled = !canPlace;
            btn.style.marginBottom = '3px';

            let errorMsg = '';
            if (isLimitReached) errorMsg = ` [MAX CAPACITY REACHED]`;
            else if (!hasCompatibleSlot) errorMsg = ` [NO COMPATIBLE SLOT]`;
            else if (!isDistrictReady) errorMsg = ` [CENTER UNDER CONSTRUCTION]`;
            else if (!regOk || !compOk) errorMsg = ` [INSUFFICIENT RESOURCES]`;

            const isDeficit = (opts.energyProduced ?? 1) < (opts.energyRequired ?? 0);
            if (!errorMsg && isDeficit) errorMsg = ' [INSUFFICIENT GRID POWER]';

            btn.innerHTML = `
              <div class="ctx-btn-title">${ico(BUILDING_ICONS[modType] ?? 'box')} ${modInfo.name ?? modType}</div>
              <div class="ctx-btn-details">${details}<span style="color:var(--red); font-weight:bold;">${errorMsg}</span></div>
            `;
            btn.addEventListener('click', () => opts.onStartBuildModule?.(modType));
            btn.addEventListener('mouseenter', (e) => this.showBuildPreview(modType, e.target.getBoundingClientRect()));
            btn.addEventListener('mouseleave', () => this.hideBuildPreview());
            actionsEl.appendChild(btn);
          }
        }
      }

      // 2. Statistiche Base (Si aggiungono in fondo se era un distretto, o sono l'inizio se è un modulo)
      const rows = [];
      if (building.type === 'regolith_extractor' || building.type === 'ice_extractor' || building.type === 'deep_drill') {
        const cap = opts.capacity ?? 0;
        const capColor = cap > 50 ? 'var(--white)' : 'var(--red)';
        rows.push(`<div style="color:${capColor}; font-weight:bold;">${ico('database')} Remaining: ${cap} units</div>`);
      }
      if (info.o2CapBonus > 0) rows.push(`<div style="color:#58a6ff; font-weight:bold;">${ico('chevrons-up')} +${info.o2CapBonus} OXYGEN CAPACITY</div>`);
      if (info.energyCapBonus > 0) rows.push(`<div style="color:#ffd700; font-weight:bold;">${ico('chevrons-up')} +${info.energyCapBonus} ENERGY STORAGE</div>`);
      if (info.energyGenDay > 0) rows.push(`<div style="color:var(--green)">${ico('zap')} +${info.energyGenDay} E/TICK (DAY)</div>`);
      if (info.energyGenNight > 0 && info.energyGenNight !== info.energyGenDay) rows.push(`<div style="color:var(--green)">${ico('zap')} +${info.energyGenNight} E/TICK (NIGHT)</div>`);
      if (info.energyCons > 0) {
        const commandBonus = building.type === 'hab_module' && opts.clusterBonus?.hasCommandBonus === true;
        rows.push(commandBonus
          ? `<div>${ico('zap')} <span style="color:var(--red);text-decoration:line-through">−${info.energyCons} E/TICK</span> <span style="color:var(--green)">0 E</span></div>`
          : `<div style="color:var(--red)">${ico('zap')} −${info.energyCons} E/TICK</div>`
        );
      }
      if (info.regolithGen > 0) rows.push(`<div style="color:var(--col-reg)">${ico('layers')} +${info.regolithGen} REG/TICK</div>`);
      if (info.iceGen > 0) rows.push(`<div style="color:var(--col-ice)">${ico('snowflake')} +${info.iceGen} ICE/TICK</div>`);
      if (info.conversion) {
        const { inputRes, inputCost, outputRes, outputAmount } = info.conversion;
        const inM = RES_META[inputRes] ?? { icon: 'circle', label: inputRes, color: 'inherit' };
        const outM = RES_META[outputRes] ?? { icon: 'circle', label: outputRes, color: 'inherit' };
        rows.push(`<div>${ico('refresh-cw')} <span style="color:${inM.color}">${ico(inM.icon)} ${inputCost} ${inM.label}</span> ${ico('arrow-right')} <span style="color:${outM.color}">${ico(outM.icon)} ${outputAmount} ${outM.label}</span> / TICK</div>`);
      }
      if (info.isPassable) rows.push(`<div style="color:var(--text-dim)">${ico('move-right')} Passabile</div>`);

      if (rows.length > 0) statsEl.innerHTML += `<div style="margin-top:6px;">${rows.join('')}</div>`;

      // 3. Bonus Sinergia
      if (opts.clusterBonus != null) {
        const { buildingType, count, bonus } = opts.clusterBonus;
        let synergyHtml = '';
        if (buildingType === 'hab_module') {
          const { habCount, habBonus, hasCommandBonus } = opts.clusterBonus;
          synergyHtml += habBonus > 0
            ? `<div style="color:var(--green);margin-top:6px;">${ico('star')} Bonus: +${habBonus} Crew (${habCount} HAB)</div>`
            : `<div style="color:var(--text-dim);margin-top:6px;">${ico('lightbulb')} Connect more HABs to increase capacity.</div>`;
          synergyHtml += hasCommandBonus
            ? `<div style="color:var(--green);margin-top:4px;">${ico('star')} Bonus: Grid Power (0 cost)</div>`
            : `<div style="color:var(--text-dim);margin-top:4px;">${ico('lightbulb')} Connect Command Module to zero consumption.</div>`;
        } else if (buildingType === 'solar_array') {
          synergyHtml = bonus > 0 ? `<div style="color:var(--green);margin-top:6px;">${ico('star')} Bonus: +${bonus} Energy (${count + 1} Panels)</div>` : `<div style="color:var(--text-dim);margin-top:6px;">${ico('lightbulb')} Connect 2+ panels in same District.</div>`;
        } else if (buildingType === 'isru_plant') {
          synergyHtml = bonus > 0 ? `<div style="color:var(--green);margin-top:6px;">${ico('star')} Bonus: +${bonus} O₂ (${count} Ice Extractors)</div>` : `<div style="color:var(--text-dim);margin-top:6px;">${ico('lightbulb')} Connect Ice Extractors for more O₂.</div>`;
        } else if (buildingType === 'component_factory') {
          synergyHtml = bonus > 0 ? `<div style="color:var(--green);margin-top:6px;">${ico('star')} Bonus: +${bonus} Components (${count} Reg Extractors)</div>` : `<div style="color:var(--text-dim);margin-top:6px;">${ico('lightbulb')} Group with Regolith Extractors.</div>`;
        } else if (buildingType === 'regolith_extractor') {
          synergyHtml = bonus > 0 ? `<div style="color:var(--col-reg);margin-top:6px;">${ico('star')} Bonus: +${bonus} REG/TICK (${count} Extractors)</div>` : `<div style="color:var(--text-dim);margin-top:6px;">${ico('lightbulb')} Connect more Regolith Extractors.</div>`;
        } else if (buildingType === 'ice_extractor') {
          synergyHtml = bonus > 0 ? `<div style="color:var(--col-ice);margin-top:6px;">${ico('star')} Bonus: +${bonus} ICE/TICK (${count} Extractors)</div>` : `<div style="color:var(--text-dim);margin-top:6px;">${ico('lightbulb')} Connect more Ice Extractors.</div>`;
        }
        if (synergyHtml) statsEl.innerHTML += synergyHtml;
      }

      // 4. Azioni (Bottoni Base)
      if (building.type === 'rover_workshop' || building.type === 'command') {
        this._addBuildRoverButton(actionsEl, warningsEl, opts);
      }

      if (building.type !== 'conduit' && building.type !== 'command' && !info.alwaysOn) {
        const powered = building.isPowered !== false;
        const btnPower = document.createElement('button');
        btnPower.className = 'ctx-btn';
        btnPower.disabled = building.isConstructing === true;
        btnPower.innerHTML = powered ? `${ico('power-off')} POWER OFF` : `${ico('power')} POWER ON`;
        btnPower.addEventListener('click', () => opts.onTogglePower?.(building));
        actionsEl.appendChild(btnPower);
      }

      if (info.crewReq > 0) {
        const btnPriority = document.createElement('button');
        btnPriority.className = 'ghost-btn';
        btnPriority.style.cssText = 'padding:8px 16px; font-size:11px; width:100%; margin-top:4px; border:1px solid rgba(240, 240, 250, 0.35);';
        if (building.isHighPriority) {
          btnPriority.style.background = 'rgba(240, 240, 250, 0.15)';
          btnPriority.innerHTML = `${ico('check-square')} PRIORITY OVERRIDE: ACTIVE`;
        } else {
          btnPriority.innerHTML = `${ico('square')} PRIORITY OVERRIDE: OFF`;
        }
        btnPriority.addEventListener('click', () => opts.onTogglePriority?.(building));
        actionsEl.appendChild(btnPriority);
      }

      if (!opts.hideDemolish) {
        const btnDemolish = document.createElement('button');
        const roverAdiacent = opts.canDemolish;

        if (building.isConstructing) {
          let totalRefund = info.cost ?? 0;
          if (building.autoConnectCost) totalRefund += building.autoConnectCost;
          btnDemolish.className = 'ghost-btn';
          btnDemolish.style.cssText = 'width:100%; margin-top:8px;';
          btnDemolish.innerHTML = `${ico('rotate-ccw')} CANCEL [100% REFUND: ${totalRefund} REG]`;
        } else {
          btnDemolish.className = 'ghost-btn danger-border';
          btnDemolish.style.cssText = 'width:100%; margin-top:8px; border-color:rgba(248,81,73,0.4); color:#f85149;';
          btnDemolish.innerHTML = `${ico('hammer')} DEMOLISH <span style="opacity:0.6; font-size:10px;">[50% REFUND]</span>`;
        }

        btnDemolish.disabled = !roverAdiacent;
        if (!roverAdiacent) {
          btnDemolish.style.opacity = '0.5';
          btnDemolish.innerHTML = `${ico('hammer')} DEMOLISH <span style="font-weight:bold; color:var(--yellow); font-size:9px;">[ROVER REQUIRED]</span>`;
          warningsEl.innerHTML = `${ico('alert-circle')} Move a Rover nearby to demolish.`;
        }

        btnDemolish.addEventListener('click', () => opts.onDemolish?.());
        actionsEl.appendChild(btnDemolish);
      }

      refreshIcons();
    }
  }

  // ===========================================================================
  // HANDLER EVENTI
  // ===========================================================================

  _onResourcesUpdated(data) {
    const {
      regolith, ice, oxygen, components,
      energyProduced, energyConsumed, energyRequired,
      energyStored, maxEnergy,
      crewTotal, crewEmployed,
      deltaReg, deltaIce, deltaO2, deltaComp, deltaEnergy,
      // --- SPRINT 2: Nuovi Dati con Fallback di Sicurezza ---
      maxOxygen = 200,
      deadlockActive = false,
      deadlockTime = 0
    } = data;

    this._setChip('res-reg-val', 'res-reg-delta', regolith, deltaReg);
    this._setChip('res-comp-val', 'res-comp-delta', components, deltaComp ?? 0);
    this._setChip('res-ice-val', 'res-ice-delta', ice, deltaIce);

    // --- LOGICA OXYGEN: CURRENT / MAX con DELTA FLUIDO ---
    const o2ValEl = document.getElementById('res-o2-val');
    const o2DeltaEl = document.getElementById('res-o2-delta');

    if (o2ValEl) {
      o2ValEl.innerText = `${Math.round(oxygen)} / ${maxOxygen}`;
      // Cambia colore se siamo vicini al limite (Full spectral blue)
      o2ValEl.style.color = (oxygen >= maxOxygen) ? '#58a6ff' : 'var(--f0f0fa)';
    }

    if (o2DeltaEl) {
      // Mostra sempre il delta produttivo, anche se il serbatoio è pieno
      const sign = deltaO2 > 0 ? '+' : '';
      o2DeltaEl.innerText = `(${sign}${Math.round(deltaO2)})`;
      o2DeltaEl.className = 'res-delta ' + (deltaO2 > 0 ? 'positive' : deltaO2 < 0 ? 'negative' : 'zero');
    }

    // --- LOGICA ENERGY: PRODUCTION + STORAGE ---
    const isDischarging = energyRequired > energyProduced;
    const energyLabel = isDischarging ?
      `<span class="blink" style="color:#f85149">[DISCHARGING]</span>` :
      `NET: +${Math.max(0, energyProduced - energyRequired)}`;

    this._setEl('res-nrg-val', `STORED: ${Math.round(energyStored)} / ${maxEnergy}`);

    const nrgDeltaEl = document.getElementById('res-nrg-delta');
    if (nrgDeltaEl) {
      nrgDeltaEl.innerHTML = energyLabel;
      nrgDeltaEl.className = 'res-delta ' + (isDischarging ? 'negative' : 'positive');
    }


    const chipNrg = document.getElementById('chip-nrg');
    const blackoutEl = document.getElementById('blackout-warning');
    const isBlackout = energyRequired > energyProduced && energyStored <= 0;
    chipNrg?.classList.toggle('alert-pulse', isBlackout);
    if (blackoutEl) blackoutEl.style.display = isBlackout ? 'block' : 'none';

    this._setEl('res-crew-val', `${crewEmployed} / ${crewTotal}`);
    const crewFree = crewTotal - crewEmployed;
    const crewDeltaEl = document.getElementById('res-crew-delta');
    if (crewDeltaEl) {
      crewDeltaEl.innerText = `(+${crewFree})`;
      crewDeltaEl.className = 'res-delta ' + (crewFree > 0 ? 'positive' : 'zero');
    }
    const crewShort = crewEmployed >= crewTotal && crewTotal > 0;
    document.getElementById('chip-crew')?.classList.toggle('alert-pulse', crewShort);
    const crewWarnEl = document.getElementById('crew-warning');
    if (crewWarnEl) crewWarnEl.style.display = crewShort ? 'block' : 'none';

    // --- DEADLOCK WARNING ---
    const deadlockWarnEl = document.getElementById('deadlock-warning');
    const deadlockClockEl = document.getElementById('deadlock-countdown');
    if (deadlockWarnEl) {
      deadlockWarnEl.style.display = deadlockActive ? 'block' : 'none';
      if (deadlockClockEl) deadlockClockEl.innerText = `${deadlockTime}s`;
    }
  }

  _onO2Emergency({ active, evacTime }) {
    const elO2Warn = document.getElementById('o2-emergency-warning');
    const elCountdown = document.getElementById('evac-countdown');
    const chipO2 = document.getElementById('chip-o2');

    if (active) {
      if (elO2Warn) elO2Warn.style.display = 'block';
      if (elCountdown) elCountdown.innerText = `${evacTime}s`;
      chipO2?.classList.add('alert-pulse');
    } else {
      if (elO2Warn) elO2Warn.style.display = 'none';
      chipO2?.classList.remove('alert-pulse');
    }

    // Sprint 3: Vignette
    const vignette = document.getElementById('vignette-overlay');
    if (vignette) {
      vignette.classList.toggle('active', active);
    }
  }

  _onHazardEvent({ type, message }) {
    const log = document.getElementById('hazard-log');
    if (!log) return;

    const div = document.createElement('div');
    const typeClass = type.toLowerCase().split(' ')[0]; // eclipse, solar, micrometeorites
    div.className = `hazard-notification ${typeClass}`;
    div.innerHTML = message;

    log.prepend(div);
    refreshIcons();

    // Auto-remove
    setTimeout(() => {
      div.classList.add('hazard-fadeOut');
      setTimeout(() => div.remove(), 1000);
    }, 10000);
  }

  _onDayNightChanged({ isDay }) {
    const timeEl = document.getElementById('time-display-top');
    const icoEl = timeEl?.querySelector('.ico-time');
    const labelEl = document.getElementById('time-label');
    if (!timeEl) return;

    if (labelEl) labelEl.innerText = isDay ? 'DAY' : 'NIGHT';
    if (icoEl) {
      icoEl.setAttribute('data-lucide', isDay ? 'sun' : 'moon');
      refreshIcons();
    }
    timeEl.style.opacity = isDay ? '0.9' : '0.55';
  }

  _onGameOver({ reason }) {
    const gameOverScreen = document.getElementById('game-over-screen');
    const gameOverReason = document.getElementById('game-over-reason');
    if (gameOverScreen && gameOverReason) {
      gameOverReason.innerText = reason;
      gameOverScreen.style.display = 'flex';
    }
  }

  // ===========================================================================
  // METODI PUBBLICI
  // ===========================================================================

  updateTimeTracker(isDay, dayNumber, remainingSecs, progress) {
    const iconEl = document.getElementById('time-icon');
    const textEl = document.getElementById('time-text');
    const dayEl = document.getElementById('time-day-label');
    const barEl = document.getElementById('time-bar-fill');
    const container = document.getElementById('time-tracker-ui');
    if (!iconEl || !textEl || !barEl || !container) return;

    // 1. Aggiorna Icona
    const iconName = isDay ? 'sun' : 'moon';
    if (iconEl.getAttribute('data-lucide') !== iconName) {
      iconEl.setAttribute('data-lucide', iconName);
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: iconEl.parentElement });
    }

    // 2. Formatta tempo e testo
    const m = Math.floor(remainingSecs / 60);
    const s = remainingSecs % 60;
    const timeStr = `${m}:${s.toString().padStart(2, '0')}`;

    textEl.innerText = timeStr;
    dayEl.innerText = `DAY ${dayNumber.toString().padStart(2, '0')}`;

    // 3. Colore e Stato (Technical Accents)
    const activeColor = isDay ? '#ffd700' : '#58a6ff';
    container.style.borderLeftColor = activeColor;

    const phaseLabel = isDay ? 'DAY' : 'NIGHT';
    // Potremmo usare una variabile CSS per il colore d'accento
    container.style.setProperty('--phase-accent', activeColor);

    // 4. Aggiorna Barra
    barEl.style.width = `${(1 - progress) * 100}%`;
  }

  setSelectedBuildingButton(_buttonEl) { }

  updatePauseButton(isPaused) {
    const btn = document.getElementById('btn-pause');
    const icoEl = document.getElementById('ico-pause');
    if (!btn) return;

    if (isPaused) {
      btn.classList.add('active');
      if (icoEl) { icoEl.setAttribute('data-lucide', 'play'); refreshIcons(); }
    } else {
      btn.classList.remove('active');
      if (icoEl) { icoEl.setAttribute('data-lucide', 'pause'); refreshIcons(); }
    }
  }

  updateSpeedButtons(speed) {
    const speedBtns = document.querySelectorAll('.speed-btn');
    speedBtns.forEach(btn => {
      const btnSpeed = parseInt(btn.dataset.speed);
      btn.classList.toggle('active', btnSpeed === speed);
    });
  }

  // ===========================================================================
  // TERMINAL HOUSTON (SPRINT 4)
  // ===========================================================================

  /**
   * Stampa un messaggio nel terminale con effetto typewriter.
   * Gestisce una coda sequenziale per evitare sovrapposizioni.
   */
  printCommsMessage(text, isAlert = false) {
    this._commsQueue.push({ text, isAlert });
    if (!this._commsBusy) {
      this._processNextComms();
    }
  }

  _processNextComms() {
    if (this._commsQueue.length === 0) {
      this._commsBusy = false;
      return;
    }

    this._commsBusy = true;
    const { text, isAlert } = this._commsQueue.shift();
    const container = document.getElementById('comms-terminal');
    if (!container) {
      this._commsBusy = false;
      return;
    }

    // 1. Invecchia i messaggi esistenti
    const existingLines = container.querySelectorAll('.comms-line');
    existingLines.forEach(line => line.classList.add('old'));

    // 2. Rimuovi i messaggi in eccesso
    if (existingLines.length >= this._maxCommsLines) {
      container.removeChild(existingLines[0]);
    }

    // 3. Crea nuova riga
    const line = document.createElement('div');
    line.className = 'comms-line' + (isAlert ? ' alert' : '');
    container.appendChild(line);

    // 4. Effetto Typewriter
    let charIdx = 0;
    const typeSpeed = 25; // ms per carattere

    const timer = setInterval(() => {
      line.textContent += text[charIdx];
      charIdx++;

      if (charIdx >= text.length) {
        clearInterval(timer);
        // Piccola pausa prima del prossimo messaggio
        setTimeout(() => this._processNextComms(), 500);
      }
    }, typeSpeed);
  }

  // ===========================================================================
  // HELPER DOM PRIVATI
  // ===========================================================================

  _setEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  }

  _setChip(valId, deltaId, value, delta) {
    this._setEl(valId, Math.round(value));
    const deltaEl = document.getElementById(deltaId);
    if (deltaEl) {
      const sign = delta > 0 ? '+' : '';
      deltaEl.innerText = `(${sign}${Math.round(delta)})`;
      deltaEl.className = 'res-delta ' + (delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'zero');
    }
  }
  _addBuildRoverButton(actionsEl, warningsEl, opts) {
    const isCompCost = ROVER_COST_TYPE === 'components';
    const canAffordRover = isCompCost ? opts.components >= ROVER_COST : opts.regolith >= ROVER_COST;
    const isLimitReached = (opts.activeRoversCount ?? 0) >= (opts.maxRovers ?? 0);
    const costLabel = isCompCost ? `${ROVER_COST} Comp` : `${ROVER_COST} Reg`;

    const btnRover = document.createElement('button');
    btnRover.className = 'ctx-btn primary';
    btnRover.disabled = !canAffordRover || isLimitReached;
    btnRover.innerHTML = `${ico('truck')} BUILD ROVER <span class="ctx-cost">${ico(isCompCost ? 'cpu' : 'layers')} ${costLabel}</span>`;
    btnRover.addEventListener('click', () => opts.onBuildRover?.());
    actionsEl.appendChild(btnRover);

    if (isLimitReached) {
      warningsEl.innerHTML = `${ico('alert-circle')} ROVER LIMIT REACHED (${opts.maxRovers}) - BUILD WORKSHOPS.`;
    } else if (!canAffordRover) {
      warningsEl.innerHTML = `${ico('alert-circle')} Need ${ROVER_COST} ${isCompCost ? 'Components' : 'Regolith'}.`;
    }
  }

  showTooltip(x, y, data) {
    const el = document.getElementById('game-tooltip');
    if (!el) return;

    let content = `<div class="tooltip-title">${data.title}</div>`;
    if (data.rows) {
      data.rows.forEach(row => {
        content += `<div class="tooltip-row"><span>${row.label}</span><span class="tooltip-val">${row.val}</span></div>`;
      });
    }

    el.innerHTML = content;
    el.classList.remove('hidden');

    // Posizionamento (offset rispetto al mouse)
    el.style.left = `${x + 15}px`;
    el.style.top = `${y + 15}px`;
  }

  hideTooltip() {
    document.getElementById('game-tooltip')?.classList.add('hidden');
  }

  // ===========================================================================
  // TOOLTIP ANTEPRIMA COSTRUZIONE GRANDE
  // ===========================================================================

  showBuildPreview(type, rect) {
    const el = document.getElementById('build-preview-tooltip');
    if (!el) return;

    const info = BUILDINGS_INFO[type];
    if (!info) return;

    const previewSrc = BUILDING_PREVIEWS[type] || null;
    const iconName = BUILDING_ICONS[type] || 'box';

    // 1. Titolo
    let html = `<div class="bp-title">${ico(iconName, 20)} ${info.name}</div>`;

    // 2. Immagine grande
    if (previewSrc) {
      html += `<div class="bp-img-box"><img src="${previewSrc}" alt="${info.name}"></div>`;
    } else {
      html += `<div class="bp-img-box empty">[ NO VISUAL DATA ]</div>`;
    }

    // 3. Costi
    html += `<div class="bp-section">COSTS</div><div class="bp-grid">`;
    let hasCost = false;
    if (info.cost > 0) { html += `<div style="color:var(--col-reg)">${ico('layers')} ${info.cost} Regolith</div>`; hasCost = true; }
    if (info.costComponents > 0) { html += `<div style="color:var(--col-comp)">${ico('cpu')} ${info.costComponents} Components</div>`; hasCost = true; }
    if (!hasCost) html += `<div style="color:var(--text-dim)">Free Structure</div>`;
    html += `</div>`;

    // 4. Statistiche & Consumi
    html += `<div class="bp-section">STATS & PRODUCTION</div><div class="bp-grid">`;
    let hasStats = false;

    // Supporto Vitale e Crew
    if (info.crewReq > 0) { html += `<div style="color:var(--text-dim)">${ico('user')} Required Crew: ${info.crewReq}</div>`; hasStats = true; }
    if (info.crewGen > 0) { html += `<div style="color:var(--green)">${ico('users')} Max Crew Capacity: +${info.crewGen}</div>`; hasStats = true; }
    if (info.o2Cons > 0) { html += `<div style="color:var(--red)">${ico('wind')} O₂ Consumption: -${info.o2Cons}/tick</div>`; hasStats = true; }
    if (info.o2CapBonus > 0) { html += `<div style="color:var(--col-o2)">${ico('chevrons-up')} O₂ Storage: +${info.o2CapBonus}</div>`; hasStats = true; }

    // Energia
    if (info.energyCons > 0) { html += `<div style="color:var(--red)">${ico('zap')} Power Need: -${info.energyCons} E/tick</div>`; hasStats = true; }
    if (info.energyGenDay > 0) { html += `<div style="color:var(--green)">${ico('zap')} Power Gen: +${info.energyGenDay} E/tick (Day)</div>`; hasStats = true; }
    if (info.energyGenNight > 0) { html += `<div style="color:var(--green)">${ico('zap')} Power Gen: +${info.energyGenNight} E/tick (Night)</div>`; hasStats = true; }
    if (info.energyCapBonus > 0) { html += `<div style="color:#ffd700">${ico('chevrons-up')} Battery Storage: +${info.energyCapBonus} E</div>`; hasStats = true; }

    // Risorse Grezze
    if (info.regolithGen > 0) { html += `<div style="color:var(--col-reg)">${ico('layers')} Yield: +${info.regolithGen} Regolith/tick</div>`; hasStats = true; }
    if (info.iceGen > 0) { html += `<div style="color:var(--col-ice)">${ico('snowflake')} Yield: +${info.iceGen} Ice/tick</div>`; hasStats = true; }

    // Conversioni Complesse (ISRU, Component Factory, ecc)
    if (info.conversion) {
      const { inputRes, inputCost, outputRes, outputAmount } = info.conversion;
      const inM = RES_META[inputRes] || { icon: 'circle', color: 'inherit' };
      const outM = RES_META[outputRes] || { icon: 'circle', color: 'inherit' };
      html += `<div style="color:var(--text-dim); grid-column: 1 / -1;">
        ${ico('refresh-cw')} Converts <span style="color:${inM.color}">${inputCost} ${inputRes}</span> ${ico('arrow-right', 12)} <span style="color:${outM.color}">${outputAmount} ${outputRes}</span>/tick
      </div>`;
      hasStats = true;
    }

    // Altri dati e Hard Caps
    if (info.maxPerDistrict) { html += `<div style="color:var(--yellow)">${ico('alert-triangle')} Hard Cap: ${info.maxPerDistrict} per District</div>`; hasStats = true; }
    if (info.terrain === 'regolith' || info.terrain === 'ice') {
      const tColor = info.terrain === 'ice' ? 'var(--col-ice)' : 'var(--col-reg)';
      html += `<div style="color:${tColor}">${ico('map-pin')} Requires ${info.terrain.toUpperCase()} vein</div>`;
      hasStats = true;
    }

    if (!hasStats) html += `<div style="color:var(--text-dim)">Passive Structure (No active stats)</div>`;
    html += `</div>`;

    // 5. Bonus Sinergia (es. Pannelli Solari vicini)
    if (info.clusterSynergies) {
      html += `<div class="bp-section">SYNERGY BONUS</div><div class="bp-grid">`;
      const synType = Object.keys(info.clusterSynergies)[0];
      const val = info.clusterSynergies[synType].valuePerBuilding;
      const synName = BUILDINGS_INFO[synType]?.name || synType;
      html += `<div style="color:var(--green);">${ico('star')} +${val} Output per connected ${synName}</div>`;
      html += `</div>`;
    }

    // 6. Moduli Installabili (Solo per i Centri Distretto)
    if (info.isDistrictCenter) {
      const dTypeKey = Object.keys(DISTRICT_TYPES).find(k => DISTRICT_TYPES[k].centerBuilding === type);
      if (dTypeKey) {
        const dDef = DISTRICT_TYPES[dTypeKey];
        html += `<div class="bp-section">ALLOWED SUB-MODULES</div><div class="bp-grid">`;
        for (const mod of dDef.allowedModules) {
          const mInfo = BUILDINGS_INFO[mod];
          html += `<div style="color:var(--white)">${ico(BUILDING_ICONS[mod] || 'box')} ${mInfo.name}</div>`;
        }
        html += `</div>`;
      }
    }

    el.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });

    // MOSTRAMO E POSIZIONIAMO L'ELEMENTO
    el.classList.add('visible');

    // Posizionamento: a sinistra della sidebar
    const tooltipWidth = 320;
    const gap = 16;
    let leftPos = rect.left - tooltipWidth - gap;
    let topPos = rect.top;

    // Evita che il tooltip sfori sopra lo schermo
    if (topPos < 16) topPos = 16;

    el.style.left = `${leftPos}px`;
    el.style.top = `${topPos}px`;

    // Regolazione di sicurezza: se sfora sotto lo schermo, lo allinea col margine inferiore
    requestAnimationFrame(() => {
      const bottomEdge = topPos + el.offsetHeight;
      if (bottomEdge > window.innerHeight - 16) {
        el.style.top = `${window.innerHeight - el.offsetHeight - 16}px`;
      }
    });
  }

  hideBuildPreview() {
    const el = document.getElementById('build-preview-tooltip');
    if (el) el.classList.remove('visible');
  }
}