/**
 * Vercel AI SDK route pattern.
 *
 * The model supplies only amount + reason. Your route resolves the scoped order
 * and supplies all trusted order truth.
 */

import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";
import { DENIAL_MESSAGES, Refunds } from "@mattmessinger/refund-guard";

const refundGuard = new Refunds({
  skus: {
    success_fee: {
      refund_window_days: 90,
      allowed_reasons: ["provider_cancelled", "duplicate_charge", "technical_error"],
    },
  },
});

export async function POST(req: Request) {
  const { orderId, message } = (await req.json()) as {
    orderId: string;
    message: string;
  };
  const currentUser = await requireUser(req);
  // orderId is a lookup hint, not trusted refund data.
  const order = await loadOrderForCurrentUser(orderId, currentUser.id);
  if (order == null) {
    return Response.json(
      { error: "Order not found or not refundable by this user." },
      { status: 404 },
    );
  }

  const { text } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-5.4-mini"),
    system:
      "You may refund only by using the refundOrder tool. Never invent order IDs, transaction IDs, amounts paid, or dates.",
    prompt: message,
    tools: {
      refundOrder: tool({
        description: "Refund the server-scoped order if refund-guard approves it.",
        inputSchema: z.object({
          amount: z.number().positive().nullable(),
          reason: z.enum([
            "provider_cancelled",
            "duplicate_charge",
            "technical_error",
          ]),
        }),
        execute: async ({ amount, reason }) =>
          refundOrderWithGuard(order, amount, reason),
      }),
    },
  });

  return Response.json({ text });
}

async function refundOrderWithGuard(
  order: Order,
  amount: number | null,
  reason: string,
) {
  const refund = refundGuard.makeRefundTool({
    sku: order.sku,
    transactionId: order.paymentIntentId,
    amountPaidMinorUnits: order.amountPaidCents,
    amountRefundedMinorUnits: order.amountRefundedCents,
    purchasedAt: new Date(order.purchasedAt),
    refundedAt: order.refundedAt ? new Date(order.refundedAt) : null,
    provider: "stripe",
    providerRefundFn: async (validatedAmount) => {
      const amountCents = Math.round(validatedAmount * 100);
      return createStripeRefund({
        paymentIntentId: order.paymentIntentId,
        amountCents,
        idempotencyKey: `refund:${order.id}:${amountCents}:${reason}`,
      });
    },
  });

  const result =
    amount == null
      ? await refund(undefined, { reason })
      : await refund(amount, { reason });

  return result.status === "approved"
    ? { success: true, amount: result.refunded_amount }
    : {
        success: false,
        code: result.reason,
        message: DENIAL_MESSAGES[result.reason] ?? "Refund not allowed.",
      };
}

type Order = {
  id: string;
  sku: "success_fee";
  paymentIntentId: string;
  amountPaidCents: number;
  amountRefundedCents: number;
  purchasedAt: string;
  refundedAt: string | null;
};

type AuthenticatedUser = {
  id: string;
};

declare function requireUser(req: Request): Promise<AuthenticatedUser>;
declare function loadOrderForCurrentUser(
  orderId: string,
  userId: string,
): Promise<Order | null>;
declare function createStripeRefund(input: {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<Record<string, unknown>>;
