# CMU Qatar MSA Task Tracker - AI Coding Instructions

## Architecture Overview

**Semester → Week → Event → Task** hierarchy with Discord notifications. Stack: FastAPI + React/Vite + SQLite + nginx, containerized via Docker Compose.

### Critical Data Model (Discovered, not aspirational)

**Hierarchy**: Semester (single active) → Week (by semester) → Event (by week) → Task (by event)
- **Single Active Semester Pattern**: Only one `is_active=True` enforced in [routers/semesters.py](../backend/app/routers/semesters.py) - auto-deactivates others
- **Roster Membership**: Users must exist in `RosterMember` junction table per semester to be assignable/visible (access control layer)
- **Three Task Assignment Models** (all co-exist, checked in order in `can_modify_task()`):
  1. `assigned_to` (int): Single user directly responsible
  2. `assigned_team_id` (int): Any team member in `users.team_id` can complete
  3. `TaskAssignment` pool: Multi-user via junction table - any member in pool can act
- **Task Status Flow**: `PENDING` → `DONE` OR `CANNOT_DO` (blocks and alerts admins) → `PENDING` (undo)
- **Task Types**: `STANDARD` (requires completion) vs `SETUP` (informational only - no done required)

### Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env - set SECRET_KEY, Discord webhooks, admin credentials

# 3. Start full stack
docker-compose up -d --build

# 4. Access at http://localhost (nginx proxy)
# API docs: http://localhost/api/docs
```

### Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Crimson** | `#C4122F` | Primary brand color, buttons, active states |
| **Gold** | `#FDB913` | Accent color, highlights, current week indicator |

Tailwind config maps these to `primary-*` and `accent-*` color scales.

## Authentication & Authorization Patterns

### Session-Based Auth (Not JWT)
- Uses `itsdangerous` signed cookies (7-day max age)
- **Dependencies**: `get_current_user` (any authenticated user), `get_admin_user` (admin only)
- See [middleware/auth.py](../backend/app/middleware/auth.py) for token creation/verification
- Frontend must set `credentials: 'include'` in API calls (already in [api/client.ts](../frontend/src/api/client.ts))

### Role-Based Visibility
- **Admins**: See all tasks across all events
- **Team Members**: See `assigned_to` (them) + `assigned_team_id` (their team) + multi-user pool
- **Regular Members**: See only `assigned_to` (them) + multi-user pool
- **Non-Roster Users**: See empty dashboard even if active semester exists
- Filtering in [routers/dashboard.py](../backend/app/routers/dashboard.py) - must check all 3 assignment types

### Key Permissions Pattern
```python
def can_modify_task(task: Task, user: User, db: Session) -> bool:
    """Check all 3 assignment types."""
    if user.role == Role.ADMIN:
        return True
    if task.assigned_to == user.id:
        return True
    if task.assigned_team_id and user.team_id == task.assigned_team_id:
        return True
    # Multi-user pool check
    assignment = db.query(TaskAssignment).filter(
        TaskAssignment.task_id == task.id,
        TaskAssignment.user_id == user.id
    ).first()
    return assignment is not None
```

## Critical Patterns & Conventions

### Key Patterns

- **Session auth** (not JWT): `itsdangerous` signed cookies. See `get_current_user`/`get_admin_user` in [middleware/auth.py](../backend/app/middleware/auth.py).
- **Role visibility**: Admins see all; Members see assigned only; Team members see individual + team tasks.
- **Single active semester**: Only one semester can be `is_active=True` - enforced in [routers/semesters.py](../backend/app/routers/semesters.py).
- **Semester rosters**: Users must be in `RosterMember` junction to be assignable for that semester.
- **Dynamic teams**: Stored in DB (`teams` table), not enums.
- **Optimistic UI updates**: Frontend updates instantly, rolls back on API failure. See `updateTaskOptimistically()` in [Dashboard.tsx](../frontend/src/pages/Dashboard.tsx).
- **Dark mode**: Tailwind `darkMode: 'class'` with ThemeContext. All components must include `dark:` variants.

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
├── models/           # SQLAlchemy 2.0 ORM (12 models) - enums stored as strings
├── schemas/          # Pydantic v2: *Create, *Update, *Out naming (strict separation)
├── routers/          # 14 routers, all /api prefixed, each ~200-400 lines
│   └── Key: tasks.py (assignment logic), dashboard.py (filtering), templates.py (hardcoded+DB)
├── services/         # discord.py (webhooks), scheduler.py (async APScheduler), audit.py (logging)
├── middleware/       # auth.py (session cookies, password hashing), CORS (Cloudflare-aware)
└── database.py       # SQLite, creates all tables on startup
```

### Data Transformation Pattern: `*_to_out()` Functions
All routers use explicit conversion functions to transform ORM models to Pydantic schemas:
```python
def task_to_out(task: Task, db: Session) -> TaskOut:
    """Convert Task ORM to output schema, resolving assignee info from 3 sources."""
    assignee_name = None
    assignees = []
    # Check assigned_to user
    if task.assigned_to:
        user = db.query(User).filter(User.id == task.assigned_to).first()
        if user:
            assignees.append(AssigneeInfo(id=user.id, display_name=user.display_name))
    # Check assigned_team_id members
    if task.assigned_team_id:
        team_users = db.query(User).filter(User.team_id == task.assigned_team_id).all()
        for u in team_users:
            if not any(a.id == u.id for a in assignees):
                assignees.append(AssigneeInfo(...))
    # Check multi-user pool
    for assignment in task.assignments:
        # Add from pool...
