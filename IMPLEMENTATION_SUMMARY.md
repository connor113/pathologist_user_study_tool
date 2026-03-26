# Implementation Summary: First-Login Auth Flow & Randomised Slide Ordering

## Overview
This document summarizes the implementation of two key features for the pathologist user study tool:
1. First-login authentication flow with mandatory password/email setup
2. Randomised slide ordering per pathologist (deterministic and reproducible)

## 1. First-Login Authentication Flow

### Database Changes
**Migration: `backend/src/db/migrations/007_first_login_flow.sql`**
- Added `email VARCHAR(255)` column to `users` table (nullable for existing users)
- Added `must_change_password BOOLEAN DEFAULT false` column to `users` table

### Backend Changes

#### `backend/src/routes/auth.ts`
**Modified POST /api/auth/login:**
- Updated query to fetch `must_change_password` flag from database
- Included `must_change_password` in JWT token payload
- Included `must_change_password` in login response

**Added POST /api/auth/setup:**
- Requires authentication (valid JWT from initial login)
- Accepts `{ email, newPassword }` in request body
- Validates email format using basic regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Validates password with the following requirements:
  - Minimum 6 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 number
- Updates user's `password_hash`, `email`, and sets `must_change_password = false`
- Returns new JWT token with updated user data (so session continues seamlessly)

#### `backend/src/routes/admin.ts`
**Modified POST /api/admin/users:**
- Admin now only provides `username` (no password needed)
- Backend auto-generates a random temporary password (8 characters, alphanumeric)
- Sets `must_change_password = true` for new users
- Returns the generated temporary password in the response so admin can share it with the pathologist

### Frontend Changes

#### `src/viewer/FirstLoginSetup.ts` (NEW)
Created a standalone component that displays a setup form with:
- Email input field
- New password field
- Confirm password field
- Password requirements display
- Client-side validation matching backend rules
- Calls POST /api/auth/setup on submission
- Triggers success callback when setup completes

#### `src/viewer/main.ts`
**Modified `handleLogin` function:**
- After successful login, checks if `user.must_change_password === true`
- If true:
  - Shows `FirstLoginSetup` component instead of proceeding to app
  - Waits for setup completion
  - Reloads user data after setup
  - Proceeds to normal app flow once `must_change_password` is false
- If false:
  - Proceeds directly to app (admin dashboard or pathologist viewer)

#### `src/viewer/types.ts`
- Added `must_change_password?: boolean` to `User` interface

## 2. Randomised Slide Ordering Per Pathologist

### Backend Changes

#### `backend/src/routes/slides.ts`
**Modified GET /api/slides:**
- Removed `ORDER BY s.uploaded_at ASC` from SQL query
- Implemented deterministic seeded randomisation in JavaScript:
  1. Fetch all slides without ordering
  2. For each slide, compute a sort key using `simpleHash(slide.id + userId)`
  3. Sort slides by the computed sort key
  4. Return sorted slides
  
**Hash function (`simpleHash`):**
```typescript
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
```

This ensures:
- Each pathologist sees a different order (because hash includes `userId`)
- The order is reproducible (same pathologist always sees same order)
- No database schema changes required
- Works with existing test data

## Testing Checklist

### First-Login Flow
- [ ] Admin creates new pathologist account (should receive temp password)
- [ ] Pathologist logs in with temp password
- [ ] Setup form appears instead of main app
- [ ] Setup form validates email format
- [ ] Setup form validates password requirements
- [ ] Setup form rejects password mismatch
- [ ] After successful setup, user proceeds to main app
- [ ] Subsequent logins skip setup form

### Randomised Slide Ordering
- [ ] Create two pathologist accounts
- [ ] Each pathologist sees slides in different order
- [ ] Same pathologist always sees same order across sessions
- [ ] Completed slides still tracked correctly
- [ ] Progress display still accurate

### Database Migration
- [ ] Run migration 007 on existing database
- [ ] Existing users have `must_change_password = false`
- [ ] Existing users have `email = NULL`
- [ ] New pathologists created after migration have `must_change_password = true`

## Important Constraints Followed
✅ Did NOT modify `backend/src/db/schema.sql` (original schema preserved)
✅ Did NOT delete or modify existing test data
✅ Backend still builds: `cd backend && npm run build` succeeds
✅ Frontend is vanilla TypeScript with Vite (not React)
✅ All changes committed with clear message

## Admin Workflow (Creating New Pathologists)
1. Admin logs into dashboard
2. Admin creates new pathologist with username only
3. System generates and displays temporary password (e.g., "aB3dK7mN")
4. Admin shares username + temp password with pathologist (email/chat/etc.)
5. Pathologist logs in with temp credentials
6. Pathologist completes setup form (sets email + new password)
7. Pathologist proceeds to slide viewer

## Security Notes
- Temporary passwords are random 8-character alphanumeric strings
- Passwords must meet complexity requirements (6+ chars, mixed case, number)
- JWT tokens are updated after password change (no session disruption)
- Email validation is basic regex (sufficient for internal study)
- All password handling uses bcrypt hashing
