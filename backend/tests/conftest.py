"""
Pytest configuration and fixtures for MSA Task Tracker tests.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import User, Role, Team, Semester, Week, Event, Task, TaskType, TaskStatus, RosterMember
from app.middleware.auth import hash_password, create_session_token
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


# Test database - in-memory SQLite
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_test_app():
    """Create a FastAPI app for testing (no scheduler)."""
    test_app = FastAPI()
    
    # Include all routers
    test_app.include_router(auth_router)
    test_app.include_router(users_router)
    test_app.include_router(semesters_router)
    test_app.include_router(weeks_router)
    test_app.include_router(events_router)
    test_app.include_router(tasks_router)
    test_app.include_router(dashboard_router)
    test_app.include_router(templates_router)
    test_app.include_router(roster_router)
    test_app.include_router(teams_router)
    test_app.include_router(comments_router)
    test_app.include_router(audit_router)
    test_app.include_router(stats_router)
    test_app.include_router(export_router)
    
    return test_app


# Create test app once
test_app = create_test_app()


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    test_app.dependency_overrides[get_db] = override_get_db
    with TestClient(test_app) as c:
        yield c
    test_app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db_session) -> User:
    """Create an admin user."""
    user = User(
        username="admin",
        password_hash=hash_password("admin123"),
        display_name="Admin User",
        discord_id="123456789012345678",
        role=Role.ADMIN
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def member_user(db_session) -> User:
    """Create a regular member user."""
    user = User(
        username="member",
        password_hash=hash_password("member123"),
        display_name="Member User",
        discord_id="987654321098765432",
        role=Role.MEMBER
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def team(db_session) -> Team:
    """Create a test team."""
    team = Team(name="Media", color="#FF5733")
    db_session.add(team)
    db_session.commit()
    db_session.refresh(team)
    return team


@pytest.fixture
def team_member(db_session, team) -> User:
    """Create a member user assigned to a team."""
    user = User(
        username="teammember",
        password_hash=hash_password("team123"),
        display_name="Team Member",
        discord_id="111222333444555666",
        role=Role.MEMBER,
        team_id=team.id
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def semester(db_session) -> Semester:
    """Create an active semester."""
    from datetime import date, timedelta
    sem = Semester(
        name="Spring 2026",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=120),
        is_active=True
    )
    db_session.add(sem)
    db_session.commit()
    db_session.refresh(sem)
    return sem


@pytest.fixture
def week(db_session, semester) -> Week:
    """Create a week in the semester."""
    from datetime import date, timedelta
    w = Week(
        semester_id=semester.id,
        week_number=1,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=6)
    )
    db_session.add(w)
    db_session.commit()
    db_session.refresh(w)
    return w


@pytest.fixture
def event(db_session, week) -> Event:
    """Create an event in the week."""
    from datetime import datetime, timedelta
    evt = Event(
        week_id=week.id,
        name="Test Event",
        datetime=datetime.now() + timedelta(hours=24),
        location="Test Location"
    )
    db_session.add(evt)
    db_session.commit()
    db_session.refresh(evt)
    return evt


@pytest.fixture
def task(db_session, event, member_user) -> Task:
    """Create a task assigned to member_user."""
    t = Task(
        event_id=event.id,
        title="Test Task",
        description="Test description",
        task_type=TaskType.STANDARD,
        status=TaskStatus.PENDING,
        assigned_to=member_user.id
    )
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)
    return t


@pytest.fixture
def roster_member(db_session, semester, member_user) -> RosterMember:
    """Add member_user to semester roster."""
    rm = RosterMember(semester_id=semester.id, user_id=member_user.id)
    db_session.add(rm)
    db_session.commit()
    db_session.refresh(rm)
    return rm


def get_auth_cookies(user: User) -> dict:
    """Generate session cookie for authenticated requests."""
    token = create_session_token(user.id)
    return {"session": token}


@pytest.fixture
def admin_client(client, admin_user):
    """Client with admin authentication."""
    client.cookies.set("session", create_session_token(admin_user.id))
    return client


@pytest.fixture
def member_client(client, member_user):
    """Client with member authentication."""
    client.cookies.set("session", create_session_token(member_user.id))
    return client


@pytest.fixture
def team_member_client(client, team_member):
    """Client with team member authentication."""
    client.cookies.set("session", create_session_token(team_member.id))
    return client
