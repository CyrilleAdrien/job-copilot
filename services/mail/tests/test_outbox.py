import smtplib
from datetime import UTC, datetime

import pytest

from jobcopilot_mail import outbox
from jobcopilot_mail.outbox import Draft, SendError, SmtpSender, build_reply, smtp_server


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


class FakeSmtp:
    """Remplace smtplib : retient l'ordre des appels, peut échouer à une étape."""

    instances: list["FakeSmtp"] = []
    fail: dict[str, Exception] = {}

    def __init__(self, host, port, timeout=None, context=None):
        self.host, self.port, self.calls = host, port, []
        FakeSmtp.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.calls.append("quit")

    def step(self, name):
        self.calls.append(name)
        if name in self.fail:
            raise self.fail[name]

    def starttls(self, context=None):
        self.step("starttls")

    def login(self, username, password):
        self.step("login")
        self.credentials = (username, password)

    def send_message(self, message):
        self.step("send")
        self.sent = message


@pytest.fixture
def smtp(monkeypatch):
    FakeSmtp.instances, FakeSmtp.fail = [], {}
    monkeypatch.setattr(outbox.smtplib, "SMTP", FakeSmtp)
    monkeypatch.setattr(outbox.smtplib, "SMTP_SSL", FakeSmtp)
    return FakeSmtp


def test_starttls_comes_before_the_password(smtp):
    SmtpSender("smtp.exemple.fr", 587, "moi", "secret", 5).send(build_reply(draft()))
    server = smtp.instances[0]
    assert server.calls == ["starttls", "login", "send", "quit"]
    assert server.credentials == ("moi", "secret")


def test_port_465_is_already_encrypted(smtp):
    SmtpSender("smtp.gmail.com", 465, "moi", "secret", 5).send(build_reply(draft()))
    assert smtp.instances[0].calls == ["login", "send", "quit"]


def test_no_password_without_encryption(smtp):
    smtp.fail = {"starttls": smtplib.SMTPNotSupportedError("STARTTLS absent")}
    with pytest.raises(SendError):
        SmtpSender("smtp.exemple.fr", 587, "moi", "secret", 5).send(build_reply(draft()))
    assert "login" not in smtp.instances[0].calls


@pytest.mark.parametrize(
    ("failure", "expected"),
    [
        (smtplib.SMTPAuthenticationError(535, b"non"), "mot de passe d'application"),
        (smtplib.SMTPRecipientsRefused({"x": (550, b"non")}), "Adresse refusée"),
        (OSError("réseau"), "injoignable"),
    ],
)
def test_failures_are_explained(smtp, failure, expected):
    smtp.fail = {"send": failure}
    with pytest.raises(SendError, match=expected):
        SmtpSender("smtp.exemple.fr", 587, "moi", "secret", 5).send(build_reply(draft()))
