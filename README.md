# CMU Qatar MSA Task Tracker (Al-Amanah)

A comprehensive **Semester → Week → Event → Task** hierarchy system with Discord notifications for managing MSA event rosters.

## 🏗️ Architecture

**Stack:** FastAPI backend + React/Vite frontend + SQLite + nginx reverse proxy, all containerized with Docker Compose.

**Deployment:** Ubuntu Server (residential laptop) via Docker Compose. Access at port 80, proxied through nginx.

### Key Design Patterns

- **Session-based auth** (not JWT): Uses `itsdangerous` for signed cookies
- **Role-based visibility**: Admins see all tasks; Members see only assigned tasks; Team members see individual + team-assigned tasks
- **Semester Rosters**: Each semester has its own roster via `RosterMember` junction table
- **Dynamic Teams**: Teams stored in DB, not hardcoded enums
- **Dark Mode**: Full support via Tailwind CSS `darkMode: 'class'` with ThemeContext
- **Single Active Semester**: Only one semester can be active at a time (enforced server-side)
- **Optimistic Updates**: UI updates instantly on task actions with automatic rollback on API failure

## 📁 Project Structure

```
al-amanah/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # App entry, lifespan, router registration
│       ├── config.py            # Pydantic settings from .env
│       ├── database.py          # SQLAlchemy engine & session
│       ├── middleware/
│       │   └── auth.py          # Session auth, password hashing
│       ├── models/              # SQLAlchemy 2.0 ORM models
│       │   ├── user.py          # User, Role enum
│       │   ├── team.py          # Dynamic Team model
│       │   ├── semester.py      # Semester
│       │   ├── week.py          # Week
│       │   ├── event.py         # Event
│       │   ├── task.py          # Task, TaskType, TaskStatus
│       │   ├── task_assignment.py # Multi-user pool junction
│       │   ├── roster.py        # RosterMember - users per semester
│       │   ├── comment.py       # TaskComment
│       │   ├── audit.py         # AuditLog
│       │   ├── template.py      # EventTemplate, WeekTemplate
│       │   └── __init__.py      # Model exports
│       ├── schemas/             # Pydantic v2 request/response schemas
│       ├── routers/             # FastAPI routers (14 total)
│       │   ├── auth.py          # Login, logout, me, change-password
│       │   ├── users.py         # User CRUD, batch import
│       │   ├── teams.py         # Team CRUD
│       │   ├── semesters.py     # Semester CRUD
│       │   ├── weeks.py         # Week CRUD
│       │   ├── events.py        # Event CRUD, send-all-reminders
│       │   ├── tasks.py         # Task CRUD, done/cannot-do/undo
│       │   ├── dashboard.py     # Aggregated dashboard data
│       │   ├── templates.py     # Event & Week templates
│       │   ├── roster.py        # Semester roster management
│       │   ├── comments.py      # Task comments
│       │   ├── audit.py         # Audit log queries
│       │   ├── stats.py         # Statistics & analytics
│       │   └── export.py        # Data export/import
│       └── services/
│           ├── discord.py       # Webhook notifications
│           ├── scheduler.py     # APScheduler for auto-reminders
│           └── audit.py         # Audit log helper
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js       # Dark mode: 'class'
│   └── src/
│       ├── main.tsx
│       ├── App.tsx              # Routing, theme provider
│       ├── api/
│       │   └── client.ts        # API functions with credentials
│       ├── context/
│       │   ├── AuthContext.tsx  # Auth state management
│       │   └── ThemeContext.tsx # Dark mode toggle
│       ├── pages/
│       │   ├── Dashboard.tsx    # Main task view (with EventCard, TaskRow)
│       │   ├── AdminPanel.tsx   # Full admin interface
│       │   ├── Login.tsx        # Login page
│       │   └── Statistics.tsx   # Stats & analytics
│       ├── types/
│       │   └── index.ts         # TypeScript interfaces
│       └── styles/
│           └── globals.css      # Tailwind imports
└── nginx/
    └── nginx.conf               # Reverse proxy config
```

## 🗃️ Database Models (12 total)

| Model | Description |
|-------|-------------|
| `User` | Users with role (ADMIN/MEMBER) and optional team |
| `Team` | Dynamic teams with name and color |
| `Semester` | Academic semesters with start/end dates |
| `Week` | Weeks within semesters |
| `Event` | Events within weeks (datetime, location) |
| `Task` | Tasks for events with status tracking |
| `TaskAssignment` | Multi-user task assignment pool |
| `RosterMember` | Links users to semester rosters |
| `TaskComment` | Comments on tasks |
| `AuditLog` | Action audit trail |
| `EventTemplate` | Custom event templates (DB) |
| `WeekTemplate` | Custom week templates (DB) |

