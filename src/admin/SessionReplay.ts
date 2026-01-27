/**
 * SessionReplay.ts - Session Replay Viewer
 * 
 * Provides animated playback of pathologist scanning sessions.
 * Features:
 * - OpenSeadragon viewer for slide display
 * - Canvas overlay for drawing scanning paths
 * - Animated viewport transitions
 * - Playback controls (play/pause, speed, scrubber)
 */

import OpenSeadragon from 'openseadragon';
import type { SessionReplayData, ReplayEvent, SlideManifest } from '../viewer/types';

// ============================================================================
// Types
// ============================================================================

interface ReplayState {
  data: SessionReplayData | null;
  currentIndex: number;
  isPlaying: boolean;
  speed: number;  // 0.5, 1, 2, or 5
  animationFrameId: number | null;
  playTimeoutId: number | null;
}

interface ViewportPoint {
  x: number;
  y: number;
}

// ============================================================================
// State
// ============================================================================

let viewer: OpenSeadragon.Viewer | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

const state: ReplayState = {
  data: null,
  currentIndex: 0,
  isPlaying: false,
  speed: 1,
  animationFrameId: null,
  playTimeoutId: null
};

// Callback to return to dashboard
let onBackCallback: (() => void) | null = null;

// Store event listener references for cleanup
let controlEventHandlers: {
  backBtn?: () => void;
  playBtn?: () => void;
  prevBtn?: () => void;
  nextBtn?: () => void;
  scrubber?: () => void;
  speedSelect?: () => void;
} = {};

// Store window resize handler for cleanup
let resizeHandler: (() => void) | null = null;

// Store viewer event handlers for cleanup
let viewerAnimationHandler: (() => void) | null = null;
let viewerAnimationFinishHandler: (() => void) | null = null;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the replay viewer with session data
 */
export async function initReplay(data: SessionReplayData): Promise<void> {
  console.log('[Replay] Initializing with', data.events.length, 'events');
  
  // Store replay data
  state.data = data;
  state.currentIndex = 0;
  state.isPlaying = false;
  state.speed = 1;
  
  // Show replay page
  showReplayPage();
  
  // Update header with session info
  updateSessionMeta();
  
  // Initialize OpenSeadragon (this will destroy any existing viewer)
  await initViewer(data.session.manifest);
  
  // Initialize canvas overlay
  initCanvas();
  
  // Add viewer event handlers now that viewer is ready
  if (viewer) {
    // Remove existing handlers if present
    if (viewerAnimationHandler) {
      viewer.removeHandler('animation', viewerAnimationHandler);
    }
    if (viewerAnimationFinishHandler) {
      viewer.removeHandler('animation-finish', viewerAnimationFinishHandler);
    }
    
    // Add new handlers and store references
    viewerAnimationHandler = () => drawCurrentState();
    viewerAnimationFinishHandler = () => drawCurrentState();
    viewer.addHandler('animation', viewerAnimationHandler);
    viewer.addHandler('animation-finish', viewerAnimationFinishHandler);
  }
  
  // Setup control event listeners
  setupControls();
  
  // Update UI to initial state
  updateControlsUI();
  
  // Draw initial state (all events up to current)
  drawCurrentState();
  
  // Go to first event
  await goToEvent(0, false);
  
  console.log('[Replay] Initialization complete');
}

/**
 * Set callback for returning to dashboard
 */
export function setOnBack(callback: () => void): void {
  onBackCallback = callback;
}

/**
 * Show the replay page
 */
function showReplayPage(): void {
  const replayPage = document.getElementById('replay-page');
  const dashboard = document.getElementById('admin-dashboard');
  
  if (replayPage) replayPage.style.display = 'flex';
  if (dashboard) dashboard.style.display = 'none';
}

/**
 * Hide the replay page and return to dashboard
 */
export function hideReplayPage(): void {
  // Stop any playing animation
  stopPlayback();
  
  // Remove viewer event handlers
  if (viewer) {
    if (viewerAnimationHandler) {
      try {
        viewer.removeHandler('animation', viewerAnimationHandler);
      } catch (error) {
        console.warn('[Replay] Error removing animation handler:', error);
      }
      viewerAnimationHandler = null;
    }
    if (viewerAnimationFinishHandler) {
      try {
        viewer.removeHandler('animation-finish', viewerAnimationFinishHandler);
      } catch (error) {
        console.warn('[Replay] Error removing animation-finish handler:', error);
      }
      viewerAnimationFinishHandler = null;
    }
  }
  
  // Remove control event listeners
  cleanupControlListeners();
  
  // Remove window resize listener
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  
  // Destroy viewer
  if (viewer) {
    try {
      viewer.destroy();
    } catch (error) {
      console.warn('[Replay] Error destroying viewer:', error);
    }
    viewer = null;
  }
  
  // Clear canvas
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // Hide replay page
  const replayPage = document.getElementById('replay-page');
  const dashboard = document.getElementById('admin-dashboard');
  
  if (replayPage) replayPage.style.display = 'none';
  if (dashboard) dashboard.style.display = 'block';
  
  // Clear state
  state.data = null;
  state.currentIndex = 0;
  
  // Trigger callback
  if (onBackCallback) {
    onBackCallback();
  }
}

