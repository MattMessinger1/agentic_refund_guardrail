# HN Post Draft

## Title

Show HN: Refund Guard -- scope AI agent refunds to real orders and policies

## Body

If your AI agent can call `stripe.Refund.create()`, it can try to refund
anything -- wrong transaction, wrong amount, hallucinated order.

Refund Guard is a small Python library that adds one step before your existing
refund call. You load a real order from your DB, wrap your refund function, and
hand the agent a scoped tool that can only refund *that* order, within *your*
policy.

```python
from refund_guard import Refunds

refunds = Refunds("refund_policy.yaml")

# Your app loads the real order (not the agent)
order = get_order(order_id)

# Turn it into a safe refund tool
refund_tool = refunds.make_refund_tool(
    sku=order.sku,
    transaction_id=order.transaction_id,
    amount_paid=order.amount_paid,
    purchased_at=order.purchased_at,
    provider_refund_fn=my_stripe_refund,
)

# This is all the agent gets
refund_tool(80.00)
```

What happens:

- Refund must match a real transaction (your app loaded it, not the agent)
- Amount is capped at what was actually paid
- Partial refunds are tracked (can't refund $60 twice on a $100 order)
- Refund window is enforced per SKU
- Every attempt is logged
- If it fails validation, the provider function is never called

The policy file is just:

```yaml
skus:
  digital_course:
    refund_window_days: 7
  shampoo:
    refund_window_days: 30
```

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

Repo: https://github.com/MattMessinger1/agentic_refund_guardrail
