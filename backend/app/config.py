"""Runtime settings. Every secret comes from the environment (server-side .env), never from the repository."""

from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NT_", env_file=".env", extra="ignore")

    env: str = Field("development", description="development | staging | production")
    database_url: str = "postgresql+asyncpg://nt:nt@127.0.0.1:5432/nt"
    redis_url: str = "redis://127.0.0.1:6379/0"
    site_url: str = "https://gulistantravel.uz"
    allowed_origins: list[str] = ["https://gulistantravel.uz", "https://www.gulistantravel.uz"]

    rate_limit_enabled: bool = True
    docs_enabled: bool = False

    # Bookings
    booking_hold_minutes: int = 30
    deposit_percent: int = Field(30, ge=0, le=100)

    # Fernet key for secrets kept in the database (2FA seeds). Generate once:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    secret_key: SecretStr = SecretStr("")

    # Accounts
    api_url: str = "https://api.gulistantravel.uz"  # public address of this API (OAuth redirect URIs)
    session_cookie: str = "nt_session"
    session_days: int = 30
    cookie_domain: str | None = None  # ".gulistantravel.uz" so the site and the API share the sign-in
    google_client_id: str = ""
    google_client_secret: SecretStr = SecretStr("")
    facebook_app_id: str = ""
    facebook_app_secret: SecretStr = SecretStr("")
    telegram_bot_token: SecretStr = SecretStr("")
    telegram_bot_username: str = ""

    # Email through Google Workspace (smtp.gmail.com, STARTTLS) with an app password of the sending mailbox
    # One API runs per brand (Gulistan Travel, National Tours), each with its own database and .env.
    brand_name: str = "Gulistan Travel"
    booking_prefix: str = Field("GT", pattern=r"^[A-Z]{2,3}$")  # GT-XXXXXXXX on tickets and payment pages
    request_prefix: str = Field("GS", pattern=r"^[A-Z]{2,3}$")  # service requests
    mail_from: str = "no-reply@gulistantravel.uz"
    mail_reply_to: str = "info@gulistantravel.uz"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")

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
