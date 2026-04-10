from __future__ import annotations

import json
import logging
import math
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
        total_refunded: float = 0.0,
    ) -> None:
        self._sku = sku
        self._transaction_id = transaction_id
        self._amount_paid = float(amount_paid)
        self._currency = currency
        self._purchased_at = purchased_at
        self._provider = provider
        self._provider_refund_fn = provider_refund_fn
        self._policy = policy
        self._total_refunded = float(total_refunded)
        self._now_fn = now_fn if now_fn is not None else _DEFAULT_NOW
        self._refunded_at = refunded_at

    def __call__(
        self, amount: float | None = None, *, reason: str | None = None
    ) -> dict[str, Any]:
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
            self._log(amount, result, reason)
            return result

        result = self._validate(amount, reason)
        if result is not None:
            self._log(amount, result, reason)
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
            self._log(amount, result, reason)
            return result

        total_refunded_before_call = self._total_refunded
        self._total_refunded += amount
        result = {
            "status": "approved",
            "refunded_amount": amount,
            "transaction_id": self._transaction_id,
            "provider_result": provider_result,
        }
        if reason is not None:
            result["reason"] = reason
        self._log(
            amount,
            result,
            reason,
            total_refunded_before_call=total_refunded_before_call,
        )
        return result

    def _validate(self, amount: float, reason: str | None) -> dict[str, Any] | None:
        now = self._now_fn()
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        purchased = self._purchased_at
        if purchased.tzinfo is None:
            purchased = purchased.replace(tzinfo=timezone.utc)
        deadline = purchased + timedelta(days=self._policy.refund_window_days)

        if not self._policy.refundable:
            return {
                "status": "denied",
                "reason": "not_refundable",
                "transaction_id": self._transaction_id,
            }

        if now > deadline:
            return {
                "status": "denied",
                "reason": "refund_window_expired",
                "purchased_at": self._purchased_at.isoformat(),
                "window_days": self._policy.refund_window_days,
                "transaction_id": self._transaction_id,
            }

        if (
            self._policy.allowed_reasons is not None
            and reason not in self._policy.allowed_reasons
        ):
            return {
                "status": "denied",
                "reason": "refund_reason_not_allowed",
                "requested_reason": reason,
                "allowed_reasons": list(self._policy.allowed_reasons),
                "transaction_id": self._transaction_id,
            }

        if not math.isfinite(amount):
            return {
                "status": "denied",
                "reason": "invalid_amount",
                "detail": "Amount must be a finite number",
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

        if self._policy.max_refund_minor_units is not None:
            max_policy_amount = self._policy.max_refund_minor_units / 100
            if amount > max_policy_amount:
                return {
                    "status": "denied",
                    "reason": "amount_exceeds_policy_max",
                    "requested": amount,
                    "max_allowed": max_policy_amount,
                    "transaction_id": self._transaction_id,
                }

        if self._policy.manual_approval_required_over_minor_units is not None:
            manual_threshold = (
                self._policy.manual_approval_required_over_minor_units / 100
            )
            if amount > manual_threshold:
                return {
                    "status": "denied",
                    "reason": "manual_approval_required",
                    "requested": amount,
                    "approval_required_over": manual_threshold,
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

    def _log(
        self,
        requested_amount: float,
        result: dict[str, Any],
        reason: str | None = None,
        *,
        total_refunded_before_call: float | None = None,
    ) -> None:
        total_refunded_before_call = (
            self._total_refunded
            if total_refunded_before_call is None
            else total_refunded_before_call
        )
        entry = {
            "transaction_id": self._transaction_id,
            "sku": self._sku,
            "provider": self._provider,
            "currency": self._currency,
            "requested_amount": requested_amount,
            "amount_paid": self._amount_paid,
            "total_refunded_before_call": total_refunded_before_call,
            **{k: v for k, v in result.items() if k != "provider_result"},
        }
        if reason is not None:
            entry["refund_reason"] = reason
        logger.info(json.dumps(entry, default=str))
