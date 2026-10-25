import hashlib
import hmac
from datetime import timedelta
from pathlib import Path
from typing import Any
from urllib.parse import quote


class GCSStorage:
    def __init__(self, settings: Any) -> None:
        self.settings = settings
        self._client = None

    @property
    def client(self) -> Any:
        if self._client is None:
            from google.cloud import storage  # type: ignore[import-untyped]

            self._client = (
                storage.Client.from_service_account_json(
                    self.settings.google_cloud_key_file
                )
                if self.settings.google_cloud_key_file
                else storage.Client()
            )
        return self._client

    def bucket(self, kind: Any) -> Any:
        return self.client.bucket(
            self.settings.google_cloud_storage_bucket
            if kind == "recordings"
            else self.settings.cache_bucket
        )

    def listing(self, kind: Any, prefix: Any) -> Any:
        directory = prefix.rpartition("/")[0]
        return sorted(
            blob.name
            for blob in self.client.list_blobs(
                self.bucket(kind),
                prefix=directory + "/" if directory else "",
                delimiter="/",
            )
            if blob.name.startswith(prefix)
        )

    def download(self, kind: Any, name: Any, destination: Any) -> Any:
        self.bucket(kind).blob(name).download_to_filename(destination)

    def upload(self, kind: Any, name: Any, source: Any) -> Any:
        self.bucket(kind).blob(name).upload_from_filename(
            source, content_type="audio/mpeg"
        )

    def delete(self, kind: Any, name: Any) -> Any:
        self.bucket(kind).blob(name).delete()

    def url(self, name: Any, now: Any) -> Any:
        return (
            self.bucket("cache")
            .blob(name)
            .generate_signed_url(
                expiration=timedelta(days=1), version="v4", method="GET"
            )
        )


class LocalStorage:
    """Explicit local fixture/archive adapter, with authenticated expiring URLs."""

    def __init__(self, root: Any, settings: Any) -> None:
        self.root = Path(root)
        self.settings = settings

    def path(self, kind: Any, name: Any) -> Any:
        root = (self.root / kind).resolve()
        path = (root / name).resolve()
        if not path.is_relative_to(root):
            raise ValueError("Invalid archive path")
        return path

    def listing(self, kind: Any, prefix: Any) -> Any:
        directory = prefix.rpartition("/")[0]
        root = self.path(kind, directory)
        if not root.exists():
            return []
        base = (self.root / kind).resolve()
        return sorted(
            str(path.relative_to(base))
            for path in root.iterdir()
            if path.is_file() and str(path.relative_to(base)).startswith(prefix)
        )

    def download(self, kind: Any, name: Any, destination: Any) -> Any:
        import shutil

        shutil.copyfile(self.path(kind, name), destination)

    def upload(self, kind: Any, name: Any, source: Any) -> Any:
        import shutil

        path = self.path(kind, name)
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, path)

    def delete(self, kind: Any, name: Any) -> Any:
        self.path(kind, name).unlink(missing_ok=True)

    def url(self, name: Any, now: Any) -> Any:
        expires = int((now + timedelta(days=1)).timestamp())
        signature = hmac.new(
            self.settings.encryption_key(), f"{name}|{expires}".encode(), hashlib.sha256
        ).hexdigest()
        return (
            self.settings.app_url.rstrip("/")
            + "/recordings-temp/"
            + quote(name, safe="/")
            + f"?expires={expires}&signature={signature}"
        )
