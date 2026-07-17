from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # SQLite for zero-setup local MVP; override with Postgres in Docker Compose.
    database_url: str = "sqlite:///./carbontrack.db"
    secret_key: str = "dev-secret-change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"
        # Accept DATABASE_URL etc. from environment
        populate_by_name = True

    @property
    def sqlalchemy_url(self) -> str:
        return self.database_url


settings = Settings()
