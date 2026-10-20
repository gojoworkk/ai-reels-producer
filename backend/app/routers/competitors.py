from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_session
from ..jobs import active_job, enqueue, log_event
from ..models import Competitor, Job, JobKind, Reel, Script
from ..schemas import CompetitorIn, CompetitorOut, JobOut
from ..services import pipeline, storage
from ..services.apify import normalize_username

router = APIRouter(prefix="/api/competitors", tags=["Конкуренты"])


def _get(session: Session, username: str) -> Competitor:
    competitor = session.scalar(select(Competitor).where(Competitor.username == username.lower()))
    if not competitor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Конкурент @{username} не найден")
    return competitor


def _out(session: Session, c: Competitor) -> CompetitorOut:
    reels_count, best = session.execute(
        select(func.count(Reel.id), func.coalesce(func.max(Reel.score), 0)).where(Reel.competitor_id == c.id)
    ).one()
    scripts = session.scalar(select(func.count(Script.id)).join(Reel).where(Reel.competitor_id == c.id))
    last = session.scalar(select(Job).where(Job.competitor_id == c.id).order_by(Job.created_at.desc()))
    active = active_job(session, competitor_id=c.id)
    return CompetitorOut(
        username=c.username,
        full_name=c.full_name,
        added_at=c.added_at,
        last_synced_at=c.last_synced_at,
        median_views=c.median_views,
        reels_count=reels_count,
        scripts_count=scripts or 0,
        best_score=best,
        active_job=JobOut.model_validate(active) if active else None,
        last_job=JobOut.model_validate(last) if last else None,
    )


def start_sync(session: Session, competitor: Competitor) -> Job:
    cid = competitor.id
    return enqueue(session, JobKind.sync_competitor, lambda p: pipeline.sync_competitor(cid, p), competitor_id=cid)


@router.get("", response_model=list[CompetitorOut])
def list_competitors(session: Session = Depends(get_session)):
    competitors = session.scalars(select(Competitor).order_by(Competitor.added_at.desc()))
    return [_out(session, c) for c in competitors]


@router.post("", response_model=CompetitorOut, status_code=status.HTTP_201_CREATED)
def add_competitor(body: CompetitorIn, session: Session = Depends(get_session)):
    username = normalize_username(body.username)
    if not username:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Введите ник или ссылку на Instagram-аккаунт")
    competitor = session.scalar(select(Competitor).where(Competitor.username == username))
    if not competitor:
        competitor = Competitor(username=username)
        session.add(competitor)
        session.flush()
        log_event(session, "competitor_added", f"Добавлен @{username}", competitor_id=competitor.id)
        session.commit()
    start_sync(session, competitor)
    return _out(session, competitor)


@router.post("/{username}/sync", response_model=JobOut)
def sync(username: str, session: Session = Depends(get_session)):
    return start_sync(session, _get(session, username))


@router.delete("/{username}", status_code=status.HTTP_204_NO_CONTENT)
def remove(username: str, session: Session = Depends(get_session)):
    competitor = _get(session, username)
    for reel_id in session.scalars(select(Reel.id).where(Reel.competitor_id == competitor.id)):
        storage.remove_reel_files(session, reel_id)
    log_event(session, "competitor_removed", f"Удалён @{competitor.username}")
    session.delete(competitor)
    session.commit()
