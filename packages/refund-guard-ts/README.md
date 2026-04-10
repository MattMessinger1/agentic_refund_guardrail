# @mattmessinger/refund-guard

Server-side refund policy checks between trusted order data and your refund provider.

An AI refund agent needs a safety map, not just a refund function. `refund-guard` owns only the agent input boundary, refund-policy gate, and no-provider-call-on-denial gate. Your app, provider, database, and process own the rest.

**Design rule:** 100% is Pass. 99% is Fail. `refund-guard` only claims security boxes it can enforce completely.

## Why use this

- The model cannot control trusted refund fields.
- Policy checks run before your provider function.
- Common agent footguns are handled: partial-refund state, bad amounts, reason drift, and overlapping retries.
- The GitHub repo includes the MECE security map for the boxes this package does not cover.

## Good fit

- You are prototyping or shipping an AI support agent that can trigger refunds.
- Your refund rules live in prompts, scattered backend code, or provider calls.
- Your server can load trusted order data through user, ticket, tenant, admin, or backend scope.
- Your app has refund windows, partial refunds, final-sale SKUs, allowed reasons, or manual-review thresholds.

## Not a fit

- Humans approve every refund before money moves.
- Your agent is read-only.
- Refund code runs client-side.
- Your app cannot verify order scope before refunding.
- Your backend already has equivalent tested refund-policy enforcement.
- You need auth, order ownership, provider idempotency, database locking, fraud, compliance, chargeback, or risk infrastructure handled by this package.

For the full MECE security map and integration prompt, see the [GitHub README](https://github.com/MattMessinger1/agentic_refund_guardrail) and [Integration Guide](https://github.com/MattMessinger1/agentic_refund_guardrail/blob/main/docs/INTEGRATION_GUIDE.md#the-mece-agentic-refund-security-map).

## Install

```bash
npm install @mattmessinger/refund-guard
```

## Quick example

Assume `order` was already loaded through your app's user, ticket, tenant, admin, or backend scope.

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
if (result.status !== "approved") {
  const message = DENIAL_MESSAGES[result.reason] ?? "Refund could not be processed.";
  return { success: false, message };
}
return { success: true, amount: result.refunded_amount };
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
