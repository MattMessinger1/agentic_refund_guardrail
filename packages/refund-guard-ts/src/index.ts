import { loadPolicy, type PolicyMap, type SkuPolicy } from "./policy.js";
import { RefundTool, type ProviderRefundFn, type RefundResult } from "./tool.js";

export type { PolicyMap, SkuPolicy, ProviderRefundFn, RefundResult };
export { loadPolicy, RefundTool };

export type RefundCallable = ((amount: number) => RefundResult) & { tool: RefundTool };

export class Refunds {
  private readonly policies: PolicyMap;

  constructor(policy: string | Record<string, unknown>) {
    this.policies = loadPolicy(policy);
  }

  makeRefundTool(opts: {
    sku: string;
    transactionId: string;
    amountPaid: number;
    purchasedAt: Date;
    providerRefundFn: ProviderRefundFn;
    currency?: string;
    provider?: string;
    nowFn?: () => Date;
  }): RefundCallable {
    const sku = opts.sku;
    const policy = this.policies[sku];
    if (!policy) {
      const known = Object.keys(this.policies).sort().join(", ");
      throw new Error(`SKU '${sku}' not found in policy. Known SKUs: ${known}`);
    }

    const tool = new RefundTool({
      sku,
      transactionId: opts.transactionId,
      amountPaid: opts.amountPaid,
      currency: opts.currency ?? "usd",
      purchasedAt: opts.purchasedAt,
      provider: opts.provider ?? "unknown",
      providerRefundFn: opts.providerRefundFn,
      policy: policy as SkuPolicy,
      nowFn: opts.nowFn,
    });

    const fn = ((amount: number) => tool.call(amount)) as RefundCallable;
    fn.tool = tool;
    return fn;
  }
}
