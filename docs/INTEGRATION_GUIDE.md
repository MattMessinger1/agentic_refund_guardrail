# Integration guide: wiring refund-guard into a real app

This guide is based on actually dogfooding refund-guard in a production MCP server with Supabase and Stripe. It covers the steps between "I installed the package" and "it works."

If you just want to see the library run, start with the [toy examples](../examples/) first.

---

## Before you start

### Audit all refund paths

Grep your codebase for every place that triggers a refund (e.g. `stripe.refunds.create`, `refund`, your edge function name). We found **two** separate code paths in our app and almost missed one. Every path needs the guard — one unguarded path defeats the purpose.

### Understand the data you need

For each refund call, your database must provide:

| Field | Example | Why |
|-------|---------|-----|
| SKU / product type | `"success_fee"` | Selects the right policy (refund window) |
| Transaction ID | `"pi_abc123"` | Passed to your provider; included in results |
| Amount paid | `20.00` (major units, not minor units) | Sets the maximum refundable amount |
| Purchase date | `2026-03-15T12:00:00Z` | Determines if the refund window is still open |
| Refunded flag | `refunded_at` column | **You** check this — see below |

---

## Step 1 — Fetch order data from your database

The library does not query your database. You load the order first, then hand the data to refund-guard.

```typescript
const { data: charge } = await supabase
  .from("charges")
  .select("id, stripe_payment_intent, amount_cents, charged_at, refunded_at")
  .eq("id", chargeId)
  .single();
```

The exact query depends on your ORM (Prisma, Drizzle, raw SQL, Supabase, etc.) — what matters is that these values come from **your database**, not from the AI model.

---

## Step 2 — Check `refunded_at` yourself

The library tracks partial refunds **within a single `makeRefundTool` instance** (one request lifecycle). It does **not** know about refunds from previous requests. Your database is the source of truth for double-refund prevention:

```typescript
if (charge.refunded_at) {
  return { error: "Already refunded" };
}
```

Why can't the library do this? Because it's stateless across HTTP requests — `totalRefunded` resets to 0 every time you call `makeRefundTool`. That's by design (no database dependency), but it means **you** own the cross-request guard.

---

## Step 3 — Convert units

Most payment APIs store amounts in **minor units** (cents, pence, etc.). refund-guard works in **major units** (dollars, euros, pounds).

```typescript
const amountDollars = charge.amount_cents / 100;
```

If you skip this, a $20.00 charge becomes `amountPaid: 2000` and every real refund will be denied as `amount_exceeds_limit`.

---

## Step 4 — Create the guard and wrap your provider

Your `providerRefundFn` does **not** have to call Stripe directly. In our case, it called a Supabase Edge Function that internally calls Stripe. The only requirement is the signature: `(amount, transactionId, currency) => result`.

```typescript
import { Refunds } from "@mattmessinger/refund-guard";

const refundGuard = new Refunds({
  skus: {
    success_fee: { refund_window_days: 90 },
  },
});

const refund = refundGuard.makeRefundTool({
  sku: "success_fee",
  transactionId: charge.stripe_payment_intent,
  amountPaid: amountDollars,
  purchasedAt: new Date(charge.charged_at),
  provider: "stripe",
  providerRefundFn: async (_amount, _txnId, _currency) => {
    const { data, error } = await supabase.functions.invoke(
      "stripe-refund-success-fee",
      { body: { charge_id: chargeId, reason: "booking_cancelled" } },
    );
    if (error || !data?.success) throw new Error(data?.error ?? "Refund failed");
    return data;
  },
});
```

Note: we ignore the `_amount`, `_txnId`, `_currency` params in our wrapper because our edge function already knows the charge details from the `charge_id`. That's fine — the library still validates the amount before calling your function.

---

## Step 5 — Call and map results

```typescript
const result = await refund(amountDollars);

if (result.status === "denied") {
  const messages: Record<string, string> = {
    refund_window_expired: "The refund window has expired.",
    amount_exceeds_limit: "Refund exceeds the original charge.",
    amount_exceeds_remaining: "Already partially refunded.",
    invalid_amount: "Invalid refund amount.",
  };
  return {
    success: false,
    message: messages[result.reason as string] ?? "Refund not allowed.",
  };
}

if (result.status === "error") {
  return { success: false, message: "Refund failed. Contact support." };
}

// status === "approved"
const providerData = result.provider_result as Record<string, unknown>;
return {
  success: true,
  refund_id: providerData?.refund_id,
  amount: result.refunded_amount,
};
```

See the [denial reason glossary](../README.md#denial-reasons) for all codes.

---

## Step 6 — Update your AI agent's system prompt

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
| Passing minor units instead of major units | Every refund denied as `amount_exceeds_limit` | `amount_cents / 100` |
| Not checking `refunded_at` from DB | Double refunds possible across requests | Check before calling `makeRefundTool` |
| Only guarding one refund path | Unguarded path bypasses all validation | Grep for all refund calls |
| Trusting the AI model for order data | Wrong amounts, fake transaction IDs | Always load from your database |
| Forgetting `await` on the refund call | `result` is a Promise, not the actual result | `const result = await refund(amount)` |
