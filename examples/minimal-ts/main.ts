/**
 * Minimal runnable example — no Stripe, no secrets.
 *
 * From the repository root:
 *   cd packages/refund-guard-ts && npm run build && cd ../../examples/minimal-ts
 *   npm install
 *   npm start
 */

import { Refunds } from "@mattmessinger/refund-guard";

const policy = {
  skus: {
    demo: { refund_window_days: 30 },
  },
};

async function fakeProvider(
  amount: number,
  transactionId: string,
  currency: string,
): Promise<Record<string, unknown>> {
  console.log(
    `  [fake provider] refund ${amount} ${currency.toUpperCase()} for ${transactionId}`,
  );
  return { status: "succeeded", fake: true };
}

async function main(): Promise<void> {
  const refunds = new Refunds(policy);
  const purchasedAt = new Date();

  const refund = refunds.makeRefundTool({
    sku: "demo",
    transactionId: "pi_demo_001",
    amountPaid: 100,
    purchasedAt,
    providerRefundFn: fakeProvider,
  });

  console.log("1) Full refund, no amount (should approve $100):");
  console.log(await refund());

  console.log("\n2) Another full refund (should deny — already refunded):");
  console.log(await refund());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
