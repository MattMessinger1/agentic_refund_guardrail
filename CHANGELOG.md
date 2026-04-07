# Changelog

All notable changes to **refund-guard** are tracked here. Version numbers apply to **both** the Python (PyPI) and TypeScript (npm) packages unless noted.

## [Unreleased]

## [0.2.1] — 2026-04-07

### Changed

- **README rewrite**: sharp hook and quickstart visible within 20 lines; API reference, denial reasons, and troubleshooting pushed below the fold; bottom-half sections (security model, "what this doesn't do", logging) folded into a single FAQ.
- Deleted `docs/STEP_BY_STEP.md` — the README is now the single entry point.
- Moved maintainer docs (`RELEASING`, `GITHUB_SETUP`, `MANUAL_STEPS`, `PYPI_FIRST_TIME`) into `docs/maintainers/`.
- Deleted stale `examples/stripe_example.py` (called real Stripe, used pre-0.2.0 API) and orphaned `examples/refund_policy.yaml`.
- Deleted redundant `contracts/README.md`.
- Updated HN post draft and `examples/real-world-ts/README.md` for 0.2.0 API.
- Slimmed `docs/INTEGRATION_GUIDE.md` (removed "Understand the data you need" table, already in README).

## [0.2.0] — 2026-04-07

### Added

- **`amount_paid_minor_units` / `amountPaidMinorUnits`** — pass cents directly; the library divides by 100. Mutually exclusive with `amount_paid`. Eliminates the most common integration mistake.
- **`refunded_at` / `refundedAt`** — pass your database's refund timestamp. If set, the tool immediately returns `{ status: "denied", reason: "already_refunded" }` without calling your provider. Eliminates manual double-refund checks.
- **`DENIAL_MESSAGES`** — exported constant mapping every denial reason code to a user-facing message. Import instead of writing your own map.
- 4 new parity test cases (17 total): minor units, both-provided error, already-refunded, refunded-at-null.

### Changed

- Integration guide shrinks from 6 steps to 4 by using the new parameters.
- `amount_paid` / `amountPaid` is now optional (provide one of it or `amount_paid_minor_units`).

## [0.1.2] — 2026-04-07

### Added

- **[docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md)** — real-world walkthrough based on dogfooding.
- **[examples/real-world-ts/](examples/real-world-ts/)** — annotated reference pattern.
- **Denial reason glossary** and **API reference** in README.

### Changed

- README tutorial leads with inline policy objects; YAML shown as alternative.
- Replaced Stripe-specific "cents" with provider-agnostic "minor units" across all docs.
- Removed redundant README sections; slimmed STEP_BY_STEP and package README via cross-links.
- Consolidated publishing docs in RELEASING.md.

### Fixed

- Removed deprecated `License :: OSI Approved` classifier (PEP 639).

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

[Unreleased]: https://github.com/MattMessinger1/agentic_refund_guardrail/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/MattMessinger1/agentic_refund_guardrail/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MattMessinger1/agentic_refund_guardrail/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/MattMessinger1/agentic_refund_guardrail/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MattMessinger1/agentic_refund_guardrail/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/MattMessinger1/agentic_refund_guardrail/releases/tag/v0.1.0
