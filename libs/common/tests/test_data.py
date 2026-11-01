from datetime import UTC, datetime
from uuid import uuid4

from fakeredis import FakeAsyncRedis
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    MetaData,
    String,
    Table,
)
from sqlalchemy.dialects.postgresql import UUID

from jobcopilot_common.data import clear_cache, is_exportable

metadata = MetaData()
accounts = Table(
    "accounts",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("email", String),
    Column("password_encrypted", String),
    Column("api_key", String),
    Column("client_secret", String),
    Column("access_token", String),
    Column("photo", LargeBinary),
    Column("parent", Integer, ForeignKey("accounts.id")),
    Column("created_at", DateTime),
)


def test_secrets_and_binaries_are_never_exportable():
    kept = {column.name for column in accounts.columns if is_exportable(column)}
    assert kept == {"id", "email", "parent", "created_at"}


async def test_clear_cache_empties_keys_and_streams_but_keeps_reader_groups():
    cache = FakeAsyncRedis(decode_responses=True)
    await cache.set("jobs:last_refresh", "1")
    await cache.set("jobs:refresh:abc", "1")
    await cache.set("applications:stats", "kept")
    await cache.xadd("document.generated", {"offer": str(uuid4()), "at": str(datetime.now(UTC))})
    await cache.xgroup_create("document.generated", "readers", id="0")

    await clear_cache(cache, prefixes=["jobs:"], streams=["document.generated", "absent.stream"])

    assert await cache.keys("jobs:*") == []
    assert await cache.get("applications:stats") == "kept"
    assert await cache.xlen("document.generated") == 0
    assert (await cache.xinfo_groups("document.generated"))[0]["name"] == "readers"
