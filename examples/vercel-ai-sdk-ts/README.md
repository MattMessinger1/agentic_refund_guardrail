# Vercel AI SDK example

Use this pattern when your refund flow lives in a Next.js route.

This is an adapter example: it shows where `refund-guard` fits inside a Vercel AI SDK `tool({ inputSchema, execute })` route. The framework can change; the safety shape should not.

- **What it demonstrates:** a Next.js route where server code resolves a scoped order first, then the AI SDK tool gets only `amount` and `reason`.
- **Copy this if:** you are vibe-coding an AI support route with Vercel AI SDK.
- **What it does not handle:** real database functions, real auth, provider credentials, or production refund persistence.

This covers the agent input boundary and refund-policy gate, not the whole MECE security map.

The model can call `refundOrder` with:

- `amount`: a positive number, or `null` for full remaining balance
- `reason`: one of your allowed business reasons

Everything else comes from your database and `refund-guard`.

The route-level `orderId` is a lookup hint. Replace `requireUser` and `loadOrderForCurrentUser` with your app's actual auth and scoped order lookup.
