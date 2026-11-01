import asyncio
import logging
from datetime import UTC, datetime
from email.message import EmailMessage
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_common.crypto import SecretKeyMissing, encrypt
from jobcopilot_common.llm import LLMError
from jobcopilot_mail.classify import STATUS_FOR, Category
from jobcopilot_mail.deps import (
    DEMO_HOST,
    Cache,
    ClassifierDep,
    DrafterDep,
    Http,
    MailboxFactoryDep,
    SenderFactoryDep,
    Session,
    smtp_server_of,
)
from jobcopilot_mail.drafting import DraftContext
from jobcopilot_mail.mailbox import ImapMailbox, MailboxError
from jobcopilot_mail.models import AccountRow, MessageRow, ReplyRow
from jobcopilot_mail.outbox import Draft, SendError, SendUncertain, build_reply, smtp_server
from jobcopilot_mail.schemas import (
    Account,
    AccountCreate,
    DraftOut,
    DraftRequest,
    HelpLink,
    Message,
    MessageUpdate,
    Provider,
    Reply,
    ReplyCreate,
    Review,
    SmtpServer,
    SyncReport,
)
from jobcopilot_mail.settings import get_mail_settings
from jobcopilot_mail.sync import sync_account
from jobcopilot_mail.upstream import UpstreamError, list_candidates, profile_name, set_status

log = logging.getLogger(__name__)
router = APIRouter(tags=["mail"])

PROVIDERS = [
    Provider(
        id="gmail",
        label="Gmail",
        host="imap.gmail.com",
        help="Crée un mot de passe d'application sur myaccount.google.com/apppasswords "
        "(validation en deux étapes requise).",
        steps=[
            "Active la validation en deux étapes de ton compte Google, si ce n'est pas déjà fait.",
            "Ouvre la page Mots de passe des applications et connecte-toi.",
            "Donne un nom, par exemple « Job Copilot », puis clique sur Créer.",
            "Copie les 16 caractères affichés, sans les espaces, et colle-les ici.",
        ],
        links=[
            HelpLink(
                label="Validation en deux étapes",
                url="https://myaccount.google.com/signinoptions/twosv",
            ),
            HelpLink(
                label="Mots de passe des applications",
                url="https://myaccount.google.com/apppasswords",
            ),
        ],
    ),
    Provider(
        id="icloud",
        label="iCloud",
        host="imap.mail.me.com",
        help="Crée un mot de passe pour app sur account.apple.com, rubrique Connexion et sécurité.",
        steps=[
            "L'authentification à deux facteurs doit être active sur ton identifiant Apple.",
            "Ouvre ton compte Apple, rubrique Connexion et sécurité.",
            "Choisis « Mots de passe pour app », puis crée-en un nommé « Job Copilot ».",
            "Copie le mot de passe affiché et colle-le ici. "
            "L'adresse est ton adresse iCloud (@icloud.com, @me.com ou @mac.com).",
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
        id="outlook",
        label="Outlook",
        host="outlook.office365.com",
        help="Microsoft limite l'accès IMAP par mot de passe : si la connexion échoue, "
        "transfère tes réponses vers une boîte Gmail ou iCloud.",
        steps=[
            "Active la vérification en deux étapes dans la sécurité de ton compte Microsoft.",
            "Dans « Options de sécurité avancées », crée un mot de passe d'application.",
            "Copie-le et colle-le ici.",
            "Si la connexion est refusée, ton compte n'accepte plus l'IMAP par mot de passe : "
            "crée un transfert automatique de tes mails vers Gmail ou iCloud, "
            "puis connecte cette boîte.",
        ],
        links=[
            HelpLink(
                label="Sécurité du compte Microsoft", url="https://account.microsoft.com/security"
            ),
            HelpLink(
                label="Mots de passe d'application",
                url="https://account.live.com/proofs/AppPassword",
            ),
        ],
    ),
    Provider(
        id="other",
        label="Autre",
        host="",
        help="Serveur IMAP et port fournis par ton hébergeur.",
        steps=[
            "Cherche « IMAP » dans l'aide de ton fournisseur : il donne le serveur "
            "(par exemple imap.exemple.fr) et le port, en général 993 (SSL).",
            "Si ton fournisseur propose des mots de passe d'application, crée-en un. "
            "Sinon, utilise le mot de passe de la boîte.",
            "Vérifie que l'accès IMAP est activé dans les réglages de la messagerie.",
        ],
    ),
]


@router.get("/providers", response_model=list[Provider])
async def providers() -> list[Provider]:
    demo = Provider(
        id="demo",
        label="Démonstration",
        host=DEMO_HOST,
        help="Boîte fictive : des réponses inventées à tes candidatures envoyées.",
    )
    return [*PROVIDERS, demo] if get_mail_settings().mail_demo else PROVIDERS


async def account_out(session: Session, row: AccountRow) -> Account:
    count = await session.scalar(
        select(func.count()).select_from(MessageRow).where(MessageRow.account_id == row.id)
    )
    host, port = (None, None) if row.host == DEMO_HOST else smtp_server_of(row)
    return Account.model_validate(row).model_copy(
        update={"messages": count or 0, "smtp_host": host, "smtp_port": port}
    )


async def check_sending(row: AccountRow, senders: SenderFactoryDep) -> None:
    """Teste l'envoi sans envoyer de mail. Une panne n'empêche pas de lire la boîte."""
    row.smtp_checked_at = datetime.now(UTC)
    try:
        await asyncio.to_thread(senders(row).check)
    except (SendError, SecretKeyMissing) as exc:
        row.smtp_error = str(exc)
    else:
        row.smtp_error = None


@router.get("/accounts", response_model=list[Account])
async def list_accounts(session: Session) -> list[Account]:
    rows = (await session.scalars(select(AccountRow).order_by(AccountRow.created_at))).all()
    return [await account_out(session, row) for row in rows]


@router.post("/accounts", response_model=Account, status_code=status.HTTP_201_CREATED)
async def add_account(
    payload: AccountCreate, session: Session, senders: SenderFactoryDep
) -> Account:
    """Vérifie la lecture avant d'enregistrer : un compte enregistré est un compte qui se lit.

    L'envoi est testé aussi, mais sa panne ne bloque pas : la boîte reste utile en lecture.
    """
    demo = payload.host == DEMO_HOST
    if demo and not get_mail_settings().mail_demo:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "La boîte de démonstration est désactivée."
        )
    username = payload.username or payload.email
    if not demo:
        if not payload.password:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Mot de passe manquant.")
        mailbox = ImapMailbox(
            payload.host,
            payload.port,
            username,
            payload.password,
            payload.folder,
            get_mail_settings().imap_timeout,
        )
        try:
            await asyncio.to_thread(mailbox.check)
        except MailboxError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    try:
        secret = encrypt(payload.password) if not demo else ""
    except SecretKeyMissing as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    row = AccountRow(
        email=payload.email,
        host=payload.host,
        port=payload.port,
        username=username,
        password_encrypted=secret,
        folder=payload.folder,
    )
    if not demo:
        row.smtp_host, row.smtp_port = (
            (payload.smtp_host, payload.smtp_port)
            if payload.smtp_host and payload.smtp_port
            else smtp_server(payload.host)
        )
    await check_sending(row, senders)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return await account_out(session, row)


