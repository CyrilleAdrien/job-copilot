"""Mode de l'application, choisi dans l'assistant de configuration : réel ou démonstration.

Il est rangé dans Redis (persistant), comme le modèle choisi : chaque service le lit à chaque
appel, si bien qu'un changement vaut partout sans redémarrage. Les drapeaux de .env
(JOBS_DEMO, MAIL_DEMO, CALENDAR_DEMO, LLM_PROVIDER=demo) forcent toujours la démonstration.
"""

from typing import Literal

from redis.asyncio import Redis
from redis.exceptions import RedisError

MODE_KEY = "app:mode"
Mode = Literal["real", "demo"]
MODES: tuple[Mode, ...] = ("real", "demo")


async def read_mode(cache: Redis | None) -> Mode | None:
    """Le mode choisi, ou None tant que l'assistant n'a pas été terminé (ou si Redis manque)."""
    if cache is None:
        return None
    try:
        value = await cache.get(MODE_KEY)
    except (RedisError, OSError):
        return None
    if isinstance(value, bytes):
        value = value.decode()
    return value if value in MODES else None


async def is_demo(cache: Redis | None, forced: bool = False) -> bool:
    return forced or await read_mode(cache) == "demo"
