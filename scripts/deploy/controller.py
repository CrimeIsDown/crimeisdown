#!/usr/bin/python3
"""Release deployment controller; host inventory and configuration stay private."""

import fcntl
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import time
import traceback
import urllib.request

CONFIG_PATH = Path("/etc/crimeisdown/deploy.json")
CONFIG = {}
ROOT = Path(".")
BASE = Path(".")
REPO = ""
PROJECT = "app"
SERVICES = ["api", "frontend", "worker", "scheduler"]


def configure(path=CONFIG_PATH):
    global CONFIG, ROOT, BASE, REPO, PROJECT
    if path.stat().st_mode & 0o077:
        raise ValueError("Deployment configuration must be private")
    values = json.loads(path.read_text())
    root, base = Path(values["state_directory"]), Path(values["application_directory"])
    if not root.is_absolute() or not base.is_absolute() or root == base:
        raise ValueError("Separate absolute application and state directories required")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", values["repository"]):
        raise ValueError("Invalid source repository")
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", values["compose_project"]):
        raise ValueError("Invalid Compose project")
    if not re.fullmatch(r"[a-z0-9][a-z0-9_/-]*", values["image_prefix"]):
        raise ValueError("Invalid image prefix")
    if not values["health_checks"] or not all(
        re.fullmatch(r"http://127\.0\.0\.1:[0-9]+/[^\s]*", url)
        for url in values["health_checks"]
    ):
        raise ValueError("Loopback health checks required")
    CONFIG, ROOT, BASE = values, root, base
    REPO = "https://github.com/" + values["repository"] + ".git"
    PROJECT = values["compose_project"]


def run(args, **kw):
    return subprocess.run([str(a) for a in args], check=True, **kw)


def compose(override=None):
    cmd = [
        "docker",
        "compose",
        "--project-directory",
        str(BASE),
        "-p",
        PROJECT,
        "-f",
        str(BASE / "compose.yml"),
    ]
    if override:
        cmd += ["-f", str(override)]
    return cmd + ["--profile", "jobs"]


def save(path, value):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, indent=2) + "\n")
    tmp.replace(path)


def parse_request(command):
    parts = shlex.split(command)
    if parts == ["rollback"] or parts == ["status"]:
        return parts
    if (
        len(parts) == 3
        and parts[0] == "deploy"
        and re.fullmatch(r"v[0-9]+\.[0-9]+(?:\.[0-9]+)?", parts[1])
        and re.fullmatch(r"[a-f0-9]{40}", parts[2])
    ):
        return parts
    raise ValueError("Unsupported deployment request")


def check_health():
    for url in CONFIG["health_checks"]:
        with urllib.request.urlopen(url, timeout=20) as r:
            if r.status != 200:
                raise RuntimeError("Application health check failed")
    for name in SERVICES:
        ids = subprocess.check_output(compose() + ["ps", "-q", name], text=True).strip()
        if not ids:
            raise RuntimeError("Required service missing")
        info = json.loads(
            subprocess.check_output(["docker", "inspect", ids], text=True)
        )[0]
        if not info["State"]["Running"]:
            raise RuntimeError("Required service stopped")


def transition(target, active):
    # Stop dispatch first, then allow active export work to complete before replacement.
    run(compose(active.get("override")) + ["stop", "-t", "3600", "scheduler", "worker"])
    run(
        compose(target.get("override"))
        + ["up", "-d", "--no-build", "--wait", "--wait-timeout", "180"]
        + SERVICES
    )
    check_health()


