# Contracts

## Parity fixtures (`parity/cases.json`)

The **same** JSON file is executed by:

- Python: `tests/test_parity.py`
- TypeScript: `packages/refund-guard-ts/test/parity.test.ts`

Behavior changes must update this file and keep both test suites green. That is how `refund-guard` stays **one product** across PyPI and npm (see [RELEASING.md](../RELEASING.md)).
