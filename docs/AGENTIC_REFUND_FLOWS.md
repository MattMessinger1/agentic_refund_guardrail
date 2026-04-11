# Agentic refund flow recipes

Use these patterns when an AI agent can trigger refunds.

Use this if you are wiring a refund-capable agent into OpenAI, Vercel AI SDK, LangChain, MCP, Stripe, Supabase, Shopify, or a custom backend that can load trusted order data. Do not use this for manual refund dashboards, read-only agents, client-side refund code, apps that cannot verify order scope, or systems that already enforce the same policy server-side.

An AI refund agent needs a safety map, not just a refund function. `refund-guard` fully handles the refund-policy gate after trusted order data is loaded; your app, provider, database, and process own the surrounding responsibilities.

**Design rule:** 100% is Pass. 99% is Fail. See the [MECE security map](INTEGRATION_GUIDE.md#the-mece-agentic-refund-security-map) before moving real money.

Using Claude or Codex? Start with [Prompt 1: Install the refund-policy gate](INTEGRATION_GUIDE.md#prompt-1-install-the-refund-policy-gate), then run [Prompt 2: Complete the security map](INTEGRATION_GUIDE.md#prompt-2-complete-the-security-map). The prompts include prerequisite discovery work and help you begin covering the rest of the agentic refund security map.

```text
tool access -> order scope -> trusted facts -> refund-guard policy gate -> provider execution -> persistence/review/risk controls
```

## Safe shapes

### Server-scoped order

1. Your app already knows the order from the route, session, ticket, or backend context.
2. The agent supplies only `amount` and `reason`.
3. Your server creates a scoped refund tool with SKU, transaction ID, amount paid, amount already refunded, purchase date, and refund status.
4. `refund-guard` validates the request.
5. Your provider call receives the validated amount and uses an idempotency key.
6. Your database records the provider result and increments the persisted refunded amount.

### Agent-selected order reference

1. The agent may supply `orderId`, `amount`, and `reason`.
2. Your server treats `orderId` as a lookup hint, not trusted refund data.
3. Your server resolves the order through user, ticket, tenant, admin, or backend scope.
4. `refund-guard` receives only trusted order facts and validates the refund policy.
5. Your provider call receives the validated amount and uses an idempotency key.

Never let the agent provide transaction IDs, paid amounts, refunded amounts, SKU, purchase date, or refund timestamps.

## What refund-guard owns

- Finite positive amount checks.
- Amount paid and remaining balance caps.
- Already-refunded, refund-window, and non-refundable-SKU denials.
- Allowed reason and manual-review threshold checks.
- No provider call when policy denies the refund.

Your app still owns tool access control, order scope and ownership, authoritative refund facts, provider execution safety, state consistency and persistence, evidence/review, auditability, and fraud/abuse/compliance risk. The full MECE map lives in the [Integration Guide](INTEGRATION_GUIDE.md#the-mece-agentic-refund-security-map).

## Agent adapters

Copy the closest example:

| Stack | Example |
|-------|---------|
| OpenAI Responses API | [`examples/openai-tool-calling-ts`](../examples/openai-tool-calling-ts/) |
| Vercel AI SDK | [`examples/vercel-ai-sdk-ts`](../examples/vercel-ai-sdk-ts/) |
| LangChain Python | [`examples/langchain-python`](../examples/langchain-python/) |
| MCP server | [`examples/mcp-server-ts`](../examples/mcp-server-ts/) |

## Provider recipes

### Stripe or Stripe through Next.js

- Store `payment_intent_id`, `amount_paid_cents`, `amount_refunded_cents`, `purchased_at`, and `refunded_at`.
- Create the refund from your server route, not from the browser.
- Pass `amountRefundedMinorUnits` every time you create the guard.
- Use a stable idempotency key such as `refund:${order.id}:${amountCents}:${reason}`.
- After provider success, update `amount_refunded_cents` in the same transactional path that records the refund ID.

### Supabase Edge Function

- Keep the Stripe secret key inside the Edge Function.
- Let your app server call the Edge Function from `providerRefundFn`.
- Pass `charge_id`, validated `amount_cents`, and a policy reason.
- Have the Edge Function re-read the charge row or use a database lock if multiple refund requests can arrive at once.
- Return a small provider result that your app can save and show to support.

### Shopify Admin

- Load the order and transaction from Shopify Admin on your server.
- Map Shopify line item or product type to your `sku` policy.
- Use Shopify's already-refunded totals as `amountRefundedMinorUnits`.
- Keep return eligibility and customer-service exceptions in your policy or in a human review queue.

## Policy fields

```yaml
skus:
  success_fee:
    refund_window_days: 90
    allowed_reasons:
      - provider_cancelled
      - duplicate_charge
      - technical_error
    manual_approval_required_over_minor_units: 5000

  final_sale:
    refund_window_days: 30
    refundable: false
```

Use `allowed_reasons` in both your agent tool schema and your refund policy. If they drift, the guard still wins.

## Test before moving money

Run fake-provider scenarios with the policy doctor:

```bash
refund-guard doctor examples/doctor/policy.yaml examples/doctor/scenarios.json
```

For TypeScript:

```bash
npx @mattmessinger/refund-guard doctor policy.yaml scenarios.json
```
