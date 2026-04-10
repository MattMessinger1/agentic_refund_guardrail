# LangChain Python example

Wrap `refund-guard` inside a LangChain tool so the model can ask for a refund without controlling trusted payment fields.

- **What it demonstrates:** a LangChain tool where the model supplies `order_id`, `amount`, and `reason`, while the tool body loads order truth before calling `refund-guard`.
- **Copy this if:** your Python agent uses LangChain tools and can trigger refunds from a backend.
- **What it does not handle:** real database access, real Stripe calls, auth checks, or idempotency storage.

The model sees:

- `order_id`
- `amount`
- `reason`

The tool body loads amount paid, amount already refunded, transaction ID, SKU, and purchase date from your database.
