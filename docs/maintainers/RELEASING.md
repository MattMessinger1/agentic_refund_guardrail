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

Normal pushes to `main` run CI only. They do **not** publish packages.

To prepare a release:

1. Open **Actions -> Prepare Release**.
2. Enter the target version, for example `0.5.0`.
3. The workflow validates that `v0.5.0`, `@mattmessinger/refund-guard@0.5.0`, and `refund-guard==0.5.0` do not already exist.
4. The workflow opens a release PR titled `[release] v0.5.0` that bumps:
   - `pyproject.toml`
   - `packages/refund-guard-ts/package.json`
   - `packages/refund-guard-ts/package-lock.json`
5. The workflow dispatches CI and release validation against the release branch.
6. Merge the release PR after CI and release validation pass.

When a `[release] vX.Y.Z` PR merges, `.github/workflows/finalize-release.yml` creates GitHub Release `vX.Y.Z` and dispatches the npm and PyPI publish workflows against that tag.

The publish workflows can also be run manually with `workflow_dispatch`, but only against an existing release tag such as `v0.5.0`.

Both publish workflows also trigger on **GitHub Release published** for releases created outside the finalizer:

| Package | Workflow | Setup |
|---------|----------|-------|
| PyPI (`refund-guard`) | `.github/workflows/publish-pypi.yml` | [Trusted publishing](PYPI_FIRST_TIME.md) (OIDC, no token needed) |
| npm (`@mattmessinger/refund-guard`) | `.github/workflows/publish-npm.yml` | `NPM_TOKEN` repo secret |

Before publishing, both workflows verify that checked-out package versions match the tag and that the target package version is not already published.

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
