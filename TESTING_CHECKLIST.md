# T-0008 Production Readiness - Testing Checklist

This document provides a comprehensive testing checklist for all production readiness features implemented in T-0008.

## Prerequisites

Before testing, ensure:

- [ ] Backend is running: `cd backend && npm run dev`
- [ ] Frontend is running: `npm run dev`
- [ ] Database is running and migrations are applied
- [ ] Browser developer tools are open (F12) for console inspection
- [ ] Network tab is visible to monitor API requests

---

## 1. Loading States ✓

### Login Loading State

**Steps:**
1. Open login page
2. Enter valid credentials
3. Click "Login" button
4. Observe loading spinner appears
5. Verify login button is disabled during loading
6. Wait for login to complete

**Expected Results:**
- [ ] Loading spinner appears with message "Logging in..."
- [ ] Login button is disabled (grayed out)
- [ ] Spinner disappears after login completes
- [ ] User is redirected to viewer or dashboard
- [ ] No console errors

### Slide Load Loading State

**Steps:**
1. Login as pathologist
2. Wait for first slide to load
3. Observe loading behavior
4. Complete a slide and observe next slide loading

**Expected Results:**
- [ ] Loading spinner shows during slide manifest fetch
- [ ] Spinner message says "Saving and loading next slide..."
- [ ] Viewer shows slide after loading completes
- [ ] No visual glitches during transition

### Confirm & Next Loading State

**Steps:**
1. View a slide as pathologist
2. Select a diagnosis (Normal/Benign/Malignant)
3. Click "Confirm & Next" button
4. Observe loading behavior

**Expected Results:**
- [ ] Loading spinner appears with message
- [ ] Confirm button is disabled during operation
- [ ] Button re-enables after next slide loads
- [ ] Progress bar updates correctly
- [ ] No console errors

### Admin Dashboard Loading

**Steps:**
1. Logout if logged in
2. Login as admin (admin/admin123)
3. Observe dashboard loading
4. Click "Refresh" button
5. Click "Download CSV Export" button

**Expected Results:**
- [ ] Dashboard loads without spinner (uses table loading state)
- [ ] Refresh button shows brief loading indication
- [ ] Export button shows "⏳ Exporting..." during download
- [ ] Export button shows "✓ Export Complete" briefly after success
- [ ] Export button returns to normal text after 2 seconds

---

## 2. Error Handling ✓

### Login Errors

**Test 1: Invalid Credentials**

**Steps:**
1. Open login page
2. Enter invalid username/password
3. Click "Login"
4. Observe error message

**Expected Results:**
- [ ] Red error message appears below login button
- [ ] Message says "Invalid username or password"
- [ ] No technical jargon or stack traces
- [ ] Login button re-enables
- [ ] Can try again

**Test 2: Network Error**

**Steps:**
1. Stop backend server (`Ctrl+C` in backend terminal)
2. Try to login
3. Observe error message

**Expected Results:**
- [ ] Error message appears
- [ ] Message says "Unable to connect. Please check your internet connection."
- [ ] User-friendly, no technical details
- [ ] Can retry after backend restarts

### In-App Error Toast

**Test 1: No Diagnosis Selected**

