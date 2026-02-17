/**
 * main.ts - Minimal viewer to display slide with OpenSeadragon
 */

import OpenSeadragon from 'openseadragon';
import type { SlideManifest, ViewerState, ZoomHistoryEntry, LogEvent, EventType, User } from './types';
import { checkAuth, login, logout, getManifest, startSession } from './api';
import { SlideQueue } from './SlideQueue';
import { SessionManager } from './SessionManager';
import { initDashboard, showDashboard, hideDashboard, setOnReplayLoad } from '../admin/dashboard';
import { initReplay, setOnBack as setReplayOnBack } from '../admin/SessionReplay';

// ===== STATE =====
let manifest: SlideManifest | null = null;
let viewerState: ViewerState | null = null;

// Zoom history for Back/Reset navigation
let zoomHistory: ZoomHistoryEntry[] = [];
let startState: ZoomHistoryEntry | null = null;

// Label selection state
let currentLabel: 'non-neoplastic' | 'low-grade' | 'high-grade' | null = null;

// Fit mode state - explicitly track whether we're viewing the entire slide
let isFitMode = true;

// Auth state
let currentUser: User | null = null;

// Tile serving base URL (empty for local dev, CloudFront URL for production)
const TILES_BASE_URL = import.meta.env.VITE_TILES_BASE_URL || '';

// Event logging
const sessionId = crypto.randomUUID(); // Generate unique session ID
const appVersion = '1.0.0-alpha';

// ===== SLIDE QUEUE =====
const slideQueue = new SlideQueue();

// ===== SESSION MANAGER =====
const sessionManager = new SessionManager();

// Track whether we've logged the app start event for this browser session
let appStartLogged = false;

// ===== LOADING SPINNER =====
function showLoadingSpinner(message: string = 'Loading...') {
  const overlay = document.getElementById('loading-overlay');
  const messageElement = document.getElementById('loading-message');
  if (overlay) {
    overlay.classList.add('visible');
  }
  if (messageElement) {
    messageElement.textContent = message;
  }
}

function hideLoadingSpinner() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
  }
}

// ===== ERROR TOAST =====
let errorToastTimeout: number | null = null;

function showErrorMessage(message: string, duration: number = 5000) {
  const toast = document.getElementById('error-toast');
  const messageElement = document.getElementById('error-toast-message');
  
  if (toast && messageElement) {
    // Clear any existing timeout
    if (errorToastTimeout !== null) {
      clearTimeout(errorToastTimeout);
    }
    
    messageElement.textContent = message;
    toast.classList.add('visible');
    
    // Auto-dismiss after duration
    errorToastTimeout = window.setTimeout(() => {
      hideErrorMessage();
    }, duration);
  }
}

function hideErrorMessage() {
  const toast = document.getElementById('error-toast');
  if (toast) {
    toast.classList.remove('visible');
  }
  if (errorToastTimeout !== null) {
    clearTimeout(errorToastTimeout);
    errorToastTimeout = null;
  }
}

// ===== WELCOME MODAL =====
function showWelcomeModal() {
  const modal = document.getElementById('welcome-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function hideWelcomeModal() {
  const modal = document.getElementById('welcome-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Wire up welcome modal dismiss button
const welcomeModalBtn = document.getElementById('welcome-modal-btn');
welcomeModalBtn?.addEventListener('click', () => {
  hideWelcomeModal();
  // Set localStorage flag so modal doesn't show again for this user
  if (currentUser) {
    localStorage.setItem('welcome_shown_' + currentUser.id, '1');
  }
});

// Wire up info button to re-show modal
const btnInfo = document.getElementById('btn-info');
btnInfo?.addEventListener('click', () => {
  showWelcomeModal();
});

// ===== UI HELPERS =====
function showLogin() {
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  if (loginContainer) loginContainer.classList.remove('hidden');
  if (appContainer) appContainer.classList.remove('visible');
  
  // Reset login form state
  const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
  const usernameInput = document.getElementById('username') as HTMLInputElement;
  const passwordInput = document.getElementById('password') as HTMLInputElement;
  
  if (loginBtn) loginBtn.disabled = false;
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  
  hideLoginError();
  
  // CRITICAL: Reset all app UI state to prevent persistence between users
  resetAppUIState();
}

function resetAppUIState() {
  console.log('[UI] Resetting all app UI state');
  
  // Re-enable confirm button (in case previous user finished study)
  const btnConfirm = document.getElementById('btn-confirm') as HTMLButtonElement;
  if (btnConfirm) {
    btnConfirm.disabled = false;
  }
  
  // Clear all radio button selections
  const allRadios = document.querySelectorAll('input[name="diagnosis"]') as NodeListOf<HTMLInputElement>;
  allRadios.forEach(radio => {
    radio.checked = false;
  });

  // Clear notes textarea for the new slide
  const notesTextarea = document.getElementById('notes-textarea') as HTMLTextAreaElement | null;
  if (notesTextarea) {
    notesTextarea.value = '';
  }
  
  // Reset back button
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  if (btnBack) {
    btnBack.disabled = true;
  }
  
  // Clear viewer content
  const viewerElement = document.getElementById('viewer');
  if (viewerElement) {
    viewerElement.innerHTML = '';
  }
  
  // Reset progress display
  const progressDisplay = document.getElementById('progress-display');
  if (progressDisplay) {
    progressDisplay.textContent = '-';
  }
  
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.width = '0%';
  }
  
  // Hide debug section
  const debugSection = document.getElementById('debug-section');
  if (debugSection) {
    debugSection.style.display = 'none';
  }
}

function showApp() {
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  if (loginContainer) loginContainer.classList.add('hidden');
  if (appContainer) appContainer.classList.add('visible');
}

function showLoginError(message: string) {
  const errorElement = document.getElementById('login-error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add('visible');
  }
}

function hideLoginError() {
  const errorElement = document.getElementById('login-error');
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.classList.remove('visible');
  }
}

function updateUserDisplay() {
  // Show debug section only for admin users
  if (currentUser && currentUser.role === 'admin') {
    const debugSection = document.getElementById('debug-section');
    if (debugSection) {
      debugSection.style.display = 'block';
    }
  }
}

function updateProgressDisplay() {
  const progressDisplay = document.getElementById('progress-display');
  const progressBar = document.getElementById('progress-bar');
  
  if (progressDisplay) {
    const progress = slideQueue.getProgress();
    if (slideQueue.isComplete()) {
      progressDisplay.textContent = `Study Complete (${progress.completed}/${progress.total})`;
    } else {
      progressDisplay.textContent = `Slide ${progress.current + 1}/${progress.total}`;
    }
    
    // Update visual progress bar
    if (progressBar && progress.total > 0) {
      const percentage = (progress.completed / progress.total) * 100;
      progressBar.style.width = `${percentage}%`;
    }
  }
}

function showStudyComplete() {
  const viewerElement = document.getElementById('viewer');
  if (viewerElement) {
    const progress = slideQueue.getProgress();
    viewerElement.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: #000; color: #fff; font-size: 24px; text-align: center; flex-direction: column;">
        <div style="margin-bottom: 20px; font-size: 48px;">🎉</div>
        <div style="font-weight: bold; margin-bottom: 10px;">Study Complete!</div>
        <div style="font-size: 18px; color: #aaa;">You have reviewed all ${progress.total} slides.</div>
      </div>
    `;
  }
}

// ===== REPLAY SETUP HELPER =====
function setupReplayCallbacks(): void {
  // Set up callback for when replay is loaded from dashboard
  setOnReplayLoad(async (data) => {
    console.log('[Replay] Loading session replay...');
    await initReplay(data);
  });
  
  // Set up callback for returning from replay to dashboard
  setReplayOnBack(() => {
    console.log('[Replay] Returned to dashboard');
  });
}

// ===== CHECK WINDOW SIZE ON LOGIN =====
/**
 * Check if window is small and prompt user to maximize.
 * Browsers don't allow JavaScript to programmatically maximize windows,
 * so we show a friendly prompt instead.
 */
function checkWindowSize(): void {
  const screenWidth = window.screen.availWidth;
  const screenHeight = window.screen.availHeight;
  const windowWidth = window.outerWidth;
  const windowHeight = window.outerHeight;
  
  // If window is significantly smaller than screen (not maximized)
  const widthRatio = windowWidth / screenWidth;
  const heightRatio = windowHeight / screenHeight;
  
  console.log(`[UI] Window: ${windowWidth}x${windowHeight}, Screen: ${screenWidth}x${screenHeight}`);
  
  if (widthRatio < 0.9 || heightRatio < 0.9) {
    // Show a brief prompt to maximize
    const prompt = document.createElement('div');
    prompt.id = 'maximize-prompt';
    prompt.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 12px;
      ">
        <span>📐 For the best experience, please maximize your browser window</span>
        <button onclick="this.parentElement.remove()" style="
          background: #667eea;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">OK</button>
      </div>
    `;
    document.body.appendChild(prompt);
    
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      const el = document.getElementById('maximize-prompt');
      if (el) el.remove();
    }, 8000);
  }
}

