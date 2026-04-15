import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("published TypeScript package shape", () => {
  it("lets a packed consumer call refunds with reason options", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "refund-guard-packed-"));
    try {
      execFileSync("npm", ["run", "build", "--silent"], {
        cwd: packageRoot,
        stdio: "pipe",
      });

      execFileSync("npm", ["pack", "--pack-destination", tempRoot, "--silent"], {
        cwd: packageRoot,
        stdio: "pipe",
      });
      const tarball = readdirSync(tempRoot).find((name) => name.endsWith(".tgz"));
      expect(tarball).toBeDefined();

      const consumerRoot = join(tempRoot, "consumer");
      const packageInstallRoot = join(
        consumerRoot,
        "node_modules",
        "@mattmessinger",
        "refund-guard",
      );
      mkdirSync(packageInstallRoot, { recursive: true });
      execFileSync(
        "tar",
        [
          "-xzf",
          join(tempRoot, tarball as string),
          "--strip-components=1",
          "-C",
          packageInstallRoot,
        ],
        { stdio: "pipe" },
      );

      writeFileSync(
        join(consumerRoot, "package.json"),
        JSON.stringify({ private: true, type: "module" }, null, 2),
      );
      writeFileSync(
        join(consumerRoot, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              skipLibCheck: false,
              noEmit: true,
            },
            include: ["consumer.ts"],
          },
          null,
          2,
        ),
      );
      writeFileSync(
        join(consumerRoot, "consumer.ts"),
        `import { Refunds, type RefundCallOptions, type RefundResult } from "@mattmessinger/refund-guard";

const refunds = new Refunds({
  skus: {
    demo: {
      refund_window_days: 30,
      allowed_reasons: ["booking_cancelled", "duplicate_charge"],
    },
  },
});

const refund = refunds.makeRefundTool({
  sku: "demo",
  transactionId: "pi_consumer",
  amountPaidMinorUnits: 2000,
  amountRefundedMinorUnits: 0,
  purchasedAt: new Date(),
  providerRefundFn: (amount, transactionId, currency) => ({
    amount,
    transactionId,
    currency,
  }),
});

const fullReason: RefundCallOptions = { reason: "booking_cancelled" };
const fullResult: RefundResult = await refund(undefined, fullReason);
const partialResult = await refund(5, { reason: "duplicate_charge" });

if (fullResult.status === "approved") {
  fullResult.refunded_amount.toFixed(2);
}

if (partialResult.status === "denied") {
  partialResult.reason.toUpperCase();
}
`,
      );

      execFileSync(
        process.execPath,
        [
          join(packageRoot, "node_modules", "typescript", "bin", "tsc"),
          "--project",
          "tsconfig.json",
        ],
        {
          cwd: consumerRoot,
          stdio: "pipe",
        },
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