async def get_account(session: Session, account_id: UUID) -> AccountRow:
    row = await session.get(AccountRow, account_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Compte introuvable.")
    return row


@router.post("/accounts/{account_id}/smtp-check", response_model=Account)
async def test_sending(account_id: UUID, session: Session, senders: SenderFactoryDep) -> Account:
    row = await get_account(session, account_id)
    await check_sending(row, senders)
    await session.commit()
    return await account_out(session, row)


@router.put("/accounts/{account_id}/smtp", response_model=Account)
async def set_smtp_server(
    account_id: UUID, payload: SmtpServer, session: Session, senders: SenderFactoryDep
) -> Account:
    """Change le serveur d'envoi et le teste aussitôt."""
    row = await get_account(session, account_id)
    if row.host == DEMO_HOST:
        raise HTTPException(status.HTTP_409_CONFLICT, "La boîte de démonstration n'envoie rien.")
    row.smtp_host, row.smtp_port = payload.host, payload.port
    await check_sending(row, senders)
    await session.commit()
    return await account_out(session, row)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(account_id: UUID, session: Session) -> None:
    """Supprime le compte, son mot de passe et ses mails. Les statuts déjà changés restent."""
    row = await session.get(AccountRow, account_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Compte introuvable.")
    await session.delete(row)
    await session.commit()


@router.post("/sync", response_model=SyncReport)
async def sync(
    session: Session,
    cache: Cache,
    http: Http,
    classifier: ClassifierDep,
    mailbox_for: MailboxFactoryDep,
    account_id: UUID | None = None,
) -> SyncReport:
    """Lit les nouveaux mails de toutes les boîtes (ou d'une seule)."""
    query = select(AccountRow)
    if account_id is not None:
        query = query.where(AccountRow.id == account_id)
    accounts = (await session.scalars(query)).all()
    report = SyncReport(accounts=len(accounts), new=0, linked=0, applied=0, errors=[])
    for account in accounts:
        try:
            result = await sync_account(session, account, mailbox_for, http, classifier, cache)
        except (UpstreamError, MailboxError, SecretKeyMissing) as exc:
            report.errors.append(f"{account.email} : {exc}")
            continue
        report.new += result.new
        report.linked += result.linked
        report.applied += result.applied
        report.bounced += result.bounced
    return report


@router.get("/messages", response_model=list[Message])
async def list_messages(
    session: Session,
    category: Category | None = None,
    application_id: UUID | None = None,
    review: Review = "all",
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> list[MessageRow]:
    """Mails gardés, les plus récents d'abord. review=pending : ceux qui attendent une décision."""
    query = select(MessageRow).order_by(MessageRow.received_at.desc()).limit(limit)
    if category:
        query = query.where(MessageRow.category == category)
    if application_id:
        query = query.where(MessageRow.application_id == application_id)
    if review == "pending":
        query = query.where(MessageRow.reviewed.is_(False))
    return list((await session.scalars(query)).all())


async def get_message(session: Session, message_id: UUID) -> MessageRow:
    row = await session.get(MessageRow, message_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mail introuvable.")
    return row


@router.patch("/messages/{message_id}", response_model=Message)
async def update_message(message_id: UUID, payload: MessageUpdate, session: Session) -> MessageRow:
    """Corriger la catégorie ou la candidature, ou marquer le mail comme traité."""
    row = await get_message(session, message_id)
    changes = payload.model_dump(exclude_unset=True)
    if "category" in changes and payload.category is not None:
        row.category = payload.category
        row.suggested_status = STATUS_FOR.get(payload.category)
        row.confidence = 1.0
        row.reason = "Catégorie corrigée à la main."
    if "application_id" in changes:
        row.application_id = payload.application_id
        row.match_reason = "rattaché à la main" if payload.application_id else None
        row.status_applied = False
    if payload.reviewed is not None:
        row.reviewed = payload.reviewed
    await session.commit()
    await session.refresh(row)
    return row


@router.post("/messages/{message_id}/apply", response_model=Message)
async def apply_status(message_id: UUID, session: Session, http: Http) -> MessageRow:
    """Applique le statut suggéré par le mail à sa candidature (confirmation de l'utilisateur)."""
    row = await get_message(session, message_id)
    if row.application_id is None or row.suggested_status is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ce mail n'a pas de candidature ou de statut à appliquer."
        )
    try:
        await set_status(http, str(row.application_id), row.suggested_status)
    except UpstreamError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    row.status_applied = row.reviewed = True
    await session.commit()
    await session.refresh(row)
    return row


async def deliver(
    session: AsyncSession,
    account: AccountRow,
    payload: ReplyCreate,
    message: MessageRow | None,
    senders: SenderFactoryDep,
    mailboxes: MailboxFactoryDep,
    http: Http,
) -> tuple[ReplyRow, bool]:
    """Enregistre le mail avec son état, puis l'envoie. Vrai si cet appel l'a réellement envoyé.

    Un même brouillon (`client_key`) ne repart pas s'il est déjà parti ou peut-être parti ;
    après un échec net, il réessaie avec le même identifiant.
    """
    attempt = None
    if payload.client_key is not None:
        attempt = await session.scalar(
            select(ReplyRow).where(
                ReplyRow.account_id == account.id, ReplyRow.client_key == payload.client_key
            )
        )
    if attempt is not None and attempt.status == "sending":
        raise HTTPException(status.HTTP_409_CONFLICT, "Ce mail est déjà en cours d'envoi.")
    if attempt is not None and attempt.status != "failed":
        return attempt, False

    email = build_reply(
        Draft(
            account.email,
            payload.to,
            payload.subject,
            payload.body,
            message.message_id if message else None,
            message_id=attempt.smtp_message_id if attempt else None,
            references=(message.references or "").split() if message else [],
            sender_name=await profile_name(http),
        )
    )
    if attempt is None:
        attempt = ReplyRow(
            account_id=account.id,
            message_id=message.id if message else None,
            client_key=payload.client_key,
            smtp_message_id=email["Message-ID"],
        )
        session.add(attempt)
    attempt.to_address, attempt.subject, attempt.body = payload.to, payload.subject, payload.body
    attempt.status, attempt.error = "sending", None
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ce mail est déjà en cours d'envoi.") from exc

    try:
        await asyncio.to_thread(senders(account).send, email)
    except (SendError, SecretKeyMissing) as exc:
        attempt.status, attempt.error = "failed", str(exc)
        account.smtp_error = str(exc)
        account.smtp_checked_at = datetime.now(UTC)
        await session.commit()
        code = (
            status.HTTP_502_BAD_GATEWAY
            if isinstance(exc, SendError)
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        raise HTTPException(code, str(exc)) from exc
    except SendUncertain as exc:
        attempt.status, attempt.error = "uncertain", str(exc)
    else:
        attempt.status, attempt.sent_at = "sent", datetime.now(UTC)
        account.smtp_error, account.smtp_checked_at = None, datetime.now(UTC)
    await session.commit()
    if attempt.status == "sent":
        await keep_sent_copy(account, email, mailboxes)
    return attempt, True


async def keep_sent_copy(
    account: AccountRow, email: EmailMessage, mailboxes: MailboxFactoryDep
) -> None:
    """Le mail est parti : une copie ratée se signale dans les journaux, pas à l'envoi."""
    try:
        await asyncio.to_thread(mailboxes(account, []).save_sent, email)
    except (MailboxError, SecretKeyMissing, OSError):
        log.warning("copie dans Envoyés impossible pour %s", account.id, exc_info=True)


@router.post(
    "/messages/{message_id}/reply", response_model=Message, status_code=status.HTTP_201_CREATED
)
async def reply(
    message_id: UUID,
    payload: ReplyCreate,
    session: Session,
    sender_for: SenderFactoryDep,
    mailbox_for: MailboxFactoryDep,
    http: Http,
) -> MessageRow:
    """Envoie une réponse depuis la boîte qui a reçu le mail. Le statut de la candidature ne change
    pas ; le mail quitte « À vérifier » sauf s'il reste à rattacher ou un statut à confirmer.
    """
    row = await get_message(session, message_id)
    account = await session.get(AccountRow, row.account_id)
    attempt, delivered = await deliver(
        session, account, payload, row, sender_for, mailbox_for, http
    )
    if (
        delivered
        and attempt.status == "sent"
        and row.application_id
        and (row.suggested_status is None or row.status_applied)
    ):
        row.reviewed = True
        await session.commit()
    await session.refresh(row, ["replies", "reviewed"])
    return row


@router.post(
    "/accounts/{account_id}/send", response_model=Reply, status_code=status.HTTP_201_CREATED
)
async def send_new(
    account_id: UUID,
    payload: ReplyCreate,
    session: Session,
    sender_for: SenderFactoryDep,
    mailbox_for: MailboxFactoryDep,
    http: Http,
) -> ReplyRow:
    """Envoie un nouveau message, sans rapport avec un mail reçu."""
    account = await get_account(session, account_id)
    attempt, _ = await deliver(session, account, payload, None, sender_for, mailbox_for, http)
    return attempt


@router.get("/sent", response_model=list[Reply])
async def list_sent(
    session: Session, limit: Annotated[int, Query(ge=1, le=500)] = 200
) -> list[ReplyRow]:
    """Les mails envoyés, réponses et nouveaux messages, les plus récents d'abord."""
    query = (
        select(ReplyRow)
        .where(ReplyRow.status != "failed")
        .order_by(ReplyRow.sent_at.desc())
        .limit(limit)
    )
    return list((await session.scalars(query)).all())


@router.post("/messages/{message_id}/draft", response_model=DraftOut)
async def draft_reply(
    message_id: UUID, payload: DraftRequest, session: Session, http: Http, drafter: DrafterDep
) -> DraftOut:
    """Propose un texte de réponse. Rien n'est envoyé ni enregistré."""
    row = await get_message(session, message_id)
    application = None
    if row.application_id:
        try:
            found = next(
                (c for c in await list_candidates(http) if c.id == str(row.application_id)), None
            )
        except UpstreamError:
            found = None
        if found:
            application = f"{found.title} chez {found.company or 'entreprise non précisée'}"
    try:
        body = await drafter.draft(
            DraftContext(
                sender=row.from_name or row.from_address,
                subject=row.subject,
                text=row.snippet,
                notes=payload.notes,
                application=application,
                signature=await profile_name(http),
            )
        )
    except LLMError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return DraftOut(body=body)