// ===== AUTH HANDLERS =====
async function handleLogin(username: string, password: string): Promise<boolean> {
  const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
  
  try {
    // Disable button and show loading
    if (loginBtn) loginBtn.disabled = true;
    showLoadingSpinner('Logging in...');
    hideLoginError();
    
    console.log('[Auth] Attempting login for:', username);
    const user = await login(username, password);
    console.log('[Auth] Login response:', user);
    
    if (user) {
      currentUser = user;
      console.log(`[Auth] Login successful: ${user.username} (${user.role})`);
      
      // Check window size and prompt to maximize if needed
      checkWindowSize();
      
      // Role-based routing
      if (user.role === 'admin') {
        // Show admin dashboard
        console.log('[Auth] User is admin, showing dashboard');
        hideDashboard(); // Ensure clean state
        showDashboard();
        setupReplayCallbacks();
        await initDashboard(user.username);
        return true;
      } else {
        // Show pathologist viewer
        console.log('[Auth] User is pathologist, showing viewer');
        updateUserDisplay();
        showApp();

        // Show welcome modal on first login for this user
        if (!localStorage.getItem('welcome_shown_' + user.id)) {
          showWelcomeModal();
        }
        return true;
      }
    } else {
      console.error('[Auth] Login returned null/undefined');
      showLoginError('Invalid username or password');
      return false;
    }
  } catch (error) {
    console.error('[Auth] Login error:', error);
    
    // User-friendly error message
    let errorMessage = 'Invalid username or password';
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
        errorMessage = 'Unable to connect. Please check your internet connection.';
      } else if (error.message.includes('session has expired')) {
        errorMessage = 'Your session has expired. Please log in again.';
      } else if (error.message.toLowerCase().includes('too many') || error.message.toLowerCase().includes('rate limit')) {
        // Rate limiting
        errorMessage = 'Too many login attempts. Please try again later.';
      } else if (!error.message.includes('Authentication required') && 
                 !error.message.includes('Invalid') &&
                 !error.message.includes('username or password')) {
        // Generic server error
        errorMessage = 'Something went wrong. Please try again.';
      }
    }
    
    console.error('[Auth] Error message:', errorMessage);
    showLoginError(errorMessage);
    return false;
  } finally {
    // Always hide loading and re-enable button
    hideLoadingSpinner();
    if (loginBtn) loginBtn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await logout();
    currentUser = null;
    
    // Reset viewer state
    if (viewer) {
      viewer.destroy();
      viewer = null;  // Set to null so it can be recreated on next login
    }
    
    // Clear slide state
    slideQueue.reset();
    sessionManager.flushBufferedEventsSync();
    sessionManager.reset();
    manifest = null;
    viewerState = null;
    zoomHistory = [];
    startState = null;
    currentLabel = null;
    isFitMode = true;
    appStartLogged = false;
    
    showLogin();
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    // Still show login even if API call fails
    currentUser = null;
    if (viewer) {
      viewer.destroy();
      viewer = null;
    }
    slideQueue.reset();
    sessionManager.reset();
    showLogin();
  }
}

