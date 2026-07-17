from pydantic_settings import BaseSettings
import os


def _default_db() -> str:
    # Netlify / Lambda only allow writes under /tmp
    if os.environ.get("NETLIFY") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return "sqlite:////tmp/vapor.db"
    return "sqlite:///./carbontrack.db"


class Settings(BaseSettings):
    database_url: str = _default_db()
    secret_key: str = "dev-secret-change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    cors_origins: str = (
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,*"
    )

    class Config:
        env_file = ".env"
        populate_by_name = True
        extra = "ignore"

    @property
    def sqlalchemy_url(self) -> str:
        return self.database_url


settings = Settings()
