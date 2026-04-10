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

  console.log("1) Partial refund (should approve $60):");
  console.log(await refund(60));

  console.log("\n2) No amount refunds the remaining balance (should approve $40):");
  console.log(await refund());

  console.log("\n3) No remaining balance (should deny as invalid_amount):");
  console.log(await refund());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
