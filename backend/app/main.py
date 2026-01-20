from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.database import Base, engine, SessionLocal
from app.config import get_settings
from app.models import User, Role
from app.middleware.auth import hash_password
from app.services.scheduler import start_scheduler, stop_scheduler
from app.routers import (
    auth_router,
    users_router,
    semesters_router,
    weeks_router,
    events_router,
    tasks_router,
    dashboard_router,
    templates_router,
    roster_router,
    teams_router,
    comments_router,
    audit_router,
    stats_router,
    export_router
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


def init_db():
    """Initialize database tables and create admin user if needed."""
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if admin exists
        admin = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
        if not admin:
            admin = User(
                username=settings.ADMIN_USERNAME,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                display_name="Admin",
                discord_id=settings.ADMIN_DISCORD_ID or None,
                role=Role.ADMIN
            )
            db.add(admin)
            db.commit()
            logger.info(f"Created admin user: {settings.ADMIN_USERNAME}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    init_db()
    start_scheduler()
    yield
    # Shutdown
    logger.info("Shutting down...")
    stop_scheduler()


app = FastAPI(
    title="MSA Task Tracker",
    description="CMU Qatar Muslim Student Association Task Tracker",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware (for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(semesters_router)
app.include_router(weeks_router)
app.include_router(events_router)
app.include_router(tasks_router)
app.include_router(dashboard_router)
app.include_router(templates_router)
app.include_router(roster_router)
app.include_router(teams_router)
app.include_router(comments_router)
app.include_router(audit_router)
app.include_router(stats_router)
app.include_router(export_router)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
