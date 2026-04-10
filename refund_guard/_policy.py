from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Union


@dataclass(frozen=True)
class SkuPolicy:
    """Refund rules for a single SKU."""

    refund_window_days: int
    refundable: bool = True
    max_refund_minor_units: int | None = None
    manual_approval_required_over_minor_units: int | None = None
    allowed_reasons: tuple[str, ...] | None = None


def load_policy(source: Union[str, Path, dict]) -> dict[str, SkuPolicy]:
    """Load SKU refund policies from a YAML file path or a plain dict.

    Accepted dict shape::

        {"digital_course": {"refund_window_days": 7}, ...}

    Or with a top-level ``skus`` key (the YAML format)::

        {"skus": {"digital_course": {"refund_window_days": 7}, ...}}
    """
    if isinstance(source, (str, Path)):
        return _load_yaml(source)
    if isinstance(source, dict):
        return _parse_dict(source)
    raise TypeError(f"Expected a file path or dict, got {type(source).__name__}")


def _load_yaml(path: Union[str, Path]) -> dict[str, SkuPolicy]:
    import yaml  # deferred so dict-only users don't need pyyaml installed

    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Policy file not found: {path}")
    with open(path) as f:
        raw = yaml.safe_load(f)
    if not isinstance(raw, dict):
        raise ValueError(f"Policy file must contain a YAML mapping, got {type(raw).__name__}")
    return _parse_dict(raw)


def _parse_dict(raw: dict) -> dict[str, SkuPolicy]:
    skus = raw.get("skus", raw)
    if not isinstance(skus, dict) or len(skus) == 0:
        raise ValueError("Policy must define at least one SKU under 'skus'")

    policies: dict[str, SkuPolicy] = {}
    for sku_name, rules in skus.items():
        if not isinstance(rules, dict):
            raise ValueError(f"Rules for SKU '{sku_name}' must be a mapping")
        window = rules.get("refund_window_days")
        if window is None or not isinstance(window, int) or window < 0:
            raise ValueError(
                f"SKU '{sku_name}' must have a non-negative integer 'refund_window_days'"
            )

        refundable = rules.get("refundable", True)
        if not isinstance(refundable, bool):
            raise ValueError(f"SKU '{sku_name}' field 'refundable' must be a boolean")

        max_refund_minor_units = _optional_non_negative_int(
            sku_name, rules, "max_refund_minor_units"
        )
        manual_approval_required_over_minor_units = _optional_non_negative_int(
            sku_name, rules, "manual_approval_required_over_minor_units"
        )
        allowed_reasons = _optional_string_tuple(sku_name, rules, "allowed_reasons")

        policies[sku_name] = SkuPolicy(
            refund_window_days=window,
            refundable=refundable,
            max_refund_minor_units=max_refund_minor_units,
            manual_approval_required_over_minor_units=manual_approval_required_over_minor_units,
            allowed_reasons=allowed_reasons,
        )

    return policies


def _optional_non_negative_int(
    sku_name: str, rules: dict, field: str
) -> int | None:
    value = rules.get(field)
    if value is None:
        return None
    if not isinstance(value, int) or value < 0:
        raise ValueError(
            f"SKU '{sku_name}' field '{field}' must be a non-negative integer"
        )
    return value


def _optional_string_tuple(
    sku_name: str, rules: dict, field: str
) -> tuple[str, ...] | None:
    value = rules.get(field)
    if value is None:
        return None
    if not isinstance(value, list) or not all(
        isinstance(item, str) and item for item in value
    ):
        raise ValueError(f"SKU '{sku_name}' field '{field}' must be a list of strings")
    return tuple(value)
