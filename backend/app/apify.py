import os

import httpx

ACTOR = "apify~instagram-reel-scraper"


def fetch_reels(handle: str, limit: int = 20) -> list[dict]:
    """Запускает парсер Apify и ждёт результат (обычно до пары минут)."""
    r = httpx.post(
        f"https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items",
        headers={"Authorization": f"Bearer {os.environ['APIFY_TOKEN']}"},
        json={"username": [handle], "resultsLimit": limit},
        timeout=300,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"Apify ответил {r.status_code}: {r.text[:200]}")
    return r.json()


def normalize(item: dict) -> dict:
    """Приводит ответ Apify к нашим полям."""
    return {
        "code": item.get("shortCode"),
        "url": item.get("url"),
        "caption": item.get("caption") or "",
        "views": item.get("videoPlayCount") or item.get("videoViewCount") or item.get("playsCount") or 0,
        "likes": max(item.get("likesCount") or 0, 0),
        "comments": item.get("commentsCount") or 0,
        "duration": item.get("videoDuration"),
        "posted_at": item.get("timestamp"),
        "cover_url": item.get("displayUrl"),
        "video_url": item.get("videoUrl"),
    }
