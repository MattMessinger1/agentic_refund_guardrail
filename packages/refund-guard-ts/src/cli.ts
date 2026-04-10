#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { Refunds, type RefundResult } from "./index.js";

type ToolOptions = Parameters<Refunds["makeRefundTool"]>[0];

type DoctorResult = {
  id: string;
  result: RefundResult;
  provider_calls: Array<[number, string, string]>;
};

export async function main(args = process.argv.slice(2)): Promise<number> {
  const normalized = args[0] === "doctor" ? args.slice(1) : args;
  if (normalized.length !== 2) {
    console.error("Usage: refund-guard doctor <policy.yaml> <scenarios.json>");
    return 2;
  }

  const [policyPath, scenariosPath] = normalized;
  const results = await runDoctor(policyPath, scenariosPath);
  console.log(JSON.stringify({ results }, null, 2));
  return 0;
}

export async function runDoctor(
  policyPath: string,
  scenariosPath: string,
): Promise<DoctorResult[]> {
  const refunds = new Refunds(policyPath);
  const scenarios = loadScenarios(scenariosPath);
  const results: DoctorResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(refunds, scenario));
  }
  return results;
}

function loadScenarios(path: string): Array<Record<string, unknown>> {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const scenarios =
    typeof raw === "object" &&
    raw !== null &&
    !Array.isArray(raw) &&
    Array.isArray((raw as Record<string, unknown>).scenarios)
      ? (raw as Record<string, unknown>).scenarios
      : raw;
  if (!Array.isArray(scenarios)) {
    throw new Error("Scenario file must be a JSON list or {'scenarios': [...]}");
  }
  if (!scenarios.every((item) => typeof item === "object" && item !== null)) {
    throw new Error("Every scenario must be a JSON object");
  }
  return scenarios as Array<Record<string, unknown>>;
}

async function runScenario(
  refunds: Refunds,
  scenario: Record<string, unknown>,
): Promise<DoctorResult> {
  const calls: Array<[number, string, string]> = [];
  const fakeProvider = (
    amount: number,
    transactionId: string,
    currency: string,
  ): Record<string, unknown> => {
    calls.push([amount, transactionId, currency]);
    return {
      status: "succeeded",
      fake: true,
      amount,
      transaction_id: transactionId,
      currency,
    };
  };

  const clockNow = optionalString(scenario, "clock_now");
  const fixedNow = clockNow != null ? new Date(clockNow) : null;
  const sku = requiredString(scenario, "sku");
  const toolOpts: ToolOptions = {
    sku,
    transactionId: optionalString(scenario, "transaction_id") ?? `doctor_${sku}`,
    purchasedAt: new Date(requiredString(scenario, "purchased_at")),
    providerRefundFn: fakeProvider,
    currency: optionalString(scenario, "currency") ?? "usd",
    ...(fixedNow != null ? { nowFn: () => fixedNow } : {}),
  };

  copyNumber(scenario, "amount_paid", toolOpts, "amountPaid");
  copyNumber(scenario, "amount_paid_minor_units", toolOpts, "amountPaidMinorUnits");
  copyNumber(scenario, "amount_refunded", toolOpts, "amountRefunded");
  copyNumber(
    scenario,
    "amount_refunded_minor_units",
    toolOpts,
    "amountRefundedMinorUnits",
  );

  const refundedAt = optionalString(scenario, "refunded_at");
  if (refundedAt != null) {
    toolOpts.refundedAt = new Date(refundedAt);
  }

  const refund = refunds.makeRefundTool(toolOpts);
  const amount = optionalNumber(scenario, "amount");
  const reason = optionalString(scenario, "reason");
  const originalInfo = console.info;
  console.info = () => {};
  let result: RefundResult;
  try {
    result =
      amount == null
        ? await refund(undefined, { reason })
        : await refund(amount, { reason });
  } finally {
    console.info = originalInfo;
  }

  return {
    id: optionalString(scenario, "id") ?? sku,
    result,
    provider_calls: calls,
  };
}

function copyNumber<K extends keyof ToolOptions>(
  source: Record<string, unknown>,
  sourceKey: string,
  target: ToolOptions,
  targetKey: K,
): void {
  const value = optionalNumber(source, sourceKey);
  if (value != null) {
    target[targetKey] = value as ToolOptions[K];
  }
}

function requiredString(source: Record<string, unknown>, key: string): string {
  const value = optionalString(source, key);
  if (value == null) {
    throw new Error(`Scenario field '${key}' is required`);
  }
  return value;
}

function optionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Scenario field '${key}' must be a string`);
  }
  return value;
}

function optionalNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "number") {
    throw new Error(`Scenario field '${key}' must be a number`);
  }
  return value;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exitCode = code;
  });
}
