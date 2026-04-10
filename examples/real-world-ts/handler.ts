/**
 * Real-world integration pattern -- annotated reference.
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
    success_fee: {
      refund_window_days: 90,
      allowed_reasons: ["booking_cancelled", "duplicate_charge", "technical_error"],
      manual_approval_required_over_minor_units: 5000,
    },
  },
});

// ─── 2. Per-request handler ──────────────────────────────────────────

export async function handleRefund(chargeId: string, reason: string) {
  // ─── 2a. Fetch order data from YOUR database ────────────────────

  const charge = await db.charges.findUnique({
    where: { id: chargeId },
    select: {
      id: true,
      stripe_payment_intent: true,
      amount_cents: true,
      refunded_cents: true,
      charged_at: true,
      refunded_at: true,
    },
  });

  if (!charge) {
    return { success: false, error: "Charge not found" };
  }

  // ─── 2b. Create the guarded refund tool ─────────────────────────
  //
  // amountPaidMinorUnits: pass cents directly -- library divides by 100
  // amountRefundedMinorUnits: pass prior partial refunds from your DB
  // refundedAt: pass your DB's full-refund timestamp -- library blocks double-refunds
  //
  // IMPORTANT: providerRefundFn receives the validated amount from the guard.
  // Always forward it to your payment API. If you ignore it, the guard's
  // amount validation provides no protection.

  const refund = refundGuard.makeRefundTool({
    sku: "success_fee",
    transactionId: charge.stripe_payment_intent,
    amountPaidMinorUnits: charge.amount_cents,
    amountRefundedMinorUnits: charge.refunded_cents ?? 0,
    purchasedAt: new Date(charge.charged_at),
    refundedAt: charge.refunded_at ? new Date(charge.refunded_at) : null,
    provider: "stripe",
    providerRefundFn: async (amount, txnId, currency) => {
      const amountCents = Math.round(amount * 100);
      const result = await yourRefundFunction(chargeId, amountCents, reason);
      if (!result.success) throw new Error(result.error);
      return result;
    },
  });

  // ─── 2c. Call and map results ───────────────────────────────────
  //
  // No argument = full refund of the remaining balance.
  // Pass an amount for partial refunds: await refund(50.00)

  const result = await refund(undefined, { reason });

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
  amountCents: number,
  reason: string,
): Promise<{ success: boolean; error?: string; refund_id?: string }>;