**Steps:**
1. Login as pathologist
2. View a slide (don't select diagnosis)
3. Click "Confirm & Next"
4. Observe error toast

**Expected Results:**
- [ ] Error toast appears at top of screen
- [ ] Message says "Please select a diagnosis before confirming."
- [ ] Toast is red with white text
- [ ] Toast auto-dismisses after 3 seconds
- [ ] Close button (×) works to dismiss immediately

**Test 2: Event Upload Failure**

**Steps:**
1. Login as pathologist
2. Open browser DevTools → Network tab
3. Set network throttling to "Offline" (simulate network failure)
4. Click on slide to generate events
5. Wait for auto-flush or click Confirm
6. Observe retry attempts

**Expected Results:**
- [ ] Console shows retry messages: "Request failed (attempt 1/4), retrying in 1000ms..."
- [ ] Three retry attempts with delays: 1s, 2s, 4s
- [ ] After retries exhausted, error toast may appear
- [ ] Events are preserved in memory for next upload attempt

**Test 3: Error Toast Close Button**

**Steps:**
1. Trigger any error (e.g., no diagnosis selected)
2. Click the × button on error toast
3. Observe toast dismissal

**Expected Results:**
- [ ] Toast dismisses immediately
- [ ] No errors in console
- [ ] Can trigger another error and see toast again

---

## 3. Rate Limiting ✓

### Login Rate Limit

**Steps:**
1. Logout if logged in
2. Attempt to login 6 times rapidly with wrong password
3. Observe rate limiting behavior

**Expected Results:**
- [ ] First 5 attempts return "Invalid username or password"
- [ ] 6th attempt returns "Too many login attempts. Please try again later."
- [ ] HTTP status 429 in Network tab
- [ ] Wait 60 seconds
- [ ] Can login again after waiting

**Console Check:**
```bash
# In backend terminal, you should see:
[API] POST /api/auth/login - rate limited
```

### API Rate Limit

**Note:** Harder to test manually. Requires 100+ requests in 1 minute.

**Alternative Test:**
1. Check that rate limiter middleware is imported
2. Check that middleware is applied to routes
3. Verify no errors on normal usage (well below limit)

**Expected Results:**
- [ ] Normal usage works fine (< 100 req/min)
- [ ] No rate limit errors during typical pathologist workflow
- [ ] Backend logs show rate limiter middleware is active

---

## 4. Retry Logic ✓

### Event Upload Retry

**Test 1: Network Interruption**

**Steps:**
1. Login as pathologist
2. View a slide and interact (click, pan)
3. Open DevTools → Network tab
4. Set throttling to "Offline"
5. Wait for auto-flush (5 seconds) or trigger manually
6. Observe console for retry attempts
7. Set throttling back to "Online"
8. Observe eventual success

**Expected Results:**
- [ ] Console shows: "[API] Request failed (attempt 1/4), retrying in 1000ms..."
- [ ] Three retry attempts with exponential backoff
- [ ] Delays increase: 1s, 2s, 4s
- [ ] After network restored, upload succeeds
- [ ] No data loss

**Test 2: Server Error (5xx)**

**Steps:**
1. Temporarily modify backend to return 500 error for events endpoint
2. Generate events in viewer
3. Observe retry behavior
4. Fix backend
5. Verify eventual success

**Expected Results:**
- [ ] Retries on 5xx errors
- [ ] Does NOT retry on 4xx errors (client errors)
- [ ] Exponential backoff applied
- [ ] Success after backend fixed

**Test 3: No Retry on Auth Errors**

**Steps:**
1. Login and start using viewer
2. Manually delete auth cookie in DevTools → Application → Cookies
3. Trigger event upload
4. Observe error (should NOT retry)

**Expected Results:**
- [ ] 401 error thrown immediately
- [ ] No retry attempts (auth errors not retryable)
- [ ] User sees session expired message
- [ ] Redirected to login (if implemented)

---

## 5. User Documentation ✓

### USER_GUIDE.md Review

**Steps:**
1. Open `docs/USER_GUIDE.md`
2. Review all sections
3. Verify completeness

**Expected Results:**
- [ ] All sections present: Introduction, Getting Started, Navigation, Workflow, Progress, Troubleshooting, Privacy
- [ ] Navigation controls clearly explained
- [ ] Screenshots or ASCII diagrams where helpful
- [ ] Troubleshooting covers common issues
- [ ] Contact information placeholder present
- [ ] Language is clear and user-friendly (no jargon)

---

## 6. Admin Documentation ✓

### ADMIN_GUIDE.md Review

**Steps:**
1. Open `docs/ADMIN_GUIDE.md`
2. Review all sections
3. Verify completeness

**Expected Results:**
- [ ] All sections present: Overview, Dashboard, User Management, Session Replay, Data Export, Monitoring, Troubleshooting
- [ ] CSV format documented with examples
- [ ] Bulk user creation instructions clear
- [ ] Session replay features explained
- [ ] Database management covered
- [ ] Security best practices included
- [ ] Troubleshooting section comprehensive

---

## 7. Bulk User Creation Script ✓

### Script Functionality

**Test 1: Valid CSV**

**Steps:**
1. Navigate to backend directory: `cd backend`
2. Ensure database is running
3. Run script with example CSV:
   ```bash
   npx ts-node scripts/create-users-bulk.ts --csv scripts/example-users.csv
   ```
4. Observe output
5. Verify users in database:
   ```bash
   psql -U postgres -d pathology_study -c "SELECT username, role FROM users;"
   ```

**Expected Results:**
- [ ] Script runs without errors
- [ ] Output shows: "✅ Created/updated user: pathologist1 (pathologist)"
- [ ] All 4 users from CSV created
- [ ] Summary table displays correctly
- [ ] Users exist in database with hashed passwords
- [ ] Roles are correct (pathologist/admin)

**Test 2: Invalid CSV - Missing Fields**

**Steps:**
1. Create invalid CSV with missing password:
   ```csv
   username,password,role
   test_user,,pathologist
   ```
2. Run script with invalid CSV
3. Observe error handling

**Expected Results:**
- [ ] Script shows warning: "Line 2: Password is required"
- [ ] Invalid row is skipped
- [ ] Script continues with other valid rows
- [ ] Exit code indicates partial failure

**Test 3: Invalid CSV - Bad Role**

**Steps:**
1. Create CSV with invalid role:
   ```csv
   username,password,role
   test_user,password123,doctor
   ```
2. Run script
3. Observe error

**Expected Results:**
- [ ] Warning: "Invalid role 'doctor' (must be 'pathologist' or 'admin')"
- [ ] Row is skipped
- [ ] Script doesn't crash

**Test 4: Duplicate User (Upsert)**

**Steps:**
1. Create CSV with existing user (e.g., pathologist1)
2. Change the password in CSV
3. Run script
4. Check database password hash

**Expected Results:**
- [ ] Script shows "Created/updated user"
- [ ] Password is updated (new hash in database)
- [ ] No duplicate users created
- [ ] Upsert behavior works correctly

**Test 5: CSV Not Found**

**Steps:**
1. Run script with non-existent file:
   ```bash
   npx ts-node scripts/create-users-bulk.ts --csv nonexistent.csv
   ```
2. Observe error

**Expected Results:**
- [ ] Clear error message: "File not found: nonexistent.csv"
- [ ] Script exits gracefully (exit code 1)
- [ ] No database changes

**Test 6: No --csv Argument**

**Steps:**
1. Run script without arguments:
   ```bash
   npx ts-node scripts/create-users-bulk.ts
   ```
2. Observe help message

**Expected Results:**
- [ ] Usage instructions displayed
- [ ] CSV format example shown
- [ ] Script exits with code 1
- [ ] No database changes

---

## 8. Integration Testing

### End-to-End Pathologist Workflow

**Steps:**
1. Create test user with bulk script
2. Login as new pathologist
3. View first slide
4. Interact with slide (click, pan, zoom)
5. Select diagnosis and add notes
6. Click "Confirm & Next"
7. Complete 2-3 more slides
8. Logout

**Expected Results:**
- [ ] All loading spinners appear appropriately
- [ ] No errors in console
- [ ] Progress bar updates after each slide
- [ ] Events are logged (check database or admin export)
- [ ] Can resume session after logout
- [ ] Viewing attempt increments correctly

### End-to-End Admin Workflow

**Steps:**
1. Login as admin
2. View dashboard statistics
3. Click "Refresh" button
4. Select pathologist in Session Replay
5. Load a replay session
6. Use playback controls (play, pause, speed, scrubber)
7. Return to dashboard
8. Download CSV export
9. Logout

**Expected Results:**
- [ ] Dashboard loads correctly
- [ ] Statistics are accurate
- [ ] Session replay works without errors
- [ ] Playback controls function properly
- [ ] CSV download succeeds
- [ ] File contains expected data
- [ ] No errors throughout workflow

---

## 9. Browser Compatibility

### Test in Multiple Browsers

**Browsers to Test:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Safari (if available)

**Test Cases:**
- [ ] Login works
- [ ] Loading spinners display correctly
- [ ] Error toasts appear properly
- [ ] Viewer functions normally
- [ ] Session replay works
- [ ] CSV export downloads

---

## 10. Regression Testing

### Verify No Breaking Changes

**Core Functionality:**
- [ ] Slide loading still works
- [ ] Navigation controls function (click, pan, arrows)
- [ ] Zoom ladder works correctly
- [ ] Back/Reset buttons work
- [ ] Diagnosis selection works
- [ ] Notes can be entered
- [ ] Event logging continues to work
- [ ] Session completion works
- [ ] Progress tracking accurate
- [ ] Multi-user slide randomization works

**Admin Features:**
- [ ] User statistics display correctly
- [ ] Progress metrics accurate
- [ ] Session replay loads old sessions
- [ ] CSV export includes all fields
- [ ] Logout works for both roles

---

## 11. Security Testing

### Authentication

**Tests:**
- [ ] Cannot access /api/slides without login
- [ ] Cannot access /api/admin without admin role
- [ ] Pathologist cannot access admin endpoints
- [ ] JWT token expires after 7 days
- [ ] Logout clears auth state

### Rate Limiting

**Tests:**
- [ ] 6+ rapid logins blocked
- [ ] Wait 60 seconds allows retry
- [ ] Rate limit per IP (not per session)
- [ ] Other endpoints have 100 req/min limit

### Password Security

**Tests:**
- [ ] Passwords stored as bcrypt hashes
- [ ] Hash changes when password updated
- [ ] Plain text passwords never visible in logs
- [ ] CSV import deletes plain text after use (manual step)

---

## 12. Performance Testing

### Loading Performance

**Tests:**
- [ ] Login completes within 2 seconds (normal network)
- [ ] Slide loads within 5 seconds (normal network)
- [ ] Session replay loads within 3 seconds for <500 events
- [ ] CSV export starts download within 5 seconds
- [ ] Dashboard refreshes within 2 seconds

### Memory Usage

**Steps:**
1. Open Chrome DevTools → Performance → Memory
2. Complete 10 slides as pathologist
3. Observe memory usage
4. Check for memory leaks

**Expected Results:**
- [ ] Memory usage stays reasonable (< 500 MB)
- [ ] No continuous memory growth
- [ ] Event buffers clear after upload

---

## Summary Checklist

### Implementation Complete

- [x] Loading spinners for all async operations
- [x] User-friendly error messages
- [x] Error toast with auto-dismiss
- [x] Rate limiting on auth (5 req/min)
- [x] Rate limiting on API (100 req/min)
- [x] Retry logic with exponential backoff
- [x] USER_GUIDE.md documentation
- [x] ADMIN_GUIDE.md documentation
- [x] Bulk user creation script
- [x] Example CSV file

### Testing Status

- [ ] Loading states tested
- [ ] Error handling tested
- [ ] Rate limiting verified
- [ ] Retry logic confirmed
- [ ] Documentation reviewed
- [ ] Bulk script validated
- [ ] Integration tests passed
- [ ] No regressions found

### Ready for Deployment

Once all tests pass:

- [ ] All features work as specified
- [ ] No critical bugs found
- [ ] Documentation is complete
- [ ] Security measures validated
- [ ] Performance is acceptable
- [ ] User experience is smooth

---

## Notes

**Found Issues:**

_Document any bugs or issues discovered during testing here_

**Improvements:**

_Note any suggested improvements for future iterations_

**Test Environment:**

- Date tested: ___________
- Tester: ___________
- Browser: ___________
- Backend version: ___________
- Frontend version: ___________
