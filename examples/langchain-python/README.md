# LangChain Python example

Wrap `refund-guard` inside a LangChain tool so the model can ask for a refund without controlling trusted payment fields.

- **What it demonstrates:** a LangChain tool where the model supplies `order_id`, `amount`, and `reason`, while the tool body resolves the order through the current actor before calling `refund-guard`.
- **Copy this if:** your Python agent uses LangChain tools and can trigger refunds from a backend.
- **What it does not handle:** real database access, real Stripe calls, auth checks, or idempotency storage.

`order_id` remains realistic for LangChain, but order scope and ownership are app-owned responsibilities that must pass before `refund-guard` runs.

The model sees:

- `order_id`
- `amount`
- `reason`

`order_id` is a lookup hint, not trusted refund data. The tool body must resolve it through user, ticket, tenant, or actor scope before loading amount paid, amount already refunded, transaction ID, SKU, and purchase date from your database.
