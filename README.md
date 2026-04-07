# refund-guard

[![CI](https://github.com/MattMessinger1/agentic_refund_guardrail/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MattMessinger1/agentic_refund_guardrail/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](pyproject.toml)
[![Node 18+](https://img.shields.io/badge/node-18+-green.svg)](packages/refund-guard-ts/package.json)

**Start here:** [Step-by-step guide](docs/STEP_BY_STEP.md) · [Integration guide](docs/INTEGRATION_GUIDE.md) · [Contributing](CONTRIBUTING.md) · [Report an issue](https://github.com/MattMessinger1/agentic_refund_guardrail/issues/new/choose)

**A small library** that turns **one real order** into **one safe refund function** for your AI agent — so the agent can only refund what your policy allows (window, amount cap, remaining balance).

> **New here?** Read [docs/STEP_BY_STEP.md](docs/STEP_BY_STEP.md) first, then come back for details.

---

## Read this first (1 minute)

| Question | Answer |
|----------|--------|
| Is this a hosted API or SaaS? | **No.** It is a **package** you install (`pip` / `npm`) in **your** server code. |
| Does it run on my phone? | **Not inside the app.** Your mobile app calls **your backend**; the backend runs this library. |
| Do I need Python *and* TypeScript? | **No.** Pick **one** — whatever your backend uses. |
| What does it actually do? | Wraps **your** existing refund call with **policy checks** before money moves. |
| How is this different from agent guardrail products (Veto, PolicyLayer, Kvlar, etc.)? | Those answer: *should this tool run at all?* **refund-guard** answers: *for this order and this amount, does our business policy allow it?* Use both if you want. |
| Do I have to use a YAML file? | **No.** Pass a plain object: `Refunds({ skus: { my_sku: { refund_window_days: 14 } } })`. YAML is available when you have many SKUs or want non-engineers to edit policy. |
| What signature does my provider function use? | `(amount, transaction_id, currency)` — same for Stripe, PayPal, Shopify, or your own HTTP API. |

---

## The idea in one picture

```text
Your database loads the real order (SKU, txn id, amount, date)
        |
        v
  refund-guard: make_refund_tool(...)   <-- closes over that order
        |
        v
  Agent / user only chooses HOW MUCH to refund (within rules)
        |
        v
  validate -> then your provider refund code runs
```

The agent should **not** pass transaction IDs or "what was paid" -- your app does.

---

## Install

**Python (PyPI)**

```bash
pip install refund-guard
```

**TypeScript / Node (npm)**

```bash
npm install @mattmessinger/refund-guard
```

Both implementations follow the **same** behavior, enforced by shared tests in [`contracts/parity/cases.json`](contracts/parity/cases.json).

---

## Examples

| | |
|---|---|
| **Python** | [`examples/minimal-python/`](examples/minimal-python/README.md) -- fake provider, runs instantly |
| **TypeScript** | [`examples/minimal-ts/`](examples/minimal-ts/README.md) -- fake provider, build TS package first |
| **Real-world pattern** | [`examples/real-world-ts/`](examples/real-world-ts/README.md) -- annotated reference showing DB fetch, unit conversion, result mapping (not runnable) |

---

## Tutorial (5 minutes)

### 1. Define your policy

```python
# Inline (simplest)
refunds = Refunds({"skus": {"shampoo": {"refund_window_days": 30}}})

# Or from a YAML file (when you have many SKUs)
refunds = Refunds("refund_policy.yaml")
```

### 2. Wire refund-guard

Pick **one** language.

---

### Python (full example)

```python
from datetime import datetime
from refund_guard import Refunds

refunds = Refunds({"skus": {"shampoo": {"refund_window_days": 30}}})

order = get_order_from_db(order_id)  # YOUR database

def my_refund(amount: float, transaction_id: str, currency: str):
    # Your existing Stripe / PayPal / Shopify / HTTP call
    return stripe.Refund.create(
        payment_intent=transaction_id,
        amount=int(amount * 100),
    )

refund_tool = refunds.make_refund_tool(
    sku=order.sku,
    transaction_id=order.transaction_id,
    amount_paid_minor_units=order.amount_cents,  # library divides by 100
    purchased_at=order.purchased_at,
    refunded_at=order.refunded_at,               # None or datetime; blocks double-refunds
    provider_refund_fn=my_refund,
)

result = refund_tool(80.00)
print(result)
```

---

### TypeScript (full example)

```typescript
import { Refunds } from "@mattmessinger/refund-guard";

const refunds = new Refunds({ skus: { shampoo: { refund_window_days: 30 } } });

const order = await loadOrderFromDb(orderId);

const refund = refunds.makeRefundTool({
  sku: order.sku,
  transactionId: order.transactionId,
  amountPaidMinorUnits: order.amountCents,  // library divides by 100
  purchasedAt: order.purchasedAt,
  refundedAt: order.refundedAt,             // null/undefined or Date; blocks double-refunds
  providerRefundFn: (amount, transactionId, currency) =>
    // Your existing Stripe / PayPal / Shopify / HTTP call
    stripe.refunds.create({
      payment_intent: transactionId,
      amount: Math.round(amount * 100),
      currency,
    }),
});

const result = await refund(80.0);
console.log(result);
```

- The returned function is **async** -- use `await`.
- `providerRefundFn` may return a Promise or a plain value.
- **Tests only:** pass `nowFn` (Python: `now_fn`) to freeze "today." Omit in production.

---

## API reference (quick)

### `Refunds(policy)`

| Param | Type | Notes |
|-------|------|-------|
| `policy` | YAML file path **or** plain object `{ skus: { sku_name: { refund_window_days: N } } }` | Loaded once; reuse the instance |

### `refunds.makeRefundTool(opts)` / `refunds.make_refund_tool(**opts)`

| Option | Type | Required | Default |
|--------|------|----------|---------|
| `sku` | `string` | yes | -- |
| `transaction_id` / `transactionId` | `string` | yes | -- |
| `amount_paid` / `amountPaid` | `number` | one of these | -- |
| `amount_paid_minor_units` / `amountPaidMinorUnits` | `int` / `number` | one of these | -- |
| `purchased_at` / `purchasedAt` | `datetime` / `Date` | yes | -- |
| `provider_refund_fn` / `providerRefundFn` | `(amount, txn_id, currency) -> any` | yes | -- |
| `refunded_at` / `refundedAt` | `datetime` / `Date` or `None`/`null` | no | `None` / `null` |
| `currency` | `string` | no | `"usd"` |
| `provider` | `string` | no | `"unknown"` |
| `now_fn` / `nowFn` | `() -> datetime/Date` | no | current UTC time |

Provide **one** of `amount_paid` (major units, e.g. dollars) or `amount_paid_minor_units` (e.g. cents -- divided by 100 internally). Providing both raises an error.

Returns a **callable** (Python) or **async function** (TypeScript) with signature `(amount) -> result`.

### `DENIAL_MESSAGES`

```python
from refund_guard import DENIAL_MESSAGES
```

```typescript
import { DENIAL_MESSAGES } from "@mattmessinger/refund-guard";
```

A `dict` / `Record<string, string>` mapping every denial reason code to a user-facing message. Use directly or override individual values.

---

## What you get back

**Approved**

```json
{"status": "approved", "refunded_amount": 80.0, "transaction_id": "pi_abc123"}
```

**Denied** (policy blocked -- your refund function was **not** called)

```json
{"status": "denied", "reason": "amount_exceeds_limit", "requested": 200.0, "max_allowed": 120.0}
```

**Provider error** (your provider threw)

```json
{"status": "error", "reason": "provider_error", "detail": "No such payment_intent: pi_xxx"}
```

---

## Denial reasons

| `reason` | What it means | Suggested message for users |
|----------|---------------|-----------------------------|
| `already_refunded` | `refunded_at` was set -- order was already refunded | "This order has already been refunded." |
| `refund_window_expired` | Purchase is older than the SKU's `refund_window_days` | "The refund window for this order has closed." |
| `amount_exceeds_limit` | Requested more than was originally paid | "Refund amount exceeds the original charge." |
| `amount_exceeds_remaining` | After partial refunds, not enough balance left | "This order has already been partially refunded." |
| `invalid_amount` | Amount is zero or negative | "Please enter a valid refund amount." |
| `provider_error` | Your provider call threw an exception | "Refund could not be processed. Please contact support." |

These messages are available as `DENIAL_MESSAGES` -- import and use directly instead of building your own map.

When `status` is `"denied"`, your provider function was **never called** -- no money moved.

---

## What it checks (in order)

1. **Already refunded** -- if `refunded_at` is set, denied immediately
2. **Refund window** -- still within `refund_window_days` for that SKU
3. **Positive amount** -- must be > 0
4. **Amount cap** -- cannot exceed what was paid on this order
5. **Remaining balance** -- after partial refunds, cannot exceed what's left

If any check fails, **your provider function is never called.**

---

## What this library does NOT do

| | |
|---|---|
| **Prevent double refunds across HTTP requests** | Pass `refunded_at` from your database and the library will deny immediately. If you don't pass it, you must check it yourself. |
| **Fetch order data** | You load SKU, amount, purchase date, and transaction ID from **your** database. |
| **Replace your payment SDK** | It wraps your existing refund call. You still need Stripe / PayPal / etc. |
| **Run on the client / frontend** | Server-side only. Your mobile or web app calls your backend; your backend runs this. |
| **Tell your AI agent when to offer refunds** | The library enforces hard limits. Your agent's prompt encodes business rules. See the [Integration Guide](docs/INTEGRATION_GUIDE.md#step-4--update-your-ai-agents-system-prompt). |

---

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| `SKU 'x' not found in policy` | Add that SKU to your policy object or YAML file. |
| `Cannot find module` (TypeScript) | Run `npm install @mattmessinger/refund-guard` in your project folder. |
| Forgot `await` (TypeScript) | The refund callable is async: `const r = await refund(10)`. |
| Every refund denied as `amount_exceeds_limit` | You're passing **minor units** (cents) instead of **major units** (dollars). Use `amount_paid_minor_units` / `amountPaidMinorUnits` and the library converts for you. |
| Every refund denied as `already_refunded` | You're passing a non-null `refunded_at` -- this order was already refunded in your database. |
| Policy file not found | Pass an absolute path, or use an inline policy object instead. |
| `refund_window_expired` | Expected if the purchase is older than the SKU's window. |

---

## Security model

| Layer | Role |
|-------|------|
| Your payment provider | Money + payment truth |
| **Your app** | Order truth (SKU, ids, amounts, dates) |
| **Agent / chat** | Untrusted -- only chooses refund amount inside the tool |

---

## Logging (Python)

```python
import logging
logging.basicConfig()
logging.getLogger("refund_guard").setLevel(logging.INFO)
```

---

## Develop / clone this repo

See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup. Quick start:

```bash
git clone https://github.com/MattMessinger1/agentic_refund_guardrail.git
cd agentic_refund_guardrail
pip install -e ".[dev]" && pytest          # Python
cd packages/refund-guard-ts && npm ci && npm test  # TypeScript
```

Both languages run the **same 17 test scenarios** from [`contracts/parity/cases.json`](contracts/parity/cases.json). If you change behavior in one language, the shared tests catch the drift.

---

## FAQ

**Why not trust the agent with transaction IDs?**
Models mix up amounts and ids. This library binds the tool to **one** order your server loaded.

**Does this replace Stripe?**
No. It sits **in front of** your existing refund code.

**Why Python and TypeScript in one repo?**
So pip users and npm users get the **same behavior** -- locked by shared tests, not by vibes.

**What do I tell my AI agent about refund policy?**
The library validates amounts and windows. Your agent's prompt should encode *when* to offer refunds. See the [Integration Guide](docs/INTEGRATION_GUIDE.md#step-4--update-your-ai-agents-system-prompt).

**I'm integrating into a real app -- where do I start?**
Read the [Integration Guide](docs/INTEGRATION_GUIDE.md).

**Security disclosures?**
See [SECURITY.md](SECURITY.md).

---

## License

MIT
