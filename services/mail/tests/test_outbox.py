import smtplib
import socket
import ssl
from datetime import UTC, datetime
from email import message_from_bytes
from email.message import Message

import pytest
import trustme
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import AuthResult

from jobcopilot_mail import outbox
from jobcopilot_mail.mailbox import reply_address
from jobcopilot_mail.outbox import (
    Draft,
    SendError,
    SendUncertain,
    SmtpSender,
    build_reply,
    explain,
    smtp_server,
)


@pytest.mark.parametrize(
    ("imap", "expected"),
    [
        ("imap.gmail.com", ("smtp.gmail.com", 465)),
        ("imap.mail.me.com", ("smtp.mail.me.com", 587)),
        ("outlook.office365.com", ("smtp.office365.com", 587)),
        ("imap.exemple.fr", ("smtp.exemple.fr", 587)),
        ("mail.exemple.fr", ("mail.exemple.fr", 587)),
    ],
)
def test_smtp_server_from_imap_host(imap, expected):
    assert smtp_server(imap) == expected


def draft(**changes) -> Draft:
    values = {
        "sender": "moi@exemple.fr",
        "to": "rh@nimbus.example",
        "subject": "Re: Entretien à Paris",
        "body": "Bonjour,\n\nJe suis disponible mardi.\n",
        "in_reply_to": "<abc@nimbus.example>",
    }
    return Draft(**{**values, **changes})


def test_reply_stays_in_the_conversation():
    message = build_reply(draft(), now=datetime(2026, 11, 1, 10, tzinfo=UTC))
    assert message["From"] == "moi@exemple.fr"
    assert message["To"] == "rh@nimbus.example"
    assert message["Subject"] == "Re: Entretien à Paris"
    assert message["In-Reply-To"] == message["References"] == "<abc@nimbus.example>"
    assert message["Message-ID"].endswith("@exemple.fr>")
    assert "disponible mardi" in message.get_content()


def test_internal_identifier_is_not_a_conversation():
    assert build_reply(draft(in_reply_to="<uid-3@rh.example>"))["In-Reply-To"] is None


def test_header_injection_is_refused():
    with pytest.raises(ValueError):
        build_reply(draft(subject="Bonjour\nBcc: autre@exemple.fr"))


def test_a_new_attempt_keeps_the_same_message_id():
    assert build_reply(draft(message_id="<fixe@exemple.fr>"))["Message-ID"] == "<fixe@exemple.fr>"


def test_reply_to_is_kept_only_when_it_differs_from_the_sender():
    message = Message()
    assert reply_address(message, "rh@a.fr") is None
    message["Reply-To"] = "Recrutement <Jobs@ats.example>"
    assert reply_address(message, "no-reply@a.fr") == "jobs@ats.example"
    assert reply_address(message, "jobs@ats.example") is None
    del message["Reply-To"]
    message["Reply-To"] = "pas une adresse"
    assert reply_address(message, "rh@a.fr") is None


# --- Avec un vrai serveur SMTP local : chiffrement, identifiants et coupures réels. ---


class Inbox:
    def __init__(self):
        self.received: list[Message] = []
        self.logins: list[str] = []
        self.drop_during_data = False
        self.reject_data = False

    async def handle_RCPT(self, server, session, envelope, address, options):
        if address.startswith("refuse"):
            return "550 5.1.1 No such user"
        envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(self, server, session, envelope):
        if self.drop_during_data:
            server.transport.abort()
            return "250 OK"
        if self.reject_data:
            return "552 5.2.3 Quota exceeded"
        self.received.append(message_from_bytes(envelope.content))
        return "250 OK"

    def authenticate(self, server, session, envelope, mechanism, data):
        self.logins.append(data.login.decode())
        return AuthResult(success=data.password == b"bon-mot-de-passe", handled=False)


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


@pytest.fixture(scope="module")
def ca():
    return trustme.CA()


@pytest.fixture
def trusted(ca):
    context = ssl.create_default_context()
    ca.configure_trust(context)
    return context


def server_context(ca) -> ssl.SSLContext:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ca.issue_cert("localhost").configure_cert(context)
    return context


@pytest.fixture
def starttls_server(ca):
    inbox = Inbox()
    controller = Controller(
        inbox,
        hostname="127.0.0.1",
        port=free_port(),
        server_hostname="localhost",
        tls_context=server_context(ca),
        require_starttls=True,
        auth_required=True,
        authenticator=inbox.authenticate,
    )
    controller.start()
    yield inbox, controller.port
    controller.stop()