/**
 * Update session metadata in header
 */
function updateSessionMeta(): void {
  const metaEl = document.getElementById('replay-session-meta');
  const titleEl = document.getElementById('replay-title');
  
  if (!state.data) return;
  
  const { session } = state.data;
  
  if (titleEl) {
    titleEl.textContent = `Session Replay: ${session.slide_name}`;
  }
  
  if (metaEl) {
    metaEl.textContent = `${session.username} • ${session.label} • ${state.data.events.length} events`;
  }
}

// ============================================================================
// OpenSeadragon Viewer
// ============================================================================

/**
 * Initialize OpenSeadragon viewer
 */
async function initViewer(manifest: SlideManifest): Promise<void> {
  console.log('[Replay] Initializing viewer for', manifest.slide_id);
  
  // Destroy existing viewer if it exists
  if (viewer) {
    console.log('[Replay] Destroying existing viewer before creating new one');
    try {
      viewer.destroy();
    } catch (error) {
      console.warn('[Replay] Error destroying existing viewer:', error);
    }
    viewer = null;
  }
  
  const container = document.getElementById('replay-osd-container');
  if (!container) {
    throw new Error('Replay OSD container not found');
  }
  
  // Clear container in case of leftover elements
  container.innerHTML = '';
  
  // Build DZI URL (local tiles)
  const dziUrl = `/tiles/${manifest.slide_id}.dzi`;
  
  // Create viewer
  viewer = OpenSeadragon({
    element: container,
    tileSources: dziUrl,
    prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/images/',
    
    // Disable user interaction (replay is view-only)
    gestureSettingsMouse: {
      clickToZoom: false,
      dblClickToZoom: false,
      flickEnabled: false
    },
    gestureSettingsTouch: {
      clickToZoom: false,
      dblClickToZoom: false,
      flickEnabled: false,
      pinchToZoom: false
    },
    
    // Allow programmatic pan/zoom
    panHorizontal: true,
    panVertical: true,
    
    // Visual settings
    showNavigationControl: false,
    showNavigator: true,
    navigatorPosition: 'BOTTOM_RIGHT',
    navigatorSizeRatio: 0.15,
    
    // CRITICAL: Ensure goHome() fits entire image instead of filling/cropping
    homeFillsViewer: false,   // false = fit entire image, true = fill viewport (can crop)
    
    // Performance
    minZoomImageRatio: 0.5,
    maxZoomPixelRatio: 2,
    animationTime: 1.0,  // Match main viewer - gives tiles time to load
    springStiffness: 10,
    
    // Tile loading
    // CRITICAL: Disable immediateRender to prevent blurry tiles from showing
    // This forces OSD to wait for correct resolution tiles before displaying
    immediateRender: false,   // Wait for correct resolution (no blurry tiles!)
    imageLoaderLimit: 4,
    timeout: 30000
  });
  
  // Wait for tile source to load
  return new Promise((resolve, reject) => {
    viewer!.addHandler('open', () => {
      console.log('[Replay] Viewer opened');
      resolve();
    });
    
    viewer!.addHandler('open-failed', (event: any) => {
      console.error('[Replay] Failed to open viewer:', event);
      reject(new Error('Failed to load slide'));
    });
  });
}

// ============================================================================
// Canvas Overlay
// ============================================================================

/**
 * Initialize canvas overlay for drawing paths
 * Should be called AFTER viewer is fully initialized
 */
function initCanvas(): void {
  canvas = document.getElementById('replay-canvas-overlay') as HTMLCanvasElement;
  if (!canvas) {
    console.error('[Replay] Canvas overlay not found');
    return;
  }
  
  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[Replay] Failed to get canvas context');
    return;
  }
  
  // Size canvas to container
  resizeCanvas();
  
  // Remove existing resize handler if present
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }
  
  // Resize on window resize - store handler for cleanup
  resizeHandler = resizeCanvas;
  window.addEventListener('resize', resizeHandler);
  
  // Note: Viewer event handlers will be added after viewer is ready
  // (in initReplay after viewer.open() resolves)
}

/**
 * Resize canvas to match container
 */
function resizeCanvas(): void {
  if (!canvas) return;
  
  const container = document.getElementById('replay-viewer-container');
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  
  // Redraw after resize
  drawCurrentState();
}

/**
 * Convert level-0 coordinates to canvas coordinates
 */
