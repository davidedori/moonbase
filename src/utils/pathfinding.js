// =============================================================================
// MOONBASE — Utility: Algoritmo A* per pathfinding su griglia 2D
// =============================================================================

import { GRID_SIZE } from '../constants.js';

/**
 * Implementazione di A* per griglie 2D.
 * Trova il percorso più breve da (startCol, startRow) a (endCol, endRow),
 * evitando le tile occupate da edifici e ostacoli naturali (crateri, creste).
 *
 * @param {boolean[][]} occupiedGrid - Griglia GRID_SIZE x GRID_SIZE, true = ostacolo edificio
 * @param {string[][]} terrainGrid - Griglia dei tipi di terreno
 * @param {number} startCol - Colonna di partenza
 * @param {number} startRow - Riga di partenza
 * @param {number} endCol   - Colonna di arrivo
 * @param {number} endRow   - Riga di arrivo
 * @returns {Array<{col: number, row: number}>|null} Array di passi (escluso punto
 *   di partenza), oppure null se non esiste percorso.
 */
export function aStarPathfind(occupiedGrid, terrainGrid, startCol, startRow, endCol, endRow) {
  // --- Validazione dei confini ---
  if (
    startCol < 0 || startCol >= GRID_SIZE ||
    startRow < 0 || startRow >= GRID_SIZE ||
    endCol   < 0 || endCol   >= GRID_SIZE ||
    endRow   < 0 || endRow   >= GRID_SIZE
  ) {
    return null;
  }

  // Se la destinazione è occupata da un edificio, non possiamo arrivarci
  if (occupiedGrid[endRow][endCol]) return null;

  const ORTHO = 10, DIAG = 14;

  // --- Euristica: distanza Octile coerente con costi ORTHO/DIAG ---
  function heuristic(colA, rowA, colB, rowB) {
    const dx = Math.abs(colA - colB);
    const dy = Math.abs(rowA - rowB);
    return ORTHO * Math.max(dx, dy) + (DIAG - ORTHO) * Math.min(dx, dy);
  }

  const openSet   = [];          // Min-heap semplificata come array
  const closedSet = new Set();   // Chiavi "col,row" già valutate
  const gScores   = {};

  function key(col, row) { return `${col},${row}`; }

  const startKey = key(startCol, startRow);
  const h0 = heuristic(startCol, startRow, endCol, endRow);
  openSet.push({ col: startCol, row: startRow, g: 0, f: h0, parent: null });
  gScores[startKey] = 0;

  // Direzioni: 4 ortogonali (costo 10) + 4 diagonali (costo 14)
  const DIRS = [
    { dc:  0, dr: -1, cost: ORTHO },
    { dc:  0, dr:  1, cost: ORTHO },
    { dc: -1, dr:  0, cost: ORTHO },
    { dc:  1, dr:  0, cost: ORTHO },
    { dc: -1, dr: -1, cost: DIAG },
    { dc:  1, dr: -1, cost: DIAG },
    { dc: -1, dr:  1, cost: DIAG },
    { dc:  1, dr:  1, cost: DIAG },
  ];

  while (openSet.length > 0) {
    // Trova il nodo con il valore f più basso
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIdx].f) lowestIdx = i;
    }
    const current = openSet.splice(lowestIdx, 1)[0];

    // Se abbiamo raggiunto la destinazione, ricostruisci il percorso
    if (current.col === endCol && current.row === endRow) {
      const path = [];
      let node = current;
      while (node) {
        path.unshift({ col: node.col, row: node.row });
        node = node.parent;
      }
      // Rimuovi il punto di partenza (il rover è già lì)
      path.shift();
      return path;
    }

    closedSet.add(key(current.col, current.row));

    for (const dir of DIRS) {
      const nc = current.col + dir.dc;
      const nr = current.row + dir.dr;

      if (nc < 0 || nc >= GRID_SIZE || nr < 0 || nr >= GRID_SIZE) continue;
      if (closedSet.has(key(nc, nr))) continue;
      if (occupiedGrid[nr][nc]) continue;

      // NUOVO: Blocca il passaggio su ostacoli naturali
      const terrain = terrainGrid[nr][nc];
      if (terrain === 'crater' || terrain === 'ridge') continue;

      const tentativeG = current.g + dir.cost;
      const nk = key(nc, nr);

      if (gScores[nk] !== undefined && tentativeG >= gScores[nk]) continue;

      gScores[nk] = tentativeG;
      const h = heuristic(nc, nr, endCol, endRow);
      openSet.push({
        col: nc,
        row: nr,
        g: tentativeG,
        f: tentativeG + h,
        parent: current,
      });
    }
  }

  return null; // Nessun percorso trovato
}
