import re
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse


def register_health(app: FastAPI, services: Any) -> Any:
    @app.get("/api/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/search-health")
    def search_health(request: Request) -> Any:
        if request.query_params.get("engine") != "meilisearch":
            return PlainTextResponse("engine param not set", status_code=500)
        try:
            age = int(request.query_params.get("age", 1800))
        except ValueError:
            age = 0
        s = services.settings
        index = s.meilisearch_index + "_" + services.now().strftime("%Y_%m")
        response = services.http.post(
            s.meilisearch_host.rstrip("/") + "/indexes/" + index + "/search",
            headers={"Authorization": "Bearer " + s.meilisearch_key.get_secret_value()},
            json={
                "q": "",
                "filter": "start_time > " + str(int(services.now().timestamp()) - age),
                "limit": 1,
            },
        )
        response.raise_for_status()
        return PlainTextResponse(str(response.json().get("estimatedTotalHits", 0)))

    @app.get("/api/openmhz-health/{system_name}")
    def openmhz(system_name: str, request: Request) -> Any:
        if not re.fullmatch("[A-Za-z0-9_-]+", system_name):
            raise HTTPException(404, "Not Found")
        params = {
            k: request.query_params[k]
            for k in ("filter-type", "filter-code")
            if k in request.query_params
        }
        try:
            response = services.http.get(
                "https://api.openmhz.com/" + system_name + "/calls",
                params=params,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; OpenMHz Health Check)"
                },
            )
        except httpx.TransportError:
            return PlainTextResponse("Got server error, assuming OK")
        if response.status_code >= 500:
            return PlainTextResponse("Got server error, assuming OK")
        if response.status_code == 200:
            calls = response.json().get("calls", [])
            if not calls:
                return PlainTextResponse("No recent calls found", status_code=404)
            last = calls[0]["time"]
            last = datetime.fromisoformat(last.replace("Z", "+00:00"))
            age = float(request.query_params.get("max_allowed_age", "10"))
            if (
                abs(
                    (
                        services.now() - last.replace(tzinfo=last.tzinfo or UTC)
                    ).total_seconds()
                )
                > age * 60
            ):
                return PlainTextResponse("No recent calls found", status_code=404)
        return PlainTextResponse(
            response.reason_phrase, status_code=response.status_code
        )

    @app.get("/api/livestream-health")
    def livestream() -> Any:
        s = services.settings
        response = services.http.get(
            "https://www.youtube.com/embed/live_stream",
            params={"channel": s.cid_channel_id},
        )
        if response.status_code != 200:
            raise HTTPException(response.status_code, "Could not get video ID")
        match = re.search(
            r'<link rel="canonical" href="https://www.youtube.com/watch\?v=(.*?)">',
            response.text,
        )
        if not match:
            raise HTTPException(400, "Could not parse video ID")
        response = services.http.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={
                "part": "snippet",
                "id": match[1],
                "key": s.youtube_api_key.get_secret_value(),
            },
            headers={
                "referer": "https://explorer.apis.google.com",
                "x-referer": "https://explorer.apis.google.com",
            },
        )
        if response.status_code == 403:
            return PlainTextResponse("Skipped check, hit API quota")
        if response.status_code != 200:
            raise HTTPException(response.status_code, "Heartbeat request failed")
        items = response.json().get("items", [])
        return (
            PlainTextResponse("Livestream online")
            if items
            and items[0].get("snippet", {}).get("liveBroadcastContent") == "live"
            else PlainTextResponse("No live streams found", status_code=404)
        )
