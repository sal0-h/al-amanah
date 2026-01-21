from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    SECRET_KEY: str = "change-me-in-production"
    DEBUG: bool = False
    
    # Deployment
    USE_HTTPS: bool = False  # Set to True in production (Cloudflare automatically does this)
    
    # Database
    DATABASE_URL: str = "sqlite:///./data/msa_tracker.db"
    
    # Discord Webhooks
    REMINDER_WEBHOOK_URL: str = ""
    ADMIN_WEBHOOK_URL: str = ""
    DISCORD_ENABLED: bool = True  # Set to False to disable all Discord notifications (testing)
    
    # Initial Admin
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme123"
    ADMIN_DISCORD_ID: str = ""
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
