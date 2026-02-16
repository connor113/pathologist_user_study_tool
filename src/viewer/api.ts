/**
 * api.ts - Backend API client for V2 multi-user functionality
 * 
 * All API calls use credentials: 'include' to send httpOnly cookies for authentication.
 * Base URL is configured via environment variable VITE_API_URL (defaults to localhost:3001).
 */

import type { 
  User, 
  Slide, 
  SlideManifest, 
  LogEvent, 
  APIResponse, 
  APIError,
  UserStats,
  ProgressStats,
  CompletedSession,
  SessionReplayData
} from './types';

// Get API base URL from environment variable, default to local development
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Sleep for specified milliseconds
 * Used for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 * Retries on network errors and 5xx server errors
 * Does not retry on 4xx client errors (bad request, auth, etc.)
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error.message?.includes('Failed to fetch') || 
      error.message?.includes('NetworkError') ||
      error.message?.includes('Network request failed') ||
      error.message?.includes('Unable to connect')) {
    return true;
  }
  
  // 5xx server errors are retryable
  const statusCode = (error as any).statusCode;
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return true;
  }
  
  // 4xx client errors are NOT retryable
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return false;
  }
  
  // Default: don't retry unknown errors
  return false;
}

/**
 * API call with automatic retry and exponential backoff
 * Retries failed requests up to maxRetries times with exponential delays
 * 
 * @param endpoint - API endpoint path
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Parsed JSON response
 * @throws Error after all retries exhausted
 */
async function apiCallWithRetry<T>(
  endpoint: string, 
  options: RequestInit = {}, 
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Try the API call
      return await apiCall<T>(endpoint, options);
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry
      const shouldRetry = attempt < maxRetries && isRetryableError(error);
      
      if (!shouldRetry) {
        // Don't retry - throw the error
        throw error;
      }
      
      // Calculate exponential backoff delay: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      
      console.log(`[API] Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
      console.log(`[API] Error:`, (error as Error).message);
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // All retries exhausted
  console.error(`[API] All retry attempts exhausted for ${endpoint}`);
  throw lastError || new Error('Request failed after retries');
}

/**
 * Get user-friendly error message from error object
 * Maps technical errors to readable messages
 */
function getUserFriendlyError(error: any, statusCode?: number): string {
  // Network errors
  if (error.message?.includes('Failed to fetch') || 
      error.message?.includes('NetworkError') ||
      error.message?.includes('Network request failed')) {
    return 'Unable to connect. Please check your internet connection.';
  }
  
  // Check for specific error messages FIRST (more specific than status codes)
  if (error.message) {
    const msg = error.message.toLowerCase();
    
    // Authentication errors - check credentials first before session expiry
    if (msg.includes('invalid') && (msg.includes('username') || msg.includes('password') || msg.includes('credentials'))) {
      return 'Invalid username or password.';
    }
    
    if (msg.includes('expired') || msg.includes('invalid or expired token')) {
      return 'Your session has expired. Please log in again.';
    }
    
    // "Authentication required" for missing token (session expired)
    if (msg.includes('authentication required')) {
      return 'Your session has expired. Please log in again.';
    }
    
    // Rate limiting
    if (msg.includes('too many') || msg.includes('rate limit')) {
      return 'Too many attempts. Please try again later.';
    }
    
    // Generic validation errors
    if (msg.includes('required') || msg.includes('validation')) {
      return 'Please check your input and try again.';
    }
  }
  
  // Status code specific errors (fallback for messages without specific text)
  if (statusCode) {
    switch (statusCode) {
      case 401:
        // Only use generic session expired if we didn't catch a more specific message above
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please slow down and try again later.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Something went wrong on our end. Please try again.';
    }
  }
  
  // Default error message
  return 'Something went wrong. Please try again.';
}

/**
 * Generic API call helper
 * Handles fetch with credentials, JSON parsing, and error handling
 * 
 * @param endpoint - API endpoint path (e.g., '/api/auth/login')
 * @param options - Fetch options (method, body, etc.)
 * @returns Parsed JSON response
 * @throws Error with user-friendly message on failure
 */
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  let statusCode: number | undefined;
  
  try {
    console.log(`[API] ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Always send cookies for authentication
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    statusCode = response.status;
    console.log(`[API] Response status: ${response.status} ${response.statusText}`);
    
    // Parse response body
    const data = await response.json();
    console.log(`[API] Response data:`, data);
    
    // Check for HTTP errors
    if (!response.ok) {
      // Backend returns { error: string } for errors
      const backendError = (data as APIError).error || 'Request failed';
      console.error(`[API] Error ${response.status}:`, backendError);
      
      // Create error with both backend message and status code
      const error = new Error(backendError);
      (error as any).statusCode = statusCode;
      throw error;
    }
    
    return data;
    
  } catch (error) {
    // Network errors or fetch failures
    if (error instanceof Error) {
      console.error(`[API] Error:`, error.message);
      
      // Add user-friendly message
      const friendlyMessage = getUserFriendlyError(error, statusCode);
      const friendlyError = new Error(friendlyMessage);
      (friendlyError as any).originalError = error;
      (friendlyError as any).statusCode = statusCode;
      throw friendlyError;
    }
    throw new Error('Network request failed');
  }
}

