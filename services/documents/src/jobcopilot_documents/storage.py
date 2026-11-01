"""Stockage des PDF via l'API S3 standard : SeaweedFS en local, AWS S3 sans changer le code."""

import asyncio
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError

from jobcopilot_common import get_settings
from jobcopilot_documents.settings import get_documents_settings


class Storage:
    def __init__(self, client, bucket: str):
        self.client = client
        self.bucket = bucket
        self.ready = False

    def _ensure_bucket(self) -> None:
        if self.ready:
            return
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError:
            self.client.create_bucket(Bucket=self.bucket)
        self.ready = True

    def _put(self, key: str, body: bytes) -> None:
        self._ensure_bucket()
        self.client.put_object(
            Bucket=self.bucket, Key=key, Body=body, ContentType="application/pdf"
        )

    def _get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def _clear(self) -> None:
        self._ensure_bucket()
        # Un appel par fichier : DeleteObjects n'est pas garanti sur tous les serveurs S3.
        for page in self.client.get_paginator("list_objects_v2").paginate(Bucket=self.bucket):
            for item in page.get("Contents", []):
                self.client.delete_object(Bucket=self.bucket, Key=item["Key"])

    async def clear(self) -> None:
        await asyncio.to_thread(self._clear)

    async def put(self, key: str, body: bytes) -> None:
        await asyncio.to_thread(self._put, key, body)

    async def get(self, key: str) -> bytes:
        return await asyncio.to_thread(self._get, key)


@lru_cache
def get_storage() -> Storage:
    settings = get_documents_settings()
    client = boto3.client(
        "s3",
        endpoint_url=get_settings().s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
    )
    return Storage(client, settings.s3_bucket)
