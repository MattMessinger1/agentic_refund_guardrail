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
  amountRefundedMinorUnits: order.refundedCents,
  purchasedAt: order.purchasedAt,
  refundedAt: order.refundedAt,             // null or Date
  providerRefundFn: (amount, transactionId, currency) =>
    yourPaymentProvider.refund({ amount, transactionId, currency }),
});

const result = await refund(undefined, { reason: "provider_cancelled" });
// { status: "approved", refunded_amount: 80, ... }
// { status: "denied", reason: "already_refunded", ... }
const message = DENIAL_MESSAGES[result.reason as string] ?? "Refund could not be processed.";
```

The returned callable is **async**. Call with no amount for a full remaining refund, or pass an amount for a partial refund: `await refund(50, { reason: "duplicate_charge" })`. `providerRefundFn` can return a Promise or a plain value.

For previous partial refunds, pass `amountRefundedMinorUnits` from your database every time you create the tool. The in-memory tool also serializes concurrent calls so overlapping retries validate against the updated remaining balance.

The package exports `RefundResult`, `ApprovedRefundResult`, `DeniedRefundResult`, `ErrorRefundResult`, and `DenialReason` for typed result handling.

## Policy doctor

```bash
npx @mattmessinger/refund-guard doctor policy.yaml scenarios.json
```

The doctor runs fake provider calls and prints the same approved/denied results your app would receive.

## Full docs

[GitHub repo](https://github.com/MattMessinger1/agentic_refund_guardrail) · [Integration guide](https://github.com/MattMessinger1/agentic_refund_guardrail/blob/main/docs/INTEGRATION_GUIDE.md) · [PyPI (Python)](https://pypi.org/project/refund-guard/)

## License

MIT
