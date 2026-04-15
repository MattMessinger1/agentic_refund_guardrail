# Minimal TypeScript example

Uses the **local** package via `file:../../packages/refund-guard-ts` (works after clone — no npm.org publish required).

- **What it demonstrates:** the smallest TypeScript flow: create a scoped tool, pass allowed reason codes, refund part of the balance, refund the rest, then deny a missing reason before the provider is called.
- **Copy this if:** you want to see the core async API without agent frameworks, databases, or payment SDKs.
- **What it does not handle:** real order loading, real provider calls, auth, or cross-request persistence.

## Run

From the **repository root**:

```bash
cd packages/refund-guard-ts
npm ci
npm run build
cd ../../examples/minimal-ts
npm install
npm start
```

You should see two **approved** results, then one **denied** result for `refund_reason_not_allowed`.

In a real app, install from npm with `npm install @mattmessinger/refund-guard`.