function toCanvasCoords(x0: number, y0: number): ViewportPoint | null {
  if (!viewer) return null;
  
  const viewport = viewer.viewport;
  const imageSize = viewer.world.getItemAt(0)?.getContentSize();
  if (!imageSize) return null;
  
  // Convert level-0 to viewport coordinates
  const viewportPoint = viewport.imageToViewportCoordinates(x0, y0);
  
  // Convert viewport to window coordinates
  const windowPoint = viewport.viewportToWindowCoordinates(viewportPoint);
  
  // Adjust for container position
  const container = document.getElementById('replay-viewer-container');
  if (!container) return null;
  
  const rect = container.getBoundingClientRect();
  
  return {
    x: windowPoint.x - rect.left,
    y: windowPoint.y - rect.top
  };
}

/**
 * Draw current state (all events up to currentIndex)
 * 
 * Path segments are separated by reset events - each sequence of clicks
 * between resets forms its own connected path.
 */
function drawCurrentState(): void {
  if (!ctx || !canvas || !state.data) return;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const events = state.data.events;
  
  // Find all click events up to current index, segmented by reset events
  // Each segment is an array of click events that form a connected path
  const clickSegments = getClickSegments(events, state.currentIndex);
  
  // Draw each segment as a separate path
  clickSegments.forEach((segment, segmentIndex) => {
    if (segment.length === 0) return;
    
    // Draw path lines connecting clicks in this segment
    drawPath(segment, segmentIndex, clickSegments.length);
    
    // Draw click markers for this segment
    drawClickMarkers(segment, segmentIndex, clickSegments.length);
  });
  
  // Draw current viewport rectangle
  drawCurrentViewport();
}

/**
 * Get click events segmented by reset events.
 * Returns an array of segments, where each segment is an array of click events
 * that occurred between reset/slide_load events.
 */
function getClickSegments(events: ReplayEvent[], maxIndex: number): ReplayEvent[][] {
  const segments: ReplayEvent[][] = [];
  let currentSegment: ReplayEvent[] = [];
  
  for (let i = 0; i <= maxIndex; i++) {
    const event = events[i];
    
    // Reset and slide_load events start a new segment
    if (event.event === 'reset' || event.event === 'slide_load') {
      // Save current segment if it has clicks
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
      // Start new segment
      currentSegment = [];
    } else if (event.event === 'cell_click') {
      currentSegment.push(event);
    }
  }
  
  // Don't forget the last segment
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  
  return segments;
}

/**
 * Get the click position from an event.
 * For cell_click events, use click_x0/click_y0 (exact click position).
 * For other events (like zoom_step), use center_x0/center_y0 (viewport center).
 */
function getClickPosition(event: ReplayEvent): { x: number, y: number } | null {
  // For cell_click events, use the exact click coordinates
  if (event.event === 'cell_click' && event.click_x0 !== null && event.click_y0 !== null) {
    return { x: event.click_x0, y: event.click_y0 };
  }
  // For other events, use viewport center
  if (event.center_x0 !== null && event.center_y0 !== null) {
    return { x: event.center_x0, y: event.center_y0 };
  }
  return null;
}

/**
 * Draw path connecting click events within a segment.
 * Each segment gets a distinct base color to differentiate exploration sequences.
 */
function drawPath(clickEvents: ReplayEvent[], segmentIndex: number, _totalSegments: number): void {
  if (!ctx || clickEvents.length < 2) return;
  
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Use different base colors for different segments
  // This helps visually distinguish separate exploration sequences
  const segmentColors = [
    { start: '#3498db', end: '#e74c3c' },  // Blue to red (segment 1)
    { start: '#2ecc71', end: '#9b59b6' },  // Green to purple (segment 2)
    { start: '#f39c12', end: '#e91e63' },  // Orange to pink (segment 3)
    { start: '#00bcd4', end: '#ff5722' },  // Cyan to deep orange (segment 4)
  ];
  const colors = segmentColors[segmentIndex % segmentColors.length];
  
  for (let i = 0; i < clickEvents.length - 1; i++) {
    const from = clickEvents[i];
    const to = clickEvents[i + 1];
    
    const fromPos = getClickPosition(from);
    const toPos = getClickPosition(to);
    
    if (!fromPos || !toPos) continue;
    
    const fromPt = toCanvasCoords(fromPos.x, fromPos.y);
    const toPt = toCanvasCoords(toPos.x, toPos.y);
    
    if (!fromPt || !toPt) continue;
    
    // Color gradient within segment (early to late)
    const t = clickEvents.length > 1 ? i / (clickEvents.length - 1) : 0;
    const color = interpolateColor(colors.start, colors.end, t);
    
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(fromPt.x, fromPt.y);
    ctx.lineTo(toPt.x, toPt.y);
    ctx.stroke();
  }
}

/**
 * Draw click markers at each click position within a segment.
 * Markers use the same color scheme as their segment's path.
 */
