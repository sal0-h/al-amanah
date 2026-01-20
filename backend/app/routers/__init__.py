from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.semesters import router as semesters_router
from app.routers.weeks import router as weeks_router
from app.routers.events import router as events_router
from app.routers.tasks import router as tasks_router
from app.routers.dashboard import router as dashboard_router

__all__ = [
    "auth_router",
    "users_router", 
    "semesters_router",
    "weeks_router",
    "events_router",
    "tasks_router",
    "dashboard_router"
]