async function initAuth() {
  try {
    const user = await checkAuth();
    if (user) {
      currentUser = user;
      console.log(`[Auth] User authenticated: ${user.username} (${user.role})`);
      
      // Role-based routing
      if (user.role === 'admin') {
        // Show admin dashboard
        console.log('[Auth] User is admin, showing dashboard');
        hideDashboard(); // Ensure clean state
        showDashboard();
        setupReplayCallbacks();
        await initDashboard(user.username);
        return true;
      } else {
        // Show pathologist viewer
        console.log('[Auth] User is pathologist, showing viewer');
        updateUserDisplay();
        showApp();

        // Show welcome modal on first login for this user
        if (!localStorage.getItem('welcome_shown_' + user.id)) {
          showWelcomeModal();
        }
        return true;
      }
    } else {
      showLogin();
      return false;
    }
  } catch (error) {
    console.error('[Auth] Check auth error:', error);
    showLogin();
    return false;
  }
}

// ===== LOAD MANIFEST =====
async function loadManifest(slideId: string): Promise<SlideManifest> {
  const manifestData = await getManifest(slideId);
  console.log(`[Viewer] Loaded manifest from API for: ${slideId}`);
  return manifestData;
}

// ===== EVENT LOGGING =====
/**
 * Log an event with full viewport bounds and metadata.
 * All coordinates are in level-0 (full resolution) pixel space.
 */
function logEvent(
  eventType: EventType,
  options: {
    clickX?: number | null;  // Exact click X in level-0 coords (for cell_click)
    clickY?: number | null;  // Exact click Y in level-0 coords (for cell_click)
    label?: string;
    notes?: string | null;
  } = {}
) {
  if (!manifest || !viewerState) {
    console.warn('Cannot log event: manifest or viewerState not loaded');
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
    session_id: sessionManager.getSessionId() || sessionId,
    user_id: currentUser?.id || 'unknown',
    slide_id: manifest.slide_id,
    event: eventType,
    zoom_level: viewerState.currentZoomMag,
    dzi_level: viewerState.currentDziLevel,
    click_x0: options.clickX ?? null,  // Exact click position (only for cell_click)
    click_y0: options.clickY ?? null,
    center_x0: center.x,
    center_y0: center.y,
    vbx0: topLeft.x,
    vby0: bottomRight.y,  // Bottom-left Y (OSD Y increases downward)
    vtx0: bottomRight.x,
    vty0: topLeft.y,      // Top-right Y
    container_w: containerWidth,
    container_h: containerHeight,
    dpr: window.devicePixelRatio,
    app_version: appVersion,
    label: options.label,
    notes: options.notes ?? null,
    viewing_attempt: sessionManager.getViewingAttempt()
  };
  
  // Upload via SessionManager (noop until session established)
  sessionManager.addEvent(event);
  console.log(`[LOG] ${eventType}:`, event);
}

/**
 * Export event log as CSV file and trigger download.
 */
// CSV export removed - events are now uploaded to backend via API

// ===== MAGNIFICATION ↔ DZI LEVEL MAPPING =====

/**
 * Calculate the actual DZI level being rendered by OpenSeadragon.
 * This computes which pyramid level is being used based on current zoom.
 * 
 * Formula: DZI level = maxLevel + log2(imageZoom)
 * where imageZoom is the ratio of displayed pixels to source pixels
 * 
 * @param viewer - OpenSeadragon viewer instance
 * @returns The DZI level being rendered (integer, clamped to valid range)
 */
function getActualDziLevel(viewer: OpenSeadragon.Viewer): number {
  const tiledImage = viewer.world.getItemAt(0);
  if (!tiledImage || !tiledImage.source) {
    console.warn('[DZI] No tiled image loaded');
    return 0;
  }
  
  const maxLevel = tiledImage.source.maxLevel;
  const viewportZoom = viewer.viewport.getZoom(true);
  
  // Convert viewport zoom to image zoom
  // viewportToImageZoom gives us how many source pixels per display pixel
  const imageZoom = tiledImage.viewportToImageZoom(viewportZoom);
  
  // DZI level = maxLevel + log2(imageZoom)
  // When imageZoom = 1 (1:1 pixel), we're at maxLevel
  // When imageZoom = 0.5 (2:1 downsample), we're at maxLevel - 1
  // etc.
  const rawLevel = maxLevel + Math.log2(imageZoom);
  
  // Round to nearest integer and clamp to valid range
  const dziLevel = Math.max(0, Math.min(maxLevel, Math.round(rawLevel)));
  
  return dziLevel;
}

/**
 * Calculate magnification from DZI level using slide metadata.
 * Uses the manifest's magnification_levels to find the closest standard magnification,
 * or computes a non-standard magnification for fit-to-screen.
 * 
 * @param dziLevel - Current DZI level
 * @param manifest - Slide manifest with magnification mappings
 * @returns Magnification value (may be non-standard for fit mode)
 */
function getMagnificationFromDziLevel(dziLevel: number, manifest: SlideManifest): number {
  // Check if this matches a standard magnification level
  const standardMags: Array<{ mag: number, level: number }> = [
    { mag: 40, level: manifest.magnification_levels['40x'] },
    { mag: 20, level: manifest.magnification_levels['20x'] },
    { mag: 10, level: manifest.magnification_levels['10x'] },
    { mag: 5, level: manifest.magnification_levels['5x'] },
    { mag: 2.5, level: manifest.magnification_levels['2.5x'] }
  ];
  
  // Find exact match
  for (const { mag, level } of standardMags) {
    if (dziLevel === level) {
      return mag;
    }
  }
  
  // No exact match - calculate magnification from DZI level
  // Each DZI level is 2× the previous
  // If 40× = maxLevel (e.g., 18), then:
  // - Level 17 = 20×, Level 16 = 10×, Level 15 = 5×, Level 14 = 2.5×
  const maxLevel = manifest.magnification_levels['40x'];
  const levelDiff = maxLevel - dziLevel;
  const mag = 40 / Math.pow(2, levelDiff);
  
  // Round to reasonable precision
  return Math.round(mag * 100) / 100;
}

/**
 * Get OpenSeadragon zoom value for a specific DZI level.
 * This uses the exact DZI level from the manifest to ensure proper alignment
 * with the patch extraction at that magnification.
 */
