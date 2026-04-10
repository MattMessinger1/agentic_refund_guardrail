from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from refund_guard import Refunds
from refund_guard._policy import SkuPolicy, load_policy


class TestLoadFromDict:
    def test_flat_dict(self):
        policies = load_policy({"digital_course": {"refund_window_days": 7}})
        assert policies == {"digital_course": SkuPolicy(refund_window_days=7)}

    def test_dict_with_skus_key(self):
        policies = load_policy({"skus": {"shampoo": {"refund_window_days": 30}}})
        assert policies == {"shampoo": SkuPolicy(refund_window_days=30)}

    def test_multiple_skus(self):
        policies = load_policy({
            "skus": {
                "a": {"refund_window_days": 1},
                "b": {"refund_window_days": 60},
            }
        })
        assert len(policies) == 2
        assert policies["a"].refund_window_days == 1
        assert policies["b"].refund_window_days == 60

    def test_empty_dict_raises(self):
        with pytest.raises(ValueError, match="at least one SKU"):
            load_policy({"skus": {}})

    def test_missing_window_raises(self):
        with pytest.raises(ValueError, match="refund_window_days"):
            load_policy({"item": {}})

    def test_negative_window_raises(self):
        with pytest.raises(ValueError, match="refund_window_days"):
            load_policy({"item": {"refund_window_days": -1}})

    def test_optional_policy_fields(self):
        policies = load_policy({
            "item": {
                "refund_window_days": 30,
                "refundable": False,
                "max_refund_minor_units": 5000,
                "manual_approval_required_over_minor_units": 2500,
                "allowed_reasons": ["provider_cancelled"],
            }
        })
        policy = policies["item"]
        assert policy.refundable is False
        assert policy.max_refund_minor_units == 5000
        assert policy.manual_approval_required_over_minor_units == 2500
        assert policy.allowed_reasons == ("provider_cancelled",)

    def test_wrong_type_raises(self):
        with pytest.raises(TypeError, match="file path or dict"):
            load_policy(42)  # type: ignore[arg-type]


class TestLoadFromYaml:
    def test_valid_yaml(self, tmp_path: Path):
        f = tmp_path / "policy.yaml"
        f.write_text(textwrap.dedent("""\
            skus:
              digital_course:
                refund_window_days: 7
        """))
        policies = load_policy(f)
        assert policies == {"digital_course": SkuPolicy(refund_window_days=7)}

    def test_string_path(self, tmp_path: Path):
        f = tmp_path / "policy.yaml"
        f.write_text("skus:\n  item:\n    refund_window_days: 14\n")
        policies = load_policy(str(f))
        assert "item" in policies

    def test_missing_file_raises(self):
        with pytest.raises(FileNotFoundError):
            load_policy("/nonexistent/policy.yaml")

    def test_invalid_yaml_content(self, tmp_path: Path):
        f = tmp_path / "bad.yaml"
        f.write_text("just a string")
        with pytest.raises(ValueError, match="YAML mapping"):
            load_policy(f)


class TestRefundsInit:
    def test_unknown_sku_raises(self, refunds, recent_purchase):
        mock = lambda a, t, c: {}  # noqa: E731
        with pytest.raises(ValueError, match="mystery"):
            refunds.make_refund_tool(
                sku="mystery",
                transaction_id="pi_1",
                amount_paid=100,
                purchased_at=recent_purchase,
                provider_refund_fn=mock,
            )

    def test_invalid_amount_paid_raises(self, refunds, recent_purchase):
        mock = lambda a, t, c: {}  # noqa: E731
        with pytest.raises(ValueError, match="finite"):
            refunds.make_refund_tool(
                sku="shampoo",
                transaction_id="pi_1",
                amount_paid=float("nan"),
                purchased_at=recent_purchase,
                provider_refund_fn=mock,
            )

    def test_amount_refunded_cannot_exceed_paid(self, refunds, recent_purchase):
        mock = lambda a, t, c: {}  # noqa: E731
        with pytest.raises(ValueError, match="cannot exceed"):
            refunds.make_refund_tool(
                sku="shampoo",
                transaction_id="pi_1",
                amount_paid_minor_units=1000,
                amount_refunded_minor_units=2000,
                purchased_at=recent_purchase,
                provider_refund_fn=mock,
            )
