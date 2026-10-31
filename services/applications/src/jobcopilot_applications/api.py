from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from jobcopilot_applications import events, stats
from jobcopilot_applications.deps import Cache, Http, Session
from jobcopilot_applications.models import ApplicationRow, StatusEventRow
from jobcopilot_applications.schemas import (
    Application,
    ApplicationCreate,
    ApplicationSummary,
    ApplicationUpdate,
    EventSource,
    Stats,
    Status,
)
from jobcopilot_applications.upstream import (
    UpstreamError,
    contact_email,
    fetch_offer,
    latest_documents,
)

router = APIRouter(tags=["applications"])


async def get_row(session: Session, application_id: UUID) -> ApplicationRow:
    row = await session.get(ApplicationRow, application_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Candidature introuvable.")
    return row


def change_status(row: ApplicationRow, new: Status, source: EventSource) -> bool:
    if row.status == new:
        return False
    row.events.append(StatusEventRow(from_status=row.status, to_status=new, source=source))
    row.status = new
    if new != "draft" and row.applied_at is None:
        row.applied_at = datetime.now(UTC)
    return True


@router.get("/stats", response_model=Stats)
async def get_stats(session: Session, cache: Cache) -> Stats:
    """Chiffres du tableau de bord, en cache 15 min et recalculés après chaque modification."""
    if (hit := await stats.cached(cache)) is not None:
        return hit
    rows = list((await session.scalars(select(ApplicationRow))).all())
    result = stats.compute_stats(rows)
    await stats.store(cache, result)
    return result


@router.get("/applications", response_model=list[ApplicationSummary])
async def list_applications(
    session: Session,
    status_filter: Annotated[Status | None, Query(alias="status")] = None,
    offer_id: int | None = None,
) -> list[ApplicationRow]:
    """Les candidatures, les plus récemment modifiées d'abord."""
    query = select(ApplicationRow).order_by(ApplicationRow.updated_at.desc())
    if status_filter:
        query = query.where(ApplicationRow.status == status_filter)
    if offer_id is not None:
        query = query.where(ApplicationRow.offer_id == offer_id)
    return list(await session.scalars(query))


@router.post("/applications", response_model=Application, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate, session: Session, cache: Cache, http: Http, response: Response
) -> ApplicationRow:
    """Crée la candidature d'une offre, avec ses derniers documents générés.

    Une offre n'a qu'une candidature : la redemander renvoie l'existante (200).
    """
    if payload.offer_id is not None:
        existing = await session.scalar(
            select(ApplicationRow).where(ApplicationRow.offer_id == payload.offer_id)
        )
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            return existing
        try:
            offer = await fetch_offer(http, payload.offer_id, payload.search)
        except UpstreamError as exc:
            raise HTTPException(exc.status_code, str(exc)) from exc
        documents = await latest_documents(http, payload.offer_id)
        row = ApplicationRow(
            offer_id=payload.offer_id,
            search_id=payload.search,
            title=payload.title or offer["title"],
            company=payload.company or offer.get("company"),
            location=payload.location or offer.get("location"),
            url=payload.url or offer.get("url"),
            source=offer.get("source"),
            description=offer.get("description"),
            contact_email=payload.contact_email or contact_email(offer.get("description")),
            cv_document_id=documents.get("cv"),
            letter_document_id=documents.get("letter"),
        )
    else:
        row = ApplicationRow(
            title=(payload.title or "").strip(),
            company=payload.company,
            location=payload.location,
            url=payload.url,
            source="manuel",
            contact_email=payload.contact_email,
        )
    row.notes = payload.notes
    row.status = "draft"
    row.events = [StatusEventRow(from_status=None, to_status="draft", source="manual")]
    change_status(row, payload.status, "manual")
    session.add(row)
    try:
        await session.commit()
    except IntegrityError:
        # Deux clics simultanés sur « Postuler » : la seconde requête renvoie la fiche créée.
        await session.rollback()
        existing = await session.scalar(
            select(ApplicationRow).where(ApplicationRow.offer_id == payload.offer_id)
        )
        if existing is None:
            raise
        response.status_code = status.HTTP_200_OK
        return existing
    await session.refresh(row)
    await stats.invalidate(cache)
    await events.publish(
        cache,
        events.APPLICATION_CREATED,
        {
            "application_id": str(row.id),
            "offer_id": str(row.offer_id or ""),
            "status": row.status,
        },
    )
    return row


@router.get("/applications/{application_id}", response_model=Application)
async def get_application(session: Session, application_id: UUID) -> ApplicationRow:
    return await get_row(session, application_id)


@router.patch("/applications/{application_id}", response_model=Application)
async def update_application(
    application_id: UUID, payload: ApplicationUpdate, session: Session, cache: Cache
) -> ApplicationRow:
    row = await get_row(session, application_id)
    previous = row.status
    fields = payload.model_dump(exclude_unset=True, exclude={"status", "status_source"})
    for name, value in fields.items():
        setattr(row, name, value)
    changed = payload.status is not None and change_status(
        row, payload.status, payload.status_source
    )
    row.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(row)
    await stats.invalidate(cache)
    if changed:
        await events.publish(
            cache,
            events.STATUS_CHANGED,
            {
                "application_id": str(row.id),
                "from": previous,
                "to": row.status,
                "source": payload.status_source,
            },
        )
    return row


@router.post("/applications/{application_id}/follow-up", response_model=Application)
async def follow_up(application_id: UUID, session: Session, cache: Cache) -> ApplicationRow:
    """Enregistre une relance, même si la candidature est déjà « Relancée » : le délai repart."""
    row = await get_row(session, application_id)
    if row.status not in {"sent", "followed_up"}:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Seule une candidature envoyée ou relancée se relance."
        )
    previous = row.status
    row.events.append(
        StatusEventRow(from_status=previous, to_status="followed_up", source="manual")
    )
    row.status = "followed_up"
    row.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(row)
    await stats.invalidate(cache)
    await events.publish(
        cache,
        events.STATUS_CHANGED,
        {"application_id": str(row.id), "from": previous, "to": row.status, "source": "manual"},
    )
    return row


@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(session: Session, cache: Cache, application_id: UUID) -> None:
    row = await get_row(session, application_id)
    await session.delete(row)
    await session.commit()
    await stats.invalidate(cache)
