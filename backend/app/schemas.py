"""Формат запросов и ответов REST API (JSON)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import JobKind, JobStatus, MediaKind, Reel, ReelStatus, Section
from .services.storage import public_url


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class JobOut(Out):
    id: str
    kind: JobKind
    status: JobStatus
    progress: int
    message: str
    error: str | None
    competitor_id: int | None
    reel_id: str | None
    created_at: datetime
    finished_at: datetime | None


class CompetitorOut(BaseModel):
    username: str
    full_name: str | None
    added_at: datetime
    last_synced_at: datetime | None
    median_views: float
    reels_count: int
    scripts_count: int
    best_score: float
    active_job: JobOut | None
    last_job: JobOut | None


class CompetitorIn(BaseModel):
    username: str = Field(min_length=1, max_length=200, description="Ник или ссылка на Instagram")


class BlockIO(BaseModel):
    label: str = Field(default="", max_length=200)
    text: str = Field(default="", max_length=4000)
    visual: str = Field(default="", max_length=1000)


class ScriptOut(BaseModel):
    title: str
    idea: str
    why_it_works: str
    hook: BlockIO
    body: list[BlockIO]
    cta: BlockIO
    caption: str
    tags: list[str]
    notes: dict[str, str]
    source_language: str
    version: int
    generated_at: datetime
    edited_at: datetime | None


class ScriptPatch(BaseModel):
    """Частичное обновление сценария: присылается только изменённый блок."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    idea: str | None = Field(default=None, max_length=4000)
    why_it_works: str | None = Field(default=None, max_length=4000)
    hook: BlockIO | None = None
    body: list[BlockIO] | None = Field(default=None, min_length=1, max_length=20)
    cta: BlockIO | None = None
    caption: str | None = Field(default=None, max_length=4000)
    tags: list[str] | None = Field(default=None, max_length=10)


class CommentOut(Out):
    id: str
    section: Section
    text: str
    author: str
    created_at: datetime


class CommentIn(BaseModel):
    section: Section
    text: str = Field(min_length=1, max_length=2000)
    author: str = Field(default="Я", max_length=40)


class ReelOut(BaseModel):
    id: str
    account: str
    url: str
    caption: str
    views: int
    likes: int
    comments: int
    duration_sec: float | None
    posted_at: datetime | None
    score: float
    rank: int
    status: ReelStatus
    cover_url: str | None
    video_url: str | None
    tags: list[str]
    script_title: str | None
    has_script: bool
    active_job: JobOut | None = None


class ReelDetail(ReelOut):
    total: int
    transcript: str | None
    previews: list[str]
    script: ScriptOut | None
    comments_list: list[CommentOut]


class EventOut(Out):
    id: int
    created_at: datetime
    level: str
    kind: str
    message: str
    reel_id: str | None
    competitor_id: int | None


def media_url(reel: Reel, kind: MediaKind) -> str | None:
    files = sorted((m for m in reel.media if m.kind == kind), key=lambda m: m.position)
    return public_url(files[0].path) if files else None


def reel_out(reel: Reel, rank: int, active_job=None) -> ReelOut:
    return ReelOut(
        id=reel.id,
        account=reel.competitor.username,
        url=reel.url,
        caption=reel.caption,
        views=reel.views,
        likes=reel.likes,
        comments=reel.comments_count,
        duration_sec=reel.duration_sec,
        posted_at=reel.posted_at,
        score=reel.score,
        rank=rank,
        status=reel.status,
        # Если файл ещё не скачан, отдаём ссылку Instagram — она живёт несколько дней
        cover_url=media_url(reel, MediaKind.cover) or reel.remote_cover_url,
        video_url=media_url(reel, MediaKind.video) or reel.remote_video_url,
        tags=[t.name for t in reel.tags],
        script_title=reel.script.title if reel.script else None,
        has_script=reel.script is not None,
        active_job=JobOut.model_validate(active_job) if active_job else None,
    )


def script_out(reel: Reel) -> ScriptOut | None:
    s = reel.script
    if not s:
        return None
    by = {sec: [BlockIO(label=b.label, text=b.text, visual=b.visual) for b in s.blocks if b.section == sec] for sec in Section}
    return ScriptOut(
        title=s.title,
        idea=s.idea,
        why_it_works=s.why_it_works,
        hook=(by[Section.hook] or [BlockIO()])[0],
        body=by[Section.body],
        cta=(by[Section.cta] or [BlockIO()])[0],
        caption=s.caption,
        tags=[t.name for t in reel.tags],
        notes=s.notes or {},
        source_language=s.source_language,
        version=s.version,
        generated_at=s.generated_at,
        edited_at=s.edited_at,
    )
