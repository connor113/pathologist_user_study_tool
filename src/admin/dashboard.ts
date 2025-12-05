/**
 * dashboard.ts - Admin Dashboard Logic
 * 
 * Manages admin dashboard functionality:
 * - Fetching and displaying user statistics
 * - Rendering progress metrics
 * - Populating user table
 * - Handling CSV export
 * - Dashboard refresh
 */

import { 
  getAdminUsers, 
  getAdminProgress, 
  exportAdminCSV,
  logout,
  getCompletedSessions,
  getSessionEvents
} from '../viewer/api';
import type { UserStats, ProgressStats, CompletedSession, SessionReplayData } from '../viewer/types';

// Store loaded sessions for the currently selected user
let cachedSessions: CompletedSession[] = [];

// Callback to trigger when replay is loaded (set by main.ts)
let onReplayLoadCallback: ((data: SessionReplayData) => void) | null = null;

// Track if event listeners have been set up to prevent duplicates
let eventListenersSetup = false;

/**
 * Set the callback for when replay data is loaded
 */
export function setOnReplayLoad(callback: (data: SessionReplayData) => void): void {
  onReplayLoadCallback = callback;
}

/**
 * Initialize admin dashboard
 * Fetches data and renders UI
 */
export async function initDashboard(username: string): Promise<void> {
  console.log('[Dashboard] Initializing admin dashboard');
  
  // Set admin username in header
  const usernameEl = document.getElementById('admin-username');
  if (usernameEl) {
    usernameEl.textContent = `Admin: ${username}`;
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Load initial data
  await refreshDashboard();
}

/**
 * Refresh dashboard data
 * Fetches fresh data from backend and updates UI
 */
export async function refreshDashboard(): Promise<void> {
  console.log('[Dashboard] Refreshing dashboard data');
  
  try {
    // Show loading state
    showLoading();
    
    // Fetch data in parallel
    const [users, progress] = await Promise.all([
      getAdminUsers(),
      getAdminProgress()
    ]);
    
    // Render UI
    renderStats(progress);
    renderUserTable(users);
    
    // Populate replay user dropdown
    await populateUserDropdown(users);
    
    console.log('[Dashboard] Data refreshed successfully');
    
  } catch (error) {
    console.error('[Dashboard] Failed to refresh data:', error);
    showError('Failed to load dashboard data. Please try again.');
  }
}

/**
 * Show loading state in table
 */
function showLoading(): void {
  const tbody = document.getElementById('admin-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = `
    <tr>
      <td colspan="4" class="loading">
        Loading dashboard data...
      </td>
    </tr>
  `;
}

/**
 * Show error message in table
 */
function showError(message: string): void {
  const tbody = document.getElementById('admin-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = `
    <tr>
      <td colspan="4" class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">${message}</div>
      </td>
    </tr>
  `;
}

/**
 * Render overall statistics cards
 */
function renderStats(progress: ProgressStats): void {
  console.log('[Dashboard] Rendering stats cards');
  
  // Update stat cards
  const pathologistsEl = document.getElementById('stat-pathologists');
  const slidesEl = document.getElementById('stat-slides');
  const sessionsEl = document.getElementById('stat-sessions');
  const progressEl = document.getElementById('stat-progress');
  
  if (pathologistsEl) {
    pathologistsEl.textContent = progress.total_pathologists.toString();
  }
  
  if (slidesEl) {
    slidesEl.textContent = progress.total_slides.toString();
  }
  
  if (sessionsEl) {
    sessionsEl.textContent = `${progress.completed_sessions}/${progress.total_sessions}`;
  }
  
  if (progressEl) {
    const percentage = progress.total_sessions > 0
      ? Math.round((progress.completed_sessions / progress.total_sessions) * 100)
      : 0;
    progressEl.textContent = `${percentage}%`;
  }
}

/**
 * Render user table with progress bars
 */
function renderUserTable(users: UserStats[]): void {
  console.log('[Dashboard] Rendering user table');
  
  const tbody = document.getElementById('admin-table-body');
  if (!tbody) return;
  
  // Clear existing rows
  tbody.innerHTML = '';
  
  // Handle empty state
  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-text">No pathologist users found</div>
        </td>
      </tr>
    `;
    return;
  }
  
  // Create row for each user
  users.forEach(user => {
    const row = document.createElement('tr');
    
    // Calculate progress percentage
    const progressPercent = user.total_sessions > 0
      ? Math.round((user.completed_sessions / user.total_sessions) * 100)
      : 0;
    
    // Username column
    const usernameCell = document.createElement('td');
    usernameCell.textContent = user.username;
    row.appendChild(usernameCell);
    
    // Total sessions column
    const totalCell = document.createElement('td');
    totalCell.textContent = user.total_sessions.toString();
    row.appendChild(totalCell);
    
    // Completed sessions column
    const completedCell = document.createElement('td');
    completedCell.textContent = user.completed_sessions.toString();
    row.appendChild(completedCell);
    
    // Progress column with bar
    const progressCell = document.createElement('td');
    progressCell.innerHTML = `
      <div class="progress-cell">
        <div class="progress-bar-mini">
          <div class="progress-fill-mini" style="width: ${progressPercent}%"></div>
        </div>
        <span class="progress-text">${progressPercent}%</span>
      </div>
    `;
    row.appendChild(progressCell);
    
    tbody.appendChild(row);
  });
  
  console.log(`[Dashboard] Rendered ${users.length} user rows`);
}

/**
 * Setup event listeners for dashboard buttons
 * Only sets up listeners once to prevent duplicates
 */
function setupEventListeners(): void {
  // Prevent duplicate event listeners
  if (eventListenersSetup) {
    console.log('[Dashboard] Event listeners already set up, skipping');
    return;
  }
  
  console.log('[Dashboard] Setting up event listeners');
  
  // Refresh button
  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      console.log('[Dashboard] Refresh button clicked');
      await refreshDashboard();
    });
  }
  
  // CSV export button
  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      console.log('[Dashboard] Export CSV button clicked');
      await handleCSVExport();
    });
  }
  
  // Logout button
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      console.log('[Dashboard] Logout button clicked');
      await handleLogout();
    });
  }
  
  // Session Replay - User dropdown
  const userSelect = document.getElementById('replay-user-select') as HTMLSelectElement;
  if (userSelect) {
    userSelect.addEventListener('change', async () => {
      console.log('[Dashboard] User selected:', userSelect.value);
      await handleUserSelect(userSelect.value);
    });
  }
  
  // Session Replay - Session dropdown
  const sessionSelect = document.getElementById('replay-session-select') as HTMLSelectElement;
  if (sessionSelect) {
    sessionSelect.addEventListener('change', () => {
      console.log('[Dashboard] Session selected:', sessionSelect.value);
      handleSessionSelect(sessionSelect.value);
    });
  }
  
  // Session Replay - Load Replay button
  const loadReplayBtn = document.getElementById('btn-load-replay');
  if (loadReplayBtn) {
    loadReplayBtn.addEventListener('click', async () => {
      console.log('[Dashboard] Load Replay button clicked');
      await handleLoadReplay();
    });
  }
  
  eventListenersSetup = true;
}

