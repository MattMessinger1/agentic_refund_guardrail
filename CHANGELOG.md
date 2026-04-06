# Changelog

All notable changes to **refund-guard** are tracked here. Version numbers apply to **both** the Python (PyPI) and TypeScript (npm) packages unless noted.

## [0.1.0] — 2026-04-06

### Added

- Python package **`refund-guard`** on PyPI: policy YAML, `Refunds` / `make_refund_tool`, validation before your refund function.
- TypeScript package **`@mattmessinger/refund-guard`** on npm (source in `packages/refund-guard-ts`): same behavior, async-friendly `providerRefundFn`.
- Shared behavioral contract: [`contracts/parity/cases.json`](contracts/parity/cases.json) exercised by Python and Vitest in CI.
- Optional **`now_fn` / `nowFn`** for deterministic tests.
- Documentation: [README](README.md), [STEP_BY_STEP](docs/STEP_BY_STEP.md), [CONTRIBUTING](CONTRIBUTING.md).
- GitHub Actions CI for pytest + npm test/build.

[0.1.0]: https://github.com/MattMessinger1/agentic_refund_guardrail/releases/tag/v0.1.0