// ============================================================================
// Authentication API
// ============================================================================

/**
 * Check if user is currently authenticated
 * Calls GET /api/auth/me to verify JWT token in cookie
 * 
 * @returns User object if authenticated, null if not
 */
export async function checkAuth(): Promise<User | null> {
  try {
    const response = await apiCall<APIResponse<{ user: User }>>('/api/auth/me', {
      method: 'GET',
    });
    console.log(`[API] Authenticated as: ${response.data.user.username}`);
    return response.data.user;
  } catch (error) {
    // 401 or other auth failure means not authenticated
    console.log('[API] Not authenticated');
    return null;
  }
}

/**
 * Login with username and password
 * Sets httpOnly cookie with JWT token on success
 * 
 * @param username - Username
 * @param password - Password
 * @returns User object
 * @throws Error if credentials are invalid
 */
export async function login(username: string, password: string): Promise<User> {
  const response = await apiCall<APIResponse<{ user: User }>>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  
  console.log(`[API] Login successful: ${response.data.user.username} (${response.data.user.role})`);
  return response.data.user;
}

/**
 * Logout current user
 * Clears httpOnly cookie on server
 */
export async function logout(): Promise<void> {
  await apiCall<APIResponse<{ success: boolean }>>('/api/auth/logout', {
    method: 'POST',
  });
  
  console.log('[API] Logout successful');
}

// ============================================================================
// Slide Management API
// ============================================================================

/**
 * Get list of all slides with completion status for current user
 * Requires authentication
 * 
 * @returns Object with slides array, total count, and completed count
 */
export async function getSlides(): Promise<{ 
  slides: Slide[], 
  total: number, 
  completed: number 
}> {
  const response = await apiCall<APIResponse<{
    slides: Slide[],
    total: number,
    completed: number
  }>>('/api/slides', {
    method: 'GET',
  });
  
  console.log(`[API] Loaded ${response.data.total} slides, ${response.data.completed} completed`);
  return response.data;
}

/**
 * Get slide manifest JSON for a specific slide
 * Requires authentication
 * 
 * @param slideId - Slide identifier (e.g., "test_slide")
 * @returns Slide manifest with alignment parameters
 */
export async function getManifest(slideId: string): Promise<SlideManifest> {
  const response = await apiCall<APIResponse<{ manifest: SlideManifest }>>(
    `/api/slides/${slideId}/manifest`,
    { method: 'GET' }
  );
  
  console.log(`[API] Loaded manifest for slide: ${slideId}`);
  return response.data.manifest;
}

/**
 * Start a new session for a slide (or resume existing)
 * Creates session record in database or returns existing session
 * If resuming and events exist, viewing_attempt will be incremented
 * Requires authentication
 * 
 * @param slideId - Slide identifier
 * @returns Session ID (UUID) and viewing attempt number
 */
export async function startSession(slideId: string): Promise<{ session_id: string, viewing_attempt: number }> {
  const response = await apiCall<APIResponse<{ session_id: string, viewing_attempt: number }>>(
    `/api/slides/${slideId}/start`,
    { method: 'POST' }
  );
  
  console.log(`[API] Session started: ${response.data.session_id}, attempt: ${response.data.viewing_attempt}`);
  return response.data;
}

// ============================================================================
// Event Logging API
// ============================================================================

/**
 * Upload batch of events for a session
 * Uses retry logic with exponential backoff for resilience
 * Requires authentication
 * 
 * @param sessionId - Session UUID
 * @param events - Array of log events to upload
 * @returns Number of events inserted
 */
