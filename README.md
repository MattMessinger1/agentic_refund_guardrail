# refund-guard

Turn a real order into a safe refund tool for your AI agent.

If your agent can call Stripe / Shopify / PayPal directly, it can try to refund
anything -- wrong transaction, wrong amount, hallucinated order. This library
adds one safe step before your existing refund call so the agent can only refund
what your policy allows.

## How it works

Your app loads the real order. This library wraps your refund function with
policy checks. The agent gets a callable that can only refund that order.

```
Your DB (real order) + Your policy (YAML) + Your refund fn (Stripe/etc.)
                           |
                    refunds.make_refund_tool(...)
                           |
                     refund_tool(amount)  <-- agent calls this
                           |
              validate --> call your fn --> log result
```

The agent never supplies transaction IDs, amounts, or SKUs.
Everything comes from your app.

## Quickstart

### Install

```bash
pip install refund-guard
```

### Define your refund policy

Create `refund_policy.yaml`:

```yaml
skus:
  digital_course:
    refund_window_days: 7
  shampoo:
    refund_window_days: 30
```

### Use it

```python
from datetime import datetime
from refund_guard import Refunds

refunds = Refunds("refund_policy.yaml")

# Your app loads the real order (NOT the agent)
order = get_order(order_id)

# Your existing refund function
def my_stripe_refund(amount, transaction_id, currency):
    return stripe.Refund.create(
        payment_intent=transaction_id,
        amount=int(amount * 100),
    )

# Turn it into a safe tool
refund_tool = refunds.make_refund_tool(
    sku=order.sku,
    transaction_id=order.transaction_id,
    amount_paid=order.amount_paid,
    purchased_at=order.purchased_at,
    provider_refund_fn=my_stripe_refund,
)

# This is all the agent gets
result = refund_tool(80.00)
```

### What comes back

Approved:

```python
{"status": "approved", "refunded_amount": 80.0, "transaction_id": "pi_abc123"}
```

Denied:

```python
{"status": "denied", "reason": "amount_exceeds_limit", "requested": 200.0, "max_allowed": 120.0}
```

Provider error:

```python
{"status": "error", "reason": "provider_error", "detail": "No such payment_intent: pi_xxx"}
```

## What it checks

Every call to `refund_tool(amount)` validates four things, in order:

1. **Refund window** -- is the order still within the allowed refund period?
2. **Positive amount** -- is the requested amount greater than zero?
3. **Amount cap** -- does the amount exceed what was actually paid?
4. **Remaining balance** -- has this order already been partially refunded past the limit?

If any check fails, your refund function is never called.

## Security model

| Layer | Role |
|-------|------|
| Stripe / PayPal / Shopify | Source of truth for payments |
| Your app | Source of truth for orders and SKUs |
| Agent | Untrusted |

The agent never supplies transaction IDs, SKUs, or payment amounts.
`make_refund_tool()` closes over the real order data your app provided.
The agent only controls how much to refund, within your limits.

## How this differs from generic agent guardrails

Tools like [Veto](https://veto.so/), [PolicyLayer](https://policylayer.com/),
and [Kvlar](https://github.com/nichochar/kvlar) operate at the **tool-call level** --
they rate-limit, allowlist, or route to human approval. They answer
"can this agent call `create_refund` right now?"

refund-guard operates at the **business-logic level**. It answers
"can this agent refund *this order* for *this amount*?" None of the
generic guardrails can enforce that a refund amount must be less than
what was actually paid on a specific transaction, or that this SKU's
refund window has expired.

They're complementary. Use a generic guardrail for broad tool governance.
Use refund-guard for refund-specific business logic.

## Works with anything

This sits right before whatever refund call you already have:

```python
# Stripe
def my_refund(amount, transaction_id, currency):
    return stripe.Refund.create(
        payment_intent=transaction_id,
        amount=int(amount * 100),
    )

# PayPal
def my_refund(amount, transaction_id, currency):
    return paypal.captures.refund(
        transaction_id,
        {"amount": {"value": str(amount), "currency_code": currency.upper()}},
    )

# Shopify, your own backend, anything
def my_refund(amount, transaction_id, currency):
    return requests.post(
        f"{API}/refunds",
        json={"txn": transaction_id, "amount": amount},
    )
```

Pass any of these as `provider_refund_fn`.
The signature is always `(amount: float, transaction_id: str, currency: str) -> Any`.

## Logging

Every attempt is logged via Python's standard `logging` module under
the logger name `refund_guard`. Configure it however you already
handle logging:

```python
import logging
logging.basicConfig()
logging.getLogger("refund_guard").setLevel(logging.INFO)
```

Each refund attempt emits a JSON-structured log line:

```json
{"transaction_id": "pi_abc123", "sku": "digital_course", "requested_amount": 200, "status": "denied", "reason": "amount_exceeds_limit"}
```

## FAQ

**Why not just trust the agent?**

Agents can hallucinate transaction IDs, retry with wrong amounts, or
confuse one customer's order with another. This ensures refunds are
always grounded in real data.

**Why not use Stripe metadata or webhooks?**

Metadata is informational, not a control layer. Webhooks tell you what
happened after the fact. This prevents bad refunds before they happen.

**Does this replace Stripe / Shopify / PayPal?**

No. It adds one validation step before them. Your existing refund code
stays exactly the same.

**How big is this?**

About 200 lines of Python. One dependency (pyyaml).

## License

MIT
