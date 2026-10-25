"""Check tracked files for operational disclosures without printing matched values."""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
patterns = [
    re.compile(rb"/(?:Users/[^/\s]+/(?:Code|code)|opt)/[A-Za-z0-9_/-]+"),
    re.compile(rb"(?<![0-9])(?:10\.[0-9]{1,3}|192\.168|172\.(?:1[6-9]|2[0-9]|3[01]))\.[0-9]{1,3}\.[0-9]{1,3}(?![0-9])"),
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
]
failures = []
for name in subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines():
    path = ROOT / name
    if not path.is_file():
        continue
    forbidden = (path.name == ".env" or (path.name.startswith(".env.") and path.name != ".env.example") or path.suffix in (".pem", ".key") or name.startswith(("archive/", "deploy/production/", "deploy/bluegreen/")))
    content = path.read_bytes()
    if forbidden or (b"\0" not in content and any(p.search(content) for p in patterns)):
        failures.append(name)
if failures:
    raise SystemExit("Publication review required for: " + ", ".join(failures))
print("Tracked-file publication checks passed.")
