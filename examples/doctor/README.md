# Policy doctor example

Run policy scenarios without Stripe, PayPal, Shopify, or secrets.

- **What it demonstrates:** testing refund policy with fake provider calls before real money can move.
- **Copy this if:** you want to try refund windows, allowed reasons, final-sale SKUs, partial-refund state, or manual-review thresholds from JSON scenarios.
- **What it does not handle:** real provider calls, database locks, or production refund records.

## Python

From the repository root:

```bash
pip install -e ".[dev]"
refund-guard doctor examples/doctor/policy.yaml examples/doctor/scenarios.json
```

## TypeScript

From the repository root:

```bash
cd packages/refund-guard-ts
npm ci
npm run build
node dist/cli.js doctor ../../examples/doctor/policy.yaml ../../examples/doctor/scenarios.json
```

The output is JSON. Approved scenarios include a fake provider result. Denied scenarios show the same denial reason your app would receive at runtime.
