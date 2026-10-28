"""Seed a disposable, loopback Meilisearch with clearly labeled synthetic calls."""

import argparse
import json
import os
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:7700")
    parser.add_argument("--env-file", type=Path, default=Path("/tmp/cid-homepage-search.env"))
    parser.add_argument("--public-url", default="http://localhost:7700")
    args = parser.parse_args()
    if os.environ.get("CID_DEMO") != "1":
        raise SystemExit("Set CID_DEMO=1 to seed synthetic local test data.")
    if urlparse(args.url).hostname not in ("localhost", "127.0.0.1", "::1"):
        raise SystemExit("This fixture loader only writes to loopback search services.")
    values = dict(line.split("=", 1) for line in args.env_file.read_text().splitlines() if "=" in line)
    master_key = values["MEILI_MASTER_KEY"]

    def request(path, body=None, method="GET"):
        data = json.dumps(body).encode() if body is not None else None
        req = Request(args.url.rstrip("/") + path, data=data, method=method, headers={
            "Authorization": "Bearer " + master_key, "Content-Type": "application/json",
        })
        with urlopen(req, timeout=10) as response:
            return json.load(response)

    def wait(result):
        for _ in range(100):
            task = request("/tasks/" + str(result["taskUid"]))
            if task["status"] == "succeeded":
                return
            if task["status"] == "failed":
                raise RuntimeError(task.get("error", {}).get("message", "Search task failed"))
            time.sleep(0.1)
        raise RuntimeError("Local search setup timed out")

    for _ in range(50):
        try:
            request("/health")
            break
        except OSError:
            time.sleep(0.1)
    indexes = request("/indexes")
    if not any(index["uid"] == "calls_demo" for index in indexes["results"]):
        wait(request("/indexes", {"uid":"calls_demo", "primaryKey":"id"}, "POST"))
    wait(request("/indexes/calls_demo/settings", {
        "searchableAttributes":["transcript_plaintext"],
        "filterableAttributes":["start_time","short_name","talkgroup","talkgroup_tag","talkgroup_description","talkgroup_group","talkgroup_group_tag","talkgroup_hierarchy.lvl0","talkgroup_hierarchy.lvl1","talkgroup_hierarchy.lvl2","audio_type","units","radios","_geo"],
        "sortableAttributes":["start_time"],
    }, "PATCH"))

    def call(number, system, talkgroup, tag, group, text):
        return {
            "id":"local-test-" + str(number), "short_name":system,
            "talkgroup":talkgroup,"talkgroup_tag":tag,"talkgroup_group":group,
            "talkgroup_description":"SYNTHETIC LOCAL TEST DATA — " + tag,
            "talkgroup_group_tag":"Law Dispatch" if system == "chi_cpd" else "Fire Dispatch",
            "talkgroup_hierarchy":{"lvl0":system,"lvl1":system + " > " + group,"lvl2":system + " > " + group + " > " + tag},
            "transcript_plaintext":"SYNTHETIC LOCAL TEST DATA: " + text,
            "start_time":1673118015 + number * 60,"stop_time":1673118023 + number * 60,
            "call_length":8,"audio_type":"digital","units":[],"radios":[],
            "raw_metadata":"{}","raw_audio_url":"",
        }
    documents = [
        call(1,"chi_cpd",8,"Chi PD Zone 8","Chicago Police Department (CPD)","Zone 8 dispatch: training message for the Avalon Park search test."),
        call(2,"chi_oemc",1022,"CFD Fire Englewd","Chicago Fire Department","Fire Englewood dispatch: training message for the South Side search test."),
        call(3,"chi_cpd",7,"Chi PD Zone 7","Chicago Police Department (CPD)","Zone 7 dispatch: training message for the police headquarters search test."),
        call(4,"chi_cfd",1022,"CFD Fire S","Chicago Fire Department","Duplicate conventional CFD patch: excluded from homepage searches."),
        call(5,"chi_cpd",2,"Chi PD Zone 2","Chicago Police Department (CPD)","Zone 2 dispatch: northern control record, excluded from Zone 8 searches."),
        call(6,"chi_oemc",1021,"CFD Fire Main","Chicago Fire Department","Fire Main dispatch: northern control record, excluded from Englewood searches."),
        call(7,"chi_oemc",1024,"CFD EMS Englewood","Chicago Fire Department","EMS South dispatch: training message for the South Side search test."),
        call(8,"chi_oemc",1023,"CFD EMS Main","Chicago Fire Department","EMS North dispatch: northern control record, excluded from Englewood searches."),
    ]
    wait(request("/indexes/calls_demo/documents",documents,"POST"))
    key = request("/keys",{"description":"Local synthetic demo search only","actions":["search"],"indexes":["calls_demo"],"expiresAt":None},"POST")["key"]
    path = ROOT / "frontend/.env.local"
    lines = path.read_text().splitlines() if path.exists() else []
    changes = {"PUBLIC_MEILISEARCH_URL":args.public_url,"PUBLIC_MEILISEARCH_DEMO_KEY":key}
    lines = [line for line in lines if line.split("=",1)[0] not in changes]
    lines.extend(name + "=" + value for name,value in changes.items())
    path.write_text("\n".join(lines) + "\n")
    print(f"Seeded {len(documents)} synthetic calls and configured a search-only demo key in ignored frontend/.env.local")


if __name__ == "__main__":
    main()
