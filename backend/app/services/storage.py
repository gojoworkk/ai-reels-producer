"""Файловое хранилище: обложки, видео, кадры-превью, экспорты и временные файлы."""

import subprocess
import time
from pathlib import Path

import httpx
import imageio_ffmpeg
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import MediaFile, MediaKind, Reel

FOLDERS = {
    MediaKind.cover: "covers",
    MediaKind.video: "videos",
    MediaKind.preview: "previews",
    MediaKind.export: "exports",
    MediaKind.tmp: "tmp",
}


def root() -> Path:
    return get_settings().storage_dir


def ensure_dirs() -> None:
    for folder in FOLDERS.values():
        (root() / folder).mkdir(parents=True, exist_ok=True)


def public_url(rel_path: str | None) -> str | None:
    return f"{get_settings().public_url}/media/{rel_path}" if rel_path else None


def _register(session: Session, reel_id: str | None, kind: MediaKind, rel: str, position: int = 0) -> MediaFile:
    size = (root() / rel).stat().st_size
    existing = session.scalar(select(MediaFile).where(MediaFile.path == rel))
    if existing:
        existing.size = size
        return existing
    media = MediaFile(reel_id=reel_id, kind=kind, path=rel, size=size, position=position)
    session.add(media)
    return media


def _download(url: str, dest: Path, attempts: int = 3) -> None:
    tmp = root() / FOLDERS[MediaKind.tmp] / f"{dest.name}.part"
    for attempt in range(1, attempts + 1):
        try:
            # Instagram CDN отдаёт файлы без Referer
            with httpx.stream("GET", url, timeout=120, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as res:
                res.raise_for_status()
                with tmp.open("wb") as f:
                    for chunk in res.iter_bytes():
                        f.write(chunk)
            tmp.replace(dest)
            return
        except httpx.TransportError:
            # Сетевые сбои (DNS, обрыв соединения) бывают разовыми — пробуем ещё раз
            tmp.unlink(missing_ok=True)
            if attempt == attempts:
                raise
            time.sleep(2 * attempt)


def save_cover(session: Session, reel: Reel) -> None:
    if not reel.remote_cover_url:
        return
    rel = f"{FOLDERS[MediaKind.cover]}/{reel.id}.jpg"
    _download(reel.remote_cover_url, root() / rel)
    _register(session, reel.id, MediaKind.cover, rel)


def save_video(session: Session, reel: Reel) -> Path | None:
    if not reel.remote_video_url:
        return None
    rel = f"{FOLDERS[MediaKind.video]}/{reel.id}.mp4"
    dest = root() / rel
    if not dest.exists():
        _download(reel.remote_video_url, dest)
    _register(session, reel.id, MediaKind.video, rel)
    return dest


def save_previews(session: Session, reel: Reel, video: Path) -> None:
    """Кадры из видео: начало, середина и конец — для быстрого просмотра раскадровки."""
    count = get_settings().preview_frames
    if count <= 0:
        return
    duration = reel.duration_sec or 10
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    session.execute(delete(MediaFile).where(MediaFile.reel_id == reel.id, MediaFile.kind == MediaKind.preview))
    for i in range(count):
        at = duration * (i + 0.5) / count
        rel = f"{FOLDERS[MediaKind.preview]}/{reel.id}_{i}.jpg"
        result = subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-ss", f"{at:.2f}", "-i", str(video),
             "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", str(root() / rel)],
            capture_output=True,
            stdin=subprocess.DEVNULL,
        )
        if result.returncode == 0 and (root() / rel).exists():
            _register(session, reel.id, MediaKind.preview, rel, position=i)


def save_export(session: Session, reel_id: str | None, filename: str, data: bytes) -> Path:
    rel = f"{FOLDERS[MediaKind.export]}/{filename}"
    (root() / rel).write_bytes(data)
    _register(session, reel_id, MediaKind.export, rel)
    return root() / rel


def remove_reel_files(session: Session, reel_id: str) -> None:
    for media in session.scalars(select(MediaFile).where(MediaFile.reel_id == reel_id)):
        (root() / media.path).unlink(missing_ok=True)
