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

  it("passes approved refund reasons through the async tool options", async () => {
    const provider = vi.fn().mockResolvedValue({ ok: true });
    const refund = new Refunds({
      skus: {
        demo: {
          refund_window_days: 30,
          allowed_reasons: ["booking_cancelled"],
        },
      },
    }).makeRefundTool({
      sku: "demo",
      transactionId: "pi_reason_ok",
      amountPaidMinorUnits: 2000,
      purchasedAt: new Date(),
      providerRefundFn: provider,
    });

    const result = await refund(undefined, { reason: "booking_cancelled" });

    expect(result.status).toBe("approved");
    expect(result.reason).toBe("booking_cancelled");
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith(20, "pi_reason_ok", "usd");
  });

  it("denies disallowed reasons before calling the provider", async () => {
    const provider = vi.fn();
    const refund = new Refunds({
      skus: {
        demo: {
          refund_window_days: 30,
          allowed_reasons: ["booking_cancelled"],
        },
      },
    }).makeRefundTool({
      sku: "demo",
      transactionId: "pi_reason_denied",
      amountPaidMinorUnits: 2000,
      purchasedAt: new Date(),
      providerRefundFn: provider,
    });

    const result = await refund(undefined, { reason: "freeform customer text" });

    expect(result.status).toBe("denied");
    expect(result.reason).toBe("refund_reason_not_allowed");
    expect(result.requested_reason).toBe("freeform customer text");
    expect(result.allowed_reasons).toEqual(["booking_cancelled"]);
    expect(provider).not.toHaveBeenCalled();
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
