from __future__ import annotations

from datetime import datetime, timezone

import pytest

from refund_guard import Refunds

SAMPLE_POLICY = {
    "skus": {
        "digital_course": {"refund_window_days": 7},
        "shampoo": {"refund_window_days": 30},
    }
}


def make_mock_provider(*, succeed: bool = True, return_value: dict | None = None):
    """Return a mock provider_refund_fn that records calls."""
    calls: list[tuple] = []

    def mock_refund(amount: float, transaction_id: str, currency: str) -> dict:
        calls.append((amount, transaction_id, currency))
        if not succeed:
            raise RuntimeError("Provider unavailable")
        return return_value or {"id": "re_mock", "status": "succeeded"}

    mock_refund.calls = calls  # type: ignore[attr-defined]
    return mock_refund


@pytest.fixture()
def refunds():
    return Refunds(SAMPLE_POLICY)


@pytest.fixture()
def recent_purchase() -> datetime:
    """A purchase timestamp that is always within any reasonable refund window."""
    return datetime.now(timezone.utc)
