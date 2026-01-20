# CMU Qatar MSA Task Tracker - AI Coding Instructions

## Architecture Overview

This is a **Semester → Week → Event → Task** hierarchy system with Discord notifications for managing MSA event rosters. Stack: FastAPI backend + React/Vite frontend + SQLite + nginx reverse proxy, all containerized.

**Deployment**: Ubuntu Server (residential laptop) via Docker Compose. Access at port 80, proxied through nginx.

### Key Patterns

- **Session-based auth** (not JWT): Uses `itsdangerous` for signed cookies. See [backend/app/middleware/auth.py](../backend/app/middleware/auth.py) for `get_current_user` and `get_admin_user` dependencies.
- **Role-based visibility**: Admins see all tasks; Members see only assigned tasks; Team members see individual + team-assigned tasks.
- **Pydantic Settings**: All config via `.env` → [backend/app/config.py](../backend/app/config.py) using `pydantic_settings`.
- **Semester Rosters**: Each semester has its own roster via `RosterMember` junction table - users must be added to a semester's roster to be assignable for that semester's tasks.
- **Dynamic Teams**: Teams are stored in DB (`teams` table), not hardcoded enums. Managed via Admin Panel.

### Task Assignment Model

Tasks can be assigned in three ways:
1. `assigned_to`: Individual user ID (one person responsible)
2. `assigned_team_id`: Team FK - any team member can mark done
3. `assigned_user_ids`: Multi-user pool via `TaskAssignment` junction table - any member in pool can complete

The `completed_by` field tracks who actually completed/flagged the task.

When checking permissions in [routers/tasks.py](../backend/app/routers/tasks.py) `can_modify_task()`:
```python
if task.assigned_team_id and user.team_id == task.assigned_team_id:
    return True  # Any team member can modify
# Also checks TaskAssignment pool
```

### Task Types

| Type | Behavior |
|------|----------|
| `STANDARD` | Must be marked 'Done' - requires completion |
| `SETUP` | Informational only - related to event setup, no completion required |

### Task Status Flow

`PENDING` → `DONE` (task completed)
`PENDING` → `CANNOT_DO` (blocked - triggers admin alert with reason)
`DONE` / `CANNOT_DO` → `PENDING` (undo via `PATCH /tasks/{id}/undo`)

### Backend Structure

```
backend/app/
├── models/      # SQLAlchemy 2.0 ORM models
│   ├── team.py           # Dynamic Team model (name, color)
│   ├── task_assignment.py # Multi-user pool junction table
│   └── roster.py         # RosterMember - links users to semesters
├── schemas/     # Pydantic v2 schemas (TaskCreate, TaskOut, etc.)
├── routers/     # FastAPI routers - each prefixed with /api
│   ├── teams.py      # Team CRUD
│   ├── templates.py  # Predefined event templates
│   └── roster.py     # Semester roster management
├── services/    # discord.py (webhooks), scheduler.py (APScheduler)
├── middleware/  # auth.py (session handling, password hashing)
```

### Frontend Structure

```
frontend/src/
├── api/client.ts    # All API calls - generic request<T>() wrapper
├── types/index.ts   # TypeScript interfaces matching backend schemas
├── context/         # AuthContext with login/logout/user state
├── hooks/           # useAuth, useDashboard custom hooks
├── pages/           
│   ├── Dashboard.tsx  # Semester bar + week tabs + flat event cards
│   └── AdminPanel.tsx # Roster mgmt, users, batch import, templates, teams
├── components/      # Reusable UI components
```

## Development Commands

```bash
# Full stack (Docker)
docker-compose up -d --build

# Backend only (local dev)
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload  # Auto-creates SQLite DB + admin user

# Frontend only
cd frontend && npm install && npm run dev  # Runs on :5173
```

## Critical Conventions

### Backend

1. **Router dependencies**: Use `get_current_user` for auth, `get_admin_user` for admin-only endpoints.
2. **Task assignment logic**: Check `assigned_to` (user ID), `assigned_team_id` (FK), and `TaskAssignment` pool.
3. **Schema naming**: `*Create` for POST bodies, `*Update` for PUT bodies, `*Out` for responses.
4. **Model-to-schema conversion**: See `task_to_out()` in [routers/tasks.py](../backend/app/routers/tasks.py) for pattern.

