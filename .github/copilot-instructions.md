# AI Coding Instructions - Al-Amanah

## Architecture
- **Stack**: FastAPI backend + React/Vite frontend + SQLite, served by nginx via Docker Compose
- **Core hierarchy**: Semester → Week → Event → Task (all CRUD flows follow this chain)
- **Entry points**: [backend/app/main.py](backend/app/main.py) (FastAPI + scheduler startup), [frontend/src/App.tsx](frontend/src/App.tsx) (React router)

## Auth & Permissions
- **Session cookies** via itsdangerous (not JWT). Use `get_current_user` / `get_admin_user` from [backend/app/middleware/auth.py](backend/app/middleware/auth.py). Sessions expire after 7 days.
- **Frontend** sends `credentials: 'include'` automatically via [frontend/src/api/client.ts](frontend/src/api/client.ts).
- **Roles**: `ADMIN` (full access) or `MEMBER` (filtered view). Check `current_user.role == Role.ADMIN` for admin-only logic.
- **Roster gate**: Non-admins must be in `RosterMember` for the active semester to see/modify tasks; see [backend/app/routers/roster.py](backend/app/routers/roster.py).

## Task Assignment Model
Three assignment paths checked in `can_modify_task()` in [backend/app/routers/tasks.py](backend/app/routers/tasks.py):
1. `assigned_to` - single user ID
2. `assigned_team_id` - any team member can complete
3. `TaskAssignment` pool - multi-user via `assigned_user_ids` list

**Key behaviors**: Changing assignment resets status to PENDING. `completed_by` records who acted. Status flow: PENDING → DONE/CANNOT_DO → PENDING (via undo).

## Data Shaping Pattern
Always use `*_to_out()` helpers (e.g., `task_to_out()` in [backend/app/routers/tasks.py](backend/app/routers/tasks.py)) to hydrate response objects with:
- `assignee_name` (resolved from user → team → pool count)
- `assignees` list with `{id, display_name}`
- `completed_by_name`

Mirror schema in [backend/app/routers/dashboard.py](backend/app/routers/dashboard.py) for the dashboard endpoint. Keep frontend types at [frontend/src/types/index.ts](frontend/src/types/index.ts) in sync with Pydantic schemas.

## Templates System
- Hardcoded event templates + DB templates (prefixed `db_`) in [backend/app/routers/templates.py](backend/app/routers/templates.py)
- Week templates use `day_of_week` (0=Sun, 6=Sat) + `default_time` (HH:MM) relative to week start
- Template tasks with `assigned_team_name` resolve to team IDs; missing teams raise 400

## Scheduler & Discord
- APScheduler hourly job in [backend/app/services/scheduler.py](backend/app/services/scheduler.py) uses Qatar TZ (`Asia/Qatar`, UTC+3)
- `auto_reminder_sent` flag prevents duplicate day-before reminders
- Manual reminders: `POST /api/tasks/{id}/send-reminder`, `POST /api/events/{id}/send-all-reminders`
- Webhooks: `REMINDER_WEBHOOK_URL` (user pings), `ADMIN_WEBHOOK_URL` (cannot-do alerts)
- **Disable in tests**: Set `DISCORD_ENABLED=False` in env or config

## Development Commands
```bash
# Full stack (Docker)
docker-compose up -d --build    # nginx on :80, API at /api

# Backend standalone
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload   # :8000

# Frontend standalone  
cd frontend && npm install && npm run dev  # :5173

# Tests
cd backend && pytest            # in-memory SQLite per test
cd frontend && npm test         # Vitest + React Testing Library
```

## Testing Patterns
- Backend fixtures in [backend/tests/conftest.py](backend/tests/conftest.py): `client`, `db_session`, `admin_user`, `member_user`, `active_semester`
- Each test gets fresh in-memory SQLite via `StaticPool`
- Use `admin_auth_headers` / `member_auth_headers` fixtures for authenticated requests
- Frontend mocks API calls in [frontend/tests/setup.ts](frontend/tests/setup.ts)

## Audit Trail
Call `log_action()` from [backend/app/services/audit.py](backend/app/services/audit.py) for status changes:
```python
log_action(db, "TASK_DONE", "task", task.id, task.title, user_id=current_user.id)
```
Actions: `TASK_DONE`, `TASK_CANNOT_DO`, `TASK_UNDO`, `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`

## Environment Variables
Required in `.env`:
- `SECRET_KEY` - session signing (32+ chars)
- `REMINDER_WEBHOOK_URL` / `ADMIN_WEBHOOK_URL` - Discord webhooks
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` - auto-created on first run

Optional: `DEBUG=True`, `DISCORD_ENABLED=False`, `ADMIN_DISCORD_ID`

## Gotchas
- Discord IDs must be numeric strings (validated)
- Only one semester can be `is_active=True` (auto-deactivates others)
- SQLite persists in `./data/` - delete to reset
- nginx binds port 80; conflicts with other local servers
- Cloudflare tunnel: CORS auto-allows HTTPS origins in production

## UI Conventions
- Tailwind dark mode via `dark:` prefix everywhere
- `key` props on forms force remount to reset state
- Optimistic updates with rollback on API errors in Dashboard
- Dark/light logo assets: `/images/MSA_main_clear.png`, `/images/White_Clear.png`

## API Quick Reference
- Dashboard (filtered): `GET /api/dashboard`
- Batch users: `POST /api/users/batch` (password defaults to username)
- Export: `GET /api/export/semester/{id}`, `GET /api/export/all`
- Import: `POST /api/export/import?skip_existing=true`