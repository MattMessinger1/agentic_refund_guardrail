from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

import pytest

from tests.conftest import make_mock_provider


class TestApproved:
    def test_full_refund(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_100",
            amount_paid=100.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        result = tool(100.00)
        assert result["status"] == "approved"
        assert result["refunded_amount"] == 100.00
        assert result["transaction_id"] == "pi_100"
        assert len(provider.calls) == 1
        assert provider.calls[0] == (100.00, "pi_100", "usd")

    def test_partial_refund(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_200",
            amount_paid=120.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        result = tool(80.00)
        assert result["status"] == "approved"
        assert result["refunded_amount"] == 80.00

    def test_custom_currency(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_300",
            amount_paid=50.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
            currency="eur",
        )
        tool(50.00)
        assert provider.calls[0][2] == "eur"

    def test_provider_result_forwarded(self, refunds, recent_purchase):
        provider = make_mock_provider(return_value={"id": "re_xyz", "object": "refund"})
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_400",
            amount_paid=50.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        result = tool(50.00)
        assert result["provider_result"]["id"] == "re_xyz"


class TestDenied:
    def test_expired_window(self, refunds):
        provider = make_mock_provider()
        old_purchase = datetime.now(timezone.utc) - timedelta(days=365)
        tool = refunds.make_refund_tool(
            sku="digital_course",
            transaction_id="pi_old",
            amount_paid=100.00,
            purchased_at=old_purchase,
            provider_refund_fn=provider,
        )
        result = tool(50.00)
        assert result["status"] == "denied"
        assert result["reason"] == "refund_window_expired"
        assert len(provider.calls) == 0

    def test_zero_amount(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_zero",
            amount_paid=100.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        result = tool(0)
        assert result["status"] == "denied"
        assert result["reason"] == "invalid_amount"
        assert len(provider.calls) == 0

    def test_negative_amount(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_neg",
            amount_paid=100.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        result = tool(-10)
        assert result["status"] == "denied"
        assert result["reason"] == "invalid_amount"

    def test_amount_exceeds_paid(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_over",
            amount_paid=120.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        result = tool(200.00)
        assert result["status"] == "denied"
        assert result["reason"] == "amount_exceeds_limit"
        assert result["requested"] == 200.00
        assert result["max_allowed"] == 120.00
        assert len(provider.calls) == 0

    def test_nan_amount_is_denied(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_nan",
            amount_paid=120.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        result = tool(math.nan)
        assert result["status"] == "denied"
        assert result["reason"] == "invalid_amount"
        assert len(provider.calls) == 0

    def test_amount_exceeds_remaining_after_partial(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_partial",
            amount_paid=100.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        first = tool(60.00)
        assert first["status"] == "approved"

        second = tool(60.00)
        assert second["status"] == "denied"
        assert second["reason"] == "amount_exceeds_remaining"
        assert second["remaining"] == 40.00
        assert second["already_refunded"] == 60.00

    def test_amount_exceeds_persisted_remaining_from_database(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_persisted_partial",
            amount_paid=100.00,
            amount_refunded=60.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        result = tool(60.00)
        assert result["status"] == "denied"
        assert result["reason"] == "amount_exceeds_remaining"
        assert result["remaining"] == 40.00
        assert len(provider.calls) == 0

    def test_exact_remaining_still_works(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_exact",
            amount_paid=100.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        tool(60.00)
        result = tool(40.00)
        assert result["status"] == "approved"
        assert result["refunded_amount"] == 40.00

    def test_fully_exhausted(self, refunds, recent_purchase):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_done",
            amount_paid=50.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        tool(50.00)
        result = tool(1.00)
        assert result["status"] == "denied"
        assert result["reason"] == "amount_exceeds_remaining"
        assert result["remaining"] == 0.00


class TestProviderError:
    def test_provider_exception_caught(self, refunds, recent_purchase):
        provider = make_mock_provider(succeed=False)
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_fail",
            amount_paid=100.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        result = tool(50.00)
        assert result["status"] == "error"
        assert result["reason"] == "provider_error"
        assert "Provider unavailable" in result["detail"]

    def test_provider_error_does_not_decrement_balance(self, refunds, recent_purchase):
        provider = make_mock_provider(succeed=False)
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_retry",
            amount_paid=100.00,
            purchased_at=recent_purchase,
            provider_refund_fn=provider,
        )
        tool(50.00)  # fails at provider

        good_provider = make_mock_provider()
        tool._provider_refund_fn = good_provider
        result = tool(100.00)  # full amount still available
        assert result["status"] == "approved"
        assert result["refunded_amount"] == 100.00


class TestNaiveDatetime:
    def test_naive_purchased_at_treated_as_utc(self, refunds):
        provider = make_mock_provider()
        tool = refunds.make_refund_tool(
            sku="shampoo",
            transaction_id="pi_naive",
            amount_paid=50.00,
            purchased_at=datetime(2099, 1, 1),  # far future, naive
            provider_refund_fn=provider,
        )
        result = tool(50.00)
        assert result["status"] == "approved"
