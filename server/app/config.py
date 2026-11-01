"""Settings, loaded from the environment / server/.env (never committed)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=SERVER_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    mx_env: str = "dev"  # dev | test | prod
    public_url: str = "http://localhost:5174"  # origin the browser sees (vite proxies /api in dev)
    mx_port: int = 4274
    mx_db_path: str = "data/mxtape.db"

    google_client_id: str = ""
    google_client_secret: str = ""

    session_secret: str = ""
    session_ttl_hours: int = 720

    mxtape_admin_emails: str = "martinpaush@gmail.com"
    # Optional personal edition, identified only by the authenticated account.
    mxtape_martin_edition_email: str = ""

    # Dev-only fake login (hard-refused in prod) so the UI can be driven locally.
    mx_dev_login: bool = False

    # Mail: SMTP (implicit TLS) or a sendmail binary; both empty = disabled.
    sendmail_path: str = ""
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_pass: str = ""
    mail_from: str = "mxtape <support@celox.io>"
    notify_email: str = "martinpaush@gmail.com"

    # Upper bound for one stored document (history / achievements / settings).
    max_doc_bytes: int = 512 * 1024

    @property
    def admin_emails(self) -> set[str]:
        return {e.strip().lower() for e in self.mxtape_admin_emails.split(",") if e.strip()}

    @property
    def is_prod(self) -> bool:
        return self.mx_env == "prod"

    @property
    def db_path(self) -> Path:
        p = Path(self.mx_db_path)
        return p if p.is_absolute() else SERVER_DIR / p

    @property
    def oauth_redirect_uri(self) -> str:
        return f"{self.public_url.rstrip('/')}/api/auth/callback"


@lru_cache
def get_settings() -> Settings:
    return Settings()
