"""Check source and optional Git history without printing matched values."""
import argparse
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = [
    re.compile(rb"/(?:Users/[^/\s]+/(?:Code|code)|opt)/[A-Za-z0-9_/-]+"),
    re.compile(rb"(?<![0-9])(?:10\.[0-9]{1,3}|192\.168|172\.(?:1[6-9]|2[0-9]|3[01]))\.[0-9]{1,3}\.[0-9]{1,3}(?![0-9])"),
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
    re.compile(rb"\bUA-[0-9]+-[0-9]+\b|\bG-[A-Z0-9]{6,}\b"),
    re.compile(rb"(?:\bdoorbellId\s*=\s*[\"\x27]?|embed\.doorbell\.io/button/)[1-9][0-9]*|\bhjid\s*[:=]\s*[1-9][0-9]*"),
]


def forbidden(name):
    path = Path(name)
    return (
        path.name == ".env"
        or (path.name.startswith(".env.") and path.name != ".env.example")
        or path.suffix.lower() in (".pem", ".key")
        or path.name.endswith("credentials.json")
        or name.startswith(("archive/", "deploy/production/", "deploy/bluegreen/"))
        or name in (".github/workflows/cloudflare-pages.yml", "frontend/.github/workflows/cloudflare-pages.yml", "wrangler.jsonc", "frontend/wrangler.jsonc")
    )


def matched(data):
    return b"\0" not in data and any(pattern.search(data) for pattern in PATTERNS)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", action="store_true", help="also inspect blobs and messages across all local refs")
    args = parser.parse_args()
    failures = set()
    names = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    for name in filter(None, names):
        path = ROOT / name
        if path.is_file() and (forbidden(name) or matched(path.read_bytes())):
            failures.add(name)
    if args.history:
        objects = subprocess.check_output(["git", "rev-list", "--objects", "--all"], cwd=ROOT, text=True).splitlines()
        paths = {line.split(" ", 1)[0]: line.split(" ", 1)[1] for line in objects if " " in line}
        metadata = subprocess.check_output(["git", "cat-file", "--batch-check=%(objectname) %(objecttype)"], cwd=ROOT, input="\n".join(paths)+"\n", text=True).splitlines()
        with subprocess.Popen(["git", "cat-file", "--batch"], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE) as process:
            for item in metadata:
                oid, kind = item.split()
                if kind != "blob":
                    continue
                process.stdin.write((oid+"\n").encode())
                process.stdin.flush()
                size = int(process.stdout.readline().split()[2])
                data = process.stdout.read(size)
                process.stdout.read(1)
                if forbidden(paths[oid]) or matched(data):
                    failures.add("history:"+paths[oid])
            process.stdin.close()
            process.wait()
        messages = subprocess.check_output(["git", "log", "--all", "--format=%B"], cwd=ROOT)
        if matched(messages):
            failures.add("historical commit messages")
    if failures:
        raise SystemExit("Publication review required for: " + ", ".join(sorted(failures)))
    print("Publication checks passed" + (" across tracked files and all local history." if args.history else " for tracked files."))


if __name__ == "__main__":
    main()
