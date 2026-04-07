/**
 * Real-world integration pattern — annotated reference.
 *
 * This is NOT a runnable example. It shows the complete pattern you'll
 * follow when wiring refund-guard into a real backend with a database
 * and a payment provider. For runnable examples, see ../minimal-ts/.
 *
 * Based on actual dogfooding in a production MCP server with Supabase + Stripe.
 */

import { Refunds, DENIAL_MESSAGES } from "@mattmessinger/refund-guard";

// ─── 1. Create the guard once (module-level singleton) ───────────────

const refundGuard = new Refunds({
  skus: {
    success_fee: { refund_window_days: 90 },
  },
});

// ─── 2. Per-request handler ──────────────────────────────────────────

export async function handleRefund(chargeId: string, reason: string) {
  // ─── 2a. Fetch order data from YOUR database ────────────────────
  //
  // The library never queries your DB. You provide the fields it needs.

  const charge = await db.charges.findUnique({
    where: { id: chargeId },
    select: {
      id: true,
      stripe_payment_intent: true,
      amount_cents: true,
      charged_at: true,
      refunded_at: true,
    },
  });

  if (!charge) {
    return { success: false, error: "Charge not found" };
  }

  // ─── 2b. Create the guarded refund tool ─────────────────────────
  //
  // amountPaidMinorUnits: pass cents directly — library divides by 100
  // refundedAt: pass your DB's refund timestamp — library blocks double-refunds
  //
  // providerRefundFn doesn't have to call Stripe directly.
  // In our case it calls a Supabase Edge Function. The only
  // requirement is the signature: (amount, txnId, currency) => any.

  const refund = refundGuard.makeRefundTool({
    sku: "success_fee",
    transactionId: charge.stripe_payment_intent,
    amountPaidMinorUnits: charge.amount_cents,
    purchasedAt: new Date(charge.charged_at),
    refundedAt: charge.refunded_at ? new Date(charge.refunded_at) : null,
    provider: "stripe",
    providerRefundFn: async (_amount, _txnId, _currency) => {
      const result = await yourRefundFunction(chargeId, reason);
      if (!result.success) throw new Error(result.error);
      return result;
    },
  });

  // ─── 2c. Call and map results ───────────────────────────────────

  const amountDollars = charge.amount_cents / 100;
  const result = await refund(amountDollars);

  if (result.status === "denied" || result.status === "error") {
    return {
      success: false,
      error: DENIAL_MESSAGES[result.reason as string] ?? "Refund not allowed.",
    };
  }

  const providerData = result.provider_result as Record<string, unknown>;
  return {
    success: true,
    refund_id: providerData?.refund_id,
    amount: result.refunded_amount,
  };
}

// ─── Stub types (replace with your actual imports) ───────────────────

declare const db: any;
declare function yourRefundFunction(
  chargeId: string,
  reason: string,
): Promise<{ success: boolean; error?: string; refund_id?: string }>;
