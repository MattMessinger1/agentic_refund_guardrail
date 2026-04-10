#!/usr/bin/env python3
"""
Minimal runnable example — no Stripe, no secrets.

From the repo root (after `pip install -e ".[dev]"` or `pip install -e .`):

    python examples/minimal-python/run.py
"""

from __future__ import annotations

from datetime import datetime, timezone

from refund_guard import Refunds

# Inline policy (or use a YAML path: Refunds("path/to/refund_policy.yaml"))
POLICY = {
    "skus": {
        "demo": {"refund_window_days": 30},
    }
}


def fake_provider_refund(amount: float, transaction_id: str, currency: str) -> dict:
    """Pretend payment provider — replace with Stripe, PayPal, etc."""
    print(f"  [fake provider] refund {amount} {currency.upper()} for {transaction_id}")
    return {"status": "succeeded", "fake": True}


def main() -> None:
    refunds = Refunds(POLICY)
    purchased_at = datetime.now(timezone.utc)

    tool = refunds.make_refund_tool(
        sku="demo",
        transaction_id="pi_demo_001",
        amount_paid=100.00,
        purchased_at=purchased_at,
        provider_refund_fn=fake_provider_refund,
    )

    print("1) Partial refund (should approve $60):")
    print(tool(60.00))

    print("\n2) No amount refunds the remaining balance (should approve $40):")
    print(tool())

    print("\n3) No remaining balance (should deny as invalid_amount):")
    print(tool())


if __name__ == "__main__":
    main()
