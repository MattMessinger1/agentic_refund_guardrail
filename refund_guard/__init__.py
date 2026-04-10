"""refund-guard: Turn a real order into a safe refund tool for your AI agent."""

from __future__ import annotations

import math
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Union

from refund_guard._messages import DENIAL_MESSAGES
from refund_guard._policy import load_policy
from refund_guard._tool import RefundTool
from refund_guard._types import (
    ApprovedRefundResult,
    DenialReason,
    DeniedRefundResult,
    ErrorRefundResult,
    RefundResult,
)

__all__ = [
    "Refunds",
    "DENIAL_MESSAGES",
    "ApprovedRefundResult",
    "DeniedRefundResult",
    "DenialReason",
    "ErrorRefundResult",
    "RefundResult",
]


class Refunds:
    """Entry point. Load a refund policy, then create scoped refund tools.

    Usage::

        refunds = Refunds("refund_policy.yaml")
        tool = refunds.make_refund_tool(
            sku="digital_course",
            transaction_id="pi_abc123",
            amount_paid=120.00,
            purchased_at=datetime(2025, 3, 1),
            provider_refund_fn=my_stripe_refund,
        )
        result = tool(80.00)
    """

    def __init__(self, policy: Union[str, Path, dict]) -> None:
        self._policies = load_policy(policy)

    def make_refund_tool(
        self,
        *,
        sku: str,
        transaction_id: str,
        amount_paid: float | None = None,
        amount_paid_minor_units: int | None = None,
        amount_refunded: float | None = None,
        amount_refunded_minor_units: int | None = None,
        purchased_at: datetime,
        provider_refund_fn: Callable[[float, str, str], Any],
        currency: str = "usd",
        provider: str = "unknown",
        now_fn: Callable[[], datetime] | None = None,
        refunded_at: datetime | None = None,
    ) -> RefundTool:
        """Create a refund callable scoped to one order.

        Provide exactly one of ``amount_paid`` (major units, e.g. dollars) or
        ``amount_paid_minor_units`` (e.g. cents -- divided by 100 internally).
        If the order has previous partial refunds, provide exactly one of
        ``amount_refunded`` or ``amount_refunded_minor_units`` so a fresh
        per-request tool starts with the database's persisted balance.

        Raises ``ValueError`` if the SKU is not in the loaded policy or if
        amount parameters are invalid.
        """
        resolved_amount = _resolve_money_options(
            "amount_paid",
            amount_paid,
            "amount_paid_minor_units",
            amount_paid_minor_units,
            required=True,
        )
        total_refunded = _resolve_money_options(
            "amount_refunded",
            amount_refunded,
            "amount_refunded_minor_units",
            amount_refunded_minor_units,
            required=False,
        )

        if resolved_amount <= 0:
            raise ValueError("amount_paid must be greater than zero")
        if total_refunded < 0:
            raise ValueError("amount_refunded must be zero or greater")
        if total_refunded > resolved_amount:
            raise ValueError("amount_refunded cannot exceed amount_paid")

        if sku not in self._policies:
            known = ", ".join(sorted(self._policies))
            raise ValueError(
                f"SKU '{sku}' not found in policy. Known SKUs: {known}"
            )

        return RefundTool(
            sku=sku,
            transaction_id=transaction_id,
            amount_paid=resolved_amount,
            currency=currency,
            purchased_at=purchased_at,
            provider=provider,
            provider_refund_fn=provider_refund_fn,
            policy=self._policies[sku],
            now_fn=now_fn,
            refunded_at=refunded_at,
            total_refunded=total_refunded,
        )


def _resolve_money_options(
    major_name: str,
    major: float | None,
    minor_name: str,
    minor: int | None,
    *,
    required: bool,
) -> float:
    if major is not None and minor is not None:
        raise ValueError(f"Provide {major_name} or {minor_name}, not both")
    if major is None and minor is None:
        if required:
            raise ValueError(f"Provide either {major_name} or {minor_name}")
        return 0.0

    resolved = float(major) if major is not None else float(minor) / 100
    if not math.isfinite(resolved):
        raise ValueError(f"{major_name} must be a finite number")
    return resolved
