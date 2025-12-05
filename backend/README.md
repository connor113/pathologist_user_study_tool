# Pathologist User Study - Backend API

Node.js + Express + TypeScript backend with PostgreSQL database.

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql://postgres:dev123@localhost:5432/pathology_study
JWT_SECRET=local-development-secret-key-change-for-production
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 3. Start PostgreSQL Database

Make sure Docker is running, then start the PostgreSQL container:

```bash
docker run --name pathology-db -p 5432:5432 -e POSTGRES_PASSWORD=dev123 -d postgres
```

Check if it's running:
```bash
docker ps
```

### 4. Run Database Migration

Connect to PostgreSQL and run the migration:

```bash
docker exec -i pathology-db psql -U postgres < src/db/migrations/001_initial.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f src/db/migrations/002_add_dzi_level_to_events.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f src/db/migrations/003_add_notes_column.sql
```

This will:
- Create the `pathology_study` database
- Create all 4 tables (users, slides, sessions, events)
- Add indexes for performance
- Add the `dzi_level` column/index for event logging fidelity

### 5. Verify Database Setup

Check that tables were created:

```bash
docker exec -it pathology-db psql -U postgres -d pathology_study -c "\dt"
```

You should see:
- users
- slides
- sessions
- events

### 6. Start Development Server

```bash
npm run dev
```

Server will run on `http://localhost:3001`

## Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled JavaScript (for production)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/me` - Get current user info

### Slides
- `GET /api/slides` - Get slide list for current user
- `GET /api/slides/:slideId/manifest` - Get slide manifest
- `POST /api/slides/:slideId/start` - Create new session

### Events
- `POST /api/sessions/:sessionId/events` - Batch upload events
- `POST /api/sessions/:sessionId/complete` - Mark session complete

### Admin
- `GET /api/admin/users` - List all pathologists
- `GET /api/admin/progress` - Get overall study progress
- `POST /api/admin/users` - Create new pathologist account
- `GET /api/admin/export/csv` - Download all events as CSV

## Database Schema

See `src/db/schema.sql` for full schema documentation.

### Tables
1. **users** - Pathologist and admin accounts
2. **slides** - WSI metadata and S3 storage info
3. **sessions** - User-slide review sessions
4. **events** - Interaction logs (clicks, zooms, pans, etc.)

## Development Tips

### Reset Database
```bash
docker exec -i pathology-db psql -U postgres < src/db/migrations/001_initial.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f src/db/migrations/002_add_dzi_level_to_events.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f src/db/migrations/003_add_notes_column.sql
```

### View Database Contents
```bash
# Connect to database
docker exec -it pathology-db psql -U postgres -d pathology_study

# List tables
\dt

# View users
SELECT * FROM users;

# Exit
\q
```

### Stop/Start Database
```bash
# Stop
docker stop pathology-db

# Start
docker start pathology-db

# Remove (to start fresh)
docker rm -f pathology-db
```

