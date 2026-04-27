// =============================================================================
// MOONBASE — Numeri di bilanciamento
// Modifica qui per cambiare l'equilibrio del gioco.
// Tutti gli altri file importano da questo file: nessun valore hardcoded altrove.
// =============================================================================

// === RISORSE INIZIALI ===
export const INITIAL_REGOLITH = 250;
export const INITIAL_ICE = 50;
export const INITIAL_OXYGEN = 100;
export const INITIAL_COMPONENTS = 50;
export const INITIAL_MAX_OXYGEN = 100;
export const INITIAL_MAX_ROVERS = 1;

// === CICLO GIORNO / NOTTE ===
export const DAY_DURATION_MS = 240000;   // 4 minuti
export const NIGHT_DURATION_MS = 120000;   // 2 minuti
export const GRACE_PERIOD_DAYS = 3;

// === ECONOMIA ===
export const ECONOMY_TICK_MS = 20000;    // intervallo tick economia (ms)

// === EMERGENZE ===
export const EMERGENCY_TIMER_INCREMENT = 10;   // secondi aggiunti per tick senza O2
export const EMERGENCY_MAX_TIME = 180;  // secondi prima di game over O2
export const DEADLOCK_TIMER_INCREMENT = 10;
export const DEADLOCK_MAX_TIME = 180;
export const CREW_PENALTY_INTERVAL = 5;    // ogni N secondi emergenza → -1 crew

// === EVENTI CASUALI (HAZARD) ===
export const HAZARD_PROBABILITY = 0.02;     // probabilità per tick
export const SOLAR_FLARE_ROLL_MAX = 0.33;     // roll < questo → solar flare
export const MICROMETEORITE_ROLL_MAX = 0.66;     // roll < questo (e > flare) → meteore
// (roll >= MICROMETEORITE_ROLL_MAX → extended eclipse)
export const SOLAR_FLARE_ENERGY_MULT = 2;        // moltiplicatore energia durante flare
export const SOLAR_FLARE_TICKS = 3;        // ticks durata flare
export const SOLAR_FLARE_DURATION_MS = 30000;
export const EXTENDED_ECLIPSE_MULT = 2;        // notte più lunga del normale

// === DISTRETTI — DISTANZE ===
export const DISTRICT_MODULE_NEIGHBOR_GAP = 1; // gap minimo tra moduli di distretti diversi (1 = nessuna adiacenza 8-dir)

// === ROVER ===
export const ROVER_COST = 75;   // costo in componenti
export const ROVER_COST_TYPE = 'components';
export const ROVER_MAX_CHARGE = 10;   // caselle di autonomia
export const ROVER_TICKS_PER_CHARGE = 1;          // (legacy, non usato) tick fermi per ricaricare 1 casella
export const ROVER_RECHARGE_INTERVAL_MS = 10000;  // ms tra un +1 di carica e il prossimo (fermo + giorno)
export const ROVER_MAX_DURABILITY = 100;
export const ROVER_EXPLORE_RADIUS = 2;    // tile rivelate attorno al rover
export const ROVER_WORKSHOP_BONUS_ROVERS = 2;   // rover extra per ogni workshop attivo
export const ROVER_WRECK_RECYCLE_COMP = 20;   // componenti ottenuti riciclando un wreck

// === MAPPA / ESPLORAZIONE ===
export const INITIAL_EXPLORED_SIZE = 5;    // zona 5×5 esplorata all'avvio

// === GIACIMENTI — CAPACITÀ ===
export const DEPOSIT_MIN_CAPACITY = 100;
export const DEPOSIT_MAX_CAPACITY = 300;

// === GIACIMENTI — FALLOFF DISTANZA ===
export const DEPOSIT_RICH_DIST = 1;   // distanza ≤ 1: resa piena
export const DEPOSIT_POOR_DIST = 4;  // distanza ≥ 15: resa minima
export const DEPOSIT_NOISE_RANGE = 25;  // jitter ±25

// === GIACIMENTI — GENERAZIONE CLUSTER ===
export const GIACIMENTO_MINOR_SIZE = 2;
export const GIACIMENTO_MINOR_MIN_TILES = 2;
export const GIACIMENTO_MINOR_MAX_TILES = 4;
export const GIACIMENTO_MINOR_COUNT_ICE = 12;
export const GIACIMENTO_MINOR_COUNT_REG = 12;
export const GIACIMENTO_MAJOR_SIZE = 5;
export const GIACIMENTO_MAJOR_MIN_TILES = 15;
export const GIACIMENTO_MAJOR_MAX_TILES = 25;
export const GIACIMENTO_MAJOR_COUNT_ICE = 3;
export const GIACIMENTO_MAJOR_COUNT_REG = 3;
export const GIACIMENTO_CMD_SAFE_RADIUS = 2;
export const GIACIMENTO_MAX_ATTEMPTS = 3000;

// === PUNTI DI INTERESSE (POI) ===
export const SUPPLY_DROP_INTERVAL_MS = 360000;   // ogni 6 minuti
export const SUPPLY_DROP_COMPONENTS = 20;       // componenti reward supply drop
export const ARTEMIS_WRECK_REGOLITH = 30;       // regolith reward wreck Artemis2
export const INITIAL_WRECK_COUNT = 5;        // wreck Artemis a inizio partita
export const CONDUIT_REPAIR_COST = 5;        // regolith per riparare un conduit

