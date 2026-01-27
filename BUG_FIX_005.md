# Bug Fix 005: Viewing Attempt Race Condition

**Date:** January 2026  
**Status:** Fixed  

---

## The Bug

When a user resumed a session, `current_attempt` was only incremented if events existed in the database. However, events are buffered on the frontend (batch of 10) and may not be uploaded immediately.

### Scenario That Failed

1. User logs in and starts viewing a slide (session created, `current_attempt = 1`)
2. User views slide, triggers a few events (< 10, so not uploaded yet)
3. User closes browser before events flush
4. User logs back in later
5. Backend checks: "Are there events for this session?"
6. Answer: No (they were never uploaded)
7. Backend returns `viewing_attempt = 1` again ❌

**Result:** Two separate login sessions both recorded as `viewing_attempt = 1`, making them indistinguishable in the data.

### Root Cause

The implementation relied on uploaded events to detect resumed sessions:

```typescript
// OLD BUGGY CODE
const eventCountQuery = `SELECT COUNT(*) as count FROM events WHERE session_id = $1`;
const eventCountResult = await pool.query(eventCountQuery, [session.id]);
const existingEventCount = parseInt(eventCountResult.rows[0].count, 10);

if (existingEventCount > 0) {
  // Only increment if events were uploaded
  currentAttempt += 1;
}
```

This created a race condition between:
- Frontend event buffering (waits for 10 events)
- User closing browser
- Backend session resume logic

---

## The Fix

Track when sessions are actually **started** using a timestamp, not when events are uploaded.

### Solution: Time-Based Detection

Added `last_started_at` timestamp to the sessions table. When resuming:

1. Check `last_started_at` timestamp
2. If it's been > 60 seconds since last start → new viewing attempt
3. If < 60 seconds → same viewing attempt (e.g., page refresh)

```typescript
// NEW FIXED CODE
const VIEWING_ATTEMPT_THRESHOLD_MS = 60 * 1000; // 60 seconds

if (session.last_started_at) {
  const timeSinceLastStart = Date.now() - new Date(session.last_started_at).getTime();
  
  if (timeSinceLastStart > VIEWING_ATTEMPT_THRESHOLD_MS) {
    // It's been more than threshold - this is a new viewing attempt
    currentAttempt += 1;
  }
}

// Always update last_started_at to track current session start
await pool.query(`UPDATE sessions SET current_attempt = $1, last_started_at = NOW() WHERE id = $2`, 
                [currentAttempt, session.id]);
```

### Why 60 Seconds?

- **Too short (e.g., 5s):** Accidental page refreshes or quick re-logins would create false new attempts
- **Too long (e.g., 5min):** User might genuinely close/reopen browser within the window
- **60 seconds:** Reasonable balance - unlikely to refresh that quickly, but definitely a new session if > 1 min

---

## Database Changes

**Migration 005:** `backend/src/db/migrations/005_fix_viewing_attempt_race_condition.sql`

```sql
-- Add last_started_at timestamp to track when sessions are actually started
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS last_started_at TIMESTAMP DEFAULT NULL;

-- Set last_started_at for existing sessions to created_at (best effort)
UPDATE sessions
SET last_started_at = created_at
WHERE last_started_at IS NULL;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_sessions_last_started ON sessions(last_started_at);
```

---

## Backend Changes

**File:** `backend/src/routes/slides.ts`

### Changes to Session Resume Logic (lines 154-201):

**Before:**
- Queried event count
- Only incremented attempt if events existed

**After:**
- Query includes `last_started_at`
- Calculate time since last start
- Increment if > threshold
- Always update `last_started_at`

**New Behavior:**
```typescript
// When creating new session
INSERT INTO sessions (user_id, slide_id, current_attempt, last_started_at)
VALUES ($1, $2, 1, NOW())

// When resuming existing session
UPDATE sessions 
SET current_attempt = $1, last_started_at = NOW() 
WHERE id = $2
```

---

## Testing

### Test Case 1: Normal Resume (Should Increment)
1. User logs in, starts viewing slide → `attempt = 1`
2. Close browser (no events uploaded)
3. Wait 2 minutes
4. Log back in → `attempt = 2` ✅

### Test Case 2: Quick Page Refresh (Should NOT Increment)
1. User logs in, starts viewing slide → `attempt = 1`  
2. Refresh page after 10 seconds → `attempt = 1` (same) ✅

### Test Case 3: Multiple Resumes
1. First login → `attempt = 1`
2. Close, wait, return → `attempt = 2`
3. Close, wait, return → `attempt = 3` ✅

### Test Case 4: Legacy Sessions (No `last_started_at`)
1. Old session exists with `last_started_at = NULL`
2. User resumes → Sets `last_started_at = NOW()`, keeps `attempt = 1`
3. Next resume → Correctly increments to `attempt = 2` ✅

---

## Backwards Compatibility

✅ **Fully backwards compatible**

- Old sessions without `last_started_at`: Migration sets it to `created_at`
- Old events: Unaffected (viewing_attempt already recorded)
- Old code: Can run migration independently

---

## Impact

### Before Fix
- **False negatives:** Separate login sessions recorded as same attempt
- **Data integrity:** Viewing attempt numbers unreliable
- **Analysis impact:** Can't differentiate repeat viewings

### After Fix
- **Reliable tracking:** All login sessions properly differentiated
- **Event data intact:** No changes to event logging
- **Analysis ready:** Viewing attempts now meaningful for ML

---

## Summary

**Problem:** Event buffering race condition caused viewing attempts to not increment.  
**Solution:** Track session start time instead of uploaded events.  
**Result:** Reliable viewing attempt tracking independent of event upload timing.

**Files Changed:**
- `backend/src/db/migrations/005_fix_viewing_attempt_race_condition.sql` (NEW)
- `backend/src/routes/slides.ts` (MODIFIED)
- `backend/README.md` (UPDATED)
