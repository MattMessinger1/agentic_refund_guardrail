import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

export interface SkuPolicy {
  refund_window_days: number;
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
    policies[skuName] = { refund_window_days: window };
  }
  return policies;
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
