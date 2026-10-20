"""Таблицы PostgreSQL: конкуренты, рилсы, тексты сценариев, теги, комментарии, статусы задач и события, файлы."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex


class Section(str, enum.Enum):
    hook = "hook"
    body = "body"
    cta = "cta"


class ReelStatus(str, enum.Enum):
    new = "new"  # метаданные получены
    media_ready = "media_ready"  # обложка, видео и кадры в хранилище
    scripting = "scripting"  # пишется сценарий
    scripted = "scripted"  # сценарий готов
    error = "error"


class JobKind(str, enum.Enum):
    sync_competitor = "sync_competitor"
    generate_script = "generate_script"


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"


class MediaKind(str, enum.Enum):
    cover = "cover"
    video = "video"
    preview = "preview"
    export = "export"
    tmp = "tmp"


# Один тип ENUM в PostgreSQL на две таблицы
section_enum = Enum(Section, name="script_section")

reel_tags = Table(
    "reel_tags",
    Base.metadata,
    Column("reel_id", ForeignKey("reels.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Competitor(Base):
    __tablename__ = "competitors"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(200))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    median_views: Mapped[float] = mapped_column(Float, default=0)

    reels: Mapped[list["Reel"]] = relationship(back_populates="competitor", cascade="all, delete-orphan", passive_deletes=True)


class Reel(Base):
    __tablename__ = "reels"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # Instagram shortCode
    competitor_id: Mapped[int] = mapped_column(ForeignKey("competitors.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(500))
    caption: Mapped[str] = mapped_column(Text, default="")
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_sec: Mapped[float | None] = mapped_column(Float)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Во сколько раз просмотры выше медианы аккаунта — по нему строится рейтинг
    score: Mapped[float] = mapped_column(Float, default=0, index=True)
    status: Mapped[ReelStatus] = mapped_column(Enum(ReelStatus, name="reel_status"), default=ReelStatus.new)
    transcript: Mapped[str | None] = mapped_column(Text)
    transcript_fetched: Mapped[bool] = mapped_column(Boolean, default=False)
    remote_cover_url: Mapped[str | None] = mapped_column(Text)
    remote_video_url: Mapped[str | None] = mapped_column(Text)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    competitor: Mapped[Competitor] = relationship(back_populates="reels")
    script: Mapped["Script | None"] = relationship(back_populates="reel", cascade="all, delete-orphan", passive_deletes=True)
    tags: Mapped[list["Tag"]] = relationship(secondary=reel_tags, back_populates="reels")
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="reel", cascade="all, delete-orphan", passive_deletes=True, order_by="Comment.created_at"
    )
    media: Mapped[list["MediaFile"]] = relationship(back_populates="reel", cascade="all, delete-orphan", passive_deletes=True)


class Script(Base):
    __tablename__ = "scripts"

    id: Mapped[int] = mapped_column(primary_key=True)
    reel_id: Mapped[str] = mapped_column(ForeignKey("reels.id", ondelete="CASCADE"), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    idea: Mapped[str] = mapped_column(Text, default="")
    why_it_works: Mapped[str] = mapped_column(Text, default="")
    caption: Mapped[str] = mapped_column(Text, default="")
    source_language: Mapped[str] = mapped_column(String(50), default="")
    # Комментарии ИИ-продюсера к блокам: {"hook": "...", "body": "...", "cta": "..."}
    notes: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    reel: Mapped[Reel] = relationship(back_populates="script")
    blocks: Mapped[list["ScriptBlock"]] = relationship(
        back_populates="script", cascade="all, delete-orphan", passive_deletes=True, order_by="ScriptBlock.position"
    )


class ScriptBlock(Base):
    """Тексты сценария: хук, пункты скрипта и CTA."""

    __tablename__ = "script_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    script_id: Mapped[int] = mapped_column(ForeignKey("scripts.id", ondelete="CASCADE"), index=True)
    section: Mapped[Section] = mapped_column(section_enum)
    position: Mapped[int] = mapped_column(Integer, default=0)
    label: Mapped[str] = mapped_column(String(200), default="")
    text: Mapped[str] = mapped_column(Text, default="")
    visual: Mapped[str] = mapped_column(Text, default="")

    script: Mapped[Script] = relationship(back_populates="blocks")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)

    reels: Mapped[list[Reel]] = relationship(secondary=reel_tags, back_populates="tags")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    reel_id: Mapped[str] = mapped_column(ForeignKey("reels.id", ondelete="CASCADE"), index=True)
    section: Mapped[Section] = mapped_column(section_enum)
    text: Mapped[str] = mapped_column(Text)
    author: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    reel: Mapped[Reel] = relationship(back_populates="comments")


class Job(Base):
    """Статус фоновой задачи: загрузка рилсов или написание сценария, с прогрессом."""

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    kind: Mapped[JobKind] = mapped_column(Enum(JobKind, name="job_kind"))
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, name="job_status"), default=JobStatus.queued, index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(String(300), default="В очереди")
    error: Mapped[str | None] = mapped_column(Text)
    competitor_id: Mapped[int | None] = mapped_column(ForeignKey("competitors.id", ondelete="CASCADE"), index=True)
    reel_id: Mapped[str | None] = mapped_column(ForeignKey("reels.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Event(Base):
    """Журнал событий: что и когда произошло с конкурентами и рилсами."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    level: Mapped[str] = mapped_column(String(10), default="info")
    kind: Mapped[str] = mapped_column(String(50))
    message: Mapped[str] = mapped_column(Text)
    competitor_id: Mapped[int | None] = mapped_column(ForeignKey("competitors.id", ondelete="SET NULL"))
    reel_id: Mapped[str | None] = mapped_column(ForeignKey("reels.id", ondelete="SET NULL"))


class MediaFile(Base):
    """Файл в хранилище: обложка, видео, кадр-превью, экспорт или временный файл."""

    __tablename__ = "media_files"
    __table_args__ = (UniqueConstraint("path"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    reel_id: Mapped[str | None] = mapped_column(ForeignKey("reels.id", ondelete="CASCADE"), index=True)
    kind: Mapped[MediaKind] = mapped_column(Enum(MediaKind, name="media_kind"))
    path: Mapped[str] = mapped_column(String(500))  # относительно STORAGE_DIR
    size: Mapped[int] = mapped_column(Integer, default=0)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    reel: Mapped[Reel | None] = relationship(back_populates="media")
