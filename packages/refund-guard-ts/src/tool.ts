import type { SkuPolicy } from "./policy.js";

export type DenialReason =
  | "already_refunded"
  | "refund_window_expired"
  | "amount_exceeds_limit"
  | "amount_exceeds_remaining"
  | "amount_exceeds_policy_max"
  | "invalid_amount"
  | "not_refundable"
  | "refund_reason_not_allowed"
  | "manual_approval_required";

export type ApprovedRefundResult = {
  status: "approved";
  refunded_amount: number;
  transaction_id: string;
  provider_result: unknown;
  reason?: string;
} & Record<string, unknown>;

export type DeniedRefundResult = {
  status: "denied";
  reason: DenialReason;
  transaction_id: string;
} & Record<string, unknown>;

export type ErrorRefundResult = {
  status: "error";
  reason: "provider_error";
  detail: string;
  transaction_id: string;
} & Record<string, unknown>;

export type RefundResult =
  | ApprovedRefundResult
  | DeniedRefundResult
  | ErrorRefundResult;

export type RefundCallOptions = {
  reason?: string;
};

export type ProviderRefundFn = (
  amount: number,
  transactionId: string,
  currency: string,
) => unknown | Promise<unknown>;

/** Parse ISO datetime; naive strings are interpreted as UTC (matches Python naive->UTC). */
export function parseDateTime(iso: string, naive: boolean): Date {
  if (naive) {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!m) {
      throw new Error(`Invalid naive datetime: ${iso}`);
    }
    return new Date(
      Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
      ),
    );
  }
  return new Date(iso);
}

function addDaysUtc(from: Date, days: number): Date {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(from.getTime() + ms);
}

function defaultNow(): Date {
  return new Date();
}

export class RefundTool {
  private readonly sku: string;
  private readonly transactionId: string;
  private readonly amountPaid: number;
  private readonly currency: string;
  private readonly purchasedAt: Date;
  private readonly provider: string;
  private providerRefundFn: ProviderRefundFn;
  private readonly policy: SkuPolicy;
  private totalRefunded = 0;
  private readonly nowFn: () => Date;
  private readonly refundedAt: Date | null;
  private callQueue: Promise<void> = Promise.resolve();

  constructor(opts: {
    sku: string;
    transactionId: string;
    amountPaid: number;
    currency: string;
    purchasedAt: Date;
    provider: string;
    providerRefundFn: ProviderRefundFn;
    policy: SkuPolicy;
    nowFn?: () => Date;
    refundedAt?: Date | null;
    totalRefunded?: number;
  }) {
    this.sku = opts.sku;
    this.transactionId = opts.transactionId;
    this.amountPaid = opts.amountPaid;
    this.currency = opts.currency;
    this.purchasedAt = opts.purchasedAt;
    this.provider = opts.provider;
    this.providerRefundFn = opts.providerRefundFn;
    this.policy = opts.policy;
    this.nowFn = opts.nowFn ?? defaultNow;
    this.refundedAt = opts.refundedAt ?? null;
    this.totalRefunded = opts.totalRefunded ?? 0;
  }

  /** Test helper: swap provider (parity with Python test patching). */
  setProviderRefundFn(fn: ProviderRefundFn): void {
    this.providerRefundFn = fn;
  }

