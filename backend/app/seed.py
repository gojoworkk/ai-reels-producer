"""Демо-данные, чтобы посмотреть интерфейс без ключей API: python -m app.seed"""

import statistics
from datetime import timedelta

from sqlalchemy import select

from . import models  # noqa: F401
from .db import Base, engine, session_scope
from .models import Competitor, Reel, ReelStatus, Script, ScriptBlock, Section, now
from .services.pipeline import get_or_create_tags

ACCOUNT = "demo_account"
VIEWS = [1_840_000, 96_000, 412_000, 71_000, 58_000, 120_000, 88_000, 64_000]
CAPTIONS = [
    "I tried waking up at 5am for 30 days. Here's what nobody tells you 👇 #productivity #morning",
    "3 apps that replaced my entire to-do system #apps",
    "Stop saying 'I'm busy'. Say this instead. #mindset",
    "My morning routine (realistic version) #routine",
    "How I plan my week in 10 minutes #planning",
    "The 2-minute rule changed everything #habits",
    "Desk setup tour 2026 #setup",
    "Why your goals keep failing #goals",
]


def main() -> None:
    Base.metadata.create_all(engine)
    with session_scope() as s:
        if old := s.scalar(select(Competitor).where(Competitor.username == ACCOUNT)):
            s.delete(old)
            s.flush()
        median = statistics.median(VIEWS)
        c = Competitor(username=ACCOUNT, full_name="Demo Creator", last_synced_at=now(), median_views=median)
        s.add(c)
        s.flush()
        for i, (views, caption) in enumerate(zip(VIEWS, CAPTIONS)):
            reel = Reel(
                id=f"DEMO{i + 1}", competitor_id=c.id, url="https://www.instagram.com/", caption=caption,
                views=views, likes=round(views * 0.06), comments_count=round(views * 0.002),
                duration_sec=25 + i * 4, posted_at=now() - timedelta(days=i * 3 + 1), score=views / median,
                status=ReelStatus.new,
            )
            reel.tags = get_or_create_tags(s, [w.lstrip("#") for w in caption.split() if w.startswith("#")])
            s.add(reel)

        first = s.get(Reel, "DEMO1")
        first.transcript = (
            "I tried waking up at 5am for 30 days. Day one? Brutal. By day ten I was getting more done before 9 "
            "than most people do all day. But here's what nobody tells you: it's not about the alarm. It's about "
            "what time you go to bed. If you want to try it, start with 15 minutes earlier, not two hours. "
            "Follow for part two."
        )
        first.transcript_fetched = True
        first.status = ReelStatus.scripted
        first.script = Script(
            title="30 дней подъёма в 5 утра",
            idea="Личный эксперимент: месяц подъёмов в 5 утра и главный неочевидный вывод — всё решает время отбоя, а не будильник.",
            why_it_works="Хук-обещание личного опыта с цифрой («30 дней»), интрига «вот что никто не говорит» и практичный совет в конце, который хочется сохранить.",
            caption="Месяц подъёмов в 5 утра: честный итог ⏰ Сохрани, чтобы попробовать. #продуктивность #утро #привычки",
            source_language="английский",
            notes={
                "hook": "Сильный крючок: личный эксперимент с цифрой и интрига «вот что молчат». Можно усилить, показав будильник в первом кадре.",
                "body": "Структура «до → после → секрет» держит внимание. Можно добавить конкретную цифру: сколько задач успевал до 9 утра.",
                "cta": "Обещание второй части даёт повод подписаться. Можно добавить «сохрани, чтобы попробовать».",
            },
            blocks=[
                ScriptBlock(section=Section.hook, text="Я месяц вставал в 5 утра. И вот что об этом молчат.",
                            visual="Крупно: звонит будильник, на экране 5:00"),
                ScriptBlock(section=Section.body, position=0, label="День первый — ад",
                            text="Хотелось всё бросить уже к обеду.", visual="Помятое лицо, кружка кофе, темно за окном"),
                ScriptBlock(section=Section.body, position=1, label="День десятый — результат",
                            text="До девяти утра я успевал больше, чем раньше за весь день.",
                            visual="Быстрая нарезка: тренировка, ноутбук, список задач с галочками"),
                ScriptBlock(section=Section.body, position=2, label="Главный секрет",
                            text="Фишка не в будильнике. Всё решает, во сколько ты ложишься.",
                            visual="Смена кадра: кровать, часы показывают 22:00"),
                ScriptBlock(section=Section.body, position=3, label="Как начать",
                            text="Сдвигай подъём на 15 минут, а не сразу на два часа.", visual="Говорящая голова, жест «чуть-чуть»"),
                ScriptBlock(section=Section.cta, text="Подпишись — во второй части расскажу, что делать в эти утренние часы.",
                            visual="Указываю на кнопку подписки"),
            ],
        )
        first.tags = get_or_create_tags(s, ["Продуктивность", "Привычки", "Утро"])
    print(f"Демо-данные записаны: {len(VIEWS)} рилсов @{ACCOUNT}")


if __name__ == "__main__":
    main()
