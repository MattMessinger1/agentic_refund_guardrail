# Real-world integration pattern

This is a **reference pattern**, not a runnable example. It shows the complete integration flow based on actual production usage.

- **What it demonstrates:** the full server-side shape: load order truth, create a scoped tool, validate policy, call your provider, and map denial messages.
- **Copy this if:** you are wiring `refund-guard` into a TypeScript backend with a database and payment provider.
- **What it does not handle:** framework-specific routing, provider credentials, auth, or database transaction code.

Read `handler.ts` for an annotated walkthrough of every step:

1. Create the guard (module-level singleton, inline policy)
2. Fetch order data from your database
3. Create the guarded tool with `amountPaidMinorUnits`, `amountRefundedMinorUnits`, and `refundedAt` (the library handles cent conversion, partial-refund balance, and double-refund detection)
4. Call the tool -- no amount for a full remaining refund, or pass an amount for a partial refund, with a policy reason
5. Map results using `DENIAL_MESSAGES`

For the full context behind each step, see [docs/INTEGRATION_GUIDE.md](../../docs/INTEGRATION_GUIDE.md).

## Want something that actually runs?

- [examples/minimal-python/](../minimal-python/) -- Python, fake provider, runs instantly
- [examples/minimal-ts/](../minimal-ts/) -- TypeScript, fake provider, runs after building the package
