import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_common.db import get_session
from jobcopilot_documents import pipeline
from jobcopilot_documents.compose import build_cv
from jobcopilot_documents.deps import Ctx, get_llm
from jobcopilot_documents.models import DocumentRow, GenerationRow
from jobcopilot_documents.render import RenderError, render, render_page
from jobcopilot_documents.schemas import (
    CvContent,
    DocumentDetail,
    DocumentInfo,
    Generation,
    GenerationRequest,
    Language,
    LetterContent,
    LLMStatus,
    ProfilePreview,
    Step,
    Warning,
)
from jobcopilot_documents.settings import get_documents_settings
from jobcopilot_documents.upstream import UpstreamError, fetch_profile

router = APIRouter(tags=["documents"])
Session = Annotated[AsyncSession, Depends(get_session)]
CONTENT = {"cv": CvContent, "letter": LetterContent}
POLL_SECONDS = 0.4
HEARTBEAT_SECONDS = 15


def steps(row: GenerationRow) -> list[Step]:
    def state(index: int) -> str:
        if row.status == "done" or index < row.step:
            return "done"
        if index == row.step:
            return "error" if row.status == "error" else "running"
        return "pending"

    return [
        Step(key=key, label=label, state=state(i)) for i, (key, label) in enumerate(pipeline.STEPS)
    ]


def to_generation(row: GenerationRow) -> Generation:
    return Generation(
        id=row.id,
        offer_id=row.offer_id,
        offer_title=row.offer_title,
        company=row.company,
        language=row.language,
        status=row.status,
        steps=steps(row),
        error=row.error,
        warnings=[Warning.model_validate(w) for w in row.warnings],
        documents=[DocumentInfo.model_validate(doc) for doc in row.documents],
        created_at=row.created_at,
    )


async def load_generation(session: AsyncSession, generation_id: uuid.UUID) -> GenerationRow:
    row = await session.get(GenerationRow, generation_id, populate_existing=True)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Génération introuvable.")
    return row


@router.post("/generations", response_model=Generation, status_code=status.HTTP_202_ACCEPTED)
async def create_generation(request: GenerationRequest, session: Session, ctx: Ctx) -> Generation:
    """Lance la génération du CV et de la lettre ; /events en suit l'avancement."""
    row = GenerationRow(
        id=uuid.uuid4(), offer_id=request.offer_id, with_letter=request.letter, status="running"
    )
    row.step, row.warnings = 0, []
    session.add(row)
    await session.commit()
    row = await load_generation(session, row.id)
    pipeline.start(ctx, row.id, request)
    return to_generation(row)


@router.get("/generations", response_model=list[Generation])
async def list_generations(
    session: Session, offer_id: int | None = None, limit: Annotated[int, Query(le=50)] = 10
) -> list[Generation]:
    query = select(GenerationRow).order_by(GenerationRow.created_at.desc()).limit(limit)
    if offer_id is not None:
        query = query.where(GenerationRow.offer_id == offer_id)
    return [to_generation(row) for row in await session.scalars(query)]


@router.get("/generations/{generation_id}", response_model=Generation)
async def read_generation(generation_id: uuid.UUID, session: Session) -> Generation:
    return to_generation(await load_generation(session, generation_id))


