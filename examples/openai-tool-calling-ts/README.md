# OpenAI tool-calling example

This shows the safe shape for an OpenAI Responses API refund flow:

1. Your server resolves the order through current user, ticket, or backend scope.
2. The model can only call `refund_order` with `amount` and `reason`.
3. `refund-guard` supplies SKU, transaction ID, paid amount, refunded amount, and purchase date from server state.
4. The payment provider is called only after validation passes.

This is an adapter example: it shows where `refund-guard` fits inside a raw Responses API function/tool-calling handler. The framework can change; the safety shape should not.

- **What it demonstrates:** OpenAI tool calling where the model supplies only `amount` and `reason`, after your server has resolved the scoped order.
- **Copy this if:** you are using the OpenAI SDK directly instead of a higher-level agent framework.
- **What it does not handle:** real database functions, real Stripe setup, real auth, or production refund persistence.

This covers the agent input boundary and refund-policy gate, not the whole MECE security map.

The handler is intentionally annotated. Replace the declared auth, database, and Stripe functions with your app's real code. `orderId` is route/server context in this example, not a model tool argument.
