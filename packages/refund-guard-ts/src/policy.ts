import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

export interface SkuPolicy {
  refund_window_days: number;
  refundable?: boolean;
  max_refund_minor_units?: number;
  manual_approval_required_over_minor_units?: number;
  allowed_reasons?: string[];
}

export type PolicyMap = Record<string, SkuPolicy>;

function parseDict(raw: Record<string, unknown>): PolicyMap {
  const skus = (raw.skus ?? raw) as Record<string, unknown>;
  if (typeof skus !== "object" || skus === null || Object.keys(skus).length === 0) {
    throw new Error("Policy must define at least one SKU under 'skus'");
  }
  const policies: PolicyMap = {};
  for (const [skuName, rules] of Object.entries(skus)) {
    if (typeof rules !== "object" || rules === null) {
      throw new Error(`Rules for SKU '${skuName}' must be a mapping`);
    }
    const r = rules as Record<string, unknown>;
    const window = r.refund_window_days;
    if (typeof window !== "number" || !Number.isInteger(window) || window < 0) {
      throw new Error(
        `SKU '${skuName}' must have a non-negative integer 'refund_window_days'`,
      );
    }
    const refundable = r.refundable ?? true;
    if (typeof refundable !== "boolean") {
      throw new Error(`SKU '${skuName}' field 'refundable' must be a boolean`);
    }
    const maxRefundMinorUnits = optionalNonNegativeInteger(
      skuName,
      r,
      "max_refund_minor_units",
    );
    const manualApprovalRequiredOverMinorUnits = optionalNonNegativeInteger(
      skuName,
      r,
      "manual_approval_required_over_minor_units",
    );
    const allowedReasons = optionalStringArray(skuName, r, "allowed_reasons");
    policies[skuName] = {
      refund_window_days: window,
      refundable,
      ...(maxRefundMinorUnits != null
        ? { max_refund_minor_units: maxRefundMinorUnits }
        : {}),
      ...(manualApprovalRequiredOverMinorUnits != null
        ? {
            manual_approval_required_over_minor_units:
              manualApprovalRequiredOverMinorUnits,
          }
        : {}),
      ...(allowedReasons != null ? { allowed_reasons: allowedReasons } : {}),
    };
  }
  return policies;
}

function optionalNonNegativeInteger(
  skuName: string,
  rules: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = rules[field];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(
      `SKU '${skuName}' field '${field}' must be a non-negative integer`,
    );
  }
  return value;
}

function optionalStringArray(
  skuName: string,
  rules: Record<string, unknown>,
  field: string,
): string[] | undefined {
  const value = rules[field];
  if (value == null) {
    return undefined;
  }
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string" && item.length > 0)
  ) {
    throw new Error(`SKU '${skuName}' field '${field}' must be a list of strings`);
  }
  return value;
}

/** Load policy from a YAML file path, or from a plain object (same shapes as Python). */
export function loadPolicy(source: string | Record<string, unknown>): PolicyMap {
  if (typeof source === "string") {
    const path = resolve(source);
    const text = readFileSync(path, "utf8");
    const raw = YAML.parse(text);
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`Policy file must contain a YAML mapping, got ${typeof raw}`);
    }
    return parseDict(raw as Record<string, unknown>);
  }
  return parseDict(source);
}
