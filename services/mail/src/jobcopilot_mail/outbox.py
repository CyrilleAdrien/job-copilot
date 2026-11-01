"""Envoi des réponses en SMTP, avec le mot de passe d'application de la boîte.

Rien ne part sans un clic sur Envoyer : ni la lecture des mails ni le LLM n'appellent ce module.
"""

import smtplib
import ssl
from dataclasses import dataclass
from datetime import UTC, datetime
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid
from typing import Protocol

SMTP_SSL_PORT = 465
SMTP_STARTTLS_PORT = 587
KNOWN_SERVERS = {
    "imap.gmail.com": ("smtp.gmail.com", SMTP_SSL_PORT),
    "imap.mail.me.com": ("smtp.mail.me.com", SMTP_STARTTLS_PORT),
    "outlook.office365.com": ("smtp.office365.com", SMTP_STARTTLS_PORT),
}


class SendError(Exception):
    pass


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


def build_reply(draft: Draft, now: datetime | None = None) -> EmailMessage:
    """Le mail à envoyer. In-Reply-To et References le rangent dans la conversation d'origine."""
    message = EmailMessage()
    message["From"] = draft.sender
    message["To"] = draft.to
    message["Subject"] = draft.subject
    message["Date"] = format_datetime(now or datetime.now(UTC))
    message["Message-ID"] = make_msgid(domain=draft.sender.rpartition("@")[2] or None)
    # Un mail sans Message-ID reçoit à la lecture un identifiant interne, inconnu du destinataire.
    if draft.in_reply_to and not draft.in_reply_to.startswith("<uid-"):
        message["In-Reply-To"] = draft.in_reply_to
        message["References"] = draft.in_reply_to
    message.set_content(draft.body)
    return message


class Sender(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class DemoSender:
    """Boîte de démonstration : aucun mail ne part, la réponse est seulement enregistrée."""

    def send(self, message: EmailMessage) -> None:
        return None


class SmtpSender:
    def __init__(self, host: str, port: int, username: str, password: str, timeout: float):
        self.host, self.port, self.username, self.password = host, port, username, password
        self.timeout = timeout

    def connect(self, context: ssl.SSLContext) -> smtplib.SMTP:
        if self.port == SMTP_SSL_PORT:
            return smtplib.SMTP_SSL(self.host, self.port, timeout=self.timeout, context=context)
        return smtplib.SMTP(self.host, self.port, timeout=self.timeout)

    def send(self, message: EmailMessage) -> None:
        """Toujours chiffré : starttls échoue si le serveur ne le propose pas."""
        context = ssl.create_default_context()
        try:
            with self.connect(context) as client:
                if self.port != SMTP_SSL_PORT:
                    client.starttls(context=context)
                client.login(self.username, self.password)
                client.send_message(message)
        except smtplib.SMTPAuthenticationError as exc:
            raise SendError(
                "Envoi refusé : identifiants non acceptés par le serveur d'envoi. "
                "Vérifie le mot de passe d'application de cette boîte."
            ) from exc
        except smtplib.SMTPRecipientsRefused as exc:
            raise SendError(f"Adresse refusée par le serveur : {message['To']}.") from exc
        except (smtplib.SMTPException, OSError) as exc:
            raise SendError(f"Serveur d'envoi {self.host}:{self.port} injoignable.") from exc
