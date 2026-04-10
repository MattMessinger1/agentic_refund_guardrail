# Policy doctor example

Run policy scenarios without Stripe, PayPal, Shopify, or secrets.

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
