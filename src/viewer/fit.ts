/**
 * fit.ts - Calculate whether slide fits at different zoom levels
 * and determine appropriate start level.
 * 
 * Simple logic: Start at 5× if entire slide fits, else start at 2.5×
 */

/**
 * Check if entire slide fits at 5× magnification in the given container.
 * 
 * @param slideWidth - Slide width in level-0 pixels
 * @param slideHeight - Slide height in level-0 pixels
 * @param containerWidth - Container width in screen pixels
 * @param containerHeight - Container height in screen pixels
 * @returns True if entire slide fits at 5× magnification
 * 
 * @example
 * // Small slide in large container
 * checkFitsAt5x(10000, 8000, 1920, 1080) // returns true
 * 
 * // Large slide in medium container
 * checkFitsAt5x(147184, 49960, 1920, 1080) // returns false
 */
export function checkFitsAt5x(
  slideWidth: number,
  slideHeight: number,
  containerWidth: number,
  containerHeight: number
): boolean {
  // At 5× magnification, downsample factor is 40/5 = 8
  const downsample = 40 / 5;
  
  // Calculate how many screen pixels the slide would occupy at 5×
  const displayWidth = slideWidth / downsample;
  const displayHeight = slideHeight / downsample;
  
  // Fits if both dimensions are within container bounds
  return (displayWidth <= containerWidth) && (displayHeight <= containerHeight);
}

/**
 * Determine start level: 5× if entire slide fits at 5×, else 2.5×
 * 
 * @param slideWidth - Slide width in level-0 pixels
 * @param slideHeight - Slide height in level-0 pixels
 * @param containerWidth - Container width in screen pixels
 * @param containerHeight - Container height in screen pixels
 * @returns Start magnification level (5 or 2.5)
 * 
 * @example
 * calculateStartLevel(10000, 8000, 1920, 1080) // returns 5
 * calculateStartLevel(147184, 49960, 1920, 1080) // returns 2.5
 */
export function calculateStartLevel(
  slideWidth: number,
  slideHeight: number,
  containerWidth: number,
  containerHeight: number
): 2.5 | 5 {
  const fitsAt5x = checkFitsAt5x(slideWidth, slideHeight, containerWidth, containerHeight);
  return fitsAt5x ? 5 : 2.5;
}

/**
 * Result of fit calculation
 */
export interface FitResult {
  fitsAt5x: boolean;
  startLevel: 2.5 | 5;
  containerWidth: number;
  containerHeight: number;
  displayWidthAt5x: number;
  displayHeightAt5x: number;
}

/**
 * Calculate fit information including detailed metrics.
 * 
 * @param slideWidth - Slide width in level-0 pixels
 * @param slideHeight - Slide height in level-0 pixels
 * @param containerWidth - Container width in screen pixels
 * @param containerHeight - Container height in screen pixels
 * @returns Detailed fit calculation result
 */
export function calculateFit(
  slideWidth: number,
  slideHeight: number,
  containerWidth: number,
  containerHeight: number
): FitResult {
  const downsample = 40 / 5;
  const displayWidthAt5x = slideWidth / downsample;
  const displayHeightAt5x = slideHeight / downsample;
  
  const fitsAt5x = checkFitsAt5x(slideWidth, slideHeight, containerWidth, containerHeight);
  
  return {
    fitsAt5x,
    startLevel: fitsAt5x ? 5 : 2.5,
    containerWidth,
    containerHeight,
    displayWidthAt5x,
    displayHeightAt5x
  };
}

