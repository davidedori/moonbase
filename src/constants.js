// =============================================================================
// MOONBASE — Costanti di configurazione globali
// I numeri di bilanciamento vivono in src/balance.js — modifica lì.
// =============================================================================

import {
  // Giacimenti
  DEPOSIT_MIN_CAPACITY, DEPOSIT_MAX_CAPACITY,
  GIACIMENTO_MINOR_SIZE, GIACIMENTO_MINOR_MIN_TILES, GIACIMENTO_MINOR_MAX_TILES,
  GIACIMENTO_MINOR_COUNT_ICE, GIACIMENTO_MINOR_COUNT_REG,
  GIACIMENTO_MAJOR_SIZE, GIACIMENTO_MAJOR_MIN_TILES, GIACIMENTO_MAJOR_MAX_TILES,
  GIACIMENTO_MAJOR_COUNT_ICE, GIACIMENTO_MAJOR_COUNT_REG,
  GIACIMENTO_CMD_SAFE_RADIUS, GIACIMENTO_MAX_ATTEMPTS,
  // Rover
  ROVER_COST, ROVER_COST_TYPE,
  ROVER_MAX_CHARGE, ROVER_TICKS_PER_CHARGE, ROVER_EXPLORE_RADIUS, ROVER_MAX_DURABILITY,
  // Mappa
  INITIAL_EXPLORED_SIZE,
  // Ciclo giorno/notte
  DAY_DURATION_MS, NIGHT_DURATION_MS, GRACE_PERIOD_DAYS,
  // POI
  SUPPLY_DROP_INTERVAL_MS,
  // Edifici — costi
  HABITAT_HUB_COST, HABITAT_HUB_COST_COMP,
  LOGISTICS_HUB_COST, LOGISTICS_HUB_COST_COMP,
  MINING_HUB_COST, MINING_HUB_COST_COMP,
  CRYO_HUB_COST, CRYO_HUB_COST_COMP,
  POWER_CENTER_COST, POWER_CENTER_COST_COMP,
  ROVER_WORKSHOP_COST, ROVER_WORKSHOP_COST_COMP,
  ISRU_PLANT_COST, ISRU_PLANT_COST_COMP,
  COMPONENT_FACTORY_COST, COMPONENT_FACTORY_COST_COMP,
  H2O_TANK_COST, H2O_TANK_COST_COMP,
  BATTERY_BANK_COST, BATTERY_BANK_COST_COMP,
  SOLAR_ARRAY_COST, SOLAR_ARRAY_COST_COMP,
  RTG_COST, RTG_COST_COMP,
  HAB_MODULE_COST, HAB_MODULE_COST_COMP,
  BOTANY_GREENHOUSE_COST, BOTANY_GREENHOUSE_COST_COMP,
  MEDBAY_COST, MEDBAY_COST_COMP,
  REGOLITH_EXTRACTOR_COST, REGOLITH_EXTRACTOR_COST_COMP,
  ICE_EXTRACTOR_COST, ICE_EXTRACTOR_COST_COMP,
  RECYCLING_FACILITY_COST, RECYCLING_FACILITY_COST_COMP,
  DEEP_DRILL_COST, DEEP_DRILL_COST_COMP,
  CONDUIT_COST, CONDUIT_COST_COMP,
  // Edifici — energia
  ROVER_WORKSHOP_ENERGY, ISRU_PLANT_ENERGY, COMPONENT_FACTORY_ENERGY,
  HAB_MODULE_ENERGY, BOTANY_GREENHOUSE_ENERGY, MEDBAY_ENERGY,
  REGOLITH_EXTRACTOR_ENERGY, ICE_EXTRACTOR_ENERGY, RECYCLING_FACILITY_ENERGY, DEEP_DRILL_ENERGY,
  // Edifici — generazione energia
  SOLAR_ARRAY_ENERGY_DAY, SOLAR_ARRAY_ENERGY_NIGHT, RTG_ENERGY_DAY, RTG_ENERGY_NIGHT,
  // Edifici — rese
  REGOLITH_EXTRACTOR_GEN, ICE_EXTRACTOR_GEN, DEEP_DRILL_GEN, HAB_MODULE_CREW_GEN,
  // Conversioni
  ISRU_ICE_INPUT, ISRU_OXYGEN_OUTPUT,
  COMPONENT_FACTORY_REG_INPUT, COMPONENT_FACTORY_COMP_OUTPUT,
  BOTANY_ICE_INPUT, BOTANY_OXYGEN_OUTPUT,
  // Ossigeno / storage / crew
  HAB_MODULE_O2_CONS,
  H2O_TANK_O2_CAP_BONUS, BATTERY_BANK_ENERGY_CAP_BONUS,
  ISRU_CREW_REQ, COMPONENT_FACTORY_CREW_REQ,
  REGOLITH_EXTRACTOR_CREW_REQ, ICE_EXTRACTOR_CREW_REQ,
  RECYCLING_FACILITY_CREW_REQ, DEEP_DRILL_CREW_REQ,
  // Conduit
  CONDUIT_CHARGE_COST,
  // Cap risorse primarie
  INITIAL_MAX_REGOLITH, INITIAL_MAX_ICE, INITIAL_MAX_COMPONENTS,
  REGOLITH_DEPOT_REG_CAP_BONUS, ICE_SILO_ICE_CAP_BONUS, COMPONENT_DEPOT_COMP_CAP_BONUS,
  REGOLITH_DEPOT_COST, REGOLITH_DEPOT_COST_COMP,
  ICE_SILO_COST, ICE_SILO_COST_COMP,
  COMPONENT_DEPOT_COST, COMPONENT_DEPOT_COST_COMP,
} from './balance.js';