```
This pattern is repeated in [routers/tasks.py](../backend/app/routers/tasks.py), [routers/dashboard.py](../backend/app/routers/dashboard.py), [routers/users.py](../backend/app/routers/users.py).

### Frontend Structure

```
frontend/src/
├── api/client.ts     # All API calls - generic request<T>() wrapper with credentials: 'include'
├── types/index.ts    # TypeScript interfaces (MUST sync with backend Pydantic models)
├── context/          # AuthContext (login/logout/user state), ThemeContext (dark mode)
├── components/       # ThemeToggle.tsx (shared reusable)
├── pages/
│   ├── Dashboard.tsx  # Main view - INLINE EventCard & TaskRow (memo'd for perf)
│   ├── AdminPanel.tsx # All admin tabs in single file (semesters, events, users, etc.)
│   ├── Statistics.tsx # Charts via Chart.js
│   └── Login.tsx
└── utils/            # dateFormat.ts (UTC+3 Qatar timezone handling)
```

**Important**: EventCard and TaskRow are defined INLINE in Dashboard.tsx with `React.memo()` to prevent re-renders on parent updates. Do NOT move them to separate files without removing memoization.

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

1. **Router deps**: `get_current_user` for auth, `get_admin_user` for admin-only.
2. **Task permissions**: Check all 3 assignment types in `can_modify_task()` - see [tasks.py](../backend/app/routers/tasks.py).
3. **Audit logging**: Call `log_action()` from `services/audit.py` for user-initiated changes (task done/cannot-do/undo).
4. **Schema naming**: `*Create`, `*Update`, `*Out` pattern consistently.

### Frontend

1. **API calls**: Always via [client.ts](../frontend/src/api/client.ts) - credentials included.
2. **Optimistic updates**: Update UI immediately, rollback on failure:
   ```typescript
   updateTask(id, { status: 'DONE' });  // Instant UI
   try { await api.markTaskDone(id); }
   catch { updateTask(id, { status: 'PENDING' }); }  // Rollback
   ```
3. **Dark mode**: All new UI must include `dark:` Tailwind classes.
4. **Performance**: Wrap list items with `React.memo()` (see EventCard, TaskRow).
5. **Form resets**: Use `key={editing?.id ?? 'new'}` to force remount.

## Special Logic

### Dashboard Filtering ([routers/dashboard.py](../backend/app/routers/dashboard.py))
- Admins: See all tasks
- Team members: `(assigned_to == user.id) OR (assigned_team_id == user.team_id) OR (in TaskAssignment pool)`
- Regular members: `assigned_to == user.id OR (in TaskAssignment pool)` only

### Event Templates ([routers/templates.py](../backend/app/routers/templates.py))

Hardcoded defaults + custom DB templates (prefixed `db_`):
- `jumuah`, `halaqa`, `sweet_sunday`, `kk`, `email_announcement`, `eid_prep`, `iftar`, `speaker_event`, `dine_reflect`, `custom`

Week templates bundle multiple events with day/time defaults.

Usage: `POST /api/templates/create` with `template_id`, `week_id`, `datetime`.

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

- **Auto reminders**: APScheduler hourly checks events within 24hrs, sends once via `auto_reminder_sent` flag.
- **Manual reminders**: `POST /tasks/{id}/send-reminder` or `POST /events/{id}/send-all-reminders` (admin).
- **Cannot Do alerts**: Immediate webhook to `ADMIN_WEBHOOK_URL` with reason.

## Development

```bash
# Full stack (Docker) - primary method
docker-compose up -d --build

# View logs
docker-compose logs -f backend
docker-compose logs -f nginx

# Stop services
docker-compose down

