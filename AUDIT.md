# Moonbase — Audit Completa

> Documento di audit esaustivo del progetto Phaser 3 "Moonbase — Strategic Survival" (codename interno "Tidy Neumann"). Copre correttezza del codice, UI/UX, coerenza visiva vs `DESIGN.md`, meccaniche, bilanciamento e game design. Per ogni finding: posizione, severità, diagnosi e proposta di fix.
>
> Generato il 2026-04-23.

---

## Indice

- [0. Executive Summary](#0-executive-summary)
- [1. Bug di codice e correttezza](#1-bug-di-codice-e-correttezza)
  - [1.1 CRITICAL](#11-critical)
  - [1.2 HIGH](#12-high)
  - [1.3 MEDIUM](#13-medium)
  - [1.4 LOW](#14-low)
- [2. UI / UX e coerenza visiva](#2-ui--ux-e-coerenza-visiva)
  - [2.1 Struttura HTML](#21-struttura-html)
  - [2.2 Violazioni del design system](#22-violazioni-del-design-system)
  - [2.3 Layout e responsive](#23-layout-e-responsive)
  - [2.4 Gap di UX](#24-gap-di-ux)
  - [2.5 Asset grafici](#25-asset-grafici)
- [3. Meccaniche e game design](#3-meccaniche-e-game-design)
  - [3.1 Loop delle risorse](#31-loop-delle-risorse)
  - [3.2 Edifici ridondanti e vestigiali](#32-edifici-ridondanti-e-vestigiali)
  - [3.3 Design gap macroscopici](#33-design-gap-macroscopici)
  - [3.4 Bilanciamento numerico](#34-bilanciamento-numerico)
  - [3.5 Late game e contenuto](#35-late-game-e-contenuto)
- [4. Roadmap suggerita](#4-roadmap-suggerita)
- [5. Appendice — Tabella riassuntiva](#5-appendice--tabella-riassuntiva)

---

## 0. Executive Summary

**Verdetto complessivo.** Moonbase è una base solida: architettura modulare (scene / systems / entities / ui / utils), loop di risorse completo, controlli responsivi, estetica ispirata a SpaceX ben definita in `DESIGN.md`. Ma il progetto mostra tre famiglie di problemi:

1. **Bug strutturali bloccanti**: `index.html` contiene **15 ID duplicati** (il blocco `ui-sidebar` + `context-panel` + `mission-section` è completamente ripetuto) → tutte le query `getElementById` colpiscono la prima occorrenza, lasciando una seconda copia di DOM orfana e non aggiornata. Esiste inoltre un `main.js` da 1849 righe nella root del progetto **che non viene mai caricato** (solo `src/main.js` è referenziato da `index.html`).
2. **Difetti di economy / simulazione** che si manifestano in partita: doppio consumo di ossigeno, overflow energia silenzioso, crew penalty che cresce quadraticamente, sprite del rover mappati sulle direzioni sbagliate, rover che si rompe a metà tween e resta bloccato tra due tile, refund asimmetrico alla demolizione, supply-drop timer orfano che raddoppia su restart di scene.
3. **Design gap macroscopici**: **nessuna win condition** (si può solo perdere), **nessun tutorial**, il tema "Tidy Neumann / Von Neumann probes" suggerito dal nome del progetto **non esiste nelle meccaniche**, due coppie di edifici ridondanti (Deep Drill vs Regolith Extractor, ISRU vs Botany Greenhouse), due edifici completamente senza effetti meccanici (**Medbay**, **Recycling Facility**), audio SFX caricati ma **mai suonati**, bottone dev `REVEAL MAP` esposto al giocatore finale.

**Contatori per severità** (stima):

| Severità | Conteggio |
|----------|-----------|
| CRITICAL | 3 |
| HIGH     | 14 |
| MEDIUM   | 26 |
| LOW      | 19 |
| **Totale** | **~62** |

**Top 10 azioni prioritarie** (ordine consigliato):

1. Rimuovere il blocco HTML duplicato in `index.html` (righe 195–253 o 170–192) — senza questo fix, ogni altra correzione UI rischia di aggiornare l'elemento sbagliato.
2. Definire e implementare una **win condition** (es. "Giorno 100 raggiunto", "500 componenti prodotti", "seed pod lanciato").
3. Sbloccare la notte: buff Solar Array (30 → 45 E/day) o nerf costo RTG (80 → 60 componenti) o produzione notturna minima.
4. Nascondere il bottone `REVEAL MAP` dietro flag `DEBUG` (o `location.hostname === 'localhost'`).
5. Fix doppio consumo O₂ in `EconomyManager.processEconomyTick`.
6. Fix mapping direzione sprite del rover (`rover-SW` viene mostrato al posto di `rover-S`, `rover-NE` al posto di `rover-N`).
7. Fix rover break-down a metà tween: snappare alla tile corrente prima di fermare il tween.
8. Aggiungere un tutorial modale iniziale che spieghi obiettivo, controlli e timing del day/night cycle.
9. Implementare (o rimuovere) Medbay e Recycling Facility — attualmente sono edifici buildabili senza alcun effetto.
10. Wire-up degli SFX già caricati: `sfx-rover-move`, `sfx-rover-action`, `sfx-build-solar`, `sfx-build-extractor` (il codice li registra ma non chiama mai `sound.play`).

---

## 1. Bug di codice e correttezza

### 1.1 CRITICAL

#### 1.1.1 Duplicate DOM IDs in `index.html`
- **File / righe**: `index.html` 150–189 vs 198–253 (blocchi duplicati)
- **Dettaglio**: 15 ID duplicati. Elenco:
  - `#ui-sidebar` (170, 198)
  - `#context-panel` (171, 203)
  - `#ctx-preview` (173, 205), `#ctx-name` (177, 209), `#ctx-stats` (180, 212), `#ctx-actions` (181, 213), `#ctx-warnings` (182, 214)
  - `#mission-section` (151, 220)
  - `#o2-emergency-warning` (152, 223), `#evac-countdown` (154, 225)
  - `#crew-warning` (156, 229), `#blackout-warning` (159, 232)
  - `#deadlock-warning` (162, 237), `#deadlock-countdown` (164, 239)
  - `#hazard-log` (166, 243)
- **Conseguenza**: `document.getElementById()` restituisce solo la **prima** occorrenza. Il secondo blocco (una intera sidebar fantasma) resta nel DOM, mai aggiornato ma occupa layout e catturerebbe eventi se un domani il codice usasse `querySelectorAll`. Inoltre rende HTML invalido secondo la spec.
- **Fix**: eliminare l'intero secondo blocco (`index.html` 195–253), mantenendo quello interno a `#main-area` (170–192) che è quello effettivamente targettato da `UIManager` e `MoonbaseScene`. Dopo la rimozione, verificare che il commento `</div><!-- /main-area -->` torni ad allinearsi con l'apertura di `#main-area`.

#### 1.1.2 Root `main.js` orfano (1849 righe di codice morto)
- **File**: `/main.js` (root progetto, 1849 righe)
- **Dettaglio**: `index.html` riga 273 carica **solo** `src/main.js`. Il `main.js` nella root non viene mai eseguito: è codice legacy di un'iterazione precedente (costanti hardcoded, scene setup pre-refactor). Confonde chi tocca il progetto per la prima volta.
- **Fix**: eliminare il file, oppure spostarlo in `archive/legacy-main.js` con un commento chiaro, oppure — se contiene parti ancora valide — unirle e poi cancellare.

#### 1.1.3 Rover lasciato "tra due tile" su break-down mid-tween
- **File / righe**: `src/entities/Rover.js` 268–274 (check durability nel loop di movimento), 367–378 (`breakDown()`)
- **Dettaglio**: Quando durability ≤ 0 durante `_animateStep()`, viene chiamata `breakDown()` che setta `moving = false` e stoppa `_moveTween`. Ma il tween era a metà animazione: il rover resta graficamente interpolato tra due tile. `occupiedTiles` viene marcata sulla tile logica corrente ma lo sprite è altrove → visivamente incoerente, l'indicatore di selezione punta a una cella vuota, il pathfinding continua a considerare la vecchia posizione.
- **Fix** (in `breakDown()`):
  ```javascript
  breakDown() {
    this.isWreck = true;
    this.isPowered = false;
    this.hasCrew = false;
    this.moving = false;
    // Snap alla tile logica prima di stoppare il tween
    const { x: cx, y: cy } = cartesianToIsometric(this.col, this.row);
    this.setPosition(cx, cy + TILE_H / 2 + this.visualYOffset);
    if (this._moveTween) { this._moveTween.stop(); this._moveTween = null; }
    if (this._engineTween) this._engineTween.stop();
    this.setTint(0x8b4513);
    this.setAlpha(0.9);
    this._chargeBar.setVisible(false);
    this.scene.occupiedTiles[this.row][this.col] = true;
  }
  ```

---

### 1.2 HIGH

#### 1.2.1 Energy pool: overflow silenzioso su produzione notturna/diurna
- **File / righe**: `src/systems/EconomyManager.js` 237 (`energyPool = produced + stored`), 361 (clamp a `maxEnergy`)
- **Dettaglio**: `energyPool` aggrega produzione e riserva senza tracciare quanto viene "perso" per overflow. Se `energyPool > maxEnergy`, l'eccesso sparisce senza log né UI feedback. Il giocatore non capisce perché i pannelli solari non sembrino far accumulare batteria.
- **Fix**: tracciare l'overflow e, opzionalmente, decrementare `totalEnergyProduced` nel delta mostrato:
  ```javascript
  const excess = Math.max(0, energyPool - this.maxEnergy);
  this.energyStored = Math.min(energyPool, this.maxEnergy);
  if (excess > 0) {
    this.deltaE_overflow = excess;
    // opzionale: emitter.emit('energy-overflow', { excess });
  }
  ```

#### 1.2.2 Refund asimmetrico e double-refund alla demolizione
- **File / righe**: `src/scenes/MoonbaseScene.js` 2447–2514 (`_demolishBuilding`)
- **Dettaglio**: Il refund calcola `info.cost * 1.0` se `isConstructing`, `info.cost * 0.5` altrimenti. Ma:
  - Un modulo demolito **prima** del completamento costruzione riceve anche il refund degli auto-connect conduit (riga 2514), causando double-count con il refund del modulo stesso.
  - Un district center demolito in mid-costruzione restituisce il **100%** del costo, mentre un conduit (di fatto sempre "costruito istantaneamente") torna al 50%. Asimmetria sfruttabile: costruisci district, demolisci, recoup full cost, ripeti per guadagnare tempo di gioco senza perdere risorse.
- **Fix**: normalizzare il refund in un'unica funzione che distingue esplicitamente le tre casistiche (constructing / built / auto-connect infrastructure) e non somma mai due refund per la stessa moneta.

#### 1.2.3 Event listener accumulano su scene restart
- **File / righe**: `src/scenes/MoonbaseScene.js` 199–246 (registrazioni `this._emitter.on(...)`), nessun `off` prima
- **Dettaglio**: Se `scene.restart()` viene chiamato (dopo game-over con `window.location.reload()` non è un problema — è un hard refresh — ma internamente ci sono altri punti in cui la scene viene reinizializzata), i listener vengono registrati una seconda volta. Il game-over risultante triggera due volte la pausa, due volte freeze rovers, ecc.
- **Fix**: in `init()` o all'inizio di `create()`:
  ```javascript
  this._emitter?.removeAllListeners();
  ```
  oppure rimpiazzare l'emitter con uno nuovo in ogni init.

#### 1.2.4 Supply-drop timer mai fermato
- **File / righe**: `src/scenes/MoonbaseScene.js` 336–340
- **Dettaglio**: `this.time.addEvent({ delay: 120000, loop: true, callback: ... })` non viene salvato né rimosso. Se la scena ricomincia, un secondo timer viene creato in parallelo → drop raddoppiati.
- **Fix**:
  ```javascript
  this._supplyDropEvent = this.time.addEvent({ ... });
  // In shutdown / cleanup:
  this._supplyDropEvent?.remove(false);
  ```

#### 1.2.5 Deadlock detection fire su transitorio
- **File / righe**: `src/systems/EconomyManager.js` 462–470
- **Dettaglio**: Il timer deadlock parte a 0 regolith + no extractor + no rover. Ma il conteggio inizia **subito** al primo tick con queste condizioni, anche se transitorio (es. un tick dopo aver speso l'ultimo regolith per costruire un extractor che entrerà in funzione al tick successivo). Il timer si azzera solo quando la condizione cade, quindi finché non arriva nuovo regolith il countdown continua, spaventando il giocatore inutilmente.
- **Fix**: richiedere N tick consecutivi (es. 3) prima di far partire il timer:
  ```javascript
  if (isDeadlocked) {
    this._deadlockTicks = (this._deadlockTicks || 0) + 1;
    if (this._deadlockTicks >= 3) {
      this.deadlockTimer += 10;
      if (this.deadlockTimer >= 180) emit('game-over', { reason: 'Critical Resource Depletion' });
    }
  } else {
    this._deadlockTicks = 0;
    this.deadlockTimer = 0;
  }
  ```

#### 1.2.6 Post-game-over il giocatore può ancora interagire
- **File / righe**: `src/scenes/MoonbaseScene.js` ~3893 (`_setupGlobalGridPicking`)
- **Dettaglio**: All'evento `game-over` viene settato `isGamePaused = true`, che blocca economy tick e rover, ma **gli handler `pointerdown` restano attivi**. Durante i 180 secondi di evacuazione o di countdown deadlock, il giocatore può posizionare edifici e muovere rover — azioni semanticamente senza senso e visivamente confuse.
- **Fix**: early exit in ogni handler input:
  ```javascript
  this.input.on('pointerdown', (pointer, over) => {
    if (this.isGameOver) return;
    // ...
  });
  ```

#### 1.2.7 Nessuna condizione di vittoria (solo sconfitta)
- **File / righe**: `src/systems/EconomyManager.js` (emit `game-over`), `src/ui/UIManager.js` schermate
- **Dettaglio**: Il codice emette `game-over` con reason "Life Support Degraded" o "Critical Resource Depletion" ma **non esiste nessun emitter per la vittoria**. La UI ha `#game-over-screen` con `h1>Mission Failed` hardcoded — non c'è un equivalente `mission-complete`.
- **Fix**: definire una win condition concreta (vedi sezione 3.3) e aggiungere un emitter `game-won` con overlay separato. Minimo assoluto: "Day N raggiunto senza game-over → vittoria".

#### 1.2.8 Stale starting resources in HTML vs EconomyManager
- **File / righe**: `index.html` 34 (500), 46 (20), 58 (100), 70 (100) vs `src/systems/EconomyManager.js` 28–31 (regolith 600, components 150, ice 100, oxygen 200)
- **Dettaglio**: I valori iniziali nel markup non matchano quelli effettivamente settati da `EconomyManager`. Per il primo frame (prima del primo refresh UI) l'utente vede 500 / 20 / 100 / 100, poi a vuoto di secondo si aggiornano a 600 / 150 / 100 / 200. Jitter visivo che confonde.
- **Fix**: due opzioni —
  1. Aggiornare i valori nel markup al match con `EconomyManager` (soluzione più semplice).
  2. Renderizzare l'HTML da JavaScript via `UIManager.updateResourceChips()` al primo tick, lasciando `---` come placeholder nel markup.

#### 1.2.9 Rover wreck come ostacolo permanente (no salvage, no despawn)
- **File / righe**: `src/entities/Rover.js` 367–378 (`breakDown`), niente pulizia successiva
- **Dettaglio**: Una volta wreck, il rover occupa la tile in `occupiedTiles` **per sempre**. Non c'è meccanica di salvage, despawn temporale, o sblocco via building. Se l'unico rover muore in una posizione scomoda e il Workshop non è ancora costruito, il giocatore è stuck senza vie di uscita dichiarate dal game-over (il deadlock può triggerare solo se anche regolith è a 0).
- **Fix**: implementare un'azione "Salvage" (tasto destro su wreck) che restituisce N regolith e libera la tile, oppure far despawnare il wreck dopo 48 ore di gioco.

#### 1.2.10 Audio SFX caricati ma mai riprodotti
- **File / righe**: `src/scenes/MoonbaseScene.js` 111–115 (load audio), `grep -rn "sound.play" src/` → solo `this.bgm.play()` trovato
- **Dettaglio**: `sfx-rover-action`, `sfx-rover-move`, `sfx-build-solar`, `sfx-build-extractor` sono caricati via `this.load.audio()` ma **nessun chiamante** usa `this.sound.play('sfx-*')`. Solo il BGM (`music.wav`) suona. Spreco di ~1.3 MB di asset e SFX completamente assenti dalla gameplay loop.
- **Fix**:
  - Su `_animateStep()` in `Rover.js`: `this.scene.sound.play('sfx-rover-move', { volume: 0.3 });`
  - Su `_placeBuildingGraphics` per solar: `this.scene.sound.play('sfx-build-solar', { volume: 0.5 });`
  - Idem per regolith_extractor con `sfx-build-extractor`.
  - Esporre toggle audio in un menu settings (vedi 2.4.x).

#### 1.2.11 Deep Drill e Botany Greenhouse: ridondanza non differenziata
- **File / righe**: `src/constants.js` (definizioni edifici)
- **Dettaglio**: Deep Drill (costo 200 reg + 100 comp, 2 crew, output 10/tick) copre lo stesso ruolo del Regolith Extractor (50 reg, 1 crew, 5/tick) con un moltiplicatore puro 2× a costo 4× senza sblocco o condizione differenziante. Analogamente, Botany Greenhouse (1 ice → 3 O₂, 0 crew, 15 E) e ISRU Plant (2 ice → 10 O₂, 1 crew, 20 E) competono per lo stesso ruolo — ed essendo Botany **più economico e senza crew-gate**, diventa la scelta ottimale, rendendo ISRU irrilevante. Problema di design più che di codice, ma sopra la soglia HIGH perché è un pure dominant strategy.
- **Fix** (design, vedi anche sez. 3.2): sbloccare Deep Drill solo su "deep deposits" late-game (nuovo tipo terrain), oppure eliminarlo. Confinare Botany a moduli di Habitat Hub (no edificio standalone), rendendo ISRU l'unica opzione del Cryo Hub.

#### 1.2.12 Asset preview mancanti per 7 edifici
- **File / righe**: `src/ui/UIManager.js` 113–126 (`BUILDING_PREVIEWS`)
- **Dettaglio**: Edifici definiti in `constants.js` e costruibili, ma assenti da `BUILDING_PREVIEWS`: `botany_greenhouse`, `medbay`, `recycling_facility`, `deep_drill`, `h2o_tank`, `battery_bank`, `rover_workshop`. Quando selezionati, la tooltip mostra `[ NO VISUAL DATA ]` (UIManager ~riga 846) → look unpolished in produzione.
- **Fix**: creare PNG coerenti con lo stile esistente (stessa angolazione isometrica, stessa palette), o escludere questi edifici dalla lista costruibile finché gli asset non sono pronti.

#### 1.2.13 Nessun `@media` query in 1536 righe di CSS
- **File / righe**: `css/style.css` (intero file)
- **Dettaglio**: `DESIGN.md` §8 definisce 6 breakpoint (Mobile <600, Tablet Small 600–960, Tablet 960–1280, Desktop 1280–1350, Large 1350–1500, Ultra >1500). Il CSS ne implementa **zero**. Su mobile o tablet la sidebar fissa a 260px invade la canvas di gioco, le chip risorse si comprimono illeggibili, la time-tracker UI si sovrappone al canvas.
- **Fix**: aggiungere almeno:
  ```css
  @media (max-width: 600px) {
    :root { --sidebar-w: 180px; }
    .res-chip { min-width: 90px; font-size: 0.5rem; }
    #time-tracker-ui { transform: scale(0.8); transform-origin: top left; }
  }
  @media (min-width: 1500px) {
    :root { --sidebar-w: 320px; }
  }
  ```

#### 1.2.14 Bottone dev `REVEAL MAP` esposto al giocatore
- **File / righe**: `index.html` 103, `src/scenes/MoonbaseScene.js` ~351
- **Dettaglio**: La top bar mostra un bottone "REVEAL MAP" che svela istantaneamente tutta la fog of war. Utile in sviluppo, ma attualmente visibile a ogni utente finale → banalizza l'esplorazione che è una delle meccaniche del gioco.
- **Fix**:
  ```html
  <button id="btn-dev-reveal" class="ghost-btn" style="display:none;">...</button>
  ```
  ```javascript
  // In main.js o nella init della scena
  if (location.hostname === 'localhost' || new URLSearchParams(location.search).has('dev')) {
    document.getElementById('btn-dev-reveal').style.display = '';
  }
  ```

---

### 1.3 MEDIUM

#### 1.3.1 Doppio consumo di ossigeno in `processEconomyTick`
- **File / righe**: `src/systems/EconomyManager.js` 241–263 (in particolare 254–255)
- **Dettaglio**: `this.oxygen -= o2Cons` viene applicato in-loop, poi `totalO2Consumed += o2Cons` traccia il totale. Il delta mostrato a UI (`deltaO2 = totalO2Produced - totalO2Consumed`) è coerente con la tracciatura ma `this.oxygen` è già stato mutato: se il pool parziale scende sotto zero in mezzo al loop, il clamp di fine tick lo riporta a 0 perdendo informazione. Meglio accumulare consumo in variabile temporanea e applicarlo in un unico punto a fine tick.
- **Fix**: posticipare la mutazione di `this.oxygen` dopo aver sommato produzione e consumo totali.

#### 1.3.2 Crew penalty cresce quadraticamente (non lineare come atteso)
- **File / righe**: `src/systems/EconomyManager.js` 265–266
- **Dettaglio**: `emergencyTimer` incrementa di 10 per tick con O₂ ≤ 0; `crewPenalty = Math.floor(emergencyTimer / 5)` → al tick 1 la penalità è 2, al tick 2 è 4, al tick 3 è 6... ma viene sottratta ogni tick, quindi in 3 tick si perdono 2+4+6 = 12 crew invece di un decadimento lineare previsto. Se si hanno 20 crew, scompaiono in 5 tick.
- **Fix**: tenere traccia del penalty già applicato:
  ```javascript
  const prevPenalty = this._prevCrewPenalty || 0;
  const curPenalty  = Math.floor(this.emergencyTimer / 5);
  const delta = curPenalty - prevPenalty;
  this.crewTotal = Math.max(0, this.crewTotal - delta);
  this._prevCrewPenalty = curPenalty;
  // Reset quando emergency cessa:
  // this._prevCrewPenalty = 0;
  ```

#### 1.3.3 Rover direction sprite mapping sbagliato
- **File / righe**: `src/entities/Rover.js` 303–310
- **Dettaglio**: In una griglia isometrica, `(dCol, dRow) = (0, 1)` corrisponde visivamente al movimento verso **Sud** (non Sud-Ovest) perché row+1 spinge la sprite in basso a destra secondo la proiezione. Il codice attuale mappa `(0, 1) → rover-SW` e `(0, -1) → rover-NE`, confondendo assi cartesiani con direzioni isometriche di schermo.
- **Fix**: tabella di mapping esplicita:
  ```javascript
  const DIR_MAP = {
    '1,0':  'rover-SE', '-1,0': 'rover-NW',
    '0,1':  'rover-S',  '0,-1': 'rover-N',
    '1,1':  'rover-E',  '-1,-1':'rover-W',
    '1,-1': 'rover-NE','-1,1': 'rover-SW',
  };
  this.setTexture(DIR_MAP[`${dCol},${dRow}`] || 'rover-SE');
  ```
  (Da validare contro le effettive sprite — ma il pattern è questo.)

#### 1.3.4 Rover charge/discharge conflict: stuck a 0 permanente
- **File / righe**: `src/entities/Rover.js` 107–120 (recharge), 122–133 (discharge)
- **Dettaglio**: Recharge +1 ogni 5s quando "powered" e idle di giorno; discharge -1 ogni 20s mentre powered. Se muovi 10 tile (10 charge), poi ti fermi: dopo 5s ti ricarichi a 1 charge, dopo 20s dal power-on scatta il discharge → torni a 0. Il rover può entrare in loop di "ricarica 1 → scarica 1" senza mai risalire.
- **Fix**: la ricarica dovrebbe avvenire **solo di giorno, solo se non in movimento, solo se non in missione**; il discharge dovrebbe avvenire **solo durante il movimento attivo**, non mentre è parcheggiato.

#### 1.3.5 Pathfinding con costo uniforme (A* inconsistente)
- **File / righe**: `src/utils/pathfinding.js` 100 (`tentativeG = current.g + 1`), ~39 (heuristic octile)
- **Dettaglio**: Tutte le 8 direzioni hanno costo `g = 1`. Ma l'euristica è `max(dx,dy) + (√2 - 1)·min(dx,dy)` (octile), che presuppone diagonali ~1.414× più costose. Con `g` uniforme e `h` pesata, A* diventa inconsistente: preferisce percorsi a zig-zag diagonali che "sembrano" più corti all'euristica ma non lo sono in termini di movimento reale.
- **Fix**: introdurre due costi distinti (10 / 14 classico) sia in `g` sia in `h`:
  ```javascript
  const ORTHO = 10, DIAG = 14;
  const stepCost = (Math.abs(dir.dc) + Math.abs(dir.dr) === 1) ? ORTHO : DIAG;
  const tentativeG = current.g + stepCost;
  // heuristic:
  const h = ORTHO * Math.max(dx, dy) + (DIAG - ORTHO) * Math.min(dx, dy);
  ```

#### 1.3.6 Isometric coordinate rounding flickering
- **File / righe**: `src/utils/isometric.js` 26–34 (`Math.round(col)`, `Math.round(row)`)
- **Dettaglio**: Con il mouse a cavallo del confine tra due tile, `Math.round` usa banker's rounding in alcuni engine — il highlight hover sfarfalla tra tile adiacenti senza che il mouse si muova percettibilmente.
- **Fix**: rounding deterministico:
  ```javascript
  col: Math.floor(col + 0.5),
  row: Math.floor(row + 0.5),
  ```
  oppure aggiungere un piccolo `deadzone` in percentuale della tile.

#### 1.3.7 `_deselectRover` referenziato ma (apparentemente) non definito
- **File / righe**: `src/scenes/MoonbaseScene.js` 3945, 3952 (chiamate a `_deselectRover()`), nessuna definizione trovata dall'analisi
- **Dettaglio**: Il metodo viene chiamato in almeno due rami dell'input handler ma non compare come membro della classe. Se davvero mancante, click su tile vuota dopo aver selezionato un rover non lo deseleziona, l'indicatore triangolare resta appeso.
- **Fix**: implementare il metodo:
  ```javascript
  _deselectRover() {
    if (this.selectedRover) {
      this.selectedRover.deselect?.();
      this.selectedRover = null;
      this.roverSelectionGraphics?.clear();
    }
    this._hideSelectionIndicator();
    this.selectedEntity = null;
  }
  ```
  **Da verificare manualmente in-code** — l'analisi automatica potrebbe aver mancato una definizione con nome diverso (`deselectRover`, `_clearRoverSelection`, ecc.).

#### 1.3.8 Blink animation ~2 Hz prossima alla soglia fotosensibilità
- **File / righe**: `css/style.css` 914–922
- **Dettaglio**:
  ```css
  .blink { animation: blink-animation 1s steps(2, start) infinite; }
  @keyframes blink-animation { to { visibility: hidden; } }
  ```
  Ciclo di 1 s con 2 step = ~2 flash/sec. WCAG 2.1 indica limite a 3 flash/sec, ma il margine è stretto e il pattern on/off duro (visibility hidden) è più aggressivo di una fade. Problematico per utenti fotosensibili.
- **Fix**:
  ```css
  .blink { animation: blink-animation 1.4s ease-in-out infinite; }
  @keyframes blink-animation {
    0%, 60%, 100% { opacity: 1; }
    70%, 90% { opacity: 0.35; }
  }
  ```

#### 1.3.9 `console.log("Tick processed")` in produzione
- **File / riga**: `src/systems/EconomyManager.js` 182
- **Dettaglio**: Log ogni 20 secondi di gioco nella console. Rumore per il giocatore che apre DevTools, marker di debug non rimosso.
- **Fix**: rimuovere o gate `if (DEBUG)`.

#### 1.3.10 `console.log("UI OPTS:", opts)` in produzione
- **File / riga**: `src/ui/UIManager.js` 187
- **Dettaglio**: Stessa natura del precedente. Log ad ogni apertura del context panel.
- **Fix**: rimuovere.

#### 1.3.11 Z-index overlap ambiguo
- **File / righe**: `css/style.css` vari (`#ui-sidebar`, `#comms-terminal`, `#time-tracker-ui` tutti a `z-index: 1000`)
- **Dettaglio**: Tre elementi dell'HUD condividono lo stesso z-index. L'ordine di stacking diventa dipendente dall'ordine DOM, che non è stabile se si muovono blocchi di markup. Su viewport piccoli si possono creare sovrapposizioni impreviste (comms sopra sidebar, time-tracker sotto tooltip).
- **Fix**: stack pulito:
  - Game canvas: 0
  - Game overlays (badges, status icons): 5–10
  - Mission alerts: 100
  - Sidebar: 1000
  - Time tracker, comms: 1100 (flottanti sopra sidebar)
  - Tooltip build-preview: 2500
  - Tooltip game entity: 5000
  - Vignette: 9000
  - Game over / Mission complete modal: 10000

#### 1.3.12 Border-radius fuori scala
- **File / righe**: `css/style.css` 321 (`#ui-sidebar` 8px), 359 (`#build-preview-tooltip` 8px), 398 (`.bp-img-box` 6px), 488 (`.ctx-preview-box` 8px top corners), 1104 (`.district-badge` 5px), 1412 (`.time-icon-wrapper` 50%)
- **Dettaglio**: `DESIGN.md` §5 prescrive 4px (sharp) e 32px (ghost button). I valori 8px, 6px, 5px, 50% sono tutti fuori scala.
- **Fix**: scegliere tra due strategie:
  1. **Puritana**: uniformare tutto a 4px (escluso ghost button a 32px).
  2. **Pragmatica**: estendere esplicitamente `DESIGN.md` con una scala funzionale aggiuntiva (4 / 6 / 8 / 32), documentando l'uso di ciascuno.

#### 1.3.13 Shadow usage eccessivo vs DESIGN.md "zero shadows"
- **File / righe**: `css/style.css` 322 (`#ui-sidebar`), 366 (`#build-preview-tooltip`), 1109–1172 (district-badge variants), 1347–1352 (vignette-overlay), 1374 (time-tracker), 1511 (game-tooltip)
- **Dettaglio**: `DESIGN.md` §6 afferma "SpaceX uses ZERO shadows". Il CSS ne usa 16 istanze. **Decisione di design necessaria**: il gioco è un sim con pannelli funzionali, le shadow aiutano la gerarchia visiva. O si concede una deroga documentata ("zero shadow sulla homepage cinematografica, shadow funzionali negli overlay di gioco") oppure si rimuovono e si separa il chrome UI col solo bordo ghost.
- **Fix**: formalizzare la scelta in `DESIGN.md`. Se si mantengono, standardizzare il valore a una sola shadow-token (es. `--shadow-panel: 0 4px 16px rgba(0,0,0,0.5);`) e sostituire ogni usage.

#### 1.3.14 Missing `alt` text sui preview image
- **File / righe**: `index.html` 173, 205 (`<img id="ctx-preview" src="" alt="" />`)
- **Dettaglio**: Alt vuoto su immagini informative. Screen reader non ha nulla da leggere, e la seconda occorrenza è comunque da cancellare (vedi 1.1.1).
- **Fix**: `alt="Preview dell'entità selezionata"`.

#### 1.3.15 Game-over overlay con inline `onclick` + hard reload
- **File / righe**: `index.html` 264 (`<button onclick="window.location.reload()">`)
- **Dettaglio**: Uso di attributo inline obsoleto; hard reload perde anche eventuali settings che saranno localStorage-backed quando implementati; nessuna analytics opportunity.
- **Fix**:
  ```html
  <button id="btn-restart" class="ghost-btn">Restart Mission</button>
  ```
  ```javascript
  document.getElementById('btn-restart')?.addEventListener('click', () => {
    // Salva preferenze prima se necessario
    window.location.href = window.location.href;
  });
  ```

#### 1.3.16 Preload error handler permissivo
- **File / righe**: `src/scenes/MoonbaseScene.js` 67–69
- **Dettaglio**: Su asset mancante viene fatto `console.error` ma la scene parte comunque, producendo sprite placeholder o crash successivi difficili da diagnosticare.
- **Fix**: collezionare gli errori e mostrare un overlay di fallimento load:
  ```javascript
  const loadErrors = [];
  this.load.on('loaderror', f => loadErrors.push(f.key));
  this.load.on('complete', () => {
    if (loadErrors.length) showFatalError(`Asset mancanti: ${loadErrors.join(', ')}`);
  });
  ```

#### 1.3.17 Conduit auto-prune loop potenzialmente fragile
- **File / righe**: `src/scenes/MoonbaseScene.js` 2571–2602 (`_pruneDeadEndConduits`)
- **Dettaglio**: Loop `while (prunedSomething)` che itera all'indietro su `this.buildings` e chiama `_demolishBuilding(b, true)` con `break` dopo la prima potatura → restart loop. Su catene lunghe è corretto ma fragile: se `_demolishBuilding` side-effect aggiunge elementi all'array, il backwards loop potrebbe rileggere posizioni sbagliate.
- **Fix**: separare la fase di identificazione da quella di rimozione (`collect → delete`), evitando re-entrance:
  ```javascript
  _pruneDeadEndConduits() {
    let pruned = true;
    while (pruned) {
      pruned = false;
      const toPrune = this.buildings.filter(b =>
        b.type === 'conduit' &&
        Object.values(this._getConduitConnections(b.col, b.row)).filter(v => v).length <= 1
      );
      if (toPrune.length) {
        toPrune.forEach(b => this._demolishBuilding(b, true));
        pruned = true;
      }
    }
  }
  ```

#### 1.3.18 District terrain requirement check — da rivalidare
- **File / righe**: `src/scenes/MoonbaseScene.js` 1752–1765
- **Dettaglio**: L'analisi automatica ha inizialmente segnalato che il check `if (dr === 0 && dc === 0) continue` sembrava non saltare il centro, poi si è corretta dichiarandolo falso positivo. Da confermare manualmente leggendo il contesto: se davvero il `continue` c'è, nessun problema; se no, il giocatore può piazzare Mining Hub direttamente sopra un deposito di regolith, il che è controintuitivo (il deposito viene coperto).
- **Fix**: verificare manualmente e, se necessario, aggiungere il `continue` esplicito.

#### 1.3.19 Costruzione durata fixed vs semantica
- **File / righe**: `src/scenes/MoonbaseScene.js` 1814–1823 (district, 80s), 2155–2164 (module, 40s)
- **Dettaglio**: I tempi di costruzione sono hardcoded e non documentati. Ogni modulo dentro un district si costruisce più velocemente del district stesso — semanticamente plausibile ma poco leggibile.
- **Fix**: centralizzare i tempi in `constants.js` con commenti:
  ```javascript
  export const BUILD_DURATION_MS = {
    districtCenter: 80_000, // 80s - edifici strutturali grandi
    module:         40_000, // 40s - moduli interni al district
    conduit:         5_000,
  };
  ```

#### 1.3.20 Selection state tra rover e building inconsistente
- **File / righe**: `src/scenes/MoonbaseScene.js` 3943–3952
- **Dettaglio**: Su click building viene chiamato `_deselectRover()` e poi settato `selectedEntity = { type:'building', ... }`. Se `_deselectRover` non resetta `selectedEntity` (o se è undefined — vedi 1.3.7), si può avere uno stato ambiguo con indicatori doppi.
- **Fix**: centralizzare in un unico `_selectEntity(type, ref)` che gestisce sempre deselezione + selezione atomica.

#### 1.3.21 Oxygen bottleneck / crew paradox in early game
- **File / righe**: `src/systems/EconomyManager.js` 241–313 (consumi + assegnazione crew), `src/constants.js` (capacità hab / costi)
- **Dettaglio**: Per produrre O₂ servono: ice deposit scoperto + Ice Extractor costruito + crew assegnato + ISRU/Botany costruito + crew assegnato + energia disponibile. Tutto prima che i 200 O₂ iniziali finiscano (66 tick = ~22 min a 1×, ma dimezza per ogni hab extra). Se il giocatore costruisce 2 hab in early-game prima di aver scoperto ice, entra in spirale di morte.
- **Fix**: aggiungere un fallback ("Molecular Dissociator" default nel Command, +1 O₂/tick gratis) che dia un grace period minimo, oppure alzare O₂ iniziale a 300, oppure aggiungere una missione introduttiva che guida il player verso ice.

#### 1.3.22 Energy night deficit strutturale
- **File / righe**: `src/constants.js` (Solar 30 E/day 0 notte, RTG 35 E/24h), consumi tipici ~90–130 E/tick
- **Dettaglio**: Senza RTG (80 comp) la notte è ingestibile: 6 tick di notte × 95 E deficit = 570 E da batteria, ma `battery_bank` storage = 100 E per unità. Il giocatore è **obbligato** a buildare RTG nei primi 2 giorni → componenti starving.
- **Fix** (opzione A): Solar 30 → 45 E/day, RTG 80 → 60 comp. (Opzione B): Solar produce 5–10 E anche di notte (starlight residuo). (Opzione C): ridurre consumi notturni di hab/isru di circa il 30%.

#### 1.3.23 Evacuation countdown narrativamente debole
- **File / righe**: `src/systems/EconomyManager.js` 442–454 (emergency), `index.html` 153 label
- **Dettaglio**: Label dice "O2 EMERGENCY — EVACUATION IN PROGRESS" ma meccanicamente è solo un timer fino al game-over. Non c'è shuttle, non c'è imbarco crew, non c'è scelta "annullare evacuazione". Fra l'altro il testo dice che la crew evacua ma contemporaneamente il crew penalty la riduce — sembrano due sistemi paralleli scollegati.
- **Fix**: unificare le due meccaniche. Proposte:
  - Al trigger, spawnare un dropship animato; se l'emergency si risolve prima di 180s, il dropship torna indietro (crew salvato); se scade, partenza = game-over con reason "Colony evacuated".
  - Mostrare "5 crew boarding shuttle" come feedback visivo invece del crew penalty.

#### 1.3.24 Solar Flare message / duration mismatch
- **File / righe**: `src/systems/EconomyManager.js` ~509, messaggio "30S" nel comms terminal
- **Dettaglio**: Il messaggio UI recita "ROVER SYSTEMS OFFLINE FOR 30S" ma `_solarFlareTicksRemaining = 3` ticks × 20 s/tick = **60 secondi**. Offset 2×.
- **Fix**: correggere il messaggio a `60S`, o ridurre `_solarFlareTicksRemaining` a 1 (20s) se si vuole il tempo ridotto, o rendere dinamico `${ticks * 20}S`.

#### 1.3.25 Hazard log senza size cap
- **File / righe**: `src/ui/UIManager.js` 600–617
- **Dettaglio**: Ogni hazard viene prependato; TTL di 10 s con fade. Ma in caso di hazard in rapida sequenza (scenario micrometeorite storm) il log può gonfiarsi oltre lo spazio disponibile della sidebar prima che il primo item svanisca. Safe ma unpolished.
- **Fix**: cap hard-coded:
  ```javascript
  while (hazardLog.children.length > 8) hazardLog.lastChild.remove();
  ```

#### 1.3.26 Tooltip senza boundary detection orizzontale
- **File / righe**: `src/ui/UIManager.js` 816–823 (`showTooltip`)
- **Dettaglio**: Posizione tooltip = `(mouseX + 15, mouseY + 15)`. Nessun controllo sul lato destro/inferiore della viewport → su schermi piccoli o mouse vicino al bordo il tooltip esce dallo schermo.
- **Fix**: clamp post-positioning:
  ```javascript
  const rect = el.getBoundingClientRect();
  if (rect.right > window.innerWidth - 8) el.style.left = `${window.innerWidth - rect.width - 8}px`;
  if (rect.bottom > window.innerHeight - 8) el.style.top = `${window.innerHeight - rect.height - 8}px`;
  ```

---

### 1.4 LOW

#### 1.4.1 Shadow su rover non distrutto su scene shutdown
- **File / righe**: `src/entities/Rover.js` 410–420
- **Dettaglio**: `destroy()` distrugge lo shadow, ma se il rover viene rimosso senza chiamare `destroy()` lo shadow resta. Percorso scurrile ma possibile su reset stato.
- **Fix**: tracciare tutti i gameobject nel rover in un array e distruggerli tutti in un loop.

#### 1.4.2 Graphics building non tracciati per cleanup generale
- **File / righe**: `src/scenes/MoonbaseScene.js` ~3669
- **Dettaglio**: Se un building resta orfano (bug futuro), la sua gfx non viene mai distrutta.
- **Fix**: in `shutdown()` iterare `this.buildings` e chiamare `b.gfx?.destroy()` + `this.rovers.forEach(r => r.destroy())`.

#### 1.4.3 Nessuna sezione di `constants.js` per "assumption test"
- **File**: `src/constants.js`
- **Dettaglio**: Il file contiene ~206 righe di costanti ma nessuna invariant check (es. `console.assert(TILE_W === TILE_H * 2)` o equivalenti). I bilanciamenti numerici sono fragili a refactor.
- **Fix**: aggiungere in fondo al file un block di asserzioni di sanità:
  ```javascript
  if (import.meta.env?.DEV) {
    console.assert(BUILDINGS_INFO.hab_module.o2Cons > 0, 'hab_module must consume O2');
    // ...
  }
  ```

#### 1.4.4 `isPassive: true` senza effetto su Recycling
- **File**: `src/constants.js` (def `recycling_facility`)
- **Dettaglio**: Flag usato ma nessuna switch case in `EconomyManager` che lo leggi per una logica passive.
- **Fix**: o implementare (vedi sez. 3.2) o rimuovere flag.

#### 1.4.5 Naming convention IT/EN mista
- **File**: vari (es. `UIManager.js` 409 `'Passabile'` in italiano)
- **Dettaglio**: Alcune stringhe generate in JS sono italiane ("Passabile", "Non passabile" forse), mentre la UI principale è inglese.
- **Fix**: scegliere una lingua ufficiale e normalizzare, oppure introdurre un dizionario i18n.

#### 1.4.6 `lucide.createIcons()` chiamato una sola volta al DOMContentLoaded
- **File / righe**: `index.html` 276–280
- **Dettaglio**: Icone `data-lucide` aggiunte dinamicamente da JavaScript dopo il primo render non vengono inizializzate. In genere `UIManager` le chiama re-lazy, da verificare.
- **Fix**: esporre un helper `uiManager.refreshLucideIcons()` da chiamare dopo ogni injection.

#### 1.4.7 `vignette-overlay` posizionato fuori dal container logico
- **File / riga**: `index.html` 267 (dopo `#main-area`)
- **Dettaglio**: Elemento di overlay che vive al livello del body. Funziona, ma può interferire con eventuali layout full-viewport futuri.
- **Fix**: spostarlo dentro `#main-area` con `position: absolute; inset: 0; pointer-events: none;`.

#### 1.4.8 `#game-over-screen` senza focus trap / role=dialog
- **File / riga**: `index.html` 261–265
- **Dettaglio**: Overlay di game over è un semplice `<div>`. Accessibilità: nessun `role="dialog"`, nessun `aria-modal`, nessun focus management.
- **Fix**: aggiungere attributi ARIA e gestire focus su apertura.

#### 1.4.9 `#comms-terminal` inizializzato vuoto nel markup
- **File / riga**: `index.html` 146 (`<div id="comms-terminal"></div>`)
- **Dettaglio**: Placeholder vuoto: il giocatore al primo istante vede una cornice senza messaggi. Ok, ma aggiungere un messaggio di benvenuto ("Mission start — Day 1") migliora l'onboarding.
- **Fix**: seed del terminale in `create()` con un messaggio iniziale.

#### 1.4.10 `#phaser-game` senza tabindex / focus gestito
- **File / riga**: `index.html` 114
- **Dettaglio**: Il canvas Phaser non ha tabindex dichiarato, rendendo difficoltoso il focus da tastiera. Phaser spesso gestisce da solo, ma andrebbe verificato per accessibilità.
- **Fix**: aggiungere `tabindex="0"` se necessario.

#### 1.4.11 Nessun `robots` meta / social meta tag
- **File / righe**: `index.html` 1–15
- **Dettaglio**: Mancano Open Graph, Twitter Card, description, theme-color. Se il gioco verrà condiviso su link, la preview sarà vuota.
- **Fix**: aggiungere blocco meta completo.

#### 1.4.12 `favicon` placeholder (`href="data:,"`)
- **File / riga**: `index.html` 14
- **Dettaglio**: Data URL vuota per sopprimere richieste di favicon. Funzionale ma sciatto in produzione.
- **Fix**: creare una favicon (es. stella o modulo isometrico) e linkarla.

#### 1.4.13 Versione Phaser hardcoded in CDN
- **File / riga**: `index.html` 270 (`phaser@3.87.0`)
- **Dettaglio**: Dipendenza da CDN esterna senza lock locale. Se jsdelivr è giù o 3.87.0 viene rimosso, il gioco non parte.
- **Fix**: considerare npm + bundle locale (Vite), o comunque `integrity` hash.

#### 1.4.14 Nessun error boundary / global error handler
- **File**: globale
- **Dettaglio**: Un errore runtime in Phaser crasha silenziosamente il gioco.
- **Fix**:
  ```javascript
  window.addEventListener('error', e => {
    console.error('Fatal:', e);
    // mostra overlay di crash con reload
  });
  ```

#### 1.4.15 Sfondo caricato via preload non gestito a fallimento
- **File / righe**: `src/scenes/MoonbaseScene.js` preload
- **Dettaglio**: Se `terrain.png` o i rocks manifest falliscono, l'errore appare solo in console. Vedi 1.3.16 per fix unificato.

#### 1.4.16 Rocks manifest caricato dinamicamente ma non validato
- **File / riga**: `src/scenes/MoonbaseScene.js` (riferimento a `./graphics/rocks/manifest.json`)
- **Dettaglio**: Manifest JSON senza schema; un'entry malformata farebbe crashare la generazione del terreno.
- **Fix**: validazione runtime + default safe.

#### 1.4.17 Nessuna integrità CRC / checksum sui save (quando ci saranno)
- **File**: N/A (non ancora implementato)
- **Dettaglio**: Quando sarà aggiunto save/load via localStorage, prevedere un hash per invalidare save compromessi (dopo change di schema).

#### 1.4.18 Molti `setTimeout` / tween senza `this` safety
- **File**: vari
- **Dettaglio**: Callback asincroni che accedono a `this.scene` possono finire a scene distrutte. Phaser tipicamente gestisce, ma vale la regola di salvare referenza.
- **Fix**: pattern-check generale (diff per `setTimeout` e verifica scope).

#### 1.4.19 Nessun lint / formatter configurato
- **File**: N/A (assenza)
- **Dettaglio**: Nessun `.eslintrc`, `.prettierrc`, `package.json` visibile. Codice puro ES module senza tooling → inconsistenze di stile possibili nel tempo.
- **Fix**: aggiungere ESLint + Prettier con una config minimale.

---

## 2. UI / UX e coerenza visiva

### 2.1 Struttura HTML

Vedi 1.1.1 (duplicate IDs) e 1.2.13 (no media query) e 1.3.14 (alt vuoti). In aggiunta:

- **Malformed nesting**: il secondo `<aside id="ui-sidebar">` è **fuori** da `#main-area` (l'apertura di `main-area` è a riga 112, si chiude a 255 dopo il secondo aside — ma il secondo aside è apparso anche dopo la chiusura visiva a 193 del primo aside). Risolto automaticamente dalla rimozione del blocco duplicato.
- **Struttura sidebar footer**: testo in plain HTML `WASD / ARROWS: Camera ...` — OK funzionalmente, ma non è un cheatsheet accessibile. Suggerimento: wrappare in `<kbd>` per styling semantico.

### 2.2 Violazioni del design system

Confronto con `DESIGN.md`:

| Regola DESIGN.md | Status | Note |
|------------------|--------|------|
| Font: solo Space Mono + fallback | ✓ OK | Nessun altro font rilevato |
| Uppercase universale | ✓ OK (maggioranza) | Alcune stringhe JS in sentence case o italiano — vedi 1.4.5 |
| Lettering positivo 0.96–1.17px | ✓ OK | Verificato in CSS |
| Palette: solo black + spectral white | ⚠ Deroga funzionale | 5 colori semantici + 6 tint risorse (giustificati per UX) |
| Zero shadow | ✗ | 16 istanze — vedi 1.3.13 |
| Border-radius 4 / 32 px | ✗ | 8, 6, 5, 50% — vedi 1.3.12 |
| Nessuna card / panel | ⚠ Deroga funzionale | UI di gioco richiede sidebar e tooltip |
| Full-viewport sections | N/A | Non applicabile al gameplay |

**Raccomandazione**: estendere `DESIGN.md` con una sezione "In-game UI deviations" che elenchi esplicitamente:
- Palette semantica (verde/rosso/giallo per delta risorse)
- Resource tint (brown, cyan, blue per regolith/ice/oxygen…)
- Shadow policy per pannelli funzionali (un solo token, es. `--shadow-panel`)
- Border radius functional (4 / 8 / 32)

Così il design language diventa una famiglia coerente invece di "pagina marketing vs gioco" in conflitto.

### 2.3 Layout e responsive

Già coperto: 1.2.13 (media query mancanti) e 1.3.11 (z-index stack).

Aggiunta: `#main-area` ha `height: 100vh` implicito, ma la top bar ha altezza variabile (dipende dal font). Su viewport piccoli il canvas Phaser può eccedere l'area disponibile.

**Fix**: usare CSS Grid per `body`:
```css
body {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100vh;
}
#top-bar { grid-row: 1; }
#main-area { grid-row: 2; min-height: 0; }
```

### 2.4 Gap di UX

#### 2.4.1 Nessun tutorial iniziale
Già indicato in 3.3. Proposta: modal non-bloccante a inizio partita:
```
BENVENUTO, COMANDANTE.
OBIETTIVO: sopravvivere 100 giorni e rendere la base autosufficiente.
CONTROLLI: WASD muovi camera, LMB seleziona, RMB muovi rover.
ATTENZIONE: l'ossigeno scende ogni tick. Trova ice e costruisci ISRU.
[ Iniziamo ]
```

#### 2.4.2 Nessun menu settings
- Audio toggle (BGM / SFX)
- UI scale
- Keybinding override (futuro)
- Reset progresso

#### 2.4.3 Nessun hotkey di gioco
- `Space`: pausa
- `1`–`9`: quick-build per categoria
- `R`: focus sul rover selezionato
- `Esc`: deseleziona / cancella costruzione

#### 2.4.4 Nessun feedback crew assignment
Il giocatore non vede quale crew va dove. Proposta: in sidebar, sezione "CREW BOARD" che lista l'assegnazione corrente (es. "1/1 ISRU", "1/2 Extractor", ecc.).

#### 2.4.5 Nessun "empty state" istruttivo sulla sidebar
Quando non c'è selezione, mostra solo `— NO SELECTION —`. Proposta: "Seleziona un edificio o un rover per dettagli. Tip: clicca un tile vuoto per pianificare una costruzione."

#### 2.4.6 Build preview tooltip non segue il cursore
Già 2.5.x — design voluto ma documentare. Fix minore: assicurarsi che resti visibile se la finestra viene ridimensionata durante il hover.

#### 2.4.7 Mission alert stacking senza dismissal manuale
Non c'è modo di nascondere un alert. Se 3 hazard attivi insieme, la sidebar si riempie. OK funzionalmente, ma considerare `aria-live="polite"` e un pulsante "×".

#### 2.4.8 Nessuna indicazione chiara del day/night cycle sul tile
Il tile-tracker UI mostra la fase in alto, ma il canvas stesso non cambia luminosità. Aggiungere un overlay globale (`rgba(0,20,40,0.3)` in notte) migliorerebbe la leggibilità dello stato.

### 2.5 Asset grafici

| Check | Stato |
|-------|-------|
| Rover 8-direzioni | ✓ Completo (N/NE/E/SE/S/SW/W/NW) |
| Conduit 8-direzioni + node | ✓ Completo |
| Preview per edifici buildabili | ✗ 7 edifici mancanti (vedi 1.2.12) |
| Naming convention graphics | ✓ Consistente (hyphen-case) |
| Riferimenti codice → file esistente | ✓ Nessun broken reference |
| Coerenza palette / angolazione iso | Da verificare visualmente — tutti i PNG sembrano seguire la stessa proiezione |

Raccomandazione extra: aggiungere nomenclatura degli asset a un file `graphics/README.md` con specifica (angolo iso 30°, tile 128x64, pivot bottom-center, ecc.) per chi contribuirà con nuovi asset.

---

## 3. Meccaniche e game design

### 3.1 Loop delle risorse

Stato attuale (sintesi):

| Risorsa | Source | Transform | Sink | Verdetto |
|---------|--------|-----------|------|----------|
| Regolith | Rover mining, Supply drop | → Componenti (Factory 10:7) | Costi costruzione | ✓ Completo |
| Ice | Rover mining, Supply drop | → O₂ (ISRU 2:10, Botany 1:3) | ISRU / Botany | ✓ Completo |
| O₂ | ISRU, Botany | Sostenta hab (3/tick per hab) | Hab | ⚠ Brittle |
| Componenti | Factory, Supply drop | Costi rover / edifici avanzati | Building / Rover | ⚠ Bottleneck |
| Energia | Solar (day), RTG (24h) | Storage in Battery | Ogni edificio acceso | ✗ Deficit notte |
| Crew | Command (5 free), Hab (+5 se powered) | Staffing edifici / rover | Building ops | ⚠ Scaling opaco |

Problematiche chiave già dettagliate nelle sezioni 1.2.11 (ridondanza), 1.3.21 (O₂ early), 1.3.22 (energia notte).

### 3.2 Edifici ridondanti e vestigiali

**Vestigiali (zero effetto meccanico)**:

- **Medbay** (`src/constants.js`): costruibile ma non intercettato da `EconomyManager`. Scelta:
  - *Implementare*: riduce `crewPenalty` in emergency (es. `Math.floor(timer / 10)` invece di `/ 5`) e/o accelera recharge durability dei rover.
  - *Rimuovere*: cancellare dall'elenco buildable finché non serve davvero.
- **Recycling Facility** (`src/constants.js`): flag `isPassive: true` ma niente pass sul tick. Scelta:
  - *Implementare*: accetta wreck rover (azione "salvage") → ritorna 15 reg + 10 comp; in alternativa, converte 1 regolith "scarto" ogni tick in 0.5 componenti.
  - *Rimuovere*.

**Ridondanti senza differenziazione** (vedi 1.2.11):

- **Deep Drill vs Regolith Extractor**: stesso ruolo, costo 4× per output 2×. Fix: legare Deep Drill a deposit "rich" (nuovo terrain tipo `regolith-rich`) accessibili solo dopo un research/district specifico.
- **ISRU vs Botany Greenhouse**: Botany strictly dominant in early game (più economico, no crew). Fix: limitare Botany a modulo di Habitat Hub (no standalone), e/o renderlo un bilanciato "early game slot" con capacity fissa (es. max 1 per Habitat Hub).

**District hub puramente organizzativi**: Habitat Hub, Mining Hub, Power Center, Cryo Hub sono solo ancoraggi senza produzione propria. Design legittimo, ma il giocatore si aspetta un piccolo bonus. Proposta: ogni district dà un bonus passivo al modulo interno (es. Mining Hub +10% output extractors annessi, Cryo Hub -10% energia consumata da ISRU).

### 3.3 Design gap macroscopici

| Gap | Impatto | Fix suggerito |
|-----|---------|---------------|
| **Nessuna win condition** | Gioco senza obiettivo, diventa idle-clicker | Implementare uno o più endgame: "Giorno 100 sopravvissuto", "500 componenti prodotti", "50 crew raggiunti", "Seed pod lanciato" |
| **Tema Von Neumann assente** | Il codename "Tidy Neumann" suggerisce self-replication, ma il gioco è survival | Aggiungere un endgame: costruire un "Seed Pod" (costo estremo) che lancia una seconda colonia autonoma in un'altra porzione di mappa — risolve anche il problema win condition |
| **Nessun tutorial / onboarding** | Utente nuovo è perso | Modal iniziale (vedi 2.4.1) + hint contestuali sui primi 5 minuti |
| **Nessun save / load** | Sessioni lunghe impossibili | localStorage auto-save ogni N tick; manual save/load via menu |
| **Nessun settings** | No audio toggle, no accessibility | Menu settings con toggle BGM/SFX, UI scale, motion-reduced mode |
| **Audio SFX non usati** | SFX caricati, silenzio in-game | Wire-up (vedi 1.2.10) |
| **No keyboard navigation** | Gioco solo mouse | Hotkeys (vedi 2.4.3) |

### 3.4 Bilanciamento numerico

Vedi 1.3.21 (O₂ bottleneck), 1.3.22 (energy deficit). Aggiunte:

- **Starting resources mismatch** (1.2.8): sistemare subito
- **Regolith Extractor trap**: costo 50 reg ma starting reg = 600 → spesa percepita poco utile (regolith non è bottleneck all'inizio). Proposta: ridurre a 30 reg o rendere Extractor un prerequisito per altri edifici (es. Component Factory richiede 1 extractor connesso).
- **Deep Drill overpriced**: 200 reg + 100 comp per 2× output di Extractor è irrazionale. Ridurre a 100 reg + 40 comp se si tiene, o rimuovere.
- **RTG dominant strategy**: 80 comp è caro ma gli effetti collaterali ($O_2$ notte) lo rendono obbligatorio → compressione delle scelte. Fix: 60 comp, o introdurre alternative (grosse batterie da 500 capacity).
- **Rover durability 100 / -1 per tile**: vita ~100 tile. Troppo breve per esplorazione aggressiva. Proposta: 200 durability e introdurre "rover maintenance" come sink di componenti (-5 comp per +50 durability, azione manuale del giocatore).
- **Grace period hazards 3 giorni**: OK ma i giocatori esperti non verranno sfidati. Proposta: aggiungere un modificatore "Difficulty" in settings (Easy / Normal / Hard) che altera grace period e hazard frequency.

### 3.5 Late game e contenuto

- **Cap rover 3**: OK per mid-game, ma late-game con mappa 40×40 e 6 deposit per risorsa, 3 rover non bastano per mining capillare. Proposta: sbloccare +1 rover per ogni Rover Workshop aggiuntivo (fino a 5 totali), con costo componenti crescente.
- **Depletion dei deposit**: ~20–30 giorni di mining aggressivo esaurisce la mappa. Late-game diventa vuoto. Proposte:
  - POI procedurali: wreck siti (dump bonus), meteor impacts (generano nuovi deposit), research terminal (sblocchi tech).
  - Map expansion: al giorno X si "rivela" una seconda regione adiacente con nuove risorse.
- **Tech tree / progressione**: oggi tutto è sbloccabile da subito. Proposta: gating leggero (es. ISRU richiede Cryo Hub, Component Factory richiede 50 regolith mined totali, Rover Workshop richiede 10 giorni sopravvissuti).

---

## 4. Roadmap suggerita

Suddivisa per priorità, con effort stimato indicativo.

### Priorità 1 — Blocker (prima di qualsiasi release)

| # | Task | Effort | Ref |
|---|------|--------|-----|
| 1 | Rimuovere blocco HTML duplicato | 15 min | 1.1.1 |
| 2 | Nascondere `REVEAL MAP` dietro flag DEBUG | 20 min | 1.2.14 |
| 3 | Definire e implementare una win condition (es. Day 100) | 1–2 giorni | 1.2.7, 3.3 |
| 4 | Rebalance energia notturna (Solar 45 E/day o RTG 60 comp) | 1 ora | 1.3.22 |
| 5 | Eliminare o archiviare root `main.js` orfano | 5 min | 1.1.2 |

### Priorità 2 — Bug gameplay-critici

| # | Task | Effort | Ref |
|---|------|--------|-----|
| 6 | Fix doppio consumo O₂ | 30 min | 1.3.1 |
| 7 | Fix rover break-down mid-tween (snap) | 20 min | 1.1.3 |
| 8 | Fix rover direction sprite mapping | 30 min | 1.3.3 |
| 9 | Fix rover charge/discharge loop | 30 min | 1.3.4 |
| 10 | Fix crew penalty quadratica | 15 min | 1.3.2 |
| 11 | Fix refund asimmetrico demolizione | 45 min | 1.2.2 |
| 12 | Fix deadlock detection (richiedere N tick consecutivi) | 20 min | 1.2.5 |
| 13 | Energy overflow tracking | 15 min | 1.2.1 |
| 14 | Block input post-game-over | 10 min | 1.2.6 |
| 15 | Event emitter cleanup su scene init | 10 min | 1.2.3 |
| 16 | Supply-drop timer cleanup | 10 min | 1.2.4 |
| 17 | Stale HTML starting resources match | 5 min | 1.2.8 |

### Priorità 3 — Polish UX

| # | Task | Effort | Ref |
|---|------|--------|-----|
| 18 | Blink animation ≤ 1 Hz | 10 min | 1.3.8 |
| 19 | Rimuovere `console.log` residui | 5 min | 1.3.9, 1.3.10 |
| 20 | Z-index stack chiaro | 20 min | 1.3.11 |
| 21 | Border-radius standardization | 1 ora | 1.3.12 |
| 22 | Shadow policy formalizzata in DESIGN.md | 30 min + discussione | 1.3.13 |
| 23 | Aggiungere `@media` query baseline | 1–2 ore | 1.2.13 |
| 24 | Tutorial modal iniziale | 3–4 ore | 2.4.1 |
| 25 | Wire-up SFX audio | 1 ora | 1.2.10 |
| 26 | Tooltip boundary detection | 20 min | 1.3.26 |
| 27 | Game-over overlay refactor (no inline onclick) | 15 min | 1.3.15 |
| 28 | Fix solar flare message mismatch 30S/60S | 5 min | 1.3.24 |
| 29 | Hazard log cap | 10 min | 1.3.25 |

### Priorità 4 — Design completion

| # | Task | Effort | Ref |
|---|------|--------|-----|
| 30 | Implementare Medbay (o rimuovere) | 2–4 ore | 3.2 |
| 31 | Implementare Recycling Facility + salvage rover wreck | 4–6 ore | 3.2, 1.2.9 |
| 32 | Rimuovere / differenziare Deep Drill | 2 ore | 1.2.11 |
| 33 | Confinare Botany a modulo di Habitat Hub | 2 ore | 1.2.11 |
| 34 | District hub bonus passivi | 3 ore | 3.2 |
| 35 | Save/Load con localStorage | 1–2 giorni | 3.3 |
| 36 | Menu settings (audio, scale, difficulty) | 1 giorno | 3.3 |
| 37 | Hotkey support | 1 giorno | 2.4.3 |
| 38 | Crew Board UI in sidebar | 1 giorno | 2.4.4 |
| 39 | Evacuation come meccanica narrativa (shuttle) | 2–3 giorni | 1.3.23 |
| 40 | Seed Pod endgame (Von Neumann theme) | 1 settimana | 3.3 |
| 41 | POI procedurali (wreck, meteor, research) | 1 settimana | 3.5 |
| 42 | Tech tree minimale (gating) | 3–4 giorni | 3.5 |
| 43 | Map expansion / late-game content | 1 settimana | 3.5 |

### Priorità 5 — Polish tecnico e infrastruttura

| # | Task | Effort | Ref |
|---|------|--------|-----|
| 44 | ESLint + Prettier config | 30 min | 1.4.19 |
| 45 | Global error handler + crash overlay | 1 ora | 1.4.14 |
| 46 | Favicon + social meta tags | 30 min | 1.4.11, 1.4.12 |
| 47 | Dependency lock (Vite + npm, sostituire CDN) | 2–3 ore | 1.4.13 |
| 48 | Accessibility pass (ARIA, focus trap, kbd) | 1 giorno | 1.4.8, 1.4.10 |
| 49 | Preload error overlay | 1 ora | 1.3.16 |
| 50 | A* path cost ortho/diag 10/14 | 30 min | 1.3.5 |

---

## 5. Appendice — Tabella riassuntiva

| # | Categoria | Severità | File (indicativo) | Riga | Titolo |
|---|-----------|----------|-------------------|------|--------|
| 1.1.1 | Code | CRITICAL | index.html | 150–253 | Duplicate DOM IDs |
| 1.1.2 | Code | CRITICAL | main.js (root) | all | Root main.js orfano |
| 1.1.3 | Code | CRITICAL | Rover.js | 268–378 | Rover stuck mid-tween su breakdown |
| 1.2.1 | Code | HIGH | EconomyManager.js | 237, 361 | Energy pool overflow silenzioso |
| 1.2.2 | Code | HIGH | MoonbaseScene.js | 2447–2514 | Refund asimmetrico demolizione |
| 1.2.3 | Code | HIGH | MoonbaseScene.js | 199–246 | Event listener accumulation |
| 1.2.4 | Code | HIGH | MoonbaseScene.js | 336–340 | Supply-drop timer orfano |
| 1.2.5 | Code | HIGH | EconomyManager.js | 462–470 | Deadlock detection too eager |
| 1.2.6 | Code | HIGH | MoonbaseScene.js | 3893 | Input attivo post-game-over |
| 1.2.7 | Design | HIGH | (globale) | — | Nessuna win condition |
| 1.2.8 | Code | HIGH | index.html / EconomyManager.js | 34–70 / 28–31 | Starting resources mismatch |
| 1.2.9 | Design | HIGH | Rover.js | 367–378 | Rover wreck ostacolo permanente |
| 1.2.10 | Design | HIGH | MoonbaseScene.js | 111–115 | Audio SFX caricati ma mai usati |
| 1.2.11 | Design | HIGH | constants.js | — | Edifici ridondanti non differenziati |
| 1.2.12 | UX | HIGH | UIManager.js | 113–126 | 7 preview edifici mancanti |
| 1.2.13 | UX | HIGH | css/style.css | (tutto) | Nessun @media query |
| 1.2.14 | UX | HIGH | index.html / MoonbaseScene.js | 103 / 351 | Bottone REVEAL MAP esposto |
| 1.3.1 | Code | MEDIUM | EconomyManager.js | 241–263 | Doppio consumo O₂ |
| 1.3.2 | Code | MEDIUM | EconomyManager.js | 265–266 | Crew penalty quadratica |
| 1.3.3 | Code | MEDIUM | Rover.js | 303–310 | Direction sprite mismatch |
| 1.3.4 | Code | MEDIUM | Rover.js | 107–133 | Charge/discharge loop stuck |
| 1.3.5 | Code | MEDIUM | pathfinding.js | 100 | A* costo uniforme inconsistente |
| 1.3.6 | Code | MEDIUM | isometric.js | 26–34 | Coordinate rounding flicker |
| 1.3.7 | Code | MEDIUM | MoonbaseScene.js | 3945, 3952 | `_deselectRover` forse mancante |
| 1.3.8 | UX | MEDIUM | css/style.css | 914–922 | Blink 2 Hz fotosensibilità |
| 1.3.9 | Code | MEDIUM | EconomyManager.js | 182 | console.log "Tick processed" |
| 1.3.10 | Code | MEDIUM | UIManager.js | 187 | console.log "UI OPTS" |
| 1.3.11 | UX | MEDIUM | css/style.css | — | Z-index overlap 1000 ambiguo |
| 1.3.12 | UX | MEDIUM | css/style.css | vari | Border-radius fuori scala |
| 1.3.13 | UX | MEDIUM | css/style.css | vari | 16 shadow vs "zero shadow" |
| 1.3.14 | UX | MEDIUM | index.html | 173, 205 | alt="" vuoti |
| 1.3.15 | UX | MEDIUM | index.html | 264 | Inline onclick + hard reload |
| 1.3.16 | Code | MEDIUM | MoonbaseScene.js | 67–69 | Preload error permissivo |
| 1.3.17 | Code | MEDIUM | MoonbaseScene.js | 2571–2602 | Conduit auto-prune fragile |
| 1.3.18 | Code | MEDIUM | MoonbaseScene.js | 1752–1765 | Terrain check centro da rivalidare |
| 1.3.19 | Code | MEDIUM | MoonbaseScene.js | 1814–2164 | Durata costruzione hardcoded |
| 1.3.20 | Code | MEDIUM | MoonbaseScene.js | 3943–3952 | Selection state inconsistente |
| 1.3.21 | Design | MEDIUM | EconomyManager.js | 241–313 | O₂ bottleneck early game |
| 1.3.22 | Design | MEDIUM | constants.js | — | Energy night deficit strutturale |
| 1.3.23 | Design | MEDIUM | EconomyManager.js | 442–454 | Evacuation narrativamente debole |
| 1.3.24 | UX | MEDIUM | EconomyManager.js | ~509 | Solar flare 30S vs 60S mismatch |
| 1.3.25 | UX | MEDIUM | UIManager.js | 600–617 | Hazard log no cap |
| 1.3.26 | UX | MEDIUM | UIManager.js | 816–823 | Tooltip boundary orizzontale |
| 1.4.1 | Code | LOW | Rover.js | 410–420 | Shadow non distrutto su shutdown |
| 1.4.2 | Code | LOW | MoonbaseScene.js | ~3669 | Graphics building cleanup |
| 1.4.3 | Code | LOW | constants.js | — | No assertion invariant |
| 1.4.4 | Code | LOW | constants.js | — | `isPassive: true` senza effetto |
| 1.4.5 | UX | LOW | UIManager.js | 409 | Naming IT/EN mista |
| 1.4.6 | UX | LOW | index.html | 276–280 | lucide.createIcons one-shot |
| 1.4.7 | UX | LOW | index.html | 267 | vignette-overlay fuori main-area |
| 1.4.8 | UX | LOW | index.html | 261–265 | game-over senza role=dialog |
| 1.4.9 | UX | LOW | index.html | 146 | comms-terminal vuoto a start |
| 1.4.10 | UX | LOW | index.html | 114 | phaser-game senza tabindex |
| 1.4.11 | UX | LOW | index.html | 1–15 | No social meta tags |
| 1.4.12 | UX | LOW | index.html | 14 | favicon placeholder |
| 1.4.13 | Infra | LOW | index.html | 270 | Phaser CDN hardcoded |
| 1.4.14 | Infra | LOW | globale | — | No global error handler |
| 1.4.15 | Code | LOW | MoonbaseScene.js | preload | Fallimento asset non gestito |
| 1.4.16 | Code | LOW | MoonbaseScene.js | — | Rocks manifest non validato |
| 1.4.17 | Code | LOW | N/A | — | Save checksum (future) |
| 1.4.18 | Code | LOW | vari | — | `this` safety nei callback async |
| 1.4.19 | Infra | LOW | package.json | assente | No lint/formatter |

---

*Fine del report.* Per applicare i fix nell'ordine suggerito, seguire la roadmap della sezione 4. Per ogni item la sezione corrispondente (1.x.x, 2.x, 3.x) contiene posizione, causa e snippet di soluzione.
