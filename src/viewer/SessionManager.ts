/**
 * SessionManager.ts - Manages user sessions and event logging for V2
 * 
 * Features:
 * - Buffers events in memory
 * - Automatically uploads when buffer reaches 10 events
 * - Manual upload of remaining events
 * - Session completion with label
 * - Error handling with single retry
 */

import type { LogEvent } from './types';
import { uploadEvents, completeSession, API_BASE_URL } from './api';

export class SessionManager {
  private sessionId: string | null = null;
  private eventBuffer: LogEvent[] = [];
  private readonly BATCH_SIZE = 10;
  private isUploading = false;
  private autoFlushIntervalId: number | null = null;

  constructor(private readonly apiBaseUrl: string = API_BASE_URL) {}

  /**
   * Initialize session manager with a session ID
   * Should be called when starting a new slide review
   * 
   * @param sessionId - Session UUID from backend
   */
  setSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.eventBuffer = [];
    console.log(`[SessionManager] Session set: ${sessionId}`);
    this.startAutoFlush();
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Add event to buffer
   * Automatically triggers upload when buffer reaches BATCH_SIZE
   * 
   * @param event - Log event to add
   */
  addEvent(event: LogEvent): void {
    if (!this.sessionId) {
      console.warn('[SessionManager] No active session, event not added');
      return;
    }

    this.eventBuffer.push(event);
    console.log(`[SessionManager] Event added: ${event.event} (buffer: ${this.eventBuffer.length}/${this.BATCH_SIZE})`);

    // Auto-upload when buffer reaches batch size
    if (this.eventBuffer.length >= this.BATCH_SIZE) {
      this.uploadBufferedEvents();
    }
  }

  /**
   * Get number of events currently in buffer
   */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }

  /**
   * Upload all buffered events to backend
   * Called automatically at BATCH_SIZE or manually before session completion
   * Includes retry logic for failed uploads
   * 
   * @returns Promise that resolves when upload completes
   */
  async uploadBufferedEvents(): Promise<void> {
    if (!this.sessionId) {
      console.warn('[SessionManager] No active session, cannot upload events');
      return;
    }

    if (this.eventBuffer.length === 0) {
      console.log('[SessionManager] No events to upload');
      return;
    }

    if (this.isUploading) {
      console.log('[SessionManager] Upload already in progress, skipping');
      return;
    }

    this.isUploading = true;
    const eventsToUpload = [...this.eventBuffer]; // Copy array
    const eventCount = eventsToUpload.length;

    try {
      console.log(`[SessionManager] Uploading ${eventCount} events...`);
      
      const result = await uploadEvents(this.sessionId, eventsToUpload);
      
      // Clear buffer only if upload succeeded
      this.eventBuffer = this.eventBuffer.slice(eventCount);
      
      console.log(`[SessionManager] Successfully uploaded ${result.inserted} events (remaining in buffer: ${this.eventBuffer.length})`);
      
    } catch (error) {
      console.error('[SessionManager] Upload failed:', error);
      
      // Retry once after a short delay
      console.log('[SessionManager] Retrying upload in 2 seconds...');
      
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const result = await uploadEvents(this.sessionId!, eventsToUpload);
        
        // Clear buffer if retry succeeded
        this.eventBuffer = this.eventBuffer.slice(eventCount);
        console.log(`[SessionManager] Retry successful: uploaded ${result.inserted} events`);
        
      } catch (retryError) {
        console.error('[SessionManager] Retry failed:', retryError);
        console.error('[SessionManager] Events will remain in buffer for next upload attempt');
        // Don't clear buffer - events remain for next attempt
      }
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * Complete the current session with a diagnosis label
   * Uploads any remaining buffered events first, then marks session complete
   * 
   * @param label - Diagnosis label ('normal' | 'benign' | 'malignant')
   * @returns Promise that resolves when session is completed
   */
  async completeSession(label: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active session to complete');
    }

    console.log(`[SessionManager] Completing session with label: ${label}`);

    // Upload any remaining events first
    if (this.eventBuffer.length > 0) {
      console.log(`[SessionManager] Uploading ${this.eventBuffer.length} remaining events before completion`);
      await this.uploadBufferedEvents();
    }

    // Mark session as complete in backend
    try {
      await completeSession(this.sessionId, label);
      console.log(`[SessionManager] Session completed successfully`);
      
      // Clear session state
      this.sessionId = null;
      this.eventBuffer = [];
      this.stopAutoFlush();
      
    } catch (error) {
      console.error('[SessionManager] Failed to complete session:', error);
      throw error; // Re-throw so caller can handle
    }
  }

  /**
   * Reset session manager state
   * Used when logging out or starting a fresh session
   */
  reset(): void {
    console.log('[SessionManager] Resetting session manager');
    this.sessionId = null;
    this.eventBuffer = [];
    this.isUploading = false;
    this.stopAutoFlush();
  }

  /**
   * Flush any buffered events immediately using sendBeacon (best-effort).
   * Should be used during page unload/visibility changes to minimize data loss.
   */
  flushBufferedEventsSync(): void {
    if (!this.sessionId || this.eventBuffer.length === 0) {
      return;
    }

    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      console.warn('[SessionManager] navigator.sendBeacon not available, skipping sync flush');
      return;
    }

    try {
      const endpoint = `${this.apiBaseUrl}/api/slides/sessions/${this.sessionId}/events`;
      const payload = JSON.stringify({ events: this.eventBuffer });
      const blob = new Blob([payload], { type: 'application/json' });
      const success = navigator.sendBeacon(endpoint, blob);
      if (success) {
        console.log('[SessionManager] Buffered events sent via sendBeacon');
        this.eventBuffer = [];
      } else {
        console.warn('[SessionManager] sendBeacon returned false; events remain buffered');
      }
    } catch (error) {
      console.error('[SessionManager] Failed to send buffered events via sendBeacon:', error);
    }
  }

  private startAutoFlush(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.stopAutoFlush();
    this.autoFlushIntervalId = window.setInterval(() => {
      if (this.eventBuffer.length > 0 && !this.isUploading) {
        this.uploadBufferedEvents();
      }
    }, 5000);
  }

  private stopAutoFlush(): void {
    if (this.autoFlushIntervalId !== null) {
      clearInterval(this.autoFlushIntervalId);
      this.autoFlushIntervalId = null;
    }
  }
}