# Local backend dev (without Docker)
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload  # Auto-creates SQLite DB + admin user at startup

# Local frontend dev
cd frontend
npm install
npm run dev  # Vite dev server on :5173

# Testing
cd backend && pytest                    # Run all backend tests
cd backend && pytest -v tests/test_tasks.py  # Run specific test file
cd frontend && npm test                 # Run frontend tests
cd frontend && npm run test:coverage    # With coverage report

# Cloudflare Deployment (zero config needed!)
docker-compose up -d
cloudflared tunnel --url http://localhost:80  # Get free HTTPS URL instantly
# App auto-detects HTTPS and handles CORS - just use the URL!
```

### Environment Setup

Required `.env` variables (copy from `.env.example`):
- `SECRET_KEY`: Random string (32+ chars) for session signing
- `REMINDER_WEBHOOK_URL`: Discord webhook for task reminders
- `ADMIN_WEBHOOK_URL`: Discord webhook for "Cannot Do" alerts
- `ADMIN_USERNAME`/`ADMIN_PASSWORD`: Initial admin credentials (auto-created on first run)
- `ADMIN_DISCORD_ID`: Optional Discord ID for admin user

**Verify**: http://localhost (nginx) or http://localhost/api/docs (FastAPI docs)

## Testing Patterns

### Backend (pytest)

Tests use in-memory SQLite with fresh DB per test. Key fixtures in [conftest.py](../backend/tests/conftest.py):
- `client`: TestClient with all routers
- `admin_user`/`admin_headers`: Pre-authenticated admin
- `member_user`/`member_headers`: Regular member
- `test_semester`/`test_week`/`test_event`: Hierarchy fixtures

**Critical**: All fixtures auto-add users to roster for that semester:
```python
@pytest.fixture
def roster_member(db_session, semester, member_user) -> RosterMember:
    """Add member_user to semester roster."""
    rm = RosterMember(semester_id=semester.id, user_id=member_user.id)
    db_session.add(rm)
    db_session.commit()
    return rm
