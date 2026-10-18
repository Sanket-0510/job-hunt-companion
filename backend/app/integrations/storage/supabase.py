import httpx

from app.integrations.storage.base import StorageError


class SupabaseStorage:
    """Supabase Storage REST API with the service key. The bucket is private."""

    def __init__(self, url: str, service_key: str, bucket: str, timeout: float = 30):
        self._base = f"{url.rstrip('/')}/storage/v1"
        self._headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}
        self._bucket = bucket
        self._timeout = timeout

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=self._timeout, headers=self._headers)

    async def ensure_bucket(self) -> bool:
        """Create the private bucket if missing. Returns True if it was created."""
        async with self._client() as client:
            r = await client.get(f"{self._base}/bucket/{self._bucket}")
            if r.status_code == 200:
                return False
            r = await client.post(
                f"{self._base}/bucket",
                json={"id": self._bucket, "name": self._bucket, "public": False},
            )
            if r.status_code not in (200, 201):
                raise StorageError(f"Could not create bucket: HTTP {r.status_code}")
            return True

    async def upload(self, path: str, data: bytes, content_type: str) -> None:
        async with self._client() as client:
            r = await client.post(
                f"{self._base}/object/{self._bucket}/{path}",
                content=data,
                headers={"Content-Type": content_type, "x-upsert": "false"},
            )
        if r.status_code not in (200, 201):
            raise StorageError(f"Upload failed: HTTP {r.status_code}")

    async def download(self, path: str) -> bytes:
        async with self._client() as client:
            r = await client.get(f"{self._base}/object/authenticated/{self._bucket}/{path}")
        if r.status_code != 200:
            raise StorageError(f"Download failed: HTTP {r.status_code}")
        return r.content

    async def delete_prefix(self, prefix: str) -> None:
        async with self._client() as client:
            r = await client.post(
                f"{self._base}/object/list/{self._bucket}",
                json={"prefix": prefix, "limit": 1000},
            )
            if r.status_code != 200:
                raise StorageError(f"List failed: HTTP {r.status_code}")
            names = [f"{prefix.rstrip('/')}/{o['name']}" for o in r.json()]
            if names:
                r = await client.request(
                    "DELETE", f"{self._base}/object/{self._bucket}", json={"prefixes": names}
                )
                if r.status_code != 200:
                    raise StorageError(f"Delete failed: HTTP {r.status_code}")
