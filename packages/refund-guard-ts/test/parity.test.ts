import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Refunds } from "../src/index.js";
import { parseDateTime } from "../src/tool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const casesPath = join(__dirname, "../../../contracts/parity/cases.json");

type Step = {
  amount: number;
  provider: string;
  expect: Record<string, unknown>;
  expect_detail_contains?: string;
  expect_provider_call?: [number, string, string];
};

type Case = {
  id: string;
  policy: Record<string, unknown>;
  clock_now: string;
  sku: string;
  transaction_id: string;
  amount_paid?: number;
  amount_paid_minor_units?: number;
  purchased_at: string;
  purchased_at_is_naive?: boolean;
  currency?: string;
  refunded_at?: string | null;
  expect_construction_error?: boolean;
  steps: Step[];
};

function makeProvider(
  mode: string,
  calls: Array<[number, string, string]>,
): (amount: number, transactionId: string, currency: string) => unknown {
  return (amount: number, transactionId: string, currency: string) => {
    calls.push([amount, transactionId, currency]);
    if (mode === "fail") {
      throw new Error("Provider unavailable");
    }
    return { id: "re_mock", status: "succeeded" };
  };
}

function assertSubset(expected: Record<string, unknown>, actual: Record<string, unknown>) {
  for (const [k, v] of Object.entries(expected)) {
    const a = actual[k];
    if (typeof v === "number" && typeof a === "number") {
      expect(a).toBeCloseTo(v, 10);
    } else {
      expect(a).toEqual(v);
    }
  }
}

describe("parity fixtures (TypeScript)", () => {
  beforeAll(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  const doc = JSON.parse(readFileSync(casesPath, "utf8")) as {
    version: number;
    tests: Case[];
  };

  it("fixture version", () => {
    expect(doc.version).toBe(1);
    expect(doc.tests.length).toBe(17);
  });

  for (const case_ of doc.tests) {
    it(case_.id, async () => {
      const clock = parseDateTime(case_.clock_now, false);
      const purchased = parseDateTime(
        case_.purchased_at,
        case_.purchased_at_is_naive ?? false,
      );

      const calls: Array<[number, string, string]> = [];
      const refunds = new Refunds(case_.policy);

      const toolOpts: Record<string, unknown> = {
        sku: case_.sku,
        transactionId: case_.transaction_id,
        purchasedAt: purchased,
        currency: case_.currency ?? "usd",
        providerRefundFn: makeProvider("success", calls),
        nowFn: () => clock,
      };

      if (case_.amount_paid != null && case_.amount_paid_minor_units != null) {
        toolOpts.amountPaid = case_.amount_paid;
        toolOpts.amountPaidMinorUnits = case_.amount_paid_minor_units;
      } else if (case_.amount_paid_minor_units != null) {
        toolOpts.amountPaidMinorUnits = case_.amount_paid_minor_units;
      } else {
        toolOpts.amountPaid = case_.amount_paid;
      }

      if (case_.refunded_at !== undefined) {
        toolOpts.refundedAt =
          case_.refunded_at != null ? new Date(case_.refunded_at) : null;
      }

      if (case_.expect_construction_error) {
        expect(() => refunds.makeRefundTool(toolOpts as Parameters<typeof refunds.makeRefundTool>[0])).toThrow();
        return;
      }

      const refund = refunds.makeRefundTool(toolOpts as Parameters<typeof refunds.makeRefundTool>[0]);

      for (const step of case_.steps) {
        refund.tool.setProviderRefundFn(makeProvider(step.provider, calls));
        const result = (await refund(step.amount)) as Record<string, unknown>;
        assertSubset(step.expect, result);

        if (step.expect_detail_contains) {
          expect(String(result.detail ?? "")).toContain(step.expect_detail_contains);
        }
        if (step.expect_provider_call) {
          expect(calls[calls.length - 1]).toEqual(step.expect_provider_call);
        }
      }
    });
  }
});