function drawClickMarkers(clickEvents: ReplayEvent[], segmentIndex: number, totalSegments: number): void {
  if (!ctx) return;
  
  // Store reference to avoid null check issues in forEach
  const context = ctx;
  
  // Use same color scheme as drawPath
  const segmentColors = [
    { start: '#3498db', end: '#e74c3c' },  // Blue to red (segment 1)
    { start: '#2ecc71', end: '#9b59b6' },  // Green to purple (segment 2)
    { start: '#f39c12', end: '#e91e63' },  // Orange to pink (segment 3)
    { start: '#00bcd4', end: '#ff5722' },  // Cyan to deep orange (segment 4)
  ];
  const colors = segmentColors[segmentIndex % segmentColors.length];
  
  // Check if this is the last segment (contains the most recent clicks)
  const isLastSegment = segmentIndex === totalSegments - 1;
  
  clickEvents.forEach((event, i) => {
    const pos = getClickPosition(event);
    if (!pos) return;
    
    const pt = toCanvasCoords(pos.x, pos.y);
    if (!pt) return;
    
    // Color gradient within segment
    const t = clickEvents.length > 1 ? i / (clickEvents.length - 1) : 0;
    const color = interpolateColor(colors.start, colors.end, t);
    
    // Outer circle (filled)
    context.beginPath();
    context.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
    context.fillStyle = color;
    context.globalAlpha = 0.6;
    context.fill();
    context.globalAlpha = 1;
    
    // Inner circle (stroke)
    context.beginPath();
    context.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
    context.strokeStyle = 'white';
    context.lineWidth = 2;
    context.stroke();
    
    // Highlight the most recent click in the last segment with a larger marker
    if (isLastSegment && i === clickEvents.length - 1) {
      context.beginPath();
      context.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
      context.strokeStyle = 'white';
      context.lineWidth = 3;
      context.stroke();
    }
  });
}

/**
 * Draw viewport rectangle for current event
 */
function drawCurrentViewport(): void {
  if (!ctx || !state.data) return;
  
  const event = state.data.events[state.currentIndex];
  if (!event || event.vbx0 === null || event.vby0 === null ||
      event.vtx0 === null || event.vty0 === null) return;
  
  const topLeft = toCanvasCoords(event.vbx0, event.vby0);
  const bottomRight = toCanvasCoords(event.vtx0, event.vty0);
  
  if (!topLeft || !bottomRight) return;
  
  const width = bottomRight.x - topLeft.x;
  const height = bottomRight.y - topLeft.y;
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(topLeft.x, topLeft.y, width, height);
  ctx.setLineDash([]);
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);
  
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  
  return `rgb(${r}, ${g}, ${b})`;
}

// ============================================================================
// Playback Controls
// ============================================================================

/**
 * Setup control event listeners
 * Stores handler references for cleanup
 */
function setupControls(): void {
  // Clean up any existing listeners first
  cleanupControlListeners();
  
  // Back button
  const backBtn = document.getElementById('btn-back-to-dashboard');
  if (backBtn) {
    controlEventHandlers.backBtn = hideReplayPage;
    backBtn.addEventListener('click', controlEventHandlers.backBtn);
  }
  
  // Play/Pause button
  const playBtn = document.getElementById('btn-replay-play');
  if (playBtn) {
    controlEventHandlers.playBtn = togglePlayback;
    playBtn.addEventListener('click', controlEventHandlers.playBtn);
  }
  
  // Previous/Next buttons
  const prevBtn = document.getElementById('btn-replay-prev');
  const nextBtn = document.getElementById('btn-replay-next');
  if (prevBtn) {
    controlEventHandlers.prevBtn = async () => await stepEvent(-1);
    prevBtn.addEventListener('click', controlEventHandlers.prevBtn);
  }
  if (nextBtn) {
    controlEventHandlers.nextBtn = async () => await stepEvent(1);
    nextBtn.addEventListener('click', controlEventHandlers.nextBtn);
  }
  
  // Scrubber
  const scrubber = document.getElementById('replay-scrubber') as HTMLInputElement;
  if (scrubber) {
    controlEventHandlers.scrubber = async () => {
      const index = parseInt(scrubber.value);
      await goToEvent(index, false);
    };
    scrubber.addEventListener('input', controlEventHandlers.scrubber);
  }
  
  // Speed selector
  const speedSelect = document.getElementById('replay-speed') as HTMLSelectElement;
  if (speedSelect) {
    controlEventHandlers.speedSelect = () => {
      state.speed = parseFloat(speedSelect.value);
      console.log('[Replay] Speed changed to', state.speed);
    };
    speedSelect.addEventListener('change', controlEventHandlers.speedSelect);
  }
}

/**
 * Remove all control event listeners
 */
