"""Всё, что связано с AI: расшифровка речи, вызов Claude CLI, Remix."""
import json
import re
import subprocess
import tempfile

from . import db

_whisper = None


def transcribe(path: str) -> str:
    """Расшифровывает речь локально (Whisper small, без интернета после первой загрузки модели)."""
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel

        _whisper = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _ = _whisper.transcribe(path, vad_filter=True)
    return " ".join(s.text.strip() for s in segments).strip()


def ask_claude(prompt: str, model: str) -> str:
    """Единственное место, где вызывается Claude. Позже можно заменить на API."""
    r = subprocess.run(
        ["claude", "-p", "--model", model, "--tools", "", "--no-session-persistence",
         "--disable-slash-commands", "--strict-mcp-config", "--setting-sources", ""],
        input=prompt, capture_output=True, text=True, encoding="utf-8",
        timeout=300, cwd=tempfile.gettempdir(),
    )
    if r.returncode != 0:
        raise RuntimeError(f"Claude CLI: {(r.stderr or r.stdout).strip()[:200]}")
    return r.stdout.strip()


def ask_json(prompt: str, model: str) -> dict:
    text = ask_claude(prompt, model)
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise RuntimeError("Claude вернул ответ не в том формате")
    return json.loads(m.group(0))


SPLIT = """Ниже расшифровка речи из короткого видео (Reels) и подпись к нему.
Раздели речь на три части, ничего не переписывая и не переводя:
- hook: первые 1-2 фразы, которые цепляют зрителя
- script: основная часть
- cta: призыв к действию в конце (если его нет, пустая строка)
Верни только JSON вида {{"hook": "...", "script": "...", "cta": "..."}}, без пояснений.

Подпись: {caption}

Расшифровка:
{transcript}"""

ADAPT = """Ты сценарист коротких видео для Instagram Reels. Тебе дан сценарий популярного зарубежного ролика,
его нужно превратить в сценарий для русскоязычного автора.

О нашем авторе:
{profile}

Сценарий оригинала (hook / script / cta):
{parts}

Правила:
- Пиши на живом разговорном русском, как говорит человек, а не как переводчик.
- Это не дословный перевод: сохрани идею, структуру и ритм оригинала, но подай через нишу, аудиторию и тон автора.
- Заменяй зарубежные реалии, цифры и примеры на понятные русскоязычной аудитории.
- hook должен цеплять в первые 2-3 секунды, cta один и конкретный.
Верни только JSON вида {{"hook": "...", "script": "...", "cta": "..."}}, без пояснений."""


def set_status(rid: int, status: str, error: str | None = None):
    with db.connect() as c:
        c.execute("UPDATE reels SET remix_status=%s, remix_error=%s WHERE id=%s", (status, error, rid))


def run_remix(rid: int):
    try:
        with db.connect() as c:
            reel = c.execute("SELECT * FROM reels WHERE id=%s", (rid,)).fetchone()
            row = c.execute("SELECT value FROM settings WHERE key='profile'").fetchone()
        profile = (row["value"] if row else "").strip() or "Профиль не заполнен: пиши нейтрально, для широкой русскоязычной аудитории."

        transcript = reel["transcript"]
        if not transcript:
            if not reel["video"]:
                raise RuntimeError("Нет видеофайла, расшифровать нечего")
            transcript = transcribe(str(db.STORAGE / reel["video"]))
            if len(transcript) < 15:
                raise RuntimeError("В ролике почти нет речи, сценарий не из чего собрать")
            with db.connect() as c:
                c.execute("UPDATE reels SET transcript=%s WHERE id=%s", (transcript, rid))

        set_status(rid, "writing")
        parts = ask_json(SPLIT.format(caption=reel["caption"] or "", transcript=transcript), "haiku")
        result = ask_json(ADAPT.format(profile=profile, parts=json.dumps(parts, ensure_ascii=False, indent=1)), "sonnet")

        with db.connect() as c:
            c.execute(
                "UPDATE reels SET hook=%s, script=%s, cta=%s, remix_status='done', remix_error=NULL WHERE id=%s",
                (result.get("hook", ""), result.get("script", ""), result.get("cta", ""), rid),
            )
    except Exception as e:  # причину показываем в интерфейсе
        set_status(rid, "error", str(e)[:300])