export async function uploadEvents(
  sessionId: string, 
  events: LogEvent[]
): Promise<{ inserted: number }> {
  // Use retry logic for event uploads (critical data)
  const response = await apiCallWithRetry<APIResponse<{ inserted: number }>>(
    `/api/slides/sessions/${sessionId}/events`,
    {
      method: 'POST',
      body: JSON.stringify({ events }),
    },
    3 // 3 retry attempts
  );
  
  console.log(`[API] Uploaded ${response.data.inserted} events`);
  return response.data;
}

/**
 * Mark session as complete with final label
 * Requires authentication
 * 
 * @param sessionId - Session UUID
 * @param label - Final diagnosis label ('normal' | 'benign' | 'malignant')
 */
export async function completeSession(
  sessionId: string, 
  label: string
): Promise<void> {
  await apiCall<APIResponse<{ session: any }>>(
    `/api/slides/sessions/${sessionId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ label }),
    }
  );
  
  console.log(`[API] Session completed with label: ${label}`);
}

// ============================================================================
// Admin Dashboard API
// ============================================================================

/**
 * Get list of all pathologist users with session statistics
 * Requires admin authentication
 * 
 * @returns Array of user statistics
 */
export async function getAdminUsers(): Promise<UserStats[]> {
  const response = await apiCall<APIResponse<{ users: UserStats[] }>>(
    '/api/admin/users',
    { method: 'GET' }
  );
  
  console.log(`[API] Loaded ${response.data.users.length} pathologist users`);
  return response.data.users;
}

/**
 * Get overall study progress statistics
 * Requires admin authentication
 * 
 * @returns Progress statistics object
 */
export async function getAdminProgress(): Promise<ProgressStats> {
  const response = await apiCall<APIResponse<ProgressStats>>(
    '/api/admin/progress',
    { method: 'GET' }
  );
  
  console.log(`[API] Study progress: ${response.data.completed_sessions}/${response.data.total_sessions} sessions completed`);
  return response.data;
}

/**
 * Create a new pathologist user account
 * Requires admin authentication
 * 
 * @param username - New username
 * @param password - New password
 * @returns Created user object
 */
export async function createAdminUser(
  username: string, 
  password: string
): Promise<User> {
  const response = await apiCall<APIResponse<{ user: User }>>(
    '/api/admin/users',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }
  );
  
  console.log(`[API] Created user: ${response.data.user.username}`);
  return response.data.user;
}

/**
 * Export all events as CSV file
 * Triggers browser download with filename: pathology_events_YYYY-MM-DD.csv
 * Requires admin authentication
 */
export async function exportAdminCSV(): Promise<void> {
  const url = `${API_BASE_URL}/api/admin/export/csv`;
  
  console.log(`[API] Downloading CSV export from ${url}`);
  
  try {
    const response = await fetch(url, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`CSV export failed: ${response.status} ${response.statusText}`);
    }
    
    // Get response as blob
    const blob = await response.blob();
    
    // Create download link
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    
    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    a.download = `pathology_events_${date}.csv`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up object URL
    URL.revokeObjectURL(downloadUrl);
    
    console.log(`[API] CSV download triggered: ${a.download}`);
    
  } catch (error) {
    console.error('[API] CSV export failed:', error);
    throw error;
  }
}

// ============================================================================
// Session Replay API
// ============================================================================

/**
 * Get list of completed sessions for replay
 * Optionally filtered by user_id
 * Requires admin authentication
 * 
 * @param userId - Optional user UUID to filter sessions
 * @returns Array of completed sessions with metadata
 */
export async function getCompletedSessions(userId?: string): Promise<CompletedSession[]> {
  const queryParam = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  
  const response = await apiCall<APIResponse<{ sessions: CompletedSession[] }>>(
    `/api/admin/sessions${queryParam}`,
    { method: 'GET' }
  );
  
  console.log(`[API] Loaded ${response.data.sessions.length} completed sessions`);
  return response.data.sessions;
}

/**
 * Get all events for a specific session (for replay)
 * Requires admin authentication
 * 
 * @param sessionId - Session UUID
 * @returns Session metadata and all events ordered by timestamp
 */
export async function getSessionEvents(sessionId: string): Promise<SessionReplayData> {
  const response = await apiCall<APIResponse<SessionReplayData>>(
    `/api/admin/sessions/${sessionId}/events`,
    { method: 'GET' }
  );
  
  console.log(`[API] Loaded ${response.data.events.length} events for session ${sessionId}`);
  return response.data;
}