function cleanupControlListeners(): void {
  const backBtn = document.getElementById('btn-back-to-dashboard');
  if (backBtn && controlEventHandlers.backBtn) {
    backBtn.removeEventListener('click', controlEventHandlers.backBtn);
    delete controlEventHandlers.backBtn;
  }
  
  const playBtn = document.getElementById('btn-replay-play');
  if (playBtn && controlEventHandlers.playBtn) {
    playBtn.removeEventListener('click', controlEventHandlers.playBtn);
    delete controlEventHandlers.playBtn;
  }
  
  const prevBtn = document.getElementById('btn-replay-prev');
  if (prevBtn && controlEventHandlers.prevBtn) {
    prevBtn.removeEventListener('click', controlEventHandlers.prevBtn);
    delete controlEventHandlers.prevBtn;
  }
  
  const nextBtn = document.getElementById('btn-replay-next');
  if (nextBtn && controlEventHandlers.nextBtn) {
    nextBtn.removeEventListener('click', controlEventHandlers.nextBtn);
    delete controlEventHandlers.nextBtn;
  }
  
  const scrubber = document.getElementById('replay-scrubber') as HTMLInputElement;
  if (scrubber && controlEventHandlers.scrubber) {
    scrubber.removeEventListener('input', controlEventHandlers.scrubber);
    delete controlEventHandlers.scrubber;
  }
  
  const speedSelect = document.getElementById('replay-speed') as HTMLSelectElement;
  if (speedSelect && controlEventHandlers.speedSelect) {
    speedSelect.removeEventListener('change', controlEventHandlers.speedSelect);
    delete controlEventHandlers.speedSelect;
  }
}

/**
 * Toggle playback
 */
function togglePlayback(): void {
  if (state.isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

/**
 * Start playback
 */
function startPlayback(): void {
  if (!state.data) return;
  
  // If at end, restart from beginning
  if (state.currentIndex >= state.data.events.length - 1) {
    state.currentIndex = 0;
  }
  
  state.isPlaying = true;
  updatePlayButton();
  playNextEvent();
}

/**
 * Stop playback
 */
function stopPlayback(): void {
  state.isPlaying = false;
  
  if (state.playTimeoutId !== null) {
    clearTimeout(state.playTimeoutId);
    state.playTimeoutId = null;
  }
  
  updatePlayButton();
}

/**
 * Wait for animation to complete
 * Returns a promise that resolves when the viewport animation finishes
 */
function waitForAnimation(): Promise<void> {
  return new Promise((resolve) => {
    if (!viewer) {
      resolve();
      return;
    }
    
    // Check if already not animating
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) {
      resolve();
      return;
    }
    
    // If not animating, resolve immediately
    // We check this by listening for animation-finish or checking after a short delay
    let resolved = false;
    
    const finishHandler = () => {
      if (!resolved) {
        resolved = true;
        viewer!.removeHandler('animation-finish', finishHandler);
        resolve();
      }
    };
    
    viewer.addHandler('animation-finish', finishHandler);
    
    // Fallback: if no animation was triggered, resolve after a short delay
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        viewer!.removeHandler('animation-finish', finishHandler);
        resolve();
      }
    }, 100);
  });
}

/**
 * Wait for tiles to fully load at current viewport
 * Returns a promise that resolves when tiles are done loading
 * Should be called AFTER animation completes
 */
function waitForTilesToLoad(): Promise<void> {
  return new Promise((resolve) => {
    if (!viewer) {
      resolve();
      return;
    }
    
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) {
      resolve();
      return;
    }
    
    // Check if already fully loaded
    if (tiledImage.getFullyLoaded()) {
      resolve();
      return;
    }
    
    // Wait for fully-loaded-change event
    let resolved = false;
    const handler = (event: any) => {
      if (event.fullyLoaded && !resolved) {
        resolved = true;
        tiledImage.removeHandler('fully-loaded-change', handler);
        resolve();
      }
    };
    
    tiledImage.addHandler('fully-loaded-change', handler);
    
    // Also add a timeout fallback (max 5 seconds wait for large zoom changes)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        tiledImage.removeHandler('fully-loaded-change', handler);
        console.log('[Replay] Tile loading timeout - proceeding anyway');
        resolve();
      }
    }, 5000);
  });
}

/**
 * Play next event in sequence
 */
async function playNextEvent(): Promise<void> {
  if (!state.isPlaying || !state.data) return;
  
  // Check if at end
  if (state.currentIndex >= state.data.events.length - 1) {
    stopPlayback();
    return;
  }
  
  // Go to next event with animation
  await goToEvent(state.currentIndex + 1, true);
  
  // Wait for tiles to load before proceeding
  await waitForTilesToLoad();
  
  // If playback was stopped while waiting, don't continue
  if (!state.isPlaying) return;
  
  // Calculate delay based on speed and event timestamps
  const currentEvent = state.data.events[state.currentIndex];
  const nextEvent = state.data.events[state.currentIndex + 1];
  
  // Base minimum delay (at least 500ms to see each view)
  let delay = 500 / state.speed;
  
  if (currentEvent && nextEvent) {
    const currentTime = new Date(currentEvent.ts_iso8601).getTime();
    const nextTime = new Date(nextEvent.ts_iso8601).getTime();
    const realDelay = nextTime - currentTime;
    
    // Use real delay but cap to reasonable bounds (500ms to 3000ms after speed adjustment)
    delay = Math.min(3000, Math.max(500, realDelay / state.speed));
  }
  
  // Schedule next event
  state.playTimeoutId = window.setTimeout(() => {
    playNextEvent();
  }, delay);
}