// ============================================================================
// Session Replay Functions
// ============================================================================

/**
 * Populate the pathologist dropdown with users who have completed sessions
 */
async function populateUserDropdown(users: UserStats[]): Promise<void> {
  const userSelect = document.getElementById('replay-user-select') as HTMLSelectElement;
  if (!userSelect) return;
  
  // Clear existing options except the first placeholder
  userSelect.innerHTML = '<option value="">Select a pathologist...</option>';
  
  // Add users who have completed at least one session
  const usersWithSessions = users.filter(u => u.completed_sessions > 0);
  
  usersWithSessions.forEach(user => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = `${user.username} (${user.completed_sessions} completed)`;
    userSelect.appendChild(option);
  });
  
  console.log(`[Dashboard] Populated user dropdown with ${usersWithSessions.length} users`);
}

/**
 * Handle pathologist selection - load their completed sessions
 */
async function handleUserSelect(userId: string): Promise<void> {
  const sessionSelect = document.getElementById('replay-session-select') as HTMLSelectElement;
  const loadBtn = document.getElementById('btn-load-replay') as HTMLButtonElement;
  const sessionInfo = document.getElementById('replay-session-info');
  
  // Reset session dropdown and button
  if (sessionSelect) {
    sessionSelect.innerHTML = '<option value="">Select a session...</option>';
    sessionSelect.disabled = true;
  }
  if (loadBtn) {
    loadBtn.disabled = true;
  }
  if (sessionInfo) {
    sessionInfo.style.display = 'none';
  }
  
  // Clear cached sessions
  cachedSessions = [];
  
  if (!userId) return;
  
  try {
    // Fetch completed sessions for this user
    console.log('[Dashboard] Fetching sessions for user:', userId);
    cachedSessions = await getCompletedSessions(userId);
    
    if (cachedSessions.length === 0) {
      console.log('[Dashboard] No completed sessions found');
      return;
    }
    
    // Populate session dropdown
    if (sessionSelect) {
      cachedSessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.id;
        
        // Format: "slide_name - label (X events)"
        const label = session.label.charAt(0).toUpperCase() + session.label.slice(1);
        option.textContent = `${session.slide_name} - ${label} (${session.event_count} events)`;
        sessionSelect.appendChild(option);
      });
      
      sessionSelect.disabled = false;
    }
    
    console.log(`[Dashboard] Loaded ${cachedSessions.length} sessions for user`);
    
  } catch (error) {
    console.error('[Dashboard] Failed to fetch sessions:', error);
    alert('Failed to load sessions. Please try again.');
  }
}

/**
 * Handle session selection - show session info and enable Load button
 */
