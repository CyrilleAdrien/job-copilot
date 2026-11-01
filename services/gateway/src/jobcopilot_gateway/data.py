"""Export complet et suppression de toutes les données, en réunissant les six services."""

import asyncio
import io
import json
import os
import zipfile
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, HTTPException, Response, status

SERVICES = ["profile", "jobs", "documents", "applications", "mail", "calendar"]
TIMEOUT = 120.0
ZIP_FOLDER = "job-copilot"
PHOTO_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

router = APIRouter(tags=["data"])


def service_url(name: str) -> str:
    """URL d'un service, surchargeable par variable d'environnement (ex. PROFILE_URL)."""
    return os.getenv(f"{name.upper()}_URL", f"http://{name}:8000")


async def _export_service(client: httpx.AsyncClient, name: str) -> dict[str, list[dict]]:
    response = await client.get(f"{service_url(name)}/data/export")
    response.raise_for_status()
    return response.json()


async def _optional(client: httpx.AsyncClient, url: str) -> httpx.Response | None:
    """Un fichier facultatif : absent (ou illisible), il est signalé sans bloquer l'export."""
    try:
        response = await client.get(url)
    except httpx.HTTPError:
        return None
    return response if response.status_code == status.HTTP_200_OK else None


def _build_zip(entries: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(f"{ZIP_FOLDER}/{name}", content)
    return buffer.getvalue()


@router.get("/api/data/export")
async def export_all() -> Response:
    """Une archive .zip : un JSON par service, le profile.yaml, la photo et les PDF.

    Les mots de passe chiffrés n'en font pas partie. Un service injoignable fait échouer
    l'export : une archive incomplète donnerait une fausse impression de sauvegarde.
    """
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        results = await asyncio.gather(
            *(_export_service(client, name) for name in SERVICES), return_exceptions=True
        )
        failed = [
            name
            for name, result in zip(SERVICES, results, strict=True)
            if isinstance(result, Exception)
        ]
        if failed:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                f"Export impossible, service indisponible : {', '.join(failed)}.",
            )
        tables = dict(zip(SERVICES, results, strict=True))

        entries = {
            f"{name}.json": json.dumps(data, ensure_ascii=False, indent=2).encode()
            for name, data in tables.items()
        }
        missing: list[str] = []

        if tables["profile"].get("profiles"):
            yaml = await _optional(client, f"{service_url('profile')}/export")
            if yaml:
                entries["profile.yaml"] = yaml.content
            else:
                missing.append("profile.yaml")
        if tables["profile"].get("photos"):
            photo = await _optional(client, f"{service_url('profile')}/photo")
            if photo:
                kind = photo.headers.get("content-type", "").split(";")[0]
                entries[f"photo.{PHOTO_EXTENSIONS.get(kind, 'img')}"] = photo.content
            else:
                missing.append("photo")

        documents = tables["documents"].get("documents", [])
        pdfs = await asyncio.gather(
            *(
                _optional(client, f"{service_url('documents')}/documents/{doc['id']}/pdf")
                for doc in documents
            )
        )
        for document, pdf in zip(documents, pdfs, strict=True):
            name = f"documents/{document['kind']}-{document['id']}.pdf"
            if pdf:
                entries[name] = pdf.content
            else:
                missing.append(name)

    exported_at = datetime.now(UTC)
    entries["manifest.json"] = json.dumps(
        {
            "exported_at": exported_at.isoformat(),
            "services": {
                name: {table: len(rows) for table, rows in data.items()}
                for name, data in tables.items()
            },
            "missing": missing,
        },
        ensure_ascii=False,
        indent=2,
    ).encode()

    archive = await asyncio.to_thread(_build_zip, entries)
    filename = f"job-copilot-{exported_at:%Y-%m-%d}.zip"
    return Response(
        archive,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _erase_service(client: httpx.AsyncClient, name: str) -> None:
    response = await client.delete(f"{service_url(name)}/data")
    response.raise_for_status()


@router.delete("/api/data", status_code=status.HTTP_204_NO_CONTENT)
async def erase_all() -> None:
    """Supprime tout, service par service. Peut être relancé si un service n'a pas répondu."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        results = await asyncio.gather(
            *(_erase_service(client, name) for name in SERVICES), return_exceptions=True
        )
    failed = [
        name
        for name, result in zip(SERVICES, results, strict=True)
        if isinstance(result, Exception)
    ]
    if failed:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Suppression incomplète, relance-la. Service indisponible : {', '.join(failed)}.",
        )
