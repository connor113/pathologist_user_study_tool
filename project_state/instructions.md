# Development Instructions

## Quick Start

```bash
# Database
docker run --name pathology-db -p 5432:5432 -e POSTGRES_PASSWORD=dev123 -d postgres
docker exec -i pathology-db psql -U postgres < backend/src/db/migrations/001_initial.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f backend/src/db/migrations/002_add_dzi_level_to_events.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f backend/src/db/migrations/003_add_notes_column.sql

# Backend
cd backend && npm install && npm run dev  # http://localhost:3001

# Frontend
npm install && npm run dev  # http://localhost:5173
```

---

## Conventions

### Navigation
- **Click:** Centers on exact position, steps zoom ladder
- **Right-click:** Zooms out, keeps center
- **Arrows:** Pan 0.5× viewport, clamped
- **Disabled:** Mouse wheel, keyboard shortcuts, free pan

### Event Logging
- Batched: every 10 events + 5s auto-flush + beforeunload
- All coordinates in level-0 pixel space
- Click coordinates only for `cell_click` events

### Backend
- Parameterized queries (`$1, $2`) for SQL
- Error response: `{error: string}` with HTTP status
- Auth: JWT in middleware, attach `req.user`
- Logging: `[AUTH]`, `[DB]`, `[API]` prefixes

### API
- RESTful: `GET/POST /api/resource`
- Success: `{data: {...}}`, Failure: `{error: "message"}`
- Auth: `credentials: 'include'` for cookies

### Database
- Primary keys: UUIDs
- Timestamps: `TIMESTAMPTZ` with `DEFAULT CURRENT_TIMESTAMP`
- Foreign keys: `ON DELETE CASCADE`

---

## Environment Variables

### Frontend (.env.local)
```env
VITE_API_URL=http://localhost:3001
```

### Backend (.env)
```env
DATABASE_URL=postgresql://postgres:dev123@localhost:5432/pathology_study
JWT_SECRET=your-secret-key-min-32-chars
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

## Deployment

See `DEPLOYMENT.md` for full instructions.

- **Frontend:** Vercel (auto-deploy from GitHub)
- **Backend:** Railway or Render with PostgreSQL
- **Tiles:** AWS S3 + CloudFront CDN
