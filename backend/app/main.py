import csv
import io
import re
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import ai, apify, db


def refresh_loop():
    """Автообновление: раз в 5 минут смотрит, не пора ли заново загрузить рилсы конкурентов."""
    while True:
        time.sleep(300)
        try:
            with db.connect() as c:
                row = c.execute("SELECT value FROM settings WHERE key='refresh_hours'").fetchone()
                hours = int(row["value"]) if row else 0
                if hours <= 0:
                    continue
                due = c.execute(
                    "SELECT id, handle FROM competitors WHERE status <> 'loading' "
                    "AND (loaded_at IS NULL OR loaded_at < %s)",
                    (datetime.now(timezone.utc) - timedelta(hours=hours),),
                ).fetchall()
            for d in due:
                with db.connect() as c:
                    c.execute("UPDATE competitors SET status='loading', error=NULL WHERE id=%s", (d["id"],))
                run_load(d["id"], d["handle"])
        except Exception:
            pass  # попробуем в следующий раз


@asynccontextmanager
async def lifespan(_):
    threading.Thread(target=refresh_loop, daemon=True).start()
    yield


app = FastAPI(title="Reels Finder", lifespan=lifespan)
db.init()
app.mount("/api/files", StaticFiles(directory=db.STORAGE), name="files")


class NewCompetitor(BaseModel):
    handle: str


def clean_handle(raw: str) -> str:
    """Принимает @name, name или ссылку instagram.com/name/ и возвращает name."""
    m = re.search(r"instagram\.com/([A-Za-z0-9._]+)", raw)
    handle = m.group(1) if m else raw.strip().lstrip("@").strip("/")
    if not re.fullmatch(r"[A-Za-z0-9._]{1,30}", handle):
        raise HTTPException(400, "Не похоже на Instagram-аккаунт")
    return handle.lower()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/competitors")
def list_competitors():
    with db.connect() as c:
        return c.execute(
            """SELECT c.*, (SELECT count(*) FROM reels r WHERE r.competitor_id=c.id) AS reels
               FROM competitors c ORDER BY c.id DESC"""
        ).fetchall()


@app.post("/api/competitors")
def add_competitor(body: NewCompetitor):
    handle = clean_handle(body.handle)
    with db.connect() as c:
        row = c.execute(
            """INSERT INTO competitors (handle) VALUES (%s)
               ON CONFLICT (handle) DO UPDATE SET handle=EXCLUDED.handle RETURNING id""",
            (handle,),
        ).fetchone()
    return {"id": row["id"], "handle": handle}


@app.delete("/api/competitors/{cid}")
def delete_competitor(cid: int):
    with db.connect() as c:
        c.execute("DELETE FROM competitors WHERE id=%s", (cid,))
    return {"ok": True}


@app.post("/api/competitors/{cid}/load")
def load_reels(cid: int, tasks: BackgroundTasks):
    with db.connect() as c:
        row = c.execute("SELECT handle, status FROM competitors WHERE id=%s", (cid,)).fetchone()
        if not row:
            raise HTTPException(404, "Нет такого конкурента")
        if row["status"] == "loading":
            return {"ok": True}
        c.execute("UPDATE competitors SET status='loading', error=NULL WHERE id=%s", (cid,))
    tasks.add_task(run_load, cid, row["handle"])
    return {"ok": True}


def run_load(cid: int, handle: str):
    try:
        items = [apify.normalize(i) for i in apify.fetch_reels(handle, 20)]
        items = [i for i in items if i["code"]]
        if not items:
            raise RuntimeError("Apify не вернул рилсов: аккаунт закрыт или нет такого аккаунта")
        with db.connect() as c:
            for i in items:
                cover = save_file(f"covers/{i['code']}.jpg", i["cover_url"])
                video = save_file(f"videos/{i['code']}.mp4", i["video_url"])
                c.execute(
                    """INSERT INTO reels (competitor_id, code, url, caption, views, likes, comments,
                                          duration, posted_at, cover, video_url, video)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (code) DO UPDATE SET views=EXCLUDED.views, likes=EXCLUDED.likes,
                           comments=EXCLUDED.comments, cover=COALESCE(EXCLUDED.cover, reels.cover),
                           video_url=EXCLUDED.video_url, video=COALESCE(EXCLUDED.video, reels.video)""",
                    (cid, i["code"], i["url"], i["caption"], i["views"], i["likes"], i["comments"],
                     i["duration"], i["posted_at"], cover, i["video_url"], video),
                )
            c.execute(
                "UPDATE competitors SET status='done', loaded_at=%s WHERE id=%s",
                (datetime.now(timezone.utc), cid),
            )
    except Exception as e:  # показываем причину в интерфейсе
        with db.connect() as c:
            c.execute("UPDATE competitors SET status='error', error=%s WHERE id=%s", (str(e)[:300], cid))


