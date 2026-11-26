import pandas as pd
import pytest

from scripts.generate_data import CLAIM_COLUMNS, generate_claims


def test_generation_is_reproducible_and_has_required_fields():
    first = generate_claims(count=100, seed=7)
    second = generate_claims(count=100, seed=7)

    pd.testing.assert_frame_equal(first, second)
    assert tuple(first.columns) == CLAIM_COLUMNS
    assert len(first) == 100
    assert first["claim_id"].is_unique


def test_generation_contains_unusual_patterns_and_missing_values():
    claims = generate_claims(count=500, seed=19)

    assert (claims["claim_amount"] > claims["vehicle_value"]).any()
    assert (claims["previous_claim_count"] >= 4).any()
    assert (claims["days_since_policy_start"] <= 12).any()
    assert claims["supporting_documents_count"].isna().any()
    assert claims["incident_location"].isna().any()


def test_generation_rejects_non_positive_count():
    with pytest.raises(ValueError, match="at least 1"):
        generate_claims(count=0)
