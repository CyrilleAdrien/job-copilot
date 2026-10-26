"""Rendu PDF des documents avec Typst (compilateur embarqué, polices fournies)."""

import asyncio
from pathlib import Path

import typst
from pydantic import BaseModel

TEMPLATES = Path(__file__).parent / "templates"
FONTS = TEMPLATES / "fonts"


class RenderError(Exception):
    pass


def compile_typst(template: str, content: BaseModel, **options):
    try:
        return typst.compile(
            str(TEMPLATES / f"{template}.typ"),
            font_paths=[str(FONTS)],
            sys_inputs={"data": content.model_dump_json()},
            **options,
        )
    except RuntimeError as exc:
        raise RenderError(f"Mise en page impossible : {exc}") from exc


def render_sync(template: str, content: BaseModel) -> bytes:
    return compile_typst(template, content)


def render_pages_sync(template: str, content: BaseModel, ppi: int = 144) -> list[bytes]:
    """Une image PNG par page, pour l'aperçu dans l'application."""
    pages = compile_typst(template, content, format="png", ppi=ppi)
    return pages if isinstance(pages, list) else [pages]


async def render(template: str, content: BaseModel) -> tuple[bytes, int]:
    """PDF et nombre de pages."""
    pdf = await asyncio.to_thread(render_sync, template, content)
    pages = await asyncio.to_thread(render_pages_sync, template, content, 8)
    return pdf, len(pages)


async def render_page(template: str, content: BaseModel, page: int) -> bytes | None:
    pages = await asyncio.to_thread(render_pages_sync, template, content)
    return pages[page - 1] if 1 <= page <= len(pages) else None
