"""Бизнес-логика: загрузка рилсов конкурента и написание сценария."""

import logging
import statistics

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import session_scope
from ..jobs import Progress, log_event
from ..models import Competitor, Reel, ReelStatus, Script, ScriptBlock, Section, Tag, now
from . import apify, storage
from .scriptwriter import ScriptDraft, ScriptwriterError, write_script

log = logging.getLogger("reels.pipeline")


def get_or_create_tags(session: Session, names: list[str]) -> list[Tag]:
    tags: list[Tag] = []
    for raw in names:
        name = raw.strip().lstrip("#")[:60]
        if not name or any(t.name.lower() == name.lower() for t in tags):
            continue
        tag = session.scalar(select(Tag).where(Tag.name == name))
        if not tag:
            tag = Tag(name=name)
            session.add(tag)
            session.flush()
        tags.append(tag)
    return tags


def sync_competitor(competitor_id: int, progress: Progress) -> str:
    settings = get_settings()
    with session_scope() as s:
        username = s.get(Competitor, competitor_id).username

    # 1. Apify достаёт рилсы
    progress(5, f"Запрашиваем последние {settings.reels_per_competitor} рилсов @{username} у Apify")
    fetched = apify.fetch_latest_reels(username, settings.reels_per_competitor)
    if not fetched:
        raise apify.ApifyError(f"У @{username} не нашлось рилсов")

    # 2. Нормализуем и пишем в базу
    progress(40, f"Сохраняем {len(fetched)} рилсов в базу")
    median = statistics.median([r.views for r in fetched if r.views] or [0])
    with session_scope() as s:
        competitor = s.get(Competitor, competitor_id)
        competitor.full_name = fetched[0].full_name or competitor.full_name
        competitor.median_views = median
        competitor.last_synced_at = now()
        for raw in fetched:
            reel = s.get(Reel, raw.id) or Reel(id=raw.id, competitor_id=competitor.id)
            reel.url = raw.url
            reel.caption = raw.caption
            reel.views = raw.views
            reel.likes = raw.likes
            reel.comments_count = raw.comments
            reel.duration_sec = raw.duration_sec
            reel.posted_at = raw.posted_at
            reel.score = raw.views / median if median else 0
            reel.remote_cover_url = raw.cover_url
            reel.remote_video_url = raw.video_url
            reel.fetched_at = now()
            if raw.transcript and not reel.transcript:
                reel.transcript = raw.transcript
            if not reel.script and not reel.tags:
                reel.tags = get_or_create_tags(s, raw.hashtags[:4])
            s.add(reel)
        log_event(s, "competitor_synced", f"Загружено {len(fetched)} рилсов @{username}", competitor_id=competitor_id)

    # 3. Обложки, видео и кадры — в файловое хранилище
    failed = 0
    for i, raw in enumerate(fetched, start=1):
        progress(50 + int(48 * i / len(fetched)), f"Скачиваем медиа {i}/{len(fetched)}")
        try:
            with session_scope() as s:
                reel = s.get(Reel, raw.id)
                storage.save_cover(s, reel)
                if settings.download_videos and (video := storage.save_video(s, reel)):
                    storage.save_previews(s, reel, video)
                if reel.status in (ReelStatus.new, ReelStatus.error):
                    reel.status = ReelStatus.media_ready
        except Exception as err:  # noqa: BLE001 — один битый файл не должен ронять всю загрузку
            failed += 1
            log.warning("media for %s failed: %s", raw.id, err)

    note = f", медиа не скачалось у {failed}" if failed else ""
    return f"Загружено {len(fetched)} рилсов @{username}{note}"


def _apply_draft(session: Session, reel: Reel, draft: ScriptDraft) -> None:
    script = reel.script or Script(reel_id=reel.id, title="")
    script.version = (script.version or 0) + 1 if reel.script else 1
    script.title = draft.title[:200]
    script.idea = draft.idea
    script.why_it_works = draft.why_it_works
    script.caption = draft.caption
    script.source_language = draft.source_language[:50]
    script.notes = draft.notes.model_dump()
    script.generated_at = now()
    script.edited_at = None
    script.blocks = [
        ScriptBlock(section=Section.hook, position=0, text=draft.hook.text, visual=draft.hook.visual),
        *[
            ScriptBlock(section=Section.body, position=i, label=b.label[:200], text=b.text, visual=b.visual)
            for i, b in enumerate(draft.body)
        ],
        ScriptBlock(section=Section.cta, position=0, text=draft.cta.text, visual=draft.cta.visual),
    ]
    reel.script = script
    reel.tags = get_or_create_tags(session, draft.tags)


def generate_script(reel_id: str, progress: Progress) -> str:
    # Проверяем ключ Claude до Apify: иначе оплатим транскрипт, который некому обработать
    if not get_settings().anthropic_api_key:
        raise ScriptwriterError("Не задан ANTHROPIC_API_KEY в backend/.env")

    with session_scope() as s:
        reel = s.get(Reel, reel_id)
        reel.status = ReelStatus.scripting
        need_transcript = not reel.transcript and not reel.transcript_fetched
        url = reel.url

    try:
        if need_transcript:
            progress(10, "Получаем транскрипт рилса через Apify")
            transcript = apify.fetch_transcript(url)
            with session_scope() as s:
                reel = s.get(Reel, reel_id)
                reel.transcript = transcript
                reel.transcript_fetched = True

        progress(40, "Claude адаптирует сценарий на русский")
        with session_scope() as s:
            reel = s.get(Reel, reel_id)
            draft = write_script(reel, reel.competitor.username)

        progress(90, "Сохраняем сценарий")
        with session_scope() as s:
            reel = s.get(Reel, reel_id)
            _apply_draft(s, reel, draft)
            reel.status = ReelStatus.scripted
            log_event(s, "script_generated", f"Сценарий «{draft.title}» готов", reel_id=reel_id,
                      competitor_id=reel.competitor_id)
        return f"Сценарий «{draft.title}» готов"
    except Exception:
        with session_scope() as s:
            reel = s.get(Reel, reel_id)
            if reel:
                reel.status = ReelStatus.scripted if reel.script else ReelStatus.error
        raise
