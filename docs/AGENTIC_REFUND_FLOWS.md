# Agentic refund flow recipes

Use these patterns when an AI agent can trigger refunds.

Use this if you are wiring a refund-capable agent into OpenAI, Vercel AI SDK, LangChain, MCP, Stripe, Supabase, Shopify, or a custom backend. Do not use this for manual refund dashboards, read-only agents, client-side refund code, or systems that already enforce the same policy server-side.

`refund-guard` sits between an untrusted AI tool call and your refund provider. The framework can change; the safety shape should not.

## Safe shape

1. The agent may supply only `amount` and `reason`.
2. Your server loads trusted order state from the database.
3. Your server creates a scoped refund tool with SKU, transaction ID, amount paid, amount already refunded, purchase date, and refund status.
4. `refund-guard` validates the request.
5. Your provider call receives the validated amount and uses an idempotency key.
6. Your database records the provider result and increments the persisted refunded amount.

Never let the agent provide transaction IDs, paid amounts, refunded amounts, SKU, purchase date, or refund timestamps.

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