// Re-export per compatibilità con i file che importano da constants.js
export {
  DEPOSIT_MIN_CAPACITY, DEPOSIT_MAX_CAPACITY,
  GIACIMENTO_MINOR_SIZE, GIACIMENTO_MINOR_MIN_TILES, GIACIMENTO_MINOR_MAX_TILES,
  GIACIMENTO_MINOR_COUNT_ICE, GIACIMENTO_MINOR_COUNT_REG,
  GIACIMENTO_MAJOR_SIZE, GIACIMENTO_MAJOR_MIN_TILES, GIACIMENTO_MAJOR_MAX_TILES,
  GIACIMENTO_MAJOR_COUNT_ICE, GIACIMENTO_MAJOR_COUNT_REG,
  GIACIMENTO_CMD_SAFE_RADIUS, GIACIMENTO_MAX_ATTEMPTS,
  ROVER_COST, ROVER_COST_TYPE,
  ROVER_MAX_CHARGE, ROVER_TICKS_PER_CHARGE, ROVER_EXPLORE_RADIUS, ROVER_MAX_DURABILITY,
  INITIAL_EXPLORED_SIZE,
  DAY_DURATION_MS, NIGHT_DURATION_MS, GRACE_PERIOD_DAYS,
  SUPPLY_DROP_INTERVAL_MS,
} from './balance.js';

export const GRID_SIZE = 40;
export const TILE_W = 64;
export const TILE_H = 32;

export const TILE_FILL_COLOR = 0x2a2a2a;
export const TILE_STROKE_COLOR = 0x4a4a4a;
export const TILE_STROKE_WIDTH = 1;
export const TERRAIN_VARIANTS = 3;

export const CAM_SPEED = 8;
export const CAMERA_ZOOM = 3;
export const CAMERA_ZOOM_MIN = 1;
export const CAMERA_ZOOM_MAX = 4;
export const CAMERA_ZOOM_SENSITIVITY = 0.0015;

// Tipi di terreno
export const TERRAIN_NORMAL = 'normal';
export const TERRAIN_ICE = 'ice';
export const TERRAIN_REGOLITH = 'regolith';
export const TERRAIN_CRATER = 'crater';
export const TERRAIN_RIDGE = 'ridge';

// Colori terreno — solidi, nessuna texture procedurale
export const TERRAIN_COLORS = {
  normal: 0x6b6b6b, // grigio luna base
  ice: 0xe8f0f2, // ghiaccio bianco-grigio
  regolith: 0x3a3a3a, // regolith grigio scuro
  crater: 0x1a1a1a, // cratere profondo
  ridge: 0x8a8a8a, // cresta
};

