"""
Stripe refund example with refund-guard.

⚠️  WARNING: This example calls the REAL Stripe API when run.
    It will attempt an actual refund if you provide valid Stripe credentials.
    For a safe example that doesn't touch Stripe, see examples/minimal-python/.

Prerequisites:
    pip install refund-guard stripe

    You also need a valid STRIPE_SECRET_KEY in your environment.

Run from the repo root (so the relative YAML path resolves):
    python examples/stripe_example.py

Replace FakeOrder with your real order-loading logic.
"""

from datetime import datetime, timezone

from refund_guard import Refunds

# --- 1. Load your refund policy ----------------------------------------

refunds = Refunds("examples/refund_policy.yaml")


# --- 2. Your existing Stripe refund function ----------------------------
# This is whatever you already use. refund-guard just wraps it.

def stripe_refund(amount: float, transaction_id: str, currency: str) -> dict:
    """Call Stripe's refund API. Replace with your real implementation."""
    import stripe

    return stripe.Refund.create(
        payment_intent=transaction_id,
        amount=int(amount * 100),  # Stripe expects cents
        currency=currency,
    )


# --- 3. Load a real order from your DB ----------------------------------
# YOUR APP does this -- not the agent.

class FakeOrder:
    sku = "shampoo"
    transaction_id = "pi_3abc123"
    amount_paid = 49.99
    currency = "usd"
    purchased_at = datetime.now(timezone.utc)


order = FakeOrder()


# --- 4. Create a scoped refund tool -------------------------------------

refund_tool = refunds.make_refund_tool(
    sku=order.sku,
    transaction_id=order.transaction_id,
    amount_paid=order.amount_paid,
    purchased_at=order.purchased_at,
    provider_refund_fn=stripe_refund,
    currency=order.currency,
    provider="stripe",
)


# --- 5. This is all the agent gets -------------------------------------

if __name__ == "__main__":
    result = refund_tool(49.99)
    print(result)
    # {"status": "approved", "refunded_amount": 49.99, ...}

    result = refund_tool(1.00)
    print(result)
    # {"status": "denied", "reason": "amount_exceeds_remaining", ...}
