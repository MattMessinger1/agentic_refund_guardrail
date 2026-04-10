# OpenAI tool-calling example

This shows the safe shape for an OpenAI Responses API refund flow:

1. Your server loads the order from the database.
2. The model can only call `refund_order` with `amount` and `reason`.
3. `refund-guard` supplies SKU, transaction ID, paid amount, refunded amount, and purchase date from server state.
4. The payment provider is called only after validation passes.

The handler is intentionally annotated. Replace the declared database and Stripe functions with your app's real code.
