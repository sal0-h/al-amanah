# Al-Amanah: CMU Qatar MSA Task Tracker

A real-time **Semester → Week → Event → Task** management system for coordinating MSA (Muslim Student Association) events at CMU Qatar with Discord notifications.

## Quick Start

```bash
# 1. Clone and configure
git clone <repo>
cp .env.example .env
# Edit .env: set SECRET_KEY, Discord webhooks, admin credentials

# 2. Start all services
docker-compose up -d --build

# 3. Access
# App: http://localhost
# API docs: http://localhost/api/docs
```

## What Is This?

**Al-Amanah** (Arabic: "The Trust") is a task tracker designed for MSA event coordination at CMU Qatar. It handles the complexity of organizing Islamic events, prayers, and community activities by breaking them down into:

- **Semesters** → Academic periods (e.g., "Spring 2026")
- **Weeks** → Grouped events within a semester
- **Events** → Individual activities (Jumuah prayer, Eid celebration, etc.)
- **Tasks** → Action items (order food, setup chairs, send reminders, etc.)

**Why it exists:** Manual event coordination via email/chat is chaotic. Al-Amanah centralizes tasks with automatic Discord reminders, role-based visibility, and audit trails.

## Key Features

| Feature | Purpose |
|---------|---------|
| **Role-Based Access** | Admins see all; Members see only their tasks; Team leads see team + individual tasks |
| **Task Templates** | Create recurring event types (Jumuah, Halaqa, Eid prep, etc.) with default task lists |
| **Team Assignments** | Assign tasks to individuals, teams, or multi-person pools |
| **Discord Reminders** | Auto-send reminders 24h before events; manual reminders anytime |
| **Cannot-Do Alerts** | Member flags task as blocked → admin gets Discord alert with reason |
| **Audit Logs** | Full history of who completed/changed what and when |
| **Dark Mode** | Full dark theme support (toggle in header) |
| **Export/Import** | Backup semesters or migrate to another instance |

## Architecture

**Backend:** FastAPI 0.109 + SQLAlchemy ORM + SQLite  
**Frontend:** React 18 + Vite + TypeScript + Tailwind CSS  
**Infrastructure:** Docker Compose (backend + nginx proxy) + optional Cloudflare Tunnel  
**Auth:** Session-based (signed cookies, not JWT)  

### How It Links Together

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React/Vite) @ :5173                      │
│  - Dashboard with week tabs                         │
│  - Admin panel (all controls)                       │
└──────────────────┬──────────────────────────────────┘
                   │ (HTTP + session cookies)
┌──────────────────▼──────────────────────────────────┐
│  nginx Reverse Proxy @ :80                          │
│  - Intercepts requests                              │
│  - Routes /api → backend, / → frontend              │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  FastAPI Backend @ :8000                            │
│  - 14 routers (auth, tasks, semesters, etc.)        │
│  - Session validation + permissions                 │
│  - Discord webhook integration                      │
│  - APScheduler (24h reminder checking)              │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  SQLite Database @ ./data/app.db                    │
│  - 12 tables (users, tasks, events, etc.)           │
│  - Persistent across restarts                       │
└─────────────────────────────────────────────────────┘

Optional: Cloudflare Tunnel for HTTPS/outbound-only access
```

## Environment Setup

**Required `.env` variables:**

```bash
SECRET_KEY=<32+ char random string>
REMINDER_WEBHOOK_URL=<Discord webhook for reminders>
ADMIN_WEBHOOK_URL=<Discord webhook for admin alerts>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secure password>
ADMIN_DISCORD_ID=<optional Discord ID for admin>
```

**Auto-created on first run:**
- Admin user from `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- SQLite database at `./data/app.db`

## Deployment

### Local Development
```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload  # Auto-creates DB, runs on :8000

# Frontend (new terminal)
cd frontend && npm install && npm run dev  # Runs on :5173
```

### Production (Docker)
```bash
docker-compose up -d --build
# Runs on http://localhost (nginx proxy)
# For HTTPS: cloudflared tunnel --url http://localhost:80
```

## Testing

```bash
# Backend
cd backend && pytest -v

# Frontend
cd frontend && npm test

# Docker + integration
docker-compose exec backend pytest
```

## Key Files

- [BUG_REPORT.md](./BUG_REPORT.md) — Known issues and roadmap
- [PLAN.md](./PLAN.md) — Development notes
- `.github/copilot-instructions.md` — Coding conventions and API reference
- `backend/app/models/` — 12 data models (User, Task, Event, etc.)
- `backend/app/routers/` — 14 API endpoints
- `frontend/src/pages/` — Dashboard, AdminPanel, Login, Statistics

## Known Limitations

- **Single active semester** at a time (by design)
- **SQLite only** (no production database migration path yet)
- **Session auth only** (suitable for small teams, not enterprise)
- **Timezone fixed to Qatar** (hardcoded in models)
- **No real-time updates** (refresh required to see others' changes)

## Security Notes

- Session cookies are signed (cryptographic validation)
- Discord IDs stored plaintext (Discord handles auth, we just ping)
- No data encryption at rest (add with `.env` config if needed)
- Cloudflare Tunnel provides HTTPS (no self-signed certs)

## Contributing

1. See [BUG_REPORT.md](./BUG_REPORT.md) for known issues
2. Follow patterns in `backend/app/routers/tasks.py` (auth, audit logging, optimistic updates)
3. All UI must include `dark:` Tailwind classes
4. Test locally: `docker-compose up`, run pytest, check frontend
5. Commit with clear message

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 on `/api/...` | Session expired → login again |
| Tasks not showing | Check semester is active (Admin → Semesters) |
| Reminders not sent | Check Discord webhooks in `.env` and bot has permission |
| Timezone mismatch | Events stored in UTC, display in browser TZ (not Qatar hardcoded) |
| Port 80 in use | `docker-compose.yml` uses port 80; change to `81:80` if needed |

## License & Attribution

Built for CMU Qatar's Muslim Student Association.  
Uses FastAPI, React, SQLAlchemy, Tailwind CSS, and APScheduler.

---

**Questions?** See [BUG_REPORT.md](./BUG_REPORT.md) or [PLAN.md](./PLAN.md) for architecture details.

