# @mattmessinger/refund-guard

TypeScript implementation of [refund-guard](https://github.com/MattMessinger1/agentic_refund_guardrail) -- safe refund policy enforcement for AI agents.

## Install

```bash
npm install @mattmessinger/refund-guard
```

## Quick example

```typescript
import { Refunds, DENIAL_MESSAGES } from "@mattmessinger/refund-guard";

const refunds = new Refunds({ skus: { shampoo: { refund_window_days: 30 } } });

const refund = refunds.makeRefundTool({
  sku: order.sku,
  transactionId: order.transactionId,
  amountPaidMinorUnits: order.amountCents,  // library divides by 100
  purchasedAt: order.purchasedAt,
  refundedAt: order.refundedAt,             // null or Date
  providerRefundFn: (amount, transactionId, currency) =>
    yourPaymentProvider.refund({ amount, transactionId, currency }),
});

const result = await refund();       // full refund -- or refund(50) for partial
// { status: "approved", refunded_amount: 80, ... }
// { status: "denied", reason: "already_refunded", ... }
const message = DENIAL_MESSAGES[result.reason as string];
```

The returned callable is **async**. Call with no argument for a full refund, or pass an amount for a partial refund. `providerRefundFn` can return a Promise or a plain value.

## Full docs

[GitHub repo](https://github.com/MattMessinger1/agentic_refund_guardrail) · [Integration guide](https://github.com/MattMessinger1/agentic_refund_guardrail/blob/main/docs/INTEGRATION_GUIDE.md) · [PyPI (Python)](https://pypi.org/project/refund-guard/)

## License

MIT
