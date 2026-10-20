"""Экспорт сценария (md, txt, pdf) и списка рилсов (csv)."""

import csv
import io
from pathlib import Path

from fpdf import FPDF

from ..models import Reel, Script, ScriptBlock, Section


def _dot(s: str) -> str:
    s = s.strip()
    return s if s.endswith((".", "!", "?", "…", ":")) else f"{s}."


def _blocks(script: Script, section: Section) -> list[ScriptBlock]:
    return [b for b in script.blocks if b.section == section]


def _block_lines(b: ScriptBlock, md: bool) -> list[str]:
    head = f"{'**' + _dot(b.label) + '**' if md else _dot(b.label)} " if b.label else ""
    lines = [head + b.text]
    if b.visual:
        lines.append(f"_В кадре: {b.visual}_" if md else f"В кадре: {b.visual}")
    return lines


def script_text(reel: Reel, md: bool) -> str:
    s = reel.script
    h = (lambda t: f"## {t}") if md else (lambda t: t.upper())
    out = [f"# {s.title}" if md else s.title, "",
           f"{'**Идея:**' if md else 'Идея:'} {s.idea}",
           f"{'**Почему залетело:**' if md else 'Почему залетело:'} {s.why_it_works}", "", h("Хук")]
    for b in _blocks(s, Section.hook):
        out += _block_lines(b, md)
    out += ["", h("Скрипт")]
    for i, b in enumerate(_blocks(s, Section.body), start=1):
        first, *rest = _block_lines(b, md)
        out += [f"{i}. {first}", *[f"   {r}" for r in rest]]
    out += ["", h("Call to action")]
    for b in _blocks(s, Section.cta):
        out += _block_lines(b, md)
    out += ["", h("Описание к посту"), s.caption, "", f"Оригинал: {reel.url}"]
    return "\n".join(out)


# fpdf2 нужен TTF-шрифт с кириллицей — берём системный
FONT_CANDIDATES = [
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/Library/Fonts/Arial Unicode.ttf", "/Library/Fonts/Arial Unicode.ttf"),
    ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
]


def script_pdf(reel: Reel) -> bytes:
    regular, bold = next(((r, b) for r, b in FONT_CANDIDATES if Path(r).exists()), (None, None))
    if not regular:
        raise RuntimeError("Не найден шрифт с кириллицей для PDF")
    s = reel.script
    pdf = FPDF(format="A4")
    pdf.set_margins(18, 18, 18)
    pdf.add_font("Main", "", regular)
    pdf.add_font("Main", "B", bold if Path(bold).exists() else regular)
    pdf.add_page()

    def para(text: str, size: float = 11, style: str = "", gap: float = 2, gray: bool = False) -> None:
        pdf.set_font("Main", style, size)
        pdf.set_text_color(110 if gray else 25)
        pdf.multi_cell(0, size * 0.55, text)
        pdf.ln(gap)

    para(s.title, 20, "B", 4)
    para(f"Оригинал: {reel.url}", 9, gap=6, gray=True)
    para("Идея", 13, "B", 1)
    para(s.idea)
    para(f"Почему залетело: {s.why_it_works}", gap=6, gray=True)
    for title, section in (("Хук", Section.hook), ("Скрипт", Section.body), ("Call to action", Section.cta)):
        para(title, 13, "B", 1)
        for i, b in enumerate(_blocks(s, section), start=1):
            prefix = f"{i}. " if section == Section.body else ""
            para(prefix + (f"{_dot(b.label)} " if b.label else "") + b.text, gap=1)
            if b.visual:
                para(f"В кадре: {b.visual}", 9, gap=3, gray=True)
        pdf.ln(3)
    para("Описание к посту", 13, "B", 1)
    para(s.caption)
    return bytes(pdf.output())


def reels_csv(reels: list[Reel]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["Место", "Аккаунт", "Ссылка", "Залёт", "Просмотры", "Лайки", "Комментарии",
                "Длительность, сек", "Опубликован", "Теги", "Сценарий", "Описание"])
    for i, r in enumerate(reels, start=1):
        w.writerow([i, r.competitor.username, r.url, f"{r.score:.2f}".replace(".", ","), r.views, r.likes,
                    r.comments_count, round(r.duration_sec or 0), r.posted_at.date().isoformat() if r.posted_at else "",
                    ", ".join(t.name for t in r.tags), r.script.title if r.script else "", r.caption.replace("\n", " ")])
    # BOM, чтобы Excel открыл кириллицу без кракозябр
    return ("\ufeff" + buf.getvalue()).encode("utf-8")
