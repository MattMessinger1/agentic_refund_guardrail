import type { SkuPolicy } from "./policy.js";

export type RefundResult = Record<string, unknown>;

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
  }

  /** Test helper: swap provider (parity with Python test patching). */
  setProviderRefundFn(fn: ProviderRefundFn): void {
    this.providerRefundFn = fn;
  }

  async call(amount: number): Promise<RefundResult> {
    const a = Number(amount);

    if (this.refundedAt !== null) {
      const result: RefundResult = {
        status: "denied",
        reason: "already_refunded",
        refunded_at: this.refundedAt.toISOString(),
        transaction_id: this.transactionId,
      };
      this.log(a, result);
      return result;
    }

    const denied = this.validate(a);
    if (denied) {
      this.log(a, denied);
      return denied;
    }
    try {
      const providerResult = await Promise.resolve(
        this.providerRefundFn(a, this.transactionId, this.currency),
      );
      this.totalRefunded += a;
      const result: RefundResult = {
        status: "approved",
        refunded_amount: a,
        transaction_id: this.transactionId,
        provider_result: providerResult,
      };
      this.log(a, result);
      return result;
    } catch (exc: unknown) {
      const detail = exc instanceof Error ? exc.message : String(exc);
      const result: RefundResult = {
        status: "error",
        reason: "provider_error",
        detail,
        transaction_id: this.transactionId,
      };
      this.log(a, result);
      return result;
    }
  }

  private validate(amount: number): RefundResult | null {
    const now = this.nowFn();
    if (isNaN(this.purchasedAt.getTime())) {
      throw new Error("Invalid purchased_at");
    }
    const deadline = addDaysUtc(this.purchasedAt, this.policy.refund_window_days);

    if (now.getTime() > deadline.getTime()) {
      return {
        status: "denied",
        reason: "refund_window_expired",
        purchased_at: this.isoPurchasedAt(),
        window_days: this.policy.refund_window_days,
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

  private log(requestedAmount: number, result: RefundResult): void {
    const entry: Record<string, unknown> = {
      transaction_id: this.transactionId,
      sku: this.sku,
      provider: this.provider,
      currency: this.currency,
      requested_amount: requestedAmount,
      amount_paid: this.amountPaid,
    };
    for (const [k, v] of Object.entries(result)) {
      if (k !== "provider_result") {
        entry[k] = v;
      }
    }
    // eslint-disable-next-line no-console -- mirrors Python logging default
    console.info(JSON.stringify(entry));
  }
}
