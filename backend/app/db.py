import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]
STORAGE = ROOT / os.environ.get("STORAGE_DIR", "storage")
for sub in ("covers", "videos"):
    (STORAGE / sub).mkdir(parents=True, exist_ok=True)

SCHEMA = """
CREATE TABLE IF NOT EXISTS competitors (
    id SERIAL PRIMARY KEY,
    handle TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',   -- idle / loading / done / error
    error TEXT,
    loaded_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS reels (
    id SERIAL PRIMARY KEY,
    competitor_id INT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    url TEXT,
    caption TEXT,
    views BIGINT NOT NULL DEFAULT 0,
    likes BIGINT NOT NULL DEFAULT 0,
    comments BIGINT NOT NULL DEFAULT 0,
    duration REAL,
    posted_at TIMESTAMPTZ,
    cover TEXT,        -- файл в storage/covers
    video_url TEXT,
    video TEXT,        -- файл в storage/videos
    hook TEXT,
    script TEXT,
    cta TEXT
);
ALTER TABLE reels ADD COLUMN IF NOT EXISTS video TEXT, ADD COLUMN IF NOT EXISTS hook TEXT,
    ADD COLUMN IF NOT EXISTS script TEXT, ADD COLUMN IF NOT EXISTS cta TEXT,
    ADD COLUMN IF NOT EXISTS transcript TEXT,
    ADD COLUMN IF NOT EXISTS remix_status TEXT NOT NULL DEFAULT 'idle',  -- idle / transcribing / writing / done / error
    ADD COLUMN IF NOT EXISTS remix_error TEXT;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


def connect():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True)


def init():
    """Создаёт базу reels (если нет) и таблицы."""
    admin_url = DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
    with psycopg.connect(admin_url, autocommit=True) as c:
        name = DATABASE_URL.rsplit("/", 1)[1]
        if not c.execute("SELECT 1 FROM pg_database WHERE datname=%s", (name,)).fetchone():
            c.execute(f'CREATE DATABASE "{name}"')
    with connect() as c:
        c.execute(SCHEMA)
        # Если сервер перезапустили посреди работы, статус не должен зависнуть
        c.execute("UPDATE competitors SET status='idle' WHERE status='loading'")
        c.execute(
            "UPDATE reels SET remix_status='error', remix_error='Прервано перезапуском сервера' "
            "WHERE remix_status IN ('transcribing','writing')"
        )
