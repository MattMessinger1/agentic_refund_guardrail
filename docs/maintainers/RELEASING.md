# Releasing refund-guard (Python + TypeScript)

> **End users:** see the main [README](../../README.md). This file is for maintainers **publishing** new versions.

## Versioning

- Treat **one semantic version** for the *behavior* of the library (e.g. `0.2.0`).
- Publish **both** artifacts from the same git tag when behavior or fixtures change:
  - **PyPI:** `refund-guard` (see `pyproject.toml`)
  - **npm:** `@mattmessinger/refund-guard` (see `packages/refund-guard-ts/package.json`)

Keep version numbers in those two files **in sync** unless you intentionally ship a packaging-only fix for one ecosystem (rare).

## Contract tests

Before tagging:

1. `python3 -m pytest` (from repo root)
2. `cd packages/refund-guard-ts && npm test && npm run build`

Edits to refund logic must update [contracts/parity/cases.json](contracts/parity/cases.json) when behavior changes.

## Automated publishing (preferred)

Both workflows trigger on **GitHub Release published** or **workflow_dispatch**:

| Package | Workflow | Setup |
|---------|----------|-------|
| PyPI (`refund-guard`) | `.github/workflows/publish-pypi.yml` | [Trusted publishing](PYPI_FIRST_TIME.md) (OIDC, no token needed) |
| npm (`@mattmessinger/refund-guard`) | `.github/workflows/publish-npm.yml` | `NPM_TOKEN` repo secret |

**To release:** bump versions in `pyproject.toml` and `packages/refund-guard-ts/package.json`, merge to main, create a GitHub Release with the version tag (e.g. `v0.2.0`).

## Manual publishing (fallback)

**PyPI:**

```bash
python3 -m pip install build twine
python3 -m build
python3 -m twine upload dist/*
```

**npm:**

```bash
cd packages/refund-guard-ts
npm run build
npm publish --access public
```
