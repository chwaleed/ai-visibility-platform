import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///dev.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    )
    RATELIMIT_ENABLED = os.environ.get("RATELIMIT_ENABLED", "true").lower() == "true"
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
    DATAFORSEO_LOGIN = os.environ.get("DATAFORSEO_LOGIN", "")
    DATAFORSEO_PASSWORD = os.environ.get("DATAFORSEO_PASSWORD", "")
