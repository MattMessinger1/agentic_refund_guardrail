import { loadPolicy, type PolicyMap, type SkuPolicy } from "./policy.js";
import {
  RefundTool,
  type ApprovedRefundResult,
  type DenialReason,
  type DeniedRefundResult,
  type ErrorRefundResult,
  type ProviderRefundFn,
  type RefundCallOptions,
  type RefundResult,
} from "./tool.js";
import { DENIAL_MESSAGES } from "./messages.js";

export type {
  PolicyMap,
  SkuPolicy,
  ApprovedRefundResult,
  DeniedRefundResult,
  DenialReason,
  ErrorRefundResult,
  ProviderRefundFn,
  RefundCallOptions,
  RefundResult,
};
export { loadPolicy, RefundTool, DENIAL_MESSAGES };

export type RefundCallable = ((
  amount?: number,
  options?: RefundCallOptions,
) => Promise<RefundResult>) & {
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
    amountRefunded?: number;
    amountRefundedMinorUnits?: number;
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

    const resolvedAmount = resolveMoneyOptions(
      "amountPaid",
      opts.amountPaid,
      "amountPaidMinorUnits",
      opts.amountPaidMinorUnits,
      true,
    );
    const totalRefunded = resolveMoneyOptions(
      "amountRefunded",
      opts.amountRefunded,
      "amountRefundedMinorUnits",
      opts.amountRefundedMinorUnits,
      false,
    );

    if (resolvedAmount <= 0) {
      throw new Error("amountPaid must be greater than zero");
    }
    if (totalRefunded < 0) {
      throw new Error("amountRefunded must be zero or greater");
    }
    if (totalRefunded > resolvedAmount) {
      throw new Error("amountRefunded cannot exceed amountPaid");
    }

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
      totalRefunded,
    });

    const fn = ((amount?: number, options?: RefundCallOptions) =>
      tool.call(amount, options)) as RefundCallable;
    fn.tool = tool;
    return fn;
  }
}

function resolveMoneyOptions(
  majorName: string,
  major: number | undefined,
  minorName: string,
  minor: number | undefined,
  required: boolean,
): number {
  if (major != null && minor != null) {
    throw new Error(`Provide ${majorName} or ${minorName}, not both`);
  }
  if (major == null && minor == null) {
    if (required) {
      throw new Error(`Provide either ${majorName} or ${minorName}`);
    }
    return 0;
  }

  const resolved = major != null ? Number(major) : Number(minor) / 100;
  if (!Number.isFinite(resolved)) {
    throw new Error(`${majorName} must be a finite number`);
  }
  return resolved;
}