def save_file(name: str, url: str | None) -> str | None:
    """Ссылки Instagram на обложки и видео протухают, поэтому сохраняем файлы у себя."""
    if not url:
        return None
    try:
        r = httpx.get(url, timeout=120, follow_redirects=True)
        r.raise_for_status()
        (db.STORAGE / name).write_bytes(r.content)
        return name
    except Exception:
        return None


class ReelTexts(BaseModel):
    hook: str | None = None
    script: str | None = None
    cta: str | None = None


class Refresh(BaseModel):
    hours: int


@app.get("/api/refresh")
def get_refresh():
    with db.connect() as c:
        row = c.execute("SELECT value FROM settings WHERE key='refresh_hours'").fetchone()
    return {"hours": int(row["value"]) if row else 0}


@app.put("/api/refresh")
def set_refresh(body: Refresh):
    hours = body.hours if body.hours in (0, 6, 12, 24) else 0
    with db.connect() as c:
        c.execute(
            "INSERT INTO settings (key, value) VALUES ('refresh_hours', %s) "
            "ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",
            (str(hours),),
        )
    return {"hours": hours}


@app.get("/api/export.csv")
def export_csv(handle: str | None = None):
    where = "WHERE c.handle = %s" if handle else ""
    with db.connect() as c:
        rows = c.execute(
            f"""SELECT r.*, c.handle FROM reels r JOIN competitors c ON c.id=r.competitor_id
                {where} ORDER BY r.views DESC""",
            (handle,) if handle else (),
        ).fetchall()
    out = io.StringIO()
    w = csv.writer(out, delimiter=";")  # точка с запятой, чтобы русский Excel открыл по колонкам
    w.writerow(["Аккаунт", "Ссылка", "Просмотры", "Лайки", "Комментарии", "Длительность, с", "Дата", "Хук", "Скрипт", "CTA"])
    for r in rows:
        w.writerow([
            "@" + r["handle"], r["url"], r["views"], r["likes"], r["comments"],
            round(r["duration"] or 0), r["posted_at"].date() if r["posted_at"] else "",
            r["hook"] or "", r["script"] or "", r["cta"] or "",
        ])
    return Response(
        "﻿" + out.getvalue(),  # BOM, чтобы Excel понял кодировку
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="reels.csv"'},
    )


class Profile(BaseModel):
    profile: str


@app.get("/api/profile")
def get_profile():
    with db.connect() as c:
        row = c.execute("SELECT value FROM settings WHERE key='profile'").fetchone()
    return {"profile": row["value"] if row else ""}


@app.put("/api/profile")
def save_profile(body: Profile):
    with db.connect() as c:
        c.execute(
            "INSERT INTO settings (key, value) VALUES ('profile', %s) "
            "ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",
            (body.profile,),
        )
    return {"profile": body.profile}


@app.post("/api/reels/{rid}/remix")
def remix(rid: int, tasks: BackgroundTasks):
    with db.connect() as c:
        row = c.execute("SELECT remix_status, transcript FROM reels WHERE id=%s", (rid,)).fetchone()
        if not row:
            raise HTTPException(404, "Нет такого рилса")
        if row["remix_status"] in ("transcribing", "writing"):
            return {"ok": True}
        status = "writing" if row["transcript"] else "transcribing"
        c.execute("UPDATE reels SET remix_status=%s, remix_error=NULL WHERE id=%s", (status, rid))
    tasks.add_task(ai.run_remix, rid)
    return {"ok": True}


@app.get("/api/reels/{rid}")
def get_reel(rid: int):
    with db.connect() as c:
        row = c.execute(
            "SELECT r.*, c.handle FROM reels r JOIN competitors c ON c.id=r.competitor_id WHERE r.id=%s",
            (rid,),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Нет такого рилса")
    return row


@app.put("/api/reels/{rid}")
def save_texts(rid: int, body: ReelTexts):
    # Сохраняем только те блоки, которые прислали
    fields = body.model_dump(exclude_unset=True)
    if fields:
        sets = ", ".join(f"{k}=%s" for k in fields)
        with db.connect() as c:
            c.execute(f"UPDATE reels SET {sets} WHERE id=%s", (*fields.values(), rid))
    return get_reel(rid)


@app.get("/api/reels")
def list_reels(competitor_id: int | None = None, sort: str = "views"):
    order = {"views": "views", "likes": "likes", "date": "posted_at"}.get(sort, "views")
    where = "WHERE r.competitor_id = %s" if competitor_id else ""
    args = (competitor_id,) if competitor_id else ()
    with db.connect() as c:
        return c.execute(
            f"""SELECT r.*, c.handle FROM reels r JOIN competitors c ON c.id=r.competitor_id
                {where} ORDER BY r.{order} DESC NULLS LAST""",
            args,
        ).fetchall()
