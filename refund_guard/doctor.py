from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from refund_guard import Refunds


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if args and args[0] == "doctor":
        args = args[1:]
    if len(args) != 2:
        print(
            "Usage: refund-guard doctor <policy.yaml> <scenarios.json>",
            file=sys.stderr,
        )
        return 2

    policy_path, scenarios_path = args
    results = run_doctor(policy_path, scenarios_path)
    print(json.dumps({"results": results}, indent=2, default=str))
    return 0


def run_doctor(policy_path: str | Path, scenarios_path: str | Path) -> list[dict[str, Any]]:
    refunds = Refunds(policy_path)
    scenarios = _load_scenarios(scenarios_path)
    return [_run_scenario(refunds, scenario) for scenario in scenarios]


def _load_scenarios(path: str | Path) -> list[dict[str, Any]]:
    with open(path) as f:
        raw = json.load(f)
    scenarios = raw.get("scenarios", raw) if isinstance(raw, dict) else raw
    if not isinstance(scenarios, list):
        raise ValueError("Scenario file must be a JSON list or {'scenarios': [...]}")
    if not all(isinstance(item, dict) for item in scenarios):
        raise ValueError("Every scenario must be a JSON object")
    return scenarios


def _run_scenario(refunds: Refunds, scenario: dict[str, Any]) -> dict[str, Any]:
    calls: list[tuple[float, str, str]] = []

    def fake_provider(amount: float, transaction_id: str, currency: str) -> dict[str, Any]:
        calls.append((amount, transaction_id, currency))
        return {
            "status": "succeeded",
            "fake": True,
            "amount": amount,
            "transaction_id": transaction_id,
            "currency": currency,
        }

    clock_now = scenario.get("clock_now")
    now_fn = None
    if clock_now is not None:
        now = _parse_datetime(clock_now)
        now_fn = lambda: now  # noqa: E731

    tool_kwargs: dict[str, Any] = {
        "sku": scenario["sku"],
        "transaction_id": scenario.get("transaction_id", f"doctor_{scenario['sku']}"),
        "purchased_at": _parse_datetime(scenario["purchased_at"]),
        "provider_refund_fn": fake_provider,
        "currency": scenario.get("currency", "usd"),
        "now_fn": now_fn,
    }
    for source, target in {
        "amount_paid": "amount_paid",
        "amount_paid_minor_units": "amount_paid_minor_units",
        "amount_refunded": "amount_refunded",
        "amount_refunded_minor_units": "amount_refunded_minor_units",
    }.items():
        if source in scenario:
            tool_kwargs[target] = scenario[source]

    if "refunded_at" in scenario and scenario["refunded_at"] is not None:
        tool_kwargs["refunded_at"] = _parse_datetime(scenario["refunded_at"])

    tool = refunds.make_refund_tool(**tool_kwargs)
    amount = scenario.get("amount")
    reason = scenario.get("reason")
    result = tool(reason=reason) if amount is None else tool(amount, reason=reason)

    return {
        "id": scenario.get("id", scenario["sku"]),
        "result": result,
        "provider_calls": calls,
    }


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


if __name__ == "__main__":
    raise SystemExit(main())