/**
 * Go to specific event index
 * Returns a promise that resolves when the viewport animation completes (if animated)
 * 
 * Key behavior for click/zoom separation:
 * - cell_click: Shows the click marker at the click position WITHOUT changing viewport.
 *   This displays the context in which the user made their click decision.
 * - zoom_step: Applies the zoomed viewport state, showing the result of the zoom action.
 * 
 * CRITICAL: Uses fitBounds() with logged viewport bounds to ensure the replay shows
 * exactly what was visible during the original session, regardless of container size
 * differences between the original viewer and the replay viewer.
 */
async function goToEvent(index: number, animate: boolean): Promise<void> {
  if (!state.data || !viewer) return;
  
  // Clamp index
  index = Math.max(0, Math.min(index, state.data.events.length - 1));
  state.currentIndex = index;
  
  const event = state.data.events[index];
  const eventType = event.event;
  
  console.log(`[Replay] goToEvent(${index}): ${eventType}`, {
    zoom_level: event.zoom_level,
    dzi_level: event.dzi_level,
    center: event.center_x0 !== null ? `(${event.center_x0?.toFixed(0)}, ${event.center_y0?.toFixed(0)})` : 'null',
    bounds: event.vbx0 !== null ? `[${event.vbx0?.toFixed(0)},${event.vty0?.toFixed(0)} - ${event.vtx0?.toFixed(0)},${event.vby0?.toFixed(0)}]` : 'null'
  });
  
  // Update UI immediately (before viewport change)
  updateControlsUI();
  updateEventInfo(event, index);
  
  // Events that should show home view (entire slide)
  if (eventType === 'app_start' || eventType === 'slide_load' || eventType === 'reset') {
    console.log('[Replay] Going to home view');
    viewer.viewport.goHome(!animate); // true = immediate, false = animate
    
    // Wait for animation if needed
    if (animate) {
      await waitForAnimation();
    }
    
    // Draw overlay after animation completes
    drawCurrentState();
    return;
  }
  
  // cell_click: NO viewport change - just show the click marker
  // The click event logs the viewport state BEFORE the click action.
  // This shows the context (what was visible) when the user decided to click.
  // The zoom will be shown on the subsequent zoom_step event.
  if (eventType === 'cell_click') {
    console.log('[Replay] cell_click - showing click marker without viewport change');
    drawCurrentState();
    return;
  }
  
  // label_select, slide_next: No viewport change
  if (eventType === 'label_select' || eventType === 'slide_next') {
    console.log('[Replay]', eventType, '- no viewport change');
    drawCurrentState();
    return;
  }
  
  // zoom_step, arrow_pan, back_step: Apply viewport state from the event
  // These events log the viewport state AFTER the action completed.
  // 
  // CRITICAL: Use fitBounds() with the logged viewport bounds to ensure
  // the replay shows exactly what was visible, regardless of container size.
  // The bounds are in level-0 image coordinates:
  // - vbx0 = left edge X
  // - vty0 = top edge Y  
  // - vtx0 = right edge X
  // - vby0 = bottom edge Y
  
  if (event.vbx0 !== null && event.vty0 !== null && 
      event.vtx0 !== null && event.vby0 !== null) {
    
    try {
      // Calculate the viewport bounds rectangle in image coordinates
      const left = event.vbx0;
      const top = event.vty0;
      const right = event.vtx0;
      const bottom = event.vby0;
      const width = right - left;
      const height = bottom - top;
      
      console.log(`[Replay] Viewport bounds (image coords): left=${left.toFixed(0)}, top=${top.toFixed(0)}, width=${width.toFixed(0)}, height=${height.toFixed(0)}`);
      
      // Convert image bounds to viewport coordinates
      // OpenSeadragon uses normalized viewport coordinates where the image width = 1.0
      const tiledImage = viewer.world.getItemAt(0);
      if (!tiledImage) {
        console.error('[Replay] No tiled image loaded');
        drawCurrentState();
        return;
      }
      
      // Convert image rectangle to viewport rectangle
      const topLeftViewport = tiledImage.imageToViewportCoordinates(left, top);
      const bottomRightViewport = tiledImage.imageToViewportCoordinates(right, bottom);
      
      const viewportRect = new OpenSeadragon.Rect(
        topLeftViewport.x,
        topLeftViewport.y,
        bottomRightViewport.x - topLeftViewport.x,
        bottomRightViewport.y - topLeftViewport.y
      );
      
      console.log(`[Replay] Viewport rect: (${viewportRect.x.toFixed(4)}, ${viewportRect.y.toFixed(4)}) ${viewportRect.width.toFixed(4)} × ${viewportRect.height.toFixed(4)}`);
      
      // Validate coordinates
      if (!isFinite(viewportRect.x) || !isFinite(viewportRect.y) ||
          !isFinite(viewportRect.width) || !isFinite(viewportRect.height) ||
          viewportRect.width <= 0 || viewportRect.height <= 0) {
        console.error('[Replay] Invalid viewport rect:', viewportRect);
        drawCurrentState();
        return;
      }
      
      // Use fitBounds to show exactly this region
      // This ensures the replay shows the same image area regardless of container size
      viewer.viewport.fitBounds(viewportRect, !animate);
      
      // Wait for animation if needed
      if (animate) {
        await waitForAnimation();
      }
    } catch (error) {
      console.error('[Replay] Error updating viewport:', error);
      // Continue anyway - draw what we can
    }
  } else if (event.center_x0 !== null && event.center_y0 !== null) {
    // Fallback: if bounds aren't available, use center + zoom (less accurate)
    console.log('[Replay] No bounds data, falling back to center + zoom');
    
    try {
      let targetZoom: number;
      
      if (event.dzi_level !== null) {
        targetZoom = getZoomForDziLevel(event.dzi_level);
      } else if (event.zoom_level !== null) {
        const maxZoom = viewer.viewport.getMaxZoom();
        targetZoom = maxZoom * (event.zoom_level / 40);
      } else {
        viewer.viewport.goHome(!animate);
        if (animate) await waitForAnimation();
        drawCurrentState();
        return;
      }
      
      const viewportCenter = viewer.viewport.imageToViewportCoordinates(
        event.center_x0, 
        event.center_y0
      );
      
      if (!isFinite(viewportCenter.x) || !isFinite(viewportCenter.y)) {
        console.error('[Replay] Invalid viewport coordinates:', viewportCenter);
        drawCurrentState();
        return;
      }
      
      if (animate) {
        viewer.viewport.zoomTo(targetZoom, undefined, false);
        viewer.viewport.panTo(viewportCenter, false);
        await waitForAnimation();
      } else {
        viewer.viewport.zoomTo(targetZoom, undefined, true);
        viewer.viewport.panTo(viewportCenter, true);
      }
    } catch (error) {
      console.error('[Replay] Error in fallback viewport update:', error);
    }
  } else {
    console.log('[Replay] No viewport data for event', eventType);
  }
  
  // Draw overlay after viewport has settled
  drawCurrentState();
}

