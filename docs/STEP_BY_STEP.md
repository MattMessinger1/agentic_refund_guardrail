# Step-by-step: use refund-guard in your project

Read this if you want a **checklist**, not a wall of text.

## Before you start (30 seconds)

1. **This is a library**, not a website or hosted API. You `pip install` or `npm install` it into **your backend** code.
2. **Refunds with secret keys stay on the server.** A phone app talks to *your* API; your API runs this library. You do **not** put Stripe secret keys in a mobile app.
3. **Pick one language** for that backend file: Python **or** TypeScript (Node). You do not use both in the same process.

## Step 1 — Install

**Python**

```bash
pip install refund-guard
```

**TypeScript / Node**

```bash
npm install @mattmessinger/refund-guard
```

If `pip` or `npm` errors, install Python 3.10+ or Node 18+ first.

## Step 2 — Add a policy file

Create `refund_policy.yaml` next to your code (or pass a full path):

```yaml
skus:
  my_product:
    refund_window_days: 14
```

- Each **SKU** is a product type you sell.
- **refund_window_days** is how many days after purchase a refund is still allowed (calendar-day style, same as the Python implementation).

If your SKU is not in this file, `make_refund_tool` will throw — that is intentional.

## Step 3 — Write your real refund function (you already have this)

You already call Stripe (or PayPal, etc.) somewhere. That function must match:

```text
(amount, transaction_id, currency) → something
```

Keep that code. This library **wraps** it; it does not replace Stripe.

## Step 4 — Load the order on the server (not from the AI)

Your backend loads:

- SKU (string)
- Provider transaction id (e.g. Stripe payment intent id)
- Amount paid
- When it was purchased

Those values must come from **your database or Stripe**, not from the model guessing.

## Step 5 — Create the safe tool and call it

**Python:** see the copy-paste block in [README.md](../README.md#python-full-example).

**TypeScript:** use `await` — the callable is async. See [README.md](../README.md#typescript-full-example).

## Step 6 — Handle the result

- **`status: "approved"`** — your provider ran; check `refunded_amount`.
- **`status: "denied"`** — policy blocked it; show `reason` to logs or support (not always to end users).
- **`status: "error"`** — provider threw; inspect `detail`.

## Step 7 — (Optional) Run this repo’s tests

Clone the repo and run the same checks CI runs:

```bash
# Python
pip install -e ".[dev]"
pytest

# TypeScript
cd packages/refund-guard-ts
npm ci
npm test
```

That proves your local setup works.

## Stuck?

See **Troubleshooting** in [README.md](../README.md#troubleshooting).
