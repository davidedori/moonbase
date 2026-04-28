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
  // Span inline-flex: icona e numero attaccati, spazio gestito dal gap del parent
  const S = (color, iconName, val) =>
    `<span style="color:${color};display:inline-flex;align-items:center;gap:2px;">${ico(iconName, 12)}${val}</span>`;

  const costParts = [];
  const effectParts = [];

  if (info.cost > 0)
    costParts.push(S('var(--col-reg)', 'layers', info.cost));
  if (info.costComponents > 0)
    costParts.push(S('var(--col-comp)', 'cpu', info.costComponents));

  if (info.energyGenDay > 0) {
    const dayOnly = !info.energyGenNight || info.energyGenNight === 0;
    effectParts.push(S('var(--green)', 'zap', `+${info.energyGenDay}`) + (dayOnly ? ico('sun', 10) : ''));
    if (info.energyGenNight > 0 && info.energyGenNight !== info.energyGenDay)
      effectParts.push(S('var(--col-nrg)', 'zap', `+${info.energyGenNight}`) + ico('moon', 10));
  }
  if (info.regolithGen > 0)  effectParts.push(S('var(--col-reg)',  'layers',    `+${info.regolithGen}`));
  if (info.iceGen > 0)       effectParts.push(S('var(--col-ice)',  'snowflake', `+${info.iceGen}`));
  if (info.crewGen > 0)      effectParts.push(S('var(--col-crew)', 'users',     `+${info.crewGen}`));
  if (info.o2CapBonus > 0)   effectParts.push(S('var(--col-o2)',   'wind',      `+${info.o2CapBonus}`));
  if (info.energyCapBonus > 0) effectParts.push(S('var(--col-nrg)', 'battery-full', `+${info.energyCapBonus}`));
  if (info.conversion) {
    const { inputRes, inputCost, outputRes, outputAmount } = info.conversion;
    const inM  = RES_META[inputRes]  ?? { icon: 'circle', color: 'inherit' };
    const outM = RES_META[outputRes] ?? { icon: 'circle', color: 'inherit' };
    effectParts.push(
      `<span style="display:inline-flex;align-items:center;gap:3px;color:var(--text-dim)">` +
      S(inM.color,  inM.icon,  inputCost) +
      ico('arrow-right', 10) +
      S(outM.color, outM.icon, outputAmount) +
      `</span>`
    );
  }
  if (info.energyCons > 0)  effectParts.push(S('var(--red)',       'zap',  `−${info.energyCons}`));
  if (info.o2Cons > 0)      effectParts.push(S('var(--red)',       'wind', `−${info.o2Cons}`));
  if (info.crewReq > 0)     effectParts.push(S('var(--text-dim)', 'user', `×${info.crewReq}`));
  if (info.terrain === 'regolith') effectParts.push(S('var(--col-reg)', 'map-pin', ''));
  if (info.terrain === 'ice')      effectParts.push(S('var(--col-ice)', 'map-pin', ''));

  const sep = costParts.length > 0 && effectParts.length > 0
    ? [`<span style="color:var(--ghost-border-str)">·</span>`] : [];
  return [...costParts, ...sep, ...effectParts].join('');
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

    const btnResourceLens = document.getElementById('btn-resource-lens');
    if (btnResourceLens) btnResourceLens.addEventListener('click', () => cb.onToggleResourceLens?.());

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
    const distIconEl = document.getElementById('ctx-district-icon');
    if (distIconEl) distIconEl.innerHTML = '';

    sidebarEl.classList.add('visible');

    const regolith = opts.regolith ?? 0;
    const components = opts.components ?? 0;

    // ── ROVER ─────────────────────────────────────────────────────────────────
    if (entity.type === 'rover') {
      const rover = entity.ref;
      nameEl.innerHTML = `Rover <span style="color:var(--text-dim);font-size:0.6rem;font-weight:400;">${ico('map-pin', 9)} ${rover.col}, ${rover.row}</span>`;
      previewEl.src = './graphics/rover-NE.png';

      const maxCharge = rover.maxCharge ?? 10;
      const powered = rover.isPowered !== false;

      // Status badge
      const roverState = rover.isWreck ? 'wreck' : !powered ? 'off' : 'active';
      const roverStateLabel = { wreck: 'WRECK', off: 'OFFLINE', active: 'ONLINE' }[roverState];
      const roverStateIcon  = { wreck: 'skull', off: 'power-off', active: 'check-circle' }[roverState];

      // Charge
      const chargePct = maxCharge > 0 ? Math.min(100, (rover.charge / maxCharge) * 100) : 0;
      const chargeColor = chargePct > 60 ? 'var(--green)' : chargePct > 30 ? 'var(--yellow)' : 'var(--red)';

      // Condition
      const durability = rover.durability ?? 100;

      // Stile riga comune (barra inline senza chip)
      const BAR = (pct, color) => `
        <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
          <div style="flex:1;height:2px;background:rgba(255,255,255,0.12);border-radius:2px;overflow:hidden;">
            <div style="height:100%;border-radius:2px;transition:width 0.3s ease;width:${pct}%;background:${color};"></div>
          </div>
          <span class="chip-mini-text">${Math.round(pct)}%</span>
        </div>`;

      statsEl.innerHTML = `
        <div><span class="ctx-status-badge ${roverState}">${ico(roverStateIcon, 11)} ${roverStateLabel}</span></div>

        <div id="_rover-power-toggle" style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;cursor:pointer;">
          <span style="display:flex;align-items:center;gap:6px;font-size:0.75rem;">${ico('power', 13)} POWER</span>
          <span class="ctx-power-switch ${powered ? 'on' : ''}"></span>
        </div>

        <div style="padding:4px 0;">
          <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;">${ico('battery', 13)} <span style="color:${chargeColor};font-weight:700">${rover.charge}</span><span style="color:var(--text-dim);font-size:0.63rem">CHARGE</span></div>
          ${BAR(chargePct, chargeColor)}
        </div>

        <div style="padding:4px 0;">
          <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;">${ico('shield', 13)} <span style="color:#58a6ff;font-weight:700">${Math.round(durability)}%</span><span style="color:var(--text-dim);font-size:0.63rem">CONDITION</span></div>
          ${BAR(durability, '#58a6ff')}
        </div>`;

      // Wire click sul toggle dopo aver scritto l'innerHTML
      statsEl.querySelector('#_rover-power-toggle')?.addEventListener('click', () => opts.onTogglePower?.(rover));

      const header = document.createElement('div');
      header.className = 'section-header';
      header.style.marginTop = '8px';
      header.innerText = 'CONSTRUCTION';
      actionsEl.appendChild(header);

      if (!powered) {
        const powerWarn = document.createElement('div');
        powerWarn.style.cssText = 'display:flex;align-items:center;gap:5px;padding:3px 0;font-family:"Space Mono","Courier New",monospace;font-size:0.63rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--yellow);';
        powerWarn.innerHTML = `${ico('zap-off', 11)} POWER ON TO BUILD`;
        actionsEl.appendChild(powerWarn);
      }

      if (opts.damagedConduit) {
        const repairCost = BUILDINGS_INFO['conduit']?.cost ?? 5;
        const canAffordRepair = regolith >= repairCost;
        const repairBtn = document.createElement('button');
        repairBtn.className = 'ctx-btn';
        repairBtn.disabled = !powered || !canAffordRepair;
        let repairError = '';
        if (!powered) repairError = ' [ROVER OFFLINE]';
        else if (!canAffordRepair) repairError = ' [INSUFFICIENT RESOURCES]';
        repairBtn.innerHTML = `
          <div class="ctx-btn-title">${ico('wrench')} REPAIR CONDUIT</div>
          <div class="ctx-btn-details">${ico('hexagon')} ${repairCost} REGOLITH<span style="color:var(--red); font-weight:bold;">${repairError}</span></div>
        `;
        repairBtn.addEventListener('click', () => opts.onRepairConduit?.());
        actionsEl.appendChild(repairBtn);
      }

      for (const [type, info] of Object.entries(BUILDINGS_INFO)) {
        if (type === 'command' || type === 'conduit' || !info.isDistrictCenter) continue;

        const regOk = (info.cost ?? 0) === 0 || regolith >= (info.cost ?? 0);
        const compOk = (info.costComponents ?? 0) === 0 || components >= (info.costComponents ?? 0);
        const canAfford = regOk && compOk;
        const canBuild = !opts.buildableTypes || opts.buildableTypes.has(type);

        const btn = document.createElement('button');
        btn.className = 'ctx-btn';
        btn.disabled = !powered || !canAfford || !canBuild;

        const iconName = BUILDING_ICONS[type] ?? 'box';
        const distType = info.districtType ?? '';
        const details = _buildCostLines(type, info);

        let errorMsg = '';
        if (!canAfford) errorMsg = ' [INSUFFICIENT RESOURCES]';
        else if (!canBuild) errorMsg = ' [NO COMPATIBLE TERRAIN]';

        btn.className = 'ctx-btn dist-btn';
        btn.innerHTML = `
          <span class="dist-icon-diamond chip type-${distType}">${ico(iconName, 11)}</span>
          <div class="ctx-btn-text-col">
            <div class="ctx-btn-title">${info.name}</div>
            <div class="ctx-btn-details">${details}<span style="color:var(--red); font-weight:bold;">${errorMsg}</span></div>
          </div>
        `;
        btn.addEventListener('click', () => opts.onStartBuild?.(type));
        btn.addEventListener('mouseenter', (e) => this.showBuildPreview(type, e.target.getBoundingClientRect()));
        btn.addEventListener('mouseleave', () => this.hideBuildPreview());
        actionsEl.appendChild(btn);
      }

      if (!powered) {
        // avviso già mostrato in cima alla lista di costruzione
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

      // Status badge edificio
      if (opts.buildingState != null) {
        const stateMap = {
          active:       { label: 'ACTIVE',       icon: 'check-circle',   cls: 'active' },
          off:          { label: 'POWERED OFF',   icon: 'power-off',      cls: 'off' },
          constructing: { label: 'CONSTRUCTING',  icon: 'hammer',         cls: 'constructing' },
          standby:      { label: 'STANDBY',       icon: 'pause-circle',   cls: 'standby' },
          disconnected: { label: 'NO CONDUIT',    icon: 'unlink',         cls: 'disconnected' },
          damaged:      { label: 'DAMAGED',       icon: 'alert-triangle', cls: 'disconnected' },
        };
        const sm = stateMap[opts.buildingState] ?? stateMap.active;
        let extraBadge = '';
        if (opts.buildingState === 'standby') {
          if (building._lackingEnergy)
            extraBadge = `<span class="ctx-status-badge standby">${ico('zap-off', 11)} LACKS ENERGY</span>`;
          else if (building._lackingCrew)
            extraBadge = `<span class="ctx-status-badge standby">${ico('user-x', 11)} LACKS CREW</span>`;
        }
        statsEl.innerHTML = `<div style="margin-bottom:4px;"><span class="ctx-status-badge ${sm.cls}">${ico(sm.icon, 11)} ${sm.label}</span>${extraBadge}</div>`;
      }

      const previewSrc = BUILDING_PREVIEWS[building.type];
      if (previewSrc) previewEl.src = previewSrc;

      // 1. Dati Distretto (Se applicabile)
      if (info.isDistrictCenter && opts.districtInfo) {
        const { district, districtDef, slots } = opts.districtInfo;
        const distType = district.type;
        const distDefIcon = districtDef?.icon ?? iconName;
        const connIco = district.connected
          ? `<span style="color:var(--green)">${ico('check-circle')} Connected</span>`
          : `<span style="color:var(--red)">${ico('x-circle')} Conduit missing</span>`;

        if (distIconEl) {
          distIconEl.innerHTML = `<span class="dist-icon-diamond panel-lg type-${distType}">${ico(distDefIcon, 22)}</span>`;
        }
        nameEl.innerHTML = info.name ?? building.type;

        statsEl.innerHTML += `<div style="margin-top:2px;">${connIco}</div>`;

        // Moduli Occupati
        const occupiedSlots = slots.filter(s => s.module !== null);
        occupiedSlots.forEach(slot => {
          const modInfo = BUILDINGS_INFO[slot.module.type] ?? {};
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--ghost-bg);border:1px solid var(--ghost-border);border-radius:4px;padding:5px 8px;margin-bottom:4px;';
          const mod = slot.module;
          const modState = mod.isPowered === false ? 'off'
            : mod._econActive === false ? 'standby'
            : 'active';
          row.innerHTML = `<span style="font-size:0.72rem;color:var(--white);display:flex;align-items:center;gap:4px;"><span class="module-status-dot ${modState}"></span>${ico(BUILDING_ICONS[mod.type] ?? 'box')} ${modInfo.name ?? mod.type}</span>`;

          const removeBtn = document.createElement('button');
          removeBtn.style.cssText = 'padding:2px 8px;font-size:0.65rem;font-family:"Space Mono","Courier New",monospace;background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.4);color:var(--red);border-radius:32px;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px;';
          removeBtn.innerHTML = `${ico('x', 11)} REMOVE`;
          removeBtn.addEventListener('click', () => opts.onRemoveModule?.(district, slot.index));

          row.appendChild(removeBtn);
          actionsEl.appendChild(row);
        });

        // Efficiency distretto: moduli attivi / totale
        if (occupiedSlots.length > 0) {
          const activeCount = occupiedSlots.filter(s =>
            s.module.isPowered !== false && s.module._econActive !== false
          ).length;
          const effPct = Math.round((activeCount / occupiedSlots.length) * 100);
          const effColor = effPct === 100 ? 'var(--green)' : effPct > 50 ? 'var(--yellow)' : 'var(--red)';
          statsEl.innerHTML += `
            <div class="ctx-district-efficiency">
              <div class="eff-label">${activeCount}/${occupiedSlots.length} MODULES ACTIVE</div>
              <div class="eff-bar-row">
                <div class="eff-bar"><div class="eff-bar-fill" style="width:${effPct}%;background:${effColor}"></div></div>
                <span class="chip-mini-text">${effPct}%</span>
              </div>
            </div>`;
        }

        // Power toggle distretto (sopra BUILD MODULE)
        if (building.type !== 'command' && !info.alwaysOn) {
          const powered = building.isPowered !== false;
          const distPowerRow = document.createElement('div');
          distPowerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;cursor:pointer;';
          distPowerRow.innerHTML = `
            <span style="display:flex;align-items:center;gap:6px;font-size:0.75rem;">${ico('power', 13)} POWER</span>
            <span class="ctx-power-switch ${powered ? 'on' : ''}"></span>`;
          if (!building.isConstructing) {
            distPowerRow.addEventListener('click', () => opts.onTogglePower?.(building));
          }
          actionsEl.appendChild(distPowerRow);
        }

        // Slot Liberi e Bottoni Costruzione Moduli
        const freeSlots = slots.filter(s => s.module === null);
        if (freeSlots.length > 0 && districtDef.allowedModules.length > 0) {
          const buildHeader = document.createElement('div');
          buildHeader.className = 'section-header';
          buildHeader.style.cssText = 'margin-bottom:4px;margin-top:6px;';
          buildHeader.innerText = 'BUILD MODULE';
          actionsEl.appendChild(buildHeader);

          const isDistrictReady = !district.mainBuilding.isConstructing;
          if (!isDistrictReady) {
            const constructWarn = document.createElement('div');
            constructWarn.style.cssText = 'display:flex;align-items:center;gap:5px;padding:3px 0;font-family:"Space Mono","Courier New",monospace;font-size:0.63rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--yellow);';
            constructWarn.innerHTML = `${ico('clock', 11)} CENTER UNDER CONSTRUCTION`;
            actionsEl.appendChild(constructWarn);
          }

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
            const canPlace = regOk && compOk && hasCompatibleSlot && isDistrictReady && !isLimitReached;

            const costStr = [
              (modInfo.cost ?? 0) > 0 ? `<span style="color:var(--col-reg);display:inline-flex;align-items:center;gap:2px;">${ico('layers', 12)}${modInfo.cost}</span>` : '',
              (modInfo.costComponents ?? 0) > 0 ? `<span style="color:var(--col-comp);display:inline-flex;align-items:center;gap:2px;">${ico('cpu', 12)}${modInfo.costComponents}</span>` : '',
            ].filter(Boolean).join('') || 'FREE';

            let details = costStr;
            if (isLimitReached) details += ` <span style="color:var(--red)">${ico('alert-triangle', 11)} MAX ${maxPerDist} PER DISTRICT</span>`;
            else if (!hasCompatibleSlot) details += ` <span style="color:var(--red)">${ico('alert-circle', 11)} NO COMPATIBLE SLOT</span>`;

            const btn = document.createElement('button');
            btn.className = 'ctx-btn';
            btn.disabled = !canPlace;
            btn.style.marginBottom = '3px';

            let errorMsg = '';
            if (isLimitReached) errorMsg = ` [MAX CAPACITY REACHED]`;
            else if (!hasCompatibleSlot) errorMsg = ` [NO COMPATIBLE SLOT]`;
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

      // ── Helper per header di sezione ────────────────────────────────────────
      const sH = (label) =>
        `<div style="font-family:'Space Mono',monospace;font-size:0.58rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin:8px 0 4px;padding-top:6px;border-top:1px solid var(--ghost-border);">${label}</div>`;
      const rI = (iconName, val, color) =>
        `<span style="color:${color};display:inline-flex;align-items:center;gap:3px;">${ico(iconName, 12)} ${val}</span>`;
      const ROW = (items) =>
        `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">${items.join('')}</div>`;

      // 2a. Deposito rimanente (estrattori)
      if (['regolith_extractor', 'ice_extractor', 'deep_drill'].includes(building.type)) {
        const cap = opts.capacity ?? 0;
        const capColor = cap > 50 ? 'var(--white)' : 'var(--red)';
        statsEl.innerHTML += sH('DEPOSITO');
        statsEl.innerHTML += ROW([rI('database', `${cap} unità`, capColor)]);
      }

      // 2b. Costi di esercizio
      const costItems = [];
      if (info.energyCons > 0) {
        const commandBonus = building.type === 'hab_module' && opts.clusterBonus?.hasCommandBonus === true;
        costItems.push(commandBonus
          ? `<span style="display:inline-flex;align-items:center;gap:3px;">${ico('zap', 12)} <span style="color:var(--red);text-decoration:line-through">−${info.energyCons}</span> <span style="color:var(--green)">0</span></span>`
          : rI('zap', `−${info.energyCons}`, 'var(--red)')
        );
      }
      if (info.crewReq > 0) costItems.push(rI('user', `×${info.crewReq}`, 'var(--col-crew)'));
      if (info.o2Cons > 0) costItems.push(rI('wind', `−${info.o2Cons}`, 'var(--red)'));

      if (costItems.length > 0) {
        statsEl.innerHTML += sH('COSTI DI ESERCIZIO');
        statsEl.innerHTML += ROW(costItems);
        // Grid status
        if (info.energyCons > 0) {
          const ep = opts.energyProduced ?? 0, er = opts.energyRequired ?? 0, es = opts.energyStored ?? 0;
          const isBlackout = er > ep && es <= 0;
          const isDeficit  = er > ep && !isBlackout;
          const gc = isBlackout ? 'blackout' : isDeficit ? 'deficit' : 'ok';
          const gl = isBlackout ? 'GRID: BLACKOUT' : isDeficit ? 'GRID: DEFICIT' : 'GRID: OK';
          const gi = isBlackout ? 'zap-off' : isDeficit ? 'alert-triangle' : 'check';
          statsEl.innerHTML += `<div class="ctx-grid-status ${gc}" style="margin-top:4px;">${ico(gi, 11)} ${gl}</div>`;
        }
      }

      // 2c. Produzione / Effetti
      const effectItems = [];
      if (info.o2CapBonus > 0) effectItems.push(rI('wind', `+${info.o2CapBonus}`, 'var(--col-o2)'));
      if (info.energyCapBonus > 0) effectItems.push(rI('battery-full', `+${info.energyCapBonus}`, 'var(--col-nrg)'));
      if (info.energyGenDay > 0) {
        const dayOnly = !info.energyGenNight || info.energyGenNight === 0;
        effectItems.push(`<span style="color:var(--green);display:inline-flex;align-items:center;gap:3px;">${ico('zap', 12)} +${info.energyGenDay}${dayOnly ? ` ${ico('sun', 10)}` : ''}</span>`);
        if (info.energyGenNight > 0 && info.energyGenNight !== info.energyGenDay)
          effectItems.push(`<span style="color:var(--col-nrg);display:inline-flex;align-items:center;gap:3px;">${ico('zap', 12)} +${info.energyGenNight} ${ico('moon', 10)}</span>`);
      }
      if (info.crewGen > 0) effectItems.push(rI('users', `+${info.crewGen}`, 'var(--col-crew)'));
      if (info.regolithGen > 0) effectItems.push(rI('layers', `+${info.regolithGen}`, 'var(--col-reg)'));
      if (info.iceGen > 0) effectItems.push(rI('snowflake', `+${info.iceGen}`, 'var(--col-ice)'));
      if (info.conversion) {
        const { inputRes, inputCost, outputRes, outputAmount } = info.conversion;
        const inM = RES_META[inputRes] ?? { icon: 'circle', color: 'inherit' };
        const outM = RES_META[outputRes] ?? { icon: 'circle', color: 'inherit' };
        effectItems.push(
          `<span style="display:inline-flex;align-items:center;gap:3px;color:var(--text-dim)">` +
          `<span style="color:${inM.color}">${ico(inM.icon, 12)} ${inputCost}</span>` +
          ` ${ico('arrow-right', 10)} ` +
          `<span style="color:${outM.color}">${ico(outM.icon, 12)} ${outputAmount}</span>` +
          `</span>`
        );
      }

      if (effectItems.length > 0) {
        statsEl.innerHTML += sH('PRODUZIONE');
        statsEl.innerHTML += ROW(effectItems);
      }

      // 2d. Sinergie
      if (opts.clusterBonus != null) {
        const { buildingType, count, bonus } = opts.clusterBonus;
        const synergyItems = [];
        const hint = (msg) => `<span style="color:var(--text-dim);font-size:0.6rem;">${ico('lightbulb', 11)} ${msg}</span>`;

        if (buildingType === 'hab_module') {
          const { habCount, habBonus, hasCommandBonus } = opts.clusterBonus;
          synergyItems.push(habBonus > 0
            ? rI('users', `+${habBonus}`, 'var(--col-crew)') + `<span style="color:var(--text-dim);font-size:0.6rem;"> (${habCount} HAB)</span>`
            : hint('+ HAB → più crew'));
          synergyItems.push(hasCommandBonus
            ? rI('zap', '0 E', 'var(--green)')
            : hint('command → 0 E'));
        } else if (buildingType === 'solar_array') {
          synergyItems.push(bonus > 0
            ? rI('zap', `+${bonus}`, 'var(--green)') + `<span style="color:var(--text-dim);font-size:0.6rem;"> (${count + 1} pannelli)</span>`
            : hint('2+ pannelli → bonus'));
        } else if (buildingType === 'isru_plant') {
          synergyItems.push(bonus > 0
            ? rI('wind', `+${bonus}`, 'var(--col-o2)') + `<span style="color:var(--text-dim);font-size:0.6rem;"> (${count} estrattori)</span>`
            : hint('+ ice extractors → bonus O₂'));
        } else if (buildingType === 'component_factory') {
          synergyItems.push(bonus > 0
            ? rI('cpu', `+${bonus}`, 'var(--col-comp)') + `<span style="color:var(--text-dim);font-size:0.6rem;"> (${count} estrattori)</span>`
            : hint('+ reg extractors → bonus'));
        } else if (buildingType === 'regolith_extractor') {
          synergyItems.push(bonus > 0
            ? rI('layers', `+${bonus}`, 'var(--col-reg)') + `<span style="color:var(--text-dim);font-size:0.6rem;"> (${count} estrattori)</span>`
            : hint('+ estrattori → bonus'));
        } else if (buildingType === 'ice_extractor') {
          synergyItems.push(bonus > 0
            ? rI('snowflake', `+${bonus}`, 'var(--col-ice)') + `<span style="color:var(--text-dim);font-size:0.6rem;"> (${count} estrattori)</span>`
            : hint('+ estrattori → bonus'));
        }

        if (synergyItems.length > 0) {
          statsEl.innerHTML += sH('SINERGIE');
          statsEl.innerHTML += `<div style="display:flex;flex-direction:column;gap:4px;">${synergyItems.join('')}</div>`;
        }
      }

      // 4. Azioni (Bottoni Base)
      if (building.type === 'rover_workshop' || building.type === 'command') {
        this._addBuildRoverButton(actionsEl, warningsEl, opts);
      }

      if (building.type !== 'conduit' && building.type !== 'command' && !info.alwaysOn && !info.isDistrictCenter) {
        const powered = building.isPowered !== false;
        const toggleRow = document.createElement('div');
        toggleRow.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:4px 0;cursor:pointer;${building.isConstructing ? 'opacity:0.35;pointer-events:none;' : ''}`;
        toggleRow.innerHTML = `
          <span style="display:flex;align-items:center;gap:6px;font-size:0.75rem;">${ico('power', 13)} POWER</span>
          <span class="ctx-power-switch ${powered ? 'on' : ''}"></span>`;
        if (!building.isConstructing) {
          toggleRow.addEventListener('click', () => opts.onTogglePower?.(building));
        }
        actionsEl.appendChild(toggleRow);
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
      maxOxygen = 200,
      maxRegolith = 300,
      maxIce = 100,
      maxComponents = 100,
      deadlockActive = false,
      deadlockTime = 0
    } = data;

    // Regolith: NET (grande) & STORAGE BAR (piccolo)
    const regValEl = document.getElementById('res-reg-val');
    if (regValEl) {
      const sign = deltaReg >= 0 ? '+' : '';
      regValEl.innerText = `${sign}${Math.round(deltaReg)}`;
      regValEl.style.color = deltaReg < 0 ? 'var(--red)' : 'var(--white)';
    }
    const regStorageEl = document.getElementById('res-reg-storage');
    const regBarEl = document.getElementById('res-reg-bar');
    if (regStorageEl && regBarEl) {
      regStorageEl.innerText = `${Math.round(regolith)} / ${maxRegolith}`;
      const pct = maxRegolith > 0 ? Math.min(100, Math.max(0, (regolith / maxRegolith) * 100)) : 0;
      regBarEl.style.width = `${pct}%`;
    }

    // Components: NET (grande) & STORAGE BAR (piccolo)
    const compValEl = document.getElementById('res-comp-val');
    const deltaCompVal = deltaComp ?? 0;
    if (compValEl) {
      const sign = deltaCompVal >= 0 ? '+' : '';
      compValEl.innerText = `${sign}${Math.round(deltaCompVal)}`;
      compValEl.style.color = deltaCompVal < 0 ? 'var(--red)' : 'var(--white)';
    }
    const compStorageEl = document.getElementById('res-comp-storage');
    const compBarEl = document.getElementById('res-comp-bar');
    if (compStorageEl && compBarEl) {
      compStorageEl.innerText = `${Math.round(components)} / ${maxComponents}`;
      const pct = maxComponents > 0 ? Math.min(100, Math.max(0, (components / maxComponents) * 100)) : 0;
      compBarEl.style.width = `${pct}%`;
    }

    // Ice: NET (grande) & STORAGE BAR (piccolo)
    const iceValEl = document.getElementById('res-ice-val');
    if (iceValEl) {
      const sign = deltaIce >= 0 ? '+' : '';
      iceValEl.innerText = `${sign}${Math.round(deltaIce)}`;
      iceValEl.style.color = deltaIce < 0 ? 'var(--red)' : 'var(--white)';
    }
    const iceStorageEl = document.getElementById('res-ice-storage');
    const iceBarEl = document.getElementById('res-ice-bar');
    if (iceStorageEl && iceBarEl) {
      iceStorageEl.innerText = `${Math.round(ice)} / ${maxIce}`;
      const pct = maxIce > 0 ? Math.min(100, Math.max(0, (ice / maxIce) * 100)) : 0;
      iceBarEl.style.width = `${pct}%`;
    }

    // --- LOGICA OXYGEN: NET (grande) & STORAGE BAR ---
    const o2ValEl = document.getElementById('res-o2-val');
    const o2StorageEl = document.getElementById('res-o2-storage');
    const o2BarEl = document.getElementById('res-o2-bar');

    if (o2ValEl) {
      const signO2 = deltaO2 >= 0 ? '+' : '';
      o2ValEl.innerText = `${signO2}${Math.round(deltaO2)}`;
      o2ValEl.style.color = deltaO2 < 0 ? 'var(--red)' : 'var(--white)';
    }
    if (o2StorageEl && o2BarEl) {
      o2StorageEl.innerText = `${Math.round(oxygen)} / ${maxOxygen}`;
      const o2Pct = maxOxygen > 0 ? Math.min(100, Math.max(0, (oxygen / maxOxygen) * 100)) : 0;
      o2BarEl.style.width = `${o2Pct}%`;
    }

    // --- LOGICA ENERGY: NET (grande) & STORAGE BAR ---
    const nrgValEl = document.getElementById('res-nrg-val');
    const nrgStorageEl = document.getElementById('res-nrg-storage');
    const nrgBarEl = document.getElementById('res-nrg-bar');

    if (nrgValEl) {
      const signNrg = deltaEnergy >= 0 ? '+' : '';
      nrgValEl.innerText = `${signNrg}${Math.round(deltaEnergy)}`;
      nrgValEl.style.color = deltaEnergy < 0 ? 'var(--red)' : 'var(--white)';
    }
    if (nrgStorageEl && nrgBarEl) {
      nrgStorageEl.innerText = `${Math.round(energyStored)} / ${maxEnergy}`;
      const nrgPct = maxEnergy > 0 ? Math.min(100, Math.max(0, (energyStored / maxEnergy) * 100)) : 0;
      nrgBarEl.style.width = `${nrgPct}%`;
    }

    const chipNrg = document.getElementById('chip-nrg');
    const blackoutEl = document.getElementById('blackout-warning');
    const isBlackout = energyRequired > energyProduced && energyStored <= 0;
    chipNrg?.classList.toggle('alert-pulse', isBlackout);
    if (blackoutEl) blackoutEl.style.display = isBlackout ? 'block' : 'none';

    const crewFree = crewTotal - crewEmployed;
    const crewValEl = document.getElementById('res-crew-val');
    if (crewValEl) {
      crewValEl.innerText = `${crewFree}`;
      crewValEl.style.color = crewFree <= 0 ? 'var(--red)' : 'var(--white)';
    }

    const crewBarEl = document.getElementById('res-crew-bar');
    if (crewBarEl) crewBarEl.style.width = crewTotal > 0 ? `${Math.min(100, (crewFree / crewTotal) * 100)}%` : '0%';
    const crewStorageEl = document.getElementById('res-crew-storage');
    if (crewStorageEl) crewStorageEl.innerText = `${crewFree} / ${crewTotal}`;
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

  updateResourceLensButton(isActive) {
    document.getElementById('btn-resource-lens')?.classList.toggle('active', isActive);
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
      const sign = delta >= 0 ? '+' : '';
      deltaEl.innerText = `(${sign}${Math.round(delta)})`;
      deltaEl.className = 'res-delta ' + (delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'zero');
    }
  }
  _addBuildRoverButton(actionsEl, warningsEl, opts) {
    const isCompCost = ROVER_COST_TYPE === 'components';
    const canAffordRover = isCompCost ? opts.components >= ROVER_COST : opts.regolith >= ROVER_COST;
    const isLimitReached = (opts.activeRoversCount ?? 0) >= (opts.maxRovers ?? 0);
    const costLabel = isCompCost ? `${ROVER_COST} Comp` : `${ROVER_COST} Reg`;
    const costIcon = isCompCost ? 'cpu' : 'layers';
    const costColor = isCompCost ? 'var(--col-comp)' : 'var(--col-reg)';

    const unitHeader = document.createElement('div');
    unitHeader.className = 'section-header';
    unitHeader.style.cssText = 'margin-bottom:4px;margin-top:6px;';
    unitHeader.innerText = 'BUILD UNIT';
    actionsEl.appendChild(unitHeader);

    if (isLimitReached) {
      const limitWarn = document.createElement('div');
      limitWarn.style.cssText = 'display:flex;align-items:center;gap:5px;padding:3px 0;font-family:"Space Mono","Courier New",monospace;font-size:0.63rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--yellow);';
      limitWarn.innerHTML = `${ico('alert-circle', 11)} ROVER LIMIT REACHED (${opts.maxRovers}) — BUILD WORKSHOPS.`;
      actionsEl.appendChild(limitWarn);
    }

    const btnRover = document.createElement('button');
    btnRover.className = `ctx-btn dist-btn${canAffordRover && !isLimitReached ? ' primary' : ''}`;
    btnRover.disabled = !canAffordRover || isLimitReached;
    btnRover.innerHTML = `
      <span class="dist-icon-diamond chip">${ico('truck', 11)}</span>
      <div class="ctx-btn-text-col">
        <div class="ctx-btn-title">BUILD ROVER</div>
        <div class="ctx-btn-details"><span style="color:${costColor};display:inline-flex;align-items:center;gap:2px;">${ico(costIcon, 12)}${costLabel}</span></div>
      </div>`;
    btnRover.addEventListener('click', () => opts.onBuildRover?.());
    actionsEl.appendChild(btnRover);

    if (!isLimitReached && !canAffordRover) {
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
