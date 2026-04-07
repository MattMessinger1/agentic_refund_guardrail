# HN Post Draft

## Title

Show HN: Turn a real order into a safe refund tool for your AI agent

## Body

If your AI agent can call `stripe.Refund.create()`, it can try to refund
anything -- wrong transaction, wrong amount, hallucinated order.

This is a small self-hosted library (Python + TypeScript) that adds one step
before your existing refund call:

- Your app loads the real order from your DB
- refund-guard turns that order into a scoped refund tool
- The agent only gets that tool

```python
from refund_guard import Refunds

refunds = Refunds({"skus": {"shampoo": {"refund_window_days": 30}}})

order = get_order(order_id)  # your DB, not the agent

refund_tool = refunds.make_refund_tool(
    sku=order.sku,
    transaction_id=order.transaction_id,
    amount_paid_minor_units=order.amount_cents,
    purchased_at=order.purchased_at,
    refunded_at=order.refunded_at,
    provider_refund_fn=my_refund,
)

result = refund_tool()     # full refund -- or pass an amount for partial
```

What it checks before your provider function runs:

- Already-refunded orders (via `refunded_at`)
- Refund window for that SKU
- Amount is positive
- Amount does not exceed what was paid
- Remaining balance after partial refunds

Call with no argument for a full refund, or pass an amount for a partial. Instead
of trusting agent-supplied transaction IDs or amounts, you derive everything from
real order data and only let the agent choose the refund amount inside those bounds.

**How this differs from generic agent guardrails:**

Tools like Veto, PolicyLayer, and Kvlar operate at the tool-call level -- they
rate-limit, allowlist, or route to human approval. They answer "can this agent
call create_refund right now?"

This operates at the business-logic level. It answers "can this agent refund
*this order* for *this amount*?" A rate limit of 10 refunds/hour won't stop an
agent from refunding $10,000 on a $50 order. This will.

They're complementary. Use a generic guardrail for broad tool governance. Use
this for refund-specific business logic.

Works with Stripe, PayPal, Shopify, or anything -- you supply the refund
function, we just gate it.

Self-hosted, ~200 lines, one dependency (pyyaml). No API keys leave your system.
Also ships as a TypeScript/npm package with identical behavior.

Repo: https://github.com/MattMessinger1/agentic_refund_guardrail
