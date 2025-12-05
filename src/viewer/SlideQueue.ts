/**
 * SlideQueue.ts - Manages slide queue with per-user deterministic randomization
 * 
 * Features:
 * - Loads slides from backend API
 * - Deterministic shuffle based on user ID (same order every session)
 * - Tracks current position in queue
 * - Automatically skips completed slides
 * - Progress tracking (current/total/completed)
 */

import type { Slide } from './types';
import { getSlides } from './api';

export class SlideQueue {
  private slides: Slide[] = [];
  private currentIndex: number = 0;
  private totalCount: number = 0;
  private completedCount: number = 0;

  /**
   * Load slides from backend and apply deterministic shuffle
   * Slides are randomized based on user ID but order remains consistent across sessions
   * 
   * @param userId - User UUID to seed the randomization
   */
  async loadSlides(userId: string): Promise<void> {
    console.log(`[SlideQueue] Loading slides for user: ${userId}`);
    
    try {
      const response = await getSlides();
      
      this.slides = response.slides;
      this.totalCount = response.total;
      this.completedCount = response.completed;
      
      console.log(`[SlideQueue] Loaded ${this.totalCount} slides, ${this.completedCount} completed`);
      
      // Apply deterministic shuffle based on user ID
      this.shuffleSlides(userId);
      
      // Find first incomplete slide
      this.currentIndex = this.slides.findIndex(slide => !slide.completed);
      
      if (this.currentIndex === -1) {
        // All slides completed
        this.currentIndex = this.slides.length;
        console.log('[SlideQueue] All slides completed!');
      } else {
        console.log(`[SlideQueue] Starting at slide ${this.currentIndex + 1}/${this.totalCount}: ${this.slides[this.currentIndex].slide_id}`);
      }
      
    } catch (error) {
      console.error('[SlideQueue] Failed to load slides:', error);
      throw error;
    }
  }

  /**
   * Get the current slide to display
   * Returns null if all slides are completed
   */
  getCurrentSlide(): Slide | null {
    if (this.currentIndex >= this.slides.length) {
      return null;
    }
    return this.slides[this.currentIndex];
  }

  /**
   * Get progress information
   * Returns current position (0-based), total count, and completed count
   */
  getProgress(): { current: number; total: number; completed: number } {
    return {
      current: this.currentIndex,
      total: this.totalCount,
      completed: this.completedCount
    };
  }

  /**
   * Move to the next incomplete slide
   * Returns the next slide or null if all slides are completed
   */
  async nextSlide(): Promise<Slide | null> {
    console.log('[SlideQueue] Moving to next slide...');
    
    // Mark current slide as completed (increment counter)
    if (this.currentIndex < this.slides.length && this.slides[this.currentIndex]) {
      this.slides[this.currentIndex].completed = true;
      this.completedCount++;
    }
    
    // Find next incomplete slide
    let nextIndex = this.currentIndex + 1;
    while (nextIndex < this.slides.length && this.slides[nextIndex].completed) {
      nextIndex++;
    }
    
    this.currentIndex = nextIndex;
    
    if (this.currentIndex >= this.slides.length) {
      console.log('[SlideQueue] All slides completed!');
      return null;
    }
    
    const nextSlide = this.slides[this.currentIndex];
    console.log(`[SlideQueue] Moving to slide ${this.currentIndex + 1}/${this.totalCount}: ${nextSlide.slide_id}`);
    
    return nextSlide;
  }

  /**
   * Check if all slides have been completed
   */
  isComplete(): boolean {
    return this.currentIndex >= this.slides.length;
  }

  /**
   * Get total number of slides
   */
  getTotalCount(): number {
    return this.totalCount;
  }

  /**
   * Get number of completed slides
   */
  getCompletedCount(): number {
    return this.completedCount;
  }

  /**
   * Deterministic shuffle using user ID as seed
   * Uses simple Linear Congruential Generator (LCG) PRNG
   * Same user ID always produces same shuffle order
   * 
   * @param userId - User UUID to seed the shuffle
   */
  private shuffleSlides(userId: string): void {
    if (this.slides.length <= 1) {
      return; // No need to shuffle
    }
    
    console.log(`[SlideQueue] Applying deterministic shuffle (seed: ${userId.substring(0, 8)}...)`);
    
    // Convert user ID to numeric seed
    const seed = this.hashUserId(userId);
    
    // Simple LCG PRNG: X(n+1) = (a * X(n) + c) mod m
    // Using common LCG parameters
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    
    let random = seed;
    
    // Fisher-Yates shuffle with seeded PRNG
    for (let i = this.slides.length - 1; i > 0; i--) {
      // Generate next random number
      random = (a * random + c) % m;
      
      // Get random index from 0 to i
      const j = Math.floor((random / m) * (i + 1));
      
      // Swap elements
      [this.slides[i], this.slides[j]] = [this.slides[j], this.slides[i]];
    }
    
    console.log(`[SlideQueue] Shuffle complete, first slide: ${this.slides[0].slide_id}`);
  }

  /**
   * Hash user ID string to numeric seed
   * Simple hash function for converting UUID to number
   * 
   * @param userId - User UUID string
   * @returns Numeric seed value
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Reset the slide queue
   * Used when logging out or switching users
   */
  reset(): void {
    console.log('[SlideQueue] Resetting slide queue');
    this.slides = [];
    this.currentIndex = 0;
    this.totalCount = 0;
    this.completedCount = 0;
  }
}

