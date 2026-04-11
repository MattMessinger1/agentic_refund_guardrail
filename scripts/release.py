#!/usr/bin/env python3
"""Release helpers for synchronized Python and TypeScript package versions."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
PYPROJECT = ROOT / "pyproject.toml"
TS_PACKAGE = ROOT / "packages" / "refund-guard-ts" / "package.json"
TS_LOCK = ROOT / "packages" / "refund-guard-ts" / "package-lock.json"
NPM_PACKAGE = "@mattmessinger/refund-guard"
PYPI_PACKAGE = "refund-guard"
SEMVER_RE = re.compile(
    r"^v?(?P<version>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$"
)


def normalize_version(raw: str) -> str:
    match = SEMVER_RE.match(raw.strip())
    if not match:
        raise SystemExit(f"Invalid version '{raw}'. Expected X.Y.Z, for example 0.5.0.")
    return match.group("version")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text())


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n")


def read_pyproject_version() -> str:
    text = PYPROJECT.read_text()
    match = re.search(r'^version = "([^"]+)"$', text, flags=re.MULTILINE)
    if not match:
        raise SystemExit("Could not find project version in pyproject.toml.")
    return match.group(1)


def write_pyproject_version(version: str) -> None:
    text = PYPROJECT.read_text()
    updated, count = re.subn(
        r'^version = "[^"]+"$',
        f'version = "{version}"',
        text,
        count=1,
        flags=re.MULTILINE,
    )
    if count != 1:
        raise SystemExit("Could not update project version in pyproject.toml.")
    PYPROJECT.write_text(updated)


def get_versions() -> dict[str, str]:
    ts_package = read_json(TS_PACKAGE)
    ts_lock = read_json(TS_LOCK)
    return {
        "python": read_pyproject_version(),
        "typescript": str(ts_package.get("version", "")),
        "typescript_lock": str(ts_lock.get("packages", {}).get("", {}).get("version", "")),
    }


def set_version(version: str) -> None:
    version = normalize_version(version)
    write_pyproject_version(version)

    ts_package = read_json(TS_PACKAGE)
    ts_package["version"] = version
    write_json(TS_PACKAGE, ts_package)

    ts_lock = read_json(TS_LOCK)
    ts_lock["version"] = version
    ts_lock.setdefault("packages", {}).setdefault("", {})["version"] = version
    write_json(TS_LOCK, ts_lock)


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def tag_exists(version: str, remote: str | None) -> bool:
    tag = f"v{version}"
    local = run(["git", "tag", "--list", tag])
    if local.returncode != 0:
        raise SystemExit(local.stderr.strip() or "Could not inspect local tags.")
    if local.stdout.strip():
        return True

    if remote:
        ref = f"refs/tags/{tag}"
        remote_check = run(["git", "ls-remote", "--tags", remote, ref])
        if remote_check.returncode != 0:
            raise SystemExit(remote_check.stderr.strip() or f"Could not inspect tags on {remote}.")
        return bool(remote_check.stdout.strip())

    return False


def npm_version_exists(version: str) -> bool:
    result = run(["npm", "view", f"{NPM_PACKAGE}@{version}", "version", "--json"])
    if result.returncode == 0 and result.stdout.strip():
        return True
    combined_output = f"{result.stdout}\n{result.stderr}"
    if "E404" in combined_output or "No match found" in combined_output:
        return False
    raise SystemExit(result.stderr.strip() or f"Could not check npm for {NPM_PACKAGE}@{version}.")


def pypi_version_exists(version: str) -> bool:
    url = f"https://pypi.org/pypi/{PYPI_PACKAGE}/{version}/json"
    request = Request(url, headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=10) as response:
            return response.status == 200
    except HTTPError as exc:
        if exc.code == 404:
            return False
        raise SystemExit(f"PyPI returned HTTP {exc.code} while checking {PYPI_PACKAGE} {version}.")
    except URLError as exc:
        raise SystemExit(f"Could not check PyPI for {PYPI_PACKAGE} {version}: {exc.reason}")


def validate_versions(expected: str | None) -> str:
    versions = get_versions()
    unique = set(versions.values())
    if len(unique) != 1:
        details = ", ".join(f"{key}={value}" for key, value in versions.items())
        raise SystemExit(f"Package versions disagree: {details}")

    version = normalize_version(unique.pop())
    if expected is not None and version != normalize_version(expected):
        raise SystemExit(f"Expected version {expected}, but files contain {version}.")
    return version


def cmd_versions(_args: argparse.Namespace) -> None:
    print(json.dumps(get_versions(), indent=2))


def cmd_set_version(args: argparse.Namespace) -> None:
    set_version(args.version)
    print(f"Set Python and TypeScript versions to {normalize_version(args.version)}.")


def cmd_validate_current(args: argparse.Namespace) -> None:
    version = validate_versions(args.version)
    validate_target_version(version, args)
    print(f"Release metadata is valid for v{version}.")


def validate_target_version(version: str, args: argparse.Namespace) -> None:
    version = normalize_version(version)

    if args.tag_state != "ignore":
        exists = tag_exists(version, args.remote)
        if args.tag_state == "absent" and exists:
            raise SystemExit(f"Tag v{version} already exists.")
        if args.tag_state == "present" and not exists:
            raise SystemExit(f"Tag v{version} does not exist.")

    if args.npm_unpublished and npm_version_exists(version):
        raise SystemExit(f"{NPM_PACKAGE}@{version} is already published on npm.")

    if args.pypi_unpublished and pypi_version_exists(version):
        raise SystemExit(f"{PYPI_PACKAGE}=={version} is already published on PyPI.")


def cmd_validate_target(args: argparse.Namespace) -> None:
    version = normalize_version(args.version)
    validate_target_version(version, args)
    print(f"Release target is valid for v{version}.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(required=True)

    versions = subparsers.add_parser("versions", help="Print package versions as JSON.")
    versions.set_defaults(func=cmd_versions)

    set_parser = subparsers.add_parser("set-version", help="Synchronize package versions.")
    set_parser.add_argument("version", help="Version in X.Y.Z format, with or without leading v.")
    set_parser.set_defaults(func=cmd_set_version)

    validate = subparsers.add_parser("validate-current", help="Validate release metadata.")
    validate.add_argument("--version", help="Expected version in X.Y.Z format.")
    validate.add_argument("--remote", default="origin", help="Remote used for tag checks.")
    validate.add_argument(
        "--tag-state",
        choices=["absent", "present", "ignore"],
        default="ignore",
        help="Required state for tag vX.Y.Z.",
    )
    validate.add_argument("--npm-unpublished", action="store_true", help="Fail if npm already has this version.")
    validate.add_argument("--pypi-unpublished", action="store_true", help="Fail if PyPI already has this version.")
    validate.set_defaults(func=cmd_validate_current)

    target = subparsers.add_parser("validate-target", help="Validate a requested release version.")
    target.add_argument("version", help="Target version in X.Y.Z format, with or without leading v.")
    target.add_argument("--remote", default="origin", help="Remote used for tag checks.")
    target.add_argument(
        "--tag-state",
        choices=["absent", "present", "ignore"],
        default="ignore",
        help="Required state for tag vX.Y.Z.",
    )
    target.add_argument("--npm-unpublished", action="store_true", help="Fail if npm already has this version.")
    target.add_argument("--pypi-unpublished", action="store_true", help="Fail if PyPI already has this version.")
    target.set_defaults(func=cmd_validate_target)

    return parser


def main() -> int:
    args = build_parser().parse_args()
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
