"""refund-guard: Turn a real order into a safe refund tool for your AI agent."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Union

from refund_guard._policy import load_policy
from refund_guard._tool import RefundTool

__all__ = ["Refunds"]


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
        amount_paid: float,
        purchased_at: datetime,
        provider_refund_fn: Callable[[float, str, str], Any],
        currency: str = "usd",
        provider: str = "unknown",
    ) -> RefundTool:
        """Create a refund callable scoped to one order.

        Raises ``ValueError`` if the SKU is not in the loaded policy.
        """
        if sku not in self._policies:
            known = ", ".join(sorted(self._policies))
            raise ValueError(
                f"SKU '{sku}' not found in policy. Known SKUs: {known}"
            )

        return RefundTool(
            sku=sku,
            transaction_id=transaction_id,
            amount_paid=amount_paid,
            currency=currency,
            purchased_at=purchased_at,
            provider=provider,
            provider_refund_fn=provider_refund_fn,
            policy=self._policies[sku],
        )
