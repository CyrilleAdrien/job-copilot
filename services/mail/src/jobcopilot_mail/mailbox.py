"""Lecture IMAP en deux temps : les en-têtes d'abord, puis le texte des seuls mails retenus.

Un mail sans rapport avec une candidature n'est jamais téléchargé en entier.
"""

import email
import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from email.header import decode_header, make_header
from email.message import Message
from email.utils import parseaddr
from html import unescape
from typing import Protocol

from imapclient import IMAPClient
from imapclient.exceptions import IMAPClientError, LoginError

ADDRESS = re.compile(r"[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+")
BODY_LIMIT = 4000
CHUNK = 200


class MailboxError(Exception):
    pass


@dataclass
class Header:
    uid: int
    message_id: str
    from_address: str
    from_name: str | None
    subject: str
    received_at: datetime


@dataclass
class RawMail:
    header: Header
    text: str
    reply_to: str | None = None


@dataclass
class ReadResult:
    uid_validity: int | None
    max_uid: int
    mails: list[RawMail] = field(default_factory=list)


Keep = Callable[[Header], bool]


class Mailbox(Protocol):
    def check(self) -> None: ...

    def read(
        self, last_uid: int, uid_validity: int | None, since: datetime, keep: Keep
    ) -> ReadResult: ...


def decode(value: bytes | str | None) -> str:
    if value is None:
        return ""
    raw = value.decode("utf-8", "replace") if isinstance(value, bytes) else value
    try:
        return str(make_header(decode_header(raw))).strip()
    except (ValueError, LookupError):
        return raw.strip()


def text_of(message: Message) -> str:
    """Texte brut du mail : la partie text/plain, sinon le HTML sans balises."""
    plain, html = [], []
    for part in message.walk() if message.is_multipart() else [message]:
        if part.get_content_maintype() != "text" or part.get_filename():
            continue
        payload = part.get_payload(decode=True) or b""
        content = payload.decode(part.get_content_charset() or "utf-8", "replace")
        (plain if part.get_content_subtype() == "plain" else html).append(content)
    text = "\n".join(plain) or re.sub(r"<[^>]+>", " ", unescape("\n".join(html)))
    return re.sub(r"\s+", " ", text).strip()[:BODY_LIMIT]


def reply_address(message: Message, sender: str) -> str | None:
    """L'adresse de réponse demandée par le mail, si elle diffère de l'expéditeur."""
    address = parseaddr(decode(message.get("Reply-To")))[1].lower()
    return address if address != sender and ADDRESS.fullmatch(address) else None


