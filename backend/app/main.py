"""Reels Finder API: FastAPI-сервер между интерфейсом, PostgreSQL и файловым хранилищем."""

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from . import models  # noqa: F401 — регистрирует таблицы в Base.metadata
from .auth import require_token
from .config import get_settings
from .db import Base, engine, session_scope
from .jobs import recover_interrupted
from .routers import competitors, reels, system
from .services import storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("reels")


def scheduled_sync() -> None:
    """Расписание: раз в N часов обновляем всех конкурентов через Apify."""
    with session_scope() as s:
        for competitor in s.scalars(select(models.Competitor)):
            competitors.start_sync(s, competitor)
    log.info("Плановое обновление конкурентов запущено")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    Base.metadata.create_all(engine)
    storage.ensure_dirs()
    recover_interrupted()

    scheduler = BackgroundScheduler(timezone="UTC")
    if settings.sync_interval_hours > 0 and settings.apify_token:
        scheduler.add_job(scheduled_sync, "interval", hours=settings.sync_interval_hours, id="sync")
        scheduler.start()
        log.info("Автообновление конкурентов каждые %s ч", settings.sync_interval_hours)
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(title="Reels Finder API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

protected = [Depends(require_token)]
app.include_router(system.health_router)
app.include_router(competitors.router, dependencies=protected)
app.include_router(reels.router, dependencies=protected)
app.include_router(system.router, dependencies=protected)

# Обложки, видео, кадры и экспорты отдаются как статика
storage.ensure_dirs()
app.mount("/media", StaticFiles(directory=get_settings().storage_dir), name="media")
