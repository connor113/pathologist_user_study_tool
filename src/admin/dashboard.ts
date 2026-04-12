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
  createAdminUser,
  deleteAdminUser,
  logout,
  getCompletedSessions,
  getSessionEvents,
  getMisclassifications
} from '../viewer/api';
import type { UserStats, ProgressStats, CompletedSession, SessionReplayData, MisclassificationData } from '../viewer/types';

// Store loaded sessions for the currently selected user
let cachedSessions: CompletedSession[] = [];

// Callback for when admin wants to view slides
let onViewSlidesCallback: (() => void) | null = null;

/**
 * Set the callback for when admin clicks "View Slides"
 */
export function setOnViewSlides(callback: () => void): void {
  onViewSlidesCallback = callback;
}

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
    const [users, progress, misclassifications] = await Promise.all([
      getAdminUsers(),
      getAdminProgress(),
      getMisclassifications({ user_id: misclassUserId || undefined, page: misclassPage, per_page: 25 })
    ]);

    // Render UI
    renderStats(progress);
    renderUserTable(users);
    renderMisclassifications(misclassifications);

    // Populate dropdowns
    populateFilterDropdowns(users);
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
        <td colspan="5" class="empty-state">
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
    
    // Actions column with Reset Password button
    const actionsCell = document.createElement('td');
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.className = 'admin-btn admin-btn-sm';
    resetBtn.title = 'Reset password for this user';
    resetBtn.style.cssText = `
      padding: 4px 10px;
      font-size: 12px;
      background: #ffc107;
      color: #333;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      transition: background 0.2s;
    `;
    resetBtn.onmouseover = () => {
      resetBtn.style.background = '#e0a800';
    };
    resetBtn.onmouseout = () => {
      resetBtn.style.background = '#ffc107';
    };
    resetBtn.addEventListener('click', async () => {
      await handleResetPassword(user.id, user.username, resetBtn);
    });
    actionsCell.appendChild(resetBtn);
    
    // Also add a span for showing the temp password (initially hidden)
    const passwordResultSpan = document.createElement('span');
    passwordResultSpan.id = `reset-result-${user.id}`;
    passwordResultSpan.style.cssText = `
      margin-left: 8px;
      font-size: 12px;
      display: none;
    `;
    actionsCell.appendChild(passwordResultSpan);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'admin-btn admin-btn-sm';
    deleteBtn.title = 'Delete this user and all their data';
    deleteBtn.style.cssText = `
      padding: 4px 10px;
      font-size: 12px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      margin-left: 6px;
      transition: background 0.2s;
    `;
    deleteBtn.onmouseover = () => { deleteBtn.style.background = '#b02a37'; };
    deleteBtn.onmouseout = () => { deleteBtn.style.background = '#dc3545'; };
    deleteBtn.addEventListener('click', async () => {
      await handleDeleteUser(user.id, user.username);
    });
    actionsCell.appendChild(deleteBtn);

    row.appendChild(actionsCell);

    tbody.appendChild(row);
  });

  console.log(`[Dashboard] Rendered ${users.length} user rows`);
}

// Misclassification pagination state
let misclassPage = 1;
let misclassUserId = '';

async function fetchAndRenderMisclassifications(): Promise<void> {
  try {
    const data = await getMisclassifications({
      user_id: misclassUserId || undefined,
      page: misclassPage,
      per_page: 25
    });
    renderMisclassifications(data);
  } catch (error) {
    console.error('[Dashboard] Failed to fetch misclassifications:', error);
  }
}

/**
 * Render misclassifications grouped by pathologist with collapsible sections
 */
