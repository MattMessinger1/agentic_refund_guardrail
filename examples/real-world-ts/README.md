# Real-world integration pattern

This is a **reference pattern**, not a runnable example. It shows the complete integration flow based on actual production usage.

Read `handler.ts` for an annotated walkthrough of every step:

1. Create the guard (module-level singleton, inline policy)
2. Fetch order data from your database
3. Check `refunded_at` yourself (the library can't do this across requests)
4. Convert cents to dollars
5. Wrap your provider function (doesn't have to call Stripe directly)
6. Map results (`approved` / `denied` / `error`) to your app's error format

For the full context behind each step, see [docs/INTEGRATION_GUIDE.md](../../docs/INTEGRATION_GUIDE.md).

## Want something that actually runs?

- [examples/minimal-python/](../minimal-python/) — Python, fake provider, runs instantly
- [examples/minimal-ts/](../minimal-ts/) — TypeScript, fake provider, runs after building the package
