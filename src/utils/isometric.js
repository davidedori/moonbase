// =============================================================================
// MOONBASE — Utility: conversione coordinate Cartesiane <-> Isometriche
// =============================================================================

import { TILE_W, TILE_H } from '../constants.js';

/**
 * Converte coordinate di griglia (col, row) in coordinate isometriche (pixel).
 * @param {number} col
 * @param {number} row
 * @returns {{ x: number, y: number }}
 */
export function cartesianToIsometric(col, row) {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

/**
 * Converte coordinate isometriche (pixel) in coordinate di griglia (col, row).
 * @param {number} isoX
 * @param {number} isoY
 * @returns {{ col: number, row: number }}
 */
export function isometricToCartesian(isoX, isoY) {
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const col = (isoX / halfW + isoY / halfH) / 2;
  const row = (isoY / halfH - isoX / halfW) / 2;
  return {
    col: Math.floor(col + 0.5),
    row: Math.floor(row + 0.5),
  };
}
