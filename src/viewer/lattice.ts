/**
 * lattice.ts - Pure grid math functions for zoom-level-fixed patch alignment.
 * 
 * All coordinates are in level-0 (40× magnification) pixel space.
 * Grid cells are anchored at (0,0) with no rotation.
 * 
 * Ported from src/tiler/lattice.py
 */

/**
 * Calculate the cell size in level-0 coordinates for a given zoom level.
 * 
 * @param patchPx - Size of patch in pixels at native magnification (e.g., 256)
 * @param zoomMag - Current zoom magnification (5, 10, 20, or 40)
 * @returns Cell size in level-0 pixels
 * 
 * @example
 * // At 40×: cell size = 256 * (40/40) = 256px
 * cellSizeForZoom(256, 40) // returns 256
 * 
 * // At 20×: cell size = 256 * (40/20) = 512px
 * cellSizeForZoom(256, 20) // returns 512
 * 
 * // At 10×: cell size = 256 * (40/10) = 1024px
 * cellSizeForZoom(256, 10) // returns 1024
 * 
 * // At 5×: cell size = 256 * (40/5) = 2048px
 * cellSizeForZoom(256, 5) // returns 2048
 */
export function cellSizeForZoom(patchPx: number, zoomMag: number): number {
  return patchPx * (40 / zoomMag);
}

/**
 * Convert level-0 coordinates to grid cell indices.
 * 
 * @param x0 - X coordinate in level-0 pixels
 * @param y0 - Y coordinate in level-0 pixels
 * @param cellSize - Cell size in level-0 pixels
 * @returns [i, j] - Grid cell indices (column, row)
 * 
 * @example
 * indexOf(512.5, 768.3, 256) // returns [2, 3]
 */
export function indexOf(x0: number, y0: number, cellSize: number): [number, number] {
  const i = Math.floor(x0 / cellSize);
  const j = Math.floor(y0 / cellSize);
  return [i, j];
}

/**
 * Get the center coordinates of a grid cell in level-0 pixels.
 * 
 * @param i - Column index
 * @param j - Row index
 * @param cellSize - Cell size in level-0 pixels
 * @returns [x0, y0] - Center coordinates in level-0 pixels
 * 
 * @example
 * center(2, 3, 256) // returns [640.0, 896.0]
 */
export function center(i: number, j: number, cellSize: number): [number, number] {
  const x0 = (i + 0.5) * cellSize;
  const y0 = (j + 0.5) * cellSize;
  return [x0, y0];
}

/**
 * Check if a grid cell is a partial edge cell (crosses slide boundaries).
 * 
 * @param i - Column index
 * @param j - Row index
 * @param level0Width - Slide width in level-0 pixels
 * @param level0Height - Slide height in level-0 pixels
 * @param cellSize - Cell size in level-0 pixels
 * @returns True if the cell extends beyond slide boundaries (partial cell)
 * 
 * @example
 * isEdgeCell(0, 0, 10000, 8000, 256) // returns false
 * isEdgeCell(39, 31, 10000, 8000, 256) // returns true (39*256=9984, 40*256=10240 > 10000)
 */
export function isEdgeCell(
  i: number,
  j: number,
  level0Width: number,
  level0Height: number,
  cellSize: number
): boolean {
  // Calculate cell boundaries
  const cellLeft = i * cellSize;
  const cellRight = (i + 1) * cellSize;
  const cellTop = j * cellSize;
  const cellBottom = (j + 1) * cellSize;

  // Check if cell extends beyond slide boundaries
  if (cellRight > level0Width || cellBottom > level0Height) {
    return true;
  }

  return false;
}

/**
 * Calculate the number of complete grid cells that fit in the slide.
 * 
 * @param level0Width - Slide width in level-0 pixels
 * @param level0Height - Slide height in level-0 pixels
 * @param cellSize - Cell size in level-0 pixels
 * @returns [numCols, numRows] - Number of complete cells in each dimension
 * 
 * @example
 * gridDimensions(10000, 8000, 256) // returns [39, 31] (floor(10000/256), floor(8000/256))
 */
export function gridDimensions(
  level0Width: number,
  level0Height: number,
  cellSize: number
): [number, number] {
  const numCols = Math.floor(level0Width / cellSize);
  const numRows = Math.floor(level0Height / cellSize);
  return [numCols, numRows];
}

