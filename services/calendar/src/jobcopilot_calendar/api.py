from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select

from jobcopilot_calendar import ics
from jobcopilot_calendar.crypto import SecretKeyMissing, encrypt
from jobcopilot_calendar.deps import DEMO_URL, AccountRemote, Http, RemoteFactory, Session
from jobcopilot_calendar.models import AccountRow, EventRow
from jobcopilot_calendar.remote import RemoteError
from jobcopilot_calendar.schemas import (
    Account,
    AccountCreate,
    Credentials,
    Event,
    EventCreate,
    EventUpdate,
    HelpLink,
    Provider,
    RemoteCalendarOut,
    SyncReport,
)
from jobcopilot_calendar.settings import get_calendar_settings
from jobcopilot_calendar.sync import current_account, push, push_all, remove
from jobcopilot_calendar.upstream import UpstreamError, advance_status, get_application

router = APIRouter(tags=["calendar"])

PROVIDERS = [
    Provider(
        id="icloud",
        label="iCloud",
        url="https://caldav.icloud.com",
        help="Tes événements apparaissent dans Calendrier sur Mac, iPhone et iPad.",
        steps=[
            "L'authentification à deux facteurs doit être active sur ton identifiant Apple.",
            "Ouvre ton compte Apple, rubrique Connexion et sécurité.",
            "Choisis « Mots de passe pour app », puis crée-en un nommé « Job Copilot ».",
            "Colle-le ici avec ton identifiant Apple (ton adresse e-mail), puis choisis "
            "le calendrier où recopier les entretiens.",
        ],
        links=[
            HelpLink(label="Compte Apple", url="https://account.apple.com/account/manage"),
            HelpLink(
                label="Aide Apple : mots de passe pour app",
                url="https://support.apple.com/fr-fr/102654",
            ),
        ],
    ),
    Provider(
        id="google",
        label="Google Agenda",
        url="",
        caldav=False,
        help="Google n'accepte pas les mots de passe d'application en CalDAV. Ajoute chaque "
        "événement avec son bouton « Google Agenda », ou importe le fichier .ics.",
        steps=[
            "Sur un événement, clique sur « Google Agenda » : Google ouvre l'événement prérempli, "
            "il reste à l'enregistrer.",
            "Pour tout ajouter d'un coup, télécharge le fichier .ics du calendrier.",
            "Dans Google Agenda, ouvre Paramètres, puis Importer et exporter, "
            "et importe ce fichier.",
            "Un abonnement par URL ne marche pas ici : Google lit les flux depuis ses serveurs, "
            "et Job Copilot tourne sur ton ordinateur.",
        ],
        links=[
            HelpLink(
                label="Importer dans Google Agenda",
                url="https://calendar.google.com/calendar/r/settings/export",
            ),
        ],
    ),
    Provider(
        id="other",
        label="Autre",
        url="",
        help="Tout serveur CalDAV : Fastmail, Nextcloud, Synology, Infomaniak...",
        steps=[
            "Cherche « CalDAV » dans l'aide de ton fournisseur : il donne l'adresse du serveur "
            "(par exemple https://caldav.fastmail.com ou https://cloud.exemple.fr/remote.php/dav).",
            "Crée un mot de passe d'application si ton fournisseur en propose, sinon utilise "
            "le mot de passe du compte.",
            "Colle l'adresse, ton identifiant et le mot de passe, puis choisis le calendrier.",
        ],
    ),
]


@router.get("/providers", response_model=list[Provider])
async def providers() -> list[Provider]:
    demo = Provider(
        id="demo",
        label="Démonstration",
        url=DEMO_URL,
        help="Calendrier fictif, en mémoire : pour essayer la synchronisation sans compte.",
    )
    return [*PROVIDERS, demo] if get_calendar_settings().calendar_demo else PROVIDERS


# --- Calendrier distant (CalDAV) ---


@router.post("/accounts/discover", response_model=list[RemoteCalendarOut])
async def discover(payload: Credentials, remote_for: RemoteFactory) -> list[RemoteCalendarOut]:
    """Vérifie les identifiants et liste les calendriers où l'on peut écrire."""
    if not payload.url.startswith(("https://", DEMO_URL)) and not payload.url.startswith(
        "http://localhost"
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Adresse CalDAV en https:// attendue."
        )
    try:
        found = await remote_for(payload.url, payload.username, payload.password).calendars()
    except RemoteError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    if not found:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Aucun calendrier d'événements sur ce compte."
        )
    return [RemoteCalendarOut(url=c.url, name=c.name) for c in found]


@router.get("/accounts", response_model=list[Account])
async def list_accounts(session: Session) -> list[AccountRow]:
    return list((await session.scalars(select(AccountRow))).all())


