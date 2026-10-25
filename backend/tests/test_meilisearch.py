"""Use the deployed frontend's JSON contract with a real scoped Meilisearch key."""

import os
import time
import uuid
from datetime import UTC, datetime

import httpx
import pytest

from .conftest import bearer


def test_frontend_key_searches_monthly_indexes_without_admin_privileges(pair):
    port = os.environ.get("CID_PARITY_MEILI_PORT")
    if not port:
        pytest.skip("Set CID_PARITY_MEILI_PORT for the real Meilisearch fixture")
    host = "http://127.0.0.1:" + port
    prefix = "calls_parity_" + uuid.uuid4().hex
    admin = httpx.Client(
        base_url=host, headers={"Authorization": "Bearer cid-review-meili-master-key"}
    )

    def wait(response):
        response.raise_for_status()
        uid = response.json()["taskUid"]
        for _ in range(100):
            task = admin.get("/tasks/" + str(uid)).json()
            if task["status"] == "succeeded":
                return
            if task["status"] == "failed":
                raise AssertionError(task)
            time.sleep(0.05)
        raise AssertionError("Task timed out")

    _, app, client, *_ = pair
    settings = app.state.settings
    settings.meilisearch_host = host
    settings.meilisearch_hosts = ""
    settings.meilisearch_index = prefix
    from pydantic import SecretStr

    settings.meilisearch_key = SecretStr("cid-review-meili-master-key")
    app.state.services.http = httpx.Client(timeout=30)
    app.state.services.now = lambda: datetime.now(UTC)
    indexes = [prefix + "_2026_10", prefix + "_2025_10"]
    try:
        for index in indexes:
            wait(admin.post("/indexes", json={"uid": index, "primaryKey": "id"}))
            wait(
                admin.patch(
                    "/indexes/" + index + "/settings",
                    json={
                        "searchableAttributes": ["transcript_plaintext"],
                        "filterableAttributes": ["short_name"],
                        "sortableAttributes": ["start_time"],
                    },
                )
            )
            wait(
                admin.post(
                    "/indexes/" + index + "/documents",
                    json=[
                        {
                            "id": "1",
                            "transcript_plaintext": "Dispatch test incident",
                            "short_name": "chi_cpd",
                            "start_time": 123,
                        }
                    ],
                )
            )
        assert (
            client.get(
                "/api/search-key", headers={"Accept": "application/json"}
            ).status_code
            == 401
        )
        assert client.get("/api/search-key", headers=bearer(4)).status_code == 403
        response = client.get("/api/search-key", headers=bearer(1))
        assert response.status_code == 200
        key = response.json()["meilisearch"]
        assert key != "cid-review-meili-master-key"
        with httpx.Client(
            base_url=host, headers={"Authorization": "Bearer " + key}
        ) as scoped:
            search = scoped.post(
                "/multi-search",
                json={
                    "queries": [
                        {
                            "indexUid": index,
                            "q": "dispatch",
                            "filter": ["short_name=chi_cpd"],
                            "facets": ["short_name"],
                            "sort": ["start_time:desc"],
                        }
                        for index in indexes
                    ]
                },
            )
            assert search.status_code == 200, search.text
            assert all(
                result["hits"][0]["id"] == "1" for result in search.json()["results"]
            )
            assert scoped.get("/keys").status_code == 403
            assert (
                scoped.post(
                    "/indexes/" + indexes[0] + "/documents", json=[{"id": "2"}]
                ).status_code
                == 403
            )
            assert (
                scoped.post(
                    "/indexes/private_account_records/search", json={"q": ""}
                ).status_code
                == 403
            )
    finally:
        for index in indexes:
            admin.delete("/indexes/" + index)
        admin.close()
        app.state.services.http.close()
