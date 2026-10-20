"""Источник данных: Apify actor apify/instagram-reel-scraper."""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

from ..config import get_settings

ACTOR_ID = "apify~instagram-reel-scraper"


class ApifyError(RuntimeError):
    pass


@dataclass
class RawReel:
    id: str
    account: str
    full_name: str | None
    url: str
    caption: str
    cover_url: str | None
    video_url: str | None
    views: int
    likes: int
    comments: int
    duration_sec: float | None
    posted_at: datetime | None
    hashtags: list[str]
    transcript: str | None


def _run_actor(payload: dict[str, Any]) -> list[dict[str, Any]]:
    token = get_settings().apify_token
    if not token:
        raise ApifyError("Не задан APIFY_TOKEN в backend/.env")
    try:
        res = httpx.post(
            f"https://api.apify.com/v2/acts/{ACTOR_ID}/run-sync-get-dataset-items",
            params={"timeout": 300},
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=330,
        )
    except httpx.HTTPError as err:
        raise ApifyError(f"Apify недоступен: {err}") from err
    if res.status_code >= 400:
        raise ApifyError(f"Apify вернул {res.status_code}: {res.text[:300]}")
    items = res.json()
    errors = [i for i in items if isinstance(i.get("error"), str)]
    if errors and len(errors) == len(items):
        first = errors[0]
        raise ApifyError(f"Apify: {first.get('errorDescription') or first['error']} (аккаунт закрыт или не существует?)")
    return [i for i in items if not isinstance(i.get("error"), str)]


def _num(v: Any) -> int:
    return int(v) if isinstance(v, (int, float)) and v > 0 else 0


def _str(v: Any) -> str | None:
    return v if isinstance(v, str) and v else None


def _date(v: Any) -> datetime | None:
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00")) if isinstance(v, str) else None
    except ValueError:
        return None


def pick_transcript(item: dict[str, Any]) -> str | None:
    # Имя поля с транскриптом в датасете не задокументировано — проверяем варианты
    for key in ("transcript", "transcription", "audioTranscript", "videoTranscript"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, list):
            text = " ".join(s if isinstance(s, str) else str((s or {}).get("text", "")) for s in v).strip()
            if text:
                return text
        if isinstance(v, dict) and isinstance(v.get("text"), str) and v["text"].strip():
            return v["text"].strip()
    return None


def _to_raw(item: dict[str, Any]) -> RawReel | None:
    rid = _str(item.get("shortCode")) or _str(item.get("id"))
    account = _str(item.get("ownerUsername"))
    if not rid or not account:
        return None
    caption = _str(item.get("caption")) or ""
    hashtags = item.get("hashtags") if isinstance(item.get("hashtags"), list) else re.findall(r"#(\w+)", caption)
    duration = item.get("videoDuration")
    return RawReel(
        id=rid,
        account=account.lower(),
        full_name=_str(item.get("ownerFullName")),
        url=_str(item.get("url")) or f"https://www.instagram.com/reel/{rid}/",
        caption=caption,
        cover_url=_str(item.get("displayUrl")),
        video_url=_str(item.get("videoUrl")),
        views=_num(item.get("videoPlayCount")) or _num(item.get("videoViewCount")),
        likes=_num(item.get("likesCount")),
        comments=_num(item.get("commentsCount")),
        duration_sec=float(duration) if isinstance(duration, (int, float)) and duration > 0 else None,
        posted_at=_date(item.get("timestamp")),
        hashtags=[str(h) for h in hashtags][:10],
        transcript=pick_transcript(item),
    )


def fetch_latest_reels(username: str, limit: int) -> list[RawReel]:
    items = _run_actor({"username": [username], "resultsLimit": limit, "skipPinnedPosts": True})
    return [r for r in map(_to_raw, items) if r]


def fetch_transcript(reel_url: str) -> str | None:
    """Транскрипт оплачивается поминутно, поэтому берём его только для рилса, по которому пишем сценарий."""
    for item in _run_actor({"username": [reel_url], "resultsLimit": 1, "includeTranscript": True}):
        if text := pick_transcript(item):
            return text
    return None


USERNAME_RE = re.compile(r"^[a-z0-9._]{1,30}$")


def normalize_username(value: str) -> str | None:
    s = value.strip()
    if m := re.search(r"instagram\.com/([^/?#]+)", s, re.I):
        s = m.group(1)
    s = s.lstrip("@").lower()
    return s if USERNAME_RE.match(s) and s not in {"reel", "reels", "p", "explore", "stories"} else None
