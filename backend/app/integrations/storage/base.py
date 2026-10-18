from functools import lru_cache
from typing import Protocol

from app.core.config import get_settings


class StorageError(Exception):
    pass


class StorageClient(Protocol):
    """Private object storage. Paths are keys inside one bucket, e.g. "{user_id}/{id}.pdf"."""

    async def upload(self, path: str, data: bytes, content_type: str) -> None: ...

    async def download(self, path: str) -> bytes: ...

    async def delete_prefix(self, prefix: str) -> None: ...


@lru_cache
def get_storage() -> StorageClient:
    from app.integrations.storage.supabase import SupabaseStorage

    settings = get_settings()
    return SupabaseStorage(
        url=settings.supabase_url,
        service_key=settings.supabase_service_key.get_secret_value(),
        bucket=settings.resume_bucket,
    )
