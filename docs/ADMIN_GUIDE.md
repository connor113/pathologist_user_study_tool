# Admin Dashboard Guide

This guide covers administrative features for managing the pathologist user study, including monitoring progress, viewing session replays, and exporting data.

## Table of Contents

1. [Overview](#overview)
2. [Accessing the Dashboard](#accessing-the-dashboard)
3. [Dashboard Features](#dashboard-features)
4. [User Management](#user-management)
5. [Session Replay](#session-replay)
6. [Data Export](#data-export)
7. [Monitoring Study Progress](#monitoring-study-progress)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### Admin Dashboard Purpose

The admin dashboard provides:

- **Real-time study progress monitoring**
- **Per-pathologist completion statistics**
- **Session replay visualization** (watch how pathologists examine slides)
- **Data export** (download all interaction events as CSV)
- **User management** (create pathologist accounts)

### Admin Privileges

Admin accounts can:

- ✅ View all pathologist statistics
- ✅ Access session replays for any pathologist
- ✅ Export complete study data
- ✅ Monitor overall progress
- ❌ View slides as a pathologist (separate accounts for participation)

---

## Accessing the Dashboard

### Login

1. Navigate to the viewer URL
2. Enter admin credentials (username and password)
3. Click **Login**
4. Dashboard appears automatically (role-based routing)

> **Note:** Admin accounts are identified by their role in the database. Regular pathologists will see the viewer instead.

### Security

- **Admin passwords** should be strong and unique
- **Session timeout:** 7 days of inactivity
- **Rate limiting:** 5 login attempts per minute (brute force protection)
- **Credentials:** Store securely, never share publicly

---

## Dashboard Features

### Overview Cards

The top of the dashboard shows four key metrics:

```
┌─────────────────────────────────────────────────┐
│  Pathologists: 20  |  Slides: 50                │
│  Sessions: 850/1000  |  Progress: 85%           │
└─────────────────────────────────────────────────┘
```

**Metrics Explained:**

1. **Pathologists:** Total number of pathologist users
2. **Slides:** Total number of slides in the study
3. **Sessions:** Completed sessions / Total possible sessions
   - Total possible = Pathologists × Slides
4. **Progress:** Overall completion percentage

### Pathologist Table

Lists all pathologists with individual statistics:

| Username | Total Sessions | Completed | Progress |
|----------|----------------|-----------|----------|
| path001  | 50             | 45        | 90% ████████░ |
| path002  | 50             | 23        | 46% ████░░░░░ |
| ...      | ...            | ...       | ... |

**Columns:**

- **Username:** Pathologist's login name
- **Total Sessions:** Number of slides assigned
- **Completed:** Number of slides reviewed
- **Progress:** Visual progress bar with percentage

### Refresh Button

- **Location:** Top-right of dashboard
- **Action:** Reloads statistics from database
- **Use:** Check for updates after pathologists complete slides
- **Auto-refresh:** Manual only (click to update)

---

## User Management

### Creating Individual Users

#### Using the Database Script

**Prerequisites:**
- Access to backend server
- Database connection configured
- Node.js and npm installed

**Steps:**

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Run the user creation script:
   ```bash
   npm run create-users
   ```

   Or directly:
   ```bash
   npx ts-node scripts/create-test-users.ts
   ```

3. Default users created:
   - `admin` / `admin123` (admin role)
   - `pathologist1` / `patho123` (pathologist role)
   - `pathologist2` / `patho123` (pathologist role)

#### Modify Script for Custom Users

Edit `backend/scripts/create-test-users.ts`:

```typescript
const users = [
  {
    username: 'your_username',
    password: 'secure_password',
    role: 'pathologist' // or 'admin'
  },
  // Add more users...
];
```

### Bulk User Creation

#### Using CSV Import

**Prerequisites:**
- CSV file with user data
- Access to backend server

**CSV Format:**

```csv
username,password,role
pathologist1,SecurePass123,pathologist
pathologist2,SecurePass456,pathologist
pathologist3,SecurePass789,pathologist
admin_backup,AdminPass999,admin
```

**Required Columns:**

1. **username** - Unique identifier (no spaces, alphanumeric + underscore)
2. **password** - Plain text (will be hashed automatically)
3. **role** - Either `pathologist` or `admin`

**Steps:**

1. Create CSV file named `users.csv` in the backend directory

2. Run bulk import script:
   ```bash
   cd backend
   npx ts-node scripts/create-users-bulk.ts --csv users.csv
   ```

3. Review output:
   ```
   ✅ Created/updated user: pathologist1 (pathologist)
   ✅ Created/updated user: pathologist2 (pathologist)
   ✅ Created/updated user: pathologist3 (pathologist)
   
   📝 Summary: 3 users created successfully
   ```

**Important Notes:**

- **Passwords are hashed** using bcrypt (10 salt rounds)
- **Upsert behavior:** Running twice updates existing users (doesn't duplicate)
- **Invalid rows skipped:** Script continues if one user fails
- **Security:** Delete CSV file after import (contains plain-text passwords)

#### Password Requirements

Recommend to pathologists:

- **Minimum length:** 8 characters
- **Mix:** Letters, numbers, special characters
- **Avoid:** Common words, personal information
- **Unique:** Different from other accounts

### Managing Existing Users

#### Reset Password

**Option 1: Database Direct (Recommended)**

```sql
-- Connect to database
psql -U postgres -d pathology_study

-- Generate new hash using bcrypt (outside DB)
-- Then update:
UPDATE users 
SET password_hash = '$2b$10$...'  -- Insert new bcrypt hash
WHERE username = 'pathologist1';
```

**Option 2: Recreate User**

Run the creation script again with the new password - it will update the existing user.

#### Delete User

```sql
-- Connect to database
psql -U postgres -d pathology_study

-- Delete user (cascades to sessions and events)
DELETE FROM users WHERE username = 'pathologist1';
```

> **Warning:** Deleting a user also deletes all their sessions and event data (CASCADE).

---

## Session Replay

### Overview

Session replay lets you watch exactly how a pathologist examined a slide:

- **Viewport animation:** See where they looked and when
- **Click markers:** Visual indicators of clicked positions
- **Scanning path:** Lines showing navigation sequence
- **Zoom transitions:** Smooth animations between magnification levels
- **Timeline scrubber:** Jump to any point in the session

### Loading a Replay

**Steps:**

1. **Select Pathologist:**
   - Use dropdown: "Select a pathologist..."
   - Shows only pathologists with completed sessions
   - Format: `username (X completed)`

2. **Select Session:**
   - Second dropdown populates automatically
   - Shows completed slides for selected pathologist
   - Format: `slide_name - Diagnosis (X events)`

3. **View Session Details:**
   - Session information appears below dropdowns
   - Shows: started time, completed time, duration, event count

4. **Load Replay:**
   - Click **▶ Load Replay** button
   - Replay viewer opens full-screen
   - Slide loads with first viewport position

### Replay Controls

#### Playback Buttons

- **▶ Play** - Start animated playback
- **⏸ Pause** - Freeze at current event
- **⏮ Previous Event** - Jump to previous event
- **⏭ Next Event** - Jump to next event
- **← Back to Dashboard** - Return to admin dashboard

#### Speed Control

Adjust playback speed:

- **0.5×** - Half speed (detailed observation)
- **1×** - Normal speed (default)
- **2×** - Double speed (quick review)
- **5×** - Five times speed (rapid scan)

#### Timeline Scrubber

- **Drag slider** to jump to any event
- **Click timeline** to jump to that position
- **Current event info** displays above timeline
  - Event type (e.g., "cell_click")
  - Timestamp
  - Zoom level
  - Event number (e.g., "Event 45/387")

### Visual Elements

#### Scanning Path

- **Blue lines** - Early navigation (beginning of session)
- **Red lines** - Late navigation (end of session)
- **Gradient progression** - Color transitions show temporal order
- **Line thickness** - Uniform (all equal importance)

#### Click Markers

- **Red circles** - Locations where pathologist clicked
- **Size** - Proportional to zoom level (larger at high mag)
- **Cumulative** - All previous clicks visible during playback

#### Viewport Rectangle

- **White outline** - Current field of view
- **Animated** - Smoothly pans and zooms during playback
- **Real-time** - Matches exact viewport at each moment

### Interpreting Replays

**Use Cases:**

1. **Training:** See expert navigation strategies
2. **Quality control:** Verify thorough examination
3. **Research:** Analyze scanning patterns for ML models
4. **Comparison:** Compare different pathologist approaches

**Key Observations:**

- **Coverage:** Did they examine the entire slide?
- **Focus areas:** Where did they spend the most time?
- **Zoom usage:** Did they use appropriate magnifications?
- **Systematic vs. random:** Was navigation organized or scattered?
- **Revisits:** Did they return to certain areas multiple times?

### Replay Limitations

- **Performance:** Large sessions (>1000 events) may be slower
- **Browser memory:** Keep only one replay open at a time
- **No editing:** Replays are read-only (cannot modify past sessions)
- **Export:** No direct video export (use screen recording if needed)

---

## Data Export

### CSV Export

#### Downloading Data

**Steps:**

1. Click **⬇ Download CSV Export** button on dashboard
2. Browser downloads file automatically
3. Filename format: `pathology_events_YYYY-MM-DD.csv`
4. Save to secure location

#### File Format

**CSV Structure:**

```csv
ts_iso8601,session_id,user_id,slide_id,event,zoom_level,dzi_level,click_x0,click_y0,center_x0,center_y0,vbx0,vby0,vtx0,vty0,container_w,container_h,dpr,app_version,label,notes,viewing_attempt
2026-01-27T10:15:23.456Z,abc-123,user-456,slide_001,slide_load,2.5,14,,,50000,50000,40000,40000,60000,60000,1920,1080,1.0,1.0.0-alpha,,,1
2026-01-27T10:15:30.123Z,abc-123,user-456,slide_001,cell_click,5,15,55000,52000,55000,52000,45000,42000,65000,62000,1920,1080,1.0,1.0.0-alpha,,,1
...
```

**Column Descriptions:**

| Column | Type | Description |
|--------|------|-------------|
| `ts_iso8601` | Timestamp | Event time (ISO 8601 format) |
| `session_id` | UUID | Unique session identifier |
| `user_id` | UUID | Pathologist user ID |
| `slide_id` | String | Slide identifier |
| `event` | String | Event type (see below) |
| `zoom_level` | Number | Magnification (2.5, 5, 10, 20, 40, or fit) |
| `dzi_level` | Number | DZI pyramid level index |
| `click_x0` | Number | Click X coordinate (level-0 pixels) |
| `click_y0` | Number | Click Y coordinate (level-0 pixels) |
| `center_x0` | Number | Viewport center X (level-0 pixels) |
| `center_y0` | Number | Viewport center Y (level-0 pixels) |
| `vbx0` | Number | Viewport bottom-left X (level-0 pixels) |
| `vby0` | Number | Viewport bottom-left Y (level-0 pixels) |
| `vtx0` | Number | Viewport top-right X (level-0 pixels) |
| `vty0` | Number | Viewport top-right Y (level-0 pixels) |
| `container_w` | Number | Viewer container width (screen pixels) |
| `container_h` | Number | Viewer container height (screen pixels) |
| `dpr` | Number | Device pixel ratio |
| `app_version` | String | Application version |
| `label` | String | Diagnosis (only for `slide_next` events) |
| `notes` | String | Pathologist notes (only for `slide_next`) |
| `viewing_attempt` | Number | Which viewing attempt (1=first, 2+=resumed) |

**Event Types:**

- `app_start` - Application launched
- `slide_load` - Slide finished loading
- `cell_click` - Pathologist clicked (zoom in)
- `zoom_step` - Zoom level changed
- `arrow_pan` - Pan using arrow buttons
- `back_step` - Navigation back button used
- `reset` - Reset to fit view
- `label_select` - Diagnosis selected (before confirm)
- `slide_next` - Slide confirmed and moved to next

### Data Analysis

**Recommended Tools:**

- **Python:** pandas, matplotlib, seaborn
- **R:** tidyverse, ggplot2
- **Excel/Google Sheets:** Basic analysis
- **Jupyter Notebooks:** Interactive exploration

**Common Analyses:**

1. **Session duration:** Time from `slide_load` to `slide_next`
2. **Clicks per slide:** Count `cell_click` events
3. **Zoom preferences:** Distribution of `zoom_level` values
4. **Coverage:** Calculate viewport positions over slide area
5. **Diagnosis patterns:** Correlate event patterns with `label` outcomes

**Example Python Code:**

```python
import pandas as pd
import matplotlib.pyplot as plt

# Load CSV
df = pd.read_csv('pathology_events_2026-01-27.csv')

# Parse timestamps
df['ts'] = pd.to_datetime(df['ts_iso8601'])

# Session duration analysis
sessions = df.groupby('session_id').agg({
    'ts': ['min', 'max'],
    'event': 'count'
}).reset_index()

sessions['duration_sec'] = (
    sessions[('ts', 'max')] - sessions[('ts', 'min')]
).dt.total_seconds()

# Plot distribution
plt.hist(sessions['duration_sec'] / 60, bins=20)
plt.xlabel('Duration (minutes)')
plt.ylabel('Number of sessions')
plt.title('Session Duration Distribution')
plt.show()
```

### Data Privacy

**Important Reminders:**

- **PHI-free:** Data contains NO patient information
- **Anonymized:** User IDs are not linked to real names
- **Secure storage:** Keep CSV files encrypted
- **Sharing:** Only share with authorized research team members
- **Compliance:** Follow IRB protocols and data agreements

---

## Monitoring Study Progress

### Real-Time Tracking

**Refresh Frequency:**

- **Manual only:** Click "🔄 Refresh" button to update
- **After pathologist sessions:** Refresh to see new completions
- **During active sessions:** Progress updates when sessions complete
- **No auto-refresh:** Prevents unnecessary server load

**Progress Indicators:**

1. **Overall completion percentage** - Top stat card
2. **Per-pathologist progress bars** - Visual completion status
3. **Completed vs. total sessions** - Numeric tracking
4. **Color-coded bars:**
   - Green (high progress)
   - Yellow (medium progress)
   - Red (low progress)

### Identifying Issues

**Watch for:**

- **Stuck pathologists** - No progress over several days
- **Incomplete sessions** - Sessions started but not finished
- **Outliers** - Unusually fast or slow completion times
- **Technical issues** - Multiple failed session attempts

**Follow-up Actions:**

1. **Check replay** - Review recent sessions for problems
2. **Contact pathologist** - Ask about difficulties
3. **Review event logs** - Look for error patterns
4. **Adjust study** - If systemic issues found

---

## Troubleshooting

### Dashboard Not Loading

**Symptoms:** Blank page, loading spinner doesn't stop, error message

**Solutions:**

1. **Check admin credentials:**
   - Ensure account has `role = 'admin'` in database
   - Verify password is correct

2. **Verify backend is running:**
   ```bash
   curl http://localhost:3001/health
   # Should return: {"status":"ok",...}
   ```

3. **Check browser console:**
   - Press F12 → Console tab
   - Look for JavaScript errors or network failures

4. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
   - Or clear cache in browser settings

5. **Check database connection:**
   ```bash
   cd backend
   npm run dev
   # Check console for database errors
   ```

### Database Connection Errors

**Symptoms:** "Failed to load dashboard data" message

**Solutions:**

1. **Verify PostgreSQL is running:**
   ```bash
   # Docker
   docker ps | grep pathology-db
   
   # Native PostgreSQL
   systemctl status postgresql  # Linux
   pg_ctl status                 # macOS
   ```

2. **Check database credentials:**
   - Edit `backend/.env`
   - Verify `DATABASE_URL` is correct

3. **Test connection:**
   ```bash
   psql -U postgres -d pathology_study -c "SELECT COUNT(*) FROM users;"
   ```

4. **Check backend logs:**
   ```bash
   cd backend
   npm run dev
   # Look for connection errors in output
   ```

### CSV Export Fails

**Symptoms:** Download doesn't start, error message, or empty file

**Solutions:**

1. **Check data exists:**
   ```sql
   SELECT COUNT(*) FROM events;
   -- Should return > 0
   ```

2. **Browser pop-up blocker:**
   - Allow downloads from this site
   - Check browser notification area

3. **File size too large:**
   - Large studies (>100,000 events) may timeout
   - Use database export instead:
     ```bash
     psql -U postgres -d pathology_study -c "\COPY (SELECT * FROM events) TO 'events.csv' CSV HEADER"
     ```

4. **Server timeout:**
   - Increase timeout in `backend/src/routes/admin.ts`
   - Or export directly from database

### Session Replay Not Working

**Symptoms:** Replay doesn't load, blank viewer, errors

**Solutions:**

1. **Check tile availability:**
   - Verify DZI tiles exist for the slide
   - Path: `/tiles/{slide_id}.dzi` and `/tiles/{slide_id}_files/`

2. **Browser memory:**
   - Close other tabs
   - Refresh the page
   - Try a different browser

3. **Large sessions:**
   - Sessions with >1000 events may be slow
   - Be patient during loading
   - Use speed slider to navigate faster

4. **Clear replay cache:**
   - Return to dashboard (← Back button)
   - Reload the replay from scratch

### Missing Slides in Dropdown

**Symptoms:** "No slides found" or incomplete list

**Solutions:**

1. **Verify slides in database:**
   ```sql
   SELECT slide_id, name FROM slides;
   ```

2. **Check slide assignment:**
   - Slides must be in `slides` table
   - DZI tiles must exist

3. **Add missing slides:**
   ```sql
   INSERT INTO slides (id, slide_id, name, created_at)
   VALUES (gen_random_uuid(), 'slide_123', 'Slide 123', CURRENT_TIMESTAMP);
   ```

### Pathologist Not Appearing in List

**Symptoms:** User missing from replay dropdown or table

**Solutions:**

1. **Check user role:**
   ```sql
   SELECT username, role FROM users WHERE username = 'pathologist1';
   -- Must be 'pathologist', not 'admin'
   ```

2. **Check completed sessions:**
   ```sql
   SELECT COUNT(*) FROM sessions WHERE user_id = (
     SELECT id FROM users WHERE username = 'pathologist1'
   ) AND completed_at IS NOT NULL;
   -- Must be > 0 for replay dropdown
   ```

3. **Refresh dashboard:**
   - Click 🔄 Refresh button
   - Reload page if necessary

---

## Backend Management

### Starting the Backend

```bash
cd backend
npm install          # First time only
npm run dev          # Development mode
```

### Production Deployment

**Environment Variables:**

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@host:port/dbname
JWT_SECRET=your-secret-key-min-32-characters
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.com
```

**Start Production Server:**

```bash
cd backend
npm run build        # Compile TypeScript
npm start            # Run production server
```

### Backup Data

**Full Database Backup:**

```bash
pg_dump -U postgres pathology_study > backup_$(date +%Y%m%d).sql
```

**Events Only:**

```bash
psql -U postgres -d pathology_study -c "\COPY events TO 'events_backup.csv' CSV HEADER"
```

**Restore:**

```bash
psql -U postgres -d pathology_study < backup_20260127.sql
```

---

## Security Best Practices

### Admin Account Security

1. **Strong passwords** - Minimum 16 characters, mix of types
2. **Unique credentials** - Different from other accounts
3. **No sharing** - Each admin gets their own account
4. **Regular rotation** - Change passwords quarterly
5. **Two-factor** - Implement if handling sensitive data (not built-in)

### Server Security

1. **HTTPS only** - Always use SSL/TLS in production
2. **Firewall** - Restrict database access to backend only
3. **Updates** - Keep dependencies updated
4. **Monitoring** - Log all admin actions
5. **Backups** - Regular automated backups

### Data Protection

1. **Encryption at rest** - Use encrypted storage for CSV exports
2. **Secure transmission** - HTTPS for all API calls
3. **Access control** - Only authorized personnel
4. **Audit trail** - Log who exports data and when
5. **Retention policy** - Delete data after research complete

---

## Support

### Common Questions

**Q: Can I edit a pathologist's completed session?**  
A: No, sessions are read-only once completed. This ensures data integrity.

**Q: How do I remove a pathologist from the study?**  
A: Delete their user account (see "Delete User" above). This deletes all their data.

**Q: Can I assign different slides to different pathologists?**  
A: Current version assigns all slides to all pathologists. Custom assignment requires database modifications.

**Q: How do I add more slides mid-study?**  
A: Add slides to database and they'll automatically appear for all pathologists who haven't completed them yet.

**Q: Where are the DZI tiles stored?**  
A: Local development: `public/tiles/` directory. Production: AWS S3 or similar CDN.

### Getting Help

**Technical Issues:**
- Check logs: `backend/npm run dev` output
- Database: `psql` to inspect directly
- GitHub Issues: Report bugs to repository

**Research Questions:**
- Contact study PI or coordinator
- Refer to IRB protocol documentation

---

## Appendix

### Database Schema Overview

**Key Tables:**

- `users` - Pathologist and admin accounts
- `slides` - Available slides for review
- `sessions` - Links users to slides with completion status
- `events` - All interaction events (clicks, pans, zooms)

**Relationships:**

```
users 1-to-many sessions
slides 1-to-many sessions
sessions 1-to-many events
```

### API Endpoints

**Admin Routes:**

- `GET /api/admin/users` - List pathologist statistics
- `GET /api/admin/progress` - Overall study progress
- `GET /api/admin/export/csv` - Download all events
- `GET /api/admin/sessions?user_id=X` - List completed sessions
- `GET /api/admin/sessions/:id/events` - Get session events for replay

**Rate Limits:**

- Auth endpoints: 5 requests/minute/IP
- API endpoints: 100 requests/minute/IP

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**For Support:** Contact study coordinator
