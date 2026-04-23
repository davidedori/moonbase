// =============================================================================
// MOONBASE — Costanti di configurazione globali
// =============================================================================

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

// --- CAPACITÀ GIACIMENTI ---
export const DEPOSIT_MIN_CAPACITY = 100;
export const DEPOSIT_MAX_CAPACITY = 300;

// --- ROVER STATS ---
export const ROVER_MAX_DURABILITY = 100;

// --- SUPPLY DROPS ---
export const SUPPLY_DROP_INTERVAL_MS = 120000; // 2 minuti

// Colori terreno — solidi, nessuna texture procedurale
export const TERRAIN_COLORS = {
  normal: 0x6b6b6b, // grigio luna base
  ice: 0xe8f0f2, // ghiaccio bianco-grigio
  regolith: 0x3a3a3a, // regolith grigio scuro
  crater: 0x1a1a1a, // cratere profondo
  ridge: 0x8a8a8a, // cresta
};

// Raggio di esplorazione del Rover (in tile)
export const ROVER_EXPLORE_RADIUS = 2;

// Dimensione zona inizialmente esplorata (5x5 al centro)
export const INITIAL_EXPLORED_SIZE = 5;

// Costo Rover (ora richiede Componenti, non Regolite)
export const ROVER_COST = 75;
export const ROVER_COST_TYPE = 'components'; // 'regolith' | 'components'

// Sistema carica autonoma del Rover (pannelli solari propri)
export const ROVER_MAX_CHARGE = 10; // caselle percorribili con carica piena
export const ROVER_TICKS_PER_CHARGE = 1;  // cicli fermi necessari per ricaricare 1 casella

// Durata ciclo Giorno / Notte
export const DAY_DURATION_MS = 240000; // 4 minuti di giorno
export const NIGHT_DURATION_MS = 120000; // 2 minuti di notte
export const GRACE_PERIOD_DAYS = 3; // Giorni senza imprevisti

// cost        = costo in Regolite (0 se non richiede Regolite)
// costComponents = costo in Componenti (0 se non richiede Componenti)
export const BUILDINGS_INFO = {
  // --- RIPRISTINATO: Edificio Base di Partenza ---
  command: { 
    name: 'COMMAND CENTER', cost: 0, costComponents: 0, 
    energyGenDay: 0, energyGenNight: 0, energyCons: 0, 
    isDistrictCenter: true, districtType: 'command' 
  },

  // CENTRI DISTRETTO
  habitat_hub: { name: 'HABITAT HUB', cost: 80, costComponents: 40, color: 0x22aa55, height: 35, isDistrictCenter: true, districtType: 'habitat' },
  logistics_hub: { name: 'LOGISTICS HUB', cost: 100, costComponents: 60, color: 0x8855cc, height: 35, isDistrictCenter: true, districtType: 'logistics' },
  mining_hub: { name: 'MINING HUB', cost: 50, costComponents: 0, color: 0xc97520, height: 35, isDistrictCenter: true, districtType: 'mining' },
  cryo_hub: { name: 'CRYO HUB', cost: 60, costComponents: 0, color: 0x0088cc, height: 35, isDistrictCenter: true, districtType: 'ice' },
  power_center: { name: 'POWER CENTER', cost: 50, costComponents: 25, color: 0xffd700, height: 35, isDistrictCenter: true, districtType: 'energy' },

  // MODULI CON HARD CAPS (maxPerDistrict: 1)
  rover_workshop: { name: 'ROVER WORKSHOP', cost: 0, costComponents: 100, color: 0xa020f0, height: 20, energyCons: 25, maxPerDistrict: 1 },
  isru_plant: { name: 'ISRU PLANT', cost: 0, costComponents: 40, color: 0x00ffff, height: 20, energyCons: 20, crewReq: 1, conversion: { inputRes: 'ice', inputCost: 2, outputRes: 'oxygen', outputAmount: 10 }, maxPerDistrict: 1 },
  component_factory: { name: 'COMPONENT FACTORY', cost: 80, costComponents: 0, color: 0x4a9eff, height: 22, energyCons: 15, crewReq: 1, conversion: { inputRes: 'regolith', inputCost: 10, outputRes: 'components', outputAmount: 7 }, maxPerDistrict: 1 },

  // MODULI STORAGE
  h2o_tank: { name: 'H2O TANK', cost: 50, costComponents: 20, color: 0x00aacc, height: 15, energyCons: 0, o2CapBonus: 300 },
  battery_bank: { name: 'BATTERY BANK', cost: 30, costComponents: 60, color: 0xffff00, height: 15, energyCons: 0, energyCapBonus: 100 },

  // ALTRI MODULI
  solar_array: { name: 'SOLAR ARRAY', cost: 25, costComponents: 0, color: 0xffa500, height: 10, energyGenDay: 30, energyGenNight: 0, alwaysOn: true },
  rtg: { name: 'RTG', cost: 0, costComponents: 80, color: 0x800080, height: 15, energyGenDay: 35, energyGenNight: 35 },
  hab_module: { name: 'HAB MODULE', cost: 0, costComponents: 50, color: 0x00ff00, height: 20, energyCons: 30, o2Cons: 3, crewGen: 5, alwaysOn: true },
  botany_greenhouse: { name: 'BOTANY GREENHOUSE', cost: 50, costComponents: 40, color: 0x00ff88, height: 18, energyCons: 15, conversion: { inputRes: 'ice', inputCost: 1, outputRes: 'oxygen', outputAmount: 3 } },
  medbay: { name: 'MEDBAY', cost: 20, costComponents: 60, color: 0xffffff, height: 18, energyCons: 10 },
  regolith_extractor: { name: 'REGOLITH EXT.', cost: 50, costComponents: 0, color: 0xc97520, height: 18, energyCons: 10, regolithGen: 5, terrain: 'regolith', crewReq: 1 },
  ice_extractor: { name: 'ICE EXT.', cost: 75, costComponents: 0, color: 0x00aacc, height: 18, energyCons: 15, iceGen: 5, terrain: 'ice', crewReq: 1 },
  recycling_facility: { name: 'RECYCLING FAC.', cost: 80, costComponents: 40, color: 0x99cc77, height: 25, energyCons: 10, crewReq: 1, isPassive: true },
  deep_drill: { name: 'DEEP DRILL', cost: 200, costComponents: 100, color: 0x8b4513, height: 25, energyCons: 30, regolithGen: 10, terrain: 'regolith', crewReq: 2 },

  // Altri (mantieni se necessari)
  conduit: { name: 'UTILITY CONDUIT', cost: 5, costComponents: 0, color: 0x555555, height: 2, energyGenDay: 0, energyGenNight: 0, energyCons: 0, isPassable: true, chargeCost: 1 },
};

