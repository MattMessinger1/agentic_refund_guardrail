# @mattmessinger/refund-guard

Server-side refund policy checks between an untrusted AI tool call and your refund provider.

The agent may supply only `amount` and `reason`. Your server supplies order truth from the database, and `refund-guard` checks policy before Stripe/PayPal/Shopify/custom refund code runs.

## What this does for you

- Turns one real database order into a scoped refund tool.
- Keeps transaction IDs, paid amounts, already-refunded amounts, SKUs, dates, and refund status out of model control.
- Blocks bad refund attempts before your provider function runs.

## Who this is for

- Developers building AI support agents, chatbots, MCP servers, or tool-calling LLM apps that can issue refunds.
- Vercel AI SDK, OpenAI, LangChain, or MCP builders who need the safe backend shape.
- Apps with refund windows, partial refunds, final-sale products, allowed reasons, or manual-review thresholds.

## Who this is NOT for

- Manual refund dashboards where a human approves every refund.
- Read-only agents that never trigger refunds.
- Backends that already enforce equivalent refund policy before provider calls.
- Client-side refund flows. Keep refund providers and secrets on the server.

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
