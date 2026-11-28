"""Runtime settings. Every secret comes from the environment (server-side .env), never from the repository."""

from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NT_", env_file=".env", extra="ignore")

    env: str = Field("development", description="development | staging | production")
    database_url: str = "postgresql+asyncpg://nt:nt@127.0.0.1:5432/nt"
    redis_url: str = "redis://127.0.0.1:6379/0"
    site_url: str = "https://nationaltours.uz"
    allowed_origins: list[str] = ["https://nationaltours.uz", "https://www.nationaltours.uz"]

    rate_limit_enabled: bool = True
    docs_enabled: bool = False

    # Bookings
    booking_hold_minutes: int = 30
    deposit_percent: int = Field(30, ge=0, le=100)

    # Accounts
    api_url: str = "https://api.nationaltours.uz"  # public address of this API (OAuth redirect URIs)
    session_cookie: str = "nt_session"
    session_days: int = 30
    cookie_domain: str | None = None  # ".nationaltours.uz" so the site and the API share the sign-in
    google_client_id: str = ""
    google_client_secret: SecretStr = SecretStr("")
    facebook_app_id: str = ""
    facebook_app_secret: SecretStr = SecretStr("")
    telegram_bot_token: SecretStr = SecretStr("")
    telegram_bot_username: str = ""

    # Payme (Merchant API). The key is the cashbox key from the Payme business cabinet.
    payme_merchant_id: str = ""
    payme_key: SecretStr = SecretStr("")
    payme_timeout_ms: int = 43_200_000  # 12 hours, as required by the Payme protocol

    # Click (SHOP API)
    click_service_id: str = ""
    click_merchant_id: str = ""
    click_secret_key: SecretStr = SecretStr("")

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
