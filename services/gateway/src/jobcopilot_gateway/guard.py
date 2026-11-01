"""Refuse les requêtes venues d'un autre site : l'API locale n'a pas de compte ni de mot de passe.

Sans ce contrôle, une page malveillante ouverte dans le navigateur pourrait appeler l'API sur
localhost, soit directement (Origin), soit en faisant pointer son domaine sur 127.0.0.1 (Host).
"""

import json
from urllib.parse import urlsplit

from starlette.types import ASGIApp, Receive, Scope, Send

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "gateway"}
READ_ONLY = {"GET", "HEAD", "OPTIONS"}


def is_local(url: str) -> bool:
    try:
        return urlsplit(url).hostname in LOCAL_HOSTS
    except ValueError:
        return False


def is_allowed(method: str, host: str | None, origin: str | None) -> bool:
    if host is None or not is_local(f"//{host}"):
        return False
    return origin is None or method in READ_ONLY or is_local(origin)


class LocalOnly:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {key.decode(): value.decode() for key, value in scope["headers"]}
        if is_allowed(scope["method"], headers.get("host"), headers.get("origin")):
            await self.app(scope, receive, send)
            return
        body = json.dumps({"detail": "Requête refusée : origine non locale."}).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send({"type": "http.response.body", "body": body})
