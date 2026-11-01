from functools import lru_cache
from typing import Annotated

import httpx
from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_common import get_settings
from jobcopilot_common.crypto import decrypt
from jobcopilot_common.db import get_session
from jobcopilot_common.llm import Ollama
from jobcopilot_mail.classify import Classifier, LLMClassifier, RuleClassifier
from jobcopilot_mail.mailbox import DemoApplication, DemoMailbox, ImapMailbox, Mailbox
from jobcopilot_mail.matching import Candidate
from jobcopilot_mail.models import AccountRow
from jobcopilot_mail.outbox import DemoSender, Sender, SmtpSender, smtp_server
from jobcopilot_mail.settings import get_mail_settings

DEMO_HOST = "demo"


@lru_cache
def get_cache() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


@lru_cache
def get_http() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=get_mail_settings().mail_http_timeout)


@lru_cache
def get_classifier() -> Classifier:
    if get_mail_settings().llm_provider == "demo":
        return RuleClassifier()
    return LLMClassifier(Ollama(get_settings()))


def mailbox_for(account: AccountRow, candidates: list[Candidate]) -> Mailbox:
    if account.host == DEMO_HOST:
        return DemoMailbox(
            [
                DemoApplication(c.id, c.title, c.company, c.contact_email, c.status)
                for c in candidates
            ]
        )
    return ImapMailbox(
        account.host,
        account.port,
        account.username,
        decrypt(account.password_encrypted),
        account.folder,
        get_mail_settings().imap_timeout,
    )


def get_mailbox_factory():
    return mailbox_for


def smtp_server_of(account: AccountRow) -> tuple[str, int]:
    if account.smtp_host and account.smtp_port:
        return account.smtp_host, account.smtp_port
    return smtp_server(account.host)


def sender_for(account: AccountRow) -> Sender:
    if account.host == DEMO_HOST:
        return DemoSender()
    host, port = smtp_server_of(account)
    return SmtpSender(
        host,
        port,
        account.username,
        decrypt(account.password_encrypted),
        get_mail_settings().smtp_timeout,
    )


def get_sender_factory():
    return sender_for


Session = Annotated[AsyncSession, Depends(get_session)]
Cache = Annotated[Redis, Depends(get_cache)]
Http = Annotated[httpx.AsyncClient, Depends(get_http)]
ClassifierDep = Annotated[Classifier, Depends(get_classifier)]
MailboxFactoryDep = Annotated[object, Depends(get_mailbox_factory)]
SenderFactoryDep = Annotated[object, Depends(get_sender_factory)]