function getZoomForDziLevel(dziLevel: number, viewer: OpenSeadragon.Viewer): number {
  // OpenSeadragon calculates zoom based on the full-resolution image dimensions
  // and the current viewport size. For a specific DZI level, we need to calculate
  // the zoom that would display that level at 1:1 pixel ratio
  
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

// ===== UPDATE VIEWER STATE =====
function updateViewerState(viewer: OpenSeadragon.Viewer) {
  if (!manifest) return;
  
  // Always calculate the ACTUAL DZI level being rendered
  // This is critical for data integrity - no placeholder values
  const actualDziLevel = getActualDziLevel(viewer);
  const actualMag = getMagnificationFromDziLevel(actualDziLevel, manifest);
  
  viewerState = {
    manifest,
    currentZoomMag: actualMag,
    currentDziLevel: actualDziLevel
  };
  
  // Update debug UI
  updateDebugUI();
}

// ===== UPDATE DEBUG UI =====
function updateDebugUI() {
  // Update current zoom level
  const zoomEl = document.getElementById('current-zoom');
  if (zoomEl && viewerState) {
    zoomEl.textContent = `${viewerState.currentZoomMag}×`;
  }
  
  // Fit calculation removed - no longer needed since we always fit entire slide
  
  // Update DZI level
  const gridDimsEl = document.getElementById('grid-dims');
  if (gridDimsEl && viewerState) {
    gridDimsEl.textContent = `DZI Level ${viewerState.currentDziLevel}`;
  }
  
  // Update magnification display in side panel
  updateMagnificationDisplay();
}

// ===== UPDATE MAGNIFICATION DISPLAY =====
/**
 * Update the magnification display in the side panel.
 * Shows "Fit to screen" when viewing entire slide, or "X×" for magnification levels.
 * Uses explicit isFitMode flag for reliable state tracking.
 */
function updateMagnificationDisplay() {
  const magDisplayEl = document.getElementById('magnification-display');
  if (!magDisplayEl || !manifest) return;
  
  if (isFitMode) {
    // We're in fit mode - entire slide visible
    magDisplayEl.textContent = 'Fit to screen';
  } else {
    // Show current magnification level from viewerState
    if (viewerState) {
      magDisplayEl.textContent = `${viewerState.currentZoomMag}×`;
    }
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
  if (!viewerState) return;
  
  const center = getCurrentCenter();
  zoomHistory.push({
    zoomMag: viewerState.currentZoomMag,
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
  if (startState && 
      previousState.zoomMag === startState.zoomMag && 
      Math.abs(previousState.centerX - startState.centerX) < 100 && 
      Math.abs(previousState.centerY - startState.centerY) < 100) {
    // Go to fit mode: use fitBounds to ensure entire slide is visible
    // Use animated transition for better tile loading
    const imageBounds = viewer.world.getItemAt(0).getBounds();
    viewer.viewport.fitBounds(imageBounds, false);
    
    // Explicitly set fit mode state
    isFitMode = true;
    
    console.log('Restored to fit mode (start state)');
  } else {
    // Restore to specific zoom level using DZI level
    const dziLevel = manifest.magnification_levels[`${previousState.zoomMag}x` as '2.5x' | '5x' | '10x' | '20x' | '40x'];
    const zoomValue = getZoomForDziLevel(dziLevel, viewer);
    viewer.viewport.zoomTo(zoomValue, undefined, true); // immediate
    
    // Restore center
    const centerViewport = viewer.viewport.imageToViewportCoordinates(previousState.centerX, previousState.centerY);
    viewer.viewport.panTo(centerViewport, true); // immediate
    
    // Not in fit mode - we're at a specific magnification
    isFitMode = false;
    
    console.log(`Restored to ${previousState.zoomMag}× (DZI ${dziLevel})`);
  }
  
  // Force viewer state update after going back
  setTimeout(() => {
    updateViewerState(viewer);
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
  
  // CRITICAL: Use fitBounds instead of goHome to ensure entire slide is visible
  // This matches the initialization behavior and prevents viewport bounds issues
  // Use animated transition (false) to give OpenSeadragon time to prioritize tile loading
  const imageBounds = viewer.world.getItemAt(0).getBounds();
  viewer.viewport.fitBounds(imageBounds, false); // Animate for better tile loading
  
  // Explicitly set fit mode state - do this immediately so UI updates correctly
  isFitMode = true;
  
  console.log(`Reset to fit mode: bounds (${imageBounds.width.toFixed(2)} × ${imageBounds.height.toFixed(2)})`);
  
  // Force viewer state update after reset
  setTimeout(() => {
    updateViewerState(viewer);
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

/**
 * Update arrow navigation button state based on zoom level.
 * Disables buttons when entire slide is visible (fit mode), enables when zoomed in.
 * Uses explicit isFitMode flag for reliable state tracking.
 */
function updateArrowButtonState() {
  if (!manifest || !viewer) return;
  
  const btnUp = document.getElementById('btn-up') as HTMLButtonElement;
  const btnDown = document.getElementById('btn-down') as HTMLButtonElement;
  const btnLeft = document.getElementById('btn-left') as HTMLButtonElement;
  const btnRight = document.getElementById('btn-right') as HTMLButtonElement;
  
  // Disable arrows when entire slide is visible (no panning needed)
  // Enable when zoomed in (panning is useful)
  if (btnUp) btnUp.disabled = isFitMode;
  if (btnDown) btnDown.disabled = isFitMode;
  if (btnLeft) btnLeft.disabled = isFitMode;
  if (btnRight) btnRight.disabled = isFitMode;
  
  if (isFitMode) {
    console.log('[UI] Arrow buttons disabled - entire slide visible');
  } else {
    console.log('[UI] Arrow buttons enabled - zoomed in');
  }
}

// ===== ARROW NAVIGATION =====
/**
 * Pan viewport by 0.4× (40%) viewport dimension in the specified direction.
 * This provides good visual continuity - old content stays partially visible.
 */
function panByArrow(direction: 'up' | 'down' | 'left' | 'right') {
  if (!manifest) {
    console.warn('Cannot pan: manifest not loaded');
    return;
  }
  
  // Save current state to history before panning (so Back can undo this)
  pushHistory();
  
  const viewport = viewer.viewport;
  const tiledImage = viewer.world.getItemAt(0);
  
  console.log(`=== ARROW PAN: ${direction.toUpperCase()} ===`);
  
  // Get current viewport bounds in IMAGE PIXEL coordinates
  // This ensures consistent behavior across different aspect ratios
  const viewportRect = tiledImage.viewportToImageRectangle(viewport.getBounds());
  
  const viewportWidthPx = viewportRect.width;
  const viewportHeightPx = viewportRect.height;
  
  console.log(`Viewport size: ${viewportWidthPx.toFixed(0)} × ${viewportHeightPx.toFixed(0)} px`);
  
  // Calculate pan distance: 40% of viewport dimension in pixels
  const panDistanceX = viewportWidthPx * 0.4;
  const panDistanceY = viewportHeightPx * 0.4;
  
  console.log(`Pan distance: ${panDistanceX.toFixed(0)} × ${panDistanceY.toFixed(0)} px (40% of viewport)`);
  
  // Get current center in IMAGE PIXEL coordinates
  const centerViewport = viewport.getCenter();
  const centerImage = tiledImage.viewportToImageCoordinates(centerViewport);
  
  console.log(`Current center: (${centerImage.x.toFixed(0)}, ${centerImage.y.toFixed(0)}) px`);
  
  let newCenterX = centerImage.x;
  let newCenterY = centerImage.y;
  
  // Apply pan based on direction
  switch (direction) {
    case 'up':
      newCenterY -= panDistanceY;
      break;
    case 'down':
      newCenterY += panDistanceY;
      break;
    case 'left':
      newCenterX -= panDistanceX;
      break;
    case 'right':
      newCenterX += panDistanceX;
      break;
  }
  
  console.log(`New center: (${newCenterX.toFixed(0)}, ${newCenterY.toFixed(0)}) px`);
  
  // Convert back to viewport coordinates and pan
  const newCenterViewport = tiledImage.imageToViewportCoordinates(new OpenSeadragon.Point(newCenterX, newCenterY));
  viewport.panTo(newCenterViewport, true);
  
  console.log('=========================');
  
  // Log arrow_pan event
  logEvent('arrow_pan');
}

// ===== SLIDE LOADING =====
async function loadSlide(slideId: string) {
  console.log(`[Viewer] Loading slide: ${slideId}`);
  
  // Initialize viewer if it doesn't exist (e.g., after logout)
  if (!viewer) {
    console.log('[Viewer] Viewer not initialized, creating new viewer');
    initializeViewer();
  }
  
  // CRITICAL: Clear any existing tile sources before loading new slide
  // This prevents old tile requests from interfering with new slide loading
  if (viewer.world.getItemCount() > 0) {
    console.log('[Viewer] Clearing previous slide...');
    viewer.world.removeAll();
    // Small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Reset state
  zoomHistory = [];
  startState = null;
  currentLabel = null;
  isFitMode = true;  // New slide starts in fit mode
  
  // Clear all radio button selections
  const allRadios = document.querySelectorAll('input[name="diagnosis"]') as NodeListOf<HTMLInputElement>;
  allRadios.forEach(radio => {
    radio.checked = false;
  });
  
  // Construct tile source - use CloudFront URL in production, local .dzi in development
  const tileSource = TILES_BASE_URL
    ? {
        Image: {
          xmlns: "http://schemas.microsoft.com/deepzoom/2008",
          Url: `${TILES_BASE_URL}/slides/${slideId}/files/`,
          Format: "jpeg",
          Overlap: String(manifest!.overlap),
          TileSize: String(manifest!.tile_size),
          Size: {
            Width: String(manifest!.level0_width),
            Height: String(manifest!.level0_height)
          }
        }
      }
    : `/tiles/${slideId}.dzi`;
  console.log(`[Viewer] Tile source:`, typeof tileSource === 'string' ? tileSource : `${TILES_BASE_URL}/slides/${slideId}/files/`);
  
  // Load new slide into viewer
  // The main 'open' handler will handle the viewport fitting
  // Register listener before triggering load to avoid missing fast events
  return new Promise<void>((resolve, reject) => {
    const handler = () => {
      console.log(`[Demo] Slide loaded and fitted: ${slideId}`);
      clearTimeout(timeout);
      resolve();
    };

    const errorHandler = (event: any) => {
      console.error(`[Viewer] Failed to open slide:`, event);
      clearTimeout(timeout);
      reject(new Error(`Failed to load slide: ${slideId}`));
    };

    // Add timeout to prevent infinite hanging
    const timeout = setTimeout(() => {
      console.error(`[Viewer] Slide load timeout after 30 seconds: ${slideId}`);
      viewer.removeHandler('open', handler);
      viewer.removeHandler('open-failed', errorHandler);
      reject(new Error(`Slide load timeout: ${slideId}`));
    }, 30000);

    viewer.addOnceHandler('open', handler);
    viewer.addOnceHandler('open-failed', errorHandler);
    
    console.log(`[Viewer] Opening slide: ${slideId}`);
    viewer.open(tileSource);
  });
}

// Initialize OpenSeadragon viewer (will be created dynamically)
let viewer: any = null;

function initializeViewer() {
  if (viewer) {
    console.log('[Viewer] Viewer already exists, skipping initialization');
    return viewer;
  }
  
  console.log('[Viewer] Creating new OpenSeadragon viewer');
  viewer = OpenSeadragon({
  id: "viewer",
  prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/images/",
  // No initial tileSources - will be set via viewer.open() when slide is loaded
  
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
  minZoomLevel: 0.1,        // Allow zooming out far enough to show entire slide
  defaultZoomLevel: 1.0,    // Will be overridden based on fit calculation
  visibilityRatio: 1.0,     // Keep entire image in view during pan
  constrainDuringPan: true,
  
  // CRITICAL: Ensure goHome() fits entire image instead of filling/cropping
  homeFillsViewer: false,   // false = fit entire image, true = fill viewport (can crop)
  
  // Set viewport margins to 0 to prevent extra panning space at fit level
  viewportMargins: {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0
  },
  
  // === TILE LOADING OPTIMIZATION ===
  // CRITICAL: Disable immediateRender to prevent blurry tiles from showing
  // This forces OSD to wait for correct resolution tiles before displaying
  immediateRender: false,   // Wait for correct resolution (no blurry tiles!)
  blendTime: 0,             // No fade/blend - instant tile display
  minPixelRatio: 1.0,       // Require full-resolution tiles
  maxImageCacheCount: 300,  // Moderate cache size to prevent memory bloat
  
  // CRITICAL: Conservative loading for local dev server
  preload: false,           // Disable preload - only load visible tiles (prevents queue overload)
  imageLoaderLimit: 4,      // VERY CONSERVATIVE: Only 4 concurrent requests (dev server limitation)
  timeout: 30000,           // 30 second timeout (dev server can be slow under load)
  
  // CRITICAL: Tile update strategy
  alwaysBlend: false,       // Don't blend tiles (instant display)
  // Use default composition (fastest) - omit property to use default
  // Don't show placeholder (wait for real tiles) - omit property to use default
  
  // Viewport animation - slower to give tiles time to load
  springStiffness: 6.5,     // Default spring (was too fast at 15.0)
  animationTime: 1.0,       // Slower animation = tiles load before viewport settles
  
  // CRITICAL: Only show tiles at correct resolution
  minZoomImageRatio: 1.0,   // Require 100% resolution (was 0.8 allowing blur)
  maxZoomPixelRatio: 1.1,   // Allow slight over-zoom before loading next level
  
  // Performance
  autoResize: true,
  smoothTileEdgesMinZoom: Infinity, // Disable edge smoothing
  preserveImageSizeOnResize: true,
  
  // Memory and caching
  collectionMode: false,
  showSequenceControl: false,
  wrapHorizontal: false,
  wrapVertical: false
});

// Handle slide loaded event - combines initialization, UI updates, and button state management
viewer.addHandler('open', async () => {
  console.log('Slide loaded successfully!');
  console.log('Image dimensions:', viewer.world.getItemAt(0).getContentSize());
  
  // Load manifest and initialize state
  try {
    // Get current slide ID
    const currentSlide = slideQueue.getCurrentSlide();
    const slideId = currentSlide ? currentSlide.slide_id : 'test_slide';
    
    manifest = await loadManifest(slideId);
    
    // Update debug UI
    updateDebugUI();
    
    // CRITICAL: Ensure ENTIRE slide is visible on all screen sizes/aspect ratios
    // Use fitBounds with the full image bounds to guarantee everything is shown
    const imageBounds = viewer.world.getItemAt(0).getBounds();
    viewer.viewport.fitBounds(imageBounds, true);
    
    // Explicitly set fit mode state
    isFitMode = true;
    
    console.log(`Initial view: Fitted entire slide bounds (${imageBounds.width.toFixed(2)} × ${imageBounds.height.toFixed(2)})`);
    
    // Initialize viewer state (will detect we're at fit level)
    updateViewerState(viewer);
    
    // Save start state for Reset functionality
    // Start state is "fit entire slide" (null magnification)
    const startCenter = getCurrentCenter();
    startState = {
      zoomMag: 2.5,  // Use 2.5 as placeholder for fit state (first click will go to 2.5×)
      centerX: startCenter.x,
      centerY: startCenter.y
    };
    console.log(`Saved start state: fit entire slide, center at (${startState.centerX.toFixed(0)}, ${startState.centerY.toFixed(0)})`);
    
    // Create new session for this slide
    if (currentSlide && currentUser) {
      try {
        // Use slide_id (string identifier) not id (database UUID)
        const session = await startSession(currentSlide.slide_id);
        sessionManager.setSession(session.session_id, session.viewing_attempt);
        console.log(`[Session] Session: ${session.session_id} for slide: ${currentSlide.slide_id}, viewing attempt: ${session.viewing_attempt}`);
      } catch (error) {
        console.error('[Session] Failed to create session:', error);
        // Continue anyway - events will be logged locally
      }
    }
    
    // Log app_start once per application load, then log slide load event
    if (!appStartLogged) {
      logEvent('app_start');
      appStartLogged = true;
    }
    logEvent('slide_load');
    
    // Update arrow button state based on zoom level (disabled in fit mode, enabled when zoomed)
    updateArrowButtonState();
    
  } catch (error) {
    console.error('Failed to load manifest:', error);
    alert('Failed to load slide manifest. Check console for details.');
  }
});

// Update viewer state when zoom changes
viewer.addHandler('zoom', () => {
  if (manifest) {
    updateViewerState(viewer);
    // Update arrow button state when zoom changes (enable/disable based on fit mode)
    updateArrowButtonState();
  }
});

// Log any errors
viewer.addHandler('open-failed', (event: any) => {
  console.error('Failed to load slide:', event);
  alert('Failed to load slide. Check console for details.');
});

// Log app_start event when page loads
window.addEventListener('DOMContentLoaded', () => {
  console.log(`=== APP START ===`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`User ID: ${currentUser?.id || 'not authenticated yet'}`);
  console.log(`App Version: ${appVersion}`);
  console.log('=================');
});

// ===== WIRE UP NAVIGATION BUTTONS =====
// Enable arrow buttons after slide loads
// Wire up arrow buttons (once, not every time a slide opens)
const btnUp = document.getElementById('btn-up') as HTMLButtonElement;
const btnDown = document.getElementById('btn-down') as HTMLButtonElement;
const btnLeft = document.getElementById('btn-left') as HTMLButtonElement;
const btnRight = document.getElementById('btn-right') as HTMLButtonElement;

// Add click handlers
btnUp?.addEventListener('click', () => panByArrow('up'));
btnDown?.addEventListener('click', () => panByArrow('down'));
btnLeft?.addEventListener('click', () => panByArrow('left'));
btnRight?.addEventListener('click', () => panByArrow('right'));

// Note: Arrow button state is now managed by updateArrowButtonState()
// which is called on slide load and zoom changes

// Wire up Back and Reset buttons
const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;

btnBack?.addEventListener('click', goBack);
btnReset?.addEventListener('click', resetView);

// ===== WIRE UP LABEL SELECTION =====
// Track label selection
const labelRadios = document.querySelectorAll('input[name="diagnosis"]') as NodeListOf<HTMLInputElement>;
labelRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      currentLabel = radio.value as 'non-neoplastic' | 'low-grade' | 'high-grade';
      console.log(`Label selected: ${currentLabel}`);
      
      // Log label_select event
      logEvent('label_select', { label: currentLabel });
    }
  });
});

// Handle Confirm & Next button (prevent multiple attachments with flag)
const btnConfirm = document.getElementById('btn-confirm') as HTMLButtonElement;
let confirmHandlerAttached = false;

if (btnConfirm && !confirmHandlerAttached) {
  btnConfirm.addEventListener('click', async () => {
    // Prevent double-clicking
    if (btnConfirm.disabled) {
      console.log('[Confirm] Already processing, ignoring click');
      return;
    }
    
    // Read the selected diagnosis directly from the DOM (more reliable than tracking in variable)
    const checkedRadio = document.querySelector('input[name="diagnosis"]:checked') as HTMLInputElement | null;
    
    console.log('[Confirm] Checking diagnosis selection...');
    console.log('[Confirm] Checked radio:', checkedRadio);
    console.log('[Confirm] Value:', checkedRadio?.value);
    
    if (!checkedRadio || !checkedRadio.value) {
      console.log('[Confirm] No diagnosis selected, showing alert');
      showErrorMessage('Please select a diagnosis before confirming.', 3000);
      return;
    }
    
    const selectedLabel = checkedRadio.value as 'non-neoplastic' | 'low-grade' | 'high-grade';
    const notesTextarea = document.getElementById('notes-textarea') as HTMLTextAreaElement | null;
    const notesValue = notesTextarea?.value?.trim();
    const notePayload = notesValue && notesValue.length > 0 ? notesValue : null;
    
    console.log('=== CONFIRM & NEXT ===');
    console.log(`Confirmed label: ${selectedLabel}`);
    console.log('======================');
    
    // Disable button and show loading
    btnConfirm.disabled = true;
    showLoadingSpinner('Saving and loading next slide...');
    
    try {
      // Update currentLabel for logging
      currentLabel = selectedLabel;
      
      // Log slide_next event
      logEvent('slide_next', { label: selectedLabel, notes: notePayload });
      
      // Complete current session with label
      try {
        await sessionManager.completeSession(selectedLabel);
        console.log('[Session] Session completed successfully');
        if (notesTextarea) {
          notesTextarea.value = '';
        }
      } catch (error) {
        console.error('[Session] Failed to complete session:', error);
        showErrorMessage('Failed to save progress. Your data may not be saved.', 5000);
        // Continue anyway - we still want to advance to next slide
      }
      
      // Move to next slide
      const nextSlide = await slideQueue.nextSlide();
      updateProgressDisplay();
      
      // Reset label selection
      currentLabel = null;
      
      if (nextSlide) {
        // Load the new slide
        console.log(`[Queue] Loading next slide: ${nextSlide.slide_id}`);
        
        try {
          await loadSlide(nextSlide.slide_id);
          console.log(`[Queue] Slide loaded successfully: ${nextSlide.slide_id}`);
          
          // Re-enable button after slide loads
          btnConfirm.disabled = false;
        } catch (loadError) {
          console.error('[Queue] Failed to load slide:', loadError);
          throw loadError; // Re-throw to be caught by outer catch
        }
      } else {
        // All slides completed
        console.log('[Queue] All slides completed!');
        showStudyComplete();
        // Keep button disabled since study is complete
      }
    } catch (error) {
      console.error('[Confirm] Failed to load next slide:', error);
      
      // Show specific error message
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorMessage(`Unable to load next slide: ${errorMsg}`, 7000);
      
      btnConfirm.disabled = false;
    } finally {
      hideLoadingSpinner();
    }
  });
  
  confirmHandlerAttached = true;
}

// ===== DISABLE MOUSE WHEEL ZOOM =====
// Block mouse wheel from doing anything on the viewer
const viewerElement = document.getElementById('viewer');
if (viewerElement) {
  viewerElement.addEventListener('wheel', (event: WheelEvent) => {
    event.preventDefault(); // Block default scroll/zoom behavior
  }, { passive: false });
  
  // ===== BLOCK RIGHT-CLICK CONTEXT MENU =====
  viewerElement.addEventListener('contextmenu', (event: MouseEvent) => {
    event.preventDefault(); // Prevent default context menu
  });
}

// ===== LEFT-CLICK: ZOOM IN =====
/**
 * Handle left-click on viewer: recenter on click position and step zoom IN.
 * Ladder: fit → 2.5× → 5× → 10× → 20× → 40×
 * At max zoom (40×), clicking does nothing.
 */
viewer.addHandler('canvas-click', (event: any) => {
  if (!manifest || !viewerState) return;
  
  // Check if we're in "fit" mode
  const magInfo = getCurrentMagnificationAndLevel(viewer, manifest);
  const currentMag = magInfo ? magInfo.mag : null;
  
  // At max zoom (40×), clicking does NOTHING
  if (currentMag === 40) {
    console.log('Already at max zoom (40×) - left-click disabled');
    return;
  }
  
  // Get click position in viewport coordinates
  const viewportPoint = viewer.viewport.pointFromPixel(event.position);
  
  // Convert to level-0 image coordinates
  const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);
  
  // Simple bounds check - can't click outside the slide
  if (imagePoint.x < 0 || imagePoint.x >= manifest.level0_width ||
      imagePoint.y < 0 || imagePoint.y >= manifest.level0_height) {
    console.log('Click outside slide bounds - ignoring');
    return;
  }
  
  // Get the EXACT click position
  const clickX = imagePoint.x;
  const clickY = imagePoint.y;
  
  console.log('=== LEFT-CLICK: ZOOM IN ===');
  console.log(`Click at ${currentMag || 'fit'}× (DZI level ${viewerState.currentDziLevel})`);
  console.log(`Click position (level-0): (${clickX.toFixed(0)}, ${clickY.toFixed(0)})`);
  
  // Save current state to history before navigating
  pushHistory();
  
  // Log cell_click event with exact click coordinates (before navigation)
  logEvent('cell_click', { clickX: clickX, clickY: clickY });
  
  // Recenter viewport to EXACT click position
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
    
    // No longer in fit mode - we've zoomed in
    isFitMode = false;
    
    console.log(`Zoomed: ${currentMag || 'fit'}× → ${nextZoom}× (DZI ${nextDziLevel})`);
    
    // Log zoom_step event
    setTimeout(() => logEvent('zoom_step'), 10);
  }
  
  // Update magnification display
  setTimeout(() => updateMagnificationDisplay(), 50);
  
  console.log('===========================');
});

// ===== RIGHT-CLICK: ZOOM OUT =====
/**
 * Handle right-click on viewer: zoom OUT one level, keeping current center.
 * Does NOT recenter on click position - stays on current view center.
 * At fit level, right-click does nothing.
 */
viewer.addHandler('canvas-nonprimary-press', (event: any) => {
  // Only handle right-click (button 2)
  if (event.button !== 2) return;
  if (!manifest || !viewerState) return;
  
  // Check if we're in "fit" mode
  const magInfo = getCurrentMagnificationAndLevel(viewer, manifest);
  const currentMag = magInfo ? magInfo.mag : null;
  
  // At fit level, right-click does nothing
  if (currentMag === null) {
    console.log('Already at fit level - right-click disabled');
    return;
  }
  
  // Get previous zoom level
  const prevZoom = getPreviousZoomLevel(currentMag);
  
  console.log('=== RIGHT-CLICK: ZOOM OUT ===');
  console.log(`Current: ${currentMag}× → Target: ${prevZoom || 'fit'}×`);
  
  // Keep current center (don't recenter on click position)
  const currentCenter = getCurrentCenter();
  console.log(`Keeping center: (${currentCenter.x.toFixed(0)}, ${currentCenter.y.toFixed(0)})`);
  
  // Save current state to history before navigating (so Back can undo this)
  pushHistory();
  
  // Log zoom_step event (zooming out is still a zoom step)
  logEvent('zoom_step');
  
  if (prevZoom === null) {
    // Zoom to fit: use fitBounds to ensure entire slide is visible
    const imageBounds = viewer.world.getItemAt(0).getBounds();
    viewer.viewport.fitBounds(imageBounds, false);
    
    // Now in fit mode
    isFitMode = true;
    
    console.log('Zoomed out to fit');
  } else {
    // Zoom to previous magnification level
    const prevDziLevel = manifest.magnification_levels[`${prevZoom}x` as '2.5x' | '5x' | '10x' | '20x' | '40x'];
    const zoomValue = getZoomForDziLevel(prevDziLevel, viewer);
    viewer.viewport.zoomTo(zoomValue, undefined, true);
    
    // Keep the same center
    const centerViewport = viewer.viewport.imageToViewportCoordinates(currentCenter.x, currentCenter.y);
    viewer.viewport.panTo(centerViewport, true);
    
    // Not in fit mode - at specific magnification
    isFitMode = false;
    
    console.log(`Zoomed out: ${currentMag}× → ${prevZoom}× (DZI ${prevDziLevel})`);
  }
  
  // Update magnification display
  setTimeout(() => updateMagnificationDisplay(), 50);
  
  console.log('=============================');
});

// ===== CURSOR STYLE =====
// Update cursor style based on whether clicking is allowed
if (viewerElement) {
  viewerElement.addEventListener('mousemove', (event: MouseEvent) => {
    if (!manifest || !viewerState) return;
    
    // At max zoom (40×), show default cursor (clicking disabled)
    if (viewerState.currentZoomMag === 40) {
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
    
    // Point is within slide bounds - show pointer cursor
    viewerElement.style.cursor = 'pointer';
  });
}

// ===== BUFFER FLUSH SAFEGUARDS =====
window.addEventListener('beforeunload', () => {
  sessionManager.flushBufferedEventsSync();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    sessionManager.flushBufferedEventsSync();
  }
});
  
  return viewer;
}

// ===== LOGIN/LOGOUT EVENT LISTENERS =====
const loginFormElement = document.getElementById('login-form-element') as HTMLFormElement;
loginFormElement?.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const usernameInput = document.getElementById('username') as HTMLInputElement;
  const passwordInput = document.getElementById('password') as HTMLInputElement;
  const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
  
  if (!usernameInput || !passwordInput) return;
  
  // Disable form during login
  loginBtn.disabled = true;
  
  const success = await handleLogin(usernameInput.value, passwordInput.value);
  
  if (success && currentUser) {
    // Clear form
    usernameInput.value = '';
    passwordInput.value = '';
    
    // Role-based post-login setup
    if (currentUser.role === 'admin') {
      // Admin dashboard already initialized in handleLogin
      console.log('[Auth] Admin login complete, dashboard displayed');
    } else {
      // Pathologist - load slides and start viewer
      await slideQueue.loadSlides(currentUser.id);
      updateProgressDisplay();
      
      const firstSlide = slideQueue.getCurrentSlide();
      if (firstSlide) {
        console.log(`[Auth] Starting with first slide: ${firstSlide.slide_id}`);
        await loadSlide(firstSlide.slide_id);
      } else {
        // All slides completed
        console.log('[Auth] All slides completed!');
        showStudyComplete();
      }
    }
  } else {
    // Re-enable form on failure
    loginBtn.disabled = false;
  }
});

const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
logoutBtn?.addEventListener('click', handleLogout);

// ===== ERROR TOAST CLOSE BUTTON =====
const errorToastClose = document.getElementById('error-toast-close') as HTMLButtonElement;
errorToastClose?.addEventListener('click', hideErrorMessage);

// ===== INITIALIZATION =====
// Check authentication on page load
(async function init() {
  console.log('[App] Initializing...');
  
  // Check if user is already authenticated
  await initAuth();
  
  if (currentUser) {
    // Role-based initialization
    const user: User = currentUser; // Store in local variable for type narrowing
    if (user.role === 'admin') {
      // Admin dashboard already initialized in initAuth
      console.log('[Auth] Admin authenticated, dashboard loaded');
    } else {
      // Pathologist viewer - load slides and start viewer
      console.log('[Auth] Pathologist authenticated, loading viewer...');
      await slideQueue.loadSlides(user.id);
      updateProgressDisplay();
      
      const firstSlide = slideQueue.getCurrentSlide();
      if (firstSlide) {
        console.log(`[Auth] Starting with first slide: ${firstSlide.slide_id}`);
        await loadSlide(firstSlide.slide_id);
      } else {
        // All slides completed
        console.log('[Auth] All slides completed!');
        showStudyComplete();
      }
    }
  } else {
    // Show login form (already handled by initAuth)
    console.log('[Auth] Not authenticated, showing login...');
  }
})();