// cost        = costo in Regolite (0 se non richiede Regolite)
// costComponents = costo in Componenti (0 se non richiede Componenti)
export const BUILDINGS_INFO = {
  // --- Edificio Base di Partenza ---
  command: {
    name: 'COMMAND CENTER', cost: 0, costComponents: 0,
    energyGenDay: 0, energyGenNight: 0, energyCons: 0,
    isDistrictCenter: true, districtType: 'command'
  },

  // CENTRI DISTRETTO
  habitat_hub:   { name: 'HABITAT HUB',   cost: HABITAT_HUB_COST,   costComponents: HABITAT_HUB_COST_COMP,   color: 0x22aa55, height: 35, isDistrictCenter: true, districtType: 'habitat' },
  logistics_hub: { name: 'LOGISTICS HUB', cost: LOGISTICS_HUB_COST, costComponents: LOGISTICS_HUB_COST_COMP, color: 0x8855cc, height: 35, isDistrictCenter: true, districtType: 'logistics' },
  mining_hub:    { name: 'MINING HUB',    cost: MINING_HUB_COST,    costComponents: MINING_HUB_COST_COMP,    color: 0xc97520, height: 35, isDistrictCenter: true, districtType: 'mining' },
  cryo_hub:      { name: 'CRYO HUB',      cost: CRYO_HUB_COST,      costComponents: CRYO_HUB_COST_COMP,      color: 0x0088cc, height: 35, isDistrictCenter: true, districtType: 'cryo' },
  power_center:  { name: 'POWER CENTER',  cost: POWER_CENTER_COST,  costComponents: POWER_CENTER_COST_COMP,  color: 0xffd700, height: 35, isDistrictCenter: true, districtType: 'energy' },

  // MODULI CON HARD CAPS (maxPerDistrict: 1)
  rover_workshop: {
    name: 'ROVER WORKSHOP', cost: ROVER_WORKSHOP_COST, costComponents: ROVER_WORKSHOP_COST_COMP,
    color: 0xa020f0, height: 20, energyCons: ROVER_WORKSHOP_ENERGY, maxPerDistrict: 1
  },
  isru_plant: {
    name: 'ISRU PLANT', cost: ISRU_PLANT_COST, costComponents: ISRU_PLANT_COST_COMP,
    color: 0x00ffff, height: 20, energyCons: ISRU_PLANT_ENERGY, crewReq: ISRU_CREW_REQ,
    conversion: { inputRes: 'ice', inputCost: ISRU_ICE_INPUT, outputRes: 'oxygen', outputAmount: ISRU_OXYGEN_OUTPUT },
    maxPerDistrict: 1
  },
  component_factory: {
    name: 'COMPONENT FACTORY', cost: COMPONENT_FACTORY_COST, costComponents: COMPONENT_FACTORY_COST_COMP,
    color: 0x4a9eff, height: 22, energyCons: COMPONENT_FACTORY_ENERGY, crewReq: COMPONENT_FACTORY_CREW_REQ,
    conversion: { inputRes: 'regolith', inputCost: COMPONENT_FACTORY_REG_INPUT, outputRes: 'components', outputAmount: COMPONENT_FACTORY_COMP_OUTPUT },
    maxPerDistrict: 1
  },

  // MODULI STORAGE
  h2o_tank:        { name: 'O2 TANK',          cost: H2O_TANK_COST,        costComponents: H2O_TANK_COST_COMP,        color: 0x00aacc, height: 15, energyCons: 0, o2CapBonus: H2O_TANK_O2_CAP_BONUS, maxPerDistrict: 1 },
  battery_bank:    { name: 'BATTERY BANK',    cost: BATTERY_BANK_COST,    costComponents: BATTERY_BANK_COST_COMP,    color: 0xffff00, height: 15, energyCons: 0, energyCapBonus: BATTERY_BANK_ENERGY_CAP_BONUS },
  regolith_depot:  { name: 'REGOLITH DEPOT',  cost: REGOLITH_DEPOT_COST,  costComponents: REGOLITH_DEPOT_COST_COMP,  color: 0xc97520, height: 15, energyCons: 0, regolithCapBonus: REGOLITH_DEPOT_REG_CAP_BONUS },
  ice_silo:        { name: 'ICE SILO',        cost: ICE_SILO_COST,        costComponents: ICE_SILO_COST_COMP,        color: 0x00aacc, height: 15, energyCons: 0, iceCapBonus: ICE_SILO_ICE_CAP_BONUS },
  component_depot: { name: 'COMPONENT DEPOT', cost: COMPONENT_DEPOT_COST, costComponents: COMPONENT_DEPOT_COST_COMP, color: 0x4a9eff, height: 15, energyCons: 0, componentCapBonus: COMPONENT_DEPOT_COMP_CAP_BONUS, maxPerDistrict: 1 },

  // ALTRI MODULI
  solar_array: {
    name: 'SOLAR ARRAY', cost: SOLAR_ARRAY_COST, costComponents: SOLAR_ARRAY_COST_COMP,
    color: 0xffa500, height: 10, energyGenDay: SOLAR_ARRAY_ENERGY_DAY, energyGenNight: SOLAR_ARRAY_ENERGY_NIGHT, alwaysOn: true
  },
  rtg: {
    name: 'RTG', cost: RTG_COST, costComponents: RTG_COST_COMP,
    color: 0x800080, height: 15, energyGenDay: RTG_ENERGY_DAY, energyGenNight: RTG_ENERGY_NIGHT
  },
  hab_module: {
    name: 'HAB MODULE', cost: HAB_MODULE_COST, costComponents: HAB_MODULE_COST_COMP,
    color: 0x00ff00, height: 20, energyCons: HAB_MODULE_ENERGY, o2Cons: HAB_MODULE_O2_CONS,
    crewGen: HAB_MODULE_CREW_GEN, alwaysOn: true
  },
  botany_greenhouse: {
    name: 'BOTANY GREENHOUSE', cost: BOTANY_GREENHOUSE_COST, costComponents: BOTANY_GREENHOUSE_COST_COMP,
    color: 0x00ff88, height: 18, energyCons: BOTANY_GREENHOUSE_ENERGY,
    conversion: { inputRes: 'ice', inputCost: BOTANY_ICE_INPUT, outputRes: 'oxygen', outputAmount: BOTANY_OXYGEN_OUTPUT }
  },
  medbay: {
    name: 'MEDBAY', cost: MEDBAY_COST, costComponents: MEDBAY_COST_COMP,
    color: 0xffffff, height: 18, energyCons: MEDBAY_ENERGY
  },
  regolith_extractor: {
    name: 'REGOLITH EXT.', cost: REGOLITH_EXTRACTOR_COST, costComponents: REGOLITH_EXTRACTOR_COST_COMP,
    color: 0xc97520, height: 18, energyCons: REGOLITH_EXTRACTOR_ENERGY,
    regolithGen: REGOLITH_EXTRACTOR_GEN, terrain: 'regolith', crewReq: REGOLITH_EXTRACTOR_CREW_REQ
  },
  ice_extractor: {
    name: 'ICE EXT.', cost: ICE_EXTRACTOR_COST, costComponents: ICE_EXTRACTOR_COST_COMP,
    color: 0x00aacc, height: 18, energyCons: ICE_EXTRACTOR_ENERGY,
    iceGen: ICE_EXTRACTOR_GEN, terrain: 'ice', crewReq: ICE_EXTRACTOR_CREW_REQ
  },
  recycling_facility: {
    name: 'RECYCLING FAC.', cost: RECYCLING_FACILITY_COST, costComponents: RECYCLING_FACILITY_COST_COMP,
    color: 0x99cc77, height: 25, energyCons: RECYCLING_FACILITY_ENERGY,
    crewReq: RECYCLING_FACILITY_CREW_REQ, isPassive: true
  },
  deep_drill: {
    name: 'DEEP DRILL', cost: DEEP_DRILL_COST, costComponents: DEEP_DRILL_COST_COMP,
    color: 0x8b4513, height: 25, energyCons: DEEP_DRILL_ENERGY,
    regolithGen: DEEP_DRILL_GEN, terrain: 'regolith', crewReq: DEEP_DRILL_CREW_REQ
  },

  conduit: {
    name: 'UTILITY CONDUIT', cost: CONDUIT_COST, costComponents: CONDUIT_COST_COMP,
    color: 0x555555, height: 2, energyGenDay: 0, energyGenNight: 0, energyCons: 0,
    isPassable: true, chargeCost: CONDUIT_CHARGE_COST
  },
};

