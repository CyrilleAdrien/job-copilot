"""Calendrier distant en CalDAV (iCloud, Fastmail, Nextcloud...) : découverte et écriture.

La bibliothèque caldav est synchrone : chaque appel passe par un thread.
"""

import asyncio
from dataclasses import dataclass, field
from typing import Protocol

import caldav
from caldav.lib import error as caldav_error


class RemoteError(Exception):
    pass


@dataclass
class RemoteCalendar:
    url: str
    name: str


class Remote(Protocol):
    async def calendars(self) -> list[RemoteCalendar]: ...
    async def put(self, calendar_url: str, uid: str, ics: bytes) -> None: ...
    async def delete(self, calendar_url: str, uid: str) -> None: ...


def readable(exc: Exception) -> str:
    text = str(exc)
    if isinstance(exc, caldav_error.AuthorizationError) or "401" in text:
        return "Identifiant ou mot de passe d'application refusé par le serveur."
    if "403" in text:
        return "Le serveur refuse l'écriture dans ce calendrier."
    return f"Serveur CalDAV injoignable ou incompatible ({type(exc).__name__})."


class CaldavRemote:
    def __init__(self, url: str, username: str, password: str, timeout: int):
        self.url, self.username, self.password, self.timeout = url, username, password, timeout

    def client(self) -> caldav.DAVClient:
        return caldav.DAVClient(
            url=self.url, username=self.username, password=self.password, timeout=self.timeout
        )

    async def run(self, fn):
        try:
            return await asyncio.to_thread(fn)
        except RemoteError:
            raise
        except Exception as exc:  # noqa: BLE001 - erreurs réseau, HTTP ou XML de la bibliothèque
            raise RemoteError(readable(exc)) from exc

    async def calendars(self) -> list[RemoteCalendar]:
        def find():
            with self.client() as client:
                found = []
                for cal in client.principal().calendars():
                    components = cal.get_supported_components() or ["VEVENT"]
                    if "VEVENT" in components:
                        found.append(
                            RemoteCalendar(str(cal.url), cal.get_display_name() or "Calendrier")
                        )
                return found

        return await self.run(find)

    def calendar(self, client: caldav.DAVClient, calendar_url: str):
        return client.calendar(url=calendar_url)

    async def put(self, calendar_url: str, uid: str, ics: bytes) -> None:
        def save():
            with self.client() as client:
                self.calendar(client, calendar_url).save_event(ics.decode())

        await self.run(save)

    async def delete(self, calendar_url: str, uid: str) -> None:
        def remove():
            with self.client() as client:
                try:
                    self.calendar(client, calendar_url).event_by_uid(uid).delete()
                except caldav_error.NotFoundError:
                    return  # déjà supprimé à distance

        await self.run(remove)


@dataclass
class DemoRemote:
    """Serveur CalDAV fictif (CALENDAR_DEMO=true et tests) : garde les événements en mémoire."""

    events: dict[str, bytes] = field(default_factory=dict)
    fail: bool = False

    async def calendars(self) -> list[RemoteCalendar]:
        if self.fail:
            raise RemoteError("Identifiant ou mot de passe d'application refusé par le serveur.")
        return [
            RemoteCalendar("demo://calendars/travail", "Travail"),
            RemoteCalendar("demo://calendars/perso", "Personnel"),
        ]

    async def put(self, calendar_url: str, uid: str, ics: bytes) -> None:
        if self.fail:
            raise RemoteError("Serveur CalDAV injoignable ou incompatible (démo).")
        self.events[uid] = ics

    async def delete(self, calendar_url: str, uid: str) -> None:
        self.events.pop(uid, None)
