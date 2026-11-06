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
from jobcopilot_common.mode import is_demo
from jobcopilot_mail.classify import Classifier, LLMClassifier, RuleClassifier
from jobcopilot_mail.drafting import DraftContext, Drafter, LLMDrafter, TemplateDrafter
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


async def demo_mail() -> bool:
    """Boîte de démonstration permise : par .env ou par le mode choisi dans l'assistant."""
    return await is_demo(get_cache(), get_mail_settings().mail_demo)


async def demo_llm(cache: Redis | None) -> bool:
    return await is_demo(cache, get_mail_settings().llm_provider == "demo")


class ModeClassifier:
    """Règles en démonstration, LLM sinon : le mode se lit à chaque mail."""

    def __init__(self, llm: Classifier, rules: Classifier, cache: Redis | None) -> None:
        self.llm, self.rules, self.cache = llm, rules, cache

    async def classify(self, subject: str, sender: str, text: str, about: str):
        chosen = self.rules if await demo_llm(self.cache) else self.llm
        return await chosen.classify(subject, sender, text, about)


class ModeDrafter:
    """Modèle de texte en démonstration, LLM sinon."""

    def __init__(self, llm: Drafter, template: Drafter, cache: Redis | None) -> None:
        self.llm, self.template, self.cache = llm, template, cache

    async def draft(self, context: DraftContext) -> str:
        chosen = self.template if await demo_llm(self.cache) else self.llm
        return await chosen.draft(context)


@lru_cache
def get_classifier() -> Classifier:
    cache = get_cache()
    return ModeClassifier(
        LLMClassifier(Ollama(get_settings(), cache=cache)), RuleClassifier(), cache
    )


@lru_cache
def get_drafter() -> Drafter:
    cache = get_cache()
    llm = LLMDrafter(Ollama(get_settings(), cache=cache), get_mail_settings().draft_timeout)
    return ModeDrafter(llm, TemplateDrafter(), cache)


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
DrafterDep = Annotated[Drafter, Depends(get_drafter)]
MailboxFactoryDep = Annotated[object, Depends(get_mailbox_factory)]
SenderFactoryDep = Annotated[object, Depends(get_sender_factory)]
