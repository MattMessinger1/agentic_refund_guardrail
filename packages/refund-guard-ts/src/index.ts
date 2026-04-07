import { loadPolicy, type PolicyMap, type SkuPolicy } from "./policy.js";
import { RefundTool, type ProviderRefundFn, type RefundResult } from "./tool.js";
import { DENIAL_MESSAGES } from "./messages.js";

export type { PolicyMap, SkuPolicy, ProviderRefundFn, RefundResult };
export { loadPolicy, RefundTool, DENIAL_MESSAGES };

export type RefundCallable = ((amount: number) => Promise<RefundResult>) & {
  tool: RefundTool;
};

export class Refunds {
  private readonly policies: PolicyMap;

  constructor(policy: string | Record<string, unknown>) {
    this.policies = loadPolicy(policy);
  }

  makeRefundTool(opts: {
    sku: string;
    transactionId: string;
    amountPaid?: number;
    amountPaidMinorUnits?: number;
    purchasedAt: Date;
    providerRefundFn: ProviderRefundFn;
    currency?: string;
    provider?: string;
    nowFn?: () => Date;
    refundedAt?: Date | null;
  }): RefundCallable {
    const sku = opts.sku;
    const policy = this.policies[sku];
    if (!policy) {
      const known = Object.keys(this.policies).sort().join(", ");
      throw new Error(`SKU '${sku}' not found in policy. Known SKUs: ${known}`);
    }

    if (opts.amountPaid != null && opts.amountPaidMinorUnits != null) {
      throw new Error(
        "Provide amountPaid or amountPaidMinorUnits, not both",
      );
    }
    if (opts.amountPaid == null && opts.amountPaidMinorUnits == null) {
      throw new Error(
        "Provide either amountPaid or amountPaidMinorUnits",
      );
    }

    const resolvedAmount =
      opts.amountPaid != null
        ? opts.amountPaid
        : opts.amountPaidMinorUnits! / 100;

    const tool = new RefundTool({
      sku,
      transactionId: opts.transactionId,
      amountPaid: resolvedAmount,
      currency: opts.currency ?? "usd",
      purchasedAt: opts.purchasedAt,
      provider: opts.provider ?? "unknown",
      providerRefundFn: opts.providerRefundFn,
      policy: policy as SkuPolicy,
      nowFn: opts.nowFn,
      refundedAt: opts.refundedAt,
    });

    const fn = ((amount: number) => tool.call(amount)) as RefundCallable;
    fn.tool = tool;
    return fn;
  }
}
