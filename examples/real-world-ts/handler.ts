/**
 * Real-world integration pattern — annotated reference.
 *
 * This is NOT a runnable example. It shows the complete pattern you'll
 * follow when wiring refund-guard into a real backend with a database
 * and a payment provider. For runnable examples, see ../minimal-ts/.
 *
 * Based on actual dogfooding in a production MCP server with Supabase + Stripe.
 */

import { Refunds } from "@mattmessinger/refund-guard";

// ─── 1. Create the guard once (module-level singleton) ───────────────
//
// You can pass a YAML file path OR a plain object. Inline is simpler
// when you have a single product / SKU.

const refundGuard = new Refunds({
  skus: {
    success_fee: { refund_window_days: 90 },
    // Add more SKUs as needed:
    // premium_plan: { refund_window_days: 30 },
  },
});

// ─── 2. Per-request handler ──────────────────────────────────────────
//
// This function is what your route handler, MCP tool, or API endpoint calls.

export async function handleRefund(chargeId: string, reason: string) {
  // ─── 2a. Fetch order data from YOUR database ────────────────────
  //
  // The library never queries your DB. You provide the fields it needs.
  // Replace this with your ORM (Prisma, Drizzle, Supabase, raw SQL, etc.)

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

  // ─── 2b. Check refunded_at YOURSELF ─────────────────────────────
  //
  // The library's "remaining balance" check only works within one
  // makeRefundTool instance (one request). Across HTTP requests,
  // totalRefunded resets to 0. Your database is the real guard
  // against double refunds.

  if (charge.refunded_at) {
    return { success: false, error: "Already refunded" };
  }

  // ─── 2c. Convert cents → dollars ────────────────────────────────
  //
  // Stripe stores amounts in cents (2000 = $20.00).
  // refund-guard works in the currency's major unit (dollars).

  const amountDollars = charge.amount_cents / 100;

  // ─── 2d. Create the guarded refund tool ─────────────────────────
  //
  // providerRefundFn doesn't have to call Stripe directly.
  // In our case it calls a Supabase Edge Function. The only
  // requirement is the signature: (amount, txnId, currency) => any.
  //
  // We ignore the params here because our edge function already
  // knows the charge from the charge_id. That's fine.

  const refund = refundGuard.makeRefundTool({
    sku: "success_fee",
    transactionId: charge.stripe_payment_intent,
    amountPaid: amountDollars,
    purchasedAt: new Date(charge.charged_at),
    provider: "stripe",
    providerRefundFn: async (_amount, _txnId, _currency) => {
      // Replace with YOUR actual refund call:
      // - stripe.refunds.create(...)
      // - supabase.functions.invoke(...)
      // - fetch("https://your-api.com/refund", ...)
      const result = await yourRefundFunction(chargeId, reason);
      if (!result.success) throw new Error(result.error);
      return result;
    },
  });

  // ─── 2e. Call and map results ───────────────────────────────────

  const result = await refund(amountDollars);

  if (result.status === "denied") {
    const messages: Record<string, string> = {
      refund_window_expired: "The refund window has expired.",
      amount_exceeds_limit: "Refund exceeds the original charge.",
      amount_exceeds_remaining: "Already partially refunded.",
      invalid_amount: "Invalid refund amount.",
    };
    return {
      success: false,
      error: messages[result.reason as string] ?? "Refund not allowed.",
    };
  }

  if (result.status === "error") {
    return { success: false, error: "Refund failed. Contact support." };
  }

  // status === "approved"
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
