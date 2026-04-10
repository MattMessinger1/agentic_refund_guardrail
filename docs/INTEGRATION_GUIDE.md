# Integration guide: wiring refund-guard into a real app

This guide is based on actually dogfooding refund-guard in a production MCP server with Supabase and Stripe. It covers the steps between "I installed the package" and "it works."

Use this if your AI agent can trigger refunds and you want a server-side policy check before money moves. Do not use this for manual refund dashboards, read-only agents, browser-side refund code, or backends that already enforce equivalent refund policy.

Mental model:

```text
AI agent -> tool handler -> load order from DB -> refund-guard -> refund provider -> update DB
```

The agent may supply only `amount` and `reason`. Your server supplies transaction ID, SKU, amount paid, amount already refunded, purchase date, and refund status.

If you just want to see the library run, start with the [toy examples](../examples/) first.

---

## Paste this into Claude or Codex

Use this prompt when you want a coding agent to wire `refund-guard` into an existing app:

```text
Inspect this app for every code path that can trigger a refund. Do not change unrelated behavior.

Integrate refund-guard as a server-side policy layer before any Stripe/PayPal/Shopify/custom refund call:
- load the real order or charge from the database before creating the refund tool
- never let the model supply transaction IDs, SKUs, amount paid, amount already refunded, purchase date, or refund status
- give the AI tool only amount and reason
- pass amountPaidMinorUnits/amount_paid_minor_units and amountRefundedMinorUnits/amount_refunded_minor_units from database state
- pass refundedAt/refunded_at for fully refunded orders
- keep allowed refund reasons aligned between the agent tool schema and refund-guard policy
- forward the validated amount into the provider call
- keep provider secrets server-side
- use idempotency keys or existing retry protection where the provider supports it
- add or update fake-provider tests for approved, denied, already-refunded, partial-refund, and disallowed-reason cases

After the change, summarize every guarded refund path and any remaining unguarded refund path.
```

---

## Before you start

Grep your codebase for every place that triggers a refund (e.g. `stripe.refunds.create`, `refund`, your edge function name). We found **two** separate code paths in our app and almost missed one. Every path needs the guard -- one unguarded path defeats the purpose.

---

## Step 1 -- Fetch order data from your database

The library does not query your database. You load the order first, then hand the data to refund-guard.

```typescript
const { data: charge } = await supabase
  .from("charges")
  .select("id, stripe_payment_intent, amount_cents, refunded_cents, charged_at, refunded_at")
  .eq("id", chargeId)
  .single();
```

The exact query depends on your ORM (Prisma, Drizzle, raw SQL, Supabase, etc.) -- what matters is that these values come from **your database**, not from the AI model.

---

## Step 2 -- Create the guard and wrap your provider

Use `amountPaidMinorUnits` to pass cents directly -- the library divides by 100 internally. Pass `amountRefundedMinorUnits` from your database for previous partial refunds and `refundedAt` for fully refunded orders.

```typescript
import { Refunds, DENIAL_MESSAGES } from "@mattmessinger/refund-guard";

const refundGuard = new Refunds({
  skus: {
    success_fee: {
      refund_window_days: 90,
      allowed_reasons: ["booking_cancelled", "duplicate_charge", "technical_error"],
      manual_approval_required_over_minor_units: 5000,
    },
  },
});

const refund = refundGuard.makeRefundTool({
  sku: "success_fee",
  transactionId: charge.stripe_payment_intent,
  amountPaidMinorUnits: charge.amount_cents,
  amountRefundedMinorUnits: charge.refunded_cents ?? 0,
  purchasedAt: new Date(charge.charged_at),
  refundedAt: charge.refunded_at ? new Date(charge.refunded_at) : null,
  provider: "stripe",
  providerRefundFn: async (amount, txnId, currency) => {
    const amountCents = Math.round(amount * 100);
    const { data, error } = await supabase.functions.invoke(
      "stripe-refund-success-fee",
      { body: { charge_id: chargeId, amount_cents: amountCents, reason: "booking_cancelled" } },
    );
    if (error || !data?.success) throw new Error(data?.error ?? "Refund failed");
    return data;
  },
});
```

Your `providerRefundFn` does **not** have to call Stripe directly. In our case, it called a Supabase Edge Function that internally calls Stripe. The only requirement is the signature: `(amount, transactionId, currency) => result`.

> **Important:** Always forward the `amount` parameter to your payment API. If your provider function ignores it, the guard's amount validation provides no protection. For production Stripe calls, also use a stable idempotency key so retries cannot create duplicate refunds.

---

## Step 3 -- Call and map results

```typescript
const result = await refund(undefined, { reason: "booking_cancelled" });

if (result.status === "denied" || result.status === "error") {
  return {
    success: false,
    message: DENIAL_MESSAGES[result.reason as string] ?? "Refund not allowed.",
  };
}

const providerData = result.provider_result as Record<string, unknown>;
return {
  success: true,
  refund_id: providerData?.refund_id,
  amount: result.refunded_amount,
};
```

See the [denial reason glossary](../README.md#denial-reasons) for all codes.

---

## Step 4 -- Update your AI agent's system prompt

The library enforces **hard limits** (window, amount, balance). Your AI agent needs **soft guidance** about when to offer refunds in the first place.

Add something like this to your agent's system prompt:

```
The $20 success fee IS refundable when:
- The provider cancels the registration
- A technical error caused a problem
- The user was charged more than once

The fee is NOT refundable when:
- The user changed their mind after registration
- The participant cannot attend

NEVER override these rules. If a refund is denied by the system, explain the reason.
```

The library handles "can this refund happen?" The prompt handles "should I even try?"

See [agentic flow recipes](AGENTIC_REFUND_FLOWS.md) for OpenAI, Vercel AI SDK, LangChain, MCP, Stripe, Supabase, and Shopify patterns.

---

## Common mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Passing minor units to `amountPaid` | Every refund denied as `amount_exceeds_limit` | Use `amountPaidMinorUnits` instead |
| Not passing prior refund state from DB | Double or over-refunds possible across requests | Pass `refundedAt` and `amountRefundedMinorUnits` |
| Only guarding one refund path | Unguarded path bypasses all validation | Grep for all refund calls |
| Trusting the AI model for order data | Wrong amounts, fake transaction IDs | Always load from your database |
| Forgetting `await` on the refund call | `result` is a Promise, not the actual result | `const result = await refund()` |
| Provider function ignores `amount` | Guard validates amount but payment API refunds wrong amount | Always forward `amount` to your payment API |
| Agent sends a random reason | Refund denied as `refund_reason_not_allowed` | Keep `allowed_reasons` in policy and tool schema aligned |