@router.post("/accounts", response_model=Account, status_code=status.HTTP_201_CREATED)
async def add_account(
    payload: AccountCreate, session: Session, account_remote: AccountRemote
) -> AccountRow:
    """Un seul calendrier connecté : les événements à venir y sont recopiés tout de suite."""
    if await current_account(session) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Un calendrier est déjà connecté.")
    try:
        password = encrypt(payload.password)
    except SecretKeyMissing as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    row = AccountRow(
        provider=payload.provider,
        url=payload.url,
        username=payload.username,
        password_encrypted=password,
        calendar_url=payload.calendar_url,
        calendar_name=payload.calendar_name,
    )
    session.add(row)
    await session.flush()
    await push_all(session, account_remote, datetime.now(UTC) - timedelta(days=1))
    await session.refresh(row)
    return row


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(account_id: UUID, session: Session) -> None:
    """Les événements déjà recopiés restent dans le calendrier distant."""
    row = await session.get(AccountRow, account_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Calendrier inconnu.")
    await session.delete(row)
    await session.commit()


@router.post("/sync", response_model=SyncReport)
async def sync(session: Session, account_remote: AccountRemote) -> SyncReport:
    if await current_account(session) is None:
        return SyncReport(pushed=0, errors=[])
    pushed, errors = await push_all(session, account_remote, datetime.now(UTC) - timedelta(days=1))
    return SyncReport(pushed=pushed, errors=errors)


# --- Événements ---


async def get_event(session: Session, event_id: UUID) -> EventRow:
    row = await session.get(EventRow, event_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Événement inconnu.")
    return row


@router.get("/events", response_model=list[Event])
async def list_events(
    session: Session,
    start: Annotated[datetime | None, Query(alias="from")] = None,
    end: Annotated[datetime | None, Query(alias="to")] = None,
    application_id: UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 500,
) -> list[EventRow]:
    query = select(EventRow).order_by(EventRow.starts_at)
    if start:
        query = query.where(EventRow.ends_at >= start)
    if end:
        query = query.where(EventRow.starts_at < end)
    if application_id:
        query = query.where(EventRow.application_id == application_id)
    return list((await session.scalars(query.limit(limit))).all())


@router.post("/events", response_model=Event, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate, session: Session, http: Http, account_remote: AccountRemote
) -> Event:
    changed = False
    if payload.application_id:
        try:
            application = await get_application(http, str(payload.application_id))
            if application is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Candidature inconnue.")
            if payload.advance_status:
                changed = await advance_status(http, application, payload.kind)
        except UpstreamError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    row = EventRow(**payload.model_dump(exclude={"advance_status"}))
    session.add(row)
    await session.flush()
    await push(session, row, account_remote)
    await session.commit()
    await session.refresh(row)
    return Event.model_validate(row).model_copy(update={"status_changed": changed})


@router.patch("/events/{event_id}", response_model=Event)
async def update_event(
    event_id: UUID, payload: EventUpdate, session: Session, account_remote: AccountRemote
) -> EventRow:
    row = await get_event(session, event_id)
    for name, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, name, value)
    if row.ends_at <= row.starts_at:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "La fin doit être après le début."
        )
    row.sequence += 1
    await push(session, row, account_remote)
    await session.commit()
    await session.refresh(row)
    return row


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(event_id: UUID, session: Session, account_remote: AccountRemote) -> None:
    row = await get_event(session, event_id)
    error = await remove(session, row, account_remote)
    if error:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Non supprimé du calendrier connecté : {error}"
        )
    await session.delete(row)
    await session.commit()


# --- Export iCalendar ---

ICS = "text/calendar; charset=utf-8"


@router.get("/events/{event_id}/ics")
async def event_ics(event_id: UUID, session: Session) -> Response:
    row = await get_event(session, event_id)
    return Response(
        ics.calendar([row], get_calendar_settings().reminder_minutes),
        media_type=ICS,
        headers={"Content-Disposition": f'attachment; filename="evenement-{row.id}.ics"'},
    )


@router.get("/feed.ics")
async def feed(session: Session, download: bool = False) -> Response:
    """Flux auquel s'abonne Calendrier (Apple) ou Thunderbird ; download=true pour l'importer."""
    settings = get_calendar_settings()
    since = datetime.now(UTC) - timedelta(days=settings.feed_past_days)
    rows = (
        await session.scalars(
            select(EventRow).where(EventRow.ends_at >= since).order_by(EventRow.starts_at)
        )
    ).all()
    headers = {"Content-Disposition": 'attachment; filename="job-copilot.ics"'} if download else {}
    return Response(
        ics.calendar(list(rows), settings.reminder_minutes), media_type=ICS, headers=headers
    )
