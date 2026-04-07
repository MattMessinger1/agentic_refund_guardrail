# Changelog

All notable changes to **refund-guard** are tracked here. Version numbers apply to **both** the Python (PyPI) and TypeScript (npm) packages unless noted.

## [Unreleased]

## [0.1.2] — 2026-04-07

### Added

- **[docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md)** — real-world walkthrough based on dogfooding in a production MCP server.
- **[examples/real-world-ts/](examples/real-world-ts/)** — annotated reference pattern showing DB fetch, unit conversion, result mapping.
- **Denial reason glossary** in README — maps every `reason` code to a suggested user-facing message.
- **"What this library does NOT do"** section in README.
- **API reference** table in README.

### Changed

- README tutorial now leads with inline policy objects; YAML shown as alternative.
- Replaced Stripe-specific "cents" language with provider-agnostic "minor units" across all docs.
- Removed redundant "How this differs" and "Works with any provider" sections from README (content already in FAQ table).
- Slimmed STEP_BY_STEP.md — replaced duplicated content with links to canonical sources.
- Slimmed npm package README to essentials + links to GitHub.
- Consolidated MANUAL_STEPS.md into a link index; merged publishing details into RELEASING.md.
- RELEASING.md now documents automated publishing workflows for both PyPI and npm.

## [0.1.1] — 2026-04-06

### Fixed

- npm package now includes README.md (`files` array in `package.json`).
- Synced Python and TypeScript versions to `0.1.1`.
- Added `publish-npm.yml` GitHub Actions workflow for automated npm publishing.
- Added `contents: read` permission to `publish-pypi.yml`.

## [0.1.0] — 2026-04-06

### Added

- Python package **`refund-guard`**: policy YAML, `Refunds` / `make_refund_tool`, validation before your refund function.
- TypeScript package **`@mattmessinger/refund-guard`** (in `packages/refund-guard-ts`): same behavior, async-friendly `providerRefundFn`.
- Shared behavioral contract: [`contracts/parity/cases.json`](contracts/parity/cases.json) exercised by Python and Vitest in CI.
- Optional **`now_fn` / `nowFn`** for deterministic tests.
- Runnable examples: `examples/minimal-python` and `examples/minimal-ts` (fake provider, no payment keys).
- Documentation: README, STEP_BY_STEP, CONTRIBUTING, SECURITY.
- GitHub Actions CI for pytest + npm test/build.

[Unreleased]: https://github.com/MattMessinger1/agentic_refund_guardrail/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/MattMessinger1/agentic_refund_guardrail/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MattMessinger1/agentic_refund_guardrail/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/MattMessinger1/agentic_refund_guardrail/releases/tag/v0.1.0