/**
 * Step forward or backward by one event
 */
async function stepEvent(delta: number): Promise<void> {
  if (!state.data) return;
  
  const newIndex = state.currentIndex + delta;
  if (newIndex < 0 || newIndex >= state.data.events.length) return;
  
  // Stop playback when manually stepping
  if (state.isPlaying) {
    stopPlayback();
  }
  
  await goToEvent(newIndex, true);
}

/**
 * Get OSD zoom level for a specific DZI level.
 * This uses the exact same calculation as the main viewer to ensure
 * proper alignment with the original session.
 */
function getZoomForDziLevel(dziLevel: number): number {
  if (!viewer) return 1;
  
  // Get the tile source from the first item in the world
  const tiledImage = viewer.world.getItemAt(0);
  if (!tiledImage || !tiledImage.source) return 1;
  
  const maxLevel = tiledImage.source.maxLevel;
  
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
 * Update play button appearance
 */
function updatePlayButton(): void {
  const playBtn = document.getElementById('btn-replay-play');
  if (!playBtn) return;
  
  if (state.isPlaying) {
    playBtn.textContent = '⏸';
    playBtn.classList.add('playing');
  } else {
    playBtn.textContent = '▶';
    playBtn.classList.remove('playing');
  }
}

/**
 * Update controls UI (scrubber, counter, etc)
 */
function updateControlsUI(): void {
  if (!state.data) return;
  
  const events = state.data.events;
  
  // Update scrubber
  const scrubber = document.getElementById('replay-scrubber') as HTMLInputElement;
  if (scrubber) {
    scrubber.max = (events.length - 1).toString();
    scrubber.value = state.currentIndex.toString();
  }
  
  // Update event counter
  const counter = document.getElementById('replay-event-counter');
  if (counter) {
    counter.textContent = `${state.currentIndex + 1} / ${events.length}`;
  }
  
  // Update time display
  const timeDisplay = document.getElementById('replay-time-display');
  if (timeDisplay && events.length > 0) {
    const firstTime = new Date(events[0].ts_iso8601).getTime();
    const currentTime = new Date(events[state.currentIndex].ts_iso8601).getTime();
    const lastTime = new Date(events[events.length - 1].ts_iso8601).getTime();
    
    const elapsed = formatDuration(currentTime - firstTime);
    const total = formatDuration(lastTime - firstTime);
    
    timeDisplay.textContent = `${elapsed} / ${total}`;
  }
}

/**
 * Update event info panel
 * @param event - The replay event to display
 * @param eventIndex - Optional index of the event in the events array (avoids indexOf lookup)
 */
function updateEventInfo(event: ReplayEvent, eventIndex?: number): void {
  const typeEl = document.getElementById('replay-event-type');
  const timeEl = document.getElementById('replay-event-time');
  const zoomEl = document.getElementById('replay-event-zoom');
  const posEl = document.getElementById('replay-event-position');
  
  if (typeEl) {
    // Format event type nicely
    const typeLabels: Record<string, string> = {
      'app_start': '🚀 App Start',
      'slide_load': '📷 Slide Load',
      'cell_click': '👆 Cell Click',
      'zoom_step': '🔍 Zoom Step',
      'arrow_pan': '⬅️ Arrow Pan',
      'back_step': '↩️ Back Step',
      'reset': '🔄 Reset',
      'label_select': '🏷️ Label Select',
      'slide_next': '✅ Slide Next'
    };
    typeEl.textContent = typeLabels[event.event] || event.event;
  }
  
  if (timeEl) {
    const time = new Date(event.ts_iso8601).toLocaleTimeString();
    timeEl.textContent = `Time: ${time}`;
  }
  
  if (zoomEl) {
    // Show "Fit to screen" for events where the entire slide is visible
    // These events occur when the viewport is showing the whole slide:
    // - app_start: Initial app load
    // - slide_load: A new slide is loaded
    // - reset: User clicked reset to return to full view
    const fitEvents = ['app_start', 'slide_load', 'reset'];
    
    if (fitEvents.includes(event.event)) {
      zoomEl.textContent = 'Magnification: Fit to screen';
    } else if (event.event === 'cell_click') {
      // cell_click is logged BEFORE zoom, so it shows the PREVIOUS viewport state.
      // Check if this is the first click after a fit event (slide_load/reset/app_start)
      // by looking at what magnification was displayed before this click.
      const isFitClick = isClickAfterFitEvent(eventIndex);
      if (isFitClick) {
        zoomEl.textContent = 'Magnification: Fit to screen';
      } else if (event.zoom_level) {
        zoomEl.textContent = `Magnification: ${event.zoom_level}×`;
      } else {
        zoomEl.textContent = 'Magnification: -';
      }
    } else if (event.zoom_level) {
      zoomEl.textContent = `Magnification: ${event.zoom_level}×`;
    } else {
      zoomEl.textContent = 'Magnification: -';
    }
  }
  
  if (posEl) {
    if (event.click_x0 !== null && event.click_y0 !== null) {
      // For cell_click events, show exact click coordinates
      posEl.textContent = `Click: (${Math.round(event.click_x0)}, ${Math.round(event.click_y0)})`;
    } else if (event.center_x0 !== null && event.center_y0 !== null) {
      // For other events, show viewport center
      posEl.textContent = `Center: (${Math.round(event.center_x0)}, ${Math.round(event.center_y0)})`;
    } else {
      posEl.textContent = 'Position: -';
    }
  }
}

/**
 * Check if a cell_click event occurred immediately after a fit event (app_start, slide_load, reset).
 * This helps determine if the magnification should show "Fit to screen" instead of a zoom level.
 * 
 * cell_click events log the viewport state BEFORE the click action, so if the previous
 * viewport-changing event was a fit event, the click happened while viewing the entire slide.
 * 
 * @param clickIndex - The index of the click event in the events array (passed directly to avoid
 *                     indexOf lookup which relies on object reference equality and could fail
 *                     if event objects are cloned or reconstructed)
 */
function isClickAfterFitEvent(clickIndex: number | undefined): boolean {
  if (!state.data) return false;
  
  const events = state.data.events;
  
  // If index not provided or invalid, assume fit mode (safe fallback)
  if (clickIndex === undefined || clickIndex <= 0) return true;
  
  // Look backwards to find the last viewport-changing event before this click
  // Skip events that don't change viewport: label_select, slide_next, cell_click (itself)
  const nonViewportEvents = ['label_select', 'slide_next', 'cell_click'];
  const fitEvents = ['app_start', 'slide_load', 'reset'];
  
  for (let i = clickIndex - 1; i >= 0; i--) {
    const prevEvent = events[i];
    
    // Skip non-viewport-changing events
    if (nonViewportEvents.includes(prevEvent.event)) {
      continue;
    }
    
    // Found a viewport-changing event
    // If it's a fit event, this click happened at fit-to-screen
    if (fitEvents.includes(prevEvent.event)) {
      return true;
    }
    
    // If it's a zoom/pan event, this click happened at a specific zoom level
    return false;
  }
  
  // No previous viewport event found, assume fit (start of session)
  return true;
}

/**
 * Format duration in mm:ss
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Cleanup on page unload
 */
export function cleanup(): void {
  stopPlayback();
  
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }
  
  window.removeEventListener('resize', resizeCanvas);
}