def prepare(tag, sha):
    cache = ROOT / "source.git"
    if not cache.exists():
        run(["git", "init", "--bare", cache])
    run(
        [
            "git",
            "--git-dir=" + str(cache),
            "fetch",
            "--force",
            REPO,
            "+refs/heads/main:refs/heads/main",
            "+refs/tags/" + tag + ":refs/tags/" + tag,
        ]
    )
    actual = subprocess.check_output(
        [
            "git",
            "--git-dir=" + str(cache),
            "rev-parse",
            "refs/tags/" + tag + "^{commit}",
        ],
        text=True,
    ).strip()
    if actual != sha:
        raise ValueError("Release tag changed since approval")
    run(
        [
            "git",
            "--git-dir=" + str(cache),
            "merge-base",
            "--is-ancestor",
            sha,
            "refs/heads/main",
        ]
    )
    # Verify a stable published release as well as the immutable commit supplied by CI.
    req = urllib.request.Request(
        "https://api.github.com/repos/"
        + CONFIG["repository"]
        + "/releases/tags/"
        + tag,
        headers={"User-Agent": "CrimeIsDown-release-controller"},
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        release = json.load(response)
    if release["draft"] or release["prerelease"] or not release.get("published_at"):
        raise ValueError("Not a stable published release")
    directory = ROOT / "releases" / (tag + "-" + sha[:12] + "-" + str(time.time_ns()))
    directory.mkdir(parents=True, mode=0o700)
    source = directory / "source"
    source.mkdir()
    archive = directory / "source.tar"
    run(
        [
            "git",
            "--git-dir=" + str(cache),
            "archive",
            "--format=tar",
            "-o",
            archive,
            sha,
        ]
    )
    run(["tar", "-xf", archive, "-C", source])
    archive.unlink()
    for name in [
        "backend.env",
        "compat.env",
        "frontend-runtime.env",
        "frontend-build.env",
        "notifications.json",
        "production_beat.py",
    ]:
        shutil.copy2(ROOT / "config" / name, directory / name)
    # These read-only mounts are readable by the non-root API process; parent directories are private.
    (directory / "notifications.json").chmod(0o644)
    (directory / "production_beat.py").chmod(0o644)
    api_image = CONFIG["image_prefix"] + "-api:" + sha
    frontend_image = CONFIG["image_prefix"] + "-frontend:" + sha
    run(
        [
            "docker",
            "build",
            "-t",
            api_image,
            "-f",
            source / "backend/Dockerfile",
            source,
        ]
    )
    run(
        [
            "docker",
            "run",
            "--rm",
            "--env-file",
            directory / "frontend-build.env",
            "-v",
            str(source / "frontend") + ":/work",
            "-w",
            "/work",
            "node:24-bookworm-slim",
            "sh",
            "-ec",
            "npm ci && npm run build",
        ]
    )
    # Older releases predate the context ignore file. Never send node_modules or environment files to the builder.
    (source / "frontend/.dockerignore").write_text(
        "node_modules\n.git\n.env\n.env.*\ncoverage\n"
    )
    run(
        [
            "docker",
            "build",
            "-t",
            frontend_image,
            "-f",
            source / "frontend/Dockerfile",
            source / "frontend",
        ]
    )
    environment = [
        str(directory / "backend.env"),
        {"path": str(directory / "compat.env"), "format": "raw"},
    ]
    mounts = [
        str(directory / "notifications.json") + ":/run/config/notifications.json:ro"
    ]
    override = {
        "services": {
            "api": {"image": api_image, "env_file": environment, "volumes": mounts},
            "worker": {"image": api_image, "env_file": environment, "volumes": mounts},
            "scheduler": {
                "image": api_image,
                "env_file": environment,
                "volumes": mounts
                + [
                    str(directory / "production_beat.py")
                    + ":/app/backend/production_beat.py:ro"
                ],
            },
            "frontend": {
                "image": frontend_image,
                "env_file": [str(directory / "frontend-runtime.env")],
            },
        }
    }
    save(directory / "override.json", override)
    # Reflection and compatibility checks only: no migration, seed, queue dispatch or outbound mail.
    run(
        compose(directory / "override.json")
        + [
            "run",
            "--rm",
            "--no-deps",
            "api",
            "python",
            "-c",
            'from app.crimeisdown.settings import Settings; from app.crimeisdown.cli import check_schema; from app.crimeisdown.database import Database; s=Settings(); s.encryption_key(); assert s.membership_tiers and not any(k.startswith("demo-") for k in s.membership_tiers); assert s.admin_tier_id in s.membership_tiers; assert s.google_cloud_storage_bucket and s.cache_bucket; assert s.session_cookie; assert s.notification_configuration.read_text(); from pathlib import Path; assert s.google_cloud_key_file and Path(s.google_cloud_key_file).read_text(); check_schema(Database(s.connection_url())); print("Existing schema and private compatibility settings verified")',
        ]
    )
    target = {"tag": tag, "sha": sha, "override": str(directory / "override.json")}
    save(directory / "release.json", target)
    return target


def activate(target):
    state_path = ROOT / "state.json"
    state = json.loads(state_path.read_text())
    active = state["current"]
    try:
        transition(target, active)
    except Exception:
        traceback.print_exc()
        transition(active, target)
        raise RuntimeError("Deployment failed; previous application restored") from None
    save(state_path, {"current": target, "previous": active})


def execute(parts):
    if parts == ["status"]:
        print(json.dumps(json.loads((ROOT / "state.json").read_text())["current"]))
        return
    if parts == ["rollback"]:
        state = json.loads((ROOT / "state.json").read_text())
        if not state.get("previous"):
            raise ValueError("No previous deployment")
        activate(state["previous"])
    else:
        tag, sha = parts[1:]
        state = json.loads((ROOT / "state.json").read_text())
        if state["current"].get("sha") == sha:
            check_health()
            return
        activate(prepare(tag, sha))


def main():
    os.umask(0o077)
    try:
        parts = parse_request(os.environ.get("SSH_ORIGINAL_COMMAND", ""))
    except (ValueError, IndexError):
        print("Unsupported deployment request", file=sys.stderr)
        return 2
    configure()
    with (ROOT / "deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if parts == ["status"]:
            execute(parts)
            return 0
        log = ROOT / "logs" / (str(time.time_ns()) + ".log")
        with log.open("w") as stream:
            original = os.dup(1), os.dup(2)
            os.dup2(stream.fileno(), 1)
            os.dup2(stream.fileno(), 2)
            success = False
            try:
                execute(parts)
                success = True
            except Exception:
                traceback.print_exc()
            finally:
                sys.stdout.flush()
                sys.stderr.flush()
                os.dup2(original[0], 1)
                os.dup2(original[1], 2)
                os.close(original[0])
                os.close(original[1])
        print(
            "Release operation completed; health checks passed."
            if success
            else "Release operation failed. Private server logs contain details."
        )
        return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
