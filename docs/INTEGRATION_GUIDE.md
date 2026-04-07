# Integration guide: wiring refund-guard into a real app

This guide is based on actually dogfooding refund-guard in a production MCP server with Supabase and Stripe. It covers the steps between "I installed the package" and "it works."

If you just want to see the library run, start with the [toy examples](../examples/) first.

---

## Before you start

Grep your codebase for every place that triggers a refund (e.g. `stripe.refunds.create`, `refund`, your edge function name). We found **two** separate code paths in our app and almost missed one. Every path needs the guard -- one unguarded path defeats the purpose.

---

## Step 1 -- Fetch order data from your database

The library does not query your database. You load the order first, then hand the data to refund-guard.

```typescript
const { data: charge } = await supabase
  .from("charges")
  .select("id, stripe_payment_intent, amount_cents, charged_at, refunded_at")
  .eq("id", chargeId)
  .single();
```

The exact query depends on your ORM (Prisma, Drizzle, raw SQL, Supabase, etc.) -- what matters is that these values come from **your database**, not from the AI model.

---

## Step 2 -- Create the guard and wrap your provider

Use `amountPaidMinorUnits` to pass cents directly -- the library divides by 100 internally. Pass `refundedAt` from your database -- the library blocks double-refunds automatically.

```typescript
import { Refunds, DENIAL_MESSAGES } from "@mattmessinger/refund-guard";

const refundGuard = new Refunds({
  skus: {
    success_fee: { refund_window_days: 90 },
  },
});

const refund = refundGuard.makeRefundTool({
  sku: "success_fee",
  transactionId: charge.stripe_payment_intent,
  amountPaidMinorUnits: charge.amount_cents,
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

> **Important:** Always forward the `amount` parameter to your payment API. If your provider function ignores it, the guard's amount validation provides no protection.

---

## Step 3 -- Call and map results

```typescript
const result = await refund();  // full refund -- or refund(50) for partial

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

---

## Common mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Passing minor units to `amountPaid` | Every refund denied as `amount_exceeds_limit` | Use `amountPaidMinorUnits` instead |
| Not passing `refundedAt` from DB | Double refunds possible across requests | Pass `refundedAt: charge.refunded_at` |
| Only guarding one refund path | Unguarded path bypasses all validation | Grep for all refund calls |
| Trusting the AI model for order data | Wrong amounts, fake transaction IDs | Always load from your database |
| Forgetting `await` on the refund call | `result` is a Promise, not the actual result | `const result = await refund()` |
| Provider function ignores `amount` | Guard validates amount but payment API refunds wrong amount | Always forward `amount` to your payment API |
