# Vercel AI SDK example

Use this pattern when your refund flow lives in a Next.js route.

The model can call `refundOrder` with:

- `amount`: a positive number, or `null` for full remaining balance
- `reason`: one of your allowed business reasons

Everything else comes from your database and `refund-guard`.