def sender(port, context, password="bon-mot-de-passe") -> SmtpSender:
    return SmtpSender("localhost", port, "moi", password, 5, context)


def test_mail_is_delivered_over_starttls_with_threading_headers(starttls_server, trusted):
    inbox, port = starttls_server
    sender(port, trusted).send(build_reply(draft()))
    assert inbox.logins == ["moi"]
    [received] = inbox.received
    assert received["To"] == "rh@nimbus.example"
    assert received["In-Reply-To"] == "<abc@nimbus.example>"
    assert "disponible mardi" in received.get_payload(decode=True).decode()


def test_implicit_tls_on_the_ssl_port(ca, trusted, monkeypatch):
    inbox = Inbox()
    port = free_port()
    monkeypatch.setattr(outbox, "SMTP_SSL_PORT", port)
    controller = Controller(
        inbox,
        hostname="127.0.0.1",
        port=port,
        server_hostname="localhost",
        ssl_context=server_context(ca),
        authenticator=inbox.authenticate,
        auth_required=True,
        auth_require_tls=False,
        ready_timeout=5,
    )
    controller.start()
    try:
        sender(port, trusted).send(build_reply(draft()))
    finally:
        controller.stop()
    assert len(inbox.received) == 1


def test_check_logs_in_without_sending_anything(starttls_server, trusted):
    inbox, port = starttls_server
    sender(port, trusted).check()
    assert inbox.logins == ["moi"]
    assert inbox.received == []


def test_wrong_password_is_explained(starttls_server, trusted):
    inbox, port = starttls_server
    bad = sender(port, trusted, password="mauvais")
    for attempt in (bad.check, lambda: bad.send(build_reply(draft()))):
        with pytest.raises(SendError, match="mot de passe d'application"):
            attempt()
    assert inbox.received == []


def test_untrusted_certificate_stops_before_the_password(starttls_server):
    inbox, port = starttls_server
    with pytest.raises(SendError, match="certificat"):
        sender(port, ssl.create_default_context()).send(build_reply(draft()))
    assert inbox.logins == []


def test_server_without_encryption_never_receives_the_password(trusted):
    inbox = Inbox()
    controller = Controller(
        inbox,
        hostname="127.0.0.1",
        port=free_port(),
        authenticator=inbox.authenticate,
        auth_require_tls=False,
    )
    controller.start()
    try:
        with pytest.raises(SendError, match="chiffrée"):
            sender(controller.port, trusted).send(build_reply(draft()))
    finally:
        controller.stop()
    assert inbox.logins == []
    assert inbox.received == []


def test_refused_recipient_is_named(starttls_server, trusted):
    _, port = starttls_server
    with pytest.raises(SendError, match="refuse@nimbus.example"):
        sender(port, trusted).send(build_reply(draft(to="refuse@nimbus.example")))


def test_refused_mail_is_a_failure_with_the_server_reason(starttls_server, trusted):
    inbox, port = starttls_server
    inbox.reject_data = True
    with pytest.raises(SendError, match="552 5.2.3 Quota exceeded"):
        sender(port, trusted).send(build_reply(draft()))


def test_connection_lost_during_transmission_is_uncertain_not_failed(starttls_server, trusted):
    inbox, port = starttls_server
    inbox.drop_during_data = True
    with pytest.raises(SendUncertain, match="Envoyés"):
        sender(port, trusted).send(build_reply(draft()))


def test_a_failed_goodbye_after_acceptance_is_still_a_success(
    starttls_server, trusted, monkeypatch
):
    inbox, port = starttls_server

    def refuse_quit(self):
        raise smtplib.SMTPResponseException(451, b"bye")

    monkeypatch.setattr(smtplib.SMTP, "quit", refuse_quit)
    sender(port, trusted).send(build_reply(draft()))
    assert len(inbox.received) == 1


def test_unreachable_server_is_explained():
    with pytest.raises(SendError, match="refuse la connexion"):
        SmtpSender("127.0.0.1", free_port(), "moi", "x", 2).check()


@pytest.mark.parametrize(
    ("failure", "expected"),
    [
        (socket.gaierror(), "introuvable"),
        (TimeoutError(), "ne répond pas"),
        (ssl.SSLError(), "Vérifie le port"),
        (smtplib.SMTPSenderRefused(550, b"not yours", "moi"), "550 not yours"),
        (OSError(), "injoignable"),
    ],
)
def test_each_failure_has_its_own_message(failure, expected):
    assert expected in explain(failure, "smtp.exemple.fr", 587)
