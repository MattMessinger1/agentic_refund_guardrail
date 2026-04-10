from __future__ import annotations

from typing import Any, Literal, TypedDict, Union

DenialReason = Literal[
    "already_refunded",
    "refund_window_expired",
    "amount_exceeds_limit",
    "amount_exceeds_remaining",
    "amount_exceeds_policy_max",
    "invalid_amount",
    "not_refundable",
    "refund_reason_not_allowed",
    "manual_approval_required",
]


class ApprovedRefundResult(TypedDict, total=False):
    status: Literal["approved"]
    refunded_amount: float
    transaction_id: str
    provider_result: Any
    reason: str


class DeniedRefundResult(TypedDict, total=False):
    status: Literal["denied"]
    reason: DenialReason
    transaction_id: str
    detail: str
    requested: float
    remaining: float
    already_refunded: float
    max_allowed: float
    approval_required_over: float
    requested_reason: str | None
    allowed_reasons: list[str]
    purchased_at: str
    refunded_at: str
    window_days: int


class ErrorRefundResult(TypedDict, total=False):
    status: Literal["error"]
    reason: Literal["provider_error"]
    detail: str
    transaction_id: str


RefundResult = Union[ApprovedRefundResult, DeniedRefundResult, ErrorRefundResult]
