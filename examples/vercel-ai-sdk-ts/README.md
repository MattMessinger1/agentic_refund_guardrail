# Vercel AI SDK example

Use this pattern when your refund flow lives in a Next.js route.

This is an adapter example: it shows where `refund-guard` fits inside a Vercel AI SDK `tool({ inputSchema, execute })` route. The framework can change; the safety shape should not.

- **What it demonstrates:** a Next.js route where the AI SDK tool gets `amount` and `reason`, then server code loads order truth before calling `refund-guard`.
- **Copy this if:** you are vibe-coding an AI support route with Vercel AI SDK.
- **What it does not handle:** real database functions, auth, provider credentials, or production refund persistence.

The model can call `refundOrder` with:

- `amount`: a positive number, or `null` for full remaining balance
- `reason`: one of your allowed business reasons

Everything else comes from your database and `refund-guard`.
