# Changelog

All notable changes to **refund-guard** are tracked here. Version numbers apply to **both** the Python (PyPI) and TypeScript (npm) packages unless noted.

## [Unreleased]

### Added

- Runnable **`examples/minimal-python`** and **`examples/minimal-ts`** (fake provider, no payment keys).
- **[SECURITY.md](SECURITY.md)** and **[docs/MANUAL_STEPS.md](docs/MANUAL_STEPS.md)** (PyPI/npm publish and other manual tasks).
- README badges; CI runs minimal examples after unit tests.

## [0.1.0] — 2026-04-06

### Added

- Python package **`refund-guard`** (source): policy YAML, `Refunds` / `make_refund_tool`, validation before your refund function. *Publish to PyPI when ready — see [docs/MANUAL_STEPS.md](docs/MANUAL_STEPS.md).*
- TypeScript package **`@mattmessinger/refund-guard`** (source in `packages/refund-guard-ts`): same behavior, async-friendly `providerRefundFn`. *Publish to npm when ready — see [docs/MANUAL_STEPS.md](docs/MANUAL_STEPS.md).*
- Shared behavioral contract: [`contracts/parity/cases.json`](contracts/parity/cases.json) exercised by Python and Vitest in CI.
- Optional **`now_fn` / `nowFn`** for deterministic tests.
- Documentation: [README](README.md), [STEP_BY_STEP](docs/STEP_BY_STEP.md), [CONTRIBUTING](CONTRIBUTING.md).
- GitHub Actions CI for pytest + npm test/build.

[0.1.0]: https://github.com/MattMessinger1/agentic_refund_guardrail/releases/tag/v0.1.0
