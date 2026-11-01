import asyncio
import os

from alembic import command
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from jobcopilot_common.db import async_url
from jobcopilot_mail.migrate import alembic_config

TEST_DATABASE_URL = os.environ["TEST_DATABASE_URL"]


async def run(revision: str) -> None:
    await asyncio.to_thread(command.upgrade, alembic_config(TEST_DATABASE_URL), revision)


async def test_existing_replies_stay_sent_and_accounts_stay_connected():
    engine = create_async_engine(async_url(TEST_DATABASE_URL))
    async with engine.begin() as connection:
        await connection.execute(text('DROP SCHEMA IF EXISTS "mail" CASCADE'))
    await run("0002")
    account, message = (
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
    )
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "INSERT INTO mail.accounts (id, email, host, port, username, password_encrypted,"
                " folder, last_uid) VALUES (:id, 'a@b.fr', 'imap.gmail.com', 993, 'a@b.fr', 'x',"
                " 'INBOX', 0)"
            ),
            {"id": account},
        )
        await connection.execute(
            text(
                "INSERT INTO mail.messages (id, account_id, message_id, uid, from_address, subject,"
                " received_at, snippet, category, confidence, reason, status_applied, reviewed)"
                " VALUES (:id, :account, '<m@b.fr>', 1, 'rh@b.fr', 'x', now(), '', 'other', 0, '',"
                " false, false)"
            ),
            {"id": message, "account": account},
        )
        await connection.execute(
            text(
                "INSERT INTO mail.replies (id, message_id, to_address, subject, body,"
                " smtp_message_id)"
                " VALUES (:id, :message, 'rh@b.fr', 'Re: x', 'Bonjour', '<r@b.fr>')"
            ),
            {"id": "00000000-0000-0000-0000-000000000003", "message": message},
        )
    await run("head")
    async with engine.connect() as connection:
        reply = (await connection.execute(text("SELECT status, error FROM mail.replies"))).one()
        owner = await connection.scalar(text("SELECT account_id FROM mail.replies"))
        server = (
            await connection.execute(text("SELECT smtp_host, smtp_error FROM mail.accounts"))
        ).one()
    await engine.dispose()
    assert tuple(reply) == ("sent", None)
    assert str(owner) == account
    assert tuple(server) == (None, None)


async def test_downgrade_removes_only_new_messages():
    engine = create_async_engine(async_url(TEST_DATABASE_URL))
    async with engine.begin() as connection:
        await connection.execute(text('DROP SCHEMA IF EXISTS "mail" CASCADE'))
    await run("head")
    account = "00000000-0000-0000-0000-000000000001"
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "INSERT INTO mail.accounts (id, email, host, port, username, password_encrypted,"
                " folder, last_uid) VALUES (:id, 'a@b.fr', 'imap.gmail.com', 993, 'a@b.fr', 'x',"
                " 'INBOX', 0)"
            ),
            {"id": account},
        )
        await connection.execute(
            text(
                "INSERT INTO mail.replies (id, account_id, to_address, subject, body,"
                " smtp_message_id, status)"
                " VALUES (:id, :account, 'rh@b.fr', 'x', 'Bonjour', '<r@b.fr>', 'sent')"
            ),
            {"id": "00000000-0000-0000-0000-000000000003", "account": account},
        )
    await asyncio.to_thread(command.downgrade, alembic_config(TEST_DATABASE_URL), "0003")
    async with engine.connect() as connection:
        count = await connection.scalar(text("SELECT count(*) FROM mail.replies"))
    await engine.dispose()
    assert count == 0
