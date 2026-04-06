# Contributing

Thanks for helping improve **refund-guard**. This project keeps **Python** and **TypeScript** behavior aligned — not “similar,” **the same** — using shared tests.

## Quick setup

```bash
git clone https://github.com/MattMessinger1/agentic_refund_guardrail.git
cd agentic_refund_guardrail
```

### Python

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
pytest
```

### TypeScript

```bash
cd packages/refund-guard-ts
npm ci
npm test
npm run build
```

Run both before opening a PR that touches refund logic.

## Changing behavior

If you change **when** a refund is allowed/denied, or **what** is returned:

1. Update **[contracts/parity/cases.json](contracts/parity/cases.json)** with new scenarios (or adjust existing ones).
2. Make **Python** and **TypeScript** pass the same fixtures.
3. Mention the change in your PR description so maintainers can bump **one** semver on both PyPI and npm when releasing.

## Pull requests

- Keep changes focused (one concern per PR when possible).
- If you only fix docs or comments, say so in the title (e.g. `docs: …`).

## Questions

Open a [Question issue](https://github.com/MattMessinger1/agentic_refund_guardrail/issues/new/choose) or start a Discussion if enabled.