## 🔌 API Endpoints Overview

All endpoints prefixed with `/api`. Authentication required unless noted.

### Core CRUD
- **Auth**: `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/change-password`
- **Users**: Full CRUD + `/users/batch` for bulk import
- **Teams**: Full CRUD at `/teams`
- **Semesters**: Full CRUD at `/semesters`
- **Weeks**: Nested under semesters
- **Events**: Nested under weeks, includes `/events/{id}/send-all-reminders`
- **Tasks**: Full CRUD + `/tasks/{id}/done`, `/tasks/{id}/cannot-do`, `/tasks/{id}/undo`, `/tasks/{id}/send-reminder`

### Special Features
- **Dashboard**: `/dashboard` - Aggregated semester/week/event/task data
- **Roster**: `/semesters/{id}/roster`, `/semesters/{id}/roster/add-all`
- **Templates**: `/templates/events`, `/templates/weeks`, `/templates/create`
- **Comments**: `/tasks/{id}/comments`
- **Audit**: `/audit` with pagination and filtering
- **Stats**: `/stats/overview`, `/stats/users`, `/stats/teams`, `/stats/activity`
- **Export**: `/export/semester/{id}`, `/export/all`, `/export/import`

## 📋 Default Event Templates

| ID | Name | Tasks |
|----|------|-------|
| `jumuah` | Jumuah Prayer | 5 tasks |
| `halaqa` | Weekly Halaqa | 4 tasks |
| `sweet_sunday` | Sweet Sunday | 5 tasks |
| `kk` | Karak & Konversations | 5 tasks |
| `email_announcement` | Weekly Email | 4 tasks |
| `eid_prep` | Eid Celebration | 8 tasks |
| `iftar` | Community Iftar | 6 tasks |
| `speaker_event` | Speaker Event | 6 tasks |
| `dine_reflect` | Dine & Reflect | 5 tasks |
| `custom` | Custom Event | 0 tasks |

## 🔔 Discord Notifications

- **Day-Before Reminders**: APScheduler runs hourly, sends reminders for events within 24 hours
- **Admin Manual Reminders**: Immediate ping via `/tasks/{id}/send-reminder` or `/events/{id}/send-all-reminders`
- **Cannot Do Alerts**: Immediate alert to admin channel when task blocked

Configure webhooks in `.env`:
```
REMINDER_WEBHOOK_URL=https://discord.com/api/webhooks/...
ADMIN_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## 🚀 Development

### Docker (Recommended)
```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f backend

# Rebuild after code changes
docker-compose up -d --build
```

### Local Development
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload  # Runs on :8000

# Frontend
cd frontend
npm install
npm run dev  # Runs on :5173
```

## ⚙️ Configuration

Copy `.env.example` to `.env` and configure:

```env
# App
SECRET_KEY=your-secure-secret-key
DEBUG=false

# Database
DATABASE_URL=sqlite:///./data/msa_tracker.db

# Discord Webhooks
REMINDER_WEBHOOK_URL=
ADMIN_WEBHOOK_URL=

# Initial Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme123
ADMIN_DISCORD_ID=
```

## 🎨 UI Features

- **Dark Mode**: Toggle in header, persists to localStorage
- **Responsive Design**: Mobile-first with Tailwind CSS
- **Optimistic Updates**: Instant UI feedback on task actions with automatic rollback on failure
- **Week Navigation**: Current week highlighted, flat event cards layout
- **Admin Panel**: Roster management, batch user import, team management, template editor
- **Statistics Dashboard**: Overview, per-user, per-team, and weekly activity charts

## 📊 Task Assignment Model

Tasks can be assigned three ways:
1. **Individual**: `assigned_to` - Single user ID
2. **Team**: `assigned_team_id` - Any team member can complete
3. **Pool**: `assigned_user_ids` via `TaskAssignment` junction - Any pool member can complete

The `completed_by` field tracks who actually completed the task.

## 🔒 Task Status Flow

```
PENDING → DONE (completed)
PENDING → CANNOT_DO (blocked - triggers admin alert)
DONE/CANNOT_DO → PENDING (undo)
```

Task types:
- `STANDARD`: Must be completed
- `SETUP`: Informational only, no completion required

## 📝 Audit Logging

All task status changes are logged:
- `TASK_DONE`: User marked task complete
- `TASK_CANNOT_DO`: User flagged task with reason
- `TASK_UNDO`: User reset task to pending

View audit logs in Admin Panel → Audit Logs tab.

## 🎨 Brand Colors

- **Crimson**: `#C4122F` - Primary accent
- **Amber Gold**: `#FDB913` - Secondary accent

---

**CMU Qatar Muslim Student Association** | Built with ❤️
