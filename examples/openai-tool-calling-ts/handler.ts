/**
 * OpenAI Responses API tool-calling pattern.
 *
 * This is an annotated reference, not a drop-in route. Replace the database
 * and payment provider functions with your app's real code.
 */

import OpenAI from "openai";
import { DENIAL_MESSAGES, Refunds } from "@mattmessinger/refund-guard";

const openai = new OpenAI();
const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

const refundGuard = new Refunds({
  skus: {
    success_fee: {
      refund_window_days: 90,
      allowed_reasons: ["provider_cancelled", "duplicate_charge", "technical_error"],
      manual_approval_required_over_minor_units: 5000,
    },
  },
});

const tools = [
  {
    type: "function" as const,
    name: "refund_order",
    description: "Refund this server-scoped order if refund-guard approves it.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        amount: {
          type: ["number", "null"],
          description: "Refund amount in major units. Null means full remaining balance.",
        },
        reason: {
          type: "string",
          enum: ["provider_cancelled", "duplicate_charge", "technical_error"],
        },
      },
      required: ["amount", "reason"],
    },
  },
];

export async function answerRefundRequest(orderId: string, userMessage: string) {
  const order = await loadOrderFromDb(orderId);

  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "You may request a refund only by calling refund_order. Never invent order IDs, transaction IDs, amounts paid, or purchase dates.",
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    tools,
  });

  const toolCall = response.output.find(
    (item) => item.type === "function_call" && item.name === "refund_order",
  );
  if (!toolCall || toolCall.type !== "function_call") {
    return response.output_text;
  }

  const args = JSON.parse(toolCall.arguments) as {
    amount: number | null;
    reason: string;
  };
  const result = await refundOrderWithGuard(order, args.amount, args.reason);

  const finalResponse = await openai.responses.create({
    model,
    previous_response_id: response.id,
    input: [
      {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: JSON.stringify(result),
      },
    ],
  });

  return finalResponse.output_text;
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
        reason,
        idempotencyKey: `refund:${order.id}:${amountCents}:${reason}`,
      });
    },
  });

  const result =
    amount == null
      ? await refund(undefined, { reason })
      : await refund(amount, { reason });

  if (result.status === "approved") {
    return {
      success: true,
      amount: result.refunded_amount,
      provider: result.provider_result,
    };
  }

  return {
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

declare function loadOrderFromDb(orderId: string): Promise<Order>;
declare function createStripeRefund(input: {
  paymentIntentId: string;
  amountCents: number;
  reason: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>>;
