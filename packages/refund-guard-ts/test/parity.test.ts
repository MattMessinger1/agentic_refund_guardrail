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
  amount_paid: number;
  purchased_at: string;
  purchased_at_is_naive?: boolean;
  currency?: string;
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
    expect(doc.tests.length).toBe(13);
  });

  for (const case_ of doc.tests) {
    it(case_.id, () => {
      const clock = parseDateTime(case_.clock_now, false);
      const purchased = parseDateTime(
        case_.purchased_at,
        case_.purchased_at_is_naive ?? false,
      );

      const calls: Array<[number, string, string]> = [];
      const refunds = new Refunds(case_.policy);

      const refund = refunds.makeRefundTool({
        sku: case_.sku,
        transactionId: case_.transaction_id,
        amountPaid: case_.amount_paid,
        purchasedAt: purchased,
        currency: case_.currency ?? "usd",
        providerRefundFn: makeProvider("success", calls),
        nowFn: () => clock,
      });

      for (const step of case_.steps) {
        refund.tool.setProviderRefundFn(makeProvider(step.provider, calls));
        const result = refund(step.amount) as Record<string, unknown>;
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
