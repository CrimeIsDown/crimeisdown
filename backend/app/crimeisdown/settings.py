import base64
import os
from pathlib import Path
from typing import Any

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env", extra="ignore", env_ignore_empty=True, populate_by_name=True
    )
    database_url: str = Field(default="", validation_alias="CID_DATABASE_URL")
    app_key: SecretStr = Field(default=SecretStr(""), validation_alias="APP_KEY")
    app_url: str = "http://localhost:8000"
    membership_tiers: dict[str, tuple[str, int, int, bool, bool, bool]] = Field(
        default_factory=lambda: dict(TIERS), validation_alias="CID_MEMBERSHIP_TIERS"
    )
    admin_tier_id: str = Field(
        default="demo-admin", validation_alias="CID_ADMIN_TIER_ID"
    )
    app_name: str = "CrimeIsDown"
    session_cookie: str = ""
    legacy_session_redis_url: str | None = Field(
        default=None, validation_alias="CID_LARAVEL_SESSION_REDIS_URL"
    )
    legacy_session_redis_prefix: str = Field(
        default="laravel-database-laravel-cache-",
        validation_alias="CID_LARAVEL_SESSION_REDIS_PREFIX",
    )
    legacy_cache_redis_url: str | None = Field(
        default=None, validation_alias="CID_LARAVEL_CACHE_REDIS_URL"
    )
    legacy_cache_redis_prefix: str = Field(
        default="", validation_alias="CID_LARAVEL_CACHE_REDIS_PREFIX"
    )
    session_domain: str | None = None
    session_secure_cookie: bool = True
    session_lifetime: int = 120
    session_files: Path | None = Field(
        default=None, validation_alias="CID_SESSION_FILES"
    )
    cache_files: Path | None = Field(default=None, validation_alias="CID_CACHE_FILES")
    redis_url: str = "redis://localhost:6379/1"
    cors_origins: str = "https://crimeisdown.com,https://www.crimeisdown.com,https://api.crimeisdown.com,https://transcripts.crimeisdown.com"
    patreon_authorize_url: str = "https://www.patreon.com/oauth2/authorize"
    patreon_client_id: str = ""
    patreon_client_secret: SecretStr = SecretStr("")
    patreon_redirect_uri: str = ""
    patreon_campaign_id: str = ""
    patreon_api_url: str = "https://api.patreon.com"
    meilisearch_host: str = "http://localhost:7700"
    meilisearch_hosts: str = ""
    meilisearch_key: SecretStr = SecretStr("")
    meilisearch_index: str = "calls"
    transcription_base_url: str = "http://localhost:8000"
    transcription_key: SecretStr = SecretStr("")
    google_cloud_storage_bucket: str = ""
    cache_bucket: str = ""
    google_cloud_key_file: str | None = None
    notification_transport_env: SecretStr = Field(
        default=SecretStr(""), validation_alias="CID_NOTIFICATION_TRANSPORT_ENV"
    )
    notification_configuration: Path = Path(__file__).parent / "notifications.json"
    archive_local_root: Path | None = None
    youtube_api_key: SecretStr = SecretStr("")
    cid_channel_id: str = ""
    ntfy_token: SecretStr = SecretStr("")
    ntfy_domain: str = ""
    mailgun_domain: str = ""
    mailgun_secret: SecretStr = SecretStr("")
    aws_access_key_id: SecretStr = SecretStr("")
    aws_secret_access_key: SecretStr = SecretStr("")
    aws_default_region: str = "us-east-1"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_tls: bool = True
    smtp_ssl: bool = False
    emails_from_email: str = "notifications@crimeisdown.com"
    frontend_dir: Path = Path(__file__).parents[1] / "frontend"

    @model_validator(mode="after")
    def default_cookie(self) -> Settings:
        import re

        if not self.session_cookie:
            self.session_cookie = (
                re.sub(r"[^a-z0-9]+", "-", self.app_name.lower()).strip("-")
                + "-session"
            )
        return self

    def connection_url(self) -> str:
        if self.database_url:
            return self.database_url
        from sqlalchemy import URL

        return URL.create(
            "mysql+pymysql",
            username=os.environ.get("DB_USERNAME", "crimeisdown"),
            password=os.environ.get("DB_PASSWORD", ""),
            host=os.environ.get("DB_HOST", "localhost"),
            port=int(os.environ.get("DB_PORT", "3306")),
            database=os.environ.get("DB_DATABASE", "crimeisdown"),
        ).render_as_string(hide_password=False)

    def encryption_key(self) -> bytes:
        value = self.app_key.get_secret_value()
        key = (
            base64.b64decode(value[7:])
            if value.startswith("base64:")
            else value.encode()
        )
        if len(key) != 32:
            raise ValueError("APP_KEY must be the existing Laravel 32-byte AES-256 key")
        return key


TIERS = {
    "demo-enthusiast": ("Scanner Enthusiast", 1, 10, False, False, False),
    "demo-sergeant": ("Sergeant", 5, 20, True, False, False),
    "demo-lieutenant": ("Lieutenant", 10, 30, True, True, False),
    "demo-captain": ("Captain", 20, 50, True, True, True),
    "demo-commander": ("Commander", 50, 1000, True, True, True),
    "demo-chief": ("Chief", 100, 10000, True, True, True),
    "demo-admin": ("Admin", 0, 1000, True, True, True),
}


def tier_details(tier_id: Any, tiers: Any = None) -> Any:
    values = (TIERS if tiers is None else tiers).get(str(tier_id))
    if not values:
        return None
    name, rate, downloads, search, notifications, geo = values
    return {
        "name": name,
        "rate": rate,
        "features": {
            "archive_downloads": downloads,
            "transcript_search": search,
            "transcript_notifications": notifications,
            "transcript_geosearch": geo,
        },
    }
