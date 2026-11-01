"""Envoi des réponses en SMTP, avec le mot de passe d'application de la boîte.

Rien ne part sans un clic sur Envoyer : ni la lecture des mails ni le LLM n'appellent ce module.
"""

import smtplib
import socket
import ssl
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from email.headerregistry import Address
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid
from typing import Protocol

MAX_REFERENCES = 20
SMTP_SSL_PORT = 465
SMTP_STARTTLS_PORT = 587
KNOWN_SERVERS = {
    "imap.gmail.com": ("smtp.gmail.com", SMTP_SSL_PORT),
    "imap.mail.me.com": ("smtp.mail.me.com", SMTP_STARTTLS_PORT),
    "outlook.office365.com": ("smtp.office365.com", SMTP_STARTTLS_PORT),
}


class SendError(Exception):
    """Le mail n'est pas parti : on peut corriger et renvoyer."""


class SendUncertain(Exception):
    """La connexion a lâché pendant la transmission : le mail est peut-être parti."""


def smtp_server(imap_host: str) -> tuple[str, int]:
    """Serveur d'envoi d'une boîte : connu d'après son serveur IMAP, sinon imap.x devient smtp.x."""
    if imap_host in KNOWN_SERVERS:
        return KNOWN_SERVERS[imap_host]
    host = f"smtp.{imap_host[5:]}" if imap_host.startswith("imap.") else imap_host
    return host, SMTP_STARTTLS_PORT


@dataclass
class Draft:
    sender: str
    to: str
    subject: str
    body: str
    in_reply_to: str | None = None
    # Repris à chaque nouvel essai : le même mail n'a qu'un seul identifiant.
    message_id: str | None = None
    # Le fil du mail d'origine : son client de messagerie range la réponse avec.
    references: list[str] = field(default_factory=list)
    sender_name: str | None = None


def sender_header(address: str, name: str | None) -> Address | str:
    """Le nom affiché par le destinataire. Une adresse qu'on ne sait pas découper reste brute."""
    local, _, domain = address.partition("@")
    return Address(name, local, domain) if name and local and domain else address


def build_reply(draft: Draft, now: datetime | None = None) -> EmailMessage:
    """Le mail à envoyer. In-Reply-To et References le rangent dans la conversation d'origine."""
    message = EmailMessage()
    message["From"] = sender_header(draft.sender, draft.sender_name)
    message["To"] = draft.to
    message["Subject"] = draft.subject
    message["Date"] = format_datetime(now or datetime.now(UTC))
    message["Message-ID"] = draft.message_id or make_msgid(
        domain=draft.sender.rpartition("@")[2] or None
    )
    # Un mail sans Message-ID reçoit à la lecture un identifiant interne, inconnu du destinataire.
    if draft.in_reply_to and not draft.in_reply_to.startswith("<uid-"):
        message["In-Reply-To"] = draft.in_reply_to
        chain = [known for known in draft.references if known != draft.in_reply_to]
        message["References"] = " ".join([*chain[-(MAX_REFERENCES - 1) :], draft.in_reply_to])
    message.set_content(draft.body)
    return message


class Sender(Protocol):
    def check(self) -> None: ...

    def send(self, message: EmailMessage) -> None: ...


class DemoSender:
    """Boîte de démonstration : aucun mail ne part, la réponse est seulement enregistrée."""

    def check(self) -> None:
        return None

    def send(self, message: EmailMessage) -> None:
        return None


class _TracksData:
    """Retient que la transmission a commencé : au-delà, une coupure ne prouve pas un échec."""

    data_started = False

    def data(self, msg):
        self.data_started = True
        return super().data(msg)


class _Smtp(_TracksData, smtplib.SMTP):
    pass


class _SmtpSsl(_TracksData, smtplib.SMTP_SSL):
    pass


def server_text(exc: smtplib.SMTPResponseException) -> str:
    raw = exc.smtp_error
    text = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else str(raw)
    return f"{exc.smtp_code} {' '.join(text.split())}"[:200]


def explain(exc: Exception, host: str, port: int) -> str:
    """Le message de chaque panne, assez précis pour savoir quoi corriger."""
    match exc:
        case smtplib.SMTPAuthenticationError():
            return (
                "Identifiants refusés par le serveur d'envoi. "
                "Vérifie le mot de passe d'application de cette boîte."
            )
        case smtplib.SMTPRecipientsRefused(recipients=recipients):
            return f"Adresse refusée par le serveur : {', '.join(recipients)}."
        case smtplib.SMTPSenderRefused():
            return f"Le serveur refuse cet expéditeur ({server_text(exc)})."
        case smtplib.SMTPDataError():
            return f"Le serveur a refusé le mail ({server_text(exc)})."
        case smtplib.SMTPNotSupportedError():
            return (
                f"{host}:{port} ne propose pas de connexion chiffrée avec identifiant : "
                "rien n'a été transmis. Vérifie le serveur et le port."
            )
        case smtplib.SMTPResponseException():
            return f"Le serveur d'envoi a répondu : {server_text(exc)}."
        case ssl.SSLCertVerificationError():
            return f"Le certificat de {host} n'est pas valide : rien n'a été transmis."
        case ssl.SSLError():
            return f"Échange chiffré impossible avec {host}:{port}. Vérifie le port (465 ou 587)."
        case socket.gaierror():
            return f"Serveur d'envoi {host} introuvable. Vérifie son nom."
        case TimeoutError():
            return f"{host}:{port} ne répond pas. Vérifie le port, le réseau ou un VPN."
        case ConnectionRefusedError():
            return f"{host}:{port} refuse la connexion. Vérifie le port (465 ou 587)."
    return f"Serveur d'envoi {host}:{port} injoignable."


class SmtpSender:
    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        timeout: float,
        context: ssl.SSLContext | None = None,
    ):
        self.host, self.port, self.username, self.password = host, port, username, password
        self.timeout = timeout
        self.context = context or ssl.create_default_context()

    def connect(self) -> smtplib.SMTP:
        if self.port == SMTP_SSL_PORT:
            return _SmtpSsl(self.host, self.port, timeout=self.timeout, context=self.context)
        return _Smtp(self.host, self.port, timeout=self.timeout)

    @contextmanager
    def session(self) -> Iterator[smtplib.SMTP]:
        """Toujours chiffré avant le mot de passe : starttls échoue si le serveur ne l'offre pas."""
        client = self.connect()
        try:
            if self.port != SMTP_SSL_PORT:
                client.starttls(context=self.context)
            client.login(self.username, self.password)
            yield client
        finally:
            # Le mail est déjà accepté ici : un au revoir raté ne doit pas se lire comme un échec.
            try:
                client.quit()
            except (smtplib.SMTPException, OSError):
                client.close()

    def check(self) -> None:
        """Connexion et identifiants, sans envoyer de mail."""
        try:
            with self.session():
                pass
        except (smtplib.SMTPException, OSError) as exc:
            raise SendError(explain(exc, self.host, self.port)) from exc

    def send(self, message: EmailMessage) -> None:
        client = None
        try:
            with self.session() as client:
                client.send_message(message)
        except (smtplib.SMTPException, OSError) as exc:
            answered = isinstance(exc, smtplib.SMTPResponseException)
            if client is not None and client.data_started and not answered:
                raise SendUncertain(
                    "La connexion a été coupée pendant l'envoi : le mail est peut-être parti. "
                    "Vérifie ton dossier Envoyés avant de renvoyer."
                ) from exc
            raise SendError(explain(exc, self.host, self.port)) from exc