```

Example test pattern:
```python
def test_mark_task_done(client, admin_headers, test_task):
    response = client.patch(f"/api/tasks/{test_task.id}/done", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "DONE"
```

### Frontend (Vitest + React Testing Library)

Tests in `frontend/tests/` using jsdom environment. Mock API calls via `vi.mock('../api/client')`.

Example:
```typescript
test('renders dashboard with events', async () => {
  vi.mocked(api.getDashboard).mockResolvedValue(mockData);
  render(<Dashboard />);
  expect(await screen.findByText('Week 1')).toBeInTheDocument();
});
```

## Key Gotchas

- **Discord IDs**: Must be numeric (`123456789012345678`), not usernames.
- **SQLite persistence**: `./data/` volume mount - don't delete or DB resets.
- **Admin auto-created**: From `ADMIN_USERNAME`/`ADMIN_PASSWORD` in `.env` on first run.
- **Port conflicts**: nginx uses port 80 - ensure it's free before starting.
- **Session cookies**: Frontend must use `credentials: 'include'` in all API calls (already configured in [client.ts](../frontend/src/api/client.ts)).
- **Dark mode classes**: Every new component needs `dark:` variants for text, backgrounds, borders.
- **Task assignment changes**: Editing `assigned_to` or `assigned_team_id` automatically resets task status to `PENDING`.

## API Reference

### Auth (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/login` | None | Login with username/password |
| POST | `/logout` | User | Clear session |
| GET | `/me` | User | Get current user |
| POST | `/change-password` | User | Change own password |

### Dashboard (`/api/dashboard`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | User | Get filtered dashboard data |

### Semesters (`/api/semesters`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | User | List all semesters |
| POST | `/` | Admin | Create semester |
| PUT | `/{id}` | Admin | Update semester |
| DELETE | `/{id}` | Admin | Delete semester |

### Weeks (`/api/weeks`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/semesters/{id}/weeks` | User | List weeks in semester |
| POST | `/semesters/{id}/weeks` | Admin | Create week |
| PUT | `/{id}` | Admin | Update week |
| DELETE | `/{id}` | Admin | Delete week |

### Events (`/api/events`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/weeks/{id}/events` | User | List events in week |
| POST | `/weeks/{id}/events` | Admin | Create event |
| PUT | `/{id}` | Admin | Update event |
| DELETE | `/{id}` | Admin | Delete event |
| POST | `/{id}/send-all-reminders` | Admin | Send reminders for all pending tasks |

### Tasks (`/api/tasks`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/events/{id}/tasks` | User | List tasks for event |
| POST | `/events/{id}/tasks` | Admin | Create task |
| PUT | `/{id}` | Admin | Update task |
| DELETE | `/{id}` | Admin | Delete task |
| PATCH | `/{id}/done` | Assignee | Mark task done |
| PATCH | `/{id}/cannot-do` | Assignee | Mark cannot complete (with reason) |
| PATCH | `/{id}/undo` | Assignee | Undo status to PENDING |
| POST | `/{id}/send-reminder` | Admin | Send Discord reminder |

### Users (`/api/users`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Admin | List all users |
| POST | `/` | Admin | Create user |
| PUT | `/{id}` | Admin | Update user |
| DELETE | `/{id}` | Admin | Delete user |
| POST | `/batch` | Admin | Batch create users |

### Teams (`/api/teams`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Admin | List all teams |
| POST | `/` | Admin | Create team |
| PUT | `/{id}` | Admin | Update team |
| DELETE | `/{id}` | Admin | Delete team |

### Roster (`/api/semesters/{id}/roster`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Admin | List roster members |
| POST | `/` | Admin | Add users by ID array |
| POST | `/add-all` | Admin | Add all non-admin users |
| DELETE | `/{user_id}` | Admin | Remove user from roster |
| GET | `/../available-users` | Admin | List users not in roster |

### Templates (`/api/templates`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/events` | Admin | List event templates |
| POST | `/events` | Admin | Create custom event template |
| PUT | `/events/{id}` | Admin | Update event template |
| DELETE | `/events/{id}` | Admin | Delete event template |
| GET | `/weeks` | Admin | List week templates |
| POST | `/weeks` | Admin | Create week template |
| POST | `/create` | Admin | Create event from template |
| POST | `/weeks/create` | Admin | Create events from week template |

### Statistics (`/api/stats`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/active-semester` | User | Get active semester info |
| GET | `/overview` | User | Overall completion stats |
| GET | `/users` | User | Per-user completion stats |
| GET | `/teams` | User | Per-team completion stats |
| GET | `/semesters` | User | Per-semester stats |
| GET | `/activity` | User | Weekly activity for semester |

### Audit (`/api/audit`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Admin | Paginated audit logs |
| GET | `/actions` | Admin | Available action types |
| GET | `/entities` | Admin | Available entity types |

### Comments (`/api/tasks/{id}/comments`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | User | List comments on task |
| POST | `/` | User | Add comment |
| DELETE | `/{comment_id}` | Admin/Author | Delete comment |

### Export/Import (`/api/export`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/semester/{id}` | Admin | Export single semester |
| GET | `/all` | Admin | Export all data |
| POST | `/import` | Admin | Import data (skip_existing param) |
## Critical Implementation Details

### Scheduler & Timezones
- **Qatar Timezone (UTC+3)**: Used in [services/scheduler.py](../backend/app/services/scheduler.py) for all time comparisons
- **APScheduler**: Runs async tasks hourly - checks for events 24hrs ahead, sends auto-reminders once via `auto_reminder_sent` flag
- **Daemon Pattern**: Started in `@app.lifespan` context manager (main.py lines 70+)

### Discord Integration Points
- Webhooks configured via `.env` (`REMINDER_WEBHOOK_URL`, `ADMIN_WEBHOOK_URL`)
- Mentions use Discord ID format: `<@123456789012345678>` (numeric only, no usernames)
- All Discord sends are async and fail silently (logged but don't crash request)
- Tests set `DISCORD_ENABLED=False` in config to skip actual webhook calls

### CORS & Cloudflare
- **Dev**: `get_allowed_origins()` returns localhost origins
- **Production**: Accepts any HTTPS origin (safe because Cloudflare tunnel enforces HTTPS)
- Smart detection: If `DEBUG=False` and request has `cf-connecting-ip` header, treat as Cloudflare-proxied

### Email & Reminders
- **Auto Reminders**: APScheduler job runs hourly, sends 1x per task when event is within 24hrs
- **Manual Reminders**: Admin can trigger via `POST /tasks/{id}/send-reminder` or `POST /events/{id}/send-all-reminders`
- **Cannot Do Alerts**: Immediate Discord webhook to admins when user marks task impossible

### Assignment Resolution Order
When building task UI/API responses:
1. Check `assigned_to` (single user)
2. Check `assigned_team_id` (fetch all team members)
3. Iterate `task.assignments` (TaskAssignment table)
4. Build deduplicated `assignees` list (avoid duplicate IDs)
5. Set `assignee_name` based on count: single user name → team name → "{N} people"

See `task_to_out()` in [routers/tasks.py](../backend/app/routers/tasks.py) for canonical implementation.