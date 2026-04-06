# Releasing refund-guard (Python + TypeScript)

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

## PyPI

```bash
python3 -m pip install build twine
python3 -m build
python3 -m twine upload dist/*
```

## npm

```bash
cd packages/refund-guard-ts
npm publish --access public
```

(Use your npm org/login as appropriate.)
