from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.semesters import router as semesters_router
from app.routers.weeks import router as weeks_router
from app.routers.events import router as events_router
from app.routers.tasks import router as tasks_router
from app.routers.dashboard import router as dashboard_router
from app.routers.templates import router as templates_router
from app.routers.roster import router as roster_router
from app.routers.teams import router as teams_router
from app.routers.comments import router as comments_router
from app.routers.audit import router as audit_router
from app.routers.stats import router as stats_router
from app.routers.export import router as export_router

__all__ = [
    "auth_router",
    "users_router", 
    "semesters_router",
    "weeks_router",
    "events_router",
    "tasks_router",
    "dashboard_router",
    "templates_router",
    "roster_router",
    "teams_router",
    "comments_router",
    "audit_router",
    "stats_router",
    "export_router"
]