// =============================================================================
// SISTEMA DISTRETTI
// =============================================================================

export const DISTRICT_TYPES = {
  command: {
    label: 'Command District',
    centerBuilding: 'command',
    allowedModules: ['hab_module'],
    terrainReq: null,
    icon: 'landmark',
    cssVar: '--col-district-command',
  },
  logistics: {
    label: 'Logistics District',
    centerBuilding: 'logistics_hub',
    allowedModules: ['rover_workshop', 'component_depot', 'regolith_depot', 'h2o_tank', 'ice_silo'],
    terrainReq: null,
    icon: 'package',
    cssVar: '--col-district-logistics',
  },
  mining: {
    label: 'Mining District',
    centerBuilding: 'mining_hub',
    allowedModules: ['regolith_extractor', 'component_factory'],
    terrainReq: 'borders_regolith',
    icon: 'pickaxe',
    cssVar: '--col-district-mining',
  },
  cryo: {
    label: 'Cryo District',
    centerBuilding: 'cryo_hub',
    allowedModules: ['ice_extractor', 'isru_plant'],
    terrainReq: 'borders_ice',
    icon: 'droplets',
    cssVar: '--col-district-cryo',
  },
  energy: {
    label: 'Energy District',
    centerBuilding: 'power_center',
    allowedModules: ['solar_array', 'rtg', 'battery_bank'],
    terrainReq: null,
    icon: 'zap',
    cssVar: '--col-district-energy',
  },
};

/**
 * Slot offset del distretto rispetto al centro (in ordine NW N NE W E SW S SE).
 * Usati per calcolare le 8 posizioni modulo attorno al centro 3×3.
 */
export const DISTRICT_SLOT_OFFSETS = [
  { dc: -1, dr: -1 }, // 0 NW
  { dc: 0, dr: -1 }, // 1 N
  { dc: 1, dr: -1 }, // 2 NE
  { dc: -1, dr: 0 }, // 3 W
  { dc: 1, dr: 0 }, // 4 E
  { dc: -1, dr: 1 }, // 5 SW
  { dc: 0, dr: 1 }, // 6 S
  { dc: 1, dr: 1 }, // 7 SE
];

// Dimensioni pannello UI (corrispondono alle var CSS --sidebar-w / --top-bar-h)
export const SIDEBAR_W = 260;
export const TOP_BAR_H = 48;
