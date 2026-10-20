from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_session
from ..models import Event, Job, JobStatus
from ..schemas import EventOut, JobOut

router = APIRouter(prefix="/api", tags=["Статусы"])


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Задача не найдена")
    return job


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(active: bool = False, limit: int = 50, session: Session = Depends(get_session)):
    q = select(Job).order_by(Job.created_at.desc()).limit(min(limit, 200))
    if active:
        q = q.where(Job.status.in_((JobStatus.queued, JobStatus.running)))
    return session.scalars(q).all()


@router.get("/events", response_model=list[EventOut])
def list_events(limit: int = 50, session: Session = Depends(get_session)):
    return session.scalars(select(Event).order_by(Event.created_at.desc()).limit(min(limit, 200))).all()


health_router = APIRouter(tags=["Статусы"])


@health_router.get("/api/health")
def health(session: Session = Depends(get_session)):
    session.execute(text("select 1"))
    s = get_settings()
    return {
        "ok": True,
        "database": "postgresql",
        "apify": bool(s.apify_token),
        "anthropic": bool(s.anthropic_api_key),
        "sync_interval_hours": s.sync_interval_hours,
    }
