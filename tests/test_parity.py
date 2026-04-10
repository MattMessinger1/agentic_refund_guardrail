"""Run shared JSON fixtures against the Python implementation (parity with TypeScript)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from refund_guard import Refunds

CASES_PATH = Path(__file__).resolve().parents[1] / "contracts" / "parity" / "cases.json"


def _parse_iso(s: str, *, naive: bool = False) -> datetime:
    if naive:
        return datetime.fromisoformat(s)
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _make_provider(mode: str, calls: list):
    def fn(amount: float, transaction_id: str, currency: str):
        calls.append((amount, transaction_id, currency))
        if mode == "fail":
            raise RuntimeError("Provider unavailable")
        return {"id": "re_mock", "status": "succeeded"}

    return fn


def _assert_subset(expected: dict, actual: dict) -> None:
    for k, v in expected.items():
        if isinstance(v, float) and isinstance(actual.get(k), (int, float)):
            assert float(actual[k]) == pytest.approx(float(v)), f"key {k}: {actual[k]} != {v}"
        else:
            assert actual.get(k) == v, f"key {k}: {actual.get(k)!r} != {v!r}"


def test_shared_parity_fixtures_match_python():
    with open(CASES_PATH) as f:
        cases_doc = json.load(f)

    assert cases_doc["version"] == 2
    tests = cases_doc["tests"]
    assert len(tests) == 26

    for case in tests:
        clock = _parse_iso(case["clock_now"])
        naive = case.get("purchased_at_is_naive", False)
        purchased = _parse_iso(case["purchased_at"], naive=naive)

        calls: list = []
        refunds = Refunds(case["policy"])

        tool_kwargs: dict = dict(
            sku=case["sku"],
            transaction_id=case["transaction_id"],
            purchased_at=purchased,
            currency=case.get("currency", "usd"),
            provider_refund_fn=_make_provider("success", calls),
            now_fn=lambda: clock,
        )

        if "amount_paid_minor_units" in case and "amount_paid" in case:
            tool_kwargs["amount_paid"] = case["amount_paid"]
            tool_kwargs["amount_paid_minor_units"] = case["amount_paid_minor_units"]
        elif "amount_paid_minor_units" in case:
            tool_kwargs["amount_paid_minor_units"] = case["amount_paid_minor_units"]
        else:
            tool_kwargs["amount_paid"] = case["amount_paid"]

        if "amount_refunded_minor_units" in case and "amount_refunded" in case:
            tool_kwargs["amount_refunded"] = case["amount_refunded"]
            tool_kwargs["amount_refunded_minor_units"] = case["amount_refunded_minor_units"]
        elif "amount_refunded_minor_units" in case:
            tool_kwargs["amount_refunded_minor_units"] = case["amount_refunded_minor_units"]
        elif "amount_refunded" in case:
            tool_kwargs["amount_refunded"] = case["amount_refunded"]

        if "refunded_at" in case and case["refunded_at"] is not None:
            tool_kwargs["refunded_at"] = _parse_iso(case["refunded_at"])

        if case.get("expect_construction_error"):
            with pytest.raises((ValueError, TypeError)):
                refunds.make_refund_tool(**tool_kwargs)
            continue

        tool = refunds.make_refund_tool(**tool_kwargs)

        for step in case["steps"]:
            mode = step["provider"]
            tool._provider_refund_fn = _make_provider(mode, calls)  # type: ignore[attr-defined]

            step_amount = step["amount"]
            reason = step.get("reason")
            result = (
                tool(reason=reason)
                if step_amount is None
                else tool(float(step_amount), reason=reason)
            )
            exp = step["expect"]
            _assert_subset(exp, result)

            if "expect_detail_contains" in step:
                assert step["expect_detail_contains"] in (result.get("detail") or "")

            if "expect_provider_call" in step:
                want = step["expect_provider_call"]
                assert calls[-1] == tuple(want), f"case {case['id']}: provider call mismatch"
