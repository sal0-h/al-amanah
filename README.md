# CMU Qatar MSA Task Tracker

A lightweight task tracking system for the CMU Qatar Muslim Student Association to manage event rosters, task assignments, and team coordination.

## Features

### Core Functionality
- **Semester → Week → Event → Task** hierarchy for organized event planning
- **Role-based access**: Admins see everything, members see only assigned tasks
- **Team-based assignments**: Tasks can be assigned to individuals, teams, or groups
- **Semester rosters**: Per-semester member management

### Task Management
- **Task Types**: Standard (completable) and Setup (informational)
- **Status Tracking**: Pending → Done or Cannot Do (with reason)
- **Multi-assignment**: Assign to individual, team, or multiple people

### Templates
- **Event Templates**: Pre-configured events with tasks (Jumuah, Halaqa, Sweet Sunday, etc.)
- **Week Templates**: Pre-configured week schedules with multiple events
- **Custom Templates**: Create and manage your own event and week templates

### Discord Integration
- **Automatic Reminders**: Day-before reminders for pending tasks
- **Manual Reminders**: Admin-triggered immediate notifications
- **Cannot Do Alerts**: Instant admin notification when tasks are blocked

## Quick Start

### Prerequisites

- Docker and Docker Compose
- A Discord server with webhook URLs (optional)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd al-amanah
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start the application**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the app**
   - Open `http://localhost` in your browser
   - Login with the admin credentials from `.env`

### Development

**Backend only:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend only:**
```bash
cd frontend
npm install
npm run dev
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Random string for session signing | `change-me-in-production` |
| `DATABASE_URL` | SQLite database path | `sqlite:///./data/msa_tracker.db` |
| `REMINDER_WEBHOOK_URL` | Discord webhook for task reminders | (empty) |
| `ADMIN_WEBHOOK_URL` | Discord webhook for admin alerts | (empty) |
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | `changeme123` |
| `ADMIN_DISCORD_ID` | Admin's Discord user ID (optional) | (empty) |

### Security Notes

- **Change `SECRET_KEY`** to a random string in production (use `openssl rand -hex 32`)
- **Change `ADMIN_PASSWORD`** immediately after first login
- Session cookies are HTTP-only and expire after 7 days
- Passwords are hashed using bcrypt

## Discord Webhooks

1. Go to your Discord server settings
2. Navigate to **Integrations → Webhooks**
3. Create two webhooks:
   - One for a general channel (task reminders)
   - One for a private admin channel ("Cannot Do" alerts)
4. Copy the webhook URLs to your `.env` file

### Webhook Message Format

**Reminders:**
```
@user ⏰ Reminder: Task 'Task Title' for event 'Event Name' needs your attention!
```

**Day-Before Auto Reminders:**
```
@user 📅 Reminder: Event 'Event Name' is tomorrow! Your task: 'Task Title'
```

**Cannot Do Alerts:**
```
⚠️ Task Blocked Alert
User: Display Name
Task: Task Title
Event: Event Name
Reason: User's reason
```

## Architecture

```
├── backend/           # FastAPI + SQLAlchemy + APScheduler
│   ├── app/
│   │   ├── models/    # SQLAlchemy ORM models
│   │   ├── routers/   # API endpoints
│   │   ├── schemas/   # Pydantic validation
│   │   ├── services/  # Discord, scheduler
│   │   └── middleware/# Authentication
│   └── requirements.txt
├── frontend/          # React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── pages/     # Dashboard, AdminPanel, Login
│   │   ├── components/# Reusable UI components
│   │   └── context/   # Auth context
│   └── package.json
├── nginx/             # Reverse proxy configuration
└── docker-compose.yml
```

## API Documentation

When running, access the interactive API docs at:
- Swagger UI: `http://localhost/api/docs`
- ReDoc: `http://localhost/api/redoc`

## Admin Panel Features

- **Roster Management**: Add/remove members per semester
- **User Management**: Create, edit, batch import users
- **Team Management**: Create and organize teams with colors
- **Template Management**: Create custom event and week templates
- **Semester/Week/Event CRUD**: Full management interface

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0, SQLite
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Auth**: Session-based with itsdangerous signed cookies
- **Scheduler**: APScheduler for automated reminders
- **Deployment**: Docker Compose + nginx

## License

MIT License - CMU Qatar MSA

## Brand

- **Primary Color**: Crimson (#C4122F)
- **Accent Color**: Amber Gold (#FDB913)
- **Fonts**: Playfair Display (headings), Inter (body)
