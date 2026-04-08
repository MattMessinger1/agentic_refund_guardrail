# refund-guard

[![CI](https://github.com/MattMessinger1/agentic_refund_guardrail/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MattMessinger1/agentic_refund_guardrail/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/refund-guard)](https://pypi.org/project/refund-guard/)
[![npm](https://img.shields.io/npm/v/@mattmessinger/refund-guard)](https://www.npmjs.com/package/@mattmessinger/refund-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

If your AI agent can call `stripe.Refund.create()`, it can try to refund anything -- wrong transaction, wrong amount, hallucinated order.

**refund-guard** adds one step: load a real order from your database, create a scoped refund tool, and give that tool to the agent. The agent can only refund *that order*, within *your rules*.

## Who this is for

This library is for developers building AI agents -- chatbots, MCP servers, tool-calling LLMs -- that can trigger refunds. If your agent has a "refund" tool, this library makes that tool safe. Works with any payment provider: Stripe, PayPal, Shopify, or a custom backend.

Payment providers protect against *technically* invalid refunds (can't refund more than the charge, can't double-refund a payment intent). But they have no concept of *your* business rules: which products are refundable, how long the refund window is, or whether this particular order should be refunded at all. Without this library, your agent supplies the transaction ID and amount directly. With it, your server loads the real order, creates a scoped tool, and the agent can only operate inside your policy.

The library is most powerful when you have multiple SKUs with different refund windows, partial refunds, or a custom payment backend with no built-in guardrails. But even for simple single-product full-refund flows, the refund window enforcement and structured denial reasons don't exist anywhere else in the stack.

## Who this is NOT for

- **Manual refund dashboards.** If a human reviews every refund in a UI, they *are* the guardrail. This library is for automated/agent-driven flows.
- **Read-only agents.** If your agent can look up orders but never triggers a refund, there's nothing to guard.
- **Teams that already enforce all business rules server-side before the refund call.** If your backend already checks the refund window, remaining balance, and double-refund status before calling Stripe, this library would duplicate that logic. It's meant to *be* that layer, not wrap another one.

## Install

```bash
pip install refund-guard            # Python
npm install @mattmessinger/refund-guard  # TypeScript / Node
```

## Quickstart

```python
from refund_guard import Refunds

refunds = Refunds({"skus": {"shampoo": {"refund_window_days": 30}}})

order = get_order_from_db(order_id)   # YOUR database, not the agent

refund_tool = refunds.make_refund_tool(
    sku=order.sku,
    transaction_id=order.transaction_id,
    amount_paid_minor_units=order.amount_cents,  # library divides by 100
    purchased_at=order.purchased_at,
    refunded_at=order.refunded_at,               # None = not yet refunded
    provider_refund_fn=my_existing_refund_fn,     # your Stripe / PayPal / Shopify call
)

result = refund_tool()      # full refund (no amount needed)
result = refund_tool(50)    # or partial refund
# {"status": "approved", "refunded_amount": 100.0, ...}
# {"status": "denied", "reason": "refund_window_expired", ...}
```

That's it. Call with no argument for a full refund, or pass an amount for a partial refund. Your provider function is only called if every check passes.

## What it checks (before your refund function runs)

- **Already refunded** -- if `refunded_at` is set, denied immediately
- **Refund window** -- still within `refund_window_days` for that SKU
- **Positive amount** -- must be > 0
- **Amount cap** -- cannot exceed what was paid
- **Remaining balance** -- handles partial refunds (can't refund $60 twice on a $100 order)

If any check fails, your provider function is **never called** -- no money moves.

## TypeScript

```typescript
import { Refunds, DENIAL_MESSAGES } from "@mattmessinger/refund-guard";

const refunds = new Refunds({ skus: { shampoo: { refund_window_days: 30 } } });
const order = await loadOrderFromDb(orderId);

const refund = refunds.makeRefundTool({
  sku: order.sku,
  transactionId: order.transactionId,
  amountPaidMinorUnits: order.amountCents,
  purchasedAt: order.purchasedAt,
  refundedAt: order.refundedAt,
  providerRefundFn: myExistingRefundFn,
});

const result = await refund();       // full refund -- or refund(50) for partial
const message = DENIAL_MESSAGES[result.reason as string] ?? "Refund processed.";
```

Both implementations follow the **same** behavior, enforced by [shared parity tests](contracts/parity/cases.json).

---

## API reference

### `Refunds(policy)`

| Param | Type | Notes |
|-------|------|-------|
| `policy` | YAML file path **or** plain object `{ skus: { sku_name: { refund_window_days: N } } }` | Loaded once; reuse the instance |

### `make_refund_tool(**opts)` / `makeRefundTool(opts)`

| Option | Type | Required | Default |
|--------|------|----------|---------|
| `sku` | `string` | yes | -- |
| `transaction_id` / `transactionId` | `string` | yes | -- |
| `amount_paid` / `amountPaid` | `number` | one of these | -- |
| `amount_paid_minor_units` / `amountPaidMinorUnits` | `int` / `number` | one of these | -- |
| `purchased_at` / `purchasedAt` | `datetime` / `Date` | yes | -- |
| `provider_refund_fn` / `providerRefundFn` | `(amount, txn_id, currency) -> any` | yes | -- |
| `refunded_at` / `refundedAt` | `datetime` / `Date` or `None`/`null` | no | `None` |
| `currency` | `string` | no | `"usd"` |
| `provider` | `string` | no | `"unknown"` |

Provide **one** of `amount_paid` (dollars) or `amount_paid_minor_units` (cents -- divided by 100 internally). Providing both raises an error.

### The refund callable: `refund_tool(amount?)` / `await refund(amount?)`

| Call | Behavior |
|------|----------|
| `refund_tool()` | Full refund of the remaining balance (`amount_paid - total_refunded`) |
| `refund_tool(50)` | Partial refund of $50 |

> **Important:** The library passes the validated amount to your `provider_refund_fn`. If your provider function ignores the amount parameter, the amount checks provide no protection. Always forward the amount to your payment API.

### `DENIAL_MESSAGES`

```python
from refund_guard import DENIAL_MESSAGES
# {"refund_window_expired": "The refund window for this order has closed.", ...}
```

A dict / `Record<string, string>` mapping every denial reason to a user-facing message.

---

## Denial reasons

| `reason` | Meaning |
|----------|---------|
| `already_refunded` | `refunded_at` was set -- already refunded |
| `refund_window_expired` | Purchase older than the SKU's window |
| `amount_exceeds_limit` | Requested more than was paid |
| `amount_exceeds_remaining` | Not enough balance after partial refunds |
| `invalid_amount` | Zero or negative |
| `provider_error` | Your provider threw an exception |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Every refund denied as `amount_exceeds_limit` | You're passing cents to `amount_paid`. Use `amount_paid_minor_units` instead. |
| Every refund denied as `already_refunded` | You're passing a non-null `refunded_at`. This order is already refunded in your DB. |
| `SKU 'x' not found in policy` | Add that SKU to your policy object or YAML file. |
| Forgot `await` (TypeScript) | The callable is async: `const r = await refund()`. |
| Refunds go through but amount is wrong | Your `providerRefundFn` must forward the `amount` parameter to your payment API. |

---

## FAQ

**Why not just trust the agent?**
Models hallucinate transaction IDs, mix up amounts, and retry incorrectly. This library binds the tool to one real order your server loaded.

**Does this replace Stripe / PayPal / Shopify?**
No. It wraps your existing refund call with policy checks.

**Do I need Python *and* TypeScript?**
No. Pick whichever your backend uses.

**What does my provider function look like?**
`(amount, transaction_id, currency) -> anything`. Same for Stripe, PayPal, Shopify, or your own API.

**What about double refunds across HTTP requests?**
Pass `refunded_at` from your database. The library denies immediately if it's set. If you don't pass it, you need to check it yourself.

**What data does the agent control?**
The refund amount (or nothing at all -- call with no argument for a full refund). SKU, transaction ID, amount paid, and purchase date all come from your database -- never from the agent.

**Is this safe?**
The agent is untrusted. Your app provides order truth (SKU, IDs, amounts, dates). Your payment provider handles money. The agent only chooses how much to refund, inside the bounds you set.

**How do I enable logging? (Python)**
```python
import logging
logging.basicConfig()
logging.getLogger("refund_guard").setLevel(logging.INFO)
```

**What do I tell my AI agent about refund policy?**
The library enforces hard limits (window, amount, balance). Your agent's system prompt should encode *when* to offer refunds. See the [Integration Guide](docs/INTEGRATION_GUIDE.md#step-4--update-your-ai-agents-system-prompt).

**I'm wiring this into a real app with a database and Stripe. Where do I start?**
Read the [Integration Guide](docs/INTEGRATION_GUIDE.md) -- a walkthrough based on actual production usage.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, and PR guidelines.

Both languages run the **same 20 test scenarios** from [`contracts/parity/cases.json`](contracts/parity/cases.json). If you change behavior in one language, the shared tests catch the drift.

---

## License

MIT