@router.get("/generations/{generation_id}/events")
async def generation_events(generation_id: uuid.UUID, session: Session) -> StreamingResponse:
    """Flux SSE : un événement `progress` à chaque changement, puis `done` ou `error`."""
    await load_generation(session, generation_id)

    async def stream() -> AsyncIterator[str]:
        last, idle = None, 0.0
        while True:
            session.expire_all()
            generation = to_generation(await load_generation(session, generation_id))
            payload = generation.model_dump_json()
            if payload != last:
                last, idle = payload, 0.0
                event = "progress" if generation.status == "running" else generation.status
                yield f"event: {event}\ndata: {payload}\n\n"
                if generation.status != "running":
                    return
            elif idle >= HEARTBEAT_SECONDS:
                idle = 0.0
                yield ": keep-alive\n\n"
            await asyncio.sleep(POLL_SECONDS)
            idle += POLL_SECONDS

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def load_document(session: AsyncSession, document_id: uuid.UUID) -> DocumentRow:
    row = await session.get(DocumentRow, document_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable.")
    return row


@router.get("/documents/{document_id}", response_model=DocumentDetail)
async def read_document(document_id: uuid.UUID, session: Session) -> DocumentDetail:
    row = await load_document(session, document_id)
    return DocumentDetail.model_validate(row, from_attributes=True)


@router.get("/documents/{document_id}/pdf")
async def read_pdf(document_id: uuid.UUID, session: Session, ctx: Ctx) -> Response:
    row = await load_document(session, document_id)
    pdf = await ctx.storage.get(row.s3_key)
    name = row.content.get("name") or row.content.get("signature") or "document"
    prefix = "CV" if row.kind == "cv" else ("Lettre" if row.language == "fr" else "Letter")
    filename = f"{prefix} {name}.pdf"
    ascii_name = filename.encode("ascii", "ignore").decode() or "document.pdf"
    return Response(
        pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{ascii_name}"; '
            f"filename*=UTF-8''{quote(filename)}"
        },
    )


@router.get("/documents/{document_id}/pages/{page}")
async def read_page(document_id: uuid.UUID, page: int, session: Session) -> Response:
    """Aperçu PNG d'une page, rendu à la volée depuis le contenu enregistré."""
    row = await load_document(session, document_id)
    model = CONTENT[row.kind].model_validate(row.content)
    image = await render_page(pipeline.TEMPLATES[row.kind], model, page)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page introuvable.")
    return Response(
        image, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.put("/documents/{document_id}/content", response_model=DocumentDetail)
async def update_content(
    document_id: uuid.UUID, content: dict, session: Session, ctx: Ctx
) -> DocumentDetail:
    """Enregistre le contenu modifié et refait le PDF dans une nouvelle version."""
    row = await load_document(session, document_id)
    try:
        model = CONTENT[row.kind].model_validate(content)
    except ValidationError as exc:
        errors = json.loads(exc.json(include_url=False, include_context=False))
        raise HTTPException(422, errors) from exc
    try:
        pdf, pages = await render(pipeline.TEMPLATES[row.kind], model)
    except RenderError as exc:
        raise HTTPException(422, str(exc)) from exc
    version = row.version + 1
    key = pipeline.s3_key(row.generation_id, row.kind, version)
    await ctx.storage.put(key, pdf)
    row.version, row.pages, row.s3_key = version, pages, key
    row.content = model.model_dump(mode="json")
    await session.commit()
    await session.refresh(row)
    return DocumentDetail.model_validate(row, from_attributes=True)


async def profile_cv(ctx: Ctx, language: Language) -> CvContent:
    """Le profil complet mis en page comme un CV, sans LLM ni offre."""
    try:
        profile = await fetch_profile(ctx.http)
    except UpstreamError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return build_cv(profile, list(range(len(profile.experiences))), None, language)


@router.get("/profile-preview", response_model=ProfilePreview)
async def profile_preview(ctx: Ctx, language: Language = "fr") -> ProfilePreview:
    _, pages = await render(pipeline.TEMPLATES["cv"], await profile_cv(ctx, language))
    return ProfilePreview(pages=pages)


@router.get("/profile-preview/pdf")
async def profile_preview_pdf(ctx: Ctx, language: Language = "fr") -> Response:
    pdf, _ = await render(pipeline.TEMPLATES["cv"], await profile_cv(ctx, language))
    return Response(pdf, media_type="application/pdf", headers={"Cache-Control": "no-store"})


@router.get("/profile-preview/pages/{page}")
async def profile_preview_page(ctx: Ctx, page: int, language: Language = "fr") -> Response:
    image = await render_page(pipeline.TEMPLATES["cv"], await profile_cv(ctx, language), page)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page introuvable.")
    return Response(image, media_type="image/png", headers={"Cache-Control": "no-store"})


@router.get("/llm", response_model=LLMStatus)
async def llm_status() -> LLMStatus:
    provider = get_documents_settings().llm_provider
    if provider == "demo":
        return LLMStatus(provider="demo", model="démonstration", ready=True)
    llm = get_llm()
    return LLMStatus(provider=provider, model=llm.model, ready=await llm.available())
