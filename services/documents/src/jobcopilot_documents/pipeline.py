"""Génération en tâche de fond : chaque étape est notée en base, l'interface la suit en SSE."""

import asyncio
import uuid
from dataclasses import dataclass
from datetime import date

import httpx
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from jobcopilot_common.llm import LLMError
from jobcopilot_documents.compose import build_cv, build_letter
from jobcopilot_documents.language import detect_language
from jobcopilot_documents.models import DocumentRow, GenerationRow
from jobcopilot_documents.render import RenderError, render
from jobcopilot_documents.schemas import GenerationRequest, Kind, Language
from jobcopilot_documents.storage import Storage
from jobcopilot_documents.upstream import UpstreamError, fetch_offer, fetch_profile
from jobcopilot_documents.veracity import check_cv, check_letter
from jobcopilot_documents.writer import Writer

STEPS = [
    ("read", "Lecture de l'offre"),
    ("select", "Sélection des expériences"),
    ("write", "Rédaction"),
    ("layout", "Mise en page"),
]
EVENTS_STREAM = "document.generated"
TEMPLATES: dict[Kind, str] = {"cv": "cv", "letter": "letter"}


@dataclass
class Context:
    sessions: async_sessionmaker[AsyncSession]
    http: httpx.AsyncClient
    writer: Writer
    storage: Storage
    cache: Redis


def s3_key(generation_id: uuid.UUID, kind: Kind, version: int) -> str:
    return f"{generation_id}/{kind}-v{version}.pdf"


async def store_document(
    ctx: Context, session: AsyncSession, row: GenerationRow, kind: Kind, content, language: Language
) -> None:
    pdf, pages = await render(TEMPLATES[kind], content)
    key = s3_key(row.id, kind, 1)
    await ctx.storage.put(key, pdf)
    session.add(
        DocumentRow(
            generation_id=row.id,
            offer_id=row.offer_id,
            kind=kind,
            language=language,
            version=1,
            pages=pages,
            s3_key=key,
            content=content.model_dump(mode="json"),
        )
    )


async def run(ctx: Context, generation_id: uuid.UUID, request: GenerationRequest) -> None:
    async with ctx.sessions() as session:
        row = await session.get(GenerationRow, generation_id)
        assert row is not None

        async def advance(step: int) -> None:
            row.step = step
            await session.commit()

        try:
            offer = await fetch_offer(ctx.http, request.offer_id)
            profile = await fetch_profile(ctx.http)
            language = request.language or detect_language(f"{offer.title} {offer.description}")
            row.offer_title, row.company, row.language = offer.title, offer.company, language
            await advance(1)

            selection = await ctx.writer.select(profile, offer)
            await advance(2)

            draft = await ctx.writer.write_cv(profile, offer, selection, language)
            cv = build_cv(profile, selection.experience_indexes, draft, language)
            source_language = detect_language(profile.identity.summary or profile.identity.headline)
            warnings = check_cv(profile, cv, same_language=source_language == language)
            letter = None
            if request.letter:
                letter_draft = await ctx.writer.write_letter(profile, offer, selection, language)
                letter = build_letter(profile, offer, letter_draft, language, date.today())
                warnings += check_letter(profile, offer, letter)
            row.warnings = [warning.model_dump() for warning in warnings]
            await advance(3)

            await store_document(ctx, session, row, "cv", cv, language)
            if letter is not None:
                await store_document(ctx, session, row, "letter", letter, language)
            row.step, row.status = len(STEPS), "done"
            await session.commit()
            await session.refresh(row)
            await ctx.cache.xadd(
                EVENTS_STREAM,
                {"generation_id": str(row.id), "offer_id": str(row.offer_id)}
                | {f"{doc.kind}_id": str(doc.id) for doc in row.documents},
                maxlen=1000,
            )
        except (UpstreamError, LLMError, RenderError) as exc:
            row.status, row.error = "error", str(exc)
            await session.commit()
        except Exception:
            row.status, row.error = "error", "Erreur inattendue pendant la génération."
            await session.commit()
            raise


_tasks: set[asyncio.Task] = set()


def start(ctx: Context, generation_id: uuid.UUID, request: GenerationRequest) -> None:
    """Lance la génération sans bloquer la requête (référence gardée contre le ramasse-miettes)."""
    task = asyncio.create_task(run(ctx, generation_id, request))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
