# refund-guard

[![CI](https://github.com/MattMessinger1/agentic_refund_guardrail/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MattMessinger1/agentic_refund_guardrail/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/refund-guard)](https://pypi.org/project/refund-guard/)
[![npm](https://img.shields.io/npm/v/@mattmessinger/refund-guard)](https://www.npmjs.com/package/@mattmessinger/refund-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

If your AI agent can trigger refunds, do not hand it a raw Stripe/PayPal/Shopify refund function.

An AI refund agent needs a safety map, not just a refund function. **refund-guard** fully handles a deterministic series of security responsibilities after trusted order data is loaded: the agent input boundary, refund-policy enforcement, and the no-provider-call-on-denial gate. This repo also names the remaining responsibilities your app, provider, database, and process must own before agents can move money.

**Design rule:** 100% is Pass. 99% is Fail. `refund-guard` only claims the security responsibilities it can enforce completely.

## Why use this

- **Agent input boundary:** once your app creates the scoped refund tool, the model can request only `amount` and `reason`.
- **Refund-policy enforcement:** amount validity, paid/remaining caps, refund windows, final-sale SKUs, allowed reasons, and manual-review thresholds.
- **Provider invocation gate:** your provider function is not called unless policy passes.
- **Security map:** the repo shows the other responsibilities you must own instead of pretending this package handles them.

## Where it fits

```text
AI agent -> tool handler -> resolve trusted order -> refund-guard -> refund provider -> update DB
```

## Agentic refund security map

MECE here means every security category has one clear owner. `refund-guard` either owns a category at 100%, or it does not own that category.

Green nodes are the categories or gates `refund-guard` enforces. Gray nodes are responsibilities your app, provider, database, or process must own.

```mermaid
flowchart LR
  A["1. Tool access control<br/>App owns"] --> B["2. Order scope and ownership<br/>App owns"]
  B --> C["3. Authoritative refund facts<br/>App/database/provider owns"]
  C --> D["4. Agent input boundary<br/>refund-guard owns 100%"]
  D --> E["5. Refund-policy enforcement<br/>refund-guard owns 100%"]
  E --> F["6. Provider invocation gate<br/>refund-guard owns denial gate"]
  F --> G["7. Provider execution safety<br/>App/provider owns"]
  G --> H["8. State consistency and persistence<br/>App/database owns"]
  H --> I["9. Evidence, exceptions, and human review<br/>App/process owns"]
  I --> J["10. Auditability and accountability<br/>App/process owns"]
  J --> K["11. Fraud, abuse, and compliance risk<br/>App/process owns"]

  class D,E,F refundGuard
  class A,B,C,G,H,I,J,K appOwned
  classDef refundGuard fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d;
  classDef appOwned fill:#f8fafc,stroke:#cbd5e1,color:#0f172a;
```

## Good fit

- You are prototyping or shipping an AI support agent that can trigger refunds.
- Your refund rules live in prompts, scattered `if` statements, or provider-call code.
- Your server can load trusted order data through user, ticket, tenant, admin, or backend scope.
- You need a package-enforced policy gate plus a full security map before building a custom refund-policy service.
- Your app has refund windows, partial refunds, final-sale SKUs, allowed reasons, or manual-review thresholds.

Payment providers protect against *technically* invalid refunds. They do not know your business rules. `refund-guard` is the thin layer where those rules live.

## Not a fit

- Humans approve every refund before money moves.
- Your agent is read-only and never triggers refunds.
- Refund code runs client-side. Provider secrets and refund calls belong on your server.
- Your app cannot verify order scope before refunding, or plans to trust agent-supplied order metadata.
- Your backend already has equivalent tested refund-policy enforcement.
- You need this package to own auth, order ownership, provider idempotency, persistence, audit, review, fraud, compliance, chargeback, or risk infrastructure.

## How to use this in 10 minutes

1. Pick Python or TypeScript.
2. Define SKU refund rules.
3. Resolve the real order through your app's user/ticket/tenant/admin scope.
4. Create a scoped refund tool with paid/refunded/date/status fields.
5. Give the agent only `amount` and `reason`, or treat `orderId` as a scoped lookup hint.
6. Run the minimal example or policy doctor before real money.

## Copy/paste prompts for vibe builders

These are self-contained templates to evaluate and adapt for your app. Prompt 1 includes the discovery and prerequisite checks because many builders will paste only the prompt. Prompt 2 helps you start covering the full agentic refund security map by identifying the non-package responsibilities and blockers before real money moves.

- [Prompt 1: Install the refund-policy gate](docs/INTEGRATION_GUIDE.md#prompt-1-install-the-refund-policy-gate)
- [Prompt 2: Complete the security map](docs/INTEGRATION_GUIDE.md#prompt-2-complete-the-security-map)

## Security categories to understand

Any unauthorized refund or refund fraud is a real problem from day one. Before agents can move money, every category needs a 100% owner.

| Category | Owner | Covered by refund-guard? |
|----------|-------|---------------------------|
| Tool access control | App/framework | No |
| Order scope and ownership | App | No |
| Authoritative refund facts | App/database/provider | No |
| Agent input boundary | `refund-guard` | Yes, 100% |
| Refund-policy enforcement | `refund-guard` | Yes, 100% |
| Provider invocation gate | `refund-guard` + app | Yes for denial gate; no for provider implementation |
| Provider execution safety | App/provider | No |
| State consistency and persistence | App/database | No |
| Evidence, exceptions, and human review | App/process | No |
| Auditability and accountability | App/process | No |
| Fraud, abuse, and compliance risk | App/process | No |

See the [Integration Guide](docs/INTEGRATION_GUIDE.md#the-mece-agentic-refund-security-map) for how vibe builders can solve the responsibilities this package does not cover.

## Install

```bash
pip install refund-guard            # Python
npm install @mattmessinger/refund-guard  # TypeScript / Node
```

## Quickstart

This is the safe copy-paste shape: resolve the order yourself, create a scoped tool, and let the agent supply only amount and reason.

```python
from refund_guard import Refunds

refunds = Refunds({"skus": {"shampoo": {"refund_window_days": 30}}})

order = load_order_for_current_user(order_id, current_user.id)

refund_tool = refunds.make_refund_tool(
    sku=order.sku,
    transaction_id=order.transaction_id,
    amount_paid_minor_units=order.amount_cents,  # library divides by 100
    amount_refunded_minor_units=order.refunded_cents,
    purchased_at=order.purchased_at,
    refunded_at=order.refunded_at,               # None = not yet refunded
    provider_refund_fn=my_existing_refund_fn,     # your Stripe / PayPal / Shopify call
)

result = refund_tool(reason="provider_cancelled")      # full remaining refund
result = refund_tool(50, reason="duplicate_charge")    # or partial refund
# {"status": "approved", "refunded_amount": 100.0, ...}
# {"status": "denied", "reason": "refund_window_expired", ...}
```

That's it. Call with no argument for a full refund, or pass an amount for a partial refund. Your provider function is only called if every check passes.

## What refund-guard enforces

Given trusted order data, `refund-guard` enforces these checks before your refund function runs:

- **Already refunded** -- if `refunded_at` is set, denied immediately
- **Refund window** -- still within `refund_window_days` for that SKU
- **Finite positive amount** -- must be a real number > 0
- **Amount cap** -- cannot exceed what was paid
- **Remaining balance** -- handles partial refunds (can't refund $60 twice on a $100 order)
- **Non-refundable SKUs** -- final-sale policies deny before the provider call
- **Allowed reasons** -- reason must match your policy enum if one is configured
- **Policy caps** -- optional max refund amount and manual-review threshold

If any check fails, your provider function is **never called** -- no money moves.

## What refund-guard does not decide

- Who the user is.
- Whether an order belongs to that user, session, ticket, tenant, or admin scope.
- Whether the stated refund reason is factually true.
- Whether your provider call is idempotent.
- Whether database state is fresh across services or processes.
- Whether the refund is fraud, chargeback, compliance, tax/accounting, or marketplace safe.

orderId is a lookup hint, not proof. If your agent supplies it, your app must resolve it through auth/session/ticket/tenant scope before creating the refund tool.

## TypeScript

```typescript
import { Refunds, DENIAL_MESSAGES } from "@mattmessinger/refund-guard";

const refunds = new Refunds({ skus: { shampoo: { refund_window_days: 30 } } });
const currentUser = await requireCurrentUser();
const order = await loadOrderForCurrentUser(orderId, currentUser.id);

const refund = refunds.makeRefundTool({
  sku: order.sku,
  transactionId: order.transactionId,
  amountPaidMinorUnits: order.amountCents,
  amountRefundedMinorUnits: order.refundedCents,
  purchasedAt: order.purchasedAt,
  refundedAt: order.refundedAt,
  providerRefundFn: myExistingRefundFn,
});

const result = await refund(undefined, { reason: "provider_cancelled" });
if (result.status !== "approved") {
  const message = DENIAL_MESSAGES[result.reason] ?? "Refund not allowed.";
  return { success: false, message };
}
return { success: true, amount: result.refunded_amount };
```

Both implementations follow the **same** behavior, enforced by [shared parity tests](contracts/parity/cases.json).

---

## API reference

### `Refunds(policy)`

| Param | Type | Notes |
|-------|------|-------|
| `policy` | YAML file path **or** plain object `{ skus: { sku_name: { refund_window_days: N } } }` | Loaded once; reuse the instance |

Optional SKU policy fields:

| Field | Type | Meaning |
|-------|------|---------|
| `refundable` | `boolean` | Set `false` for final-sale SKUs |
| `max_refund_minor_units` | `int` | Per-refund cap in cents/minor units |
| `manual_approval_required_over_minor_units` | `int` | Deny automated refunds above this amount |
| `allowed_reasons` | `string[]` | Allowed reason codes, checked when the tool is called |

### `make_refund_tool(**opts)` / `makeRefundTool(opts)`

| Option | Type | Required | Default |
|--------|------|----------|---------|
| `sku` | `string` | yes | -- |
| `transaction_id` / `transactionId` | `string` | yes | -- |
| `amount_paid` / `amountPaid` | `number` | one of these | -- |
| `amount_paid_minor_units` / `amountPaidMinorUnits` | `int` / `number` | one of these | -- |
| `amount_refunded` / `amountRefunded` | `number` | no | `0` |
| `amount_refunded_minor_units` / `amountRefundedMinorUnits` | `int` / `number` | no | `0` |
| `purchased_at` / `purchasedAt` | `datetime` / `Date` | yes | -- |
| `provider_refund_fn` / `providerRefundFn` | `(amount, txn_id, currency) -> any` | yes | -- |
| `refunded_at` / `refundedAt` | `datetime` / `Date` or `None`/`null` | no | `None` |
| `currency` | `string` | no | `"usd"` |
| `provider` | `string` | no | `"unknown"` |

Provide **one** of `amount_paid` (dollars) or `amount_paid_minor_units` (cents -- divided by 100 internally). Providing both raises an error. If the order has previous partial refunds, also pass `amount_refunded_minor_units` or `amount_refunded` from your database so a fresh per-request tool starts from the persisted remaining balance.

### The refund callable: `refund_tool(amount?)` / `await refund(amount?)`

| Call | Behavior |
|------|----------|
| `refund_tool(reason="provider_cancelled")` / `await refund(undefined, { reason })` | Full refund of the remaining balance (`amount_paid - amount_refunded`) |
| `refund_tool(50, reason="duplicate_charge")` / `await refund(50, { reason })` | Partial refund of $50 |

> **Important:** The library passes the validated amount to your `provider_refund_fn`. If your provider function ignores the amount parameter, the amount checks provide no protection. Always forward the amount to your payment API.

### `DENIAL_MESSAGES`

```python
from refund_guard import DENIAL_MESSAGES
# {"refund_window_expired": "The refund window for this order has closed.", ...}
```

A dict / `Record<string, string>` mapping every denial reason to a user-facing message.

### Result types

TypeScript exports `RefundResult`, `ApprovedRefundResult`, `DeniedRefundResult`, `ErrorRefundResult`, and `DenialReason` for autocomplete and status narrowing. Python exports matching `TypedDict` aliases for type checkers.

---

## Denial reasons

| `reason` | Meaning |
|----------|---------|
| `already_refunded` | `refunded_at` was set -- already refunded |
| `refund_window_expired` | Purchase older than the SKU's window |
| `amount_exceeds_limit` | Requested more than was paid |
| `amount_exceeds_remaining` | Not enough balance after partial refunds |
| `amount_exceeds_policy_max` | Requested more than the SKU policy allows |
| `invalid_amount` | Zero or negative |
| `not_refundable` | SKU policy has `refundable: false` |
| `refund_reason_not_allowed` | Reason was missing or not in `allowed_reasons` |
| `manual_approval_required` | Amount is above the automated refund threshold |
| `provider_error` | Your provider threw an exception |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Every refund denied as `amount_exceeds_limit` | You're passing cents to `amount_paid`. Use `amount_paid_minor_units` instead. |
| Every refund denied as `already_refunded` | You're passing a non-null `refunded_at`. This order is already refunded in your DB. |
| Partial refunds work once but not across requests | Pass `amount_refunded_minor_units` from your database each time you create the tool. |
| Refund denied as `refund_reason_not_allowed` | Pass a reason allowed by that SKU's `allowed_reasons` policy. |
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
Pass `refunded_at` for fully refunded orders and `amount_refunded_minor_units` for previous partial refunds. The library denies immediately if `refunded_at` is set and uses `amount_refunded_minor_units` to compute the remaining balance for fresh request-scoped tools.

**What data does the agent control?**
In the server-scoped pattern, only the refund amount and reason. If your agent supplies `orderId`, treat it as a lookup hint and resolve the order through your app's scope first. SKU, transaction ID, amount paid, amount already refunded, and purchase date all come from your database -- never from the agent.

**Is this safe?**
It covers a narrow set of safety responsibilities, not the whole system. Your app owns auth and scoped order lookup. `refund-guard` owns the agent input boundary, refund-policy checks, and the no-provider-call-on-denial gate. Your provider and persistence layer own money movement, retries, and records.

**How do I enable logging? (Python)**
```python
import logging
logging.basicConfig()
logging.getLogger("refund_guard").setLevel(logging.INFO)
```

**What do I tell my AI agent about refund policy?**
The library enforces hard limits (window, amount, balance). Your agent's system prompt should encode *when* to offer refunds. See the [Integration Guide](docs/INTEGRATION_GUIDE.md#update-your-ai-agents-system-prompt).

**I'm wiring this into a real app with a database and Stripe. Where do I start?**
Read the [Integration Guide](docs/INTEGRATION_GUIDE.md) -- a walkthrough based on actual production usage.

**I'm building with OpenAI, Vercel AI SDK, LangChain, or MCP. Where are the agent examples?**
Start with [Agentic refund flow recipes](docs/AGENTIC_REFUND_FLOWS.md).

**Can I test my policy before touching Stripe?**
Yes. Run the policy doctor with fake provider calls:

```bash
refund-guard doctor examples/doctor/policy.yaml examples/doctor/scenarios.json
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, and PR guidelines.

Both languages run the **same 26 test scenarios** from [`contracts/parity/cases.json`](contracts/parity/cases.json). If you change behavior in one language, the shared tests catch the drift.

---

## License

MIT
