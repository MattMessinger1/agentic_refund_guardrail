/**
 * MCP server pattern.
 *
 * Expose a refund tool to MCP clients while keeping order truth on the server.
 * orderId is a lookup hint, not trusted refund data.
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
    const actor = await getAuthorizedActorForMcpSession();
    const order = await loadOrderForAuthorizedActor(orderId, actor);
    if (order == null) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              code: "order_not_found",
              message: "Order not found or not refundable by this actor.",
            }),
          },
        ],
      };
    }

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

type AuthorizedActor = {
  id: string;
  tenantId?: string;
};

declare function getAuthorizedActorForMcpSession(): Promise<AuthorizedActor>;
declare function loadOrderForAuthorizedActor(
  orderId: string,
  actor: AuthorizedActor,
): Promise<Order | null>;
declare function createStripeRefund(input: {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<Record<string, unknown>>;

await server.connect(new StdioServerTransport());
