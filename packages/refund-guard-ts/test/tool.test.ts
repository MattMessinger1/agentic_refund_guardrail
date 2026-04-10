import { beforeAll, describe, expect, it, vi } from "vitest";
import { Refunds } from "../src/index.js";

describe("RefundTool safety", () => {
  beforeAll(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("denies NaN without calling the provider", async () => {
    const provider = vi.fn();
    const refund = new Refunds({
      skus: { demo: { refund_window_days: 30 } },
    }).makeRefundTool({
      sku: "demo",
      transactionId: "pi_nan",
      amountPaid: 100,
      purchasedAt: new Date(),
      providerRefundFn: provider,
    });

    const result = await refund(Number.NaN);
    expect(result.status).toBe("denied");
    expect(result.reason).toBe("invalid_amount");
    expect(provider).not.toHaveBeenCalled();
  });

  it("serializes concurrent calls against the same in-memory balance", async () => {
    const calls: number[] = [];
    const refund = new Refunds({
      skus: { demo: { refund_window_days: 30 } },
    }).makeRefundTool({
      sku: "demo",
      transactionId: "pi_concurrent",
      amountPaid: 100,
      purchasedAt: new Date(),
      providerRefundFn: async (amount) => {
        calls.push(amount);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { ok: true };
      },
    });

    const results = await Promise.all([refund(60), refund(60)]);
    expect(results[0].status).toBe("approved");
    expect(results[1].status).toBe("denied");
    expect(results[1].reason).toBe("amount_exceeds_remaining");
    expect(calls).toEqual([60]);
  });

  it("rejects invalid configured paid amounts", () => {
    const refunds = new Refunds({
      skus: { demo: { refund_window_days: 30 } },
    });
    expect(() =>
      refunds.makeRefundTool({
        sku: "demo",
        transactionId: "pi_bad",
        amountPaid: Number.POSITIVE_INFINITY,
        purchasedAt: new Date(),
        providerRefundFn: () => ({}),
      }),
    ).toThrow("finite");
  });
});
