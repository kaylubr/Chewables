"""Application settings, centralized from environment variables.

Never call os.getenv() elsewhere — import settings from here.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str

    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "chewables"
    s3_region: str = "us-east-1"

    auth_secret: str = "dev-only-change-me-0123456789abcdef0123456789abcdef"
    auth_token_expire_minutes: int = 60 * 24 * 7

    google_client_id: str = ""
    google_client_secret: str = ""
    oauth_redirect_base: str = "http://localhost:5173"


settings = Settings()
