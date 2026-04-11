# Integration guide: wiring refund-guard into a real app

This guide is based on actually dogfooding refund-guard in a production MCP server with Supabase and Stripe. It covers the steps between "I installed the package" and "it works."

Use this if your AI agent can trigger refunds, your app can load trusted order data, and you want a deterministic policy gate before money moves. Do not use this for manual refund dashboards, read-only agents, browser-side refund code, apps that cannot verify order scope, or backends that already enforce equivalent refund policy.

An AI refund agent needs a safety map, not just a refund function. `refund-guard` fully handles one critical security responsibility in that map: the refund-policy gate after trusted order data is loaded. The remaining responsibilities must be owned by your app, provider, database, or process before agents can move money.

**Design rule:** 100% is Pass. 99% is Fail. `refund-guard` only claims the security responsibilities it can enforce completely.

Mental model:

```text
AI agent -> tool handler -> resolve trusted order -> refund-guard -> refund provider -> update DB
```

`refund-guard` starts after trusted order data is loaded. Your server supplies transaction ID, SKU, amount paid, amount already refunded, purchase date, and refund status. If an agent supplies orderId, treat it as a lookup hint, not trusted refund data.

If you just want to see the library run, start with the [toy examples](../examples/) first.

---

## The MECE agentic refund security map

MECE here means every security category has one clear owner. If a category is at 99%, it is not ready for real money.

| Category | Owner | Pass standard | Covered by refund-guard? | How vibe builders solve the rest |
|----------|-------|---------------|---------------------------|----------------------------------|
| Tool access control | App/framework | Only authenticated, authorized actors can call refund tools | No | Add framework auth/session checks before tool execution |
| Order scope and ownership | App | The order belongs to the current user, ticket, tenant, merchant, or admin context | No | Query by `orderId` plus scope; never by `orderId` alone |
| Authoritative refund facts | App/database/provider | Amount paid, already refunded, SKU, purchase date, and refund status are current and trusted | No | Read fresh facts from your DB/provider at refund time |
| Agent input boundary | `refund-guard` | Agent cannot supply transaction ID, SKU, paid amount, refunded amount, purchase date, or refund status | Yes, 100% | Create a scoped refund tool before exposing it to the agent |
| Refund-policy enforcement | `refund-guard` | Invalid amounts, over-refunds, expired windows, final-sale SKUs, disallowed reasons, and manual-review thresholds deny before money moves | Yes, 100% | Pass trusted order facts and SKU policy into `refund-guard` |
| Provider invocation gate | `refund-guard` + app | Provider function is not called on denial; provider implementation uses the validated amount | Yes for denial gate; no for provider implementation | Keep provider code server-side and forward the validated amount |
| Provider execution safety | App/provider | Provider secrets, retries, errors, and idempotency are handled correctly | No | Use provider idempotency keys and handle provider errors explicitly |
| State consistency and persistence | App/database | Refund attempts/results are recorded and cross-service double refunds are prevented | No | Persist attempts/results; use one refund service, DB transactions, locks, or provider idempotency |
| Evidence, exceptions, and human review | App/process | Refund reasons are true, exceptions are reviewed, and high-risk cases do not auto-refund | No | Keep reason enums narrow; require evidence checks or approval queues |
| Auditability and accountability | App/process | Every request, actor, decision, denial, provider result, and review is traceable | No | Log actor IDs, order IDs, requested/approved amounts, reasons, denial codes, provider IDs, and timestamps |
| Fraud, abuse, and compliance risk | App/process | Fraud, chargeback, sanctions/KYC/AML, tax/accounting, marketplace, and regulated-product risks are handled outside the policy gate | No | Use dedicated risk, compliance, chargeback, accounting, and marketplace controls |

---

## Copy/paste prompts for Claude or Codex

Use these prompts when you want a coding agent to wire `refund-guard` into an existing app and then help you close the rest of the MECE security map. They are written to be pasted directly.

### Prompt 1: Install the refund-policy gate

