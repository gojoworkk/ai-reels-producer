from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://reels@127.0.0.1:5433/reels"

    # Ключи внешних сервисов
    apify_token: str = ""
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"

    # Токен, которым front-end подписывает запросы к API. Пусто — проверка выключена.
    api_token: str = ""

    # Адрес бэкенда, по которому браузер открывает файлы из хранилища
    public_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"

    storage_dir: Path = BACKEND_DIR / "storage"

    reels_per_competitor: int = 20
    # Автообновление конкурентов через Apify. 0 — выключено.
    sync_interval_hours: float = 24
    download_videos: bool = True
    preview_frames: int = 3


@lru_cache
def get_settings() -> Settings:
    return Settings()
