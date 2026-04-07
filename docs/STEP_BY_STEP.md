# Step-by-step: use refund-guard in your project

Read this if you want a **checklist**, not a wall of text.

## Before you start (30 seconds)

1. **This is a library**, not a website or hosted API. You `pip install` or `npm install` it into **your backend** code.
2. **Refunds with secret keys stay on the server.** A phone app talks to *your* API; your API runs this library.
3. **Pick one language** for that backend file: Python **or** TypeScript (Node).

## Step 1 — Install

**Python**

```bash
pip install refund-guard
```

**TypeScript / Node**

```bash
npm install @mattmessinger/refund-guard
```

Trouble? See [Troubleshooting](../README.md#troubleshooting).

## Step 2 — Define your policy

```python
# Inline (simplest)
refunds = Refunds({"skus": {"my_product": {"refund_window_days": 14}}})

# Or from a YAML file (when you have many SKUs or want non-engineers to edit policy)
refunds = Refunds("refund_policy.yaml")
```

- Each **SKU** is a product type you sell.
- **refund_window_days** is how many days after purchase a refund is still allowed.
- If your SKU is missing from the policy, `make_refund_tool` will throw.

## Step 3 — Write your real refund function (you already have this)

You already call Stripe (or PayPal, etc.) somewhere. That function must match:

```text
(amount, transaction_id, currency) -> something
```

Keep that code. This library **wraps** it; it does not replace your payment SDK.

## Step 4 — Load the order on the server (not from the AI)

Your backend loads:

- SKU (string)
- Provider transaction id (e.g. Stripe payment intent id)
- Amount paid
- When it was purchased

Those values must come from **your database**, not from the model guessing.

> **Minor units vs. major units:** Most payment providers (Stripe, PayPal, Shopify) store amounts in **minor units** (cents) — e.g. `2000` means $20.00. refund-guard works in **major units** (dollars, euros, pounds). Divide by 100.

> **Check `refunded_at` first:** Before calling `make_refund_tool`, check your database for whether this order was already refunded. The library prevents over-refunding within a single session, but your database is the source of truth across separate requests. See [Integration Guide](INTEGRATION_GUIDE.md#step-2--check-refunded_at-yourself).

## Step 5 — Create the safe tool and call it

**Python:** see the copy-paste block in [README.md](../README.md#python-full-example).

**TypeScript:** use `await` — the callable is async. See [README.md](../README.md#typescript-full-example).

## Step 6 — Handle the result

- **`status: "approved"`** — your provider ran; check `refunded_amount`.
- **`status: "denied"`** — policy blocked it; see the [denial reason glossary](../README.md#denial-reasons).
- **`status: "error"`** — provider threw; inspect `detail`.

See [`examples/real-world-ts/handler.ts`](../examples/real-world-ts/handler.ts) for a full result-mapping pattern.

## Step 7 — If you have an AI agent, update its system prompt

The library enforces **hard limits** (window, amount, balance). Your AI agent needs **soft guidance** about when to offer refunds — which situations qualify, which don't.

See the [Integration Guide](INTEGRATION_GUIDE.md#step-6--update-your-ai-agents-system-prompt) for an example.

## Step 8 — (Optional) Run this repo's tests

See [CONTRIBUTING.md](../CONTRIBUTING.md) for setup and test commands.

## Stuck?

See [Troubleshooting](../README.md#troubleshooting).