// === DEMOLIZIONE — RIMBORSO ===
export const DEMOLISH_REFUND_DURING = 1.0;  // 100% se ancora in costruzione
export const DEMOLISH_REFUND_AFTER = 0.5;  // 50% se già costruito

// === COMMAND CENTER ===
export const COMMAND_CREW_GEN = 5;    // crew fissa del command center

// =============================================================================
// COSTI EDIFICI  (regolith | componenti)
// =============================================================================

// Hub distretti
export const HABITAT_HUB_COST = 80; export const HABITAT_HUB_COST_COMP = 40;
export const LOGISTICS_HUB_COST = 100; export const LOGISTICS_HUB_COST_COMP = 60;
export const MINING_HUB_COST = 50; export const MINING_HUB_COST_COMP = 0;
export const CRYO_HUB_COST = 60; export const CRYO_HUB_COST_COMP = 0;
export const POWER_CENTER_COST = 50; export const POWER_CENTER_COST_COMP = 25;

// Moduli con hard cap (maxPerDistrict: 1)
export const ROVER_WORKSHOP_COST = 0; export const ROVER_WORKSHOP_COST_COMP = 100;
export const ISRU_PLANT_COST = 0; export const ISRU_PLANT_COST_COMP = 40;
export const COMPONENT_FACTORY_COST = 80; export const COMPONENT_FACTORY_COST_COMP = 0;

// Storage
export const H2O_TANK_COST = 50; export const H2O_TANK_COST_COMP = 20;
export const BATTERY_BANK_COST = 30; export const BATTERY_BANK_COST_COMP = 30;

// Produzione energia
export const SOLAR_ARRAY_COST = 25; export const SOLAR_ARRAY_COST_COMP = 0;
export const RTG_COST = 0; export const RTG_COST_COMP = 80;

// Habitat / supporto vita
export const HAB_MODULE_COST = 0; export const HAB_MODULE_COST_COMP = 50;
export const BOTANY_GREENHOUSE_COST = 50; export const BOTANY_GREENHOUSE_COST_COMP = 40;
export const MEDBAY_COST = 20; export const MEDBAY_COST_COMP = 60;

// Estrazione
export const REGOLITH_EXTRACTOR_COST = 50; export const REGOLITH_EXTRACTOR_COST_COMP = 0;
export const ICE_EXTRACTOR_COST = 75; export const ICE_EXTRACTOR_COST_COMP = 0;
export const RECYCLING_FACILITY_COST = 80; export const RECYCLING_FACILITY_COST_COMP = 40;
export const DEEP_DRILL_COST = 200; export const DEEP_DRILL_COST_COMP = 100;

// Utility
export const CONDUIT_COST = 5; export const CONDUIT_COST_COMP = 0;

// =============================================================================
// CONSUMO ENERGETICO EDIFICI  (per tick)
// =============================================================================
export const ROVER_WORKSHOP_ENERGY = 25;
export const ISRU_PLANT_ENERGY = 20;
export const COMPONENT_FACTORY_ENERGY = 15;
export const HAB_MODULE_ENERGY = 30;
export const BOTANY_GREENHOUSE_ENERGY = 15;
export const MEDBAY_ENERGY = 10;
export const REGOLITH_EXTRACTOR_ENERGY = 10;
export const ICE_EXTRACTOR_ENERGY = 15;
export const RECYCLING_FACILITY_ENERGY = 10;
export const DEEP_DRILL_ENERGY = 30;

// =============================================================================
// GENERAZIONE ENERGIA  (per tick)
// =============================================================================
export const SOLAR_ARRAY_ENERGY_DAY = 40;
export const SOLAR_ARRAY_ENERGY_NIGHT = 0;
export const RTG_ENERGY_DAY = 20;
export const RTG_ENERGY_NIGHT = 20;

// =============================================================================
// RESE / PRODUZIONE EDIFICI  (per tick)
// =============================================================================
export const REGOLITH_EXTRACTOR_GEN = 5;
export const ICE_EXTRACTOR_GEN = 5;
export const DEEP_DRILL_GEN = 10;
export const HAB_MODULE_CREW_GEN = 5;

// =============================================================================
// CONVERSIONI  (input → output per ciclo)
// =============================================================================
export const ISRU_ICE_INPUT = 10;
export const ISRU_OXYGEN_OUTPUT = 7;
export const COMPONENT_FACTORY_REG_INPUT = 10;
export const COMPONENT_FACTORY_COMP_OUTPUT = 7;
export const BOTANY_ICE_INPUT = 1;
export const BOTANY_OXYGEN_OUTPUT = 3;

// =============================================================================
// CONSUMO OSSIGENO  (per tick)
// =============================================================================
export const HAB_MODULE_O2_CONS = 5;

// =============================================================================
// CAPACITÀ STORAGE
// =============================================================================
export const H2O_TANK_O2_CAP_BONUS = 300;
export const BATTERY_BANK_ENERGY_CAP_BONUS = 100;

// =============================================================================
// REQUISITI EQUIPAGGIO
// =============================================================================
export const ISRU_CREW_REQ = 1;
export const COMPONENT_FACTORY_CREW_REQ = 1;
export const REGOLITH_EXTRACTOR_CREW_REQ = 1;
export const ICE_EXTRACTOR_CREW_REQ = 1;
export const RECYCLING_FACILITY_CREW_REQ = 1;
export const DEEP_DRILL_CREW_REQ = 2;

// =============================================================================
// CONDUIT
// =============================================================================
export const CONDUIT_CHARGE_COST = 1;    // carica rover consumata per tile conduit