### Frontend

1. **API calls**: Always use functions from [api/client.ts](../frontend/src/api/client.ts) - credentials included automatically.
2. **Types**: Keep [types/index.ts](../frontend/src/types/index.ts) in sync with backend schemas.
3. **Auth state**: Use `useAuth()` hook from AuthContext, never call API directly for auth.
4. **Form resets**: Use `key={editing?.id ?? 'new'}` on form components to force remount when editing different items.

## Special Logic

### Dashboard Filtering ([routers/dashboard.py](../backend/app/routers/dashboard.py))
- Admins: See all tasks
- Team members: `(assigned_to == user.id) OR (assigned_team_id == user.team_id) OR (in TaskAssignment pool)`
- Regular members: `assigned_to == user.id OR (in TaskAssignment pool)` only

### Event Templates ([routers/templates.py](../backend/app/routers/templates.py))
Predefined event types with auto-generated tasks:
- `jumuah` - Jumuah Prayer (5 tasks)
- `halaqa` - Weekly Halaqa (4 tasks)
- `sweet_sunday` - Sweet Sunday social (5 tasks)
- `kk` - Karak & Konversations (5 tasks)
- `email_announcement` - Weekly email (4 tasks)
- `eid_prep` - Eid Celebration (8 tasks)
- `iftar` - Community Iftar (6 tasks)
- `custom` - Custom Event (no tasks)

Usage: `POST /api/templates/create` with `template_id`, `week_id`, `datetime`, optional `location` and `event_name`.

### Semester Rosters ([routers/roster.py](../backend/app/routers/roster.py))
Each semester has its own roster of members:
- `GET /api/semesters/{id}/roster` - List roster members
- `POST /api/semesters/{id}/roster` - Add users by ID
- `POST /api/semesters/{id}/roster/add-all` - Add all non-admin users
- `DELETE /api/semesters/{id}/roster/{user_id}` - Remove from roster

### Batch User Import ([routers/users.py](../backend/app/routers/users.py))
`POST /api/users/batch` - CSV-style import:
```json
{"users": [
  {"username": "jsmith", "display_name": "John Smith", "discord_id": "123...", "role": "MEMBER", "team_id": 1}
]}
```
Password defaults to username if not provided.

### Discord Notifications ([services/discord.py](../backend/app/services/discord.py))

**No creation spam** - users are NOT notified when tasks are created.

**Automatic Day-Before Reminders** (via APScheduler hourly):
- Scheduler checks for events happening within 24 hours
- For each event with `auto_reminder_sent == False`:
  - Sends reminders to all assignees for pending standard tasks
  - Sets `auto_reminder_sent = True` to prevent duplicates
- Message format: `<@{discord_id}> 📅 **Reminder**: Event **'{event_name}'** is tomorrow! Your task: **'{title}'**`

**Admin Manual Reminders**:
- Admin can send immediate reminder via `POST /api/tasks/{id}/send-reminder`
- Pings assigned user(s) via `REMINDER_WEBHOOK_URL`

**Cannot Do Alerts** (immediate):
- Fires to `ADMIN_WEBHOOK_URL` (private admin channel) when task flagged
- Format:
```
⚠️ **Task Blocked Alert**
**User**: {display_name}
**Task**: {title}
**Event**: {event_name}
**Reason**: {reason}
```

### Startup ([main.py](../backend/app/main.py))
Uses `lifespan` context manager to:
1. Create DB tables via `Base.metadata.create_all()`
2. Auto-create admin user from env vars if not exists
3. Start APScheduler for auto reminders

## Testing Locally

No test suite configured. Verify manually:
1. Login at `http://localhost` with admin credentials from `.env`
2. Check FastAPI docs at `http://localhost/api/docs`
3. Discord webhooks only fire if URLs configured in `.env`
4. **Discord ID format**: Must be numeric (e.g., `123456789012345678`), not usernames

## Deployment Notes

- **Host**: Ubuntu Server on residential hardware
- **Persistence**: SQLite DB stored in `./data/` volume mount
- **Secrets**: All in `.env` file (see `.env.example`)
- **Rebuild**: `docker-compose up -d --build` after code changes
- **Logs**: `docker-compose logs -f backend` for API logs
