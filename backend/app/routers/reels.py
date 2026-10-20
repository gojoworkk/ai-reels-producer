from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_session
from ..jobs import active_job, enqueue, log_event
from ..models import Comment, Competitor, Job, JobKind, MediaKind, Reel, Script, ScriptBlock, Section, now
from ..schemas import (
    CommentIn,
    CommentOut,
    JobOut,
    ReelDetail,
    ReelOut,
    ScriptOut,
    ScriptPatch,
    reel_out,
    script_out,
)
from ..services import exporter, pipeline, storage
from ..services.storage import public_url

router = APIRouter(prefix="/api", tags=["Рилсы"])

LOAD = (
    selectinload(Reel.competitor),
    selectinload(Reel.script).selectinload(Script.blocks),
    selectinload(Reel.tags),
    selectinload(Reel.media),
)


def ranked(session: Session) -> list[Reel]:
    """Рейтинг: сначала те, кто сильнее всего обогнал медиану своего аккаунта."""
    return list(session.scalars(select(Reel).options(*LOAD).order_by(Reel.score.desc(), Reel.views.desc())))


def _get(session: Session, reel_id: str) -> Reel:
    reel = session.scalar(select(Reel).options(*LOAD, selectinload(Reel.comments)).where(Reel.id == reel_id))
    if not reel:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Рилс не найден")
    return reel


@router.get("/reels", response_model=list[ReelOut])
def list_reels(account: str | None = None, session: Session = Depends(get_session)):
    reels = [r for r in ranked(session) if not account or r.competitor.username == account.lower()]
    jobs = {j.reel_id: j for j in session.scalars(select(Job).where(Job.reel_id.is_not(None), Job.status.in_(("queued", "running"))))}
    return [reel_out(r, i, jobs.get(r.id)) for i, r in enumerate(reels, start=1)]


@router.get("/reels/{reel_id}", response_model=ReelDetail)
def get_reel(reel_id: str, session: Session = Depends(get_session)):
    reel = _get(session, reel_id)
    all_ids = [r.id for r in ranked(session)]
    base = reel_out(reel, all_ids.index(reel.id) + 1, active_job(session, reel_id=reel.id))
    previews = sorted((m for m in reel.media if m.kind == MediaKind.preview), key=lambda m: m.position)
    return ReelDetail(
        **base.model_dump(),
        total=len(all_ids),
        transcript=reel.transcript,
        previews=[public_url(m.path) for m in previews],
        script=script_out(reel),
        comments_list=[CommentOut.model_validate(c) for c in reel.comments],
    )


@router.delete("/reels/{reel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reel(reel_id: str, session: Session = Depends(get_session)):
    reel = _get(session, reel_id)
    storage.remove_reel_files(session, reel.id)
    log_event(session, "reel_removed", f"Удалён рилс {reel.id}", competitor_id=reel.competitor_id)
    session.delete(reel)
    session.commit()


@router.post("/reels/{reel_id}/script", response_model=JobOut)
def generate(reel_id: str, session: Session = Depends(get_session)):
    """Создать сценарий или сделать Remix — новую версию поверх старой."""
    reel = _get(session, reel_id)
    rid = reel.id
    return enqueue(session, JobKind.generate_script, lambda p: pipeline.generate_script(rid, p), reel_id=rid)


@router.patch("/reels/{reel_id}/script", response_model=ScriptOut)
def edit_script(reel_id: str, patch: ScriptPatch, session: Session = Depends(get_session)):
    reel = _get(session, reel_id)
    s = reel.script
    if not s:
        raise HTTPException(status.HTTP_409_CONFLICT, "Сначала создайте сценарий")

    for field in ("title", "idea", "why_it_works", "caption"):
        if (value := getattr(patch, field)) is not None:
            setattr(s, field, value.strip() if field == "title" else value)

    def replace(section: Section, blocks) -> None:
        s.blocks = [b for b in s.blocks if b.section != section] + [
            ScriptBlock(section=section, position=i, label=b.label.strip(), text=b.text, visual=b.visual)
            for i, b in enumerate(blocks)
        ]

    if patch.hook is not None:
        replace(Section.hook, [patch.hook])
    if patch.body is not None:
        replace(Section.body, patch.body)
    if patch.cta is not None:
        replace(Section.cta, [patch.cta])
    if patch.tags is not None:
        reel.tags = pipeline.get_or_create_tags(session, patch.tags)

    s.edited_at = now()
    session.commit()
    session.refresh(reel)
    return script_out(_get(session, reel_id))


@router.post("/reels/{reel_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(reel_id: str, body: CommentIn, session: Session = Depends(get_session)):
    reel = _get(session, reel_id)
    comment = Comment(reel_id=reel.id, section=body.section, text=body.text.strip(), author=body.author.strip() or "Я")
    session.add(comment)
    session.commit()
    return comment


@router.delete("/reels/{reel_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(reel_id: str, comment_id: str, session: Session = Depends(get_session)):
    comment = session.get(Comment, comment_id)
    if comment and comment.reel_id == reel_id:
        session.delete(comment)
        session.commit()


@router.get("/reels/{reel_id}/export")
def export_script(reel_id: str, format: Literal["md", "txt", "pdf"] = Query("md"), session: Session = Depends(get_session)):
    reel = _get(session, reel_id)
    if not reel.script:
        raise HTTPException(status.HTTP_409_CONFLICT, "Сценария ещё нет")
    if format == "pdf":
        data, mime = exporter.script_pdf(reel), "application/pdf"
    else:
        data = exporter.script_text(reel, md=format == "md").encode("utf-8")
        mime = "text/markdown" if format == "md" else "text/plain"
    filename = f"{reel.id}.{format}"
    storage.save_export(session, reel.id, filename, data)
    session.commit()
    return Response(data, media_type=f"{mime}; charset=utf-8" if format != "pdf" else mime,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/export/reels.csv")
def export_csv(account: str | None = None, session: Session = Depends(get_session)):
    reels = [r for r in ranked(session) if not account or r.competitor.username == account.lower()]
    data = exporter.reels_csv(reels)
    storage.save_export(session, None, "reels.csv", data)
    session.commit()
    return Response(data, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="reels.csv"'})


@router.get("/accounts", response_model=list[str])
def accounts(session: Session = Depends(get_session)):
    return list(session.scalars(select(Competitor.username).order_by(Competitor.username)))