```text
Inspect this app for every code path that can trigger a refund. Do not change unrelated behavior.

Before editing:
- grep for every refund path, including provider SDK calls, custom refund functions, payment/refund edge functions, background jobs, admin actions, and support actions
- inspect every order, charge, payment, or subscription lookup path involved in those refunds
- identify the auth/session/ticket/tenant/admin scope that proves the actor may refund that order
- identify the trusted order fields needed for refund-guard: transaction or payment intent ID, amount paid, amount already refunded, purchase or charge date, refund status or refunded_at, SKU/product, and customer/user/tenant/merchant scope
- if scoped order lookup cannot be proven, stop before wiring any real provider call; report the blocker and keep provider calls fake or test-only

Focus refund-guard on the categories it can cover 100%: agent input boundary, refund-policy enforcement, and the provider denial gate.

Integrate refund-guard as a server-side policy gate after trusted order data is loaded and before any Stripe/PayPal/Shopify/custom refund call:
- if a tool accepts orderId, treat it as a lookup hint and resolve it through user/session/ticket/tenant/admin scope before creating the refund tool
- load the real order or charge from the database before creating the refund tool
- never let the model supply transaction IDs, SKUs, amount paid, amount already refunded, purchase date, or refund status
- use server-scoped tool schemas with only amount and reason when possible
- pass amountPaidMinorUnits/amount_paid_minor_units and amountRefundedMinorUnits/amount_refunded_minor_units from database state
- pass refundedAt/refunded_at for fully refunded orders
- keep allowed refund reasons aligned between the agent tool schema and refund-guard policy
- forward the validated amount into the provider call
- keep provider secrets server-side
- use idempotency keys or existing retry protection where the provider supports it
- update persisted refunded amount only after provider success
- add or update fake-provider tests for approved, denied, already-refunded, partial-refund, and disallowed-reason cases

After the change, summarize every guarded refund path, unguarded refund path, scoped order lookup, remaining unscoped order lookup, tests added, and blockers before real money can move.
```

### Prompt 2: Complete the security map

```text
Run this after Prompt 1 or independently before launch.

Review this app's agentic refund flow against the MECE security map in refund-guard's Integration Guide. Do not treat refund-guard as a complete payments-risk system.

Classify each category as one of:
- covered 100% by refund-guard
- handled 100% by app/provider/process
- missing

Do not mark anything under 100% as passing for money movement.

Evaluate all 11 categories:
1. Tool access control
2. Order scope and ownership
3. Authoritative refund facts
4. Agent input boundary
5. Refund-policy enforcement
6. Provider invocation gate
7. Provider execution safety
8. State consistency and persistence
9. Evidence, exceptions, and human review
10. Auditability and accountability
11. Fraud, abuse, and compliance risk

For every missing non-package category, produce a concrete implementation direction:
- tool access control: auth/session/role checks before tool execution
- order scope and ownership: scoped DB/provider queries, never orderId alone
- authoritative refund facts: fresh reads from DB/provider at refund time
- provider execution safety: server-side secrets, validated amount forwarding, idempotency keys, retry/error behavior
- state consistency and persistence: refund attempts/results, transactions/locks/single refund service
- evidence, exceptions, and human review: evidence checks, narrow reason enums, approval queues
- auditability and accountability: actor/order/amount/reason/decision/provider/timestamp logs
- fraud, abuse, and compliance risk: dedicated risk, compliance, chargeback, accounting, marketplace, and regulated-product controls

At the end, list:
- categories implemented in this change
- categories already handled by app/provider/process
- categories only identified but not implemented
- blockers before real-money refunds can move
```

---

## Manual walkthrough: what Prompt 1 is doing

The prompt starts by finding every refund entry point and proving scoped order lookup before any provider call is wired. The walkthrough below is the same safe path if you are doing it by hand.

### Find every refund path

Grep your codebase for every place that triggers a refund (e.g. `stripe.refunds.create`, `refund`, your edge function name). We found **two** separate code paths in our app and almost missed one. Every path needs the guard -- one unguarded path defeats the purpose.

### Resolve trusted order data from your database

The library does not query your database. You resolve the order through your app's auth/session/ticket/tenant scope first, then hand the trusted data to refund-guard.

```typescript
const currentUser = await requireUser(req);
const { data: charge } = await supabase
  .from("charges")
  .select("id, stripe_payment_intent, amount_cents, refunded_cents, charged_at, refunded_at")
  .eq("id", chargeId)
  .eq("user_id", currentUser.id)
  .single();
```

The exact query depends on your ORM (Prisma, Drizzle, raw SQL, Supabase, etc.) -- what matters is that these values come from **your database**, not from the AI model. `orderId` or `chargeId` is a lookup hint, not proof that the caller may refund the order.

### Create the guard and wrap your provider

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

### Call and map results

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

### Update your AI agent's system prompt

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
| Trusting the AI model for order data | Wrong amounts, fake transaction IDs | Always load trusted fields from your database |
| Blindly loading an agent-supplied `orderId` | Wrong customer/order can be refunded | Resolve through user, ticket, tenant, or admin scope |
| Forgetting `await` on the refund call | `result` is a Promise, not the actual result | `const result = await refund()` |
| Provider function ignores `amount` | Guard validates amount but payment API refunds wrong amount | Always forward `amount` to your payment API |
| Agent sends a random reason | Refund denied as `refund_reason_not_allowed` | Keep `allowed_reasons` in policy and tool schema aligned |
