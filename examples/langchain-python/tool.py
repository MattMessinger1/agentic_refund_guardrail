"""
LangChain tool pattern.

The model supplies amount + reason. Your tool body loads the order and creates
the scoped refund-guard tool from server-side truth.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from langchain_core.tools import tool
from pydantic import BaseModel, Field

from refund_guard import DENIAL_MESSAGES, Refunds

refunds = Refunds({
    "skus": {
        "success_fee": {
            "refund_window_days": 90,
            "allowed_reasons": [
                "provider_cancelled",
                "duplicate_charge",
                "technical_error",
            ],
        }
    }
})


class RefundOrderInput(BaseModel):
    order_id: str = Field(description="Order ID from the current authenticated user")
    amount: float | None = Field(
        default=None,
        description="Refund amount in major units. None means full remaining balance.",
    )
    reason: Literal[
        "provider_cancelled",
        "duplicate_charge",
        "technical_error",
    ]


@tool(args_schema=RefundOrderInput)
def refund_order(
    order_id: str,
    amount: float | None,
    reason: str,
) -> dict:
    """Refund a server-scoped order if refund-guard approves it."""

    order = load_order_from_db(order_id)
    refund = refunds.make_refund_tool(
        sku=order["sku"],
        transaction_id=order["payment_intent_id"],
        amount_paid_minor_units=order["amount_paid_cents"],
        amount_refunded_minor_units=order["amount_refunded_cents"],
        purchased_at=datetime.fromisoformat(order["purchased_at"]),
        refunded_at=(
            datetime.fromisoformat(order["refunded_at"])
            if order["refunded_at"] is not None
            else None
        ),
        provider="stripe",
        provider_refund_fn=lambda validated_amount, transaction_id, currency: (
            create_stripe_refund(
                payment_intent_id=transaction_id,
                amount_cents=round(validated_amount * 100),
                currency=currency,
                reason=reason,
                idempotency_key=f"refund:{order_id}:{round(validated_amount * 100)}:{reason}",
            )
        ),
    )

    result = refund(reason=reason) if amount is None else refund(amount, reason=reason)
    if result["status"] == "approved":
        return {"success": True, "amount": result["refunded_amount"]}

    return {
        "success": False,
        "code": result["reason"],
        "message": DENIAL_MESSAGES.get(result["reason"], "Refund not allowed."),
    }


def load_order_from_db(order_id: str) -> dict:
    raise NotImplementedError("Replace with your database lookup")


def create_stripe_refund(
    *,
    payment_intent_id: str,
    amount_cents: int,
    currency: str,
    reason: str,
    idempotency_key: str,
) -> dict:
    raise NotImplementedError("Replace with your Stripe call")
