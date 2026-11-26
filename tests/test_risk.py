from app.analytics.risk import RiskEngine, RiskWeights
from app.core.config import Settings
from app.schemas.claim import ClaimCreate


def build_claim(
    claim_id="CLM-RISK-1",
    claim_amount=250_000,
    previous_claim_count=0,
    days_since_policy_start=300,
    incident_hour=10,
    supporting_documents_count=2,
):
    return ClaimCreate(
        claim_id=claim_id,
        policy_id="POL-RISK-1",
        customer_id="CUS-RISK-1",
        vehicle_age=4,
        vehicle_type="Car",
        vehicle_value=2_000_000,
        policy_age_days=600,
        incident_type="Collision",
        incident_location="Kathmandu",
        claim_amount=claim_amount,
        premium_amount=75_000,
        previous_claim_count=previous_claim_count,
        days_since_policy_start=days_since_policy_start,
        incident_hour=incident_hour,
        repair_cost=min(claim_amount, 200_000),
        supporting_documents_count=supporting_documents_count,
        claim_date="2026-01-15",
    )


def build_history():
    return [
        build_claim(
            claim_id=f"CLM-HIST-{index}",
            claim_amount=100_000 + index * 1_000,
            previous_claim_count=index % 2,
            days_since_policy_start=100 + index,
            incident_hour=8 + index % 12,
            supporting_documents_count=2,
        )
        for index in range(60)
    ]


def test_rules_add_explained_points_and_escalate_priority():
    claim = build_claim(
        claim_amount=1_600_000,
        previous_claim_count=4,
        days_since_policy_start=10,
        incident_hour=2,
        supporting_documents_count=0,
    )

    assessment = RiskEngine().assess(claim, [])
    codes = {indicator.code for indicator in assessment.risk_indicators}

    assert assessment.risk_score == 90
    assert assessment.review_priority == "High"
    assert assessment.is_anomaly is False
    assert {
        "claim_vehicle_ratio_high",
        "repeat_claims_high",
        "early_claim_high",
        "claim_premium_ratio_high",
        "documents_missing",
        "overnight_incident",
    } <= codes
    assert all(indicator.explanation for indicator in assessment.risk_indicators)
    assert "not proof of fraud" in assessment.disclaimer


def test_low_risk_claim_has_no_rule_indicators():
    claim = build_claim()

    assessment = RiskEngine().assess(claim, [])

    assert assessment.risk_score == 0
    assert assessment.review_priority == "Low"
    assert assessment.risk_indicators == []


def test_isolation_forest_marks_outlier_separately_from_rule_triggers():
    outlier = build_claim(
        claim_amount=3_500_000,
        previous_claim_count=8,
        days_since_policy_start=1,
        incident_hour=2,
        supporting_documents_count=0,
    )

    assessment = RiskEngine().assess(outlier, build_history())

    assert assessment.is_anomaly is True
    anomaly = next(indicator for indicator in assessment.risk_indicators if indicator.code == "statistical_anomaly")
    assert anomaly.points == 20
    assert "not evidence of fraud" in anomaly.explanation


def test_risk_weights_are_injectable():
    claim = build_claim(claim_amount=1_600_000)
    claim.premium_amount = 300_000

    assessment = RiskEngine(weights=RiskWeights(high_claim_vehicle_ratio=7)).assess(claim, [])

    assert assessment.risk_score == 7


def test_risk_thresholds_and_weights_can_be_configured():
    claim = build_claim(claim_amount=1_600_000)
    claim.premium_amount = 300_000
    settings = Settings(risk_claim_vehicle_ratio_high=0.7, risk_points_claim_vehicle_high=9)

    assessment = RiskEngine(settings=settings).assess(claim, [])

    assert assessment.risk_score == 9
    assert assessment.risk_indicators[0].points == 9


def test_invalid_risk_threshold_order_is_rejected():
    try:
        Settings(risk_high_threshold=30, risk_medium_threshold=40)
    except ValueError as error:
        assert "risk_medium_threshold" in str(error)
    else:
        raise AssertionError("invalid risk thresholds should be rejected")
