# @mattmessinger/refund-guard

TypeScript implementation of [refund-guard](https://github.com/MattMessinger1/agentic_refund_guardrail) — safe refund policy enforcement for AI agents.

## Install

```bash
npm install @mattmessinger/refund-guard
```

## Quick example

```typescript
import { Refunds } from "@mattmessinger/refund-guard";

const refunds = new Refunds({ skus: { shampoo: { refund_window_days: 30 } } });

const refund = refunds.makeRefundTool({
  sku: order.sku,
  transactionId: order.transactionId,
  amountPaid: order.amountPaid,       // major units (dollars), not minor units (cents)
  purchasedAt: order.purchasedAt,
  providerRefundFn: (amount, transactionId, currency) =>
    yourPaymentProvider.refund({ amount, transactionId, currency }),
});

const result = await refund(80.0);
// { status: "approved", refunded_amount: 80, ... }
// or: { status: "denied", reason: "refund_window_expired", ... }
```

The returned callable is **async**. `providerRefundFn` can return a Promise or a plain value.

## Full docs

[GitHub repo](https://github.com/MattMessinger1/agentic_refund_guardrail) · [Step-by-step guide](https://github.com/MattMessinger1/agentic_refund_guardrail/blob/main/docs/STEP_BY_STEP.md) · [Integration guide](https://github.com/MattMessinger1/agentic_refund_guardrail/blob/main/docs/INTEGRATION_GUIDE.md) · [PyPI (Python)](https://pypi.org/project/refund-guard/)

## License

MIT
