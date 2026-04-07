# Step-by-step: use refund-guard in your project

Read this if you want a **checklist**, not a wall of text.

## Before you start (30 seconds)

1. **This is a library**, not a website or hosted API. You `pip install` or `npm install` it into **your backend** code.
2. **Refunds with secret keys stay on the server.** A phone app talks to *your* API; your API runs this library.
3. **Pick one language** for that backend file: Python **or** TypeScript (Node).

## Step 1 -- Install

**Python**

```bash
pip install refund-guard
```

**TypeScript / Node**

```bash
npm install @mattmessinger/refund-guard
```

Trouble? See [Troubleshooting](../README.md#troubleshooting).

## Step 2 -- Define your policy

```python
# Inline (simplest)
refunds = Refunds({"skus": {"my_product": {"refund_window_days": 14}}})

# Or from a YAML file (when you have many SKUs or want non-engineers to edit policy)
refunds = Refunds("refund_policy.yaml")
```

- Each **SKU** is a product type you sell.
- **refund_window_days** is how many days after purchase a refund is still allowed.
- If your SKU is missing from the policy, `make_refund_tool` will throw.

## Step 3 -- Write your real refund function (you already have this)

You already call Stripe (or PayPal, etc.) somewhere. That function must match:

```text
(amount, transaction_id, currency) -> something
```

Keep that code. This library **wraps** it; it does not replace your payment SDK.

## Step 4 -- Load the order and create the safe tool

Your backend loads the order from the database, then passes it to refund-guard:

```python
refund_tool = refunds.make_refund_tool(
    sku=order.sku,
    transaction_id=order.transaction_id,
    amount_paid_minor_units=order.amount_cents,  # library divides by 100
    purchased_at=order.purchased_at,
    refunded_at=order.refunded_at,               # None if not yet refunded
    provider_refund_fn=my_refund,
)
```

- **`amount_paid_minor_units`**: pass cents directly -- the library converts to dollars. Or use `amount_paid` if you already have major units.
- **`refunded_at`**: pass your DB's refund timestamp. If set, the library returns `already_refunded` without calling your provider. If `None`/`null`, normal flow.

**TypeScript:** use `await` -- the callable is async. See [README.md](../README.md#typescript-full-example).

## Step 5 -- Handle the result

```python
from refund_guard import DENIAL_MESSAGES

result = refund_tool(80.00)

if result["status"] != "approved":
    print(DENIAL_MESSAGES.get(result.get("reason", ""), "Refund not allowed."))
```

- **`status: "approved"`** -- your provider ran; check `refunded_amount`.
- **`status: "denied"`** -- policy blocked it; see the [denial reason glossary](../README.md#denial-reasons).
- **`status: "error"`** -- provider threw; inspect `detail`.

`DENIAL_MESSAGES` is a built-in dict mapping reason codes to user-facing messages. Import it instead of building your own.

## Step 6 -- If you have an AI agent, update its system prompt

The library enforces **hard limits** (window, amount, balance). Your AI agent needs **soft guidance** about when to offer refunds -- which situations qualify, which don't.

See the [Integration Guide](INTEGRATION_GUIDE.md#step-4--update-your-ai-agents-system-prompt) for an example.

## Step 7 -- (Optional) Run this repo's tests

See [CONTRIBUTING.md](../CONTRIBUTING.md) for setup and test commands.

## Stuck?

See [Troubleshooting](../README.md#troubleshooting).
