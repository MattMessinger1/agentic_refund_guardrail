# refund-guard

**Start here:** [Step-by-step guide](docs/STEP_BY_STEP.md) · [Contributing](CONTRIBUTING.md) · [Report an issue](https://github.com/MattMessinger1/agentic_refund_guardrail/issues/new/choose)

**A small library** that turns **one real order** into **one safe refund function** for your AI agent — so the agent can only refund what your policy allows (window, amount cap, remaining balance).

> **New here?** Read [docs/STEP_BY_STEP.md](docs/STEP_BY_STEP.md) first, then come back for details.

---

## Read this first (1 minute)

| Question | Answer |
|----------|--------|
| Is this a hosted API or SaaS? | **No.** It is a **package** you install (`pip` / `npm`) in **your** server code. |
| Does it run on my phone? | **Not inside the app.** Your mobile app calls **your backend**; the backend runs this library. |
| Do I need Python *and* TypeScript? | **No.** Pick **one** — whatever your backend uses. |
| What does it actually do? | Wraps **your** existing Stripe (or other) refund call with **policy checks** before money moves. |

---

## The idea in one picture

```text
Your database loads the real order (SKU, txn id, amount, date)
        │
        ▼
  refund-guard: make_refund_tool(...)   ← closes over that order
        │
        ▼
  Agent / user only chooses HOW MUCH to refund (within rules)
        │
        ▼
  validate → then your Stripe/refund code runs
```

The agent should **not** pass transaction IDs or “what was paid” — your app does.

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

Both implementations follow the **same** behavior. Shared tests live in [`contracts/parity/cases.json`](contracts/parity/cases.json). Publishing both under one version line is described in [RELEASING.md](RELEASING.md).

---

## Tutorial (5 minutes)

### 1. Create a policy file

`refund_policy.yaml`:

```yaml
skus:
  digital_course:
    refund_window_days: 7
  shampoo:
    refund_window_days: 30
```

### 2. Implement your refund (you already have this)

This is whatever you use today to hit Stripe / PayPal / your API.

### 3. Wire refund-guard

Pick **one** path below.

---

### Python (full example)

```python
from datetime import datetime
from refund_guard import Refunds

refunds = Refunds("refund_policy.yaml")

# Load order from YOUR database — not from the model
order = get_order_from_db(order_id)

def my_stripe_refund(amount: float, transaction_id: str, currency: str):
    return stripe.Refund.create(
        payment_intent=transaction_id,
        amount=int(amount * 100),
    )

refund_tool = refunds.make_refund_tool(
    sku=order.sku,
    transaction_id=order.transaction_id,
    amount_paid=order.amount_paid,
    purchased_at=order.purchased_at,
    provider_refund_fn=my_stripe_refund,
)

# Only this callable is exposed to the agent / tool layer
result = refund_tool(80.00)
print(result)
```

---

### TypeScript (full example)

Put this in an **async** route or handler (Express, Next.js API route, etc.):

```typescript
import { Refunds } from "@mattmessinger/refund-guard";

const refunds = new Refunds("refund_policy.yaml");

const order = await loadOrderFromDb(orderId); // your code

const refund = refunds.makeRefundTool({
  sku: order.sku,
  transactionId: order.transactionId,
  amountPaid: order.amountPaid,
  purchasedAt: order.purchasedAt,
  providerRefundFn: (amount, transactionId, currency) =>
    stripe.refunds.create({
      payment_intent: transactionId,
      amount: Math.round(amount * 100),
      currency,
    }),
});

const result = await refund(80.0);
console.log(result);
```

- The returned function is **async** — use `await`.
- `providerRefundFn` may return a **Promise** (Stripe’s Node client) or a plain value.

**Tests only:** you can pass `nowFn` (Python: `now_fn`) to freeze “today” for deterministic tests. Omit in production.

---

## What you get back

**Approved**

```json
{"status": "approved", "refunded_amount": 80.0, "transaction_id": "pi_abc123"}
```

**Denied** (policy blocked — your refund function was **not** called)

```json
{"status": "denied", "reason": "amount_exceeds_limit", "requested": 200.0, "max_allowed": 120.0}
```

**Provider error** (Stripe threw, etc.)

```json
{"status": "error", "reason": "provider_error", "detail": "No such payment_intent: pi_xxx"}
```

---

## What it checks (in order)

1. **Refund window** — still within `refund_window_days` for that SKU  
2. **Positive amount** — must be &gt; 0  
3. **Amount cap** — cannot exceed what was paid on this order  
4. **Remaining balance** — after partial refunds, cannot exceed what’s left  

If any check fails, **your provider function is never called.**

---

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| `SKU 'x' not found in policy` | Add that SKU under `skus:` in your YAML, or fix the SKU string from your DB. |
| TypeScript: `Cannot find module` | Run `npm install @mattmessinger/refund-guard` in **your** project folder (where `package.json` lives). |
| TypeScript: forgot `await` | The refund callable is **async** — use `const r = await refund(10)`. |
| Policy file not found | Pass an **absolute path** to `Refunds("C:/path/to/refund_policy.yaml")` or run your server from the directory that contains the file. |
| Denied: `refund_window_expired` | Expected if the purchase is too old for that SKU’s window. |
| Works on my laptop but not in production | Check the policy file is deployed with the app and paths match. |

---

## Security model (short)

| Layer | Role |
|-------|------|
| Stripe / PayPal / Shopify | Money + payment truth |
| **Your app** | Order truth (SKU, ids, amounts, dates) |
| **Agent / chat** | Untrusted — only chooses refund amount inside the tool |

---

## How this differs from “agent guardrail” products

Tools like [Veto](https://veto.so/), [PolicyLayer](https://policylayer.com/), or [Kvlar](https://github.com/nichochar/kvlar) often answer: *should this tool run at all?*

**refund-guard** answers: *for **this** order and **this** amount, does our **business policy** allow it?*  
Use both if you want: one for coarse control, this for refund math and windows.

---

## Works with any provider function

Same signature everywhere:

`provider_refund_fn(amount, transaction_id, currency)`

Examples: Stripe, PayPal, Shopify, your own HTTP API.

---

## Logging (Python)

```python
import logging
logging.basicConfig()
logging.getLogger("refund_guard").setLevel(logging.INFO)
```

Logs go to the `refund_guard` logger (JSON-friendly lines).

---

## Develop / clone this repo

```bash
git clone https://github.com/MattMessinger1/agentic_refund_guardrail.git
cd agentic_refund_guardrail

# Python tests
pip install -e ".[dev]"
pytest

# TypeScript tests
cd packages/refund-guard-ts
npm ci
npm test
```

CI runs both; see [.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## FAQ

**Why not trust the agent with Stripe IDs?**  
Models mix up amounts and ids. This library binds the tool to **one** order your server loaded.

**Does this replace Stripe?**  
No. It sits **in front of** your existing refund code.

**Why Python and TypeScript in one repo?**  
So pip users and npm users get the **same behavior** — locked by shared tests, not by vibes.

**Where do I ask questions?**  
Use [Issues → New issue](https://github.com/MattMessinger1/agentic_refund_guardrail/issues/new/choose) (Question template). Maintainers: [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md) for About box, topics, branch protection.

---

## License

MIT
