# CMU Qatar MSA Task Tracker

A lightweight task tracking system for the CMU Qatar Muslim Student Association to manage event rosters, task assignments, and team coordination.

## Features

- **Semester → Week → Event → Task** hierarchy
- **Role-based access**: Admins see everything, members see their tasks
- **Media Team**: Shared task pool for media members
- **Task Types**: Standard (completable) and Setup (informational)
- **Discord Integration**: 
  - Reminder notifications at user-specified times
  - Admin alerts when tasks are marked "Cannot Do"

## Quick Start

### Prerequisites

- Docker and Docker Compose
- A Discord server with webhook URLs

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
source venv/bin/activate
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

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Random string for session signing |
| `DATABASE_URL` | SQLite database path |
| `REMINDER_WEBHOOK_URL` | Discord webhook for task reminders |
| `ADMIN_WEBHOOK_URL` | Discord webhook for "Cannot Do" alerts |
| `ADMIN_USERNAME` | Initial admin username |
| `ADMIN_PASSWORD` | Initial admin password |
| `ADMIN_DISCORD_ID` | Admin's Discord user ID (optional) |

## Discord Webhooks

1. Go to your Discord server settings
2. Navigate to Integrations → Webhooks
3. Create two webhooks:
   - One for a general channel (reminders)
   - One for a private admin channel (alerts)
4. Copy the webhook URLs to your `.env` file

## Architecture

- **Backend**: FastAPI + SQLite + APScheduler
- **Frontend**: React + Tailwind CSS
- **Deployment**: Docker Compose + nginx

## License

MIT License - CMU Qatar MSA
