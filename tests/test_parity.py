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

    assert cases_doc["version"] == 1
    tests = cases_doc["tests"]
    assert len(tests) == 13

    for case in tests:
        clock = _parse_iso(case["clock_now"])
        naive = case.get("purchased_at_is_naive", False)
        purchased = _parse_iso(case["purchased_at"], naive=naive)

        calls: list = []
        refunds = Refunds(case["policy"])

        tool = refunds.make_refund_tool(
            sku=case["sku"],
            transaction_id=case["transaction_id"],
            amount_paid=case["amount_paid"],
            purchased_at=purchased,
            currency=case.get("currency", "usd"),
            provider_refund_fn=_make_provider("success", calls),
            now_fn=lambda: clock,
        )

        for step in case["steps"]:
            mode = step["provider"]
            tool._provider_refund_fn = _make_provider(mode, calls)  # type: ignore[attr-defined]

            result = tool(float(step["amount"]))
            exp = step["expect"]
            _assert_subset(exp, result)

            if "expect_detail_contains" in step:
                assert step["expect_detail_contains"] in (result.get("detail") or "")

            if "expect_provider_call" in step:
                want = step["expect_provider_call"]
                assert calls[-1] == tuple(want), f"case {case['id']}: provider call mismatch"
