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
  
  // CSV header row (matches spec schema)
  const headers = [
    'ts_iso8601',
    'session_id',
    'user_id',
    'slide_id',
    'event',
    'zoom_level',
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

// ===== MAGNIFICATION ↔ OSD ZOOM MAPPING =====
/**
 * Convert magnification level to OpenSeadragon zoom value.
 * 
 * OSD zoom relates to how many screen pixels represent one image pixel.
 * For our zoom ladder: 2.5×, 5×, 10×, 20×, 40×
 * 
 * The relationship is: zoom = mag / 40 * imageWidth / containerWidth
 * But we simplify using the fact that at home zoom (fitting entire image),
 * zoom = 1.0, and we scale from there based on magnification.
 */
function getZoomForMagnification(mag: number, viewer: OpenSeadragon.Viewer): number {
  // Get the zoom level that would show the entire image (home zoom)
  const homeZoom = viewer.viewport.getHomeZoom();
  
  // At 40× magnification, we're at native resolution
  // At lower magnifications, we're zoomed out by the ratio
  // Since home zoom fits the entire image, and our base is 40×,
  // we need to scale relative to what magnification "home" represents
  
  // The slide's native resolution is 40×
  // Home zoom shows the entire slide, which at our smallest container
  // dimension determines the initial zoom factor
  // 
  // For discrete levels, we calculate zoom as: homeZoom * (mag / magAtHome)
  // where magAtHome is the magnification level that fits the entire image
  
  // Simple approach: relative to home zoom
  // Assume home = ~2.5× for large slides, ~5× for smaller ones
  // But we want absolute control, so:
  // At mag 2.5×: zoom should show entire image (approximately homeZoom)
  // At mag 5×:   zoom = homeZoom * 2
  // At mag 10×:  zoom = homeZoom * 4
  // At mag 20×:  zoom = homeZoom * 8
  // At mag 40×:  zoom = homeZoom * 16
  
  const zoomMultiplier = mag / 2.5;
  return homeZoom * zoomMultiplier;
}

/**
 * Map OpenSeadragon zoom level to magnification (2.5×, 5×, 10×, 20×, 20×, 40×)
 * Finds the closest magnification level to current zoom.
 */
function getCurrentMagnification(viewer: OpenSeadragon.Viewer, _manifest: SlideManifest): number {
  const currentZoom = viewer.viewport.getZoom(true);
  const homeZoom = viewer.viewport.getHomeZoom();
  
  // Calculate which magnification level we're closest to
  const magnifications = [2.5, 5, 10, 20, 40];
  const multiplier = currentZoom / homeZoom;
  
  // Map multiplier to magnification (multiplier = mag / 2.5)
  const estimatedMag = multiplier * 2.5;
  
  // Find closest discrete magnification level
  let closestMag = magnifications[0];
  let minDiff = Math.abs(estimatedMag - closestMag);
  
  for (const mag of magnifications) {
    const diff = Math.abs(estimatedMag - mag);
    if (diff < minDiff) {
      minDiff = diff;
      closestMag = mag;
    }
  }
  
  return closestMag;
}

// ===== UPDATE GRID STATE =====
function updateGridState(viewer: OpenSeadragon.Viewer) {
  if (!manifest) return;
  
  const currentZoomMag = getCurrentMagnification(viewer, manifest);
  const cellSize = cellSizeForZoom(manifest.patch_px, currentZoomMag);
  const [numCols, numRows] = gridDimensions(manifest.level0_width, manifest.level0_height, cellSize);
  
  gridState = {
    manifest,
    currentZoomMag,
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
 * Get the next zoom level in the ladder: 2.5 → 5 → 10 → 20 → 40
 * Returns null if already at max zoom (40×).
 */
function getNextZoomLevel(currentZoom: number): number | null {
  const ladder = [2.5, 5, 10, 20, 40];
  const currentIndex = ladder.indexOf(currentZoom);
  
  if (currentIndex === -1 || currentIndex === ladder.length - 1) {
    return null; // Already at max or invalid zoom
  }
  
  return ladder[currentIndex + 1];
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
  if (zoomHistory.length === 0) {
    console.log('No history to go back to');
    return;
  }
  
  const previousState = zoomHistory.pop()!;
  
  console.log('=== GO BACK ===');
  console.log(`Restoring: ${previousState.zoomMag}× at (${previousState.centerX.toFixed(0)}, ${previousState.centerY.toFixed(0)})`);
  
  // Restore zoom level
  const zoomValue = getZoomForMagnification(previousState.zoomMag, viewer);
  viewer.viewport.zoomTo(zoomValue, undefined, true);
  
  // Restore center
  const centerViewport = viewer.viewport.imageToViewportCoordinates(previousState.centerX, previousState.centerY);
  viewer.viewport.panTo(centerViewport, true);
  
  updateBackButton();
  console.log('===============');
  
  // Log back_step event
  setTimeout(() => logEvent('back_step'), 50);
}

/**
 * Reset to initial zoom and center (start state).
 */
function resetView() {
  if (!startState) {
    console.log('No start state to reset to');
    return;
  }
  
  console.log('=== RESET ===');
  console.log(`Resetting to: ${startState.zoomMag}× at (${startState.centerX.toFixed(0)}, ${startState.centerY.toFixed(0)})`);
  
  // Clear history
  zoomHistory = [];
  
  // Restore start state
  const zoomValue = getZoomForMagnification(startState.zoomMag, viewer);
  viewer.viewport.zoomTo(zoomValue, undefined, true);
  
  const centerViewport = viewer.viewport.imageToViewportCoordinates(startState.centerX, startState.centerY);
  viewer.viewport.panTo(centerViewport, true);
  
  updateBackButton();
  console.log('=============');
  
  // Log reset event
  setTimeout(() => logEvent('reset'), 50);
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
  viewport.panTo(newCenterViewport, true); // immediate pan, no animation
  
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
  constrainDuringPan: true
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
    
    // Set initial zoom to exact start level (5× or 2.5×)
    const startZoom = getZoomForMagnification(fitResult.startLevel, viewer);
    viewer.viewport.zoomTo(startZoom, undefined, true); // immediate zoom, no animation
    viewer.viewport.goHome(true); // Center the slide
    
    console.log(`Set start zoom: ${fitResult.startLevel}× (OSD zoom: ${startZoom.toFixed(3)})`);
    
    // Initialize grid state
    updateGridState(viewer);
    
    // Save start state for Reset functionality
    const startCenter = getCurrentCenter();
    startState = {
      zoomMag: fitResult.startLevel,
      centerX: startCenter.x,
      centerY: startCenter.y
    };
    console.log(`Saved start state: ${startState.zoomMag}× at (${startState.centerX.toFixed(0)}, ${startState.centerY.toFixed(0)})`);
    
    // Log slide_load event
    logEvent('slide_load');
    
  } catch (error) {
    console.error('Failed to load manifest:', error);
    alert('Failed to load slide manifest. Check console for details.');
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

// ===== CLICK-TO-ZOOM LADDER =====
/**
 * Handle click on viewer: recenter to nearest patch center and step zoom.
 * Edge cells are filtered (not clickable).
 * At max zoom (40×), only recenter without zooming further.
 */
viewer.addHandler('canvas-click', (event: any) => {
  if (!manifest || !gridState) return;
  
  // Get click position in viewport coordinates
  const viewportPoint = viewer.viewport.pointFromPixel(event.position);
  
  // Convert to level-0 image coordinates
  const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);
  
  // Get grid indices
  const [i, j] = indexOf(imagePoint.x, imagePoint.y, gridState.cellSize);
  
  // Check if this is an edge cell - edge cells are not clickable
  const isEdge = isEdgeCell(i, j, manifest.level0_width, manifest.level0_height, gridState.cellSize);
  
  if (isEdge) {
    console.log(`Clicked edge cell (${i}, ${j}) - not clickable`);
    // TODO: Add visual feedback for edge cell clicks (flash message or cursor change)
    return;
  }
  
  // Get center of clicked cell in level-0 coordinates
  const [centerX, centerY] = center(i, j, gridState.cellSize);
  
  console.log('=== CLICK-TO-ZOOM ===');
  console.log(`Clicked cell: (${i}, ${j})`);
  console.log(`Cell center (level-0): (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
  console.log(`Current zoom: ${gridState.currentZoomMag}×`);
  
  // Save current state to history before navigating
  pushHistory();
  
  // Log cell_click event (before navigation)
  logEvent('cell_click', { cellI: i, cellJ: j });
  
  // Recenter viewport to patch center
  const centerViewport = viewer.viewport.imageToViewportCoordinates(centerX, centerY);
  viewer.viewport.panTo(centerViewport, true); // immediate pan
  
  console.log(`Recentered to: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
  
  // Check if we can zoom further
  const nextZoom = getNextZoomLevel(gridState.currentZoomMag);
  
  if (nextZoom !== null) {
    // Step to next zoom level
    const newZoomValue = getZoomForMagnification(nextZoom, viewer);
    viewer.viewport.zoomTo(newZoomValue, undefined, true); // immediate zoom
    console.log(`Zoomed: ${gridState.currentZoomMag}× → ${nextZoom}×`);
    
    // Log zoom_step event (after zoom completes)
    // Note: Grid state updates on next zoom handler tick, so we log with old zoom
    // The viewport bounds will reflect the new zoom when logged
    setTimeout(() => logEvent('zoom_step'), 50);
  } else {
    console.log('Already at max zoom (40×) - recentered only');
  }
  
  console.log('====================');
});

// ===== CELL INDEX HOVER OVERLAY =====
// Show grid cell indices (i, j) under cursor
const cellOverlay = document.getElementById('cell-overlay');

// Update cell overlay on mouse move
viewer.addHandler('canvas-drag', () => {
  // Hide overlay during pan
  if (cellOverlay) {
    cellOverlay.classList.remove('visible');
  }
});

// Track mouse position for cell overlay
const viewerElement = document.getElementById('viewer');
if (viewerElement) {
  viewerElement.addEventListener('mousemove', (event: MouseEvent) => {
    if (!manifest || !gridState || !cellOverlay) return;
    
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
      cellOverlay.classList.remove('visible');
      viewerElement.style.cursor = 'default';
      return;
    }
    
    // Get grid indices
    const [i, j] = indexOf(imagePoint.x, imagePoint.y, gridState.cellSize);
    
    // Check if edge cell
    const isEdge = isEdgeCell(i, j, manifest.level0_width, manifest.level0_height, gridState.cellSize);
    
    // Update cursor style: pointer for clickable cells, not-allowed for edge cells
    viewerElement.style.cursor = isEdge ? 'not-allowed' : 'pointer';
    
    // Update overlay content
    const edgeLabel = isEdge ? ' [EDGE]' : '';
    cellOverlay.textContent = `Cell: (${i}, ${j})${edgeLabel}`;
    
    // Position overlay near cursor (offset to avoid covering content)
    cellOverlay.style.left = `${event.clientX + 15}px`;
    cellOverlay.style.top = `${event.clientY + 15}px`;
    
    // Show overlay
    cellOverlay.classList.add('visible');
  });
  
  // Hide overlay when mouse leaves viewer
  viewerElement.addEventListener('mouseleave', () => {
    if (cellOverlay) {
      cellOverlay.classList.remove('visible');
    }
  });
}
