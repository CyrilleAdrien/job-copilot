"""Rendu PDF des documents avec Typst (compilateur embarqué, polices fournies)."""

import asyncio
import json
from pathlib import Path

import typst
from pydantic import BaseModel

from jobcopilot_documents.compose import visible_cv
from jobcopilot_documents.schemas import CvContent

TEMPLATES = Path(__file__).parent / "templates"
FONTS = TEMPLATES / "fonts"


class RenderError(Exception):
    pass


def compile_typst(template: str, content: BaseModel, photo: bytes | None = None, **options):
    if isinstance(content, CvContent):
        content = visible_cv(content)
    inputs = {"data": content.model_dump_json()}
    if photo is not None:
        # Typst ne reçoit que du texte : la photo passe en liste d'octets.
        inputs["photo"] = json.dumps(list(photo))
    try:
        return typst.compile(
            str(TEMPLATES / f"{template}.typ"),
            font_paths=[str(FONTS)],
            sys_inputs=inputs,
            **options,
        )
    except RuntimeError as exc:
        raise RenderError(f"Mise en page impossible : {exc}") from exc


def render_sync(template: str, content: BaseModel, photo: bytes | None = None) -> bytes:
    return compile_typst(template, content, photo)


def render_pages_sync(
    template: str, content: BaseModel, ppi: int = 144, photo: bytes | None = None
) -> list[bytes]:
    """Une image PNG par page : ne sert plus qu'à compter les pages, à très basse définition."""
    pages = compile_typst(template, content, photo, format="png", ppi=ppi)
    return pages if isinstance(pages, list) else [pages]


async def render(
    template: str, content: BaseModel, photo: bytes | None = None
) -> tuple[bytes, int]:
    """PDF et nombre de pages."""
    pdf = await asyncio.to_thread(render_sync, template, content, photo)
    pages = await asyncio.to_thread(render_pages_sync, template, content, 8, photo)
    return pdf, len(pages)


def render_svg_pages_sync(
    template: str, content: BaseModel, photo: bytes | None = None
) -> list[bytes]:
    """L'aperçu dans l'application : du vectoriel, net à tous les zooms et sur tous les écrans."""
    pages = compile_typst(template, content, photo, format="svg")
    return pages if isinstance(pages, list) else [pages]


async def render_page(
    template: str, content: BaseModel, page: int, photo: bytes | None = None
) -> bytes | None:
    pages = await asyncio.to_thread(render_svg_pages_sync, template, content, photo)
    return pages[page - 1] if 1 <= page <= len(pages) else None
