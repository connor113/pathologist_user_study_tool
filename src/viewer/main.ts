/**
 * main.ts - Minimal viewer to display slide with OpenSeadragon
 */

import OpenSeadragon from 'openseadragon';
import { indexOf, cellSizeForZoom, gridDimensions, isEdgeCell, center } from './lattice';
import type { SlideManifest, GridState, ZoomHistoryEntry, LogEvent, EventType } from './types';
import { calculateFit, type FitResult } from './fit';

// ===== STATE =====
let manifest: SlideManifest | null = null;
let gridState: GridState | null = null;
let fitResult: FitResult | null = null;

// Zoom history for Back/Reset navigation
let zoomHistory: ZoomHistoryEntry[] = [];
let startState: ZoomHistoryEntry | null = null;

// Label selection state
let currentLabel: 'normal' | 'benign' | 'malignant' | null = null;

// Event logging
const eventLog: LogEvent[] = [];
const sessionId = crypto.randomUUID(); // Generate unique session ID
const appVersion = '1.0.0-alpha';
const userId = 'user_01'; // Placeholder in V1

// ===== LOAD MANIFEST =====
async function loadManifest(): Promise<SlideManifest> {
  const response = await fetch('/tiles/test_slide_files/manifest.json');
  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${response.statusText}`);
  }
  const data = await response.json();
  console.log('Manifest loaded:', data);
  return data;
}

// ===== EVENT LOGGING =====
/**
 * Log an event with full viewport bounds and metadata.
 */
function logEvent(
  eventType: EventType,
  options: {
    cellI?: number | null;
    cellJ?: number | null;
    label?: string;
  } = {}
) {
  if (!manifest || !gridState) {
    console.warn('Cannot log event: manifest or gridState not loaded');
    return;
  }
  
  // Get current viewport bounds
  const bounds = viewer.viewport.getBounds();
  const topLeft = viewer.viewport.viewportToImageCoordinates(bounds.x, bounds.y);
  const bottomRight = viewer.viewport.viewportToImageCoordinates(
    bounds.x + bounds.width,
    bounds.y + bounds.height
  );
  
  // Get viewport center
  const center = viewer.viewport.viewportToImageCoordinates(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2
  );
  
  // Get container dimensions
  const containerWidth = viewer.container.clientWidth;
  const containerHeight = viewer.container.clientHeight;
  
  const event: LogEvent = {
    ts_iso8601: new Date().toISOString(),
    session_id: sessionId,
    user_id: userId,
    slide_id: manifest.slide_id,
    event: eventType,
    zoom_level: gridState.currentZoomMag,
    dzi_level: gridState.currentDziLevel,
    i: options.cellI ?? null,
    j: options.cellJ ?? null,
    center_x0: center.x,
    center_y0: center.y,
    vbx0: topLeft.x,
    vby0: bottomRight.y,  // Bottom-left Y (OSD Y increases downward)
    vtx0: bottomRight.x,
    vty0: topLeft.y,      // Top-right Y
    container_w: containerWidth,
    container_h: containerHeight,
    dpr: window.devicePixelRatio,
    patch_px: manifest.patch_px,
    tile_size: manifest.tile_size,
    alignment_ok: manifest.alignment_ok,
    app_version: appVersion,
    label: options.label
  };
  
  eventLog.push(event);
  console.log(`[LOG] ${eventType}:`, event);
}

/**
 * Export event log as CSV file and trigger download.
 */
function exportCSV() {
  if (eventLog.length === 0) {
    alert('No events to export. Interact with the viewer first.');
    return;
  }
  
  if (!manifest) {
    alert('Cannot export: manifest not loaded.');
    return;
  }
  
  // CSV header row (matches spec schema + dzi_level)
  const headers = [
    'ts_iso8601',
    'session_id',
    'user_id',
    'slide_id',
    'event',
    'zoom_level',
    'dzi_level',
    'i',
    'j',
    'center_x0',
    'center_y0',
    'vbx0',
    'vby0',
    'vtx0',
    'vty0',
    'container_w',
    'container_h',
    'dpr',
    'patch_px',
    'tile_size',
    'alignment_ok',
    'app_version',
    'label'
  ];
  
  // Convert events to CSV rows
  const rows = eventLog.map(event => [
    event.ts_iso8601,
    event.session_id,
    event.user_id,
    event.slide_id,
    event.event,
    event.zoom_level,
    event.dzi_level,
    event.i ?? '',
    event.j ?? '',
    event.center_x0.toFixed(2),
    event.center_y0.toFixed(2),
    event.vbx0.toFixed(2),
    event.vby0.toFixed(2),
    event.vtx0.toFixed(2),
    event.vty0.toFixed(2),
    event.container_w,
    event.container_h,
    event.dpr,
    event.patch_px,
    event.tile_size,
    event.alignment_ok,
    event.app_version,
    event.label ?? ''
  ]);
  
  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Generate filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `session_${timestamp}_${manifest.slide_id}.csv`;
  
  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log(`=== CSV EXPORT ===`);
  console.log(`Exported ${eventLog.length} events to ${filename}`);
  console.log('==================');
}

// ===== MAGNIFICATION ↔ DZI LEVEL MAPPING =====
/**
 * Get OpenSeadragon zoom value for a specific DZI level.
 * This uses the exact DZI level from the manifest to ensure proper alignment
 * with the patch extraction at that magnification.
 */
function getZoomForDziLevel(dziLevel: number, viewer: OpenSeadragon.Viewer): number {
  // OpenSeadragon calculates zoom based on the full-resolution image dimensions
  // and the current viewport size. For a specific DZI level, we need to calculate
  // the zoom that would display that level at 1:1 pixel ratio
  
  const homeZoom = viewer.viewport.getHomeZoom();
  const maxLevel = viewer.world.getItemAt(0).source.maxLevel;
  
  // Each DZI level is 2× the previous level
  // At maxLevel: we're at full resolution (downsample = 1)
  // At maxLevel-1: downsample = 2
  // At maxLevel-2: downsample = 4
  // etc.
  
  const levelDiff = maxLevel - dziLevel;
  const downsample = Math.pow(2, levelDiff);
  
  // Zoom is inversely proportional to downsample
  // At max level (downsample=1): zoom = maxZoom
  // At lower levels: zoom = maxZoom / downsample
  
  const maxZoom = viewer.viewport.getMaxZoom();
  return maxZoom / downsample;
}

/**
 * Get magnification and DZI level for current zoom state.
 * Returns the closest magnification level from our ladder (2.5×, 5×, 10×, 20×, 40×).
 * If zoom is close to home zoom, returns null (indicating "fit" state).
 */
function getCurrentMagnificationAndLevel(viewer: OpenSeadragon.Viewer, manifest: SlideManifest): { mag: number, dziLevel: number } | null {
  const currentZoom = viewer.viewport.getZoom(true);
  const homeZoom = viewer.viewport.getHomeZoom();
  
  // If we're very close to home zoom, we're in "fit entire slide" mode
  // Threshold: within 10% of home zoom
  if (Math.abs(currentZoom - homeZoom) / homeZoom < 0.1) {
    return null; // Indicates "fit" state
  }
  
  // Get zoom values for each magnification level
  const mag2_5Zoom = getZoomForDziLevel(manifest.magnification_levels['2.5x'], viewer);
  const mag5Zoom = getZoomForDziLevel(manifest.magnification_levels['5x'], viewer);
  const mag10Zoom = getZoomForDziLevel(manifest.magnification_levels['10x'], viewer);
  const mag20Zoom = getZoomForDziLevel(manifest.magnification_levels['20x'], viewer);
  const mag40Zoom = getZoomForDziLevel(manifest.magnification_levels['40x'], viewer);
  
  // Find closest magnification
  const diffs = [
    { mag: 2.5, dziLevel: manifest.magnification_levels['2.5x'], diff: Math.abs(currentZoom - mag2_5Zoom) },
    { mag: 5, dziLevel: manifest.magnification_levels['5x'], diff: Math.abs(currentZoom - mag5Zoom) },
    { mag: 10, dziLevel: manifest.magnification_levels['10x'], diff: Math.abs(currentZoom - mag10Zoom) },
    { mag: 20, dziLevel: manifest.magnification_levels['20x'], diff: Math.abs(currentZoom - mag20Zoom) },
    { mag: 40, dziLevel: manifest.magnification_levels['40x'], diff: Math.abs(currentZoom - mag40Zoom) }
  ];
  
  diffs.sort((a, b) => a.diff - b.diff);
  
  return { mag: diffs[0].mag, dziLevel: diffs[0].dziLevel };
}

// ===== UPDATE GRID STATE =====
function updateGridState(viewer: OpenSeadragon.Viewer) {
  if (!manifest) return;
  
  const magInfo = getCurrentMagnificationAndLevel(viewer, manifest);
  
  // If we're in "fit" mode (null), use 2.5× as reference for grid calculations
  // This represents the first click level
  const mag = magInfo ? magInfo.mag : 2.5;
  const dziLevel = magInfo ? magInfo.dziLevel : manifest.magnification_levels['2.5x'];
  
  const cellSize = cellSizeForZoom(manifest.patch_px, mag);
  const [numCols, numRows] = gridDimensions(manifest.level0_width, manifest.level0_height, cellSize);
  
  gridState = {
    manifest,
    currentZoomMag: mag,
    currentDziLevel: dziLevel,
    cellSize,
    numCols,
    numRows
  };
  
  // Update debug UI
  updateDebugUI();
}

// ===== UPDATE DEBUG UI =====
function updateDebugUI() {
  // Update current zoom level
  const zoomEl = document.getElementById('current-zoom');
  if (zoomEl && gridState) {
    zoomEl.textContent = `${gridState.currentZoomMag}×`;
  }
  
  // Update fit status
  const fitStatusEl = document.getElementById('fit-status');
  if (fitStatusEl && fitResult) {
    fitStatusEl.textContent = fitResult.fitsAt5x ? 'Yes' : 'No';
  }
  
  // Update start level
  const startLevelEl = document.getElementById('start-level');
  if (startLevelEl && fitResult) {
    startLevelEl.textContent = `${fitResult.startLevel}×`;
  }
  
  // Update grid dimensions
  const gridDimsEl = document.getElementById('grid-dims');
  if (gridDimsEl && gridState) {
    gridDimsEl.textContent = `${gridState.numCols} × ${gridState.numRows} cells`;
  }
}

// ===== ZOOM LADDER NAVIGATION =====
/**
 * Get the next zoom level in the ladder: fit → 2.5× → 5× → 10× → 20× → 40×
 * Returns null if already at max zoom (40×).
 */
function getNextZoomLevel(currentZoom: number | null): number | null {
  // Ladder: fit → 2.5× → 5× → 10× → 20× → 40×
  if (currentZoom === null) return 2.5;  // From fit → 2.5×
  if (currentZoom === 2.5) return 5;     // 2.5× → 5×
  if (currentZoom === 5) return 10;      // 5× → 10×
  if (currentZoom === 10) return 20;     // 10× → 20×
  if (currentZoom === 20) return 40;     // 20× → 40×
  
  return null; // Already at 40×
}

/**
 * Get the previous zoom level (for zooming out).
 * Returns null for "fit" mode (home zoom).
 */
function getPreviousZoomLevel(currentZoom: number): number | null {
  if (currentZoom === 40) return 20;     // 40× → 20×
  if (currentZoom === 20) return 10;     // 20× → 10×
  if (currentZoom === 10) return 5;      // 10× → 5×
  if (currentZoom === 5) return 2.5;     // 5× → 2.5×
  if (currentZoom === 2.5) return null;  // 2.5× → fit
  
  return null; // Already at fit
}

/**
 * Get current viewport center in level-0 coordinates.
 */
function getCurrentCenter(): { x: number; y: number } {
  const bounds = viewer.viewport.getBounds();
  const center = viewer.viewport.viewportToImageCoordinates(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2
  );
  return { x: center.x, y: center.y };
}

/**
 * Save current state to history before navigating.
 */
function pushHistory() {
  if (!gridState) return;
  
  const center = getCurrentCenter();
  zoomHistory.push({
    zoomMag: gridState.currentZoomMag,
    centerX: center.x,
    centerY: center.y
  });
  
  updateBackButton();
}

/**
 * Go back one step in zoom history.
 */
function goBack() {
  if (!manifest) return;
  
  if (zoomHistory.length === 0) {
    console.log('No history to go back to');
    return;
  }
  
  const previousState = zoomHistory.pop()!;
  
  console.log('=== GO BACK ===');
  console.log(`Restoring: ${previousState.zoomMag}× at (${previousState.centerX.toFixed(0)}, ${previousState.centerY.toFixed(0)})`);
  
  // Check if this is the start state (fit mode)
  if (previousState.zoomMag === startState.zoomMag && 
      Math.abs(previousState.centerX - startState.centerX) < 100 && 
      Math.abs(previousState.centerY - startState.centerY) < 100) {
    // Go to fit mode
    viewer.viewport.goHome(true);
    console.log('Restored to fit mode (start state)');
  } else {
    // Restore to specific zoom level using DZI level
    const dziLevel = manifest.magnification_levels[`${previousState.zoomMag}x` as '2.5x' | '5x' | '10x' | '20x' | '40x'];
    const zoomValue = getZoomForDziLevel(dziLevel, viewer);
    viewer.viewport.zoomTo(zoomValue, undefined, true);
    
    // Restore center
    const centerViewport = viewer.viewport.imageToViewportCoordinates(previousState.centerX, previousState.centerY);
    viewer.viewport.panTo(centerViewport, true);
    
    console.log(`Restored to ${previousState.zoomMag}× (DZI ${dziLevel})`);
  }
  
  // Force grid state update after going back (fixes cursor state issue)
  setTimeout(() => {
    updateGridState(viewer);
    updateBackButton();
  }, 100);
  
  console.log('===============');
  
  // Log back_step event
  setTimeout(() => logEvent('back_step'), 150);
}

/**
 * Reset to initial view: fit entire slide on screen.
 * Clears zoom history.
 */
function resetView() {
  if (!startState) {
    console.log('No start state to reset to');
    return;
  }
  
  console.log('=== RESET ===');
  console.log(`Resetting to start state: fit entire slide`);
  
  // Clear zoom history
  zoomHistory = [];
  
  // Go to fit mode (home zoom) - shows entire slide
  viewer.viewport.goHome(true);
  
  console.log('Reset to fit mode');
  
  // Force grid state update after reset (fixes cursor state issue)
  setTimeout(() => {
    updateGridState(viewer);
    updateBackButton();
  }, 100);
  
  console.log('=============');
  
  // Log reset event
  setTimeout(() => logEvent('reset'), 150);
}

/**
 * Update Back button enabled/disabled state.
 */
function updateBackButton() {
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  if (btnBack) {
    btnBack.disabled = zoomHistory.length === 0;
  }
}

// ===== ARROW NAVIGATION =====
/**
 * Pan viewport by 0.5× viewport dimension in the specified direction.
 * Clamps to slide bounds to prevent panning beyond the image.
 */
function panByArrow(direction: 'up' | 'down' | 'left' | 'right') {
  if (!manifest) {
    console.warn('Cannot pan: manifest not loaded');
    return;
  }
  
  const viewport = viewer.viewport;
  
  // Get current viewport bounds in viewport coordinates (0-1 normalized)
  const bounds = viewport.getBounds();
  
  // Convert to level-0 pixel coordinates
  const topLeft = viewport.viewportToImageCoordinates(bounds.x, bounds.y);
  const bottomRight = viewport.viewportToImageCoordinates(
    bounds.x + bounds.width,
    bounds.y + bounds.height
  );
  
  const viewportWidth = bottomRight.x - topLeft.x;
  const viewportHeight = bottomRight.y - topLeft.y;
  
  console.log(`=== ARROW PAN: ${direction.toUpperCase()} ===`);
  console.log(`Viewport size: ${viewportWidth.toFixed(0)} × ${viewportHeight.toFixed(0)} px`);
  console.log(`Slide size: ${manifest.level0_width} × ${manifest.level0_height} px`);
  
  // If viewport is larger than slide, don't pan (entire slide is visible)
  if (viewportWidth >= manifest.level0_width && viewportHeight >= manifest.level0_height) {
    console.log('Entire slide visible - no panning needed');
    return;
  }
  
  // Calculate pan distance (0.5× viewport dimension)
  const panDistanceX = viewportWidth * 0.5;
  const panDistanceY = viewportHeight * 0.5;
  
  // Get current center in level-0 coordinates
  const center = viewport.viewportToImageCoordinates(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2
  );
  
  console.log(`Current center: (${center.x.toFixed(0)}, ${center.y.toFixed(0)})`);
  
  let newCenterX = center.x;
  let newCenterY = center.y;
  
  // Apply pan based on direction
  switch (direction) {
    case 'up':
      newCenterY -= panDistanceY;
      console.log(`Moving UP: Y ${center.y.toFixed(0)} → ${newCenterY.toFixed(0)}`);
      break;
    case 'down':
      newCenterY += panDistanceY;
      console.log(`Moving DOWN: Y ${center.y.toFixed(0)} → ${newCenterY.toFixed(0)}`);
      break;
    case 'left':
      newCenterX -= panDistanceX;
      console.log(`Moving LEFT: X ${center.x.toFixed(0)} → ${newCenterX.toFixed(0)}`);
      break;
    case 'right':
      newCenterX += panDistanceX;
      console.log(`Moving RIGHT: X ${center.x.toFixed(0)} → ${newCenterX.toFixed(0)}`);
      break;
  }
  
  // Clamp to slide bounds
  // Ensure the viewport stays within [0, slideWidth] × [0, slideHeight]
  const halfViewportWidth = viewportWidth / 2;
  const halfViewportHeight = viewportHeight / 2;
  
  // If viewport is larger than slide in a dimension, center it
  if (viewportWidth >= manifest.level0_width) {
    newCenterX = manifest.level0_width / 2;
  } else {
    newCenterX = Math.max(halfViewportWidth, Math.min(manifest.level0_width - halfViewportWidth, newCenterX));
  }
  
  if (viewportHeight >= manifest.level0_height) {
    newCenterY = manifest.level0_height / 2;
  } else {
    newCenterY = Math.max(halfViewportHeight, Math.min(manifest.level0_height - halfViewportHeight, newCenterY));
  }
  
  console.log(`After clamp: (${newCenterX.toFixed(0)}, ${newCenterY.toFixed(0)})`);
  
  // Convert back to viewport coordinates and pan
  const newCenterViewport = viewport.imageToViewportCoordinates(newCenterX, newCenterY);
  viewport.panTo(newCenterViewport, true);
  
  console.log('=========================');
  
  // Log arrow_pan event
  logEvent('arrow_pan');
}

// Initialize OpenSeadragon viewer
const viewer = OpenSeadragon({
  id: "viewer",
  prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/images/",
  tileSources: "/tiles/test_slide.dzi",
  
  // Disable all built-in navigation controls
  showNavigationControl: false,
  showNavigator: false,
  
  // Disable free pan and zoom - we use discrete navigation only
  panHorizontal: false,
  panVertical: false,
  zoomPerClick: 1.0,        // No zoom on click
  zoomPerScroll: 1.0,       // No zoom on wheel
  
  // Disable mouse gestures
  gestureSettingsMouse: {
    clickToZoom: false,
    dblClickToZoom: false,
    flickEnabled: false
  },
  
  // Disable touch gestures
  gestureSettingsTouch: {
    pinchToZoom: false,
    flickEnabled: false
  },
  
  // Constrain to useful magnification levels (2.5× to 40×)
  // DZI levels: 14=2.5×, 15=5×, 16=10×, 17=20×, 18=40×
  minZoomLevel: 0.5,        // Prevent zooming out to blank low-res levels
  defaultZoomLevel: 1.0,    // Will be overridden based on fit calculation
  visibilityRatio: 1.0,     // Keep entire image in view
  constrainDuringPan: true,
  
  // === TILE LOADING OPTIMIZATION (fixes blurriness issues) ===
  immediateRender: false,   // Wait for proper tiles before displaying (prevents blur)
  blendTime: 0.1,           // Quick blend (was default 0.5s, too slow for discrete steps)
  minPixelRatio: 0.8,       // Only show tiles with at least 80% of needed resolution
  preload: true,            // Preload tiles from adjacent areas
  imageLoaderLimit: 5,      // Allow up to 5 concurrent tile requests
  timeout: 120000           // 2 minute timeout for tile loading
});

// Log when slide is loaded
viewer.addHandler('open', async () => {
  console.log('Slide loaded successfully!');
  console.log('Image dimensions:', viewer.world.getItemAt(0).getContentSize());
  
  // Load manifest and initialize grid state
  try {
    manifest = await loadManifest();
    
    // Calculate fit and determine start level
    const containerWidth = viewer.container.clientWidth;
    const containerHeight = viewer.container.clientHeight;
    
    fitResult = calculateFit(
      manifest.level0_width,
      manifest.level0_height,
      containerWidth,
      containerHeight
    );
    
    console.log('=== FIT CALCULATION ===');
    console.log(`Container: ${containerWidth} × ${containerHeight} px`);
    console.log(`Slide at 5×: ${fitResult.displayWidthAt5x.toFixed(0)} × ${fitResult.displayHeightAt5x.toFixed(0)} px`);
    console.log(`Fits at 5×: ${fitResult.fitsAt5x}`);
    console.log(`Start level: ${fitResult.startLevel}×`);
    console.log('=======================');
    
    // Update debug UI
    updateDebugUI();
    
    // Set initial view to fit entire slide (home zoom)
    viewer.viewport.goHome(true);
    
    console.log(`Initial view: Fit entire slide (home zoom)`);
    
    // Initialize grid state (will detect we're at fit level)
    updateGridState(viewer);
    
    // Save start state for Reset functionality
    // Start state is "fit entire slide" (null magnification)
    const startCenter = getCurrentCenter();
    startState = {
      zoomMag: 2.5,  // Use 2.5 as placeholder for fit state (first click will go to 2.5×)
      centerX: startCenter.x,
      centerY: startCenter.y
    };
    console.log(`Saved start state: fit entire slide, center at (${startState.centerX.toFixed(0)}, ${startState.centerY.toFixed(0)})`);
    
    // Log slide_load event
    logEvent('slide_load');
    
  } catch (error) {
    console.error('Failed to load manifest:', error);
    alert('Failed to load slide manifest. Check console for details.');
  }
});

// Monitor tile loading for debugging (can remove if not needed)
let tilesLoading = 0;
viewer.addHandler('tile-load-failed', (event: any) => {
  console.warn('[TILE] Load failed:', event.tile?.url || 'unknown tile');
});

viewer.addHandler('tile-loading', () => {
  tilesLoading++;
});

viewer.addHandler('tile-loaded', () => {
  tilesLoading--;
  if (tilesLoading === 0) {
    console.log('[TILE] All tiles loaded for current view');
  }
});

// Update grid state when zoom changes
viewer.addHandler('zoom', () => {
  if (manifest) {
    updateGridState(viewer);
  }
});

// Log any errors
viewer.addHandler('open-failed', (event) => {
  console.error('Failed to load slide:', event);
  alert('Failed to load slide. Check console for details.');
});

// Log app_start event when page loads
window.addEventListener('DOMContentLoaded', () => {
  console.log(`=== APP START ===`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`User ID: ${userId}`);
  console.log(`App Version: ${appVersion}`);
  console.log('=================');
});

// ===== WIRE UP NAVIGATION BUTTONS =====
// Enable arrow buttons after slide loads
viewer.addHandler('open', () => {
  // Get arrow button elements
  const btnUp = document.getElementById('btn-up') as HTMLButtonElement;
  const btnDown = document.getElementById('btn-down') as HTMLButtonElement;
  const btnLeft = document.getElementById('btn-left') as HTMLButtonElement;
  const btnRight = document.getElementById('btn-right') as HTMLButtonElement;
  
  // Enable buttons (remove disabled attribute)
  if (btnUp) btnUp.disabled = false;
  if (btnDown) btnDown.disabled = false;
  if (btnLeft) btnLeft.disabled = false;
  if (btnRight) btnRight.disabled = false;
  
  // Add click handlers
  btnUp?.addEventListener('click', () => panByArrow('up'));
  btnDown?.addEventListener('click', () => panByArrow('down'));
  btnLeft?.addEventListener('click', () => panByArrow('left'));
  btnRight?.addEventListener('click', () => panByArrow('right'));
  
  console.log('Arrow buttons enabled');
});

// Wire up Back and Reset buttons
const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;

btnBack?.addEventListener('click', goBack);
btnReset?.addEventListener('click', resetView);

// Wire up Export CSV button
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
btnExport?.addEventListener('click', exportCSV);

// ===== WIRE UP LABEL SELECTION =====
// Track label selection
const labelRadios = document.querySelectorAll('input[name="diagnosis"]') as NodeListOf<HTMLInputElement>;
labelRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      currentLabel = radio.value as 'normal' | 'benign' | 'malignant';
      console.log(`Label selected: ${currentLabel}`);
      
      // Log label_select event
      logEvent('label_select', { label: currentLabel });
    }
  });
});

// Handle Confirm & Next button
const btnConfirm = document.getElementById('btn-confirm') as HTMLButtonElement;
btnConfirm?.addEventListener('click', () => {
  if (!currentLabel) {
    alert('Please select a diagnosis before confirming.');
    return;
  }
  
  console.log('=== CONFIRM & NEXT ===');
  console.log(`Confirmed label: ${currentLabel}`);
  console.log('======================');
  
  // Log slide_next event
  logEvent('slide_next', { label: currentLabel });
  
  // In V1, we don't have multiple slides, so just show confirmation
  alert(`Diagnosis confirmed: ${currentLabel.charAt(0).toUpperCase() + currentLabel.slice(1)}\n\nIn V1, this would advance to the next slide.`);
});

// ===== KEYBOARD SHORTCUTS =====
// Support both WASD and arrow keys
document.addEventListener('keydown', (event) => {
  // Don't interfere if user is typing in an input field
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  
  // Map keys to directions
  const keyMap: Record<string, 'up' | 'down' | 'left' | 'right' | null> = {
    'w': 'up',
    'W': 'up',
    'ArrowUp': 'up',
    
    's': 'down',
    'S': 'down',
    'ArrowDown': 'down',
    
    'a': 'left',
    'A': 'left',
    'ArrowLeft': 'left',
    
    'd': 'right',
    'D': 'right',
    'ArrowRight': 'right'
  };
  
  const direction = keyMap[event.key];
  
  if (direction) {
    event.preventDefault(); // Prevent default browser scroll behavior
    panByArrow(direction);
  }
});

// ===== MOUSE WHEEL ZOOM =====
// Enable discrete zoom in/out with mouse wheel
// Zoom IN centers on cursor (like click), zoom OUT keeps current center
const viewerElement = document.getElementById('viewer');
if (viewerElement) {
  viewerElement.addEventListener('wheel', (event: WheelEvent) => {
    if (!manifest || !gridState) return;
    
    event.preventDefault(); // Prevent default scroll behavior
    
    // Check if we're currently in "fit" mode
    const magInfo = getCurrentMagnificationAndLevel(viewer, manifest);
    const currentMag = magInfo ? magInfo.mag : null; // null = fit mode
    
    // Determine zoom direction: wheel down = zoom out, wheel up = zoom in
    const zoomOut = event.deltaY > 0;
    
    let newMag: number | null;
    
    if (zoomOut) {
      // Zoom OUT
      newMag = currentMag !== null ? getPreviousZoomLevel(currentMag) : null;
      
      if (newMag === currentMag || (currentMag === null && newMag === null)) {
        console.log('Already at minimum zoom (fit)');
        return;
      }
    } else {
      // Zoom IN
      newMag = getNextZoomLevel(currentMag);
      
      if (newMag === null || newMag === currentMag) {
        console.log('Already at maximum zoom (40×)');
        return;
      }
    }
    
    // Get target center
    let targetCenter;
    
    if (!zoomOut && newMag !== null) {
      // Zoom IN: Get cursor position in level-0 coordinates
      const rect = viewerElement.getBoundingClientRect();
      const pixelX = event.clientX - rect.left;
      const pixelY = event.clientY - rect.top;
      const viewportPoint = viewer.viewport.pointFromPixel(new OpenSeadragon.Point(pixelX, pixelY));
      const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);
      
      targetCenter = { x: imagePoint.x, y: imagePoint.y };
      
      console.log(`=== MOUSE WHEEL ZOOM IN ===`);
      console.log(`${currentMag || 'fit'}× → ${newMag}×`);
      console.log(`Centering on cursor: (${targetCenter.x.toFixed(0)}, ${targetCenter.y.toFixed(0)})`);
    } else {
      // Zoom OUT: Keep current center
      targetCenter = getCurrentCenter();
      
      console.log(`=== MOUSE WHEEL ZOOM OUT ===`);
      console.log(`${currentMag}× → ${newMag || 'fit'}×`);
      console.log(`Keeping center: (${targetCenter.x.toFixed(0)}, ${targetCenter.y.toFixed(0)})`);
    }
    
    // Zoom to target level
    if (newMag === null) {
      // Zoom to fit (home zoom)
      viewer.viewport.goHome(true);
    } else {
      // Zoom to specific magnification using exact DZI level
      const newDziLevel = manifest.magnification_levels[`${newMag}x` as '2.5x' | '5x' | '10x' | '20x' | '40x'];
      const zoomValue = getZoomForDziLevel(newDziLevel, viewer);
      viewer.viewport.zoomTo(zoomValue, undefined, true);
      
      // Pan to target center
      const centerViewport = viewer.viewport.imageToViewportCoordinates(targetCenter.x, targetCenter.y);
      viewer.viewport.panTo(centerViewport, true);
    }
    
    console.log('===========================');
    
    // Log zoom event (after grid state updates)
    setTimeout(() => logEvent('zoom_step'), 50);
  });
}

// ===== CLICK-TO-ZOOM LADDER =====
/**
 * Handle click on viewer: recenter to nearest patch center and step zoom.
 * Edge cells are filtered (not clickable).
 * Ladder: fit → 2.5× → 5× → 10× → 20× → 40×
 * At max zoom (40×), clicking does nothing (no recenter, no zoom).
 */
viewer.addHandler('canvas-click', (event: any) => {
  if (!manifest || !gridState) return;
  
  // Check if we're in "fit" mode
  const magInfo = getCurrentMagnificationAndLevel(viewer, manifest);
  const currentMag = magInfo ? magInfo.mag : null;
  
  // At max zoom (40×), clicking does NOTHING (no recenter, no zoom)
  if (currentMag === 40) {
    console.log('Already at max zoom (40×) - clicking disabled');
    return;
  }
  
  // Get click position in viewport coordinates
  const viewportPoint = viewer.viewport.pointFromPixel(event.position);
  
  // Convert to level-0 image coordinates
  const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);
  
  // Get grid indices for the CURRENT magnification (use 2.5× grid if in fit mode)
  const [i, j] = indexOf(imagePoint.x, imagePoint.y, gridState.cellSize);
  
  // Check if this is an edge cell - edge cells are not clickable
  const isEdge = isEdgeCell(i, j, manifest.level0_width, manifest.level0_height, gridState.cellSize);
  
  if (isEdge) {
    console.log(`Clicked edge cell (${i}, ${j}) - not clickable`);
    return;
  }
  
  // Get the EXACT click position (not cell center)
  // This ensures artifacts the user clicks on stay centered after zoom
  const clickX = imagePoint.x;
  const clickY = imagePoint.y;
  
  console.log('=== CLICK-TO-ZOOM ===');
  if (currentMag === null) {
    console.log(`Clicked cell: (${i}, ${j}) at fit mode`);
  } else {
    console.log(`Clicked cell: (${i}, ${j}) at ${currentMag}× (DZI level ${gridState.currentDziLevel})`);
  }
  console.log(`Click position (level-0): (${clickX.toFixed(0)}, ${clickY.toFixed(0)})`);
  
  // Save current state to history before navigating
  pushHistory();
  
  // Log cell_click event (before navigation)
  logEvent('cell_click', { cellI: i, cellJ: j });
  
  // Recenter viewport to EXACT click position (not cell center)
  const centerViewport = viewer.viewport.imageToViewportCoordinates(clickX, clickY);
  viewer.viewport.panTo(centerViewport, true);
  
  console.log(`Recentered to: (${clickX.toFixed(0)}, ${clickY.toFixed(0)})`);
  
  // Check if we can zoom further
  const nextZoom = getNextZoomLevel(currentMag);
  
  if (nextZoom !== null) {
    // Get exact DZI level for next zoom
    const nextDziLevel = manifest.magnification_levels[`${nextZoom}x` as '2.5x' | '5x' | '10x' | '20x' | '40x'];
    
    // Step to next zoom level using exact DZI level
    const newZoomValue = getZoomForDziLevel(nextDziLevel, viewer);
    viewer.viewport.zoomTo(newZoomValue, undefined, true);
    
    console.log(`Zoomed: ${currentMag || 'fit'}× → ${nextZoom}× (DZI ${nextDziLevel})`);
    
    // Log zoom_step event (after zoom completes and grid state updates)
    setTimeout(() => logEvent('zoom_step'), 50);
  }
  
  console.log('====================');
});

// ===== CURSOR STYLE FOR EDGE CELLS =====
// Update cursor style based on whether cell is clickable
if (viewerElement) {
  viewerElement.addEventListener('mousemove', (event: MouseEvent) => {
    if (!manifest || !gridState) return;
    
    // At max zoom (40×), show default cursor (clicking disabled)
    if (gridState.currentZoomMag === 40) {
      viewerElement.style.cursor = 'default';
      return;
    }
    
    // Get mouse position relative to viewer
    const rect = viewerElement.getBoundingClientRect();
    const pixelX = event.clientX - rect.left;
    const pixelY = event.clientY - rect.top;
    
    // Convert to OSD viewport coordinates
    const viewportPoint = viewer.viewport.pointFromPixel(new OpenSeadragon.Point(pixelX, pixelY));
    
    // Convert to level-0 image coordinates
    const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);
    
    // Check if point is within slide bounds
    if (imagePoint.x < 0 || imagePoint.x >= manifest.level0_width ||
        imagePoint.y < 0 || imagePoint.y >= manifest.level0_height) {
      viewerElement.style.cursor = 'default';
      return;
    }
    
    // Get grid indices
    const [i, j] = indexOf(imagePoint.x, imagePoint.y, gridState.cellSize);
    
    // Check if edge cell
    const isEdge = isEdgeCell(i, j, manifest.level0_width, manifest.level0_height, gridState.cellSize);
    
    // Update cursor style: pointer for clickable cells, not-allowed for edge cells
    viewerElement.style.cursor = isEdge ? 'not-allowed' : 'pointer';
  });
}