def chunks(items: list[int], size: int = CHUNK) -> Iterable[list[int]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


class ImapMailbox:
    def __init__(
        self, host: str, port: int, username: str, password: str, folder: str, timeout: float
    ):
        self.host, self.port, self.username, self.password = host, port, username, password
        self.folder, self.timeout = folder, timeout

    def connect(self) -> IMAPClient:
        try:
            client = IMAPClient(self.host, port=self.port, ssl=True, timeout=self.timeout)
        except (OSError, IMAPClientError) as exc:
            raise MailboxError(f"Serveur {self.host}:{self.port} injoignable.") from exc
        try:
            client.login(self.username, self.password)
        except LoginError as exc:
            client.shutdown()
            raise MailboxError(
                "Identifiants refusés. Utilise un mot de passe d'application, pas ton mot de "
                "passe habituel, et vérifie que l'accès IMAP est activé."
            ) from exc
        return client

    def check(self) -> None:
        client = self.connect()
        try:
            client.select_folder(self.folder, readonly=True)
        except IMAPClientError as exc:
            raise MailboxError(f"Dossier « {self.folder} » introuvable.") from exc
        finally:
            client.logout()

    def read(
        self, last_uid: int, uid_validity: int | None, since: datetime, keep: Keep
    ) -> ReadResult:
        client = self.connect()
        try:
            folder = client.select_folder(self.folder, readonly=True)
            validity = int(folder.get(b"UIDVALIDITY", 0)) or None
            if uid_validity is not None and validity != uid_validity:
                last_uid = 0  # le serveur a renuméroté la boîte : on relit depuis la date
            criteria = ["UID", f"{last_uid + 1}:*"] if last_uid else ["SINCE", since.date()]
            uids = sorted(uid for uid in client.search(criteria) if uid > last_uid)
            result = ReadResult(uid_validity=validity, max_uid=max(uids, default=last_uid))
            kept: dict[int, Header] = {}
            for batch in chunks(uids):
                for uid, data in client.fetch(batch, ["ENVELOPE", "INTERNALDATE"]).items():
                    header = self.header(uid, data)
                    if header is not None and keep(header):
                        kept[uid] = header
            for batch in chunks(sorted(kept)):
                for uid, data in client.fetch(batch, ["BODY.PEEK[]"]).items():
                    message = email.message_from_bytes(data[b"BODY[]"])
                    header = kept[uid]
                    result.mails.append(
                        RawMail(
                            header,
                            text_of(message),
                            reply_address(message, header.from_address),
                        )
                    )
            return result
        except IMAPClientError as exc:
            raise MailboxError(f"Lecture de la boîte interrompue : {exc}") from exc
        finally:
            client.logout()

    @staticmethod
    def header(uid: int, data: dict) -> Header | None:
        envelope = data.get(b"ENVELOPE")
        if envelope is None or not envelope.from_:
            return None
        sender = envelope.from_[0]
        address = f"{decode(sender.mailbox)}@{decode(sender.host)}".lower()
        received = data.get(b"INTERNALDATE") or envelope.date or datetime.now(UTC)
        if received.tzinfo is None:
            received = received.replace(tzinfo=UTC)
        return Header(
            uid=uid,
            message_id=decode(envelope.message_id) or f"<uid-{uid}@{address}>",
            from_address=address,
            from_name=decode(sender.name) or None,
            subject=decode(envelope.subject)[:500],
            received_at=received,
        )


@dataclass
class DemoApplication:
    id: str
    title: str
    company: str | None
    contact_email: str | None
    status: str


def demo_domain(company: str | None) -> str:
    slug = re.sub(
        r"[^a-z0-9]", "", (company or "entreprise").lower().encode("ascii", "ignore").decode()
    )
    return f"{slug or 'entreprise'}.example"


class DemoMailbox:
    """Boîte fictive (MAIL_DEMO=true) : des réponses plausibles aux candidatures envoyées,
    une lettre d'information sans rapport et un mail de recrutement à rattacher."""

    def __init__(self, applications: list[DemoApplication], now: datetime | None = None):
        self.applications = applications
        self.now = now or datetime.now(UTC)

    def check(self) -> None:
        return None

    def mails(self) -> list[RawMail]:
        waiting = [a for a in self.applications if a.status in {"sent", "followed_up"}]
        replies = [
            (
                "Votre candidature : suite donnée",
                "Bonjour, nous vous remercions de l'intérêt porté à notre société. Après étude "
                "attentive de votre profil, nous avons le regret de ne pas donner suite à votre "
                "candidature pour le poste de {title}. Nous vous souhaitons pleine réussite.",
            ),
            (
                "Invitation à un entretien : {title}",
                "Bonjour, votre profil a retenu notre attention pour le poste de {title}. Nous "
                "souhaiterions vous rencontrer lors d'un entretien en visio. Pourriez-vous nous "
                "indiquer vos disponibilités la semaine prochaine ?",
            ),
            (
                "Test technique pour le poste de {title}",
                "Bonjour, pour la suite du processus, nous vous proposons un test technique à "
                "réaliser sous 5 jours. Vous trouverez le lien vers l'exercice ci-dessous.",
            ),
        ]
        mails = []
        for index, (application, (subject, body)) in enumerate(zip(waiting, replies, strict=False)):
            domain = demo_domain(application.company)
            address = application.contact_email or f"recrutement@{domain}"
            mails.append(
                RawMail(
                    Header(
                        uid=index + 1,
                        message_id=f"<demo-{application.id}-{index}@{domain}>",
                        from_address=address,
                        from_name=f"Recrutement {application.company or ''}".strip(),
                        subject=subject.format(title=application.title),
                        received_at=self.now - timedelta(hours=6 * (index + 1)),
                    ),
                    body.format(title=application.title),
                )
            )
        extra = [
            RawMail(
                Header(
                    90,
                    "<demo-news@lettre.example>",
                    "news@lettre.example",
                    "La Lettre Tech",
                    "Les 10 outils DevOps de la semaine",
                    self.now - timedelta(hours=2),
                ),
                "Notre sélection d'outils et d'articles de la semaine.",
            ),
            RawMail(
                Header(
                    91,
                    "<demo-unknown@talents.example>",
                    "talents@talents.example",
                    "Équipe Talents",
                    "Votre candidature a bien été reçue",
                    self.now - timedelta(hours=30),
                ),
                "Bonjour, nous avons bien reçu votre candidature et revenons vers vous rapidement.",
            ),
        ]
        return mails + extra

    def read(
        self, last_uid: int, uid_validity: int | None, since: datetime, keep: Keep
    ) -> ReadResult:
        fresh = [m for m in self.mails() if m.header.uid > last_uid]
        result = ReadResult(uid_validity=1, max_uid=max([last_uid, *(m.header.uid for m in fresh)]))
        result.mails = [m for m in fresh if keep(m.header)]
        return result