function handleSessionSelect(sessionId: string): void {
  const loadBtn = document.getElementById('btn-load-replay') as HTMLButtonElement;
  const sessionInfo = document.getElementById('replay-session-info');
  
  if (!sessionId) {
    if (loadBtn) loadBtn.disabled = true;
    if (sessionInfo) sessionInfo.style.display = 'none';
    return;
  }
  
  // Find the selected session
  const session = cachedSessions.find(s => s.id === sessionId);
  if (!session) return;
  
  // Enable Load button
  if (loadBtn) {
    loadBtn.disabled = false;
  }
  
  // Show session info
  if (sessionInfo) {
    const startDate = new Date(session.started_at).toLocaleString();
    const endDate = new Date(session.completed_at).toLocaleString();
    const duration = Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60);
    
    sessionInfo.innerHTML = `
      <strong>Session Details:</strong><br>
      Pathologist: ${session.username}<br>
      Slide: ${session.slide_name}<br>
      Label: ${session.label}<br>
      Started: ${startDate}<br>
      Completed: ${endDate}<br>
      Duration: ~${duration} min | Events: ${session.event_count}
    `;
    sessionInfo.style.display = 'block';
  }
}

/**
 * Handle Load Replay button click - fetch full session data and show replay page
 */
async function handleLoadReplay(): Promise<void> {
  const sessionSelect = document.getElementById('replay-session-select') as HTMLSelectElement;
  const loadBtn = document.getElementById('btn-load-replay') as HTMLButtonElement;
  
  const sessionId = sessionSelect?.value;
  if (!sessionId) {
    alert('Please select a session first.');
    return;
  }
  
  try {
    // Disable button during load
    if (loadBtn) {
      loadBtn.textContent = '⏳ Loading...';
      loadBtn.disabled = true;
    }
    
    console.log('[Dashboard] Loading replay for session:', sessionId);
    
    // Fetch full session data with all events
    const replayData = await getSessionEvents(sessionId);
    
    console.log(`[Dashboard] Loaded replay: ${replayData.events.length} events`);
    
    // Trigger callback to show replay page
    if (onReplayLoadCallback) {
      onReplayLoadCallback(replayData);
    } else {
      console.error('[Dashboard] No replay callback set');
      alert('Replay system not initialized. Please refresh the page.');
    }
    
  } catch (error) {
    console.error('[Dashboard] Failed to load replay:', error);
    alert('Failed to load session replay. Please try again.');
    
  } finally {
    // Re-enable button
    if (loadBtn) {
      loadBtn.textContent = '▶ Load Replay';
      loadBtn.disabled = false;
    }
  }
}

/**
 * Handle CSV export
 * Calls API to trigger download
 */
async function handleCSVExport(): Promise<void> {
  const exportBtn = document.getElementById('btn-export-csv');
  
  try {
    console.log('[Dashboard] Starting CSV export');
    
    // Disable button during export
    if (exportBtn) {
      exportBtn.textContent = '⏳ Exporting...';
      (exportBtn as HTMLButtonElement).disabled = true;
    }
    
    // Trigger CSV download
    await exportAdminCSV();
    
    console.log('[Dashboard] CSV export completed');
    
    // Show success feedback
    if (exportBtn) {
      exportBtn.textContent = '✓ Export Complete';
      setTimeout(() => {
        exportBtn.textContent = '⬇ Download CSV Export';
      }, 2000);
    }
    
  } catch (error) {
    console.error('[Dashboard] CSV export failed:', error);
    
    // Show error feedback
    alert('Failed to export CSV. Please try again.');
    
    if (exportBtn) {
      exportBtn.textContent = '⬇ Download CSV Export';
    }
    
  } finally {
    // Re-enable button
    if (exportBtn) {
      (exportBtn as HTMLButtonElement).disabled = false;
    }
  }
}

/**
 * Handle logout
 * Calls logout API and returns to login page
 */
async function handleLogout(): Promise<void> {
  try {
    console.log('[Dashboard] Logging out');
    
    // Call logout API
    await logout();
    
    // Hide dashboard
    const dashboard = document.getElementById('admin-dashboard');
    if (dashboard) {
      dashboard.style.display = 'none';
    }
    
    // Show login page
    const loginContainer = document.getElementById('login-container');
    if (loginContainer) {
      loginContainer.classList.remove('hidden');
    }
    
    // Clear form and re-enable login button
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
    
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (loginBtn) loginBtn.disabled = false;
    
    console.log('[Dashboard] Logout successful, returned to login page');
    
  } catch (error) {
    console.error('[Dashboard] Logout failed:', error);
    alert('Logout failed. Please try again.');
  }
}

/**
 * Show admin dashboard (called from main.ts)
 */
export function showDashboard(): void {
  const dashboard = document.getElementById('admin-dashboard');
  if (dashboard) {
    dashboard.style.display = 'block';
  }
  
  // Ensure other containers are hidden
  const appContainer = document.getElementById('app-container');
  if (appContainer) {
    appContainer.classList.remove('visible');
  }
  
  const loginContainer = document.getElementById('login-container');
  if (loginContainer) {
    loginContainer.classList.add('hidden');
  }
}

/**
 * Hide admin dashboard (called from main.ts)
 */
export function hideDashboard(): void {
  const dashboard = document.getElementById('admin-dashboard');
  if (dashboard) {
    dashboard.style.display = 'none';
  }
}

