"""Lecture d'une boîte : nouveaux mails, rattachement, classement, mise à jour des statuts."""

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_common.crypto import SecretKeyMissing
from jobcopilot_mail.classify import STATUS_FOR, Classifier
from jobcopilot_mail.mailbox import Bounce, Mailbox, MailboxError
from jobcopilot_mail.matching import Candidate, match
from jobcopilot_mail.models import AccountRow, MessageRow, ReplyRow
from jobcopilot_mail.settings import get_mail_settings
from jobcopilot_mail.upstream import UpstreamError, list_candidates, set_status

MAIL_CLASSIFIED = "mail.classified"
# Avancement d'une candidature : un mail ne la fait jamais reculer.
RANK = {"sent": 1, "followed_up": 1, "technical_test": 2, "interview": 3}
FINAL = {"rejected", "offer"}

log = logging.getLogger(__name__)

MailboxFactory = Callable[[AccountRow, list[Candidate]], Mailbox]


@dataclass
class SyncResult:
    new: int = 0
    linked: int = 0
    applied: int = 0
    bounced: int = 0


def should_apply(current: str, target: str) -> bool:
    """Seulement sur une candidature envoyée et en cours, et vers l'avant (ou vers une issue)."""
    if current not in RANK or target == current:
        return False
    return target in FINAL or RANK.get(target, 0) > RANK[current]


async def publish(cache: Redis, fields: dict[str, str]) -> None:
    try:
        await cache.xadd(MAIL_CLASSIFIED, fields, maxlen=1000)
    except Exception:  # noqa: BLE001
        log.warning("événement %s non publié", MAIL_CLASSIFIED, exc_info=True)


async def mark_bounced(session: AsyncSession, account: AccountRow, bounces: list[Bounce]) -> int:
    """Marque les mails envoyés d'ici que ces avis déclarent non distribués."""
    marked = 0
    for bounce in bounces:
        rows = await session.scalars(
            select(ReplyRow).where(
                ReplyRow.account_id == account.id,
                ReplyRow.smtp_message_id.in_(bounce.message_ids),
                ReplyRow.status.in_(("sent", "uncertain")),
            )
        )
        for row in rows:
            row.status, row.problem_seen = "bounced", False
            row.error = bounce.reason or "Le serveur du destinataire a refusé ce mail."
            marked += 1
    return marked


async def sync_account(
    session: AsyncSession,
    account: AccountRow,
    mailbox_for: MailboxFactory,
    http: httpx.AsyncClient,
    classifier: Classifier,
    cache: Redis,
    now: datetime | None = None,
) -> SyncResult:
    settings = get_mail_settings()
    now = now or datetime.now(UTC)
    result = SyncResult()
    try:
        candidates = await list_candidates(http)
        mailbox = mailbox_for(account, candidates)
        read = await asyncio.to_thread(
            mailbox.read,
            account.last_uid,
            account.uid_validity,
            now - timedelta(days=settings.mail_lookback_days),
            lambda header: match(header, candidates) is not None,
        )
    except (UpstreamError, MailboxError, SecretKeyMissing) as exc:
        account.last_error = str(exc)
        await session.commit()
        raise

    known = set(
        await session.scalars(
            select(MessageRow.message_id).where(MessageRow.account_id == account.id)
        )
    )
    by_id = {c.id: c for c in candidates}
    for mail in sorted(read.mails, key=lambda m: m.header.received_at):
        header = mail.header
        if header.message_id in known:
            continue
        found = match(header, candidates, mail.text)
        if found is None:
            continue
        candidate = found.application
        about = f"{candidate.title} chez {candidate.company}" if candidate else "inconnue"
        verdict = await classifier.classify(header.subject, header.from_address, mail.text, about)
        suggested = STATUS_FOR.get(verdict.category)
        row = MessageRow(
            account_id=account.id,
            message_id=header.message_id,
            uid=header.uid,
            from_address=header.from_address,
            from_name=header.from_name,
            reply_to=mail.reply_to,
            subject=header.subject,
            received_at=header.received_at,
            references=" ".join(mail.references) or None,
            snippet=mail.readable or mail.text,
            category=verdict.category,
            confidence=verdict.confidence,
            reason=verdict.reason,
            application_id=candidate.id if candidate else None,
            match_reason=f"{found.reason}, à confirmer" if found.ambiguous else found.reason,
            suggested_status=suggested,
        )
        if (
            candidate
            and suggested
            and verdict.confidence >= settings.mail_auto_apply_confidence
            and found.score >= settings.mail_auto_apply_confidence
            and not found.ambiguous
            and should_apply(by_id[candidate.id].status, suggested)
        ):
            try:
                await set_status(http, candidate.id, suggested)
                row.status_applied = row.reviewed = True
                by_id[candidate.id].status = suggested
                result.applied += 1
            except UpstreamError:
                log.warning("statut non appliqué pour %s", candidate.id, exc_info=True)
        session.add(row)
        known.add(header.message_id)
        result.new += 1
        result.linked += candidate is not None
        await publish(
            cache,
            {
                "message_id": header.message_id,
                "application_id": candidate.id if candidate else "",
                "category": verdict.category,
                "status_applied": str(row.status_applied).lower(),
            },
        )
    result.bounced = await mark_bounced(session, account, read.bounces)
    account.last_uid = read.max_uid
    account.uid_validity = read.uid_validity
    account.last_sync_at = now
    account.last_error = None
    await session.commit()
    return result
