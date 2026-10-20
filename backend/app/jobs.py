"""Фоновые задачи и обновление статусов: прогресс загрузки и обработки пишется в таблицу jobs."""

import logging
import traceback
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .db import session_scope
from .models import Event, Job, JobKind, JobStatus, now

log = logging.getLogger("reels.jobs")

# Apify и Claude отвечают долго, поэтому задачи идут в отдельных потоках
_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="job")

ACTIVE = (JobStatus.queued, JobStatus.running)


class Progress:
    """Передаётся в задачу: сохраняет процент и текст текущего шага."""

    def __init__(self, job_id: str):
        self.job_id = job_id

    def __call__(self, percent: int, message: str) -> None:
        with session_scope() as s:
            s.execute(
                update(Job).where(Job.id == self.job_id).values(progress=max(0, min(100, percent)), message=message[:300])
            )


def log_event(session: Session, kind: str, message: str, *, level: str = "info",
              competitor_id: int | None = None, reel_id: str | None = None) -> None:
    session.add(Event(kind=kind, message=message, level=level, competitor_id=competitor_id, reel_id=reel_id))


def active_job(session: Session, *, competitor_id: int | None = None, reel_id: str | None = None) -> Job | None:
    q = select(Job).where(Job.status.in_(ACTIVE))
    q = q.where(Job.competitor_id == competitor_id) if competitor_id else q.where(Job.reel_id == reel_id)
    return session.scalar(q.order_by(Job.created_at.desc()))


def enqueue(session: Session, kind: JobKind, fn: Callable[[Progress], str],
            *, competitor_id: int | None = None, reel_id: str | None = None) -> Job:
    """Ставит задачу в очередь. Если по этому объекту задача уже идёт, возвращает её, а не дублирует."""
    if existing := active_job(session, competitor_id=competitor_id, reel_id=reel_id):
        return existing
    job = Job(kind=kind, competitor_id=competitor_id, reel_id=reel_id)
    session.add(job)
    session.commit()
    _executor.submit(_run, job.id, fn)
    return job


def _run(job_id: str, fn: Callable[[Progress], str]) -> None:
    with session_scope() as s:
        s.execute(update(Job).where(Job.id == job_id).values(status=JobStatus.running, started_at=now(), message="Начинаем"))
    try:
        result = fn(Progress(job_id))
        with session_scope() as s:
            s.execute(update(Job).where(Job.id == job_id).values(
                status=JobStatus.done, progress=100, message=result or "Готово", finished_at=now()))
    except Exception as err:  # noqa: BLE001 — любая ошибка задачи становится статусом failed
        log.error("job %s failed: %s", job_id, traceback.format_exc())
        with session_scope() as s:
            job = s.get(Job, job_id)
            if job:
                job.status = JobStatus.failed
                job.error = str(err)[:2000]
                job.message = "Ошибка"
                job.finished_at = now()
                log_event(s, f"{job.kind.value}_failed", str(err)[:500], level="error",
                          competitor_id=job.competitor_id, reel_id=job.reel_id)


def recover_interrupted() -> None:
    """Задачи, оборванные перезапуском сервера, помечаем как неудачные."""
    with session_scope() as s:
        s.execute(update(Job).where(Job.status.in_(ACTIVE)).values(
            status=JobStatus.failed, error="Сервер был перезапущен", message="Прервано", finished_at=now()))
