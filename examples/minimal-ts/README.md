# Minimal TypeScript example

Uses the **local** package via `file:../../packages/refund-guard-ts` (works after clone — no npm.org publish required).

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

You should see one **approved** result and one **denied** result.

When `@mattmessinger/refund-guard` is published to npm, you can instead `npm install @mattmessinger/refund-guard` and import from there.