  async call(amount?: number, options: RefundCallOptions = {}): Promise<RefundResult> {
    const previous = this.callQueue;
    let release: () => void = () => {};
    this.callQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.callOnce(amount, options);
    } finally {
      release();
    }
  }

  private async callOnce(
    amount?: number,
    options: RefundCallOptions = {},
  ): Promise<RefundResult> {
    const reason = options.reason;
    const a =
      amount != null
        ? Number(amount)
        : Math.round((this.amountPaid - this.totalRefunded) * 100) / 100;

    if (this.refundedAt !== null) {
      const result: RefundResult = {
        status: "denied",
        reason: "already_refunded",
        refunded_at: this.refundedAt.toISOString(),
        transaction_id: this.transactionId,
      };
      this.log(a, result, reason);
      return result;
    }

    const denied = this.validate(a, reason);
    if (denied) {
      this.log(a, denied, reason);
      return denied;
    }
    try {
      const providerResult = await Promise.resolve(
        this.providerRefundFn(a, this.transactionId, this.currency),
      );
      const totalRefundedBeforeCall = this.totalRefunded;
      this.totalRefunded += a;
      const result: RefundResult = {
        status: "approved",
        refunded_amount: a,
        transaction_id: this.transactionId,
        provider_result: providerResult,
      };
      if (reason != null) {
        result.reason = reason;
      }
      this.log(a, result, reason, totalRefundedBeforeCall);
      return result;
    } catch (exc: unknown) {
      const detail = exc instanceof Error ? exc.message : String(exc);
      const result: RefundResult = {
        status: "error",
        reason: "provider_error",
        detail,
        transaction_id: this.transactionId,
      };
      this.log(a, result, reason);
      return result;
    }
  }

  private validate(amount: number, reason?: string): RefundResult | null {
    const now = this.nowFn();
    if (isNaN(this.purchasedAt.getTime())) {
      throw new Error("Invalid purchased_at");
    }
    const deadline = addDaysUtc(this.purchasedAt, this.policy.refund_window_days);

    if (this.policy.refundable === false) {
      return {
        status: "denied",
        reason: "not_refundable",
        transaction_id: this.transactionId,
      };
    }

    if (now.getTime() > deadline.getTime()) {
      return {
        status: "denied",
        reason: "refund_window_expired",
        purchased_at: this.isoPurchasedAt(),
        window_days: this.policy.refund_window_days,
        transaction_id: this.transactionId,
      };
    }

    if (
      this.policy.allowed_reasons != null &&
      !this.policy.allowed_reasons.includes(reason ?? "")
    ) {
      return {
        status: "denied",
        reason: "refund_reason_not_allowed",
        requested_reason: reason,
        allowed_reasons: this.policy.allowed_reasons,
        transaction_id: this.transactionId,
      };
    }

    if (!Number.isFinite(amount)) {
      return {
        status: "denied",
        reason: "invalid_amount",
        detail: "Amount must be a finite number",
        transaction_id: this.transactionId,
      };
    }

    if (amount <= 0) {
      return {
        status: "denied",
        reason: "invalid_amount",
        detail: "Amount must be greater than zero",
        transaction_id: this.transactionId,
      };
    }

    if (amount > this.amountPaid) {
      return {
        status: "denied",
        reason: "amount_exceeds_limit",
        requested: amount,
        max_allowed: this.amountPaid,
        transaction_id: this.transactionId,
      };
    }

    if (this.policy.max_refund_minor_units != null) {
      const maxPolicyAmount = this.policy.max_refund_minor_units / 100;
      if (amount > maxPolicyAmount) {
        return {
          status: "denied",
          reason: "amount_exceeds_policy_max",
          requested: amount,
          max_allowed: maxPolicyAmount,
          transaction_id: this.transactionId,
        };
      }
    }

    if (this.policy.manual_approval_required_over_minor_units != null) {
      const approvalThreshold =
        this.policy.manual_approval_required_over_minor_units / 100;
      if (amount > approvalThreshold) {
        return {
          status: "denied",
          reason: "manual_approval_required",
          requested: amount,
          approval_required_over: approvalThreshold,
          transaction_id: this.transactionId,
        };
      }
    }

    const remaining =
      Math.round((this.amountPaid - this.totalRefunded) * 100) / 100;
    if (amount > remaining) {
      return {
        status: "denied",
        reason: "amount_exceeds_remaining",
        requested: amount,
        remaining,
        already_refunded: this.totalRefunded,
        transaction_id: this.transactionId,
      };
    }

    return null;
  }

  private isoPurchasedAt(): string {
    return this.purchasedAt.toISOString();
  }

  private log(
    requestedAmount: number,
    result: RefundResult,
    reason?: string,
    totalRefundedBeforeCall: number = this.totalRefunded,
  ): void {
    const entry: Record<string, unknown> = {
      transaction_id: this.transactionId,
      sku: this.sku,
      provider: this.provider,
      currency: this.currency,
      requested_amount: requestedAmount,
      amount_paid: this.amountPaid,
      total_refunded_before_call: totalRefundedBeforeCall,
    };
    if (reason != null) {
      entry.refund_reason = reason;
    }
    for (const [k, v] of Object.entries(result)) {
      if (k !== "provider_result") {
        entry[k] = v;
      }
    }
    // eslint-disable-next-line no-console -- mirrors Python logging default
    console.info(JSON.stringify(entry));
  }
}