// =============================================================================
// GIACIMENTI — parametri di generazione cluster risorse sulla mappa
// =============================================================================

// ── Giacimento Minore (Comune, ~80-85% dei depositi) ─────────────────────────
/** Lato del bounding box del Giacimento Minore */
export const GIACIMENTO_MINOR_SIZE = 2;
/** Tile risorsa minime nel bounding box 2×2 */
export const GIACIMENTO_MINOR_MIN_TILES = 2;
/** Tile risorsa massime nel bounding box 2×2 */
export const GIACIMENTO_MINOR_MAX_TILES = 4;
/** Numero di Giacimenti Minori di ghiaccio da generare */
export const GIACIMENTO_MINOR_COUNT_ICE = 12;
/** Numero di Giacimenti Minori di regolith da generare */
export const GIACIMENTO_MINOR_COUNT_REG = 12;

// ── Giacimento Maggiore (Raro, ~15-20% dei depositi) ─────────────────────────
/** Lato del bounding box del Giacimento Maggiore */
export const GIACIMENTO_MAJOR_SIZE = 5;
/** Tile risorsa minime nel bounding box 5×5 */
export const GIACIMENTO_MAJOR_MIN_TILES = 15;
/** Tile risorsa massime nel bounding box 5×5 */
export const GIACIMENTO_MAJOR_MAX_TILES = 25;
/** Numero di Giacimenti Maggiori di ghiaccio da generare */
export const GIACIMENTO_MAJOR_COUNT_ICE = 3;
/** Numero di Giacimenti Maggiori di regolith da generare */
export const GIACIMENTO_MAJOR_COUNT_REG = 3;

// ── Parametri comuni ──────────────────────────────────────────────────────────
/**
 * Raggio di sicurezza (distanza Chebyshev dal centro del Modulo Comando)
 * entro cui non viene generato alcun Giacimento (né parziale né intero).
 * Valore 2 → safe zone = ±2 tile = area 5×5 attorno al Comando.
 */
export const GIACIMENTO_CMD_SAFE_RADIUS = 2;
/** Tentativi massimi per piazzare ogni singolo Giacimento prima di rinunciare */
export const GIACIMENTO_MAX_ATTEMPTS = 3000;

// Dimensioni pannello UI (corrispondono alle var CSS --sidebar-w / --top-bar-h)
export const SIDEBAR_W = 260;
export const TOP_BAR_H = 48;

// =============================================================================
// SISTEMA DISTRETTI
// =============================================================================

export const DISTRICT_TYPES = {
  // --- RIPRISTINATO: Distretto Base di Partenza ---
  command: {
    label: 'Command District',
    centerBuilding: 'command',
    allowedModules: ['hab_module'], // Rimosso 'rover_workshop'
    terrainReq: null,
  },
  habitat: {
    label: 'Habitat District',
    centerBuilding: 'habitat_hub',
    allowedModules: ['hab_module', 'botany_greenhouse', 'medbay'],
    terrainReq: null,
  },
  logistics: {
    label: 'Logistics District',
    centerBuilding: 'logistics_hub',
    allowedModules: ['rover_workshop', 'recycling_facility'],
    terrainReq: null,
  },
  mining: {
    label: 'Mining District',
    centerBuilding: 'mining_hub',
    allowedModules: ['regolith_extractor', 'component_factory', 'deep_drill'],
    terrainReq: 'borders_regolith',
  },
  ice: {
    label: 'Cryo District',
    centerBuilding: 'cryo_hub',
    allowedModules: ['ice_extractor', 'isru_plant', 'h2o_tank'],
    terrainReq: 'borders_ice',
  },
  energy: {
    label: 'Energy District',
    centerBuilding: 'power_center',
    allowedModules: ['solar_array', 'rtg', 'battery_bank'],
    terrainReq: null,
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
