# @mattmessinger/refund-guard

TypeScript implementation of [refund-guard](https://github.com/MattMessinger1/agentic_refund_guardrail) — safe refund policy enforcement for AI agents.

Also available as a Python package: `pip install refund-guard`

## Install

```bash
npm install @mattmessinger/refund-guard
```

## Quick example

```typescript
import { Refunds } from "@mattmessinger/refund-guard";

const refunds = new Refunds("refund_policy.yaml");

const refund = refunds.makeRefundTool({
  sku: order.sku,
  transactionId: order.transactionId,
  amountPaid: order.amountPaid,
  purchasedAt: order.purchasedAt,
  providerRefundFn: (amount, transactionId, currency) =>
    stripe.refunds.create({
      payment_intent: transactionId,
      amount: Math.round(amount * 100),
      currency,
    }),
});

const result = await refund(80.0);
// { status: "approved", refunded_amount: 80, transaction_id: "pi_abc123", ... }
// or: { status: "denied", reason: "refund_window_expired", ... }
```

## What it checks

1. **Refund window** — still within `refund_window_days` for that SKU
2. **Positive amount** — must be > 0
3. **Amount cap** — cannot exceed what was paid
4. **Remaining balance** — cannot exceed what's left after partial refunds

If any check fails, your provider function is never called.

## Policy file

```yaml
skus:
  digital_course:
    refund_window_days: 7
  shampoo:
    refund_window_days: 30
```

Or pass a plain object instead of a file path.

## Async

The returned callable is **async** — `providerRefundFn` can return a Promise (e.g. Stripe's Node client) or a plain value.

## Full docs

[GitHub repo](https://github.com/MattMessinger1/agentic_refund_guardrail) · [Step-by-step guide](https://github.com/MattMessinger1/agentic_refund_guardrail/blob/main/docs/STEP_BY_STEP.md) · [PyPI (Python)](https://pypi.org/project/refund-guard/)

## License

MIT
