"""Переписывание сценария: Claude адаптирует взлетевший рилс на русский."""

import anthropic
from pydantic import BaseModel, Field

from ..config import get_settings
from ..models import Reel


class Block(BaseModel):
    text: str = Field(description="Текст для озвучки / в кадре, на русском")
    visual: str = Field(description="Что показывать в кадре, коротко")


class BodyBlock(Block):
    label: str = Field(description="Короткий заголовок пункта, 2–6 слов, например «Ошибка №1 — скучный хук»")


class Notes(BaseModel):
    hook: str
    body: str
    cta: str


class ScriptDraft(BaseModel):
    title: str = Field(description="Короткое рабочее название ролика, до 60 символов")
    idea: str = Field(description="Суть ролика в 1–2 предложениях")
    why_it_works: str = Field(description="Почему рилс залетел: механика удержания, эмоция, триггер")
    hook: Block = Field(description="Хук — первые 1–3 секунды")
    body: list[BodyBlock] = Field(description="Основная часть, 2–6 смысловых блоков по порядку")
    cta: Block = Field(description="Призыв к действию в конце")
    caption: str = Field(description="Описание под пост на русском, с 3–5 хэштегами")
    tags: list[str] = Field(description="2–4 коротких тега темы ролика на русском, одно-два слова, с заглавной буквы")
    notes: Notes = Field(
        description="Короткий комментарий продюсера к каждому блоку: что в нём сильно и что можно усилить, 1–2 предложения"
    )
    source_language: str = Field(description="Язык оригинала, например «английский»")


SYSTEM_PROMPT = """Ты — сильный русскоязычный сценарист коротких вертикальных видео (Reels, Shorts, TikTok). Тебе дают взлетевший рилс конкурента: транскрипт речи, описание и метрики. Твоя задача — разобрать его и написать готовый к съёмке сценарий на русском языке, который повторяет механику успеха оригинала.

Как работать с иностранным оригиналом:
- Это адаптация, а не перевод. Передавай смысл, интонацию и приём удержания, а не слова. Никаких калек вроде «это изменит вашу игру» или «позвольте мне объяснить».
- Пиши так, как говорит живой русскоязычный блогер: разговорно, короткими фразами, удобными для озвучки. Без канцелярита и пафоса.
- Идиомы, шутки, мемы и культурные отсылки замени на понятные русскоязычной аудитории эквиваленты. Если отсылку нельзя заменить без потери смысла — коротко поясни её в тексте.
- Доллары, мили, фунты, Фаренгейты пересчитай или замени, если цифры важны для смысла. Американские бренды и сервисы оставляй, только если они известны в СНГ, иначе подбери аналог.
- Сохрани тип хука (вопрос, шок-факт, противоречие, обещание результата, «я сделал X и вот что вышло» и т. п.) и его длину: хук должен укладываться в 1–3 секунды.
- Факты и цифры не выдумывай. Если в оригинале есть утверждение, которое ты не можешь проверить, оставь его как есть.

Если оригинал уже на русском — не переводи, а структурируй и аккуратно отредактируй.
Если транскрипта нет (например, рилс на музыке без речи), опирайся на описание и метрики, а в поле idea прямо напиши, что текст восстановлен по описанию.

В поле visual описывай, что показывать в кадре. Видеоряд ты не видишь, поэтому предлагай визуал, который логично следует из текста."""


class ScriptwriterError(RuntimeError):
    pass


def write_script(reel: Reel, account: str) -> ScriptDraft:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise ScriptwriterError("Не задан ANTHROPIC_API_KEY в backend/.env")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    lines = [
        f"Аккаунт: @{account}",
        f"Ссылка: {reel.url}",
        f"Просмотры: {reel.views}, лайки: {reel.likes}, комментарии: {reel.comments_count}",
        f"Во сколько раз просмотры выше медианы аккаунта: x{reel.score:.1f}",
    ]
    if reel.duration_sec:
        lines.append(f"Длительность: {round(reel.duration_sec)} сек")
    lines += ["", "<описание>", reel.caption or "(нет описания)", "</описание>", "",
              "<транскрипт>", reel.transcript or "(транскрипта нет)", "</транскрипт>"]

    response = client.beta.messages.parse(
        model=settings.anthropic_model,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "high"},
        output_format=ScriptDraft,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": "\n".join(lines)}],
    )

    if response.stop_reason == "refusal":
        raise ScriptwriterError("Модель отказалась обрабатывать этот рилс. Попробуйте другой.")
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise ScriptwriterError("Не удалось получить сценарий от модели. Попробуйте ещё раз.")
    return response.parsed_output
