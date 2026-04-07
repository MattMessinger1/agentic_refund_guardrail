from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from refund_guard._policy import SkuPolicy

logger = logging.getLogger("refund_guard")

_DEFAULT_NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


class RefundTool:
    """A callable that validates and executes a refund for one specific order.

    Created by :meth:`Refunds.make_refund_tool` -- not instantiated directly.
    The agent receives this as a plain callable: ``refund_tool(amount)``
    or ``refund_tool()`` for a full refund of the remaining balance.
    """

    def __init__(
        self,
        *,
        sku: str,
        transaction_id: str,
        amount_paid: float,
        currency: str,
        purchased_at: datetime,
        provider: str,
        provider_refund_fn: Callable[[float, str, str], Any],
        policy: SkuPolicy,
        now_fn: Callable[[], datetime] | None = None,
        refunded_at: datetime | None = None,
    ) -> None:
        self._sku = sku
        self._transaction_id = transaction_id
        self._amount_paid = float(amount_paid)
        self._currency = currency
        self._purchased_at = purchased_at
        self._provider = provider
        self._provider_refund_fn = provider_refund_fn
        self._policy = policy
        self._total_refunded: float = 0.0
        self._now_fn = now_fn if now_fn is not None else _DEFAULT_NOW
        self._refunded_at = refunded_at

    def __call__(self, amount: float | None = None) -> dict[str, Any]:
        if amount is None:
            amount = round(self._amount_paid - self._total_refunded, 2)
        amount = float(amount)

        if self._refunded_at is not None:
            result: dict[str, Any] = {
                "status": "denied",
                "reason": "already_refunded",
                "refunded_at": self._refunded_at.isoformat(),
                "transaction_id": self._transaction_id,
            }
            self._log(amount, result)
            return result

        result = self._validate(amount)
        if result is not None:
            self._log(amount, result)
            return result

        try:
            provider_result = self._provider_refund_fn(
                amount, self._transaction_id, self._currency
            )
        except Exception as exc:
            result = {
                "status": "error",
                "reason": "provider_error",
                "detail": str(exc),
                "transaction_id": self._transaction_id,
            }
            self._log(amount, result)
            return result

        self._total_refunded += amount
        result = {
            "status": "approved",
            "refunded_amount": amount,
            "transaction_id": self._transaction_id,
            "provider_result": provider_result,
        }
        self._log(amount, result)
        return result

    def _validate(self, amount: float) -> dict[str, Any] | None:
        now = self._now_fn()
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        purchased = self._purchased_at
        if purchased.tzinfo is None:
            purchased = purchased.replace(tzinfo=timezone.utc)
        deadline = purchased + timedelta(days=self._policy.refund_window_days)

        if now > deadline:
            return {
                "status": "denied",
                "reason": "refund_window_expired",
                "purchased_at": self._purchased_at.isoformat(),
                "window_days": self._policy.refund_window_days,
                "transaction_id": self._transaction_id,
            }

        if amount <= 0:
            return {
                "status": "denied",
                "reason": "invalid_amount",
                "detail": "Amount must be greater than zero",
                "transaction_id": self._transaction_id,
            }

        if amount > self._amount_paid:
            return {
                "status": "denied",
                "reason": "amount_exceeds_limit",
                "requested": amount,
                "max_allowed": self._amount_paid,
                "transaction_id": self._transaction_id,
            }

        remaining = round(self._amount_paid - self._total_refunded, 2)
        if amount > remaining:
            return {
                "status": "denied",
                "reason": "amount_exceeds_remaining",
                "requested": amount,
                "remaining": remaining,
                "already_refunded": self._total_refunded,
                "transaction_id": self._transaction_id,
            }

        return None

    def _log(self, requested_amount: float, result: dict[str, Any]) -> None:
        entry = {
            "transaction_id": self._transaction_id,
            "sku": self._sku,
            "provider": self._provider,
            "currency": self._currency,
            "requested_amount": requested_amount,
            "amount_paid": self._amount_paid,
            **{k: v for k, v in result.items() if k != "provider_result"},
        }
        logger.info(json.dumps(entry, default=str))
