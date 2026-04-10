/**
 * MCP server pattern.
 *
 * Expose a refund tool to MCP clients while keeping order truth on the server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

const server = new McpServer({
  name: "refund-tools",
  version: "0.1.0",
});

server.registerTool(
  "refund_order",
  {
    title: "Refund Order",
    description: "Refund a server-scoped order if refund-guard approves it.",
    inputSchema: {
      orderId: z.string(),
      amount: z.number().positive().nullable(),
      reason: z.enum([
        "provider_cancelled",
        "duplicate_charge",
        "technical_error",
      ]),
    },
  },
  async ({ orderId, amount, reason }) => {
    const order = await loadOrderFromDb(orderId);
    const result = await refundOrderWithGuard(order, amount, reason);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
    };
  },
);

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
    providerRefundFn: async (validatedAmount) =>
      createStripeRefund({
        paymentIntentId: order.paymentIntentId,
        amountCents: Math.round(validatedAmount * 100),
        idempotencyKey: `refund:${order.id}:${reason}`,
      }),
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

declare function loadOrderFromDb(orderId: string): Promise<Order>;
declare function createStripeRefund(input: {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<Record<string, unknown>>;

await server.connect(new StdioServerTransport());