function renderMisclassifications(data: MisclassificationData): void {
  console.log('[Dashboard] Rendering misclassifications');

  const container = document.getElementById('misclassifications-grouped-body');
  const countSpan = document.getElementById('misclass-count');
  const totalSpan = document.getElementById('total-completed-count');

  if (!container || !countSpan || !totalSpan) return;

  countSpan.textContent = data.total_misclassifications.toString();
  totalSpan.textContent = data.total_completed.toString();

  container.innerHTML = '';

  if (data.misclassifications.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#7f8c8d;">No misclassifications found</div>';
    updateMisclassPagination(data);
    return;
  }

  // Group by pathologist
  const grouped = new Map<string, typeof data.misclassifications>();
  data.misclassifications.forEach(m => {
    if (!grouped.has(m.username)) grouped.set(m.username, []);
    grouped.get(m.username)!.push(m);
  });

  grouped.forEach((items, username) => {
    // Collapsible header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;margin-bottom:4px;cursor:pointer;user-select:none;';
    const arrow = document.createElement('span');
    arrow.textContent = '\u25B6';
    arrow.style.cssText = 'font-size:11px;transition:transform 0.2s;';
    header.appendChild(arrow);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = username;
    nameSpan.style.fontWeight = 'bold';
    header.appendChild(nameSpan);

    const countBadge = document.createElement('span');
    countBadge.textContent = `${items.length} disagreement${items.length !== 1 ? 's' : ''}`;
    countBadge.style.cssText = 'font-size:12px;background:#dc3545;color:white;padding:2px 8px;border-radius:10px;';
    header.appendChild(countBadge);

    container.appendChild(header);

    // Detail table (hidden by default)
    const details = document.createElement('div');
    details.style.cssText = 'display:none;margin:0 0 8px 0;';

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';
    table.innerHTML = `<thead><tr style="background:#eee;"><th style="padding:6px 10px;text-align:left;">Slide</th><th style="padding:6px 10px;text-align:left;">Their Label</th><th style="padding:6px 10px;text-align:left;">Correct</th><th style="padding:6px 10px;text-align:left;">Time</th></tr></thead>`;
    const tbody = document.createElement('tbody');

    items.forEach(m => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #eee';
      row.innerHTML = `
        <td style="padding:6px 10px;">${m.slide_id}</td>
        <td style="padding:6px 10px;color:#dc3545;">${formatLabel(m.pathologist_label)}</td>
        <td style="padding:6px 10px;color:#28a745;">${formatLabel(m.ground_truth)}</td>
        <td style="padding:6px 10px;">${Math.round(m.duration_seconds / 60)} min</td>
      `;
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    details.appendChild(table);
    container.appendChild(details);

    // Toggle
    header.addEventListener('click', () => {
      const isOpen = details.style.display !== 'none';
      details.style.display = isOpen ? 'none' : 'block';
      arrow.style.transform = isOpen ? '' : 'rotate(90deg)';
    });
  });

  updateMisclassPagination(data);
  console.log(`[Dashboard] Rendered ${data.misclassifications.length} misclassifications in ${grouped.size} groups`);
}

function updateMisclassPagination(data: MisclassificationData): void {
  const prevBtn = document.getElementById('misclass-prev-btn') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('misclass-next-btn') as HTMLButtonElement | null;
  const pageInfo = document.getElementById('misclass-page-info');

  if (prevBtn) prevBtn.disabled = data.page <= 1;
  if (nextBtn) nextBtn.disabled = data.page >= data.total_pages;
  if (pageInfo) pageInfo.textContent = `Page ${data.page} of ${data.total_pages}`;
}

/**
 * Format label for display (capitalize first letter)
 */
function formatLabel(label: string): string {
  if (!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Handle resetting a user's password
 */
async function handleResetPassword(userId: string, username: string, btn: HTMLButtonElement): Promise<void> {
  const resultSpan = document.getElementById(`reset-result-${userId}`) as HTMLSpanElement;
  
  if (!confirm(`Reset password for ${username}? They will need to change it on next login.`)) {
    return;
  }
  
  try {
    btn.disabled = true;
    btn.textContent = '...';
    if (resultSpan) {
      resultSpan.style.display = 'none';
      resultSpan.textContent = '';
    }
    
    const { API_BASE_URL } = await import('../viewer/api');
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to reset password');
    }
    
    console.log(`[Dashboard] Password reset for ${username}`);
    
    // Show the new temp password inline
    if (resultSpan) {
      resultSpan.innerHTML = `✅ New password: <code style="background:#f0f0f0;padding:2px 6px;border-radius:3px;user-select:all">${data.data.temporaryPassword}</code>`;
      resultSpan.style.color = '#333';
      resultSpan.style.display = 'inline';
    }
    
  } catch (error: any) {
    console.error('[Dashboard] Reset password failed:', error);
    if (resultSpan) {
      resultSpan.textContent = `❌ ${error.message || 'Failed'}`;
      resultSpan.style.color = '#c00';
      resultSpan.style.display = 'inline';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reset';
  }
}

async function handleDeleteUser(userId: string, username: string): Promise<void> {
  if (!confirm(`DELETE user "${username}" and ALL their data?\nThis cannot be undone.`)) return;
  if (!confirm(`Are you SURE? This will permanently delete all of ${username}'s sessions and events.`)) return;

  try {
    await deleteAdminUser(userId);
    alert(`User "${username}" has been deleted.`);
    await refreshDashboard();
  } catch (error: any) {
    alert(`Failed to delete user: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Populate the misclassification and CSV filter dropdowns with pathologist names
 */
function populateFilterDropdowns(users: UserStats[]): void {
  const misclassSelect = document.getElementById('misclass-user-filter') as HTMLSelectElement | null;
  const csvSelect = document.getElementById('csv-user-filter') as HTMLSelectElement | null;

  [misclassSelect, csvSelect].forEach(select => {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">All pathologists</option>';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.username;
      select.appendChild(opt);
    });
    select.value = currentValue;
  });
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
  
  // View Slides button (admin views slides like a pathologist)
  const viewSlidesBtn = document.getElementById('btn-view-slides');
  if (viewSlidesBtn) {
    viewSlidesBtn.addEventListener('click', () => {
      if (onViewSlidesCallback) onViewSlidesCallback();
    });
  }

  // Misclassification filter dropdown
  const misclassFilter = document.getElementById('misclass-user-filter') as HTMLSelectElement | null;
  if (misclassFilter) {
    misclassFilter.addEventListener('change', () => {
      misclassUserId = misclassFilter.value;
      misclassPage = 1;
      fetchAndRenderMisclassifications();
    });
  }

  // Misclassification pagination buttons
  const misclassPrev = document.getElementById('misclass-prev-btn');
  if (misclassPrev) {
    misclassPrev.addEventListener('click', () => {
      if (misclassPage > 1) {
        misclassPage--;
        fetchAndRenderMisclassifications();
      }
    });
  }
  const misclassNext = document.getElementById('misclass-next-btn');
  if (misclassNext) {
    misclassNext.addEventListener('click', () => {
      misclassPage++;
      fetchAndRenderMisclassifications();
    });
  }

  // Admin Change Password button
  const adminChangePasswordBtn = document.getElementById('admin-change-password-btn');
  if (adminChangePasswordBtn) {
    adminChangePasswordBtn.addEventListener('click', async () => {
      const { ChangePassword } = await import('../viewer/ChangePassword');
      const changePasswordModal = new ChangePassword(() => {
        console.log('[Dashboard] Admin password changed successfully');
      });
      changePasswordModal.show();
    });
  }

  // Create User button
  const createUserBtn = document.getElementById('btn-create-user');
  if (createUserBtn) {
    createUserBtn.addEventListener('click', async () => {
      await handleCreateUser();
    });
  }

  // Allow Enter key in username input
  const newUsernameInput = document.getElementById('new-username-input');
  if (newUsernameInput) {
    newUsernameInput.addEventListener('keydown', async (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        await handleCreateUser();
      }
    });
  }
  
  eventListenersSetup = true;
}

// ============================================================================
// Create User Functions
// ============================================================================

/**
 * Handle creating a new pathologist user
 */
async function handleCreateUser(): Promise<void> {
  const usernameInput = document.getElementById('new-username-input') as HTMLInputElement;
  const resultSpan = document.getElementById('create-user-result') as HTMLSpanElement;
  const createBtn = document.getElementById('btn-create-user') as HTMLButtonElement;
  
  const username = usernameInput?.value.trim();
  if (!username) {
    if (resultSpan) {
      resultSpan.textContent = '⚠️ Please enter a username';
      resultSpan.style.color = '#c00';
    }
    return;
  }
  
  try {
    if (createBtn) { createBtn.disabled = true; createBtn.textContent = 'Creating...'; }
    
    const { user, temporaryPassword } = await createAdminUser(username);
    
    if (resultSpan) {
      resultSpan.innerHTML = `✅ Created <strong>${user.username}</strong> — temp password: <code style="background:#f0f0f0;padding:2px 6px;border-radius:3px;user-select:all">${temporaryPassword}</code>`;
      resultSpan.style.color = '#333';
    }
    
    if (usernameInput) usernameInput.value = '';
    
    // Refresh the user table
    await refreshDashboard();
    
  } catch (error: any) {
    console.error('[Dashboard] Create user failed:', error);
    if (resultSpan) {
      resultSpan.textContent = `❌ ${error.message || 'Failed to create user'}`;
      resultSpan.style.color = '#c00';
    }
  } finally {
    if (createBtn) { createBtn.disabled = false; createBtn.textContent = '+ Create Pathologist'; }
  }
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
    
    sessionInfo.textContent = '';
    const details = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = 'Session Details:';
    details.appendChild(strong);
    details.appendChild(document.createElement('br'));
    details.appendChild(document.createTextNode(`Pathologist: ${session.username}`));
    details.appendChild(document.createElement('br'));
    details.appendChild(document.createTextNode(`Slide: ${session.slide_name}`));
    details.appendChild(document.createElement('br'));
    details.appendChild(document.createTextNode(`Label: ${session.label}`));
    details.appendChild(document.createElement('br'));
    details.appendChild(document.createTextNode(`Started: ${startDate}`));
    details.appendChild(document.createElement('br'));
    details.appendChild(document.createTextNode(`Completed: ${endDate}`));
    details.appendChild(document.createElement('br'));
    details.appendChild(document.createTextNode(`Duration: ~${duration} min | Events: ${session.event_count}`));
    sessionInfo.appendChild(details);
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
    
    // Trigger CSV download (optionally filtered by user)
    const csvUserFilter = document.getElementById('csv-user-filter') as HTMLSelectElement | null;
    const selectedUserId = csvUserFilter?.value || undefined;
    await exportAdminCSV(selectedUserId);
    
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

